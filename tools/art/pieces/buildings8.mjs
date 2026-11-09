/**
 * Map buildings for the eight places added in docs/expanded-rules.md sections 30 and 31: the
 * Police Station, Crematorium, Florist and Town Gazette (batch A) and the Coroner, Health
 * Department, Pawn Shop and Mourne & Sons (batch B). Drawn in the oblique projection, 1.3 unit
 * black outline, soft grey-black ground shadow and two-tone gradient faces of the original
 * ui/building-*.svg (and of the Remastered City Hall and Reaper Club in pieces/ui.mjs).
 *
 * Each building is one function of a drawing context. `flat` draws the same building with plain
 * fills and no texture lines, which is what the Classic pack's placeholder stand-ins are
 * (tools/art/placeholders.mjs writes those); the Remastered pieces are the full drawings.
 */
import { lettering } from "../font.mjs";
import { circle, Defs, doc, ellipse, n, path, poly, rect, smooth } from "../lib.mjs";
import { iso } from "../parts.mjs";

const INK = "#000000";
/** Per-building fit into the 120x108 box: [scale, dx, dy], measured by tools/art/fit8.mjs. */
const FIT = {
  "Police Station (map)": [1.166, -8.2, -19.9],
  "Crematorium (map)": [0.979, 7.8, 0.3],
  "Florist (map)": [1.202, -7.3, -23.8],
  "Town Gazette (map)": [1.359, -17.5, -40.8],
  "Coroner (map)": [1.149, -8, -18],
  "Health Department (map)": [1.251, -12.1, -29.1],
  "Pawn Shop (map)": [1.318, -14.8, -36.4],
  "Mourne & Sons (map)": [1.094, -3.7, -12.2],
};
export const VIEWBOX = "0 0 120 108";

/** The drawing context: projected helpers writing into `out`. */
function ctx(flat, D, ox, oy) {
  const pr = iso(ox, oy, 1);
  const out = [];
  const st = (w = 1.3) => ({ stroke: INK, strokeWidth: w, strokeLinejoin: "round" });
  const P3 = (pts) => poly(pts.map(([x, y, z]) => pr(x, y, z)));
  const add = (d, fill, o) => out.push(path(d, fill, o));
  /** A horizontal two-colour face gradient (plain first colour when flat). */
  const gr = (xa, xb, a, b) =>
    flat
      ? a
      : D.lg(xa, 0, xb, 0, [
          [0, a],
          [1, b],
        ]);
  /** A rectangle on the front plane (z), the side plane (x) or the horizontal plane (y). */
  const fr = (x0, y0, x1, y1, fill, w = 0.7, z = -0.1) =>
    add(
      P3([
        [x0, y0, z],
        [x1, y0, z],
        [x1, y1, z],
        [x0, y1, z],
      ]),
      fill,
      st(w),
    );
  const sd = (z0, y0, z1, y1, fill, w = 0.7, x) =>
    add(
      P3([
        [x, y0, z0],
        [x, y0, z1],
        [x, y1, z1],
        [x, y1, z0],
      ]),
      fill,
      st(w),
    );
  const tp = (x0, z0, x1, z1, y, fill, w = 0.7) =>
    add(
      P3([
        [x0, y, z0],
        [x1, y, z0],
        [x1, y, z1],
        [x0, y, z1],
      ]),
      fill,
      st(w),
    );
  /** A line on the front plane. */
  const fline = (pts, color, w = 0.6, z = -0.15) =>
    add(
      pts
        .map(
          ([x, y], i) =>
            `${i ? "L" : "M"}${pr(x, y, z)
              .map((v) => n(v))
              .join(" ")}`,
        )
        .join(""),
      "none",
      { stroke: color, strokeWidth: w, strokeLinecap: "round" },
    );
  const sline = (pts, color, w = 0.6, x) =>
    add(
      pts
        .map(
          ([z, y], i) =>
            `${i ? "L" : "M"}${pr(x, y, z)
              .map((v) => n(v))
              .join(" ")}`,
        )
        .join(""),
      "none",
      { stroke: color, strokeWidth: w, strokeLinecap: "round" },
    );
  /** The oblique box: side (darker), front, top. Returns nothing; draws. */
  const box = (x0, x1, y0, y1, z0, z1, c) => {
    add(
      P3([
        [x1, y0, z0],
        [x1, y0, z1],
        [x1, y1, z1],
        [x1, y1, z0],
      ]),
      gr(pr(x1, 0, z0)[0], pr(x1, 0, z1)[0], c.side[0], c.side[1]),
      st(),
    );
    add(
      P3([
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y1, z0],
        [x0, y1, z0],
      ]),
      gr(pr(x0, 0, z0)[0], pr(x1, 0, z0)[0], c.front[0], c.front[1]),
      st(),
    );
    add(
      P3([
        [x0, y1, z0],
        [x1, y1, z0],
        [x1, y1, z1],
        [x0, y1, z1],
      ]),
      c.top,
      st(),
    );
  };
  /** A soft ground shadow around the footprint, thrown to the lower right. */
  const shadow = (W, Dp, grow = 1) => {
    const pts = [
      pr(-2, 0, -2),
      pr(W * 0.5, 0, -4),
      pr(W + 4, 0, 0),
      pr(W + 10, 0, Dp * 0.5),
      pr(W + 6, 0, Dp + 6),
      pr(W * 0.6, 0, Dp + 8),
    ].map(([x, y]) => [x + 6 * grow, y + 7 * grow]);
    out.unshift(path(smooth(pts, true, 0.5), "#000", { fillOpacity: 0.2 }));
  };
  /** Lettering on the front plane, upright text skewed into the projection. */
  const text = (s, x, y, size, color, w = 0.16, z = -0.2) => {
    const [px, py] = pr(x, y, z);
    out.push(
      lettering(s, 0, 0, size, color, {
        weight: w,
        track: 0.12,
        transform: `matrix(0.94 0.34 0 1 ${n(px)} ${n(py - size)})`,
      }),
    );
  };
  const textW = (s, size) => {
    // rough width of lettering at `size`, for centring a sign (matches font.mjs advance)
    return s.length * size * 0.62;
  };
  return {
    pr,
    out,
    st,
    P3,
    add,
    gr,
    fr,
    sd,
    tp,
    fline,
    sline,
    box,
    shadow,
    text,
    textW,
    flat,
    D,
    /** A gable roof over a box, ridge parallel to the front. */
    roofFront(x0, x1, y, z0, z1, rise, c, o = {}) {
      const zm = (z0 + z1) / 2;
      const ov = o.over ?? 2;
      // gable end on the right side plane
      add(
        P3([
          [x1, y, z0],
          [x1, y, z1],
          [x1, y + rise, zm],
        ]),
        c.gable,
        st(),
      );
      // back slope is hidden; front slope: eave at z0-ov, ridge at zm
      add(
        P3([
          [x0 - ov, y - 1, z0 - ov],
          [x1 + ov, y - 1, z0 - ov],
          [x1 + ov, y + rise, zm],
          [x0 - ov, y + rise, zm],
        ]),
        gr(pr(x0, 0, z0)[0], pr(x1, 0, z0)[0], c.slope[0], c.slope[1]),
        st(),
      );
      if (!flat) {
        // shingle courses on the front slope
        let d = "";
        for (let k = 1; k < 5; k++) {
          const t = k / 5;
          const yy = y - 1 + (rise + 1) * t;
          const zz = z0 - ov + (zm - z0 + ov) * t;
          const a = pr(x0 - ov, yy, zz);
          const b = pr(x1 + ov, yy, zz);
          d += `M${n(a[0])} ${n(a[1])}L${n(b[0])} ${n(b[1])}`;
        }
        add(d, "none", { stroke: c.course, strokeWidth: 0.5 });
      }
    },
  };
}

