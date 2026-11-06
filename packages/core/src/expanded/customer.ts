import type { AssetId } from "@fq/protocol";
import {
  AgeRange,
  ageRangeOf,
  type Casket,
  createRandomCustomer,
  Income,
} from "../classic/customer.js";
import { customerStateFrom, customerVars } from "../classic/customerText.js";
import type { Turn } from "../engine/turn.js";
import type { ClassicRandom } from "../rng/classicRandom.js";
import type { ExpandedRules } from "../rules/expandedRules.js";
import type { CustomerState } from "../state/types.js";
import { fill, intToCash, type TemplateVars } from "../text/format.js";
import type { CustomerEffects, SpecialCustomerDef, TraitDef } from "./content/types.js";
import { MODIFIER_KEYS, modValue } from "./modifiers.js";
import { hasPerk, incomeShift } from "./parlor.js";
import { clamp, pick, roll, xc, xp, xr } from "./players.js";
import { estimateHalfShare, gridLimit, makeEstimate, markedUp } from "./scoring.js";
import type { ExpandedCustomer, FamilyMemory } from "./state.js";
import { injuryPatience, TOWN_MODIFIER_KEYS } from "./town/life.js";

/**
 * Expanded customers (docs/expanded-rules.md section 3): a Classic customer
 * (`createRandomCustomer`, for age, sex, relation, loved, mood, cheapness and
 * the death) with a name, a backstory, traits, tells, an estimate, patience,
 * and sometimes a special rule set or a family that remembers the parlor.
 */

/** The Expanded part of the session's customer. Throws when there is none. */
export function xcust(c: CustomerState): ExpandedCustomer {
  if (!c.expanded) throw new Error("Not an Expanded customer");
  return c.expanded;
}

export function traitDefs(turn: Turn, c: CustomerState): TraitDef[] {
  const all = xc(turn).traits;
  return (c.expanded?.traits ?? [])
    .map((id) => all.find((t) => t.id === id))
    .filter((t): t is TraitDef => !!t);
}

export function specialDef(turn: Turn, c: CustomerState): SpecialCustomerDef | undefined {
  const id = c.expanded?.special;
  return id ? xc(turn).specials.find((s) => s.id === id) : undefined;
}

/** Every effect on this customer: traits (all, hidden included) then the special. */
export function effectsOf(turn: Turn, c: CustomerState): CustomerEffects[] {
  const out: CustomerEffects[] = traitDefs(turn, c).map((t) => t.effects);
  const special = specialDef(turn, c);
  if (special?.effects) out.push(special.effects);
  return out;
}

/** Product of a multiplier key over every effect (default 1). */
export function multOf(
  effects: CustomerEffects[],
  key: "moodMult" | "limitMult" | "guilt" | "sympathy" | "coffee" | "discount" | "estimate",
): number {
  let out = 1;
  for (const e of effects) {
    const v = e[key];
    if (v !== undefined) out *= v;
  }
  return out;
}

/** Sum of an additive key over every effect. */
export function sumOf(
  effects: CustomerEffects[],
  key: "cheapness" | "mood" | "patience" | "hardSell",
): number {
  let out = 0;
  for (const e of effects) out += e[key] ?? 0;
  return out;
}

/** Sum of tag affinities for an item with `tags`. */
export function affinityOf(effects: CustomerEffects[], tags: readonly string[]): number {
  let out = 0;
  for (const e of effects) for (const tag of tags) out += e.affinity?.[tag] ?? 0;
  return out;
}

/** Facts one Listen reveals. */
export function listenCount(effects: CustomerEffects[]): number {
  let out = 1;
  for (const e of effects) if (e.listen !== undefined) out = Math.max(out, e.listen);
  return out;
}

function weightedPick<T extends { weight?: number }>(
  turn: Turn,
  items: readonly T[],
): T | undefined {
  const total = items.reduce((sum, i) => sum + (i.weight ?? 1), 0);
  if (items.length === 0 || total <= 0) return undefined;
  let r = roll(turn.rng) * total;
  for (const item of items) {
    r -= item.weight ?? 1;
    if (r < 0) return item;
  }
  return items[items.length - 1];
}

/** Section 3.3: two visible traits (forced ones first), and a hidden third half the time. */
function chooseTraits(
  turn: Turn,
  forced: readonly string[],
  practice: boolean,
  forcedLoved: boolean | undefined,
): { ids: string[]; visible: number } {
  const all = xc(turn).traits;
  const ids: string[] = forced.filter((id) => all.some((t) => t.id === id));
  // A trait never contradicts a loved flag the special customer forces (its tells must stay honest).
  const fits = (t: TraitDef) =>
    !ids.includes(t.id) &&
    (forcedLoved === undefined ||
      t.effects.loved === undefined ||
      t.effects.loved === forcedLoved) &&
    !ids.some(
      (id) => t.excludes?.includes(id) || all.find((o) => o.id === id)?.excludes?.includes(t.id),
    );
  const wanted = 2 + (practice ? 0 : roll(turn.rng) < xr(turn).customer.hiddenTraitChance ? 1 : 0);
  while (ids.length < wanted) {
    const next = weightedPick(turn, all.filter(fits));
    if (!next) break;
    ids.push(next.id);
  }
  return { ids, visible: Math.min(2, ids.length) };
}

