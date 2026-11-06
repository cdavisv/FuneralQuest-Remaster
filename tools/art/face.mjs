/**
 * The portrait kit: a head-and-shoulders bust built the way the original portraits are, with
 * no outline on the face, flat planes of a darker or lighter skin tone, heavy-lidded almond
 * eyes, a planed nose with dark nostrils, a thin down-turned mouth and hairline wrinkles.
 *
 * Coordinates: (cx, cy) is the middle of the eye line; u is half the head's width. Every
 * feature is placed in units of u so the same face can be drawn at any size.
 */
import { circle, ellipse, g, n, path, scallop, smooth } from "./lib.mjs";
import { P } from "./palette.mjs";

export const SKINS = {
  pale: {
    hi: "#f0bca8",
    mid: P.skinPaleHi,
    lo: P.skinPale,
    deep: P.skinPaleLo,
    line: P.skinPaleLine,
    lip: "#b8615a",
    lipLo: "#8a3e38",
  },
  ruddy: {
    hi: "#f0b49c",
    mid: "#e49a80",
    lo: "#c8705a",
    deep: "#a04e3c",
    line: "#8a3e2e",
    lip: "#a84a44",
    lipLo: "#7a2e2a",
  },
  medium: {
    hi: P.skinMedHi,
    mid: P.skinMed,
    lo: "#a46e52",
    deep: P.skinMedLo,
    line: P.skinMedLine,
    lip: "#9a5048",
    lipLo: "#6a3028",
  },
  olive: {
    hi: "#d8a880",
    mid: "#c49468",
    lo: "#a07650",
    deep: "#7a5638",
    line: "#5a3a24",
    lip: "#9a5a48",
    lipLo: "#6a382a",
  },
  dark: {
    hi: P.skinDarkHi,
    mid: P.skinDark,
    lo: "#6e4834",
    deep: P.skinDarkLo,
    line: "#3a2014",
    lip: "#6a3a30",
    lipLo: "#4a2418",
  },
  deathly: {
    hi: "#e0d8c0",
    mid: "#c8c0a4",
    lo: "#a49c80",
    deep: "#7a7258",
    line: "#5a5440",
    lip: "#8a7a6a",
    lipLo: "#5a4a40",
  },
};

const P2 = (cx, cy, u) => (x, y) => [cx + x * u, cy + y * u];
const pts = (f, list) => list.map(([x, y]) => f(x, y));

/**
 * Draws one bust. Options (all optional except cx, cy, u):
 *  skin: a SKINS entry; jaw (0.7..1.2), cheek, chin (length), crown (height), neck (width)
 *  eye: iris colour; eyeOpen (0.5..1.2); lid (0..1 heaviness); droop (outer-corner drop)
 *  brow: colour; browLift (inner raise, worried), browKnit (frown); browThick
 *  nose: size (0.8..1.4); noseHook; mouth: width; smile (-1 frown .. 1 smile); lipFull
 *  age (0..1): wrinkles; jowls (0..1); stubble colour; blush
 *  hairBack / hairFront: functions (f, u, D) -> svg; clothes: function(f, u, D) -> svg
 *  glasses: { kind: "round"|"half"|"rect", y, colour }; extra: function -> svg on top
 */
