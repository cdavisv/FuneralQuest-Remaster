import type { MessageKey, MessageTable } from "./messages.js";
import { defaultLocale, locales } from "./messages.js";

export type MessageParams = Record<string, string | number>;

/** Finds the end of a `{...}` group starting at `start` (which holds the opening brace). */
function matchBrace(s: string, start: number): number {
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function parsePluralBranches(body: string): Map<string, string> {
  const branches = new Map<string, string>();
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /\s/.test(body[i] ?? "")) i++;
    const open = body.indexOf("{", i);
    if (open < 0) break;
    const selector = body.slice(i, open).trim();
    const close = matchBrace(body, open);
    if (close < 0) break;
    branches.set(selector, body.slice(open + 1, close));
    i = close + 1;
  }
  return branches;
}

/** Formats an ICU-subset message: `{name}` and `{n, plural, one {...} other {...}}`. */
export function formatMessage(template: string, params: MessageParams = {}, locale = "en"): string {
  let out = "";
  let i = 0;
  while (i < template.length) {
    const ch = template[i] ?? "";
    if (ch !== "{") {
      out += ch;
      i++;
      continue;
    }
    const end = matchBrace(template, i);
    if (end < 0) {
      out += template.slice(i);
      break;
    }
    const inner = template.slice(i + 1, end);
    const parts = inner.split(",");
    const name = (parts[0] ?? "").trim();
    const value = params[name];
    if (parts.length >= 3 && (parts[1] ?? "").trim() === "plural" && typeof value === "number") {
      const body = inner.slice(inner.indexOf("plural") + "plural".length + 1);
      const branches = parsePluralBranches(body);
      const category = new Intl.PluralRules(locale).select(value);
      const chosen =
        branches.get(`=${value}`) ?? branches.get(category) ?? branches.get("other") ?? "";
      out += formatMessage(chosen.replaceAll("#", String(value)), params, locale);
    } else {
      out += value === undefined ? `{${name}}` : String(value);
    }
    i = end + 1;
  }
  return out;
}

export type Translate = (key: MessageKey, params?: MessageParams) => string;

export function makeTranslate(locale: string = defaultLocale): Translate {
  const table: MessageTable = locales[locale] ?? (locales[defaultLocale] as MessageTable);
  return (key, params) => formatMessage(table[key], params, locale);
}