function chooseSpecial(turn: Turn): SpecialCustomerDef | undefined {
  const rules = xr(turn);
  const p = turn.player;
  const chance = modValue(
    turn.town,
    MODIFIER_KEYS.specialChance,
    rules.customer.specialChance * (0.5 + p.luck / 100),
  );
  if (roll(turn.rng) >= chance) return undefined;
  const eligible = xc(turn).specials.filter((s) => (s.minDay ?? 0) <= turn.town.day);
  return weightedPick(turn, eligible);
}

const REPEAT_EFFECT: Record<FamilyMemory, { mood: number; cheapness: number }> = {
  happy: { mood: -1.5, cheapness: -1 },
  ok: { mood: 0, cheapness: 0 },
  sour: { mood: 1.5, cheapness: 1 },
  walked: { mood: 3, cheapness: 2 },
};

/** Section 3.1: the income band from `random(100)` plus rating, luck and upgrade shifts. */
export function rollIncome(turn: Turn, extra = 0): Income {
  const rules = xr(turn);
  const shift =
    modValue(turn.town, MODIFIER_KEYS.incomeShift, incomeShift(rules, turn.player)) + extra;
  const value = turn.rng.random(100) + shift;
  const [a, b, c] = rules.customer.incomeCutoffs;
  if (value < a) return Income.Poor;
  if (value < b) return Income.Average;
  if (value < c) return Income.Rich;
  return Income.SuperRich;
}

/** Casket prices at the player's markup (and a special's multiplier), on the price grid. */
export function casketPricesFor(turn: Turn, markup: number, mult = 1): [number, number, number] {
  const step = xr(turn).customer.limitStep;
  const base = turn.rules.casketPrices;
  return [0, 1, 2].map((tier) => markedUp((base[tier] ?? 0) * mult, markup, step)) as [
    number,
    number,
    number,
  ];
}

/** Picks one of the tell lines for a hidden fact, truthfully (section 3.5). */
export function tellLine(turn: Turn, c: CustomerState, kind: "loved" | "cheap"): string {
  const t = xc(turn).tells;
  const x = turn.rules.expanded as ExpandedRules;
  if (kind === "loved") return pick(turn.rng, c.loved ? t.loved : t.notLoved);
  if (c.cheapness < x.customer.cheapLowBelow) return pick(turn.rng, t.cheapLow);
  if (c.cheapness > x.customer.cheapHighAbove) return pick(turn.rng, t.cheapHigh);
  return pick(turn.rng, t.cheapMid);
}

/**
 * Generates the next customer into the session (section 3.1). With
 * `practice`, the guided first day's gentle customer: average income, loved,
 * calm, no special.
 */
