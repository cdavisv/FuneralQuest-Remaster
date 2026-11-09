/**
 * Rival parlor personalities. Each is a set of legible preferences, not a
 * cheat sheet: they change what the bot wants (how hard it pushes a
 * customer, what it buys, whom it bothers), never what it can see.
 */

export type ClassicPersonalityId =
  | "mourner"
  | "shark"
  | "gambler"
  | "saboteur"
  | "builder"
  | "scholar";

/** Personalities the Expanded town's systems made possible (docs/balance/expanded-baseline.md). */
export type ExpandedPersonalityId =
  | "saint"
  | "necromancer"
  | "tycoon"
  | "politician"
  | "organiser"
  | "pacifist";

export type PersonalityId = ClassicPersonalityId | ExpandedPersonalityId;

/** The six Classic personalities (the Classic simulator seats these). */
export const PERSONALITY_IDS: readonly ClassicPersonalityId[] = [
  "mourner",
  "shark",
  "gambler",
  "saboteur",
  "builder",
  "scholar",
];

/** The six Expanded-only personalities. They also play Classic, with Classic-only habits. */
export const EXPANDED_ONLY_IDS: readonly ExpandedPersonalityId[] = [
  "saint",
  "necromancer",
  "tycoon",
  "politician",
  "organiser",
  "pacifist",
];

/** Every personality, for Expanded towns. */
export const ALL_PERSONALITY_IDS: readonly PersonalityId[] = [
  ...PERSONALITY_IDS,
  ...EXPANDED_ONLY_IDS,
];

/** Things a bot can spend gold tags on. */
export type ShopItem =
  | "hearse"
  | "psych"
  | "padlock"
  | "smoke"
  | "safe"
  | "lockpicks"
  | "strength"
  | "hp";

export interface ShopWant {
  item: ShopItem;
  /** When this item is wanted but not affordable, save up: buy nothing further down the list. */
  saveFor?: boolean;
  /** Stop wanting it at this level (psych level, strength, lockpicks held, hearse index). */
  upTo?: number;
}

export interface SalesStyle {
  /** Stop pitching once the mood reaches this (10 walks out). */
  moodCeiling: number;
  /** Lower resistance with Guilt or Sympathy above this resistance percent. */
  leverAbove: number;
  /** How many times at most to use the lever on one customer. */
  leverMax: number;
  /** Chance of pitching a hard sell before soft sells when both are possible. */
  hardFirst: number;
  /** Most soft-sell pitches per customer. */
  softMax: number;
  /** Keep pitching small items to land on the limit when it is known. */
  chaseExact: boolean;
  /**
   * How much a walkout hurts, against the BP a pitch might add (1 is
   * neutral, above 1 timid, below 1 reckless). Used by skilled sellers.
   */
  walkAversion: number;
}

export interface Personality {
  id: PersonalityId;
  /** Short title for menus. */
  title: string;
  /** One line on how it plays. */
  blurb: string;
  /** Proprietors and parlors in the game's voice; a town with two of a kind takes the next one. */
  names: { name: string; parlor: string; male: boolean }[];
  sales: SalesStyle;
  /** Take a risk when luck (the HUD) is at least this; 101 never, 0 always. */
  riskLuck: number;
  shopping: ShopWant[];
  /** Gold tags kept back after shopping (for arson or a rainy day). */
  goldReserve: number;
  /** Parlor visits a day it wants to make (the town allows 2). */
  visits: number;
  /** "steal", "attack", or "auto" (attack when it looks winnable, otherwise steal). */
  burglary: "steal" | "attack" | "auto";
  /** Hires the Twins when they turn up and the gold is there. */
  arson: boolean;
  /** Sends the Cursed Tiger to the leader (or a grudge). */
  tiger: boolean;
  /** Sends the Lucky Sparrow to the poorest rival, out of pity. */
  sparrow: boolean;
  /** Chance per day of an announcement, a cafe line and a letter to a grudge. */
  social: { announce: number; cafe: number; letter: number };
  /** How it plays the Expanded ruleset (absent: the Classic habits only). */
  expanded?: XStyle;
}

/** A gold-tag purchase under Expanded rules, in priority order. */
export interface XTagWant {
  item: "psych" | "hearse" | "strength" | "hp";
  /** Psych level as the stats sheet shows it, hearse index, strength or max HP. */
  upTo: number;
}

/**
 * The Expanded habits of a personality (docs/expanded-rules.md sections 6 to
 * 24). Each is a committed strategy, not a cheat sheet: it changes what the
 * bot wants and in what order, never what it can see.
 */
