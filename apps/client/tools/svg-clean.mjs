/**
 * Pure helpers that turn an exported Flash-art SVG into a clean UI piece: remove the baked-in
 * placeholder text, remove shapes that the client draws live instead (plaque buttons, gauge
 * fills), and crop to a new viewBox. The exported SVGs are flat lists of `<path>` and `<text>`
 * elements with absolute sprite coordinates, which is all this needs to understand.
 */

/** @typedef {{ x: number, y: number, w: number, h: number }} Box */

const NUM = /[+-]?(?:\d*\.\d+|\d+\.?)(?:e[+-]?\d+)?/gi;

/**
 * Bounding box of a path made of M L H V Q T Z (any case), the commands the exporter emits.
 * Quadratic control points are included, so the box is a (slightly generous) upper bound.
 * @param {string} d
 * @returns {Box | null}
 */
export function pathBox(d) {
  const tokens = d.match(/[a-zA-Z]|[+-]?(?:\d*\.\d+|\d+\.?)(?:e[+-]?\d+)?/g) ?? [];
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const add = (px, py) => {
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  };
  let i = 0;
  let cmd = "";
  const take = (n) => {
    const out = [];
    for (let k = 0; k < n; k++) out.push(Number(tokens[i++]));
    return out;
  };
  const isNum = (t) => t !== undefined && /^[+-]?[\d.]/.test(t);
  while (i < tokens.length) {
    if (!isNum(tokens[i])) cmd = tokens[i++] ?? "";
    else if (cmd === "m") cmd = "l";
    else if (cmd === "M") cmd = "L";
    const rel = cmd === cmd.toLowerCase();
    switch (cmd.toUpperCase()) {
      case "M":
      case "L": {
        const [a = 0, b = 0] = take(2);
        x = rel ? x + a : a;
        y = rel ? y + b : b;
        if (cmd.toUpperCase() === "M") {
          startX = x;
          startY = y;
        }
        add(x, y);
        break;
      }
      case "H": {
        const [a = 0] = take(1);
        x = rel ? x + a : a;
        add(x, y);
        break;
      }
      case "V": {
        const [a = 0] = take(1);
        y = rel ? y + a : a;
        add(x, y);
        break;
      }
      case "Q": {
        const [cx = 0, cy = 0, a = 0, b = 0] = take(4);
        add(rel ? x + cx : cx, rel ? y + cy : cy);
        x = rel ? x + a : a;
        y = rel ? y + b : b;
        add(x, y);
        break;
      }
      case "T": {
        const [a = 0, b = 0] = take(2);
        x = rel ? x + a : a;
        y = rel ? y + b : b;
        add(x, y);
        break;
      }
      case "Z":
        x = startX;
        y = startY;
        break;
      default:
        // An unknown command: skip a token so the loop always advances.
        i++;
    }
  }
  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** True when `inner` lies inside `outer`, with `slack` units of tolerance on every side. */
export function boxInside(inner, outer, slack = 0.6) {
  return (
    inner.x >= outer.x - slack &&
    inner.y >= outer.y - slack &&
    inner.x + inner.w <= outer.x + outer.w + slack &&
    inner.y + inner.h <= outer.y + outer.h + slack
  );
}

/** Removes every `<text>` element (with its `<tspan>`s). Returns the new markup. */
export function stripText(svg) {
  return svg.replace(/<text\b[^>]*?(?:\/>|>[\s\S]*?<\/text>)/g, "");
}

/** The number of `<text>` elements left in a document. */
export function countText(svg) {
  return (svg.match(/<text\b/g) ?? []).length;
}

/** Splits out each top-level `<path .../>` with its parsed box. */
export function listPaths(svg) {
  const out = [];
  const re = /<path\b[^>]*?\/>/g;
  for (const m of svg.matchAll(re)) {
    const d = /\sd="([^"]*)"/.exec(m[0])?.[1];
    const fill = /\sfill="([^"]*)"/.exec(m[0])?.[1] ?? "";
    const stroke = /\sstroke="([^"]*)"/.exec(m[0])?.[1] ?? "";
    out.push({ markup: m[0], index: m.index ?? 0, fill, stroke, box: d ? pathBox(d) : null });
  }
  return out;
}

