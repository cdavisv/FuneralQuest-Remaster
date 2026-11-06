import { midiToHz, type Stereo, sin1 } from "../dsp/core.js";
import { Biquad, Svf } from "../dsp/filter.js";
import { brown } from "../dsp/noise.js";
import { osc } from "../dsp/osc.js";
import type { Rng } from "../dsp/rng.js";
import { brass, brassLine, choir, theremin } from "../inst/leads.js";
import { glockenspiel, marimba, xylophone } from "../inst/mallets.js";
import { modal, timpani } from "../inst/percussion.js";
import { harp } from "../inst/strings.js";
import type { LineNote } from "../inst/types.js";
import { pitch } from "../seq/theory.js";
import { addInto, burst, chain, finish, gain, noise, pair, ping, seeded } from "./lib.js";
import type { SfxDef } from "./types.js";

/**
 * Game effects, rendered to files by the build. Every one is made here from oscillators, noise,
 * modal resonators and the house instruments; the randomness is seeded by the effect's id.
 */

const buf = (sr: number, seconds: number) => new Float32Array(Math.round(seconds * sr));
const at = (sr: number, sec: number) => Math.round(sec * sr);
const hz = (name: string) => midiToHz(pitch(name));

// --- building blocks -------------------------------------------------------------------------

/** A small brass shop bell: bright inharmonic partials, a rattle of the clapper. */
function shopBell(sr: number, rng: Rng, strength: number, f = 2650): Float32Array {
  const fr = f * (1 + 0.01 * rng.bi());
  return gain(
    modal(
      sr,
      fr,
      [
        [1, 1, 0.5],
        [1.65, 0.5, 0.35],
        [2.4, 0.35, 0.22],
        [3.3, 0.18, 0.12],
      ],
      0.9,
      rng,
    ),
    strength,
  );
}

/** A heavy wooden thud (door, casket, stone): low modes and a dull noise. */
function thud(sr: number, rng: Rng, f: number, seconds: number, dull = 1500): Float32Array {
  const out = modal(
    sr,
    f,
    [
      [1, 1, 0.12],
      [1.9, 0.5, 0.08],
      [3.1, 0.3, 0.05],
      [4.6, 0.15, 0.03],
    ],
    seconds,
    rng,
    0.15,
  );
  addInto(out, burst(sr, rng, 0.12, 0.03, [["lp", dull]]), 0.8);
  return out;
}

/** A tiny metal tick (lock pins, safe dial, chain links). */
function metalTick(sr: number, rng: Rng, f: number, level = 1): Float32Array {
  const out = modal(
    sr,
    f * (1 + 0.05 * rng.bi()),
    [
      [1, 1, 0.012],
      [1.71, 0.6, 0.008],
      [2.63, 0.3, 0.005],
    ],
    0.05,
    rng,
  );
  addInto(out, burst(sr, rng, 0.006, 0.0012, [["hp", 4000]]), 0.4);
  return gain(out, level);
}

/** A hard click on wood (dice, bingo balls). */
function woodClick(sr: number, rng: Rng, f: number, level = 1): Float32Array {
  const out = modal(
    sr,
    f * (1 + 0.08 * rng.bi()),
    [
      [1, 1, 0.02],
      [2.2, 0.4, 0.01],
    ],
    0.06,
    rng,
  );
  addInto(out, burst(sr, rng, 0.005, 0.001, [["bp", f * 2, 1]]), 0.5);
  return gain(out, level);
}

/** Squeaky door hinge: a stick-slip pulse train through two formants, the rate wandering. */
function creak(sr: number, rng: Rng, seconds: number): Float32Array {
  const n = at(sr, seconds);
  const out = new Float32Array(n);
  let ph = 0;
  let rate = 40;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    if (i % 200 === 0) rate = 35 + 55 * Math.sin(Math.PI * t) + 10 * rng.bi();
    ph += rate / sr;
    if (ph >= 1) {
      ph -= 1;
      out[i] = 1 + 0.3 * rng.bi();
    }
  }
  const a = new Biquad(sr, "bp", 650, 6).run(out.slice());
  const b = new Biquad(sr, "bp", 1500, 8).run(out.slice());
  const c = new Biquad(sr, "bp", 2900, 10).run(out);
  for (let i = 0; i < n; i++) {
    const env = Math.sin(Math.PI * (i / n)) ** 0.6;
    out[i] = ((a[i] as number) + 0.7 * (b[i] as number) + 0.3 * (c[i] as number)) * env * 3;
  }
  return out;
}

/** Notes for a voice, mixed into a timeline: [name, start, dur, vel]. */
function _play(
  sr: number,
  out: Float32Array,
  voice: (sr: number, n: { freq: number; dur: number; vel: number }, rng: Rng) => Float32Array,
  notes: [string, number, number, number][],
  rng: Rng,
  g = 1,
): void {
  for (const [p, t, d, v] of notes)
    addInto(out, voice(sr, { freq: hz(p), dur: d, vel: v }, rng), g, at(sr, t));
}

// --- the effects -----------------------------------------------------------------------------

