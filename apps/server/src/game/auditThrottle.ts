/**
 * Keeps one player from filling the audit log with rejected actions. An account may send a
 * hundred or more actions a minute that the engine refuses ("button not offered"), and the log
 * writes a row for each; guest accounts are free, so that adds up to gigabytes. The first
 * `perWindow` rejections of each window are logged as they are, the rest are only counted, and
 * the count is written as a single row when the window turns over.
 */
export class RejectedActionThrottle {
  private readonly players = new Map<number, { start: number; logged: number; dropped: number }>();

  constructor(
    private readonly perWindow = 20,
    private readonly windowMs = 60_000,
    private readonly maxPlayers = 5000,
  ) {}

  /**
   * Whether this rejection should be logged now. `settled` is called with the number dropped in
   * the window that just ended, if any, so the caller can write one summary row for them.
   */
  allow(playerId: number, now: number, settled: (dropped: number) => void): boolean {
    let entry = this.players.get(playerId);
    if (entry && now - entry.start >= this.windowMs) {
      if (entry.dropped > 0) settled(entry.dropped);
      entry = undefined;
    }
    if (!entry) {
      if (this.players.size >= this.maxPlayers) this.players.clear();
      entry = { start: now, logged: 0, dropped: 0 };
      this.players.set(playerId, entry);
    }
    if (entry.logged < this.perWindow) {
      entry.logged++;
      return true;
    }
    entry.dropped++;
    return false;
  }
}
