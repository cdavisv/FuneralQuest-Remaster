# User-generated content and moderation

Status: **DRAFT for the owner. This describes what the code does today**, from `apps/server` (README section "Player safety and moderation"), `apps/client/src/moderation/` and their tests. It was verified by the server and client test suites, by the Playwright specs (`apps/client/e2e/moderation.spec.ts`) and by looking at the screens in a browser at desktop and phone size. **Not verified:** a real phone, store review itself, the wording of the draft notice and rules (the owner and a lawyer decide it), and anything about the operator's own process. Nothing here is legal advice.

## What the game lets players write (verified)

| Surface | Who sees it | Where it lives | Notes |
| --- | --- | --- | --- |
| Display name and parlor name | Everyone in the town; rankings; Daily Challenge board; hall of fame | Town state; hall of fame (permanent) | Checked against the strict word list at creation; a moderator can force a rename |
| Cafe chat lines, `/me`, `/yell` | Players in the cafe (`/yell` goes to all online) | Pushed over WebSocket. **Not stored**: not in the audit log (it records that a line was typed and its length), not in the server log. Only a small in-memory window (see below) | Muted players are refused; blocked players' lines are not delivered |
| Letters to another player | The recipient | `player.mail` in town state until read; the audit log keeps the typed text for the retention period | Blocked senders' letters are not delivered; muted players are refused |
| Newspaper announcements | The whole town | Town news state for the season; the audit log keeps the typed text | Strict word list refuses them; a moderator can take them down (per player) |
| Battle quotes, Yang's fortunes | The opponent / the chosen player | Queued mail, crime page; the audit log keeps the typed text | Cursed Tiger fortunes are anonymous to players but not to the audit log |
| Parlor names of Expanded chains | The town | Expanded state | Strict word list applies |

Free-text limit is 2000 characters per submission (`submitText`), 500 per chat line.

## What the store policies require, and what meets it

| Requirement | Google Play (UGC policy) | Apple (guideline 1.2, 5.1.1(v)) | Met by |
| --- | --- | --- | --- |
| Terms that prohibit objectionable content and abusive users | Yes | Yes | `terms-of-service-DRAFT.md` (owner to finalise) and the in-game house rules shown before online play |
| A way to filter objectionable content | Yes | Yes | The engine's swear filter plus the strict word list (announcements, names), which the sysop supplies |
| In-app way to report content and users, with timely response | Yes | Yes | Report on cafe lines, letters, rankings rows, names, announcements; moderation page and API; **response time is the operator's process** |
| Ability to block abusive users | Yes | Yes | Block on the same places; a block follows the account |
| Published contact information | Yes | Yes | `FQ_CONTACT_EMAIL`, shown on the public deletion page and the in-game rules; **owner must set it** |
| Remove offending content and eject abusers | Yes | Yes (about 24 hours is the usual expectation) | Take down, rename, mute, kick, ban, address ban |
| Account deletion started in the app, plus a web link | Yes (Data safety URL) | Yes (5.1.1(v), in-app) | Settings, Delete my account; `GET /account/delete` is the public page |

## What exists

