import type { ClassicRandom } from "../rng/classicRandom.js";

/** Casket tiers; the numeric value is also the tag type the sale awards. */
export const Casket = { Wood: 0, Silver: 1, Gold: 2 } as const;
export type Casket = (typeof Casket)[keyof typeof Casket];

/** legacy/source/online_struct.h:17-19 */
export const CASKET_PRICE: Readonly<Record<Casket, number>> = {
  [Casket.Wood]: 800,
  [Casket.Silver]: 2600,
  [Casket.Gold]: 5300,
};

export const AgeRange = { Kid: 0, Teen: 1, Adult: 2, Old: 3 } as const;
export type AgeRange = (typeof AgeRange)[keyof typeof AgeRange];

/** Inclusive age bounds per range (legacy/source/create_customer.cpp:6-17). */
const AGE_BOUNDS: Readonly<Record<AgeRange, readonly [number, number]>> = {
  [AgeRange.Kid]: [7, 11],
  [AgeRange.Teen]: [15, 19],
  [AgeRange.Adult]: [28, 40],
  [AgeRange.Old]: [60, 99],
};

export const Relation = {
  Sibling: 1,
  Parent: 2,
  Child: 3,
  Spouse: 4,
  GrandParent: 6,
  Lover: 7,
  GrandChild: 8,
} as const;
export type Relation = (typeof Relation)[keyof typeof Relation];

export const Income = { Poor: 0, Average: 1, Rich: 2, SuperRich: 3 } as const;
export type Income = (typeof Income)[keyof typeof Income];

/** Inclusive spending-limit bounds (legacy/source/create_customer.cpp:215-239). */
const SPENDING_LIMIT: Readonly<Record<Income, readonly [number, number]>> = {
  [Income.Poor]: [CASKET_PRICE[Casket.Wood] + 1, 2800],
  [Income.Average]: [1900, 5400],
  [Income.Rich]: [3700, 7530],
  [Income.SuperRich]: [4600, 18500],
};

/** legacy/source/online_struct.cpp:158-200 */
export const DEATH_OBJECTS = [
  "car",
  "tractor",
  "fridge",
  "piano",
  "bull",
  "elephant",
  "truck",
  "fork-lift",
  "exercise machine",
  "power boat",
  "computer",
  "house",
] as const;

export const DEATH_METHODS = [
  "hit by",
  "smashed by",
  "run over by",
  "thrown by",
  "crushed by",
  "done in by",
  "fatally stuck inside",
  "smacked a good one by",
] as const;

export interface Customer {
  customerMale: boolean;
  customerAge: number;
  deceasedMale: boolean;
  deceasedAge: number;
  relation: Relation;
  income: Income;
  /** The hidden spending limit in dollars. */
  moneyToSpend: number;
  /** Hidden: true when the customer really loved the deceased. */
  loved: boolean;
  /** 0 is calm; at 10 the customer walks out. */
  mood: number;
  /** 0 buys anything; 10 buys nothing. */
  cheapness: number;
  deathObject: number;
  deathMethod: number;
  desiredCasket: Casket;
}

export interface CustomerRules {
  /**
   * The 2001 generator can pair an adult with a 15 to 19 year old as lovers.
   * The remaster turns that outcome off in every mode; set this to true only
   * to reproduce the original output exactly in parity tests. The random
   * draws are consumed either way, so the rest of the customer is unchanged.
   */
  allowMinorAdultLover: boolean;
}

export const DEFAULT_CUSTOMER_RULES: CustomerRules = { allowMinorAdultLover: false };

/** legacy/source/online_struct.cpp:611-622 */
export function ageRangeOf(age: number): AgeRange {
  if (age >= 60) return AgeRange.Old;
  if (age >= 28) return AgeRange.Adult;
  if (age >= 15) return AgeRange.Teen;
  return AgeRange.Kid;
}

function randomAge(rng: ClassicRandom, range: AgeRange): number {
  const [low, high] = AGE_BOUNDS[range];
  return rng.randomRange(low, high);
}

/**
 * Port of `define_relationship_with_the_deceased`
 * (legacy/source/create_customer.cpp:31-199). The branch structure and the
 * draws mirror the original, including the adult/adult case where the lover
 * and friend outcomes are unreachable.
 */
