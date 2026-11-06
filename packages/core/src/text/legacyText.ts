import type { RichText, TextColor, TextSpan } from "@fq/protocol";

/** Backtick colour codes (legacy/source/funeral_util.cpp:382-446). */
const COLOR_CODES: Readonly<Record<string, TextColor>> = {
  "1": "blue",
  "2": "green",
  "3": "teal",
  "4": "red",
  "5": "purple",
  "6": "brown",
  "7": "grey",
  "8": "darkGrey",
  "9": "lightBlue",
  "0": "lightGreen",
  "!": "cyan",
  "@": "lightRed",
  "#": "pink",
  $: "yellow",
  y: "yellow",
  w: "white",
  "^": "black",
};

interface Style {
  color?: TextColor;
  size?: number;
}

function pushText(out: TextSpan[], text: string, style: Style): void {
  if (text === "") return;
  const last = out[out.length - 1];
  if (last && last.color === style.color && last.size === style.size && last.href === undefined) {
    last.text += text;
    return;
  }
  const span: TextSpan = { text };
  if (style.color !== undefined) span.color = style.color;
  if (style.size !== undefined) span.size = style.size;
  out.push(span);
}

/**
 * Port of `seth_ansi` (legacy/source/funeral_util.cpp:336-495), producing
 * RichText spans instead of HTML.
 *
 * - A colour code starts a new colour that lasts until the next code.
 * - `` `fN `` sets the size step N (the original emitted `<font size=8+2N>`).
 * - `` `= `` is a literal "=" (the original URL-encoded it).
 * - Any other character after a backtick is swallowed and a literal backtick
 *   is printed instead, as the original does (for example `` `a ``).
 * - A backtick at the very end is printed as is.
 * - CR LF and lone CR become "\n".
 */
export function parseLegacyText(source: string): RichText {
  const input = source.replace(/\r\n?/g, "\n");
  const out: TextSpan[] = [];
  const style: Style = {};
  let buffer = "";
  const flush = () => {
    pushText(out, buffer, style);
    buffer = "";
  };

  let i = 0;
  while (i < input.length) {
    const ch = input.charAt(i);
    if (ch !== "`" || i + 1 >= input.length) {
      buffer += ch;
      i++;
      continue;
    }
    const code = input.charAt(i + 1);
    const color = COLOR_CODES[code];
    if (color !== undefined) {
      flush();
      style.color = color;
      i += 2;
      continue;
    }
    if (code === "=") {
      buffer += "=";
      i += 2;
      continue;
    }
    if (code === "f" && i + 2 < input.length) {
      // atol of a single character: digits give their value, anything else 0.
      const digit = input.charAt(i + 2);
      flush();
      style.size = /[0-9]/.test(digit) ? Number(digit) : 0;
      i += 3;
      continue;
    }
    // Unknown code: the original keeps the backtick and drops the next character.
    buffer += "`";
    i += 2;
  }
  flush();
  return out;
}

/** Port of `StripSethAnsi` (legacy/source/funeral_util.cpp:499-575): removes every code. */
export function stripLegacyCodes(source: string): string {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const ch = source.charAt(i);
    if (ch === "`") {
      if (i + 1 < source.length) {
        if (source.charAt(i + 1) === "f" && i + 2 < source.length) i++;
        i++;
      }
      i++;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/** Plain text of a RichText value, for tests and screen readers. */
export function richTextToPlain(text: RichText): string {
  return text.map((span) => span.text).join("");
}
