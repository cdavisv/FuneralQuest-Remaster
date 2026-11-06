import { decay } from "../dsp/env.js";
import { Biquad } from "../dsp/filter.js";
import type { Rng } from "../dsp/rng.js";
import type { NoteEvent, Voice } from "./types.js";

/**
 * Plucked strings by the Karplus-Strong model with the Jaffe-Smith extensions: a noise or
 * shaped excitation, a pick-position comb, an allpass for exact tuning, a loop filter whose
 * blend sets how quickly the highs die, and a loop gain that sets the ring.
 */
export interface PluckOptions {
  /** Excitation low-pass in multiples of the fundamental (bright pick high, thumb low). */
  brightness: number;
  /** Loop gain per period; 0.99 to 0.9999. */
  ring: number;
  /** Loop filter blend 0 (no damping) to 0.5 (strong). */
  damping: number;
  /** Pick position 0 to 0.5 (fraction of the string). */
  pick: number;
  /** Seconds the note keeps ringing after its key-up (a hand stopping the string). */
  mute: number;
  /** Mix of a triangle "thumb" shape into the noise excitation, 0 to 1. */
  thumb: number;
}

export function pluck(sr: number, note: NoteEvent, rng: Rng, o: PluckOptions): Float32Array {
  const lengthSec = note.dur + o.mute;
  const n = Math.max(2, Math.round(lengthSec * sr));
  const out = new Float32Array(n);
  const period = sr / note.freq;
  // Loop delay: the averaging filter adds half a sample; the allpass takes the fraction.
  const total = period - 0.5;
  let Nint = Math.max(2, Math.floor(total));
  let frac = total - Nint;
  if (frac < 0.1 && Nint > 2) {
    Nint -= 1;
    frac += 1;
  }
  const C = (1 - frac) / (1 + frac);
  const line = new Float32Array(Nint);
  // Excitation: noise low-passed relative to the pitch, mixed with a triangle.
  const lp = new Biquad(sr, "lp", Math.min(sr * 0.45, note.freq * o.brightness), 0.6);
  const len = line.length;
  let mean = 0;
  for (let i = 0; i < len; i++) {
    const x = i / len;
    const tri = x < 0.5 ? x * 4 - 1 : 3 - x * 4;
    const v = (1 - o.thumb) * rng.bi() + o.thumb * tri;
    line[i] = lp.tick(v);
    mean += line[i] as number;
  }
  mean /= len;
  for (let i = 0; i < len; i++) line[i] = (line[i] as number) - mean;
  // Pick position: subtract a copy delayed by the pick fraction.
  const pd = Math.max(1, Math.round(o.pick * len));
  const ex = line.slice();
  for (let i = 0; i < len; i++)
    line[i] = (ex[i] as number) - (i >= pd ? (ex[i - pd] as number) : 0) * 0.9;
  // The comb leaves an offset; a string has no DC, so take it out after the comb.
  let m2 = 0;
  for (let i = 0; i < len; i++) m2 += line[i] as number;
  m2 /= len;
  for (let i = 0; i < len; i++) line[i] = (line[i] as number) - m2;
  let idx = 0;
  let prev = 0;
  let apX = 0;
  let apY = 0;
  const g = o.ring;
  const s = o.damping;
  for (let i = 0; i < n; i++) {
    const y = line[idx] as number;
    out[i] = y;
    const avg = (1 - s) * y + s * prev;
    prev = y;
    // first-order allpass for the fractional part of the delay
    const ap = C * avg + apX - C * apY;
    apX = avg;
    apY = ap;
    line[idx] = ap * g;
    idx = idx + 1 === len ? 0 : idx + 1;
  }
  // Key-up: fade over `mute` seconds after the note's duration.
  const gate = Math.round(note.dur * sr);
  const m = Math.max(1, n - gate);
  for (let i = gate; i < n; i++) {
    const x = (i - gate) / m;
    out[i] = (out[i] as number) * (1 - x) * (1 - x);
  }
  out[n - 1] = 0;
  return out;
}

