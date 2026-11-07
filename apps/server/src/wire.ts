import type { Action, ChatSpeaker, RichText, View } from "@fq/protocol";

/**
 * Everything that crosses the wire between this server and a client that is
 * not the game engine: WebSocket pushes and the JSON bodies of the HTTP API.
 * The typed client in `src/client/` imports these, so both sides agree.
 */

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
 * Messages the server sends down a player's WebSocket. Game actions never
 * travel on the socket; it only carries what other players or the clock caused.
 */
export type ServerMessage =
  /** The socket is authenticated and attached to a parlor. */
  | { type: "ready"; townId: string; day: number }
  /**
   * The engine changed this player's screen without their asking (a rival's
   * attack, a forced scene change). Replace the current View with it.
   */
  | { type: "view"; view: View; at: number }
  /** Something to show alongside the current View. */
  | { type: "notice"; notice: Notice; at: number }
  | { type: "pong" };

export type Notice =
  /** A line for everyone online (log-ons, log-offs, sysop messages). */
  | { kind: "broadcast"; text: RichText }
  /** The cafe television. Sent to players sitting in the cafe. */
  | { kind: "tv"; text: RichText }
  /** A cafe chat line. */
  | {
      kind: "chat";
      text: RichText;
      /**
       * Expanded towns: who said the line, as data (the engine's own record). Absent for the
       * room's own lines and in Classic towns.
       */
      from?: ChatSpeaker;
    }
  /** Mail arrived; it is read at the desk. */
  | { kind: "mail"; count: number }
  /** Midnight passed (or a Blitz day ended). */
  | { kind: "newDay"; day: number }
  /** A message from the sysop. */
  | { kind: "server"; text: RichText }
  /** The tournament ended and the town starts over; every parlor is gone. */
  | { kind: "tournamentReset"; winner: string | null }
  /** The player's session in the town ended; the socket closes next. */
  | { kind: "sessionEnded"; reason: EndReason };

/** Messages a client may send on the socket. Anything else is ignored. */
export type ClientMessage = { type: "hello"; token: string; townId: string } | { type: "ping" };

export interface AccountInfo {
  id: number;
  login: string;
  guest: boolean;
}

export interface ParlorInfo {
  townId: string;
  playerId: number;
  name: string;
  parlor: string;
  online: boolean;
}

export interface AuthResponse {
  token: string;
  /** ISO time the token stops working. */
  expiresAt: string;
  account: AccountInfo;
}

export interface MeResponse {
  account: AccountInfo;
  parlors: ParlorInfo[];
  /** Mutes in force on this account (what it may not do, until when). Absent from older servers. */
  mutes?: MuteInfo[];
}

// ------------------------------------------------------------ player safety

/** What a mute stops: cafe lines, letters (and battle quotes), announcements, fortunes. */
export const MUTE_SCOPES = ["chat", "mail", "announcements", "fortunes"] as const;
export type MuteScope = (typeof MUTE_SCOPES)[number];

export interface MuteInfo {
  scopes: MuteScope[];
  /** ISO time the mute ends. */
  until: string;
}

