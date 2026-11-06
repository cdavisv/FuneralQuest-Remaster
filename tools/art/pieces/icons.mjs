/**
 * Small icons: the ledger (cash, karma, rating, turns, savings, debt, injuries, leads), the town
 * strip (six weathers, news, ordinance, mayor, story, vote), the karma balance and the five
 * monument tiers. Drawn to read at 16 to 24 pixels: bold silhouettes, a dark outline, two or
 * three colours from the palette, light from the upper left like everything else.
 */
import { lettering } from "../font.mjs";
import { circle, Defs, doc, ellipse, g, n, path, rect, scallop } from "../lib.mjs";

const INK = "#1a1410";
const o = (w = 2) => ({
  stroke: INK,
  strokeWidth: w,
  strokeLinejoin: "round",
  strokeLinecap: "round",
});
const icon = (name, draw) => () => {
  const D = new Defs(name.replace(/[^a-z]/g, "").slice(0, 4));
  return doc({ title: name, body: draw(D), defs: D, w: 48, h: 48 });
};
const gold = (D, x0 = 6, x1 = 42) =>
  D.lg(x0, 0, x1, 0, [
    [0, "#fff0a0"],
    [0.45, "#e0b030"],
    [1, "#8a6010"],
  ]);

const cloud = (D, x, y, s, c = "#e8ecf0", c2 = "#a8b0bc") =>
  path(
    `M${x - 14 * s} ${y + 6 * s}Q${x - 20 * s} ${y + 6 * s} ${x - 20 * s} ${y}Q${x - 20 * s} ${y - 7 * s} ${x - 12 * s} ${y - 7 * s}Q${x - 10 * s} ${y - 16 * s} ${x - 1 * s} ${y - 15 * s}Q${x + 7 * s} ${y - 20 * s} ${x + 12 * s} ${y - 10 * s}Q${x + 20 * s} ${y - 10 * s} ${x + 20 * s} ${y - 1 * s}Q${x + 20 * s} ${y + 6 * s} ${x + 13 * s} ${y + 6 * s}Z`,
    D.lg(0, y - 20 * s, 0, y + 6 * s, [
      [0, c],
      [1, c2],
    ]),
    o(1.8),
  );

