/**
 * Scene pictures for the places of docs/expanded-rules.md sections 30 and 31 that had to
 * borrow an unrelated picture: the Florist, the Town Gazette, the Coroner, the Health
 * Department, the Pawn Shop and Mourne & Sons. (The Police Station keeps the original
 * places/funeral_enemy_police, a squad car at a funeral home, and the Crematorium keeps
 * places/creamation_oven; both already fit.) Flat interiors seen almost straight on, in the manner
 * of places/parlor-office and places/prep-table: gradient walls, one-unit warm-black outlines on
 * objects, the middle third left calm for the fg portrait.
 */
import { lettering } from "../font.mjs";
import { circle, Defs, doc, ellipse, n, path, rect, rng, shade, tint } from "../lib.mjs";
import { P } from "../palette.mjs";

const ink = (w = 1) => ({ stroke: P.ink, strokeWidth: w, strokeLinejoin: "round" });
const lg = (D, x1, y1, x2, y2, a, b, c) =>
  D.lg(
    x1,
    y1,
    x2,
    y2,
    c
      ? [
          [0, a],
          [0.5, b],
          [1, c],
        ]
      : [
          [0, a],
          [1, b],
        ],
  );

/** A bloom: petals round a centre, with an optional stem to the ground. */
function bloom(x, y, r, c, centre = "#f4c020") {
  const out = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.3;
    out.push(
      circle(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.5, c, {
        stroke: shade(c, 0.35),
        strokeWidth: 0.5,
      }),
    );
  }
  out.push(circle(x, y, r * 0.38, centre));
  return out.join("");
}

function vase(D, x, y, w, h, c, blooms, R) {
  const out = [];
  // stems first
  for (const [dx, dy, col] of blooms) {
    out.push(
      path(
        `M${n(x)} ${n(y - h * 0.8)}Q${n(x + dx * 0.4)} ${n(y - h - dy * 0.5)} ${n(x + dx)} ${n(y - h - dy)}`,
        "none",
        {
          stroke: "#3a6a32",
          strokeWidth: 1.6,
        },
      ),
    );
    void col;
  }
  out.push(
    path(
      `M${n(x - w * 0.35)} ${n(y - h)}Q${n(x - w * 0.6)} ${n(y - h * 0.4)} ${n(x - w * 0.4)} ${n(y)}H${n(x + w * 0.4)}Q${n(x + w * 0.6)} ${n(y - h * 0.4)} ${n(x + w * 0.35)} ${n(y - h)}Z`,
      lg(D, x - w / 2, 0, x + w / 2, 0, tint(c, 0.3), shade(c, 0.3)),
      ink(0.9),
    ),
  );
  for (const [dx, dy, col] of blooms) out.push(bloom(x + dx, y - h - dy, 6 + R.next() * 3, col));
  return out.join("");
}

/* ------------------------------------------------------------------------------------------ */

