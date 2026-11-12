# Status

Where the project stands, for someone arriving cold and for the owner. Updated 2026-11-12 on the branch `dev/alpha2` (on top of pull requests 1 to 11 and the owner's decisions in [DECISIONS.md](DECISIONS.md)); the project is at version `0.1.0-alpha.2`, [ALPHA.md](ALPHA.md) is the checklist that ends alpha and [BETA.md](BETA.md) the one for beta. "Run" means somebody started it and watched it work; "tested" means a test suite passes and nobody has looked at the real thing.

## In one paragraph

The game is playable in a browser, online against the server and solo with computer rivals and no server, in two rulesets (Classic, a line-by-line port of the 2001 game, and Expanded, the grown-up version). The original 2001 text and art are kept exactly as they were in every mode. Classic has been checked against the original itself: the 2001 C++ server, compiled for Linux, played 213,350 steps side by side with the port with identical random draws, player records and words. The server has had a security pass. The web client runs in Chromium, Firefox and WebKit. A Linux desktop app and an Android debug APK build from the same bundle, and one release workflow builds every alpha file (web bundles, desktop, APKs, server tarball) from one version number. Nothing has been put in front of real players, the owner's listening notes on the sound packs have not reached the repository, and no store, phone, Mac or Windows PC has touched any of it.

## Finished

| What | Where to read more |
| --- | --- |
| Rules engine: Classic ported from the original source and compared with the original compiled engine (`tools/oracle`: identical on every compared step with every gameplay fix off; with the default rules every difference is one of the fixes in classic-rules.md section 9); Expanded rules | [classic-rules.md](classic-rules.md), [classic-fidelity.md](classic-fidelity.md), [expanded-rules.md](expanded-rules.md) |
| Content packs: the original text unaltered (`classic`; `vintage` is a deprecated alias of the same data), the Expanded pack, measured against the plan's volume targets on 2026-11-07 (every target met, map locations reaching 20 on 2026-11-08 with eight new places: [content/expanded-volume.md](content/expanded-volume.md)) | [../packages/content](../packages/content) |
| Online server: accounts, towns, day scheduler, admin page and API, moderation (report, block, mute, ban), account deletion and data export, Daily Challenge, museum mode (the original Flash client in Ruffle), importing a 2001 server's `player.dat` town (`import-legacy`, tested on files written by the original code) | [../apps/server/README.md](../apps/server/README.md) |
| Web client: front door, the game in three layouts, Solo mode (a whole town in a Web Worker, saves, export and import), PWA with offline Solo, gamepad, accessibility checks, settings | [../apps/client/README.md](../apps/client/README.md) |
| Art: the original art as vectors; an optional Remastered pack (redrawn backgrounds, new Expanded art) that replaces no original portrait | [art/remastered-notes.md](art/remastered-notes.md) |
| Sound: three packs, chosen in Settings; "Automatic" (the default) plays "Original, remastered" in Classic and Studio in Expanded, and Synth is always an offering. Sound is on by default (a browser starts it at the first click or key press; a mute button is on every screen). **No pack is the original game's audio**: the original sounds and music are licensed for Funeral Quest only and play only in museum mode, inside the original Flash client. Synth: generated from source. Studio and Original remastered: generated with ElevenLabs from text prompts; their redistribution terms are those of the owner's plan, unconfirmed | [audio/README.md](audio/README.md), [../assets/audio-studio/LICENSES.md](../assets/audio-studio/LICENSES.md), [../assets/audio-remaster/LICENSES.md](../assets/audio-remaster/LICENSES.md) |
| Owner's decisions 3b, 7, 8, 11, 14 and 16 (2026-11-06): museum mode's log-on screen shows the original FQServer banner and a line naming the remaster engine; guests can play and read but cannot type for others (server refuses, client shows the inputs as unavailable, a guest can make a full account and keep the parlor); online play starts with the 18+ rating and one tick box, no age verification and no age stored; a solo-only build flag (`VITE_SOLO_ONLY=1`) for the first mobile release and the GitHub Pages build, which can be served from a sub-path; sound on by default | [DECISIONS.md](DECISIONS.md), [release/](release/README.md) |
| Security review of the server | [security.md](security.md) |
| Performance budget, with a bundle-size check in CI | [performance.md](performance.md) |
| CI: lint, typecheck, the version and workflow-file checks, unit tests in four groups, client build and bundle budget, Playwright in three browsers, dependency audit | [../.github/workflows/ci.yml](../.github/workflows/ci.yml) |
| Versioning: one version (root `package.json`, `0.1.0-alpha.2`) read by the web client (shown as "Alpha 0.1.0 (build abc1234)" in Settings and on the front door), the desktop and Android apps and the server tarball and reported by the running server on `/health` | [../CHANGELOG.md](../CHANGELOG.md), [release/BUILDING.md](release/BUILDING.md) |
| Feedback: "Send feedback" in Settings and on the front door opens a prefilled report (version, build, ruleset, browser, screen title, free text) to copy. The destination is GitHub Issues (decision 22, 2026-11-07; repository variable `FQ_FEEDBACK_DESTINATION`). The alpha.1 builds were made before it was set and show a marked blank | [DECISIONS.md](DECISIONS.md) |
| Alpha release workflow (`release.yml`): web bundles (online-capable and solo-only), Linux `.deb` and AppImage, Android debug and unsigned release APKs, server tarball, `SHA256SUMS`; draft pre-release on a tag; publishes nothing to a store, Pages or a registry | [release/BUILDING.md](release/BUILDING.md) |

## Run (somebody started it and watched it work)

- The web client and the server together, in Chromium and Firefox at 1024x745 and 390x844; WebKit through the test suite only.
- The Linux desktop app built here (Tauri, WebKitGTK): launched, a solo game started, a controller press moved focus once, and the save export reached the native "Save File" dialog and wrote a valid save. See [../apps/desktop/README.md](../apps/desktop/README.md) ("Test build") for exactly how far it was driven.
- The Android debug APK was built (solo-only, 2026-11-06) and its contents checked with `aapt2` (manifest, permissions: `POST_NOTIFICATIONS` only, no `INTERNET`; the bundle, with no service worker, no server address and a Content-Security-Policy that allows no outside connection). **It was not run on a device or emulator.**
- The alpha release files, built locally with the same scripts the release workflow calls (2026-11-06): both web zips, the server tarball (unpacked, `npm install --omit=dev`, started: `/health` answered and the client was served), the Linux `.deb` and AppImage (the release binary started and stayed up for 8 seconds), and the Android debug and unsigned release APKs (`aapt2`: version `0.1.0-alpha.1+<build>`, code 100001, `POST_NOTIFICATIONS` only). **The release workflow has run on GitHub** (tag `v0.1.0-alpha.1`, 2026-11-07): the first run's Android job failed in the SDK set-up action (it asked for the obsolete `tools` package; fixed in pull request 5), and the re-run built all seven files and attached them to a draft pre-release. The files were downloaded and checked against `SHA256SUMS`; the web bundle, the server tarball and the APK carry version `0.1.0-alpha.1` and build `b7b071e`, and the APK asks for no internet permission. **The owner published it on 2026-11-07** as the pre-release "FuneralQuest Remastered 0.1.0-alpha.1" (https://github.com/cdavisv/FuneralQuest-Remaster/releases/tag/v0.1.0-alpha.1).
- The version line and the "Send feedback" dialog, in a browser at 1024x745 and 390x844 (front door and Settings; Escape closes the dialog on top of Settings); the report was read off the screen, not sent anywhere.
- The solo-only web build, built for a sub-path (`/fq-pages/`) and served from it by a plain file host in Chromium and Firefox through the Playwright suite (`e2e/pages.spec.ts`): a solo day played, no request left the sub-path. **Published on 2026-11-07** at https://cdavisv.github.io/FuneralQuest-Remaster/ (the workflow's first run, on `master` at cd23040): a solo career was started there in Chromium, the paper and the desk rendered, the Synth pack loaded from the sub-path and no request left it; the Studio, remaster and voice packs were 404 there by design until the terms were confirmed (decision 24, 2026-11-07); the site now ships all of them.
- Every player-facing Expanded feature in the web client against the real server, by the Expanded audit (`apps/client/e2e/expanded-audit.spec.ts`, 38 tests in one serial run, Chromium and Firefox, 2026-11-12; the table is in [expanded-audit.md](expanded-audit.md)). The first round (26 tests, 2026-11-07) found and fixed four client defects and four engine or pack defects; the round for the eight newer places found and fixed four client defects and six in the engine, the pack, the server and the documents.
- Museum mode's log-on screen against what the C++ builds: looked at in the original client (see [classic-fidelity.md](classic-fidelity.md)).
- The server under a town of 800 parlors (timings in [performance.md](performance.md)).

## Verified only by tests

- Classic against the original, beyond what the oracle drives ([classic-fidelity.md](classic-fidelity.md) section 8): the idle kick (with the original's announcement, added 2026-11-07), saving and reloading across a restart and the original client's wire encoding are proven by server and bridge tests (`apps/server/test/idleKick.test.ts`, `restart.test.ts`, `packages/legacy-compat/test/wire.test.ts`); the sysop's dialogs, the karma texts (unreachable in the original too) and the ratings lines a town of up to five players does not reach are not driven. The oracle compiles the 2019 source release, not the 2001 binary, and runs 32-bit only.

- Everything in the server's hardening (limits, origin checks, token handling, compression): unit and integration tests, not a hostile human.
- The Playwright suites in all three browsers on the Linux machine they were written on. WebKit there is Playwright's own build, not Safari; the sound test is skipped on a host without the GStreamer plug-ins it needs.
- The Expanded ruleset's balance, by simulation ([balance/](balance/)): 21 rounds. After round 21 (the patrol priced against the leader, the hold rationed; decisions 25 and 26) the richest style wins 2.34 times its fair share (+5.3% of its towns' BP; the target is about 2x and +4.5%), one other style 2.03, and none less than a third. Classic is untouched (decision 27, `classicIsolation.test.ts`). What is left is a design question (the leader's unspendable money) and real playtesters.
- Invite codes and the activity statistics (who comes back): server tests, a browser test of the sign-up with a code, and the admin page's tabs read in a browser. No real cohort has been measured.
- The wrappers' server-address dialog, links to the system browser, notifications and the Android back button: written to the Tauri and Capacitor documentation, not exercised on a device.
- The accessibility checks (axe and a contrast measurement) are automatic; they do not replace a screen-reader pass.

## Never run

- **The Docker image** (`apps/server/Dockerfile`, `docker-compose.yml`): built and run on 2026-11-07 (`/health` answered, the client and every sound pack were served, museum mode absent by default); no tournament has been played through it. It reports the commit it was built from when `FQ_BUILD` is passed (2026-11-08: built with it and `/health` showed the build), `dev` otherwise. The Dockerfile and its ignore list gained the audio package and the sound packs, which the first build was missing.
- **The release workflow** (`.github/workflows/release.yml`): has run on GitHub on the tag `v0.1.0-alpha.1` (2026-11-07) and made the draft pre-release; see above.
- **The GitHub Pages workflow** (`.github/workflows/pages.yml`): ran once by hand on 2026-11-07 and published the solo-only build at https://cdavisv.github.io/FuneralQuest-Remaster/; it is run again by hand to update the site.
- **iOS**: the Xcode project is in the tree and cannot be built on Linux.
- **Windows and macOS builds** of the desktop app: only configured, in `.github/workflows/release-desktop.yml`; unsigned and never run.
- **A real phone**, Android or iOS, and a real tablet.
- **Real Safari**, real Firefox for Android, Steam and the Steam Deck.
- **A public server**: TLS, a reverse proxy, backups and monitoring are the operator's, and none exists.

## Needs a human

| Who | What | Detail |
| --- | --- | --- |
| The owner | Listen to every piece of music and every effect in the three packs (Synth, Studio, Original remastered) and send back the notes (`pnpm listen`, then Export notes) | Synth has been measured ([reference/sound-inventory.md](reference/sound-inventory.md)); the owner has listened and agreed to send the notes, but the export (`funeral-quest-audio-notes.txt`, from the page's Export notes button) has not reached the repository, so nothing has been regenerated yet; `docs/audio/listen.html` plays the packs beside the 2001 originals |
| An illustrator | The Remastered portraits and the Expanded customers | Graded C by their own notes ([art/remastered-notes.md](art/remastered-notes.md)) |
| Playtesters | Play Classic and Expanded, online and solo | Balance numbers come from bots; no person has played a full season ([balance/](balance/)) |
| A lawyer | The privacy policy and terms (drafts, now saying 18+ by tick box and no age collected), the Proton SDK acknowledgement, third-party marks, the original sounds in museum mode (the original FQServer banner, with its copyright line, is also shown there) | [release/privacy-policy-DRAFT.md](release/privacy-policy-DRAFT.md), [release/terms-of-service-DRAFT.md](release/terms-of-service-DRAFT.md), [release/licences-and-credits.md](release/licences-and-credits.md) |
| The owner and Robinson Technologies | The name "Funeral Quest": written confirmation of the right to use it | [REMASTER_PLAN.md](REMASTER_PLAN.md) section 9, [release/README.md](release/README.md) |
| The owner | The placeholders (contact address, deletion URL, the bundle identifier) | Search for `OWNER TO FILL IN`; [release/README.md](release/README.md) |
| The owner | Store rating forms, answered truthfully for the original content as it is | [release/age-rating-and-content.md](release/age-rating-and-content.md) |
| A moderator | Watching the report queue of any public server | [release/ugc-and-moderation.md](release/ugc-and-moderation.md) |

## Where to start

- To play, host a town or report a bug: the root [README](../README.md) (and [sysop-guide.md](sysop-guide.md) for running a town).
- To see what alpha and beta mean and what is left: [ALPHA.md](ALPHA.md) and [BETA.md](BETA.md); what changed: [../CHANGELOG.md](../CHANGELOG.md).
- To change the rules: [REMASTER_PLAN.md](REMASTER_PLAN.md), then [classic-rules.md](classic-rules.md) or [expanded-rules.md](expanded-rules.md). Original content is never altered ([../CLAUDE.md](../CLAUDE.md)).
- To release: [release/README.md](release/README.md) and [release/BUILDING.md](release/BUILDING.md).
