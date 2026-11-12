import {
  ApiClient,
  ApiError,
  type AuthResponse,
  type DailyChallengeInfo,
  type FeaturesResponse,
  type LeaderboardResponse,
  type MeResponse,
  type ParlorForm,
  type TownInfo,
} from "@fq/server/client";
import { createModerationApi, type ModerationApi } from "../moderation/api.js"; // moderation hook
import type { LiveTransport } from "../transport/types.js";
import { DailyTransport } from "./DailyTransport.js";
import { SessionTransport } from "./SessionTransport.js";
import { browserTokenStore, type TokenStore } from "./tokenStore.js";

export type {
  AuthResponse,
  DailyChallengeInfo,
  FeaturesResponse,
  LeaderboardResponse,
  MeResponse,
  ParlorForm,
  TownInfo,
};

/**
 * The Daily Challenge (docs/expanded-rules.md section 24, apps/server/README.md "Daily
 * Challenge"): today's seeded day, played once per account, ranked on a board.
 */
export interface DailyApi {
  /** Today's challenge and, with a token, this account's state in it. */
  info(): Promise<DailyChallengeInfo>;
  /** A day's board (default today). */
  leaderboard(day?: string): Promise<LeaderboardResponse>;
  /** The days that have a board, newest first. */
  days(): Promise<{ day: string; entries: number }[]>;
  /**
   * A transport for the run: `connect()` starts today's run or resumes it. `parlor` is the name the
   * public board shows, chosen by the player; leave it out only to resume a run in progress.
   */
  open(parlor?: ParlorForm): DailyTransport;
}

/**
 * Everything the front door needs from the server, in one interface so the screens can be
 * tested against a stub. The real implementation keeps the session token (and only that) in
 * the token store; passwords go straight to the auth endpoints and are not kept.
 */
export interface Backend {
  /** The public lobby listing: towns, their news, status and rankings. */
  towns(): Promise<TownInfo[]>;
  /** What the server offers besides the game (the museum link). Optional: a stub may omit it. */
  features?(): Promise<FeaturesResponse>;
  /** Whether a stored session token exists (it may have expired; `me` finds out). */
  hasSession(): boolean;
  me(): Promise<MeResponse>;
  logIn(login: string, password: string): Promise<AuthResponse>;
  /** `invite`: the invite code, on a server that requires one (`features().access`). */
  signUp(login: string, password: string, invite?: string): Promise<AuthResponse>;
  guest(invite?: string): Promise<AuthResponse>;
  /** Revokes the token on the server and forgets it here. Never throws. */
  logOut(): Promise<void>;
  /** Forgets the token without telling the server (it was already refused). */
  forget(): void;
  /** The Daily Challenge. Optional: a stub may omit it, and a server may not offer it (`features`). */
  daily?: DailyApi;
  /** Report, block, data export and account deletion (moderation hook). Optional: a stub may omit it. */
  moderation?: ModerationApi;
  /** A transport for one town; `connect()` on it enters the town (creating the parlor if given). */
  open(townId: string, parlor?: ParlorForm): LiveTransport;
  /** Remembered choices, not secrets. */
  lastTown(): string | null;
  setLastTown(id: string): void;
  /** The town this tab was playing when it was reloaded. */
  resumeTown(): string | null;
  setPlaying(townId: string | null): void;
}

export function createBackend(options: {
  baseUrl: string;
  store?: TokenStore;
  fetch?: typeof fetch;
}): Backend {
  const store = options.store ?? browserTokenStore();
  const api = new ApiClient({
    baseUrl: options.baseUrl,
    token: store.get(),
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  const remember = (auth: AuthResponse) => {
    store.set(auth.token);
    return auth;
  };
  return {
    towns: () => api.towns(),
    features: () => api.features(),
    hasSession: () => api.token !== null,
    me: () => api.me(),
    logIn: async (login, password) => remember(await api.logIn(login, password)),
    signUp: async (login, password, invite) => remember(await api.signUp(login, password, invite)),
    guest: async (invite) => remember(await api.guest(invite)),
    async logOut() {
      try {
        await api.logOut();
      } catch {
        // The token may already be dead or the server away; either way this device forgets it.
      }
      api.token = null;
      store.clear();
    },
    forget() {
      api.token = null;
      store.clear();
    },
    daily: {
      info: () => api.dailyChallenge(),
      leaderboard: (day) => api.dailyLeaderboard(day ? { day } : {}),
      days: () => api.dailyDays(),
      open: (parlor) => new DailyTransport(api, parlor),
    },
    moderation: createModerationApi(api), // moderation hook
    open: (townId, parlor) => new SessionTransport({ api, townId, parlor }),
    lastTown: () => store.lastTown(),
    setLastTown: (id) => store.setLastTown(id),
    resumeTown: () => store.wasPlaying(),
    setPlaying: (townId) => store.setPlaying(townId),
  };
}

/** True for the errors that mean the stored token is no good any more. */
export function isAuthExpired(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}
