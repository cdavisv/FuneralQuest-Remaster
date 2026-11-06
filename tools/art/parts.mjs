/**
 * Reusable parts for the Remastered pieces: a perspective camera, tombstones, trees, fog,
 * lamps, caskets, the map-icon projection. Each returns SVG markup; the pieces assemble them.
 */
import {
  blob,
  circle,
  ellipse,
  g,
  mix,
  n,
  path,
  poly,
  rect,
  scallop,
  shade,
  smooth,
  tint,
} from "./lib.mjs";
import { P } from "./palette.mjs";

/** A pinhole camera: world X right, Y up, Z away from the viewer (metres). */
export function camera({ f = 300, cx = 275, hy = 205, height = 1.6 } = {}) {
  const pr = (X, Y, Z) => [cx + (f * X) / Z, hy - (f * (Y - height)) / Z];
  return {
    pr,
    /** Polygon path of world points. */
    poly: (pts) => poly(pts.map(([X, Y, Z]) => pr(X, Y, Z))),
    /** Screen scale (pixels per metre) at depth Z. */
    s: (Z) => f / Z,
  };
}

/**
 * A headstone standing at screen (x, y) (the middle of its base), w wide, h tall, of `kind`:
 * round, cross, obelisk, slab, angel-less "tablet" with shoulders. Lit from the upper left:
 * the left face is light, a narrow right side face shows depth. `c` is the stone colour.
 */
