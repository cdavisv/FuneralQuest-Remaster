/// <reference types="node" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_IDS } from "./support/assetIds.js";
import { REPO_ROOT } from "./support/legacyContent.js";
import { newStats, walkPlaces } from "./support/placesWalk.js";

// Either manifest: assets/manifest.json or assets/remastered/manifest.json (support/assetIds.ts).
const ids = ALL_IDS;

const SRC = resolve(REPO_ROOT, "packages/core/src/classic");
const FILES = [
  "modules/bank.ts",
  "modules/store.ts",
  "modules/university.ts",
  "modules/yangs.ts",
  "modules/church.ts",
  "modules/hospital.ts",
  "modules/options.ts",
  "scripts/storeScripts.ts",
];

describe("pictures of the town places (assets/manifest.json)", () => {
  it("every picture id written in the place modules exists", () => {
    const literal =
      /"((?:places|people|stuff|hearse|background)\/[a-z0-9_]+|blank|chinese_takeout)"/g;
    const found = new Set<string>();
    for (const file of FILES) {
      for (const m of readFileSync(resolve(SRC, file), "utf8").matchAll(literal))
        found.add(m[1] as string);
    }
    expect(found.size).toBeGreaterThanOrEqual(14);
    expect([...found].filter((p) => !ids.has(p)).sort()).toEqual([]);
  });

  it("every picture a simulated player sees in the places exists", () => {
    const stats = newStats();
    for (let seed = 1; seed <= 30; seed++) walkPlaces(seed, stats);
    expect(stats.pictures.size).toBeGreaterThanOrEqual(12);
    expect([...stats.pictures].filter((p) => !ids.has(p)).sort()).toEqual([]);
    for (const wanted of [
      "places/bank",
      "places/store",
      "places/psych",
      "places/yangs",
      "places/hospital_desk",
      "background/background_church",
      "people/churchguy_h",
      "hearse/hearse1",
      "stuff/lockpick",
      "stuff/question",
    ]) {
      expect(stats.pictures.has(wanted), wanted).toBe(true);
    }
  }, 30_000);
});
