/** background_church, background_celemony, places/fire (redraws of traced photographs). */
import { lettering } from "../font.mjs";
import {
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
import { P } from "../palette.mjs";
import { box3, camera, fogBand, grass, headstone, leafyTree } from "../parts.mjs";

/** A lancet window of coloured glass in a side wall plane (X fixed), z centre zc. */
function lancet(cam, X, y0, y1, zc, hw, colors) {
  const pts = [];
  pts.push(cam.pr(X, y0, zc - hw));
  pts.push(cam.pr(X, y1 - hw * 1.2, zc - hw));
  pts.push(cam.pr(X, y1, zc));
  pts.push(cam.pr(X, y1 - hw * 1.2, zc + hw));
  pts.push(cam.pr(X, y0, zc + hw));
  const outline = `M${pts.map(([x, y]) => `${n(x)} ${n(y)}`).join("L")}Z`;
  const res = [path(outline, colors[0], { stroke: "#2a1a10", strokeWidth: 1.2 })];
  // panes: three bands of colour
  const bands = 4;
  for (let i = 0; i < bands; i++) {
    const ya = y0 + ((y1 - hw * 1.2 - y0) * i) / bands;
    const yb = y0 + ((y1 - hw * 1.2 - y0) * (i + 1)) / bands;
    for (const [za, zb, c] of [
      [zc - hw, zc, colors[(i + 1) % colors.length]],
      [zc, zc + hw, colors[(i + 2) % colors.length]],
    ]) {
      res.push(
        path(
          cam.poly([
            [X, ya, za],
            [X, yb, za],
            [X, yb, zb],
            [X, ya, zb],
          ]),
          c,
          { stroke: "#2a1a10", strokeWidth: 0.6 },
        ),
      );
    }
  }
  return g(res);
}

/** background_church: the nave with pews, the altar cross, glass and paintings. */
function church() {
  const D = new Defs("ch");
  const R = rng(31);
  const cam = camera({ f: 250, cx: 230, hy: 160, height: 1.7 });
  const out = [];
  const W = 6.5;
  const H = 7;
  const far = 16;
  out.push(rect(0, 0, 550, 400, "#2a2018"));
  // Floor (stone flags), ceiling, walls, altar wall.
  out.push(
    path(
      cam.poly([
        [-W, 0, 1],
        [W, 0, 1],
        [W, 0, far],
        [-W, 0, far],
      ]),
      D.lg(0, 160, 0, 400, [
        [0, "#8a7e6a"],
        [1, "#4a4236"],
      ]),
    ),
  );
  out.push(
    path(
      cam.poly([
        [-W, H, 1],
        [W, H, 1],
        [W, H, far],
        [-W, H, far],
      ]),
      D.lg(0, 0, 0, 160, [
        [0, "#3a3024"],
        [1, "#6a5c48"],
      ]),
    ),
  );
  out.push(
    path(
      cam.poly([
        [-W, 0, 1],
        [-W, H, 1],
        [-W, H, far],
        [-W, 0, far],
      ]),
      D.lg(0, 0, 230, 0, [
        [0, "#5a4a36"],
        [1, "#a89676"],
      ]),
    ),
  );
  out.push(
    path(
      cam.poly([
        [W, 0, 1],
        [W, H, 1],
        [W, H, far],
        [W, 0, far],
      ]),
      D.lg(550, 0, 230, 0, [
        [0, "#4a3c2c"],
        [1, "#8a7a60"],
      ]),
    ),
  );
  out.push(
    path(
      cam.poly([
        [-W, 0, far],
        [W, 0, far],
        [W, H, far],
        [-W, H, far],
      ]),
      D.lg(0, 40, 0, 220, [
        [0, "#c8bc98"],
        [1, "#a89a78"],
      ]),
    ),
  );
  // ceiling beams
  for (let z = 2; z < far; z += 2.2)
    out.push(
      path(
        cam.poly([
          [-W, H, z],
          [W, H, z],
          [W, H, z + 0.35],
          [-W, H, z + 0.35],
        ]),
        "#2a2016",
        { stroke: "#140e08", strokeWidth: 0.5 },
      ),
    );
  // Altar: a step, a table with white cloth, the big wooden cross above, candles.
  out.push(
    box3(
      cam,
      -3,
      3,
      0,
      0.3,
      far - 2.5,
      far,
      { end: "#7a6a50", top: "#9a8a6a" },
      { lw: 0.7, camY: 1.7 },
    ),
  );
  out.push(
    box3(
      cam,
      -1.4,
      1.4,
      0.3,
      1.2,
      far - 1.6,
      far - 0.8,
      { end: "#f0ece0", top: "#ffffff", side: "#d8d0c0" },
      { lw: 0.7, camY: 1.7 },
    ),
  );
  const c0 = cam.pr(-0.18, 2.2, far - 0.05);
  const c1 = cam.pr(0.18, 6.2, far - 0.05);
  const a0 = cam.pr(-1.1, 4.9, far - 0.05);
  const a1 = cam.pr(1.1, 5.3, far - 0.05);
  const crossFill = D.lg(c0[0], 0, c1[0], 0, [
    [0, "#9a6a30"],
    [1, "#5a3a14"],
  ]);
  out.push(rect(c0[0] + 2, c1[1] + 2, c1[0] - c0[0], c0[1] - c1[1], "#000", { opacity: 0.25 }));
  out.push(rect(a0[0] + 2, a1[1] + 2, a1[0] - a0[0], a0[1] - a1[1], "#000", { opacity: 0.25 }));
  out.push(
    rect(c0[0], c1[1], c1[0] - c0[0], c0[1] - c1[1], crossFill, {
      stroke: P.ink,
      strokeWidth: 0.8,
    }),
  );
  out.push(
    rect(a0[0], a1[1], a1[0] - a0[0], a0[1] - a1[1], crossFill, {
      stroke: P.ink,
      strokeWidth: 0.8,
    }),
  );
  for (const x of [-1.1, 1.1]) {
    const b = cam.pr(x, 1.2, far - 1.2);
    out.push(
      rect(b[0] - 1.5, b[1] - 16, 3, 16, "#f4f0e0", { stroke: "#8a8070", strokeWidth: 0.4 }),
    );
    out.push(ellipse(b[0], b[1] - 19, 1.6, 3.2, P.gold));
    out.push(
      circle(
        b[0],
        b[1] - 19,
        9,
        D.rg(b[0], b[1] - 19, 9, [
          [0, P.lamp1, 0.5],
          [1, P.lamp1, 0],
        ]),
      ),
    );
  }
  // Stained glass in the left wall, light falling across the pews.
  for (const z of [4.5, 9])
    out.push(
      lancet(cam, -W + 0.01, 2.2, 5.6, z, 0.65, [
        "#2a1a10",
        "#a8342a",
        "#3a5a9a",
        "#d8b040",
        "#4a8a4a",
      ]),
    );
  out.push(
    path(
      `M${n(cam.pr(-W, 5.6, 4.5)[0])} ${n(cam.pr(-W, 5.6, 4.5)[1])}L${n(cam.pr(-W, 5.6, 9)[0])} ${n(cam.pr(-W, 5.6, 9)[1])}L420 330L260 400L0 400Z`,
      D.lg(0, 0, 400, 300, [
        [0, "#ffe8b0", 0.18],
        [1, "#ffe8b0", 0],
      ]),
    ),
  );
  // Three dim paintings of saints on the right wall (the original had them).
  for (const [z, h] of [
    [5, 1.7],
    [7.2, 1.7],
    [9.4, 1.7],
  ]) {
    const q = cam.poly([
      [W - 0.01, 2.6, z],
      [W - 0.01, 2.6 + h, z],
      [W - 0.01, 2.6 + h, z + 1.3],
      [W - 0.01, 2.6, z + 1.3],
    ]);
    out.push(path(q, "#7a5a20", { stroke: P.ink, strokeWidth: 0.8 }));
    const qi = cam.poly([
      [W - 0.02, 2.75, z + 0.12],
      [W - 0.02, 2.45 + h, z + 0.12],
      [W - 0.02, 2.45 + h, z + 1.18],
      [W - 0.02, 2.75, z + 1.18],
    ]);
    out.push(path(qi, "#3a2a1a"));
    const head = cam.pr(W - 0.03, 2.2 + h, z + 0.65);
    const body = cam.pr(W - 0.03, 2.9, z + 0.65);
    const k = cam.s(z + 0.65);
    out.push(ellipse(head[0], head[1], k * 0.12, k * 0.15, "#b08a5a"));
    out.push(
      circle(head[0], head[1], k * 0.22, "none", {
        stroke: "#c8a040",
        strokeWidth: 1,
        opacity: 0.8,
      }),
    );
    out.push(
      path(
        `M${n(head[0] - k * 0.1)} ${n(head[1] + k * 0.12)}L${n(body[0] - k * 0.32)} ${n(body[1])}L${n(body[0] + k * 0.32)} ${n(body[1])}L${n(head[0] + k * 0.1)} ${n(head[1] + k * 0.12)}Z`,
        "#5a3a6a",
      ),
    );
  }
  // Pews: two blocks with a centre aisle, far to near.
  for (let z = far - 3.2; z >= 1.6; z -= 1.15) {
    for (const [xa, xb] of [
      [-W + 0.3, -0.9],
      [0.9, W - 0.3],
    ]) {
      const wood = { end: "#5a3418", side: "#6a4020", top: "#8a5a2e", bottom: "#3a2010" };
      out.push(box3(cam, xa, xb, 0.42, 0.5, z + 0.2, z + 0.65, wood, { lw: 0.6, camY: 1.7 }));
      out.push(
        box3(
          cam,
          xa,
          xb,
          0,
          0.98,
          z + 0.65,
          z + 0.75,
          { end: "#4a2a12", side: "#5a3418", top: "#9a6a38" },
          { lw: 0.6, camY: 1.7 },
        ),
      );
      // pew end with a carved top
      const endX = xa < 0 ? xb : xa;
      const e = cam.poly([
        [endX, 0, z + 0.15],
        [endX, 1.02, z + 0.15],
        [endX, 1.12, z + 0.45],
        [endX, 1.02, z + 0.78],
        [endX, 0, z + 0.78],
      ]);
      out.push(path(e, "#6a3e1c", { stroke: P.ink, strokeWidth: 0.6 }));
      // hymn books on a few
      if (R.next() < 0.3) {
        const bx = R.range(xa + 0.3, xb - 0.3);
        out.push(
          box3(
            cam,
            bx,
            bx + 0.25,
            0.5,
            0.56,
            z + 0.3,
            z + 0.48,
            { end: "#7a1a1a", top: "#9a2a2a" },
            { lw: 0.4, camY: 1.7 },
          ),
        );
      }
    }
    out.push(rect(0, 0, 550, 400, "#1a120a", { opacity: 0.03 }));
  }
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.rg(240, 170, 380, [
        [0.5, "#000", 0],
        [1, "#000", 0.55],
      ]),
    ),
  );
  void lettering;
  void mix;
  return doc({ title: "background/background_church (Remastered)", body: out.join(""), defs: D });
}

