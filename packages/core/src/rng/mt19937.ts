const N = 624;
const M = 397;
const MATRIX_A = 0x9908b0df;
const UPPER_MASK = 0x80000000;
const LOWER_MASK = 0x7fffffff;

/** The seed the original falls back to when the generator was never seeded. */
export const MT_DEFAULT_SEED = 4357;

/**
 * Port of `CRandom` (legacy/source/shared/CRandom.cpp): MT19937 with the 1998
 * `sgenrand` seeding (Knuth's 69069 multiplier), not the 2002 `init_genrand`.
 * Seeding and output must stay bit-identical to the original for parity tests.
 */
export class Mt19937 {
  private readonly mt = new Uint32Array(N);
  private mti = N;
  /** Raw outputs drawn since the last seed; lets a caller store and restore a stream position. */
  draws = 0;

  constructor(seed: number = MT_DEFAULT_SEED) {
    this.seed(seed);
  }

  seed(seed: number): void {
    this.mt[0] = seed >>> 0;
    for (let i = 1; i < N; i++) {
      this.mt[i] = Math.imul(69069, this.mt[i - 1] as number) >>> 0;
    }
    this.mti = N;
    this.draws = 0;
  }

  /** Next raw 32-bit output. */
  nextUint32(): number {
    this.draws++;
    const mt = this.mt;
    if (this.mti >= N) {
      let kk = 0;
      for (; kk < N - M; kk++) {
        const y = ((mt[kk] as number) & UPPER_MASK) | ((mt[kk + 1] as number) & LOWER_MASK);
        mt[kk] = (mt[kk + M] as number) ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0);
      }
      for (; kk < N - 1; kk++) {
        const y = ((mt[kk] as number) & UPPER_MASK) | ((mt[kk + 1] as number) & LOWER_MASK);
        mt[kk] = (mt[kk + (M - N)] as number) ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0);
      }
      const y = ((mt[N - 1] as number) & UPPER_MASK) | ((mt[0] as number) & LOWER_MASK);
      mt[N - 1] = (mt[M - 1] as number) ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0);
      this.mti = 0;
    }

    let y = mt[this.mti++] as number;
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return y >>> 0;
  }

  /**
   * `CRandom::Random(n)`: an integer in [0, n). Like the original, n === 0
   * returns 0 without consuming a draw, and the result is a plain modulo.
   */
  random(n: number): number {
    const bound = n >>> 0;
    if (bound === 0) return 0;
    return this.nextUint32() % bound;
  }
}
