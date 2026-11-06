import { describe, expect, it } from "vitest";
import {
  AgeRange,
  ageRangeOf,
  CASKET_PRICE,
  Casket,
  ClassicRandom,
  type Customer,
  createRandomCustomer,
  defineRelationship,
  Income,
  moodLabel,
  Relation,
} from "../src/index.js";

const SAMPLE = 20000;

function sample(): Customer[] {
  const rng = new ClassicRandom(12345, 67890);
  return Array.from({ length: SAMPLE }, () => createRandomCustomer(rng));
}

/** A "lover" between a teen (15 to 19) and someone who is not a teen: three outcomes the 2001 generator produces. */
const isTeenAndOtherLover = (c: Customer) => {
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

  it("produces every relationship pairing of the original, teens and adults included (create_customer.cpp:91, 116-117, 168-169)", () => {
    const seen = new Set<string>();
    for (const c of customers) {
      seen.add(`${ageRangeOf(c.customerAge)}/${ageRangeOf(c.deceasedAge)}/${c.relation}`);
    }
    const has = (customer: AgeRange, deceased: AgeRange, relation: number) =>
      seen.has(`${customer}/${deceased}/${relation}`);
    // Teen customer, adult deceased: Lover (:91).
    expect(has(AgeRange.Teen, AgeRange.Adult, Relation.Lover)).toBe(true);
    // Adult customer, teen deceased: Lover (:116-117).
    expect(has(AgeRange.Adult, AgeRange.Teen, Relation.Lover)).toBe(true);
    // Old customer, teen deceased: Lover (:168-169).
    expect(has(AgeRange.Old, AgeRange.Teen, Relation.Lover)).toBe(true);
    // Teen couples (:75-81) occur as well.
    expect(has(AgeRange.Teen, AgeRange.Teen, Relation.Lover)).toBe(true);
    expect(customers.some(isTeenAndOtherLover)).toBe(true);
  });
});

/**
 * An independent transliteration of `define_relationship_with_the_deceased`
 * (legacy/source/create_customer.cpp:31-199): the same sequence of `if`
 * statements assigning `e_relation` in place, so a later assignment
 * overwrites an earlier one exactly as in the C++. It takes the value each
 * `random(n)` returns and records n.
 */
function cppRelationship(
  customer: AgeRange,
  deceased: AgeRange,
  diff: boolean,
  draws: number[],
): { relation: Relation | undefined; asked: number[] } {
  const asked: number[] = [];
  const random = (n: number): number => {
    asked.push(n);
    return draws.shift() ?? 0;
  };
  let rel: Relation | undefined;
  const R = Relation;
  if (customer === AgeRange.Kid) {
    if (deceased === AgeRange.Kid) rel = R.Sibling; // :44
    if (deceased === AgeRange.Teen) rel = R.Sibling; // :49
    if (deceased === AgeRange.Adult) rel = R.Parent; // :54
    if (deceased === AgeRange.Old) rel = R.GrandParent; // :59
  }
  if (customer === AgeRange.Teen) {
    if (deceased === AgeRange.Kid) rel = R.Sibling; // :70
    if (deceased === AgeRange.Teen) {
      const i = random(3); // :75
      rel = R.Sibling;
      if (i === 1) if (diff) rel = R.Lover;
    }
    if (deceased === AgeRange.Adult) {
      const i = random(3); // :87
      rel = R.Parent;
      if (i === 1) if (diff) rel = R.Lover; // :91
    }
    if (deceased === AgeRange.Old) rel = R.GrandParent; // :97
  }
  if (customer === AgeRange.Adult) {
    if (deceased === AgeRange.Kid) rel = R.Child; // :108
    if (deceased === AgeRange.Teen) {
      const i = random(3); // :113
      rel = R.Child;
      if (i === 1) if (diff) rel = R.Lover; // :116-117
    }
    if (deceased === AgeRange.Adult) {
      const i = random(6); // :122
      rel = R.Sibling;
      if (i > 3) {
        if (diff) rel = R.Spouse;
        // The nested block tests i == 1 inside i > 3: lover and friend are unreachable (:131-135).
      }
    }
    if (deceased === AgeRange.Old) {
      const i = random(6); // :145
      rel = R.Parent;
      if (i === 1) if (diff) rel = R.Lover;
      if (i === 2) if (diff) rel = R.Spouse;
    }
  }
  if (customer === AgeRange.Old) {
    if (deceased === AgeRange.Kid) rel = R.GrandChild; // :160
    if (deceased === AgeRange.Teen) {
      const i = random(10); // :165
      rel = R.GrandChild;
      if (i === 1) if (diff) rel = R.Lover; // :168-169
    }
    if (deceased === AgeRange.Adult) {
      const i = random(10); // :175
      rel = R.Child;
      if (i === 1) if (diff) rel = R.Lover;
      if (i === 2) if (diff) rel = R.Spouse;
    }
    if (deceased === AgeRange.Old) {
      const i = random(6); // :187
      rel = diff ? R.Spouse : R.Sibling;
      if (i === 1) if (diff) rel = R.Lover;
      if (i === 2) rel = R.Sibling;
    }
  }
  return { relation: rel, asked };
}

