import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The original 2001 sounds are licensed for the original game only. `pnpm listen:originals`
 * extracts them for the owner's private comparison, outside the repository; nothing in the tree
 * may hold or ship them.
 */
const repo = join(import.meta.dirname, "..", "..", "..");

describe("the original 2001 sounds stay out of the tree", () => {
  it("no file under assets/audio-original/ is tracked by git", () => {
    let tracked = "";
    try {
      tracked = execFileSync("git", ["ls-files", "--", "assets/audio-original"], {
        cwd: repo,
        encoding: "utf8",
      });
    } catch {
      // not a git checkout (an exported tarball): nothing can be tracked
    }
    expect(tracked.trim()).toBe("");
  });

  it("assets/audio-original/ is ignored by git", () => {
    expect(readFileSync(join(repo, ".gitignore"), "utf8")).toMatch(/^assets\/audio-original\/$/m);
  });

  it("no manifest, build, service worker or container file names it", () => {
    const manifests = readdirSync(join(repo, "assets"), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => join(repo, "assets", d.name, "manifest.json"))
      .concat(join(repo, "assets", "manifest.json"))
      .filter((p) => existsSync(p));
    const build = [
      "apps/client/vite.config.ts",
      "apps/client/pwa/sw.js",
      "apps/server/Dockerfile",
      "apps/server/Dockerfile.dockerignore",
      "docker-compose.yml",
    ]
      .map((p) => join(repo, p))
      .filter((p) => existsSync(p));
    for (const file of [...manifests, ...build]) {
      expect(readFileSync(file, "utf8"), relative(repo, file)).not.toMatch(
        /audio-original|fq-audio-original/,
      );
    }
  });

  it("the extraction writes outside the repository by default", () => {
    const src = readFileSync(join(repo, "packages/audio/scripts/originals.ts"), "utf8");
    expect(src).toMatch(/homedir\(\), "\.cache", "fq-audio-original"/);
  });
});
