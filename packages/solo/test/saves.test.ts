import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import {
  exportSave,
  IndexedDbSaveStorage,
  importSave,
  MemorySaveStorage,
  migrateSave,
  SAVE_MIGRATIONS,
  SAVE_VERSION,
  SaveError,
  type SaveStorage,
  SoloHost,
  type SoloSave,
} from "../src/index.js";
import { testContent } from "./drivers.js";
import { config, T0 } from "./suite.js";

function aSave(seed: number, name = "Edna Embalm"): SoloSave {
  const host = SoloHost.create(
    config({ seed, player: { name, parlor: "Embalm and Co", male: false } }),
    testContent(),
    { now: () => T0 + seed },
  );
  host.connectNow();
  return host.save();
}

describe("save format", () => {
  it("refuses things that are not saves, and saves from the future", () => {
    expect(() => migrateSave(null)).toThrow(SaveError);
    expect(() => migrateSave({ format: "something" })).toThrow(SaveError);
    expect(() => migrateSave({ ...aSave(1), version: SAVE_VERSION + 1 })).toThrow(/newer/);
  });

  it("runs the migration hook from older versions", () => {
    const current = aSave(2);
    // Pretend version 0 kept the human's id under another name.
    const { humanId, ...rest } = current;
    const old = { ...rest, version: 0, human: humanId };
    expect(() => migrateSave(old)).toThrow(/upgrade/);
    const migrated = migrateSave(old, {
      ...SAVE_MIGRATIONS,
      0: (s) => {
        const { human, ...others } = s;
        return { ...others, humanId: human };
      },
    });
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.humanId).toBe(humanId);
  });

  it("exports to a file and imports it back (text or Blob)", async () => {
    const save = aSave(3);
    const file = exportSave(save);
    expect(file.filename).toBe("funeral-quest-edna-embalm-day-1.fqsave.json");
    expect(await importSave(file.text)).toEqual(save);
    expect(await importSave(new Blob([file.text], { type: file.type }))).toEqual(save);
    await expect(importSave("not json")).rejects.toThrow(SaveError);
    // An imported save opens and plays.
    const host = SoloHost.load(await importSave(file.text), testContent(), { now: () => T0 });
    expect(host.connectNow().scene).toBe("news");
  });

  it("refuses a save for a different content pack", () => {
    expect(() => SoloHost.load(aSave(4), { ...testContent(), id: "other" })).toThrow(
      /content pack/,
    );
  });
});

function storageSuite(name: string, make: () => SaveStorage) {
  describe(`${name} storage`, () => {
    it("keeps several slots, lists them newest first, and removes them", async () => {
      const store = make();
      expect(await store.list()).toEqual([]);
      const a = aSave(5, "Ada Ashes");
      const b = aSave(6, "Bert Burial");
      await store.write("slot-1", a);
      await store.write("slot-2", b);
      expect((await store.list()).map((s) => [s.slot, s.playerName, s.day])).toEqual([
        ["slot-2", "Bert Burial", 1],
        ["slot-1", "Ada Ashes", 1],
      ]);
      expect(await store.read("slot-1")).toEqual(a);
      await store.write("slot-1", b);
      expect(await store.read("slot-1")).toEqual(b);
      await store.remove("slot-2");
      expect((await store.list()).map((s) => s.slot)).toEqual(["slot-1"]);
      expect(await store.read("slot-2")).toBeNull();
    });
  });
}

storageSuite("in-memory", () => new MemorySaveStorage());
storageSuite(
  "IndexedDB (fake-indexeddb)",
  () => new IndexedDbSaveStorage({ factory: new IDBFactory() }),
);
