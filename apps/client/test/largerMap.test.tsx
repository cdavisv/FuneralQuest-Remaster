import type { View } from "@fq/protocol";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import classicPack from "../src/art/packs/classic/pack.json";
import remasteredPack from "../src/art/packs/remastered/pack.json";
import { buildPacks, getPack, PACKS } from "../src/art/packs.js";
import type { MapGeometry, PackJson, Rect } from "../src/art/types.js";
import { isExpandedTown, overlappingPairs } from "../src/scenes/mapData.js";
import { renderGame, ScriptedTransport } from "./helpers.js";
import { xview } from "./xviews.js";

const larger: MapGeometry = {
  viewBox: remasteredPack.expandedMap.viewBox as MapGeometry["viewBox"],
  buildings: remasteredPack.expandedMap.buildings,
};
const original = classicPack.map as {
  viewBox: number[];
  buildings: Record<string, Rect>;
  expanded: Record<string, Rect>;
};
const CLASSIC_IDS = Object.keys(original.buildings);
/** Every place an Expanded town has (the engine's captured map View). */
const EXPANDED_IDS = (xview("map").map ?? []).map((p) => p.id);

describe("the larger map of an Expanded town", () => {
  it("has a spot for every place an Expanded town sends, and no spot covers another", () => {
    expect(EXPANDED_IDS.length).toBeGreaterThan(CLASSIC_IDS.length);
    for (const id of EXPANDED_IDS) expect(larger.buildings[id], id).toBeDefined();
    expect(overlappingPairs(larger.buildings)).toEqual([]);
  });

  it("keeps the 2001 map where it was: same origin, the nine original spots as in any Expanded town", () => {
    const [x, y, w, h] = larger.viewBox;
    const [ox, oy, ow, oh] = original.viewBox as [number, number, number, number];
    expect([x, y]).toEqual([ox, oy]);
    expect(w).toBeGreaterThan(ow);
    expect(h).toBeGreaterThan(oh);
    // The Cafe's spot is trimmed in every Expanded town (the 2001 spots of the Cafe and the
    // Church overlap); the rest are the 2001 map's own.
    const spots: Record<string, Rect | undefined> = {
      ...original.buildings,
      cafe: original.expanded.cafe,
    };
    for (const id of CLASSIC_IDS) expect(larger.buildings[id], id).toEqual(spots[id]);
  });

  it("puts every place on the map, inside the frame", () => {
    const [x, y, w, h] = larger.viewBox;
    const rim = 15; // the frame drawn round the map
    for (const [id, r] of Object.entries(larger.buildings)) {
      expect(r.x, id).toBeGreaterThanOrEqual(x + rim);
      expect(r.y, id).toBeGreaterThanOrEqual(y + rim);
      expect(r.x + r.w, id).toBeLessThanOrEqual(x + w - rim);
      expect(r.y + r.h, id).toBeLessThanOrEqual(y + h - rim);
    }
  });

  it("keeps the new places' tops below the town strip drawn over the top of the map", () => {
    // The strip is about 30 layout units tall over a map 700 to 730 units tall, 23 art units at
    // most: a new place starts 29 below the top edge (City Hall and the Crematorium were under
    // a full strip at 1024 x 745).
    const top = larger.viewBox[1];
    for (const id of EXPANDED_IDS.filter((i) => !CLASSIC_IDS.includes(i))) {
      expect((larger.buildings[id] as Rect).y - top, id).toBeGreaterThanOrEqual(29);
    }
  });

  it("draws the new places at the size of the originals, not squeezed in", () => {
    const area = (r: Rect) => r.w * r.h;
    const originals = CLASSIC_IDS.map((id) => area(original.buildings[id] as Rect));
    const smallest = Math.min(...originals);
    for (const id of EXPANDED_IDS.filter((i) => !CLASSIC_IDS.includes(i) && i !== "graveyard")) {
      expect(area(larger.buildings[id] as Rect), id).toBeGreaterThanOrEqual(smallest);
    }
  });

  it("is an Expanded town's when the town has a place the 2001 map does not", () => {
    expect(isExpandedTown(CLASSIC_IDS, original.buildings)).toBe(false);
    expect(isExpandedTown([...CLASSIC_IDS, "city-hall"], original.buildings)).toBe(true);
  });
});

describe("which packs draw the larger map", () => {
  it("the Remastered pack has it, and the Classic art shares it (an Expanded town has no 2001 map)", () => {
    const remastered = getPack("remastered");
    const classic = getPack("classic");
    expect(remastered.expandedMap).toEqual(larger);
    expect(remastered.pieces["deathville-map-expanded-base"]).toBeTruthy();
    expect(classic.expandedMap).toEqual(larger);
    expect(classic.pieces["deathville-map-expanded-base"]).toBe(
      remastered.pieces["deathville-map-expanded-base"],
    );
  });

  it("a pack that does not draw the 2001 map does not borrow it (the hand-drawn one)", () => {
    const drawn = PACKS.find((p) => p.id === "handdrawn");
    expect(drawn?.expandedMap).toBeUndefined();
    expect(drawn?.pieces["deathville-map-expanded-base"]).toBeUndefined();
  });

  it("only a pack with the 2001 map borrows it", () => {
    const geometry: MapGeometry = { viewBox: [0, 0, 10, 10], buildings: {} };
    const packs = buildPacks(
      {
        "./packs/a/pack.json": { id: "a", name: "A", expandedMap: geometry } as PackJson,
        "./packs/b/pack.json": { id: "b", name: "B" },
        "./packs/c/pack.json": { id: "c", name: "C" },
      },
      {
        "./packs/a/ui/deathville-map-expanded-base.svg": "/a/big.svg",
        "./packs/b/ui/deathville-map-base.svg": "/b/map.svg",
      },
    );
    const b = packs.find((p) => p.id === "b");
    const c = packs.find((p) => p.id === "c");
    expect(b?.expandedMap).toEqual(geometry);
    expect(b?.pieces["deathville-map-expanded-base"]).toBe("/a/big.svg");
    expect(c?.expandedMap).toBeUndefined();
    expect(c?.pieces["deathville-map-expanded-base"]).toBeUndefined();
  });
});

describe("the map scene", () => {
  it("shows an Expanded town on the larger map", async () => {
    const view = xview("map");
    renderGame(new ScriptedTransport(view, () => view));
    await screen.findByRole("list", { name: "Places in town" });
    const map = document.querySelector(".fq-map");
    expect(map?.getAttribute("data-map")).toBe("expanded");
    expect(document.querySelector(".fq-map-base")?.getAttribute("src")).toContain(
      "deathville-map-expanded-base",
    );
  });

  it("keeps a Classic town on the 2001 map", async () => {
    const full = xview("map");
    const view: View = { ...full, map: (full.map ?? []).filter((p) => CLASSIC_IDS.includes(p.id)) };
    renderGame(new ScriptedTransport(view, () => view));
    await screen.findByRole("list", { name: "Places in town" });
    expect(document.querySelector(".fq-map")?.getAttribute("data-map")).toBeNull();
    const src = document.querySelector(".fq-map-base")?.getAttribute("src") ?? "";
    expect(src).toContain("deathville-map-base");
    expect(src).not.toContain("expanded");
  });
});
