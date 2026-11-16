/**
 * The larger Deathville map of an Expanded town: the 2001 map with the town grown east and south
 * to make room for the twelve places Expanded adds, each drawn at the size of the originals.
 *
 * The 2001 base map (assets/classic/ui/deathville-map-base.svg, the Classic art) is kept whole:
 * every one of its paths, unchanged and in its place, with its two textures. Around it:
 *   - new streets whose kerbs continue the original's road edges where they leave the old map
 *     (the same direction at the seam), so the roads sweep on in the original's curves;
 *   - new lots in the original's pavement texture, over the original's kerb (a flat #999 band
 *     offset down and right), the roads in its road texture;
 *   - ground detail made of the original's own pieces: its parked cars, its row of sheds and its
 *     top-left park, mirrored into the two new bottom corners;
 *   - new lawns with leafy hedges and white walks in the original's colours, and a hedge where the
 *     old map's edge cut through the graveyard park;
 *   - the frame stretched to the new size and the caption moved onto the new boulevard.
 * So the file holds original art as well as new drawing: the manifest says so, and check.mjs lets
 * it embed bitmaps only because they are the 2001 map's own textures, byte for byte.
 *
 * Where each place stands is the Remastered pack's `expandedMap` (apps/client/src/art/packs/
 * remastered/pack.json); the client lays the buildings over this picture.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { rng } from "../lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");
export const SOURCE = "assets/classic/ui/deathville-map-base.svg";

/** Units added east and south of the 2001 map (452 x 343). */
const E = 300;
const S = 190;
export const VIEWBOX = [-244, -275, 452 + E, 343 + S];

// The 2001 map's paths by their place in the file (the extractor writes them in drawing order).
const CAPTION = [221, 222];
const FRAME = { 270: "left", 271: "right", 272: "bottom", 273: "top" };
const PARK = [...Array.from({ length: 51 }, (_, i) => 12 + i), 196];
const CARS = Array.from({ length: 14 }, (_, i) => 207 + i);
// The sheds' white walls and grey outlines are parts of larger shapes, so they are clipped to the
// sheds' corner of the parking lot (SHED_CLIP, in the 2001 map's units).
const SHEDS = [197, 198, 199, 200, 201, 202, 203, 204, 206];
const SHED_CLIP = [-160, -58, 54, 50];

function original() {
  const src = readFileSync(join(root, SOURCE), "utf8");
  const [head, rest] = src.split("</defs>");
  const defs = `${head.slice(head.indexOf("<defs>"))}</defs>`;
  const body = rest.slice(0, rest.lastIndexOf("</svg>"));
  const paths = body.match(/<path\b[^>]*\/>/g) ?? [];
  if (paths.length !== 274 || paths.join("") !== body.trim()) {
    throw new Error(`${SOURCE}: expected 274 paths and nothing else`);
  }
  // Guards that the indices still name what they did.
  if (!paths[270].includes("url(#d23)") || !paths[273].includes("url(#d26)")) {
    throw new Error(`${SOURCE}: the frame is not the last four paths`);
  }
  if (!paths[216].includes('fill="#900"') || !paths[203].includes('fill="#366"')) {
    throw new Error(`${SOURCE}: the cars and sheds moved`);
  }
  if (!paths[13].includes('fill="#a2b66d"')) throw new Error(`${SOURCE}: the park moved`);
  return { defs, paths };
}

// ------------------------------------------------------------------ geometry helpers
const r2 = (v) => {
  const s = (Math.round(v * 100) / 100).toString();
  return s === "-0" ? "0" : s;
};
const P = (p) => `${r2(p[0])} ${r2(p[1])}`;
const r1 = (v) => {
  const s = (Math.round(v * 10) / 10).toString();
  return s === "-0" ? "0" : s;
};
/** A point to one decimal, for the many small leaves. */
const P1 = (p) => `${r1(p[0])} ${r1(p[1])}`;

