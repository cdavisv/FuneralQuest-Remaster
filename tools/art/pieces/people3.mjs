/**
 * Portraits for the named people at the places of docs/expanded-rules.md sections 30 and 31:
 * Sergeant Bixby, Marigold Thorne, Hal Pennywhistle, Dr. Ignatius Grimble, Cousin Sal and
 * Augustus Mourne. Built with the same parametric head as the other Remastered portraits
 * (face.mjs), so they share its limits: grade C.
 */
import { bun, bust, garment, pts, SKINS, shadeHex, slicked } from "../face.mjs";
import { circle, Defs, doc, ellipse, g, n, path, rect, smooth } from "../lib.mjs";

const portraitDoc = (id, D, body) => doc({ title: `${id} (Remastered)`, body, defs: D });

/** A peaked police cap: a navy crown, a shiny black peak, a gold badge. */
function peakedCap(D, c = "#1c2a4c") {
  return (f, u) => {
    const out = [];
    out.push(
      path(
        smooth(
          pts(f, [
            [-1.12, -0.62],
            [-1.1, -1.2],
            [-0.6, -1.5],
            [0, -1.55],
            [0.6, -1.5],
            [1.1, -1.2],
            [1.12, -0.62],
          ]),
          true,
          0.5,
        ),
        D.lg(f(-1.1, 0)[0], 0, f(1.1, 0)[0], 0, [
          [0, shadeHex(c, -0.2)],
          [0.5, c],
          [1, shadeHex(c, 0.4)],
        ]),
      ),
    );
    // band and peak
    out.push(
      path(
        smooth(
          pts(f, [
            [-1.13, -0.84],
            [0, -0.78],
            [1.13, -0.84],
            [1.12, -0.6],
            [0, -0.56],
            [-1.12, -0.6],
          ]),
          true,
          0.4,
        ),
        "#10182c",
      ),
    );
    out.push(
      path(
        smooth(
          pts(f, [
            [-1.0, -0.6],
            [-0.4, -0.5],
            [0.4, -0.5],
            [1.0, -0.6],
            [0.9, -0.38],
            [0, -0.3],
            [-0.9, -0.38],
          ]),
          true,
          0.5,
        ),
        "#0c0c10",
      ),
    );
    const [bx, by] = f(0, -0.97);
    out.push(
      path(
        `M${n(bx)} ${n(by - u * 0.2)}l${n(u * 0.17)} ${n(u * 0.2)}l${n(-u * 0.1)} ${n(u * 0.2)}h${n(-u * 0.14)}l${n(-u * 0.1)} ${n(-u * 0.2)}z`,
        "#d8b040",
        { stroke: "#7a5a10", strokeWidth: u * 0.015 },
      ),
    );
    return g(out);
  };
}

function bixby() {
  const D = new Defs("pbx");
  const body = bust(D, {
    cx: 275,
    cy: 190,
    u: 80,
    skin: SKINS.ruddy,
    jaw: 1.12,
    cheek: 1.08,
    chin: 0.92,
    jowls: 0.6,
    age: 0.5,
    eye: "#4a5a6a",
    eyeOpen: 0.62,
    lid: 0.8,
    droop: 0.08,
    brow: "#4a3a2a",
    browKnit: 0.4,
    browThick: 1.1,
    nose: 1.2,
    mouth: 0.95,
    smile: -0.5,
    lipFull: 0.7,
    blush: "#d06050",
    stubble: "#6a4a3a",
    clothes: garment(D, { kind: "jacket", c: "#26365c", c2: "#d8dce4", tie: "#101018", wide: 1.1 }),
    hairBack: (f) =>
      path(
        smooth(
          pts(f, [
            [-1.0, -0.2],
            [-1.04, 0.1],
            [1.04, 0.1],
            [1.0, -0.2],
            [0.9, -0.6],
            [-0.9, -0.6],
          ]),
          true,
        ),
        "#6a4a30",
      ),
    hairFront: peakedCap(D),
    extra: (f, u) => {
      const out = [];
      // a thick moustache, and a badge on the breast
      out.push(
        path(
          smooth(
            pts(f, [
              [-0.5, 0.74],
              [-0.2, 0.62],
              [0, 0.68],
              [0.2, 0.62],
              [0.5, 0.74],
              [0.3, 0.86],
              [0, 0.78],
              [-0.3, 0.86],
            ]),
            true,
            0.5,
          ),
          "#5a3a22",
        ),
      );
      const [bx, by] = f(-1.05, 2.3);
      out.push(
        path(
          `M${n(bx)} ${n(by - u * 0.3)}l${n(u * 0.22)} ${n(u * 0.18)}l${n(-u * 0.05)} ${n(u * 0.28)}l${n(-u * 0.17)} ${n(u * 0.12)}l${n(-u * 0.17)} ${n(-u * 0.12)}l${n(-u * 0.05)} ${n(-u * 0.28)}z`,
          "#d8b040",
          { stroke: "#7a5a10", strokeWidth: u * 0.015 },
        ),
      );
      // a doughnut-sugar dusting on the lapel
      out.push(circle(f(0.9, 2.45)[0], f(0.9, 2.45)[1], u * 0.03, "#f4f0e8"));
      return g(out);
    },
  });
  return portraitDoc("people/sergeant-bixby", D, body);
}

