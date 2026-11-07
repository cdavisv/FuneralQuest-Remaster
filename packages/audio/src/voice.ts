import type { RichText } from "@fq/protocol";

/**
 * Character voices: who in the town speaks, how a spoken line is found in a View's text, and the
 * key a recorded clip is filed under. The voice build (scripts/voice*.ts) and the client
 * (apps/client/src/audio/voice*.ts) both use these functions, so a clip made for a line is found
 * again when that line is on screen.
 *
 * A line is a quotation in the text, attributed to a character either by a speaker tag (a white
 * "Name:" right before a quote, as the original wrote `` `wElijah: `$"..." ``) or, with no tag,
 * by narration in the same paragraph that names exactly one character ("...," Mr Yang tells
 * you). A quote whose speaker is not a known character (a customer, the player) is not a line.
 */

export interface VoiceCharacter {
  id: string;
  /** Display name. */
  name: string;
  /** "original": the 2001 cast (their lines are the original text). "expanded": 2026 writing. */
  cast: "original" | "expanded";
  /** Speaker tags as shown before a quote, matched exactly (case-insensitive). */
  tags: readonly string[];
  /** Names that attribute an untagged quote when the paragraph's narration names them. */
  narrated: readonly string[];
}

export const VOICE_CHARACTERS: readonly VoiceCharacter[] = [
  // "Elija" is the original's own spelling in some Di-Mart lines; it is the same clerk.
  {
    id: "elijah",
    name: "Elijah",
    cast: "original",
    tags: ["Elijah", "Elija"],
    narrated: ["Elijah"],
  },
  {
    id: "smyth",
    name: "Father Smyth",
    cast: "original",
    tags: ["Father Smyth"],
    narrated: ["Father Smyth", "Smyth"],
  },
  { id: "june", name: "June", cast: "original", tags: ["June"], narrated: ["June"] },
  {
    id: "yang",
    name: "Mr. Yang",
    cast: "original",
    tags: ["Mr. Yang", "Mr Yang"],
    narrated: ["Mr. Yang", "Mr Yang"],
  },
  {
    id: "twins",
    name: "The Twins",
    cast: "original",
    tags: ["The Twins"],
    narrated: ["The Twins"],
  },
  { id: "teller", name: "Teller", cast: "original", tags: ["Teller"], narrated: [] },
  { id: "nurse", name: "Nurse", cast: "original", tags: ["Nurse"], narrated: [] },
  { id: "bartender", name: "Bartender", cast: "original", tags: ["Bartender"], narrated: [] },
  { id: "clerk", name: "Clerk (the Guild)", cast: "expanded", tags: ["Clerk"], narrated: [] },
  {
    id: "grubb",
    name: "Mayor Hollis Grubb",
    cast: "expanded",
    tags: ["Mayor Hollis Grubb"],
    narrated: ["Mayor Hollis Grubb", "Hollis Grubb", "Mayor Grubb"],
  },
  {
    id: "vane",
    name: "Lucius Vane",
    cast: "expanded",
    tags: ["Lucius Vane"],
    narrated: ["Lucius Vane", "Vane"],
  },
  {
    id: "mudge",
    name: "Inspector Mudge",
    cast: "expanded",
    tags: ["Inspector Mudge"],
    narrated: ["Inspector Mudge", "Mudge"],
  },
  {
    id: "prudence",
    name: "Prudence Ledbetter",
    cast: "expanded",
    tags: ["Prudence Ledbetter", "Prudence"],
    narrated: ["Prudence Ledbetter", "Prudence"],
  },
  {
    id: "gertie",
    name: "Nurse Gertie",
    cast: "expanded",
    tags: ["Nurse Gertie"],
    narrated: ["Nurse Gertie", "Gertie"],
  },
  { id: "morty", name: "Morty", cast: "expanded", tags: ["Morty"], narrated: [] },
];

const byTag = new Map<string, VoiceCharacter>();
for (const c of VOICE_CHARACTERS) for (const t of c.tags) byTag.set(t.toLowerCase(), c);

/** The character a speaker tag names, or undefined (a customer, the player, a stranger). */
export function characterForTag(tag: string): VoiceCharacter | undefined {
  return byTag.get(tag.trim().toLowerCase());
}

/** Whitespace runs (spaces, line breaks) become one space; the ends are trimmed. */
export function normaliseLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** FNV-1a over UTF-16 code units, 32 bits, from a seed. */
function fnv(text: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * The key a clip is filed under: the character's id and a 64-bit hash of the line's exact text
 * (whitespace normalised; case and punctuation kept). Stable across builds and platforms.
 */
export function voiceKey(character: string, text: string): string {
  const t = `${character}\u0000${normaliseLine(text)}`;
  const a = fnv(t, 0x811c9dc5).toString(16).padStart(8, "0");
  const b = fnv(t, 0x050c5d1f).toString(16).padStart(8, "0");
  return `${character}-${a}${b}`;
}

/** Sentences of a line (split after . ! ? or an ellipsis followed by a space). */
export function sentences(text: string): string[] {
  return normaliseLine(text)
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s !== "");
}

