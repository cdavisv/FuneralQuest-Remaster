import { randomInt } from "node:crypto";
import {
  createPlayer,
  createTown,
  type Effect,
  type EngineContext,
  enterGame,
  type GameSettings,
  leaveGame,
  lobbyStatus,
  type PlayerState,
  parseLegacyText,
  richTextToPlain,
  runDailyMaintenance,
  setBlocked,
  step,
  type TownState,
} from "@fq/core";
import type { Action, RichText, View } from "@fq/protocol";
import type { FastifyBaseLogger } from "fastify";
import type { Account } from "../auth/accounts.js";
import type { Clock } from "../clock.js";
import type { ContentSource } from "../content/index.js";
import { type Db, transaction } from "../db/database.js";
import type {
  AuditStore,
  HallStore,
  NewHallRow,
  ParlorStore,
  TownRow,
  TownStore,
} from "../db/stores.js";
import { eraseParlorFrom, type NameHistory } from "../moderation/erase.js";
import type { ModerationService } from "../moderation/service.js";
import type { EndReason, ParlorForm, ParlorInfo, RankingRow, TownInfo } from "../wire.js";
import { RejectedActionThrottle } from "./auditThrottle.js";
import { diffPushes, type EffectPlan, notice, type Outbound, planEffects } from "./effects.js";
import { buildHallEntry } from "./hall.js";
import type { Hub } from "./hub.js";
import { reportPresence } from "./presence.js";
import { SerialQueue } from "./queue.js";
import { getRuleset, type RulesetDef } from "./rulesets.js";
import { createSchedule, type DaySchedule, utcOffsetMinutes } from "./schedule.js";
import type { RuleOverrides } from "./tuning.js";

/** Everything a town runtime shares with its host. */
export interface TownDeps {
  db: Db;
  towns: TownStore;
  parlors: ParlorStore;
  audit: AuditStore;
  hall: HallStore;
  clock: Clock;
  content: ContentSource;
  hub: Hub;
  log: FastifyBaseLogger;
  moderation: ModerationService;
  idleTimeoutMs: number;
  maxCatchUpDays: number;
  snapshotKeep: number;
  /**
   * Soak tests only (`FQ_TEST_MAINTENANCE_DELAY_MS`): real milliseconds to pause inside midnight
   * maintenance, after the new day is computed and before it is saved.
   */
  maintenanceDelayMs?: number;
}

/** What an operator chooses when creating a town. */
export interface TownSpec {
  id: string;
  name: string;
  ruleset: string;
  contentPack: string;
  timeZone: string;
  /** Null for midnight days; otherwise the Blitz day length. */
  dayLengthMs: number | null;
  seed: number;
  /** Expanded rule numbers changed for this town (dotted path to number). */
  ruleOverrides?: RuleOverrides;
  settings?: Partial<GameSettings>;
  serverNews?: string;
}

export type EnterOutcome =
  | { kind: "ok"; view: View; created: boolean; playerId: number }
  | { kind: "parlorRequired" }
  | { kind: "invalidParlor"; field: string; message: RichText }
  | { kind: "rejected"; reason: string };

export type ActOutcome =
  | { kind: "ok"; view: View }
  | { kind: "rejected"; reason: string; view: View }
  | { kind: "notInGame" };

export type ViewOutcome = { kind: "ok"; view: View } | { kind: "notInGame" };

interface Commit {
  kind: string;
  /** The engine state after the call. */
  town: TownState;
  effects: readonly Effect[];
  accountId?: number;
  playerId?: number;
  data?: unknown;
  /** The player whose action this was; they get a response, not a push. */
  actorId: number | null;
  linkParlor?: { accountId: number; playerId: number };
  lastBoundary?: number;
  endReason?: EndReason;
  /** Finished seasons to write to the hall of fame in the same transaction. */
  seasons?: readonly NewHallRow[];
  /** Report the actor as connected once the effects are applied (if their session survives). */
  connectActor?: boolean;
  /** Skip the audit rows (connection changes would only add noise). */
  quiet?: boolean;
  /** Players served by a client with no socket (museum mode): report each online one as connected. */
  connectPlayers?: readonly number[];
  /** The change came from a host-side client (museum mode), not from the town's own requests. */
  external?: boolean;
  /** Player slots whose account link ends with this change (a deleted parlor). */
  unlinkPlayers?: readonly number[];
  /** A cafe line was typed: nothing of its text may reach the audit log or the server log. */
  redact?: boolean;
}

/**
 * Told about the engine effects of every change the town's own requests made (not museum ones).
 * `visibleTo(playerId)` says whether a cafe line from this change may reach that player (false
 * when they have blocked its sender).
 */
export type EffectObserver = (
  effects: readonly Effect[],
  town: TownState,
  visibleTo: (playerId: number) => boolean,
) => void;

const STALE = "parlor does not belong to this account";

function parseOverrides(json: string): RuleOverrides {
  try {
    const value = JSON.parse(json) as unknown;
    return typeof value === "object" && value !== null ? (value as RuleOverrides) : {};
  } catch {
    return {};
  }
}

/**
 * One town: its in-memory `TownState`, its single-writer queue, its day
 * schedule and its persistence. The state is replaced (never mutated) by each
 * step; every replacement is written to SQLite in one transaction together
 * with its audit rows before anyone is told about it.
 */
export class TownRuntime {
  private state: TownState;
  private stateJson: string;
  private readonly queue = new SerialQueue();
  private ruleset: RulesetDef;
  private baseCtx: EngineContext;
  private schedule: DaySchedule;
  private cancelTimer: (() => void) | null = null;
  private lastSnapshotRevision: number;
  private readonly startedAt: number;
  /** Last action time per player, in clock time. */
  private readonly activeAt = new Map<number, number>();
  private closed = false;
  private readonly observers = new Set<EffectObserver>();
  private readonly rejections = new RejectedActionThrottle();
  /** The block-list version this town's engine state last matched (see `syncBlocks`). */
  private appliedBlockVersion = -1;

