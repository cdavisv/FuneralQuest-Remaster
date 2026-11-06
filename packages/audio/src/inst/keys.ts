import { sin1 } from "../dsp/core.js";
import { adsr } from "../dsp/env.js";
import { Biquad } from "../dsp/filter.js";
import { noiseHit } from "./percussion.js";
import type { Voice } from "./types.js";

/** Electric piano by two-operator FM with a tine partial: muzak, the hospital, the club. */
export const electricPiano: Voice = (sr, note, rng) => {
  const env = adsr(sr, note.dur, 0.002, 1.8, 0.0, 0.35);
  const n = env.length;
  const out = new Float32Array(n);
  const f = note.freq;
  let pc = rng.next();
  let pm = rng.next();
  let pt = rng.next();
  const idx0 = 1.2 + 1.2 * note.vel;
  const decayA = 1 / (1.6 * sr);
  const decayIdx = 1 / (0.35 * sr);
  const decayTine = 1 / (0.05 * sr);
  for (let i = 0; i < n; i++) {
    const idx = 0.25 + idx0 * Math.exp(-i * decayIdx);
    const m = sin1(pm);
    const c = sin1(pc + (idx * m) / (2 * Math.PI));
    const tine = 0.18 * note.vel * Math.exp(-i * decayTine) * sin1(pt);
    const body = Math.exp(-i * decayA) * 0.75 + 0.25;
    out[i] = (c * body + tine) * (env[i] as number) * 0.45;
    pc += f / sr;
    pm += f / sr;
    pt += Math.min(sr * 0.45, f * 14) / sr;
  }
  // the electric piano's sustain stays up as long as the key: an extra bloom on long notes
  out[n - 1] = 0;
  return out;
};

/**
 * Upright piano, a little out of tune (two strings per note, a few cents apart): the Pale Horse
 * Cafe's piano. Additive with stiff-string inharmonicity and per-partial decay.
 */
export function piano(detuneCents: number): Voice {
  return (sr, note, rng) => {
    const f0 = note.freq;
    const B = 0.00035;
    const length = Math.min(note.dur, 4) + 0.18;
    const n = Math.round(length * sr);
    const out = new Float32Array(n);
    const bright = 0.4 + 0.6 * note.vel;
    const gate = Math.round(Math.min(note.dur, 4) * sr);
    for (const det of [-detuneCents / 2, detuneCents / 2]) {
      const fs = f0 * 2 ** (det / 1200);
      for (let k = 1; k <= 14; k++) {
        const fk = k * fs * Math.sqrt(1 + B * k * k);
        if (fk > sr * 0.45) break;
        const amp = (1 / k ** (1.6 - 0.6 * bright)) * (k === 1 ? 1 : 0.8);
        const tau = (2.2 * (220 / Math.max(110, f0)) ** 0.5) / (1 + 0.35 * k);
        const kd = 1 / (tau * sr);
        let ph = rng.next();
        const inc = fk / sr;
        for (let i = 0; i < n; i++) {
          const damper = i < gate ? 1 : Math.exp(-(i - gate) / (0.05 * sr));
          out[i] = (out[i] as number) + amp * Math.exp(-i * kd) * damper * sin1(ph);
          ph += inc;
        }
      }
    }
    const thump = noiseHit(sr, rng, 0.03, 0.008, "lp", 1200);
    for (let i = 0; i < thump.length && i < n; i++)
      out[i] = (out[i] as number) + 0.3 * (thump[i] as number);
    const lp = new Biquad(sr, "lp", 2500 + 5000 * bright, 0.7);
    const a = Math.round(0.001 * sr);
    for (let i = 0; i < n; i++)
      out[i] = lp.tick(out[i] as number) * 0.22 * note.vel * (i < a ? i / a : 1);
    const fade = Math.round(0.01 * sr);
    for (let i = 0; i < fade; i++) out[n - 1 - i] = (out[n - 1 - i] as number) * (i / fade);
    return out;
  };
}

export const honkyTonk = piano(14);
export const uprightPiano = piano(3);
