#!/usr/bin/env node
/**
 * The one place the version is read. The version is the "version" field of the root
 * package.json (semver, for example 0.1.0-alpha.1); every build reads it from there:
 *
 *   apps/client   vite.config.ts (defines __FQ_VERSION__ and __FQ_BUILD__, writes build-info.json)
 *   apps/desktop  tauri.conf.json ("version" points at the root package.json) and build-client.mjs
 *   apps/mobile   scripts/build-android.mjs (versionName and versionCode for Gradle)
 *   release       .github/workflows/release.yml (file names, checksums, the server tarball)
 *
 * The build hash is the short git commit; FQ_BUILD overrides it (CI sets it, and a Docker build
 * has no git), and "dev" is used when neither exists.
 *
 * As a module: `import { readVersion } from "../../scripts/version.mjs"`.
 * From a shell:  node scripts/version.mjs [--json | --version | --label | --build | --code | --check]
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+)(?:\.(\d+))?)?$/;

/** The short commit hash of the checkout, "dev" when there is none. FQ_BUILD wins. */
export function readBuild(cwd = root) {
  const fromEnv = (process.env.FQ_BUILD ?? "").trim();
  if (fromEnv) return fromEnv.slice(0, 12);
  try {
    const hash = execFileSync("git", ["rev-parse", "--short=7", "HEAD"], {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    if (/^[0-9a-f]{4,40}$/.test(hash)) return hash;
  } catch {
    // no git, or not a checkout
  }
  return "dev";
}

/**
 * `{ version, core, channel, label, build, code }`:
 *   version  "0.1.0-alpha.1", the full semver from package.json
 *   core     "0.1.0"
 *   channel  "alpha" ("" for a release)
 *   label    "Alpha 0.1.0", what a player is shown (with the build: "Alpha 0.1.0 (build abc1234)")
 *   code     an integer that grows with the version, for Android's versionCode
 */
export function readVersion(rootDir = root) {
  const { version } = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"));
  const m = SEMVER.exec(version ?? "");
  if (!m) throw new Error(`package.json "version" is not semver: ${JSON.stringify(version)}`);
  const [, major, minor, patch, channel = "", pre] = m;
  const core = `${major}.${minor}.${patch}`;
  const label = channel ? `${channel[0].toUpperCase()}${channel.slice(1)} ${core}` : core;
  const preNumber = channel ? Math.min(Number(pre ?? 0), 98) : 99;
  const code = ((Number(major) * 1000 + Number(minor)) * 1000 + Number(patch)) * 100 + preNumber;
  return { version, core, channel, label, build: readBuild(rootDir), code };
}

/** "Alpha 0.1.0 (build abc1234)" */
export function fullLabel(v = readVersion()) {
  return `${v.label} (build ${v.build})`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const v = readVersion();
  const flag = process.argv[2] ?? "--label";
  if (flag === "--json") console.log(JSON.stringify(v, null, 2));
  else if (flag === "--version") console.log(v.version);
  else if (flag === "--build") console.log(v.build);
  else if (flag === "--code") console.log(v.code);
  else if (flag === "--label") console.log(fullLabel(v));
  else if (flag === "--check") {
    // Every place that carries a copy of the version must agree with the root.
    const problems = [];
    const cargo = /^version\s*=\s*"([^"]+)"/m.exec(
      readFileSync(join(root, "apps/desktop/src-tauri/Cargo.toml"), "utf8"),
    );
    if (cargo?.[1] !== v.version) {
      problems.push(`apps/desktop/src-tauri/Cargo.toml says ${cargo?.[1]}`);
    }
    const tauri = JSON.parse(
      readFileSync(join(root, "apps/desktop/src-tauri/tauri.conf.json"), "utf8"),
    );
    if (tauri.version !== "../../../package.json") {
      problems.push(`tauri.conf.json "version" is ${tauri.version}, not the path to package.json`);
    }
    for (const app of ["desktop", "mobile"]) {
      const pkg = JSON.parse(readFileSync(join(root, `apps/${app}/package.json`), "utf8"));
      if (pkg.version !== v.version) problems.push(`apps/${app}/package.json says ${pkg.version}`);
    }
    if (problems.length > 0) {
      console.error(`version ${v.version} is not the same everywhere:\n  ${problems.join("\n  ")}`);
      process.exit(1);
    }
    console.log(`version ${v.version} is the same everywhere (${fullLabel(v)})`);
  } else {
    console.error(
      "usage: node scripts/version.mjs [--json | --version | --label | --build | --code | --check]",
    );
    process.exit(2);
  }
}
