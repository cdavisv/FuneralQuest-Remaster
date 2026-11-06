# @fq/core

The Funeral Quest rules engine: pure, deterministic TypeScript with no I/O, clock or `Math.random`. The Classic ruleset is ported line by line from `legacy/source/`; `docs/classic-rules.md` lists what is ported.

## Using it

```ts
import {
  classicContext,
  createTown,
  createPlayer,
  enterGame,
  step,
  runDailyMaintenance,
} from "@fq/core";

const ctx = classicContext(contentPack, { now: Date.now() }); // rules default to CLASSIC_RULES
let { town } = createTown({ seed: 1234 }, ctx); // runs maintenance once: day 1
const made = createPlayer(town, form, ctx); // validates, logs on, shows the paper
if (made.ok) town = made.town;
const r = step(town, made.playerId, { type: "press", buttonId: "go:desk" }, ctx);
// r.town is a new object, r.view is what to draw, r.effects are log/TV lines; r.rejected if refused
town = runDailyMaintenance(r.town, ctx, { missedDays: 1 }).town; // at midnight
```

- `TownState` is plain JSON. Save it however you like; loading and continuing gives the same result.
- Every action is checked against the player's last `View` (buttons, overlay id, map places). Anything else is rejected and the town comes back unchanged. `{ type: "exit" }` is always allowed.
- Randomness: each player has one stream per game day, derived from the town seed, the player id and the day; the town has its own for maintenance. Positions are stored in `town.streams`.

## What a host must do

- **Deliver `chat` effects.** `{ kind: "chat", to: number[], text: RichText }` is a cafe line (talk, `/me`, `/give`, arrivals, notices, TV reports while the TV is on) for each listed player, now. It is not stored; the acting player's own lines are already in the returned view's `chat`. Everything else a player must see is in their next view or queued as mail.
- **Report connections.** `setPresence(town, playerId, online)` returns a new town. A player counts as online (cannot be visited, shows "on now") while they have a session and the host has not reported them disconnected. Call `leaveGame` when the session should end; a fight in progress then counts as a loss (`fixes.battleDisconnect`).
- **Midnight.** `runDailyMaintenance` also ends tournaments: after the final day it ends every session (`sessionEnded`, reason "reset"), resets the town to day 1 with no players (`tournamentReset`), and keeps the Book of Deeds. `resetTown(town, ctx, { paused })` is the sysop's reset; `lobbyStatus(town, ctx)` gives the log-on screen's game line and why new accounts are refused, if they are.
- `tv` and `broadcast` effects are for logs and tickers; their in-game delivery is already handled (mail or `chat` effects).
- **Blocking and moderation** (both rulesets, docs/expanded-rules.md section 29). `setBlocked(town, playerId, blockedIds)` returns a new town with that player's block list replaced (`[]` clears it); the engine then keeps the blocked players' letters, cafe lines, `/give`, Yang's deliveries and quote mails from the blocker, and never shields fights. `removePlayerText(town, playerId, ctx, { names? })` takes a player's stored text down (queued letters, announcements, battle quotes, sparrow fortunes) and reports the counts; `renamePlayer(town, playerId, ctx, { name?, parlor? })` is a moderator's rename (returns `error` when the name is taken or too short or long). The host owns reports and the block-list screen.

## Adding a location

A location is a module in its own file plus one registration line. Button ids are `"<module>:<command>"` (calls `press`) or `"go:<module>"` (calls `enter`); overlay ids are `"<module>:<name>"`. Map places name the module to enter; a place without a module shows "not built yet".

```ts
// src/classic/modules/bank.ts
import type { LocationModule } from "../../engine/registry.js";
import { button, goButton, hud, legacy } from "../../engine/view.js";
import { enterLocation } from "../location.js";

export const bankModule: LocationModule = {
  id: "bank", // the map place "bank" already points here
  enter(turn) {
    enterLocation(turn, "Bank"); // init_location_info
    return {
      scene: "location",
      title: "Bank",
      text: legacy('`wTeller: `$"Welcome."'),
      picture: { fg: "places/bank" },
      hud: hud(turn.player),
      buttons: [button("bank:exchange", "Exchange"), goButton("map", "Leave")],
    };
  },
  press(turn, command) {
    if (command === "exchange") {
      turn.player.tags[0] = (turn.player.tags[0] ?? 0) + 1; // mutate the draft town freely
      const roll = turn.rng.random(3); // the player's seeded stream
      return this.enter!(turn, undefined);
    }
    throw new Error(`Unknown bank command ${command}`); // becomes a rejection
  },
};
```

