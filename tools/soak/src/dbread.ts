import { existsSync, statSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

/**
 * Read-only looks into the server's SQLite file (or a backup) for checks the HTTP API does not
 * answer: the paper, the Book of Deeds, sizes. Never written to; the server is the only writer.
 */
export interface TownStateLite {
  day: number;
  deeds: string[];
  news: Record<string, unknown>;
  players: {
    id: number;
    active: boolean;
    name: string;
    logon: string;
    bp: number;
    bpToday: number;
    turns: number;
    tags: number[];
    hp: number;
  }[];
  sessions: Record<string, unknown>;
  settings: Record<string, unknown>;
}

function open(path: string): DatabaseSync {
  return new DatabaseSync(path, { readOnly: true });
}

export function readTown(
  path: string,
  townId: string,
): { state: TownStateLite; revision: number } | null {
  const db = open(path);
  try {
    const row = db.prepare("SELECT state_json, revision FROM towns WHERE id = ?").get(townId) as
      | { state_json: string; revision: number }
      | undefined;
    if (!row) return null;
    return { state: JSON.parse(row.state_json) as TownStateLite, revision: Number(row.revision) };
  } finally {
    db.close();
  }
}

/** `action` rows in the audit log per account (what each account did that the server accepted). */
export function auditActionCounts(path: string, townId: string): Map<number, number> {
  const db = open(path);
  try {
    const rows = db
      .prepare(
        "SELECT account_id AS a, COUNT(*) AS n FROM audit_log WHERE town_id = ? AND kind = 'action' GROUP BY account_id",
      )
      .all(townId) as { a: number | null; n: number }[];
    return new Map(rows.filter((r) => r.a !== null).map((r) => [Number(r.a), Number(r.n)]));
  } finally {
    db.close();
  }
}

export interface DbSize {
  dbBytes: number;
  walBytes: number;
  pages: number;
  freePages: number;
  pageSize: number;
  auditRows: number;
  snapshots: number;
  snapshotBytes: number;
  townBytes: number;
  sessions: number;
  accounts: number;
  hallOfFame: number;
}

export function dbSize(path: string): DbSize {
  const db = open(path);
  try {
    const one = (sql: string): number => {
      const row = db.prepare(sql).get() as Record<string, number> | undefined;
      return Number(row ? Object.values(row)[0] : 0);
    };
    return {
      dbBytes: statSync(path).size,
      walBytes: existsSync(`${path}-wal`) ? statSync(`${path}-wal`).size : 0,
      pages: one("PRAGMA page_count"),
      freePages: one("PRAGMA freelist_count"),
      pageSize: one("PRAGMA page_size"),
      auditRows: one("SELECT COUNT(*) FROM audit_log"),
      snapshots: one("SELECT COUNT(*) FROM town_snapshots"),
      snapshotBytes: one("SELECT COALESCE(SUM(LENGTH(state_json)), 0) FROM town_snapshots"),
      townBytes: one("SELECT COALESCE(SUM(LENGTH(state_json)), 0) FROM towns"),
      sessions: one("SELECT COUNT(*) FROM sessions"),
      accounts: one("SELECT COUNT(*) FROM accounts"),
      hallOfFame: one("SELECT COUNT(*) FROM hall_of_fame"),
    };
  } finally {
    db.close();
  }
}

/** Snapshots per town (to check the keep limit). */
export function snapshotCounts(path: string): Map<string, number> {
  const db = open(path);
  try {
    const rows = db
      .prepare("SELECT town_id AS t, COUNT(*) AS n FROM town_snapshots GROUP BY town_id")
      .all() as { t: string; n: number }[];
    return new Map(rows.map((r) => [r.t, Number(r.n)]));
  } finally {
    db.close();
  }
}
