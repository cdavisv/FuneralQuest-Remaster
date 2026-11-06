import { ClassicRandom } from "./classicRandom.js";
import { MT_DEFAULT_SEED } from "./mt19937.js";

/**
 * Where a seeded stream stands. The remaster gives every player one stream per
 * game day (and the town one for maintenance), derived from the town seed, so
 * a day can be replayed exactly. The position is stored as draw counts, which
 * survive JSON round trips; restoring re-seeds and skips that many draws.
 */
export interface StreamPosition {
  day: number;
  /** Raw Mersenne Twister outputs consumed (integer rolls). */
  mt: number;
  /** MSVC `rand()` outputs consumed (float rolls). */
  crt: number;
}

/** Stream key for the town's own draws (daily maintenance). Players use their id. */
export const TOWN_STREAM = -1;

function fmix32(input: number): number {
  let h = input >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Mixes integers into a 32-bit seed. Never returns 0, which would freeze the 1998 MT seeding. */
export function deriveSeed(salt: number, ...parts: number[]): number {
  let h = fmix32(salt);
  for (const part of parts) {
    h = fmix32((h ^ (part >>> 0)) + 0x9e3779b9);
  }
  return h === 0 ? MT_DEFAULT_SEED : h;
}

const MT_SALT = 0x46510001;
const CRT_SALT = 0x46510002;

/** Opens the stream for `key` on `day`, advanced to `position` when it belongs to the same day. */
export function openStream(
  townSeed: number,
  key: number,
  day: number,
  position?: StreamPosition,
): ClassicRandom {
  const rng = new ClassicRandom(
    deriveSeed(MT_SALT, townSeed, key, day),
    deriveSeed(CRT_SALT, townSeed, key, day),
  );
  if (position && position.day === day) {
    for (let i = 0; i < position.mt; i++) rng.mt.nextUint32();
    for (let i = 0; i < position.crt; i++) rng.crt.next();
  }
  return rng;
}

export function positionOf(rng: ClassicRandom, day: number): StreamPosition {
  return { day, mt: rng.mt.draws, crt: rng.crt.draws };
}
