import type { Registry } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { coronerModule } from "./coroner.js";
import { healthModule } from "./health.js";
import { mournesModule } from "./mournes.js";
import { pawnModule } from "./pawn.js";
import { btext, pb, say, settleBoost } from "./placesBLib.js";

/** Expanded map locations, batch B (docs/expanded-rules.md section 31): the coroner, the health department, the pawn shop and the Mournes. */
export const PLACES_B: readonly { id: string; label: string; module: string }[] = [
  { id: "coroner", label: "Coroner's Office", module: "coroner" },
  { id: "health-department", label: "Health Department", module: "health-department" },
  { id: "pawn-shop", label: "Cousin Sal's Pawn", module: "pawn-shop" },
  { id: "mournes", label: "Mourne & Sons", module: "mournes" },
];

/** A player's new day: a health certificate that ran out is taken down (and its word of mouth with it). */
export function placesBMorning(turn: Turn): string {
  if (!turn.player.expanded) return "";
  pb(turn);
  return settleBoost(turn) ? say(turn, btext(turn).health.boostEnded) : "";
}

export function registerPlacesB(registry: Registry): Registry {
  return registry
    .register(coronerModule)
    .register(healthModule)
    .register(pawnModule)
    .register(mournesModule)
    .onPlayerNewDay(placesBMorning);
}
