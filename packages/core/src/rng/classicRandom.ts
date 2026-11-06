import { MSVC_RAND_MAX, MsvcRand } from "./msvcRand.js";
import { Mt19937 } from "./mt19937.js";

const f32 = Math.fround;

/**
 * The original server's random helpers (legacy/source/shared/all.cpp:888-929,
 * legacy/source/funeral_util.cpp:77-83). Integer rolls come from the Mersenne
 * Twister; float rolls come from the C runtime `rand()`. Handlers must call
 * these in the same order as the original to reproduce its behaviour.
 */
export class ClassicRandom {
  readonly mt: Mt19937;
  readonly crt: MsvcRand;

  constructor(mtSeed: number, crtSeed: number = mtSeed) {
    this.mt = new Mt19937(mtSeed);
    this.crt = new MsvcRand(crtSeed);
  }

  /** `random(n)`: integer in [0, n). */
  random(n: number): number {
    return this.mt.random(n);
  }

  /** `random_range(small, large)`: integer in [small, large], both inclusive. */
  randomRange(small: number, large: number): number {
    if (large === small) return small;
    return this.mt.random(large + 1 - small) + small;
  }

  /** `frandom_range(min, max)`: 32-bit float in [min, max]. */
  frandomRange(min: number, max: number): number {
    const unit = f32(f32(this.crt.next()) / f32(MSVC_RAND_MAX));
    return f32(f32(unit * f32(max - min)) + f32(min));
  }

  /** `frandom(max)`: 32-bit float in [0, max]. */
  frandom(max: number): number {
    return this.frandomRange(0, max);
  }

  /**
   * `get_random_yes_no(luck, weight)`: a luck check. `weight` pulls the
   * effective luck toward 50; at weight 1 the raw luck value is used.
   */
  randomYesNo(luck: number, weight: number): boolean {
    const roll = this.random(100);
    const adjusted = luck + Math.trunc(f32(f32(50 - luck) * f32(f32(1) - f32(weight))));
    return roll <= adjusted;
  }
}