  private constructor(
    private row: Omit<TownRow, "state_json">,
    state: TownState,
    stateJson: string,
    ruleset: RulesetDef,
    baseCtx: EngineContext,
    private readonly deps: TownDeps,
  ) {
    this.state = state;
    this.stateJson = stateJson;
    this.ruleset = ruleset;
    this.baseCtx = baseCtx;
    this.schedule = createSchedule({
      timeZone: row.time_zone,
      dayLengthMs: row.day_length_ms,
      epoch: row.epoch,
    });
    this.lastSnapshotRevision = row.revision;
    this.startedAt = deps.clock.now();
  }

  // ------------------------------------------------------------ creation

  /** Loads a town from its stored row. */
  static load(row: TownRow, deps: TownDeps): TownRuntime {
    const ruleset = getRuleset(row.ruleset);
    if (!ruleset) throw new Error(`Town ${row.id} uses unknown ruleset "${row.ruleset}"`);
    const baseCtx = ruleset.context(
      deps.content.load(row.content_pack),
      parseOverrides(row.rule_overrides),
    );
    const { state_json: json, ...meta } = row;
    let state = JSON.parse(json) as TownState;
    // After a restart nobody is connected; sessions survive, so report each as away until
    // its client acts or reconnects.
    for (const key of Object.keys(state.sessions))
      state = reportPresence(state, Number(key), false);
    return new TownRuntime(meta, state, json, ruleset, baseCtx, deps);
  }

  /** Creates, saves and returns a new town (day 1, like a fresh original game). */
  static create(spec: TownSpec, deps: TownDeps): TownRuntime {
    const ruleset = getRuleset(spec.ruleset);
    if (!ruleset) throw new Error(`Unknown ruleset "${spec.ruleset}"`);
    const overrides = spec.ruleOverrides ?? {};
    const baseCtx = ruleset.context(deps.content.load(spec.contentPack), overrides);
    const now = deps.clock.now();
    const made = createTown(
      {
        seed: spec.seed,
        ...(spec.settings ? { settings: spec.settings } : {}),
        ...(spec.serverNews !== undefined ? { serverNews: spec.serverNews } : {}),
      },
      { ...baseCtx, now, localTimeOffsetMinutes: utcOffsetMinutes(spec.timeZone, now) },
    );
    const schedule = createSchedule({
      timeZone: spec.timeZone,
      dayLengthMs: spec.dayLengthMs,
      epoch: now,
    });
    const json = JSON.stringify(made.town);
    const row: TownRow = {
      id: spec.id,
      name: spec.name,
      ruleset: spec.ruleset,
      content_pack: spec.contentPack,
      time_zone: spec.timeZone,
      day_length_ms: spec.dayLengthMs,
      epoch: now,
      last_boundary: schedule.currentBoundary(now),
      revision: 1,
      state_json: json,
      rule_overrides: JSON.stringify(overrides),
      created_at: now,
      updated_at: now,
    };
    transaction(deps.db, () => {
      deps.towns.insert(row);
      deps.audit.append({
        at: now,
        townId: spec.id,
        kind: "town:created",
        data: { name: spec.name, ruleset: spec.ruleset, contentPack: spec.contentPack },
      });
    });
    const { state_json: _unused, ...meta } = row;
    const runtime = new TownRuntime(meta, made.town, json, ruleset, baseCtx, deps);
    runtime.lastSnapshotRevision = 0;
    return runtime;
  }

  // ------------------------------------------------------------ accessors

  get id(): string {
    return this.row.id;
  }

  get name(): string {
    return this.row.name;
  }

  get contentPack(): string {
    return this.row.content_pack;
  }

  get rulesetName(): string {
    return this.row.ruleset;
  }

  get rulesetDef(): RulesetDef {
    return this.ruleset;
  }

  /** The Expanded rule numbers changed for this town. */
  get ruleOverrides(): RuleOverrides {
    return parseOverrides(this.row.rule_overrides);
  }

  /** The season being played, counted from the hall of fame; null when the town has no tournament. */
  get season(): number | null {
    if (!this.state.settings.tournamentActive) return null;
    return this.deps.hall.seasonsFinished(this.row.id) + 1;
  }

  get timeZone(): string {
    return this.row.time_zone;
  }

  get dayLengthMs(): number | null {
    return this.row.day_length_ms;
  }

  get revision(): number {
    return this.row.revision;
  }

  get pendingOperations(): number {
    return this.queue.length;
  }

  /** The current state. Treat it as read-only; steps replace it. */
  get snapshotState(): TownState {
    return this.state;
  }

  private ctx(): EngineContext {
    const now = this.deps.clock.now();
    // The original printed notices in the server's local time; a town's is its own time zone.
    return {
      ...this.baseCtx,
      now,
      localTimeOffsetMinutes: utcOffsetMinutes(this.row.time_zone, now),
    };
  }

  /** Runs `fn` after everything queued before it. */
  enqueue<T>(fn: () => T | Promise<T>): Promise<T> {
    return this.queue.run(fn);
  }

  /** The engine context (rules, content, registry) with the current time. */
  engineContext(): EngineContext {
    return this.ctx();
  }

  /**
   * Museum mode: runs `work` as one queued unit, after any day boundary that has passed, so a
   * client that drives the engine itself (the legacy bridge) is ordered with every other request.
   * Inside `work`, read `snapshotState` and save with `commitExternal`.
   */
  runExclusive<T>(work: () => Promise<T>): Promise<T> {
    return this.enqueue(async () => {
      await this.catchUpInQueue();
      return work();
    });
  }

  /**
   * Museum mode: saves a town the legacy bridge computed with the engine's own functions. Must be
   * called inside `runExclusive`. Goes through the same commit as every request: one transaction
   * with its audit rows, then pushes to other players' sockets, host commands and presence.
   */
  async commitExternal(
    town: TownState,
    effects: readonly Effect[],
    served: readonly number[],
  ): Promise<void> {
    // Whoever's last packet moved is the player who acted (the engine stamps it on every step).
    const actors = town.players
      .filter((p) => p.lastPacket !== this.state.players[p.id]?.lastPacket)
      .map((p) => p.id);
    for (const id of actors) this.touch(id);
    const actor = actors.length === 1 ? (actors[0] as number) : undefined;
    await this.commit({
      kind: "legacy",
      town,
      effects,
      actorId: null,
      external: true,
      connectPlayers: served,
      ...(actor !== undefined ? { playerId: actor } : {}),
    });
  }

