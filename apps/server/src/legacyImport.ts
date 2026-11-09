import { randomBytes, randomInt } from "node:crypto";
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createTown } from "@fq/core";
import {
  applyLegacyTown,
  type LegacyImportNote,
  type LegacyUnmapped,
  mapLegacyTown,
} from "@fq/legacy-compat";
import { LOGIN_PATTERN } from "./auth/accounts.js";
import { createPasswordHasher } from "./auth/passwords.js";
import type { ServerConfig } from "./config.js";
import { createContentSource } from "./content/index.js";
import { runningServer } from "./db/backup.js";
import { openDatabase, transaction } from "./db/database.js";
import { AuditStore, ParlorStore, TownStore } from "./db/stores.js";
import { getRuleset } from "./game/rulesets.js";
import { createSchedule, isValidTimeZone, utcOffsetMinutes } from "./game/schedule.js";
import { GameSettingsPatch } from "./game/settings.js";
import { TOWN_ID } from "./game/townConfig.js";

/**
 * Brings a 2001 town (the old server's `player.dat`, `config.dat` and `system.dat`) into a new
 * Classic town: `node server.mjs import-legacy` (docs/sysop-guide.md, "Bringing a 2001 town
 * across"). The parsing is `@fq/legacy-compat` (`saves.ts`); this file decides what a sysop's
 * server does with it: the town row, one account and parlor link per player, and the passwords.
 */

export class LegacyImportError extends Error {}

export interface LegacyImportOptions {
  /** The old server's folder (with `system.dat` and `data\`), or a folder holding the files loose. */
  dir: string;
  townId: string;
  townName?: string | undefined;
  timeZone?: string | undefined;
  /**
   * Carry each player's old password across (hashed with Argon2id like any account password).
   * Off by default: every account then gets a new random password, written to `passwordsFile`.
   */
  keepPasswords?: boolean | undefined;
  /** Where the new passwords go (a CSV, created with owner-only permissions, never overwritten). */
  passwordsFile?: string | undefined;
  /** Parse and report; write nothing. */
  dryRun?: boolean | undefined;
}

export interface LegacyAccountReport {
  playerId: number;
  /** The log-in name the old record had. */
  legacyLogon: string;
  /** The account's log-in name (differs when the old one did not fit the new rules). */
  login: string;
  name: string;
  parlor: string;
  password: "kept" | "new";
}

export interface LegacyImportResult {
  townId: string;
  dryRun: boolean;
  day: number;
  /** Records in `player.dat` (deleted ones included, their slots are kept). */
  slots: number;
  /** Active players, each with an account and a parlor link. */
  accounts: LegacyAccountReport[];
  /** Where the new passwords were written, or null. */
  passwordsFile: string | null;
  files: { system: string | null; config: string | null; player: string | null };
  notes: LegacyImportNote[];
  unmapped: LegacyUnmapped[];
}

/** Finds `name` in `dir` whatever its letter case (the files came off a Windows machine). */
function findFile(dir: string, name: string): string | null {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return null;
  const hit = readdirSync(dir).find((f) => f.toLowerCase() === name.toLowerCase());
  return hit ? join(dir, hit) : null;
}

/** Looks in `<dir>/data` first (the old layout), then in `dir` itself. */
function locate(dir: string, name: string, inData: boolean): string | null {
  const data = findFile(dir, "data");
  const candidates = inData ? [data, dir] : [dir, data];
  for (const c of candidates) {
    if (c === null) continue;
    const found = findFile(c, name);
    if (found) return found;
  }
  return null;
}

/** Files the old server kept that this import does not read, so the sysop knows. */
function otherFiles(dir: string): LegacyImportNote[] {
  const notes: LegacyImportNote[] = [];
  const data = findFile(dir, "data") ?? dir;
  const mail = findFile(data, "mail");
  if (mail && statSync(mail).isDirectory()) {
    const n = readdirSync(mail).filter((f) => /\.dat$/i.test(f)).length;
    if (n > 0) {
      notes.push({
        level: "warning",
        file: "import",
        message: `${n} saved mail file(s) in ${mail} (high-importance letters kept for players who were offline) are not imported; players start with an empty mailbox`,
      });
    }
  }
  const news = readdirSync(data).filter((f) => /^news(_crime)?_day_\d+\.txt$/i.test(f)).length;
  if (news > 0) {
    notes.push({
      level: "info",
      file: "import",
      message: `${news} Funeral Times page file(s) (news_day_N.txt) are not imported; the paper starts fresh from the day the town is on`,
    });
  }
  for (const [file, what] of [
    ["deeds.txt", "the Book of Deeds"],
    ["ratings.txt", "your rating titles"],
    ["karma.txt", "your karma titles"],
    ["swear.txt", "your swear filter list"],
    ["ban.txt", "your IP ban list"],
  ] as const) {
    if (findFile(data, file) ?? findFile(dir, file)) {
      notes.push({
        level: "info",
        file: "import",
        message: `${file} (${what}) is not imported; the town uses the content pack's and the server's own lists`,
      });
    }
  }
  return notes;
}

