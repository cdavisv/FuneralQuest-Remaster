import { Document, isScalar, parse, visit } from "yaml";
import { SLOT_COUNT } from "./tables.js";

/**
 * Stable YAML text for a value: block style, keys in insertion order, every string single-quoted
 * (so backslashes and backticks stay literal, and only `'` is doubled), number pairs inline.
 * Strings that cannot be single-quoted (a real CR or LF) fall back to double quotes.
 */
export function toYaml(value: unknown, header?: string): string {
  const doc = new Document(value);
  visit(doc, {
    Seq(_key, node) {
      if (
        node.items.length > 0 &&
        node.items.every((i) => isScalar(i) && typeof i.value === "number")
      ) {
        node.flow = true;
      }
    },
  });
  if (header !== undefined) doc.commentBefore = header;
  return doc.toString({
    lineWidth: 0,
    minContentWidth: 0,
    defaultStringType: "QUOTE_SINGLE",
    defaultKeyType: "PLAIN",
    singleQuote: true,
    doubleQuotedAsJSON: true,
  });
}

/** Parses YAML (or JSON) text; the error names `file`. */
export function fromYaml(text: string, file: string): unknown {
  try {
    return parse(text, { schema: "core", prettyErrors: true, strict: true, uniqueKeys: true });
  } catch (error) {
    throw new Error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** `ratings` / `karma` as a mapping `{ "1": text, ..., "100": text }`, so line numbers show. */
export function slotsToRecord(slots: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  slots.forEach((text, i) => {
    out[String(i + 1)] = text;
  });
  return out;
}

/** Inverse of `slotsToRecord`. Returns the input unchanged if it is not a mapping of 1 to 100. */
export function recordToSlots(value: unknown, file: string): string[] {
  if (Array.isArray(value)) return value as string[];
  if (typeof value !== "object" || value === null) {
    throw new Error(`${file}: must be a mapping of slot number to text (1 to ${SLOT_COUNT})`);
  }
  const out = new Array<string>(SLOT_COUNT).fill("");
  for (const [k, v] of Object.entries(value)) {
    const i = Number(k);
    if (!Number.isInteger(i) || i < 1 || i > SLOT_COUNT) {
      throw new Error(`${file}: slot '${k}' is outside 1 to ${SLOT_COUNT}`);
    }
    if (typeof v !== "string") throw new Error(`${file}: slot ${k} must be text`);
    out[i - 1] = v;
  }
  return out;
}
