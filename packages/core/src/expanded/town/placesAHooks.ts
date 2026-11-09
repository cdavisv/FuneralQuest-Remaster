import type { Turn } from "../../engine/turn.js";
import type { CustomerState, PlayerState } from "../../state/types.js";
import { fill, intToCash } from "../../text/format.js";
import { xcust } from "../customer.js";
import { xc, xr } from "../players.js";
import { wholesalePrice } from "../scoring.js";
import { liveFlowers, liveSlots, placesAOf, ra, tx } from "./placesAState.js";

/**
 * The two seams the batch-A places have in the Classic-shaped modules: the
 * attacks the police can be told about (`pvp.ts`, `modules/town.ts`) and what
 * rented oven time and the florist's stock add to a settled sale (`sale.ts`).
 */

/** Remembers that `attacker` hit `victim`'s parlor (a fight won or a break-in). */
export function recordAttack(turn: Turn, attacker: PlayerState, victim: PlayerState): void {
  if (attacker.id === victim.id || !victim.expanded || !attacker.expanded) return;
  const state = placesAOf(turn.town, victim);
  state.attacks.push({ by: attacker.id, day: turn.town.day });
  const max = ra(turn).police.maxAttacks;
  while (state.attacks.length > max) state.attacks.shift();
}

/** Flowers lines of the bill: `[price]` per package tier or soft-sell item tagged "flowers". */
function flowerLines(turn: Turn, c: CustomerState): number[] {
  const x = xcust(c);
  const out: number[] = [];
  for (const cat of xc(turn).packages) {
    const index = x.packages[cat.id];
    if (index === undefined || index < 1) continue;
    const tier = cat.tiers[index];
    if (tier?.tags.includes("flowers")) out.push(tier.price);
  }
  const items = xc(turn).softSell;
  for (const i of x.bought) {
    const item = items[i];
    if (item?.tags.includes("flowers")) out.push(item.price);
  }
  return out;
}

/**
 * Extra money (and a line for the sale summary) from a settled sale: a rented
 * oven slot saves the wholesale cost of a cremation, and each fresh bouquet in
 * the cooler pays a share of a flowers line. No random draws.
 */
export function placesASaleExtras(turn: Turn, c: CustomerState): { money: number; note: string } {
  const me = turn.player;
  if (!me.expanded) return { money: 0, note: "" };
  const state = placesAOf(turn.town, me);
  const t = tx(turn).saleNotes;
  let money = 0;
  let note = "";
  if (xcust(c).track === "cremation" && liveSlots(turn.town, state) > 0) {
    state.oven.slots--;
    const saved = wholesalePrice(xr(turn), xc(turn).cremation.fee);
    money += saved;
    note += fill(t.oven, { money: intToCash(saved) });
  }
  let fresh = liveFlowers(turn.town, state);
  const pay = ra(turn).florist.payout;
  let used = 0;
  let earned = 0;
  for (const price of flowerLines(turn, c)) {
    if (fresh <= 0) break;
    fresh--;
    used++;
    earned += Math.min(pay.max, Math.round(price * pay.share));
  }
  if (used > 0) {
    state.flowers.stock -= used;
    money += earned;
    note += fill(t.flowers, { count: used, money: intToCash(earned) });
  }
  return { money, note };
}
