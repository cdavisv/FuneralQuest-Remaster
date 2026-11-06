/**
 * The customer backdrops background_1 to background_5 (redraws of the traced photographs).
 * A customer's bust stands in front of each, so the middle third is kept calm and mid-dark
 * and the interest is at the edges.
 */
import {
  blob,
  circle,
  Defs,
  doc,
  ellipse,
  g,
  mix,
  n,
  path,
  poly,
  rect,
  rng,
  scallop,
  shade,
  smooth,
  tint,
} from "../lib.mjs";
import { bareTree, camera, fogBand, grass } from "../parts.mjs";

/** background_1: a tunnel of old trees over a misty path (the traced "cave/forest"). */
function bg1() {
  const D = new Defs("b1");
  const R = rng(21);
  const out = [];
  // Far mist: a pale, cool opening.
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.lg(0, 0, 0, 400, [
        [0, "#5e6862"],
        [0.45, "#a4aca4"],
        [0.7, "#8a9488"],
        [1, "#4a5244"],
      ]),
    ),
  );
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.rg(280, 225, 200, [
        [0, "#c8ccc0", 0.85],
        [0.6, "#c8ccc0", 0.35],
        [1, "#c8ccc0", 0],
      ]),
    ),
  );
  // Distant trunks, ghostly in the mist.
  for (const [x, w, c] of [
    [170, 8, "#8a948a"],
    [215, 6, "#909a90"],
    [345, 7, "#8a948a"],
    [392, 9, "#828c82"],
    [300, 4, "#9aa29a"],
  ]) {
    out.push(
      path(
        `M${x - w} 330Q${x - w * 0.6} 200 ${x - w * 0.3} 60L${x + w * 0.3} 60Q${x + w * 0.6} 200 ${x + w} 330Z`,
        c,
      ),
    );
  }
  // The path, receding to the opening.
  out.push(
    path(
      "M150 400Q240 300 268 252Q280 248 292 252Q320 300 420 400Z",
      D.lg(0, 250, 0, 400, [
        [0, "#9a9a84"],
        [1, "#5a5440"],
      ]),
    ),
  );
  out.push(path("M0 400V300Q120 280 268 252L292 252Q430 275 550 300V400Z", "none"));
  // Mid ground banks of undergrowth either side.
  out.push(
    path(
      scallop(
        [
          [0, 270],
          [70, 255],
          [150, 262],
          [235, 268],
          [262, 290],
          [150, 400],
          [0, 400],
        ],
        0.35,
        R,
      ),
      "#4e5a44",
    ),
  );
  out.push(
    path(
      scallop(
        [
          [550, 262],
          [470, 250],
          [390, 258],
          [320, 268],
          [298, 290],
          [420, 400],
          [550, 400],
        ],
        0.35,
        R,
      ),
      "#4a5640",
    ),
  );
  out.push(fogBand(D, 236, 420, "#b0b8ae", 0.4, R));
  // Dim forest outside the arch: mid-distance trunks in the gloom.
  for (const [x, w, c] of [
    [30, 16, "#3a443a"],
    [75, 12, "#465046"],
    [480, 14, "#3e483e"],
    [525, 18, "#364036"],
    [118, 9, "#566056"],
    [440, 10, "#525c52"],
  ]) {
    out.push(
      path(
        `M${x - w} 400Q${x - w * 0.7} 220 ${x - w * 0.4} 0L${x + w * 0.4} 0Q${x + w * 0.7} 220 ${x + w} 400Z`,
        c,
      ),
    );
  }
  out.push(fogBand(D, 200, 420, "#9aa49a", 0.3, R));
  // The near arch: two gnarled trunks that lean in, fork, and knot overhead.
  const trunk = (s) => {
    const k = (x) => (s < 0 ? x : 550 - x);
    const outline = [
      [-30, 405],
      [10, 392],
      [34, 360],
      [52, 300],
      [64, 236],
      [80, 176],
      [104, 128],
      [132, 92],
      [168, 62],
      [214, 36],
      [262, 18],
      [262, 34],
      [214, 54],
      [176, 80],
      [150, 110],
      [134, 150],
      [124, 204],
      [122, 262],
      [128, 320],
      [146, 368],
      [178, 405],
    ].map(([x, y]) => [k(x + R.range(-2, 2)), y + R.range(-2, 2)]);
    return path(
      smooth(outline, true, 0.45),
      D.lg(k(20), 0, k(140), 0, [
        [0, "#141810"],
        [0.55, "#262c22"],
        [1, "#3c4636"],
      ]),
      { stroke: "#0e100c", strokeWidth: 1 },
    );
  };
  out.push(trunk(-1));
  out.push(trunk(1));
  // Bark grooves that follow each trunk's lean.
  let bark = "";
  for (let i = 0; i < 6; i++) {
    const o = i * 14 + R.range(-3, 3);
    bark += `M${n(20 + o)} 400Q${n(48 + o * 0.8)} 260 ${n(90 + o * 0.6)} ${n(150 - o * 0.4)}Q${n(120 + o * 0.4)} ${n(100 - o * 0.3)} ${n(160 + o * 0.3)} ${n(70 - o * 0.2)}`;
    bark += `M${n(530 - o)} 400Q${n(502 - o * 0.8)} 260 ${n(460 - o * 0.6)} ${n(150 - o * 0.4)}Q${n(430 - o * 0.4)} ${n(100 - o * 0.3)} ${n(390 - o * 0.3)} ${n(70 - o * 0.2)}`;
  }
  out.push(path(bark, "none", { stroke: "#0c0e0a", strokeWidth: 1, opacity: 0.5 }));
  // Knots.
  for (const [x, y] of [
    [70, 250],
    [96, 170],
    [480, 236],
    [452, 160],
  ])
    out.push(ellipse(x, y, 5, 8, "#0e100c", { opacity: 0.7 }));
  // Roots spreading into the path's edge.
  out.push(
    path(
      "M120 400Q150 380 196 392Q160 398 150 400ZM60 400Q90 372 130 372Q100 384 96 400Z",
      "#1c2018",
    ),
  );
  out.push(
    path(
      "M430 400Q400 380 354 392Q390 398 400 400ZM490 400Q460 372 420 372Q450 384 454 400Z",
      "#1c2018",
    ),
  );
  // Light from the opening on the trunks' inner edges.
  out.push(
    path("M150 110Q134 150 124 204Q120 262 128 320Q136 350 146 368", "none", {
      stroke: "#7e8a74",
      strokeWidth: 2.4,
      opacity: 0.5,
      strokeLinecap: "round",
    }),
  );
  out.push(
    path("M400 110Q416 150 426 204Q430 262 422 320Q414 350 404 368", "none", {
      stroke: "#76826c",
      strokeWidth: 2.2,
      opacity: 0.45,
      strokeLinecap: "round",
    }),
  );
  // Forks reaching across the top.
  out.push(bareTree(176, 74, 110, "#181c14", R, { lean: 0.95, depth: 4, width: 5 }));
  out.push(bareTree(374, 74, 110, "#181c14", R, { lean: -0.95, depth: 4, width: 5 }));
  // Canopy: dark leaf masses at the top corners, lit edges toward the middle.
  out.push(
    path(
      scallop(
        [
          [-10, -10],
          [300, -10],
          [260, 30],
          [190, 50],
          [120, 70],
          [40, 80],
          [-10, 70],
        ],
        0.4,
        R,
      ),
      "#1e2a1c",
    ),
  );
  out.push(
    path(
      scallop(
        [
          [560, -10],
          [250, -10],
          [300, 26],
          [370, 48],
          [440, 66],
          [520, 76],
          [560, 64],
        ],
        0.4,
        R,
      ),
      "#1c281a",
    ),
  );
  out.push(
    path(
      scallop(
        [
          [110, 40],
          [180, 30],
          [240, 22],
          [220, 40],
          [160, 56],
        ],
        0.5,
        R,
      ),
      "#3a4a32",
      { opacity: 0.9 },
    ),
  );
  out.push(
    path(
      scallop(
        [
          [440, 40],
          [370, 28],
          [310, 20],
          [330, 40],
          [390, 56],
        ],
        0.5,
        R,
      ),
      "#36462e",
      { opacity: 0.9 },
    ),
  );
  // Hanging moss.
  let moss = "";
  for (let i = 0; i < 14; i++) {
    const x = i < 7 ? 90 + i * 22 : 290 + (i - 7) * 24;
    const y = 30 + R.range(0, 30);
    const len = R.range(25, 60);
    moss += `M${n(x)} ${n(y)}q${n(R.range(-4, 4))} ${n(len * 0.5)} ${n(R.range(-2, 2))} ${n(len)}q2 -${n(len * 0.4)} 3 -${n(len)}z`;
  }
  out.push(path(moss, "#4a5640", { opacity: 0.8 }));
  // Ferns in the near corners.
  out.push(grass(0, 120, 400, 40, "#2a3424", R, 30));
  out.push(grass(430, 550, 400, 40, "#28321f", R, 30));
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.rg(275, 220, 360, [
        [0.5, "#000", 0],
        [1, "#000", 0.5],
      ]),
    ),
  );
  return doc({ title: "background/background_1 (Remastered)", body: out.join(""), defs: D });
}

