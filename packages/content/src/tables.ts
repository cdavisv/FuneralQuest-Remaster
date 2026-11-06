import type { ContentPack } from "@fq/core";

/** Every key of a `ContentPack` other than `id`, in the order files are written and reported. */
export const TABLE_KEYS = [
  "events",
  "newsBlurbs",
  "noCustomers",
  "fortunes",
  "niceFortunes",
  "risks",
  "softSell",
  "hardSell",
  "ratings",
  "karma",
  "swearWords",
  "text",
] as const satisfies readonly (keyof ContentPack)[];

export type TableKey = (typeof TABLE_KEYS)[number];

/**
 * Compile-time guard: adding a key to `ContentPack` in `packages/core` makes this fail to
 * typecheck until the new table is added here, to the schema and to the importer.
 */
export const PACK_KEYS = {
  id: true,
  events: true,
  newsBlurbs: true,
  noCustomers: true,
  fortunes: true,
  niceFortunes: true,
  risks: true,
  softSell: true,
  hardSell: true,
  ratings: true,
  karma: true,
  swearWords: true,
  text: true,
  // Optional Expanded section (packages/core/src/expanded/content/types.ts): `EXPANDED_KEY`.
  expanded: true,
} as const satisfies Record<keyof ContentPack, true>;

/** Base name (no extension) of each table's source file, named after the legacy file. */
export const TABLE_FILE: Readonly<Record<TableKey, string>> = {
  events: "events",
  newsBlurbs: "news_blurbs",
  noCustomers: "no_customers",
  fortunes: "yangs",
  niceFortunes: "yangs_nice",
  risks: "risks",
  softSell: "soft_sell",
  hardSell: "hard_sell",
  ratings: "ratings",
  karma: "karma",
  swearWords: "swear_words",
  text: "text",
};

/** The legacy file each table comes from; `text` has none (it is `CLASSIC_TEXT`). */
export const LEGACY_FILE = {
  events: "events.txt",
  newsBlurbs: "news_blurbs.txt",
  noCustomers: "no_customers.txt",
  fortunes: "yangs.txt",
  niceFortunes: "yangs_nice.txt",
  risks: "risks.txt",
  softSell: "soft_sell.txt",
  hardSell: "hard_sell.txt",
  ratings: "ratings.txt",
  karma: "karma.txt",
  swearWords: "swear_words.txt",
} as const satisfies Record<Exclude<TableKey, "text">, `${string}.txt`>;

export const SLOT_COUNT = 100;

/**
 * The optional Expanded section. It is not in `TABLE_KEYS` (the legacy importer and the Classic
 * tables have nothing to do with it). In a pack directory it is either one file `expanded.yaml` or
 * a directory `expanded/` holding one file per key (`expanded/traits.yaml`, ...) and, for nested
 * keys, subdirectories (`expanded/text/negotiation.yaml` is `expanded.text.negotiation`).
 */
export const EXPANDED_KEY = "expanded";
