import { randomBytes } from "node:crypto";
import {
  type BotMemory,
  BotRandom,
  createMemory,
  type Difficulty,
  describeAction,
  mix,
  offered,
  type PersonalityId,
  type Policy,
  safeAction,
  signature,
} from "@fq/bots";
import type { Action, View } from "@fq/protocol";
import { ApiClient, ApiError, type ParlorForm, type ServerMessage } from "@fq/server/client";
import WebSocket from "ws";
import type { Secret, World } from "./world.js";

export interface PlayerSpec {
  index: number;
  label: string;
  guest: boolean;
  personality: PersonalityId;
  difficulty: Difficulty;
  form: { name: string; parlor: string; male: boolean };
}

/** Per-player counters for the report. */
export interface PlayerStats {
  requests: number;
  actions: number;
  accepted: number;
  /** Refused, and the View the bot answered offered it, and the server's View had not changed. */
  refusedOffered: number;
  /** Refused because another player's change replaced the View while the request was on its way. */
  refusedStale: number;
  /** Refused and the View did not offer it (the bot's own mistake). */
  refusedNotOffered: number;
  notInGame: number;
  /** A guest's typed text, refused by the server's guest rule (expected). */
  guestTextRefused: number;
  unknownOutcome: number;
  pushes: number;
  viewPushes: number;
  enters: number;
  days: number;
  cutShort: number;
  stuck: number;
  policyErrors: number;
  chats: number;
  letters: number;
  announcements: number;
  visits: number;
  battles: number;
  byButton: Record<string, number>;
}

function emptyStats(): PlayerStats {
  return {
    requests: 0,
    actions: 0,
    accepted: 0,
    refusedOffered: 0,
    refusedStale: 0,
    refusedNotOffered: 0,
    notInGame: 0,
    guestTextRefused: 0,
    unknownOutcome: 0,
    pushes: 0,
    viewPushes: 0,
    enters: 0,
    days: 0,
    cutShort: 0,
    stuck: 0,
    policyErrors: 0,
    chats: 0,
    letters: 0,
    announcements: 0,
    visits: 0,
    battles: 0,
    byButton: {},
  };
}

/** What a View's HUD says about the player, for comparing with the admin record. */
export interface HudFacts {
  bp: number;
  bpToday: number;
  turns: number;
  luck: number;
  tags: [number, number, number];
  money?: number;
}

export function hudFacts(view: View | null | undefined): HudFacts | null {
  const h = view?.hud;
  if (!h) return null;
  return {
    bp: h.bpTotal,
    bpToday: h.bpToday,
    turns: h.turns,
    luck: h.luck,
    tags: [h.tags.wood, h.tags.silver, h.tags.gold],
    ...(h.money !== undefined ? { money: h.money } : {}),
  };
}

class NetworkError extends Error {}

/**
 * One account playing through the real server exactly as the web client does: `ApiClient` (the
 * server's own typed client) for HTTP, a WebSocket with the hello handshake for pushes, and a
 * `@fq/bots` policy deciding every action from the View alone.
 */
export class SoakPlayer {
  readonly api: ApiClient;
  readonly stats = emptyStats();
  login: string;
  /** Real time the current token was issued. */
  tokenIssuedAt = 0;
  readonly password: string;
  readonly email: string;
  accountId: number | null = null;
  playerId: number | null = null;
  form: ParlorForm;
  memory: BotMemory;
  view: View | null = null;
  /** The last View that had a HUD, and the game time (ms) it arrived. */
  lastHud: { facts: HudFacts; at: number; seq: number } | null = null;
  inSession = false;
  /** Accepted actions, as the audit log should count them (`action` rows for this account). */
  acceptedActions = 0;
  /** Requests whose answer never came (the server was killed): accepted or not, nobody knows yet. */
  unknown = 0;
  private socket: WebSocket | null = null;
  private socketReady = false;
  private viewPushesSinceSend = 0;
  private pendingPushView: View | null = null;
  readonly endReasons: string[] = [];
  /** Every hud the player was shown, with the real time, for the backup window check. */
  readonly hudLog: { real: number; facts: HudFacts }[] = [];
  /** The HUD of the first desk View of each game day (turns after the day's reset), by day. */
  readonly firstHud = new Map<number, HudFacts>();
  private seq = 0;

