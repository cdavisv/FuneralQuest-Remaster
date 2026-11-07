/**
 * Where the site lives on its host. "/" at a site's root (the game server, the desktop and mobile
 * apps) and "/<repo>/" on a GitHub Pages project page; set at build time with `FQ_BASE`
 * (vite.config.ts). Always ends with "/". Every URL the page builds for itself (the art, the
 * sound, the service worker, links to its own pages) starts from here; the Vite build rewrites
 * its own imports, and the service worker and manifest work from their own scope.
 */
export const BASE: string = (import.meta.env.BASE_URL ?? "/").replace(/\/?$/, "/");

/** `path` (with or without a leading slash) under the site's base: `siteUrl("audio")` is `/audio` or `/repo/audio`. */
export function siteUrl(path: string): string {
  return `${BASE}${path.replace(/^\/+/, "")}`;
}