function marigold() {
  const D = new Defs("pmg");
  const h = bun(D, "#7a5a3a", "#a8845a");
  const body = bust(D, {
    cx: 275,
    cy: 186,
    u: 76,
    skin: SKINS.olive,
    jaw: 0.9,
    cheek: 1.04,
    chin: 0.96,
    age: 0.4,
    eye: "#4a6a3a",
    eyeOpen: 0.9,
    lid: 0.5,
    droop: 0.02,
    brow: "#5a3a22",
    browLift: 0.35,
    browThick: 0.7,
    nose: 0.95,
    mouth: 1.05,
    smile: 0.35,
    lipFull: 1.1,
    lipColour: "#a8404a",
    lipColourLo: "#782a34",
    blush: "#e08070",
    clothes: garment(D, { kind: "blouse", c: "#4a8a50", c2: "#f4f0e0", wide: 1.02 }),
    hairBack: h.back,
    hairFront: h.front,
    extra: (f, u) => {
      const out = [];
      // a daisy pinned at the collar and a bloom tucked behind the ear
      for (const [fx, fy, col] of [
        [f(0.75, 1.95), 0, "#ffffff"],
        [f(-0.98, -0.5), 0, "#f06a8a"],
      ]) {
        const [x, y] = fx;
        void fy;
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * Math.PI * 2;
          out.push(
            ellipse(
              x + Math.cos(a) * u * 0.11,
              y + Math.sin(a) * u * 0.11,
              u * 0.09,
              u * 0.055,
              col,
              {
                transform: `rotate(${n((a * 180) / Math.PI)} ${n(x + Math.cos(a) * u * 0.11)} ${n(y + Math.sin(a) * u * 0.11)})`,
                stroke: "#8a6a5a",
                strokeWidth: u * 0.008,
              },
            ),
          );
        }
        out.push(circle(x, y, u * 0.06, "#f4c020"));
      }
      // an apron strap
      out.push(
        path(
          `M${n(f(-0.45, 1.8)[0])} ${n(f(-0.45, 1.8)[1])}L${n(f(-0.8, 3.4)[0])} ${n(f(-0.8, 3.4)[1])}M${n(f(0.45, 1.8)[0])} ${n(f(0.45, 1.8)[1])}L${n(f(0.8, 3.4)[0])} ${n(f(0.8, 3.4)[1])}`,
          "none",
          { stroke: "#2a5a30", strokeWidth: u * 0.16, strokeLinecap: "round" },
        ),
      );
      return g(out);
    },
  });
  return portraitDoc("people/marigold-thorne", D, body);
}

