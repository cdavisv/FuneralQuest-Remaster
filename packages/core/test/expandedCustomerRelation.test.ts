/**
 * Expanded customers keep the original relationship table (docs/classic-rules.md
 * section 2, legacy/source/create_customer.cpp:31-199): `generateCustomer` draws
 * a Classic `createRandomCustomer` first and nothing in Expanded filters,
 * re-rolls or reweights the relationship it returns.
 */
import { describe, expect, it } from "vitest";
import { AgeRange, ageRangeOf, Relation } from "../src/index.js";
import { atXDesk, cust, meet } from "./support/xplaces.js";

describe("Expanded customers' relationships are the original's", () => {
  it("allow every outcome of create_customer.cpp, teen and adult lovers included", () => {
    const lovers = { teenAdult: 0, adultTeen: 0, oldTeen: 0, teenTeen: 0 };
    let checked = 0;
    for (let seed = 1; seed <= 700; seed++) {
      const c = cust(meet(atXDesk({ seed })));
      // Specials and pets change who the customer or the deceased is after the draw.
      if (c.expanded.special !== null) continue;
      checked++;
      const customer = ageRangeOf(c.customerAge);
      const deceased = ageRangeOf(c.deceasedAge);
      const diff = c.customerMale !== c.deceasedMale;
      if (c.relation === Relation.Lover) {
        expect(diff).toBe(true);
        if (customer === AgeRange.Teen && deceased === AgeRange.Adult) lovers.teenAdult++;
        if (customer === AgeRange.Adult && deceased === AgeRange.Teen) lovers.adultTeen++;
        if (customer === AgeRange.Old && deceased === AgeRange.Teen) lovers.oldTeen++;
        if (customer === AgeRange.Teen && deceased === AgeRange.Teen) lovers.teenTeen++;
      }
      // Every relation is one the original's branch for these ranges can return.
      const allowed: Record<string, number[]> = {
        [`${AgeRange.Teen}/${AgeRange.Kid}`]: [Relation.Sibling],
        [`${AgeRange.Teen}/${AgeRange.Teen}`]: [Relation.Sibling, Relation.Lover],
        [`${AgeRange.Teen}/${AgeRange.Adult}`]: [Relation.Parent, Relation.Lover],
        [`${AgeRange.Teen}/${AgeRange.Old}`]: [Relation.GrandParent],
        [`${AgeRange.Adult}/${AgeRange.Kid}`]: [Relation.Child],
        [`${AgeRange.Adult}/${AgeRange.Teen}`]: [Relation.Child, Relation.Lover],
        [`${AgeRange.Adult}/${AgeRange.Adult}`]: [Relation.Sibling, Relation.Spouse],
        [`${AgeRange.Adult}/${AgeRange.Old}`]: [Relation.Parent, Relation.Lover, Relation.Spouse],
        [`${AgeRange.Old}/${AgeRange.Kid}`]: [Relation.GrandChild],
        [`${AgeRange.Old}/${AgeRange.Teen}`]: [Relation.GrandChild, Relation.Lover],
        [`${AgeRange.Old}/${AgeRange.Adult}`]: [Relation.Child, Relation.Lover, Relation.Spouse],
        [`${AgeRange.Old}/${AgeRange.Old}`]: [Relation.Spouse, Relation.Lover, Relation.Sibling],
      };
      expect(allowed[`${customer}/${deceased}`]).toContain(c.relation);
    }
    expect(checked).toBeGreaterThan(400);
    // The three outcomes a later default once suppressed occur, as they do in the original.
    expect(lovers.teenAdult).toBeGreaterThan(0);
    expect(lovers.adultTeen).toBeGreaterThan(0);
    expect(lovers.teenTeen).toBeGreaterThan(0);
  });
});
