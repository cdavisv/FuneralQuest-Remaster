# Funeral Quest Remastered: full plan, from first commit to live

## 1. Context

Funeral Quest (Robinson Technologies, 2001) is a daily-turn multiplayer web game in the BBS-door tradition: players run rival funeral parlors in Deathville, upsell grieving customers, and sabotage each other. The repo holds the original Windows/MFC C++ server (`source/`, ~23k lines plus ~12k shared), the Flash 5 client (`dist/public/flash/`, 84 SWFs, 91 FLA sources in `dist/flash/`), and all content (`dist/*.txt`, `dist/script/*.c`).

It cannot be played as shipped: Flash is dead, the server is Windows-only and insecure (sessions keyed by IP, plaintext passwords, header-less HTTP responses, buffer overflows), and several designed systems were never finished.

**Goal:** a free, open-source remaster with two rulesets on one engine:
- **Classic**: the 2001 game reproduced faithfully (rules, text, art, screen layout).
- **Expanded**: the same game grown up, with the cut features built, more content, characters, and game modes.

**Decisions already made:** web first, then wrapped for Steam desktop and mobile; TypeScript stack; solo developer with AI tools; free and open source.

**Sizing assumption:** about 15 hours a week, roughly 60 weeks (14 months) to launch. Phases are ordered so the game is playable early and every later phase is additive.

## 2. What the review found (facts the plan is built on)

**The game**
- Core loop: log in, read the Funeral Times, spend 15 turns on "Wait for Customer", spend casket tags around town, log off. Score is Bury Points (BP).
- Negotiation is the heart: Sympathy, Guilt, Hard Sell, Soft Sell, Done against hidden mood, cheapness, spending limit and a hidden "loved" flag. BP = price × 0.0064; landing exactly on the customer's limit pays +200 BP (`source/commands_complicated.cpp:40-49`).
- Content is small: 23 events, 21 news blurbs, 10 risks, 55 soft-sell items, 10 hard-sell upgrades, 40 fortunes, 18 customer portraits, 11 scripts, about 12 locations.
- Designed but dead or empty: karma, money, parlor rating, church, city hall, hospital, graveyard, cremation, embalming tiers, casket inventory, Reaper Club, necromancy vs church magic, news that changes gameplay (`source/Design Doc.txt`).
- Known exploits: re-buying a hearse grants bonus turns again and "downgrading" pays gold tags (`source/command_store.cpp:176-204`); disconnecting escapes a lost battle; new players with 0 BP at midnight are deleted.

**The engine**
- The server already drives the UI: every response names a screen template (`st_object`), main text (`st_main`), picture layers (`st_url`, `st_url_bg`), stats, and up to five buttons with command IDs. The client is a renderer. The remaster keeps this model.
- Two RNGs (MT19937 with the old 69069 seeding, and MSVC `rand()`), drawn in a fixed order per handler.
- Day rollover has two parts: global maintenance at local midnight (`source/maint.cpp:362`), and a lazy per-player reset on their first main-screen visit (`source/commands_newday.cpp`).
- Scripts are a line-based C-like language in UTF-16 files, with `$var$` interpolation and wait-for-client-reply semantics.

**The assets**
- All art is Flash 5 vector, stage 550×400, so it scales to any resolution once exported to SVG.
- About ten backgrounds (store, parlor row, bank, backgrounds 1 to 5, church, ceremony) are auto-traced stock photos. They look different from the cartoon art and have unclear provenance: redraw, do not reuse.
- Fonts are commercial (Monotype Corsiva, Verdana, Loki Cola and others) with only glyph subsets embedded.
- **Audio cannot be reused.** The README says sounds and music are licensed for Funeral Quest only; several come from the Sounddogs library. All 41 sounds need replacing.

**Licensing**
- Code: Proton SDK license (BSD-style). Keep the copyright notice and credit "This product includes software written by Seth A. Robinson (www.rtsoft.com)". Do not use Seth's name in promotion.
- Art: Akiko Robinson's artwork is under the same license; credit her.
- The title "Funeral Quest" belongs to Robinson Technologies. Contact Seth early for a blessing on the name (see Risks).

## 3. Product definition

### 3.1 Rulesets and modes

