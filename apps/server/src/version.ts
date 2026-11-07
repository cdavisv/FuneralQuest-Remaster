import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Set by `build.mjs` (esbuild `define`) in the bundled server; absent when run from source. */
declare const __FQ_VERSION__: string | undefined;
declare const __FQ_BUILD__: string | undefined;

export interface ServerVersion {
  /** The root package.json's version, the one source (scripts/version.mjs), e.g. "0.1.0-alpha.1". */
  version: string;
  /** The short git commit, or FQ_BUILD, or "dev" when there is neither. */
  build: string;
}

let cached: ServerVersion | null = null;

/**
 * What this server is. The bundle has both values compiled in by `build.mjs`; run from source
 * (`tsx`, tests) they are read from the checkout the same way: the root package.json and
 * `git rev-parse --short=7 HEAD`, with `FQ_BUILD` winning and "dev" without git.
 */
export function serverVersion(): ServerVersion {
  if (cached) return cached;
  if (typeof __FQ_VERSION__ === "string" && typeof __FQ_BUILD__ === "string") {
    cached = { version: __FQ_VERSION__, build: __FQ_BUILD__ };
    return cached;
  }
  const root = fileURLToPath(new URL("../../..", import.meta.url));
  let version = "0.0.0";
  try {
    const pkg = JSON.parse(readFileSync(`${root}/package.json`, "utf8")) as { version?: unknown };
    if (typeof pkg.version === "string") version = pkg.version;
  } catch {
    // not in a checkout
  }
  cached = { version, build: readBuild(root) };
  return cached;
}

/** The short commit of `cwd`'s checkout; FQ_BUILD wins; "dev" when there is no git. */
export function readBuild(cwd: string): string {
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
