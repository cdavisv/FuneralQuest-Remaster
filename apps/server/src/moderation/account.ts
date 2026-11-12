import type { Account, AccountService } from "../auth/accounts.js";
import type { Clock } from "../clock.js";
import { type Db, transaction } from "../db/database.js";
import type { GameHost } from "../game/host.js";
import { CLOSED_PARLOR, type NameHistory } from "./erase.js";

/**
 * Account deletion and data export.
 *
 * Deletion removes the account, its sessions, blocks (both ways), mutes, Daily Challenge runs and
 * activity record (the days it played, `activity_days`),
 * deletes or anonymises its parlors in every town (`TownRuntime.eraseParlor`), takes its names out
 * of the hall of fame, deletes the reports it filed that are resolved and the audit rows that hold
 * what it typed, and keeps only: the audit rows of moderation (`admin:*`, `mod:*`, `report:*`
 * actions about it) and a note that a deletion happened, and open reports about it.
 */

export interface SafetyContext {
  db: Db;
  clock: Clock;
  host: GameHost;
  accounts: AccountService;
}

/** Audit kinds that survive an account's deletion. */
export const KEPT_AUDIT = ["admin:", "mod:", "account:deleted"] as const;

export interface DeletionSummary {
  parlors: {
    townId: string;
    letters: number;
    announcements: number;
    quotes: number;
    fortunes: number;
  }[];
  hallEntries: number;
  reportsDeleted: number;
  reportsAnonymised: number;
  openReportsKept: number;
  auditRowsDeleted: number;
  /** Rows of the activity record (days played) deleted. */
  activityDaysDeleted: number;
}

/** Names this account used in a town, from the audit log (creation and moderator renames). */
export function historyIn(ctx: SafetyContext, accountId: number, townId: string): NameHistory {
  const names = new Set<string>();
  const parlors = new Set<string>();
  const rows = [
    ...ctx.host.audit.query({ accountId, townId, kind: "parlor:create", limit: 200 }),
    ...ctx.host.audit.query({ accountId, townId, kind: "admin:rename", limit: 200 }),
  ];
  for (const row of rows) {
    const data = row.data as {
      name?: unknown;
      parlor?: unknown;
      before?: { name?: unknown; parlor?: unknown };
      after?: { name?: unknown; parlor?: unknown };
    } | null;
    for (const part of [data, data?.before, data?.after]) {
      if (typeof part?.name === "string") names.add(part.name);
      if (typeof part?.parlor === "string") parlors.add(part.parlor);
    }
  }
  return { names: [...names], parlors: [...parlors] };
}

/** Rewrites the hall of fame so the account's names are gone; returns how many entries changed. */
function scrubHall(ctx: SafetyContext, accountId: number, towns: Map<string, NameHistory>): number {
  const hall = ctx.host.hall;
  // Pairs of name and parlor the account held in each entry. Entries recorded with owners are
  // exact; older ones (before owners were kept) are matched by the names the account is known to
  // have used in that town, which is best effort.
  const byEntry = new Map<number, { name: string; parlor: string }[]>();
  for (const o of hall.ownedBy(accountId)) {
    const list = byEntry.get(o.hall_id) ?? [];
    list.push({ name: o.name, parlor: o.parlor });
    byEntry.set(o.hall_id, list);
  }
  const withOwners = new Set(
    (ctx.db.prepare("SELECT DISTINCT hall_id FROM hall_owners").all() as { hall_id: number }[]).map(
      (r) => r.hall_id,
    ),
  );
  for (const [townId, history] of towns) {
    for (const row of hall.forTown(townId)) {
      if (withOwners.has(row.id) || byEntry.has(row.id)) continue;
      byEntry.set(
        row.id,
        history.names.flatMap((name) => history.parlors.map((parlor) => ({ name, parlor }))),
      );
    }
  }
  let changed = 0;
  for (const [hallId, pairs] of byEntry) {
    const row = hall.get(hallId);
    if (!row) continue;
    const entry = JSON.parse(row.entry_json) as {
      winner?: { name: string; parlor: string } | null;
      standings?: { name: string; parlor: string }[];
      chains?: { members: string[] }[];
      deed?: string | null;
    };
    let touched = false;
    const mine = (name: string, parlor: string) =>
      pairs.some((p) => p.name === name && p.parlor === parlor);
    for (const s of entry.standings ?? []) {
      if (mine(s.name, s.parlor)) {
        s.name = CLOSED_PARLOR;
        s.parlor = CLOSED_PARLOR;
        touched = true;
      }
    }
    if (entry.winner && mine(entry.winner.name, entry.winner.parlor)) {
      entry.winner.name = CLOSED_PARLOR;
      entry.winner.parlor = CLOSED_PARLOR;
      touched = true;
    }
    const names = new Set(pairs.map((p) => p.name));
    for (const chain of entry.chains ?? []) {
      chain.members = chain.members.map((m) => {
        if (!names.has(m)) return m;
        touched = true;
        return CLOSED_PARLOR;
      });
    }
    if (typeof entry.deed === "string") {
      let deed = entry.deed;
      for (const p of pairs) {
        for (const text of [p.name, p.parlor]) {
          if (text !== "" && deed.includes(text)) deed = deed.split(text).join(CLOSED_PARLOR);
        }
      }
      if (deed !== entry.deed) {
        entry.deed = deed;
        touched = true;
      }
    }
    if (!touched) continue;
    const winner = entry.winner ?? null;
    hall.rewrite(hallId, {
      winnerName: winner?.name ?? null,
      winnerParlor: winner?.parlor ?? null,
      entryJson: JSON.stringify(entry),
    });
    changed++;
  }
  return changed;
}

