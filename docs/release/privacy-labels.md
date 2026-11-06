# Privacy labels and data-safety answers

Basis: reading `apps/server/src` (schema in `db/database.ts`, accounts in `auth/accounts.ts`, routes, admin API, logger, `moderation/`), `apps/client/README.md` and `packages/solo/src/storage.ts`. The report, block, mute, deletion and export features are built and are included below. Items I could not confirm are marked **unverified**. Re-check after any server change.

## What the server stores (verified)

| Data | Where | Notes |
| --- | --- | --- |
| Login name | `accounts.login` | Chosen by the player, 3 to 20 chars. Guests get `guest-<8 hex>`. |
| Password | `accounts.password_hash` | Argon2id hash only. Guests have none. Passwords are not logged (pino redaction, bodies never logged). |
| Account created / last login times, banned flag, ban reason | `accounts` | |
| Session token | `sessions.token_hash` | SHA-256 digest only; token itself is held by the client in `localStorage` (`fq.token.v1`). 30-day sliding expiry (`FQ_SESSION_TTL_DAYS`), expired rows purged hourly, deleted on log-out. |
| **IP address at sign-in** | `sessions.ip` | Written when a session starts (sign-up, log-in, guest). Removed with the session. |
| IP bans | `ip_bans.prefix` | Only what an operator types in. |
| Display name, parlor name, gender flag | Town `state_json`, `parlors` | Public to other players. The engine's `email` field is filled with the literal `"none"` unless a client sends one; the web client does not (the only sender found is a development helper). |
| Game progress (money, Bury Points, inventory, rank, visits) | Town `state_json`, `town_snapshots` | Snapshots hourly if changed, 48 kept per town by default. |
| Mail between players | `player.mail` inside town state | Until read/cleared; also in snapshots. |
| Newspaper announcements | Town news state | Public to the town. |
| Block list | `account_blocks` | Which account blocked which, with the name shown when it was made. Removed when either account is deleted. |
| **Reports** | `reports` | The reported text, its author (account, login, names at the time), where and when, the **reporter's account (moderators only)**, category, note, and for a cafe line the surrounding lines. Open until a moderator closes them; closed ones deleted after `FQ_REPORT_RETENTION_DAYS` (180). An account's deletion deletes the settled ones it filed or was the subject of and keeps open reports about it. |
| Mutes | `mutes` | Scope, times, reason, moderator, automatic or not. Removed with the account. |
| **Cafe window** | **Server memory only** | Up to `FQ_CHAT_BUFFER_LINES` (100) recent lines per town, at most `FQ_CHAT_BUFFER_MINUTES` (30) old, with who caused each and who was sent it. Never written to disk unless a report captures part of it; lost on restart. |
| Hall of fame | `hall_of_fame`, `hall_owners` | Winner name, parlor, BP, town, season, standings. Permanent; not pruned. `hall_owners` privately records which account held which name, so account deletion can replace the name with "A Closed Parlor". |
| Daily challenge runs | `challenge_runs` | Account id, display name, parlor, score, game state; public leaderboard. Cascade-deleted with the account. |
| **Audit log** | `audit_log` | Append-only. Every accepted action is stored as `data: { action }` with account id and player id. For text actions this includes the **text typed**: mail bodies, announcements, battle quotes and fortunes (up to 2000 chars). **Cafe chat is not stored**: a chat action is recorded as its length only, and its text is kept out of the effect rows and the server log. Mail is also logged as "X wrote email to Y: body". Also: sign-up (login name), rejected actions, joins/leaves, reports filed (kind and category, not the text), blocks, and moderation actions with the moderator, reason and the **admin's IP**. Pruned after `FQ_AUDIT_RETENTION_DAYS` (default 90; 0 = forever), 50,000 rows per hourly pass. **An account's deletion deletes the rows that hold what it typed** and keeps the moderation rows about it and a deletion note. |
| Process logs | stdout, JSON | Request bodies and auth headers never logged. The admin-auth-failure line logs IP and URL. Whether Fastify's per-request log lines include the client address depends on serializers: **unverified, check a live log line**. Retention is whatever the host/log shipper does: `[OWNER TO FILL IN]`. |
| In memory only | rate-limit counters (by IP/account), login-failure counters (by login name) | Lost on restart. |

