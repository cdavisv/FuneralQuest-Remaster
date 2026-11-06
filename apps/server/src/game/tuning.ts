import { EXPANDED_RULES } from "@fq/core";

/**
 * The Expanded rule numbers a sysop may change for one town.
 *
 * The values live in `EXPANDED_RULES` (packages/core/src/rules/expandedRules.ts and
 * expandedTownRules.ts) and are tuned there, so nothing in this file repeats a number: the list of
 * tunable paths, their defaults and their limits are all derived from the engine's own rules each
 * time they are asked for.
 *
 * A number is tunable when it is a plain number (not an array or a table) under one of the allowed
 * groups, and not one of the structural counts that size another table (a count of bingo cards, of
 * shot glasses, of market slots, of chain places, or the days that order the election). Everything
 * in `customer`, `psych`, `scoring`, `actions`, `hand`, `rating`, `upgrades`, `karma` and
 * `challenge` stays fixed: they are the negotiation's balance, and the Daily Challenge must be the
 * same on every server.
 *
 * A path is dotted from `EXPANDED_RULES.expanded`, for example `town.bank.loan.rate`. Each value is
 * checked against a box derived from the default: an integer default stays an integer, a fraction
 * between 0 and 1 stays between 0 and 1, a negative default stays negative, and nothing goes past
 * ten times the default (or 1000 when the default is 0). That keeps a typo from making the town
 * unplayable without a sysop having to know the engine.
 */

const ALLOWED_PREFIXES = [
  "pvp.",
  "underdog.",
  "town.church.",
  "town.cityHall.",
  "town.chains.",
  "town.hospital.",
  "town.club.",
  "town.bank.",
  "town.world.",
  "town.graveyard.",
];
const ALLOWED_EXACT = new Set(["newPlayerGraceDays", "turns.bankMax", "money.plotIncome"]);

/** Counts that size other tables or order the election's days. */
const STRUCTURAL = new Set([
  "town.church.bingo.cards",
  "town.club.shots.glasses",
  "town.club.market.slots",
  "town.chains.maxMembers",
  "town.cityHall.election.fileUntil",
  "town.cityHall.election.voteUntil",
  "town.cityHall.ordinance.every",
  "town.cityHall.ordinance.candidates",
]);

export interface TunableRule {
  path: string;
  /** The engine's default for this path today. */
  default: number;
  integer: boolean;
  min: number;
  max: number;
}

function leaves(value: unknown, path: string, out: Map<string, number>): void {
  if (typeof value === "number") {
    out.set(path, value);
  } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      leaves(child, path === "" ? key : `${path}.${key}`, out);
    }
  }
}

function isTunable(path: string): boolean {
  if (STRUCTURAL.has(path)) return false;
  return ALLOWED_EXACT.has(path) || ALLOWED_PREFIXES.some((p) => path.startsWith(p));
}

function boxFor(path: string, def: number): TunableRule {
  const integer = Number.isInteger(def);
  let min: number;
  let max: number;
  if (def < 0) {
    min = def * 10;
    max = 0;
  } else if (def === 0) {
    min = 0;
    max = 1000;
  } else if (!integer && def < 1) {
    min = 0;
    max = 1;
  } else {
    min = 0;
    max = Math.max(10, def * 10);
  }
  return { path, default: def, integer, min, max };
}

/** Every tunable path with its default and limits, in path order. */
export function tunableRules(): TunableRule[] {
  const rules = EXPANDED_RULES.expanded;
  if (!rules) return [];
  const all = new Map<string, number>();
  leaves(rules, "", all);
  return [...all]
    .filter(([path]) => isTunable(path))
    .map(([path, def]) => boxFor(path, def))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export type RuleOverrides = Record<string, number>;

/** Why an override was refused, or null when it is fine. */
export function checkOverride(path: string, value: unknown): string | null {
  const rule = tunableRules().find((r) => r.path === path);
  if (!rule) return `"${path}" is not an Expanded rule number that can be tuned per town.`;
  if (typeof value !== "number" || !Number.isFinite(value)) return `"${path}" must be a number.`;
  if (rule.integer && !Number.isInteger(value)) return `"${path}" must be a whole number.`;
  if (value < rule.min || value > rule.max) {
    return `"${path}" must be between ${rule.min} and ${rule.max} (the default is ${rule.default}).`;
  }
  return null;
}

/** The first problem with a set of overrides, or null. */
export function checkOverrides(overrides: Record<string, unknown>): string | null {
  for (const [path, value] of Object.entries(overrides)) {
    const problem = checkOverride(path, value);
    if (problem) return problem;
  }
  return null;
}

/** `EXPANDED_RULES` with `overrides` applied to a copy; the shared rules are never touched. */
export function withOverrides(
  base: typeof EXPANDED_RULES,
  overrides: RuleOverrides,
): typeof EXPANDED_RULES {
  if (Object.keys(overrides).length === 0 || !base.expanded) return base;
  const expanded = structuredClone(base.expanded) as unknown as Record<string, unknown>;
  for (const [path, value] of Object.entries(overrides)) {
    const keys = path.split(".");
    let node = expanded;
    for (const key of keys.slice(0, -1)) {
      const next = node[key];
      if (typeof next !== "object" || next === null) {
        node = {};
        break;
      }
      node = next as Record<string, unknown>;
    }
    node[keys[keys.length - 1] as string] = value;
  }
  return { ...base, expanded: expanded as unknown as NonNullable<typeof base.expanded> };
}

/** The current value of every tunable path in `rules`. */
export function currentValues(rules: typeof EXPANDED_RULES): Record<string, number> {
  const all = new Map<string, number>();
  if (rules.expanded) leaves(rules.expanded, "", all);
  const out: Record<string, number> = {};
  for (const rule of tunableRules()) out[rule.path] = all.get(rule.path) ?? rule.default;
  return out;
}
