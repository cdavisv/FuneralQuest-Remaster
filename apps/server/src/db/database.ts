import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type Db = DatabaseSync;

/**
 * Schema migrations, applied in order. `PRAGMA user_version` records how many
 * have run. Never edit an applied migration; append a new one.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE accounts (
    id INTEGER PRIMARY KEY,
    login TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT,
    is_guest INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    last_login_at INTEGER,
    banned INTEGER NOT NULL DEFAULT 0,
    ban_reason TEXT
  );

  CREATE TABLE sessions (
    id INTEGER PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    ip TEXT
  );
  CREATE INDEX sessions_account ON sessions(account_id);

  CREATE TABLE towns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    ruleset TEXT NOT NULL,
    content_pack TEXT NOT NULL,
    time_zone TEXT NOT NULL,
    day_length_ms INTEGER,
    epoch INTEGER NOT NULL,
    last_boundary INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0,
    state_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE parlors (
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    town_id TEXT NOT NULL REFERENCES towns(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (account_id, town_id),
    UNIQUE (town_id, player_id)
  );

  CREATE TABLE town_snapshots (
    id INTEGER PRIMARY KEY,
    town_id TEXT NOT NULL REFERENCES towns(id) ON DELETE CASCADE,
    taken_at INTEGER NOT NULL,
    day INTEGER NOT NULL,
    revision INTEGER NOT NULL,
    reason TEXT NOT NULL,
    state_json TEXT NOT NULL
  );
  CREATE INDEX snapshots_town ON town_snapshots(town_id, id);

  CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at INTEGER NOT NULL,
    town_id TEXT,
    account_id INTEGER,
    player_id INTEGER,
    kind TEXT NOT NULL,
    data TEXT NOT NULL
  );
  CREATE INDEX audit_town ON audit_log(town_id, id);
  CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON audit_log
    BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
  CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON audit_log
    BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;

  CREATE TABLE ip_bans (
    id INTEGER PRIMARY KEY,
    prefix TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER
  );
  `,
  // Retention: rows may be deleted only while the prune window's cutoff is set past them.
  // The window is 0 (nothing deletable) except inside AuditStore.prune.
  `
  CREATE TABLE audit_prune_window (id INTEGER PRIMARY KEY CHECK (id = 1), cutoff INTEGER NOT NULL);
  INSERT INTO audit_prune_window (id, cutoff) VALUES (1, 0);
  DROP TRIGGER audit_log_no_delete;
  CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON audit_log
    WHEN OLD.at >= (SELECT cutoff FROM audit_prune_window WHERE id = 1)
    BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
  `,
  // Expanded towns: per-town rule overrides, the hall of fame, the server's secrets and the Daily
  // Challenge runs.
  `
  ALTER TABLE towns ADD COLUMN rule_overrides TEXT NOT NULL DEFAULT '{}';

  CREATE TABLE server_secrets (
    name TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE hall_of_fame (
    id INTEGER PRIMARY KEY,
    town_id TEXT NOT NULL,
    town_name TEXT NOT NULL,
    ruleset TEXT NOT NULL,
    season INTEGER NOT NULL,
    ended_at INTEGER NOT NULL,
    days INTEGER NOT NULL,
    winner_name TEXT,
    winner_parlor TEXT,
    winner_bp INTEGER,
    entry_json TEXT NOT NULL,
    UNIQUE (town_id, season)
  );
  CREATE INDEX hall_of_fame_time ON hall_of_fame(ended_at DESC, id DESC);

  CREATE TABLE challenge_runs (
    day TEXT NOT NULL,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    guest INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('playing', 'finished')),
    abandoned INTEGER NOT NULL DEFAULT 0,
    name TEXT NOT NULL,
    parlor TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    finished_at INTEGER,
    score INTEGER NOT NULL DEFAULT 0,
    money INTEGER NOT NULL DEFAULT 0,
    sales INTEGER NOT NULL DEFAULT 0,
    exact INTEGER NOT NULL DEFAULT 0,
    walkouts INTEGER NOT NULL DEFAULT 0,
    state_json TEXT NOT NULL,
    PRIMARY KEY (day, account_id)
  );
  CREATE INDEX challenge_board ON challenge_runs(day, status, guest);
  `,
  // Player safety: blocks that follow the account, reports with their evidence, mutes, and who
  // owned each hall-of-fame name (so an account deletion can take its name out of the record).
  `
  CREATE TABLE account_blocks (
    id INTEGER PRIMARY KEY,
    blocker_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    blocked_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    label TEXT NOT NULL,
    UNIQUE (blocker_id, blocked_id)
  );
  CREATE INDEX account_blocks_blocked ON account_blocks(blocked_id);

  CREATE TABLE reports (
    id INTEGER PRIMARY KEY,
    created_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'actioned')),
    source TEXT NOT NULL DEFAULT 'player',
    reporter_account_id INTEGER,
    reporter_guest INTEGER NOT NULL DEFAULT 0,
    town_id TEXT,
    kind TEXT NOT NULL,
    category TEXT NOT NULL,
    note TEXT,
    reported_text TEXT,
    reported_account_id INTEGER,
    reported_login TEXT,
    reported_player_id INTEGER,
    reported_name TEXT,
    reported_parlor TEXT,
    authored_at INTEGER,
    where_seen TEXT,
    verified INTEGER NOT NULL DEFAULT 0,
    evidence_json TEXT NOT NULL DEFAULT '{}',
    resolved_at INTEGER,
    resolved_by TEXT,
    resolution TEXT,
    resolution_note TEXT
  );
  CREATE INDEX reports_status ON reports(status, id);
  CREATE INDEX reports_reported ON reports(reported_account_id, created_at);
  CREATE INDEX reports_reporter ON reports(reporter_account_id, created_at);

  CREATE TABLE mutes (
    id INTEGER PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    scopes TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    lifted_at INTEGER,
    reason TEXT NOT NULL,
    moderator TEXT NOT NULL,
    auto INTEGER NOT NULL DEFAULT 0,
    report_id INTEGER
  );
  CREATE INDEX mutes_account ON mutes(account_id, expires_at);

  CREATE TABLE hall_owners (
    hall_id INTEGER NOT NULL REFERENCES hall_of_fame(id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    parlor TEXT NOT NULL
  );
  CREATE INDEX hall_owners_account ON hall_owners(account_id);
  `,
  // Hardening: the account-erasure and data-export queries filter the audit log by account, and
  // every Daily Challenge request looks for stale runs by status and time. Without these two
  // indexes both scan whole tables on the main thread (node:sqlite is synchronous).
  `
  CREATE INDEX audit_account ON audit_log(account_id, id);
  CREATE INDEX challenge_stale ON challenge_runs(status, updated_at);
  `,
];

/** The schema version this server writes (`PRAGMA user_version` after every migration ran). */
export const SCHEMA_VERSION = MIGRATIONS.length;

