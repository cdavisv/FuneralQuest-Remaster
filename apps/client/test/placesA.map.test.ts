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

const A = ["police-station", "crematorium", "florist", "gazette"];

describe("the batch-A places on the map", () => {
  it("no spot covers the Deathville Map title", () => {
    const title = { x: 20, y: 13, w: 152, h: 30 }; // base map units
    for (const id of A) {
      const r = classicPack.map.expanded[id as keyof typeof classicPack.map.expanded];
      expect(r && rectsOverlap(r, title), id).toBe(false);
    }
  });

  it("the hand-drawn map gives each a spot, and no spot covers another", () => {
    for (const id of A) expect(HOTSPOTS[id], id).toBeDefined();
    expect(overlappingPairs(HOTSPOTS)).toEqual([]);
  });

  it("the Classic art gives each a spot on the map that covers no other", () => {
    const g = classicPack.map;
    const [vx, vy, vw, vh] = g.viewBox as [number, number, number, number];
    const rects = mapRects([...Object.keys(g.expanded), ...A], g.buildings, g.expanded);
    const px = Object.fromEntries(
      Object.entries(rects).map(([id, r]) => [
        id,
        {
          x: ((r.x - vx) / vw) * MAP_W,
          y: ((r.y - vy) / vh) * MAP_H,
          w: (r.w / vw) * MAP_W,
          h: (r.h / vh) * MAP_H,
        },
      ]),
    );
    for (const id of A) {
      const r = px[id];
      expect(r, id).toBeDefined();
      if (!r) continue;
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(MAP_W);
      expect(r.y + r.h).toBeLessThanOrEqual(MAP_H);
    }
    expect(overlappingPairs(px)).toEqual([]);
  });

  it("a view's buttons say which place it is", () => {
    const view = (id: string): View =>
      ({
        scene: "location",
        title: "x",
        text: [],
        hud: { turns: 0, bpToday: 0, bpTotal: 0, luck: 0, tags: { wood: 0, silver: 0, gold: 0 } },
        buttons: [{ id, label: id }],
      }) as unknown as View;
    expect(expandedScreen(view("police:report"))).toBe("police");
    expect(expandedScreen(view("crematorium:rent"))).toBe("crematorium");
    expect(expandedScreen(view("florist:buy"))).toBe("florist");
    expect(expandedScreen(view("gazette:puff"))).toBe("gazette");
  });
});
