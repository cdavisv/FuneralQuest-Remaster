/** New portraits for the Expanded cast, in the original portraits' manner (tools/art/face.mjs). */
import { bun, bust, curls, garment, hat, pts, SKINS, shadeHex, slicked } from "../face.mjs";
import { lettering } from "../font.mjs";
import { circle, Defs, doc, ellipse, g, n, path, rect, rng, scallop, smooth } from "../lib.mjs";
import { P } from "../palette.mjs";

const portraitDoc = (id, D, body) => doc({ title: `${id} (Remastered)`, body, defs: D });

/** Side tufts of hair over the ears (for the bald). */
const sideTufts = (c, lo) => (f, u) => {
  const out = [];
  for (const s of [-1, 1]) {
    out.push(
      path(
        smooth(
          pts(f, [
            [s * 0.84, -0.7],
            [s * 1.02, -0.45],
            [s * 1.04, -0.05],
            [s * 0.96, 0.1],
            [s * 0.9, -0.2],
            [s * 0.86, -0.5],
          ]),
          true,
        ),
        s < 0 ? c : lo,
      ),
    );
    for (let i = 0; i < 4; i++)
      out.push(
        path(
          smooth(
            pts(f, [
              [s * (0.88 + i * 0.03), -0.6 + i * 0.12],
              [s * (0.98 + i * 0.01), -0.4 + i * 0.12],
            ]),
            false,
          ),
          "none",
          { stroke: lo, strokeWidth: u * 0.015, opacity: 0.7 },
        ),
      );
  }
  return g(out);
};

/** Mayor Hollis Grubb: jowly, comb-over, small pleased eyes, a chain of office. */
function mayor() {
  const D = new Defs("my");
  const sk = SKINS.ruddy;
  const body = bust(D, {
    cx: 275,
    cy: 160,
    u: 92,
    skin: sk,
    jaw: 1.12,
    cheek: 1.06,
    chin: 0.96,
    crown: 0.98,
    jowls: 0.9,
    age: 0.7,
    eye: "#5a6a7a",
    eyeOpen: 0.75,
    lid: 0.7,
    droop: 0.0,
    brow: "#a09888",
    browLift: -0.1,
    browThick: 1.4,
    nose: 1.3,
    mouth: 1.05,
    smile: 0.9,
    lipFull: 0.8,
    blush: "#d05040",
    clothes: garment(D, { kind: "suit", c: "#3a3a44", c2: "#f0ece4", tie: "#9a1a1a", wide: 1.08 }),
    hairBack: sideTufts("#c8c0b0", "#8a8478"),
    hairFront: (f, u) => {
      // three long strands combed across the dome
      const out = [];
      for (let i = 0; i < 4; i++) {
        const y = -1.02 + i * 0.08;
        out.push(
          path(
            smooth(
              pts(f, [
                [0.86, y + 0.32],
                [0.4, y - 0.1],
                [-0.2, y - 0.08],
                [-0.7, y + 0.22],
              ]),
              false,
            ),
            "none",
            {
              stroke: i % 2 ? "#b8b0a0" : "#8a8478",
              strokeWidth: u * 0.035,
              strokeLinecap: "round",
              opacity: 0.9,
            },
          ),
        );
      }
      // shine on the pate
      out.push(
        ellipse(f(-0.3, -1.0)[0], f(-0.3, -1.0)[1], u * 0.22, u * 0.08, "#ffffff", {
          opacity: 0.35,
          transform: `rotate(-14 ${n(f(-0.3, -1)[0])} ${n(f(-0.3, -1)[1])})`,
        }),
      );
      // a bead of sweat
      out.push(
        ellipse(f(0.5, -0.62)[0], f(0.5, -0.62)[1], u * 0.03, u * 0.05, "#ffffff", {
          opacity: 0.6,
        }),
      );
      return g(out);
    },
    extra: (f, u) => {
      // the chain of office across the chest, with a medallion
      const out = [];
      const chain = smooth(
        pts(f, [
          [-1.1, 2.15],
          [-0.6, 2.75],
          [0, 2.95],
          [0.6, 2.75],
          [1.1, 2.15],
        ]),
        false,
      );
      out.push(
        path(chain, "none", { stroke: "#7a5a10", strokeWidth: u * 0.1, strokeLinecap: "round" }),
      );
      out.push(
        path(chain, "none", {
          stroke: "#e8c040",
          strokeWidth: u * 0.06,
          strokeDasharray: `${n(u * 0.08)} ${n(u * 0.04)}`,
        }),
      );
      const [mx, my] = f(0, 3.12);
      out.push(
        circle(
          mx,
          my,
          u * 0.26,
          D.lg(mx - u * 0.26, 0, mx + u * 0.26, 0, [
            [0, "#fff0a0"],
            [0.5, "#e0b030"],
            [1, "#8a6010"],
          ]),
          { stroke: "#5a4008", strokeWidth: u * 0.02 },
        ),
      );
      out.push(circle(mx, my, u * 0.17, "none", { stroke: "#8a6010", strokeWidth: u * 0.02 }));
      out.push(
        path(
          `M${n(mx)} ${n(my - u * 0.1)}V${n(my + u * 0.1)}M${n(mx - u * 0.07)} ${n(my - u * 0.03)}H${n(mx + u * 0.07)}`,
          "none",
          { stroke: "#8a6010", strokeWidth: u * 0.025 },
        ),
      );
      // pinstripes on the suit
      let stripes = "";
      for (let x = -2.2; x <= 2.2; x += 0.16) {
        if (Math.abs(x) < 0.7) continue;
        const [x1, y1] = f(x, 2.2 + Math.abs(x) * 0.2);
        const [x2, y2] = f(x * 1.02, 3.4);
        stripes += `M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}`;
      }
      out.unshift(path(stripes, "none", { stroke: "#8a8a98", strokeWidth: 0.5, opacity: 0.35 }));
      return g(out);
    },
  });
  return portraitDoc("people/mayor-grubb", D, body);
}

