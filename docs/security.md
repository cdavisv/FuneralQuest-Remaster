# Security of the server

What the server defends, against whom, what was checked, what was fixed, and what is left. The server is `apps/server`; the code that answers each point is named, and the tests are in `apps/server/test/hardening.test.ts` unless another file is named. Status as of 2026-11-06; not a substitute for a professional review before a public launch.

## Threat model in a page

**What is worth protecting.** Players' accounts (a log-in name, a password hash, session tokens, parlors, blocks, reports they filed), the privacy of what moderators see (who reported whom), the fairness of the game (nobody acts as another player; the Daily Challenge's customers cannot be known in advance), and the host (the box, its disk, its CPU).

**Who attacks.**

1. *An anonymous visitor with a script.* Floods endpoints, makes thousands of accounts, opens thousands of sockets, sends oversize, slow or malformed requests, guesses passwords and the admin token, tries path traversal.
2. *A registered player (a guest is one click).* Everything above with a valid token, plus: acting as another player, reading another player's data, filling the database, making one town slow for everyone, reporting spam, abusing the cafe, mail and announcements.
3. *A web page the player visits.* Cross-site requests and WebSockets from a hostile origin.
4. *A malicious or curious moderator.* The admin token is one shared secret; what a holder can do is everything, and it is all written to the audit log with the name they gave.

**Not defended:** the operator's own host, the reverse proxy and TLS, a stolen admin token, a stolen database file (passwords are Argon2id hashes and tokens are stored as SHA-256 digests, but the Daily Challenge secret and all text players typed are in the file), and a determined attacker with many addresses (see the limits).

**Trust boundaries.** The network (everything is hostile and bounded: size, rate, time), the session token (the only thing that names a player; the body never does), the admin token (all of `/admin`), the operator's files (`FQ_PACKS_DIR`, `FQ_TOWNS_FILE`, `FQ_BLOCKLIST_FILE`, `FQ_MUSEUM_DIR` are trusted input read at start).

## What was checked

| Area | Result |
| --- | --- |
| Input bounds | Every body is a strict Zod object (unknown keys are errors), every string has a maximum, player-typed strings refuse control characters, body size is `FQ_BODY_LIMIT_BYTES` (16 KiB) whether or not a length is declared, URL parameters are at most 128 characters, headers at most 16 KiB. Tested with oversize, chunked, malformed, wrong-type, `__proto__` and `constructor` bodies. |
| Rate limits | Global per address, sign-up/log-in/guest per address, actions per account (an address when the token is bad), admin per address (failed guesses count). IPv6 addresses count as their subnet. Tested per endpoint class. |
| Other players' data | A bystander and a reported player fetch every authenticated and public read, and the data export; none contains the other player's login, email-like field, password hash, report note or block. Every authenticated route refuses without a token, every admin route without the admin token. |
| WebSocket | Hello within 5 s, 2 KiB frames, text only, strict message schema, token in the message (never the URL), origin check, handshake rate limit, per-address and per-parlor caps, message-rate cap, slow-reader drop (1 MB buffered). Tested with each. |
| Tokens | 256 random bits, only the SHA-256 digest is stored, 30-day expiry (`FQ_SESSION_TTL_DAYS`) that an hourly touch extends, revoked on logout, ban and account deletion (and an unban does not bring them back). Not accepted in a URL or cookie, never logged (pino redacts as a second guard). There is no password-change endpoint; when one is added it must call `AccountService.revokeAll`. |
| Passwords | Argon2id (19 MiB, 2 passes by default), a dummy verify for unknown names so timing does not reveal them, a per-name lockout after 10 failures in 15 minutes, per-address limit. |
| Admin page and token | `/admin/` is an empty shell: CSP `default-src 'none'; script-src 'nonce-...'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'`, a new nonce per response, no inline handlers, no cookie, `no-store`. Player text is placed with `textContent` only. The token is typed into the page and kept in the tab's `sessionStorage` (gone when the tab closes), sent as a Bearer header, compared in constant time on its SHA-256 digest. |
| SQL | Every statement is prepared with bound parameters. The few built with string pieces (`reports`, `audit_log`, `hall_of_fame` listings) join fixed column names chosen in code, never request text. |
| Static files, packs, museum | `@fastify/static` with a fixed file list; 16 traversal spellings (encoded dots, slashes, backslashes, double encoding, null bytes, dotfiles) against the client directory, and 11 against museum mode, serve nothing outside. Museum mode serves only `GET`. Content packs are chosen by name from a table built at start (`Object.hasOwn`, so `constructor` and `__proto__` are unknown packs); `FQ_PACKS_DIR` is operator input. |
| Daily Challenge secret | 256 random bits generated per database, kept in `server_secrets`, never in a response, an export or a log; the seed for a day is an HMAC of the date, so it differs between servers and cannot be computed ahead; future days are refused. |
| Expensive actions | Town creation, rules, rollback, new day and reset are admin-only. Export is limited like sign-in and is now index-backed. Leaderboards were reading every run's saved state for anyone who asked (fixed). No bot or simulator run is reachable from the server. A town's queue is serial, so one slow operation delays the rest (bounded, see below). |
| Compression | Only the client's own static files are compressed (brotli or gzip, once per ETag, kept in memory); no API, admin or museum response is, so a secret in a response cannot be guessed from its compressed size (BREACH). A test checks that `/api`, `/admin` and `/health` are never encoded. |
| Dependencies | `pnpm audit` (all and `--prod`): no known vulnerabilities. `@fastify/cors` has a patch release (11.4.1) with no advisory. |

