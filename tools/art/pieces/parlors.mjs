/**
 * The player's parlor in five stages, Shack to Colonial Mansion (Expanded 7.2), drawn as one
 * series in the outlined object style of the original places/funeral_home(sucky) and (black):
 * same 3/4 view, same light, the same green roof and brown door all the way up.
 */
import { lettering } from "../font.mjs";
import {
  circle,
  Defs,
  doc,
  ellipse,
  g,
  n,
  path,
  poly,
  rect,
  rng,
  scallop,
  shade,
  tint,
} from "../lib.mjs";

const INK = "#141010";
const ROOF = "#586838";
const DOOR = "#4a2a14";

/** Projection for one drawing: origin (ox, oy) at the front-left-bottom corner, k px per metre. */
function proj(ox, oy, k) {
  return (x, y, z) => [ox + (x * 0.94 + z * 0.62) * k, oy + (x * 0.2 - z * 0.42 - y) * k];
}

function builder(D, pr, lw) {
  const st = (w = lw) => ({ stroke: INK, strokeWidth: w, strokeLinejoin: "round" });
  const P3 = (pts) => poly(pts.map(([x, y, z]) => pr(x, y, z)));
  const api = {
    st,
    P3,
    /** A box with a gable roof whose ridge runs along x. */
    house({
      x0 = 0,
      z0 = 0,
      w,
      d,
      h,
      rh,
      wall,
      roof = ROOF,
      over = 0.3,
      wallSide,
      clap = true,
      side = true,
    }) {
      const out = [];
      const x1 = x0 + w;
      const z1 = z0 + d;
      const zm = z0 + d / 2;
      const sideC = wallSide ?? shade(wall, 0.22);
      if (side)
        out.push(
          path(
            P3([
              [x1, 0, z0],
              [x1, 0, z1],
              [x1, h, z1],
              [x1, h + rh, zm],
              [x1, h, z0],
            ]),
            sideC,
            st(),
          ),
        );
      const fp = pr(x0, 0, z0);
      const fq = pr(x1, 0, z0);
      out.push(
        path(
          P3([
            [x0, 0, z0],
            [x1, 0, z0],
            [x1, h, z0],
            [x0, h, z0],
          ]),
          D.lg(fp[0], 0, fq[0], 0, [
            [0, tint(wall, 0.12)],
            [1, shade(wall, 0.06)],
          ]),
          st(),
        ),
      );
      if (clap) {
        let lines = "";
        for (let y = 0.35; y < h; y += 0.35) {
          const a = pr(x0, y, z0);
          const b = pr(x1, y, z0);
          const c = pr(x1, y, z1);
          lines += `M${n(a[0])} ${n(a[1])}L${n(b[0])} ${n(b[1])}`;
          if (y < h && side) lines += `M${n(b[0])} ${n(b[1])}L${n(c[0])} ${n(c[1])}`;
        }
        out.push(
          path(lines, "none", { stroke: shade(wall, 0.3), strokeWidth: lw * 0.4, opacity: 0.7 }),
        );
      }
      // roof: the front slope, and the gable's verge on the side
      out.push(
        path(
          P3([
            [x0 - over, h - 0.05, z0 - over],
            [x1 + over, h - 0.05, z0 - over],
            [x1 + over, h + rh, zm],
            [x0 - over, h + rh, zm],
          ]),
          D.lg(0, pr(0, h + rh, zm)[1], 0, pr(0, h, z0)[1], [
            [0, shade(roof, 0.15)],
            [1, tint(roof, 0.12)],
          ]),
          st(),
        ),
      );
      let shingles = "";
      for (let t = 0.2; t < 1; t += 0.2) {
        const a = pr(x0 - over, h + rh * t, z0 - over + (zm - z0 + over) * t);
        const b = pr(x1 + over, h + rh * t, z0 - over + (zm - z0 + over) * t);
        shingles += `M${n(a[0])} ${n(a[1])}L${n(b[0])} ${n(b[1])}`;
      }
      out.push(path(shingles, "none", { stroke: shade(roof, 0.35), strokeWidth: lw * 0.5 }));
      out.push(
        path(
          P3([
            [x1 + over, h - 0.05, z0 - over],
            [x1 + over, h + rh, zm],
            [x1 + over, h - 0.05, z1 + over],
            [x1 + over, h + 0.15, z1 + over],
            [x1 + over, h + rh + 0.2, zm],
            [x1 + over, h + 0.15, z0 - over],
          ]),
          shade(roof, 0.3),
          st(),
        ),
      );
      return out.join("");
    },
    /** A rectangle on the front plane (z = z0), x1..x2, y1..y2. */
    front(x1, y1, x2, y2, fill, z0 = 0, w = lw) {
      return path(
        P3([
          [x1, y1, z0],
          [x2, y1, z0],
          [x2, y2, z0],
          [x1, y2, z0],
        ]),
        fill,
        st(w),
      );
    },
    /** A rectangle on the side plane (x = x0), z1..z2. */
    side(x0, z1, y1, z2, y2, fill, w = lw) {
      return path(
        P3([
          [x0, y1, z1],
          [x0, y1, z2],
          [x0, y2, z2],
          [x0, y2, z1],
        ]),
        fill,
        st(w),
      );
    },
    /** A window on the front: glass, frame, cross bars, optional shutters. */
    window(x, y, w, h, o = {}) {
      const { z0 = 0, shutters = null, boarded = false, glass = "#5a7a8a" } = o;
      const out = [];
      if (shutters) {
        out.push(api.front(x - w * 0.45, y, x, y + h, shutters, z0 - 0.01));
        out.push(api.front(x + w, y, x + w * 1.45, y + h, shutters, z0 - 0.01));
      }
      const a = pr(x, y + h, z0);
      const b = pr(x + w, y, z0);
      out.push(
        path(
          P3([
            [x, y, z0],
            [x + w, y, z0],
            [x + w, y + h, z0],
            [x, y + h, z0],
          ]),
          D.lg(a[0], a[1], b[0], b[1], [
            [0, tint(glass, 0.35)],
            [1, shade(glass, 0.2)],
          ]),
          st(),
        ),
      );
      const m1 = pr(x + w / 2, y, z0);
      const m2 = pr(x + w / 2, y + h, z0);
      const m3 = pr(x, y + h / 2, z0);
      const m4 = pr(x + w, y + h / 2, z0);
      out.push(
        path(
          `M${n(m1[0])} ${n(m1[1])}L${n(m2[0])} ${n(m2[1])}M${n(m3[0])} ${n(m3[1])}L${n(m4[0])} ${n(m4[1])}`,
          "none",
          { stroke: "#f4f0e8", strokeWidth: lw * 0.8 },
        ),
      );
      if (boarded) {
        out.push(
          path(
            P3([
              [x - 0.1, y + 0.1, z0 - 0.02],
              [x + w + 0.1, y + h - 0.25, z0 - 0.02],
              [x + w + 0.1, y + h - 0.05, z0 - 0.02],
              [x - 0.1, y + 0.3, z0 - 0.02],
            ]),
            "#8a6a40",
            st(),
          ),
        );
        out.push(
          path(
            P3([
              [x - 0.1, y + h - 0.1, z0 - 0.02],
              [x + w + 0.1, y + 0.05, z0 - 0.02],
              [x + w + 0.1, y + 0.25, z0 - 0.02],
              [x - 0.1, y + h + 0.1, z0 - 0.02],
            ]),
            "#7a5a34",
            st(),
          ),
        );
      }
      out.push(api.front(x - 0.08, y - 0.12, x + w + 0.08, y, "#e8e4d8", z0 - 0.01, lw * 0.8));
      return out.join("");
    },
    door(x, w, h, o = {}) {
      const { z0 = 0, colour = DOOR } = o;
      const out = [api.front(x, 0, x + w, h, colour, z0)];
      const k = pr(x + w * 0.8, h * 0.45, z0);
      out.push(circle(k[0], k[1], lw * 0.9, "#e8c060"));
      out.push(
        path(
          P3([
            [x + 0.12, h * 0.55, z0],
            [x + w - 0.12, h * 0.55, z0],
            [x + w - 0.12, h - 0.15, z0],
            [x + 0.12, h - 0.15, z0],
          ]),
          "none",
          { stroke: shade(colour, 0.4), strokeWidth: lw * 0.5 },
        ),
      );
      return out.join("");
    },
    cross(x, y, s, z0 = 0, colour = "#c9a032") {
      return path(
        P3([
          [x - 0.08 * s, y, z0],
          [x + 0.08 * s, y, z0],
          [x + 0.08 * s, y + s, z0],
          [x - 0.08 * s, y + s, z0],
        ]) +
          P3([
            [x - 0.3 * s, y + 0.62 * s, z0],
            [x + 0.3 * s, y + 0.62 * s, z0],
            [x + 0.3 * s, y + 0.78 * s, z0],
            [x - 0.3 * s, y + 0.78 * s, z0],
          ]),
        colour,
        st(lw * 0.7),
      );
    },
    steps(x, w, n2, z0 = 0) {
      let out = "";
      for (let i = 0; i < n2; i++) {
        const y = 0.18 * (n2 - i - 1);
        const zz = z0 - 0.35 * (n2 - i);
        out += path(
          P3([
            [x - 0.1 * i, y, zz],
            [x + w + 0.1 * i, y, zz],
            [x + w + 0.1 * i, y + 0.18, zz],
            [x - 0.1 * i, y + 0.18, zz],
          ]),
          "#d8d4c8",
          st(lw * 0.7),
        );
        out += path(
          P3([
            [x - 0.1 * i, y + 0.18, zz],
            [x + w + 0.1 * i, y + 0.18, zz],
            [x + w + 0.1 * i, y + 0.18, zz + 0.35],
            [x - 0.1 * i, y + 0.18, zz + 0.35],
          ]),
          "#f0ece0",
          st(lw * 0.7),
        );
      }
      return out;
    },
    column(x, z, h, r = 0.18) {
      const a = pr(x - r, 0, z);
      const b = pr(x + r, h, z);
      return path(
        P3([
          [x - r, 0, z],
          [x + r, 0, z],
          [x + r, h, z],
          [x - r, h, z],
        ]),
        D.lg(a[0], 0, b[0], 0, [
          [0, "#ffffff"],
          [0.6, "#e0dcd0"],
          [1, "#a8a498"],
        ]),
        st(lw * 0.8),
      );
    },
  };
  return api;
}

