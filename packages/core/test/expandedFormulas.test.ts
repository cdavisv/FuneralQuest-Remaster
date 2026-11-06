/**
 * Pure formulas of the Expanded ruleset. Each test names its section of
 * docs/expanded-rules.md.
 */
import { describe, expect, it } from "vitest";
import {
  addModifier,
  baseSaleBp,
  ClassicRandom,
  closenessBonus,
  computeRating,
  EXPANDED,
  EXPANDED_RULES,
  estimateHalfShare,
  gridLimit,
  liveModifiers,
  MODIFIER_KEYS,
  makeEstimate,
  markedUp,
  modValue,
  narrowEstimate,
  newExpandedPlayer,
  type PlayerState,
  perksOf,
  pruneModifiers,
  pvpGain,
  type TownState,
  underdogShare,
  wholesalePrice,
} from "../src/index.js";

const X = EXPANDED;

describe("3.1 limits on the $50 grid", () => {
  it("draws only grid points inside the band", () => {
    const rng = new ClassicRandom(7, 7);
    for (let i = 0; i < 2000; i++) {
      const limit = gridLimit(rng, 850, 2800, 50);
      expect(limit % 50).toBe(0);
      expect(limit).toBeGreaterThanOrEqual(850);
      expect(limit).toBeLessThanOrEqual(2800);
    }
  });
});

describe("3.6 the estimate", () => {
  it("half-width shrinks with psych, with diminishing returns, and stops at the cap", () => {
    const shares = [0, 1, 2, 3, 4, 5, 6, 7, 8, 12].map((p) => estimateHalfShare(X, p));
    expect(shares[0]).toBeCloseTo(0.4, 5);
    for (let i = 1; i < 8; i++) expect(shares[i] as number).toBeLessThan(shares[i - 1] as number);
    // Each level buys less than the one before.
    const gains = shares.slice(0, 8).map((s, i) => (i === 0 ? 0 : (shares[i - 1] as number) - s));
    for (let i = 2; i < 8; i++) expect(gains[i] as number).toBeLessThan(gains[i - 1] as number);
    // Capped: levels above the maximum change nothing.
    expect(shares[8]).toBe(shares[7]);
    expect(shares[9]).toBe(shares[7]);
    expect(shares[7] as number).toBeGreaterThan(0.12);
  });

  it("always contains the limit, sits on the grid, and the limit is spread across it", () => {
    const rng = new ClassicRandom(3, 3);
    let lowerHalf = 0;
    const n = 3000;
    for (let i = 0; i < n; i++) {
      const limit = gridLimit(rng, 850, 18500, 50);
      const psych = i % 8;
      const e = makeEstimate(rng, X, limit, estimateHalfShare(X, psych));
      expect(e.low).toBeLessThanOrEqual(limit);
      expect(e.high).toBeGreaterThanOrEqual(limit);
      expect(e.low % 50).toBe(0);
      expect(e.high % 50).toBe(0);
      expect(e.high - e.low).toBeGreaterThanOrEqual(X.psych.estimate.minWidth);
      if (limit < (e.low + e.high) / 2) lowerHalf++;
    }
    // The middle is not the answer: about half the limits are below it.
    expect(lowerHalf / n).toBeGreaterThan(0.4);
    expect(lowerHalf / n).toBeLessThan(0.6);
  });
});

describe("3.5 a limit tell halves the estimate", () => {
  it("keeps the half with the limit", () => {
    const e = { low: 1000, high: 3000 };
    expect(narrowEstimate(e, 2500, 50)).toEqual({
      estimate: { low: 2000, high: 3000 },
      upper: true,
    });
    expect(narrowEstimate(e, 1200, 50)).toEqual({
      estimate: { low: 1000, high: 2000 },
      upper: false,
    });
    expect(narrowEstimate({ low: 1000, high: 1050 }, 1000, 50).estimate).toEqual({
      low: 1000,
      high: 1050,
    });
  });
});

