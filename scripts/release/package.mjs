#!/usr/bin/env node
/**
 * Builds and names the files of an alpha release, the same way on a laptop and in
 * .github/workflows/release.yml (which calls these steps). Nothing here publishes anything:
 * the files land in release-out/ and that is all.
 *
 *   node scripts/release/package.mjs web-online     the online-capable web bundle (zip + README)
 *   node scripts/release/package.mjs web-solo       the solo-only web bundle (zip + README)
 *   node scripts/release/package.mjs server         the server tarball (bundle, client, Dockerfile)
 *   node scripts/release/package.mjs desktop        collects the Linux .deb and AppImage that
 *                                                   `tauri build` made (apps/desktop)
 *   node scripts/release/package.mjs android        collects the debug and unsigned release APKs
 *                                                   that scripts/build-android.mjs made
 *   node scripts/release/package.mjs checksums      writes SHA256SUMS for everything in release-out/
 *   node scripts/release/package.mjs list           prints each file with its size
 *
 * Every artifact name carries the version (root package.json) and the build hash is written into
 * the files: build-info.json in the web bundles, version.json in the server tarball.
 * Environment: FQ_BUILD (the short commit; CI sets it), VITE_FEEDBACK_DESTINATION (where the
 * in-game feedback text is told to go), FQ_RELEASE_OUT (another output directory).
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readVersion } from "../version.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const out = resolve(process.env.FQ_RELEASE_OUT ?? join(root, "release-out"));
const work = join(out, ".work");
const v = readVersion();
const stem = `funeral-quest-${v.version}`;
// Passed down to every child build, so the version and build hash reach all of them.
process.env.FQ_BUILD = v.build;

const fail = (message) => {
  console.error(`release: ${message}`);
  process.exit(1);
};
const run = (cmd, args, options = {}) => {
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit", ...options });
  if (r.status !== 0) fail(`${cmd} ${args.join(" ")} failed`);
};
const size = (bytes) =>
  bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} kB`;
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );

mkdirSync(out, { recursive: true });

/** Builds the web client into `<work>/<name>` the way this edition needs. */
function buildClient(name, soloOnly) {
  const dir = join(work, name);
  rmSync(dir, { recursive: true, force: true });
  const env = { ...process.env, FQ_BUILD_OUT: dir, FQ_AUDIO_PACKS: "synth,studio,remaster,voice" };
  // Nothing hosted elsewhere, no baked-in server: the bundle is the whole site.
  for (const k of [
    "VITE_SERVER_URL",
    "VITE_ASSET_BASE",
    "VITE_AUDIO_BASE",
    "VITE_AUDIO_STUDIO_BASE",
    "VITE_MOCK",
    "FQ_BASE",
    "FQ_BUNDLE_ASSETS",
    "FQ_BUNDLE_AUDIO",
  ]) {
    delete env[k];
  }
  if (soloOnly) env.VITE_SOLO_ONLY = "1";
  else delete env.VITE_SOLO_ONLY;
  run("pnpm", ["--filter", "@fq/client", "build"], { env });
  const info = JSON.parse(readFileSync(join(dir, "build-info.json"), "utf8"));
  if (info.soloOnly !== soloOnly || info.base !== "/") fail(`bundle says ${JSON.stringify(info)}`);
  if (info.version !== v.version || info.build !== v.build) {
    fail(`bundle is ${info.version} (${info.build}), wanted ${v.version} (${v.build})`);
  }
  for (const f of ["index.html", "sw.js", "manifest.webmanifest", "audio/manifest.json"]) {
    if (!existsSync(join(dir, f))) fail(`${f} is missing from the bundle`);
  }
  if (existsSync(join(dir, "audio-studio"))) fail("the Studio sound pack is in the bundle");
  return dir;
}

const header = `FuneralQuest Remastered ${v.label} (build ${v.build}), version ${v.version}`;

