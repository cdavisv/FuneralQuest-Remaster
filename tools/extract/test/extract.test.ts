import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { decompile } from "../src/as1.js";
import { assetId, categoryOf, legacyUrlVariants } from "../src/ids.js";
import { Renderer } from "../src/render.js";
import { shapePaintOps } from "../src/shape.js";
import { parseHeader, parseSwf } from "../src/swf.js";

const flash = path.resolve(import.meta.dirname, "../../../legacy/dist/public/flash");
const load = (rel: string): Uint8Array => new Uint8Array(readFileSync(path.join(flash, rel)));

describe("asset ids", () => {
  it("follows the rule in CLAUDE.md", () => {
    expect(assetId("flash\\places\\bank.swf")).toBe("places/bank");
    expect(assetId("flash/wait.swf")).toBe("wait");
    expect(assetId("flash/Ring/ring&hand.swf")).toBe("ring/ring&hand");
    expect(assetId("places/funeral_home(black).swf")).toBe("places/funeral_home(black)");
  });

  it("derives categories and every URL spelling", () => {
    expect(categoryOf("places/bank")).toBe("places");
    expect(categoryOf("wait")).toBe("misc");
    const v = legacyUrlVariants("Ring/ring.swf");
    expect(v).toContain("flash\\Ring\\ring.swf");
    expect(v).toContain("flash/ring/ring.swf");
    for (const u of v) expect(assetId(u)).toBe("ring/ring");
  });
});

describe("SWF parser", () => {
  it("reads the header of an uncompressed Flash 5 file", () => {
    const { header } = parseHeader(load("stuff/padlock.swf"));
    expect(header.signature).toBe("FWS");
    expect(header.version).toBe(5);
    expect(header.fileLength).toBe(582);
    expect(header.frameSize).toEqual({ xMin: 0, xMax: 11000, yMin: 0, yMax: 8000 });
    expect(header.frameRate).toBe(20);
    expect(header.frameCount).toBe(1);
  });

  it("rejects things that are not SWF", () => {
    expect(() => parseHeader(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow();
  });

  it("decodes the padlock shape into nine fills and one stroke group", () => {
    const swf = parseSwf(load("stuff/padlock.swf"));
    const ch = swf.characters.get(1);
    expect(ch?.type).toBe("shape");
    if (ch?.type !== "shape") return;
    const ops = shapePaintOps(ch.def);
    expect(ops.filter((o) => o.kind === "fill")).toHaveLength(9);
    const line = ops.find((o) => o.kind === "line");
    expect(line?.loops).toHaveLength(9);
  });

  it("renders every picture to SVG path data", () => {
    const swf = parseSwf(load("stuff/padlock.swf"));
    const r = new Renderer(swf).renderFrame(swf.root, 0);
    expect(r.paths).toBe(10);
    expect(r.body).toContain("<path");
    expect(r.bounds?.x1).toBeLessThanOrEqual(551);
  });

  it("finds the frame labels and exports of welcome.swf", () => {
    const swf = parseSwf(load("welcome.swf"));
    expect(swf.root.frames.map((f) => f.label).filter(Boolean)).toContain("f_main");
    expect(swf.exports.map((e) => e.name)).toEqual(["paper", "Map", "intro"]);
  });
});

describe("ActionScript decompiler", () => {
  it("folds a conditional jump into an if block", () => {
    // Push "a"; GetVariable; Not; If +skip; Push "b", Push 1; SetVariable (b = 1); (end)
    const push = (s: string): number[] => {
      const bytes = [...Buffer.from(`${s}\0`, "latin1")];
      return [0x96, bytes.length + 1, 0, 0, ...bytes];
    };
    const body = [...push("b"), 0x96, 5, 0, 7, 1, 0, 0, 0, 0x1d];
    const code = [...push("a"), 0x1c, 0x12, 0x9d, 2, 0, body.length, 0];
    const text = decompile(new Uint8Array([...code, ...body, 0]));
    expect(text).toBe("if (a) {\n  b = 1;\n}");
  });
});
