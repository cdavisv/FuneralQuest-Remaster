#!/usr/bin/env node
/**
 * Measures the production bundle and compares it with the budget in bundle-budget.json.
 *
 *   node tools/check-bundle.mjs                 check dist-build against the budget (exit 1 over)
 *   node tools/check-bundle.mjs --dir <dir>     check another build
 *   node tools/check-bundle.mjs --print         print the measurements as a markdown table
 *   node tools/check-bundle.mjs --suggest       print a budget with 15% headroom over this build
 *
 * What is measured (gzip level 9 for text, so the numbers match what a server sends; sourcemaps
 * are never counted): each entry of the budget is a group of files and a ceiling in bytes.
 * docs/performance.md explains the numbers and how to raise one on purpose.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const dir = resolve(option("dir", join(here, "../dist-build")));
const budgetFile = resolve(option("budget", join(here, "../bundle-budget.json")));

function walk(root) {
  const out = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

const files = walk(dir)
  .map((path) => relative(dir, path).split("\\").join("/"))
  .filter((name) => !name.endsWith(".map"));

const TEXT = /\.(js|css|html|svg|json|webmanifest)$/;
const size = (name) => {
  const bytes = readFileSync(join(dir, name));
  return {
    raw: bytes.length,
    gzip: TEXT.test(name) ? gzipSync(bytes, { level: 9 }).length : bytes.length,
  };
};

/** The groups the budget names, each a test on the file's path. */
const GROUPS = {
  "app.js": (f) => /^assets\/index-.*\.js$/.test(f),
  "app.css": (f) => /^assets\/index-.*\.css$/.test(f),
  "solo-worker.js": (f) => /^assets\/soloWorker-.*\.js$/.test(f),
  "dev-town.js": (f) => /^assets\/ExpandedHost-.*\.js$/.test(f),
  "other-chunks.js": (f) =>
    /^assets\/.*\.js$/.test(f) && !/^assets\/(index|soloWorker|ExpandedHost)-/.test(f),
  // Browsers that can run the game read woff2; the .woff fallbacks are in the total only.
  "fonts (woff2)": (f) => /\.woff2$/.test(f),
  pictures: (f) => f.startsWith("classic/") || /^assets\/.*\.(svg|png|webp)$/.test(f),
  // Sound: the Synth pack, the two ElevenLabs packs the "Automatic" setting also plays
  // (decision 15a) and the character voices. All of it loads on demand; the install fills only
  // Synth and the remaster.
  audio: (f) => f.startsWith("audio/"),
  "audio-studio": (f) => f.startsWith("audio-studio/"),
  "audio-remaster": (f) => f.startsWith("audio-remaster/"),
  voice: (f) => f.startsWith("voice/"),
  // What a first visit downloads to reach the front door: the page, the app's script and style,
  // the fonts the front door uses are loaded on demand, so this is a floor, not a promise.
  "first-load.js+css": (f) => f === "index.html" || /^assets\/index-.*\.(js|css)$/.test(f),
  "total (no audio)": (f) => !/^(audio|audio-studio|audio-remaster|voice)\//.test(f),
  total: () => true,
};

const measured = {};
for (const [group, test] of Object.entries(GROUPS)) {
  const members = files.filter(test);
  let raw = 0;
  let gzip = 0;
  for (const name of members) {
    const s = size(name);
    raw += s.raw;
    gzip += s.gzip;
  }
  measured[group] = { files: members.length, raw, gzip };
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

if (args.includes("--suggest")) {
  const budget = {};
  for (const [group, m] of Object.entries(measured)) {
    // 15% over this build; an empty group may gain a chunk of up to 64 KB.
    budget[group] = {
      maxGzipBytes: m.gzip === 0 ? 64 * 1024 : Math.ceil((m.gzip * 1.15) / 1024) * 1024,
    };
  }
  console.log(
    JSON.stringify(
      { _comment: "Ceilings in bytes (gzip). 15% over the build they were taken from.", ...budget },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (args.includes("--print")) {
  console.log("| Group | Files | Raw | Gzip |\n| --- | ---: | ---: | ---: |");
  for (const [group, m] of Object.entries(measured)) {
    console.log(`| ${group} | ${m.files} | ${kb(m.raw)} | ${kb(m.gzip)} |`);
  }
  process.exit(0);
}

const budget = JSON.parse(readFileSync(budgetFile, "utf8"));
let failed = false;
console.log(`bundle: ${dir}`);
for (const [group, limit] of Object.entries(budget)) {
  if (group.startsWith("_")) continue;
  const m = measured[group];
  if (!m) {
    console.log(`  ?  ${group}: not a known group`);
    failed = true;
    continue;
  }
  const over = m.gzip > limit.maxGzipBytes;
  if (over) failed = true;
  console.log(
    `  ${over ? "OVER" : "ok  "} ${group.padEnd(20)} ${kb(m.gzip).padStart(10)} gzip of ${kb(limit.maxGzipBytes)}`,
  );
}
if (failed) {
  console.error(
    "\nThe bundle is over its budget. If the growth is on purpose, raise the ceiling in apps/client/bundle-budget.json and say why in docs/performance.md.",
  );
  process.exit(1);
}
void statSync;
