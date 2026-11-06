import { createHmac, randomBytes } from "node:crypto";
import {
  createDailyChallenge,
  type DailyChallenge,
  type DailyChallengeResult,
  dailyChallengeResult,
  type EngineContext,
  expandedContext,
  leaveGame,
  rankDailyChallenge,
  startDailyChallenge,
  step,
  type TownState,
} from "@fq/core";
import type { Action, View } from "@fq/protocol";
import type { FastifyBaseLogger } from "fastify";
import type { Account } from "../auth/accounts.js";
import type { Clock } from "../clock.js";
import type { ContentSource } from "../content/index.js";
import { type Db, transaction } from "../db/database.js";
import type {
  AuditStore,
  ChallengeRunRow,
  ChallengeScore,
  ChallengeStore,
  SecretStore,
} from "../db/stores.js";
import type {
  DailyChallengeInfo,
  DailyChallengeScore,
  DailyChallengeYou,
  LeaderboardResponse,
  LeaderboardRow,
} from "../wire.js";
import { SerialQueue } from "./queue.js";

/**
 * The Daily Challenge (docs/expanded-rules.md section 24) on the server.
 *
 * - **One challenge a day, the same for everyone.** The day is the UTC calendar date. The engine's
 *   `createDailyChallenge` names it; the server replaces the seed it derives from the date alone
 *   (anyone could compute that) with one derived from the date and a secret the server generates
 *   once and keeps in its database (`server_secrets`), so tomorrow's customers cannot be worked out
 *   in advance. Every player of the day gets that one seed, so the customers are identical.
 * - **A private one-player town.** Each account's run is its own `TownState` (player 0), stored in
 *   `challenge_runs` and replaced after every action, exactly like a town's state. Maintenance
 *   never runs on it.
 * - **Once per account per day.** The row exists from the first `enter`. A run ends when the turns
 *   are used up, the player quits, or it sits idle for `FQ_IDLE_TIMEOUT_MINUTES`; the result is
 *   frozen then. An abandoned run counts as played (it keeps what it earned, and cannot be redone).
 * - **The board.** Finished runs of registered accounts, ranked by the engine's
 *   `rankDailyChallenge`. Guests play and see their result but never appear on the board.
 */

export class AlreadyPlayed extends Error {
  constructor(readonly result: DailyChallengeScore) {
    super("You have already played today's challenge.");
  }
}

export class NotPlaying extends Error {}

export class InvalidEntry extends Error {
  constructor(
    readonly field: "name" | "parlor",
    message: string,
  ) {
    super(message);
  }
}

export type DailyEnter = { view: View; day: string; created: boolean };
export type DailyAct =
  | { kind: "ok"; view: View; result: DailyChallengeScore | null }
  | { kind: "rejected"; reason: string; view: View };

export interface ChallengeDeps {
  db: Db;
  store: ChallengeStore;
  secrets: SecretStore;
  audit: AuditStore;
  clock: Clock;
  content: ContentSource;
  log: FastifyBaseLogger;
  idleTimeoutMs: number;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const RANKED_CACHE_MS = 5000;

export function isChallengeDay(text: string): boolean {
  return DAY.test(text) && !Number.isNaN(Date.parse(`${text}T00:00:00Z`));
}

function scoreOf(row: ChallengeRunRow): DailyChallengeScore {
  return {
    score: row.score,
    money: row.money,
    sales: row.sales,
    exact: row.exact,
    walkouts: row.walkouts,
    abandoned: row.abandoned === 1,
  };
}

function toScore(r: DailyChallengeResult): ChallengeScore {
  return { score: r.score, money: r.money, sales: r.sales, exact: r.exact, walkouts: r.walkouts };
}

export class ChallengeService {
  private readonly queue = new SerialQueue();
  private readonly secret: string;
  private baseCtx: EngineContext | null = null;
  private readonly rankedCache = new Map<
    string,
    { at: number; rows: (LeaderboardRow & { accountId: number })[] }
  >();

