import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Checks, diffJson } from "../src/checks.js";
import { schedule } from "../src/run.js";
import { Transcript } from "../src/transcript.js";
import { Gate } from "../src/world.js";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function transcript(): Transcript {
  const d = mkdtempSync(join(tmpdir(), "soak-test-"));
  dirs.push(d);
  return new Transcript(join(d, "t.jsonl.gz"), () => 0);
}

describe("the schedule", () => {
  const all = { kills: 4, restore: true, admin: true };

  it("puts every event inside the season, the restore after the backup", () => {
    for (const days of [2, 3, 5, 14, 30]) {
      const s = schedule(days, all);
      for (const d of [
        s.killQuiet,
        s.killInFlight,
        s.killMaintenance,
        s.backup,
        s.restore,
        s.adminMidPlay,
        s.settings,
        s.rollback,
      ]) {
        expect(d).toBeGreaterThanOrEqual(1);
        expect(d).toBeLessThanOrEqual(days);
      }
      expect(s.restore).toBeGreaterThan(s.backup as number);
      expect(s.killInFlight).toBeGreaterThanOrEqual(Math.min(2, days));
    }
  });

  it("the short mode still kills three times and forces no extra day", () => {
    const s = schedule(2, { kills: 3, restore: true, admin: true });
    expect(s.killReset).toBe(false);
    expect(s.forceNewDay).toBeNull();
    expect([s.killQuiet, s.killMaintenance, s.killInFlight]).toEqual([1, 1, 2]);
  });

  it("drops what is switched off", () => {
    const s = schedule(14, { kills: 3, restore: false, admin: false });
    expect(s.backup).toBeNull();
    expect(s.restore).toBeNull();
    expect(s.adminMidPlay).toBeNull();
    expect(s.forceNewDay).toBeNull();
  });
});

describe("diffJson", () => {
  it("names the paths that differ and skips ignored keys", () => {
    expect(diffJson({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2] })).toEqual([]);
    expect(diffJson({ a: 1, b: [1, 2] }, { a: 2, b: [1, 3] })).toEqual([
      "a: 1 != 2",
      "b.1: 2 != 3",
    ]);
    expect(diffJson({ online: true, x: 1 }, { online: false, x: 1 }, new Set(["online"]))).toEqual(
      [],
    );
    expect(diffJson({ a: 1 }, { a: 1, extra: 2 })).toEqual(["extra: undefined != 2"]);
  });
});

describe("the gate", () => {
  it("holds players while closed and reports when nothing is in flight", async () => {
    const gate = new Gate();
    gate.begin();
    gate.close("kill");
    let passed = false;
    const waiting = gate.pass().then(() => {
      passed = true;
    });
    let drained = false;
    const draining = gate.drained().then(() => {
      drained = true;
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(passed).toBe(false);
    expect(drained).toBe(false);
    gate.end();
    await draining;
    expect(drained).toBe(true);
    gate.close("other");
    gate.release("kill");
    await new Promise((r) => setTimeout(r, 10));
    expect(passed).toBe(false);
    gate.release("other");
    await waiting;
    expect(passed).toBe(true);
  });
});

describe("checks", () => {
  it("counts passes and keeps failures with the day", async () => {
    const t = transcript();
    const c = new Checks(t);
    process.env.SOAK_VERBOSE = "0";
    c.day = 3;
    c.ok("x", true, "fine");
    c.ok("x", false, "broken", { why: 1 });
    c.fail("y", "also broken");
    expect(c.tally()).toEqual({ x: { passed: 1, failed: 1 }, y: { passed: 0, failed: 1 } });
    expect(c.violations[0]).toMatchObject({ invariant: "x", message: "broken", day: 3 });
    await t.close();
  });
});

describe("the privacy check", () => {
  it("flags another player's secret, and lets a letter reach exactly one reader", async () => {
    const { SoakPlayer } = await import("../src/player.js");
    const t = transcript();
    const checks = new Checks(t);
    process.env.SOAK_VERBOSE = "0";
    const world = {
      transcript: t,
      checks,
      gate: new Gate(),
      secrets: new Map(),
      announcements: [],
      baseUrl: () => "http://127.0.0.1:1",
      wsUrl: () => "ws://127.0.0.1:1/api/ws",
      townId: "soak",
      gameNow: () => 0,
      day: () => 1,
      expectedOut: new Map(),
    };
    const spec = (label: string) => ({
      index: 0,
      label,
      guest: false,
      personality: "mourner" as const,
      difficulty: "normal" as const,
      form: { name: label, parlor: `${label} Rest`, male: true },
    });
    const policy = () => ({ type: "exit" as const });
    const a = new SoakPlayer(spec("a"), world, policy, 1);
    const b = new SoakPlayer(spec("b"), world, policy, 1);
    const c = new SoakPlayer(spec("c"), world, policy, 1);
    world.secrets.set(a.email, { owner: "a", kind: "email", maxOthers: 0, seenBy: new Set() });
    world.secrets.set("#abc123", { owner: "a", kind: "letter", maxOthers: 1, seenBy: new Set() });
    a.scanPrivate(`mine: ${a.email} #abc123`, "test");
    expect(checks.violations).toHaveLength(0);
    b.scanPrivate("a letter: hello #abc123", "test");
    expect(checks.violations).toHaveLength(0);
    c.scanPrivate("leaked #abc123", "test");
    expect(checks.violations.map((v) => v.invariant)).toEqual(["privacy"]);
    b.scanPrivate(`rankings ${a.email}`, "test");
    expect(checks.violations).toHaveLength(2);
    await t.close();
  });
});