const DRAW = {
  money: (D) =>
    g([
      circle(24, 25, 17, gold(D), o()),
      circle(24, 25, 12.5, "none", { stroke: "#8a6010", strokeWidth: 1.5 }),
      lettering("$", 24, 16, 18, "#6a4808", { align: "middle", weight: 0.16 }),
      path("M14 16q4 -5 10 -6", "none", {
        stroke: "#ffffff",
        strokeWidth: 2,
        opacity: 0.6,
        strokeLinecap: "round",
      }),
    ]),
  turns: (_D) =>
    g([
      path("M12 6H36M12 42H36", "none", {
        stroke: "#6a4010",
        strokeWidth: 4,
        strokeLinecap: "round",
      }),
      path("M14 8Q14 20 22 24Q14 28 14 40H34Q34 28 26 24Q34 20 34 8Z", "#e8f0f4", o(1.8)),
      path("M17 12H31Q30 18 24 22Q18 18 17 12Z", "#e0b050"),
      path("M17 39Q20 31 24 30Q28 31 31 39Z", "#e0b050"),
      path("M24 22V30", "none", { stroke: "#e0b050", strokeWidth: 1.4 }),
    ]),
  karma: (D) =>
    g([
      ellipse(24, 10, 13, 4.5, "none", { stroke: "#e8c040", strokeWidth: 3.4 }),
      ellipse(24, 10, 13, 4.5, "none", { stroke: INK, strokeWidth: 0.8 }),
      path(
        "M10 42Q8 26 24 22Q40 26 38 42Z",
        D.lg(10, 0, 38, 0, [
          [0, "#f4f0e8"],
          [0.5, "#f4f0e8"],
          [0.5, "#b02020"],
          [1, "#6a0a0a"],
        ]),
        o(),
      ),
      path("M30 24q2 -8 8 -10q-1 6 -4 11z", "#b02020", o(1.4)),
      path("M24 22V42", "none", { stroke: INK, strokeWidth: 1 }),
    ]),
  rating: (D) =>
    g([
      path("M15 30L10 46L17 42L20 48L24 34ZM33 30L38 46L31 42L28 48L24 34Z", "#a02020", o(1.4)),
      path(
        "M24 3l5.6 11.5l12.6 1.8l-9.1 8.9l2.2 12.5L24 31.8l-11.3 5.9l2.2 -12.5l-9.1 -8.9l12.6 -1.8z",
        gold(D, 6, 42),
        o(1.8),
      ),
    ]),
  savings: (D) =>
    g([
      rect(
        7,
        9,
        34,
        32,
        D.lg(7, 0, 41, 0, [
          [0, "#6a8a5a"],
          [1, "#2e4a2a"],
        ]),
        { ...o(), rx: 3 },
      ),
      rect(11, 13, 26, 24, "none", { stroke: "#1a2a16", strokeWidth: 1.4, rx: 2 }),
      circle(24, 25, 7, "#c8c8bc", o(1.5)),
      path("M24 25l4 -3M24 19v2M24 29v2M18 25h2M28 25h2", "none", {
        stroke: INK,
        strokeWidth: 1.4,
      }),
      rect(8, 41, 6, 4, INK),
      rect(34, 41, 6, 4, INK),
    ]),
  debt: (D) =>
    g([
      path("M10 8Q20 18 22 28", "none", {
        stroke: "#6a6a6a",
        strokeWidth: 3,
        strokeDasharray: "4 2.5",
        strokeLinecap: "round",
      }),
      path("M6 6h8v5h-8z", "#8a8a8a", o(1.4)),
      circle(
        28,
        33,
        12,
        D.rg(24, 29, 14, [
          [0, "#6a6a6a"],
          [1, "#141414"],
        ]),
        o(1.6),
      ),
      lettering("IOU", 28, 30, 6.5, "#e04040", { align: "middle", weight: 0.2 }),
      path("M21 25q2 -3 6 -4", "none", {
        stroke: "#ffffff",
        strokeWidth: 1.6,
        opacity: 0.5,
        strokeLinecap: "round",
      }),
    ]),
  injuries: (_D) =>
    g([
      g(
        [
          rect(4, 18, 40, 12, "#e8c8a0", { ...o(1.6), rx: 5 }),
          rect(18, 18, 12, 12, "#f4e8d8"),
          path("M21 21h1M26 21h1M21 27h1M26 27h1", "none", {
            stroke: "#a08060",
            strokeWidth: 1.6,
            strokeLinecap: "round",
          }),
        ],
        { transform: "rotate(45 24 24)" },
      ),
      g(
        [
          rect(4, 18, 40, 12, "#e8c8a0", { ...o(1.6), rx: 5 }),
          rect(18, 18, 12, 12, "#f4e8d8"),
          path("M21 21h1M26 21h1M21 27h1M26 27h1", "none", {
            stroke: "#a08060",
            strokeWidth: 1.6,
            strokeLinecap: "round",
          }),
        ],
        { transform: "rotate(-45 24 24)" },
      ),
      circle(36, 36, 3, "#b02020"),
    ]),
  leads: (D) =>
    g([
      path(
        "M13 14L25 6L41 30L29 38Z",
        D.lg(13, 6, 41, 38, [
          [0, "#f0dca0"],
          [1, "#c8a860"],
        ]),
        o(1.8),
      ),
      circle(23.5, 13, 2.6, "#ffffff", o(1.2)),
      path("M22 12Q12 22 6 40", "none", { stroke: "#8a6a3a", strokeWidth: 1.6 }),
      path("M23 21l10 -6M26 25l9 -5M29 29l6 -3.5", "none", {
        stroke: "#6a5a3a",
        strokeWidth: 1.4,
        strokeLinecap: "round",
      }),
    ]),
  clear: (D) =>
    g([
      ...Array.from({ length: 8 }, (_, k) => {
        const a = (k / 8) * Math.PI * 2;
        return path(
          `M${n(24 + Math.cos(a) * 14)} ${n(24 + Math.sin(a) * 14)}L${n(24 + Math.cos(a) * 21)} ${n(24 + Math.sin(a) * 21)}`,
          "none",
          { stroke: "#e0a020", strokeWidth: 3.4, strokeLinecap: "round" },
        );
      }),
      circle(
        24,
        24,
        10,
        D.rg(21, 21, 12, [
          [0, "#fff4b0"],
          [1, "#f0b020"],
        ]),
        o(1.8),
      ),
    ]),
  rain: (D) =>
    g([
      cloud(D, 24, 22, 1, "#c8d0d8", "#7a8698"),
      path("M14 32l-3 8M23 32l-3 9M32 32l-3 8", "none", {
        stroke: "#4a7ab0",
        strokeWidth: 3,
        strokeLinecap: "round",
      }),
    ]),
  fog: (_D) =>
    g([
      path("M6 14Q16 9 26 14T44 14", "none", {
        stroke: "#9aa4ac",
        strokeWidth: 4,
        strokeLinecap: "round",
      }),
      path("M4 24Q14 19 24 24T44 24", "none", {
        stroke: "#b8c0c6",
        strokeWidth: 4,
        strokeLinecap: "round",
      }),
      path("M6 34Q16 29 26 34T44 34", "none", {
        stroke: "#9aa4ac",
        strokeWidth: 4,
        strokeLinecap: "round",
      }),
    ]),
  thunderstorm: (D) =>
    g([
      cloud(D, 24, 20, 1, "#6a7080", "#2e3240"),
      path("M24 24L17 36H24L20 46L33 30H26L30 24Z", "#f8d830", o(1.4)),
    ]),
  scorcher: (D) =>
    g([
      circle(
        24,
        20,
        13,
        D.rg(20, 16, 16, [
          [0, "#fff0a0"],
          [0.6, "#f8a020"],
          [1, "#d84010"],
        ]),
        o(1.8),
      ),
      path("M8 40q4 -4 8 0t8 0t8 0t8 0", "none", {
        stroke: "#d84010",
        strokeWidth: 2.6,
        strokeLinecap: "round",
      }),
      path("M10 46q4 -4 8 0t8 0t8 0t8 0", "none", {
        stroke: "#f08020",
        strokeWidth: 2,
        strokeLinecap: "round",
        opacity: 0.8,
      }),
    ]),
  snow: (_D) =>
    g([
      ...[0, 1, 2].map((k) =>
        g(
          [
            path("M24 6V42", "none", {
              stroke: "#4a7ab0",
              strokeWidth: 5.6,
              strokeLinecap: "round",
            }),
            path("M24 6V42", "none", {
              stroke: "#e8f4ff",
              strokeWidth: 2.6,
              strokeLinecap: "round",
            }),
            path("M18 10l6 5l6 -5M18 38l6 -5l6 5", "none", {
              stroke: "#e8f4ff",
              strokeWidth: 2.2,
              strokeLinecap: "round",
            }),
          ],
          { transform: `rotate(${k * 60} 24 24)` },
        ),
      ),
      circle(24, 24, 3, "#ffffff", o(1.2)),
    ]),
  weather: (D) => cloud(D, 24, 28, 1),
  news: (_D) =>
    g([
      path("M8 10H38V40H12Q8 40 8 36Z", "#f4f0e4", o(1.8)),
      path("M38 16H42V36Q42 40 38 40", "#d8d0c0", o(1.8)),
      rect(12, 14, 22, 6, "#2a2a2a"),
      path("M12 25H22M12 29H22M12 33H22M26 25H34M26 29H34M26 33H34", "none", {
        stroke: "#6a6a6a",
        strokeWidth: 1.6,
      }),
    ]),
  ordinance: (_D) =>
    g([
      path("M12 6H34Q38 6 38 10V40H14Q10 40 10 36V10", "#f0e4c4", o(1.8)),
      path("M10 10Q10 6 14 6Q18 6 18 10V14H10Z", "#d8c8a0", o(1.6)),
      path("M16 18H32M16 23H32M16 28H26", "none", { stroke: "#7a6a4a", strokeWidth: 1.6 }),
      circle(31, 34, 6.5, "#b01818", o(1.4)),
      path("M28 39l-2 7l5 -3l4 3l-1 -7", "#b01818", o(1.2)),
    ]),
  mayor: (D) =>
    g([
      path("M6 6Q14 20 24 24Q34 20 42 6", "none", {
        stroke: "#7a5a10",
        strokeWidth: 5,
        strokeLinecap: "round",
      }),
      path("M6 6Q14 20 24 24Q34 20 42 6", "none", {
        stroke: "#e8c040",
        strokeWidth: 2.6,
        strokeDasharray: "3 2",
      }),
      circle(24, 32, 12, gold(D, 12, 36), o(1.8)),
      circle(24, 32, 7.5, "none", { stroke: "#8a6010", strokeWidth: 1.4 }),
      path("M24 27v10M20 31h8", "none", { stroke: "#6a4808", strokeWidth: 2 }),
    ]),
  story: (_D) =>
    g([
      path("M24 12Q16 7 6 9V38Q16 36 24 41Q32 36 42 38V9Q32 7 24 12Z", "#f4f0e4", o(1.8)),
      path("M24 12V41", "none", { stroke: INK, strokeWidth: 1.4 }),
      path(
        "M10 16Q16 15 20 17M10 22Q16 21 20 23M10 28Q16 27 20 29M28 17Q32 15 38 16M28 23Q32 21 38 22",
        "none",
        { stroke: "#8a8070", strokeWidth: 1.3 },
      ),
      path("M34 30l3 12l2 -3l3 3l-1 -12z", "#a02020", o(1)),
    ]),
  vote: (D) =>
    g([
      path("M16 4H32V22H16Z", "#ffffff", o(1.6)),
      path("M19 12l3 4l7 -8", "none", {
        stroke: "#2a7a3a",
        strokeWidth: 2.6,
        strokeLinecap: "round",
        strokeLinejoin: "round",
      }),
      path(
        "M6 22H42V44H6Z",
        D.lg(6, 0, 42, 0, [
          [0, "#8a5a2e"],
          [1, "#4a2e14"],
        ]),
        o(1.8),
      ),
      path("M6 22L12 16H36L42 22", "#a87a48", o(1.6)),
      rect(14, 20, 20, 3, INK),
      path("M14 32H34", "none", { stroke: "#2a1a0a", strokeWidth: 1.4 }),
    ]),
};

