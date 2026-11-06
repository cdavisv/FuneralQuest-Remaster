import { electricPiano } from "../inst/keys.js";
import { clarinet, sineBass, stringPad, theremin } from "../inst/leads.js";
import { celesta, glockenspiel, marimba, vibraphone } from "../inst/mallets.js";
import { organ } from "../inst/organ.js";
import { brushSweep, brushTap, shaker, snap } from "../inst/percussion.js";
import { harp, pizzicato, uprightBass } from "../inst/strings.js";
import {
  arp,
  bars,
  chartBars,
  gliss,
  grid,
  mel,
  type Note,
  PENTATONIC,
  pads,
  pitch,
  type Score,
  type Span,
  stabs,
  twoBeat,
} from "../seq/score.js";
import { bassNote } from "../seq/theory.js";
import { cat, line, part } from "./kit.js";

const at4 = (bar: number) => (bar - 1) * 4;

/** Bossa bass: root on 1, fifth on the "and" of 2, root on 3, fifth on the "and" of 4. */
function bossaBass(spans: Span[], low: number, vel = 0.75): Note[] {
  const out: Note[] = [];
  for (const s of spans) {
    const root = bassNote(s.c, low);
    const fifth = root + 7 > low + 14 ? root - 5 : root + 7;
    for (let b = 0; b < s.d; b += 2) {
      out.push({ t: s.t + b, d: 1.3, p: root, v: vel });
      if (b + 1.5 < s.d) out.push({ t: s.t + b + 1.5, d: 0.45, p: fifth, v: vel * 0.8 });
    }
  }
  return out;
}

/**
 * "Fortune Favors the Takeout" (Yang's). A major, 108 bpm, a light bossa: marimba tune (the motif
 * in major), vibraphone bridge in D, pizzicato bass, shaker and rim clicks, a harp sweep and a
 * glockenspiel "lucky" chime at each section. A (8) | B (8) | A' (8), about 53 s.
 */
export function yangs(): Score {
  const chA = "Amaj7:4 | F#m7:4 | Bm7:4 | E7:4 | Amaj7:4 | D:2 Dm6:2 | C#m7:2 F#7:2 | Bm7:2 E7:2";
  const chB =
    "Dmaj7:4 | C#m7:4 | Bm7:4 | E7:4 | Dmaj7:4 | G#m7b5:2 C#7:2 | F#m7:2 B7:2 | Bm7:2 E7:2";
  const tuneA =
    "A4:1 E5:1 C#5:.5 B4:.5 A4:1 | F#4:.5 A4:.5 C#5:.5 E5:.5 C#5:2 | B4:1 F#5:1 D5:.5 C#5:.5 B4:1 | G#4:.5 B4:.5 D5:.5 E5:.5 B4:2 | " +
    "C#5:1 E5:1 G#5:.5 E5:.5 C#5:1 | D5:1 F#5:1 F5:1 D5:1 | E5:1 C#5:1 A#4:1 C#5:1";
  const tuneB =
    "F#5:2 E5:1 C#5:1 | E5:2 G#4:2 | D5:1.5 C#5:.5 B4:1 F#4:1 | G#4:1 B4:1 D5:2 | A5:2 F#5:1 D5:1 | F#5:2 F5:2 | E5:1 C#5:1 D#5:1 F#5:1 | E5:2 D5:1 B4:1";
  const a1 = chartBars(chA, 4, 0);
  const b = chartBars(chB, 4, at4(9));
  const a2 = chartBars(chA, 4, at4(17));
  const all = [...a1, ...b, ...a2];
  return {
    id: "yangs",
    title: "Fortune Favors the Takeout",
    bpm: 108,
    beatsPerBar: 4,
    bars: 24,
    key: "A major",
    loop: true,
    reverb: { size: 0.45, damp: 0.5, pre: 0.012, mix: 1 },
    parts: [
      part(
        "marimba",
        marimba,
        cat(
          bars(`${tuneA} | B4:1.5 D5:.5 G#4:2`, 4, 0, 0.85),
          bars(`${tuneA} | B4:1 C#5:1 D5:1 E5:1`, 4, at4(17), 0.85),
        ),
        { level: 0, pan: -0.1, reverb: 0.25 },
      ),
      part("vibes tune", vibraphone, bars(tuneB, 4, at4(9), 0.8), {
        level: 0,
        pan: 0.1,
        reverb: 0.35,
      }),
      part(
        "vibes comp",
        vibraphone,
        cat(stabs(a1, 57, [0, 1.5, 3], 0.8, 0.5, 4), stabs(a2, 57, [0, 1.5, 3], 0.8, 0.5, 4)),
        { level: -10, pan: 0.3, reverb: 0.35 },
      ),
      part("e-piano B", electricPiano, stabs(b, 55, [0, 1.5, 3], 1, 0.5, 4), {
        level: -9,
        pan: -0.3,
        reverb: 0.3,
      }),
      part("pizz", pizzicato, bossaBass(all, 33), { level: -4, reverb: 0.08 }),
      part("bass", uprightBass, bossaBass(all, 33, 0.6), { level: -8 }),
      part("shaker", shaker, grid("xoxoxoxo", 0.5, 24, 4, 60), {
        level: -16,
        pan: 0.45,
        straight: true,
      }),
      part("rim", snap, grid("x..x..x...x..x..", 0.25, 24, 4, 60), {
        level: -16,
        pan: -0.35,
        straight: true,
      }),
      part(
        "harp sweep",
        harp,
        cat(
          gliss(pitch("A3"), pitch("A5"), 9, PENTATONIC, 0, 1.5, 0.5),
          gliss(pitch("D4"), pitch("D6"), 2, PENTATONIC, at4(9), 1.5, 0.5),
        ),
        { level: -9, pan: 0.2, reverb: 0.5 },
      ),
      part(
        "glock",
        glockenspiel,
        cat(
          mel("E6:1 A6:1", at4(1) + 2, 0.6),
          mel("A6:1 D7:1", at4(9) + 2, 0.6),
          mel("E6:1 A6:1", at4(17) + 2, 0.6),
        ),
        { level: -11, pan: 0.4, reverb: 0.5 },
      ),
    ],
  };
}

