import { CLASSIC_PLACES, createClassicRegistry } from "../classic/modules/index.js";
import type { ContentPack } from "../content/types.js";
import type { Registry } from "../engine/registry.js";
import type { EngineContext } from "../engine/turn.js";
import type { ClassicRules } from "../rules/classicRules.js";
import { EXPANDED_RULES } from "../rules/expandedRules.js";
import { EXPANDED_STARTER } from "./content/starter.js";
import { TOWN_STARTER } from "./content/townStarter.js";
import { pruneModifiers } from "./modifiers.js";
import { expandedDeskModule } from "./modules/desk.js";
import { officeModule } from "./modules/office.js";
import { prepModule } from "./modules/prep.js";
import { expandedStatsModule } from "./modules/stats.js";
import {
  expandedStoreModule,
  expandedUniversityModule,
  expandedVisitModule,
} from "./modules/town.js";
import { tutorialModule } from "./modules/tutorial.js";
import { expandedNegotiationModule } from "./negotiation.js";
import { decorateExpandedView } from "./panels.js";
import { refreshRating } from "./parlor.js";
import { ensureExpanded } from "./players.js";
import { expandedScriptEvent } from "./scripts.js";
import { registerTown, TOWN_PLACES } from "./town/index.js";

/**
 * Places on the Expanded map: the Classic ones and the town's new places
 * (docs/expanded-rules.md sections 12.1 and 16 to 20).
 */
export const EXPANDED_PLACES: readonly { id: string; label: string; module: string }[] = [
  ...CLASSIC_PLACES,
  ...TOWN_PLACES,
];

/**
 * The Expanded registry: the Classic registry with the modules whose
 * behaviour differs replaced (desk, negotiation, stats, Di-Mart, Spirit
 * University, the rival parlors, the script event), the new modules added
 * (body preparation, the office, the guided first day), and the Expanded
 * hooks. Every module id and button id the Classic registry uses still works.
 */
export function createExpandedRegistry(): Registry {
  const registry = createClassicRegistry()
    .register(expandedDeskModule)
    .register(expandedNegotiationModule)
    .register(expandedStatsModule)
    .register(expandedStoreModule)
    .register(expandedUniversityModule)
    .register(expandedVisitModule)
    .register(prepModule)
    .register(officeModule)
    .register(tutorialModule)
    .registerScript(expandedScriptEvent)
    .onPlayerCreated((turn) => {
      ensureExpanded(turn.player, turn.rules);
      refreshRating(turn.rules, turn.player);
    })
    .onMaintenance((turn) => pruneModifiers(turn.town));
  registerTown(registry);
  // Section 11.5: the HUD's countdowns, injuries and karma band on every view.
  registry.onView(decorateExpandedView);
  for (const place of EXPANDED_PLACES) registry.addPlace({ ...place });
  return registry;
}

/** A pack with the Expanded starter content filled in when it has none. */
export function withExpandedContent(content: ContentPack): ContentPack {
  if (!content.expanded) return { ...content, expanded: EXPANDED_STARTER };
  // Section 25: a pack written before the town existed gets the starter town.
  if (!content.expanded.town)
    return { ...content, expanded: { ...content.expanded, town: TOWN_STARTER } };
  return content;
}

/** Builds an engine context for the Expanded ruleset (rules default to `EXPANDED_RULES`). */
export function expandedContext(
  content: ContentPack,
  options: { rules?: ClassicRules; registry?: Registry; now?: number } = {},
): EngineContext {
  const rules = options.rules ?? EXPANDED_RULES;
  if (!rules.expanded) throw new Error("expandedContext needs Expanded rules");
  return {
    rules,
    content: withExpandedContent(content),
    registry: options.registry ?? createExpandedRegistry(),
    now: options.now ?? 0,
  };
}
