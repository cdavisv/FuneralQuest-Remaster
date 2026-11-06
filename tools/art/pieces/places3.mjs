/** The parlor office, body-preparation variants, Bingo Night, the hospital sick room. */
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
import { P } from "../palette.mjs";
import { casketSide } from "../parts.mjs";

const ink = (w = 1) => ({ stroke: P.ink, strokeWidth: w, strokeLinejoin: "round" });

/** A little Morty for the office corner: a skeleton on a stand. */
function mortyStand(_D, x, y, s) {
  const bone = "#e8e0c8";
  const st = { stroke: "#3a3020", strokeWidth: 0.8 / s };
  return g(
    [
      path("M0 0V-150", "none", { stroke: "#5a5a5a", strokeWidth: 3 / s }),
      ellipse(0, 0, 24, 5, "#3a3a3a"),
      circle(0, -170, 16, bone, st),
      circle(-6, -172, 4.5, "#1a1410"),
      circle(6, -172, 4.5, "#2a6ab0"),
      path("M-8 -158h16v6h-16z", "#f8f4e8", st),
      path("M-2 -152h4v58h-4z", bone, st),
      ...[0, 1, 2, 3].map((i) =>
        path(`M0 ${-142 + i * 9}q-20 -4 -22 8M0 ${-142 + i * 9}q20 -4 22 8`, "none", {
          stroke: bone,
          strokeWidth: 3.2 / s,
          strokeLinecap: "round",
        }),
      ),
      path("M-26 -146L-34 -100L-30 -66M26 -146L34 -100L40 -68", "none", {
        stroke: bone,
        strokeWidth: 3 / s,
        strokeLinecap: "round",
      }),
      path("M-14 -94q14 10 28 0l-2 10q-12 6 -24 0z", bone, st),
      path("M-8 -86L-12 -40L-10 4M8 -86L12 -40L14 4", "none", {
        stroke: bone,
        strokeWidth: 3.4 / s,
        strokeLinecap: "round",
      }),
    ],
    { transform: `translate(${n(x)} ${n(y)}) scale(${n(s)})` },
  );
}

