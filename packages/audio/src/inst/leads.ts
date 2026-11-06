import { sin1 } from "../dsp/core.js";
import { adsr } from "../dsp/env.js";
import { Biquad, Svf } from "../dsp/filter.js";
import { osc } from "../dsp/osc.js";
import type { LineNote, LineVoice, Voice } from "./types.js";

/**
 * Frequency and amplitude curves for a monophonic phrase: the pitch glides into each note over
 * `glide` seconds (in log-frequency), the amplitude stays up between notes closer than `legato`
 * seconds and otherwise breathes in and out with `attack` / `release`.
 */
export function lineCurves(
  sr: number,
  notes: readonly LineNote[],
  glide: number,
  attack: number,
  release: number,
  legato = 0.06,
): { freq: Float32Array; amp: Float32Array; vel: Float32Array } {
  const last = notes[notes.length - 1];
  const n = Math.max(2, Math.round(((last ? last.t + last.dur : 0) + release + 0.01) * sr));
  const freq = new Float32Array(n);
  const amp = new Float32Array(n);
  const vel = new Float32Array(n);
  let logF = Math.log2(notes[0]?.freq ?? 440);
  let a = 0;
  let v = notes[0]?.vel ?? 0.8;
  const glideK = glide > 0 ? 1 - Math.exp(-1 / (glide * sr * 0.3)) : 1;
  const atkK = 1 / Math.max(1, attack * sr);
  const relK = 1 - Math.exp(-1 / Math.max(1, release * sr * 0.25));
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    while (j < notes.length - 1 && t >= (notes[j + 1] as LineNote).t) j++;
    const cur = notes[j] as LineNote;
    const next = notes[j + 1];
    const on =
      t >= cur.t &&
      (t < cur.t + cur.dur ||
        (next !== undefined && next.t - (cur.t + cur.dur) < legato && t < next.t));
    if (t >= cur.t) {
      logF += (Math.log2(cur.freq) - logF) * glideK;
      v += (cur.vel - v) * 0.001;
    }
    if (on) a = Math.min(1, a + atkK);
    else a -= a * relK;
    freq[i] = 2 ** logF;
    amp[i] = a;
    vel[i] = v;
  }
  // ensure silence at the end
  const fade = Math.min(n, Math.round(0.01 * sr));
  for (let i = 0; i < fade; i++) amp[n - 1 - i] = (amp[n - 1 - i] as number) * (i / fade);
  return { freq, amp, vel };
}

/** Theremin: a near-sine with a swooping glide and a vibrato that blooms on long notes. */
export const theremin: LineVoice = (sr, notes, rng) => {
  const { freq, amp, vel } = lineCurves(sr, notes, 0.11, 0.06, 0.18, 0.12);
  const n = freq.length;
  const out = new Float32Array(n);
  let ph = rng.next();
  const vp = rng.next();
  let held = 0;
  for (let i = 0; i < n; i++) {
    held = (amp[i] as number) > 0.5 ? held + 1 : 0;
    const depth = 0.006 + 0.012 * Math.min(1, held / (0.6 * sr));
    const f = (freq[i] as number) * (1 + depth * sin1(vp + (5.8 * i) / sr));
    const s = sin1(ph);
    // a touch of the second and third harmonic, the warmth of the valve circuit
    const y = s + 0.12 * sin1(2 * ph + 0.1) + 0.04 * sin1(3 * ph);
    out[i] = y * (amp[i] as number) * (vel[i] as number) * 0.45;
    ph += f / sr;
  }
  return new Biquad(sr, "lp", 3500, 0.7).run(out);
};

/** Whistling: a sine with breath and a lazy vibrato. Small-town counter-melodies. */
export const whistle: LineVoice = (sr, notes, rng) => {
  const { freq, amp, vel } = lineCurves(sr, notes, 0.04, 0.03, 0.07, 0.03);
  const n = freq.length;
  const out = new Float32Array(n);
  let ph = rng.next();
  const bp = new Biquad(sr, "bp", 2000, 1);
  for (let i = 0; i < n; i++) {
    const f = (freq[i] as number) * (1 + 0.004 * sin1((5 * i) / sr));
    bp.set("bp", f, 6);
    const breath = bp.tick(rng.bi()) * 0.25;
    out[i] = (sin1(ph) + breath) * (amp[i] as number) * (vel[i] as number) * 0.35;
    ph += f / sr;
  }
  return out;
};

/**
 * Brass line (trombone, tuba): a saw through a filter that opens with the breath, with lip
 * glides. The sad-trombone fail and the march's tuba both use it.
 */
export function brassLine(o: {
  glide: number;
  /** Filter opening above the pitch, in multiples of the fundamental at full breath. */
  bright: number;
  /** Plunger-mute "wah" depth 0 to 1 (filter dips at each note's start and end). */
  wah: number;
  vibCents: number;
}): LineVoice {
  return (sr, notes, rng) => {
    const { freq, amp, vel } = lineCurves(sr, notes, o.glide, 0.045, 0.09, 0.05);
    const n = freq.length;
    const fv = new Float32Array(n);
    const vp = rng.next();
    for (let i = 0; i < n; i++) {
      fv[i] =
        (freq[i] as number) *
        2 ** ((o.vibCents * sin1(vp + (5.2 * i) / sr) * (amp[i] as number)) / 1200);
    }
    const saw = osc(n, sr, fv, "saw", 0.5, rng.next());
    const svf = new Svf(sr);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = amp[i] as number;
      const breath = a * a * (0.6 + 0.4 * (vel[i] as number));
      const wah = 1 - o.wah * (1 - a);
      svf.set((fv[i] as number) * (1 + o.bright * breath * wah), 1.1);
      svf.tick(saw[i] as number);
      out[i] = svf.lp * a * (vel[i] as number) * 0.5;
    }
    return out;
  };
}