/** A path built from lines, curves and smooth runs (Catmull-Rom with optional end tangents). */
class Pen {
  constructor(start) {
    this.d = `M${P(start)}`;
    this.at = start;
  }
  line(p) {
    this.d += `L${P(p)}`;
    this.at = p;
    return this;
  }
  quad(c, p) {
    this.d += `Q${P(c)} ${P(p)}`;
    this.at = p;
    return this;
  }
  curve(c1, c2, p) {
    this.d += `C${P(c1)} ${P(c2)} ${P(p)}`;
    this.at = p;
    return this;
  }
  smooth(pts, t0, t1) {
    const all = [this.at, ...pts];
    for (let i = 0; i < all.length - 1; i++) {
      const a = all[i];
      const b = all[i + 1];
      const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const p0 = all[i - 1] ?? a;
      const p3 = all[i + 2] ?? b;
      const c1 =
        i === 0 && t0
          ? [a[0] + (t0[0] * seg) / 3, a[1] + (t0[1] * seg) / 3]
          : [a[0] + (b[0] - p0[0]) / 6, a[1] + (b[1] - p0[1]) / 6];
      const c2 =
        i === all.length - 2 && t1
          ? [b[0] - (t1[0] * seg) / 3, b[1] - (t1[1] * seg) / 3]
          : [b[0] - (p3[0] - a[0]) / 6, b[1] - (p3[1] - a[1]) / 6];
      this.curve(c1, c2, b);
    }
    return this;
  }
  close() {
    return `${this.d}Z`;
  }
}

const unit = (dx, dy) => {
  const l = Math.hypot(dx, dy);
  return [dx / l, dy / l];
};

/** The outline's points resampled every `step` units (for leaves spaced evenly round it). */
function densify(pts, step = 3.4) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k++)
      out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}

// ------------------------------------------------------------------ the original's colours
const LAWN = "#a2b66d";
const BUSH = "#4b6d0f";
const LEAVES = [
  "#2c4507",
  "#3f5a0e",
  "#4b6d0f",
  "#4b6d0f",
  "#557313",
  "#678c1e",
  "#698d1c",
  "#61772f",
  "#7c825a",
];
const WALK = "#faf2e8";
const WALK_EDGE = "#7c825a";
const KERB = "#999";

/** One of the original's curled bush leaves: a broad flame with a hooked tip. */
function leaf(x, y, L, W, ang, col) {
  const a = (ang * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const r = (px, py) => [x + px * ca - py * sa, y + px * sa + py * ca];
  return (
    `<path fill="${col}" d="M${P1(r(0, W * 0.5))}C${P1(r(L * 0.2, -W * 1.1))} ${P1(r(L * 0.75, -W * 1.2))} ${P1(r(L, -W * 0.1))}` +
    `C${P1(r(L * 0.8, -W * 0.2))} ${P1(r(L * 0.7, W * 0.3))} ${P1(r(L * 0.55, W * 0.25))}` +
    `C${P1(r(L * 0.4, W * 0.9))} ${P1(r(L * 0.1, W * 1.0))} ${P1(r(0, W * 0.5))}Z"/>`
  );
}

/** A shape's shadow: the original's bushes cast one at 20% black, a little down and right. */
const shadowOf = (d, grow = 0) =>
  `<path fill-opacity=".2" transform="translate(${2.5 + grow} ${3 + grow})" d="${d}"/>`;

/** Leaves along a closed outline, pointing outwards from `centre`, over a band of bush. */
function hedgeRing(pts, centre, R, size = 1) {
  const leaves = [];
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    for (let k = 0; k < 1; k++) {
      const out = (Math.atan2(y - centre[1], x - centre[0]) * 180) / Math.PI;
      leaves.push(
        leaf(
          x + R.range(-1.5, 1.5),
          y + R.range(-1.5, 1.5),
          R.range(6, 10) * size,
          R.range(3, 4.5) * size,
          out + R.range(-80, 80),
          R.pick(LEAVES),
        ),
      );
    }
  }
  return leaves;
}

