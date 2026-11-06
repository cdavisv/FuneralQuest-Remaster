import type { Rng } from "../dsp/rng.js";

/** One note as an instrument sees it: seconds and Hz, already out of the score's beats. */
export interface NoteEvent {
  freq: number;
  /** Key-down time in seconds; the instrument adds its own release after it. */
  dur: number;
  /** 0 to 1. */
  vel: number;
}

/** A polyphonic instrument renders each note on its own; the sequencer mixes them. */
export type Voice = (sr: number, note: NoteEvent, rng: Rng) => Float32Array;

/** A note of a monophonic line, with its start time in seconds from the start of the line. */
export interface LineNote extends NoteEvent {
  t: number;
}

/** A monophonic instrument renders a whole phrase so it can glide between notes. */
export type LineVoice = (sr: number, notes: readonly LineNote[], rng: Rng) => Float32Array;
