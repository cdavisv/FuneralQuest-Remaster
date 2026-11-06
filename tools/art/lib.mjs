/**
 * The Remastered parts library: small helpers for writing SVG by hand in code. Nothing here
 * draws a picture on its own; the pieces under tools/art/pieces/ do, and build.mjs writes each
 * one out as a clean standalone SVG (no external references, no bitmaps, no fonts).
 */

/** Round to one decimal (or `d` decimals) and drop trailing zeros. */
export const n = (v, d = 1) => {
  const k = 10 ** d;
  const r = Math.round(v * k) / k;
  return Object.is(r, -0) ? "0" : String(r);
};

/** A deterministic random stream (mulberry32), so a piece draws the same every build. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => Math.floor(lo + (hi - lo + 1) * next()),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
  };
}

/** SVG attributes that are camelCase in the spec (everything else is kebab-cased). */
const CAMEL = new Set([
  "gradientUnits",
  "gradientTransform",
  "stdDeviation",
  "viewBox",
  "preserveAspectRatio",
  "clipPathUnits",
  "patternUnits",
  "spreadMethod",
]);

/** Attributes object to a string; undefined and null are skipped, numbers rounded. */
export function attrs(o = {}) {
  return Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => {
      const key = CAMEL.has(k) ? k : k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      return `${key}="${typeof v === "number" ? n(v, 2) : v}"`;
    })
    .join(" ");
}

export const el = (tag, a, inner) =>
  inner === undefined || inner === ""
    ? `<${tag} ${attrs(a)}/>`
    : `<${tag} ${attrs(a)}>${inner}</${tag}>`;

/** Shorthands. `o` is extra attributes: stroke, strokeWidth, opacity, transform... */
export const path = (d, fill, o = {}) => el("path", { d, fill, ...o });
export const rect = (x, y, w, h, fill, o = {}) =>
  el("rect", { x, y, width: w, height: h, fill, ...o });
export const ellipse = (cx, cy, rx, ry, fill, o = {}) =>
  el("ellipse", { cx, cy, rx, ry, fill, ...o });
export const circle = (cx, cy, r, fill, o = {}) => el("circle", { cx, cy, r, fill, ...o });
export const g = (inner, o = {}) => el("g", o, Array.isArray(inner) ? inner.join("") : inner);
export const line = (x1, y1, x2, y2, stroke, w = 1, o = {}) =>
  el("path", {
    d: `M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}`,
    fill: "none",
    stroke,
    strokeWidth: w,
    ...o,
  });

/** Polygon path from [[x,y],...]. */
export const poly = (pts, close = true) =>
  `M${pts.map(([x, y]) => `${n(x)} ${n(y)}`).join("L")}${close ? "Z" : ""}`;

/**
 * A smooth path through points (Catmull-Rom converted to cubic Beziers). `t` is the tension
 * (0.5 is the usual; lower is tighter).
 */
export function smooth(pts, closed = true, t = 0.5) {
  const p = pts;
  const len = p.length;
  if (len < 2) return "";
  const at = (i) => (closed ? p[(i + len) % len] : p[Math.max(0, Math.min(len - 1, i))]);
  let d = `M${n(p[0][0])} ${n(p[0][1])}`;
  const segs = closed ? len : len - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1 = [p1[0] + ((p2[0] - p0[0]) * t) / 3, p1[1] + ((p2[1] - p0[1]) * t) / 3];
    const c2 = [p2[0] - ((p3[0] - p1[0]) * t) / 3, p2[1] - ((p3[1] - p1[1]) * t) / 3];
    d += `C${n(c1[0])} ${n(c1[1])} ${n(c2[0])} ${n(c2[1])} ${n(p2[0])} ${n(p2[1])}`;
  }
  return closed ? `${d}Z` : d;
}

/** An organic closed blob around (cx, cy): radius r, n lobes, wobble 0..1. */
export function blob(cx, cy, rx, ry, R, count = 9, wobble = 0.25, rot = 0) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    const a = rot + (i / count) * Math.PI * 2;
    const k = 1 - wobble / 2 + R.next() * wobble;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return smooth(pts, true);
}