/**
 * An irregular rounded outline inside a box (a superellipse with a wandering radius), smoothed:
 * the shape of the original's lawns rather than a rectangle.
 */
function lawnShape(x0, y0, x1, y1, R, inset = 0) {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const rx = (x1 - x0) / 2 - inset;
  const ry = (y1 - y0) / 2 - inset;
  const n = Math.max(14, Math.round((rx + ry) / 3));
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    // |c|^(2/4): a squarish ellipse; the wobble keeps it hand-drawn.
    const k = 1 - R.range(0, 0.07);
    pts.push([
      cx + rx * k * Math.sign(c) * Math.abs(c) ** 0.5,
      cy + ry * k * Math.sign(sn) * Math.abs(sn) ** 0.5,
    ]);
  }
  return pts;
}

const closedSmooth = (pts) => {
  const ring = [...pts, pts[0], pts[1]];
  const pen = new Pen(pts[0]);
  pen.smooth(ring.slice(1));
  return pen.close();
};

/** A lawn edged with a hedge of leaves (the original's parks, in small). */
function garden(x0, y0, x1, y1, R, { extra = "" } = {}) {
  const ring = lawnShape(x0, y0, x1, y1, R);
  const leaves = hedgeRing(densify(ring, 2.8), [(x0 + x1) / 2, (y0 + y1) / 2], R);
  const outline = closedSmooth(lawnShape(x0 - 3, y0 - 3, x1 + 3, y1 + 3, rngLike(R)));
  const band = `<path fill="${BUSH}" d="${closedSmooth(ring)}"/>`;
  const lawn = lawnShape(x0, y0, x1, y1, rngLike(R), 3.6);
  return (
    shadowOf(outline) +
    band +
    leaves.join("") +
    `<path fill="${LAWN}" d="${closedSmooth(lawn)}"/>` +
    extra
  );
}

/** A calmer stream for the lawn inside a hedge (its outline wobbles less than the hedge's). */
const rngLike = (R) => ({ ...R, range: (lo, hi) => lo + (hi - lo) * 0.5 * R.next() });

/** A clump of bush: a dark mound covered in leaves turning outwards. */
function bush(x, y, R, size = 1) {
  const rad = 6.5 * size;
  const moundD = closedSmooth(lawnShape(x - rad, y - rad * 0.8, x + rad, y + rad * 0.8, R));
  const mound = `<path fill="${BUSH}" d="${moundD}"/>`;
  const leaves = [];
  for (let k = 0; k < 18; k++) {
    const a = R.range(0, Math.PI * 2);
    const d = R.range(0, rad * 0.75);
    leaves.push(
      leaf(
        x + Math.cos(a) * d,
        y + Math.sin(a) * d * 0.8,
        R.range(5, 8.5) * size,
        R.range(2.6, 4) * size,
        (a * 180) / Math.PI + R.range(-60, 60),
        R.pick(LEAVES),
      ),
    );
  }
  return shadowOf(moundD, 1.5 * size) + mound + leaves.join("");
}

/** A white walk with the cemetery path's olive edge, along a smooth line. */
function walk(pts, w = 4.5) {
  const d = new Pen(pts[0]).smooth(pts.slice(1)).d;
  return (
    `<path d="${d}" fill="none" stroke="${WALK_EDGE}" stroke-width="${w + 2}" stroke-linecap="round" stroke-linejoin="round" transform="translate(1 1.4)"/>` +
    `<path d="${d}" fill="none" stroke="${WALK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`
  );
}

/** Flower beds for the florist: dots of colour on a lawn. */
function flowers(x0, y0, x1, y1, R) {
  const cols = ["#d84a7a", "#f0c419", "#ffffff", "#c43c3c", "#9a5ad0", "#f28c28"];
  let out = "";
  for (let k = 0; k < 46; k++) {
    out += `<circle cx="${r2(R.range(x0, x1))}" cy="${r2(R.range(y0, y1))}" r="${r2(R.range(0.9, 1.6))}" fill="${R.pick(cols)}"/>`;
  }
  return out;
}

