import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * Measurements, not tests: `pnpm --filter @fq/client perf` builds the client into a directory of
 * its own, starts the real server on a temporary database, and runs perf/perf.spec.ts in
 * Chromium, which prints its numbers and writes them to perf/results.json. docs/performance.md
 * keeps the figures and the budget. Run it on a quiet machine: the numbers are timings.
 */
const free = (): number =>
  Number(
    execFileSync(
      process.execPath,
      [
        "-e",
        'const s=require("node:net").createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})',
      ],
      { encoding: "utf8" },
    ).trim(),
  );

if (!process.env.FQ_PERF_PORT) {
  process.env.FQ_PERF_PORT = String(free());
  process.env.FQ_PERF_CDP = String(free());
  process.env.FQ_PERF_DIST = join(tmpdir(), `fq-perf-${process.pid}`, "dist");
}
const port = Number(process.env.FQ_PERF_PORT);
const dist = process.env.FQ_PERF_DIST as string;

export default defineConfig({
  testDir: ".",
  outputDir: join(tmpdir(), `fq-perf-${process.pid}`, "results"),
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 15 * 60_000,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 720 },
    storageState: {
      cookies: [],
      origins: [
        {
          origin: `http://127.0.0.1:${port}`,
          localStorage: [{ name: "fq.conduct", value: "1" }],
        },
      ],
    },
  },
  webServer: {
    cwd: join(import.meta.dirname, ".."),
    command: `node tools/run-server.mjs --test --port ${port} --out ${JSON.stringify(dist)}`,
    url: `http://127.0.0.1:${port}/health`,
    reuseExistingServer: false,
    timeout: 240_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