/**
 * Removes every path that lies wholly inside any of `boxes`. Returns markup and count.
 * With `unfilledOnly`, only paths with no `fill` attribute go: the exporter draws baked-in
 * caption lettering as outlines with the default (black) fill, while art has explicit fills.
 */
export function removePathsInside(svg, boxes, slack = 0.6, unfilledOnly = false) {
  let removed = 0;
  const next = svg.replace(/<path\b[^>]*?\/>/g, (markup) => {
    const d = /\sd="([^"]*)"/.exec(markup)?.[1];
    const box = d ? pathBox(d) : null;
    if (unfilledOnly && /\sfill="/.test(markup)) return markup;
    if (box && boxes.some((b) => boxInside(box, b, slack))) {
      removed++;
      return "";
    }
    return markup;
  });
  return { svg: next, removed };
}

/** Rewrites the root element's viewBox, width and height to crop (or extend) the drawing. */
export function setViewBox(svg, [x, y, w, h]) {
  return svg.replace(
    /<svg\b([^>]*)>/,
    (_m, attrs) =>
      `<svg${attrs
        .replace(/\s(?:width|height|viewBox)="[^"]*"/g, "")
        .replace(/\s+$/, "")} width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}">`,
  );
}

/**
 * Pulls one embedded `<image id="...">` out of a drawing into a standalone SVG, for textures
 * (the brick wall) that must repeat over areas the original drawing never covered.
 */
export function extractImage(svg, id) {
  const m = new RegExp(`<image\\b[^>]*\\bid="${id}"[^>]*>`).exec(svg);
  if (!m) throw new Error(`no <image id="${id}">`);
  const w = /\swidth="([\d.]+)"/.exec(m[0])?.[1];
  const h = /\sheight="([\d.]+)"/.exec(m[0])?.[1];
  const href = /\shref="([^"]*)"/.exec(m[0])?.[1];
  if (!w || !h || !href) throw new Error(`image ${id} is incomplete`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><image width="${w}" height="${h}" href="${href}"/></svg>`;
}

/** Makes the drawing stretch to whatever box it is given (for art drawn to fill the screen). */
export function stretch(svg) {
  return svg.replace(/<svg\b(?![^>]*preserveAspectRatio)/, '<svg preserveAspectRatio="none"');
}

/** Drops the `<title>`, which would otherwise be announced by some assistive technology. */
export function stripTitle(svg) {
  return svg.replace(/<title>[\s\S]*?<\/title>/, "");
}

/** A path's literal numbers, for tests. */
export const numbers = (s) => (s.match(NUM) ?? []).map(Number);

/**
 * Applies one recipe to an exported SVG: `{ viewBox?, removeText?, removeInside?, }`.
 * `removeInside` boxes are in the SVG's own coordinates and are applied before cropping.
 */
export function deriveUiSvg(svg, recipe = {}) {
  let out = recipe.extractImage ? extractImage(svg, recipe.extractImage) : svg;
  const report = { textRemoved: 0, pathsRemoved: 0 };
  if (recipe.stripText !== false) {
    report.textRemoved = (out.match(/<text\b/g) ?? []).length;
    out = stripText(out);
  }
  if (recipe.removeInside?.length) {
    const r = removePathsInside(out, recipe.removeInside);
    out = r.svg;
    report.pathsRemoved = r.removed;
  }
  if (recipe.removeCaptionsInside?.length) {
    const r = removePathsInside(out, recipe.removeCaptionsInside, 0.6, true);
    out = r.svg;
    report.pathsRemoved += r.removed;
  }
  if (recipe.viewBox) out = setViewBox(out, recipe.viewBox);
  if (recipe.stretch) out = stretch(out);
  out = stripTitle(out);
  return { svg: out, report };
}
