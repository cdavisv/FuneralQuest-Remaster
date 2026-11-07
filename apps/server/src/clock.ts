/**
 * Time, as the server sees it. Every part of the host takes a `Clock` so tests
 * can drive days, idle time-outs and snapshots without waiting.
 */
export interface Clock {
  /** Milliseconds since the epoch. */
  now(): number;
  /** Runs `fn` after `ms`. The returned function cancels the timer. */
  setTimeout(fn: () => void | Promise<void>, ms: number): () => void;
}

/** Node timers cannot exceed a signed 32-bit delay. */
const MAX_DELAY = 2 ** 31 - 1;

export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }

  setTimeout(fn: () => void | Promise<void>, ms: number): () => void {
    const handle = setTimeout(
      () => {
        void Promise.resolve(fn()).catch(() => undefined);
      },
      Math.min(Math.max(0, ms), MAX_DELAY),
    );
    handle.unref();
    return () => clearTimeout(handle);
  }
}

/**
 * An accelerated clock for soak tests (`FQ_TEST_CLOCK_SPEED`). Game time runs `speed` times
 * faster than real time: at the real instant `anchorReal` it reads `anchorGame`, and every real
 * millisecond after that is `speed` game milliseconds. Time is a pure function of the real clock,
 * so a server killed and started again with the same three numbers carries on where it was, and
 * the time it was down passes in game time too (missed midnights run at start-up, as they would
 * after a real outage). Timers fire after their delay divided by `speed`. `loadConfig` refuses it
 * when `NODE_ENV` is `production`.
 */
export class ScaledClock implements Clock {
  constructor(
    readonly speed: number,
    readonly anchorReal: number,
    readonly anchorGame: number,
  ) {
    if (!(speed >= 1)) throw new Error("ScaledClock speed must be at least 1");
  }

  now(): number {
    return Math.floor(this.anchorGame + (Date.now() - this.anchorReal) * this.speed);
  }

  setTimeout(fn: () => void | Promise<void>, ms: number): () => void {
    // Round up and add one so the game time has passed the target when the timer runs.
    const real = Math.ceil(Math.max(0, ms) / this.speed) + 1;
    const handle = setTimeout(
      () => {
        void Promise.resolve(fn()).catch(() => undefined);
      },
      Math.min(real, MAX_DELAY),
    );
    handle.unref();
    return () => clearTimeout(handle);
  }
}

/** The clock a server built from configuration uses: the system clock, or the soak-test one. */
export function clockFromConfig(config: {
  testClockSpeed: number;
  testClockStart: string;
  testClockAnchor: number;
}): Clock {
  if (config.testClockSpeed <= 1 && config.testClockStart === "") return new SystemClock();
  const anchorReal = config.testClockAnchor > 0 ? config.testClockAnchor : Date.now();
  const start = config.testClockStart === "" ? anchorReal : parseClockStart(config.testClockStart);
  return new ScaledClock(config.testClockSpeed, anchorReal, start);
}

/** `FQ_TEST_CLOCK_START`: an ISO date-time or epoch milliseconds. */
export function parseClockStart(text: string): number {
  const t = /^\d+$/.test(text) ? Number(text) : Date.parse(text);
  if (!Number.isFinite(t)) throw new Error(`FQ_TEST_CLOCK_START: not a time: ${text}`);
  return t;
}

interface FakeTimer {
  id: number;
  at: number;
  fn: () => void | Promise<void>;
}

/**
 * A clock tests control. `advance` moves time forward, running every timer
 * that falls due in order (each at its own due time) and awaiting async ones.
 */
export class FakeClock implements Clock {
  private time: number;
  private nextId = 1;
  private timers: FakeTimer[] = [];

  constructor(start = Date.UTC(2030, 0, 1, 12, 0, 0)) {
    this.time = start;
  }

  now(): number {
    return this.time;
  }

  setTimeout(fn: () => void | Promise<void>, ms: number): () => void {
    const timer: FakeTimer = { id: this.nextId++, at: this.time + Math.max(0, ms), fn };
    this.timers.push(timer);
    return () => {
      this.timers = this.timers.filter((t) => t.id !== timer.id);
    };
  }

  /** Number of timers waiting. */
  get pending(): number {
    return this.timers.length;
  }

  /** Moves time forward by `ms`, firing due timers in order. */
  async advance(ms: number): Promise<void> {
    await this.advanceTo(this.time + ms);
  }

  async advanceTo(target: number): Promise<void> {
    for (;;) {
      const due = this.timers
        .filter((t) => t.at <= target)
        .sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (!due) break;
      this.timers = this.timers.filter((t) => t.id !== due.id);
      this.time = Math.max(this.time, due.at);
      await due.fn();
    }
    this.time = Math.max(this.time, target);
  }

  /** Jumps without firing timers (to simulate the server being down). */
  jump(ms: number): void {
    this.time += ms;
  }
}
