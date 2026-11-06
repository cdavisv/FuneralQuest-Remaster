/**
 * Buffers and the few numeric helpers every other module uses. Everything here is plain
 * TypeScript over Float32Array, so it runs the same in Node (the offline render) and in a
 * browser (effects synthesised on the page). Nothing reads a clock or Math.random.
 */

export type Mono = Float32Array;

export interface Stereo {
  l: Float32Array;
  r: Float32Array;
}

export const TAU = Math.PI * 2;

export const midiToHz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);
export const dbToGain = (db: number): number => 10 ** (db / 20);
export const gainToDb = (g: number): number => (g <= 0 ? -Infinity : 20 * Math.log10(g));
export const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : Math.min(x, hi));

export function stereo(length: number): Stereo {
  return { l: new Float32Array(length), r: new Float32Array(length) };
}

/** Equal-power pan gains for pan in [-1, 1]. */
export function panGains(pan: number): [number, number] {
  const a = ((clamp(pan, -1, 1) + 1) * Math.PI) / 4;
  return [Math.cos(a), Math.sin(a)];
}

/** Adds a mono signal into a stereo buffer at `offset` samples (clipped to the buffer). */
export function mixInto(dst: Stereo, src: Mono, offset: number, gain: number, pan = 0): void {
  const [gl, gr] = panGains(pan);
  const start = Math.max(0, offset);
  const end = Math.min(dst.l.length, offset + src.length);
  const L = gl * gain;
  const R = gr * gain;
  for (let i = start; i < end; i++) {
    const s = src[i - offset] as number;
    dst.l[i] = (dst.l[i] as number) + s * L;
    dst.r[i] = (dst.r[i] as number) + s * R;
  }
}

export function mixStereoInto(dst: Stereo, src: Stereo, offset: number, gain: number): void {
  const start = Math.max(0, offset);
  const end = Math.min(dst.l.length, offset + src.l.length);
  for (let i = start; i < end; i++) {
    dst.l[i] = (dst.l[i] as number) + (src.l[i - offset] as number) * gain;
    dst.r[i] = (dst.r[i] as number) + (src.r[i - offset] as number) * gain;
  }
}

export function scale(buf: Float32Array, g: number): void {
  for (let i = 0; i < buf.length; i++) buf[i] = (buf[i] as number) * g;
}

export function scaleStereo(buf: Stereo, g: number): void {
  scale(buf.l, g);
  scale(buf.r, g);
}

export function peak(buf: Float32Array): number {
  let p = 0;
  for (let i = 0; i < buf.length; i++) {
    const a = Math.abs(buf[i] as number);
    if (a > p) p = a;
  }
  return p;
}

export const peakStereo = (b: Stereo): number => Math.max(peak(b.l), peak(b.r));

/** Copies part of a stereo buffer. */
export function sliceStereo(b: Stereo, start: number, end: number): Stereo {
  return { l: b.l.slice(start, end), r: b.r.slice(start, end) };
}

/** Mono to stereo (both channels the same signal). */
export const dual = (m: Mono): Stereo => ({ l: m, r: m.slice() });

/** Sum to mono. */
export function toMono(b: Stereo): Mono {
  const out = new Float32Array(b.l.length);
  for (let i = 0; i < out.length; i++) out[i] = ((b.l[i] as number) + (b.r[i] as number)) * 0.5;
  return out;
}

/** A short linear fade at both ends, so a one-shot never starts or stops on a step. */
export function fadeEdges(buf: Float32Array, inSamples: number, outSamples: number): void {
  const n = buf.length;
  for (let i = 0; i < Math.min(inSamples, n); i++) buf[i] = (buf[i] as number) * (i / inSamples);
  for (let i = 0; i < Math.min(outSamples, n); i++) {
    const j = n - 1 - i;
    buf[j] = (buf[j] as number) * (i / outSamples);
  }
}

/** Index of the last sample louder than `threshold`, plus one. */
export function activeLength(b: Stereo, threshold = 1e-4): number {
  for (let i = b.l.length - 1; i >= 0; i--) {
    if (Math.abs(b.l[i] as number) > threshold || Math.abs(b.r[i] as number) > threshold)
      return i + 1;
  }
  return 0;
}

/** Removes DC with a gentle high-pass (about 10 Hz), in place. Not for loops: use `removeMean`. */
export function dcBlock(buf: Float32Array, sr: number): void {
  const R = 1 - (TAU * 10) / sr;
  let x1 = 0;
  let y1 = 0;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i] as number;
    const y = x - x1 + R * y1;
    x1 = x;
    y1 = y;
    buf[i] = y;
  }
}

/** Subtracts the mean: removes DC from a loop without breaking its periodicity. */
export function removeMean(buf: Float32Array): void {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] as number;
  const m = s / Math.max(1, buf.length);
  for (let i = 0; i < buf.length; i++) buf[i] = (buf[i] as number) - m;
}

/** A shared sine table: 4096 points with linear interpolation, about 1e-6 error. */
const SINE_N = 4096;
const SINE = new Float32Array(SINE_N + 1);
for (let i = 0; i <= SINE_N; i++) SINE[i] = Math.sin((i / SINE_N) * TAU);

/** sin(2*pi*phase) for phase in cycles (any real number). */
export function sin1(phase: number): number {
  const p = phase - Math.floor(phase);
  const x = p * SINE_N;
  const i = x | 0;
  const f = x - i;
  const a = SINE[i] as number;
  return a + ((SINE[i + 1] as number) - a) * f;
}

/** A soft saturator: linear near zero, tanh-like towards +-1. */
export function softClip(x: number): number {
  if (x > 3) return 1;
  if (x < -3) return -1;
  const x2 = x * x;
  return (x * (27 + x2)) / (27 + 9 * x2);
}
