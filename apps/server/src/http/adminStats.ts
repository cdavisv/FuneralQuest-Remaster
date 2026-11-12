import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { computeActivityStats, utcDay } from "../game/activity.js";
import { TOWN_ID } from "../game/townConfig.js";
import type { AppContext } from "./context.js";
import { HttpError } from "./errors.js";

const StatsQuery = z.object({
  town: z.string().regex(TOWN_ID).optional(),
  days: z.coerce.number().int().min(1).max(365).default(60),
});

/** What the record holds, said once for the API and the admin page alike. */
export const ACTIVITY_RECORDED =
  "For each account, the UTC days on which it played at least one action in a town (account, town, day). No address, no time of day, nothing the player typed.";

/**
 * `GET /admin/stats`: are players coming back? Daily new and active accounts and the return rates
 * of each first-play cohort, from the activity record (`activity_days`, see `game/activity.ts`).
 * Read-only, so it writes no audit row.
 */
export function registerStatsAdmin(admin: FastifyInstance, ctx: AppContext): void {
  admin.get("/stats", async (request) => {
    const q = StatsQuery.parse(request.query);
    if (q.town !== undefined && !ctx.host.get(q.town)) {
      throw new HttpError(404, "no_such_town", "No such town.");
    }
    const rows = ctx.host.activityStore
      .accountDays(q.town)
      .map((r) => ({ accountId: r.account_id, day: r.day }));
    const now = ctx.clock.now();
    return {
      now: new Date(now).toISOString(),
      town: q.town ?? null,
      recorded: ACTIVITY_RECORDED,
      retentionDays: ctx.config.activityRetentionDays,
      ...computeActivityStats(rows, utcDay(now), q.days),
    };
  });
}
