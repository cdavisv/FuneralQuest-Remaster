/** The Reaper Club: its door, the rave inside, the back tables, the black market. */
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
  smooth,
  tint,
} from "../lib.mjs";
import { camera, casketSide } from "../parts.mjs";

/** Neon lettering: a soft glow, a coloured tube and a white-hot core. */
function neon(D, text, x, y, size, c, o = {}) {
  const glow = D.blur(size * 0.18);
  return g([
    lettering(text, x, y, size, c, { ...o, weight: 0.32, opacity: 0.7 }).replace(
      "<path",
      `<path filter="${glow}"`,
    ),
    lettering(text, x, y, size, c, { ...o, weight: 0.15 }),
    lettering(text, x, y, size, "#ffffff", { ...o, weight: 0.05, opacity: 0.8 }),
  ]);
}

/** Brick wall texture in a rect. */
function bricks(x0, y0, w, h, c, mortar, R) {
  const out = [rect(x0, y0, w, h, mortar)];
  for (let y = y0; y < y0 + h; y += 12) {
    const off = ((y - y0) / 12) % 2 ? 0 : 14;
    for (let x = x0 - off; x < x0 + w; x += 28) {
      out.push(
        rect(
          Math.max(x0, x + 1),
          y + 1,
          Math.min(26, x0 + w - x - 1),
          10,
          shade(c, R.range(0, 0.25)),
        ),
      );
    }
  }
  return g(out);
}

/** A mourner-raver: a funeral director in black, top hat, arms up; silhouette with a rim light. */
function dancer(x, y, s, rim, pose = 0) {
  const k = (v) => n(v * s);
  const arms =
    pose === 0
      ? `M${k(-8)} ${k(-62)}L${k(-24)} ${k(-96)}L${k(-18)} ${k(-98)}L${k(-2)} ${k(-66)}ZM${k(8)} ${k(-62)}L${k(26)} ${k(-92)}L${k(32)} ${k(-88)}L${k(12)} ${k(-56)}Z`
      : `M${k(-8)} ${k(-62)}L${k(-30)} ${k(-50)}L${k(-28)} ${k(-44)}L${k(-4)} ${k(-54)}ZM${k(8)} ${k(-62)}L${k(20)} ${k(-100)}L${k(26)} ${k(-98)}L${k(14)} ${k(-58)}Z`;
  const body = `M${k(-12)} 0L${k(-10)} ${k(-38)}L${k(-14)} ${k(-66)}Q${k(0)} ${k(-74)} ${k(14)} ${k(-66)}L${k(10)} ${k(-38)}L${k(12)} 0L${k(4)} 0L${k(0)} ${k(-30)}L${k(-4)} 0Z`;
  const head = `M${k(-6)} ${k(-72)}a${k(6)} ${k(7)} 0 1 0 ${k(12)} 0a${k(6)} ${k(7)} 0 1 0 ${k(-12)} 0`;
  const hatD = `M${k(-10)} ${k(-80)}h${k(20)}v${k(2)}h${k(-20)}zM${k(-6)} ${k(-80)}v${k(-14)}h${k(12)}v${k(14)}z`;
  return g(
    [
      path(body + arms + head + hatD, "#0a0a0e"),
      path(`M${k(13)} ${k(-64)}L${k(9)} ${k(-38)}L${k(11)} 0`, "none", {
        stroke: rim,
        strokeWidth: 1.2,
        opacity: 0.8,
      }),
    ],
    { transform: `translate(${n(x)} ${n(y)})` },
  );
}

