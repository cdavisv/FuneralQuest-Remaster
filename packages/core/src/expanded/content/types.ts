import type { AssetId } from "@fq/protocol";
import type { SaleItem } from "../../content/types.js";
import type { PlacesAContent } from "./townPlacesA.js";
import type { PlacesBContent } from "./townPlacesB.js";
import type { ExpandedTownContent } from "./townTypes.js";

export type * from "./townTypes.js";

/**
 * Content of the Expanded ruleset: `ContentPack.expanded`
 * (docs/expanded-rules.md section 13 lists how to extend each table).
 *
 * Conventions are the Classic pack's: strings are legacy markup with
 * backtick colour codes and `{placeholder}`s, never HTML; pictures are asset
 * ids from `assets/manifest.json`; arrays of alternatives are picked with the
 * player's stream, so any length works. Numbers that are mechanics a writer
 * should be able to vary per entry (a trait's effects, an item's price) live
 * here; numbers that balance the whole ruleset live in `ExpandedRules`.
 *
 * Placeholders available in customer-facing lines, besides the Classic ones
 * (`{cHe}`, `{dRelation}`, `{dSmashed}`, ...; see content/classicText.ts):
 * `{cName}` "Doris Pickett", `{cFirst}` "Doris", `{surname}` "Pickett",
 * `{dFirst}` "Earl", `{customer}` the speaker tag "`wDoris Pickett: `$",
 * `{player}` the player's name.
 */
export interface ExpandedContent {
  names: NameLists;
  traits: TraitDef[];
  /** Backstory templates (section 3.2). Extra placeholders: `{job}`, `{hobby}`, `{place}`, `{years}`. */
  backstories: string[];
  backstoryBits: { jobs: string[]; hobbies: string[]; places: string[] };
  tells: TellText;
  specials: SpecialCustomerDef[];
  /** The Expanded soft-sell catalogue (section 4): Classic items with tags, and new ones. */
  softSell: ExpandedSaleItem[];
  /** Structured upsells (section 5). */
  packages: PackageCategory[];
  /** The cremation track (section 5.2). */
  cremation: CremationDef;
  /** Body-preparation choices after a sale (section 8.2). */
  prep: PrepEventDef[];
  /** Names and descriptions of the parlor upgrades in `ExpandedRules.upgrades`, by id. */
  upgrades: Record<string, { name: string; description: string }>;
  text: ExpandedText;
  /**
   * The town's places and living world (townTypes.ts, docs/expanded-rules.md
   * section 25). Optional: `withExpandedContent` fills in the starter set
   * when a pack has none.
   */
  town?: ExpandedTownContent;
  /**
   * Text of the batch-B places (townPlacesB.ts). Optional: the engine falls back to
   * `PLACES_B_STARTER` when a pack has none.
   */
  placesB?: PlacesBContent;
  /**
   * Text of the batch-A places (townPlacesA.ts). Optional: the engine falls back to
   * `PLACES_A_STARTER` when a pack has none.
   */
  placesA?: PlacesAContent;
}

export interface NameLists {
  male: string[];
  female: string[];
  surnames: string[];
  /** Names for pets at a pet funeral. */
  pets: string[];
}

/**
 * Mechanical effects of a trait or a special customer (section 3.3). Every
 * key is optional; absent means no change. Multipliers default to 1.
 */
export interface CustomerEffects {
  /** Added to the hidden cheapness (0 to 10) on arrival. */
  cheapness?: number;
  /** Added to the mood on arrival. */
  mood?: number;
  /** Multiplies every mood increase. */
  moodMult?: number;
  /** Added to patience. */
  patience?: number;
  /** Multiplies the spending limit (then rounded to the $50 grid). */
  limitMult?: number;
  /** Forces the hidden loved flag. */
  loved?: boolean;
  /** Multiply the main effect of Guilt, Sympathy, Coffee, Discount. 0 makes the action useless. */
  guilt?: number;
  sympathy?: number;
  coffee?: number;
  discount?: number;
  /** Facts each Listen reveals (default 1). */
  listen?: number;
  /** Added to cheapness when judging a Hard Sell (casket tier). */
  hardSell?: number;
  /** Item tag to cheapness change when judging an item or package with that tag. Negative means they like it. */
  affinity?: Record<string, number>;
  /** Multiplies the width of the limit estimate. */
  estimate?: number;
}

