import type { RichText } from "./richText.js";

/**
 * Screen templates. These are the original client's object templates
 * (`st_object` values and top-level frames in welcome.swf) under plain names.
 */
export type SceneKind =
  | "lobby" // login and new-user screens
  | "news" // the Funeral Times
  | "desk" // m_main: the player's own parlor, with the main menu
  | "location" // i_generic: any place in town, and the negotiation screen
  | "map" // i_map
  | "cafe" // i_bar / i_chat
  | "stats" // stats and inventory sheet
  | "rankings";

/** An art asset id from `assets/manifest.json`, for example "places/bank". */
export type AssetId = string;

export interface Picture {
  /** Foreground layer (`st_url`). */
  fg?: AssetId;
  /** Background layer (`st_url_bg`). */
  bg?: AssetId;
}

export interface Hud {
  turns: number;
  bpToday: number;
  bpTotal: number;
  /** 1 to 100. */
  luck: number;
  tags: { wood: number; silver: number; gold: number };
  /** Expanded only: the parlor's cash in dollars. */
  money?: number;
  /** Expanded only: 1 (evil) to 100 (angelic); 50 is neutral. */
  karma?: number;
  /** Expanded only: parlor rating 0 to 100. */
  rating?: number;
  /** Expanded only (docs/expanded-rules.md 21.2): dollars in savings at the bank. */
  savings?: number;
  /**
   * Expanded only (21.3): dollars owed on a bank loan, the day it is due, and the days left
   * until then (0 = due today; collected at the midnight after).
   */
  debt?: { owed: number; due: number; daysLeft?: number };
  /** Expanded only (19.1): injuries not yet healed. */
  injuries?: number;
  /** Expanded only (19.1): the injuries themselves, oldest first, when there are any. */
  injuryList?: InjuryRow[];
  /** Expanded only (8.3): the karma band the player is in, with its bounds. */
  karmaPath?: KarmaBand;
  /** Expanded only (19.2): customer leads held. */
  leads?: number;
}

/**
 * Expanded: the state of the town today (docs/expanded-rules.md section 26),
 * on the desk and the town map. Draw it as a strip: weather icon and label,
 * the headline that changes the rules, the ordinance in force, the mayor,
 * the running story, and a badge for each ballot the player has not voted on.
 */
export interface TownPanel {
  day: number;
  weather?: { id: string; label: string; effect: string };
  news?: { id: string; title: string; effect: string };
  /** `daysLeft`: days it stays in force after today (0 = its last day is today). */
  ordinance?: { id: string; title: string; effect: string; until: number; daysLeft?: number };
  mayor?: string;
  /** Headline of the running story arc. */
  story?: string;
  /** `daysLeft`: voting days left after today (0 = closes tonight). */
  ballots?: {
    kind: "ordinance" | "election";
    closes: number;
    voted: boolean;
    daysLeft?: number;
  }[];
}

/**
 * Expanded: one band of the karma axis (docs/expanded-rules.md 8.3), `min` to `max`
 * inclusive. "neutral" has no perk. Draw the axis from `View.karmaScale` and the player's
 * band from `Hud.karmaPath`; the engine alone grants perks.
 */
export interface KarmaBand {
  id: "necromancer" | "grave-robber" | "neutral" | "trusted" | "church-associate";
  name: string;
  min: number;
  max: number;
}

/** Expanded: an unhealed injury (docs/expanded-rules.md 19.1). */
export interface InjuryRow {
  id: string;
  name: string;
  /** The injury's line of flavour text ("" when none). */
  text: string;
  /** Midnights until it heals by itself (1 = gone tomorrow). */
  daysLeft: number;
  /** Hit points taken off the start of every fight. */
  hp: number;
  /** Patience taken off every customer. */
  patience: number;
  /** Turns taken off each morning. */
  turns: number;
  /** What the hospital charges to treat it today, in dollars. */
  treatPrice: number;
}

/** Expanded: what a choice gives or costs (a `Reward`), signed. Absent keys are 0. */
export interface RewardFacts {
  bp?: number;
  money?: number;
  karma?: number;
  luck?: number;
  /** Word of mouth. */
  reviews?: number;
  rating?: number;
  gold?: number;
  protection?: boolean;
}

/** Expanded: one parlor upgrade at the office (docs/expanded-rules.md 7.2). */
export interface UpgradeRow {
  id: string;
  name: string;
  description: string;
  /** Today's price in dollars (ordinances may change it). */
  price: number;
  /** Rating it adds while owned. */
  rating: number;
  /** Counts toward the building level. */
  building: boolean;
  /**
   * "owned"; "available" (can buy now); "unaffordable" (only the money is missing);
   * "locked" (needs another upgrade or a City Hall permit first: see `requires` and `reason`).
   */
  state: "owned" | "available" | "unaffordable" | "locked";
  /** Why it cannot be bought now, in the engine's words. */
  reason?: string;
  /** What it needs first, and whether the player has it. */
  requires?: { kind: "upgrade" | "permit"; id: string; name: string; have: boolean }[];
  /** The buy card's id on the upgrades screen (absent when owned). */
  buttonId?: string;
}