  constructor(
    readonly spec: PlayerSpec,
    private readonly world: World,
    private readonly policy: Policy,
    private readonly runSeed: number,
  ) {
    const tag = randomBytes(3).toString("hex");
    this.login = spec.guest ? "" : `sk${spec.label}${tag}`;
    this.password = randomBytes(12).toString("base64url");
    this.email = `${spec.label}.${tag}@soak.invalid`;
    this.form = { ...spec.form, email: this.email };
    this.memory = this.freshMemory();
    this.api = new ApiClient({
      baseUrl: world.baseUrl(),
      fetch: this.recordingFetch(),
      timeoutMs: 120_000,
    });
  }

  get label(): string {
    return this.spec.label;
  }

  private freshMemory(): BotMemory {
    return createMemory({
      playerId: this.playerId ?? 0,
      name: this.form.name,
      parlor: this.form.parlor,
      personality: this.spec.personality,
      difficulty: this.spec.difficulty,
    });
  }

  /** A season reset took the parlor: the next enter makes a new one, and the bot starts over. */
  forgetParlor(): void {
    this.playerId = null;
    this.memory = this.freshMemory();
    this.lastHud = null;
    this.hudLog.length = 0;
  }

  /** The base URL changed (a restore onto a fresh server on another port). */
  retarget(): void {
    (this.api as unknown as { baseUrl: string }).baseUrl = this.world.baseUrl();
  }

  private recordingFetch(): typeof fetch {
    return async (input, init) => {
      const started = Date.now();
      const url = String(input);
      const path = url.replace(/^https?:\/\/[^/]+/, "");
      this.stats.requests++;
      let r: Response;
      try {
        r = await fetch(input, init);
      } catch (error) {
        this.world.transcript.write({
          kind: "http",
          player: this.label,
          method: init?.method ?? "GET",
          path,
          status: 0,
          ms: Date.now() - started,
          body: { error: String(error) },
        });
        throw new NetworkError(String(error));
      }
      const text = await r.clone().text();
      let body: unknown = text;
      try {
        body = text === "" ? null : JSON.parse(text);
      } catch {
        // keep text
      }
      this.scanPrivate(text, `${init?.method ?? "GET"} ${path}`);
      let sent: unknown;
      try {
        sent = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      } catch {
        sent = undefined;
      }
      // Passwords never go to the transcript.
      if (sent && typeof sent === "object" && "password" in sent)
        sent = { ...sent, password: "[redacted]" };
      this.world.transcript.write({
        kind: path.endsWith("/action") ? "action" : "http",
        player: this.label,
        ...(path.endsWith("/action")
          ? { action: (sent as { action?: unknown } | undefined)?.action }
          : { method: init?.method ?? "GET", path }),
        status: r.status,
        ms: Date.now() - started,
        body: redactToken(body),
      } as never);
      return r;
    };
  }

  /** Nothing another player owns may reach this player. */
  scanPrivate(text: string, where: string): void {
    let leaked = false;
    for (const [secret, s] of this.world.secrets) {
      if (s.owner === this.label || s.seenBy.has(this.label)) continue;
      if (!text.includes(secret)) continue;
      s.seenBy.add(this.label);
      if (s.seenBy.size > s.maxOthers) {
        this.world.checks.fail(
          "privacy",
          `${this.label} was sent ${s.owner}'s ${s.kind} in ${where} (seen by ${[...s.seenBy].join(", ")})`,
          { secret: s.kind === "token" ? `${secret.slice(0, 6)}...` : secret },
        );
        leaked = true;
      }
    }
    if (!leaked) this.world.checks.ok("privacy", true, "");
  }

  private registerSecrets(token: string | null): void {
    const add = (value: string, kind: Secret["kind"]) =>
      this.world.secrets.set(value, { owner: this.label, kind, maxOthers: 0, seenBy: new Set() });
    if (token) add(token, "token");
    add(this.email, "email");
    if (this.login !== "") add(this.login, "login");
  }

  // ------------------------------------------------------------------ account

  async signUp(): Promise<void> {
    const auth = this.spec.guest
      ? await this.api.guest()
      : await this.api.signUp(this.login, this.password);
    this.accountId = auth.account.id;
    this.tokenIssuedAt = Date.now();
    if (this.spec.guest) this.guestLogin = auth.account.login;
    this.registerSecrets(auth.token);
  }

