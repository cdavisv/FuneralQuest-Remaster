import { electricPiano } from "../inst/keys.js";
import { brass, brassLine, theremin, whistle } from "../inst/leads.js";
import { glockenspiel, tubularBell } from "../inst/mallets.js";
import { organ } from "../inst/organ.js";
import { crash, hatOpen, kick, ride, snap, snare, timpani } from "../inst/percussion.js";
import { banjo, uprightBass } from "../inst/strings.js";
import { bars, chartBars, grid, mel, oomPah, type Score, stabs, walk } from "../seq/score.js";
import { cat, line, part } from "./kit.js";

const at4 = (bar: number) => (bar - 1) * 4;

/**
 * "Hail to the Coroner" (City Hall). B-flat major, 112 bpm, a pompous march: brass with dotted
 * rhythms (the motif in major), tuba oom-pah, snare and bass drum, glockenspiel doubling the
 * repeat, and a broad trio in E-flat on the full organ that turns back home. 24 bars, 51 s.
 */
export function cityHall(): Score {
  const chA = "Bb:4 | F7:4 | Bb:4 | Eb:2 F7:2 | Bb:2 G7:2 | Cm:2 F7:2 | Bb/F:2 F7:2 | Bb:4";
  const chA2 = "Bb:4 | F7:4 | Bb:4 | Eb:2 F7:2 | Bb:2 G7:2 | Cm:2 F7:2 | Bb/F:2 F7:2 | Bb:2 Bb7:2";
  const chT = "Eb:4 | Bb7:4 | Eb:4 | Ab:2 Adim7:2 | Eb/Bb:4 | C7:4 | F7:4 | F7:4";
  const tune =
    "Bb4:1 F5:1 D5:.75 C5:.25 Bb4:1 | A4:.75 Bb4:.25 C5:.75 D5:.25 C5:2 | Bb4:1 F5:1 G5:.75 F5:.25 Eb5:1 | D5:.75 C5:.25 D5:.75 Eb5:.25 F5:2 | " +
    "G5:1 F5:.75 D5:.25 B4:1 G4:1 | C5:.75 Eb5:.25 G5:1 F5:.75 Eb5:.25 A4:1 | Bb4:1 D5:1 C5:1 A4:1";
  const trio =
    "G5:2 Bb5:2 | Ab5:2 F5:2 | G5:1 F5:1 Eb5:1 Bb4:1 | C5:2 Eb5:2 | Eb5:1.5 D5:.5 Eb5:1 G5:1 | G5:2 E5:2 | F5:1 Eb5:1 D5:1 C5:1 | A4:1 C5:1 Eb5:1 F5:1";
  const a1 = chartBars(chA, 4, 0);
  const a2 = chartBars(chA2, 4, at4(9));
  const t = chartBars(chT, 4, at4(17));
  const march = [...a1, ...a2];
  const op = oomPah(march, 34, 53, 0.85);
  const opT = oomPah(t, 31, 51, 0.7);
  return {
    id: "cityhall",
    title: "Hail to the Coroner",
    bpm: 112,
    beatsPerBar: 4,
    bars: 24,
    key: "B-flat major",
    loop: true,
    reverb: { size: 0.6, damp: 0.45, pre: 0.02, mix: 1 },
    parts: [
      part(
        "brass tune",
        brass,
        cat(
          bars(`${tune} | Bb4:2 F4:1 Bb4:1`, 4, 0, 0.9),
          bars(`${tune} | Bb4:2 r:1 Bb4:1`, 4, at4(9), 0.9),
        ),
        { level: 0, pan: 0.05, reverb: 0.3 },
      ),
      part("glock", glockenspiel, bars(`+12 ${tune} | Bb4:2 r:1 Bb4:1`, 4, at4(9), 0.6), {
        level: -8,
        pan: 0.35,
        reverb: 0.35,
      }),
      part("trio organ", organ("full"), bars(trio, 4, at4(17), 0.85), { level: 0, reverb: 0.45 }),
      part("trio brass", brass, bars(`-12 ${trio}`, 4, at4(17), 0.7), {
        level: -6,
        pan: -0.25,
        reverb: 0.35,
      }),
      part(
        "tuba",
        line(brassLine({ glide: 0.01, bright: 2.5, wah: 0, vibCents: 0 })),
        cat(op.bass, opT.bass),
        { level: -2, reverb: 0.15 },
      ),
      part("brass chords", brass, cat(op.chords, opT.chords), {
        level: -8,
        pan: -0.2,
        reverb: 0.25,
      }),
      part("snare", snare, grid("X..x x.x. x..x x.xx", 0.25, 24, 4, 60), { level: -10, pan: 0.2 }),
      part("bass drum", kick, grid("x.x.", 1, 24, 4, 36), { level: -9, reverb: 0.15 }),
      part("cymbal", crash, cat(mel("C4:4", 0), mel("C4:4", at4(9)), mel("C4:4", at4(17))), {
        level: -14,
        pan: 0.3,
        reverb: 0.3,
      }),
      part(
        "timpani",
        timpani,
        cat(mel("Bb1:1 F2:1 Bb1:2", at4(16), 0.7), mel("F2:2 C2:1 F2:1", at4(24), 0.8)),
        { level: -6, reverb: 0.3 },
      ),
    ],
  };
}

