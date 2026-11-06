import type { View } from "@fq/protocol";
import type { BotMemory, CustomerNotes } from "./memory.js";
import type { SalesStyle, Skill } from "./personalities.js";
import type { BotRandom } from "./random.js";
import { dollars, money, plain } from "./read.js";

/**
 * The sales brain. It works only from what the negotiation screen shows: the
 * customer panel (income, mood word and level, running total, resistance if
 * revealed), the request line, the psych lines and the customer's answers.
 * Facts any regular learns by playing (income bands, casket prices, that the
 * mood words differ for a customer who loved the deceased) are written here
 * as player knowledge, the way a strategy guide would print them.
 */

export type Move = "soft" | "hard" | "guilt" | "sympathy" | "done";

/** Casket prices as printed in every Hard Sell pitch. */
const CASKETS = [800, 2600, 5300];
/** The two casket steps a Hard Sell offers. */
const HARD_STEPS = [1800, 2700];
const CASKET_NAMES = ["Wood", "Silver", "Gold"];

/** Spending limits by income, learned by any regular. */
export const INCOME_BANDS: Readonly<Record<string, readonly [number, number]>> = {
  Poor: [801, 2800],
  Average: [1900, 5400],
  Rich: [3700, 7530],
  "Super Rich": [4600, 18500],
};

/** Mood words that only a customer who loved the deceased uses, and only one who did not. */
const LOVED_WORDS = new Set(["In Shock", "Dazed", "Confused", "Crying", "Numb", "Disturbed"]);
const COLD_WORDS = new Set([
  "Chipper",
  "In a hurry",
  "Natural",
  "Tight Lipped",
  "Nervous",
  "Annoyed",
]);

/** The cheapest soft-sell item and upgrade a regular has seen (used before any price is learned). */
const MIN_SOFT = 50;
const MIN_UPGRADE = 1750;
const TYPICAL_UPGRADE = 2600;

export function isNegotiation(view: View): boolean {
  return !view.overlay && view.buttons.some((b) => b.id === "neg:done") && !!view.customer;
}

/** What the mood word says about the loved flag, or null when it cannot tell. */
export function lovedFromMood(label: string, level: number): boolean | null {
  if (LOVED_WORDS.has(label)) return true;
  if (COLD_WORDS.has(label)) return false;
  if (label === "Frustrated") {
    if (level >= 6.15) return true;
    if (level <= 5.95) return false;
  }
  return null;
}

/** Notes on a customer who just walked in. */
export function meetCustomer(
  view: View,
  style: SalesStyle,
  skill: Skill,
  rng: BotRandom,
): CustomerNotes {
  const panel = view.customer;
  const text = plain(view.text);
  const casketMatch = /a (Wood|Silver|Gold) casket/.exec(text);
  const casket = Math.max(0, CASKET_NAMES.indexOf(casketMatch?.[1] ?? "Wood"));
  const income = panel?.incomeLabel ?? "Poor";
  const band = INCOME_BANDS[income] ?? [801, 18500];
  let hi = band[1];
  if (/Spending limit doubled/.test(text)) hi *= 2;
  const notes: CustomerNotes = {
    casket,
    income,
    loved: null,
    lo: Math.max(band[0], CASKETS[casket] ?? 800),
    hi,
    exact: null,
    resistance: panel?.resistancePercent ?? null,
    guess: 50,
    mood: panel?.moodLevel ?? 0,
    total: panel?.total ?? 0,
    ceiling: Math.min(9.6, style.moodCeiling + rng.jitter(skill.ceilingNoise)),
    levers: 0,
    softs: 0,
    hardRefusals: 0,
    upgrades: 0,
    noMoreUpgrades: false,
    lastPitch: null,
    lastPrice: 0,
  };
  // The psych lines: estimate (exact once read) and the mood type.
  if (rng.chance(skill.readMood)) {
    if (/seems heartbroken/.test(text)) notes.loved = true;
    else if (/seems guilty/.test(text)) notes.loved = false;
    else if (panel) notes.loved = lovedFromMood(panel.moodLabel, panel.moodLevel);
  }
  const estimate = /worth about \$([\d,]+)/.exec(text);
  if (estimate?.[1] && skill.useQuotes) notes.exact = money(estimate[1]);
  return notes;
}