function hal() {
  const D = new Defs("phl");
  const body = bust(D, {
    cx: 275,
    cy: 184,
    u: 76,
    skin: SKINS.pale,
    jaw: 0.82,
    cheek: 0.9,
    chin: 1.06,
    age: 0.55,
    eye: "#4a6a8a",
    eyeOpen: 0.85,
    lid: 0.55,
    droop: 0.03,
    brow: "#8a8070",
    browLift: 0.5,
    browThick: 0.8,
    nose: 1.15,
    mouth: 0.9,
    smile: 0.1,
    lipFull: 0.7,
    teeth: "#e8e0c0",
    clothes: garment(D, { kind: "blouse", c: "#e8e4d8", c2: "#cfc8b8", wide: 0.98 }),
    hairBack: (f) =>
      path(
        smooth(
          pts(f, [
            [-1.0, -0.2],
            [-1.04, -0.8],
            [-0.6, -1.3],
            [0.6, -1.3],
            [1.04, -0.8],
            [1.0, -0.2],
            [0.9, -0.5],
            [-0.9, -0.5],
          ]),
          true,
        ),
        "#8a8070",
      ),
    glasses: { kind: "round", y: 0.04, colour: "#2a2a2a" },
    extra: (f, u) => {
      const out = [];
      // a green eyeshade visor over the forehead
      out.push(
        path(
          smooth(
            pts(f, [
              [-1.08, -0.5],
              [-0.7, -0.78],
              [0, -0.82],
              [0.7, -0.78],
              [1.08, -0.5],
              [1.1, -0.34],
              [0.7, -0.5],
              [0, -0.55],
              [-0.7, -0.5],
              [-1.1, -0.34],
            ]),
            true,
            0.5,
          ),
          D.lg(f(-1, 0)[0], 0, f(1, 0)[0], 0, [
            [0, "#3a7a4a"],
            [1, "#1e4a2a"],
          ]),
          { opacity: 0.92 },
        ),
      );
      out.push(
        path(
          smooth(
            pts(f, [
              [-1.12, -0.52],
              [0, -0.64],
              [1.12, -0.52],
            ]),
            false,
            0.5,
          ),
          "none",
          { stroke: "#18381f", strokeWidth: u * 0.04 },
        ),
      );
      // suspenders and a loosened tie
      out.push(
        path(
          `M${n(f(-0.6, 1.8)[0])} ${n(f(-0.6, 1.8)[1])}L${n(f(-0.7, 3.4)[0])} ${n(f(-0.7, 3.4)[1])}M${n(f(0.6, 1.8)[0])} ${n(f(0.6, 1.8)[1])}L${n(f(0.7, 3.4)[0])} ${n(f(0.7, 3.4)[1])}`,
          "none",
          { stroke: "#5a2a2a", strokeWidth: u * 0.1 },
        ),
      );
      out.push(
        path(
          `M${n(f(0, 1.8)[0])} ${n(f(0, 1.8)[1])}l${n(u * 0.12)} ${n(u * 0.7)}l${n(-u * 0.12)} ${n(u * 0.3)}l${n(-u * 0.12)} ${n(-u * 0.3)}z`,
          "#8a2a2a",
        ),
      );
      // a pencil behind the ear
      out.push(
        path(
          `M${n(f(-1.12, -0.1)[0])} ${n(f(-1.12, -0.1)[1])}l${n(-u * 0.16)} ${n(-u * 0.5)}`,
          "none",
          { stroke: "#e8c040", strokeWidth: u * 0.05, strokeLinecap: "round" },
        ),
      );
      return g(out);
    },
  });
  return portraitDoc("people/hal-pennywhistle", D, body);
}

