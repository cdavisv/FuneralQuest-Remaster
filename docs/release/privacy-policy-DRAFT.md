> **DRAFT FOR THE OWNER AND A LAWYER TO REVIEW - NOT LEGAL ADVICE - NOT YET IN FORCE**
>
> Facts in this draft were taken from the server code (`apps/server`) and the client (`apps/client`) on 2026-11-06, after the report, block, mute, deletion and export features were built. Where the code could not settle a point the text says so in `[brackets]`. Replace every `[... - OWNER TO FILL IN]` and delete the drafting notes (lines starting "Drafting note") before publishing.

# Privacy Policy for FuneralQuest Remastered

Effective date: `[EFFECTIVE DATE - OWNER TO FILL IN]`

## 1. Who we are

The official online service for `[FINAL GAME TITLE - OWNER TO FILL IN]` (the "Service") is run by `[OPERATOR NAME - OWNER TO FILL IN]`, `[OPERATOR POSTAL ADDRESS - OWNER TO FILL IN]` ("we"). We are the controller of personal data processed by the Service. Contact: `[CONTACT EMAIL - OWNER TO FILL IN]`. `[DATA PROTECTION CONTACT / EU-UK REPRESENTATIVE IF REQUIRED - OWNER TO FILL IN]`

The game's source code is open source and anyone can run their own server. **This policy covers only the official server at `[OFFICIAL SERVER URL - OWNER TO FILL IN]`.** If you play on a server run by someone else, that operator's policy applies, not ours.

## 2. Solo mode: nothing leaves your device

If you choose **Play solo**, your career, settings and save slots are stored on your own device (in your browser or app storage). Solo mode does not need an account and does not send any of this to us. Clearing your browser or app data deletes it; export a save file if you want a copy. Offline use of the installed app is the same.

## 3. Online play: what we collect and why

| Data | Why | Notes |
| --- | --- | --- |
| **Login name** you choose (or a random `guest-xxxxxxxx` name for guest accounts) | To run your account | |
| **Password** | To log you in | Stored only as an Argon2id hash. We cannot read it. Guest accounts have no password and can use no free text (they cannot chat, write letters or post announcements) |
| **Session token** | To keep you logged in | Stored on our server only as a SHA-256 hash; stored on your device in local storage; valid for 30 days of inactivity or until you log out |
| **IP address** | Security, abuse prevention and banning | Saved with your login session (removed when the session ends or expires), saved with administrator actions, and used in memory for rate limits. `[Request logs may also contain addresses - UNVERIFIED, confirm on the live server]` |
| **Display name and parlor name** (and the gender option you choose) | Gameplay; shown to other players | Public inside the game, in rankings, leaderboards and the hall of fame. Do not use your real name |
| **Game progress** (money, points, inventory, visits, rankings) | Gameplay | |
| **Things you write**: cafe chat, in-game mail, newspaper announcements, battle quotes, Yang's fortunes | Gameplay and moderation | Shown to the people they are meant for (the cafe, the recipient, the whole town). In-game mail is kept until read. **Cafe chat is not stored**: it is delivered and forgotten, except for the short in-memory window described below. A copy of what you type in mail, announcements, quotes and fortunes is also kept in our audit log (below) |
| **Cafe window (memory only)** | Letting a report show the lines around a reported one | The last `[100]` cafe lines of each town, no older than `[30]` minutes, kept in the server's memory with who caused each one and who was sent it. Never written to disk unless a player reports a line, in which case the report keeps the lines around it as seen by the reporter. Lost when the server restarts |
| **Block list** | Letting you stop another player's letters, cafe lines and gifts reaching you | Which accounts you blocked; follows your account; removed when either account is deleted. Not shown to the blocked player |
| **Reports**: ones you file, and ones filed about you | Moderation (keeping the game safe) | A report keeps: the reported text, who wrote it, where and when it was seen, the reporter's account (visible to moderators only, never to the reported player), the category and optional note, and for a cafe line the surrounding lines. Reports are looked at by moderators and then closed |
| **Moderation records**: mutes, warnings, takedowns, renames, kicks, bans, with the moderator, reason and time | Moderation, appeals, accountability | In the audit log. Rows about an account survive its deletion for the audit log's retention period |
| **Account events**: creation and last login time, ban status and reason | Account management, moderation | |
| **Daily Challenge runs** | Leaderboard | Name, parlor, score, public |
| **Hall of fame owner record** | So a deleted account's name can be taken out of the hall of fame | Which account held which name in each finished season; never shown to anyone |
| **Days played** | Seeing whether players come back (our own statistics: how many play each day, and how many return a day, a week or a month after they started) | For each day (UTC) on which your account played in a town: your account, the town and the date. Nothing else: no address, no time of day, nothing you wrote. Used only to count, on our own server; never sent to anyone else |
| **Audit log** | Security, bug investigation, moderation | A record of actions taken in the game (and administrator actions), tied to your account, including the text you submit in mail, announcements, battle quotes and fortunes (not cafe chat) |