export function headstone(D, x, y, w, h, kind = "round", c = P.tomb, o = {}) {
  const { ink = P.ink, lw = 1, tilt = 0, moss = false, R = null } = o;
  const side = w * 0.16;
  const hi = tint(c, 0.25);
  const lo = shade(c, 0.35);
  const x0 = x - w / 2;
  const x1 = x + w / 2;
  const top = y - h;
  let face;
  let sideFace;
  const t = `rotate(${n(tilt)} ${n(x)} ${n(y)})`;
  if (kind === "round") {
    const r = w / 2;
    face = `M${n(x0)} ${n(y)}V${n(top + r)}A${n(r)} ${n(r)} 0 0 1 ${n(x1)} ${n(top + r)}V${n(y)}Z`;
    sideFace = `M${n(x1)} ${n(y)}V${n(top + r)}A${n(r)} ${n(r)} 0 0 0 ${n(x1 - r * 0.3)} ${n(top + r * 0.15)}L${n(x1 - r * 0.3 + side)} ${n(top + r * 0.15 - side * 0.4)}A${n(r)} ${n(r)} 0 0 1 ${n(x1 + side)} ${n(top + r - side * 0.4)}V${n(y - side * 0.4)}Z`;
  } else if (kind === "tablet") {
    const sh = h * 0.18;
    face = `M${n(x0)} ${n(y)}V${n(top + sh)}Q${n(x0)} ${n(top)} ${n(x)} ${n(top)}Q${n(x1)} ${n(top)} ${n(x1)} ${n(top + sh)}V${n(y)}Z`;
    sideFace = poly([
      [x1, y],
      [x1, top + sh],
      [x1 + side, top + sh - side * 0.4],
      [x1 + side, y - side * 0.4],
    ]);
  } else if (kind === "slab") {
    face = poly([
      [x0, y],
      [x0, top],
      [x1, top],
      [x1, y],
    ]);
    sideFace = poly([
      [x1, y],
      [x1, top],
      [x1 + side, top - side * 0.4],
      [x1 + side, y - side * 0.4],
    ]);
    sideFace += poly([
      [x0, top],
      [x0 + side, top - side * 0.4],
      [x1 + side, top - side * 0.4],
      [x1, top],
    ]);
  } else if (kind === "cross") {
    const bw = w * 0.28;
    const arm = h * 0.3;
    const ay = top + h * 0.22;
    face = poly([
      [x - bw / 2, y],
      [x - bw / 2, ay + bw],
      [x - w / 2, ay + bw],
      [x - w / 2, ay],
      [x - bw / 2, ay],
      [x - bw / 2, top],
      [x + bw / 2, top],
      [x + bw / 2, ay],
      [x + w / 2, ay],
      [x + w / 2, ay + bw],
      [x + bw / 2, ay + bw],
      [x + bw / 2, y],
    ]);
    const s2 = side * 0.6;
    sideFace = poly([
      [x + bw / 2, y],
      [x + bw / 2, ay + bw],
      [x + bw / 2 + s2, ay + bw - s2 * 0.4],
      [x + bw / 2 + s2, y - s2 * 0.4],
    ]);
    sideFace += poly([
      [x + w / 2, ay + bw],
      [x + w / 2, ay],
      [x + w / 2 + s2, ay - s2 * 0.4],
      [x + w / 2 + s2, ay + bw - s2 * 0.4],
    ]);
    void arm;
  } else {
    // obelisk on a plinth
    const pw = w;
    const ph = h * 0.16;
    const sw = w * 0.55;
    face =
      poly([
        [x0, y],
        [x0, y - ph],
        [x1, y - ph],
        [x1, y],
      ]) +
      poly([
        [x - sw / 2, y - ph],
        [x - sw * 0.32, top + h * 0.1],
        [x, top],
        [x + sw * 0.32, top + h * 0.1],
        [x + sw / 2, y - ph],
      ]);
    sideFace =
      poly([
        [x1, y],
        [x1, y - ph],
        [x1 + side, y - ph - side * 0.4],
        [x1 + side, y - side * 0.4],
      ]) +
      poly([
        [x + sw / 2, y - ph],
        [x + sw * 0.32, top + h * 0.1],
        [x, top],
        [x + sw * 0.32 + side * 0.5, top + h * 0.1 - side * 0.2],
        [x + sw / 2 + side * 0.5, y - ph - side * 0.2],
      ]);
    void pw;
  }
  const fill = D.lg(x0, top, x1, y, [
    [0, hi],
    [0.55, c],
    [1, shade(c, 0.12)],
  ]);
  const parts = [
    path(sideFace, lo, { stroke: ink, strokeWidth: lw, strokeLinejoin: "round" }),
    path(face, fill, { stroke: ink, strokeWidth: lw, strokeLinejoin: "round" }),
  ];
  if (kind === "round" || kind === "tablet") {
    // engraved lines
    const ly = top + h * (kind === "round" ? 0.42 : 0.36);
    for (let i = 0; i < 3; i++) {
      const ww = w * (0.5 - i * 0.08);
      parts.push(
        path(`M${n(x - ww / 2)} ${n(ly + i * h * 0.1)}H${n(x + ww / 2)}`, "none", {
          stroke: shade(c, 0.4),
          strokeWidth: Math.max(0.5, lw * 0.8),
          opacity: 0.7,
        }),
      );
    }
  }
  if (moss && R) {
    parts.push(
      path(blob(x0 + w * 0.25, y - h * 0.08, w * 0.3, h * 0.08, R, 7, 0.4), P.moss, {
        opacity: 0.8,
      }),
    );
  }
  return g(parts, tilt ? { transform: t } : {});
}

/** A bare, crooked tree (the graveyard's), trunk base at (x, y), height h. */
export function bareTree(x, y, h, c, R, o = {}) {
  const { depth = 5, lean = 0, width = h * 0.07 } = o;
  const strokes = [];
  function branch(x0, y0, ang, len, w, d) {
    const bend = R.range(-0.35, 0.35);
    const x1 = x0 + Math.cos(ang) * len;
    const y1 = y0 + Math.sin(ang) * len;
    const mx = x0 + Math.cos(ang + bend) * len * 0.55;
    const my = y0 + Math.sin(ang + bend) * len * 0.55;
    // tapered branch as a filled quad-curve shape
    const nx = -Math.sin(ang);
    const ny = Math.cos(ang);
    const w1 = w * 0.55;
    strokes.push(
      `M${n(x0 + nx * w)} ${n(y0 + ny * w)}Q${n(mx + (nx * (w + w1)) / 2)} ${n(my + (ny * (w + w1)) / 2)} ${n(x1 + nx * w1)} ${n(y1 + ny * w1)}L${n(x1 - nx * w1)} ${n(y1 - ny * w1)}Q${n(mx - (nx * (w + w1)) / 2)} ${n(my - (ny * (w + w1)) / 2)} ${n(x0 - nx * w)} ${n(y0 - ny * w)}Z`,
    );
    if (d <= 0 || len < 4) return;
    const kids = d > 3 ? 2 : R.int(2, 3);
    for (let i = 0; i < kids; i++) {
      const spread = R.range(0.3, 0.75) * (i % 2 ? 1 : -1);
      branch(x1, y1, ang + spread, len * R.range(0.6, 0.78), w1, d - 1);
    }
  }
  branch(x, y, -Math.PI / 2 + lean, h * 0.38, width, depth);
  // roots
  const root = `M${n(x - width * 2.2)} ${n(y + 1)}Q${n(x - width)} ${n(y - width)} ${n(x)} ${n(y - width * 3)}Q${n(x + width)} ${n(y - width)} ${n(x + width * 2.4)} ${n(y + 1)}Z`;
  return path(strokes.join("") + root, c);
}

