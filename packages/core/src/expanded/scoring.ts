import type { ClassicRandom } from "../rng/classicRandom.js";
import type { ExpandedRules } from "../rules/expandedRules.js";
import { roll } from "./players.js";

/** Pure formulas of the Expanded ruleset, each named after its section of docs/expanded-rules.md. */

export function roundDown(value: number, step: number): number {
  return Math.floor(value / step) * step;
}

export function roundUp(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

/** Section 3.1: a spending limit on the $50 grid, uniform over the band's grid points. */
export function gridLimit(rng: ClassicRandom, low: number, high: number, step: number): number {
  const a = Math.ceil(low / step);
  const b = Math.floor(high / step);
  return rng.randomRange(a, Math.max(a, b)) * step;
}

/** Section 3.6: half the estimate's width as a share of the limit, `base + extra x decay^psych`. */
export function estimateHalfShare(rules: ExpandedRules, psych: number, mult = 1): number {
  const e = rules.psych.estimate;
  const level = Math.min(psych, rules.psych.maxLevel);
  return (e.base + e.extra * e.decay ** level) * mult;
}

/**
 * Section 3.6: an estimate of `limit` whose width is `2 x halfShare x limit`
 * (at least `minWidth`), placed so the limit is at a uniformly random point
 * inside it, then widened outward to the price grid. The true limit is always
 * inside, and the middle is not the answer.
 */
export function makeEstimate(
  rng: ClassicRandom,
  rules: ExpandedRules,
  limit: number,
  halfShare: number,
): { low: number; high: number } {
  const step = rules.customer.limitStep;
  const width = Math.max(rules.psych.estimate.minWidth, 2 * halfShare * limit);
  const low = Math.max(0, roundDown(limit - roll(rng) * width, step));
  const high = Math.max(roundUp(low + width, step), roundUp(limit, step));
  return { low: Math.min(low, limit), high };
}

/**
 * Section 3.5: a limit tell halves the estimate, keeping the half that holds
 * the limit. Returns the new estimate and whether it was the upper half.
 */
export function narrowEstimate(
  estimate: { low: number; high: number },
  limit: number,
  step: number,
): { estimate: { low: number; high: number }; upper: boolean } {
  const mid = (estimate.low + estimate.high) / 2;
  if (estimate.high - estimate.low <= step)
    return { estimate: { ...estimate }, upper: limit >= mid };
  if (limit >= mid) {
    const low = Math.min(roundDown(mid, step), limit);
    return { estimate: { low, high: estimate.high }, upper: true };
  }
  const high = Math.max(roundUp(mid, step), limit);
  return { estimate: { low: estimate.low, high }, upper: false };
}

/** Section 3.7: base BP of a bill. `int(bill x 0.0064)`, as Classic, in doubles. */
export function baseSaleBp(bill: number, multiplier: number): number {
  return Math.trunc(Math.max(0, bill) * multiplier);
}

export type BonusKey = "exact" | "great" | "nice";

/**
 * Section 3.7: the closeness bonus, a share of the sale's own base BP so it
 * grows with the customer's means and the seller's skill, not with luck.
 */
export function closenessBonus(
  rules: ExpandedRules,
  bill: number,
  limit: number,
  base: number,
): { key: BonusKey | null; bonus: number; percent: number } {
  const s = rules.scoring;
  if (limit <= 0 || bill > limit) return { key: null, bonus: 0, percent: 0 };
  if (bill === limit) {
    return { key: "exact", bonus: Math.ceil(base * s.exact.share) + s.exact.flat, percent: 0 };
  }
  const left = (limit - bill) / limit;
  for (const tier of s.tiers) {
    if (left <= tier.within) {
      return {
        key: tier.key,
        bonus: Math.ceil(base * tier.share),
        percent: Math.round(tier.within * 100),
      };
    }
  }
  return { key: null, bonus: 0, percent: 0 };
}

/**
 * Section 9.1: what a won fight takes, `min(cap, floor(factor x sqrt(bp)))`
 * of the loser's total: less than linear, and capped.
 */
export function pvpGain(rules: ExpandedRules, loserBp: number): number {
  const p = rules.pvp;
  return Math.min(p.gainCap, Math.floor(p.gainFactor * Math.sqrt(Math.max(0, loserBp))));
}

/**
 * Section 9.4: the underdog share of a sale's base BP, for a parlor whose
 * total is below `below` x the leader's: `min(max, scale x (1 - mine / leader))`.
 */
export function underdogShare(
  rules: ExpandedRules,
  mine: number,
  leader: number,
  late = false,
): number {
  const share = (u: { below: number; scale: number; max: number }) =>
    leader <= 0 || mine >= leader * u.below ? 0 : Math.min(u.max, u.scale * (1 - mine / leader));
  const u = rules.underdog;
  return Math.max(share(u), late ? share(u.late) : 0);
}

/** Section 6.3: a casket's list price at a markup, on the price grid. */
export function markedUp(price: number, markup: number, step: number): number {
  return Math.max(step, Math.round((price * (1 + markup / 100)) / step) * step);
}

/** Section 6.2: Di-Mart's wholesale price for a casket (before karma and modifiers). */
export function wholesalePrice(rules: ExpandedRules, listPrice: number): number {
  return roundUp(listPrice * rules.money.wholesale, rules.customer.limitStep);
}
