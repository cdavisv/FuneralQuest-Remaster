import { BotRandom, type BotSeat, createBotPlayer, fairBrain, mix, runBotDay } from "@fq/bots";
import {
  CLASSIC_RULES,
  type ClassicRules,
  type ContentPack,
  checkExpandedContent,
  classicContext,
  createClassicRegistry,
  createDailyChallenge,
  createExpandedRegistry,
  createPlayer,
  createTown,
  type DailyChallengeResult,
  dailyChallengeResult,
  type Effect,
  type EngineContext,
  EXPANDED_RULES,
  enterGame,
  expandedContext,
  originalClassicRules,
  parseLegacyText,
  type Registry,
  runDailyMaintenance,
  startDailyChallenge,
  step,
  type TownState,
  withExpandedContent,
} from "@fq/core";
import type { Action, Button, View } from "@fq/protocol";
import { practiceDay, zoneOffsetMinutes } from "./dates.js";
import { migrateSave } from "./saves.js";
import {
  END_DAY,
  type Notice,
  RESUME,
  SAVE_FORMAT,
  SAVE_VERSION,
  type SoloConfig,
  type SoloSave,
  type SoloStatus,
  type Standing,
  type Transport,
  type Unsubscribe,
} from "./types.js";

export { END_DAY, practiceDay, RESUME };

const DAY_MS = 86_400_000;
/** At most this many missed real days are played when a real-time save is opened. */
const MAX_CATCH_UP = 366;
/** TV reports from the night shown on waking: the last few (the notice layer stacks four toasts at most). */
const TV_DIGEST = 3;

export interface HostOptions {
  /** Wall clock in ms since epoch; default `Date.now`. Only real-time mode reads it for rules. */
  now?: () => number;
  /**
   * The player's IANA time zone (the page passes its own: a worker has no window). The time in
   * front of notices is printed in it, following daylight saving. Without it: the config's
   * `utcOffsetMinutes`, else the zone of the runtime's `Date`.
   */
  timeZone?: string;
}

/** The player's local time minus UTC at `now`, in minutes, for the engine's notices. */
function offsetFor(config: Pick<SoloConfig, "utcOffsetMinutes">, options: HostOptions) {
  return (now: number): number => {
    if (options.timeZone) return zoneOffsetMinutes(options.timeZone, now);
    if (config.utcOffsetMinutes !== undefined) return config.utcOffsetMinutes;
    return -new Date(now).getTimezoneOffset();
  };
}

export function rulesFor(name: SoloConfig["ruleset"]): ClassicRules {
  if (name === "expanded") return EXPANDED_RULES;
  return name === "original" ? originalClassicRules() : CLASSIC_RULES;
}

const CHALLENGE_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The engine context for a game: Classic or Expanded rules, always with the given registry. */
function contextFor(
  config: Pick<SoloConfig, "ruleset" | "utcOffsetMinutes">,
  content: ContentPack,
  registry: Registry,
  now: number,
  options: HostOptions,
): EngineContext {
  const rules = rulesFor(config.ruleset);
  const base =
    config.ruleset === "expanded"
      ? expandedContext(content, { rules, registry, now })
      : classicContext(content, { rules, registry, now });
  return { ...base, localTimeOffsetMinutes: offsetFor(config, options)(now) };
}

function registryFor(config: Pick<SoloConfig, "ruleset">): Registry {
  return config.ruleset === "expanded" ? createExpandedRegistry() : createClassicRegistry();
}

/** Why `content` cannot play the Expanded ruleset, or null. */
function expandedProblem(content: ContentPack): string | null {
  const filled = withExpandedContent(content);
  const rules = EXPANDED_RULES.expanded;
  if (!filled.expanded || !rules) return "the Expanded rules are missing";
  const problems = checkExpandedContent(filled.expanded, rules);
  return problems.length === 0 ? null : problems.slice(0, 3).join("; ");
}

/** The guided first day is done (or skipped): the desk shows its normal buttons. */
function skipTutorial(town: TownState, playerId: number): void {
  const x = town.players[playerId]?.expanded;
  if (x) x.tutorial = { step: 99, done: true };
}