  /**
   * Guest upgrade: gives the account's player here its new log-in name. Called inside
   * `runExclusive`, in the same turn as the account row changes (the commit does not wait), so the
   * player and the account never disagree where another request can see them.
   */
  async renameLogon(accountId: number, from: string, to: string): Promise<void> {
    const link = this.deps.parlors.find(accountId, this.row.id);
    if (!link) return;
    const player = this.state.players[link.player_id];
    if (!player?.active || player.logon.toLowerCase() !== from.toLowerCase()) return;
    const town: TownState = {
      ...this.state,
      players: this.state.players.map((p) => (p.id === player.id ? { ...p, logon: to } : p)),
    };
    await this.commit({
      kind: "account:upgrade",
      town,
      effects: [],
      accountId,
      playerId: player.id,
      actorId: null,
      data: { from, to },
    });
  }

  /** Links an account to a player slot the museum bridge has just created. */
  linkParlor(accountId: number, playerId: number): void {
    this.deps.parlors.link(accountId, this.row.id, playerId, this.deps.clock.now());
    // The new parlor may block, or be blocked by, players already here.
    this.appliedBlockVersion = -1;
    this.refreshBlocks().catch((error: unknown) => {
      this.deps.log.error({ err: error, townId: this.row.id }, "applying blocks failed");
    });
  }

  /** The player slot an account holds here, if it is still theirs. */
  parlorPlayerId(account: Account): number | null {
    return this.parlorRow(account)?.player_id ?? null;
  }

  /** Watches the effects of ordinary requests (museum mode forwards cafe lines to its players). */
  observeEffects(observer: EffectObserver): () => void {
    this.observers.add(observer);
    return () => {
      this.observers.delete(observer);
    };
  }

  // ------------------------------------------------------------- queries

  info(): TownInfo {
    const s = this.state;
    const now = this.deps.clock.now();
    const registered = s.players.filter((p) => p.active).length;
    const active = s.settings.tournamentActive;
    const lobby = lobbyStatus(s, this.ctx());
    return {
      id: this.row.id,
      name: this.row.name,
      ruleset: this.row.ruleset,
      rulesetLabel: this.ruleset.label,
      description: this.ruleset.description,
      contentPack: this.row.content_pack,
      day: s.day,
      timeZone: this.row.time_zone,
      dayLengthMinutes: this.row.day_length_ms === null ? null : this.row.day_length_ms / 60_000,
      nextDayAt: new Date(this.schedule.nextBoundary(now)).toISOString(),
      players: {
        registered,
        online: lobby.online,
        max: s.settings.maxPlayers,
      },
      tournament: {
        active,
        daysLeft: active ? Math.max(0, s.settings.tournamentDays - s.day) : null,
      },
      season: this.season,
      lobby: {
        gameInfo: parseLegacyText(lobby.gameInfo),
        closed: lobby.closed === null ? null : parseLegacyText(lobby.closed),
        online: lobby.online,
        players: lobby.players,
      },
      serverNews: parseLegacyText(s.serverNews),
      rankings: this.rankings(10),
    };
  }

  private rankings(limit: number): RankingRow[] {
    return this.state.players
      .filter((p) => p.active)
      .sort((a, b) => b.bp - a.bp || a.id - b.id)
      .slice(0, limit)
      .map((p, i) => ({ rank: i + 1, name: p.name, parlor: p.parlor, bp: p.bp }));
  }

  /** The parlors an account holds here, with a check that each slot is still theirs. */
  parlorsFor(account: Account): ParlorInfo[] {
    const row = this.parlorRow(account);
    if (!row) return [];
    const player = this.state.players[row.player_id];
    if (!player) return [];
    return [
      {
        townId: this.row.id,
        playerId: player.id,
        name: player.name,
        parlor: player.parlor,
        online: this.state.sessions[String(player.id)] !== undefined,
      },
    ];
  }

  /** The account's player slot, or null if none or stale (a reused or deleted slot). */
  private parlorRow(account: Account): { player_id: number } | null {
    const row = this.deps.parlors.find(account.id, this.row.id);
    if (!row) return null;
    const player = this.state.players[row.player_id];
    if (!player?.active || player.logon.toLowerCase() !== account.login.toLowerCase()) {
      this.deps.log.warn(
        { townId: this.row.id, accountId: account.id, why: STALE },
        "stale parlor",
      );
      this.deps.parlors.unlinkPlayer(this.row.id, row.player_id);
      return null;
    }
    return row;
  }

  // -------------------------------------------------------- game requests

  /** Enters the town, creating the parlor from `form` the first time. */
  enter(account: Account, form?: ParlorForm): Promise<EnterOutcome> {
    return this.enqueue(async () => {
      await this.catchUpInQueue();
      await this.ensureBlocks();
      const existing = this.parlorRow(account);
      const ctx = this.ctx();
      if (existing) {
        const r = enterGame(this.state, existing.player_id, ctx);
        if (r.rejected) return { kind: "rejected", reason: r.rejected } as const;
        this.touch(existing.player_id);
        await this.commit({
          kind: "enter",
          town: r.town,
          effects: r.effects,
          accountId: account.id,
          playerId: existing.player_id,
          actorId: existing.player_id,
          connectActor: true,
        });
        return { kind: "ok", view: r.view, created: false, playerId: existing.player_id } as const;
      }
      if (!form) return { kind: "parlorRequired" } as const;
      // The engine validates the parlor form and the log-on name; the password it
      // asks for is not stored (the account owns authentication), so a placeholder
      // within its length limits is passed.
      const rules = ctx.rules.newPlayer;
      const placeholder = "x".repeat(Math.min(rules.passwordMax, Math.max(rules.passwordMin, 1)));
      const made = createPlayer(
        this.state,
        {
          logon: account.login,
          name: form.name,
          parlor: form.parlor,
          password: placeholder,
          passwordVerify: placeholder,
          male: form.male,
          email: form.email ?? "none",
        },
        ctx,
      );
      if (!made.ok) {
        return { kind: "invalidParlor", field: made.field, message: made.error } as const;
      }
      if (made.rejected) return { kind: "rejected", reason: made.rejected } as const;
      this.touch(made.playerId);
      this.appliedBlockVersion = this.deps.moderation.blockVersion;
      await this.commit({
        kind: "parlor:create",
        town: this.applyBlocks(made.town, { accountId: account.id, playerId: made.playerId }),
        effects: made.effects,
        accountId: account.id,
        playerId: made.playerId,
        actorId: made.playerId,
        linkParlor: { accountId: account.id, playerId: made.playerId },
        data: { name: form.name, parlor: form.parlor },
        connectActor: true,
      });
      return { kind: "ok", view: made.view, created: true, playerId: made.playerId } as const;
    });
  }