  /** A guest's generated log-in name (kept after an upgrade, for a restore from before it). */
  guestLogin = "";

  /** Re-reads the account (a restore can bring back an older one: a guest again, an old name). */
  async refreshAccount(): Promise<void> {
    const me = await this.api.me();
    this.accountId = me.account.id;
    this.spec.guest = me.account.guest;
    if (!me.account.guest) this.login = me.account.login;
  }

  async logIn(): Promise<void> {
    const auth = await this.api.logIn(this.login, this.password);
    this.accountId = auth.account.id;
    this.tokenIssuedAt = Date.now();
    this.registerSecrets(auth.token);
  }

  // ------------------------------------------------------------------- socket

  private openSocket(): Promise<void> {
    if (this.socket && this.socket.readyState === WebSocket.OPEN && this.socketReady) {
      return Promise.resolve();
    }
    this.closeSocket();
    return new Promise((resolve) => {
      const ws = new WebSocket(this.world.wsUrl());
      this.socket = ws;
      this.socketReady = false;
      const done = () => resolve();
      const timer = setTimeout(done, 5000);
      ws.on("open", () => {
        ws.send(
          JSON.stringify({ type: "hello", token: this.api.token, townId: this.world.townId }),
        );
      });
      ws.on("message", (data) => {
        const text = data.toString();
        this.scanPrivate(text, "socket");
        let message: ServerMessage;
        try {
          message = JSON.parse(text) as ServerMessage;
        } catch {
          this.world.checks.fail("protocol", `${this.label} got a socket message that is not JSON`);
          return;
        }
        this.world.transcript.write({ kind: "push", player: this.label, message });
        this.stats.pushes++;
        this.onPush(message);
        if (message.type === "ready") {
          this.socketReady = true;
          clearTimeout(timer);
          done();
        }
      });
      ws.on("close", (code) => {
        this.world.transcript.write({ kind: "socket", player: this.label, event: "close", code });
        if (this.socket === ws) {
          this.socket = null;
          this.socketReady = false;
        }
        clearTimeout(timer);
        done();
      });
      ws.on("error", () => undefined);
    });
  }

  closeSocket(): void {
    const ws = this.socket;
    this.socket = null;
    this.socketReady = false;
    if (ws && ws.readyState !== WebSocket.CLOSED) ws.terminate();
  }

  get socketOpen(): boolean {
    return this.socketReady && this.socket?.readyState === WebSocket.OPEN;
  }

  /** Push messages, by notice kind, for checks (broadcast delivery, kicks, resets). */
  readonly notices: { kind: string; at: number; data: unknown }[] = [];

  private onPush(message: ServerMessage): void {
    if (message.type === "view") {
      this.stats.viewPushes++;
      this.viewPushesSinceSend++;
      this.pendingPushView = message.view;
      this.checkHud(message.view, "push");
    } else if (message.type === "notice") {
      const n = message.notice;
      this.notices.push({ kind: n.kind, at: Date.now(), data: n });
      if (n.kind === "sessionEnded") {
        this.inSession = false;
        this.endReasons.push(n.reason);
      }
      if (n.kind === "tournamentReset") this.endReasons.push("tournamentReset");
    }
  }

  // --------------------------------------------------------------- the game

  private checkHud(view: View, where: string): void {
    const f = hudFacts(view);
    if (!f) return;
    const c = this.world.checks;
    const bad: string[] = [];
    if (f.bp < 0) bad.push(`bp ${f.bp}`);
    if (f.bpToday < 0) bad.push(`bpToday ${f.bpToday}`);
    if (f.turns < 0) bad.push(`turns ${f.turns}`);
    if (f.tags.some((t) => t < 0)) bad.push(`tags ${f.tags.join("/")}`);
    if (f.luck < 1 || f.luck > 100) bad.push(`luck ${f.luck}`);
    c.ok("non-negative", bad.length === 0, `${this.label} was shown ${bad.join(", ")} (${where})`);
  }

  /** Expanded: whether the HUD ever showed a bank loan, or savings. */
  hadLoan = false;
  hadSavings = false;