/** The local day number (days since the epoch at the player's offset). */
export function localDay(now: number, utcOffsetMinutes = 0): number {
  return Math.floor((now + utcOffsetMinutes * 60_000) / DAY_MS);
}

function text(line: string): View["text"] {
  return [{ text: line }];
}

/**
 * A whole town on the player's machine: the player plus AI rival parlors,
 * one content pack and rule set. It speaks the client's `Transport` shape
 * and pushes the same `Notice`s the server does.
 *
 * Who is online: the rivals have no session while the player plays (so they
 * can be visited, robbed, attacked and burned), and the player is logged off
 * while the rivals take their turns (so they can do the same back). Mail
 * crosses both ways and is read at the desk the next day.
 *
 * Day flow: the player ends the day (the desk's End the Day button, or
 * logging off and sleeping), or in real-time mode midnight passes; then every
 * rival plays its day, maintenance runs, and the player wakes on the new day.
 */
export class SoloHost implements Transport {
  private town: TownState;
  private readonly bots: BotSeat[];
  private readonly registry: Registry;
  private readonly now: () => number;
  private realDay: number | null;
  private lastView: View | null = null;
  private readonly pushListeners = new Set<(view: View) => void>();
  private readonly noticeListeners = new Set<(notice: Notice) => void>();

  private constructor(
    private readonly config: SoloConfig,
    private readonly content: ContentPack,
    save: Pick<SoloSave, "town" | "humanId" | "bots" | "realDay" | "createdAt">,
    private readonly options: HostOptions,
  ) {
    this.now = options.now ?? Date.now;
    this.registry = registryFor(config);
    this.town = save.town;
    this.humanId = save.humanId;
    this.createdAt = save.createdAt;
    this.realDay = save.realDay;
    this.bots = save.bots.map((b) => ({
      playerId: b.playerId,
      memory: structuredClone(b.memory),
      brain: fairBrain(content),
    }));
  }

  readonly humanId: number;
  private readonly createdAt: number;

  /** A new game: the town, the player's parlor (logged on, reading the paper) and the rivals. */
  static create(config: SoloConfig, content: ContentPack, options: HostOptions = {}): SoloHost {
    const now = (options.now ?? Date.now)();
    if (config.ruleset === "expanded") {
      const problem = expandedProblem(content);
      if (problem) {
        throw new SoloSetupError(
          "contentPack",
          `The content pack "${content.id}" cannot run the Expanded ruleset: ${problem}.`,
        );
      }
    }
    if (config.mode === "daily") return SoloHost.createDaily(config, content, options, now);
    const registry = registryFor(config);
    const ctx = contextFor(config, content, registry, now, options);
    // `maintDelete` (maint.cpp:296) closes a parlor that has sold nothing by midnight. That keeps
    // a server's list of dead accounts short; on the player's own machine it would only end
    // their game for a slow first days, so it is off.
    const settings =
      config.mode === "career"
        ? { tournamentActive: true, tournamentDays: config.careerDays ?? 30, maintDelete: false }
        : { tournamentActive: false, maintDelete: false };
    let town = createTown({ seed: config.seed, settings }, ctx).town;
    const made = createPlayer(
      town,
      {
        logon: "soloplayer",
        name: config.player.name,
        parlor: config.player.parlor,
        password: "solo",
        passwordVerify: "solo",
        male: config.player.male,
        email: "player@solo.invalid",
      },
      ctx,
    );
    if (!made.ok) {
      throw new SoloSetupError(made.field, made.error.map((s) => s.text).join(""));
    }
    town = made.town;
    if (config.ruleset === "expanded" && config.tutorial === false) {
      town = structuredClone(town);
      skipTutorial(town, made.playerId);
    }
    const bots: SoloSave["bots"] = [];
    for (const rival of config.rivals) {
      const bot = createBotPlayer(town, rival, ctx);
      town = bot.town;
      bots.push({ playerId: bot.seat.playerId, memory: bot.seat.memory });
    }
    const realDay = config.clock === "realtime" ? localDay(now, config.utcOffsetMinutes) : null;
    const host = new SoloHost(
      config,
      content,
      { town, humanId: made.playerId, bots, realDay, createdAt: now },
      options,
    );
    host.lastView = host.dress(made.view);
    return host;
  }