/** Lucius Vane: gaunt, slick, a pencil moustache and a velvet jacket; owner of the Reaper Club. */
function vane() {
  const D = new Defs("va");
  const hair = slicked(D, "#1a1418", "#6a5a70", 0.2);
  const body = bust(D, {
    cx: 275,
    cy: 158,
    u: 84,
    skin: { ...SKINS.deathly, hi: "#e8dcc8", mid: "#d4c4ac", lo: "#a8967c", deep: "#7a6a54" },
    jaw: 0.82,
    cheek: 0.94,
    chin: 1.12,
    crown: 1.04,
    age: 0.45,
    eye: "#4a2a5a",
    eyeOpen: 0.8,
    lid: 0.75,
    droop: -0.02,
    brow: "#1a1418",
    browLift: -0.5,
    browKnit: 0.2,
    browThick: 1.1,
    nose: 1.05,
    noseHook: 0.6,
    mouth: 0.95,
    smile: 0.35,
    lipFull: 0.6,
    lipColour: "#8a4a50",
    lipColourLo: "#5a2a30",
    clothes: garment(D, { kind: "suit", c: "#4a1a4a", c2: "#1a1a1a", tie: "#c8a030", wide: 1.0 }),
    hairBack: hair.back,
    hairFront: hair.front,
    extra: (f, u) => {
      const out = [];
      // pencil moustache
      out.push(
        path(
          smooth(
            pts(f, [
              [-0.28, 0.86],
              [-0.12, 0.8],
              [0, 0.82],
              [0.12, 0.8],
              [0.28, 0.86],
              [0.12, 0.84],
              [0, 0.86],
              [-0.12, 0.84],
            ]),
            true,
            0.4,
          ),
          "#1a1418",
        ),
      );
      // hollow cheeks
      for (const sx of [-1, 1])
        out.push(
          path(
            smooth(
              pts(f, [
                [sx * 0.7, 0.3],
                [sx * 0.6, 0.62],
                [sx * 0.66, 0.86],
                [sx * 0.8, 0.6],
              ]),
              true,
            ),
            "#7a6a54",
            { opacity: sx < 0 ? 0.22 : 0.4 },
          ),
        );
      // a skull pin on the lapel, a red carnation
      const [px, py] = f(-0.62, 2.55);
      out.push(circle(px, py, u * 0.1, "#e8e0c8", { stroke: "#5a5040", strokeWidth: u * 0.01 }));
      out.push(circle(px - u * 0.035, py - u * 0.01, u * 0.025, "#1a1a1a"));
      out.push(circle(px + u * 0.035, py - u * 0.01, u * 0.025, "#1a1a1a"));
      const [rx, ry] = f(0.75, 2.4);
      out.push(
        path(
          scallop(
            [
              [rx - u * 0.12, ry],
              [rx, ry - u * 0.12],
              [rx + u * 0.12, ry],
              [rx, ry + u * 0.11],
            ],
            0.6,
          ),
          "#a01818",
          { stroke: "#5a0808", strokeWidth: u * 0.01 },
        ),
      );
      return g(out);
    },
  });
  return portraitDoc("people/lucius-vane", D, body);
}

