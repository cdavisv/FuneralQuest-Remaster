import {
  dbToGain,
  dcBlock,
  midiToHz,
  mixInto,
  removeMean,
  type Stereo,
  scaleStereo,
  stereo,
} from "../dsp/core.js";
import { Biquad } from "../dsp/filter.js";
import { delay, reverb } from "../dsp/fx.js";
import { loudness } from "../dsp/loudness.js";
import { hashSeed, Rng } from "../dsp/rng.js";
import type { LineNote } from "../inst/types.js";
import { type Note, type Part, type Score, scoreBeats, spb } from "./score.js";

/**
 * Renders a score to stereo PCM. Loops are rendered over their length plus a tail, and the
 * tail is folded back onto the start: the result is exactly one period of the steady-state
 * loop, so playing it end to start continues every ringing note and the reverb across the join.
 */
export interface Rendered {
  /** One buffer per layer (stem). For a plain score, one. */
  stems: Stereo[];
  /** Samples of one loop period (loops) or of the whole one-shot. */
  length: number;
  sr: number;
}

const TAIL = 4.5;

function swingTime(t: number, swing: number): number {
  if (swing <= 0) return t;
  const beat = Math.floor(t + 1e-9);
  const f = t - beat;
  // Offbeat eighths (and the sixteenths around them) move later; downbeats stay.
  if (Math.abs(f - 0.5) < 1e-6) return beat + 0.5 + swing;
  if (Math.abs(f - 0.75) < 1e-6) return beat + 0.75 + swing / 2;
  if (Math.abs(f - 0.25) < 1e-6) return beat + 0.25 + swing / 2;
  return t;
}

/** Groups a monophonic part's notes into phrases split at rests longer than a beat. */
function phrases(notes: Note[]): Note[][] {
  const sorted = [...notes].sort((a, b) => a.t - b.t);
  const out: Note[][] = [];
  let cur: Note[] = [];
  for (const n of sorted) {
    const last = cur[cur.length - 1];
    if (last && n.t - (last.t + last.d) > 1) {
      out.push(cur);
      cur = [];
    }
    cur.push(n);
  }
  if (cur.length) out.push(cur);
  return out;
}

function renderPart(score: Score, part: Part, bus: Stereo, sr: number, loopLen: number, rng: Rng) {
  const sec = spb(score);
  const swing = part.straight ? 0 : (score.swing ?? 0);
  const hum = part.humanize ?? { time: 0.004, vel: 0.06 };
  const place = (t: number) => {
    let s = Math.round(swingTime(t, swing) * sec * sr + hum.time * rng.gauss() * sr * 0.5);
    if (score.loop && s < 0) s += loopLen;
    return Math.max(0, s);
  };
  if (part.line) {
    for (const ph of phrases(part.notes)) {
      const first = ph[0] as Note;
      const t0 = swingTime(first.t, swing) * sec;
      const ln: LineNote[] = ph.map((n) => ({
        t: swingTime(n.t, swing) * sec - t0,
        dur: n.d * sec,
        freq: midiToHz(n.p),
        vel: Math.min(1, Math.max(0.05, n.v * (1 + hum.vel * rng.gauss() * 0.5))),
      }));
      const buf = part.line(sr, ln, rng.fork(hashSeed(`${part.name}${first.t}`)));
      mixInto(bus, buf, place(first.t), part.gain, part.pan);
    }
    return;
  }
  const voice = part.voice;
  if (!voice) throw new Error(`part ${part.name} has no instrument`);
  for (const n of part.notes) {
    const v = Math.min(1, Math.max(0.05, n.v * (1 + hum.vel * rng.gauss() * 0.5)));
    const buf = voice(
      sr,
      { freq: midiToHz(n.p), dur: n.d * sec, vel: v },
      rng.fork(hashSeed(`${n.t}:${n.p}`)),
    );
    mixInto(bus, buf, place(n.t), part.gain, part.pan);
  }
}

