import { describe, expect, it } from "vitest";
import { duelOutlook, duelTable, shovePercent } from "../src/expanded/duel.js";

/** The three positions of docs/expanded-rules.md 16.4. */
describe("the duel solver", () => {
  it("swings an even fight, shoves when strong but nearly beaten, yields when weak and beaten", () => {
    const even = duelTable(10, 10).choose(40, 40, true);
    expect(even.move).toBe("swing");
    const strong = duelTable(15, 5).choose(3, 20, true);
    expect(strong.move).toBe("shove");
    expect(strong.values.shove).toBeGreaterThan(strong.values.swing);
    const weak = duelTable(5, 15).choose(3, 40, true);
    expect(weak.move).toBe("yield");
  });

  it("matches the engine's shove formula and values a fresh even duel above a yield", () => {
    expect(shovePercent(15, 5)).toBe(60);
    expect(shovePercent(5, 15)).toBe(10);
    expect(shovePercent(10, 10)).toBe(25);
    expect(duelOutlook(10, 10, 40, 40)).toBeGreaterThan(-0.1);
    expect(duelOutlook(4, 14, 30, 40)).toBeLessThan(0);
  });
});
