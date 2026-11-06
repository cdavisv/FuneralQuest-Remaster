# @fq/desktop

The Funeral Quest desktop app: [Tauri 2](https://tauri.app) around the `@fq/client` bundle, for Windows, macOS, Linux and Steam Deck. Solo mode works with no server; online play uses a server address the player sets. Build, signing and CI notes: [docs/release/BUILDING.md](../../docs/release/BUILDING.md); Steam: [docs/release/STEAM.md](../../docs/release/STEAM.md).

```sh
pnpm desktop:dev      # window on the Vite dev server (the client's dev command is started for you)
pnpm desktop:build    # client build, then installers for this OS (src-tauri/target/release/bundle)
pnpm --filter @fq/desktop icons    # redraw icons from apps/client/pwa/icon.svg (needs Inkscape)
```

## What is where

| Path                                  | What                                                                                                                                                                                                                                           |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src-tauri/src/main.rs`               | The window (1024x768, centred, resizable, 480x360 minimum, size and position remembered by `tauri-plugin-window-state`), the menu (Game, Edit, View, Help > About with the credits line), the four commands the page may call, navigation lock |
| `src-tauri/tauri.conf.json`           | App id, metadata, the strict Content-Security-Policy, bundle targets, the licence and credits shipped as resources                                                                                                                             |
| `src-tauri/capabilities/default.json` | The window's plugin permissions: none                                                                                                                                                                                                          |
| `shim/fq-wrapper.js`                  | The shared wrapper script (server address and its dialog, `saveFile` and `openFile`, links to the system browser, F11 and Alt+Enter), also used by `apps/mobile`                                                                               |
| `scripts/build-client.mjs`            | Builds the client (no `VITE_SERVER_URL`) and copies it, minus sourcemaps and the service worker, to `dist/`                                                                                                                                    |
| `scripts/make-icons.mjs`              | Draws the icon set from the game's own art                                                                                                                                                                                                     |

The client is built exactly as for the web, with base path `/`, which is what Tauri's `tauri://localhost` (macOS, Linux) and `http://tauri.localhost` (Windows) origins serve. The service worker is left out: the app itself is the offline copy.

Keys: F11 and Alt+Enter fullscreen; F2 server address; the client's own 1 to 5 and Escape. Gamepad: the client's own (BUILDING.md).

`FQ_DEFAULT_SERVER=https://fq.example.com` at build time sets the address a fresh install starts with; the player's own setting always wins. The server must list the app's origins in `FQ_ALLOWED_ORIGINS` (BUILDING.md).

### Test build

`cargo`'s `selftest` feature (`FQ_SKIP_TYPECHECK=1 pnpm exec tauri build --no-bundle -- --features selftest`) adds a command that lets a script, named by `FQ_SELFTEST_SCRIPT`, drive the page and print `SELFTEST <name> ok|FAIL <detail>` lines to stdout. It is never part of release builds.

`scripts/selftest.js` is the script. Set `window.__FQ_SELFTEST_STEPS__` in a line before it to choose steps (default `boot,solo,pad`):

- `boot`: `fqWrapper.saveFile` and `openFile` exist, the page's `fetch` and `WebSocket` are the browser's own (the shim no longer wraps them), no service worker is registered, the client's gamepad is on.
- `solo`: from the front door to a new career and the desk.
- `pad`: a synthetic pad (through the page's own Gamepad API) presses the d-pad eight times; focus must move at most once per press.
- `save`: leaves the career, presses Export and stops at the native save dialog, which a person (or a keyboard injector on a desktop you own) answers.

```sh
( echo 'window.__FQ_SELFTEST_STEPS__="boot,solo,pad,save";'; cat scripts/selftest.js ) > /tmp/selftest.js
FQ_SELFTEST_SCRIPT=/tmp/selftest.js ./src-tauri/target/release/funeral-quest
```

Last run (Linux, Arch, WebKitGTK): all `boot`, `solo` and `pad` lines `ok`; the Export press opened the GTK "Save File" dialog with the file name `funeral-quest-selftest-sam-day-1.fqsave.json`; accepting it wrote a valid `fq-solo` save (version 2, day 1). Not driven: the native _open_ dialog (`openFile`) and the dialog's cancel path.

## Client side

The client owns everything it can; the shim only adds what a plain page cannot have.

1. **Runtime server address.** `src/net/config.ts` reads `window.fqWrapper.server` (empty for "own origin") before `VITE_SERVER_URL`; the shim no longer rewrites requests.
2. **A Settings entry for it.** The client's Settings dialog shows _Server address_ when `window.fqWrapper.openSettings` exists.
3. **Gamepad support is the client's** (`src/input`): focus moves once per press, with visible focus, button glyphs and the system keyboard on text fields. The shim has no gamepad code.
4. **Save export and import.** The client calls `fqWrapper.saveFile(name, text, type)` (the native save dialog) and `fqWrapper.openFile(accept)` (the native open dialog), and falls back to a download link and its own file input when they are absent (a browser; the mobile app has no `openFile`).
5. **Back button.** The client registers `window.fqHandleBack` (mobile).
6. **No service worker in a wrapper** (`src/pwa.ts`).