/**
 * Deletes an account and everything about it that does not have to be kept. `by` is who asked:
 * "self" for the player, or a moderator's name.
 */
export async function deleteAccount(
  ctx: SafetyContext,
  account: Account,
  by: string,
  reason: string,
): Promise<DeletionSummary> {
  const { host } = ctx;
  // No session survives, even if the deletion is interrupted and has to be run again.
  ctx.accounts.revokeAll(account.id);

  const histories = new Map<string, NameHistory>();
  const parlors: DeletionSummary["parlors"] = [];
  for (const town of host.towns.values()) {
    const history = historyIn(ctx, account.id, town.id);
    histories.set(town.id, history);
    const link = host.parlorStore.find(account.id, town.id);
    const slotIds = new Set<number>();
    if (link) slotIds.add(link.player_id);
    // A slot that still carries the login but lost its link (a stale link) is the account's too.
    for (const p of town.snapshotState.players) {
      if (p.logon.toLowerCase() === account.login.toLowerCase()) slotIds.add(p.id);
    }
    for (const playerId of slotIds) {
      const removed = await town.eraseParlor(playerId, history);
      if (removed) parlors.push({ townId: town.id, ...removed });
    }
  }

  const summary = transaction(ctx.db, () => {
    const hallEntries = scrubHall(ctx, account.id, histories);
    host.hall.forgetOwner(account.id);
    const reports = host.moderation.reports.eraseAccount(account.id);
    const auditRowsDeleted = host.audit.eraseAccount(account.id, KEPT_AUDIT);
    const activityDaysDeleted = host.activityStore.eraseAccount(account.id);
    host.audit.append({
      at: ctx.clock.now(),
      accountId: account.id,
      kind: "account:deleted",
      data: {
        by,
        reason,
        guest: account.guest,
        parlors: parlors.length,
        openReportsKept: reports.keptOpen,
        // What is kept, and why: open reports about the account (moderation, legitimate interest)
        // and the moderation rows of the audit log. Nothing else.
      },
    });
    ctx.accounts.deleteAccount(account.id);
    return {
      parlors,
      hallEntries,
      reportsDeleted: reports.deleted,
      reportsAnonymised: reports.anonymised,
      openReportsKept: reports.keptOpen,
      auditRowsDeleted,
      activityDaysDeleted,
    } satisfies DeletionSummary;
  });
  host.activity.forget(account.id);
  host.moderation.forgetAccount(account.id);
  host.challenge.invalidate();
  await host.moderation.applyEverywhere();
  return summary;
}

// ----------------------------------------------------------------- export

interface SessionRow {
  created_at: number;
  expires_at: number;
  last_seen_at: number;
  ip: string | null;
}

