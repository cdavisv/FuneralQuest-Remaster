# Changelog

What changed, in plain language, for players and for people who run a town. The newest version is first. The project is in **alpha**: it is playable and heavily tested, and it has not had real players yet (see [docs/ALPHA.md](docs/ALPHA.md) for what alpha means here and what is still open).

The version number lives in one place, the root `package.json`, and every app reads it. Versions look like `0.1.0-alpha.1`; the game shows it as "Alpha 0.1.0 (build abc1234)", where the build is the commit it was made from.

## Unreleased

Nothing yet.

## 0.1.0-alpha.2 (2026-11-12)

The second alpha. Expanded now has the plan's 20 places, all of them played in the browser, and a sysop has what a closed beta needs: invite codes and a count of who comes back. What Beta means and what is still open is in [docs/BETA.md](docs/BETA.md).

- **The eight new places were played through in the browser** against the real server: the Expanded audit grew from 26 to 38 tests (Chromium and Firefox). It found and fixed four client defects (the town strip covered two buildings on the map, the map's places overlapped on a phone, pickers showed colour codes, one label ran out of its button) and six in the engine, the pack, the server and the documents, among them: the coroner, health department, pawn shop and Mourne & Sons printed amounts without the dollar sign; a complaint that backfired showed the reputation it cost as a gain; the crematorium told a parlor with no oven time "0 slots reserved until day 0"; the florist said flowers "cost double" in the heat when they cost a quarter more.
- **Closed beta by invite.** With `FQ_INVITE_REQUIRED=1` a new account or a guest needs an invite code. Codes are made and revoked on the admin page's Invites tab, each with a number of uses and an optional expiry. Which account used which code is not recorded. The sign-up form, the guest button and the Daily Challenge's door ask for the code and say plainly when it is wrong, used up or expired.
- **Are players coming back?** The server now keeps one row per account, town and day played, and nothing else. The admin page's Activity tab (and `GET /admin/stats`) shows, for the players who first played on each day, how many returned on day 1, 3, 7, 14 and 30. Nothing leaves the server, rows are dropped after `FQ_ACTIVITY_RETENTION_DAYS` (400 by default), and a player's export lists their own days.
- **A sysop can tune the eight new places** per town (103 numbers, `town.placesA.*` and `town.placesB.*`).
- **A 30-day Expanded season was run again on the real server** with the new places: 31 game days, 74,739 actions, five hard kills, a backup restore, 153,197 checks, all eight places used.
- **Balance round 21 (Expanded only): the night patrol costs a leader more, and the free hold is rationed.** Round 20 found why the richest style still won too often after the new places: the patrol keeps it out of fights it would lose, and Mourne & Sons' free hold makes it a "good" parlor, and no flat price reaches a parlor with money to spare. With the owner's yes, the patrol and the back door now cost a parlor ahead of the town $25 more for each Bury Point of its lead (Sergeant Bixby says how much), and the hold pays its karma once every three days. Over 200 simulated seasons the richest style falls from 3.38 to 2.34 times its fair share and no style wins less than a third of its share any more; everybody else's points are unchanged ([docs/balance/](docs/balance/)). Both numbers can be tuned per town. **Classic is untouched**: a new test records every Classic rule number and proves a Classic town plays the same after an Expanded one, beside the recorded Classic playthroughs and the comparison with the compiled 2001 engine.
- **Balance round 20** measured why the richest style still wins too often after the new places: the night patrol keeps it out of fights it would lose, and Mourne & Sons' free hold makes it a "good" parlor. No price reaches a parlor with money to spare, so no number was changed; the two rule changes that would work waited for the owner and are round 21. The computer rivals now send the church wreath, which none of them used.
- **A beta checklist**, [docs/BETA.md](docs/BETA.md): twelve things the software must be (eleven done, balance partly) and five that need people.
- **The release build ships every sound pack.** The packaging script still refused a bundle with the Studio pack in it (a check from before decision 24), so the first `v0.1.0-alpha.2` build failed; the check now requires the Studio, remaster and voice packs.

- **Eight new places on the Expanded map**, which reaches the plan's 20: the Police Station (report or settle with a rival who attacked you, hire a night patrol), the Crematorium (rent oven time, scatter or press the ashes), the Florist (bouquets priced by the weather, wreaths for the church or the hospital), the Town Gazette (adverts, a puff piece, a smear that can backfire), Dr. Grimble's Coroner's Office (a tip on the next family, a fast-tracked certificate, a daily favour), the Health Department (inspections, a clean bill of health, complaints against a rival), Cousin Sal's Pawn (sell what you took from the dead, second-hand caskets) and Mourne & Sons (spy, a price war, a truce). None pays BP directly. Rules in [docs/expanded-rules.md](docs/expanded-rules.md) sections 30 and 31. Each has new map buildings and scene pictures in the style of the existing ones (and portraits for its keeper), and its text is in the Expanded content pack. The computer rivals use all eight in character, and balance round 19 measured and tuned them ([docs/balance/expanded-tuning-log.md](docs/balance/expanded-tuning-log.md)): no place is a money pump or an anti-PvP lock, but with them the tycoon wins about three times its share (was 1.6), which is still open. The coroner and the Mournes are now cast names in the pack, and batch B's prices no longer print "$$".
- **Bring a 2001 town across**: `node server.mjs import-legacy --dir <old server folder> --town <id>` reads the original server's `player.dat`, `config.dat` and `system.dat` into a new Classic town, with names and parlors exactly as they were. The old plain-text passwords are not carried over by default (each player gets a new one, written to a file for the sysop; `--keep-passwords` keeps them, hashed). What the new server has no place for is listed, not silently dropped ([docs/sysop-guide.md](docs/sysop-guide.md) section 9).
- **The Docker image reports its build**: `FQ_BUILD=$(git rev-parse --short=7 HEAD) docker compose build` (or `--build-arg FQ_BUILD=...`); without it the image still says `dev`.

- **Expanded was audited in the browser** the way Classic was: 26 tests play every feature (the tour, the negotiation and its hand, packages, money and stock, karma, upgrades, rivalry, the graveyard, church, City Hall, hospital, Reaper Club and bank, the living town, chains, the Daily Challenge) against the real server ([docs/expanded-audit.md](docs/expanded-audit.md)). Eight defects found and fixed: the graveyard said every monument was built when none was; a place's note (including the original bank note) vanished behind a panel; the luck meter was empty beside place panels; black-market hints showed raw colour codes; the teller rounded the savings rate; the stats sheet left out a Cutthroat parlor's extra visit; a ballot card read "1 votes".
- **More Expanded content**, measured against the plan's targets (all met except map locations): 15 events, 9 news blurbs, 3 risks, 5 special customers, and 25 or more lines in every tell, arrival, returning-family, walkout and haggle pool; the coroner, Dr. Ignatius Grimble, and the rival parlor family, the Mournes, join the cast ([docs/content/expanded-volume.md](docs/content/expanded-volume.md)). No original line changed.
- **Balance round 17**: the computer rivals buy the Memorial Garden and the Night Watchman earlier; no play style now wins less than a third of its fair share (three did), two still win more than twice theirs ([docs/balance/](docs/balance/)).
- **Classic**: an idle player is now announced to the town as the original did ("got kicked for inactivity", `user_list.cpp:167`) before being logged off; saving across a restart and the original client's wire encoding are proven by new tests.

- **Every sound pack and the character voices ship in every build.** The owner confirmed the ElevenLabs terms (decision 24), so the Studio and "Original, remastered" packs and the voices are now in the web build on GitHub Pages, the release zips, the desktop and Android apps and the Docker image. Until now the Pages site and the release zips carried the Synth pack only, and the voices were opt-in.
- The project is called **FuneralQuest Remastered** (decision 21); feedback goes to GitHub Issues (decision 22); the Docker image was built and run (ALPHA.md A10); the solo-only game is live at https://cdavisv.github.io/FuneralQuest-Remaster/.

## 0.1.0-alpha.1 (2026-11-07)

The first alpha, on top of pull requests 1 to 3 below. What alpha means here, and what is still open (a playtest by real people, the Docker image), is in [docs/ALPHA.md](docs/ALPHA.md).

### For players

- **Every Classic feature was played through in the web client** against the real server, with the original text as the oracle (33 browser tests, the table in [docs/ALPHA.md](docs/ALPHA.md)). Three things it found are fixed: speaking in the cafe wiped the conversation; on a phone the sale's and the shops' text shrank to a line or two behind five stacked buttons (four or more choices now sit in two columns); and at the end of a tournament the "session ended" screen said "reset by the sysop" without naming the winner.
- **Sound packs by ruleset.** Settings, Sound pack has a new default, "Automatic": Classic towns, Classic solo careers and museum mode play "Original, remastered"; Expanded towns, careers and the Daily Challenge play "Studio". Synth, Studio and Original, remastered can still be chosen outright. A pack missing a track falls back to the next one. A stored "Synth" that was never chosen in the panel becomes Automatic once; a pack picked in Settings is kept.
- **The "Original, remastered" sound pack exists:** 35 new recordings made to resemble each of the 2001 game's sounds, including the organ. Nothing from the original audio is copied or used as input.
- **All 74 character voice clips** are in, for every spoken line in the game's text.
- **Version on screen.** The front door and Settings show "Alpha 0.1.0 (build abc1234)", so a report can say exactly which build it is about.
- **Send feedback.** A "Send feedback" link on the front door and in Settings opens a report already filled in with the version, build, ruleset, browser and the screen you were on, and a box for what happened. Nothing is sent from the game: you copy the report and paste it into a new GitHub issue (https://github.com/cdavisv/FuneralQuest-Remaster/issues/new). The alpha.1 builds were made before that address was set, so their dialog shows a marked blank where it should be; the release notes name the address. In the solo-only build the report leaves out the browser details.
- **Newcomer documents.** The README now says what alpha means, how to play online, solo and in museum mode, how to host a private town and how to report a bug; the status page was brought up to date.

### For people who run a town

- **A season was run on the real server before anyone played it.** The soak harness (`tools/soak`) plays a whole tournament of computer players over HTTP and WebSocket, kills the server at the worst moments (mid-day with requests in flight, inside midnight maintenance, inside the final reset), takes a backup during play and restores it two days later, and checks about 200,000 invariants on the way. A 14-day Classic tournament and a 30-day Expanded season both passed, as did a 40-player stress run; a short mode runs on every pull request.
- **Backups from the admin page.** A Backups tab makes, lists, downloads and deletes consistent backups, and a town can be rolled back to a snapshot. `FQ_BACKUP_INTERVAL_HOURS` takes them on a schedule.
- **`/health` reports the version.**
- **Alpha builds you can download.** A release workflow builds, in one go: the web bundle (an online-capable one and a solo-only one, each a zip with a README), the Linux desktop app (`.deb` and AppImage), the Android debug APK and an unsigned release APK, and the server as a tarball with its Dockerfile, with a checksum list. It is started by hand or by a version tag, attaches the files to a draft release, and publishes nothing to any store, GitHub Pages or Docker registry.
- **One version everywhere.** The server tarball carries a `version.json`, the desktop app and the Android app take their version from the same place as the web client, and CI checks that the copies agree.
- **CI** now also checks that the version agrees across the apps and that every workflow file is valid.

## 0.1.0-alpha.0 and earlier: pull requests so far

### Pull request 3: the owner's decisions, and character voices

- **Museum mode** shows the original server's log-on banner exactly as the 2001 server built it, followed by one line naming the remaster engine.
- **Guests** can play and read but cannot type for other players (chat, letters, announcements, fortunes, battle quotes, chain names). A guest can make a full account from Settings and keep the parlor.
- **Online play** starts with a stated 18+ rating and one tick box. Nothing about age is checked or stored. Solo has no such notice.
- **Solo-only build.** A build with all online features removed, used for the first mobile release (no internet permission on Android) and for a free web build. A GitHub Pages workflow exists for the web build; it runs only when the owner starts it and has never run.
- **Sound is on by default**, starting at the first click or key press, with a mute button on every screen.
- **Character voices.** Spoken lines for some of the town's characters (34 clips, generated from the game's own text), a "Character voices" setting, on by default in Expanded and solo, off in Classic.
- **A third sound pack** ("Original, remastered") is plumbed in; no audio exists for it yet. The listening page gained a column for comparing against the 2001 originals, played from a local copy that is never committed.
- Decision record in [docs/DECISIONS.md](docs/DECISIONS.md); open items in [docs/TODO.md](docs/TODO.md).

### Pull request 2: checked against the original, Expanded retuned, apps hardened

- **Classic was checked against the original game.** The 2001 server's own code, compiled for Linux, was played side by side with the port: 10,000 generated customers and 213,350 steps matched in every random draw, player record and word. ([What is and is not verified](docs/classic-fidelity.md).)
- **Fixes that came out of that check:** a mail-timing bug; the original time stamps on notices restored; log-on refused while someone is inside your parlor, as in the original; two more behaviours moved behind switches, so a town with all fixes off plays exactly like the original; five fixes in the bridge that lets the original Flash client play the new engine.
- **Expanded** got another balance round and a 200-town baseline ([docs/balance/](docs/balance/)); it still misses its win-share target in places and is not called balanced. Moderators can remove a single announcement or letter.
- **A second, optional sound pack ("Studio")** made with ElevenLabs, and a page for listening to the packs side by side. The code-made Synth pack stays the default.
- **Apps:** a server security review ([docs/security.md](docs/security.md)); compression and a bundle size budget ([docs/performance.md](docs/performance.md)); browser tests now run in Chromium, Firefox and WebKit; CI split into parallel jobs.
- The original text and art stay exactly as they were in every mode; the one altered portrait was removed from the Remastered art pack.

### Pull request 1: FuneralQuest Remastered

- The original 2001 server, Flash client and content moved under `legacy/`, untouched.
- **A rules engine** with two rulesets: **Classic**, the 2001 game ported line by line, and **Expanded**, built on the features the original authors cut.
- **Content packs:** Classic is the untouched original text; Expanded adds to it and never replaces an original line. A build check enforces both.
- **An online server** (accounts, towns, a day scheduler, an admin page, reports, blocking and muting, account deletion and data export), **an offline Solo mode** with computer rivals, and **museum mode**, which lets the unmodified Flash client play the new engine in the Ruffle emulator.
- **A web client** with the original art as vectors, three layouts, gamepad support and an installable offline-capable app, plus a Remastered art pack and an original score made from code (the original sounds are not reused).
- **Desktop (Tauri) and mobile (Capacitor) wrappers**, and the release checklists in [docs/release/](docs/release/).