/** The Florist: a pink shop with shelves of cut flowers, a striped awning window and a counter. */
function floristShop() {
  const D = new Defs("pfl");
  const R = rng(31);
  const out = [];
  // wallpaper with a stripe
  out.push(rect(0, 0, 550, 400, lg(D, 0, 0, 550, 0, "#e8b4c2", "#f6d2da", "#d89aae")));
  let stripes = "";
  for (let x = 18; x < 550; x += 36) stripes += `M${x} 0V290`;
  out.push(path(stripes, "none", { stroke: "#f8e2e6", strokeWidth: 10, opacity: 0.5 }));
  // dado rail and green panelling
  out.push(rect(0, 270, 550, 130, lg(D, 0, 270, 0, 400, "#5a8a58", "#2f5a34")));
  out.push(rect(0, 266, 550, 7, "#f2e8d8", ink(0.8)));
  for (let x = 20; x < 550; x += 90)
    out.push(rect(x, 286, 70, 90, "none", { stroke: "#8cba84", strokeWidth: 1.2 }));
  // the shop window at the back: street through striped awning
  out.push(rect(190, 40, 170, 120, lg(D, 0, 40, 0, 160, "#bcd8e8", "#e8f0e8"), ink(1.2)));
  out.push(path("M190 110Q240 96 275 108Q320 96 360 110V160H190Z", "#9ab88a", { opacity: 0.7 }));
  out.push(rect(184, 34, 182, 8, "#f6ece0", ink(1)));
  for (let i = 0; i < 9; i++)
    out.push(
      path(`M${184 + i * 20.2} 42h20.2l-4 26h-12.2z`, i % 2 ? "#ffffff" : "#d8386e", ink(0.8)),
    );
  out.push(path("M184 68h182", "none", { stroke: P.ink, strokeWidth: 1 }));
  // hanging baskets
  for (const x of [110, 440]) {
    out.push(path(`M${x} 0V44`, "none", { stroke: "#3a2a1a", strokeWidth: 1.4 }));
    out.push(path(`M${x - 30} 56Q${x} 80 ${x + 30} 56Z`, "#8a6a3a", ink(1)));
    for (let k = -2; k <= 2; k++)
      out.push(
        bloom(
          x + k * 11,
          50 + Math.abs(k) * 1.5,
          7,
          ["#f04a6a", "#f8d030", "#ffffff", "#c060e0", "#f07a30"][(k + 2) % 5],
        ),
      );
    out.push(
      path(
        `M${x - 30} 54Q${x - 38} 70 ${x - 34} 86M${x + 30} 54Q${x + 38} 70 ${x + 34} 86`,
        "none",
        { stroke: "#3a6a32", strokeWidth: 2.4 },
      ),
    );
  }
  // shelves left and right, with vases
  for (const [sx, dir] of [
    [18, 1],
    [532, -1],
  ]) {
    for (const y of [140, 220]) {
      out.push(
        rect(
          Math.min(sx, sx + dir * 120),
          y,
          120,
          7,
          lg(D, 0, y, 0, y + 7, "#d8a860", "#9a6a30"),
          ink(0.9),
        ),
      );
      out.push(
        path(
          `M${sx + dir * 14} ${y + 7}l${dir * 6} 22M${sx + dir * 106} ${y + 7}l${-dir * 6} 22`,
          "none",
          { stroke: "#5a3a18", strokeWidth: 2 },
        ),
      );
      const cols = [
        ["#f04a6a", "#f8d030", "#ffffff"],
        ["#c060e0", "#ffffff", "#f07a30"],
        ["#e84a4a", "#f8a8c0", "#f8d030"],
      ];
      for (let i = 0; i < 3; i++) {
        const vx = sx + dir * (22 + i * 38);
        const [a, b, c] = cols[(i + (y > 180 ? 1 : 0)) % 3];
        out.push(
          vase(
            D,
            vx,
            y,
            22,
            26,
            ["#8ab0d8", "#e8d8b0", "#b8d0a0"][i],
            [
              [-8, 8, a],
              [0, 14, b],
              [8, 6, c],
            ],
            R,
          ),
        );
      }
    }
  }
  // the counter: wood with a brass till and a roll of ribbon, a bunch tied with string
  out.push(path("M0 330H550V400H0Z", lg(D, 0, 330, 0, 400, "#b07a3c", "#6a4220"), ink(1)));
  out.push(rect(0, 322, 550, 12, lg(D, 0, 322, 0, 334, "#e8c888", "#b08a50"), ink(1)));
  out.push(rect(52, 296, 56, 26, lg(D, 52, 0, 108, 0, "#e8d078", "#9a7a20"), ink(1)));
  out.push(rect(60, 302, 40, 8, "#3a2a10"));
  out.push(path("M62 316h36", "none", { stroke: "#5a4210", strokeWidth: 2 }));
  out.push(circle(450, 308, 14, "#e0407a", ink(1)));
  out.push(circle(450, 308, 5, "#fff"));
  out.push(
    path("M464 308q30 8 52 -4", "none", {
      stroke: "#e0407a",
      strokeWidth: 5,
      strokeLinecap: "round",
    }),
  );
  // buckets on the floor in front of the counter edge
  for (const [x, cols] of [
    [150, ["#f04a6a", "#f8a8c0"]],
    [214, ["#ffffff", "#f8d030"]],
    [338, ["#c060e0", "#f8a8c0"]],
    [402, ["#f07a30", "#f8d030"]],
  ]) {
    for (let i = 0; i < 5; i++)
      out.push(
        path(`M${x - 12 + i * 6} 372Q${x - 16 + i * 8} 346 ${x - 20 + i * 10} 320`, "none", {
          stroke: "#3a6a32",
          strokeWidth: 1.6,
        }),
      );
    for (let i = 0; i < 5; i++) out.push(bloom(x - 20 + i * 10, 318 + (i % 2) * 6, 7, cols[i % 2]));
    out.push(path(`M${x - 20} 366L${x - 15} 396H${x + 15}L${x + 20} 366Z`, "#8a8a92", ink(1)));
    out.push(path(`M${x - 18} 376H${x + 18}`, "none", { stroke: "#5a5a62", strokeWidth: 1 }));
  }
  out.push(
    lettering("FRESH CUT DAILY", 275, 190, 14, "#7a2a48", {
      align: "middle",
      weight: 0.14,
      track: 0.2,
    }),
  );
  return doc({ title: "places/florist (Remastered)", body: out.join(""), defs: D });
}