/** The original's pieces moved: `box` is their [x0, y0] in the 2001 map, `to` where it goes. */
function place(paths, ids, box, to, { flip = false, scale = 1, w = 0, clip } = {}) {
  const s = scale;
  const t = flip
    ? `matrix(${-s} 0 0 ${s} ${r2(to[0] + w * s + box[0] * s)} ${r2(to[1] - box[1] * s)})`
    : `matrix(${s} 0 0 ${s} ${r2(to[0] - box[0] * s)} ${r2(to[1] - box[1] * s)})`;
  const inner = ids.map((i) => paths[i]).join("");
  return `<g transform="${t}">${clip ? `<g clip-path="url(#${clip})">${inner}</g>` : inner}</g>`;
}

/**
 * The 2001 top-left park (cut by the map's top and left edges), defined once and set into the
 * two new corners, its cut edges on the frame. Its shadow is the original's own shadow shape
 * (path 12), moved so that it still falls down and right of the turned park.
 */
const PARK_SHADOW = 12;
const parkDef = (paths) =>
  `<g id="park">${PARK.filter((i) => i !== PARK_SHADOW)
    .map((i) => paths[i])
    .join("")}</g>`;
function parkInCorner(paths, matrix, shift) {
  return (
    `<g transform="translate(${shift[0]} ${shift[1]})"><g transform="${matrix}">${paths[PARK_SHADOW]}</g></g>` +
    `<use href="#park" transform="${matrix}"/>`
  );
}

/** Where the old map's edge cut through the graveyard park: the park ends in a hedge. */
function seamHedge(x0, x1, y0, y1, R) {
  const n = Math.round((y1 - y0) / 7);
  const ys = Array.from({ length: n + 1 }, (_, i) => y0 + ((y1 - y0) * i) / n);
  const east = ys.map((y, i) => {
    const t = Math.min(1, i / 2, (n - i) / 2);
    return [x0 + (x1 - x0) * t + (i % 2 ? 4 : 0) * t + R.range(-1, 1), y];
  });
  const west = [...ys].reverse().map((y, i) => {
    const t = Math.min(1, i / 2, (n - i) / 2);
    return [x0 - (i % 2 ? 3 : 0) * t + R.range(-0.8, 0.8), y];
  });
  const band = new Pen(east[0]).smooth(east.slice(1)).smooth(west.slice(1)).close();
  const leaves = [];
  for (const y of ys.slice(0, -1)) {
    for (let k = 0; k < 4; k++) {
      const yy = y + R.range(0, 7);
      const t = Math.min(1, (yy - y0) / 12, (y1 - yy) / 12);
      if (t <= 0) continue;
      const ang = R.next() < 0.7 ? R.range(-70, 70) : R.range(110, 250);
      leaves.push(
        leaf(
          R.range(x0 - 5, x0 + (x1 - x0) * t),
          yy,
          R.range(9, 15) * (0.6 + 0.4 * t),
          R.range(4, 6.5) * (0.6 + 0.4 * t),
          ang,
          R.pick(LEAVES),
        ),
      );
    }
  }
  return shadowOf(band, 2) + `<path fill="${BUSH}" d="${band}"/>` + leaves.join("");
}

// ------------------------------------------------------------------ the new town
// The boulevard leaves the old map at x 193 with its lot's edge at y 2.5, running 1 in 13 downhill
// (measured on the 2001 map), and bends gently down to the east.
const ytop = (x) => 2.5 + 0.075 * (x - 193) + 0.00025 * (x - 193) ** 2;
const ybot = (x) => ytop(x) + 62;
const T_BLVD = unit(1, 0.075);
const XE = 193 + E + 6;
const YS = 53 + S + 6;
const YT = -266;
const XW = -235;

