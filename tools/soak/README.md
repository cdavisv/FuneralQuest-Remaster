# @fq/soak

The soak test: a whole tournament played by AI rivals against the **real server**, over its HTTP and WebSocket API exactly as the web client plays it, through hard kills, a backup restore and the sysop's actions, with invariants checked after every step. It is the evidence for Alpha criteria A3, A4 and A5 (`docs/ALPHA.md`).

```sh
pnpm --filter @fq/soak run soak -- --short                                       # CI: 2 days, 4 players, about 70 s
pnpm --filter @fq/soak run soak -- --rules classic --days 14 --players 8         # A3, about 8 minutes
pnpm --filter @fq/soak run soak -- --rules expanded --days 30 --players 8        # A4, about 25 minutes
pnpm --filter @fq/soak run soak -- --stress                                      # 40 players, 5 Classic days, everyone at once, about 10 minutes
pnpm --filter @fq/soak run soak -- --help
```

The exit code is 0 when every invariant held and 1 when any failed (2 when the harness itself broke). Each run writes `results/<name>-<time>/` (gitignored): `report.json` (everything below, per player), `violations.json`, `transcript.jsonl.gz` (every action sent and its answer, every push message, every server log line, every admin call and every check, one JSON object per line, with real and game time), and the server's data directories with the database and its backups.

## CI

The short mode is the one for CI. The command is exactly:

```sh
pnpm --filter @fq/soak run soak -- --short
```

