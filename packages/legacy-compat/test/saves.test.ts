/**
 * The 2001 save-file reader, against files written by the original server's own save code
 * (`test/fixtures/legacy-town/README.md`): `player_save` (player_file.cpp:92-131),
 * `file_config_save` (funeral_file.cpp:159-185) and `file_sys_save` (file_system.cpp:85-116).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  LEGACY_CONFIG_SIZE,
  LEGACY_PLAYER_SIZE,
  LEGACY_SYSTEM_SIZE,
  LegacySaveError,
  legacyString,
  mapLegacyTown,
  parseConfigDat,
  parsePlayerDat,
  parseSystemDat,
} from "../src/saves.js";

const dir = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "legacy-town");
const file = (...p: string[]) => new Uint8Array(readFileSync(join(dir, ...p)));

describe("player.dat", () => {
  const f = parsePlayerDat(file("data", "player.dat"));
  it("reads every record at the size the first header names", () => {
    expect(f.versionMajor).toBe(1);
    expect(f.recordSize).toBe(LEGACY_PLAYER_SIZE);
    expect(f.records.map((r) => r.player.id)).toEqual([0, 1, 2, 3]);
  });
  it("maps every field of a record", () => {
    const p = f.records[0]?.player;
    expect(p).toMatchObject({
      id: 0,
      active: true,
      name: "Mort",
      logon: "mort",
      parlor: "Mort's Mortuary",
      email: "mort@example.org",
      wantEmail: true,
      male: true,
      lastLogon: 1_000_000_000_000,
      lastPacket: 1_000_000_100_000,
      turns: 7,
      money: 1500,
      bp: 77,
      bpToday: 0,
      karma: 50,
      rating: 40,
      tags: [5, 2, 0],
      transportation: 0,
      plots: 0,
      dayLastLoggedOn: 11,
      luck: 50,
      strength: 3,
      hpMax: 10,
      hp: 10,
      canBeAttacked: true,
      policeProtected: false,
      mail: [],
    });
    expect(p?.custom).toHaveLength(200);
    expect(p?.custom[0]).toBe(1);
    expect(p?.custom[4]).toBe(100);
    expect(p?.custom[150]).toBe(4242);
    const ana = f.records[1];
    expect(ana?.player).toMatchObject({
      name: "Ana",
      male: false,
      policeProtected: true,
      transportation: 1,
      plots: 3,
      bpToday: 4,
      tagsReceivedToday: 1,
      yangsSent: 1,
      lastLogon: 1_000_003_600_000,
    });
    expect(ana?.player.custom[2]).toBe(1);
    expect(ana?.always).toBe(true);
    expect(f.records[2]?.player.kickedOutOfYangs).toBe(true);
  });
  it("keeps the plain-text password and addresses for the importer, apart from the player", () => {
    expect(f.records[0]?.password).toBe("hunter2");
    expect(f.records[1]?.password).toBe("p@ss word");
    expect(f.records[0]?.lastIp).toBe("127.0.0.1");
    expect(f.records[0]?.oldIp).toBe("192.168.1.2");
    expect(JSON.stringify(f.records[0]?.player)).not.toContain("hunter2");
  });
  it("decodes ANSI text exactly, accented letters and curly quotes included", () => {
    const p = f.records[2]?.player;
    expect(p?.name).toBe("Renée “Z”");
    expect(p?.parlor).toBe("Café des Morts");
  });
  it("keeps the deleted player's slot", () => {
    expect(f.records[3]?.player.active).toBe(false);
    expect(f.records[3]?.player.name).toBe("Gone");
  });
  it("reports what it did not carry", () => {
    expect(f.unmapped.map((u) => u.field)).toContain("last_ip, old_ip, b_always");
  });
  it("ignores a partial record at the end and says so", () => {
    const bytes = file("data", "player.dat");
    const longer = new Uint8Array(bytes.length + 100);
    longer.set(bytes);
    const g = parsePlayerDat(longer);
    expect(g.records).toHaveLength(4);
    expect(g.notes.some((n) => /partial record/.test(n.message))).toBe(true);
  });
  it("upgrades a record with no hit points as player_load did (player_file.cpp:64-72)", () => {
    const bytes = new Uint8Array(file("data", "player.dat"));
    new DataView(bytes.buffer).setInt32(324, 0, true); // record 0 i_hp_max
    const g = parsePlayerDat(bytes);
    expect(g.records[0]?.player).toMatchObject({
      hpMax: 10,
      hp: 10,
      strength: 2,
      canBeAttacked: true,
    });
    expect(g.notes.some((n) => /0\.62/.test(n.message))).toBe(true);
  });
  it("refuses a damaged or newer file", () => {
    expect(() => parsePlayerDat(new Uint8Array(10))).toThrow(LegacySaveError);
    const bytes = new Uint8Array(file("data", "player.dat"));
    new DataView(bytes.buffer).setInt32(8, 5000, true);
    expect(() => parsePlayerDat(bytes)).toThrow(/not one this reader knows/);
  });
  it("reads an older, shorter record layout, the missing tail as zero", () => {
    const old = new Uint8Array(1152 * 2);
    const src = file("data", "player.dat");
    for (let i = 0; i < 2; i++) old.set(src.subarray(i * 1248, i * 1248 + 1152), i * 1152);
    new DataView(old.buffer).setInt32(8, 1152, true);
    const g = parsePlayerDat(old);
    expect(g.records).toHaveLength(2);
    expect(g.records[1]?.player.name).toBe("Ana");
    expect(g.records[1]?.player.tagsReceivedToday).toBe(1);
    expect(g.notes.some((n) => /1152 bytes/.test(n.message))).toBe(true);
  });
});

describe("config.dat", () => {
  const c = parseConfigDat(file("data", "config.dat"));
  it("reads the day, tournament and settings", () => {
    expect(file("data", "config.dat").length).toBe(LEGACY_CONFIG_SIZE);
    expect(c.day).toBe(42);
    expect(c.lastMaintenance).toBe(1_000_003_600_000);
    expect(c.serverNews).toBe("Welcome to the old town!");
    expect(c.settings).toMatchObject({
      turnsPerDay: 20,
      startingMoney: 750,
      tournamentActive: true,
      tournamentDays: 60,
      risk: 40,
      luckOdds: 0.1,
      normalOdds: 0.09,
      scriptOdds: 0.06,
      nameChangeCost: 3,
      tagsReceivablePerDay: 2,
      visitsPerDay: 3,
      casketSp: [1, 3, 6],
      plotSp: 2,
      startingKarma: 50,
      startingRating: 40,
      startingLuck: 50,
      startingHp: 10,
      startingStrength: 3,
      yangsPerDay: 1,
      bonusExp: 20,
      bonusLuck: 25,
      tradeBonus: 25,
    });
    expect(c.topYesterday).toEqual({ name: "Mort", parlor: "Mort's Mortuary", bp: 77, id: 0 });
  });
  it("lists what it did not carry", () => {
    const fields = c.unmapped.map((u) => u.field);
    expect(fields).toContain("a_st_karma");
    expect(fields).toContain("a_st_rating");
    expect(fields).toContain("st_admin_email");
  });
  it("gives members an older file lacks the original's defaults (funeral_file.cpp:90-141)", () => {
    const bytes = new Uint8Array(file("data", "config.dat").subarray(0, 17400));
    const v = new DataView(bytes.buffer);
    v.setInt32(4, 62, true);
    v.setInt32(8, 17400, true);
    const g = parseConfigDat(bytes.length < 4060 ? bytes : bytes);
    expect(g.settings.visitsPerDay).toBe(2);
    expect(g.settings.bonusExp).toBe(20);
    expect(g.settings.startingHp).toBe(10);
    expect(g.settings.normalOdds).toBe(0.08);
    expect(g.settings.tagsReceivablePerDay).toBe(1);
    expect(g.settings.nameChangeCost).toBe(1);
    expect(g.day).toBe(42);
  });
  it("refuses a size field it cannot read", () => {
    const bytes = new Uint8Array(file("data", "config.dat"));
    new DataView(bytes.buffer).setInt32(8, LEGACY_CONFIG_SIZE + 4, true);
    expect(() => parseConfigDat(bytes)).toThrow(LegacySaveError);
  });
});

describe("system.dat", () => {
  it("reads the four settings the engine has and lists the rest", () => {
    expect(file("system.dat").length).toBe(LEGACY_SYSTEM_SIZE);
    const s = parseSystemDat(file("system.dat"));
    expect(s.settings).toEqual({
      maxPlayers: 123,
      inactiveDays: 21,
      maintDelete: false,
      swearFilter: false,
    });
    const port = s.unmapped.find((u) => u.field === "i_port");
    expect(port?.value).toBe("8080");
    expect(s.unmapped.find((u) => u.field.startsWith("st_license_game_name"))?.value).toContain(
      "Mort's Mortuary",
    );
  });
});

describe("the whole town", () => {
  it("maps the three files together", () => {
    const t = mapLegacyTown({
      playerDat: file("data", "player.dat"),
      configDat: file("data", "config.dat"),
      systemDat: file("system.dat"),
    });
    expect(t.day).toBe(42);
    expect(t.players).toHaveLength(4);
    expect(t.settings.maxPlayers).toBe(123);
    expect(t.settings.tournamentActive).toBe(true);
    expect(t.unmapped.length).toBeGreaterThan(5);
  });
  it("starts a new game with the original's defaults when files are missing", () => {
    const t = mapLegacyTown({});
    expect(t.day).toBe(0);
    expect(t.players).toEqual([]);
    expect(t.settings).toMatchObject({ turnsPerDay: 15, startingMoney: 500, maxPlayers: 800 });
    expect(t.notes.filter((n) => n.level === "warning")).toHaveLength(2);
  });
});

describe("legacyString", () => {
  it("stops at the first NUL and maps 0x80-0x9F as Windows-1252", () => {
    expect(legacyString(Uint8Array.of(0x41, 0x93, 0xe9, 0, 0x42), 0, 5)).toBe("A“é");
  });
});