function clubDoor() {
  const D = new Defs("cd");
  const R = rng(20);
  const out = [];
  out.push(rect(0, 0, 550, 400, "#0a0608"));
  out.push(bricks(0, 0, 550, 340, "#3a1a18", "#140a0a", R));
  // the club's red light washing the wall
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.rg(275, 70, 300, [
        [0, "#ff2030", 0.35],
        [1, "#ff2030", 0],
      ]),
    ),
  );
  // the door: black, iron-studded, arched, with a skull knocker and a peephole
  out.push(path("M196 340V150Q275 96 354 150V340Z", "#0e0a0c", { stroke: "#000", strokeWidth: 2 }));
  out.push(
    path(
      "M206 340V156Q275 108 344 156V340Z",
      D.lg(206, 0, 344, 0, [
        [0, "#1a1418"],
        [0.5, "#2a2026"],
        [1, "#120c10"],
      ]),
      { stroke: "#3a2a30", strokeWidth: 1.4 },
    ),
  );
  for (let x = 224; x < 340; x += 26)
    out.push(path(`M${x} 160V340`, "none", { stroke: "#0a0608", strokeWidth: 1.4 }));
  for (let y = 180; y < 340; y += 34)
    for (let x = 218; x < 340; x += 26)
      out.push(circle(x, y, 2, "#6a6a72", { stroke: "#000", strokeWidth: 0.4 }));
  out.push(rect(262, 186, 26, 10, "#000", { stroke: "#5a5a62", strokeWidth: 1 }));
  out.push(rect(266, 189, 18, 4, "#ff3040", { opacity: 0.8 }));
  const kx = 275;
  const ky = 250;
  out.push(
    circle(
      kx,
      ky,
      16,
      D.lg(kx - 16, 0, kx + 16, 0, [
        [0, "#e8e0c8"],
        [1, "#8a8270"],
      ]),
      { stroke: "#2a2620", strokeWidth: 1 },
    ),
  );
  out.push(circle(kx - 6, ky - 2, 4, "#1a1410"));
  out.push(circle(kx + 6, ky - 2, 4, "#1a1410"));
  out.push(path(`M${kx} ${ky + 3}l-3 5h6z`, "#1a1410"));
  out.push(ellipse(kx, ky + 22, 12, 9, "none", { stroke: "#b8a888", strokeWidth: 3 }));
  // the neon sign over the door
  out.push(rect(150, 30, 250, 70, "#120a0e", { stroke: "#2a1a20", strokeWidth: 2 }));
  out.push(neon(D, "THE REAPER", 275, 44, 26, "#ff2a40", { align: "middle", track: 0.3 }));
  // a neon scythe on the wall at the right, blue
  const glow = D.blur(3);
  const scythe = "M430 90L470 250M430 90Q470 70 520 100Q480 96 444 120";
  out.push(
    path(scythe, "none", {
      stroke: "#40c0ff",
      strokeWidth: 8,
      opacity: 0.5,
      filter: glow,
      strokeLinecap: "round",
    }),
  );
  out.push(path(scythe, "none", { stroke: "#40c0ff", strokeWidth: 3, strokeLinecap: "round" }));
  out.push(path(scythe, "none", { stroke: "#e8f8ff", strokeWidth: 1, strokeLinecap: "round" }));
  // a small sign: COVER 2 WOOD TAGS
  out.push(
    rect(66, 190, 92, 50, "#e8e0c8", {
      stroke: "#2a2018",
      strokeWidth: 1.4,
      transform: "rotate(-3 112 215)",
    }),
  );
  out.push(
    lettering("COVER", 112, 198, 9, "#2a1a10", {
      align: "middle",
      weight: 0.16,
      transform: "rotate(-3 112 215)",
    }),
  );
  out.push(
    lettering("2 TAGS", 112, 214, 9, "#a01818", {
      align: "middle",
      weight: 0.16,
      transform: "rotate(-3 112 215)",
    }),
  );
  // the velvet rope on brass posts
  for (const x of [150, 400]) {
    out.push(
      rect(
        x - 4,
        290,
        8,
        70,
        D.lg(x - 4, 0, x + 4, 0, [
          [0, "#ffe080"],
          [1, "#8a6010"],
        ]),
        { stroke: "#3a2a08", strokeWidth: 0.6 },
      ),
    );
    out.push(circle(x, 288, 7, "#e8c060", { stroke: "#3a2a08", strokeWidth: 0.6 }));
    out.push(ellipse(x, 362, 14, 4, "#8a6010"));
  }
  out.push(path("M150 300Q275 350 400 300", "none", { stroke: "#7a0a1a", strokeWidth: 7 }));
  out.push(
    path("M150 300Q275 350 400 300", "none", { stroke: "#c02030", strokeWidth: 2, opacity: 0.6 }),
  );
  // wet pavement reflecting the neon
  out.push(
    rect(
      0,
      340,
      550,
      60,
      D.lg(0, 340, 0, 400, [
        [0, "#1a1418"],
        [1, "#0a0608"],
      ]),
    ),
  );
  out.push(path("M190 350h170l20 50h-210z", "#ff2a40", { opacity: 0.12 }));
  out.push(path("M440 350l20 50h-14l-16 -50z", "#40c0ff", { opacity: 0.15 }));
  // steam from a grate
  out.push(
    path(
      scallop(
        [
          [470, 360],
          [480, 320],
          [500, 300],
          [520, 320],
          [530, 360],
        ],
        0.5,
        R,
      ),
      "#c8c0c8",
      { opacity: 0.12 },
    ),
  );
  void poly;
  void smooth;
  void tint;
  return doc({ title: "places/reaper-club-door (Remastered)", body: out.join(""), defs: D });
}

