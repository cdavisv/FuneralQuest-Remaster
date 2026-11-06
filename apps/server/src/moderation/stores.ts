import type { SQLInputValue } from "node:sqlite";
import type { Db } from "../db/database.js";
import { all, one, Statements } from "../db/stores.js";
import { MUTE_SCOPES, type MuteScope, type ReportCategory } from "../wire.js";

/** Small typed wrappers over the player-safety tables (blocks, reports, mutes). */

// --------------------------------------------------------------- blocks

export interface BlockRow {
  id: number;
  blocker_id: number;
  blocked_id: number;
  created_at: number;
  label: string;
}

export class BlockStore {
  private readonly sql: Statements;
  constructor(db: Db) {
    this.sql = new Statements(db);
  }

  all(): BlockRow[] {
    return all<BlockRow>(this.sql.get("SELECT * FROM account_blocks ORDER BY id"));
  }

  forBlocker(blockerId: number): BlockRow[] {
    return all<BlockRow>(
      this.sql.get("SELECT * FROM account_blocks WHERE blocker_id = ? ORDER BY id"),
      blockerId,
    );
  }

  find(id: number): BlockRow | undefined {
    return one<BlockRow>(this.sql.get("SELECT * FROM account_blocks WHERE id = ?"), id);
  }

  findPair(blockerId: number, blockedId: number): BlockRow | undefined {
    return one<BlockRow>(
      this.sql.get("SELECT * FROM account_blocks WHERE blocker_id = ? AND blocked_id = ?"),
      blockerId,
      blockedId,
    );
  }

  /** Adds a block. Returns the row and whether it was new. */
  add(
    blockerId: number,
    blockedId: number,
    label: string,
    at: number,
  ): { row: BlockRow; created: boolean } {
    const existing = this.findPair(blockerId, blockedId);
    if (existing) return { row: existing, created: false };
    this.sql
      .get(
        "INSERT INTO account_blocks (blocker_id, blocked_id, created_at, label) VALUES (?, ?, ?, ?)",
      )
      .run(blockerId, blockedId, at, label);
    return { row: this.findPair(blockerId, blockedId) as BlockRow, created: true };
  }

  remove(id: number): void {
    this.sql.get("DELETE FROM account_blocks WHERE id = ?").run(id);
  }
}

// -------------------------------------------------------------- reports

export type ReportStatus = "open" | "dismissed" | "actioned";

export interface ReportRow {
  id: number;
  created_at: number;
  status: ReportStatus;
  source: "player" | "auto";
  reporter_account_id: number | null;
  reporter_guest: number;
  town_id: string | null;
  kind: string;
  category: ReportCategory | "automatic";
  note: string | null;
  reported_text: string | null;
  reported_account_id: number | null;
  reported_login: string | null;
  reported_player_id: number | null;
  reported_name: string | null;
  reported_parlor: string | null;
  authored_at: number | null;
  where_seen: string | null;
  verified: number;
  evidence_json: string;
  resolved_at: number | null;
  resolved_by: string | null;
  resolution: string | null;
  resolution_note: string | null;
}

export type NewReport = Omit<
  ReportRow,
  "id" | "status" | "resolved_at" | "resolved_by" | "resolution" | "resolution_note"
>;

export interface ReportQuery {
  status?: ReportStatus;
  category?: string;
  kind?: string;
  townId?: string;
  reportedAccountId?: number;
  reporterAccountId?: number;
  before?: number;
  limit: number;
}

export class ReportStore {
  private readonly sql: Statements;
  constructor(private readonly db: Db) {
    this.sql = new Statements(db);
  }