function office() {
  const D = new Defs("of");
  const R = rng(30);
  const out = [];
  // wallpaper with a damask-ish dot, dado and wainscot
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.lg(0, 0, 550, 0, [
        [0, "#4a3a2a"],
        [0.5, "#6a5440"],
        [1, "#4a3828"],
      ]),
    ),
  );
  let dots = "";
  for (let y = 12; y < 210; y += 24)
    for (let x = ((y / 24) % 2) * 14; x < 550; x += 28) dots += `M${x} ${y}l3 4l-3 4l-3 -4z`;
  out.push(path(dots, "#7a6248", { opacity: 0.6 }));
  out.push(rect(0, 210, 550, 8, "#3a2414", ink(0.6)));
  out.push(rect(0, 218, 550, 182, "#3a2616"));
  // window to the street, with the fog outside
  out.push(
    rect(
      330,
      36,
      160,
      130,
      D.lg(0, 36, 0, 166, [
        [0, "#8a96a0"],
        [1, "#b8c0c4"],
      ]),
      ink(3),
    ),
  );
  out.push(path("M410 36V166M330 100H490", "none", { stroke: "#3a2414", strokeWidth: 3 }));
  out.push(
    path(
      "M332 166V128L350 112L368 128V166ZM372 166V118L394 98L416 118V166ZM420 166V134L436 120L452 134V166ZM456 166V122L472 108L488 122V166Z",
      "#6a747c",
      { opacity: 0.75 },
    ),
  );
  out.push(path("M356 140h6v8h-6zM390 126h6v8h-6zM468 132h6v8h-6z", "#d8c890", { opacity: 0.7 }));
  out.push(rect(322, 166, 176, 8, "#5a3a20", ink(0.6)));
  // the licence on the wall, framed
  out.push(
    rect(
      176,
      46,
      100,
      74,
      D.lg(176, 46, 276, 120, [
        [0, "#c8a040"],
        [1, "#6a4a10"],
      ]),
      ink(1),
    ),
  );
  out.push(rect(184, 54, 84, 58, "#f0e8d0"));
  out.push(
    lettering("LICENSED", 226, 60, 8, "#3a2a1a", { align: "middle", weight: 0.14, serif: true }),
  );
  out.push(lettering("UNDERTAKER", 226, 74, 7, "#3a2a1a", { align: "middle", weight: 0.14 }));
  out.push(circle(250, 98, 7, "#a02020", { opacity: 0.85 }));
  out.push(path("M196 98h36M196 104h30", "none", { stroke: "#8a8a9a", strokeWidth: 0.8 }));
  // a filing cabinet at left with a coffin catalogue on top
  out.push(
    rect(
      30,
      170,
      100,
      180,
      D.lg(30, 0, 130, 0, [
        [0, "#8a8a80"],
        [1, "#5a5a54"],
      ]),
      ink(1),
    ),
  );
  for (let i = 0; i < 4; i++) {
    out.push(rect(38, 180 + i * 42, 84, 34, "none", { stroke: "#3a3a36", strokeWidth: 1 }));
    out.push(rect(70, 192 + i * 42, 20, 5, "#c8c8bc", ink(0.5)));
  }
  out.push(path("M38 170l8 -14h70l4 14z", "#7a1a1a", ink(0.8)));
  out.push(lettering("CASKETS", 80, 160, 6, "#e8c060", { align: "middle", weight: 0.16 }));
  // Morty in the corner, on his stand
  out.push(mortyStand(D, 515, 356, 0.95));
  // the desk: top, front panel, and on it a ledger, a black telephone, a lamp, an urn
  out.push(
    path(
      "M100 300H470L500 330H70Z",
      D.lg(0, 300, 0, 330, [
        [0, "#8a5a2e"],
        [1, "#6a4020"],
      ]),
      ink(1),
    ),
  );
  out.push(
    path(
      "M70 330H500V400H70Z",
      D.lg(70, 0, 500, 0, [
        [0, "#5a3418"],
        [1, "#3a2010"],
      ]),
      ink(1),
    ),
  );
  out.push(rect(110, 344, 120, 46, "none", { stroke: "#2a160a", strokeWidth: 2 }));
  out.push(rect(340, 344, 120, 46, "none", { stroke: "#2a160a", strokeWidth: 2 }));
  // ledger open
  out.push(path("M190 318l60 -6l60 6l-4 10l-56 -4l-56 4z", "#f0e8d0", ink(0.8)));
  out.push(path("M250 312v12", "none", { stroke: "#8a7a5a", strokeWidth: 1 }));
  let ledgerLines = "";
  for (let i = 0; i < 3; i++) ledgerLines += `M200 ${318 + i * 3}l44 -3M256 ${315 + i * 3}l44 3`;
  out.push(path(ledgerLines, "none", { stroke: "#8a8a9a", strokeWidth: 0.6 }));
  // telephone
  out.push(path("M370 318q0 -12 24 -12q24 0 24 12z", "#141414", ink(0.6)));
  out.push(path("M366 306q28 -18 56 0l-4 6q-24 -12 -48 0z", "#1e1e1e", ink(0.6)));
  out.push(circle(394, 312, 5, "#e8e4d8"));
  // desk lamp, green glass shade, its light
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.rg(140, 280, 140, [
        [0, "#fff0b0", 0.3],
        [1, "#fff0b0", 0],
      ]),
    ),
  );
  out.push(path("M136 318h20l-2 -6h-16z", "#c8a040", ink(0.6)));
  out.push(path("M146 312v-32", "none", { stroke: "#c8a040", strokeWidth: 2 }));
  out.push(path("M118 284Q146 264 174 284Z", "#2a6a3a", ink(0.8)));
  // an urn
  out.push(
    path(
      "M454 318h18l-2 -6q8 -10 0 -22h-14q-8 12 0 22z",
      D.lg(450, 0, 476, 0, [
        [0, "#c8b080"],
        [1, "#6a5a30"],
      ]),
      ink(0.6),
    ),
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
  return doc({ title: "places/parlor-office (Remastered)", body: out.join(""), defs: D });
}

