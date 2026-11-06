import { panGains, peak, type Stereo, sin1, stereo } from "../dsp/core.js";
import { Biquad } from "../dsp/filter.js";
import { hashSeed, Rng } from "../dsp/rng.js";

/**
 * Small helpers shared by the effects and the ambience beds: a mono timeline that events are
 * dropped onto (straight for one-shots, circular for loops), filtering a periodic signal so its
 * state at the loop join matches, and the finishing touches every one-shot gets.
 */

export const seeded = (id: string): Rng => new Rng(hashSeed(id));

/** A mono buffer events are added to. `circular` wraps anything past the end onto the start. */
export class Timeline {
  readonly buf: Float32Array;

  constructor(
    readonly sr: number,
    seconds: number,
    readonly circular = false,
  ) {
    this.buf = new Float32Array(Math.max(1, Math.round(seconds * sr)));
  }

  get length(): number {
    return this.buf.length;
  }

  /** Adds `src` starting at `atSec` with gain `g`. */
  add(src: Float32Array, atSec: number, g = 1): void {
    const n = this.buf.length;
    const off = Math.round(atSec * this.sr);
    for (let i = 0; i < src.length; i++) {
      let j = off + i;
      if (this.circular) j = ((j % n) + n) % n;
      else if (j < 0 || j >= n) continue;
      this.buf[j] = (this.buf[j] as number) + (src[i] as number) * g;
    }
  }
}

/**
 * Runs `process` (an in-place filter chain) over a periodic signal so the result is periodic too:
 * the filters are first warmed up on the last `warmSec` of the signal, then run over the whole
 * period, so their state entering sample 0 is the state they leave sample n-1 with.
 */
export function periodicFilter(
  x: Float32Array,
  sr: number,
  process: (buf: Float32Array, startIndex: number) => void,
  warmSec = 1.5,
): Float32Array {
  const n = x.length;
  const warm = Math.min(n, Math.round(warmSec * sr));
  const tmp = new Float32Array(warm + n);
  tmp.set(x.subarray(n - warm), 0);
  tmp.set(x, warm);
  process(tmp, n - warm);
  return tmp.slice(warm);
}

/** White noise that is periodic by construction (any n samples, reused as a loop). */
export function noise(n: number, rng: Rng): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = rng.bi();
  return out;
}

/** Filters a buffer in place through a chain of fresh biquads. */
export function chain(
  buf: Float32Array,
  sr: number,
  stages: [type: "lp" | "hp" | "bp" | "peak" | "notch", freq: number, q?: number, gain?: number][],
): Float32Array {
  for (const [t, f, q, g] of stages) new Biquad(sr, t, f, q ?? Math.SQRT1_2, g ?? 0).run(buf);
  return buf;
}

/** A sine (or a sum of sine partials) with an exponential decay. */
export function ping(
  sr: number,
  freq: number,
  seconds: number,
  tau: number,
  partials: readonly [number, number][] = [[1, 1]],
  sweep = 0,
): Float32Array {
  const n = Math.max(2, Math.round(seconds * sr));
  const out = new Float32Array(n);
  for (const [ratio, amp] of partials) {
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const f = freq * ratio * (1 + sweep * (i / n));
      out[i] = (out[i] as number) + amp * Math.exp(-i / (tau * sr)) * sin1(ph);
      ph += f / sr;
    }
  }
  const a = Math.min(n, Math.round(0.001 * sr));
  for (let i = 0; i < a; i++) out[i] = (out[i] as number) * (i / a);
  const f = Math.min(n, Math.round(0.005 * sr));
  for (let i = 0; i < f; i++) out[n - 1 - i] = (out[n - 1 - i] as number) * (i / f);
  return out;
}

/** Filtered noise burst with attack and exponential decay. */
export function burst(
  sr: number,
  rng: Rng,
  seconds: number,
  tau: number,
  stages: [type: "lp" | "hp" | "bp", freq: number, q?: number][],
  attackSec = 0.0005,
): Float32Array {
  const n = Math.max(2, Math.round(seconds * sr));
  const x = noise(n, rng);
  chain(x, sr, stages);
  const A = Math.max(1, Math.round(attackSec * sr));
  for (let i = 0; i < n; i++) {
    const e = (i < A ? i / A : 1) * Math.exp(-Math.max(0, i - A) / (tau * sr));
    x[i] = (x[i] as number) * e;
  }
  const f = Math.min(n, Math.round(0.004 * sr));
  for (let i = 0; i < f; i++) x[n - 1 - i] = (x[n - 1 - i] as number) * (i / f);
  return x;
}

/**
 * Finishes a one-shot: short fades at both ends (so it starts and stops on silence), peak kept
 * under 0.95, and spread to stereo with a pan and an optional width (a few ms of Haas offset on
 * a decorrelated copy would smear transients, so width is a gentle mid/side mix of two filters).
 */
export function finish(mono: Float32Array, sr: number, pan = 0): Stereo {
  const n = mono.length;
  // no DC, no subsonic drift (plucked strings can leave an offset behind)
  new Biquad(sr, "hp", 25, Math.SQRT1_2).run(mono);
  const fi = Math.min(n, Math.round(0.002 * sr));
  const fo = Math.min(n, Math.round(0.012 * sr));
  for (let i = 0; i < fi; i++) mono[i] = (mono[i] as number) * (i / fi);
  for (let i = 0; i < fo; i++) mono[n - 1 - i] = (mono[n - 1 - i] as number) * (i / fo);
  mono[0] = 0;
  mono[n - 1] = 0;
  const p = peak(mono);
  const g = p > 0.95 ? 0.95 / p : 1;
  const [gl, gr] = panGains(pan);
  const out = stereo(n);
  for (let i = 0; i < n; i++) {
    const s = (mono[i] as number) * g;
    out.l[i] = s * gl * Math.SQRT2;
    out.r[i] = s * gr * Math.SQRT2;
  }
  // equal-power pan at centre is 0.707 per side; the SQRT2 restores unity, then clamp
  const q = Math.max(peak(out.l), peak(out.r));
  if (q > 0.95) {
    for (let i = 0; i < n; i++) {
      out.l[i] = (out.l[i] as number) * (0.95 / q);
      out.r[i] = (out.r[i] as number) * (0.95 / q);
    }
  }
  return out;
}

/** Two mono signals into a stereo pair, keeping the peak under 0.95. */
export function pair(l: Float32Array, r: Float32Array): Stereo {
  const p = Math.max(peak(l), peak(r));
  const g = p > 0.95 ? 0.95 / p : 1;
  const out = { l: l.slice(), r: r.slice() };
  if (g !== 1) {
    for (let i = 0; i < l.length; i++) {
      out.l[i] = (out.l[i] as number) * g;
      out.r[i] = (out.r[i] as number) * g;
    }
  }
  return out;
}

/** Adds b into a (from `at` samples), returns a. */
export function addInto(a: Float32Array, b: Float32Array, g = 1, at = 0): Float32Array {
  for (let i = 0; i < b.length && at + i < a.length; i++) {
    if (at + i >= 0) a[at + i] = (a[at + i] as number) + (b[i] as number) * g;
  }
  return a;
}

/** Scales in place, returns the buffer. */
export function gain(a: Float32Array, g: number): Float32Array {
  for (let i = 0; i < a.length; i++) a[i] = (a[i] as number) * g;
  return a;
}

/** Removes the mean (no DC) from a loop without breaking its periodicity. */
export function zeroMean(a: Float32Array): Float32Array {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] as number;
  const m = s / a.length;
  for (let i = 0; i < a.length; i++) a[i] = (a[i] as number) - m;
  return a;
}
