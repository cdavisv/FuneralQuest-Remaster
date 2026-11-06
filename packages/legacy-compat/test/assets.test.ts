import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { LegacyAssets, loadAssets } from "../src/assets.js";
import { REPO_ROOT } from "../src/plugin.js";

const ROOT = resolve(REPO_ROOT, "legacy/dist/public");
const MANIFEST = resolve(REPO_ROOT, "assets/manifest.json");

describe("legacy picture URLs", () => {
  const assets = loadAssets(MANIFEST, ROOT);

  it("maps an asset id back to its forward-slash URL", () => {
    expect(assets.urlFor("places/bank")).toBe("flash/places/bank.swf");
    expect(assets.urlFor("wait")).toBe("flash/wait.swf");
    expect(assets.urlFor("stuff/money_bag_2")).toBe("flash/stuff/money_bag_2.swf");
    expect(assets.urlFor("blank")).toBe("flash/blank.swf");
  });

  it("never returns a backslash", () => {
    const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as {
      legacyUrl: Record<string, string>;
    };
    for (const id of new Set(Object.values(manifest.legacyUrl))) {
      expect(assets.urlFor(id)).not.toContain("\\");
    }
  });

  it("picks the spelling that is a real file (the server is case sensitive)", () => {
    expect(assets.urlFor("ring/ring")).toBe("flash/Ring/ring.swf");
    const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as {
      legacyUrl: Record<string, string>;
    };
    for (const id of new Set(Object.values(manifest.legacyUrl))) {
      expect(existsSync(resolve(ROOT, assets.urlFor(id))), id).toBe(true);
    }
  });

  it("falls back to flash/<id>.swf for an id the manifest does not list", () => {
    expect(new LegacyAssets({ legacyUrl: {} }).urlFor("people/new_guy")).toBe(
      "flash/people/new_guy.swf",
    );
  });

  it("reverses a map with both slash styles", () => {
    const small = new LegacyAssets({
      legacyUrl: {
        "flash\\places\\bank.swf": "places/bank",
        "flash/places/bank.swf": "places/bank",
      },
    });
    expect(small.urlFor("places/bank")).toBe("flash/places/bank.swf");
  });
});
