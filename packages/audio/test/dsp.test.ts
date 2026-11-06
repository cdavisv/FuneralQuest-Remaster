import { describe, expect, it } from "vitest";
import { midiToHz, peak, type Stereo, stereo } from "../src/dsp/core.js";
import { adsr, decay } from "../src/dsp/env.js";
import { Biquad } from "../src/dsp/filter.js";
import { limit } from "../src/dsp/fx.js";
import { loudness } from "../src/dsp/loudness.js";
import { Rng } from "../src/dsp/rng.js";
import { electricPiano, honkyTonk } from "../src/inst/keys.js";
import { brass, choir, clarinet, stringPad, theremin, whistle } from "../src/inst/leads.js";
import {
  celesta,
  churchBell,
  glockenspiel,
  marimba,
  vibraphone,
  xylophone,
} from "../src/inst/mallets.js";
import { organ, REGISTRATIONS } from "../src/inst/organ.js";
import { brushTap, kick, snare, timpani, woodblock } from "../src/inst/percussion.js";
import { banjo, harp, pizzicato, uprightBass } from "../src/inst/strings.js";
import type { LineVoice, Voice } from "../src/inst/types.js";

const SR = 48000;

const voices: Record<string, Voice> = {
  ...Object.fromEntries(
    Object.keys(REGISTRATIONS).map((r) => [`organ:${r}`, organ(r as keyof typeof REGISTRATIONS)]),
  ),
  uprightBass,
  banjo,
  harp,
  pizzicato,
  electricPiano,
  honkyTonk,
  brass,
  clarinet,
  stringPad,
  choir: choir("ah"),
  celesta,
  churchBell,
  glockenspiel,
  marimba,
  vibraphone,
  xylophone,
  kick,
  snare,
  brushTap,
  woodblock,
  timpani,
};
const lines: Record<string, LineVoice> = { theremin, whistle };

/** Pitch of a signal by autocorrelation, Hz. */
function pitchOf(x: Float32Array, lo = 40, hi = 2000): number {
  const start = Math.round(0.05 * SR);
  const n = Math.round(0.2 * SR);
  let best = 0;
  let bestLag = 0;
  for (let lag = Math.floor(SR / hi); lag <= Math.ceil(SR / lo); lag++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += (x[start + i] as number) * (x[start + i + lag] as number);
    if (s > best) {
      best = s;
      bestLag = lag;
    }
  }
  // parabolic interpolation around the peak
  const ac = (lag: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += (x[start + i] as number) * (x[start + i + lag] as number);
    return s;
  };
  const a = ac(bestLag - 1);
  const b = ac(bestLag);
  const c = ac(bestLag + 1);
  const shift = (a - c) / (2 * (a - 2 * b + c));
  return SR / (bestLag + shift);
}

describe("random source", () => {
  it("is deterministic per seed and differs between seeds", () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const c = new Rng(43);
    const xs = Array.from({ length: 5 }, () => a.next());
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(xs);
    expect(Array.from({ length: 5 }, () => c.next())).not.toEqual(xs);
    for (const x of xs) expect(x).toBeGreaterThanOrEqual(0);
  });
});

describe("envelopes", () => {
  it("end exactly at silence", () => {
    for (const e of [
      adsr(SR, 0.5, 0.01, 0.1, 0.7, 0.2),
      adsr(SR, 0.001, 0.05, 0.1, 0.7, 0.2),
      decay(SR, 1, 0.2),
    ]) {
      expect(e[e.length - 1]).toBe(0);
      expect(peak(e)).toBeLessThanOrEqual(1);
    }
  });
});

describe("instruments", () => {
  for (const [name, v] of Object.entries(voices)) {
    it(`${name}: deterministic, finite, unclipped, ends silent`, () => {
      const note = { freq: midiToHz(57), dur: 0.4, vel: 1 };
      const a = v(SR, note, new Rng(7));
      const b = v(SR, note, new Rng(7));
      expect(a).toEqual(b);
      expect(a.every(Number.isFinite)).toBe(true);
      expect(peak(a)).toBeLessThan(1);
      expect(peak(a)).toBeGreaterThan(0.01);
      expect(Math.abs(a[a.length - 1] as number)).toBeLessThan(1e-3);
    });
  }
  for (const [name, v] of Object.entries(lines)) {
    it(`${name} (line): deterministic, finite, unclipped, ends silent`, () => {
      const notes = [
        { t: 0, dur: 0.3, freq: 440, vel: 0.9 },
        { t: 0.3, dur: 0.5, freq: 660, vel: 0.9 },
      ];
      const a = v(SR, notes, new Rng(3));
      expect(a).toEqual(v(SR, notes, new Rng(3)));
      expect(a.every(Number.isFinite)).toBe(true);
      expect(peak(a)).toBeLessThan(1);
      expect(Math.abs(a[a.length - 1] as number)).toBeLessThan(1e-3);
    });
  }

  it("plucked strings are in tune (within 5 cents)", () => {
    for (const [v, midi] of [
      [uprightBass, 40],
      [banjo, 62],
      [harp, 69],
      [pizzicato, 57],
    ] as const) {
      const f = midiToHz(midi);
      const x = v(SR, { freq: f, dur: 0.5, vel: 0.8 }, new Rng(1));
      const cents = 1200 * Math.log2(pitchOf(x) / f);
      expect(Math.abs(cents)).toBeLessThan(5);
    }
  });

  it("the organ sounds the note it is given", () => {
    const f = midiToHz(60);
    const x = organ("flute")(SR, { freq: f, dur: 0.5, vel: 0.8 }, new Rng(1));
    expect(Math.abs(1200 * Math.log2(pitchOf(x, 100, 1000) / f))).toBeLessThan(5);
  });
});

describe("filters and dynamics", () => {
  it("a biquad low-pass passes lows and stops highs, and stays stable", () => {
    const tone = (hz: number) => {
      const x = new Float32Array(SR);
      for (let i = 0; i < SR; i++) x[i] = Math.sin((2 * Math.PI * hz * i) / SR);
      new Biquad(SR, "lp", 1000, Math.SQRT1_2).run(x);
      return peak(x.subarray(SR / 2));
    };
    expect(tone(100)).toBeGreaterThan(0.95);
    expect(tone(8000)).toBeLessThan(0.03);
  });

  it("the limiter holds the ceiling", () => {
    const b: Stereo = stereo(SR);
    for (let i = 0; i < SR; i++) b.l[i] = b.r[i] = 1.8 * Math.sin((2 * Math.PI * 220 * i) / SR);
    limit(b, SR, 0.9, false);
    expect(peak(b.l)).toBeLessThanOrEqual(0.9 + 1e-6);
  });
});

describe("loudness meter (BS.1770)", () => {
  it("reads a 1 kHz sine on both channels at its level in dBFS", () => {
    for (const amp of [0.1, 0.5]) {
      const b = stereo(SR * 3);
      for (let i = 0; i < b.l.length; i++)
        b.l[i] = b.r[i] = amp * Math.sin((2 * Math.PI * 1000 * i) / SR);
      expect(loudness(b, SR).integrated).toBeCloseTo(20 * Math.log10(amp), 1);
    }
  });

  it("gates silence out", () => {
    const b = stereo(SR * 4);
    for (let i = 0; i < SR; i++) b.l[i] = b.r[i] = 0.1 * Math.sin((2 * Math.PI * 1000 * i) / SR);
    // the blocks straddling the tone's edges pull it a little under -20
    expect(Math.abs(loudness(b, SR).integrated + 20)).toBeLessThan(1);
  });
});
