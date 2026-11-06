import { optimizeSvg } from "./optimize.js";
import { Renderer, type RenderResult, svgDocument } from "./render.js";
import type { Swf } from "./swf.js";
import { animationLength } from "./timeline.js";

export interface RenderedPicture {
  width: number;
  height: number;
  svg: string;
  frames: string[];
  usesBitmaps: boolean;
  paths: number;
  bounds: RenderResult["bounds"];
  frameCount: number;
}

/** Longest animation we export, in frames (the longest original is the 145-frame wait screen). */
export const MAX_FRAMES = 150;

/** Number of frames to export: the root frames, or the longest sprite animation for one-frame movies. */
export function pictureFrames(swf: Swf): number {
  const n = animationLength(swf.root, (id) => {
    const c = swf.characters.get(id);
    return c?.type === "sprite" ? c.timeline : undefined;
  });
  return Math.max(1, Math.min(MAX_FRAMES, n));
}

export function stageSize(swf: Swf): { width: number; height: number } {
  const f = swf.header.frameSize;
  return { width: (f.xMax - f.xMin) / 20, height: (f.yMax - f.yMin) / 20 };
}

/**
 * Renders the stage of a picture SWF. Frame 1 is the picture; when the movie has more frames
 * every frame is returned too. No background rectangle: the pictures are drawn over the game
 * frame, so the SWF background colour is recorded in the manifest instead.
 */
export function renderPicture(swf: Swf, title: string, optimise = true): RenderedPicture {
  const { width, height } = stageSize(swf);
  const n = pictureFrames(swf);
  const frames: string[] = [];
  let first: RenderResult | undefined;
  let firstSvg = "";
  let usesBitmaps = false;
  for (let i = 0; i < n; i++) {
    const r = new Renderer(swf).renderFrame(swf.root, i);
    const doc = svgDocument(r, width, height, {
      title: i === 0 ? title : `${title} frame ${i + 1}`,
    });
    const out = optimise ? optimizeSvg(doc) : doc;
    if (i === 0) {
      first = r;
      firstSvg = out;
    }
    if (r.usesBitmaps) usesBitmaps = true;
    frames.push(out);
  }
  if (!first) {
    const r = new Renderer(swf).renderFrame(swf.root, 0);
    first = r;
    firstSvg = svgDocument(r, width, height, { title });
  }
  return {
    width,
    height,
    svg: firstSvg,
    frames: n > 1 ? frames : [],
    usesBitmaps,
    paths: first.paths,
    bounds: first.bounds,
    frameCount: n,
  };
}