function cashRegister(sr: number): Stereo {
  const rng = seeded("cash-register");
  const out = buf(sr, 1.9);
  // three keys punched
  for (const [t, f] of [
    [0.0, 1700],
    [0.09, 1900],
    [0.18, 1600],
  ] as const) {
    addInto(out, metalTick(sr, rng, f, 0.5), 1, at(sr, t));
    addInto(out, burst(sr, rng, 0.03, 0.006, [["bp", 900, 1]]), 0.4, at(sr, t));
  }
  // the drawer sliding out on its runners
  const slide = noise(at(sr, 0.28), rng);
  const svf = new Svf(sr);
  for (let i = 0; i < slide.length; i++) {
    const t = i / slide.length;
    svf.set(700 + 900 * t, 2);
    svf.tick((slide[i] as number) * (1 + 0.5 * Math.sin((i / sr) * 2 * Math.PI * 45)));
    slide[i] = svf.bp * Math.sin(Math.PI * t) * 0.8;
  }
  addInto(out, slide, 1, at(sr, 0.3));
  // the bell
  const bell = modal(
    sr,
    2093,
    [
      [1, 1, 0.9],
      [2.76, 0.45, 0.4],
      [5.4, 0.2, 0.2],
      [1.5, 0.15, 0.5],
    ],
    1.3,
    rng,
  );
  addInto(out, bell, 0.9, at(sr, 0.38));
  // drawer hits its stop
  addInto(out, thud(sr, rng, 180, 0.25, 2500), 0.15, at(sr, 0.56));
  addInto(out, metalTick(sr, rng, 3200, 0.3), 1, at(sr, 0.57));
  return finish(out, sr);
}

function coins(sr: number): Stereo {
  const rng = seeded("coins");
  const out = buf(sr, 1.1);
  let t = 0;
  for (let k = 0; k < 9; k++) {
    const f = 2600 + 2400 * rng.next();
    const c = ping(sr, f, 0.35, 0.05 + 0.08 * rng.next(), [
      [1, 1],
      [1.48, 0.6],
      [2.13, 0.4],
      [2.97, 0.2],
    ]);
    addInto(out, c, 0.35 * (1 - k / 12), at(sr, t));
    t += 0.03 + 0.08 * rng.next();
  }
  return finish(out, sr, 0.1);
}

function casketThump(sr: number): Stereo {
  const rng = seeded("casket-thump");
  const out = buf(sr, 1.2);
  addInto(out, thud(sr, rng, 68, 1.0, 900), 1);
  // the lid's hardware rattles
  for (let k = 0; k < 4; k++)
    addInto(out, metalTick(sr, rng, 2200, 0.15), 1, at(sr, 0.02 + 0.03 * k));
  addInto(out, thud(sr, rng, 95, 0.4, 700), 0.35, at(sr, 0.16));
  return finish(out, sr);
}

function door(sr: number): Stereo {
  const rng = seeded("door");
  const out = buf(sr, 2.1);
  addInto(out, metalTick(sr, rng, 2400, 0.4), 1); // latch
  addInto(out, creak(sr, rng, 1.0), 0.5, at(sr, 0.05));
  addInto(out, creak(sr, rng, 0.45), 0.35, at(sr, 1.1));
  addInto(out, thud(sr, rng, 110, 0.6, 1200), 0.9, at(sr, 1.5));
  addInto(out, metalTick(sr, rng, 2000, 0.6), 1, at(sr, 1.52));
  return finish(out, sr, -0.2);
}

function walkout(sr: number): Stereo {
  const rng = seeded("walkout");
  const out = buf(sr, 2.6);
  addInto(out, thud(sr, rng, 85, 0.9, 2500), 1.1);
  addInto(out, burst(sr, rng, 0.25, 0.05, [["bp", 1800, 0.6]]), 0.4); // the frame shakes
  // the shop bell over the door jangles and settles
  let t = 0.02;
  for (let k = 0; k < 9; k++) {
    addInto(out, shopBell(sr, rng, 0.5 * (1 - k / 11)), 1, at(sr, t));
    t += 0.06 + 0.06 * k * 0.4 + 0.03 * rng.next();
  }
  return finish(out, sr, 0.15);
}

function doorbell(sr: number): Stereo {
  const rng = seeded("doorbell");
  const out = buf(sr, 1.6);
  let t = 0;
  for (let k = 0; k < 6; k++) {
    addInto(out, shopBell(sr, rng, 0.45 * (1 - k / 8)), 1, at(sr, t));
    t += 0.07 + 0.05 * rng.next() + 0.02 * k;
  }
  return finish(out, sr, 0.2);
}

function lockpick(sr: number): Stereo {
  const rng = seeded("lockpick");
  const out = buf(sr, 1.5);
  let t = 0;
  for (let k = 0; k < 14; k++) {
    addInto(
      out,
      metalTick(sr, rng, 4500 + 2500 * rng.next(), 0.25 + 0.2 * rng.next()),
      1,
      at(sr, t),
    );
    // the pick scratching between pins
    addInto(out, burst(sr, rng, 0.03, 0.01, [["hp", 5000]]), 0.08, at(sr, t + 0.01));
    t += 0.04 + 0.08 * rng.next();
  }
  // it gives: a solid click
  addInto(out, metalTick(sr, rng, 1800, 0.9), 1, at(sr, t + 0.12));
  addInto(out, thud(sr, rng, 300, 0.15, 3000), 0.25, at(sr, t + 0.12));
  return finish(out, sr);
}

