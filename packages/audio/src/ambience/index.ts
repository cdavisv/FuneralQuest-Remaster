import { type Stereo, sin1 } from "../dsp/core.js";
import { Biquad, Svf } from "../dsp/filter.js";
import { loopDrift } from "../dsp/noise.js";
import { osc } from "../dsp/osc.js";
import type { Rng } from "../dsp/rng.js";
import { modal } from "../inst/percussion.js";
import {
  addInto,
  burst,
  gain,
  noise,
  pair,
  periodicFilter,
  ping,
  seeded,
  Timeline,
  zeroMean,
} from "../sfx/lib.js";
import type { AmbienceDef } from "../sfx/types.js";

/**
 * Ambience beds. Each is one period of a loop: noise beds are filtered with their filters warmed
 * up on the end of the period (so the state across the join matches), slow changes come from
 * periodic drift curves, and every event is placed on a circular timeline, so whatever rings
 * past the end continues at the start.
 */

type Stage = ["lp" | "hp" | "bp" | "peak", number, number?, number?];

/** A noise bed through biquads, periodic. */
function bed(sr: number, n: number, rng: Rng, stages: Stage[]): Float32Array {
  return periodicFilter(noise(n, rng), sr, (buf) => {
    for (const [t, f, q, g] of stages) new Biquad(sr, t, f, q ?? Math.SQRT1_2, g ?? 0).run(buf);
  });
}

/** Brown-ish noise (leaky integrated white), periodic: integrate inside the warmed filter pass. */
function brownBed(sr: number, n: number, rng: Rng, lp: number): Float32Array {
  return periodicFilter(
    noise(n, rng),
    sr,
    (buf) => {
      let y = 0;
      for (let i = 0; i < buf.length; i++) {
        y = (y + 0.02 * (buf[i] as number)) * 0.997;
        buf[i] = y * 4;
      }
      new Biquad(sr, "lp", lp, 0.7).run(buf);
      new Biquad(sr, "hp", 25, 0.7).run(buf);
    },
    3,
  );
}

/** A band-pass whose centre follows a periodic curve: wind, swirls. */
function sweptBed(
  sr: number,
  n: number,
  rng: Rng,
  centre: Float32Array,
  q: number,
  lowShare: number,
  top = 1600,
): Float32Array {
  return periodicFilter(noise(n, rng), sr, (buf, start) => {
    const svf = new Svf(sr);
    for (let j = 0; j < buf.length; j++) {
      svf.set(centre[(start + j) % n] as number, q);
      svf.tick(buf[j] as number);
      buf[j] = svf.bp + lowShare * svf.lp;
    }
    // a band-pass of white noise still leaks a lot of hiss: wind lives below about 1.5 kHz
    new Biquad(sr, "lp", top, Math.SQRT1_2).run(buf);
    new Biquad(sr, "lp", top * 1.5, Math.SQRT1_2).run(buf);
  });
}

const mulCurve = (x: Float32Array, c: (i: number) => number) => {
  for (let i = 0; i < x.length; i++) x[i] = (x[i] as number) * c(i);
  return x;
};

/** Stereo circular timelines with a pan per event. */
class Scene {
  readonly L: Timeline;
  readonly R: Timeline;

  constructor(
    readonly sr: number,
    seconds: number,
  ) {
    this.L = new Timeline(sr, seconds, true);
    this.R = new Timeline(sr, seconds, true);
  }

  get n(): number {
    return this.L.length;
  }

  add(src: Float32Array, at: number, g = 1, pan = 0): void {
    const a = ((pan + 1) * Math.PI) / 4;
    this.L.add(src, at, g * Math.cos(a) * Math.SQRT2);
    this.R.add(src, at, g * Math.sin(a) * Math.SQRT2);
  }

  /** Adds a bed sample-aligned (beds are already a whole period). */
  bed(l: Float32Array, r: Float32Array, g = 1): void {
    addInto(this.L.buf, l, g);
    addInto(this.R.buf, r, g);
  }

