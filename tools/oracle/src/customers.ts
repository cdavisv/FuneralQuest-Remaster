import {
  ClassicRandom,
  type Customer,
  type CustomerState,
  casketName,
  cMan,
  createRandomCustomer,
  customerMood,
  dRelation,
  incomeLabel,
} from "@fq/core";
import { crtSeedFor, oracleCustomers } from "./oracle.js";

/** The session's customer as the port stores it (customerText.ts customerStateFrom). */
function stateOf(c: Customer): CustomerState {
  return {
    active: true,
    customerMale: c.customerMale,
    customerAge: c.customerAge,
    deceasedMale: c.deceasedMale,
    deceasedAge: c.deceasedAge,
    relation: c.relation,
    income: c.income,
    desiredCasket: c.desiredCasket,
    bigUpgrade: -1,
    deathMethod: c.deathMethod,
    deathObject: c.deathObject,
    moneyToSpend: c.moneyToSpend,
    flow: "none",
    mood: c.mood,
    cheapness: c.cheapness,
    loved: c.loved,
    riskType: 0,
    portrait: null,
    showResistance: false,
    options: [],
  };
}

export interface CustomerMismatch {
  seed: number;
  field: string;
  original: unknown;
  port: unknown;
}

export interface CustomerReport {
  seeds: number;
  exact: number;
  mismatches: CustomerMismatch[];
}

/**
 * `create_random_customer` (create_customer.cpp:242-293) against the port's
 * `createRandomCustomer`, one customer per seed, both generators seeded the
 * same way. Compares every field, the derived labels and the number of draws.
 * The port's generator is the original's unaltered (docs/classic-rules.md
 * section 2), so there is no switch to set: the default is the original.
 */
export function compareCustomers(firstSeed: number, count: number): CustomerReport {
  const original = oracleCustomers(firstSeed, count);
  const mismatches: CustomerMismatch[] = [];
  let exact = 0;
  for (const line of original) {
    const rng = new ClassicRandom(line.seed, crtSeedFor(line.seed));
    const c = createRandomCustomer(rng);
    const state = stateOf(c);
    const o = line.customer;
    const pairs: [string, unknown, unknown][] = [
      ["customerMale", o.customerMale, c.customerMale],
      ["customerAge", o.customerAge, c.customerAge],
      ["deceasedMale", o.deceasedMale, c.deceasedMale],
      ["deceasedAge", o.deceasedAge, c.deceasedAge],
      ["relation", o.relation, c.relation],
      ["income", o.income, c.income],
      ["moneyToSpend", o.moneyToSpend, c.moneyToSpend],
      ["loved", o.loved, c.loved],
      // The harness prints floats with 9 significant digits, which round-trips a float32.
      ["mood", o.mood, Math.fround(Number(c.mood.toPrecision(9)))],
      ["cheapness", o.cheapness, Math.fround(Number(c.cheapness.toPrecision(9)))],
      ["deathObject", o.deathObject, c.deathObject],
      ["deathMethod", o.deathType, c.deathMethod],
      ["desiredCasket", o.desiredCasket, c.desiredCasket],
      ["bigUpgrade", o.bigUpgrade, -1],
      ["moodLabel", line.mood, customerMood(state)],
      ["relationLabel", line.relation, dRelation(state)],
      ["manLabel", line.man, cMan(state)],
      ["incomeLabel", line.income, incomeLabel(state)],
      ["casketLabel", line.casket, casketName(c.desiredCasket)],
      ["mtDraws", line.rng.mt, rng.mt.draws],
      ["crtDraws", line.rng.crt, rng.crt.draws],
    ];
    let ok = true;
    for (const [field, a, b] of pairs) {
      const same =
        typeof a === "number" && typeof b === "number"
          ? Math.fround(a) === Math.fround(b)
          : a === b;
      if (!same) {
        ok = false;
        mismatches.push({ seed: line.seed, field, original: a, port: b });
      }
    }
    if (ok) exact++;
  }
  return { seeds: original.length, exact, mismatches };
}