/** The karma balance (the parchment during a body-preparation choice). */
function balance() {
  const D = new Defs("kb");
  const out = [];
  const brass = D.lg(0, 0, 120, 0, [
    [0, "#fff0a0"],
    [0.4, "#c89a30"],
    [1, "#6a4808"],
  ]);
  out.push(path("M60 10V60", "none", { stroke: INK, strokeWidth: 4.4, strokeLinecap: "round" }));
  out.push(
    path("M60 10V60", "none", { stroke: "#c89a30", strokeWidth: 2.4, strokeLinecap: "round" }),
  );
  out.push(path("M44 66Q60 56 76 66Z", brass, o(1.2)));
  out.push(path("M18 20H102", "none", { stroke: INK, strokeWidth: 4.4, strokeLinecap: "round" }));
  out.push(
    path("M18 20H102", "none", { stroke: "#e0b040", strokeWidth: 2.4, strokeLinecap: "round" }),
  );
  out.push(circle(60, 9, 4, brass, o(1)));
  for (const [x, dark] of [
    [20, true],
    [100, false],
  ]) {
    out.push(
      path(`M${x} 20L${x - 12} 46M${x} 20L${x + 12} 46`, "none", {
        stroke: "#5a4010",
        strokeWidth: 1,
      }),
    );
    out.push(path(`M${x - 16} 46Q${x} 56 ${x + 16} 46Z`, brass, o(1.2)));
    if (dark) {
      // the easy way: smouldering coins
      out.push(ellipse(x - 5, 44, 5, 2.2, "#e0b030", o(0.8)));
      out.push(ellipse(x + 4, 43, 5, 2.2, "#e0b030", o(0.8)));
      out.push(ellipse(x, 40.5, 5, 2.2, "#f0c040", o(0.8)));
      out.push(
        path(`M${x - 4} 38q-2 -6 2 -9q0 4 3 5q1 -4 -1 -7q6 3 4 11z`, "#d84010", { opacity: 0.85 }),
      );
    } else {
      // the honest way: a white lily
      out.push(path(`M${x} 46V30`, "none", { stroke: "#3a6a2a", strokeWidth: 1.4 }));
      out.push(path(`M${x} 30l-6 -6q2 -4 6 -2q4 -2 6 2z`, "#ffffff", o(0.8)));
      out.push(path(`M${x - 8} 40q4 -6 8 -2`, "none", { stroke: "#3a6a2a", strokeWidth: 1.4 }));
    }
  }
  return doc({ title: "karma balance", body: out.join(""), defs: D, w: 120, h: 70 });
}