/** Inspector Mudge: a pinched, sniffing little man in a bowler with a clipboard. */
function mudge() {
  const D = new Defs("mu");
  const body = bust(D, {
    cx: 270,
    cy: 176,
    u: 78,
    skin: SKINS.pale,
    jaw: 0.78,
    cheek: 0.9,
    chin: 0.9,
    crown: 1.0,
    age: 0.6,
    eye: "#6a5a3a",
    eyeOpen: 0.55,
    lid: 0.6,
    droop: 0.02,
    look: -0.6,
    brow: "#4a3a2a",
    browLift: 0.1,
    browKnit: 0.8,
    browThick: 0.9,
    nose: 1.35,
    noseHook: 1,
    mouth: 0.7,
    smile: -0.7,
    lipFull: 0.55,
    clothes: garment(D, { kind: "suit", c: "#8a7a5a", c2: "#e8e4d8", tie: "#3a4a3a", wide: 0.92 }),
    hairBack: (f, _u) =>
      path(
        smooth(
          pts(f, [
            [-0.95, -0.6],
            [-1.02, -0.1],
            [-0.92, 0.12],
            [0.92, 0.12],
            [1.02, -0.1],
            [0.95, -0.6],
          ]),
          true,
        ),
        "#6a5a4a",
      ),
    hairFront: hat(D, "bowler", "#2a2420", "#4a3a30"),
    extra: (f, u) => {
      const out = [];
      // a clipped moustache
      out.push(
        path(
          smooth(
            pts(f, [
              [-0.2, 0.84],
              [0, 0.76],
              [0.2, 0.84],
              [0.1, 0.88],
              [0, 0.86],
              [-0.1, 0.88],
            ]),
            true,
            0.4,
          ),
          "#5a4a3a",
        ),
      );
      // pince-nez on the nose
      for (const sx of [-1, 1])
        out.push(
          ellipse(f(sx * 0.36, 0.06)[0], f(sx * 0.36, 0.06)[1], u * 0.17, u * 0.13, "none", {
            stroke: "#b8a050",
            strokeWidth: u * 0.025,
          }),
        );
      out.push(
        path(
          smooth(
            pts(f, [
              [-0.19, 0.04],
              [0, 0.0],
              [0.19, 0.04],
            ]),
            false,
          ),
          "none",
          { stroke: "#b8a050", strokeWidth: u * 0.025 },
        ),
      );
      out.push(
        path(
          smooth(
            pts(f, [
              [0.52, 0.06],
              [0.7, 0.6],
              [0.6, 1.4],
              [0.7, 2.0],
            ]),
            false,
          ),
          "none",
          { stroke: "#2a2a2a", strokeWidth: u * 0.01, opacity: 0.7 },
        ),
      );
      // clipboard held up at the left, a pencil
      const [cx0, cy0] = f(-1.9, 2.15);
      out.push(
        path(
          `M${n(cx0)} ${n(cy0)}l${n(u * 0.95)} ${n(-u * 0.12)}l${n(u * 0.16)} ${n(u * 1.4)}l${n(-u * 0.95)} ${n(u * 0.12)}z`,
          "#a07840",
          { stroke: "#3a2a10", strokeWidth: u * 0.02 },
        ),
      );
      out.push(
        path(
          `M${n(cx0 + u * 0.08)} ${n(cy0 + u * 0.06)}l${n(u * 0.8)} ${n(-u * 0.1)}l${n(u * 0.14)} ${n(u * 1.24)}l${n(-u * 0.8)} ${n(u * 0.1)}z`,
          "#f0ece0",
        ),
      );
      let lines = "";
      for (let i = 0; i < 6; i++)
        lines += `M${n(cx0 + u * 0.2 + i * u * 0.02)} ${n(cy0 + u * (0.3 + i * 0.16))}l${n(u * 0.6)} ${n(-u * 0.075)}`;
      out.push(path(lines, "none", { stroke: "#8a8a9a", strokeWidth: u * 0.012 }));
      out.push(
        path(
          `M${n(cx0 + u * 0.32)} ${n(cy0 - u * 0.1)}h${n(u * 0.3)}v${n(u * 0.1)}h${n(-u * 0.3)}z`,
          "#b0b0b0",
          { stroke: "#4a4a4a", strokeWidth: u * 0.01 },
        ),
      );
      // the hand holding it, and the sniffing finger
      out.push(
        path(
          smooth(
            pts(f, [
              [-1.3, 3.2],
              [-1.32, 2.86],
              [-1.16, 2.78],
              [-1.0, 2.86],
              [-0.98, 3.2],
            ]),
            true,
          ),
          SKINS.pale.mid,
          { stroke: SKINS.pale.line, strokeWidth: u * 0.012 },
        ),
      );
      return g(out);
    },
  });
  return portraitDoc("people/inspector-mudge", D, body);
}

