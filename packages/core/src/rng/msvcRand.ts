export const MSVC_RAND_MAX = 0x7fff;

/**
 * Port of the Microsoft C runtime `srand` / `rand` pair, which the original
 * server uses for every float roll (`frandom`, `frandom_range`).
 */
export class MsvcRand {
  private state: number;
  /** Outputs drawn since the last seed; lets a caller store and restore a stream position. */
  draws = 0;

  constructor(seed = 1) {
    this.state = seed >>> 0;
  }

  seed(seed: number): void {
    this.state = seed >>> 0;
    this.draws = 0;
  }

  /** `rand()`: an integer in [0, 32767]. */
  next(): number {
    this.draws++;
    this.state = (Math.imul(this.state, 214013) + 2531011) >>> 0;
    return (this.state >>> 16) & MSVC_RAND_MAX;
  }
}
