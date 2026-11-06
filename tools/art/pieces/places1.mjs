/** Expanded places: the town graveyard (and its duel), City Hall, the Mayor's office. */
import { lettering } from "../font.mjs";
import {
  circle,
  Defs,
  doc,
  ellipse,
  g,
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
import { bareTree, box3, camera, fogBand, grass, headstone, streetLamp } from "../parts.mjs";

/** The graveyard: mounds and stones receding into fog, an iron gate, a dead tree. */
function graveyardScene(D, R, duel) {
  const cam = camera({ f: 280, cx: 275, hy: 190, height: 1.7 });
  const out = [];
  const FOG = "#a8b0b8";
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.lg(0, 0, 0, 220, [
        [0, "#1a2028"],
        [0.6, "#4a5560"],
        [1, "#8a949c"],
      ]),
    ),
  );
  // a pale moon behind the murk
  out.push(circle(430, 70, 30, "#d8dcd0", { opacity: 0.5 }));
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.rg(430, 70, 160, [
        [0, "#c8d0d0", 0.25],
        [1, "#c8d0d0", 0],
      ]),
    ),
  );
  // distant hill line
  out.push(path("M0 196Q120 176 250 188Q380 172 550 190V230H0Z", "#3a4248"));
  // ground plane
  out.push(
    path(
      cam.poly([
        [-30, 0, 2],
        [30, 0, 2],
        [30, 0, 90],
        [-30, 0, 90],
      ]),
      D.lg(0, 190, 0, 400, [
        [0, "#4a5048"],
        [1, "#22261e"],
      ]),
    ),
  );
  // rows of graves: mound + stone, far to near, a fog veil per row
  const rows = [];
  for (let z = 40; z > 3.5; z *= 0.82) rows.push(z);
  const kinds = ["round", "cross", "tablet", "round", "slab", "obelisk", "tablet"];
  for (const z of rows) {
    out.push(rect(0, 0, 550, 400, FOG, { opacity: 0.1 }));
    for (let X = -14; X <= 14; X += R.range(2.2, 3.6)) {
      if (duel && Math.abs(X) < 2.5 && z < 7) continue;
      const xx = X + R.range(-0.5, 0.5);
      const [x, y] = cam.pr(xx, 0, z);
      if (x < -60 || x > 610) continue;
      const k = cam.s(z);
      // the mound in front of the stone
      out.push(
        ellipse(x, y + k * 0.35, k * 0.42, k * 0.16, mix2("#3a3a2a", "#5a5440"), {
          stroke: "#1a1a12",
          strokeWidth: Math.max(0.3, k * 0.006),
        }),
      );
      out.push(ellipse(x - k * 0.08, y + k * 0.3, k * 0.24, k * 0.06, "#6a6450", { opacity: 0.6 }));
      const kind = R.pick(kinds);
      const hgt = k * R.range(0.55, kind === "obelisk" ? 1.6 : 0.95);
      out.push(
        headstone(
          D,
          x,
          y,
          k * R.range(0.42, 0.6),
          hgt,
          kind,
          R.pick(["#7a8494", "#8a8a84", "#6a7480"]),
          { ink: "#14161a", lw: Math.max(0.4, k * 0.012), tilt: R.range(-8, 8), moss: z < 10, R },
        ),
      );
    }
  }
  // fog lying in the hollows
  out.push(fogBand(D, 200, 420, FOG, 0.35, R));
  out.push(fogBand(D, 250, 420, "#c8ccd0", 0.25, R, 3));
  // the dead tree at left, crows on it
  out.push(bareTree(70, 330, 300, "#14161a", R, { lean: 0.15, depth: 6, width: 9 }));
  for (const [x, y] of [
    [118, 150],
    [60, 128],
    [160, 186],
  ]) {
    out.push(
      path(`M${x} ${y}q4 -7 10 -4q4 -4 7 0l-3 3q2 5 -4 7l-2 4h-2l1 -4q-6 -1 -7 -6z`, "#08080a"),
    );
  }
  // the iron fence across the right foreground
  let bars = "";
  for (let x = 330; x < 560; x += 14)
    bars += `M${x} 400V${300 - (x - 330) * 0.12}M${x - 3} ${304 - (x - 330) * 0.12}l3 -10l3 10`;
  out.push(path(bars, "none", { stroke: "#0c0c10", strokeWidth: 2.6, strokeLinejoin: "miter" }));
  out.push(path("M326 320L560 292M326 380L560 360", "none", { stroke: "#0c0c10", strokeWidth: 3 }));
  // grass in front
  out.push(grass(0, 550, 402, 26, "#1a2018", R, 120));
  if (duel) {
    // an open grave in the middle, a heap of earth, two shovels stuck in it
    out.push(path("M150 352L380 352L420 400L110 400Z", "#0c0806"));
    out.push(path("M150 352L380 352L376 362L156 362Z", "#3a2a1a"));
    out.push(
      path(
        scallop(
          [
            [340, 356],
            [370, 318],
            [420, 300],
            [480, 316],
            [520, 356],
            [430, 368],
          ],
          0.35,
          R,
        ),
        "#4a3a26",
        { stroke: "#1a120a", strokeWidth: 1 },
      ),
    );
    out.push(
      path("M380 330L414 300L470 306L496 340", "none", {
        stroke: "#6a5638",
        strokeWidth: 2,
        opacity: 0.7,
      }),
    );
    for (const [x, y, a] of [
      [440, 312, -18],
      [470, 316, 16],
    ]) {
      out.push(
        g(
          [
            rect(-2.5, -96, 5, 96, "#6a4a28", { stroke: "#1a0e06", strokeWidth: 0.8 }),
            path("M-10 -100h20v8h-20z", "#6a4a28", { stroke: "#1a0e06", strokeWidth: 0.8 }),
            path(
              "M-12 0h24l-2 34q-10 8 -20 0z",
              D.lg(-12, 0, 12, 0, [
                [0, "#9a9a92"],
                [1, "#4a4a44"],
              ]),
              { stroke: "#14141a", strokeWidth: 0.8 },
            ),
          ],
          { transform: `translate(${x} ${y}) rotate(${a})` },
        ),
      );
    }
    // a lantern on the heap throwing a warm pool of light
    out.push(
      rect(
        0,
        0,
        550,
        400,
        D.rg(400, 300, 160, [
          [0, "#ffcc66", 0.3],
          [1, "#ffcc66", 0],
        ]),
      ),
    );
    out.push(path("M392 298h16v-20h-16z", "#ffe8a0", { stroke: "#2a1a0a", strokeWidth: 1.2 }));
    out.push(path("M390 278h20l-4 -6h-12z", "#2a1a0a"));
    // the upper left stays dark and plain for the duel's power bars
    out.push(
      rect(
        0,
        0,
        550,
        400,
        D.rg(60, 20, 260, [
          [0, "#000", 0.55],
          [1, "#000", 0],
        ]),
      ),
    );
  }
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.rg(275, 220, 380, [
        [0.5, "#000", 0],
        [1, "#000", 0.55],
      ]),
    ),
  );
  return out.join("");
}
function mix2(a) {
  return a;
}