/** Prudence Ledbetter: the teller, a tight bun, half-moon glasses low on the nose, a brooch. */
function prudence() {
  const D = new Defs("pr");
  const hair = bun(D, "#6a5040", "#a08a78");
  const body = bust(D, {
    cx: 275,
    cy: 170,
    u: 80,
    skin: SKINS.pale,
    jaw: 0.82,
    cheek: 0.92,
    chin: 1.04,
    crown: 0.98,
    age: 0.55,
    eye: "#4a6a5a",
    eyeOpen: 0.85,
    lid: 0.45,
    droop: 0.06,
    look: 0.2,
    brow: "#5a4030",
    browLift: -0.6,
    browKnit: 0.4,
    browThick: 0.6,
    nose: 1.0,
    mouth: 0.72,
    smile: -0.5,
    lipFull: 0.6,
    lipColour: "#a85a5a",
    lipColourLo: "#7a3a3a",
    clothes: garment(D, { kind: "blouse", c: "#5a6a8a", c2: "#f4f0e8", wide: 0.9 }),
    hairBack: hair.back,
    hairFront: hair.front,
    glasses: { kind: "half", y: 0.3, colour: "#6a4a2a" },
    extra: (f, u) => {
      const out = [];
      // high lace collar and a cameo brooch
      out.push(
        path(
          smooth(
            pts(f, [
              [-0.62, 1.45],
              [-0.64, 1.86],
              [0, 1.98],
              [0.64, 1.86],
              [0.62, 1.45],
              [0, 1.58],
            ]),
            true,
            0.4,
          ),
          "#f4f0e8",
          { stroke: "#c8c0b0", strokeWidth: u * 0.012 },
        ),
      );
      let lace = "";
      for (let i = 0; i < 9; i++) {
        const [x, y] = f(-0.56 + i * 0.14, 1.9 + Math.abs(-0.56 + i * 0.14) * -0.08);
        lace += `M${n(x - u * 0.06)} ${n(y)}q${n(u * 0.06)} ${n(u * 0.07)} ${n(u * 0.12)} 0`;
      }
      out.push(path(lace, "none", { stroke: "#c8c0b0", strokeWidth: u * 0.012 }));
      const [bx, by] = f(0, 2.06);
      out.push(
        ellipse(bx, by, u * 0.14, u * 0.18, "#c8a040", {
          stroke: "#6a5010",
          strokeWidth: u * 0.015,
        }),
      );
      out.push(ellipse(bx, by, u * 0.1, u * 0.13, "#e8dcd0"));
      out.push(
        path(
          `M${n(bx - u * 0.02)} ${n(by - u * 0.08)}q${n(u * 0.07)} ${n(u * 0.02)} ${n(u * 0.04)} ${n(u * 0.08)}q${n(-u * 0.05)} ${n(u * 0.05)} ${n(-u * 0.02)} ${n(u * 0.08)}`,
          "#b8a898",
        ),
      );
      // the glasses' chain
      out.push(
        path(
          smooth(
            pts(f, [
              [-0.66, 0.3],
              [-0.92, 0.9],
              [-0.86, 1.5],
            ]),
            false,
          ),
          "none",
          {
            stroke: "#c8a040",
            strokeWidth: u * 0.012,
            strokeDasharray: `${n(u * 0.02)} ${n(u * 0.02)}`,
          },
        ),
      );
      out.push(
        path(
          smooth(
            pts(f, [
              [0.66, 0.3],
              [0.92, 0.9],
              [0.86, 1.5],
            ]),
            false,
          ),
          "none",
          {
            stroke: "#c8a040",
            strokeWidth: u * 0.012,
            strokeDasharray: `${n(u * 0.02)} ${n(u * 0.02)}`,
          },
        ),
      );
      return g(out);
    },
  });
  return portraitDoc("people/teller-prudence", D, body);
}

