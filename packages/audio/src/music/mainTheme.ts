import { theremin } from "../inst/leads.js";
import { vibraphone } from "../inst/mallets.js";
import { organ } from "../inst/organ.js";
import { brushSweep, brushTap, kick, woodblock } from "../inst/percussion.js";
import { banjo, uprightBass } from "../inst/strings.js";
import { arp, chart, grid, mel, pads, type Score, stabs, twoBeat, walk } from "../seq/score.js";
import { cat, line, part } from "./kit.js";

/**
 * "Open Casket Policy", the main theme (front door). D minor, 96 bpm, lightly swung.
 * Intro (2) | A: harmonium carries the hook (8) | A': banjo takes it, flute counter-line (8) |
 * B: F major, the theremin's bridge over walking bass (8) | A'': everybody, calliope on top (8).
 * 34 bars, about 85 s; the last bar turns around into the intro.
 */

const BAR = 4;
const at = (bar: number) => (bar - 1) * BAR;

export const HOOK_A = [
  "D4:1 A4:1 F4:.5 E4:.5 D4:1",
  "C#4:.5 D4:.5 E4:.5 F4:.5 E4:2",
  "D4:1 A4:1 Bb4:.5 A4:.5 G4:1",
  "F4:.5 E4:.5 F4:.5 G4:.5 A4:2",
  "Bb4:1 A4:.5 G4:.5 F4:1 E4:1",
  "D4:.5 E4:.5 F4:.5 D4:.5 C#4:2",
  "D5:1 C#5:.5 C5:.5 B4:1 Bb4:1",
].join(" | ");
const END_HOME = "A4:1 E4:1 D4:2";
const END_TURN = "A4:1 E4:1 D4:1 r:1";

const CH_A =
  "Dm:4 | A7:4 | Dm:2 Gm:2 | C7:2 F:2 | Bb:2 A7:2 | Dm:2 A7:2 | Dm:1 DmMaj7:.5 Dm7:.5 Dm6:1 Gm/Bb:1 | A7:2 Dm:2";
const CH_B = "F:4 | Am7:2 D7:2 | Gm7:4 | C7:4 | F:4 | Bb:2 Bbm6:2 | F/C:2 D7:2 | Gm7:2 A7:2";

const B_TUNE = [
  "F4:1 C5:1 A4:.5 G4:.5 F4:1",
  "E4:.5 F4:.5 G4:.5 A4:.5 F#4:2",
  "G4:1 D5:1 Bb4:.5 A4:.5 G4:1",
  "E4:.5 F4:.5 G4:.5 Bb4:.5 C5:2",
  "A5:1.5 G5:.5 F5:1 C5:1",
  "D5:2 Db5:2",
  "C5:1 A4:1 F#4:1 A4:1",
  "G4:1.5 Bb4:.5 A4:1 C#5:1",
].join(" | ");

const COUNTER =
  "F4:4 | G4:2 E4:2 | F4:2 D4:2 | E4:2 F4:2 | D4:2 C#4:2 | D4:2 E4:2 | F4:1 E4:1 D4:2 | C#4:2 D4:2";

