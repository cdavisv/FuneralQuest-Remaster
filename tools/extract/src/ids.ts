import path from "node:path";

/**
 * Asset id from a legacy URL or path: drop the leading `flash/` and the `.swf`, lowercase,
 * forward slashes. `flash\places\bank.swf` is `places/bank`; `flash/wait.swf` is `wait`.
 * Also accepts a path inside the flash directory without the `flash/` prefix.
 */
export function assetId(legacyPath: string): string {
  let p = legacyPath.replace(/\\/g, "/").replace(/^\/+/, "");
  p = p.replace(/^(?:\.\/)?flash\//i, "");
  p = p.replace(/\.swf$/i, "");
  return p.toLowerCase();
}

/** Category of a picture id: its folder, or `misc` for files at the top of the flash folder. */
export function categoryOf(id: string): string {
  const i = id.indexOf("/");
  return i < 0 ? "misc" : id.slice(0, i);
}

/** Path of the SWF relative to the repository root, using forward slashes. */
export function sourcePath(repoRoot: string, abs: string): string {
  return path.relative(repoRoot, abs).split(path.sep).join("/");
}

/**
 * Every spelling of a picture URL the old server could send for a file. The server code uses
 * both `flash\\places\\x.swf` (C++ strings) and `flash/places/x.swf` (data files), and the data
 * files lowercase the Ring folder, so lowercase variants are included.
 */
export function legacyUrlVariants(relFromFlashDir: string): string[] {
  const fwd = `flash/${relFromFlashDir.replace(/\\/g, "/")}`;
  const set = new Set<string>();
  for (const v of [fwd, fwd.toLowerCase()]) {
    set.add(v);
    set.add(v.replace(/\//g, "\\"));
  }
  return [...set];
}
