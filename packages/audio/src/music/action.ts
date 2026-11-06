import { brassLine, clarinet, theremin } from "../inst/leads.js";
import { marimba, xylophone } from "../inst/mallets.js";
import { organ } from "../inst/organ.js";
import {
  brushSweep,
  brushTap,
  crash,
  hatClosed,
  kick,
  snare,
  timpani,
  tom,
  woodblock,
} from "../inst/percussion.js";
import { pizzicato, uprightBass } from "../inst/strings.js";
import { bars, chartBars, grid, mel, oomPah, pads, type Score, stabs, walk } from "../seq/score.js";
import { cat, line, part } from "./kit.js";

const at4 = (bar: number) => (bar - 1) * 4;

/**
 * "Pre-Need Arrangements" (the negotiation). E minor, 120 bpm, 16 bars (32 s), in three stems
 * the client crossfades by the customer's mood:
 * - layer 0, calm: pizzicato bass, a ticking woodblock, soft harmonium chords;
 * - layer 1, uneasy: the clarinet's tune (the motif in E minor) and brushes;
 * - layer 2, angry: theremin wails, full-organ stabs, timpani, hats and xylophone runs.
 */
export function negotiation(): Score {
  const ch =
    "Em:4 | B7:4 | Em:4 | Am:2 B7:2 | C:4 | Am6:2 B7:2 | Em:2 C:2 | F7:2 B7:2 | " +
    "Em:4 | B7:4 | Em:4 | Am:2 B7:2 | C:4 | F#m7b5:2 B7:2 | Em/G:2 Am:2 | B7:4";
  const tune =
    "E4:1 B4:1 G4:.5 F#4:.5 E4:1 | D#4:.5 E4:.5 F#4:.5 G4:.5 F#4:2 | E4:1 B4:1 C5:.5 B4:.5 A4:1 | G4:.5 F#4:.5 G4:.5 A4:.5 B4:2 | " +
    "C5:1 B4:.5 A4:.5 G4:1 E4:1 | F#4:.5 G4:.5 A4:.5 F#4:.5 D#4:2 | E4:.5 G4:.5 B4:.5 E5:.5 C5:1 G4:1 | F4:1 A4:1 D#4:2 | " +
    "G4:1 E5:1 B4:.5 A4:.5 G4:1 | F#4:.5 G4:.5 A4:.5 B4:.5 D#5:2 | E5:1 B4:1 G4:.5 F#4:.5 E4:1 | A4:.5 B4:.5 C5:.5 A4:.5 B4:2 | " +
    "E5:1 D5:.5 C5:.5 B4:1 G4:1 | A4:1 C5:1 B4:.5 A4:.5 F#4:1 | G4:1 B4:1 A4:1 C5:1 | B4:2 D#4:1 F#4:1";
  const wail =
    "B4:4 | A4:4 | B4:2 E5:2 | C5:2 D#5:2 | E5:4 | C5:2 B4:2 | G5:2 E5:2 | D#5:4 | " +
    "E5:4 | F#5:4 | G5:4 | E5:2 D#5:2 | E5:4 | C5:2 D#5:2 | E5:2 C5:2 | B4:4";
  const spans = chartBars(ch, 4);
  const runs = cat(
    mel("E5:1/4 F#5 G5 A5 B5:1", at4(4) + 2),
    mel("B5:1/4 A5 G5 F#5 E5:1", at4(8) + 2),
    mel("E5:1/4 G5 B5 E6 D#6:1", at4(12) + 2),
    mel("F#5:1/4 A5 B5 D#6 F#6:1", at4(16) + 2),
  );
  return {
    id: "negotiation",
    title: "Pre-Need Arrangements",
    bpm: 120,
    beatsPerBar: 4,
    bars: 16,
    key: "E minor",
    loop: true,
    layers: 3,
    reverb: { size: 0.4, damp: 0.5, pre: 0.01, mix: 1 },
    parts: [
      // layer 0: calm
      part("pizz bass", pizzicato, walk(spans, 40, 0.8), { level: -2, layer: 0, reverb: 0.1 }),
      part("tick", woodblock, grid(".x.x", 0.5, 16, 4, 86), {
        level: -11,
        pan: 0.4,
        layer: 0,
        straight: true,
      }),
      part("harmonium", organ("reed"), stabs(spans, 52, [0], 1.6, 0.5, 3), {
        level: -6,
        pan: -0.2,
        layer: 0,
        reverb: 0.3,
      }),
      // layer 1: uneasy
      part("clarinet", clarinet, bars(tune, 4, 0, 0.85), {
        level: 0,
        pan: 0.1,
        layer: 1,
        reverb: 0.25,
      }),
      part("brush tap", brushTap, grid(".x.x", 1, 16, 4, 60), { level: -12, pan: 0.2, layer: 1 }),
      part(
        "brush sweep",
        brushSweep,
        grid("x.x.", 1, 16, 4, 60).map((n) => ({ ...n, d: 1.9 })),
        { level: -17, pan: -0.2, layer: 1 },
      ),
      // layer 2: angry
      part("theremin", line(theremin), bars(wail, 4, 0, 0.85), {
        level: -2,
        pan: -0.25,
        layer: 2,
        reverb: 0.4,
      }),
      part("organ stabs", organ("full"), stabs(spans, 48, [0, 2.5], 0.4, 0.8, 4), {
        level: -5,
        layer: 2,
        reverb: 0.3,
      }),
      part(
        "timpani",
        timpani,
        cat(...spans.map((s) => mel(`${["E2", "B1"][Math.round(s.t / 4) % 2]}:1`, s.t, 0.8))),
        { level: -6, layer: 2, reverb: 0.25 },
      ),
      part("hats", hatClosed, grid("xoxoxoXo", 0.25, 16, 4, 60), {
        level: -14,
        pan: 0.35,
        layer: 2,
        straight: true,
      }),
      part("xylophone", xylophone, runs, { level: -6, pan: 0.45, layer: 2, reverb: 0.2 }),
    ],
  };
}

