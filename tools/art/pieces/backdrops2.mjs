/** Customer and script backdrops background_2, _3, _5 and _7 (redraws of traced photographs). */
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
  smooth,
  tint,
} from "../lib.mjs";
import { P } from "../palette.mjs";
import { box3, camera, fogBand, grass, headstone } from "../parts.mjs";

/** A framed picture on a wall: (x, y) top-left. */
function frame(D, x, y, w, h, inner) {
  return g([
    rect(
      x,
      y,
      w,
      h,
      D.lg(x, y, x + w, y + h, [
        [0, "#b08a3a"],
        [0.5, "#6a4a18"],
        [1, "#3a2808"],
      ]),
      { stroke: P.ink, strokeWidth: 0.8 },
    ),
    rect(x + w * 0.1, y + h * 0.1, w * 0.8, h * 0.8, inner, {
      stroke: "#2a1a08",
      strokeWidth: 0.6,
    }),
  ]);
}

/** background_2: a dark sitting room, curtains drawn, grey daylight at the window. */
function bg2() {
  const D = new Defs("b2");
  const R = rng(2);
  const out = [];
  // Wall: dark panelling, darker toward the floor and the corners.
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.lg(0, 0, 550, 0, [
        [0, "#22180f"],
        [0.55, "#3a2a1c"],
        [1, "#2a1e14"],
      ]),
    ),
  );
  // Wallpaper stripes, very low contrast.
  let stripes = "";
  for (let x = 6; x < 550; x += 22) stripes += `M${x} 0V250`;
  out.push(path(stripes, "none", { stroke: "#4a3826", strokeWidth: 6, opacity: 0.35 }));
  // Dado rail and panels below.
  out.push(rect(0, 250, 550, 8, "#4a3420", { stroke: "#140e08", strokeWidth: 0.6 }));
  out.push(rect(0, 258, 550, 142, "#26190f"));
  for (let x = 10; x < 550; x += 90)
    out.push(rect(x, 272, 76, 100, "none", { stroke: "#3e2c1a", strokeWidth: 1.5 }));
  // Window, right: pale grey daylight through net curtains.
  const wx = 384;
  const wy = 40;
  out.push(
    rect(
      wx,
      wy,
      120,
      196,
      D.lg(0, wy, 0, wy + 196, [
        [0, "#c8d0d4"],
        [1, "#8a969c"],
      ]),
    ),
  );
  out.push(
    path(`M${wx + 60} ${wy}V${wy + 196}M${wx} ${wy + 98}H${wx + 120}`, "none", {
      stroke: "#4a3a2a",
      strokeWidth: 4,
    }),
  );
  // net curtain folds
  let net = "";
  for (let x = wx + 4; x < wx + 120; x += 8)
    net += `M${x} ${wy}Q${x + 3} ${wy + 100} ${x - 1} ${wy + 196}`;
  out.push(path(net, "none", { stroke: "#e8ecec", strokeWidth: 2.5, opacity: 0.4 }));
  out.push(rect(wx - 8, wy + 196, 136, 10, "#4a3420", { stroke: "#140e08", strokeWidth: 0.6 }));
  // Heavy drapes either side of the window, brown velvet with fold shading.
  const drape = (x0, x1, flip) => {
    const folds = [];
    const k = (x1 - x0) / 4;
    for (let i = 0; i < 4; i++) {
      const xa = x0 + i * k;
      folds.push(
        path(
          `M${n(xa)} 20Q${n(xa + k / 2)} 120 ${n(xa + (flip ? -6 : 6))} 300L${n(xa + k + (flip ? -6 : 6))} 300Q${n(xa + k / 2)} 120 ${n(xa + k)} 20Z`,
          D.lg(xa, 0, xa + k, 0, [
            [0, "#3a1e10"],
            [0.5, i % 2 ? "#6a3a1e" : "#5a3018"],
            [1, "#2a140a"],
          ]),
        ),
      );
    }
    return g(folds);
  };
  out.push(drape(352, 392, false));
  out.push(drape(496, 540, true));
  out.push(rect(340, 12, 210, 12, "#2a1a0e", { stroke: "#0e0804", strokeWidth: 0.6 }));
  // Daylight falling across the floor from the window.
  out.push(path("M384 236L504 236L560 400L300 400Z", "#c8d0d4", { opacity: 0.08 }));
  // Wing chair in silhouette by the window, its back to us.
  out.push(
    path(
      "M392 400L396 300Q392 268 410 252Q432 236 452 250Q470 236 492 252Q510 268 506 300L510 400Z",
      D.lg(392, 0, 510, 0, [
        [0, "#1a100a"],
        [0.7, "#2e1c10"],
        [1, "#4a3020"],
      ]),
      { stroke: "#0a0604", strokeWidth: 1 },
    ),
  );
  out.push(
    path("M396 300Q420 290 451 296Q482 290 506 300", "none", {
      stroke: "#5a4030",
      strokeWidth: 1.2,
      opacity: 0.6,
    }),
  );
  // Table lamp, left, with a warm fringed shade: the only warm light.
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.rg(96, 170, 160, [
        [0, "#ffcc66", 0.28],
        [1, "#ffcc66", 0],
      ]),
    ),
  );
  out.push(rect(42, 236, 110, 14, "#3a2614", { stroke: "#140e08", strokeWidth: 0.6 }));
  out.push(path("M50 250L56 400M144 250L138 400", "none", { stroke: "#2a1a0c", strokeWidth: 5 }));
  out.push(
    path("M88 236Q84 214 96 204Q108 214 104 236Z", "#7a5a2a", { stroke: P.ink, strokeWidth: 0.6 }),
  );
  out.push(
    path(
      "M68 204L76 160L116 160L124 204Z",
      D.lg(68, 0, 124, 0, [
        [0, "#f0c070"],
        [0.5, "#ffe0a0"],
        [1, "#c08a40"],
      ]),
      { stroke: "#6a4a1a", strokeWidth: 0.8 },
    ),
  );
  let fringe = "";
  for (let x = 70; x < 124; x += 3) fringe += `M${x} 204v4`;
  out.push(path(fringe, "none", { stroke: "#a07a3a", strokeWidth: 1 }));
  // A framed portrait in the gloom, centre left; a clock on the right wall.
  out.push(frame(D, 180, 60, 70, 88, "#2a2016"));
  out.push(ellipse(215, 102, 16, 22, "#3a2c1e"));
  out.push(path("M196 148Q215 118 234 148Z", "#3a2c1e"));
  out.push(circle(318, 86, 18, "#d8ccb0", { stroke: "#3a2614", strokeWidth: 3 }));
  out.push(
    path("M318 86V74M318 86L326 90", "none", {
      stroke: "#1a1008",
      strokeWidth: 1.4,
      strokeLinecap: "round",
    }),
  );
  // Dust in the window light.
  for (let i = 0; i < 14; i++)
    out.push(
      circle(R.range(300, 520), R.range(240, 380), R.range(0.6, 1.2), "#e8e0d0", { opacity: 0.3 }),
    );
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.rg(275, 200, 380, [
        [0.45, "#000", 0],
        [1, "#000", 0.6],
      ]),
    ),
  );
  return doc({ title: "background/background_2 (Remastered)", body: out.join(""), defs: D });
}