function graveyard() {
  const D = new Defs("gy");
  return doc({
    title: "places/graveyard (Remastered)",
    body: graveyardScene(D, rng(16), false),
    defs: D,
  });
}
function duel() {
  const D = new Defs("gd");
  return doc({
    title: "places/graveyard-duel (Remastered)",
    body: graveyardScene(D, rng(16), true),
    defs: D,
  });
}

/** City Hall: a pompous little classical hall with a clock tower and the Mayor's own statue. */
function cityHall() {
  const D = new Defs("chx");
  const R = rng(18);
  const out = [];
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.lg(0, 0, 0, 300, [
        [0, "#7a8c9c"],
        [1, "#c8d0d4"],
      ]),
    ),
  );
  for (const [x, y, w] of [
    [30, 40, 140],
    [380, 26, 150],
    [220, 70, 110],
  ])
    out.push(
      path(
        scallop(
          [
            [x, y],
            [x + w * 0.3, y - 12],
            [x + w * 0.65, y - 8],
            [x + w, y + 2],
            [x + w * 0.5, y + 10],
          ],
          0.5,
          R,
        ),
        "#e4e8e8",
        { opacity: 0.6 },
      ),
    );
  const ink = { stroke: P.ink, strokeWidth: 1.1, strokeLinejoin: "round" };
  const stone = "#d8d0bc";
  const stoneLo = "#a89c84";
  // clock tower behind
  out.push(
    rect(
      240,
      40,
      70,
      120,
      D.lg(240, 0, 310, 0, [
        [0, stone],
        [1, stoneLo],
      ]),
      ink,
    ),
  );
  out.push(path("M232 44L275 6L318 44Z", "#5a6a5a", ink));
  out.push(path("M275 6V-10", "none", { stroke: P.ink, strokeWidth: 1.5 }));
  out.push(path("M275 -6l14 4l-14 4z", "#a02020", { stroke: P.ink, strokeWidth: 0.8 }));
  out.push(circle(275, 78, 20, "#f4f0e0", ink));
  out.push(
    path("M275 78V64M275 78L286 84", "none", {
      stroke: "#1a1a1a",
      strokeWidth: 2,
      strokeLinecap: "round",
    }),
  );
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    out.push(circle(275 + Math.cos(a) * 16, 78 + Math.sin(a) * 16, 0.9, "#1a1a1a"));
  }
  out.push(path("M258 112h34v40h-34z", "#3a4048", ink));
  // main block
  out.push(
    rect(
      60,
      150,
      430,
      170,
      D.lg(60, 0, 490, 0, [
        [0, tint(stone, 0.2)],
        [0.5, stone],
        [1, stoneLo],
      ]),
      ink,
    ),
  );
  // stone courses
  let courses = "";
  for (let y = 170; y < 320; y += 20) courses += `M60 ${y}H490`;
  out.push(path(courses, "none", { stroke: stoneLo, strokeWidth: 0.6 }));
  // windows either side, arched, with shutters drawn
  for (const x of [84, 136, 376, 428]) {
    for (const y of [176, 250]) {
      out.push(
        path(
          `M${x} ${y + 50}V${y + 14}Q${x + 17} ${y - 4} ${x + 34} ${y + 14}V${y + 50}Z`,
          D.lg(0, y, 0, y + 50, [
            [0, "#3a4a5a"],
            [1, "#5a6a7a"],
          ]),
          ink,
        ),
      );
      out.push(
        path(`M${x + 17} ${y + 4}V${y + 50}M${x} ${y + 28}H${x + 34}`, "none", {
          stroke: tint(stone, 0.3),
          strokeWidth: 2,
        }),
      );
      out.push(rect(x - 4, y + 50, 42, 5, tint(stone, 0.2), ink));
    }
  }
  // portico: pediment, frieze with CITY HALL, columns
  out.push(
    path(
      "M176 152L275 104L374 152Z",
      D.lg(176, 0, 374, 0, [
        [0, tint(stone, 0.25)],
        [1, stoneLo],
      ]),
      ink,
    ),
  );
  out.push(path("M196 146L275 112L354 146Z", "none", { stroke: stoneLo, strokeWidth: 1 }));
  out.push(circle(275, 134, 9, "#c8a040", { stroke: P.ink, strokeWidth: 0.8 }));
  out.push(rect(176, 152, 198, 24, tint(stone, 0.15), ink));
  out.push(
    lettering("CITY HALL", 275, 158, 12, "#3a3428", { align: "middle", weight: 0.13, serif: true }),
  );
  for (let i = 0; i < 6; i++) {
    const x = 186 + i * 36;
    out.push(
      rect(
        x,
        176,
        16,
        120,
        D.lg(x, 0, x + 16, 0, [
          [0, "#f4f0e4"],
          [0.4, stone],
          [1, stoneLo],
        ]),
        ink,
      ),
    );
    let flutes = "";
    for (let fx = 3; fx < 16; fx += 4) flutes += `M${x + fx} 182V292`;
    out.push(path(flutes, "none", { stroke: stoneLo, strokeWidth: 0.6 }));
    out.push(rect(x - 3, 176, 22, 6, stone, ink));
    out.push(rect(x - 3, 292, 22, 6, stone, ink));
  }
  // the great door in the shade of the portico
  out.push(rect(176, 176, 198, 122, "#000", { opacity: 0.18 }));
  out.push(path("M252 298V226Q275 206 298 226V298Z", "#4a2a14", ink));
  out.push(path("M275 214V298", "none", { stroke: P.ink, strokeWidth: 1 }));
  out.push(circle(268, 262, 2, "#c8a040"));
  out.push(circle(282, 262, 2, "#c8a040"));
  // steps
  for (let i = 0; i < 4; i++)
    out.push(rect(160 - i * 12, 298 + i * 8, 230 + i * 24, 8, i % 2 ? "#c8c0ac" : "#d8d0bc", ink));
  // flags on the roof line
  for (const x of [80, 470]) {
    out.push(path(`M${x} 150V96`, "none", { stroke: "#3a3a3a", strokeWidth: 2 }));
    out.push(
      path(`M${x} 98q14 -6 28 0q-14 6 -28 14z`, x < 200 ? "#a02020" : "#2a3a8a", {
        stroke: P.ink,
        strokeWidth: 0.6,
      }),
    );
  }
  // the plaza and the Mayor's statue, pointing at something important
  out.push(
    rect(
      0,
      330,
      550,
      70,
      D.lg(0, 330, 0, 400, [
        [0, "#9a9488"],
        [1, "#6a645a"],
      ]),
    ),
  );
  let flags = "";
  for (let x = -40; x < 590; x += 40) flags += `M${x} 400L${275 + (x - 275) * 0.5} 330`;
  out.push(path(flags, "none", { stroke: "#7a746a", strokeWidth: 0.6 }));
  const sx = 460;
  out.push(
    rect(
      sx - 26,
      300,
      52,
      66,
      D.lg(sx - 26, 0, sx + 26, 0, [
        [0, "#c8c0ac"],
        [1, "#8a8270"],
      ]),
      ink,
    ),
  );
  out.push(rect(sx - 32, 296, 64, 8, "#d8d0bc", ink));
  out.push(rect(sx - 32, 362, 64, 8, "#b8b09c", ink));
  out.push(rect(sx - 16, 318, 32, 12, "#6a5a3a", { stroke: P.ink, strokeWidth: 0.6 }));
  // the bronze mayor: a portly figure with an outflung arm
  const bronze = D.lg(sx - 30, 0, sx + 30, 0, [
    [0, "#9a7a3a"],
    [0.5, "#6a4e20"],
    [1, "#3a2a10"],
  ]);
  out.push(
    path(
      `M${sx - 16} 296L${sx - 12} 262Q${sx - 22} 236 ${sx - 10} 222L${sx + 12} 222Q${sx + 24} 236 ${sx + 14} 262L${sx + 18} 296Z`,
      bronze,
      ink,
    ),
  );
  out.push(circle(sx, 212, 11, bronze, ink));
  out.push(path(`M${sx + 10} 228L${sx + 46} 206L${sx + 50} 212L${sx + 14} 238Z`, bronze, ink));
  out.push(
    path(`M${sx - 10} 230Q${sx - 22} 250 ${sx - 14} 262`, "none", {
      stroke: P.ink,
      strokeWidth: 1,
    }),
  );
  // a pigeon on its head
  out.push(
    path(`M${sx - 4} 202q4 -6 10 -2l4 -2l-2 4q2 4 -6 4z`, "#8a8a92", {
      stroke: P.ink,
      strokeWidth: 0.5,
    }),
  );
  // lamps either side of the steps
  out.push(streetLamp(D, 120, 336, 92, { lit: false }));
  out.push(streetLamp(D, 360, 336, 92, { lit: false }));
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.rg(275, 200, 380, [
        [0.55, "#000", 0],
        [1, "#000", 0.35],
      ]),
    ),
  );
  return doc({ title: "places/city-hall (Remastered)", body: out.join(""), defs: D });
}