export function bust(D, o) {
  const { cx, cy, u } = o;
  const f = P2(cx, cy, u);
  const sk = o.skin ?? SKINS.pale;
  const jaw = o.jaw ?? 1;
  const cheek = o.cheek ?? 1;
  const chin = o.chin ?? 1;
  const crown = o.crown ?? 1;
  const jowls = o.jowls ?? 0;
  const age = o.age ?? 0.4;
  const out = [];

  // ---- hair at the back, the neck, then clothes over the neck's base
  if (o.hairBack) out.push(o.hairBack(f, u, D));

  // ---- neck: in shadow under the jaw
  const nw = 0.6 * (o.neck ?? 1);
  const neck = smooth(
    pts(f, [
      [-nw, 0.7],
      [-nw * 1.02, 1.45],
      [-nw * 1.25, 1.95],
      [nw * 1.25, 1.95],
      [nw * 1.02, 1.45],
      [nw, 0.7],
    ]),
    false,
  );
  out.push(
    path(
      `${neck}Z`,
      D.lg(f(-nw, 0)[0], 0, f(nw, 0)[0], 0, [
        [0, sk.lo],
        [0.6, sk.lo],
        [1, sk.deep],
      ]),
    ),
  );
  out.push(
    path(
      `${smooth(
        pts(f, [
          [-nw * 1.02, 1.05],
          [0, 1.62 * chin],
          [nw * 1.02, 1.05],
        ]),
        false,
      )}Z`,
      sk.deep,
      { opacity: 0.6 },
    ),
  );

  if (o.clothes) out.push(o.clothes(f, u, D, sk));
  if (o.hairOver) out.push(o.hairOver(f, u, D));

  // ---- ears
  for (const s of [-1, 1]) {
    const ear = smooth(
      pts(f, [
        [s * 0.93, -0.12],
        [s * 1.12, -0.2],
        [s * 1.18, 0.05],
        [s * 1.12, 0.32],
        [s * 1.0, 0.5],
        [s * 0.92, 0.42],
      ]),
      true,
    );
    out.push(path(ear, s < 0 ? sk.mid : sk.lo));
    out.push(
      path(
        smooth(
          pts(f, [
            [s * 0.97, -0.05],
            [s * 1.09, -0.08],
            [s * 1.1, 0.12],
            [s * 1.04, 0.3],
            [s * 0.98, 0.36],
          ]),
          false,
        ),
        "none",
        { stroke: sk.deep, strokeWidth: u * 0.025, opacity: 0.7 },
      ),
    );
    out.push(
      path(
        smooth(
          pts(f, [
            [s * 1.0, 0.02],
            [s * 1.06, 0.1],
            [s * 1.02, 0.24],
          ]),
          false,
        ),
        "none",
        { stroke: sk.line, strokeWidth: u * 0.03, opacity: 0.5 },
      ),
    );
  }

  // ---- head
  const jw = 0.86 * jaw;
  const outline = [
    [0, -1.28 * crown],
    [0.5, -1.22 * crown],
    [0.8, -1.0 * crown],
    [0.93, -0.62],
    [0.96, -0.2],
    [0.97 * cheek, 0.18],
    [0.9 * jaw + jowls * 0.05, 0.56],
    [0.76 * jaw + jowls * 0.08, 0.9],
    [0.52 * jaw + jowls * 0.06, 1.17 * chin],
    [0.24, 1.35 * chin],
    [0, 1.4 * chin],
    [-0.24, 1.35 * chin],
    [-0.52 * jaw - jowls * 0.06, 1.17 * chin],
    [-0.76 * jaw - jowls * 0.08, 0.9],
    [-0.9 * jaw - jowls * 0.05, 0.56],
    [-0.97 * cheek, 0.18],
    [-0.96, -0.2],
    [-0.93, -0.62],
    [-0.8, -1.0 * crown],
    [-0.5, -1.22 * crown],
  ];
  // A double chin hangs below the jaw, in front of the neck.
  if (jowls > 0.3) {
    const dc = smooth(
      pts(f, [
        [-jw * 0.78, 1.0],
        [-0.5, 1.42 + jowls * 0.12],
        [0, 1.52 + jowls * 0.14],
        [0.5, 1.42 + jowls * 0.12],
        [jw * 0.78, 1.0],
      ]),
      false,
    );
    out.push(
      path(
        `${dc}Z`,
        D.lg(f(-1, 0)[0], 0, f(1, 0)[0], 0, [
          [0, sk.mid],
          [0.5, sk.lo],
          [1, sk.deep],
        ]),
      ),
    );
  }
  const head = smooth(pts(f, outline), true, 0.55);
  const headFill = D.lg(f(-1, 0)[0], 0, f(1, 0)[0], 0, [
    [0, sk.hi],
    [0.45, sk.mid],
    [1, sk.lo],
  ]);
  out.push(path(head, headFill));
  const clip = D.clip(path(head, "#000"));
  const inner = [];

  // ---- shadow planes (clipped to the head)
  // shadow side, screen right
  inner.push(
    path(
      smooth(
        pts(f, [
          [0.62, -1.3],
          [0.86, -0.5],
          [0.78, 0.15],
          [0.7, 0.75],
          [0.42, 1.3],
          [0.9, 1.5],
          [1.3, 0.4],
          [1.2, -1.3],
        ]),
        true,
      ),
      sk.lo,
      { opacity: 0.55 },
    ),
  );
  // forehead highlight, upper left
  inner.push(
    ellipse(f(-0.25, -0.8)[0], f(-0.25, -0.8)[1], u * 0.45, u * 0.25, sk.hi, { opacity: 0.45 }),
  );
  // eye sockets
  for (const s of [-1, 1]) {
    const [ex, ey] = f(s * 0.4, -0.02);
    inner.push(
      ellipse(ex, ey - u * 0.04, u * 0.3, u * 0.16, sk.lo, { opacity: s < 0 ? 0.3 : 0.45 }),
    );
  }
  // cheekbone hollows
  for (const s of [-1, 1]) {
    if (s > 0)
      inner.push(
        path(
          smooth(
            pts(f, [
              [0.88, 0.28],
              [0.66, 0.5],
              [0.6, 0.72],
              [0.7, 0.6],
              [0.92, 0.42],
            ]),
            true,
          ),
          sk.lo,
          { opacity: 0.3 + age * 0.12 },
        ),
      );
  }
  // under-jaw / jowl shading
  if (jowls > 0) {
    for (const s of [-1, 1]) {
      if (s > 0)
        inner.push(
          path(
            smooth(
              pts(f, [
                [0.5, 0.95],
                [0.66, 1.12],
                [0.9, 0.95],
                [0.86, 0.78],
              ]),
              true,
            ),
            sk.lo,
            { opacity: 0.35 * jowls },
          ),
        );
    }
  }
  // chin shadow and highlight
  inner.push(
    ellipse(f(0, 1.36 * chin)[0], f(0, 1.36 * chin)[1], u * 0.34, u * 0.1, sk.lo, { opacity: 0.4 }),
  );
  inner.push(
    ellipse(f(-0.04, 1.22 * chin)[0], f(-0.04, 1.22 * chin)[1], u * 0.14, u * 0.07, sk.hi, {
      opacity: 0.6,
    }),
  );
  // blush
  if (o.blush) {
    for (const s of [-1, 1]) {
      const [bx, by] = f(s * 0.52, 0.42);
      inner.push(
        circle(
          bx,
          by,
          u * 0.22,
          D.rg(bx, by, u * 0.22, [
            [0, o.blush, 0.55],
            [1, o.blush, 0],
          ]),
        ),
      );
    }
  }
  // stubble
  if (o.stubble) {
    const stub = smooth(
      pts(f, [
        [-0.82, 0.6],
        [-0.4, 0.82],
        [0, 0.78],
        [0.4, 0.82],
        [0.82, 0.6],
        [0.7, 1.05],
        [0.3, 1.4],
        [-0.3, 1.4],
        [-0.7, 1.05],
      ]),
      true,
    );
    inner.push(path(stub, o.stubble, { opacity: 0.28 }));
  }

  // ---- wrinkles
  const wl = {
    stroke: sk.line,
    strokeWidth: Math.max(0.4, u * 0.012),
    fill: "none",
    strokeLinecap: "round",
  };
  const wrinkle = (list, op = 0.55) =>
    inner.push(path(smooth(pts(f, list), false), "none", { ...wl, opacity: op }));
  if (age > 0.25) {
    for (let i = 0; i < Math.round(age * 4); i++) {
      const y = -0.56 - i * 0.11;
      wrinkle(
        [
          [-0.48, y + 0.03],
          [-0.2, y - 0.02],
          [0.05, y + 0.01],
          [0.3, y - 0.02],
          [0.5, y + 0.03],
        ],
        0.35 + age * 0.2,
      );
    }
  }
  // brow furrows
  if (age > 0.2 || (o.browKnit ?? 0) > 0.3) {
    wrinkle(
      [
        [-0.08, -0.18],
        [-0.1, -0.32],
        [-0.06, -0.44],
      ],
      0.5,
    );
    wrinkle(
      [
        [0.08, -0.18],
        [0.1, -0.32],
        [0.07, -0.42],
      ],
      0.5,
    );
  }
  // nasolabial folds
  const smile = o.smile ?? -0.2;
  for (const s of [-1, 1]) {
    wrinkle(
      [
        [s * 0.2, 0.5],
        [s * 0.34, 0.7],
        [s * (0.38 + Math.max(0, smile) * 0.04), 0.92],
        [s * (0.36 - smile * 0.05), 1.08],
      ],
      0.4 + age * 0.4,
    );
  }
  // crow's feet and bags
  if (age > 0.3) {
    for (const s of [-1, 1]) {
      for (let k = 0; k < 3; k++)
        wrinkle(
          [
            [s * 0.66, -0.04 + k * 0.06],
            [s * 0.76, -0.06 + k * 0.1],
          ],
          0.45,
        );
      wrinkle(
        [
          [s * 0.24, 0.12],
          [s * 0.4, 0.2],
          [s * 0.58, 0.14],
        ],
        0.4 + age * 0.3,
      );
      if (age > 0.6)
        wrinkle(
          [
            [s * 0.26, 0.2],
            [s * 0.42, 0.29],
            [s * 0.6, 0.22],
          ],
          0.35,
        );
    }
  }
  if (jowls > 0.3) {
    for (const s of [-1, 1])
      wrinkle(
        [
          [s * 0.4, 1.05],
          [s * 0.55, 1.2],
          [s * 0.72, 1.18],
        ],
        0.45,
      );
  }

  // ---- eyes
  const open = o.eyeOpen ?? 1;
  const lid = o.lid ?? 0.55;
  const droop = o.droop ?? 0.04;
  const ew = 0.19;
  const eh = 0.125 * open;
  for (const s of [-1, 1]) {
    const ex = s * 0.4;
    const ey = 0;
    const inC = [ex - s * ew, ey];
    const outC = [ex + s * ew, ey + droop];
    const topC = [ex + s * 0.02, ey - eh * 1.9];
    const botC = [ex - s * 0.02, ey + eh * 1.0];
    const [ix, iy] = f(...inC);
    const [ox, oy] = f(...outC);
    const [tx, ty] = f(...topC);
    const [bx, by] = f(...botC);
    const almond = `M${n(ix)} ${n(iy)}Q${n(tx)} ${n(ty)} ${n(ox)} ${n(oy)}Q${n(bx)} ${n(by)} ${n(ix)} ${n(iy)}Z`;
    const eclip = D.clip(path(almond, "#000"));
    const [mx, my] = f(ex + s * 0.01 + (o.look ?? 0) * 0.05, ey + 0.005);
    const ir = u * 0.078 * Math.min(1.1, 0.8 + open * 0.25);
    const eyeParts = [
      path(
        almond,
        D.lg(0, ty, 0, by, [
          [0, P.eyeWhiteLo],
          [0.55, P.eyeWhite],
          [1, "#d8d0c8"],
        ]),
      ),
      circle(mx, my, ir, o.eye ?? P.irisBlue),
      circle(mx, my, ir, "none", { stroke: "#1a1a1a", strokeWidth: u * 0.012, opacity: 0.5 }),
      circle(mx, my, ir * 0.45, P.pupil),
      circle(mx - ir * 0.35, my - ir * 0.35, ir * 0.22, "#ffffff", { opacity: 0.85 }),
      // the upper lid's shadow on the eyeball
      path(
        `M${n(ix)} ${n(iy)}Q${n(tx)} ${n(ty)} ${n(ox)} ${n(oy)}L${n(ox)} ${n(oy - u * 0.2)}L${n(ix)} ${n(iy - u * 0.2)}Z`,
        "#000",
        { opacity: 0.18, transform: `translate(0 ${n(u * 0.03)})` },
      ),
    ];
    inner.push(g(eyeParts, { clipPath: eclip }));
    // heavy lid: a skin-coloured shape that comes down over the top of the iris
    const lidY = ty + (my - ty) * (0.35 + lid * 0.45);
    const lidPath = `M${n(ix - s * u * 0.02)} ${n(iy - u * 0.01)}Q${n(tx)} ${n(ty - u * 0.08)} ${n(ox + s * u * 0.02)} ${n(oy - u * 0.005)}Q${n(tx)} ${n(lidY + u * 0.03)} ${n(ix - s * u * 0.02)} ${n(iy - u * 0.01)}Z`;
    inner.push(g(path(lidPath, s < 0 ? sk.mid : sk.lo), { clipPath: eclip }));
    // lid line (dark, tapered) and crease
    inner.push(
      path(
        `M${n(ix)} ${n(iy)}Q${n(tx)} ${n(lidY - u * 0.02)} ${n(ox)} ${n(oy)}Q${n(tx)} ${n(lidY + u * 0.025)} ${n(ix)} ${n(iy)}Z`,
        "#2a1a14",
        { opacity: 0.85 },
      ),
    );
    inner.push(
      path(
        `M${n(ix - s * u * 0.03)} ${n(iy - u * 0.04)}Q${n(tx)} ${n(ty - u * 0.1)} ${n(ox + s * u * 0.04)} ${n(oy - u * 0.02)}`,
        "none",
        { ...wl, opacity: 0.6 },
      ),
    );
    // lower lid
    inner.push(
      path(`M${n(ix)} ${n(iy)}Q${n(bx)} ${n(by + u * 0.01)} ${n(ox)} ${n(oy)}`, "none", {
        stroke: sk.line,
        strokeWidth: u * 0.012,
        opacity: 0.55,
      }),
    );
    // brow
    const lift = o.browLift ?? 0.4;
    const knit = o.browKnit ?? 0;
    const bt = 0.06 * (o.browThick ?? 1);
    const bi = [ex - s * 0.24, -0.2 - lift * 0.08 + knit * 0.06];
    const bm = [ex + s * 0.02, -0.27 - lift * 0.02 - knit * 0.02];
    const bo = [ex + s * 0.28, -0.17 + lift * 0.04];
    const brow = smooth(
      pts(f, [
        bi,
        bm,
        bo,
        [bo[0] - s * 0.02, bo[1] + bt * 0.25],
        [bm[0], bm[1] + bt],
        [bi[0], bi[1] + bt * 1.2],
      ]),
      true,
      0.4,
    );
    inner.push(path(brow, o.brow ?? P.hairBrownLo, { opacity: 0.92 }));
  }

  // ---- nose
  const ns = o.nose ?? 1;
  const hook = o.noseHook ?? 0;
  inner.push(
    path(
      smooth(
        pts(f, [
          [0.04, -0.12],
          [0.1 * ns, 0.2],
          [0.17 * ns + hook * 0.04, 0.48],
          [0.2 * ns, 0.6],
          [0.06, 0.62],
          [0.06, 0.3],
        ]),
        true,
      ),
      sk.lo,
      { opacity: 0.55 },
    ),
  );
  inner.push(
    path(
      smooth(
        pts(f, [
          [-0.05, -0.1],
          [-0.08 * ns, 0.2],
          [-0.1 * ns, 0.45],
        ]),
        false,
      ),
      "none",
      { stroke: sk.hi, strokeWidth: u * 0.05, opacity: 0.6, strokeLinecap: "round" },
    ),
  );
  const [tipx, tipy] = f(-0.01 + hook * 0.02, 0.54 + hook * 0.04);
  inner.push(ellipse(tipx, tipy, u * 0.11 * ns, u * 0.085 * ns, sk.mid));
  inner.push(
    ellipse(tipx - u * 0.03, tipy - u * 0.025, u * 0.05 * ns, u * 0.03 * ns, sk.hi, {
      opacity: 0.8,
    }),
  );
  for (const s of [-1, 1]) {
    // wings
    inner.push(
      path(
        smooth(
          pts(f, [
            [s * 0.1 * ns, 0.44],
            [s * 0.2 * ns, 0.52],
            [s * 0.19 * ns, 0.63],
            [s * 0.1 * ns, 0.66],
          ]),
          false,
        ),
        "none",
        { stroke: sk.line, strokeWidth: u * 0.018, opacity: 0.6 },
      ),
    );
    // nostrils
    const [nx, ny] = f(s * 0.085 * ns, 0.645 + hook * 0.02);
    inner.push(
      ellipse(nx, ny, u * 0.038 * ns, u * 0.018 * ns, sk.line, {
        transform: `rotate(${s * 20} ${n(nx)} ${n(ny)})`,
        opacity: 0.95,
      }),
    );
  }
  inner.push(ellipse(f(0, 0.72)[0], f(0, 0.72)[1], u * 0.16, u * 0.05, sk.lo, { opacity: 0.45 }));

  // ---- mouth
  const mw = 0.26 * (o.mouth ?? 1);
  const my0 = 0.94;
  const full = o.lipFull ?? 1;
  const cornerY = my0 - smile * 0.06;
  const lip = o.lipColour ?? sk.lip;
  const lipLo = o.lipColourLo ?? sk.lipLo;
  const upper = smooth(
    pts(f, [
      [-mw, cornerY],
      [-mw * 0.45, my0 - 0.05 * full],
      [-0.03, my0 - 0.035 * full],
      [0, my0 - 0.03 * full],
      [0.03, my0 - 0.035 * full],
      [mw * 0.45, my0 - 0.05 * full],
      [mw, cornerY],
      [mw * 0.4, my0 + 0.005],
      [-mw * 0.4, my0 + 0.005],
    ]),
    true,
    0.45,
  );
  const lower = smooth(
    pts(f, [
      [-mw * 0.92, cornerY + 0.005],
      [-mw * 0.4, my0 + 0.005],
      [mw * 0.4, my0 + 0.005],
      [mw * 0.92, cornerY + 0.005],
      [mw * 0.5, my0 + 0.085 * full],
      [-mw * 0.5, my0 + 0.085 * full],
    ]),
    true,
    0.5,
  );
  inner.push(
    path(
      lower,
      D.lg(0, f(0, my0)[1], 0, f(0, my0 + 0.09)[1], [
        [0, lipLo],
        [0.4, lip],
        [1, lip],
      ]),
    ),
  );
  inner.push(
    ellipse(
      f(-0.05, my0 + 0.045)[0],
      f(-0.05, my0 + 0.045)[1],
      u * mw * 0.32,
      u * 0.018,
      "#ffffff",
      { opacity: 0.18 },
    ),
  );
  inner.push(path(upper, lipLo));
  if (o.teeth) {
    const tpath = smooth(
      pts(f, [
        [-mw * 0.7, my0 + 0.0],
        [0, my0 - 0.012],
        [mw * 0.7, my0 + 0.0],
        [mw * 0.5, my0 + 0.035],
        [-mw * 0.5, my0 + 0.035],
      ]),
      true,
      0.5,
    );
    inner.push(path(tpath, o.teeth));
  }
  inner.push(
    path(
      smooth(
        pts(f, [
          [-mw * 1.02, cornerY + 0.005],
          [-mw * 0.4, my0 + 0.012],
          [0, my0 + 0.008],
          [mw * 0.4, my0 + 0.012],
          [mw * 1.02, cornerY + 0.005],
        ]),
        false,
      ),
      "none",
      { stroke: "#2a100c", strokeWidth: u * 0.018, opacity: 0.85, strokeLinecap: "round" },
    ),
  );
  inner.push(
    ellipse(f(0, my0 + 0.15)[0], f(0, my0 + 0.15)[1], u * mw * 0.6, u * 0.04, sk.lo, {
      opacity: 0.45,
    }),
  );

  out.push(g(inner, { clipPath: clip }));

  // ---- hair in front, glasses, extras
  if (o.hairFront) out.push(o.hairFront(f, u, D));
  if (o.glasses) out.push(glasses(f, u, o.glasses));
  if (o.extra) out.push(o.extra(f, u, D, sk));
  return g(out);
}

