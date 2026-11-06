# @fq/legacy-compat

A bridge that lets the original 2001 Flash client (`legacy/dist/public/flash/welcome.swf`, Flash 5, ActionScript 1), running under the [Ruffle](https://ruffle.rs) emulator, play against the new `@fq/core` rules engine. If the unmodified client can play a day against the engine, that is strong evidence the port is faithful, and it gives players a "museum mode".

The bridge is **optional and off by default**.

## Sounds, art and licence

- The original sounds and music are embedded inside the legacy SWFs. They stay in `legacy/` and are only ever served from there, by this optional bridge, to a player who chose to run the original client. Nothing from `legacy/` is copied anywhere else, and the bridge adds no audio of its own.
- From the repository README: the source code uses the [Proton SDK license](../../license.txt), which permits reuse and porting subject to its attribution and other terms. Akiko Robinson's artwork, including the Flash vector art, is also released under the Proton SDK license; please credit her when using it. **The sounds and music in the Flash files are licensed only for Funeral Quest and are not covered by that license.** This product includes software written by Seth A. Robinson (www.rtsoft.com).
- Ruffle (`@ruffle-rs/ruffle`, MIT or Apache-2.0) is self-hosted from `node_modules`; the page loads nothing from a CDN.

## Run it

```sh
pnpm --filter @fq/legacy-compat dev        # http://127.0.0.1:4747/
```

The dev server keeps one town in memory (content read from `legacy/dist/*.txt` by `src/content.ts`, three rival parlors already open). Environment: `PORT`, `FQ_SEED`, `FQ_RIVALS`, `FQ_TRACE=1` (log every request and the variables sent back), `FQ_DEV_SAVE=file.json` (keep the town between runs). `GET /dev/new-day` runs midnight maintenance and `GET /dev/town` prints a summary; both exist only in the dev server.

```sh
pnpm --filter @fq/legacy-compat test       # unit tests, scripted protocol test, random-walk test
pnpm --filter @fq/legacy-compat typecheck
```

## Mounting it in a server

```ts
import { legacyCompat, type LegacyHost } from "@fq/legacy-compat";

await app.register(legacyCompat, { prefix: "/museum", host, enabled: config.legacyClient });
```

Options (`LegacyCompatOptions`): `host` (required), `enabled` (default **false**: nothing is registered), `legacyRoot`, `manifestPath`, `ruffleRoot`, `cookieName`, `secureCookie`, `idleMs`, `log`, `trace`, `onBridge`.

With the prefix above it serves:

| Path                                           | What                                                                                                                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /museum/`                                 | A page that plays `flash/welcome.swf` with Ruffle (`<base>` is set to the mount point, because the movie asks for `request.xp` and `flash/...` relative to the page) |
| `GET /museum/request.xp?...`                   | The original protocol (also at `flash/request.xp`)                                                                                                                   |
| `/museum/ruffle/*`                             | Ruffle, from `node_modules/@ruffle-rs/ruffle`                                                                                                                        |
| `/museum/flash/*`, `pages/*`, `home.html`, ... | `legacy/dist/public`, read only (GET and HEAD)                                                                                                                       |

### The host interface

The engine is pure and keeps no passwords, so the bridge asks the server it is mounted in for four things (`src/host.ts`):

- `context()`: the `EngineContext` (rules, content, registry, `now`).
- `getTown()`: the town as it is now, read once per engine call.
- `persist(town, effects)`: save the town the engine returned and deliver the effects (the bridge has already queued cafe lines meant for its own players).
- `accounts.verify(logon, password)` and `accounts.register(playerId, logon, password)`: the log-on check. The real server's account store plugs in here. Optional `accounts.checkNewUser(logon, password)` runs before the engine creates a player on the New User page, so a host with real accounts can refuse a name or password (shown on page two of the form) and create the account without leaving an unowned parlor behind.
- optional `exclusive(work)`: run `work` under the host's own lock, if other clients also change the town.

For cafe lines produced by other clients, call `bridge.deliverChat(playerId, text)` (get the bridge from `onBridge`); `bridge.servedPlayerIds()` lists the players a browser is logged on as. `apps/server` is the real host: see its README, "Museum mode". Midnight maintenance is the host's job, as for every client.

Sessions are keyed by a cookie (`fq_legacy`, HttpOnly, SameSite=Lax, path = mount point), not by IP address as the original did. A browser idle for 30 minutes (`idleMs`) is logged off with `leaveGame`.

## How the translation works

Everything is in `src/`:

| File                   | Job                                                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `escape.ts`            | `format_for_local` (`shared_util.cpp:41-82`, every `Replace`, in order) and `format_for_local_cst`; the request parser (`request_process`, `tokenize_input`); response escaping |
| `richText.ts`          | `RichText` to `<font color="...">` HTML with the original colour values (`seth_ansi`, `funeral_util.cpp:336-495`)                                                               |
| `buttons.ts`           | `add_button` slots (`funeral_util.cpp:10-31`) and `cbut` centring                                                                                                               |
| `assets.ts`            | asset id to legacy URL from `assets/manifest.json` `legacyUrl`, forward slashes, the spelling that is a real file                                                               |
| `commands.ts`          | command numbers (`commands.h`), `i_sent` values, the numbers fixed controls use                                                                                                 |
| `render.ts`            | View to variables, and the number-to-Action table for the buttons offered                                                                                                       |
| `bridge.ts`            | sessions, the verbs (`checklogon`, `logon`, `new`, `command`), request to engine Actions                                                                                        |
| `plugin.ts`, `page.ts` | Fastify plugin and the Ruffle page                                                                                                                                              |

**Responses.** `name=value&` pairs, in order, with every byte outside `A-Za-z0-9-_.~` as `%XX` (space is `+`), so `&`, `=`, `%`, `+`, quotes and newlines survive. Non-ASCII text is UTF-8, which is what Ruffle reads and writes. Real HTTP headers (`Content-Type`, `Cache-Control: no-store`, `Set-Cookie`); the original's stray `/r/n` trailer is gone. Most text fields in welcome.swf are HTML fields, so `<`, `>` and `&` in text become entities, and each newline becomes `<br>` (Ruffle treats a raw LF in HTML text as white space).

**Requests.** `request.xp?command&i_command=..&i_command_sub=..&st_input=..` is decoded with the original rules (including the characters it strips: `&`, `+`, `<`, `^`, `*`), then:

- A per-session table maps the numbers handed out in the last response to engine `Action`s: plaque button _k_ is `i_command_<k>`; an engine button with a legacy meaning keeps the original's number (`neg:guilt` 29, `neg:done` 30, `go:desk` 4, `go:map` 12, ...), any other gets `100 + slot` (`BUTTON_COMMANDS` in `commands.ts`).
- The client's fixed controls send fixed numbers: Wait 2, Inventory 3, News 5, Map 12, Rankings 9, Exit 1, the news tabs 41, 42, 7 and 5, the map buildings 39 (bank), 40 (Di-Mart), 23 (cafe), 13 (Yang's), 38 (rival parlors), 4 (parlor), 44 + `st_extra_text=church.c` (church), 37, 36. They are put in the table when the view offers them (`PLACE_COMMANDS`, `registerFixed`).
- Pieces the client does itself are bridged: Make Announcement (the notepad is the client's; command 8 presses the engine's button, then submits `st_note`), the mail pen (the client opens its own name prompt; command 17 presses `go:mailbox`, submits the search text, answers "Do you mean?"), the mail pad (command 20 confirms the name, then submits the letter), Reply (21), pop-ups the client closes without telling the server (the next command cancels any open overlay first).
- Overlays: text input is `i_get_text` (or `i_getname` when its id ends in `:getname`), "Do you mean X?" is `i_namenext`, "nobody by that name" is `i_namenext` with `i_his_id=-1`, a player picker is searched in the bridge, a letter becomes a desk screen with Reply and Continue. All answers come back as `i_return_command` 110 (`st_extra_text` of `12ABORT12` is Abort).

**Which screen.** `news`, `rankings`, `stats` and `map` are screens of their own (`i_sent` 5, 9, 3 and `st_object=i_map`); `cafe` is `i_chat` (polled with command 24); `desk`, and every `location` with a customer panel or drawn by the negotiation, risk or home scripts, is `m_main` (the original ran the customer exchange inside it); other locations are `i_generic`. A screen is created with `i_sent=10` and `st_object`, and refreshed in place (`i_sent` 2 for `m_main`, 33 for `i_generic`) when the same screen is redrawn, resending a picture only when it changed.

## Testing

- `test/escape.test.ts`: every `format_for_local` case, the request parser, the encoder.
- `test/richText.test.ts`: all sixteen colours against a port of `seth_ansi`, fuzzed.
- `test/buttons.test.ts`, `test/assets.test.ts`: slot mapping, centring, every legacy URL.
- `test/protocol.test.ts`: a scripted client in the order of the decompiled script (`checklogon`, `new`, news, the desk, a sale with all five buttons, the map and every building, name search, text prompts, cafe, mail, stats, rankings, exit, a new day), asserting `i_sent`, `st_object` and the variables the movie reads.
- `test/walk.test.ts`: a random player at the client's controls; `FQ_WALK_STEPS=3000 FQ_WALK_SEEDS=12` for a long run. It fails on a fatal error, an unknown object, more than five plaque buttons, a request the bridge could not map, or an engine refusal.
- `test/plugin.test.ts`: off by default, read-only static files, no path escape, mounting below a prefix, cookie sessions, idle logoff.

## Known differences from the 2001 client

See the final report of the work that added this package for the full list; the short version:

- `i_view` (the Library's papers) is drawn with `i_generic`; the engine does not say which of the two a text screen is.
- The bank's count prompt starts empty (the original filled `st_extra_text` with the player's tag count, `commands_bank.cpp:296`; the engine's text prompt has no starting text there).
- A button the view marks disabled is drawn but does nothing; more than five buttons would be cut to five (neither occurs in Classic).
- After a letter is sent the screen stays dimmed until the next shop or map visit; the client's own `i_mail.callback` never unlocks the screen, so this is the original's flow (not confirmed against the 2001 server).
- Music cues (`View.music`) are loaded as the picture when a screen has no foreground picture, as the original did with `music_fight.swf`; `View.sounds` has no equivalent and is ignored.