Not stored/not present (verified by absence): email address collection, phone, real name, date of birth, precise or coarse location, device identifiers, advertising IDs, contacts, photos, payment data, analytics SDKs, third-party scripts (client README: no third-party scripts; no ads or purchases found in the repo). Cafe chat has no history table and is not in the audit log; only the short in-memory window above holds it, and a report copies from that.

The age and conduct notice's acceptance is stored in the browser or app (`localStorage`, key `fq.conduct`), not on the server.

Data export: `GET /api/me/export` (Settings, Download my data) returns the account, sessions, parlors, blocks (names), reports filed, the count of reports about the account, mutes, Daily Challenge runs, hall-of-fame names and the account's activity. Account deletion: `POST /api/me/delete` (Settings, Delete my account), and the public page `GET /account/delete`.

Solo mode: careers, settings and save slots live in the device's IndexedDB (`packages/solo/src/storage.ts`) and `localStorage` (settings). Nothing is transmitted. Save files can be exported by the player.

Third parties: the repo contains no analytics, ad, crash-reporting or payment SDK (checked `package.json` of client/server). Hosting provider and any backup provider process the data: `[SERVER HOST / HOSTING PROVIDER - OWNER TO FILL IN]`, `[BACKUP PROVIDER AND RETENTION - OWNER TO FILL IN]`. Store builds (Tauri, Capacitor) are not part of this check: confirm with `BUILDING.md` that no plugin adds telemetry.

## Table: online play (official server)

| Data type | Collected? | Linked to user? | Used for tracking? | Purpose | Retention |
| --- | --- | --- | --- | --- | --- |
| Account name / user ID | Yes | Yes | No | Account, gameplay | Until account deleted |
| Password (hash) | Yes | Yes | No | Authentication | Until account deleted |
| Email address | No (field filled with "none") | n/a | No | n/a | n/a |
| Name | No real names; a display name is chosen | Yes | No | Gameplay, shown to others | Until deletion; hall of fame permanent; snapshots/backups lag |
| IP address | Yes (session start; admin actions; possibly request logs: unverified) | Yes (session row is tied to account) | No | Security, abuse prevention, bans | Session life (<= 30 days after last use); logs `[OWNER TO FILL IN]` |
| Other user content: mail, announcements, battle quotes, fortunes, display and parlor names; cafe chat (memory only) | Yes | Yes | No | Gameplay features, moderation | Mail until read/cleared; announcements until season reset; audit copy of typed text except chat `[AUDIT LOG RETENTION DAYS - OWNER TO FILL IN]` (default 90 days); cafe chat at most 30 minutes in memory unless reported |
| Reports and block lists | Yes | Yes (reporter and blocker are known to moderators; the reported player is never told) | No | Moderation, safety | Open reports until closed, closed reports 180 days (default); blocks until unblocked or account deleted |
| Gameplay content / progress | Yes | Yes | No | App functionality | Until deleted; snapshots (48 hourly states) and backups |
| Purchases | No | n/a | No | n/a | n/a |
| Location | No | n/a | No | n/a | n/a |
| Contacts, photos, health, financial info | No | n/a | No | n/a | n/a |
| Diagnostics (crash/performance) | No SDK found | n/a | No | n/a | n/a |
| Device ID / advertising ID | No | n/a | No | n/a | n/a |
| Usage data (product interaction) | Only as actions in the audit log | Yes | No | Moderation, bug investigation | As audit log |

Data is encrypted in transit only if the operator puts TLS in front (required; the server itself speaks HTTP). Encryption at rest of the SQLite file: **not provided by the app**; depends on the host disk.

