import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { richTextToPlain } from "@fq/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import {
  ContentPacksError,
  createContentSource,
  loadPacksDirectory,
} from "../src/content/index.js";
import { ADMIN_TOKEN, type Harness, startServer, TestPlayer, toDesk } from "./support/harness.js";

let root = "";
let h: Harness | null = null;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "fq-packs-"));
});
afterEach(async () => {
  await h?.stop();
  h = null;
  rmSync(root, { recursive: true, force: true });
});

/** A pack that extends Classic and renames the cafe through an override. */
function writePack(dir: string, id: string, cafe: string, extra: Record<string, string> = {}) {
  const path = join(root, dir);
  mkdirSync(path, { recursive: true });
  writeFileSync(join(path, "pack.yaml"), `id: ${id}\nextends: classic\n`);
  writeFileSync(
    join(path, "overrides.yaml"),
    `edits:
  - id: rename-cafe
    category: real-brand
    in: text
    original: "Pale Horse Cafe"
    replacement: "${cafe}"
    reason: "test"
`,
  );
  for (const [name, body] of Object.entries(extra)) writeFileSync(join(path, name), body);
  return path;
}

describe("FQ_PACKS_DIR", () => {
  it("is read from the environment and defaults to off", () => {
    expect(loadConfig({}).packsDir).toBe("");
    expect(loadConfig({ FQ_PACKS_DIR: "/srv/packs" }).packsDir).toBe("/srv/packs");
  });

  it("offers the built-in packs and every pack directory by its id", () => {
    writePack("spooky-dir", "spooky", "Ghost Horse Cafe");
    writePack("ghost-dir", "ghostly", "Phantom Cafe");
    mkdirSync(join(root, ".hidden"));
    writeFileSync(join(root, "README.txt"), "not a pack");
    const source = createContentSource({ packsDir: root });
    expect(source.names().sort()).toEqual(["classic", "expanded", "ghostly", "spooky", "vintage"]);
    expect(source.load("spooky").text.social.cafe.title).toBe("Ghost Horse Cafe");
    expect(source.load("classic").text.social.cafe.title).toBe("Pale Horse Cafe");
    expect(() => source.load("nope")).toThrow(/Unknown content pack/);
  });

  it("fails with the directory, file and entry named when a pack is broken", () => {
    writePack("good", "good", "Fine Cafe");
    writePack("bad", "bad", "Bad Cafe", { "events.yaml": "ranges: 5\n" });
    mkdirSync(join(root, "empty"));
    expect(() => loadPacksDirectory(root)).toThrow(ContentPacksError);
    try {
      loadPacksDirectory(root);
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toMatch(/FQ_PACKS_DIR .* has 2 invalid content packs/);
      expect(message).toContain("bad/events.yaml");
      expect(message).toContain("pack.yaml is missing");
      expect(message).not.toContain("good");
    }
  });

  it("refuses built-in names, duplicate ids and a path that is not a directory", () => {
    writePack("a", "classic", "X Cafe");
    expect(() => loadPacksDirectory(root)).toThrow(/id "classic" is a built-in pack/);
    rmSync(join(root, "a"), { recursive: true });
    writePack("b", "twin", "X Cafe");
    writePack("c", "twin", "Y Cafe");
    expect(() => loadPacksDirectory(root)).toThrow(/id "twin" is already used by .*b/);
    expect(() => loadPacksDirectory(join(root, "missing"))).toThrow(/is not a directory/);
  });

  it("stops the server at start-up with a clear error", async () => {
    writePack("bad", "bad", "Bad Cafe", { "events.yaml": "ranges: 5\n" });
    await expect(startServer({ config: { packsDir: root } })).rejects.toThrow(
      /FQ_PACKS_DIR .*bad\/events\.yaml/s,
    );
    await expect(startServer({ config: { packsDir: join(root, "missing") } })).rejects.toThrow(
      /is not a directory/,
    );
  });

  it("lets a town use a disk pack: set at creation, switched through the admin API, played", async () => {
    writePack("spooky-dir", "spooky", "Ghost Horse Cafe");
    h = await startServer({ config: { packsDir: root } });
    const admin = (method: "GET" | "POST" | "PUT", url: string, body?: unknown) =>
      h?.inject({
        method,
        url,
        headers: {
          authorization: `Bearer ${ADMIN_TOKEN}`,
          ...(body ? { "content-type": "application/json" } : {}),
        },
        ...(body ? { payload: JSON.stringify(body) } : {}),
      });

    const listed = await admin("GET", "/admin/server");
    expect(listed?.statusCode, listed?.body).toBe(200);
    expect(JSON.parse(listed?.body ?? "{}").contentPacks).toEqual([
      "classic",
      "vintage",
      "expanded",
      "spooky",
    ]);

    const created = await admin("POST", "/admin/towns", {
      id: "haunt",
      name: "Haunt",
      contentPack: "spooky",
    });
    expect(created?.statusCode, created?.body).toBe(201);
    expect(h.server.host.get("haunt")?.contentPack).toBe("spooky");

    const unknown = await admin("PUT", "/admin/towns/main/content-pack", { contentPack: "nope" });
    expect(unknown?.statusCode).toBe(422);
    const switched = await admin("PUT", "/admin/towns/main/content-pack", {
      contentPack: "spooky",
    });
    expect(switched?.statusCode, switched?.body).toBe(200);
    expect(h.server.host.get("main")?.info().contentPack).toBe("spooky");

    // The new text is what a player sees in the cafe.
    const p = await new TestPlayer(h, "skelly").signUp();
    await p.enter();
    await toDesk(p);
    await p.press("go:map");
    const r = await p.act({ type: "visit", placeId: "cafe" });
    expect(r.status).toBe(200);
    expect(r.body.view.title).toBe("Ghost Horse Cafe");
    expect(richTextToPlain(r.body.view.text)).toContain("Pale Horse");
  });

  it("refuses to start when a stored town needs a pack that is gone", async () => {
    writePack("spooky-dir", "spooky", "Ghost Horse Cafe");
    h = await startServer({
      config: { packsDir: root },
      towns: [{ id: "main", seed: 1, contentPack: "spooky" }],
    });
    await expect(h.restart({ packsDir: "" })).rejects.toThrow(
      /Town "main" uses content pack "spooky", which is not available/,
    );
    h = null;
  });
});
