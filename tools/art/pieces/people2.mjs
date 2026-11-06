/** Extra customers that widen the original eighteen, and the m_adult_u shirt fix. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bust, garment, hat, pts, SKINS, shadeHex } from "../face.mjs";
import { lettering, textPath } from "../font.mjs";
import { circle, Defs, doc, ellipse, g, n, path, rng, scallop, smooth } from "../lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const classic = join(here, "..", "..", "..", "assets", "classic");
const portraitDoc = (id, D, body) => doc({ title: `${id} (Remastered)`, body, defs: D });

/** An elderly churchgoer in her Sunday hat, pearls, a lavender suit. */
function fOld3() {
  const D = new Defs("fo");
  const R = rng(3);
  const body = bust(D, {
    cx: 275,
    cy: 176,
    u: 80,
    skin: SKINS.dark,
    jaw: 0.98,
    cheek: 1.02,
    chin: 0.94,
    jowls: 0.35,
    age: 0.75,
    eye: "#3a2410",
    eyeOpen: 0.85,
    lid: 0.6,
    droop: 0.08,
    brow: "#2a1a10",
    browLift: 0.7,
    browThick: 0.7,
    nose: 1.12,
    mouth: 0.95,
    smile: -0.25,
    lipFull: 1.0,
    lipColour: "#7a3a40",
    lipColourLo: "#4a2028",
    clothes: garment(D, { kind: "blouse", c: "#8a6a9a", c2: "#e8e0ec", wide: 1.04 }),
    hairBack: (f, _u) =>
      path(
        scallop(
          pts(f, [
            [-1.04, 0.2],
            [-1.1, -0.5],
            [-0.8, -0.95],
            [0.8, -0.95],
            [1.1, -0.5],
            [1.04, 0.2],
            [0.9, -0.2],
            [-0.9, -0.2],
          ]),
          0.35,
          R,
        ),
        "#b8b4b0",
      ),
    hairFront: hat(D, "church", "#6a3a7a", "#2a1a2a"),
    extra: (f, u) => {
      const out = [];
      // a silk flower on the hat band
      const [fx, fy] = f(0.62, -1.12);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        out.push(
          ellipse(
            fx + Math.cos(a) * u * 0.1,
            fy + Math.sin(a) * u * 0.1,
            u * 0.1,
            u * 0.065,
            "#e8c8d8",
            {
              transform: `rotate(${n((a * 180) / Math.PI)} ${n(fx + Math.cos(a) * u * 0.1)} ${n(fy + Math.sin(a) * u * 0.1)})`,
              stroke: "#9a6a7a",
              strokeWidth: u * 0.01,
            },
          ),
        );
      }
      out.push(circle(fx, fy, u * 0.05, "#e8c040"));
      // pearls and earrings
      for (let k = 0; k < 13; k++) {
        const t = k / 12;
        const [px, py] = f(-0.55 + t * 1.1, 1.62 + Math.sin(t * Math.PI) * 0.22);
        out.push(
          circle(px, py, u * 0.045, "#f4f0e8", { stroke: "#a8a090", strokeWidth: u * 0.008 }),
        );
      }
      for (const sx of [-1, 1])
        out.push(
          circle(f(sx * 1.08, 0.48)[0], f(sx * 1.08, 0.48)[1], u * 0.055, "#f4f0e8", {
            stroke: "#a8a090",
            strokeWidth: u * 0.01,
          }),
        );
      return g(out);
    },
  });
  return portraitDoc("people/f_old_3", D, body);
}

