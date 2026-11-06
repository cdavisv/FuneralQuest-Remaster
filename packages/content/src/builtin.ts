/**
 * The built-in packs as JSON modules, so a browser (or any bundler) can import them without
 * touching the file system. `built/*.json` is written by `pnpm --filter @fq/content run build`;
 * a test fails if it is out of date with `packs/`.
 */
import type { ContentPack } from "@fq/core";
import classicJson from "../built/classic.json" with { type: "json" };
import expandedJson from "../built/expanded.json" with { type: "json" };
import vintageJson from "../built/vintage.json" with { type: "json" };

/** The untouched 2001 text. */
export const vintagePack = vintageJson as unknown as ContentPack;
/** Vintage plus the reviewed edits in `packs/classic/overrides.yaml`. */
export const classicPack = classicJson as unknown as ContentPack;
/**
 * Classic plus the Expanded content pack: larger classic-format tables (so it also works under the
 * Classic ruleset) and the full `expanded` section (packs/expanded).
 */
export const expandedPack = expandedJson as unknown as ContentPack;
