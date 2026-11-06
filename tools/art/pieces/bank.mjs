/** places/bank (the teller behind bars, redraw) and places/bank-vault (savings and loans). */
import { bun, bust, garment, pts, SKINS } from "../face.mjs";
import { lettering } from "../font.mjs";
import { circle, Defs, doc, ellipse, g, n, path, rect, rng, smooth } from "../lib.mjs";
import { P } from "../palette.mjs";

/** A hand seen from above, flat on a surface, fingers toward +y rotated by `rot`. */
export function handFlat(x, y, s, rot, sk, o = {}) {
  const { flip = false } = o;
  const k = flip ? -1 : 1;
  const st = { stroke: sk.line, strokeWidth: 0.7 * Math.max(0.6, s), strokeLinejoin: "round" };
  const palm = `M${-14 * k} -18Q${-16 * k} 2 ${-12 * k} 10L${12 * k} 10Q${16 * k} 0 ${14 * k} -18Z`;
  const fingers = [-9, -3, 3, 9].map((fx, i) => {
    const len = [16, 20, 19, 14][i];
    return `M${(fx - 3) * k} 8Q${(fx - 3.4) * k} ${8 + len} ${fx * k} ${10 + len}Q${(fx + 3.4) * k} ${8 + len} ${(fx + 3) * k} 8Z`;
  });
  const thumb = `M${-13 * k} -4Q${-26 * k} 2 ${-24 * k} 12Q${-20 * k} 16 ${-14 * k} 6Z`;
  return g(
    [
      path(palm, sk.mid, st),
      ...fingers.map((d, i) => path(d, i === 3 ? sk.lo : sk.mid, st)),
      path(thumb, sk.mid, st),
      path(`M${-10 * k} -6Q0 -2 ${10 * k} -8`, "none", {
        stroke: sk.lo,
        strokeWidth: 1,
        opacity: 0.6,
      }),
      path(`M${6 * k} -14Q${12 * k} -4 ${8 * k} 6`, sk.lo, { opacity: 0.35 }),
    ],
    { transform: `translate(${n(x)} ${n(y)}) rotate(${n(rot)}) scale(${n(s)})` },
  );
}

/** A stack of banknotes, greenish, seen from above. */
function bills(x, y, w, h, rot) {
  const out = [];
  for (let i = 0; i < 4; i++) {
    out.push(
      rect(x - w / 2 + i * 1.2, y - h / 2 - i * 1.4, w, h, i === 3 ? "#b8c8a0" : "#98a880", {
        stroke: "#4a5a3a",
        strokeWidth: 0.6,
        transform: `rotate(${n(rot + i * 2)} ${n(x)} ${n(y)})`,
      }),
    );
  }
  out.push(
    ellipse(x + 4.6, y - 5, w * 0.16, h * 0.28, "none", {
      stroke: "#4a5a3a",
      strokeWidth: 0.6,
      transform: `rotate(${n(rot + 6)} ${n(x)} ${n(y)})`,
    }),
  );
  return g(out);
}

