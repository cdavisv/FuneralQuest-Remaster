/**
 * `int_to_cash`: an integer with thousands separators, as every screen shows
 * money and points. The original lives in a shared library that is not in the
 * repository; this follows its observable output ("12,345").
 */
export function intToCash(value: number): string {
  const n = Math.trunc(value);
  const digits = Math.abs(n).toString();
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ",";
    out += digits.charAt(i);
  }
  return n < 0 ? `-${out}` : out;
}

export type TemplateVars = Readonly<Record<string, string | number>>;

/**
 * Fills `{name}` placeholders. Values are inserted once and never re-scanned,
 * so names containing braces cannot inject placeholders. Unknown placeholders
 * are left as they are, which makes a typo visible instead of silent.
 */
export function fill(template: string, vars: TemplateVars): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const value = vars[key];
    return value === undefined ? whole : String(value);
  });
}

/** `CString::Replace`: replaces every occurrence, left to right. */
export function replaceAll(text: string, search: string, replacement: string): string {
  if (search === "") return text;
  return text.split(search).join(replacement);
}

/** printf `%.0f` for the non-negative values the game prints (ties round up). */
export function formatFixed0(value: number): string {
  return Math.round(value).toString();
}