describe("3.7 scoring", () => {
  it("base BP is int(bill x 0.0064)", () => {
    expect(baseSaleBp(800, 0.0064)).toBe(5);
    expect(baseSaleBp(5300, 0.0064)).toBe(33);
    expect(baseSaleBp(10000, 0.0064)).toBe(64);
  });

  it("closeness bonuses are shares of the sale and explained by tier", () => {
    const base = 40;
    expect(closenessBonus(X, 6250, 6250, base)).toEqual({
      key: "exact",
      bonus: Math.ceil(base * X.scoring.exact.share) + X.scoring.exact.flat,
      percent: 0,
    });
    // Within 3%: +30% of the sale.
    expect(closenessBonus(X, 6100, 6250, base)).toEqual({ key: "great", bonus: 12, percent: 3 });
    // Within 8%: +15%.
    expect(closenessBonus(X, 5800, 6250, base)).toEqual({ key: "nice", bonus: 6, percent: 8 });
    expect(closenessBonus(X, 5000, 6250, base).key).toBeNull();
    expect(closenessBonus(X, 6300, 6250, base).key).toBeNull();
  });

  it("the exact bonus is reachable: every price and limit is on the same grid", () => {
    // Classic: limits were any dollar and items $50 steps, so only 1 limit in 50 could be hit.
    const rng = new ClassicRandom(11, 11);
    for (let i = 0; i < 500; i++) expect(gridLimit(rng, 850, 18500, 50) % 50).toBe(0);
    for (const tier of [800, 2600, 5300])
      for (const m of X.markup.options) expect(markedUp(tier, m, 50) % 50).toBe(0);
  });
});

describe("6 money", () => {
  it("6.3 markup rounds to the grid; 6.2 wholesale is a share of list", () => {
    expect(markedUp(800, 0, 50)).toBe(800);
    expect(markedUp(800, 10, 50)).toBe(900);
    expect(markedUp(5300, 30, 50)).toBe(6900);
    expect(markedUp(800, -10, 50)).toBe(700);
    expect(wholesalePrice(X, 800)).toBe(600);
    expect(wholesalePrice(X, 2600)).toBe(1950);
    expect(wholesalePrice(X, 5300)).toBe(4000);
  });
});

function player(over: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 0,
    active: true,
    name: "A",
    logon: "a",
    parlor: "P",
    email: "",
    wantEmail: false,
    male: true,
    lastLogon: 0,
    lastPacket: 0,
    accountCreated: 0,
    dayCreated: 1,
    turns: 0,
    money: 0,
    bp: 0,
    bpToday: 0,
    karma: 50,
    rating: 0,
    tags: [0, 0, 0],
    incinerator: false,
    transportation: 0,
    plots: 0,
    dayLastLoggedOn: 1,
    luck: 50,
    yangsSent: 0,
    psych: 0,
    kickedOutOfYangs: false,
    strength: 3,
    hpMax: 10,
    hp: 10,
    playerFights: 0,
    canBeAttacked: true,
    policeProtected: false,
    custom: [],
    tagsReceivedToday: 0,
    mail: [],
    expanded: newExpandedPlayer(X),
    ...over,
  };
}

describe("7.1 rating", () => {
  it("adds base, upgrades, hearse, plots, word of mouth, karma and markup", () => {
    expect(computeRating(EXPANDED_RULES, player())).toBe(10);
    const p = player({ plots: 100, transportation: 2, karma: 90 });
    const x = p.expanded;
    if (!x) throw new Error("no expanded");
    x.upgrades = ["paint", "chapel"];
    x.reviews = 5;
    x.markup = 20;
    // base 10 + paint 3 + chapel 8 + Medalist 3 + plots 100/20 + reviews 5 + karma 85+ + markup 20% x ratingPer10
    expect(computeRating(EXPANDED_RULES, p)).toBe(
      10 + 3 + 8 + 3 + 5 + 5 + X.rating.karmaBonus[1] + 2 * X.markup.ratingPer10,
    );
    expect(computeRating(EXPANDED_RULES, player({ karma: 5 }))).toBe(10 + X.rating.karmaPenalty[1]);
    expect(computeRating(EXPANDED_RULES, player({ karma: 100, plots: 10_000 }))).toBe(
      10 + 15 + X.rating.karmaBonus[1],
    );
  });
});

