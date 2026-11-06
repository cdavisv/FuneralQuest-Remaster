import { brass, choir, theremin } from "../inst/leads.js";
import { celesta, churchBell, tubularBell } from "../inst/mallets.js";
import { organ } from "../inst/organ.js";
import { crash, timpani } from "../inst/percussion.js";
import { harp } from "../inst/strings.js";
import {
  arp,
  bars,
  chartBars,
  gliss,
  mel,
  pads,
  pitch,
  type Score,
  type Span,
} from "../seq/score.js";
import { cat, line, part } from "./kit.js";

const at4 = (bar: number) => (bar - 1) * 4;

/** The bass of each span as one organ pedal note (the chord's bass, low). */
function pedal(spans: Span[], low: number, vel = 0.7) {
  return spans.map((s) => {
    let p = low - (((low % 12) + 12) % 12) + s.c.bass;
    if (p < low) p += 12;
    return { t: s.t, d: s.d * 0.97, p, v: vel };
  });
}

/**
 * "Dearly Departed (Processional)" (the ceremony and the church). F major, 66 bpm. A hymn: the
 * motif in long notes on the chapel organ, the pedal on the full organ, a wordless choir and a
 * bell at the top of each half. 16 bars, about 58 s.
 */
export function ceremony(): Score {
  const ch =
    "F:4 | F:2 Bb:2 | C/E:2 F:2 | C:4 | Dm:2 Bb:2 | F/C:2 C7:2 | F:2 Bb:2 | C:4 | " +
    "Dm:2 A/C#:2 | Dm:2 Bb:2 | Gm:2 C7:2 | F:4 | Bb:2 Bbm:2 | F/C:2 D7:2 | Gm7:2 C7:2 | F:4";
  const tune =
    "F4:2 C5:2 | A4:1 G4:1 F4:2 | E4:1 F4:1 G4:1 A4:1 | G4:4 | A4:2 D5:2 | C5:1 Bb4:1 A4:1 G4:1 | A4:1 C5:1 D5:2 | C5:4 | " +
    "D5:2 C#5:2 | D5:1 E5:1 F5:2 | D5:1 C5:1 Bb4:2 | A4:4 | Bb4:2 Db5:2 | C5:2 D5:1 C5:1 | Bb4:1 A4:1 G4:2 | F4:4";
  const spans = chartBars(ch, 4);
  return {
    id: "ceremony",
    title: "Dearly Departed (Processional)",
    bpm: 66,
    beatsPerBar: 4,
    bars: 16,
    key: "F major",
    loop: true,
    reverb: { size: 0.85, damp: 0.35, pre: 0.03, mix: 1.2 },
    parts: [
      part("melody", organ("chapel"), bars(tune, 4, 0, 0.85), { level: 0, reverb: 0.55 }),
      part("harmony", organ("chapel"), pads(spans, 53, 0.55, 3), {
        level: -5,
        pan: -0.15,
        reverb: 0.6,
      }),
      part("pedal", organ("full"), pedal(spans, 29), { level: -5, reverb: 0.5 }),
      part("choir", choir("oo"), pads(spans, 57, 0.6, 3), { level: -9, pan: 0.2, reverb: 0.7 }),
      part("bell", churchBell, cat(mel("F3:4", 0, 0.7), mel("F3:4", at4(9), 0.6)), {
        level: -6,
        pan: 0.3,
        reverb: 0.6,
      }),
    ],
  };
}

/**
 * "Plot Twist" (the graveyard). G minor, 68 bpm. Harp arpeggios and a theremin that would like
 * to be frightening but is mostly wistful; a choir hums and a bell tolls twice. 16 bars, 56 s.
 */
export function graveyard(): Score {
  const ch =
    "Gm:4 | Eb:4 | Cm:4 | D7:4 | Gm:4 | Bb/F:4 | Eb:2 Cm6:2 | D7:4 | " +
    "Gm:4 | Gm/F:4 | Ebmaj7:4 | D7:4 | Cm:2 Eb:2 | Gm/D:2 D7:2 | Gm:2 Cm:2 | D7:4";
  const tune =
    "G4:2 D5:2 | Bb4:1 A4:1 G4:2 | Eb4:1 G4:1 C5:2 | A4:3 r:1 | G4:1 Bb4:1 D5:2 | F5:2 D5:2 | Eb5:2 C5:1 A4:1 | F#4:3 r:1 | " +
    "D5:2 G5:2 | F5:1 D5:1 Bb4:2 | D5:2 Bb4:2 | A4:2 C5:1 F#4:1 | G4:1 C5:1 Eb5:2 | D5:1 Bb4:1 A4:1 C5:1 | Bb4:2 G4:2 | A4:1 F#4:1 D4:2";
  const spans = chartBars(ch, 4);
  return {
    id: "graveyard",
    title: "Plot Twist",
    bpm: 68,
    beatsPerBar: 4,
    bars: 16,
    key: "G minor",
    loop: true,
    reverb: { size: 0.75, damp: 0.4, pre: 0.025, mix: 1.1 },
    echo: { beats: 0.75, feedback: 0.3 },
    parts: [
      part("theremin", line(theremin), bars(tune, 4, 0, 0.8), {
        level: 0,
        pan: 0.1,
        reverb: 0.5,
        echo: 0.25,
      }),
      part("harp", harp, arp(spans, 43, [0, 1, 2, 3, 4, 3, 2, 1], 0.5, 0.55, 1.5), {
        level: -5,
        pan: -0.25,
        reverb: 0.45,
      }),
      part("choir", choir("mm"), pads(spans, 55, 0.5, 3), { level: -10, pan: 0.25, reverb: 0.6 }),
      part("organ pedal", organ("chapel"), pedal(spans, 31, 0.5), { level: -8, reverb: 0.5 }),
      part("bell", churchBell, cat(mel("G2:4", 0, 0.6), mel("D3:4", at4(9), 0.5)), {
        level: -9,
        pan: -0.35,
        reverb: 0.7,
      }),
    ],
  };
}

