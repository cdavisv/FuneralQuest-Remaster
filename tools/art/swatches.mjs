#!/usr/bin/env node
/** Draws the palette as a swatch sheet for docs/art/style-guide.md (SVG and PNG). */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lettering } from "./font.mjs";
import { doc, rect } from "./lib.mjs";
import { FAMILIES, P } from "./palette.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "..", "docs", "art", "img");
const sw = 62;
let y = 10;
let body = rect(0, 0, 900, 0, "#222");
const rows = [];
for (const [fam, names] of Object.entries(FAMILIES)) {
  rows.push(lettering(fam, 10, y + 22, 9, "#ddd", { weight: 0.13 }));
  names.forEach((nm, i) => {
    const x = 150 + i * (sw + 4);
    rows.push(rect(x, y, sw, 40, P[nm], { stroke: "#555", strokeWidth: 0.5 }));
    rows.push(
      lettering(P[nm].replace("#", ""), x + 3, y + 44, 5, "#bbb", { weight: 0.14, track: 0 }),
    );
  });
  y += 62;
}
body = rect(0, 0, 900, y, "#222") + rows.join("");
const svg = doc({ title: "Remastered palette", body, w: 900, h: y });
writeFileSync(join(out, "palette.svg"), svg);
execFileSync("rsvg-convert", [
  "-w",
  "900",
  join(out, "palette.svg"),
  "-o",
  join(out, "palette.png"),
]);
console.log("palette written");
