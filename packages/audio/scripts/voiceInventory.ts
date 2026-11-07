/**
 * `pnpm --filter @fq/audio run voice-inventory`: every line a known character speaks, from the
 * game's own text, into assets/voice/lines.json. Nothing is generated here.
 *
 * Sources: the built Classic and Expanded packs (packages/content/built/*.json: what the game
 * shows), and the string literals of the engine's TypeScript where the original hard-coded text
 * (packages/core/src/classic/**, the Expanded modules, scripts and panels). The Expanded starter
 * content (packages/core/src/expanded/content/*Starter.ts, starter.ts) is read too but marked
 * `fallbackOnly`: it is shown only when a pack has no Expanded section, which the built packs do.
 *
 * Each string is parsed as the engine parses it (`parseLegacyText`, the port of the original's
 * colour codes) with every `{placeholder}` replaced by a marker, and `spokenLines` (src/voice.ts,
 * the same detector the client runs) finds the lines. A line with a marker is voiced only if the
 * marker sits in its first or last sentence and the rest is fixed text (`part` "tail"/"head");
 * otherwise it is listed and skipped. Speaker placeholders of the Expanded cast ({mayor},
 * {owner}, {nurse}) are the cast's fixed names (packs/expanded/expanded/town/cast.yaml).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseLegacyText } from "../../core/src/text/legacyText.js";
import { lineCandidates, normaliseLine, sentences, spokenLines, voiceKey } from "../src/voice.js";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..", "..");
const MARK = "⟦";
const MARK_END = "⟧";

/** The Expanded cast's fixed names, as cast.yaml has them. */
const CAST: Record<string, string> = {
  mayor: "Mayor Hollis Grubb",
  owner: "Lucius Vane",
  clubOwner: "Lucius Vane",
  nurse: "Nurse Gertie",
  inspector: "Inspector Mudge",
  teller: "Prudence Ledbetter",
};

export interface InventoryLine {
  key: string;
  character: string;
  speaker: string;
  /** The line as written, placeholders shown as {name}. */
  text: string;
  hasPlaceholders: boolean;
  placeholders: string[];
  /** What would be spoken: the whole line, or the fixed part around a placeholder; null if none. */
  voice: { text: string; part: "whole" | "tail" | "head"; key: string } | null;
  skipReason?: string;
  origin: "original" | "expanded";
  rulesets: ("classic" | "expanded")[];
  how: "tag" | "narrated";
  sources: string[];
  /** Only in the starter content the engine falls back to (never shown with the built packs). */
  fallbackOnly: boolean;
  /** Where the line is shown (place or screen), from its source path. */
  place: string;
}

interface Found {
  text: string;
  source: string;
  origin: "original" | "expanded";
  ruleset: "classic" | "expanded";
  fallback: boolean;
}

function fillPlaceholders(s: string): string {
  return s.replace(/\{(\w+)\}/g, (_w, k: string) => CAST[k] ?? `${MARK}${k}${MARK_END}`);
}

function walkJson(v: unknown, path: string, out: { text: string; path: string }[]) {
  if (typeof v === "string") out.push({ text: v, path });
  else if (Array.isArray(v)) {
    for (const [i, x] of v.entries()) walkJson(x, `${path}[${i}]`, out);
  } else if (v && typeof v === "object")
    for (const [k, x] of Object.entries(v)) walkJson(x, path ? `${path}.${k}` : k, out);
}

