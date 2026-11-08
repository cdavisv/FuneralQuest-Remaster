import type { AssetId } from "@fq/protocol";
import type { NewsCondition } from "../../content/newsCondition.js";
import type { Reward } from "./types.js";

/**
 * Content of the Expanded town and living world: `ExpandedContent.town`
 * (docs/expanded-rules.md section 25). Optional on the pack: when a pack's
 * Expanded section has no `town`, `withExpandedContent` fills in the starter
 * (`content/townStarter.ts`), so packs written before these places existed
 * still load. Conventions are those of `types.ts`: legacy markup, asset ids,
 * any number of alternatives in a list.
 */
export interface ExpandedTownContent {
  injuries: InjuryDef[];
  news: NewsEventDef[];
  weather: WeatherDef[];
  ordinances: OrdinanceDef[];
  market: MarketItemDef[];
  arcs: StoryArcDef[];
  /** Names of the graveyard monument tiers, cheapest first (one per `rules.town.graveyard.monuments`). */
  monuments: string[];
  /** Names of City Hall permits by permit id (`rules.town.cityHall.permits`). */
  permits: Record<string, { name: string; description: string }>;
  /** The town's own people, used in text as `{mayor}` and so on. */
  cast: { mayor: string; clubOwner: string; nurse: string; inspector: string; teller: string };
  pictures: TownPictures;
  text: TownText;
}

/**
 * Pictures of the town's places: asset ids from `assets/manifest.json` or
 * `assets/remastered/manifest.json` (section 25.4). The optional keys fall back
 * to the place's main key when a pack leaves them out.
 */
export interface TownPictures {
  graveyard: { fg?: AssetId; bg: AssetId };
  church: { fg?: AssetId; bg: AssetId };
  bingo: { fg?: AssetId; bg: AssetId };
  /** City Hall inside: the mayor's office (ordinance vote, election, permits). */
  cityHall: { fg?: AssetId; bg: AssetId };
  /** Optional: City Hall from the street, on arrival and at the chain registry (default `cityHall`). */
  cityHallOutside?: { fg?: AssetId; bg: AssetId };
  /** Optional: the health inspection desk (default `cityHall`). */
  inspection?: { fg?: AssetId; bg: AssetId };
  /** The sick room. With `hospitalDesk` set, also the Expanded sick room after a lost fight. */
  hospital: { fg?: AssetId; bg: AssetId };
  /** Optional: the hospital's front desk, the nurse (default `hospital`). */
  hospitalDesk?: { fg?: AssetId; bg: AssetId };
  /** The Reaper Club's room, once inside. */
  club: { fg?: AssetId; bg: AssetId };
  /** Optional: the club's door, before the cover is paid (default `club`). */
  clubDoor?: { fg?: AssetId; bg: AssetId };
  /** Optional: the back tables (default `club`). */
  clubTables?: { fg?: AssetId; bg: AssetId };
  /** Optional: the black market (default `club`). */
  blackMarket?: { fg?: AssetId; bg: AssetId };
  bank: { fg?: AssetId; bg: AssetId };
  /** Optional: the vault, for savings and loans (default `bank`). */
  vault?: { fg?: AssetId; bg: AssetId };
  duel: { fg?: AssetId; bg: AssetId };
}

/** A rule change: a modifier key from `MODIFIER_KEYS` or `TOWN_MODIFIER_KEYS` (section 12.2, 22.1). */
export interface ModifierDef {
  key: string;
  op: "add" | "mul";
  value: number;
}

/** What can cause an injury (section 19.1). */
export type InjuryCause = "duel" | "fight" | "rob" | "roulette" | "hit";

