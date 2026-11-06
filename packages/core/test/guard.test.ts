import { describe, expect, it } from "vitest";
import { richTextToPlain, step } from "../src/index.js";
import { makeTown, press } from "./support/harness.js";
import { openNegotiation, scriptEvent } from "./support/scenarios.js";

const BUILT = [
  "bank",
  "store",
  "cafe",
  "yangs",
  "competitors",
  "church",
  "hospital",
  "spirit-university",
];

describe("action guard (generalised location_callback_ok, location_data.cpp:5-15)", () => {
  it("rejects buttons, places and overlays the last view did not offer, leaving the town as it was", () => {
    const { town, ctx } = openNegotiation(1);
    for (const action of [
      { type: "press", buttonId: "go:desk" },
      { type: "press", buttonId: "desk:wait" },
      { type: "visit", placeId: "bank" },
      { type: "pickPlayer", overlayId: "script:getname", playerId: 1 },
      { type: "submitText", overlayId: "x", text: null },
      { type: "dismiss", overlayId: "x" },
      { type: "chat", text: "hi" },
    ] as const) {
      const r = step(town, 0, action, ctx);
      expect(r.rejected, JSON.stringify(action)).toBeDefined();
      expect(r.town).toBe(town);
    }
  });

  it("rejects players not logged on and players not offered by a picker", () => {
    const { town, ctx } = makeTown(1, 2);
    const off = step(town, 0, { type: "exit" }, ctx).town;
    expect(step(off, 0, { type: "press", buttonId: "go:desk" }, ctx).rejected).toBe(
      "Not logged on",
    );
    const arson = scriptEvent("arson");
    const t = structuredClone(arson.town);
    (t.players[0] as { tags: number[] }).tags = [0, 0, 9];
    const picker = press(t, 0, "script:1", arson.ctx);
    expect(
      step(
        picker.town,
        0,
        { type: "pickPlayer", overlayId: "script:getname", playerId: 99 },
        arson.ctx,
      ).rejected,
    ).toBeDefined();
    expect(
      step(picker.town, 0, { type: "press", buttonId: "script:1" }, arson.ctx).rejected,
    ).toBeDefined();
  });

  it("exit is always allowed and a sale in progress is completed by mail", () => {
    const { town, ctx } = openNegotiation(1);
    const r = step(town, 0, { type: "exit" }, ctx);
    expect(r.rejected).toBeUndefined();
    expect(r.view.scene).toBe("lobby");
    expect(r.town.sessions["0"]).toBeUndefined();
    expect(r.town.players[0]?.plots).toBe(1);
  });

  it("the town map lists the canonical places; unbuilt ones say so and lead back to the map", () => {
    const { town, ctx } = makeTown(1, 1);
    const map = press(
      press(press(town, 0, "go:desk", ctx).town, 0, "go:desk", ctx).town,
      0,
      "go:map",
      ctx,
    );
    expect(map.view.map?.map((p) => p.id)).toEqual([
      "funeral-home",
      "bank",
      "store",
      "cafe",
      "yangs",
      "competitors",
      "church",
      "hospital",
      "spirit-university",
    ]);
    for (const place of map.view.map ?? []) {
      const r = step(map.town, 0, { type: "visit", placeId: place.id }, ctx);
      expect(r.rejected).toBeUndefined();
      if (place.id === "funeral-home") expect(r.view.scene).toBe("desk");
      else if (BUILT.includes(place.id)) {
        // Ported places have their own screens and a way back to the map.
        expect(r.view.buttons.map((b) => b.id)).toContain("go:map");
        expect(richTextToPlain(r.view.text)).not.toMatch(/not built yet/);
      } else expect(r.view.buttons.map((b) => b.id)).toEqual(["go:map"]);
    }
  });
});
