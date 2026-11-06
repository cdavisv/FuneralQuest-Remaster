import type { ContentPack } from "@fq/core";
import type { PackIssue } from "./check.js";
import { SLOT_COUNT, TABLE_FILE, type TableKey } from "./tables.js";

/**
 * The owner's rule (CLAUDE.md, packages/content/EDITS.md): the original 2001 dialog, even where it
 * is dated or controversial, must remain. Never edit, soften, replace or remove an original line
 * in any built-in pack. The Classic pack IS the original; the Expanded pack may add lines.
 *
 * `checkOriginal` measures a pack against the original pack (a fresh import of `legacy/dist/*.txt`
 * plus `CLASSIC_TEXT`: `importOriginal`, sources.ts) and reports every original line that is not
 * there unchanged. Pure and browser-safe. The build runs it on every built-in pack
 * (`renderBuiltPacks`) and a test plants violations to prove each check fires.
 *
 * What "there unchanged" means depends on how the engine reads the table, so the check follows the
 * engine's selection code (packages/core/src/classic):
 *
 * - Ranged tables (events, news, no-customer lines, the two fortune tables): the engine takes the
 *   first range that holds the value and picks one entry of it at random (CEvent.cpp:115-210). Every
 *   value of every original range must still be covered, and the range that now answers for it must
 *   hold all of the original range's entries, every field unchanged, in their original order. New
 *   entries may be added anywhere.
 * - Risks, soft sells, hard sells and swear words: by position. A soft sell is stored in the
 *   customer as its index, a risk likewise, hard-sell upgrades are offered strictly in file order
 *   (`upgrade`, classic/modules/negotiation.ts), so entry i must still be the original entry i.
 *   New entries go after the original ones.
 * - Ratings and karma: by slot. Each non-empty original slot keeps its text (a slot the original
 *   repeats keeps the repeat). A slot the original left empty may be filled: that adds a line.
 * - Text: every original string unchanged at its path. Arrays the engine indexes (`INDEXED_TEXT`)
 *   keep their length and every element at its index; arrays it draws from at random
 *   (`POOLED_TEXT`) keep every original element, in order, and may gain more.
 *
 * Exact mode (Classic and its Vintage alias) additionally requires the pack to be the original and
 * nothing else: the same tables, the same text, no additions.
 */

/** Text arrays the engine reads by position (mood band, vehicle, skill level, casket tier, damage band). */
export const INDEXED_TEXT: readonly string[] = [
  // classic/modules/negotiation.ts softSell and expanded/negotiation.ts: by the customer's mood band.
  "negotiation.softAccept",
  // classic/modules/store.ts, visit.ts, newDay.ts: by the vehicle (`transportation`).
  "hearseNames",
  "hearseDescriptions",
  // classic/modules/university.ts: `psychSkills[psych - 1]`.
  "places.university.psychSkills",
  // classic/modules/visit.ts: `tagTypes[tier]` (wooden, silver, gold).
  "social.visit.tagTypes",
  // classic/modules/battle.ts `verb`: by damage band, two points per word.
  "social.battle.verbsMe",
  "social.battle.verbsHim",
];

/** Text arrays the engine draws from at random (`pick`, `random(length)`): more lines may be added. */
export const POOLED_TEXT: readonly string[] = [
  "wait.noTurns",
  "negotiation.softPitch",
  "negotiation.softRefuse",
  "negotiation.hardPitchWood",
  "negotiation.hardPitchSilver",
  "negotiation.hardRefuse",
  "negotiation.hardAccept",
  "negotiation.upgradePitch",
  "negotiation.upgradeRefuse",
  "negotiation.upgradeAccept",
  "negotiation.guiltPitch",
  "negotiation.guiltLoved",
  "negotiation.guiltNotLoved",
  "negotiation.sympathyPitch",
  "negotiation.sympathyNotLoved",
  "negotiation.sympathyLoved",
  "negotiation.leavePissed",
  "negotiation.pissedOverLimit",
  "places.yangs.news",
  "social.battle.cries",
];

const RANGED = ["events", "newsBlurbs", "noCustomers", "fortunes", "niceFortunes"] as const;
const LISTS = ["risks", "softSell", "hardSell", "swearWords"] as const;
const SLOTS = ["ratings", "karma"] as const;

type Range = { low: number; high: number; entries: unknown[] };

/** Structural equality of JSON values (object key order does not matter). */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((x, i) => same(x, b[i]))
    );
  }
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  return (
    ka.length === kb.length &&
    ka.every(
      (k) =>
        k in (b as object) &&
        same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    )
  );
}

function show(value: unknown): string {
  const text = typeof value === "string" ? value : (JSON.stringify(value) ?? "nothing");
  const flat = text.replace(/\r/g, "\\r").replace(/\n/g, "\\n");
  return JSON.stringify(flat.length > 70 ? `${flat.slice(0, 70)}...` : flat);
}

