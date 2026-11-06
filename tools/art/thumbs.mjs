#!/usr/bin/env node
/**
 * Pass 1: thumbnails. Rough block-ins of every Remastered piece on one sheet, to settle
 * composition and value before drawing. Not shipped; renders to the path given (PNG).
 *   node tools/art/thumbs.mjs out.png
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { lettering } from "./font.mjs";
import { doc, ellipse, g, path, poly, rect } from "./lib.mjs";

const T = {};
const bust = (c = "#7a6050") =>
  path(
    "M175 400Q180 330 230 315L235 260Q200 180 275 120Q350 180 315 260L320 315Q370 330 375 400Z",
    c,
    {
      opacity: 0.55,
    },
  );

T["places/store"] = () =>
  rect(0, 0, 550, 400, "#4a4038") +
  path(
    poly([
      [0, 60],
      [200, 120],
      [200, 300],
      [0, 400],
    ]),
    "#6b4a30",
  ) +
  path(
    poly([
      [550, 60],
      [350, 120],
      [350, 300],
      [550, 400],
    ]),
    "#6b4a30",
  ) +
  [0, 1, 2, 3].map((i) => rect(10, 90 + i * 70, 170, 30, "#8a2a20")).join("") +
  rect(200, 120, 150, 180, "#2a2420") +
  rect(0, 300, 550, 100, "#5a5048") +
  bust();
T["places/palors"] = () =>
  rect(0, 0, 550, 400, "#9aa4a8") +
  path(
    poly([
      [0, 0],
      [230, 200],
      [230, 260],
      [0, 400],
    ]),
    "#4a5a50",
  ) +
  path(
    poly([
      [550, 0],
      [320, 200],
      [320, 260],
      [550, 400],
    ]),
    "#4a5a50",
  ) +
  path(
    poly([
      [230, 260],
      [320, 260],
      [550, 400],
      [0, 400],
    ]),
    "#555",
  ) +
  rect(0, 150, 550, 80, "#c8ccd0", { opacity: 0.5 });
T["places/bank"] = () =>
  rect(0, 0, 550, 400, "#b8b098") +
  rect(0, 300, 550, 100, "#8a8070") +
  path("M230 300Q240 200 300 190Q360 200 380 300Z", "#6080b0") +
  ellipse(300, 160, 35, 45, "#c08868") +
  [60, 140, 220, 300, 380, 460].map((x) => rect(x, 40, 10, 270, "#806030")).join("") +
  [100, 160, 220].map((y) => rect(40, y, 480, 6, "#a08040")).join("") +
  rect(70, 30, 200, 30, "#111") +
  lettering("EXCHANGE", 170, 37, 16, "#fff", { align: "middle" });
T["places/fire"] = () =>
  rect(0, 0, 550, 400, "#100808") +
  rect(60, 120, 260, 280, "#3a2a20") +
  path("M40 400Q20 200 120 90Q160 160 190 60Q240 150 280 70Q330 180 340 400Z", "#e07020", {
    opacity: 0.8,
  }) +
  path("M380 400L395 300L420 300L430 400Z", "#5a4a30") +
  path("M450 400L465 300L490 300L500 400Z", "#5a4a30") +
  path("M330 330L420 320", "none", { stroke: "#999", strokeWidth: 6 });
T["background/background_1"] = () =>
  rect(0, 0, 550, 400, "#2a3028") +
  path("M0 0H550V400H460Q470 120 275 90Q80 120 90 400H0Z", "#151a14") +
  rect(0, 330, 550, 70, "#3a3a28");
T["background/background_2"] = () =>
  rect(0, 0, 550, 400, "#2a2018") +
  rect(380, 60, 110, 220, "#8a9aa0") +
  path("M360 50H400V300H360ZM470 50H510V300H470Z", "#5a3a20") +
  ellipse(90, 180, 30, 20, "#d8c070") +
  rect(0, 300, 550, 100, "#1a1410");
T["background/background_3"] = () =>
  rect(0, 0, 550, 400, "#4a4048") +
  path("M0 0L275 120L550 0", "none", { stroke: "#2a2028", strokeWidth: 18 }) +
  path("M240 220Q240 160 275 150Q310 160 310 220Z", "#f0e0a0") +
  rect(0, 260, 550, 140, "#3a3034");
T["background/background_4"] = () =>
  rect(0, 0, 550, 400, "#5a7a30") +
  [
    [80, 80],
    [470, 90],
    [60, 300],
    [490, 320],
    [275, 30],
  ]
    .map(([x, y]) => ellipse(x, y, 120, 90, "#3a5a20"))
    .join("");
T["background/background_5"] = () =>
  rect(0, 0, 550, 400, "#c08070") +
  path(
    poly([
      [0, 0],
      [180, 100],
      [180, 260],
      [0, 400],
    ]),
    "#a86058",
  ) +
  path(
    poly([
      [550, 0],
      [370, 100],
      [370, 260],
      [550, 400],
    ]),
    "#a86058",
  ) +
  rect(180, 100, 190, 160, "#d8a090") +
  path(
    poly([
      [180, 260],
      [370, 260],
      [550, 400],
      [0, 400],
    ]),
    "#c06060",
  );
T["background/background_7"] = () =>
  rect(0, 0, 550, 400, "#000") +
  path(
    "M0 400V300Q60 250 120 300V260H140V300L180 280V140H200V280Q260 250 330 300Q400 270 450 300V270Q480 240 510 270V400Z",
    "#5a6878",
  );
T["background/background_church"] = () =>
  rect(0, 0, 550, 400, "#5a5040") +
  rect(60, 40, 260, 180, "#b0a888") +
  [0, 1, 2, 3, 4].map((i) => rect(0, 230 + i * 34, 330 - i * 10, 22, "#5a3a20")).join("") +
  rect(380, 80, 140, 120, "#7a6030");
T["background/background_celemony"] = () =>
  rect(0, 0, 550, 230, "#d8e8f0") +
  rect(0, 220, 550, 180, "#c8b890") +
  ellipse(70, 140, 80, 90, "#8a9a88") +
  ellipse(450, 170, 100, 60, "#8a9a88") +
  [
    [120, 270],
    [300, 250],
    [420, 300],
    [200, 330],
  ]
    .map(([x, y]) => rect(x, y, 30, 20, "#7a7a78"))
    .join("");
T["places/graveyard"] = () =>
  rect(0, 0, 550, 400, "#283038") +
  [
    [60, 260],
    [160, 240],
    [380, 250],
    [470, 270],
  ]
    .map(([x, y]) => rect(x, y, 40, 70, "#6a7480"))
    .join("") +
  path("M0 330Q275 290 550 330V400H0Z", "#3a4030") +
  rect(0, 200, 550, 120, "#c8ccd0", { opacity: 0.35 });
T["places/graveyard-duel"] = () =>
  T["places/graveyard"]() +
  rect(200, 320, 150, 60, "#1a1410") +
  path("M130 400L180 260L210 400Z", "#222") +
  path("M420 400L370 260L340 400Z", "#222");
T["places/city-hall"] = () =>
  rect(0, 0, 550, 400, "#9ab0c0") +
  rect(80, 140, 390, 200, "#d8d0c0") +
  path(
    poly([
      [180, 140],
      [275, 80],
      [370, 140],
    ]),
    "#c8c0b0",
  ) +
  rect(250, 30, 50, 60, "#c8c0b0") +
  rect(0, 340, 550, 60, "#7a7a70") +
  lettering("CITY HALL", 275, 150, 14, "#333", { align: "middle" });
T["places/mayor-office"] = () =>
  rect(0, 0, 550, 400, "#5a3a28") +
  rect(180, 40, 190, 150, "#8a7050") +
  rect(0, 280, 550, 120, "#3a2014") +
  bust("#4a4a50");
T["places/reaper-club-door"] = () =>
  rect(0, 0, 550, 400, "#100810") +
  rect(190, 110, 170, 260, "#2a1420") +
  rect(170, 60, 210, 40, "#a01818") +
  rect(0, 370, 550, 30, "#222");
T["places/reaper-club"] = () =>
  rect(0, 0, 550, 400, "#120a1a") +
  [
    [100, 0, "#8030a0"],
    [450, 0, "#30a080"],
  ]
    .map(([x, , c]) => path(`M${x} 0L${x - 120} 400H${x + 120}Z`, c, { opacity: 0.3 }))
    .join("") +
  rect(0, 290, 550, 110, "#1a0f14") +
  rect(330, 200, 200, 100, "#111");
T["places/reaper-tables"] = () =>
  rect(0, 0, 550, 400, "#140c10") +
  ellipse(275, 300, 230, 70, "#205038") +
  ellipse(275, 60, 120, 40, "#f0d080", { opacity: 0.3 });
T["places/black-market"] = () =>
  rect(0, 0, 550, 400, "#1a1410") +
  rect(60, 220, 430, 100, "#4a3a28") +
  bust("#2a2a2a") +
  rect(0, 0, 550, 80, "#000", { opacity: 0.5 });
T["places/parlor-office"] = () =>
  rect(0, 0, 550, 400, "#6a5040") +
  rect(40, 40, 150, 200, "#3a2a1a") +
  rect(330, 50, 160, 110, "#a0b0b8") +
  rect(0, 270, 550, 130, "#4a3020") +
  rect(120, 240, 310, 50, "#6a4020");
for (let i = 1; i <= 5; i++) {
  T[`places/parlor-${i}`] = () =>
    ellipse(275, 350, 230, 30, "#3d2c1a") +
    rect(
      275 - 50 - i * 30,
      320 - 80 - i * 25,
      100 + i * 60,
      80 + i * 25,
      ["#9a8a78", "#c9b896", "#e8e4e0", "#d8d0c8", "#efe9e0"][i - 1],
    ) +
    path(
      poly([
        [275 - 60 - i * 32, 320 - 80 - i * 25],
        [275, 150 - i * 20],
        [275 + 60 + i * 32, 320 - 80 - i * 25],
      ]),
      "#586838",
    );
}
T["places/prep-table"] = () =>
  rect(0, 0, 550, 400, "#203030") +
  path(
    poly([
      [90, 260],
      [460, 260],
      [500, 320],
      [50, 320],
    ]),
    "#d0d0d8",
  ) +
  path("M120 260Q275 180 430 260Z", "#e8e8e0");
T["places/prep-cosmetics"] = () =>
  rect(0, 0, 550, 400, "#405860") +
  rect(330, 40, 160, 200, "#a8b0b8") +
  rect(0, 270, 550, 130, "#486870") +
  ellipse(160, 290, 110, 40, "#e8e8e0");
T["places/prep-viewing"] = () =>
  rect(0, 0, 550, 400, "#3a2828") +
  path(
    poly([
      [60, 240],
      [490, 240],
      [470, 330],
      [80, 330],
    ]),
    "#6a4020",
  ) +
  ellipse(100, 180, 40, 60, "#a03030") +
  ellipse(450, 180, 40, 60, "#a03030");
T["places/bingo-night"] = () =>
  rect(0, 0, 550, 400, "#4a4038") +
  rect(150, 30, 250, 140, "#2a3a2a") +
  [0, 1, 2].map((i) => rect(20 + i * 180, 260, 150, 30, "#7a5030")).join("") +
  lettering("BINGO", 275, 50, 30, "#ffcc33", { align: "middle" });
T["places/sick-room"] = () =>
  rect(0, 0, 550, 400, "#bcc7bc") +
  rect(60, 220, 380, 100, "#f0f0f0") +
  ellipse(140, 220, 40, 30, "#c08868") +
  rect(470, 100, 10, 250, "#999");
T["places/bank-vault"] = () =>
  rect(0, 0, 550, 400, "#3a3a38") +
  ellipse(275, 190, 150, 150, "#8a8a80") +
  ellipse(275, 190, 120, 120, "#6a6a60") +
  rect(0, 340, 550, 60, "#2a2a28");
for (const p of [
  "mayor-grubb",
  "lucius-vane",
  "inspector-mudge",
  "teller-prudence",
  "nurse-gertie",
  "morty",
  "f_old_3",
  "m_adult_5",
  "f_adult_3",
  "m_old_7",
]) {
  T[`people/${p}`] = () => rect(0, 0, 550, 400, "#000") + bust("#b08070");
}

const cols = 6;
const tw = 275;
const th = 200;
const names = Object.keys(T);
const rows = Math.ceil(names.length / cols);
let body = rect(0, 0, cols * (tw + 8), rows * (th + 26), "#222");
names.forEach((nm, i) => {
  const x = (i % cols) * (tw + 8);
  const y = Math.floor(i / cols) * (th + 26);
  body += g([rect(0, 0, 550, 400, "#000"), T[nm]()], {
    transform: `translate(${x} ${y}) scale(0.5)`,
  });
  body += lettering(nm, x + 2, y + th + 6, 8, "#ccc", { weight: 0.12, track: 0 });
});
const svg = doc({ title: "thumbnails", body, w: cols * (tw + 8), h: rows * (th + 26) });
const out = process.argv[2] ?? "thumbs.png";
writeFileSync(`${out}.svg`, svg);
execFileSync("rsvg-convert", ["-w", "1650", `${out}.svg`, "-o", out]);
console.log(out, names.length, "thumbnails");