/** The Town Gazette: the newsroom, a hand press, pinned front pages, a typewriter and a clock. */
function gazetteRoom() {
  const D = new Defs("pgz");
  const R = rng(32);
  const out = [];
  out.push(rect(0, 0, 550, 400, lg(D, 0, 0, 550, 0, "#5a4026", "#7a5a38", "#4a3220")));
  // panelling lines
  let pan = "";
  for (let x = 0; x < 550; x += 46) pan += `M${x} 0V300`;
  out.push(path(pan, "none", { stroke: "#3a2814", strokeWidth: 1.2, opacity: 0.6 }));
  // floor
  out.push(rect(0, 300, 550, 100, lg(D, 0, 300, 0, 400, "#3a2a1a", "#1a1008")));
  out.push(path("M0 300H550", "none", { stroke: "#1a1008", strokeWidth: 2 }));
  // a big window with the paper's name in reverse across the glass
  out.push(rect(60, 30, 150, 150, lg(D, 0, 30, 0, 180, "#6a7a90", "#a8b4c0"), ink(1.5)));
  out.push(path("M135 30V180M60 105H210", "none", { stroke: P.ink, strokeWidth: 3 }));
  out.push(
    lettering("GAZETTE", 135, 62, 16, "#f8f0d8", { align: "middle", weight: 0.16, track: 0.12 }),
  );
  out.push(
    path("M70 150l40 -20M110 170l70 -30", "none", {
      stroke: "#fff",
      strokeWidth: 3,
      opacity: 0.22,
    }),
  );
  // pinned front pages on the right wall: cream sheets with headlines
  const sheets = [
    [350, 34, -3],
    [410, 46, 2],
    [470, 30, -1],
    [372, 108, 3],
    [440, 112, -2],
  ];
  for (const [x, y, rot] of sheets) {
    out.push(
      `<g transform="rotate(${rot} ${x + 24} ${y + 32})">${rect(x, y, 48, 64, "#efe6cc", ink(0.8))}${lettering("NEWS", x + 24, y + 6, 8, "#2a2018", { align: "middle", weight: 0.16 })}${path(`M${x + 5} ${y + 22}h38M${x + 5} ${y + 28}h38M${x + 5} ${y + 34}h30M${x + 5} ${y + 46}h38M${x + 5} ${y + 52}h26`, "none", { stroke: "#6a5a40", strokeWidth: 1.2 })}${rect(x + 5, y + 36, 14, 8, "#a8a090")}${circle(x + 24, y - 1, 1.8, "#c03020")}</g>`,
    );
  }
  // the wall clock
  out.push(circle(275, 52, 26, "#f6f0dc", ink(2)));
  out.push(
    path("M275 52V34M275 52l12 8", "none", {
      stroke: P.ink,
      strokeWidth: 2.4,
      strokeLinecap: "round",
    }),
  );
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    out.push(
      path(
        `M${n(275 + Math.cos(a) * 22)} ${n(52 + Math.sin(a) * 22)}L${n(275 + Math.cos(a) * 24)} ${n(52 + Math.sin(a) * 24)}`,
        "none",
        { stroke: P.ink, strokeWidth: 1.2 },
      ),
    );
  }
  // a green banker's lamp on a hanging cord
  out.push(path("M275 78V120", "none", { stroke: "#1a1008", strokeWidth: 1.4 }));
  // desk at lower left with a typewriter
  out.push(path("M0 308H210V400H0Z", lg(D, 0, 308, 0, 400, "#a06a34", "#5a3418"), ink(1)));
  out.push(rect(0, 296, 214, 14, lg(D, 0, 296, 0, 310, "#d09a58", "#8a5a28"), ink(1)));
  out.push(rect(70, 252, 74, 44, lg(D, 70, 0, 144, 0, "#8a8a92", "#3a3a42"), ink(1.2)));
  out.push(rect(78, 262, 58, 6, "#2a2a30"));
  for (let r = 0; r < 3; r++)
    for (let k = 0; k < 7 - r; k++)
      out.push(circle(80 + r * 4 + k * 8, 276 + r * 6, 2.2, "#d8d4c8", ink(0.5)));
  out.push(rect(82, 232, 50, 34, "#f2ecd6", ink(0.8)));
  out.push(path("M88 242h38M88 248h32M88 254h36", "none", { stroke: "#6a5a40", strokeWidth: 1.2 }));
  // a spike of papers and a mug
  out.push(path("M168 296V262", "none", { stroke: "#2a2a2a", strokeWidth: 2 }));
  for (let i = 0; i < 4; i++) out.push(rect(158, 288 - i * 3, 22, 3, "#efe6cc", ink(0.5)));
  out.push(rect(184, 276, 16, 20, "#e8e0d0", ink(0.9)));
  out.push(path("M200 282q8 2 0 10", "none", { stroke: P.ink, strokeWidth: 1.2 }));
  // the press on the right: iron rollers and a fall of paper
  out.push(rect(340, 232, 210, 130, lg(D, 340, 0, 550, 0, "#5a5a62", "#2a2a30"), ink(1.2)));
  out.push(rect(350, 242, 190, 22, lg(D, 0, 242, 0, 264, "#a8a8b0", "#4a4a52"), ink(1)));
  for (const [cx, cy] of [
    [400, 306],
    [480, 306],
  ]) {
    out.push(circle(cx, cy, 34, lg(D, cx - 34, 0, cx + 34, 0, "#c8c8d0", "#4a4a52"), ink(1.4)));
    out.push(circle(cx, cy, 8, "#2a2a30", ink(1)));
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      out.push(
        path(
          `M${n(cx + Math.cos(a) * 10)} ${n(cy + Math.sin(a) * 10)}L${n(cx + Math.cos(a) * 30)} ${n(cy + Math.sin(a) * 30)}`,
          "none",
          { stroke: "#2a2a30", strokeWidth: 1.6 },
        ),
      );
    }
  }
  out.push(path("M360 360H540", "none", { stroke: "#1a1a1e", strokeWidth: 3 }));
  out.push(path("M430 342Q440 350 436 364L456 364Q452 350 462 342Z", "#efe6cc", ink(0.8)));
  // stacked bundles of papers on the floor, string-tied
  for (const [x, y, w] of [
    [238, 352, 80],
    [248, 328, 62],
  ]) {
    out.push(rect(x, y, w, 24, lg(D, 0, y, 0, y + 24, "#efe6cc", "#b8ac90"), ink(1)));
    out.push(
      path(`M${x + w * 0.3} ${y}v24M${x + w * 0.7} ${y}v24`, "none", {
        stroke: "#8a6a30",
        strokeWidth: 1.6,
      }),
    );
  }
  void R;
  return doc({ title: "places/gazette (Remastered)", body: out.join(""), defs: D });
}