## What was fixed

| Finding | Fix |
| --- | --- |
| The WebSocket origin check let any `Origin` in when `FQ_ALLOWED_ORIGINS` was empty, against the documented "same origin only". Harmless today (the token is in the message, not a cookie) but wrong. | Same-origin unless origins are listed. |
| No limit on sockets per address or per parlor, and none on message rate after the hello (a client could ping a thousand times a second). | `FQ_WS_PER_ADDRESS` 100, `FQ_WS_PER_PLAYER` 4 (the oldest is closed, so a reconnect works), 12 messages per 10 s, close code 4429. |
| Guests and sign-ups were only limited per minute, so one address could make hundreds of accounts an hour, each with its own action budget. | `FQ_RATE_SIGNUPS_PER_HOUR` per address (default three times `FQ_RATE_AUTH_MAX`). |
| Many addresses signing up at once queued unlimited Argon2 jobs (19 MiB each). | Four hash at once, 64 may wait, then 503 `busy` with `Retry-After`. |
| A town's queue was unbounded: a flood from many accounts queued thousands of 10 to 500 ms operations and every request timed out. | `FQ_MAX_QUEUED_PER_TOWN` (256), then 503 `busy`; the same for the Daily Challenge's queue. |
| Slow-header and slow-body connections were held for a minute or more; the timeout sweep ran every 30 s. | `FQ_REQUEST_TIMEOUT_SECONDS` (30) for the whole request, 10 s for headers, 5 s keep-alive, a sweep every 2 s. |
| An account could write one audit row per rejected action, 120 a minute, for ever (gigabytes a day from a free guest). | The first 20 a minute per player are logged, the rest counted in one `action:rejected:suppressed` row. |
| The data export, account erasure and the Daily Challenge's stale-run check scanned whole tables on the main thread (`node:sqlite` is synchronous). | Migration 5: indexes `audit_log(account_id, id)` and `challenge_runs(status, updated_at)`. |
| `GET /api/daily` and the leaderboard, unauthenticated, loaded every finished run including its 10 to 50 KB saved state and re-ranked on every request. | The board query selects eight columns; rankings are cached 5 s and dropped when a run finishes or an account is deleted. |
| `?includeInactive=false` on the admin player list was read as true (`z.coerce.boolean`). | A strict `true/false/1/0` parser. |
| The web client's page had no Content-Security-Policy. | One for the client shell: own scripts, styles (inline style attributes allowed), images, fonts and sounds; module worker and service worker from this origin; connections to this origin and the configured ones; no inline script, no `eval`, no framing, no plugins. `FQ_CLIENT_CSP=false` removes it. Checked in a browser: online and Solo play work under it. |
| Museum mode's cookie could not be marked Secure, and its log-on limit counted IPv6 addresses one by one. | `FQ_SECURE_COOKIES`; the limit uses the subnet. |
| Reporting a cafe line identified it by its text. | The report may carry the speaker's player id (`target.fromPlayerId`, from `ChatLine.from`); the server matches line and speaker, and an id that matches no buffered line attributes the report to nobody. |
| The admin page could take down only all of a player's text. | `GET /admin/towns/:t/stored-text` and `POST /admin/moderation/remove-item` take down one announcement, crime-page quote or queued letter (audited with moderator and reason), and the report page lists them item by item. |

