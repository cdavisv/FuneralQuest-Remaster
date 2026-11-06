import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ClassicRandom, MsvcRand, Mt19937 } from "../src/index.js";

describe("Mt19937 (legacy/source/shared/CRandom.cpp)", () => {
  // Expected values come from compiling the original CRandom.cpp with g++ and printing its output.
  it("matches the original C++ output for the default seed 4357", () => {
    const mt = new Mt19937(4357);
    const first = Array.from({ length: 10 }, () => mt.nextUint32());
    expect(first).toEqual([
      3510405877, 4290933890, 2191955339, 564929546, 152112058, 4262624192, 2687398418, 268830360,
      1763988213, 578848526,
    ]);
  });

  it("matches the original C++ output for Random(100) with seed 12345", () => {
    const mt = new Mt19937(12345);
    expect(Array.from({ length: 5 }, () => mt.random(100))).toEqual([20, 80, 30, 85, 59]);
  });

  it("defaults to seed 4357, as the original does when never seeded", () => {
    expect(new Mt19937().nextUint32()).toBe(3510405877);
  });

  it("returns 0 for random(0) without consuming a draw", () => {
    const a = new Mt19937(99);
    const b = new Mt19937(99);
    expect(a.random(0)).toBe(0);
    expect(a.nextUint32()).toBe(b.nextUint32());
  });

  it("reduces the raw output with a plain modulo", () => {
    const raw = new Mt19937(4357);
    const mod = new Mt19937(4357);
    expect(mod.random(100)).toBe(raw.nextUint32() % 100);
  });

  it("restarts the stream after a reseed", () => {
    const mt = new Mt19937(1);
    for (let i = 0; i < 1000; i++) mt.nextUint32();
    mt.seed(4357);
    expect(mt.nextUint32()).toBe(3510405877);
  });
});

describe("MsvcRand (Microsoft C runtime rand)", () => {
  it("matches the well-known sequence for srand(1)", () => {
    const crt = new MsvcRand(1);
    expect(Array.from({ length: 5 }, () => crt.next())).toEqual([41, 18467, 6334, 26500, 19169]);
  });
});

describe("ClassicRandom helpers (legacy/source/shared/all.cpp:888-929)", () => {
  it("randomRange is inclusive at both ends and hits both ends", () => {
    const rng = new ClassicRandom(7);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(rng.randomRange(7, 11));
    expect([...seen].sort((a, b) => a - b)).toEqual([7, 8, 9, 10, 11]);
  });

  it("randomRange with equal bounds returns the bound without a draw", () => {
    const a = new ClassicRandom(3);
    const b = new ClassicRandom(3);
    expect(a.randomRange(5, 5)).toBe(5);
    expect(a.random(1000)).toBe(b.random(1000));
  });

  it("frandom stays inside [0, max] and uses the C runtime stream", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), (seed) => {
        const rng = new ClassicRandom(1, seed);
        const value = rng.frandom(10);
        return value >= 0 && value <= 10;
      }),
    );
    // srand(1): first rand() is 41, so frandom(10) is 41 / 32767 * 10 in float32.
    const rng = new ClassicRandom(1, 1);
    expect(rng.frandom(10)).toBe(Math.fround(Math.fround(Math.fround(41) / 32767) * 10));
  });

  describe("randomYesNo (legacy/source/funeral_util.cpp:77-83)", () => {
    const passRate = (luck: number, weight: number) => {
      const rng = new ClassicRandom(2024);
      let passes = 0;
      const trials = 20000;
      for (let i = 0; i < trials; i++) if (rng.randomYesNo(luck, weight)) passes++;
      return passes / trials;
    };

    it("at weight 0.90 gives about 51% at luck 50, 96% at luck 100, 6% at luck 1", () => {
      // Effective luck: 50 -> 50, 100 -> 95, 1 -> 5 (1 + trunc(4.9)); pass when roll <= luck.
      expect(passRate(50, 0.9)).toBeCloseTo(0.51, 1);
      expect(passRate(100, 0.9)).toBeCloseTo(0.96, 1);
      expect(passRate(1, 0.9)).toBeCloseTo(0.06, 1);
    });

    it("consumes exactly one integer draw", () => {
      const a = new ClassicRandom(11);
      const b = new ClassicRandom(11);
      a.randomYesNo(50, 0.9);
      b.random(100);
      expect(a.random(1000)).toBe(b.random(1000));
    });
  });
});