function padlockBreak(sr: number): Stereo {
  const rng = seeded("padlock-break");
  const out = buf(sr, 1.7);
  // the crowbar's strike
  addInto(
    out,
    modal(
      sr,
      420,
      [
        [1, 1, 0.3],
        [2.71, 0.6, 0.2],
        [4.15, 0.4, 0.12],
        [5.8, 0.25, 0.08],
      ],
      0.9,
      rng,
    ),
    0.7,
  );
  addInto(out, burst(sr, rng, 0.05, 0.01, [["hp", 1500]]), 0.6);
  // the chain slithers
  let t = 0.12;
  for (let k = 0; k < 16; k++) {
    addInto(out, metalTick(sr, rng, 2500 + 2500 * rng.next(), 0.2), 1, at(sr, t));
    t += 0.02 + 0.04 * rng.next();
  }
  // the lock hits the ground
  addInto(out, thud(sr, rng, 260, 0.4, 3000), 0.5, at(sr, t + 0.1));
  addInto(out, metalTick(sr, rng, 1500, 0.6), 1, at(sr, t + 0.1));
  return finish(out, sr);
}

function punch(sr: number): Stereo {
  const rng = seeded("punch");
  const out = buf(sr, 0.55);
  // whoosh of the fist
  const w = noise(at(sr, 0.12), rng);
  const svf = new Svf(sr);
  for (let i = 0; i < w.length; i++) {
    const t = i / w.length;
    svf.set(500 + 2000 * t, 1.5);
    svf.tick(w[i] as number);
    w[i] = svf.bp * t * t * 0.6;
  }
  addInto(out, w, 1);
  // the hit: a pitch-dropping body thump and a snap
  const h = buf(sr, 0.35);
  let ph = 0;
  for (let i = 0; i < h.length; i++) {
    const f = 55 + 120 * Math.exp(-i / (0.02 * sr));
    h[i] = sin1(ph) * Math.exp(-i / (0.07 * sr));
    ph += f / sr;
  }
  addInto(h, burst(sr, rng, 0.06, 0.012, [["lp", 3000]]), 0.8);
  addInto(out, h, 1, at(sr, 0.12));
  return finish(out, sr);
}

function slap(sr: number): Stereo {
  const rng = seeded("slap");
  const out = buf(sr, 0.35);
  addInto(out, burst(sr, rng, 0.12, 0.018, [["bp", 1900, 0.9]]), 1.2);
  addInto(out, burst(sr, rng, 0.08, 0.01, [["hp", 4000]]), 0.5);
  addInto(out, burst(sr, rng, 0.1, 0.02, [["bp", 700, 1.2]]), 0.6);
  return finish(out, sr, 0.1);
}

function gong(sr: number): Stereo {
  const rng = seeded("gong");
  const n = at(sr, 4.8);
  const out = new Float32Array(n);
  const f0 = 98;
  const modes: [number, number, number][] = [
    [1, 1, 2.6],
    [1.52, 0.6, 2.2],
    [2.03, 0.55, 1.9],
    [2.61, 0.45, 1.6],
    [3.17, 0.35, 1.3],
    [3.94, 0.3, 1.0],
    [4.83, 0.22, 0.8],
    [5.61, 0.16, 0.6],
    [7.12, 0.1, 0.45],
  ];
  // the upper modes bloom a moment after the strike, and everything sags in pitch a little
  for (const [r, a, tau] of modes) {
    let ph = rng.next();
    const bloom = 0.05 + 0.06 * r;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const env = (1 - Math.exp(-t / bloom)) * Math.exp(-t / tau);
      out[i] = (out[i] as number) + a * env * sin1(ph);
      ph += (f0 * r * (1 - 0.006 * (1 - Math.exp(-t / 0.6)))) / sr;
    }
  }
  addInto(out, burst(sr, rng, 0.08, 0.02, [["lp", 800]]), 1.5);
  const l = out.slice();
  const r = out.slice();
  // a slight stereo shimmer from a slow beating on one side
  for (let i = 0; i < n; i++)
    r[i] = (r[i] as number) * (1 + 0.08 * Math.sin((2 * Math.PI * 1.3 * i) / sr));
  chain(l, sr, [["hp", 40]]);
  chain(r, sr, [["hp", 40]]);
  const s = pair(gain(l, 0.25), gain(r, 0.25));
  return fadeStereo(s, sr);
}

function fadeStereo(s: Stereo, sr: number): Stereo {
  const n = s.l.length;
  new Biquad(sr, "hp", 25, Math.SQRT1_2).run(s.l);
  new Biquad(sr, "hp", 25, Math.SQRT1_2).run(s.r);
  const fo = Math.round(0.3 * sr);
  const fi = Math.round(0.002 * sr);
  for (const ch of [s.l, s.r]) {
    for (let i = 0; i < fi; i++) ch[i] = (ch[i] as number) * (i / fi);
    for (let i = 0; i < fo; i++) ch[n - 1 - i] = (ch[n - 1 - i] as number) * (i / fo) ** 2;
    ch[0] = 0;
    ch[n - 1] = 0;
  }
  return s;
}

function harpGoodNews(sr: number): Stereo {
  const rng = seeded("harp-good-news");
  const out = buf(sr, 2.9);
  // C major pentatonic from C4 up two octaves and a bit, over 0.75 s
  const names = ["C4", "D4", "E4", "G4", "A4", "C5", "D5", "E5", "G5", "A5", "C6", "D6", "E6"];
  names.forEach((p, k) => {
    addInto(
      out,
      harp(sr, { freq: hz(p), dur: 0.3, vel: 0.55 + 0.03 * k }, rng),
      0.5,
      at(sr, (k * 0.75) / names.length),
    );
  });
  // the landing chord
  for (const p of ["C5", "E5", "G5", "C6"])
    addInto(out, harp(sr, { freq: hz(p), dur: 0.6, vel: 0.8 }, rng), 0.4, at(sr, 0.85));
  return finish(out, sr);
}