/**
 * Who a line or trait suits (docs/expanded-rules.md 13.5): the customer's and the deceased's
 * age in years, inclusive. Every key is optional; absent means no limit. A child customer is
 * Customers are 15 or older (Classic never sends a kid to the desk; its bands are kid under
 * 15, teen 15 to 27, adult 28 to 59, old 60+), so a minor customer is 15 to 17; the deceased
 * can be any age.
 */
export interface AgeLimits {
  minCustomerAge?: number;
  maxCustomerAge?: number;
  minDeceasedAge?: number;
  maxDeceasedAge?: number;
}

/**
 * The negotiation pools an `AgedLine` can join (fields of `ExpandedNegotiationText`; a dotted
 * key is a nested list).
 */
export type AgedPool =
  | "request"
  | "petRequest"
  | "repeat.happy"
  | "repeat.ok"
  | "repeat.sour"
  | "repeat.walked"
  | "impatient"
  | "softPitch"
  | "hardPitchWood"
  | "hardPitchSilver"
  | "guiltPitch"
  | "sympathyPitch"
  | "coffeePitch"
  | "coffeeAccept.loved"
  | "coffeeAccept.notLoved"
  | "coffeeRefuse"
  | "listenPitch"
  | "listenLoved"
  | "listenNotLoved"
  | "discountPitch"
  | "discountAccept"
  | "discountHaggle"
  | "packagePitch"
  | "packageAccept"
  | "packageRefuse";

/**
 * A negotiation line that is drawn only for some customers (13.5): it joins the pool `pool`
 * when the customer and the deceased fit its `AgeLimits`. A line that is wrong for a child
 * speaker goes here with `minCustomerAge: 15` instead of in the plain list.
 */
export interface AgedLine extends AgeLimits {
  pool: AgedPool;
  text: string;
}

export interface TraitDef extends AgeLimits {
  id: string;
  /** Shown on the customer panel, for example "Haggler". */
  label: string;
  /** What the trait does in play, honestly, for the tooltip. */
  hint: string;
  /** One is said on arrival when the trait is visible, or when Listen reveals it. */
  lines: string[];
  effects: CustomerEffects;
  /** Trait ids that never appear on the same customer. */
  excludes?: string[];
  /** Relative chance (default 1). */
  weight?: number;
}

/** Tell lines: truthful hints at hidden facts (section 3.5). */
export interface TellText {
  loved: string[];
  notLoved: string[];
  /** Cheapness below 3.5, 3.5 to 6.5, above 6.5. */
  cheapLow: string[];
  cheapMid: string[];
  cheapHigh: string[];
  /** The limit is in the upper or lower half of the current estimate. */
  limitHigh: string[];
  limitLow: string[];
}

/** A one-off reward or penalty (prep choices, special customers). */
export interface Reward {
  bp?: number;
  money?: number;
  karma?: number;
  rating?: number;
  luck?: number;
  /** Word of mouth (section 7.1). */
  reviews?: number;
  gold?: number;
  /** Police protection tonight (nobody can visit). */
  protection?: boolean;
}

