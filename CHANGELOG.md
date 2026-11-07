# Changelog

What changed, in plain language, for players and for people who run a town. The newest version is first. The project is in **alpha**: it is playable and heavily tested, and it has not had real players yet (see [docs/ALPHA.md](docs/ALPHA.md) for what alpha means here and what is still open).

The version number lives in one place, the root `package.json`, and every app reads it. Versions look like `0.1.0-alpha.1`; the game shows it as "Alpha 0.1.0 (build abc1234)", where the build is the commit it was made from.

## Unreleased

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
