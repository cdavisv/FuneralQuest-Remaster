import { describe, expect, it } from "vitest";
import { AMBIENCES } from "../src/ambience/index.js";
import { EFFECTS } from "../src/sfx/effects.js";
import { UI_SOUNDS } from "../src/sfx/ui.js";

const SR = 48000;

const finiteAndBounded = (x: Float32Array) => {
  let p = 0;
  for (const v of x) {
    if (!Number.isFinite(v)) return Number.POSITIVE_INFINITY;
    p = Math.max(p, Math.abs(v));
  }
  return p;
};

describe("one-shot effects", () => {
  const all = [...UI_SOUNDS, ...EFFECTS];

  it("have unique ids", () => {
    expect(new Set(all.map((d) => d.id)).size).toBe(all.length);
  });

  for (const d of all) {
    it(`${d.id} is deterministic, bounded and starts and ends on silence`, () => {
      const a = d.render(SR);
      const b = d.render(SR);
      expect(a.l).toEqual(b.l);
      expect(a.r).toEqual(b.r);
      const n = a.l.length;
      expect(n / SR).toBeGreaterThanOrEqual(0.02);
      expect(n / SR).toBeLessThanOrEqual(6);
      for (const ch of [a.l, a.r]) {
        expect(finiteAndBounded(ch)).toBeLessThanOrEqual(1);
        expect(Math.abs(ch[0] as number)).toBeLessThan(1e-3);
        expect(Math.abs(ch[n - 1] as number)).toBeLessThan(1e-3);
      }
    });
  }

  it("UI sounds are cheap enough to synthesise in the browser", () => {
    for (const d of UI_SOUNDS) d.render(SR); // warm up the JIT
    for (const d of UI_SOUNDS) {
      const t0 = performance.now();
      d.render(SR);
      expect(performance.now() - t0, d.id).toBeLessThan(30);
      expect(d.delivery).toBe("live");
    }
  });
});

describe("ambience beds", () => {
  for (const d of AMBIENCES) {
    it(`${d.id} has its exact length, no DC, no clipping and a seamless join`, () => {
      const a = d.render(SR);
      const n = Math.round(d.seconds * SR);
      expect(a.l.length).toBe(n);
      expect(a.r.length).toBe(n);
      for (const ch of [a.l, a.r]) {
        expect(finiteAndBounded(ch)).toBeLessThanOrEqual(1);
        let sum = 0;
        for (const v of ch) sum += v;
        expect(Math.abs(sum / n)).toBeLessThan(1e-3);
        // first differences of the whole loop, and the one across the join
        const diffs = new Float64Array(n - 1);
        let mean = 0;
        for (let i = 1; i < n; i++) {
          diffs[i - 1] = (ch[i] as number) - (ch[i - 1] as number);
          mean += diffs[i - 1] as number;
        }
        mean /= n - 1;
        let varSum = 0;
        for (const v of diffs) varSum += (v - mean) ** 2;
        const sd = Math.sqrt(varSum / (n - 1));
        const abs = Array.from(diffs, Math.abs).sort((x, y) => x - y);
        const median = abs[Math.floor(abs.length / 2)] as number;
        const join = (ch[0] as number) - (ch[n - 1] as number);
        // A step at the join is larger than the signal's typical slope, or (where the join
        // falls on a steep but smooth stretch, a gust say) larger than the slopes next to it.
        let local = 0;
        for (let i = 1; i < 1000; i++) {
          local = Math.max(
            local,
            Math.abs(diffs[i - 1] as number),
            Math.abs(diffs[n - 1 - i] as number),
          );
        }
        expect(Math.abs(join)).toBeLessThanOrEqual(Math.max(4 * median + 1e-3, 1.25 * local));
        expect(Math.abs(join - mean)).toBeLessThanOrEqual(3 * sd);
        // and the slope does not jump: the second difference across the join is ordinary
        const d2 = Array.from(
          { length: n - 2 },
          (_, i) => (diffs[i + 1] as number) - (diffs[i] as number),
        );
        const sd2 = Math.sqrt(d2.reduce((acc, v) => acc + v * v, 0) / d2.length);
        expect(Math.abs(join - (diffs[n - 2] as number))).toBeLessThanOrEqual(5 * sd2 + 1e-6);
      }
    });
  }

  it("is deterministic", () => {
    const d = AMBIENCES[0];
    if (!d) throw new Error("no ambience");
    expect(d.render(SR).l).toEqual(d.render(SR).l);
  });
});