/** background_3: under the rafters of an old, half-ruined church (warm light at the far end). */
function bg3() {
  const D = new Defs("b3");
  const R = rng(3);
  const cam = camera({ f: 230, cx: 275, hy: 230, height: 1.7 });
  const out = [];
  const far = 30;
  const W = 6;
  const Hw = 6.5;
  const ridge = 12;
  // Shell: floor, walls, the roof's two slopes.
  out.push(rect(0, 0, 550, 400, "#1e1618"));
  out.push(
    path(
      cam.poly([
        [-W, 0, 1],
        [W, 0, 1],
        [W, 0, far],
        [-W, 0, far],
      ]),
      D.lg(0, 230, 0, 400, [
        [0, "#6a5c58"],
        [1, "#2e2624"],
      ]),
    ),
  );
  for (const s of [-1, 1]) {
    out.push(
      path(
        cam.poly([
          [W * s, 0, 1],
          [W * s, Hw, 1],
          [W * s, Hw, far],
          [W * s, 0, far],
        ]),
        D.lg(s < 0 ? 0 : 550, 0, 275, 0, [
          [0, "#2a2024"],
          [1, "#6a5a5a"],
        ]),
      ),
    );
    out.push(
      path(
        cam.poly([
          [W * s, Hw, 1],
          [0, ridge, 1],
          [0, ridge, far],
          [W * s, Hw, far],
        ]),
        D.lg(0, 0, 0, 230, [
          [0, "#1a1416"],
          [1, "#4a3c3e"],
        ]),
      ),
    );
  }
  // The far wall and its arched window, glowing.
  out.push(
    path(
      cam.poly([
        [-W, 0, far],
        [W, 0, far],
        [W, Hw, far],
        [0, ridge, far],
        [-W, Hw, far],
      ]),
      "#7a6058",
    ),
  );
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.rg(275, 150, 200, [
        [0, "#ffd8a0", 0.55],
        [0.5, "#e0a080", 0.2],
        [1, "#e0a080", 0],
      ]),
    ),
  );
  const arch = [];
  for (let k = 0; k <= 12; k++) {
    const a = Math.PI * (k / 12);
    arch.push(cam.pr(-Math.cos(a) * 1.4, 6 + Math.sin(a) * 1.4, far));
  }
  const [al] = [cam.pr(-1.4, 2.4, far)];
  const ar = cam.pr(1.4, 2.4, far);
  out.push(
    path(
      `M${n(al[0])} ${n(al[1])}L${arch.map(([x, y]) => `${n(x)} ${n(y)}`).join("L")}L${n(ar[0])} ${n(ar[1])}Z`,
      D.lg(0, 150, 0, 230, [
        [0, "#fff4d8"],
        [1, "#f0c890"],
      ]),
      { stroke: "#3a2a24", strokeWidth: 1.4 },
    ),
  );
  const mull = [
    cam.pr(0, 2.4, far),
    cam.pr(0, 7.4, far),
    cam.pr(-1.4, 4.6, far),
    cam.pr(1.4, 4.6, far),
  ];
  out.push(
    path(
      `M${n(mull[0][0])} ${n(mull[0][1])}L${n(mull[1][0])} ${n(mull[1][1])}M${n(mull[2][0])} ${n(mull[2][1])}L${n(mull[3][0])} ${n(mull[3][1])}`,
      "none",
      { stroke: "#3a2a24", strokeWidth: 1.6 },
    ),
  );
  // Side windows in the walls, dim.
  for (let z = 6; z < far; z += 6) {
    for (const s of [-1, 1]) {
      const win = [];
      for (let k = 0; k <= 8; k++) {
        const a = Math.PI * (k / 8);
        win.push(cam.pr(W * s - 0.01 * s, 4 + Math.sin(a) * 0.8, z + 1 - Math.cos(a) * 0.8));
      }
      const b1 = cam.pr(W * s, 1.6, z + 0.2);
      const b2 = cam.pr(W * s, 1.6, z + 1.8);
      out.push(
        path(
          `M${n(b1[0])} ${n(b1[1])}L${win.map(([x, y]) => `${n(x)} ${n(y)}`).join("L")}L${n(b2[0])} ${n(b2[1])}Z`,
          s < 0 ? "#a89c94" : "#8a7e78",
          { stroke: "#2a2022", strokeWidth: 0.8, opacity: 0.9 },
        ),
      );
    }
  }
  // Light shafts from the far window down the nave.
  out.push(
    path(
      `M${n(cam.pr(-1.4, 6, far)[0])} ${n(cam.pr(-1.4, 6, far)[1])}L${n(cam.pr(1.4, 6, far)[0])} ${n(cam.pr(1.4, 6, far)[1])}L360 400L190 400Z`,
      D.lg(0, 150, 0, 400, [
        [0, "#ffe8c0", 0.3],
        [1, "#ffe8c0", 0],
      ]),
    ),
  );
  // Holes in the roof: grey sky through missing boards.
  for (const [sd, t0, z0, z1] of [
    [-1, 0.35, 9, 13],
    [1, 0.5, 15, 18],
  ]) {
    const xa = W * sd * (1 - t0);
    const ya = Hw + (ridge - Hw) * t0;
    const xb = W * sd * (1 - t0 - 0.18);
    const yb = Hw + (ridge - Hw) * (t0 + 0.18);
    out.push(
      path(
        cam.poly([
          [xa, ya, z0],
          [xb, yb, z0 + 0.5],
          [xb, yb, z1],
          [xa, ya, z1 - 0.6],
        ]),
        "#a8a4a8",
        { stroke: "#0c0808", strokeWidth: 0.6 },
      ),
    );
  }
  // Rafters: trusses every 3 m, near ones big and dark; a few broken.
  for (let z = far - 3; z >= 2.4; z -= 3) {
    const t = 0.42;
    const tr = [];
    for (const s of [-1, 1]) {
      tr.push(
        path(
          cam.poly([
            [W * s, Hw - 0.2, z],
            [0, ridge - 0.1, z],
            [0, ridge - 0.1 - t * 1.4, z],
            [W * s, Hw - 0.2 - t * 1.4, z],
          ]),
          z < 8 ? "#1a1212" : "#3a2c2c",
          { stroke: "#0c0808", strokeWidth: 0.8 },
        ),
      );
    }
    // tie beam across, missing on some (ruin)
    if (R.next() > 0.3) {
      tr.push(
        path(
          cam.poly([
            [-W, Hw - 0.6, z],
            [W, Hw - 0.6, z],
            [W, Hw - 0.6 - t, z],
            [-W, Hw - 0.6 - t, z],
          ]),
          z < 8 ? "#1e1414" : "#3e3030",
          { stroke: "#0c0808", strokeWidth: 0.8 },
        ),
      );
    }
    // king post
    tr.push(
      path(
        cam.poly([
          [-t / 2, Hw - 0.6, z],
          [t / 2, Hw - 0.6, z],
          [t / 2, ridge - 0.2, z],
          [-t / 2, ridge - 0.2, z],
        ]),
        z < 8 ? "#1a1212" : "#3a2c2c",
        { stroke: "#0c0808", strokeWidth: 0.6 },
      ),
    );
    out.push(g(tr));
    out.push(rect(0, 0, 550, 400, "#c8a090", { opacity: 0.04 }));
  }
  // Purlins: beams along the roof slopes, as thin quads in the roof plane.
  for (const sd of [-1, 1]) {
    for (const t of [0.3, 0.62]) {
      const x0 = W * sd * (1 - t);
      const y0 = Hw + (ridge - Hw) * t - 0.25;
      const x1 = W * sd * (1 - t - 0.035);
      const y1 = y0 + (ridge - Hw) * 0.035;
      out.push(
        path(
          cam.poly([
            [x0, y0, 2.2],
            [x1, y1, 2.2],
            [x1, y1, far],
            [x0, y0, far],
          ]),
          "#241a1a",
          { stroke: "#0c0808", strokeWidth: 0.5 },
        ),
      );
    }
  }
  // Rubble and a fallen beam on the floor, edges only.
  out.push(
    path("M60 346L206 298L212 308L68 360Z", "#4a3630", { stroke: "#0c0808", strokeWidth: 0.8 }),
  );
  out.push(path("M60 346L206 298L208 302L62 351Z", "#7a5e50"));
  for (let i = 0; i < 22; i++) {
    const x = i < 11 ? R.range(10, 210) : R.range(360, 545);
    const y = R.range(350, 400);
    const w = R.range(10, 26);
    const h = w * R.range(0.45, 0.7);
    out.push(
      path(
        `M${n(x)} ${n(y)}l${n(w * 0.15)} ${n(-h)}l${n(w * 0.6)} ${n(-h * 0.25)}l${n(w * 0.25)} ${n(h * 0.8)}z`,
        "#3a302e",
        { stroke: "#0c0808", strokeWidth: 0.6 },
      ),
    );
    out.push(
      path(
        `M${n(x + w * 0.15)} ${n(y - h)}l${n(w * 0.6)} ${n(-h * 0.25)}l${n(w * 0.05)} ${n(h * 0.25)}l${n(-w * 0.6)} ${n(h * 0.2)}z`,
        "#8a7670",
      ),
    );
  }
  out.push(fogBand(D, 240, 420, "#c8a8a0", 0.18, R));
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.rg(275, 190, 380, [
        [0.5, "#000", 0],
        [1, "#000", 0.55],
      ]),
    ),
  );
  return doc({ title: "background/background_3 (Remastered)", body: out.join(""), defs: D });
}