/**
 * "Aisle Nine" (Di-Mart muzak). C major, 100 bpm, an easy-listening bossa nobody has ever
 * listened to on purpose: clarinet tune, FM electric piano, sine bass, brushes; a vibraphone
 * bridge. A (8) | B (8) | A (8), about 58 s.
 */
export function dimart(): Score {
  const chA =
    "Cmaj7:4 | Am7:4 | Dm7:4 | G7:4 | Em7:2 A7:2 | Dm7:2 G7:2 | Cmaj7:2 A7:2 | Dm7:2 G7:2";
  const chB = "Fmaj7:4 | Em7:4 | Dm7:4 | Cmaj7:4 | Fmaj7:4 | E7:4 | Am7:2 D7:2 | Dm7:2 G7:2";
  const tuneA =
    "C5:1 G5:1 E5:.5 D5:.5 C5:1 | B4:.5 C5:.5 D5:.5 E5:.5 C5:2 | D5:1 A5:1 F5:.5 E5:.5 D5:1 | B4:.5 D5:.5 F5:.5 G5:.5 F5:2 | " +
    "E5:1 G5:1 C#5:1 E5:1 | F5:1 A5:1 D5:1 B4:1 | E5:1.5 D5:.5 C#5:2 | D5:2 B4:1 G4:1";
  const tuneB =
    "A5:2 G5:1 F5:1 | G5:2 E5:2 | F5:1 E5:1 D5:1 C5:1 | E5:4 | C6:2 A5:1 F5:1 | G#5:2 E5:1 D5:1 | C5:1 E5:1 F#5:1 A5:1 | G5:2 F5:1 D5:1";
  const a1 = chartBars(chA, 4, 0);
  const b = chartBars(chB, 4, at4(9));
  const a2 = chartBars(chA, 4, at4(17));
  const all = [...a1, ...b, ...a2];
  return {
    id: "dimart",
    title: "Aisle Nine",
    bpm: 100,
    beatsPerBar: 4,
    bars: 24,
    key: "C major",
    loop: true,
    reverb: { size: 0.4, damp: 0.6, pre: 0.01, mix: 0.9 },
    air: -2,
    parts: [
      part("clarinet", clarinet, cat(bars(tuneA, 4, 0, 0.75), bars(tuneA, 4, at4(17), 0.75)), {
        level: 0,
        pan: 0.1,
        reverb: 0.3,
      }),
      part(
        "vibes",
        vibraphone,
        cat(bars(tuneB, 4, at4(9), 0.75), bars(`+12 ${tuneA}`, 4, at4(17), 0.45)),
        { level: -1, pan: -0.1, reverb: 0.35 },
      ),
      part("e-piano", electricPiano, stabs(all, 55, [0, 1.5, 2.5], 1.1, 0.45, 4), {
        level: -7,
        pan: -0.25,
        reverb: 0.25,
      }),
      part("pad", stringPad, pads(b, 60, 0.4, 3), { level: -14, pan: 0.2, reverb: 0.4 }),
      part("bass", sineBass, bossaBass(all, 36, 0.7), { level: -5 }),
      part("brush tap", brushTap, grid(".x.x", 1, 24, 4, 60), { level: -15, pan: 0.2 }),
      part("shaker", shaker, grid("oxoxoxox", 0.5, 24, 4, 60), { level: -19, pan: 0.4 }),
    ],
  };
}

