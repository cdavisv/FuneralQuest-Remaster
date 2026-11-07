#!/usr/bin/env node
/**
 * Builds the web client and copies the bundle the desktop app serves into apps/desktop/dist.
 * The client is built exactly as it is for the web (base path "/", which is what Tauri's
 * protocol serves); the server address is not baked in (VITE_SERVER_URL stays unset) because
 * the wrapper re-points /api at the address the player configured. Sourcemaps, the service
 * worker and the offline page are left out: a Tauri app has no use for them.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");
const out = join(here, "../dist");
// FQ_BUILD_OUT builds (and reads) the client in a directory of its own, as the client's vite config does.
const built = process.env.FQ_BUILD_OUT
  ? resolve(process.env.FQ_BUILD_OUT)
  : join(root, "apps/client/dist-build");

if (process.env.FQ_SKIP_CLIENT_BUILD !== "1" || !existsSync(join(built, "index.html"))) {
  const env = { ...process.env };
  // Never bake a server into the bundle: the wrapper owns that setting.
  delete env.VITE_SERVER_URL;
  // FQ_SKIP_TYPECHECK=1 builds the bundle without the client's type check (CI checks types in
  // its own job; this is for a tree that is mid-edit elsewhere).
  const script = process.env.FQ_SKIP_TYPECHECK === "1" ? "bundle" : "build";
  const r = spawnSync("pnpm", ["--filter", "@fq/client", script], {
    cwd: root,
    stdio: "inherit",
    env,
    shell: process.platform === "win32",
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const skip = new Set(["sw.js", "offline.html"]);
cpSync(built, out, {
  recursive: true,
  filter: (src) => !src.endsWith(".map") && !skip.has(src.slice(built.length + 1)),
});
// The version and build the client was built as (written by the client's vite config).
const info = JSON.parse(readFileSync(join(built, "build-info.json"), "utf8"));
console.log(`desktop: bundle copied to ${out} (${info.version}, build ${info.build})`);
