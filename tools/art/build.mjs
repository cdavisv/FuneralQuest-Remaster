#!/usr/bin/env node
/**
 * Writes the Remastered art pack.
 *
 *   node tools/art/build.mjs                 every piece
 *   node tools/art/build.mjs places/store    only pieces whose id starts with one of the args
 *   node tools/art/build.mjs --preview DIR   also render PNG previews into DIR (rsvg-convert)
 *
 * Each module in tools/art/pieces/ exports `pieces`: { id, kind, overrides?, grade, notes,
 * render() -> svg string }. Pictures go to assets/remastered/<id>.svg; `ui/` and `icons/`
 * pieces also go to the client pack (apps/client/src/art/packs/remastered/). The manifest,
 * assets/remastered/manifest.json, is rewritten from the pieces on a full build.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const outDir = join(root, "assets", "remastered");
const packDir = join(root, "apps", "client", "src", "art", "packs", "remastered");

const args = process.argv.slice(2);
let previewDir = null;
const filters = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--preview") previewDir = args[++i];
  else filters.push(args[i]);
}

export async function loadPieces() {
  const dir = join(here, "pieces");
  const all = [];
  for (const f of readdirSync(dir)
    .filter((x) => x.endsWith(".mjs"))
    .sort()) {
    const mod = await import(pathToFileURL(join(dir, f)).href);
    for (const p of mod.pieces ?? []) all.push({ ...p, module: f });
  }
  return all;
}

const CREDIT = "FuneralQuest Remastered project, in the style of Akiko Robinson's original art";

async function main() {
  const pieces = await loadPieces();
  const ids = new Set();
  for (const p of pieces) {
    if (ids.has(p.id)) throw new Error(`duplicate piece id ${p.id}`);
    ids.add(p.id);
  }
  const chosen = filters.length
    ? pieces.filter((p) => filters.some((f) => p.id.startsWith(f)))
    : pieces;
  for (const p of chosen) {
    const svg = p.render();
    const file = join(outDir, `${p.id}.svg`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, svg);
    if (p.id.startsWith("ui/") || p.id.startsWith("icons/")) {
      const target = join(packDir, `${p.id}.svg`);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, svg);
    }
    if (previewDir) {
      const png = join(previewDir, `${p.id.replace(/\//g, "__")}.png`);
      mkdirSync(previewDir, { recursive: true });
      const w = p.previewWidth ?? (p.id.startsWith("icons/") ? 192 : 825);
      execFileSync("rsvg-convert", [
        "-w",
        String(w),
        "-b",
        p.previewBg ?? "#000000",
        file,
        "-o",
        png,
      ]);
    }
  }
  if (!filters.length) {
    const manifest = {
      generator: "tools/art/build.mjs (node tools/art/build.mjs)",
      pack: "remastered",
      stage: { width: 550, height: 400 },
      credit: CREDIT,
      license: "CC BY 4.0",
      fallback: "classic",
      assets: pieces.map((p) => ({
        id: p.id,
        file: `remastered/${p.id}.svg`,
        kind: p.kind,
        ...(p.overrides ? { overrides: p.overrides } : { adds: true }),
        ...(p.usedBy ? { usedBy: p.usedBy } : {}),
        grade: p.grade,
        notes: p.notes,
        viewBox: p.viewBox ?? "0 0 550 400",
        credit: p.credit ?? CREDIT,
        license: p.license ?? "CC BY 4.0",
      })),
    };
    writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  }
  console.log(`art: wrote ${chosen.length} piece(s)`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
