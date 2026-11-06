import { type Stereo, softClip, stereo, TAU } from "./core.js";

/**
 * A stereo reverb in the Schroeder-Moorer family (the Freeverb layout: eight damped combs and
 * four allpasses per side, the right side's delays spread a little longer). Room size and damping
 * shape a small parlor, a chapel or a cathedral.
 */
export interface ReverbOptions {
  /** 0 to 1: comb feedback 0.7 to 0.98. */
  size: number;
  /** 0 to 1: high-frequency damping in the combs. */
  damp: number;
  /** Pre-delay in seconds. */
  pre?: number;
  /** Stereo width 0 to 1. */
  width?: number;
  /** Low cut on the reverb input, Hz (keeps the bass dry). */
  lowCut?: number;
}

const COMBS = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const ALLPASSES = [556, 441, 341, 225];
const SPREAD = 23;

function reverbChannel(input: Float32Array, sr: number, o: ReverbOptions, spread: number) {
  const k = sr / 44100;
  const n = input.length;
  const out = new Float32Array(n);
  const fb = 0.7 + 0.28 * o.size;
  const damp = 0.05 + 0.6 * o.damp;
  for (const c of COMBS) {
    const len = Math.max(1, Math.round((c + spread) * k));
    const line = new Float32Array(len);
    let idx = 0;
    let store = 0;
    for (let i = 0; i < n; i++) {
      const y = line[idx] as number;
      store = y * (1 - damp) + store * damp;
      line[idx] = (input[i] as number) + store * fb;
      out[i] = (out[i] as number) + y;
      idx = idx + 1 === len ? 0 : idx + 1;
    }
  }
  for (const a of ALLPASSES) {
    const len = Math.max(1, Math.round((a + spread) * k));
    const line = new Float32Array(len);
    let idx = 0;
    for (let i = 0; i < n; i++) {
      const b = line[idx] as number;
      const x = out[i] as number;
      line[idx] = x + b * 0.5;
      out[i] = b - x;
      idx = idx + 1 === len ? 0 : idx + 1;
    }
  }
  return out;
}

/** Returns the wet signal only (the caller mixes it with the dry). */
export function reverb(input: Stereo, sr: number, o: ReverbOptions): Stereo {
  const n = input.l.length;
  const pre = Math.round((o.pre ?? 0.01) * sr);
  const mono = new Float32Array(n);
  // Feed a high-passed mono sum, like a send from a mixing desk.
  const hpA = Math.exp((-TAU * (o.lowCut ?? 180)) / sr);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const j = i - pre;
    const x = j >= 0 ? ((input.l[j] as number) + (input.r[j] as number)) * 0.5 : 0;
    lp = x + hpA * (lp - x);
    mono[i] = (x - lp) * 0.03;
  }
  const L = reverbChannel(mono, sr, o, 0);
  const R = reverbChannel(mono, sr, o, SPREAD);
  const w = o.width ?? 1;
  const out = stereo(n);
  const wet1 = 0.5 + w / 2;
  const wet2 = (1 - w) / 2;
  for (let i = 0; i < n; i++) {
    const l = L[i] as number;
    const r = R[i] as number;
    out.l[i] = l * wet1 + r * wet2;
    out.r[i] = r * wet1 + l * wet2;
  }
  return out;
}

/** A feedback delay (ping-pong when `pingPong`), wet only, with a low-pass in the loop. */
export function delay(
  input: Stereo,
  sr: number,
  timeSec: number,
  feedback: number,
  pingPong = true,
  tone = 3500,
): Stereo {
  const n = input.l.length;
  const d = Math.max(1, Math.round(timeSec * sr));
  const out = stereo(n);
  const a = Math.exp((-TAU * tone) / sr);
  let fl = 0;
  let fr = 0;
  for (let i = 0; i < n; i++) {
    const il = i >= d ? (input.l[i - d] as number) : 0;
    const ir = i >= d ? (input.r[i - d] as number) : 0;
    const ol = i >= d ? (out.l[i - d] as number) : 0;
    const or = i >= d ? (out.r[i - d] as number) : 0;
    const xl = il + (pingPong ? or : ol) * feedback;
    const xr = ir + (pingPong ? ol : or) * feedback;
    fl = xl + a * (fl - xl);
    fr = xr + a * (fr - xr);
    out.l[i] = fl;
    out.r[i] = fr;
  }
  return out;
}

