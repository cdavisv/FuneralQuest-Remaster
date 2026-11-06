/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { chooseBackground, choosePortrait, emptyCustomer } from "../src/classic/customerText.js";
import { chooseExpandedPortrait } from "../src/expanded/customer.js";
import { PREP_PICTURES, parlorPicture } from "../src/expanded/parlor.js";
import { assetId, CLASSIC_RULES, ClassicRandom, type CustomerState } from "../src/index.js";
import { ALL_IDS, CLASSIC_IDS, CLASSIC_MANIFEST } from "./support/assetIds.js";
import { legacyContent, REPO_ROOT } from "./support/legacyContent.js";

// Either manifest (support/assetIds.ts); Classic's own draws are checked against Classic's below.
const ids = ALL_IDS;
const manifest = { legacyUrl: CLASSIC_MANIFEST.legacyUrl ?? {} };

function portraits(choose: typeof choosePortrait): Set<string> {
  const out = new Set<string>();
  const rng = new ClassicRandom(1, 1);
  for (const male of [true, false]) {
    for (const age of [16, 30, 70]) {
      const c: CustomerState = { ...emptyCustomer(), customerMale: male, customerAge: age };
      for (let i = 0; i < 200; i++) out.add(choose(rng, c));
    }
  }
  return out;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith(".ts") ? [path] : [];
  });
}

/** Every picture id the engine can put in a View. */
function emittablePictures(): Set<string> {
  const out = new Set<string>();
  // 1. Literal ids in engine code (desk, coffee, closed sign, money bags, script art, hearses...).
  const literal =
    /"((?:places|stuff|background|people|hearse|ring|mother|animals)\/[^"$`{}]+|closed|morning_coffee|blank)"/g;
  for (const file of sourceFiles(resolve(REPO_ROOT, "packages/core/src"))) {
    for (const m of readFileSync(file, "utf8").matchAll(literal)) out.add(m[1] as string);
  }
  // 2. Customer portraits and backgrounds (online_struct.cpp:321-394, commands_complicated.cpp:442).
  // Kids are never customers (create_customer.cpp:262), so m_kid / f_kid cannot be drawn.
  for (const p of portraits(choosePortrait)) out.add(p);
  for (const p of portraits(chooseExpandedPortrait)) out.add(p);
  const rng = new ClassicRandom(1, 1);
  for (let i = 0; i < 200; i++) out.add(chooseBackground(rng));
  // Expanded art built from templates: the five parlor stages and the prep scenes (25.4).
  for (let level = 0; level <= 4; level++) out.add(parlorPicture(level));
  for (const p of PREP_PICTURES) out.add(p);
  // 3. Pictures named by the content pack.
  const content = legacyContent();
  for (const table of [content.events, content.newsBlurbs]) {
    for (const block of table.ranges)
      for (const e of block.entries) if (e.picture) out.add(e.picture);
  }
  for (const r of content.risks) {
    for (const p of [
      r.startPicture,
      r.startBackground,
      r.normalPicture,
      r.normalBackground,
      r.failPicture,
      r.failBackground,
      r.successPicture,
      r.successBackground,
    ]) {
      if (p) out.add(p);
    }
  }
  for (const h of CLASSIC_RULES.hearses) if (h.picture) out.add(h.picture);
  return out;
}

describe("picture ids (asset rule in CLAUDE.md, assets/manifest.json)", () => {
  it("every picture the engine can emit exists in the manifest", () => {
    const pictures = emittablePictures();
    expect(pictures.size).toBeGreaterThan(30);
    const missing = [...pictures].filter((p) => !ids.has(p)).sort();
    expect(missing).toEqual([]);
  });

  it("Classic draws only Classic portraits; Expanded adds exactly the four new faces", () => {
    const classic = portraits(choosePortrait);
    expect([...classic].filter((p) => !CLASSIC_IDS.has(p))).toEqual([]);
    const added = [...portraits(chooseExpandedPortrait)].filter((p) => !classic.has(p)).sort();
    expect(added).toEqual([
      "people/f_adult_3",
      "people/f_old_3",
      "people/m_adult_5",
      "people/m_old_7",
    ]);
  });

  it("Classic engine code names only Classic art", () => {
    const literal =
      /"((?:places|stuff|background|people|hearse|ring|mother|animals)\/[^"$`{}]+|closed|morning_coffee|blank)"/g;
    const found = new Set<string>();
    for (const file of sourceFiles(resolve(REPO_ROOT, "packages/core/src/classic"))) {
      for (const m of readFileSync(file, "utf8").matchAll(literal)) found.add(m[1] as string);
    }
    expect([...found].filter((p) => !CLASSIC_IDS.has(p)).sort()).toEqual([]);
  });

  it("assetId() agrees with the manifest's legacyUrl map", () => {
    for (const [url, id] of Object.entries(manifest.legacyUrl)) {
      expect(assetId(url), url).toBe(id);
      expect(assetId(url.replace(/\//g, "\\")), url).toBe(id);
    }
  });
});