/** A special customer (section 3.8). */
export interface SpecialCustomerDef {
  id: string;
  /** Shown on the panel, for example "Mob Boss". */
  label: string;
  /** Relative chance among specials. */
  weight: number;
  /** Not before this game day. */
  minDay?: number;
  /** A fixed person; otherwise a name is generated. */
  person?: { first: string; surname: string; male: boolean };
  portrait?: AssetId;
  /** Replaces the usual request on arrival. */
  intro: string;
  /** Lowest income band (0 poor to 3 super rich). */
  incomeAtLeast?: number;
  /** Trait ids forced on (shown first). */
  traits?: string[];
  effects?: CustomerEffects;
  /** Never walks out; at mood 10 the `threat` line plays and the sale ends with `onWalkout`. */
  noWalkout?: boolean;
  /** Multiplies casket prices (a pet casket). */
  casketPriceMult?: number;
  /** A pet: the deceased is `{dFirst} the {pet}`; no plot, no headstone. */
  pet?: string[];
  /** The customer is planning their own funeral. */
  selfFuneral?: boolean;
  /** The TV reports the outcome whatever the size of the sale. */
  tvAlways?: boolean;
  /** At Done when the customer leaves happy (mood below `scoring.happyBelow`). */
  onHappy?: Reward;
  /** At Done whatever the mood. */
  onDone?: Reward;
  /** When the customer walks out (or storms out, for `noWalkout`). */
  onWalkout?: Reward;
  /** Pays again on a later day (the pre-need planner). */
  future?: { minDays: number; maxDays: number; bpShare: number; text: string };
  /** A flat deal instead of a negotiation: two buttons. */
  offer?: { accept: OfferChoice; decline: OfferChoice };
  lines?: { happy?: string; walkout?: string; threat?: string; done?: string };
}

export interface OfferChoice {
  label: string;
  text: string;
  effects: Reward;
}

/** A soft-sell item with tags for trait affinities. */
export interface ExpandedSaleItem extends SaleItem {
  /** For example "flowers", "music", "food", "prestige", "religious", "sentimental", "vanity". */
  tags: string[];
  /** Only offered on this track (default both). */
  track?: "burial" | "cremation";
}

/** A package ladder (section 5.1). Tier 0 is included in every funeral and costs nothing. */
export interface PackageCategory {
  id: string;
  label: string;
  track: "burial" | "cremation" | "any";
  /** Not offered at a pet funeral. */
  noPet?: boolean;
  tiers: PackageTier[];
  /** Pitches. `{upgrade}`, `{price}`, `{last}` (the tier they have now). */
  pitch: string[];
}

export interface PackageTier {
  article: string;
  name: string;
  price: number;
  tags: string[];
  /** Upgrade id the parlor needs before it can sell this tier. */
  requires?: string;
  /** Dollars a day the plot pays from now on (plot tiers, section 6.4). */
  plotIncome?: number;
}

export interface CremationDef {
  /** Replaces the casket on the bill. */
  name: string;
  fee: number;
  tags: string[];
  pitch: string[];
  accept: string[];
  refuse: string[];
}

/** A body-preparation choice (section 8.2), the Design Doc's ring. */
export interface PrepEventDef {
  id: string;
  /** `{dFirst}`, `{surname}`, `{dHis}`, `{dHim}`, `{dHe}`. */
  text: string;
  picture?: AssetId;
  track?: "burial" | "cremation";
  /** Offered only when karma is below / above this. */
  karmaBelow?: number;
  karmaAbove?: number;
  weight?: number;
  options: PrepOption[];
}

export interface PrepOption {
  label: string;
  text: string;
  effects: Reward;
  /** A gamble decided by luck: `randomYesNo(luck, weight)`. */
  risk?: { weight: number; failText: string; failEffects: Reward };
  /** The dishonest choice: the Grave Robber perk doubles its money. */
  evil?: boolean;
  /** Only offered with this perk id. */
  perk?: string;
}

