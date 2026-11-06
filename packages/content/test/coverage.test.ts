import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLASSIC_TEXT } from "@fq/core";
import { describe, expect, it } from "vitest";
import { classicPack, vintagePack } from "../src/index.js";
import { VINTAGE_DIR } from "../src/node.js";
import { fromYaml } from "../src/yamlio.js";

/** Every path to a string or an array in `value`, e.g. "social.battle.won" or "places.bank.title". */
function leafPaths(value: unknown, prefix = ""): string[] {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([k, v]) => leafPaths(v, prefix ? `${prefix}.${k}` : k));
  }
  return [prefix];
}

function at(value: unknown, path: string): unknown {
  let cur = value;
  for (const key of path.split(".")) {
    if (typeof cur !== "object" || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

const expected = leafPaths(CLASSIC_TEXT);

describe("the built packs cover every field of CLASSIC_TEXT", () => {
  it("knows its own table (guards the walker)", () => {
    expect(expected.length).toBeGreaterThan(300);
    expect(expected.some((p) => p.startsWith("places."))).toBe(true);
    expect(expected.some((p) => p.startsWith("social."))).toBe(true);
  });

  const sources: [string, () => unknown][] = [
    ["built vintage.json", () => vintagePack.text],
    ["built classic.json", () => classicPack.text],
    [
      "packs/vintage/text.yaml",
      () => fromYaml(readFileSync(join(VINTAGE_DIR, "text.yaml"), "utf8"), "text.yaml"),
    ],
  ];

  for (const [name, load] of sources) {
    it(`${name} has every field of CLASSIC_TEXT, and no others`, () => {
      const text = load();
      const missing = expected.filter((p) => at(text, p) === undefined);
      const extra = leafPaths(text).filter((p) => at(CLASSIC_TEXT, p) === undefined);
      // On failure: run `pnpm --filter @fq/content run import && pnpm --filter @fq/content run build`.
      expect({ missing, extra }).toEqual({ missing: [], extra: [] });
    });

    it(`${name} has the same type and array length at every field`, () => {
      const text = load();
      for (const path of expected) {
        const want = at(CLASSIC_TEXT, path);
        const got = at(text, path);
        expect(typeof got, path).toBe(typeof want);
        if (Array.isArray(want)) expect(Array.isArray(got), path).toBe(true);
      }
    });
  }
});