  /** Applies one action for the account's own player. */
  act(account: Account, action: Action): Promise<ActOutcome> {
    return this.enqueue(async () => {
      await this.catchUpInQueue();
      // A block recorded since the last step is applied before the engine computes this one, so
      // a letter, gift or cafe line cannot slip past it.
      await this.ensureBlocks();
      const parlor = this.parlorRow(account);
      if (!parlor) return { kind: "notInGame" } as const;
      const playerId = parlor.player_id;
      if (!this.state.sessions[String(playerId)]) return { kind: "notInGame" } as const;
      const r = step(this.state, playerId, action, this.ctx());
      this.touch(playerId);
      // Cafe talk is never stored: the audit log keeps that a line was typed, and how long it was.
      const recorded =
        action.type === "chat" ? { type: "chat", length: action.text.length } : action;
      if (r.rejected) {
        const at = this.deps.clock.now();
        const logged = this.rejections.allow(playerId, at, (dropped) => {
          this.deps.audit.append({
            at,
            townId: this.row.id,
            accountId: account.id,
            playerId,
            kind: "action:rejected:suppressed",
            data: { dropped },
          });
        });
        if (logged) {
          this.deps.audit.append({
            at,
            townId: this.row.id,
            accountId: account.id,
            playerId,
            kind: "action:rejected",
            data: { action: recorded, reason: r.rejected },
          });
        }
        return { kind: "rejected", reason: r.rejected, view: r.view } as const;
      }
      await this.commit({
        kind: "action",
        town: r.town,
        effects: r.effects,
        accountId: account.id,
        playerId,
        actorId: playerId,
        data: { action: recorded },
        connectActor: this.state.presence?.[String(playerId)] === false,
        redact: action.type === "chat",
      });
      return { kind: "ok", view: r.view } as const;
    });
  }

  /** The player's current View, for resynchronising after a dropped connection. */
  currentView(account: Account): Promise<ViewOutcome> {
    return this.enqueue(() => {
      const parlor = this.parlorRow(account);
      const view = parlor ? this.state.sessions[String(parlor.player_id)]?.view : undefined;
      return view ? ({ kind: "ok", view } as const) : ({ kind: "notInGame" } as const);
    });
  }

  /** True when the account has a live session here (used to admit a WebSocket). */
  sessionPlayerId(account: Account): Promise<number | null> {
    return this.enqueue(() => {
      const parlor = this.parlorRow(account);
      return parlor && this.state.sessions[String(parlor.player_id)] ? parlor.player_id : null;
    });
  }

  private touch(playerId: number): void {
    this.activeAt.set(playerId, this.deps.clock.now());
  }

  // --------------------------------------------------------------- blocks

  /**
   * The engine's block lists, worked out from the accounts' blocks: a block follows the account,
   * so it is the players the blocked accounts hold in this town now. `extra` is a parlor that is
   * being created in the same commit and is not linked yet.
   */
  private applyBlocks(town: TownState, extra?: { accountId: number; playerId: number }): TownState {
    const mod = this.deps.moderation;
    const slotOf = new Map<number, number>();
    for (const link of this.deps.parlors.forTown(this.row.id)) {
      const player = town.players[link.player_id];
      const login = mod.loginOf(link.account_id);
      if (
        player?.active &&
        login !== undefined &&
        player.logon.toLowerCase() === login.toLowerCase()
      ) {
        slotOf.set(link.account_id, link.player_id);
      }
    }
    if (extra) slotOf.set(extra.accountId, extra.playerId);
    const desired = new Map<number, number[]>();
    for (const [blocker, slot] of slotOf) {
      const ids: number[] = [];
      for (const other of mod.blockedAccounts(blocker)) {
        const otherSlot = slotOf.get(other);
        if (otherSlot !== undefined && otherSlot !== slot) ids.push(otherSlot);
      }
      if (ids.length > 0)
        desired.set(
          slot,
          ids.sort((a, b) => a - b),
        );
    }
    let next = town;
    const current = town.blocks ?? {};
    for (const key of Object.keys(current)) {
      if (!desired.has(Number(key))) next = setBlocked(next, Number(key), []);
    }
    for (const [slot, ids] of desired) {
      if (JSON.stringify(current[String(slot)] ?? []) !== JSON.stringify(ids)) {
        next = setBlocked(next, slot, ids);
      }
    }
    return next;
  }

  /** Brings the engine's block lists in line with the accounts' (queued with everything else). */
  refreshBlocks(): Promise<void> {
    return this.enqueue(() => this.syncBlocksInQueue());
  }

  /** Museum mode: inside `runExclusive`, makes the engine's block lists current. */
  ensureBlocksInQueue(): Promise<void> {
    return this.ensureBlocks();
  }

  private async ensureBlocks(): Promise<void> {
    if (this.appliedBlockVersion !== this.deps.moderation.blockVersion) {
      await this.syncBlocksInQueue();
    }
  }

  private async syncBlocksInQueue(): Promise<void> {
    const version = this.deps.moderation.blockVersion;
    const next = this.applyBlocks(this.state);
    this.appliedBlockVersion = version;
    if (next === this.state) return;
    await this.commit({ kind: "blocks:sync", town: next, effects: [], actorId: null, quiet: true });
  }

  // ------------------------------------------------------------- presence

