import { existsSync } from "node:fs";
import { cp, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vitest/config";
import { copyArt, listArtIds } from "./tools/bundle-art.mjs";

// The exported art lives in <repo>/assets/classic/<id>.svg. In dev the repo's assets directory
// is Vite's public directory, so the art is served at /classic/<id>.svg, the default asset base.
// A production build copies just the pictures the game requests (about 5 MB; the animation
// frames, UI sprite sheets and contact sheets are not fetched, see tools/bundle-art.mjs) into
// <outDir>/classic, so the server can serve the client and its art from one directory. Set
// VITE_ASSET_BASE to host the art elsewhere, or FQ_BUNDLE_ASSETS=0 to leave it out.
// The directory may be missing or partial; the client shows a placeholder for any gap.
const assetsDir = fileURLToPath(new URL("../../assets", import.meta.url));
const pwaDir = fileURLToPath(new URL("./pwa", import.meta.url));
// Where the production bundle goes: dist-build, unless FQ_BUILD_OUT names another directory (the
// end-to-end runs build into their own, so two runs at once never trample each other's bundle).
const outDir = process.env.FQ_BUILD_OUT
  ? resolve(process.env.FQ_BUILD_OUT)
  : fileURLToPath(new URL("./dist-build", import.meta.url));

/** `virtual:fq-classic-ids`: which pictures the Classic art has (see src/art/classicIds.ts). */
function classicIds(): Plugin {
  const name = "virtual:fq-classic-ids";
  return {
    name: "fq-classic-ids",
    resolveId: (id) => (id === name ? `\0${name}` : null),
    async load(id) {
      if (id !== `\0${name}`) return null;
      return `export default ${JSON.stringify(await listArtIds(assetsDir))};`;
    },
  };
}

/** The web app manifest, offline page, icons and service worker, emitted at the bundle's root. */
function pwa(): Plugin {
  return {
    name: "fq-pwa",
    apply: "build",
    async generateBundle() {
      const build = Date.now().toString(36);
      const emit = async (dir: string, prefix: string) => {
        for (const entry of await readdir(dir, { withFileTypes: true })) {
          if (entry.isDirectory()) {
            await emit(`${dir}/${entry.name}`, `${prefix}${entry.name}/`);
          } else if (entry.name !== "icon.svg") {
            const raw = await readFile(`${dir}/${entry.name}`);
            this.emitFile({
              type: "asset",
              fileName: `${prefix}${entry.name}`,
              source:
                entry.name === "sw.js" ? raw.toString("utf8").replace("__BUILD_ID__", build) : raw,
            });
          }
        }
      };
      await emit(pwaDir, "");
    },
  };
}

/**
 * Fills the service worker's lists after the bundle and the art are on disk: every file of the
 * app (so Solo mode starts with no connection) and every picture (kept best effort).
 */
function precache(): Plugin {
  const walk = async (dir: string, prefix = ""): Promise<string[]> => {
    const out: string[] = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.isDirectory())
        out.push(...(await walk(`${dir}/${entry.name}`, `${prefix}${entry.name}/`)));
      else out.push(`${prefix}${entry.name}`);
    }
    return out;
  };
  // Remastered pictures that redraw a Classic original: only a player who chose the Remastered
  // art ever sees them. The ones with no Classic original (the Expanded places and people) are
  // shown on every art pack, so an offline Expanded game needs them whatever the player chose:
  // those stay in the all-or-nothing install.
  const redraws = new Set<string>();
  return {
    name: "fq-precache",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      for (const [file, chunk] of Object.entries(bundle)) {
        if (chunk.type !== "asset") continue;
        for (const original of chunk.originalFileNames ?? []) {
          const m = /(?:^|\/)assets\/([^/]+)\/(.+)\.svg$/.exec(original);
          if (!m?.[1] || !m[2] || m[1] === "classic") continue;
          if (m[2].startsWith("ui/") || m[2].startsWith("icons/")) continue;
          if (existsSync(`${assetsDir}/classic/${m[2]}.svg`)) redraws.add(file);
        }
      }
    },
    async closeBundle() {
      const all = await walk(outDir);
      const app = all.filter(
        (f) =>
          !f.startsWith("classic/") &&
          // Sound is fetched when it is first needed; the app works without it.
          !f.startsWith("audio/") &&
          !f.startsWith("audio-studio/") &&
          !f.startsWith("audio-remaster/") &&
          // Character voices load on demand, only for a player who has them on.
          !f.startsWith("voice/") &&
          f !== "sw.js" &&
          f !== "index.html" &&
          f !== "offline.html" &&
          !f.endsWith(".map") &&
          f !== "build-info.json" &&
          // Browsers that can run the game read woff2; the .woff fallbacks are never fetched.
          !f.endsWith(".woff") &&
          // The `?expanded` development town (about 1 MB with the engine) is not part of the app.
          !f.startsWith("assets/ExpandedHost-") &&
          !redraws.has(f),
      );
      const optional = all.filter((f) => redraws.has(f));
      const art = all.filter((f) => f.startsWith("classic/"));
      // Paths relative to the site's base: the service worker adds its own scope in front.
      const list = (files: string[]) => files.map((f) => JSON.stringify(f)).join(", ");
      const sw = `${outDir}/sw.js`;
      const source = await readFile(sw, "utf8");
      await writeFile(
        sw,
        source
          .replace("/*__PRECACHE_APP__*/", list(app))
          .replace("/*__PRECACHE_ART__*/", list(art))
          .replace("/*__PRECACHE_ART_OPTIONAL__*/", list(optional)),
      );
      console.log(
        `pwa: the service worker keeps ${app.length} app files and ${art.length + optional.length} pictures (${optional.length} Remastered redraws best effort)`,
      );
    },
  };
}