/**
 * "The Sky Is Falling" (the season's end and its meteor). C minor, 80 bpm. Full organ and brass
 * with the motif in long notes, timpani and bells; a choir; in the last two bars a theremin falls
 * out of the sky. 16 bars, 48 s. Grand, and a little ridiculous.
 */
export function meteor(): Score {
  const ch =
    "Cm:4 | Ab:4 | Fm:4 | G7:4 | Cm:4 | Ab:2 Db:2 | Cm/G:2 G7:2 | Cm:4 | " +
    "Ab:4 | Bb:4 | Eb:4 | Cm:4 | Fm:4 | Db:4 | G:4 | G7:4";
  const tune =
    "C5:2 G5:2 | Eb5:1 D5:1 C5:2 | Ab4:1 C5:1 F5:2 | D5:3 B4:1 | C5:1 Eb5:1 G5:2 | Ab5:2 F5:2 | Eb5:2 D5:2 | C5:4 | " +
    "C5:2 Eb5:2 | F5:2 D5:2 | Eb5:1 F5:1 G5:2 | G5:1 F5:1 Eb5:2 | F5:2 Ab5:2 | Ab5:1 F5:1 Db5:2 | D5:2 B4:2 | D5:1 F5:1 G5:2";
  const spans = chartBars(ch, 4);
  const timp = spans.map((s, i) => ({
    t: s.t,
    d: 1,
    p: i % 2 === 0 ? pitch("C2") : pitch("G1"),
    v: 0.85,
  }));
  const rolls = [at4(4) + 2, at4(8) + 2, at4(12) + 2, at4(16)].flatMap((t) =>
    Array.from({ length: 8 }, (_, k) => ({
      t: t + k * 0.25,
      d: 0.25,
      p: pitch("G1"),
      v: 0.4 + k * 0.06,
    })),
  );
  return {
    id: "meteor",
    title: "The Sky Is Falling",
    bpm: 80,
    beatsPerBar: 4,
    bars: 16,
    key: "C minor",
    loop: true,
    reverb: { size: 0.8, damp: 0.4, pre: 0.025, mix: 1.1 },
    parts: [
      part("organ tune", organ("full"), bars(tune, 4, 0, 0.9), { level: 0, reverb: 0.45 }),
      part("brass tune", brass, bars(`-12 ${tune}`, 4, 0, 0.8), {
        level: -5,
        pan: -0.25,
        reverb: 0.35,
      }),
      part("organ chords", organ("full"), pads(spans, 48, 0.6, 4), {
        level: -6,
        pan: 0.15,
        reverb: 0.5,
      }),
      part("pedal", organ("full"), pedal(spans, 24, 0.8), { level: -6, reverb: 0.4 }),
      part("choir", choir("ah"), pads(spans, 60, 0.7, 3), { level: -8, pan: 0.25, reverb: 0.6 }),
      part("timpani", timpani, cat(timp, rolls), { level: -4, reverb: 0.3 }),
      part("bells", tubularBell, cat(mel("C5:2 G4:2", 0, 0.7), mel("Eb5:2 C5:2", at4(9), 0.7)), {
        level: -8,
        pan: 0.35,
        reverb: 0.6,
      }),
      part("crash", crash, cat(mel("C4:4", 0), mel("C4:4", at4(9))), { level: -14, reverb: 0.4 }),
      part(
        "falling theremin",
        line(theremin),
        mel("G6:1 C6:1 G5:1 Eb5:1 C5:1 G4:1 C4:2", at4(15), 0.9),
        { level: -4, pan: 0.4, reverb: 0.5 },
      ),
    ],
  };
}

/**
 * "Lights Out at the Parlor" (Solo mode's end of the day). F major, a 3/4 lullaby at 84 bpm on
 * celesta and harp over a soft organ; eight bars and a long ring. A cue, not a loop: 17 s.
 */
export function endDay(): Score {
  const ch = "F:3 | C7/E:3 | F:3 | Bb:3 | F/C:3 | Dm:3 | Gm7:2 C7:1 | F:3";
  const spans = chartBars(ch, 3);
  return {
    id: "endday",
    title: "Lights Out at the Parlor",
    bpm: 84,
    beatsPerBar: 3,
    bars: 8,
    key: "F major",
    loop: false,
    tail: 3.5,
    reverb: { size: 0.7, damp: 0.5, pre: 0.02, mix: 1 },
    parts: [
      part(
        "celesta",
        celesta,
        bars(
          "F4:1 C5:2 | Bb4:1 G4:1 E4:1 | A4:1 C5:2 | D5:3 | C5:1 A4:1 F4:1 | A4:1 F4:2 | G4:2 E4:1 | F4:3",
          3,
          0,
          0.7,
        ),
        { level: 0, reverb: 0.5 },
      ),
      part("harp", harp, arp(spans, 41, [0, 1, 2], 1, 0.5, 2), {
        level: -6,
        pan: -0.25,
        reverb: 0.45,
      }),
      part("organ", organ("chapel"), pads(spans, 53, 0.35, 3), {
        level: -9,
        pan: 0.15,
        reverb: 0.5,
      }),
      part("final harp", harp, gliss(pitch("F3"), pitch("F5"), 5, [0, 2, 4, 7, 9], 21, 2, 0.5), {
        level: -8,
        pan: 0.3,
        reverb: 0.6,
      }),
      part("bell", tubularBell, mel("F5:3", 21, 0.4), { level: -12, pan: 0.2, reverb: 0.6 }),
    ],
  };
}