function ground(cx, cy, rx, ry, kind, R) {
  if (kind === "dirt") {
    return g([
      ellipse(cx, cy, rx, ry, "#5a4128"),
      ellipse(cx, cy, rx, ry, "none", { stroke: "#2a1a0e", strokeWidth: 1.2 }),
      path(
        scallop(
          [
            [cx - rx * 0.6, cy + 4],
            [cx - rx * 0.2, cy + ry * 0.4],
            [cx + rx * 0.3, cy + 6],
          ],
          0.4,
          R,
        ),
        "#3d2c1a",
        { opacity: 0.6 },
      ),
    ]);
  }
  return g([
    ellipse(cx, cy, rx, ry, "#4a6a2a"),
    ellipse(cx, cy, rx, ry, "none", { stroke: "#1a2a0e", strokeWidth: 1.2 }),
    ellipse(cx - rx * 0.15, cy - ry * 0.15, rx * 0.75, ry * 0.6, "#5a7a34", { opacity: 0.8 }),
  ]);
}

function bush(x, y, r, R) {
  return g([
    path(
      scallop(
        [
          [x - r, y],
          [x - r * 0.8, y - r * 0.9],
          [x, y - r * 1.2],
          [x + r * 0.8, y - r * 0.9],
          [x + r, y],
        ],
        0.45,
        R,
      ),
      "#3a5a24",
      { stroke: INK, strokeWidth: 1 },
    ),
    path(
      scallop(
        [
          [x - r * 0.6, y - r * 0.5],
          [x - r * 0.3, y - r * 1.0],
          [x + r * 0.2, y - r * 0.9],
        ],
        0.5,
        R,
      ),
      "#5a7a34",
    ),
  ]);
}