/**
 * `build-info.json` at the bundle's root: what this build was made as (solo-only or not, and its
 * base path). The mobile and Pages builds read it to be sure the bundle they are packaging is the
 * one they asked for (apps/mobile/scripts/prepare-web.mjs).
 */
function buildInfo(): Plugin {
  return {
    name: "fq-build-info",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "build-info.json",
        source: `${JSON.stringify({ soloOnly: process.env.VITE_SOLO_ONLY === "1", base: siteBase() }, null, 2)}\n`,
      });
    },
  };
}

/** Copies the art the game requests into the bundle, unless it is hosted elsewhere. */
function bundleArt(): Plugin {
  return {
    name: "fq-bundle-art",
    apply: "build",
    async closeBundle() {
      if (process.env.FQ_BUNDLE_ASSETS === "0" || process.env.VITE_ASSET_BASE) return;
      const { files, bytes } = await copyArt(assetsDir, outDir);
      console.log(`art: bundled ${files} pictures (${(bytes / 1e6).toFixed(1)} MB)`);
    },
  };
}

/**
 * Copies the rendered audio (assets/audio, made by `pnpm --filter @fq/audio run render`: about
 * 15 MB with both the Opus and the AAC files) to <outDir>/audio, where the client looks for it,
 * unless VITE_AUDIO_BASE hosts it elsewhere or FQ_BUNDLE_AUDIO=0. Missing audio is not an
 * error: the game plays silently.
 */
function bundleAudio(): Plugin {
  return {
    name: "fq-bundle-audio",
    apply: "build",
    async closeBundle() {
      if (process.env.FQ_BUNDLE_AUDIO === "0" || process.env.VITE_AUDIO_BASE) return;
      const from = `${assetsDir}/audio`;
      try {
        await stat(`${from}/manifest.json`);
      } catch {
        console.log("audio: assets/audio has no manifest.json; the build ships no sound");
        return;
      }
      await cp(from, `${outDir}/audio`, { recursive: true });
      const manifest = JSON.parse(await readFile(`${from}/manifest.json`, "utf8")) as {
        totalBytes: number;
      };
      console.log(`audio: bundled ${(manifest.totalBytes / 1e6).toFixed(1)} MB`);
      await bundleStudioAudio();
      await bundleOptionalPack("remaster", "audio-remaster", "VITE_AUDIO_REMASTER_BASE");
      // Character voices (assets/voice, ElevenLabs; see its LICENSES.md): FQ_AUDIO_PACKS=...,voice
      await bundleOptionalPack("voice", "voice", "VITE_VOICE_BASE");
    },
  };
}