/** background_5: a pink, over-upholstered funeral parlor (the Twins' backdrop). */
function bg5() {
  const D = new Defs("b5");
  const R = rng(5);
  const cam = camera({ f: 240, cx: 275, hy: 190, height: 1.6 });
  const out = [];
  const W = 4;
  const H = 3.4;
  const far = 9;
  out.push(rect(0, 0, 550, 400, "#3a1a1a"));
  // floor (rose carpet), ceiling, walls, back wall
  out.push(
    path(
      cam.poly([
        [-W, 0, 1],
        [W, 0, 1],
        [W, 0, far],
        [-W, 0, far],
      ]),
      D.lg(0, 190, 0, 400, [
        [0, "#b05a5a"],
        [1, "#7a3236"],
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
      D.lg(0, 0, 0, 190, [
        [0, "#c88a7e"],
        [1, "#e8b8a8"],
      ]),
    ),
  );
  for (const s of [-1, 1]) {
    out.push(
      path(
        cam.poly([
          [W * s, 0, 1],
          [W * s, H, 1],
          [W * s, H, far],
          [W * s, 0, far],
        ]),
        D.lg(s < 0 ? 0 : 550, 0, 275, 0, [
          [0, "#b06a62"],
          [1, "#e0a294"],
        ]),
      ),
    );
  }
  out.push(
    path(
      cam.poly([
        [-W, 0, far],
        [W, 0, far],
        [W, H, far],
        [-W, H, far],
      ]),
      "#e8b2a2",
    ),
  );
  // Wallpaper sprigs on the side walls (little pale crosses).
  let sprig = "";
  for (let z = 1.5; z < far; z += 0.9) {
    for (let y = 0.6; y < H; y += 0.55) {
      for (const s of [-1, 1]) {
        const [x, yy] = cam.pr(W * s, y + (Math.round(z / 0.9) % 2) * 0.27, z);
        const k = cam.s(z) * 0.06;
        sprig += `M${n(x)} ${n(yy - k)}v${n(2 * k)}M${n(x - k * 0.7)} ${n(yy)}h${n(1.4 * k)}`;
      }
    }
  }
  out.push(path(sprig, "none", { stroke: "#f4d2c4", strokeWidth: 0.7, opacity: 0.7 }));
  // Skirting and crown moulding.
  for (const s of [-1, 1]) {
    out.push(
      path(
        cam.poly([
          [W * s, 0, 1],
          [W * s, 0.18, 1],
          [W * s, 0.18, far],
          [W * s, 0, far],
        ]),
        "#f0d0c4",
        { stroke: "#7a4a44", strokeWidth: 0.5 },
      ),
    );
    out.push(
      path(
        cam.poly([
          [W * s, H - 0.2, 1],
          [W * s, H, 1],
          [W * s, H, far],
          [W * s, H - 0.2, far],
        ]),
        "#f4dcd0",
        { stroke: "#7a4a44", strokeWidth: 0.5 },
      ),
    );
  }
  // Archway in the back wall to a viewing room, a casket glimpsed with a white spray of lilies.
  const arch = [];
  for (let k = 0; k <= 12; k++) {
    const a = Math.PI * (k / 12);
    arch.push(cam.pr(-Math.cos(a) * 1.2, 2.2 + Math.sin(a) * 0.6, far));
  }
  const a0 = cam.pr(-1.2, 0, far);
  const a1 = cam.pr(1.2, 0, far);
  const archD = `M${n(a0[0])} ${n(a0[1])}L${arch.map(([x, y]) => `${n(x)} ${n(y)}`).join("L")}L${n(a1[0])} ${n(a1[1])}Z`;
  out.push(
    path(
      archD,
      D.lg(0, 150, 0, 210, [
        [0, "#f8e8d8"],
        [1, "#d8a898"],
      ]),
      { stroke: "#7a4a44", strokeWidth: 1.4 },
    ),
  );
  out.push(
    box3(
      cam,
      -0.8,
      0.8,
      0,
      0.75,
      far + 1.6,
      far + 2.2,
      { end: "#7a3a2a", top: "#a85a40" },
      { lw: 0.6 },
    ),
  );
  out.push(
    ellipse(cam.pr(0, 0.95, far + 1.6)[0], cam.pr(0, 0.95, far + 1.6)[1], 8, 4, "#ffffff", {
      stroke: "#c8b8b0",
      strokeWidth: 0.5,
    }),
  );
  // Swagged pink curtains on the arch.
  const [cxl, cyl] = cam.pr(-1.3, 2.9, far);
  const [cxr, cyr] = cam.pr(1.3, 2.9, far);
  out.push(
    path(
      `M${n(cxl)} ${n(cyl)}Q${n((cxl + cxr) / 2)} ${n(cyl + 22)} ${n(cxr)} ${n(cyr)}L${n(cxr)} ${n(cyr - 6)}Q${n((cxl + cxr) / 2)} ${n(cyl + 10)} ${n(cxl)} ${n(cyl - 6)}Z`,
      "#c85a6a",
      { stroke: "#6a2a30", strokeWidth: 0.8 },
    ),
  );
  out.push(
    path(
      `M${n(cxl)} ${n(cyl - 6)}Q${n(cxl + 8)} ${n(cyl + 30)} ${n(cxl + 2)} ${n(a0[1])}L${n(cxl - 8)} ${n(a0[1])}Q${n(cxl - 4)} ${n(cyl + 30)} ${n(cxl - 6)} ${n(cyl - 6)}Z`,
      "#b84a5a",
      { stroke: "#6a2a30", strokeWidth: 0.8 },
    ),
  );
  out.push(
    path(
      `M${n(cxr)} ${n(cyr - 6)}Q${n(cxr - 8)} ${n(cyr + 30)} ${n(cxr - 2)} ${n(a1[1])}L${n(cxr + 8)} ${n(a1[1])}Q${n(cxr + 4)} ${n(cyr + 30)} ${n(cxr + 6)} ${n(cyr - 6)}Z`,
      "#b84a5a",
      { stroke: "#6a2a30", strokeWidth: 0.8 },
    ),
  );
  // A lamp on a side table, left, glowing.
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.rg(150, 165, 150, [
        [0, "#fff0c0", 0.4],
        [1, "#fff0c0", 0],
      ]),
    ),
  );
  out.push(
    box3(
      cam,
      -3.4,
      -2.5,
      0,
      0.8,
      3.2,
      4.0,
      { end: "#8a3a3a", side: "#a84a48", top: "#d88070" },
      { lw: 0.7 },
    ),
  );
  const lb = cam.pr(-2.95, 0.8, 3.6);
  const k = cam.s(3.6);
  out.push(
    path(
      `M${n(lb[0] - k * 0.08)} ${n(lb[1])}Q${n(lb[0] - k * 0.12)} ${n(lb[1] - k * 0.3)} ${n(lb[0])} ${n(lb[1] - k * 0.38)}Q${n(lb[0] + k * 0.12)} ${n(lb[1] - k * 0.3)} ${n(lb[0] + k * 0.08)} ${n(lb[1])}Z`,
      "#f0e0e8",
      { stroke: "#8a5a60", strokeWidth: 0.7 },
    ),
  );
  out.push(
    path(
      `M${n(lb[0] - k * 0.3)} ${n(lb[1] - k * 0.38)}L${n(lb[0] - k * 0.2)} ${n(lb[1] - k * 0.75)}L${n(lb[0] + k * 0.2)} ${n(lb[1] - k * 0.75)}L${n(lb[0] + k * 0.3)} ${n(lb[1] - k * 0.38)}Z`,
      D.lg(lb[0] - k * 0.3, 0, lb[0] + k * 0.3, 0, [
        [0, "#fff4e0"],
        [1, "#f0c0b0"],
      ]),
      { stroke: "#a86a60", strokeWidth: 0.8 },
    ),
  );
  // A potted fern, right.
  const pot = cam.pr(3.1, 0, 3.6);
  const kp = cam.s(3.6);
  out.push(
    path(
      `M${n(pot[0] - kp * 0.25)} ${n(pot[1] - kp * 0.5)}L${n(pot[0] + kp * 0.25)} ${n(pot[1] - kp * 0.5)}L${n(pot[0] + kp * 0.18)} ${n(pot[1])}L${n(pot[0] - kp * 0.18)} ${n(pot[1])}Z`,
      "#c8b8a0",
      { stroke: "#5a4a3a", strokeWidth: 0.8 },
    ),
  );
  let fronds = "";
  for (let i = 0; i < 11; i++) {
    const a = -Math.PI / 2 + (i - 5) * 0.28 + R.range(-0.1, 0.1);
    const len = kp * R.range(0.6, 0.95);
    const ex = pot[0] + Math.cos(a) * len;
    const ey = pot[1] - kp * 0.5 + Math.sin(a) * len * 0.9;
    fronds += `M${n(pot[0])} ${n(pot[1] - kp * 0.5)}Q${n((pot[0] + ex) / 2 + R.range(-6, 6))} ${n(ey - 10)} ${n(ex)} ${n(ey + 12)}`;
  }
  out.push(path(fronds, "none", { stroke: "#5a7a3a", strokeWidth: 3.5, strokeLinecap: "round" }));
  out.push(path(fronds, "none", { stroke: "#8aa04a", strokeWidth: 1.2, strokeLinecap: "round" }));
  // A tufted settee against the right wall.
  out.push(
    box3(
      cam,
      2.9,
      3.9,
      0.2,
      0.75,
      5.2,
      7.4,
      { end: "#a8445a", side: "#c85a70", top: "#d87888" },
      { lw: 0.7 },
    ),
  );
  out.push(
    box3(cam, 3.5, 3.9, 0.75, 1.5, 5.2, 7.4, { end: "#983a50", side: "#b84e64" }, { lw: 0.7 }),
  );
  // Ceiling light, a frosted bowl.
  const cl = cam.pr(0, H, 4);
  out.push(ellipse(cl[0], cl[1] + 6, 26, 9, "#fff4e8", { stroke: "#b07a70", strokeWidth: 0.8 }));
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.rg(cl[0], cl[1] + 6, 220, [
        [0, "#fff4e0", 0.25],
        [1, "#fff4e0", 0],
      ]),
    ),
  );
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.rg(275, 210, 380, [
        [0.5, "#3a0a10", 0],
        [1, "#3a0a10", 0.5],
      ]),
    ),
  );
  return doc({ title: "background/background_5 (Remastered)", body: out.join(""), defs: D });
}