function grimble() {
  const D = new Defs("pgr");
  const body = bust(D, {
    cx: 275,
    cy: 182,
    u: 78,
    skin: SKINS.deathly,
    jaw: 0.88,
    cheek: 0.86,
    chin: 1.08,
    jowls: 0.2,
    age: 0.85,
    eye: "#6a6a4a",
    eyeOpen: 0.55,
    lid: 0.85,
    droop: 0.1,
    brow: "#c8c4b8",
    browLift: 0.8,
    browThick: 1.1,
    nose: 1.3,
    noseHook: 0.4,
    mouth: 0.9,
    smile: -0.2,
    lipFull: 0.5,
    lipColour: "#8a6a5a",
    lipColourLo: "#5a4034",
    clothes: garment(D, { kind: "uniform", c: "#e4e8e8", c2: "#e4e8e8", wide: 1.06 }),
    hairBack: (f) =>
      path(
        smooth(
          pts(f, [
            [-1.0, -0.2],
            [-1.12, -0.5],
            [-1.0, -0.78],
            [-0.9, -0.2],
            [0.9, -0.2],
            [1.0, -0.78],
            [1.12, -0.5],
            [1.0, -0.2],
            [0.9, 0.1],
            [-0.9, 0.1],
          ]),
          true,
        ),
        "#d8d4c8",
      ),
    glasses: { kind: "round", y: 0.04, colour: "#4a4a4a", lens: "#cfe0e8" },
    extra: (f, u) => {
      const out = [];
      // a stethoscope round the neck and a pen in the pocket
      out.push(
        path(
          smooth(
            pts(f, [
              [-0.62, 1.8],
              [-0.7, 2.6],
              [-0.2, 3.3],
              [0.3, 2.6],
              [0.62, 1.8],
            ]),
            false,
            0.5,
          ),
          "none",
          { stroke: "#2a2a2a", strokeWidth: u * 0.07, strokeLinecap: "round" },
        ),
      );
      out.push(
        circle(f(-0.2, 3.3)[0], f(-0.2, 3.3)[1], u * 0.16, "#b8b8c0", {
          stroke: "#2a2a2a",
          strokeWidth: u * 0.03,
        }),
      );
      out.push(
        rect(f(1.1, 2.6)[0], f(1.1, 2.6)[1], u * 0.5, u * 0.4, "#cfd4d4", {
          stroke: "#9aa0a0",
          strokeWidth: u * 0.02,
        }),
      );
      out.push(
        path(`M${n(f(1.3, 2.5)[0])} ${n(f(1.3, 2.5)[1])}v${n(-u * 0.25)}`, "none", {
          stroke: "#2a4a8a",
          strokeWidth: u * 0.04,
        }),
      );
      return g(out);
    },
  });
  return portraitDoc("people/dr-grimble", D, body);
}

function sal() {
  const D = new Defs("psl");
  const hair = slicked(D, "#1e1a18", "#5a5048", 0.2);
  const body = bust(D, {
    cx: 275,
    cy: 184,
    u: 80,
    skin: SKINS.olive,
    jaw: 1.04,
    cheek: 1.1,
    chin: 0.9,
    jowls: 0.35,
    age: 0.45,
    eye: "#4a3418",
    eyeOpen: 0.7,
    lid: 0.7,
    droop: 0.02,
    look: 0.6,
    brow: "#1e1a18",
    browLift: 0.6,
    browThick: 1.2,
    nose: 1.3,
    mouth: 1.1,
    smile: 0.7,
    lipFull: 0.9,
    teeth: "#e8e0c8",
    stubble: "#2a2220",
    clothes: garment(D, {
      kind: "jacket",
      c: "#6a4a2a",
      c2: "#d8c8a0",
      tie: "#c8a030",
      wide: 1.12,
    }),
    hairBack: hair.back,
    hairFront: hair.front,
    extra: (f, u) => {
      const out = [];
      // a gold tooth, a jeweller's loupe pushed up, a heavy gold chain
      out.push(
        path(
          `M${n(f(0.12, 0.93)[0])} ${n(f(0.12, 0.93)[1])}h${n(u * 0.07)}v${n(u * 0.05)}h${n(-u * 0.07)}z`,
          "#e8b830",
        ),
      );
      const [lx, ly] = f(-0.55, -0.55);
      out.push(circle(lx, ly, u * 0.17, "#2a2a2a", { stroke: "#6a6a72", strokeWidth: u * 0.04 }));
      out.push(circle(lx, ly, u * 0.09, "#9ac8d8", { opacity: 0.8 }));
      for (let k = 0; k < 11; k++) {
        const t = k / 10;
        const [px, py] = f(-0.8 + t * 1.6, 1.85 + Math.sin(t * Math.PI) * 0.5);
        out.push(circle(px, py, u * 0.06, "#e8b830", { stroke: "#7a5a10", strokeWidth: u * 0.01 }));
      }
      const [mx, my] = f(0, 2.45);
      out.push(circle(mx, my, u * 0.14, "#e8b830", { stroke: "#7a5a10", strokeWidth: u * 0.02 }));
      return g(out);
    },
  });
  return portraitDoc("people/cousin-sal", D, body);
}

