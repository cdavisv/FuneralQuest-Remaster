import {
  listAnnouncements,
  listQueuedLetters,
  removeAnnouncement,
  removeLetter,
  removePlayerText,
  renamePlayer,
  type StoredText,
  type TownState,
} from "@fq/core";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Account } from "../auth/accounts.js";
import { deleteAccount, historyIn } from "../moderation/account.js";
import type { ReportRow } from "../moderation/stores.js";
import { MUTE_SCOPES } from "../wire.js";
import type { AppContext } from "./context.js";
import { HttpError } from "./errors.js";
import { asHttp } from "./safety.js";
import { safeText } from "./schemas.js";

/** What the moderation routes borrow from the admin plugin. */
export interface AdminHelpers {
  audit: (
    request: FastifyRequest,
    kind: string,
    townId: string | null,
    data: unknown,
    extra?: { accountId?: number; playerId?: number },
  ) => void;
  moderatorOf: (request: FastifyRequest) => string;
  townOf: (id: string) => import("../game/town.js").TownRuntime;
  accountOf: (id: number) => Account;
  safeName: (min: number, max: number) => z.ZodType<string>;
}

const TownId = z.string().min(1).max(64);
const reason = safeText(1, 300);
const reportId = z.number().int().min(1).optional();

const ReportListQuery = z.object({
  status: z.enum(["open", "dismissed", "actioned"]).optional(),
  category: z.string().max(32).optional(),
  kind: z.string().max(32).optional(),
  townId: TownId.optional(),
  reportedAccountId: z.coerce.number().int().optional(),
  reporterAccountId: z.coerce.number().int().optional(),
  before: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());

/**
 * The moderator's tools: the report queue and the actions on it. Every action takes a `reason`,
 * is written to the audit log with the moderator, the reason and the time (`admin:*` rows), and
 * may name the report it settles. Registered inside the admin plugin, so the token is already
 * checked.
 */
export function registerModerationAdmin(
  admin: FastifyInstance,
  ctx: AppContext,
  h: AdminHelpers,
): void {
  const { host, accounts } = ctx;
  const mod = host.moderation;
  const safety = { db: ctx.db, clock: ctx.clock, host, accounts };

  /** Marks the report the action was for as acted on (the first action closes it). */
  const settle = (
    request: FastifyRequest,
    id: number | undefined,
    resolve: boolean,
    action: string,
    why: string,
  ): void => {
    if (id === undefined || !resolve) return;
    const row = mod.reports.get(id);
    if (!row) throw new HttpError(404, "no_such_report", "No such report.");
    mod.reports.resolve(id, "actioned", h.moderatorOf(request), action, why, ctx.clock.now());
  };

  const sessionIps = (accountId: number): string[] =>
    (
      ctx.db
        .prepare(
          "SELECT DISTINCT ip FROM sessions WHERE account_id = ? AND ip IS NOT NULL ORDER BY id DESC LIMIT 10",
        )
        .all(accountId) as { ip: string }[]
    ).map((r) => r.ip);

  const accountCard = (accountId: number) => {
    const account = accounts.getAccount(accountId);
    if (!account) return null;
    return {
      accountId: account.id,
      login: account.login,
      guest: account.guest,
      banned: account.banned,
      banReason: account.banReason,
      createdAt: iso(account.createdAt),
      lastLoginAt: iso(account.lastLoginAt),
      parlors: [...host.towns.values()].flatMap((t) => t.parlorsFor(account)),
      activeMutes: mod.mutes.active(account.id, ctx.clock.now()),
      reportsAbout: mod.reports.about(account.id, 1000).length,
      openReportsAbout: mod.reports.openAbout(account.id),
      recentAddresses: sessionIps(account.id),
    };
  };

  const listItem = (row: ReportRow) => {
    const reported = row.reported_account_id;
    return {
      ...mod.reportSummary(row),
      reportedMuted: reported !== null && mod.mutes.active(reported, ctx.clock.now()).length > 0,
      reportedBanned: reported !== null && (accounts.getAccount(reported)?.banned ?? false),
    };
  };

  // ------------------------------------------------------------ the queue

  admin.get("/reports", async (request) => {
    const q = ReportListQuery.parse(request.query);
    const rows = mod.reports.list({
      limit: q.limit,
      ...(q.status !== undefined ? { status: q.status } : {}),
      ...(q.category !== undefined ? { category: q.category } : {}),
      ...(q.kind !== undefined ? { kind: q.kind } : {}),
      ...(q.townId !== undefined ? { townId: q.townId } : {}),
      ...(q.reportedAccountId !== undefined ? { reportedAccountId: q.reportedAccountId } : {}),
      ...(q.reporterAccountId !== undefined ? { reporterAccountId: q.reporterAccountId } : {}),
      ...(q.before !== undefined ? { before: q.before } : {}),
    });
    return {
      reports: rows.map(listItem),
      next: rows.length === q.limit ? (rows.at(-1)?.id ?? null) : null,
      counts: {
        open: mod.reports.list({ status: "open", limit: 200 }).length,
      },
    };
  });

  admin.get("/reports/:reportId", async (request) => {
    const { reportId: id } = z.object({ reportId: z.coerce.number().int() }).parse(request.params);
    const row = mod.reports.get(id);
    if (!row) throw new HttpError(404, "no_such_report", "No such report.");
    const evidence = JSON.parse(row.evidence_json) as { chatWindow?: unknown[] };
    const reporter =
      row.reporter_account_id === null ? null : accounts.getAccount(row.reporter_account_id);
    return {
      report: {
        ...listItem(row),
        authoredAt: iso(row.authored_at),
        where: row.where_seen,
        reportedPlayerId: row.reported_player_id,
        evidence: { chatWindow: evidence.chatWindow ?? [] },
        reporter: reporter
          ? { accountId: reporter.id, login: reporter.login, guest: reporter.guest }
          : null,
      },
      reported: row.reported_account_id === null ? null : accountCard(row.reported_account_id),
      others:
        row.reported_account_id === null
          ? []
          : mod.reports
              .about(row.reported_account_id, 20)
              .filter((r) => r.id !== row.id)
              .map(listItem),
    };
  });

  admin.post("/reports/:reportId/dismiss", async (request) => {
    const { reportId: id } = z.object({ reportId: z.coerce.number().int() }).parse(request.params);
    const body = z.strictObject({ reason }).parse(request.body);
    const row = mod.reports.get(id);
    if (!row) throw new HttpError(404, "no_such_report", "No such report.");
    const by = h.moderatorOf(request);
    if (!mod.reports.resolve(id, "dismissed", by, "dismissed", body.reason, ctx.clock.now())) {
      throw new HttpError(409, "already_closed", "That report is already closed.");
    }
    h.audit(
      request,
      "report-dismiss",
      row.town_id,
      { reportId: id, reason: body.reason },
      row.reported_account_id === null ? {} : { accountId: row.reported_account_id },
    );
    // Reports that stirred an automatic mute can be dismissed together: lift it with the last one.
    const lifted =
      row.reported_account_id === null
        ? null
        : mod.liftAutoMuteIfSettled(row.reported_account_id, by);
    return { dismissed: true, liftedMute: lifted };
  });

  admin.post("/reports/:reportId/resolve", async (request) => {
    const { reportId: id } = z.object({ reportId: z.coerce.number().int() }).parse(request.params);
    const body = z.strictObject({ action: safeText(1, 60), reason }).parse(request.body);
    const row = mod.reports.get(id);
    if (!row) throw new HttpError(404, "no_such_report", "No such report.");
    if (
      !mod.reports.resolve(
        id,
        "actioned",
        h.moderatorOf(request),
        body.action,
        body.reason,
        ctx.clock.now(),
      )
    ) {
      throw new HttpError(409, "already_closed", "That report is already closed.");
    }
    h.audit(
      request,
      "report-resolve",
      row.town_id,
      { reportId: id, ...body },
      row.reported_account_id === null ? {} : { accountId: row.reported_account_id },
    );
    return { resolved: true };
  });

  admin.get("/accounts/:accountId/moderation", async (request) => {
    const { accountId } = z.object({ accountId: z.coerce.number().int() }).parse(request.params);
    const card = accountCard(accountId);
    if (!card) throw new HttpError(404, "no_such_account", "No such account.");
    return {
      account: card,
      reportsAbout: mod.reports.about(accountId, 100).map(listItem),
      reportsFiled: mod.reports.filedBy(accountId, 100).map(listItem),
      mutes: mod.mutes.forAccount(accountId, 100),
      actions: host.audit.query({ accountId, kind: "admin:", limit: 100 }),
      automatic: host.audit.query({ accountId, kind: "mod:", limit: 50 }),
    };
  });

  // -------------------------------------------------------------- actions

  admin.post("/moderation/warn", async (request) => {
    const body = z
      .strictObject({
        accountId: z.number().int(),
        townId: TownId.optional(),
        message: safeText(1, 500),
        reason,
        reportId,
        resolve: z.boolean().default(true),
      })
      .parse(request.body);
    const account = h.accountOf(body.accountId);
    const delivered: string[] = [];
    for (const t of host.towns.values()) {
      if (body.townId !== undefined && t.id !== body.townId) continue;
      const link = host.parlorStore.find(account.id, t.id);
      if (!link) continue;
      await t.transform(
        "mod:warn",
        (town, engine) => {
          const next = JSON.parse(JSON.stringify(town)) as TownState;
          const player = next.players[link.player_id];
          if (!player?.active) return { town, data: { delivered: false } };
          const base = { importance: "high", from: -1, expireDay: null } as const;
          player.mail.push({
            ...base,
            type: "text",
            text: `\`$A message from the management:\`w\r\n${body.message}\r\n`,
          });
          player.mail.push({
            ...base,
            type: "buttons",
            buttons: [{ id: "go:desk", label: engine.content.text.desk.continueLabel }],
          });
          delivered.push(t.id);
          return { town: next, data: { delivered: true } };
        },
        { playerId: link.player_id },
      );
    }
    if (delivered.length === 0) {
      throw new HttpError(409, "no_parlor", "That account has no parlor to receive a letter.");
    }
    h.audit(
      request,
      "warn",
      body.townId ?? null,
      {
        reason: body.reason,
        reportId: body.reportId ?? null,
        towns: delivered,
        message: body.message,
      },
      { accountId: account.id },
    );
    settle(request, body.reportId, body.resolve, "warned", body.reason);
    return { delivered };
  });

  admin.post("/moderation/takedown", async (request) => {
    const body = z
      .strictObject({
        accountId: z.number().int(),
        townId: TownId.optional(),
        /**
         * What to take down. The engine's `removePlayerText` works per player: `all` removes their
         * queued letters, announcements on every stored page, battle quotes and fortunes;
         * `announcements` keeps only the paper's change; `mail` only what is queued for others.
         * To take down one item only, list it (`GET /towns/:id/stored-text`) and use
         * `POST /moderation/remove-item`. Chat was never stored.
         */
        scope: z.enum(["all", "announcements", "mail"]).default("all"),
        reason,
        reportId,
        resolve: z.boolean().default(true),
      })
      .parse(request.body);
    const account = h.accountOf(body.accountId);
    const results: {
      townId: string;
      letters: number;
      announcements: number;
      quotes: number;
      fortunes: number;
    }[] = [];
    for (const t of host.towns.values()) {
      if (body.townId !== undefined && t.id !== body.townId) continue;
      const link = host.parlorStore.find(account.id, t.id);
      if (!link) continue;
      const history = historyIn(safety, account.id, t.id);
      const removed = await t.transform(
        "mod:takedown",
        (town, engine) => {
          const out = removePlayerText(town, link.player_id, engine, { names: history.names });
          let next = out.town;
          if (body.scope === "announcements") {
            const news: TownState["news"] = {};
            for (const [day, page] of Object.entries(town.news)) {
              news[day] = { ...page, front: out.town.news[day]?.front ?? page.front };
            }
            next = { ...town, news };
          } else if (body.scope === "mail") {
            next = {
              ...town,
              players: town.players.map((p, i) => ({
                ...p,
                mail: out.town.players[i]?.mail ?? p.mail,
              })),
            };
          }
          return { town: next, data: out.removed };
        },
        { playerId: link.player_id },
      );
      results.push({ townId: t.id, ...removed });
    }
    h.audit(
      request,
      "takedown",
      body.townId ?? null,
      {
        reason: body.reason,
        reportId: body.reportId ?? null,
        scope: body.scope,
        removed: results,
      },
      { accountId: account.id },
    );
    settle(request, body.reportId, body.resolve, "content taken down", body.reason);
    return { removed: results };
  });

  // ------------------------------------------------ single items of stored text

  /**
   * What a player has written that is still stored in a town, item by item, so a moderator can
   * take down one. Announcements and battle quotes are matched by the author's names (the
   * player's own and those in the audit history); letters by the sender's player id, across every
   * other player's waiting mail.
   */
  admin.get("/towns/:townId/stored-text", async (request) => {
    const { townId } = z.object({ townId: TownId }).parse(request.params);
    const { playerId } = z
      .object({ playerId: z.coerce.number().int().min(0).max(1_000_000) })
      .parse(request.query);
    const t = h.townOf(townId);
    const player = t.player(playerId);
    if (!player) throw new HttpError(404, "no_such_player", "No such player.");
    const link = host.parlorStore.byPlayer(t.id, playerId);
    const names = new Set([
      player.name,
      ...(link ? historyIn(safety, link.account_id, t.id).names : []),
    ]);
    const town = t.snapshotState;
    const engine = t.engineContext();
    const announcements: (StoredText & { day: number; section: "front" | "crime" })[] = [];
    for (const key of Object.keys(town.news)) {
      for (const section of ["front", "crime"] as const) {
        for (const item of listAnnouncements(town, engine, Number(key), section)) {
          if (typeof item.author === "string" && names.has(item.author)) {
            announcements.push({ ...item, day: Number(key), section });
          }
        }
      }
    }
    const letters: (StoredText & { to: number; toName: string })[] = [];
    for (const other of town.players) {
      if (other.id === playerId) continue;
      for (const item of listQueuedLetters(town, other.id)) {
        if (item.author === playerId) letters.push({ ...item, to: other.id, toName: other.name });
      }
    }
    return { announcements: announcements.slice(0, 200), letters: letters.slice(0, 200) };
  });

  admin.post("/moderation/remove-item", async (request) => {
    const common = { reason, reportId, resolve: z.boolean().default(true) };
    const body = z
      .discriminatedUnion("kind", [
        z.strictObject({
          kind: z.literal("announcement"),
          townId: TownId,
          day: z.number().int().min(0).max(1_000_000),
          section: z.enum(["front", "crime"]).default("front"),
          index: z.number().int().min(0).max(10_000).optional(),
          hash: z
            .string()
            .regex(/^[0-9a-f]{8}$/)
            .optional(),
          ...common,
        }),
        z.strictObject({
          kind: z.literal("letter"),
          townId: TownId,
          to: z.number().int().min(0).max(1_000_000),
          index: z.number().int().min(0).max(10_000).optional(),
          hash: z
            .string()
            .regex(/^[0-9a-f]{8}$/)
            .optional(),
          ...common,
        }),
      ])
      .parse(request.body);
    if (body.index === undefined && body.hash === undefined) {
      throw new HttpError(400, "invalid_request", "Name the item by index or hash (or both).");
    }
    const t = h.townOf(body.townId);
    const removed = await t.transform(
      body.kind === "announcement" ? "mod:remove-announcement" : "mod:remove-letter",
      (town, engine) => {
        const out =
          body.kind === "announcement"
            ? removeAnnouncement(town, engine, {
                day: body.day,
                section: body.section,
                ...(body.index !== undefined ? { index: body.index } : {}),
                ...(body.hash !== undefined ? { hash: body.hash } : {}),
              })
            : removeLetter(town, {
                to: body.to,
                ...(body.index !== undefined ? { index: body.index } : {}),
                ...(body.hash !== undefined ? { hash: body.hash } : {}),
              });
        return { town: out.town, data: { removed: out.removed } };
      },
    );
    if (!removed.removed) {
      throw new HttpError(
        404,
        "no_such_item",
        "That item is not stored any more (it may have moved).",
      );
    }
    h.audit(request, body.kind === "announcement" ? "remove-announcement" : "remove-letter", t.id, {
      reason: body.reason,
      reportId: body.reportId ?? null,
      ...(body.kind === "announcement"
        ? { day: body.day, section: body.section }
        : { to: body.to }),
      index: body.index ?? null,
      hash: body.hash ?? null,
    });
    settle(request, body.reportId, body.resolve, "item taken down", body.reason);
    return { removed: true };
  });

  admin.post("/moderation/rename", async (request) => {
    const body = z
      .strictObject({
        townId: TownId,
        playerId: z.number().int().min(0).max(1_000_000),
        name: h.safeName(3, 20).optional(),
        parlor: h.safeName(3, 20).optional(),
        reason,
        reportId,
        resolve: z.boolean().default(true),
      })
      .parse(request.body);
    if (body.name === undefined && body.parlor === undefined) {
      throw new HttpError(400, "invalid_request", "Give a new name, a new parlor name, or both.");
    }
    const t = h.townOf(body.townId);
    const before = t.player(body.playerId);
    if (!before?.active) throw new HttpError(404, "no_such_player", "No such player.");
    try {
      for (const [text, what] of [
        [body.name, "name"],
        [body.parlor, "parlor name"],
      ] as const) {
        if (text !== undefined) mod.assertTextAllowed(null, text, what, t.id);
      }
    } catch (error) {
      throw asHttp(error);
    }
    const error = await t.transform(
      "mod:rename",
      (town, engine) => {
        const out = renamePlayer(town, body.playerId, engine, {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.parlor !== undefined ? { parlor: body.parlor } : {}),
        });
        return { town: out.error ? town : out.town, data: out.error ?? null };
      },
      { playerId: body.playerId },
    );
    if (error) {
      const map = {
        noSuchPlayer: [404, "No such player."],
        nameLength: [422, "Names are 3 to 20 characters."],
        nameTaken: [409, "Another player already has that name."],
        parlorLength: [422, "Parlor names are 3 to 20 characters."],
      } as const;
      const [status, message] = map[error];
      throw new HttpError(status, `rename_${error}`, message);
    }
    const accountId = host.parlorStore.byPlayer(t.id, body.playerId)?.account_id;
    h.audit(
      request,
      "rename",
      t.id,
      {
        reason: body.reason,
        reportId: body.reportId ?? null,
        before: { name: before.name, parlor: before.parlor },
        after: { name: body.name ?? before.name, parlor: body.parlor ?? before.parlor },
      },
      { playerId: body.playerId, ...(accountId !== undefined ? { accountId } : {}) },
    );
    settle(request, body.reportId, body.resolve, "renamed", body.reason);
    return { renamed: true };
  });

  admin.post("/moderation/mute", async (request) => {
    const body = z
      .strictObject({
        accountId: z.number().int(),
        scopes: z.array(z.enum(MUTE_SCOPES)).min(1).max(4),
        hours: z.number().min(1).max(8760),
        reason,
        reportId,
        resolve: z.boolean().default(true),
      })
      .parse(request.body);
    const account = h.accountOf(body.accountId);
    const mute = mod.createMute({
      accountId: account.id,
      scopes: body.scopes,
      hours: body.hours,
      reason: body.reason,
      moderator: h.moderatorOf(request),
      reportId: body.reportId ?? null,
    });
    h.audit(
      request,
      "mute",
      null,
      {
        reason: body.reason,
        reportId: body.reportId ?? null,
        muteId: mute.id,
        scopes: mute.scopes,
        hours: body.hours,
        until: iso(mute.expiresAt),
      },
      { accountId: account.id },
    );
    settle(request, body.reportId, body.resolve, "muted", body.reason);
    return { mute };
  });

  admin.post("/moderation/unmute", async (request) => {
    const body = z.strictObject({ muteId: z.number().int(), reason }).parse(request.body);
    const mute = mod.mutes.get(body.muteId);
    if (!mute) throw new HttpError(404, "no_such_mute", "No such mute.");
    if (!mod.mutes.lift(body.muteId, ctx.clock.now())) {
      throw new HttpError(409, "already_lifted", "That mute is already lifted.");
    }
    h.audit(
      request,
      "unmute",
      null,
      { reason: body.reason, muteId: body.muteId },
      {
        accountId: mute.accountId,
      },
    );
    return { lifted: true };
  });

  admin.get("/moderation/mutes", async () => ({
    mutes: mod.mutes.allActive(ctx.clock.now()).map((m) => ({
      ...m,
      login: accounts.getAccount(m.accountId)?.login ?? null,
    })),
  }));

  admin.post("/moderation/delete-account", async (request) => {
    const body = z
      .strictObject({ accountId: z.number().int(), reason, confirm: z.literal(true) })
      .parse(request.body);
    const account = h.accountOf(body.accountId);
    const by = h.moderatorOf(request);
    const summary = await deleteAccount(safety, account, by, body.reason);
    h.audit(
      request,
      "account-delete",
      null,
      { reason: body.reason, summary },
      { accountId: account.id },
    );
    return summary;
  });
}