/** Stage 1: the Shack. */
function stage1(D, R) {
  const pr = proj(150, 300, 30);
  const b = builder(D, pr, 1.6);
  const out = [ground(275, 300, 220, 46, "dirt", R)];
  out.push(b.house({ w: 6.4, d: 4.2, h: 3.2, rh: 1.7, wall: "#a89888", clap: false }));
  // vertical boards, one hanging loose
  let boards = "";
  for (let x = 0.5; x < 6.4; x += 0.5) {
    const a = pr(x, 0, 0);
    const c = pr(x, 3.2, 0);
    boards += `M${n(a[0])} ${n(a[1])}L${n(c[0])} ${n(c[1])}`;
  }
  out.push(path(boards, "none", { stroke: "#6a5a4a", strokeWidth: 0.8 }));
  out.push(
    path(
      b.P3([
        [5.2, 0.2, -0.05],
        [5.6, 0.1, -0.05],
        [5.9, 2.0, -0.05],
        [5.5, 2.1, -0.05],
      ]),
      "#8a7a64",
      b.st(1),
    ),
  );
  // a hole in the roof
  out.push(
    path(
      b.P3([
        [3.6, 3.9, 0.9],
        [4.6, 3.9, 0.9],
        [4.4, 4.3, 1.5],
        [3.8, 4.4, 1.5],
      ]),
      "#1a120a",
      b.st(1),
    ),
  );
  // boarded window, crooked door, crooked cross
  out.push(b.window(0.7, 1.2, 1.4, 1.2, { boarded: true, glass: "#2a3a40" }));
  out.push(b.door(3.0, 1.2, 2.3, { colour: "#5a3a1e" }));
  out.push(
    g(b.cross(3.6, 2.5, 0.9, -0.02, "#7a5a2a"), {
      transform: `rotate(12 ${n(pr(3.6, 2.9, 0)[0])} ${n(pr(3.6, 2.9, 0)[1])})`,
    }),
  );
  // side window, broken
  out.push(b.side(6.4, 1.2, 1.2, 2.6, 2.3, "#2a3a40"));
  out.push(
    path(`M${n(pr(6.4, 2.3, 1.5)[0])} ${n(pr(6.4, 2.3, 1.5)[1])}l6 10l-4 4l8 6`, "none", {
      stroke: "#e8f0f4",
      strokeWidth: 1.2,
    }),
  );
  // steps of two crates, a tin can
  out.push(b.steps(2.9, 1.4, 1));
  out.push(path("M420 314l14 -4l2 8l-14 4z", "#a8a8a0", b.st(1)));
  return out.join("");
}

