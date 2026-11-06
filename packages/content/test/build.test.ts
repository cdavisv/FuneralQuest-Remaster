import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classicPack, expandedPack, TABLE_KEYS, vintagePack } from "../src/index.js";
import {
  BUILT_DIR,
  CLASSIC_DIR,
  importOriginal,
  renderBuiltPacks,
  renderReport,
  renderSourcePack,
} from "../src/node.js";
import { fromYaml, recordToSlots, slotsToRecord, toYaml } from "../src/yamlio.js";
import { assetIds } from "./support.js";

const { pack, notes } = importOriginal({ assetIds });

describe("the importer", () => {
  it("is stable: running it again writes the same bytes, and they match the checked-in files", () => {
    const first = { ...renderSourcePack(pack), "IMPORT_REPORT.txt": renderReport(notes) };
    const again = importOriginal({ assetIds });
    const second = {
      ...renderSourcePack(again.pack),
      "IMPORT_REPORT.txt": renderReport(again.notes),
    };
    expect(second).toStrictEqual(first);
    expect(Object.keys(first)).toHaveLength(TABLE_KEYS.length + 2);
    for (const [name, text] of Object.entries(first)) {
      expect(readFileSync(join(CLASSIC_DIR, name), "utf8"), name).toBe(text);
    }
  });

  it("writes one YAML file per legacy file, ratings and karma as numbered slots", () => {
    const files = renderSourcePack(pack);
    expect(Object.keys(files).sort()).toEqual(
      [
        "events",
        "hard_sell",
        "karma",
        "news_blurbs",
        "no_customers",
        "pack",
        "ratings",
        "risks",
        "soft_sell",
        "swear_words",
        "text",
        "yangs",
        "yangs_nice",
      ].map((n) => `${n}.yaml`),
    );
    expect(files["ratings.yaml"]).toContain(
      "'66': 'Mr Yang even remembers your name.'\n'67': ''\n",
    );
  });

  it("reports what is odd in the legacy files and fixes none of it", () => {
    const warnings = notes.filter((n) => n.level === "warning").map((n) => `${n.file}:${n.line}`);
    expect(warnings).toEqual(["risks.txt:112", "risks.txt:174"]);
    // Every picture reference in the legacy files resolves.
    expect(notes.filter((n) => n.message.includes("manifest"))).toEqual([]);
    // The carry-over really happened once, and the empty slots are reported, not filled.
    expect(notes.filter((n) => n.message.includes("inherits"))).toHaveLength(1);
    expect(notes.filter((n) => n.message.includes("empty slots")).map((n) => n.message)).toEqual([
      "3 empty slots: 67-69",
      "25 empty slots: 60-64, 66-69, 72-79, 88-89, 92-97",
    ]);
  });

  it("reports an unresolved picture when the manifest lacks it", () => {
    const { notes: withGaps } = importOriginal({
      assetIds: new Set([...assetIds].filter((i) => i !== "ring/ring")),
    });
    expect(
      withGaps.filter((n) => n.message.includes("'ring/ring'") || n.message.includes("'ring'")),
    ).toEqual([expect.objectContaining({ file: "risks.txt", level: "warning" })]);
  });

  it("YAML round trips every table exactly, including CR LF and quotes", () => {
    for (const table of TABLE_KEYS) {
      const value =
        table === "ratings" || table === "karma" ? slotsToRecord(pack[table]) : pack[table];
      const back = fromYaml(toYaml(value, " header"), table);
      expect(
        table === "ratings" || table === "karma" ? recordToSlots(back, table) : back,
      ).toStrictEqual(pack[table]);
    }
    const tricky = { a: 'it\'s "q" \\n `4x  ', b: "\r\n\t end ", c: "", d: [1, -2] };
    expect(fromYaml(toYaml(tricky), "t")).toStrictEqual(tricky);
  });
});

describe("the build step", () => {
  it("emits each built-in pack as one JSON module that matches the source files", () => {
    const built = renderBuiltPacks({ assetIds });
    expect(Object.keys(built)).toEqual(["vintage.json", "classic.json", "expanded.json"]);
    for (const [name, text] of Object.entries(built)) {
      expect(readFileSync(join(BUILT_DIR, name), "utf8"), name).toBe(text);
    }
    expect(JSON.parse(built["vintage.json"] as string)).toStrictEqual(vintagePack);
    // The deprecated Vintage pack is Classic under another id and nothing else.
    expect(vintagePack).toStrictEqual({ ...classicPack, id: "vintage" });
    expect(Object.keys(vintagePack)).toEqual(Object.keys(classicPack));
    expect(JSON.parse(built["classic.json"] as string)).toStrictEqual(classicPack);
    expect(JSON.parse(built["expanded.json"] as string)).toStrictEqual(expandedPack);
  });
});