function webReadme(soloOnly) {
  const common = `${header}
${soloOnly ? "Solo-only web bundle" : "Online-capable web bundle"}

This is the game's web client as plain static files. It is an ALPHA: expect rough edges, and
please report what you find (Settings, "Send feedback", has a prefilled report).

Contents: index.html, assets/, classic/ (the original art), audio/ (the Synth sound pack),
sw.js and manifest.webmanifest (so it installs and plays Solo with no connection),
build-info.json (the version and build).

Serve it from the ROOT of a site (it is built for the base path "/"). Any static file host works:

    unzip ${stem}-web-${soloOnly ? "solo" : "online"}.zip -d site
    python3 -m http.server -d site 8000        # then open http://localhost:8000

Opening index.html straight from the disk (file://) does not work: browsers refuse module
scripts and workers from files.
`;
  if (soloOnly) {
    return `${common}
This edition has NO online play: no server address, no log-on, no chat, no Daily Challenge
board. Solo (a whole town of computer rivals, run in your browser, saved on your device) is the
entire game, and the page makes no network request of its own. It is the same build the
Android app uses.

To serve it from a sub-path (such as GitHub Pages' /repo/) it must be built for that path:
FQ_BASE=/repo/ VITE_SOLO_ONLY=1 pnpm --filter @fq/client build (from the source tree).
`;
  }
  return `${common}
Solo works on any static host. ONLINE play needs a Funeral Quest server on the same origin:
put a reverse proxy in front that sends /api (including the WebSocket on /api/ws) and /health
to the server and everything else to these files. The server release (${stem}-server.tar.gz)
serves this same client itself, on one port, which is the simpler way to host a private town:
see its README.txt and docs/sysop-guide.md in the source tree.
`;
}

function zipBundle(dir, name, soloOnly) {
  const dest = join(out, `${stem}-web-${name}.zip`);
  rmSync(dest, { force: true });
  // The bundle plus its README, with the sourcemaps left out (they are not needed to play).
  const stage = join(work, `stage-${name}`);
  rmSync(stage, { recursive: true, force: true });
  cpSync(dir, stage, { recursive: true, filter: (src) => !src.endsWith(".map") });
  writeFileSync(join(stage, "README.txt"), webReadme(soloOnly));
  copyFileSync(join(root, "license.txt"), join(stage, "LICENSE.txt"));
  copyFileSync(join(root, "CREDITS.md"), join(stage, "CREDITS.md"));
  run("zip", ["-q", "-r", "-X", dest, "."], { cwd: stage });
  console.log(`release: ${dest}`);
}

function serverTarball() {
  const clientDir = buildClient("client-online", false);
  run("pnpm", ["--filter", "@fq/server", "build"]);
  const dist = join(root, "apps/server/dist");
  for (const f of ["server.mjs", "server.mjs.map", "package.json"]) {
    if (!existsSync(join(dist, f))) fail(`apps/server/dist/${f} is missing`);
  }
  const top = `funeral-quest-server-${v.version}`;
  const stage = join(work, top);
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });
  for (const f of ["server.mjs", "server.mjs.map", "package.json"])
    copyFileSync(join(dist, f), join(stage, f));
  cpSync(clientDir, join(stage, "client"), {
    recursive: true,
    filter: (src) => !src.endsWith(".map"),
  });
  const server = join(root, "apps/server");
  for (const [from, to] of [
    ["Dockerfile", "Dockerfile"],
    ["Dockerfile.dockerignore", "Dockerfile.dockerignore"],
    ["docker-compose.yml", "docker-compose.yml"],
    [".env.example", ".env.example"],
    ["towns.example.json", "towns.example.json"],
  ]) {
    if (existsSync(join(server, from))) copyFileSync(join(server, from), join(stage, to));
  }
  copyFileSync(join(root, "license.txt"), join(stage, "LICENSE.txt"));
  copyFileSync(join(root, "CREDITS.md"), join(stage, "CREDITS.md"));
  writeFileSync(
    join(stage, "version.json"),
    `${JSON.stringify({ version: v.version, label: v.label, build: v.build }, null, 2)}\n`,
  );
  writeFileSync(
    join(stage, "README.txt"),
    `${header}
Server release

The game server (HTTP + WebSocket, SQLite) and the online-capable web client, on one port.
This is an ALPHA.

Run it (Node.js 24 or newer):

    tar xzf ${top}.tar.gz && cd ${top}
    npm install --omit=dev                      # the server's pinned dependencies (package.json)
    FQ_CLIENT_DIR=./client FQ_ADMIN_TOKEN=$(openssl rand -hex 32) \\
      FQ_DB_PATH=./data/fq.sqlite node --enable-source-maps server.mjs
    curl localhost:8080/health                  # then open http://localhost:8080

Everything is configured by environment variables; .env.example lists and explains each one
(the server does not read .env itself: use node --env-file=.env, systemd, or Docker Compose).
Put TLS in front with a reverse proxy. A fresh database starts with two towns, an Expanded
flagship and a Classic one. Back up the SQLite file (and its -wal/-shm) with
sqlite3 fq.sqlite ".backup copy.sqlite", not with cp.

Docker: Dockerfile, Dockerfile.dockerignore and docker-compose.yml are the repository's own
and build from a checkout of the source at this tag (git checkout v${v.version}), not from this
tarball: docker compose up -d --build, from the repository root. The image has not been built or
run by the project yet (it needs the owner's Docker group; docs/TODO.md).

Hosting a private town, the admin page, bans, backups and restores are covered in
docs/sysop-guide.md and apps/server/README.md in the source tree.

version.json holds this build's version and commit.
`,
  );
  const dest = join(out, `${stem}-server.tar.gz`);
  rmSync(dest, { force: true });
  run("tar", ["--owner=0", "--group=0", "-czf", dest, "-C", work, top]);
  console.log(`release: ${dest}`);
}

