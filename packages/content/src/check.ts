import type { ContentPack } from "@fq/core";
import type { z } from "zod";
import { strictExpandedSchema } from "./expandedSchema.js";
import { packSchema, tableSchemas } from "./schema.js";
import { EXPANDED_KEY, TABLE_FILE, TABLE_KEYS, type TableKey } from "./tables.js";

export interface PackIssue {
  /** Source file the entry lives in, for example `events.yaml`. */
  file: string;
  /** Location inside the file, for example `ranges[0].entries[3].modBp` or `slot 42`. */
  path: string;
  /** The entry's own text (first words of its message, name or title), to find it quickly. */
  entry?: string;
  message: string;
  /**
   * `schema`: the pack is malformed. `asset`: a picture id is not in the asset manifest. `lint`: the
   * pack loads but breaks a content rule (lint.ts: placeholders, duplicates, prices, lengths,
   * banned terms). `original`: a built-in pack lost or changed a line of the original 2001 text
   * (original.ts), which the owner's rule forbids.
   */
  kind: "schema" | "asset" | "lint" | "original";
}

export interface CheckOptions {
  /**
   * File name to report per table (default `<legacy base name>.yaml`); `pack` is the id file,
   * `expanded` the Expanded section (default `expanded/`).
   */
  files?: Partial<Record<TableKey | "pack" | typeof EXPANDED_KEY, string>>;
  /** Known asset ids (from `assets/manifest.json`). When given, every picture id must be in it. */
  assetIds?: ReadonlySet<string>;
  /**
   * Reject fields of the Expanded section that this package's schema does not know. Off by
   * default, so packs written for newer Expanded content types still load; the built-in packs are
   * tested with it on.
   */
  strictExpanded?: boolean;
}

export class PackValidationError extends Error {
  readonly issues: readonly PackIssue[];
  constructor(packId: string, issues: readonly PackIssue[]) {
    super(
      `Content pack "${packId}" is invalid:\n${issues.map((i) => `  - ${formatIssue(i)}`).join("\n")}`,
    );
    this.name = "PackValidationError";
    this.issues = issues;
  }
}

export function formatIssue(issue: PackIssue): string {
  const where = issue.path === "" ? issue.file : `${issue.file}: ${issue.path}`;
  const entry = issue.entry === undefined ? "" : ` (entry "${issue.entry}")`;
  return `${where}${entry}: ${issue.message}`;
}

const LABEL_KEYS = ["message", "startMessage", "title", "name", "id", "label"] as const;