/** Expanded: the parlor office (docs/expanded-rules.md 6, 7, 9.3), on every office screen. */
export interface OfficePanel {
  /** Building level 0 to 4 and its name ("Shack" ... "Colonial Mansion"). */
  level: number;
  levelName: string;
  /** Every level's name, index = level. */
  levelNames: string[];
  stock: { wood: number; silver: number; gold: number; capacity: number };
  /** Casket markup percent, and the choices. */
  markup: number;
  markupOptions: number[];
  rivalry: "peaceful" | "standard" | "cutthroat";
  rivalryName: string;
  /** Days before the rivalry tier can change again (0 = now). */
  rivalryWait: number;
  /** Security level 0 to 3 (9.2). */
  security: number;
  /** Every upgrade, owned ones included, in the contractor's order. */
  upgrades: UpgradeRow[];
}

/** Expanded: tonight's Bingo Night (docs/expanded-rules.md 17.1), on the bingo screen. */
export interface BingoPanel {
  /** False when bingo is cancelled today. */
  open: boolean;
  /** Wood tags the winning card takes tonight, carry included. */
  pot: number;
  carry: number;
  /** Wood tags a card costs. */
  price: number;
  /** Cards in the round (12) and cards sold. */
  cards: number;
  sold: number;
  /** Card numbers (1-based) sold to anyone, the player's included. */
  taken: number[];
  /** Card numbers the player holds. */
  mine: number[];
  maxPerPlayer: number;
  /** The next card is the Church Associate's free one. */
  nextFree: boolean;
  /** Drawn at the midnight after this game day; `daysLeft` 0 = tonight. */
  drawDay: number;
  daysLeft: number;
}

/** Expanded: one option on a ballot. */
export interface BallotOption {
  id: string;
  title: string;
  /** The ordinance's text, or "" for a candidate. */
  text: string;
  /** The rule change in one line, or "" for a candidate. */
  effect: string;
  /** Votes so far (absent if the rules ever hide them). */
  votes?: number;
  /** The player's own vote. */
  mine: boolean;
  /** The card to press to vote for it. */
  buttonId: string;
}

/** Expanded: City Hall's ballots (docs/expanded-rules.md 18.3, 18.4), on every City Hall screen. */
export interface BallotPanel {
  /** The ordinance in force. */
  inForce?: { id: string; title: string; effect: string; until: number; daysLeft: number };
  /** The open ordinance ballot. */
  ordinance?: {
    closes: number;
    daysLeft: number;
    options: BallotOption[];
    /** Option id the player voted for, or null. */
    myVote: string | null;
    /** What the player's vote counts (the mayor's is 2). */
    myWeight: number;
    lobby: { price: number; max: number; bought: number };
  };
  election: {
    /** "filing" (days 1 to `filingUntil`), "voting" (to `votingUntil`), or "done". */
    phase: "filing" | "voting" | "done";
    /** Season days, and the season day today. */
    filingUntil: number;
    votingUntil: number;
    seasonDay: number;
    /** Days left in the current phase after today (0 = it ends tonight; 0 when done). */
    daysLeft: number;
    fee: number;
    ads: { price: number; max: number; mine: number };
    /** The player has filed. */
    filed: boolean;
    candidates: {
      playerId: number;
      name: string;
      ads: number;
      /** Votes so far, while voting. */
      votes?: number;
      /** The player voted for this candidate. */
      mine: boolean;
      /** The candidate is the player. */
      me: boolean;
      buttonId?: string;
    }[];
    /** The mayor's name (elected, or the town's NPC). */
    mayor: string;
  };
}

/** Expanded: the bank (docs/expanded-rules.md 21), on every Expanded bank screen. */
export interface BankPanel {
  savings: number;
  /** Interest per day, as a share (0.002 = 0.2%). */
  savingsRate: number;
  /** Dollars of savings that earn interest, and tonight's interest at today's balance. */
  savingsCap: number;
  interestTonight: number;
  /** Deposits are refused while a loan is out. */
  canDeposit: boolean;
  loan: {
    /** Most the bank lends this player. */
    limit: number;
    /** Daily interest and the fee charged when lent, as shares. */
    rate: number;
    fee: number;
    /** Days a new loan runs, and the day it would be due if taken today. */
    termDays: number;
    dueIfTaken: number;
    canBorrow: boolean;
    /** Why not, in the engine's words. */
    reason?: string;
    /** The loan out now. */
    owed?: number;
    due?: number;
    daysLeft?: number;
  };
  transfers: {
    /** Wood-tag equivalents sent and received today, and the daily limit of each. */
    sent: number;
    received: number;
    dailyMax: number;
    /** Share of the tags the teller keeps (rounded up). */
    feeShare: number;
    /** Wood-tag value of one tag: wood, silver, gold. */
    values: [number, number, number];
    canSend: boolean;
    reason?: string;
  };
}