/** Spectacles on the eye line. kind: round | half | rect. */
export function glasses(f, u, { kind = "round", y = 0.02, colour = "#2a2a2a", lens = null }) {
  const out = [];
  const st = {
    stroke: colour,
    strokeWidth: u * 0.035,
    fill: lens ?? "none",
    strokeLinejoin: "round",
  };
  for (const s of [-1, 1]) {
    const [x, yy] = f(s * 0.42, y);
    if (kind === "round") out.push(ellipse(x, yy, u * 0.24, u * 0.19, lens ?? "none", st));
    else if (kind === "rect")
      out.push(
        path(
          `M${n(x - u * 0.26)} ${n(yy - u * 0.15)}H${n(x + u * 0.26)}V${n(yy + u * 0.14)}Q${n(x)} ${n(yy + u * 0.2)} ${n(x - u * 0.26)} ${n(yy + u * 0.14)}Z`,
          lens ?? "none",
          st,
        ),
      );
    else
      out.push(
        path(
          `M${n(x - u * 0.25)} ${n(yy)}H${n(x + u * 0.25)}Q${n(x + u * 0.24)} ${n(yy + u * 0.18)} ${n(x)} ${n(yy + u * 0.18)}Q${n(x - u * 0.24)} ${n(yy + u * 0.18)} ${n(x - u * 0.25)} ${n(yy)}Z`,
          lens ?? "none",
          st,
        ),
      );
    // arm to the ear
    const [ax, ay] = f(s * 0.66, y - 0.02);
    const [ex, ey] = f(s * 1.0, y - 0.06);
    out.push(
      path(`M${n(ax)} ${n(ay)}L${n(ex)} ${n(ey)}`, "none", {
        stroke: colour,
        strokeWidth: u * 0.03,
      }),
    );
    // a glint
    out.push(
      path(`M${n(x - u * 0.14)} ${n(yy - u * 0.06)}l${n(u * 0.08)} ${n(-u * 0.06)}`, "none", {
        stroke: "#ffffff",
        strokeWidth: u * 0.025,
        opacity: 0.6,
        strokeLinecap: "round",
      }),
    );
  }
  const [b1x, b1y] = f(-0.18, y - 0.02);
  const [b2x, b2y] = f(0.18, y - 0.02);
  out.push(
    path(
      `M${n(b1x)} ${n(b1y)}Q${n((b1x + b2x) / 2)} ${n(b1y - u * 0.06)} ${n(b2x)} ${n(b2y)}`,
      "none",
      { stroke: colour, strokeWidth: u * 0.03 },
    ),
  );
  return g(out);
}

