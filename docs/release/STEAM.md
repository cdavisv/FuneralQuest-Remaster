# Steam release (free game, no Steamworks SDK)

Store-page assets, the content survey and the age rating are in [checklist-steam.md](checklist-steam.md). This file is the build and launch side. Details of Steam's rules change; check each point in the Steamworks documentation at submission (<https://partner.steamgames.com/doc/home>).

## What a free release needs

1. **A Steamworks partner account** (identity and tax details, bank details even for a free game) and the **Steam Direct fee per app** (USD 100 at the time of writing; refundable against revenue, which a free game will never earn). The account owner does this; nothing here can.
2. **An app id.** Created when the fee is paid. Put it in `steam_appid.txt` only for local tests (never ship that file); the id itself is not needed inside the game because this build does not call the Steamworks API. Record it in `docs/release/README.md` (`[STEAM APP ID - OWNER TO FILL IN]`).
3. **Depots.** One depot per operating system, so players only download theirs: Windows (the NSIS installer's contents, or better the bare `funeral-quest.exe`), Linux (see below), macOS (the `.app`). Depot ids are given by Steamworks (usually app id + 1, 2, 3).
4. **A build uploaded with `steamcmd`** (`app_build_<appid>.vdf` plus one `depot_build_<depotid>.vdf` per depot, `ContentRoot` pointing at a folder holding the files), then set live on a branch in *SteamPipe > Builds*. Start with a private branch and keys for testers.
5. **Store page and review**: page assets, trailer (optional), content survey, age rating (expect Mature), a price of **Free**, the privacy policy URL, and Valve's review of the store page and then of the build (a few days each).
6. **The Steamworks SDK is optional.** It is only needed for achievements, stats, Steam Cloud through the API, rich presence, Steam Input action sets and the overlay hooks. A free game with none of those ships without it, and **this repository does not include the SDK** (its licence forbids redistribution in a public repository). `steamcmd` is a separate download and is only used to upload.
7. **Disclosures**: the AI-use statement for assets, the user-generated-content and online-interaction answers in the content survey, and a contact for abuse reports (see [ugc-and-moderation.md](ugc-and-moderation.md)).

## Depot contents

| Depot | Contents | Launch option (*Installation > General*) |
| --- | --- | --- |
| Windows | `funeral-quest.exe` from `src-tauri\target\release` (plus `CREDITS.md` and `LICENSE-Proton-SDK.txt`) | Executable `funeral-quest.exe`, OS Windows |
| Linux and SteamOS | The AppImage (bundles WebKitGTK, which the Steam runtime does not have) and a `launch.sh` | Executable `launch.sh`, OS Linux + SteamOS |
| macOS | `Funeral Quest.app` (signed and notarised, see [BUILDING.md](BUILDING.md)) | Executable `Funeral Quest.app`, OS macOS |

`launch.sh` for the Linux depot:

```sh
#!/bin/sh
cd "$(dirname "$0")"
# The AppImage needs FUSE; if the system has none, unpack and run instead.
export APPIMAGE_EXTRACT_AND_RUN=1
exec ./Funeral_Quest.AppImage "$@"
```

Rename the built `Funeral Quest_0.1.0_amd64.AppImage` to `Funeral_Quest.AppImage`, mark both files executable (`chmod +x`) before uploading, and keep Unix permissions by building the depot on Linux or setting them in the depot's file mapping.

Launch options go in **Steamworks > Your app > SteamPipe > Installation > General** (executable, arguments, working directory, OS, and an *Open* type of launch option). Add no arguments: the app takes none. A launch option cannot set the server address; either bake it in at build time (`FQ_DEFAULT_SERVER=https://... pnpm desktop:build`) or let players set it in the app (Game > Server address, or F2; with a controller, Start).

## Steam Deck

Valve rates games *Verified*, *Playable*, *Unsupported* or *Unknown* from a review of a Linux build or a Proton build. Checks to expect (verify against Valve's current *Steam Deck Compatibility Review* page):

| Valve's check | State of this build |
| --- | --- |
| Controller support: all functionality reachable with the built-in controls, including the first launch | **Not yet.** The wrapper maps a gamepad (d-pad and stick move focus, A presses, B is Escape, X/Y/LB/RB are 1 to 4, Start opens server settings), but the client has no native gamepad navigation or on-screen glyphs, and text entry (log-on, name, chat) needs the Deck's on-screen keyboard (the Steam button + X; the client does not bring it up by itself). Expect *Playable* until the client owns gamepad support |
| In-game button glyphs match the controller | **Not done.** The client shows no glyphs; it shows numbered buttons. Add glyphs (or no glyph, only plain "Press A") |
| Default text is legible at 1280x800 | Likely: the client's three layouts adapt to the viewport, and 1280x800 is wider than 1.55:1, so the *wide* layout is chosen. **Unverified on a Deck.** Check body text against Valve's minimum size |
| The game runs on the Deck without extra setup / a launcher that is not Steam | Yes (the app starts straight into the front door). No anti-cheat, no launcher |
| Default graphics config suits the Deck | Yes: 2D, no GPU demands |
| If the game has online play, no third-party account login needing a keyboard that fails | Log-on uses a name and password; guests need none. Entering them is keyboard text input |

To prepare: set the Deck-friendly defaults, add a Steam Input *Gamepad* controller template in Steamworks (*Edit Steam Input Configuration* > template *Gamepad*; the game reads a standard gamepad through the browser Gamepad API), test with *Steam > Settings > Controller* and on a real Deck in game mode and desktop mode, and then request a compatibility review in *Steamworks > Steam Deck*. Mention controllers only in the store page's *Controller support* field when it is honestly "Partial".

**Client work that moves the rating to Verified** (client, not wrapper): native gamepad navigation and glyph hints in `apps/client`, bringing up the system on-screen keyboard on text fields (the Deck does this for web inputs in some modes), and a text-size setting.

## Updating

Each release: bump the version in `apps/desktop/src-tauri/tauri.conf.json` and `Cargo.toml`, build on each OS (or take the CI artifacts), copy to the depot folders, upload with `steamcmd +run_app_build ...`, test on a branch, then set it live. Players' saves and the server address live in the webview's data folder (`~/.local/share/org.funeralquest.remaster`, `%APPDATA%\org.funeralquest.remaster`, `~/Library/WebKit/org.funeralquest.remaster`) and survive updates. Steam Cloud is not set up; players can export a career from the front door of Solo mode.

## Credits and licence

`CREDITS.md` (with the required acknowledgement "This product includes software written by Seth A. Robinson (www.rtsoft.com)") and the Proton SDK licence are installed next to the executable by the Tauri bundle and are in the app's *Help > About*. Keep both in the depot. See [licences-and-credits.md](licences-and-credits.md).