/**
 * A scalloped canopy edge (foliage, curly hair, cloud tops): bumps along the points of a
 * closed outline, each bump bulging outward by `bump` times the segment length.
 */
export function scallop(pts, bump = 0.45, R = null) {
  const len = pts.length;
  let d = `M${n(pts[0][0])} ${n(pts[0][1])}`;
  // centroid for outward direction
  const cx = pts.reduce((s, p) => s + p[0], 0) / len;
  const cy = pts.reduce((s, p) => s + p[1], 0) / len;
  for (let i = 0; i < len; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % len];
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    let nx = -(b[1] - a[1]);
    let ny = b[0] - a[0];
    // point the normal away from the centroid
    if (nx * (mx - cx) + ny * (my - cy) < 0) {
      nx = -nx;
      ny = -ny;
    }
    const k = bump * (R ? 0.7 + R.next() * 0.6 : 1);
    d += `Q${n(mx + nx * k)} ${n(my + ny * k)} ${n(b[0])} ${n(b[1])}`;
  }
  return `${d}Z`;
}

/** Gradient registry for one picture. `id()` makes unique ids; `defs()` writes them out. */
export class Defs {
  constructor(prefix = "g") {
    this.prefix = prefix;
    this.items = [];
    this.count = 0;
  }
  id() {
    this.count += 1;
    return `${this.prefix}${this.count}`;
  }
  /** Linear gradient in user space from (x1,y1) to (x2,y2). stops: [[offset, color, opacity?]]. */
  lg(x1, y1, x2, y2, stops) {
    const id = this.id();
    const s = stops
      .map(([o, c, op]) =>
        el("stop", { offset: o, stopColor: c, stopOpacity: op === undefined ? undefined : op }),
      )
      .join("");
    this.items.push(
      el("linearGradient", { id, gradientUnits: "userSpaceOnUse", x1, y1, x2, y2 }, s),
    );
    return `url(#${id})`;
  }
  /** Radial gradient in user space. */
  rg(cx, cy, r, stops, o = {}) {
    const id = this.id();
    const s = stops
      .map(([off, c, op]) =>
        el("stop", { offset: off, stopColor: c, stopOpacity: op === undefined ? undefined : op }),
      )
      .join("");
    this.items.push(
      el("radialGradient", { id, gradientUnits: "userSpaceOnUse", cx, cy, r, ...o }, s),
    );
    return `url(#${id})`;
  }
  /** A clip path; returns the url() for clip-path. */
  clip(inner) {
    const id = this.id();
    this.items.push(el("clipPath", { id }, inner));
    return `url(#${id})`;
  }
  /** A Gaussian blur filter (used sparingly: fog and glow only). */
  blur(sd) {
    const id = this.id();
    this.items.push(
      el(
        "filter",
        { id, x: "-50%", y: "-50%", width: "200%", height: "200%" },
        el("feGaussianBlur", { stdDeviation: sd }),
      ),
    );
    return `url(#${id})`;
  }
  toString() {
    return this.items.length ? `<defs>${this.items.join("")}</defs>` : "";
  }
}

/** Wrap a body into a standalone SVG document. */
export function doc({ title, body, defs, w = 550, h = 400, vb }) {
  const viewBox = vb ?? `0 0 ${w} ${h}`;
  const t = title ? `<title>${title.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</title>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${viewBox}">${t}${defs ? defs.toString() : ""}${body}</svg>\n`;
}

/** Linear interpolation of two hex colours. */
export function mix(a, b, t) {
  const pa = hex(a);
  const pb = hex(b);
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
function hex(c) {
  let s = c.replace("#", "");
  if (s.length === 3) s = s.replace(/./g, (x) => x + x);
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
}
export const shade = (c, k) => mix(c, "#000000", k);
export const tint = (c, k) => mix(c, "#ffffff", k);

/** One-point perspective: a point on a plane at depth z (0 = picture plane) toward vp. */
export function persp(vp, x, y, z) {
  const s = 1 / (1 + z);
  return [vp[0] + (x - vp[0]) * s, vp[1] + (y - vp[1]) * s];
}
