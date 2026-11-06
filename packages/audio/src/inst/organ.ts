import { sin1, TAU } from "../dsp/core.js";
import { adsr } from "../dsp/env.js";
import { Biquad } from "../dsp/filter.js";
import type { Rng } from "../dsp/rng.js";
import type { NoteEvent, Voice } from "./types.js";

/**
 * The parlor's organ: additive pipes (a registration is a list of [harmonic ratio, level]),
 * with the attack "chiff" of a flue pipe, wind noise, an optional second detuned rank for the
 * beating of a reed organ or a celeste, and tremulant or rotary-speaker modulation.
 */
export interface Registration {
  ranks: readonly [number, number][];
  /** Level of the attack chiff (0 for none). */
  chiff: number;
  /** Breathy wind noise level. */
  wind: number;
  /** Second rank detuned by this many cents (0 for none), at `celesteLevel`. */
  celeste: number;
  celesteLevel: number;
  /** Tremulant / vibrato: rate Hz, depth in cents, amplitude depth 0 to 1. */
  vibRate: number;
  vibCents: number;
  tremDepth: number;
  /** Tonewheel-style percussion on the given harmonic (0 for none). */
  percHarm: number;
  /** A short key click (combo organs). */
  click: number;
  attack: number;
  release: number;
}

const base: Registration = {
  ranks: [[1, 1]],
  chiff: 0,
  wind: 0,
  celeste: 0,
  celesteLevel: 0,
  vibRate: 0,
  vibCents: 0,
  tremDepth: 0,
  percHarm: 0,
  click: 0,
  attack: 0.03,
  release: 0.12,
};

export const REGISTRATIONS = {
  /** Soft chapel principal with an octave and a quiet mixture: the solemn parlor sound. */
  chapel: {
    ...base,
    ranks: [
      [0.5, 0.25],
      [1, 1],
      [2, 0.42],
      [3, 0.16],
      [4, 0.2],
      [6, 0.06],
      [8, 0.05],
    ],
    chiff: 0.12,
    wind: 0.012,
    celeste: 4,
    celesteLevel: 0.25,
    attack: 0.045,
    release: 0.22,
  },
  /** Stopped flute: hollow, odd harmonics, a puff of chiff. Town tunes and counter-melodies. */
  flute: {
    ...base,
    ranks: [
      [1, 1],
      [2, 0.06],
      [3, 0.22],
      [4, 0.02],
      [5, 0.06],
    ],
    chiff: 0.3,
    wind: 0.02,
    vibRate: 5.2,
    vibCents: 6,
    attack: 0.035,
    release: 0.1,
  },
  /** Reed organ (harmonium): buzzy, two slightly beating reeds. Fairground and comic. */
  reed: {
    ...base,
    ranks: [
      [1, 1],
      [2, 0.6],
      [3, 0.5],
      [4, 0.32],
      [5, 0.3],
      [6, 0.18],
      [7, 0.15],
      [8, 0.08],
      [9, 0.07],
    ],
    chiff: 0.04,
    wind: 0.008,
    celeste: 7,
    celesteLevel: 0.7,
    attack: 0.05,
    release: 0.09,
  },
  /** Full organ with sixteen-foot and mixtures: ceremonies, the meteor, the end of a season. */
  full: {
    ...base,
    ranks: [
      [0.5, 0.55],
      [1, 1],
      [1.5, 0.25],
      [2, 0.6],
      [3, 0.38],
      [4, 0.4],
      [5, 0.12],
      [6, 0.2],
      [8, 0.18],
      [10, 0.06],
      [12, 0.07],
      [16, 0.04],
    ],
    chiff: 0.08,
    wind: 0.01,
    celeste: 3,
    celesteLevel: 0.3,
    attack: 0.06,
    release: 0.35,
  },
  /** Lounge combo organ: drawbars 16', 8', 5 1/3', 4' with percussion and a rotary wobble. */
  combo: {
    ...base,
    ranks: [
      [0.5, 0.7],
      [1, 1],
      [1.5, 0.55],
      [2, 0.45],
      [4, 0.12],
    ],
    vibRate: 6.4,
    vibCents: 4,
    tremDepth: 0.18,
    percHarm: 3,
    click: 0.25,
    attack: 0.004,
    release: 0.05,
  },
  /** Fairground calliope: loud flutes, quick heavy vibrato, a lot of wind. */
  calliope: {
    ...base,
    ranks: [
      [1, 1],
      [2, 0.3],
      [3, 0.18],
      [4, 0.08],
    ],
    chiff: 0.35,
    wind: 0.05,
    vibRate: 6.8,
    vibCents: 22,
    tremDepth: 0.12,
    attack: 0.02,
    release: 0.08,
  },
} satisfies Record<string, Registration>;