/** Updates the notes from the screen that answered the last pitch. */
export function observe(notes: CustomerNotes, view: View, skill: Skill, memory: BotMemory): void {
  const panel = view.customer;
  if (!panel) return;
  const text = plain(view.text);
  const before = notes.total;
  const moodBefore = notes.mood;
  const accepted = panel.total > before;
  if (accepted) {
    notes.lo = Math.max(notes.lo, panel.total);
    if (notes.lastPitch === "hard") {
      if (notes.casket < 2) notes.casket++;
      else {
        if (skill.learnPrices) memory.learned.upgrades[notes.upgrades] = panel.total - before;
        notes.upgrades++;
      }
    } else if (notes.lastPitch === "soft" && skill.learnPrices) {
      learnSoft(memory, panel.total - before);
    }
  }
  if (notes.lastPitch === "soft" || notes.lastPitch === "hard") {
    const quoted = dollars(text)[0];
    if (quoted !== undefined) notes.lastPrice = quoted;
    if (notes.lastPitch === "soft" && quoted !== undefined && skill.learnPrices) {
      learnSoft(memory, quoted);
    }
    if (/over my limit\.\. how about/.test(text) && skill.trackLimit) {
      notes.hi = Math.min(notes.hi, before + notes.lastPrice - 1);
    } else if (!accepted && notes.lastPitch === "hard") {
      notes.hardRefusals++;
    }
    if (notes.lastPitch === "hard" && /already bought everything big/.test(text)) {
      notes.noMoreUpgrades = true;
    }
  }
  if (skill.useQuotes) {
    const spend = /only want to spend \$([\d,]+)|\$([\d,]+) or less/.exec(text);
    const amount = spend?.[1] ?? spend?.[2];
    if (amount) notes.exact = money(amount);
  }
  // Guilt raises a loving customer's mood by 1 to 4 and a cold one's by 0 to 1;
  // Sympathy raises a cold customer's by 1.4 to 3.4 and a loving one's by 0.4 to 1.4.
  if (skill.moodDeltas && notes.loved === null) {
    const delta = panel.moodLevel - moodBefore;
    if (notes.lastPitch === "guilt") {
      if (delta > 1.05) notes.loved = true;
      else if (delta < 0.95) notes.loved = false;
    } else if (notes.lastPitch === "sympathy") {
      if (delta > 1.45) notes.loved = false;
      else if (delta < 1.35) notes.loved = true;
    }
  }
  if (notes.loved === null && skill.readMood >= 0.8) {
    notes.loved = lovedFromMood(panel.moodLabel, panel.moodLevel);
  }
  if (panel.resistancePercent !== undefined) notes.resistance = panel.resistancePercent;
  notes.mood = panel.moodLevel;
  notes.total = panel.total;
}

function learnSoft(memory: BotMemory, price: number): void {
  if (price <= 0 || memory.learned.softPrices.includes(price)) return;
  memory.learned.softPrices.push(price);
  memory.learned.softPrices.sort((a, b) => a - b);
}

