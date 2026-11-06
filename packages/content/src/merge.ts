import type { EventEntry, RangedTable } from "@fq/core";
import { SLOT_COUNT, type TableKey } from "./tables.js";

/**
 * `merge: append` in pack.yaml: a table file adds to the table of the pack it extends instead of
 * replacing it. Pure; the result is validated by the loader like any other table.
 *
 * - Lists (risks, soft and hard sells, swear words): the base entries, then the file's.
 * - Ranged tables (events, news, fortunes, ...): the file's ranges, in its order; each range gets
 *   the entries of every base range it overlaps, first. The engine uses the first range that holds
 *   the value (CEvent.cpp:115-210), so a pack can split the base's one catch-all range into brackets
 *   and every bracket keeps the original entries. A base range no file range overlaps is dropped,
 *   so give ranges that cover the base's.
 * - Ratings and karma: a mapping of slot number to text; each slot given replaces the base's, the
 *   rest are inherited.
 * - Text: merged key by key; a string replaces the base's, an array is added to the end of the
 *   base's (more alternatives for the same line), an object merges recursively. Arrays the engine
 *   indexes by position (`negotiation.softAccept`, by mood band; the hearse tables) must not be
 *   appended to: the schema rejects the hearse tables and the extra soft-accept lines would never
 *   show.
 */
export function appendTable(table: TableKey, base: unknown, raw: unknown, file: string): unknown {
  switch (table) {
    case "events":
    case "newsBlurbs":
    case "noCustomers":
    case "fortunes":
    case "niceFortunes":
      return appendRanged(base as RangedTable<EventEntry>, raw, file);
    case "risks":
    case "softSell":
    case "hardSell":
    case "swearWords":
      if (!Array.isArray(raw)) throw new Error(`${file}: must be a list (appended to the base's)`);
      return [...(base as unknown[]), ...structuredClone(raw)];
    case "ratings":
    case "karma":
      return appendSlots(base as string[], raw, file);
    case "text":
      return deepAppend(base, raw, file, "text");
  }
}

function appendRanged(base: RangedTable<EventEntry>, raw: unknown, file: string): unknown {
  const ranges = (raw as { ranges?: unknown } | null)?.ranges;
  if (!Array.isArray(ranges)) throw new Error(`${file}: must have 'ranges' (a list)`);
  return {
    ranges: ranges.map((r: { low?: unknown; high?: unknown; entries?: unknown }) => {
      if (typeof r?.low !== "number" || typeof r.high !== "number" || !Array.isArray(r.entries)) {
        // Leave it to the schema to say what is wrong.
        return r;
      }
      const { low, high } = r as { low: number; high: number };
      const inherited = base.ranges
        .filter((b) => b.low <= high && low <= b.high)
        .flatMap((b) => structuredClone(b.entries));
      return { ...r, entries: [...inherited, ...structuredClone(r.entries)] };
    }),
  };
}

function appendSlots(base: string[], raw: unknown, file: string): string[] {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`${file}: must be a mapping of slot number to text (1 to ${SLOT_COUNT})`);
  }
  const out = [...base];
  for (const [k, v] of Object.entries(raw)) {
    const i = Number(k);
    if (!Number.isInteger(i) || i < 1 || i > SLOT_COUNT) {
      throw new Error(`${file}: slot '${k}' is outside 1 to ${SLOT_COUNT}`);
    }
    if (typeof v !== "string") throw new Error(`${file}: slot ${k} must be text`);
    out[i - 1] = v;
  }
  return out;
}

function deepAppend(base: unknown, add: unknown, file: string, path: string): unknown {
  if (Array.isArray(base)) {
    if (!Array.isArray(add)) throw new Error(`${file}: ${path} must be a list (appended)`);
    return [...structuredClone(base), ...structuredClone(add)];
  }
  if (typeof base === "object" && base !== null) {
    if (typeof add !== "object" || add === null || Array.isArray(add)) {
      throw new Error(`${file}: ${path} must be a mapping`);
    }
    const out: Record<string, unknown> = structuredClone(base) as Record<string, unknown>;
    for (const [k, v] of Object.entries(add)) {
      // Unknown keys are kept, so the schema reports them by name.
      out[k] = k in out ? deepAppend(out[k], v, file, `${path}.${k}`) : structuredClone(v);
    }
    return out;
  }
  return structuredClone(add);
}
