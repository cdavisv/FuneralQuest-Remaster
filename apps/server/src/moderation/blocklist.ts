import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

/**
 * The strict block list: words (slurs) that announcements, names and parlor names are refused
 * for, outright. It is separate from the engine's swear filter, which replaces words in some text.
 *
 * The list is never in the repository. The sysop supplies a file (`FQ_BLOCKLIST_FILE`), one entry
 * per line, `#` starts a comment:
 *
 *   word            a plain word, matched as a whole word
 *   ~word           matched anywhere, even inside another word or spread over spaces and symbols
 *   sha256:<hex>    the same, as a hash of the normalised word (`hashLine` makes them)
 *   ~sha256:<hex>   a hashed "anywhere" entry
 *
 * Plain words are hashed at load and forgotten, so the process keeps only hashes, and nothing the
 * server logs, audits or answers contains a listed word: a refusal names no word and a rejected
 * text is not written to the audit log.
 *
 * Matching looks through look-alikes: case, accents, and the usual digit and symbol swaps
 * (`0`=o, `1`=i, `3`=e, `4`=a, `5`=s, `7`=t, `@`=a, `$`=s, `!`=i). Because `!` ends sentences, a
 * second reading treats the symbols as separators, so "word!" is caught too.
 */

const DIGITS: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
};
const SYMBOLS: Record<string, string> = { "@": "a", $: "s", "!": "i", "|": "i" };

/** Lower case, accents removed, look-alikes turned into letters (`symbols` false: left as separators). */
function fold(text: string, symbols: boolean): string {
  const base = text
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase();
  let out = "";
  for (const ch of base) out += DIGITS[ch] ?? (symbols ? (SYMBOLS[ch] ?? ch) : ch);
  return out;
}

const wordsIn = (folded: string): string[] => folded.match(/\p{L}+/gu) ?? [];

/** The two readings of a text: with symbols as letters, and with symbols as separators. */
function readings(text: string): string[][] {
  return [wordsIn(fold(text, true)), wordsIn(fold(text, false))];
}

/** Words plus runs of single letters joined up, so "f.l.u.r.b.o" and "f l u r b o" read as a word. */
function withSpelledOut(words: string[]): string[] {
  const out = [...words];
  let run = "";
  for (const w of [...words, ""]) {
    if ([...w].length === 1) run += w;
    else {
      if ([...run].length > 2) out.push(run);
      run = "";
    }
  }
  return out;
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** A plain entry's letters: the word as the first reading sees it. */
const squashed = (word: string): string => wordsIn(fold(word, true)).join("");

/** The hash a plain word is stored as (`sha256:` plus this). */
export function hashWord(word: string): string {
  return sha(squashed(word));
}

/** Turns one plain list line into its hashed form (a leading `~` is kept); null for blanks. */
export function hashLine(line: string): string | null {
  const trimmed = line.trim();
  if (trimmed === "" || trimmed.startsWith("#")) return null;
  const any = trimmed.startsWith("~");
  const body = any ? trimmed.slice(1).trim() : trimmed;
  if (body.startsWith("sha256:")) return trimmed;
  const letters = squashed(body);
  if (letters === "") return null;
  // A phrase (more than one word) can only be matched as "anywhere".
  const phrase = wordsIn(fold(body, true)).length > 1;
  return `${any || phrase ? "~" : ""}sha256:${sha(letters)}`;
}

export type BlocklistVerdict = { blocked: false } | { blocked: true; entry: string };

export class Blocklist {
  private constructor(
    private readonly wholeWord: ReadonlySet<string>,
    private readonly anywhere: ReadonlySet<string>,
    /** Lengths of the "anywhere" entries, so only windows of those lengths are hashed. */
    private readonly lengths: readonly number[],
  ) {}

  static empty(): Blocklist {
    return new Blocklist(new Set(), new Set(), []);
  }

  /** Builds a list from the text of a list file. Plain words are hashed here and not kept. */
  static parse(text: string): Blocklist {
    const whole = new Set<string>();
    const any = new Set<string>();
    const lengths = new Set<number>();
    for (const raw of text.split(/\r?\n/)) {
      const trimmed = raw.trim();
      if (trimmed === "" || trimmed.startsWith("#")) continue;
      const anywhere = trimmed.startsWith("~");
      const body = anywhere ? trimmed.slice(1).trim() : trimmed;
      if (body.startsWith("sha256:")) {
        const hex = body.slice(7).toLowerCase();
        if (!/^[0-9a-f]{64}$/.test(hex)) continue;
        if (anywhere) {
          any.add(hex);
          // A pasted hash does not say how long the word was; try every plausible length.
          for (let n = 3; n <= 24; n++) lengths.add(n);
        } else whole.add(hex);
        continue;
      }
      const letters = squashed(body);
      if (letters === "") continue;
      const hash = sha(letters);
      if (anywhere || wordsIn(fold(body, true)).length > 1) {
        any.add(hash);
        lengths.add(letters.length);
      } else whole.add(hash);
    }
    return new Blocklist(
      whole,
      any,
      [...lengths].sort((a, b) => a - b),
    );
  }

  static fromFile(path: string): Blocklist {
    let text: string;
    try {
      text = readFileSync(path, "utf8");
    } catch (error) {
      throw new Error(
        `Cannot read FQ_BLOCKLIST_FILE ${path}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return Blocklist.parse(text);
  }

  get size(): number {
    return this.wholeWord.size + this.anywhere.size;
  }

  /** Whether the text contains a listed word. `entry` is a short hash prefix, never a word. */
  check(text: string): BlocklistVerdict {
    if (this.size === 0) return { blocked: false };
    for (const words of readings(text)) {
      for (const word of withSpelledOut(words)) {
        const h = sha(word);
        if (this.wholeWord.has(h)) return { blocked: true, entry: h.slice(0, 8) };
      }
      if (this.anywhere.size > 0) {
        const flat = words.join("");
        for (const n of this.lengths) {
          for (let i = 0; i + n <= flat.length; i++) {
            const h = sha(flat.slice(i, i + n));
            if (this.anywhere.has(h)) return { blocked: true, entry: h.slice(0, 8) };
          }
        }
      }
    }
    return { blocked: false };
  }
}