/** The next pitch, or Done. */
export function chooseMove(
  notes: CustomerNotes,
  view: View,
  style: SalesStyle,
  skill: Skill,
  rng: BotRandom,
  memory: BotMemory,
): Move {
  const panel = view.customer;
  if (!panel) return "done";
  const mood = panel.moodLevel;
  const total = panel.total;
  const limit = notes.exact;
  const top = limit ?? notes.hi;
  const floor = limit ?? notes.lo;
  if (limit !== null && total >= limit) return "done";
  if (skill.planner) return plan(notes, view, style, skill, memory);
  if (mood >= notes.ceiling) return "done";
  // A careless seller settles once the sale looks big enough.
  if (limit !== null && skill.stopShort < 1 && total >= limit * skill.stopShort) {
    if (rng.chance(0.7)) return "done";
  }
  const minSoft = skill.learnPrices ? (memory.learned.softPrices[0] ?? MIN_SOFT) : MIN_SOFT;
  const room = top - total;
  // Above 9 an offer the customer cannot afford makes them walk: only pitch what surely fits.
  const nervous = mood > 8.9;

  // Lower resistance with the lever that suits the customer.
  if (notes.levers < style.leverMax && mood + 1.6 < notes.ceiling) {
    const resistance = notes.resistance;
    const high =
      resistance === null
        ? notes.levers === 0 && style.leverAbove < 50
        : resistance > style.leverAbove;
    if (high) {
      if (notes.loved !== null) return notes.loved ? "sympathy" : "guilt";
      // Without a read, a careless seller guesses.
      if (skill.readMood < 0.5 && rng.chance(0.5)) return rng.chance(0.5) ? "sympathy" : "guilt";
    }
  }

  const upgradePrice =
    notes.casket < 2
      ? (HARD_STEPS[notes.casket] ?? 0)
      : (memory.learned.upgrades[notes.upgrades] ??
        (skill.learnPrices ? TYPICAL_UPGRADE : MIN_UPGRADE));
  const hardRefused = skill.knowsHardRefusal && notes.resistance !== null && notes.resistance > 80;
  const hardPossible =
    !(notes.casket >= 2 && notes.noMoreUpgrades) && notes.hardRefusals < 3 && !hardRefused;
  const hardFits = skill.trackLimit ? total + upgradePrice <= top : true;
  const hardSure = total + upgradePrice <= floor;
  const softFits = skill.trackLimit ? room >= minSoft : true;
  const softPossible = notes.softs < style.softMax && softFits;
  const canHard = hardPossible && hardFits && (!nervous || hardSure);
  const canSoft = softPossible && (!nervous || total + minSoft <= floor);

  // Close to a known limit: small items can only help, as long as the mood holds.
  if (limit !== null && room <= 100) {
    if (style.chaseExact && canSoft && mood < notes.ceiling - 1.2) return "soft";
    return "done";
  }
  if (canHard && (rng.chance(style.hardFirst) || !canSoft)) return "hard";
  if (canSoft) return "soft";
  return "done";
}

/** Sends the move and records it in the notes. */
export function pitch(notes: CustomerNotes, move: Move): string {
  if (move === "soft") notes.softs++;
  if (move === "guilt" || move === "sympathy") {
    notes.levers++;
    // The right lever takes 0.7 to 2.7 off the resistance (out of 10).
    if (notes.loved === (move === "sympathy")) notes.guess = Math.max(0, notes.guess - 17);
  }
  notes.lastPitch = move === "done" ? null : move;
  notes.lastPrice = move === "hard" && notes.casket < 2 ? (HARD_STEPS[notes.casket] ?? 0) : 0;
  return `neg:${move}`;
}

// ---------------------------------------------------------------------------
// The planner: expected BP of each pitch against the chance of losing the sale.

const BP_RATE = 0.0064;
const bpOf = (price: number): number =>
  Math.trunc(Math.fround(Math.fround(price) * Math.fround(BP_RATE)));

/** The bonus Done pays at `room` dollars under the limit (exact 200, within 50: 35, within 100: 25). */
function bonusAt(room: number): number {
  if (room === 0) return 200;
  if (room > 0 && room <= 50) return 35;
  if (room > 0 && room <= 100) return 25;
  return 0;
}

/** Chance that `mood + base + U(0, range)` reaches 10. */
function walkChance(mood: number, base: number, range: number): number {
  const need = 10 - mood - base;
  if (need <= 0) return 1;
  if (need >= range) return 0;
  return 1 - need / range;
}

/** Chance the limit covers `price`, with the limit uniform between the bounds. */
function affordChance(notes: CustomerNotes, price: number): number {
  if (notes.exact !== null) return price <= notes.exact ? 1 : 0;
  if (price <= notes.lo) return 1;
  if (price > notes.hi) return 0;
  return (notes.hi - price + 1) / (notes.hi - notes.lo + 1);
}

interface Option {
  move: Move;
  ev: number;
}

