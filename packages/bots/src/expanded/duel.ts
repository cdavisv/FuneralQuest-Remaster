import { EXPANDED } from "@fq/core";

/**
 * The graveyard duel as a small game the bots can solve (docs/expanded-rules.md
 * 16.4). The rules are public (`EXPANDED_RULES.town.graveyard.duel`), and a
 * duel screen shows both hit-point bars, so the value of Swing, Shove and
 * Yield can be worked out exactly instead of guessed:
 *
 * - Swing: a blow (a miss one time in 20), then the rival moves.
 * - Shove: lands with `shoveChance` percent. A landing does 1 to 4 damage, gives
 *   the shover a free swing and, since the engine pass, costs the rival their
 *   next move (no rival move this exchange). A failure gives the rival a free
 *   swing, then the rival moves.
 * - The rival moves: a shove 15% of the time (same formula, from their side:
 *   a landing means a swing at once, and another for the player's lost move; a
 *   failure gives the player a free swing), otherwise a swing.
 * - Yield: the duel ends at a quarter of what a win pays (half of what a loss
 *   costs, and half of that).
 *
 * Outcomes are scored in units of one win's stake: win +1, loss -(lossShare +
 * a share for the injury), yield -(lossShare x yieldShare).
 */

export type DuelMove = "swing" | "shove" | "yield";

/** Cost of the injury a loss brings, in stakes (a Sprained Ankle or Cracked Skull). */
const INJURY = 0.15;

/** The engine caps hit points at 60 (`caps.hpMax`). */
const MAX_HP = 60;

type Dist = { dmg: number; p: number }[];

/** `blow`: trunc(frandom(half) + half), with a miss one time in 20. */
function blowDist(strength: number): Dist {
  const half = (Math.max(0, strength) + 1) / 2;
  const out: Dist = [];
  const lo = half;
  const hi = half * 2;
  for (let k = Math.floor(lo); k < hi; k++) {
    const overlap = Math.min(k + 1, hi) - Math.max(k, lo);
    if (overlap > 0) out.push({ dmg: k, p: (overlap / half) * 0.95 });
  }
  out.push({ dmg: 0, p: 0.05 });
  return out;
}

export interface DuelTable {
  /** Value of the position for the side to move, for hit points (me, him). */
  value(me: number, him: number): number;
  /** The best move and every move's value. */
  choose(
    me: number,
    him: number,
    canYield: boolean,
  ): { move: DuelMove; values: Record<DuelMove, number> };
}

const cache = new Map<string, DuelTable>();

function clampStrength(n: number): number {
  return Math.max(0, Math.min(40, Math.round(n)));
}

/** The shove chance (percent) from `mine` to `his`, as the engine computes it. */
export function shovePercent(mine: number, his: number): number {
  const s = EXPANDED.town.graveyard.duel.shove;
  return Math.max(s.min, Math.min(s.max, s.base + s.perStrength * (mine - his)));
}

/**
 * Solves the duel for a pair of strengths by value iteration over (my hp, his
 * hp). The table is shared by every duel with the same strengths.
 */
