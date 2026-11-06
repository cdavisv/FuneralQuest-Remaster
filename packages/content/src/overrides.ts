import type { ContentPack } from "@fq/core";
import { z } from "zod";
import { TABLE_KEYS, type TableKey } from "./tables.js";

/** Why an edit exists. Anything outside these is not an edit the policy allows. */
export const EDIT_CATEGORIES = [
  "minors",
  "slur",
  "stereotype",
  "real-person",
  "real-brand",
] as const;
export type EditCategory = (typeof EDIT_CATEGORIES)[number];

export const editSchema = z.strictObject({
  id: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/, { error: "must be lowercase letters, digits or '-'" }),
  category: z.enum(EDIT_CATEGORIES),
  /** Table the text lives in. */
  in: z.enum(TABLE_KEYS),
  /** Text to find: a whole string or a part of one. Must occur exactly once in the table. */
  original: z.string().min(1),
  replacement: z.string(),
  /** One line saying why. */
  reason: z
    .string()
    .min(1)
    .regex(/^[^\r\n]+$/, { error: "must be a single line" }),
  /** Set only when the replacement deliberately adds or drops a `{placeholder}` or `*TOKEN*`. */
  allowPlaceholderChange: z.boolean().optional(),
});

export const overridesFileSchema = z.strictObject({
  edits: z.array(editSchema),
});

export type Edit = z.infer<typeof editSchema>;

export class OverrideError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OverrideError";
  }
}

interface Leaf {
  /** Dotted path inside the table, for example `ranges[0].entries[2].message`. */
  path: string;
  parent: Record<string, unknown> | unknown[];
  key: string | number;
  value: string;
}

function collectLeaves(value: unknown, path: string, out: Leaf[]): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => {
      if (typeof v === "string")
        out.push({ path: `${path}[${i}]`, parent: value, key: i, value: v });
      else collectLeaves(v, `${path}[${i}]`, out);
    });
  } else if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    for (const [k, v] of Object.entries(record)) {
      const p = path === "" ? k : `${path}.${k}`;
      if (typeof v === "string") out.push({ path: p, parent: record, key: k, value: v });
      else collectLeaves(v, p, out);
    }
  }
}

function occurrences(haystack: string, needle: string): number[] {
  const at: number[] = [];
  for (
    let i = haystack.indexOf(needle);
    i !== -1;
    i = haystack.indexOf(needle, i + needle.length)
  ) {
    at.push(i);
  }
  return at;
}

const PLACEHOLDER = /\{[A-Za-z]+\}|\*[A-Z]+\*/g;

function placeholders(text: string): string {
  return (text.match(PLACEHOLDER) ?? []).sort().join(" ");
}

/** `slot 42` for the 100-slot tables, otherwise the path. */
function where(path: string): string {
  const slot = /^\[(\d+)\]$/.exec(path);
  return slot ? `slot ${Number(slot[1]) + 1}` : path;
}

function show(text: string): string {
  return JSON.stringify(text.length > 70 ? `${text.slice(0, 70)}...` : text);
}

/**
 * Applies edits to a copy of `base` and gives the result the id `id`.
 *
 * Every edit's `original` must occur exactly once in its table of the untouched base (otherwise the
 * whole call fails, naming the edit), two edits must not touch the same characters, and a
 * replacement must keep the original's `{placeholders}` and `*TOKENS*`. Entries are never removed
 * or added, so table lengths (and with them the engine's random draws) stay as they were.
 */
export function applyOverrides(base: ContentPack, edits: readonly Edit[], id: string): ContentPack {
  const result = structuredClone(base);
  result.id = id;
  const ids = new Set<string>();
  const leavesOf = new Map<TableKey, Leaf[]>();
  const located: { edit: Edit; leaf: Leaf; start: number }[] = [];

  for (const edit of edits) {
    if (ids.has(edit.id)) throw new OverrideError(`Edit "${edit.id}": id is used twice`);
    ids.add(edit.id);
    if (edit.original === edit.replacement) {
      throw new OverrideError(`Edit "${edit.id}": replacement is the same as the original`);
    }
    if (
      !edit.allowPlaceholderChange &&
      placeholders(edit.original) !== placeholders(edit.replacement)
    ) {
      throw new OverrideError(
        `Edit "${edit.id}": replacement changes the placeholders (${placeholders(edit.original) || "none"} became ${placeholders(edit.replacement) || "none"}); set allowPlaceholderChange if that is intended`,
      );
    }
    let leaves = leavesOf.get(edit.in);
    if (!leaves) {
      leaves = [];
      collectLeaves(result[edit.in], "", leaves);
      leavesOf.set(edit.in, leaves);
    }
    const hits: { leaf: Leaf; start: number }[] = [];
    for (const leaf of leaves) {
      for (const start of occurrences(leaf.value, edit.original)) hits.push({ leaf, start });
    }
    if (hits.length !== 1) {
      throw new OverrideError(
        `Edit "${edit.id}": original text ${show(edit.original)} was found ${hits.length} times in '${edit.in}', expected exactly once${
          hits.length > 1 ? ` (at ${hits.map((h) => where(h.leaf.path)).join(", ")})` : ""
        }`,
      );
    }
    const [hit] = hits;
    if (hit) located.push({ edit, ...hit });
  }

  // Apply back to front inside each string so earlier offsets stay valid; refuse overlaps.
  const byLeaf = new Map<Leaf, { edit: Edit; start: number }[]>();
  for (const l of located) {
    const list = byLeaf.get(l.leaf) ?? [];
    list.push({ edit: l.edit, start: l.start });
    byLeaf.set(l.leaf, list);
  }
  for (const [leaf, list] of byLeaf) {
    list.sort((a, b) => b.start - a.start);
    let text = leaf.value;
    let limit = Number.POSITIVE_INFINITY;
    for (const { edit, start } of list) {
      const end = start + edit.original.length;
      if (end > limit) {
        throw new OverrideError(
          `Edit "${edit.id}": overlaps another edit in '${edit.in}' at ${where(leaf.path)}`,
        );
      }
      text = text.slice(0, start) + edit.replacement + text.slice(end);
      limit = start;
    }
    (leaf.parent as Record<string | number, unknown>)[leaf.key] = text;
  }
  return result;
}
