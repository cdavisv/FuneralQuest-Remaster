/**
 * The bots' own seeded random source. It is separate from the game's streams
 * (a bot's dice must never move the engine's draws) and never touches
 * `Math.random`. The state is one 32-bit integer, so it survives JSON.
 */
export class BotRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 0x9e3779b9;
  }

  /** Derives a source for one bot's day from the town seed, the player and the day. */
  static forDay(townSeed: number, playerId: number, day: number, salt = 0): BotRandom {
    return new BotRandom(mix(townSeed, playerId, day, salt, 0x0b075eed));
  }

  /** The current state, to save and restore with `new BotRandom(state)`. */
  get position(): number {
    return this.state;
  }

  /** Uniform in [0, 1). mulberry32. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [0, n). */
  int(n: number): number {
    return n <= 0 ? 0 : Math.floor(this.next() * n);
  }

  /** True with probability `p`. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(list: readonly T[]): T | undefined {
    return list.length === 0 ? undefined : list[this.int(list.length)];
  }

  /** A uniform value in [-spread, spread]. */
  jitter(spread: number): number {
    return (this.next() * 2 - 1) * spread;
  }

  /** A copy of `list` in random order (Fisher-Yates). */
  shuffle<T>(list: readonly T[]): T[] {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [out[i], out[j]] = [out[j] as T, out[i] as T];
    }
    return out;
  }
}

/** Mixes integers into a 32-bit seed (murmur3 finaliser per part). */
export function mix(...parts: number[]): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    h ^= part >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return h >>> 0;
}
