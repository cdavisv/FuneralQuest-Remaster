/**
 * Listening with instruments: measurements of a rendered track that stand in for ears.
 * Key (chroma against the Krumhansl-Kessler profiles), tempo (autocorrelation of spectral flux),
 * spectral centroid, silence gaps, DC, clipping, the loop join, and narrowband "runaway"
 * resonances (a partial that stands far above its neighbourhood for the whole track).
 */

export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j] as number, re[i] as number];
      [im[i], im[j]] = [im[j] as number, im[i] as number];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const xr = (re[b] as number) * cr - (im[b] as number) * ci;
        const xi = (re[b] as number) * ci + (im[b] as number) * cr;
        re[b] = (re[a] as number) - xr;
        im[b] = (im[a] as number) - xi;
        re[a] = (re[a] as number) + xr;
        im[a] = (im[a] as number) + xi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

/** Magnitude spectra of Hann-windowed frames. */
export function stft(x: Float32Array, size: number, hop: number): Float64Array[] {
  const win = new Float64Array(size);
  for (let i = 0; i < size; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size);
  const frames: Float64Array[] = [];
  for (let s = 0; s + size <= x.length; s += hop) {
    const re = new Float64Array(size);
    const im = new Float64Array(size);
    for (let i = 0; i < size; i++) re[i] = (x[s + i] as number) * (win[i] as number);
    fft(re, im);
    const mag = new Float64Array(size / 2);
    for (let k = 0; k < size / 2; k++) mag[k] = Math.hypot(re[k] as number, im[k] as number);
    frames.push(mag);
  }
  return frames;
}

const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

function corr(a: number[], b: number[]): number {
  const ma = a.reduce((s, v) => s + v, 0) / a.length;
  const mb = b.reduce((s, v) => s + v, 0) / b.length;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    num += ((a[i] as number) - ma) * ((b[i] as number) - mb);
    da += ((a[i] as number) - ma) ** 2;
    db += ((b[i] as number) - mb) ** 2;
  }
  return num / Math.sqrt(da * db);
}

/** Estimated key, e.g. "D minor", with its correlation. */
export function estimateKey(
  frames: Float64Array[],
  sr: number,
  size: number,
): { key: string; r: number } {
  const chroma = new Array(12).fill(0) as number[];
  for (const f of frames) {
    for (let k = 1; k < f.length; k++) {
      const hz = (k * sr) / size;
      if (hz < 55 || hz > 2000) continue;
      const midi = Math.round(69 + 12 * Math.log2(hz / 440));
      const pc = ((midi % 12) + 12) % 12;
      chroma[pc] = (chroma[pc] as number) + (f[k] as number) ** 2;
    }
  }
  let best = { key: "?", r: -2 };
  for (let tonic = 0; tonic < 12; tonic++) {
    for (const [mode, prof] of [
      ["major", MAJOR_PROFILE],
      ["minor", MINOR_PROFILE],
    ] as const) {
      const rot = prof.map((_, i) => prof[(i - tonic + 12) % 12] as number);
      const r = corr(chroma, rot);
      if (r > best.r) best = { key: `${NAMES[tonic]} ${mode}`, r };
    }
  }
  return best;
}

/** Tempo in bpm from the autocorrelation of positive spectral flux (search 60 to 180). */
export function estimateTempo(x: Float32Array, sr: number): number {
  const size = 1024;
  const hop = 512;
  const frames = stft(x, size, hop);
  const flux: number[] = [];
  for (let i = 1; i < frames.length; i++) {
    let s = 0;
    const a = frames[i] as Float64Array;
    const b = frames[i - 1] as Float64Array;
    for (let k = 2; k < a.length; k++)
      s += Math.max(0, Math.log1p(a[k] as number) - Math.log1p(b[k] as number));
    flux.push(s);
  }
  const mean = flux.reduce((s, v) => s + v, 0) / flux.length;
  const f = flux.map((v) => v - mean);
  const fps = sr / hop;
  let best = 0;
  let bestScore = -Infinity;
  for (let bpm = 60; bpm <= 180; bpm += 0.5) {
    const lag = (60 / bpm) * fps;
    let s = 0;
    // sum of autocorrelation at the beat lag and at two and four beats (bars)
    for (const mult of [1, 2, 4]) {
      const L = lag * mult;
      const l0 = Math.floor(L);
      const fr = L - l0;
      let acc = 0;
      for (let i = 0; i + l0 + 1 < f.length; i++) {
        const v = (f[i + l0] as number) * (1 - fr) + (f[i + l0 + 1] as number) * fr;
        acc += (f[i] as number) * v;
      }
      s += acc / (f.length - l0);
    }
    if (s > bestScore) {
      bestScore = s;
      best = bpm;
    }
  }
  return best;
}

