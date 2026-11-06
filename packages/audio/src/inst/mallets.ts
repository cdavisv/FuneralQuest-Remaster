import { sin1 } from "../dsp/core.js";
import { modal, noiseHit } from "./percussion.js";
import type { Voice } from "./types.js";

/**
 * Bells, chimes and mallet instruments as sums of damped modes. Mode ratios: a church bell's
 * hum, prime, tierce, quint and nominal; free bars for the glockenspiel; tuned bars (1:4:10)
 * for the vibraphone and marimba.
 */

const mix = (a: Float32Array, b: Float32Array, g: number) => {
  for (let i = 0; i < Math.min(a.length, b.length); i++)
    a[i] = (a[i] as number) + (b[i] as number) * g;
  return a;
};

const gain = (a: Float32Array, g: number) => {
  for (let i = 0; i < a.length; i++) a[i] = (a[i] as number) * g;
  return a;
};

/** A church / tower bell. `freq` is the strike note (the nominal sounds an octave above the hum). */
export const churchBell: Voice = (sr, note, rng) => {
  const f = note.freq;
  const out = modal(
    sr,
    f,
    [
      [0.5, 0.5, 3.5],
      [1, 0.8, 2.4],
      [1.19, 0.6, 1.8],
      [1.5, 0.35, 1.3],
      [2, 0.7, 1.1],
      [2.51, 0.25, 0.7],
      [2.66, 0.2, 0.6],
      [3.01, 0.18, 0.45],
      [4.17, 0.12, 0.3],
      [5.43, 0.06, 0.2],
    ],
    Math.max(3, note.dur + 2.5),
    rng,
  );
  mix(out, noiseHit(sr, rng, 0.03, 0.006, "bp", f * 4, 1), 0.3);
  return gain(out, 0.3 * note.vel);
};

/** Tubular chime: the hall clock and the good-news ding. */
export const tubularBell: Voice = (sr, note, rng) => {
  const out = modal(
    sr,
    note.freq,
    [
      [1, 1, 2.2],
      [2.76, 0.5, 1.2],
      [5.4, 0.25, 0.6],
      [8.93, 0.1, 0.3],
      [2.0, 0.3, 1.6],
    ],
    Math.max(2.5, note.dur + 2),
    rng,
  );
  return gain(out, 0.32 * note.vel);
};

export const glockenspiel: Voice = (sr, note, rng) => {
  const out = modal(
    sr,
    note.freq,
    [
      [1, 1, 0.9],
      [2.756, 0.25, 0.25],
      [5.404, 0.08, 0.1],
    ],
    1.4,
    rng,
  );
  mix(out, noiseHit(sr, rng, 0.004, 0.001, "hp", 6000), 0.15);
  return gain(out, 0.35 * note.vel);
};

/** Celesta: a softer, rounder glock for the desk's music box. */
export const celesta: Voice = (sr, note, rng) => {
  const out = modal(
    sr,
    note.freq,
    [
      [1, 1, 0.8],
      [2, 0.12, 0.3],
      [4, 0.05, 0.15],
    ],
    Math.max(1.2, note.dur + 0.6),
    rng,
  );
  return gain(out, 0.4 * note.vel);
};

/** Music box: a plucked comb tine, bright and short. */
export const musicBox: Voice = (sr, note, rng) => {
  const out = modal(
    sr,
    note.freq,
    [
      [1, 1, 1.3],
      [3.0, 0.08, 0.4],
      [5.97, 0.12, 0.15],
    ],
    1.8,
    rng,
  );
  mix(out, noiseHit(sr, rng, 0.003, 0.0008, "hp", 7000), 0.25);
  return gain(out, 0.35 * note.vel);
};

export const vibraphone: Voice = (sr, note, rng) => {
  const out = modal(
    sr,
    note.freq,
    [
      [1, 1, 1.6],
      [4, 0.3, 0.4],
      [10, 0.05, 0.12],
    ],
    Math.max(1.5, note.dur + 1),
    rng,
  );
  // the motor's tremolo
  for (let i = 0; i < out.length; i++)
    out[i] = (out[i] as number) * (0.8 + 0.2 * sin1((5.5 * i) / sr));
  // pedal up: damp after the note
  const gate = Math.round((note.dur + 0.3) * sr);
  for (let i = gate; i < out.length; i++)
    out[i] = (out[i] as number) * Math.exp(-(i - gate) / (0.08 * sr));
  out[out.length - 1] = 0;
  return gain(out, 0.32 * note.vel);
};

export const marimba: Voice = (sr, note, rng) => {
  const out = modal(
    sr,
    note.freq,
    [
      [1, 1, 0.5],
      [3.93, 0.3, 0.1],
      [9.2, 0.05, 0.04],
    ],
    0.9,
    rng,
  );
  mix(out, noiseHit(sr, rng, 0.01, 0.002, "lp", 1500), 0.15);
  return gain(out, 0.45 * note.vel);
};

export const xylophone: Voice = (sr, note, rng) => {
  const out = modal(
    sr,
    note.freq,
    [
      [1, 1, 0.22],
      [3.0, 0.4, 0.08],
      [6.0, 0.1, 0.03],
    ],
    0.5,
    rng,
  );
  mix(out, noiseHit(sr, rng, 0.006, 0.0015, "hp", 3000), 0.2);
  return gain(out, 0.45 * note.vel);
};
