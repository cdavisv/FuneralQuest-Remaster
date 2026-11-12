# Owner's decisions

A record of what the owner has decided, with the date. Things still waiting on the owner are in [TODO.md](TODO.md).

## Standing rule (2026-11-06)

Original 2001 content is kept exactly as it was: dialog, game content and behaviour, and visuals. Nothing original is censored or altered on grounds of taste, sensitivity or modern ethics. Gameplay bug and exploit fixes stay, behind `fixes` flags, and a town can run with all of them off. The rule is in `CLAUDE.md`.

## Decisions

| # | Question | Decision | Date | What it means in the project |
|---|---|---|---|---|
| 1 | Approve the 21 softening edits to Classic text? | No | 2026-11-06 | Removed. The Classic pack is the untouched original text; Expanded only adds. A build check enforces it. |
| 1a | Keep the change that stopped the customer generator producing one of the original's relationship outcomes? | No | 2026-11-06 | The original relationship table is restored and the switch removed. |
| 1b | Keep the Remastered art pack's altered copy of one original portrait? | No | 2026-11-06 | Removed; the original portrait shows under every art pack. |
| 2, 3 | Replace any of the eight flagged lines newly written for Expanded? | No, keep all eight | 2026-11-06 | Kept as written; the alternative wordings were deleted. |
| 3a | Do the gameplay bug and exploit fixes stay? | Yes | 2026-11-06 | They stay behind flags, default on. |
| 3b | In museum mode, show the original server's log-on banner exactly as the original did? | Yes | 2026-11-06 | Restore the original banner, followed by a second line naming the remaster engine. |
| 4 | Keep the Di-Mart story arc's test at 70 sales per player? | Yes | 2026-11-06 | No change. |
| 5 | Keep "no parlor is deleted for having no sales" in solo mode? | Yes | 2026-11-06 | No change. |
| 6 | Let balance rounds proceed without sign-off on each? | Yes | 2026-11-06 | Rounds are logged in `docs/balance/expanded-tuning-log.md`. |
| 7 | Let guests chat, send letters and post announcements? | No | 2026-11-06 | Guests can play and read. Free text needs a free account. |
| 8 | Minimum age 18 for online play? | Yes, as a rating and a tick box, with no age verification | 2026-11-06 | The first-run notice for online play states the rating and has an "I am 18 or older" box. Nothing checks identity or stores a birth date. Solo has no gate. |
| 9 | Accept the default moderation thresholds and retention periods? | Yes | 2026-11-06 | Auto-mute after 3 reporters in 60 minutes for 24 hours; audit log 90 days; closed reports 180 days. |
| 10 | Use the owner's personal email as the public contact address? | No | 2026-11-06 | A project address will be set up later. See TODO. |
| 11 | Make the first mobile release solo-only? | Yes | 2026-11-06 | Mobile builds ship with online play switched off until decided otherwise. |
| 12 | Keep `org.funeralquest.remaster` as the permanent app id? | No | 2026-11-06 | A real id is needed before any store upload. See TODO. |
| 13 | Hold store listings until the "Funeral Quest" name is confirmed in writing? | Yes | 2026-11-06 | No store submission before then. |
| 14 | Publish a free solo-only web build on GitHub Pages? | Yes, once the name is confirmed | 2026-11-06 | Published on 2026-11-07 after decision 21: https://cdavisv.github.io/FuneralQuest-Remaster/. The workflow runs only when started by hand. |
| 15 | Ship a beta with the nine new portraits that need an illustrator? | Yes for beta | 2026-11-06 | They stay in the Remastered pack for now; replace before 1.0. |
| 15a | Which sound pack is the default? | Automatic, by ruleset: Classic towns, Classic Solo careers and museum mode play "Original, remastered"; Expanded towns, Expanded Solo careers and the Daily Challenge play Studio. Synth stays as an offering | 2026-11-06 | The owner's words: "my sound goal is to have a 'synth' soundtrack offering in settings, the classic game will use original remastered sounds, while the extended/expanded remaster will use the studio soundtrack." Settings, Sound pack gains "Automatic (recommended)", the default; Synth, Studio and Original, remastered override it everywhere, and a saved choice is kept. A pack that lacks a track falls back Original remastered, then Studio, then Synth (one line, `FALLBACK_ORDER` in `packages/audio/src/packs.ts`). The front door plays the remaster. The Studio and remaster terms were confirmed on 2026-11-07 (decision 24). |
| 15b | Add spoken character voices using ElevenLabs? | Yes | 2026-11-06 | Being added as a voice pack for the town's characters. |
| 15c | Also make ElevenLabs remakes of the original 2001 sounds, as a third pack beside Synth and Studio? | Yes | 2026-11-06 | A pack called "Original, remastered": new audio made to resemble each original sound, with its own column on the listening page. It replaces neither Synth nor Studio. The original recordings are not uploaded or used as input. |
| 16 | Turn sound on by default? | Yes | 2026-11-06 | Sound defaults to on. Browsers still wait for the first click before playing anything. |
| 17 | New code under the Proton SDK licence, new art and audio under CC BY 4.0? | Yes | 2026-11-06 | As the plan specified. The ElevenLabs-generated audio is the exception: its terms are those of the owner's plan, confirmed to allow distribution (decision 24). |
| 18 | Add the owner's user to the `docker` group? | Yes | 2026-11-06 | Done 2026-11-07 (`usermod -aG docker`, the daemon enabled and started); the image was built and run the same day (ALPHA.md A10). |
| 19 | Allow auto-merge on the GitHub repository? | No | 2026-11-06 | Pull requests are merged by hand once checks are green. |
| 20 | Open a pull request against the original repository? | No | 2026-11-06 | Not done. |
| 21 | What is the project called? | "FuneralQuest Remastered" | 2026-11-07 | The owner's words. The name of the project, the releases, the GitHub Pages site, the app launcher entries (desktop, Android) and the documents. The game itself keeps its original title, "Funeral Quest": the logo, the front door and the in-game brand line are the original's. The written confirmation of the "Funeral Quest" name from Robinson Technologies (decision 13) is still awaited for store listings; the Pages build no longer waits for it. |
| 22 | Where does alpha feedback go? | GitHub Issues | 2026-11-07 | Issues were switched on for the repository and the variable `FQ_FEEDBACK_DESTINATION` set to `https://github.com/cdavisv/FuneralQuest-Remaster/issues/new`. Builds made after that carry the link in the "Send feedback" dialog; the 0.1.0-alpha.1 builds were made before it and show the marked blank, so the release notes and the README name the link. |
| 23 | Publish the first alpha pre-release? | Yes | 2026-11-07 | Published as "FuneralQuest Remastered 0.1.0-alpha.1" (pre-release, build b7b071e) with its seven files and `SHA256SUMS`: https://github.com/cdavisv/FuneralQuest-Remaster/releases/tag/v0.1.0-alpha.1 |
| 24 | Do the ElevenLabs plan's terms allow the Studio pack, the \"Original, remastered\" pack and the character voices to be distributed (public repository, web, desktop and mobile builds, store builds)? | Yes, confirmed by the owner | 2026-11-07 | The owner's words: \"terms confirmed. go with audio and voice\". All three packs and the voices now ship in every build, including the GitHub Pages site and the release zips, which until then carried Synth only. The three `LICENSES.md` ledgers record it. |
| 25 | Make the night patrol's price grow with the buyer's Bury Points? | Yes | 2026-11-12 | Built as a price against the leader (balance round 21): the patrol and the back door cost $25 more for each BP the buyer is ahead of the average of the town's other open parlors, rounded up to $100 (`town.placesA.police.aheadPerBp`). A parlor at or below the average pays the listed price, so the poorer parlors are not shut out. Expanded only. |
| 26 | Limit the karma from Mourne & Sons' free hold? | Yes | 2026-11-12 | Once held, the hold opens again 3 game days later (`town.placesB.mournes.hold.everyDays`); undercutting stays open. Expanded only. |
| 27 | Does Expanded content or rebalancing change Classic? | No, and it is locked | 2026-11-12 | The owner's words: "make sure there is still the classic game mode and all of the extended game content and rebalancing that changes the gameplay doesn't affect the classic mode". Checked before the second alpha was merged: no Classic source, rule number, pack line or recorded playthrough has changed since 2026-11-07, before the eight new places and balance rounds 18 to 21. Guarded by `packages/core/test/classicRegression.test.ts` (recorded playthroughs), `classicIsolation.test.ts` (every Classic rule number recorded; the Classic registry has only the original places and no hooks; a Classic town plays the same after an Expanded town in the same process) and the comparison with the compiled 2001 engine (`tools/oracle`). |
| 28 | Publish the second alpha pre-release once its files are verified? | Yes | 2026-11-12 | See the release page for 0.1.0-alpha.2. |