/* ------------------------------------------------------------------------------------------ */

/** Police Station: a blue-grey stone block, blue globe lamps, a roof beacon. */
function police(flat) {
  const D = new Defs("bpo");
  const c = ctx(flat, D, 12, 80);
  const W = 58;
  const Dp = 32;
  const H = 28;
  c.shadow(W, Dp);
  c.box(0, W, 0, H, 0, Dp, {
    front: ["#b4c4d8", "#8fa4bf"],
    side: ["#788ca8", "#51647f"],
    top: "#9eb0c6",
  });
  // roof parapet
  c.add(
    c.P3([
      [-1.5, H, -1.5],
      [W + 1.5, H, -1.5],
      [W + 1.5, H + 3, -1.5],
      [-1.5, H + 3, -1.5],
    ]),
    "#c8d4e2",
    c.st(),
  );
  c.add(
    c.P3([
      [W + 1.5, H, -1.5],
      [W + 1.5, H, Dp + 1.5],
      [W + 1.5, H + 3, Dp + 1.5],
      [W + 1.5, H + 3, -1.5],
    ]),
    "#8c9db4",
    c.st(),
  );
  if (!flat) {
    // stone courses
    for (let y = 5; y < H; y += 5)
      c.fline(
        [
          [0, y],
          [W, y],
        ],
        "#6f84a2",
        0.45,
      );
  }
  // steps and a pair of doors
  c.box(20, 38, 0, 2, -5, 0, {
    front: ["#e4eaf2", "#c8d2de"],
    side: ["#9aa8ba", "#7a889c"],
    top: "#eef2f8",
  });
  c.fr(23, 0, 35, 15, "#2c3f66", 0.9);
  c.fline(
    [
      [29, 0.5],
      [29, 15],
    ],
    INK,
    0.6,
  );
  for (const x of [24.5, 30.5]) c.fr(x, 6, x + 3.5, 12, "#4a7ac8", 0.5, -0.2);
  // blue globe lamps either side of the door
  for (const x of [19, 39]) {
    const [lx, ly] = c.pr(x, 18, -1);
    c.out.push(circle(lx, ly, 2.6, "#3a7ee0", c.st(0.8)));
    c.out.push(circle(lx - 0.8, ly - 0.8, 0.8, "#cfe4ff"));
    c.out.push(path(`M${n(lx)} ${n(ly + 2.6)}v3`, "none", { stroke: INK, strokeWidth: 0.8 }));
  }
  // POLICE band above the door
  c.fr(14, 19, 44, 26, "#1b2a4c", 0.9, -0.2);
  c.text("POLICE", 17.2, 20.4, 4.6, "#ffffff", 0.17);
  // barred windows, three on the side, two on the front
  for (const x of [4, 45]) {
    c.fr(x, 8, x + 9, 20, "#e6ecf4", 0.8);
    c.fr(x + 1, 9, x + 8, 19, "#243756", 0.5, -0.2);
    c.fline(
      [
        [x + 3.4, 9],
        [x + 3.4, 19],
      ],
      "#aab8cc",
      0.5,
      -0.3,
    );
    c.fline(
      [
        [x + 5.6, 9],
        [x + 5.6, 19],
      ],
      "#aab8cc",
      0.5,
      -0.3,
    );
  }
  for (const z of [5, 17]) {
    c.sd(z, 8, z + 8, 20, "#e6ecf4", 0.8, W + 0.1);
    c.sd(z + 1, 9, z + 7, 19, "#243756", 0.5, W + 0.2);
    c.sline(
      [
        [z + 3, 9],
        [z + 3, 19],
      ],
      "#aab8cc",
      0.5,
      W + 0.3,
    );
    c.sline(
      [
        [z + 5, 9],
        [z + 5, 19],
      ],
      "#aab8cc",
      0.5,
      W + 0.3,
    );
  }
  // beacon on a roof post: red and blue
  const [bx, by] = c.pr(46, H + 3, 8);
  c.out.push(path(`M${n(bx)} ${n(by)}v-5`, "none", { stroke: INK, strokeWidth: 1.2 }));
  c.out.push(
    path(
      `M${n(bx - 4.5)} ${n(by - 5)}Q${n(bx - 4.5)} ${n(by - 12)} ${n(bx)} ${n(by - 12)}Q${n(bx + 4.5)} ${n(by - 12)} ${n(bx + 4.5)} ${n(by - 5)}Z`,
      c.gr(bx - 4.5, bx + 4.5, "#e03030", "#3a6ad8"),
      c.st(0.9),
    ),
  );
  if (!flat)
    c.out.push(
      path(`M${n(bx)} ${n(by - 12)}V${n(by - 5)}`, "none", { stroke: INK, strokeWidth: 0.5 }),
    );
  // a flag pole at the left corner
  const [fx, fy] = c.pr(4, H + 3, 4);
  c.out.push(path(`M${n(fx)} ${n(fy)}V${n(fy - 22)}`, "none", { stroke: INK, strokeWidth: 1 }));
  c.out.push(path(`M${n(fx)} ${n(fy - 22)}l10 2.5l-10 4z`, "#2a4a9c", c.st(0.7)));
  return finish("Police Station (map)", c, D);
}