  /**
   * Logs off players who have been idle too long. Returns how many. The original did this in
   * `CFqDlg::user_list_update_time` (legacy/source/user_list.cpp:160-171, every 5 s from
   * `window_timer.cpp:30-44`): "<name> got kicked for inactivity" to everyone, then
   * `online_delete_guy` (a sale in progress is finished and mailed, the parlor is released). The
   * limit was the sysop's `i_player_kick_minutes` (default 4, `file_system.cpp:27`); here it is
   * `FQ_IDLE_TIMEOUT_MINUTES` (default 15).
   */
  sweepIdle(): Promise<number> {
    return this.enqueue(async () => {
      const now = this.deps.clock.now();
      let count = 0;
      for (const key of Object.keys(this.state.sessions)) {
        const playerId = Number(key);
        const session = this.state.sessions[key];
        const player = this.state.players[playerId];
        if (!session || !player) continue;
        const last = Math.max(
          this.activeAt.get(playerId) ?? 0,
          player.lastPacket,
          session.loggedOnAt,
          this.startedAt,
        );
        if (now - last >= this.deps.idleTimeoutMs) {
          await this.leaveInternal(playerId, "timeout", "idle", { inactive: true });
          count++;
        }
      }
      return count;
    });
  }

  /** Logs a player off (admin kick, ban, account deletion). */
  leave(playerId: number, reason: EndReason, why: string): Promise<boolean> {
    return this.enqueue(() => this.leaveInternal(playerId, reason, why));
  }

  private async leaveInternal(
    playerId: number,
    reason: EndReason,
    why: string,
    options: { inactive?: boolean } = {},
  ): Promise<boolean> {
    if (!this.state.sessions[String(playerId)]) return false;
    const r = leaveGame(this.state, playerId, this.ctx(), options);
    this.activeAt.delete(playerId);
    await this.commit({
      kind: `leave:${why}`,
      town: r.town,
      effects: r.effects,
      playerId,
      actorId: playerId,
      endReason: reason,
    });
    return true;
  }

  // -------------------------------------------------------------- the day

  /** Runs every day boundary missed since the last maintenance. */
  catchUp(): Promise<number> {
    return this.enqueue(() => this.catchUpInQueue());
  }

  private async catchUpInQueue(): Promise<number> {
    if (this.closed) return 0;
    const now = this.deps.clock.now();
    const missed = this.schedule.countBetween(
      this.row.last_boundary,
      now,
      this.deps.maxCatchUpDays,
    );
    if (missed === 0) return 0;
    if (missed >= this.deps.maxCatchUpDays) {
      this.deps.log.warn({ townId: this.row.id, missed }, "catch-up capped");
    }
    await this.runMaintenance(missed, "schedule", this.schedule.currentBoundary(now));
    return missed;
  }

  /** An operator forces a new day now; the schedule is untouched. */
  forceNewDay(): Promise<{ daysRun: number }> {
    return this.enqueue(async () => ({
      daysRun: await this.runMaintenance(1, "admin"),
    }));
  }

  private async runMaintenance(
    missedDays: number,
    source: string,
    lastBoundary?: number,
  ): Promise<number> {
    // One day at a time, so the state just before a season's final midnight is in hand: that is the
    // season's final standings, which the hall of fame keeps. The result is what one
    // `runDailyMaintenance(state, ctx, { missedDays })` call gives.
    const ctx = this.ctx();
    const wanted = ctx.rules.fixes.catchUpMissedDays ? Math.max(1, Math.trunc(missedDays)) : 1;
    let state = this.state;
    const effects: Effect[] = [];
    const seasons: NewHallRow[] = [];
    let daysRun = 0;
    for (let i = 0; i < wanted; i++) {
      const before = state;
      const day = runDailyMaintenance(before, ctx, { missedDays: 1 });
      state = day.town;
      effects.push(...day.effects);
      if (day.daysRun === 0) break;
      daysRun += day.daysRun;
      const over = day.effects.find((e) => e.kind === "tournamentReset");
      if (over?.kind === "tournamentReset") {
        seasons.push(
          buildHallEntry(
            before,
            { id: this.row.id, name: this.row.name, ruleset: this.row.ruleset },
            over.winner,
            ctx.now,
          ),
        );
      }
    }
    const result = { town: state, effects, daysRun };
    const pause = this.deps.maintenanceDelayMs ?? 0;
    if (pause > 0 && daysRun > 0) {
      // A soak test kills the process when it reads this line; nothing of the new day is saved yet.
      this.deps.log.info(
        { townId: this.row.id, day: this.state.day, toDay: state.day, pauseMs: pause },
        "maintenance paused before saving (FQ_TEST_MAINTENANCE_DELAY_MS)",
      );
      await new Promise((resolve) => setTimeout(resolve, pause));
    }
    if (effects.some((e) => e.kind === "tournamentReset")) {
      this.takeSnapshotInternal("pre-tournament-reset");
    }
    const plan = await this.commit({
      kind: "maintenance",
      town: result.town,
      effects: result.effects,
      actorId: null,
      data: { source, missedDays, daysRun: result.daysRun, day: result.town.day },
      seasons,
      ...(lastBoundary !== undefined ? { lastBoundary } : {}),
    });
    if (result.daysRun > 0) {
      for (const key of Object.keys(this.state.sessions)) {
        this.deps.hub.sendTo(this.row.id, Number(key), {
          type: "notice",
          notice: { kind: "newDay", day: this.state.day },
          at: this.deps.clock.now(),
        });
      }
      this.takeSnapshotInternal("day");
    }
    if (plan.commands.some((c) => c.kind === "resetTown")) {
      await this.resetInternal({ reason: "tournament" });
    }
    return result.daysRun;
  }

  /** Arms the timer for the next boundary. Call after start-up and after the schedule changes. */
  armTimer(): void {
    this.cancelTimer?.();
    this.cancelTimer = null;
    if (this.closed) return;
    const now = this.deps.clock.now();
    const delay = Math.max(1, this.schedule.nextBoundary(now) - now);
    this.cancelTimer = this.deps.clock.setTimeout(async () => {
      this.cancelTimer = null;
      try {
        await this.catchUp();
      } catch (error) {
        this.deps.log.error({ err: error, townId: this.row.id }, "scheduled maintenance failed");
      }
      this.armTimer();
    }, delay);
  }

