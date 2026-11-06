import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { contactSheetHtml, contactSheetSvg } from "./contact.js";
import { scriptSoundRefs, soundRows, soundsDoc, structureDoc, textsDoc } from "./docs.js";
import { assetId, categoryOf, legacyUrlVariants, sourcePath } from "./ids.js";
import { CREDIT, LICENSE, type Manifest, type ManifestAsset, NEEDS_REDRAW } from "./manifest.js";
import { renderPicture } from "./picture.js";
import { actionScriptListing } from "./reference.js";
import { parseSwf, type Swf } from "./swf.js";
import { PIECES, renderParts, renderPiece, renderScreens, selfHidingSprites } from "./ui.js";

const run = promisify(execFile);

export interface Failure {
  file: string;
  error: string;
}

export interface ExportSummary {
  swfsConverted: number;
  svgsWritten: number;
  failures: Failure[];
  needsRedraw: string[];
  counts: Record<string, number>;
}

const TEXTURE_NAMES: Record<number, string> = { 186: "brick", 277: "river", 278: "gravel" };

async function findSwfs(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await findSwfs(p)));
    else if (e.name.toLowerCase().endsWith(".swf")) out.push(p);
  }
  return out.sort();
}

const hex = (c: { r: number; g: number; b: number }): string =>
  `#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

const f2 = (v: number): number => Math.round(v * 100) / 100;

function hasSound(swf: Swf): boolean {
  return (
    swf.soundUses.length > 0 ||
    swf.streams.some((s) => s.blocks > 0) ||
    [...swf.characters.values()].some((c) => c.type === "sound")
  );
}

/** Runs rsvg-convert on every file; throws with the list of files that fail. */
async function validateSvgs(files: string[]): Promise<Failure[]> {
  const bad: Failure[] = [];
  let next = 0;
  const tmp = await mkdtemp(path.join(os.tmpdir(), "fq-extract-"));
  const worker = async (n: number): Promise<void> => {
    const sink = path.join(tmp, `${n}.png`);
    for (;;) {
      const i = next++;
      const f = files[i];
      if (f === undefined) return;
      try {
        await run("rsvg-convert", ["-w", "64", "-o", sink, f]);
      } catch (e) {
        bad.push({
          file: f,
          error: `rsvg-convert failed: ${(e as Error).message.split("\n").slice(0, 2).join(" ")}`,
        });
      }
    }
  };
  await Promise.all(Array.from({ length: 8 }, (_, n) => worker(n)));
  await rm(tmp, { recursive: true, force: true });
  return bad;
}

export async function exportAll(repoRoot: string): Promise<ExportSummary> {
  const flashDir = path.join(repoRoot, "legacy/dist/public/flash");
  const assetsDir = path.join(repoRoot, "assets");
  const finalDir = path.join(assetsDir, "classic");
  const stage = path.join(assetsDir, ".classic-staging");
  const docsDir = path.join(repoRoot, "docs/reference");
  await rm(stage, { recursive: true, force: true });
  await mkdir(stage, { recursive: true });

  const failures: Failure[] = [];
  const written: string[] = [];
  const assets: ManifestAsset[] = [];
  const legacyUrl: Record<string, string> = {};
  const put = async (rel: string, data: string | Uint8Array): Promise<void> => {
    const p = path.join(stage, rel);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, data);
    if (rel.endsWith(".svg")) written.push(p);
  };

  const files = await findSwfs(flashDir);
  let swfsConverted = 0;
  const exportsByFile = new Map<string, string[]>();
  const soundRowsAllFiles: ReturnType<typeof soundRows> = [];
  const parsed = new Map<string, Swf>();

  for (const file of files) {
    const rel = path.relative(flashDir, file).split(path.sep).join("/");
    const id = assetId(rel);
    const source = sourcePath(repoRoot, file);
    try {
      const swf = parseSwf(new Uint8Array(await readFile(file)));
      parsed.set(id, swf);
      soundRowsAllFiles.push(...soundRows(swf, rel));
      exportsByFile.set(
        rel,
        swf.exports.map((e) => `${e.name} (id ${e.id})`),
      );
      if (id === "welcome") {
        swfsConverted++;
        continue;
      }
      const audioOnly =
        swf.characters.size > 0 &&
        swf.root.frames.every((f) => f.cmds.length === 0) &&
        [...swf.characters.values()].every((c) => c.type === "sound");
      const base: Omit<ManifestAsset, "kind" | "file" | "framesDir" | "viewBox"> = {
        id,
        source,
        category: categoryOf(id),
        frameCount: swf.root.frames.length,
        swfFrameCount: swf.root.frames.length,
        frameRate: swf.header.frameRate,
        embedsBitmaps: false,
        background: hex(swf.background),
        hasSound: hasSound(swf),
        credit: CREDIT,
        license: LICENSE,
      };
      for (const v of legacyUrlVariants(rel)) legacyUrl[v] = id;
      if (audioOnly) {
        assets.push({
          ...base,
          kind: "audio-only",
          file: null,
          framesDir: null,
          viewBox: null,
          note: "Audio only: the SWF holds a music loop and no picture. The sound is not exported.",
        });
        swfsConverted++;
        continue;
      }
      const pic = renderPicture(swf, id);
      await put(`${id}.svg`, pic.svg);
      let framesDir: string | null = null;
      if (pic.frames.length > 1) {
        framesDir = `classic/${id}.frames`;
        for (let i = 0; i < pic.frames.length; i++) {
          await put(`${id}.frames/${String(i + 1).padStart(4, "0")}.svg`, pic.frames[i] as string);
        }
      }
      const entry: ManifestAsset = {
        ...base,
        kind: "picture",
        file: `classic/${id}.svg`,
        framesDir,
        viewBox: `0 0 ${pic.width} ${pic.height}`,
        frameCount: pic.frameCount,
        embedsBitmaps: pic.usesBitmaps,
        contentBounds: pic.bounds
          ? {
              x: f2(pic.bounds.x0),
              y: f2(pic.bounds.y0),
              w: f2(pic.bounds.x1 - pic.bounds.x0),
              h: f2(pic.bounds.y1 - pic.bounds.y0),
            }
          : null,
      };
      const redraw = NEEDS_REDRAW[id];
      if (redraw) {
        entry.needsRedraw = true;
        entry.needsRedrawReason = redraw;
      }
      assets.push(entry);
      swfsConverted++;
    } catch (e) {
      failures.push({ file: source, error: (e as Error).message });
    }
  }
  for (const id of Object.keys(NEEDS_REDRAW)) {
    if (!assets.some((a) => a.id === id))
      failures.push({
        file: `needsRedraw:${id}`,
        error: "listed in NEEDS_REDRAW but no such asset",
      });
  }

  // ---- welcome.swf: UI art
  const welcome = parsed.get("welcome");
  const wSource = sourcePath(repoRoot, path.join(flashDir, "welcome.swf"));
  if (welcome) {
    try {
      const hidden = selfHidingSprites(welcome);
      const wBase = {
        source: wSource,
        frameRate: welcome.header.frameRate,
        hasSound: false,
        credit: CREDIT,
        license: LICENSE,
      } as const;
      const named = new Set<string>();
      for (const spec of PIECES) {
        const o = renderPiece(welcome, spec, hidden);
        if (!o) {
          failures.push({ file: `welcome.swf:${spec.name}`, error: "named piece rendered empty" });
          continue;
        }
        named.add(`ui/${spec.name}`);
        await put(`ui/${spec.name}.svg`, o.svg);
        const ch = welcome.characters.get(spec.id);
        assets.push({
          ...wBase,
          id: `ui/${spec.name}`,
          kind: "ui",
          sourceRef: `${ch?.type ?? spec.kind} ${spec.id}${spec.frame !== undefined ? ` frame ${typeof spec.frame === "string" ? spec.frame : spec.frame + 1}` : ""}`,
          category: "ui",
          file: `classic/ui/${spec.name}.svg`,
          framesDir: null,
          viewBox: /viewBox="([^"]+)"/.exec(o.svg)?.[1] ?? null,
          frameCount: ch?.type === "sprite" ? ch.timeline.frames.length : 1,
          embedsBitmaps: o.usesBitmaps,
          note: spec.note,
        });
      }
      for (const s of renderScreens(welcome, hidden)) {
        await put(`ui/screens/${s.id}.svg`, s.svg);
        assets.push({
          ...wBase,
          id: `ui/screens/${s.id}`,
          kind: "ui-screen",
          sourceRef: s.source,
          category: "ui/screens",
          file: `classic/ui/screens/${s.id}.svg`,
          framesDir: null,
          viewBox: "0 0 550 400",
          frameCount: 1,
          embedsBitmaps: s.usesBitmaps,
          note: `Composed reference screen: ${s.label}. Dynamic text fields are drawn as dashed boxes.`,
        });
      }
      for (const p of renderParts(welcome, named, hidden)) {
        await put(`ui/${p.spec.name}.svg`, p.svg);
        const m = /viewBox="([^"]+)"/.exec(p.svg);
        assets.push({
          ...wBase,
          id: `ui/${p.spec.name}`,
          kind: "ui-part",
          sourceRef: `${p.spec.kind} ${p.spec.id}`,
          category: "ui/parts",
          file: `classic/ui/${p.spec.name}.svg`,
          framesDir: null,
          viewBox: m?.[1] ?? null,
          frameCount: 1,
          embedsBitmaps: p.usesBitmaps,
          note: p.spec.note,
        });
      }
      for (const [id, ch] of welcome.characters) {
        if (ch.type !== "bitmap") continue;
        const name = TEXTURE_NAMES[id];
        if (!name) {
          failures.push({
            file: `welcome.swf:bitmap ${id}`,
            error: "bitmap has no texture name; add it to TEXTURE_NAMES",
          });
          continue;
        }
        if (ch.def.kind !== "jpeg") {
          failures.push({
            file: `welcome.swf:bitmap ${id}`,
            error: "only JPEG textures are supported",
          });
          continue;
        }
        await put(`ui/textures/${name}.jpg`, ch.def.data);
        assets.push({
          ...wBase,
          id: `ui/textures/${name}`,
          kind: "texture",
          sourceRef: `bitmap ${id}`,
          category: "ui/textures",
          file: `classic/ui/textures/${name}.jpg`,
          framesDir: null,
          viewBox: `0 0 ${ch.def.width} ${ch.def.height}`,
          frameCount: 1,
          embedsBitmaps: true,
          note: `Embedded JPEG texture, ${ch.def.width}x${ch.def.height} px, used as a tiled bitmap fill.`,
        });
      }
    } catch (e) {
      failures.push({ file: wSource, error: (e as Error).message });
    }
  } else {
    failures.push({ file: wSource, error: "welcome.swf not found" });
  }

  // ---- verify every SVG renders
  failures.push(...(await validateSvgs(written)));

  // ---- manifest and contact sheets
  assets.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const manifest: Manifest = {
    generator: "tools/extract (pnpm --filter @fq/extract run export)",
    stage: { width: 550, height: 400 },
    credit: CREDIT,
    license: LICENSE,
    assets,
    legacyUrl: Object.fromEntries(Object.entries(legacyUrl).sort(([a], [b]) => (a < b ? -1 : 1))),
  };

  if (failures.length === 0) {
    await put("contact-sheet.html", contactSheetHtml(assets));
    const main = assets.filter((a) => a.file?.endsWith(".svg") && a.kind !== "ui-part");
    const parts = assets.filter((a) => a.kind === "ui-part");
    const sheets: [string, ManifestAsset[], number][] = [
      ["contact-sheet.png", main, 8],
      ["contact-sheet-parts.png", parts, 10],
    ];
    for (const [name, list, cols] of sheets) {
      const sheet = contactSheetSvg(list, cols);
      const svgPath = path.join(stage, name.replace(".png", ".tmp.svg"));
      await writeFile(svgPath, sheet.svg);
      await run("rsvg-convert", ["-o", path.join(stage, name), svgPath]);
      await rm(svgPath);
    }
  }

  const counts: Record<string, number> = {};
  for (const a of assets) counts[a.kind] = (counts[a.kind] ?? 0) + 1;
  const summary: ExportSummary = {
    swfsConverted,
    svgsWritten: written.length,
    failures,
    needsRedraw: assets.filter((a) => a.needsRedraw).map((a) => a.id),
    counts,
  };
  if (failures.length > 0) return summary;

  // ---- reference docs (text only; no audio data)
  await mkdir(docsDir, { recursive: true });
  if (welcome) {
    await writeFile(
      path.join(docsDir, "welcome-actionscript.md"),
      `${actionScriptListing(welcome, "welcome.swf")}\n`,
    );
    await writeFile(
      path.join(docsDir, "welcome-texts-and-fonts.md"),
      textsDoc(welcome, "welcome.swf"),
    );
    await writeFile(
      path.join(docsDir, "welcome-structure.md"),
      structureDoc(welcome, "welcome.swf"),
    );
  }
  await writeFile(
    path.join(docsDir, "sound-inventory.md"),
    soundsDoc(soundRowsAllFiles, welcome ? scriptSoundRefs(welcome) : [], exportsByFile),
  );

  // ---- swap the staging directory into place
  await writeFile(path.join(assetsDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await rm(finalDir, { recursive: true, force: true });
  await rename(stage, finalDir);
  return summary;
}