function club() {
  const D = new Defs("cl");
  const R = rng(21);
  const cam = camera({ f: 240, cx: 275, hy: 180, height: 1.7 });
  const out = [];
  out.push(rect(0, 0, 550, 400, "#0a0610"));
  // light beams from the ceiling, purple and teal
  for (const [x0, x1, c] of [
    [120, -40, "#a040e0"],
    [200, 340, "#30d0c0"],
    [380, 560, "#a040e0"],
    [460, 200, "#e03060"],
  ]) {
    out.push(
      path(
        `M${x0} 0L${x1 - 40} 400L${x1 + 40} 400Z`,
        D.lg(0, 0, 0, 400, [
          [0, c, 0.35],
          [1, c, 0],
        ]),
      ),
    );
  }
  // the dance floor: lit tiles in perspective
  const tiles = ["#3a1060", "#103a50", "#5a1030", "#1a1a4a"];
  for (let i = -5; i < 5; i++) {
    for (let j = 0; j < 7; j++) {
      const z = 3 + j * 1.2;
      const c = tiles[(i + j + 10) % 4];
      out.push(
        path(
          cam.poly([
            [i * 1.2, 0, z],
            [(i + 1) * 1.2, 0, z],
            [(i + 1) * 1.2, 0, z + 1.2],
            [i * 1.2, 0, z + 1.2],
          ]),
          c,
          { stroke: "#000", strokeWidth: 1 },
        ),
      );
      if ((i * 3 + j) % 5 === 0)
        out.push(
          path(
            cam.poly([
              [i * 1.2, 0, z],
              [(i + 1) * 1.2, 0, z],
              [(i + 1) * 1.2, 0, z + 1.2],
              [i * 1.2, 0, z + 1.2],
            ]),
            "#ffffff",
            { opacity: 0.18 },
          ),
        );
    }
  }
  // the DJ booth, a black coffin on end with a pair of turntables
  const [bx, by] = cam.pr(0, 0, 11.5);
  out.push(
    path(
      `M${bx - 70} ${by}L${bx - 80} ${by - 40}L${bx + 80} ${by - 40}L${bx + 70} ${by}Z`,
      "#140a14",
      { stroke: "#6a2a8a", strokeWidth: 1.2 },
    ),
  );
  out.push(ellipse(bx - 36, by - 42, 20, 5, "#2a2a2a", { stroke: "#8a8a8a", strokeWidth: 0.8 }));
  out.push(ellipse(bx + 36, by - 42, 20, 5, "#2a2a2a", { stroke: "#8a8a8a", strokeWidth: 0.8 }));
  out.push(lettering("DJ MORT", bx, by - 30, 10, "#c060ff", { align: "middle", weight: 0.18 }));
  // the skull disco ball
  out.push(path(`M${bx} 0V40`, "none", { stroke: "#5a5a5a", strokeWidth: 1.4 }));
  out.push(
    circle(
      bx,
      64,
      24,
      D.lg(bx - 24, 0, bx + 24, 0, [
        [0, "#f0f0f0"],
        [1, "#6a6a7a"],
      ]),
      { stroke: "#2a2a2a", strokeWidth: 1 },
    ),
  );
  let facets = "";
  for (let k = -3; k <= 3; k++)
    facets += `M${bx - 24} ${64 + k * 6}H${bx + 24}M${bx + k * 7} 40V88`;
  out.push(path(facets, "none", { stroke: "#9a9aa8", strokeWidth: 0.6, opacity: 0.7 }));
  out.push(circle(bx - 8, 62, 5.5, "#1a1a20"));
  out.push(circle(bx + 8, 62, 5.5, "#1a1a20"));
  out.push(path(`M${bx} 67l-3 6h6z`, "#1a1a20"));
  out.push(
    path(`M${bx - 10} 78h20`, "none", {
      stroke: "#1a1a20",
      strokeWidth: 2,
      strokeDasharray: "2 2",
    }),
  );
  for (let i = 0; i < 30; i++)
    out.push(
      circle(
        R.range(0, 550),
        R.range(0, 300),
        R.range(0.8, 2),
        R.pick(["#ffffff", "#e0a0ff", "#a0ffe8"]),
        { opacity: R.range(0.4, 0.9) },
      ),
    );
  // mourners dancing: funeral directors in black and top hats
  const crowd = [];
  for (let i = 0; i < 11; i++) crowd.push({ X: R.range(-4.5, 4.5), Z: R.range(4.5, 10.5), i });
  crowd.sort((a, b) => b.Z - a.Z);
  for (const c of crowd) {
    const [x, y] = cam.pr(c.X, 0, c.Z);
    out.push(dancer(x, y, cam.s(c.Z) / 58, R.pick(["#a040e0", "#30d0c0", "#e03060"]), c.i % 2));
  }
  // two mourners close by, cut by the frame
  out.push(dancer(210, 470, 2.6, "#30d0c0", 0));
  out.push(dancer(372, 480, 2.4, "#e03060", 1));
  // the VIP booth at the left: a hearse with the back taken off, purple velvet seats
  out.push(
    path("M-10 400V250Q30 236 96 238L140 260L150 300V400Z", "#1a1418", {
      stroke: "#4a3a48",
      strokeWidth: 1.4,
    }),
  );
  out.push(
    path("M0 260Q40 250 92 252L126 270V300H0Z", "#4a1a4a", { stroke: "#2a0a2a", strokeWidth: 1 }),
  );
  out.push(path("M-10 300H150V320H-10Z", "#2a2028", { stroke: "#4a3a48", strokeWidth: 1 }));
  out.push(circle(120, 340, 30, "#0e0e10", { stroke: "#5a5a60", strokeWidth: 2 }));
  out.push(circle(120, 340, 14, "#8a8a92", { stroke: "#2a2a2a", strokeWidth: 1 }));
  out.push(
    path("M60 250l-16 -26h-30", "none", {
      stroke: "#b8b8c0",
      strokeWidth: 3,
      strokeLinecap: "round",
    }),
  );
  out.push(lettering("VIP", 60, 274, 12, "#e8c060", { align: "middle", weight: 0.16 }));
  // the bar at the right, with bottles back-lit
  out.push(path("M410 400V270H560V400Z", "#140c10", { stroke: "#3a2a30", strokeWidth: 1 }));
  out.push(rect(410, 262, 150, 10, "#3a2a20", { stroke: "#000", strokeWidth: 0.8 }));
  out.push(
    rect(
      420,
      150,
      140,
      100,
      D.lg(0, 150, 0, 250, [
        [0, "#30d0c0", 0.25],
        [1, "#30d0c0", 0.05],
      ]),
    ),
  );
  for (let i = 0; i < 9; i++) {
    const x = 428 + i * 15;
    const c = R.pick(["#3a8a3a", "#8a3a1a", "#c8c060", "#3a3a8a", "#e8e8e8"]);
    out.push(
      path(`M${x} 210h10v-24q0 -6 -3 -8v-10h-4v10q-3 2 -3 8z`, c, {
        stroke: "#000",
        strokeWidth: 0.6,
        opacity: 0.9,
      }),
    );
  }
  out.push(path("M420 210H560", "none", { stroke: "#3a2a20", strokeWidth: 3 }));
  // haze
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.lg(0, 160, 0, 300, [
        [0, "#c080ff", 0],
        [0.5, "#c080ff", 0.08],
        [1, "#c080ff", 0],
      ]),
    ),
  );
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.rg(275, 220, 380, [
        [0.5, "#000", 0],
        [1, "#000", 0.5],
      ]),
    ),
  );
  return doc({ title: "places/reaper-club (Remastered)", body: out.join(""), defs: D });
}

