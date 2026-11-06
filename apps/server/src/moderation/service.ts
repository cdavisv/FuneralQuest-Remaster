import { richTextToPlain, type TownState } from "@fq/core";
import type { Action } from "@fq/protocol";
import type { Account } from "../auth/accounts.js";
import type { Clock } from "../clock.js";
import type { ServerConfig } from "../config.js";
import type { AuditStore, ParlorStore } from "../db/stores.js";
import type { TownRuntime } from "../game/town.js";
import type {
  BlockInfo,
  BlockRequest,
  MuteInfo,
  MuteScope,
  ReportRequest,
  ReportResponse,
  SafetyTarget,
} from "../wire.js";
import { MUTE_SCOPES } from "../wire.js";
import { Blocklist } from "./blocklist.js";
import { type BufferedLine, ChatBuffer, type EvidenceLine } from "./chatBuffer.js";
import {
  type BlockRow,
  BlockStore,
  type Mute,
  MuteStore,
  type NewReport,
  type ReportRow,
  ReportStore,
} from "./stores.js";

/** What the service needs to look at towns without importing the host (which owns the service). */
export interface TownDirectory {
  get(id: string): TownRuntime | undefined;
  all(): Iterable<TownRuntime>;
}

/** A refusal the HTTP layer turns into an error answer. */
export class SafetyError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: { mute?: MuteInfo } = {},
  ) {
    super(message);
  }
}

/** Words for the scopes in a message to a muted player. */
const SCOPE_WORDS: Record<MuteScope, string> = {
  chat: "cafe talk",
  mail: "letters and battle quotes",
  announcements: "announcements",
  fortunes: "fortunes",
};

