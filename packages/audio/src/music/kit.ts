import type { LineVoice, Voice } from "../inst/types.js";
import type { Note, Part } from "../seq/score.js";

/** Shorthand for a part: `part("bass", uprightBass, notes, { gain: 0.8, pan: -0.1 })`. */
export function part(
  name: string,
  inst: Voice | { line: LineVoice },
  notes: Note[],
  o: Partial<Omit<Part, "name" | "voice" | "line" | "notes">> = {},
): Part {
  const base: Part = {
    name,
    notes,
    gain: o.gain ?? 0.7,
    pan: o.pan ?? 0,
    reverb: o.reverb ?? 0.25,
  };
  if (typeof inst === "function") base.voice = inst;
  else base.line = inst.line;
  if (o.level !== undefined) base.level = o.level;
  if (o.echo !== undefined) base.echo = o.echo;
  if (o.layer !== undefined) base.layer = o.layer;
  if (o.humanize !== undefined) base.humanize = o.humanize;
  if (o.straight !== undefined) base.straight = o.straight;
  return base;
}

/** Wraps a monophonic instrument so `part` knows to render it as phrases. */
export const line = (v: LineVoice) => ({ line: v });

/** Concatenates note lists. */
export const cat = (...lists: Note[][]): Note[] => lists.flat();

/**
 * The Deathville motif, the hook every cue borrows from: up a fifth, down by step, home
 * (in D minor: D A F E D), then a chromatic lean on the leading tone. As intervals above the
 * tonic in a minor key, with beats.
 */
export const MOTIF_MINOR = "D4:1 A4:1 F4:.5 E4:.5 D4:1 | C#4:.5 D4:.5 E4:.5 F4:.5 E4:2";
