#!/usr/bin/env node
/**
 * Derives clean UI SVGs for the art packs from the exported originals in assets/classic/ui.
 * Run by `pnpm --filter @fq/client art` and automatically before dev, build and test.
 * Never writes to assets/.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deriveUiSvg } from "./svg-clean.mjs";
import { CLASSIC_UI } from "./ui-art.config.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const sourceDir = join(here, "../../../assets/classic/ui");
const outDir = join(here, "../src/art/packs/classic/ui");

await mkdir(outDir, { recursive: true });
let total = 0;
for (const [name, recipe] of Object.entries(CLASSIC_UI)) {
  const source = await readFile(join(sourceDir, `${recipe.from}.svg`), "utf8");
  const { svg, report } = deriveUiSvg(source, recipe);
  // Written whole, then moved into place: another build running at the same time (two end-to-end
  // runs, say) never reads a half-written file.
  const target = join(outDir, `${name}.svg`);
  const temp = `${target}.${process.pid}.tmp`;
  await writeFile(temp, svg);
  await rename(temp, target);
  total += svg.length;
  if (process.argv.includes("--verbose")) {
    console.log(
      `${name}: ${report.textRemoved} text, ${report.pathsRemoved} paths removed, ${svg.length} bytes`,
    );
  }
}
console.log(
  `art: derived ${Object.keys(CLASSIC_UI).length} UI pieces (${Math.round(total / 1024)} KB)`,
);
