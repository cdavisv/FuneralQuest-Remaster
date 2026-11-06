import { describe, expect, it } from "vitest";
import {
  AgeRange,
  ageRangeOf,
  CASKET_PRICE,
  Casket,
  ClassicRandom,
  type Customer,
  createRandomCustomer,
  Income,
  moodLabel,
  Relation,
} from "../src/index.js";

const SAMPLE = 20000;

function sample(rules?: Parameters<typeof createRandomCustomer>[1]): Customer[] {
  const rng = new ClassicRandom(12345, 67890);
  return Array.from({ length: SAMPLE }, () => createRandomCustomer(rng, rules));
}

const isMinorAdultLover = (c: Customer) => {
  if (c.relation !== Relation.Lover) return false;
  const a = ageRangeOf(c.customerAge);
  const b = ageRangeOf(c.deceasedAge);
  return (a === AgeRange.Teen) !== (b === AgeRange.Teen);
};

describe("createRandomCustomer (legacy/source/create_customer.cpp:242-293)", () => {
  const customers = sample();

  it("is deterministic for a given pair of seeds", () => {
    const a = createRandomCustomer(new ClassicRandom(42, 43));
    const b = createRandomCustomer(new ClassicRandom(42, 43));
    expect(a).toEqual(b);
  });

  it("never makes a child the customer, and uses the original age bands", () => {
    for (const c of customers) {
      expect(c.customerAge).toBeGreaterThanOrEqual(15);
      const inBand = (age: number) =>
        (age >= 7 && age <= 11) ||
        (age >= 15 && age <= 19) ||
        (age >= 28 && age <= 40) ||
        (age >= 60 && age <= 99);
      expect(inBand(c.customerAge)).toBe(true);
      expect(inBand(c.deceasedAge)).toBe(true);
    }
    expect(customers.some((c) => ageRangeOf(c.deceasedAge) === AgeRange.Kid)).toBe(true);
  });

  it("draws the spending limit from the income band", () => {
    const bands = {
      [Income.Poor]: [801, 2800],
      [Income.Average]: [1900, 5400],
      [Income.Rich]: [3700, 7530],
      [Income.SuperRich]: [4600, 18500],
    } as const;
    for (const c of customers) {
      const [low, high] = bands[c.income];
      expect(c.moneyToSpend).toBeGreaterThanOrEqual(low);
      expect(c.moneyToSpend).toBeLessThanOrEqual(high);
    }
  });

  it("only asks for a casket the customer can afford", () => {
    for (const c of customers) {
      expect(CASKET_PRICE[c.desiredCasket]).toBeLessThanOrEqual(c.moneyToSpend);
    }
    expect(customers.some((c) => c.desiredCasket === Casket.Gold)).toBe(true);
  });

  it("keeps mood and cheapness in 0 to 10 and death text indexes in range", () => {
    for (const c of customers) {
      expect(c.mood).toBeGreaterThanOrEqual(0);
      expect(c.mood).toBeLessThanOrEqual(10);
      expect(c.cheapness).toBeGreaterThanOrEqual(0);
      expect(c.cheapness).toBeLessThanOrEqual(10);
      expect(c.deathObject).toBeLessThan(12);
      expect(c.deathMethod).toBeLessThan(8);
    }
  });

  it("splits sex, income and the loved flag about evenly", () => {
    const share = (pick: (c: Customer) => boolean) => customers.filter(pick).length / SAMPLE;
    expect(share((c) => c.customerMale)).toBeCloseTo(0.5, 1);
    expect(share((c) => c.loved)).toBeCloseTo(0.5, 1);
    expect(share((c) => c.income === Income.SuperRich)).toBeCloseTo(0.25, 1);
  });

  it("only makes lovers and spouses across sexes", () => {
    for (const c of customers) {
      if (c.relation === Relation.Lover || c.relation === Relation.Spouse) {
        expect(c.customerMale).not.toBe(c.deceasedMale);
      }
    }
  });

  it("never pairs an adult and a teen as lovers by default, but still allows teen couples", () => {
    expect(customers.some(isMinorAdultLover)).toBe(false);
    expect(
      customers.some(
        (c) =>
          c.relation === Relation.Lover &&
          ageRangeOf(c.customerAge) === AgeRange.Teen &&
          ageRangeOf(c.deceasedAge) === AgeRange.Teen,
      ),
    ).toBe(true);
  });

  it("reproduces the original pairing only when the legacy flag is on, changing nothing else", () => {
    const legacy = sample({ allowMinorAdultLover: true });
    expect(legacy.some(isMinorAdultLover)).toBe(true);
    for (let i = 0; i < SAMPLE; i++) {
      const fixed = customers[i] as Customer;
      const original = legacy[i] as Customer;
      expect({ ...original, relation: fixed.relation }).toEqual(fixed);
      if (original.relation !== fixed.relation) expect(isMinorAdultLover(original)).toBe(true);
    }
  });
});

describe("moodLabel (legacy/source/online_struct.cpp:235-301)", () => {
  it("uses different words for loved and not-loved customers at low mood", () => {
    expect(moodLabel(0.5, true)).toBe("In Shock");
    expect(moodLabel(0.5, false)).toBe("Chipper");
    expect(moodLabel(3.5, true)).toBe("Crying");
    expect(moodLabel(3.5, false)).toBe("Tight Lipped");
  });

  it("treats band edges as inclusive on the lower label", () => {
    expect(moodLabel(1, true)).toBe("In Shock");
    expect(moodLabel(1.01, true)).toBe("Dazed");
    expect(moodLabel(9, false)).toBe("Angry");
  });

  it("reads Pissed above 9 either way", () => {
    expect(moodLabel(9.5, true)).toBe("Pissed");
    expect(moodLabel(12, false)).toBe("Pissed");
  });
});