It belongs in `.github/workflows/ci.yml`, job `unit`, after the step `pnpm --filter "${{ matrix.filter }}" test`, for the `server` matrix group only (the `tools` group already runs this package's unit tests):

```yaml
- name: Soak harness, short mode
  if: matrix.group == 'server'
  run: pnpm --filter @fq/soak run soak -- --short
- name: Keep the soak results
  if: failure() && matrix.group == 'server'
  uses: actions/upload-artifact@v4
  with:
    name: soak-short
    path: tools/soak/results/
    retention-days: 14
```

It needs nothing beyond `pnpm install` (no build: the server runs from source with `tsx`), opens one local port, and takes about 70 seconds; budget two minutes.

## How it works

- **The real server.** `apps/server/src/main.ts` runs as a child process (`node --import tsx`, one process, so `SIGKILL` kills the server itself), on a free port, with a fresh data directory. The town is created through the admin API (`POST /admin/towns`), as a sysop would.
- **An accelerated clock.** The server's clock comes from `FQ_TEST_CLOCK_SPEED`, `FQ_TEST_CLOCK_START` and `FQ_TEST_CLOCK_ANCHOR` (`ScaledClock` in `apps/server/src/clock.ts`): game time is a pure function of real time, so a server killed and started again with the same values carries on, and the time it was down passes as an outage would (missed midnights run at start-up). A game day lasts 16 to 50 real seconds. The server refuses these settings when `NODE_ENV=production`. `FQ_TEST_MAINTENANCE_DELAY_MS` makes each midnight pause after computing the new day and before saving it, and logs a line; the harness kills the server when it reads that line.
- **Players.** Each player is an account (half registered with a password, half guests; one guest is upgraded to a full account mid-season) using the server's own typed client (`ApiClient` from `@fq/server/client`) for HTTP, a WebSocket with the `hello` handshake for pushes, and a fair `@fq/bots` policy (`fairBrain`, with the content pack's public rule book in Expanded) that decides every action from the View alone. The engine is never called. All players play each day at the same time; pushed Views replace the current one, as in the web client. Some log off at the end of the day and some just leave, so the idle sweep logs them off. Letters get a random tag so the privacy check can follow them.
- **Events** (on days chosen from the season length; `schedule()` in `src/run.ts`):
  1. a backup through `POST /admin/backups` while players act, checked at once (`server check`, its SHA-256, its manifest, and every player's saved state against the Views and audit counts around that moment);
  2. `SIGKILL` mid-day with no request in flight: every player's admin record and current View before and after the restart must be identical, and so must the town's revision;
  3. the sysop mid-play: a broadcast (every open socket must receive it), a kick, a ban (the token and a new log-in must be refused) and an unban (the player logs in again and carries on), a guest upgrade;
  4. a settings change (turns per day raised; every player's next days must start with at least that many);
  5. `SIGKILL` inside midnight maintenance: nothing of the new day may be in the database, and after the restart exactly one maintenance must have been saved for that midnight;
  6. `SIGKILL` mid-day with requests in flight: each unanswered action either happened or did not, and the audit log must say which;
  7. a snapshot, a few more actions, a rollback: every player's record must equal the snapshot's;
  8. a disaster: the server is killed, the earlier backup is restored with `server restore` into a fresh data directory, and the fresh server must catch up the missed midnights to the live day, keep accounts and pre-backup tokens, and carry on the season;
  9. a forced new day (`POST /admin/towns/:id/new-day`);
  10. with `--kills 4` (the default for full runs), `SIGKILL` inside the final midnight, where the tournament resets.
- **The end of the season.** Days 1 to N are played, then the closing day N+1 (the original's calendar, `maint.cpp:99-113`), then the reset. The harness checks the reset (day 1, no parlors, accounts unlinked, the next season number), the hall of fame (one entry, its winner the top of its standings, the standings equal to the final day's records), and the Book of Deeds (every old line kept, one new line for the winner). Then everyone plays day 1 of the next season, the server is stopped with `SIGTERM` and must exit cleanly.

## Invariants

Checked continuously, at every day's end (all players quiet) and around every event:

| Invariant                                                                                     | What it means                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `offered-action-refused`                                                                      | No action the player's current View offered was refused (a refusal because another player's push changed the View on the way is counted as stale, not as a failure)                |
| `non-negative`                                                                                | No BP, BP today, turns, tags, HP or luck out of range, in any View or admin record                                                                                                 |
| `no-unexplained-change`                                                                       | At each quiet checkpoint, a player's admin record equals their last View, unless the audit log shows another player's action, a midnight or a sysop change after that View         |
| `audit-matches-answers`                                                                       | The audit log's accepted actions per account equal the accepted answers the player got (unanswered ones resolved either way)                                                       |
| `restart-*`, `kill-mid-maintenance-saved-nothing`, `maintenance-once`, `one-day-per-midnight` | A restart changes nothing; a killed midnight saves nothing and runs once after the restart                                                                                         |
| `backup-*`, `restore-*`                                                                       | The backup is consistent and matches play at its moment; the restore is byte-identical, catches up, keeps sessions                                                                 |
| `rankings-agree`, `paper-has-announcements`                                                   | The public rankings equal the records; every accepted announcement is in the paper                                                                                                 |
| `reset-*`, `hall-*`, `deeds-*`, `next-season-plays`                                           | The tournament ends on the right day with the right winner; the reset is clean and the Book of Deeds intact                                                                        |
| `privacy`                                                                                     | No player is ever sent another player's token, e-mail, log-in name, or a letter tag (a letter may reach its one reader)                                                            |
| `guest-text-only-for-guests`                                                                  | Only guests get the `guest_text` refusal                                                                                                                                           |
| `server-log`                                                                                  | No server log line at warn or above, and nothing on stderr (except the soak clock's own start-up warning)                                                                          |
| `snapshots-bounded`, `wal-bounded`, `db-compact`                                              | Snapshots stay within `FQ_SNAPSHOT_KEEP`, the write-ahead log stays bounded, the database is at most four times its compacted size; `dbGrowth` in the report has the sizes per day |
| `admin-*`, `settings-applied`, `rollback-*`                                                   | Each sysop action did what it says                                                                                                                                                 |

## Tests

`pnpm --filter @fq/soak test` checks the harness's own pieces (the schedule, the JSON diff, the gate, the checks) and holds skipped reproductions of bugs found in packages this package does not own (none at present).
