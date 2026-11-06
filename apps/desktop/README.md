# @fq/desktop

The Funeral Quest desktop app: [Tauri 2](https://tauri.app) around the `@fq/client` bundle, for Windows, macOS, Linux and Steam Deck. Solo mode works with no server; online play uses a server address the player sets. Build, signing and CI notes: [docs/release/BUILDING.md](../../docs/release/BUILDING.md); Steam: [docs/release/STEAM.md](../../docs/release/STEAM.md).

```sh
pnpm desktop:dev      # window on the Vite dev server (the client's dev command is started for you)
pnpm desktop:build    # client build, then installers for this OS (src-tauri/target/release/bundle)
pnpm --filter @fq/desktop icons    # redraw icons from apps/client/pwa/icon.svg (needs Inkscape)
```

## What is where

| Path                                  | What                                                                                                                                                                                                                                            |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src-tauri/src/main.rs`               | The window (1024x768, centred, resizable, 480x360 minimum, size and position remembered by `tauri-plugin-window-state`), the menu (Game, Edit, View, Help > About with the credits line), the three commands the page may call, navigation lock |
| `src-tauri/tauri.conf.json`           | App id, metadata, the strict Content-Security-Policy, bundle targets, the licence and credits shipped as resources                                                                                                                              |
| `src-tauri/capabilities/default.json` | The window's plugin permissions: none                                                                                                                                                                                                           |
| `shim/fq-wrapper.js`                  | The shared wrapper script (server address, gamepad, links, save files, F11 and Alt+Enter), also used by `apps/mobile`                                                                                                                           |
| `scripts/build-client.mjs`            | Builds the client (no `VITE_SERVER_URL`) and copies it, minus sourcemaps and the service worker, to `dist/`                                                                                                                                     |
| `scripts/make-icons.mjs`              | Draws the icon set from the game's own art                                                                                                                                                                                                      |

The client is built exactly as for the web, with base path `/`, which is what Tauri's `tauri://localhost` (macOS, Linux) and `http://tauri.localhost` (Windows) origins serve. The service worker is left out: the app itself is the offline copy.

Keys: F11 and Alt+Enter fullscreen; F2 server address; the client's own 1 to 5 and Escape. Gamepad: see BUILDING.md.

`FQ_DEFAULT_SERVER=https://fq.example.com` at build time sets the address a fresh install starts with; the player's own setting always wins. The server must list the app's origins in `FQ_ALLOWED_ORIGINS` (BUILDING.md).

### Test build

`cargo`'s `selftest` feature (`pnpm exec tauri build --no-bundle -- --features selftest`) adds a command that lets a script, named by `FQ_SELFTEST_SCRIPT`, drive the page and print results to stdout. It exists only to check that the packaged app launches and a solo game reaches the desk, and is never part of release builds.

## Client changes (not made; the wrappers work around each)

1. **Runtime server address.** `src/net/config.ts` reads the server only from `VITE_SERVER_URL`. Wanted: also read `window.fqWrapper?.server` (a string, empty for "own origin") and let `createBackend` and the push socket use it, then drop the wrapper's fetch and WebSocket re-pointing. Until then the shim rewrites requests.
2. **A Settings entry for it.** Add _Server address_ to the client's Settings dialog calling `window.fqWrapper?.openSettings()` (only shown when `window.fqWrapper` exists). Today the dialog is reached by menu, F2, a gamepad's Start, or on mobile through the back-button confirmation and the `funeralquest://settings` link, which players will not find by themselves.
3. **Gamepad support owned by the client** (better than the wrapper's key synthesis): navigation across plaques, dialogs and forms with visible focus, A/B/X/Y glyph hints, and the system on-screen keyboard on text fields. Needed for Steam Deck _Verified_.
4. **Save export without `<a download>`.** `SoloShell.download()` makes a blob link. The wrapper intercepts it; a client hook such as `window.fqWrapper?.saveFile(name, text)` would be cleaner and would report success or failure.
5. **Back button hook (mobile).** Optional `window.fqHandleBack = () => boolean`: return true if the client handled "back" (for example, leaving a game screen through its Exit confirmation). The wrapper already handles dialogs (Escape), routed pages (history) and the exit confirmation.
6. **Do not register the service worker in the wrappers** (`registerServiceWorker()` in `src/pwa.ts`), or skip it when `window.fqWrapper` exists; today it logs a failed registration in the desktop webview.