function bank() {
  const D = new Defs("bk");
  const out = [];
  // Back wall: warm panelled, a big clock, ledger shelves and a window with daylight.
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.lg(0, 0, 0, 260, [
        [0, "#b8a888"],
        [1, "#d8ccae"],
      ]),
    ),
  );
  out.push(rect(0, 150, 550, 110, "#8a6a40"));
  for (let x = 10; x < 550; x += 70)
    out.push(rect(x, 162, 58, 86, "none", { stroke: "#6a4a28", strokeWidth: 1.4 }));
  out.push(rect(0, 146, 550, 6, "#6a4a28"));
  // window, left
  out.push(
    rect(
      60,
      26,
      110,
      100,
      D.lg(0, 26, 0, 126, [
        [0, "#e8f4f8"],
        [1, "#a8c8d8"],
      ]),
      { stroke: "#5a4028", strokeWidth: 3 },
    ),
  );
  out.push(path("M115 26V126M60 76H170", "none", { stroke: "#5a4028", strokeWidth: 2.4 }));
  out.push(path("M70 120L100 34", "none", { stroke: "#ffffff", strokeWidth: 6, opacity: 0.35 }));
  // clock, right
  out.push(circle(480, 64, 30, "#f4f0e4", { stroke: "#3a2a18", strokeWidth: 4 }));
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    out.push(
      path(
        `M${n(480 + Math.cos(a) * 24)} ${n(64 + Math.sin(a) * 24)}L${n(480 + Math.cos(a) * 27)} ${n(64 + Math.sin(a) * 27)}`,
        "none",
        { stroke: "#2a2a2a", strokeWidth: 1.4 },
      ),
    );
  }
  out.push(
    path("M480 64V44M480 64L494 70", "none", {
      stroke: "#1a1a1a",
      strokeWidth: 2.2,
      strokeLinecap: "round",
    }),
  );
  // ledgers on a shelf behind the teller
  out.push(rect(220, 112, 120, 6, "#5a3a1c", { stroke: P.ink, strokeWidth: 0.6 }));
  const spines = ["#6a1a1a", "#2a3a5a", "#3a4a2a", "#6a1a1a", "#5a4a2a", "#2a3a5a", "#6a1a1a"];
  spines.forEach((c, i) => {
    out.push(
      rect(224 + i * 16, 74 + (i % 3) * 2, 14, 38 - (i % 3) * 2, c, {
        stroke: P.ink,
        strokeWidth: 0.6,
      }),
    );
  });
  // Prudence, behind the counter.
  const sk = SKINS.pale;
  const hair = bun(D, "#6a5040", "#a08a78");
  out.push(
    bust(D, {
      cx: 382,
      cy: 112,
      u: 36,
      skin: sk,
      jaw: 0.82,
      cheek: 0.92,
      chin: 1.04,
      age: 0.5,
      eye: "#4a6a5a",
      eyeOpen: 0.9,
      lid: 0.45,
      droop: 0.06,
      look: -0.6,
      brow: "#5a4030",
      browLift: -0.6,
      browKnit: 0.4,
      browThick: 0.7,
      nose: 1.0,
      mouth: 0.72,
      smile: -0.4,
      lipFull: 0.6,
      lipColour: "#a85a5a",
      lipColourLo: "#7a3a3a",
      clothes: garment(D, { kind: "blouse", c: "#5a6a8a", c2: "#f4f0e8", wide: 1.0 }),
      hairBack: hair.back,
      hairFront: hair.front,
      glasses: { kind: "half", y: 0.3, colour: "#6a4a2a" },
      extra: (f, u) => {
        const [bx, by] = f(0, 2.0);
        return g([
          path(
            smooth(
              pts(f, [
                [-0.6, 1.45],
                [-0.62, 1.86],
                [0, 1.96],
                [0.62, 1.86],
                [0.6, 1.45],
                [0, 1.58],
              ]),
              true,
              0.4,
            ),
            "#f4f0e8",
            { stroke: "#c8c0b0", strokeWidth: 0.6 },
          ),
          ellipse(bx, by, u * 0.14, u * 0.18, "#c8a040", { stroke: "#6a5010", strokeWidth: 0.6 }),
          ellipse(bx, by, u * 0.1, u * 0.13, "#e8dcd0"),
        ]);
      },
    }),
  );
  // forearms reaching to the counter
  out.push(
    path(
      "M314 196Q300 250 306 300L458 300Q464 250 450 196Z",
      D.lg(300, 0, 464, 0, [
        [0, "#6a7a9a"],
        [0.5, "#5a6a8a"],
        [1, "#3a4a6a"],
      ]),
    ),
  );
  out.push(
    path(
      "M300 190Q284 236 290 270Q300 290 326 300L338 286Q314 274 314 252Q318 226 322 200Z",
      "#5a6a8a",
      { stroke: "#2a3448", strokeWidth: 0.8 },
    ),
  );
  out.push(
    path(
      "M464 190Q480 236 474 270Q464 290 438 300L426 286Q450 274 450 252Q446 226 442 200Z",
      "#44547a",
      { stroke: "#2a3448", strokeWidth: 0.8 },
    ),
  );
  out.push(
    path("M318 232Q330 250 352 262", "none", { stroke: "#2a3448", strokeWidth: 0.8, opacity: 0.6 }),
  );
  // the counter: marble top, dark wood front
  out.push(
    path(
      "M0 290L550 280L550 320L0 336Z",
      D.lg(0, 280, 0, 336, [
        [0, "#f0ece4"],
        [1, "#c8c0b4"],
      ]),
      { stroke: P.ink, strokeWidth: 0.8 },
    ),
  );
  out.push(
    path(
      "M0 336L550 320V400H0Z",
      D.lg(0, 0, 550, 0, [
        [0, "#4a2e18"],
        [1, "#2a1a0c"],
      ]),
    ),
  );
  out.push(path("M0 336L550 320", "none", { stroke: "#8a6a40", strokeWidth: 2 }));
  for (let x = 30; x < 550; x += 120)
    out.push(
      path(`M${x} ${334 - x * 0.03}l0 66`, "none", {
        stroke: "#1a0e06",
        strokeWidth: 1.2,
        opacity: 0.6,
      }),
    );
  // her hands counting a stack of bills, and the brass bell
  out.push(bills(380, 302, 44, 20, -4));
  out.push(handFlat(330, 296, 0.95, -70, sk));
  out.push(handFlat(432, 300, 0.95, 60, sk, { flip: true }));
  out.push(ellipse(130, 300, 18, 6, "#5a4010"));
  out.push(
    path(
      "M114 300Q114 282 130 280Q146 282 146 300Z",
      D.lg(114, 0, 146, 0, [
        [0, "#ffe080"],
        [1, "#a07818"],
      ]),
      { stroke: "#5a4010", strokeWidth: 0.8 },
    ),
  );
  out.push(circle(130, 278, 3, "#a07818"));
  // The cage: brass bars and rails in front of everything, with soft shadows.
  const brass = D.lg(0, 0, 10, 0, [
    [0, "#6a4a18"],
    [0.4, "#e8c868"],
    [1, "#8a6420"],
  ]);
  const rail = D.lg(0, 0, 0, 8, [
    [0, "#f0d888"],
    [0.5, "#c8a040"],
    [1, "#6a4a18"],
  ]);
  for (const y of [52, 196, 252]) {
    out.push(rect(0, y + 4, 550, 7, "#000", { opacity: 0.18 }));
    out.push(rect(0, y, 550, 7, rail, { stroke: "#4a3008", strokeWidth: 0.6 }));
  }
  for (const x of [36, 104, 172, 240, 296, 352, 420, 488]) {
    const w = [36, 172, 420].includes(x) ? 14 : 8;
    out.push(rect(x + 5, 0, w, 300, "#000", { opacity: 0.15 }));
    out.push(
      rect(
        x,
        0,
        w,
        300 + (x > 300 ? -4 : 0),
        D.lg(x, 0, x + w, 0, [
          [0, "#6a4a18"],
          [0.4, "#e8c868"],
          [1, "#8a6420"],
        ]),
        { stroke: "#4a3008", strokeWidth: 0.6 },
      ),
    );
    if (w > 10)
      out.push(
        path(`M${x - 4} ${296 + (x > 300 ? -4 : 0)}h${w + 8}l-3 -10h${-(w + 2)}z`, "#a07828", {
          stroke: "#4a3008",
          strokeWidth: 0.6,
        }),
      );
  }
  void brass;
  // The EXCHANGE plate, mounted on the bars at the top left.
  out.push(rect(46, 20, 190, 34, "#000", { opacity: 0.25, transform: "translate(3 3)" }));
  out.push(rect(46, 20, 190, 34, "#141414", { stroke: "#c8a040", strokeWidth: 2 }));
  out.push(
    lettering("EXCHANGE", 141, 29, 16, "#f4f0e4", { align: "middle", weight: 0.13, serif: true }),
  );
  // A teller's window opening in the bars, under the plate.
  out.push(path("M240 214H352V138", "none", { stroke: "#4a3008", strokeWidth: 0.8, opacity: 0.4 }));
  return doc({ title: "places/bank (Remastered)", body: out.join(""), defs: D });
}