  done(): Stereo {
    zeroMean(this.L.buf);
    zeroMean(this.R.buf);
    return pair(this.L.buf, this.R.buf);
  }
}

// --- the beds --------------------------------------------------------------------------------

function clock(sr: number): Stereo {
  const rng = seeded("amb-clock");
  const s = new Scene(sr, 8);
  for (let k = 0; k < 8; k++) {
    const tick = k % 2 === 0;
    const f = tick ? 2350 : 1720;
    const hit = modal(
      sr,
      f * (1 + 0.005 * rng.bi()),
      [
        [1, 1, 0.012],
        [1.52, 0.6, 0.009],
        [2.7, 0.3, 0.005],
        [0.21, 0.4, 0.03],
      ],
      0.08,
      rng,
    );
    s.add(hit, 0.25 + k, 0.5, 0.25);
  }
  // the room: a very low murmur of air
  const l = bed(sr, s.n, rng.fork(1), [
    ["lp", 350],
    ["hp", 50],
  ]);
  const r = bed(sr, s.n, rng.fork(2), [
    ["lp", 350],
    ["hp", 50],
  ]);
  s.bed(l, r, 0.04);
  return s.done();
}

function windBeds(sr: number, n: number, rng: Rng, low: number, span: number, level: number) {
  const gust = loopDrift(n, 7, rng);
  const centre = loopDrift(n, 9, rng);
  const howlC = loopDrift(n, 5, rng);
  const cl = new Float32Array(n);
  const hw = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    cl[i] = low + span * (centre[i] as number);
    hw[i] = 420 + 380 * (howlC[i] as number);
  }
  const amp = (i: number) => (0.25 + 0.75 * (gust[i] as number) ** 2) * level;
  const l = mulCurve(sweptBed(sr, n, rng.fork(1), cl, 0.8, 0.6), amp);
  const r = mulCurve(sweptBed(sr, n, rng.fork(2), cl, 0.8, 0.6), amp);
  // a soft whistle in the gusts, kept low: wistful, not haunted
  const h = mulCurve(
    sweptBed(sr, n, rng.fork(3), hw, 9, 0),
    (i) => 0.25 * (gust[i] as number) ** 3 * level,
  );
  return { l: addInto(l, h, 1), r: addInto(r, h, 0.8) };
}

function wind(sr: number): Stereo {
  const rng = seeded("amb-wind");
  const s = new Scene(sr, 20);
  const w = windBeds(sr, s.n, rng, 220, 650, 1);
  s.bed(w.l, w.r);
  return s.done();
}

/** One cricket chirp: three short pulses of a high sine. */
function chirp(sr: number, f: number, pulses: number): Float32Array {
  const pl = 0.012;
  const gap = 0.022;
  const out = new Float32Array(Math.round((pulses * gap + pl) * sr));
  for (let k = 0; k < pulses; k++) {
    const m = Math.round(pl * sr);
    const off = Math.round(k * gap * sr);
    for (let i = 0; i < m; i++) {
      out[off + i] =
        (out[off + i] as number) + Math.sin((Math.PI * i) / m) ** 2 * sin1((f * i) / sr);
    }
  }
  return out;
}

function owlHoot(sr: number, f: number, seconds: number, rng: Rng): Float32Array {
  const n = Math.round(seconds * sr);
  const fv = new Float32Array(n);
  for (let i = 0; i < n; i++) fv[i] = f * (1 - 0.04 * (i / n)) * (1 + 0.004 * sin1((5 * i) / sr));
  const s = osc(n, sr, fv, "sine", 0.5, rng.next());
  const br = noise(n, rng);
  new Biquad(sr, "bp", f * 2, 3).run(br);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const env =
      Math.sin(Math.PI * Math.min(1, t * 1.6)) ** 1.5 *
      (t < 0.62 ? 1 : Math.max(0, 1 - (t - 0.62) / 0.38));
    s[i] = ((s[i] as number) + 0.08 * (br[i] as number)) * env;
  }
  return s;
}

