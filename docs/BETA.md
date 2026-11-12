# Beta: definition and checklist

The plan (`docs/REMASTER_PLAN.md`, Phase 5) defines Beta as Expanded v1: the systems of section 3.3 built, content at the volume targets, balance checked by simulation, the Daily Challenge and Blitz towns, then a closed beta (invite, about 50 players, one season) and an open web beta. **Beta exit:** two full 30-day seasons completed, the day-7 return rate measured and acceptable, no critical bug open for two weeks, and the moderation tools exercised. This file is the working checklist; the alpha's is [ALPHA.md](ALPHA.md). "Done" means built, tested and, where it says so, run; it never means "played by people" unless the row says that.

## What the software must be (built and checked without players)

| # | Criterion | State |
|---|---|---|
| B1 | Every Expanded system of plan 3.3 A to F is in the engine and reachable in the web client | done: `docs/expanded-rules.md` sections 3 to 24, audited in the browser ([expanded-audit.md](expanded-audit.md)) |
| B2 | The map has the plan's 20 places | done: twelve original and town places plus the eight of sections 30 and 31; all eight are played in the browser by the Expanded audit (38 tests, Chromium and Firefox), and a sysop can read and set their 101 numbers per town. The four client defects and the six engine, pack, server and document defects that audit found are fixed ([expanded-audit.md](expanded-audit.md), "Defects") |
| B3 | Content at the plan's volume targets | done ([content/expanded-volume.md](content/expanded-volume.md)): events, news, arcs, risks, soft-sell items, upgrades, fortunes and every pitch, refusal and reaction pool. No original line was changed |
| B4 | The cast of plan 3.3 G | done for the new cast (the Reaper Club's owner, the health inspector, the coroner, the rival Mourne family) and for roles for the existing one. The plan's line about rewriting Mr. Yang and June is **not** done and will not be: the owner's rule (2026-11-06) keeps the original content exactly as it was |
| B5 | Balance checked by simulation: no strategy dominates, closed exploits stay closed | partly. Checked: 20 rounds of simulation ([balance/expanded-tuning-log.md](balance/expanded-tuning-log.md)), the closed exploits stay closed (property tests), nothing bought is dead and nothing returns points per dollar like a monument, and the eight new places cost the field 0.6% of its points. **Not met:** the tycoon wins 3.38 times its fair share (+6.5% of its towns' points; the target was about twice and under +4.5%) and the necromancer 2.33 times, while five styles win less than a third. Round 20 showed the tycoon's edge from the new places is protection and karma (the night patrol, Mourne & Sons' free hold), not money, and that no price reaches a parlor that ends the season with $46,000 it cannot spend. The two changes that would reach it are rules, not numbers, and wait for the owner ([TODO.md](TODO.md)). In points the styles are close (all but the saboteur within 1.7% of their towns' mean), so this is about who comes first, not about a style being unplayable |
| B6 | Daily Challenge and Blitz towns | done: the Daily Challenge online and as Solo practice (browser-tested); a Blitz town is a town with `dayLengthMinutes` set (scheduler and admin tests), shown in the lobby with its countdown |
| B7 | A 30-day Expanded season runs on the real server through kills, restarts and a backup restore | done, re-run with the eight new places (2026-11-11): `pnpm --filter @fq/soak run soak -- --rules expanded --days 30 --players 8` played 31 game days (74,739 actions, none refused though offered) through five hard kills (mid-day with and without requests in flight, inside midnight maintenance, inside the final reset), a fresh install from a day-9 backup, a snapshot rollback and the sysop's actions; 153,197 invariant checks, none failed; the season ended with a winner and a new season began. The computer players visited and used all eight new places (the transcript shows each place's buttons pressed, the pickers included) |
| B8 | An in-game way to send feedback | done: "Send feedback" on the front door and in Settings; reports go to GitHub Issues (decision 22) |
| B9 | The sysop can measure whether players come back | done (2026-11-11): one row per account, town and UTC day played, nothing else; `GET /admin/stats` and the admin page's Activity tab give each first-play cohort's day-1, day-3, day-7, day-14 and day-30 return. Nothing leaves the server |
| B10 | A closed beta can be run: sign-up by invite | done (2026-11-11): `FQ_INVITE_REQUIRED`, invite codes made and revoked on the admin page's Invites tab, for new accounts and guests alike; which account used which code is not recorded ([sysop-guide.md](sysop-guide.md), "Running a closed beta") |
| B11 | Moderation tools exist and are tested | done: report, block, mute, takedown, bans, account deletion and export, the strict word list (unit and browser tests). **Not exercised by a moderator on real reports** |
| B12 | A 2001 town can be brought across | done: `import-legacy` reads the original server's save files into a Classic town (not a plan criterion for Beta; it was the first item of the plan's post-launch backlog) |

## What needs people or the owner

| # | Criterion | State |
|---|---|---|
| B13 | Alpha's own exit: a private town of 5 to 10 people finishes a 14-day Classic tournament | open ([ALPHA.md](ALPHA.md) A9) |
| B14 | A place to run it: an official server with a contact address and reviewed privacy policy and terms | open: the owner's steps in [TODO.md](TODO.md) (project email, lawyer review, who answers reports). The Docker image and the sysop guide are ready |
| B15 | Closed beta: about 50 invited players, one 30-day Expanded season | open |
| B16 | Open web beta, with a community channel | open; a Discord is the owner's choice (the in-game feedback goes to GitHub Issues either way) |
| B17 | Beta exit: two full 30-day seasons, the day-7 return rate read off the Activity tab and judged, no critical bug open for two weeks, moderation exercised on real reports | open |

## Decisions the owner has been asked for

They change how Expanded feels, so they were measured and not applied (the evidence is in [balance/expanded-baseline.md](balance/expanded-baseline.md) and [balance/expanded-tuning-log.md](balance/expanded-tuning-log.md)):

- **How fairness is judged.** By win share, a tight eight-seat field always shows a play style or two above twice its share; by mean place and points against the town mean the field is within a few percent. Which one is the target?
- **The length of a day.** About 350 screens and 190 choices for 16 customers. The proposals: a standing order at Di-Mart, a body-preparation default that follows the karma path, the soft-sell cards and packages on the negotiation screen, all mail on one screen.

## Out of scope for Beta

Store submissions, signed installers, iOS, Windows and macOS builds, online play on mobile, portraits by an illustrator, other languages, web push notifications (the mobile app reminds locally; a browser gets nothing), a public town directory, an interpreter for the original's community scripts, and a content-pack browser. All of these are Phase 6 or the plan's post-launch backlog.