function lots() {
  const out = [];
  // A: between the old map and the new north road.
  out.push(
    new Pen([189, YT])
      .line([330, YT])
      .smooth([
        [334, -200],
        [324, -130],
        [314, -60],
        [311, -22],
      ])
      .quad([311, ytop(311)], [290, ytop(290)])
      .smooth(
        [
          [240, ytop(240)],
          [193, ytop(193)],
          [189, ytop(189) - 0.3],
        ],
        undefined,
        [-T_BLVD[0], -T_BLVD[1]],
      )
      .close(),
  );
  // B: east of the north road, above the boulevard.
  out.push(
    new Pen([364, YT])
      .line([XE, YT])
      .line([XE, ytop(XE)])
      .smooth([
        [440, ytop(440)],
        [392, ytop(392)],
        [368, ytop(368)],
      ])
      .quad([345, ytop(345)], [345, -22])
      .smooth([
        [348, -60],
        [358, -130],
        [368, -200],
        [364, YT],
      ])
      .close(),
  );
  // C2: south of the boulevard, east of the south road.
  out.push(
    new Pen([XE, ybot(XE)])
      .line([XE, YS])
      .line([262, YS])
      .smooth([
        [258, 190],
        [252, 140],
        [246, 112],
      ])
      .quad([242, ybot(246) - 2], [272, ybot(272)])
      .smooth([
        [330, ybot(330)],
        [400, ybot(400)],
        [XE, ybot(XE)],
      ])
      .close(),
  );
  // D: the old bottom-left lot, whose edge leaves the map heading down and left, closes off.
  out.push(
    new Pen([XW, 44])
      .line([-140.9, 44])
      .line([-145.3, 48])
      .line([-150.3, 52.9])
      .curve([-161, 63.5], [-190, 86], [XW, 88])
      .close(),
  );
  // C1a: the south-west lot.
  out.push(
    new Pen([XW, 122])
      .smooth([
        [-180, 105],
        [-122, 96],
        [-84, 94],
      ])
      .quad([-58, 93], [-57, 112])
      .smooth([
        [-50, 170],
        [-45, YS],
      ])
      .line([XW, YS])
      .close(),
  );
  // C1b: between the south-west road and the south road.
  out.push(
    new Pen([-12, YS])
      .smooth([
        [-17, 170],
        [-25, 112],
      ])
      .quad([-27, 92], [-6, 92])
      .smooth([
        [60, 91],
        [140, 89],
        [190, 90],
      ])
      .quad([214, 91], [215, 114])
      .smooth([
        [220, 170],
        [224, YS],
      ])
      .close(),
  );
  return out;
}