  // ----------------------------------------------------------- operations

  /**
   * Replaces the state with a fresh town (the tournament ended, or the sysop
   * asked). Players are removed, accounts stay. The old state is snapshotted.
   */
  reset(options: { seed?: number; clearDeeds?: boolean }): Promise<void> {
    return this.enqueue(() => this.resetInternal({ reason: "admin", ...options }));
  }

  private async resetInternal(options: {
    reason: string;
    seed?: number;
    clearDeeds?: boolean;
  }): Promise<void> {
    const now = this.deps.clock.now();
    this.takeSnapshotInternal(`pre-reset:${options.reason}`);
    const old = this.state;
    const made = createTown(
      {
        seed: options.seed ?? randomInt(0, 2 ** 32),
        settings: old.settings,
        serverNews: old.serverNews,
      },
      this.ctx(),
    );
    const town: TownState = { ...made.town, deeds: options.clearDeeds ? [] : old.deeds };
    this.deps.hub.broadcast(this.row.id, {
      type: "notice",
      notice: { kind: "sessionEnded", reason: "townReset" },
      at: now,
    });
    await this.replaceState(town, "town:reset", {
      reason: options.reason,
      seed: town.seed,
      clearDeeds: options.clearDeeds === true,
    });
    this.deps.hub.closeTown(this.row.id, 4000, "town reset");
    this.deps.parlors.unlinkTown(this.row.id);
    this.deps.moderation.chat.clearTown(this.row.id);
    this.activeAt.clear();
    this.deps.log.info({ townId: this.row.id, reason: options.reason }, "town reset");
  }

  /** Restores a stored snapshot. Players who joined after it lose their parlor link. */
  rollback(snapshotId: number): Promise<boolean> {
    return this.enqueue(async () => {
      const json = this.deps.towns.getSnapshotState(this.row.id, snapshotId);
      if (json === undefined) return false;
      this.takeSnapshotInternal("pre-rollback");
      const town = JSON.parse(json) as TownState;
      this.deps.hub.broadcast(this.row.id, {
        type: "notice",
        notice: { kind: "sessionEnded", reason: "rollback" },
        at: this.deps.clock.now(),
      });
      await this.replaceState(town, "town:rollback", { snapshotId });
      this.deps.hub.closeTown(this.row.id, 4000, "town rolled back");
      for (const link of this.deps.parlors.forTown(this.row.id)) {
        const p = this.state.players[link.player_id];
        const owner = this.deps.db
          .prepare("SELECT login FROM accounts WHERE id = ?")
          .get(link.account_id) as { login: string } | undefined;
        if (!p?.active || !owner || p.logon.toLowerCase() !== owner.login.toLowerCase()) {
          this.deps.parlors.unlinkPlayer(this.row.id, link.player_id);
        }
      }
      this.deps.moderation.chat.clearTown(this.row.id);
      await this.syncBlocksInQueue();
      return true;
    });
  }

  /** Saves a whole new state without engine effects (reset, rollback, admin edits). */
  private async replaceState(
    town: TownState,
    kind: string,
    data: unknown,
    accountId?: number,
  ): Promise<void> {
    await this.commit({
      kind,
      town,
      effects: [],
      actorId: null,
      data,
      ...(accountId !== undefined ? { accountId } : {}),
      lastBoundary: this.schedule.currentBoundary(this.deps.clock.now()),
    });
  }

  /**
   * An operator edit: `edit` receives a deep copy of the town to change. The
   * result is saved and audited like any step.
   */
  mutate(
    kind: string,
    edit: (draft: TownState) => unknown,
    options: { endSessionsOf?: number[] } = {},
  ): Promise<unknown> {
    return this.enqueue(async () => {
      const draft = JSON.parse(this.stateJson) as TownState;
      const data = edit(draft);
      await this.commit({ kind, town: draft, effects: [], actorId: null, data });
      for (const id of options.endSessionsOf ?? []) {
        this.deps.hub.closePlayer(this.row.id, id, 4000, "edited");
      }
      return data;
    });
  }

  /**
   * An operator change made with one of the engine's pure functions (`removePlayerText`,
   * `renamePlayer`): `edit` gets the current town and the engine context and returns the new town
   * and what to record. Saved and audited like any step.
   */
  transform<T>(
    kind: string,
    edit: (town: TownState, ctx: EngineContext) => { town: TownState; data: T },
    options: { playerId?: number } = {},
  ): Promise<T> {
    return this.enqueue(async () => {
      const out = edit(this.state, this.ctx());
      await this.commit({
        kind,
        town: out.town,
        effects: [],
        actorId: null,
        data: out.data,
        ...(options.playerId !== undefined ? { playerId: options.playerId } : {}),
      });
      return out.data;
    });
  }

  /**
   * Deletes a parlor and takes its text out of the town: the session ends, the engine's
   * `removePlayerText` and `renamePlayer` run, the remaining mentions are swept, the slot is
   * deactivated and unlinked, and every rollback snapshot that holds the player is cleaned the
   * same way. See `moderation/erase.ts` for why the slot is deleted and not kept.
   */
  eraseParlor(
    playerId: number,
    history: NameHistory,
  ): Promise<{ letters: number; announcements: number; quotes: number; fortunes: number } | null> {
    return this.enqueue(async () => {
      const player = this.state.players[playerId];
      if (!player) return null;
      const login = player.logon;
      if (this.state.sessions[String(playerId)]) {
        await this.leaveInternal(playerId, "deleted", "parlor-erased");
      }
      const erased = eraseParlorFrom(this.state, playerId, this.ctx(), history);
      await this.commit({
        kind: "parlor:erased",
        town: erased.town,
        effects: [],
        actorId: null,
        playerId,
        data: erased.removed,
        unlinkPlayers: [playerId],
      });
      this.deps.hub.closePlayer(this.row.id, playerId, 4000, "deleted");
      this.activeAt.delete(playerId);
      // Rollback points that still hold the player.
      for (const snap of this.deps.towns.allSnapshotStates(this.row.id)) {
        const old = JSON.parse(snap.state_json) as TownState;
        const slot = old.players.find((p) => p.logon.toLowerCase() === login.toLowerCase());
        if (!slot) continue;
        const cleaned = eraseParlorFrom(old, slot.id, this.ctx(), history);
        this.deps.towns.replaceSnapshotState(snap.id, JSON.stringify(cleaned.town));
      }
      return erased.removed;
    });
  }