const MON = {
  1: (D) =>
    g([
      rect(
        6,
        26,
        36,
        6,
        D.lg(0, 26, 0, 32, [
          [0, "#c8c4b8"],
          [1, "#8a867a"],
        ]),
        o(1.6),
      ),
      rect(8, 32, 6, 10, "#8a867a", o(1.4)),
      rect(34, 32, 6, 10, "#8a867a", o(1.4)),
      path("M6 20H42V26H6Z", "#b8b4a8", o(1.6)),
    ]),
  2: (D) =>
    g([
      rect(14, 38, 20, 6, "#a8a49a", o(1.4)),
      path(
        "M18 38Q16 26 20 18Q24 14 28 18Q32 26 30 38Z",
        D.lg(16, 0, 32, 0, [
          [0, "#e8e4dc"],
          [1, "#a8a49a"],
        ]),
        o(1.4),
      ),
      circle(24, 13, 4.6, "#d8d4cc", o(1.4)),
      path("M19 20Q8 12 6 24Q10 22 18 26ZM29 20Q40 12 42 24Q38 22 30 26Z", "#e8e4dc", o(1.4)),
      path("M22 13h1M25.5 13h1", "none", { stroke: INK, strokeWidth: 1.2 }),
    ]),
  3: (D) =>
    g([
      rect(12, 38, 24, 7, "#9a968c", o(1.4)),
      path(
        "M17 38L20 10L24 4L28 10L31 38Z",
        D.lg(17, 0, 31, 0, [
          [0, "#e8e4dc"],
          [0.5, "#c8c4b8"],
          [1, "#8a867a"],
        ]),
        o(1.6),
      ),
      path("M21 24h6M21 28h6", "none", { stroke: "#7a766a", strokeWidth: 1.2 }),
    ]),
  4: (D) =>
    g([
      path("M14 44L16 30H32L34 44Z", "#8a867a", o(1.6)),
      path("M12 30H36L34 26H14Z", "#a8a49a", o(1.4)),
      path(
        "M24 26Q14 18 20 10Q20 16 24 14Q22 8 26 4Q34 14 30 20Q34 18 32 12Q38 22 24 26Z",
        D.lg(0, 4, 0, 26, [
          [0, "#fff0a0"],
          [0.5, "#f8a020"],
          [1, "#d84010"],
        ]),
        o(1.2),
      ),
    ]),
  5: (D) =>
    g([
      rect(12, 36, 24, 9, "#8a867a", o(1.4)),
      path(
        "M18 36L19 22Q17 16 21 13H27Q31 16 29 22L30 36Z",
        D.lg(17, 0, 31, 0, [
          [0, "#c89a50"],
          [1, "#5a3a10"],
        ]),
        o(1.4),
      ),
      circle(24, 9, 4.4, "#a87a3a", o(1.4)),
      path("M28 17L42 8L43 11L30 21Z", "#a87a3a", o(1.2)),
    ]),
};

