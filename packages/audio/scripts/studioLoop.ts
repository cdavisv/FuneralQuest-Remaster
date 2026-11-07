/**
 * Making a loop out of a generated recording (the Studio pack). A generated piece is not
 * periodic: it has an intro, phrases that drift, often an ending. This finds the beat (spectral
 * flux, autocorrelation tempo with the brief's tempo as a prior, then a dynamic-programming beat
 * tracker), picks the bar lines (the beat phase with the most low-frequency attack), and chooses
 * the pair of bar lines, about the wanted length apart, whose surroundings sound most alike
 * (chroma and band energy a bar either side). The period is the music between them, with the
 * music that follows the end crossfaded into its head over one beat (equal power), so the jump
 * from the end back to the start lands on the continuation the end was heading for.
 *
 * Ambience has no bars: `tailIntoHead` crossfades the recording's own tail into its head.
 */
import type { Stereo } from "../src/dsp/core.js";
import { stft } from "./analysis.js";

const SIZE = 2048;
const HOP = 512;

export interface BeatGrid {
  /** Frames per second of the analysis (sr / HOP). */
  fps: number;
  bpm: number;
  /** Beat times, seconds. */
  beats: number[];
  /** Bar-line times, seconds. */
  downbeats: number[];
  beatsPerBar: number;
}

export interface LoopChoice {
  start: number;
  end: number;
  bars: number;
  /** Mean cosine similarity (0..1) of the two seams' surroundings. */
  similarity: number;
  crossfade: number;
}

export function monoOf(x: Stereo): Float32Array {
  const m = new Float32Array(x.l.length);
  for (let i = 0; i < m.length; i++) m[i] = ((x.l[i] as number) + (x.r[i] as number)) / 2;
  return m;
}

interface Frames {
  mags: Float64Array[];
  flux: Float64Array;
  lowFlux: Float64Array;
}

function frames(x: Float32Array, sr: number): Frames {
  const mags = stft(x, SIZE, HOP);
  const flux = new Float64Array(mags.length);
  const lowFlux = new Float64Array(mags.length);
  const lowK = Math.round((200 * SIZE) / sr);
  for (let i = 1; i < mags.length; i++) {
    const a = mags[i] as Float64Array;
    const b = mags[i - 1] as Float64Array;
    let s = 0;
    let lo = 0;
    for (let k = 1; k < a.length; k++) {
      const d = Math.max(
        0,
        Math.log1p(100 * (a[k] as number)) - Math.log1p(100 * (b[k] as number)),
      );
      s += d;
      if (k <= lowK) lo += d;
    }
    flux[i] = s;
    lowFlux[i] = lo;
  }
  // remove a slow local mean so the beat tracker sees attacks, not loudness
  const w = 16;
  const hp = new Float64Array(flux.length);
  for (let i = 0; i < flux.length; i++) {
    let m = 0;
    let n = 0;
    for (let j = Math.max(0, i - w); j <= Math.min(flux.length - 1, i + w); j++) {
      m += flux[j] as number;
      n++;
    }
    hp[i] = Math.max(0, (flux[i] as number) - m / n);
  }
  return { mags, flux: hp, lowFlux };
}

/** Tempo by autocorrelation of the onset envelope, weighted toward `prior` bpm (log-Gaussian). */
export function trackTempo(flux: Float64Array, fps: number, prior: number): number {
  let best = prior;
  let bestScore = -Infinity;
  const n = flux.length;
  for (let bpm = 50; bpm <= 210; bpm += 0.25) {
    const lag = (60 / bpm) * fps;
    let s = 0;
    for (const mult of [1, 2, 4]) {
      const L = lag * mult;
      const l0 = Math.floor(L);
      const fr = L - l0;
      let acc = 0;
      for (let i = 0; i + l0 + 1 < n; i++) {
        const v = (flux[i + l0] as number) * (1 - fr) + (flux[i + l0 + 1] as number) * fr;
        acc += (flux[i] as number) * v;
      }
      s += acc / Math.max(1, n - l0);
    }
    const w = Math.exp(-0.5 * (Math.log2(bpm / prior) / 0.5) ** 2);
    if (s * w > bestScore) {
      bestScore = s * w;
      best = bpm;
    }
  }
  return best;
}