/**
 * Shoulders and a garment. kind: suit | cardigan | blouse | uniform | jacket | overalls | sweater.
 * c: main colour; c2: accent (shirt, tie, collar).
 */
export function garment(
  D,
  { kind = "suit", c = P.suit, c2 = P.shirt, tie = P.tieBlue, wide = 1, top = 1.78 },
) {
  return (f, u) => {
    const out = [];
    const W = 2.25 * wide;
    const shoulders = smooth(
      pts(f, [
        [-W, 3.4],
        [-W * 0.98, top + 0.95],
        [-W * 0.8, top + 0.42],
        [-W * 0.5, top + 0.12],
        [-0.6, top - 0.08],
        [0.6, top - 0.08],
        [W * 0.5, top + 0.12],
        [W * 0.8, top + 0.42],
        [W * 0.98, top + 0.95],
        [W, 3.4],
      ]),
      true,
      0.5,
    );
    const fill = D.lg(f(-W, 0)[0], 0, f(W, 0)[0], 0, [
      [0, shadeHex(c, -0.12)],
      [0.45, c],
      [1, shadeHex(c, 0.35)],
    ]);
    out.push(path(shoulders, fill));
    // fold lines on the sleeves
    for (const s of [-1, 1]) {
      out.push(
        path(
          smooth(
            pts(f, [
              [s * W * 0.72, top + 0.55],
              [s * W * 0.8, top + 0.95],
              [s * W * 0.78, 3.4],
            ]),
            false,
          ),
          "none",
          { stroke: shadeHex(c, 0.45), strokeWidth: u * 0.02, opacity: 0.6 },
        ),
      );
    }
    if (kind === "suit" || kind === "jacket") {
      // shirt V, collar points, tie, lapels
      out.push(
        path(
          `${smooth(
            pts(f, [
              [-0.62, top - 0.08],
              [0, top + 0.95],
              [0.62, top - 0.08],
            ]),
            false,
          )}Z`,
          c2,
        ),
      );
      for (const s of [-1, 1])
        out.push(
          path(
            smooth(
              pts(f, [
                [s * 0.05, top + 0.1],
                [s * 0.5, top - 0.12],
                [s * 0.42, top + 0.32],
              ]),
              true,
              0.2,
            ),
            shadeHex(c2, 0.1),
            { stroke: shadeHex(c2, 0.35), strokeWidth: u * 0.012 },
          ),
        );
      if (tie) {
        out.push(
          path(
            smooth(
              pts(f, [
                [-0.1, top + 0.12],
                [0.1, top + 0.12],
                [0.08, top + 0.28],
                [-0.08, top + 0.28],
              ]),
              true,
              0.2,
            ),
            tie,
          ),
        );
        out.push(
          path(
            smooth(
              pts(f, [
                [-0.07, top + 0.28],
                [0.07, top + 0.28],
                [0.17, top + 1.3],
                [0, 3.45],
                [-0.17, top + 1.3],
              ]),
              true,
              0.25,
            ),
            D.lg(f(-0.17, 0)[0], 0, f(0.17, 0)[0], 0, [
              [0, shadeHex(tie, -0.15)],
              [1, shadeHex(tie, 0.3)],
            ]),
          ),
        );
      }
      for (const s of [-1, 1]) {
        const lap = smooth(
          pts(f, [
            [s * 0.6, top - 0.1],
            [s * 0.18, top + 0.95],
            [s * 0.3, 3.45],
            [s * 0.85, 3.45],
            [s * 0.55, top + 0.75],
            [s * 0.86, top + 0.55],
            [s * 0.72, top + 0.08],
          ]),
          true,
          0.3,
        );
        out.push(
          path(
            lap,
            D.lg(f(s * 0.2, 0)[0], 0, f(s * 0.9, 0)[0], 0, [
              [0, shadeHex(c, s < 0 ? -0.18 : 0.1)],
              [1, shadeHex(c, s < 0 ? 0 : 0.3)],
            ]),
            { stroke: shadeHex(c, 0.5), strokeWidth: u * 0.015 },
          ),
        );
      }
    } else if (kind === "cardigan" || kind === "sweater") {
      out.push(
        path(
          `${smooth(
            pts(f, [
              [-0.62, top - 0.06],
              [0, top + 0.5],
              [0.62, top - 0.06],
            ]),
            false,
          )}Z`,
          c2,
        ),
      );
      out.push(
        path(
          smooth(
            pts(f, [
              [-0.7, top - 0.1],
              [0, top + 0.62],
              [0.7, top - 0.1],
            ]),
            false,
          ),
          "none",
          { stroke: shadeHex(c, 0.35), strokeWidth: u * 0.07 },
        ),
      );
      if (kind === "cardigan") {
        out.push(
          path(
            smooth(
              pts(f, [
                [0, top + 0.6],
                [0.02, 3.45],
              ]),
              false,
            ),
            "none",
            { stroke: shadeHex(c, 0.4), strokeWidth: u * 0.03 },
          ),
        );
        for (const y of [top + 0.85, top + 1.2])
          out.push(
            circle(f(0.08, y)[0], f(0.08, y)[1], u * 0.045, shadeHex(c, -0.3), {
              stroke: shadeHex(c, 0.5),
              strokeWidth: u * 0.01,
            }),
          );
      }
    } else if (kind === "blouse" || kind === "uniform") {
      out.push(
        path(
          `${smooth(
            pts(f, [
              [-0.5, top - 0.06],
              [0, top + 0.4],
              [0.5, top - 0.06],
            ]),
            false,
          )}Z`,
          shadeHex(c, 0.15),
        ),
      );
      for (const s of [-1, 1]) {
        out.push(
          path(
            smooth(
              pts(f, [
                [s * 0.02, top + 0.38],
                [s * 0.55, top - 0.12],
                [s * 0.82, top + 0.12],
                [s * 0.4, top + 0.52],
              ]),
              true,
              0.25,
            ),
            c2,
            { stroke: shadeHex(c2, 0.35), strokeWidth: u * 0.015 },
          ),
        );
      }
      if (kind === "uniform") {
        for (const y of [top + 0.75, top + 1.1])
          out.push(
            circle(f(0, y)[0], f(0, y)[1], u * 0.04, "#ffffff", {
              stroke: "#8a8a8a",
              strokeWidth: u * 0.01,
            }),
          );
      }
    } else if (kind === "overalls") {
      out.push(
        path(
          `${smooth(
            pts(f, [
              [-0.62, top - 0.06],
              [0, top + 0.3],
              [0.62, top - 0.06],
            ]),
            false,
          )}Z`,
          shadeHex(c2, 0.1),
        ),
      );
      for (const s of [-1, 1])
        out.push(
          path(
            smooth(
              pts(f, [
                [s * 0.55, top - 0.02],
                [s * 0.72, top + 0.1],
                [s * 0.6, 3.45],
                [s * 0.35, 3.45],
              ]),
              true,
              0.2,
            ),
            "#4a5a7a",
            { stroke: "#2a3448", strokeWidth: u * 0.015 },
          ),
        );
      out.push(
        path(
          smooth(
            pts(f, [
              [-0.75, top + 1.15],
              [0.75, top + 1.15],
              [0.8, 3.45],
              [-0.8, 3.45],
            ]),
            true,
            0.1,
          ),
          "#4a5a7a",
          { stroke: "#2a3448", strokeWidth: u * 0.015 },
        ),
      );
      for (const s of [-1, 1])
        out.push(
          circle(f(s * 0.55, top + 1.18)[0], f(s * 0.55, top + 1.18)[1], u * 0.05, "#c8b060", {
            stroke: "#5a4a20",
            strokeWidth: u * 0.01,
          }),
        );
    }
    return g(out);
  };
}

