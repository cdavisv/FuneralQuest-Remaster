/**
 * Chrome pieces for the client pack: the City Hall and Reaper Club map buildings, in the oblique
 * projection, outline and shadow of ui/building-*.svg, and the parlor capsule button in the
 * brass-disc, black-line style of the original capsule buttons.
 */
import { lettering } from "../font.mjs";
import { circle, Defs, doc, ellipse, g, n, path, poly, rect } from "../lib.mjs";
import { iso } from "../parts.mjs";

const INK = "#000000";
const st = (w = 1.3) => ({ stroke: INK, strokeWidth: w, strokeLinejoin: "round" });

function buildingDoc(title, body, D, w, h) {
  return doc({ title, body, defs: D, w, h }).replace("<svg ", '<svg preserveAspectRatio="none" ');
}

/** City Hall: a white classical block with columns, a clock tower and a flag. */
function cityHallIcon() {
  const D = new Defs("ich");
  const pr = iso(14, 92, 1);
  const P3 = (pts) => poly(pts.map(([x, y, z]) => pr(x, y, z)));
  const out = [];
  // the soft shadow, lower right
  out.push(
    path("M30 100Q60 112 100 104Q124 96 118 76Q106 60 84 62Z", "#000", { fillOpacity: 0.2 }),
  );
  const W = 58;
  const Dp = 34;
  const H = 30;
  // body: side (darker), front (light), top
  out.push(
    path(
      P3([
        [W, 0, 0],
        [W, 0, Dp],
        [W, H, Dp],
        [W, H, 0],
      ]),
      D.lg(0, 0, 120, 0, [
        [0, "#b8b4a8"],
        [1, "#8a8678"],
      ]),
      st(),
    ),
  );
  out.push(
    path(
      P3([
        [0, 0, 0],
        [W, 0, 0],
        [W, H, 0],
        [0, H, 0],
      ]),
      D.lg(0, 0, 80, 0, [
        [0, "#f4f2ea"],
        [1, "#d8d4c8"],
      ]),
      st(),
    ),
  );
  out.push(
    path(
      P3([
        [0, H, 0],
        [W, H, 0],
        [W, H, Dp],
        [0, H, Dp],
      ]),
      "#e4e0d4",
      st(),
    ),
  );
  // pediment on the front, centred
  out.push(
    path(
      P3([
        [14, H, -0.5],
        [44, H, -0.5],
        [29, H + 11, -0.5],
      ]),
      "#f8f6f0",
      st(),
    ),
  );
  out.push(
    path(
      P3([
        [18, H + 1.5, -0.6],
        [40, H + 1.5, -0.6],
        [29, H + 9, -0.6],
      ]),
      "none",
      { stroke: "#a8a498", strokeWidth: 0.6 },
    ),
  );
  // columns: five, in the portico's shade
  out.push(
    path(
      P3([
        [12, 2, -0.2],
        [46, 2, -0.2],
        [46, H - 3, -0.2],
        [12, H - 3, -0.2],
      ]),
      "#9a968a",
      st(0.6),
    ),
  );
  for (let i = 0; i < 5; i++) {
    const x = 14 + i * 7.6;
    out.push(
      path(
        P3([
          [x, 2, -0.4],
          [x + 3.4, 2, -0.4],
          [x + 3.4, H - 3, -0.4],
          [x, H - 3, -0.4],
        ]),
        "#ffffff",
        st(0.7),
      ),
    );
  }
  out.push(
    path(
      P3([
        [11, H - 3.4, -0.5],
        [47, H - 3.4, -0.5],
        [47, H, -0.5],
        [11, H, -0.5],
      ]),
      "#f0ece2",
      st(0.8),
    ),
  );
  // the door and windows either side
  out.push(
    path(
      P3([
        [26.5, 2, -0.5],
        [31.5, 2, -0.5],
        [31.5, 13, -0.5],
        [26.5, 13, -0.5],
      ]),
      "#5a3418",
      st(0.7),
    ),
  );
  for (const x of [3, 50]) {
    for (const y of [5, 17])
      out.push(
        path(
          P3([
            [x, y, -0.1],
            [x + 5, y, -0.1],
            [x + 5, y + 8, -0.1],
            [x, y + 8, -0.1],
          ]),
          "#9cc0d8",
          st(0.7),
        ),
      );
  }
  for (const z of [6, 16, 26]) {
    for (const y of [5, 17])
      out.push(
        path(
          P3([
            [W + 0.1, y, z],
            [W + 0.1, y, z + 5],
            [W + 0.1, y + 8, z + 5],
            [W + 0.1, y + 8, z],
          ]),
          "#7a9ab0",
          st(0.7),
        ),
      );
  }
  // steps
  out.push(
    path(
      P3([
        [10, 0, -4],
        [48, 0, -4],
        [48, 2, -4],
        [10, 2, -4],
      ]),
      "#d8d4c8",
      st(0.8),
    ),
  );
  out.push(
    path(
      P3([
        [10, 2, -4],
        [48, 2, -4],
        [48, 2, 0],
        [10, 2, 0],
      ]),
      "#f4f0e8",
      st(0.8),
    ),
  );
  // clock tower on the roof
  const tx = 23;
  const tz = 12;
  out.push(
    path(
      P3([
        [tx + 12, H, tz],
        [tx + 12, H, tz + 10],
        [tx + 12, H + 20, tz + 10],
        [tx + 12, H + 20, tz],
      ]),
      "#a8a498",
      st(),
    ),
  );
  out.push(
    path(
      P3([
        [tx, H, tz],
        [tx + 12, H, tz],
        [tx + 12, H + 20, tz],
        [tx, H + 20, tz],
      ]),
      "#ecE8dc",
      st(),
    ),
  );
  const [cx, cy] = pr(tx + 6, H + 13, tz - 0.1);
  out.push(ellipse(cx, cy, 4.2, 4.4, "#ffffff", st(0.8)));
  out.push(
    path(`M${n(cx)} ${n(cy)}v-3M${n(cx)} ${n(cy)}l2.4 1`, "none", {
      stroke: INK,
      strokeWidth: 0.7,
    }),
  );
  // a green copper dome and the flag
  const [dx, dy] = pr(tx + 6, H + 20, tz + 5);
  out.push(
    path(
      `M${n(dx - 9)} ${n(dy + 1)}Q${n(dx - 9)} ${n(dy - 12)} ${n(dx)} ${n(dy - 13)}Q${n(dx + 9)} ${n(dy - 12)} ${n(dx + 9)} ${n(dy + 1)}Z`,
      D.lg(dx - 9, 0, dx + 9, 0, [
        [0, "#9ad0b8"],
        [1, "#4a8a70"],
      ]),
      st(),
    ),
  );
  out.push(path(`M${n(dx)} ${n(dy - 13)}V${n(dy - 26)}`, "none", { stroke: INK, strokeWidth: 1 }));
  out.push(path(`M${n(dx)} ${n(dy - 26)}l10 3l-10 4z`, "#c03020", st(0.7)));
  return buildingDoc("City Hall (map)", out.join(""), D, 120, 118);
}

