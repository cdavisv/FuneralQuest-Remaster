import { sin1 } from "../dsp/core.js";
import { decay } from "../dsp/env.js";
import { Biquad } from "../dsp/filter.js";
import type { Rng } from "../dsp/rng.js";
import type { Voice } from "./types.js";

/**
 * Drums and struck wood. Pitch-less voices ignore `freq` except where it tunes a drum (toms,
 * timpani, woodblocks), so a score can write any pitch for them.
 */

/** Sum of damped modes: [ratio, level, decay seconds]. */
export function modal(
  sr: number,
  f0: number,
  modes: readonly [number, number, number][],
  lengthSec: number,
  rng: Rng,
  bendDown = 0,
): Float32Array {
  const n = Math.max(2, Math.round(lengthSec * sr));
  const out = new Float32Array(n);
  for (const [ratio, amp, tau] of modes) {
    const f = f0 * ratio;
    if (f > sr * 0.45) continue;
    const k = 1 / (tau * sr);
    let ph = rng.next();
    for (let i = 0; i < n; i++) {
      const bend = bendDown > 0 ? 1 + bendDown * Math.exp(-i / (0.04 * sr)) : 1;
      out[i] = (out[i] as number) + amp * Math.exp(-i * k) * sin1(ph);
      ph += (f * bend) / sr;
    }
  }
  // a couple of samples of attack ramp and an exact zero at the end
  const a = Math.min(n, Math.round(0.0008 * sr));
  for (let i = 0; i < a; i++) out[i] = (out[i] as number) * (i / a);
  const fade = Math.min(n, Math.round(0.01 * sr));
  for (let i = 0; i < fade; i++) out[n - 1 - i] = (out[n - 1 - i] as number) * (i / fade);
  return out;
}

/** Filtered noise with a decay envelope. */
export function noiseHit(
  sr: number,
  rng: Rng,
  lengthSec: number,
  tau: number,
  type: "lp" | "hp" | "bp",
  freq: number,
  q = 0.7,
  attackSec = 0.0005,
): Float32Array {
  const env = decay(sr, lengthSec, tau, attackSec);
  const f = new Biquad(sr, type, freq, q);
  for (let i = 0; i < env.length; i++) env[i] = f.tick(rng.bi()) * (env[i] as number);
  return env;
}

const add = (a: Float32Array, b: Float32Array, g: number) => {
  for (let i = 0; i < Math.min(a.length, b.length); i++)
    a[i] = (a[i] as number) + (b[i] as number) * g;
  return a;
};

export const kick: Voice = (sr, note, rng) => {
  const len = 0.45;
  const n = Math.round(len * sr);
  const out = new Float32Array(n);
  let ph = 0;
  const env = decay(sr, len, 0.12, 0.001);
  for (let i = 0; i < n; i++) {
    const f = 48 + 70 * Math.exp(-i / (0.03 * sr));
    ph += f / sr;
    out[i] = sin1(ph) * (env[i] as number);
  }
  add(out, noiseHit(sr, rng, 0.02, 0.004, "lp", 3000), 0.3);
  for (let i = 0; i < n; i++) out[i] = (out[i] as number) * 0.9 * note.vel;
  return out;
};

/** A brush tap on the snare: soft noise with a hint of the shell. */
export const brushTap: Voice = (sr, note, rng) => {
  const out = noiseHit(sr, rng, 0.22, 0.06, "bp", 3200, 0.5, 0.003);
  add(
    out,
    modal(
      sr,
      185,
      [
        [1, 1, 0.05],
        [1.6, 0.4, 0.03],
      ],
      0.2,
      rng,
    ),
    0.12,
  );
  for (let i = 0; i < out.length; i++) out[i] = (out[i] as number) * 0.8 * note.vel;
  return out;
};

/** A brush sweep: a swish that swells and fades over the note's length. */
export const brushSweep: Voice = (sr, note, rng) => {
  const n = Math.round(Math.max(0.1, note.dur) * sr);
  const out = new Float32Array(n);
  const bp = new Biquad(sr, "bp", 4500, 0.6);
  for (let i = 0; i < n; i++) {
    const x = i / n;
    out[i] = bp.tick(rng.bi()) * Math.sin(Math.PI * x) ** 1.5 * 0.35 * note.vel;
  }
  out[n - 1] = 0;
  return out;
};

/** Marching snare: crisp wires over a tight shell. */
export const snare: Voice = (sr, note, rng) => {
  const out = noiseHit(sr, rng, 0.3, 0.07, "hp", 1800, 0.7);
  add(
    out,
    modal(
      sr,
      190,
      [
        [1, 1, 0.06],
        [1.74, 0.6, 0.04],
      ],
      0.3,
      rng,
      0.2,
    ),
    0.5,
  );
  for (let i = 0; i < out.length; i++) out[i] = (out[i] as number) * 0.5 * note.vel;
  return out;
};

const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800];