function render() {
  const { defs, paths } = original();
  const R = rng(1847);
  const frameAt = {
    left: `translate(0 -270.05) scale(1 ${r2((334.05 + S) / 334.05)}) translate(0 270.05)`,
    right: `translate(${E} 0) translate(0 -270.05) scale(1 ${r2((334.05 + S) / 334.05)}) translate(0 270.05)`,
    bottom: `translate(0 ${S}) translate(-242.27 0) scale(${r2((447.61 + E) / 447.61)} 1) translate(242.27 0)`,
    top: `translate(-240.22 0) scale(${r2((444.28 + E) / 444.28)} 1) translate(240.22 0)`,
  };
  const frame = Object.entries(FRAME)
    .map(([i, side]) => `<g transform="${frameAt[side]}">${paths[Number(i)]}</g>`)
    .join("");
  const keep = paths.filter((_, i) => !CAPTION.includes(i) && !(i in FRAME)).join("");
  const L = lots();

  // Ground detail on the new lots (drawn before the buildings the client lays over them).
  const CAR_BOX = [-108, -42];
  const SHED_BOX = [-157, -55];
  const clips = `<defs><clipPath id="shed-clip"><rect x="${SHED_CLIP[0]}" y="${SHED_CLIP[1]}" width="${SHED_CLIP[2]}" height="${SHED_CLIP[3]}"/></clipPath>${parkDef(paths)}</defs>`;
  const detail = [
    // A: the crematorium's sheds, Mourne & Sons' garden with a walk, mourners' cars.
    place(paths, SHEDS, SHED_BOX, [298, -226], { scale: 0.7, clip: "shed-clip" }),
    garden(250, -86, 306, -34, R, {
      extra: walk([
        [255, -40],
        [278, -58],
        [300, -80],
      ]),
    }),
    place(paths, CARS, CAR_BOX, [208, -64]),
    bush(318, -246, R),
    bush(304, -178, R, 0.8),
    // B: City Hall's lawn and walk, the police station's cars.
    garden(370, -160, 486, -128, R, {
      extra: walk(
        [
          [380, -144],
          [428, -150],
          [476, -144],
        ],
        4,
      ),
    }),
    place(paths, CARS, CAR_BOX, [448, -118], { flip: true, w: 37 }),
    bush(352, -240, R),
    bush(372, -36, R, 0.9),
    // C2: the florist's beds, the club's car park, a bush.
    garden(268, 196, 338, 232, R),
    place(paths, CARS, CAR_BOX, [352, 194]),
    bush(258, 112, R, 0.8),
    // C1a: the pawn shop's sheds and a bush.
    place(paths, SHEDS, SHED_BOX, [-214, 124], { clip: "shed-clip" }),
    bush(-62, 188, R, 0.9),
    // C1b: a lawn between the health department and the coroner, a hedged lawn with a walk along
    // the south.
    garden(82, 112, 112, 176, R),
    garden(-4, 200, 206, 236, R, {
      extra: walk([
        [4, 218],
        [60, 210],
        [130, 222],
        [198, 214],
      ]),
    }),
  ];
  const flowerBeds = flowers(273, 201, 333, 227, rng(5));

  const body =
    clips +
    `<rect x="-250" y="-280" width="${452 + E + 12}" height="${343 + S + 12}" fill="url(#d4)"/>` +
    L.map((d) => `<path fill="${KERB}" transform="translate(3.2 3.8)" d="${d}"/>`).join("") +
    L.map((d) => `<path fill="url(#d2)" d="${d}"/>`).join("") +
    parkInCorner(paths, "matrix(0.62 0 0 -0.62 -87.02 81.8)", [0, 3.7]) +
    parkInCorner(paths, "matrix(-0.62 0 0 -0.62 351.02 81.8)", [3.7, 3.7]) +
    detail.join("") +
    flowerBeds +
    keep +
    seamHedge(187, 199, -244, -4, R) +
    `<g transform="translate(276.5 26.5)">${paths[CAPTION[0]]}${paths[CAPTION[1]]}</g>` +
    frame;
  const [x, y, w, h] = VIEWBOX;
  return `<svg preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}"><title>ui/deathville-map-expanded-base</title>${defs}${body}</svg>\n`;
}

export const pieces = [
  {
    id: "ui/deathville-map-expanded-base",
    kind: "ui",
    usedBy: "the Deathville map of an Expanded town (the buildings are laid over it)",
    grade: "B",
    notes:
      "The 2001 map whole and unchanged, with the town grown east and south: new streets that continue the original's road edges in its curves, new lots in its pavement texture over its kerb, its parked cars, sheds and top-left park reused as ground detail, new hedged lawns and white walks, a hedge where the old edge cut the graveyard park, the frame stretched and the caption moved onto the new boulevard.",
    viewBox: VIEWBOX.join(" "),
    embeds: SOURCE,
    credit:
      "The 2001 map: Akiko Robinson (Robinson Technologies). The additions: FuneralQuest Remastered project, in the style of Akiko Robinson's original art",
    license: "The 2001 map: Proton SDK license. The additions: CC BY 4.0",
    previewWidth: 1504,
    render,
  },
];