/** A battle injury (section 19.1). */
export interface InjuryDef {
  id: string;
  name: string;
  /** Mailed or shown when it happens. */
  text: string;
  /** New days until it heals by itself. */
  days: number;
  /** Hit points it takes off the start of every fight. */
  hp: number;
  /** Patience taken off every customer (you keep groaning). */
  patience?: number;
  /** Turns taken off each new day. */
  turns?: number;
  /** Dollars the hospital charges to fix it today. */
  treatPrice: number;
  /**
   * What can cause it: "duel" (losing a graveyard duel), "fight" (dropping in a
   * parlor fight), "rob" (a failed grave robbery), "roulette" (a lost glass of
   * Formaldehyde Roulette), "hit" (a landed hit). When no injury in the pack
   * names a cause, that cause draws from every injury.
   */
  causes?: InjuryCause[];
}

/** A front-page story that changes the rules for the day (section 22.1). */
export interface NewsEventDef {
  id: string;
  title: string;
  message: string;
  /** One line saying what it does to play, shown on the desk ("More customers today"). */
  effect: string;
  weight?: number;
  minDay?: number;
  /** Days it lasts, today included (default 1). */
  days?: number;
  modifiers: ModifierDef[];
  /** Runs only when this holds: how story arcs ended, whether there is a mayor (22.5). */
  when?: NewsCondition;
}

/** The day's weather (section 22.2). */
export interface WeatherDef {
  id: string;
  label: string;
  /** Morning-screen lines; one is picked. */
  morning: string[];
  effect: string;
  weight?: number;
  modifiers: ModifierDef[];
}

/** A City Hall ordinance candidate (section 18.3). */
export interface OrdinanceDef {
  id: string;
  title: string;
  /** The Mayor's pitch on the ballot. */
  text: string;
  effect: string;
  modifiers: ModifierDef[];
}

/** Something the Reaper Club's black market sells (section 20.3). */
export interface MarketItemDef {
  id: string;
  name: string;
  text: string;
  /** Dollars. */
  price: number;
  /** Rewards applied on purchase. */
  reward: Reward;
  /** A special effect beyond the reward. */
  grant?: "armor" | "lead" | "gold-casket" | "bodyguard" | "permit" | "holy-water";
  /** How often it is stocked relative to the others (default 1). */
  weight?: number;
}

/** A multi-day story (section 22.3). */
export interface StoryArcDef {
  id: string;
  title: string;
  /** It may start on these days (inclusive); it is forced on `latest` if it has not started. */
  earliest: number;
  latest: number;
  weight?: number;
  /** Id of the first beat. */
  start: string;
  beats: ArcBeatDef[];
}

export interface ArcBeatDef {
  id: string;
  /** Front-page headline and story. Placeholders: `{mayor}`, `{top}` (top contributor), `{side}`. */
  headline: string;
  story: string;
  /** Rule changes from the day the beat fires, for `days` days. */
  modifiers?: ModifierDef[];
  days?: number;
  /** Rewards when the beat fires, to "all" active players, a side's contributors, the mayor, or the top contributor. */
  rewards?: { to: "all" | "good" | "evil" | "mayor" | "top"; reward: Reward }[];
  /** While this beat is the latest, players can give money to a side at a place. */
  appeals?: ArcAppeal[];
  /** Days until the next beat fires (default 3). */
  after?: number;
  /** The next beat: fixed, or chosen by a test on what the town did. Absent ends the arc. */
  next?: string | ArcBranch;
  /** Set on a last beat: the ending's id, for the record and the tests. */
  ending?: string;
}

/** A button at a place that gives money to one side of the story. */
export interface ArcAppeal {
  place: "church" | "reaper-club" | "city-hall";
  side: "good" | "evil";
  label: string;
  /** Shown after giving. `{money}` */
  thanks: string;
  /** Dollars per press. */
  amount: number;
  /** Karma per press. */
  karma?: number;
}

/** A branch on a town-wide outcome since the arc started (section 22.3). */
export interface ArcBranch {
  test: ArcTest;
  /** Beat id when the test holds. */
  ifTrue: string;
  /** Beat id when it does not. */
  ifFalse: string;
}