/** background_celemony: the cemetery by day, flat markers on dry grass, trees. */
function celemony() {
  const D = new Defs("ce");
  const R = rng(13);
  const cam = camera({ f: 300, cx: 275, hy: 176, height: 1.7 });
  const out = [];
  out.push(
    rect(
      0,
      0,
      550,
      180,
      D.lg(0, 0, 0, 180, [
        [0, "#9cc0d8"],
        [1, "#e4eef0"],
      ]),
    ),
  );
  // Soft clouds.
  for (const [x, y, w] of [
    [90, 46, 120],
    [330, 30, 160],
    [480, 80, 90],
  ]) {
    out.push(
      path(
        scallop(
          [
            [x, y],
            [x + w * 0.3, y - 14],
            [x + w * 0.6, y - 10],
            [x + w, y],
            [x + w * 0.5, y + 8],
          ],
          0.5,
          R,
        ),
        "#ffffff",
        { opacity: 0.75 },
      ),
    );
  }
  // Distant tree line, blue-green, then the ground.
  out.push(
    path(
      scallop(
        [
          [-10, 176],
          [-10, 150],
          [60, 140],
          [140, 150],
          [210, 136],
          [300, 146],
          [380, 134],
          [460, 148],
          [560, 140],
          [560, 176],
        ],
        0.3,
        R,
      ),
      "#8a9a8c",
    ),
  );
  out.push(
    rect(
      0,
      174,
      550,
      226,
      D.lg(0, 174, 0, 400, [
        [0, "#c4b48c"],
        [0.5, "#b8a87a"],
        [1, "#9a8a60"],
      ]),
    ),
  );
  // Mown stripes of dry grass.
  for (let z = 4; z < 80; z *= 1.3) {
    const a = cam.pr(-60, 0, z);
    const b = cam.pr(60, 0, z * 1.13);
    out.push(rect(0, b[1], 550, Math.max(0.5, a[1] - b[1]), "#a89870", { opacity: 0.25 }));
  }
  // Trees: a big one at left, a pair at right, mid distance.
  out.push(ellipse(70, 262, 90, 10, "#000", { opacity: 0.12 }));
  out.push(
    leafyTree(D, 70, 262, 230, R, { leaf: "#5a6a4e", light: "#8a9a72", trunk: "#4a3a2a", w: 180 }),
  );
  out.push(
    leafyTree(D, 450, 214, 120, R, { leaf: "#66765a", light: "#94a47e", trunk: "#5a4a3a", w: 110 }),
  );
  out.push(
    leafyTree(D, 510, 222, 150, R, { leaf: "#5e6e52", light: "#8c9c76", trunk: "#4a3a2a", w: 120 }),
  );
  // Grave markers: flat plaques in rows (as in the photo), a few upright stones.
  const stones = [];
  for (let row = 0; row < 7; row++) {
    const z = 6 + row * row * 1.6 + row * 2;
    for (let col = -5; col <= 5; col++) {
      if (R.next() < 0.35) continue;
      const X = col * 2.6 + R.range(-0.4, 0.4) + (row % 2) * 1.3;
      stones.push({ X, z, up: R.next() < 0.25 });
    }
  }
  stones.sort((a, b) => b.z - a.z);
  for (const st of stones) {
    const [x, y] = cam.pr(st.X, 0, st.z);
    const k = cam.s(st.z);
    if (x < -30 || x > 580) continue;
    if (st.up) {
      out.push(
        headstone(D, x, y, k * 0.6, k * 0.8, R.pick(["round", "tablet", "slab"]), "#9a9890", {
          lw: Math.max(0.5, k * 0.012),
          ink: "#4a4840",
        }),
      );
    } else {
      out.push(
        path(
          cam.poly([
            [st.X - 0.35, 0.02, st.z],
            [st.X + 0.35, 0.02, st.z],
            [st.X + 0.35, 0.02, st.z + 0.5],
            [st.X - 0.35, 0.02, st.z + 0.5],
          ]),
          "#8a887e",
          { stroke: "#5a584e", strokeWidth: 0.5 },
        ),
      );
      out.push(
        path(
          cam.poly([
            [st.X - 0.35, 0, st.z],
            [st.X + 0.35, 0, st.z],
            [st.X + 0.35, 0.06, st.z],
            [st.X - 0.35, 0.06, st.z],
          ]),
          "#6a685e",
        ),
      );
    }
  }
  // Tree shadows on the grass.
  out.push(path("M0 300Q120 270 240 290Q160 320 0 330Z", "#5a5038", { opacity: 0.2 }));
  out.push(grass(0, 550, 402, 14, "#8a7a50", R, 120));
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.rg(275, 220, 380, [
        [0.55, "#000", 0],
        [1, "#000", 0.3],
      ]),
    ),
  );
  void fogBand;
  return doc({ title: "background/background_celemony (Remastered)", body: out.join(""), defs: D });
}