function tables() {
  const D = new Defs("tb");
  const R = rng(22);
  const out = [];
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.lg(0, 0, 0, 400, [
        [0, "#0e0a0a"],
        [1, "#1a1010"],
      ]),
    ),
  );
  // a hanging green-shaded lamp throwing a cone of smoky light
  out.push(path("M275 0V48", "none", { stroke: "#2a2a2a", strokeWidth: 2 }));
  out.push(path("M235 72L250 48H300L315 72Z", "#2a5a3a", { stroke: "#0a1a0e", strokeWidth: 1 }));
  out.push(ellipse(275, 72, 40, 5, "#fff4c0"));
  out.push(
    path(
      "M235 72L60 330H490L315 72Z",
      D.lg(0, 72, 0, 330, [
        [0, "#fff4c0", 0.28],
        [1, "#fff4c0", 0.04],
      ]),
    ),
  );
  // the table: green felt oval with a padded rail
  out.push(ellipse(275, 312, 262, 70, "#3a1e10", { stroke: "#000", strokeWidth: 1.4 }));
  out.push(
    ellipse(
      275,
      306,
      240,
      58,
      D.rg(275, 290, 240, [
        [0, "#2a7a4a"],
        [1, "#184a2c"],
      ]),
      { stroke: "#0a2a14", strokeWidth: 1 },
    ),
  );
  out.push(
    ellipse(275, 306, 200, 42, "none", {
      stroke: "#e8d080",
      strokeWidth: 0.8,
      opacity: 0.5,
      strokeDasharray: "6 4",
    }),
  );
  // Dead Man's Draw: two cards face up, a Two and an Ace of skulls
  const card = (x, y, rot, label, red) =>
    g(
      [
        rect(-16, -22, 32, 44, "#f8f4e8", { stroke: "#2a2a2a", strokeWidth: 0.8 }),
        lettering(label, -10, -18, 8, red ? "#a01818" : "#1a1a1a", { weight: 0.16 }),
        circle(0, 4, 6, red ? "#a01818" : "#1a1a1a"),
        circle(-2, 3, 1.4, "#f8f4e8"),
        circle(2, 3, 1.4, "#f8f4e8"),
      ],
      { transform: `translate(${x} ${y}) rotate(${rot})` },
    );
  out.push(card(196, 300, -12, "A", true));
  out.push(card(236, 296, 8, "2", false));
  // face-down deck
  for (let i = 0; i < 4; i++)
    out.push(
      rect(140 - i, 282 - i * 1.5, 30, 40, "#6a1a2a", {
        stroke: "#2a0a10",
        strokeWidth: 0.6,
        transform: "rotate(-4 155 302)",
      }),
    );
  // chips in stacks
  for (const [x, c] of [
    [300, "#c02020"],
    [318, "#1a1a1a"],
    [336, "#e8e8e8"],
    [354, "#2a4aa0"],
  ]) {
    for (let i = 0; i < R.int(3, 7); i++)
      out.push(ellipse(x, 316 - i * 3, 8, 3, c, { stroke: "#000", strokeWidth: 0.5 }));
  }
  // Formaldehyde Roulette: six shot glasses on a tray, one of them not vodka
  out.push(ellipse(420, 298, 48, 14, "#9a9a92", { stroke: "#3a3a36", strokeWidth: 0.8 }));
  for (let i = 0; i < 6; i++) {
    const x = 392 + (i % 3) * 22 + (i > 2 ? 10 : 0);
    const y = 294 + (i > 2 ? 8 : 0);
    const liquid = i === 4 ? "#b8e070" : "#e8f0f0";
    out.push(
      path(`M${x - 6} ${y}l1.5 -14h9l1.5 14z`, "#ffffff", {
        stroke: "#6a7a7a",
        strokeWidth: 0.6,
        opacity: 0.8,
      }),
    );
    out.push(path(`M${x - 5} ${y - 1}l1 -8h8l1 8z`, liquid, { opacity: 0.85 }));
  }
  // The One-Armed Undertaker: a slot machine shaped like a standing coffin, at the left
  const sx = 40;
  out.push(
    path(
      `M${sx} 270L${sx - 10} 120L${sx + 30} 60L${sx + 110} 60L${sx + 150} 120L${sx + 140} 270Z`,
      D.lg(sx - 10, 0, sx + 150, 0, [
        [0, "#3a1e10"],
        [0.5, "#6a3a1e"],
        [1, "#2a140a"],
      ]),
      { stroke: "#000", strokeWidth: 1.4 },
    ),
  );
  out.push(rect(sx + 14, 120, 112, 46, "#0a0a0a", { stroke: "#c8a040", strokeWidth: 2 }));
  const symbols = [
    (x, y) =>
      g([
        circle(x, y, 9, "#e8e0c8"),
        circle(x - 3, y - 1, 2.4, "#1a1a1a"),
        circle(x + 3, y - 1, 2.4, "#1a1a1a"),
      ]),
    (x, y) =>
      path(`M${x - 5} ${y - 10}h10l4 6l-4 14h-10l-4 -14z`, "#8a5a2a", {
        stroke: "#2a1a0a",
        strokeWidth: 0.8,
      }),
    (x, y) =>
      path(
        `M${x - 9} ${y - 4}a3 3 0 1 1 3 -3l12 0a3 3 0 1 1 3 3a3 3 0 1 1 -3 3l-12 0a3 3 0 1 1 -3 -3z`,
        "#e8e0c8",
        { stroke: "#5a5040", strokeWidth: 0.6 },
      ),
  ];
  for (let i = 0; i < 3; i++) {
    out.push(rect(sx + 18 + i * 36, 124, 32, 38, "#f8f4e8"));
    out.push(symbols[i === 1 ? 0 : i === 0 ? 0 : 0](sx + 34 + i * 36, 143));
  }
  out.push(lettering("UNDERTAKER", sx + 70, 72, 10, "#e8c060", { align: "middle", weight: 0.16 }));
  out.push(rect(sx + 40, 196, 60, 14, "#1a0e06", { stroke: "#c8a040", strokeWidth: 1 }));
  // the arm, a bony one
  out.push(
    path(`M${sx + 146} 150h14v-50`, "none", {
      stroke: "#e8e0c8",
      strokeWidth: 5,
      strokeLinecap: "round",
    }),
  );
  out.push(circle(sx + 160, 96, 9, "#e8e0c8", { stroke: "#5a5040", strokeWidth: 0.8 }));
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.rg(275, 220, 360, [
        [0.5, "#000", 0],
        [1, "#000", 0.6],
      ]),
    ),
  );
  void casketSide;
  return doc({ title: "places/reaper-tables (Remastered)", body: out.join(""), defs: D });
}