/** background_7: headstones under a night sky (behind the prowler and the question mark). */
function bg7() {
  const D = new Defs("b7");
  const R = rng(7);
  const out = [];
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.lg(0, 0, 0, 400, [
        [0, "#000000"],
        [0.55, "#0b1018"],
        [1, "#182838"],
      ]),
    ),
  );
  for (let i = 0; i < 70; i++)
    out.push(
      circle(R.range(0, 550), R.range(0, 230), R.range(0.4, 1.1), "#e8ecff", {
        opacity: R.range(0.3, 0.9),
      }),
    );
  // Moonlight from the upper right: a soft glow.
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.rg(470, 40, 260, [
        [0, "#c8d8f0", 0.22],
        [1, "#c8d8f0", 0],
      ]),
    ),
  );
  // A distant row of stones and a yew, blue-black.
  out.push(
    path("M0 300Q60 286 120 296Q190 280 260 294Q340 282 420 292Q490 284 550 296V400H0Z", "#0e1620"),
  );
  for (let i = 0; i < 9; i++)
    out.push(
      headstone(
        D,
        30 + i * 62 + R.range(-10, 10),
        300,
        R.range(12, 18),
        R.range(16, 26),
        R.pick(["round", "cross", "tablet"]),
        "#2a3444",
        { ink: "#0a0e14", lw: 0.6, tilt: R.range(-6, 6) },
      ),
    );
  out.push(
    path(
      scallop(
        [
          [360, 302],
          [366, 250],
          [378, 206],
          [392, 172],
          [404, 150],
          [414, 172],
          [426, 206],
          [438, 250],
          [446, 302],
        ],
        0.28,
        R,
      ),
      "#0c1610",
    ),
  );
  out.push(
    path(
      scallop(
        [
          [330, 302],
          [338, 270],
          [350, 248],
          [362, 270],
          [370, 302],
        ],
        0.3,
        R,
      ),
      "#0e1812",
    ),
  );
  out.push(fogBand(D, 270, 330, "#5a6a80", 0.3, R));
  // Near stones, moonlit, crooked: the original's arrangement.
  const stones = [
    [70, 400, 86, 120, "round", -4],
    [168, 392, 46, 210, "obelisk", 1],
    [168, 392, 0, 0, "", 0],
    [258, 396, 70, 86, "tablet", 3],
    [338, 398, 62, 112, "round", -2],
    [492, 400, 96, 140, "tablet", 2],
  ];
  for (const [x, y, w, h, kind, tilt] of stones) {
    if (!kind) continue;
    out.push(
      headstone(D, x, y, w, h, kind, "#6a7a90", { ink: "#0a0e14", lw: 1.2, tilt, moss: true, R }),
    );
  }
  // A tall cross on the obelisk's plinth (silhouette like the original's).
  out.push(headstone(D, 168, 186, 48, 70, "cross", "#7a8aa0", { ink: "#0a0e14", lw: 1.2 }));
  // Moon rim light on the stones' right edges.
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.lg(0, 0, 550, 0, [
        [0, "#000", 0.25],
        [1, "#c8d8f0", 0.05],
      ]),
    ),
  );
  // Ivy and long grass in front.
  out.push(grass(0, 550, 402, 34, "#16261a", R, 140));
  out.push(grass(0, 550, 402, 20, "#24402a", R, 90));
  let ivy = "";
  for (let i = 0; i < 26; i++) {
    const x = R.pick([40, 70, 100, 320, 350, 470, 510]) + R.range(-20, 20);
    const y = R.range(330, 395);
    ivy += `M${n(x)} ${n(y)}q-4 -5 0 -9q4 4 0 9z`;
  }
  out.push(path(ivy, "#2e5a34", { stroke: "#0e1a10", strokeWidth: 0.4 }));
  return doc({ title: "background/background_7 (Remastered)", body: out.join(""), defs: D });
}

