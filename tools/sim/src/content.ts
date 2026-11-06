import { classicPack, expandedPack } from "@fq/content";
import type { ContentPack } from "@fq/core";
import type { RulesName } from "./town.js";

/** The content the simulator plays with: the built-in Classic pack, or the Expanded pack. */
export function simContent(rules: RulesName = "classic"): ContentPack {
  return rules === "expanded" ? expandedPack : classicPack;
}