function relationFor(
  rng: ClassicRandom,
  customer: AgeRange,
  deceased: AgeRange,
  differentSex: boolean,
  rules: CustomerRules,
): Relation {
  const minorLover = rules.allowMinorAdultLover;

  if (customer === AgeRange.Teen) {
    if (deceased === AgeRange.Kid) return Relation.Sibling;
    if (deceased === AgeRange.Teen) {
      return rng.random(3) === 1 && differentSex ? Relation.Lover : Relation.Sibling;
    }
    if (deceased === AgeRange.Adult) {
      return rng.random(3) === 1 && differentSex && minorLover ? Relation.Lover : Relation.Parent;
    }
    return Relation.GrandParent;
  }

  if (customer === AgeRange.Adult) {
    if (deceased === AgeRange.Kid) return Relation.Child;
    if (deceased === AgeRange.Teen) {
      return rng.random(3) === 1 && differentSex && minorLover ? Relation.Lover : Relation.Child;
    }
    if (deceased === AgeRange.Adult) {
      return rng.random(6) > 3 && differentSex ? Relation.Spouse : Relation.Sibling;
    }
    const roll = rng.random(6);
    if (roll === 1 && differentSex) return Relation.Lover;
    if (roll === 2 && differentSex) return Relation.Spouse;
    return Relation.Parent;
  }

  if (customer === AgeRange.Old) {
    if (deceased === AgeRange.Kid) return Relation.GrandChild;
    if (deceased === AgeRange.Teen) {
      return rng.random(10) === 1 && differentSex && minorLover
        ? Relation.Lover
        : Relation.GrandChild;
    }
    if (deceased === AgeRange.Adult) {
      const roll = rng.random(10);
      if (roll === 1 && differentSex) return Relation.Lover;
      if (roll === 2 && differentSex) return Relation.Spouse;
      return Relation.Child;
    }
    const roll = rng.random(6);
    if (roll === 2) return Relation.Sibling;
    if (roll === 1 && differentSex) return Relation.Lover;
    return differentSex ? Relation.Spouse : Relation.Sibling;
  }

  // Kids are never customers; the original has this branch but cannot reach it.
  if (deceased === AgeRange.Adult) return Relation.Parent;
  if (deceased === AgeRange.Old) return Relation.GrandParent;
  return Relation.Sibling;
}

/**
 * Port of `create_random_customer` (legacy/source/create_customer.cpp:242-293).
 * The order of random draws is part of the contract.
 */
export function createRandomCustomer(
  rng: ClassicRandom,
  rules: CustomerRules = DEFAULT_CUSTOMER_RULES,
): Customer {
  const customerMale = rng.random(2) === 0;
  // Kids are never customers, so the range roll skips 0.
  const customerAge = randomAge(rng, (1 + rng.random(3)) as AgeRange);

  const deceasedMale = rng.random(2) === 0;
  const deceasedAge = randomAge(rng, rng.random(4) as AgeRange);

  const relation = relationFor(
    rng,
    ageRangeOf(customerAge),
    ageRangeOf(deceasedAge),
    customerMale !== deceasedMale,
    rules,
  );

  const income = rng.random(4) as Income;
  const [low, high] = SPENDING_LIMIT[income];
  const moneyToSpend = rng.randomRange(low, high);

  const loved = rng.random(2) === 1;
  const mood = rng.frandom(10);
  const cheapness = rng.frandom(10);

  const deathObject = rng.random(DEATH_OBJECTS.length);
  const deathMethod = rng.random(DEATH_METHODS.length);

  // Reroll until the casket fits the limit. Wood always fits (limit >= 801).
  let desiredCasket: Casket;
  do {
    desiredCasket = rng.random(3) as Casket;
  } while (CASKET_PRICE[desiredCasket] > moneyToSpend);

  return {
    customerMale,
    customerAge,
    deceasedMale,
    deceasedAge,
    relation,
    income,
    moneyToSpend,
    loved,
    mood,
    cheapness,
    deathObject,
    deathMethod,
    desiredCasket,
  };
}

const MOOD_LABELS_LOVED = [
  "In Shock",
  "Dazed",
  "Confused",
  "Crying",
  "Numb",
  "Disturbed",
  "Frustrated",
  "Irked",
  "Angry",
  "Pissed",
] as const;

const MOOD_LABELS_NOT_LOVED = [
  "Chipper",
  "In a hurry",
  "Natural",
  "Tight Lipped",
  "Nervous",
  "Frustrated",
  "Annoyed",
  "Irked",
  "Angry",
  "Pissed",
] as const;

/**
 * The mood word shown on the portrait (legacy/source/online_struct.cpp:235-301).
 * Bands are inclusive at both ends and checked low to high, so a mood of
 * exactly 1.0 still reads as the first label. Anything above 9 is "Pissed".
 */
export function moodLabel(mood: number, loved: boolean): string {
  const labels = loved ? MOOD_LABELS_LOVED : MOOD_LABELS_NOT_LOVED;
  if (mood < 0) return "";
  for (let band = 0; band < 9; band++) {
    if (mood <= band + 1) return labels[band] as string;
  }
  return labels[9];
}
