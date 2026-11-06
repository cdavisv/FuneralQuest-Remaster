import type { View } from "@fq/protocol";
import { describe, expect, it } from "vitest";
import { zoneOffsetMinutes } from "../src/index.js";
import { directDriver, workerDriver } from "./drivers.js";
import { config } from "./suite.js";

const text = (view: View) => view.text.map((s) => s.text).join("");

describe("the time on notices (show_time, std_all.cpp:328-347)", () => {
  it("follows the zone's daylight saving", () => {
    expect(zoneOffsetMinutes("UTC", Date.UTC(2030, 0, 1, 12))).toBe(0);
    expect(zoneOffsetMinutes("America/New_York", Date.UTC(2030, 0, 1, 12))).toBe(-300);
    expect(zoneOffsetMinutes("America/New_York", Date.UTC(2030, 6, 1, 12))).toBe(-240);
    expect(zoneOffsetMinutes("Asia/Kolkata", Date.UTC(2030, 0, 1, 12))).toBe(330);
    expect(zoneOffsetMinutes("Not/AZone", Date.UTC(2030, 0, 1, 12))).toBe(0);
  });

  for (const make of [directDriver, workerDriver]) {
    it(`prints the page's local time in front of notices (${make().name})`, async () => {
      const d = make();
      try {
        // 14:30 UTC on 2030-01-01 is 9:30 AM in New York (EST) and 2:30 PM in UTC.
        const now = Date.UTC(2030, 0, 1, 14, 30);
        await d.create(
          config({ rivals: [{ personality: "mourner", difficulty: "easy" }] }),
          now,
          "America/New_York",
        );
        let view = await d.connect();
        for (let i = 0; i < 6 && !view.buttons.some((b) => b.id === "desk:wait"); i++) {
          view = await d.send({ type: "press", buttonId: "go:desk" });
        }
        // The rival moved in after the player: the desk shows the original's notice.
        expect(text(view)).toMatch(/(^|\n)9:30 AM:.+ has just moved into town!/);
        expect(text(view)).not.toContain("2:30 PM:");
      } finally {
        await d.dispose();
      }
    }, 60_000);
  }
});