  /**
   * The Daily Challenge as offline practice: the engine's `createDailyChallenge` for the date, one
   * parlor in a private town with the fixed loadout, no rivals, no maintenance, no leaderboard.
   * The same date gives the same customers.
   */
  private static createDaily(
    config: SoloConfig,
    content: ContentPack,
    options: HostOptions,
    now: number,
  ): SoloHost {
    if (config.ruleset !== "expanded") {
      throw new SoloSetupError("ruleset", "The Daily Challenge needs the Expanded ruleset.");
    }
    const day = config.challengeDay ?? practiceDay(now, config.utcOffsetMinutes);
    if (!CHALLENGE_DAY.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) {
      throw new SoloSetupError("challengeDay", `"${day}" is not a date such as 2026-11-06.`);
    }
    const registry = registryFor(config);
    const ctx = contextFor(config, content, registry, now, options);
    let started: ReturnType<typeof startDailyChallenge>;
    try {
      started = startDailyChallenge(createDailyChallenge(day, ctx), config.player, ctx);
    } catch (error) {
      throw new SoloSetupError(
        "name",
        error instanceof Error ? error.message : "That parlor was refused.",
      );
    }
    const host = new SoloHost(
      { ...config, challengeDay: day, clock: "manual", rivals: [] },
      content,
      { town: started.town, humanId: started.playerId, bots: [], realDay: null, createdAt: now },
      options,
    );
    host.lastView = host.dress(started.view);
    return host;
  }

  /** Opens a save (any version the migrations know). The pack must be the one the save names. */
  static load(raw: unknown, content: ContentPack, options: HostOptions = {}): SoloHost {
    const save = migrateSave(raw);
    if (save.config.contentPack !== content.id) {
      throw new Error(
        `This save uses the content pack "${save.config.contentPack}", not "${content.id}".`,
      );
    }
    return new SoloHost(save.config, content, save, options);
  }

  // ------------------------------------------------------------ Transport

  connect(): Promise<View> {
    return Promise.resolve(this.connectNow());
  }

  send(action: Action): Promise<View> {
    return Promise.resolve(this.act(action));
  }

  onPush(listener: (view: View) => void): Unsubscribe {
    this.pushListeners.add(listener);
    return () => {
      this.pushListeners.delete(listener);
    };
  }

  /** Broadcasts, TV, chat, mail, new day: the same notices the server pushes. */
  onNotice(listener: (notice: Notice) => void): Unsubscribe {
    this.noticeListeners.add(listener);
    return () => {
      this.noticeListeners.delete(listener);
    };
  }

  close(): void {
    this.pushListeners.clear();
    this.noticeListeners.clear();
  }

  /** Ends the day now (manual clock): every rival plays, maintenance runs, the player wakes up. */
  endDay(): Promise<View> {
    return Promise.resolve(this.endDayNow());
  }

  // ------------------------------------------------------------ synchronous API

  /** The player's current screen, logging them on if they are not. Catches up a real-time clock first. */
  connectNow(): View {
    this.catchUp(false);
    const session = this.town.sessions[String(this.humanId)];
    if (session?.view) return this.show(session.view);
    return this.enterHuman();
  }

  act(action: Action): View {
    if (this.catchUp(true)) return this.current();
    if (action.type === "press" && this.lastView?.buttons.some((b) => b.id === action.buttonId)) {
      if (action.buttonId === END_DAY) return this.endDayNow();
      if (action.buttonId === RESUME) return this.enterHuman();
    }
    if (!this.town.sessions[String(this.humanId)]) return this.show(this.lobby());
    const result = step(this.town, this.humanId, action, this.ctx());
    if (result.rejected) return this.current();
    this.town = result.town;
    this.deliver(result.effects);
    if (!this.town.sessions[String(this.humanId)]) {
      this.notice({ kind: "sessionEnded", reason: "quit" });
      return this.show(this.lobby());
    }
    return this.show(result.view);
  }