/** Nurse Gertie: night-shift nurse near retirement, grey curls, a cardigan over the uniform. */
function gertie() {
  const D = new Defs("ge");
  const R = rng(17);
  const hair = curls(D, "#d8d4d0", "#8a8680", R, { top: -1.62, side: 1.24, low: 0.3 });
  const body = bust(D, {
    cx: 275,
    cy: 172,
    u: 80,
    skin: SKINS.pale,
    jaw: 0.96,
    cheek: 1.0,
    chin: 0.96,
    crown: 0.96,
    jowls: 0.4,
    age: 0.75,
    eye: "#5a7a9a",
    eyeOpen: 0.8,
    lid: 0.65,
    droop: 0.08,
    brow: "#8a8680",
    browLift: 0.6,
    browThick: 0.7,
    nose: 1.05,
    mouth: 0.9,
    smile: 0.25,
    lipFull: 0.75,
    blush: "#e08070",
    clothes: (f, u, _Dd) =>
      g([
        garment(D, { kind: "uniform", c: "#d8e0e8", c2: "#ffffff", wide: 1.02 })(f, u),
        garment(D, { kind: "cardigan", c: "#7a9ab0", c2: "#d8e0e8", wide: 1.06, top: 1.95 })(f, u),
      ]),
    hairBack: hair.back,
    hairFront: (f, u) => g([hair.front(f, u), hat(D, "nurse")(f, u)]),
    glasses: { kind: "round", y: 0.02, colour: "#8a6a4a" },
    extra: (f, u) => {
      const out = [];
      // a fob watch pinned to the cardigan
      const [wx, wy] = f(-0.9, 2.6);
      out.push(
        path(`M${n(wx)} ${n(wy - u * 0.2)}v${n(u * 0.12)}`, "none", {
          stroke: "#c8a040",
          strokeWidth: u * 0.02,
        }),
      );
      out.push(circle(wx, wy, u * 0.12, "#e8e4d8", { stroke: "#c8a040", strokeWidth: u * 0.03 }));
      out.push(
        path(
          `M${n(wx)} ${n(wy)}v${n(-u * 0.07)}M${n(wx)} ${n(wy)}l${n(u * 0.05)} ${n(u * 0.02)}`,
          "none",
          { stroke: "#2a2a2a", strokeWidth: u * 0.012 },
        ),
      );
      return g(out);
    },
  });
  return portraitDoc("people/nurse-gertie", D, body);
}

