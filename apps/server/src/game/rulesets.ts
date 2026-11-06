import {
  type ClassicRules,
  type ContentPack,
  checkExpandedContent,
  classicContext,
  type EngineContext,
  EXPANDED_RULES,
  expandedContext,
  withExpandedContent,
} from "@fq/core";
import { type RuleOverrides, withOverrides } from "./tuning.js";

/**
 * Rulesets the server can run. A town names one. Adding a ruleset is one entry here (plus whatever
 * the engine needs): its label and description appear in the town directory, its default content
 * pack is used when a town does not name one, and `check` refuses a content pack it cannot run.
 */
export interface RulesetDef {
  name: string;
  /** Shown in the lobby. */
  label: string;
  /** One or two sentences for the lobby: what is different about playing here. */
  description: string;
  /** The content pack a town gets when its config does not name one. */
  defaultPack: string;
  /** Whether per-town Expanded rule numbers (`rules` in the admin API) apply. */
  tunable: boolean;
  /** An engine context for `content`. `now` is set per call by the town. */
  context(content: ContentPack, overrides?: RuleOverrides): EngineContext;
  /** Why `content` cannot be played under this ruleset, or null. */
  check(content: ContentPack): string | null;
}

/** The Expanded content check, run against the pack as the engine will see it (starter filled in). */
function expandedProblems(content: ContentPack): string | null {
  const filled = withExpandedContent(content);
  const rules = EXPANDED_RULES.expanded;
  if (!filled.expanded || !rules) return "the Expanded rules are missing";
  const problems = checkExpandedContent(filled.expanded, rules);
  if (problems.length === 0) return null;
  const shown = problems.slice(0, 3).join("; ");
  return problems.length > 3 ? `${shown}; and ${problems.length - 3} more` : shown;
}

export const RULESETS: Record<string, RulesetDef> = {
  classic: {
    name: "classic",
    label: "Classic",
    description:
      "The 2001 game as it was: wait for customers, haggle with the five buttons, rob and fight your rivals, and fight for the top of the board in a tournament.",
    defaultPack: "classic",
    tunable: false,
    context: (content) => classicContext(content),
    check: () => null,
  },
  expanded: {
    name: "expanded",
    label: "Expanded",
    description:
      "The same game grown up: customers with traits and estimates, a soft-sell hand, a parlor to upgrade, and a living town with a graveyard, church bingo, City Hall elections, the bank, parlor chains and the Reaper Club. Played in 30-day seasons.",
    defaultPack: "expanded",
    tunable: true,
    context: (content, overrides = {}) => {
      const rules: ClassicRules = withOverrides(EXPANDED_RULES, overrides);
      return expandedContext(content, { rules });
    },
    check: expandedProblems,
  },
};

export function rulesetNames(): string[] {
  return Object.keys(RULESETS);
}

export function getRuleset(name: string): RulesetDef | undefined {
  return Object.hasOwn(RULESETS, name) ? RULESETS[name] : undefined;
}