export function mainTheme(): Score {
  const intro = chart("Dm:4 | A7:4", at(1));
  const a1 = chart(CH_A, at(3));
  const a2 = chart(CH_A, at(11));
  const b = chart(CH_B, at(19));
  const a3 = chart(CH_A, at(27));
  const allA = [...a1, ...a2, ...a3];

  const melodyA = mel(`${HOOK_A} | ${END_HOME}`, at(3), 0.85);
  const melodyA3 = mel(`${HOOK_A} | ${END_TURN}`, at(27), 0.9);
  const banjoTune = mel(`+12 ${HOOK_A} | ${END_HOME}`, at(11), 0.85);
  const counter = mel(COUNTER, at(11), 0.55);
  const bTune = mel(B_TUNE, at(19), 0.8);

  const roll = [0, 2, 4, 0, 2, 4, 0, 4];
  return {
    id: "main",
    title: "Open Casket Policy",
    bpm: 96,
    beatsPerBar: BAR,
    bars: 34,
    key: "D minor",
    swing: 0.1,
    loop: true,
    reverb: { size: 0.6, damp: 0.45, pre: 0.015, mix: 1 },
    parts: [
      // Intro: chapel organ alone, the clock-like woodblock.
      part("intro organ", organ("chapel"), pads(intro, 50, 0.6), { level: -6, reverb: 0.5 }),
      part(
        "woodblock",
        woodblock,
        cat(
          grid("x.x.x.x.", 0.5, 2, BAR, 84),
          grid("...x", 1, 1, BAR, 84, at(10)),
          grid("...x", 1, 1, BAR, 84, at(18)),
        ),
        { level: -13, pan: 0.35, reverb: 0.2 },
      ),
      // A sections and A'': the harmonium (reed organ) sings the hook.
      part("harmonium", organ("reed"), cat(melodyA, melodyA3), {
        level: 0,
        pan: -0.1,
        reverb: 0.3,
      }),
      part("calliope", organ("calliope"), mel(`+12 ${HOOK_A} | ${END_TURN}`, at(27), 0.6), {
        level: -8,
        pan: 0.25,
        reverb: 0.35,
      }),
      // A': banjo has the tune, a flute line underneath.
      part("banjo tune", banjo, banjoTune, { level: 0, pan: 0.15, reverb: 0.2 }),
      part("flute", organ("flute"), counter, { level: -7, pan: -0.25, reverb: 0.4 }),
      // B: theremin over vibraphone chords.
      part("theremin", line(theremin), bTune, { level: 0, pan: 0.05, reverb: 0.5, echo: 0.15 }),
      part("vibes", vibraphone, stabs(b, 57, [0, 1.5, 2.5], 1.2, 0.5, 4), {
        level: -8,
        pan: 0.3,
        reverb: 0.4,
      }),
      // Organ pads under everything after the intro, softer in B.
      part("organ pads", organ("chapel"), cat(pads(allA, 50, 0.5)), {
        level: -11,
        pan: 0.1,
        reverb: 0.45,
      }),
      part("organ pads B", organ("chapel"), pads(b, 53, 0.4), {
        level: -11,
        pan: -0.1,
        reverb: 0.5,
      }),
      // Banjo chops on 2 and 4 under the A sections, rolls in A''.
      part("banjo chops", banjo, stabs([...a1, ...a2], 57, [1, 3], 0.3, 0.55, 3), {
        level: -10,
        pan: 0.4,
        reverb: 0.15,
      }),
      part("banjo roll", banjo, arp(a3, 55, roll, 0.5, 0.5, 0.6), {
        level: -10,
        pan: 0.45,
        reverb: 0.15,
      }),
      // Bass: two-beat in A, walking in B.
      part(
        "bass",
        uprightBass,
        cat(twoBeat(chart("A7:4", at(2)), 33), twoBeat(allA, 33), walk(b, 33)),
        { level: -4, pan: -0.05, reverb: 0.08 },
      ),
      // Brushes from A onward; a soft kick in A''.
      part(
        "brush sweep",
        brushSweep,
        grid("x.x.", 1, 32, BAR, 60, at(3)).map((n) => ({ ...n, d: 1.9 })),
        { level: -17, pan: -0.2, reverb: 0.1, straight: true },
      ),
      part("brush tap", brushTap, grid(".x.x", 1, 32, BAR, 60, at(3)), {
        level: -13,
        pan: 0.2,
        reverb: 0.15,
      }),
      part("kick", kick, grid("x.x.", 1, 8, BAR, 36, at(27)), { level: -12, reverb: 0.05 }),
    ],
  };
}

/** The main theme's five-second stinger: the hook's first two bars and a final chord. */
export function mainStinger(): Score {
  const ch = chart("Dm:4 | A7:2 Dm:2");
  return {
    id: "main-stinger",
    title: "Open Casket Policy (sting)",
    bpm: 96,
    beatsPerBar: BAR,
    bars: 2,
    key: "D minor",
    swing: 0.1,
    loop: false,
    tail: 2.5,
    reverb: { size: 0.6, damp: 0.45, pre: 0.015, mix: 1 },
    parts: [
      part(
        "harmonium",
        organ("reed"),
        mel("D4:1 A4:1 F4:.5 E4:.5 D4:1 | C#4:.5 E4:.5 A3:1 D4:2_", 0, 0.9),
        { level: 0, reverb: 0.3 },
      ),
      part(
        "calliope",
        organ("calliope"),
        mel("D5:1 A5:1 F5:.5 E5:.5 D5:1 | C#5:.5 E5:.5 A4:1 D5:2_", 0, 0.6),
        { level: -8, pan: 0.3, reverb: 0.35 },
      ),
      part("organ", organ("chapel"), pads(ch, 50, 0.6), { level: -9, reverb: 0.5 }),
      part("bass", uprightBass, mel("D2:2 A2:2 | A2:2 D2:2_"), { level: -4 }),
      part("banjo", banjo, stabs(ch, 57, [1, 3], 0.3, 0.6), { level: -10, pan: 0.4 }),
      part("final banjo", banjo, mel("D4+F4+A4+D5:2!", 6), { level: -4, pan: 0.4 }),
      part("brush", brushTap, grid(".x.x", 1, 2, BAR, 60), { level: -13, pan: 0.2 }),
      part("woodblock", woodblock, mel("A5:1", 7.5), { level: -13, pan: 0.35 }),
    ],
  };
}