/** A sunburnt farmer in a feed cap and overalls, a gap in his grin. */
function mAdult5() {
  const D = new Defs("ma");
  const body = bust(D, {
    cx: 275,
    cy: 178,
    u: 84,
    skin: SKINS.ruddy,
    jaw: 1.12,
    cheek: 1.02,
    chin: 0.95,
    jowls: 0.2,
    age: 0.5,
    eye: "#5a7a4a",
    eyeOpen: 0.7,
    lid: 0.55,
    droop: 0.02,
    brow: "#7a4a24",
    browLift: 0.5,
    browThick: 1.2,
    nose: 1.25,
    mouth: 1.15,
    smile: 0.6,
    lipFull: 0.8,
    teeth: "#e8e0c0",
    stubble: "#6a3a1a",
    blush: "#d05040",
    clothes: garment(D, { kind: "overalls", c: "#b04a30", c2: "#b04a30", wide: 1.12 }),
    hairBack: (f, _u) =>
      path(
        smooth(
          pts(f, [
            [-0.98, -0.5],
            [-1.06, 0.0],
            [-0.94, 0.12],
            [0.94, 0.12],
            [1.06, 0.0],
            [0.98, -0.5],
          ]),
          true,
        ),
        "#9a5a28",
      ),
    hairFront: hat(D, "cap", "#2a5a2a", "#e8e0c0"),
    extra: (f, u) => {
      const out = [];
      // the gap in the teeth
      out.push(
        path(
          `M${n(f(0.04, 0.93)[0])} ${n(f(0.04, 0.93)[1])}h${n(u * 0.05)}v${n(u * 0.035)}h${n(-u * 0.05)}z`,
          "#3a1810",
        ),
      );
      // plaid on the shirt showing at the collar
      let plaid = "";
      for (let k = -3; k <= 3; k++) {
        const [x1, y1] = f(k * 0.15, 1.72);
        plaid += `M${n(x1)} ${n(y1)}l${n(u * 0.02)} ${n(u * 0.3)}`;
      }
      out.push(path(plaid, "none", { stroke: "#5a1a10", strokeWidth: u * 0.025, opacity: 0.6 }));
      // a stalk of hay
      out.push(
        path(
          `M${n(f(0.22, 0.97)[0])} ${n(f(0.22, 0.97)[1])}l${n(u * 0.7)} ${n(u * 0.12)}`,
          "none",
          { stroke: "#d8b850", strokeWidth: u * 0.025, strokeLinecap: "round" },
        ),
      );
      return g(out);
    },
  });
  return portraitDoc("people/m_adult_5", D, body);
}

/** A diner waitress at the end of a double shift: red beehive, winged liner, name tag. */
function fAdult3() {
  const D = new Defs("fa");
  const R = rng(8);
  const hairC = "#a0401a";
  const body = bust(D, {
    cx: 275,
    cy: 190,
    u: 74,
    skin: SKINS.pale,
    jaw: 0.86,
    cheek: 0.96,
    chin: 1.0,
    age: 0.35,
    eye: "#4a6a3a",
    eyeOpen: 0.85,
    lid: 0.7,
    droop: 0.06,
    look: 0.4,
    brow: "#6a2a10",
    browLift: 0.2,
    browThick: 0.6,
    nose: 0.95,
    mouth: 0.95,
    smile: -0.35,
    lipFull: 1.1,
    lipColour: "#c02838",
    lipColourLo: "#801828",
    blush: "#e07870",
    clothes: garment(D, { kind: "uniform", c: "#d8a0a8", c2: "#ffffff", wide: 0.95 }),
    hairBack: (f, _u) =>
      path(
        smooth(
          pts(f, [
            [-1.02, 0.25],
            [-1.08, -0.6],
            [-0.9, -1.3],
            [-0.5, -2.05],
            [0, -2.2],
            [0.5, -2.05],
            [0.9, -1.3],
            [1.08, -0.6],
            [1.02, 0.25],
            [0.9, -0.1],
            [-0.9, -0.1],
          ]),
          true,
          0.5,
        ),
        D.lg(f(-1, 0)[0], 0, f(1, 0)[0], 0, [
          [0, shadeHex(hairC, -0.15)],
          [1, shadeHex(hairC, 0.45)],
        ]),
      ),
    hairFront: (f, u) => {
      const out = [];
      const sweep = smooth(
        pts(f, [
          [-0.98, -0.2],
          [-0.94, -0.7],
          [-0.4, -0.86],
          [0.3, -0.74],
          [0.9, -0.62],
          [0.98, -0.2],
          [1.04, -1.0],
          [0.6, -1.9],
          [0, -2.06],
          [-0.6, -1.9],
          [-1.04, -1.0],
        ]),
        true,
        0.45,
      );
      out.push(
        path(
          sweep,
          D.lg(f(-1, 0)[0], 0, f(1, 0)[0], 0, [
            [0, shadeHex(hairC, -0.25)],
            [0.5, hairC],
            [1, shadeHex(hairC, 0.4)],
          ]),
        ),
      );
      for (let i = 0; i < 6; i++)
        out.push(
          path(
            smooth(
              pts(f, [
                [-0.8 + i * 0.3, -0.75],
                [-0.6 + i * 0.22, -1.4],
                [-0.2 + i * 0.08, -1.95],
              ]),
              false,
            ),
            "none",
            { stroke: "#e07a40", strokeWidth: u * 0.02, opacity: 0.5 },
          ),
        );
      // a pencil stuck in the hive
      out.push(
        path(`M${n(f(0.5, -1.7)[0])} ${n(f(0.5, -1.7)[1])}l${n(u * 0.5)} ${n(-u * 0.3)}`, "none", {
          stroke: "#e8c030",
          strokeWidth: u * 0.06,
          strokeLinecap: "round",
        }),
      );
      return g(out);
    },
    extra: (f, u) => {
      const out = [];
      // winged liner
      for (const sx of [-1, 1]) {
        const [x, y] = f(sx * 0.6, -0.03);
        out.push(
          path(
            `M${n(x - sx * u * 0.04)} ${n(y)}l${n(sx * u * 0.12)} ${n(-u * 0.06)}l${n(-sx * u * 0.06)} ${n(u * 0.05)}z`,
            "#1a1010",
          ),
        );
      }
      // name tag
      const [tx, ty] = f(0.75, 2.3);
      out.push(
        path(`M${n(tx)} ${n(ty)}h${n(u * 0.6)}v${n(u * 0.22)}h${n(-u * 0.6)}z`, "#f4f0e0", {
          stroke: "#6a6a6a",
          strokeWidth: u * 0.012,
        }),
      );
      out.push(
        lettering("DOT", tx + u * 0.3, ty + u * 0.05, u * 0.12, "#1a1a1a", {
          align: "middle",
          weight: 0.18,
        }),
      );
      // chewing gum bubble at the corner of the mouth? No: a cigarette tucked behind the ear.
      out.push(
        path(
          `M${n(f(1.0, -0.2)[0])} ${n(f(1.0, -0.2)[1])}l${n(u * 0.36)} ${n(-u * 0.14)}`,
          "none",
          { stroke: "#f4f0e8", strokeWidth: u * 0.05, strokeLinecap: "round" },
        ),
      );
      void R;
      return g(out);
    },
  });
  return portraitDoc("people/f_adult_3", D, body);
}

