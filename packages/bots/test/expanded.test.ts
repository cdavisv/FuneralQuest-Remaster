import type { Button, View } from "@fq/protocol";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  ALL_PERSONALITIES,
  ALL_PERSONALITY_IDS,
  BotRandom,
  createMemory,
  createPolicy,
  DIFFICULTIES,
  EXPANDED_ONLY_IDS,
  guideFrom,
  offered,
  type PersonalityId,
} from "../src/index.js";
import { playXTown, xContext } from "./xsupport.js";

/** Eight seats from the twelve personalities, a different slice and difficulty mix per seed. */
function field(
  seed: number,
): { personality: PersonalityId; difficulty: "easy" | "normal" | "hard" }[] {
  return Array.from({ length: 8 }, (_, i) => ({
    personality: ALL_PERSONALITY_IDS[(seed * 5 + i) % ALL_PERSONALITY_IDS.length] as PersonalityId,
    difficulty: DIFFICULTIES[(seed + i) % 3] ?? "hard",
  }));
}

describe("Expanded personalities", () => {
  it("every major Expanded strategy has a committed advocate", () => {
    const styles = ALL_PERSONALITIES.map((p) => p.expanded);
    expect(styles.every((s) => s !== undefined)).toBe(true);
    const has = (f: (s: NonNullable<(typeof styles)[number]>) => boolean) =>
      styles.some((s) => s && f(s));
    expect(has((s) => s.path === "good" && s.tithe > 0)).toBe(true);
    expect(has((s) => s.path === "evil" && s.graves)).toBe(true);
    expect(has((s) => s.monuments.upTo >= 5 && s.save)).toBe(true);
    expect(has((s) => s.mayor > 0)).toBe(true);
    expect(has((s) => s.gamble !== null)).toBe(true);
    expect(has((s) => s.chain === "found")).toBe(true);
    expect(has((s) => s.rivalry === "peaceful")).toBe(true);
    expect(has((s) => s.hits && s.duel)).toBe(true);
    expect(has((s) => s.borrow > 0)).toBe(true);
    expect(EXPANDED_ONLY_IDS.length).toBe(6);
    for (const p of ALL_PERSONALITIES) {
      for (const n of p.names) {
        expect(n.name.length).toBeLessThanOrEqual(20);
        expect(n.parlor.length).toBeLessThanOrEqual(20);
        expect(n.name + n.parlor).not.toMatch(/[?|=/;:,{}@+<>%$`]/);
      }
    }
  });
});

describe("7.2 and 28: the late upgrades come early (balance round 17)", () => {
  // docs/expanded-rules.md section 28 ("Late upgrades") and expanded-tuning-log.md round 17:
  // the Night Watchman and the Memorial Garden return BP once owned, but listed after the
  // embalming lab they were bought on day 26. Every personality that buys them lists them
  // after the storeroom and before the lab (the Watchman needs the alarm, listed before it).
  it("lists the Night Watchman and the Memorial Garden before the embalming lab", () => {
    let buyers = 0;
    for (const p of ALL_PERSONALITIES) {
      const list = p.expanded?.upgrades ?? [];
      for (const id of ["night-watchman", "memorial-garden"]) {
        const at = list.indexOf(id);
        if (at < 0) continue;
        buyers++;
        expect(at, `${p.id} ${id}`).toBeGreaterThan(list.indexOf("storeroom"));
        expect(at, `${p.id} ${id}`).toBeLessThan(list.indexOf("embalming-lab"));
      }
      if (list.includes("night-watchman"))
        expect(list.indexOf("alarm")).toBeLessThan(list.indexOf("night-watchman"));
    }
    expect(buyers).toBe(7);
  });
});

describe("a whole Expanded season", () => {
  for (const seed of [41, 42, 43]) {
    it(`town ${seed}: eight bots play 30 days with no stuck screen, rejection or error`, () => {
      const run = playXTown(seed, field(seed), 30);
      expect(run.stuck).toEqual([]);
      expect(run.errors).toEqual([]);
      expect(run.rejections.map((r) => `${r.reason} (offered ${r.offered})`)).toEqual([]);
      for (const seat of run.seats) {
        const p = run.town.players[seat.playerId];
        expect(p?.active).toBe(true);
        expect(p?.bp).toBeGreaterThan(0);
        expect(seat.memory.days).toBe(30);
        expect(seat.memory.x?.toured).toBe(true);
        expect(p?.expanded?.tutorial.done).toBe(true);
        expect(run.town.sessions[String(seat.playerId)]).toBeUndefined();
      }
    }, 240_000);
  }

  it("is deterministic: the same seed gives the same town and memories", () => {
    const a = playXTown(7, field(7), 4);
    const b = playXTown(7, field(7), 4);
    expect(JSON.stringify(b.town)).toBe(JSON.stringify(a.town));
    expect(JSON.stringify(b.seats.map((s) => s.memory))).toBe(
      JSON.stringify(a.seats.map((s) => s.memory)),
    );
    const c = playXTown(8, field(7), 4);
    expect(JSON.stringify(c.town)).not.toBe(JSON.stringify(a.town));
  }, 120_000);

  it("uses the town: every place and the main systems come up in a season", () => {
    const used = new Set<string>();
    const all = ALL_PERSONALITY_IDS.map((p) => ({ personality: p, difficulty: "hard" as const }));
    playXTown(44, all, 16, {
      onStep: (e) => {
        const a = e.action;
        if (a.type === "press") used.add(a.buttonId.split(":").slice(0, 2).join(":"));
        if (a.type === "visit") used.add(`visit:${a.placeId}`);
      },
    });
    for (const k of [
      "visit:graveyard",
      "visit:church",
      "visit:city-hall",
      "visit:reaper-club",
      "visit:hospital",
      "visit:bank",
      "neg:hand",
      "neg:pkg",
      "neg:listen",
      "neg:coffee",
      "neg:bless",
      "prep:opt",
      "parlor:buy",
      "store:casket",
      "graveyard:monument",
      "church:card",
      "city-hall:vote",
      "reaper-club:slots",
      "reaper-club:buy",
    ]) {
      expect([...used], k).toContain(k);
    }
  }, 240_000);
});

describe("unfamiliar Expanded screens", () => {
  const ids = [
    "go:desk",
    "go:map",
    "neg:done",
    "neg:back",
    "neg:soft",
    "neg:hand:0",
    "neg:pkg:flowers",
    "neg:offer:accept",
    "church:card:1",
    "graveyard:swing",
    "city-hall:vote:speed-limit",
    "reaper-club:draw:500",
    "bank:borrow",
    "prep:opt:0",
    "desk:quit",
    "mystery:7",
  ];
  const arbitraryView = fc
    .record({
      scene: fc.constantFrom("desk", "location", "map", "stats", "rankings", "news"),
      title: fc.constantFrom("At Home", "Church", "City Hall", "Somewhere New"),
      text: fc.array(fc.record({ text: fc.string({ maxLength: 40 }) }), { maxLength: 3 }),
      hud: fc.record({
        turns: fc.integer({ min: 0, max: 30 }),
        bpToday: fc.integer({ min: 0, max: 500 }),
        bpTotal: fc.integer({ min: 0, max: 30000 }),
        luck: fc.integer({ min: 1, max: 100 }),
        tags: fc.record({
          wood: fc.integer({ min: 0, max: 20 }),
          silver: fc.integer({ min: 0, max: 20 }),
          gold: fc.integer({ min: 0, max: 20 }),
        }),
        money: fc.integer({ min: 0, max: 100000 }),
        karma: fc.integer({ min: 1, max: 100 }),
        rating: fc.integer({ min: 0, max: 100 }),
      }),
      customer: fc.option(
        fc.record({
          incomeLabel: fc.constantFrom("Poor", "Rich"),
          moodLabel: fc.constantFrom("Crying", "Angry", "Natural"),
          moodLevel: fc.double({ min: 0, max: 9.9, noNaN: true }),
          total: fc.integer({ min: 0, max: 9000 }),
          name: fc.constantFrom("Doris Pickett", "Earl Ash"),
          estimate: fc.record({ low: fc.constant(1000), high: fc.constant(4000) }),
          patience: fc.record({ left: fc.integer({ min: 0, max: 9 }), max: fc.constant(9) }),
          traits: fc.constant([{ id: "haggler", label: "Haggler", hint: "" }]),
        }),
        { nil: undefined },
      ),
      buttons: fc.uniqueArray(
        fc.record({
          id: fc.constantFrom(...ids),
          label: fc.constantFrom("Continue", "Back", "Done", "Buy it", "Leave"),
          enabled: fc.boolean(),
          detail: fc.constantFrom(undefined, "$500", "+$800", "(+1 karma)"),
          group: fc.constantFrom(undefined, "more", "hand"),
        }),
        { selector: (b) => b.id, maxLength: 6 },
      ),
    })
    .map((v) => {
      const out = { ...v } as unknown as View;
      if (v.customer === undefined) delete out.customer;
      out.buttons = v.buttons.map((b) => {
        const c: Button = { id: b.id, label: b.label, enabled: b.enabled };
        if (b.detail !== undefined) c.detail = b.detail;
        if (b.group !== undefined) c.group = b.group;
        return c;
      });
      return out;
    }) as fc.Arbitrary<View>;

  it("always answers with something the screen offers (or log off)", () => {
    const guide = guideFrom(xContext().content);
    fc.assert(
      fc.property(
        arbitraryView,
        fc.integer(),
        fc.constantFrom(...ALL_PERSONALITY_IDS),
        fc.constantFrom(...DIFFICULTIES),
        fc.integer({ min: 0, max: 30 }),
        (view, seed, p, difficulty, steps) => {
          const memory = createMemory({
            playerId: 0,
            name: "Test Bot",
            parlor: "Test",
            personality: p,
            difficulty,
          });
          memory.session.steps = steps;
          const action = createPolicy(guide ? { guide } : {})({
            view,
            memory,
            rng: new BotRandom(seed),
          });
          expect(offered(view, action)).toBe(true);
        },
      ),
      { numRuns: 600 },
    );
  });
});