export interface XStyle {
  /** The karma path it steers toward (section 8). */
  path: "good" | "evil" | "neutral";
  /** Section 9.3. */
  rivalry: "peaceful" | "standard" | "cutthroat";
  /** Casket markup percent (section 6.3). */
  markup: number;
  tags: XTagWant[];
  /** Parlor upgrades in buying order (section 7.2). */
  upgrades: string[];
  /** Cash kept back from discretionary spending. */
  reserve: number;
  /** Caskets kept in stock (wood, silver, gold), refilled at Di-Mart. */
  stock: [number, number, number];
  /** Monuments: from this game day (or once the money is idle), up to this tier. */
  monuments: { from: number; upTo: number };
  /** Tithes a day (in $1,000 presses) once cash is above `reserve` x 2. */
  tithe: number;
  /** Keeps spare cash in savings overnight. */
  save: boolean;
  /** Largest loan it will take to buy the next upgrade sooner (0: never borrows). */
  borrow: number;
  /** Bingo cards a night (wood tags). */
  bingo: number;
  /** House games: stake and daily budget, or null. */
  gamble: { stake: number; budget: number; game: "draw" | "slots" | "shots" } | null;
  /** Graveyard duels: start one when it looks winnable. */
  duel: boolean;
  /** Hires the hit man on the leader now and then. */
  hits: boolean;
  /** Stands for mayor and buys this many campaign ads. */
  mayor: number;
  /** Lobbies for its ordinance choice. */
  lobby: boolean;
  chain: "found" | "join" | "none";
  /** Leads bought from the nurse a day. */
  leads: number;
  /** Buys an inspection certificate (or, at evil karma, the envelope). */
  certify: boolean;
  /** Black-market item ids it buys when on sale and affordable. */
  market: string[];
  /** Ordinance ids, most wanted first. */
  vote: string[];
  /** Holy water bottles kept (non-Associates bless with them). */
  holyWater: number;
  /** Tends graves (Trusted) or robs them (Grave Robber) with spare turns. */
  graves: boolean;
  /** Gives to a story arc's appeal on its side. */
  appeals: number;
  /** Sends a few wood tags to the poorest parlor now and then (section 21.1). */
  charity: boolean;
  /**
   * Answers a hit-man rumour (`Hud.warnings`, section 20.4) by hiring a bodyguard at the
   * Reaper Club that day, or failing that by buying Tiny or the vest on the black market.
   */
  protect?: boolean;
  /** The eight places of docs/expanded-rules.md sections 30 and 31 (balance round 19). */
  places: PlacesStyle;
}

/**
 * How a personality uses the eight newer places. Each field is a committed habit in
 * the personality's character, not a cheat: it only decides which buttons the bot
 * presses when it is already standing at the counter (`expanded/places.ts`).
 */
export interface PlacesStyle {
  /** Police Station: answer an attack with a report (clean, public) or a settlement (quick, dirty). */
  police: "report" | "settle" | "none";
  /** After repeat attacks: the sure patrol, the cheap Back Door, or nothing. */
  patrol: "patrol" | "backdoor" | "never";
  /** Crematorium: rent a bulk lot of oven time while cremation sales are common. */
  ovens: boolean;
  /** What it does with the urns after its cremations. */
  ashes: "scatter" | "press" | "none";
  /** Florist: keep fresh bouquets in the cooler for flowers lines. */
  flowers: boolean;
  /** One wreath a day: for the church (karma, word of mouth), the ward (luck), or none. */
  wreath: "church" | "ward" | "none";
  /** Town Gazette: a customer lead by advert (a luck gamble or a sure one). */
  advert: "classified" | "display" | "none";
  /** The front-page puff piece. */
  puff: boolean;
  /** Smears the leader. */
  smear: boolean;
  /** Coroner: the tip, the certificate, the favour (proper burial or quiet). */
  coroner: { tip: boolean; certificate: boolean; favour: "burial" | "quiet" | "none" };
  /** Health Department: ask for an inspection, or buy the clean bill. */
  health: "inspect" | "buy" | "none";
  /** Files a complaint against the leader (karma 30 or less). */
  complaint: boolean;
  /** Cousin Sal: pawn loot; buy second-hand caskets for the storeroom. */
  pawn: { loot: boolean; lots: boolean };
  /** Mourne & Sons: spy, take a stand in the price war, or offer a truce. */
  mournes: { spy: boolean; stand: "undercut" | "hold" | "none"; truce: boolean };
}

/** Uses none of the eight places. */
export const NO_PLACES: PlacesStyle = {
  police: "none",
  patrol: "never",
  ovens: false,
  ashes: "none",
  flowers: false,
  wreath: "none",
  advert: "none",
  puff: false,
  smear: false,
  coroner: { tip: false, certificate: false, favour: "none" },
  health: "none",
  complaint: false,
  pawn: { loot: false, lots: false },
  mournes: { spy: false, stand: "none", truce: false },
};