| Mode | Ruleset | What it is |
|---|---|---|
| **Classic Town** | classic | Original rules and text, multiplayer, endless or 30-day tournament. |
| **Expanded Town** | expanded | The flagship. 30-day seasons that end with the meteor, all new systems. |
| **Solo Career** | either | Offline against AI rival parlors, runs in the browser with no server. |
| **Daily Challenge** | expanded | Everyone plays the same seeded day of customers; one leaderboard. |
| **Blitz Town** | either | A new day every 10 to 30 minutes, for live sessions and streams. |
| **Private Town** | either | Self-hosted or invite-only town with sysop-tunable rules. |

### 3.2 Classic fidelity policy

Classic keeps every formula, probability, draw order and line of text. Exceptions are listed, not improvised:

| Original behaviour | Classic remaster |
|---|---|
| Hearse re-buy and downgrade exploit | Fixed |
| Disconnect escapes a lost battle | Fixed |
| 0-BP players deleted at midnight | Replaced with a 3-day grace period (sysop toggle) |
| One player per IP per day | Dropped; accounts and rate limits instead |
| New-player welcome never shows; police message never shows | Fixed |
| Free events, risks and script events; +200 exact-match bonus; random soft-sell item; duplicate soft-sell items | Kept |
| Adult customer with a teen "girlfriend/boyfriend" deceased (`source/create_customer.cpp:113-118, 165-170`) | Fixed in the generator in every mode |