function night(sr: number): Stereo {
  const rng = seeded("amb-night");
  const s = new Scene(sr, 20);
  const crickets = [
    { m: 40, f: 4600, pan: -0.5, g: 0.22, pulses: 3 },
    { m: 37, f: 4950, pan: 0.45, g: 0.16, pulses: 3 },
    { m: 31, f: 4300, pan: 0.1, g: 0.1, pulses: 4 },
    { m: 45, f: 5200, pan: -0.15, g: 0.07, pulses: 2 },
  ];
  for (const c of crickets) {
    const wobble = loopDrift(c.m, 4, rng);
    const period = 20 / c.m;
    const off = rng.next() * period;
    for (let k = 0; k < c.m; k++) {
      s.add(
        chirp(sr, c.f * (1 + 0.004 * rng.bi()), c.pulses),
        off + k * period,
        c.g * (0.5 + 0.5 * (wobble[k] as number)),
        c.pan,
      );
    }
  }
  // a comic owl, once: "hoo... hoo-hoo"
  const o = rng.fork(9);
  s.add(owlHoot(sr, 390, 0.45, o), 11.0, 0.35, -0.6);
  s.add(owlHoot(sr, 375, 0.22, o), 11.75, 0.3, -0.6);
  s.add(owlHoot(sr, 365, 0.4, o), 12.05, 0.3, -0.6);
  // still night air
  s.bed(
    bed(sr, s.n, rng.fork(1), [
      ["lp", 700],
      ["hp", 60],
    ]),
    bed(sr, s.n, rng.fork(2), [
      ["lp", 700],
      ["hp", 60],
    ]),
    0.025,
  );
  return s.done();
}

/** A bird call of one of four kinds. */
function birdCall(sr: number, rng: Rng, kind: number): Float32Array {
  const parts: Float32Array[] = [];
  const sweep = (f0: number, f1: number, sec: number) => {
    const n = Math.round(sec * sr);
    const out = new Float32Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      out[i] = sin1(ph) * Math.sin(Math.PI * t) ** 1.5;
      ph += (f0 + (f1 - f0) * t) / sr;
    }
    return out;
  };
  const base = 0.9 + 0.2 * rng.next();
  if (kind === 0) {
    // "tee-too"
    parts.push(
      sweep(4300 * base, 3700 * base, 0.12),
      new Float32Array(Math.round(0.05 * sr)),
      sweep(3200 * base, 3150 * base, 0.16),
    );
  } else if (kind === 1) {
    // a trill of quick up-sweeps
    for (let k = 0; k < 10; k++)
      parts.push(sweep(4200 * base, 5600 * base, 0.025), new Float32Array(Math.round(0.012 * sr)));
  } else if (kind === 2) {
    // a warble
    const n = Math.round(0.4 * sr);
    const out = new Float32Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      out[i] = sin1(ph) * Math.sin(Math.PI * t);
      ph += (3000 * base + 600 * sin1((18 * i) / sr)) / sr;
    }
    parts.push(out);
  } else {
    // chip chip chip
    for (let k = 0; k < 3; k++)
      parts.push(sweep(6200 * base, 4200 * base, 0.035), new Float32Array(Math.round(0.07 * sr)));
  }
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Float32Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function birds(sr: number): Stereo {
  const rng = seeded("amb-birds");
  const s = new Scene(sr, 16);
  for (let k = 0; k < 15; k++) {
    const t = k * (16 / 15) + 0.6 * rng.next();
    s.add(birdCall(sr, rng, rng.int(0, 3)), t, 0.12 + 0.12 * rng.next(), rng.bi() * 0.8);
  }
  const w = windBeds(sr, s.n, rng.fork(5), 300, 300, 0.15);
  s.bed(w.l, w.r);
  return s.done();
}