/**
 * "Office of Psychic Studies" (Spirit University). A minor, a 3/4 waltz at 132 bpm: theremin
 * tune over harp, pizzicato on the downbeats and a hollow organ; the second half gives the tune
 * to the celesta and lets the theremin hold long notes over it. 32 bars, about 44 s.
 */
export function university(): Score {
  const ch =
    "Am:3 | Am:3 | E7/G#:3 | E7/G#:3 | E7:3 | E7:3 | Am:3 | Am:3 | Dm:3 | Dm:3 | Am/C:3 | Am/C:3 | B7:3 | E7:3 | Am:3 | E7:3";
  const tune =
    "A4:1 E5:2 | C5:1 B4:1 A4:1 | G#4:1 A4:1 B4:1 | D5:3 | B4:1 E5:2 | D5:1 C5:1 B4:1 | C5:1 A4:2 | E4:3 | " +
    "F4:1 A4:1 D5:1 | F5:2 E5:1 | E5:1 C5:1 A4:1 | E5:3 | D#5:1 F#5:1 A5:1 | G#5:2 B4:1 | C5:1 B4:1 A4:1 | B4:3";
  const counter = "E5:6 | E5:6 | B4:6 | C5:6 | D5:6 | C5:6 | D#5:3 D5:3 | C5:3 B4:3";
  const s1 = chartBars(ch, 3, 0);
  const s2 = chartBars(ch, 3, 48);
  const all = [...s1, ...s2];
  return {
    id: "university",
    title: "Office of Psychic Studies",
    bpm: 132,
    beatsPerBar: 3,
    bars: 32,
    key: "A minor",
    loop: true,
    reverb: { size: 0.65, damp: 0.4, pre: 0.02, mix: 1 },
    echo: { beats: 1, feedback: 0.25 },
    parts: [
      part("theremin", line(theremin), bars(tune, 3, 0, 0.85), {
        level: 0,
        reverb: 0.45,
        echo: 0.2,
      }),
      part("celesta", celesta, bars(`+12 ${tune}`, 3, 48, 0.7), {
        level: -1,
        pan: 0.15,
        reverb: 0.4,
      }),
      part("theremin long", line(theremin), mel(counter, 48, 0.7), {
        level: -5,
        pan: -0.2,
        reverb: 0.5,
        echo: 0.2,
      }),
      part("harp", harp, arp(all, 52, [-1, 0, 1, -1, 2, 1], 0.5, 0.5, 1.2), {
        level: -7,
        pan: -0.3,
        reverb: 0.4,
      }),
      part(
        "pizz",
        pizzicato,
        twoBeat(all, 33, 0.8).filter((n) => Math.abs(n.t % 3) < 1e-9),
        { level: -4 },
      ),
      part("organ", organ("flute"), pads(all, 52, 0.35, 3), { level: -13, pan: 0.25, reverb: 0.5 }),
    ],
  };
}

/**
 * "Hold Music for the Bereaved" (the bank). E-flat major, 104 bpm, polite and slightly tinny:
 * clarinet tune, celesta answers, pizzicato two-beat, a glockenspiel cash chime at each half.
 * A (8) | B (8), about 37 s.
 */