/** Amplitude tremolo in place: depth 0 to 1 at `rate` Hz. */
export function tremolo(buf: Float32Array, sr: number, rate: number, depth: number, phase = 0) {
  for (let i = 0; i < buf.length; i++) {
    const m = 1 - depth * 0.5 * (1 + Math.sin(TAU * (rate * (i / sr)) + phase));
    buf[i] = (buf[i] as number) * m;
  }
}

/** Saturation in place: drive then soft clip, level-compensated. */
export function saturate(buf: Float32Array, drive: number): void {
  const comp = 1 / softClip(drive);
  for (let i = 0; i < buf.length; i++) buf[i] = softClip((buf[i] as number) * drive) * comp;
}

/**
 * The gain envelope of a look-ahead peak limiter for a stereo buffer: multiply by it and no
 * sample exceeds `ceiling` (within about 2 %). `circular` treats the buffer as a loop: the
 * envelope is warmed up on the buffer's end and the look-ahead wraps, so the join stays seamless.
 * Several stems can share one envelope computed from their sum.
 */
export function limiterGain(
  buf: Stereo,
  sr: number,
  ceiling: number,
  circular: boolean,
  lookSec = 0.004,
  releaseSec = 0.12,
): Float32Array {
  const n = buf.l.length;
  const gain = new Float32Array(n);
  if (n === 0) return gain;
  const look = Math.max(1, Math.round(lookSec * sr));
  const rel = Math.exp(-1 / (releaseSec * sr));
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = Math.max(Math.abs(buf.l[i] as number), Math.abs(buf.r[i] as number));
    need[i] = p > ceiling ? ceiling / p : 1;
  }
  // Minimum over the look-ahead window [i, i + look], with a monotonic deque (O(n)).
  const at = (i: number) => (circular ? (need[i % n] as number) : i < n ? (need[i] as number) : 1);
  const target = new Float32Array(n);
  const dq = new Int32Array(n + look + 2);
  let head = 0;
  let tail = 0;
  for (let j = 0; j < n + look; j++) {
    const v = at(j);
    while (tail > head && at(dq[tail - 1] as number) >= v) tail--;
    dq[tail++] = j;
    const i = j - look;
    if (i >= 0) {
      while ((dq[head] as number) < i) head++;
      target[i] = at(dq[head] as number);
    }
  }
  // The gain falls over the look-ahead (so it is down before the peak arrives) and recovers
  // with an exponential release.
  const att = Math.exp(-5 / look);
  let g = 1;
  const step = (t: number) => {
    g = t < g ? t + att * (g - t) : t + rel * (g - t);
  };
  if (circular) for (let i = Math.max(0, n - Math.round(sr)); i < n; i++) step(target[i] as number);
  for (let i = 0; i < n; i++) {
    step(target[i] as number);
    gain[i] = g;
  }
  return gain;
}

export function applyGain(buf: Stereo, gain: Float32Array): void {
  for (let i = 0; i < buf.l.length; i++) {
    const g = gain[i] as number;
    buf.l[i] = (buf.l[i] as number) * g;
    buf.r[i] = (buf.r[i] as number) * g;
  }
}

/** Limits a buffer in place, with a final clamp at the ceiling. */
export function limit(buf: Stereo, sr: number, ceiling: number, circular: boolean): void {
  applyGain(buf, limiterGain(buf, sr, ceiling, circular));
  for (const ch of [buf.l, buf.r]) {
    for (let i = 0; i < ch.length; i++) {
      const x = ch[i] as number;
      ch[i] = x > ceiling ? ceiling : Math.max(x, -ceiling);
    }
  }
}