/** An account log-in the new server accepts, from the old one. Unique among `taken` (case-insensitive). */
function accountLogin(legacy: string, id: number, taken: Set<string>): string {
  let base = legacy;
  if (!LOGIN_PATTERN.test(base)) {
    base = legacy.replace(/[^A-Za-z0-9_.-]/g, "_").replace(/^[^A-Za-z0-9]+/, "");
    if (base === "") base = `player${id}`;
    base = base.padEnd(3, "0").slice(0, 20);
  }
  let login = base;
  for (let n = 2; taken.has(login.toLowerCase()); n++) {
    const suffix = String(n);
    login = `${base.slice(0, 20 - suffix.length)}${suffix}`;
  }
  taken.add(login.toLowerCase());
  return login;
}

const PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newPassword(): string {
  let out = "";
  for (let i = 0; i < 12; i++) out += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  return out;
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Reads the old files, builds a Classic town on day `i_game_age` with the old players in their
 * slots, and (unless `dryRun`) writes it to the database: the town, one account per active
 * player and the link from each account to its parlor. The server must be stopped.
 *
 * Passwords: the original stored them as plain text in `player.dat`. By default none is carried:
 * each account gets a new random one, listed in a CSV the sysop hands out (players can then change
 * it). `keepPasswords` hashes the old ones instead, for a sysop who wants players to walk straight
 * back in.
 */
export async function importLegacyTown(
  config: ServerConfig,
  options: LegacyImportOptions,
  at: number,
): Promise<LegacyImportResult> {
  if (!TOWN_ID.test(options.townId)) {
    throw new LegacyImportError(
      `Town id "${options.townId}" must be lowercase letters, digits and dashes, up to 32 characters`,
    );
  }
  const timeZone = options.timeZone ?? "UTC";
  if (!isValidTimeZone(timeZone))
    throw new LegacyImportError(`"${timeZone}" is not an IANA time zone`);
  const dir = resolve(options.dir);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new LegacyImportError(`${dir} is not a folder`);
  }
  const paths = {
    system: locate(dir, "system.dat", false),
    config: locate(dir, "config.dat", true),
    player: locate(dir, "player.dat", true),
  };
  if (!paths.config && !paths.player) {
    throw new LegacyImportError(
      `No player.dat or config.dat in ${dir} or ${join(dir, "data")}. Point --dir at the old server's folder (the one with system.dat and a data folder).`,
    );
  }
  const read = (p: string | null): Uint8Array | undefined =>
    p ? new Uint8Array(readFileSync(p)) : undefined;
  const imported = mapLegacyTown({
    playerDat: read(paths.player),
    configDat: read(paths.config),
    systemDat: read(paths.system),
  });
  const notes: LegacyImportNote[] = [...imported.notes, ...otherFiles(dir)];

  const settingsCheck = GameSettingsPatch.safeParse(imported.settings);
  if (!settingsCheck.success) {
    throw new LegacyImportError(
      `The old settings are not ones the engine accepts: ${settingsCheck.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }

  // One account per active player. The engine's log-on name is the account's log-in name.
  const content = createContentSource(config.packsDir === "" ? {} : { packsDir: config.packsDir });
  const taken = new Set<string>();
  const hasher = createPasswordHasher({
    memoryKiB: config.argon2MemoryKiB,
    passes: config.argon2Passes,
  });
  interface Planned {
    report: LegacyAccountReport;
    hash: string;
    plain: string | null;
  }
  const planned: Planned[] = [];
  for (const record of imported.players) {
    const p = record.player;
    if (!p.active) continue;
    const legacyLogon = p.logon;
    const login = accountLogin(legacyLogon, p.id, taken);
    if (login !== legacyLogon) {
      notes.push({
        level: "warning",
        file: "player.dat",
        message: `player ${p.id} (${JSON.stringify(p.name)}): log-on name ${JSON.stringify(legacyLogon)} does not fit the new rules (3 to 20 letters, digits, _ . -) or is taken; the account is ${JSON.stringify(login)}`,
      });
    }
    const keep = options.keepPasswords === true && record.password !== "";
    const plain = keep ? null : newPassword();
    const hash = await hasher.hash(keep ? record.password : (plain as string));
    p.logon = login;
    planned.push({
      report: {
        playerId: p.id,
        legacyLogon,
        login,
        name: p.name,
        parlor: p.parlor,
        password: keep ? "kept" : "new",
      },
      hash,
      plain,
    });
  }
  if (options.keepPasswords === true) {
    const blank = planned.filter((x) => x.report.password === "new").length;
    if (blank > 0) {
      notes.push({
        level: "warning",
        file: "player.dat",
        message: `${blank} player(s) had an empty password; they get a new random one`,
      });
    }
  }

  const ruleset = getRuleset("classic");
  if (!ruleset) throw new LegacyImportError("the Classic ruleset is missing");
  const base = ruleset.context(content.load("classic"));
  const seed = randomBytes(4).readUInt32BE(0);
  const ctx = { ...base, now: at, localTimeOffsetMinutes: utcOffsetMinutes(timeZone, at) };
  const made = createTown({ seed, paused: true }, ctx);
  const town = applyLegacyTown(made.town, imported);

  const newPasswords = planned.filter((x) => x.plain !== null);
  const result: LegacyImportResult = {
    townId: options.townId,
    dryRun: options.dryRun === true,
    day: town.day,
    slots: imported.players.length,
    accounts: planned.map((x) => x.report),
    passwordsFile: null,
    files: paths,
    notes,
    unmapped: imported.unmapped,
  };
  if (options.dryRun === true) return result;

  const pid = runningServer(config.dbPath);
  if (pid !== null) {
    throw new LegacyImportError(
      `a server (pid ${pid}) is using ${config.dbPath}; stop it before importing`,
    );
  }
  const db = openDatabase(config.dbPath);
  try {
    const towns = new TownStore(db);
    if (towns.get(options.townId)) {
      throw new LegacyImportError(
        `Town "${options.townId}" already exists in ${config.dbPath}; choose another --town id`,
      );
    }
    const passwordsFile =
      newPasswords.length > 0
        ? resolve(options.passwordsFile ?? `legacy-import-${options.townId}-passwords.csv`)
        : null;
    if (passwordsFile !== null && existsSync(passwordsFile)) {
      throw new LegacyImportError(
        `${passwordsFile} already exists; it is never overwritten (use --passwords-file)`,
      );
    }
    const schedule = createSchedule({ timeZone, dayLengthMs: null, epoch: at });
    const parlors = new ParlorStore(db);
    const audit = new AuditStore(db);
    // An existing login on this server (an account already made) is not taken over: the
    // imported one gets a number, so nobody is handed another person's account.
    const exists = db.prepare("SELECT 1 FROM accounts WHERE login = ?");
    for (const x of planned) {
      const stateOf = town.players[x.report.playerId];
      let login = x.report.login;
      for (let n = 2; exists.get(login); n++) {
        const suffix = String(n);
        login = `${x.report.login.slice(0, 20 - suffix.length)}${suffix}`;
      }
      if (login !== x.report.login) {
        notes.push({
          level: "warning",
          file: "import",
          message: `account ${JSON.stringify(x.report.login)} already exists on this server; player ${x.report.playerId} is ${JSON.stringify(login)}`,
        });
        x.report.login = login;
        if (stateOf) stateOf.logon = login;
      }
    }
    if (passwordsFile !== null) {
      const lines = ["login,name,parlor,password"];
      for (const x of newPasswords) {
        lines.push(
          [x.report.login, x.report.name, x.report.parlor, x.plain ?? ""].map(csvCell).join(","),
        );
      }
      writeFileSync(passwordsFile, `${lines.join("\n")}\n`, { flag: "wx", mode: 0o600 });
      result.passwordsFile = passwordsFile;
    }
    try {
      transaction(db, () => {
        const json = JSON.stringify(town);
        towns.insert({
          id: options.townId,
          name: options.townName ?? options.townId,
          ruleset: "classic",
          content_pack: "classic",
          time_zone: timeZone,
          day_length_ms: null,
          epoch: at,
          // The day the files were on is the day the town is on: nothing to catch up at start.
          last_boundary: schedule.currentBoundary(at),
          revision: 1,
          state_json: json,
          rule_overrides: "{}",
          created_at: at,
          updated_at: at,
        });
        const insert = db.prepare(
          "INSERT INTO accounts (login, password_hash, is_guest, created_at, last_login_at) VALUES (?, ?, 0, ?, NULL)",
        );
        for (const x of planned) {
          const r = insert.run(x.report.login, x.hash, at);
          parlors.link(Number(r.lastInsertRowid), options.townId, x.report.playerId, at);
        }
        audit.append({
          at,
          townId: options.townId,
          kind: "town:imported",
          data: {
            source: "2001 save files",
            day: town.day,
            slots: imported.players.length,
            accounts: planned.length,
            passwords: options.keepPasswords === true ? "kept" : "new",
          },
        });
      });
    } catch (error) {
      if (passwordsFile !== null) rmSync(passwordsFile, { force: true });
      throw error;
    }
  } finally {
    db.close();
  }
  return result;
}