/** Morty: the parlor's anatomical skeleton, one glass eye, a campaign rosette. */
function morty() {
  const D = new Defs("mo");
  const bone = "#e8e0c8";
  const boneLo = "#b8ac8c";
  const boneDeep = "#7a6e54";
  const ink = "#3a3020";
  const out = [];
  const st = { stroke: ink, strokeWidth: 1 };
  // the hook and wire he hangs from
  out.push(path("M275 0V38", "none", { stroke: "#8a8a8a", strokeWidth: 2 }));
  out.push(path("M275 38q-8 0 -8 8", "none", { stroke: "#8a8a8a", strokeWidth: 2 }));
  // spine and collarbones, ribs
  out.push(path("M266 230h18v170h-18z", boneLo, st));
  for (let y = 240; y < 400; y += 16) out.push(path(`M262 ${y}h26v10h-26z`, bone, st));
  out.push(path("M150 262Q210 244 262 250L262 260Q210 256 152 274Z", bone, st));
  out.push(path("M400 262Q340 244 288 250L288 260Q340 256 398 274Z", bone, st));
  for (let i = 0; i < 6; i++) {
    const y = 286 + i * 22;
    const w = 112 - i * 4;
    for (const sd of [-1, 1]) {
      const x0 = 275 + sd * 14;
      out.push(
        path(
          `M${x0} ${y}Q${x0 + sd * w * 0.9} ${y - 14} ${x0 + sd * w} ${y + 30}L${x0 + sd * (w - 10)} ${y + 32}Q${x0 + sd * w * 0.8} ${y - 2} ${x0} ${y + 9}Z`,
          D.lg(275 - 120, 0, 275 + 120, 0, [
            [0, bone],
            [1, boneLo],
          ]),
          st,
        ),
      );
    }
  }
  // shoulder balls
  out.push(circle(150, 272, 16, boneLo, st));
  out.push(circle(400, 272, 16, boneDeep, st));
  // the campaign rosette on the ribs
  out.push(
    path(
      scallop(
        [
          [150, 320],
          [178, 300],
          [206, 320],
          [178, 344],
        ],
        0.5,
      ),
      "#c02020",
      { stroke: "#5a0808", strokeWidth: 1 },
    ),
  );
  out.push(
    path("M168 336l-8 40l12 -8l6 12l4 -42z", "#1a3a9a", { stroke: "#0a1a4a", strokeWidth: 0.8 }),
  );
  out.push(circle(178, 322, 11, "#f4f0e0", { stroke: "#5a0808", strokeWidth: 1 }));
  out.push(lettering("VOTE", 178, 318, 6, "#c02020", { align: "middle", weight: 0.2 }));
  // skull: cranium, cheekbones, jaw with teeth
  const skull =
    "M275 48C210 48 186 96 188 144C190 176 204 192 214 200L214 216Q220 226 236 226L314 226Q330 226 336 216L336 200C346 192 360 176 362 144C364 96 340 48 275 48Z";
  out.push(
    path(
      skull,
      D.lg(188, 0, 362, 0, [
        [0, "#f4ecd8"],
        [0.5, bone],
        [1, boneLo],
      ]),
      { stroke: ink, strokeWidth: 1.4 },
    ),
  );
  out.push(
    path("M300 60C330 70 350 100 352 140", "none", {
      stroke: boneDeep,
      strokeWidth: 1,
      opacity: 0.6,
    }),
  );
  // jaw
  out.push(
    path(
      "M220 210Q222 252 248 262L302 262Q328 252 330 210Z",
      D.lg(220, 0, 330, 0, [
        [0, bone],
        [1, boneLo],
      ]),
      { stroke: ink, strokeWidth: 1.2 },
    ),
  );
  // teeth, one missing, one gold
  for (let i = 0; i < 8; i++) {
    const x = 236 + i * 10;
    const fill = i === 5 ? "#e0b030" : i === 2 ? "#2a2018" : "#f8f4e8";
    out.push(path(`M${x} 214h9v14q-4.5 4 -9 0z`, fill, { stroke: ink, strokeWidth: 0.8 }));
    out.push(
      path(`M${x} 230h9v12q-4.5 -4 -9 0z`, i === 6 ? "#2a2018" : "#f8f4e8", {
        stroke: ink,
        strokeWidth: 0.8,
      }),
    );
  }
  // eye sockets: the left empty, the right with a glass eye (a bit too blue, a bit too big)
  out.push(
    path("M216 128Q218 104 244 104Q266 106 266 130Q262 152 240 154Q218 152 216 128Z", "#1a140c", {
      stroke: ink,
      strokeWidth: 1,
    }),
  );
  out.push(
    path("M284 130Q284 106 306 104Q332 104 334 128Q332 152 310 154Q288 152 284 130Z", "#1a140c", {
      stroke: ink,
      strokeWidth: 1,
    }),
  );
  out.push(circle(309, 130, 17, "#f4f4f0", { stroke: "#8a8a80", strokeWidth: 0.8 }));
  out.push(circle(305, 130, 9, "#2a6ab0"));
  out.push(circle(305, 130, 4, "#000"));
  out.push(circle(302, 127, 2.2, "#ffffff"));
  // nose hole
  out.push(
    path("M275 156L264 186Q270 192 275 186Q280 192 286 186Z", "#1a140c", {
      stroke: ink,
      strokeWidth: 1,
    }),
  );
  // cheekbone shading
  out.push(
    path("M214 170Q236 182 252 176", "none", { stroke: boneDeep, strokeWidth: 1.4, opacity: 0.6 }),
  );
  out.push(
    path("M336 170Q314 182 298 176", "none", { stroke: boneDeep, strokeWidth: 1.4, opacity: 0.7 }),
  );
  // a crack, and the screw where the jaw is wired on
  out.push(path("M248 62l8 18l-6 10l10 14", "none", { stroke: boneDeep, strokeWidth: 1.2 }));
  out.push(circle(218, 206, 3, "#8a8a8a", { stroke: ink, strokeWidth: 0.6 }));
  out.push(circle(332, 206, 3, "#8a8a8a", { stroke: ink, strokeWidth: 0.6 }));
  return portraitDoc("people/morty", D, g(out));
}