export function renderScore(score: Score, sr = 48000): Rendered {
  const beats = scoreBeats(score);
  const length = Math.round(beats * spb(score) * sr);
  const total = length + Math.round((score.loop ? TAIL : (score.tail ?? 2.5)) * sr);
  const layers = score.layers ?? 1;
  const rng = new Rng(hashSeed(score.id));
  const stems: Stereo[] = [];
  for (let layer = 0; layer < layers; layer++) {
    const dry = stereo(total);
    const send = stereo(total);
    const echoSend = stereo(total);
    for (const part of score.parts) {
      if ((part.layer ?? 0) !== layer) continue;
      const bus = stereo(total);
      renderPart(score, part, bus, sr, length, rng.fork(hashSeed(part.name)));
      if (part.level !== undefined) {
        const lu = loudness(bus, sr).integrated;
        if (Number.isFinite(lu)) scaleStereo(bus, dbToGain(part.level - 18 - lu));
      }
      for (let i = 0; i < total; i++) {
        const l = bus.l[i] as number;
        const r = bus.r[i] as number;
        dry.l[i] = (dry.l[i] as number) + l;
        dry.r[i] = (dry.r[i] as number) + r;
        if (part.reverb > 0) {
          send.l[i] = (send.l[i] as number) + l * part.reverb;
          send.r[i] = (send.r[i] as number) + r * part.reverb;
        }
        if (part.echo && part.echo > 0) {
          echoSend.l[i] = (echoSend.l[i] as number) + l * part.echo;
          echoSend.r[i] = (echoSend.r[i] as number) + r * part.echo;
        }
      }
    }
    const wet = reverb(send, sr, score.reverb);
    const mixG = score.reverb.mix;
    for (let i = 0; i < total; i++) {
      dry.l[i] = (dry.l[i] as number) + (wet.l[i] as number) * mixG;
      dry.r[i] = (dry.r[i] as number) + (wet.r[i] as number) * mixG;
    }
    if (score.echo) {
      const e = delay(echoSend, sr, score.echo.beats * spb(score), score.echo.feedback);
      for (let i = 0; i < total; i++) {
        dry.l[i] = (dry.l[i] as number) + (e.l[i] as number) * 0.5;
        dry.r[i] = (dry.r[i] as number) + (e.r[i] as number) * 0.5;
      }
    }
    if (score.air) {
      const fl = new Biquad(sr, "highshelf", 6000, 0.7, score.air);
      const fr = new Biquad(sr, "highshelf", 6000, 0.7, score.air);
      fl.run(dry.l);
      fr.run(dry.r);
    }
    stems.push(dry);
  }
  if (score.loop) {
    const folded = stems.map((s) => fold(s, length));
    for (const s of folded) {
      removeMean(s.l);
      removeMean(s.r);
    }
    return { stems: folded, length, sr };
  }
  for (const s of stems) {
    dcBlock(s.l, sr);
    dcBlock(s.r, sr);
  }
  return { stems, length: total, sr };
}

/** Folds everything past `length` back onto the start (the loop's wrap-around). */
export function fold(buf: Stereo, length: number): Stereo {
  const out = stereo(length);
  for (let i = 0; i < buf.l.length; i++) {
    const j = i % length;
    out.l[j] = (out.l[j] as number) + (buf.l[i] as number);
    out.r[j] = (out.r[j] as number) + (buf.r[i] as number);
  }
  return out;
}

/** Sum of stems (the full mix). */
export function mixStems(stems: Stereo[]): Stereo {
  const n = stems[0]?.l.length ?? 0;
  const out = stereo(n);
  for (const s of stems) {
    for (let i = 0; i < n; i++) {
      out.l[i] = (out.l[i] as number) + (s.l[i] as number);
      out.r[i] = (out.r[i] as number) + (s.r[i] as number);
    }
  }
  return out;
}

export const gainDb = (stems: Stereo[], db: number): void => {
  for (const s of stems) scaleStereo(s, dbToGain(db));
};