  constructor(private readonly deps: ChallengeDeps) {
    this.secret = deps.secrets.getOrCreate("daily-challenge", () =>
      randomBytes(32).toString("hex"),
    );
  }

  /** Operations waiting in the challenge's queue (the HTTP layer refuses new ones past a limit). */
  get pending(): number {
    return this.queue.length;
  }

  // --------------------------------------------------------------- days

  /** Today's challenge day: the UTC calendar date. */
  today(): string {
    return new Date(this.deps.clock.now()).toISOString().slice(0, 10);
  }

  private nextAt(): string {
    const midnight = Date.parse(`${this.today()}T00:00:00Z`) + 86_400_000;
    return new Date(midnight).toISOString();
  }

  private ctx(): EngineContext {
    this.baseCtx ??= expandedContext(this.deps.content.load("expanded"));
    return { ...this.baseCtx, now: this.deps.clock.now() };
  }

  /**
   * The challenge for `day`: the engine's, with a seed from the date and the server secret (see
   * the class comment). Pure in `(secret, day)`, so it is the same for every player and after a
   * restart.
   */
  challengeFor(day: string): DailyChallenge {
    const made = createDailyChallenge(day, this.ctx());
    const digest = createHmac("sha256", this.secret).update(`daily-challenge:${day}`).digest();
    return { ...made, seed: digest.readUInt32BE(0) };
  }

  // -------------------------------------------------------------- reads

  /** `GET /api/daily`. */
  info(account: Account | null): Promise<DailyChallengeInfo> {
    return this.queue.run(() => {
      this.settle(account?.id);
      const day = this.today();
      const l = this.challengeFor(day).loadout;
      return {
        day,
        nextAt: this.nextAt(),
        loadout: { turns: l.turns, money: l.money, stock: l.stock, psych: l.psych },
        played: this.deps.store.played(day),
        ranked: this.ranked(day).length,
        you: account ? this.youFor(account, day) : null,
      };
    });
  }

  private youFor(account: Account, day: string): DailyChallengeYou {
    const row = this.deps.store.find(day, account.id);
    if (!row) return { status: "available", result: null, place: null, guest: account.guest };
    if (row.status === "playing") {
      return { status: "playing", result: null, place: null, guest: account.guest };
    }
    const place = account.guest ? null : this.placeOf(day, account.id);
    return { status: "finished", result: scoreOf(row), place, guest: account.guest };
  }

  private placeOf(day: string, accountId: number): number | null {
    return this.ranked(day).find((r) => r.accountId === accountId)?.place ?? null;
  }

  /**
   * The ranked board for a day, kept for a few seconds: anyone may ask for it without logging in,
   * and ranking is a sort of every finished run. A run finishing, or an account being deleted
   * (`invalidate`), drops it at once.
   */
  private ranked(day: string): (LeaderboardRow & { accountId: number })[] {
    const now = this.deps.clock.now();
    const cached = this.rankedCache.get(day);
    if (cached && now - cached.at < RANKED_CACHE_MS) return cached.rows;
    const rows = this.rank(day);
    if (this.rankedCache.size >= 8) this.rankedCache.clear();
    this.rankedCache.set(day, { at: now, rows });
    return rows;
  }

  /** Forgets the cached boards (call after anything that removes or changes finished runs). */
  invalidate(): void {
    this.rankedCache.clear();
  }

  private rank(day: string): (LeaderboardRow & { accountId: number })[] {
    const rows = this.deps.store.board(day);
    const byId = new Map(rows.map((r) => [String(r.account_id), r]));
    const results: DailyChallengeResult[] = rows.map((r) => ({
      id: String(r.account_id),
      name: r.name,
      finished: true,
      score: r.score,
      money: r.money,
      sales: r.sales,
      exact: r.exact,
      walkouts: r.walkouts,
    }));
    return rankDailyChallenge(results).flatMap((r) => {
      const row = byId.get(r.id);
      if (!row) return [];
      return [
        {
          accountId: row.account_id,
          place: r.place,
          name: row.name,
          parlor: row.parlor,
          score: row.score,
          money: row.money,
          sales: row.sales,
          exact: row.exact,
          walkouts: row.walkouts,
        },
      ];
    });
  }

