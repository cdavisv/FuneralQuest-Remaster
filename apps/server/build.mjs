// Bundles the server into dist/server.mjs. Workspace packages (@fq/*) are compiled in;
// npm dependencies stay external and are listed, pinned, in dist/package.json so the
// Docker image can `npm install --omit=dev` exactly what was tested.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { build } from "esbuild";

/**
 * What this build is: the root package.json's version (the one source, scripts/version.mjs) and
 * the short commit, or FQ_BUILD, or "dev" when there is no git (a Docker build). The same rule as
 * apps/client/vite.config.ts; the server reports both on /health and /api/features.
 */
function buildVersion() {
  const root = new URL("../..", import.meta.url);
  const { version } = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
  let id = (process.env.FQ_BUILD ?? "").trim().slice(0, 12);
  if (!id) {
    try {
      id = execFileSync("git", ["rev-parse", "--short=7", "HEAD"], {
        cwd: root,
        stdio: ["ignore", "pipe", "ignore"],
      })
        .toString()
        .trim();
    } catch {
      id = "dev";
    }
  }
  return { version, build: id || "dev" };
}
const buildId = buildVersion();

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const external = Object.keys(pkg.dependencies).filter((name) => !name.startsWith("@fq/"));

await build({
  entryPoints: ["src/main.ts"],
  outfile: "dist/server.mjs",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  sourcemap: true,
  external,
  define: {
    __FQ_VERSION__: JSON.stringify(buildId.version),
    __FQ_BUILD__: JSON.stringify(buildId.build),
  },
  // Bundled CommonJS code (the `yaml` package, used by @fq/content/node to read custom packs)
  // calls require("process") and the like; give it a real `require` in the ES module.
  banner: {
    js: "import { createRequire as __fqCreateRequire } from 'node:module'; const require = __fqCreateRequire(import.meta.url);",
  },
  logLevel: "info",
});

const pinned = {};
for (const name of external) {
  const installed = JSON.parse(readFileSync(`node_modules/${name}/package.json`, "utf8"));
  pinned[name] = installed.version;
}
mkdirSync("dist", { recursive: true });
writeFileSync(
  "dist/package.json",
  `${JSON.stringify(
    {
      name: "fq-server-runtime",
      private: true,
      type: "module",
      engines: pkg.engines,
      dependencies: pinned,
    },
    null,
    2,
  )}\n`,
);
