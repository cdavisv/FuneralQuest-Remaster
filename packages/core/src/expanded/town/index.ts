import { mapModule } from "../../classic/modules/town.js";
import type { LocationModule, Registry } from "../../engine/registry.js";
import { arcModule } from "./arcs.js";
import { expandedBankModule } from "./bank.js";
import { expandedChurchModule } from "./church.js";
import { cityHallModule } from "./cityHall.js";
import { clubModule } from "./club.js";
import { graveyardModule } from "./graveyard.js";
import { expandedBattleModule, expandedHospitalModule } from "./hospital.js";
import { PLACES_A, registerPlacesA } from "./placesA.js";
import { PLACES_B, registerPlacesB } from "./placesB.js";
import { townMidnight, townMorning, townPanel } from "./world.js";

/**
 * The Expanded town (docs/expanded-rules.md sections 16 to 26): the new
 * places on the map and the modules that replace Classic ones by id (church,
 * hospital, bank, battle, map), plus the midnight and morning hooks.
 */
export const TOWN_PLACES = [
  { id: "graveyard", label: "Town Graveyard", module: "graveyard" },
  { id: "city-hall", label: "City Hall", module: "city-hall" },
  { id: "reaper-club", label: "The Reaper Club", module: "reaper-club" },
  ...PLACES_A,
  ...PLACES_B,
] as const;

/** The town map with today's town strip (section 26). */
const expandedMapModule: LocationModule = {
  ...mapModule,
  enter(turn, arg) {
    const view = mapModule.enter?.(turn, arg);
    if (!view) throw new Error("No map");
    view.town = townPanel(turn);
    return view;
  },
};

export function registerTown(registry: Registry): Registry {
  return registerPlacesB(registerPlacesA(registry))
    .register(graveyardModule)
    .register(expandedChurchModule)
    .register(cityHallModule)
    .register(expandedHospitalModule)
    .register(expandedBattleModule)
    .register(clubModule)
    .register(expandedBankModule)
    .register(expandedMapModule)
    .register(arcModule)
    .onMaintenance(townMidnight)
    .onPlayerNewDay(townMorning);
}
