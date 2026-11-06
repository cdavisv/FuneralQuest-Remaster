import type { XCustomer } from "./expanded/sell.js";
import type { Difficulty, PersonalityId } from "./personalities.js";

/**
 * Everything a bot remembers. It is built only from Views the bot was shown
 * (and its own name, which it chose), is plain JSON, and is saved with the
 * town in Solo mode.
 */
export interface BotMemory {
  version: 1;
  self: { playerId: number; name: string; parlor: string };
  personality: PersonalityId;
  difficulty: Difficulty;
  /** Read from the stats sheet and purchase screens. */
  known: KnownSelf;
  /** Prices seen in pitches (skill `learnPrices`). */
  learned: { softPrices: number[]; upgrades: number[] };
  /** The last rankings list seen. */
  rivals: RivalNote[];
  /** Names of rivals who robbed, beat, burned or cursed this bot (from letters). */
  grudges: string[];
  /** Reset at every log on. */
  session: SessionMemory;
  /** The customer in front of the bot, or null. */
  customer: CustomerNotes | null;
  /** Days played. */
  days: number;
  /** What it knows about its own Expanded parlor (absent in Classic towns). */
  x?: XMemory;
}

/** Expanded knowledge, all of it read from screens the bot was shown. */
export interface XMemory {
  /** Upgrade ids it has seen itself own (the contractor stops listing them). */
  owned: string[];
  /** Upgrade ids the contractor listed, with prices (the rest are owned). */
  offered: Record<string, number>;
  permits: string[];
  markup: number;
  rivalry: string;
  /** Game day of the last rivalry change (the office refuses another for 3 days). */
  rivalryDay: number;
  /** Stock as the stats sheet shows it. */
  stock: [number, number, number];
  monuments: number;
  inChain: boolean;
  candidate: boolean;
  /** The game day, from the town strip. */
  day: number;
  /** Open ballots, from the town strip on the desk and the map. */
  ballots: { kind: "ordinance" | "election"; voted: boolean }[];
  /** Rival strength guessed from the shove odds of past duels, by player id. */
  strength: Record<string, number>;
  /** Hits booked (day), so it does not hire one every night. */
  lastHit: number;
  lastCharity: number;
  /** Reset at every log on: the day's plan. */
  plan: XPlan;
  customer: XCustomer | null;
  /** The tour is finished or skipped. */
  toured: boolean;
}

export interface XPlan {
  morning: ErrandKind[];
  evening: ErrandKind[];
  /** Per errand: buttons pressed there today, to stop at a daily limit. */
  done: Record<string, number>;
}

export interface KnownSelf {
  psych: number;
  strength: number;
  hpMax: number;
  lockpicks: number;
  plots: number;
  visitsLeft: number;
  yangsLeft: number;
  ride: string;
  owns: { padlock: boolean; smoke: boolean; safe: boolean };
}

export interface RivalNote {
  id: number;
  name: string;
  bp: number;
  online: boolean;
  status: string;
}

export type ErrandKind =
  | "stats"
  | "bank"
  | "store"
  | "university"
  | "yangs"
  | "visit"
  | "cafe"
  | "letter"
  | "announce"
  // Expanded errands (expanded/day.ts).
  | "tour"
  | "office"
  | "hospital"
  | "cityhall"
  | "church"
  | "graveyard"
  | "club"
  | "bankout"
  | "bankin";

export interface SessionMemory {
  /** Errands still to run, in order. `morning` ones run before the turns are spent. */
  morning: ErrandKind[];
  evening: ErrandKind[];
  current: ErrandKind | null;
  /** Steps spent on the current errand (it is dropped past a budget). */
  errandSteps: number;
  /** Scratch for the current errand (JSON). */
  scratch: Record<string, string | number | boolean>;
  /** Signature of the last view, and how many times in a row it came back. */
  lastSig: string;
  repeats: number;
  /** The last action sent, as `type:id`. */
  lastAction: string;
  /** Visit targets tried today. */
  tried: string[];
  steps: number;
  /** Set when the bot has decided to log off. */
  leaving: boolean;
}

/** What the bot has worked out about the customer, from the screen. */
export interface CustomerNotes {
  /** Wood 0, Silver 1, Gold 2: the casket on order now. */
  casket: number;
  income: string;
  /** null while unknown. */
  loved: boolean | null;
  /** Bounds on the spending limit. `exact` is set when the screen gave it away. */
  lo: number;
  hi: number;
  exact: number | null;
  /** Resistance percent, when the psych skill revealed it. */
  resistance: number | null;
  /** The bot's guess at the resistance while it is hidden (starts at the average, 50). */
  guess: number;
  /** The panel's mood and total at the last decision. */
  mood: number;
  total: number;
  ceiling: number;
  levers: number;
  softs: number;
  hardRefusals: number;
  /** Upgrades bought after Gold (index of the next upgrade to be offered). */
  upgrades: number;
  noMoreUpgrades: boolean;
  /** The last pitch: which button and what it would have added. */
  lastPitch: "soft" | "hard" | "guilt" | "sympathy" | null;
  lastPrice: number;
}

export function newSession(): SessionMemory {
  return {
    morning: [],
    evening: [],
    current: null,
    errandSteps: 0,
    scratch: {},
    lastSig: "",
    repeats: 0,
    lastAction: "",
    tried: [],
    steps: 0,
    leaving: false,
  };
}

export function createMemory(options: {
  playerId: number;
  name: string;
  parlor: string;
  personality: PersonalityId;
  difficulty: Difficulty;
}): BotMemory {
  return {
    version: 1,
    self: { playerId: options.playerId, name: options.name, parlor: options.parlor },
    personality: options.personality,
    difficulty: options.difficulty,
    known: {
      psych: 0,
      strength: 3,
      hpMax: 10,
      lockpicks: 0,
      plots: 0,
      visitsLeft: 0,
      yangsLeft: 0,
      ride: "",
      owns: { padlock: false, smoke: false, safe: false },
    },
    learned: { softPrices: [], upgrades: [] },
    rivals: [],
    grudges: [],
    session: newSession(),
    customer: null,
    days: 0,
  };
}
