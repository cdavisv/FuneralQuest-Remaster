/**
 * Wire-level text handling for the original `request.xp` protocol.
 *
 * Requests: the Flash client sends `name=value` pairs joined by `&`, and the
 * original server undid the escaping with `format_for_local`, a fixed list of
 * `CString::Replace` calls (legacy/source/shared_util.cpp:41-82), run on every
 * name and every value in `tokenize_input` (funeral_util.cpp:627-704).
 *
 * Responses: the original wrote `name=value&` pairs with no escaping at all
 * (`add_var`, funeral_util.cpp:317-335) and a stray literal `/r/n` after the
 * last one; `format_for_web_cst` (shared_util.cpp:4-18) only exists for the
 * license-server socket. A modern text body needs real escaping, so this
 * module percent-encodes every byte that is not unreserved. Non-ASCII text goes
 * out as UTF-8 bytes: that is what Ruffle reads (and sends: its requests carry
 * UTF-8, which {@link decodeResidual} accepts along with the Windows-1252 bytes
 * the 2001 Flash Player sent). A character outside Unicode's basic multilingual
 * plane is still just UTF-8.
 */

/** One `Replace(from, to)` of `format_for_local`, in the original order. */
type Replacement = readonly [string, string];

/**
 * `format_for_local` (legacy/source/shared_util.cpp:41-82), the version
 * `tokenize_input` runs on every token. Order matters because each entry is a
 * separate pass over the whole string: "+" first, "%25" last.
 *
 * Two things in the original are kept on purpose:
 * - %26 (&), %5E (^), %2A (*), %2B (+) and %3C (<) are replaced by nothing,
 *   so a player cannot type them;
 * - the "[" and "]" lines both say "%5BD" (a typo), so in this version "%5B"
 *   stays encoded and "%5BD" becomes "[".
 * `%25` becomes two percent signs (the text was later used as a printf
 *   format string).
 */
const COMMON: readonly Replacement[] = [
  ["+", " "],
  ["%5F", "_"],
  ["%40", "@"],
  ["%21", "!"],
  ["%22", '"'],
  ["%23", "#"],
  ["%24", "$"],
  ["%26", ""],
  ["%2C", ","],
  ["%2E", "."],
  ["%5E", ""],
  ["%2A", ""],
  ["%28", "("],
  ["%29", ")"],
  ["%2B", ""],
  ["%2D", "-"],
  ["%60", "`"],
  ["%7E", "~"],
  ["%27", "'"],
  ["%3A", ":"],
  ["%3B", ";"],
  ["%3E", ">"],
  ["%3C", ""],
  ["%2F", "/"],
  ["%3D", "="],
  ["%3F", "?"],
  ["%7C", "|"],
  ["%7B", "{"],
  ["%7D", "}"],
];

const TAIL: readonly Replacement[] = [
  ["%0D", "\r\n"],
  ["%25", "%%"],
];

const FORMAT_FOR_LOCAL: readonly Replacement[] = [...COMMON, ["%5BD", "["], ["%5BD", "]"], ...TAIL];

/**
 * `format_for_local_cst` (shared_util.cpp:84-120): the same list for a
 * `CString`, with the "[" and "]" typo fixed. `command_announcement` runs it a
 * second time on the already decoded note (commands_news.cpp:178).
 */
const FORMAT_FOR_LOCAL_CST: readonly Replacement[] = [
  ...COMMON,
  ["%5B", "["],
  ["%5D", "]"],
  ...TAIL,
];

function replaceAll(text: string, search: string, replacement: string): string {
  return text.split(search).join(replacement);
}

function applyList(text: string, list: readonly Replacement[]): string {
  let out = text;
  for (const [from, to] of list) out = replaceAll(out, from, to);
  return out;
}

/** Decodes one token the way the original server did. Hex digits are matched in the case the client sends (upper case). */
export function formatForLocal(text: string): string {
  return applyList(text, FORMAT_FOR_LOCAL);
}

/** The `CString` variant of {@link formatForLocal} (`format_for_local_cst`). */
export function formatForLocalCst(text: string): string {
  return applyList(text, FORMAT_FOR_LOCAL_CST);
}

/**
 * Bytes for `%XX` sequences the original list does not know (for example the
 * bytes of an accented letter), and "%%" (what `%25` became) back to "%".
 * Runs after {@link formatForLocal}, which the original did not, so letters
 * outside ASCII survive instead of arriving as "%E9".
 */
export function decodeResidual(text: string): string {
  const bytes: number[] = [];
  const push = (s: string) => {
    for (const b of new TextEncoder().encode(s)) bytes.push(b);
  };
  let i = 0;
  while (i < text.length) {
    const ch = text.charAt(i);
    if (ch === "%") {
      if (text.charAt(i + 1) === "%") {
        bytes.push(0x25);
        i += 2;
        continue;
      }
      const hex = text.slice(i + 1, i + 3);
      if (/^[0-9a-fA-F]{2}$/.test(hex)) {
        bytes.push(Number.parseInt(hex, 16));
        i += 3;
        continue;
      }
    }
    // A literal character: keep its code. Code points above 255 can only come
    // from a client that sent UTF-16 text; re-encode them as UTF-8.
    const code = text.codePointAt(i) ?? 0;
    if (code < 0x80) bytes.push(code);
    else push(String.fromCodePoint(code));
    i += code > 0xffff ? 2 : 1;
  }
  return decodeBytes(Uint8Array.from(bytes));
}

