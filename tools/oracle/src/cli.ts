/**
 * The differential suite: `pnpm --filter @fq/oracle run compare`.
 *
 *   ORACLE_CUSTOMERS  customers to compare (default 10000)
 *   ORACLE_WALKS      walks per family (default 40)
 *   ORACLE_FAMILIES   comma-separated family names (default all)
 *
 * Writes build/report.json and prints a summary.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BUILD_DIR } from "../scripts/config.js";
import { COMMAND_NAMES } from "./coverage.js";
import { oracleAvailable } from "./oracle.js";
import { runSuite } from "./suite.js";

if (!oracleAvailable()) {
  console.error("The oracle is not built. Run: pnpm --filter @fq/oracle run build");
  process.exit(1);
}

const customers = Number(process.env.ORACLE_CUSTOMERS ?? 10000);
const walksPerFamily = Number(process.env.ORACLE_WALKS ?? 40);
const families = process.env.ORACLE_FAMILIES?.split(",").map((s) => s.trim());
const started = Date.now();
const report = await runSuite({
  customers,
  walksPerFamily,
  ...(families ? { families } : {}),
  log: (line) => console.log(line),
});
mkdirSync(BUILD_DIR, { recursive: true });
const file = join(BUILD_DIR, "report.json");
writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);

console.log("\n== Summary");
const c = report.customers;
console.log(
  `create_random_customer: ${c.exact} of ${c.seeds} seeds identical (${c.mismatches.length} field mismatches)`,
);
let steps = 0;
let matched = 0;
for (const f of report.families) {
  steps += f.steps;
  matched += f.matched;
  console.log(
    `${f.name.padEnd(12)} ${String(f.fullyMatched).padStart(4)}/${f.walks} walks identical  ` +
      `${f.matched}/${f.steps} steps`,
  );
  for (const d of f.divergences.slice(0, 5)) {
    console.log(`   divergence in ${d.walk} at step ${d.index}: ${JSON.stringify(d.step)}`);
    console.log(
      `     draws ${JSON.stringify(d.rng)} state ${JSON.stringify(d.state).slice(0, 300)}`,
    );
  }
  for (const g of f.flows.slice(0, 6)) console.log(`   screen flow x${g.count}: ${g.key}`);
  for (const g of f.transients.slice(0, 6)) console.log(`   transient x${g.count}: ${g.key}`);
  for (const g of f.wordDiffs.slice(0, 6)) console.log(`   words x${g.count}: ${g.key}`);
}
console.log(`all walks: ${matched}/${steps} steps with identical state and draw counts`);
const covered = new Map<string, number>();
const features = new Map<string, number>();
for (const f of report.families) {
  for (const [k, v] of Object.entries(f.coverage.commands))
    covered.set(k, (covered.get(k) ?? 0) + v);
  for (const [k, v] of Object.entries(f.coverage.features))
    features.set(k, (features.get(k) ?? 0) + v);
}
console.log("\nRequests exercised (matched steps):");
for (const [k, name] of Object.entries(COMMAND_NAMES)) {
  console.log(`  ${(covered.get(k) ?? 0).toString().padStart(7)}  ${k.padEnd(8)} ${name}`);
}
const values = new Map<string, Set<string>>();
for (const f of report.families) {
  for (const [k, list] of Object.entries(f.coverage.values)) {
    const set = values.get(k) ?? new Set<string>();
    for (const v of list) set.add(v);
    values.set(k, set);
  }
}
for (const [k, set] of values) console.log(`\nDistinct ${k} values seen: ${set.size}`);
console.log("\nEvents seen (matched steps):");
for (const [k, v] of [...features].sort((a, b) => b[1] - a[1]))
  console.log(`  ${String(v).padStart(7)}  ${k}`);
console.log(`\nReport: ${file} (${((Date.now() - started) / 1000).toFixed(0)} s)`);