## Known limits

- **Rate limits are in memory.** They reset when the process restarts and are not shared between processes: two server processes behind one proxy give each address twice the budget. One process is the supported deployment (SQLite is single-writer anyway).
- **No CAPTCHA, no e-mail or phone verification.** Account creation is limited per address and per hour; an attacker with many addresses (a botnet, a /64 rotation across /64s) can still make accounts. Guests are deleted after seven days unused.
- **TLS, HSTS and the real client address are the reverse proxy's job.** The server speaks plain HTTP. Behind a proxy `FQ_TRUST_PROXY` must be right: if it is not, every client shares the proxy's address (one shared rate-limit budget and one ban target); if it trusts a header it should not, a client can pick its own address. The proxy must keep the `Host` header (or `FQ_ALLOWED_ORIGINS` must list the web origin) or WebSockets are refused by the origin check.
- **The login lockout is per name.** Ten wrong passwords lock a name for 15 minutes for everyone, so an attacker can keep one chosen player out of the game (the cost of not locking per address). Sign-up reveals whether a name is taken.
- **The admin token is one shared secret.** There are no moderator accounts; `X-Moderator` is a name the caller gives and goes in the audit log unverified. Failed guesses count against the admin rate limit, not a lockout (a lockout by address would let a visitor lock out the operator behind a proxy). It is not written to disk by the server; the page keeps it in `sessionStorage`, which a cross-site-scripting bug in the page would expose (the CSP and `textContent` are what stand against that).
- **Museum mode's protocol uses `GET` for commands.** The original client's `request.xp?command=...` changes state on `GET` with a session cookie (`HttpOnly; SameSite=Lax`). A link a victim clicks can therefore send one command as them; `SameSite=Lax` stops it from images and scripts. Museum mode is off by default.
- **One town is one queue.** Every action serialises the whole town and writes its whole state. At 800 parlors with 5% online an action takes about 10 ms; with everyone online at once it takes 400 to 600 ms and the state is tens of MB (every log-on is mailed to every parlor online, which is the engine's rule). The queue cap turns overload into 503s instead of timeouts; it does not make the town faster. See `docs/performance.md`.
- **Players' text stays in the database file** (and in backups) in clear: parlors, announcements, letters in transit. The audit log holds what was typed except cafe talk, which is never stored; reports keep a short cafe window as evidence. Encryption at rest is the host's disk. The file also holds the Daily Challenge secret: restoring an old backup restores old seeds.
- **`/health` and `/api/towns` are public**: uptime, town names, rankings and who is online are visible to anyone, as in the original.
- **Operator files are trusted.** A content pack, towns file or blocklist is read at start and not sandboxed; do not point `FQ_PACKS_DIR` at a directory other people write to.
- **No penetration test, no fuzzing of the engine's action handlers** beyond the property tests in `@fq/core`; a hostile but valid action sequence is bounded by the engine's own rules and the rate limit, not analysed separately.

## Reporting a problem

Until a security contact is published, open a private issue with the repository's owner. A `SECURITY.md` with a contact address is part of the launch checklist (`docs/release/`).
