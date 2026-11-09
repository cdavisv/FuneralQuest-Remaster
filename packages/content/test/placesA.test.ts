// biome-ignore-all lint/suspicious/noTemplateCurlyInString: "${price}" in planted lines is a dollar sign before a placeholder.
/**
 * The eight places' text (`expanded.placesA`, `expanded.placesB`; docs/expanded-rules.md sections 30
 * and 31): it lives in the Expanded pack's YAML like the town's, has real schemas, and goes through
 * the placeholder, length and banned-term lint.
 */
import { type ContentPack, PLACES_A_STARTER, PLACES_B_STARTER } from "@fq/core";
import { describe, expect, it } from "vitest";
import { bannedTerms } from "../src/banned.js";
import {
  checkPack,
  expandedPack,
  formatIssue,
  lintPack,
  strictExpandedSchema,
} from "../src/index.js";
import { expandedIds } from "./support.js";

/** Every string of a value, with its path. */
function strings(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${path}[${i}]`));
  if (value && typeof value === "object")
    return Object.entries(value).flatMap(([k, v]) => strings(v, path === "" ? k : `${path}.${k}`));
  return [];
}

const lint = (p: ContentPack): string[] => lintPack(p, { assetIds: expandedIds }).map(formatIssue);

/** The built pack with `edit` applied to its places. */
function planted(edit: (x: NonNullable<ContentPack["expanded"]>) => void): ContentPack {
  const p = structuredClone(expandedPack);
  if (!p.expanded) throw new Error("no expanded section");
  edit(p.expanded);
  return p;
}

describe("the places' text in the Expanded pack", () => {
  const { placesA, placesB } = expandedPack.expanded ?? {};

  it("is in the pack (YAML), not only in the engine's starter", () => {
    expect(placesA).toBeDefined();
    expect(placesB).toBeDefined();
  });

  it("passes the strict schemas, the manifest and the lint", () => {
    expect(strictExpandedSchema.safeParse(expandedPack.expanded).success).toBe(true);
    expect(checkPack(expandedPack, { assetIds: expandedIds, strictExpanded: true })).toEqual([]);
    expect(lint(expandedPack)).toEqual([]);
  });

  it("is the same words as the engine's starter fallback", () => {
    expect(placesA).toEqual(PLACES_A_STARTER);
    expect(placesB).toEqual(PLACES_B_STARTER);
  });

  it("passes the banned-terms policy and has balanced braces and no empty strings", () => {
    for (const [path, text] of strings({ placesA, placesB })) {
      expect(text.trim(), path).not.toBe("");
      expect(bannedTerms(text), path).toEqual([]);
      expect((text.match(/\{/g) ?? []).length, path).toBe((text.match(/\}/g) ?? []).length);
    }
  });

  it("names the coroner and the Mournes by cast slot, not literally", () => {
    for (const [path, text] of strings({ placesA, placesB })) {
      expect(text, path).not.toMatch(/Grimble|Augustus|\bNed\b|Rollo/);
    }
    const cast = expandedPack.expanded?.town?.cast;
    expect(cast?.coroner).toBe("Dr. Ignatius Grimble");
    expect(cast?.mourne).toBe("Augustus Mourne");
    expect(cast?.sons).toBe("Ned and Rollo");
    expect(cast?.mournes).toBe("Mourne & Sons");
  });

  it("puts no dollar sign next to an amount (amounts arrive formatted)", () => {
    for (const [path, text] of strings({ placesA, placesB })) {
      expect(text.replace(/`./g, ""), path).not.toMatch(/\$\s?\{/);
    }
  });
});

describe("the places' lint (each rule, with a planted violation)", () => {
  it("an unfilled placeholder in the Gazette is caught", () => {
    const out = lint(
      planted((x) => {
        if (x.placesA) x.placesA.gazette.intro = "{editor} and {mayor} and {nobody}.";
      }),
    );
    expect(out).toContainEqual(
      expect.stringMatching(/placesA\.yaml: gazette\.intro.*placeholder \{nobody\}/),
    );
  });

  it("an unfilled placeholder in the Mournes' text is caught, a cast one is not", () => {
    const out = lint(
      planted((x) => {
        if (x.placesB) {
          x.placesB.mournes.holdDone = "{mourne} nods. {coroner} frowns. {weather}.";
        }
      }),
    );
    expect(out).toContainEqual(expect.stringMatching(/mournes\.holdDone.*placeholder \{weather\}/));
    expect(
      out.filter((l) => /mournes\.holdDone.*placeholder \{(mourne|coroner)\}/.test(l)),
    ).toEqual([]);
  });

  it("a typed amount next to a placeholder is caught", () => {
    const out = lint(
      planted((x) => {
        if (x.placesB) x.placesB.pawn.lootSold = "Counts out $500 and {money}.";
      }),
    );
    expect(out).toContainEqual(expect.stringMatching(/pawn\.lootSold.*typed amount/));
  });

  it("a button that runs too long, and a bad picture are caught", () => {
    const out = lint(
      planted((x) => {
        if (x.placesA) {
          x.placesA.police.buttons.report = "File a Report With the Very Slow Desk Sergeant";
          x.placesA.pictures.florist.bg = "places/no-such-place";
        }
      }),
    );
    expect(out).toContainEqual(expect.stringMatching(/police\.buttons\.report.*long/));
    expect(out).toContainEqual(
      expect.stringMatching(/placesA\.yaml: pictures\.florist\.bg.*unknown/),
    );
  });
});

describe("the places' schemas", () => {
  it("reject a missing field and (strict) a misspelled one", () => {
    const missing = structuredClone(expandedPack.expanded);
    if (missing?.placesA) {
      (missing.placesA.police as unknown as Record<string, unknown>).intro = undefined;
    }
    expect(strictExpandedSchema.safeParse(missing).success).toBe(false);
    const typo = structuredClone(expandedPack.expanded);
    if (typo?.placesB) {
      (typo.placesB.coroner as unknown as Record<string, unknown>).tipBough = "x";
    }
    expect(strictExpandedSchema.safeParse(typo).success).toBe(false);
  });
});
