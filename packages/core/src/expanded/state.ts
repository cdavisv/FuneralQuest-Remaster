import type { PlacesAState } from "./town/placesAState.js";
import type { PlacesBState } from "./town/placesBState.js";
import type { ChallengeState, PlayerLife, TownLife } from "./town/state.js";

/**
 * Expanded state (docs/expanded-rules.md section 2). Every field is plain
 * JSON. These records hang off the Classic records as optional `expanded`
 * fields, so a Classic save never contains them and a Classic town's JSON is
 * byte-for-byte what it was before the Expanded ruleset existed.
 */

/** Opt-in PvP exposure (section 9.3). */
export type Rivalry = "peaceful" | "standard" | "cutthroat";

/** How a family left last time (section 3.8, the repeat family). */
export type FamilyMemory = "happy" | "ok" | "sour" | "walked";

export interface FamilyRecord {
  surname: string;
  memory: FamilyMemory;
  /** Game day of the last visit. */
  day: number;
  visits: number;
}

/** A payment that arrives on a later day (the pre-need planner, section 3.8). */
export interface FuturePayment {
  day: number;
  bp: number;
  money: number;
  /** Legacy markup shown on the morning screen when it pays. */
  text: string;
}

/** Counters for the stats sheet and the balance simulator. */
export interface ExpandedRecord {
  sales: number;
  walkouts: number;
  exact: number;
  great: number;
  nice: number;
  cremations: number;
  /** BP from sales including bonuses. */
  saleBp: number;
  /** BP from closeness bonuses only. */
  bonusBp: number;
  /** Money from sales. */
  saleMoney: number;
}

export interface ExpandedPlayer {
  /** Upgrade ids owned, in the order bought (section 7.2). */
  upgrades: string[];
  /** Caskets in the storeroom by tier: wood, silver, gold (section 6.2). */
  stock: [number, number, number];
  /** Casket markup in percent, one of `rules.expanded.markup.options` (section 6.3). */
  markup: number;
  rivalry: Rivalry;
  /** Game day the rivalry tier was last changed (0 = never). */
  rivalryDay: number;
  /** Word of mouth, -20 to +20 (section 7.1). */
  reviews: number;
  /** Dollars a day the premium plots sold so far pay (section 6.4). */
  plotIncome: number;
  /** Families served, newest last, at most `customer.familyMemory` entries. */
  families: FamilyRecord[];
  futures: FuturePayment[];
  /** The guided first day (section 10.4). `step` counts intro pages read. */
  tutorial: { step: number; done: boolean };
  /** Reset at the player's new day. */
  daily: {
    /** Dig for goodies uses today (Necromancy perk). */
    dug: number;
    /** Whether today's hearse upkeep was paid (the bonus turns depend on it). */
    hearsePaid: boolean;
  };
  record: ExpandedRecord;
  /** The town's places and living world (town/state.ts, section 2.5). Created on first use. */
  life?: PlayerLife;
  /** The batch-B places: coroner, health department, pawn shop, the Mournes (town/placesBState.ts). Created on first use. */
  placesB?: PlacesBState;
  /** The batch-A places: police, crematorium, florist, gazette (town/placesAState.ts). Created on first use. */
  placesA?: PlacesAState;
}

/** Which screen of the negotiation is showing (section 3.4). */
export type NegotiationPane = "main" | "hand" | "packages";

/** The Expanded part of the current customer (section 3). */
export interface ExpandedCustomer {
  first: string;
  surname: string;
  deceasedFirst: string;
  /** Trait ids. The first `visibleTraits` are shown. */
  traits: string[];
  visibleTraits: number;
  /** Special customer id, or null for an ordinary one. */
  special: string | null;
  /** What the family remembers if they have been here before. */
  repeat: FamilyMemory | null;
  /** Lines shown under "What you know": backstory, then tells as learned. Legacy markup. */
  notes: string[];
  /** Which hidden facts a tell has given away. */
  told: { loved: boolean; cheap: boolean; limit: boolean };
  /** The shown estimate of the limit; the true limit is always inside. */
  estimate: { low: number; high: number };
  patience: number;
  patienceMax: number;
  coffee: boolean;
  listens: number;
  /** Discounts given and their total in dollars. */
  discounts: number;
  discount: number;
  /** Once-per-customer perk actions used. */
  blessed: boolean;
  raised: boolean;
  /** The soft-sell hand: indexes into `content.expanded.softSell`. */
  hand: number[];
  /** Items bought and items refused (never drawn again). */
  bought: number[];
  refused: number[];
  /** "burial" or "cremation" (section 5.2). */
  track: "burial" | "cremation";
  /** Cremation was pitched (it is offered once). */
  cremationAsked: boolean;
  /** The species at a pet funeral, else "". */
  pet: string;
  /** Casket price per tier at this customer's markup. */
  casketPrices: [number, number, number];
  markup: number;
  /** Package category id to the tier index bought (-1 or absent: the free base tier). */
  packages: Record<string, number>;
  pane: NegotiationPane;
  /** Actions taken (Done excluded). */
  actions: number;
  /** True for the tutorial's practice customer. */
  practice: boolean;
}

/** Waiting to prepare the body after a sale (section 8.2). */
export interface PendingPrep {
  /** Index into `content.expanded.prep`. */
  event: number;
  /** The customer's surname and the deceased's first name, for the text. */
  surname: string;
  deceased: string;
  deceasedMale: boolean;
}

export interface ExpandedSession {
  prep: PendingPrep | null;
}

/**
 * A temporary rule change (section 12.2). The locations agent's daily news
 * and weather add these; Expanded code reads them through `modValue`.
 */
export interface RuleModifier {
  /** A key from `MODIFIER_KEYS` (expanded/modifiers.ts). */
  key: string;
  op: "add" | "mul";
  value: number;
  /** Last game day it applies (inclusive). */
  untilDay: number;
  /** Who added it, for the log and the paper (for example "news:earthquake"). */
  source: string;
}

export interface ExpandedTown {
  modifiers: RuleModifier[];
  /** The town's places and living world (town/state.ts, section 2.6). Created on first use. */
  life?: TownLife;
  /** Present only on a Daily Challenge town (section 24). */
  challenge?: ChallengeState;
}
