import type { SQLInputValue, StatementSync } from "node:sqlite";
import { type Db, transaction } from "./database.js";

/** Small typed wrappers over the SQL, so no query text lives outside this file. */

export class Statements {
  private cache = new Map<string, StatementSync>();
  constructor(private readonly db: Db) {}

  get(sql: string): StatementSync {
    let s = this.cache.get(sql);
    if (!s) {
      s = this.db.prepare(sql);
      this.cache.set(sql, s);
    }
    return s;
  }
}

export function all<T>(s: StatementSync, ...params: SQLInputValue[]): T[] {
  return s.all(...params) as unknown as T[];
}

export function one<T>(s: StatementSync, ...params: SQLInputValue[]): T | undefined {
  return s.get(...params) as unknown as T | undefined;
}

// ---------------------------------------------------------------- towns

export interface TownRow {
  id: string;
  name: string;
  ruleset: string;
  content_pack: string;
  time_zone: string;
  day_length_ms: number | null;
  epoch: number;
  last_boundary: number;
  revision: number;
  state_json: string;
  /** JSON object of Expanded rule overrides (dotted path to number); `{}` for none. */
  rule_overrides: string;
  created_at: number;
  updated_at: number;
}

export interface SnapshotRow {
  id: number;
  town_id: string;
  taken_at: number;
  day: number;
  revision: number;
  reason: string;
}

export class TownStore {
  private readonly sql: Statements;
  constructor(db: Db) {
    this.sql = new Statements(db);
  }

  list(): TownRow[] {
    return all<TownRow>(this.sql.get("SELECT * FROM towns ORDER BY created_at, id"));
  }

  get(id: string): TownRow | undefined {
    return one<TownRow>(this.sql.get("SELECT * FROM towns WHERE id = ?"), id);
  }

