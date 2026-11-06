import type { PlayerState } from "../../state/types.js";

/**
 * State of the Expanded town and living world (docs/expanded-rules.md
 * section 2.5 and 2.6). Plain JSON hung off the existing Expanded records as
 * optional fields (`ExpandedPlayer.life`, `ExpandedTown.life`), created on
 * first use, so saves made before these systems existed load unchanged.
 */

/** A battle injury (section 19.1). */
export interface Injury {
  /** Injury id in `content.expanded.town.injuries`. */
  id: string;
  /** New days left before it heals by itself. */
  days: number;
}

/** A bank loan (section 21.3). */
export interface Loan {
  /** Dollars owed now, interest included. */
  owed: number;
  /** Game day it must be repaid by (collected at the midnight after). */
  due: number;
}

/** The player's part of the town (section 2.5). */
export interface PlayerLife {
  /** Monument tiers bought at the graveyard (section 16.1). */
  monuments: number;
  injuries: Injury[];
  /** Game day injuries last healed (0 = never). */
  healedDay: number;
  /** Customer leads held (section 19.2): the next Wait for Customer is a sure, richer customer. */
  leads: number;
  /** Holy water bottles (section 17.3). */
  holyWater: number;
  /** City Hall permit ids held (section 18.1). */
  permits: string[];
  /** Last game day an inspection certificate or bribe covers (0 = none). */
  certifiedUntil: number;
  savings: number;
  loan: Loan | null;
  /** Barred from loans for the rest of the season after a default. */
  deadbeat: boolean;
  /** Body armour from the black market: stops the next injury or hit. */
  armor: boolean;
  /** Game day a bodyguard covers (hits that night are foiled). */
  bodyguardDay: number;
  /**
   * Game day the player last heard a hit-man rumour (section 20.4), shown as `Hud.warnings`
   * that day. Absent in saves from before it existed (= never).
   */
  rumourDay?: number;
  /** Elected mayor this season (section 18.4). */
  mayor: boolean;
  /** Chain id, or null. */
  chain: string | null;
  /** Game day the player last left a chain (0 = never). */
  leftChainDay: number;
  /** Reset at the player's new day (section 2.5). */
  today: DailyLife;
  /** Counters for the stats sheet and the balance runs. */
  spent: Record<string, number>;
}

export interface DailyLife {
  day: number;
  tended: number;
  duels: number;
  /** Duels lost to challengers today. */
  duelsLost: number;
  confessions: number;
  served: boolean;
  tithed: number;
  bribes: number;
  /** Paid the Reaper Club's cover today. */
  cover: boolean;
  /** Dollars staked at the club today. */
  staked: number;
  /** Black-market item ids bought today. */
  bought: string[];
  seance: boolean;
  hired: boolean;
  /** Wood-tag equivalents sent and received through the bank today. */
  sent: number;
  received: number;
}

/** A graveyard duel in progress (section 16.4), kept in `sceneData`. */
export interface DuelState {
  rival: number;
  me: number;
  him: number;
  meMax: number;
  himMax: number;
  over: boolean;
}

/** Tonight's bingo (section 17.1). */
export interface BingoState {
  /** Game day of the round. */
  day: number;
  /** Owner player id per card, -1 for unsold. */
  cards: number[];
  /** Cards paid for (free cards excluded). */
  paid: number;
  /** Wood tags carried over from nights the winning card went unsold. */
  carry: number;
}

/** An open ballot (sections 18.3 and 18.4). */
export interface Ballot {
  /** Option ids: ordinance ids or candidate player ids as strings. */
  options: string[];
  /** Voter player id to option id. */
  votes: Record<string, string>;
  /** Extra votes bought, by player id to option id to count. */
  bought: Record<string, Record<string, number>>;
  /** Game day the ballot was opened and the last day votes count. */
  opened: number;
  closes: number;
}

export interface Ordinance {
  id: string;
  from: number;
  until: number;
}

export interface Election {
  /** Candidate player ids who paid the filing fee. */
  candidates: number[];
  /** Campaign ads bought, by candidate id: each counts as one vote. */
  ads: Record<string, number>;
  ballot: Ballot | null;
  mayor: number | null;
  /** Mayor's name, kept for the paper after a mayor leaves town. */
  mayorName: string;
  /** Whether this season's election was held. */
  held: boolean;
}

export interface Chain {
  id: string;
  name: string;
  /** Player id of the founder, who named it (absent in saves from before it was kept). */
  founder?: number;
  members: number[];
  /** Season score: BP from sales earned while a member. */
  score: number;
  /** Player ids invited and not yet joined. */
  invites: number[];
  /** Successful attacks on members today (section 23.3). */
  hitsToday: number;
  hitsDay: number;
}

/** A hit booked at the Reaper Club, resolved at midnight (section 20.4). */
export interface HitOrder {
  by: number;
  target: number;
  day: number;
}

/** A running story arc (section 22.3). */
export interface ArcState {
  id: string;
  /** Beat id last fired. */
  beat: string;
  /** Game day it fired. */
  beatDay: number;
  started: number;
  counters: { good: number; evil: number; walkouts: number; sales: number };
  /** Player id to what each gave to each side, in dollars. */
  given: Record<string, { good: number; evil: number }>;
}

/** The town's part (section 2.6). */
export interface TownLife {
  /** Season the state belongs to (bumped when the town resets to day 1). */
  season: number;
  bingo: BingoState;
  ordinance: Ordinance | null;
  ballot: Ballot | null;
  election: Election;
  chains: Chain[];
  /** Next chain number, for ids. */
  nextChain: number;
  hits: HitOrder[];
  /** Today's news and weather ids (section 22). */
  today: { day: number; news: string | null; weather: string | null };
  /** Black-market item ids on sale today. */
  market: string[];
  arc: ArcState | null;
  /** Arc ids already played this season, with the ending reached. */
  arcsDone: { id: string; ending: string }[];
  /** Town-wide tallies for the arcs. */
  tallies: { walkouts: number; sales: number };
}

/** The Daily Challenge marker on a challenge town (section 24). */
export interface ChallengeState {
  id: string;
  /** Waits for Customer so far: each one draws from its own stream. */
  waits: number;
  finished: boolean;
  startBp: number;
  startMoney: number;
  /** The challenger as the run began: every customer is generated against this (section 24.1). */
  base: PlayerState;
}