function pl(over: Partial<PlacesStyle>): PlacesStyle {
  return { ...NO_PLACES, ...over };
}

const STANDARD_UPGRADES = [
  "paint",
  "coffee-machine",
  "storeroom",
  "florist-cooler",
  "viewing-room",
  "embalming-lab",
  "incinerator",
  "chapel",
  "mausoleum",
];

/** An Expanded style: neutral, standard rivalry, the usual parlor, unless a field says otherwise. */
function xs(over: Partial<XStyle>): XStyle {
  return {
    path: "neutral",
    rivalry: "standard",
    markup: 0,
    tags: [
      { item: "psych", upTo: 4 },
      { item: "hearse", upTo: 2 },
      { item: "psych", upTo: 8 },
    ],
    upgrades: STANDARD_UPGRADES,
    reserve: 4000,
    stock: [3, 2, 1],
    monuments: { from: 20, upTo: 3 },
    tithe: 0,
    save: false,
    borrow: 0,
    bingo: 0,
    gamble: null,
    duel: false,
    hits: false,
    mayor: 0,
    lobby: false,
    chain: "none",
    leads: 0,
    certify: false,
    market: [],
    vote: ["speed-limit", "embalming-act", "tax-holiday"],
    holyWater: 0,
    graves: false,
    appeals: 0,
    charity: false,
    places: NO_PLACES,
    ...over,
  };
}

