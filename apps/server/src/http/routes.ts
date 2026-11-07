import { richTextToPlain } from "@fq/core";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { type Account, AuthError } from "../auth/accounts.js";
import { addressKey } from "../auth/ip.js";
import { SlidingCounter } from "../auth/throttle.js";
import { AlreadyPlayed, InvalidEntry, isChallengeDay, NotPlaying } from "../game/challenge.js";
import { hallEntryOf } from "../game/hall.js";
import { checkNames } from "../game/names.js";
import type { TownRuntime } from "../game/town.js";
import { blocklistedText } from "../moderation/service.js";
import { MUSEUM_PATH } from "../museum/path.js";
import { museumStatus } from "../museum/target.js";
import { serverVersion } from "../version.js";
import type {
  AuthResponse,
  DailyChallengeActionResponse,
  DailyChallengeEnterResponse,
  DailyChallengeInfo,
  EnterResponse,
  FeaturesResponse,
  HallOfFameResponse,
  LeaderboardDays,
  LeaderboardResponse,
  MeResponse,
  TownInfo,
  UpgradeResponse,
} from "../wire.js";
import type { AppContext } from "./context.js";
import { HttpError } from "./errors.js";
import { asHttp } from "./safety.js";
import {
  ActionBody,
  DaysQuery,
  EnterBody,
  GuestBody,
  HallQuery,
  LeaderboardQuery,
  LogInBody,
  SignUpBody,
  TownParams,
  UpgradeBody,
} from "./schemas.js";

function bearer(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  if (!header || header.length > 200) return undefined;
  const match = /^Bearer ([\w.~+/-]+=*)$/.exec(header);
  return match?.[1];
}

const AUTH_MESSAGES: Record<string, [number, string]> = {
  login_taken: [409, "That login name is taken."],
  bad_credentials: [401, "Wrong login or password."],
  banned: [403, "This account is banned."],
  ip_banned: [403, "Your address is banned."],
  signup_disabled: [403, "Sign-up is closed on this server."],
  guest_disabled: [403, "Guest accounts are not allowed on this server."],
  not_guest: [409, "This account is already a full account."],
};

function asHttpError(error: unknown): unknown {
  if (error instanceof AuthError) {
    const [status, message] = AUTH_MESSAGES[error.code] ?? [400, error.code];
    return new HttpError(status, error.code, message);
  }
  return error;
}

