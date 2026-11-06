import { readFileSync, writeFileSync } from "node:fs";
import { type SimReport, toMarkdown } from "./report.js";

/**
 * Rewrites a report's Markdown from its JSON (after a change to the report's
 * layout), keeping the hand-written reading above the first "---" line of the
 * existing Markdown. Usage: `pnpm --filter @fq/sim exec tsx src/remark.ts PATH`
 * (PATH without the extension).
 */
const base = process.argv[2];
if (!base) throw new Error("Usage: remark PATH");
const report = JSON.parse(readFileSync(`${base}.json`, "utf8")) as SimReport;
let head = "";
try {
  const old = readFileSync(`${base}.md`, "utf8");
  const cut = old.indexOf("\n---\n");
  if (cut >= 0) head = old.slice(0, cut + 5);
} catch {
  // No Markdown yet.
}
const md = toMarkdown(report);
writeFileSync(`${base}.md`, head === "" ? md : `${head}\n${md.replace(/^# [^\n]*\n\n/, "")}`);
console.log(`Wrote ${base}.md`);