function failTrombone(sr: number): Stereo {
  const rng = seeded("fail-trombone");
  const notes: LineNote[] = [
    { t: 0, dur: 0.3, freq: hz("Bb3"), vel: 0.8 },
    { t: 0.36, dur: 0.3, freq: hz("A3"), vel: 0.75 },
    { t: 0.72, dur: 0.42, freq: hz("F3"), vel: 0.75 },
    { t: 1.22, dur: 1.25, freq: hz("E3"), vel: 0.8 },
  ];
  const line = brassLine({ glide: 0.05, bright: 5, wah: 0.9, vibCents: 0 })(sr, notes, rng);
  // the last note's slow, sorry wobble (a slide vibrato, added as amplitude and a little pitch)
  const out = buf(sr, 2.9);
  addInto(out, line, 1);
  const s = at(sr, 1.4);
  for (let i = s; i < out.length; i++) {
    const t = (i - s) / sr;
    out[i] =
      (out[i] as number) *
      (1 - 0.35 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 4.5 * t)) * Math.min(1, t / 0.3));
  }
  return finish(out, sr, -0.1);
}

function fanfareExact(sr: number): Stereo {
  const rng = seeded("fanfare-exact");
  const out = buf(sr, 2.6);
  const step = 0.12;
  const motif: [string, number][] = [
    ["D5", 0],
    ["A5", 1],
    ["F#5", 2],
    ["E5", 2.5],
    ["D5", 3],
  ];
  for (const [p, k] of motif) {
    addInto(out, brass(sr, { freq: hz(p), dur: step * 0.9, vel: 0.9 }, rng), 0.6, at(sr, k * step));
    addInto(
      out,
      glockenspiel(sr, { freq: hz(p) * 2, dur: 0.1, vel: 0.6 }, rng),
      0.25,
      at(sr, k * step),
    );
  }
  const c = 4 * step;
  for (const p of ["D4", "F#4", "A4", "D5", "F#5"]) {
    addInto(out, brass(sr, { freq: hz(p), dur: 1.1, vel: 1 }, rng), 0.45, at(sr, c));
  }
  addInto(out, glockenspiel(sr, { freq: hz("D6"), dur: 0.5, vel: 0.8 }, rng), 0.3, at(sr, c));
  addInto(
    out,
    glockenspiel(sr, { freq: hz("A6"), dur: 0.5, vel: 0.6 }, rng),
    0.25,
    at(sr, c + 0.12),
  );
  addInto(out, timpani(sr, { freq: hz("D2"), dur: 0.5, vel: 0.9 }, rng), 0.7, at(sr, c));
  return finish(out, sr);
}

function bingoBall(sr: number): Stereo {
  const rng = seeded("bingo-ball");
  const out = buf(sr, 1.9);
  // the cage turning: a rumble pulsing with the rotation, and balls clacking
  const rum = brown(at(sr, 1.3), rng);
  chain(rum, sr, [
    ["lp", 500],
    ["hp", 60],
  ]);
  for (let i = 0; i < rum.length; i++) {
    const t = i / sr;
    rum[i] =
      (rum[i] as number) *
      (0.6 + 0.4 * Math.sin(2 * Math.PI * 2.5 * t)) *
      Math.sin(Math.PI * Math.min(1, t / 1.3)) *
      0.5;
  }
  addInto(out, rum, 1);
  for (let k = 0; k < 40; k++) {
    const t = rng.next() * 1.25;
    addInto(
      out,
      woodClick(sr, rng, 1800 + 1500 * rng.next(), 0.15 + 0.2 * rng.next()),
      1,
      at(sr, t),
    );
  }
  // one ball drops down the chute: two knocks and a pop
  addInto(out, woodClick(sr, rng, 1300, 0.6), 1, at(sr, 1.36));
  addInto(out, woodClick(sr, rng, 1100, 0.5), 1, at(sr, 1.47));
  addInto(out, ping(sr, 420, 0.12, 0.03, [[1, 1]], 1.2), 0.7, at(sr, 1.55));
  return finish(out, sr);
}

function bingoWin(sr: number): Stereo {
  const rng = seeded("bingo-win");
  const out = buf(sr, 1.8);
  const run: [string, number][] = [
    ["G5", 0],
    ["B5", 0.09],
    ["D6", 0.18],
    ["G6", 0.27],
  ];
  for (const [p, t] of run)
    addInto(out, xylophone(sr, { freq: hz(p), dur: 0.1, vel: 0.9 }, rng), 0.6, at(sr, t));
  for (const p of ["G5", "B5", "D6", "G6"])
    addInto(out, glockenspiel(sr, { freq: hz(p), dur: 0.3, vel: 0.7 }, rng), 0.3, at(sr, 0.4));
  addInto(out, shopBell(sr, rng, 0.5, 3136), 1, at(sr, 0.4));
  addInto(out, shopBell(sr, rng, 0.35, 3136), 1, at(sr, 0.55));
  return finish(out, sr);
}