function monitor(sr: number): Stereo {
  const rng = seeded("amb-monitor");
  const s = new Scene(sr, 12);
  const n = s.n;
  // 14 beats in 12 s: 70 per minute
  const beep = ping(sr, 960, 0.12, 0.5, [
    [1, 1],
    [3, 0.05],
  ]);
  for (let i = beep.length - Math.round(0.012 * sr); i < beep.length; i++) {
    beep[i] = (beep[i] as number) * ((beep.length - i) / Math.round(0.012 * sr));
  }
  for (let k = 0; k < 14; k++) s.add(beep, 0.3 + (k * 12) / 14, 0.18, 0.3);
  // the ventilator: three slow breaths of hiss per loop
  const breath = (i: number) => {
    const ph = ((i / n) * 3) % 1;
    return 0.15 + 0.85 * Math.max(0, Math.sin(2 * Math.PI * ph)) ** 2;
  };
  const vl = mulCurve(
    bed(sr, n, rng.fork(1), [
      ["bp", 1300, 0.6],
      ["lp", 4000],
    ]),
    breath,
  );
  const vr = mulCurve(
    bed(sr, n, rng.fork(2), [
      ["bp", 1300, 0.6],
      ["lp", 4000],
    ]),
    breath,
  );
  s.bed(vl, vr, 0.08);
  // mains hum (60 Hz: a whole number of cycles in 12 s)
  const hum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    hum[i] = 0.01 * sin1(60 * t) + 0.006 * sin1(120 * t) + 0.003 * sin1(180 * t);
  }
  s.bed(hum, hum);
  return s.done();
}

function hospital(sr: number): Stereo {
  const rng = seeded("amb-hospital");
  const s = new Scene(sr, 16);
  const n = s.n;
  s.bed(
    bed(sr, n, rng.fork(1), [
      ["lp", 500],
      ["hp", 70],
    ]),
    bed(sr, n, rng.fork(2), [
      ["lp", 500],
      ["hp", 70],
    ]),
    0.12,
  );
  const hum = new Float32Array(n);
  for (let i = 0; i < n; i++) hum[i] = 0.006 * sin1((120 * i) / sr);
  s.bed(hum, hum);
  // a distant PA chime, two soft tones, heard down a corridor
  const tone = (f: number) => {
    const t = modal(
      sr,
      f,
      [
        [1, 1, 0.9],
        [2.76, 0.2, 0.3],
        [2, 0.15, 0.5],
      ],
      2.2,
      rng,
    );
    return new Biquad(sr, "lp", 2500, 0.7).run(t);
  };
  for (const [f, t] of [
    [880, 5.0],
    [698.5, 5.45],
  ] as const) {
    const x = tone(f);
    s.add(x, t, 0.1, 0.4);
    s.add(x, t + 0.11, 0.035, -0.3);
    s.add(x, t + 0.24, 0.015, 0.1);
  }
  // footsteps passing far away, soft heels
  for (let k = 0; k < 9; k++) {
    const st = gain(burst(sr, rng, 0.05, 0.012, [["bp", 900, 1.2]]), 0.5);
    s.add(st, 10.0 + k * 0.52, 0.06 * Math.sin((Math.PI * (k + 0.5)) / 9), -0.5 + k * 0.12);
  }
  return s.done();
}

