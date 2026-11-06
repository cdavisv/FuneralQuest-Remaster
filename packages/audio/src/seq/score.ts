import type { ReverbOptions } from "../dsp/fx.js";
import type { LineVoice, Voice } from "../inst/types.js";
import { bassNote, type Chord, chord, pitch, tones, voicing } from "./theory.js";

/**
 * The score format. Times and lengths are in beats; pitches are MIDI numbers. A composition is
 * a `Score`: tempo, metre, length, and parts, each one instrument with its notes and its place
 * in the mix.
 */
export interface Note {
  t: number;
  d: number;
  p: number;
  v: number;
}

export interface Part {
  name: string;
  /** Polyphonic instrument (each note rendered alone) ... */
  voice?: Voice;
  /** ... or a monophonic one that renders whole phrases (glides). */
  line?: LineVoice;
  notes: Note[];
  /** Linear gain, applied when `level` is not given. */
  gain: number;
  /**
   * Mix level in LU: the part is scaled so its own gated loudness is this many LU relative to
   * the others (0 for the lead, about -10 for a pad). Mixing by numbers, since nobody listens.
   */
  level?: number;
  pan: number;
  /** Reverb send 0 to 1. */
  reverb: number;
  /** Echo send 0 to 1 (the score's `echo` sets the time). */
  echo?: number;
  /** Which stem the part belongs to (the negotiation's intensity layers); default 0. */
  layer?: number;
  /** Timing scatter in seconds and velocity scatter (0 to 1). */
  humanize?: { time: number; vel: number };
  /** Ignore the score's swing for this part (straight drums under a swung tune, say). */
  straight?: boolean;
}

export interface Score {
  id: string;
  title: string;
  bpm: number;
  beatsPerBar: number;
  bars: number;
  /** For the report: "D minor". */
  key: string;
  /** Swing: off-beat eighths are delayed by this fraction of a beat (1/6 is a triplet feel). */
  swing?: number;
  parts: Part[];
  reverb: ReverbOptions & { mix: number };
  /** Echo time in beats and feedback. */
  echo?: { beats: number; feedback: number };
  loop: boolean;
  /** For one-shots: seconds of ring after the last bar before the render ends. */
  tail?: number;
  /** Stem count (layers) for the negotiation; default 1. */
  layers?: number;
  /** A gentle tilt of the whole mix: dB of high shelf above 6 kHz (negative to darken). */
  air?: number;
}

/** Seconds per beat. */
export const spb = (s: Pick<Score, "bpm">): number => 60 / s.bpm;

/** Length of a score in beats. */
export const scoreBeats = (s: Pick<Score, "bars" | "beatsPerBar">): number =>
  s.bars * s.beatsPerBar;

function parseDur(text: string): number {
  if (text.includes("/")) {
    const [a, b] = text.split("/");
    return Number(a) / Number(b);
  }
  return Number(text);
}

/**
 * The melody notation: space-separated tokens, each `pitch[:beats][mark]`.
 * - pitch: `C4`, `Bb3`, `F#5`; a chord `C4+E4+G4`; `r` for a rest.
 * - beats: `1`, `.5`, `1.5`, `1/3`; omitted means the previous token's length.
 * - marks: `!` accent, `?` soft, `'` staccato (half length), `_` tenuto (full length, legato).
 * - `|` is a bar line and is ignored (it keeps the text readable).
 * - `+N` or `-N` alone transposes everything after it by N semitones (reset with `+0`).
 * Returns notes starting at `start` beats.
 */
export function mel(text: string, start = 0, vel = 0.8): Note[] {
  const out: Note[] = [];
  let t = start;
  let d = 1;
  let shift = 0;
  for (const raw of text.split(/\s+/)) {
    if (raw === "" || raw === "|") continue;
    if (/^[+-]\d+$/.test(raw)) {
      shift = Number(raw);
      continue;
    }
    const m = /^([^:!?'_]+)(?::([\d./]+))?([!?'_]*)$/.exec(raw);
    if (!m) throw new Error(`bad token "${raw}"`);
    if (m[2]) d = parseDur(m[2]);
    const marks = m[3] ?? "";
    let v = vel;
    if (marks.includes("!")) v = Math.min(1, vel + 0.2);
    if (marks.includes("?")) v = vel * 0.65;
    const len = marks.includes("'") ? d * 0.5 : marks.includes("_") ? d : d * 0.92;
    const head = m[1] as string;
    if (head !== "r") {
      for (const p of head.split("+")) out.push({ t, d: len, p: pitch(p) + shift, v });
    }
    t += d;
  }
  return out;
}