/** Crematorium: a low brick block with a tall chimney and a drift of smoke. */
function crematorium(flat) {
  const D = new Defs("bcr");
  const c = ctx(flat, D, 10, 82);
  const W = 56;
  const Dp = 34;
  const H = 20;
  c.shadow(W, Dp);
  c.box(0, W, 0, H, 0, Dp, {
    front: ["#a85a40", "#7f3a28"],
    side: ["#6a2c1e", "#4a1c12"],
    top: "#5a4a44",
  });
  if (!flat) {
    // brick courses and a pale stone plinth
    for (let y = 3.5; y < H; y += 3.5)
      c.fline(
        [
          [0, y],
          [W, y],
        ],
        "#3e170c",
        0.45,
      );
    for (let z = 4; z < Dp; z += 6)
      c.sline(
        [
          [z, 0],
          [z, H],
        ],
        "#2c0e08",
        0.35,
        W + 0.05,
      );
  }
  c.fr(-1, 0, W + 1, 3, "#c8c0b0", 0.8, -0.3);
  // roof edge in pale stone
  c.add(
    c.P3([
      [-1, H, -1],
      [W + 1, H, -1],
      [W + 1, H + 2.5, -1],
      [-1, H + 2.5, -1],
    ]),
    "#cfc6b4",
    c.st(0.9),
  );
  // arched oven door in iron with a flame over it
  c.add(
    c.P3([
      [22, 3, -0.2],
      [34, 3, -0.2],
      [34, 12, -0.2],
      [32, 15, -0.2],
      [24, 15, -0.2],
      [22, 12, -0.2],
    ]),
    "#201a1a",
    c.st(0.9),
  );
  c.fr(25, 3, 31, 10, "#f07820", 0.5, -0.3);
  c.fr(26.5, 3, 29.5, 7, "#ffd040", 0.4, -0.4);
  // small high windows with grilles
  for (const x of [6, 42]) {
    c.fr(x, 8, x + 8, 15, "#8a8478", 0.8);
    c.fr(x + 1, 9, x + 7, 14, "#1d2028", 0.5, -0.2);
    c.fline(
      [
        [x + 4, 9],
        [x + 4, 14],
      ],
      "#8a8478",
      0.5,
      -0.3,
    );
  }
  for (const z of [6, 20]) {
    c.sd(z, 8, z + 8, 15, "#8a8478", 0.8, W + 0.1);
    c.sd(z + 1, 9, z + 7, 14, "#1d2028", 0.5, W + 0.2);
  }
  // the tall chimney on the back of the roof
  const x0 = 38;
  const z0 = 16;
  c.box(x0, x0 + 8, H + 2.5, H + 36, z0, z0 + 8, {
    front: ["#a85a40", "#7f3a28"],
    side: ["#6a2c1e", "#4a1c12"],
    top: "#2a2220",
  });
  if (!flat)
    for (let y = H + 6; y < H + 36; y += 3.5)
      c.fline(
        [
          [x0, y],
          [x0 + 8, y],
        ],
        "#3e170c",
        0.45,
        z0 - 0.05,
      );
  // cap band
  c.box(x0 - 0.8, x0 + 8.8, H + 33, H + 36.5, z0 - 0.8, z0 + 8.8, {
    front: ["#d0c8b6", "#b4ac98"],
    side: ["#8a8270", "#6a6254"],
    top: "#3a3230",
  });
  // smoke: grey puffs drifting up and to the right
  const [sx, sy] = c.pr(x0 + 4, H + 36.5, z0 + 4);
  const puffs = [
    [0, -4, 4.2, "#b8b4b0"],
    [4, -10, 5.4, "#cfcbc6"],
    [10, -17, 6.2, "#dcd8d2"],
    [18, -24, 5.0, "#e8e4de"],
  ];
  for (const [dx, dy, r, col] of puffs) {
    c.out.push(ellipse(sx + dx, sy + dy, r * 1.15, r * 0.85, col, c.st(0.7)));
    c.out.push(circle(sx + dx - r * 0.3, sy + dy - r * 0.2, r * 0.35, "#ffffff", { opacity: 0.5 }));
  }
  // a wrought-iron fence at the front: posts and rail
  const f1 = c.pr(-4, 0, -6);
  const f2 = c.pr(W + 4, 0, -6);
  c.out.push(
    path(`M${n(f1[0])} ${n(f1[1] - 5)}L${n(f2[0])} ${n(f2[1] - 5)}`, "none", {
      stroke: "#222",
      strokeWidth: 0.9,
    }),
  );
  for (let x = -4; x <= W + 4; x += 6) {
    const p = c.pr(x, 0, -6);
    c.out.push(path(`M${n(p[0])} ${n(p[1])}v-6`, "none", { stroke: "#222", strokeWidth: 0.9 }));
  }
  return finish("Crematorium (map)", c, D);
}