function augustus() {
  const D = new Defs("pau");
  const hair = slicked(D, "#c8c8cc", "#f2f2f4", 0.1);
  const body = bust(D, {
    cx: 275,
    cy: 182,
    u: 78,
    skin: SKINS.deathly,
    jaw: 0.9,
    cheek: 0.88,
    chin: 1.12,
    jowls: 0.15,
    age: 0.8,
    eye: "#4a5a6a",
    eyeOpen: 0.6,
    lid: 0.75,
    droop: 0.05,
    brow: "#9a9aa0",
    browKnit: 0.3,
    browThick: 1.0,
    nose: 1.15,
    mouth: 0.8,
    smile: -0.4,
    lipFull: 0.5,
    clothes: garment(D, { kind: "suit", c: "#16161c", c2: "#f4f2ee", tie: "#16161c", wide: 1.08 }),
    hairBack: hair.back,
    hairFront: hair.front,
    extra: (f, u) => {
      const out = [];
      // a high white collar, a gold watch chain and a black carnation
      out.push(
        path(
          smooth(
            pts(f, [
              [-0.5, 1.7],
              [0, 1.95],
              [0.5, 1.7],
              [0.46, 1.95],
              [0, 2.2],
              [-0.46, 1.95],
            ]),
            true,
            0.3,
          ),
          "#f4f2ee",
          { opacity: 0.0 },
        ),
      );
      out.push(
        path(
          `M${n(f(-0.9, 2.5)[0])} ${n(f(-0.9, 2.5)[1])}Q${n(f(-0.3, 2.9)[0])} ${n(f(-0.3, 2.9)[1])} ${n(f(0.1, 2.55)[0])} ${n(f(0.1, 2.55)[1])}`,
          "none",
          { stroke: "#d8b040", strokeWidth: u * 0.03 },
        ),
      );
      const [cx, cy] = f(-1.15, 2.35);
      out.push(circle(cx, cy, u * 0.1, "#0a0a0e", { stroke: "#4a4a54", strokeWidth: u * 0.015 }));
      return g(out);
    },
  });
  return portraitDoc("people/augustus-mourne", D, body);
}

export const pieces = [
  [
    "people/sergeant-bixby",
    bixby,
    "Sergeant Bixby of the Police Station (proposed fg for pictures.police, over the original places/funeral_enemy_police)",
    "A jowly, sunburnt sergeant in a navy peaked cap and jacket, a thick moustache, a gold badge and sugar on his lapel.",
  ],
  [
    "people/marigold-thorne",
    marigold,
    "Marigold Thorne, the Florist (proposed fg for pictures.florist)",
    "A warm woman with a chestnut bun and a bloom behind her ear, a green blouse and apron, a daisy at her collar.",
  ],
  [
    "people/hal-pennywhistle",
    hal,
    "Hal Pennywhistle, editor of the Town Gazette (proposed fg for pictures.gazette)",
    "A thin, grey editor in round glasses and a green eyeshade, shirtsleeves, suspenders, a loosened tie and a pencil behind the ear.",
  ],
  [
    "people/dr-grimble",
    grimble,
    "Dr. Ignatius Grimble, the Coroner (proposed fg for pictures.coroner)",
    "A gaunt, pale old man in round glasses with white tufts, a hooked nose, a white coat, a stethoscope and a pen in his pocket.",
  ],
  [
    "people/cousin-sal",
    sal,
    "Cousin Sal at the Pawn Shop (proposed fg for pictures.pawn)",
    "A grinning, stubbled dealer with slick black hair, a gold tooth, a jeweller's loupe pushed up, a gold chain and a brown jacket.",
  ],
  [
    "people/augustus-mourne",
    augustus,
    "Augustus Mourne of Mourne & Sons (proposed fg for pictures.mournes)",
    "A severe, silver-haired old undertaker in a black suit and high white collar, a watch chain and a black carnation.",
  ],
].map(([id, render, usedBy, notes]) => ({
  id,
  kind: "portrait",
  usedBy,
  grade: "C",
  notes,
  render,
}));
