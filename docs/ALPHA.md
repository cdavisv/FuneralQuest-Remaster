# Alpha: definition and checklist

The plan (`docs/REMASTER_PLAN.md`, Phase 3) defines Alpha as: Classic is feature-complete against the rules spec, and a private town of 5 to 10 players finishes a 14-day tournament with no data loss and no blocker bugs. This file is the working checklist. "Done" means verified by a test or by running it, not by reading code.

## Exit criteria

| # | Criterion | State |
|---|---|---|
| A1 | Every Classic feature in `docs/classic-rules.md` is reachable and works in the new web client (not only in the engine or the Flash bridge) | done: audited 2026-11-06 in the real client against the real server, every feature reachable; three defects found and fixed (see "A1: the Classic audit" below) |
| A2 | The port matches the original C++ step for step (oracle) | done: 213,350 steps, 10,000 customers, no differences |
| A3 | A 14-day Classic tournament with 8 players runs on the real server over HTTP, through midnights, restarts and a backup restore, with no data loss and no rejected legitimate action | done (soak test, `tools/soak`): `pnpm --filter @fq/soak run soak -- --rules classic --days 14 --players 8` played 15 game days of AI rivals over HTTP and WebSocket (about 19,700 actions, chat, letters, announcements, visits and battles) through 4 `SIGKILL`s (mid-day quiet, mid-day with 8 requests in flight, inside midnight maintenance, inside the final midnight's reset), a backup taken during play and restored into a fresh install two days later, and every sysop action; 41,000+ invariant checks (no offered action refused, nothing negative, every restart identical, audit log equal to the answers, rankings, paper, hall of fame and Book of Deeds agreeing, clean reset, no warning in the server log, database bounded, no private data crossing players), none failed. A 40-player, 5-day stress run with every action concurrent passed the same checks. The short mode (`--short`, 2 days, 4 players, about 70 s) is for CI |
| A4 | The same for a 30-day Expanded season | done (soak test): `--rules expanded --days 30 --players 8` played 31 game days (about 75,500 actions; Bingo cards bought, ordinance votes, an election with a mayor, a chain, a bank loan, duels, the Reaper Club) through the same kills, backup restore and sysop actions; 154,000+ checks, none failed; the season ended into the hall of fame with the Book of Deeds intact |
| A5 | Sysop can run a town end to end from the admin page: create, settings, players, bans, force new day, reset, backup, restore | done: the admin page (`/admin/`) now creates towns and has, per town, every Game Setting, the players (edit BP and turns, kick, delete), snapshots with roll back, and reset; a Backups tab makes, lists, downloads and deletes consistent backups (`POST /admin/backups`, also automatic with `FQ_BACKUP_INTERVAL_HOURS`); restoring a whole backup is `node server.mjs restore` with the server stopped. Checked by hand in a browser, by `apps/server/test/backup.test.ts`, and by the soak runs (backup during play, restore into a fresh install, rollback, kick, ban and unban, settings, forced new day, broadcast). Written up for hosts in `docs/sysop-guide.md` |
| A6 | Unit, browser (Chromium, Firefox, WebKit) and oracle suites green on CI | done on pull request 2; keep green. `ci.yml` also checks the version, lints every workflow file and runs the soak harness's short mode (`pnpm --filter @fq/soak run soak -- --short`, 2 days, 4 players) in the server test group |
| A7 | A tagged alpha build: web bundle, Linux desktop, Android APK, with version shown in the game and a way to send feedback | done: pull request 4 merged and tagged `v0.1.0-alpha.1` (2026-11-07); the release workflow built all seven files (web bundles, server tarball, Linux .deb and AppImage, two APKs, `SHA256SUMS`), checked after download, and the owner published the pre-release the same day (https://github.com/cdavisv/FuneralQuest-Remaster/releases/tag/v0.1.0-alpha.1). Feedback goes to GitHub Issues (decision 22); the alpha.1 builds were made before the address was set and show a marked blank in the dialog, so the release notes and README name it |
| A8 | Docs for a newcomer: play, host, report a bug | done: README (Alpha section, play online, solo and museum mode, host, report a bug, where the plan lives), `docs/STATUS.md` and `docs/release/` reviewed and corrected; the host section links `docs/sysop-guide.md` (create a town, set it up, watch it, ban, back up and restore, end a season), read through 2026-11-07 |
| A9 | Playtest by real people | needs the owner (see `docs/TODO.md`) |
| A10 | Docker image built and run | done (2026-11-07): `docker build -f apps/server/Dockerfile` from the repository root built the image (461 MB; the Dockerfile and its ignore list had to learn about the audio package and the sound packs first), it was run with an admin token, and `/health` answered `{"status":"ok","version":"0.1.0-alpha.1","towns":2}`; the client, all four sound manifests and the admin page are served; `/museum/` is 404 without the build argument, as designed; `docker compose config` accepts the compose files. Nobody has played a tournament through the container. Since 2026-11-08 the build takes the commit (`FQ_BUILD`) and `/health` reports it |

## Out of scope for Alpha

Expanded balance targets, the Studio and Remaster sound packs becoming default, portraits by an illustrator, store submissions, iOS, Windows and macOS builds.

## A1: the Classic audit

Every player-facing feature of `docs/classic-rules.md` and the original manual, played through the web client against the real server by [`apps/client/e2e/classic-audit.spec.ts`](../apps/client/e2e/classic-audit.spec.ts) (33 tests in one serial run, Chromium and Firefox; skipped in WebKit, where a sale takes about eight seconds on a CI runner and the selling alone would outrun the budget; the expected text is the Classic pack's `CLASSIC_TEXT`, the untouched original, and the specs' own scripts). The spec makes its own towns through the admin API and uses the sysop's Game Settings (odds, limits, tournament length) to reach what chance rarely gives. "Done" means the screen showed what the spec says and the test asserts it. The three layouts (1024x745, 1280x720, 390x844) were checked on 32 screens each (buttons inside the cabinet, no overlap, no clipped label, no sideways scroll, dialogs on screen) and the pictures looked at.

| Feature | Driven | Result |
|---|---|---|
| New parlor, paper first, welcome, desk menu, "moved into town" notice, logging off and back on, morning screen, wake-up at the desk | all | done |
| Wait for Customer: arrival, readout (class, mood word, total, resistance), Guilt, Sympathy, Hard Sell, Soft Sell, Done, over-limit and walkout lines, rival's mail after a walkout, no turns | all | done |
| Psychology 1 to 5 (skills, estimate, resistance), bonus for a bill near the limit | all | done |
| Random event, risk (give back or lie, win or lose), script events (bonus tag; the Twins: no thanks, yourself, someone on now, smoke detector, safe) | all | done |
| Stats sheet, name change (every check, swear filter, front-page line, cost), cancelling | all | done |
| Library: Old Papers (before and after day 1, cancel), Book of Deeds (leader, then winner, survives the reset) | all | done |
| Yang's: three dishes, custom and kitchen fortunes, allowance, Get Bitchy and the kick-out, anonymous tiger, dragon only when low | all | done (the 25 percent front-page item is not forced) |
| Bank: exchange both ways, every check on the count, cancel, All to wood, All to gold | all | done |
| Di-Mart: hearses (trade-in price, buy, no downgrade, too poor), padlock, smoke detector, safe, lockpicks | all | done |
| Rival parlors: Look, Visit, name search, own door, online refusal, Try Door, no pick, Pick Lock, safe hides Steal, Steal, Attack | all | done (padlock falling off needs about 14 picks: engine test only) |
| Battle: cry, first swing, Run, whole fight, quote and cancelled quote, Crime page, loser's hospital wake-up, victims' letters | all | done |
| Cafe: arrivals, help, /who, /info, /all, talk (filtered), several lines with `|`, /me, /yell, /give (all five checks and the daily limit), /tv, TV report, leaving | all | done; **defect fixed**: speaking wiped the conversation |
| Letters: name search through several matches, write, "mail waiting" in the cafe, reply with the quote, cancel | all | done |
| Paper: front, crime, yesterday, today, announcement with links, daily top-seller notices, daily rewards by mail | all | done |
| Rankings, new day (banner, hearse turns, police patrol line), no turns, no visits left, name change off, too poor for a class | all | done |
| Tournament: countdown, last day, final day (winner, meteor, top seller of the universe, nobody can play), closed to newcomers, reset | all | done; **defect fixed**: the server announced the reset after ending the sessions, so the ended screen could not name the winner |
| Second log-in elsewhere | all | done |
| Layouts: 32 screens at three sizes | all | done; **defect fixed**: on the phone the sale's and the shops' text shrank to one or two lines |

Not forced by any test (random or too long): a sale exactly at the limit, a sale over 69 BP on the TV, the Yang's tiger's front-page item, the padlock falling off, logging off in the middle of a fight (engine tests cover them).