/** The cold back room: tiles, steel, a lamp; shared by the prep variants. */
function prepRoom(D, lamp = true) {
  const out = [];
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.lg(0, 0, 0, 400, [
        [0, "#203030"],
        [1, "#101818"],
      ]),
    ),
  );
  let tiles = "";
  for (let y = 0; y < 260; y += 22) tiles += `M0 ${y}H550`;
  for (let x = 0; x < 550; x += 22) tiles += `M${x} 0V260`;
  out.push(
    rect(
      0,
      0,
      550,
      260,
      D.lg(0, 0, 550, 0, [
        [0, "#486870"],
        [0.5, "#689098"],
        [1, "#405860"],
      ]),
    ),
  );
  out.push(path(tiles, "none", { stroke: "#2a4048", strokeWidth: 1 }));
  out.push(
    rect(
      0,
      260,
      550,
      140,
      D.lg(0, 260, 0, 400, [
        [0, "#3a4a4a"],
        [1, "#1a2424"],
      ]),
    ),
  );
  out.push(path("M0 260H550", "none", { stroke: "#1a2828", strokeWidth: 2 }));
  if (!lamp) return out.join("");
  // the operating lamp overhead, a cone of cold light
  out.push(path("M275 0V40", "none", { stroke: "#2a3434", strokeWidth: 3 }));
  out.push(
    path(
      "M225 62Q275 28 325 62Z",
      D.lg(225, 0, 325, 0, [
        [0, "#a8b0b8"],
        [1, "#5a6066"],
      ]),
      ink(1),
    ),
  );
  out.push(ellipse(275, 62, 50, 6, "#f4f8ff"));
  out.push(
    path(
      "M225 62L80 330H470L325 62Z",
      D.lg(0, 62, 0, 330, [
        [0, "#e8f4ff", 0.25],
        [1, "#e8f4ff", 0.05],
      ]),
    ),
  );
  return out.join("");
}

function prepTable() {
  const D = new Defs("pt");
  const out = [prepRoom(D)];
  // the steel table, a body under a sheet, a toe tag
  out.push(
    path(
      "M70 290L480 290L500 312L50 312Z",
      D.lg(0, 290, 0, 312, [
        [0, "#d8d8e0"],
        [1, "#9aa0a8"],
      ]),
      ink(1),
    ),
  );
  out.push(
    rect(
      250,
      312,
      50,
      60,
      D.lg(250, 0, 300, 0, [
        [0, "#c8ccd4"],
        [1, "#6a7078"],
      ]),
      ink(1),
    ),
  );
  out.push(path("M200 372H350L360 392H190Z", "#8a9098", ink(1)));
  out.push(
    path(
      "M90 292Q90 254 130 248Q160 230 196 246Q260 236 330 250Q400 246 440 262Q470 270 466 292Z",
      D.lg(0, 230, 0, 292, [
        [0, "#ffffff"],
        [1, "#c8d0d8"],
      ]),
      ink(1),
    ),
  );
  let folds = "";
  for (const x of [170, 240, 300, 360, 410]) folds += `M${x} ${250 + (x % 3) * 2}q6 20 -2 40`;
  out.push(path(folds, "none", { stroke: "#9aa4b0", strokeWidth: 1 }));
  out.push(
    path("M466 268q14 -6 18 4q-2 10 -14 10z", P.skinPaleHi, {
      stroke: P.skinPaleLine,
      strokeWidth: 0.8,
    }),
  );
  out.push(path("M480 276l14 18", "none", { stroke: "#5a5040", strokeWidth: 0.8 }));
  out.push(path("M490 292l16 -4l4 14l-16 4z", "#f0e8c8", ink(0.6)));
  out.push(circle(494, 294, 1.4, "#5a5040"));
  // a tray of instruments on a stand at the left
  out.push(rect(20, 218, 120, 8, "#c8ccd4", ink(0.8)));
  out.push(path("M80 226V300", "none", { stroke: "#6a7078", strokeWidth: 3 }));
  for (let i = 0; i < 5; i++)
    out.push(
      path(`M${32 + i * 20} 216l14 -4`, "none", {
        stroke: "#e8ecf0",
        strokeWidth: 2,
        strokeLinecap: "round",
      }),
    );
  // the pump on a shelf, its hose
  out.push(
    rect(
      430,
      150,
      70,
      60,
      D.lg(430, 0, 500, 0, [
        [0, "#a8b0b8"],
        [1, "#5a6066"],
      ]),
      ink(1),
    ),
  );
  out.push(rect(440, 120, 30, 30, "#b84a3a", { ...ink(0.8), opacity: 0.85 }));
  out.push(
    path("M440 200q-30 40 -10 70q20 30 -20 20", "none", { stroke: "#2a2a2a", strokeWidth: 3 }),
  );
  return doc({ title: "places/prep-table (Remastered)", body: out.join(""), defs: D });
}