/** Every Expanded string the engine shows (section 13.3). */
export interface ExpandedText {
  /** Short reasons on disabled buttons and second lines outside the negotiation. */
  hints: {
    notEnoughCash: string;
    storeroomFull: string;
    nothingToFill: string;
    dugEnough: string;
    noTurns: string;
    current: string;
    /** `{money}` */
    needsMoney: string;
    /** `{turns}` */
    costsTurns: string;
  };
  negotiation: ExpandedNegotiationText;
  done: ExpandedDoneText;
  desk: ExpandedDeskText;
  office: ExpandedOfficeText;
  store: ExpandedStoreText;
  university: { capped: string; hpCapped: string; strengthCapped: string };
  visit: ExpandedVisitText;
  prep: { header: string; continue: string; riskFailed: string };
  stats: ExpandedStatsText;
  tutorial: TutorialText;
  /** Names and descriptions of the karma perks, by perk id (expanded/parlor.ts `PerkId`). */
  perks: Record<string, { name: string; description: string }>;
  arson: ExpandedArsonText;
}

export interface ExpandedNegotiationText {
  /** Arrival: the request. `{casket}`. */
  request: string[];
  /** Arrival of a pet funeral. `{pet}`. */
  petRequest: string[];
  /** Arrival when planning your own funeral. */
  selfRequest: string[];
  repeat: { happy: string[]; ok: string[]; sour: string[]; walked: string[] };
  /** `{low}`, `{high}` */
  estimate: string;
  resistance: string;
  /** Before a tell the psych skill found on arrival. */
  psychTell: string;
  nothingExtra: string;
  /** Status line explaining the bonus rule (section 3.7). `{nice}`, `{great}` as percentages. */
  bonusRule: string;
  /** `{price}` and the bill. */
  total: string;
  buttons: {
    coffee: string;
    listen: string;
    discount: string;
    packages: string;
    back: string;
    cremation: string;
    bless: string;
    raise: string;
  };
  hints: {
    coffeeUsed: string;
    nothingToLearn: string;
    discountMax: string;
    discountTooSmall: string;
    hardMaxed: string;
    cremationTrack: string;
    noPackages: string;
    blessUsed: string;
    raiseUsed: string;
    handEmpty: string;
    needsUpgrade: string;
  };
  /** Shown on top of the hand of soft-sell cards. */
  handIntro: string;
  packagesIntro: string;
  /** Extra pitch lines, added to the Classic ones where Classic has a pool. */
  softPitch: string[];
  hardPitchWood: string[];
  hardPitchSilver: string[];
  guiltPitch: string[];
  sympathyPitch: string[];
  coffeePitch: string[];
  coffeeAccept: { loved: string[]; notLoved: string[] };
  coffeeRefuse: string[];
  listenPitch: string[];
  /** `{trait}` */
  listenTrait: string;
  listenNothing: string[];
  /** The customer's reaction to being listened to: loved warms up, not loved gets bored. */
  listenLoved: string[];
  listenNotLoved: string[];
  discountPitch: string[];
  discountAccept: string[];
  discountHaggle: string[];
  packagePitch: string[];
  packageAccept: string[];
  packageRefuse: string[];
  packageOverLimit: string;
  impatient: string[];
  blessPitch: string;
  blessResult: { loved: string; notLoved: string };
  raisePitch: string;
  raiseResult: string;
  /** Mob boss at mood 10, when the special has no `lines.threat`. */
  threat: string;
  /**
   * Lines restricted by age (section 13.5), each joining one of the pools above when the
   * customer fits. Optional; the plain lists are always eligible.
   */
  agedLines?: AgedLine[];
}

export interface ExpandedDoneText {
  /** `{price}`, `{bp}`, `{casket}`, `{extra}` */
  success: string;
  /** `{percent}` share of base BP, `{bonus}` */
  perfect: string;
  great: string;
  nice: string;
  /** `{left}` dollars under the limit, `{nice}` percent */
  missed: string;
  /** `{bonus}` */
  underdog: string;
  /** `{tax}` */
  insurance: string;
  /** `{money}` */
  money: string;
  /** `{tier}` */
  fromStock: string;
  /** `{tier}`, `{cost}` */
  rushOrder: string;
  happy: string;
  sour: string;
  /** Sale TV line for a special customer. `{name}`, `{special}` */
  specialTv: string;
  prepButton: string;
  /** Mailed before the summary when the player left mid-sale. */
  fainted: string;
  /** `{days}` for the pre-need payment. */
  future: string;
  cremated: string;
}