/** Florist: a rose-pink cottage under a green gable, a striped awning and window boxes. */
function florist(flat) {
  const D = new Defs("bfl");
  const c = ctx(flat, D, 12, 82);
  const W = 54;
  const Dp = 32;
  const H = 18;
  c.shadow(W, Dp);
  c.box(0, W, 0, H, 0, Dp, {
    front: ["#f6d2dc", "#e2a8bb"],
    side: ["#c98aa0", "#a46680"],
    top: "#d8a0b4",
  });
  c.roofFront(0, W, H, 0, Dp, 14, {
    gable: "#e6b8c8",
    slope: ["#6e9a5a", "#456f3a"],
    course: "#2f5226",
  });
  // door in the middle, a round sign above
  c.fr(23, 0, 31, 12, "#6a4a8a", 0.9);
  c.fr(25, 4, 29, 11, "#b9a0d8", 0.5, -0.2);
  const [dx, dy] = c.pr(27, 15.5, -0.3);
  c.out.push(ellipse(dx, dy, 5.2, 4.6, "#fff4c8", c.st(0.9)));
  c.out.push(circle(dx, dy, 1.8, "#d8305a"));
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    c.out.push(circle(dx + Math.cos(a) * 2.6, dy + Math.sin(a) * 2.6, 1.3, "#f06a8a"));
  }
  c.out.push(circle(dx, dy, 1.1, "#f4c020"));
  // striped awning over the two shop windows
  for (const x0 of [3, 36]) {
    c.fr(x0, 5, x0 + 15, 13, "#fff6f0", 0.8);
    c.fr(x0 + 1, 6, x0 + 14, 12, "#a8d8e8", 0.5, -0.2);
    // the awning: alternating stripes
    for (let i = 0; i < 5; i++) {
      c.add(
        c.P3([
          [x0 - 1 + i * 3.4, 13.5, -0.3],
          [x0 + 2.4 + i * 3.4, 13.5, -0.3],
          [x0 + 2.4 + i * 3.4, 15.5, -4],
          [x0 - 1 + i * 3.4, 15.5, -4],
        ]),
        i % 2 ? "#ffffff" : "#e0407a",
        c.st(0.5),
      );
    }
    // flower box under the window, blooms on top
    c.fr(x0 - 1, 2.5, x0 + 16, 5.5, "#7a4a28", 0.7, -0.4);
    const blooms = ["#f04a6a", "#f8d030", "#ffffff", "#a050e0", "#f07a30"];
    for (let i = 0; i < 6; i++) {
      const [bx, by] = c.pr(x0 + i * 3, 6.8 + (i % 2) * 0.8, -0.8);
      c.out.push(circle(bx, by, 1.5, blooms[(i + x0) % blooms.length], c.st(0.4)));
    }
  }
  // side windows
  for (const z of [6, 18]) {
    c.sd(z, 6, z + 8, 14, "#fff6f0", 0.8, W + 0.1);
    c.sd(z + 1, 7, z + 7, 13, "#8fb8c8", 0.5, W + 0.2);
  }
  // buckets of flowers on the pavement
  const bucketCols = ["#f04a6a", "#f8d030", "#ffffff"];
  for (let i = 0; i < 3; i++) {
    const [bx, by] = c.pr(18 + i * 6.5, 0, -7);
    c.out.push(
      path(
        `M${n(bx - 2.6)} ${n(by - 4)}L${n(bx - 2)} ${n(by)}H${n(bx + 2)}L${n(bx + 2.6)} ${n(by - 4)}Z`,
        "#8a8a92",
        c.st(0.7),
      ),
    );
    for (let k = -1; k <= 1; k++)
      c.out.push(
        circle(
          bx + k * 1.8,
          by - 5.8 - (k === 0 ? 1.2 : 0),
          1.7,
          bucketCols[(i + k + 3) % 3],
          c.st(0.4),
        ),
      );
  }
  return finish("Florist (map)", c, D);
}