/**
 * "Tiptoe Through the Tulip Beds" (visiting a rival). C minor, 100 bpm. Staccato xylophone on
 * tiptoe over walking pizzicato, woodblock footsteps; B half is the marimba creeping
 * chromatically. 16 bars, about 38 s.
 */
export function sneak(): Score {
  const ch =
    "Cm:4 | G7:4 | Cm:4 | Ab:2 G7:2 | Fm:4 | Cm:4 | Dm7b5:2 G7:2 | Cm:2 G7:2 | " +
    "Fm:4 | Cm:4 | Fm:4 | G7:4 | Ab:4 | Fm6:4 | Dm7b5:2 G7:2 | G7:4";
  const a =
    "C4:.5' r:.5 G4:.5' r:.5 Eb4:.5' D4:.5' C4:.5' r:.5 | B3:.5' r:.5 D4:.5' r:.5 F4:.5' Eb4:.5' D4:1' | " +
    "C4:.5' r:.5 G4:.5' r:.5 Ab4:.5' G4:.5' F4:.5' r:.5 | Eb4:.5' C4:.5' Ab3:.5' C4:.5' B3:1' r:1 | " +
    "F4:.5' r:.5 C5:.5' r:.5 Ab4:.5' G4:.5' F4:.5' r:.5 | G4:.5' r:.5 Eb4:.5' r:.5 C4:.5' D4:.5' Eb4:1' | " +
    "F4:.5' Ab4:.5' D4:.5' F4:.5' B3:.5' D4:.5' G4:1' | C4:.5' r:.5 Eb4:.5' r:.5 D4:.5' r:.5 G3:1'";
  const b =
    "Ab4:1' G4:1' F4:1' C4:1' | Eb4:1' D4:1' C4:1' G3:1' | F4:.5' Ab4:.5' C5:.5' Ab4:.5' F4:1' r:1 | " +
    "G4:.5' B4:.5' D5:.5' B4:.5' G4:1' r:1 | C5:.5' r:.5 Ab4:.5' r:.5 Eb4:.5' r:.5 C4:.5' r:.5 | " +
    "D4:.5' r:.5 F4:.5' r:.5 Ab4:.5' r:.5 D5:.5' r:.5 | F4:.5' Ab4:.5' B4:.5' D5:.5' F5:1' D5:1' | B4:.5' r:.5 G4:.5' r:.5 D4:.5' F4:.5' B3:1'";
  const spans = chartBars(ch, 4);
  const bassNotes = walk(spans, 36, 0.8).map((n) => ({ ...n, d: 0.35 }));
  return {
    id: "sneak",
    title: "Tiptoe Through the Tulip Beds",
    bpm: 100,
    beatsPerBar: 4,
    bars: 16,
    key: "C minor",
    loop: true,
    reverb: { size: 0.35, damp: 0.5, pre: 0.01, mix: 1 },
    parts: [
      part("xylophone", xylophone, bars(a, 4, 0, 0.85), { level: 0, pan: 0.15, reverb: 0.25 }),
      part("marimba", marimba, bars(b, 4, at4(9), 0.85), { level: 0, pan: -0.15, reverb: 0.25 }),
      part("clarinet low", clarinet, bars(`-12 ${b}`, 4, at4(9), 0.6), {
        level: -8,
        pan: 0.2,
        reverb: 0.2,
      }),
      part("pizz", pizzicato, bassNotes, { level: -3, reverb: 0.1 }),
      part(
        "steps",
        woodblock,
        cat(grid("x.x.", 1, 16, 4, 76).map((n, i) => ({ ...n, p: i % 2 ? 72 : 76 }))),
        { level: -12, pan: -0.4, straight: true },
      ),
      part("harmonium", organ("reed"), pads(spans, 48, 0.3, 3), { level: -16, reverb: 0.4 }),
    ],
  };
}