/** The Coroner: a green-tiled office, a wall of steel cooler doors, a desk of forms. */
function coronerOffice() {
  const D = new Defs("pco");
  const R = rng(33);
  const out = [];
  out.push(rect(0, 0, 550, 400, lg(D, 0, 0, 550, 0, "#4a6a60", "#7a9a8c", "#42605a")));
  let tiles = "";
  for (let y = 0; y < 290; y += 24) tiles += `M0 ${y}H550`;
  for (let x = 0; x < 550; x += 24) tiles += `M${x} 0V290`;
  out.push(path(tiles, "none", { stroke: "#2c443e", strokeWidth: 1 }));
  out.push(rect(0, 290, 550, 110, lg(D, 0, 290, 0, 400, "#3a4a46", "#161e1c")));
  out.push(path("M0 290H550", "none", { stroke: "#16201e", strokeWidth: 2 }));
  // a hanging lamp: cone of cold light on the middle
  out.push(path("M275 0V34", "none", { stroke: "#1a2422", strokeWidth: 3 }));
  out.push(path("M240 58Q275 28 310 58Z", lg(D, 240, 0, 310, 0, "#b8c0c8", "#5a6268"), ink(1)));
  out.push(ellipse(275, 58, 36, 5, "#f4f8ff"));
  out.push(
    path("M240 58L150 290H400L310 58Z", lg(D, 0, 58, 0, 290, "#f0f8ff", "#f0f8ff"), {
      opacity: 0.1,
    }),
  );
  // the cooler wall on the right: two columns, three rows of steel doors, handles and tags
  const cx0 = 350;
  out.push(rect(cx0 - 8, 36, 214, 262, lg(D, cx0, 0, 550, 0, "#8a929a", "#5a6268"), ink(1.4)));
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 2; c++) {
      const x = cx0 + c * 100;
      const y = 48 + r * 82;
      out.push(
        rect(x, y, 92, 74, lg(D, x, y, x + 92, y + 74, "#d8dee4", "#8a929a", "#aab2ba"), ink(1.2)),
      );
      out.push(rect(x + 30, y + 34, 32, 6, "#3a4048", ink(0.8)));
      out.push(rect(x + 6, y + 6, 24, 16, "#f2ecd0", ink(0.7)));
      out.push(
        path(`M${x + 9} ${y + 12}h18M${x + 9} ${y + 17}h12`, "none", {
          stroke: "#5a5040",
          strokeWidth: 1,
        }),
      );
    }
  // one drawer is slightly open, a red UNCLAIMED tag hangs from it
  out.push(path("M450 130H542V150H460Z", "#6a727a", ink(1)));
  out.push(path("M470 150v22", "none", { stroke: "#3a4048", strokeWidth: 1.4 }));
  out.push(rect(458, 170, 26, 18, "#d8c8a0", ink(0.8)));
  out.push(lettering("TOE", 471, 174, 5, "#b02820", { align: "middle", weight: 0.2 }));
  // a wall chart of the human outline, left
  out.push(rect(46, 56, 110, 150, "#efe8d4", ink(1.2)));
  out.push(
    path(
      "M101 74a9 9 0 1 0 0.1 0Z M101 92v44M78 100l23-6l23 6M101 136l-14 44M101 136l14 44",
      "none",
      { stroke: "#6a5a40", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" },
    ),
  );
  out.push(path("M60 182h82M60 192h60", "none", { stroke: "#a09070", strokeWidth: 1.2 }));
  out.push(circle(101, 120, 3, "#b02820"));
  out.push(lettering("COUNTY CORONER", 101, 64, 7, "#3a2a18", { align: "middle", weight: 0.16 }));
  // desk at the left: forms, a stamp, a skull paperweight, a desk lamp
  out.push(path("M0 312H300V400H0Z", lg(D, 0, 312, 0, 400, "#6a5a42", "#2a2218"), ink(1)));
  out.push(rect(0, 300, 304, 14, lg(D, 0, 300, 0, 314, "#a89870", "#6a5a3a"), ink(1)));
  for (let i = 0; i < 4; i++)
    out.push(
      rect(40 + i * 3, 292 - i * 4, 70, 5, "#efe8d4", {
        ...ink(0.6),
        transform: `rotate(${i * 2 - 3} 75 292)`,
      }),
    );
  out.push(rect(140, 276, 18, 24, lg(D, 140, 0, 158, 0, "#7a4a28", "#3a2210"), ink(1)));
  out.push(rect(142, 266, 14, 12, "#222"));
  out.push(path("M230 300v-32l22 -14", "none", { stroke: "#2a2a2a", strokeWidth: 3 }));
  out.push(path("M246 248l26 -2l-4 20z", "#3a6a58", ink(1)));
  // skull paperweight
  out.push(path("M184 296q-8 -4 -8 -14q2 -12 14 -12q12 0 14 12q0 10 -8 14z", "#e8e2d0", ink(1)));
  out.push(circle(186, 282, 2.4, "#2a2a2a"));
  out.push(circle(196, 282, 2.4, "#2a2a2a"));
  void R;
  return doc({ title: "places/coroner (Remastered)", body: out.join(""), defs: D });
}

