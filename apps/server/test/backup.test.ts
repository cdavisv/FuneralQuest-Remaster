import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { clockFromConfig, ScaledClock } from "../src/clock.js";
import { loadConfig, testConfig } from "../src/config.js";
import {
  backupDatabase,
  checkBackup,
  isBackupName,
  makeBackup,
  pidFileOf,
  restoreDatabase,
} from "../src/db/backup.js";
import { openDatabase, SCHEMA_VERSION } from "../src/db/database.js";
import { ADMIN_TOKEN, type Harness, playDay, startServer, TestPlayer } from "./support/harness.js";

let h: Harness | null = null;
const dirs: string[] = [];
afterEach(async () => {
  await h?.stop();
  h = null;
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function tempDir(): string {
  const d = mkdtempSync(join(tmpdir(), "fq-backup-"));
  dirs.push(d);
  return d;
}

async function admin<T = Record<string, unknown>>(
  method: "GET" | "POST" | "DELETE",
  url: string,
  body?: unknown,
  token: string | null = ADMIN_TOKEN,
): Promise<{ status: number; body: T; raw: string }> {
  const res = await h?.inject({
    method,
    url,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    ...(body !== undefined ? { payload: JSON.stringify(body) } : {}),
  });
  const raw = res?.body ?? "";
  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : undefined;
  } catch {
    parsed = undefined;
  }
  return { status: res?.statusCode ?? 0, body: parsed as T, raw };
}

interface Manifest {
  file: string;
  bytes: number;
  sha256: string;
  schemaVersion: number;
  towns: { id: string; day: number; revision: number; players: number }[];
}

describe("backups through the admin API", () => {
  it("writes a consistent copy while the town plays, lists, downloads and deletes it", async () => {
    h = await startServer();
    const a = await new TestPlayer(h, "backupper").signUp();
    const view = await a.enter();
    await playDay(a, view);

    const made = await admin<Manifest>("POST", "/admin/backups", { label: "before-update" });
    expect(made.status).toBe(201);
    expect(isBackupName(made.body.file)).toBe(true);
    expect(made.body.file).toMatch(/-before-update\.sqlite$/);
    expect(made.body.schemaVersion).toBe(SCHEMA_VERSION);
    const town = h.server.host.get("main");
    expect(made.body.towns).toEqual([
      expect.objectContaining({ id: "main", revision: town?.revision, day: 1, players: 1 }),
    ]);

    const path = join(h.dir, "backups", made.body.file);
    expect(existsSync(path)).toBe(true);
    const check = checkBackup(path);
    expect(check).toMatchObject({ ok: true, problems: [], accounts: 1 });
    // The copy holds the town exactly as it was saved.
    const copy = new DatabaseSync(path, { readOnly: true });
    const live = h.server.db.prepare("SELECT state_json FROM towns WHERE id = 'main'").get() as {
      state_json: string;
    };
    const saved = copy.prepare("SELECT state_json FROM towns WHERE id = 'main'").get() as {
      state_json: string;
    };
    copy.close();
    expect(saved.state_json).toBe(live.state_json);

    const list = await admin<{ backups: { name: string }[] }>("GET", "/admin/backups");
    expect(list.body.backups.map((b) => b.name)).toEqual([made.body.file]);

    const download = await h.inject({
      method: "GET",
      url: `/admin/backups/${made.body.file}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(download.statusCode).toBe(200);
    expect(download.rawPayload.length).toBe(made.body.bytes);
    expect(download.headers["content-disposition"]).toContain(made.body.file);

    // Names are checked: nothing outside the backup directory can be fetched or deleted.
    for (const bad of ["..%2Ffq.sqlite", "fq.sqlite", "fq-1.sqlite", "%2E%2E%2Ffq.sqlite"]) {
      const r = await admin("GET", `/admin/backups/${bad}`);
      expect(r.raw.startsWith("SQLite format 3")).toBe(false);
      expect(r.status, bad).toBeGreaterThanOrEqual(400);
    }
    expect((await admin("GET", "/admin/backups/fq-20300101T000000Z.sqlite")).status).toBe(404);

    expect((await admin("DELETE", `/admin/backups/${made.body.file}`)).status).toBe(204);
    expect(existsSync(path)).toBe(false);
    expect(existsSync(`${path}.json`)).toBe(false);

    const audit = await admin<{ entries: { kind: string }[] }>("GET", "/admin/audit?kind=admin:backup");
    expect(audit.body.entries.map((e) => e.kind).sort()).toEqual([
      "admin:backup",
      "admin:backup:delete",
      "admin:backup:download",
    ]);
  });

  it("refuses without the admin token", async () => {
    h = await startServer();
    expect((await admin("POST", "/admin/backups", {}, null)).status).toBe(401);
    expect((await admin("GET", "/admin/backups", undefined, "wrong-token-wrong-token-xx")).status).toBe(
      401,
    );
  });

  it("keeps the newest FQ_BACKUP_KEEP and makes automatic ones every FQ_BACKUP_INTERVAL_HOURS", async () => {
    h = await startServer({ config: { backupKeep: 2, backupIntervalHours: 1 } });
    await h.clock.advance(3 * 3_600_000 + 1000);
    const names = readdirSync(join(h.dir, "backups")).filter(isBackupName);
    expect(names).toHaveLength(2);
    const manifest = JSON.parse(
      readFileSync(join(h.dir, "backups", `${names[0]}.json`), "utf8"),
    ) as { source: string };
    expect(manifest.source).toBe("automatic");
  });
});

describe("restore", () => {
  it("puts a backup in place of the database, keeps the old files, and the server carries on from it", async () => {
    h = await startServer();
    const a = await new TestPlayer(h, "restorer").signUp();
    await playDay(a, await a.enter());
    const before = h.server.host.get("main")?.player(0);
    const made = await admin<Manifest>("POST", "/admin/backups");
    const backup = join(h.dir, "backups", made.body.file);
    // Play on after the backup: the restore goes back to it.
    await a.enter();
    await a.act({ type: "exit" });

    const target = join(tempDir(), "restored", "fq.sqlite");
    const first = restoreDatabase(backup, target, Date.UTC(2030, 0, 1));
    expect(first.setAside).toEqual([]);
    expect(readFileSync(target).equals(readFileSync(backup))).toBe(true);

    // A second restore over an existing database sets the old one aside, never deletes it.
    const second = restoreDatabase(backup, target, Date.UTC(2030, 0, 2));
    expect(second.setAside).toHaveLength(1);
    expect(existsSync(second.setAside[0] as string)).toBe(true);

    writeFileSync(join(target, "..", "towns.json"), readFileSync(h.townsFile));
    const restored = await startServer({ dir: join(target, ".."), clock: h.clock });
    try {
      const r = await new TestPlayer(restored, "restorer").logIn();
      const me = await r.request<{ parlors: { townId: string; playerId: number }[] }>("GET", "/api/me");
      expect(me.body.parlors).toEqual([expect.objectContaining({ townId: "main", playerId: 0 })]);
      expect(restored.server.host.get("main")?.player(0)).toEqual(before);
      // The token from before the backup still works there too.
      const holder = new TestPlayer(restored, "restorer");
      holder.token = a.token;
      const old = await holder.request("GET", "/api/me");
      expect(old.status).toBe(200);
    } finally {
      await restored.server.close();
    }
  });

  it("refuses while a server holds the database, and refuses a damaged or foreign file", async () => {
    const dir = tempDir();
    const dbPath = join(dir, "fq.sqlite");
    const db = openDatabase(dbPath);
    const good = join(dir, "good.sqlite");
    backupDatabase(db, good, "test", Date.now());
    db.close();

    // A live process in the pid file stands for a running server.
    const sleeper = spawn(process.execPath, ["-e", "setTimeout(() => {}, 30000)"]);
    try {
      writeFileSync(pidFileOf(dbPath), `${sleeper.pid}\n`);
      expect(() => restoreDatabase(good, dbPath, Date.now())).toThrow(/is using/);
    } finally {
      sleeper.kill("SIGKILL");
    }
    await new Promise((r) => sleeper.on("exit", r));
    // A stale pid file (the server was killed) does not block a restore.
    expect(restoreDatabase(good, dbPath, Date.now()).check.ok).toBe(true);

    const junk = join(dir, "junk.sqlite");
    writeFileSync(junk, "not a database at all");
    expect(checkBackup(junk).ok).toBe(false);
    expect(() => restoreDatabase(junk, dbPath, Date.now())).toThrow(/not a usable backup/);

    const foreign = join(dir, "foreign.sqlite");
    const f = new DatabaseSync(foreign);
    f.exec("CREATE TABLE notes (x TEXT)");
    f.close();
    expect(checkBackup(foreign).problems.join(" ")).toMatch(/missing table towns/);

    const newer = join(dir, "newer.sqlite");
    const n = openDatabase(newer);
    n.exec(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`);
    n.close();
    expect(checkBackup(newer).problems.join(" ")).toMatch(/newer server/);
  });

  it("makeBackup numbers a second backup in the same second", () => {
    const dir = tempDir();
    const db = openDatabase(join(dir, "fq.sqlite"));
    const at = Date.UTC(2030, 5, 1, 12, 0, 0);
    const a = makeBackup(db, join(dir, "b"), { at, source: "test", keep: 0 });
    const b = makeBackup(db, join(dir, "b"), { at, source: "test", keep: 0 });
    db.close();
    expect(a.file).toBe("fq-20300601T120000Z.sqlite");
    expect(b.file).toBe("fq-20300601T120000Z-2.sqlite");
  });
});

describe("the soak-test clock", () => {
  it("is refused in production", () => {
    expect(() => loadConfig({ NODE_ENV: "production", FQ_TEST_CLOCK_SPEED: "1440" })).toThrow(
      /refused when NODE_ENV=production/,
    );
    expect(() =>
      loadConfig({ NODE_ENV: "production", FQ_TEST_MAINTENANCE_DELAY_MS: "100" }),
    ).toThrow(/refused/);
    expect(() => loadConfig({ FQ_TEST_CLOCK_START: "yesterday-ish" })).toThrow(
      /FQ_TEST_CLOCK_START/,
    );
    expect(loadConfig({ NODE_ENV: "production" }).testClockSpeed).toBe(1);
  });

  it("runs game time faster and carries on across a restart with the same settings", () => {
    const config = testConfig({
      testClockSpeed: 1440,
      testClockStart: "2030-01-01T00:00:00Z",
      testClockAnchor: Date.now() - 1000,
    });
    const a = clockFromConfig(config);
    expect(a).toBeInstanceOf(ScaledClock);
    // One real second is 1440 game seconds (24 minutes).
    const t = a.now() - Date.UTC(2030, 0, 1);
    expect(t).toBeGreaterThanOrEqual(1440 * 1000);
    expect(t).toBeLessThan(1440 * 1000 + 1440 * 500);
    // A second server started with the same three numbers reads the same time.
    const b = clockFromConfig(config);
    expect(Math.abs(b.now() - a.now())).toBeLessThan(1440 * 50);
    expect(clockFromConfig(testConfig())).not.toBeInstanceOf(ScaledClock);
  });

  it("fires a game-time timer after the scaled real delay", async () => {
    const clock = new ScaledClock(60_000, Date.now(), Date.UTC(2030, 0, 1));
    const start = Date.now();
    const gameStart = clock.now();
    await new Promise<void>((resolve) => clock.setTimeout(resolve, 3_600_000));
    // An hour of game time is 60 real ms at this speed.
    expect(Date.now() - start).toBeLessThan(1000);
    expect(clock.now() - gameStart).toBeGreaterThanOrEqual(3_600_000);
  });
});

describe("the maintenance pause (soak tests only)", () => {
  it("logs, pauses before saving, then saves the day once", async () => {
    const lines: string[] = [];
    const logger = {
      level: "info",
      info: (obj: unknown, msg?: string) => lines.push(typeof obj === "string" ? obj : (msg ?? "")),
      warn: () => undefined,
      error: () => undefined,
      fatal: () => undefined,
      debug: () => undefined,
      trace: () => undefined,
      silent: () => undefined,
      child() {
        return this;
      },
    } as unknown as import("fastify").FastifyBaseLogger;
    h = await startServer({ config: { testMaintenanceDelayMs: 150 }, logger });
    const read = () =>
      (
        h?.server.db.prepare("SELECT json_extract(state_json, '$.day') AS d FROM towns").get() as {
          d: number;
        }
      ).d;
    const midnight = Date.UTC(2030, 0, 2);
    const advancing = h.clock.advanceTo(midnight + 1000);
    await new Promise((r) => setTimeout(r, 60));
    // Paused inside maintenance: the line is out and nothing of day 2 is saved.
    expect(lines.some((l) => /maintenance paused before saving/.test(l))).toBe(true);
    expect(read()).toBe(1);
    await advancing;
    expect(read()).toBe(2);
  });
});
