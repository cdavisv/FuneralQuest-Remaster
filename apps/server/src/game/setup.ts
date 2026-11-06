import type { ContentSource } from "../content/index.js";
import { getRuleset, rulesetNames } from "./rulesets.js";
import { checkOverrides, type RuleOverrides } from "./tuning.js";

/** A town setup the server refuses. The message says what to change. */
export class TownConfigError extends Error {}

/**
 * Checks that a ruleset, a content pack and a set of Expanded rule overrides make a town the
 * engine can run, and says so plainly when they do not:
 *
 * - the ruleset and the pack must exist;
 * - a pack must pass the ruleset's content check (the Expanded ruleset fills in its starter
 *   tables, so a plain Classic or Vintage pack is fine, but a pack whose own Expanded tables are
 *   broken is refused);
 * - the Expanded pack is allowed under the Classic ruleset (its classic-format tables are
 *   compatible, and the Expanded tables are simply unused);
 * - Expanded rule numbers only mean something under the Expanded ruleset, and each must be one
 *   that can be tuned and inside its limits (`tuning.ts`).
 */
export function checkTownSetup(
  content: ContentSource,
  rulesetName: string,
  packName: string,
  overrides: RuleOverrides = {},
): void {
  const ruleset = getRuleset(rulesetName);
  if (!ruleset) {
    throw new TownConfigError(
      `Unknown ruleset "${rulesetName}". Available: ${rulesetNames().join(", ")}.`,
    );
  }
  if (!content.names().includes(packName)) {
    throw new TownConfigError(
      `Unknown content pack "${packName}". Available: ${content.names().join(", ")}.`,
    );
  }
  const problem = ruleset.check(content.load(packName));
  if (problem) {
    throw new TownConfigError(
      `Content pack "${packName}" cannot run the ${ruleset.label} ruleset: ${problem}.`,
    );
  }
  if (Object.keys(overrides).length > 0) {
    if (!ruleset.tunable) {
      throw new TownConfigError(
        `Expanded rule numbers (rules) only apply to the Expanded ruleset; this town is ${ruleset.label}.`,
      );
    }
    const bad = checkOverrides(overrides);
    if (bad) throw new TownConfigError(bad);
  }
}
