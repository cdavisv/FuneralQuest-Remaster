/**
 * When a town's days begin.
 *
 * A normal town starts a new day at local midnight in its time zone (the
 * original used the server's local time). A Blitz town has a fixed day length
 * counted from the moment it was created. A `DaySchedule` answers two
 * questions: which boundary began the day that contains time `t`, and which
 * comes next. Missed boundaries are counted so maintenance can catch up.
 */
export interface DaySchedule {
  /** The latest boundary at or before `t`. */
  currentBoundary(t: number): number;
  /** The first boundary strictly after `t`. */
  nextBoundary(t: number): number;
  /** Boundaries `b` with `from < b <= to`. */
  countBetween(from: number, to: number, cap: number): number;
}

export interface ScheduleConfig {
  timeZone: string;
  /** Null for midnight-to-midnight days. */
  dayLengthMs: number | null;
  /** Start of the first Blitz day. */
  epoch: number;
}

export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export function createSchedule(config: ScheduleConfig): DaySchedule {
  return config.dayLengthMs === null
    ? new MidnightSchedule(config.timeZone)
    : new FixedLengthSchedule(config.dayLengthMs, config.epoch);
}

class FixedLengthSchedule implements DaySchedule {
  constructor(
    private readonly length: number,
    private readonly epoch: number,
  ) {}

  currentBoundary(t: number): number {
    return this.epoch + Math.floor((t - this.epoch) / this.length) * this.length;
  }

  nextBoundary(t: number): number {
    return this.currentBoundary(t) + this.length;
  }

  countBetween(from: number, to: number, cap: number): number {
    if (to <= from) return 0;
    const n =
      Math.floor((to - this.epoch) / this.length) - Math.floor((from - this.epoch) / this.length);
    return Math.max(0, Math.min(n, cap));
  }
}

class MidnightSchedule implements DaySchedule {
  private readonly format: Intl.DateTimeFormat;

  constructor(timeZone: string) {
    this.format = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

  /** The local calendar date of `t` as a sortable number, YYYYMMDD. */
  private dateKey(t: number): number {
    let y = 0;
    let m = 0;
    let d = 0;
    for (const part of this.format.formatToParts(new Date(t))) {
      if (part.type === "year") y = Number(part.value);
      else if (part.type === "month") m = Number(part.value);
      else if (part.type === "day") d = Number(part.value);
    }
    return y * 10_000 + m * 100 + d;
  }

  currentBoundary(t: number): number {
    // The local day containing t is a contiguous span, at most 25 hours long
    // (a DST change). Binary-search its first millisecond.
    const key = this.dateKey(t);
    let lo = t - 26 * 3_600_000;
    let hi = t;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (this.dateKey(mid) === key) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  }

  nextBoundary(t: number): number {
    // 30 hours after a day starts is always inside the next day.
    return this.currentBoundary(this.currentBoundary(t) + 30 * 3_600_000);
  }

  countBetween(from: number, to: number, cap: number): number {
    let count = 0;
    let b = this.nextBoundary(from);
    while (b <= to && count < cap) {
      count++;
      b = this.nextBoundary(b);
    }
    return count;
  }
}
