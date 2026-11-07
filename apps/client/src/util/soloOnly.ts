/**
 * The solo-only build (owner's decisions 11 and 14, 2026-11-06): the first mobile release and the
 * free web build on GitHub Pages ship with online play switched off. It is a build-time flag,
 * `VITE_SOLO_ONLY=1`, so the same client code serves every target: unset for the web client that
 * `@fq/server` serves and for the desktop app, set for the mobile wrapper and the Pages build.
 *
 * In this build there is no server address, no log-on, no chat, no rankings board and no Daily
 * Challenge board, and the page makes no network request of its own: the front door goes straight
 * to Solo (whose Daily Challenge *practice* is offline).
 */
export function soloOnly(): boolean {
  return import.meta.env.VITE_SOLO_ONLY === "1";
}