/** Registers health, the town directory, accounts and the game endpoints. */
export function registerRoutes(app: FastifyInstance, ctx: AppContext): void {
  const { config, accounts, host } = ctx;
  const windowMs = config.rateWindowSeconds * 1000;

  const authenticate = async (request: FastifyRequest): Promise<void> => {
    const auth = accounts.authenticate(bearer(request), request.ip);
    if (!auth) throw new HttpError(401, "unauthorized", "Log in first.");
    request.auth = auth;
  };

  const requireAuth = (request: FastifyRequest) => {
    if (!request.auth) throw new HttpError(401, "unauthorized", "Log in first.");
    return request.auth;
  };

  const townOf = (request: FastifyRequest): TownRuntime => {
    const { townId } = TownParams.parse(request.params);
    const town = host.get(townId);
    if (!town) throw new HttpError(404, "no_such_town", "No such town.");
    return town;
  };

  /** Names and parlor names meet the strict word list; the refusal says which field. */
  const checkStrictNames = (
    account: Account,
    form: { name: string; parlor: string },
    townId: string | null,
  ): void => {
    for (const [field, what, text] of [
      ["name", "name", form.name],
      ["parlor", "parlor name", form.parlor],
    ] as const) {
      try {
        host.moderation.assertTextAllowed(account, text, what, townId);
      } catch (error) {
        const http = asHttp(error);
        if (http instanceof HttpError) {
          throw new HttpError(http.status, "invalid_parlor", http.message, { field });
        }
        throw http;
      }
    }
  };

  const authLimit = { max: config.rateAuthMax, timeWindow: windowMs };
  // New accounts per address per hour, on top of the per-window budget: guests are free, and every
  // account is a row, a rate-limit budget and an audit trail an attacker can multiply.
  const signupsPerHour = config.signupsPerHour > 0 ? config.signupsPerHour : config.rateAuthMax * 3;
  const newAccounts = new SlidingCounter(ctx.clock, 3_600_000);
  const takeSignupSlot = (request: FastifyRequest): void => {
    const key = addressKey(request.ip);
    if (newAccounts.count(key) >= signupsPerHour) {
      throw new HttpError(
        429,
        "rate_limited",
        "Too many new accounts from your address this hour. Try again later.",
      );
    }
    newAccounts.hit(key);
  };
  /** Refuses new work for a town whose queue is already long: it is slow, not broken. */
  const assertTownNotSwamped = (town: TownRuntime): void => {
    if (town.pendingOperations >= config.maxQueuedPerTown) {
      throw new HttpError(503, "busy", "The town is very busy. Try again in a moment.");
    }
  };
  const actionLimit = {
    max: config.rateActionMax,
    timeWindow: windowMs,
    // A valid token is limited as its account; anything else as its address, so a flood of
    // made-up tokens cannot buy itself a fresh budget each time.
    keyGenerator: (request: FastifyRequest) => {
      const auth = accounts.authenticate(bearer(request), request.ip);
      return auth ? `account:${auth.account.id}` : `ip:${addressKey(request.ip)}`;
    },
  };

  // ------------------------------------------------------------- health

  app.get("/health", async () => {
    ctx.db.prepare("SELECT 1").get();
    return {
      status: "ok",
      ...serverVersion(),
      uptimeSeconds: Math.round((ctx.clock.now() - ctx.startedAt) / 1000),
      towns: host.towns.size,
    };
  });

  // ---------------------------------------------------- optional parts

  app.get(
    "/api/features",
    async (): Promise<FeaturesResponse> => ({
      ...serverVersion(),
      museum: {
        enabled: config.legacyClient,
        path: MUSEUM_PATH,
        ...(config.legacyClient
          ? museumStatus(host, config)
          : { available: false, reason: "Museum mode is off on this server." }),
      },
      dailyChallenge: { enabled: true },
      safety: {
        reports: true,
        blocks: true,
        accountDeletion: true,
        contactEmail: config.contactEmail === "" ? null : config.contactEmail,
        deletionPath: "/account/delete",
      },
    }),
  );

  // ---------------------------------------------------- town directory

  app.get("/api/towns", async (): Promise<{ towns: TownInfo[] }> => ({ towns: host.list() }));

  app.get("/api/towns/:townId", async (request): Promise<TownInfo> => townOf(request).info());

  // ------------------------------------------------------- hall of fame

  const hall = (townId: string | undefined, before: number | undefined, limit: number) => {
    const rows = host.hall.list({
      ...(townId !== undefined ? { townId } : {}),
      ...(before !== undefined ? { before } : {}),
      limit: limit + 1,
    });
    const page = rows.slice(0, limit);
    return {
      entries: page.map(hallEntryOf),
      next: rows.length > limit ? (page.at(-1)?.id ?? null) : null,
    } satisfies HallOfFameResponse;
  };

  app.get("/api/hall-of-fame", async (request): Promise<HallOfFameResponse> => {
    const q = HallQuery.parse(request.query);
    return hall(q.townId, q.before, q.limit);
  });

  app.get("/api/towns/:townId/hall-of-fame", async (request): Promise<HallOfFameResponse> => {
    const town = townOf(request);
    const q = HallQuery.omit({ townId: true }).parse(request.query);
    return hall(town.id, q.before, q.limit);
  });

  // ------------------------------------------------------------ accounts

  app.post("/api/auth/signup", { config: { rateLimit: authLimit } }, async (request, reply) => {
    const body = SignUpBody.parse(request.body);
    try {
      host.moderation.assertTextAllowed(null, body.login, "name", null);
    } catch (error) {
      throw asHttp(error);
    }
    takeSignupSlot(request);
    try {
      const made = await accounts.signUp(body.login, body.password, request.ip);
      ctx.host.audit.append({
        at: ctx.clock.now(),
        accountId: made.account.id,
        kind: "account:signup",
        data: { login: made.account.login },
      });
      return reply.status(201).send(authResponse(made));
    } catch (error) {
      throw asHttpError(error);
    }
  });

  app.post("/api/auth/login", { config: { rateLimit: authLimit } }, async (request) => {
    const body = LogInBody.parse(request.body);
    if (ctx.throttle.isLocked(body.login)) {
      throw new HttpError(429, "locked", "Too many failed log-ins for this name. Try again later.");
    }
    try {
      const made = await accounts.logIn(body.login, body.password, request.ip);
      ctx.throttle.recordSuccess(body.login);
      return authResponse(made);
    } catch (error) {
      if (error instanceof AuthError && error.code === "bad_credentials") {
        ctx.throttle.recordFailure(body.login);
      }
      throw asHttpError(error);
    }
  });

  app.post("/api/auth/guest", { config: { rateLimit: authLimit } }, async (request, reply) => {
    GuestBody.parse(request.body ?? {});
    takeSignupSlot(request);
    try {
      const made = await accounts.createGuest(request.ip);
      return reply.status(201).send(authResponse(made));
    } catch (error) {
      throw asHttpError(error);
    }
  });

  // A guest becomes a full account and keeps the parlor (decision 7: free text needs one).
  app.post(
    "/api/auth/upgrade",
    { onRequest: [authenticate], config: { rateLimit: authLimit } },
    async (request): Promise<UpgradeResponse> => {
      const auth = requireAuth(request);
      if (!auth.account.guest) throw asHttpError(new AuthError("not_guest"));
      if (!config.signupEnabled) throw asHttpError(new AuthError("signup_disabled"));
      const body = UpgradeBody.parse(request.body);
      try {
        host.moderation.assertTextAllowed(null, body.login, "name", null);
      } catch (error) {
        throw asHttp(error);
      }
      try {
        const upgraded = await host.upgradeGuest(auth.account, body.login, body.password);
        ctx.host.audit.append({
          at: ctx.clock.now(),
          accountId: upgraded.id,
          kind: "account:upgrade",
          data: { from: auth.account.login, to: upgraded.login },
        });
        return { account: { id: upgraded.id, login: upgraded.login, guest: false } };
      } catch (error) {
        throw asHttpError(error);
      }
    },
  );

  app.post("/api/auth/logout", { onRequest: [authenticate] }, async (request, reply) => {
    const auth = requireAuth(request);
    for (const town of host.towns.values()) {
      const parlor = host.parlorStore.find(auth.account.id, town.id);
      if (parlor) await town.leave(parlor.player_id, "quit", "logout");
    }
    accounts.logOut(auth.sessionId);
    return reply.status(204).send();
  });

  app.get("/api/me", { onRequest: [authenticate] }, async (request): Promise<MeResponse> => {
    const { account } = requireAuth(request);
    return {
      account: { id: account.id, login: account.login, guest: account.guest },
      parlors: [...host.towns.values()].flatMap((t) => t.parlorsFor(account)),
      mutes: host.moderation.muteInfo(account.id),
    };
  });

  // ---------------------------------------------------------------- game

  app.post(
    "/api/towns/:townId/enter",
    { onRequest: [authenticate], config: { rateLimit: { ...actionLimit } } },
    async (request): Promise<EnterResponse> => {
      const { account } = requireAuth(request);
      const town = townOf(request);
      const body = EnterBody.parse(request.body ?? {});
      assertTownNotSwamped(town);
      if (body.parlor) {
        // The engine strips these characters without telling the player; say so up front.
        const problem = checkNames(body.parlor);
        if (problem) {
          throw new HttpError(422, "invalid_parlor", problem.message, {
            field: problem.field,
            richMessage: problem.richMessage,
          });
        }
        checkStrictNames(account, body.parlor, town.id);
      }
      const out = await town.enter(account, body.parlor);
      switch (out.kind) {
        case "ok":
          return { view: out.view, created: out.created };
        case "parlorRequired":
          throw new HttpError(409, "parlor_required", "Choose a name and a parlor first.");
        case "invalidParlor":
          throw new HttpError(422, "invalid_parlor", richTextToPlain(out.message), {
            field: out.field,
            richMessage: out.message,
          });
        case "rejected":
          throw new HttpError(409, "rejected", out.reason);
      }
    },
  );

  app.get(
    "/api/towns/:townId/view",
    { onRequest: [authenticate], config: { rateLimit: { ...actionLimit } } },
    async (request) => {
      const { account } = requireAuth(request);
      const out = await townOf(request).currentView(account);
      if (out.kind === "notInGame") {
        throw new HttpError(409, "not_in_game", "Enter the town first.");
      }
      return { view: out.view };
    },
  );

  app.post(
    "/api/towns/:townId/action",
    { onRequest: [authenticate], config: { rateLimit: { ...actionLimit } } },
    async (request) => {
      const { account } = requireAuth(request);
      const town = townOf(request);
      const body = ActionBody.parse(request.body);
      assertTownNotSwamped(town);
      try {
        // A muted account is refused here, before the engine sees the action, by what the
        // action would publish; announcements and chain names meet the strict word list.
        host.moderation.assertMayAct(account, body.action);
        const typed = blocklistedText(body.action);
        if (typed !== null)
          host.moderation.assertTextAllowed(account, typed, "announcement", town.id);
      } catch (error) {
        throw asHttp(error);
      }
      const out = await town.act(account, body.action);
      switch (out.kind) {
        case "ok":
          return { view: out.view };
        case "notInGame":
          throw new HttpError(409, "not_in_game", "Enter the town first.");
        case "rejected":
          throw new HttpError(409, "rejected", out.reason, { view: out.view });
      }
    },
  );

  // ------------------------------------------------------ daily challenge

  const optionalAuth = async (request: FastifyRequest): Promise<void> => {
    request.auth = accounts.authenticate(bearer(request), request.ip) ?? null;
  };

  /** Maps the challenge service's errors onto the API's. */
  const daily = async <T>(work: () => Promise<T>): Promise<T> => {
    if (host.challenge.pending >= config.maxQueuedPerTown) {
      throw new HttpError(503, "busy", "The challenge is very busy. Try again in a moment.");
    }
    try {
      return await work();
    } catch (error) {
      if (error instanceof AlreadyPlayed) {
        throw new HttpError(409, "already_played", error.message, { result: error.result });
      }
      if (error instanceof NotPlaying) {
        throw new HttpError(409, "not_in_game", error.message);
      }
      if (error instanceof InvalidEntry) {
        throw new HttpError(422, "invalid_parlor", error.message, { field: error.field });
      }
      throw error;
    }
  };

  app.get(
    "/api/daily",
    { onRequest: [optionalAuth], config: { rateLimit: { ...actionLimit } } },
    async (request): Promise<DailyChallengeInfo> =>
      host.challenge.info(request.auth?.account ?? null),
  );

  app.get(
    "/api/daily/leaderboard",
    { onRequest: [optionalAuth], config: { rateLimit: { ...actionLimit } } },
    async (request): Promise<LeaderboardResponse> => {
      const q = LeaderboardQuery.parse(request.query);
      const today = host.challenge.today();
      const day = q.day ?? today;
      if (!isChallengeDay(day) || day > today) {
        throw new HttpError(400, "bad_day", "Use a date such as 2026-11-06, today or earlier.");
      }
      return host.challenge.leaderboard(day, q.limit, request.auth?.account ?? null);
    },
  );

  app.get("/api/daily/days", async (request): Promise<LeaderboardDays> => {
    const q = DaysQuery.parse(request.query);
    return { days: host.challenge.days(q.limit) };
  });

  app.post(
    "/api/daily/enter",
    { onRequest: [authenticate], config: { rateLimit: { ...actionLimit } } },
    async (request): Promise<DailyChallengeEnterResponse> => {
      const { account } = requireAuth(request);
      const body = EnterBody.parse(request.body ?? {});
      if (body.parlor) {
        const problem = checkNames(body.parlor);
        if (problem) {
          throw new HttpError(422, "invalid_parlor", problem.message, {
            field: problem.field,
            richMessage: problem.richMessage,
          });
        }
        checkStrictNames(account, body.parlor, null);
      }
      return daily(() =>
        host.challenge.enter(
          account,
          body.parlor
            ? { name: body.parlor.name, parlor: body.parlor.parlor, male: body.parlor.male }
            : undefined,
        ),
      );
    },
  );

  app.get(
    "/api/daily/view",
    { onRequest: [authenticate], config: { rateLimit: { ...actionLimit } } },
    async (request) => {
      const { account } = requireAuth(request);
      return { view: await daily(() => host.challenge.currentView(account)) };
    },
  );

  app.post(
    "/api/daily/action",
    { onRequest: [authenticate], config: { rateLimit: { ...actionLimit } } },
    async (request): Promise<DailyChallengeActionResponse> => {
      const { account } = requireAuth(request);
      const body = ActionBody.parse(request.body);
      const out = await daily(() => host.challenge.act(account, body.action));
      if (out.kind === "rejected") {
        throw new HttpError(409, "rejected", out.reason, { view: out.view });
      }
      return { view: out.view, result: out.result };
    },
  );
}

function authResponse(made: {
  account: { id: number; login: string; guest: boolean };
  token: string;
  expiresAt: number;
}): AuthResponse {
  return {
    token: made.token,
    expiresAt: new Date(made.expiresAt).toISOString(),
    account: { id: made.account.id, login: made.account.login, guest: made.account.guest },
  };
}