/** Everything stored about the account that belongs to it, as JSON. Nothing of other players'. */
export function exportAccount(ctx: SafetyContext, account: Account): Record<string, unknown> {
  const { host, db } = ctx;
  const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());
  const sessions = (
    db
      .prepare(
        "SELECT created_at, expires_at, last_seen_at, ip FROM sessions WHERE account_id = ? ORDER BY id",
      )
      .all(account.id) as unknown as SessionRow[]
  ).map((s) => ({
    createdAt: iso(s.created_at),
    expiresAt: iso(s.expires_at),
    lastSeenAt: iso(s.last_seen_at),
    ip: s.ip,
  }));

  const parlors = [...host.towns.values()].flatMap((town) => {
    const link = host.parlorStore.find(account.id, town.id);
    const player = link ? town.player(link.player_id) : undefined;
    if (!link || !player || player.logon.toLowerCase() !== account.login.toLowerCase()) return [];
    // The queue holds letters other players wrote to this one; only how many are waiting is given.
    const { mail, ...record } = player;
    return [
      {
        townId: town.id,
        townName: town.name,
        createdAt: iso(link.created_at),
        player: record,
        mailWaiting: mail.length,
      },
    ];
  });

  const blocks = host.moderation.blockStore.forBlocker(account.id).map((b) => {
    const info = host.moderation.describeBlock(b);
    return { name: info.name, since: info.since };
  });

  const filed = host.moderation.reports.filedBy(account.id, 1000).map((r) => ({
    id: r.id,
    createdAt: iso(r.created_at),
    townId: r.town_id,
    kind: r.kind,
    category: r.category,
    note: r.note,
    status: r.status,
  }));
  const about = host.moderation.reports.about(account.id, 10_000);

  const mutes = host.moderation.mutes.forAccount(account.id, 1000).map((m) => ({
    scopes: m.scopes,
    createdAt: iso(m.createdAt),
    expiresAt: iso(m.expiresAt),
    liftedAt: iso(m.liftedAt),
    automatic: m.auto,
  }));

  const daily = (
    db
      .prepare(
        `SELECT day, guest, status, abandoned, name, parlor, started_at, finished_at, score, money,
           sales, exact, walkouts FROM challenge_runs WHERE account_id = ? ORDER BY day`,
      )
      .all(account.id) as unknown as Record<string, number | string | null>[]
  ).map((r) => ({
    day: r.day,
    status: r.status,
    abandoned: r.abandoned === 1,
    name: r.name,
    parlor: r.parlor,
    startedAt: iso(r.started_at as number),
    finishedAt: iso(r.finished_at as number | null),
    score: r.score,
    money: r.money,
    sales: r.sales,
    exact: r.exact,
    walkouts: r.walkouts,
  }));

  const hallOfFame = host.hall.ownedBy(account.id).flatMap((o) => {
    const row = host.hall.get(o.hall_id);
    return row ? [{ townId: row.town_id, season: row.season, name: o.name, parlor: o.parlor }] : [];
  });

  const activity = [
    ...host.audit.query({ accountId: account.id, kind: "action", limit: 2000 }),
    ...host.audit.query({ accountId: account.id, kind: "account:", limit: 200 }),
    ...host.audit.query({ accountId: account.id, kind: "parlor:create", limit: 200 }),
    ...host.audit.query({ accountId: account.id, kind: "safety:", limit: 500 }),
    ...host.audit.query({ accountId: account.id, kind: "report:", limit: 500 }),
  ]
    .sort((a, b) => b.id - a.id)
    // A block row names the other account; that is theirs, not the blocker's.
    .map((r) => ({
      at: iso(r.at),
      townId: r.townId,
      kind: r.kind,
      data: r.kind.startsWith("safety:") ? null : r.data,
    }));

  return {
    format: 1,
    exportedAt: iso(ctx.clock.now()),
    account: {
      id: account.id,
      login: account.login,
      guest: account.guest,
      createdAt: iso(account.createdAt),
      lastLoginAt: iso(account.lastLoginAt),
    },
    sessions,
    parlors,
    blocks,
    reportsFiled: filed,
    // How many, never by whom.
    reportsAboutYou: { count: about.length },
    mutes,
    dailyChallenge: daily,
    hallOfFame,
    activity,
    // The activity record: the UTC days on which you played in each town (nothing else is kept).
    daysPlayed: host.activityStore
      .forAccount(account.id)
      .map((r) => ({ day: r.day, townId: r.town_id })),
    notRepeated: [
      "Letters other players wrote to you, and text of reports about you or by you, belong to those players or to the moderators and are not repeated here.",
      "Audit rows about what the game did (rather than what you typed) are not repeated.",
    ],
  };
}
