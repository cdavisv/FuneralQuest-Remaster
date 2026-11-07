import { CLASSIC_RULES, CLASSIC_SETTINGS, type ClassicRules, type Nudge } from "./classicRules.js";
import { EXPANDED_TOWN, type ExpandedTownRules } from "./expandedTownRules.js";

/**
 * Tunables of the Expanded ruleset. Every number here is specified, with the
 * reasoning, in docs/expanded-rules.md; the section is named on each group.
 */
export interface ExpandedRules {
  /** Section 10.1. */
  turns: { bankMax: number };
  /** Section 3.1. */
  customer: {
    /** Spending limits and every price are multiples of this (section 3.7). */
    limitStep: number;
    /** Spending-limit bounds by income band (Classic's, on the $50 grid). */
    limitBands: [number, number][];
    /** Income band cut-offs on `random(100) + shift`: poor below the first, and so on. */
    incomeCutoffs: [number, number, number];
    /** Shift = floor(rating / ratingDiv) + floor((luck - 50) / luckDiv) + upgrade shifts. */
    ratingDiv: number;
    luckDiv: number;
    patience: { min: number; max: number };
    /** Chance a customer has a third, hidden trait. */
    hiddenTraitChance: number;
    /** Chance a customer is special: base x (0.5 + luck / 100). */
    specialChance: number;
    /** Chance a family the parlor served before comes back. */
    repeatChance: number;
    /** Families remembered per player. */
    familyMemory: number;
    /** Cheapness bands for tells. */
    cheapLowBelow: number;
    cheapHighAbove: number;
  };
  /** Section 3.6. */
  psych: {
    /** Highest internal psych level (the stats sheet shows one more). */
    maxLevel: number;
    /** Estimate half-width as a share of the limit: base + extra x decay^psych. */
    estimate: { base: number; extra: number; decay: number; minWidth: number };
    /** Chance (percent) the resistance is shown: base + perLevel x psych. */
    resistance: { base: number; perLevel: number };
    /** Chance (percent) of a free extra tell on arrival: perLevel x psych, at most max. */
    extraTell: { perLevel: number; max: number };
    /** Cheapness and mood taken off on arrival per psych level (the Classic halving, tamed). */
    calm: { cheapness: number; mood: number };
  };
  /** Section 9.4. */
  caps: { hpMax: number; strength: number };
  /** Section 3.7. */
  scoring: {
    bpMultiplier: number;
    /** Exact match: `share` of base BP plus `flat`. */
    exact: { share: number; flat: number };
    /** Within `within` (share of the limit) pays `share` of base BP, best first. */
    tiers: { within: number; share: number; key: "great" | "nice" }[];
    /** Mood below this at Done is a happy family; at or above `sourAt` a sour one. */
    happyBelow: number;
    sourAt: number;
  };
  /** Section 3.4. */
  actions: {
    /** Mood added per action once patience is used up. */
    impatience: Nudge;
    coffee: { mood: Nudge; patience: number; machineMult: number };
    listen: { patience: number; lovedMood: number; notLovedMood: Nudge };
    discount: { share: number; max: number; mood: Nudge; cheapness: number; poorKarma: number };
    /** Cremation pitch: reluctance base, loved extra, cheapness weight. */
    cremation: { base: number; loved: number; cheapWeight: number; reliefMood: number };
    bless: { mood: number };
    raise: { cheapness: number; mood: number; rating: number };
  };
  /** Section 4. */
  hand: {
    size: number;
    luckyAt: number;
    luckySize: number;
    unluckyAt: number;
    unluckySize: number;
  };
  /** Section 6. */
  money: {
    startingMoney: number;
    startingStock: [number, number, number];
    /** Wholesale share of the list casket price. */
    wholesale: number;
    /** A sale with no casket in stock pays wholesale x this at once. */
    rushMult: number;
    /** Share of the non-casket bill the parlor keeps. */
    serviceCut: number;
    /** Every plot pays this a day, on top of premium plot income. */
    plotIncome: number;
    stockCapacity: number;
    storeroomCapacity: number;
    /** Evil karma (at or below `karma.evil[0]`) buys stock at this share. */
    shadyStock: number;
  };
  /** Section 6.3. */
  markup: { options: number[]; cheapnessPer10: number; ratingPer10: number };
  /** Section 9.5: by hearse index, matching `ClassicRules.hearses`. */
  hearses: { upkeep: number; rating: number }[];
  /** Section 7.1. */
  rating: {
    base: number;
    plotsPerPoint: number;
    plotsMax: number;
    reviewsMax: number;
    happy: number;
    sour: number;
    walkout: number;
    /** Each new day reviews move this share toward 0. */
    decay: number;
    karmaBonus: [number, number];
    karmaPenalty: [number, number];
  };
  /** Section 7.2. */
  upgrades: UpgradeRule[];
  /** Section 8. */
  karma: {
    good: [number, number];
    evil: [number, number];
    /** Cheapness added on arrival at good / evil karma. */
    goodCheapness: number;
    evilCheapness: number;
    guiltOnLoved: number;
    /** Extra turns a day with the Grave Robber and Necromancer perks ("accidents" near the parlor). */
    evilTurns: [number, number];
    /** Mood taken off on arrival with the Trusted perk. */
    trustedMood: number;
    dig: { perDay: number; turns: number; luckWeight: number; money: { min: number; max: number } };
    prepChance: number;
  };
  /** Section 9. */
  pvp: {
    gainFactor: number;
    gainCap: number;
    lossShare: number;
    cutthroatMult: number;
    necroMult: number;
    sanctuaryMult: number;
    defencePerLevel: number;
    strengthPerLevel: number;
    turnAwayPerLevel: number;
    peacefulTax: number;
    cutthroatVisits: number;
    rivalryCooldown: number;
    cashSteal: { share: number; max: number };
    arson: { stockShare: number; reviews: number };
  };
  /** Section 9.4. */
  underdog: {
    below: number;
    scale: number;
    max: number;
    /**
     * A parlor that opened after day 1 of the season: the same formula with
     * these numbers (the higher share applies), so a late starter can reach the
     * middle of the table without lifting every established parlor that trails.
     */
    late: {
      below: number;
      scale: number;
      max: number;
      /**
       * Dollars a parlor created after day 1 of a season starts with, per season day already
       * played, on top of the starting money (section 9.4): the established parlors bought
       * their upgrades with that time.
       */
      money: number;
    };
  };
  /** Section 10.3. */
  newPlayerGraceDays: number;
  /** Sections 16 to 25: the town's places and the living world (rules/expandedTownRules.ts). */
  town: ExpandedTownRules;
}