/**
 * "Casket Brawl" (battle / duel). E minor, 152 bpm, a silent-film chase: calliope tune in
 * running eighths over oom-pah, snare and organ stabs. 16 bars, about 25 s.
 */
export function battle(): Score {
  const ch = "Em:4 | B7:4 | Em:4 | B7:4 | C:4 | Am:2 B7:2 | Em:2 C:2 | F#7:2 B7:2";
  const tune =
    "E5:.5 B4:.5 G4:.5 B4:.5 E5:.5 F#5:.5 G5:.5 E5:.5 | D#5:.5 F#5:.5 B5:.5 F#5:.5 A5:.5 F#5:.5 D#5:1 | " +
    "E5:1 B5:1 G5:.5 F#5:.5 E5:1 | D#5:.5 E5:.5 F#5:.5 G5:.5 F#5:2 | " +
    "G5:.5 E5:.5 C5:.5 E5:.5 G5:.5 A5:.5 G5:.5 E5:.5 | C5:.5 E5:.5 A5:.5 E5:.5 B4:.5 D#5:.5 F#5:1 | " +
    "G5:.5 F#5:.5 E5:.5 B4:.5 C5:.5 D5:.5 E5:1 | A#4:.5 C#5:.5 E5:.5 F#5:.5 D#5:1 B4:1";
  const s1 = chartBars(ch, 4, 0);
  const s2 = chartBars(ch, 4, 32);
  const all = [...s1, ...s2];
  const op = oomPah(all, 28, 52, 0.85);
  const fill = (bar: number) => mel("B2:1/4 A2 G2 F#2 E2 D2 C2 B1", at4(bar) + 2, 0.8);
  return {
    id: "battle",
    title: "Casket Brawl",
    bpm: 152,
    beatsPerBar: 4,
    bars: 16,
    key: "E minor",
    loop: true,
    reverb: { size: 0.35, damp: 0.5, pre: 0.008, mix: 1 },
    parts: [
      part("calliope", organ("calliope"), bars(tune, 4, 0, 0.85), {
        level: 0,
        pan: 0.1,
        reverb: 0.2,
      }),
      part("harmonium tune", organ("reed"), bars(`-12 ${tune}`, 4, 32, 0.8), {
        level: -2,
        pan: -0.15,
        reverb: 0.2,
      }),
      part(
        "brass",
        line(brassLine({ glide: 0.03, bright: 4, wah: 0, vibCents: 6 })),
        mel("E4:2 B3:2 | E4:2 F#4:2 | G4:4 | F#4:4", at4(13), 0.8),
        { level: -6, pan: -0.3, reverb: 0.2 },
      ),
      part("tuba", uprightBass, op.bass, { level: -2 }),
      part("stabs", organ("reed"), op.chords, { level: -8, pan: 0.25, reverb: 0.15 }),
      part("snare", snare, grid("x.oxx.ox", 0.5, 16, 4, 60), { level: -10, pan: 0.15 }),
      part("kick", kick, grid("x.x.", 1, 16, 4, 36), { level: -9 }),
      part("crash", crash, cat(mel("C4:4", 0), mel("C4:4", 32)), {
        level: -14,
        pan: 0.3,
        reverb: 0.2,
      }),
      part("toms", tom, cat(fill(8), fill(16)), { level: -8, pan: -0.2 }),
    ],
  };
}