/** The Reaper Club: a squat black block with a skull sign on the roof and a red door. */
function reaperIcon() {
  const D = new Defs("irc");
  const pr = iso(12, 90, 1);
  const P3 = (pts) => poly(pts.map(([x, y, z]) => pr(x, y, z)));
  const out = [];
  out.push(path("M26 96Q60 110 100 100Q122 92 116 72Q104 58 82 60Z", "#000", { fillOpacity: 0.2 }));
  const W = 54;
  const Dp = 36;
  const H = 24;
  out.push(
    path(
      P3([
        [W, 0, 0],
        [W, 0, Dp],
        [W, H, Dp],
        [W, H, 0],
      ]),
      D.lg(0, 0, 120, 0, [
        [0, "#2a2230"],
        [1, "#16121a"],
      ]),
      st(),
    ),
  );
  out.push(
    path(
      P3([
        [0, 0, 0],
        [W, 0, 0],
        [W, H, 0],
        [0, H, 0],
      ]),
      D.lg(0, 0, 80, 0, [
        [0, "#4a3a52"],
        [1, "#2e2434"],
      ]),
      st(),
    ),
  );
  out.push(
    path(
      P3([
        [0, H, 0],
        [W, H, 0],
        [W, H, Dp],
        [0, H, Dp],
      ]),
      "#3a3040",
      st(),
    ),
  );
  // brick courses on the front
  let courses = "";
  for (let y = 4; y < H; y += 4) {
    const a = pr(0, y, -0.05);
    const b = pr(W, y, -0.05);
    courses += `M${n(a[0])} ${n(a[1])}L${n(b[0])} ${n(b[1])}`;
  }
  out.push(path(courses, "none", { stroke: "#1a141e", strokeWidth: 0.6 }));
  // red door under a little canopy, purple-lit windows
  out.push(
    path(
      P3([
        [22, 0, -0.2],
        [30, 0, -0.2],
        [30, 13, -0.2],
        [22, 13, -0.2],
      ]),
      "#b01828",
      st(0.8),
    ),
  );
  out.push(
    path(
      P3([
        [20, 14, -0.2],
        [32, 14, -0.2],
        [32, 16, -5],
        [20, 16, -5],
      ]),
      "#7a0a18",
      st(0.8),
    ),
  );
  for (const x of [5, 40])
    out.push(
      path(
        P3([
          [x, 8, -0.1],
          [x + 7, 8, -0.1],
          [x + 7, 14, -0.1],
          [x, 14, -0.1],
        ]),
        "#c060ff",
        st(0.7),
      ),
    );
  for (const z of [8, 22])
    out.push(
      path(
        P3([
          [W + 0.1, 8, z],
          [W + 0.1, 8, z + 7],
          [W + 0.1, 14, z + 7],
          [W + 0.1, 14, z],
        ]),
        "#8a40c0",
        st(0.7),
      ),
    );
  // the skull sign on the roof, on two legs
  const [sx, sy] = pr(27, H, 16);
  out.push(
    path(`M${n(sx - 10)} ${n(sy)}v-8M${n(sx + 10)} ${n(sy - 4)}v-8`, "none", {
      stroke: INK,
      strokeWidth: 1.4,
    }),
  );
  out.push(
    path(
      `M${n(sx - 14)} ${n(sy - 8)}Q${n(sx - 16)} ${n(sy - 34)} ${n(sx)} ${n(sy - 36)}Q${n(sx + 16)} ${n(sy - 34)} ${n(sx + 14)} ${n(sy - 10)}L${n(sx + 8)} ${n(sy - 8)}V${n(sy - 3)}H${n(sx - 8)}V${n(sy - 8)}Z`,
      D.lg(sx - 14, 0, sx + 14, 0, [
        [0, "#ffffff"],
        [1, "#c8c0a8"],
      ]),
      st(),
    ),
  );
  out.push(ellipse(sx - 5.5, sy - 20, 3.6, 4.4, "#d01828"));
  out.push(ellipse(sx + 5.5, sy - 20, 3.6, 4.4, "#d01828"));
  out.push(path(`M${n(sx)} ${n(sy - 16)}l-2 4h4z`, INK));
  out.push(
    path(
      `M${n(sx - 6)} ${n(sy - 8)}v4M${n(sx - 2)} ${n(sy - 8)}v5M${n(sx + 2)} ${n(sy - 8)}v5M${n(sx + 6)} ${n(sy - 8)}v4`,
      "none",
      { stroke: INK, strokeWidth: 0.8 },
    ),
  );
  // a velvet rope on two brass posts
  const r1 = pr(14, 0, -6);
  const r2 = pr(38, 0, -6);
  out.push(
    path(`M${n(r1[0])} ${n(r1[1])}v-6M${n(r2[0])} ${n(r2[1])}v-6`, "none", {
      stroke: "#c8a040",
      strokeWidth: 1.6,
    }),
  );
  out.push(
    path(
      `M${n(r1[0])} ${n(r1[1] - 5)}Q${n((r1[0] + r2[0]) / 2)} ${n((r1[1] + r2[1]) / 2)} ${n(r2[0])} ${n(r2[1] - 5)}`,
      "none",
      { stroke: "#b01828", strokeWidth: 1.6 },
    ),
  );
  return buildingDoc("The Reaper Club (map)", out.join(""), D, 120, 109);
}