function vault() {
  const D = new Defs("va");
  const R = rng(4);
  const out = [];
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.lg(0, 0, 0, 400, [
        [0, "#3a3a36"],
        [1, "#22221e"],
      ]),
    ),
  );
  // riveted steel wall plates
  for (let y = 0; y < 330; y += 82) {
    for (let x = (y / 82) % 2 ? -50 : 0; x < 550; x += 110) {
      out.push(
        rect(
          x + 2,
          y + 2,
          106,
          78,
          D.lg(x, y, x + 106, y + 78, [
            [0, "#5a5a54"],
            [1, "#3a3a36"],
          ]),
          { stroke: "#1a1a18", strokeWidth: 1 },
        ),
      );
      for (const [rx, ry] of [
        [8, 8],
        [98, 8],
        [8, 72],
        [98, 72],
      ])
        out.push(circle(x + rx, y + ry, 2.2, "#7a7a72", { stroke: "#1a1a18", strokeWidth: 0.5 }));
    }
  }
  // the round vault door, swung open to the right, seen edge-on in perspective
  out.push(circle(250, 186, 150, "#141412"));
  out.push(
    circle(250, 186, 150, "none", {
      stroke: D.lg(100, 0, 400, 0, [
        [0, "#8a8a80"],
        [1, "#4a4a44"],
      ]),
      strokeWidth: 16,
    }),
  );
  // the interior: shelves of safe deposit boxes, gold bars, money sacks
  const clipIn = D.clip(circle(250, 186, 140, "#000"));
  const inside = [];
  inside.push(
    rect(
      100,
      40,
      300,
      300,
      D.lg(0, 40, 0, 340, [
        [0, "#4a4434"],
        [1, "#2a2418"],
      ]),
    ),
  );
  inside.push(
    rect(
      0,
      0,
      550,
      400,
      D.rg(250, 120, 160, [
        [0, "#ffe8a0", 0.35],
        [1, "#ffe8a0", 0],
      ]),
    ),
  );
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 7; col++) {
      const x = 130 + col * 36;
      const y = 60 + row * 34;
      inside.push(
        rect(
          x,
          y,
          32,
          30,
          D.lg(x, 0, x + 32, 0, [
            [0, "#b89850"],
            [1, "#7a6020"],
          ]),
          { stroke: "#3a2a08", strokeWidth: 0.8 },
        ),
      );
      inside.push(rect(x + 12, y + 18, 8, 4, "#3a2a08"));
      inside.push(circle(x + 6, y + 6, 1.4, "#3a2a08"));
    }
  }
  // gold bars stacked on the floor
  for (let i = 0; i < 6; i++) {
    const x = 150 + (i % 3) * 34 + (i > 2 ? 17 : 0);
    const y = 300 - (i > 2 ? 14 : 0);
    inside.push(
      path(
        `M${x} ${y}l6 -12h22l6 12z`,
        D.lg(x, 0, x + 34, 0, [
          [0, "#fff0a0"],
          [0.5, "#e0b030"],
          [1, "#8a6010"],
        ]),
        { stroke: "#5a4008", strokeWidth: 0.8 },
      ),
    );
  }
  // sacks of money with $ marks
  for (const [x, y, s] of [
    [300, 304, 1],
    [340, 312, 0.85],
  ]) {
    inside.push(
      path(
        `M${x - 22 * s} ${y}Q${x - 26 * s} ${y - 30 * s} ${x - 8 * s} ${y - 40 * s}L${x - 10 * s} ${y - 48 * s}Q${x} ${y - 52 * s} ${x + 10 * s} ${y - 48 * s}L${x + 8 * s} ${y - 40 * s}Q${x + 26 * s} ${y - 30 * s} ${x + 22 * s} ${y}Z`,
        "#8a7a4a",
        { stroke: "#3a2a10", strokeWidth: 1 },
      ),
    );
    inside.push(
      lettering("$", x, y - 30 * s, 16 * s, "#3a2a10", { align: "middle", weight: 0.14 }),
    );
  }
  out.push(g(inside, { clipPath: clipIn }));
  out.push(circle(250, 186, 140, "none", { stroke: "#000", strokeWidth: 2 }));
  // the door itself, open on its hinge at the right: an ellipse seen nearly side-on
  out.push(
    ellipse(
      436,
      190,
      46,
      152,
      D.lg(390, 0, 482, 0, [
        [0, "#4a4a44"],
        [0.5, "#9a9a90"],
        [1, "#5a5a54"],
      ]),
      { stroke: "#1a1a18", strokeWidth: 1.4 },
    ),
  );
  out.push(
    ellipse(
      442,
      190,
      34,
      128,
      D.lg(408, 0, 476, 0, [
        [0, "#7a7a72"],
        [1, "#b8b8ac"],
      ]),
      { stroke: "#2a2a28", strokeWidth: 1 },
    ),
  );
  // locking bolts on the door's edge
  for (let k = -3; k <= 3; k++)
    out.push(
      rect(386, 190 + k * 38 - 4, 14, 8, "#c8c8bc", { stroke: "#2a2a28", strokeWidth: 0.6 }),
    );
  // the spoked wheel on the door
  const wx = 446;
  const wy = 190;
  out.push(ellipse(wx, wy, 12, 40, "none", { stroke: "#e8e8dc", strokeWidth: 4 }));
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.4;
    out.push(
      path(`M${wx} ${wy}L${n(wx + Math.cos(a) * 14)} ${n(wy + Math.sin(a) * 52)}`, "none", {
        stroke: "#d8d8cc",
        strokeWidth: 4,
        strokeLinecap: "round",
      }),
    );
  }
  out.push(ellipse(wx, wy, 5, 12, "#9a9a90", { stroke: "#2a2a28", strokeWidth: 0.6 }));
  // hinge
  out.push(rect(394, 120, 16, 30, "#6a6a62", { stroke: "#1a1a18", strokeWidth: 0.8 }));
  out.push(rect(394, 232, 16, 30, "#6a6a62", { stroke: "#1a1a18", strokeWidth: 0.8 }));
  // floor and the light spilling out of the vault
  out.push(
    rect(
      0,
      330,
      550,
      70,
      D.lg(0, 330, 0, 400, [
        [0, "#3a3830"],
        [1, "#1a1a16"],
      ]),
    ),
  );
  out.push(path("M150 330L350 330L430 400L80 400Z", "#ffe8a0", { opacity: 0.12 }));
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.rg(260, 200, 380, [
        [0.5, "#000", 0],
        [1, "#000", 0.5],
      ]),
    ),
  );
  void R;
  return doc({ title: "places/bank-vault (Remastered)", body: out.join(""), defs: D });
}

export const pieces = [
  {
    id: "places/bank",
    kind: "redraw",
    overrides: "places/bank",
    usedBy: "the bank (bg)",
    grade: "B",
    notes:
      "Prudence Ledbetter (the Expanded teller) behind brass bars counting bills, the EXCHANGE plate top left as in the original, ledgers, clock and window behind. The small figure is the weakest part.",
    render: bank,
  },
  {
    id: "places/bank-vault",
    kind: "place",
    usedBy: "the bank's Savings and Loans screens (proposed bg)",
    grade: "B",
    notes:
      "The vault: the round door swung open on its hinge, deposit boxes, gold bars and money sacks lit warm inside, riveted steel walls.",
    render: vault,
  },
];