/** One flame tongue: base at (x, y), height h, width w, sway. */
function tongue(x, y, h, w, sway) {
  return `M${n(x - w / 2)} ${n(y)}Q${n(x - w * 0.7 + sway * 0.3)} ${n(y - h * 0.45)} ${n(x + sway)} ${n(y - h)}Q${n(x + w * 0.2 + sway * 0.4)} ${n(y - h * 0.55)} ${n(x + w * 0.1 + sway * 0.1)} ${n(y - h * 0.62)}Q${n(x + w * 0.7)} ${n(y - h * 0.4)} ${n(x + w / 2)} ${n(y)}Z`;
}
export function flames(cx, y, width, height, R, count = 9) {
  const layers = [
    ["#8a1a08", 1, 1],
    ["#d84a10", 0.8, 0.86],
    ["#f8a020", 0.6, 0.66],
    ["#fff0a0", 0.34, 0.4],
  ];
  return layers
    .map(([c, hk, wk]) => {
      let d = "";
      for (let i = 0; i < count; i++) {
        const x = cx - width / 2 + (width * (i + 0.5)) / count + R.range(-4, 4);
        const h = height * hk * R.range(0.55, 1);
        d += tongue(x, y, h, (width / count) * 2.2 * wk, R.range(-h * 0.25, h * 0.25));
      }
      return path(d, c);
    })
    .join("");
}