export function describeScopes(scopes: readonly MuteScope[]): string {
  const words = scopes.map((s) => SCOPE_WORDS[s]);
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

/** Overlays whose submitted text is public or sent to another player, by what they are. */
const OVERLAY_SCOPE: Record<string, MuteScope> = {
  "mailbox:compose": "mail",
  "battle:quote": "mail",
  "news:announcement": "announcements",
  "cityHall:chainname": "announcements",
  "yangs:tiger-fortune": "fortunes",
  "yangs:sparrow-fortune": "fortunes",
};

/** The kind of text an action would publish, or null if it publishes none (or only cancels). */
export function scopeOfAction(action: Action): MuteScope | null {
  if (action.type === "chat") return "chat";
  if (action.type === "submitText" && action.text !== null) {
    return OVERLAY_SCOPE[action.overlayId] ?? null;
  }
  return null;
}

/** The text of an action that the strict block list applies to (announcements and chain names). */
export function blocklistedText(action: Action): string | null {
  return action.type === "submitText" &&
    action.text !== null &&
    OVERLAY_SCOPE[action.overlayId] === "announcements"
    ? action.text
    : null;
}

/** Overlay ids a typed text can come from, by the kind of thing it becomes. */
const AUTHOR_OVERLAYS: Record<string, readonly string[]> = {
  letter: ["mailbox:compose"],
  announcement: ["news:announcement"],
  fortune: ["yangs:tiger-fortune", "yangs:sparrow-fortune"],
  quote: ["battle:quote"],
};

const WHERE: Record<string, string> = {
  chat: "the cafe",
  letter: "mail",
  announcement: "the newspaper",
  fortune: "a fortune",
  quote: "a battle quote",
  player: "the rankings",
  name: "the rankings",
  parlorName: "the rankings",
};

const squashSpace = (s: string) => s.replace(/\s+/g, " ").trim();

/** Who and what a target pointed at, as far as the server could tell. */
export interface Resolved {
  townId: string;
  kind: string;
  playerId: number | null;
  accountId: number | null;
  login: string | null;
  name: string | null;
  parlor: string | null;
  text: string | null;
  authoredAt: number | null;
  where: string;
  /** The server found this text where it says it came from (its chat window or the audit log). */
  verified: boolean;
  window: EvidenceLine[];
}

export interface ServiceDeps {
  db: import("../db/database.js").Db;
  clock: Clock;
  config: ServerConfig;
  parlors: ParlorStore;
  audit: AuditStore;
  towns: TownDirectory;
  getAccount: (id: number) => Account | undefined;
}

const HOUR = 3_600_000;
const DAY = 86_400_000;
/** How many chat lines before and after a reported line the report keeps. */
const WINDOW_BEFORE = 10;
const WINDOW_AFTER = 5;
/** How far back an author lookup reads the audit log, in rows. */
const AUTHOR_SEARCH_ROWS = 4000;

/**
 * Player safety: blocks that follow the account, reports with their evidence, mutes, the strict
 * word list and the short cafe window kept for reports. One instance per server.
 */
export class ModerationService {
  readonly blocklist: Blocklist;
  readonly chat: ChatBuffer;
  readonly blockStore: BlockStore;
  readonly reports: ReportStore;
  readonly mutes: MuteStore;
  /** Bumped by every change to a block list. Towns compare it to what they last applied. */
  blockVersion = 0;
  private readonly index = new Map<number, Set<number>>();

  constructor(private readonly deps: ServiceDeps) {
    this.blocklist = deps.config.blocklistFile
      ? Blocklist.fromFile(deps.config.blocklistFile)
      : Blocklist.empty();
    this.chat = new ChatBuffer(deps.config.chatBufferLines, deps.config.chatBufferMinutes * 60_000);
    this.blockStore = new BlockStore(deps.db);
    this.reports = new ReportStore(deps.db);
    this.mutes = new MuteStore(deps.db);
    for (const row of this.blockStore.all()) this.indexAdd(row.blocker_id, row.blocked_id);
  }

  private now(): number {
    return this.deps.clock.now();
  }

  // ---------------------------------------------------------------- blocks

  private indexAdd(blocker: number, blocked: number): void {
    let set = this.index.get(blocker);
    if (!set) {
      set = new Set();
      this.index.set(blocker, set);
    }
    set.add(blocked);
  }

  /** The accounts `blocker` has blocked. */
  blockedAccounts(blocker: number): ReadonlySet<number> {
    return this.index.get(blocker) ?? new Set();
  }

  /** Whether `blocker` has blocked `other` (accounts). */
  isBlocking(blocker: number, other: number): boolean {
    return this.index.get(blocker)?.has(other) ?? false;
  }

  /** The login of an account, if it still exists. */
  loginOf(accountId: number): string | undefined {
    return this.deps.getAccount(accountId)?.login;
  }

  /** Player id to account id in a town, from the parlor links. */
  accountOfPlayer(townId: string, playerId: number): number | null {
    return this.deps.parlors.byPlayer(townId, playerId)?.account_id ?? null;
  }

  /** Records a block. The caller then makes every town apply it (`TownRuntime.refreshBlocks`). */
  addBlock(
    blocker: Account,
    blockedAccountId: number,
    label: string,
  ): { row: BlockRow; created: boolean } {
    if (blockedAccountId === blocker.id) {
      throw new SafetyError(400, "cannot_block_self", "You cannot block yourself.");
    }
    const result = this.blockStore.add(
      blocker.id,
      blockedAccountId,
      label.slice(0, 64),
      this.now(),
    );
    if (result.created) {
      this.indexAdd(blocker.id, blockedAccountId);
      this.blockVersion++;
      this.deps.audit.append({
        at: this.now(),
        accountId: blocker.id,
        kind: "safety:block",
        data: { blockedAccountId },
      });
    }
    return result;
  }

  /** Removes one of `blocker`'s blocks. False if it is not theirs. */
  removeBlock(blocker: Account, blockId: number): boolean {
    const row = this.blockStore.find(blockId);
    if (!row || row.blocker_id !== blocker.id) return false;
    this.blockStore.remove(blockId);
    this.index.get(blocker.id)?.delete(row.blocked_id);
    this.blockVersion++;
    this.deps.audit.append({
      at: this.now(),
      accountId: blocker.id,
      kind: "safety:unblock",
      data: { blockedAccountId: row.blocked_id },
    });
    return true;
  }

  /** An account's block list, with the names other players know the blocked by. */
  listBlocks(blocker: Account): BlockInfo[] {
    return this.blockStore.forBlocker(blocker.id).map((row) => this.describeBlock(row));
  }

  describeBlock(row: BlockRow): BlockInfo {
    for (const link of this.deps.parlors.forAccount(row.blocked_id)) {
      const player = this.deps.towns.get(link.town_id)?.snapshotState.players[link.player_id];
      if (player?.active) {
        return {
          id: row.id,
          name: player.name,
          parlor: player.parlor,
          townId: link.town_id,
          since: new Date(row.created_at).toISOString(),
        };
      }
    }
    return {
      id: row.id,
      name: row.label,
      parlor: null,
      townId: null,
      since: new Date(row.created_at).toISOString(),
    };
  }

  /** Resolves the request's target and blocks the author. */
  async block(
    blocker: Account,
    request: BlockRequest,
  ): Promise<{ info: BlockInfo; already: boolean }> {
    const resolved = this.resolve(blocker, request.townId, request.target);
    if (resolved.accountId === null) {
      throw new SafetyError(
        404,
        "unknown_author",
        "The server cannot tell who wrote that any more. Block them from the rankings instead.",
      );
    }
    const label = resolved.name ?? resolved.login ?? "A player";
    const { row, created } = this.addBlock(blocker, resolved.accountId, label);
    // Apply it in every town the two share before answering (and keep the engine in step).
    await this.applyEverywhere();
    return { info: this.describeBlock(row), already: !created };
  }

  /** Makes every town's engine state match the block lists. */
  async applyEverywhere(): Promise<void> {
    for (const town of this.deps.towns.all()) await town.refreshBlocks();
  }

  /** Rebuilds the in-memory index from the table (after accounts were deleted behind its back). */
  reloadBlocks(): void {
    this.index.clear();
    for (const row of this.blockStore.all()) this.indexAdd(row.blocker_id, row.blocked_id);
    this.blockVersion++;
  }

  /** An account is going away: forget its blocks (as blocker and as blocked) and its chat lines. */
  forgetAccount(accountId: number): void {
    this.index.delete(accountId);
    for (const set of this.index.values()) set.delete(accountId);
    this.chat.purgeAccount(accountId);
    this.blockVersion++;
  }

  // ----------------------------------------------------------------- mutes

  /** Mutes in force on an account, as the player may see them. */
  muteInfo(accountId: number): MuteInfo[] {
    return this.mutes.active(accountId, this.now()).map((m) => ({
      scopes: m.scopes,
      until: new Date(m.expiresAt).toISOString(),
    }));
  }

  /** The mute that forbids `scope` for the account right now, if any. */
  muteFor(accountId: number, scope: MuteScope): Mute | null {
    return this.mutes.active(accountId, this.now()).find((m) => m.scopes.includes(scope)) ?? null;
  }

  /** Throws the refusal for a muted account trying `action`. */
  assertMayAct(account: Account, action: Action): void {
    const scope = scopeOfAction(action);
    if (scope === null) return;
    const mute = this.muteFor(account.id, scope);
    if (!mute) return;
    const until = new Date(mute.expiresAt);
    throw new SafetyError(
      403,
      "muted",
      `You are muted from ${describeScopes(mute.scopes)} until ${until.toUTCString()}. This is a temporary measure by the moderators.`,
      { mute: { scopes: mute.scopes, until: until.toISOString() } },
    );
  }

  /**
   * Refuses text that contains a strictly blocked word. The refusal names no word and nothing is
   * logged but the kind of text and a short hash prefix of the entry.
   */
  assertTextAllowed(
    account: Account | null,
    text: string,
    what: "announcement" | "name" | "parlor name",
    townId: string | null,
  ): void {
    const verdict = this.blocklist.check(text);
    if (!verdict.blocked) return;
    this.deps.audit.append({
      at: this.now(),
      townId,
      accountId: account?.id ?? null,
      kind: "safety:text-refused",
      data: { what, entry: verdict.entry },
    });
    throw new SafetyError(
      422,
      "text_not_allowed",
      `That ${what} uses language this town does not allow. Please word it differently.`,
    );
  }

  createMute(input: {
    accountId: number;
    scopes: readonly MuteScope[];
    hours: number;
    reason: string;
    moderator: string;
    auto?: boolean;
    reportId?: number | null;
  }): Mute {
    const now = this.now();
    const id = this.mutes.insert({
      accountId: input.accountId,
      scopes: [...new Set(input.scopes)].filter((s) => MUTE_SCOPES.includes(s)),
      createdAt: now,
      expiresAt: now + input.hours * HOUR,
      reason: input.reason,
      moderator: input.moderator,
      auto: input.auto === true,
      reportId: input.reportId ?? null,
    });
    return this.mutes.get(id) as Mute;
  }

  // --------------------------------------------------------------- reports

  /** Records the lines a push delivered, for the chat window (called by the town's commit). */
  recordChat(
    townId: string,
    sender: { playerId: number | null; accountId: number | null; name: string | null },
    text: string,
    recipients: readonly number[],
  ): void {
    this.chat.record(townId, {
      at: this.now(),
      text,
      senderPlayerId: sender.playerId,
      senderAccountId: sender.accountId,
      senderName: sender.name,
      recipients: new Set(recipients),
    });
  }

  /** Works out who and what a target is. */
  resolve(viewer: Account, townId: string, target: SafetyTarget): Resolved {
    const town = this.deps.towns.get(townId);
    if (!town) throw new SafetyError(404, "no_such_town", "No such town.");
    const state = town.snapshotState;
    const mine = this.deps.parlors.find(viewer.id, townId)?.player_id ?? null;
    const base: Resolved = {
      townId,
      kind: target.kind,
      playerId: null,
      accountId: null,
      login: null,
      name: null,
      parlor: null,
      text: null,
      authoredAt: null,
      where: WHERE[target.kind] ?? "the game",
      verified: false,
      window: [],
    };
    const withPlayer = (playerId: number): Resolved => {
      const p = state.players[playerId];
      if (!p?.active) return base;
      const accountId = this.accountOfPlayer(townId, playerId);
      return {
        ...base,
        playerId,
        accountId,
        login: accountId === null ? null : (this.deps.getAccount(accountId)?.login ?? null),
        name: p.name,
        parlor: p.parlor,
      };
    };

    switch (target.kind) {
      case "player":
      case "parlorName": {
        const r = withPlayer(target.playerId);
        if (r.playerId === null) throw new SafetyError(404, "no_such_player", "No such player.");
        return {
          ...r,
          text: target.kind === "parlorName" ? r.parlor : r.name,
          verified: true,
        };
      }
      case "name": {
        const wanted = target.name.trim().toLowerCase();
        const found = state.players.find((p) => p.active && p.name.toLowerCase() === wanted);
        if (!found) throw new SafetyError(404, "no_such_player", "No such player.");
        return { ...withPlayer(found.id), text: found.name, verified: true };
      }
      case "chat": {
        const text = target.text.slice(0, 2000);
        const line = mine === null ? null : this.chat.find(townId, mine, text, this.now());
        if (!line) return { ...base, text, verified: false };
        const sender = line.senderPlayerId === null ? base : withPlayer(line.senderPlayerId);
        return {
          ...sender,
          // A player who has since left may have no active slot; the buffer still knows the account.
          accountId: sender.accountId ?? line.senderAccountId,
          name: sender.name ?? line.senderName,
          text: line.text,
          authoredAt: line.at,
          verified: true,
          window:
            mine === null ? [] : this.chat.window(townId, mine, line, WINDOW_BEFORE, WINDOW_AFTER),
        };
      }
      case "letter":
      case "announcement":
      case "fortune":
      case "quote": {
        const text = target.text.slice(0, 4000);
        const from = target.kind === "letter" ? target.fromPlayerId : undefined;
        const found = this.findAuthor(townId, target.kind, text, from);
        if (found) {
          const sender = found.playerId === null ? base : withPlayer(found.playerId);
          return {
            ...sender,
            accountId: found.accountId ?? sender.accountId,
            login:
              found.accountId === null
                ? sender.login
                : (this.deps.getAccount(found.accountId)?.login ?? sender.login),
            text,
            authoredAt: found.at,
            verified: true,
          };
        }
        // Not in the audit log (too old, or the engine's filter changed it). A letter still says
        // who sent it through its Reply button, so that much is kept, marked unverified.
        const claimed = from === undefined ? base : withPlayer(from);
        return { ...claimed, text, verified: false };
      }
    }
  }

  /**
   * The audit log holds every typed submission (account, player, time). A text shown to a player
   * contains what its author typed, so the newest submission of the right kind that is contained
   * in the shown text is its author.
   */
  private findAuthor(
    townId: string,
    kind: string,
    shown: string,
    from?: number,
  ): { accountId: number | null; playerId: number | null; at: number } | null {
    const overlays = AUTHOR_OVERLAYS[kind] ?? [];
    const haystack = squashSpace(shown);
    for (const row of this.deps.audit.recentTyped(townId, AUTHOR_SEARCH_ROWS)) {
      const action = (row.data as { action?: Action } | null)?.action;
      if (action?.type !== "submitText" || action.text === null) continue;
      if (!overlays.includes(action.overlayId)) continue;
      if (from !== undefined && row.playerId !== from) continue;
      const typed = squashSpace(action.text);
      if (typed.length < 3 || !haystack.includes(typed)) continue;
      return { accountId: row.accountId, playerId: row.playerId, at: row.at };
    }
    return null;
  }

  /** Files a report. Rate limited; the reporter is stored for moderators only. */
  async report(reporter: Account, request: ReportRequest): Promise<ReportResponse> {
    const now = this.now();
    const cfg = this.deps.config;
    if (this.reports.countFiledSince(reporter.id, now - HOUR) >= cfg.reportsPerHour) {
      throw new SafetyError(
        429,
        "report_limit",
        "You have sent a lot of reports this hour. Please wait a little; the moderators will read them.",
      );
    }
    if (this.reports.countFiledSince(reporter.id, now - DAY) >= cfg.reportsPerDay) {
      throw new SafetyError(
        429,
        "report_limit",
        "You have reached today's limit on reports. Please try again tomorrow.",
      );
    }
    const resolved = this.resolve(reporter, request.townId, request.target);
    if (resolved.accountId === reporter.id) {
      throw new SafetyError(400, "cannot_report_self", "You cannot report yourself.");
    }
    const duplicate = this.reports.findRecentDuplicate(
      reporter.id,
      resolved.accountId,
      resolved.kind,
      now - DAY,
      resolved.text,
    );
    const block =
      resolved.accountId === null
        ? null
        : { name: resolved.name ?? resolved.login ?? "this player" };
    let blocked = false;
    if (request.alsoBlock && resolved.accountId !== null) {
      this.addBlock(reporter, resolved.accountId, resolved.name ?? resolved.login ?? "A player");
      blocked = true;
      await this.applyEverywhere();
    }
    if (duplicate) return { ok: true, duplicate: true, blockOffer: block, blocked };

    const row: NewReport = {
      created_at: now,
      source: "player",
      reporter_account_id: reporter.id,
      reporter_guest: reporter.guest ? 1 : 0,
      town_id: request.townId,
      kind: resolved.kind,
      category: request.category,
      note: request.note?.trim() ? request.note.trim().slice(0, 500) : null,
      reported_text: resolved.text,
      reported_account_id: resolved.accountId,
      reported_login: resolved.login,
      reported_player_id: resolved.playerId,
      reported_name: resolved.name,
      reported_parlor: resolved.parlor,
      authored_at: resolved.authoredAt,
      where_seen: resolved.where,
      verified: resolved.verified ? 1 : 0,
      evidence_json: JSON.stringify({ chatWindow: resolved.window }),
    };
    const id = this.reports.insert(row);
    this.deps.audit.append({
      at: now,
      townId: request.townId,
      accountId: reporter.id,
      kind: "report:filed",
      data: { reportId: id, kind: resolved.kind, category: request.category },
    });
    this.maybeAutoMute(id, resolved.accountId);
    return { ok: true, duplicate: false, blockOffer: block, blocked };
  }

  /**
   * Several distinct registered accounts reporting the same account within a short window mutes
   * it pending review. A moderator lifts it, or dismisses the reports (which lifts it too when
   * none are left open).
   */
  private maybeAutoMute(reportId: number, reportedId: number | null): void {
    const cfg = this.deps.config;
    if (cfg.autoMuteReports <= 0 || reportedId === null) return;
    const now = this.now();
    const reporters = this.reports.distinctReporters(
      reportedId,
      now - cfg.autoMuteWindowMinutes * 60_000,
    );
    if (reporters.length < cfg.autoMuteReports) return;
    if (this.mutes.active(reportedId, now).some((m) => m.auto)) return;
    const mute = this.createMute({
      accountId: reportedId,
      scopes: MUTE_SCOPES,
      hours: cfg.autoMuteHours,
      reason: `Automatic: reported by ${reporters.length} players within ${cfg.autoMuteWindowMinutes} minutes, pending review`,
      moderator: "system",
      auto: true,
      reportId,
    });
    this.deps.audit.append({
      at: now,
      accountId: reportedId,
      kind: "mod:automute",
      data: { muteId: mute.id, reportId, reporters: reporters.length, hours: cfg.autoMuteHours },
    });
  }

  /** Lifts an automatic mute when no open report about the account is left. */
  liftAutoMuteIfSettled(accountId: number, by: string): number | null {
    if (this.reports.openAbout(accountId) > 0) return null;
    const auto = this.mutes.active(accountId, this.now()).find((m) => m.auto);
    if (!auto) return null;
    this.mutes.lift(auto.id, this.now());
    this.deps.audit.append({
      at: this.now(),
      accountId,
      kind: "mod:unmute",
      data: { muteId: auto.id, moderator: by, reason: "no open reports remain" },
    });
    return auto.id;
  }

  // ------------------------------------------------------------ housekeeping

  /** Deletes closed reports past their retention. */
  pruneReports(): number {
    const days = this.deps.config.reportRetentionDays;
    if (days <= 0) return 0;
    return this.reports.pruneClosed(this.now() - days * DAY);
  }

  /** The summary line of a report row for moderators. */
  reportSummary(row: ReportRow) {
    return {
      id: row.id,
      createdAt: new Date(row.created_at).toISOString(),
      status: row.status,
      source: row.source,
      townId: row.town_id,
      kind: row.kind,
      category: row.category,
      note: row.note,
      text: row.reported_text,
      reportedAccountId: row.reported_account_id,
      reportedLogin: row.reported_login,
      reportedName: row.reported_name,
      reportedParlor: row.reported_parlor,
      reporterAccountId: row.reporter_account_id,
      verified: row.verified === 1,
      resolvedAt: row.resolved_at === null ? null : new Date(row.resolved_at).toISOString(),
      resolvedBy: row.resolved_by,
      resolution: row.resolution,
      resolutionNote: row.resolution_note,
    };
  }
}

/** Plain text of a pushed notice, for the chat window. */
export function plainOf(text: Parameters<typeof richTextToPlain>[0]): string {
  return richTextToPlain(text);
}

export type { BufferedLine, TownState };
