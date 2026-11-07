import type { Effect } from "@fq/core";
import type { LegacyBridge, LegacyHost, NewUserProblem } from "@fq/legacy-compat";
import type { FastifyBaseLogger } from "fastify";
import { type AccountService, AuthError, LOGIN_PATTERN } from "../auth/accounts.js";
import type { LoginThrottle } from "../auth/throttle.js";
import type { Clock } from "../clock.js";
import type { GameHost } from "../game/host.js";
import type { TownRuntime } from "../game/town.js";
import { installMuseumSafety, noteLoggedOn } from "./safety.js";

export interface MuseumHostDeps {
  accounts: AccountService;
  throttle: LoginThrottle;
  games: GameHost;
  clock: Clock;
  log: FastifyBaseLogger;
  /** The town the original client joins. Looked up on every call, so a deleted town is noticed. */
  town: () => TownRuntime;
}

export interface MuseumHost {
  host: LegacyHost;
  /** Gives the host the bridge once the plugin has built it (cafe lines flow through it). */
  attach(bridge: LegacyBridge): void;
}

/** What the original client's New User page shows when the server cannot take the name. */
const MESSAGES = {
  logon:
    "Log-on names here are 3 to 20 letters, digits, dots, dashes or underscores, and must start with a letter or digit.",
  password: (min: number, max: number) => `Passwords here must be ${min} to ${max} characters.`,
  closed: "New accounts are closed on this server.",
  taken:
    "That log-on name belongs to an account with a different password. Use that account's password, or choose another name.",
  hasParlor: "That log-on name already has a parlor in this town. Log on with it instead.",
  locked: "Too many wrong passwords for that name. Try again later.",
  banned: "This account is banned.",
} as const;

/**
 * The legacy bridge's host, over the real server.
 *
 * - **One account, either client.** The original client's log-on name and password are the
 *   server account's `login` and password (Argon2id, the same throttle on failures). The
 *   engine's player has `logon === account.login`, and the parlor link (one per account per
 *   town) is the same table the modern client uses, so a player can log on with either client
 *   and gets the same parlor. Guests have no password and cannot use the original client.
 * - **New User** in the original client checks the name and password against the server's
 *   rules first, creates the account if it does not exist (or accepts an existing account
 *   that has no parlor here, when the password matches), then lets the engine create the
 *   player and links it to the account.
 * - **Ordering.** Every call the bridge makes runs inside the town's own queue (`runExclusive`),
 *   after any day boundary that has passed, so legacy and modern requests never interleave.
 * - **Saving** goes through the town's commit: one transaction with audit rows, then pushes to
 *   other players' sockets, presence and the engine's effects.
 */
export function createMuseumHost(deps: MuseumHostDeps): MuseumHost {
  let bridge: LegacyBridge | null = null;
  /** Players an original-client browser is (or just was) logged on as. Presence is reported for them. */
  const served = new Set<number>();
  const watched = new WeakSet<TownRuntime>();

  const watch = (town: TownRuntime) => {
    if (watched.has(town)) return;
    watched.add(town);
    // Cafe lines from modern players (and every other ordinary request) reach the original
    // client's players through the bridge's inbox.
    town.observeEffects((effects: readonly Effect[], state, visibleTo) => {
      if (!bridge) return;
      for (const effect of effects) {
        if (effect.kind !== "chat") continue;
        for (const id of effect.to) {
          // A player who blocked the sender does not get the line, whatever the engine said.
          if (served.has(id) && state.sessions[String(id)] && visibleTo(id)) {
            bridge.deliverChat(id, effect.text);
          }
        }
      }
    });
  };

  // The banner on the original client's log-on screen shows the server's uptime (funeral.cpp:191).
  const bootedAt = deps.clock.now();
  const host: LegacyHost = {
    bootTime: () => bootedAt,
    context() {
      const town = deps.town();
      watch(town);
      return town.engineContext();
    },
    async getTown() {
      const town = deps.town();
      // A block recorded since the last call is in the engine's state before the bridge acts.
      await town.ensureBlocksInQueue();
      return town.snapshotState;
    },
    async persist(next, effects) {
      const town = deps.town();
      for (const id of [...served]) if (!next.sessions[String(id)]) served.delete(id);
      await town.commitExternal(next, effects, [...served]);
    },
    exclusive(work) {
      return deps.town().runExclusive(work);
    },
    accounts: {
      async verify(logon, password) {
        if (deps.throttle.isLocked(logon)) return null;
        let account = null;
        try {
          account = await deps.accounts.verifyPassword(logon, password);
        } catch (error) {
          if (!(error instanceof AuthError)) throw error;
        }
        if (!account) {
          deps.throttle.recordFailure(logon);
          return null;
        }
        deps.throttle.recordSuccess(logon);
        const id = deps.town().parlorPlayerId(account);
        if (id !== null) {
          served.add(id);
          noteLoggedOn(id);
        }
        return id;
      },

      async checkNewUser(logon, password): Promise<NewUserProblem | null> {
        if (!LOGIN_PATTERN.test(logon)) return { field: "logon", message: MESSAGES.logon };
        // The server's own minimum (8) and the engine's maximum for the original form (20).
        const rules = deps.town().engineContext().rules.newPlayer;
        const min = Math.max(8, rules.passwordMin);
        const max = Math.min(128, rules.passwordMax);
        if (password.length < min || password.length > max) {
          return { field: "password", message: MESSAGES.password(min, max) };
        }
        if (deps.throttle.isLocked(logon)) return { field: "logon", message: MESSAGES.locked };
        const town = deps.town();
        const existing = deps.accounts.findByLogin(logon);
        if (existing) {
          let verified = null;
          try {
            verified = await deps.accounts.verifyPassword(logon, password);
          } catch (error) {
            if (error instanceof AuthError) return { field: "logon", message: MESSAGES.banned };
            throw error;
          }
          if (!verified) {
            deps.throttle.recordFailure(logon);
            return { field: "logon", message: MESSAGES.taken };
          }
          if (town.parlorPlayerId(verified) !== null) {
            return { field: "logon", message: MESSAGES.hasParlor };
          }
          return null;
        }
        try {
          const made = await deps.accounts.createWithPassword(logon, password);
          deps.games.audit.append({
            at: deps.clock.now(),
            accountId: made.id,
            kind: "account:signup",
            data: { login: made.login, via: "museum" },
          });
        } catch (error) {
          if (error instanceof AuthError) {
            return {
              field: "logon",
              message: error.code === "signup_disabled" ? MESSAGES.closed : MESSAGES.taken,
            };
          }
          throw error;
        }
        return null;
      },

      register(playerId, logon) {
        const account = deps.accounts.findByLogin(logon);
        if (!account) {
          deps.log.error({ logon }, "museum: a new parlor has no account to link to");
          return;
        }
        deps.town().linkParlor(account.id, playerId);
        served.add(playerId);
        noteLoggedOn(playerId);
      },
    },
  };

  return {
    host,
    attach(b) {
      bridge = b;
      installMuseumSafety(b, { moderation: deps.games.moderation, town: deps.town });
    },
  };
}