export const REPORT_CATEGORIES = [
  "harassment",
  "hate",
  "sexual",
  "threats",
  "spam",
  "cheating",
  "other",
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

/**
 * What a player points at to block or report someone. The server works out who wrote it.
 * - `player`: a rankings row or a picker entry (the player id the client was shown)
 * - `name`: a display name, looked up in the town
 * - `chat`: a cafe line, as displayed (plain text); the server finds it in its short window
 * - `letter`, `announcement`, `fortune`, `quote`: text the player received or read, as displayed;
 *   `fromPlayerId` (a letter's Reply button names the sender) narrows the search
 * - `parlorName`: report a parlor's name (a player id)
 */
export type SafetyTarget =
  | { kind: "player"; playerId: number }
  | { kind: "name"; name: string }
  | {
      kind: "chat";
      text: string;
      /** The speaker's player id, when the line carried one (`ChatLine.from`): picks the line by data, not text alone. */
      fromPlayerId?: number | undefined;
    }
  | { kind: "letter"; text: string; fromPlayerId?: number | undefined }
  | { kind: "announcement"; text: string }
  | { kind: "fortune"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "parlorName"; playerId: number };

export interface BlockInfo {
  /** Opaque handle for unblocking. */
  id: number;
  /** The blocked player's name as other players see it (the name they had when blocked if they have no parlor now). */
  name: string;
  parlor: string | null;
  /** A town where they currently have a parlor, if any. */
  townId: string | null;
  /** ISO time the block was made. */
  since: string;
}

export interface BlocksResponse {
  blocks: BlockInfo[];
}

export interface BlockRequest {
  townId: string;
  target: SafetyTarget;
}

export interface BlockResponse {
  block: BlockInfo;
  /** True when this player was already blocked. */
  already: boolean;
}

export interface ReportRequest {
  townId: string;
  target: SafetyTarget;
  category: ReportCategory;
  note?: string | undefined;
  /** Also block the author in the same request. */
  alsoBlock?: boolean | undefined;
}

export interface ReportResponse {
  ok: true;
  /** True when the same thing was reported by this player recently; nothing new was stored. */
  duplicate: boolean;
  /** The author could be identified, so blocking them is offered. */
  blockOffer: { name: string } | null;
  /** True when `alsoBlock` was asked for and done. */
  blocked: boolean;
}

export interface DeleteAccountRequest {
  /** The account's password (guests have none). */
  password?: string | undefined;
  /** Must be true. */
  confirm: true;
}

export interface RankingRow {
  rank: number;
  name: string;
  parlor: string;
  bp: number;
}

export interface TownInfo {
  id: string;
  name: string;
  /** `classic` or `expanded`. */
  ruleset: string;
  /**
   * The ruleset's name for a lobby: "Classic", "Expanded". (This server always sends it; optional
   * in the type so a stub or an older server still type-checks.)
   */
  rulesetLabel?: string;
  /** One or two plain sentences for the lobby about what this ruleset is like to play. Always sent; see `rulesetLabel`. */
  description?: string;
  contentPack: string;
  day: number;
  timeZone: string;
  /** Null for a normal midnight-to-midnight town. */
  dayLengthMinutes: number | null;
  /** ISO time the next day starts. */
  nextDayAt: string;
  players: { registered: number; online: number; max: number };
  tournament: { active: boolean; daysLeft: number | null };
  /** The season being played (1 for the first), counted from the hall of fame. Null when the town has no tournament. */
  season?: number | null;
  /**
   * The engine's `lobbyStatus`: the log-on screen's game line and, when new accounts are refused
   * (town full, tournament over, day 0), the reason. `online` counts by presence.
   */
  lobby: { gameInfo: RichText; closed: RichText | null; online: number; players: number };
  serverNews: RichText;
  rankings: RankingRow[];
}

export interface ParlorForm {
  /** Name shown to other players. */
  name: string;
  /** Business name. */
  parlor: string;
  male: boolean;
  email?: string | undefined;
}

export interface EnterRequest {
  /** Needed the first time an account joins a town. */
  parlor?: ParlorForm;
}

export interface EnterResponse {
  view: View;
  created: boolean;
}

export interface ActionRequest {
  action: Action;
}

export interface ActionResponse {
  view: View;
}

export interface ErrorBody {
  error: string;
  message: string;
  /** Present on a rejected action or a refused parlor form. */
  view?: View;
  field?: string;
  richMessage?: RichText;
  /** Present on `invalid_request`: up to ten problems with the body. */
  issues?: RequestIssue[];
  /** Present on `already_played`: how the day's challenge run ended. */
  result?: DailyChallengeScore;
  /** Present on `muted`: what is refused and until when. */
  mute?: MuteInfo;
}

/** `GET /api/features`: optional parts of this server, so a client shows only what exists. */
export interface FeaturesResponse {
  /** Museum mode: the original 2001 client at `path`, playing the same town. */
  museum: {
    enabled: boolean;
    path: string;
    /** False when the flag is on but there is no Classic town to play (it only understands Classic). Always sent. */
    available?: boolean;
    /** Why museum mode cannot be played right now; null when it can. Always sent. */
    reason?: string | null;
  };
  /** The Daily Challenge (Expanded rules), served at `/api/daily`. Always sent. */
  dailyChallenge?: { enabled: boolean };
  /** Player safety: report, block, account deletion and export. Always sent. */
  safety?: {
    reports: boolean;
    blocks: boolean;
    accountDeletion: boolean;
    /** The operator's contact address, if configured. */
    contactEmail: string | null;
    /** The public page that explains how to ask for deletion without logging in. */
    deletionPath: string;
  };
}

/** One problem a refused request body had (`invalid_request`). Never carries the value sent. */
export interface RequestIssue {
  /** Dotted path into the body, such as `parlor.name`; empty for the body itself. */
  path: string;
  message: string;
}

/** One player's place in a finished season. */
export interface HallStanding {
  rank: number;
  name: string;
  parlor: string;
  bp: number;
  /** Sales made, for Expanded towns; null in Classic. */
  sales: number | null;
}

/** One parlor chain's place on a finished season's chain board (Expanded towns only). */
export interface HallChain {
  rank: number;
  name: string;
  score: number;
  members: string[];
}

/** A finished season, from `GET /api/hall-of-fame`. */
export interface HallOfFameEntry {
  id: number;
  townId: string;
  townName: string;
  ruleset: string;
  /** 1 for the first season this town finished. */
  season: number;
  /** ISO time the season ended (the midnight that reset the town). */
  endedAt: string;
  /** Length of the season in days. */
  days: number;
  /** The tournament winner, or null if nobody qualified. */
  winner: { name: string; parlor: string; bp: number } | null;
  /** Final standings, best first (up to 100). */
  standings: HallStanding[];
  /** How many parlors played in all. */
  players: number;
  /** Parlor chains by score, best first; empty in Classic. */
  chains: HallChain[];
  /** The Book of Deeds line the engine wrote for the winner. */
  deed: string | null;
}

export interface HallOfFameResponse {
  entries: HallOfFameEntry[];
  /** Pass as `before` to get the next older page; null when there are no more. */
  next: number | null;
}

/** What the Daily Challenge looks like today. */
export interface DailyChallengeInfo {
  /** The challenge day, a UTC calendar date such as "2026-11-06". */
  day: string;
  /** ISO time the next challenge begins (next UTC midnight). */
  nextAt: string;
  /** The same loadout for everyone. */
  loadout: { turns: number; money: number; stock: [number, number, number]; psych: number };
  /** Accounts (guests too) that have started today's challenge. */
  played: number;
  /** Registered accounts on today's board so far. */
  ranked: number;
  /** The caller's own state, when a token was sent. */
  you: DailyChallengeYou | null;
}

export interface DailyChallengeYou {
  /** `available` (never started today), `playing` (resume it) or `finished`. */
  status: "available" | "playing" | "finished";
  /** Set once finished (or abandoned: abandoned runs count as played). */
  result: DailyChallengeScore | null;
  /** Place on today's board; null for guests and for unfinished runs. */
  place: number | null;
  guest: boolean;
}

export interface DailyChallengeScore {
  /** BP earned in the run. The board sorts on this. */
  score: number;
  /** Money gained (first tie-break). */
  money: number;
  sales: number;
  exact: number;
  walkouts: number;
  /** True if the run ended by quitting, an idle time-out or leaving, not by using the turns up. */
  abandoned: boolean;
}

export interface DailyChallengeEnterRequest {
  /** Needed the first time; defaults to the account's login. */
  parlor?: ParlorForm;
}

export interface DailyChallengeEnterResponse {
  view: View;
  day: string;
  /** True the first time (a fresh run); false when resuming one in progress. */
  created: boolean;
}

export interface DailyChallengeActionResponse {
  view: View;
  /** Set once the run is over (the turns are used up or the player left). */
  result: DailyChallengeScore | null;
}

export interface LeaderboardRow extends Omit<DailyChallengeScore, "abandoned"> {
  place: number;
  name: string;
  parlor: string;
}

export interface LeaderboardResponse {
  day: string;
  /** Registered finished runs, best first. */
  entries: LeaderboardRow[];
  /** All of them, including those cut off by `limit`. */
  total: number;
  /** The caller's row when they are registered and on this day's board, even beyond `limit`. */
  you: LeaderboardRow | null;
}

export interface LeaderboardDays {
  days: { day: string; entries: number }[];
}
