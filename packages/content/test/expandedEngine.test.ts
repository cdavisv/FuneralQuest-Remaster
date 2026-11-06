/**
 * The Expanded pack under the Expanded ruleset: several simulated days with core's random walker
 * (every enabled button accepted, invariants after every action) and with the scripted seats of the
 * balance checks (docs/expanded-rules.md sections 14 and 15).
 */
import { expandedContext } from "@fq/core";
import { describe, expect, it } from "vitest";
import { makeXTown } from "../../core/test/support/expanded.js";
import { type Strategy, XDriver } from "../../core/test/support/xpolicy.js";
import { xwalk } from "../../core/test/support/xwalk.js";
import { expandedPack } from "../src/index.js";

const ctx = expandedContext(expandedPack, { now: 1_000_000 });

describe("the Expanded pack plays under the Expanded ruleset", { timeout: 300_000 }, () => {
  it("uses the pack's own content, not the starter", () => {
    // The engine may add sections the pack lacks (core fills the town starter in), never replace ours.
    for (const [k, v] of Object.entries(expandedPack.expanded ?? {})) {
      expect((ctx.content.expanded as unknown as Record<string, unknown>)[k], k).toBe(v);
    }
  });

  it("random play: 4 seeds x 4 players x 4 days, no rejected action, invariants hold", () => {
    for (const seed of [3, 17, 29, 41]) {
      const { town } = makeXTown(seed * 101, 4, { ctx });
      const r = xwalk(town, ctx, 4, { seed, days: 4 });
      expect(r.rejected, r.rejected.slice(0, 5).join("\n")).toEqual([]);
      const sold = r.town.players.reduce((n, p) => n + (p.expanded?.record.sales ?? 0), 0);
      expect(sold).toBeGreaterThan(20);
    }
  });

  it("an exercise player reaches every new action with this pack's content", () => {
    const used = new Map<string, number>();
    for (const seed of [5, 6, 7]) {
      const { town } = makeXTown(seed * 7, 3, { ctx });
      const r = xwalk(town, ctx, 3, {
        seed,
        days: 4,
        favourNew: true,
        setup: (t) => {
          for (const p of t.players) {
            p.money = 200_000;
            p.tags[2] = 200;
            p.karma = [90, 10, 50][p.id] ?? 50;
          }
        },
      });
      expect(r.rejected, r.rejected.slice(0, 5).join("\n")).toEqual([]);
      for (const [k, v] of r.used) used.set(k, (used.get(k) ?? 0) + v);
    }
    for (const k of [
      "neg:coffee",
      "neg:listen",
      "neg:discount",
      "neg:packages",
      "neg:cremation",
      "prep:start",
    ]) {
      expect(used.has(k), k).toBe(true);
    }
    expect([...used.keys()].some((k) => k.startsWith("prep:opt:"))).toBe(true);
  });

  it("scripted seats (reader, random, balanced, good, evil) play 6 days in one town", () => {
    const seats: Strategy[] = [
      { name: "reader", seller: "reader", spending: "none", morals: "neutral" },
      { name: "random", seller: "random", spending: "none", morals: "neutral" },
      { name: "balanced", seller: "reader", spending: "balanced", morals: "neutral" },
      { name: "good", seller: "reader", spending: "balanced", morals: "good" },
      { name: "evil", seller: "reader", spending: "balanced", morals: "evil" },
    ];
    const { town } = makeXTown(2026, seats.length, { ctx });
    const d = new XDriver(town, ctx, seats, 2026);
    for (let day = 0; day < 6; day++) d.day();
    expect(d.town.day).toBeGreaterThanOrEqual(6);
    for (const [i, s] of d.stats.entries()) expect(s.sales, seats[i]?.name).toBeGreaterThan(5);
    for (const p of d.town.players) {
      expect(p.bp).toBeGreaterThan(0);
      expect(p.money).toBeGreaterThanOrEqual(0);
    }
  });
});
