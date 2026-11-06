import { honkyTonk } from "../inst/keys.js";
import { whistle } from "../inst/leads.js";
import { celesta, glockenspiel } from "../inst/mallets.js";
import { organ } from "../inst/organ.js";
import { brushSweep, brushTap, shaker, tick, woodblock } from "../inst/percussion.js";
import { banjo, uprightBass } from "../inst/strings.js";
import {
  arp,
  bars,
  chartBars,
  grid,
  oomPah,
  pads,
  type Score,
  stabs,
  twoBeat,
  walk,
} from "../seq/score.js";
import { cat, line, part } from "./kit.js";

const at4 = (bar: number) => (bar - 1) * 4;

/**
 * "Main Street, Deathville" (the town map). G major, 112 bpm, a two-beat hoedown.
 * A: whistled tune, the house motif turned major (8) | A': banjo has it, clip-clop
 * woodblocks (8) | B: C major, the harmonium's tune (8) | A'': whistle and banjo together,
 * the last bar turning back to the top. 32 bars, about 69 s.
 */
export function town(): Score {
  const tuneA = [
    "G4:1 D5:1 B4:.5 A4:.5 G4:1",
    "F#4:.5 G4:.5 A4:.5 B4:.5 A4:2",
    "G4:1 D5:1 E5:.5 D5:.5 C5:1",
    "B4:.5 A4:.5 B4:.5 C5:.5 D5:2",
    "E5:1 D5:.5 C5:.5 B4:1 A4:1",
    "G4:.5 A4:.5 B4:.5 G4:.5 G#4:2",
    "A4:1 C5:1 F#4:1 A4:1",
  ].join(" | ");
  const chA = "G:4 | D7:4 | G:2 C:2 | G/D:2 D7:2 | C:4 | G:2 E7:2 | Am:2 D7:2 | G:4";
  const chA4 = "G:4 | D7:4 | G:2 C:2 | G/D:2 D7:2 | C:4 | G:2 E7:2 | Am:2 D7:2 | G:2 D7:2";
  const chB = "C:4 | G:4 | D7:4 | G:4 | C:4 | C#dim7:4 | G/D:2 E7:2 | A7:2 D7:2";
  const tuneB = [
    "E5:1.5 D5:.5 C5:1 G4:1",
    "B4:1.5 A4:.5 G4:2",
    "A4:1 B4:.5 C5:.5 D5:1 F#4:1",
    "G4:3 r:1",
    "E5:1.5 F5:.5 G5:1 E5:1",
    "G5:1 E5:1 C#5:1 Bb4:1",
    "D5:2 G#4:2",
    "A4:1 C#5:1 C5:1 F#4:1",
  ].join(" | ");

  const a1 = chartBars(chA, 4, at4(1));
  const a2 = chartBars(chA, 4, at4(9));
  const b = chartBars(chB, 4, at4(17));
  const a3 = chartBars(chA4, 4, at4(25));
  const all = [...a1, ...a2, ...b, ...a3];
  const roll = [0, 2, 4, 0, 2, 4, 0, 4];
  return {
    id: "town",
    title: "Main Street, Deathville",
    bpm: 112,
    beatsPerBar: 4,
    bars: 32,
    key: "G major",
    loop: true,
    reverb: { size: 0.45, damp: 0.5, pre: 0.01, mix: 1 },
    parts: [
      part(
        "whistle",
        line(whistle),
        cat(
          bars(`${tuneA} | G4:1 D4:1 G4:2`, 4, at4(1)),
          bars(`${tuneA} | G4:1 D4:1 G4:1 r:1`, 4, at4(25)),
        ),
        { level: 0, pan: -0.15, reverb: 0.3 },
      ),
      part("banjo tune", banjo, bars(`${tuneA} | G4:1 D4:1 G4:2`, 4, at4(9), 0.9), {
        level: 0,
        pan: 0.15,
        reverb: 0.15,
      }),
      part("banjo tune A''", banjo, bars(`+12 ${tuneA} | G4:1 D4:1 G4:1 r:1`, 4, at4(25), 0.7), {
        level: -6,
        pan: 0.35,
        reverb: 0.15,
      }),
      part("harmonium B", organ("reed"), bars(tuneB, 4, at4(17)), {
        level: 0,
        pan: -0.1,
        reverb: 0.3,
      }),
      part(
        "banjo roll",
        banjo,
        cat(
          arp(a1, 55, roll, 0.5, 0.55, 0.5),
          arp(b, 55, roll, 0.5, 0.55, 0.5),
          arp(a3, 55, roll, 0.5, 0.5, 0.5),
        ),
        { level: -9, pan: 0.4, reverb: 0.12 },
      ),
      part("banjo chops", banjo, stabs(a2, 55, [1, 3], 0.25, 0.6), { level: -9, pan: 0.4 }),
      part("flute", organ("flute"), pads(b, 60, 0.4, 3), { level: -12, pan: 0.2, reverb: 0.4 }),
      part("bass", uprightBass, cat(twoBeat([...a1, ...a2, ...a3], 31), walk(b, 31)), {
        level: -3,
        reverb: 0.05,
      }),
      part("clip", woodblock, grid("x.o.x.o.", 0.5, 8, 4, 79, at4(9)), {
        level: -14,
        pan: -0.5,
        straight: true,
      }),
      part("clop", woodblock, grid(".o.x.o.x", 0.5, 8, 4, 74, at4(9)), {
        level: -15,
        pan: -0.45,
        straight: true,
      }),
      part("brush tap", brushTap, grid(".x.x", 1, 32, 4, 60), { level: -12, pan: 0.2 }),
      part(
        "brush sweep",
        brushSweep,
        grid("x.x.", 1, 32, 4, 60).map((n) => ({ ...n, d: 1.9 })),
        { level: -18, pan: -0.2 },
      ),
      part("shaker", shaker, grid("oxox", 0.5, 16, 4, 60, at4(17)), { level: -17, pan: 0.5 }),
      part("glock", glockenspiel, cat(bars("G5:1 D6:1 B5:2", 4, at4(25), 0.6)), {
        level: -10,
        pan: 0.3,
        reverb: 0.4,
      }),
      part("pads", organ("chapel"), pads(all, 55, 0.4, 3), { level: -16, reverb: 0.4 }),
    ],
  };
}

