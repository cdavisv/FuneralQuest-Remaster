import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { type Db, SCHEMA_VERSION } from "./database.js";

/**
 * Backups of the whole server: one consistent SQLite file made with `VACUUM INTO`, plus a small
 * JSON manifest next to it saying what it holds. The database is the only state the server keeps
 * (accounts, sessions, towns, snapshots, the audit log, the hall of fame, the Daily Challenge
 * secret); configuration lives in the environment and the operator's own files.
 *
 * `VACUUM INTO` runs synchronously on the server's own connection, so no step of any town can
 * interleave with it: the copy holds every committed step up to one instant and nothing after.
 * It reads the database from start to end (a few milliseconds for a hobby server; about a second
 * per hundred megabytes) and the copy comes out compacted.
 */

export interface BackupTown {
  id: string;
  name: string;
  ruleset: string;
  day: number;
  revision: number;
  players: number;
}

export interface BackupManifest {
  format: 1;
  /** File name of the database copy, in the same directory as the manifest. */
  file: string;
  createdAt: string;
  /** What made it: `admin`, `automatic`, `command`. */
  source: string;
  schemaVersion: number;
  bytes: number;
  sha256: string;
  accounts: number;
  towns: BackupTown[];
}

export interface BackupCheck {
  ok: boolean;
  problems: string[];
  schemaVersion: number;
  towns: BackupTown[];
  accounts: number;
}

const NAME = /^fq-[0-9]{8}T[0-9]{6}Z(?:-[a-z0-9-]{1,40})?\.sqlite$/;

/** Whether a backup file name is one this server makes (used to refuse path tricks in the API). */
export function isBackupName(name: string): boolean {
  return NAME.test(name);
}

/** `fq-20300101T120000Z.sqlite` for a time (UTC). */
export function backupName(at: number, label = ""): string {
  const iso = new Date(at)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const suffix =
    label === ""
      ? ""
      : `-${label
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-")
          .slice(0, 32)}`;
  return `fq-${iso}${suffix}.sqlite`;
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function townsIn(db: DatabaseSync | Db): BackupTown[] {
  const rows = db
    .prepare(
      `SELECT id, name, ruleset, revision,
              json_extract(state_json, '$.day') AS day,
              (SELECT COUNT(*) FROM json_each(state_json, '$.players') AS p
                 WHERE json_extract(p.value, '$.active') = 1) AS players
         FROM towns ORDER BY id`,
    )
    .all() as {
    id: string;
    name: string;
    ruleset: string;
    revision: number;
    day: number;
    players: number;
  }[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    ruleset: r.ruleset,
    day: Number(r.day),
    revision: Number(r.revision),
    players: Number(r.players),
  }));
}

/**
 * Writes a consistent copy of the open database to `dest` (which must not exist) and its manifest
 * to `dest` + `.json`. Synchronous on purpose: see the module comment.
 */