/** String and template literals of a TypeScript file, with `${...}` as placeholders. */
export function stringLiterals(src: string): { text: string; line: number }[] {
  const out: { text: string; line: number }[] = [];
  let i = 0;
  const lineAt = (p: number) => src.slice(0, p).split("\n").length;
  const unescapeJs = (raw: string) =>
    raw.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/gs, (_m, e: string) => {
      if (e === "n") return "\n";
      if (e === "r") return "\r";
      if (e === "t") return "\t";
      if (e.startsWith("u{")) return String.fromCodePoint(Number.parseInt(e.slice(2, -1), 16));
      if (e.startsWith("u") || e.startsWith("x"))
        return String.fromCharCode(Number.parseInt(e.slice(1), 16));
      if (e === "\n") return "";
      return e;
    });
  while (i < src.length) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") {
      i = src.indexOf("\n", i);
      if (i < 0) break;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i = src.indexOf("*/", i + 2) + 2;
      if (i < 2) break;
      continue;
    }
    if (c === '"' || c === "'") {
      const start = i;
      let raw = "";
      i++;
      while (i < src.length && src[i] !== c) {
        if (src[i] === "\\") {
          raw += src.slice(i, i + 2);
          i += 2;
        } else raw += src[i++];
      }
      i++;
      out.push({ text: unescapeJs(raw), line: lineAt(start) });
      continue;
    }
    if (c === "`") {
      const start = i;
      let raw = "";
      i++;
      while (i < src.length && src[i] !== "`") {
        if (src[i] === "\\") {
          raw += src.slice(i, i + 2);
          i += 2;
        } else if (src[i] === "$" && src[i + 1] === "{") {
          let depth = 1;
          let j = i + 2;
          while (j < src.length && depth > 0) {
            if (src[j] === "{") depth++;
            else if (src[j] === "}") depth--;
            j++;
          }
          const expr = src.slice(i + 2, j - 1).trim();
          const name = /([A-Za-z_]\w*)\W*$/.exec(expr)?.[1] ?? "expr";
          raw += `{${name}}`;
          i = j;
        } else raw += src[i++];
      }
      i++;
      out.push({ text: unescapeJs(raw), line: lineAt(start) });
      continue;
    }
    i++;
  }
  return out;
}

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...tsFiles(p));
    else if (e.name.endsWith(".ts")) out.push(p);
  }
  return out.sort();
}