/** Windows-1252 code points for bytes 0x80 to 0x9F; the five undefined slots map to themselves. */
const CP1252_HIGH = [
  0x20ac, 0x81, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039,
  0x0152, 0x8d, 0x017d, 0x8f, 0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc,
  0x2122, 0x0161, 0x203a, 0x0153, 0x9d, 0x017e, 0x0178,
] as const;

/** A byte string as text: UTF-8 when it is valid UTF-8, otherwise Windows-1252 (what Flash 5 sends). */
export function decodeBytes(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    let out = "";
    for (const b of bytes) {
      out += String.fromCharCode(b >= 0x80 && b < 0xa0 ? (CP1252_HIGH[b - 0x80] ?? b) : b);
    }
    return out;
  }
}

/** What `loadVariables` makes of a request's query string. */
export interface ParsedRequest {
  /** First token: `checklogon`, `logon`, `new` or `command`. */
  verb: string;
  /** Every `name=value` pair, decoded; a later duplicate wins. */
  params: Map<string, string>;
  /** Tokens without "=" (the original refused the whole request; we skip them). */
  malformed: string[];
}

/**
 * Splits a raw query string (everything after the "?" of `request.xp?`), the
 * way `request_process` and `tokenize_input` do: the verb runs up to the first
 * "?" or "&" (funeral.cpp:419-444), the rest is `&`-separated tokens.
 */
export function parseRequestQuery(rawQuery: string): ParsedRequest {
  let query = rawQuery.startsWith("?") ? rawQuery.slice(1) : rawQuery;
  let verb: string;
  const cut = query.search(/[?&]/);
  if (cut === -1) {
    verb = query;
    query = "";
  } else {
    verb = query.slice(0, cut);
    query = query.slice(cut + 1);
  }
  // Flash may write the verb as a variable ("command=&..."); accept that too.
  const equals = verb.indexOf("=");
  if (equals !== -1) verb = verb.slice(0, equals);
  const params = new Map<string, string>();
  const malformed: string[] = [];
  for (const token of query.split("&")) {
    if (token === "") continue;
    const at = token.indexOf("=");
    if (at === -1) {
      malformed.push(token);
      continue;
    }
    const name = decodeResidual(formatForLocal(token.slice(0, at)));
    const value = decodeResidual(formatForLocal(token.slice(at + 1)));
    params.set(name, value);
  }
  return { verb: verb.toLowerCase(), params, malformed };
}

const UNRESERVED = /[A-Za-z0-9\-_.~]/;

/**
 * Escapes one value so `loadVariables` reads back exactly `text`: every byte
 * outside `A-Za-z0-9-_.~` becomes %XX, a space becomes "+" (as
 * `format_for_web_cst` did), so "&", "=", "%", "+", quotes and newlines are all
 * safe. Non-ASCII characters are written as their UTF-8 bytes.
 */
export function encodeValue(text: string): string {
  let out = "";
  for (const byte of new TextEncoder().encode(text)) {
    const ch = String.fromCharCode(byte);
    if (UNRESERVED.test(ch)) out += ch;
    else if (byte === 0x20) out += "+";
    else out += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  return out;
}

/** An ordered list of variables, as `add_var` built them. */
export type LegacyVars = readonly (readonly [string, string | number])[];

/**
 * The response body: `name=value&` for every variable, in order, with no
 * trailing junk. Names are plain ASCII identifiers and are not escaped.
 */
export function encodeBody(vars: LegacyVars): string {
  let out = "";
  for (const [name, value] of vars) out += `${name}=${encodeValue(String(value))}&`;
  return out;
}

/** Reads a body back the way Ruffle does (for tests): "+" to space, %XX bytes read as UTF-8. */
export function decodeBody(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const pair of body.split("&")) {
    if (pair === "") continue;
    const at = pair.indexOf("=");
    if (at === -1) continue;
    const bytes: number[] = [];
    const raw = pair.slice(at + 1);
    for (let i = 0; i < raw.length; i++) {
      const ch = raw.charAt(i);
      if (ch === "+") bytes.push(0x20);
      else if (ch === "%" && /^[0-9a-fA-F]{2}$/.test(raw.slice(i + 1, i + 3))) {
        bytes.push(Number.parseInt(raw.slice(i + 1, i + 3), 16));
        i += 2;
      } else bytes.push(raw.charCodeAt(i));
    }
    out.set(pair.slice(0, at), new TextDecoder().decode(Uint8Array.from(bytes)));
  }
  return out;
}