| Capability | Exists | Where | Limits |
| --- | --- | --- | --- |
| Strict word list | Yes | `FQ_BLOCKLIST_FILE`; announcements, chain names, names, parlor names, sign-up logins, moderator renames, museum names | Not shipped; the sysop supplies hashes or words. A list cannot catch what it does not hold |
| Report | Yes | `POST /api/reports`; client "Report" on cafe lines, rankings rows (name and parlor name), letters, the newspaper's announcements, mail messages (fortunes, quotes) | Seven categories, optional 500-character note; 10 per hour and 30 per day per account by default; a repeat within 24 hours is not stored again |
| What a report keeps | Yes | `reports` table | The reported text, who wrote it, where, when, whether the server could match it to its records, the reporter (moderators only), and for a cafe line up to 10 lines before and 5 after from a short in-memory window. See the server README |
| Block | Yes | `POST /api/blocks`; Settings lists blocks with Unblock | Never shields from visits or fights; public announcements stay in the paper; one way; per account across towns and seasons |
| Mute (chat, mail, announcements, fortunes) | Yes | Admin API and page; automatic mute | Enforced at the server before the engine; museum players get the original client's error line |
| Automatic mute | Yes | 3 distinct registered reporters in 60 minutes mutes for 24 hours, pending review | A group of registered accounts can silence someone for a day; a moderator reviews. Thresholds are settings |
| Moderator tools | Yes | `/admin/` (plain page) and the admin API | A moderator token is one shared secret; moderators identify themselves by name in a header |
| Take down content | Yes | Per player, not per message (engine granularity) | Cannot pick one announcement out of several; chat is not stored so cannot be taken down |
| Audit of moderation | Yes | `admin:*` rows with the moderator, reason, time, report | Retention follows `FQ_AUDIT_RETENTION_DAYS` (default 90); rows about an account survive its deletion |
| Self-service account deletion | Yes | Settings, Delete my account (`POST /api/me/delete`); password re-entry for registered accounts; guests confirm | Rollback snapshots are cleaned; off-server backups and other players' memories are not |
| Data export | Yes | Settings, Download my data (`GET /api/me/export`) | Other players' text and moderators' notes are left out |
| Public deletion page | Yes | `GET /account/delete` | Shows a marked blank until `FQ_CONTACT_EMAIL` is set |
| Age and conduct notice | Yes | Client, before online play (not Solo); also under Rules and Settings | Acceptance is stored in the browser or app only, not on the account; the minimum age is a marked blank |
| Sign-up and guest toggles | Yes | `FQ_SIGNUP_ENABLED`, `FQ_GUEST_ENABLED` | **Guests can still chat, write letters and report.** Consider turning guests off, or restricting them, for the online store build |
| IP and range bans, kick, ban | Yes | Admin API and page | Behind a proxy set `FQ_TRUST_PROXY` |

## The flows

**Reporting.** The player opens the small menu on a cafe line, a letter, a rankings row, an announcement, a name, or a received message, chooses Report, picks a category and optionally writes a note, and sends. The reported player is never told who reported them (nothing they can fetch contains it: tested). The player is then offered a Block button (or can block in the same request). The server works out who wrote the text from its own records: a cafe line from its in-memory window (only lines that player was sent), a letter, announcement, fortune or quote from the audit log's record of what players typed. If it cannot match the text it still stores the report, marked unverified, with nobody to act on.

**Moderating.** The operator opens `/admin/`, signs in with the admin token and a name, and works the queue: each report shows its text, the reporter, the cafe lines around it, the reported account's history and addresses, and buttons for dismiss, warn (a system letter that waits at the player's desk), take down, mute, rename, kick, ban, ban address and delete. Each needs a reason and a confirmation and is written to the audit log. The first action closes the report.

**Blocking.** A block applies in every town the two share and to every later parlor either makes. The engine's own block lists are rebuilt from the account-level list on load, reset, rollback and parlor creation, and again before any action if the list changed. The server also screens its own pushes, so a cafe line never reaches a blocker even if the engine's list lags.

**Deleting.** See the server README, "Account deletion, export and the public page", for exactly what is removed, anonymised and kept. In short: the account, sessions, blocks, mutes and Daily Challenge runs go; in each town the parlor is closed (the slot is deleted, as the engine does for an inactive parlor) and the player's letters, announcements, quotes and fortunes, and their names in the paper, other players' mail and stored screens, rollback snapshots and the hall of fame are removed or replaced by "A Closed Parlor"; closed reports about or by the account and the audit rows of what it typed go; kept are a note that the deletion happened, the moderation rows about the account, and open reports about it (with their evidence). Deleting is the right choice and not a renamed parlor: a kept "A Closed Parlor" would sit on the board with the departed player's points, be visitable and robbable with nobody to answer, and hold a rank no one could pass.

## Museum mode (the original client)