  endDayNow(): View {
    if (this.config.clock !== "manual" || this.daily || this.finished()) return this.current();
    return this.wake(this.rollDay());
  }

  /** In real-time mode, plays any days the clock has passed. Returns true when the day changed. */
  tick(): boolean {
    return this.catchUp(true);
  }

  status(): SoloStatus {
    const finished = this.finished();
    const s = this.town.settings;
    const result = this.challengeResult();
    return {
      day: this.town.day,
      mode: this.config.mode,
      clock: this.config.clock,
      finished,
      daysLeft:
        !this.daily && s.tournamentActive ? Math.max(0, s.tournamentDays - this.town.day) : null,
      canEndDay: this.config.clock === "manual" && !this.daily && !finished,
      standings: this.standings(),
      ...(result
        ? {
            challenge: {
              day: this.config.challengeDay ?? "",
              finished: result.finished,
              score: result.score,
              money: result.money,
              sales: result.sales,
              exact: result.exact,
              walkouts: result.walkouts,
            },
          }
        : {}),
    };
  }

  /** The whole game as JSON, mid-day and mid-negotiation included. */
  save(): SoloSave {
    return {
      format: SAVE_FORMAT,
      version: SAVE_VERSION,
      createdAt: this.createdAt,
      savedAt: this.now(),
      config: structuredClone(this.config),
      town: structuredClone(this.town),
      humanId: this.humanId,
      bots: this.bots.map((b) => ({ playerId: b.playerId, memory: structuredClone(b.memory) })),
      realDay: this.realDay,
    };
  }

  /** The town as it stands (read only; for tests and debugging tools). */
  get state(): TownState {
    return this.town;
  }

  // ------------------------------------------------------------ internals

  private ctx(): EngineContext {
    return contextFor(this.config, this.content, this.registry, this.now(), this.options);
  }

  private get daily(): boolean {
    return this.config.mode === "daily";
  }

  private challengeResult(): DailyChallengeResult | null {
    return this.daily && this.town.expanded?.challenge ? dailyChallengeResult(this.town) : null;
  }

  private finished(): boolean {
    if (this.daily) return this.challengeResult()?.finished ?? false;
    const s = this.town.settings;
    return s.tournamentActive && this.town.day >= s.tournamentDays + 1;
  }

  private current(): View {
    return this.lastView ?? this.connectNow();
  }

  /** Adds the host's own buttons and remembers the view. */
  private dress(view: View): View {
    let out = view;
    const desk =
      view.scene === "desk" && !view.overlay && view.buttons.some((b) => b.id === "desk:wait");
    if (desk && this.config.clock === "manual" && !this.daily && !this.finished()) {
      const end: Button = { id: END_DAY, label: "End the Day" };
      out = { ...view, buttons: [...view.buttons, end] };
    }
    this.lastView = out;
    return out;
  }

  private show(view: View): View {
    return this.dress(view);
  }

  private push(view: View): void {
    const dressed = this.dress(view);
    for (const listener of [...this.pushListeners]) listener(dressed);
  }

  private notice(notice: Notice): void {
    for (const listener of [...this.noticeListeners]) listener(notice);
  }

  /** What the player sees while logged off. */
  private lobby(): View {
    if (this.daily) return this.dailyLobby();
    const buttons: Button[] = [{ id: RESUME, label: "Open the Parlor" }];
    if (this.config.clock === "manual" && !this.finished()) {
      buttons.push({ id: END_DAY, label: "Sleep Until Tomorrow" });
    }
    const line = this.finished()
      ? "The tournament is over. The parlors are closed for good."
      : this.config.clock === "manual"
        ? "Your parlor is closed for the night. Your rivals are not sleeping."
        : "Your parlor is closed. The next day starts at midnight.";
    // The parlor at night: it is the picture the phone layout shows, the other layouts draw the
    // front door's graveyard instead.
    return {
      scene: "lobby",
      title: "Funeral Quest",
      text: text(line),
      picture: { bg: "places/funeral_home(black)" },
      buttons,
    };
  }