export function openDatabase(path: string): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = NORMAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  migrate(db);
  return db;
}

function migrate(db: Db): void {
  const row = db.prepare("PRAGMA user_version").get() as { user_version: number };
  if (row.user_version > MIGRATIONS.length) {
    // A newer server wrote this file; an older one would misread tables it does not know.
    throw new Error(
      `The database was written by a newer server (schema ${row.user_version}; this server knows ${MIGRATIONS.length}). Update the server, or restore a backup taken before the update.`,
    );
  }
  for (let v = row.user_version; v < MIGRATIONS.length; v++) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(MIGRATIONS[v] as string);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}

const depth = new WeakMap<Db, number>();

/**
 * Runs `fn` in a transaction (savepoints when nested). Everything inside is
 * synchronous, so no other statement can interleave on this connection.
 */
export function transaction<T>(db: Db, fn: () => T): T {
  const level = depth.get(db) ?? 0;
  const name = `sp${level}`;
  db.exec(level === 0 ? "BEGIN IMMEDIATE" : `SAVEPOINT ${name}`);
  depth.set(db, level + 1);
  try {
    const result = fn();
    depth.set(db, level);
    db.exec(level === 0 ? "COMMIT" : `RELEASE ${name}`);
    return result;
  } catch (error) {
    depth.set(db, level);
    db.exec(level === 0 ? "ROLLBACK" : `ROLLBACK TO ${name}`);
    if (level > 0) db.exec(`RELEASE ${name}`);
    throw error;
  }
}
