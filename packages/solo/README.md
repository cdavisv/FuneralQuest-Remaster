# @fq/solo

Offline Solo Career: a whole Funeral Quest town (the player plus AI rival parlors from `@fq/bots`) run on the player's own machine, usually in a Web Worker, with save slots and save files. It speaks the web client's `Transport` shape, so the same game screens play it as play against a server.

The player and every rival are ordinary players of one `TownState` on the Classic or the Expanded rules (`@fq/core`). While the player plays, the rivals are logged off (they can still be visited, robbed and attacked); when the day ends the player logs off, every rival plays its whole day with `runBotDay`, midnight maintenance runs, and the player wakes up to the new day's paper. Mail and rival TV reports from the night arrive as notices.

## Use it from a page

```ts
import { SoloWorkerClient, IndexedDbSaveStorage, chooseRivals } from "@fq/solo/client";

// A module worker: it carries the rules engine, the bots and the built-in content packs.
const worker = new Worker(new URL("./soloWorker.ts", import.meta.url), { type: "module" });
// soloWorker.ts is one line: import "@fq/solo/worker";

const solo = new SoloWorkerClient(worker);
await solo.create({
  seed: 12345,
  contentPack: "classic", // "classic", "vintage" or "expanded": the worker has all three, nothing is sent over
  ruleset: "classic", // "original" is Classic with every deliberate fix off; "expanded" is the Expanded ruleset
  mode: "career", // a 30-day tournament; "endless" never ends
  careerDays: 30,
  clock: "manual", // the player ends the day; "realtime" is one game day per real day
  player: { name: "Pat", parlor: "Pat's Rest", male: false },
  rivals: chooseRivals(3, "normal", 12345),
});
const first = await solo.connect(); // a View: the paper for a new parlor
solo.onNotice((n) => console.log(n)); // newDay, tv, mail, chat, sessionEnded ...
const next = await solo.send({ type: "press", buttonId: "desk:wait" });

// The desk gets an "End the Day" button (id "solo:end-day"); pressing it, or `solo.endDay()`, runs the night.
const save = await solo.save(); // the whole game as JSON, mid-negotiation included
await new IndexedDbSaveStorage().write("slot-1", save);
// later, or in a fresh worker:
await solo.load(await new IndexedDbSaveStorage().read("slot-1")); // or a file's contents
solo.terminate();
```

- **Choosing the ruleset.** A client picks it in `SoloConfig` when the game is created, and nowhere else:
  - Classic: `ruleset: "classic"` (or `"original"`) with `contentPack: "classic"` or `"vintage"`.
  - Expanded: `ruleset: "expanded"` with `contentPack: "expanded"` (any other pack also works; the Expanded starter tables fill in what it lacks, and a pack whose own Expanded tables are broken is refused with a `SoloSetupError` on field `contentPack`). `mode: "career"` is a 30-day season (`careerDays`), `"endless"` has no end. Use `chooseRivals(count, difficulty, seed, "expanded")` for the rivals: it also seats the six Expanded-only personalities. `tutorial: false` skips the guided first day (the tour and a practice sale) for a player who has played before; the default is to show it, as in an online Expanded town.
  - The Expanded pack also plays under the Classic ruleset (`ruleset: "classic", contentPack: "expanded"`).