/**
 * A leafy tree: a trunk and a canopy of three tones of scalloped clumps, lit from the upper
 * left. (x, y) is the trunk base.
 */
export function leafyTree(D, x, y, h, R, o = {}) {
  const { leaf = P.leafDark, trunk = P.woodDark, light = P.moss, w = h * 0.55, ink = null } = o;
  const parts = [];
  const tw = h * 0.05;
  parts.push(
    path(
      `M${n(x - tw)} ${n(y)}Q${n(x - tw * 0.6)} ${n(y - h * 0.3)} ${n(x - tw * 0.4)} ${n(y - h * 0.5)}L${n(x + tw * 0.5)} ${n(y - h * 0.5)}Q${n(x + tw * 0.7)} ${n(y - h * 0.3)} ${n(x + tw * 1.2)} ${n(y)}Z`,
      trunk,
    ),
  );
  const cy = y - h * 0.62;
  const clumps = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    clumps.push([
      x + Math.cos(a) * w * 0.32 + R.range(-6, 6),
      cy + Math.sin(a) * h * 0.2 + R.range(-5, 5),
    ]);
  }
  const outline = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const k = R.range(0.85, 1.08);
    outline.push([x + Math.cos(a) * w * 0.5 * k, cy + Math.sin(a) * h * 0.36 * k]);
  }
  const strokeO = ink ? { stroke: ink, strokeWidth: 0.8 } : {};
  parts.push(path(scallop(outline, 0.35, R), leaf, strokeO));
  // lit clumps upper left
  const lit = [];
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + (i / 9) * Math.PI * 0.9;
    const k = R.range(0.55, 0.85);
    lit.push([
      x - w * 0.08 + Math.cos(a) * w * 0.38 * k,
      cy - h * 0.04 + Math.sin(a) * h * 0.28 * k,
    ]);
  }
  lit.push([x + w * 0.05, cy + h * 0.05], [x - w * 0.25, cy + h * 0.08]);
  parts.push(path(scallop(lit, 0.4, R), light, { opacity: 0.85 }));
  const top = [];
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * 1.1 + (i / 7) * Math.PI * 0.7;
    top.push([x - w * 0.14 + Math.cos(a) * w * 0.22, cy - h * 0.12 + Math.sin(a) * h * 0.15]);
  }
  top.push([x - w * 0.05, cy - h * 0.04]);
  parts.push(path(scallop(top, 0.4, R), tint(light, 0.25), { opacity: 0.8 }));
  void clumps;
  void D;
  return g(parts);
}

/** Fog: soft translucent bands with wavy tops, from y0 down to y1. */
export function fogBand(D, y0, y1, color = P.fog, opacity = 0.35, R = null, blurSd = 0) {
  const pts = [];
  const steps = 9;
  for (let i = 0; i <= steps; i++) {
    const x = -20 + (590 * i) / steps;
    pts.push([x, y0 + (R ? R.range(-10, 10) : 0)]);
  }
  const top = smooth(pts, false, 0.6);
  const d = `${top}L570 ${n(y1)}L-20 ${n(y1)}Z`;
  const fill = D.lg(0, y0 - 10, 0, y1, [
    [0, color, 0],
    [0.35, color, opacity],
    [1, color, opacity * 0.8],
  ]);
  return path(d, fill, blurSd ? { filter: D.blur(blurSd) } : {});
}

