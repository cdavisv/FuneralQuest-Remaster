# Alpha: definition and checklist

The plan (`docs/REMASTER_PLAN.md`, Phase 3) defines Alpha as: Classic is feature-complete against the rules spec, and a private town of 5 to 10 players finishes a 14-day tournament with no data loss and no blocker bugs. This file is the working checklist. "Done" means verified by a test or by running it, not by reading code.

## Exit criteria

| # | Criterion | State |
|---|---|---|
| A1 | Every Classic feature in `docs/classic-rules.md` is reachable and works in the new web client (not only in the engine or the Flash bridge) | open: audit pending |
| A2 | The port matches the original C++ step for step (oracle) | done: 213,350 steps, 10,000 customers, no differences |
| A3 | A 14-day Classic tournament with 8 players runs on the real server over HTTP, through midnights, restarts and a backup restore, with no data loss and no rejected legitimate action | open: soak test pending |
| A4 | The same for a 30-day Expanded season | open |
| A5 | Sysop can run a town end to end from the admin page: create, settings, players, bans, force new day, reset, backup, restore | open: restore drill pending |
| A6 | Unit, browser (Chromium, Firefox, WebKit) and oracle suites green on CI | done on pull request 2; keep green. `ci.yml` now also checks the version and lints every workflow file; the soak harness's short mode is a commented step until `tools/soak/README.md` names its command |
| A7 | A tagged alpha build: web bundle, Linux desktop, Android APK, with version shown in the game and a way to send feedback | open: built and dry-run locally (both web zips, server tarball, Linux .deb and AppImage, Android debug and unsigned APKs; version "Alpha 0.1.0 (build abc1234)" shown in Settings and on the front door); still to do: the first run of `release.yml` on GitHub, the tag, the server reporting the version on `/health` and `/api/features` (needs `apps/server`), and the owner's choice of where feedback goes (`docs/TODO.md`; the dialog shows a marked blank) |
| A8 | Docs for a newcomer: play, host, report a bug | open: README (Alpha section, play online, solo and museum mode, host, report a bug, where the plan lives), `docs/STATUS.md` and `docs/release/` reviewed and corrected; the host section links `docs/sysop-guide.md`, written by the A3 to A5 track, which must exist and be read through before this closes |
| A9 | Playtest by real people | needs the owner (see `docs/TODO.md`) |
| A10 | Docker image built and run | needs the owner (docker group) |

## Out of scope for Alpha

Expanded balance targets, the Studio and Remaster sound packs becoming default, portraits by an illustrator, store submissions, iOS, Windows and macOS builds.