/** Stage 2: the Fixer-Upper, painted, with a porch and a sign. */
function stage2(D, R) {
  const pr = proj(120, 310, 28);
  const b = builder(D, pr, 1.5);
  const out = [ground(275, 306, 238, 50, "grass", R)];
  out.push(b.house({ w: 8, d: 5, h: 3.6, rh: 1.9, wall: "#d8cca0" }));
  // porch roof on posts
  out.push(
    path(
      b.P3([
        [2.6, 2.7, -1.6],
        [5.6, 2.7, -1.6],
        [5.6, 3.1, 0],
        [2.6, 3.1, 0],
      ]),
      ROOF,
      b.st(),
    ),
  );
  out.push(b.column(2.8, -1.5, 2.7, 0.1));
  out.push(b.column(5.4, -1.5, 2.7, 0.1));
  out.push(b.door(3.5, 1.2, 2.5));
  out.push(b.cross(4.1, 2.62, 0.5, -0.02));
  out.push(b.window(0.9, 1.3, 1.3, 1.4, { shutters: "#3a5a3a" }));
  out.push(b.window(6.2, 1.3, 1.3, 1.4, { shutters: "#3a5a3a" }));
  out.push(b.side(8, 1.4, 1.3, 2.8, 2.7, "#5a7a8a"));
  out.push(b.steps(3.3, 1.6, 2, -1.5));
  // the sign on two posts in the yard
  const s1 = pr(-1.4, 0, -2.2);
  out.push(
    path(`M${n(s1[0])} ${n(s1[1])}v-46M${n(s1[0] + 60)} ${n(s1[1] + 12)}v-46`, "none", {
      stroke: "#5a3a1e",
      strokeWidth: 3,
    }),
  );
  out.push(path(`M${n(s1[0] - 6)} ${n(s1[1] - 64)}l72 14v24l-72 -14z`, "#f0ead8", b.st(1.2)));
  out.push(
    lettering("FUNERAL", s1[0] + 30, s1[1] - 56, 8, "#3a2a1a", {
      align: "middle",
      weight: 0.16,
      transform: `rotate(11 ${n(s1[0] + 30)} ${n(s1[1] - 50)})`,
    }),
  );
  out.push(bush(470, 300, 20, R));
  return out.join("");
}