/** A polyphonic brass section voice (chords for the march and fanfares). */
export const brass: Voice = (sr, note, rng) => {
  const env = adsr(sr, note.dur, 0.04, 0.2, 0.75, 0.12);
  const n = env.length;
  const f = osc(n, sr, note.freq * (1 + 0.002 * rng.bi()), "saw", 0.5, rng.next());
  const svf = new Svf(sr);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const e = env[i] as number;
    svf.set(note.freq * (1.5 + 6 * e * note.vel), 0.9);
    svf.tick(f[i] as number);
    out[i] = svf.lp * e * 0.4 * note.vel;
  }
  return out;
};

/** Clarinet: hollow square-wave reed, for muzak and the bank's polite tunes. */
export const clarinet: Voice = (sr, note, rng) => {
  const env = adsr(sr, note.dur, 0.035, 0.1, 0.85, 0.08);
  const n = env.length;
  const vib = new Float32Array(n);
  for (let i = 0; i < n; i++)
    vib[i] = note.freq * (1 + 0.003 * Math.min(1, i / (0.4 * sr)) * sin1((5 * i) / sr));
  const sq = osc(n, sr, vib, "square", 0.5, rng.next());
  const lp = new Biquad(sr, "lp", Math.min(sr * 0.4, note.freq * 5), 0.8);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++)
    out[i] = lp.tick(sq[i] as number) * (env[i] as number) * 0.3 * note.vel;
  return out;
};

const VOWELS = {
  oo: [
    [300, 1, 8],
    [870, 0.3, 10],
    [2240, 0.08, 12],
  ],
  ah: [
    [730, 1, 8],
    [1090, 0.5, 10],
    [2440, 0.2, 12],
  ],
  mm: [
    [250, 1, 6],
    [1700, 0.05, 10],
    [2500, 0.03, 10],
  ],
} as const;

/** Wordless choir, "oo", "ah" or humming "mm": a buzzy source through three formants. */
export function choir(vowel: keyof typeof VOWELS): Voice {
  return (sr, note, rng) => {
    const env = adsr(sr, note.dur, 0.25, 0.3, 0.9, 0.4);
    const n = env.length;
    const out = new Float32Array(n);
    // three voices per note, slightly detuned, for a section rather than a soloist
    for (let v = 0; v < 3; v++) {
      const det = 2 ** ((rng.bi() * 9) / 1200);
      const vp = rng.next();
      const fv = new Float32Array(n);
      for (let i = 0; i < n; i++) fv[i] = note.freq * det * (1 + 0.004 * sin1(vp + (5.3 * i) / sr));
      const src = osc(n, sr, fv, "pulse", 0.3, rng.next());
      for (const [f, g, q] of VOWELS[vowel]) {
        const bp = new Biquad(sr, "bp", f, q);
        for (let i = 0; i < n; i++) out[i] = (out[i] as number) + bp.tick(src[i] as number) * g;
      }
    }
    for (let i = 0; i < n; i++) out[i] = (out[i] as number) * (env[i] as number) * 0.22 * note.vel;
    return out;
  };
}

/** A soft string pad: three detuned saws through a low-pass, slow bow. */
export const stringPad: Voice = (sr, note, rng) => {
  const env = adsr(sr, note.dur, 0.35, 0.5, 0.85, 0.6);
  const n = env.length;
  const out = new Float32Array(n);
  for (const c of [-8, 0, 7]) {
    const s = osc(n, sr, note.freq * 2 ** (c / 1200), "saw", 0.5, rng.next());
    for (let i = 0; i < n; i++) out[i] = (out[i] as number) + (s[i] as number);
  }
  const lp = new Biquad(sr, "lp", Math.min(sr * 0.4, note.freq * 6 + 400), 0.6);
  for (let i = 0; i < n; i++)
    out[i] = lp.tick(out[i] as number) * (env[i] as number) * 0.12 * note.vel;
  return out;
};

/** A plain bowed bass / cello sustain, for slow pieces where a pluck would be too busy. */
export const bowedBass: Voice = (sr, note, rng) => {
  const env = adsr(sr, note.dur, 0.12, 0.3, 0.8, 0.25);
  const n = env.length;
  const s = osc(n, sr, note.freq, "saw", 0.5, rng.next());
  const lp = new Biquad(sr, "lp", Math.min(sr * 0.4, note.freq * 4), 0.7);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++)
    out[i] = lp.tick(s[i] as number) * (env[i] as number) * 0.35 * note.vel;
  return out;
};

/** Sub-sine bass, for the hospital's soft electric-piano pieces. */
export const sineBass: Voice = (sr, note, rng) => {
  const env = adsr(sr, note.dur, 0.01, 0.3, 0.7, 0.1);
  const n = env.length;
  const out = new Float32Array(n);
  let ph = rng.next();
  for (let i = 0; i < n; i++) {
    out[i] = (sin1(ph) + 0.15 * sin1(2 * ph)) * (env[i] as number) * 0.5 * note.vel;
    ph += note.freq / sr;
  }
  return out;
};