export function duelTable(myStrength: number, hisStrength: number): DuelTable {
  const mine = clampStrength(myStrength);
  const his = clampStrength(hisStrength);
  const key = `${mine}/${his}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const table = solve(mine, his);
  cache.set(key, table);
  return table;
}

function solve(mine: number, his: number): DuelTable {
  const rules = EXPANDED;
  const g = rules.town.graveyard.duel;
  const winV = 1;
  const lossV = -(rules.pvp.lossShare + INJURY);
  const yieldV = -(rules.pvp.lossShare * g.yieldShare);
  const myBlow = blowDist(mine);
  const hisBlow = blowDist(his);
  const myShove = shovePercent(mine, his) / 100;
  const hisShove = shovePercent(his, mine) / 100;
  const aiShove = g.aiShove / 100;
  const grave: Dist = [];
  for (let d = g.graveDamage.min; d <= g.graveDamage.max; d++)
    grave.push({ dmg: d, p: 1 / (g.graveDamage.max - g.graveDamage.min + 1) });
  const costsMove = g.shoveCostsMove;

  // V[a][b]: value to the player at the start of their decision, hp a and b, both above 0.
  const V: number[][] = Array.from({ length: MAX_HP + 1 }, () => Array(MAX_HP + 1).fill(0));
  const val = (a: number, b: number): number => {
    if (b <= 0 && a > 0) return winV;
    if (a <= 0) return lossV;
    return V[Math.min(a, MAX_HP)]?.[Math.min(b, MAX_HP)] ?? 0;
  };

  // The rival's swing, then continue with `next` on the resulting hit points.
  const afterRivalSwing = (a: number, b: number, next: (a: number, b: number) => number) => {
    let out = 0;
    for (const { dmg, p } of hisBlow) out += p * next(a - dmg, b);
    return out;
  };
  const afterMySwing = (a: number, b: number, next: (a: number, b: number) => number) => {
    let out = 0;
    for (const { dmg, p } of myBlow) out += p * next(a, b - dmg);
    return out;
  };
  const decided = (a: number, b: number) => a <= 0 || b <= 0;
  // The rival's move from (a, b), then the player's next decision.
  const rivalMove = (a: number, b: number): number => {
    if (decided(a, b)) return val(a, b);
    // A plain swing.
    const swing = afterRivalSwing(a, b, val);
    // A shove attempt.
    let shove = 0;
    for (const { dmg, p } of grave) {
      // lands: the player falls (damage), the rival swings, and again for the lost move.
      const landed = (() => {
        const a1 = a - dmg;
        if (a1 <= 0) return lossV;
        const swingOnce = (a2: number, b2: number) => {
          if (a2 <= 0) return lossV;
          if (!costsMove) return val(a2, b2);
          return afterRivalSwing(a2, b2, val);
        };
        return afterRivalSwing(a1, b, swingOnce);
      })();
      shove += p * landed;
    }
    const lands = shove * hisShove;
    // fails: the player gets a free swing.
    const fails = (1 - hisShove) * afterMySwing(a, b, val);
    return (1 - aiShove) * swing + aiShove * (lands + fails);
  };
  // The rival's move depends on V only through `val`, so it is tabulated once per sweep.
  const R: number[][] = Array.from({ length: MAX_HP + 1 }, () => Array(MAX_HP + 1).fill(0));
  const rival = (a: number, b: number): number => {
    if (a <= 0) return lossV;
    if (b <= 0) return winV;
    return R[Math.min(a, MAX_HP)]?.[Math.min(b, MAX_HP)] ?? 0;
  };
  const swingValue = (a: number, b: number): number =>
    afterMySwing(a, b, (a2, b2) => (b2 <= 0 ? winV : rival(a2, b2)));
  const shoveValue = (a: number, b: number): number => {
    let landed = 0;
    for (const { dmg, p } of grave) {
      const b1 = b - dmg;
      if (b1 <= 0) {
        landed += p * winV;
        continue;
      }
      // The free swing; then the rival either loses the move or moves.
      landed +=
        p *
        afterMySwing(a, b1, (a2, b2) => {
          if (b2 <= 0) return winV;
          return costsMove ? val(a2, b2) : rival(a2, b2);
        });
    }
    // Failure: the rival swings freely, then moves.
    const failed = afterRivalSwing(a, b, (a2, b2) => (a2 <= 0 ? lossV : rival(a2, b2)));
    return myShove * landed + (1 - myShove) * failed;
  };

  const cap = MAX_HP;
  for (let sweep = 0; sweep < 60; sweep++) {
    let change = 0;
    for (let a = 1; a <= cap; a++)
      for (let b = 1; b <= cap; b++) (R[a] as number[])[b] = rivalMove(a, b);
    for (let a = 1; a <= cap; a++) {
      for (let b = 1; b <= cap; b++) {
        const best = Math.max(swingValue(a, b), shoveValue(a, b), yieldV);
        const row = V[a] as number[];
        change = Math.max(change, Math.abs(best - (row[b] ?? 0)));
        row[b] = best;
      }
    }
    if (change < 1e-4) break;
  }
  return {
    value: (a, b) => val(a, b),
    choose(a, b, canYield) {
      const values: Record<DuelMove, number> = {
        swing: swingValue(a, b),
        shove: shoveValue(a, b),
        yield: yieldV,
      };
      let move: DuelMove = "swing";
      for (const m of ["shove", "yield"] as const) {
        if (m === "yield" && !canYield) continue;
        if (values[m] > values[move] + 1e-9) move = m;
      }
      return { move, values };
    },
  };
}

/**
 * Whether to start a duel against a rival of this strength at full health:
 * the player's expected result in stakes (a yield is always available).
 */
export function duelOutlook(
  myStrength: number,
  hisStrength: number,
  myHp: number,
  hisHp: number,
): number {
  const t = duelTable(myStrength, hisStrength);
  return t.value(Math.min(MAX_HP, Math.max(1, myHp)), Math.min(MAX_HP, Math.max(1, hisHp)));
}
