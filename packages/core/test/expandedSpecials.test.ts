/**
 * Special customers (docs/expanded-rules.md section 3.8), trait effects
 * (3.3) and leaving mid-sale (3.9).
 */
import { describe, expect, it } from "vitest";
import {
  addModifier,
  EXPANDED_STARTER,
  type ExpandedContent,
  expandedContext,
  leaveGame,
  MODIFIER_KEYS,
  richTextToPlain,
  type TownState,
} from "../src/index.js";
import { legacyContent } from "./support/legacyContent.js";
import { atXDesk, cust, ids, meet, px, type XPlaced } from "./support/xplaces.js";

/** Player 0 at the desk in a town where every customer is the special `id`. */
function withSpecial(id: string, seed = 61, setup?: (t: TownState) => void): XPlaced {
  const only = EXPANDED_STARTER.specials.filter((s) => s.id === id);
  const content: ExpandedContent = { ...EXPANDED_STARTER, specials: only };
  const ctx = expandedContext({ ...legacyContent(), expanded: content });
  const p = atXDesk({
    seed,
    setup: (t) => {
      addModifier(t, {
        key: MODIFIER_KEYS.specialChance,
        op: "mul",
        value: 1000,
        untilDay: 99,
        source: "test",
      });
      setup?.(t);
    },
  });
  // atXDesk built its own context; replay the same town under this one.
  return { ...p, ctx };
}

describe("3.8 special customers", () => {
  it("the mob boss never walks out; at mood 10 he threatens and nobody gets the body", () => {
    let p = meet(
      withSpecial("mob-boss", 62, (t) => {
        t.day = 5;
      }),
      (c) => {
        c.mood = 10;
      },
    );
    expect(p.view.customer?.special).toBe("Mob Boss");
    expect(p.view.customer?.name).toBe("Vincent Morticelli");
    const rivals = p.town.players.slice(1).map((q) => q.bp);
    p = px(p, "neg:sympathy");
    expect(richTextToPlain(p.view.text)).toMatch(/disappoint/);
    expect(p.town.players.slice(1).map((q) => q.bp)).toEqual(rivals);
  });

  it("the mob boss, happy, grants protection and gold", () => {
    let p = meet(
      withSpecial("mob-boss", 63, (t) => {
        t.day = 5;
      }),
      (c) => {
        c.mood = 1;
      },
    );
    const gold = p.town.players[0]?.tags[2] ?? 0;
    const goldCasket = cust(p).desiredCasket === 2 ? 1 : 0;
    p = px(p, "neg:done");
    expect(p.town.players[0]?.policeProtected).toBe(true);
    expect(p.town.players[0]?.tags[2]).toBe(gold + 2 + goldCasket);
  });

  it("a pet funeral is cheap, needs no plot, and the pet is named", () => {
    let p = meet(withSpecial("pet"));
    const x = cust(p).expanded;
    expect(x.pet).not.toBe("");
    expect(x.casketPrices[0]).toBe(200);
    expect(p.view.customer?.deceased).toMatch(/ the /);
    expect(cust(p).loved).toBe(true);
    const plots = p.town.players[0]?.plots ?? 0;
    p = px(p, "neg:packages");
    expect(ids(p.view)).not.toContain("neg:pkg:plot");
    p = px(px(p, "neg:back"), "neg:done");
    expect(p.town.players[0]?.plots).toBe(plots);
  });

  it("a pre-need planner pays again on a later day", () => {
    let p = meet(withSpecial("pre-need"));
    p = px(p, "neg:done");
    const futures = p.town.players[0]?.expanded?.futures ?? [];
    expect(futures).toHaveLength(1);
    expect(futures[0]?.day).toBeGreaterThan(p.town.day + 1);
  });

  it("the county contract is a flat offer with two buttons", () => {
    let p = meet(withSpecial("county-contract"));
    expect(ids(p.view)).toEqual(["neg:offer:accept", "neg:offer:decline"]);
    const karma = p.town.players[0]?.karma ?? 0;
    const money = p.town.players[0]?.money ?? 0;
    p = px(p, "neg:offer:accept");
    expect(p.town.players[0]?.karma).toBe(karma + 2);
    expect(p.town.players[0]?.money).toBe(money + 300);
    expect(ids(p.view)).toEqual(["go:desk"]);
  });

  it("the celebrity always makes the TV", () => {
    let p = meet(withSpecial("celebrity"), (c) => {
      c.mood = 1;
      c.desiredCasket = 0;
      c.moneyToSpend = 18000;
    });
    const r = px(p, "neg:done");
    p = r;
    expect(p.town.players[0]?.expanded?.record.sales).toBe(1);
  });
});

describe("3.3 trait effects", () => {
  it("Heartbroken forces the loved flag, Estranged clears it", () => {
    let loved = 0;
    let estranged = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const c = cust(meet(atXDesk({ seed })));
      if (c.expanded.traits.includes("heartbroken")) {
        loved++;
        expect(c.loved).toBe(true);
      }
      if (c.expanded.traits.includes("estranged")) {
        estranged++;
        expect(c.loved).toBe(false);
      }
      expect(
        c.expanded.traits.includes("heartbroken") && c.expanded.traits.includes("estranged"),
      ).toBe(false);
    }
    expect(loved + estranged).toBeGreaterThan(0);
  });
});

describe("3.9 leaving mid-sale", () => {
  it("completes the sale and mails it, as Classic does", () => {
    const p = meet(atXDesk({ seed: 71 }));
    const bp = p.town.players[0]?.bp ?? 0;
    const r = leaveGame(p.town, 0, p.ctx);
    expect(r.town.players[0]?.bp).toBeGreaterThan(bp);
    expect(r.town.players[0]?.mail.some((m) => m.type === "text" && /fainted/.test(m.text))).toBe(
      true,
    );
    expect(r.town.players[0]?.expanded?.record.sales).toBe(1);
  });
});
