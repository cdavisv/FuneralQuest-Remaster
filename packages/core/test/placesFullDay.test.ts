import { describe, expect, it } from "vitest";
import { MY_PLACES, newStats, walkPlaces } from "./support/placesWalk.js";

describe("a simulated player in every place, across seeds", () => {
  const stats = newStats();
  const towns = new Map<number, string>();

  it("visits every place and presses every offered button with invariants holding", () => {
    for (let seed = 1; seed <= 80; seed++) {
      const town = walkPlaces(seed, stats);
      if (seed === 7) towns.set(seed, JSON.stringify(town));
    }
    expect([...stats.visited].sort()).toEqual([...MY_PLACES].sort());
    expect(stats.steps).toBe(80 * 120);
  }, 60_000);

  it("reached every kind of screen and prompt", () => {
    for (const id of [
      "bank:count",
      "options:name",
      "yangs:tiger-target",
      "yangs:sparrow-target",
      "yangs:tiger-fortune",
      "yangs:sparrow-fortune",
      "spirit-university:paper",
    ]) {
      expect(stats.overlays.has(id), id).toBe(true);
    }
  });

  it("accepted each of the places' buttons at least once", () => {
    const expected = [
      "bank:exchange",
      "bank:all-wood",
      "bank:all-gold",
      "bank:wood",
      "bank:silver",
      "bank:gold",
      "bank:ask:0:2",
      "bank:ask:2:0",
      "store:hearse",
      "store:look:1",
      "store:look:4",
      "store:buy",
      "store:security",
      "store:supplies",
      "script:2",
      "script:3",
      "script:4",
      "spirit-university:psych",
      "spirit-university:hp",
      "spirit-university:strength",
      "spirit-university:library",
      "spirit-university:heroes",
      "spirit-university:paper-start",
      "spirit-university:library-restart",
      "spirit-university:main",
      "yangs:dragon",
      "yangs:sparrow",
      "yangs:tiger",
      "yangs:bitchy",
      "yangs:menu",
      "hospital:leave-room",
      "options:input",
      "go:options",
      "go:store",
      "go:bank",
      "go:map",
    ];
    // hospital:leave-room needs the sick room, which only the battle module enters.
    const missing = expected.filter(
      (id) => id !== "hospital:leave-room" && !stats.accepted.has(id),
    );
    expect(missing).toEqual([]);
  });

  it("is deterministic for a seed", () => {
    expect(JSON.stringify(walkPlaces(7, newStats()))).toBe(towns.get(7));
  });
});
