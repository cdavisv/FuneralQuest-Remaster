import type { Stereo } from "./core.js";

/**
 * Loudness after ITU-R BS.1770-4 / EBU R128: K-weighting, 400 ms blocks with 75 % overlap,
 * the absolute gate at -70 LUFS and the relative gate 10 LU under the ungated mean. The render
 * normalises with this; the analysis cross-checks it against ffmpeg's ebur128 filter.
 */

function kWeight(x: Float32Array, sr: number): Float64Array {
  // Stage 1: the head's high shelf.
  let K = Math.tan((Math.PI * 1681.974450955533) / sr);
  const Vh = 10 ** (3.999843853973347 / 20);
  const Vb = Vh ** 0.4996667741545416;
  let Q = 0.7071752369554196;
  let a0 = 1 + K / Q + K * K;
  const s1 = {
    b0: (Vh + (Vb * K) / Q + K * K) / a0,
    b1: (2 * (K * K - Vh)) / a0,
    b2: (Vh - (Vb * K) / Q + K * K) / a0,
    a1: (2 * (K * K - 1)) / a0,
    a2: (1 - K / Q + K * K) / a0,
  };
  // Stage 2: the RLB high-pass.
  K = Math.tan((Math.PI * 38.13547087602444) / sr);
  Q = 0.5003270373238773;
  a0 = 1 + K / Q + K * K;
  const s2 = { b0: 1, b1: -2, b2: 1, a1: (2 * (K * K - 1)) / a0, a2: (1 - K / Q + K * K) / a0 };
  const out = new Float64Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  let z1 = 0;
  let z2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i] as number;
    const y = s1.b0 * v + s1.b1 * x1 + s1.b2 * x2 - s1.a1 * y1 - s1.a2 * y2;
    x2 = x1;
    x1 = v;
    y2 = y1;
    y1 = y;
    out[i] = y;
  }
  // Stage 2 as its own pass.
  x1 = 0;
  x2 = 0;
  for (let i = 0; i < out.length; i++) {
    const v = out[i] as number;
    const y = s2.b0 * v + s2.b1 * x1 + s2.b2 * x2 - s2.a1 * z1 - s2.a2 * z2;
    x2 = x1;
    x1 = v;
    z2 = z1;
    z1 = y;
    out[i] = y;
  }
  return out;
}

export interface Loudness {
  /** Integrated loudness, LUFS (-Infinity for silence). */
  integrated: number;
  /** Loudest 400 ms block, LUFS. */
  momentaryMax: number;
  /** Loudest 3 s window, LUFS. */
  shortTermMax: number;
}

const toLufs = (ms: number) => (ms > 0 ? -0.691 + 10 * Math.log10(ms) : -Infinity);

function blockPowers(chans: Float64Array[], sr: number, blockSec: number, hopSec: number) {
  const n = chans[0]?.length ?? 0;
  const block = Math.round(blockSec * sr);
  const hop = Math.round(hopSec * sr);
  // prefix sums of squares per channel
  const pre = chans.map((c) => {
    const p = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) p[i + 1] = (p[i] as number) + (c[i] as number) ** 2;
    return p;
  });
  const powers: number[] = [];
  if (n < block) {
    // A sound shorter than one block: measure what there is, as one block.
    let s = 0;
    for (const p of pre) s += (p[n] as number) / Math.max(1, block);
    powers.push(s);
    return powers;
  }
  for (let start = 0; start + block <= n; start += hop) {
    let s = 0;
    for (const p of pre) s += ((p[start + block] as number) - (p[start] as number)) / block;
    powers.push(s);
  }
  return powers;
}

export function loudness(buf: Stereo, sr: number): Loudness {
  const chans = [kWeight(buf.l, sr), kWeight(buf.r, sr)];
  const blocks = blockPowers(chans, sr, 0.4, 0.1);
  const abs = blocks.filter((p) => toLufs(p) > -70);
  let integrated = -Infinity;
  if (abs.length > 0) {
    const mean = abs.reduce((a, b) => a + b, 0) / abs.length;
    const rel = toLufs(mean) - 10;
    const gated = abs.filter((p) => toLufs(p) > rel);
    if (gated.length > 0) integrated = toLufs(gated.reduce((a, b) => a + b, 0) / gated.length);
  }
  const momentaryMax = toLufs(Math.max(0, ...blocks));
  const st = blockPowers(chans, sr, 3, 0.5);
  const shortTermMax = toLufs(Math.max(0, ...st));
  return { integrated, momentaryMax, shortTermMax };
}
