/**
 * `node server.mjs import-legacy`: a 2001 town's save files become a Classic town.
 *
 * The files in `packages/legacy-compat/test/fixtures/legacy-town` were written by the original
 * server's own save code (player_file.cpp:92-131, funeral_file.cpp:159-185, file_system.cpp:85-116;
 * see the README beside them). The reader is tested there; these tests cover what the server does
 * with it: the town row, accounts, parlor links, passwords, and playing a step.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FakeClock } from "../src/clock.js";
import { testConfig } from "../src/config.js";
import { importLegacyTown, LegacyImportError } from "../src/legacyImport.js";
import { buttonIds, startServer, TestPlayer, toDesk } from "./support/harness.js";

const FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../packages/legacy-compat/test/fixtures/legacy-town",
);

function workDir(): { old: string; dir: string; dbPath: string } {
  const dir = mkdtempSync(join(tmpdir(), "fq-import-"));
  const old = join(dir, "old-server");
  cpSync(FIXTURE, old, { recursive: true });
  return { old, dir, dbPath: join(dir, "fq.sqlite") };
}

const AT = Date.UTC(2026, 10, 8, 12, 0, 0);

function passwordsOf(file: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of readFileSync(file, "utf8").trim().split("\n").slice(1)) {
    const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g) ?? [];
    const clean = cells.map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"'));
    out.set(clean[0] as string, clean[3] as string);
  }
  return out;
}

describe("import-legacy", () => {
  it("a dry run reads and reports but writes nothing", async () => {
    const w = workDir();
    const r = await importLegacyTown(
      testConfig({ dbPath: w.dbPath }),
      { dir: w.old, townId: "old", dryRun: true },
      AT,
    );
    expect(r.dryRun).toBe(true);
    expect(r.day).toBe(42);
    expect(r.slots).toBe(4);
    expect(r.accounts.map((a) => a.login)).toEqual(["mort", "ana", "renee"]);
    expect(r.unmapped.map((u) => u.field)).toContain("i_port");
    expect(() => statSync(w.dbPath)).toThrow();
  });

  it("creates the town with new passwords: it loads, players log on and play a step", async () => {
    const w = workDir();
    const r = await importLegacyTown(
      testConfig({ dbPath: w.dbPath }),
      { dir: w.old, townId: "old", townName: "Mort's Town", passwordsFile: join(w.dir, "pw.csv") },
      AT,
    );
    expect(r.passwordsFile).toBe(join(w.dir, "pw.csv"));
    expect(statSync(join(w.dir, "pw.csv")).mode & 0o077).toBe(0);
    const passwords = passwordsOf(join(w.dir, "pw.csv"));
    expect(passwords.size).toBe(3);
    expect(JSON.stringify(r)).not.toContain("hunter2");
    expect(readFileSync(join(w.dir, "pw.csv"), "utf8")).not.toContain("hunter2");

    const h = await startServer({ dir: w.dir, towns: [], clock: new FakeClock(AT) });
    try {
      const town = h.server.host.get("old");
      expect(town).toBeDefined();
      const state = town?.snapshotState;
      expect(state?.day).toBe(42);
      expect(state?.settings).toMatchObject({
        turnsPerDay: 20,
        tournamentActive: true,
        tournamentDays: 60,
        maxPlayers: 123,
        swearFilter: false,
        casketSp: [1, 3, 6],
      });
      expect(state?.serverNews).toBe("Welcome to the old town!");
      expect(state?.topYesterday?.name).toBe("Mort");
      // Slots are kept: the deleted player's slot 3 is still there, inactive.
      expect(state?.players.map((p) => [p.id, p.active])).toEqual([
        [0, true],
        [1, true],
        [2, true],
        [3, false],
      ]);
      // Names and parlors are exactly as the original had them.
      const renee = state?.players[2];
      expect(renee?.name).toBe("Renée “Z”");
      expect(renee?.parlor).toBe("Café des Morts");
      expect(renee?.money).toBe(99999);
      expect(h.server.host.list().find((t) => t.id === "old")?.players.registered).toBe(3);

      // The old password does not work; the new one does.
      const bad = new TestPlayer(h, "mort", "hunter2");
      await expect(bad.logIn()).rejects.toThrow();
      const mort = new TestPlayer(h, "mort", passwords.get("mort"));
      await mort.logIn();
      const view = await mort.enter("old", undefined);
      expect(view).toBeDefined();
      const desk = await toDesk(mort, "old");
      expect(buttonIds(desk)).toContain("desk:wait");
      const waited = await mort.press("desk:wait", "old");
      expect(waited).toBeDefined();
      const after = h.server.host.get("old")?.snapshotState.players[0];
      expect(after?.name).toBe("Mort");
      expect(after?.bp).toBe(77);
      expect(after?.tags).toEqual([5, 2, 0]);
      // The old day was kept: nothing ran at start.
      expect(h.server.host.get("old")?.snapshotState.day).toBe(42);
    } finally {
      await h.stop();
    }
  });

  it("--keep-passwords carries the old passwords across, hashed", async () => {
    const w = workDir();
    const r = await importLegacyTown(
      testConfig({ dbPath: w.dbPath }),
      { dir: w.old, townId: "old", keepPasswords: true },
      AT,
    );
    expect(r.passwordsFile).toBeNull();
    expect(r.accounts.every((a) => a.password === "kept")).toBe(true);
    const db = new DatabaseSync(w.dbPath, { readOnly: true });
    const row = db.prepare("SELECT password_hash FROM accounts WHERE login = 'mort'").get() as {
      password_hash: string;
    };
    db.close();
    expect(row.password_hash.startsWith("$argon2id$")).toBe(true);
    expect(row.password_hash).not.toContain("hunter2");

    const h = await startServer({ dir: w.dir, towns: [], clock: new FakeClock(AT) });
    try {
      await new TestPlayer(h, "mort", "hunter2").logIn();
      const ana = await new TestPlayer(h, "ana", "p@ss word").logIn();
      const view = await ana.enter("old", undefined);
      expect(view).toBeDefined();
    } finally {
      await h.stop();
    }
  });

  it("gives a log-on name the new rules refuse a legal account name, and says so", async () => {
    const w = workDir();
    const file = join(w.old, "data", "player.dat");
    const bytes = readFileSync(file);
    bytes.write("a b!\0", 52, "latin1"); // record 0 st_logon
    writeFileSync(file, bytes);
    const r = await importLegacyTown(
      testConfig({ dbPath: w.dbPath }),
      { dir: w.old, townId: "old", keepPasswords: true },
      AT,
    );
    const mort = r.accounts[0];
    expect(mort?.legacyLogon).toBe("a b!");
    expect(mort?.login).toBe("a_b_");
    expect(r.notes.some((n) => n.level === "warning" && n.message.includes('"a b!"'))).toBe(true);
    const h = await startServer({ dir: w.dir, towns: [], clock: new FakeClock(AT) });
    try {
      expect(h.server.host.get("old")?.snapshotState.players[0]?.logon).toBe("a_b_");
      const p = new TestPlayer(h, "a_b_", "hunter2");
      await p.logIn();
      expect(await p.enter("old", undefined)).toBeDefined();
    } finally {
      await h.stop();
    }
  });

  it("refuses a town id that exists, and a folder with no saves", async () => {
    const w = workDir();
    const config = testConfig({ dbPath: w.dbPath });
    await importLegacyTown(config, { dir: w.old, townId: "old", keepPasswords: true }, AT);
    await expect(
      importLegacyTown(
        config,
        { dir: w.old, townId: "old", passwordsFile: join(w.dir, "b.csv") },
        AT,
      ),
    ).rejects.toThrow(/already exists/);
    const empty = join(w.dir, "empty");
    mkdirSync(empty);
    await expect(importLegacyTown(config, { dir: empty, townId: "x" }, AT)).rejects.toThrow(
      LegacyImportError,
    );
    await expect(importLegacyTown(config, { dir: w.old, townId: "Bad Id" }, AT)).rejects.toThrow(
      /lowercase/,
    );
  });

  it("finds the files whatever their letter case, or loose in one folder", async () => {
    const w = workDir();
    const loose = join(w.dir, "loose");
    mkdirSync(loose);
    cpSync(join(w.old, "data", "player.dat"), join(loose, "PLAYER.DAT"));
    cpSync(join(w.old, "data", "config.dat"), join(loose, "Config.dat"));
    const r = await importLegacyTown(
      testConfig({ dbPath: w.dbPath }),
      { dir: loose, townId: "old", dryRun: true },
      AT,
    );
    expect(r.slots).toBe(4);
    expect(r.notes.some((n) => /no system\.dat/.test(n.message))).toBe(true);
  });
});