/** Lighten (k < 0) or darken (k > 0) a hex colour. */
export function shadeHex(c, k) {
  const s = c.replace("#", "");
  const h = s.length === 3 ? s.replace(/./g, (x) => x + x) : s;
  const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const out = rgb.map((v) => Math.round(k >= 0 ? v * (1 - k) : v + (255 - v) * -k));
  return `#${out.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("")}`;
}

export { pts };

// ---------------------------------------------------------------- hair and hats

/** Hair slicked straight back from a widow's peak, glossy. */
export function slicked(D, c, hi, peak = 0.12) {
  return {
    back: (f, _u) =>
      path(
        smooth(
          pts(f, [
            [-0.98, -0.2],
            [-1.02, -0.9],
            [-0.6, -1.36],
            [0, -1.44],
            [0.6, -1.36],
            [1.02, -0.9],
            [0.98, -0.2],
            [0.9, 0.0],
            [-0.9, 0.0],
          ]),
          true,
        ),
        c,
      ),
    front: (f, u) => {
      const out = [];
      const cap = smooth(
        pts(f, [
          [-0.97, -0.25],
          [-0.9, -0.62],
          [-0.55, -0.7],
          [-0.2, -0.66],
          [0, -0.66 + peak],
          [0.2, -0.66],
          [0.55, -0.7],
          [0.9, -0.62],
          [0.97, -0.25],
          [1.0, -0.9],
          [0.62, -1.36],
          [0, -1.44],
          [-0.62, -1.36],
          [-1.0, -0.9],
        ]),
        true,
        0.4,
      );
      out.push(
        path(
          cap,
          D.lg(f(-1, 0)[0], 0, f(1, 0)[0], 0, [
            [0, shadeHex(c, -0.25)],
            [0.5, c],
            [1, shadeHex(c, 0.4)],
          ]),
        ),
      );
      for (let i = 0; i < 6; i++) {
        const x = -0.7 + i * 0.28;
        out.push(
          path(
            smooth(
              pts(f, [
                [x * 0.9, -0.66],
                [x * 1.05, -1.0],
                [x * 0.7, -1.36],
              ]),
              false,
            ),
            "none",
            { stroke: hi, strokeWidth: u * 0.022, opacity: 0.55, strokeLinecap: "round" },
          ),
        );
      }
      return g(out);
    },
  };
}

