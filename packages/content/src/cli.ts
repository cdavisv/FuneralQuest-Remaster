/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checkPack, formatIssue } from "./check.js";
import { lintPack } from "./lint.js";
import { renderReport } from "./report.js";
import {
  BUILT_DIR,
  expandedAssetIds,
  importVintage,
  loadAssetIds,
  loadBuiltInSources,
  renderBuiltPacks,
  renderSourcePack,
  VINTAGE_DIR,
  writeFiles,
} from "./sources.js";

function differences(dir: string, files: Record<string, string>): string[] {
  return Object.entries(files)
    .filter(([name, text]) => {
      const path = join(dir, name);
      return !existsSync(path) || readFileSync(path, "utf8") !== text;
    })
    .map(([name]) => join(dir, name));
}

function main(argv: string[]): number {
  const [command, ...flags] = argv;
  const check = flags.includes("--check");
  const strict = flags.includes("--strict");
  if (command === "import") {
    const assetIds = loadAssetIds();
    const { pack, notes } = importVintage({ assetIds });
    const files = { ...renderSourcePack(pack), "IMPORT_REPORT.txt": renderReport(notes) };
    const issues = checkPack(pack, { assetIds });
    for (const i of issues) console.error(`schema: ${formatIssue(i)}`);
    if (issues.some((i) => i.kind === "schema")) return 1;
    if (check) {
      const stale = differences(VINTAGE_DIR, files);
      for (const f of stale) console.error(`out of date: ${f}`);
      return stale.length > 0 ? 1 : 0;
    }
    writeFiles(VINTAGE_DIR, files);
    const warnings = notes.filter((n) => n.level === "warning");
    console.log(
      `Imported ${Object.keys(files).length} files into ${VINTAGE_DIR}: ${warnings.length} warnings, ${notes.length - warnings.length} quirk notes (see IMPORT_REPORT.txt).`,
    );
    for (const w of warnings) console.log(`  warning: ${w.file}:${w.line ?? "-"}: ${w.message}`);
    return strict && warnings.length > 0 ? 1 : 0;
  }
  if (command === "build") {
    const files = renderBuiltPacks({ assetIds: loadAssetIds() });
    if (check) {
      const stale = differences(BUILT_DIR, files);
      for (const f of stale) console.error(`out of date: ${f}`);
      return stale.length > 0 ? 1 : 0;
    }
    writeFiles(BUILT_DIR, files);
    console.log(`Built ${Object.keys(files).join(", ")} in ${BUILT_DIR}.`);
    return 0;
  }
  if (command === "lint") {
    // Loads the built-in packs from source and lists every content problem of the Expanded pack.
    // `lint <text>` shows only problems whose file or path contains <text>.
    const filter = flags.find((f) => !f.startsWith("--"));
    const assetIds = loadAssetIds();
    let packs: ReturnType<typeof loadBuiltInSources>;
    try {
      packs = loadBuiltInSources({ assetIds });
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      return 1;
    }
    const issues = lintPack(packs.expanded, {
      base: packs.classic,
      assetIds: expandedAssetIds(assetIds),
    }).filter((i) => filter === undefined || `${i.file} ${i.path}`.includes(filter));
    for (const i of issues) console.error(`${i.kind}: ${formatIssue(i)}`);
    console.log(`${issues.length} problem(s).`);
    return issues.length > 0 ? 1 : 0;
  }
  console.error("usage: cli.ts import|build|lint [--check] [--strict] [filter]");
  return 2;
}

process.exitCode = main(process.argv.slice(2));