/**
 * "Last Call at the Reaper Club" (the club). F minor, 108 bpm, swung lounge: combo organ with a
 * rotary wobble has the tune, the theremin takes the bridge, walking bass, ride and finger snaps,
 * electric-piano comping in the Charleston rhythm. A (8) | B (8) | A (8), about 53 s.
 */
export function club(): Score {
  const chA =
    "Fm7:4 | Bbm7:4 | Eb7:4 | Abmaj7:4 | Dbmaj7:4 | Gm7b5:2 C7:2 | Fm7:2 Db7:2 | Gm7b5:2 C7:2";
  const chB =
    "Abmaj7:4 | Fm7:4 | Bbm7:4 | Eb7:4 | Dbmaj7:4 | Bbm7:2 Eb7:2 | Abmaj7:2 Fm7:2 | Gm7b5:2 C7:2";
  const tuneA =
    "F4:1 C5:1 Ab4:.5 G4:.5 F4:1 | Db5:.5 C5:.5 Bb4:.5 Ab4:.5 F4:2 | G4:1 Db5:1 Bb4:.5 Ab4:.5 G4:1 | C5:.5 Bb4:.5 Ab4:.5 G4:.5 Ab4:2 | " +
    "F5:1 C5:.5 Ab4:.5 F4:1 Ab4:1 | Bb4:1 Db5:.5 Bb4:.5 E4:1 G4:1 | Ab4:1 C5:1 Cb5:1 Ab4:1 | G4:1.5 Bb4:.5 E4:2";
  const tuneB =
    "C5:2 Eb5:2 | Ab5:3 G5:1 | F5:2 Db5:2 | G5:2 Eb5:1 Db5:1 | C5:2 F5:2 | Db5:1 F5:1 G5:1 Bb4:1 | C5:2 Ab4:2 | Bb4:1 Db5:1 E5:2";
  const a1 = chartBars(chA, 4, 0);
  const b = chartBars(chB, 4, at4(9));
  const a2 = chartBars(chA, 4, at4(17));
  const all = [...a1, ...b, ...a2];
  return {
    id: "club",
    title: "Last Call at the Reaper Club",
    bpm: 108,
    beatsPerBar: 4,
    bars: 24,
    key: "F minor",
    swing: 1 / 6,
    loop: true,
    reverb: { size: 0.5, damp: 0.5, pre: 0.015, mix: 1 },
    echo: { beats: 0.75, feedback: 0.3 },
    parts: [
      part(
        "combo organ",
        organ("combo"),
        cat(bars(tuneA, 4, 0, 0.85), bars(tuneA, 4, at4(17), 0.85)),
        { level: 0, pan: -0.1, reverb: 0.25 },
      ),
      part("theremin", line(theremin), bars(tuneB, 4, at4(9), 0.85), {
        level: 0,
        pan: 0.1,
        reverb: 0.45,
        echo: 0.25,
      }),
      part("e-piano", electricPiano, stabs(all, 53, [0, 1.5], 0.8, 0.5, 4), {
        level: -7,
        pan: 0.3,
        reverb: 0.25,
      }),
      part("bass", uprightBass, walk(all, 29, 0.8), { level: -3, reverb: 0.05 }),
      part("ride", ride, grid("x.xxx.xx", 0.5, 24, 4, 60), { level: -14, pan: 0.35 }),
      part("snap", snap, grid(".x.x", 1, 24, 4, 60), { level: -13, pan: -0.35, reverb: 0.2 }),
      part(
        "open hat",
        hatOpen,
        [4, 8, 12, 16, 20, 24].map((bar) => ({ t: at4(bar) + 3.5, d: 0.5, p: 60, v: 0.6 })),
        { level: -20, pan: 0.4 },
      ),
    ],
  };
}