  /** `GET /api/daily/leaderboard`. */
  leaderboard(day: string, limit: number, account: Account | null): Promise<LeaderboardResponse> {
    return this.queue.run(() => {
      this.settle();
      const all = this.ranked(day);
      const strip = ({ accountId: _id, ...row }: LeaderboardRow & { accountId: number }) => row;
      const mine = account && !account.guest ? all.find((r) => r.accountId === account.id) : null;
      return {
        day,
        entries: all.slice(0, limit).map(strip),
        total: all.length,
        you: mine ? strip(mine) : null,
      };
    });
  }

  days(limit: number): { day: string; entries: number }[] {
    return this.deps.store.days(limit);
  }

  // ------------------------------------------------------------- playing

  /** Starts today's run for the account, or resumes the one in progress. */
  enter(
    account: Account,
    form?: { name: string; parlor: string; male: boolean },
  ): Promise<DailyEnter> {
    return this.queue.run(() => {
      this.settle(account.id);
      const day = this.today();
      const row = this.deps.store.find(day, account.id);
      if (row?.status === "finished") throw new AlreadyPlayed(scoreOf(row));
      if (row) {
        // Resume: the same run, at the screen it was left on.
        const town = JSON.parse(row.state_json) as TownState;
        const view = town.sessions["0"]?.view;
        if (!view) return this.abandon(row, town);
        this.deps.store.saveState(day, account.id, row.state_json, this.deps.clock.now());
        return { view, day, created: false };
      }
      const entry = form ?? defaultEntry(account.login);
      const ctx = this.ctx();
      const nameMax = ctx.rules.newPlayer.nameMax;
      const nameMin = ctx.rules.newPlayer.nameMin;
      for (const [field, text] of [
        ["name", entry.name],
        ["parlor", entry.parlor],
      ] as const) {
        if (text.length < nameMin || text.length > nameMax) {
          throw new InvalidEntry(
            field,
            `${field === "name" ? "Names" : "Parlor names"} must be ${nameMin} to ${nameMax} characters.`,
          );
        }
      }
      let started: ReturnType<typeof startDailyChallenge>;
      try {
        started = startDailyChallenge(this.challengeFor(day), entry, ctx);
      } catch (error) {
        throw new InvalidEntry(
          "name",
          error instanceof Error ? error.message : "That name or parlor was refused.",
        );
      }
      const now = this.deps.clock.now();
      const json = JSON.stringify(started.town);
      transaction(this.deps.db, () => {
        this.deps.store.insert({
          day,
          account_id: account.id,
          guest: account.guest ? 1 : 0,
          status: "playing",
          abandoned: 0,
          name: entry.name,
          parlor: entry.parlor,
          started_at: now,
          updated_at: now,
          finished_at: null,
          score: 0,
          money: 0,
          sales: 0,
          exact: 0,
          walkouts: 0,
          state_json: json,
        });
        this.deps.audit.append({
          at: now,
          accountId: account.id,
          kind: "daily:start",
          data: { day, guest: account.guest },
        });
      });
      return { view: started.view, day, created: true };
    });
  }

  /** The screen the player's run is on. */
  currentView(account: Account): Promise<View> {
    return this.queue.run(() => {
      this.settle(account.id);
      const row = this.deps.store.find(this.today(), account.id);
      if (!row) throw new NotPlaying("Enter today's challenge first.");
      const view = (JSON.parse(row.state_json) as TownState).sessions["0"]?.view;
      if (!view) throw new AlreadyPlayed(scoreOf(row));
      return view;
    });
  }

