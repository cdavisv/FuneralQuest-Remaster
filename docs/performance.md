# Performance

What the production client and the server cost, measured on 2026-11-06, the budget that follows from it, and what is checked automatically. All timings are from one Linux desktop (Chromium 156, Node 26, SQLite through `node:sqlite`) that other work was also using (the client figures are from a run at a load of about 9; at a load of 30 they were 15 to 100% worse, the server figures were taken at the higher load), so treat them as orders of magnitude and compare like with like on the same machine.

Reproduce:

```sh
pnpm --filter @fq/client build && pnpm --filter @fq/client bundle:check     # sizes against the budget
pnpm --filter @fq/client bundle:size                                        # the table below
pnpm --filter @fq/client perf             # first load, a 30-day solo session; writes apps/client/perf/results.json
pnpm --filter @fq/server exec tsx scripts/scale.ts --parlors 800 [--ruleset expanded] [--burst] [--json]
```

## The bundle (what `apps/client/dist-build` holds)

Gzip level 9, the size a server sends; sourcemaps never counted.

| Group | Files | Raw | Gzip | Loaded when |
| --- | ---: | ---: | ---: | --- |
| `app.js` (React, the game screens, the net layer) | 1 | 636 KB | 179 KB | first visit |
| `app.css` | 1 | 137 KB | 25 KB | first visit |
| `solo-worker.js` (the engine, the bots and the content packs, in a module worker) | 1 | 1238 KB | 404 KB | when Solo is chosen |
| `dev-town.js` (the `?expanded` development town: the engine again, for tests and development) | 1 | 993 KB | 319 KB | only with `?expanded`; not precached |
| fonts (`.woff2`) | 23 | 292 KB | 292 KB | as the screens need them |
| pictures (art bundled for the game) | 159 | 6.4 MB | 1.4 MB | as the screens need them |
| sound, Synth pack (Opus and AAC) | 142 | 14.1 MB | 14.0 MB | on demand; filled in the background for offline play |
| sound, Studio pack | 142 | 12.2 MB | 12.2 MB | on demand; kept on first play, not in the offline install |
| sound, Original remastered pack | 73 | 1.2 MB | 1.2 MB | on demand; filled in the background for offline play |
| **everything but sound** | 217 | 10.1 MB | 3.0 MB | |

What a first visit to the front door costs: `index.html`, `app.js`, `app.css` and the fonts and pictures of that one screen, **227 to 302 KB over the wire** (about 1 MB once decoded).

## First load, cold cache (Chromium, 390x844, `perf/perf.spec.ts`)

| Connection | Front door usable | First contentful paint | Largest contentful paint | Main-thread time over 50 ms per task | Solo list after a tap |
| --- | ---: | ---: | ---: | ---: | ---: |
| Slow 4G (1.6 Mbit/s, 150 ms round trip), CPU 4x slower | 2.0 s | 1.4 s | 1.6 s | 0.24 s | 0.33 s |
| Fast 4G (9 Mbit/s, 40 ms), CPU 2x slower | 0.85 s | 0.34 s | 0.46 s | 0.07 s | 0.18 s |
| No throttling | 0.13 s | 0.08 s | 0.08 s | 0.03 s | 0.12 s |

"Usable" is the moment the *Play solo* button is on screen; "after a tap" is the time from pressing it to the list of careers (the Solo worker is fetched and started in that time).

**Compression was the cheap win.** The server sent every file as it was: about 1 MB for the front door, 5 seconds of transfer alone on the slow connection. It now sends scripts, styles, pages and vector art brotli- or gzip-compressed (once per file, kept in memory; never API responses) and sends hashed files with `immutable` caching: about 230 KB, and the front door is usable in 2.0 s. A reverse proxy that compresses as well is harmless.

## Memory over a long Solo session (30 days, a sale a day, three rivals, Chromium)

| | Day 1 | Day 5 | Day 31 |
| --- | ---: | ---: | ---: |
| JS heap of the page after a full collection | 64 MB | 103 MB | 105 MB |
| JS heap of the Solo worker | 2.9 MB | 3.9 MB | 4.1 MB |

