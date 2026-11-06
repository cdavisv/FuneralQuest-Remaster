import type { Clock } from "../clock.js";

/**
 * Failed log-ins per login name. The per-IP rate limit stops one address
 * guessing; this stops many addresses guessing at one account. After `max`
 * failures inside `windowMs` the name is locked until the window passes.
 * In memory only: a restart clears it, which is fine for a throttle.
 */
export class LoginThrottle {
  private readonly failures = new Map<string, { count: number; since: number }>();

  constructor(
    private readonly clock: Clock,
    private readonly max = 10,
    private readonly windowMs = 15 * 60_000,
  ) {}

  private key(login: string): string {
    return login.toLowerCase();
  }

  isLocked(login: string): boolean {
    const entry = this.failures.get(this.key(login));
    if (!entry) return false;
    if (this.clock.now() - entry.since >= this.windowMs) {
      this.failures.delete(this.key(login));
      return false;
    }
    return entry.count >= this.max;
  }

  recordFailure(login: string): void {
    const now = this.clock.now();
    const key = this.key(login);
    const entry = this.failures.get(key);
    if (!entry || now - entry.since >= this.windowMs) {
      if (this.failures.size >= 10_000) this.prune(now);
      this.failures.set(key, { count: 1, since: now });
    } else {
      entry.count++;
    }
  }

  recordSuccess(login: string): void {
    this.failures.delete(this.key(login));
  }

  private prune(now: number): void {
    for (const [key, entry] of this.failures) {
      if (now - entry.since >= this.windowMs) this.failures.delete(key);
    }
    if (this.failures.size >= 10_000) this.failures.clear();
  }
}
