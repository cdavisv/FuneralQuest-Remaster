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