const P: Record<PersonalityId, Personality> = {
  mourner: {
    id: "mourner",
    title: "The Soft Touch",
    blurb:
      "Cautious soft-seller. Listens, sympathises, never lets a mourner storm out, buys locks and safes and keeps to itself.",
    names: [
      { name: "Mortimer Meek", parlor: "Gentle Repose", male: true },
      { name: "Prudence Pall", parlor: "Quiet Hours", male: false },
      { name: "Ambrose Hush", parlor: "Soft Landings", male: true },
    ],
    sales: {
      moodCeiling: 6.6,
      leverAbove: 30,
      leverMax: 3,
      hardFirst: 0.3,
      softMax: 6,
      chaseExact: true,
      walkAversion: 3,
    },
    riskLuck: 101,
    shopping: [
      { item: "psych", upTo: 6 },
      { item: "padlock" },
      { item: "safe" },
      { item: "smoke" },
      { item: "hearse", upTo: 2 },
      { item: "psych" },
    ],
    goldReserve: 0,
    visits: 0,
    burglary: "steal",
    arson: false,
    tiger: false,
    sparrow: true,
    social: { announce: 0.1, cafe: 0.3, letter: 0 },
    expanded: xs({
      places: pl({
        police: "report",
        patrol: "patrol",
        wreath: "church",
        coroner: { tip: false, certificate: true, favour: "burial" },
        health: "inspect",
        pawn: { loot: false, lots: true },
        mournes: { spy: false, stand: "hold", truce: false },
      }),
      path: "good",
      tags: [
        { item: "psych", upTo: 5 },
        { item: "hearse", upTo: 2 },
        { item: "psych", upTo: 8 },
        { item: "hearse", upTo: 3 },
      ],
      // Balance round 17 (tuning log): the alarm, the Night Watchman and the Memorial Garden
      // just before the embalming lab, not after it (they were bought on day 26).
      upgrades: [
        "paint",
        "coffee-machine",
        "guard-dog",
        "viewing-room",
        "storeroom",
        "florist-cooler",
        "alarm",
        "night-watchman",
        "memorial-garden",
        "embalming-lab",
        "incinerator",
        "chapel",
        "mausoleum",
      ],
      holyWater: 2,
      chain: "join",
      vote: ["quiet-hours", "embalming-act", "speed-limit"],
      appeals: 1,
      charity: true,
      monuments: { from: 18, upTo: 4 },
    }),
  },
  shark: {
    id: "shark",
    title: "The Shark",
    blurb:
      "Hard-sell shark. Upsells to the last dollar and past it, burns through customers, buys the flashiest hearse it can and curses the leader.",
    names: [
      { name: "Vera Vulture", parlor: "Last Gasp Caskets", male: false },
      { name: "Rex Ripley", parlor: "Bottom Dollar", male: true },
      { name: "Sly Sexton", parlor: "Pine Box Profits", male: true },
    ],
    sales: {
      moodCeiling: 9.1,
      leverAbove: 85,
      leverMax: 1,
      hardFirst: 1,
      softMax: 10,
      chaseExact: false,
      walkAversion: 0.35,
    },
    riskLuck: 55,
    shopping: [{ item: "hearse", saveFor: true }, { item: "psych" }],
    goldReserve: 0,
    visits: 1,
    burglary: "steal",
    arson: false,
    tiger: true,
    sparrow: false,
    social: { announce: 0.3, cafe: 0.2, letter: 0.2 },
    expanded: xs({
      places: pl({
        police: "settle",
        patrol: "backdoor",
        ovens: true,
        ashes: "press",
        advert: "display",
        smear: true,
        coroner: { tip: true, certificate: false, favour: "quiet" },
        complaint: true,
        pawn: { loot: true, lots: true },
        mournes: { spy: true, stand: "undercut", truce: false },
      }),
      rivalry: "cutthroat",
      markup: 20,
      tags: [
        { item: "hearse", upTo: 3 },
        { item: "psych", upTo: 4 },
        { item: "hearse", upTo: 4 },
        { item: "psych", upTo: 8 },
      ],
      leads: 2,
      hits: true,
      market: ["coroner-list", "sal-pad", "hot-casket", "testimonials"],
      vote: ["open-carry", "speed-limit", "embalming-act"],
      monuments: { from: 16, upTo: 4 },
    }),
  },
  gambler: {
    id: "gambler",
    title: "The Gambler",
    blurb:
      "Risk-taker. Grabs every risk on offer, eats Lucky Dragons to keep the odds up, and swings at rivals when it feels lucky.",
    names: [
      { name: "Lucky Lazarus", parlor: "Double or Nothing", male: true },
      { name: "Dicey Dee", parlor: "Snake Eyes Rest", male: false },
      { name: "Ace Ashby", parlor: "House Always Wins", male: true },
    ],
    sales: {
      moodCeiling: 8.2,
      leverAbove: 60,
      leverMax: 1,
      hardFirst: 0.6,
      softMax: 7,
      chaseExact: false,
      walkAversion: 0.8,
    },
    riskLuck: 0,
    shopping: [{ item: "psych", upTo: 4 }, { item: "hearse" }, { item: "strength", upTo: 6 }],
    goldReserve: 0,
    visits: 1,
    burglary: "auto",
    arson: false,
    tiger: false,
    sparrow: false,
    social: { announce: 0.2, cafe: 0.5, letter: 0.1 },
    expanded: xs({
      places: pl({
        police: "settle",
        advert: "classified",
        coroner: { tip: false, certificate: false, favour: "none" },
        health: "inspect",
        pawn: { loot: true, lots: false },
        mournes: { spy: false, stand: "undercut", truce: false },
      }),
      hits: true,
      upgrades: [
        "paint",
        "coffee-machine",
        "storeroom",
        "florist-cooler",
        "viewing-room",
        "embalming-lab",
        "billboard",
        "incinerator",
        "chapel",
        "mausoleum",
      ],
      tags: [
        { item: "psych", upTo: 6 },
        { item: "hearse", upTo: 2 },
        { item: "strength", upTo: 6 },
        { item: "psych", upTo: 8 },
        { item: "hearse", upTo: 3 },
      ],
      bingo: 3,
      gamble: { stake: 500, budget: 3000, game: "slots" },
      duel: true,
      market: ["rabbit-foot", "morty-rib", "clover", "monster-scale", "riot-shield"],
      vote: ["sin-tax", "speed-limit", "open-carry"],
    }),
  },
  saboteur: {
    id: "saboteur",
    title: "The Saboteur",
    blurb:
      "Visits rivals every day, picks locks, robs and brawls, hires the Twins and curses whoever is ahead. Sells only to fund the mischief.",
    names: [
      { name: "Grimsby Gloom", parlor: "Spite and Sons", male: true },
      { name: "Hester Hex", parlor: "Bad Blood Burials", male: false },
      { name: "Mordecai Malice", parlor: "Grudge Gardens", male: true },
    ],
    sales: {
      moodCeiling: 7.6,
      leverAbove: 50,
      leverMax: 2,
      hardFirst: 0.5,
      softMax: 6,
      chaseExact: false,
      walkAversion: 1,
    },
    riskLuck: 45,
    shopping: [
      { item: "lockpicks", upTo: 3 },
      { item: "strength", upTo: 8 },
      { item: "hp", upTo: 30 },
      { item: "psych", upTo: 3 },
      { item: "hearse" },
    ],
    goldReserve: 6,
    visits: 2,
    burglary: "auto",
    arson: true,
    tiger: true,
    sparrow: false,
    social: { announce: 0.3, cafe: 0.4, letter: 0.4 },
    expanded: xs({
      places: pl({
        police: "settle",
        patrol: "backdoor",
        ashes: "press",
        coroner: { tip: false, certificate: false, favour: "quiet" },
        pawn: { loot: true, lots: false },
        mournes: { spy: true, stand: "none", truce: false },
      }),
      path: "evil",
      rivalry: "cutthroat",
      tags: [
        { item: "strength", upTo: 8 },
        { item: "hp", upTo: 30 },
        { item: "psych", upTo: 3 },
        { item: "hearse", upTo: 2 },
        { item: "strength", upTo: 12 },
      ],
      // Balance round 17 (tuning log): the Night Watchman just before the embalming lab, not after
      // it (it was bought on day 26).
      upgrades: [
        "paint",
        "coffee-machine",
        "guard-dog",
        "alarm",
        "storeroom",
        "florist-cooler",
        "viewing-room",
        "night-watchman",
        "embalming-lab",
        "incinerator",
        "chapel",
        "mausoleum",
      ],
      duel: true,
      hits: true,
      graves: true,
      market: ["vest", "riot-shield", "coroner-list", "forged-permit", "mayor-key", "used-wreaths"],
      certify: true,
      vote: ["open-carry", "speed-limit", "sin-tax"],
      appeals: 1,
    }),
  },
  builder: {
    id: "builder",
    title: "The Builder",
    blurb:
      "Rushes upgrades. Turns every tag to gold and saves for the next hearse (more customers a day), then psychology.",
    names: [
      { name: "Constance Crypt", parlor: "Eternal Expansions", male: false },
      { name: "Barnaby Bier", parlor: "Bigger Better Graves", male: true },
      { name: "Ida Inter", parlor: "Plot Developments", male: false },
    ],
    sales: {
      moodCeiling: 7.8,
      leverAbove: 45,
      leverMax: 2,
      hardFirst: 0.8,
      softMax: 6,
      chaseExact: false,
      walkAversion: 1.2,
    },
    riskLuck: 60,
    shopping: [
      { item: "hearse", saveFor: true },
      { item: "psych", upTo: 5 },
      { item: "padlock" },
      { item: "psych" },
    ],
    goldReserve: 0,
    visits: 0,
    burglary: "steal",
    arson: false,
    tiger: false,
    sparrow: false,
    social: { announce: 0.15, cafe: 0.2, letter: 0 },
    expanded: xs({
      places: pl({
        police: "report",
        flowers: true,
        coroner: { tip: false, certificate: true, favour: "none" },
        health: "inspect",
        pawn: { loot: false, lots: true },
        mournes: { spy: false, stand: "hold", truce: false },
      }),
      protect: true,
      tags: [
        { item: "hearse", upTo: 2 },
        { item: "psych", upTo: 4 },
        { item: "hearse", upTo: 3 },
        { item: "psych", upTo: 8 },
      ],
      // Balance round 17 (tuning log): the Memorial Garden just before the embalming lab, not after
      // it (it was bought on day 26).
      upgrades: [
        "paint",
        "storeroom",
        "coffee-machine",
        "viewing-room",
        "chapel",
        "florist-cooler",
        "memorial-garden",
        "embalming-lab",
        "incinerator",
        "mausoleum",
        "billboard",
        "crematorium",
      ],
      reserve: 2500,
      stock: [4, 3, 2],
      borrow: 15000,
      certify: true,
      chain: "join",
      vote: ["tax-holiday", "speed-limit", "embalming-act"],
      monuments: { from: 24, upTo: 3 },
    }),
  },
  scholar: {
    id: "scholar",
    title: "The Scholar",
    blurb:
      "Psychology first and always. Reads every customer, chases the exact spending limit for the 200-point bonus, and stops the moment a sale is perfect.",
    names: [
      { name: "Doctor Dirge", parlor: "Analytical Interment", male: true },
      { name: "Professor Pyre", parlor: "Mind Over Mortem", male: false },
      { name: "Silas Psyche", parlor: "Thoughtful Passings", male: true },
    ],
    sales: {
      moodCeiling: 7.4,
      leverAbove: 35,
      leverMax: 3,
      hardFirst: 0.7,
      softMax: 12,
      chaseExact: true,
      walkAversion: 1.5,
    },
    riskLuck: 75,
    shopping: [{ item: "psych", saveFor: true }],
    goldReserve: 0,
    visits: 0,
    burglary: "steal",
    arson: false,
    tiger: false,
    sparrow: false,
    social: { announce: 0.1, cafe: 0.3, letter: 0 },
    expanded: xs({
      places: pl({
        police: "report",
        coroner: { tip: true, certificate: true, favour: "none" },
        health: "inspect",
        pawn: { loot: false, lots: true },
        mournes: { spy: true, stand: "hold", truce: false },
      }),
      protect: true,
      // Balance round 17 (tuning log): the Memorial Garden just before the embalming lab, not after
      // it (it was bought on day 26).
      upgrades: [
        "paint",
        "coffee-machine",
        "storeroom",
        "florist-cooler",
        "viewing-room",
        "memorial-garden",
        "embalming-lab",
        "billboard",
        "incinerator",
        "chapel",
        "mausoleum",
      ],
      tags: [
        { item: "psych", upTo: 5 },
        { item: "hearse", upTo: 2 },
        { item: "psych", upTo: 8 },
        { item: "hearse", upTo: 3 },
      ],
      market: ["filed-tag", "morty-rib"],
      vote: ["speed-limit", "embalming-act", "quiet-hours"],
    }),
  },
  saint: {
    id: "saint",
    title: "The Saint",
    blurb:
      "The church path. Honest at every embalming table, discounts for the poor, blesses every mourner, leads the service, tends the graves and tithes.",
    names: [
      { name: "Sister Solace", parlor: "Gentle Hands", male: false },
      { name: "Brother Benedict", parlor: "Saint's Rest", male: true },
      { name: "Mercy Goodbody", parlor: "Halo Funerals", male: false },
    ],
    sales: {
      moodCeiling: 6.8,
      leverAbove: 35,
      leverMax: 2,
      hardFirst: 0.3,
      softMax: 7,
      chaseExact: true,
      walkAversion: 2.5,
    },
    riskLuck: 101,
    shopping: [{ item: "psych", upTo: 6 }, { item: "hearse", upTo: 2 }, { item: "psych" }],
    goldReserve: 0,
    visits: 0,
    burglary: "steal",
    arson: false,
    tiger: false,
    sparrow: true,
    social: { announce: 0.1, cafe: 0.3, letter: 0 },
    expanded: xs({
      places: pl({
        police: "report",
        patrol: "patrol",
        ashes: "scatter",
        flowers: true,
        wreath: "church",
        coroner: { tip: false, certificate: true, favour: "burial" },
        health: "inspect",
        mournes: { spy: false, stand: "hold", truce: false },
      }),
      // Balance round 17 (tuning log): the Memorial Garden just before the embalming lab, not after
      // it (it was bought on day 26).
      upgrades: [
        "paint",
        "coffee-machine",
        "storeroom",
        "viewing-room",
        "florist-cooler",
        "memorial-garden",
        "embalming-lab",
        "billboard",
        "incinerator",
        "chapel",
        "mausoleum",
      ],
      path: "good",
      tags: [
        { item: "psych", upTo: 4 },
        { item: "hearse", upTo: 1 },
        { item: "psych", upTo: 8 },
        { item: "hearse", upTo: 2 },
      ],
      tithe: 4,
      bingo: 1,
      holyWater: 1,
      graves: true,
      appeals: 2,
      certify: true,
      market: ["tap-water"],
      vote: ["quiet-hours", "embalming-act", "speed-limit"],
      monuments: { from: 22, upTo: 3 },
      charity: true,
    }),
  },
  necromancer: {
    id: "necromancer",
    title: "The Necromancer",
    blurb:
      "The dark path to its bottom. Pockets every ring, raises the mourners, robs fresh graves, holds seances at the Reaper Club and duels with dead men's strength.",
    names: [
      { name: "Morgana Mort", parlor: "Restless Rest", male: false },
      { name: "Lazarus Black", parlor: "Second Wind", male: true },
      { name: "Hecate Hollow", parlor: "Night Shift", male: false },
    ],
    sales: {
      moodCeiling: 8.4,
      leverAbove: 45,
      leverMax: 2,
      hardFirst: 0.6,
      softMax: 7,
      chaseExact: false,
      walkAversion: 0.9,
    },
    riskLuck: 45,
    shopping: [{ item: "psych", upTo: 4 }, { item: "strength", upTo: 6 }, { item: "hearse" }],
    goldReserve: 0,
    visits: 1,
    burglary: "auto",
    arson: false,
    tiger: true,
    sparrow: false,
    social: { announce: 0.2, cafe: 0.3, letter: 0.2 },
    expanded: xs({
      places: pl({
        police: "settle",
        patrol: "backdoor",
        ashes: "press",
        advert: "classified",
        smear: true,
        coroner: { tip: false, certificate: false, favour: "quiet" },
        complaint: true,
        pawn: { loot: true, lots: true },
        mournes: { spy: true, stand: "none", truce: false },
      }),
      hits: true,
      path: "evil",
      tags: [
        { item: "psych", upTo: 4 },
        { item: "strength", upTo: 7 },
        { item: "hearse", upTo: 2 },
        { item: "psych", upTo: 8 },
      ],
      duel: true,
      graves: true,
      leads: 1,
      market: ["coroner-list", "hot-casket", "haunted-casket", "filed-tag", "real-water", "bruno"],
      vote: ["sin-tax", "open-carry", "speed-limit"],
      appeals: 1,
    }),
  },
  tycoon: {
    id: "tycoon",
    title: "The Tycoon",
    blurb:
      "Money first. Full storeroom, a healthy markup, every dollar in savings earning interest until the end of the season, then a cemetery full of monuments to itself.",
    names: [
      { name: "Monty Moneybags", parlor: "Gilded Gates", male: true },
      { name: "Goldie Graves", parlor: "Bullion Burials", male: false },
      { name: "Sterling Shroud", parlor: "Blue Chip Caskets", male: true },
    ],
    sales: {
      moodCeiling: 7.9,
      leverAbove: 45,
      leverMax: 2,
      hardFirst: 0.8,
      softMax: 7,
      chaseExact: false,
      walkAversion: 1.2,
    },
    riskLuck: 60,
    shopping: [{ item: "hearse", upTo: 2 }, { item: "psych" }],
    goldReserve: 0,
    visits: 0,
    burglary: "steal",
    arson: false,
    tiger: false,
    sparrow: false,
    social: { announce: 0.2, cafe: 0.2, letter: 0 },
    expanded: xs({
      places: pl({
        police: "report",
        patrol: "patrol",
        ovens: true,
        ashes: "scatter",
        flowers: true,
        coroner: { tip: false, certificate: true, favour: "none" },
        health: "inspect",
        pawn: { loot: false, lots: true },
        mournes: { spy: true, stand: "hold", truce: false },
      }),
      protect: true,
      markup: 10,
      tags: [
        { item: "psych", upTo: 4 },
        { item: "hearse", upTo: 2 },
        { item: "psych", upTo: 8 },
      ],
      upgrades: [
        "paint",
        "coffee-machine",
        "storeroom",
        "florist-cooler",
        "embalming-lab",
        "viewing-room",
        "incinerator",
        "chapel",
      ],
      stock: [5, 4, 3],
      reserve: 5000,
      save: true,
      borrow: 10000,
      monuments: { from: 21, upTo: 5 },
      market: ["hot-casket", "cop-day-off"],
      vote: ["tax-holiday", "embalming-act", "speed-limit"],
    }),
  },
  politician: {
    id: "politician",
    title: "The Politician",
    blurb:
      "Runs City Hall. Files for mayor on day one, buys every campaign ad, lobbies each ordinance, keeps its inspection certificate fresh and kisses babies at the church.",
    names: [
      { name: "Senator Sod", parlor: "Vote Early Burials", male: true },
      { name: "Madam Mayor", parlor: "Civic Repose", male: false },
      { name: "Alderman Ash", parlor: "Public Plots", male: true },
    ],
    sales: {
      moodCeiling: 7.4,
      leverAbove: 40,
      leverMax: 2,
      hardFirst: 0.6,
      softMax: 7,
      chaseExact: false,
      walkAversion: 1.6,
    },
    riskLuck: 70,
    shopping: [{ item: "psych", upTo: 5 }, { item: "hearse" }],
    goldReserve: 0,
    visits: 0,
    burglary: "steal",
    arson: false,
    tiger: false,
    sparrow: false,
    social: { announce: 0.6, cafe: 0.5, letter: 0 },
    expanded: xs({
      places: pl({
        police: "report",
        wreath: "church",
        puff: true,
        coroner: { tip: false, certificate: true, favour: "burial" },
        health: "inspect",
        mournes: { spy: false, stand: "hold", truce: false },
      }),
      protect: true,
      path: "good",
      mayor: 3,
      lobby: true,
      certify: true,
      holyWater: 1,
      appeals: 2,
      chain: "join",
      vote: ["tax-holiday", "speed-limit", "embalming-act"],
    }),
  },
  organiser: {
    id: "organiser",
    title: "The Organiser",
    blurb:
      "Builds a parlor chain: founds one early, invites every rival who will listen, buys caskets at the chain price and sends walkouts to its partners.",
    names: [
      { name: "Franchise Frank", parlor: "United Undertakers", male: true },
      { name: "Chaining Charlene", parlor: "Rest Inc", male: false },
      { name: "Syndicate Sid", parlor: "Coffin Co-op", male: true },
    ],
    sales: {
      moodCeiling: 7.6,
      leverAbove: 40,
      leverMax: 2,
      hardFirst: 0.7,
      softMax: 7,
      chaseExact: false,
      walkAversion: 1.3,
    },
    riskLuck: 60,
    shopping: [{ item: "psych", upTo: 4 }, { item: "hearse" }],
    goldReserve: 0,
    visits: 0,
    burglary: "steal",
    arson: false,
    tiger: false,
    sparrow: false,
    social: { announce: 0.4, cafe: 0.4, letter: 0 },
    expanded: xs({
      places: pl({
        police: "report",
        flowers: true,
        coroner: { tip: false, certificate: true, favour: "none" },
        health: "inspect",
        pawn: { loot: false, lots: true },
        mournes: { spy: false, stand: "hold", truce: false },
      }),
      protect: true,
      // Balance round 17 (tuning log): the Memorial Garden just before the embalming lab, not after
      // it (it was bought on day 26).
      upgrades: [
        "paint",
        "coffee-machine",
        "storeroom",
        "florist-cooler",
        "viewing-room",
        "memorial-garden",
        "embalming-lab",
        "billboard",
        "incinerator",
        "chapel",
        "mausoleum",
      ],
      chain: "found",
      stock: [4, 3, 2],
      vote: ["tax-holiday", "speed-limit", "quiet-hours"],
    }),
  },
  pacifist: {
    id: "pacifist",
    title: "The Pacifist",
    blurb:
      "Signs the Peace Pledge on day one and pays the insurance on every sale: nobody may visit, rob, burn, duel or hire a hit on it. Sells carefully and stays honest.",
    names: [
      { name: "Dove Whitlock", parlor: "Olive Branch Rest", male: false },
      { name: "Gandy Quill", parlor: "Peaceful Passage", male: true },
      { name: "Clement Calm", parlor: "Still Waters", male: true },
    ],
    sales: {
      moodCeiling: 7,
      leverAbove: 35,
      leverMax: 2,
      hardFirst: 0.5,
      softMax: 7,
      chaseExact: true,
      walkAversion: 2,
    },
    riskLuck: 101,
    shopping: [{ item: "psych", upTo: 6 }, { item: "hearse", upTo: 2 }, { item: "psych" }],
    goldReserve: 0,
    visits: 0,
    burglary: "steal",
    arson: false,
    tiger: false,
    sparrow: true,
    social: { announce: 0.1, cafe: 0.3, letter: 0 },
    expanded: xs({
      places: pl({
        ashes: "scatter",
        flowers: true,
        wreath: "church",
        coroner: { tip: false, certificate: true, favour: "burial" },
        health: "inspect",
        mournes: { spy: false, stand: "hold", truce: false },
      }),
      path: "good",
      rivalry: "peaceful",
      holyWater: 1,
      vote: ["quiet-hours", "speed-limit", "embalming-act"],
      appeals: 1,
    }),
  },
};