export function generateCustomer(turn: Turn, practice = false, incomeExtra = 0): CustomerState {
  const rules = xr(turn);
  const content = xc(turn);
  const rng = turn.rng;
  const p = turn.player;
  const x = xp(turn);
  const base = customerStateFrom(createRandomCustomer(rng));
  const c: CustomerState = { ...base };

  const special = practice ? undefined : chooseSpecial(turn);
  let repeat: FamilyMemory | null = null;
  let surname: string;
  if (special?.person) {
    surname = special.person.surname;
    c.customerMale = special.person.male;
    if (c.customerAge < 28) c.customerAge = 45;
  } else if (
    !special &&
    !practice &&
    x.families.length > 0 &&
    roll(rng) < rules.customer.repeatChance
  ) {
    const family = pick(rng, x.families);
    surname = family.surname;
    repeat = family.memory;
  } else {
    surname = pick(rng, content.names.surnames);
  }
  const first =
    special?.person?.first ?? pick(rng, c.customerMale ? content.names.male : content.names.female);
  let deceasedFirst = pick(rng, c.deceasedMale ? content.names.male : content.names.female);
  if (special?.pet) deceasedFirst = pick(rng, content.names.pets);
  if (special?.selfFuneral) {
    deceasedFirst = first;
    c.deceasedMale = c.customerMale;
    c.deceasedAge = c.customerAge;
  }

  // Income and the limit (section 3.1).
  let income = rollIncome(turn, incomeExtra);
  if (practice) income = Income.Average;
  if (special?.incomeAtLeast !== undefined && income < special.incomeAtLeast) {
    income = special.incomeAtLeast as Income;
  }
  c.income = income;
  const band = rules.customer.limitBands[income] ?? [850, 2800];
  c.moneyToSpend = gridLimit(rng, band[0], band[1], rules.customer.limitStep);

  const forcedLoved = practice ? true : special?.effects?.loved;
  const traits = chooseTraits(
    turn,
    special?.traits ?? (practice ? ["sentimental"] : []),
    practice,
    forcedLoved,
  );
  const xcu: ExpandedCustomer = {
    first,
    surname,
    deceasedFirst,
    traits: traits.ids,
    visibleTraits: traits.visible,
    special: special?.id ?? null,
    repeat,
    notes: [],
    told: { loved: false, cheap: false, limit: false },
    estimate: { low: 0, high: 0 },
    patience: 0,
    patienceMax: 0,
    coffee: false,
    listens: 0,
    discounts: 0,
    discount: 0,
    blessed: false,
    raised: false,
    hand: [],
    bought: [],
    refused: [],
    track: "burial",
    cremationAsked: false,
    pet: special?.pet ? pick(rng, special.pet) : "",
    casketPrices: [0, 0, 0],
    markup: x.markup,
    packages: {},
    pane: "main",
    actions: 0,
    practice,
  };
  c.expanded = xcu;
  const effects = effectsOf(turn, c);

  // Hidden state after effects (section 3.3).
  for (const e of effects) if (e.loved !== undefined) c.loved = e.loved;
  if (practice) {
    c.loved = true;
    c.mood = 1 + rng.frandom(2);
    c.cheapness = 1 + rng.frandom(1.5);
  }
  let cheapness = c.cheapness + sumOf(effects, "cheapness");
  let mood = c.mood + sumOf(effects, "mood");
  if (repeat) {
    cheapness += REPEAT_EFFECT[repeat].cheapness;
    mood += REPEAT_EFFECT[repeat].mood;
  }
  if (hasPerk(rules, p, "trusted")) {
    cheapness += rules.karma.goodCheapness;
    mood -= rules.karma.trustedMood;
  } else if (p.karma <= rules.karma.evil[0]) {
    cheapness += rules.karma.evilCheapness;
  }
  // Section 3.6: a trained eye disarms a little resistance and calms a little.
  const level = Math.min(p.psych, rules.psych.maxLevel);
  cheapness -= rules.psych.calm.cheapness * level;
  mood -= rules.psych.calm.mood * level;
  cheapness = modValue(turn.town, MODIFIER_KEYS.arrivalCheapness, cheapness);
  mood = modValue(turn.town, MODIFIER_KEYS.arrivalMood, mood);
  c.cheapness = clamp(cheapness, 0, 10);
  c.mood = clamp(mood, 0, 9.5);

  const limitMult = modValue(turn.town, MODIFIER_KEYS.limitMult, multOf(effects, "limitMult"));
  const step = rules.customer.limitStep;
  c.moneyToSpend = Math.max(step, Math.round((c.moneyToSpend * limitMult) / step) * step);

  // Caskets at the markup; the wanted casket must fit (section 6.3).
  xcu.casketPrices = casketPricesFor(turn, x.markup, special?.casketPriceMult ?? 1);
  if (xcu.casketPrices[0] > c.moneyToSpend) c.moneyToSpend = xcu.casketPrices[0];
  let desired: Casket;
  do {
    desired = rng.random(3) as Casket;
  } while (xcu.casketPrices[desired] > c.moneyToSpend);
  c.desiredCasket = desired;

  // Patience (section 3.4).
  let patience = rng.randomRange(rules.customer.patience.min, rules.customer.patience.max);
  patience += sumOf(effects, "patience");
  for (const u of rules.upgrades)
    if (u.patience && x.upgrades.includes(u.id)) patience += u.patience;
  // Sections 19.1 and 22.1: injuries make you groan through the pitch; the weather frays nerves.
  patience += Math.round(modValue(turn.town, TOWN_MODIFIER_KEYS.patience, 0));
  patience -= injuryPatience(turn, p);
  xcu.patienceMax = Math.max(2, patience);
  xcu.patience = xcu.patienceMax;

  // The estimate (section 3.6).
  const half = estimateHalfShare(rules, p.psych, multOf(effects, "estimate"));
  xcu.estimate = makeEstimate(rng, rules, c.moneyToSpend, half);
  // They can obviously pay for what they asked for (section 3.6).
  xcu.estimate.low = Math.max(xcu.estimate.low, xcu.casketPrices[desired]);
  return c;
}