function prepCosmetics() {
  const D = new Defs("pc");
  const out = [prepRoom(D, false)];
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.rg(275, 110, 260, [
        [0, "#fff4d8", 0.3],
        [1, "#fff4d8", 0],
      ]),
    ),
  );
  // a make-up mirror ringed with bulbs on the wall
  out.push(rect(170, 40, 210, 150, "#2a2a2a", ink(1)));
  out.push(
    rect(
      184,
      54,
      182,
      122,
      D.lg(184, 54, 366, 176, [
        [0, "#c8d8e0"],
        [1, "#6a7a84"],
      ]),
    ),
  );
  out.push(
    path("M200 160L260 64M240 170L300 70", "none", {
      stroke: "#ffffff",
      strokeWidth: 6,
      opacity: 0.2,
    }),
  );
  for (let i = 0; i < 8; i++) {
    for (const [x, y] of [
      [178 + i * 28, 46],
      [178 + i * 28, 184],
    ]) {
      out.push(
        circle(
          x,
          y,
          9,
          D.rg(x, y, 9, [
            [0, "#ffffff"],
            [1, "#ffe8a0"],
          ]),
          ink(0.5),
        ),
      );
    }
  }
  // the counter with the kit: powder, rouge, lipstick, brushes, a comb, a wig on a stand
  out.push(
    path(
      "M60 260H490L510 286H40Z",
      D.lg(0, 260, 0, 286, [
        [0, "#e0d8cc"],
        [1, "#b8b0a4"],
      ]),
      ink(1),
    ),
  );
  out.push(path("M40 286H510V300H40Z", "#8a8278", ink(0.8)));
  out.push(ellipse(130, 264, 22, 6, "#f0d8d0", ink(0.6)));
  out.push(ellipse(130, 262, 16, 4, "#f8f0e8"));
  out.push(ellipse(176, 266, 14, 5, "#c04a5a", ink(0.6)));
  out.push(rect(206, 248, 8, 18, "#2a2a2a", ink(0.5)));
  out.push(path("M207 248q3 -8 6 0z", "#c02030"));
  out.push(
    path("M232 268l40 -26M244 270l36 -22", "none", {
      stroke: "#6a4a2a",
      strokeWidth: 2.4,
      strokeLinecap: "round",
    }),
  );
  out.push(path("M270 240q6 -6 10 2M278 246q6 -6 10 2", "#3a2a1a"));
  out.push(path("M300 270h50v-6h-50z", "#2a2a2a", ink(0.4)));
  let teeth = "";
  for (let x = 302; x < 350; x += 3) teeth += `M${x} 270v4`;
  out.push(path(teeth, "none", { stroke: "#2a2a2a", strokeWidth: 1 }));
  // wig on a stand: a featureless head with a grey perm
  out.push(path("M420 266h28l-4 -30h-20z", "#c8c0b4", ink(0.6)));
  out.push(ellipse(434, 214, 22, 26, "#e8e0d4", ink(0.6)));
  out.push(
    path(
      scallop(
        [
          [408, 220],
          [410, 192],
          [434, 180],
          [458, 192],
          [460, 220],
          [446, 206],
          [434, 202],
          [422, 206],
        ],
        0.5,
      ),
      "#b8b4b0",
      ink(0.6),
    ),
  );
  // a framed photograph of the deceased, for reference
  out.push(rect(70, 210, 44, 52, "#6a4a20", ink(0.6)));
  out.push(rect(76, 216, 32, 40, "#d8c8a8"));
  out.push(ellipse(92, 232, 8, 10, "#a87a5a"));
  out.push(path("M80 256q12 -16 24 0z", "#3a3a4a"));
  return doc({ title: "places/prep-cosmetics (Remastered)", body: out.join(""), defs: D });
}