export const pieces = [
  {
    id: "people/mayor-grubb",
    kind: "portrait",
    usedBy: "City Hall (fg), the mayor's office; name from town/cast.yaml",
    grade: "C",
    notes:
      "Mayor Hollis Grubb: jowly, comb-over, small pleased eyes, pinstripes and the chain of office.",
    render: mayor,
  },
  {
    id: "people/lucius-vane",
    kind: "portrait",
    usedBy: "the Reaper Club (fg)",
    grade: "C",
    notes:
      "Lucius Vane: gaunt, slicked hair with a widow's peak, pencil moustache, plum velvet suit, skull pin and carnation.",
    render: vane,
  },
  {
    id: "people/inspector-mudge",
    kind: "portrait",
    usedBy: "City Hall's Health Inspection (fg)",
    grade: "C",
    notes:
      "Inspector Mudge: pinched and suspicious, bowler, pince-nez, clipped moustache, clipboard.",
    render: mudge,
  },
  {
    id: "people/teller-prudence",
    kind: "portrait",
    usedBy: "the bank's savings, loans and transfers (fg over places/bank-vault)",
    grade: "C",
    notes:
      "Prudence Ledbetter: tight bun, half-moon glasses on a chain, lace collar and cameo, pursed lips.",
    render: prudence,
  },
  {
    id: "people/nurse-gertie",
    kind: "portrait",
    usedBy: "the hospital's front desk in Expanded towns (fg)",
    grade: "C",
    notes:
      "Nurse Gertie: grey curls, nurse's cap, round glasses, cardigan over the uniform, fob watch; tired and kind. The original nurse (places/hospital_desk) is a young woman, so Gertie is new.",
    render: gertie,
  },
  {
    id: "people/morty",
    kind: "portrait",
    usedBy: "Morty's story arc and the mayoral race (fg)",
    grade: "B",
    notes:
      "Morty the parlor skeleton on his hook: one glass eye, a gold tooth, a missing tooth, a wired jaw and a VOTE rosette.",
    render: morty,
  },
];
void lettering;
void rect;
void rng;
void scallop;
void shadeHex;
void P;