**The original dialog stays (owner's rule, 2026-11-06).** The original 2001 dialog, even if dated or controversial, must remain. No built-in pack, mode or setting edits, softens, replaces or removes an original line. This replaces the earlier two-text-pack design (a lightly edited Classic and an untouched "Vintage 2001"): there is one original text and nobody is offered an edited version of it.

- **Classic pack** (`classic`): the untouched original text, byte for byte: every table of `legacy/dist/*.txt` and every string the original C++ hard-coded (`CLASSIC_TEXT`). It is the default for Classic-ruleset towns and has no edits and no overrides.
- **Expanded pack** (`expanded`): Classic plus newly written material. It may add lines (including to slots the original left empty) but never replaces or drops an original one; where the engine reads a table by position (hard-sell upgrades, soft sells, risks, ratings and karma slots, mood bands, hearses) every original entry stays at its original index.
- **`vintage`** is a deprecated alias of `classic` (the same data under the old id), kept only so saves, towns and imports that name it still load. Nothing new should select it.
- **Content policy applies only to new text.** The banned-terms and other policy lints (brands, real people, slurs, placeholders, lengths) hold the newly written Expanded text and are never applied to, or used to justify changing, an original line.
- **Enforced, not trusted.** `@fq/content` fails the pack build, and its tests fail, if any built-in pack lacks any original line unchanged (compared with a fresh import of `legacy/dist` and `CLASSIC_TEXT`, slot by slot, entry by entry and string by string), or if a built-in pack has an overrides file. The record of what was reverted and what new lines await the owner's decision is `packages/content/EDITS.md`.

### 3.3 Expanded ruleset

Built almost entirely from the original authors' own cut ideas, in priority order.

**A. Negotiation depth (first, because it is the whole game)**
- Named customers with a generated backstory, two visible traits, and tells that hint at the hidden "loved" flag.
- Soft Sell shows a hand of three items to choose from, so hitting the limit is skill, not a dice roll.
- New actions: Offer Coffee (calms mood, once), Listen (reveals a trait, costs tempo), Discount (trades BP for mood).
- Packages: cremation and urns, embalming tiers, flowers, plot tiers (Forest Lawn, Memorial Park), headstones.
- Pitch lines grow from about 4 per action to 25 or more; refusals and reactions likewise.
- Special customers: mob boss, celebrity, pet funeral, pre-need planner, the repeat family that remembers you.

**B. Dead systems revived**
- **Karma**: moral choices while preparing the body (take the ring or leave it). Low karma unlocks grave-digging and Necromancy perks; high karma unlocks Church Associate perks and referrals.
- **Money and casket inventory**: buy stock at Di-Mart, set a markup, earn plot income.
- **Parlor rating and upgrades**: the parlor visibly grows from the shack to the colonial mansion (both drawings exist).
- **Luck** matters in more places than risk events.

**C. Locations filled in**
- **Graveyard**: plots, headstones, digging at low karma, graveyard duels.
- **Church**: Bingo Night (specified in the original script docs), confession, blessings.
- **City Hall**: permits, a weekly town ordinance vote that changes a rule, mayoral election each season.
- **Hospital**: battle injuries persist until treated; bribe the nurse for leads.
- **The Reaper Club**: cover charge, gambling, hire a hit man, black market.
- **Bank**: tag transfers and interest.

**D. A living town**
- Daily news modifies the rules for the day (earthquake raises the customer rate, sale at Di-Mart).
- Multi-day story arcs, using the day-range feature the news file format already has.
- Weather on the morning screen.

**E. PvP and fairness**
- Opt-in rivalry tiers, more sabotage variety, layered defences.
- Underdog bonuses and caps on psych, HP and strength (the authors' own unfinished to-do) to stop leaders snowballing.
- Parlor chains: small guilds sharing a season score.

**F. Onboarding and quality of life**
- A guided first day led by the new-user clerk (her art exists).
- Bank up to one day of unused turns. Rewards apply immediately, not when mail is read.
- Web push when a new day dawns. One-tap tag exchange. Player pickers instead of typed names.

**G. Characters**
- Existing cast gets real roles and arcs: Elijah, Father Smyth, June, Mr. Yang, The Twins, the Nurse, the Teller, Morty, Cousin Sal, Old Man Withers, the unnamed Mayor.
- New cast: a Reaper Club owner, a health inspector, a rival AI parlor family, a coroner. Mr. Yang and June are rewritten without the broken-English stereotype.

**Content targets for Expanded v1:** 120 events, 80 news blurbs plus 6 story arcs, 40 risks, 150 soft-sell items, 30 upgrades, 150 fortunes, 40+ portraits built from layered parts, 20 locations.

## 4. Engine and architecture

### 4.1 Stack
- **Language:** TypeScript (strict) everywhere. Node 24+, pnpm workspaces.
- **Rules engine:** a pure package with no I/O. `step(state, action, rng) → { state, view, effects }`. It runs on the server for multiplayer and in a Web Worker for Solo Career.
- **Server:** Fastify, WebSocket for chat, TV broadcasts and presence, plain HTTP POST for game actions. SQLite via Drizzle (the original peaked near 230 logins a day; one file is plenty). One Docker image.
- **Client:** Vite + React, DOM and SVG rendering, CSS and GSAP for motion, Howler for audio. Installable as a PWA.
- **Wrappers:** Tauri 2 for Windows, macOS, Linux and Steam Deck; Capacitor for iOS and Android.
- **Quality:** Vitest, fast-check, Playwright, Biome, GitHub Actions.

### 4.2 Repository layout

```
legacy/                 original source/ and dist/, moved here untouched
packages/core           rules engine, both rulesets, scene scripts, RNGs
packages/content        classic, vintage and expanded packs + Zod schemas
packages/protocol       View and Action types shared by client and server
packages/legacy-compat  request.xp adapter for the original Flash client
packages/bots           AI rival parlor policies
apps/server             Fastify, WebSocket, SQLite, day scheduler, admin API
apps/client             React client, design system, admin panel
apps/desktop            Tauri shell
apps/mobile             Capacitor shell
tools/extract           SWF to SVG pipeline, content importers
tools/sim               Monte Carlo balance simulator
docs/                   rules spec, style guide, audio brief, sysop guide
```

### 4.3 Key designs

**Server-driven views.** Every response is a `View`: scene template, rich-text blocks, picture layers, stats, up to N buttons each carrying an action. This is the original `st_object` / `st_main` / `st_url` / `st_option_N` model with types. New content needs no client changes. Text is an AST, never HTML, which removes the original's injection problems. Backtick colour codes are parsed into semantic spans.

**Rulesets as data plus flags.** Hard-coded constants (casket prices, income bands, the 0.0064 multiplier, mood increments, psych formulas, hearse table, university costs, battle percentages) move into a ruleset file. Classic and Expanded are two files plus feature flags over the same handlers.

**Content packs.** Importers convert `dist/*.txt` (`key|value` format) into validated YAML. The 11 scripts in `dist/script/` are hand-ported to TypeScript scene scripts written as async generators (`yield prompt(view)` replaces `SendPacketAndWait`). A compatibility interpreter for old community scripts is a post-launch stretch.

**Randomness.** Each player gets a seeded stream per day (town seed + player + day), which makes days replayable for debugging and powers the Daily Challenge. Exact ports of MT19937 (69069 seeding) and the MSVC LCG exist for parity tests, and handlers keep the original draw order.

**Days.** A scheduler runs global maintenance at midnight in the town's time zone and catches up missed days (the original advanced only one). The lazy per-player reset is kept. Blitz towns shorten the day length.

**Accounts and safety.** Argon2id passwords, token sessions, guest play, rate limits, Zod validation on every action, and every action checked against the buttons the current scene offered (a general form of the original callback guard). Mail, announcements, fortunes and battle quotes get a real word filter, report, mute and block.

**Sysop panel.** A web admin replaces the MFC dialogs: every Game Settings and Server Setup option, the player editor, ban list, text pack choice, force new day, reset. Public towns can opt in to a town directory, replacing the old license server.

**Legacy bridge.** `packages/legacy-compat` answers `request.xp?...` in the original wire format (with proper HTTP headers and forward-slash paths) so the unmodified `welcome.swf` runs under Ruffle against the new engine. This is the parity oracle and gives a playable game before any new UI exists.

## 5. UI redesign

**Keep (the recognisable shape of the game):**
- A carved walnut cabinet on pure black, arched top, gold script title, round copper Exit button.
- Parchment note with brass tacks on the left: luck meter, BP today, turns left, casket tags.
- Dark wood picture frame on the right with Class and Mood overlaid.
- Recessed text panel below: white speaker names, yellow body, magenta numbers.
- Tan engraved plaque buttons along the bottom edge.
- The isometric Deathville map and the Funeral Times broadsheet on a brick wall with the spiral notepad.

**Update:**
- Responsive layouts from one component set: 4:3 classic cabinet, 16:9 wide cabinet with a side log panel, portrait phone (picture, stats strip, text, buttons stacked).
- Design tokens taken from the original palette: walnut `#301501` to `#B78F5E`, parchment `#B89867`, plaque `#A38855`, text yellow `#FFFF33`, magenta `#CC66CC`, gold `#BB8710`.
- Open fonts: TeX Gyre Chorus for Corsiva, Atkinson Hyperlegible for Verdana, Pirata One for the masthead, IBM Plex Mono for chat.
- Negotiation readouts: a mood face, a resistance gauge, a running total, greyed-out reasons when an option is unavailable.
- Typewriter text with skip, keys 1 to 5 for buttons, full controller support for Steam Deck.
- Accessibility: screen-reader labels (the game is text, so this is cheap and valuable), font scaling, reduced motion, colour-blind safe cues.
- All strings in ICU message tables from day one; English at launch.
- A "Classic view" toggle that locks 4:3 and the original art pack.

Design work happens in Penpot (open source). Every screen is mocked next to its original screenshot before it is built.

## 6. Art plan

**Pipeline (`tools/extract`)**
1. JPEXS FFDec command line exports every SWF's shapes, sprites and frames to SVG, plus the ActionScript and text for reference. Run on `dist/public/flash/**/*.swf`; use the SWFs, not the FLAs, as the canonical list.
2. SVGO optimises; a script writes `assets/manifest.json` (id, source SWF, category, status, license, credit).
3. Ruffle plays the originals for side-by-side reference. Record every screen once in Phase 0.

**Three tiers**
- **Classic pack:** the original vectors exported as-is. Crisp at 4K for free. Ships first.
- **Remastered pack:** cleaned gradients, consistent line weight and palette. The traced-photo backgrounds are redrawn in the cartoon style of the portraits and map.
- **Expanded art:** new locations, items, and a layered portrait system (head, hair, clothes, and four expressions tied to mood) giving hundreds of customers from about 40 part sets. Portraits react as mood rises.

**Tools:** Inkscape for vector work, Krita for paint-overs, Penpot for UI. AI image tools are used for concept exploration and background drafts with Akiko Robinson's art as the style reference; everything is then redrawn or cleaned by hand as vectors. AI assistance is disclosed in the credits and on the Steam page.

**Cleanup list:** the Metallica shirt, the leftover Reckless Thief advert, the `Ring/` folder case mismatch, and the abusive placeholder string in the client source.

**License:** new art is CC BY 4.0, credited alongside Akiko Robinson.

## 7. Audio plan

Nothing original ships. The existing inventory is the brief:

| Category | Original | Remaster |
|---|---|---|
| Music | 20 s intro, 4 s map loop, 2 s fight loop, 4 s sneak loop, 11 s organ | Main theme, town theme, one loop per major location, fight, sneak, ceremony organ, season-end meteor theme |
| Ambience | 8 loops (clock, hospital, heart monitor, fog, bubbles, fire, night, birds) | Same set, longer, plus new locations |
| Stingers | About 15 (bells, gong, cash register, harp, growl, flush) | Same set plus expanded events |
| UI | Click, paper flip | Click, hover, page flip, stamp, coin, mail |

- **Direction:** funeral-parlor organ, small-town banjo and upright bass, a little spooky lounge. Dry and comic, never horror.
- **Sources:** self-composed in Reaper or Ardour with free instruments (Spitfire LABS, Pianobook); effects from CC0 sources (Freesound CC0, Kenney, Sonniss GDC bundles). AI music generators are avoided unless their terms clearly allow open redistribution.
- **Delivery:** Ogg Opus with AAC fallback, loudness normalised to -16 LUFS, separate music, ambience and effects sliders.
- **Extras:** an optional "2001 radio" filter (11 kHz mono) for nostalgia, and optional browser text-to-speech for cafe chat, echoing the original server's talking feature.
- **Ledger:** `assets/audio/LICENSES.md` records the source and license of every file. CI fails if a file has no entry.

## 8. Development roadmap

| Phase | Weeks | Output |
|---|---|---|
| 0. Preservation and foundations | 1 to 4 | Monorepo, CI, extraction pipeline, rules spec |
| 1. Core engine, Classic rules | 5 to 14 | **M1: original Flash client playable on the new server** |
| 2. New client vertical slice | 12 to 20 | **M2: first playable in the new UI** |
| 3. Classic complete | 20 to 30 | **ALPHA** |
| 4. Remaster polish | 26 to 40 | Remastered art, new audio, mobile layout, Solo Career |
| 5. Expanded v1 | 36 to 52 | **BETA** |
| 6. Launch preparation | 50 to 60 | Steam, mobile and store builds; **LIVE** |
| 7. Live operations | ongoing | Seasons, content drops, mods |

### Phase 0: preservation and foundations
- Move `source/` and `dist/` under `legacy/`; scaffold the workspace; add LICENSE, CREDITS and attribution.
- Build `tools/extract`; export all SWFs; commit the manifest and a contact sheet.
- Stand up the original for reference (Ruffle plus the community PHP port, or the Phase 1 bridge) and record every screen.
- Write `docs/classic-rules.md`: every formula and constant with its `file:line`, drawn from the review. This is the source of truth for tests.
- Email Seth Robinson about the project and the title.

### Phase 1: core engine and Classic rules
- RNG ports, ruleset schema, content importers for all `dist/*.txt` files.
- Handlers in dependency order: session and new user; new day and maintenance; wait-for-customer branching; customer generation; negotiation; risks and events; store, bank, university, Yang's; visits, lockpicks, steal, battle; news, mail, chat, rankings; tournament and reset.
- Port the 11 scripts as scene scripts.
- Build the legacy bridge. **M1 exit:** a full day, a PvP attack and a midnight rollover played in the original client under Ruffle.

### Phase 2: new client vertical slice
- Design tokens, cabinet shell, text panel, plaque buttons, picture frame.
- Screens: login, new user, newspaper, main desk, negotiation, map, one shop.
- **M2 exit:** a new player can sign up and play a full day in the new UI on desktop and phone.

### Phase 3: Classic complete (Alpha)
- Remaining screens: all locations, visits and battle, mail, cafe chat, rankings, stats, Book of Deeds, old papers.
- Accounts, persistence, backups, sysop panel, PWA install.
- Classic art pack throughout; placeholder CC0 audio.
- **Alpha exit:** Classic is feature-complete against the rules spec; a private town of 5 to 10 friends finishes a 14-day tournament with no data loss and no blocker bugs.

### Phase 4: remaster polish
- Remastered art pack and redrawn backgrounds; animation pass (portrait reactions, map hover, page turns).
- Full audio.
- Tutorial day; accessibility pass; widescreen and portrait layouts.
- `packages/bots` and Solo Career running fully offline (bots also populate test towns).

### Phase 5: Expanded v1 (Beta)
- Systems in the order of section 3.3: negotiation depth, then karma and money, then locations, then living town, then PvP fairness.
- Content writing sprints against the volume targets. Drafts are AI-assisted, then edited by hand for voice against a short style guide built from the original text.
- `tools/sim` runs thousands of simulated seasons to tune BP curves, check that no strategy dominates, and confirm closed exploits stay closed.
- Daily Challenge and Blitz Town.
- Closed beta (invite, 50 players, one season), then open web beta on the official server with a Discord and an in-game feedback button.
- **Beta exit:** two full 30-day seasons completed; day-7 return rate measured and acceptable; no critical bugs open for two weeks; moderation tools exercised.

### Phase 6: launch preparation
- Tauri builds and a free Steam release (page goes up at Alpha to collect wishlists); itch.io; Capacitor builds for the App Store and Google Play.
- Load test to 10 times the expected peak; security review; restore-from-backup drill.
- Privacy policy, terms, age rating (expect Mature / PEGI 16 for crude humour), store assets, trailer, press kit, sysop self-hosting guide.
- **Launch:** Season 1 of the official Expanded Town opens the same day as the Steam release, with an official Classic Town beside it.

### Phase 7: live
- A new season every 30 days, each ending with the meteor and a Book of Deeds entry, each with a small content drop and one rule twist.
- Post-launch backlog: parlor chains, more languages, legacy script interpreter, importer for old `player.dat` saves, community content pack browser.
- Hosting: one small VPS (about $5 to $10 a month) with Caddy and Litestream backups; optional donations cover it.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Rights to the name "Funeral Quest" | Ask Seth in Phase 0. Keep a fallback title; nothing in the code depends on the name. |
| Solo scope creep | Classic is the only hard requirement for Alpha. Expanded systems are ordered and each is shippable alone. |
| Art consistency with AI-assisted work | A written style guide, Akiko's art as reference, hand vector cleanup, one reviewer pass per batch. |
| Audio license contamination | CC0 or self-made only, enforced by the ledger check in CI. |
| Dated or offensive content | Two text packs; generator fix for minors in all modes; brand and real-person references removed outside Vintage. |
| Low player counts in a multiplayer game | Bots fill towns; Solo Career and Daily Challenge work with one player. |
| Parity drift from the original | Rules spec with source references, formula tests, the Ruffle bridge as a live oracle. |

## 10. Verification

- **Formula tests (Vitest):** one test per rule in `docs/classic-rules.md`, each citing its `file:line`. Examples: BP on Done (wood 5, silver 16, gold 33, +200 exact, +35 within $50, +25 within $100); psych reveal chances; battle damage range; hearse trade-in.
- **Property tests (fast-check):** tags never go negative; no action sequence gains turns or gold from the store; an action not offered by the current scene is rejected.
- **Golden transcripts:** fixed-seed full days stored as snapshots; any rule change shows up as a diff.
- **Distribution tests:** `tools/sim` checks the wait-for-customer split (about 8% event, 7.4% risk, 4.2% script, 80.4% customer) and mean BP per turn by psych level against values computed from the original formulas.
- **Parity check:** run `apps/server` with the legacy bridge, open the original `welcome.swf` in Ruffle, and walk the checklist (sign up, full day, each location, attack, mail, midnight rollover).
- **End to end (Playwright):** sign up, play a day, force a new day from the sysop panel, verify rankings and news; run on desktop and phone viewports with screenshots compared to the mocks.
- **Manual:** each milestone ends with a recorded playthrough in the browser preview and, from Phase 6, in the Tauri and Capacitor builds.

## 11. First steps once approved

1. Save this plan in the repo as `docs/REMASTER_PLAN.md`.
2. Create a `remaster` branch; move the originals under `legacy/`; scaffold the pnpm workspace and CI.
3. Install the missing local tools (pnpm, Java for FFDec, Inkscape, Ruffle) and run the first SWF to SVG export.
4. Write `docs/classic-rules.md` from the review findings.
5. Start `packages/core` with the RNG ports and the customer generator, tests first.
