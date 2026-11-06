import { CLASSIC_TEXT, type ClassicText, type ContentPack } from "@fq/core";
import { z } from "zod";
import { expandedSchema, newsConditionSchema } from "./expandedSchema.js";
import { pictureSchema } from "./pictures.js";
import { PACK_KEYS, SLOT_COUNT } from "./tables.js";

export { pictureSchema };

const range = z.tuple([z.number().int(), z.number().int()], {
  error: "must be a pair [low, high] of whole numbers",
});

const eventEntry = z.strictObject({
  message: z.string().optional(),
  title: z.string().optional(),
  giveRandom: z.string().optional(),
  addLog: z.string().optional(),
  picture: pictureSchema.optional(),
  modBp: range.optional(),
  modLuck: range.optional(),
  modTurns: range.optional(),
  // Expanded only (docs/expanded-rules.md 22.5); Classic rules never read it.
  when: newsConditionSchema.optional(),
});

function rangedTable<T extends z.ZodType>(entry: T) {
  return z.strictObject({
    ranges: z.array(
      z.strictObject({
        low: z.number().int(),
        high: z.number().int(),
        entries: z.array(entry),
      }),
    ),
  });
}

const riskEntry = z.strictObject({
  startMessage: z.string(),
  startPicture: pictureSchema.optional(),
  startBackground: pictureSchema.optional(),
  normalLabel: z.string(),
  riskLabel: z.string(),
  normalMessage: z.string(),
  normalPicture: pictureSchema.optional(),
  normalBackground: pictureSchema.optional(),
  failMessage: z.string(),
  failPicture: pictureSchema.optional(),
  failBackground: pictureSchema.optional(),
  successMessage: z.string(),
  successPicture: pictureSchema.optional(),
  successBackground: pictureSchema.optional(),
});

const saleItem = z.strictObject({
  article: z.string(),
  name: z.string(),
  price: z.number().int().nonnegative(),
});

const swearWord = z.strictObject({
  bad: z.string().min(1, { error: "the word to replace must not be empty" }),
  good: z.string(),
});

const slots = z.array(z.string()).length(SLOT_COUNT, {
  error: `must have exactly ${SLOT_COUNT} entries (slot i holds line i+1; missing lines are "")`,
});

/**
 * Builds the schema of `ClassicText` from the reference table instead of repeating its 100-odd
 * fields: every string stays a string, every object keeps its keys (and rejects extra ones), every
 * array holds strings or `{ loved, notLoved }` lines and must not be empty. The two hearse tables
 * keep their length (they are table rows, not alternatives).
 */
function deriveTextSchema(reference: unknown, key: string): z.ZodType {
  if (typeof reference === "string") return z.string();
  if (Array.isArray(reference)) {
    const lovedLine = z.strictObject({ loved: z.string(), notLoved: z.string() });
    const element = reference.every((x) => typeof x === "string")
      ? z.string()
      : z.union([z.string(), lovedLine]);
    const array = z.array(element);
    return key.startsWith("hearse")
      ? array.length(reference.length, { error: `must have exactly ${reference.length} entries` })
      : array.min(1, { error: "must have at least one entry" });
  }
  if (typeof reference === "object" && reference !== null) {
    const shape: Record<string, z.ZodType> = {};
    for (const [k, v] of Object.entries(reference)) shape[k] = deriveTextSchema(v, k);
    return z.strictObject(shape);
  }
  throw new Error(`Unsupported value in the reference text table at '${key}'`);
}

export const textSchema = deriveTextSchema(
  CLASSIC_TEXT,
  "text",
) as unknown as z.ZodType<ClassicText>;

export const tableSchemas = {
  events: rangedTable(eventEntry),
  newsBlurbs: rangedTable(eventEntry),
  noCustomers: rangedTable(eventEntry),
  fortunes: rangedTable(eventEntry),
  niceFortunes: rangedTable(eventEntry),
  risks: z.array(riskEntry).min(1, { error: "must have at least one risk" }),
  softSell: z.array(saleItem).min(1, { error: "must have at least one item" }),
  hardSell: z.array(saleItem),
  ratings: slots,
  karma: slots,
  swearWords: z.array(swearWord),
  text: textSchema,
} as const;

export const packSchema = z.strictObject({
  id: z
    .string()
    .regex(/^[a-z0-9][a-z0-9_-]*$/, { error: "must be lowercase letters, digits, '-' or '_'" }),
  ...tableSchemas,
  // The Expanded section is optional (Classic packs have none). Its numbers are checked against the
  // rules by `checkExpandedContent` in @fq/core as well (see lint.ts).
  expanded: expandedSchema.optional(),
});

// The schema and `PACK_KEYS` must describe the same top-level keys.
const schemaKeys = Object.keys(packSchema.shape).sort().join(",");
const packKeys = Object.keys(PACK_KEYS).sort().join(",");
if (schemaKeys !== packKeys) {
  throw new Error(`Pack schema keys (${schemaKeys}) differ from ContentPack keys (${packKeys})`);
}

/** Type-level check that anything the schema accepts is a usable `ContentPack` shape. */
export type SchemaPack = z.infer<typeof packSchema>;
export type { ContentPack };