/** The Health Department: a pale green office of certificates, grade cards and a rubber stamp. */
function healthOffice() {
  const D = new Defs("phd");
  const out = [];
  out.push(rect(0, 0, 550, 400, lg(D, 0, 0, 550, 0, "#a8c0a0", "#cddcc2", "#9ab494")));
  out.push(rect(0, 250, 550, 150, lg(D, 0, 250, 0, 400, "#6a7a64", "#2a342a")));
  out.push(rect(0, 240, 550, 12, "#e8e4d4", ink(0.9)));
  // venetian blind window, left
  out.push(rect(36, 44, 130, 130, "#d8e4ec", ink(1.4)));
  for (let y = 48; y < 172; y += 9)
    out.push(
      rect(38, y, 126, 6, lg(D, 0, y, 0, y + 6, "#f4f6f0", "#b8c0b8"), {
        stroke: "#7a847a",
        strokeWidth: 0.5,
      }),
    );
  // certificates, right: A grade cards, framed licence
  out.push(rect(396, 40, 118, 86, "#d0a860", ink(1.4)));
  out.push(rect(404, 48, 102, 70, "#f6f0dc", ink(0.8)));
  out.push(lettering("HEALTH", 455, 56, 8, "#2a5a3a", { align: "middle", weight: 0.16 }));
  out.push(lettering("CERTIFICATE", 455, 68, 6, "#2a5a3a", { align: "middle", weight: 0.16 }));
  out.push(
    path("M414 86h82M414 94h60M414 102h72", "none", { stroke: "#8a8a70", strokeWidth: 1.2 }),
  );
  out.push(circle(490, 104, 8, "#b03030", ink(0.7)));
  // the grade cards in a row on the wall
  for (const [i, [ch, col]] of [
    ["A", "#3c9a4c"],
    ["B", "#d8b030"],
    ["C", "#c8602a"],
  ].entries()) {
    const x = 214 + i * 56;
    out.push(rect(x, 54, 46, 62, "#fbf6e4", ink(1)));
    out.push(circle(x + 23, 80, 17, col, ink(0.8)));
    out.push(lettering(ch, x + 23, 70, 20, "#ffffff", { align: "middle", weight: 0.22 }));
    out.push(path(`M${x + 8} 105h30`, "none", { stroke: "#8a8a70", strokeWidth: 1.2 }));
  }
  // a hand-washing poster
  out.push(rect(180, 130, 70, 90, "#fbf6e4", ink(1)));
  out.push(lettering("WASH", 215, 138, 12, "#2a6aa8", { align: "middle", weight: 0.2 }));
  out.push(
    path(
      "M196 190q0 -30 8 -34q4 -2 6 6v-14q4 -4 6 0v14q4 -4 6 0v10q4 -2 6 2v20q-2 12 -16 12q-16 0 -16 -16z",
      "#f0bca8",
      ink(0.8),
    ),
  );
  // a counter along the bottom with an INSPECTED stamp pad and clipboards
  out.push(path("M0 320H550V400H0Z", lg(D, 0, 320, 0, 400, "#c8b890", "#7a6a48"), ink(1)));
  out.push(rect(0, 306, 550, 16, lg(D, 0, 306, 0, 322, "#e8dcc0", "#a8986e"), ink(1)));
  out.push(rect(54, 290, 80, 16, "#e8e4d4", ink(1)));
  out.push(rect(66, 270, 30, 22, lg(D, 66, 0, 96, 0, "#2f6a40", "#1a3a24"), ink(1)));
  out.push(rect(72, 260, 18, 12, "#8a6a3a", ink(1)));
  out.push(path("M52 300h88", "none", { stroke: "#2a2a2a", strokeWidth: 1 }));
  out.push(lettering("INSPECTED", 440, 288, 9, "#3c9a4c", { align: "middle", weight: 0.2 }));
  out.push(
    rect(386, 280, 110, 22, "none", {
      stroke: "#3c9a4c",
      strokeWidth: 2,
      transform: "rotate(-4 440 291)",
    }),
  );
  // clipboard rack right of centre
  for (let i = 0; i < 3; i++) {
    out.push(
      rect(330 + i * 8, 250 - i * 6, 36, 50, "#c09a58", {
        ...ink(0.9),
        transform: `rotate(${i * 5 - 5} 348 280)`,
      }),
    );
    out.push(
      rect(342 + i * 8, 246 - i * 6, 12, 6, "#6a6a72", {
        ...ink(0.6),
        transform: `rotate(${i * 5 - 5} 348 280)`,
      }),
    );
  }
  // a small wall bin for forms
  out.push(path("M260 300l-4 -40h44l-4 40z", "#8a8a92", ink(1)));
  for (let i = 0; i < 4; i++)
    out.push(rect(264 + i * 7, 246 - (i % 2) * 6, 6, 18, "#efe8d4", ink(0.5)));
  // a roach near the edge, for the inspectors' sake
  out.push(ellipse(150, 330, 6, 3.4, "#4a2a14", ink(0.5)));
  out.push(
    path("M144 328l-6 -4M144 332l-6 4M156 328l6 -4M156 332l6 4", "none", {
      stroke: "#3a2010",
      strokeWidth: 0.8,
    }),
  );
  return doc({ title: "places/health-department (Remastered)", body: out.join(""), defs: D });
}

