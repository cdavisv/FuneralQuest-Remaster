import type { Turn } from "../../engine/turn.js";
import type { ExpandedTownRules } from "../../rules/expandedTownRules.js";
import type { PlayerState, TownState } from "../../state/types.js";
import { PLACES_A_STARTER, type PlacesAContent } from "../content/townPlacesA.js";
import { ensureExpanded, xc } from "../players.js";
import { tr } from "./life.js";

/**
 * State of the batch-A places (docs/expanded-rules.md section 30): the Police
 * Station, the Crematorium, the Florist and the Town Gazette. Plain JSON hung
 * off `ExpandedPlayer.placesA`, created on first use, so saves made before
 * these places existed load unchanged.
 */

/** What was done today; reset when the game day moves on. */
export interface PlacesADaily {
  day: number;
  /** Police reports or settlements today. */
  reports: number;
  /** Tonight's patrol was hired. */
  patrol: boolean;
  /** Flowers sent to the church or the ward today. */
  wreath: boolean;
  /** Adverts booked today. */
  ads: number;
  /** The front page was bought today. */
  puff: boolean;
  /** A smear was printed (or tried) today. */
  smear: boolean;
}

export interface PlacesAState {
  today: PlacesADaily;
  /** Break-ins and beatings suffered, oldest first: who did it and the game day. */
  attacks: { by: number; day: number }[];
  /** Oven slots rented and the last game day they can be used. */
  oven: { slots: number; until: number };
  /** Urns already scattered or pressed (counted against `record.cremations`). */
  ashes: number;
  /** Bouquets in the cooler and the last game day they stay fresh. */
  flowers: { stock: number; until: number };
  /** Customers an advert sends: delivered at the new day after `day`. */
  ad: { leads: number; day: number };
}

function newDaily(day: number): PlacesADaily {
  return { day, reports: 0, patrol: false, wreath: false, ads: 0, puff: false, smear: false };
}

export function newPlacesA(): PlacesAState {
  return {
    today: newDaily(0),
    attacks: [],
    oven: { slots: 0, until: 0 },
    ashes: 0,
    flowers: { stock: 0, until: 0 },
    ad: { leads: 0, day: 0 },
  };
}

/** The player's batch-A record, created on first use; `today` resets with the game day. */
export function placesAOf(town: TownState, player: PlayerState): PlacesAState {
  const x = player.expanded;
  if (!x) throw new Error("Not an Expanded player");
  if (!x.placesA) x.placesA = newPlacesA();
  if (x.placesA.today.day !== town.day) x.placesA.today = newDaily(town.day);
  return x.placesA;
}

export function pa(turn: Turn): PlacesAState {
  ensureExpanded(turn.player, turn.rules);
  return placesAOf(turn.town, turn.player);
}

/** The batch-A numbers. */
export function ra(turn: Turn): ExpandedTownRules["placesA"] {
  return tr(turn).placesA;
}

/** The batch-A text: the pack's, else the starter. */
export function tx(turn: Turn): PlacesAContent {
  return xc(turn).placesA ?? PLACES_A_STARTER;
}

/** Oven slots still good today (they run out after `until`). */
export function liveSlots(town: TownState, state: PlacesAState): number {
  return town.day <= state.oven.until ? state.oven.slots : 0;
}

/** Bouquets still fresh today. */
export function liveFlowers(town: TownState, state: PlacesAState): number {
  return town.day <= state.flowers.until ? state.flowers.stock : 0;
}
