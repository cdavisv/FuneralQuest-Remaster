#!/usr/bin/env node
/**
 * Builds the web client, then assembles apps/mobile/www, the folder Capacitor packs into the
 * apps: the client's bundle (base path "/", exactly the web build) plus the wrapper shim, the
 * mobile glue (bundled with esbuild) and a strict Content-Security-Policy in index.html.
 * The service worker and sourcemaps are left out; the app itself is the offline copy.
 *
 *   FQ_DEFAULT_SERVER=https://fq.example.com   baked-in default server (players can change it)
 *   FQ_SKIP_CLIENT_BUILD=1                     reuse apps/client/dist-build
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");
const www = join(here, "../www");
const built = join(root, "apps/client/dist-build");

if (process.env.FQ_SKIP_CLIENT_BUILD !== "1" || !existsSync(join(built, "index.html"))) {
  const env = { ...process.env };
  delete env.VITE_SERVER_URL;
  const r = spawnSync("pnpm", ["--filter", "@fq/client", "build"], {
    cwd: root,
    stdio: "inherit",
    env,
    shell: process.platform === "win32",
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });
const skip = new Set(["sw.js", "offline.html"]);
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

const server = (process.env.FQ_DEFAULT_SERVER ?? "").trim();
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
  "connect-src 'self' blob: https: wss: http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:* capacitor://localhost",
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
  `window.__FQ_DEFAULT_SERVER__ = ${JSON.stringify(server)};\n`,
);
const indexPath = join(www, "index.html");
const html = readFileSync(indexPath, "utf8");
// After the charset declaration (which must stay near the top), before any script.
const charset = '<meta charset="UTF-8" />';
if (!html.includes(charset)) throw new Error("unexpected index.html: no charset meta");
writeFileSync(indexPath, html.replace(charset, `${charset}\n    ${inject}`));
console.log(`mobile: www assembled (default server: ${server || "none, Solo only until set"})`);
