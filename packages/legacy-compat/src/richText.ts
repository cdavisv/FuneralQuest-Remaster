import type { RichText, TextColor, TextSpan } from "@fq/protocol";

/**
 * The sixteen colours of the backtick codes with the exact values
 * `seth_ansi` wrote (legacy/source/funeral_util.cpp:382-446). Note the
 * original's own edits: red is #FF0000 (the #A80000 line is commented out) and
 * purple is #CC66CC.
 */
export const LEGACY_COLORS: Readonly<Record<TextColor, string>> = {
  blue: "#0000A8", // `1
  green: "#007000", // `2
  teal: "#008080", // `3
  red: "#FF0000", // `4
  purple: "#CC66CC", // `5
  brown: "#A85400", // `6
  grey: "#808080", // `7
  darkGrey: "#505050", // `8
  lightBlue: "#5454FC", // `9
  lightGreen: "#00B000", // `0
  cyan: "#00A0A0", // `!
  lightRed: "#FC5454", // `@
  pink: "#FC54FC", // `#
  yellow: "#FFFF33", // `$ and `y
  white: "#FFFFFF", // `w
  black: "#000000", // `^
};

/** The colour a text field shows before any code (the field's own text colour in welcome.swf). */
export const DEFAULT_TEXT_COLOR = LEGACY_COLORS.yellow;

/**
 * Flash 5 text fields with the HTML flag understand `&lt;`, `&gt;` and
 * `&amp;`. The original passed player text through raw (so `<b>` in a mail
 * was markup); RichText is never HTML, so these three are escaped.
 */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** A line break in an HTML text field. The client's fields are HTML, where a raw LF is only white space under Ruffle. */
const BREAK = "<br>";

/** Escapes text for an HTML field and turns each newline into a `<br>`. */
export function htmlText(text: string): string {
  return escapeHtml(text).replace(/\r?\n/g, BREAK);
}

/** `\`fN` made `<font size="8 + 2N">` (funeral_util.cpp:451-466). */
export function fontSize(step: number): number {
  return 8 + step * 2;
}

export interface HtmlOptions {
  /** Colour to return to when a span has none but the one before it did. */
  defaultColor?: string;
}

/**
 * RichText as the HTML the client's text fields expect: what `seth_ansi`
 * produced. Like the original it never closes a `<font>`: a span opens a new
 * tag when its colour or size differs from the span before it, and the effect
 * lasts until the next tag. A link becomes `<a href target="_blank">` as in
 * `command_announcement` (commands_news.cpp:208).
 */
export function richTextToLegacyHtml(text: RichText, options: HtmlOptions = {}): string {
  const fallback = options.defaultColor ?? DEFAULT_TEXT_COLOR;
  let out = "";
  let color: TextColor | undefined;
  let size: number | undefined;
  for (const span of text) {
    out += openTags(span, color, size, fallback);
    if (span.color !== color) color = span.color;
    if (span.size !== size) size = span.size;
    out += span.href === undefined ? htmlText(span.text) : link(span);
  }
  return out;
}

function openTags(
  span: TextSpan,
  color: TextColor | undefined,
  size: number | undefined,
  fallback: string,
): string {
  let tags = "";
  if (span.color !== color) {
    const value = span.color === undefined ? fallback : LEGACY_COLORS[span.color];
    tags += `<font color="${value}">`;
  }
  if (span.size !== size && span.size !== undefined) {
    tags += `<font size="${fontSize(span.size)}">`;
  }
  return tags;
}

function link(span: TextSpan): string {
  const href = (span.href ?? "").replace(/&/g, "&amp;").replace(/"/g, "%22");
  return `<a href="${href}" target="_blank">${htmlText(span.text)}</a>`;
}

/** Plain text of a RichText value, for the fields that are not HTML (`st_input`, `st_quote`). */
export function richTextToPlain(text: RichText): string {
  return text.map((span) => span.text).join("");
}
