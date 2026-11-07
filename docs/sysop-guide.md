# Running a private town for friends

This is the how-to for hosting Funeral Quest Remastered for a group of friends: install it, set it up, make a town, invite people, look after it day to day, back it up, put a backup back, and update it. Every setting and every admin route is described in the reference, the [server README](../apps/server/README.md); this page tells you which ones you need and when.

You need a machine that stays on (a small VPS, a home server, a Raspberry Pi 4 or better), and either Docker or Node.js 24 or newer. A town of ten friends uses a few tens of megabytes of memory and a database of a few megabytes per season.

## 1. Install

### With Docker (simplest)

```sh
git clone https://github.com/cdavisv/FuneralQuest-Remaster.git
cd FuneralQuest-Remaster
cp apps/server/.env.example apps/server/.env
# edit apps/server/.env: set FQ_ADMIN_TOKEN (openssl rand -hex 32) and FQ_BACKUP_INTERVAL_HOURS=24
docker compose up -d --build
curl localhost:8080/health          # {"status":"ok","version":"0.1.0-alpha.1",...}
```

Open `http://<your machine>:8080`. Everything the server keeps lives in the Docker volume `fq-data` (mounted at `/data` in the container). The project has not yet built and run the Docker image itself (see `docs/TODO.md`); if it misbehaves, the Node.js route below is the tested one.

### With Node.js

```sh
git clone https://github.com/cdavisv/FuneralQuest-Remaster.git
cd FuneralQuest-Remaster
corepack enable && pnpm install
pnpm --filter @fq/client build                      # the web client, into apps/client/dist-build
pnpm --filter @fq/server build                      # the server, into apps/server/dist/server.mjs
cd apps/server
cp .env.example .env                                # set FQ_ADMIN_TOKEN and the rest (below)
FQ_CLIENT_DIR=../client/dist-build node --env-file=.env dist/server.mjs
```

Run it under systemd, pm2 or similar so it starts at boot and restarts if it stops. Give it `SIGTERM` to stop it (systemd does); it finishes what it is doing, saves and exits.

### Put it on the internet

Put a reverse proxy with HTTPS in front (Caddy is the least work: `fq.example.com { reverse_proxy 127.0.0.1:8080 }`), forward `/` including WebSocket upgrades, and set `FQ_TRUST_PROXY=1` so bans and rate limits see your friends' real addresses. Without HTTPS, passwords cross the network in clear text.

## 2. Configure

Settings are environment variables in `apps/server/.env`; `.env.example` explains each one. For a town of friends, these are the ones that matter:

| Setting | Why |
| --- | --- |
| `FQ_ADMIN_TOKEN` | Turns on the admin page and API. 24 characters or more (`openssl rand -hex 32`). Keep it secret: it can do everything. |
| `FQ_BACKUP_INTERVAL_HOURS=24` | A backup every day, kept in `FQ_BACKUP_DIR` (default: `backups/` next to the database). `FQ_BACKUP_KEEP` (14) says how many. |
| `FQ_DEFAULT_TOWNS` or `FQ_CREATE_DEFAULT_TOWN=false` | A fresh server makes an Expanded town and a Classic one. Set `classic` or `expanded` for one of them, or `false` to make your own (next section). |
| `FQ_SIGNUP_ENABLED`, `FQ_GUEST_ENABLED` | Turn off sign-up once everyone has an account, and guests if you do not want strangers. |
| `FQ_CONTACT_EMAIL` | Shown on the account deletion page. |
| `FQ_TRUST_PROXY` | The number of proxies in front (1 behind Caddy or nginx). |

Changes to `.env` need a restart (`docker compose up -d`, or restart the service).

## 3. Create a town

Open `https://<your server>/admin/` and sign in with the admin token (it stays in that browser tab only). Then **Towns**, **New town**: an id (letters, digits and dashes, used in links), a name, the ruleset, your time zone (days start at midnight there) and, for a tournament, its length in days. Classic is the 2001 game; Expanded is the grown-up one with 30-day seasons.

- **Manage** on a town opens its Game Settings (turns per day, starting money, tournament length, the odds, maximum players and so on, next to their defaults), its players, its snapshots and the reset button.
- Settings apply at once and are written to the audit log. Changing turns per day takes effect at each player's next new day.
- A Classic tournament of N days is played on days 1 to N; the midnight after day N names the winner in the paper and the Book of Deeds, day N+1 is the closing day (no turns, visits only), and the midnight after it starts the town again at day 1. The season goes into the hall of fame, and the Book of Deeds is kept.

You can also create towns from a file (`FQ_TOWNS_FILE`, see `towns.example.json`) or with `POST /admin/towns`.

## 4. Invite players

Send your friends the address. Each makes an account (New user: a log-in name and a password) and then a parlor in your town. A guest (one click, no password) can play too but cannot write chat, letters or announcements, and loses the parlor if they lose the browser's storage; they can turn the guest into a full account from Settings without losing anything. If you turned sign-up off, turn it on while people join.

## 5. Day to day

There is nothing you have to do: midnight runs by itself in the town's time zone, and if the server was off at midnight the missed days run when it starts. What you may want:

