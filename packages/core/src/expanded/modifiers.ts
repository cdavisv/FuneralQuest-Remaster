import type { TownState } from "../state/types.js";
import type { ExpandedTown, RuleModifier } from "./state.js";

/**
 * Temporary rule changes (docs/expanded-rules.md section 12.2): the hook the
 * daily news, weather and story arcs use to change the rules for a day. A
 * modifier is data in `town.expanded.modifiers`; Expanded code reads a value
 * through `modValue(town, key, base)`, which applies every live modifier for
 * that key (all `add`s, then all `mul`s). Expired modifiers are ignored and
 * pruned by `pruneModifiers` at midnight.
 */
export const MODIFIER_KEYS = {
  /** Chance of a free event per Wait for Customer (Classic `normalOdds`). */
  eventOdds: "wait.eventOdds",
  /** Chance of a risk (Classic `luckOdds`). */
  riskOdds: "wait.riskOdds",
  /** Chance of a script event (Classic `scriptOdds`). */
  scriptOdds: "wait.scriptOdds",
  /** Multiplies every customer's spending limit. */
  limitMult: "customer.limitMult",
  /** Added to every customer's mood on arrival. */
  arrivalMood: "customer.mood",
  /** Added to every customer's cheapness on arrival. */
  arrivalCheapness: "customer.cheapness",
  /** Added to the income roll (positive: richer customers). */
  incomeShift: "customer.incomeShift",
  /** Multiplies the special-customer chance. */
  specialChance: "customer.specialChance",
  /** Multiplies Di-Mart's casket prices. */
  stockPrice: "store.stockPrice",
  /** Multiplies the BP of every sale (before bonuses). */
  saleBp: "sale.bpMult",
  /** Multiplies plot income. */
  plotIncome: "parlor.plotIncome",
  /** Multiplies the chance of a body-preparation choice. */
  prepChance: "prep.chance",
} as const;

export type ModifierKey = (typeof MODIFIER_KEYS)[keyof typeof MODIFIER_KEYS];

function expandedTown(town: TownState): ExpandedTown {
  if (!town.expanded) town.expanded = { modifiers: [] };
  return town.expanded;
}

/** Adds a modifier that lasts through `untilDay` (inclusive). */
export function addModifier(town: TownState, modifier: RuleModifier): void {
  expandedTown(town).modifiers.push({ ...modifier });
}

/** Live modifiers for `key` today. */
export function liveModifiers(town: TownState, key: string): RuleModifier[] {
  return (town.expanded?.modifiers ?? []).filter((m) => m.key === key && m.untilDay >= town.day);
}

/** `base` with every live modifier for `key` applied: adds first, then multiplies. */
export function modValue(town: TownState, key: ModifierKey | string, base: number): number {
  const live = liveModifiers(town, key);
  if (live.length === 0) return base;
  let value = base;
  for (const m of live) if (m.op === "add") value += m.value;
  for (const m of live) if (m.op === "mul") value *= m.value;
  return value;
}

/** Drops modifiers that ended before today (run at midnight). */
export function pruneModifiers(town: TownState): void {
  if (!town.expanded) return;
  town.expanded.modifiers = town.expanded.modifiers.filter((m) => m.untilDay >= town.day);
}
