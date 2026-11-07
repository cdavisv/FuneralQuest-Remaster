import type { LegacyVars } from "@fq/legacy-compat";

export type Vars = readonly (readonly [string, string])[];

/**
 * A response as the original built it: `name=value&` pairs, unescaped
 * (`add_var`, funeral_util.cpp:317-335). A value may itself contain "&", so a
 * pair only ends at an "&" followed by the next `name=`.
 */
export function parseOriginal(text: string): Vars {
  const out: [string, string][] = [];
  const parts = text.split(/&(?=[A-Za-z_][A-Za-z0-9_]*=)/);
  for (const part of parts) {
    if (!part) continue;
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    let value = part.slice(eq + 1);
    if (value.endsWith("&")) value = value.slice(0, -1);
    out.push([part.slice(0, eq), value]);
  }
  return out;
}

export function fromPort(vars: LegacyVars): Vars {
  return vars.map(([k, v]) => [k, String(v)] as const);
}

export function get(vars: Vars, name: string): string | undefined {
  let found: string | undefined;
  for (const [k, v] of vars) if (k === name) found = v;
  return found;
}

/** Slot keys of the five plaque buttons (`add_button`, funeral_util.cpp:9-31). */
export const SLOT_KEYS = ["3", "2", "1", "0", "a"] as const;

export interface Button {
  key: string;
  label: string;
  command: string;
  sub: string | undefined;
}

export function buttons(vars: Vars): Button[] {
  const out: Button[] = [];
  for (const key of SLOT_KEYS) {
    const label = get(vars, `st_option_${key}`);
    const command = get(vars, `i_command_${key}`);
    if (label === undefined || command === undefined) continue;
    out.push({ key, label: label.trim(), command, sub: get(vars, `i_command_sub_${key}`) });
  }
  return out;
}

/** Text without the HTML the original's `seth_ansi` produced, for comparing words. */
export function plainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/%3D/g, "=")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

/**
 * Text as the player reads it, for grouping differences that are only
 * presentation: no markup, entities decoded, the wire's %25 shown as "%",
 * and no whitespace. (The time in front of notices is compared: the port
 * prints it since oracle finding D3.)
 */
export function wordsOnly(text: string): string {
  return plainText(text)
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/%25/g, "%")
    .replace(/\s+/g, "");
}

/**
 * How the Flash client put a value into the query string (form encoding):
 * letters and digits as is, space as "+", everything else %XX. A Flash text
 * field ends lines with "\r", so a newline goes out as %0D.
 */
export function encodeValue(value: string): string {
  let out = "";
  for (const raw of value.replace(/\r?\n/g, "\r")) {
    const ch = raw;
    const code = ch.charCodeAt(0);
    if (/[A-Za-z0-9]/.test(ch)) out += ch;
    else if (ch === " ") out += "+";
    else if (code < 256) out += `%${code.toString(16).toUpperCase().padStart(2, "0")}`;
    else out += encodeURIComponent(ch);
  }
  return out;
}

export function query(verb: string, params: Record<string, string | number>): string {
  let q = verb;
  for (const [k, v] of Object.entries(params)) q += `&${k}=${encodeValue(String(v))}`;
  return q;
}