We do **not** ask for or store your real name, email address, phone number, date of birth, location, contacts, photos, payment details or advertising identifiers. The game has no ads, no in-app purchases and no third-party analytics or tracking tools in its code; the only statistics are the "days played" counts above, computed on our server. `[Confirm this for each store build in BUILDING.md]`

Drafting note: the engine has an email field, but the server fills it with "none" and the web client does not ask for one. If a mail-based password reset or newsletter is ever added, update this policy first.

## 4. How long we keep it

| Data | Retention |
| --- | --- |
| Account (login name, password hash, times) | Until the account is deleted. Unused guest accounts with no parlor are removed automatically after 7 days |
| Session and its IP address | Until you log out or the session expires (30 days after last use) |
| Game state, mail, announcements | While the account exists. Seasons can reset a town and clear its game data |
| Rollback snapshots of a town (contain names, mail and progress) | Up to 48 hourly snapshots per town, then replaced; so about two days of history. `[OWNER TO CONFIRM: settings may differ]`. When you delete your account your name and text are cleaned out of the snapshots too |
| Audit log (including text you submit, other than cafe chat) | `[AUDIT LOG RETENTION DAYS - OWNER TO FILL IN]` days; the default is 90 days. When you delete your account the rows that hold what you typed are deleted at once |
| Days played | `[400]` days (`FQ_ACTIVITY_RETENTION_DAYS`), or until the account is deleted. `[OWNER TO CONFIRM]` |
| Hall of fame (season winner's name, parlor and score) | Kept permanently as a record of the game; contact us to ask for removal |
| Backups | `[BACKUP PROVIDER AND RETENTION - OWNER TO FILL IN]` |
| Server logs | `[OWNER TO FILL IN]` |
| Reports | Open until a moderator closes them; closed reports are deleted `[180]` days after they were closed (`FQ_REPORT_RETENTION_DAYS`). `[OWNER TO CONFIRM]` |
| Cafe window | At most `[100]` lines per town and `[30]` minutes, in memory only |
| Block list | Until you unblock or either account is deleted |
| Moderation records | In the audit log: `[AUDIT LOG RETENTION DAYS - OWNER TO FILL IN]` days |

## 5. Who can see it

- **Other players** see your display name, parlor name, rankings and anything you say to them or publish.
- **Our moderators/administrators** can see accounts, game state, your mail, the audit log, reports (including who filed them) and ban records, to run and protect the Service. Moderators identify themselves by name in the audit log.
- **Service providers** that host the server and store backups: `[SERVER HOST / HOSTING PROVIDER - OWNER TO FILL IN]`, `[BACKUP PROVIDER AND RETENTION - OWNER TO FILL IN]`. They act on our instructions.
- We do not sell personal data and do not share it for advertising. We may disclose data where the law requires or to protect the safety of others.

## 6. Legal bases (EU/UK GDPR)

Performance of a contract (running your account and the game); our legitimate interests (security, abuse prevention, moderation and fixing bugs); consent where we ask for it; legal obligation where applicable. `[Lawyer to confirm bases per purpose]`

## 7. International transfers

The server is hosted in `[HOSTING COUNTRY/REGION - OWNER TO FILL IN]`. If you are in the UK or EEA and your data is transferred elsewhere, we rely on `[ADEQUACY DECISION / STANDARD CONTRACTUAL CLAUSES / OTHER - OWNER TO FILL IN]`.

## 8. Your rights

Depending on where you live (UK/EU GDPR, California CCPA/CPRA and similar laws) you can ask us to: tell you what we hold (access), correct it, **delete your account and data**, restrict or object to processing, and receive a copy (portability). You may also complain to your data protection authority `[SUPERVISORY AUTHORITY - OWNER TO FILL IN]`. We do not sell or share personal information for cross-context advertising and do not discriminate for exercising your rights.

**How to delete your account:** in the game, open Settings and choose Delete account (you are asked for your password again; guests confirm only). You can first download everything we hold about you from the same place (Download my data). If you cannot log in, use `[ACCOUNT DELETION URL - OWNER TO FILL IN]` (the page `/account/delete` of the server explains how) or email `[CONTACT EMAIL - OWNER TO FILL IN]` from the address you want us to reply to. We aim to respond within `[30]` days.

**What deletion removes:** your account, log-in sessions, block list, mutes, Daily Challenge entries and the record of which days you played; your parlor in every town (it is closed, as the game closes an inactive parlor); the letters, announcements, battle quotes and fortunes of yours that are still waiting or printed; your name and parlor name in the newspaper, other players' waiting mail, other players' stored screens, rollback snapshots and the hall of fame (where "A Closed Parlor" replaces them); reports you filed that were already settled and settled reports about you; the audit rows that hold what you typed; and your lines from the in-memory cafe window.

**What deletion does not remove, and why:** a note that the account was deleted; the audit rows of moderation about the account (for example a ban), kept for the audit log's retention period so a ban is not erased by leaving; **reports about you that no moderator has yet looked at**, with their evidence (the reported text, the names you used and the cafe lines around it), kept so that abuse is not erased by leaving, and deleted once closed and past retention; reports you filed that are still open keep their evidence but no longer name you; copies in our server backups until they rotate out (`[BACKUP PROVIDER AND RETENTION - OWNER TO FILL IN]`); other players' audit rows that happen to mention your name until the audit log's retention passes; and anything other players already read or saw, which stays with them.

**Your data on request:** Download my data (Settings) returns, as JSON, your account, log-in sessions (times and addresses), the player record of each of your parlors, the names of players you blocked, the reports you filed (kind, category and your note), how many reports have been filed about you (not by whom), your mutes, your Daily Challenge entries, the days on which you played in each town, the hall-of-fame names you hold and a list of what you typed or did. It leaves out other players' text (letters to you), the content of reports, and moderators' internal notes. Ask us at the contact address for anything not covered.

## 9. Children

The game is rated for adults (18+) and online play is for people aged 18 or older (owner's decision 8, 2026-11-06). That is a rating and a self-declaration, **not age verification**: the first time someone starts online play, the game shows its rating and the house rules and asks them to tick "I am 18 or older and accept these rules". We do not ask for, check or store a date of birth, an identity document or an age, and nothing about age is sent to or kept on our server. The tick is remembered on the player's own device only (`localStorage`), so it is asked again on a new device or after the site data is cleared. Solo play, which needs no account and no server, has no such notice.

The Service is not directed to children. We do not knowingly collect data from anyone under 18; if we learn we have, we will delete the account.

## 10. Security

Passwords are hashed with Argon2id; session tokens are stored only as hashes; the connection should be HTTPS/WSS. No system is perfectly secure. The database is stored on `[SERVER HOST / HOSTING PROVIDER - OWNER TO FILL IN]` disks; encryption at rest is `[OWNER TO CONFIRM]`.

## 11. Cookies and local storage

We set no cookies. The web app stores a session token and your last town in local storage, your settings in browser storage, a note that you accepted the house rules (and which version), and (for the installed app) a service worker cache of the game's files. These are needed to run the game.

## 12. Third-party links

The credits page links to external sites (the original game's site and source). Their privacy practices are their own.

## 13. Changes

We will post changes here and change the effective date. For material changes we will give notice in the game `[OWNER TO FILL IN how]`.

## 14. Contact

`[OPERATOR NAME - OWNER TO FILL IN]`, `[OPERATOR POSTAL ADDRESS - OWNER TO FILL IN]`, `[CONTACT EMAIL - OWNER TO FILL IN]`. Jurisdiction: `[JURISDICTION / GOVERNING LAW - OWNER TO FILL IN]`.