/** A parlor upgrade (section 7.2). Names and descriptions are content (`ExpandedContent.upgrades`). */
export interface UpgradeRule {
  id: string;
  /** Dollars. */
  price: number;
  /** Rating points while owned. */
  rating: number;
  requires?: string;
  /** Counts toward the building level (the picture of the parlor). */
  building?: boolean;
  /** Security level given (PvP defence, section 9.2). */
  defence?: number;
  /** Added to the customer income roll. */
  incomeShift?: number;
  /** Added to every customer's patience. */
  patience?: number;
  /** City Hall permit id needed before the contractor will build it (section 18.1). */
  permit?: string;
}

export const EXPANDED: ExpandedRules = {
  turns: { bankMax: 15 },
  customer: {
    limitStep: 50,
    limitBands: [
      [850, 2800],
      [1900, 5400],
      [3700, 7550],
      [4600, 18500],
    ],
    incomeCutoffs: [35, 65, 90],
    ratingDiv: 6,
    luckDiv: 5,
    patience: { min: 7, max: 10 },
    hiddenTraitChance: 0.5,
    specialChance: 0.06,
    repeatChance: 0.2,
    familyMemory: 30,
    cheapLowBelow: 3.5,
    cheapHighAbove: 6.5,
  },
  psych: {
    maxLevel: 7,
    estimate: { base: 0.08, extra: 0.32, decay: 0.78, minWidth: 100 },
    resistance: { base: 10, perLevel: 10 },
    extraTell: { perLevel: 10, max: 70 },
    calm: { cheapness: 0.35, mood: 0.1 },
  },
  caps: { hpMax: 60, strength: 15 },
  scoring: {
    bpMultiplier: 0.0064,
    exact: { share: 0.5, flat: 12 },
    tiers: [
      { within: 0.03, share: 0.3, key: "great" },
      { within: 0.08, share: 0.15, key: "nice" },
    ],
    happyBelow: 4,
    sourAt: 7,
  },
  actions: {
    impatience: { base: 0.5, range: 0.5 },
    coffee: { mood: { base: 0.8, range: 1 }, patience: 1, machineMult: 1.5 },
    listen: { patience: 2, lovedMood: -0.3, notLovedMood: { base: 0.3, range: 0.4 } },
    discount: { share: 0.1, max: 2, mood: { base: 1.2, range: 1 }, cheapness: 0.5, poorKarma: 1 },
    cremation: { base: 6, loved: 2, cheapWeight: 0.8, reliefMood: 1 },
    bless: { mood: 2 },
    raise: { cheapness: 2.5, mood: 1, rating: 0 },
  },
  hand: { size: 3, luckyAt: 75, luckySize: 4, unluckyAt: 20, unluckySize: 2 },
  money: {
    startingMoney: 2000,
    startingStock: [2, 0, 0],
    wholesale: 0.75,
    rushMult: 1.3,
    serviceCut: 0.08,
    plotIncome: 2,
    stockCapacity: 6,
    storeroomCapacity: 18,
    shadyStock: 0.85,
  },
  markup: { options: [-10, 0, 10, 20, 30], cheapnessPer10: 1.3, ratingPer10: -5 },
  hearses: [
    { upkeep: 0, rating: 0 },
    { upkeep: 150, rating: 1 },
    { upkeep: 400, rating: 3 },
    { upkeep: 800, rating: 5 },
    { upkeep: 1500, rating: 8 },
  ],
  rating: {
    base: 10,
    plotsPerPoint: 20,
    plotsMax: 15,
    reviewsMax: 20,
    happy: 1,
    sour: -1,
    walkout: -2,
    decay: 0.1,
    karmaBonus: [2, 5],
    karmaPenalty: [-2, -4],
  },
  upgrades: [
    { id: "paint", price: 2000, rating: 3, building: true },
    { id: "coffee-machine", price: 3000, rating: 1 },
    { id: "guard-dog", price: 6000, rating: 0, defence: 1 },
    { id: "florist-cooler", price: 8000, rating: 2 },
    { id: "storeroom", price: 10000, rating: 0 },
    { id: "embalming-lab", price: 12000, rating: 3 },
    { id: "alarm", price: 16000, rating: 0, defence: 2, requires: "guard-dog" },
    {
      id: "viewing-room",
      price: 18000,
      rating: 4,
      building: true,
      requires: "paint",
      patience: 2,
    },
    { id: "incinerator", price: 24000, rating: 2 },
    // Engine pass (tuning log, "Loose ends"): 32,000 / +1 -> 20,000 / +2.
    // Balance round (tuning log, round 13): 20,000 -> 12,000, so a defended parlor can afford it
    // while there is still a season to protect.
    {
      id: "night-watchman",
      price: 12000,
      rating: 2,
      defence: 3,
      requires: "alarm",
      incomeShift: 5,
    },
    {
      id: "chapel",
      price: 50000,
      rating: 8,
      building: true,
      requires: "viewing-room",
      incomeShift: 15,
    },
    { id: "mausoleum", price: 80000, rating: 8, building: true, requires: "chapel" },
    // Section 18.1: late upgrades that need a City Hall permit.
    // Engine pass: billboard 20,000 / +8 -> 14,000 / +10; garden 45,000 / +5 -> 30,000 / +6.
    // Round 13: billboard 14,000 / +10 -> 18,000 / +8 (three times a monument per dollar);
    // garden 30,000 / patience +1 -> 20,000 / patience +2 (bought on day 26, returned nothing).
    { id: "billboard", price: 20000, rating: 2, incomeShift: 7, permit: "signage" },
    {
      id: "memorial-garden",
      price: 20000,
      rating: 6,
      patience: 2,
      incomeShift: 4,
      permit: "zoning",
    },
    {
      id: "crematorium",
      price: 60000,
      rating: 4,
      incomeShift: 8,
      requires: "incinerator",
      permit: "crematory",
    },
  ],
  karma: {
    good: [70, 85],
    evil: [30, 15],
    goodCheapness: -0.5,
    evilCheapness: 0,
    guiltOnLoved: -1,
    evilTurns: [0, 1],
    trustedMood: 0.8,
    dig: { perDay: 2, turns: 0, luckWeight: 0.9, money: { min: 200, max: 900 } },
    prepChance: 0.4,
  },
  pvp: {
    gainFactor: 1.1,
    gainCap: 95,
    lossShare: 0.5,
    cutthroatMult: 1.25,
    necroMult: 1.15,
    sanctuaryMult: 0.5,
    defencePerLevel: 0.15,
    strengthPerLevel: 2,
    turnAwayPerLevel: 15,
    peacefulTax: 0.08,
    cutthroatVisits: 1,
    rivalryCooldown: 3,
    cashSteal: { share: 0.05, max: 1500 },
    arson: { stockShare: 0.5, reviews: -5 },
  },
  underdog: {
    below: 0.7,
    scale: 0.5,
    max: 0.25,
    late: { below: 0.98, scale: 3, max: 1.5, money: 1500 },
  },
  newPlayerGraceDays: 7,
  town: EXPANDED_TOWN,
};