function prepViewing() {
  const D = new Defs("pv");
  const R = rng(33);
  const out = [];
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.lg(0, 0, 0, 400, [
        [0, "#3a2028"],
        [1, "#1a0e12"],
      ]),
    ),
  );
  // drapes behind, deep red, folded
  for (let x = 0; x < 550; x += 46)
    out.push(
      path(
        `M${x} 0Q${x + 23} 140 ${x + 4} 300H${x + 46}Q${x + 30} 140 ${x + 46} 0Z`,
        D.lg(x, 0, x + 46, 0, [
          [0, "#3a0a14"],
          [0.5, "#7a1a28"],
          [1, "#3a0a14"],
        ]),
      ),
    );
  // candelabra glow either side
  for (const x of [70, 480]) {
    out.push(
      rect(
        0,
        0,
        550,
        400,
        D.rg(x, 150, 120, [
          [0, "#ffd890", 0.3],
          [1, "#ffd890", 0],
        ]),
      ),
    );
    out.push(
      path(
        `M${x} 300V170M${x - 24} 190V170M${x + 24} 190V170M${x - 24} 190Q${x} 210 ${x + 24} 190`,
        "none",
        { stroke: "#c8a040", strokeWidth: 3 },
      ),
    );
    for (const dx of [-24, 0, 24]) {
      out.push(rect(x + dx - 3, 150, 6, 20, "#f4f0e0", ink(0.4)));
      out.push(ellipse(x + dx, 145, 2.4, 5, "#ffcc33"));
    }
    out.push(ellipse(x, 302, 20, 5, "#8a6010"));
  }
  // the bier and the open casket, side on, satin lining, folded hands holding a rose
  out.push(rect(110, 300, 330, 20, "#2a1a10", ink(1)));
  out.push(path("M130 320L140 400M420 320L410 400", "none", { stroke: "#2a1a10", strokeWidth: 8 }));
  out.push(casketSide(D, 100, 300, 350, 70, "#6a3a1e", { handle: "#e8c060", lw: 1 }));
  // raised half lid behind, lined in white satin
  out.push(
    path(
      "M300 230L446 230L452 246L294 246Z",
      D.lg(0, 230, 0, 246, [
        [0, "#f8f4ec"],
        [1, "#d8d0c4"],
      ]),
      ink(1),
    ),
  );
  out.push(path("M294 246L452 246L450 252L296 252Z", "#6a3a1e", ink(0.8)));
  // satin billow above the rim, the profile of a nose and the hands
  out.push(
    path(
      scallop(
        [
          [110, 236],
          [180, 226],
          [260, 230],
          [300, 232],
          [300, 238],
          [110, 240],
        ],
        0.3,
        R,
      ),
      "#f4f0e8",
      ink(0.6),
    ),
  );
  out.push(
    path("M150 234q8 -14 20 -12q4 -6 8 0q6 2 4 8", P.skinPaleHi, {
      stroke: P.skinPaleLine,
      strokeWidth: 0.8,
    }),
  );
  out.push(
    path("M220 236q10 -12 24 -6q8 4 6 8", P.skinPaleHi, {
      stroke: P.skinPaleLine,
      strokeWidth: 0.8,
    }),
  );
  out.push(path("M232 228l2 -18", "none", { stroke: "#2a5a2a", strokeWidth: 1.4 }));
  out.push(
    path(
      scallop(
        [
          [226, 210],
          [234, 202],
          [242, 210],
          [234, 216],
        ],
        0.6,
      ),
      "#b01020",
      ink(0.5),
    ),
  );
  // sprays of white lilies at each end
  for (const [x, y] of [
    [100, 270],
    [460, 270],
  ]) {
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.4;
      const ex = x + Math.cos(a) * 46;
      const ey = y + Math.sin(a) * 46;
      out.push(
        path(`M${x} ${y}Q${(x + ex) / 2} ${(y + ey) / 2 - 6} ${n(ex)} ${n(ey)}`, "none", {
          stroke: "#3a6a2a",
          strokeWidth: 2,
        }),
      );
      out.push(path(`M${n(ex)} ${n(ey)}l-8 -6l8 -10l8 10z`, "#ffffff", ink(0.5)));
    }
  }
  return doc({ title: "places/prep-viewing (Remastered)", body: out.join(""), defs: D });
}