function bingoLose(sr: number): Stereo {
  const rng = seeded("bingo-lose");
  const out = buf(sr, 1.5);
  const run: [string, number][] = [
    ["E5", 0],
    ["C5", 0.16],
    ["A4", 0.32],
    ["Eb4", 0.52],
  ];
  for (const [p, t] of run)
    addInto(out, marimba(sr, { freq: hz(p), dur: 0.15, vel: 0.85 }, rng), 0.6, at(sr, t));
  // a hollow "bonk"
  addInto(out, woodClick(sr, rng, 520, 0.9), 1, at(sr, 0.78));
  return finish(out, sr, -0.1);
}

function dice(sr: number): Stereo {
  const rng = seeded("dice");
  const out = buf(sr, 1.3);
  // shaken in the hand
  for (let k = 0; k < 10; k++)
    addInto(out, woodClick(sr, rng, 2600, 0.12), 1, at(sr, rng.next() * 0.35));
  // two dice bounce on the felt-topped table, gaps shrinking
  for (const [start, f] of [
    [0.45, 1700],
    [0.48, 2100],
  ] as const) {
    let t = start;
    let gap = 0.16;
    let lvl = 0.7;
    while (lvl > 0.06) {
      addInto(out, woodClick(sr, rng, f, lvl), 1, at(sr, t));
      t += gap;
      gap *= 0.62;
      lvl *= 0.68;
    }
    // a little roll to a stop
    addInto(out, burst(sr, rng, 0.12, 0.04, [["bp", 3000, 1]]), 0.1, at(sr, t));
  }
  return finish(out, sr, 0.1);
}

function cards(sr: number): Stereo {
  const rng = seeded("cards");
  const out = buf(sr, 1.6);
  // a riffle: a burst of tiny paper flicks, accelerating then slowing
  const flick = () => burst(sr, rng, 0.012, 0.003, [["bp", 3500 + 2000 * rng.next(), 1.2]]);
  let t = 0;
  for (let k = 0; k < 40; k++) {
    addInto(out, flick(), 0.35, at(sr, t));
    t += 0.008 + 0.012 * Math.abs(Math.sin((Math.PI * k) / 40) - 1);
  }
  addInto(out, burst(sr, rng, 0.06, 0.02, [["lp", 1500]]), 0.4, at(sr, t)); // the deck squared up
  // three cards dealt: a swish and a snap each
  for (let k = 0; k < 3; k++) {
    const s = at(sr, 0.75 + 0.22 * k);
    const sw = noise(at(sr, 0.09), rng);
    const bp = new Biquad(sr, "bp", 2500, 0.8);
    for (let i = 0; i < sw.length; i++)
      sw[i] = bp.tick(sw[i] as number) * Math.sin((Math.PI * i) / sw.length);
    addInto(out, sw, 0.4, s);
    addInto(out, burst(sr, rng, 0.02, 0.004, [["bp", 1800, 1]]), 0.6, s + at(sr, 0.08));
  }
  return finish(out, sr, -0.1);
}

function slotMachine(sr: number): Stereo {
  const rng = seeded("slot-machine");
  const out = buf(sr, 2.6);
  // the lever: a ratchet
  for (let k = 0; k < 6; k++) addInto(out, metalTick(sr, rng, 1500, 0.5), 1, at(sr, k * 0.035));
  // the reels spinning: a motor whirr and a stream of detent clicks, three reels
  const spinStart = 0.25;
  const stops = [1.0, 1.35, 1.7];
  const whirr = noise(at(sr, 1.5), rng);
  const bp = new Biquad(sr, "bp", 900, 2);
  for (let i = 0; i < whirr.length; i++) {
    const t = i / sr;
    const running = stops.filter((s) => spinStart + t < s).length / 3;
    whirr[i] =
      bp.tick(whirr[i] as number) * running * 0.25 * (0.8 + 0.2 * Math.sin(2 * Math.PI * 30 * t));
  }
  addInto(out, whirr, 1, at(sr, spinStart));
  for (let r = 0; r < 3; r++) {
    for (let t = spinStart + r * 0.013; t < (stops[r] as number) - 0.02; t += 0.04) {
      addInto(out, metalTick(sr, rng, 3000 + 400 * r, 0.12), 1, at(sr, t));
    }
    // the reel clunks to a stop
    addInto(out, thud(sr, rng, 160 + 30 * r, 0.2, 2000), 0.18, at(sr, stops[r] as number));
    addInto(out, metalTick(sr, rng, 1200, 0.5), 1, at(sr, stops[r] as number));
  }
  // a small payout: two bell notes
  const bell = (f: number) =>
    modal(
      sr,
      f,
      [
        [1, 1, 0.5],
        [2.76, 0.3, 0.2],
      ],
      0.6,
      rng,
    );
  addInto(out, bell(1568), 0.8, at(sr, 1.95));
  addInto(out, bell(2093), 0.8, at(sr, 2.07));
  return finish(out, sr);
}