  /** One action in the account's run, with the same rules as an action in a town. */
  act(account: Account, action: Action): Promise<DailyAct> {
    return this.queue.run(() => {
      this.settle(account.id);
      const day = this.today();
      const row = this.deps.store.find(day, account.id);
      if (!row) throw new NotPlaying("Enter today's challenge first.");
      const before = JSON.parse(row.state_json) as TownState;
      if (!before.sessions["0"]) throw new AlreadyPlayed(scoreOf(row));
      const r = step(before, 0, action, this.ctx());
      const now = this.deps.clock.now();
      if (r.rejected) {
        this.deps.audit.append({
          at: now,
          accountId: account.id,
          kind: "daily:rejected",
          data: { action, reason: r.rejected },
        });
        return { kind: "rejected", reason: r.rejected, view: r.view } as const;
      }
      const json = JSON.stringify(r.town);
      if (row.status === "finished") {
        // The score is frozen; this is only the player walking out through the finished desk.
        this.deps.store.saveState(day, account.id, json, now);
        return { kind: "ok", view: r.view, result: scoreOf(row) } as const;
      }
      const result = dailyChallengeResult(r.town);
      if (!result.finished) {
        this.deps.store.saveState(day, account.id, json, now);
        return { kind: "ok", view: r.view, result: null } as const;
      }
      const abandoned = (r.town.players[0]?.turns ?? 0) > 0;
      const finished = this.freeze(row, toScore(result), abandoned, json, now);
      return { kind: "ok", view: r.view, result: finished } as const;
    });
  }

  // ------------------------------------------------------------ finishing

  private freeze(
    row: ChallengeRunRow,
    score: ChallengeScore,
    abandoned: boolean,
    stateJson: string,
    at: number,
  ): DailyChallengeScore {
    this.invalidate();
    transaction(this.deps.db, () => {
      this.deps.store.finish(row.day, row.account_id, score, { abandoned, at, stateJson });
      this.deps.audit.append({
        at,
        accountId: row.account_id,
        kind: "daily:finish",
        data: { day: row.day, ...score, abandoned, guest: row.guest === 1 },
      });
    });
    return { ...score, abandoned };
  }

  /** A run nobody is playing any more: the player leaves, and the result stands. */
  private abandon(row: ChallengeRunRow, town: TownState): never {
    const ctx = this.ctx();
    const left = town.sessions["0"] ? leaveGame(town, 0, ctx).town : town;
    const result = dailyChallengeResult(left);
    const done = this.freeze(
      row,
      toScore(result),
      true,
      JSON.stringify(left),
      this.deps.clock.now(),
    );
    throw new AlreadyPlayed(done);
  }

  /**
   * Abandons runs that have sat idle for the idle time-out. Called before every read and write
   * (so the answer is right even if no timer has run) and by the host's periodic sweep.
   */
  private settle(accountId?: number): number {
    const cutoff = this.deps.clock.now() - this.deps.idleTimeoutMs;
    let count = 0;
    for (const row of this.deps.store.stale(cutoff)) {
      if (accountId !== undefined && row.account_id !== accountId) continue;
      try {
        this.abandonQuietly(row);
        count++;
      } catch (error) {
        this.deps.log.error(
          { err: error, day: row.day, accountId: row.account_id },
          "daily abandon failed",
        );
      }
    }
    return count;
  }

  private abandonQuietly(row: ChallengeRunRow): void {
    const town = JSON.parse(row.state_json) as TownState;
    const left = town.sessions["0"] ? leaveGame(town, 0, this.ctx()).town : town;
    const result = dailyChallengeResult(left);
    this.freeze(row, toScore(result), true, JSON.stringify(left), this.deps.clock.now());
  }

  /** The host's periodic sweep. Returns how many runs were abandoned. */
  sweep(): Promise<number> {
    return this.queue.run(() => this.settle());
  }

  close(): Promise<void> {
    return this.queue.drain();
  }
}

function defaultEntry(login: string): { name: string; parlor: string; male: boolean } {
  const name = login.replace(/[^A-Za-z0-9._ -]/g, "").slice(0, 20);
  const padded = name.length >= 3 ? name : `${name}xxx`.slice(0, 3);
  return { name: padded, parlor: `${padded.slice(0, 15)} Rest`, male: true };
}