function bingo() {
  const D = new Defs("bi");
  const R = rng(34);
  const out = [];
  // the church hall: pale green walls, a wooden floor, a stage with the board
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.lg(0, 0, 0, 270, [
        [0, "#8a9a7a"],
        [1, "#b8c4a4"],
      ]),
    ),
  );
  out.push(
    rect(
      0,
      270,
      550,
      130,
      D.lg(0, 270, 0, 400, [
        [0, "#9a6a3a"],
        [1, "#5a3a1a"],
      ]),
    ),
  );
  let boards = "";
  for (let x = -400; x < 950; x += 40) boards += `M275 270L${x} 400`;
  out.push(path(boards, "none", { stroke: "#4a2a10", strokeWidth: 0.8, opacity: 0.5 }));
  // banner
  out.push(path("M110 22H440L430 42L440 62H110L120 42Z", "#c02020", ink(1)));
  out.push(lettering("BINGO TONIGHT", 275, 34, 16, "#ffe080", { align: "middle", weight: 0.16 }));
  // the number board: 75 lamps in rows B I N G O, some lit
  out.push(rect(110, 78, 330, 120, "#1a2a1a", ink(1.4)));
  "BINGO".split("").forEach((ch, row) => {
    out.push(lettering(ch, 124, 86 + row * 22, 13, "#ffe080", { align: "middle", weight: 0.2 }));
    for (let col = 0; col < 15; col++) {
      const x = 146 + col * 19;
      const y = 92 + row * 22;
      const lit = R.next() < 0.3;
      out.push(
        circle(x, y, 7, lit ? "#ffe080" : "#2a3a2a", { stroke: "#0a140a", strokeWidth: 0.6 }),
      );
      if (lit)
        out.push(
          circle(
            x,
            y,
            11,
            D.rg(x, y, 11, [
              [0, "#ffe080", 0.5],
              [1, "#ffe080", 0],
            ]),
          ),
        );
    }
  });
  // the wire tumbler of balls on a table, right
  out.push(rect(400, 230, 110, 10, "#6a4020", ink(0.8)));
  out.push(path("M410 240V300M500 240V300", "none", { stroke: "#4a2a10", strokeWidth: 4 }));
  out.push(circle(455, 196, 32, "none", { stroke: "#c8a040", strokeWidth: 2 }));
  out.push(ellipse(455, 196, 12, 32, "none", { stroke: "#c8a040", strokeWidth: 1.4 }));
  out.push(ellipse(455, 196, 32, 10, "none", { stroke: "#c8a040", strokeWidth: 1.4 }));
  for (let i = 0; i < 10; i++)
    out.push(
      circle(
        440 + R.range(0, 30),
        200 + R.range(0, 18),
        5,
        R.pick(["#f4f0e0", "#e8c0c0", "#c0d8e8"]),
        ink(0.4),
      ),
    );
  out.push(path("M455 228v6M436 230l38 0", "none", { stroke: "#8a6010", strokeWidth: 2 }));
  out.push(path("M487 196h14v16", "none", { stroke: "#8a6010", strokeWidth: 2.4 }));
  // folding tables in rows with cards, daubers and a coffee cup or two
  for (const [y, s] of [
    [300, 0.8],
    [350, 1],
  ]) {
    for (const x0 of [30, 300]) {
      const w = 220 * s;
      const x = x0 + (1 - s) * 60;
      out.push(path(`M${x} ${y}h${w}l10 14h${-w - 20}z`, "#d8d0c0", ink(0.8)));
      out.push(
        path(`M${x + 10} ${y + 14}v${30 * s}M${x + w - 10} ${y + 14}v${30 * s}`, "none", {
          stroke: "#5a5a5a",
          strokeWidth: 2,
        }),
      );
      for (let k = 0; k < 4; k++) {
        const cx = x + 20 + k * (w / 4.4);
        out.push(path(`M${cx} ${y + 2}h${28 * s}l3 ${10 * s}h${-28 * s}z`, "#f8f4e8", ink(0.5)));
        for (let d = 0; d < 3; d++)
          out.push(
            circle(
              cx + 6 * s + d * 8 * s,
              y + 6 * s,
              2.4 * s,
              R.pick(["#e02060", "#2060e0", "#20a040"]),
              { opacity: 0.8 },
            ),
          );
      }
      out.push(rect(x + w * 0.7, y - 10 * s, 6 * s, 10 * s, "#e02060", ink(0.4)));
      out.push(
        path(`M${x + w * 0.4} ${y + 1}h${10 * s}v${-10 * s}h${-10 * s}z`, "#f4f0e8", ink(0.4)),
      );
    }
  }
  // the jackpot jar of wooden tags on the stage edge
  out.push(
    path("M60 240h40v-34q0 -8 -6 -10h-28q-6 2 -6 10z", "#c8e0e8", { ...ink(0.8), opacity: 0.85 }),
  );
  for (let i = 0; i < 6; i++)
    out.push(
      path(
        `M${66 + (i % 3) * 10} ${236 - Math.floor(i / 3) * 10}l8 -2l2 6l-8 2z`,
        "#a07040",
        ink(0.4),
      ),
    );
  out.push(lettering("POT", 80, 248, 7, "#2a2a2a", { align: "middle", weight: 0.16 }));
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.rg(275, 200, 380, [
        [0.55, "#000", 0],
        [1, "#000", 0.4],
      ]),
    ),
  );
  return doc({ title: "places/bingo-night (Remastered)", body: out.join(""), defs: D });
}