export type RegistrationName = keyof typeof REGISTRATIONS;

function renderOrgan(sr: number, note: NoteEvent, rng: Rng, reg: Registration): Float32Array {
  const env = adsr(sr, note.dur, reg.attack, 0.1, 0.92, reg.release);
  const n = env.length;
  const out = new Float32Array(n);
  const nyq = sr * 0.45;
  const vPhase = rng.next();
  const tPhase = rng.next();
  const ranks = reg.celeste > 0 ? [0, reg.celeste] : [0];
  for (const cents of ranks) {
    const lvl = cents === 0 ? 1 : reg.celesteLevel;
    const f0 = note.freq * 2 ** (cents / 1200);
    for (const [ratio, amp] of reg.ranks) {
      const f = f0 * ratio;
      if (f > nyq) continue;
      // Gentle roll-off above 5 kHz, like pipes heard from the pews.
      const a = (amp * lvl) / (1 + (f / 5000) ** 2);
      let ph = rng.next();
      const inc = f / sr;
      const vd = reg.vibCents > 0 ? 2 ** (reg.vibCents / 1200) - 1 : 0;
      for (let i = 0; i < n; i++) {
        const vib = vd > 0 ? 1 + vd * sin1(vPhase + (reg.vibRate * i) / sr) : 1;
        out[i] = (out[i] as number) + a * sin1(ph);
        ph += inc * vib;
      }
    }
  }
  // Percussion (a decaying harmonic) and key click.
  if (reg.percHarm > 0) {
    const f = note.freq * reg.percHarm;
    if (f < nyq) {
      const k = 1 / (0.18 * sr);
      for (let i = 0; i < n; i++)
        out[i] = (out[i] as number) + 0.5 * Math.exp(-i * k) * sin1((f * i) / sr);
    }
  }
  if (reg.click > 0) {
    const len = Math.min(n, Math.round(0.004 * sr));
    const hp = new Biquad(sr, "hp", 2500);
    for (let i = 0; i < len; i++)
      out[i] = (out[i] as number) + reg.click * hp.tick(rng.bi()) * (1 - i / len);
  }
  // Chiff: a filtered noise puff around the second harmonic at the start of the note.
  if (reg.chiff > 0) {
    const len = Math.min(n, Math.round(0.06 * sr));
    const bp = new Biquad(sr, "bp", Math.min(nyq, note.freq * 3), 4);
    for (let i = 0; i < len; i++) {
      const e = Math.sin((Math.PI * i) / len) ** 2;
      out[i] = (out[i] as number) + reg.chiff * 3 * e * bp.tick(rng.bi());
    }
  }
  if (reg.wind > 0) {
    const bp = new Biquad(sr, "bp", Math.min(nyq, note.freq * 2), 2);
    for (let i = 0; i < n; i++) out[i] = (out[i] as number) + reg.wind * bp.tick(rng.bi());
  }
  // Worst case every partial peaks together: scale so that stays under 0.6.
  let sum = 0;
  for (const [, amp] of reg.ranks) sum += amp;
  const norm =
    0.6 /
    (sum * (1 + (reg.celeste > 0 ? reg.celesteLevel : 0)) +
      reg.wind * 4 +
      0.5 * (reg.percHarm > 0 ? 1 : 0));
  for (let i = 0; i < n; i++) {
    const trem =
      reg.tremDepth > 0
        ? 1 - reg.tremDepth * 0.5 * (1 + Math.sin(TAU * tPhase + (TAU * reg.vibRate * i) / sr))
        : 1;
    out[i] = (out[i] as number) * (env[i] as number) * trem * norm * (0.55 + 0.45 * note.vel);
  }
  return out;
}

export function organ(reg: RegistrationName | Registration): Voice {
  const r = typeof reg === "string" ? REGISTRATIONS[reg] : reg;
  return (sr, note, rng) => renderOrgan(sr, note, rng, r);
}
