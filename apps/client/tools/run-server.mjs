#!/usr/bin/env node
/**
 * Runs the real @fq/server, which serves this client's production bundle itself
 * (FQ_CLIENT_DIR), for playing locally and for the end-to-end tests.
 *
 *   node tools/run-server.mjs                 build the client, serve game and client on :8080
 *   node tools/run-server.mjs --test          temporary database, loose rate limits, fast hashing
 *
 * Options (or the matching FQ_RUN_* environment variables):
 *   --port <n>     listen port (default 8080; 18765 with --test)
 *   --db <path>    SQLite file (default apps/client/.data/fq.sqlite; a temp file with --test)
 *   --out <dir>    build the bundle into (and serve it from) this directory instead of dist-build
 *                  (FQ_RUN_OUT); the end-to-end runs use one per run
 *   --no-build     use the bundle as it is
 *   --after <url>  wait until this address answers before starting (a second server that shares
 *                  the first one's build)
 *   --museum       also serve the original 2001 Flash client at /museum/ (FQ_LEGACY_CLIENT=1)
 *   --towns <set>  which default towns a fresh database gets: classic, expanded or both
 *                  (FQ_DEFAULT_TOWNS). With --test the default is classic, which is what the
 *                  Classic specs play in; without it the server's own default (both) stands.
 *   --test         the settings above for tests
 *
 * It stops the server (and removes a temporary database) on SIGINT and SIGTERM.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const clientDir = resolve(here, "..");
const serverDir = resolve(clientDir, "../server");
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const test = flag("test") || process.env.FQ_RUN_TEST === "1";
const port = Number(option("port", process.env.FQ_RUN_PORT ?? (test ? "18765" : "8080")));
const museum = flag("museum") || process.env.FQ_RUN_MUSEUM === "1";
const skipBuild = flag("no-build") || process.env.FQ_RUN_SKIP_BUILD === "1";
const outDir = option("out", process.env.FQ_RUN_OUT ?? "");
const towns = option("towns", process.env.FQ_RUN_TOWNS ?? (test ? "classic" : ""));

const after = option("after", "");
while (after) {
  try {
    if ((await fetch(after)).ok) break;
  } catch {
    // not up yet
  }
  await new Promise((resolve) => setTimeout(resolve, 300));
}

if (!skipBuild) {
  // The tests build the bundle without the type check, which has its own step in CI and must not
  // stand in the way of a test run when another part of the repository is mid-edit.
  const build = spawnSync("pnpm", ["run", test ? "bundle" : "build"], {
    cwd: clientDir,
    stdio: "inherit",
    env: { ...process.env, ...(outDir ? { FQ_BUILD_OUT: resolve(outDir) } : {}) },
  });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

let tempDir = null;
let dbPath = option("db", process.env.FQ_RUN_DB);
if (!dbPath) {
  if (test) {
    tempDir = mkdtempSync(join(tmpdir(), "fq-e2e-"));
    dbPath = join(tempDir, "fq.sqlite");
  } else {
    mkdirSync(join(clientDir, ".data"), { recursive: true });
    dbPath = join(clientDir, ".data", "fq.sqlite");
  }
}

const baseEnv = {
  ...process.env,
  FQ_HOST: "127.0.0.1",
  FQ_DB_PATH: dbPath,
  FQ_LOG_LEVEL: process.env.FQ_LOG_LEVEL ?? (test ? "warn" : "info"),
  ...(towns ? { FQ_DEFAULT_TOWNS: towns } : {}),
  ...(test
    ? {
        // Many accounts are made in a minute; keep the brakes off and the hashing quick.
        FQ_RATE_AUTH_MAX: "100000",
        FQ_RATE_ACTION_MAX: "100000",
        FQ_RATE_GLOBAL_MAX: "1000000",
        FQ_ARGON2_MEMORY_KIB: "8",
        FQ_ARGON2_PASSES: "1",
        // The e2e specs use the admin API to start a new day, broadcast and kick.
        FQ_ADMIN_TOKEN: "e2e-admin-token-0123456789abcdef",
      }
    : {}),
};

const tsx = join(serverDir, "node_modules", ".bin", "tsx");
const env = {
  ...baseEnv,
  FQ_PORT: String(port),
  FQ_CLIENT_DIR:
    process.env.FQ_RUN_CLIENT_DIR ?? (outDir ? resolve(outDir) : join(clientDir, "dist-build")),
  ...(museum ? { FQ_LEGACY_CLIENT: "1" } : {}),
};
const child = spawn(tsx, ["src/main.ts"], { cwd: serverDir, env, stdio: "inherit" });
child.on("exit", (code) => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  process.exit(code ?? 0);
});

const stop = () => child.kill("SIGTERM");
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
if (!test) {
  console.log(`Funeral Quest: http://127.0.0.1:${port}/  (database ${dbPath})`);
  if (museum) console.log(`The original 2001 client: http://127.0.0.1:${port}/museum/`);
}