function sickRoom() {
  const D = new Defs("sr");
  const out = [];
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.lg(0, 0, 550, 0, [
        [0, "#c8d4c8"],
        [1, "#a8b4a8"],
      ]),
    ),
  );
  out.push(
    rect(
      0,
      290,
      550,
      110,
      D.lg(0, 290, 0, 400, [
        [0, "#b8b8a8"],
        [1, "#8a8a7a"],
      ]),
    ),
  );
  out.push(path("M0 290H550", "none", { stroke: "#7a8a7a", strokeWidth: 2 }));
  // X-ray light box with a cracked skull and a busted knee
  out.push(rect(40, 50, 170, 110, "#e8f0f4", ink(1.4)));
  out.push(rect(48, 58, 74, 94, "#1a2028"));
  out.push(rect(130, 58, 72, 94, "#1a2028"));
  out.push(ellipse(85, 98, 26, 30, "none", { stroke: "#d8e8f0", strokeWidth: 3 }));
  out.push(circle(76, 98, 6, "#d8e8f0", { opacity: 0.6 }));
  out.push(circle(94, 98, 6, "#d8e8f0", { opacity: 0.6 }));
  out.push(path("M92 70l-6 12l8 6l-6 12", "none", { stroke: "#ff6060", strokeWidth: 1.4 }));
  out.push(
    path("M160 64v34M172 64v34M160 108v40M172 108v40", "none", {
      stroke: "#d8e8f0",
      strokeWidth: 7,
      strokeLinecap: "round",
    }),
  );
  out.push(ellipse(166, 103, 12, 7, "#d8e8f0", { opacity: 0.7 }));
  out.push(path("M150 100l10 4l-4 4l14 2", "none", { stroke: "#ff6060", strokeWidth: 1.4 }));
  // the bed with a leg in traction: sling, pulley, weight
  out.push(path("M150 290V240H520V290", "none", { stroke: "#8a9098", strokeWidth: 5 }));
  out.push(
    rect(
      150,
      236,
      370,
      30,
      D.lg(0, 236, 0, 266, [
        [0, "#ffffff"],
        [1, "#c8d0d8"],
      ]),
      ink(1),
    ),
  );
  out.push(path("M150 240Q156 200 200 204Q236 210 238 236Z", "#f4f4f4", ink(0.8)));
  out.push(path("M150 290V200M520 290V220", "none", { stroke: "#6a7078", strokeWidth: 6 }));
  // the patient: a blanket over the body, a head bandaged like a parcel, an arm in a sling
  out.push(
    path(
      "M226 238Q240 214 300 216Q380 212 430 222Q470 226 500 238Z",
      D.lg(0, 212, 0, 238, [
        [0, "#9ab0c8"],
        [1, "#6a84a0"],
      ]),
      ink(1),
    ),
  );
  out.push(
    path("M260 222q40 -6 80 0M360 220q30 -4 60 2", "none", { stroke: "#5a7088", strokeWidth: 1 }),
  );
  out.push(ellipse(204, 210, 30, 26, "#f4f0e8", ink(1)));
  let wraps = "";
  for (let k = 0; k < 5; k++) wraps += `M${176 + k * 3} ${196 + k * 8}q28 -8 56 0`;
  out.push(path(wraps, "none", { stroke: "#c8c4bc", strokeWidth: 1.2 }));
  out.push(
    path("M196 208h8M214 208h8", "none", {
      stroke: "#2a1a10",
      strokeWidth: 2.4,
      strokeLinecap: "round",
    }),
  );
  out.push(path("M204 222q6 -3 10 0", "none", { stroke: "#8a4a3a", strokeWidth: 1.4 }));
  // the cast leg coming out from under the blanket, raised to the sling
  out.push(path("M420 226L466 178L486 194L444 238Z", "#f8f8f4", ink(1)));
  out.push(path("M466 178Q470 160 484 162Q500 166 494 180L486 194Z", "#f8f8f4", ink(1)));
  for (const t of [0.3, 0.6])
    out.push(
      path(`M${n(420 + 46 * t)} ${n(226 - 48 * t)}l20 14`, "none", {
        stroke: "#c8c8c0",
        strokeWidth: 1,
      }),
    );
  out.push(
    path("M476 170q8 -4 14 2", "none", {
      stroke: "#c8a090",
      strokeWidth: 3,
      strokeLinecap: "round",
    }),
  );
  out.push(path("M470 30V170M300 30H520", "none", { stroke: "#8a9098", strokeWidth: 4 }));
  out.push(circle(470, 40, 8, "#c8ccd0", ink(0.8)));
  out.push(path("M470 48V170M478 40L520 40V120", "none", { stroke: "#5a5a5a", strokeWidth: 1.2 }));
  out.push(rect(508, 120, 24, 30, "#4a4a4a", ink(0.8)));
  out.push(lettering("10", 520, 128, 8, "#e8e8e8", { align: "middle", weight: 0.16 }));
  // crutches leaning on the wall, a drip stand, and a sad balloon
  out.push(
    path("M70 290L104 180M84 290L112 182M98 224h12", "none", { stroke: "#a8a8a0", strokeWidth: 3 }),
  );
  out.push(
    path("M94 180q10 -6 22 4", "none", {
      stroke: "#5a5a5a",
      strokeWidth: 5,
      strokeLinecap: "round",
    }),
  );
  out.push(path("M250 290V70M236 290h28", "none", { stroke: "#8a9098", strokeWidth: 3 }));
  out.push(path("M240 72h20v34q-10 8 -20 0z", "#f0e8c0", { ...ink(0.6), opacity: 0.9 }));
  out.push(path("M250 110q-4 60 -30 116", "none", { stroke: "#c8d8e0", strokeWidth: 1.2 }));
  out.push(
    path(
      "M300 140Q300 104 328 104Q356 104 356 140Q356 170 328 178Q300 170 300 140Z",
      D.lg(300, 0, 356, 0, [
        [0, "#e86080"],
        [1, "#a02040"],
      ]),
      ink(0.8),
    ),
  );
  out.push(path("M328 178q-6 30 4 60q4 14 -2 30", "none", { stroke: "#5a5a5a", strokeWidth: 0.8 }));
  out.push(lettering("GET", 328, 128, 8, "#ffffff", { align: "middle", weight: 0.16 }));
  out.push(lettering("WELL", 328, 140, 8, "#ffffff", { align: "middle", weight: 0.16 }));
  out.push(
    path("M314 126l6 -10", "none", {
      stroke: "#ffffff",
      strokeWidth: 3,
      opacity: 0.4,
      strokeLinecap: "round",
    }),
  );
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.rg(300, 200, 380, [
        [0.55, "#000", 0],
        [1, "#000", 0.35],
      ]),
    ),
  );
  void poly;
  void shade;
  void smooth;
  void tint;
  return doc({ title: "places/sick-room (Remastered)", body: out.join(""), defs: D });
}