/** A firefighter seen from behind at three-quarters, rim-lit by the fire. */
function firefighter(D, x, y, s, flip, hoseTo) {
  const k = (v) => (flip ? -v : v);
  const t = `translate(${n(x)} ${n(y)}) scale(${n(s)})`;
  const coat = D.lg(-30, 0, 30, 0, [
    [0, "#4a3e26"],
    [0.65, "#6a5a36"],
    [1, "#d8a050"],
  ]);
  const parts = [
    // legs and boots
    path(
      `M${k(-16)} -70L${k(-20)} -8L${k(-6)} -8L${k(-2)} -60L${k(4)} -8L${k(18)} -8L${k(14)} -70Z`,
      "#3a3222",
      { stroke: "#120e08", strokeWidth: 1 },
    ),
    path(`M${k(-24)} -10H${k(-4)}V2H${k(-26)}ZM${k(2)} -10H${k(22)}V2H${k(0)}Z`, "#141210"),
    // coat
    path(
      `M${k(-26)} -140Q${k(-30)} -100 ${k(-24)} -62L${k(22)} -62Q${k(28)} -100 ${k(24)} -140Q${k(0)} -152 ${k(-26)} -140Z`,
      coat,
      { stroke: "#120e08", strokeWidth: 1 },
    ),
    // reflective bands
    path(
      `M${k(-27)} -96L${k(26)} -96L${k(25)} -88L${k(-26)} -88ZM${k(-25)} -72L${k(23)} -72L${k(23)} -66L${k(-24)} -66Z`,
      "#e8e070",
      { opacity: 0.9 },
    ),
    // arms reaching forward to the nozzle
    path(
      `M${k(18)} -136Q${k(44)} -124 ${k(56)} -110L${k(50)} -100Q${k(36)} -112 ${k(14)} -116Z`,
      coat,
      { stroke: "#120e08", strokeWidth: 1 },
    ),
    path(
      `M${k(-20)} -134Q${k(10)} -118 ${k(46)} -106L${k(44)} -98Q${k(8)} -106 ${k(-18)} -118Z`,
      shade("#6a5a36", 0.2),
      { stroke: "#120e08", strokeWidth: 1 },
    ),
    // helmet with brim, tank on the back
    path(
      `M${k(-14)} -170Q${k(-14)} -186 ${k(2)} -186Q${k(18)} -186 ${k(18)} -170Z`,
      D.lg(-14, 0, 18, 0, [
        [0, "#b89820"],
        [1, "#ffe060"],
      ]),
      { stroke: "#120e08", strokeWidth: 1 },
    ),
    path(
      `M${k(-20)} -168Q${k(2)} -176 ${k(28)} -166L${k(30)} -162Q${k(2)} -170 ${k(-22)} -164Z`,
      "#a88818",
      { stroke: "#120e08", strokeWidth: 1 },
    ),
    path(`M${k(-10)} -166V-148H${k(10)}V-166Z`, "#2a221a"),
    path(
      `M${k(-16)} -150Q${k(-18)} -112 ${k(-12)} -100L${k(0)} -100Q${k(4)} -112 ${k(0)} -150Z`,
      "#8a8a88",
      { stroke: "#120e08", strokeWidth: 1 },
    ),
    // nozzle
    path(`M${k(48)} -112L${k(72)} -116L${k(73)} -108L${k(50)} -102Z`, "#2a2a2a", {
      stroke: "#120e08",
      strokeWidth: 0.8,
    }),
  ];
  let hose = "";
  if (hoseTo)
    hose = path(
      `M${n(x + k(10) * s)} ${n(y - 100 * s)}Q${n(x + k(-40) * s)} ${n(y)} ${n(hoseTo[0])} ${n(hoseTo[1])}`,
      "none",
      { stroke: "#8a7a5a", strokeWidth: 5 * s, strokeLinecap: "round" },
    );
  return hose + g(parts, { transform: t });
}