/** A stand-in for the generator's random stream that returns scripted draws and records each bound. */
function scripted(draws: number[]): { rng: ClassicRandom; asked: number[] } {
  const asked: number[] = [];
  const rng = {
    random(n: number): number {
      asked.push(n);
      return draws.shift() ?? 0;
    },
  } as unknown as ClassicRandom;
  return { rng, asked };
}

const RANGES = [AgeRange.Kid, AgeRange.Teen, AgeRange.Adult, AgeRange.Old] as const;
const RANGE_NAME = ["kid", "teen", "adult", "old"] as const;

describe("define_relationship_with_the_deceased (legacy/source/create_customer.cpp:31-199), branch by branch", () => {
  // The table of docs/classic-rules.md section 2: [customer, deceased, bound of the draw or 0 for none, [outcome per draw 0..bound-1 when the sexes differ, same when they do not]].
  const R = Relation;
  const ONE = (r: Relation) => [r];
  type Row = {
    customer: AgeRange;
    deceased: AgeRange;
    bound: number;
    diff: Relation[];
    same: Relation[];
    lines: string;
  };
  const rows: Row[] = [
    {
      customer: AgeRange.Kid,
      deceased: AgeRange.Kid,
      bound: 0,
      diff: ONE(R.Sibling),
      same: ONE(R.Sibling),
      lines: ":41-44",
    },
    {
      customer: AgeRange.Kid,
      deceased: AgeRange.Teen,
      bound: 0,
      diff: ONE(R.Sibling),
      same: ONE(R.Sibling),
      lines: ":46-49",
    },
    {
      customer: AgeRange.Kid,
      deceased: AgeRange.Adult,
      bound: 0,
      diff: ONE(R.Parent),
      same: ONE(R.Parent),
      lines: ":51-54",
    },
    {
      customer: AgeRange.Kid,
      deceased: AgeRange.Old,
      bound: 0,
      diff: ONE(R.GrandParent),
      same: ONE(R.GrandParent),
      lines: ":56-59",
    },
    {
      customer: AgeRange.Teen,
      deceased: AgeRange.Kid,
      bound: 0,
      diff: ONE(R.Sibling),
      same: ONE(R.Sibling),
      lines: ":67-70",
    },
    {
      customer: AgeRange.Teen,
      deceased: AgeRange.Teen,
      bound: 3,
      diff: [R.Sibling, R.Lover, R.Sibling],
      same: [R.Sibling, R.Sibling, R.Sibling],
      lines: ":72-82",
    },
    {
      customer: AgeRange.Teen,
      deceased: AgeRange.Adult,
      bound: 3,
      diff: [R.Parent, R.Lover, R.Parent],
      same: [R.Parent, R.Parent, R.Parent],
      lines: ":84-92",
    },
    {
      customer: AgeRange.Teen,
      deceased: AgeRange.Old,
      bound: 0,
      diff: ONE(R.GrandParent),
      same: ONE(R.GrandParent),
      lines: ":94-97",
    },
    {
      customer: AgeRange.Adult,
      deceased: AgeRange.Kid,
      bound: 0,
      diff: ONE(R.Child),
      same: ONE(R.Child),
      lines: ":105-108",
    },
    {
      customer: AgeRange.Adult,
      deceased: AgeRange.Teen,
      bound: 3,
      diff: [R.Child, R.Lover, R.Child],
      same: [R.Child, R.Child, R.Child],
      lines: ":110-117",
    },
    {
      customer: AgeRange.Adult,
      deceased: AgeRange.Adult,
      bound: 6,
      diff: [R.Sibling, R.Sibling, R.Sibling, R.Sibling, R.Spouse, R.Spouse],
      same: [R.Sibling, R.Sibling, R.Sibling, R.Sibling, R.Sibling, R.Sibling],
      lines: ":119-141",
    },
    {
      customer: AgeRange.Adult,
      deceased: AgeRange.Old,
      bound: 6,
      diff: [R.Parent, R.Lover, R.Spouse, R.Parent, R.Parent, R.Parent],
      same: [R.Parent, R.Parent, R.Parent, R.Parent, R.Parent, R.Parent],
      lines: ":142-150",
    },
    {
      customer: AgeRange.Old,
      deceased: AgeRange.Kid,
      bound: 0,
      diff: ONE(R.GrandChild),
      same: ONE(R.GrandChild),
      lines: ":157-160",
    },
    {
      customer: AgeRange.Old,
      deceased: AgeRange.Teen,
      bound: 10,
      diff: [
        R.GrandChild,
        R.Lover,
        R.GrandChild,
        R.GrandChild,
        R.GrandChild,
        R.GrandChild,
        R.GrandChild,
        R.GrandChild,
        R.GrandChild,
        R.GrandChild,
      ],
      same: Array(10).fill(R.GrandChild),
      lines: ":162-170",
    },
    {
      customer: AgeRange.Old,
      deceased: AgeRange.Adult,
      bound: 10,
      diff: [
        R.Child,
        R.Lover,
        R.Spouse,
        R.Child,
        R.Child,
        R.Child,
        R.Child,
        R.Child,
        R.Child,
        R.Child,
      ],
      same: Array(10).fill(R.Child),
      lines: ":172-182",
    },
    {
      customer: AgeRange.Old,
      deceased: AgeRange.Old,
      bound: 6,
      diff: [R.Spouse, R.Lover, R.Sibling, R.Spouse, R.Spouse, R.Spouse],
      same: Array(6).fill(R.Sibling),
      lines: ":184-195",
    },
  ];

  for (const row of rows) {
    const name = `${RANGE_NAME[row.customer]} customer, ${RANGE_NAME[row.deceased]} deceased (create_customer.cpp${row.lines})`;
    it(`${name}: ${row.bound === 0 ? "no draw" : `one random(${row.bound})`}`, () => {
      for (const differentSex of [true, false]) {
        const expected = differentSex ? row.diff : row.same;
        const draws = row.bound === 0 ? [0] : Array.from({ length: row.bound }, (_, i) => i);
        for (const draw of draws) {
          const { rng, asked } = scripted([draw]);
          const got = defineRelationship(rng, row.customer, row.deceased, differentSex);
          expect(got, `draw ${draw}, ${differentSex ? "different" : "same"} sex`).toBe(
            expected[row.bound === 0 ? 0 : draw],
          );
          expect(asked).toEqual(row.bound === 0 ? [] : [row.bound]);
        }
      }
    });
  }

  it("agrees with a line-by-line transliteration of the C++ for every age range pair, draw and sex pairing", () => {
    for (const customer of RANGES) {
      for (const deceased of RANGES) {
        for (const diff of [true, false]) {
          for (let draw = 0; draw < 10; draw++) {
            const oracle = cppRelationship(customer, deceased, diff, [draw]);
            const { rng, asked } = scripted([draw]);
            const got = defineRelationship(rng, customer, deceased, diff);
            const label = `${RANGE_NAME[customer]}/${RANGE_NAME[deceased]} diff=${diff} draw=${draw}`;
            expect(got, label).toBe(oracle.relation);
            expect(asked, label).toEqual(oracle.asked);
          }
        }
      }
    }
  });

  it("never assigns Cousin or Friend, as the original cannot (the adult/adult lover and friend lines sit inside i_random > 3)", () => {
    for (const customer of RANGES) {
      for (const deceased of RANGES) {
        for (const diff of [true, false]) {
          for (let draw = 0; draw < 10; draw++) {
            const { rng } = scripted([draw]);
            const got = defineRelationship(rng, customer, deceased, diff);
            expect([5, 9]).not.toContain(got);
          }
        }
      }
    }
  });

  it("makes the three teen outcomes the original makes: teen/adult, adult/teen and old/teen can each be Lover (:91, :116-117, :168-169)", () => {
    expect(defineRelationship(scripted([1]).rng, AgeRange.Teen, AgeRange.Adult, true)).toBe(
      Relation.Lover,
    );
    expect(defineRelationship(scripted([1]).rng, AgeRange.Adult, AgeRange.Teen, true)).toBe(
      Relation.Lover,
    );
    expect(defineRelationship(scripted([1]).rng, AgeRange.Old, AgeRange.Teen, true)).toBe(
      Relation.Lover,
    );
    // Same sex never makes a Lover (different_sex, :21-27).
    expect(defineRelationship(scripted([1]).rng, AgeRange.Teen, AgeRange.Adult, false)).toBe(
      Relation.Parent,
    );
    expect(defineRelationship(scripted([1]).rng, AgeRange.Adult, AgeRange.Teen, false)).toBe(
      Relation.Child,
    );
    expect(defineRelationship(scripted([1]).rng, AgeRange.Old, AgeRange.Teen, false)).toBe(
      Relation.GrandChild,
    );
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
