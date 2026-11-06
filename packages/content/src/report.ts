import type { ImportNote } from "./legacy.js";

/** The plain-text report of everything unusual in the legacy files, stable across runs. */
export function renderReport(notes: readonly ImportNote[]): string {
  const sorted = [...notes].sort(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      (a.level === b.level ? 0 : a.level === "warning" ? -1 : 1) ||
      (a.line ?? 0) - (b.line ?? 0),
  );
  const warnings = sorted.filter((n) => n.level === "warning");
  const out = [
    "Import report for packs/vintage (written by the importer; not read by any loader).",
    "",
    `Warnings (${warnings.length}): malformed lines and unresolved references. Reported, never fixed.`,
  ];
  const line = (n: ImportNote): string =>
    `  ${n.file}${n.line === undefined ? "" : `:${n.line}`}: ${n.message}`;
  out.push(...(warnings.length ? warnings.map(line) : ["  none"]));
  const infos = sorted.filter((n) => n.level === "info");
  out.push("", `Parser quirks applied (${infos.length}):`);
  out.push(...(infos.length ? infos.map(line) : ["  none"]));
  return `${out.join("\n")}\n`;
}
