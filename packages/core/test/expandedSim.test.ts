/**
 * Multi-day Expanded play across many seeds (docs/expanded-rules.md section
 * 14): a random player and an exercise player that favours every new action.
 * Invariants after every action; every enabled button accepted; saves
 * round-trip mid-flow; no rejected actions.
 */
import { describe, expect, it } from "vitest";
import { makeXTown } from "./support/expanded.js";
import { xwalk } from "./support/xwalk.js";

describe("Expanded multi-day simulation (expanded-rules.md 14)", () => {
  it("random choices keep every invariant across seeds", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const { town, ctx } = makeXTown(seed * 101, 4);
      const r = xwalk(town, ctx, 4, { seed, days: 4 });
      expect(r.rejected, r.rejected.slice(0, 5).join("\n")).toEqual([]);
      expect(r.actions).toBeGreaterThan(400);
      const sold = r.town.players.reduce((sum, p) => sum + (p.expanded?.record.sales ?? 0), 0);
      expect(sold).toBeGreaterThan(20);
    }
  });

  it("an exercise player reaches every new action", () => {
    const used = new Map<string, number>();
    for (const seed of [11, 12, 13, 14]) {
      const { town, ctx } = makeXTown(seed * 7, 3);
      const r = xwalk(town, ctx, 3, {
        seed,
        days: 4,
        favourNew: true,
        setup: (t) => {
          for (const p of t.players) {
            p.money = 200_000;
            p.tags[2] = 200;
            // One saint, one sinner, one in between: the perk actions need karma extremes.
            p.karma = [90, 10, 50][p.id] ?? 50;
          }
        },
      });
      expect(r.rejected, r.rejected.slice(0, 5).join("\n")).toEqual([]);
      for (const [k, v] of r.used) used.set(k, (used.get(k) ?? 0) + v);
    }
    const wanted = [
      "neg:soft",
      "neg:hand:N",
      "neg:packages",
      "neg:coffee",
      "neg:listen",
      "neg:discount",
      "neg:cremation",
      "neg:bless",
      "neg:raise",
      "neg:back",
      "prep:start",
      "parlor:upgrades",
      "parlor:markup",
      "parlor:rivalry",
      "parlor:dig",
      "store:caskets",
      "tutorial:next",
    ];
    const missing = wanted.filter((k) => !used.has(k));
    expect(missing, [...used.keys()].sort().join(" ")).toEqual([]);
    expect([...used.keys()].some((k) => k.startsWith("neg:pkg:"))).toBe(true);
    expect([...used.keys()].some((k) => k.startsWith("prep:opt:"))).toBe(true);
    expect([...used.keys()].some((k) => k.startsWith("parlor:buy:"))).toBe(true);
  });
});
