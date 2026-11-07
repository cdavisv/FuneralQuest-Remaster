/**
 * `pnpm listen`: serves the listening page (docs/audio/listen.html) and both sound packs on
 * localhost, for places that cannot read files next to a page opened from disk. It serves only
 * docs/audio and assets/audio*, read-only, and supports byte ranges so the players can seek.
 */
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const port = Number(process.env.FQ_LISTEN_PORT ?? 4780);
const ALLOWED = ["docs/audio/", "assets/audio/", "assets/audio-studio/"];
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".json": "application/json",
  ".md": "text/plain; charset=utf-8",
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  let path = decodeURIComponent(url.pathname);
  if (path === "/") {
    res.writeHead(302, { location: "/docs/audio/listen.html" });
    res.end();
    return;
  }
  path = normalize(path)
    .replace(/^[/\\]+/, "")
    .split(sep)
    .join("/");
  if (path.includes("..") || !ALLOWED.some((dir) => path.startsWith(dir))) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const file = join(repo, path);
  let size;
  try {
    const stat = statSync(file);
    if (!stat.isFile()) throw new Error("not a file");
    size = stat.size;
  } catch {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const headers = {
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
    "accept-ranges": "bytes",
    "cache-control": "no-cache",
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
  if (range && (range[1] !== "" || range[2] !== "")) {
    const start = range[1] === "" ? Math.max(0, size - Number(range[2])) : Number(range[1]);
    const end =
      range[1] !== "" && range[2] !== "" ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end || start >= size) {
      res.writeHead(416, { "content-range": `bytes */${size}` });
      res.end();
      return;
    }
    res.writeHead(206, {
      ...headers,
      "content-range": `bytes ${start}-${end}/${size}`,
      "content-length": end - start + 1,
    });
    if (req.method === "HEAD") res.end();
    else createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { ...headers, "content-length": size });
  if (req.method === "HEAD") res.end();
  else createReadStream(file).pipe(res);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Listening page: http://127.0.0.1:${port}/`);
  console.log("Press Ctrl+C to stop.");
});