- **Broadcast** (Towns): a message to everyone online.
- **Run a new day** (Towns): an extra day now, without moving the schedule. It counts as a tournament day.
- **Players** (Towns, Manage): change BP or turns, kick someone off, delete a parlor (the account stays).
- **Accounts**: find an account, ban or unban it (a ban logs them off everywhere and ends their sessions; after an unban they log in again). **Address bans** block an address or range.
- **Reports** and **Mutes**: what players reported and what you did about it (see "Player safety and moderation" in the server README).
- **Audit log**: every action, every midnight and every admin change, with who did it.
- **Health**: `GET /health` answers `{"status":"ok", "version", "build", ...}`; point an uptime monitor at it.
- **Logs**: JSON lines on stdout (`docker compose logs -f`, `journalctl -u ...`). Anything at level 40 (warn) or above deserves a look.

## 6. Backups

**What to keep.** Everything the server knows is in its SQLite database (`FQ_DB_PATH`): accounts, sessions, every town, snapshots, the hall of fame, reports, the audit log and the Daily Challenge's secret. Besides it keep your `.env` (above all `FQ_ADMIN_TOKEN`), your towns file, any custom content packs and your strict word list. A backup of the database plus those files is a complete copy of your server.

**Making one while the server runs.** Any of these gives a consistent copy (SQLite `VACUUM INTO` on the server's own connection, so no half-saved step), named `fq-<UTC time>.sqlite`, with a `.json` manifest beside it saying which towns, days and accounts it holds and its SHA-256:

- the admin page: **Backups**, **Back up now**, then **Download** to keep a copy elsewhere;
- automatically every `FQ_BACKUP_INTERVAL_HOURS`;
- `POST /admin/backups` (`{ "label": "before-update" }` optional), `GET /admin/backups`, `GET /admin/backups/<name>` downloads, `DELETE /admin/backups/<name>`;
- from a shell, also while the server runs: `node dist/server.mjs backup [file]` (Docker: `docker compose exec fq node server.mjs backup`).

Never copy the live `fq.sqlite` with `cp`: the newest steps may be in its `-wal` file and the copy can be torn.

Copy backups off the machine (they live next to the database by default, so a dead disk takes both). With Docker: `docker compose cp fq:/data/backups ./fq-backups`.

**Checking one.** `node dist/server.mjs check <file>` runs SQLite's integrity check, confirms the schema and lists the towns and accounts it holds; exit code 0 means usable.

**Putting one back (restore).** This replaces everything with the backup's moment: what happened after it is lost.

```sh
# 1. stop the server (systemctl stop fq, or docker compose stop fq)
# 2. restore: checks the backup, sets the current database aside as fq.sqlite.before-restore-<time>
node dist/server.mjs restore backups/fq-20300104T002923Z.sqlite
#    Docker: docker compose run --rm --no-deps fq node server.mjs restore /data/backups/fq-....sqlite
# 3. start the server again
```

On start the server runs every midnight that passed since the backup was made, so the town is on today's day. Accounts, passwords and sessions come back as they were in the backup: anyone who logged in again after it simply logs in again. To move to a new machine, install there, restore your newest backup into the new `FQ_DB_PATH`, copy your `.env` and other files, and start. `restore` refuses while a server is running on that database (it reads the pid file `fq.sqlite.pid`); if it names a process that is not your server, the file is stale and can be deleted.

**Undoing a mistake in one town (rollback).** Each town keeps snapshots: one at every new day, one each hour when anything changed, and one before every reset and rollback (the newest `FQ_SNAPSHOT_KEEP`, 48). Towns, Manage, **Snapshots and rollback**: take one by hand before something risky, or roll back to one. A rollback touches that town only, ends every session in it, and takes a snapshot of the present first, so a rollback can itself be undone.

These paths are exercised by the soak test (`tools/soak`): a backup taken while eight players act, checked against what they saw, then restored into a fresh install that carries on the season.

## 7. When something goes wrong

| What you see | What to do |
| --- | --- |
| The server stopped or the machine rebooted | Start it. Every step was saved when it happened, so nothing but an in-flight request is lost; missed midnights run at start. (The soak test kills it hard at random moments, inside midnight too, and checks exactly this.) |
| It will not start: `Invalid configuration` | The message names the variable. Fix `.env`. |
| It will not start: `another server (pid N) is using ...` | One is already running. If not, delete `fq.sqlite.pid`. |
| A town is in a bad state (a wrong setting played a day, a mistaken edit) | Roll that town back to a snapshot (section 6). |
| The database is damaged (disk trouble, `database disk image is malformed` in the log) | Stop, restore the newest backup that `check` accepts. |
| A player cannot log in | Accounts: is it banned? Ten wrong passwords lock a name for 15 minutes. There is no password reset by e-mail yet: if they forgot it, delete the account (their parlor goes) and they make a new one. |
| Someone is a nuisance | Reports and Mutes in the admin page; ban the account, then the address if needed. |
| Everything is slow | Look at the log for warnings; `docs/performance.md` says what a town costs. Hundreds of players online at once is past what a hobby server is meant for. |
| You lost the admin token | Set a new one in `.env` and restart. |

## 8. Updating

```sh
# 1. back up (admin page, or: node dist/server.mjs backup backups/before-update.sqlite) and copy it off the machine
git pull
pnpm install && pnpm --filter @fq/client build && pnpm --filter @fq/server build
# restart the service           (Docker: docker compose up -d --build)
curl localhost:8080/health      # the new version and build
```

The server upgrades the database's schema by itself at start. There is no downgrade: an older server refuses a database a newer one has written (`check` says "made by a newer server"); to go back, restore the backup you took before updating. Read the release notes for anything that changes a rule in the middle of a season.