/** The Pawn Shop: a brick shop wall hung with instruments, a barred counter of watches. */
function pawnShop() {
  const D = new Defs("ppa");
  const R = rng(35);
  const out = [];
  // brick wall in warm lamp light
  out.push(rect(0, 0, 550, 400, lg(D, 0, 0, 550, 0, "#5a3a24", "#8a5c36", "#4a2e1c")));
  let bricks = "";
  for (let y = 0; y < 300; y += 14) {
    bricks += `M0 ${y}H550`;
    for (let x = (y / 14) % 2 ? 0 : 20; x < 550; x += 40) bricks += `M${x} ${y}v14`;
  }
  out.push(path(bricks, "none", { stroke: "#2c1a0c", strokeWidth: 1, opacity: 0.55 }));
  out.push(rect(0, 300, 550, 100, lg(D, 0, 300, 0, 400, "#3a2616", "#140c06")));
  // pegboard shelf of goods on the left: guitar, trumpet, a clock, a bowling ball
  out.push(rect(24, 40, 170, 190, lg(D, 0, 40, 0, 230, "#b8854a", "#8a5c30"), ink(1.2)));
  for (let y = 60; y < 220; y += 22)
    for (let x = 38; x < 184; x += 22) out.push(circle(x, y, 1.2, "#3a2410"));
  // guitar
  out.push(
    path(
      "M70 200q-22 2 -20 -20q2 -10 12 -10q-4 -14 10 -20q14 -6 20 6q4 8 -2 16q8 4 6 14q-4 14 -26 14z",
      "#b8602a",
      ink(1.2),
    ),
  );
  out.push(circle(76, 182, 6, "#2a1608"));
  out.push(
    path("M88 168L128 100M124 96l8 8", "none", {
      stroke: "#4a2a10",
      strokeWidth: 5,
      strokeLinecap: "round",
    }),
  );
  // a bowling ball and a brass lantern on the shelf
  out.push(
    circle(
      150,
      192,
      17,
      D.rg(144, 185, 24, [
        [0, "#6a6a9a"],
        [1, "#16162a"],
      ]),
      ink(1.2),
    ),
  );
  for (const [x, y] of [
    [145, 186],
    [153, 184],
    [149, 193],
  ])
    out.push(circle(x, y, 2, "#0a0a14"));
  out.push(path("M104 214l4 -26h20l4 26z", "#e8c040", ink(1.2)));
  out.push(path("M110 188q8 -12 16 0", "none", { stroke: "#7a5a10", strokeWidth: 2 }));
  out.push(rect(111, 194, 10, 14, "#fff4b0", ink(0.6)));
  // wall clock
  out.push(circle(150, 80, 24, "#efe8d0", ink(1.6)));
  out.push(
    path("M150 80V64M150 80l10 6", "none", {
      stroke: P.ink,
      strokeWidth: 2.2,
      strokeLinecap: "round",
    }),
  );
  // the hanging sign in the window: three gold balls
  out.push(path("M470 0V40", "none", { stroke: "#1a1008", strokeWidth: 2 }));
  for (const [dx, dy] of [
    [-18, 0],
    [18, 0],
    [0, 32],
  ])
    out.push(
      circle(
        470 + dx,
        66 + dy,
        20,
        D.rg(464 + dx, 58 + dy, 28, [
          [0, "#fff0a0"],
          [0.55, "#e8b030"],
          [1, "#7a5410"],
        ]),
        ink(1.4),
      ),
    );
  // small sign: NO REFUNDS, and a price tag
  out.push(rect(360, 120, 90, 38, "#f6ecc8", ink(1.2)));
  out.push(lettering("NO REFUNDS", 405, 130, 8, "#a02818", { align: "middle", weight: 0.18 }));
  out.push(rect(230, 52, 100, 30, "#1c1410", ink(1)));
  out.push(lettering("WE BUY GOLD", 280, 62, 8, "#e8b030", { align: "middle", weight: 0.18 }));
  // the counter: glass front with trays of watches and rings, a barred teller grille on top
  out.push(path("M0 318H550V400H0Z", lg(D, 0, 318, 0, 400, "#7a4a24", "#3a2210"), ink(1)));
  out.push(
    rect(0, 280, 550, 40, lg(D, 0, 280, 0, 320, "#a8c8d0", "#5a7a82"), {
      ...ink(1.4),
      opacity: 0.95,
    }),
  );
  for (let i = 0; i < 9; i++) {
    const x = 20 + i * 60;
    out.push(rect(x, 296, 40, 16, "#2a1a30", ink(0.7)));
    out.push(circle(x + 12 + R.next() * 4, 303, 4, "#e8e0d0", ink(0.6)));
    out.push(path(`M${x + 24} 304h12`, "none", { stroke: "#e8b030", strokeWidth: 2 }));
  }
  for (let x = 12; x < 550; x += 22)
    out.push(path(`M${x} 214V282`, "none", { stroke: "#1a1008", strokeWidth: 3 }));
  out.push(path("M0 214H550M0 244H550", "none", { stroke: "#1a1008", strokeWidth: 4 }));
  // a green-shaded lamp
  out.push(path("M520 214V196l-20 -10", "none", { stroke: "#1a1008", strokeWidth: 3 }));
  out.push(path("M484 170l32 -4l-6 24z", "#2f6a3c", ink(1)));
  out.push(path("M280 316l8 0l0 -16", "none", { stroke: "none" }));
  return doc({ title: "places/pawn-shop (Remastered)", body: out.join(""), defs: D });
}

