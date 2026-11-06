import type { Effect, EngineContext, TownState } from "@fq/core";

/**
 * Passwords. The engine keeps none (its player record has no password field),
 * so whoever hosts the bridge supplies the log-on check, as the real server's
 * accounts do. `verify` is called with exactly what the player typed.
 */
export interface NewUserProblem {
  /** Which new-user page to send the player back to: "logon" and "password" are on page two. */
  field: "logon" | "password";
  /** Plain text shown in the client's error line. */
  message: string;
}

export interface LegacyAccounts {
  /** The player id the name and password belong to, or null when they match nobody. */
  verify(logon: string, password: string): number | null | Promise<number | null>;
  /**
   * Optional. Called before the engine creates the player, so a host that keeps real accounts can
   * refuse a log-on name or password it would not accept (and create the account) without
   * leaving a parlor that nobody owns. Return the problem to show, or null to go ahead.
   */
  checkNewUser?(
    logon: string,
    password: string,
  ): NewUserProblem | null | Promise<NewUserProblem | null>;
  /** Remember the password of a player the bridge has just created. */
  register(playerId: number, logon: string, password: string): void | Promise<void>;
}

/**
 * What the bridge needs from the server it is mounted in: the town, the
 * engine's context, a way to save a changed town, and the password check. The
 * bridge calls the engine's pure functions (`createPlayer`, `enterGame`,
 * `step`, `leaveGame`) itself, one request at a time, and hands the result
 * back through `persist`.
 */
export interface LegacyHost {
  /** Rules, content and registry for the town. `now` should be current. */
  context(): EngineContext;
  /** The town as it is now. Called once per engine call, so changes made elsewhere are seen. */
  getTown(): TownState | Promise<TownState>;
  /**
   * Save the town the engine returned and deliver its effects (logs, chat
   * lines for players on other connections, broadcasts). The bridge has
   * already queued the chat lines meant for its own players.
   */
  persist(town: TownState, effects: readonly Effect[]): void | Promise<void>;
  accounts: LegacyAccounts;
  /**
   * Optional: runs `work` with exclusive access to the town. A host that
   * also serves other clients should supply this; without it the bridge only
   * orders its own requests.
   */
  exclusive?<T>(work: () => Promise<T>): Promise<T>;
}