function bubbles(sr: number): Stereo {
  const rng = seeded("amb-bubbles");
  const s = new Scene(sr, 10);
  const n = s.n;
  const rate = loopDrift(200, 6, rng);
  let t = 0;
  while (t < 10) {
    const r = rate[Math.floor((t / 10) * 200)] as number;
    const f = 380 + 1100 * rng.next() ** 1.5;
    const b = ping(sr, f, 0.09, 0.012 + 0.03 * rng.next(), [[1, 1]], 0.3 + 0.6 * rng.next());
    s.add(b, t, 0.12 * (0.4 + 0.6 * rng.next()), rng.bi() * 0.4);
    t += 0.02 + (0.18 * rng.next()) / (0.4 + r);
  }
  // the pump: a low hum that labours in a slow rhythm (four strokes per loop)
  const hum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const tt = i / sr;
    const stroke = 0.6 + 0.4 * Math.sin(2 * Math.PI * (tt / 2.5)) ** 2;
    hum[i] = (0.03 * sin1(50 * tt) + 0.02 * sin1(100 * tt) + 0.01 * sin1(150 * tt)) * stroke;
  }
  s.bed(hum, hum);
  // a low gurgle in the tank
  const g = mulCurve(
    brownBed(sr, n, rng.fork(3), 260),
    (i) => 0.5 + 0.5 * (rate[Math.floor((i / n) * 200)] as number),
  );
  s.bed(g, g, 0.15);
  return s.done();
}

function fire(sr: number): Stereo {
  const rng = seeded("amb-fire");
  const s = new Scene(sr, 12);
  const n = s.n;
  const flicker = loopDrift(n, 36, rng);
  const roarL = mulCurve(
    brownBed(sr, n, rng.fork(1), 380),
    (i) => 0.55 + 0.45 * (flicker[i] as number),
  );
  const roarR = mulCurve(
    brownBed(sr, n, rng.fork(2), 380),
    (i) => 0.55 + 0.45 * (flicker[i] as number),
  );
  s.bed(roarL, roarR, 0.3);
  s.bed(bed(sr, n, rng.fork(3), [["hp", 4000]]), bed(sr, n, rng.fork(4), [["hp", 4000]]), 0.012);
  // crackles and the odd pop
  let t = 0;
  while (t < 12) {
    const big = rng.next() < 0.08;
    const c = big
      ? burst(sr, rng, 0.03, 0.006, [["bp", 700 + 600 * rng.next(), 1]])
      : burst(sr, rng, 0.008, 0.0015, [["bp", 1500 + 4500 * rng.next(), 1.2]]);
    s.add(c, t, (big ? 0.8 : 0.35) * rng.next() ** 2, rng.bi() * 0.6);
    t += 0.02 + 0.15 * rng.next();
  }
  return s.done();
}

function fogbell(sr: number): Stereo {
  const rng = seeded("amb-fogbell");
  const s = new Scene(sr, 18);
  const w = windBeds(sr, s.n, rng.fork(1), 150, 280, 0.7);
  s.bed(w.l, w.r);
  // a buoy bell rocking in the swell: a double strike, and a single one later
  const bell = (v: number) =>
    new Biquad(sr, "lp", 1800, 0.7)
      .run(
        modal(
          sr,
          312,
          [
            [0.5, 0.4, 4],
            [1, 1, 3.2],
            [1.19, 0.5, 2.4],
            [1.5, 0.3, 1.8],
            [2.0, 0.5, 1.4],
            [2.66, 0.15, 0.8],
          ],
          6.5,
          rng,
        ),
      )
      .map((x) => x * v);
  s.add(bell(1), 2.0, 0.16, 0.3);
  s.add(bell(0.6), 2.75, 0.16, 0.3);
  s.add(bell(0.85), 11.0, 0.16, 0.3);
  return s.done();
}

function rainBed(sr: number, seconds: number, seed: string, heavy: number): Scene {
  const rng = seeded(seed);
  const s = new Scene(sr, seconds);
  const n = s.n;
  const drift = loopDrift(n, Math.round(seconds / 3), rng);
  const st: Stage[] = [
    ["hp", 600],
    ["lp", 6500],
  ];
  const l = mulCurve(bed(sr, n, rng.fork(1), st), (i) => 0.8 + 0.2 * (drift[i] as number));
  const r = mulCurve(bed(sr, n, rng.fork(2), st), (i) => 0.8 + 0.2 * (drift[i] as number));
  s.bed(l, r, 0.12 * heavy);
  // drops on the roof and the gutter
  const count = Math.round(seconds * 140 * heavy);
  for (let k = 0; k < count; k++) {
    s.add(
      burst(sr, rng, 0.008, 0.0015, [["bp", 1800 + 5000 * rng.next(), 1.4]]),
      rng.next() * seconds,
      0.06 * rng.next(),
      rng.bi() * 0.9,
    );
  }
  for (let k = 0; k < seconds * 3; k++) {
    const tok = ping(sr, 900 + 700 * rng.next(), 0.06, 0.015, [
      [1, 1],
      [2.3, 0.3],
    ]);
    s.add(tok, rng.next() * seconds, 0.05 * rng.next(), rng.bi() * 0.7);
  }
  return s;
}