/**
 * The Expanded ruleset: Classic with the deliberate changes of
 * docs/expanded-rules.md and the `expanded` block. Classic fixes stay on.
 */
export const EXPANDED_RULES: ClassicRules = {
  ...CLASSIC_RULES,
  ruleset: "expanded",
  settings: {
    ...CLASSIC_SETTINGS,
    startingMoney: EXPANDED.money.startingMoney,
    // 3.1 of the plan: Expanded towns are 30-day seasons that end with the meteor.
    tournamentActive: true,
    tournamentDays: 30,
  },
  // Section 3.7: the same 0.0064, closeness handled by `expanded.scoring`.
  bpMultiplier: EXPANDED.scoring.bpMultiplier,
  // Section 9.5: fewer bonus turns, the same gold prices; upkeep is in `expanded.hearses`.
  hearses: [
    { price: 4, bonusTurns: 0 },
    { price: 12, bonusTurns: 1, picture: "hearse/hearse1" },
    { price: 30, bonusTurns: 2, picture: "hearse/hearse2" },
    { price: 50, bonusTurns: 2, picture: "hearse/hearse3" },
    { price: 80, bonusTurns: 3, picture: "hearse/hearse4" },
  ],
  places: {
    ...CLASSIC_RULES.places,
    // Section 3.6: psych costs more per level and stops at `psych.maxLevel`.
    university: { ...CLASSIC_RULES.places.university, psychPerLevel: 4 },
  },
  // Section 10.2: rewards apply at once.
  mailRewardsOnDelivery: false,
  // Host moderation of what live players type to each other (mail, fortunes).
  filterUserText: true,
  // Section 10.3.
  zeroBpGraceDays: EXPANDED.newPlayerGraceDays,
  pvp: { ...CLASSIC_RULES.pvp, stealMax: 4 },
  expanded: EXPANDED,
};
