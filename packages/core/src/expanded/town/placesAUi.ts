import type { Button, View } from "@fq/protocol";
import type { Turn } from "../../engine/turn.js";
import type { PlacesAContent } from "../content/townPlacesA.js";
import { off, townScreen } from "./life.js";
import { tx } from "./placesAState.js";

/** Shared screen pieces of the batch-A places. */

export type PlaceKey = "police" | "crematorium" | "florist" | "gazette";

export function placeScreen(
  turn: Turn,
  key: PlaceKey,
  title: string,
  note: string,
  text: string,
  message: string,
  buttons: Button[],
): View {
  const pic = tx(turn).pictures[key];
  return townScreen(turn, {
    title,
    note,
    text: message === "" ? text : `${message}\n\n${text}`,
    buttons,
    ...pic,
  });
}

/** A button disabled with `why` when `why` is not empty. */
export function gate(b: Button, why: string): Button {
  return why === "" ? b : off(b, why);
}

export function hintsOf(turn: Turn): PlacesAContent["hints"] {
  return tx(turn).hints;
}
