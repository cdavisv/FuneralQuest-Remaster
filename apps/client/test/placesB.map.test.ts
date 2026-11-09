import type { View } from "@fq/protocol";
import { describe, expect, it } from "vitest";
import classicPack from "../src/art/packs/classic/pack.json";
import { expandedScreen } from "../src/expanded/places.js";
import {
  HOTSPOTS,
  MAP_H,
  MAP_W,
  mapRects,
  overlappingPairs,
  rectsOverlap,
} from "../src/scenes/mapData.js";

const B = ["coroner", "health-department", "pawn-shop", "mournes"];

const viewWith = (id: string) =>
  ({ scene: "location", buttons: [{ id, label: "x" }] }) as unknown as View;

/** The "Deathville Map" title: baked into the Classic base map, drawn over the hand-drawn one. */
const CLASSIC_TITLE = { x: 20, y: 13, w: 152, h: 30 }; // base map units, measured on the render
const FALLBACK_TITLE = { x: 600, y: 620, w: 362, h: 66 }; // 1024 by 745 map pixels

describe("the batch-B places on the map", () => {
  it("no spot covers the Deathville Map title, on either map", () => {
    for (const id of B) {
      const h = HOTSPOTS[id];
      expect(h && rectsOverlap(h, FALLBACK_TITLE), `${id} on the hand-drawn map`).toBe(false);
      const r = classicPack.map.expanded[id as keyof typeof classicPack.map.expanded];
      expect(r && rectsOverlap(r, CLASSIC_TITLE), `${id} on the Classic map`).toBe(false);
    }
  });

  it("the hand-drawn map gives each a spot on the map that covers no other", () => {
    for (const id of B) {
      const r = HOTSPOTS[id];
      expect(r, id).toBeDefined();
      expect((r?.x ?? 0) + (r?.w ?? 0)).toBeLessThanOrEqual(MAP_W);
      expect((r?.y ?? 0) + (r?.h ?? 0)).toBeLessThanOrEqual(MAP_H);
    }
    expect(overlappingPairs(HOTSPOTS)).toEqual([]);
  });

  it("the Classic art's Expanded geometry gives each a spot that covers no other", () => {
    const rects = mapRects(B, classicPack.map.buildings, classicPack.map.expanded);
    for (const id of B) expect(rects[id as keyof typeof rects], id).toBeDefined();
    expect(overlappingPairs(rects as never)).toEqual([]);
  });

  it("each place's screen is recognised by its button prefix", () => {
    expect(expandedScreen(viewWith("coroner:tip"))).toBe("coroner");
    expect(expandedScreen(viewWith("health-department:inspect"))).toBe("health-department");
    expect(expandedScreen(viewWith("pawn-shop:loot"))).toBe("pawn-shop");
    expect(expandedScreen(viewWith("mournes:spy"))).toBe("mournes");
  });
});
