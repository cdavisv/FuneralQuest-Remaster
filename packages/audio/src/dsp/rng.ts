/**
 * A seeded random source (mulberry32). Every random choice in a render (noise, humanised
 * timing, the scatter of rain drops) draws from one of these, so a seed always gives the same
 * samples on every machine.
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0 || 0x9e3779b9;
  }

  /** Uniform in [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform in [-1, 1). */
  bi(): number {
    return this.next() * 2 - 1;
  }

  range(lo: number, hi: number): number {
    return lo + (hi - lo) * this.next();
  }

  int(lo: number, hiInclusive: number): number {
    return lo + Math.floor(this.next() * (hiInclusive - lo + 1));
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)] as T;
  }

  /** Roughly normal, mean 0, deviation 1 (sum of four uniforms). */
  gauss(): number {
    return (this.next() + this.next() + this.next() + this.next() - 2) * 1.732;
  }

  /** A child generator, so adding draws in one place does not shift another. */
  fork(salt: number): Rng {
    return new Rng((Math.imul(this.s ^ salt, 0x85ebca6b) ^ (salt * 0x27d4eb2f)) >>> 0);
  }
}

/** A stable 32-bit hash of a string, for seeding a render by its id. */
export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
