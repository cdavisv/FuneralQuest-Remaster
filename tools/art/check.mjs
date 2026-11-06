#!/usr/bin/env node
/**
 * Checks every SVG of the Remastered pack: it renders with rsvg-convert, its viewBox is the one
 * the manifest records (0 0 550 400 for pictures), and it contains no bitmap, no external
 * reference, no live text and no script. Prints the sizes and exits non-zero on any failure.
 *   node tools/art/check.mjs
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const dir = join(root, "assets", "remastered");
const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
const byId = new Map(manifest.assets.map((a) => [a.id, a]));

function* walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const f = join(d, e.name);
    if (e.isDirectory()) yield* walk(f);
    else if (e.name.endsWith(".svg")) yield f;
  }
}

const problems = [];
let total = 0;
let count = 0;
let largest = { size: 0, id: "" };
const seen = new Set();
for (const file of walk(dir)) {
  const id = relative(dir, file)
    .replace(/\\/g, "/")
    .replace(/\.svg$/, "");
  const svg = readFileSync(file, "utf8");
  const size = statSync(file).size;
  total += size;
  count += 1;
  if (size > largest.size) largest = { size, id };
  seen.add(id);
  const entry = byId.get(id);
  if (!entry) problems.push(`${id}: not in manifest.json`);
  const vb = /<svg[^>]*\sviewBox="([^"]+)"/.exec(svg)?.[1];
  if (!vb) problems.push(`${id}: no viewBox`);
  else if (entry && vb !== entry.viewBox)
    problems.push(`${id}: viewBox ${vb}, manifest says ${entry.viewBox}`);
  if (/<image\b/i.test(svg)) problems.push(`${id}: embeds an <image>`);
  if (/data:image\//i.test(svg)) problems.push(`${id}: embeds a data: bitmap`);
  if (/(?:xlink:)?href="(?!#)/i.test(svg)) problems.push(`${id}: external href`);
  if (/url\((?!#)/i.test(svg)) problems.push(`${id}: external url()`);
  if (/<text\b|<tspan\b|font-family|@font-face/i.test(svg))
    problems.push(`${id}: live text or a font`);
  if (/<script\b|<foreignObject\b|\son[a-z]+=/i.test(svg))
    problems.push(`${id}: script or foreignObject`);
  if (size > 400_000) problems.push(`${id}: ${Math.round(size / 1024)} KB is too large`);
  try {
    const png = execFileSync("rsvg-convert", ["-w", "64", file], {
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 1 << 24,
    });
    if (png.length < 100) problems.push(`${id}: rendered nothing`);
  } catch (e) {
    problems.push(`${id}: rsvg-convert failed: ${String(e.stderr ?? e).trim()}`);
  }
}
for (const a of manifest.assets)
  if (!seen.has(a.id)) problems.push(`${a.id}: in manifest.json but no file`);

console.log(
  `${count} SVGs, ${(total / 1024).toFixed(0)} KB in all, largest ${largest.id} at ${(largest.size / 1024).toFixed(0)} KB`,
);
const grades = {};
for (const a of manifest.assets) grades[a.grade] = (grades[a.grade] ?? 0) + 1;
console.log("grades:", JSON.stringify(grades));
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("all clean");
