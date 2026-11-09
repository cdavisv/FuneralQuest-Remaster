import type { Button, View } from "@fq/protocol";
import type { Turn } from "../../engine/turn.js";
import { button } from "../../engine/view.js";
import type { PlayerState, TownState } from "../../state/types.js";
import { fill } from "../../text/format.js";
import { PLACES_B_STARTER, type PlacesBContent } from "../content/townPlacesB.js";
import { tellLine, traitDefs, xcust, xvars } from "../customer.js";
import { refreshRating } from "../parlor.js";
import { ensureExpanded, reviewsMod, xc, xr } from "../players.js";
import { arrive, card, cash, off, townScreen, tr, xt } from "./life.js";
import { newPlacesB, type PlacesBState } from "./placesBState.js";

/**
 * Shared helpers of the batch-B places (docs/expanded-rules.md section 31): the
 * state accessor with its daily reset, the text, the screen builder, the
 * next-customer tip and the temporary word-of-mouth boost.
 */

export type PlaceB = "coroner" | "health" | "pawn" | "mournes";

/** The batch-B rules. */
export function brules(turn: Turn) {
  return tr(turn).placesB;
}

/** The batch-B text: the pack's, else the starter's. */
export function btext(turn: Turn): PlacesBContent {
  return xc(turn).placesB ?? PLACES_B_STARTER;
}

/** The player's batch-B record, created on first use; `today` resets when the game day moves on. */
export function pbOf(town: TownState, player: PlayerState): PlacesBState {
  const x = player.expanded;
  if (!x) throw new Error("Not an Expanded player");
  if (!x.placesB) x.placesB = newPlacesB();
  if (x.placesB.today.day !== town.day) x.placesB.today = { day: town.day, done: [] };
  return x.placesB;
}

export function pb(turn: Turn): PlacesBState {
  ensureExpanded(turn.player, turn.rules);
  return pbOf(turn.town, turn.player);
}

export function did(turn: Turn, id: string): boolean {
  return pb(turn).today.done.includes(id);
}

export function mark(turn: Turn, id: string): void {
  const s = pb(turn);
  if (!s.today.done.includes(id)) s.today.done.push(id);
}

/** Stat counters on the player's life record, as for the other town places. */
export function paid(turn: Turn, key: string, amount: number): void {
  const l = turn.player.expanded?.life;
  if (!l) return;
  l.spent[key] = (l.spent[key] ?? 0) + amount;
}

/** A place screen with the picture of that place. */
export function screenB(
  turn: Turn,
  place: PlaceB,
  text: string,
  buttons: Button[],
  title: string,
  note: string,
): View {
  return townScreen(turn, { title, note, text, buttons, ...btext(turn).pictures[place] });
}

export function enterB(turn: Turn, title: string, scene: string): void {
  arrive(turn, title, scene);
}

export { button, card, cash, off };

/** The words shared by the places: "Name (price)" detail strings. */
export function priceDetail(price: number): string {
  return cash(price);
}

export function vars(turn: Turn, extra: Record<string, string | number> = {}) {
  const c = btext(turn).cast;
  return {
    player: turn.player.name,
    parlor: turn.player.parlor,
    coroner: c.coroner,
    pawnbroker: c.pawnbroker,
    mourne: c.mournes,
    sons: c.sons,
    inspector: xt(turn).cast.inspector,
    ...extra,
  };
}

export function say(turn: Turn, template: string, extra: Record<string, string | number> = {}) {
  return fill(template, vars(turn, extra));
}

/** Prepends a message to a screen's text. */
export function withMessage(message: string, text: string): string {
  return message === "" ? text : `${message}\n\n${text}`;
}

// ---------------------------------------------------------------- the next-customer tip

/**
 * Applies the pending tip (a coroner's note, or what the Mournes' price list
 * gave away) to the customer that just arrived in the session: shows whether
 * they loved the deceased, whether they are cheap, and one more trait.
 * Returns the line to put before the arrival text, or "". Called by `waitX`
 * right before the arrival screen is built.
 */
export function applyNextTip(turn: Turn): string {
  const p = turn.player;
  const state = p.expanded?.placesB;
  const c = turn.session.customer;
  if (!state?.tip || !c?.expanded) return "";
  const tip = state.tip;
  state.tip = null;
  const x = xcust(c);
  const t = btext(turn).coroner;
  const v = xvars(turn, c);
  const lines: string[] = [];
  if (tip.loved && !x.told.loved) {
    x.told.loved = true;
    const tell = fill(tellLine(turn, c, "loved"), v);
    x.notes.push(tell);
    lines.push(fill(t.tipLoved, { loved: tell }));
  }
  if (tip.cheap && !x.told.cheap) {
    x.told.cheap = true;
    const tell = fill(tellLine(turn, c, "cheap"), v);
    x.notes.push(tell);
    lines.push(fill(t.tipCheap, { cheap: tell }));
  }
  const defs = traitDefs(turn, c);
  for (let i = 0; i < tip.traits && x.visibleTraits < x.traits.length; i++) {
    const trait = defs[x.visibleTraits];
    x.visibleTraits++;
    if (!trait) continue;
    const line = fill(t.tipTrait, { trait: trait.label });
    x.notes.push(line);
    lines.push(line);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------- loot

/** Called when a body-preparation choice takes something (the ring): it can be pawned. */
export function addLoot(turn: Turn): void {
  const s = pb(turn);
  s.loot = Math.min(brules(turn).pawn.loot.max, s.loot + 1);
}

// ---------------------------------------------------------------- the health boost

/** Whether a health-department boost is on today. */
export function boostActive(turn: Turn): boolean {
  const b = pb(turn).boost;
  return !!b && b.until >= turn.town.day;
}

/**
 * Takes back a boost that ran out (new day, or before a new one is bought).
 * Returns true when it did.
 */
export function settleBoost(turn: Turn): boolean {
  const s = pb(turn);
  if (!s.boost || s.boost.until >= turn.town.day) return false;
  reviewsMod(turn.player, xr(turn), -s.boost.amount);
  s.boost = null;
  refreshRating(turn.rules, turn.player);
  return true;
}

/** Gives `amount` word of mouth for `days` days (today included), as clamped by the cap. */
export function grantBoost(turn: Turn, amount: number, days: number): void {
  settleBoost(turn);
  const p = turn.player;
  const before = p.expanded?.reviews ?? 0;
  reviewsMod(p, xr(turn), amount);
  const applied = (p.expanded?.reviews ?? 0) - before;
  pb(turn).boost = { amount: applied, until: turn.town.day + days - 1 };
  refreshRating(turn.rules, p);
}
