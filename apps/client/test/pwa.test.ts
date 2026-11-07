import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("the installable web app", () => {
  const manifest = JSON.parse(read("pwa/manifest.webmanifest")) as {
    name: string;
    start_url: string;
    display: string;
    icons: { src: string; sizes: string; purpose: string }[];
  };

  it("has a manifest a browser will install: name, start URL, standalone, 192 and 512 icons", () => {
    expect(manifest.name).toBe("FuneralQuest Remastered");
    // Relative, so the same manifest works at a site's root and under /<repo>/ (GitHub Pages).
    expect(manifest.start_url).toBe("./");
    expect((manifest as unknown as { scope: string }).scope).toBe("./");
    expect(manifest.display).toBe("standalone");
    const sizes = manifest.icons.map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
  });

  it("ships every icon the manifest names", () => {
    for (const icon of manifest.icons) {
      const file = join(root, "pwa", icon.src);
      expect(existsSync(file), icon.src).toBe(true);
      expect(statSync(file).size).toBeGreaterThan(1000);
    }
  });

  it("links the manifest from the page", () => {
    expect(read("index.html")).toContain('rel="manifest" href="%BASE_URL%manifest.webmanifest"');
  });

  it("has an offline page that points to solo play, for a device that kept nothing", () => {
    const html = read("pwa/offline.html");
    expect(html).toMatch(/offline/);
    expect(html).toMatch(/Play solo/);
    expect(html).toContain('href="./?solo"');
    expect(html).toMatch(/Try again/);
  });

  it("has a service worker that keeps the app, serves it offline, and never touches the server", () => {
    const sw = read("pwa/sw.js");
    // The page itself and the offline page are kept at install, and the build fills in the rest.
    expect(sw).toContain('[BASE, at("offline.html"), ...APP.map(at)]');
    expect(sw).toContain("/*__PRECACHE_APP__*/");
    expect(sw).toContain("/*__PRECACHE_ART__*/");
    // An offline page load gets the kept app first, the offline page only as a last resort.
    expect(sw).toContain('request.mode === "navigate"');
    expect(sw.indexOf("shell.match(BASE)")).toBeLessThan(
      sw.indexOf('shell.match(at("offline.html"))'),
    );
    for (const path of ["api", "admin", "health", "museum"]) {
      expect(sw).toContain(`path.startsWith("${path}")`);
    }
    expect(sw).toContain("__BUILD_ID__");
  });

  it("takes every path from its own scope, so it works under a sub-path", () => {
    const sw = read("pwa/sw.js");
    expect(sw).toContain("new URL(self.registration.scope).pathname");
    // No absolute path of the site root is hard-coded: everything goes through `at`/BASE.
    const code = sw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(
      /["'`]\/(assets|classic|audio|api|admin|health|museum|offline\.html|icons)/,
    );
    expect(code).not.toMatch(/(fetch|match|put|register)\(\s*["'`]\//);
  });

  it("keeps the rendered audio as it is played and fills it in the background when asked", () => {
    const sw = read("pwa/sw.js");
    // Its own cache, which survives a new build of the app.
    expect(sw).toContain('const AUDIO = "fq-audio-v1"');
    expect(sw).toContain("k !== AUDIO");
    // Files are served from the kept copy and kept when fetched; the manifest goes to the network first.
    expect(sw).toContain("SOUND.test(path)");
    expect(sw).toContain("SOUND_MANIFEST.test(path)");
    // Every sound pack is kept as it is played; the install fills the Synth and remaster packs only,
    // and Studio (the bigger one) is cached on first play.
    expect(sw).toContain("(audio|audio-studio|audio-remaster|voice)");
    expect(sw).toContain('const FILL_PACKS = ["audio-remaster", "audio"];');
    expect(sw).not.toMatch(/FILL_PACKS = \[[^\]]*studio/);
    // The page asks, once the game is usable, for one format; nothing is fetched at install.
    expect(sw).toContain('"fq-fill-audio"');
    expect(sw).toContain("async function fillAudio(format)");
    const install = sw.slice(
      sw.indexOf('addEventListener("install"'),
      sw.indexOf('addEventListener("activate"'),
    );
    expect(install).not.toContain("audio/");
    // Redraws of Classic pictures are best effort, the Expanded places are part of the install.
    expect(sw).toContain("/*__PRECACHE_ART_OPTIONAL__*/");
  });
});