export function personality(id: PersonalityId): Personality {
  return P[id];
}

export const PERSONALITIES: readonly Personality[] = PERSONALITY_IDS.map((id) => P[id]);

/** Every personality, the Expanded-only ones included. */
export const ALL_PERSONALITIES: readonly Personality[] = ALL_PERSONALITY_IDS.map((id) => P[id]);

/** How well a bot reads customers. It never changes the rules, only judgement. */
export type Difficulty = "easy" | "normal" | "hard";

export const DIFFICULTIES: readonly Difficulty[] = ["easy", "normal", "hard"];

export interface Skill {
  /** Chance of reading the loved flag from the mood word and the psych line. */
  readMood: number;
  /** Infers loved or not from how the mood moved after Guilt or Sympathy. */
  moodDeltas: boolean;
  /** Narrows the spending limit from refusals ("over my limit") and acceptances. */
  trackLimit: boolean;
  /** Uses the psych estimate and quoted limits ("I only want to spend $N"). */
  useQuotes: boolean;
  /** Stops at this fraction of the estimated room left, rather than at the limit. */
  stopShort: number;
  /** Noise added to the personality's mood ceiling each customer. */
  ceilingNoise: number;
  /** Knows a hard sell is refused outright above 80 percent resistance. */
  knowsHardRefusal: boolean;
  /** Remembers soft-sell and upgrade prices seen in pitches. */
  learnPrices: boolean;
  /** Weighs each pitch's expected BP against the walkout risk, rather than stopping at a mood. */
  planner: boolean;
}

export const SKILLS: Record<Difficulty, Skill> = {
  easy: {
    readMood: 0.35,
    moodDeltas: false,
    trackLimit: false,
    useQuotes: true,
    stopShort: 0.55,
    ceilingNoise: 1.4,
    knowsHardRefusal: false,
    learnPrices: false,
    planner: false,
  },
  normal: {
    readMood: 0.8,
    moodDeltas: false,
    trackLimit: true,
    useQuotes: true,
    stopShort: 0.85,
    ceilingNoise: 0.6,
    knowsHardRefusal: true,
    learnPrices: true,
    planner: true,
  },
  hard: {
    readMood: 1,
    moodDeltas: true,
    trackLimit: true,
    useQuotes: true,
    stopShort: 1,
    ceilingNoise: 0.15,
    knowsHardRefusal: true,
    learnPrices: true,
    planner: true,
  },
};
