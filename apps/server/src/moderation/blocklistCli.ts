import { readFileSync } from "node:fs";
import { hashLine } from "./blocklist.js";

/**
 * `pnpm --filter @fq/server blocklist:hash words.txt > blocklist.txt`
 * Turns a plain word list (one entry per line) into the hashed form the server loads, so the
 * plain list can be kept off the server and out of version control.
 */
const file = process.argv[2];
if (!file) {
  process.stderr.write("usage: blocklist:hash <plain word list>\n");
  process.exit(2);
}
for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
  const hashed = hashLine(line);
  if (hashed !== null) process.stdout.write(`${hashed}\n`);
}