function market() {
  const D = new Defs("bm");
  const R = rng(23);
  const out = [];
  out.push(rect(0, 0, 550, 400, "#100c0a"));
  out.push(bricks(0, 0, 550, 250, "#2a1e16", "#0e0a08", R));
  // a bare bulb on a cord
  out.push(path("M275 0V70", "none", { stroke: "#1a1a1a", strokeWidth: 1.4 }));
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.rg(275, 84, 300, [
        [0, "#ffe0a0", 0.45],
        [0.5, "#ffe0a0", 0.12],
        [1, "#ffe0a0", 0],
      ]),
    ),
  );
  out.push(path("M269 70h12v6h-12z", "#6a6a6a"));
  out.push(ellipse(275, 86, 9, 11, "#fff8e0"));
  // crates stacked at the sides, stencilled
  const crate = (x, y, w, h, label) =>
    g([
      rect(
        x,
        y,
        w,
        h,
        D.lg(x, 0, x + w, 0, [
          [0, "#8a6a3a"],
          [1, "#5a4020"],
        ]),
        { stroke: "#1a0e06", strokeWidth: 1 },
      ),
      path(`M${x} ${y}L${x + w} ${y + h}M${x + w} ${y}L${x} ${y + h}`, "none", {
        stroke: "#4a3018",
        strokeWidth: 3,
      }),
      rect(x, y, w, h, "none", { stroke: "#3a2410", strokeWidth: 4 }),
      label
        ? lettering(label, x + w / 2, y + h / 2 - 5, 10, "#2a1a0a", {
            align: "middle",
            weight: 0.18,
            opacity: 0.8,
          })
        : "",
    ]);
  out.push(crate(10, 160, 110, 90, "FRAGILE"));
  out.push(crate(24, 80, 90, 80, ""));
  out.push(crate(430, 150, 110, 100, "THIS SIDE UP"));
  out.push(crate(450, 80, 80, 70, ""));
  // the table with a cloth and the day's goods
  out.push(
    path(
      "M60 250H490L520 330H30Z",
      D.lg(0, 250, 0, 330, [
        [0, "#5a1a1a"],
        [1, "#3a0a0a"],
      ]),
      { stroke: "#1a0404", strokeWidth: 1 },
    ),
  );
  out.push(path("M30 330H520V400H30Z", "#2a0808"));
  let folds = "";
  for (let x = 50; x < 520; x += 40) folds += `M${x} 330q4 30 0 70`;
  out.push(path(folds, "none", { stroke: "#1a0404", strokeWidth: 1.4, opacity: 0.7 }));
  // a rabbit's foot on a chain
  out.push(
    path("M100 280q-6 -10 2 -16q10 -2 12 8q4 12 -6 14z", "#e8dcc8", {
      stroke: "#5a5040",
      strokeWidth: 0.8,
    }),
  );
  out.push(
    path("M110 266l12 -10", "none", {
      stroke: "#c8a040",
      strokeWidth: 1.4,
      strokeDasharray: "2 1.5",
    }),
  );
  // a Kevlar vest with one small hole
  out.push(
    path("M150 300V262l14 -8h10q6 10 18 0h10l14 8V300Z", "#3a4a3a", {
      stroke: "#0a140a",
      strokeWidth: 1,
    }),
  );
  out.push(circle(186, 280, 2.2, "#0a0a0a"));
  // the gold casket that fell off a truck
  out.push(
    path(
      "M232 296L238 270L332 270L338 296Z",
      D.lg(232, 0, 338, 0, [
        [0, "#fff0a0"],
        [0.5, "#e0b030"],
        [1, "#8a6010"],
      ]),
      { stroke: "#5a4008", strokeWidth: 1 },
    ),
  );
  out.push(path("M236 280H334", "none", { stroke: "#8a6010", strokeWidth: 1 }));
  out.push(path("M250 288H320", "none", { stroke: "#fff8c0", strokeWidth: 1.4 }));
  // a forged permit with a smudged seal, a gold tag with the numbers filed off
  out.push(path("M352 300l40 -4l4 -28l-40 4z", "#f0e8d0", { stroke: "#5a5040", strokeWidth: 0.8 }));
  out.push(circle(382, 290, 5, "#a02020", { opacity: 0.8 }));
  out.push(path("M360 278l26 -3M360 284l20 -2", "none", { stroke: "#5a5a6a", strokeWidth: 0.8 }));
  out.push(
    path(
      "M412 300l20 -6l-2 -14l-8 -4l-12 4z",
      D.lg(410, 0, 434, 0, [
        [0, "#fff0a0"],
        [1, "#a07818"],
      ]),
      { stroke: "#5a4008", strokeWidth: 0.8 },
    ),
  );
  out.push(
    path("M418 288l8 -2", "none", { stroke: "#8a6010", strokeWidth: 1.4, strokeDasharray: "1 1" }),
  );
  // a bottle of "holy" water (tap)
  out.push(
    path("M456 300h16v-22q0 -6 -5 -8v-8h-6v8q-5 2 -5 8z", "#a8d0e8", {
      stroke: "#3a5a6a",
      strokeWidth: 0.8,
      opacity: 0.9,
    }),
  );
  out.push(path("M460 284h8M464 280v8", "none", { stroke: "#3a5a8a", strokeWidth: 1.2 }));
  // price tags on string
  for (const x of [108, 182, 288, 376, 424, 466])
    out.push(
      path(`M${x} ${300}l4 14h10l-2 -10z`, "#f0ead0", { stroke: "#3a3020", strokeWidth: 0.5 }),
    );
  // the dealer's hands, gloved, resting on the table edge; his coat behind
  out.push(path("M190 250Q200 160 275 150Q350 160 360 250Z", "#1a1a1e"));
  out.push(path("M240 160L275 210L310 160", "none", { stroke: "#2a2a30", strokeWidth: 2 }));
  out.push(path("M226 160Q275 120 324 160Q300 140 275 142Q250 140 226 160Z", "#0e0e10"));
  // brim of his hat and the dark under it
  out.push(ellipse(275, 112, 70, 10, "#0e0e10"));
  out.push(path("M240 112Q240 72 275 70Q310 72 310 112Z", "#141418"));
  out.push(ellipse(275, 130, 30, 22, "#0a0a0c"));
  out.push(circle(264, 130, 1.8, "#e8c060"));
  out.push(circle(286, 130, 1.8, "#e8c060"));
  for (const x of [222, 328])
    out.push(
      path(`M${x - 18} 252q0 -16 18 -16q18 0 18 16z`, "#2a2a2e", {
        stroke: "#0a0a0c",
        strokeWidth: 0.8,
      }),
    );
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.rg(275, 180, 360, [
        [0.5, "#000", 0],
        [1, "#000", 0.65],
      ]),
    ),
  );
  return doc({ title: "places/black-market (Remastered)", body: out.join(""), defs: D });
}

