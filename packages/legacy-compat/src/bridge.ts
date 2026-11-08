import { randomBytes } from "node:crypto";
import {
  createPlayer,
  type Effect,
  enterGame,
  leaveGame,
  lobbyStatus,
  type NewPlayerInput,
  parseLegacyText,
  type StepResult,
  step,
  type TownState,
} from "@fq/core";
import type { Action, RichText, View } from "@fq/protocol";
import type { LegacyAssets } from "./assets.js";
import { originalBanner, REMASTER_BANNER_LINE } from "./banner.js";
import { ABORT_TEXT, Logon, PLACE_COMMANDS, RETURN_COMMAND, Request, Sent } from "./commands.js";
import { encodeBody, type LegacyVars, parseRequestQuery } from "./escape.js";
import type { LegacyHost } from "./host.js";
import {
  BLANK_CLIENT,
  type ClientState,
  type RenderContext,
  type Rendered,
  renderView,
} from "./render.js";
import { escapeHtml, LEGACY_COLORS, richTextToLegacyHtml, richTextToPlain } from "./richText.js";

/** What the bridge remembers about one browser (one cookie). */
interface BridgeSession {
  token: string;
  playerId: number | null;
  /** The last View sent to this player, which is what the engine validates the next action against. */
  view: View | null;
  /** Engine module that drew `view`. */
  module: string;
  /** Number-to-action table for the buttons the last response offered. */
  table: Map<number, Action>;
  client: ClientState;
  lastSeen: number;
}

export interface BridgeOptions {
  host: LegacyHost;
  assets: LegacyAssets;
  /** Clock in ms; tests replace it. */
  now?: () => number;
  /** Idle time after which a browser's player is logged off. Default 30 minutes. */
  idleMs?: number;
  /** Called with a line for the server log. */
  log?: (line: string) => void;
}

export interface BridgeReply {
  /** Cookie value to set (always the session's token). */
  token: string;
  /** `name=value&...` body. */
  body: string;
  /** The variables before encoding, for tests and debugging. */
  vars: LegacyVars;
}

/** The client's newspaper controls: front page, crime, yesterday, today. */
const NEWS_COMMANDS = new Set<number>([
  Request.front,
  Request.crime,
  Request.yesterday,
  Request.news,
]);

const DEFAULT_IDLE_MS = 30 * 60 * 1000;
const MAX_OVERLAY_STEPS = 16;

/** The text lines `i_chat` appends to its transcript. */
function chatLines(lines: readonly RichText[]): RichText {
  const out: RichText = [];
  for (const line of lines) {
    out.push(...line);
    out.push({ text: "\n" });
  }
  return out;
}