/** A tight bun on top, hair swept up from the face. */
export function bun(D, c, hi) {
  return {
    back: (f, u) => {
      const [bx, by] = f(0, -1.38);
      return g([
        circle(
          bx,
          by,
          u * 0.36,
          D.lg(bx - u * 0.36, 0, bx + u * 0.36, 0, [
            [0, shadeHex(c, -0.2)],
            [1, shadeHex(c, 0.35)],
          ]),
        ),
        path(`M${n(bx - u * 0.3)} ${n(by)}q${n(u * 0.3)} ${n(-u * 0.2)} ${n(u * 0.6)} 0`, "none", {
          stroke: hi,
          strokeWidth: u * 0.02,
          opacity: 0.6,
        }),
        path(
          `M${n(bx - u * 0.26)} ${n(by + u * 0.12)}q${n(u * 0.26)} ${n(-u * 0.16)} ${n(u * 0.52)} 0`,
          "none",
          { stroke: hi, strokeWidth: u * 0.02, opacity: 0.5 },
        ),
      ]);
    },
    front: (f, u) => {
      const out = [];
      const cap = smooth(
        pts(f, [
          [-0.99, -0.1],
          [-0.94, -0.5],
          [-0.6, -0.78],
          [0, -0.82],
          [0.6, -0.78],
          [0.94, -0.5],
          [0.99, -0.1],
          [1.02, -0.85],
          [0.6, -1.34],
          [0, -1.42],
          [-0.6, -1.34],
          [-1.02, -0.85],
        ]),
        true,
        0.45,
      );
      out.push(
        path(
          cap,
          D.lg(f(-1, 0)[0], 0, f(1, 0)[0], 0, [
            [0, shadeHex(c, -0.2)],
            [0.5, c],
            [1, shadeHex(c, 0.4)],
          ]),
        ),
      );
      for (let i = 0; i < 7; i++) {
        const x = -0.85 + i * 0.28;
        out.push(
          path(
            smooth(
              pts(f, [
                [x, -0.72 - Math.abs(x) * 0.1],
                [x * 0.7, -1.1],
                [x * 0.3, -1.36],
              ]),
              false,
            ),
            "none",
            { stroke: hi, strokeWidth: u * 0.018, opacity: 0.5 },
          ),
        );
      }
      return g(out);
    },
  };
}