  /** Changes the town's own configuration (not the engine's Game Settings). */
  configure(change: {
    name?: string;
    timeZone?: string;
    dayLengthMs?: number | null;
    contentPack?: string;
  }): Promise<void> {
    return this.enqueue(async () => {
      // Run days owed under the old schedule first, so a change never skips or repeats one.
      await this.catchUpInQueue();
      const now = this.deps.clock.now();
      const next = {
        name: change.name ?? this.row.name,
        contentPack: change.contentPack ?? this.row.content_pack,
        timeZone: change.timeZone ?? this.row.time_zone,
        dayLengthMs: change.dayLengthMs === undefined ? this.row.day_length_ms : change.dayLengthMs,
        epoch: this.row.epoch,
      };
      const scheduleChanged =
        next.timeZone !== this.row.time_zone || next.dayLengthMs !== this.row.day_length_ms;
      if (scheduleChanged) next.epoch = now;
      if (next.contentPack !== this.row.content_pack) {
        this.baseCtx = this.ruleset.context(
          this.deps.content.load(next.contentPack),
          this.ruleOverrides,
        );
      }
      const schedule = createSchedule({
        timeZone: next.timeZone,
        dayLengthMs: next.dayLengthMs,
        epoch: next.epoch,
      });
      const lastBoundary = scheduleChanged ? schedule.currentBoundary(now) : this.row.last_boundary;
      transaction(this.deps.db, () => {
        this.deps.towns.saveMeta(this.row.id, { ...next, at: now });
        if (scheduleChanged) {
          this.deps.towns.saveState(this.row.id, {
            stateJson: this.stateJson,
            revision: this.row.revision,
            lastBoundary,
            at: now,
          });
        }
        this.deps.audit.append({
          at: now,
          townId: this.row.id,
          kind: "town:configure",
          data: change,
        });
      });
      this.row = {
        ...this.row,
        name: next.name,
        content_pack: next.contentPack,
        time_zone: next.timeZone,
        day_length_ms: next.dayLengthMs,
        epoch: next.epoch,
        last_boundary: lastBoundary,
      };
      this.schedule = schedule;
      this.armTimer();
    });
  }

  /**
   * Replaces the town's Expanded rule overrides. The caller has checked them (`checkTownSetup`).
   * Applies at once: the next step uses the new numbers.
   */
  setRuleOverrides(overrides: RuleOverrides): Promise<void> {
    return this.enqueue(async () => {
      const now = this.deps.clock.now();
      const json = JSON.stringify(overrides);
      transaction(this.deps.db, () => {
        this.deps.towns.saveRuleOverrides(this.row.id, json, now);
        this.deps.audit.append({
          at: now,
          townId: this.row.id,
          kind: "town:rules",
          data: { overrides },
        });
      });
      this.row = { ...this.row, rule_overrides: json, updated_at: now };
      this.baseCtx = this.ruleset.context(this.deps.content.load(this.row.content_pack), overrides);
    });
  }

  // ------------------------------------------------------------ snapshots

  takeSnapshot(reason: string): Promise<number> {
    return this.enqueue(() => this.takeSnapshotInternal(reason));
  }

  private takeSnapshotInternal(reason: string): number {
    const id = this.deps.towns.addSnapshot(this.row.id, {
      at: this.deps.clock.now(),
      day: this.state.day,
      revision: this.row.revision,
      reason,
      stateJson: this.stateJson,
    });
    this.deps.towns.pruneSnapshots(this.row.id, this.deps.snapshotKeep);
    this.lastSnapshotRevision = this.row.revision;
    return id;
  }

  /** Snapshots if anything changed since the last one. */
  snapshotIfDirty(reason: string): Promise<boolean> {
    return this.enqueue(() => {
      if (this.row.revision === this.lastSnapshotRevision) return false;
      this.takeSnapshotInternal(reason);
      return true;
    });
  }

  // --------------------------------------------------------------- commit

