import { scheduleAudioFill } from "./audio/offlineFill.js";
import { BASE, siteUrl } from "./util/base.js";
import { inWrapper } from "./wrapper.js";

/**
 * Registers the service worker (`pwa/sw.js`), which keeps the app for offline Solo play and shows
 * `offline.html` when the page cannot be fetched. It never caches the API or game state; the game
 * needs its server. Inside the desktop and mobile apps it is not registered: the app is the offline
 * copy, and a webview that serves `tauri://` or `capacitor://` pages cannot run one anyway.
 */
export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator) || inWrapper()) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(siteUrl("sw.js"), { scope: BASE }).then(
      // The sound is fetched ahead of time once the game is usable, never before.
      () => scheduleAudioFill(),
      () => {
        // Not installable here (an insecure origin, a blocked worker); the game works regardless.
      },
    );
  });
}