/** Tight grey curls around the head (people/f_old's hair). */
export function curls(D, c, lo, R, { top = -1.5, side = 1.12, low = 0.15 } = {}) {
  const ring = [];
  const N = 22;
  for (let i = 0; i < N; i++) {
    const a = Math.PI * (0.98 + (i / (N - 1)) * 1.04);
    ring.push([Math.cos(a) * side, -0.35 + Math.sin(a) * (-top - 0.35)]);
  }
  const shape = [
    [side * 0.98, low],
    ...ring.reverse(),
    [-side * 0.98, low],
    [-0.86, -0.55],
    [-0.4, -0.78],
    [0.4, -0.78],
    [0.86, -0.55],
  ];
  return {
    back: (f, _u) =>
      path(
        scallop(pts(f, shape), 0.42, R),
        D.lg(f(-1.2, 0)[0], 0, f(1.2, 0)[0], 0, [
          [0, shadeHex(c, -0.3)],
          [0.6, c],
          [1, lo],
        ]),
      ),
    front: (f, u) => {
      const out = [];
      const fringe = [
        [-0.92, -0.45],
        [-0.78, -0.9],
        [-0.4, -1.06],
        [0, -1.1],
        [0.4, -1.06],
        [0.78, -0.9],
        [0.92, -0.45],
        [0.7, -0.62],
        [0.35, -0.74],
        [0, -0.78],
        [-0.35, -0.74],
        [-0.7, -0.62],
      ];
      out.push(
        path(
          scallop(pts(f, fringe), 0.5, R),
          D.lg(f(-1, 0)[0], 0, f(1, 0)[0], 0, [
            [0, shadeHex(c, -0.35)],
            [0.6, c],
            [1, lo],
          ]),
        ),
      );
      for (let i = 0; i < 9; i++) {
        const [x, y] = f(-0.75 + i * 0.19, -0.92 + Math.abs(-0.75 + i * 0.19) * 0.2);
        out.push(
          path(
            `M${n(x - u * 0.06)} ${n(y)}q${n(u * 0.06)} ${n(-u * 0.07)} ${n(u * 0.12)} 0`,
            "none",
            { stroke: lo, strokeWidth: u * 0.018, opacity: 0.5 },
          ),
        );
      }
      return g(out);
    },
  };
}