/** Length in beats of a melody string (to place the next phrase after it). */
export function melBeats(text: string): number {
  let d = 1;
  let total = 0;
  for (const raw of text.split(/\s+/)) {
    if (raw === "" || raw === "|" || /^[+-]\d+$/.test(raw)) continue;
    const m = /^([^:!?'_]+)(?::([\d./]+))?/.exec(raw);
    if (m?.[2]) d = parseDur(m[2]);
    total += d;
  }
  return total;
}

export interface Span {
  t: number;
  d: number;
  c: Chord;
}

/** A chord chart: `"Dm:4 A7:4 | Dm:2 Gm:2"`, durations in beats (default: the previous one). */
export function chart(text: string, start = 0): Span[] {
  const out: Span[] = [];
  let t = start;
  let d = 4;
  for (const raw of text.split(/\s+/)) {
    if (raw === "" || raw === "|") continue;
    const [sym, dur] = raw.split(":");
    if (dur) d = parseDur(dur);
    if (sym && sym !== "N") out.push({ t, d, c: chord(sym) });
    t += d;
  }
  return out;
}

/** Shifts notes in time (and optionally pitch). */
export const shift = (notes: Note[], beats: number, semis = 0): Note[] =>
  notes.map((n) => ({ ...n, t: n.t + beats, p: n.p + semis }));

/** Repeats a block of notes `times` times, `every` beats apart. */
export function repeat(notes: Note[], times: number, every: number): Note[] {
  const out: Note[] = [];
  for (let k = 0; k < times; k++) out.push(...shift(notes, k * every));
  return out;
}

export const scaleVel = (notes: Note[], k: number): Note[] =>
  notes.map((n) => ({ ...n, v: n.v * k }));

// --- Accompaniment from a chord chart -----------------------------------------------------

/** Sustained chords (organ, pad): each span voiced close above `low`. */
export function pads(spans: Span[], low: number, vel = 0.6, count?: number): Note[] {
  const out: Note[] = [];
  for (const s of spans) {
    for (const p of voicing(s.c, low, count ?? Math.min(4, s.c.intervals.length))) {
      out.push({ t: s.t, d: s.d * 0.98, p, v: vel });
    }
  }
  return out;
}

/** Chords struck on the given beats of each span (relative to the span start). */
export function stabs(
  spans: Span[],
  low: number,
  beats: number[],
  len: number,
  vel = 0.7,
  count = 3,
): Note[] {
  const out: Note[] = [];
  for (const s of spans) {
    for (const b of beats) {
      if (b >= s.d) continue;
      for (const p of voicing(s.c, low, count)) out.push({ t: s.t + b, d: len, p, v: vel });
    }
  }
  return out;
}

/** Two-beat bass: root on the first beat of each pair, fifth on the next pair. */
export function twoBeat(spans: Span[], low: number, vel = 0.85, len = 0.9): Note[] {
  const out: Note[] = [];
  for (const s of spans) {
    const root = bassNote(s.c, low);
    const fifthPc = (s.c.root + 7) % 12;
    let fifth = root - ((root - fifthPc + 120) % 12);
    if (fifth < low) fifth += 12;
    for (let b = 0; b < s.d; b += 2) {
      out.push({
        t: s.t + b,
        d: Math.min(len * 2, s.d - b) * 0.9,
        p: b % 4 === 0 ? root : fifth,
        v: vel,
      });
    }
  }
  return out;
}

/**
 * Walking bass: quarter notes, root on each chord's first beat, chord tones in between and a
 * chromatic approach into the next chord.
 */
export function walk(spans: Span[], low: number, vel = 0.8): Note[] {
  const out: Note[] = [];
  for (let k = 0; k < spans.length; k++) {
    const s = spans[k] as Span;
    const next = spans[(k + 1) % spans.length] as Span;
    const root = bassNote(s.c, low);
    const nextRoot = bassNote(next.c, low);
    const ts = tones(s.c);
    for (let b = 0; b < s.d; b++) {
      let p: number;
      if (b === 0) p = root;
      else if (b === s.d - 1) p = nextRoot + (nextRoot > root ? -1 : 1);
      else {
        const pc = ts[b % ts.length] as number;
        p = root + ((pc - (root % 12) + 12) % 12);
        if (p > low + 19) p -= 12;
      }
      out.push({ t: s.t + b, d: 0.9, p, v: vel * (b === 0 ? 1 : 0.85) });
    }
  }
  return out;
}

/** Oom-pah: bass on beats 1 and 3 (root, fifth), chord on 2 and 4. */
export function oomPah(
  spans: Span[],
  bassLow: number,
  chordLow: number,
  vel = 0.75,
): { bass: Note[]; chords: Note[] } {
  const bass = twoBeat(spans, bassLow, vel, 0.5);
  const chords: Note[] = [];
  for (const s of spans) {
    for (let b = 1; b < s.d; b += 2) {
      for (const p of voicing(s.c, chordLow, 3))
        chords.push({ t: s.t + b, d: 0.45, p, v: vel * 0.8 });
    }
  }
  return { bass, chords };
}

/**
 * Arpeggio / banjo roll: `pattern` indexes into the chord tones stacked from `low` (0 is the
 * lowest), one entry per `step` beats, repeated across each span.
 */
export function arp(
  spans: Span[],
  low: number,
  pattern: number[],
  step: number,
  vel = 0.7,
  len?: number,
): Note[] {
  const out: Note[] = [];
  for (const s of spans) {
    const stack = voicing(s.c, low, 6);
    let i = 0;
    for (let b = 0; b < s.d - 1e-9; b += step) {
      const idx = pattern[i % pattern.length] as number;
      i++;
      if (idx < 0) continue;
      const p = stack[idx % stack.length] as number;
      out.push({ t: s.t + b, d: len ?? step * 1.5, p, v: vel * (b % 1 === 0 ? 1 : 0.85) });
    }
  }
  return out;
}

/**
 * Drum grid: one character per `step` beats. `x` hit, `X` accent, `o` soft, `.` rest.
 * Spaces and bar lines are ignored. The pattern repeats for `bars` bars of `beatsPerBar`.
 */
export function grid(
  pattern: string,
  step: number,
  bars: number,
  beatsPerBar: number,
  p = 60,
  start = 0,
): Note[] {
  const cells = pattern.replace(/[\s|]/g, "");
  const out: Note[] = [];
  const perPass = cells.length * step;
  const total = bars * beatsPerBar;
  for (let base = 0; base < total - 1e-9; base += perPass) {
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      const t = base + i * step;
      if (t >= total - 1e-9) break;
      const v = c === "X" ? 1 : c === "x" ? 0.75 : c === "o" ? 0.45 : 0;
      if (v > 0) out.push({ t: start + t, d: step, p, v });
    }
  }
  return out;
}

/**
 * A glissando (harp sweep): every pitch of the scale from `from` to `to` (MIDI, either
 * direction), spread evenly over `beats` starting at `at`. `scale` is pitch classes above `key`.
 */
export function gliss(
  from: number,
  to: number,
  key: number,
  scale: number[],
  at: number,
  beats: number,
  vel = 0.6,
): Note[] {
  const pcs = new Set(scale.map((x) => (((key + x) % 12) + 12) % 12));
  const ps: number[] = [];
  const dir = to >= from ? 1 : -1;
  for (let p = from; dir > 0 ? p <= to : p >= to; p += dir)
    if (pcs.has(((p % 12) + 12) % 12)) ps.push(p);
  return ps.map((p, k) => ({
    t: at + (k * beats) / ps.length,
    d: 1.5,
    p,
    v: vel * (0.75 + 0.25 * Math.sin((Math.PI * k) / ps.length)),
  }));
}

export const MAJOR = [0, 2, 4, 5, 7, 9, 11];
export const MINOR = [0, 2, 3, 5, 7, 8, 10];
export const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11];
export const PENTATONIC = [0, 2, 4, 7, 9];

