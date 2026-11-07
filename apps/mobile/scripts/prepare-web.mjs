#!/usr/bin/env node
/**
 * Builds the web client, then assembles apps/mobile/www, the folder Capacitor packs into the
 * apps: the client's bundle (base path "/", exactly the web build) plus the wrapper shim, the
 * mobile glue (bundled with esbuild) and a strict Content-Security-Policy in index.html.
 * The service worker and sourcemaps are left out; the app itself is the offline copy.
 *
 * The first mobile release is solo-only (owner's decision 11, 2026-11-06): the bundle is built
 * with VITE_SOLO_ONLY=1, so it has no server address, log-on, chat or Daily Challenge board and
 * makes no network request, and the Content-Security-Policy allows none. When online play comes
 * to mobile, build with FQ_SOLO_ONLY=0 (and put INTERNET back in the Android manifest, see
 * docs/release/checklist-google-play.md).
 *
 *   FQ_SOLO_ONLY=0                             build the online-capable client instead (default 1)
 *   FQ_DEFAULT_SERVER=https://fq.example.com   baked-in default server (online builds only)
 *   FQ_SKIP_CLIENT_BUILD=1                     reuse apps/client/dist-build (it must have been built the same way)
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");
const www = join(here, "../www");
// FQ_BUILD_OUT builds (and reads) the client in a directory of its own, as the client's vite config does.
const built = process.env.FQ_BUILD_OUT
  ? resolve(process.env.FQ_BUILD_OUT)
  : join(root, "apps/client/dist-build");
const soloOnly = process.env.FQ_SOLO_ONLY !== "0";

if (process.env.FQ_SKIP_CLIENT_BUILD !== "1" || !existsSync(join(built, "index.html"))) {
  const env = { ...process.env };
  for (const name of [
    "VITE_SERVER_URL",
    "VITE_ASSET_BASE",
    "VITE_AUDIO_BASE",
    "VITE_AUDIO_STUDIO_BASE",
    "VITE_MOCK",
  ])
    delete env[name];
  env.VITE_SOLO_ONLY = soloOnly ? "1" : "";
  delete env.FQ_BASE; // the app is served from its own origin's root
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

// A reused bundle must be the kind that was asked for.
const info = JSON.parse(readFileSync(join(built, "build-info.json"), "utf8"));
if (info.soloOnly !== soloOnly || info.base !== "/") {
  throw new Error(
    `apps/client/dist-build was built with soloOnly=${info.soloOnly}, base=${info.base}; this build wants soloOnly=${soloOnly}, base=/. Build it again (unset FQ_SKIP_CLIENT_BUILD).`,
  );
}

rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });
const skip = new Set(["sw.js", "offline.html", "build-info.json"]);
cpSync(built, www, {
  recursive: true,
  filter: (src) => !src.endsWith(".map") && !skip.has(src.slice(built.length + 1)),
});

// The shared shim is copied as-is; the glue is bundled with the Capacitor plugins it imports.
cpSync(join(here, "../../desktop/shim/fq-wrapper.js"), join(www, "fq-wrapper.js"));
await build({
  entryPoints: [join(here, "../glue/fq-mobile.ts")],
  outfile: join(www, "fq-mobile.js"),
  bundle: true,
  format: "iife",
  target: "es2022",
  minify: true,
  legalComments: "none",
});

const server = soloOnly ? "" : (process.env.FQ_DEFAULT_SERVER ?? "").trim();
// Connections: the bundle itself, the configured server over https/wss, and localhost for
// development servers. Capacitor's bridge uses the page's own origin.
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  // Solo-only: the page may fetch only its own files (the bundle is served from the app itself).
  soloOnly
    ? "connect-src 'self' blob:"
    : "connect-src 'self' blob: https: wss: http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:* capacitor://localhost",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");
const inject = [
  `<meta http-equiv="Content-Security-Policy" content="${csp}" />`,
  // A tiny classic script defines the default server; it must be an external file under this CSP.
  `<script src="/fq-config.js"></script>`,
  `<script src="/fq-wrapper.js"></script>`,
  `<script src="/fq-mobile.js"></script>`,
].join("\n    ");
writeFileSync(
  join(www, "fq-config.js"),
  `window.__FQ_DEFAULT_SERVER__ = ${JSON.stringify(server)};\nwindow.__FQ_SOLO_ONLY__ = ${soloOnly};\n`,
);
const indexPath = join(www, "index.html");
const html = readFileSync(indexPath, "utf8");
// After the charset declaration (which must stay near the top), before any script.
const charset = '<meta charset="UTF-8" />';
if (!html.includes(charset)) throw new Error("unexpected index.html: no charset meta");
writeFileSync(indexPath, html.replace(charset, `${charset}\n    ${inject}`));
console.log(
  soloOnly
    ? "mobile: www assembled (solo-only: no online play, no network access)"
    : `mobile: www assembled (online-capable; default server: ${server || "none, Solo only until set"})`,
);