/** A cast-iron street lamp (places/palors' gas lamp), foot at (x, y), height h. */
export function streetLamp(D, x, y, h, o = {}) {
  const { lit = true, ink = P.ink } = o;
  const w = h * 0.035;
  const hw = h * 0.09;
  const ht = y - h;
  const glass = D.lg(x - hw, 0, x + hw, 0, [
    [0, lit ? P.lamp1 : P.grey2],
    [0.5, lit ? P.lamp0 : P.white],
    [1, lit ? P.lamp2 : P.grey3],
  ]);
  const parts = [
    // post
    path(
      `M${n(x - w * 1.8)} ${n(y)}L${n(x - w)} ${n(y - h * 0.12)}L${n(x - w * 0.7)} ${n(ht + h * 0.2)}L${n(x + w * 0.7)} ${n(ht + h * 0.2)}L${n(x + w)} ${n(y - h * 0.12)}L${n(x + w * 1.8)} ${n(y)}Z`,
      "#222222",
      { stroke: ink, strokeWidth: 0.6 },
    ),
    rect(x - w * 1.3, ht + h * 0.18, w * 2.6, h * 0.025, "#222222", {
      stroke: ink,
      strokeWidth: 0.5,
    }),
    // lantern
    path(
      `M${n(x - hw * 0.7)} ${n(ht + h * 0.18)}L${n(x - hw)} ${n(ht + h * 0.05)}L${n(x + hw)} ${n(ht + h * 0.05)}L${n(x + hw * 0.7)} ${n(ht + h * 0.18)}Z`,
      glass,
      { stroke: "#222222", strokeWidth: Math.max(0.6, h * 0.008) },
    ),
    path(`M${n(x)} ${n(ht + h * 0.05)}V${n(ht + h * 0.18)}`, "none", {
      stroke: "#222222",
      strokeWidth: Math.max(0.4, h * 0.004),
    }),
    // cap
    path(
      `M${n(x - hw * 1.2)} ${n(ht + h * 0.05)}Q${n(x)} ${n(ht - h * 0.03)} ${n(x + hw * 1.2)} ${n(ht + h * 0.05)}Z`,
      "#2a2a2a",
      { stroke: ink, strokeWidth: 0.6 },
    ),
    circle(x, ht - h * 0.012, h * 0.012, "#2a2a2a"),
  ];
  if (lit) {
    parts.unshift(
      circle(
        x,
        ht + h * 0.11,
        h * 0.22,
        D.rg(x, ht + h * 0.11, h * 0.22, [
          [0, P.lamp0, 0.45],
          [1, P.lamp0, 0],
        ]),
      ),
    );
  }
  return g(parts);
}

/** A casket seen from the side, slightly from above: (x, y) bottom-left, w long, h tall. */
export function casketSide(D, x, y, w, h, c, o = {}) {
  const { ink = P.ink, lw = 0.8, handle = P.gold, open = false } = o;
  const lid = h * 0.45;
  const top = h * 0.16;
  const body = D.lg(x, y - h, x, y, [
    [0, tint(c, 0.2)],
    [0.5, c],
    [1, shade(c, 0.35)],
  ]);
  const parts = [
    // top face (seen from above)
    path(
      poly([
        [x + w * 0.04, y - h],
        [x + w * 0.96, y - h],
        [x + w, y - h + top],
        [x, y - h + top],
      ]),
      tint(c, 0.3),
      {
        stroke: ink,
        strokeWidth: lw,
        strokeLinejoin: "round",
      },
    ),
    // lid band
    path(
      poly([
        [x, y - h + top],
        [x + w, y - h + top],
        [x + w * 0.98, y - h + lid],
        [x + w * 0.02, y - h + lid],
      ]),
      body,
      {
        stroke: ink,
        strokeWidth: lw,
        strokeLinejoin: "round",
      },
    ),
    // box
    path(
      poly([
        [x + w * 0.02, y - h + lid],
        [x + w * 0.98, y - h + lid],
        [x + w * 0.95, y],
        [x + w * 0.05, y],
      ]),
      shade(c, 0.12),
      {
        stroke: ink,
        strokeWidth: lw,
        strokeLinejoin: "round",
      },
    ),
    // handle rail
    path(`M${n(x + w * 0.12)} ${n(y - h + lid + (h - lid) * 0.35)}H${n(x + w * 0.88)}`, "none", {
      stroke: handle,
      strokeWidth: Math.max(0.8, h * 0.06),
      strokeLinecap: "round",
    }),
  ];
  for (const k of [0.2, 0.5, 0.8]) {
    parts.push(
      rect(
        x + w * k - w * 0.015,
        y - h + lid + (h - lid) * 0.28,
        w * 0.03,
        (h - lid) * 0.2,
        shade(handle, 0.3),
      ),
    );
  }
  if (open) {
    parts.push(
      path(
        poly([
          [x + w * 0.04, y - h],
          [x + w * 0.96, y - h],
          [x + w, y - h + top],
          [x, y - h + top],
        ]),
        P.lamp0,
      ),
    );
  }
  return g(parts);
}

