# Status

Where the project stands, for someone arriving cold and for the owner. Written 2026-11-06 on the branch `dev/fidelity-and-tuning`, after merging `master` (pull request 1: the original text and customer generator restored). "Run" means somebody started it and watched it work; "tested" means a test suite passes and nobody has looked at the real thing.

## In one paragraph

The game is playable in a browser, online against the server and solo with computer rivals and no server, in two rulesets (Classic, a line-by-line port of the 2001 game, and Expanded, the grown-up version). The original 2001 text and art are kept exactly as they were in every mode. Classic has been checked against the original itself: the 2001 C++ server, compiled for Linux, played 213,350 steps side by side with the port with identical random draws, player records and words. The server has had a security pass. The web client runs in Chromium, Firefox and WebKit. A Linux desktop app and an Android debug APK build from the same bundle. Nothing has been put in front of real players, nobody has listened to the sound, and no store, phone, Mac or Windows PC has touched any of it.

## Finished

| What | Where to read more |
| --- | --- |
| Rules engine: Classic ported from the original source and compared with the original compiled engine (`tools/oracle`: identical on every compared step with every gameplay fix off; with the default rules every difference is one of the fixes in classic-rules.md section 9); Expanded rules | [classic-rules.md](classic-rules.md), [classic-fidelity.md](classic-fidelity.md), [expanded-rules.md](expanded-rules.md) |
| Content packs: the original text unaltered (`classic`; `vintage` is a deprecated alias of the same data), the Expanded pack | [../packages/content](../packages/content) |
| Online server: accounts, towns, day scheduler, admin page and API, moderation (report, block, mute, ban), account deletion and data export, Daily Challenge, museum mode (the original Flash client in Ruffle) | [../apps/server/README.md](../apps/server/README.md) |
| Web client: front door, the game in three layouts, Solo mode (a whole town in a Web Worker, saves, export and import), PWA with offline Solo, gamepad, accessibility checks, settings | [../apps/client/README.md](../apps/client/README.md) |
| Art: the original art as vectors; an optional Remastered pack (redrawn backgrounds, new Expanded art) that replaces no original portrait | [art/remastered-notes.md](art/remastered-notes.md) |
| Sound: two packs chosen in Settings, no original audio in either. Synth (the default): music and effects generated from source. Studio: generated with ElevenLabs, bundled only on request (`FQ_AUDIO_PACKS=synth,studio`) until the owner confirms its terms | [reference/sound-inventory.md](reference/sound-inventory.md), [../assets/audio-studio/LICENSES.md](../assets/audio-studio/LICENSES.md) |
| Security review of the server | [security.md](security.md) |
| Performance budget, with a bundle-size check in CI | [performance.md](performance.md) |
| CI: lint, typecheck, unit tests in four groups, client build and bundle budget, Playwright in three browsers, dependency audit | [../.github/workflows/ci.yml](../.github/workflows/ci.yml) |

## Run (somebody started it and watched it work)

- The web client and the server together, in Chromium and Firefox at 1024x745 and 390x844; WebKit through the test suite only.
- The Linux desktop app built here (Tauri, WebKitGTK): launched, a solo game started, a controller press moved focus once, and the save export reached the native "Save File" dialog and wrote a valid save. See [../apps/desktop/README.md](../apps/desktop/README.md) ("Test build") for exactly how far it was driven.
- The Android debug APK was built and its contents checked (manifest, permissions, bundle).
- The server under a town of 800 parlors (timings in [performance.md](performance.md)).

## Verified only by tests

- Classic against the original, beyond what the oracle drives ([classic-fidelity.md](classic-fidelity.md) section 8): the sysop's dialogs, kick timers, saving and reloading across a restart other than the tournament reset, the HTTP encoding, the karma texts (unreachable in the original too) and the ratings lines a town of up to five players does not reach. The oracle compiles the 2019 source release, not the 2001 binary, and runs 32-bit only.

- Everything in the server's hardening (limits, origin checks, token handling, compression): unit and integration tests, not a hostile human.
- The Playwright suites in all three browsers on the Linux machine they were written on. WebKit there is Playwright's own build, not Safari; the sound test is skipped on a host without the GStreamer plug-ins it needs.
- The Expanded ruleset's balance, by simulation ([balance/](balance/)).
- The wrappers' server-address dialog, links to the system browser, notifications and the Android back button: written to the Tauri and Capacitor documentation, not exercised on a device.
- The accessibility checks (axe and a contrast measurement) are automatic; they do not replace a screen-reader pass.

## Never run

- **The Docker image** (`apps/server/Dockerfile`, `docker-compose.yml`): never built here.
- **iOS**: the Xcode project is in the tree and cannot be built on Linux.
- **Windows and macOS builds** of the desktop app: only configured, in `.github/workflows/release-desktop.yml`; unsigned and never run.
- **A real phone**, Android or iOS, and a real tablet.
- **Real Safari**, real Firefox for Android, Steam and the Steam Deck.
- **A public server**: TLS, a reverse proxy, backups and monitoring are the operator's, and none exists.

## Needs a human

| Who | What | Detail |
| --- | --- | --- |
| Anyone with ears | Listen to every piece of music and every effect, in both packs | Synth has been measured, never listened to ([reference/sound-inventory.md](reference/sound-inventory.md)); Studio is unheard too; `docs/audio/listen.html` plays them side by side |
| An illustrator | The Remastered portraits and the Expanded customers | Graded C by their own notes ([art/remastered-notes.md](art/remastered-notes.md)) |
| Playtesters | Play Classic and Expanded, online and solo | Balance numbers come from bots; no person has played a full season ([balance/](balance/)) |
| The owner | The decisions waiting on an answer, among them the museum log-on banner (3b) and the Studio pack's terms and default (15a) | [DECISIONS.md](DECISIONS.md) |
| A lawyer | The privacy policy and terms (drafts), the Proton SDK acknowledgement, third-party marks, the original sounds in museum mode | [release/privacy-policy-DRAFT.md](release/privacy-policy-DRAFT.md), [release/terms-of-service-DRAFT.md](release/terms-of-service-DRAFT.md), [release/licences-and-credits.md](release/licences-and-credits.md) |
| The owner and Robinson Technologies | The name "Funeral Quest": written confirmation of the right to use it | [REMASTER_PLAN.md](REMASTER_PLAN.md) section 9, [release/README.md](release/README.md) |
| The owner | The placeholders (minimum age, contact address, deletion URL, the bundle identifier) | Search for `OWNER TO FILL IN`; [release/README.md](release/README.md) |
| The owner | Store rating forms, answered truthfully for the original content as it is | [release/age-rating-and-content.md](release/age-rating-and-content.md) |
| A moderator | Watching the report queue of any public server | [release/ugc-and-moderation.md](release/ugc-and-moderation.md) |

## Where to start

- To play: the root [README](../README.md).
- To change the rules: [REMASTER_PLAN.md](REMASTER_PLAN.md), then [classic-rules.md](classic-rules.md) or [expanded-rules.md](expanded-rules.md). Original content is never altered ([../CLAUDE.md](../CLAUDE.md)).
- To release: [release/README.md](release/README.md) and [release/BUILDING.md](release/BUILDING.md).