/** Stage 3: Respectable, two storeys, a portico and a picket fence. */
function stage3(D, R) {
  const pr = proj(100, 320, 25);
  const b = builder(D, pr, 1.4);
  const out = [ground(275, 312, 250, 54, "grass", R)];
  // chimney behind
  out.push(
    path(
      b.P3([
        [7.6, 5, 3.2],
        [8.4, 5, 3.2],
        [8.4, 9.6, 3.2],
        [7.6, 9.6, 3.2],
      ]),
      "#8a4a3a",
      b.st(),
    ),
  );
  out.push(b.house({ w: 10, d: 6, h: 6.2, rh: 2.4, wall: "#ece8dc" }));
  for (const x of [0.9, 3.0, 6.3, 8.4]) {
    out.push(b.window(x, 3.7, 1.0, 1.5, { shutters: "#2a4a3a" }));
    if (x !== 3.0 && x !== 6.3) out.push(b.window(x, 0.9, 1.0, 1.6, { shutters: "#2a4a3a" }));
  }
  out.push(b.side(10, 1.4, 3.7, 2.6, 5.2, "#5a7a8a"));
  out.push(b.side(10, 3.6, 3.7, 4.8, 5.2, "#5a7a8a"));
  // portico: two columns and a pediment
  out.push(
    path(
      b.P3([
        [3.8, 3.2, -1.6],
        [6.2, 3.2, -1.6],
        [6.2, 3.4, 0],
        [3.8, 3.4, 0],
      ]),
      "#e8e4d8",
      b.st(),
    ),
  );
  out.push(
    path(
      b.P3([
        [3.7, 3.4, -1.6],
        [6.3, 3.4, -1.6],
        [5.0, 4.4, -1.6],
      ]),
      "#f4f0e8",
      b.st(),
    ),
  );
  out.push(b.column(3.95, -1.5, 3.2));
  out.push(b.column(6.05, -1.5, 3.2));
  out.push(b.door(4.4, 1.2, 2.6));
  out.push(b.cross(5.0, 3.55, 0.6, -1.62));
  out.push(b.steps(4.0, 2.0, 2, -1.6));
  // a picket fence along the front
  let pickets = "";
  for (let x = -0.6; x < 10.8; x += 0.45) {
    if (x > 3.6 && x < 6.4) continue;
    const a = pr(x, 0, -2.6);
    pickets += `M${n(a[0])} ${n(a[1])}v-16l2 -3l2 3v16z`;
  }
  out.push(path(pickets, "#ffffff", b.st(0.8)));
  out.push(bush(80, 316, 18, R));
  out.push(bush(470, 304, 18, R));
  return out.join("");
}