/** Expanded: the Reaper Club (docs/expanded-rules.md 20), on every club screen. */
export interface ClubPanel {
  /** Wood tags at the door today, and whether the player is inside. */
  cover: number;
  inside: boolean;
  /** Dollars staked today, the daily limit, and the stakes on offer. */
  staked: number;
  stakeMax: number;
  stakes: number[];
  /** The round just played, on the screen right after it. */
  lastRound?: {
    game: "draw" | "slots" | "shots";
    stake: number;
    /** "win": more back than staked; "push": some or all back; "lose": nothing back. */
    outcome: "win" | "push" | "lose";
    /** Dollars handed back (stake included). */
    payout: number;
    /** payout - stake. */
    net: number;
  };
}

/** Expanded: one body-preparation choice (docs/expanded-rules.md 8.2). */
export interface PrepChoice {
  buttonId: string;
  /** What it gives (money already doubled for a Grave Robber's dishonest choice). */
  effects: RewardFacts;
  /** The dishonest choice. */
  evil: boolean;
  /** A gamble: the percent chance it works today, and what a failure gives instead. */
  risk?: { chance: number; fail: RewardFacts };
}

/** Expanded: the body-preparation screen. */
export interface PrepPanel {
  choices: PrepChoice[];
}

/** Expanded: the guided first day (docs/expanded-rules.md 10.4). */
export interface TutorialPanel {
  /** Tour page, 1-based, and the page count (absent on the practice sale). */
  page?: number;
  pages?: number;
  /** The clerk's hint for this screen, without the speaker tag. */
  hint?: RichText;
  /** Who speaks, plain ("Clerk"). */
  speaker: string;
}

/** Expanded: one row of a score board (parlor chains, the Daily Challenge). */
export interface BoardRow {
  place: number;
  name: string;
  /** Members, or a short line under the name. */
  detail: string;
  score: number;
  /** The viewer's own row. */
  mine?: boolean;
}

/** Expanded: a customer trait the player can see (docs/expanded-rules.md section 3.2). */
export interface CustomerTrait {
  id: string;
  label: string;
  /** One-line hint of what the trait does, for a tooltip. */
  hint: string;
}

/** Expanded: one line of the running bill. */
export interface BillLine {
  label: string;
  /** Dollars; negative for a discount. */
  price: number;
}

export interface CustomerPanel {
  /** "Poor", "Average", "Rich", "Super Rich". */
  incomeLabel: string;
  moodLabel: string;
  /** The 0 to 10 mood behind the label, rounded to one decimal (10 or more walks out). */
  moodLevel: number;
  /** Running total of the sale in dollars. */
  total: number;
  /** Shown only when the player's psych skill revealed it. */
  resistancePercent?: number;
  /** Expanded: the customer's full name, for example "Doris Pickett". */
  name?: string;
  /** Expanded: who died, for example "her husband Earl". */
  deceased?: string;
  /** Expanded: visible traits, in the order learned. */
  traits?: CustomerTrait[];
  /** Expanded: the player's estimate of the spending limit. The true limit is inside it. */
  estimate?: { low: number; high: number };
  /** Expanded: actions left before the customer gets impatient. */
  patience?: { left: number; max: number };
  /** Expanded: a special customer's label, for example "Mob Boss". */
  special?: string;
  /** Expanded: what has been learned about the customer so far (backstory and tells). */
  notes?: RichText[];
  /** Expanded: the bill, line by line. */
  bill?: BillLine[];
  /** Expanded: "burial" or "cremation". */
  track?: string;
  /**
   * Expanded: false for a flat offer that is not a haggle (the County Contract, Cousin
   * Sal): draw no estimate gauge. Absent means a normal negotiation.
   */
  haggle?: boolean;
  /**
   * Expanded: the closeness bonuses (3.7), nearest first. A bill at or under the limit and
   * within `within` of it (as a share of the limit) earns the band; "exact" is within 0.
   */
  bands?: { key: "exact" | "great" | "nice"; within: number }[];
}

export interface BattlePanel {
  me: { name: string; hp: number; hpMax: number };
  them: { name: string; hp: number; hpMax: number };
}