/** background_4: a wall of foliage and blossom (the traced "foliage"). */
function bg4() {
  const D = new Defs("b4");
  const R = rng(44);
  const out = [];
  out.push(rect(0, 0, 550, 400, "#2c4224"));
  // Leaves: overlapping pointed ovals in four tones, darker toward the centre.
  const leaf = (x, y, len, ang, c, vein = true) => {
    const w = len * 0.38;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const P2 = (u, v) => [x + u * ca - v * sa, y + u * sa + v * ca];
    const tip = P2(len, 0);
    const a = P2(len * 0.45, -w);
    const b = P2(len * 0.45, w);
    const s = `M${n(x)} ${n(y)}Q${n(a[0])} ${n(a[1])} ${n(tip[0])} ${n(tip[1])}Q${n(b[0])} ${n(b[1])} ${n(x)} ${n(y)}Z`;
    let res = path(s, c, { stroke: shade(c, 0.35), strokeWidth: 0.5 });
    if (vein) {
      const m = P2(len * 0.85, 0);
      res += path(`M${n(x)} ${n(y)}L${n(m[0])} ${n(m[1])}`, "none", {
        stroke: tint(c, 0.25),
        strokeWidth: 0.6,
        opacity: 0.8,
      });
    }
    void s;
    return res;
  };
  const tones = ["#3e5a2a", "#56722e", "#6e8a38", "#8aa048", "#a2b66d"];
  // Layer by layer from back (dark) to front (light), sparse in the middle.
  for (let layer = 0; layer < 5; layer++) {
    const count = layer < 2 ? 160 : 70 + layer * 10;
    for (let i = 0; i < count; i++) {
      const x = R.range(-30, 580);
      const y = R.range(-30, 430);
      const dx = (x - 275) / 275;
      const dy = (y - 230) / 200;
      const centre = dx * dx + dy * dy;
      if (layer >= 2 && centre < 0.55 + layer * 0.08) continue;
      const len = R.range(22, 40) * (1 + layer * 0.12);
      const ang = Math.atan2(y - 220, x - 275) + R.range(-0.9, 0.9);
      out.push(leaf(x, y, len, ang, mix(tones[layer], "#1e2e18", layer < 2 ? 0.25 : 0), layer > 1));
    }
  }
  // Blossoms: pale pink clusters, upper left and lower right (the photo had a few).
  const flower = (x, y, r) => {
    let f = "";
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + R.range(0, 0.4);
      f += ellipse(
        x + Math.cos(a) * r * 0.55,
        y + Math.sin(a) * r * 0.55,
        r * 0.5,
        r * 0.36,
        "#d8a0c8",
        {
          transform: `rotate(${n((a * 180) / Math.PI)} ${n(x + Math.cos(a) * r * 0.55)} ${n(y + Math.sin(a) * r * 0.55)})`,
          stroke: "#9a5a8a",
          strokeWidth: 0.4,
        },
      );
    }
    return f + circle(x, y, r * 0.22, "#f0d060");
  };
  for (const [x, y] of [
    [70, 50],
    [96, 70],
    [60, 86],
    [120, 40],
    [470, 330],
    [500, 352],
    [446, 360],
    [520, 300],
  ])
    out.push(flower(x, y, R.range(9, 13)));
  // Berries, a few red accents.
  for (const [x, y] of [
    [480, 60],
    [488, 66],
    [474, 70],
    [40, 330],
    [48, 338],
  ])
    out.push(circle(x, y, 3.2, "#b03020", { stroke: "#5a1008", strokeWidth: 0.5 }));
  // Shade the lower left, where the game writes Class and Mood over the picture.
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.rg(40, 380, 200, [
        [0, "#0e1a0a", 0.55],
        [1, "#0e1a0a", 0],
      ]),
    ),
  );
  // Deep shade in the middle so a head reads; soft light from the upper left.
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.rg(275, 240, 230, [
        [0, "#162210", 0.6],
        [1, "#162210", 0],
      ]),
    ),
  );
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.lg(0, 0, 550, 400, [
        [0, "#f0f0c0", 0.12],
        [0.5, "#f0f0c0", 0],
        [1, "#000", 0.2],
      ]),
    ),
  );
  return doc({ title: "background/background_4 (Remastered)", body: out.join(""), defs: D });
}

export const pieces = [
  {
    id: "background/background_1",
    kind: "redraw",
    overrides: "background/background_1",
    usedBy: "customer backdrop (one of four, drawn at random)",
    grade: "B",
    notes:
      "Two gnarled trunks arch over a misty path; mossy, cool greens; the pale opening sits behind the customer's head.",
    render: bg1,
  },
  {
    id: "background/background_4",
    kind: "redraw",
    overrides: "background/background_4",
    usedBy: "customer backdrop (one of four, drawn at random)",
    grade: "B",
    notes:
      "A wall of leaves in five greens with pale blossom and red berries at the corners; shaded in the middle.",
    render: bg4,
  },
];

export { bg1, bg4 };

void blob;
void camera;
void g;
void poly;
void smooth;
