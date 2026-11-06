import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type EventEntry, EXPANDED, type RangedTable } from "@fq/core";
import { describe, expect, it } from "vitest";
import {
  checkPack,
  classicPack,
  expandedPack,
  lintPack,
  PRICE_LIMITS,
  vintagePack,
} from "../src/index.js";
import { EXPANDED_DIR, loadPackFromDirectory } from "../src/node.js";
import { fromYaml } from "../src/yamlio.js";
import { expandedIds } from "./support.js";

const x = expandedPack.expanded;
if (!x) throw new Error("The Expanded pack has no expanded section");
const xn = x.text.negotiation;
const cn = expandedPack.text.negotiation;

const messages = (t: RangedTable<EventEntry>, key: "message" | "title" = "message") =>
  new Set(t.ranges.flatMap((r) => r.entries.map((e) => e[key] ?? "")));

describe("the Expanded pack", () => {
  it("loads from packs/expanded and matches the built JSON module", () => {
    const loaded = loadPackFromDirectory(EXPANDED_DIR, {
      assetIds: expandedIds,
      base: classicPack,
    });
    expect(loaded).toStrictEqual(expandedPack);
    expect(expandedPack.id).toBe("expanded");
  });

  it("passes the schema (strict about Expanded fields), the asset manifest and the lint", () => {
    expect(checkPack(expandedPack, { assetIds: expandedIds, strictExpanded: true })).toEqual([]);
    expect(lintPack(expandedPack, { base: classicPack, assetIds: expandedIds })).toEqual([]);
  });

  it("keeps every Classic entry: Expanded is Classic plus new material", () => {
    for (const r of expandedPack.events.ranges) {
      const here = new Set(r.entries.map((e) => e.message));
      for (const e of classicPack.events.ranges[0]?.entries ?? []) {
        expect(here.has(e.message), `${r.low}..${r.high}: ${e.message}`).toBe(true);
      }
    }
    for (const r of expandedPack.newsBlurbs.ranges) {
      const here = new Set(r.entries.map((e) => e.title));
      for (const e of classicPack.newsBlurbs.ranges[0]?.entries ?? [])
        expect(here.has(e.title)).toBe(true);
    }
    for (const table of ["risks", "softSell", "hardSell", "swearWords"] as const) {
      expect(expandedPack[table].slice(0, classicPack[table].length)).toStrictEqual(
        classicPack[table],
      );
    }
    for (const table of ["fortunes", "niceFortunes", "noCustomers"] as const) {
      const here = messages(expandedPack[table]);
      for (const m of messages(classicPack[table])) expect(here.has(m), m).toBe(true);
    }
    for (const [k, v] of Object.entries(classicPack.text.negotiation)) {
      const mine = (expandedPack.text.negotiation as unknown as Record<string, unknown>)[k];
      if (Array.isArray(v)) expect((mine as unknown[]).slice(0, v.length), k).toStrictEqual(v);
    }
    // Ratings and karma: every Classic line is kept except the three repeats of slot 86.
    const changed = classicPack.ratings.flatMap((l, i) =>
      l !== "" && l !== expandedPack.ratings[i] ? [i + 1] : [],
    );
    expect(changed).toEqual([88, 89, 90]);
    expect(classicPack.karma.every((l, i) => l === "" || l === expandedPack.karma[i])).toBe(true);
  });

  it("meets the volume targets of the classic-format tables", () => {
    const events = expandedPack.events.ranges;
    expect(events.map((r) => [r.low, r.high])).toEqual([
      [-229999999, 999],
      [1000, 4999],
      [5000, 299999999],
    ]);
    expect(messages(expandedPack.events).size).toBeGreaterThanOrEqual(120);
    for (const r of events) expect(r.entries.length).toBeGreaterThanOrEqual(50);
    expect(expandedPack.newsBlurbs.ranges.map((r) => [r.low, r.high])).toEqual([
      [-229999999, 7],
      [8, 22],
      [23, 299999999],
    ]);
    expect(messages(expandedPack.newsBlurbs, "title").size).toBeGreaterThanOrEqual(80);
    expect(expandedPack.risks.length).toBeGreaterThanOrEqual(40);
    expect(expandedPack.softSell.length).toBeGreaterThanOrEqual(150);
    expect(expandedPack.hardSell.length).toBeGreaterThanOrEqual(30);
    expect(messages(expandedPack.fortunes).size).toBeGreaterThanOrEqual(150);
    expect(messages(expandedPack.niceFortunes).size).toBeGreaterThanOrEqual(50);
    expect(messages(expandedPack.noCustomers).size).toBeGreaterThanOrEqual(40);
    expect(expandedPack.ratings.filter((l) => l.trim() !== "")).toHaveLength(100);
    expect(expandedPack.karma.filter((l) => l.trim() !== "")).toHaveLength(100);
  });

  it("spreads soft-sell prices over the whole $50 grid from $50 to $600", () => {
    const fresh = expandedPack.softSell.slice(classicPack.softSell.length);
    for (let price = 50; price <= 600; price += PRICE_LIMITS.step) {
      expect(fresh.filter((i) => i.price === price).length, `$${price}`).toBeGreaterThanOrEqual(4);
    }
  });

  it("meets the volume targets of the Expanded section", () => {
    expect(x.names.male.length + x.names.female.length).toBeGreaterThanOrEqual(150);
    expect(x.names.surnames.length).toBeGreaterThanOrEqual(150);
    expect(x.traits.length).toBeGreaterThanOrEqual(40);
    for (const t of x.traits) expect(t.lines.length, t.id).toBeGreaterThanOrEqual(2);
    expect(x.backstories.length).toBeGreaterThanOrEqual(60);
    expect(x.specials.length).toBeGreaterThanOrEqual(20);
    expect(x.prep.length).toBeGreaterThanOrEqual(60);
    expect(x.softSell.length).toBeGreaterThanOrEqual(150);
    for (const list of Object.values(x.tells)) expect(list.length).toBeGreaterThanOrEqual(15);
    for (const id of ["embalming", "flowers", "plot", "headstone", "urn", "service"]) {
      const cat = x.packages.find((c) => c.id === id);
      expect(cat, id).toBeDefined();
      for (const tier of cat?.tiers ?? []) expect(tier.name, id).not.toBe("");
    }
    for (const u of EXPANDED.upgrades) {
      expect(x.upgrades[u.id]?.name, u.id).toBeTruthy();
      expect(x.upgrades[u.id]?.description, u.id).toBeTruthy();
    }
    expect(x.text.tutorial.pages.length).toBeGreaterThanOrEqual(6);
  });

  it("has at least 25 pitches, refusals and acceptances for every negotiation action", () => {
    const pools: Record<string, number> = {
      "soft pitch": cn.softPitch.length + xn.softPitch.length,
      "soft refuse": cn.softRefuse.length,
      "hard pitch (wood)": cn.hardPitchWood.length + xn.hardPitchWood.length,
      "hard pitch (silver)": cn.hardPitchSilver.length + xn.hardPitchSilver.length,
      "hard refuse": cn.hardRefuse.length,
      "hard accept": cn.hardAccept.length,
      "guilt pitch": cn.guiltPitch.length + xn.guiltPitch.length,
      "guilt backfires (loved)": cn.guiltLoved.length,
      "guilt works (not loved)": cn.guiltNotLoved.length,
      "sympathy pitch": cn.sympathyPitch.length + xn.sympathyPitch.length,
      "sympathy works (loved)": cn.sympathyLoved.length,
      "sympathy bounces (not loved)": cn.sympathyNotLoved.length,
      "coffee pitch": xn.coffeePitch.length,
      "coffee accept (loved)": xn.coffeeAccept.loved.length,
      "coffee accept (not loved)": xn.coffeeAccept.notLoved.length,
      "coffee refuse": xn.coffeeRefuse.length,
      "listen pitch": xn.listenPitch.length,
      "listen warms (loved)": xn.listenLoved.length,
      "listen bores (not loved)": xn.listenNotLoved.length,
      "discount pitch": xn.discountPitch.length,
      "discount accept": xn.discountAccept.length,
      "package pitch": xn.packagePitch.length,
      "package accept": xn.packageAccept.length + cn.upgradeAccept.length,
      "package refuse": xn.packageRefuse.length + cn.upgradeRefuse.length,
      "cremation pitch": x.cremation.pitch.length,
      "cremation accept": x.cremation.accept.length,
      "cremation refuse": x.cremation.refuse.length,
      impatient: xn.impatient.length,
    };
    const short = Object.entries(pools).filter(([, n]) => n < 25);
    expect(short).toEqual([]);
    expect(xn.discountHaggle.length).toBeGreaterThanOrEqual(15);
  });

  it("the Classic-format soft sell and the Expanded catalogue agree", () => {
    const yaml = fromYaml(readFileSync(join(EXPANDED_DIR, "soft_sell.yaml"), "utf8"), "soft_sell");
    const classicNames = new Set(classicPack.softSell.map((i) => i.name));
    const derived = x.softSell
      .filter((i) => !classicNames.has(i.name) && i.track === undefined && i.price <= 600)
      .map(({ article, name, price }) => ({ article, name, price }));
    expect(yaml).toStrictEqual(derived);
  });

  it("vintage and classic carry no Expanded section", () => {
    expect(vintagePack.expanded).toBeUndefined();
    expect(classicPack.expanded).toBeUndefined();
  });
});
