import { sin1 } from "./core.js";

/** PolyBLEP residual for band-limited steps (t in cycles, dt = freq / sr). */
function blep(t: number, dt: number): number {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

/**
 * A band-limited oscillator whose frequency may change every sample. `freq` is either a constant
 * or a per-sample array (Hz). Shapes: sine, saw, square, pulse (width), triangle.
 */
export function osc(
  n: number,
  sr: number,
  freq: number | Float32Array,
  shape: "sine" | "saw" | "square" | "pulse" | "tri",
  width = 0.5,
  phase0 = 0,
): Float32Array {
  const out = new Float32Array(n);
  let ph = phase0 - Math.floor(phase0);
  let tri = 0;
  for (let i = 0; i < n; i++) {
    const f = typeof freq === "number" ? freq : (freq[i] as number);
    const dt = Math.min(0.45, Math.abs(f) / sr);
    let y: number;
    switch (shape) {
      case "sine":
        y = sin1(ph);
        break;
      case "saw":
        y = 2 * ph - 1 - blep(ph, dt);
        break;
      case "square":
      case "pulse":
      case "tri": {
        const w = shape === "pulse" ? width : 0.5;
        y = ph < w ? 1 : -1;
        y += blep(ph, dt);
        const t2 = ph - w + (ph < w ? 1 : 0);
        y -= blep(t2, dt);
        if (shape === "tri") {
          // leaky integration of the square gives a band-limited triangle
          tri = dt * 4 * y + (1 - dt * 0.05) * tri;
          y = tri;
        }
        break;
      }
    }
    out[i] = y;
    ph += dt;
    if (ph >= 1) ph -= 1;
  }
  return out;
}

/** Frequency curve with vibrato: base Hz, `rate` Hz, `cents` depth, `delaySec` before it fades in. */
export function vibratoCurve(
  n: number,
  sr: number,
  base: number,
  rate: number,
  cents: number,
  delaySec = 0,
  phase = 0,
): Float32Array {
  const out = new Float32Array(n);
  const d = Math.max(1, delaySec * sr);
  for (let i = 0; i < n; i++) {
    const depth = cents * Math.min(1, i / d);
    out[i] = base * 2 ** ((depth * sin1(phase + (rate * i) / sr)) / 1200);
  }
  return out;
}
