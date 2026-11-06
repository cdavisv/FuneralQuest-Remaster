import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { AuthError } from "../auth/accounts.js";
import { addressKey } from "../auth/ip.js";
import { deleteAccount, exportAccount } from "../moderation/account.js";
import { SafetyError } from "../moderation/service.js";
import {
  type BlockResponse,
  type BlocksResponse,
  REPORT_CATEGORIES,
  type ReportResponse,
} from "../wire.js";
import type { AppContext } from "./context.js";
import { HttpError } from "./errors.js";
import { safeText } from "./schemas.js";

const playerId = z.number().int().min(0).max(1_000_000);

export const SafetyTargetSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("player"), playerId }),
  z.strictObject({ kind: z.literal("name"), name: safeText(1, 64) }),
  z.strictObject({
    kind: z.literal("chat"),
    text: safeText(1, 1000),
    fromPlayerId: playerId.optional(),
  }),
  z.strictObject({
    kind: z.literal("letter"),
    text: safeText(1, 4000),
    fromPlayerId: playerId.optional(),
  }),
  z.strictObject({ kind: z.literal("announcement"), text: safeText(1, 4000) }),
  z.strictObject({ kind: z.literal("fortune"), text: safeText(1, 4000) }),
  z.strictObject({ kind: z.literal("quote"), text: safeText(1, 4000) }),
  z.strictObject({ kind: z.literal("parlorName"), playerId }),
]);

const TownId = z.string().min(1).max(64);

const BlockBody = z.strictObject({ townId: TownId, target: SafetyTargetSchema });

const ReportBody = z.strictObject({
  townId: TownId,
  target: SafetyTargetSchema,
  category: z.enum(REPORT_CATEGORIES),
  note: safeText(0, 500).optional(),
  alsoBlock: z.boolean().optional(),
});

const DeleteBody = z.strictObject({
  password: z.string().min(1).max(128).optional(),
  confirm: z.literal(true),
});

function bearer(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  if (!header || header.length > 200) return undefined;
  return /^Bearer ([\w.~+/-]+=*)$/.exec(header)?.[1];
}

/** Maps the safety service's refusals onto HTTP errors. */
export function asHttp(error: unknown): unknown {
  if (error instanceof SafetyError) {
    return new HttpError(error.status, error.code, error.message, error.extra);
  }
  return error;
}

/**
 * Player safety over HTTP: block and unblock, report, data export and account deletion.
 * Nothing here ever tells a player who reported them.
 */
export function registerSafetyRoutes(app: FastifyInstance, ctx: AppContext): void {
  const { config, accounts, host } = ctx;
  const windowMs = config.rateWindowSeconds * 1000;
  const moderation = host.moderation;

  const authenticate = async (request: FastifyRequest): Promise<void> => {
    const auth = accounts.authenticate(bearer(request), request.ip);
    if (!auth) throw new HttpError(401, "unauthorized", "Log in first.");
    request.auth = auth;
  };
  const account = (request: FastifyRequest) => {
    if (!request.auth) throw new HttpError(401, "unauthorized", "Log in first.");
    return request.auth.account;
  };
  const actionLimit = {
    max: config.rateActionMax,
    timeWindow: windowMs,
    keyGenerator: (request: FastifyRequest) => {
      const auth = accounts.authenticate(bearer(request), request.ip);
      return auth ? `account:${auth.account.id}` : `ip:${addressKey(request.ip)}`;
    },
  };
  const authLimit = { max: config.rateAuthMax, timeWindow: windowMs };
  const safe = async <T>(work: () => Promise<T> | T): Promise<T> => {
    try {
      return await work();
    } catch (error) {
      throw asHttp(error);
    }
  };

  app.get(
    "/api/blocks",
    { onRequest: [authenticate], config: { rateLimit: { ...actionLimit } } },
    async (request): Promise<BlocksResponse> => ({
      blocks: moderation.listBlocks(account(request)),
    }),
  );

  app.post(
    "/api/blocks",
    { onRequest: [authenticate], config: { rateLimit: { ...actionLimit } } },
    async (request, reply): Promise<BlockResponse> => {
      const body = BlockBody.parse(request.body);
      const { info, already } = await safe(() => moderation.block(account(request), body));
      reply.status(already ? 200 : 201);
      return { block: info, already };
    },
  );

  app.delete(
    "/api/blocks/:blockId",
    { onRequest: [authenticate], config: { rateLimit: { ...actionLimit } } },
    async (request, reply) => {
      const { blockId } = z
        .object({ blockId: z.coerce.number().int().min(1) })
        .parse(request.params);
      if (!moderation.removeBlock(account(request), blockId)) {
        throw new HttpError(404, "no_such_block", "No such block.");
      }
      await moderation.applyEverywhere();
      return reply.status(204).send();
    },
  );

  app.post(
    "/api/reports",
    { onRequest: [authenticate], config: { rateLimit: { ...actionLimit } } },
    async (request): Promise<ReportResponse> => {
      const body = ReportBody.parse(request.body);
      return safe(() => moderation.report(account(request), body));
    },
  );

  app.get(
    "/api/me/export",
    { onRequest: [authenticate], config: { rateLimit: { ...authLimit } } },
    async (request, reply) => {
      const data = exportAccount(
        { db: ctx.db, clock: ctx.clock, host, accounts },
        account(request),
      );
      reply.header("content-disposition", 'attachment; filename="funeral-quest-data.json"');
      return data;
    },
  );

  app.post(
    "/api/me/delete",
    { onRequest: [authenticate], config: { rateLimit: { ...authLimit } } },
    async (request, reply) => {
      const me = account(request);
      const body = DeleteBody.parse(request.body);
      if (!me.guest) {
        if (body.password === undefined) {
          throw new HttpError(
            400,
            "password_required",
            "Enter your password to delete the account.",
          );
        }
        if (ctx.throttle.isLocked(me.login)) {
          throw new HttpError(429, "locked", "Too many wrong passwords. Try again later.");
        }
        let verified = null;
        try {
          verified = await accounts.verifyPassword(me.login, body.password);
        } catch (error) {
          if (!(error instanceof AuthError)) throw error;
        }
        if (!verified) {
          ctx.throttle.recordFailure(me.login);
          throw new HttpError(401, "bad_credentials", "Wrong password.");
        }
        ctx.throttle.recordSuccess(me.login);
      }
      const summary = await deleteAccount(
        { db: ctx.db, clock: ctx.clock, host, accounts },
        me,
        "self",
        "requested by the account holder",
      );
      ctx.log.info({ parlors: summary.parlors.length }, "account deleted by its owner");
      return reply.status(204).send();
    },
  );
}
