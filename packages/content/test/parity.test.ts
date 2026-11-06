import { CLASSIC_TEXT, type ContentPack } from "@fq/core";
import { describe, expect, it } from "vitest";
import { legacyContent } from "../../core/test/support/legacyContent.js";
import { classicPack, TABLE_KEYS, vintagePack } from "../src/index.js";
import { importOriginal } from "../src/node.js";
import { assetIds, legacySources } from "./support.js";

function legacy(file: string): string {
  return legacySources[file as keyof typeof legacySources];
}

const reference = legacyContent();
const imported = importOriginal({ assetIds }).pack;

describe("Classic equals what the core test loader reads from legacy/dist", () => {
  for (const table of TABLE_KEYS) {
    it(`${table} (built pack)`, () => {
      expect(classicPack[table]).toStrictEqual(reference[table]);
      expect(vintagePack[table]).toStrictEqual(reference[table]);
    });
    it(`${table} (fresh import)`, () => {
      expect(imported[table]).toStrictEqual(reference[table]);
    });
  }

  it("has the same keys as the reference pack", () => {
    expect(Object.keys(classicPack).sort()).toEqual(Object.keys(reference).sort());
  });

  it("keeps CLASSIC_TEXT as is", () => {
    expect(classicPack.text).toStrictEqual(CLASSIC_TEXT);
    expect(vintagePack.text).toStrictEqual(CLASSIC_TEXT);
  });
});

function entryCounts(pack: ContentPack): Record<string, number[]> {
  const c = (t: ContentPack["events"]) => t.ranges.map((r) => r.entries.length);
  return {
    events: c(pack.events),
    newsBlurbs: c(pack.newsBlurbs),
    noCustomers: c(pack.noCustomers),
    fortunes: c(pack.fortunes),
    niceFortunes: c(pack.niceFortunes),
  };
}

describe("counts match the originals", () => {
  it("has 23 events, 21 news blurbs, 35 cursed and 5 nice fortunes, 16 no-customer lines", () => {
    expect(entryCounts(classicPack)).toEqual({
      events: [23],
      newsBlurbs: [21],
      noCustomers: [16],
      fortunes: [35],
      niceFortunes: [5],
    });
  });

  it("has 10 risks, 55 soft-sell items, 10 hard-sell upgrades, 11 swear words", () => {
    expect(classicPack.risks).toHaveLength(10);
    expect(classicPack.softSell).toHaveLength(55);
    expect(classicPack.hardSell).toHaveLength(10);
    expect(classicPack.swearWords).toHaveLength(11);
  });

  it("counts the entry markers in the legacy files the same way", () => {
    // The counts above are what a plain grep of the files gives too.
    const count = (file: string, marker: string) =>
      (file.match(new RegExp(`^${marker}\\|?\\r?$`, "gm")) ?? []).length;
    expect(count(legacy("events.txt"), "start_entry")).toBe(23);
    expect(count(legacy("news_blurbs.txt"), "start_entry")).toBe(21);
    expect(count(legacy("yangs.txt"), "start_entry")).toBe(35);
    expect(count(legacy("yangs_nice.txt"), "start_entry")).toBe(5);
    expect(count(legacy("risks.txt"), "add_risk")).toBe(10);
    expect(count(legacy("soft_sell.txt"), "add_item")).toBe(55);
    expect(count(legacy("hard_sell.txt"), "add_item")).toBe(10);
  });

  it("Classic has every table length of the original", () => {
    expect(entryCounts(classicPack)).toEqual({
      events: [23],
      newsBlurbs: [21],
      noCustomers: [16],
      fortunes: [35],
      niceFortunes: [5],
    });
    expect(classicPack.ratings).toHaveLength(100);
    expect(classicPack.karma).toHaveLength(100);
  });
});