export function spectralCentroid(frames: Float64Array[], sr: number, size: number): number {
  let num = 0;
  let den = 0;
  for (const f of frames) {
    for (let k = 1; k < f.length; k++) {
      const p = (f[k] as number) ** 2;
      num += p * ((k * sr) / size);
      den += p;
    }
  }
  return den > 0 ? num / den : 0;
}

/** Longest stretch, in seconds, whose 50 ms RMS stays under `db` dBFS. */
export function longestSilence(x: Float32Array, sr: number, db = -60): number {
  const win = Math.round(0.05 * sr);
  const thr = 10 ** (db / 20);
  let run = 0;
  let best = 0;
  for (let s = 0; s + win <= x.length; s += win) {
    let e = 0;
    for (let i = s; i < s + win; i++) e += (x[i] as number) ** 2;
    if (Math.sqrt(e / win) < thr) {
      run += 0.05;
      best = Math.max(best, run);
    } else run = 0;
  }
  return best;
}

export const mean = (x: Float32Array): number => {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] as number;
  return s / Math.max(1, x.length);
};

export function clipped(x: Float32Array, at = 0.999): number {
  let n = 0;
  for (let i = 0; i < x.length; i++) if (Math.abs(x[i] as number) >= at) n++;
  return n;
}

/**
 * The loop join as seen by a player: the step from the last sample to the first, compared
 * with the steps around it. Returns the step and the 99.9th percentile of all steps.
 */
export function joinStep(x: Float32Array): { step: number; p999: number; ratio: number } {
  const n = x.length;
  const d: number[] = [];
  for (let i = 1; i < n; i++) d.push(Math.abs((x[i] as number) - (x[i - 1] as number)));
  d.sort((a, b) => a - b);
  const p999 = d[Math.floor(d.length * 0.999)] ?? 0;
  const step = Math.abs((x[0] as number) - (x[n - 1] as number));
  return { step, p999, ratio: p999 > 0 ? step / p999 : 0 };
}

/**
 * A stuck tone: for each frequency bin, the share of frames in which it stands at least 15 dB
 * above the mean of its third-octave neighbourhood. Melodies and chords move, so their bins
 * score well under half; a resonance ringing on its own (a filter or reverb mode running away,
 * a hum) sits there in nearly every frame. Returns the worst bin.
 */
export function runaway(
  frames: Float64Array[],
  sr: number,
  size: number,
): { share: number; hz: number; stdDb: number; stuck: boolean } {
  const n = frames[0]?.length ?? 0;
  const count = new Float64Array(n);
  const loK = Math.max(5, Math.floor((40 * size) / sr));
  const hiK = Math.min(n - 5, Math.ceil((12000 * size) / sr));
  const pre = new Float64Array(n + 1);
  for (const f of frames) {
    for (let k = 0; k < n; k++) pre[k + 1] = (pre[k] as number) + (f[k] as number);
    for (let k = loK; k < hiK; k++) {
      const lo = Math.max(1, Math.floor(k / 1.12));
      const hi = Math.min(n - 1, Math.ceil(k * 1.12));
      // the neighbourhood without the bin's own +-2 bins
      const a = Math.max(0, k - 2);
      const b = Math.min(n, k + 3);
      const sum =
        (pre[hi + 1] as number) - (pre[lo] as number) - ((pre[b] as number) - (pre[a] as number));
      const cnt = hi - lo + 1 - (b - a);
      const mean = cnt > 0 ? sum / cnt : 0;
      if (mean > 0 && (f[k] as number) > mean * 5.62) count[k] = (count[k] as number) + 1;
    }
  }
  let bestK = loK;
  for (let k = loK; k < hiK; k++) if ((count[k] as number) > (count[bestK] as number)) bestK = k;
  const share = (count[bestK] as number) / Math.max(1, frames.length);
  // A stuck resonance is also steady: its level hardly moves from frame to frame.
  const dbs = frames.map((f) => 20 * Math.log10((f[bestK] as number) + 1e-9));
  const m = dbs.reduce((a, b) => a + b, 0) / Math.max(1, dbs.length);
  const stdDb = Math.sqrt(dbs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, dbs.length));
  return { share, hz: (bestK * sr) / size, stdDb, stuck: share > 0.9 && stdDb < 3 };
}