/** Town Gazette: a tall, narrow brick newspaper office with a clock and a red masthead sign. */
function gazette(flat) {
  const D = new Defs("bgz");
  const c = ctx(flat, D, 18, 86);
  const W = 44;
  const Dp = 30;
  const H = 40;
  c.shadow(W, Dp);
  c.box(0, W, 0, H, 0, Dp, {
    front: ["#d8c8a4", "#b8a47a"],
    side: ["#9a8658", "#75633c"],
    top: "#6a5a40",
  });
  if (!flat)
    for (let y = 4; y < H; y += 4)
      c.fline(
        [
          [0, y],
          [W, y],
        ],
        "#8a7650",
        0.4,
      );
  // cornice
  c.add(
    c.P3([
      [-1.5, H - 1, -1.5],
      [W + 1.5, H - 1, -1.5],
      [W + 1.5, H + 2, -1.5],
      [-1.5, H + 2, -1.5],
    ]),
    "#efe6d0",
    c.st(0.9),
  );
  c.add(
    c.P3([
      [W + 1.5, H - 1, -1.5],
      [W + 1.5, H - 1, Dp + 1.5],
      [W + 1.5, H + 2, Dp + 1.5],
      [W + 1.5, H + 2, -1.5],
    ]),
    "#a89c80",
    c.st(0.9),
  );
  // masthead sign across the ground floor
  c.fr(3, 22, 41, 30, "#b01c28", 0.9, -0.2);
  c.text("GAZETTE", 5.2, 23.4, 5.2, "#fbf1d0", 0.17);
  // the top floor
  for (const x of [5, 17, 29]) {
    c.fr(x, 33, x + 9, 38.5, "#f6eedb", 0.8);
    c.fr(x + 1, 33.8, x + 8, 37.8, "#4a6078", 0.5, -0.2);
  }
  // ground floor: a door and a shop window with a stack of papers
  c.fr(17.5, 0, 25.5, 14, "#5a3818", 0.9);
  c.fr(19, 5, 24, 13, "#a8c0cc", 0.5, -0.2);
  c.fr(3, 3, 14, 15, "#f6eedb", 0.8);
  c.fr(4, 4, 13, 14, "#6a8498", 0.5, -0.2);
  c.fr(28.5, 3, 41, 15, "#f6eedb", 0.8);
  c.fr(29.5, 4, 40, 14, "#6a8498", 0.5, -0.2);
  // a clock in the gable of the sign band
  const [kx, ky] = c.pr(21.5, 18.5, -0.5);
  c.out.push(circle(kx, ky, 3.4, "#ffffff", c.st(0.8)));
  c.out.push(
    path(`M${n(kx)} ${n(ky)}v-2.4M${n(kx)} ${n(ky)}l1.8 1`, "none", {
      stroke: INK,
      strokeWidth: 0.6,
    }),
  );
  // side windows, three floors
  for (const z of [5, 17]) {
    for (const y of [5, 17, 29]) {
      c.sd(z, y, z + 7, y + 8, "#f6eedb", 0.8, W + 0.1);
      c.sd(z + 1, y + 1, z + 6, y + 7, "#4a6078", 0.5, W + 0.2);
    }
  }
  // a roof water tank on stilts
  const [tx, ty] = c.pr(30, H + 2, 18);
  c.out.push(
    path(`M${n(tx - 5)} ${n(ty)}l-1 8M${n(tx + 5)} ${n(ty)}l1 8`, "none", {
      stroke: INK,
      strokeWidth: 1,
    }),
  );
  c.out.push(
    path(
      `M${n(tx - 6)} ${n(ty)}V${n(ty - 9)}Q${n(tx)} ${n(ty - 12)} ${n(tx + 6)} ${n(ty - 9)}V${n(ty)}Z`,
      c.gr(tx - 6, tx + 6, "#a8784a", "#6a4424"),
      c.st(0.9),
    ),
  );
  return finish("Town Gazette (map)", c, D);
}

/** Coroner: a squat, pale green-grey institutional block with a loading bay and green lamps. */
function coroner(flat) {
  const D = new Defs("bco");
  const c = ctx(flat, D, 12, 80);
  const W = 58;
  const Dp = 34;
  const H = 24;
  c.shadow(W, Dp);
  c.box(0, W, 0, H, 0, Dp, {
    front: ["#d6e2d8", "#aec0b4"],
    side: ["#8da294", "#657a6c"],
    top: "#9db0a2",
  });
  c.add(
    c.P3([
      [-1.5, H, -1.5],
      [W + 1.5, H, -1.5],
      [W + 1.5, H + 2.5, -1.5],
      [-1.5, H + 2.5, -1.5],
    ]),
    "#e8f0ea",
    c.st(0.9),
  );
  c.add(
    c.P3([
      [W + 1.5, H, -1.5],
      [W + 1.5, H, Dp + 1.5],
      [W + 1.5, H + 2.5, Dp + 1.5],
      [W + 1.5, H + 2.5, -1.5],
    ]),
    "#9aaea0",
    c.st(0.9),
  );
  // a green sign plate and lettering
  c.fr(12, 19, 46, 25.5, "#2f5a44", 0.9, -0.2);
  c.text("CORONER", 15.8, 20.4, 4.4, "#e8f4ea", 0.17);
  // a double steel door under a flat canopy, round lamps in green
  c.fr(23, 0, 35, 14, "#8a9aa4", 0.9);
  c.fline(
    [
      [29, 0.5],
      [29, 14],
    ],
    INK,
    0.6,
  );
  for (const x of [24.4, 30.4]) {
    c.fr(x, 8, x + 3.6, 12.5, "#3c5a6a", 0.5, -0.2);
  }
  c.add(
    c.P3([
      [20, 15, -0.2],
      [38, 15, -0.2],
      [38, 16.5, -5.5],
      [20, 16.5, -5.5],
    ]),
    "#5a8a70",
    c.st(0.8),
  );
  for (const x of [18, 40]) {
    const [lx, ly] = c.pr(x, 12, -1);
    c.out.push(circle(lx, ly, 2.2, "#4ad88a", c.st(0.8)));
    c.out.push(circle(lx - 0.7, ly - 0.7, 0.7, "#e6fff0"));
  }
  // frosted tall windows
  for (const x of [4, 45]) {
    c.fr(x, 6, x + 9, 19, "#f0f6f2", 0.8);
    c.fr(x + 1, 7, x + 8, 18, "#c4dcd4", 0.5, -0.2);
    if (!flat)
      for (const yy of [10, 13, 16])
        c.fline(
          [
            [x + 1, yy],
            [x + 8, yy],
          ],
          "#98b8ac",
          0.4,
          -0.3,
        );
  }
  for (const z of [5, 19]) {
    c.sd(z, 6, z + 9, 19, "#f0f6f2", 0.8, W + 0.1);
    c.sd(z + 1, 7, z + 8, 18, "#c4dcd4", 0.5, W + 0.2);
  }
  // the long hearse bay: a roller door at the right end of the side, with a white van tail
  c.sd(12, 0, 29, 14, "#6a7a80", 0.9, W + 0.1);
  if (!flat)
    for (let y = 2; y < 14; y += 2.4)
      c.sline(
        [
          [12, y],
          [29, y],
        ],
        "#4a585e",
        0.4,
        W + 0.2,
      );
  // rooftop vent
  c.box(8, 18, H + 2.5, H + 7, 12, 20, {
    front: ["#a8b8ac", "#8ea094"],
    side: ["#6e8074", "#54665a"],
    top: "#bccabf",
  });
  return finish("Coroner (map)", c, D);
}