function plan(
  notes: CustomerNotes,
  view: View,
  style: SalesStyle,
  skill: Skill,
  memory: BotMemory,
): Move {
  const panel = view.customer;
  if (!panel) return "done";
  const mood = panel.moodLevel;
  const total = panel.total;
  const resistance = (notes.resistance ?? notes.guess) / 100;
  const room = notes.exact !== null ? notes.exact - total : null;
  // What Done pays now; a walkout loses all of it (and hands a rival 5 to 9 BP).
  const value = bpOf(total) + (room !== null ? bonusAt(room) : 0);
  const loss = (value + 7) * style.walkAversion;
  // Raising the mood spends future pitches; a point of mood is worth about a BP.
  const moodCost = Math.max(0.5, 4 - (10 - mood) * 0.35);
  const options: Option[] = [{ move: "done", ev: 0 }];

  // Hard Sell: the casket steps, then the upgrades in order.
  const hardPrice =
    notes.casket < 2
      ? (HARD_STEPS[notes.casket] ?? 0)
      : (memory.learned.upgrades[notes.upgrades] ?? TYPICAL_UPGRADE);
  const hardOpen =
    !(notes.casket >= 2 && notes.noMoreUpgrades) &&
    notes.hardRefusals < 4 &&
    !(skill.knowsHardRefusal && notes.resistance !== null && notes.resistance > 80);
  if (hardOpen) {
    const refuse = Math.min(1, notes.resistance !== null && notes.resistance > 80 ? 1 : resistance);
    const [base, range] = notes.casket < 2 ? [0.6, 1] : [0.7, 1];
    const afford = affordChance(notes, total + hardPrice);
    const after = total + hardPrice;
    const gain =
      bpOf(after) - bpOf(total) + (room !== null ? bonusAt(room - hardPrice) - bonusAt(room) : 0);
    const overWalk = mood > 9 ? 1 : 0;
    const ev =
      (1 - refuse) * afford * gain -
      refuse * walkChance(mood, base, range) * loss -
      (1 - refuse) * (1 - afford) * overWalk * loss -
      (refuse + (1 - refuse) * (1 - afford)) * (base + range / 2) * moodCost;
    options.push({ move: "hard", ev });
  }

  // Soft Sell: a random item, priced like the ones seen so far.
  if (notes.softs < style.softMax * 2) {
    const prices = memory.learned.softPrices.length >= 5 ? memory.learned.softPrices : SOFT_GUESS;
    let ev = 0;
    for (const price of prices) {
      const afford = affordChance(notes, total + price);
      const gain =
        bpOf(total + price) -
        bpOf(total) +
        (room !== null ? bonusAt(room - price) - bonusAt(room) : 0);
      const overWalk = mood > 9 ? 1 : 0;
      ev +=
        (1 - resistance) * afford * gain -
        resistance * walkChance(mood, 0.4, 0.7) * loss -
        (1 - resistance) * (1 - afford) * overWalk * loss -
        (resistance * 0.75 + (1 - resistance) * (1 - afford) * 0.9) * moodCost;
    }
    options.push({ move: "soft", ev: ev / prices.length });
  }

  // The lever: worth it while there is a lot left to sell and the mood has room.
  if (
    notes.loved !== null &&
    notes.levers < style.leverMax &&
    resistance * 100 > style.leverAbove
  ) {
    const rise = notes.loved ? 0.9 : 0.5;
    const upside = notes.exact !== null ? Math.max(0, notes.exact - total) : (notes.hi - total) / 2;
    const ev = Math.min(upside, 6000) * BP_RATE * 0.17 * 0.6 - rise * moodCost * 1.2;
    if (mood + rise + 1 < 9.5) options.push({ move: notes.loved ? "sympathy" : "guilt", ev });
  }

  let best = options[0] as Option;
  for (const o of options) if (o.ev > best.ev + 0.05) best = o;
  return best.move;
}

/** Soft-sell prices before any are learned: the spread a regular expects. */
const SOFT_GUESS = [50, 100, 150, 150, 200, 250, 300, 300, 350, 400, 450, 500, 600];