  insert(r: NewReport): number {
    const result = this.sql
      .get(
        `INSERT INTO reports (created_at, source, reporter_account_id, reporter_guest, town_id, kind,
           category, note, reported_text, reported_account_id, reported_login, reported_player_id,
           reported_name, reported_parlor, authored_at, where_seen, verified, evidence_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        r.created_at,
        r.source,
        r.reporter_account_id,
        r.reporter_guest,
        r.town_id,
        r.kind,
        r.category,
        r.note,
        r.reported_text,
        r.reported_account_id,
        r.reported_login,
        r.reported_player_id,
        r.reported_name,
        r.reported_parlor,
        r.authored_at,
        r.where_seen,
        r.verified,
        r.evidence_json,
      );
    return Number(result.lastInsertRowid);
  }

  get(id: number): ReportRow | undefined {
    return one<ReportRow>(this.sql.get("SELECT * FROM reports WHERE id = ?"), id);
  }

  list(q: ReportQuery): ReportRow[] {
    const where: string[] = [];
    const params: SQLInputValue[] = [];
    const eq = (column: string, value: SQLInputValue | undefined) => {
      if (value === undefined) return;
      where.push(`${column} = ?`);
      params.push(value);
    };
    eq("status", q.status);
    eq("category", q.category);
    eq("kind", q.kind);
    eq("town_id", q.townId);
    eq("reported_account_id", q.reportedAccountId);
    eq("reporter_account_id", q.reporterAccountId);
    if (q.before !== undefined) {
      where.push("id < ?");
      params.push(q.before);
    }
    params.push(q.limit);
    return all<ReportRow>(
      this.db.prepare(
        `SELECT * FROM reports ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
         ORDER BY id DESC LIMIT ?`,
      ),
      ...params,
    );
  }

  /** Reports filed by an account since `since`. */
  countFiledSince(reporterId: number, since: number): number {
    const row = one<{ n: number }>(
      this.sql.get(
        "SELECT COUNT(*) AS n FROM reports WHERE reporter_account_id = ? AND created_at >= ? AND source = 'player'",
      ),
      reporterId,
      since,
    );
    return row?.n ?? 0;
  }

  /** The same reporter reporting the same account for the same kind of thing recently. */
  findRecentDuplicate(
    reporterId: number,
    reportedId: number | null,
    kind: string,
    since: number,
    text: string | null,
  ): ReportRow | undefined {
    return one<ReportRow>(
      this.sql.get(
        `SELECT * FROM reports WHERE reporter_account_id = ? AND created_at >= ? AND kind = ?
           AND coalesce(reported_account_id, -1) = coalesce(?, -1)
           AND coalesce(reported_text, '') = coalesce(?, '') LIMIT 1`,
      ),
      reporterId,
      since,
      kind,
      reportedId,
      text,
    );
  }

  /** Distinct registered accounts that reported `reportedId` since `since`, and the reports. */
  distinctReporters(reportedId: number, since: number): number[] {
    return all<{ reporter_account_id: number }>(
      this.sql.get(
        `SELECT DISTINCT reporter_account_id FROM reports
         WHERE reported_account_id = ? AND created_at >= ? AND source = 'player'
           AND reporter_account_id IS NOT NULL AND reporter_guest = 0 AND status != 'dismissed'`,
      ),
      reportedId,
      since,
    ).map((r) => r.reporter_account_id);
  }

  resolve(
    id: number,
    status: "dismissed" | "actioned",
    by: string,
    resolution: string,
    note: string,
    at: number,
  ): boolean {
    const r = this.sql
      .get(
        `UPDATE reports SET status = ?, resolved_at = ?, resolved_by = ?, resolution = ?,
           resolution_note = ? WHERE id = ? AND status = 'open'`,
      )
      .run(status, at, by, resolution, note, id);
    return Number(r.changes) > 0;
  }

  openAbout(accountId: number): number {
    const row = one<{ n: number }>(
      this.sql.get(
        "SELECT COUNT(*) AS n FROM reports WHERE reported_account_id = ? AND status = 'open'",
      ),
      accountId,
    );
    return row?.n ?? 0;
  }

  /** Reports about the account (any status), newest first. */
  about(accountId: number, limit: number): ReportRow[] {
    return all<ReportRow>(
      this.sql.get("SELECT * FROM reports WHERE reported_account_id = ? ORDER BY id DESC LIMIT ?"),
      accountId,
      limit,
    );
  }

  filedBy(accountId: number, limit: number): ReportRow[] {
    return all<ReportRow>(
      this.sql.get("SELECT * FROM reports WHERE reporter_account_id = ? ORDER BY id DESC LIMIT ?"),
      accountId,
      limit,
    );
  }

  /**
   * Account erasure. Resolved reports the account filed or was the subject of are deleted; open
   * reports it filed keep the evidence but lose the reporter; open reports about it are kept.
   * Returns the counts.
   */
  eraseAccount(accountId: number): { deleted: number; anonymised: number; keptOpen: number } {
    const deleted = Number(
      this.sql
        .get(
          `DELETE FROM reports WHERE status != 'open'
             AND (reporter_account_id = ? OR reported_account_id = ?)`,
        )
        .run(accountId, accountId).changes,
    );
    const anonymised = Number(
      this.sql
        .get(
          "UPDATE reports SET reporter_account_id = NULL WHERE reporter_account_id = ? AND status = 'open'",
        )
        .run(accountId).changes,
    );
    return { deleted, anonymised, keptOpen: this.openAbout(accountId) };
  }

  /** Retention: deletes closed reports resolved before `before`. */
  pruneClosed(before: number): number {
    return Number(
      this.sql.get("DELETE FROM reports WHERE status != 'open' AND resolved_at < ?").run(before)
        .changes,
    );
  }
}

// ----------------------------------------------------------------- mutes

export interface MuteRow {
  id: number;
  account_id: number;
  scopes: string;
  created_at: number;
  expires_at: number;
  lifted_at: number | null;
  reason: string;
  moderator: string;
  auto: number;
  report_id: number | null;
}

export interface Mute {
  id: number;
  accountId: number;
  scopes: MuteScope[];
  createdAt: number;
  expiresAt: number;
  liftedAt: number | null;
  reason: string;
  moderator: string;
  auto: boolean;
  reportId: number | null;
}

function parseScopes(json: string): MuteScope[] {
  try {
    const value = JSON.parse(json) as unknown;
    return Array.isArray(value)
      ? value.filter((s): s is MuteScope => MUTE_SCOPES.includes(s as MuteScope))
      : [];
  } catch {
    return [];
  }
}

export function toMute(r: MuteRow): Mute {
  return {
    id: r.id,
    accountId: r.account_id,
    scopes: parseScopes(r.scopes),
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    liftedAt: r.lifted_at,
    reason: r.reason,
    moderator: r.moderator,
    auto: r.auto === 1,
    reportId: r.report_id,
  };
}

export class MuteStore {
  private readonly sql: Statements;
  constructor(db: Db) {
    this.sql = new Statements(db);
  }

  insert(m: Omit<Mute, "id" | "liftedAt">): number {
    const r = this.sql
      .get(
        `INSERT INTO mutes (account_id, scopes, created_at, expires_at, reason, moderator, auto, report_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        m.accountId,
        JSON.stringify(m.scopes),
        m.createdAt,
        m.expiresAt,
        m.reason,
        m.moderator,
        m.auto ? 1 : 0,
        m.reportId,
      );
    return Number(r.lastInsertRowid);
  }

  get(id: number): Mute | undefined {
    const row = one<MuteRow>(this.sql.get("SELECT * FROM mutes WHERE id = ?"), id);
    return row ? toMute(row) : undefined;
  }

  /** Mutes still in force at `now`. */
  active(accountId: number, now: number): Mute[] {
    return all<MuteRow>(
      this.sql.get(
        "SELECT * FROM mutes WHERE account_id = ? AND lifted_at IS NULL AND expires_at > ? ORDER BY id",
      ),
      accountId,
      now,
    ).map(toMute);
  }

  forAccount(accountId: number, limit: number): Mute[] {
    return all<MuteRow>(
      this.sql.get("SELECT * FROM mutes WHERE account_id = ? ORDER BY id DESC LIMIT ?"),
      accountId,
      limit,
    ).map(toMute);
  }

  /** Active mutes of every account, for the admin page. */
  allActive(now: number): Mute[] {
    return all<MuteRow>(
      this.sql.get(
        "SELECT * FROM mutes WHERE lifted_at IS NULL AND expires_at > ? ORDER BY id DESC",
      ),
      now,
    ).map(toMute);
  }

  lift(id: number, at: number): boolean {
    const r = this.sql
      .get("UPDATE mutes SET lifted_at = ? WHERE id = ? AND lifted_at IS NULL")
      .run(at, id);
    return Number(r.changes) > 0;
  }
}