/** Upright bass: a thumb pluck, warm, quick to lose its highs, with a body thump. */
export const uprightBass: Voice = (sr, note, rng) => {
  const s = pluck(sr, note, rng, {
    brightness: 7,
    ring: 0.997,
    damping: 0.45,
    pick: 0.18,
    mute: 0.09,
    thumb: 0.65,
  });
  // body: a decaying sine on the fundamental gives the wooden boom
  const body = decay(sr, s.length / sr, 0.25, 0.004);
  const lp = new Biquad(sr, "lp", 1400, 0.7);
  const res = new Biquad(sr, "peak", 110, 1.2, 4);
  for (let i = 0; i < s.length; i++) {
    const b = 0.35 * (body[i] as number) * Math.sin((2 * Math.PI * note.freq * i) / sr);
    s[i] = res.tick(lp.tick((s[i] as number) * 1.1 + b)) * 0.6 * (0.5 + 0.5 * note.vel);
  }
  s[s.length - 1] = 0;
  return s;
};

/** Five-string banjo: bright pick, short ring, the drum-head's honk. */
export const banjo: Voice = (sr, note, rng) => {
  const s = pluck(sr, note, rng, {
    brightness: 30,
    ring: 0.993,
    damping: 0.2,
    pick: 0.12,
    mute: 0.05,
    thumb: 0.1,
  });
  const head = new Biquad(sr, "peak", 900, 1.4, 7);
  const hp = new Biquad(sr, "hp", 160, 0.7);
  const air = new Biquad(sr, "highshelf", 4000, 0.7, 3);
  const env = decay(sr, s.length / sr, 0.35, 0.001);
  for (let i = 0; i < s.length; i++) {
    s[i] =
      air.tick(hp.tick(head.tick(s[i] as number))) *
      (env[i] as number) *
      0.45 *
      (0.5 + 0.5 * note.vel);
  }
  s[s.length - 1] = 0;
  return s;
};

/** Concert harp: soft finger pluck, long ring. */
export const harp: Voice = (sr, note, rng) => {
  const s = pluck(sr, { ...note, dur: Math.max(note.dur, 1.2) }, rng, {
    brightness: 9,
    ring: 0.9993,
    damping: 0.3,
    pick: 0.3,
    mute: 0.6,
    thumb: 0.55,
  });
  const lp = new Biquad(sr, "lp", 5000, 0.7);
  const warm = new Biquad(sr, "peak", 250, 0.8, 2);
  for (let i = 0; i < s.length; i++)
    s[i] = warm.tick(lp.tick(s[i] as number)) * 0.8 * (0.5 + 0.5 * note.vel);
  s[s.length - 1] = 0;
  return s;
};

/** Pizzicato strings (violin to cello): short, round, a little woody. */
export const pizzicato: Voice = (sr, note, rng) => {
  const s = pluck(sr, { ...note, dur: Math.min(note.dur, 0.25) }, rng, {
    brightness: 10,
    ring: 0.993,
    damping: 0.4,
    pick: 0.25,
    mute: 0.12,
    thumb: 0.6,
  });
  const body = new Biquad(sr, "peak", Math.max(300, note.freq * 1.5), 1.2, 5);
  const env = decay(sr, s.length / sr, 0.16, 0.002);
  for (let i = 0; i < s.length; i++)
    s[i] = body.tick(s[i] as number) * (env[i] as number) * 0.9 * (0.5 + 0.5 * note.vel);
  s[s.length - 1] = 0;
  return s;
};

/** A plain nylon-ish guitar strum voice, for the lounge and the cafe. */
export const guitar: Voice = (sr, note, rng) => {
  const s = pluck(sr, note, rng, {
    brightness: 14,
    ring: 0.996,
    damping: 0.35,
    pick: 0.2,
    mute: 0.1,
    thumb: 0.4,
  });
  const body = new Biquad(sr, "peak", 200, 1, 4);
  const lp = new Biquad(sr, "lp", 4500, 0.7);
  for (let i = 0; i < s.length; i++)
    s[i] = lp.tick(body.tick(s[i] as number)) * 0.6 * (0.5 + 0.5 * note.vel);
  s[s.length - 1] = 0;
  return s;
};