/** Health Department: a white clinic with a green stripe, a green cross and a sign. */
function health(flat) {
  const D = new Defs("bhd");
  const c = ctx(flat, D, 12, 84);
  const W = 52;
  const Dp = 34;
  const H = 34;
  c.shadow(W, Dp);
  c.box(0, W, 0, H, 0, Dp, {
    front: ["#f2f4ee", "#d0d6cc"],
    side: ["#a6aca2", "#7c8278"],
    top: "#bcc4ba",
  });
  // green band below the roof
  c.fr(-0.2, H - 6, W + 0.2, H, "#4a9a58", 0.8, -0.05);
  c.sd(0, H - 6, Dp, H, "#2e6a3c", 0.8, W + 0.05);
  // green cross emblem in a white disc
  const [ex, ey] = c.pr(26, H - 3, -0.4);
  c.out.push(ellipse(ex, ey, 3.2, 3.2, "#ffffff", c.st(0.7)));
  c.out.push(
    path(`M${n(ex - 1)} ${n(ey - 2.4)}h2v1.4h1.4v2h-1.4v1.4h-2v-1.4h-1.4v-2h1.4z`, "#1e8a3a"),
  );
  // sign
  c.fr(10, 20, 42, 27.5, "#2a6a3c", 0.9, -0.2);
  c.text("HEALTH", 14, 21.6, 4.6, "#f4f8ee", 0.17);
  // windows: a row of four on the first floor, two beside the door
  for (const x of [4, 14, 33, 43]) {
    c.fr(x, 8, x + 6, 18, "#ffffff", 0.7);
    c.fr(x + 0.8, 9, x + 5.2, 17, "#7ab0cc", 0.5, -0.2);
  }
  // door with a green awning
  c.fr(22.5, 0, 29.5, 13, "#3c7a4c", 0.9);
  c.fr(24, 5, 28, 12, "#bfe0d0", 0.5, -0.2);
  c.add(
    c.P3([
      [20, 14, -0.2],
      [32, 14, -0.2],
      [32, 15.5, -5],
      [20, 15.5, -5],
    ]),
    "#2e8a4c",
    c.st(0.8),
  );
  // side windows, two floors
  for (const z of [5, 14, 23]) {
    for (const y of [6, 17]) {
      c.sd(z, y, z + 6, y + 8, "#ffffff", 0.7, W + 0.1);
      c.sd(z + 0.8, y + 1, z + 5.2, y + 7, "#7ab0cc", 0.5, W + 0.2);
    }
  }
  // a rooftop sign-board: a clipboard-like board on legs with a green tick
  const [bx, by] = c.pr(36, H, 14);
  c.out.push(
    path(`M${n(bx - 5)} ${n(by)}v6M${n(bx + 5)} ${n(by + 1)}v6`, "none", {
      stroke: INK,
      strokeWidth: 1.1,
    }),
  );
  c.out.push(rect(bx - 8, by - 16, 16, 15, "#f6f2de", c.st(0.9)));
  c.out.push(
    path(`M${n(bx - 4)} ${n(by - 8)}l3 3.4l6 -7.5`, "none", {
      stroke: "#1e8a3a",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }),
  );
  return finish("Health Department (map)", c, D);
}

