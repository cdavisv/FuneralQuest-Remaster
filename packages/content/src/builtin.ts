/**
 * The built-in packs as JSON modules, so a browser (or any bundler) can import them without
 * touching the file system. `built/*.json` is written by `pnpm --filter @fq/content run build`;
 * a test fails if it is out of date with `packs/`.
 */
import type { ContentPack } from "@fq/core";
import classicJson from "../built/classic.json" with { type: "json" };
import expandedJson from "../built/expanded.json" with { type: "json" };

/**
 * The original 2001 text, untouched: every line of `legacy/dist/*.txt` and of the strings the
 * original C++ hard-coded (`CLASSIC_TEXT`). The owner's rule is that this text must remain, even
 * where it is dated or controversial; the build and a test fail if it differs from a fresh import.
 */
export const classicPack = classicJson as unknown as ContentPack;
/**
 * Deprecated alias of `classicPack`, kept so saves, towns and imports that name the `vintage` pack
 * still load. It is the same data under the id `vintage`: Classic used to be an edited copy of
 * Vintage, and is now identical to it.
 * @deprecated Use `classicPack`.
 */
export const vintagePack: ContentPack = { ...classicPack, id: "vintage" };
/**
 * Classic plus the Expanded content pack: larger classic-format tables (so it also works under the
 * Classic ruleset) and the full `expanded` section (packs/expanded). It adds to the original text
 * and never replaces or drops a line of it.
 */
export const expandedPack = expandedJson as unknown as ContentPack;