/** Victory: the motif in D major as a fanfare, a big chord, timpani and a cymbal. About 4 s. */
export function victory(): Score {
  return {
    id: "victory",
    title: "Ashes to Ashes, Bust to Bust",
    bpm: 120,
    beatsPerBar: 4,
    bars: 2,
    key: "D major",
    loop: false,
    tail: 2,
    reverb: { size: 0.55, damp: 0.45, pre: 0.015, mix: 1 },
    parts: [
      part(
        "brass",
        brass,
        mel("A4:1/3 A4 A4 D5:1 A5:.5 F#5:.25 E5:.25 D5:1 | D5+F#5+A5+D6:4!", 0, 0.9),
        { level: 0, reverb: 0.3 },
      ),
      part("brass low", brass, mel("r:2 D4:1 A3:1 | D3+A3+D4:4", 0, 0.8), {
        level: -5,
        pan: -0.3,
        reverb: 0.3,
      }),
      part("glock", glockenspiel, mel("r:1 D6:1 A6:.5 F#6:.25 E6:.25 D6:1 | D7:1", 0, 0.7), {
        level: -7,
        pan: 0.35,
        reverb: 0.4,
      }),
      part("calliope", organ("calliope"), mel("r:4 | D5+F#5+A5:3", 0, 0.7), {
        level: -7,
        pan: 0.2,
        reverb: 0.3,
      }),
      part("timpani", timpani, mel("r:1 A1:1 r:1 A1:.5 A1:.5 | D2:2", 0, 0.9), {
        level: -4,
        reverb: 0.3,
      }),
      part("cymbal", crash, mel("C4:4", 4), { level: -10, reverb: 0.3 }),
    ],
  };
}

/** Defeat: the motif upside down and falling, a muted trombone into a low minor chord. About 4.5 s. */
export function defeat(): Score {
  return {
    id: "defeat",
    title: "Grave Error",
    bpm: 84,
    beatsPerBar: 4,
    bars: 2,
    key: "D minor",
    loop: false,
    tail: 2.5,
    reverb: { size: 0.6, damp: 0.5, pre: 0.02, mix: 1 },
    parts: [
      part(
        "trombone",
        line(brassLine({ glide: 0.09, bright: 3, wah: 0.8, vibCents: 18 })),
        mel("A3:1 D3:1 F3:.5 G3:.5 A3:1 | Bb2:3_", 0, 0.85),
        { level: 0, reverb: 0.3 },
      ),
      part("organ", organ("reed"), mel("r:4 | D3+F3+A3:3", 0, 0.6), {
        level: -5,
        pan: -0.2,
        reverb: 0.4,
      }),
      part("bass", uprightBass, mel("r:4 | D2:2", 0, 0.8), { level: -4 }),
      part("timpani", timpani, mel("r:4 | D2:1", 0, 0.7), { level: -6, reverb: 0.3 }),
    ],
  };
}

/** New day: a rooster's worth of chimes, banjo and whistle on the motif in G. About 4 s. */
export function newDay(): Score {
  return {
    id: "newday",
    title: "Rise and Shine, Deathville",
    bpm: 132,
    beatsPerBar: 4,
    bars: 2,
    key: "G major",
    loop: false,
    tail: 2.2,
    reverb: { size: 0.5, damp: 0.5, pre: 0.012, mix: 1 },
    parts: [
      part("chimes", tubularBell, mel("G5:1 D6:1 B5:.5 A5:.5 G5:1 | G5+B5+D6:2", 0, 0.7), {
        level: 0,
        reverb: 0.4,
      }),
      part("whistle", line(whistle), mel("r:4 | D5:.5 E5:.5 G5:1", 0, 0.8), {
        level: -3,
        pan: -0.3,
        reverb: 0.3,
      }),
      part("banjo", banjo, mel("G3+D4+G4+B4:1 r:1 D3+D4+F#4+A4:1 r:1 | G3+D4+G4+B4+D5:2", 0, 0.8), {
        level: -4,
        pan: 0.3,
        reverb: 0.2,
      }),
      part("bass", uprightBass, mel("G2:2 D2:2 | G2:2", 0, 0.8), { level: -5 }),
      part("bell", tubularBell, mel("G4:1", 4, 0.5), { level: -8, pan: 0.2 }),
      part("ride", ride, mel("C4:1", 4, 0.5), { level: -16 }),
    ],
  };
}