/** Pawn Shop: a narrow brownstone with barred windows, a banner and three gold balls. */
function pawn(flat) {
  const D = new Defs("bpa");
  const c = ctx(flat, D, 16, 84);
  const W = 46;
  const Dp = 32;
  const H = 32;
  c.shadow(W, Dp);
  c.box(0, W, 0, H, 0, Dp, {
    front: ["#a8744c", "#835234"],
    side: ["#6a3c22", "#4a2814"],
    top: "#5a4030",
  });
  if (!flat) {
    for (let y = 3.2; y < H; y += 3.2)
      c.fline(
        [
          [0, y],
          [W, y],
        ],
        "#4a2814",
        0.4,
      );
  }
  // cornice
  c.add(
    c.P3([
      [-1.5, H - 1, -1.5],
      [W + 1.5, H - 1, -1.5],
      [W + 1.5, H + 2, -1.5],
      [-1.5, H + 2, -1.5],
    ]),
    "#d8b070",
    c.st(0.9),
  );
  c.add(
    c.P3([
      [W + 1.5, H - 1, -1.5],
      [W + 1.5, H - 1, Dp + 1.5],
      [W + 1.5, H + 2, Dp + 1.5],
      [W + 1.5, H + 2, -1.5],
    ]),
    "#9a7a44",
    c.st(0.9),
  );
  // yellow banner
  c.fr(2, 18, 44, 26.5, "#f4c830", 0.9, -0.2);
  c.text("PAWN", 12, 19.8, 5.2, "#2a1a08", 0.18);
  // door on the left, barred shop window on the right
  c.fr(4, 0, 13, 15, "#2a1a0e", 0.9);
  c.fr(5.5, 6, 11.5, 14, "#c8a860", 0.5, -0.2);
  c.fr(17, 3, 42, 15.5, "#e8d8b0", 0.8);
  c.fr(18, 4, 41, 14.5, "#3a2a1a", 0.5, -0.2);
  // goods in the window: a guitar-ish shape, a clock, a trumpet bell
  c.fr(20, 4, 40, 5.2, "#6a4a2a", 0.4, -0.3);
  const [gx, gy] = c.pr(24, 8.5, -0.5);
  c.out.push(ellipse(gx, gy, 2.6, 3.2, "#d0a040", c.st(0.6)));
  c.out.push(path(`M${n(gx)} ${n(gy - 3)}l-.2 -4`, "none", { stroke: INK, strokeWidth: 0.7 }));
  const [cx2, cy2] = c.pr(31, 9, -0.5);
  c.out.push(circle(cx2, cy2, 2.8, "#f0ecdc", c.st(0.6)));
  c.out.push(
    path(`M${n(cx2)} ${n(cy2)}v-1.8M${n(cx2)} ${n(cy2)}l1.4 .8`, "none", {
      stroke: INK,
      strokeWidth: 0.5,
    }),
  );
  const [rx, ry] = c.pr(37, 8, -0.5);
  c.out.push(path(`M${n(rx - 3)} ${n(ry + 2)}l5 -2l1 3.2z`, "#c8c8d0", c.st(0.5)));
  // bars across the window
  for (let x = 20; x < 42; x += 4)
    c.fline(
      [
        [x, 4],
        [x, 14.5],
      ],
      "#9a9aa4",
      0.5,
      -0.4,
    );
  // side windows with bars
  for (const z of [5, 17]) {
    for (const y of [5, 19]) {
      c.sd(z, y, z + 7, y + 9, "#e8d8b0", 0.7, W + 0.1);
      c.sd(z + 1, y + 1, z + 6, y + 8, "#3a2a1a", 0.5, W + 0.2);
      c.sline(
        [
          [z + 3.5, y + 1],
          [z + 3.5, y + 8],
        ],
        "#9a9aa4",
        0.5,
        W + 0.3,
      );
    }
  }
  // the three gold balls hanging from a bracket over the pavement, at the right corner
  const postFoot = c.pr(W + 5, 0, -10);
  const arm0 = c.pr(W + 5, 33, -10);
  const arm1 = c.pr(W - 2, 33, -10);
  c.out.push(
    path(
      `M${n(postFoot[0])} ${n(postFoot[1])}L${n(arm0[0])} ${n(arm0[1])}L${n(arm1[0])} ${n(arm1[1])}`,
      "none",
      { stroke: INK, strokeWidth: 1.3, strokeLinejoin: "round" },
    ),
  );
  const hang = (cx, cy, r) =>
    c.out.push(
      circle(
        cx,
        cy,
        r,
        flat
          ? "#e8b830"
          : c.D.rg(cx - r * 0.3, cy - r * 0.35, r * 1.3, [
              [0, "#fff4a0"],
              [0.55, "#e8b830"],
              [1, "#8a6410"],
            ]),
        c.st(0.8),
      ),
    );
  c.out.push(path(`M${n(arm1[0])} ${n(arm1[1])}v3`, "none", { stroke: INK, strokeWidth: 0.8 }));
  hang(arm1[0] - 3.6, arm1[1] + 7, 3.4);
  hang(arm1[0] + 3.6, arm1[1] + 6.6, 3.4);
  hang(arm1[0], arm1[1] + 12.4, 3.4);
  return finish("Pawn Shop (map)", c, D);
}

