# Changelog

What changed, in plain language, for players and for people who run a town. The newest version is first. The project is in **alpha**: it is playable and heavily tested, and it has not had real players yet (see [docs/ALPHA.md](docs/ALPHA.md) for what alpha means here and what is still open).

The version number lives in one place, the root `package.json`, and every app reads it. Versions look like `0.1.0-alpha.1`; the game shows it as "Alpha 0.1.0 (build abc1234)", where the build is the commit it was made from.

## 0.1.0-alpha.1 (not yet released)

The first alpha: this is the branch `dev/alpha`, on top of pull requests 1 to 3 below. Work from the other alpha tracks (the 14-day soak test, the sysop's backup and restore, the audit of every Classic feature in the web client) is tracked in [docs/ALPHA.md](docs/ALPHA.md) and is listed here as each piece is finished.

### For players

- **Version on screen.** The front door and Settings show "Alpha 0.1.0 (build abc1234)", so a report can say exactly which build it is about.
- **Send feedback.** A "Send feedback" link on the front door and in Settings opens a report already filled in with the version, build, ruleset, browser and the screen you were on, and a box for what happened. Nothing is sent from the game: you copy the report and send it to the address shown at the bottom. That address is not set up yet (the project's issue tracker is switched off for now); the dialog says so in a marked blank until it is. In the solo-only build the report leaves out the browser details.
- **Newcomer documents.** The README now says what alpha means, how to play online, solo and in museum mode, how to host a private town and how to report a bug; the status page was brought up to date.

### For people who run a town

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

### Pull request 1: Funeral Quest Remastered

- The original 2001 server, Flash client and content moved under `legacy/`, untouched.
- **A rules engine** with two rulesets: **Classic**, the 2001 game ported line by line, and **Expanded**, built on the features the original authors cut.
- **Content packs:** Classic is the untouched original text; Expanded adds to it and never replaces an original line. A build check enforces both.
- **An online server** (accounts, towns, a day scheduler, an admin page, reports, blocking and muting, account deletion and data export), **an offline Solo mode** with computer rivals, and **museum mode**, which lets the unmodified Flash client play the new engine in the Ruffle emulator.
- **A web client** with the original art as vectors, three layouts, gamepad support and an installable offline-capable app, plus a Remastered art pack and an original score made from code (the original sounds are not reused).
- **Desktop (Tauri) and mobile (Capacitor) wrappers**, and the release checklists in [docs/release/](docs/release/).
