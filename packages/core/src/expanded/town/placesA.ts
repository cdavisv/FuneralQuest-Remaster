import type { Registry } from "../../engine/registry.js";
import { crematoriumModule } from "./crematorium.js";
import { floristModule } from "./florist.js";
import { gazetteModule, gazetteMorning } from "./gazette.js";
import { policeModule } from "./police.js";

/** Expanded map locations, batch A (docs/expanded-rules.md section 30). */
export const PLACES_A: readonly { id: string; label: string; module: string }[] = [
  { id: "police-station", label: "Police Station", module: "police" },
  { id: "crematorium", label: "Crematorium", module: "crematorium" },
  { id: "florist", label: "Florist", module: "florist" },
  { id: "gazette", label: "Town Gazette", module: "gazette" },
];

export function registerPlacesA(registry: Registry): Registry {
  return registry
    .register(policeModule)
    .register(crematoriumModule)
    .register(floristModule)
    .register(gazetteModule)
    .onPlayerNewDay(gazetteMorning);
}