export type ArcTest =
  /** The side gave strictly more money than the other. */
  | { kind: "sideLeads"; side: "good" | "evil" }
  /** Customers walked out at least `perPlayer` times per active player. */
  | { kind: "walkouts"; perPlayer: number }
  /** At least `perPlayer` sales per active player. */
  | { kind: "sales"; perPlayer: number }
  /** The town has an elected mayor. */
  | { kind: "hasMayor" }
  /** The mayor's karma is at least this. */
  | { kind: "mayorKarma"; atLeast: number };

/** Every string of the new places (section 25). */
export interface TownText {
  hints: {
    noTurns: string;
    notEnoughCash: string;
    notEnoughTags: string;
    doneToday: string;
    karmaTooHigh: string;
    karmaTooLow: string;
    noRivals: string;
    soldOut: string;
    /** `{limit}` */
    limitReached: string;
    /** `{turns}` */
    costsTurns: string;
    needsPermit: string;
    closedToday: string;
    alreadyHave: string;
    notNow: string;
    /** Optional: the hint on the ballot card or candidate the player voted for (default `alreadyHave`). */
    yourVote?: string;
  };
  graveyard: GraveyardText;
  church: ChurchText;
  cityHall: CityHallText;
  chains: ChainText;
  hospital: HospitalText;
  club: ClubText;
  bank: BankText;
  world: WorldText;
  challenge: ChallengeText;
}

export interface GraveyardText {
  title: string;
  note: string;
  /** `{plots}`, `{monument}`, `{duels}` */
  intro: string;
  noMonument: string;
  buttons: {
    monuments: string;
    tend: string;
    rob: string;
    duel: string;
    look: string;
    leave: string;
    back: string;
    swing: string;
    shove: string;
    yield: string;
    continue: string;
  };
  /** `{current}` */
  monumentsIntro: string;
  /** `{name}`, `{price}`, `{bp}` */
  monumentLine: string;
  /** `{name}`, `{bp}` */
  monumentBought: string;
  allBuilt: string;
  /** `{luck}` */
  tended: string[];
  tendedLead: string;
  tendedAssociate: string;
  /** `{money}` */
  robFound: string[];
  robSilver: string;
  /** `{fine}` */
  robCaught: string;
  look: string[];
  /** `{list}` the biggest plot rows in town */
  lookRows: string;
  duel: {
    prompt: string;
    /** `{name}` */
    youFirst: string;
    theyFirst: string;
    /** `{name}`, `{damage}` */
    youHit: string;
    youMiss: string;
    theyHit: string;
    theyMiss: string;
    shoveIn: string;
    shoveFail: string;
    theyShove: string;
    theyShoveFail: string;
    /** `{chance}` shown on the Shove button */
    shoveDetail: string;
    /** `{name}`, `{bp}` */
    won: string;
    lost: string;
    yielded: string;
    wonMail: string;
    lostMail: string;
    yieldMail: string;
    /** `{winner}`, `{loser}` */
    crime: string;
    selfPeaceful: string;
    targetPeaceful: string;
    chainMate: string;
    rivalTired: string;
    sheltered: string;
    self: string;
    nobody: string;
  };
}

export interface ChurchText {
  title: string;
  note: string;
  /** `{player}` */
  greeting: string[];
  buttons: {
    bingo: string;
    confess: string;
    holyWater: string;
    service: string;
    tithe: string;
    leave: string;
    back: string;
    buyOne: string;
    buyThree: string;
  };
  /** `{pot}`, `{carry}`, `{sold}`, `{cards}`, `{mine}`, `{wood}`, `{max}` */
  bingoIntro: string;
  /** `{count}`, `{numbers}` */
  bingoBought: string;
  bingoFree: string;
  /** `{pot}`, `{card}` */
  bingoWinMail: string;
  /** `{name}`, `{pot}`, `{card}` */
  bingoNews: string;
  /** `{card}`, `{pot}` */
  bingoCarryNews: string;
  /** `{price}` */
  confessed: string[];
  confessCapped: string;
  /** `{have}` */
  holyWaterBought: string;
  /** `{bp}`, `{reviews}` */
  served: string;
  /** `{money}`, `{bp}` */
  tithed: string[];
}