/** The words that name an entry, for messages. */
function labelOf(entry: unknown): string {
  if (typeof entry === "string") return entry;
  if (typeof entry === "object" && entry !== null) {
    const e = entry as Record<string, unknown>;
    for (const key of ["message", "title", "startMessage", "name", "bad", "loved"]) {
      if (typeof e[key] === "string" && e[key] !== "") return e[key];
    }
  }
  return JSON.stringify(entry) ?? "";
}

/** The first field-wise difference of two objects, for "changed" messages. */
function difference(was: unknown, now: unknown): string {
  if (
    typeof was === "object" &&
    was !== null &&
    typeof now === "object" &&
    now !== null &&
    !Array.isArray(was) &&
    !Array.isArray(now)
  ) {
    const a = was as Record<string, unknown>;
    const b = now as Record<string, unknown>;
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    const k = keys.find((key) => !same(a[key], b[key]));
    if (k !== undefined) return `field '${k}' was ${show(a[k])}, now ${show(b[k])}`;
  }
  return `was ${show(was)}, now ${show(now)}`;
}

class Reporter {
  readonly issues: PackIssue[] = [];
  constructor(private readonly table: TableKey) {}
  add(path: string, message: string, entry?: unknown): void {
    this.issues.push({
      file: `${TABLE_FILE[this.table]}.yaml`,
      path,
      ...(entry === undefined ? {} : { entry: labelOf(entry).replace(/\s+/g, " ").slice(0, 40) }),
      message: `original line ${message}`,
      kind: "original",
    });
  }
}

/** Marks which values of `[low, high]` are not yet taken by an earlier range. */
function subtract(open: [number, number][], low: number, high: number): [number, number][] {
  const out: [number, number][] = [];
  for (const [a, b] of open) {
    const lo = Math.max(a, low);
    const hi = Math.min(b, high);
    if (lo > hi) {
      out.push([a, b]);
      continue;
    }
    if (a < lo) out.push([a, lo - 1]);
    if (hi < b) out.push([hi + 1, b]);
  }
  return out;
}

/** Every `wanted` entry, unchanged and in order, among `have`; reports the ones that are not. */
function entriesKept(
  r: Reporter,
  where: string,
  wanted: readonly unknown[],
  have: readonly unknown[],
  unit: string,
): void {
  let from = 0;
  wanted.forEach((entry, i) => {
    const found = have.findIndex((h, j) => j >= from && same(h, entry));
    if (found >= 0) {
      from = found + 1;
      return;
    }
    const label = labelOf(entry);
    if (have.some((h) => same(h, entry))) {
      r.add(`${where}${unit}[${i}]`, `moved: it is no longer in its original order`, entry);
      return;
    }
    const edited = have.find((h) => labelOf(h) === label && !same(h, entry));
    if (edited !== undefined) {
      r.add(`${where}${unit}[${i}]`, `was edited (${difference(entry, edited)})`, entry);
    } else {
      const here = have[i];
      const replaced =
        here !== undefined && !wanted.some((w) => same(w, here))
          ? `was replaced (was ${show(label)}, now ${show(labelOf(here))})`
          : `is missing (${show(label)})`;
      r.add(`${where}${unit}[${i}]`, replaced, entry);
    }
  });
}

function checkRanged(
  table: (typeof RANGED)[number],
  pack: ContentPack,
  original: ContentPack,
  exact: boolean,
): PackIssue[] {
  const r = new Reporter(table);
  const have = pack[table].ranges as Range[];
  (original[table].ranges as Range[]).forEach((was, wi) => {
    let open: [number, number][] = [[was.low, was.high]];
    have.forEach((now, ni) => {
      // The engine uses the first range that holds a value, so this range answers for the part
      // of the original range that no earlier range took.
      if (!open.some(([lo, hi]) => Math.max(lo, now.low) <= Math.min(hi, now.high))) return;
      open = subtract(open, now.low, now.high);
      entriesKept(r, `ranges[${ni}].`, was.entries, now.entries, "entries");
    });
    for (const [a, b] of open) {
      r.add(`ranges[${wi}]`, `range ${wi} (${a} to ${b}) is no longer covered by any range`);
    }
  });
  if (exact && r.issues.length === 0 && !same(pack[table], original[table])) {
    r.add("", "table is not identical to the original (it has additions)");
  }
  return r.issues;
}