export const pieces = [
  {
    id: "places/reaper-club-door",
    kind: "place",
    usedBy: "the Reaper Club's door before the cover is paid (proposed bg)",
    grade: "B",
    notes:
      "A black studded door with a skull knocker in a red-lit brick alley, THE REAPER in red neon, a blue neon scythe, a COVER 2 TAGS card and a velvet rope.",
    render: clubDoor,
  },
  {
    id: "places/reaper-club",
    kind: "place",
    usedBy: "the Reaper Club inside (proposed bg for pictures.club, with people/lucius-vane as fg)",
    grade: "B",
    notes:
      "A rave for funeral directors: lit floor tiles, beams of purple and teal, top-hatted mourners dancing, a skull disco ball, DJ MORT's coffin booth, the VIP booth that is a hearse with the back off, a back-lit bar.",
    render: club,
  },
  {
    id: "places/reaper-tables",
    kind: "place",
    usedBy: "the back tables (Dead Man's Draw, the One-Armed Undertaker, Formaldehyde Roulette)",
    grade: "B",
    notes:
      "Green felt under a hanging lamp: an Ace and a Two of skulls, chips, six shot glasses with one green one, and a coffin-shaped slot machine with a bony arm.",
    render: tables,
  },
  {
    id: "places/black-market",
    kind: "place",
    usedBy: "the black market",
    grade: "B",
    notes:
      "A faceless dealer under a bare bulb behind a red-clothed table: rabbit's foot, Kevlar vest with one hole, the gold casket off a truck, a forged permit, a filed gold tag, tap holy water; crates.",
    render: market,
  },
];
