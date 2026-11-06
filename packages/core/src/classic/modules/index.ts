import { Registry } from "../../engine/registry.js";
import { CLASSIC_SCRIPTS } from "../scripts/classicScripts.js";
import { STORE_SCRIPTS } from "../scripts/storeScripts.js";
import { bankModule } from "./bank.js";
import { battleModule } from "./battle.js";
import { cafeModule } from "./cafe.js";
import { churchModule, churchScript } from "./church.js";
import { deskModule } from "./desk.js";
import { hospitalModule } from "./hospital.js";
import { mailboxModule } from "./mailbox.js";
import { negotiationModule } from "./negotiation.js";
import { newsModule } from "./news.js";
import { optionsModule } from "./options.js";
import { rankingsModule } from "./rankings.js";
import { riskModule } from "./risk.js";
import { scriptModule, statsModule } from "./scripts.js";
import { storeModule } from "./store.js";
import { mapModule } from "./town.js";
import { universityModule } from "./university.js";
import { visitModule } from "./visit.js";
import { yangsModule } from "./yangs.js";

/**
 * Places on the Deathville map, in the order the client lists them. A place
 * whose module is not registered shows the "not built yet" view.
 * Place ids are the canonical ids of the exported building art
 * (`ui/building-<id>`); each place's module id is the same as its place id
 * except the player's own parlor, which is the desk. The original commands
 * were c_request_bank, _store, _bar, _yangs, _comp, _church, _hospital and
 * _spirit (commands.h); City Hall had no screen and is not on the map.
 */
export const CLASSIC_PLACES = [
  { id: "funeral-home", label: "Your Parlor", module: "desk" },
  { id: "bank", label: "Bank", module: "bank" },
  { id: "store", label: "Di-Mart", module: "store" },
  { id: "cafe", label: "Pale Horse Cafe", module: "cafe" },
  { id: "yangs", label: "Yang's", module: "yangs" },
  { id: "competitors", label: "Rival Parlors", module: "competitors" },
  { id: "church", label: "Church", module: "church" },
  { id: "hospital", label: "Hospital", module: "hospital" },
  { id: "spirit-university", label: "Spirit University", module: "spirit-university" },
] as const;

/**
 * The Classic registry. To add a location: write `classic/modules/<name>.ts`
 * exporting a `LocationModule` whose id is the place's module id, then add
 * one `.register(...)` line here.
 */
export function createClassicRegistry(): Registry {
  const registry = new Registry()
    .register(deskModule)
    .register(negotiationModule)
    .register(riskModule)
    .register(mapModule)
    .register(newsModule)
    .register(rankingsModule)
    .register(statsModule)
    .register(scriptModule)
    .register(bankModule)
    .register(storeModule)
    .register(universityModule)
    .register(yangsModule)
    .register(churchModule)
    .register(hospitalModule)
    .register(optionsModule)
    .register(visitModule)
    .register(battleModule)
    .register(cafeModule)
    .register(mailboxModule);
  for (const place of CLASSIC_PLACES) registry.addPlace({ ...place });
  for (const script of CLASSIC_SCRIPTS) registry.registerScript(script);
  for (const script of [...STORE_SCRIPTS, churchScript]) registry.registerScript(script);
  return registry;
}
