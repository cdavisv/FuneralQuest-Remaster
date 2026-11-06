import type { ContentPack } from "@fq/core";

/**
 * Rewords every player-facing string of a content pack without touching what the engine
 * reads as data. Words become other words (a fixed letter-for-letter substitution per word,
 * so the same word always becomes the same word), while placeholders (`{name}`, `*NAME*`),
 * colour codes (a backtick and a character), digits, `$` amounts and punctuation stay, and
 * so do ids, picture ids, tags and other keys listed in `DATA_KEYS`. A bot that played by
 * reading the wording would be lost on the result; one that plays from the structured panels
 * and the button ids plays as before.
 */

/** Keys whose string values are data (ids, art, tags, enums), never wording. */
const DATA_KEYS =
  /^(id|ids|picture|portrait|bg|fg|tags|track|kind|side|place|key|op|to|next|ifTrue|ifFalse|ending|endings|causes|grant|requires|start|article|swearWords|first|surname|rarity|when|test|modifiers|game|slot|category|stat|item)$|(Picture|Background)$/;

const ALPHABET = "abcdefghijklmnopqrstuvwxyz";

function scrambleWord(word: string): string {
  let h = 7;
  for (const ch of word.toLowerCase()) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  const shift = 1 + (Math.abs(h) % 24);
  let out = "";
  for (const ch of word) {
    const lower = ch.toLowerCase();
    const at = ALPHABET.indexOf(lower);
    if (at < 0) {
      out += ch;
      continue;
    }
    // A vowel stays a vowel, so the result still reads like words.
    const vowels = "aeiou";
    const mapped = vowels.includes(lower)
      ? (vowels[(vowels.indexOf(lower) + shift) % 5] as string)
      : ((): string => {
          const consonants = ALPHABET.split("").filter((l) => !vowels.includes(l));
          return consonants[(consonants.indexOf(lower) + shift) % consonants.length] as string;
        })();
    out += ch === lower ? mapped : mapped.toUpperCase();
  }
  return out;
}

const KEEP = /(\{[A-Za-z0-9_]+\}|\*[A-Z]+\*|`.|\\n|\$[\d,]+|[\d,.]+%?)/;

/** One string: words reworded, everything that is not a word kept. */
export function scrambleText(text: string): string {
  return text
    .split(KEEP)
    .map((part, i) => (i % 2 === 1 ? part : part.replace(/[A-Za-z]+/g, scrambleWord)))
    .join("");
}

function walk(value: unknown, key: string, inData: boolean): unknown {
  if (typeof value === "string") {
    return inData || DATA_KEYS.test(key) ? value : scrambleText(value);
  }
  if (Array.isArray(value)) return value.map((v) => walk(v, key, inData || DATA_KEYS.test(key)));
  if (value && typeof value === "object") {
    const data = inData || DATA_KEYS.test(key);
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, walk(v, k, data)]),
    );
  }
  return value;
}

/** A copy of the pack with all its wording scrambled. */
export function scramblePack(pack: ContentPack): ContentPack {
  const out = walk(pack, "", false) as ContentPack;
  return out;
}