- **Start-up calls**: `create(config)` or `load(save)` once, then `connect()` (the player's current screen, logging them on if they are not), then `send(action)` for each button. `endDay()`, `tick()` (real-time clock: play any days the clock has passed), `status()` (day, days left, standings), `save()`, `close()` (stop listening) and `terminate()` (end the worker). `create` and `load` take the content pack as an optional second argument for a custom pack; leave it out and the worker uses the built-in pack named by `contentPack` (a save made with a pack the worker lacks fails with a message saying so).
- **The local time.** The original printed the server's local time in front of notices ("12:05 AM:Bob logged on."). A worker has no window, so the page passes its IANA zone: `create(config, undefined, { timeZone: pageTimeZone() })` and the same for `load` (`WireHostOptions.timeZone`; `HostOptions.timeZone` for `SoloHost`). The host computes the offset for every engine call (`EngineContext.localTimeOffsetMinutes`), following daylight saving. The zone is not saved, so a save opened elsewhere uses that machine's zone; without it the host uses the config's `utcOffsetMinutes`, else the runtime's own zone.
- **Daily Challenge practice.** `mode: "daily"` (Expanded only) plays the Daily Challenge offline: one seeded day for one parlor with the fixed loadout, no rivals, no maintenance, no End the Day button, no leaderboard. `challengeDay` is the date as `"YYYY-MM-DD"` (default today; `practiceDay(Date.now(), utcOffsetMinutes)` gives the local date). The same date gives the same customers on every machine and in every save, so friends can compare. It is practice: the online challenge mixes a server secret into its seed, so a practice day is never the online day. `status().challenge` has the score so far (`score`, `money`, `sales`, `exact`, `walkouts`, `finished`); when the turns are used up the desk shows the score with one button, and leaving through it lands on a lobby view with the score and no way back in (create another run with the same date to try again). A practice run saves and loads like any other game.

```ts
await solo.create({
  seed: 0,
  contentPack: "expanded",
  ruleset: "expanded",
  mode: "daily",
  clock: "manual",
  challengeDay: practiceDay(Date.now(), -new Date().getTimezoneOffset()),
  player: { name: "Pat", parlor: "Pat's Rest", male: false },
  rivals: [],
});
```

- **Entries**: `@fq/solo/client` is safe for a page's main thread (the proxy, save files, storage, `chooseRivals`, the types; it imports neither the host, the bots' policies nor the engine). `@fq/solo` adds `SoloHost` (the same game in this thread, for tests and tools) and `serveSolo(port, packs)`. `@fq/solo/worker` is the worker's entry; it calls `serveSolo(globalThis, [classicPack, vintagePack, expandedPack])`. `practiceDay`, `pageTimeZone` and `zoneOffsetMinutes` are in the client entry too.
- **Errors** from the worker keep their `name`; a refused parlor form is a `SoloSetupError` whose `field` (`name`, `parlor`) the proxy copies onto the error it rejects with.

## Saves

`SoloSave` is plain JSON (`format: "fq-solo"`, `version`, the config, the `TownState`, each bot's memory). `migrateSave` checks a save and walks it up to the current version through `SAVE_MIGRATIONS` (when the format changes, bump `SAVE_VERSION` and add the step). Version 2 (the Expanded ruleset) made `config.tutorial` and `config.challengeDay` explicit; the 1 to 2 step gives an old save `tutorial: false` and `challengeDay: null` and changes nothing else, so every version 1 Classic save loads and plays on exactly as before (`test/fixtures/classic-v1.fqsave.json` is one, loaded by `test/expanded.test.ts`). `exportSave(save)` gives a file name, text and type for a download; `importSave(file)` reads one back. `SaveStorage` is `list / read / write / remove` over slot names: `IndexedDbSaveStorage` (works in a page or a worker; stores each save as text, with a summary row for the list) and `MemorySaveStorage` (tests).

## Rivals in an Expanded game

Rivals are made with `createBotPlayer` and played with `runBotDay` from `@fq/bots`, as in Classic. The bots package plays Expanded from the Views alone (the tour on the first day, morning errands, customers with the soft-sell hand, the evening's town; it needs the content pack for its public rule book, which the host passes with `fairBrain(content)`), for all twelve personalities. The host never trusts that: every rival's day goes through the runner's step cap (800 actions) and fallback, a rival that gets stuck or throws is logged off at the cap and the day goes on, and `test/expanded.test.ts` replays three nights with seven rivals and checks that none is stuck, none throws, all of them finish the tour and sell. If a future pack or rule makes the bots unable to play, the day still ends.

## Tests

`pnpm --filter @fq/solo test`: the same suite runs against `SoloHost` directly and through the worker proxy over a Node `worker_threads` Worker (`test/nodeWorker.ts` maps the worker's globals onto the port), so the wire protocol is covered: a whole day with the bots, save and load mid-negotiation continuing identically, real-time catch-up, the content pack check, errors. `test/expanded.test.ts` covers the Expanded ruleset: the tour and a sale with a card, day rollovers with seven rivals drawn from the twelve personalities, a save round trip that continues identically, an old Classic (version 1) save loading and playing on, and the Daily Challenge practice mode (same date, same customers; a finished run; saves), also through the worker. The browser side is covered by the client's Playwright suite (`apps/client/e2e/solo.spec.ts`).