/** A retired watchmaker: wispy white beard, cardigan, a loupe on a cord. */
function mOld7() {
  const D = new Defs("mo7");
  const body = bust(D, {
    cx: 275,
    cy: 170,
    u: 80,
    skin: SKINS.olive,
    jaw: 0.86,
    cheek: 1.0,
    chin: 1.06,
    age: 0.8,
    eye: "#3a2410",
    eyeOpen: 0.6,
    lid: 0.75,
    droop: 0.04,
    brow: "#e8e4dc",
    browLift: 0.5,
    browThick: 1.1,
    nose: 0.95,
    mouth: 0.85,
    smile: 0.1,
    lipFull: 0.6,
    clothes: garment(D, { kind: "cardigan", c: "#7a6a4a", c2: "#e8e4dc", wide: 0.98 }),
    glasses: { kind: "rect", y: 0.02, colour: "#3a3a3a" },
    hairBack: (f, _u) =>
      g(
        [0, 1].map((k) =>
          path(
            smooth(
              pts(f, [
                [(k ? 1 : -1) * 0.86, -0.7],
                [(k ? 1 : -1) * 1.04, -0.4],
                [(k ? 1 : -1) * 1.02, 0.1],
                [(k ? 1 : -1) * 0.92, 0.0],
                [(k ? 1 : -1) * 0.88, -0.4],
              ]),
              true,
            ),
            "#e8e4dc",
          ),
        ),
      ),
    hairFront: (f, u) =>
      ellipse(f(-0.25, -1.0)[0], f(-0.25, -1.0)[1], u * 0.22, u * 0.08, "#ffffff", {
        opacity: 0.25,
      }),
    extra: (f, u) => {
      const out = [];
      // a short, trimmed white beard along the jaw, and a moustache
      out.push(
        path(
          smooth(
            pts(f, [
              [-0.9, 0.45],
              [-0.84, 0.86],
              [-0.56, 1.24],
              [-0.22, 1.46],
              [0, 1.5],
              [0.22, 1.46],
              [0.56, 1.24],
              [0.84, 0.86],
              [0.9, 0.45],
              [0.7, 0.7],
              [0.4, 0.84],
              [0.24, 1.06],
              [0, 1.1],
              [-0.24, 1.06],
              [-0.4, 0.84],
              [-0.7, 0.7],
            ]),
            true,
            0.45,
          ),
          D.lg(f(-1, 0)[0], 0, f(1, 0)[0], 0, [
            [0, "#f4f0e8"],
            [1, "#b8b4ac"],
          ]),
        ),
      );
      out.push(
        path(
          smooth(
            pts(f, [
              [-0.34, 0.96],
              [-0.16, 0.82],
              [0, 0.85],
              [0.16, 0.82],
              [0.34, 0.96],
              [0.14, 0.9],
              [0, 0.92],
              [-0.14, 0.9],
            ]),
            true,
            0.4,
          ),
          "#e8e4dc",
        ),
      );
      let wisp = "";
      for (let k = 0; k < 9; k++)
        wisp += smooth(
          pts(f, [
            [-0.7 + k * 0.17, 0.9 + Math.abs(-0.7 + k * 0.17) * -0.2],
            [-0.62 + k * 0.155, 1.2 - Math.abs(-0.62 + k * 0.155) * 0.3],
          ]),
          false,
        );
      out.push(path(wisp, "none", { stroke: "#a8a49c", strokeWidth: u * 0.012, opacity: 0.7 }));
      // a jeweller's loupe on a cord
      out.push(
        path(
          smooth(
            pts(f, [
              [-0.5, 1.75],
              [-0.4, 2.3],
              [-0.1, 2.6],
            ]),
            false,
          ),
          "none",
          { stroke: "#2a2a2a", strokeWidth: u * 0.015 },
        ),
      );
      const [lx, ly] = f(-0.05, 2.68);
      out.push(circle(lx, ly, u * 0.12, "#1a1a1a"));
      out.push(circle(lx, ly, u * 0.07, "#8ab0c0"));
      return g(out);
    },
  });
  return portraitDoc("people/m_old_7", D, body);
}