/** Ellis's dynamic-programming beat tracker over the onset envelope. Returns beat frames. */
export function trackBeats(flux: Float64Array, period: number, tightness = 100): number[] {
  const n = flux.length;
  let sd = 0;
  for (let i = 0; i < n; i++) sd += (flux[i] as number) ** 2;
  sd = Math.sqrt(sd / Math.max(1, n)) || 1;
  const score = new Float64Array(n);
  const back = new Int32Array(n).fill(-1);
  for (let t = 0; t < n; t++) {
    const o = (flux[t] as number) / sd;
    let best = 0;
    let arg = -1;
    const lo = Math.max(0, Math.round(t - 2 * period));
    const hi = Math.round(t - period / 2);
    for (let p = lo; p <= hi; p++) {
      const pen = -tightness * Math.log((t - p) / period) ** 2;
      const v = (score[p] as number) + pen;
      if (arg < 0 || v > best) {
        best = v;
        arg = p;
      }
    }
    score[t] = o + (arg >= 0 ? best : 0);
    back[t] = arg;
  }
  let t = n - 1;
  let bestEnd = -Infinity;
  for (let i = Math.max(0, n - Math.round(period)); i < n; i++) {
    if ((score[i] as number) > bestEnd) {
      bestEnd = score[i] as number;
      t = i;
    }
  }
  const beats: number[] = [];
  while (t >= 0) {
    beats.push(t);
    t = back[t] as number;
  }
  return beats.reverse();
}

export function beatGrid(x: Float32Array, sr: number, priorBpm: number, beatsPerBar: number) {
  const f = frames(x, sr);
  const fps = sr / HOP;
  const bpm = trackTempo(f.flux, fps, priorBpm);
  const beatFrames = trackBeats(f.flux, (60 / bpm) * fps);
  // Bar lines: the beat phase whose beats carry the most low-frequency attack (kick, bass).
  let bestPhase = 0;
  let bestV = -Infinity;
  for (let ph = 0; ph < beatsPerBar; ph++) {
    let v = 0;
    let c = 0;
    for (let i = ph; i < beatFrames.length; i += beatsPerBar) {
      const b = beatFrames[i] as number;
      for (let d = -1; d <= 1; d++) v += (f.lowFlux[b + d] as number) ?? 0;
      c++;
    }
    if (c && v / c > bestV) {
      bestV = v / c;
      bestPhase = ph;
    }
  }
  const beats = beatFrames.map((b) => (b * HOP + SIZE / 2) / sr);
  const downbeats = beats.filter((_, i) => i % beatsPerBar === bestPhase % beatsPerBar);
  // the tracked tempo as the median inter-beat interval (what the beats actually do)
  const ibi = beats
    .slice(1)
    .map((b, i) => b - (beats[i] as number))
    .sort((a, b) => a - b);
  const median = ibi[Math.floor(ibi.length / 2)] ?? 60 / bpm;
  const grid: BeatGrid = { fps, bpm: 60 / median, beats, downbeats, beatsPerBar };
  return { grid, frames: f };
}

/** Per-frame features for seam matching: 12 chroma bins and 8 log band energies, unit length. */
function features(mags: Float64Array[], sr: number): Float64Array[] {
  const edges = [40, 120, 250, 500, 1000, 2000, 4000, 8000, 16000];
  return mags.map((m) => {
    const v = new Float64Array(20);
    for (let k = 1; k < m.length; k++) {
      const hz = (k * sr) / SIZE;
      const p = (m[k] as number) ** 2;
      if (hz >= 60 && hz <= 2500) {
        const pc = (((Math.round(69 + 12 * Math.log2(hz / 440)) % 12) + 12) % 12) as number;
        v[pc] = (v[pc] as number) + p;
      }
      for (let b = 0; b < 8; b++)
        if (hz >= (edges[b] as number) && hz < (edges[b + 1] as number))
          v[12 + b] = (v[12 + b] as number) + p;
    }
    let cs = 0;
    for (let i = 0; i < 12; i++) cs += v[i] as number;
    for (let i = 0; i < 12; i++) v[i] = cs > 0 ? (v[i] as number) / cs : 0;
    for (let b = 0; b < 8; b++) v[12 + b] = Math.log10((v[12 + b] as number) + 1e-9) / 10;
    let n = 0;
    for (let i = 0; i < 20; i++) n += (v[i] as number) ** 2;
    n = Math.sqrt(n) || 1;
    for (let i = 0; i < 20; i++) v[i] = (v[i] as number) / n;
    return v;
  });
}