function rain(sr: number): Stereo {
  return rainBed(sr, 12, "amb-rain", 1).done();
}

function storm(sr: number): Stereo {
  const s = rainBed(sr, 20, "amb-storm", 1.7);
  const rng = seeded("amb-storm-thunder");
  // a distant thunder roll, folded around the loop if it runs over
  const len = Math.round(7 * sr);
  const roll = new Float32Array(len);
  let y = 0;
  for (let i = 0; i < len; i++) {
    y = (y + 0.02 * rng.bi()) * 0.998;
    roll[i] = y * 4;
  }
  new Biquad(sr, "lp", 160, 0.7).run(roll);
  new Biquad(sr, "lp", 220, 0.7).run(roll);
  new Biquad(sr, "hp", 25, 0.7).run(roll);
  const swells = [0.3, 1.1, 2.0, 3.2].map((t) => ({
    t,
    a: 0.5 + 0.5 * rng.next(),
    w: 0.4 + 0.5 * rng.next(),
  }));
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    let e = 0;
    for (const sw of swells) e += sw.a * Math.exp(-(((t - sw.t) / sw.w) ** 2));
    roll[i] =
      (roll[i] as number) *
      e *
      Math.exp(-t / 3) *
      Math.min(1, t / 0.2) *
      Math.min(1, (len - i) / (0.5 * sr));
  }
  s.add(roll, 9.0, 0.8, -0.2);
  return s.done();
}

function kitchen(sr: number): Stereo {
  const rng = seeded("amb-kitchen");
  const s = new Scene(sr, 10);
  const n = s.n;
  // the wok: a sizzle with a crackling grain, surging at each toss
  const tosses = [1.0, 3.6, 6.1, 8.4];
  const surge = (i: number) => {
    const t = i / sr;
    let e = 0.45;
    for (const ts of tosses) {
      for (const d of [-10, 0, 10]) {
        const x = t - ts - d;
        if (x > 0) e += 0.8 * Math.exp(-x / 0.9) * Math.min(1, x / 0.05);
      }
    }
    return e;
  };
  const grain = new Float32Array(n);
  let g = 0;
  for (let i = 0; i < n; i++) {
    if (i % 64 === 0) g = rng.next() ** 3;
    grain[i] = g;
  }
  const sizL = mulCurve(
    bed(sr, n, rng.fork(1), [
      ["hp", 2500],
      ["lp", 9000],
    ]),
    (i) => surge(i) * (0.3 + 0.7 * (grain[i] as number)),
  );
  const sizR = mulCurve(
    bed(sr, n, rng.fork(2), [
      ["hp", 2500],
      ["lp", 9000],
    ]),
    (i) => surge(i) * (0.3 + 0.7 * (grain[(i + 4096) % n] as number)),
  );
  s.bed(sizL, sizR, 0.1);
  // the spatula's scrape at each toss, and the odd clink of a ladle
  for (const ts of tosses) {
    const sc = noise(Math.round(0.25 * sr), rng);
    const svf = new Svf(sr);
    for (let i = 0; i < sc.length; i++) {
      svf.set(1800 + 1200 * (i / sc.length), 3);
      svf.tick(sc[i] as number);
      sc[i] = svf.bp * Math.sin((Math.PI * i) / sc.length);
    }
    s.add(sc, ts - 0.15, 0.12, 0.2);
  }
  for (const t of [2.2, 5.0, 7.3, 9.4]) {
    const clink = modal(
      sr,
      2400 + 1800 * rng.next(),
      [
        [1, 1, 0.15],
        [1.83, 0.5, 0.1],
        [2.71, 0.3, 0.06],
      ],
      0.4,
      rng,
    );
    s.add(clink, t, 0.08, rng.bi() * 0.6);
  }
  // the hood fan
  s.bed(bed(sr, n, rng.fork(3), [["bp", 180, 1]]), bed(sr, n, rng.fork(4), [["bp", 180, 1]]), 0.25);
  return s.done();
}