/**
 * The optional Studio sound pack (assets/audio-studio, generated with ElevenLabs; see its
 * LICENSES.md) goes to <outDir>/audio-studio only when FQ_AUDIO_PACKS names it
 * (`FQ_AUDIO_PACKS=synth,studio`), because its redistribution terms are not settled. Without it,
 * a player who picks the Studio pack hears the Synth pack. `vite dev` serves both as they are.
 */
async function bundleStudioAudio(): Promise<void> {
  const packs = (process.env.FQ_AUDIO_PACKS ?? "synth").split(",").map((p) => p.trim());
  if (!packs.includes("studio") || process.env.VITE_AUDIO_STUDIO_BASE) return;
  const from = `${assetsDir}/audio-studio`;
  try {
    await stat(`${from}/manifest.json`);
  } catch {
    console.log("audio: assets/audio-studio has no manifest.json; the build has no Studio pack");
    return;
  }
  await cp(from, `${outDir}/audio-studio`, {
    recursive: true,
    // the provenance sidecars stay in the repository
    filter: (src) => !/(takes|sources)\.json$/.test(src),
  });
  const manifest = JSON.parse(await readFile(`${from}/manifest.json`, "utf8")) as {
    totalBytes: number;
  };
  console.log(`audio: bundled the Studio pack, ${(manifest.totalBytes / 1e6).toFixed(1)} MB`);
}

/**
 * The optional "Original, remastered" pack (assets/audio-remaster), copied like the Studio pack
 * only when FQ_AUDIO_PACKS names it (`FQ_AUDIO_PACKS=synth,remaster`), for the same reason.
 */
async function bundleOptionalPack(id: string, dir: string, baseEnv: string): Promise<void> {
  const packs = (process.env.FQ_AUDIO_PACKS ?? "synth").split(",").map((p) => p.trim());
  if (!packs.includes(id) || process.env[baseEnv]) return;
  const from = `${assetsDir}/${dir}`;
  try {
    await stat(`${from}/manifest.json`);
  } catch {
    console.log(`audio: assets/${dir} has no manifest.json; the build has no ${id} pack`);
    return;
  }
  await cp(from, `${outDir}/${dir}`, {
    recursive: true,
    // the provenance sidecars and the measurements of the originals stay in the repository
    filter: (src) => !/(takes|sources|brief|lines|cast)\.json$/.test(src),
  });
  console.log(`audio: bundled the ${id} pack`);
}

/**
 * Where the site lives on its host: "/" (a site's root, which is what the game server and the
 * desktop and mobile apps use) or a sub-path such as "/FuneralQuest-Remaster/" (GitHub Pages
 * serves a project at https://<user>.github.io/<repo>/). Set FQ_BASE to build for a sub-path.
 * Everything the page, the service worker and the manifest ask for is relative to it
 * (src/util/base.ts, pwa/sw.js).
 */
function siteBase(): string {
  const raw = (process.env.FQ_BASE ?? "/").trim();
  if (raw === "" || raw === "/") return "/";
  if (!/^\/[\w.~-]+(\/[\w.~-]+)*\/?$/.test(raw)) {
    throw new Error(`FQ_BASE must be a path such as /repo/ (got "${raw}")`);
  }
  return raw.endsWith("/") ? raw : `${raw}/`;
}

const serverTarget = process.env.FQ_SERVER_URL ?? "http://127.0.0.1:8080";

export default defineConfig(({ command }) => ({
  base: siteBase(),
  plugins: [react(), classicIds(), pwa(), buildInfo(), bundleArt(), bundleAudio(), precache()],
  publicDir: command === "serve" ? assetsDir : false,
  build: { outDir, emptyOutDir: true, sourcemap: true },
  // In development the page and the game server are different ports; the client talks to its
  // own origin (see src/net/config.ts), so Vite forwards the API, including the WebSocket.
  server: {
    proxy: {
      "/api": { target: serverTarget, ws: true, changeOrigin: false },
      "/health": { target: serverTarget },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    css: false,
    restoreMocks: true,
    // Generous for slow CI machines; the default 5 s is too tight for the walk tests.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    exclude: ["e2e/**", "perf/**", "node_modules/**", "dist-build/**"],
  },
}));