/** Mourne & Sons: a charcoal Victorian funeral home with a porch, a gable and a brass plaque. */
function mournes(flat) {
  const D = new Defs("bmo");
  const c = ctx(flat, D, 10, 84);
  const W = 60;
  const Dp = 36;
  const H = 24;
  c.shadow(W, Dp);
  c.box(0, W, 0, H, 0, Dp, {
    front: ["#585a62", "#3e4048"],
    side: ["#34363e", "#1e2026"],
    top: "#2a2c32",
  });
  c.roofFront(0, W, H, 0, Dp, 16, {
    gable: "#46484f",
    slope: ["#4a4e5c", "#2a2e3a"],
    course: "#14161c",
  });
  // pale trim at the eaves
  c.fr(-2.5, H - 1.5, W + 2.5, H + 0.5, "#e8e4d8", 0.8, -2.2);
  // a gabled porch in the middle: two white columns and a pediment
  c.add(
    c.P3([
      [16, 18, -9],
      [44, 18, -9],
      [30, 28, -9],
    ]),
    "#f4f0e4",
    c.st(0.9),
  );
  c.fr(14, 15.5, 46, 19, "#e8e4d8", 0.8, -9);
  for (const x of [17, 41]) c.fr(x, 0, x + 3, 16, "#faf6ea", 0.8, -9);
  // porch floor and the step
  c.add(
    c.P3([
      [12, 0.3, -11],
      [48, 0.3, -11],
      [48, 0.3, 0],
      [12, 0.3, 0],
    ]),
    "#9c9ca4",
    c.st(0.8),
  );
  // the black door with a wreath
  c.fr(25, 0, 35, 14, "#14141a", 0.9, -0.2);
  c.fr(26.5, 6, 33.5, 13, "#2c2c36", 0.5, -0.3);
  const [wx, wy] = c.pr(30, 9.5, -0.6);
  c.out.push(circle(wx, wy, 3.2, "none", { stroke: "#3a7a42", strokeWidth: 1.8 }));
  c.out.push(circle(wx, wy + 3.2, 1, "#e8e8f0"));
  // arched windows either side, lit yellow
  for (const x of [4, 46]) {
    c.add(
      c.P3([
        [x, 6, -0.2],
        [x + 9, 6, -0.2],
        [x + 9, 15, -0.2],
        [x + 4.5, 18, -0.2],
        [x, 15, -0.2],
      ]),
      "#f4e4a0",
      c.st(0.8),
    );
    c.fline(
      [
        [x + 4.5, 6],
        [x + 4.5, 17],
      ],
      "#6a5a30",
      0.5,
      -0.3,
    );
    c.fline(
      [
        [x, 11],
        [x + 9, 11],
      ],
      "#6a5a30",
      0.5,
      -0.3,
    );
  }
  // side windows
  for (const z of [5, 17, 28]) {
    c.sd(z, 6, z + 5, 16, "#f4e4a0", 0.8, W + 0.1);
    c.sline(
      [
        [z + 2.5, 6],
        [z + 2.5, 16],
      ],
      "#6a5a30",
      0.5,
      W + 0.2,
    );
  }
  // brass plaque beside the porch
  c.fr(49, 8, 56, 12, "#d8aa3c", 0.6, -0.3);
  // a black lantern on a post at the kerb and a spray of lilies
  const [lx, ly] = c.pr(6, 0, -9);
  c.out.push(path(`M${n(lx)} ${n(ly)}v-14`, "none", { stroke: INK, strokeWidth: 1.2 }));
  c.out.push(rect(lx - 2.2, ly - 19, 4.4, 5.6, "#f8e8a0", c.st(0.8)));
  c.out.push(path(`M${n(lx - 3)} ${n(ly - 19)}l3 -3l3 3z`, "#2a2a30", c.st(0.7)));
  for (const [dx, col] of [
    [-2.5, "#ffffff"],
    [0, "#f4f0e0"],
    [2.5, "#ffffff"],
  ]) {
    const p = c.pr(52 + dx, 0, -9);
    c.out.push(path(`M${n(p[0])} ${n(p[1])}v-5`, "none", { stroke: "#2c6a38", strokeWidth: 0.9 }));
    c.out.push(ellipse(p[0], p[1] - 6.2, 1.6, 2.2, col, c.st(0.4)));
  }
  return finish("Mourne & Sons (map)", c, D);
}

/** Wraps the finished context in a standalone SVG sized like the other map buildings. */
function finish(title, c, D) {
  const [s, tx, ty] = FIT[title] ?? [1, 0, 0];
  const body = `<g transform="translate(${n(tx)} ${n(ty)}) scale(${n(s, 3)})">${c.out.join("")}</g>`;
  return doc({ title, body, defs: D, w: 120, h: 108 }).replace(
    "<svg ",
    '<svg preserveAspectRatio="none" ',
  );
}

export const BUILDINGS = {
  "police-station": police,
  crematorium,
  florist,
  gazette,
  coroner,
  "health-department": health,
  "pawn-shop": pawn,
  mournes,
};

const meta = {
  "police-station": [
    "Police Station",
    "A blue-grey stone block with a navy POLICE band, two blue globe lamps, barred windows, a flag and a red-and-blue beacon on the roof.",
  ],
  crematorium: [
    "Crematorium",
    "A low brick block with an iron oven door and a flame over it, grilled high windows, a tall brick chimney with a drift of smoke and an iron fence.",
  ],
  florist: [
    "Florist",
    "A rose-pink cottage under a green shingled gable, striped awnings, window boxes of blooms, a flower sign and buckets of cut flowers at the kerb.",
  ],
  gazette: [
    "Town Gazette",
    "A tall, narrow tan brick newspaper office with a red GAZETTE masthead, a clock, three floors of windows, a roof water tank and a headline board.",
  ],
  coroner: [
    "Coroner",
    "A squat pale green-grey institutional block with a green CORONER plate, green lamps, frosted windows and a roller-door hearse bay on the side.",
  ],
  "health-department": [
    "Health Department",
    "A white clinic with a green band and cross, a green HEALTH sign, a green awning over the door and a clipboard-board on the roof.",
  ],
  "pawn-shop": [
    "Pawn Shop",
    "A narrow brownstone with a yellow PAWN banner, a barred window of clocks and instruments, and the three gold balls on a bracket.",
  ],
  mournes: [
    "Mourne & Sons",
    "A charcoal Victorian funeral home with a slate gable, white pillared porch, black door with a wreath, lit arched windows and a lantern.",
  ],
};

export const pieces = Object.entries(BUILDINGS).map(([id, render]) => ({
  id: `ui/building-${id}`,
  kind: "ui",
  overrides: `client placeholder placeholders/building-${id}.svg`,
  usedBy: "the Deathville map, Expanded towns",
  grade: "B",
  notes: meta[id][1],
  viewBox: VIEWBOX,
  previewWidth: 240,
  previewBg: "#888888",
  render: () => render(false),
}));
