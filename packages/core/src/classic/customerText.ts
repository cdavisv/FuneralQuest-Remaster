import type { AssetId } from "@fq/protocol";
import type { ContentPack } from "../content/types.js";
import type { ClassicRandom } from "../rng/classicRandom.js";
import type { ClassicRules } from "../rules/classicRules.js";
import type { CustomerState } from "../state/types.js";
import { intToCash, type TemplateVars } from "../text/format.js";
import {
  AgeRange,
  ageRangeOf,
  type Customer,
  DEATH_METHODS,
  DEATH_OBJECTS,
  moodLabel,
  Relation,
} from "./customer.js";

/** A blank `communication_status` (the original's memset). */
export function emptyCustomer(): CustomerState {
  return {
    active: false,
    customerMale: false,
    customerAge: 0,
    deceasedMale: false,
    deceasedAge: 0,
    relation: 0,
    income: 0,
    desiredCasket: 0,
    bigUpgrade: 0,
    deathMethod: 0,
    deathObject: 0,
    moneyToSpend: 0,
    flow: "none",
    mood: 0,
    cheapness: 0,
    loved: false,
    riskType: 0,
    portrait: null,
    showResistance: false,
    options: [],
  };
}

/** `create_random_customer` (legacy/source/create_customer.cpp:242-293) into session state. */
export function customerStateFrom(c: Customer): CustomerState {
  return {
    ...emptyCustomer(),
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
    mood: c.mood,
    cheapness: c.cheapness,
    loved: c.loved,
  };
}

/** `c_man` (online_struct.cpp:129-155). */
export function cMan(c: CustomerState): string {
  const young = ageRangeOf(c.customerAge) <= AgeRange.Teen;
  if (c.customerMale) return young ? "boy" : "man";
  return young ? "girl" : "woman";
}

const A_YOUNG = ["A little", "A teenage", "A middle aged", "An old"] as const;
const YOUNG = ["little", "teenage", "middle aged", "old"] as const;

/** `c_a_young` (online_struct.cpp:204-218). */
export function cAYoung(c: CustomerState): string {
  return A_YOUNG[ageRangeOf(c.customerAge)];
}

/** `c_young` (online_struct.cpp:304-318). */
export function cYoung(c: CustomerState): string {
  return YOUNG[ageRangeOf(c.customerAge)];
}