export const pieces = [
  ...Object.entries(DRAW).map(([name, draw]) => ({
    id: `icons/${name}`,
    kind: "icon",
    usedBy: name.match(/clear|rain|fog|thunderstorm|scorcher|snow|weather/)
      ? "the town strip's weather"
      : name.match(/news|ordinance|mayor|story|vote/)
        ? "the town strip"
        : "the ledger",
    grade: "B",
    notes: `The ${name} icon (replaces the client's inline glyph in ExpandedIcons.tsx when the pack is Remastered).`,
    viewBox: "0 0 48 48",
    render: icon(name, draw),
  })),
  {
    id: "icons/karma-balance",
    kind: "icon",
    usedBy: "the karma moment's parchment (KarmaScale)",
    grade: "B",
    notes: "A brass balance: smouldering coins in the left pan, a white lily in the right.",
    viewBox: "0 0 120 70",
    previewWidth: 360,
    previewBg: "#e8dcc0",
    render: balance,
  },
  ...Object.entries(MON).map(([k, draw]) => ({
    id: `icons/monument-${k}`,
    kind: "icon",
    usedBy: "graveyard monuments (no client slot yet; for the Monuments catalogue)",
    grade: "B",
    notes: [
      "",
      "Tier 1, a tasteful granite bench.",
      "Tier 2, the weeping angel (slightly cross-eyed).",
      "Tier 3, a marble obelisk.",
      "Tier 4, the eternal flame.",
      "Tier 5, a bronze statue of yourself, pointing at something important.",
    ][k],
    viewBox: "0 0 48 48",
    render: icon(`monument ${k}`, draw),
  })),
];
void scallop;