function thunder(sr: number): Stereo {
  const rng = seeded("thunder");
  const n = at(sr, 4.8);
  const mk = (r: Rng) => {
    // the crack: bright noise with a sharp decay, then a rolling rumble with several swells
    const crack = burst(
      sr,
      r,
      0.6,
      0.09,
      [
        ["hp", 300],
        ["lp", 7000],
      ],
      0.004,
    );
    const rum = brown(n, r);
    chain(rum, sr, [
      ["lp", 220],
      ["lp", 300],
      ["hp", 25],
    ]);
    const swells = [0.15, 0.6, 1.4, 2.2].map((t) => ({
      t,
      a: 0.5 + 0.5 * r.next(),
      w: 0.25 + 0.35 * r.next(),
    }));
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      let e = 0;
      for (const s of swells) e += s.a * Math.exp(-(((t - s.t) / s.w) ** 2));
      e += 0.5 * Math.exp(-t / 1.8) * Math.min(1, t / 0.1);
      rum[i] = (rum[i] as number) * e * Math.exp(-t / 2.4);
    }
    const out = new Float32Array(n);
    addInto(out, crack, 0.5, at(sr, 0.02));
    addInto(out, rum, 1.6);
    return out;
  };
  const l = mk(rng.fork(1));
  const r = mk(rng.fork(2));
  const s = pair(l, r);
  return fadeStereo(s, sr);
}

function rainHit(sr: number): Stereo {
  const rng = seeded("rain-hit");
  const n = at(sr, 2.4);
  const mk = (r: Rng) => {
    const out = noise(n, r);
    chain(out, sr, [
      ["hp", 900],
      ["lp", 7000],
    ]);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const e = Math.min(1, t / 0.5) ** 2 * (t < 1.2 ? 1 : Math.exp(-(t - 1.2) / 0.45));
      out[i] = (out[i] as number) * e * 0.3;
    }
    // drops, densest in the middle
    for (let k = 0; k < 160; k++) {
      const t = 0.15 + 1.6 * Math.sqrt(r.next()) * (r.next() < 0.5 ? 0.7 : 1);
      addInto(
        out,
        burst(sr, r, 0.01, 0.002, [["bp", 2000 + 5000 * r.next(), 1.5]]),
        0.25 * r.next(),
        at(sr, t),
      );
    }
    return out;
  };
  return fadeStereo(pair(mk(rng.fork(1)), mk(rng.fork(2))), sr);
}

function levelUp(sr: number): Stereo {
  const rng = seeded("level-up");
  const out = buf(sr, 1.6);
  const run = ["C5", "E5", "G5", "C6", "E6"];
  run.forEach((p, k) => {
    addInto(out, marimba(sr, { freq: hz(p), dur: 0.1, vel: 0.85 }, rng), 0.5, at(sr, k * 0.075));
    addInto(
      out,
      glockenspiel(sr, { freq: hz(p), dur: 0.1, vel: 0.5 }, rng),
      0.2,
      at(sr, k * 0.075),
    );
  });
  // the shimmer on top: a quick trill of the top two notes
  for (let k = 0; k < 6; k++) {
    const p = k % 2 === 0 ? "G6" : "C7";
    addInto(
      out,
      glockenspiel(sr, { freq: hz(p), dur: 0.05, vel: 0.5 * (1 - k / 8) }, rng),
      0.2,
      at(sr, 0.42 + k * 0.05),
    );
  }
  return finish(out, sr);
}

function toiletFlush(sr: number): Stereo {
  const rng = seeded("toilet-flush");
  const n = at(sr, 3.8);
  const out = new Float32Array(n);
  // the handle
  addInto(out, metalTick(sr, rng, 1400, 0.8), 1);
  addInto(out, thud(sr, rng, 240, 0.15, 2000), 0.3);
  // the rush: low-passed noise whose band swirls, swelling then draining away
  const w = noise(n, rng);
  const svf = new Svf(sr);
  const lp = new Biquad(sr, "lp", 2500, 0.7);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const e = t < 0.15 ? 0 : Math.min(1, (t - 0.15) / 0.25) * Math.exp(-Math.max(0, t - 0.8) / 0.9);
    svf.set(
      650 + 250 * Math.sin(2 * Math.PI * 1.7 * t) + 150 * Math.sin(2 * Math.PI * 0.63 * t),
      1.2,
    );
    svf.tick(w[i] as number);
    out[i] = (out[i] as number) + lp.tick(svf.bp + 0.25 * svf.lp) * e * 0.9;
  }
  // gurgles: rising bubble chirps, crowded at the drain
  for (let k = 0; k < 45; k++) {
    const t = 0.4 + 2.2 * rng.next() ** 1.3;
    const f = 250 + 500 * rng.next();
    addInto(
      out,
      ping(sr, f, 0.08, 0.025, [[1, 1]], 0.6 + 0.6 * rng.next()),
      0.25 * Math.exp(-(t - 0.4) / 1.6),
      at(sr, t),
    );
  }
  // the tank refilling, a thin hiss
  const fill = noise(at(sr, 1.4), rng);
  chain(fill, sr, [["bp", 3000, 1]]);
  for (let i = 0; i < fill.length; i++)
    fill[i] = (fill[i] as number) * 0.06 * Math.sin((Math.PI * i) / fill.length);
  addInto(out, fill, 1, at(sr, 2.3));
  return finish(out, sr);
}

function glint(sr: number): Stereo {
  const rng = seeded("glint");
  const out = buf(sr, 0.9);
  const times = [0, 0.07, 0.13, 0.22, 0.3];
  times.forEach((t, k) => {
    const f = 3500 + 900 * k + 300 * rng.next();
    addInto(
      out,
      ping(
        sr,
        f,
        0.4,
        0.07,
        [
          [1, 1],
          [2.01, 0.2],
        ],
        0.15,
      ),
      0.25 * (1 - k * 0.12),
      at(sr, t),
    );
  });
  return finish(out, sr, 0.2);
}

