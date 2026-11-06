import path from "node:path";
import { exportAll } from "./export.js";

const repoRoot = path.resolve(import.meta.dirname, "../../..");

const t0 = Date.now();
const s = await exportAll(repoRoot);
console.log(`SWFs converted: ${s.swfsConverted}`);
console.log(`SVGs written:   ${s.svgsWritten}`);
console.log(`Assets by kind: ${JSON.stringify(s.counts)}`);
console.log(`Needs redraw:   ${s.needsRedraw.join(", ")}`);
console.log(`Failures:       ${s.failures.length}`);
for (const f of s.failures) console.error(`  FAIL ${f.file}: ${f.error}`);
console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
if (s.failures.length > 0) {
  console.error(
    "Export failed; assets/classic was left untouched (staging in assets/.classic-staging).",
  );
  process.exit(1);
}