describe("8.3 karma perks", () => {
  it("unlock at the thresholds, two per side", () => {
    expect(perksOf(X, 50)).toEqual([]);
    expect(perksOf(X, 70)).toEqual(["trusted"]);
    expect(perksOf(X, 85)).toEqual(["church-associate", "trusted"]);
    expect(perksOf(X, 30)).toEqual(["grave-robber"]);
    expect(perksOf(X, 15)).toEqual(["necromancer", "grave-robber"]);
  });
});

describe("9.1 PvP gains", () => {
  it("grow less than linearly with the victim's total and are capped", () => {
    expect(pvpGain(X, 0)).toBe(0);
    // min(cap, floor(factor x sqrt(total))): 10, 20, 40, 80 x the factor, until the cap.
    const f = X.pvp.gainFactor;
    expect(pvpGain(X, 100)).toBe(Math.min(X.pvp.gainCap, Math.floor(f * 10)));
    expect(pvpGain(X, 400)).toBe(Math.min(X.pvp.gainCap, Math.floor(f * 20)));
    expect(pvpGain(X, 1600)).toBe(Math.min(X.pvp.gainCap, Math.floor(f * 40)));
    expect(pvpGain(X, 6400)).toBe(Math.min(X.pvp.gainCap, Math.floor(f * 80)));
    expect(pvpGain(X, 6400) / 6400).toBeLessThan(pvpGain(X, 100) / 100);
    expect(pvpGain(X, 1_000_000)).toBe(X.pvp.gainCap);
    // Classic took 2% of the total: 20,000 BP for a 1,000,000 BP victim.
    expect(pvpGain(X, 40000) / 40000).toBeLessThan(0.02 / 5);
  });
});

describe("9.4 underdog bonus", () => {
  it("helps only parlors below 70% of the leader, at most 25% of a sale", () => {
    expect(underdogShare(X, 0, 0)).toBe(0);
    expect(underdogShare(X, 800, 1000)).toBe(0);
    expect(underdogShare(X, 600, 1000)).toBeCloseTo(0.2, 5);
    expect(underdogShare(X, 0, 1000)).toBe(0.25);
  });

  it("a parlor that opened late catches up harder, almost to the leader", () => {
    const u = X.underdog.late;
    expect(underdogShare(X, 900, 1000, true)).toBeCloseTo(Math.min(u.max, u.scale * 0.1), 5);
    expect(underdogShare(X, Math.ceil(1000 * u.below), 1000, true)).toBe(0);
    expect(underdogShare(X, 0, 1000, true)).toBe(u.max);
    expect(underdogShare(X, 900, 1000, false)).toBe(0);
  });
});

describe("12.2 rule modifiers", () => {
  it("apply adds then multiplies while live, and are pruned after", () => {
    const town = { day: 5 } as TownState;
    expect(modValue(town, MODIFIER_KEYS.limitMult, 1)).toBe(1);
    addModifier(town, {
      key: MODIFIER_KEYS.limitMult,
      op: "mul",
      value: 2,
      untilDay: 6,
      source: "news:test",
    });
    addModifier(town, {
      key: MODIFIER_KEYS.limitMult,
      op: "add",
      value: 0.5,
      untilDay: 5,
      source: "news:test",
    });
    expect(modValue(town, MODIFIER_KEYS.limitMult, 1)).toBe(3);
    town.day = 6;
    expect(modValue(town, MODIFIER_KEYS.limitMult, 1)).toBe(2);
    expect(liveModifiers(town, MODIFIER_KEYS.limitMult)).toHaveLength(1);
    town.day = 7;
    pruneModifiers(town);
    expect(town.expanded?.modifiers).toEqual([]);
  });
});