  private took(view: View): void {
    this.view = view;
    if ((view.hud?.debt?.owed ?? 0) > 0) this.hadLoan = true;
    if ((view.hud?.savings ?? 0) > 0) this.hadSavings = true;
    this.checkHud(view, "answer");
    const f = hudFacts(view);
    if (f) {
      this.lastHud = { facts: f, at: this.world.gameNow(), seq: ++this.seq };
      this.hudLog.push({ real: Date.now(), facts: f });
      const day = this.world.day();
      // The day's turns are reset on the first desk visit (base_new_day); the paper comes first.
      if (!this.firstHud.has(day) && view.scene === "desk") this.firstHud.set(day, f);
      if (this.hudLog.length > 4000) this.hudLog.splice(0, 2000);
    }
  }

  /** Enters the town (creating the parlor the first time) and opens the push socket. */
  async enter(): Promise<View> {
    await this.world.gate.pass();
    this.world.gate.begin();
    try {
      let r: { view: View; created: boolean };
      try {
        r = await this.api.enter(this.world.townId);
      } catch (error) {
        if (!(error instanceof ApiError) || error.code !== "parlor_required") throw error;
        r = await this.createParlor();
      }
      this.stats.enters++;
      this.inSession = true;
      this.world.expectedOut.delete(this.label);
      this.took(r.view);
      if (r.created && this.playerId !== null) {
        // The old parlor is gone (deleted at midnight for having no BP, or the town reset).
        this.world.checks.note("parlor-recreated", { player: this.label, old: this.playerId });
        this.playerId = null;
        this.lastHud = null;
      }
      if (this.playerId === null) {
        const me = await this.api.me();
        const mine = me.parlors.find((p) => p.townId === this.world.townId);
        this.playerId = mine?.playerId ?? null;
        this.memory.self.playerId = this.playerId ?? 0;
      }
      return r.view;
    } finally {
      this.world.gate.end();
    }
  }