  insert(row: TownRow): void {
    this.sql
      .get(
        `INSERT INTO towns (id, name, ruleset, content_pack, time_zone, day_length_ms, epoch,
           last_boundary, revision, state_json, rule_overrides, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id,
        row.name,
        row.ruleset,
        row.content_pack,
        row.time_zone,
        row.day_length_ms,
        row.epoch,
        row.last_boundary,
        row.revision,
        row.state_json,
        row.rule_overrides,
        row.created_at,
        row.updated_at,
      );
  }

  saveRuleOverrides(id: string, overrides: string, at: number): void {
    this.sql
      .get("UPDATE towns SET rule_overrides = ?, updated_at = ? WHERE id = ?")
      .run(overrides, at, id);
  }

  saveState(
    id: string,
    state: { stateJson: string; revision: number; lastBoundary: number; at: number },
  ): void {
    this.sql
      .get(
        "UPDATE towns SET state_json = ?, revision = ?, last_boundary = ?, updated_at = ? WHERE id = ?",
      )
      .run(state.stateJson, state.revision, state.lastBoundary, state.at, id);
  }

  saveMeta(
    id: string,
    meta: {
      name: string;
      contentPack: string;
      timeZone: string;
      dayLengthMs: number | null;
      epoch: number;
      at: number;
    },
  ): void {
    this.sql
      .get(
        `UPDATE towns SET name = ?, content_pack = ?, time_zone = ?, day_length_ms = ?, epoch = ?,
           updated_at = ? WHERE id = ?`,
      )
      .run(meta.name, meta.contentPack, meta.timeZone, meta.dayLengthMs, meta.epoch, meta.at, id);
  }

  delete(id: string): void {
    this.sql.get("DELETE FROM towns WHERE id = ?").run(id);
  }

  addSnapshot(
    townId: string,
    snap: { at: number; day: number; revision: number; reason: string; stateJson: string },
  ): number {
    const r = this.sql
      .get(
        `INSERT INTO town_snapshots (town_id, taken_at, day, revision, reason, state_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(townId, snap.at, snap.day, snap.revision, snap.reason, snap.stateJson);
    return Number(r.lastInsertRowid);
  }

  listSnapshots(townId: string): SnapshotRow[] {
    return all<SnapshotRow>(
      this.sql.get(
        `SELECT id, town_id, taken_at, day, revision, reason FROM town_snapshots
         WHERE town_id = ? ORDER BY id DESC`,
      ),
      townId,
    );
  }

  getSnapshotState(townId: string, snapshotId: number): string | undefined {
    const row = one<{ state_json: string }>(
      this.sql.get("SELECT state_json FROM town_snapshots WHERE town_id = ? AND id = ?"),
      townId,
      snapshotId,
    );
    return row?.state_json;
  }

  /** Every snapshot of a town with its state, for an account deletion that must reach them all. */
  allSnapshotStates(townId: string): { id: number; state_json: string }[] {
    return all<{ id: number; state_json: string }>(
      this.sql.get("SELECT id, state_json FROM town_snapshots WHERE town_id = ? ORDER BY id"),
      townId,
    );
  }

  replaceSnapshotState(snapshotId: number, stateJson: string): void {
    this.sql
      .get("UPDATE town_snapshots SET state_json = ? WHERE id = ?")
      .run(stateJson, snapshotId);
  }

  pruneSnapshots(townId: string, keep: number): void {
    this.sql
      .get(
        `DELETE FROM town_snapshots WHERE town_id = ? AND id NOT IN (
           SELECT id FROM town_snapshots WHERE town_id = ? ORDER BY id DESC LIMIT ?)`,
      )
      .run(townId, townId, keep);
  }
}

// -------------------------------------------------------------- parlors

export interface ParlorRow {
  account_id: number;
  town_id: string;
  player_id: number;
  created_at: number;
}

/** Which account owns which player slot in which town. */
export class ParlorStore {
  private readonly sql: Statements;
  constructor(db: Db) {
    this.sql = new Statements(db);
  }

  forAccount(accountId: number): ParlorRow[] {
    return all<ParlorRow>(
      this.sql.get("SELECT * FROM parlors WHERE account_id = ? ORDER BY town_id"),
      accountId,
    );
  }

  find(accountId: number, townId: string): ParlorRow | undefined {
    return one<ParlorRow>(
      this.sql.get("SELECT * FROM parlors WHERE account_id = ? AND town_id = ?"),
      accountId,
      townId,
    );
  }

  byPlayer(townId: string, playerId: number): ParlorRow | undefined {
    return one<ParlorRow>(
      this.sql.get("SELECT * FROM parlors WHERE town_id = ? AND player_id = ?"),
      townId,
      playerId,
    );
  }

  forTown(townId: string): ParlorRow[] {
    return all<ParlorRow>(this.sql.get("SELECT * FROM parlors WHERE town_id = ?"), townId);
  }

  /** Links an account to a slot. A stale link on the slot (a reused slot) is dropped first. */
  link(accountId: number, townId: string, playerId: number, at: number): void {
    this.unlinkPlayer(townId, playerId);
    this.sql
      .get("INSERT INTO parlors (account_id, town_id, player_id, created_at) VALUES (?, ?, ?, ?)")
      .run(accountId, townId, playerId, at);
  }

  unlinkPlayer(townId: string, playerId: number): void {
    this.sql.get("DELETE FROM parlors WHERE town_id = ? AND player_id = ?").run(townId, playerId);
  }

  unlinkTown(townId: string): void {
    this.sql.get("DELETE FROM parlors WHERE town_id = ?").run(townId);
  }
}

// --------------------------------------------------------------- audit

export interface AuditEntry {
  at: number;
  townId?: string | null;
  accountId?: number | null;
  playerId?: number | null;
  kind: string;
  data: unknown;
}

export interface AuditRow {
  id: number;
  at: number;
  townId: string | null;
  accountId: number | null;
  playerId: number | null;
  kind: string;
  data: unknown;
}

export interface AuditQuery {
  townId?: string;
  accountId?: number;
  playerId?: number;
  /** Matches the start of the kind, so "admin" finds "admin:kick". */
  kind?: string;
  /** Only rows with an id below this (paging backwards). */
  before?: number;
  limit: number;
}

/** The append-only audit log. Triggers in the schema refuse updates and deletes. */
export class AuditStore {
  private readonly sql: Statements;
  constructor(private readonly db: Db) {
    this.sql = new Statements(db);
  }

  /**
   * Retention: deletes up to `limit` rows older than `before` (ms). This is the only way rows
   * leave the log; the schema's trigger refuses any delete outside the window opened here.
   */
  prune(before: number, limit: number): number {
    return transaction(this.db, () => {
      this.sql.get("UPDATE audit_prune_window SET cutoff = ? WHERE id = 1").run(before);
      const r = this.sql
        .get(
          "DELETE FROM audit_log WHERE id IN (SELECT id FROM audit_log WHERE at < ? ORDER BY id LIMIT ?)",
        )
        .run(before, limit);
      this.sql.get("UPDATE audit_prune_window SET cutoff = 0 WHERE id = 1").run();
      return Number(r.changes);
    });
  }

  /**
   * Account erasure: deletes every row of the account except the kinds that start with one of
   * `keep` (moderation records and the deletion note). Opens the same window as the retention job.
   */
  eraseAccount(accountId: number, keep: readonly string[]): number {
    return transaction(this.db, () => {
      this.sql
        .get("UPDATE audit_prune_window SET cutoff = ? WHERE id = 1")
        .run(Number.MAX_SAFE_INTEGER);
      const clauses = keep.map(() => "substr(kind, 1, ?) = ?").join(" OR ");
      const params: SQLInputValue[] = [accountId];
      for (const k of keep) params.push(k.length, k);
      const r = this.db
        .prepare(
          `DELETE FROM audit_log WHERE account_id = ? ${clauses ? `AND NOT (${clauses})` : ""}`,
        )
        .run(...params);
      this.sql.get("UPDATE audit_prune_window SET cutoff = 0 WHERE id = 1").run();
      return Number(r.changes);
    });
  }

  /** Recent `action` rows of a town whose action carries typed text, newest first (author lookups). */
  recentTyped(townId: string, limit: number): AuditRow[] {
    return all<{
      id: number;
      at: number;
      town_id: string | null;
      account_id: number | null;
      player_id: number | null;
      kind: string;
      data: string;
    }>(
      this.sql.get(
        `SELECT id, at, town_id, account_id, player_id, kind, data FROM audit_log
         WHERE town_id = ? AND kind = 'action' AND data LIKE '%"text":%' ORDER BY id DESC LIMIT ?`,
      ),
      townId,
      limit,
    ).map((r) => ({
      id: r.id,
      at: r.at,
      townId: r.town_id,
      accountId: r.account_id,
      playerId: r.player_id,
      kind: r.kind,
      data: JSON.parse(r.data) as unknown,
    }));
  }

  append(entry: AuditEntry): void {
    this.sql
      .get(
        "INSERT INTO audit_log (at, town_id, account_id, player_id, kind, data) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        entry.at,
        entry.townId ?? null,
        entry.accountId ?? null,
        entry.playerId ?? null,
        entry.kind,
        JSON.stringify(entry.data ?? null),
      );
  }

  query(q: AuditQuery): AuditRow[] {
    const where: string[] = [];
    const params: SQLInputValue[] = [];
    if (q.townId !== undefined) {
      where.push("town_id = ?");
      params.push(q.townId);
    }
    if (q.accountId !== undefined) {
      where.push("account_id = ?");
      params.push(q.accountId);
    }
    if (q.playerId !== undefined) {
      where.push("player_id = ?");
      params.push(q.playerId);
    }
    if (q.kind !== undefined) {
      where.push("substr(kind, 1, ?) = ?");
      params.push(q.kind.length, q.kind);
    }
    if (q.before !== undefined) {
      where.push("id < ?");
      params.push(q.before);
    }
    params.push(q.limit);
    const sql = `SELECT id, at, town_id, account_id, player_id, kind, data FROM audit_log
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY id DESC LIMIT ?`;
    return all<{
      id: number;
      at: number;
      town_id: string | null;
      account_id: number | null;
      player_id: number | null;
      kind: string;
      data: string;
    }>(this.sql.get(sql), ...params).map((r) => ({
      id: r.id,
      at: r.at,
      townId: r.town_id,
      accountId: r.account_id,
      playerId: r.player_id,
      kind: r.kind,
      data: JSON.parse(r.data) as unknown,
    }));
  }
}

// ------------------------------------------------------------- IP bans

export interface IpBanRow {
  id: number;
  prefix: string;
  reason: string;
  created_at: number;
  expires_at: number | null;
}

export class IpBanStore {
  private readonly sql: Statements;
  constructor(db: Db) {
    this.sql = new Statements(db);
  }

  list(): IpBanRow[] {
    return all<IpBanRow>(this.sql.get("SELECT * FROM ip_bans ORDER BY id"));
  }

  add(prefix: string, reason: string, at: number, expiresAt: number | null): number {
    const r = this.sql
      .get("INSERT INTO ip_bans (prefix, reason, created_at, expires_at) VALUES (?, ?, ?, ?)")
      .run(prefix, reason, at, expiresAt);
    return Number(r.lastInsertRowid);
  }

  remove(id: number): boolean {
    return Number(this.sql.get("DELETE FROM ip_bans WHERE id = ?").run(id).changes) > 0;
  }
}

// ------------------------------------------------------- server secrets

/** Named secrets generated on first use and kept for the life of the database. */
export class SecretStore {
  private readonly sql: Statements;
  constructor(db: Db) {
    this.sql = new Statements(db);
  }

  /** The secret called `name`; `make` creates it the first time. */
  getOrCreate(name: string, make: () => string): string {
    const row = one<{ value: string }>(
      this.sql.get("SELECT value FROM server_secrets WHERE name = ?"),
      name,
    );
    if (row) return row.value;
    const value = make();
    this.sql.get("INSERT INTO server_secrets (name, value) VALUES (?, ?)").run(name, value);
    return value;
  }
}

// -------------------------------------------------------- hall of fame

export interface HallRow {
  id: number;
  town_id: string;
  town_name: string;
  ruleset: string;
  season: number;
  ended_at: number;
  days: number;
  winner_name: string | null;
  winner_parlor: string | null;
  winner_bp: number | null;
  entry_json: string;
}

export interface NewHallRow {
  townId: string;
  townName: string;
  ruleset: string;
  endedAt: number;
  days: number;
  winner: { name: string; parlor: string; bp: number } | null;
  /** The public body of the entry, without `id` and `season` (the store assigns the season). */
  entry: Record<string, unknown>;
}

/** The server-side archive of finished seasons. */
export class HallStore {
  private readonly sql: Statements;
  constructor(db: Db) {
    this.sql = new Statements(db);
  }

  /** Writes a finished season and returns its row. Seasons count up per town from 1. */
  add(row: NewHallRow): HallRow {
    const top = one<{ season: number | null }>(
      this.sql.get("SELECT MAX(season) AS season FROM hall_of_fame WHERE town_id = ?"),
      row.townId,
    );
    const season = (top?.season ?? 0) + 1;
    const body = { ...row.entry, season };
    const r = this.sql
      .get(
        `INSERT INTO hall_of_fame (town_id, town_name, ruleset, season, ended_at, days, winner_name,
           winner_parlor, winner_bp, entry_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.townId,
        row.townName,
        row.ruleset,
        season,
        row.endedAt,
        row.days,
        row.winner?.name ?? null,
        row.winner?.parlor ?? null,
        row.winner?.bp ?? null,
        JSON.stringify(body),
      );
    return {
      id: Number(r.lastInsertRowid),
      town_id: row.townId,
      town_name: row.townName,
      ruleset: row.ruleset,
      season,
      ended_at: row.endedAt,
      days: row.days,
      winner_name: row.winner?.name ?? null,
      winner_parlor: row.winner?.parlor ?? null,
      winner_bp: row.winner?.bp ?? null,
      entry_json: JSON.stringify(body),
    };
  }

  /** Remembers which account held each name in a finished season (never shown to anyone). */
  addOwners(
    hallId: number,
    owners: readonly { accountId: number; name: string; parlor: string }[],
  ): void {
    const insert = this.sql.get(
      "INSERT INTO hall_owners (hall_id, account_id, name, parlor) VALUES (?, ?, ?, ?)",
    );
    for (const o of owners) insert.run(hallId, o.accountId, o.name, o.parlor);
  }

  ownedBy(accountId: number): { hall_id: number; name: string; parlor: string }[] {
    return all<{ hall_id: number; name: string; parlor: string }>(
      this.sql.get("SELECT hall_id, name, parlor FROM hall_owners WHERE account_id = ?"),
      accountId,
    );
  }

  forgetOwner(accountId: number): void {
    this.sql.get("DELETE FROM hall_owners WHERE account_id = ?").run(accountId);
  }

  get(id: number): HallRow | undefined {
    return one<HallRow>(this.sql.get("SELECT * FROM hall_of_fame WHERE id = ?"), id);
  }

  /** Every entry of a town, for the best-effort scrub of seasons recorded before owners were kept. */
  forTown(townId: string): HallRow[] {
    return all<HallRow>(this.sql.get("SELECT * FROM hall_of_fame WHERE town_id = ?"), townId);
  }

  /** Rewrites an entry after a name was taken out of it. */
  rewrite(
    id: number,
    row: { winnerName: string | null; winnerParlor: string | null; entryJson: string },
  ): void {
    this.sql
      .get(
        "UPDATE hall_of_fame SET winner_name = ?, winner_parlor = ?, entry_json = ? WHERE id = ?",
      )
      .run(row.winnerName, row.winnerParlor, row.entryJson, id);
  }

  /** How many seasons this town has finished. */
  seasonsFinished(townId: string): number {
    const row = one<{ n: number }>(
      this.sql.get("SELECT COUNT(*) AS n FROM hall_of_fame WHERE town_id = ?"),
      townId,
    );
    return row?.n ?? 0;
  }

  /** Newest first. `before` pages backwards by row id. */
  list(q: { townId?: string; before?: number; limit: number }): HallRow[] {
    const where: string[] = [];
    const params: SQLInputValue[] = [];
    if (q.townId !== undefined) {
      where.push("town_id = ?");
      params.push(q.townId);
    }
    if (q.before !== undefined) {
      where.push("id < ?");
      params.push(q.before);
    }
    params.push(q.limit);
    return all<HallRow>(
      this.sql.get(
        `SELECT * FROM hall_of_fame ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
         ORDER BY id DESC LIMIT ?`,
      ),
      ...params,
    );
  }
}

// ------------------------------------------------------ daily challenge

export interface ChallengeRunRow {
  day: string;
  account_id: number;
  guest: number;
  status: "playing" | "finished";
  abandoned: number;
  name: string;
  parlor: string;
  started_at: number;
  updated_at: number;
  finished_at: number | null;
  score: number;
  money: number;
  sales: number;
  exact: number;
  walkouts: number;
  state_json: string;
}

export interface ChallengeScore {
  score: number;
  money: number;
  sales: number;
  exact: number;
  walkouts: number;
}

export type ChallengeBoardRow = Pick<
  ChallengeRunRow,
  "account_id" | "name" | "parlor" | "score" | "money" | "sales" | "exact" | "walkouts"
>;

export class ChallengeStore {
  private readonly sql: Statements;
  constructor(db: Db) {
    this.sql = new Statements(db);
  }

  find(day: string, accountId: number): ChallengeRunRow | undefined {
    return one<ChallengeRunRow>(
      this.sql.get("SELECT * FROM challenge_runs WHERE day = ? AND account_id = ?"),
      day,
      accountId,
    );
  }

  insert(row: ChallengeRunRow): void {
    this.sql
      .get(
        `INSERT INTO challenge_runs (day, account_id, guest, status, abandoned, name, parlor,
           started_at, updated_at, finished_at, score, money, sales, exact, walkouts, state_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.day,
        row.account_id,
        row.guest,
        row.status,
        row.abandoned,
        row.name,
        row.parlor,
        row.started_at,
        row.updated_at,
        row.finished_at,
        row.score,
        row.money,
        row.sales,
        row.exact,
        row.walkouts,
        row.state_json,
      );
  }

  /** A step in a run that is still being played: new state and the running score. */
  saveState(day: string, accountId: number, stateJson: string, at: number): void {
    this.sql
      .get(
        "UPDATE challenge_runs SET state_json = ?, updated_at = ? WHERE day = ? AND account_id = ?",
      )
      .run(stateJson, at, day, accountId);
  }

  /** Freezes the run's result. Only a playing run can be finished (the first call wins). */
  finish(
    day: string,
    accountId: number,
    score: ChallengeScore,
    options: { abandoned: boolean; at: number; stateJson: string },
  ): boolean {
    const r = this.sql
      .get(
        `UPDATE challenge_runs SET status = 'finished', abandoned = ?, finished_at = ?, updated_at = ?,
           score = ?, money = ?, sales = ?, exact = ?, walkouts = ?, state_json = ?
         WHERE day = ? AND account_id = ? AND status = 'playing'`,
      )
      .run(
        options.abandoned ? 1 : 0,
        options.at,
        options.at,
        score.score,
        score.money,
        score.sales,
        score.exact,
        score.walkouts,
        options.stateJson,
        day,
        accountId,
      );
    return Number(r.changes) > 0;
  }

  /** Runs still being played whose last step was before `before` (milliseconds). */
  stale(before: number): ChallengeRunRow[] {
    return all<ChallengeRunRow>(
      this.sql.get(
        "SELECT * FROM challenge_runs WHERE status = 'playing' AND updated_at < ? ORDER BY updated_at",
      ),
      before,
    );
  }

  /**
   * Finished runs of registered accounts on `day`, for ranking. The columns the board needs only:
   * a run's saved state is tens of kilobytes and the board is read by anyone, unauthenticated.
   */
  board(day: string): ChallengeBoardRow[] {
    return all<ChallengeBoardRow>(
      this.sql.get(
        `SELECT account_id, name, parlor, score, money, sales, exact, walkouts FROM challenge_runs
         WHERE day = ? AND status = 'finished' AND guest = 0`,
      ),
      day,
    );
  }

  /** Days with at least one finished registered run, newest first, with how many. */
  days(limit: number): { day: string; entries: number }[] {
    return all<{ day: string; entries: number }>(
      this.sql.get(
        `SELECT day, COUNT(*) AS entries FROM challenge_runs
         WHERE status = 'finished' AND guest = 0 GROUP BY day ORDER BY day DESC LIMIT ?`,
      ),
      limit,
    );
  }

  /** How many accounts have played (finished or not) on `day`, guests included. */
  played(day: string): number {
    const row = one<{ n: number }>(
      this.sql.get("SELECT COUNT(*) AS n FROM challenge_runs WHERE day = ?"),
      day,
    );
    return row?.n ?? 0;
  }
}

// ------------------------------------------------------------ activity

/** One day on which an account played in a town (`day` is the UTC date, `YYYY-MM-DD`). */
export interface ActivityDayRow {
  account_id: number;
  town_id: string;
  day: string;
}

/**
 * The activity record behind `GET /admin/stats`: which account played in which town on which UTC
 * day, and nothing more. Written through `ActivityRecorder`, which keeps the hot path to one map
 * lookup per action.
 */
export class ActivityStore {
  private readonly sql: Statements;
  constructor(db: Db) {
    this.sql = new Statements(db);
  }

  /** Records the day; true when the row is new. */
  record(accountId: number, townId: string, day: string): boolean {
    const r = this.sql
      .get("INSERT OR IGNORE INTO activity_days (account_id, town_id, day) VALUES (?, ?, ?)")
      .run(accountId, townId, day);
    return Number(r.changes) > 0;
  }

  forAccount(accountId: number): ActivityDayRow[] {
    return all<ActivityDayRow>(
      this.sql.get("SELECT * FROM activity_days WHERE account_id = ? ORDER BY day, town_id"),
      accountId,
    );
  }

  /** The distinct (account, day) pairs, of one town or of the whole server. */
  accountDays(townId?: string): { account_id: number; day: string }[] {
    return townId === undefined
      ? all<{ account_id: number; day: string }>(
          this.sql.get("SELECT DISTINCT account_id, day FROM activity_days"),
        )
      : all<{ account_id: number; day: string }>(
          this.sql.get("SELECT account_id, day FROM activity_days WHERE town_id = ?"),
          townId,
        );
  }

  eraseAccount(accountId: number): number {
    return Number(
      this.sql.get("DELETE FROM activity_days WHERE account_id = ?").run(accountId).changes,
    );
  }

  /** Retention: deletes the rows of days before `day` (`YYYY-MM-DD`). */
  prune(day: string): number {
    return Number(this.sql.get("DELETE FROM activity_days WHERE day < ?").run(day).changes);
  }
}

// -------------------------------------------------------------- invites

/** One invite code. `code` is stored normalised (upper case, no spaces or dashes). */
export interface InviteRow {
  id: number;
  code: string;
  label: string;
  max_uses: number;
  used: number;
  expires_at: number | null;
  created_at: number;
  revoked_at: number | null;
}

/**
 * Invite codes for a closed beta (`FQ_INVITE_REQUIRED`). A code counts the accounts it made and
 * nothing else: which accounts used it is not recorded.
 */
export class InviteStore {
  private readonly sql: Statements;
  constructor(db: Db) {
    this.sql = new Statements(db);
  }

  /** Adds a code; null when the code already exists (the caller draws another). */
  add(
    code: string,
    label: string,
    maxUses: number,
    expiresAt: number | null,
    at: number,
  ): InviteRow | null {
    const r = this.sql
      .get(
        "INSERT OR IGNORE INTO invites (code, label, max_uses, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(code, label, maxUses, expiresAt, at);
    return Number(r.changes) > 0 ? (this.get(Number(r.lastInsertRowid)) ?? null) : null;
  }

  get(id: number): InviteRow | undefined {
    return one<InviteRow>(this.sql.get("SELECT * FROM invites WHERE id = ?"), id);
  }

  byCode(code: string): InviteRow | undefined {
    return one<InviteRow>(this.sql.get("SELECT * FROM invites WHERE code = ?"), code);
  }

  /** Newest first. */
  list(): InviteRow[] {
    return all<InviteRow>(this.sql.get("SELECT * FROM invites ORDER BY id DESC"));
  }

  /**
   * Takes one use of the code if it is open at `now` (not revoked, not expired, not used up). One
   * statement, so two redemptions of the last use cannot both succeed. True when a use was taken.
   */
  redeem(code: string, now: number): boolean {
    const r = this.sql
      .get(
        `UPDATE invites SET used = used + 1
         WHERE code = ? AND used < max_uses AND revoked_at IS NULL
           AND (expires_at IS NULL OR expires_at > ?)`,
      )
      .run(code, now);
    return Number(r.changes) > 0;
  }

  /** Marks the code revoked; false when there is no such code or it was revoked already. */
  revoke(id: number, at: number): boolean {
    const r = this.sql
      .get("UPDATE invites SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL")
      .run(at, id);
    return Number(r.changes) > 0;
  }
}
