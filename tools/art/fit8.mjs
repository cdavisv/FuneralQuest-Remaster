#!/usr/bin/env node
/**
 * Measures each Expanded-place map building's drawn extent and prints the FIT table for
 * tools/art/pieces/buildings8.mjs (scale and offset that fill the 120x108 box). Run with the
 * table emptied: node tools/art/fit8.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BUILDINGS } from "./pieces/buildings8.mjs";

const dir = mkdtempSync(join(tmpdir(), "fq-fit-"));
const Z = 4;
const table = {};
for (const [id, render] of Object.entries(BUILDINGS)) {
  const svg = render(false);
  const title = /<title>([^<]*)<\/title>/.exec(svg)?.[1]?.replace("&amp;", "&");
  const f = join(dir, `${id}.svg`);
  writeFileSync(f, svg);
  const png = join(dir, `${id}.png`);
  execFileSync("rsvg-convert", ["-z", String(Z), f, "-o", png]);
  const info = execFileSync("magick", [png, "-trim", "-format", "%w %h %X %Y", "info:"]).toString();
  const [w, h, ox, oy] = info.replace(/\+/g, " ").split(/\s+/).map(Number);
  const bw = w / Z;
  const bh = h / Z;
  const x0 = ox / Z;
  const y0 = oy / Z;
  const s = Math.min(116 / bw, 104 / bh);
  const tx = (120 - bw * s) / 2 - x0 * s;
  const ty = 106 - bh * s - y0 * s;
  table[title] = [Math.round(s * 1000) / 1000, Math.round(tx * 10) / 10, Math.round(ty * 10) / 10];
}
console.log(JSON.stringify(table, null, 2));