/** places/fire: a parlor ablaze at night, two firefighters hosing it down. */
function fire() {
  const D = new Defs("fi");
  const R = rng(9);
  const out = [];
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.lg(0, 0, 0, 400, [
        [0, "#0a0606"],
        [0.6, "#2a1008"],
        [1, "#100804"],
      ]),
    ),
  );
  // Smoke billowing up and to the right, lit orange from below.
  for (let i = 0; i < 8; i++) {
    const x = 120 + i * 40 + R.range(-20, 20);
    const y = 120 - i * 14 + R.range(-10, 10);
    out.push(
      path(
        scallop(
          [
            [x - 60, y + 30],
            [x - 40, y - 30],
            [x + 10, y - 50],
            [x + 60, y - 20],
            [x + 70, y + 30],
            [x, y + 50],
          ],
          0.45,
          R,
        ),
        i < 3 ? "#4a2a1a" : "#2a2222",
        { opacity: 0.85 },
      ),
    );
  }
  // Glow behind the building.
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.rg(190, 230, 260, [
        [0, "#ff9a30", 0.65],
        [0.5, "#c04010", 0.3],
        [1, "#c04010", 0],
      ]),
    ),
  );
  // The building: a two-storey clapboard parlor, front and side, black against the fire.
  const bx = 60;
  const bw = 230;
  const by = 380;
  const bh = 190;
  out.push(
    path(
      poly([
        [bx + bw, by],
        [bx + bw, by - bh],
        [bx + bw + 60, by - bh - 22],
        [bx + bw + 60, by - 16],
      ]),
      D.lg(bx + bw, 0, bx + bw + 60, 0, [
        [0, "#2a140a"],
        [1, "#4a2410"],
      ]),
      { stroke: "#000", strokeWidth: 1 },
    ),
  );
  let sclap = "";
  for (let i = 1; i < 19; i++)
    sclap += `M${bx + bw} ${by - i * 10}L${bx + bw + 60} ${by - 16 - i * 10 * 0.97 - i * 0.3}`;
  out.push(path(sclap, "none", { stroke: "#120804", strokeWidth: 0.8, opacity: 0.6 }));
  out.push(
    path(
      poly([
        [bx + bw + 18, by - 120],
        [bx + bw + 44, by - 128],
        [bx + bw + 44, by - 84],
        [bx + bw + 18, by - 78],
      ]),
      "#f8a020",
      { stroke: "#000", strokeWidth: 1.2 },
    ),
  );
  out.push(
    rect(
      bx,
      by - bh,
      bw,
      bh,
      D.lg(bx, 0, bx + bw, 0, [
        [0, "#3a1c0e"],
        [1, "#24120a"],
      ]),
      { stroke: "#000", strokeWidth: 1.2 },
    ),
  );
  // roof, half gone
  out.push(
    path(
      poly([
        [bx - 10, by - bh],
        [bx + bw / 2, by - bh - 70],
        [bx + bw + 10, by - bh],
        [bx + bw * 0.78, by - bh],
        [bx + bw * 0.6, by - bh - 30],
        [bx + bw * 0.44, by - bh - 8],
        [bx + bw * 0.3, by - bh],
      ]),
      "#120806",
      { stroke: "#000", strokeWidth: 1.2 },
    ),
  );
  // charred rafters poking up
  out.push(
    path(
      `M${bx + bw * 0.62} ${by - bh}l18 -46M${bx + bw * 0.72} ${by - bh}l14 -36M${bx + bw * 0.52} ${by - bh - 10}l-6 -40`,
      "none",
      { stroke: "#0a0402", strokeWidth: 5, strokeLinecap: "round" },
    ),
  );
  // clapboard lines
  let clap = "";
  for (let y = by - bh + 10; y < by; y += 10) clap += `M${bx} ${y}H${bx + bw}`;
  out.push(path(clap, "none", { stroke: "#0e0604", strokeWidth: 1, opacity: 0.6 }));
  // Windows, each a furnace.
  const wins = [
    [bx + 24, by - bh + 30],
    [bx + 96, by - bh + 30],
    [bx + 168, by - bh + 30],
    [bx + 24, by - 90],
    [bx + 168, by - 90],
  ];
  for (const [x, y] of wins) {
    out.push(
      rect(
        x,
        y,
        40,
        54,
        D.lg(0, y, 0, y + 54, [
          [0, "#fff0a0"],
          [0.5, "#f8a020"],
          [1, "#c04010"],
        ]),
        { stroke: "#000", strokeWidth: 1.5 },
      ),
    );
    out.push(
      path(`M${x + 20} ${y}V${y + 54}M${x} ${y + 27}H${x + 40}`, "none", {
        stroke: "#2a0e04",
        strokeWidth: 2.4,
      }),
    );
    out.push(flames(x + 20, y + 6, 40, 70, R, 4));
  }
  // The door, broken open.
  out.push(rect(bx + 98, by - 80, 36, 80, "#f8a020", { stroke: "#000", strokeWidth: 1.5 }));
  out.push(
    path(
      `M${bx + 98} ${by - 80}L${bx + 84} ${by - 76}L${bx + 84} ${by + 4}L${bx + 98} ${by}Z`,
      "#1a0a04",
      { stroke: "#000", strokeWidth: 1 },
    ),
  );
  out.push(flames(bx + 116, by, 36, 60, R, 3));
  // The big fire through the roof.
  out.push(flames(bx + bw * 0.55, by - bh + 6, 200, 170, R, 10));
  // Sparks.
  for (let i = 0; i < 40; i++)
    out.push(
      circle(
        R.range(80, 380),
        R.range(20, 220),
        R.range(0.6, 1.6),
        R.pick(["#ffe080", "#ffb040", "#ff7020"]),
        { opacity: R.range(0.5, 1) },
      ),
    );
  // Trees at the right, dark, rim-lit.
  out.push(
    path(
      scallop(
        [
          [420, 400],
          [430, 200],
          [470, 110],
          [530, 90],
          [560, 130],
          [560, 400],
        ],
        0.35,
        R,
      ),
      "#0e120c",
    ),
  );
  out.push(
    path(
      scallop(
        [
          [430, 220],
          [452, 160],
          [480, 130],
          [470, 190],
        ],
        0.4,
        R,
      ),
      "#3a2a14",
      { opacity: 0.7 },
    ),
  );
  // Ground: wet street reflecting the fire.
  out.push(
    rect(
      0,
      372,
      550,
      28,
      D.lg(0, 372, 0, 400, [
        [0, "#3a1a0a"],
        [1, "#140804"],
      ]),
    ),
  );
  out.push(path("M60 380H300L330 400H40Z", "#f8a020", { opacity: 0.25 }));
  // Firefighters: one bracing at right, one behind with the hose, rim-lit.
  out.push(firefighter(D, 372, 392, 1.0, true, [560, 398]));
  out.push(firefighter(D, 492, 398, 1.12, true, [560, 404]));
  // Water arcs from the nozzles into the fire.
  out.push(
    path("M300 278Q276 206 248 230", "none", {
      stroke: "#d8e8f0",
      strokeWidth: 4,
      opacity: 0.75,
      strokeLinecap: "round",
    }),
  );
  out.push(
    path("M413 270Q350 180 280 210", "none", {
      stroke: "#d8e8f0",
      strokeWidth: 4,
      opacity: 0.7,
      strokeLinecap: "round",
    }),
  );
  out.push(
    path("M248 230q-6 6 -14 4M280 210q-8 4 -16 0", "none", {
      stroke: "#ffffff",
      strokeWidth: 2,
      opacity: 0.6,
    }),
  );
  return doc({ title: "places/fire (Remastered)", body: out.join(""), defs: D });
}

export const pieces = [
  {
    id: "background/background_church",
    kind: "redraw",
    overrides: "background/background_church",
    usedBy: "the church (bg behind people/churchguy_h); Bingo's stand-in",
    grade: "B",
    notes:
      "The nave: pews either side of the aisle, the altar and its wooden cross, stained glass at left throwing light, three saints at right.",
    render: church,
  },
  {
    id: "background/background_celemony",
    kind: "redraw",
    overrides: "background/background_celemony",
    usedBy: "the burial ceremony (bg behind places/funeral-ceremony); graveyard and duel stand-ins",
    grade: "B",
    notes:
      "The cemetery by day: flat markers in rows on dry grass, a few upright stones, soft trees, pale sky; horizon kept where the ceremony fg expects it.",
    render: celemony,
  },
  {
    id: "places/fire",
    kind: "redraw",
    overrides: "places/fire",
    usedBy: "arson events (picture)",
    grade: "B",
    notes:
      "A clapboard parlor ablaze at night, flames from every window and the roof, two firefighters rim-lit by the fire hosing it down.",
    render: fire,
  },
];
void mix;
void smooth;
void tint;
