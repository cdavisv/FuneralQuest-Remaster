import { createHash, timingSafeEqual } from "node:crypto";
import { CLASSIC_SETTINGS, CUSTOM_SIZE, type PlayerState, parseLegacyText } from "@fq/core";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Account } from "../auth/accounts.js";
import { UnknownContentPack } from "../content/index.js";
import { TownConfigError, TownExists } from "../game/host.js";
import { RULESETS, rulesetNames } from "../game/rulesets.js";
import { isValidTimeZone } from "../game/schedule.js";
import { GameSettingsPatch } from "../game/settings.js";
import { checkTownSetup } from "../game/setup.js";
import type { TownRuntime } from "../game/town.js";
import { TOWN_ID, TownConfigSchema } from "../game/townConfig.js";
import { currentValues, tunableRules } from "../game/tuning.js";
import { deleteAccount, historyIn } from "../moderation/account.js";
import { registerModerationAdmin } from "./adminModeration.js";
import type { AppContext } from "./context.js";
import { HttpError } from "./errors.js";
import { asHttp } from "./safety.js";
import { queryBool, safeText } from "./schemas.js";

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Characters that would be read as markup in a player's name (`strip_dangerous_stuff`). */
function isSafeName(text: string): boolean {
  for (const ch of text) {
    if ("?|=/;:,{}@+`<>%$".includes(ch)) return false;
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 123 && code <= 127) return false;
  }
  return true;
}

const safeName = (min: number, max: number) =>
  safeText(min, max).refine(isSafeName, "contains characters that are not allowed in names");

const int = z.number().int().min(-1_000_000_000).max(1_000_000_000);

const PlayerPatch = z
  .strictObject({
    name: safeName(3, 20),
    parlor: safeName(3, 20),
    email: safeText(0, 45),
    male: z.boolean(),
    money: int,
    bp: int,
    bpToday: int,
    turns: int,
    karma: int,
    rating: int,
    luck: z.number().int().min(1).max(100),
    hp: int,
    hpMax: int,
    strength: int,
    psych: int,
    plots: int,
    yangsSent: int,
    playerFights: int,
    tagsReceivedToday: int,
    transportation: int,
    dayLastLoggedOn: int,
    tags: z.tuple([int, int, int]),
    canBeAttacked: z.boolean(),
    policeProtected: z.boolean(),
    kickedOutOfYangs: z.boolean(),
    /** Script values by index: `{ "0": 1 }`. */
    custom: z.record(z.string().regex(/^\d{1,3}$/), int),
  })
  .partial();

const TownPatch = z
  .strictObject({
    name: z.string().trim().min(1).max(40),
    timeZone: z.string().max(64).refine(isValidTimeZone, "not an IANA time zone"),
    dayLengthMinutes: z.number().min(1).max(525_600).nullable(),
    serverNews: z.string().max(1000),
  })
  .partial();

const Paging = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().max(64).optional(),
});

const PlayerParams = z.object({
  townId: z.string().regex(TOWN_ID),
  playerId: z.coerce.number().int().min(0).max(1_000_000),
});

