/*
 * Funeral Quest service worker. It makes Solo mode work with no connection at all:
 *  - at install it keeps the whole built app (every file the bundle lists below, with the page
 *    itself, the Solo worker and the fonts) and, best effort, the pictures the game draws;
 *  - a page load that cannot reach the network is answered with the kept app, which sees it is
 *    offline and opens in Solo mode; only if nothing was kept does it show /offline.html;
 *  - the rendered audio is kept as it is played and, when the page asks once the game is usable,
 *    the Synth and "Original, remastered" packs (about 8 MB for the format a browser plays) are
 *    filled in the background (message "fq-fill-audio"), so an offline Solo game is not silent
 *    and the first load stays fast. The Studio pack (about 6 MB more) is only kept as it is played;
 *  - it never touches the API: /api, /admin, /health and /museum always go to the network.
 * The online game itself still needs its server; this only decides what an offline visit sees.
 */
const BUILD = "__BUILD_ID__";
// Where the site lives: the worker's scope, "/" at a site's root or "/repo/" on a project page.
// Every path below is relative to it.
const BASE = new URL(self.registration.scope).pathname;
const at = (relative) => BASE + relative;
const SHELL = `fq-shell-${BUILD}`;
const RUNTIME = "fq-runtime-v1";
// The audio keeps its own cache across builds: the files are big and rarely change.
const AUDIO = "fq-audio-v1";
// Filled in by the build (vite.config.ts): every file of the bundle the app needs, and the art.
const APP = [
  /*__PRECACHE_APP__*/
];
const ART = [
  /*__PRECACHE_ART__*/
];
// Hashed pictures that only matter to players who chose the Remastered art (it redraws originals).
const ART_OPTIONAL = [
  /*__PRECACHE_ART_OPTIONAL__*/
];
// How long a page load waits for the network before showing what is kept (a dead connection
// that never answers is as offline as none).
const NAVIGATE_TIMEOUT_MS = 4000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL);
      // All or nothing: a half-kept app would be worse than the old one.
      await shell.addAll([BASE, at("offline.html"), ...APP.map(at)]);
      const runtime = await caches.open(RUNTIME);
      await Promise.allSettled(
        [...ART, ...ART_OPTIONAL].map(at).map(async (path) => {
          if (await runtime.match(path)) return;
          const response = await fetch(path);
          if (response.ok) await runtime.put(path, response);
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL && k !== RUNTIME && k !== AUDIO)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// The sound packs the background fill installs, by directory (the remaster first: it is what a
// Classic game plays). Studio (audio-studio/) is not here: it is kept on first play, so the
// install stays small. A player who is offline before ever hearing it gets Synth for its tracks.
const FILL_PACKS = ["audio-remaster", "audio"];
// Every directory of sound the worker keeps as it is played.
const SOUND = /^(audio|audio-studio|audio-remaster|voice)\//;
const SOUND_MANIFEST = /^(audio|audio-studio|audio-remaster|voice)\/manifest\.json$/;

/** Every audio file of a pack's manifest in one container, as paths. */
function audioPaths(manifest, format, dir) {
  const paths = [];
  for (const track of Object.values(manifest.tracks ?? {})) {
    for (const file of track.files ?? []) {
      const name = file[format];
      if (typeof name === "string" && /^[\w./-]+$/.test(name) && !name.includes("..")) {
        paths.push(at(`${dir}/${name}`));
      }
    }
  }
  return paths;
}

let filling = false;
/**
 * Background fill of the audio cache: two files at a time, never when the connection is lost, and
 * a changed manifest (a new render) starts the cache afresh.
 */
async function fillAudio(format) {
  if (filling || (format !== "ogg" && format !== "m4a")) return;
  filling = true;
  try {
    const cache = await caches.open(AUDIO);
    const queue = [];
    for (const dir of FILL_PACKS) {
      const manifestPath = at(`${dir}/manifest.json`);
      try {
        const response = await fetch(manifestPath, { cache: "no-cache" });
        if (!response.ok) continue; // a build without this pack
        const text = await response.clone().text();
        const manifest = JSON.parse(text); // a host that answers a missing file with a page throws here
        const kept = await cache.match(manifestPath);
        if (kept && (await kept.text()) !== text) {
          // a new render of this pack: its files start afresh, the other packs' stay
          for (const key of await cache.keys()) {
            if (new URL(key.url).pathname.startsWith(at(`${dir}/`))) await cache.delete(key);
          }
        }
        await cache.put(manifestPath, response);
        queue.push(...audioPaths(manifest, format, dir));
      } catch {
        // this pack is not there (or the connection is): the others still fill
      }
    }
    const worker = async () => {
      for (let path = queue.shift(); path !== undefined; path = queue.shift()) {
        if (await cache.match(path)) continue;
        try {
          const file = await fetch(path);
          if (file.ok) await cache.put(path, file);
        } catch {
          return; // offline or the server went away: try again at the next visit
        }
      }
    };
    await Promise.all([worker(), worker()]);
  } catch {
    // Not fatal: the files are also kept as they are played.
  } finally {
    filling = false;
  }
}

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "fq-fill-audio") {
    event.waitUntil(fillAudio(event.data.format));
  }
});

// `path` is relative to the site's base.
const isServer = (path) =>
  path.startsWith("api") ||
  path.startsWith("admin") ||
  path.startsWith("health") ||
  path.startsWith("museum");

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function navigate(request) {
  try {
    return await withTimeout(fetch(request), NAVIGATE_TIMEOUT_MS);
  } catch {
    const shell = await caches.open(SHELL);
    return (await shell.match(BASE)) ?? (await shell.match(at("offline.html"))) ?? Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  const path = url.pathname.slice(BASE.length);
  if (isServer(path)) return;

  if (request.mode === "navigate") {
    event.respondWith(navigate(request));
    return;
  }

  // Hashed bundle files never change: kept copy first, else the network (and keep that too).
  if (path.startsWith("assets/")) {
    event.respondWith(
      caches.match(request).then(async (hit) => {
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) {
          const copy = response.clone();
          caches.open(RUNTIME).then((cache) => cache.put(request, copy));
        }
        return response;
      }),
    );
    return;
  }

  // The art can be replaced: show what is kept and refresh it behind the scenes.
  if (path.startsWith("classic/")) {
    event.respondWith(
      caches.open(RUNTIME).then(async (cache) => {
        const hit = await cache.match(request);
        const refresh = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => hit ?? Response.error());
        return hit ?? refresh;
      }),
    );
    return;
  }

  // Sound: kept copy first, else the network (and keep that too). The manifest is the exception:
  // the network when there is one, so a new render is noticed. Character voices (voice/) are kept
  // the same way, as is the Studio pack (audio-studio/): only as they are played, never part of
  // the install or the fill.
  if (SOUND.test(path)) {
    event.respondWith(
      caches.open(AUDIO).then(async (cache) => {
        const hit = await cache.match(request, { ignoreVary: true });
        if (SOUND_MANIFEST.test(path)) {
          try {
            const response = await fetch(request);
            if (response.ok) cache.put(request, response.clone());
            return response;
          } catch {
            return hit ?? Response.error();
          }
        }
        if (hit) return hit;
        const response = await fetch(request);
        // A range request answers 206 and cannot be stored whole: leave those alone.
        if (response.status === 200) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  // Everything else the app asks for (the manifest, icons, the offline page).
  event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request)));
});
