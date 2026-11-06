import { sin1 } from "../dsp/core.js";
import { Biquad } from "../dsp/filter.js";
import { addInto, burst, finish, gain, noise, ping, seeded } from "./lib.js";
import type { SfxDef } from "./types.js";

/**
 * Interface sounds, synthesised in the browser when audio starts: each renders in a millisecond
 * or two, so they cost no download and play with no fetch latency.
 */

function click(sr: number) {
  const rng = seeded("ui-click");
  const out = ping(sr, 2300, 0.05, 0.006, [
    [1, 1],
    [1.53, 0.5],
    [2.9, 0.2],
  ]);
  addInto(out, burst(sr, rng, 0.01, 0.0015, [["hp", 3500]]), 0.5);
  return finish(gain(out, 0.8), sr);
}

function hover(sr: number) {
  const rng = seeded("ui-hover");
  const out = ping(sr, 3200, 0.03, 0.004, [
    [1, 1],
    [1.7, 0.3],
  ]);
  addInto(out, burst(sr, rng, 0.008, 0.001, [["hp", 6000]]), 0.3);
  return finish(gain(out, 0.35), sr);
}

/** A sheet of paper flipped over: a swish whose band rises, with crinkle. */
function page(sr: number) {
  const rng = seeded("ui-page");
  const n = Math.round(0.34 * sr);
  const x = noise(n, rng);
  const bp = new Biquad(sr, "bp", 1500, 0.8);
  let crinkle = 1;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    if (i % 96 === 0) crinkle = 0.6 + 0.8 * rng.next();
    bp.set("bp", 900 + 3500 * t, 0.9);
    const env = Math.sin(Math.PI * t ** 0.7) ** 2;
    x[i] = bp.tick(x[i] as number) * env * crinkle;
  }
  // the page landing
  addInto(x, burst(sr, rng, 0.04, 0.008, [["bp", 2500, 1]]), 0.6, Math.round(0.28 * sr));
  return finish(gain(x, 1.4), sr, 0.1);
}

/** Pencil on a notepad: three quick scratchy strokes. */
function notepad(sr: number) {
  const rng = seeded("ui-notepad");
  const n = Math.round(0.5 * sr);
  const out = new Float32Array(n);
  const strokes: [number, number][] = [
    [0.0, 0.12],
    [0.15, 0.1],
    [0.29, 0.17],
  ];
  for (const [at, len] of strokes) {
    const m = Math.round(len * sr);
    const x = noise(m, rng);
    const hp = new Biquad(sr, "bp", 3800, 0.7);
    for (let i = 0; i < m; i++) {
      const t = i / m;
      const grain = 0.5 + 0.5 * sin1((i * 140) / sr + rng.next() * 0.2);
      x[i] = hp.tick(x[i] as number) * Math.sin(Math.PI * t) * grain;
    }
    addInto(out, x, 1, Math.round(at * sr));
  }
  return finish(gain(out, 1.2), sr, -0.1);
}

/** Chat blip: two quick rising tones. */
function chat(sr: number) {
  const a = ping(sr, 880, 0.06, 0.03, [
    [1, 1],
    [2, 0.15],
  ]);
  const b = ping(sr, 1320, 0.08, 0.035, [
    [1, 1],
    [2, 0.12],
  ]);
  const out = new Float32Array(Math.round(0.13 * sr));
  addInto(out, a, 0.6);
  addInto(out, b, 0.6, Math.round(0.045 * sr));
  return finish(out, sr);
}

/** A coin tossed on the counter: a bright inharmonic ding and a smaller bounce. */
function coin(sr: number) {
  const partials: [number, number][] = [
    [1, 1],
    [1.48, 0.6],
    [2.13, 0.45],
    [2.97, 0.25],
  ];
  const out = new Float32Array(Math.round(0.55 * sr));
  addInto(out, ping(sr, 2900, 0.45, 0.12, partials), 0.6);
  addInto(out, ping(sr, 2950, 0.3, 0.06, partials), 0.3, Math.round(0.12 * sr));
  return finish(out, sr, 0.15);
}

/** A tag earned: two glockenspiel notes, E6 then B6. */
function tag(sr: number) {
  const bar: [number, number][] = [
    [1, 1],
    [2.756, 0.25],
    [5.404, 0.08],
  ];
  const out = new Float32Array(Math.round(0.85 * sr));
  addInto(out, ping(sr, 1318.5, 0.7, 0.22, bar), 0.5);
  addInto(out, ping(sr, 1975.5, 0.7, 0.22, bar), 0.5, Math.round(0.11 * sr));
  return finish(out, sr);
}

/** A rubber stamp: the thump of the handle and the slap of rubber on paper. */
function stamp(sr: number) {
  const rng = seeded("ui-stamp");
  const n = Math.round(0.25 * sr);
  const out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const f = 90 + 80 * Math.exp(-i / (0.01 * sr));
    out[i] = sin1(ph) * Math.exp(-i / (0.045 * sr));
    ph += f / sr;
  }
  addInto(
    out,
    burst(sr, rng, 0.06, 0.012, [
      ["lp", 2200],
      ["hp", 300],
    ]),
    0.9,
  );
  return finish(gain(out, 0.9), sr);
}

/** Mail arrives: a little desk bell and an envelope sliding in. */
function mail(sr: number) {
  const rng = seeded("ui-mail");
  const out = new Float32Array(Math.round(0.9 * sr));
  const swish = noise(Math.round(0.2 * sr), rng);
  const bp = new Biquad(sr, "bp", 2500, 0.7);
  for (let i = 0; i < swish.length; i++) {
    swish[i] = bp.tick(swish[i] as number) * Math.sin((Math.PI * i) / swish.length) ** 2;
  }
  addInto(out, swish, 0.5);
  addInto(
    out,
    ping(sr, 2093, 0.7, 0.25, [
      [1, 1],
      [2.32, 0.3],
      [4.1, 0.1],
    ]),
    0.5,
    Math.round(0.15 * sr),
  );
  return finish(out, sr, 0.1);
}

const ui = (id: string, title: string, render: (sr: number) => ReturnType<typeof finish>) =>
  ({ id, title, delivery: "live", group: "ui", render }) satisfies SfxDef;

export const UI_SOUNDS: SfxDef[] = [
  ui("ui-click", "Button click: a small wooden tick", click),
  ui("ui-hover", "Hover: a faint high tick", hover),
  ui("ui-page", "Page turn: a paper swish rising in pitch, landing", page),
  ui("ui-notepad", "Notepad: three pencil strokes", notepad),
  ui("ui-chat", "Chat line: two quick rising tones", chat),
  ui("ui-coin", "Coin: an inharmonic ding and a bounce", coin),
  ui("ui-tag", "Tag earned: two glockenspiel notes", tag),
  ui("ui-stamp", "Vote stamp: handle thump and rubber slap", stamp),
  ui("ui-mail", "Mail arrives: envelope swish and a desk bell", mail),
];
