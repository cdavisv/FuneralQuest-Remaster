/**
 * Which of the exported Classic art a production build carries.
 *
 * `assets/classic` is about 65 MB, mostly `<id>.frames/` folders of animation frames (the client
 * draws each picture from its single `<id>.svg`), the UI sprite sheets in `ui/` (the client
 * derives the few pieces it uses at build time, see tools/derive-ui-art.mjs) and contact
 * sheets for humans. None of that is fetched at run time, so the bundle gets only the
 * single-frame pictures: a few megabytes.
 */
import { cp, mkdir, readdir, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";

/** True for a path (relative to assets/classic, `/` separators) the game can request. */
export function shouldBundle(relPath) {
  const parts = relPath.split("/");
  if (parts.some((p) => p.endsWith(".frames"))) return false;
  if (parts[0] === "ui") return false;
  return relPath.endsWith(".svg");
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

/** Asset ids (`places/bank`) of the Classic pictures a build carries, sorted. */
export async function listArtIds(assetsDir) {
  const source = join(assetsDir, "classic");
  const ids = [];
  try {
    await stat(source);
  } catch {
    return ids;
  }
  for await (const file of walk(source)) {
    const rel = relative(source, file).split(sep).join("/");
    if (shouldBundle(rel)) ids.push(rel.replace(/\.svg$/, ""));
  }
  return ids.sort();
}

/** Copies the bundled subset of `<assetsDir>/classic` into `<outDir>/classic`. Returns count and bytes. */
export async function copyArt(assetsDir, outDir) {
  const source = join(assetsDir, "classic");
  let files = 0;
  let bytes = 0;
  try {
    await stat(source);
  } catch {
    return { files, bytes };
  }
  for await (const file of walk(source)) {
    const rel = relative(source, file).split(sep).join("/");
    if (!shouldBundle(rel)) continue;
    const target = join(outDir, "classic", rel);
    await mkdir(join(target, ".."), { recursive: true });
    await cp(file, target);
    files++;
    bytes += (await stat(file)).size;
  }
  return { files, bytes };
}
