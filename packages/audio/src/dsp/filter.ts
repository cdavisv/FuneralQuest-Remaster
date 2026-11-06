import { clamp, TAU } from "./core.js";

export type BiquadType = "lp" | "hp" | "bp" | "notch" | "peak" | "lowshelf" | "highshelf";

/** A biquad from the RBJ audio-EQ cookbook (transposed direct form II). */
export class Biquad {
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private z1 = 0;
  private z2 = 0;

  constructor(
    private readonly sr: number,
    type: BiquadType,
    freq: number,
    q = Math.SQRT1_2,
    gainDb = 0,
  ) {
    this.set(type, freq, q, gainDb);
  }

  set(type: BiquadType, freq: number, q = Math.SQRT1_2, gainDb = 0): void {
    const f = clamp(freq, 5, this.sr * 0.49);
    const w = (TAU * f) / this.sr;
    const cw = Math.cos(w);
    const sw = Math.sin(w);
    const alpha = sw / (2 * Math.max(0.05, q));
    const A = 10 ** (gainDb / 40);
    let b0 = 1;
    let b1 = 0;
    let b2 = 0;
    let a0 = 1;
    let a1 = 0;
    let a2 = 0;
    switch (type) {
      case "lp":
        b0 = (1 - cw) / 2;
        b1 = 1 - cw;
        b2 = (1 - cw) / 2;
        a0 = 1 + alpha;
        a1 = -2 * cw;
        a2 = 1 - alpha;
        break;
      case "hp":
        b0 = (1 + cw) / 2;
        b1 = -(1 + cw);
        b2 = (1 + cw) / 2;
        a0 = 1 + alpha;
        a1 = -2 * cw;
        a2 = 1 - alpha;
        break;
      case "bp":
        b0 = alpha;
        b1 = 0;
        b2 = -alpha;
        a0 = 1 + alpha;
        a1 = -2 * cw;
        a2 = 1 - alpha;
        break;
      case "notch":
        b0 = 1;
        b1 = -2 * cw;
        b2 = 1;
        a0 = 1 + alpha;
        a1 = -2 * cw;
        a2 = 1 - alpha;
        break;
      case "peak":
        b0 = 1 + alpha * A;
        b1 = -2 * cw;
        b2 = 1 - alpha * A;
        a0 = 1 + alpha / A;
        a1 = -2 * cw;
        a2 = 1 - alpha / A;
        break;
      case "lowshelf": {
        const s = 2 * Math.sqrt(A) * alpha;
        b0 = A * (A + 1 - (A - 1) * cw + s);
        b1 = 2 * A * (A - 1 - (A + 1) * cw);
        b2 = A * (A + 1 - (A - 1) * cw - s);
        a0 = A + 1 + (A - 1) * cw + s;
        a1 = -2 * (A - 1 + (A + 1) * cw);
        a2 = A + 1 + (A - 1) * cw - s;
        break;
      }
      case "highshelf": {
        const s = 2 * Math.sqrt(A) * alpha;
        b0 = A * (A + 1 + (A - 1) * cw + s);
        b1 = -2 * A * (A - 1 + (A + 1) * cw);
        b2 = A * (A + 1 + (A - 1) * cw - s);
        a0 = A + 1 - (A - 1) * cw + s;
        a1 = 2 * (A - 1 - (A + 1) * cw);
        a2 = A + 1 - (A - 1) * cw - s;
        break;
      }
    }
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = a1 / a0;
    this.a2 = a2 / a0;
  }

  tick(x: number): number {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }

  run(buf: Float32Array): Float32Array {
    for (let i = 0; i < buf.length; i++) buf[i] = this.tick(buf[i] as number);
    return buf;
  }
}

/** Filters a buffer in place with a fresh biquad. */
export function biquad(
  buf: Float32Array,
  sr: number,
  type: BiquadType,
  freq: number,
  q = Math.SQRT1_2,
  gainDb = 0,
): Float32Array {
  return new Biquad(sr, type, freq, q, gainDb).run(buf);
}

/**
 * A state-variable filter (topology-preserving transform). Stable while its cutoff moves every
 * sample, which the swept sounds (wah, wind, the trombone's mute) need.
 */
export class Svf {
  private ic1 = 0;
  private ic2 = 0;
  private g = 0;
  private k = 1;
  private a1 = 0;
  private a2 = 0;
  private a3 = 0;
  lp = 0;
  bp = 0;
  hp = 0;

  constructor(private readonly sr: number) {}

  set(freq: number, q: number): void {
    this.g = Math.tan((Math.PI * clamp(freq, 5, this.sr * 0.45)) / this.sr);
    this.k = 1 / Math.max(0.05, q);
    this.a1 = 1 / (1 + this.g * (this.g + this.k));
    this.a2 = this.g * this.a1;
    this.a3 = this.g * this.a2;
  }

  tick(x: number): void {
    const v3 = x - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    this.lp = v2;
    this.bp = v1;
    this.hp = x - this.k * v1 - v2;
  }
}

/** One-pole low-pass, the cheapest smoothing there is. */
export class OnePole {
  private y = 0;
  private a: number;

  constructor(sr: number, freq: number) {
    this.a = Math.exp((-TAU * freq) / sr);
  }

  setFreq(sr: number, freq: number): void {
    this.a = Math.exp((-TAU * freq) / sr);
  }

  tick(x: number): number {
    this.y = x + this.a * (this.y - x);
    return this.y;
  }
}