export interface Button {
  /** Opaque id; the client sends it back unchanged in a `press` action. */
  id: string;
  label: string;
  /** False when shown but unavailable; `hint` says why. */
  enabled?: boolean;
  hint?: string;
  /**
   * Expanded: the player's current choice among cards (the markup in use, the rivalry tier,
   * the ballot option or candidate voted for). Draw it as chosen; it is usually disabled,
   * since choosing it again does nothing.
   */
  selected?: boolean;
  /**
   * Expanded: how to lay the button out. Absent is the main row (at most five,
   * as in Classic). "more" is a secondary row of smaller buttons under the main
   * row. "hand" is a card to pick (a soft-sell item, a package tier): draw these
   * as a row of cards above the main row, with `detail` under the label.
   */
  group?: "more" | "hand";
  /** Expanded: a second line for the button or card, such as a price. */
  detail?: string;
}

/** A modal on top of the scene. */
export type Overlay =
  /** Dismissed with a `dismiss` action carrying this id. */
  | { kind: "message"; id: string; text: RichText; picture?: Picture }
  | {
      kind: "textInput";
      id: string;
      prompt: string;
      maxLength: number;
      multiline?: boolean;
      /** Text the field starts with (a quoted letter when replying). */
      initial?: string;
    }
  | { kind: "playerPicker"; id: string; prompt: string; players: { id: number; name: string }[] }
  | { kind: "confirm"; id: string; text: RichText };

export interface MapPlace {
  id: string;
  label: string;
}

export interface NewsPanel {
  day: number;
  section: "front" | "crime";
  isYesterday: boolean;
  body: RichText;
  topToday: RichText;
  topYesterday: RichText;
}

/**
 * A cafe line. A view's `chat` holds only the lines this action produced for
 * the viewer; lines from other players arrive as `chat` effects the host
 * delivers. Clients append both to the transcript.
 */
export interface ChatLine {
  text: RichText;
}

/** One row of the stats sheet (`stats.c` / `AddUpdateStats`). */
export interface StatLine {
  /** Stable key, for example "bpTotal" or "rating". */
  id: string;
  label: string;
  value: string;
}

/**
 * One row of a rankings list (`add_rankings`, legacy/source/rankings.cpp:43-168),
 * in rank order. Also used for the rival parlors' Look list.
 */
export interface RankingRow {
  /** 1-based place among every slot, deleted ones included, as the original ranked. */
  place: number;
  playerId: number;
  name: string;
  parlor: string;
  male: boolean;
  /** Total Bury Points. */
  bp: number;
  /** The rating line from ratings.txt for this place. */
  title: string;
  /** Where the player is: "on now", "in cafe", "logon", "Protected" or "" (offline). */
  status: string;
  online: boolean;
}

/** Everything the client needs to draw one screen. The server is the only author. */
export interface View {
  scene: SceneKind;
  /** Place name, for the window title and screen readers. */
  title: string;
  /** Main text panel (`st_main`). */
  text: RichText;
  /** Text on the parchment note (`st_generic_info`). */
  note?: RichText;
  /** One-line status under the text (`st_generic_status`). */
  status?: RichText;
  picture?: Picture;
  hud?: Hud;
  customer?: CustomerPanel;
  battle?: BattlePanel;
  /** Up to five in Classic; the client lays out however many it gets. */
  buttons: Button[];
  overlay?: Overlay;
  map?: MapPlace[];
  news?: NewsPanel;
  chat?: ChatLine[];
  /** Expanded: today's town (weather, news, ordinance, mayor, story), on the desk and the map. */
  town?: TownPanel;
  /** Expanded: a score board (chains at City Hall). */
  board?: BoardRow[];
  /** Expanded: the karma axis's bands, on the office, prep and stats screens. */
  karmaScale?: KarmaBand[];
  /** Expanded screens' facts as data (docs/expanded-rules.md 11.5). `text` still says it all. */
  office?: OfficePanel;
  bingo?: BingoPanel;
  ballots?: BallotPanel;
  bank?: BankPanel;
  club?: ClubPanel;
  prep?: PrepPanel;
  tutorial?: TutorialPanel;
  /** The stats sheet, on the "stats" scene. */
  stats?: StatLine[];
  /** Ranked players, on the "rankings" scene. `text` carries the same list as the original's fixed-width lines. */
  rankings?: RankingRow[];
  /** Looping music or ambience cue, and one-shot sounds, by audio id. */
  music?: string;
  sounds?: string[];
}

/** What a client can send. Every action is checked against the last View. */
export type Action =
  | { type: "press"; buttonId: string }
  /** `text` is null when the player cancelled the prompt. */
  | { type: "submitText"; overlayId: string; text: string | null }
  | { type: "pickPlayer"; overlayId: string; playerId: number | null }
  | { type: "confirm"; overlayId: string; accepted: boolean }
  | { type: "visit"; placeId: string }
  | { type: "chat"; text: string }
  /** Closes a message overlay. */
  | { type: "dismiss"; overlayId: string }
  /** Log off (the round Exit button). Always allowed while logged on. */
  | { type: "exit" };