/** The parlor button: a brass disc with a black line drawing of a parlor with a cross. */
function capsuleParlor() {
  const D = new Defs("cpa");
  const out = [];
  out.push(
    circle(
      0,
      0,
      21.5,
      D.lg(-20, -20, 20, 20, [
        [0, "#181010"],
        [0.75, "#907028"],
        [1, "#c8b880"],
      ]),
    ),
  );
  out.push(
    circle(
      0,
      0,
      19,
      D.lg(-19, -19, 19, 19, [
        [0, "#d8c070"],
        [0.5, "#a08030"],
        [1, "#4a3010"],
      ]),
    ),
  );
  out.push(
    circle(
      0,
      0,
      15.5,
      D.rg(-4, -5, 20, [
        [0, "#f0e0b0"],
        [0.6, "#c8a860"],
        [1, "#6a4a18"],
      ]),
    ),
  );
  const ln = {
    fill: "none",
    stroke: "#000",
    strokeWidth: 1.3,
    strokeLinejoin: "round",
    strokeLinecap: "round",
  };
  out.push(path("M-10 9V-1L0 -9L10 -1V9Z", "none", ln));
  out.push(path("M-12 0L0 -10L12 0", "none", ln));
  out.push(path("M-3 9V2H3V9", "none", ln));
  out.push(path("M0 -9V-15M-2.5 -13H2.5", "none", ln));
  out.push(path("M-8 2h3v3h-3zM5 2h3v3h-3z", "none", { ...ln, strokeWidth: 1 }));
  out.push(path("M-14 9H14", "none", ln));
  return doc({
    title: "The parlor office",
    body: out.join(""),
    defs: D,
    w: 45,
    h: 45,
    vb: "-23 -23 45 45",
  });
}