DOM nodes at the end: about 370. IndexedDB at the end: 80 KB. End the Day (the rivals' night, in the worker): median 114 ms, worst 217 ms. The page's own thread stays responsive during it (the Solo suite measures its longest pause over nights with seven rivals: 105 ms in Chromium, and it fails above 400 ms).

- **The worker does not grow without bound.** Its heap rises about 40 KB a day, the town's state accumulating.
- **The page's heap is decoded sound, not the game.** A heap snapshot at the first screen of a career shows 54 of its 62 MB as `ArrayBuffer` data: the music and ambience the sound library keeps decoded (`KEEP` in `src/audio/library.ts`: up to 4 music, 3 ambience, 6 stingers, 64 effects; a minute of stereo music is 20 MB of PCM) plus the compressed bytes it has fetched. The steps in the table are another track being decoded (the +38 MB on day 2 is the desk's and the negotiation's music; an earlier run showed +17 MB more when the next track was decoded late in the month). They are bounded by those caps, so the page levels off at roughly 100 to 150 MB with sound on, and is about 6 MB without. A phone with little memory would want smaller caps (two music tracks would cost a re-decode of 100 to 300 ms on a return to the desk); that is a design choice left as it is.

## The server with a town of 800 parlors (the original's player cap)

`apps/server/scripts/scale.ts`: a real SQLite file, low-cost password hashing, parlors joining over eight days, 5% of them (40) logged on while 400 actions are timed.

| | Classic | Expanded |
| --- | ---: | ---: |
| Time per action (median / 95th percentile / worst) | 10 / 14 / 48 ms | 16 / 31 / 76 ms |
| Entering a parlor (median / 95th) | 87 / 135 ms | 48 / 53 ms |
| Persisted town JSON after a new day | 0.63 MB (784 bytes a parlor) | 1.6 MB (2.0 KB a parlor) |
| Serialising it / the SQLite write / parsing it | 3.7 / 0.1 / 1.8 ms | 12.8 / 0.35 / 5.8 ms |
| A new day (midnight maintenance) | 22 ms | 76 ms |
| Public town listing (median) | 0.4 ms | 0.4 ms |
| Database file | 44 MB | 37 MB |

Every action writes the town's state (per-action durability is the contract), and an action takes the town's queue, so one town handles about 100 actions a second at this size.

**The worst case is not the cap but everyone online.** Each log-on is queued as mail ("X logged on.") for every parlor online, so the state grows with the square of the players online. With all 800 online at once the town JSON reached 34 to 56 MB and an action took 0.4 to 0.6 s (measured while other work was running). That is an engine rule in `packages/core`; the server cannot fix it. If hundreds of players may be online at the same time, the mail rule needs bounding, or the persistence needs to be incremental. The realistic case (a few dozen online) is the table above.

## The budget

Checked by CI (`pnpm --filter @fq/client bundle:check`, after the build; the ceilings are in `apps/client/bundle-budget.json`, 15% above the build they were taken from). The job fails when a group passes its ceiling:

| Group | Ceiling (gzip) |
| --- | ---: |
| `app.js` | 206 KB |
| `app.css` | 30 KB |
| `solo-worker.js` | 465 KB |
| `dev-town.js` | 368 KB |
| any other chunk, together | 64 KB |
| fonts (`.woff2`) | 337 KB |
| pictures | 1.6 MB |
| sound, Synth | 16.1 MB |
| sound, Studio | 14.4 MB |
| sound, Original remastered | 1.4 MB |
| first load (`index.html`, `app.js`, `app.css`) | 236 KB |
| everything but sound | 3.5 MB |
| everything | 35.0 MB |

The three sound packs ship in every build by default (decision 15a: the "Automatic" sound pack plays the remaster in Classic and Studio in Expanded), which raised "everything" from 19.6 to 35.0 MB (measured 30.5 MB). The first-load figures do not change: sound loads on demand. To keep the offline install small, the service worker fills only Synth and the remaster (about 8 MB of Opus); Studio is cached as it is played.

If growth is on purpose, raise the ceiling in `bundle-budget.json` in the same change and say why here. Regenerate with `node apps/client/tools/check-bundle.mjs --suggest`.

Targets to hold by hand (`pnpm --filter @fq/client perf` and `scale.ts`; not in CI because timings on shared runners are noise):

- Front door usable within 3 s on slow 4G with a 4x slower CPU; first visit under 300 KB over the wire.
- Solo worker heap under 10 MB after 30 days; no growth of the page's heap between day 5 and day 30 beyond decoded sound.
- End the Day under 1 s with seven rivals.
- At 800 parlors with 5% online: an action under 25 ms (Classic) or 40 ms (Expanded) at the median, the town's JSON under 2 MB after a new day, a new day under 100 ms.

## Not measured

Real phones (the CPU slowdown is an emulation), Firefox and WebKit timings, the Tauri and Capacitor wrappers' start-up, and the server under many simultaneous WebSockets (`apps/server/test/hardening.test.ts` covers the limits, not throughput).