/**
 * people/m_adult_u with the real band's logo on his shirt replaced by an invented one. The rest
 * is Akiko Robinson's drawing, untouched: the logo path is removed and new lettering drawn.
 */
function mAdultU() {
  let src = readFileSync(join(classic, "people", "m_adult_u.svg"), "utf8");
  const before = src.length;
  // The logo is the last path of the file (the only one starting at m213.46 347.01).
  src = src.replace(/<path d="m213\.46 347\.01[^>]*\/>/, "");
  if (src.length === before) throw new Error("m_adult_u: logo path not found");
  src = src.replace(
    /<title>[^<]*<\/title>/,
    "<title>people/m_adult_u (Remastered: invented shirt logo)</title>",
  );
  // HEARSEFIRE in spiky capitals, sagging a little with the shirt.
  const size = 15;
  const { d, serifs } = textPath("HEARSEFIRE", 284, 348, size, {
    align: "middle",
    track: 0.1,
    serif: true,
  });
  const logo = [
    `<path d="${d}${serifs}" fill="none" stroke="#1a1a12" stroke-width="2.6" stroke-linecap="square" stroke-linejoin="miter" transform="rotate(-1.5 284 356)"/>`,
    // flames licking up off the letters
    `<path d="M198 368H370" fill="none" stroke="#1a1a12" stroke-width="1.4"/>`,
  ].join("");
  return src.replace(/<\/svg>\s*$/, `<g opacity="0.92">${logo}</g></svg>\n`);
}

export const pieces = [
  {
    id: "people/f_old_3",
    kind: "portrait",
    usedBy: "customers (new; needs adding to the customer picture list)",
    grade: "C",
    notes:
      "An elderly churchgoer in a purple Sunday hat with a silk flower, pearls and a lavender suit.",
    render: fOld3,
  },
  {
    id: "people/m_adult_5",
    kind: "portrait",
    usedBy: "customers (new)",
    grade: "C",
    notes:
      "A sunburnt farmer in a feed cap and overalls, stubble, a gap-toothed grin, a stalk of hay.",
    render: mAdult5,
  },
  {
    id: "people/f_adult_3",
    kind: "portrait",
    usedBy: "customers (new)",
    grade: "C",
    notes:
      "A diner waitress at the end of a double shift: red beehive with a pencil in it, winged liner, name tag DOT.",
    render: fAdult3,
  },
  {
    id: "people/m_old_7",
    kind: "portrait",
    usedBy: "customers (new)",
    grade: "C",
    notes:
      "A retired watchmaker with a trimmed white beard, reading glasses, cardigan and a loupe on a cord.",
    render: mOld7,
  },
  {
    id: "people/m_adult_u",
    kind: "fix",
    overrides: "people/m_adult_u",
    usedBy: "customers",
    grade: "A",
    notes:
      "Akiko Robinson's original drawing with the real band's logo removed and an invented band, HEARSEFIRE, lettered in its place.",
    credit:
      "Akiko Robinson (drawing); the replacement shirt logo by the Funeral Quest Remastered project",
    license: "Proton SDK license (the original drawing); CC BY 4.0 (the replacement logo)",
    render: mAdultU,
  },
];
void lettering;