  private async createParlor(): Promise<{ view: View; created: boolean }> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.api.enter(this.world.townId, { parlor: this.form });
      } catch (error) {
        if (!(error instanceof ApiError) || error.code !== "invalid_parlor" || attempt > 4)
          throw error;
        // The name or parlor is taken: number it, as a person would.
        const n = attempt + 2;
        this.form = {
          ...this.form,
          name: `${this.spec.form.name.slice(0, 16)} ${n}`,
          parlor: `${this.spec.form.parlor.slice(0, 16)} ${n}`,
        };
        this.memory.self.name = this.form.name;
        this.memory.self.parlor = this.form.parlor;
      }
    }
  }

  /** The current View from the server (after a restart or a push during a request). */
  async resync(): Promise<View | null> {
    try {
      const v = await this.api.currentView(this.world.townId);
      this.took(v);
      return v;
    } catch (error) {
      if (error instanceof ApiError && error.code === "not_in_game") {
        this.inSession = false;
        return null;
      }
      throw error;
    }
  }

  /**
   * Plays one day: enter, then answer every screen with the policy until the bot logs off, the
   * step cap, or the deadline (real ms) arrives. Some bots leave without logging off
   * (`leaveIdle`), so the idle sweep logs them off.
   */
  async playDay(options: {
    day: number;
    deadline: number;
    stepCap: number;
    leaveIdle: boolean;
  }): Promise<void> {
    this.stats.days++;
    const c = this.world.checks;
    const fresh = createMemory({
      playerId: 0,
      name: "",
      parlor: "",
      personality: this.spec.personality,
      difficulty: this.spec.difficulty,
    });
    this.memory.session = fresh.session;
    const rng = BotRandom.forDay(mix(this.runSeed, 0x50a), this.spec.index, options.day);
    let view = await this.enterWithRetry();
    if (!view) return;
    await this.openSocket();
    let steps = 0;
    let lastSig = "";
    let repeats = 0;
    while (steps < options.stepCap) {
      if (Date.now() > options.deadline) {
        this.stats.cutShort++;
        break;
      }
      await this.world.gate.pass();
      if (this.pendingPushView) {
        view = this.pendingPushView;
        this.pendingPushView = null;
        this.took(view);
      }
      if (!this.inSession || view.scene === "lobby") {
        if (this.world.expectedOut.has(this.label)) break;
        if (this.memory.session.leaving || view.scene === "lobby") break;
      }
      const sig = signature(view);
      repeats = sig === lastSig ? repeats + 1 : 0;
      lastSig = sig;
      if (repeats >= 12) {
        this.stats.stuck++;
        c.note("bot-stuck", { player: this.label, signature: sig });
        break;
      }
      let action: Action;
      try {
        action = this.policy({ view, memory: this.memory, rng });
      } catch (error) {
        this.stats.policyErrors++;
        c.note("policy-error", { player: this.label, error: String(error) });
        action = safeAction(view);
      }
      action = this.decorate(view, action);
      steps++;
      const out = await this.act(view, action);
      if (out.kind === "ok") {
        view = out.view;
        continue;
      }
      if (out.kind === "rejected") {
        view = out.view;
        const fallback = safeAction(view);
        if (describeAction(fallback) !== describeAction(action)) {
          steps++;
          const again = await this.act(view, fallback);
          if (again.kind === "ok" || again.kind === "rejected") view = again.view;
        }
        continue;
      }
      if (out.kind === "out") {
        // Kicked, banned, reset, rolled back, or the session timed out.
        if (this.world.expectedOut.has(this.label)) break;
        const next = await this.enterWithRetry();
        if (!next) break;
        view = next;
        await this.openSocket();
        continue;
      }
      // The answer never came (the server died): find out where we are.
      const next = await this.recover();
      if (!next) break;
      view = next;
    }
    if (this.inSession && !options.leaveIdle) {
      await this.world.gate.pass();
      const out = await this.act(view, { type: "exit" });
      if (out.kind === "ok" || out.kind === "rejected") this.view = out.view;
      this.inSession = false;
    }
  }

  /** Enter, waiting out a dead server; null if the account may not play now (banned). */
  private async enterWithRetry(): Promise<View | null> {
    for (let attempt = 0; attempt < 200; attempt++) {
      try {
        return await this.enter();
      } catch (error) {
        if (error instanceof NetworkError) {
          await this.world.gate.pass();
          await new Promise((r) => setTimeout(r, 200));
          continue;
        }
        if (error instanceof ApiError && error.code === "busy") {
          this.world.checks.fail("busy", `${this.label} was told the town is busy on enter`);
          await new Promise((r) => setTimeout(r, 200));
          continue;
        }
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          if (this.world.expectedOut.has(this.label)) return null;
          this.world.checks.fail(
            "auth",
            `${this.label} could not enter: ${error.status} ${error.code}`,
          );
          return null;
        }
        throw error;
      }
    }
    throw new Error(`${this.label} could not enter after 200 tries`);
  }

  /** After a request whose answer was lost: the server is back (the gate opened); where are we? */
  private async recover(): Promise<View | null> {
    for (let attempt = 0; attempt < 200; attempt++) {
      await this.world.gate.pass();
      try {
        const v = await this.resync();
        if (v) {
          await this.openSocket();
          return v;
        }
        return await this.enterWithRetry();
      } catch (error) {
        if (error instanceof NetworkError) {
          await new Promise((r) => setTimeout(r, 200));
          continue;
        }
        throw error;
      }
    }
    return null;
  }

  /** Tags letters with this player's secret, so the privacy check can follow them. */
  private decorate(view: View, action: Action): Action {
    const o = view.overlay;
    if (action.type === "submitText" && action.text && o?.kind === "textInput") {
      if (/compose|letter/i.test(o.id)) {
        this.stats.letters++;
        const tag = ` #${randomBytes(3).toString("hex")}`;
        if (action.text.length + tag.length <= o.maxLength) {
          // A letter is private between its writer and its one reader; a third player seeing
          // its tag is a leak.
          this.world.secrets.set(tag.trim(), {
            owner: this.label,
            kind: "letter",
            maxOthers: 1,
            seenBy: new Set(),
          });
          return { ...action, text: action.text + tag };
        }
      }
      if (/announce/i.test(o.id)) this.stats.announcements++;
    }
    if (action.type === "chat") this.stats.chats++;
    if (action.type === "press") {
      const b = action.buttonId;
      this.stats.byButton[b] = (this.stats.byButton[b] ?? 0) + 1;
      if (/battle:attack/.test(b)) this.stats.battles++;
      if (/^competitors:/.test(b)) this.stats.visits++;
    }
    return action;
  }

  /** Sends one action and classifies the answer. */
  async act(
    view: View,
    action: Action,
  ): Promise<
    | { kind: "ok"; view: View }
    | { kind: "rejected"; view: View }
    | { kind: "out" }
    | { kind: "lost" }
  > {
    this.stats.actions++;
    this.viewPushesSinceSend = 0;
    this.world.gate.begin();
    try {
      const next = await this.api.act(this.world.townId, action);
      this.stats.accepted++;
      if (action.type === "submitText" && action.text && /announce/i.test(action.overlayId)) {
        this.world.announcements.push({ player: this.label, text: action.text, day: this.world.day() });
      }
      this.acceptedActions++;
      if (action.type === "exit") this.inSession = false;
      this.took(next);
      if (this.viewPushesSinceSend > 0) {
        // A push crossed this request; the push may be older or newer than the answer.
        this.pendingPushView = null;
        const v = await this.resync().catch(() => null);
        if (v) return { kind: "ok", view: v };
      } else {
        this.pendingPushView = null;
      }
      return { kind: "ok", view: next };
    } catch (error) {
      if (error instanceof NetworkError) {
        this.stats.unknownOutcome++;
        this.unknown++;
        return { kind: "lost" };
      }
      if (!(error instanceof ApiError)) throw error;
      if (error.code === "rejected" && error.view) {
        const theirs = error.view;
        const wasOffered = offered(view, action);
        const changed = signature(theirs) !== signature(view) || this.viewPushesSinceSend > 0;
        if (wasOffered && !changed) {
          this.stats.refusedOffered++;
          this.world.checks.fail(
            "offered-action-refused",
            `${this.label}: ${describeAction(action)} was offered and refused`,
            {
              action,
              title: view.title,
              scene: view.scene,
              overlay: view.overlay ? { kind: view.overlay.kind, id: view.overlay.id } : null,
              buttons: view.buttons.map((b) => b.id),
              message: error.message,
            },
          );
        } else if (wasOffered) {
          this.stats.refusedStale++;
        } else {
          this.stats.refusedNotOffered++;
        }
        this.pendingPushView = null;
        this.took(theirs);
        return { kind: "rejected", view: theirs };
      }
      if (error.code === "not_in_game") {
        this.stats.notInGame++;
        this.inSession = false;
        if (!this.world.expectedOut.has(this.label) && action.type !== "exit") {
          const why = this.endReasons.at(-1) ?? "none";
          if (why !== "timeout") {
            this.world.checks.fail(
              "session-lost",
              `${this.label} was out of the game unexpectedly (last end reason: ${why})`,
              {
                action,
              },
            );
          }
        }
        return { kind: "out" };
      }
      if (error.code === "guest_text") {
        // Guests may not type for other people (owner's decision 7): the server refuses, nothing
        // changes, and the player cancels the prompt (the fallback does that).
        this.stats.guestTextRefused++;
        this.world.checks.ok(
          "guest-text-only-for-guests",
          this.spec.guest && (action.type === "chat" || action.type === "submitText"),
          `${this.label} (${this.spec.guest ? "guest" : "full account"}) was refused ${describeAction(action)} as guest text`,
        );
        return { kind: "rejected", view };
      }
      if (error.status === 401 || error.status === 403) {
        this.inSession = false;
        if (!this.world.expectedOut.has(this.label)) {
          this.world.checks.fail(
            "auth",
            `${this.label}: ${error.status} ${error.code} while playing`,
          );
        }
        return { kind: "out" };
      }
      if (error.code === "busy" || error.status === 429) {
        this.world.checks.fail("busy", `${this.label}: ${error.status} ${error.code}`);
        await new Promise((r) => setTimeout(r, 500));
        return { kind: "rejected", view };
      }
      this.world.checks.fail(
        "http-error",
        `${this.label}: ${error.status} ${error.code} ${error.message}`,
        { action },
      );
      return { kind: "out" };
    } finally {
      this.world.gate.end();
    }
  }
}

function redactToken(body: unknown): unknown {
  if (body && typeof body === "object" && "token" in body) {
    return { ...(body as Record<string, unknown>), token: "[redacted]" };
  }
  return body;
}
