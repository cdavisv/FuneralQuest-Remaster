import type { View } from "@fq/protocol";
import fc from "fast-check";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  type BotMemory,
  BotRandom,
  createMemory,
  createPolicy,
  DIFFICULTIES,
  lovedFromMood,
  meetCustomer,
  offered,
  PERSONALITIES,
  PERSONALITY_IDS,
  type PolicyInput,
  personality,
  SKILLS,
  safeAction,
} from "../src/index.js";
import { playTown } from "./support.js";

const MIXED = PERSONALITY_IDS.map((p, i) => ({
  personality: p,
  difficulty: DIFFICULTIES[i % 3] ?? "normal",
}));

describe("personalities", () => {
  it("has at least five distinct personalities with names that pass the new-player form", () => {
    expect(PERSONALITIES.length).toBeGreaterThanOrEqual(5);
    for (const p of PERSONALITIES) {
      for (const n of p.names) {
        expect(n.name.length).toBeGreaterThanOrEqual(3);
        expect(n.name.length).toBeLessThanOrEqual(20);
        expect(n.parlor.length).toBeLessThanOrEqual(20);
        expect(n.name + n.parlor).not.toMatch(/[?|=/;:,{}@+<>%$`]/);
      }
    }
    const styles = new Set(
      PERSONALITIES.map((p) => JSON.stringify([p.sales, p.shopping, p.visits])),
    );
    expect(styles.size).toBe(PERSONALITIES.length);
  });
});

describe("a whole career", () => {
  // Every personality, in a mixed town, for 30 days, across several seeds.
  for (const seed of [11, 12, 13, 14]) {
    it(`town ${seed}: every bot plays 30 days with no stuck screen, rejection or error`, () => {
      const bots = [
        ...MIXED,
        { personality: PERSONALITY_IDS[seed % 6] ?? "shark", difficulty: "hard" as const },
      ];
      const run = playTown(seed, bots, 30);
      expect(run.stuck).toEqual([]);
      expect(run.errors).toEqual([]);
      expect(run.rejections.map((r) => `${r.reason} (offered ${r.offered})`)).toEqual([]);
      for (const seat of run.seats) {
        const p = run.town.players[seat.playerId];
        expect(p?.active).toBe(true);
        expect(p?.bp).toBeGreaterThan(0);
        expect(seat.memory.days).toBe(30);
        expect(run.town.sessions[String(seat.playerId)]).toBeUndefined();
      }
    }, 60_000);
  }

  it("is deterministic: the same seeds give the same town and memories", () => {
    const a = playTown(5, MIXED, 6);
    const b = playTown(5, MIXED, 6);
    expect(JSON.stringify(b.town)).toBe(JSON.stringify(a.town));
    expect(JSON.stringify(b.seats.map((s) => s.memory))).toBe(
      JSON.stringify(a.seats.map((s) => s.memory)),
    );
    const c = playTown(6, MIXED, 6);
    expect(JSON.stringify(c.town)).not.toBe(JSON.stringify(a.town));
  });

  it("skill matters: hard sellers earn more per day than easy ones", () => {
    const bp = (difficulty: "easy" | "hard") => {
      let total = 0;
      for (const seed of [21, 22]) {
        const run = playTown(
          seed,
          PERSONALITY_IDS.map((p) => ({ personality: p, difficulty })),
          8,
        );
        for (const s of run.seats) total += run.town.players[s.playerId]?.bp ?? 0;
      }
      return total;
    };
    expect(bp("hard")).toBeGreaterThan(bp("easy"));
  }, 60_000);
});

describe("fairness by construction", () => {
  it("a policy's input is the View, its own memory and its dice, nothing else", () => {
    expectTypeOf<keyof PolicyInput>().toEqualTypeOf<"view" | "memory" | "rng">();
    expectTypeOf<PolicyInput["view"]>().toEqualTypeOf<View>();
    // The memory holds no engine state: no town, sessions, players or customer record.
    expectTypeOf<BotMemory>().not.toHaveProperty("town");
    expectTypeOf<BotMemory>().not.toHaveProperty("sessions");
    expectTypeOf<BotMemory["customer"]>().not.toEqualTypeOf<{ moneyToSpend: number } | null>();
  });

  it("the same screen and memory give the same answer whatever the hidden state", () => {
    // Two customers who differ only in their hidden limit draw the same screen.
    const view: View = {
      scene: "location",
      title: "At Home",
      text: [
        {
          text: 'Old woman: "Please, I need a funeral service for my husband. I would need a plot and a Silver casket for him."',
        },
      ],
      customer: { incomeLabel: "Rich", moodLabel: "Natural", moodLevel: 2.4, total: 2600 },
      buttons: ["guilt", "sympathy", "hard", "soft", "done"].map((b) => ({
        id: `neg:${b}`,
        label: b,
      })),
    };
    const answers = new Set<string>();
    for (let i = 0; i < 3; i++) {
      const memory = createMemory({
        playerId: 1,
        name: "Vera Vulture",
        parlor: "Last Gasp",
        personality: "shark",
        difficulty: "hard",
      });
      memory.session.steps = 5;
      memory.session.lastAction = "press:desk:wait";
      answers.add(JSON.stringify(createPolicy()({ view, memory, rng: new BotRandom(9) })));
    }
    expect(answers.size).toBe(1);
  });
});

describe("unfamiliar screens", () => {
  const arbitraryView = fc.record({
    scene: fc.constantFrom("desk", "location", "map", "cafe", "news", "stats", "rankings"),
    title: fc.constantFrom("At Home", "Bank", "Store", "Somewhere New", "Parlors", "Yang's"),
    text: fc.array(fc.record({ text: fc.string({ maxLength: 40 }) }), { maxLength: 3 }),
    buttons: fc.uniqueArray(
      fc.record({
        id: fc.constantFrom(
          "go:desk",
          "go:map",
          "x:y",
          "script:1",
          "neg:done",
          "desk:quit",
          "store:buy",
          "mystery:7",
        ),
        label: fc.constantFrom("Continue", "Back", "Zap", "Buy it", "Leave", "Done"),
        enabled: fc.boolean(),
      }),
      { selector: (b) => b.id, maxLength: 5 },
    ),
  }) as fc.Arbitrary<View>;

  it("always answers with something the screen offers (or log off)", () => {
    fc.assert(
      fc.property(
        arbitraryView,
        fc.integer(),
        fc.constantFrom(...PERSONALITY_IDS),
        (view, seed, p) => {
          const memory = createMemory({
            playerId: 0,
            name: "Test Bot",
            parlor: "Test",
            personality: p,
            difficulty: "normal",
          });
          const action = createPolicy()({ view, memory, rng: new BotRandom(seed) });
          expect(offered(view, action)).toBe(true);
        },
      ),
      { numRuns: 400 },
    );
  });

  it("the safe action dismisses, declines, cancels or backs out", () => {
    const base: View = { scene: "location", title: "?", text: [], buttons: [] };
    expect(safeAction(base)).toEqual({ type: "exit" });
    expect(safeAction({ ...base, overlay: { kind: "message", id: "a:b", text: [] } })).toEqual({
      type: "dismiss",
      overlayId: "a:b",
    });
    expect(safeAction({ ...base, overlay: { kind: "confirm", id: "a:c", text: [] } })).toEqual({
      type: "confirm",
      overlayId: "a:c",
      accepted: false,
    });
    expect(
      safeAction({
        ...base,
        buttons: [
          { id: "z:z", label: "Zap" },
          { id: "q:q", label: "Back" },
        ],
      }),
    ).toEqual({ type: "press", buttonId: "q:q" });
  });
});

describe("reading customers", () => {
  it("reads the loved flag from the mood words a player sees", () => {
    expect(lovedFromMood("Crying", 3.5)).toBe(true);
    expect(lovedFromMood("Tight Lipped", 3.5)).toBe(false);
    expect(lovedFromMood("Frustrated", 6.6)).toBe(true);
    expect(lovedFromMood("Frustrated", 5.4)).toBe(false);
    expect(lovedFromMood("Angry", 8.5)).toBeNull();
  });

  it("takes the estimate and the casket from the arrival text", () => {
    const view: View = {
      scene: "location",
      title: "At Home",
      text: [
        {
          text: 'Teenage boy: "I would need a plot and a Gold casket for him."\n\nYou estimate he is worth about $7,240.',
        },
      ],
      customer: { incomeLabel: "Super Rich", moodLabel: "Pissed", moodLevel: 9.6, total: 5300 },
      buttons: [{ id: "neg:done", label: "Done" }],
    };
    const notes = meetCustomer(view, personality("scholar").sales, SKILLS.hard, new BotRandom(1));
    expect(notes.exact).toBe(7240);
    expect(notes.casket).toBe(2);
    expect(notes.lo).toBe(5300);
  });
});