  /** After a practice run: the score, and no way back in (start another run for another try). */
  private dailyLobby(): View {
    const r = this.challengeResult();
    const line = r
      ? `Practice challenge ${this.config.challengeDay ?? ""}: ${r.score} BP, ${r.sales} sales, $${r.money} gained.`
      : "The practice challenge is over.";
    return {
      scene: "lobby",
      title: "Funeral Quest",
      text: text(line),
      picture: { bg: "places/funeral_home(black)" },
      buttons: [],
    };
  }

  private enterHuman(): View {
    const result = enterGame(this.town, this.humanId, this.ctx());
    if (result.rejected) return this.show(this.lobby());
    this.town = result.town;
    this.deliver(result.effects);
    return this.show(result.view);
  }

  /** Effects of the player's own actions, as the server would push them. */
  private deliver(effects: readonly Effect[]): void {
    for (const e of effects) {
      if (e.kind === "chat" && e.to.includes(this.humanId)) {
        this.notice({ kind: "chat", text: e.text });
        if (this.lastView) {
          const view = this.lastView;
          this.push({ ...view, chat: [...(view.chat ?? []), { text: e.text }] });
        }
      } else if (e.kind === "broadcast") {
        const session = this.town.sessions[String(this.humanId)];
        if (session && session.status !== "chat") {
          this.notice({ kind: "broadcast", text: parseLegacyText(e.text) });
        }
      }
    }
  }

  /** The player logs off, every rival plays its day, then maintenance. */
  private rollDay(): Effect[] {
    const ctx = this.ctx();
    const effects: Effect[] = [];
    if (this.town.sessions[String(this.humanId)]) {
      const off = step(this.town, this.humanId, { type: "exit" }, ctx);
      this.town = off.town;
    }
    const order = new BotRandom(mix(this.town.seed, this.town.day, 0x501d)).shuffle(this.bots);
    for (const seat of order) {
      const day = runBotDay(this.town, seat, ctx);
      this.town = day.town;
      effects.push(...day.effects);
    }
    const maintenance = runDailyMaintenance(this.town, ctx, { missedDays: 1 });
    this.town = maintenance.town;
    effects.push(...maintenance.effects);
    return effects;
  }

  /** The player logs on to the new day; the notices go out. */
  private wake(overnight: Effect[] = []): View {
    const view = this.enterHuman();
    this.notice({ kind: "newDay", day: this.town.day });
    // The night's TV reports (walkouts, big sales, fires), the last few.
    const tv = overnight.filter((e) => e.kind === "tv").slice(-TV_DIGEST);
    for (const e of tv) if (e.kind === "tv") this.notice({ kind: "tv", text: e.text });
    const mail = (this.town.players[this.humanId]?.mail ?? []).filter(
      (p) => p.type === "text" && p.importance === "high",
    ).length;
    if (mail > 0) this.notice({ kind: "mail", count: mail });
    return view;
  }

  /** Real-time mode: plays the days the clock has passed. */
  private catchUp(wakeIfChanged: boolean): boolean {
    if (this.config.clock !== "realtime" || this.realDay === null) return false;
    const today = localDay(this.now(), this.config.utcOffsetMinutes);
    if (today <= this.realDay) return false;
    let played = 0;
    let overnight: Effect[] = [];
    while (this.realDay < today && played < MAX_CATCH_UP && !this.finished()) {
      overnight = this.rollDay();
      this.realDay++;
      played++;
    }
    this.realDay = today;
    if (played === 0) return false;
    if (wakeIfChanged) this.push(this.wake(overnight));
    return true;
  }

  private standings(): Standing[] {
    const bots = new Map(this.bots.map((b) => [b.playerId, b.memory.personality]));
    return this.town.players
      .filter((p) => p.active)
      .sort((a, b) => b.bp - a.bp || a.id - b.id)
      .map((p, i) => {
        const personality = bots.get(p.id);
        return {
          place: i + 1,
          playerId: p.id,
          name: p.name,
          parlor: p.parlor,
          bp: p.bp,
          human: p.id === this.humanId,
          ...(personality ? { personality } : {}),
        };
      });
  }
}

/** The player's parlor form was refused (name taken, too short, ...). */
export class SoloSetupError extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "SoloSetupError";
  }
}