/** Placeholders for Expanded customer lines (content/types.ts). */
export function xvars(turn: Turn, c: CustomerState, extra: TemplateVars = {}): TemplateVars {
  const x = c.expanded;
  const base = customerVars(c);
  if (!x) return { ...base, player: turn.player.name, ...extra };
  const special = specialDef(turn, c);
  const name = `${x.first} ${x.surname}`;
  const pet = x.pet;
  const casketName = ["wood", "silver", "gold"][c.desiredCasket] ?? "wood";
  return {
    ...base,
    player: turn.player.name,
    cName: name,
    cFirst: x.first,
    surname: x.surname,
    dFirst: x.deceasedFirst,
    customer: `\`w${name}: \`$`,
    customerName: `\`w${name}\`$`,
    dHis: c.deceasedMale ? "his" : "her",
    dRelation: pet !== "" ? pet : special?.selfFuneral ? "self" : String(base.dRelation),
    pet,
    casket: casketName,
    aFridge: `${/^[aeiou]/i.test(String(base.dFridge)) ? "an" : "a"} ${base.dFridge}`,
    AFridge: `${/^[aeiou]/i.test(String(base.dFridge)) ? "An" : "A"} ${base.dFridge}`,
    limit: intToCash(c.moneyToSpend),
    ...extra,
  };
}

/**
 * Section 3.2: the arrival text and the first notes: backstory, then one
 * tell (loved or cheapness), then trait lines, then what psych finds.
 */
export function arrivalNotes(turn: Turn, c: CustomerState): { text: string[]; psych: string[] } {
  const rules = xr(turn);
  const content = xc(turn);
  const x = xcust(c);
  const rng = turn.rng;
  const v = xvars(turn, c);
  const bits = content.backstoryBits;
  const special = specialDef(turn, c);
  const text: string[] = [];

  if (!special) {
    const story = fill(pick(rng, content.backstories), {
      ...v,
      job: pick(rng, bits.jobs),
      hobby: pick(rng, bits.hobbies),
      place: pick(rng, bits.places),
      years: rng.randomRange(3, 40),
    });
    x.notes.push(`\`8${story}\`$`);
  }

  // One free tell: loved or cheapness (section 3.5).
  const first: "loved" | "cheap" = rng.random(2) === 0 ? "loved" : "cheap";
  const tell = fill(tellLine(turn, c, first), v);
  x.told[first] = true;
  x.notes.push(tell);
  text.push(tell);

  for (const trait of traitDefs(turn, c).slice(0, x.visibleTraits)) {
    if (trait.lines.length > 0 && rng.random(2) === 0) text.push(fill(pick(rng, trait.lines), v));
  }

  const psych: string[] = [];
  const p = turn.player;
  const level = Math.min(p.psych, rules.psych.maxLevel);
  if (rng.random(100) < rules.psych.resistance.base + rules.psych.resistance.perLevel * level) {
    c.showResistance = true;
    psych.push(fill(content.text.negotiation.resistance, v));
  }
  const extraChance = Math.min(rules.psych.extraTell.max, rules.psych.extraTell.perLevel * level);
  if (rng.random(100) < extraChance) {
    const other: "loved" | "cheap" = first === "loved" ? "cheap" : "loved";
    const line = fill(tellLine(turn, c, other), v);
    x.told[other] = true;
    x.notes.push(line);
    psych.push(content.text.negotiation.psychTell + line);
  }
  return { text, psych };
}

/**
 * Section 3.2 and 25.4: the customer's portrait. Classic's choice
 * (`choosePortrait`, commands_complicated.cpp) with the Remastered pack's four
 * new faces added to the adult and old pools (people/m_adult_5, m_old_7,
 * f_adult_3, f_old_3). Expanded only; Classic keeps the original draws.
 */
export function chooseExpandedPortrait(rng: ClassicRandom, c: CustomerState): AssetId {
  const range = ageRangeOf(c.customerAge);
  const from = (xs: readonly string[]): string => xs[rng.random(xs.length)] as string;
  let name: string;
  if (c.customerMale) {
    if (range === AgeRange.Kid) name = "m_kid";
    else if (range === AgeRange.Teen) name = from(["m_teen", "m_teen_2"]);
    else if (range === AgeRange.Adult)
      name = from(["m_adult", "m_adult_2", "m_adult_3", "m_adult_4", "m_adult_5"]);
    else name = from(["m_old", "m_old_2", "m_old_5", "m_old_6", "m_old_7"]);
  } else {
    if (range === AgeRange.Kid) name = "f_kid";
    else if (range === AgeRange.Teen) name = from(["f_teen", "f_teen_2"]);
    else if (range === AgeRange.Adult) name = from(["f_adult", "f_adult_2", "f_adult_3"]);
    else name = from(["f_old", "f_old_2", "f_old_3"]);
  }
  return `people/${name}`;
}