export const pieces = [
  {
    id: "ui/building-city-hall",
    kind: "ui",
    overrides: "client placeholder placeholders/building-city-hall.svg",
    usedBy: "the Deathville map, Expanded towns",
    grade: "B",
    notes:
      "A white classical block with five columns, pediment, clock tower with a copper dome and a flag; the map icons' oblique view, black outline and shadow.",
    viewBox: "0 0 120 118",
    previewWidth: 240,
    previewBg: "#888888",
    render: cityHallIcon,
  },
  {
    id: "ui/building-reaper-club",
    kind: "ui",
    overrides: "client placeholder placeholders/building-reaper-club.svg",
    usedBy: "the Deathville map, Expanded towns",
    grade: "B",
    notes:
      "A squat black-purple club with a red door and canopy, purple-lit windows, a big skull sign on the roof (like the cafe's bottle) and a velvet rope.",
    viewBox: "0 0 120 109",
    previewWidth: 240,
    previewBg: "#888888",
    render: reaperIcon,
  },
  {
    id: "ui/capsule-parlor",
    kind: "ui",
    overrides: "client placeholder placeholders/capsule-parlor.svg",
    usedBy: "the desk's parlor office button",
    grade: "A",
    notes:
      "A brass capsule disc with a black line drawing of a parlor with a cross, matching the original map, news, stats and mail buttons.",
    viewBox: "-23 -23 45 45",
    previewWidth: 135,
    previewBg: "#5a3a20",
    render: capsuleParlor,
  },
];
void lettering;
void g;
void rect;
