import type { Rng } from "./rng.js";

/** White noise in [-1, 1). */
export function white(n: number, rng: Rng): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = rng.bi();
  return out;
}

/** Pink noise (Paul Kellet's economy filter), roughly unit peak. */
export function pink(n: number, rng: Rng): Float32Array {
  const out = new Float32Array(n);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < n; i++) {
    const w = rng.bi();
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    out[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
  }
  return out;
}

/** Brown (red) noise: integrated white noise with a leak, roughly unit peak. */
export function brown(n: number, rng: Rng): Float32Array {
  const out = new Float32Array(n);
  let y = 0;
  for (let i = 0; i < n; i++) {
    y = (y + 0.02 * rng.bi()) * 0.998;
    out[i] = y * 3.5;
  }
  return out;
}

/**
 * Smooth random control signal: a new random target every `stepSec`, cosine-interpolated.
 * Used for wind gusts, flicker, drifting pitch.
 */
export function drift(n: number, sr: number, stepSec: number, rng: Rng): Float32Array {
  const out = new Float32Array(n);
  const step = Math.max(1, Math.round(stepSec * sr));
  let a = rng.next();
  let b = rng.next();
  for (let i = 0; i < n; i++) {
    const k = i % step;
    if (k === 0 && i > 0) {
      a = b;
      b = rng.next();
    }
    const f = (1 - Math.cos((Math.PI * k) / step)) / 2;
    out[i] = a + (b - a) * f;
  }
  return out;
}

/**
 * A periodic version of `drift` with exactly `cycles` random targets over `n` samples; the
 * last target interpolates back to the first, so an ambience loop built on it joins smoothly.
 */
export function loopDrift(n: number, cycles: number, rng: Rng): Float32Array {
  const pts = Array.from({ length: cycles }, () => rng.next());
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / n) * cycles;
    const j = Math.floor(x);
    const f = (1 - Math.cos(Math.PI * (x - j))) / 2;
    const a = pts[j % cycles] as number;
    const b = pts[(j + 1) % cycles] as number;
    out[i] = a + (b - a) * f;
  }
  return out;
}
