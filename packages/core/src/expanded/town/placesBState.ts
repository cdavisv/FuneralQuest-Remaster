/**
 * State of the batch-B places (docs/expanded-rules.md section 31): the coroner,
 * the health department, the pawn shop and the Mournes. Plain JSON hung off
 * `ExpandedPlayer.placesB`, created on first use, so saves made before these
 * places existed load unchanged.
 */

/** A hint about the next customer, bought or spied (applied once, in `waitX`). */
export interface NextTip {
  /** Show whether the family loved the deceased. */
  loved: boolean;
  /** Show whether the family is cheap. */
  cheap: boolean;
  /** Extra traits shown on arrival. */
  traits: number;
}

export interface PlacesBState {
  /** What was done today: ids like "tip", "favour", "lot". Reset when the game day moves on. */
  today: { day: number; done: string[] };
  /** The pending hint for the next customer, or null. */
  tip: NextTip | null;
  /** Game day the fast-tracked certificate was last bought (0 = never). */
  certDay: number;
  /** Pieces taken during body preparation and not yet pawned. */
  loot: number;
  /** A word-of-mouth boost from the health department, taken back after `until`. */
  boost: { amount: number; until: number } | null;
  /** Dollars of an unpaid citation (0 = none). */
  citation: number;
  /** Last game day of a truce with the Mournes (0 = none). */
  truceUntil: number;
}

export function newPlacesB(): PlacesBState {
  return {
    today: { day: 0, done: [] },
    tip: null,
    certDay: 0,
    loot: 0,
    boost: null,
    citation: 0,
    truceUntil: 0,
  };
}