function preview(text: string): string {
  // Colour codes (a backtick and one character) and literal \n pairs are noise in a preview.
  const flat = text.replace(/`./g, "").replace(/\\n/g, " ").replace(/\s+/g, " ").trim();
  return flat.length > 40 ? `${flat.slice(0, 40)}...` : flat;
}

/** The nearest enclosing object along `path` that has a message, title or name. */
function entryLabel(root: unknown, path: readonly PropertyKey[]): string | undefined {
  let label: string | undefined;
  let node: unknown = root;
  for (const step of [undefined, ...path]) {
    if (step !== undefined) {
      if (typeof node !== "object" || node === null) break;
      node = (node as Record<PropertyKey, unknown>)[step];
    }
    if (typeof node === "object" && node !== null && !Array.isArray(node)) {
      for (const key of LABEL_KEYS) {
        const v = (node as Record<string, unknown>)[key];
        if (typeof v === "string" && v !== "") {
          label = preview(v);
          break;
        }
      }
    }
  }
  return label;
}

function formatPath(table: TableKey | typeof EXPANDED_KEY, path: readonly PropertyKey[]): string {
  if ((table === "ratings" || table === "karma") && typeof path[0] === "number") {
    return `slot ${path[0] + 1}`;
  }
  let out = "";
  for (const p of path) {
    if (typeof p === "number") out += `[${p}]`;
    else out += out === "" ? String(p) : `.${String(p)}`;
  }
  return out;
}

function zodIssueMessage(issue: z.core.$ZodIssue): string {
  if (issue.code === "unrecognized_keys") {
    return `unknown field${issue.keys.length === 1 ? "" : "s"} ${issue.keys.map((k) => `'${k}'`).join(", ")}`;
  }
  if (issue.code === "invalid_type" && issue.message.includes("received undefined")) {
    return "is required but missing";
  }
  return issue.message;
}

const PICTURE_KEY = /^(picture|portrait|.*Picture|.*Background)$/;

function collectPictures(
  value: unknown,
  path: (string | number)[],
  out: { path: (string | number)[]; id: string }[],
): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => {
      collectPictures(v, [...path, i], out);
    });
  } else if (typeof value === "object" && value !== null) {
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === "string" && PICTURE_KEY.test(k)) out.push({ path: [...path, k], id: v });
      else collectPictures(v, [...path, k], out);
    }
  }
}

/** Every problem in a pack, as a list (empty when the pack is valid). Never throws. */
export function checkPack(pack: unknown, options: CheckOptions = {}): PackIssue[] {
  const files = options.files ?? {};
  const fileOf = (t: TableKey): string => files[t] ?? `${TABLE_FILE[t]}.yaml`;
  const packFile = files.pack ?? "pack.yaml";
  const issues: PackIssue[] = [];
  if (typeof pack !== "object" || pack === null || Array.isArray(pack)) {
    return [{ file: packFile, path: "", message: "a pack must be an object", kind: "schema" }];
  }
  const record = pack as Record<string, unknown>;

  const idResult = packSchema.shape.id.safeParse(record.id);
  if (!idResult.success) {
    for (const i of idResult.error.issues) {
      issues.push({ file: packFile, path: "id", message: zodIssueMessage(i), kind: "schema" });
    }
  }
  for (const key of Object.keys(record)) {
    if (key !== "id" && key !== EXPANDED_KEY && !(TABLE_KEYS as readonly string[]).includes(key)) {
      issues.push({
        file: packFile,
        path: "",
        message: `unknown table '${key}'`,
        kind: "schema",
      });
    }
  }

  for (const table of TABLE_KEYS) {
    const value = record[table];
    if (value === undefined) {
      issues.push({
        file: fileOf(table),
        path: "",
        message: `table '${table}' is missing`,
        kind: "schema",
      });
      continue;
    }
    const result = tableSchemas[table].safeParse(value);
    if (!result.success) {
      for (const i of result.error.issues) {
        const entry = entryLabel(value, i.path);
        issues.push({
          file: fileOf(table),
          path: formatPath(table, i.path),
          ...(entry === undefined ? {} : { entry }),
          message: zodIssueMessage(i),
          kind: "schema",
        });
      }
      continue;
    }
    if (options.assetIds && table !== "text") {
      const pictures: { path: (string | number)[]; id: string }[] = [];
      collectPictures(value, [], pictures);
      for (const p of pictures) {
        if (!options.assetIds.has(p.id)) {
          const entry = entryLabel(value, p.path);
          issues.push({
            file: fileOf(table),
            path: formatPath(table, p.path),
            ...(entry === undefined ? {} : { entry }),
            message: `picture '${p.id}' is not in assets/manifest.json`,
            kind: "asset",
          });
        }
      }
    }
  }

  if (record[EXPANDED_KEY] !== undefined) {
    issues.push(...checkExpandedSection(record[EXPANDED_KEY], options));
  }

  const text = record.text as
    | { hearseNames?: unknown[]; hearseDescriptions?: unknown[] }
    | undefined;
  if (
    Array.isArray(text?.hearseNames) &&
    Array.isArray(text?.hearseDescriptions) &&
    text.hearseNames.length !== text.hearseDescriptions.length
  ) {
    issues.push({
      file: fileOf("text"),
      path: "hearseDescriptions",
      message: "must have as many entries as hearseNames",
      kind: "schema",
    });
  }
  return issues;
}

/** Schema and picture problems of the Expanded section (`ContentPack.expanded`). */
function checkExpandedSection(value: unknown, options: CheckOptions): PackIssue[] {
  const file = options.files?.[EXPANDED_KEY] ?? "expanded/";
  const schema = options.strictExpanded
    ? strictExpandedSchema
    : (packSchema.shape.expanded as unknown as typeof strictExpandedSchema);
  const result = schema.safeParse(value);
  if (!result.success) {
    return result.error.issues.map((i) => {
      const entry = entryLabel(value, i.path);
      return {
        file,
        path: formatPath(EXPANDED_KEY, i.path),
        ...(entry === undefined ? {} : { entry }),
        message: zodIssueMessage(i),
        kind: "schema" as const,
      };
    });
  }
  const issues: PackIssue[] = [];
  if (options.assetIds) {
    const pictures: { path: (string | number)[]; id: string }[] = [];
    collectPictures(value, [], pictures);
    for (const p of pictures) {
      if (!options.assetIds.has(p.id)) {
        const entry = entryLabel(value, p.path);
        issues.push({
          file,
          path: formatPath(EXPANDED_KEY, p.path),
          ...(entry === undefined ? {} : { entry }),
          message: `picture '${p.id}' is not in assets/manifest.json (Expanded: or assets/remastered/manifest.json)`,
          kind: "asset",
        });
      }
    }
  }
  return issues;
}

/** Throws `PackValidationError` (naming file and entry for each problem) unless the pack is valid. */
export function validatePack(pack: unknown, options: CheckOptions = {}): ContentPack {
  const issues = checkPack(pack, options);
  if (issues.length > 0) {
    const id =
      typeof pack === "object" && pack !== null && typeof (pack as { id?: unknown }).id === "string"
        ? (pack as { id: string }).id
        : "?";
    throw new PackValidationError(id, issues);
  }
  return pack as ContentPack;
}