  /**
   * Persists a new state with its audit rows in one transaction; only then
   * does it become the current state, and only then does anyone hear about it.
   */
  private async commit(c: Commit): Promise<EffectPlan> {
    const now = this.deps.clock.now();
    const plan = planEffects(c.effects, c.town, now, c.endReason ? { endReason: c.endReason } : {});
    // A museum client's cafe talk arrives as effects alone, so any museum change that speaks to the
    // cafe is treated the same way.
    if (c.redact || (c.external && c.effects.some((e) => e.kind === "chat"))) {
      // `/me` and `/yell` text rides on log and broadcast effects; keep neither.
      plan.logs = [];
      plan.audit = plan.audit.map((e) =>
        typeof e.data === "object" && e.data !== null && "text" in e.data
          ? { ...e, data: { ...e.data, text: "[cafe talk is not stored]" } }
          : e,
      );
    }

    // Presence is part of the saved state, so settle it before serialising.
    let town = c.town;
    for (const command of plan.commands) {
      if (command.kind === "clearPresence") town = reportPresence(town, command.playerId, false);
    }
    if (c.connectActor && c.actorId !== null && town.sessions[String(c.actorId)]) {
      town = reportPresence(town, c.actorId, true);
    }
    for (const id of c.connectPlayers ?? []) {
      if (town.sessions[String(id)]) town = reportPresence(town, id, true);
    }

    const json = JSON.stringify(town);
    const revision = this.row.revision + 1;
    const lastBoundary = c.lastBoundary ?? this.row.last_boundary;
    transaction(this.deps.db, () => {
      this.deps.towns.saveState(this.row.id, { stateJson: json, revision, lastBoundary, at: now });
      if (c.linkParlor) {
        this.deps.parlors.link(c.linkParlor.accountId, this.row.id, c.linkParlor.playerId, now);
      }
      for (const season of c.seasons ?? []) {
        const hallRow = this.deps.hall.add(season);
        // Remember whose names are in the record, for an account that is later deleted.
        const owners: { accountId: number; name: string; parlor: string }[] = [];
        for (const link of this.deps.parlors.forTown(this.row.id)) {
          const p = this.state.players[link.player_id];
          if (p?.active)
            owners.push({ accountId: link.account_id, name: p.name, parlor: p.parlor });
        }
        this.deps.hall.addOwners(hallRow.id, owners);
      }
      for (const playerId of c.unlinkPlayers ?? []) {
        this.deps.parlors.unlinkPlayer(this.row.id, playerId);
      }
      for (const command of plan.commands) {
        if (command.kind === "unlinkParlor") {
          this.deps.parlors.unlinkPlayer(this.row.id, command.playerId);
        } else if (command.kind === "unlinkAllParlors") {
          this.deps.parlors.unlinkTown(this.row.id);
        }
      }
      if (c.quiet) return;
      const base = {
        at: now,
        townId: this.row.id,
        accountId: c.accountId ?? null,
        playerId: c.playerId ?? null,
      };
      this.deps.audit.append({ ...base, kind: c.kind, data: c.data ?? null });
      for (const entry of plan.audit) this.deps.audit.append({ ...base, ...entry });
    });

    const before = this.state;
    this.state = town;
    this.stateJson = json;
    this.row = { ...this.row, revision, last_boundary: lastBoundary, updated_at: now };

    for (const line of plan.logs) this.deps.log[line.level]({ townId: this.row.id }, line.text);
    // A cafe line never reaches a player who blocked whoever caused it, whatever the engine
    // computed (the account's block is the truth; the engine's list can lag a moment behind it).
    const sender = c.actorId ?? c.playerId ?? null;
    const visibleTo = this.visibilityFor(sender);
    this.deliver(this.screenChat(plan.pushes, sender, visibleTo), town);
    this.deliver(diffPushes(before, town, c.actorId, now), town);
    if (!c.external) {
      for (const observer of [...this.observers]) {
        try {
          observer(c.effects, town, visibleTo);
        } catch (error) {
          this.deps.log.error({ err: error, townId: this.row.id }, "effect observer failed");
        }
      }
    }
    for (const command of plan.commands) {
      if (command.kind === "closePlayer") {
        this.deps.hub.closePlayer(this.row.id, command.playerId, 4000, command.reason);
      } else if (command.kind === "unlinkAllParlors") {
        this.deps.hub.closeTown(this.row.id, 4000, "town reset");
        this.activeAt.clear();
      }
    }
    return plan;
  }

  /** Whether a line caused by `sender` may reach `playerId`: not if that player blocked the sender's account. */
  private visibilityFor(sender: number | null): (playerId: number) => boolean {
    if (sender === null) return () => true;
    const mod = this.deps.moderation;
    const senderAccount = mod.accountOfPlayer(this.row.id, sender);
    if (senderAccount === null) return () => true;
    return (playerId) => {
      const account = mod.accountOfPlayer(this.row.id, playerId);
      return account === null || !mod.isBlocking(account, senderAccount);
    };
  }

  /** Drops blocked recipients from cafe lines and remembers what was delivered for reports. */
  private screenChat(
    pushes: Outbound[],
    sender: number | null,
    visibleTo: (playerId: number) => boolean,
  ): Outbound[] {
    const mod = this.deps.moderation;
    const out: Outbound[] = [];
    for (const push of pushes) {
      const message = push.message;
      if (message.type !== "notice" || message.notice.kind !== "chat") {
        out.push(push);
        continue;
      }
      // Expanded names the speaker of every spoken line as data (`ChatLine.from`); a line without
      // one is the room's own (an arrival, the TV, a notice), said by nobody. Classic lines carry
      // no speaker (its transcripts are locked), so there it is whoever the change was for.
      const speaker = message.notice.from
        ? message.notice.from.playerId
        : this.state.ruleset === "expanded"
          ? null
          : sender;
      const senderAccount = speaker === null ? null : mod.accountOfPlayer(this.row.id, speaker);
      const senderName =
        message.notice.from?.name ??
        (speaker === null ? null : (this.state.players[speaker]?.name ?? null));
      const r = push.recipient;
      const ids = r.to === "players" ? r.playerIds : r.to === "player" ? [r.playerId] : [];
      const kept = ids.filter(visibleTo);
      mod.recordChat(
        this.row.id,
        { playerId: speaker, accountId: senderAccount, name: senderName },
        richTextToPlain(message.notice.text),
        sender === null ? kept : [...kept, sender],
      );
      if (kept.length === 0) continue;
      out.push({ ...push, recipient: { to: "players", playerIds: kept } });
    }
    return out;
  }

  private deliver(pushes: Outbound[], _town: TownState): void {
    for (const push of pushes) {
      const r = push.recipient;
      if (r.to === "player") this.deps.hub.sendTo(this.row.id, r.playerId, push.message);
      else if (r.to === "players") {
        for (const id of r.playerIds) this.deps.hub.sendTo(this.row.id, id, push.message);
      } else this.deps.hub.broadcast(this.row.id, push.message);
    }
  }

  /** A player's first socket opened or last one closed. */
  connectionChanged(playerId: number, connected: boolean): Promise<void> {
    return this.enqueue(async () => {
      if (!this.state.sessions[String(playerId)]) return;
      const next = reportPresence(this.state, playerId, connected);
      if (next === this.state) return;
      await this.commit({
        kind: "presence",
        town: next,
        effects: [],
        actorId: playerId,
        playerId,
        quiet: true,
      });
    });
  }

  // ------------------------------------------------------------ shutdown

  /** Stops timers and waits for queued work to finish. */
  async close(): Promise<void> {
    this.closed = true;
    this.cancelTimer?.();
    this.cancelTimer = null;
    await this.queue.drain();
  }

  /** Public read of one player, for the admin API. */
  player(playerId: number): PlayerState | undefined {
    return this.state.players[playerId];
  }

  isOnline(playerId: number): boolean {
    return this.state.sessions[String(playerId)] !== undefined;
  }

  /** Broadcast of a sysop message to everyone connected. */
  announce(text: RichText): void {
    this.deps.hub.broadcast(this.row.id, notice({ kind: "server", text }, this.deps.clock.now()));
  }
}
