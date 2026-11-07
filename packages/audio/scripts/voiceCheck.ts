/**
 * The voice pack's word check: does a clip say exactly the words of its line? Both the script and
 * the transcript are reduced to letters and digits only (case, punctuation, spacing and hyphens
 * dropped; numbers spelled out; "%" as "percent"), so "Cash up front, friend." and "Cash up front
 * friend" agree while any changed, added or missing word does not.
 *
 * Speech-to-text cannot know how a game's own names are spelled. A short list of the game's proper
 * nouns that sound exactly like other words ("Bury Points" said aloud is "berry points") is applied
 * to the transcript only; a clip passed that way is marked so a person can listen to it.
 */

const ONES = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function spell(n: number): string {
  if (n < 20) return ONES[n] as string;
  if (n < 100) return `${TENS[Math.floor(n / 10)]}${n % 10 ? ONES[n % 10] : ""}`;
  if (n < 1000) return `${ONES[Math.floor(n / 100)]}hundred${n % 100 ? spell(n % 100) : ""}`;
  if (n < 1_000_000)
    return `${spell(Math.floor(n / 1000))}thousand${n % 1000 ? spell(n % 1000) : ""}`;
  return String(n);
}

/** Letters and digits only, numbers spelled out, lower case. */
export function canonicalWords(text: string): string {
  return text
    .toLowerCase()
    .replace(/(\d),(\d{3})/g, "$1$2")
    .replace(/\$(\d+)/g, "$1 dollars")
    .replace(/%/g, " percent")
    .replace(/&/g, " and ")
    .replace(/\d+/g, (d) => ` ${spell(Number(d))} `)
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * The game's proper nouns that a transcriber writes as ordinary words (or misspells), and how it
 * may write them. Only ever applied to a transcript, and only to turn the heard spelling into the
 * game's; a match through this list is reported.
 */
export const PROPER_NOUN_SPELLINGS: readonly [game: string, heard: readonly string[]][] = [
  ["Bury Points", ["berry points", "bury points", "barry points"]],
  ["Di-Mart", ["dymart", "dimart", "di mart", "die mart", "d mart", "dy mart", "dye mart"]],
  ["Smyth", ["smith"]],
  ["Deathville", ["death ville"]],
  // the bingo caller's pun on "before": said aloud the two are the same sounds
  ["B-4", ["before", "b4", "b for", "be for", "b-for"]],
];

export interface WordCheck {
  ok: boolean;
  /** True when it matched only through PROPER_NOUN_SPELLINGS. */
  viaProperNoun: boolean;
  expected: string;
  heard: string;
  /** The first differing word, for the report. */
  diff?: string;
}

export function checkWords(script: string, transcript: string): WordCheck {
  const expected = canonicalWords(script);
  const heard = canonicalWords(transcript);
  if (expected === heard) return { ok: true, viaProperNoun: false, expected, heard };
  let fixed = transcript;
  for (const [game, variants] of PROPER_NOUN_SPELLINGS) {
    if (!script.includes(game)) continue;
    for (const v of variants)
      fixed = fixed.replace(new RegExp(v.replace(/ /g, "[\\s-]*"), "gi"), game);
  }
  const heard2 = canonicalWords(fixed);
  if (heard2 === expected) return { ok: true, viaProperNoun: true, expected, heard: heard2 };
  const a = script.toLowerCase().match(/[a-z0-9']+/g) ?? [];
  const b = transcript.toLowerCase().match(/[a-z0-9']+/g) ?? [];
  let i = 0;
  while (i < a.length && i < b.length && a[i]?.replace(/'/g, "") === b[i]?.replace(/'/g, "")) i++;
  return {
    ok: false,
    viaProperNoun: false,
    expected,
    heard: heard2,
    diff: `script "${a.slice(i, i + 3).join(" ")}" / heard "${b.slice(i, i + 3).join(" ")}"`,
  };
}

/** Words per second a clip may take: slower or faster than this is a sign of a fault. */
export const SPEAKING_RATE = { min: 1.2, max: 4.8 } as const;

export function wordCount(text: string): number {
  return (text.match(/[A-Za-z0-9']+/g) ?? []).length;
}