/** `c_Young_man` (online_struct.cpp:531-539): "Middle aged man". */
export function cYoungMan(c: CustomerState): string {
  const s = `${cYoung(c)} ${cMan(c)}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const INCOME = ["Poor", "Average", "Rich", "Super Rich"] as const;

/** `c_income` (online_struct.cpp:221-232). */
export function incomeLabel(c: CustomerState): string {
  return INCOME[c.income] ?? "Error";
}

/** `c_mood` (online_struct.cpp:235-301). */
export function customerMood(c: CustomerState): string {
  return moodLabel(c.mood, c.loved);
}

const RELATION_MALE: Readonly<Record<number, string>> = {
  [Relation.Sibling]: "brother",
  [Relation.Parent]: "father",
  [Relation.Child]: "son",
  [Relation.Spouse]: "husband",
  5: "cousin",
  [Relation.GrandParent]: "grandfather",
  [Relation.Lover]: "boyfriend",
  [Relation.GrandChild]: "grandson",
  9: "friend",
};

const RELATION_FEMALE: Readonly<Record<number, string>> = {
  [Relation.Sibling]: "sister",
  [Relation.Parent]: "mother",
  [Relation.Child]: "daughter",
  [Relation.Spouse]: "wife",
  5: "cousin",
  [Relation.GrandParent]: "grandmother",
  [Relation.Lover]: "girlfriend",
  [Relation.GrandChild]: "granddaughter",
  9: "friend",
};

/** `d_relation` (online_struct.cpp:396-448): kids and teens say dad and mom. */
export function dRelation(c: CustomerState): string {
  if (c.relation === Relation.Parent && ageRangeOf(c.customerAge) <= AgeRange.Teen) {
    return c.deceasedMale ? "dad" : "mom";
  }
  const table = c.deceasedMale ? RELATION_MALE : RELATION_FEMALE;
  return table[c.relation] ?? "Error";
}

/** `d_fridge` (online_struct.cpp:160-180). */
export function dFridge(c: CustomerState): string {
  return DEATH_OBJECTS[c.deathObject] ?? "Error";
}

/** `d_smashed` (online_struct.cpp:183-200). */
export function dSmashed(c: CustomerState): string {
  return DEATH_METHODS[c.deathMethod] ?? "Error";
}

const CASKET_NAMES = ["Wood", "Silver", "Gold"] as const;

/** `get_casket_name` (legacy/source/misc_utils.cpp:7-15). */
export function casketName(tier: number): string {
  return CASKET_NAMES[tier] ?? "Unknown";
}

/**
 * `get_price_int` (online_struct.cpp:574-597): casket, plus every soft-sell
 * item bought, plus every hard-sell upgrade up to the last one bought.
 */
export function priceOf(c: CustomerState, rules: ClassicRules, content: ContentPack): number {
  let price = rules.casketPrices[c.desiredCasket] ?? 0;
  for (const option of c.options) price += content.softSell[option]?.price ?? 0;
  for (let i = 0; i <= c.bigUpgrade; i++) price += content.hardSell[i]?.price ?? 0;
  return price;
}

/**
 * `c_flash_url` (online_struct.cpp:321-394): the portrait closest to the
 * customer. Teens, adults and the old draw a random variant; kids do not.
 */
export function choosePortrait(rng: ClassicRandom, c: CustomerState): AssetId {
  const range = ageRangeOf(c.customerAge);
  let name: string;
  if (c.customerMale) {
    if (range === AgeRange.Kid) name = "m_kid";
    else if (range === AgeRange.Teen) name = ["m_teen", "m_teen_2"][rng.random(2)] as string;
    else if (range === AgeRange.Adult) {
      name = ["m_adult", "m_adult_2", "m_adult_3", "m_adult_4"][rng.random(4)] as string;
    } else name = ["m_old", "m_old_2", "m_old_5", "m_old_6"][rng.random(4)] as string;
  } else {
    if (range === AgeRange.Kid) name = "f_kid";
    else if (range === AgeRange.Teen) name = ["f_teen", "f_teen_2"][rng.random(2)] as string;
    else if (range === AgeRange.Adult) name = ["f_adult", "f_adult_2"][rng.random(2)] as string;
    else name = ["f_old", "f_old_2"][rng.random(2)] as string;
  }
  return `people/${name}`;
}

/** Background for a customer (commands_complicated.cpp:442-443): `random(4) + 1`. */
export function chooseBackground(rng: ClassicRandom): AssetId {
  return `background/background_${rng.random(4) + 1}`;
}

/** Placeholders shared by the negotiation lines (see `ClassicText`). */
export function customerVars(c: CustomerState): TemplateVars {
  const young = cYoungMan(c);
  return {
    cYoungMan: young,
    customer: `\`w${young}: \`$`,
    cMan: cMan(c),
    cAYoung: cAYoung(c),
    cHe: c.customerMale ? "he" : "she",
    cHeCap: c.customerMale ? "He" : "She",
    cHim: c.customerMale ? "him" : "her",
    cHis: c.customerMale ? "his" : "her",
    cSir: c.customerMale ? "sir" : "ma'am",
    cSirCap: c.customerMale ? "Sir" : "Ma'am",
    dRelation: dRelation(c),
    dHe: c.deceasedMale ? "he" : "she",
    dHeCap: c.deceasedMale ? "He" : "She",
    dHim: c.deceasedMale ? "him" : "her",
    dSmashed: dSmashed(c),
    dFridge: dFridge(c),
    limit: intToCash(c.moneyToSpend),
  };
}