function metallic(sr: number, rng: Rng, lengthSec: number, tau: number, hp: number): Float32Array {
  const n = Math.round(lengthSec * sr);
  const out = new Float32Array(n);
  const phases = METAL.map(() => rng.next());
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = 0; k < METAL.length; k++) {
      const p = ((phases[k] as number) + ((METAL[k] as number) * 1.7 * i) / sr) % 1;
      s += p < 0.5 ? 1 : -1;
    }
    out[i] = s / METAL.length + 0.5 * rng.bi();
  }
  const f = new Biquad(sr, "hp", hp, 0.7);
  const env = decay(sr, lengthSec, tau, 0.0005);
  for (let i = 0; i < n; i++) out[i] = f.tick(out[i] as number) * (env[i] as number);
  return out;
}

export const hatClosed: Voice = (sr, note, rng) => {
  const out = metallic(sr, rng, 0.12, 0.03, 7000);
  for (let i = 0; i < out.length; i++) out[i] = (out[i] as number) * 0.5 * note.vel;
  return out;
};

export const hatOpen: Voice = (sr, note, rng) => {
  const out = metallic(sr, rng, 0.6, 0.18, 6500);
  for (let i = 0; i < out.length; i++) out[i] = (out[i] as number) * 0.4 * note.vel;
  return out;
};

export const ride: Voice = (sr, note, rng) => {
  const out = metallic(sr, rng, 1.6, 0.5, 4000);
  add(
    out,
    modal(
      sr,
      620,
      [
        [1, 0.6, 0.6],
        [2.7, 0.4, 0.4],
        [4.1, 0.3, 0.3],
      ],
      1.6,
      rng,
    ),
    0.08,
  );
  for (let i = 0; i < out.length; i++) out[i] = (out[i] as number) * 0.3 * note.vel;
  return out;
};

export const crash: Voice = (sr, note, rng) => {
  const out = metallic(sr, rng, 2.8, 0.9, 2500);
  add(out, noiseHit(sr, rng, 2.8, 0.7, "hp", 3000), 0.6);
  for (let i = 0; i < out.length; i++) out[i] = (out[i] as number) * 0.35 * note.vel;
  return out;
};

/** Woodblock: two stiff modes and a click. `freq` picks the block (around 800 to 1600 Hz). */
export const woodblock: Voice = (sr, note, rng) => {
  const f = note.freq > 300 ? note.freq : 1100;
  const out = modal(
    sr,
    f,
    [
      [1, 1, 0.045],
      [2.32, 0.35, 0.02],
      [4.1, 0.1, 0.01],
    ],
    0.18,
    rng,
  );
  add(out, noiseHit(sr, rng, 0.01, 0.002, "bp", f * 2, 1), 0.3);
  for (let i = 0; i < out.length; i++) out[i] = (out[i] as number) * 0.7 * note.vel;
  return out;
};

/** Temple-block / tick-tock: shorter, hollower. */
export const tick: Voice = (sr, note, rng) => {
  const f = note.freq > 300 ? note.freq : 2200;
  const out = modal(
    sr,
    f,
    [
      [1, 1, 0.012],
      [1.52, 0.6, 0.008],
      [3.3, 0.2, 0.004],
    ],
    0.06,
    rng,
  );
  add(out, noiseHit(sr, rng, 0.006, 0.0015, "hp", 5000), 0.2);
  for (let i = 0; i < out.length; i++) out[i] = (out[i] as number) * 0.6 * note.vel;
  return out;
};

export const tom: Voice = (sr, note, rng) => {
  const f = note.freq > 40 ? note.freq : 110;
  const out = modal(
    sr,
    f,
    [
      [1, 1, 0.22],
      [1.5, 0.3, 0.1],
      [2.1, 0.15, 0.06],
    ],
    0.6,
    rng,
    0.25,
  );
  add(out, noiseHit(sr, rng, 0.03, 0.006, "lp", 2500), 0.2);
  for (let i = 0; i < out.length; i++) out[i] = (out[i] as number) * 0.8 * note.vel;
  return out;
};

/** Timpani: a pitched kettle, mallet thud, a slow bloom. */
export const timpani: Voice = (sr, note, rng) => {
  const out = modal(
    sr,
    note.freq,
    [
      [1, 1, 1.1],
      [1.5, 0.5, 0.7],
      [1.98, 0.35, 0.5],
      [2.44, 0.2, 0.35],
      [2.9, 0.1, 0.25],
    ],
    Math.max(1.6, note.dur + 1),
    rng,
    0.02,
  );
  add(out, noiseHit(sr, rng, 0.05, 0.012, "lp", 900), 0.5);
  for (let i = 0; i < out.length; i++) out[i] = (out[i] as number) * 0.45 * note.vel;
  return out;
};

export const shaker: Voice = (sr, note, rng) => {
  const n = Math.round(0.12 * sr);
  const out = new Float32Array(n);
  const bp = new Biquad(sr, "bp", 6500, 0.8);
  for (let i = 0; i < n; i++) {
    const x = i / n;
    out[i] = bp.tick(rng.bi()) * Math.sin(Math.PI * x ** 0.5) * 0.35 * note.vel;
  }
  out[n - 1] = 0;
  return out;
};

/** Finger snap / rim click for the lounge. */
export const snap: Voice = (sr, note, rng) => {
  const out = noiseHit(sr, rng, 0.08, 0.012, "bp", 2400, 1.5);
  add(out, modal(sr, 1800, [[1, 1, 0.01]], 0.05, rng), 0.3);
  for (let i = 0; i < out.length; i++) out[i] = (out[i] as number) * 1.2 * note.vel;
  return out;
};