function checkList(
  table: (typeof LISTS)[number],
  pack: ContentPack,
  original: ContentPack,
  exact: boolean,
): PackIssue[] {
  const r = new Reporter(table);
  const have = pack[table] as unknown[];
  (original[table] as unknown[]).forEach((was, i) => {
    const now = have[i];
    if (now === undefined) {
      r.add(`[${i}]`, `is missing: entry ${i} (${show(labelOf(was))}) was dropped`, was);
    } else if (!same(now, was)) {
      const moved = have.findIndex((h) => same(h, was));
      r.add(
        `[${i}]`,
        moved >= 0
          ? `moved: entry ${i} is now at ${moved}, and the engine reads this table by position`
          : `was edited (${difference(was, now)})`,
        was,
      );
    }
  });
  if (exact && r.issues.length === 0 && have.length !== (original[table] as unknown[]).length) {
    r.add(
      "",
      `table has ${have.length} entries, the original has ${(original[table] as unknown[]).length}`,
    );
  }
  return r.issues;
}

function checkSlots(
  table: (typeof SLOTS)[number],
  pack: ContentPack,
  original: ContentPack,
  exact: boolean,
): PackIssue[] {
  const r = new Reporter(table);
  const have = pack[table];
  if (have.length !== SLOT_COUNT)
    r.add("", `table has ${have.length} slots, expected ${SLOT_COUNT}`);
  original[table].forEach((was, i) => {
    const now = have[i];
    if (was === "") {
      if (exact && now !== "")
        r.add(
          `slot ${i + 1}`,
          `slot ${i + 1} is empty in the original and may not be filled here`,
          now,
        );
      return;
    }
    if (now !== was) {
      r.add(
        `slot ${i + 1}`,
        `in slot ${i + 1} was ${now === "" || now === undefined ? "removed" : `edited (was ${show(was)}, now ${show(now)})`}`,
        was,
      );
    }
  });
  return r.issues;
}

function checkText(pack: ContentPack, original: ContentPack, exact: boolean): PackIssue[] {
  const r = new Reporter("text");
  const indexed = new Set(INDEXED_TEXT);
  const pooled = new Set(POOLED_TEXT);
  const walk = (was: unknown, now: unknown, path: string): void => {
    if (typeof was === "string") {
      if (now !== was)
        r.add(
          path,
          `at ${path} ${now === undefined ? "was removed" : `was edited (was ${show(was)}, now ${show(now)})`}`,
          was,
        );
      return;
    }
    if (Array.isArray(was)) {
      if (!indexed.has(path) && !pooled.has(path)) {
        r.add(path, `list ${path} is not classified as indexed or random (original.ts)`);
      }
      if (!Array.isArray(now)) {
        r.add(path, `list ${path} was removed`);
        return;
      }
      if (indexed.has(path)) {
        if (now.length !== was.length) {
          r.add(
            path,
            `list ${path} is read by position and must keep its ${was.length} entries (has ${now.length})`,
          );
        }
        was.forEach((entry, i) => {
          if (!same(now[i], entry))
            r.add(
              `${path}[${i}]`,
              `at ${path}[${i}] was edited (${difference(entry, now[i])})`,
              entry,
            );
        });
      } else {
        entriesKept(r, `${path}`, was, now, "");
      }
      return;
    }
    if (typeof was === "object" && was !== null) {
      for (const [k, v] of Object.entries(was)) {
        walk(v, (now as Record<string, unknown> | undefined)?.[k], path ? `${path}.${k}` : k);
      }
    }
  };
  walk(original.text, pack.text, "");
  if (exact && r.issues.length === 0 && !same(pack.text, original.text)) {
    r.add("", "text is not identical to the original (it has additions)");
  }
  return r.issues;
}

export interface OriginalCheckOptions {
  /**
   * The pack must be the original and nothing else (Classic, and Vintage which is the same data):
   * no added lines, no `expanded` section. Without it, a pack may add lines but must keep every
   * original one.
   */
  exact?: boolean;
}

/**
 * Every original line of `original` that `pack` has lost or changed, as `kind: "original"` issues
 * (empty when the rule holds). `original` is a fresh import of the 2001 files and `CLASSIC_TEXT`.
 * Never throws; the pack id is not compared.
 */
export function checkOriginal(
  pack: ContentPack,
  original: ContentPack,
  options: OriginalCheckOptions = {},
): PackIssue[] {
  const exact = options.exact ?? false;
  const issues: PackIssue[] = [];
  for (const t of RANGED) issues.push(...checkRanged(t, pack, original, exact));
  for (const t of LISTS) issues.push(...checkList(t, pack, original, exact));
  for (const t of SLOTS) issues.push(...checkSlots(t, pack, original, exact));
  issues.push(...checkText(pack, original, exact));
  if (exact && pack.expanded !== undefined) {
    issues.push({
      file: "pack.yaml",
      path: "expanded",
      message: "the original pack has no Expanded section",
      kind: "original",
    });
  }
  return issues;
}