/** The Mayor's office: panelling, flags, his own portrait, a vast desk and an empty chair. */
function mayorOffice() {
  const D = new Defs("mo");
  const R = rng(19);
  const out = [];
  const ink = { stroke: P.ink, strokeWidth: 1, strokeLinejoin: "round" };
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.lg(0, 0, 550, 0, [
        [0, "#4a2a18"],
        [0.5, "#6a3e22"],
        [1, "#3a2010"],
      ]),
    ),
  );
  for (let x = 0; x < 550; x += 92) {
    out.push(rect(x + 8, 20, 76, 130, "none", { stroke: "#2a160a", strokeWidth: 2 }));
    out.push(rect(x + 8, 170, 76, 130, "none", { stroke: "#2a160a", strokeWidth: 2 }));
    out.push(path(`M${x + 9} 21H${x + 83}`, "none", { stroke: "#8a5a32", strokeWidth: 1 }));
  }
  // a tall window with venetian blinds at right, daylight in stripes
  out.push(rect(410, 30, 110, 190, "#d8e4ec", ink));
  let blinds = "";
  for (let y = 36; y < 220; y += 8) blinds += `M410 ${y}H520`;
  out.push(path(blinds, "none", { stroke: "#a8b4bc", strokeWidth: 4 }));
  out.push(path("M410 30V220M520 30V220", "none", { stroke: "#2a160a", strokeWidth: 6 }));
  // the Mayor's portrait in a gilt frame, centre top (behind where he stands)
  out.push(
    rect(
      196,
      18,
      158,
      116,
      D.lg(196, 18, 354, 134, [
        [0, "#f0d070"],
        [0.5, "#a07020"],
        [1, "#5a3a08"],
      ]),
      ink,
    ),
  );
  out.push(rect(208, 30, 134, 92, "#2a3a2a"));
  out.push(ellipse(275, 66, 22, 26, "#c88a6a"));
  out.push(path("M240 122Q246 96 275 92Q304 96 310 122Z", "#2a2a34"));
  out.push(path("M262 52q13 -8 26 0", "none", { stroke: "#c8c0b0", strokeWidth: 3 }));
  out.push(path("M266 80q9 4 18 0", "none", { stroke: "#7a3a30", strokeWidth: 1.6 }));
  // flags on poles at left, the town seal on the wall
  for (const [x, c] of [
    [50, "#2a3a8a"],
    [110, "#a02020"],
  ]) {
    out.push(path(`M${x} 300V40`, "none", { stroke: "#c8a040", strokeWidth: 3 }));
    out.push(circle(x, 38, 4, "#e8c060"));
    out.push(
      path(
        `M${x + 2} 46Q${x + 30} 60 ${x + 22} 120Q${x + 30} 170 ${x + 6} 200Q${x} 140 ${x + 2} 46Z`,
        D.lg(x, 0, x + 30, 0, [
          [0, shade(c, 0.3)],
          [0.5, c],
          [1, shade(c, 0.4)],
        ]),
        { stroke: P.ink, strokeWidth: 0.8 },
      ),
    );
  }
  // the leather chair (where the Mayor's portrait stands when he is in)
  out.push(
    path(
      "M196 300V176Q196 150 230 146H320Q354 150 354 176V300Z",
      D.lg(196, 0, 354, 0, [
        [0, "#6a1a14"],
        [0.5, "#8a2a1e"],
        [1, "#4a100a"],
      ]),
      ink,
    ),
  );
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 3; j++) out.push(circle(222 + i * 36, 176 + j * 36, 2.4, "#3a0a06"));
  // the desk: a huge slab with a green leather top
  out.push(
    path(
      "M30 300L520 300L548 330L2 330Z",
      D.lg(0, 300, 0, 330, [
        [0, "#3a6a3a"],
        [1, "#2a4a2a"],
      ]),
      ink,
    ),
  );
  out.push(
    path(
      "M2 330H548V400H2Z",
      D.lg(0, 0, 550, 0, [
        [0, "#5a3218"],
        [0.5, "#7a4a24"],
        [1, "#4a2810"],
      ]),
      ink,
    ),
  );
  for (const x of [40, 400])
    out.push(rect(x, 342, 110, 50, "none", { stroke: "#3a1e0a", strokeWidth: 2 }));
  out.push(circle(95, 366, 3, "#c8a040"));
  out.push(circle(455, 366, 3, "#c8a040"));
  // on the desk: nameplate, a stack of permits and a big rubber stamp, a cigar in an ashtray
  out.push(
    path(
      "M220 312L330 312L326 326L224 326Z",
      D.lg(220, 0, 330, 0, [
        [0, "#f0d070"],
        [1, "#8a6010"],
      ]),
      ink,
    ),
  );
  out.push(lettering("THE MAYOR", 275, 315, 7, "#2a1a08", { align: "middle", weight: 0.16 }));
  out.push(path("M60 318l70 -4l6 10l-70 4z", "#f0ece0", ink));
  out.push(path("M62 314l70 -4l6 10l-70 4z", "#e8e4d4", ink));
  out.push(path("M400 318h22v-8h-22z", "#6a2a1a", ink));
  out.push(path("M406 310q5 -16 10 0z", "#3a2a1a", ink));
  out.push(ellipse(470, 320, 20, 6, "#a8a8a0", ink));
  out.push(
    path("M464 316l30 -8", "none", { stroke: "#7a4a24", strokeWidth: 4, strokeLinecap: "round" }),
  );
  out.push(
    path("M496 306q4 -10 -2 -18q6 -8 0 -16", "none", {
      stroke: "#d8d8d8",
      strokeWidth: 1.4,
      opacity: 0.5,
    }),
  );
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.rg(275, 200, 380, [
        [0.55, "#000", 0],
        [1, "#000", 0.45],
      ]),
    ),
  );
  void R;
  void box3;
  void poly;
  void smooth;
  return doc({ title: "places/mayor-office (Remastered)", body: out.join(""), defs: D });
}

