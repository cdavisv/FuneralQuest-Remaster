import type { BotMemory, Difficulty, PersonalityId } from "@fq/bots";
import type { TownState } from "@fq/core";
import type { Action, RichText, View } from "@fq/protocol";

export type Unsubscribe = () => void;

/**
 * Structurally identical to `Transport` in `apps/client/src/transport/types.ts`
 * (and the server's `GameTransport`), so a Solo host or its worker proxy can
 * be passed to the client wherever a server transport goes.
 */
export interface Transport {
  connect(): Promise<View>;
  send(action: Action): Promise<View>;
  onPush(listener: (view: View) => void): Unsubscribe;
  close(): void;
}

/** Why a session ended. The same names as the server's `EndReason`. */
export type EndReason =
  | "quit"
  | "timeout"
  | "replaced"
  | "kicked"
  | "deleted"
  | "banned"
  | "townReset"
  | "reset"
  | "rollback"
  | "shutdown";

/**
 * Something to show alongside the current View. The same shape as the
 * server's `Notice` (`apps/server/src/wire.ts`), so the client handles both
 * hosts with one code path.
 */
export type Notice =
  | { kind: "broadcast"; text: RichText }
  | { kind: "tv"; text: RichText }
  | { kind: "chat"; text: RichText }
  | { kind: "mail"; count: number }
  | { kind: "newDay"; day: number }
  | { kind: "server"; text: RichText }
  | { kind: "tournamentReset"; winner: string | null }
  | { kind: "sessionEnded"; reason: EndReason };

/**
 * Rule sets a Solo town can use. "original" is Classic with every deliberate fix turned off;
 * "expanded" is the Expanded ruleset (docs/expanded-rules.md), played with `expandedPack`.
 */
export type RulesetName = "classic" | "original" | "expanded";

export interface SoloRival {
  personality: PersonalityId;
  difficulty: Difficulty;
}

/** Chosen when the game is created; stored in the save. */
export interface SoloConfig {
  /** Town seed. Same seed and choices, same game. */
  seed: number;
  /** `ContentPack.id` of the pack the town plays with. The pack itself is passed to the host. */
  contentPack: string;
  ruleset: RulesetName;
  /**
   * "career": a tournament (30 days by default) that ends with a winner. "endless": no end.
   * "daily": the Daily Challenge as offline practice (Expanded only): one seeded day for one
   * parlor, no rivals, no leaderboard; `challengeDay` names the day.
   */
  mode: "career" | "endless" | "daily";
  careerDays?: number;
  /**
   * Expanded careers: play the guided first day (the tour and a practice sale). Default true;
   * a player who has done it before passes false. Classic has no tour and ignores it.
   */
  tutorial?: boolean;
  /**
   * `mode: "daily"`: the challenge's date, "YYYY-MM-DD" (see `practiceDay`). The same date gives the
   * same customers on every machine. Practice only: the online challenge's seed also mixes in a
   * server secret, so a practice day is not the online day.
   */
  challengeDay?: string | null;
  /**
   * "manual": the day ends when the player says so (or logs off and sleeps).
   * "realtime": one game day per real day, missed days caught up when the save is opened.
   */
  clock: "manual" | "realtime";
  /** Real-time mode: the player's offset from UTC in minutes (east positive), for local midnight. */
  utcOffsetMinutes?: number;
  player: { name: string; parlor: string; male: boolean };
  rivals: SoloRival[];
}

export interface Standing {
  place: number;
  playerId: number;
  name: string;
  parlor: string;
  bp: number;
  human: boolean;
  personality?: PersonalityId;
}

/** A Daily Challenge practice run's score so far (the engine's `dailyChallengeResult`). */
export interface ChallengeStatus {
  day: string;
  /** The run is over: the turns are used up and no customer is open, or the player left. */
  finished: boolean;
  /** BP earned. */
  score: number;
  /** Money gained. */
  money: number;
  sales: number;
  exact: number;
  walkouts: number;
}

export interface SoloStatus {
  day: number;
  mode: SoloConfig["mode"];
  clock: SoloConfig["clock"];
  /** The career is over (the town is on its final, unplayable day). */
  finished: boolean;
  /** Career days left after today, or null in endless mode. */
  daysLeft: number | null;
  /** Whether "end the day" is available (manual clock, career not over). */
  canEndDay: boolean;
  standings: Standing[];
  /** Daily Challenge practice only. */
  challenge?: ChallengeStatus;
}

/** A bot's seat as saved: which player it is and what it remembers. */
export interface SavedBot {
  playerId: number;
  memory: BotMemory;
}

export const SAVE_FORMAT = "fq-solo";
export const SAVE_VERSION = 2;

/** A whole Solo game as JSON. */
export interface SoloSave {
  format: typeof SAVE_FORMAT;
  version: typeof SAVE_VERSION;
  /** ms since epoch. */
  createdAt: number;
  savedAt: number;
  config: SoloConfig;
  town: TownState;
  humanId: number;
  bots: SavedBot[];
  /** Real-time mode: the local day number the town is on (days since the epoch). */
  realDay: number | null;
}

/** One row of a save-slot list. */
export interface SaveSummary {
  slot: string;
  savedAt: number;
  day: number;
  playerName: string;
  parlor: string;
  mode: SoloConfig["mode"];
  /** Career length in days, or null for an endless game. */
  careerDays: number | null;
  rivals: number;
  contentPack: string;
  bp: number;
}

/** Host-owned button ids: the engine never sees them. */
export const END_DAY = "solo:end-day";
export const RESUME = "solo:resume";
