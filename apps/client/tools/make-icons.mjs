#!/usr/bin/env node
/**
 * Rasterises pwa/icon.svg into the PNG icons the web app manifest needs, using the Chromium
 * that Playwright installed for the e2e suite. The PNGs are committed; run this only when
 * the drawing changes: `node tools/make-icons.mjs`.
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const svg = await readFile(join(here, "../pwa/icon.svg"), "utf8");
const out = join(here, "../pwa/icons");

/** `pad` shrinks the drawing inside the canvas: maskable icons keep to the central 80%. */
const targets = [
  { file: "icon-192.png", size: 192, pad: 0 },
  { file: "icon-512.png", size: 512, pad: 0 },
  { file: "icon-maskable-512.png", size: 512, pad: 0.12 },
  { file: "apple-touch-icon.png", size: 180, pad: 0 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { file, size, pad } of targets) {
  await page.setViewportSize({ width: size, height: size });
  const inner = Math.round(size * (1 - pad * 2));
  const offset = Math.round(size * pad);
  const data = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  await page.setContent(
    `<body style="margin:0;background:#070b12"><img src="${data}" style="position:absolute;left:${offset}px;top:${offset}px;width:${inner}px;height:${inner}px"></body>`,
  );
  await page.waitForFunction(() => document.images[0]?.complete);
  await writeFile(join(out, file), await page.screenshot({ type: "png" }));
  console.log(`icons: ${file}`);
}
await browser.close();
