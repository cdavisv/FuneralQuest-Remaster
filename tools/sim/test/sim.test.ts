import type { StepEvent } from "@fq/bots";
import { CLASSIC_RULES, classicContext, createPlayer, createTown, step } from "@fq/core";
import { describe, expect, it } from "vitest";
import {
  Collector,
  runSimulation,
  type SimOptions,
  simContent,
  simulateTown,
  toMarkdown,
} from "../src/index.js";

const SMALL: SimOptions = {
  days: 6,
  towns: 3,
  players: 6,
  rules: "classic",
  seed: 7,
  difficulty: "mixed",
};

describe("simulator", () => {
  it("plays towns, passes its checks and reports every section", async () => {
    const report = await runSimulation(SMALL, { workers: 0 });
    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.towns).toBe(3);
    expect(report.personalities.length).toBeGreaterThanOrEqual(5);
    expect(report.wait.counts.customer).toBeGreaterThan(0);
    expect(report.exactMatch.sales).toBeGreaterThan(0);
    expect(report.snowball.byDay).toHaveLength(6);
    expect(report.wins.reduce((a, w) => a + w.wins, 0)).toBe(3);
    expect(report.tags.income.sales).toBeGreaterThan(0);
    const md = toMarkdown(report);
    for (const heading of [
      "Win rate",
      "BP by personality",
      "psych level",
      "+200",
      "Wait for Customer",
      "Tags",
      "PvP",
      "Snowball",
    ]) {
      expect(md).toContain(heading);
    }
  }, 60_000);

  it("is deterministic, in this thread or in worker threads", async () => {
    const a = await runSimulation(SMALL, { workers: 0 });
    const b = await runSimulation(SMALL, { workers: 2 });
    const strip = (r: typeof a) => JSON.stringify({ ...r, durationMs: 0 });
    expect(strip(b)).toBe(strip(a));
  }, 60_000);

  it("runs the original rules (every fix off) and the oracle", () => {
    const content = simContent();
    const original = simulateTown(0, { ...SMALL, rules: "original", days: 3 }, content);
    expect(original.issues).toEqual([]);
    const oracle = simulateTown(0, { ...SMALL, oracle: true, days: 3 }, content);
    expect(oracle.issues).toEqual([]);
  }, 60_000);
});

const XSMALL: SimOptions = {
  days: 8,
  towns: 2,
  players: 6,
  rules: "expanded",
  seed: 3,
  difficulty: "mixed",
  lateJoin: 4,
  challenges: 1,
  personalities: [
    "saint",
    "necromancer",
    "tycoon",
    "saboteur",
    "politician",
    "gambler",
    "pacifist",
  ],
};

describe("Expanded simulator", () => {
  it("plays Expanded towns, passes its checks and reports the Expanded sections", async () => {
    const report = await runSimulation(XSMALL, { workers: 0 });
    expect(report.issues).toEqual([]);
    expect(report.ok).toBe(true);
    const x = report.expanded;
    expect(x).toBeDefined();
    if (!x) return;
    expect(x.seats.length).toBe(14);
    expect(x.seats.filter((s) => s.joined > 1)).toHaveLength(2);
    expect(x.challenge.length).toBe(7 * 3);
    expect(report.exactMatch.sales).toBeGreaterThan(0);
    const md = toMarkdown(report);
    for (const heading of [
      "Expanded: win rate by personality",
      "karma path",
      "money by system",
      "BP by system",
      "time by place",
      "what each choice returns",
      "Walkouts by trait",
      "PvP, duels and hits",
      "the house",
      "the bank",
      "City Hall and chains",
      "starts late",
      "Daily Challenge",
      "dead choices",
    ]) {
      expect(md).toContain(heading);
    }
  }, 240_000);

  it("is deterministic in worker threads too", async () => {
    const opts = { ...XSMALL, days: 3, challenges: 0 };
    const a = await runSimulation(opts, { workers: 0 });
    const b = await runSimulation(opts, { workers: 2 });
    const strip = (r: typeof a) => JSON.stringify({ ...r, durationMs: 0 });
    expect(strip(b)).toBe(strip(a));
  }, 240_000);
});

describe("checks", () => {
  const content = simContent();
  const ctx = classicContext(content, { now: 1 });
  let town = createTown({ seed: 3 }, ctx).town;
  const made = createPlayer(
    town,
    {
      logon: "tester",
      name: "Tess Ter",
      parlor: "Test Rest",
      password: "p",
      passwordVerify: "p",
      male: true,
      email: "t@t.tt",
    },
    ctx,
  );
  if (!made.ok) throw new Error("setup");
  town = made.town;
  const collector = () =>
    new Collector(3, 1, 1, CLASSIC_RULES, content, () => ({
      personality: "shark",
      difficulty: "hard",
      name: "Tess Ter",
    }));
  const toStore = step(
    step(
      step(town, 0, { type: "press", buttonId: "go:desk" }, ctx).town,
      0,
      { type: "press", buttonId: "go:map" },
      ctx,
    ).town,
    0,
    { type: "visit", placeId: "store" },
    ctx,
  );

  it("flags gold or turns gained at the store", () => {
    const c = collector();
    const after = structuredClone(toStore.town);
    const me = after.players[0];
    if (!me) throw new Error("no player");
    me.tags[2] = (me.tags[2] ?? 0) + 5;
    me.turns += 3;
    const event: StepEvent = {
      playerId: 0,
      before: toStore.town,
      view: toStore.view,
      action: { type: "press", buttonId: "store:hearse" },
      result: { ...toStore, town: after },
      fallback: false,
    };
    c.step(event);
    expect(c.report.issues.map((i) => i.detail)).toEqual([
      expect.stringContaining("gold tags gained at the store"),
      expect.stringContaining("turns gained at the store"),
    ]);
  });

  it("flags BP gained without a turn or event, and broken invariants", () => {
    const c = collector();
    const after = structuredClone(toStore.town);
    const me = after.players[0];
    if (!me) throw new Error("no player");
    me.bp += 50;
    me.tags[0] = -1;
    c.step({
      playerId: 0,
      before: toStore.town,
      view: toStore.view,
      action: { type: "press", buttonId: "go:map" },
      result: { ...toStore, town: after },
      fallback: false,
    });
    const kinds = c.report.issues.map((i) => `${i.kind}: ${i.detail}`);
    expect(kinds).toContainEqual(expect.stringMatching(/^invariant: tags -1/));
    expect(kinds).toContainEqual(
      expect.stringMatching(/^exploit: BP gained without a turn or event/),
    );
  });
});

describe("--set (rule numbers for one run)", () => {
  it("writes a rule number by its path and refuses a path that is not one", async () => {
    const { applyRuleSet } = await import("../src/index.js");
    const { EXPANDED_RULES } = await import("@fq/core");
    const rules = EXPANDED_RULES.expanded;
    if (!rules) throw new Error("no Expanded rules");
    const before = rules.town.placesA.police.aheadPerBp;
    try {
      applyRuleSet({ "town.placesA.police.aheadPerBp": before + 5 });
      expect(rules.town.placesA.police.aheadPerBp).toBe(before + 5);
      expect(() => applyRuleSet({ "town.placesA.police.nothing": 1 })).toThrow(/not a rule number/);
      expect(() => applyRuleSet({ "town.nowhere.at.all": 1 })).toThrow(/no rule/);
      expect(() => applyRuleSet({ "town.placesA.police": 1 })).toThrow(/not a rule number/);
    } finally {
      applyRuleSet({ "town.placesA.police.aheadPerBp": before });
    }
    expect(rules.town.placesA.police.aheadPerBp).toBe(before);
  });
});
