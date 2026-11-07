#!/usr/bin/env node
/**
 * A plain static file host for the built client: no API, no WebSocket, no fallback page (an
 * unknown path is a 404, as on any file host). The Solo tests use it to show the game plays with
 * no server at all.
 *
 *   node e2e/static-host.mjs --port 18766 [--after http://127.0.0.1:18765/health]
 *
 * With --prefix /sub/ the site is served under that sub-path and nothing is served outside it, as
 * on GitHub Pages (https://<user>.github.io/<repo>/).
 *
 * With --after it waits until that address answers (the test server finishes building the
 * client before it starts), then serves dist-build (or the directory given with --root).
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const port = Number(option("port", "18766"));
const after = option("after", "");
const prefix = option("prefix", "").replace(/\/+$/, "");
const root = option("root", "")
  ? resolve(option("root", ""))
  : resolve(dirname(fileURLToPath(import.meta.url)), "../dist-build");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".map": "application/json",
};

while (after) {
  try {
    if ((await fetch(after)).ok) break;
  } catch {
    // not up yet
  }
  await new Promise((r) => setTimeout(r, 300));
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  let pathname = decodeURIComponent(url.pathname);
  if (prefix) {
    if (pathname !== `${prefix}/` && !pathname.startsWith(`${prefix}/`)) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not found");
      return;
    }
    pathname = pathname.slice(prefix.length);
  }
  let path = normalize(pathname);
  if (path.endsWith("/")) path += "index.html";
  const file = join(root, path);
  try {
    if (file !== root && !file.startsWith(root + sep)) throw new Error("outside");
    const info = await stat(file);
    if (!info.isFile()) throw new Error("not a file");
    res.writeHead(200, {
      "content-type": TYPES[extname(file)] ?? "application/octet-stream",
      "content-length": info.size,
    });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
  }
}).listen(port, "127.0.0.1", () => console.log(`static host on http://127.0.0.1:${port}/`));
