import type { View } from "@fq/protocol";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import classicPack from "../src/art/packs/classic/pack.json";
import {
  HOTSPOTS,
  MAP_H,
  MAP_W,
  mapRects,
  overlappingPairs,
  pinBox,
} from "../src/scenes/mapData.js";
import { renderGame, ScriptedTransport } from "./helpers.js";
import { xview } from "./xviews.js";

const PLACES = [
  "funeral-home",
  "bank",
  "store",
  "cafe",
  "yangs",
  "competitors",
  "church",
  "hospital",
  "spirit-university",
  "graveyard",
  "city-hall",
  "reaper-club",
];

describe("the map's places (docs 26)", () => {
  it("the engine sends the three new places besides the nine Classic ones", () => {
    const ids = (xview("map").map ?? []).map((p) => p.id);
    for (const id of PLACES) expect(ids).toContain(id);
  });

  it("the Classic art gives every place a spot, and no spot covers another", () => {
    const geometry = classicPack.map;
    const [vx, vy, vw, vh] = geometry.viewBox as [number, number, number, number];
    const rects = mapRects(PLACES, geometry.buildings, geometry.expanded);
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
    for (const id of PLACES) expect(px[id], id).toBeDefined();
    expect(overlappingPairs(px)).toEqual([]);
    // Everything lies on the map.
    for (const [id, r] of Object.entries(px)) {
      expect(r.x, id).toBeGreaterThanOrEqual(0);
      expect(r.y, id).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w, id).toBeLessThanOrEqual(MAP_W);
      expect(r.y + r.h, id).toBeLessThanOrEqual(MAP_H);
    }
  });

  it("a Classic town's map keeps the original spots, the Cafe's included", () => {
    const classic = PLACES.slice(0, 9);
    const rects = mapRects(classic, classicPack.map.buildings, classicPack.map.expanded);
    expect(rects).toBe(classicPack.map.buildings);
    expect(rects.cafe).toEqual({ x: -45.3, y: -225.7, w: 60, h: 84 });
  });

  it("the hand-drawn map gives every place a spot too, and none covers another", () => {
    for (const id of PLACES) expect(HOTSPOTS[id], id).toBeDefined();
    expect(overlappingPairs(HOTSPOTS)).toEqual([]);
  });

  it("the graveyard sits over the crosses and the stone of the original map, top right", () => {
    const g = classicPack.map.expanded.graveyard;
    const [vx, vy, vw, vh] = classicPack.map.viewBox as [number, number, number, number];
    const left = ((g.x - vx) / vw) * MAP_W;
    const top = ((g.y - vy) / vh) * MAP_H;
    expect(left).toBeGreaterThan(MAP_W * 0.6);
    expect(top).toBeLessThan(MAP_H * 0.2);
  });

  it("fallback pins for places nobody has drawn do not cover each other", () => {
    for (const total of [1, 3, 6, 12]) {
      const boxes = Object.fromEntries(
        Array.from({ length: total }, (_, i) => {
          const b = pinBox(i, total);
          return [
            String(i),
            {
              x: (Number.parseFloat(b.left) / 100) * MAP_W,
              y: (Number.parseFloat(b.top) / 100) * MAP_H,
              w: (Number.parseFloat(b.width) / 100) * MAP_W,
              h: (Number.parseFloat(b.height) / 100) * MAP_H,
            },
          ];
        }),
      );
      expect(overlappingPairs(boxes)).toEqual([]);
    }
  });

  it("draws a hot-spot for every place, and a pin with a label for one it has never heard of", async () => {
    const user = userEvent.setup();
    const view: View = {
      ...xview("map"),
      map: [...(xview("map").map ?? []), { id: "observatory", label: "Moon Observatory" }],
    };
    const transport = new ScriptedTransport(view, () => view);
    renderGame(transport);
    const nav = await screen.findByRole("list", { name: "Places in town" });
    for (const place of view.map ?? []) {
      expect(within(nav).getByRole("button", { name: `Go to ${place.label}` })).toBeInTheDocument();
    }
    const pin = within(nav).getByRole("button", { name: "Go to Moon Observatory" });
    expect(pin.className).toContain("fq-hotspot-pin");
    await user.click(within(nav).getByRole("button", { name: "Go to Town Graveyard" }));
    expect(transport.sent).toEqual([{ type: "visit", placeId: "graveyard" }]);
  });

  it("the graveyard hot-spot is over the base art, the other two have buildings", async () => {
    renderGame(new ScriptedTransport(xview("map")));
    const nav = await screen.findByRole("list", { name: "Places in town" });
    expect(within(nav).getByRole("button", { name: "Go to Town Graveyard" }).className).toContain(
      "fq-hotspot-area",
    );
    for (const label of ["City Hall", "The Reaper Club"]) {
      const button = within(nav).getByRole("button", { name: `Go to ${label}` });
      expect(button.className).toContain("fq-hotspot-building");
      expect(button.querySelector("img.fq-building")).not.toBeNull();
    }
  });

  it("shows the town strip on the map, with a badge for an open ballot", async () => {
    renderGame(new ScriptedTransport(xview("map")));
    const strip = await screen.findByRole("region", { name: "Today in Deathville" });
    expect(strip).toHaveTextContent(xview("map").town?.weather?.label ?? "?");
    expect(strip).toHaveTextContent("Vote");
  });
});