function bark(sr: number, rng: Rng): Float32Array {
  const b = Math.round(0.14 * sr);
  const bf = new Float32Array(b);
  for (let i = 0; i < b; i++) bf[i] = 480 - 160 * (i / b);
  const bs = osc(b, sr, bf, "saw", 0.5, rng.next());
  const out = new Float32Array(b);
  for (const [f, q] of [
    [800, 3],
    [1700, 4],
  ] as const) {
    const bp = new Biquad(sr, "bp", f, q);
    for (let i = 0; i < b; i++) out[i] = (out[i] as number) + bp.tick(bs[i] as number);
  }
  for (let i = 0; i < b; i++) out[i] = (out[i] as number) * Math.sin((Math.PI * i) / b);
  return new Biquad(sr, "lp", 1800, 0.7).run(out);
}

function street(sr: number): Stereo {
  const rng = seeded("amb-street");
  const s = new Scene(sr, 20);
  const w = windBeds(sr, s.n, rng.fork(1), 250, 400, 0.4);
  s.bed(w.l, w.r);
  for (const t of [1.5, 6.8, 15.2]) {
    const c = new Biquad(sr, "lp", 4000, 0.7).run(birdCall(sr, rng, rng.int(0, 3)));
    s.add(c, t, 0.05, rng.bi() * 0.8);
  }
  // a dog, far down the road, says something twice
  s.add(bark(sr, rng), 12.0, 0.05, 0.7);
  s.add(bark(sr, rng), 12.35, 0.045, 0.7);
  return s.done();
}

export const AMBIENCES: AmbienceDef[] = [
  { id: "amb-clock", title: "Parlor wall clock, tick-tock, room tone", seconds: 8, render: clock },
  { id: "amb-wind", title: "Graveyard wind with gusts", seconds: 20, render: wind },
  { id: "amb-night", title: "Night: crickets and an owl", seconds: 20, render: night },
  { id: "amb-birds", title: "Morning birdsong", seconds: 16, render: birds },
  {
    id: "amb-monitor",
    title: "Hospital room: heart monitor at 70 bpm, ventilator, hum",
    seconds: 12,
    render: monitor,
  },
  {
    id: "amb-hospital",
    title: "Hospital lobby: air handling, a distant chime, footsteps",
    seconds: 16,
    render: hospital,
  },
  {
    id: "amb-bubbles",
    title: "Embalming room: bubbling fluid and a pump",
    seconds: 10,
    render: bubbles,
  },
  { id: "amb-fire", title: "Crematorium fire: roar and crackle", seconds: 12, render: fire },
  { id: "amb-fogbell", title: "Fog: low wind and a buoy bell", seconds: 18, render: fogbell },
  { id: "amb-rain", title: "Steady rain on a roof", seconds: 12, render: rain },
  {
    id: "amb-storm",
    title: "Storm: heavy rain and a distant thunder roll",
    seconds: 20,
    render: storm,
  },
  {
    id: "amb-kitchen",
    title: "Yang's kitchen: wok sizzle, scrapes, clinks, the hood fan",
    seconds: 10,
    render: kitchen,
  },
  {
    id: "amb-street",
    title: "Quiet small-town street: breeze, far birds, a distant dog",
    seconds: 20,
    render: street,
  },
];