/**
 * "Office Hours" (the desk). A minor, 72 bpm. A wall clock ticks through it; the celesta picks
 * out the motif slowly over a soft organ. 16 bars in two halves, about 53 s.
 */
export function desk(): Score {
  const ch =
    "Am:4 | E7:4 | Am:4 | Dm:2 E7:2 | F:4 | C:2 E7/G#:2 | Am:2 Dm:2 | E7:4 | " +
    "Am:4 | Am/G:4 | F:4 | E7:4 | Dm:4 | Am/C:4 | B7:2 E7:2 | Am:4";
  const tune =
    "A4:2 E5:2 | C5:1 B4:1 G#4:2 | A4:1 B4:1 C5:1 E5:1 | D5:2 B4:2 | C5:2 A4:2 | G4:1 C5:1 B4:2 | A4:1 C5:1 F5:1 D5:1 | E5:3 r:1 | " +
    "E5:2 A5:2 | G5:1 E5:1 C5:2 | F5:1 E5:1 D5:1 C5:1 | B4:3 r:1 | A4:1 D5:1 F5:2 | E5:1 C5:1 A4:2 | D#5:2 D5:2 | C5:1 B4:1 A4:2";
  const spans = chartBars(ch, 4);
  return {
    id: "desk",
    title: "Office Hours",
    bpm: 72,
    beatsPerBar: 4,
    bars: 16,
    key: "A minor",
    loop: true,
    reverb: { size: 0.5, damp: 0.6, pre: 0.02, mix: 1 },
    parts: [
      part("celesta", celesta, bars(tune, 4, 0, 0.7), { level: 0, pan: 0.1, reverb: 0.45 }),
      part("celesta echo", celesta, bars(`+12 ${tune.split("|").slice(8).join("|")}`, 4, 32, 0.4), {
        level: -10,
        pan: -0.4,
        reverb: 0.6,
      }),
      part("organ", organ("chapel"), pads(spans, 52, 0.35, 3), {
        level: -7,
        pan: -0.1,
        reverb: 0.5,
      }),
      part("bass", uprightBass, twoBeat(spans, 33, 0.6), { level: -5, reverb: 0.1 }),
      part("tick", tick, grid("x.", 1, 16, 4, 98), {
        level: -12,
        pan: 0.45,
        reverb: 0.1,
        straight: true,
      }),
      part("tock", tick, grid(".x", 1, 16, 4, 91), {
        level: -13,
        pan: 0.45,
        reverb: 0.1,
        straight: true,
      }),
    ],
  };
}

