#!/usr/bin/env node
/**
 * Builds the free solo-only web game for GitHub Pages (owner's decision 14, 2026-11-06): the
 * client with online play switched off (VITE_SOLO_ONLY=1, the same flag as the mobile app), the
 * Classic art, every sound pack and the character voices, and every URL relative to the site's sub-path
 * (https://<user>.github.io/<repo>/). The workflow .github/workflows/pages.yml runs it; the
 * end-to-end suite runs it to serve the output from a sub-path of its own.
 *
 *   node tools/build-pages.mjs --base /FuneralQuest-Remaster/ [--out <dir>] [--after <url>]
 *
 * With --after it waits until that address answers first (the end-to-end run builds one bundle
 * at a time: both builds write the derived UI art).
 *
 * Writes the site to --out (default dist-pages) and checks what it wrote.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const clientDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const base = option("base", process.env.FQ_BASE ?? "");
if (!/^\/[\w.~-]+(\/[\w.~-]+)*\/?$/.test(base)) {
  console.error("pages: give the sub-path with --base, for example --base /FuneralQuest-Remaster/");
  process.exit(1);
}
const out = resolve(option("out", join(clientDir, "dist-pages")));

const after = option("after", "");
while (after) {
  try {
    if ((await fetch(after)).ok) break;
  } catch {
    // not up yet
  }
  await new Promise((resolve) => setTimeout(resolve, 300));
}

// The Classic art, all three sound packs and the character voices (decision 24), from this site's
// own sub-path: no server address, no art or sound hosted elsewhere. (Unset, not empty: an empty
// value would still count as one.)
const env = {
  ...process.env,
  VITE_SOLO_ONLY: "1",
  FQ_BASE: base,
  FQ_BUILD_OUT: out,
  FQ_AUDIO_PACKS: "synth,studio,remaster,voice",
};
for (const name of [
  "VITE_SERVER_URL",
  "VITE_ASSET_BASE",
  "VITE_AUDIO_BASE",
  "VITE_AUDIO_STUDIO_BASE",
  "VITE_MOCK",
  "FQ_BUNDLE_ASSETS",
  "FQ_BUNDLE_AUDIO",
]) {
  delete env[name];
}
const build = spawnSync("pnpm", ["run", "build"], { cwd: clientDir, stdio: "inherit", env });
if (build.status !== 0) process.exit(build.status ?? 1);

// Check what was built.
const info = JSON.parse(readFileSync(join(out, "build-info.json"), "utf8"));
const want = base.endsWith("/") ? base : `${base}/`;
if (info.soloOnly !== true || info.base !== want) {
  console.error(`pages: the build says ${JSON.stringify(info)}, wanted soloOnly and base ${want}`);
  process.exit(1);
}
for (const file of [
  "index.html",
  "sw.js",
  "manifest.webmanifest",
  "offline.html",
  "audio/manifest.json",
  "audio-studio/manifest.json",
  "audio-remaster/manifest.json",
  "voice/manifest.json",
]) {
  if (!existsSync(join(out, file))) {
    console.error(`pages: ${file} is missing from the build`);
    process.exit(1);
  }
}
if (!existsSync(join(out, "classic", "places", "bank.svg"))) {
  console.error("pages: the Classic art is missing from the build");
  process.exit(1);
}
const html = readFileSync(join(out, "index.html"), "utf8");
if (/(?:src|href)="\/(?!\/)/.test(html.replace(new RegExp(`(?:src|href)="${want}`, "g"), ""))) {
  console.error(`pages: index.html has a URL outside ${want}`);
  process.exit(1);
}
// GitHub Pages runs Jekyll over a site unless told not to.
writeFileSync(join(out, ".nojekyll"), "");
console.log(`pages: the solo-only site for ${want} is in ${out}`);
