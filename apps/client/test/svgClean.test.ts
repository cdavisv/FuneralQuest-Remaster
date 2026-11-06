import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  boxInside,
  countText,
  deriveUiSvg,
  extractImage,
  listPaths,
  pathBox,
  removePathsInside,
  setViewBox,
  stretch,
  stripText,
} from "../tools/svg-clean.mjs";
import { CLASSIC_UI } from "../tools/ui-art.config.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const assetsUi = join(here, "../../../assets/classic/ui");
const derivedUi = join(here, "../src/art/packs/classic/ui");

describe("pathBox", () => {
  it("handles absolute and relative lines", () => {
    expect(pathBox("M10 20L30 20 30 50z")).toEqual({ x: 10, y: 20, w: 20, h: 30 });
    expect(pathBox("m10 20 20 0 0 30z")).toEqual({ x: 10, y: 20, w: 20, h: 30 });
  });

  it("handles H V and quadratic curves (control points count)", () => {
    expect(pathBox("M0 0H10V5H0z")).toEqual({ x: 0, y: 0, w: 10, h: 5 });
    expect(pathBox("M0 0q5-10 10 0")).toEqual({ x: 0, y: -10, w: 10, h: 10 });
  });

  it("reads compact numbers such as .5.5 and negative runs", () => {
    expect(pathBox("m-.5-.5 1 1")).toEqual({ x: -0.5, y: -0.5, w: 1, h: 1 });
  });

  it("returns null for an empty path", () => {
    expect(pathBox("")).toBeNull();
  });
});

describe("stripping placeholder text", () => {
  const sample =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><title>x</title>' +
    '<path fill="#fff" d="M0 0h10v10H0z"/>' +
    '<text font-size="12"><tspan x="1" y="2">temptext</tspan></text>' +
    "<text><tspan>test</tspan><tspan>test</tspan></text></svg>";

  it("removes every text element and everything inside it", () => {
    const out = stripText(sample);
    expect(countText(out)).toBe(0);
    expect(out).not.toContain("temptext");
    expect(out).not.toContain("tspan");
    expect(out).toContain("<path");
  });

  it("removes only the paths wholly inside the given boxes", () => {
    const svg =
      '<svg><path d="M0 0h10v10H0z"/><path fill="#000" d="M20 20h5v5h-5z"/><path d="M0 0h100v5H0z"/></svg>';
    const { svg: out, removed } = removePathsInside(svg, [{ x: 19, y: 19, w: 8, h: 8 }]);
    expect(removed).toBe(1);
    expect(listPaths(out)).toHaveLength(2);
    expect(boxInside({ x: 1, y: 1, w: 2, h: 2 }, { x: 0, y: 0, w: 5, h: 5 })).toBe(true);
    expect(boxInside({ x: 1, y: 1, w: 9, h: 2 }, { x: 0, y: 0, w: 5, h: 5 })).toBe(false);
  });

  it("can remove only unfilled paths (caption lettering) and leave filled art alone", () => {
    const svg = '<svg><path d="M1 1h2v2H1z"/><path fill="#c00" d="M1 1h2v2H1z"/></svg>';
    const { svg: out, removed } = removePathsInside(svg, [{ x: 0, y: 0, w: 5, h: 5 }], 0.6, true);
    expect(removed).toBe(1);
    expect(out).toContain('fill="#c00"');
  });

  it("crops by rewriting viewBox, width and height, and drops the title", () => {
    expect(setViewBox(sample, [1, 2, 3, 4])).toMatch(
      /<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="3" height="4" viewBox="1 2 3 4">/,
    );
    const { svg } = deriveUiSvg(sample, { viewBox: [0, 0, 5, 5] });
    expect(svg).not.toContain("<title>");
    expect(svg).not.toContain("temptext");
  });

  it("stretch sets preserveAspectRatio none once", () => {
    const out = stretch(stretch("<svg width='1'></svg>"));
    expect(out.match(/preserveAspectRatio/g)).toHaveLength(1);
  });

  it("extractImage lifts an embedded texture into its own svg", () => {
    const svg =
      '<svg><defs><image id="d1" width="96" height="48" href="data:image/jpeg;base64,AAAA"/></defs></svg>';
    const out = extractImage(svg, "d1");
    expect(out).toContain('viewBox="0 0 96 48"');
    expect(out).toContain('href="data:image/jpeg;base64,AAAA"');
  });
});

describe("the exported originals", () => {
  it("really do carry the placeholder text the pipeline exists to remove", () => {
    const main = readFileSync(join(assetsUi, "cabinet-main.svg"), "utf8");
    expect(main).toContain("temptext");
    expect(countText(main)).toBeGreaterThan(5);
  });

  it("every derived Classic piece is free of text elements and placeholder words", () => {
    for (const [name, recipe] of Object.entries(CLASSIC_UI)) {
      const derived = readFileSync(join(derivedUi, `${name}.svg`), "utf8");
      expect(countText(derived), name).toBe(0);
      expect(derived, name).not.toMatch(/temptext|<tspan|>test</);
      // And the derive step is reproducible from the untouched source.
      const source = readFileSync(join(assetsUi, `${recipe.from}.svg`), "utf8");
      expect(deriveUiSvg(source, recipe).svg, name).toBe(derived);
    }
  });

  it("removes the baked plaque buttons, class and mood captions and sample tube fill", () => {
    const source = readFileSync(join(assetsUi, "cabinet-main.svg"), "utf8");
    const { report } = deriveUiSvg(source, CLASSIC_UI["cabinet-main"]);
    expect(report.textRemoved).toBe(15);
    // 5 plaques, the luck tube fill, the Class/Mood captions and the Exit button.
    expect(report.pathsRemoved).toBeGreaterThanOrEqual(30);
  });
});