/** The oblique projection of the map icons (ui/building-*): x along the front, z into the side. */
export function iso(ox, oy, k = 1) {
  return (x, y, z) => [ox + (x * 0.94 + z * 0.78) * k, oy + (x * 0.34 - z * 0.46 - y) * k];
}

/** Sky gradient top to bottom. */
export function sky(D, stops, y0 = 0, y1 = 400) {
  return rect(-5, -5, 560, 410, D.lg(0, y0, 0, y1, stops));
}

/** A row of grass blades along a baseline (x0..x1 at y), tinted c. */
export function grass(x0, x1, y, h, c, R, count = 40) {
  let d = "";
  for (let i = 0; i < count; i++) {
    const x = x0 + ((x1 - x0) * (i + R.next())) / count;
    const hh = h * R.range(0.5, 1.1);
    const lean = R.range(-0.5, 0.5) * hh;
    d += `M${n(x - 1.2)} ${n(y)}Q${n(x + lean * 0.3)} ${n(y - hh * 0.6)} ${n(x + lean)} ${n(y - hh)}Q${n(x + lean * 0.2 + 0.6)} ${n(y - hh * 0.5)} ${n(x + 1.4)} ${n(y)}Z`;
  }
  return path(d, c);
}

export { blob, ellipse, mix };

/**
 * A box in camera space, drawing only the faces the camera can see (near end, inner side, top
 * or bottom). `c` = { end, side, top, bottom } fills; `o.ink`, `o.lw` for the outline.
 */
export function box3(cam, x0, x1, y0, y1, z0, z1, c, o = {}) {
  const { ink = P.ink, lw = 0.6, camY = 1.6 } = o;
  const st = { stroke: ink, strokeWidth: lw, strokeLinejoin: "round" };
  const out = [];
  if (y1 < camY && c.top)
    out.push(
      path(
        cam.poly([
          [x0, y1, z0],
          [x1, y1, z0],
          [x1, y1, z1],
          [x0, y1, z1],
        ]),
        c.top,
        st,
      ),
    );
  if (y0 > camY && c.bottom)
    out.push(
      path(
        cam.poly([
          [x0, y0, z0],
          [x1, y0, z0],
          [x1, y0, z1],
          [x0, y0, z1],
        ]),
        c.bottom,
        st,
      ),
    );
  if (x0 > 0 && c.side)
    out.push(
      path(
        cam.poly([
          [x0, y0, z0],
          [x0, y1, z0],
          [x0, y1, z1],
          [x0, y0, z1],
        ]),
        c.side,
        st,
      ),
    );
  if (x1 < 0 && c.side)
    out.push(
      path(
        cam.poly([
          [x1, y0, z0],
          [x1, y1, z0],
          [x1, y1, z1],
          [x1, y0, z1],
        ]),
        c.side,
        st,
      ),
    );
  if (c.end)
    out.push(
      path(
        cam.poly([
          [x0, y0, z0],
          [x1, y0, z0],
          [x1, y1, z0],
          [x0, y1, z0],
        ]),
        c.end,
        st,
      ),
    );
  return out.join("");
}