The original 2001 Flash client cannot show a report or block button or a form, so a museum player cannot file reports or block anyone from it (the same account can from the modern client). The server still applies blocks (they live in the engine's state), mutes and the strict word list to museum players at the one place it sees their requests. The old client can only show its own error line for a refusal, which also ends that log-on, and a note in the cafe transcript for a muted cafe line. If museum mode ships to a store, the Play and Apple UGC requirements apply to it as much as to anything else: the simplest answer is not to offer museum mode in the store builds (it is off by default, and the Play checklist already says it must not be reachable from the Android build).

## What the owner must decide

- [ ] **Contact and abuse address** `[ABUSE REPORT ADDRESS OR FORM - OWNER TO FILL IN]`: set `FQ_CONTACT_EMAIL`; it is shown on `/account/delete` and in the in-game rules.
- [ ] **Response target** `[RESPONSE TIME FOR REPORTS - OWNER TO FILL IN]`: Apple reviewers expect timely action on objectionable content (about 24 hours is the usual expectation). Someone must watch the queue.
- [ ] **Minimum age** `[MINIMUM AGE - OWNER TO FILL IN]` and the gate and rules wording (`apps/client/src/moderation/conduct.ts`, marked draft). Bump `CONDUCT_VERSION` when the text is final so everyone agrees again. Decide whether acceptance should also be stored on the account (today it is local to the device).
- [ ] **Thresholds:** reports per hour and day (10, 30), the automatic mute (3 reporters, 60 minutes, 24 hours), the cafe window (100 lines, 30 minutes).
- [ ] **Retention:** audit log (90 days), closed reports (180 days after closing), snapshots (48), backups, server logs. These must match the privacy policy.
- [ ] **The strict word list:** who writes it, where it is kept (not in the repository), who updates it.
- [ ] **Guests:** whether they may chat, write letters and report. Turning guests off removes the cheapest way to make throwaway abuse accounts.
- [ ] **Who moderates** and the runbook below; whether more than one person shares the admin token (they should not share a login name in the audit log).
- [ ] **Ship online in the store builds at all, or Solo-only first** (below).

## Moderation runbook (draft, for the owner to adapt)

1. Check the queue at least daily (more often at launch): `/admin/`, status open.
2. For each report read the text, the cafe lines around it (if a cafe line), the reporter's note and the reported account's history. Unverified reports have no author to act on: dismiss, or look in the audit log.
3. Act proportionately and always write the reason: dismiss; warn (a letter); take down their text (per player) and/or rename; mute for hours or days; kick; ban the account; ban an address range only when the same abuser keeps returning (ranges catch innocent neighbours). Reasons are in the audit log and may be read by anyone with the admin token; do not put the reporter's name in them.
4. **Evidence.** A report keeps its own copy of the text and cafe window, so a later takedown or deletion does not erase it. Closed reports are deleted after the retention period; export what you need to keep for a legal reason before then, and say why in the reason.
5. **Illegal content or a credible threat to someone's safety** (for example sexual content involving minors): do not just delete it. Preserve the report and the audit rows, ban the account, and follow the law and your lawyer's advice about reporting to the authorities. The tools above do not decide this for you.
6. Automatic mutes are held for review: open the account's page, read the reports, dismiss them (which lifts the mute when none is left open) or confirm with a real mute or ban.
7. Deletion requests that arrive by email: verify the account is theirs, then use `DELETE /admin/accounts/:id?reason=...` (or the delete button on the account page); answer within the policy's period.

## Minimum build list before mobile submission

- [x] Report button on cafe lines, letters, announcements, names (built, tested)
- [x] Block honoured by chat, `/yell`, mail, gifts and battle quotes, and persisted per account (built, tested)
- [x] A moderator way to see reports and act (the `/admin/` page and API)
- [x] Filter list: the strict word list mechanism exists; **the list itself is the sysop's to supply** (check `FQ_BLOCKLIST_FILE` is set on the deployed server). The filter applies only to text players write; the game's own original text is never filtered or altered (the original's `swear_words.yaml` is kept as data)
- [x] Terms and age statement before online play (draft notice; owner to finalise)
- [x] In-app "delete my account" plus a web page at `https://<host>/account/delete` (built; **`[ACCOUNT DELETION URL - OWNER TO FILL IN]` is that address once the server is public**)
- [ ] Published abuse contact `[ABUSE REPORT ADDRESS OR FORM - OWNER TO FILL IN]` and response target `[RESPONSE TIME FOR REPORTS - OWNER TO FILL IN]`
- [ ] Decide whether guests may chat and send mail
- [ ] A moderator who actually watches the queue

## Mitigation if the mobile apps must ship before the owner's decisions

Ship mobile as **Solo-only** (no accounts, no UGC, nothing transmitted). That sidesteps 1.2, the UGC policy and account deletion, and the privacy label becomes "Data Not Collected". The client already works offline in Solo. Store reviewers can see an online link inside the app, so hide the online option in that build rather than relying on the description (whether the mobile build can hide it is a question for `BUILDING.md`; **unverified**).