/** Mourne & Sons: a polished parlor, drapes, brass lamps, lilies, a mahogany casket and a price card. */
function mournesParlor() {
  const D = new Defs("pmo");
  const out = [];
  // panelled wall, burgundy above
  out.push(rect(0, 0, 550, 400, lg(D, 0, 0, 550, 0, "#3a1c26", "#5a2a38", "#331822")));
  out.push(rect(0, 200, 550, 200, lg(D, 0, 200, 0, 400, "#2a1c18", "#120a08")));
  for (let x = 14; x < 550; x += 92)
    out.push(rect(x, 214, 72, 100, "none", { stroke: "#5a3a28", strokeWidth: 1.4 }));
  out.push(rect(0, 198, 550, 10, lg(D, 0, 198, 0, 208, "#c8a460", "#7a5a28"), ink(1)));
  // floor: polished boards with a runner
  out.push(rect(0, 314, 550, 86, lg(D, 0, 314, 0, 400, "#4a2a1a", "#1a0e08")));
  out.push(path("M110 314H440L520 400H30Z", lg(D, 0, 314, 0, 400, "#6a1a2a", "#3a0c18"), ink(1)));
  out.push(
    path("M150 314L90 400M400 314L460 400", "none", { stroke: "#d8b060", strokeWidth: 1.4 }),
  );
  // drapes either side with gold tiebacks
  for (const [x, dir] of [
    [0, 1],
    [550, -1],
  ]) {
    out.push(
      path(
        `M${x} 0H${x + dir * 96}Q${x + dir * 70} 120 ${x + dir * 84} 300Q${x + dir * 40} 340 ${x} 330Z`,
        lg(D, x, 0, x + dir * 96, 0, "#7a1a2c", "#3a0a14", "#8a2438"),
        ink(1),
      ),
    );
    for (let k = 1; k < 5; k++)
      out.push(
        path(
          `M${x + dir * k * 18} 0Q${x + dir * (k * 18 - 6)} 160 ${x + dir * (k * 16)} 320`,
          "none",
          { stroke: "#2a060e", strokeWidth: 1.4, opacity: 0.6 },
        ),
      );
    out.push(
      path(`M${x} 170Q${x + dir * 50} 190 ${x + dir * 80} 160`, "none", {
        stroke: "#d8b060",
        strokeWidth: 5,
        strokeLinecap: "round",
      }),
    );
  }
  // the brass sign over the middle
  out.push(
    rect(176, 34, 198, 56, lg(D, 176, 34, 374, 90, "#e8c870", "#8a6a20", "#d8b050"), ink(1.6)),
  );
  out.push(rect(182, 40, 186, 44, "#1c1410", ink(0.8)));
  out.push(
    lettering("MOURNE AND SONS", 275, 48, 12, "#f0d890", {
      align: "middle",
      weight: 0.16,
      track: 0.14,
      serif: true,
    }),
  );
  out.push(
    lettering("FUNERAL DIRECTORS SINCE 1931", 275, 68, 5.4, "#c8a860", {
      align: "middle",
      weight: 0.16,
      track: 0.1,
    }),
  );
  // a chandelier
  out.push(path("M275 0V20", "none", { stroke: "#c8a460", strokeWidth: 2 }));
  // the mahogany casket on a bier at the back: a curved lid, brass handles, a spray on top
  out.push(
    path("M120 262H430L446 276H104Z", lg(D, 0, 262, 0, 276, "#6a3a22", "#3a1e10"), ink(1.2)),
  );
  out.push(path("M140 276V312M410 276V312", "none", { stroke: "#2a1608", strokeWidth: 6 }));
  out.push(
    path(
      "M134 222H416L406 262H144Z",
      lg(D, 134, 0, 416, 0, "#8a4a2c", "#4a2412", "#7a3c22"),
      ink(1.2),
    ),
  );
  out.push(
    path(
      "M134 222Q146 198 190 196H360Q404 198 416 222Z",
      lg(D, 134, 0, 416, 0, "#b8683a", "#6a3418", "#a45a30"),
      ink(1.2),
    ),
  );
  out.push(
    path("M170 208Q250 200 330 206", "none", {
      stroke: "#e8b890",
      strokeWidth: 2,
      opacity: 0.6,
      strokeLinecap: "round",
    }),
  );
  for (const x of [176, 238, 312, 374])
    out.push(
      path(`M${x - 8} 242h16`, "none", {
        stroke: "#e0b858",
        strokeWidth: 3.4,
        strokeLinecap: "round",
      }),
    );
  out.push(path("M134 238H416", "none", { stroke: "#e0b858", strokeWidth: 1.4 }));
  // lilies in two sprays at the ends, and the price card on an easel
  for (const x of [112, 436]) {
    out.push(
      path(
        `M${x} 262Q${x + 4} 220 ${x - 6} 190M${x} 262Q${x - 6} 224 ${x + 12} 198M${x} 262Q${x + 12} 230 ${x + 22} 214`,
        "none",
        { stroke: "#2c6a38", strokeWidth: 2.2 },
      ),
    );
    for (const [dx, dy] of [
      [-6, 188],
      [12, 196],
      [22, 212],
    ]) {
      out.push(
        path(
          `M${x + dx} ${dy}q-10 -4 -12 -16q10 2 12 16zM${x + dx} ${dy}q10 -6 14 -18q-10 4 -14 18z`,
          "#fbf8ee",
          ink(0.7),
        ),
      );
      out.push(circle(x + dx, dy - 2, 2, "#e8b030"));
    }
  }
  out.push(path("M470 316l10 -66M500 316l-10 -66", "none", { stroke: "#c8a460", strokeWidth: 3 }));
  out.push(rect(458, 224, 54, 40, "#fbf4e6", ink(1)));
  out.push(lettering("PRICES", 485, 230, 7, "#3a1c26", { align: "middle", weight: 0.18 }));
  out.push(
    path("M464 246h42M464 252h42M464 258h30", "none", { stroke: "#7a6a5a", strokeWidth: 1.2 }),
  );
  // two brass lamps on stands near the front
  for (const x of [186, 364]) {
    out.push(path(`M${x} 314V262`, "none", { stroke: "#c8a460", strokeWidth: 3 }));
    out.push(path(`M${x - 11} 262h22l-4 -26h-14z`, "#f4e2a0", ink(1)));
    out.push(ellipse(x, 316, 14, 3, "#c8a460", ink(0.8)));
  }
  return doc({ title: "places/mournes (Remastered)", body: out.join(""), defs: D });
}