/**
 * The texts a clip may be filed under for a line on screen: the whole line; the line without its
 * first sentence; the line without its last sentence. A line whose first or last sentence holds a
 * player's name or a number is voiced without that sentence (the rest is fixed text).
 */
export function lineCandidates(text: string): { text: string; part: "whole" | "tail" | "head" }[] {
  const whole = normaliseLine(text);
  const s = sentences(whole);
  const out: { text: string; part: "whole" | "tail" | "head" }[] = [{ text: whole, part: "whole" }];
  if (s.length > 1) {
    out.push({ text: s.slice(1).join(" "), part: "tail" });
    out.push({ text: s.slice(0, -1).join(" "), part: "head" });
  }
  return out;
}

export interface SpokenLine {
  character: string;
  /** The speaker as the text names them (the tag, or the name in the narration). */
  speaker: string;
  /** The words inside the quotation marks, whitespace normalised. */
  text: string;
  how: "tag" | "narrated";
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The spoken lines in a piece of text, in reading order. `text` is RichText (white spans mark
 * speaker tags) or a plain string (then any "Name:" before a quote counts as a tag).
 */
export function spokenLines(text: RichText | string): SpokenLine[] {
  const spans = typeof text === "string" ? [{ text }] : text;
  let s = "";
  const white: boolean[] = [];
  for (const sp of spans) {
    s += sp.text;
    const w = typeof text === "string" || ("color" in sp && sp.color === "white");
    for (let i = 0; i < sp.text.length; i++) white.push(w);
  }
  // pair the quotation marks in order
  const quotes: [number, number][] = [];
  for (let i = s.indexOf('"'); i >= 0; ) {
    const j = s.indexOf('"', i + 1);
    if (j < 0) break;
    quotes.push([i, j]);
    i = s.indexOf('"', j + 1);
  }
  const out: SpokenLine[] = [];
  for (const [o, c] of quotes) {
    const words = normaliseLine(s.slice(o + 1, c));
    if (words === "") continue;
    const before = s.slice(Math.max(0, o - 60), o);
    const tag =
      /(?:^|[\n"])\s*([^\n:"]{1,40}):\s*$/.exec(before) ?? /([^\n:"]{1,40}):\s*$/.exec(before);
    if (tag?.[1]) {
      const name = tag[1].trim();
      const at = o - before.length + before.lastIndexOf(tag[1]) + tag[1].indexOf(name);
      const isWhite = name.length > 0 && white.slice(at, at + name.length).every(Boolean);
      if (isWhite) {
        const ch = characterForTag(name);
        if (ch) out.push({ character: ch.id, speaker: name, text: words, how: "tag" });
        continue;
      }
    }
    // narrated: the paragraph's narration (outside quotes) names exactly one character
    if (!/^[A-Z]/.test(words) || words.split(" ").length < 3) continue;
    const p0 = s.lastIndexOf("\n", o) + 1;
    const p1n = s.indexOf("\n", c);
    const p1 = p1n < 0 ? s.length : p1n;
    let narration = "";
    let last = p0;
    for (const [qo, qc] of quotes) {
      if (qc < p0 || qo > p1) continue;
      narration += `${s.slice(last, qo)} `;
      last = qc + 1;
    }
    narration += s.slice(last, p1);
    const named = VOICE_CHARACTERS.filter((ch) =>
      ch.narrated.some((n) =>
        new RegExp(`(^|[^A-Za-z])${escapeRe(n)}(?![A-Za-z])`).test(narration),
      ),
    );
    if (named.length === 1) {
      const ch = named[0] as VoiceCharacter;
      const speaker =
        ch.narrated.find((n) =>
          new RegExp(`(^|[^A-Za-z])${escapeRe(n)}(?![A-Za-z])`).test(narration),
        ) ?? ch.name;
      out.push({ character: ch.id, speaker, text: words, how: "narrated" });
    }
  }
  return out;
}

/** One clip of the voice pack (assets/voice/manifest.json). */
export interface VoiceClip {
  /** `voiceKey(character, text)`. */
  key: string;
  character: string;
  /** The speaker as the game shows them. */
  speaker: string;
  /** The exact words spoken (whitespace normalised). */
  text: string;
  /** "whole": the full line. "tail"/"head": the line without a first/last sentence that varies. */
  part: "whole" | "tail" | "head";
  /** Which rulesets show the line. */
  rulesets: ("classic" | "expanded")[];
  /** Paths relative to assets/voice/. */
  file: { ogg: string; m4a: string; bytes: number };
  /** Seconds. */
  duration: number;
}

export interface VoiceManifest {
  generator: string;
  license: string;
  /** Integrated loudness every clip was normalised to (LUFS). */
  lufs: number;
  totalBytes: number;
  clips: VoiceClip[];
}

/** Where the voice pack sits beside the sound packs (under the asset root). */
export const VOICE_DIR = "voice";