/**
 * "Pale Horse Rag" (the Pale Horse Cafe). B-flat major, 132 bpm, swung. A tack piano strides,
 * the tune is the house motif with a ragtime hitch. A (8) | B in E-flat (8) | A (8), with the
 * banjo doubling the second A. About 44 s.
 */
export function cafe(): Score {
  const chA = "Bb:4 | G7:4 | C7:4 | F7:4 | Bb:2 Bb7:2 | Eb:2 Edim7:2 | Bb/F:2 F7:2 | Bb:2 F7:2";
  const chB = "Eb:4 | Bb7:4 | Eb:4 | Ab:2 Adim7:2 | Eb/Bb:2 C7:2 | F7:4 | Bb:4 | F7:4";
  const tuneA =
    "Bb4:.5 F5:1 D5:.5 C5:.5 Bb4:1.5 | A4:.5 B4:.5 D5:.5 F5:.5 G5:1 D5:1 | E5:.5 G5:1 E5:.5 C5:.5 Bb4:.5 G4:1 | " +
    "A4:.5 C5:.5 Eb5:.5 F5:.5 A5:1 F5:1 | D5:1 F5:.5 D5:.5 Ab5:1 F5:1 | G5:1 Eb5:.5 C5:.5 Bb4:1 G4:1 | " +
    "F4:.5 Bb4:.5 D5:.5 F5:.5 Eb5:1 C5:1 | Bb4:1 D5:.5 Bb4:.5 r:1 F4:1";
  const tuneB =
    "G5:1.5 F5:.5 Eb5:1 Bb4:1 | Ab4:.5 Bb4:.5 D5:.5 F5:.5 Ab5:2 | G5:.5 F5:.5 Eb5:.5 D5:.5 Eb5:1 G4:1 | " +
    "C5:1 Eb5:1 Eb5:1 C5:1 | Bb4:1 Eb5:1 E5:1 G5:1 | A5:1 F5:1 Eb5:1 C5:1 | D5:1 Bb4:.5 C5:.5 D5:1 F5:1 | Eb5:1 C5:1 A4:1 F4:1";
  const a1 = chartBars(chA, 4, 0);
  const b = chartBars(chB, 4, 32);
  const a2 = chartBars(chA, 4, 64);
  const all = [...a1, ...b, ...a2];
  const stride = oomPah(all, 34, 53, 0.7);
  return {
    id: "cafe",
    title: "Pale Horse Rag",
    bpm: 132,
    beatsPerBar: 4,
    bars: 24,
    key: "B-flat major",
    swing: 1 / 6,
    loop: true,
    reverb: { size: 0.35, damp: 0.5, pre: 0.008, mix: 1 },
    parts: [
      part(
        "piano tune",
        honkyTonk,
        cat(bars(tuneA, 4, 0, 0.85), bars(tuneB, 4, 32, 0.85), bars(tuneA, 4, 64, 0.85)),
        { level: 0, pan: 0.05, reverb: 0.2 },
      ),
      part("piano octave", honkyTonk, bars(`-12 ${tuneA}`, 4, 64, 0.5), {
        level: -9,
        pan: -0.05,
        reverb: 0.2,
      }),
      part("banjo", banjo, bars(tuneA, 4, 64, 0.75), { level: -6, pan: 0.4, reverb: 0.15 }),
      part("piano stride", honkyTonk, stride.chords, { level: -6, pan: -0.15, reverb: 0.15 }),
      part("bass", uprightBass, walk(all, 31, 0.75), { level: -4, reverb: 0.05 }),
      part("brush tap", brushTap, grid(".x.x", 1, 24, 4, 60), { level: -12, pan: 0.25 }),
      part(
        "brush sweep",
        brushSweep,
        grid("x.x.", 1, 24, 4, 60).map((n) => ({ ...n, d: 1.9 })),
        { level: -18, pan: -0.25, straight: true },
      ),
    ],
  };
}
