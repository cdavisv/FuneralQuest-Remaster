import { vintagePack } from "@fq/content";
import { describe, expect, it } from "vitest";
import { chooseRivals, SoloHost } from "../src/index.js";
import { workerDriver } from "./drivers.js";
import { config } from "./suite.js";

describe("content packs in the worker", () => {
  it("plays the Vintage pack by name, with nothing sent over, and saves its id", async () => {
    const d = workerDriver();
    try {
      await d.create(config({ contentPack: "vintage", rivals: [] }), 1_700_000_000_000);
      const view = await d.connect();
      expect(view.buttons.length).toBeGreaterThan(0);
      const save = await d.save();
      expect(save.config.contentPack).toBe("vintage");
      // The same save opens on a host that was given the pack itself.
      expect(() => SoloHost.load(save, vintagePack)).not.toThrow();
    } finally {
      await d.dispose();
    }
  });

  it("says plainly when the worker lacks the pack a game names", async () => {
    const d = workerDriver();
    try {
      await expect(
        d.create(config({ contentPack: "nonesuch" }), 1_700_000_000_000),
      ).rejects.toThrow(/no content pack called "nonesuch"/);
    } finally {
      await d.dispose();
    }
  });

  it("reports which field of the parlor form the engine refused", async () => {
    const d = workerDriver();
    try {
      const refused = await d
        .create(config({ player: { name: "", parlor: "Rest", male: true } }), 1_700_000_000_000)
        .catch((e: unknown) => e);
      expect(refused).toBeInstanceOf(Error);
      expect((refused as Error).name).toBe("SoloSetupError");
      expect(typeof (refused as { field?: unknown }).field).toBe("string");
    } finally {
      await d.dispose();
    }
  });
});

describe("chooseRivals", () => {
  it("is the same table for the same seed, one personality each until they run out", () => {
    const a = chooseRivals(6, "hard", 99);
    expect(chooseRivals(6, "hard", 99)).toEqual(a);
    expect(new Set(a.map((r) => r.personality)).size).toBe(6);
    expect(a.every((r) => r.difficulty === "hard")).toBe(true);
    expect(chooseRivals(6, "hard", 100).map((r) => r.personality)).not.toEqual(
      a.map((r) => r.personality),
    );
  });

  it("gives 0 to 7 rivals, repeating personalities after six", () => {
    expect(chooseRivals(0, "easy", 1)).toEqual([]);
    expect(chooseRivals(7, "normal", 1)).toHaveLength(7);
    expect(chooseRivals(99, "normal", 1)).toHaveLength(7);
    expect(chooseRivals(-3, "normal", 1)).toEqual([]);
  });
});