export const pieces = [
  {
    id: "places/graveyard",
    kind: "place",
    usedBy:
      "the town graveyard (proposed bg; content now borrows places/funeral-ceremony over background_celemony)",
    grade: "B",
    notes:
      "Mounds and headstones receding into dense fog under a veiled moon, a dead tree with crows, an iron fence; the Design Doc's 'dense fog covers the many mounds and headstones'.",
    render: graveyard,
  },
  {
    id: "places/graveyard-duel",
    kind: "place",
    usedBy: "graveyard duels (proposed bg for pictures.duel)",
    grade: "B",
    notes:
      "The same graveyard with an open grave front and centre, a heap of earth with two crossed shovels and a lantern; upper left kept plain for the power bars.",
    render: duel,
  },
  {
    id: "places/city-hall",
    kind: "place",
    usedBy: "City Hall (proposed bg for pictures.cityHall)",
    grade: "B",
    notes:
      "A pompous little classical hall: clock tower, pediment and CITY HALL frieze, fluted columns, flags, and the Mayor's bronze statue pointing at something important, with a pigeon.",
    render: cityHall,
  },
  {
    id: "places/mayor-office",
    kind: "place",
    usedBy: "City Hall's inner screens (proposed bg, with people/mayor-grubb as fg)",
    grade: "B",
    notes:
      "Panelled office: his own portrait in gilt, flags, venetian blinds, an oxblood chair centred for the Mayor's bust, a vast desk with THE MAYOR nameplate, permits, stamp and cigar.",
    render: mayorOffice,
  },
];
void tint;
