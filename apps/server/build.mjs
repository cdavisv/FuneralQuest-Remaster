// Bundles the server into dist/server.mjs. Workspace packages (@fq/*) are compiled in;
// npm dependencies stay external and are listed, pinned, in dist/package.json so the
// Docker image can `npm install --omit=dev` exactly what was tested.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { build } from "esbuild";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const external = Object.keys(pkg.dependencies).filter((name) => !name.startsWith("@fq/"));

await build({
  entryPoints: ["src/main.ts"],
  outfile: "dist/server.mjs",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: true,
  external,
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