export function bank(): Score {
  const chA =
    "Eb:4 | Cm7:4 | Fm7:4 | Bb7:4 | Eb:2 Eb7:2 | Ab:2 Abm6:2 | Eb/Bb:2 Bb7:2 | Eb:2 Bb7:2";
  const chB =
    "Ab:4 | Bb7:4 | Gm7:2 C7:2 | Fm7:4 | Ab:2 Adim7:2 | Eb/Bb:2 C7:2 | Fm7:2 Bb7:2 | Eb:2 Bb7:2";
  const tuneA =
    "Eb4:1 Bb4:1 G4:.5 F4:.5 Eb4:1 | D4:.5 Eb4:.5 F4:.5 G4:.5 Eb4:2 | F4:1 C5:1 Ab4:.5 G4:.5 F4:1 | D4:.5 F4:.5 Ab4:.5 Bb4:.5 Ab4:2 | " +
    "G4:1 Bb4:1 Db5:1 Bb4:1 | C5:1 Eb5:1 Cb5:1 Ab4:1 | Bb4:1 G4:.5 Eb4:.5 F4:1 Ab4:1 | G4:2 r:1 Bb3:1";
  const tuneB =
    "C5:1.5 Bb4:.5 Ab4:1 Eb4:1 | D4:1 F4:1 Bb4:1 Ab4:1 | G4:1 Bb4:1 E4:1 G4:1 | Ab4:3 r:1 | Eb5:1 C5:1 Eb5:1 C5:1 | Bb4:2 G4:1 E4:1 | " +
    "F4:1 Ab4:1 D5:1 C5:1 | Eb5:2 r:1 Bb4:1";
  const a = chartBars(chA, 4, 0);
  const b = chartBars(chB, 4, at4(9));
  const all = [...a, ...b];
  return {
    id: "bank",
    title: "Hold Music for the Bereaved",
    bpm: 104,
    beatsPerBar: 4,
    bars: 16,
    key: "E-flat major",
    loop: true,
    reverb: { size: 0.35, damp: 0.6, pre: 0.01, mix: 0.8 },
    air: -1.5,
    parts: [
      part("clarinet", clarinet, bars(tuneA, 4, 0, 0.8), { level: 0, pan: 0.1, reverb: 0.3 }),
      part("celesta", celesta, bars(tuneB, 4, at4(9), 0.75), { level: 0, pan: -0.1, reverb: 0.3 }),
      part("clarinet B", clarinet, bars(`-12 ${tuneB}`, 4, at4(9), 0.5), {
        level: -8,
        pan: 0.2,
        reverb: 0.3,
      }),
      part("pizz", pizzicato, twoBeat(all, 34, 0.8), { level: -3 }),
      part("pizz chords", pizzicato, stabs(all, 55, [1, 3], 0.3, 0.55, 3), { level: -9, pan: 0.3 }),
      part("organ", organ("flute"), pads(all, 55, 0.35, 3), { level: -14, pan: -0.3, reverb: 0.4 }),
      part(
        "chime",
        glockenspiel,
        cat(mel("Bb5:.5 Eb6:1.5", 0, 0.6), mel("Bb5:.5 Eb6:1.5", at4(9), 0.6)),
        { level: -10, pan: 0.4, reverb: 0.4 },
      ),
      part("brush", brushTap, grid(".x.x", 1, 16, 4, 60), { level: -16, pan: 0.2 }),
    ],
  };
}

/**
 * "Visiting Hours" (the hospital). F major, 76 bpm, soft and clean: vibraphone tune (the motif
 * again), FM electric piano, string pad, sine bass; the second half climbs higher. 16 bars, 50 s.
 */
export function hospital(): Score {
  const ch =
    "Fmaj7:4 | Em7:2 A7:2 | Dm7:4 | Cm7:2 F7:2 | Bbmaj7:4 | Bbm6:4 | Am7:2 D7:2 | Gm7:2 C7:2";
  const tune1 =
    "F4:1 C5:1 A4:.5 G4:.5 F4:1 | E4:.5 F4:.5 G4:.5 A4:.5 C#5:2 | D5:1 A4:1 F4:.5 E4:.5 D4:1 | Eb4:.5 F4:.5 G4:.5 Bb4:.5 A4:2 | " +
    "D5:1 F5:1 A4:2 | Db5:2 F4:2 | C5:1 E5:1 F#5:1 C5:1 | Bb4:2 G4:1 E4:1";
  const tune2 =
    "A5:2 G5:1 F5:1 | E5:2 C#5:2 | F5:1 E5:1 D5:1 A4:1 | Bb4:1 C5:1 Eb5:2 | D5:1 C5:1 Bb4:1 A4:1 | Bb4:2 Db5:2 | C5:1 A4:1 F#4:1 A4:1 | G4:2 E4:1 C4:1";
  const s1 = chartBars(ch, 4, 0);
  const s2 = chartBars(ch, 4, at4(9));
  const all = [...s1, ...s2];
  return {
    id: "hospital",
    title: "Visiting Hours",
    bpm: 76,
    beatsPerBar: 4,
    bars: 16,
    key: "F major",
    loop: true,
    reverb: { size: 0.55, damp: 0.5, pre: 0.015, mix: 1 },
    parts: [
      part("vibes", vibraphone, cat(bars(tune1, 4, 0, 0.75), bars(tune2, 4, at4(9), 0.75)), {
        level: 0,
        pan: 0.1,
        reverb: 0.4,
      }),
      part("e-piano", electricPiano, stabs(all, 53, [0, 2.5], 1.5, 0.45, 4), {
        level: -6,
        pan: -0.25,
        reverb: 0.35,
      }),
      part("pad", stringPad, pads(all, 57, 0.45, 3), { level: -11, pan: 0.2, reverb: 0.5 }),
      part("bass", sineBass, twoBeat(all, 33, 0.7), { level: -5 }),
      part(
        "brush",
        brushSweep,
        grid("x.x.", 1, 16, 4, 60).map((n) => ({ ...n, d: 1.9 })),
        { level: -20, pan: -0.2 },
      ),
    ],
  };
}