/** Stage 4: the Chapel House: stage 3 with a chapel wing and steeple. */
function stage4(D, R) {
  const pr = proj(70, 324, 22);
  const b = builder(D, pr, 1.3);
  const out = [ground(275, 316, 258, 56, "grass", R)];
  out.push(
    path(
      b.P3([
        [7.6, 5, 3.2],
        [8.4, 5, 3.2],
        [8.4, 9.6, 3.2],
        [7.6, 9.6, 3.2],
      ]),
      "#8a4a3a",
      b.st(),
    ),
  );
  out.push(b.house({ w: 10, d: 6, h: 6.2, rh: 2.4, wall: "#ece8dc" }));
  for (const x of [0.9, 3.0, 6.3, 8.4]) {
    out.push(b.window(x, 3.7, 1.0, 1.5, { shutters: "#2a4a3a" }));
    if (x !== 3.0 && x !== 6.3) out.push(b.window(x, 0.9, 1.0, 1.6, { shutters: "#2a4a3a" }));
  }
  out.push(
    path(
      b.P3([
        [3.8, 3.2, -1.6],
        [6.2, 3.2, -1.6],
        [6.2, 3.4, 0],
        [3.8, 3.4, 0],
      ]),
      "#e8e4d8",
      b.st(),
    ),
  );
  out.push(
    path(
      b.P3([
        [3.7, 3.4, -1.6],
        [6.3, 3.4, -1.6],
        [5.0, 4.4, -1.6],
      ]),
      "#f4f0e8",
      b.st(),
    ),
  );
  out.push(b.column(3.95, -1.5, 3.2));
  out.push(b.column(6.05, -1.5, 3.2));
  out.push(b.door(4.4, 1.2, 2.6));
  out.push(b.steps(4.0, 2.0, 2, -1.6));
  // the chapel wing to the right, stone, steep roof, rose window, steeple
  out.push(
    b.house({
      x0: 10,
      z0: 0.6,
      w: 5,
      d: 5,
      h: 4.4,
      rh: 3.4,
      wall: "#c8c0b0",
      roof: "#4a5a34",
      clap: false,
    }),
  );
  const rw = pr(12.5, 2.6, 0.6);
  out.push(
    ellipse(
      rw[0],
      rw[1],
      14,
      13,
      D.rg(rw[0], rw[1], 14, [
        [0, "#ffe080"],
        [0.5, "#c04040"],
        [1, "#2a4a8a"],
      ]),
      b.st(),
    ),
  );
  out.push(
    path(`M${n(rw[0] - 14)} ${n(rw[1])}h28M${n(rw[0])} ${n(rw[1] - 13)}v26`, "none", {
      stroke: INK,
      strokeWidth: 1,
    }),
  );
  out.push(b.door(12.0, 1.0, 1.8, { z0: 0.6, colour: "#5a2a14" }));
  // steeple on the ridge
  const sx = 13.2;
  const sz = 3.1;
  out.push(
    path(
      b.P3([
        [sx - 0.6, 7.0, sz - 0.6],
        [sx + 0.6, 7.0, sz - 0.6],
        [sx + 0.6, 9.4, sz - 0.6],
        [sx - 0.6, 9.4, sz - 0.6],
      ]),
      "#e8e4dc",
      b.st(),
    ),
  );
  out.push(
    path(
      b.P3([
        [sx + 0.6, 7.0, sz - 0.6],
        [sx + 0.6, 7.0, sz + 0.6],
        [sx + 0.6, 9.4, sz + 0.6],
        [sx + 0.6, 9.4, sz - 0.6],
      ]),
      "#b8b4a8",
      b.st(),
    ),
  );
  out.push(
    path(
      b.P3([
        [sx - 0.7, 9.4, sz - 0.7],
        [sx + 0.7, 9.4, sz - 0.7],
        [sx + 0.7, 9.4, sz + 0.7],
        [sx, 12.4, sz],
      ]),
      "#4a5a34",
      b.st(),
    ),
  );
  out.push(b.cross(sx, 12.4, 1.2, sz, "#e8c040"));
  out.push(bush(60, 320, 18, R));
  out.push(bush(500, 300, 16, R));
  return out.join("");
}