function growl(sr: number): Stereo {
  const rng = seeded("growl");
  const out = buf(sr, 1.5);
  // the growl: a rough low pulse train through dog-ish formants
  const g = at(sr, 1.05);
  const f = new Float32Array(g);
  for (let i = 0; i < g; i++) {
    const t = i / sr;
    f[i] = 95 + 12 * Math.sin(2 * Math.PI * 3 * t) + 6 * rng.bi();
  }
  const src = osc(g, sr, f, "pulse", 0.2, 0);
  const vox = new Float32Array(g);
  for (const [fr, q, a] of [
    [450, 4, 1],
    [1100, 5, 0.6],
    [2400, 6, 0.25],
  ] as const) {
    const bp = new Biquad(sr, "bp", fr, q);
    for (let i = 0; i < g; i++) vox[i] = (vox[i] as number) + bp.tick(src[i] as number) * a;
  }
  for (let i = 0; i < g; i++) {
    const t = i / sr;
    const rough = 0.6 + 0.4 * Math.sin(2 * Math.PI * 27 * t);
    vox[i] = (vox[i] as number) * rough * Math.sin(Math.PI * Math.min(1, t / 1.05)) ** 0.5;
  }
  addInto(out, vox, 1.2);
  // ...and a small "arf" at the end: comic, not menacing
  const b = at(sr, 0.13);
  const bf = new Float32Array(b);
  for (let i = 0; i < b; i++) bf[i] = 520 - 180 * (i / b);
  const bs = osc(b, sr, bf, "saw", 0.5, 0);
  const arf = new Float32Array(b);
  for (const [fr, q] of [
    [900, 3],
    [1800, 4],
  ] as const) {
    const bp = new Biquad(sr, "bp", fr, q);
    for (let i = 0; i < b; i++) arf[i] = (arf[i] as number) + bp.tick(bs[i] as number);
  }
  for (let i = 0; i < b; i++) arf[i] = (arf[i] as number) * Math.sin((Math.PI * i) / b);
  addInto(out, arf, 0.9, at(sr, 1.18));
  return finish(out, sr, -0.15);
}

function angelic(sr: number): Stereo {
  const rng = seeded("angelic");
  const out = buf(sr, 2.6);
  const ah = choir("ah");
  for (const p of ["C4", "E4", "G4", "C5", "E5"])
    addInto(out, ah(sr, { freq: hz(p), dur: 1.3, vel: 0.8 }, rng), 0.5, at(sr, 0.05));
  ["G4", "C5", "E5", "G5", "C6", "E6", "G6"].forEach((p, k) => {
    addInto(out, harp(sr, { freq: hz(p), dur: 0.3, vel: 0.6 }, rng), 0.35, at(sr, k * 0.06));
  });
  return finish(out, sr);
}

function siren(sr: number): Stereo {
  const rng = seeded("siren");
  const n = at(sr, 2.6);
  // a hi-lo two-tone with a doppler sag as it passes, panned across
  const f = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const hi = Math.floor(t / 0.32) % 2 === 0;
    const dop = 1 + 0.04 * Math.tanh((1.3 - t) * 2.5);
    f[i] = (hi ? 960 : 720) * dop;
  }
  // smooth the steps between tones a little
  const sm = new Biquad(sr, "lp", 40, 0.7);
  for (let i = 0; i < n; i++) f[i] = sm.tick(f[i] as number);
  for (let i = 0; i < Math.round(0.05 * sr); i++) f[i] = f[Math.round(0.05 * sr)] as number;
  const sq = osc(n, sr, f, "square", 0.5, rng.next());
  chain(sq, sr, [
    ["lp", 2500],
    ["bp", 1100, 0.6],
  ]);
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const near = Math.exp(-(((t - 1.3) / 0.75) ** 2));
    const pan = Math.tanh((t - 1.3) * 1.5);
    const a = (0.15 + 0.85 * near) * 0.5;
    l[i] = (sq[i] as number) * a * Math.cos(((pan + 1) * Math.PI) / 4);
    r[i] = (sq[i] as number) * a * Math.sin(((pan + 1) * Math.PI) / 4);
  }
  return fadeStereo(pair(l, r), sr);
}

function psychic(sr: number): Stereo {
  const rng = seeded("psychic");
  const notes: LineNote[] = [
    { t: 0, dur: 0.45, freq: hz("A4"), vel: 0.8 },
    { t: 0.45, dur: 0.4, freq: hz("E5"), vel: 0.85 },
    { t: 0.85, dur: 0.35, freq: hz("C5"), vel: 0.8 },
    { t: 1.2, dur: 0.7, freq: hz("A5"), vel: 0.85 },
  ];
  const out = buf(sr, 2.4);
  addInto(out, theremin(sr, notes, rng), 1);
  return finish(out, sr);
}

function alarmBell(sr: number): Stereo {
  const rng = seeded("alarm-bell");
  const out = buf(sr, 2.3);
  // an electric bell: the hammer strikes about 22 times a second for two seconds
  for (let t = 0; t < 2.0; t += 1 / 22) {
    const strike = modal(
      sr,
      1750,
      [
        [1, 1, 0.12],
        [2.32, 0.5, 0.06],
        [3.9, 0.25, 0.04],
      ],
      0.3,
      rng,
    );
    addInto(out, strike, 0.18 * (0.85 + 0.15 * rng.next()), at(sr, t));
  }
  return finish(out, sr);
}

