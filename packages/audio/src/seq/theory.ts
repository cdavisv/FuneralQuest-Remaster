/**
 * Pitch names, chord symbols and voicings. Pitches are MIDI numbers (C4 = 60).
 */

const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "C4", "F#3", "Bb2", "Ebb4" to MIDI. */
export function pitch(name: string): number {
  const m = /^([A-Ga-g])(#{1,2}|b{1,2})?(-?\d)$/.exec(name.trim());
  if (!m) throw new Error(`bad pitch "${name}"`);
  const letter = (m[1] as string).toUpperCase();
  const acc = m[2] ?? "";
  const shift = acc.startsWith("#") ? acc.length : -acc.length;
  return 12 * (Number(m[3]) + 1) + (LETTER[letter] as number) + shift;
}

/** Pitch class of a note name without octave: "Eb" to 3. */
export function pitchClass(name: string): number {
  const m = /^([A-Ga-g])(#{1,2}|b{1,2})?$/.exec(name);
  if (!m) throw new Error(`bad pitch class "${name}"`);
  const acc = m[2] ?? "";
  const shift = acc.startsWith("#") ? acc.length : -acc.length;
  return ((((LETTER[(m[1] as string).toUpperCase()] as number) + shift) % 12) + 12) % 12;
}

const QUALITIES: Record<string, number[]> = {
  "": [0, 4, 7],
  m: [0, 3, 7],
  "7": [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  mMaj7: [0, 3, 7, 11],
  "6": [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10],
  aug: [0, 4, 8],
  sus4: [0, 5, 7],
  sus2: [0, 2, 7],
  "9": [0, 4, 7, 10, 14],
  m9: [0, 3, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  "7b9": [0, 4, 7, 10, 13],
  add9: [0, 4, 7, 14],
  "5": [0, 7],
};

export interface Chord {
  symbol: string;
  /** Root pitch class. */
  root: number;
  /** Intervals above the root, ascending (may exceed 12 for ninths). */
  intervals: number[];
  /** Bass pitch class (the root, or the slash note). */
  bass: number;
}

/** "Dm7", "A7/C#", "Bbmaj7", "F#dim7", "N" (no chord). */
export function chord(symbol: string): Chord {
  const m = /^([A-G](?:#|b)?)([^/]*)(?:\/([A-G](?:#|b)?))?$/.exec(symbol.trim());
  if (!m) throw new Error(`bad chord "${symbol}"`);
  const q = m[2] ?? "";
  const iv = QUALITIES[q];
  if (!iv) throw new Error(`unknown chord quality "${q}" in "${symbol}"`);
  const root = pitchClass(m[1] as string);
  return { symbol, root, intervals: iv, bass: m[3] ? pitchClass(m[3]) : root };
}

/** The pitch class nearest at or above `low` (a MIDI number) with the given class. */
export function atOrAbove(pc: number, low: number): number {
  let p = low - (((low % 12) + 12) % 12) + pc;
  if (p < low) p += 12;
  return p;
}

/** Chord tones as MIDI in close position, the lowest at or above `low`. */
export function voicing(c: Chord, low: number, count = c.intervals.length): number[] {
  const pcs = c.intervals.map((i) => (c.root + i) % 12);
  const out: number[] = [];
  let floor = low;
  // start from the chord tone closest above `low`, then stack upward
  const ordered = pcs
    .map((pc) => ({ pc, p: atOrAbove(pc, low) }))
    .sort((a, b) => a.p - b.p)
    .map((x) => x.pc);
  let k = 0;
  while (out.length < count) {
    const p = atOrAbove(ordered[k % ordered.length] as number, floor);
    out.push(p);
    floor = p + 1;
    k++;
  }
  return out;
}

/** Bass note of a chord at or above `low`. */
export const bassNote = (c: Chord, low: number): number => atOrAbove(c.bass, low);

/** Root, third, fifth (and seventh if any) of a chord as pitch classes. */
export const tones = (c: Chord): number[] => c.intervals.map((i) => (c.root + i) % 12);
