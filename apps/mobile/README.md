# @fq/mobile

The Funeral Quest mobile app: [Capacitor 8](https://capacitorjs.com) around the `@fq/client` bundle, for Android and iOS. **The first release is solo-only** (owner's decision 11): the bundle is built with `VITE_SOLO_ONLY=1`, so there is no server address, log-on, chat or Daily Challenge board, the Content-Security-Policy allows no outside connection, and the Android manifest has no `INTERNET` permission. `FQ_SOLO_ONLY=0` builds the online-capable client for when online play comes to mobile (restore `INTERNET` and the `funeralquest://` link in the manifest). Solo mode works offline. Build steps, Xcode steps, signing and CI: [docs/release/BUILDING.md](../../docs/release/BUILDING.md).

```sh
pnpm mobile:sync                          # client build -> www/ -> cap sync (android + ios)
pnpm mobile:android                       # the same for android, then opens Android Studio
pnpm --filter @fq/mobile android:debug    # command-line debug APK
pnpm --filter @fq/mobile ios              # on a Mac: sync and open Xcode
pnpm --filter @fq/mobile icons            # redraw icons and splash screens (needs Inkscape)
```

| Path                        | What                                                                                                                                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `capacitor.config.json`     | App id and name, `https://localhost` origin on Android, SystemBars, splash, keyboard and notification settings                                                                                     |
| `glue/fq-mobile.ts`         | Host half of the shared shim and the mobile behaviour: system bars, splash, back button, keyboard, local notifications, deep links, save through the share sheet, links through the in-app browser |
| `scripts/prepare-web.mjs`   | Builds the client and assembles `www/` (bundle, shim, glue, CSP `<meta>`)                                                                                                                          |
| `scripts/build-android.mjs` | `prepare-web`, `cap sync android`, Gradle (finds JDK 21 and the SDK)                                                                                                                               |
| `scripts/make-icons.mjs`    | Adaptive and legacy launcher icons, notification icon, splash images, iOS icon and splash                                                                                                          |
| `android/`, `ios/`          | The native projects, committed. Generated files inside them are git-ignored                                                                                                                        |

Environment: `FQ_SOLO_ONLY=0` (build the online-capable client; default is solo-only), `FQ_DEFAULT_SERVER` (default server address, online builds only), `FQ_SKIP_CLIENT_BUILD=1` (reuse `apps/client/dist-build`, which must have been built the same way: `build-info.json` is checked).

Plugins: `@capacitor/app` (back button, deep links, lifecycle), `browser`, `filesystem` and `share` (save files), `keyboard`, `local-notifications`, `splash-screen`; the status and gesture bars are Capacitor core's `SystemBars`. No push, no analytics, no Firebase.

Client changes: all made; see [apps/desktop/README.md](../desktop/README.md#client-side).