function int(value: string | undefined, fallback = 0): number {
  if (value === undefined) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** `center_string_cst(&cst, 120)` (funeral.cpp:138-157), used for the log-on game line. */
function centered(text: string, width: number): string {
  if (text.length >= width) return text;
  return " ".repeat(Math.floor((width - text.length) / 2)) + text;
}

/**
 * The request.xp protocol, spoken to the Funeral Quest engine. One
 * instance serves every browser; each is told apart by a cookie token.
 *
 * Requests are handled one at a time. The flow for a `command` is: find what
 * the player's number means in the table of the last response, turn it into
 * one or more engine `Action`s, run them, and render the last View back into
 * variables (render.ts).
 */
export class LegacyBridge {
  private readonly host: LegacyHost;
  private readonly assets: LegacyAssets;
  private readonly clock: () => number;
  private readonly idleMs: number;
  private readonly log: (line: string) => void;
  private readonly sessions = new Map<string, BridgeSession>();
  /** Cafe lines waiting for a player's next chat poll. */
  private readonly chatInbox = new Map<number, RichText[]>();
  private tail: Promise<unknown> = Promise.resolve();
  /** When this bridge was built: the boot time when the host does not say. */
  private readonly bootedAt: number;

  constructor(options: BridgeOptions) {
    this.host = options.host;
    this.assets = options.assets;
    this.clock = options.now ?? Date.now;
    this.bootedAt = this.clock();
    this.idleMs = options.idleMs ?? DEFAULT_IDLE_MS;
    this.log = options.log ?? (() => undefined);
  }

  /** Number of browsers the bridge knows about. */
  get sessionCount(): number {
    return this.sessions.size;
  }

  /** The players some browser is logged on as right now. */
  servedPlayerIds(): number[] {
    const ids = new Set<number>();
    for (const s of this.sessions.values()) if (s.playerId !== null) ids.add(s.playerId);
    return [...ids];
  }

  /** Queues a cafe line for a player (for effects produced by other clients). */
  deliverChat(playerId: number, text: RichText): void {
    const list = this.chatInbox.get(playerId) ?? [];
    list.push(text);
    this.chatInbox.set(playerId, list);
  }

  /**
   * Handles one `request.xp` call. `rawQuery` is everything after the "?" of
   * the URL, undecoded. Resolves to the body and the token for the cookie.
   */
  handle(token: string | undefined, rawQuery: string): Promise<BridgeReply> {
    const run = async (): Promise<BridgeReply> => {
      const session = this.sessionFor(token);
      session.lastSeen = this.clock();
      let vars: LegacyVars;
      try {
        vars = await this.dispatch(session, rawQuery);
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error);
        this.log(`legacy bridge error: ${text}`);
        vars = this.fatal(`The server had a problem: ${text}`);
      }
      return { token: session.token, body: encodeBody(vars), vars };
    };
    return this.queue(run);
  }

  /** Logs off every browser that has been idle too long. Returns how many. */
  async sweep(): Promise<number> {
    const cutoff = this.clock() - this.idleMs;
    let count = 0;
    for (const session of [...this.sessions.values()]) {
      if (session.lastSeen >= cutoff) continue;
      this.sessions.delete(session.token);
      count++;
      const id = session.playerId;
      if (id === null) continue;
      await this.queue(async () => {
        // The idle time-out announces the kick first (user_list.cpp:160-171).
        await this.leave(id, { inactive: true });
      });
    }
    return count;
  }

  /** Logs everyone off, for a clean shutdown. */
  async closeAll(): Promise<void> {
    for (const session of [...this.sessions.values()]) {
      this.sessions.delete(session.token);
      const id = session.playerId;
      if (id !== null) await this.queue(() => this.leave(id));
    }
  }

  /** Runs `work` after everything queued before it (and inside the host's lock, if it has one). */
  private queue<T>(work: () => Promise<T>): Promise<T> {
    const exclusive = this.host.exclusive;
    const job = exclusive ? () => exclusive.call(this.host, work) : work;
    const result = this.tail.then(job, job) as Promise<T>;
    this.tail = result.catch(() => undefined);
    return result;
  }

  private sessionFor(token: string | undefined): BridgeSession {
    const existing = token ? this.sessions.get(token) : undefined;
    if (existing) return existing;
    const created: BridgeSession = {
      token: randomBytes(16).toString("hex"),
      playerId: null,
      view: null,
      module: "",
      table: new Map(),
      client: BLANK_CLIENT,
      lastSeen: this.clock(),
    };
    this.sessions.set(created.token, created);
    return created;
  }

  // ---- engine access -----------------------------------------------------

  /** Runs one engine call against the current town and saves the result when it changed. */
  private async apply<T extends { town: TownState; effects?: readonly Effect[] }>(
    work: (town: TownState, ctx: ReturnType<LegacyHost["context"]>) => T,
  ): Promise<T> {
    const town = await this.host.getTown();
    const ctx = this.host.context();
    const result = work(town, ctx);
    if (result.town !== town) {
      const effects = result.effects ?? [];
      this.queueChat(effects);
      await this.host.persist(result.town, effects);
    }
    return result;
  }

  /** Keeps cafe lines meant for players this bridge serves. */
  private queueChat(effects: readonly Effect[]): void {
    const mine = new Set<number>();
    for (const s of this.sessions.values()) if (s.playerId !== null) mine.add(s.playerId);
    for (const effect of effects) {
      if (effect.kind !== "chat") continue;
      for (const id of effect.to) if (mine.has(id)) this.deliverChat(id, effect.text);
    }
  }

  private async act(session: BridgeSession, action: Action): Promise<StepResult> {
    const id = session.playerId;
    if (id === null) throw new Error("Not logged on");
    const result = await this.apply((town, ctx) => step(town, id, action, ctx));
    return result;
  }

  private async leave(playerId: number, options: { inactive?: boolean } = {}): Promise<void> {
    await this.apply((town, ctx) => leaveGame(town, playerId, ctx, options));
    this.chatInbox.delete(playerId);
  }

  // ---- request dispatch ---------------------------------------------------

  private async dispatch(session: BridgeSession, rawQuery: string): Promise<LegacyVars> {
    const request = parseRequestQuery(rawQuery);
    const p = request.params;
    switch (request.verb) {
      case "checklogon":
        return this.checkLogon(session);
      case "logon":
        return this.logon(session, p.get("st_logon") ?? "", p.get("st_password") ?? "");
      case "new":
        return this.newUser(session, p);
      case "command":
        return this.command(session, p);
      default:
        return this.fatal(`Server unable to process request ${request.verb}.`);
    }
  }

  /** An error packet: `send_error_message` (commands_misc.cpp:3-14). */
  private fatal(text: string): LegacyVars {
    return [
      ["g_st_error", text],
      ["i_sent", Sent.fatal],
    ];
  }

  private reset(session: BridgeSession): void {
    session.playerId = null;
    session.view = null;
    session.module = "";
    session.table = new Map();
    session.client = BLANK_CLIENT;
  }

  /** `send_logon_information` (funeral.cpp:211-292), after logging off whoever was on this connection. */
  private async checkLogon(session: BridgeSession): Promise<LegacyVars> {
    if (session.playerId !== null) {
      const id = session.playerId;
      this.reset(session);
      await this.leave(id);
    }
    const town = await this.host.getTown();
    const ctx = this.host.context();
    const lobby = lobbyStatus(town, ctx);
    const rich = (markup: string) => richTextToLegacyHtml(parseLegacyText(markup));
    // The original banner exactly as funeral.cpp:191-193 built it (raw HTML), then the line that
    // names the remaster engine (decision 3b).
    const uptime = (this.clock() - (this.host.bootTime?.() ?? this.bootedAt)) / 1000;
    const intro = `${originalBanner(uptime)}<br>${rich(REMASTER_BANNER_LINE)}`;
    return [
      ["st_intro_news", intro],
      ["st_no_more", lobby.closed ? rich(lobby.closed) : ""],
      ["st_game_stats", rich(centered(lobby.gameInfo, 120))],
      ["st_server_news", rich(town.serverNews)],
      ["i_sent", Logon.welcome],
    ];
  }

  /** `check_name_and_password` (funeral.cpp:304-405). */
  private async logon(
    session: BridgeSession,
    logon: string,
    password: string,
  ): Promise<LegacyVars> {
    if (session.playerId !== null) {
      const id = session.playerId;
      this.reset(session);
      await this.leave(id);
    }
    const id = await this.host.accounts.verify(logon.trim(), password.trim());
    if (id === null) return [["i_sent", Logon.unknownUser]];
    const result = await this.apply((town, ctx) => enterGame(town, id, ctx));
    // A refusal the original explained (someone inside the parlor, funeral.cpp:357-363)
    // is its error box: send_error_message, commands_misc.cpp:3-14.
    if (result.rejected && result.message) return this.fatal(richTextToPlain(result.message));
    if (result.rejected) return [["i_sent", Logon.unknownUser]];
    session.playerId = id;
    return this.show(session, result.view, { forceNew: true });
  }

  /** `process_new_user` (new_user.cpp:5-292). */
  private async newUser(
    session: BridgeSession,
    p: ReadonlyMap<string, string>,
  ): Promise<LegacyVars> {
    if (session.playerId !== null) {
      const id = session.playerId;
      this.reset(session);
      await this.leave(id);
    }
    const input: NewPlayerInput = {
      logon: p.get("logon") ?? "",
      name: p.get("name") ?? "",
      parlor: p.get("f_name") ?? "",
      password: p.get("password") ?? "",
      passwordVerify: p.get("password_v") ?? "",
      male: (p.get("b_male") ?? "1").trim() === "1",
      email: p.get("email") ?? "",
    };
    const problem = await this.host.accounts.checkNewUser?.(
      input.logon.trim(),
      input.password.trim(),
    );
    if (problem) {
      return [
        [
          "g_st_error",
          richTextToLegacyHtml([{ text: problem.message }], { defaultColor: LEGACY_COLORS.white }),
        ],
        ["i_sent", Logon.newPageTwo],
      ];
    }
    const result = await this.apply((town, ctx) => {
      const made = createPlayer(town, input, ctx);
      return made.ok ? made : { ...made, effects: [] as Effect[] };
    });
    if (!result.ok) {
      // Errors on the name or a full town send the player back to the first page (i_sent 4).
      const first = result.field === "name" || result.field === "town";
      return [
        ["g_st_error", richTextToLegacyHtml(result.error, { defaultColor: LEGACY_COLORS.white })],
        ["i_sent", first ? Logon.newPageOne : Logon.newPageTwo],
      ];
    }
    await this.host.accounts.register(result.playerId, input.logon.trim(), input.password.trim());
    session.playerId = result.playerId;
    return this.show(session, result.view, { forceNew: true });
  }

  // ---- commands -------------------------------------------------------------

  private async command(
    session: BridgeSession,
    p: ReadonlyMap<string, string>,
  ): Promise<LegacyVars> {
    const id = session.playerId;
    if (id === null) return this.fatal("Connection with server died. (user not logged on)");
    const cmd = int(p.get("i_command"));
    const town = await this.host.getTown();
    if (!town.sessions[String(id)]) {
      // The engine ended this session (a reset, a replacement log-on, a time-out).
      this.reset(session);
      return [["i_sent", Sent.quit]];
    }
    if (!session.view) session.view = town.sessions[String(id)]?.view ?? null;

    if (cmd === Request.quit) return this.exit(session);
    switch (cmd) {
      case Request.announcement:
        return this.announce(session, p.get("st_note") ?? "");
      case Request.getName:
        return this.getName(session, p.get("st_input") ?? "", int(p.get("i_his_id")));
      case Request.sendMail:
        return this.sendMail(session, p.get("st_input") ?? "");
      case Request.reply:
        return this.reply(session);
      case Request.chatUpdate:
        return this.chatUpdate(session, p.get("st_input") ?? "");
      case RETURN_COMMAND:
        return this.returned(session, p.get("st_extra_text") ?? "", int(p.get("i_his_id"), -1));
      default:
        break;
    }
    return this.press(session, cmd);
  }

  /** `command_quit` (commands_misc.cpp:50-60). */
  private async exit(session: BridgeSession): Promise<LegacyVars> {
    const id = session.playerId;
    if (id !== null) {
      await this.act(session, { type: "exit" });
      this.chatInbox.delete(id);
    }
    this.reset(session);
    return [["i_sent", Sent.quit]];
  }

  /**
   * The paper's own controls (welcome.swf): today (`c_request_news`), yesterday,
   * front page and crime. The original answered each by reading the day's file
   * again (commands_news.cpp:3-170), so the page is always current, even when it
   * is the page already on screen. The engine's paper offers only the other tab
   * and the other day, so the bridge reaches the asked-for page in one or two
   * presses (or, for the page on screen, by turning away and back).
   */
  private async newsCommand(session: BridgeSession, cmd: number): Promise<LegacyVars> {
    const paper = session.view?.news;
    if (!paper || session.view?.overlay) return this.rerender(session);
    const wantYesterday = cmd === Request.yesterday || (cmd !== Request.news && paper.isYesterday);
    const wantSection = cmd === Request.crime ? "crime" : "front";
    const presses: string[] = [];
    let section = paper.section;
    if (wantYesterday !== paper.isYesterday || (cmd === Request.news && paper.isYesterday)) {
      presses.push(wantYesterday ? "news:yesterday" : "news:today");
      section = "front";
    }
    if (section !== wantSection)
      presses.push(wantSection === "crime" ? "news:crime" : "news:front");
    if (presses.length === 0) {
      presses.push(section === "front" ? "news:crime" : "news:front");
      presses.push(section === "front" ? "news:front" : "news:crime");
    }
    let result: StepResult | null = null;
    for (const id of presses) {
      result = await this.act(session, { type: "press", buttonId: id });
      if (result.rejected) return this.rerender(session, result.view);
      session.view = result.view;
    }
    return result ? this.show(session, result.view, { forceNew: false }) : this.rerender(session);
  }

  /** The table lookup, with the fall-backs the client's fixed controls need. */
  private async press(session: BridgeSession, cmd: number): Promise<LegacyVars> {
    if (session.view?.scene === "news" && NEWS_COMMANDS.has(cmd))
      return this.newsCommand(session, cmd);
    let action = session.table.get(cmd);
    if (!action) action = this.fixedFallback(session, cmd);
    if (!action) {
      // The paper's tabs are always on screen: asking for the page already showing changes nothing.
      // The desk asked for while the desk is up (the mail pad does this after sending) is the same.
      const sameTab =
        (session.view?.scene === "news" && NEWS_COMMANDS.has(cmd)) ||
        (session.view?.scene === "desk" && cmd === Request.main);
      if (!sameTab) this.log(`legacy bridge: no meaning for command ${cmd} on this screen`);
      return this.rerender(session);
    }
    const overlayAction = action.type === "dismiss" || action.type === "confirm";
    if (session.view?.overlay && !overlayAction) {
      const cleared = await this.clearOverlay(session);
      if (!cleared) return this.rerender(session);
      // The screen under the overlay may have changed; the action must still be on it.
      if (action.type === "press" && !this.offers(session.view, action)) {
        const again = this.fixedFallback(session, cmd);
        if (!again) return this.rerender(session);
        action = again;
      }
    }
    return this.run(session, action, cmd);
  }

  /** Does the view still offer this action? */
  private offers(view: View | null, action: Action): boolean {
    if (!view || view.overlay) return false;
    if (action.type === "press") return view.buttons.some((b) => b.id === action.buttonId);
    if (action.type === "visit") return view.map?.some((x) => x.id === action.placeId) === true;
    return true;
  }

  /**
   * Commands the client's own controls send whatever screen it is on. The
   * response table already has the ones the last view offered; these cover
   * the rest by looking for the matching button in the view.
   */
  private fixedFallback(session: BridgeSession, cmd: number): Action | undefined {
    const view = session.view;
    if (!view) return undefined;
    const press = (id: string): Action | undefined =>
      view.buttons.some((b) => b.id === id && b.enabled !== false)
        ? { type: "press", buttonId: id }
        : undefined;
    switch (cmd) {
      case Request.main:
        return (
          press("go:desk") ??
          (view.map?.some((m) => m.id === "funeral-home")
            ? { type: "visit", placeId: "funeral-home" }
            : undefined)
        );
      case Request.news:
        return press("news:today") ?? press("go:news");
      case Request.map:
        return press("go:map");
      case Request.waitForCustomer:
        return press("desk:wait");
      case Request.stats:
        return press("go:stats");
      case Request.ranking:
        return press("go:rankings");
      case Request.front:
        return press("news:front");
      case Request.crime:
        return press("news:crime");
      case Request.yesterday:
        return press("news:yesterday");
      case Request.bar:
        return this.placeAction(view, "cafe");
      default:
        break;
    }
    for (const [place, command] of Object.entries(PLACE_COMMANDS)) {
      if (command === cmd) return this.placeAction(view, place);
    }
    return undefined;
  }

  private placeAction(view: View, placeId: string): Action | undefined {
    return view.map?.some((m) => m.id === placeId) ? { type: "visit", placeId } : undefined;
  }

  /** Runs one action and shows the View it produced. */
  private async run(session: BridgeSession, action: Action, cmd: number): Promise<LegacyVars> {
    const result = await this.act(session, action);
    if (result.rejected) {
      this.log(`legacy bridge: engine refused ${JSON.stringify(action)}: ${result.rejected}`);
      return this.rerender(session, result.view);
    }
    if (cmd === Request.main && result.view.scene === "desk" && session.playerId !== null) {
      // command_main reads the whole queue (add_que_messages, broadcast.cpp:14-100) and
      // drops the cafe lines in it unshown: a line not polled before leaving the cafe is gone.
      this.chatInbox.delete(session.playerId);
    }
    return this.show(session, result.view, { forceNew: cmd === Request.main });
  }

  /** Shows the latest View again (the request meant nothing, or the engine said no). */
  private async rerender(session: BridgeSession, view?: View): Promise<LegacyVars> {
    const id = session.playerId;
    if (id === null) return this.fatal("Connection with server died. (user not logged on)");
    const town = await this.host.getTown();
    const live = view ?? town.sessions[String(id)]?.view ?? session.view;
    if (!live) return this.fatal("Connection with server died. (nothing to show)");
    return this.show(session, live, { forceNew: true });
  }

  /**
   * Cancels whatever question is open so a button press can go ahead: the
   * client closes pop-ups and the mail pad without telling the server.
   */
  private async clearOverlay(session: BridgeSession): Promise<boolean> {
    for (let i = 0; i < MAX_OVERLAY_STEPS; i++) {
      const overlay = session.view?.overlay;
      if (!overlay) return true;
      const result = await this.act(session, cancelAction(overlay));
      if (result.rejected) return false;
      session.view = result.view;
      session.module = await this.moduleOf(session);
    }
    return !session.view?.overlay;
  }

  private async moduleOf(session: BridgeSession): Promise<string> {
    const id = session.playerId;
    if (id === null) return "";
    const town = await this.host.getTown();
    return town.sessions[String(id)]?.scene ?? "";
  }

  // ---- the multi-step commands ---------------------------------------------

  /** Make Announcement: the notepad is the client's, so press the button, then submit the note. */
  private async announce(session: BridgeSession, note: string): Promise<LegacyVars> {
    let view = session.view;
    if (view && !(view.overlay?.kind === "textInput" && view.overlay.id === "news:announcement")) {
      if (view.overlay) await this.clearOverlay(session);
      view = session.view;
      if (view?.buttons.some((b) => b.id === "news:announce")) {
        const opened = await this.act(session, { type: "press", buttonId: "news:announce" });
        if (!opened.rejected) session.view = opened.view;
      }
    }
    const overlay = session.view?.overlay;
    if (overlay?.kind !== "textInput") return this.rerender(session);
    const text = note.slice(0, overlay.maxLength);
    return this.run(
      session,
      { type: "submitText", overlayId: overlay.id, text },
      Request.announcement,
    );
  }

  /**
   * `command_getname` (commands_getname.cpp). The client asks the server to
   * search for a player by part of a name; the engine does the same as a text
   * prompt followed by "Do you mean X?" boxes, so drive that.
   */
  private async getName(session: BridgeSession, input: string, hisId: number): Promise<LegacyVars> {
    let overlay = session.view?.overlay;
    if (overlay?.kind === "playerPicker") return await this.pickerSearch(overlay, input, hisId);
    if (overlay?.kind === "confirm" && overlay.id.endsWith(":namenext") && hisId > 0) {
      // "No": search again from the next player.
      return this.run(
        session,
        { type: "confirm", overlayId: overlay.id, accepted: false },
        Request.getName,
      );
    }
    if (overlay && !(overlay.kind === "textInput" && overlay.id.endsWith(":getname"))) {
      await this.clearOverlay(session);
      overlay = session.view?.overlay;
    }
    if (!overlay) {
      // The pen on the desk is the client's own; open the engine's prompt for it.
      const view = session.view;
      if (view?.buttons.some((b) => b.id === "go:mailbox")) {
        const opened = await this.act(session, { type: "press", buttonId: "go:mailbox" });
        if (!opened.rejected) {
          session.view = opened.view;
          session.module = await this.moduleOf(session);
        }
      }
      overlay = session.view?.overlay;
    }
    if (overlay?.kind !== "textInput" || !overlay.id.endsWith(":getname")) {
      return this.rerender(session);
    }
    return this.run(
      session,
      { type: "submitText", overlayId: overlay.id, text: input.slice(0, overlay.maxLength) },
      Request.getName,
    );
  }

  /**
   * A player picker is searched here, the way `get_id_from_full_or_partial_handle`
   * (misc_utils.cpp:222-259) does from slot `start`: over the players as they are
   * now (a rename since the picker opened counts, as the original read the live
   * list), limited to the ones the picker offers.
   */
  private async pickerSearch(
    overlay: Extract<NonNullable<View["overlay"]>, { kind: "playerPicker" }>,
    input: string,
    start: number,
  ): Promise<LegacyVars> {
    const wanted = (input === "" ? "skljdskljdslkj" : input).toLowerCase();
    const town = await this.host.getTown();
    const offered = new Set(overlay.players.map((pl) => pl.id));
    const found = town.players
      .filter((pl) => pl.active && offered.has(pl.id))
      .find((pl) => pl.id >= Math.max(0, start) && pl.name.toLowerCase().includes(wanted));
    const vars: [string, string | number][] = found
      ? [
          ["st_object", "i_namenext"],
          ["i_his_id", found.id],
          ["st_message", escapeHtml(found.name)],
        ]
      : [
          ["st_object", "i_namenext"],
          ["i_his_id", -1],
          ["st_message", ""],
        ];
    vars.push(["i_return_command", RETURN_COMMAND], ["i_return_command_sub", 0]);
    vars.push(["i_sent", Sent.objectAdd]);
    return vars;
  }

  /** The end of `i_getname`, `i_get_text` and `i_namenext` (the client's `i_return_command`). */
  private async returned(session: BridgeSession, text: string, hisId: number): Promise<LegacyVars> {
    const overlay = session.view?.overlay;
    if (!overlay) return this.rerender(session);
    switch (overlay.kind) {
      case "textInput": {
        const abort = text === ABORT_TEXT || overlay.id.endsWith(":getname");
        return this.run(
          session,
          {
            type: "submitText",
            overlayId: overlay.id,
            text: abort ? null : text.slice(0, overlay.maxLength),
          },
          RETURN_COMMAND,
        );
      }
      case "confirm":
        if (hisId < 0) {
          const cleared = await this.clearOverlay(session);
          if (!cleared) return this.rerender(session);
          return this.rerender(session, session.view ?? undefined);
        }
        return this.run(
          session,
          { type: "confirm", overlayId: overlay.id, accepted: true },
          RETURN_COMMAND,
        );
      case "playerPicker":
        return this.run(
          session,
          {
            type: "pickPlayer",
            overlayId: overlay.id,
            playerId: hisId >= 0 && overlay.players.some((x) => x.id === hisId) ? hisId : null,
          },
          RETURN_COMMAND,
        );
      case "message":
        return this.run(session, { type: "dismiss", overlayId: overlay.id }, RETURN_COMMAND);
    }
  }

  /** `command_send_mail` (commands_send_mail.cpp): the letter is the client's pad; the answer is `c_command_callback`. */
  private async sendMail(session: BridgeSession, text: string): Promise<LegacyVars> {
    let overlay = session.view?.overlay;
    if (overlay?.kind === "confirm") {
      const accepted = await this.act(session, {
        type: "confirm",
        overlayId: overlay.id,
        accepted: true,
      });
      if (accepted.rejected) return this.rerender(session);
      session.view = accepted.view;
      overlay = session.view.overlay;
    }
    if (overlay?.kind !== "textInput" || !overlay.id.endsWith(":compose")) {
      return this.rerender(session);
    }
    const result = await this.act(session, {
      type: "submitText",
      overlayId: overlay.id,
      text: text.slice(0, overlay.maxLength),
    });
    if (result.rejected) return this.rerender(session, result.view);
    session.view = result.view;
    session.module = await this.moduleOf(session);
    if (result.view.overlay) return this.show(session, result.view, { forceNew: false });
    // Sent: tell the pad it can close; it asks for the desk itself (welcome.swf sprite 456).
    session.table = new Map();
    return [["i_sent", Sent.callback]];
  }

  /**
   * Reply on a letter. The pad opens in the client from `st_quote` and the
   * request that follows is not looked at (the original had no handler for
   * it), but the engine needs the question answered to open its own pad.
   */
  private async reply(session: BridgeSession): Promise<LegacyVars> {
    const action = session.table.get(Request.reply);
    if (action && session.view?.overlay?.kind === "confirm") {
      const result = await this.act(session, action);
      if (!result.rejected) {
        session.view = result.view;
        session.module = await this.moduleOf(session);
      }
    }
    return [["i_sent", Sent.pending]];
  }

  /** `command_chat_update` (commands_bar.cpp:420-445): say what was typed, return what others said. */
  private async chatUpdate(session: BridgeSession, input: string): Promise<LegacyVars> {
    const id = session.playerId;
    if (id === null) return this.fatal("Connection with server died. (user not logged on)");
    // One queue in the original (add_que_messages_chat, broadcast.cpp:103-154): lines
    // queued before this request come first, then what the request itself said.
    const waiting = this.chatInbox.get(id) ?? [];
    this.chatInbox.delete(id);
    const lines: RichText[] = [...waiting];
    const inCafe = session.view?.scene === "cafe";
    if (inCafe) {
      // Every poll goes to the engine, even an empty one: it also reads the notices
      // waiting in the queue (add_que_messages_chat). get_token_st trimmed the input.
      const result = await this.act(session, { type: "chat", text: input.trim() });
      if (!result.rejected) {
        session.view = result.view;
        for (const line of result.view.chat ?? []) lines.push(line.text);
      } else {
        this.log(`legacy bridge: chat refused: ${result.rejected}`);
      }
    }
    // Others' lines for this player that the chat action produced arrive in the same poll.
    const after = this.chatInbox.get(id) ?? [];
    this.chatInbox.delete(id);
    lines.push(...after);
    const ctx = this.contextFor(session, session.view ?? emptyCafe(), { forceNew: false });
    ctx.chat = { text: chatLines(lines), update: true };
    const rendered = renderView({ ...ctx, view: { ...ctx.view, scene: "cafe" } });
    session.client = rendered.client;
    return rendered.vars;
  }

  // ---- rendering ---------------------------------------------------------------

  private contextFor(
    session: BridgeSession,
    view: View,
    options: { forceNew: boolean },
  ): RenderContext {
    return {
      view,
      module: session.module,
      assets: this.assets,
      previous: session.client,
      forceNew: options.forceNew,
      day: 0,
    };
  }

  /** Renders a View for the player and records it as what the client now shows. */
  private async show(
    session: BridgeSession,
    view: View,
    options: { forceNew: boolean },
  ): Promise<LegacyVars> {
    const id = session.playerId;
    const town = id === null ? null : await this.host.getTown();
    session.view = view;
    session.module = (town && id !== null ? town.sessions[String(id)]?.scene : "") ?? "";
    if (view.scene === "lobby" || (town && id !== null && !town.sessions[String(id)])) {
      this.reset(session);
      return [["i_sent", Sent.quit]];
    }
    const ctx = this.contextFor(session, view, options);
    if (town) ctx.day = town.day;
    const texts = this.host.context().content.text;
    const plain = (markup: string) => richTextToPlain(parseLegacyText(markup));
    ctx.letterText = {
      sitting: [plain(texts.desk.sitting), plain(texts.desk.sittingPolice)],
      replyPrompt: plain(texts.social.mail.replyPrompt),
    };
    await this.addOverlayFacts(session, ctx, town);
    if (view.scene === "cafe" && !view.overlay) {
      const waiting = id === null ? [] : (this.chatInbox.get(id) ?? []);
      if (id !== null) this.chatInbox.delete(id);
      const own = (view.chat ?? []).map((l) => l.text);
      const wasCafe = session.client.object === "i_chat";
      if (wasCafe) {
        ctx.chat = { text: chatLines([...waiting, ...own]), update: true };
      } else {
        // command_chat_start (commands_bar.cpp:321-348) answers with the room's text
        // only; "X saunters in." and anything queued come with the next poll.
        ctx.chat = { text: view.text, update: false };
        if (id !== null && waiting.length + own.length > 0) {
          this.chatInbox.set(id, [...waiting, ...own]);
        }
      }
    }
    const rendered: Rendered = renderView(ctx);
    for (const note of rendered.notes) this.log(`legacy bridge: ${note}`);
    session.table = rendered.table;
    session.client = rendered.client;
    return this.finalize(session, rendered);
  }

  /** Adds the pieces a render cannot work out from the View alone. */
  private async addOverlayFacts(
    session: BridgeSession,
    ctx: RenderContext,
    town: TownState | null,
  ): Promise<void> {
    const overlay = ctx.view.overlay;
    const id = session.playerId;
    if (!overlay || !town || id === null) return;
    const data = town.sessions[String(id)]?.sceneData;
    const rec = typeof data === "object" && data !== null && !Array.isArray(data) ? data : null;
    if (overlay.kind === "confirm" && overlay.id.endsWith(":namenext")) {
      const hisId = typeof rec?.hisId === "number" ? rec.hisId : -1;
      const found = town.players[hisId];
      if (found) ctx.found = { id: found.id, name: found.name };
    }
    if (overlay.kind === "confirm" && overlay.id.endsWith(":reply")) {
      if (typeof rec?.to === "number") ctx.replyTo = rec.to;
      // Ask the engine what Reply would quote, without keeping the answer.
      const probe = step(
        town,
        id,
        { type: "confirm", overlayId: overlay.id, accepted: true },
        this.host.context(),
      );
      const next = probe.view.overlay;
      if (next?.kind === "textInput" && next.initial !== undefined) ctx.quote = next.initial;
    }
  }

  private finalize(_session: BridgeSession, rendered: Rendered): LegacyVars {
    return rendered.vars;
  }
}

/** The action that closes an overlay without choosing anything. */
function cancelAction(overlay: NonNullable<View["overlay"]>): Action {
  switch (overlay.kind) {
    case "message":
      return { type: "dismiss", overlayId: overlay.id };
    case "textInput":
      return { type: "submitText", overlayId: overlay.id, text: null };
    case "playerPicker":
      return { type: "pickPlayer", overlayId: overlay.id, playerId: null };
    case "confirm":
      return { type: "confirm", overlayId: overlay.id, accepted: false };
  }
}

function emptyCafe(): View {
  return { scene: "cafe", title: "", text: [], buttons: [] };
}

export { richTextToPlain };