/** The time after which the recording is ending (its level stays 6 dB under its median). */
export function usableEnd(x: Float32Array, sr: number): number {
  const win = Math.round(0.5 * sr);
  const lv: number[] = [];
  for (let s = 0; s + win <= x.length; s += win) {
    let e = 0;
    for (let i = s; i < s + win; i++) e += (x[i] as number) ** 2;
    lv.push(10 * Math.log10(e / win + 1e-12));
  }
  const sorted = [...lv].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)] ?? -60;
  let last = lv.length - 1;
  while (last > 0 && (lv[last] as number) < med - 6) last--;
  return ((last + 1) * win) / sr;
}

/**
 * Chooses the loop: bar lines s < e with e - s within [minSec, maxSec] (preferring `targetSec`),
 * s after the first bar, e plus a beat of crossfade before the recording starts ending.
 */
export function chooseLoop(
  x: Float32Array,
  sr: number,
  grid: BeatGrid,
  mags: Float64Array[],
  o: { targetSec: number; minSec: number; maxSec: number; fixedBars?: number },
): LoopChoice {
  const feats = features(mags, sr);
  const fps = grid.fps;
  const beat = 60 / grid.bpm;
  const bar = beat * grid.beatsPerBar;
  const crossfade = Math.min(0.6, Math.max(0.12, beat));
  const endLimit = usableEnd(x, sr) - crossfade - 0.05;
  const ctx = Math.round(bar * fps);
  const at = (t: number) => Math.round((t * sr - SIZE / 2) / HOP);
  const seamSim = (a: number, b: number) => {
    let s = 0;
    let n = 0;
    for (let d = -ctx; d < ctx; d++) {
      const fa = feats[at(a) + d];
      const fb = feats[at(b) + d];
      if (!fa || !fb) continue;
      let dot = 0;
      for (let i = 0; i < 20; i++) dot += (fa[i] as number) * (fb[i] as number);
      s += dot;
      n++;
    }
    return n ? s / n : 0;
  };
  const db = grid.downbeats;
  let best: LoopChoice | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < db.length; i++) {
    const s = db[i] as number;
    if (s < Math.min(bar, 2)) continue;
    for (let j = i + 1; j < db.length; j++) {
      const e = db[j] as number;
      const len = e - s;
      if (e > endLimit) break;
      if (o.fixedBars !== undefined ? j - i !== o.fixedBars : len < o.minSec || len > o.maxSec)
        continue;
      const sim = seamSim(s, e);
      const score = sim - 0.15 * Math.abs(Math.log(len / o.targetSec));
      if (score > bestScore) {
        bestScore = score;
        best = { start: s, end: e, bars: j - i, similarity: sim, crossfade };
      }
    }
  }
  if (!best) throw new Error("no pair of bar lines fits the wanted loop length");
  return best;
}

/**
 * The period [start, end) with the `fade` seconds after `end` crossfaded into its head (equal
 * power). Sample-exact: the jump from the period's end to its start is the recording's own
 * continuity at `end`.
 */
export function cutLoop(x: Stereo, sr: number, start: number, end: number, fade: number): Stereo {
  const s = Math.round(start * sr);
  const e = Math.round(end * sr);
  const F = Math.round(fade * sr);
  const L = e - s;
  if (e + F > x.l.length) throw new Error("not enough recording after the loop end to crossfade");
  const out: Stereo = { l: x.l.slice(s, e), r: x.r.slice(s, e) };
  for (let i = 0; i < F && i < L; i++) {
    const th = ((i + 0.5) / F) * (Math.PI / 2);
    const gin = Math.sin(th);
    const gout = Math.cos(th);
    out.l[i] = (x.l[s + i] as number) * gin + (x.l[e + i] as number) * gout;
    out.r[i] = (x.r[s + i] as number) * gin + (x.r[e + i] as number) * gout;
  }
  return out;
}

/** An ambience loop: the last `fade` seconds crossfaded into the head; the period drops them. */
export function tailIntoHead(x: Stereo, sr: number, fade: number): Stereo {
  const F = Math.round(fade * sr);
  return cutLoop(x, sr, 0, (x.l.length - F) / sr, fade);
}