```ts
// src/classic/modules/index.ts, in createClassicRegistry():
    .register(bankModule)
```

A `Turn` gives handlers `town` (a draft; the engine cloned it), `player`, `session`, `rules`, `settings`, `content`, `text`, `rng` and `effects`. Keep module-private state in `session.sceneData` (JSON only). Mail and news helpers are in `classic/mail.ts` and `classic/news.ts`.

## Scene scripts

Scripts replace the original's `script/*.c` files. A script is a generator that yields operations; every state read or write and every random draw goes through `s.op(...)` or a helper such as `s.randomRange`, and `yield* s.show(screen)` waits for the player's reply. The runner keeps a JSON journal of results and replays it on resume, so scripts survive saves exactly. Register a `ScriptDef` with `registry.registerScript`, and start it with `startScript(turn, id)`. See `classic/scripts/classicScripts.ts` for ports of `stats.c`, `script_event.c`, `events/bonus_tag.c` and `events/arson.c`.

## Content

The engine reads a `ContentPack` (`src/content/types.ts`): events, news blurbs, risks, soft- and hard-sell items, fortunes, rating and karma lines, and `text` (`src/content/classicText.ts`), every string the original hard-coded in C++. `CLASSIC_TEXT` is the original wording. Strings keep backtick colour codes; the engine turns them into `RichText` with `parseLegacyText`.

## Rules

`CLASSIC_RULES` holds every tunable: Game Settings defaults (copied into `town.settings`), prices, BP multiplier, bonuses, mood and cheapness nudges, psych formulas, odds, the hearse table, and `fixes` (the gameplay bug and exploit fixes of `docs/classic-rules.md` section 9, `true` = fixed). `originalClassicRules()` turns every fix off for parity tests. Original content is never altered on grounds of taste, so no rule switches any of it: the customer generator is the original's (`defineRelationship` ports `create_customer.cpp:31-199` unaltered), and the swear filter runs where the original ran it (new names, announcements, chat, `/me`, `/yell`, battle quotes). `filterUserText` is a host option for moderating what live players send each other: false in Classic, as the original never filtered mail or Yang's fortunes, and true in Expanded.

## The Expanded ruleset

`expandedContext(pack, { now })` builds a context with `EXPANDED_RULES` and `createExpandedRegistry()`, and fills in `pack.expanded` with `EXPANDED_STARTER` (`src/expanded/content/starter.ts`) when the pack has none. The town is created and played with the same functions; `town.ruleset` is `"expanded"`. Expanded state lives in optional `expanded` fields of the player, customer, session and town (`src/expanded/state.ts`), so Classic saves never change. The specification, with every number, the client layout (button `group` and `detail`, the customer panel) and the extension points (modules, rule modifiers, registry hooks), is `docs/expanded-rules.md`.

- Code: `src/expanded/` (customer, negotiation, sale, scoring, parlor, pvp, newDay, wait, modifiers, scripts, panels, modules/), rules in `src/rules/expandedRules.ts`, content types in `src/expanded/content/types.ts`, the content check `checkExpandedContent`.
- Hooks for later systems: `Registry.onMaintenance`, `onPlayerNewDay`, `onPlayerCreated`, `onView` (decorates every view; Expanded's adds the HUD panels of section 11.5), and `LocationModule.sessionEnd`; temporary rule changes with `addModifier` / `modValue`.
- Classic is locked by `test/classicRegression.test.ts`: hashed transcripts of whole Classic playthroughs. Re-record only after a deliberate Classic change: `UPDATE_CLASSIC_TRANSCRIPTS=1 pnpm --filter @fq/core test classicRegression`. It was re-recorded twice: for the empty mail overlay fix, and for restoring the original customer relationships and unfiltered mail and fortunes in Classic (section 1.3 says how each difference was proved).

## Tests

`pnpm --filter @fq/core test`. `test/support/legacyContent.ts` builds a pack straight from `legacy/dist/*.txt` for the tests only. `BALANCE_FULL=1 pnpm --filter @fq/core test expandedBalance` runs the season-long Expanded balance check (docs/expanded-rules.md section 15).
