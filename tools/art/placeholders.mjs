#!/usr/bin/env node
/**
 * Writes the Classic pack's stand-in buildings for the eight Expanded places of docs/expanded-rules.md
 * sections 30 and 31 (apps/client/src/art/packs/classic/placeholders/building-<id>.svg): the same
 * buildings as the Remastered pieces (tools/art/pieces/buildings8.mjs) drawn flat, with plain fills
 * and no texture lines, like the City Hall and Reaper Club stand-ins. The original game has no
 * building for these, so nothing original is replaced; a pack that draws a real piece wins.
 *
 *   node tools/art/placeholders.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BUILDINGS } from "./pieces/buildings8.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(
  here,
  "..",
  "..",
  "apps",
  "client",
  "src",
  "art",
  "packs",
  "classic",
  "placeholders",
);
mkdirSync(dir, { recursive: true });
for (const [id, render] of Object.entries(BUILDINGS)) {
  const svg = render(true).replace(/^<svg /, '<svg data-placeholder="true" ');
  writeFileSync(join(dir, `building-${id}.svg`), svg);
}
console.log(`placeholders: wrote ${Object.keys(BUILDINGS).length} building stand-ins`);