/** Stage 5: the Colonial Mansion. */
function stage5(D, R) {
  const pr = proj(62, 318, 15.2);
  const b = builder(D, pr, 1.2);
  const out = [ground(275, 318, 268, 58, "grass", R)];
  // chimneys
  for (const x of [2.5, 18.5])
    out.push(
      path(
        b.P3([
          [x, 6, 4.5],
          [x + 0.9, 6, 4.5],
          [x + 0.9, 11.8, 4.5],
          [x, 11.8, 4.5],
        ]),
        "#8a4a3a",
        b.st(),
      ),
    );
  // the two wings and the centre block
  out.push(
    b.house({ x0: 0, z0: 1, w: 7, d: 7, h: 7.4, rh: 2.6, wall: "#f4f0e8", roof: "#4a5a40" }),
  );
  // the centre twice: whole (its gable shows above the wing), then its front and roof over the wing
  out.push(
    b.house({ x0: 7, z0: 0, w: 7, d: 9, h: 8.6, rh: 3.4, wall: "#f8f4ec", roof: "#4a5a40" }),
  );
  out.push(
    b.house({ x0: 14, z0: 0.3, w: 7, d: 8.7, h: 7.4, rh: 2.6, wall: "#f4f0e8", roof: "#4a5a40" }),
  );
  out.push(
    b.house({
      x0: 7,
      z0: 0,
      w: 7,
      d: 9,
      h: 8.6,
      rh: 3.4,
      wall: "#f8f4ec",
      roof: "#4a5a40",
      side: false,
    }),
  );
  const rightWing = "";
  // dormers on the centre roof
  for (const x of [8.2, 11.2]) {
    out.push(
      path(
        b.P3([
          [x, 9.4, 1.2],
          [x + 1.4, 9.4, 1.2],
          [x + 1.4, 10.8, 1.2],
          [x + 0.7, 11.5, 1.2],
          [x, 10.8, 1.2],
        ]),
        "#f4f0e8",
        b.st(),
      ),
    );
    out.push(
      path(
        b.P3([
          [x + 0.3, 9.6, 1.18],
          [x + 1.1, 9.6, 1.18],
          [x + 1.1, 10.6, 1.18],
          [x + 0.3, 10.6, 1.18],
        ]),
        "#5a7a8a",
        b.st(0.8),
      ),
    );
  }
  out.push(rightWing);
  // windows: two rows in each wing, shutters
  for (const [x0, wz] of [
    [0, 1],
    [14, 0.3],
  ]) {
    for (const x of [x0 + 1.0, x0 + 4.4]) {
      out.push(b.window(x, 4.2, 1.4, 2.0, { z0: wz, shutters: "#1e3a2e" }));
      out.push(b.window(x, 1.0, 1.4, 2.2, { z0: wz, shutters: "#1e3a2e" }));
    }
  }
  out.push(b.side(21, 2.6, 4.2, 4.4, 6.2, "#5a7a8a"));
  out.push(b.side(21, 2.6, 1.0, 4.4, 3.2, "#5a7a8a"));
  // the portico: four tall columns and a big pediment with a round window
  const pz = -2.4;
  out.push(
    path(
      b.P3([
        [7.2, 7.8, pz],
        [13.8, 7.8, pz],
        [13.8, 8.4, 0],
        [7.2, 8.4, 0],
      ]),
      "#e8e4d8",
      b.st(),
    ),
  );
  out.push(
    path(
      b.P3([
        [7.0, 8.2, pz],
        [14.0, 8.2, pz],
        [10.5, 10.6, pz],
      ]),
      "#ffffff",
      b.st(),
    ),
  );
  const ow = pr(10.5, 9.0, pz);
  out.push(ellipse(ow[0], ow[1], 7, 6, "#5a7a8a", b.st(0.8)));
  out.push(b.front(7.0, 7.6, 14.0, 8.2, "#f4f0e8", pz));
  for (const x of [7.6, 9.6, 11.4, 13.4]) out.push(b.column(x, pz + 0.1, 7.6, 0.28));
  out.push(b.window(8.0, 4.8, 1.2, 1.9, { glass: "#4a6a7a" }));
  out.push(b.window(12.0, 4.8, 1.2, 1.9, { glass: "#4a6a7a" }));
  out.push(b.door(9.7, 1.6, 3.4));
  // fanlight over the door
  const fl = pr(10.5, 3.5, 0);
  out.push(path(`M${n(fl[0] - 13)} ${n(fl[1] + 1)}a13 9 0 0 1 26 0z`, "#ffe8a0", b.st(0.8)));
  out.push(b.steps(9.0, 3.0, 3, pz + 0.2));
  // a little family mausoleum at the side, and lamp posts
  const mz = 4.2;
  out.push(
    b.house({
      x0: 22.2,
      z0: mz,
      w: 2.6,
      d: 2.6,
      h: 2.6,
      rh: 1.0,
      wall: "#c8c4b8",
      roof: "#8a8a80",
      clap: false,
    }),
  );
  out.push(b.door(23.0, 1.0, 1.8, { z0: mz, colour: "#3a3a3a" }));
  for (const x of [-0.8, 21.6]) {
    const l = pr(x, 0, -3);
    out.push(path(`M${n(l[0])} ${n(l[1])}v-60`, "none", { stroke: "#1a1a1a", strokeWidth: 2.4 }));
    out.push(path(`M${n(l[0] - 6)} ${n(l[1] - 60)}h12l-2 -12h-8z`, "#ffe8a0", b.st(1)));
  }
  // clipped hedges either side of the steps
  for (const x of [6.4, 14.2]) {
    const h = pr(x, 0, -3.2);
    out.push(path(`M${n(h[0] - 30)} ${n(h[1])}v-16q30 -10 60 0v16z`, "#3a5a24", b.st(1)));
  }
  void rect;
  return out.join("");
}