export interface CityHallText {
  title: string;
  note: string;
  /** `{mayor}`, `{player}` */
  greeting: string;
  buttons: {
    permits: string;
    inspection: string;
    ordinance: string;
    election: string;
    chains: string;
    leave: string;
    back: string;
    certify: string;
    bribe: string;
    lobby: string;
    file: string;
    ads: string;
  };
  permitsIntro: string;
  /** `{name}`, `{price}`, `{description}` */
  permitLine: string;
  /** `{name}` */
  permitBought: string;
  /** `{until}` day */
  inspectionIntro: string;
  certifiedUntil: string;
  /** `{days}` */
  certified: string;
  bribed: string;
  inspectPassMail: string;
  /** `{fine}` */
  inspectFailMail: string;
  /** `{parlor}`, `{name}` */
  inspectFailNews: string;
  /** `{current}`, `{closes}` */
  ordinanceIntro: string;
  noOrdinance: string;
  /** `{title}`, `{effect}`, `{until}` */
  currentOrdinance: string;
  noBallot: string;
  /** `{title}` */
  voted: string;
  lobbied: string;
  /** `{title}`, `{text}`, `{effect}`, `{votes}` */
  ordinanceNews: string;
  noVotesNews: string;
  /** `{fee}`, `{until}`, `{candidates}`, and the mayor's perks `{rating}` and `{turns}` (section 18.4). */
  electionFiling: string;
  /** `{until}`, `{candidates}` */
  electionVoting: string;
  /** `{name}` */
  electionDone: string;
  noCandidates: string;
  filed: string;
  /** `{name}` */
  electionVoted: string;
  adsBought: string;
  /** `{name}`, `{votes}` */
  electedNews: string;
  electedMail: string;
  noElectionNews: string;
  /** `{turns}` */
  mayorMorning: string;
  /** `{votes}` shown on a ballot button */
  votesDetail: string;
  /** `{votes}` shown on a ballot button when the count is exactly one */
  votesDetailOne: string;
}

export interface ChainText {
  title: string;
  /** `{fee}`, `{join}`, `{dues}`, `{max}` */
  intro: string;
  /** `{name}`, `{members}`, `{score}` */
  line: string;
  none: string;
  /** `{name}` */
  yours: string;
  buttons: { found: string; invite: string; join: string; leave: string; back: string };
  namePrompt: string;
  invitePrompt: string;
  /** `{name}` */
  founded: string;
  invited: string;
  /** `{chain}`, `{name}` */
  inviteMail: string;
  joined: string;
  /** `{name}` */
  joinedMail: string;
  left: string;
  full: string;
  /** `{days}` */
  cooldown: string;
  badName: string;
  /** `{dues}` */
  duesUnpaid: string;
  /** `{name}` the chain-mate */
  noFriendlyFire: string;
  /**
   * The name a chain gets when a moderator takes its founder's text down
   * (`removePlayerText`, docs/expanded-rules.md 29). `{n}` the chain's number. Optional: the
   * engine uses the chain's id when a pack has none.
   */
  removedName?: string;
}

export interface HospitalText {
  title: string;
  note: string;
  /** `{player}`, `{nurse}` */
  greeting: string;
  /** `{name}`, `{days}`, `{price}` */
  injuryLine: string;
  noInjuries: string;
  buttons: { treat: string; lead: string; leave: string };
  /** `{name}` */
  treated: string;
  /** `{price}`, `{karma}` */
  leadIntro: string;
  leadBought: string[];
  leadMax: string;
  /** `{list}` */
  stillHurt: string;
  /** `{turns}` */
  hurtTurns: string;
  /** `{name}` */
  newInjury: string;
  armorSaved: string;
  /** Shown when a lead brings the customer in. */
  leadArrives: string;
}