export const pieces = [
  {
    id: "background/background_2",
    kind: "redraw",
    overrides: "background/background_2",
    usedBy: "customer backdrop; the backdrop of a rival's letter",
    grade: "B",
    notes:
      "A dark panelled sitting room: drapes and net curtains at a grey window, a wing chair, a fringed lamp; centre kept dark.",
    render: bg2,
  },
  {
    id: "background/background_3",
    kind: "redraw",
    overrides: "background/background_3",
    usedBy: "customer backdrop; City Hall's stand-in in the Expanded content",
    grade: "B",
    notes:
      "Under the rafters of a half-ruined church, trusses receding to a glowing arched window, rubble on the floor.",
    render: bg3,
  },
  {
    id: "background/background_5",
    kind: "redraw",
    overrides: "background/background_5",
    usedBy: "the Twins' arson offer (bg behind people/m_old_3)",
    grade: "B",
    notes:
      "A pink, over-upholstered parlor: sprigged wallpaper, rose carpet, a swagged arch to a viewing room, a lamp and a fern.",
    render: bg5,
  },
  {
    id: "background/background_7",
    kind: "redraw",
    overrides: "background/background_7",
    usedBy: "risks (the prowler, the question mark)",
    grade: "B",
    notes:
      "Moonlit crooked headstones and a tall cross under a starry black sky, ivy and grass in front; follows the original's layout.",
    render: bg7,
  },
];
void blob;
void poly;
void shade;
void smooth;
void tint;
function blob() {}
