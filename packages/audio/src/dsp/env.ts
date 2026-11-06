/**
 * Envelopes. Every envelope here ends at exactly zero: the last sample of an ADSR or a decay is
 * 0, so a note mixed into a track never leaves a step behind it.
 */

/**
 * Attack, decay, sustain, release over `gateSec` seconds of key-down plus the release.
 * Attack is linear; decay and release are exponential-shaped and land on zero.
 */
export function adsr(
  sr: number,
  gateSec: number,
  a: number,
  d: number,
  s: number,
  r: number,
): Float32Array {
  const gate = Math.max(1, Math.round(gateSec * sr));
  const rel = Math.max(1, Math.round(r * sr));
  const n = gate + rel;
  const out = new Float32Array(n);
  const A = Math.max(1, Math.round(a * sr));
  const D = Math.max(1, d * sr);
  let level = 0;
  for (let i = 0; i < gate; i++) {
    if (i < A) level = i / A;
    else level = s + (1 - s) * Math.exp(-(i - A) / (D / 4));
    out[i] = level;
  }
  // If the gate ended mid-attack, release from wherever the attack got to.
  const from = level;
  for (let i = 0; i < rel; i++) {
    const x = i / rel;
    // exponential shape normalised to reach exactly 0 at the end
    out[gate + i] = from * ((Math.exp(-5 * x) - Math.exp(-5)) / (1 - Math.exp(-5)));
  }
  out[n - 1] = 0;
  return out;
}

/** An exponential decay with a short linear attack, `tau` seconds to fall by 1/e, ending at 0. */
export function decay(sr: number, lengthSec: number, tau: number, attackSec = 0.002): Float32Array {
  const n = Math.max(2, Math.round(lengthSec * sr));
  const out = new Float32Array(n);
  const A = Math.max(1, Math.round(attackSec * sr));
  const k = 1 / (tau * sr);
  const end = Math.exp(-(n - A) * k);
  for (let i = 0; i < n; i++) {
    if (i < A) out[i] = i / A;
    else out[i] = (Math.exp(-(i - A) * k) - end) / (1 - end);
  }
  out[n - 1] = 0;
  return out;
}

/** Piecewise-linear envelope through [timeSec, level] points, zero after the last point. */
export function breakpoints(sr: number, points: readonly [number, number][]): Float32Array {
  const last = points[points.length - 1];
  const n = Math.max(2, Math.round((last ? last[0] : 0) * sr) + 1);
  const out = new Float32Array(n);
  let p = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    while (p < points.length - 2 && t > (points[p + 1] as [number, number])[0]) p++;
    const [t0, v0] = points[p] as [number, number];
    const [t1, v1] = (points[p + 1] ?? points[p]) as [number, number];
    const f = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 1;
    out[i] = v0 + (v1 - v0) * f;
  }
  return out;
}

/** Multiplies `buf` by `env` (shorter of the two lengths; the rest of `buf` is zeroed). */
export function applyEnv(buf: Float32Array, env: Float32Array): void {
  const n = Math.min(buf.length, env.length);
  for (let i = 0; i < n; i++) buf[i] = (buf[i] as number) * (env[i] as number);
  for (let i = n; i < buf.length; i++) buf[i] = 0;
}