/** Copies the first file matching `pattern` in `dir` to `<out>/<name>`. */
function collect(dir, pattern, name) {
  if (!existsSync(dir)) fail(`${dir} does not exist; build it first`);
  // A build directory kept from an older version may hold several files; this version's wins.
  const all = readdirSync(dir).filter((f) => pattern.test(f));
  const found =
    all.filter((f) => f.includes(v.version)).length > 0
      ? all.filter((f) => f.includes(v.version))
      : all;
  if (found.length !== 1)
    fail(`want one ${pattern} for ${v.version} in ${dir}, found ${found.length}`);
  copyFileSync(join(dir, found[0]), join(out, name));
  console.log(`release: ${join(out, name)}`);
}

function checksums() {
  const files = readdirSync(out)
    .filter((f) => f !== "SHA256SUMS" && !f.startsWith(".") && statSync(join(out, f)).isFile())
    .sort();
  if (files.length === 0) fail("nothing in release-out to checksum");
  const lines = files.map((f) => {
    const hash = createHash("sha256")
      .update(readFileSync(join(out, f)))
      .digest("hex");
    return `${hash}  ${f}`;
  });
  writeFileSync(join(out, "SHA256SUMS"), `${lines.join("\n")}\n`);
  console.log(`release: ${join(out, "SHA256SUMS")} (${files.length} files)`);
}

const step = process.argv[2];
switch (step) {
  case "web-online":
    zipBundle(buildClient("client-online", false), "online", false);
    break;
  case "web-solo":
    zipBundle(buildClient("client-solo", true), "solo", true);
    break;
  case "server":
    serverTarball();
    break;
  case "desktop": {
    const bundle = join(root, "apps/desktop/src-tauri/target/release/bundle");
    collect(join(bundle, "deb"), /\.deb$/, `${stem}-linux-amd64.deb`);
    collect(join(bundle, "appimage"), /\.AppImage$/, `${stem}-linux-x86_64.AppImage`);
    break;
  }
  case "android": {
    const apk = join(root, "apps/mobile/android/app/build/outputs/apk");
    collect(join(apk, "debug"), /\.apk$/, `${stem}-android-debug.apk`);
    collect(join(apk, "release"), /-unsigned\.apk$/, `${stem}-android-release-unsigned.apk`);
    break;
  }
  case "checksums":
    checksums();
    break;
  case "list":
    for (const f of walk(out).filter((f) => !f.startsWith(work))) {
      console.log(`${size(statSync(f).size).padStart(9)}  ${f.slice(out.length + 1)}`);
    }
    break;
  default:
    fail(
      "usage: package.mjs web-online | web-solo | server | desktop | android | checksums | list",
    );
}