/** A hat brim and crown sitting on the head. kind: bowler | cap | church | nurse. */
export function hat(D, kind, c, c2) {
  return (f, u) => {
    const out = [];
    if (kind === "bowler") {
      out.push(
        path(
          smooth(
            pts(f, [
              [-1.22, -0.64],
              [0, -0.78],
              [1.22, -0.64],
              [1.1, -0.52],
              [0, -0.6],
              [-1.1, -0.52],
            ]),
            true,
            0.4,
          ),
          shadeHex(c, 0.2),
        ),
      );
      out.push(
        path(
          smooth(
            pts(f, [
              [-0.88, -0.68],
              [-0.92, -1.1],
              [-0.5, -1.48],
              [0, -1.54],
              [0.5, -1.48],
              [0.92, -1.1],
              [0.88, -0.68],
            ]),
            true,
            0.5,
          ),
          D.lg(f(-0.9, 0)[0], 0, f(0.9, 0)[0], 0, [
            [0, shadeHex(c, -0.3)],
            [0.5, c],
            [1, shadeHex(c, 0.4)],
          ]),
        ),
      );
      out.push(
        path(
          smooth(
            pts(f, [
              [-0.9, -0.8],
              [0, -0.86],
              [0.9, -0.8],
              [0.9, -0.68],
              [0, -0.74],
              [-0.9, -0.68],
            ]),
            true,
            0.3,
          ),
          c2 ?? shadeHex(c, 0.5),
        ),
      );
      out.push(
        path(
          smooth(
            pts(f, [
              [-0.5, -1.5],
              [-0.62, -1.2],
            ]),
            false,
          ),
          "none",
          { stroke: "#ffffff", strokeWidth: u * 0.04, opacity: 0.25, strokeLinecap: "round" },
        ),
      );
    } else if (kind === "cap") {
      out.push(
        path(
          smooth(
            pts(f, [
              [-1.0, -0.62],
              [-0.98, -1.1],
              [-0.5, -1.46],
              [0, -1.52],
              [0.5, -1.46],
              [0.98, -1.1],
              [1.0, -0.62],
            ]),
            true,
            0.5,
          ),
          D.lg(f(-1, 0)[0], 0, f(1, 0)[0], 0, [
            [0, shadeHex(c, -0.2)],
            [0.5, c],
            [1, shadeHex(c, 0.4)],
          ]),
        ),
      );
      out.push(
        path(
          smooth(
            pts(f, [
              [-0.9, -0.62],
              [0, -0.74],
              [0.9, -0.62],
              [0.7, -0.34],
              [0, -0.42],
              [-0.7, -0.34],
            ]),
            true,
            0.4,
          ),
          shadeHex(c, 0.25),
        ),
      );
      out.push(
        path(
          smooth(
            pts(f, [
              [-0.9, -0.62],
              [0, -0.74],
              [0.9, -0.62],
            ]),
            false,
          ),
          "none",
          { stroke: shadeHex(c, 0.5), strokeWidth: u * 0.02 },
        ),
      );
      if (c2)
        out.push(
          path(
            smooth(
              pts(f, [
                [-0.32, -1.3],
                [0.32, -1.3],
                [0.3, -0.95],
                [-0.3, -0.95],
              ]),
              true,
              0.2,
            ),
            c2,
          ),
        );
    } else if (kind === "church") {
      out.push(
        path(
          smooth(
            pts(f, [
              [-1.7, -0.7],
              [-0.9, -0.98],
              [0, -1.04],
              [0.9, -0.98],
              [1.7, -0.7],
              [1.3, -0.56],
              [0, -0.7],
              [-1.3, -0.56],
            ]),
            true,
            0.45,
          ),
          D.lg(f(-1.7, 0)[0], 0, f(1.7, 0)[0], 0, [
            [0, shadeHex(c, -0.2)],
            [0.5, c],
            [1, shadeHex(c, 0.4)],
          ]),
        ),
      );
      out.push(
        path(
          smooth(
            pts(f, [
              [-0.82, -0.9],
              [-0.8, -1.38],
              [0, -1.56],
              [0.8, -1.38],
              [0.82, -0.9],
            ]),
            true,
            0.5,
          ),
          D.lg(f(-0.9, 0)[0], 0, f(0.9, 0)[0], 0, [
            [0, shadeHex(c, -0.25)],
            [1, shadeHex(c, 0.35)],
          ]),
        ),
      );
      out.push(
        path(
          smooth(
            pts(f, [
              [-0.82, -1.0],
              [0, -1.1],
              [0.82, -1.0],
              [0.82, -1.14],
              [0, -1.24],
              [-0.82, -1.14],
            ]),
            true,
            0.3,
          ),
          c2 ?? "#2a2a2a",
        ),
      );
    } else if (kind === "nurse") {
      out.push(
        path(
          smooth(
            pts(f, [
              [-0.7, -0.92],
              [-0.62, -1.38],
              [0, -1.46],
              [0.62, -1.38],
              [0.7, -0.92],
              [0, -1.02],
            ]),
            true,
            0.35,
          ),
          D.lg(f(-0.7, 0)[0], 0, f(0.7, 0)[0], 0, [
            [0, "#ffffff"],
            [1, "#c8d0d8"],
          ]),
          { stroke: "#8a96a4", strokeWidth: u * 0.012 },
        ),
      );
      const [x, y] = f(0, -1.22);
      out.push(
        path(
          `M${n(x - u * 0.06)} ${n(y)}h${n(u * 0.12)}M${n(x)} ${n(y - u * 0.06)}v${n(u * 0.12)}`,
          "none",
          { stroke: "#c02020", strokeWidth: u * 0.045 },
        ),
      );
    }
    return g(out);
  };
}