export const pieces = [
  {
    id: "places/florist",
    kind: "place",
    usedBy: "the Florist (proposed bg for pictures.florist, with people/marigold-thorne as fg)",
    grade: "B",
    notes:
      "A pink shop with a striped-awning window, hanging baskets, green panelling, shelves of vased blooms either side, buckets of cut flowers in front of a wood counter with a brass till and a ribbon roll.",
    render: floristShop,
  },
  {
    id: "places/gazette",
    kind: "place",
    usedBy:
      "the Town Gazette (proposed bg for pictures.gazette, with people/hal-pennywhistle as fg)",
    grade: "B",
    notes:
      "A wood-panelled newsroom: a window with GAZETTE in reverse, pinned front pages, a wall clock, a typewriter desk, a spike of papers, a cast-iron press with rollers and string-tied bundles of the day's edition.",
    render: gazetteRoom,
  },
  {
    id: "places/coroner",
    kind: "place",
    usedBy: "the Coroner (proposed bg for pictures.coroner, with people/dr-grimble as fg)",
    grade: "B",
    notes:
      "A green-tiled county office: a wall of steel cooler doors (one drawer ajar, a toe tag hanging), an anatomy chart, a desk of forms with a rubber stamp, a skull paperweight and a lamp, under a hanging lamp.",
    render: coronerOffice,
  },
  {
    id: "places/health-department",
    kind: "place",
    usedBy:
      "the Health Department (proposed bg for pictures.health, with people/inspector-mudge as fg)",
    grade: "B",
    notes:
      "A pale green municipal office: a blind-covered window, a framed certificate, A/B/C grade cards, a hand-washing poster, a counter with an INSPECTED stamp, a rack of clipboards and one cockroach.",
    render: healthOffice,
  },
  {
    id: "places/pawn-shop",
    kind: "place",
    usedBy: "the Pawn Shop (proposed bg for pictures.pawn, with people/cousin-sal as fg)",
    grade: "B",
    notes:
      "Brick wall in lamp light: a pegboard of guitar, trumpet and clock, the three gold balls, NO REFUNDS and WE BUY GOLD signs, and a barred glass counter of watches and rings with a green lamp.",
    render: pawnShop,
  },
  {
    id: "places/mournes",
    kind: "place",
    usedBy: "Mourne & Sons (proposed bg for pictures.mournes, with people/augustus-mourne as fg)",
    grade: "B",
    notes:
      "The rival's polished parlor: burgundy drapes with gold tiebacks, panelled walls, a brass MOURNE AND SONS sign, a mahogany casket on a bier between sprays of lilies, a price card on an easel and brass lamps.",
    render: mournesParlor,
  },
];