export { chord, pitch };

/**
 * `mel` with bar checking: every `|`-separated bar must add up to `beatsPerBar` beats (the
 * last may be short only if `allowShortEnd`). Catches the commonest composing slip.
 */
export function bars(text: string, beatsPerBar: number, start = 0, vel = 0.8): Note[] {
  const chunks = text.split("|");
  let carry = 1;
  chunks.forEach((chunk, i) => {
    let total = 0;
    for (const raw of chunk.trim().split(/\s+/)) {
      if (raw === "" || /^[+-]\d+$/.test(raw)) continue;
      const m = /^([^:!?'_]+)(?::([\d./]+))?/.exec(raw);
      if (m?.[2]) carry = parseDur(m[2]);
      total += carry;
    }
    if (Math.abs(total - beatsPerBar) > 1e-6) {
      throw new Error(`bar ${i + 1} has ${total} beats, not ${beatsPerBar}: "${chunk.trim()}"`);
    }
  });
  return mel(text, start, vel);
}

/** A chord chart with the same bar check. */
export function chartBars(text: string, beatsPerBar: number, start = 0): Span[] {
  const chunks = text.split("|");
  let carry = beatsPerBar;
  chunks.forEach((chunk, i) => {
    let total = 0;
    for (const raw of chunk.trim().split(/\s+/)) {
      if (raw === "") continue;
      const dur = raw.split(":")[1];
      if (dur) carry = parseDur(dur);
      total += carry;
    }
    if (Math.abs(total - beatsPerBar) > 1e-6) {
      throw new Error(
        `chart bar ${i + 1} has ${total} beats, not ${beatsPerBar}: "${chunk.trim()}"`,
      );
    }
  });
  return chart(text, start);
}