## App Store "App Privacy" (online-capable build)

Answer "Yes, we collect data from this app", then declare:

| Apple category | Data type | Linked to you | Tracking | Purposes |
| --- | --- | --- | --- | --- |
| Identifiers | User ID (login name) | Yes | No | App Functionality |
| User Content | Other User Content (chat, mail, announcements, names) | Yes | No | App Functionality |
| User Content | Gameplay Content (progress) | Yes | No | App Functionality |
| Contact Info | Name (display name is not a real name; declare conservatively if reviewers ask) | Yes | No | App Functionality |
| Usage Data | Product Interaction (actions in audit log) | Yes | No | App Functionality |
| User Content | Reports and blocks are also user-created content ("Other User Content"; reports are used for moderation, which Apple counts under App Functionality) | Yes | No | App Functionality |
| Identifiers / Other Data | IP address: Apple has no IP category; it is covered under "Other Data Types" if declared | Yes | No | App Functionality, security |

No "Data Used to Track You". Provide the privacy policy URL `[PRIVACY POLICY URL - OWNER TO FILL IN]`. **Solo-only build:** "Data Not Collected".

## Google Play "Data safety" (online-capable build)

| Section | Answer |
| --- | --- |
| Does the app collect or share user data? | Collects: yes. Shares: no (hosting/backup providers acting as processors are not "sharing" under Google's definition; confirm with a lawyer) |
| Is all data encrypted in transit? | Yes, provided the official server is HTTPS/WSS only |
| Can users request data deletion? | Yes: in the app (Settings, Delete my account) and on the web (`https://<host>/account/delete`, built). Enter `[ACCOUNT DELETION URL - OWNER TO FILL IN]` as that address once the server is public. In "data deletion practices" say what remains: a note of the deletion, moderation records about the account, open reports about it, server backups until they rotate, and other players' memory of what they read |
| Personal info > User IDs | Collected, not shared, required (accounts), purposes: App functionality, Account management |
| App activity > Other user-generated content | Collected, not shared, required for online play, purposes: App functionality |
| App activity > In-app interactions (actions) | Collected, not shared; App functionality; optional to describe as covered by UGC |
| Device or other IDs / IP | Google lists "Device or other IDs"; an IP is not a device ID, but declare IP under any applicable field if the policy form asks. Purpose: Fraud prevention, security and compliance |
| Location, contacts, photos, financial, health, messages (SMS/email), audio, files | Not collected |
| Messages > "Other in-app messages" | In-game mail and chat are in-app messages: declare collected, not shared, App functionality |
| Security practices | Passwords hashed; HTTPS; deletion mechanism (built); data export (built); "Committed to follow the Families Policy": **no**, the game is not for children |

**Solo-only build:** "No data collected", but still publish a privacy policy.

## Steam

Steamworks asks for a privacy policy URL only where the game collects data (treat as required for online play: **unverified**). Content: reuse the policy draft. Steam's own questions are about content and AI, not data types. State the in-game online features on the store page ("Online multiplayer with accounts and chat; offline Solo available").

## itch.io

No data-type form. Link the privacy policy on the page if the browser build can connect to the official server. The embedded HTML5 build runs at an itch.io origin: the server must allow it in `FQ_ALLOWED_ORIGINS` (unverified whether the build is intended to connect online from itch).

## Before relying on any of this

- [ ] Confirm what request logs contain on the deployed server (IP present or not) and set log retention
- [x] Cafe chat is no longer stored in the audit log or the server log (done); mail, announcements, battle quotes and fortunes still are, for moderation and author lookup (the drafts disclose it). Decide whether to keep that
- [x] Account deletion and data export exist (built); check the final wording of "what remains" against the privacy policy
- [ ] Confirm backups: provider, location, retention, and how deletions propagate
- [ ] Re-check labels after any further server change (the report, block and deletion features are included above)
