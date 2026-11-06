#!/usr/bin/env node
/**
 * Draws the mobile icons and splash screens from the game's own icon (apps/client/pwa/icon.svg:
 * the gold coffin under the moon) with Inkscape, into the committed native projects:
 *   Android: adaptive launcher icon (background + foreground layers, legacy and round), the
 *            notification small icon (white silhouette) and the splash images (port and land).
 *   iOS:     the 1024 px App Store icon and the splash image.
 * Run only when the drawing changes: `pnpm --filter @fq/mobile icons`.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "../../client/pwa/icon.svg"), "utf8");
const res = join(here, "../android/app/src/main/res");
const iosAssets = join(here, "../ios/App/App/Assets.xcassets");
const work = join(tmpdir(), "fq-mobile-icons");
mkdirSync(work, { recursive: true });

const defs = source.match(/<defs>[\s\S]*?<\/defs>/)[0];
const coffin = source.match(/<g transform="translate\(256 276\)">[\s\S]*?<\/g>/)[0];
const BG = "#070b12";

/** An SVG document of `w` x `h` with `body` drawn in a 512-unit square centred in it. */
const doc = (w, h, body, scale = 1, bg = BG) => {
  const s = (Math.min(w, h) / 512) * scale;
  const tx = (w - 512 * s) / 2;
  const ty = (h - 512 * s) / 2;
  const back = bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs}${back}<g transform="translate(${tx} ${ty}) scale(${s})">${body}</g></svg>`;
};
const background = source.slice(
  source.indexOf('<rect width="512"'),
  source.indexOf('<g transform="translate(256 276)">'),
);
const silhouette = `<mask id="cut" maskUnits="userSpaceOnUse" x="-200" y="-200" width="400" height="400"><rect x="-200" y="-200" width="400" height="400" fill="#fff"/><path d="M0 -92 V86 M-46 -34 H46" stroke="#000" stroke-width="22" stroke-linecap="round"/></mask><g transform="translate(256 276)"><path d="M-92 -150 H92 L132 -70 L84 150 H-84 L-132 -70 Z" fill="#fff" mask="url(#cut)"/></g>`;

let n = 0;
function render(svg, outFile, w, h) {
  const tmp = join(work, `${n++}.svg`);
  writeFileSync(tmp, svg);
  mkdirSync(dirname(outFile), { recursive: true });
  const r = spawnSync(
    "inkscape",
    [tmp, "--export-type=png", `--export-filename=${outFile}`, "-w", String(w), "-h", String(h)],
    { stdio: "inherit" },
  );
  if (r.status !== 0) throw new Error("inkscape failed");
}

const dpi = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [name, d] of Object.entries(dpi)) {
  const dir = join(res, `mipmap-${name}`);
  // Adaptive layers are 108 dp; the coffin is kept inside the central 66 dp safe zone.
  render(
    doc(108 * d, 108 * d, background, 1, null),
    join(dir, "ic_launcher_background.png"),
    108 * d,
    108 * d,
  );
  render(
    doc(108 * d, 108 * d, coffin, 0.8, null),
    join(dir, "ic_launcher_foreground.png"),
    108 * d,
    108 * d,
  );
  // Pre-API-26 launchers, full icon; the round one is the same drawing clipped by the system.
  render(doc(48 * d, 48 * d, background + coffin, 1), join(dir, "ic_launcher.png"), 48 * d, 48 * d);
  render(
    doc(48 * d, 48 * d, background + coffin, 1),
    join(dir, "ic_launcher_round.png"),
    48 * d,
    48 * d,
  );
  // Notification small icon: a white silhouette on transparent, 24 dp.
  render(
    doc(24 * d, 24 * d, silhouette, 1.15, null),
    join(res, `drawable-${name}`, "ic_stat_icon.png"),
    24 * d,
    24 * d,
  );
}
for (const f of ["ic_launcher.xml", "ic_launcher_round.xml"]) {
  writeFileSync(
    join(res, "mipmap-anydpi-v26", f),
    `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@mipmap/ic_launcher_background"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n    <monochrome android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n`,
  );
}
// The generated vector placeholders from the Capacitor template are replaced by the PNG layers.
rmSync(join(res, "drawable/ic_launcher_background.xml"), { force: true });
rmSync(join(res, "drawable-v24/ic_launcher_foreground.xml"), { force: true });

// Splash: the coffin on the game's night blue, portrait and landscape.
const splash = {
  "": [480, 320],
  hdpi: [800, 480],
  mdpi: [480, 320],
  xhdpi: [1280, 720],
  xxhdpi: [1600, 960],
  xxxhdpi: [1920, 1280],
};
const splashDoc = (w, h) => doc(w, h, coffin, 0.7);
render(splashDoc(480, 320), join(res, "drawable/splash.png"), 480, 320);
for (const [name, [long, short]] of Object.entries(splash)) {
  if (!name) continue;
  render(splashDoc(short, long), join(res, `drawable-port-${name}/splash.png`), short, long);
  render(splashDoc(long, short), join(res, `drawable-land-${name}/splash.png`), long, short);
}

// iOS.
render(
  doc(1024, 1024, background + coffin, 1),
  join(iosAssets, "AppIcon.appiconset/AppIcon-512@2x.png"),
  1024,
  1024,
);
const splashIos = join(iosAssets, "Splash.imageset/splash-2732x2732.png");
render(doc(2732, 2732, coffin, 0.55), splashIos, 2732, 2732);
copyFileSync(splashIos, join(iosAssets, "Splash.imageset/splash-2732x2732-1.png"));
copyFileSync(splashIos, join(iosAssets, "Splash.imageset/splash-2732x2732-2.png"));
rmSync(work, { recursive: true, force: true });
console.log("icons: done");