const STAGES = [
  {
    n: 1,
    name: "Shack",
    draw: stage1,
    grade: "B",
    notes:
      "The Shack: weathered boards, a hole in the green roof, a boarded window and a crooked cross; dirt yard.",
  },
  {
    n: 2,
    name: "Fixer-Upper",
    draw: stage2,
    grade: "B",
    notes:
      "The Fixer-Upper: fresh cream clapboard, green shutters, a porch on two posts, a FUNERAL sign in the yard.",
  },
  {
    n: 3,
    name: "Respectable",
    draw: stage3,
    grade: "B",
    notes:
      "Respectable: two white storeys, a pedimented portico, chimney, picket fence and shrubs.",
  },
  {
    n: 4,
    name: "Chapel House",
    draw: stage4,
    grade: "B",
    notes:
      "Chapel House: the Respectable house with a stone chapel wing, rose window and a steeple.",
  },
  {
    n: 5,
    name: "Colonial Mansion",
    draw: stage5,
    grade: "B",
    notes:
      "Colonial Mansion: two wings, a four-column portico with fanlight door, dormers, a family mausoleum and lamps.",
  },
];

const picture = (s) => () => {
  const D = new Defs(`p${s.n}`);
  return doc({
    title: `places/parlor-${s.n}: ${s.name} (Remastered)`,
    body: s.draw(D, rng(40 + s.n)),
    defs: D,
  });
};
/** The office ladder's icon: the same drawing, cropped to the building. */
const icon = (s) => () => {
  const D = new Defs(`i${s.n}`);
  return doc({
    title: `${s.name}`,
    body: s.draw(D, rng(40 + s.n)),
    defs: D,
    w: 64,
    h: 48,
    vb: "4 52 542 406",
  });
};

export const pieces = [
  ...STAGES.map((s) => ({
    id: `places/parlor-${s.n}`,
    kind: "place",
    usedBy: `the office, building level ${s.n - 1} (proposed fg; the engine now names places/funeral_home(sucky) or (black))`,
    grade: s.grade,
    notes: s.notes,
    render: picture(s),
  })),
  ...STAGES.map((s) => ({
    id: `icons/parlor-${s.n}`,
    kind: "icon",
    usedBy: "the office's five-stage ladder (BuildingGlyph)",
    grade: s.grade,
    notes: `${s.name}, the office ladder's step ${s.n}: the places/parlor-${s.n} drawing cropped.`,
    viewBox: "4 52 542 406",
    previewWidth: 256,
    previewBg: "#e8dcc0",
    render: icon(s),
  })),
];