function rattle(sr: number): Stereo {
  const rng = seeded("rattle");
  const n = at(sr, 1.6);
  const out = new Float32Array(n);
  // segments of the rattle clicking against each other ~50 times a second
  let t = 0;
  while (t < 1.5) {
    const env = Math.sin(Math.PI * (t / 1.5)) ** 0.5;
    addInto(
      out,
      burst(sr, rng, 0.012, 0.003, [
        ["hp", 3000],
        ["lp", 9000],
      ]),
      0.5 * env,
      at(sr, t),
    );
    t += 1 / (48 + 6 * rng.bi());
  }
  return finish(out, sr, 0.2);
}

function safeClick(sr: number): Stereo {
  const rng = seeded("safe-click");
  const out = buf(sr, 2.1);
  let t = 0;
  for (let k = 0; k < 12; k++) {
    addInto(out, metalTick(sr, rng, 2800, k === 4 || k === 9 ? 0.7 : 0.25), 1, at(sr, t));
    t += 0.06 + (k === 4 || k === 9 ? 0.15 : 0);
  }
  // the handle turns and the bolts slide back
  addInto(out, thud(sr, rng, 140, 0.4, 1800), 0.7, at(sr, t + 0.15));
  addInto(out, metalTick(sr, rng, 1200, 0.8), 1, at(sr, t + 0.15));
  addInto(out, creak(sr, rng, 0.45), 0.25, at(sr, t + 0.35));
  return finish(out, sr);
}

function monument(sr: number): Stereo {
  const rng = seeded("monument");
  const out = buf(sr, 1.6);
  // a short grinding scrape as it is shifted into place
  const sc = noise(at(sr, 0.35), rng);
  chain(sc, sr, [
    ["lp", 900],
    ["hp", 120],
  ]);
  for (let i = 0; i < sc.length; i++) {
    sc[i] =
      (sc[i] as number) *
      Math.sin((Math.PI * i) / sc.length) *
      (0.6 + 0.4 * Math.sin((2 * Math.PI * 23 * i) / sr));
  }
  addInto(out, sc, 0.5);
  // the stone settles: a deep thud
  addInto(out, thud(sr, rng, 48, 1.0, 600), 1.2, at(sr, 0.35));
  // grit
  for (let k = 0; k < 8; k++)
    addInto(
      out,
      burst(sr, rng, 0.01, 0.002, [["bp", 2500, 1]]),
      0.15,
      at(sr, 0.37 + 0.2 * rng.next()),
    );
  return finish(out, sr);
}

const fx = (id: string, title: string, render: (sr: number) => Stereo): SfxDef => ({
  id,
  title,
  delivery: "file",
  group: "sfx",
  render,
});

export const EFFECTS: SfxDef[] = [
  fx("cash-register", "Cash register: keys, drawer, bell, drawer stop", cashRegister),
  fx("coins", "A handful of coins on a counter", coins),
  fx("casket-thump", "A casket set down: wooden thud and rattling hardware", casketThump),
  fx("door", "Door: latch, creaking hinge, closing thud", door),
  fx("walkout", "Customer walks out: door slam and the jangling shop bell", walkout),
  fx("doorbell", "Customer arrives: the shop bell over the door", doorbell),
  fx("lockpick", "Lock pick working the pins, then the click", lockpick),
  fx("padlock-break", "Padlock broken off: strike, chain, the lock hits the floor", padlockBreak),
  fx("punch", "Comic punch: whoosh and thump", punch),
  fx("slap", "Slap", slap),
  fx("gong", "Gong (a loss)", gong),
  fx("harp-good-news", "Harp glissando up (good news)", harpGoodNews),
  fx("fail-trombone", "Muted trombone, falling (a fail)", failTrombone),
  fx("fanfare-exact", "Exact-match fanfare: the house motif in D major and a chord", fanfareExact),
  fx("bingo-ball", "Bingo cage turning, a ball drops out", bingoBall),
  fx("bingo-win", "Bingo win: xylophone run and bells", bingoWin),
  fx("bingo-lose", "Bingo loss: falling marimba and a bonk", bingoLose),
  fx("dice", "Dice shaken and thrown", dice),
  fx("cards", "Cards shuffled and three dealt", cards),
  fx("slot-machine", "Slot machine: lever, reels, three stops, a small payout", slotMachine),
  fx("thunder", "Thunder: crack and roll", thunder),
  fx("rain-hit", "A gust of rain arriving", rainHit),
  fx("level-up", "Training complete: rising arpeggio and shimmer", levelUp),
  fx("toilet-flush", "Toilet flush: handle, rush, gurgles, refill", toiletFlush),
  fx("glint", "A ring sparkles", glint),
  fx("growl", "A small dog growls, then arfs", growl),
  fx("angelic", "Divine approval: choir chord and harp", angelic),
  fx("siren", "Ambulance passing", siren),
  fx("psychic", "Psychic theremin swoop", psychic),
  fx("alarm-bell", "Fire alarm bell", alarmBell),
  fx("rattle", "Rattlesnake rattle", rattle),
  fx("safe-click", "Safe dial clicks, the bolts and the door", safeClick),
  fx("monument", "A heavy stone set in place", monument),
];