export interface ClubText {
  title: string;
  note: string;
  /** `{cover}`, `{owner}` */
  door: string;
  necroFree: string;
  inside: string[];
  buttons: {
    pay: string;
    games: string;
    market: string;
    hit: string;
    bodyguard: string;
    seance: string;
    draw: string;
    slots: string;
    shots: string;
    leave: string;
    back: string;
  };
  /** `{staked}`, `{max}` */
  gamesIntro: string;
  /** `{stake}` */
  stakeLabel: string;
  /** `{you}`, `{dealer}`, `{won}` */
  drawWin: string;
  drawLose: string;
  drawTie: string;
  cards: string[];
  /** `{reels}` */
  slotsSpin: string;
  /** `{won}` */
  slotsWin: string;
  slotsLose: string;
  symbols: Record<string, string>;
  shotsIntro: string;
  /** `{won}` */
  shotsWin: string;
  shotsLose: string;
  marketIntro: string;
  /** `{name}`, `{price}`, `{text}` */
  marketLine: string;
  marketBought: string;
  /** `{price}` the base price */
  hitPrompt: string;
  /** `{name}` */
  hitBooked: string;
  hitSelf: string;
  hitPeaceful: string;
  hitTaken: string;
  hitChain: string;
  /** `{name}` */
  hitNews: string;
  /** `{bp}` */
  hitMail: string;
  hitFoiledMail: string;
  /** `{name}` */
  hitFoiledHirer: string;
  hitSnitchMail: string;
  /** `{name}` the hirer, `{target}` */
  hitSnitchNews: string;
  hitRumour: string;
  bodyguardBought: string;
  seanceWin: string;
  seanceFail: string;
}

export interface BankText {
  buttons: {
    savings: string;
    deposit: string;
    withdraw: string;
    loan: string;
    borrow: string;
    repay: string;
    transfer: string;
    back: string;
    wood: string;
    silver: string;
    gold: string;
  };
  /** `{savings}`, `{rate}`, `{cash}`, `{cap}` */
  savingsIntro: string;
  depositPrompt: string;
  withdrawPrompt: string;
  /** `{money}` */
  deposited: string;
  withdrew: string;
  badAmount: string;
  noDepositWithLoan: string;
  /** `{limit}`, `{rate}`, `{days}`, `{fee}` (percent added when the money is lent) */
  loanIntro: string;
  /** `{owed}`, `{due}` */
  loanOwed: string;
  borrowPrompt: string;
  /** `{money}`, `{due}` */
  borrowed: string;
  /** `{money}` */
  repaid: string;
  loanClosed: string;
  deadbeat: string;
  /** `{money}` */
  loanCollected: string;
  /** `{left}`, `{bp}` */
  loanDefault: string;
  /** `{sent}`, `{max}`, `{fee}` */
  transferIntro: string;
  transferPick: string;
  /** `{name}` */
  transferTier: string;
  transferCount: string;
  /** `{count}`, `{tier}`, `{name}`, `{fee}` */
  transferred: string;
  /** `{count}`, `{tier}`, `{name}` */
  transferMail: string;
  transferTooNew: string;
  /** `{left}` */
  transferLimit: string;
  transferTheirLimit: string;
  transferSelf: string;
  transferNotEnough: string;
}

export interface WorldText {
  /** `{label}`, `{line}`, `{effect}` */
  morningWeather: string;
  /** `{title}`, `{effect}` */
  morningNews: string;
  /** `{weather}`, `{news}` */
  deskStatus: string;
  quietNews: string;
  /** `{title}` arc headline on the morning screen */
  morningArc: string;
}

export interface ChallengeText {
  title: string;
  /** `{id}`, `{turns}` */
  intro: string;
  /** `{score}`, `{sales}`, `{money}` */
  finished: string;
  leave: string;
}
