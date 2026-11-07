# Building the desktop and mobile apps

Two wrappers carry the same web client (`apps/client`, built to `apps/client/dist-build`):

| App | Package | Wrapper | Targets |
| --- | --- | --- | --- |
| Desktop | `apps/desktop` (`@fq/desktop`) | Tauri 2 (Rust, the system webview) | Windows, macOS, Linux (AppImage, deb), Steam Deck |
| Mobile | `apps/mobile` (`@fq/mobile`) | Capacitor 8 | Android (APK, AAB), iOS (Xcode project) |

Both apps play **Solo mode with no connection and no server**. **The first mobile release is solo-only** (owner's decision 11, 2026-11-06): `apps/mobile/scripts/prepare-web.mjs` builds the client with `VITE_SOLO_ONLY=1` (no server address, log-on, chat or Daily Challenge board; the front door goes straight to Solo and its offline Daily Challenge practice) and a Content-Security-Policy that allows no outside connection, and the Android app does not request `INTERNET`. Build the online-capable mobile client with `FQ_SOLO_ONLY=0` (and restore the permission, see Android below). The desktop app is not solo-only: its online play needs a server address, set by the player (see "Server address") or baked in at build time with `FQ_DEFAULT_SERVER=https://your.server`.

The app/bundle identifier is `org.funeralquest.remaster`. **It is a placeholder.** It cannot be changed after the first upload to Google Play or the App Store, so choose the real one (a reverse-domain name you control) before that: `apps/desktop/src-tauri/tauri.conf.json` (`identifier`), `apps/mobile/capacitor.config.json` (`appId`), the Android `namespace`/`applicationId` in `apps/mobile/android/app/build.gradle` and the Java package path of `MainActivity`, and `PRODUCT_BUNDLE_IDENTIFIER` in the Xcode project.

## Alpha builds (the release workflow)

`.github/workflows/release.yml` builds everything an alpha tester needs, in one run, from one version. Start it by hand (Actions, "Release (alpha builds)", Run workflow: the files come out as workflow artifacts) or push a tag that matches the root `package.json` version (`v0.1.0-alpha.1` for `0.1.0-alpha.1`; a mismatch fails the run), which also attaches the files to a **draft pre-release** for the owner to read and publish by hand. It publishes nothing anywhere else: no store, no GitHub Pages, no Docker or package registry, and it must not get such a job.

| File | What |
| --- | --- |
| `funeral-quest-<version>-web-online.zip` | The web client, online-capable, with a README (serve from a site's root; online play needs a server behind `/api`) |
| `funeral-quest-<version>-web-solo.zip` | The solo-only web client (decision 14's build), with a README |
| `funeral-quest-<version>-linux-amd64.deb`, `-linux-x86_64.AppImage` | The Tauri desktop app for Linux |
| `funeral-quest-<version>-android-debug.apk`, `-android-release-unsigned.apk` | The solo-only Android app: debug-signed (installs directly) and release (not signed: it cannot be installed until you sign it) |
| `funeral-quest-<version>-server.tar.gz` | The bundled server, the online-capable client, `.env.example`, `towns.example.json`, the Dockerfile and compose file, a README and `version.json` |
| `SHA256SUMS` | Checksums of all of the above |

**The version is one number**, the root `package.json` `version` (`0.1.0-alpha.1`), read by `scripts/version.mjs` and nothing else. The web client takes it (and the build, the short commit, or `FQ_BUILD`) at build time from `apps/client/vite.config.ts` and shows "Alpha 0.1.0 (build abc1234)" in Settings and on the front door; `build-info.json` in every web bundle carries both. Tauri's `tauri.conf.json` points its `version` at the root `package.json`; `Cargo.toml` and the two wrapper `package.json` files carry a copy that `node scripts/version.mjs --check` (run by CI) keeps equal. Android's `versionName` is `<version>+<build>` and `versionCode` grows with the version (`0.1.0-alpha.1` is 100001; a final release counts as the top of its number), both passed to Gradle by `apps/mobile/scripts/build-android.mjs`. To change the version, edit the root `package.json`, then the same line in `apps/desktop/src-tauri/Cargo.toml` (and its `Cargo.lock` entry for `funeral-quest`), `apps/desktop/package.json` and `apps/mobile/package.json`, and run the check. iOS's marketing version must be numeric and is not set from this (the iOS project is not part of the alpha).

The same steps run on a laptop: `node scripts/release/package.mjs web-online | web-solo | server` build and name those files in `release-out/` (git-ignored), `desktop` and `android` collect what `tauri build` and `build-android.mjs` made, `checksums` writes `SHA256SUMS`, `list` prints names and sizes. `FQ_BUILD_OUT=<dir>` makes the desktop and mobile scripts build the client in a directory of their own instead of `apps/client/dist-build`. `VITE_FEEDBACK_DESTINATION` (the workflow reads the repository variable `FQ_FEEDBACK_DESTINATION`) sets the text the in-game "Send feedback" dialog tells players to send reports to; unset, it shows the marked blank (docs/TODO.md).

The alpha leaves out Windows, macOS and iOS; `release-desktop.yml` and `release-mobile.yml` remain, by hand only, for those, the AAB and the iOS archive. Neither runs on a tag any more.

## What the wrappers add

The web client does the game's own work inside a native webview (it reads its server address from `window.fqWrapper.server`, plays gamepads itself, exports saves through `window.fqWrapper.saveFile`, registers `window.fqHandleBack`, and does not register its service worker inside a wrapper). A shared script, `apps/desktop/shim/fq-wrapper.js`, runs before the page's own scripts (Tauri injects it; the mobile build loads it first from `index.html`) and supplies only what a plain page cannot have:

- A **server address** that persists (webview storage, `fqw.server.v1`, surviving updates), read by the client as `fqWrapper.server`, and the **Server address** dialog (`fqWrapper.openSettings()`): desktop menu *Game > Server address* or F2, the client's Settings, the deep link `funeralquest://settings`, and on mobile the Android back button at the front door (Stay / Settings / Leave). Only `https://` addresses (and `http://` for localhost) are accepted. The shim no longer rewrites `fetch` or `WebSocket`; the client builds its own URLs from the address.
- `fqWrapper.saveFile(name, text, type)` and, on desktop, `fqWrapper.openFile(accept)`: the host's **native save and open dialogs** (desktop) or the **share sheet** (mobile, save only) for the client's save export and import. Mobile import uses the client's own file input, which works in both webviews.
- Links to other sites open in the **system browser**.
- Desktop only: F11 and Alt+Enter toggle fullscreen; the window remembers its size and position.

Gamepads are the client's (`apps/client/src/input`): d-pad or left stick moves focus once per press, A presses, B goes back, X submits, Start opens Settings.

The online server must allow the wrapper's origin, because the page is not served from the server: set `FQ_ALLOWED_ORIGINS` on the server to include

```
tauri://localhost,http://tauri.localhost,https://localhost,capacitor://localhost
```

(macOS and Linux desktop, Windows desktop, Android, iOS). Without this the apps still play Solo, and online play fails with the front door's "server could not be reached".

## Desktop (Tauri 2)

Prerequisites: Node 24+, pnpm 12, Rust (stable, 1.77+), and for Linux the WebKitGTK stack (Arch: `webkit2gtk-4.1 gtk3 librsvg libayatana-appindicator`; Debian/Ubuntu: `libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev libayatana-appindicator3-dev patchelf`).

```sh
pnpm install
pnpm desktop:dev                       # Tauri window on the Vite dev server (http://localhost:5173)
pnpm desktop:build                     # builds the client, then the installers for this OS
# Linux, both formats:
NO_STRIP=true pnpm --filter @fq/desktop exec tauri build --bundles deb,appimage
# bake in a default server:
FQ_DEFAULT_SERVER=https://fq.example.com pnpm desktop:build
```

Output is in `apps/desktop/src-tauri/target/release/bundle/` (`deb/`, `appimage/`, `nsis/`, `dmg/`). `NO_STRIP=true` is needed on rolling distros whose newer binaries confuse the AppImage tool's bundled `strip` (it is harmless elsewhere).

### Windows

On a Windows machine (or the CI job): install Rust (MSVC toolchain), Node, pnpm and the WebView2 runtime (present on Windows 10/11). `pnpm desktop:build` produces an NSIS installer (`.exe`) under `target\release\bundle\nsis\`. Unsigned installers trigger SmartScreen ("Windows protected your PC"); players click *More info > Run anyway*.

### macOS

On a Mac with Xcode command line tools: `rustup target add aarch64-apple-darwin x86_64-apple-darwin`, then `pnpm --filter @fq/desktop exec tauri build --target aarch64-apple-darwin --bundles dmg` (and `x86_64-apple-darwin` for Intel, or `--target universal-apple-darwin`). Unsigned apps open only after *right-click > Open* (or `xattr -dr com.apple.quarantine "Funeral Quest.app"`).

### Continuous integration

`.github/workflows/release-desktop.yml` (manual trigger only) builds Linux (deb, AppImage), Windows (NSIS) and macOS (Apple silicon and Intel dmg), unsigned, and uploads them as workflow artifacts. The alpha release (`release.yml`, above) builds the Linux files itself and attaches them to its draft release. Runner labels (`macos-15-intel` and so on) change over time: adjust them if a job fails to start.

### Signing and notarisation (not done; what it needs)

| Platform | Needs | Where it goes |
| --- | --- | --- |
| Windows | A code-signing certificate (an EV certificate removes SmartScreen warnings at once; a standard one builds reputation over time) or Azure Trusted Signing | `bundle.windows.certificateThumbprint` / `signCommand` in `tauri.conf.json`, certificate as a CI secret |
| macOS | Apple Developer Program membership (USD 99 a year), a *Developer ID Application* certificate, and notarisation with an app-specific password or API key | CI secrets `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` (Tauri signs and notarises when they are set) |
| Linux | Nothing required. Optionally GPG-sign the AppImage | |
| Updates | Tauri's updater needs its own signing key pair (`tauri signer generate`); the updater plugin is **not** included | |

Tauri's guides: <https://v2.tauri.app/distribute/sign/windows/> and <https://v2.tauri.app/distribute/sign/macos/> (verify against the current docs).

### Security notes (desktop)

- Content Security Policy in `tauri.conf.json`: scripts only from the app itself; `connect-src` allows the app, IPC, `https:`/`wss:` and localhost. Because the server address is chosen by the player, the host cannot be narrower than "any https host" in a static policy; the shim itself refuses to use anything but `https` (or `http` on localhost).
- Capability file `src-tauri/capabilities/default.json` grants the window **no plugin permissions**: no shell, no filesystem, no HTTP client, no opener. The four commands the page can call are in the app (`open_external` refuses anything but http, https and mailto; `save_file` writes only to the path the person picks in the native dialog; `open_file` reads only the file the person picks in the native dialog; `toggle_fullscreen`). Navigation away from the app's own origin is refused.
- Remote pages never get IPC: the window only ever loads the bundled app.

## Mobile (Capacitor 8)

```sh
pnpm install
pnpm mobile:sync          # builds the client, assembles apps/mobile/www, runs `cap sync` for android and ios
pnpm mobile:android       # the same for android, then opens Android Studio
pnpm --filter @fq/mobile android:debug     # command line: debug APK
pnpm --filter @fq/mobile android:release   # unsigned release APK and AAB
```

`apps/mobile/www` (generated, not committed) is the client bundle plus the shim, the mobile glue (`glue/fq-mobile.ts`, bundled with esbuild) and a Content-Security-Policy meta tag. The native projects `apps/mobile/android` and `apps/mobile/ios` **are committed**, the way Capacitor recommends; their generated parts (copied web assets, `capacitor.config.json`, `local.properties`, build output) are git-ignored.

### Android

Prerequisites: **JDK 21** (Capacitor 8 requires it; JDK 27 does not work with its Gradle), and the Android SDK with `platforms;android-36` and `build-tools;36.0.0` (Gradle fetches `build-tools;35.0.0` itself). `scripts/build-android.mjs` finds them through `JAVA_HOME` and `ANDROID_HOME`, then `~/jdks/jdk-21*` and `~/Android/Sdk`, and writes `android/local.properties`.

User-level install with no root (what was done on the build machine):

```sh
# JDK 21: download a Temurin 21 tarball and unpack it to ~/jdks/
# SDK:    download "commandlinetools-linux-*_latest.zip" from developer.android.com/studio and
#         unpack it to ~/Android/Sdk/cmdline-tools/latest, then:
export JAVA_HOME=~/jdks/jdk-21.*   ANDROID_HOME=~/Android/Sdk
yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --sdk_root=$ANDROID_HOME \
    "platform-tools" "platforms;android-36" "build-tools;36.0.0"
```

(`yes |` accepts the Android SDK licence; read it first at <https://developer.android.com/studio/terms>.)

Signing for Google Play: create an upload key once (`keytool -genkeypair -v -storetype PKCS12 -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`), keep it and its passwords somewhere safe (losing it is recoverable with Play App Signing, but only through Google support), sign the AAB with `jarsigner` or by configuring `signingConfigs` in `android/app/build.gradle` from environment variables, and upload the AAB. Enrol in Play App Signing. Raise `versionCode` in `android/app/build.gradle` for every upload.

What the manifest holds (verified on the solo-only debug APK with `aapt2 dump permissions`, 2026-11-06): permission `POST_NOTIFICATIONS` only. **`INTERNET` is deliberately removed** (`tools:node="remove"`): the solo-only app makes no network request (Capacitor serves the bundle from inside the app; fonts, art and sound are in it; a link opens in the system browser through an intent, which needs no permission), and the removal strips it from every library's manifest too. **Unverified on a device:** the bundle is served by Capacitor's in-process local origin (`https://localhost`), which is expected to work without the permission; if the app shows a blank screen on a real phone, this is the first thing to check. The notification plugin's wake-lock, exact-alarm and boot permissions are also removed on purpose. What the local-notification plugin needs: only `POST_NOTIFICATIONS` (Android 13 and later asks at runtime when the player turns the reminder on); reminders are scheduled on the device, no push, no Firebase. Cleartext traffic and auto-backup are off, the `funeralquest://` deep link is commented out of the manifest for this release (restore it for online play), and there is no exported component but the launcher activity and AndroidX's `ProfileInstallReceiver` (it is exported by the library and guarded by the system-only `android.permission.DUMP`, so only the system can call it).

Behaviour: portrait and landscape both work, and the client picks its phone or wide layout from the viewport. Capacitor's `SystemBars` plugin keeps the page clear of the status and gesture bars (and publishes `--safe-area-inset-*`); the client's `env(safe-area-inset-*)` rules cover notches. The status and gesture bars use light icons on the game's dark background. The Android back button: (1) closes the wrapper's own dialog, (2) closes the client's top dialog or overlay (it sends the client's Escape), (3) goes back in history on routed screens (`#/rules`, `#/credits` and so on), (4) at the front door or in a game, asks *Leave Funeral Quest?* with *Stay*, *Settings...* and *Leave*. The keyboard resizes the web view (`resize: native`) and the focused field is scrolled into view. Splash screen is hidden after the first paint.

Notifications are opt-in (Settings, Reminder settings; online builds: the Server address dialog's checkboxes), scheduled locally, no push service and no Firebase: *Solo*: "A new day has dawned in Deathville." at the next three local 08:00s (Solo days are the player's own, so this is a nudge); *Online*: the town's next midnight (`nextDayAt` from the public `/api/towns`) and the two after it for midnight towns, or just the next day for a Blitz town. They are scheduled when the app goes to the background and cleared when it returns.

### iOS (cannot be built on Linux)

The Xcode project is `apps/mobile/ios/App/App.xcodeproj`, with the plugins as a Swift package (`CapApp-SPM`), so there is no CocoaPods step. On a Mac with Xcode 16 or later:

1. `pnpm install && pnpm mobile:sync` (or `pnpm mobile:sync` then `pnpm --filter @fq/mobile exec cap open ios`).
2. In Xcode choose the **App** target, *Signing & Capabilities*: select your Team, set the bundle identifier (the placeholder `org.funeralquest.remaster` must be changed to one you own), and leave *Automatically manage signing* on.
3. *Product > Destination > Any iOS Device (arm64)*, then *Product > Archive*.
4. In the Organizer: *Distribute App > App Store Connect > Upload* (or *Debug*/*Ad Hoc* for a test build). First create the app record in App Store Connect with the same bundle identifier.
5. For TestFlight, add testers in App Store Connect once processing finishes.

Already set in `Info.plist`: URL scheme `funeralquest` (the solo-only glue ignores it; remove it for the solo-only release), `ITSAppUsesNonExemptEncryption = false` (the app uses only standard HTTPS), `UIRequiredDeviceCapabilities = arm64`, all orientations. The app icon and splash image are in the asset catalog. Increase *Build* (and *Version*) in Xcode for every upload. Notifications ask permission only when the player turns them on.

The CI workflow `.github/workflows/release-mobile.yml` (manual only; the alpha release builds the APKs itself) builds the Android debug APK and release APK and AAB (unsigned) on Linux and, on `macos-15`, runs `xcodebuild archive` with signing disabled and uploads the zipped `.xcarchive`. An unsigned archive is a build check; to ship, archive and sign on a Mac as above, or add your certificate, provisioning profile and App Store Connect API key to CI (fastlane or `xcodebuild -exportArchive`).

### Deep links (online builds only; ignored by the solo-only release)

`funeralquest://join?server=https://fq.example.com&town=<town id>` points the app at a server (after a confirmation that names the host; a link never switches server silently) and the town the front door should pre-select. `funeralquest://settings` opens the settings dialog. Universal/App Links (`https://` links that open the app) need a hosted `apple-app-site-association` / `assetlinks.json` and are not set up.

## Client changes

All made: the runtime server address (`src/net/config.ts`), a Server address entry in Settings, `window.fqHandleBack`, gamepad support owned by the client, save export and import through the wrapper, and no service worker inside a wrapper. `apps/desktop/README.md` ("Client side") lists them.

## Verified on the build machine (Linux, 2026-11-06)

- **Desktop (Linux):** `FQ_SKIP_TYPECHECK=1 NO_STRIP=true pnpm --filter @fq/desktop exec tauri build --bundles deb,appimage` built `Funeral Quest_0.1.0_amd64.deb` (18 MiB) and `.AppImage` (117 MiB) with the current client bundle (audio included). The release binary starts and stays up. A separate `selftest` build was launched and driven: a solo game starts, a synthetic controller press moves focus once, `fqWrapper.saveFile` and `openFile` exist, the page's `fetch` and `WebSocket` are the browser's own, no service worker is registered, and Export reached the native GTK save dialog and wrote a valid save. Not driven: the native open dialog, and everything on Windows and macOS (CI only).
- **Android:** `node scripts/build-android.mjs debug` built `app-debug.apk` (22.5 MB, with the sound) from the current solo-only bundle (2026-11-06). Checked in the APK: permissions `POST_NOTIFICATIONS` only (no `INTERNET`), the Content-Security-Policy `connect-src 'self' blob:`, `fq-config.js` saying `__FQ_SOLO_ONLY__ = true` and no default server, no service worker, offline page or sourcemaps, the shim and glue, 142 audio files and 85 pictures, no `funeralquest://` link. **The APK was not run on a device or an emulator; none exists here.**
- **Not verified:** Windows and macOS builds (CI only), signing, anything on iOS, a real phone.