export const pieces = [
  {
    id: "places/parlor-office",
    kind: "place",
    usedBy: "the parlor office (proposed bg in place of places/palors for the office screens)",
    grade: "B",
    notes:
      "The undertaker's own office: licence on the wall, the fog through the window, a filing cabinet with a casket catalogue, the desk with ledger, telephone, lamp and urn, and Morty on his stand in the corner.",
    render: office,
  },
  {
    id: "places/prep-table",
    kind: "place",
    usedBy:
      "body preparation (proposed variant for scenes with no picture: wallet, love-letter, wrong-body, spare-parts, tape, fingerprints...)",
    grade: "B",
    notes:
      "A body under a sheet on the steel table, a toe tag, instruments, the pump; cold tiles under the operating lamp.",
    render: prepTable,
  },
  {
    id: "places/prep-cosmetics",
    kind: "place",
    usedBy:
      "body preparation (proposed for grin, glasses, toupee, tattoo, dentures, bingo-suit...)",
    grade: "B",
    notes:
      "The make-up station: a bulb-ringed mirror, powder, rouge, lipstick, brushes, a comb, a wig on a stand and a photo of the deceased for reference.",
    render: prepCosmetics,
  },
  {
    id: "places/prep-viewing",
    kind: "place",
    usedBy:
      "body preparation (proposed for borrowed-flowers, flag, fishing-pose, eulogy, final-breath...)",
    grade: "B",
    notes:
      "The open casket on its bier between candelabra, lined in satin, a nose and folded hands holding a rose, white lilies, red drapes.",
    render: prepViewing,
  },
  {
    id: "places/bingo-night",
    kind: "place",
    usedBy: "Bingo Night at the church (proposed bg for pictures.bingo)",
    grade: "B",
    notes:
      "The church hall: BINGO TONIGHT banner, the B-I-N-G-O lamp board, the ball tumbler, folding tables with cards and daubers, the jar of wooden tags for the pot.",
    render: bingo,
  },
  {
    id: "places/sick-room",
    kind: "place",
    usedBy: "the hospital in Expanded towns, injuries (proposed bg for pictures.hospital)",
    grade: "B",
    notes:
      "A patient bandaged like a parcel, one cast leg in traction (pulley and a 10 lb weight), X-rays of a cracked skull and a busted knee, crutches, a drip and a GET WELL balloon.",
    render: sickRoom,
  },
];
