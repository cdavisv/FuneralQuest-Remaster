import type { ActivityStore } from "../db/stores.js";

/**
 * Who comes back. The server keeps one row per account, town and UTC day on which the account
 * played an accepted action there (`activity_days`); this file writes it cheaply and turns it into
 * the figures of `GET /admin/stats`. The arithmetic is pure: rows in, numbers out.
 */

const DAY_MS = 86_400_000;

/** The UTC calendar day of an instant, as `YYYY-MM-DD`. */
export function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Days since 1970-01-01 of a `YYYY-MM-DD` day. */
export function dayNumber(day: string): number {
  return Math.floor(Date.parse(`${day}T00:00:00Z`) / DAY_MS);
}

/** The `YYYY-MM-DD` day `n` days after `day` (negative for before). */
export function addDays(day: string, n: number): string {
  return utcDay((dayNumber(day) + n) * DAY_MS);
}

/**
 * Writes the activity record from the path every accepted action passes through. The first action
 * of an account in a town on a day does one `INSERT OR IGNORE`; every later one that day is a set
 * lookup. The set holds only the current day and is emptied when the day changes.
 */
export class ActivityRecorder {
  private day = "";
  private seen = new Set<string>();

  constructor(
    private readonly store: ActivityStore,
    private readonly now: () => number,
  ) {}

  record(accountId: number, townId: string): void {
    const day = utcDay(this.now());
    if (day !== this.day) {
      this.day = day;
      this.seen = new Set();
    }
    const key = `${accountId}\u0000${townId}`;
    if (this.seen.has(key)) return;
    this.store.record(accountId, townId, day);
    this.seen.add(key);
  }

  /** After an account is deleted: its id may be reused, so it must not count as already seen. */
  forget(accountId: number): void {
    const prefix = `${accountId}\u0000`;
    for (const key of this.seen) if (key.startsWith(prefix)) this.seen.delete(key);
  }

  /** After accounts went in bulk (the guest purge): start the day's set again. */
  reset(): void {
    this.seen = new Set();
  }
}

// ------------------------------------------------------------- arithmetic

/** The return horizons reported for every first-play cohort. */
export const RETURN_DAYS = [1, 3, 7, 14, 30] as const;
export type ReturnRates = Record<`day${(typeof RETURN_DAYS)[number]}`, number | null>;

export interface DailyStats {
  day: string;
  /** Accounts whose first recorded play was this day (the cohort's size). */
  newAccounts: number;
  /** Accounts that played this day. */
  activeAccounts: number;
  /**
   * Share of this day's cohort that played again exactly N days later. Null while day N has not
   * ended yet, or when the cohort is empty.
   */
  returnedExactlyOnDay: ReturnRates;
  /** Share of the cohort that played again on day N or any day after it. Null on the same terms. */
  returnedOnOrAfterDay: ReturnRates;
}

export interface OverallStats {
  /** Accounts with at least one recorded day. */
  accounts: number;
  /** Median number of distinct days played per account; null with no accounts. */
  medianDaysPlayed: number | null;
  /** Accounts that played in the last 1, 7 and 30 days, today included. */
  activeLast1Days: number;
  activeLast7Days: number;
  activeLast30Days: number;
}

export interface ActivityStats {
  today: string;
  days: number;
  overall: OverallStats;
  /** One entry per day of the window, newest first. */
  daily: DailyStats[];
}

const round = (x: number) => Math.round(x * 10_000) / 10_000;

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 === 1
    ? (s[mid] as number)
    : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

/**
 * The stats for the `days` days ending with `today`, from (account, day) pairs (duplicates are
 * fine). An account's cohort is its first recorded day, so after retention has pruned old rows a
 * long-standing account looks new; keep `FQ_ACTIVITY_RETENTION_DAYS` well above the window.
 *
 * A day-N figure exists only once day N is over: for the cohort of `d`, `d + N` must be before
 * `today` (today is still being played, so its count can only grow).
 */
export function computeActivityStats(
  rows: readonly { accountId: number; day: string }[],
  today: string,
  days: number,
): ActivityStats {
  const todayN = dayNumber(today);
  const byAccount = new Map<number, Set<number>>();
  for (const r of rows) {
    let set = byAccount.get(r.accountId);
    if (!set) {
      set = new Set();
      byAccount.set(r.accountId, set);
    }
    set.add(dayNumber(r.day));
  }

  const firstDay = new Map<number, number>();
  const activeOn = new Map<number, number>();
  const cohorts = new Map<number, number[]>();
  for (const [account, set] of byAccount) {
    let first = Number.POSITIVE_INFINITY;
    for (const d of set) {
      if (d < first) first = d;
      activeOn.set(d, (activeOn.get(d) ?? 0) + 1);
    }
    firstDay.set(account, first);
    const list = cohorts.get(first) ?? [];
    list.push(account);
    cohorts.set(first, list);
  }

  const activeSince = (n: number) => {
    let count = 0;
    for (const set of byAccount.values()) {
      for (const d of set) {
        if (d > todayN - n && d <= todayN) {
          count++;
          break;
        }
      }
    }
    return count;
  };

  const daily: DailyStats[] = [];
  for (let i = 0; i < days; i++) {
    const d = todayN - i;
    const cohort = cohorts.get(d) ?? [];
    const exactly = {} as ReturnRates;
    const onOrAfter = {} as ReturnRates;
    for (const n of RETURN_DAYS) {
      const key = `day${n}` as const;
      if (cohort.length === 0 || d + n >= todayN) {
        exactly[key] = null;
        onOrAfter[key] = null;
        continue;
      }
      let on = 0;
      let after = 0;
      for (const account of cohort) {
        const set = byAccount.get(account) as Set<number>;
        if (set.has(d + n)) on++;
        for (const x of set) {
          if (x >= d + n) {
            after++;
            break;
          }
        }
      }
      exactly[key] = round(on / cohort.length);
      onOrAfter[key] = round(after / cohort.length);
    }
    daily.push({
      day: utcDay(d * DAY_MS),
      newAccounts: cohort.length,
      activeAccounts: activeOn.get(d) ?? 0,
      returnedExactlyOnDay: exactly,
      returnedOnOrAfterDay: onOrAfter,
    });
  }

  return {
    today,
    days,
    overall: {
      accounts: byAccount.size,
      medianDaysPlayed: median([...byAccount.values()].map((s) => s.size)),
      activeLast1Days: activeSince(1),
      activeLast7Days: activeSince(7),
      activeLast30Days: activeSince(30),
    },
    daily,
  };
}