export function backupDatabase(db: Db, dest: string, source: string, at: number): BackupManifest {
  const path = resolve(dest);
  if (existsSync(path)) throw new Error(`${path} already exists`);
  mkdirSync(dirname(path), { recursive: true });
  const towns = townsIn(db);
  const accounts = Number(
    (db.prepare("SELECT COUNT(*) AS n FROM accounts").get() as { n: number }).n,
  );
  const version = Number(
    (db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version,
  );
  db.prepare("VACUUM INTO ?").run(path);
  const manifest: BackupManifest = {
    format: 1,
    file: basename(path),
    createdAt: new Date(at).toISOString(),
    source,
    schemaVersion: version,
    bytes: statSync(path).size,
    sha256: sha256(path),
    accounts,
    towns,
  };
  writeFileSync(`${path}.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

/**
 * Opens a backup read-only and checks it: SQLite's integrity check, a schema this server knows
 * (an older one is upgraded when the server starts on it; a newer one comes from a newer server
 * and is refused), and the tables the server needs.
 */
export function checkBackup(path: string): BackupCheck {
  const problems: string[] = [];
  if (!existsSync(path)) {
    return {
      ok: false,
      problems: [`${path} does not exist`],
      schemaVersion: 0,
      towns: [],
      accounts: 0,
    };
  }
  let db: DatabaseSync | null = null;
  try {
    db = new DatabaseSync(path, { readOnly: true });
    const integrity = db.prepare("PRAGMA integrity_check").all() as { integrity_check: string }[];
    const bad = integrity.map((r) => r.integrity_check).filter((t) => t !== "ok");
    if (bad.length > 0) problems.push(`integrity check: ${bad.slice(0, 5).join("; ")}`);
    const version = Number(
      (db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version,
    );
    if (version > SCHEMA_VERSION) {
      problems.push(
        `made by a newer server (schema ${version}; this server knows ${SCHEMA_VERSION}): update the server first`,
      );
    }
    const tables = new Set(
      (
        db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
          name: string;
        }[]
      ).map((r) => r.name),
    );
    for (const t of ["accounts", "sessions", "towns", "parlors", "town_snapshots", "audit_log"]) {
      if (!tables.has(t)) problems.push(`missing table ${t}`);
    }
    const towns = tables.has("towns") ? townsIn(db) : [];
    const accounts = tables.has("accounts")
      ? Number((db.prepare("SELECT COUNT(*) AS n FROM accounts").get() as { n: number }).n)
      : 0;
    return { ok: problems.length === 0, problems, schemaVersion: version, towns, accounts };
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));
    return { ok: false, problems, schemaVersion: 0, towns: [], accounts: 0 };
  } finally {
    db?.close();
  }
}

/** The pid file a running server keeps next to its database (see `main.ts`). */
export function pidFileOf(dbPath: string): string {
  return `${resolve(dbPath)}.pid`;
}

/** The process id of a live server using `dbPath`, or null. */
export function runningServer(dbPath: string): number | null {
  const file = pidFileOf(dbPath);
  if (!existsSync(file)) return null;
  const pid = Number.parseInt(readFileSync(file, "utf8").trim(), 10);
  if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) return null;
  try {
    process.kill(pid, 0);
    return pid;
  } catch (error) {
    // EPERM means the process exists but belongs to someone else.
    return (error as NodeJS.ErrnoException).code === "EPERM" ? pid : null;
  }
}

export interface RestoreResult {
  restored: string;
  /** Where the files that were there before went (nothing is deleted). */
  setAside: string[];
  check: BackupCheck;
}

/**
 * Puts a backup in place as the server's database. The server must be stopped (refused while a
 * live process holds the pid file). The current database and its `-wal` and `-shm` files are
 * renamed to `<name>.before-restore-<time>` rather than deleted, the backup is checked, copied
 * next to the target and renamed over it, so a failure half-way leaves either the old file or
 * the new one, never a mix.
 */
export function restoreDatabase(backup: string, dbPath: string, at: number): RestoreResult {
  const target = resolve(dbPath);
  const pid = runningServer(target);
  if (pid !== null) {
    throw new Error(`a server (pid ${pid}) is using ${target}; stop it before restoring`);
  }
  const check = checkBackup(resolve(backup));
  if (!check.ok) throw new Error(`not a usable backup: ${check.problems.join("; ")}`);
  mkdirSync(dirname(target), { recursive: true });
  const stamp = new Date(at)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const setAside: string[] = [];
  for (const suffix of ["", "-wal", "-shm"]) {
    const file = `${target}${suffix}`;
    if (!existsSync(file)) continue;
    const aside = `${target}.before-restore-${stamp}${suffix}`;
    renameSync(file, aside);
    setAside.push(aside);
  }
  const temp = `${target}.restoring`;
  rmSync(temp, { force: true });
  copyFileSync(resolve(backup), temp);
  renameSync(temp, target);
  return { restored: target, setAside, check };
}

/** Backups in a directory, newest first, with their manifests when present. */
export function listBackups(
  dir: string,
): { name: string; bytes: number; manifest: BackupManifest | null }[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(isBackupName)
    .sort()
    .reverse()
    .map((name) => {
      const path = join(dir, name);
      let manifest: BackupManifest | null = null;
      try {
        manifest = JSON.parse(readFileSync(`${path}.json`, "utf8")) as BackupManifest;
      } catch {
        manifest = null;
      }
      return { name, bytes: statSync(path).size, manifest };
    });
}

/** The directory backups go to: `FQ_BACKUP_DIR`, or `backups` next to the database. Null for an in-memory database. */
export function backupDirOf(config: { backupDir: string; dbPath: string }): string | null {
  if (config.backupDir !== "") return resolve(config.backupDir);
  if (config.dbPath === ":memory:") return null;
  return join(dirname(resolve(config.dbPath)), "backups");
}

/**
 * Makes a backup in `dir` named for the time (a second one in the same second gets a number),
 * then prunes to `keep`.
 */
export function makeBackup(
  db: Db,
  dir: string,
  options: { at: number; source: string; label?: string; keep: number },
): BackupManifest {
  mkdirSync(dir, { recursive: true });
  let name = backupName(options.at, options.label ?? "");
  for (let i = 2; existsSync(join(dir, name)); i++) {
    name = backupName(options.at, `${options.label ? `${options.label}-` : ""}${i}`);
  }
  const manifest = backupDatabase(db, join(dir, name), options.source, options.at);
  pruneBackups(dir, options.keep);
  return manifest;
}

/** Deletes all but the newest `keep` backups (and their manifests). Returns how many went. */
export function pruneBackups(dir: string, keep: number): number {
  if (keep <= 0) return 0;
  const old = listBackups(dir).slice(keep);
  for (const b of old) {
    rmSync(join(dir, b.name), { force: true });
    rmSync(join(dir, `${b.name}.json`), { force: true });
  }
  return old.length;
}