/** A readable place name from a source path. */
function placeOf(source: string): string {
  const s = source.toLowerCase();
  const table: [RegExp, string][] = [
    [/tutorial/, "tutorial"],
    [/places\.store|storescripts|\bstore\b|dimart/, "Di-Mart"],
    [/church/, "church"],
    [/yangs/, "Yang's"],
    [/places\.bank|bank/, "bank"],
    [/hospital/, "hospital"],
    [/cityhall|city-hall/, "City Hall"],
    [/club/, "Reaper Club"],
    [/graveyard/, "graveyard"],
    [/university/, "Spirit University"],
    [/classicscripts|risks?\b|risk/, "risks (arson, the Twins)"],
    [/specials/, "specials at the desk"],
    [/arcs/, "town stories"],
    [/social|cafe/, "Pale Horse Cafe"],
    [/negotiation|softsell|hardsell|soft_sell|hard_sell/, "negotiation"],
  ];
  for (const [re, name] of table) if (re.test(s)) return name;
  return source.split(/[.[:]/)[0] ?? source;
}

function collect(): Found[] {
  const found: Found[] = [];
  for (const [file, ruleset] of [
    ["classic.json", "classic"],
    ["expanded.json", "expanded"],
  ] as const) {
    const pack = JSON.parse(readFileSync(join(repo, "packages/content/built", file), "utf8"));
    const strings: { text: string; path: string }[] = [];
    walkJson(pack, "", strings);
    for (const s of strings)
      found.push({
        text: s.text,
        source: `${file}:${s.path}`,
        origin: ruleset === "classic" ? "original" : "expanded",
        ruleset,
        fallback: false,
      });
  }
  const core = join(repo, "packages/core/src");
  const ts = [
    ...tsFiles(join(core, "classic")).map((f) => ({
      f,
      origin: "original" as const,
      ruleset: "classic" as const,
    })),
    ...tsFiles(join(core, "expanded")).map((f) => ({
      f,
      origin: "expanded" as const,
      ruleset: "expanded" as const,
    })),
  ];
  for (const { f, origin, ruleset } of ts) {
    const rel = relative(repo, f);
    const fallback = /expanded\/content\/(starter|townStarter)\.ts$/.test(rel);
    for (const lit of stringLiterals(readFileSync(f, "utf8")))
      found.push({ text: lit.text, source: `${rel}:${lit.line}`, origin, ruleset, fallback });
  }
  return found;
}

export function inventory(): InventoryLine[] {
  const byKey = new Map<string, InventoryLine>();
  // Original text first, so a line the Expanded pack repeats from the original stays "original".
  const found = collect().sort((a, b) =>
    a.origin === b.origin ? 0 : a.origin === "original" ? -1 : 1,
  );
  for (const f of found) {
    if (!f.text.includes('"')) continue;
    const rich = parseLegacyText(fillPlaceholders(f.text));
    for (const line of spokenLines(rich)) {
      const shown = line.text.replace(new RegExp(`${MARK}(\\w+)${MARK_END}`, "g"), "{$1}");
      const key = voiceKey(line.character, shown);
      const have = byKey.get(key);
      if (have) {
        if (!have.sources.includes(f.source)) have.sources.push(f.source);
        if (!have.rulesets.includes(f.ruleset)) have.rulesets.push(f.ruleset);
        have.fallbackOnly &&= f.fallback;
        continue;
      }
      const placeholders = [...line.text.matchAll(new RegExp(`${MARK}(\\w+)${MARK_END}`, "g"))].map(
        (m) => m[1] as string,
      );
      let voice: InventoryLine["voice"] = null;
      let skipReason: string | undefined;
      if (!placeholders.length) {
        voice = { text: normaliseLine(shown), part: "whole", key };
      } else {
        const s = sentences(line.text);
        const has = (x: string) => x.includes(MARK);
        const cands = lineCandidates(line.text).filter((c) => c.part !== "whole" && !has(c.text));
        // the dropped sentence must be the only one with a placeholder, and what is left must be
        // more than a scrap (two words at least)
        const ok = cands.find((c) => c.text.split(" ").length >= 2);
        if (ok && s.length > 1) {
          voice = {
            text: ok.text,
            part: ok.part as "tail" | "head",
            key: voiceKey(line.character, ok.text),
          };
        } else
          skipReason =
            s.length === 1
              ? "the placeholder is inside the only sentence"
              : "placeholders in more than the first or last sentence";
      }
      if (/^[^A-Za-z]*$/.test(shown)) {
        voice = null;
        skipReason = "no words";
      }
      byKey.set(key, {
        key,
        character: line.character,
        speaker: line.speaker,
        text: shown,
        hasPlaceholders: placeholders.length > 0,
        placeholders,
        voice,
        ...(skipReason ? { skipReason } : {}),
        origin: f.origin,
        rulesets: [f.ruleset],
        how: line.how,
        sources: [f.source],
        fallbackOnly: f.fallback,
        place: placeOf(f.source),
      });
    }
  }
  const lines = [...byKey.values()];
  for (const l of lines) {
    if (!l.voice) continue;
    if (l.sources.every(isNewspaper)) {
      l.voice = null;
      l.skipReason = "reported speech in the newspaper, not said to the player";
    } else if (l.character === "clerk" && l.sources.some((x) => x.includes("specials"))) {
      l.voice = null;
      l.skipReason = "a county clerk at the desk, not the Guild's tutorial clerk";
    } else if (l.fallbackOnly) {
      l.voice = null;
      l.skipReason = "starter content only, never shown while the built Expanded pack is loaded";
    }
  }
  return lines;
}

/** The newspaper: front-page blurbs, town news, ordinances, story beats (reported speech). */
export function isNewspaper(source: string): boolean {
  return /(^|[.:])(news|newsBlurbs|ordinances)([.[]|$)|\.story$|\.headline$/.test(source);
}

function main() {
  const lines = inventory();
  const out = join(repo, "assets", "voice", "lines.json");
  if (!existsSync(dirname(out))) mkdirSync(dirname(out), { recursive: true });
  writeFileSync(
    out,
    `${JSON.stringify(
      {
        note: "Every line a known character speaks in the game's own text (scripts/voiceInventory.ts). Lines are exactly as written; {name} marks a placeholder filled at run time.",
        lines,
      },
      null,
      2,
    )}\n`,
  );
  const per = new Map<string, { fixed: number; ph: number; voiceable: number; fallback: number }>();
  for (const l of lines) {
    const p = per.get(l.character) ?? { fixed: 0, ph: 0, voiceable: 0, fallback: 0 };
    if (l.fallbackOnly) p.fallback++;
    else {
      if (l.hasPlaceholders) p.ph++;
      else p.fixed++;
      if (l.voice) p.voiceable++;
    }
    per.set(l.character, p);
  }
  console.log("character      fixed  placeholders  voiceable  starter-only");
  for (const [c, p] of per)
    console.log(
      `${c.padEnd(14)} ${String(p.fixed).padStart(5)}  ${String(p.ph).padStart(12)}  ${String(p.voiceable).padStart(9)}  ${String(p.fallback).padStart(12)}`,
    );
  console.log(`wrote ${relative(repo, out)} (${lines.length} lines)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