const AuditQueryParams = z.object({
  townId: z.string().regex(TOWN_ID).optional(),
  accountId: z.coerce.number().int().optional(),
  playerId: z.coerce.number().int().optional(),
  kind: z.string().max(64).optional(),
  before: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

/**
 * The sysop API. It replaces the original's Windows dialogs (Game Settings,
 * Server Setup, player editor, ban list). Every route needs
 * `Authorization: Bearer <FQ_ADMIN_TOKEN>`; every change is written to the
 * audit log.
 */
export async function registerAdminRoutes(app: FastifyInstance, ctx: AppContext): Promise<void> {
  const { host, accounts, config } = ctx;
  const safety = { db: ctx.db, clock: ctx.clock, host, accounts };
  const expected = config.adminToken === "" ? null : digest(config.adminToken);

  await app.register(
    async (admin) => {
      // `preValidation`, not `onRequest`: the rate limiter runs as a route-level `onRequest`
      // hook, after any context-level one, so checking the token earlier would let a guesser
      // fail without ever being counted.
      admin.addHook("preValidation", async (request) => {
        if (!expected) {
          throw new HttpError(503, "admin_disabled", "Set FQ_ADMIN_TOKEN to enable the admin API.");
        }
        const header = request.headers.authorization ?? "";
        const given = header.startsWith("Bearer ") ? header.slice(7) : "";
        if (!timingSafeEqual(digest(given), expected)) {
          request.log.warn({ ip: request.ip, url: request.url }, "admin authentication failed");
          throw new HttpError(401, "unauthorized", "Admin token required.");
        }
      });

      /** Who is acting: the `X-Moderator` header the admin page sends, else "admin". */
      const moderatorOf = (request: FastifyRequest): string => {
        const given = request.headers["x-moderator"];
        const name = (Array.isArray(given) ? given[0] : given)?.trim() ?? "";
        return /^[\w .@-]{1,40}$/.test(name) ? name : "admin";
      };

      const audit = (
        request: FastifyRequest,
        kind: string,
        townId: string | null,
        data: unknown,
        extra: { accountId?: number; playerId?: number } = {},
      ) =>
        host.audit.append({
          at: ctx.clock.now(),
          townId,
          kind: `admin:${kind}`,
          data: { moderator: moderatorOf(request), ...(data as object), ip: request.ip },
          ...extra,
        });

      const townOf = (townId: string): TownRuntime => {
        const t = host.get(townId);
        if (!t) throw new HttpError(404, "no_such_town", "No such town.");
        return t;
      };

      const guard = <T>(fn: () => T): T => {
        try {
          return fn();
        } catch (error) {
          if (error instanceof TownExists) throw new HttpError(409, "town_exists", error.message);
          if (error instanceof TownConfigError || error instanceof UnknownContentPack) {
            throw new HttpError(422, "bad_town_config", error.message);
          }
          throw error;
        }
      };

      const accountOf = (id: number): Account => {
        const account = accounts.getAccount(id);
        if (!account) throw new HttpError(404, "no_such_account", "No such account.");
        return account;
      };

      // ------------------------------------------------------------ server

      admin.get("/server", async () => ({
        uptimeSeconds: Math.round((ctx.clock.now() - ctx.startedAt) / 1000),
        now: new Date(ctx.clock.now()).toISOString(),
        towns: host.towns.size,
        accounts: accounts.countAccounts(),
        sockets: host.hub.socketCount(),
        rulesets: rulesetNames(),
        rulesetDetails: Object.values(RULESETS).map((r) => ({
          name: r.name,
          label: r.label,
          description: r.description,
          defaultPack: r.defaultPack,
          tunable: r.tunable,
        })),
        contentPacks: ctx.content.names(),
        limits: {
          idleTimeoutMinutes: config.idleTimeoutMinutes,
          sessionTtlDays: config.sessionTtlDays,
          signupEnabled: config.signupEnabled,
          guestEnabled: config.guestEnabled,
        },
      }));

      // ------------------------------------------------------------- towns

      admin.get("/towns", async () => ({
        towns: [...host.towns.values()].map((t) => ({ ...t.info(), revision: t.revision })),
      }));

      admin.post("/towns", async (request, reply) => {
        const body = TownConfigSchema.parse(request.body);
        const town = guard(() => host.createTown(body));
        audit(request, "town:create", body.id, { config: body });
        return reply.status(201).send(town.info());
      });

      admin.get("/towns/:townId", async (request) => {
        const t = townOf(z.object({ townId: z.string() }).parse(request.params).townId);
        return { ...t.info(), revision: t.revision };
      });

      admin.patch("/towns/:townId", async (request) => {
        const t = townOf(z.object({ townId: z.string() }).parse(request.params).townId);
        const body = TownPatch.parse(request.body);
        const { serverNews, dayLengthMinutes } = body;
        const change: Parameters<TownRuntime["configure"]>[0] = {};
        if (body.name !== undefined) change.name = body.name;
        if (body.timeZone !== undefined) change.timeZone = body.timeZone;
        if (dayLengthMinutes !== undefined) {
          change.dayLengthMs =
            dayLengthMinutes === null ? null : Math.round(dayLengthMinutes * 60_000);
        }
        await t.configure(change);
        if (serverNews !== undefined) {
          await t.mutate("state:server-news", (draft) => {
            draft.serverNews = serverNews;
            return { serverNews };
          });
        }
        audit(request, "town:patch", t.id, body);
        return t.info();
      });

      admin.delete("/towns/:townId", async (request, reply) => {
        const { townId } = z.object({ townId: z.string() }).parse(request.params);
        townOf(townId);
        await host.deleteTown(townId);
        audit(request, "town:delete", null, { townId });
        return reply.status(204).send();
      });

      // ---------------------------------------------------------- settings

      /**
       * Everything a sysop can tune for a town: the Game Settings, and for an Expanded town the
       * Expanded rule numbers (`expandedRules`), each with its engine default and its limits.
       */
      const settingsBody = (t: TownRuntime) => ({
        settings: t.snapshotState.settings,
        defaults: CLASSIC_SETTINGS,
        ...(t.rulesetDef.tunable
          ? {
              expandedRules: {
                /** Only the numbers changed for this town. */
                overrides: t.ruleOverrides,
                /** What the town runs now, for every tunable path. */
                values: currentValues(t.engineContext().rules),
                /** Every tunable path with the engine's default and the allowed range. */
                tunable: tunableRules(),
              },
            }
          : {}),
      });

      admin.get("/towns/:townId/settings", async (request) => {
        const t = townOf(z.object({ townId: z.string() }).parse(request.params).townId);
        return settingsBody(t);
      });

      const ExpandedRulesPatch = z.record(z.string().max(80), z.number().nullable());

      admin.patch("/towns/:townId/settings", async (request) => {
        const t = townOf(z.object({ townId: z.string() }).parse(request.params).townId);
        const { expandedRules, ...rest } = z
          .looseObject({ expandedRules: ExpandedRulesPatch.optional() })
          .parse(request.body);
        const patch = GameSettingsPatch.parse(rest);
        let rulesChanged: { before: Record<string, number>; after: Record<string, number> } | null =
          null;
        if (expandedRules !== undefined) {
          // null puts a number back to the engine's default.
          const before = t.ruleOverrides;
          const next: Record<string, number> = { ...before };
          for (const [path, value] of Object.entries(expandedRules)) {
            if (value === null) delete next[path];
            else next[path] = value;
          }
          guard(() => checkTownSetup(ctx.content, t.rulesetName, t.contentPack, next));
          rulesChanged = { before, after: next };
        }
        if (Object.keys(patch).length > 0) {
          const changed = (await t.mutate("state:settings", (draft) => {
            const before: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(patch)) {
              before[key] = (draft.settings as unknown as Record<string, unknown>)[key];
              (draft.settings as unknown as Record<string, unknown>)[key] = value;
            }
            return { before, after: patch };
          })) as object;
          audit(request, "settings", t.id, changed);
        }
        if (rulesChanged) {
          await t.setRuleOverrides(rulesChanged.after);
          audit(request, "rules", t.id, rulesChanged);
        }
        return settingsBody(t);
      });

      admin.put("/towns/:townId/content-pack", async (request) => {
        const t = townOf(z.object({ townId: z.string() }).parse(request.params).townId);
        const { contentPack } = z
          .strictObject({ contentPack: z.string().min(1).max(32) })
          .parse(request.body);
        guard(() => ctx.content.load(contentPack));
        guard(() => checkTownSetup(ctx.content, t.rulesetName, contentPack, t.ruleOverrides));
        await t.configure({ contentPack });
        audit(request, "content-pack", t.id, { contentPack });
        return t.info();
      });

      // ------------------------------------------------------------- the day

      admin.post("/towns/:townId/new-day", async (request) => {
        const t = townOf(z.object({ townId: z.string() }).parse(request.params).townId);
        const result = await t.forceNewDay();
        audit(request, "new-day", t.id, result);
        return { ...result, day: t.snapshotState.day };
      });

      admin.post("/towns/:townId/reset", async (request) => {
        const t = townOf(z.object({ townId: z.string() }).parse(request.params).townId);
        const body = z
          .strictObject({
            /** Must equal the town id, as a guard against a slip. */
            confirm: z.string(),
            seed: z.number().int().min(0).max(0xffffffff).optional(),
            clearDeeds: z.boolean().optional(),
          })
          .parse(request.body);
        if (body.confirm !== t.id) {
          throw new HttpError(
            400,
            "confirm_required",
            `Send "confirm": "${t.id}" to reset this town.`,
          );
        }
        await t.reset({
          ...(body.seed !== undefined ? { seed: body.seed } : {}),
          ...(body.clearDeeds !== undefined ? { clearDeeds: body.clearDeeds } : {}),
        });
        audit(request, "reset", t.id, { seed: body.seed, clearDeeds: body.clearDeeds });
        return t.info();
      });

      admin.post("/towns/:townId/broadcast", async (request) => {
        const t = townOf(z.object({ townId: z.string() }).parse(request.params).townId);
        const { message } = z.strictObject({ message: safeText(1, 500) }).parse(request.body);
        t.announce(parseLegacyText(message));
        audit(request, "broadcast", t.id, { message });
        return { delivered: host.hub.connectedPlayers(t.id).length };
      });

      // ----------------------------------------------------------- snapshots

      admin.get("/towns/:townId/snapshots", async (request) => {
        const t = townOf(z.object({ townId: z.string() }).parse(request.params).townId);
        return { snapshots: host.townStore.listSnapshots(t.id) };
      });

      admin.post("/towns/:townId/snapshots", async (request, reply) => {
        const t = townOf(z.object({ townId: z.string() }).parse(request.params).townId);
        const body = z
          .strictObject({ reason: safeText(1, 64).default("manual") })
          .parse(request.body ?? {});
        const id = await t.takeSnapshot(`admin:${body.reason}`);
        audit(request, "snapshot", t.id, { id });
        return reply.status(201).send({ id });
      });

      admin.post("/towns/:townId/rollback", async (request) => {
        const t = townOf(z.object({ townId: z.string() }).parse(request.params).townId);
        const { snapshotId } = z
          .strictObject({ snapshotId: z.number().int().min(1) })
          .parse(request.body);
        const ok = await t.rollback(snapshotId);
        if (!ok) throw new HttpError(404, "no_such_snapshot", "No such snapshot for this town.");
        audit(request, "rollback", t.id, { snapshotId });
        return t.info();
      });

      // ------------------------------------------------------------- players

      const playerSummary = (t: TownRuntime, p: PlayerState) => ({
        id: p.id,
        active: p.active,
        name: p.name,
        logon: p.logon,
        parlor: p.parlor,
        bp: p.bp,
        bpToday: p.bpToday,
        money: p.money,
        turns: p.turns,
        lastLogon: p.lastLogon,
        online: t.isOnline(p.id),
        accountId: host.parlorStore.byPlayer(t.id, p.id)?.account_id ?? null,
      });

      admin.get("/towns/:townId/players", async (request) => {
        const t = townOf(z.object({ townId: z.string() }).parse(request.params).townId);
        const q = Paging.extend({ includeInactive: queryBool.default(false) }).parse(request.query);
        const needle = q.search?.toLowerCase();
        const rows = t.snapshotState.players.filter(
          (p) =>
            (q.includeInactive || p.active) &&
            (!needle ||
              p.name.toLowerCase().includes(needle) ||
              p.logon.toLowerCase().includes(needle) ||
              p.parlor.toLowerCase().includes(needle)),
        );
        return {
          total: rows.length,
          players: rows.slice(q.offset, q.offset + q.limit).map((p) => playerSummary(t, p)),
        };
      });

      const playerOf = (params: unknown): { t: TownRuntime; p: PlayerState } => {
        const { townId, playerId } = PlayerParams.parse(params);
        const t = townOf(townId);
        const p = t.player(playerId);
        if (!p) throw new HttpError(404, "no_such_player", "No such player.");
        return { t, p };
      };

      admin.get("/towns/:townId/players/:playerId", async (request) => {
        const { t, p } = playerOf(request.params);
        const { mail, ...rest } = p;
        return {
          ...rest,
          mailWaiting: mail.length,
          online: t.isOnline(p.id),
          accountId: host.parlorStore.byPlayer(t.id, p.id)?.account_id ?? null,
        };
      });

      admin.patch("/towns/:townId/players/:playerId", async (request) => {
        const { t, p } = playerOf(request.params);
        const patch = PlayerPatch.parse(request.body);
        try {
          if (patch.name !== undefined)
            host.moderation.assertTextAllowed(null, patch.name, "name", t.id);
          if (patch.parlor !== undefined)
            host.moderation.assertTextAllowed(null, patch.parlor, "parlor name", t.id);
        } catch (error) {
          throw asHttp(error);
        }
        if (patch.name !== undefined) {
          const taken = t.snapshotState.players.some(
            (o) => o.active && o.id !== p.id && o.name.toLowerCase() === patch.name?.toLowerCase(),
          );
          if (taken)
            throw new HttpError(409, "name_taken", "Another player already has that name.");
        }
        for (const index of Object.keys(patch.custom ?? {})) {
          if (Number(index) >= CUSTOM_SIZE) {
            throw new HttpError(
              400,
              "invalid_request",
              `custom index must be below ${CUSTOM_SIZE}`,
            );
          }
        }
        const { custom, tags, ...plain } = patch;
        const changed = await t.mutate("state:player-edit", (draft) => {
          const target = draft.players[p.id];
          if (!target) throw new HttpError(404, "no_such_player", "No such player.");
          const before: Record<string, unknown> = {};
          const rec = target as unknown as Record<string, unknown>;
          for (const [key, value] of Object.entries(plain)) {
            before[key] = rec[key];
            rec[key] = value;
          }
          if (tags) {
            before.tags = [...target.tags];
            target.tags = [...tags];
          }
          if (custom) {
            const prior: Record<string, number> = {};
            for (const [index, value] of Object.entries(custom)) {
              prior[index] = target.custom[Number(index)] ?? 0;
              target.custom[Number(index)] = value;
            }
            before.custom = prior;
          }
          return { playerId: p.id, before, after: patch };
        });
        audit(request, "player-edit", t.id, changed as object, { playerId: p.id });
        return playerSummary(t, t.player(p.id) as PlayerState);
      });

      admin.post("/towns/:townId/players/:playerId/kick", async (request) => {
        const { t, p } = playerOf(request.params);
        const body = z
          .strictObject({
            reason: safeText(1, 300).optional(),
            reportId: z.number().int().optional(),
          })
          .parse(request.body ?? {});
        const kicked = await t.leave(p.id, "kicked", "admin-kick");
        const accountId = host.parlorStore.byPlayer(t.id, p.id)?.account_id;
        audit(
          request,
          "kick",
          t.id,
          { kicked, reason: body.reason ?? "no reason given", reportId: body.reportId ?? null },
          { playerId: p.id, ...(accountId !== undefined ? { accountId } : {}) },
        );
        if (body.reportId !== undefined) {
          host.moderation.reports.resolve(
            body.reportId,
            "actioned",
            moderatorOf(request),
            "kicked",
            body.reason ?? "",
            ctx.clock.now(),
          );
        }
        return { kicked };
      });

      /** Deletes a parlor and takes its text out of the town (the account stays, if any). */
      const deletePlayer = async (t: TownRuntime, playerId: number) => {
        const account = host.parlorStore.byPlayer(t.id, playerId)?.account_id;
        await t.eraseParlor(
          playerId,
          account === undefined ? { names: [], parlors: [] } : historyIn(safety, account, t.id),
        );
      };

      admin.delete("/towns/:townId/players/:playerId", async (request, reply) => {
        const { t, p } = playerOf(request.params);
        await deletePlayer(t, p.id);
        audit(request, "player-delete", t.id, { name: p.name, logon: p.logon }, { playerId: p.id });
        return reply.status(204).send();
      });

      // ------------------------------------------------------------ accounts

      admin.get("/accounts", async (request) => {
        const q = Paging.parse(request.query);
        return {
          total: accounts.countAccounts(),
          accounts: accounts.listAccounts(q.limit, q.offset, q.search),
        };
      });

      admin.get("/accounts/:accountId", async (request) => {
        const { accountId } = z
          .object({ accountId: z.coerce.number().int() })
          .parse(request.params);
        const account = accountOf(accountId);
        return {
          account,
          parlors: [...host.towns.values()].flatMap((t) => t.parlorsFor(account)),
        };
      });

      admin.post("/accounts/:accountId/ban", async (request) => {
        const { accountId } = z
          .object({ accountId: z.coerce.number().int() })
          .parse(request.params);
        const { reason, reportId } = z
          .strictObject({ reason: safeText(1, 200), reportId: z.number().int().optional() })
          .parse(request.body);
        const account = accountOf(accountId);
        accounts.setBanned(account.id, true, reason);
        if (reportId !== undefined) {
          host.moderation.reports.resolve(
            reportId,
            "actioned",
            moderatorOf(request),
            "banned",
            reason,
            ctx.clock.now(),
          );
        }
        for (const t of host.towns.values()) {
          for (const link of host.parlorStore.forTown(t.id)) {
            if (link.account_id === account.id)
              await t.leave(link.player_id, "banned", "admin-ban");
          }
        }
        audit(request, "account-ban", null, { reason, reportId: reportId ?? null }, { accountId });
        return { banned: true };
      });

      admin.post("/accounts/:accountId/unban", async (request) => {
        const { accountId } = z
          .object({ accountId: z.coerce.number().int() })
          .parse(request.params);
        accountOf(accountId);
        accounts.setBanned(accountId, false, null);
        audit(request, "account-unban", null, {}, { accountId });
        return { banned: false };
      });

      admin.delete("/accounts/:accountId", async (request, reply) => {
        const { accountId } = z
          .object({ accountId: z.coerce.number().int() })
          .parse(request.params);
        const account = accountOf(accountId);
        const { reason } = z
          .object({ reason: safeText(1, 300).default("deleted by an administrator") })
          .parse(request.query);
        // The whole deletion: parlors and their text, hall of fame, reports, audit rows. See the README.
        await deleteAccount(safety, account, moderatorOf(request), reason);
        audit(request, "account-delete", null, { reason }, { accountId });
        return reply.status(204).send();
      });

      // ------------------------------------------------------------- IP bans

      admin.get("/bans", async () => ({ bans: accounts.listIpBans() }));

      admin.post("/bans", async (request, reply) => {
        const body = z
          .strictObject({
            /** An address, a prefix such as "203.0.113" (whole octets), or a CIDR block. */
            prefix: z.string().min(1).max(64),
            reason: safeText(1, 200),
            expiresInHours: z
              .number()
              .positive()
              .max(24 * 3650)
              .optional(),
            reportId: z.number().int().optional(),
          })
          .parse(request.body);
        const expiresAt =
          body.expiresInHours === undefined
            ? null
            : ctx.clock.now() + body.expiresInHours * 3_600_000;
        const ban = accounts.addIpBan(body.prefix, body.reason, expiresAt);
        if (!ban)
          throw new HttpError(422, "bad_ip_rule", "Not a valid address, prefix or CIDR block.");
        const dropped = host.hub.closeWhere((ip) => accounts.isIpBanned(ip), 4403, "banned");
        if (body.reportId !== undefined) {
          host.moderation.reports.resolve(
            body.reportId,
            "actioned",
            moderatorOf(request),
            "address banned",
            body.reason,
            ctx.clock.now(),
          );
        }
        audit(request, "ip-ban", null, {
          prefix: body.prefix,
          reason: body.reason,
          reportId: body.reportId ?? null,
          dropped,
        });
        return reply.status(201).send({ ban, dropped });
      });

      admin.delete("/bans/:banId", async (request, reply) => {
        const { banId } = z.object({ banId: z.coerce.number().int() }).parse(request.params);
        if (!accounts.removeIpBan(banId)) throw new HttpError(404, "no_such_ban", "No such ban.");
        audit(request, "ip-unban", null, { banId });
        return reply.status(204).send();
      });

      registerModerationAdmin(admin, ctx, { audit, moderatorOf, townOf, accountOf, safeName });

      // --------------------------------------------------------------- audit

      admin.get("/audit", async (request) => {
        const q = AuditQueryParams.parse(request.query);
        const rows = host.audit.query({
          limit: q.limit,
          ...(q.townId !== undefined ? { townId: q.townId } : {}),
          ...(q.accountId !== undefined ? { accountId: q.accountId } : {}),
          ...(q.playerId !== undefined ? { playerId: q.playerId } : {}),
          ...(q.kind !== undefined ? { kind: q.kind } : {}),
          ...(q.before !== undefined ? { before: q.before } : {}),
        });
        return { entries: rows, next: rows.length === q.limit ? (rows.at(-1)?.id ?? null) : null };
      });
    },
    { prefix: "/admin" },
  );
}
