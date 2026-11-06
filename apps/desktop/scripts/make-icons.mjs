#!/usr/bin/env node
/**
 * Draws the desktop app icons from the game's own icon (apps/client/pwa/icon.svg, the coffin
 * under the moon) with Inkscape, then lets `tauri icon` produce every size, .ico and .icns.
 * The results are committed; run this only when the drawing changes: `pnpm --filter @fq/desktop icons`.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const svg = join(here, "../../client/pwa/icon.svg");
const png = join(here, "../src-tauri/icons/source-1024.png");
const run = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd });
  if (r.status !== 0) throw new Error(`${cmd} failed`);
};
mkdirSync(dirname(png), { recursive: true });
run("inkscape", [svg, "--export-type=png", `--export-filename=${png}`, "-w", "1024", "-h", "1024"]);
run("pnpm", ["exec", "tauri", "icon", png], join(here, ".."));
// `tauri icon` also writes Android and iOS sets; the mobile app has its own (apps/mobile).
rmSync(join(here, "../src-tauri/icons/android"), { recursive: true, force: true });
rmSync(join(here, "../src-tauri/icons/ios"), { recursive: true, force: true });
