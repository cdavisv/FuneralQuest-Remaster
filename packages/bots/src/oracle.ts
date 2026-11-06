import type { CustomerState } from "@fq/core";
import { knowX } from "./expanded/sell.js";
import { SKILLS } from "./personalities.js";
import { createPolicy, type PolicyOptions } from "./policy.js";
import type { OraclePolicy } from "./runner.js";

export type { OraclePolicy } from "./runner.js";

/**
 * SIMULATOR ONLY. A policy that reads the customer's hidden record (the
 * spending limit, the loved flag, the resistance) before every sales
 * decision. It plays the same personality otherwise, so the gap between it
 * and the fair policy measures how much the game hides. Never seat it in a
 * town a person plays in.
 */
export function createOraclePolicy(
  options: Omit<PolicyOptions, "peekCustomer"> = {},
): OraclePolicy {
  let hidden: Readonly<CustomerState> | null = null;
  const inner = createPolicy({
    skill: SKILLS.hard,
    ...options,
    peekCustomer: (notes) => {
      if (!hidden) return;
      notes.exact = hidden.moneyToSpend;
      notes.lo = hidden.moneyToSpend;
      notes.hi = hidden.moneyToSpend;
      notes.loved = hidden.loved;
      notes.resistance = Math.round(hidden.cheapness * 10);
      notes.casket = hidden.desiredCasket;
    },
    peekX: (notes) => {
      if (!hidden?.expanded) return;
      knowX(notes, {
        limit: hidden.moneyToSpend,
        cheapness: hidden.cheapness,
        loved: hidden.loved,
      });
    },
  });
  return (input) => {
    hidden = input.hidden;
    return inner(input);
  };
}