export interface ExpandedDeskText {
  menuParlor: string;
  /** Grave Robber's extra customers. `{turns}` */
  accidents: string;
  /** `{turns}` */
  banked: string;
  /** `{ride}`, `{upkeep}` */
  hearsePaid: string;
  /** `{ride}`, `{upkeep}` */
  hearseUnpaid: string;
  /** `{money}`, `{plots}` */
  plotIncome: string;
  /** `{bp}`, `{money}` and the future's own text */
  futurePaid: string;
  /** Dig for goodies results. `{money}` */
  digFound: string;
  digCaught: string;
  digTag: string;
}

export interface ExpandedOfficeText {
  title: string;
  /** `{parlor}`, `{level}`, `{rating}`, `{ratingTitle}`, `{karma}`, `{karmaTitle}`, `{money}`, `{stock}`, `{markup}`, `{rivalry}`, `{perks}` */
  summary: string;
  buttons: {
    upgrades: string;
    markup: string;
    rivalry: string;
    dig: string;
    back: string;
    buy: string;
  };
  upgradesIntro: string;
  /** `{name}`, `{price}`, `{description}` */
  upgradeLine: string;
  /** `{name}` */
  bought: string;
  cantAfford: string;
  needs: string;
  owned: string;
  markupIntro: string;
  /** `{markup}` */
  markupSet: string;
  /** `{tax}`: the Peace Pledge insurance in percent (section 9.3). */
  rivalryIntro: string;
  rivalryNames: { peaceful: string; standard: string; cutthroat: string };
  /** `{tax}` as in `rivalryIntro`. */
  rivalryHints: { peaceful: string; standard: string; cutthroat: string };
  /** `{rivalry}` */
  rivalrySet: string;
  /** `{days}` */
  rivalryWait: string;
  levelNames: string[];
  noPerks: string;
}

export interface ExpandedStoreText {
  caskets: string;
  /** `{wood}`, `{silver}`, `{gold}` prices, `{have}` stock, `{room}` space left */
  casketIntro: string;
  /** `{tier}`, `{price}` */
  buyLabel: string;
  restock: string;
  /** `{tier}`, `{price}` */
  bought: string;
  /** `{count}`, `{price}` */
  restocked: string;
  full: string;
  cantAfford: string;
  shadyDiscount: string;
}

export interface ExpandedVisitText {
  /** You are peaceful. */
  selfPeaceful: string;
  /** `{name}` the rival is peaceful. */
  targetPeaceful: string;
  /** `{name}` an alarm or guard turned you away. */
  turnedAway: string;
  turnedAwayMail: string;
  /** `{money}` */
  cashStolen: string;
  cashStolenMail: string;
}

export interface ExpandedStatsText {
  labels: {
    money: string;
    karma: string;
    rating: string;
    parlor: string;
    stock: string;
    markup: string;
    rivalry: string;
    banked: string;
    plotIncome: string;
    perks: string;
    sales: string;
  };
}

export interface TutorialText {
  speaker: string;
  /** Intro pages, in order. `{name}`, `{parlor}` */
  pages: string[];
  next: string;
  skip: string;
  start: string;
  /** Hints shown on the practice customer's screens (in `note`). */
  hints: {
    arrival: string;
    hand: string;
    packages: string;
    afterPitch: string;
    impatient: string;
    done: string;
  };
  /** The desk after the practice sale. */
  finish: string;
}

export interface ExpandedArsonText {
  /** `{cost}` */
  offer: string;
  peaceful: string;
  /** `{home}`, `{name}`, `{burned}`, `{tags}`, `{stock}`, `{rating}` */
  burned: string;
  /** `{burned}`, `{tags}`, `{stock}`, `{rating}` */
  burnedMail: string;
}
