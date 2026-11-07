# Classic fidelity: the port against the original code

`tools/oracle` compiles the original server's game logic (`legacy/source`, unmodified) for Linux and drives it side by side with `@fq/core`, through the original-protocol bridge `@fq/legacy-compat`, with the same seeds and the same client requests. It compares the random draws, every player record, the screens and the words each player reads. A static audit checks every player-facing string of the C++ and the scripts against the port's text. This file says what was compared, what matched, every difference found and what became of it, and what is still unverified.

```
pnpm --filter @fq/oracle run build        # compiles build/fq-oracle (needs g++ with -m32)
pnpm --filter @fq/oracle test             # the oracle's checks (skipped when not built) and the text audit
pnpm --filter @fq/oracle run compare      # the differential suite; writes build/report.json
pnpm --filter @fq/oracle run inspect <family> <seed> [from] [to] [player]   # one walk, step by step
pnpm --filter @fq/oracle run text-audit   # the static text audit, listed
```

`compare` takes `ORACLE_CUSTOMERS` (default 10000), `ORACLE_WALKS` (walks per family, default 40) and `ORACLE_FAMILIES`.

## 1. How the original is built

- **What compiles.** 62 of the project's translation units, unmodified, as C++98 (`-std=gnu++98`; the code relies on rules C++11 removed, such as `return false;` from a pointer function), 32-bit (`-m32`): the whole game logic (`funeral.cpp` with the files it `#include`s), every `commands_*`/`command_*` handler, customers, negotiation, risks, events, maintenance, rankings, mail queue, swear and ban filters, the file loaders, and the whole script engine (`shared/CScript*`, `CTextParse`, `uni`), which runs the real `legacy/dist/script/*.c`. The list is `tools/oracle/scripts/config.ts`.
- **What is stubbed** (`cpp/shim/src/fq_stubs.cpp`, each stub says what the original did): the MFC dialog (log lines go to the harness), the HTTP server (`send_msg` records the response text before `format_for_web_cst`), the licence thread (only sets the player limits, reproduced), speech, and the `CProtection` constructor (its file does not compile with g++ because of `unsigned long (x)` casts; the constructor, which seeds both generators and draws once, is reproduced).
- **The shim** (`cpp/shim/include/fq_win32.h` and `src/`): Win32 types with x86 sizes; `CString` following ATL's `CStringT<char>` method by method; MFC's bitwise passing of a `CString` to `"%s"` (every live `CString` registers its address and the shim's printf family prints the text of a registered `CString`); `CArray` with MFC's zeroed growth; Winsock's `in_addr` with the `S_un` union; the Microsoft C runtime `rand()`/`srand()`; 16-bit `wchar_t` with reimplemented `wcs*` functions (the scripts are UTF-16); `GetTimeFormat`/`GetDateFormat` reading Windows picture strings ("h':'mm' 'tt" gives "12:05 AM"); `fopen` with Windows paths, reading the content files from `legacy/dist` case-insensitively and writing everything else into a scratch directory (`deeds.txt`, `log.txt` and other runtime files shipped in `legacy/dist` count as absent, as on a fresh install); a working directory and `FindFirstFile` so `reset_game` really deletes; a clock the harness sets (UTC); case-insensitive include names through symlinks.
- **The harness** (`cpp/harness/oracle_main.cpp`) reads commands on stdin (`seed`, `clock`, `init`, `req`, `drop`, `midnight`, `set`, `grant`, `customers`, `state`, `peek`, `crt`) and prints one JSON line per command: the responses, the original's log, every `player_struct`, each online player's `communication_status`, queue and options, the town globals, and both generators' draw counts since the last `seed`.
- `init` runs the real `server_init()`; `midnight` moves the clock to the next midnight and runs `maint_time_check()`.

## 2. How the two sides are kept comparable

- **Random streams.** The original draws from one global Mersenne Twister and one `rand()`; the port gives each player a stream per day. A test-only injection point, `EngineContext.sharedRandom`, makes every turn draw from one `ClassicRandom`; it is off unless set (before any fix, with it unset, the regression fixture hashes were reproduced exactly). The harness seeds `g_random` and `srand`, then locks `srand` so the original's `srand(time(NULL))` stands for "the clock read this value".
- **Rules.** The port runs `originalClassicRules()`: every `fixes` flag off, so the comparison is against the original behaviour. Since the merge with `master` (pull request 1) the default `CLASSIC_RULES` differ from it only in the `fixes` flags: the customer generator is the original's with no switch (`allowMinorAdultLover` is gone) and `filterUserText` is off in Classic, as the original never filtered mail or fortunes; `tools/oracle/test/oracle.test.ts` checks this. `ORACLE_RULES=default` runs the same suite with `CLASSIC_RULES` (section 3.1).
- **Content.** The port reads the Classic pack (`packages/content/built/classic.json`, the untouched original text; `vintage` is only an alias of it).
- **Requests.** Both sides receive the same client actions, turned into requests as welcome.swf builds them (`docs/reference/welcome-actionscript.md`): each side's own last response decides a button's command number, the client's sticky root variables are sent back as the movie does (an old `i_command_sub` or `i_return_command_sub` included), prompt answers carry `st_input`/`st_extra_text`/`i_his_id`, the name box's Yes/No/"nobody"/Cancel paths, Reply opening the pad in the client, the pad asking for the desk after a letter, newlines as `\r`, form encoding.
- **What is compared after every step:** both generators' draw counts; every player record; each online player's current customer (every field, mood and cheapness as 32-bit floats, the options); the day and yesterday's top seller; and, word for word after removing markup, every text variable the original sent (`st_main`, `st_message`, `st_news`, `st_generic_info`, `st_temp`, `g_st_error`). A variable the original did not send keeps its old value on the client and is not compared.
- **The walker.** A random client reads the original's screen (the client model follows `i_sent`, `st_object`, `b_kill_buttons`, overlays and plaque buttons) and picks something it offers; the same action goes to both sides. Any difference in draws ends a walk; a state difference, a screen one side cannot follow and a word difference are all recorded, and the oracle's tests require there to be none.

## 3. Results

`ORACLE_CUSTOMERS=10000 ORACLE_WALKS=40 pnpm --filter @fq/oracle run compare` (32-bit oracle). Re-run on the merged code (this branch with `master`'s restored generator, text filter default and untouched Classic pack), 2026-11-06, 158 s; the table is that run, and it is identical to the run before the merge:

| Family | What it drives | Walks | Steps | Identical |
|---|---|---|---|---|
| `create_random_customer` | every field, the labels, both generators' draws | 10,000 seeds | | 10,000 |
| salesman | one player waiting for customers: every negotiation button, events, risks, script events | 40 | 5,080 | all |
| town | three players, four days, every place, mail, cafe, midnight | 40 | 37,400 | all |
| rich town | four players with tags and strength: hearses, security, classes, Yang's, bank | 40 | 34,960 | all |
| rivals | players take turns, others offline: visits, padlocks, steals, battles | 40 | 32,320 | all |
| raiders | lockpicks against padlocks of several strengths, safes, smoke detectors, strong and weak fighters, eight visits a day | 40 | 42,390 | all |
| errands | Yang's (every dish, deliveries, thrown out), the library, name changes, the paper and announcements, letters | 40 | 16,140 | all |
| tournament | a two-day tournament past its end, the reset, the next game | 40 | 17,860 | all |
| crowd | five players, five short days: rankings, top sellers, deletion | 40 | 27,200 | all |

**213,350 steps in 320 walks: after every one, both generators had made the same number of draws, every player record and current customer was identical, no screen differed, and every text the player read had the same words** (markup, line-break encoding and spacing aside; the one exemption is D5). There are no transient reward-timing differences any more (there were 23 before D2 was put behind a flag).

Requests sent to the original on those steps, by path:

| Area | Requests |
|---|---|
| Customers | 9,334 Wait for Customer; 4,996 Soft Sell, 4,909 Hard Sell, 4,847 Sympathy, 4,833 Guilt, 4,845 Done (4,845 sales); 341 risks taken (240 won, 104 lost in the log), 344 declined; 908 random events; 188 arson script events, 359 news-blurb gift mails |
| Break-ins and battles | 2,976 Look; 6,489 visits at the door; 663 Try Door, 113 Pick Lock, 75 times inside, 244 steals, 287 Attack; in fights 161 attack rounds and 164 runs; 44 winner's and 71 loser's quotes; 70 hospital wake-ups; 1,232 Crime pages, 1,188 steps with crime reported |
| Yang's | 1,706 visits; 1,768 dragons, 1,684 sparrows, 1,840 tigers ordered; 651 sparrows and 666 tigers sent; 175 "Get Bitchy" (thrown out) |
| Spirit University | 1,136 psych, 1,073 strength, 1,125 PE; 1,320 library, 1,752 old papers, 1,804 Book of Deeds |
| Di-Mart and bank | 3,944 hearse screens, 1,495 purchases attempted; 938 supplies and 933 security screens; 2,190 bank visits, 323 exchanges |
| Desk, paper, mail | 26,755 desk visits; 1,789 paper, 1,286 yesterday, 1,271 front, 1,232 crime; 458 announcements (some with `[links]`); 1,759 rankings; 3,719 stats screens; 11,103 name searches, 1,020 letters and replies |
| Other | 575 cafe visits, 842 chat lines; 1,403 hospital, 485 church; 2,902 name-change screens, 1,429 names submitted (700 changes made) |
| Sessions and days | 1,080 new players, 3,400 log-ons, 1,480 midnights, 40 tournament ends with reset |

### 3.1 The default rules against the original

`ORACLE_RULES=default pnpm --filter @fq/oracle run compare` drives the port with `CLASSIC_RULES` (every fix on) and nothing else changed. The customer generator still matches for all 10,000 seeds, and the salesman family is identical in draws and records for all 40 walks. Everywhere else every difference traces to a fix in `docs/classic-rules.md` section 9:

| What the oracle reports | Count | Fix |
|---|---|---|
| Walk ends at a midnight: a player the original deletes is still active | 146 walks (18 of them with different draw counts at that midnight, from the town's size) | `fixes.zeroBpGracePeriod` |
| Walk ends at Di-Mart's "Buy it": turns, gold tags (and the hearse) differ | 44 walks | `fixes.hearseRebuy` |
| Walk ends at a dropped connection mid-fight: HP and BP differ; Crime lines ("assaulted ... in self defense", a quote-less line) where a fighter left mid-fight or at the quote prompt | 1 walk ended; 2 Crime pages | `fixes.battleDisconnect` |
| "Welcome back, X! You unlock the front door..." word differences at each new day | every walk | `fixes.newPlayerWelcome` (the welcome now shows) |
| Old Papers, Back, View Deeds and the library's words after a cancel | errands, town, tournament and others | `fixes.oldPapersCancel` |
| The gift mail's Continue ("You are sitting at your desk."), a reward a click earlier (transients), and the mail after it read one click earlier (log-on notices, phone calls, letters) | crowd, raiders, rich town, rivals, errands | `fixes.emptyMailStop` |
| Hearse screens and Elijah's refusal ("You already drive a Statesman...") | rich town, rivals | `fixes.hearseRebuy` |
| Visit, Look, Order and Continue screens one side could not follow | after one of the above in the same walk | follow-on of the fixes above |

123,794 of 134,518 compared steps agree in state and draws (a walk stops at its first state difference, so fewer steps are compared than in the original-rules run). The report keeps one example of each group of differences; every example was read, and each comes from one of the fixes (the groups are not checked instance by instance). This run is for information: the regression the tests enforce is the original-rules run.

Ratings and karma text: 10 different `ratings.txt` lines were reached through play (the line depends on rank place over town size, so a small town reaches only some of the 100). The karma lines are not reachable: karma never changes in play and the only reader, `get_karma_string`, is commented out (`command_script.cpp:342`).

## 4. Every difference found

Categories: **(a)** a bug in the port; **(b)** a deliberate, documented difference (`docs/classic-rules.md` section 9), now always behind a `fixes` flag that `originalClassicRules()` turns off; **(c)** presentation from the View translation (the bridge); **(d)** an artefact of the shim or of 64-bit or float differences.

| # | Difference | Category | Status |
|---|---|---|---|
| D1 | Closing "nobody by that name", cancelling the name box or closing the notepad at the desk's pen read the mail queue at once; the original sends no request there (welcome.swf buttons 496, 504, 451). | (a) | **Fixed** (first round) |
| D2 | A news blurb's gift mail starts with an empty Continue; the original showed "You are sitting at your desk." with only that Continue and applied the gift at the next click; the port read past it. | (b), now a flag | **`fixes.emptyMailStop`** (default on); off, the desk shows the original's Continue and the bridge draws it as the original did; section 9 row added |
| D3 | Notices carry the server's local time in front ("12:05 AM:Bob logged on."; `broadcast`, `broadcast.cpp:391-407`, `show_time`, `std_all.cpp:328-347`); the port dropped it. | (a) | **Fixed**: `classic/clock.ts`, host supplies `localTimeOffsetMinutes` (section 7 below) |
| D4 | Cancelling Old Papers: the original read `12ABORT12` as day 12. | (b), now a flag | **`fixes.oldPapersCancel`** (default on); off reproduces day 12 |
| D5 | `/?` in the cafe: the compiled source release answers "Unknown command". | not a port bug | Kept the help; exempted, see below |
| D6 | Yang's and script name searches used the player list as it was when the box opened (a rename meanwhile still matched the old name). | (c) | **Fixed** in the bridge (`pickerSearch` reads the live town) |
| D7 | The paper's fixed controls (front, crime, today, yesterday) when the engine's view did not offer that button: the bridge re-sent the old page, missing lines added since, or the crime page for "yesterday". | (c) | **Fixed** in the bridge (`newsCommand`: reaches the page in one or two presses, or turns away and back to refresh it, as the original re-read the file) |
| D8 | Cafe order: the newcomer's own "X saunters in." in the first screen instead of the next poll; a poll's own lines before the lines queued earlier; lines not polled before a desk visit kept; notices queued outside the cafe never shown in it. | (c) bridge, and (a) for the notices | **Fixed**: bridge keeps one queue in order and clears it at a desk visit (`command_main` drops chat packets); engine cafe polls now show and remove waiting notices (`add_que_messages_chat`, `broadcast.cpp:103-154`); the bridge sends every poll, even an empty one, to the engine |
| D9 | Letters: the bridge added "Reply to this letter?", escaped `>` as `&gt;`, and left out the desk text before the letter ("Welcome back, X. Unfinished business?"). | (c) | **Fixed** in the bridge (`letterText`; `>` is no longer escaped, as the original sent it) |
| D10 | Refresh variables the original did not resend, `st_view` text shown in `st_main`, `%25` on the wire, `<br>` against `\r\n`, label centring. | (c) | Not visible: a variable the original did not send keeps its value on the client; the rest is encoding. Not compared |
| D11 | Commands the original accepted out of turn (the server takes any command at any time); the port refuses what the screen does not offer. | design (engine guard) | The client cannot send them; the walker never does |
| D12 | **Found by the text audit:** the original refuses a log-on while another player is inside the parlor ("Someone is currently poking around your parlor...please log back on in a few minutes!", `funeral.cpp:357-363`, `get_player_who_locked_this_guy`, `misc_utils.cpp:279-301`); the port let the owner log on. | (a) | **Fixed**: `enterGame` refuses with `rejected` and `message`; the bridge shows the original's error box |

No difference of category (d) was found.

**D5, the evidence that "Unknown command" is a defect of the 2019 source release.** `process_chat_input` strips the "/" and calls `process_chat_command` (`commands_bar.cpp:366-374`), which takes the command word with `GetField(p_text, ' ', 0)` and compares it with `"?"` (`commands_bar.cpp:247-258`) before printing the help. `GetField` is in `FakeCStringEx.cpp:52-67` (the loop at line 64), the replacement the source release wrote when it removed StringEx (`legacy/README.md`, "Removed the dependency on StringEx"): its loop runs `while (iStart < s1->GetLength()-1)`, which for a one-character string ("?") never runs and returns "". So `/?`, and any one-character command, can only answer "Unknown command" in the source release, although the help branch exists, the cafe's own entry text says "Enter /? for help." (`commands_bar.cpp:338`) and the help lists the commands. The 2001 server was built with the real StringEx, which is not in the repository; the port follows the help. The oracle exempts exactly this: a chat step whose input is exactly `/?` has the original's "Unknown command.  Do /? for the list." and the port's help block removed before its words are compared; the rest of that poll must still match (`tools/oracle/src/run.ts`, `exemptHelp`). Nothing else is exempted.

## 5. Port bugs fixed, in player terms

- **D1, mail read too early at the desk's pen.** Before: cancelling a letter, mistyping the name or closing the pad applied queued rewards at once. After: they wait for the next desk visit, as in the original. Tests: `packages/core/test/oracleFidelity.test.ts`.
- **D2, the gift mail's empty Continue (now a flag).** With `originalClassicRules()`: the desk says "You are sitting at your desk." with one Continue, and the gift's BP and luck come with the next click, as in 2001. With the default rules the player is spared that click (unchanged from before). Tests: `oracleFidelity.test.ts`, `packages/legacy-compat/test/fidelity.test.ts`.
- **D3, the time on notices.** Before: "Bob logged on." After: "12:05 AM:Bob logged on.", the original's text, in the server's local time, at the desk, in the cafe and for `/yell`. Tests: `oracleFidelity.test.ts`, `cafe.test.ts`.
- **D4, Old Papers cancel (now a flag).** With `originalClassicRules()`: "You desperately hunt around for anything dealing with a day 12 but fail." (or day 12's paper). Test: `oracleFidelity.test.ts`.
- **D8, notices in the cafe.** Before: log-on notices waiting for a player were never shown in the cafe and appeared later at the desk. After: the next cafe poll shows them, oldest first, and the desk does not repeat them. Tests: `cafe.test.ts`, `legacy-compat/test/fidelity.test.ts`.
- **D12, log-on while your parlor is being visited.** Before: you could log on, and a visitor who had picked your lock could then be inside while you were online. After: "Someone is currently poking around your parlor...please log back on in a few minutes!" until the visitor leaves. Tests: `oracleFidelity.test.ts`, `legacy-compat/test/fidelity.test.ts`; `visit.test.ts` now reaches the recheck fix through a reconnect (`setPresence`), the only way left. The message is the text-table line `session.parlorLocked` (optional, so packs built before it load; the engine then uses the original wording). The packs have been regenerated and carry it; `@fq/content`'s original-content check treats it as an original line (it is in `CLASSIC_TEXT`, from `funeral.cpp:357-363`).
- **Bridge (D6-D9).** The unmodified Flash client now sees the original's paper, letters, cafe order and name searches; `packages/legacy-compat/test/fidelity.test.ts` and the oracle's word-for-word assertions cover them.

Evidence independent of the regression fixture: each fix has a test that fails with the old behaviour and passes with the new (checked by forcing the old path), and the oracle's tests (`tools/oracle/test/oracle.test.ts`) require identical draws, records, screens and words for every family. The fixture was re-recorded twice on this branch; full unhashed transcripts before and after each change were diffed: D1 changed two cases at a `mailbox:compose` close; D2-D4 and D8/D12 changed four cases only by the time in front of notices, and the original-rules case additionally from its first Old Papers cancel (now day 12).

**The merge with `master`.** Both sides had re-recorded `packages/core/test/fixtures/classic-transcripts.json`. Unhashed transcripts of the five cases were replayed from the same seeds and actions with the common base, `master`, this branch and the merged code (each side reproduced its own recorded hashes exactly), and every differing step classified:

- Merged against this branch's recording: 48 of 10,555 steps differ (17, 12, 7, 12 and 0 per case), and every difference is one relationship word, 50 in all (`daughter`, `mom` and `granddaughter` becoming `girlfriend`; `dad`, `son` and `grandson` becoming `boyfriend`): `master`'s restored generator. (`master` counted 44 steps and 46 words against the base; seed 1 has four more here because this branch's seed-1 walk takes a different path from step 701, D1, and meets other customers.)
- Merged against `master`'s recording: 77 steps differ only by the time in front of notices (7, 18, 15, 25 and 12 per case, D3); 3 steps are D1 (seed 1 step 699, seed 31337 steps 499 and the desk visit at 508 that now reads the mail); 1 is D4 (the original-rules case's Old Papers cancel at step 1,198, now day 12). Seed 1's walk and the original-rules walk then take other paths (from steps 701 and 1,199; 2,157 to 2,150 and 1,744 to 1,687 recorded steps). This is step for step the same classification as this branch's recording against the common base.

Nothing else differed, so the fixture was re-recorded for the merged code.

## 6. The static text audit

`tools/oracle/src/textAudit.ts` (test: `tools/oracle/test/textAudit.test.ts`, needs no compiler).

- **Original to port.** Every string literal of the compiled C++ (and of `commands.cpp`, `new_user.cpp` and the files `funeral.cpp` includes) and of `legacy/dist/script/**/*.c` that a player could read, adjacent literals joined and `\`-continued lines followed, split at `%s`/`%d` and `$var$`, must appear verbatim (spelling, punctuation, colour codes, inner spacing, typos) in the port's text: core's Classic code and tables, the legacy bridge, and the Classic pack; a number written into the original may be a rules value in the port (`{luck}`). Result: **819 of 901 literals found; the 82 others are each listed in `NOT_IN_PORT` with the reason**: answers to forged or out-of-turn requests the port refuses (`send_error_message`), dead code (`command_accept`, `command_no_business`, Opal's visit, `color_check`, `get_karma_string`, `swear_fix`), the licence server, the server's own web pages (`server.htm`, `rankings.htm`), the dropped one-player-per-IP rule, log and file names, HTML anchors the port draws as RichText links, and the log-on screen's server banner (see below). The audit found D12, now fixed.
- **Port to original.** Every line of `CLASSIC_TEXT` (which holds the social and places text) must come from the original's C++, scripts, content files or the client's own texts. **21 lines do not; each is listed in `ADDED_IN_PORT`**: labels the Flash client drew itself (the desk menu, the stats sheet, the pen), text that only the default-on `fixes.hearseRebuy` shows, the remaster client's Reply question (the bridge leaves it out), the "not built yet" stub, and two news lines composed from `"`^" + literal`. No original line was found altered.
- **Decided and done (owner's decision 3b, 2026-11-06):** the log-on screen's `st_intro_news` in museum mode now carries the original banner exactly as `funeral.cpp:191-193` builds it (eleven spaces, "FQServer 1.0." linked to rtsoft.com/fq, "Copyright 2001-2011:", "Robinson Technologies" linked to rtsoft.com, two spaces, "Uptime:" and `get_uptime`'s text such as "     2 Min" or "     3 Hour(s)", `maint.cpp:336-361`, from the host's boot time), followed by one added line, in white like the banner, saying the screen is served by the Funeral Quest Remastered engine and not by the original FQServer program. The banner is in `packages/legacy-compat/src/banner.ts`; `packages/legacy-compat/test/banner.test.ts` reads the format string out of `legacy/source/funeral.cpp` and compares the banner against it, and checks the uptime format and the reply. The text audit's `NOT_IN_PORT` entry for `funeral.cpp:191` (`tools/oracle/src/textAudit.ts`) is now out of date: the literal is in the port; remove that entry (the oracle is not part of this work). What follows is the earlier note, kept for the record: the log-on screen's `st_intro_news` in museum mode was the bridge's own line ("Funeral Quest Remastered (museum mode)...") instead of the original's "FQServer 1.0. Copyright 2001-2011: Robinson Technologies Uptime:..." (`funeral.cpp:191`). It names the server software; restoring it would claim the remaster is FQServer 1.0. Owner's decision.

## 7. What hosts pass for D3

`EngineContext.now` (ms since the epoch, already passed) and the new `EngineContext.localTimeOffsetMinutes`: the server's local time minus UTC, in minutes, for the moment `now` (for example `-300` in New York in winter, `-240` in summer, `60` in Paris in winter). The engine prints `h:mm AM` of `now + offset` (`classic/clock.ts`, exported as `showTime`). When absent it is 0 (UTC). The hosts:

- **apps/server** sets it on every engine call from the town's configured time zone (`utcOffsetMinutes(timeZone, now)`, `apps/server/src/game/schedule.ts`), recomputed for each call so daylight saving is followed; the Daily Challenge, whose day is the UTC date, passes 0. Museum mode uses the town's context, so the unmodified client shows these notices as the original server sent them, in the town's local time. Test: `apps/server/test/scheduler.test.ts`.
- **packages/solo** takes the page's IANA zone from the client (`WireHostOptions.timeZone`, `pageTimeZone()`; the worker has no window) and computes the offset per call the same way; without it, the save's `utcOffsetMinutes`, else the runtime's own zone. Test: `packages/solo/test/clock.test.ts`, directly and through the worker.
- **The legacy bridge's development host** (`packages/legacy-compat/src/devHost.ts`) uses the machine's zone, as the 2001 server did.
- The `broadcast` effect's text stays without the time (hosts that show their own time on tickers are unaffected); the queued notices and cafe lines carry it.

## 8. What could not be compiled, driven or compared

- **Not compiled:** the GUI, the HTTP server, the licence and master-server code, speech, the zip library, `CProtection.cpp` (constructor reproduced). None of them holds game rules.
- **Not driven:** the sysop's dialogs (Game Settings were set with `set`, player fields with `grant`); the kick timers (time-outs are `drop`); the IP checks (the rule is dropped); saving and reloading `.dat` files across a restart other than the tournament reset; the HTTP encoding of responses.
- **Not reachable by play:** the karma texts (above); ratings lines beyond the 10 a town of up to five players reaches.
- **Compared only for words:** colours, line-break encoding, spacing and centring of labels (D10).

## 9. Residual risks

- **32/64-bit.** The oracle is 32-bit; compile-time checks enforce `sizeof(long) == 4`, 32-bit `time_t`, 4-byte `in_addr` and 16-bit `wchar_t`. A 64-bit build (`ORACLE_ALLOW_64=1`) is not supported: `online_global::create_new` grows `p_on` with `realloc(p_on, sizeof(LONG)*n)`, too small for 64-bit pointers. `CRandom` would still be exact on 64-bit (its state words are masked to 32 bits when seeded, the twist only shifts right, and the tempering's left shifts are masked by 32-bit constants). Treat 64-bit runs as unverified.
- **Floating point.** `fq.vcxproj` sets no floating-point model or instruction set, so MSVC v142 builds with `/fp:precise` and `/arch:SSE2`: float expressions are evaluated in SSE registers at float precision. The oracle uses `-msse2 -mfpmath=sse -ffp-contract=off -O0`, the same IEEE single-precision operations. Residual: C library float formatting could differ from the Microsoft CRT in the last digit; no rule prints such a float to a player.
- **Shim fidelity.** `CString`, the `%s` handling and the date pictures are reimplementations (the first round's stub printed seconds in `show_time`; the picture-string implementation fixed it and the oracle now matches the port's restored prefix). Uninitialised memory follows glibc's layout; `-O0 -fwrapv -fno-strict-aliasing` keep code close to the source. The clock is UTC.
- **The client model.** Requests are reconstructed from the decompiled welcome.swf; a client behaviour not modelled would show as a refused step, not a silent difference (there are none in the final run).
- **The source release is not the 2001 binary.** D5 is one place where they differ; others of that kind would be invisible to the oracle.
