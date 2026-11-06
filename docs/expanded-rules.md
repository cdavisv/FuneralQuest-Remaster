# Expanded rules specification

The Expanded ruleset is "the same game grown up" (docs/REMASTER_PLAN.md section 3.3): the daily turns, Wait for Customer and the five-button negotiation stay; the original authors' cut ideas (legacy/source/Design Doc.txt) are built; and the balance problems found by the Classic simulator (docs/balance/classic-baseline.md, findings F1 to F8) are answered. Every number here is in `packages/core/src/rules/expandedRules.ts` (`EXPANDED`, `EXPANDED_RULES`); every string is content in `packages/core/src/expanded/content/starter.ts`. Code and tests cite the section numbers below.

Status: this document covers plan items A (negotiation), B (dead systems), C (locations, sections 16 to 21), D (the living town, section 22), E (PvP and fairness, including parlor chains in section 23 and the Daily Challenge in section 24) and F (quality of life). The town's numbers are in `packages/core/src/rules/expandedTownRules.ts` (`EXPANDED_TOWN`, also `EXPANDED.town`); its text is in `packages/core/src/expanded/content/townStarter.ts`; its code is in `packages/core/src/expanded/town/`.

## 1. Structure

### 1.1 API

```ts
import { createTown, createPlayer, step, expandedContext, EXPANDED_RULES, createExpandedRegistry } from "@fq/core";

const ctx = expandedContext(contentPack, { now }); // rules EXPANDED_RULES, registry createExpandedRegistry()
let { town } = createTown({ seed }, ctx);           // town.ruleset === "expanded"
```

- `EXPANDED_RULES: ClassicRules` is `CLASSIC_RULES` with the changes listed in each section and an `expanded: ExpandedRules` block. Expanded draws its customers with Classic's `createRandomCustomer`, so the relationship table is the original's unaltered. `filterUserText` is true in Expanded (mail and fortunes go through the swear filter, a host option for live towns) and false in Classic. `ClassicRules.ruleset` and `TownState.ruleset` are `"classic" | "expanded"` (`RulesetId`).
- `createExpandedRegistry()` is the Classic registry with these modules replaced by id: `desk`, `neg` (negotiation), `stats`, `store` (Di-Mart), `spirit-university`, `competitors` (rival parlors), and the `script_event` script; and these added: `prep` (body preparation), `parlor` (the office), `tutorial`. Every Classic button id still works.
- `expandedContext(pack, { rules?, registry?, now? })` fills in `pack.expanded` with `EXPANDED_STARTER` when the pack has none (`withExpandedContent`), and refuses rules without `expanded`.
- The engine entry points (`createTown`, `createPlayer`, `enterGame`, `step`, `leaveGame`, `runDailyMaintenance`) are unchanged.

### 1.2 What is shared and what is forked

| Area | How Expanded differs |
|---|---|
| Wait for Customer | Own function (`expanded/wait.ts`) in Classic's order, reusing Classic `noTurns`, `freeEvent`, `startRisk`, `startScript`; odds through modifiers (12.2). |
| Negotiation | A separate module under the same id `neg` (`expanded/negotiation.ts`), reusing Classic text pools, nudges and thresholds from `ClassicRules`. |
| Desk | Wraps the Classic desk (greeting, Classic new day, mail), then the Expanded new day (10.1), the Parlor button and the tour. |
| Di-Mart, University, rival parlors | Wrappers that add commands and hand everything else to the Classic module. |
| Battle | Classic module; two guarded branches (`if (turn.rules.expanded)`) for the gain curve (9.1) and the defender's security bonus (9.2). The visit module has one for bonus visits (9.3). |
| Maintenance, player creation, session end | Classic code calls registry hooks (12.3); the Classic registry registers none. `endSession` (classic/session.ts) also calls the current scene's `sessionEnd` when no sale is open (a graveyard duel yields, 16.4) and marks a Daily Challenge run finished (24.2); both are no-ops in Classic, where no module has `sessionEnd` and no town has `expanded`. |
| Church, hospital, bank, battle, map | Replaced by id in the Expanded registry (`expanded/town/index.ts`): the church is a new module (Classic's church script stays Classic's); the hospital, bank, battle and map wrap the Classic modules and add commands (sections 17, 19, 21, 26). |
| New places | `graveyard`, `city-hall`, `reaper-club` (sections 16, 18, 20), added to `EXPANDED_PLACES`, plus the `arc` module for story-arc appeal buttons (22.3). |
| HUD | `hud()` adds money, karma and rating only for players that have an `expanded` record. |

### 1.3 Classic is locked

- `test/classicRegression.test.ts` records five complete Classic playthroughs (3 to 6 players, 3 to 5 days, one under `originalClassicRules()`, about 10,400 actions touching every place, overlays, battles and the cafe), hashing every View, effect and rejection and the town after each midnight, per day, against `test/fixtures/classic-transcripts.json` recorded before any Expanded code existed. It has been re-recorded twice. The first time was for a deliberate fix of the remaster's own presentation (10.2: the empty mail overlay): a one-off replay of the old streams on the new engine showed the only differences to be the 2 empty overlays in the 10,483 recorded events (seed 1 and seed 31337, each with the dismiss that closed it); the other three playthroughs kept their hashes. The second time was for restoring the original behaviour that an earlier default had suppressed: the customer generator pairs teens and adults as lovers exactly as `create_customer.cpp` does, and Classic no longer swear-filters mail and Yang's fortunes (`filterUserText` false, as the original). Replaying the old default-rules runs and the new ones from the same seeds, with the same actions and the same number of recorded steps (8,875 in the four default-rules runs), the only differences were 46 relationship words (`dad`, `mom`, `son`, `daughter`, `grandson`, `granddaughter` becoming `boyfriend` or `girlfriend`) in 44 of those steps (13, 12, 7 and 12 per run), carried by the lines that use the word; no mail or fortune text contained a filtered word, and the fifth run (original rules) kept its hash. Blocking (section 29) leaves a town without block lists byte-identical, which the same test checks.
- Expanded code is unreachable under `CLASSIC_RULES`: every Expanded module is absent from the Classic registry; `CLASSIC_RULES.expanded` is undefined, so every guarded branch adds 0 and `xr(turn)` throws; Classic players never get an `expanded` record (tested: a Classic walk never produces the key `"expanded"`, HUD money, or a button `group`/`detail`).
- Pre-existing tests are untouched. `packages/core/vitest.config.ts` raises the per-test timeout to 60 s because the whole-town simulations share the CPU with the older ones.

## 2. State

Everything is plain JSON in optional `expanded` fields (`expanded/state.ts`), so Classic saves are byte-for-byte unchanged.

### 2.1 `PlayerState.expanded: ExpandedPlayer`

| Field | Meaning |
|---|---|
| `upgrades: string[]` | Upgrade ids owned, in purchase order (7.2). |
| `stock: [wood, silver, gold]` | Caskets in the storeroom (6.2). |
| `markup: number` | Casket markup percent, one of -10, 0, 10, 20, 30 (6.3). |
| `rivalry` | `"peaceful" \| "standard" \| "cutthroat"` (9.3). |
| `rivalryDay` | Day the tier last changed, 0 = never. |
| `reviews` | Word of mouth, -20 to +20 (7.1). |
| `plotIncome` | Dollars a day from premium plots sold (6.4). |
| `families: {surname, memory, day, visits}[]` | Families served, newest last, at most 30 (3.8). |
| `futures: {day, bp, money, text}[]` | Payments due later (pre-need, 3.8). |
| `tutorial: {step, done}` | The guided first day (10.4); step 99 = practice sale done. |
| `daily: {dug, hearsePaid}` | Reset each new day. |
| `record` | Sales, walkouts, exact/great/nice counts, cremations, sale BP, bonus BP, sale money. |

Classic fields reused with meaning: `money` (cash), `karma` (1 to 100), `rating` (0 to 100, now computed, 7.1), `incinerator` (set by the incinerator upgrade), `plots`, `luck`, `psych`, `hpMax`, `strength`, `transportation`.

### 2.2 `CustomerState.expanded: ExpandedCustomer`

`first`, `surname`, `deceasedFirst`, `pet` (species or ""), `traits` (ids; the first `visibleTraits` shown), `special` (id or null), `repeat` (family memory or null), `notes` (backstory and tells learned, markup), `told {loved, cheap, limit}`, `estimate {low, high}`, `patience`, `patienceMax`, `coffee`, `listens`, `discounts`, `discount` (dollars), `blessed`, `raised`, `hand` (soft-sell indexes), `bought`, `refused`, `track` (`burial`/`cremation`), `cremationAsked`, `casketPrices` (at this customer's markup), `markup`, `packages` (category id to tier index), `pane` (`main`/`hand`/`packages`), `actions`, `practice`. The Classic fields keep their meaning (`moneyToSpend` is the hidden limit, `mood`, `cheapness`, `loved`, `desiredCasket`).

### 2.3 `SessionState.expanded: { prep }`

A pending body-preparation choice `{event, surname, deceased, deceasedMale}` (8.2).

### 2.4 `TownState.expanded: { modifiers, life?, challenge? }`

Temporary rule modifiers (12.2). Absent until one is added. `life` is the town's part of the places and the living world (2.6); `challenge` marks a Daily Challenge town (2.7).

### 2.5 `ExpandedPlayer.life: PlayerLife` (optional, created on first use)

`expanded/town/state.ts`. `lifeOf(town, player)` creates it, and resets `today` whenever the game day has moved on, so daily limits never depend on the player reaching the desk first. Old saves load unchanged.

| Field | Meaning |
|---|---|
| `monuments` | Graveyard monument tiers bought (16.1). |
| `injuries: {id, days}[]` | Unhealed injuries, at most 3 (19.1). |
| `leads` | Customer leads held, at most 3 (19.2). |
| `holyWater` | Bottles, at most 3 (17.3). |
| `permits: string[]` | City Hall permit ids (18.1). |
| `certifiedUntil` | Last day an inspection certificate or bribe covers (18.2). |
| `savings`, `loan: {owed, due} \| null`, `deadbeat` | The bank (21.2, 21.3). |
| `armor`, `bodyguardDay` | Black-market vest (stops the next injury or hit) and the night a bodyguard covers (20.3, 20.4). |
| `mayor` | Elected this season (18.4). |
| `chain`, `leftChainDay` | Chain id and the day the player last left one (23). |
| `today` | `day`, `tended`, `duels`, `duelsLost`, `confessions`, `served`, `tithed`, `bribes`, `cover`, `staked`, `bought`, `seance`, `hired`, `sent`, `received`. |
| `spent: Record<string, number>` | Dollars spent per town system (for the stats and the balance runs); `staked`/`won` are the club's turnover. |
| `healedDay` | Reserved (healing runs at midnight). |

### 2.6 `TownState.expanded.life: TownLife` (optional, created on first use)

| Field | Meaning |
|---|---|
| `season` | Bumped when the town is back on day 1 after a reset; the whole record and every modifier are then started again (22.4). |
| `bingo: {day, cards, paid, carry}` | Tonight's 12 cards (owner id or -1), cards paid for, the carried pot (17.1). |
| `ballot`, `ordinance` | The open ordinance ballot `{options, votes, bought, opened, closes}` and the ordinance in force `{id, from, until}` (18.3). |
| `election` | `{candidates, ads, ballot, mayor, mayorName, held}` (18.4). |
| `chains: {id, name, members, score, invites, hitsToday, hitsDay}[]`, `nextChain` | Section 23. |
| `hits: {by, target, day}[]` | Hits booked at the club, resolved at midnight (20.4). |
| `today: {day, news, weather}` | Today's news and weather ids (22.1, 22.2). |
| `market` | Today's black-market item ids (20.3). |
| `arc`, `arcsDone` | The running story arc `{id, beat, beatDay, started, counters, given}` and the arcs played this season with their ending (22.3). |
| `tallies: {walkouts, sales}` | Town-wide counts (the arcs' tests). |

### 2.7 `TownState.expanded.challenge: ChallengeState`

`{id, waits, finished, startBp, startMoney, base}`: the Daily Challenge (24). `base` is the challenger as the run began.

## 3. Customers and the negotiation (plan item A)

### 3.1 Generating a customer

Wait for Customer keeps Classic's order and odds: no turns; free event (`normalOdds` 8%); customer; risk (`luckOdds` 8%); script event (`scriptOdds` 5%); otherwise one turn and the negotiation. Each odd is read through a modifier (12.2). The customer starts as a Classic `createRandomCustomer` (age, sex, relation, loved 50%, mood and cheapness `frandom(10)`, the death), then:

1. **Special** (3.8): chance `0.06 x (0.5 + luck/100)` (6% at luck 50, 9% at 100), times the `customer.specialChance` modifier, picked by weight among those whose `minDay` has come.
2. **Repeat family** (3.8): otherwise, if the parlor has served families, 20% of customers are one of them (surname and memory).
3. **Names**: first name by sex, surname, deceased first name by sex (a pet name for a pet; the customer for a pre-need planner).
4. **Income** (answers F1, F5): `random(100) + floor(rating / 6) + floor((luck - 50) / 5) + chapel 15 + modifier`; poor below 35, average below 65, rich below 90, else super rich. At rating 10, luck 50: 34/30/25/11%; at rating 80: 22/30/25/23%.
5. **Limit**: a uniform point of the $50 grid inside the band (poor $850 to $2,800, average $1,900 to $5,400, rich $3,700 to $7,550, super rich $4,600 to $18,500), times trait and special `limitMult` and the `customer.limitMult` modifier, rounded to $50.
6. **Traits** (3.3): forced ones (specials, the practice customer), then by weight two visible, and a hidden third half the time; never two that exclude each other, never one that contradicts a loved flag a special forces.
7. **Hidden state**: forced loved flags; cheapness and mood plus trait and special effects; repeat family (happy: mood -1.5, cheapness -1; sour: +1.5, +1; walked: +3, +2); karma (Trusted: cheapness -0.3, mood -0.5); psych calm (3.6); modifiers; clamped to cheapness 0..10 and mood 0..9.5.
8. **Caskets** at the markup (6.3; a pet's at 1/4); the wanted casket is `random(3)` rerolled until it fits; if even wood does not fit, the limit is raised to the wood price.
9. **Patience** `randomRange(7, 10)` + trait/special patience + viewing room 2, at least 2.
10. **Estimate** (3.6).

### 3.2 Arrival

The screen shows the request (special intro, repeat family line, or one of the request templates), one free tell, a line for each visible trait half the time, the estimate, then what psych finds. The panel (`View.customer`) carries `name`, `deceased` ("her husband Earl", "Biscuit the cat"), `traits` (label and honest hint), `estimate`, `patience`, `special`, `notes` (backstory first, then every tell learned), `bill` (line by line) and `track`, besides Classic's income, mood word and level, total and resistance. The `status` line explains the bonus rule (3.7).

### 3.3 Traits

A trait is content (`TraitDef`): label, hint, lines, and `CustomerEffects`. Effect keys (all optional): `cheapness`, `mood` (added on arrival), `moodMult` (every mood increase), `patience`, `limitMult`, `loved` (forced), `guilt`, `sympathy`, `coffee`, `discount` (multipliers of the action's main effect; 0 = useless), `listen` (facts per Listen), `hardSell` (cheapness added when judging a Hard Sell), `affinity` (item tag to cheapness added when judging an item with that tag), `estimate` (width multiplier). Starter traits:

| Trait | Effects | What the player learns |
|---|---|---|
| Haggler | discount x2, hardSell +1, cheapness +0.5 | Discount instead of Hard Sell |
| Guilt-Ridden Heir | not loved, guilt x1.6 | Guilt |
| In a Hurry | patience -4, coffee x0 | Be quick, skip the coffee |
| Penny-Pincher | cheapness +2, estimate x1.3, prestige +1.5 | Cheap items, Listen |
| Show-Off | cheapness -0.5, limit x1.1, prestige and vanity -3 | Sell the flashy stuff |
| Heartbroken | loved, sympathy x1.5, moodMult 0.8 | Sympathy |
| Estranged | not loved, guilt x1.3, sentimental +2 | Guilt, no keepsakes |
| Skeptic | hardSell +1.5, listen 2 | Listen, not Hard Sell |
| Devout | religious -3, cremation +4 | Religious items; never cremation |
| Hot-Headed | moodMult 1.4, coffee x1.5 | Coffee early |
| Sentimental | sympathy x1.2, sentimental -3, flowers -2 | Keepsakes and flowers |
| Eco-Minded | cremation -4, embalming +3, vanity +1 | Cremation; no embalming |

### 3.4 Actions

Every action except Done (and opening the hand or packages) uses one patience (Listen two). With no patience left, each action adds `0.5 + frandom(0.5)` mood (times `moodMult`) and an "impatient" line. Mood increases are multiplied by the customer's `moodMult`. At mood 10 or more the customer walks out (Classic's rule), except a `noWalkout` special (3.8).

| Action | Rule |
|---|---|
| Guilt, Sympathy | Classic (`commands_complicated.cpp:860-1074`) with trait multipliers on the cheapness cut (and on the loved Guilt mood penalty, at least x1). Guilt on a customer who loved the deceased also costs 1 karma. |
| Hard Sell | Classic's casket ladder (wood to silver to gold), price difference at the customer's markup. Refused when `frandom(10) < cheapness + hardSell effects + 0.5 per 10% markup above 0` or that is above 8. Disabled (with a hint) at gold or on the cremation track. The Classic big upgrades after gold are replaced by Packages. |
| Soft Sell | Opens the hand (section 4). |
| Packages | Opens the package cards (section 5). |
| Offer Coffee | Once per customer. Mood `-(0.8 + frandom(1)) x coffee effect x 1.5 with the coffee machine`, patience +1 (to its maximum). In a Hurry wastes it (and a patience). |
| Listen | Two patience. Reveals, per Listen (Skeptic: two), the hidden trait if any, else a tell for a fact not yet given away (loved, cheapness, or the limit, which halves the estimate, 3.5). A customer who loved the deceased calms (mood -0.3); one who did not gets bored (mood +0.3 to 0.7), which is a tell of its own. Disabled when nothing is left. |
| Discount | Twice per customer at most. Takes `max($50, 10% of the bill rounded down to $50)` off (shown on the button). Mood `-(1.2 + frandom(1)) x discount effect`, cheapness `-0.5 x effect`. On a poor customer, +1 karma. Disabled when the bill would fall below $50. |
| Cremation | Needs the incinerator; once per customer (5.2). |
| Bless | Church Associate perk, once: mood -2, reveals the loved flag (8.3). |
| Raise Mourners | Necromancer perk, once: cheapness -2.5, mood +1 (8.3). |
| Done | Section 3.7. |

**Walkouts** keep Classic's consequences: the TV report and a random rival gets the body and `5 + random(5)` BP, applied at once (10.2). Expanded adds: word of mouth -2, the family remembers "walked", and the special's `onWalkout`.

### 3.5 Tells

Hidden facts the player reads from text (answers F4: reading becomes a skill). Tells are always truthful lines from `content.tells`: `loved`/`notLoved`, `cheapLow` (cheapness below 3.5), `cheapMid`, `cheapHigh` (above 6.5), and `limitHigh`/`limitLow` (which half of the current estimate holds the limit; the estimate then halves, keeping the limit inside, on the grid). On arrival one of loved or cheapness is told for free (50/50); psych may tell the other (3.6); Listen and Bless tell the rest. The Classic mood words, which already differ by the loved flag, are kept. Behaviours are tells too: Listen calms the loved and bores the rest.

### 3.6 The estimate and psychology (answers F1, F2)

- The limit is never printed. The estimate's half-width is `(0.08 + 0.32 x 0.78^psych) x limit` (psych capped at internal level 7, shown as "Level 8"), at least $100 wide, times trait `estimate` effects: 40% at psych 0, 27% at 2, 20% at 4, 15% at 6, 14% at 7. Each level buys less than the one before.
- The true limit sits at a uniform random point inside, so the middle is not the answer; the bounds are widened outward to the $50 grid; the low bound is never below the price of the casket asked for.
- Psych also: shows resistance with chance `10 + 10 x psych` percent; gives a free second tell with chance `10 x psych` percent (at most 70); takes `0.35 x psych` off cheapness and `0.1 x psych` off mood on arrival (Classic's halving, tamed and capped).
- Classic's "double the limit" is gone.
- The cost is `4 + 4 x level` gold (Classic: `4 + 2 x level`), and Spirit University refuses past the cap.
- The meaningful alternatives to psych: Listen (information for patience, in every negotiation), the rating (richer customers), and karma perks.

### 3.7 Scoring (answers F1, F3)

- Base BP = `int(bill x 0.0064)` as in Classic, times the `sale.bpMult` modifier.
- Closeness bonus, a share of the sale's own base BP, so it grows with the customer and with skill: exactly at the limit `ceil(0.5 x base) + 12` ("PERFECT", and a front-page item); within 3% under the limit `ceil(0.3 x base)` ("GREAT"); within 8% `ceil(0.15 x base)` ("NICE"); otherwise nothing, and the screen says roughly how much was left on the table and what earns a bonus. Classic's flat +25/+35 were a quarter of a good seller's sale BP whatever the sale; Classic's +200 exact bonus was worth six sales.
- The exact match is reachable by skill: every limit and every price (caskets at any markup, items, packages, cremation, discounts) is a multiple of $50. Classic limits were any dollar against $50-step items, so only one limit in fifty could be hit at all.
- The rule is explained on every negotiation screen (`status`) and on the Done screen.
- Underdog (9.4) and Peace Pledge insurance (9.3) apply after the bonus. BP = base + bonus + underdog - insurance.
- Also: +1 tag of the casket tier (wood on cremation), +1 plot for a burial that is not a pet, premium plot income (6.4), money (6.1), the family's memory (happy if mood below 4: word of mouth +1; sour at 7 or more: -1), the special's rewards, a pre-need future payment, the TV for sales over 69 BP or a `tvAlways` special, and a body-preparation choice 40% of the time (8.2).

### 3.8 Special customers and families

Specials are content (`SpecialCustomerDef`): weight, `minDay`, a fixed person or a generated one, portrait, intro, `incomeAtLeast`, forced traits, `effects`, and rule switches: `noWalkout`, `casketPriceMult`, `pet` (species list; no plot, no headstone, no plot income), `selfFuneral`, `tvAlways`, `onHappy`/`onDone`/`onWalkout` rewards, `future` (pays `bpShare` of the sale's base BP and money again in `minDays` to `maxDays`), and `offer` (no negotiation: two buttons, each a reward). Starter set:

| Special | Rules and rewards |
|---|---|
| Mob Boss (Vincent Morticelli, day 3+) | Super rich, limit x1.5, Guilt useless, cheapness -1. Never walks: at mood 10 he threatens, -25 BP, -1 karma, nobody gets the body. Happy: +2 gold, police protection tonight, -2 karma; any sale -1 karma. |
| Celebrity (Crystal Vance) | Rich or better, Show-Off, always on TV. Happy: +6 word of mouth; walkout -8 and a clip on TV. |
| Pet Funeral | Caskets at 1/4, loved, Sympathy x1.5, Guilt x2 (careful), cheapness -1, no plot. Happy: +1 karma, +1 word of mouth. |
| Pre-Need Planner | Buys their own funeral; cheapness +1, patience +3, Sympathy and Guilt x0.5. Pays half the sale again in 2 to 6 days. |
| The Widow Black (day 2+) | Super rich, limit x1.3, not loved, Guilt useless, patience +2. Happy: +2 word of mouth. |
| County Contract | Offer: take John Doe (+8 BP, +$300, +2 karma) or turn it down (-1 karma). |
| Cousin Sal (day 2+) | Offer: take the cash (+$2,500, +5 BP, -4 karma) or call the police (+3 karma, +2 word of mouth). |
| Old Man Withers | Plans his own funeral; cheapness +3, patience +6, limit x0.6. Happy: +5 word of mouth. |

**Repeat families**: every ordinary customer's family is remembered as happy, ok, sour or walked (30 families per parlor). Special customers are never remembered, whether they buy or walk out (a walked-out Mayor used to come back as an ordinary customer surnamed "Mayor"). 20% of later customers are a family the parlor knows, with the arrival effects of 3.1 and a line saying why they came back.

### 3.9 Leaving mid-sale

As Classic (`online_util.cpp:123-133`): the sale completes with the same bonuses and is mailed ("You fainted..."). An unanswered offer is declined. Implemented through `LocationModule.sessionEnd`.

## 4. The soft-sell hand (answers F3)

Soft Sell shows a hand of cards (`group: "hand"`, price in `detail`), drawn from `content.expanded.softSell` without items already in the hand, bought or refused, and only items for the current track. Hand size 3; 4 at luck 75 or more, 2 at luck 20 or less (luck matters, F7). Looking is free; Back returns with the hand kept (no free redraw). Pitching a card uses a patience; the card leaves the hand and one is drawn in its place. Refusal: `frandom(10) < cheapness + tag affinities` (Classic's test with traits); the item goes to `refused`, mood +0.4 to 1.1. Accepted if the bill still fits the limit; otherwise "over my limit" (mood +0.4 to 1.4, or a walkout above mood 9) and the item is not offered again. The bill can never pass the limit.

## 5. Packages

### 5.1 Package ladders

Structured upsells replace Classic's fixed upgrade list. A category (`PackageCategory`) has a track (`burial`, `cremation`, `any`), `noPet`, pitches, and tiers; tier 0 is free and included, each tier is dearer than the last, a tier may need an upgrade (shown disabled with a hint) and may add plot income. The Packages pane shows one card per category with its next tier and the price difference. Pitching is Classic's upgrade test (`frandom(10) < cheapness + affinities`, or cheapness above 8) with Classic's upgrade mood nudges; accepted if the difference fits.

| Category | Tiers (price) |
|---|---|
| Embalming (any) | none, Basic $400, Full Reconstruction $900, Air-Brushed $1,500 (embalming lab) |
| Flowers (any) | Single Carnation, Floral Arrangement $250, Wall of Lilies $800, Blanket of Black Roses $1,200 (florist cooler) |
| Plot (burial, not pets) | Standard, Forest Lawn $1,500 (+$10/day), Memorial Park $3,000 (+$25/day), Crypt (Lower Bunk) $5,000 (+$60/day, mausoleum) |
| Headstone (burial, not pets) | Wooden Cross, Granite $700, Giant $2,550, Naked Statue $4,000 |
| Urn (cremation) | Cardboard Box, Memorial Urn $400, Gold-Plated $1,200, Ashes Fired From a Cannon $2,500 |
| Service (any) | Ten Minutes of Silence, Organist $300, Gospel Choir $900, Celebrity Impersonator Eulogy $1,800 |

### 5.2 Cremation

With the incinerator, a Cremation button offers to cremate instead of bury (once per customer). Reluctance = `6 - 0.8 x cheapness + 2 if loved + cremation affinity`; refused if `frandom(10) < reluctance` (mood +0.6 to 1.6). Accepted: the casket line becomes Cremation $1,500, the tag is wood, burial-only items and packages are dropped, Hard Sell is disabled, the urn ladder opens, and a customer with cheapness above 5 relaxes (mood -1). If the new bill would pass the limit nothing changes but the mood (over-limit). Cremation is the tool for cheap, unloving and Eco-Minded customers who refuse caskets; it uses no stock and keeps $350 of the fee (6.1) but adds no plot.

## 6. Money (plan item B)

### 6.1 Money and tags

Tags stay what they were in Classic: one per funeral, the personal currency for Spirit University, hearses, security and Yang's, stealable and burnable, so the Classic town economy and its PvP keep their meaning. Money is the business's cash: earned from funerals and plots, spent on the parlor (stock, upgrades, upkeep). There is no conversion between them yet (the bank agent may add one). Justification: a single currency would make money the new psych (spend it on whatever compounds); two loops let a player choose between personal growth and the business without a spreadsheet, and give the Design Doc's caskets and plots a real job. Money never goes below 0; every money cost is checked first and shown disabled with a hint when it cannot be paid.

Per sale: `round(0.08 x (bill - casket line))` plus the casket margin: from stock, the casket's marked-up price (the stock was paid for at Di-Mart); without stock, a rush order at `wholesale x 1.3` paid out of the sale; cremation keeps `fee - wholesale(fee)`.

### 6.2 Casket stock

Di-Mart's Caskets shelf sells at wholesale `roundUp(0.75 x list price, $50)` ($600, $1,950, $4,000), x0.85 for evil karma (8.3), times the `store.stockPrice` modifier. One at a time, or Fill Up (wood, silver, gold in turn while there is room and cash). The storeroom holds 6, 18 with the storeroom upgrade. Counting what the stock cost, a sale from stock nets $180 / $585 / $1,200 more than a rush order at 0% markup. New parlors start with $2,000 and two wood caskets.

### 6.3 Markup

Set at the office: -10, 0, +10, +20 or +30%. Casket prices become `round(list x (1 + markup) / 50) x 50`. Each 10% above 0 adds 1 cheapness to Hard Sell tests and costs 4 rating (gives 4 at -10%); wanted caskets must still fit the limit. Trade-off: bigger bills with fewer actions versus harder sells and a worse reputation.

### 6.4 Plot income

Every plot pays $2 a day, premium plots more (5.1), paid at the player's new day (once, even after days away), times the `parlor.plotIncome` modifier.

## 7. The parlor

### 7.1 Rating

Computed, 0 to 100: `10 + upgrade ratings + hearse rating + min(15, floor(plots / 20)) + word of mouth (-20..20) + karma (85+: +5, 70+: +2, 30-: -2, 15-: -4) - 4 per 10% markup`. Word of mouth moves +1 per happy family, -1 per sour one, -2 per walkout, with prep choices, specials and arson, and fades 10% toward 0 each new day. The rating shifts the income roll (3.1) and picks the `ratings.txt` line shown at the office. Initial rating 10, as the Design Doc wanted.

### 7.2 Upgrades

Bought with money from the contractor at the office; each changes play.

| Upgrade | Price | Rating | Effect |
|---|---|---|---|
| Fresh Paint | $2,000 | +3 | Building level 1 |
| Coffee Machine | $3,000 | +1 | Coffee x1.5 |
| Guard Dog | $6,000 | | Security 1 (9.2) |
| Florist Cooler | $8,000 | +2 | Top flower tiers |
| Storeroom | $10,000 | | Stock 18 |
| Embalming Lab | $12,000 | +3 | Air-Brushed Embalming |
| Alarm System | $16,000 | | Security 2 (needs Guard Dog) |
| Viewing Room | $18,000 | +4 | Patience +2; building level (needs Paint) |
| Incinerator | $24,000 | +2 | Cremation track; sets `incinerator` |
| Night Watchman | $20,000 | +2 | Security 3 (needs Alarm) |
| Chapel | $50,000 | +8 | Income roll +15; building level (needs Viewing Room) |
| Mausoleum | $80,000 | +8 | Crypt plots; building level (needs Chapel) |
| Billboard on Route 9 | $14,000 | +2 | Income roll +10 (needs the Signage Permit, 18.1) |
| Memorial Garden | $30,000 | +6 | Patience +1 (needs the Zoning Variance) |
| Crematorium Annex | $60,000 | +4 | Income roll +8 (needs the Incinerator and the Crematory Emissions Permit) |

`UpgradeRule.permit` names the City Hall permit an upgrade needs; without it the card is disabled with "Needs a ... from City Hall". Upgrade prices are read through the `parlor.upgradePrice` modifier (an ordinance can discount them), rounded to $50.

Building level is the count of building upgrades: Shack, Fixer-Upper, Respectable, Chapel House, Colonial Mansion. The office shows the building at its stage, `places/parlor-1` (level 0, the Shack) to `places/parlor-5` (level 4, the Colonial Mansion), from the Remastered art pack (`parlorPicture`). The prices of the Night Watchman, the Billboard and the Memorial Garden were lowered in the engine pass (`docs/balance/expanded-tuning-log.md`, "Loose ends").

## 8. Karma

### 8.1 The axis

`karma` 1 (evil) to 100 (angelic), 50 at start, shown with its `karma.txt` line at the office and on the stats sheet, and in the HUD. It moves with body-preparation choices, Guilt on the loved (-1), discounts to the poor (+1), specials and offers, Dig for Goodies failures (-1). It affects customers (3.1), prices (6.2), events (prep choices by karma) and the rating (7.1).

### 8.2 Preparing the body

After 40% of sales (always for the practice customer; times the `prep.chance` modifier) the Done screen's only button is Prepare the Body: a choice from `content.prep` that fits the track and the player's karma. Each option has rewards; a dishonest one is marked `evil`; a gamble (`risk`) succeeds on `randomYesNo(luck, weight)` or applies its fail text and penalties (luck matters, F7). Options that cost money are disabled when the player cannot pay; perk-only options need the perk. Twelve starter choices, the Design Doc's ring first.

### 8.3 Perk paths

| Karma | Perk | Effects |
|---|---|---|
| 70+ | Trusted | Customers arrive with mood -0.8, cheapness -0.5; rating +2 (+5 at 85). |
| 85+ | Church Associate | Bless once per customer (8.1); rivals win half as much from you (sanctuary). |
| 30- | Grave Robber | Dishonest choices pay double money; Di-Mart's back-room price (x0.85); Dig for Goodies at the office: up to 2 a day (shared with robbing graves, 16.3), no turn, `randomYesNo(luck, 0.9)`: $200 to $900 or (1 in 5) a gold tag; failure costs 1 karma and 1 word of mouth. Rating -2. |
| 15- | Necromancer | Raise Mourners once per customer (cheapness -2.5, mood +1); +1 turn a day ("accidents"); your attack gains x1.25. Rating -4. |

Play styles: good is reputation (rating, richer and calmer customers, information, defence); evil is money, turns and intimidation (and aggression, for players who fight).

## 9. PvP and fairness (plan item E)

### 9.1 What a fight is worth (answers F6)

A winning attacker gains `min(95, floor(1.1 x sqrt(victim's total BP)))` times the multiplier, and the victim loses half of that (Classic: 2% and 1% of the total, without limit). A defender who wins gains the same curve on the attacker's total and the attacker loses half. Multipliers: both cutthroat x1.25; attacker Necromancer x1.25; victim Church Associate x0.5; victim security `x(1 - 0.15 x level)`. Examples: a 1,600 BP victim pays 44 to the attacker and loses 22; any victim over about 7,500 BP pays the cap.

### 9.2 Defence

Security levels 1 to 3 (Guard Dog, Alarm, Night Watchman) are bought with money, so non-fighters can buy them with the currency fights do not use. Each level: the defender's blows count +2 strength, the attacker's gain is 15% smaller, and 15% of prowlers are turned away at the door (the visit is used; the owner is told). Classic padlock, lockpick and safe stay; the safe now also guards the till.

### 9.3 Rivalry tiers

Chosen at the office, changeable once every 3 days. Standard is the default. Peace Pledge: cannot visit, cannot be visited (refused before a visit is used) or burned; costs 8% of every sale's base BP as insurance (shown on the Done screen; the text's `{tax}`). That is cheap for a leader (Classic leaders lost about 7% of their daily BP to attacks) and dear for a parlor nobody targets. Cutthroat: one more visit a day; fights between cutthroat parlors pay a quarter more.

### 9.4 Underdogs and caps

- Underdog: a parlor below 70% of the leader's total gains `min(25%, 50% x (1 - mine / leader))` of each sale's base BP extra. A parlor created after day 1 of a season (a late starter) uses `min(150%, 300% x (1 - mine / leader))` below 98% of the leader instead, whichever is higher (`underdog.late`): established parlors that trail keep the mild rule, so the field is not flattened, and a newcomer can reach the middle of the table.
- Caps (the Design Doc's "set maximums for HP and strength"): psych internal level 7, max HP 60, strength 15. Spirit University refuses past them and charges nothing.

### 9.5 Hearses (answers F2)

Same gold prices; bonus turns 1, 2, 2, 3 (Classic 2, 4, 7, 10); daily upkeep $150, $400, $800, $1,500 paid at the new day, or the hearse stays in the garage and gives no bonus turns that day; rating +1, +3, +5, +8. The Classic re-buy fix stays.

### 9.6 Arson and theft (answers F7)

Arson keeps Classic's price (6 gold) and smoke detector (80% saved, 3 gold to the target), but now also burns half the caskets in stock (rounded up) and 5 word of mouth, on top of 5% of plots and the wood tags (a safe saves the tags). Peace Pledge parlors cannot be targeted. Theft takes up to 4 tags (Classic 3) and, without a safe, 5% of the victim's cash up to $1,500.

## 10. Quality of life (plan item F)

### 10.1 The new day

On the first desk visit of a game day, after Classic's `base_new_day`, in order: up to 15 unused turns from the last day played carry over (not for a brand-new player or on the tournament's last day); Grave Robber/Necromancer turns; plot income; hearse upkeep; pre-need payments due; word of mouth fades; the rating is recomputed; then every `PlayerNewDayHook`. The morning screen lists each.

### 10.2 Rewards apply at once

`mailRewardsOnDelivery: false`: luck, BP and turn rewards (top seller, top parlors, the news blurb's gift, a walkout's rival) apply when sent, and the mail only reports them. A Continue stop with nothing read since the previous one (the news blurb's gift mail starts with one, maint.cpp:33-95) is skipped instead of showing an empty message with only OK. This now holds in Classic too: the empty overlay was the remaster's conversion of mail into overlays, not original behaviour (the Flash client showed the desk with a Continue button), so the Classic transcripts were re-recorded with exactly those overlays removed (1.3).

### 10.3 New players are never deleted in their first week

`zeroBpGraceDays` 7: a player with 0 BP is safe for 7 midnights after the day the account was made, and the inactivity rule (15 days) cannot reach them in that time.

### 10.4 The guided first day

A new player's morning screen has one button, to the tour: six pages by the new-user clerk (`ui/new-user-clerk`), ordinary location views with Next and Skip Tour, the page count in `note`. The last page meets a practice customer: no event, risk or script, average income, loved, calm, Sentimental, a sure prep choice; every screen of that negotiation carries a hint in `note` (impatience overrides). After the sale the desk shows the clerk's last words and the tour is done. A player who skips gets the normal game at once; a practice customer who walks out is followed by another.

## 11. Presenting it (for the client)

### 11.1 HUD and stats

`Hud.money`, `Hud.karma`, `Hud.rating` are present for Expanded players only. The stats sheet adds karma (with title), parlor level, stock, markup, rivalry, plot income a day, perks, and sales/walkouts; rating shows the number and title.

### 11.2 The negotiation screen

- Main row (buttons without `group`): Guilt, Sympathy, Hard Sell, Soft Sell, Done, in Classic's order and slots. At most five, as Classic.
- Secondary row (`group: "more"`): Packages, Coffee, Listen, Discount, then Cremation, Bless, Raise Mourners when available. Draw it under the main row, smaller. Discount carries its amount in `detail`.
- Disabled buttons (`enabled: false`) stay visible with `hint` as a tooltip; never hide them, so the player learns what exists.
- The customer panel: name, deceased, traits as chips with `hint` tooltips, the estimate as a range bar with the bill marked on it, patience as pips, special as a badge, `notes` as a "What you know" list, the bill as a receipt.
- `status` explains the bonus rule; `note` carries the tutorial hint.

### 11.3 Cards

Soft Sell and Packages switch the button set to cards (`group: "hand"`, price in `detail`) plus one Back button. Draw cards as a row above the main row; a disabled card shows its `hint` ("Your parlor can't offer this yet"). The same `group: "hand"` is used for upgrades, markup and rivalry choices at the office and Di-Mart's casket shelf.

### 11.4 Other screens

The office uses the parlor drawing at its stage (`places/parlor-1` to `-5`) over `places/palors`, the markup screen `people/store_guy` over `places/parlor-office`; body preparation uses the event's picture over `places/embalming-room`, and an event without a picture one of `places/prep-table`, `places/prep-cosmetics`, `places/prep-viewing` (chosen from the event id, so always the same one, `prepPicture`); the tour uses `ui/new-user-clerk` over `places/desk`. Every other screen is a Classic template.

### 11.5 Structured panels (facts as data)

Each Expanded screen also sends its facts as typed fields (`packages/protocol/src/view.ts`), so the client draws them without reading prose or mirroring rules. All are optional and additive: `text`, `note` and the button `detail`/`hint` still say everything, for older clients. Every builder only reads state. Tested by a property walk (`test/panels.test.ts`: every panel on every view of random and exercise play agrees with the town) and focused checks.

- **Every Expanded view (a view hook, `decorateExpandedView`):** `Hud.debt.daysLeft` (days after today until the due day; 0 = due today), `Hud.injuryList: InjuryRow[]` when `Hud.injuries` > 0 (`id`, `name`, `text`, `daysLeft`, `hp`, `patience`, `turns`, `treatPrice` today), `Hud.karmaPath: KarmaBand` (`id` necromancer / grave-robber / neutral / trusted / church-associate, `name`, `min`, `max`). Draw the debt countdown and the injury list from these; no screen needs the game day. The hook is `Registry.onView` (12.3); Classic registers none.
- **`View.karmaScale: KarmaBand[]`** (office summary, body preparation): the five bands from 1 to 100, from the rules (8.3). Draw the karma axis from it instead of a copy of the thresholds.
- **`View.office: OfficePanel`** (every office screen): `level`, `levelName`, `levelNames`, `stock {wood, silver, gold, capacity}`, `markup`, `markupOptions`, `rivalry`, `rivalryName`, `rivalryWait` (days before it can change), `security`, and `upgrades: UpgradeRow[]` with every upgrade, owned ones included: `id`, `name`, `description`, `price` (today's), `rating`, `building`, `state` (`owned`, `available`, `unaffordable`, `locked`), `reason` (the engine's words), `requires [{kind: "upgrade" | "permit", id, name, have}]`, `buttonId` (absent when owned). Draw the contractor's list from `upgrades` (owned ones shown as owned, not vanishing); the buy cards are unchanged.
- **`View.bingo: BingoPanel`** (the bingo screen): `open`, `pot` (tonight, carry included), `carry`, `price`, `cards`, `sold`, `taken` (card numbers sold), `mine`, `maxPerPlayer`, `nextFree`, `drawDay`, `daysLeft` (0 = drawn tonight).
- **`View.ballots: BallotPanel`** (every City Hall screen): `inForce {id, title, effect, until, daysLeft}`; `ordinance {closes, daysLeft, options: BallotOption[], myVote, myWeight, lobby {price, max, bought}}` with each option's `id`, `title`, `text`, `effect`, `votes` (votes are public under these rules), `mine`, `buttonId`; `election {phase, filingUntil, votingUntil, seasonDay, daysLeft, fee, ads {price, max, mine}, filed, candidates [{playerId, name, ads, votes?, mine, me, buttonId?}], mayor}`.
- **`Button.selected`**: the player's current choice among cards: the ballot option or candidate voted for (its hint is now `hints.yourVote`, "Your vote", not "Already have it"), the markup in use and the rivalry tier. Draw it as chosen; it stays disabled, since choosing it again does nothing.
- **`View.bank: BankPanel`** (every Expanded bank screen): `savings`, `savingsRate`, `savingsCap`, `interestTonight`, `canDeposit`; `loan {limit, rate, fee, termDays, dueIfTaken, canBorrow, reason?, owed?, due?, daysLeft?}`; `transfers {sent, received, dailyMax, feeShare, values [wood, silver, gold in wood], canSend, reason?}`.
- **`View.club: ClubPanel`** (every club screen): `cover`, `inside`, `staked`, `stakeMax`, `stakes`, and on the screen right after a round `lastRound {game, stake, outcome ("win" more back than staked, "push" some or all back, "lose" nothing back), payout, net}`. The banner should use `lastRound`, not the first paragraph's words.
- **`CustomerPanel.bands`** (the negotiation): `[{key: "exact", within: 0}, {key: "great", within: 0.03}, {key: "nice", within: 0.08}]` from `scoring.tiers`, so the gauge needs no copy of the bonus rule. **`CustomerPanel.haggle: false`** marks a flat offer (a special with an `offer`: the County Contract, Cousin Sal): draw no estimate gauge, and it has no `bands`.
- **`View.prep: PrepPanel`** (body preparation): `choices [{buttonId, effects: RewardFacts, evil, risk? {chance, fail: RewardFacts}}]`. `effects.karma` is the karma direction and size (money already doubled for a Grave Robber's dishonest choice); `risk.chance` is the percent `randomYesNo(luck, weight)` succeeds with today. Sort and draw the moral choice from these instead of parsing `detail`.
- **`View.tutorial: TutorialPanel`**: on a tour page `{page, pages, speaker}`; on a practice-sale screen `{hint, speaker}` with the hint as RichText without its "Clerk:" tag. `note` still carries "3 / 6" and "Clerk: ..." for older clients.
- **`TownPanel.ordinance.daysLeft`** and **`TownPanel.ballots[].daysLeft`** (desk and map strip).

## 12. Extension points

### 12.1 Adding a location (locations agent)

Write a `LocationModule` in `packages/core/src/expanded/modules/<name>.ts`, register it in `createExpandedRegistry()` and add its place to `EXPANDED_PLACES` (`expanded/registry.ts`). To change a Classic place, wrap it as `expanded/modules/town.ts` does (spread the Classic module, handle new commands, delegate the rest). Read and write Expanded state through `xp(turn)` (player), `xcust(c)` (customer), `xr(turn)` (rules) and `xc(turn)` (content); apply rewards with `applyReward(turn, player, reward)` (immediate, clamped); recompute the rating with `refreshRating(rules, player)` after anything that changes its parts. Money costs must be checked before they are shown enabled. The graveyard should read `plots`, `expanded.plotIncome` and the plot tiers; City Hall votes and the Reaper Club should add modifiers (12.2) and rewards; hospital injuries can live in a new `ExpandedPlayer` field (add it with a default in `newExpandedPlayer` and in `ensureExpanded`, which upgrades old saves).

### 12.2 Rule modifiers (news, weather, arcs)

`addModifier(town, { key, op: "add" | "mul", value, untilDay, source })`; `modValue(town, key, base)` applies live ones (adds, then multiplies); `pruneModifiers` runs at midnight. Keys read today (`MODIFIER_KEYS`): `wait.eventOdds`, `wait.riskOdds`, `wait.scriptOdds`, `customer.limitMult`, `customer.mood`, `customer.cheapness`, `customer.incomeShift`, `customer.specialChance`, `store.stockPrice`, `sale.bpMult`, `parlor.plotIncome`, `prep.chance`. The town adds the `TOWN_MODIFIER_KEYS` of section 22.1 (`turns.daily`, `customer.patience`, `pvp.gainMult`, and one or more per place). The Design Doc's examples map directly: "20% off gold coffins" is `store.stockPrice` (or a new tier-specific key), an earthquake is `wait.eventOdds` x0.5 plus `customer.limitMult`. A new key needs one `modValue` call where the number is read.

### 12.3 Hooks

`Registry.onMaintenance(hook)` (end of every midnight, town stream: daily news, weather, arcs, elections), `onPlayerNewDay(hook)` (returns morning text: weather on the morning screen, injuries healing), `onPlayerCreated(hook)`, `onView(hook)` (decorates every view a player is sent, before it is stored; must not change the town; the Expanded registry's adds the HUD panels of 11.5, Classic registers none), and `LocationModule.sessionEnd`. Hooks draw from the stream of the turn they get. The town registers `townMidnight` and `townMorning` (22.4); `LocationModule.sessionEnd` is now also called for the scene a player leaves when no sale is open (16.4).

### 12.4 Negotiation

New actions go in `expandedNegotiationModule.press` and `mainButtons` (put them in the "more" row). New effect keys go in `CustomerEffects` and are read with `multOf`/`sumOf`/`affinityOf`. New special-customer switches go in `SpecialCustomerDef` and are read in `generateCustomer`, `settleSale` or `walkOutX`.

## 13. Content

### 13.1 Tables (`ContentPack.expanded: ExpandedContent`)

`names` (male, female, surnames, pets), `traits`, `backstories` and `backstoryBits` (jobs, hobbies, places), `tells`, `specials`, `softSell` (Classic `SaleItem` plus `tags` and optional `track`), `packages`, `cremation`, `prep`, `upgrades` (name and description by upgrade id), `text` (every Expanded string, `ExpandedText`). The starter set (`EXPANDED_STARTER`): 15 male and 15 female first names, 30 surnames, 8 pet names, 12 traits, 10 backstories, 25 tells, 8 specials, 40 soft-sell items, 6 package ladders, 12 prep choices, 15 extra pitch lines for every action (Soft Sell, Hard Sell split by casket, Guilt, Sympathy, Coffee, Listen, Discount, Packages) added to Classic's pools, and the tour.

### 13.2 Placeholders

Classic's (`{cHe}`, `{dRelation}`, `{dSmashed}`, `{dFridge}`, ...) plus `{cName}`, `{cFirst}`, `{surname}`, `{dFirst}`, `{dHis}`, `{customer}` (speaker tag with the name), `{customerName}` (the name in white), `{aFridge}`/`{AFridge}` (with the right article), `{pet}`, `{casket}`, `{player}`, and per-line ones listed on each field. Capitalised pronouns (`{dHeCap}`) start sentences.

### 13.3 Text rules

Legacy markup with backtick colours, never HTML; pictures are manifest ids; any number of alternatives. Content-defined mechanics (trait effects, specials, item prices and tags) are data writers may vary; ruleset balance numbers are in `ExpandedRules`.

### 13.4 Checking a pack

`checkExpandedContent(content, EXPANDED)` returns problems (and, when the pack has a `town` section, those of `checkTownContent`, 25.3): missing lists, duplicate or unknown ids, prices off the $50 grid, package tier 0 not free or tiers not getting dearer, unknown upgrade requirements, upgrades without names, prep events with fewer than two options. The starter passes (tested). `@fq/content` accepts an optional `expanded` object and leaves it to this check.

## 14. Verification

Section 27 covers the town's tests; the list below is the foundation's.

`pnpm --filter @fq/core test` (35 files, 411 tests):

- `classicRegression` (1.3).
- `expandedFormulas`: limit grid, estimate width and containment (3,000 draws), narrowing, base BP, closeness tiers and grid reachability, markup and wholesale, rating parts, perk thresholds, PvP curve and cap, underdog share, modifiers.
- `expandedNegotiation`, `expandedSpecials`, `expandedParlor`: every action and its limits, the hand, packages and cremation, Done and money, prep, families, walkouts, specials, mid-sale log-off, new day, banking, upkeep, plot income, futures, grace, Di-Mart, upgrades, markup, perks, PvP formulas, Peace Pledge, cutthroat visits, security at the door, caps, arson, the tour, immediate rewards, modifiers, Classic isolation, content checks.
- `expandedSim`: 6 seeds x 4 players x 4 days of random play and 4 seeds x 3 players x 4 days of an exercise player that favours every new action (with money and karma extremes so perks and upgrades come up), checking after every action: no negative money, tags, turns, BP, HP, plots or stock; karma, luck, rating and caps in range; the estimate contains the limit; the bill never passes the limit; the hand has no repeats; every enabled button is accepted (checked on a copy every 7 actions); disabled buttons have hints; no enabled upgrade or casket costs more than the cash; a save taken every 23 actions plays on identically; no rejected action; every new action, prep option, upgrade and package was reached.
- `expandedBalance`: section 15 (quick 2-town version by default).

## 15. Balance sanity

Scripted View-only seats (`test/support/xpolicy.ts`) in shared 7-parlor towns, seat slots rotated per town, 8 towns x 29 days (`BALANCE_FULL=1 pnpm --filter @fq/core test expandedBalance`). All seats but `random` use the same "reader" negotiation: it reads loved from tell lines, the mood word and Bless; nudges with Sympathy or Guilt; Listens once on wide estimates; uses Coffee and Discount on angry customers; picks the dearest card that fits under the estimate's top (lowered when a customer says "over my limit"); tries Hard Sell and cremation; stops when nothing fits. `random` presses any enabled button and Done 15% of the time. Spending: `reader` and `random` buy nothing; `psych-only` all gold into psych; `hearse-only` all gold into hearses; `balanced` psych to 3, hearse to 3, stock, and upgrades with money; `good` and `evil` are balanced with honest or dishonest prep choices, offers and perk actions (evil digs while under $20,000).

| seat | final BP | BP day 10 | wins of 8 | sales | walkouts | exact | bonus share | rating | karma | psych | hearse | upgrades | cash |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| reader | 11,650 | 3,692 | 0 | 434 | 1.4 | 15.3 | 9.6% | 36 | 94 | 0 | 0 | 0 | 81,992 |
| random | 6,424 | 1,842 | 0 | 308 | 156.5 | 4.0 | 3.7% | 2 | 8 | 0 | 0 | 0 | 54,289 |
| psych-only | 12,276 | 3,789 | 0 | 439 | 0.8 | 18.9 | 11.1% | 34 | 60 | 7 | 0 | 0 | 93,346 |
| hearse-only | 13,364 | 4,094 | 0 | 508 | 1.3 | 18.6 | 10.0% | 37 | 86 | 0 | 4 | 0 | 67,084 |
| balanced | 14,254 | 4,404 | 1 | 494 | 0.9 | 18.6 | 10.0% | 52 | 41 | 3 | 3 | 9.9 | 53,117 |
| good karma | 15,123 | 4,679 | 5 | 487 | 0.3 | 19.5 | 10.2% | 77 | 100 | 3 | 3 | 9.3 | 55,378 |
| evil karma | 14,741 | 4,329 | 2 | 511 | 1.4 | 15.1 | 8.4% | 40 | 1 | 3 | 3 | 10.0 | 159,243 |

This table was re-run with the living town of section 22 in play (daily news, weather and story arcs change the rules every day; the seats visit none of the new places). The figures before the town existed were: reader 11,216, random 6,559, psych-only 12,337, hearse-only 13,136, balanced 13,942, good 14,396, evil 14,415 final BP, with the same three claims holding. Section 28 adds the town's money sinks.

- **(a) Skill beats button-mashing.** The reader earns 1.81x the random presser with the same (no) spending, and loses 1.4 customers where the random loses 157 (a third of its customers). Exact matches: 3.5% of the reader's sales (4.3% with psych 7), 1.3% at random (Classic: 0.6%, 0.8% even for the oracle). Closeness bonuses are 8 to 11% of a good seller's sale BP (Classic: about 25%).
- **(b) No single-stat engine.** Psych-only finishes 13.9% behind balanced and hearse-only 6.2% behind; balanced leads both on day 10 and at the end. In Classic all 200 towns went to the hearse-plus-psych builds.
- **(c) Both karma paths are viable.** Good finishes 2.6% ahead of evil, 6.1% and 3.4% ahead of neutral balanced, and they win 5 and 2 of 8 towns (before the living town: within 0.2%, 2 and 4 wins). Good gets there through rating 77 (richer, calmer customers), evil through extra turns and cheap stock, with three times the cash; the news's extra turns help everyone, so evil's turn advantage counts for a little less.

The table above and the three claims come from the numbers before the simulator tuning; `expandedBalance` re-checks the claims with the tuned numbers and they still hold.

### The simulator baseline (tuned)

The numbers in this document are now tuned against whole seasons of the `@fq/bots` personalities (twelve committed strategies that play the Expanded game from Views alone and the public rule book of the content pack, `packages/bots/src/expanded/`) in `tools/sim --rules expanded`: 200 towns of 8 for 30 days with `expandedPack`, plus mixed-difficulty, late-joiner, oracle and no-fighter comparisons. Every round is in `docs/balance/expanded-tuning-log.md`. In short: mean final BP by personality within -6% / +6% of the field and the karma paths within 4.4% (Classic's spread was 21,843 to 36,074); hard bots 15% ahead of easy ones of the same personality, 2.6 times the luck spread; the leader at 1.11x the median; the most-targeted parlor that never fights loses 4.6% of its season; nothing mints money, tags or BP.

### What remains to tune

- **Win shares.** In a field this tight the steady sellers rarely win unless their mean is ahead, and the fighters win more than their mean deserves because PvP makes their seasons swing: necromancer 2.75x and tycoon 2.54x their fair share, scholar, organiser, gambler, builder and Soft Touch below a third. The levers are PvP variance (smaller, more frequent stakes) and the personalities' own habits; see the baseline's reading.
- **Walkouts.** Bots almost never let a customer walk (0.06% of customers). Mood pacing, patience and the generosity of Coffee and Discount need human play.
- **The exact match** lands on a quarter of a careful seller's sales and the closeness bonuses are a quarter of sale BP; that rewards reading, but pinning the limit with small cards is the grindiest play there is. Playtest whether it feels like skill or chores.
- **Numbers the bots exercise but cannot judge:** trait strengths and tell frequency (bots read tells perfectly at hard), special customers' rewards, the content's prep choices (karma still moves fast: both paths reach their second perk within a few days), hearse upkeep.

## 16. The Town Graveyard (plan item C)

The authors' cut "Town Graveyards" (legacy/source/Design Doc.txt: "A dense fog covers the many mounds and headstones... Attack, Look around, Leave... First attack is decided by who has more plots. Fall into a grave. Power bars upper left with names"). Module `graveyard` (`expanded/town/graveyard.ts`), place `graveyard`. Main row: Monuments, Challenge a Rival, Leave; `more` row: Tend the Graves, Rob a Fresh Grave, Look Around. The intro shows the parlor's plots, its monument and duels left today.

### 16.1 Monuments (the holding, and a money sink)

Bought in order with money; each pays BP once, on purchase, and adds rating while it stands (7.1).

| Tier | Name (starter) | Price | BP | Rating | BP per $1,000 |
|---|---|---|---|---|---|
| 1 | A Tasteful Granite Bench | $3,000 | 60 | +1 | 20 |
| 2 | The Weeping Angel (Slightly Cross-Eyed) | $8,000 | 130 | +1 | 16 |
| 3 | A Marble Obelisk With Your Name On It | $20,000 | 260 | +2 | 13 |
| 4 | The Eternal Flame (Gas Bill Included) | $45,000 | 340 | +2 | 7.6 |
| 5 | A Bronze Statue of Yourself, Pointing at Something Important | $90,000 | 420 | +3 | 4.7 |

The Expanded pack names the tiers: 1. A Granite Bench With Your Name on the Seat; 2. The Weeping Angel (Slightly Cross-Eyed); 3. A Marble Obelisk You Can See From Blaine; 4. The Eternal Flame (Gas Bill Included); 5. A Bronze Statue of You, One Foot Taller Than the Mayor's.

All five: $166,000 for 1,210 BP and +9 rating. Each tier buys less per dollar than the one before, so money keeps a use to the end of the season without becoming the best way to score: a good seller makes 30 to 60 BP a sale.

### 16.2 Tending the graves (the peaceful use)

Karma 70 or more (Trusted), no turn, at most 2 a day: `+randomRange(1, 3)` luck, +1 word of mouth (+1 more for a Church Associate), and 30% of the time a mourner leaves a customer lead (19.2), if the player holds fewer than 3.

### 16.3 Robbing a fresh grave (the low-karma use)

Karma 30 or less (Grave Robber), no turn, sharing the office dig's limit (`daily.dug`, 2 a day, 8.3). Success on `randomYesNo(luck + graveyard.robLuck, 0.75)` (50% at luck 50; fog adds 15 luck): one time in four a silver tag, otherwise `$500` to `$2,000` on the $50 grid. Failure: a fine of `min(cash, $1,000)`, -2 karma, -2 word of mouth and the Dog Bite injury. It pays more than the office dig and risks more.

### 16.4 Graveyard duels (the second PvP venue)

Rules that differ from the parlor fight (section 9):

- 1 duel a day started (1 turn); a player can lose at most 2 duels to challengers a day.
- Anyone may be challenged, online or not, except: yourself, Peace Pledge parlors (either side), chain-mates (23.3), a rival beaten twice today, a sheltered chain (23.3), and nobody while an ordinance closes the graveyard (`graveyard.duels` 0).
- Hit points: each side starts at `hpMax - injury hp` (19.1), at least 1. No home advantage: security upgrades do not count here.
- First strike: the side with more plots (ties go to the rival, as in Classic).
- Each exchange the player picks:
  - **Swing**: a blow of `trunc(frandom((strength + 1) / 2) + (strength + 1) / 2)`, a miss one time in 20; then the rival moves.
  - **Shove**: succeeds with `clamp(25 + 5 x (my strength - his strength), 10, 60)` percent. The other falls into an open grave for `randomRange(1, 4)` damage, the shover gets a free swing while they climb out, and **the shoved side loses their next move**: after a shove that lands the rival does not move this exchange. A failed shove gives the rival a free swing, then the rival moves. The button's `detail` shows the chance.
  - **Yield**: the duel ends; the yielder loses half of what a loss would cost and is not hurt; the rival gains half the stake.
- The rival's move: a shove 15% of the time (same formula), otherwise a swing. A rival's shove that lands costs the player their next move the same way: the rival swings at once, and again for the lost move.
- Why (engine pass): under the old rule a shove that landed still let the rival move, so it bought only 1 to 4 damage and Swing was always at least as good (the simulator's finding, 28). Denying the move makes Shove the right play when the player is stronger but one blow from defeat. `rules.town.graveyard.duel.shoveCostsMove` (true) holds the rule; `test/duelShove.test.ts` plays three positions 600 times each through the engine under "always Swing", "always Shove" and "Yield now" and scores the challenger's mean BP change (equal BP, so a win pays +40, a loss -20, a yield -10):

| Position | Swing | Shove | Yield | Best |
|---|---|---|---|---|
| Even (strength 10 v 10), both at 40 HP | +27.6 | -16.3 | -10 | Swing |
| Strong but nearly beaten (15 v 5, 3 HP v 20 HP) | -11.0 | +1.1 | -10 | Shove |
| Weak and beaten (5 v 15, 3 HP v 40 HP) | -20 | -20 | -10 | Yield |
| Old rule: even / strong but nearly beaten / weak | +29.9 / -11.0 / -20 | -18.7 / -14.2 / -20 | -10 | Shove never beats Swing |
- The stake: the winner gains `floor(pvpGain(loser BP) x 0.75 x multipliers)` (9.1), the loser loses half of that and gets an injury (Sprained Ankle or Cracked Skull, at random). Multipliers: both cutthroat x1.25, winner Necromancer x1.25, loser Church Associate x0.5, the `pvp.gainMult` modifier. Security does not reduce it.
- The rival is mailed, the crime page reports it ("GRAVEYARD BRAWL"), a beaten rival counts toward their chain's shelter.
- Logging off mid-duel yields (`sessionEnd`).

The client shows `View.battle` (the "power bars upper left with names") with Swing, Shove and Yield, then Continue.

## 17. The church (Father Smyth)

Module `church` (`expanded/town/church.ts`) replaces the Classic church script in Expanded towns. Main row: Bingo Night, Confession; `more`: Holy Water, Lead the Service, Tithe, story appeals (22.3).

### 17.1 Bingo Night (a shared town event)

From the original scripting docs (legacy/dist/fqhelp/scripting.htm, "Bingo: each card costs 1 wood tag, player can buy up to 6, there are 12 cards out there, randomly select 1 of the 12, jackpot is 12 wood tags"), made a town event:

- Every game day is a bingo night with 12 numbered cards for the whole town. A card costs 1 wood tag; a player holds at most 6. Buy 1 or Buy 3 (lowest free numbers).
- At midnight one card in 12 is drawn (`random(12)`, town stream). Its owner takes the pot; if nobody bought it the pot carries to the next night.
- Pot = `floor(paid cards x (1 - cut)) + carry`, cut 10% (`church.bingoCut` multiplies it; the Sin Tax ordinance sets it to 0). A full night pays 10 tags.
- A Church Associate's first card each night is free (it is not added to the pot).
- `church.bingo` 0 cancels bingo night (the paved-church ending of 22.3).
- The winner is mailed and named in the Funeral Times; a carry is announced.
- Tags only move between players, the carry and the church's cut, so bingo never mints tags (tested across nights: town tags plus the carry fall by exactly the cut). A card's expected value is below its price unless a carry has built up, like any lottery rollover.

### 17.2 Confession (buying back karma)

While karma is below 60: +1 karma per confession, at `$400 + $200 x confessions today` (400, 600, 800, 1,000, 1,200), at most 5 a day. Money buys back from evil toward neutral but never into the Trusted perk (70); that must be earned.

### 17.3 Holy water (blessings for everyone)

Karma 50 or more, $600 a bottle, at most 3 held. In a negotiation the Bless action (8.3) is offered to anyone holding a bottle; a non-Associate's Bless uses one. Church Associates bless for free as before.

### 17.4 Lead the Service (the Church Associate's)

Church Associate only, 1 turn, once a day: `20 + floor(rating / 4)` BP and +3 word of mouth (about a customer's worth).

### 17.5 Tithes (a money sink)

$1,000 a press, up to $10,000 a day: 8 BP per $1,000, x1.5 at karma 70 or more ("the faithful"), x0.5 at karma 30 or less ("blood money"). Below the monuments' rates, so monuments come first.

## 18. City Hall (the Mayor)

Module `city-hall` (`expanded/town/cityHall.ts`), place `city-hall`. Main row: Permits, Ordinance Vote, Mayoral Election, Parlor Chains, Leave; `more`: Health Inspection and story appeals. The greeting names the Mayor (the elected player, or the content's NPC "Mayor Wilma Boggs").

### 18.1 Permits

| Permit | Price | Unlocks |
|---|---|---|
| Signage Permit | $1,500 | Billboard on Route 9 |
| Zoning Variance | $4,000 | Memorial Garden |
| Crematory Emissions Permit | $6,000 | Crematorium Annex |

Prices go through `city.permitPrice` (the Tax Holiday halves them). The black market sells a Forged Permit (20.3). Permits are kept for the season.

### 18.2 Inspections

Each midnight the inspector calls on one random parlor that owns at least one upgrade. It passes when certified (`certifiedUntil >= day`) or on `random(100) < clamp(30 + 0.5 x rating + 0.5 x (karma - 50), 10, 90)`: +1 word of mouth and a mail. A failure: a fine of `min($3,000, 5% of cash)`, -2 word of mouth, a mail and the crime page. Counterplay at City Hall: an inspection certificate ($1,000, 7 days, +1 word of mouth now) or, at karma 30 or less, an envelope ($500, -2 karma, 7 days).

### 18.3 The weekly ordinance vote

- A ballot of 3 ordinances (drawn from content) opens at the midnight starting day 1, 8, 15, 22 (every 7 days) when it can close inside the season, and closes after its 7th day.
- Each player votes once (the vote can be changed); the mayor's vote counts 2. A voter can lobby for the option they voted for: $2,500 per extra vote, at most 2 per ballot.
- At the midnight after the last day the most votes wins (ties drawn on the town stream); its modifiers are added for the next 7 days and the paper prints it. No votes: nothing passes ("COUNCIL DEADLOCKED").
- Ordinances are content. The Expanded pack (`ordinances.yaml`) has 26, each with the modifiers behind its `effect` line (checked against each other by hand and by the lint's key and range tables); the engine's starter has these six, which a pack with no `town` section gets:

| Ordinance | Effect (modifiers) |
|---|---|
| Raise the Speed Limit to 85 | `turns.daily` +1, `customer.limitMult` x0.95 |
| Open Carry for Morticians | `pvp.gainMult` x1.25 |
| Graveyard Quiet Hours | `graveyard.duels` x0, `graveyard.robLuck` -15, `customer.mood` -0.2 |
| Small Business Tax Holiday | `parlor.upgradePrice` x0.9, `city.permitPrice` x0.5 |
| Mandatory Embalming Act | `customer.limitMult` x1.05, `customer.cheapness` +0.3 |
| Sin Tax on Nightlife | `club.cover` +2, `church.bingoCut` x0, `bank.savingsRate` +0.002 |

### 18.4 The mayoral election (each season)

- Filing: days 1 to 7, $6,000. Candidates may buy campaign ads ($5,000 each, at most 5) until the count; each ad is a vote.
- Voting: days 8 to 10 (the ballot opens at the midnight starting day 8 with every candidate still in town). One vote per player, changeable.
- The count, at the midnight starting day 11: votes plus ads, at least 1 per candidate, so a lone candidate wins unopposed; ties drawn on the town stream. No candidates: the NPC mayor stays ("ELECTION CANCELLED").
- The mayor's perks for the rest of the season: +3 rating (ribbon cuttings, 7.1; the text's `{rating}`), 2 votes on every ordinance (`election.perks.turns` can add turns every morning, the chauffeur; 0 since tuning), and the "Mayor takes credit" ending of the cough arc (22.3).
- In a town without seasons (`tournamentActive` off) the season day repeats every 30 days and each term starts over.

## 19. The hospital (the Nurse)

The Classic hospital wrapped (`expanded/town/hospital.ts`): the sick room after a lost parlor fight is Classic's. The front desk lists injuries and offers treatment and leads.

### 19.1 Injuries

An injury is content (`InjuryDef`): days to heal, hit points taken off the start of every fight, patience taken off every customer, turns taken off each morning, and the price to treat it. Given by losing a parlor fight or a graveyard duel (starter: Sprained Ankle or Cracked Skull), a failed grave robbery (Dog Bite), a lost Formaldehyde Roulette (Pickled Liver) and a hit (Busted Kneecaps). Each injury names its `causes` (`duel`, `fight`, `rob`, `roulette`, `hit`); a cause draws at random among the pack's injuries that name it (`chooseInjury`, `town/life.ts`), or among all of them when none does, so every injury a pack defines can happen. The rules' injury ids (`graveyard.rob.injury` and the like) are the fallback for an empty list.

The Expanded pack's 16 injuries (`packs/expanded/expanded/town/injuries.yaml`; the engine's starter has the first five, in the same order of ids: Dog Bite, Sprained Ankle, Cracked Skull, Pickled Liver, Busted Kneecaps):

| Injury | Causes | Days | HP | Patience | Turns | Treatment |
|---|---|---|---|---|---|---|
| Dog Bite | rob | 2 | 3 |  |  | $400 |
| Sprained Ankle | duel | 2 | 4 |  | 1 | $800 |
| Cracked Skull | duel, fight, rob, hit | 3 | 8 | 1 |  | $1,500 |
| Pickled Liver | roulette | 2 | 2 | 1 |  | $600 |
| Busted Kneecaps | hit | 4 | 10 | 1 | 1 | $3,000 |
| Shovel-Shaped Face | duel, rob | 2 | 3 | 1 |  | $700 |
| Broken Toe (Granite) | duel, rob | 2 | 2 |  |  | $350 |
| Lily Rash | duel, fight, roulette | 1 | 1 | 1 |  | $300 |
| Embalmed Thumb | fight | 3 | 2 |  |  | $500 |
| Thrown-Out Back | duel, fight, rob, hit | 3 | 4 |  | 1 | $1,200 |
| Bingo Elbow | duel, fight | 2 | 2 |  |  | $400 |
| Rib Splinter | fight | 2 | 3 |  |  | $600 |
| Gold Tag Paper Cut | fight, rob | 1 | 1 |  |  | $300 |
| Formaldehyde Eyes | roulette | 2 | 2 | 1 |  | $800 |
| Lectern Lump | fight | 2 | 3 | 1 |  | $900 |
| Bouncer's Handprint | roulette | 3 | 5 | 1 |  | $1,500 |

The pack's lint (`@fq/content`, `townLint.ts`) requires at least three injuries to name each cause, so a hit man never gives a Lily Rash and no cause repeats the same two injuries; each text must make sense for every cause it names (the hit mail says a tire iron, so the injuries a hit can give do not mention a shovel, lilies or the dog).
- At most 3 at a time (a fourth replaces the oldest); the same injury again resets its days.
- Every midnight each injury heals a day; at 0 it is gone.
- Body armour from the black market stops the next injury (and is used up).
- The parlor fight: the Classic attack fills both bars to the maximum; the Expanded visit lowers each side's maximum by their injury hit points for that call (at least 1 left), so the fight starts short.
- The morning screen lists injuries still hurting and the turns they cost.
- Treatment: the listed price (through `hospital.treatPrice`), today.

### 19.2 The ambulance chaser (leads)

Pay the nurse $1,500 for a lead, -2 karma, at most 2 a day, at most 3 held. A lead makes the next Wait for Customer a sure customer (no free event, risk or script) with the income roll +25 (richer), announced on arrival. Leads also come from tending graves (16.2), the Necromancer's seance (20.5) and the black market's Coroner's List (20.3).

## 20. The Reaper Club

The cut rave club (Design Doc: "You shiver as you approach The Reaper, a rave club frequented by the underbelly of society (mostly funeral directors). The cover charge is 2 wooden tags... Hire a hit man"). Module `reaper-club` (`expanded/town/club.ts`), place `reaper-club`.

### 20.1 The cover and the room

The cover is 2 wood tags (plus `club.cover`), paid once a day; Necromancers walk in free ("the Necromancer path's home"). Inside: The Back Tables, Black Market, Hire a Hit Man; `more`: Hire a Bodyguard, Seance in the Back Room, story appeals.

### 20.2 The house games (fair, with a small edge)

Stakes $100, $500, $1,000 or $5,000; at most $25,000 staked a day. Luck does not change the odds.

| Game | Rule | Return per $1 | House edge |
|---|---|---|---|
| Dead Man's Draw | You and the Reaper each draw `random(13)` (Two to Ace). Higher wins even money; a tie returns half the stake. | (78 x 2 + 13 x 0.5) / 169 = 0.9615 | 3.85% |
| The One-Armed Undertaker | Three reels of 16 slots (1 skull, 2 coffins, 3 bones, 4 roses, 6 worms). Three of a kind pays 500 / 100 / 30 / 12 / 4 times the stake; otherwise a skull on the first reel returns the stake. | 3,997 / 4,096 = 0.9758 | 2.42% |
| Formaldehyde Roulette | Six glasses, one is not vodka (`random(6) == 0`). Live: stake back plus 19%. Lose: the stake and the Pickled Liver injury. | 5/6 x 1.19 = 0.9917 | 0.83% (plus the injury) |

The returns are computed exactly by enumeration (`drawReturn`, `slotsReturn`, `shotsReturn`); section 28 shows them through the engine.

### 20.3 The black market

Three items a day (drawn by weight at midnight), each once per player per day, for money:

The Expanded pack (`market.yaml`) stocks 20 items; the engine's starter has these eight (the pack renames the vest "Bulletproof Vest, One Small Hole"):

| Item | Price | Effect |
|---|---|---|
| Rabbit's Foot (Still Twitching) | $2,000 | +5 luck |
| Kevlar Vest, One Small Hole | $3,000 | Body armour: stops the next injury or hit |
| Gold Casket That Fell Off a Truck | $2,000 | A gold casket into stock (Di-Mart's wholesale is $4,000), -1 karma |
| The Coroner's Morning List | $1,500 | A lead, -1 karma |
| Forged Permit | $1,500 | The cheapest City Hall permit not held, -3 karma |
| A Gold Tag, Numbers Filed Off | $5,000 | +1 gold tag, -1 karma |
| Holy Water (Tap) | $400 | A bottle of holy water |
| A Large Man Named Tiny | $2,500 | A bodyguard tonight |

Each is disabled with a reason when it would do nothing (vest worn, storeroom full, every permit held...). The gold tag is the only money-to-tag conversion in the game, at $5,000 a tag and one a day.

### 20.4 The hit man, the bodyguard, and their consequences

- Price: `$3,000 + $1 x the target's BP` (through `club.hitPrice`; $5,000 + $2 before the engine pass), -5 karma, one hit a day, one hit per target per night. Refused for yourself, Peace Pledge parlors and chain-mates.
- A target with luck 60 or more hears a rumour by mail that night (counterplay time).
- Resolved at midnight, in order: foiled by police protection, a bodyguard for that night ($3,000 at the club, or Tiny), body armour (used up), being on the Peace Pledge by then, or a roll of `random(100) < 20 x security level + 25 if Church Associate`.
- Landed: the target loses `floor(pvpGain(target BP) x 0.75)` BP (`hit.lossShare`, 0.5 before the engine pass; the hirer gains nothing: no farming), gets Busted Kneecaps, a mail and the crime page.
- Foiled: the target and the hirer are mailed; half the time the hit man talks: the target learns who paid, the hirer is fined `min(cash, $2,000)` and -3 word of mouth, and the crime page names them.

### 20.5 The seance (the Necromancer's)

Necromancers only, 1 turn, once a day: `randomYesNo(luck, 0.8)` gives 2 leads (up to 3 held), otherwise -3 luck.

## 21. The bank

The Classic bank wrapped (`expanded/town/bank.ts`): tag exchange as Classic, plus Savings, Loans and Send Tags (`more` row).

### 21.1 Tag transfers

- Pick a player, a tier, a count. The teller keeps `ceil(10% x count)` tags of that tier; the receiver gets the rest. A transfer must leave at least one tag after the fee.
- Limits: at most 10 wood-tag equivalents (wood 1, silver 2, gold 4) sent a day per sender, and received a day per receiver. Parlors less than 3 days old cannot send. Never to yourself.
- The receiver is mailed. Tags are only moved or destroyed (tested on every simulated transfer).

### 21.2 Savings

Deposit and withdraw any amount (or all) at no cost. Interest at every midnight: `floor(min(savings, $100,000) x 0.2%)`, plus `bank.savingsRate`. Savings cannot be stolen from the till (9.6). No deposits while a loan is outstanding, so borrowed money cannot earn interest.

### 21.3 Loans

- One loan at a time, up to `min($50,000, $3,000 + $100 x plots)` (plots are the collateral). Interest 3% a day, compounded at midnight (`ceil(owed x 1.03)`), plus `bank.loanRate`; the first day's 3% is added when the money is lent (`loan.fee`), so a loan repaid before midnight is not free credit (the simulator's builders and tycoons borrowed every morning and repaid every evening at no cost).
- Due 10 days later, and never after the season's last day; no new loans in the last 3 days of a season.
- Repay any time (as much as the cash covers).
- At the midnight after the due day (or the season's final day) the bank collects from cash, then savings, then caskets in stock at wholesale (gold first). Whatever is left is written off: 1 BP per $40, -10 word of mouth, -5 karma, and no more loans this season ("deadbeat"). A default costs more BP per dollar (0.025) than any way to turn money into BP (the best is the first monument, 0.020), so a loan can never be turned into BP.

## 22. The living town (plan item D)

### 22.1 Daily news that changes the rules

At each midnight from day 2 (not on the season's final day), with chance 60%, one story is drawn by weight from `content.town.news` (with `minDay`). Its headline and story go on the front page after Classic's blurb, its modifiers are added for its `days` (default 1), and its id is today's news (desk strip, morning screen, `View.town.news` with the one-line `effect`).

The Expanded pack (`news.yaml`) has 75 stories (29 of them follow-ups gated on how a story arc ended or on whether there is a mayor); the engine's starter has these ten, which a pack with no `town` section gets:

| Story (starter) | Effect |
|---|---|
| SHAKEUP IN DEATHVILLE (the Design Doc's small earthquake) | `turns.daily` +1, `wait.eventOdds` x0.5 |
| MORTUARIES DO ROCKIN' BUSINESS (the big one, day 4+) | `turns.daily` +2, `customer.limitMult` x1.1 |
| DEATH WITH DIGNITY (the Di-Mart sale) | `store.stockPrice` x0.8 |
| A BURGER TO DIE FOR (the outbreak) | `turns.daily` +1, `customer.mood` +0.5 |
| HEAT WAVE: THE DEAD WON'T KEEP | `prep.chance` x1.5, `customer.patience` -1 |
| LOCAL PIZZA COMPANY SCREWS UP BIG TIME | `customer.limitMult` x1.1 |
| ZOO ANIMALS ESCAPE | `customer.specialChance` x2 |
| MARKET CRASH (day 3+) | `customer.incomeShift` -10, `store.stockPrice` x0.9 |
| LOCAL MAN WINS LOTTERY, DIES OF EXCITEMENT | `customer.incomeShift` +10 |
| POLICE ON STRIKE (day 3+) | `pvp.gainMult` x1.2 |

The keys the town adds to section 12.2 (`TOWN_MODIFIER_KEYS`, `expanded/town/life.ts`), each read in one place:

| Key | Op | Read |
|---|---|---|
| `turns.daily` | add | Turns at each player's new day (22.4) |
| `customer.patience` | add | Every customer's patience (3.1) |
| `pvp.gainMult` | mul | What a PvP winner gains (9.1, 16.4) |
| `graveyard.robLuck` | add | Luck for robbing a grave (16.3) |
| `graveyard.duels` | mul | 0 closes the graveyard to duels (16.4) |
| `club.cover` | add | The club's cover (20.1) |
| `club.hitPrice` | mul | The hit man's price (20.4) |
| `bank.savingsRate`, `bank.loanRate` | add | 21.2, 21.3 |
| `parlor.upgradePrice` | mul | Contractor prices (7.2) |
| `church.bingoCut` | mul | The church's cut (17.1) |
| `church.bingo` | mul | 0 cancels bingo (17.1) |
| `hospital.treatPrice` | mul | Treatment prices (19.1) |
| `city.permitPrice` | mul | Permit prices (18.1) |

### 22.2 Weather

Every midnight one weather is drawn by weight and its modifiers apply for the day. Shown on the morning screen (a line from `morning` and the `effect`), on the desk strip and the map (`View.town.weather`).

The Expanded pack (`weather.yaml`) has 14 weathers; the engine's starter has these six:

| Weather (starter) | Weight | Effect |
|---|---|---|
| Clear | 3 | none |
| Rain | 2 | `customer.cheapness` -0.3 |
| Fog | 1.5 | `graveyard.robLuck` +15, `wait.riskOdds` x1.5 |
| Thunderstorm | 1 | `customer.patience` -1 |
| Scorcher | 1 | `customer.mood` +0.3 |
| Snow | 1 | `customer.limitMult` x1.05 |

### 22.3 Story arcs

A framework (`expanded/town/arcs.ts`) and two arcs written as data (`StoryArcDef`).

- An arc has a window (`earliest`, `latest`), a weight and beats. At most one arc runs; each plays once a season. At each midnight with no arc running, an arc whose window includes today starts with chance 35% (by weight), and one whose `latest` is today starts for sure.
- A beat has a headline and story for the front page (`{mayor}`, `{top}` the biggest giver, `{side}` the side ahead), modifiers for `days`, rewards (to all players, a side's givers, the mayor, or the biggest giver on the leading side), appeals, `after` (days until the next beat, default 3) and `next`: a beat id, or a branch `{test, ifTrue, ifFalse}`. A beat without `next` is an ending (`ending` names it; the arc is recorded in `arcsDone`).
- Tests on what the town did since the arc started: `sideLeads` (one side gave strictly more money), `walkouts` / `sales` (at least `perPlayer` per active player, counted by `tally` in every sale and walkout), `hasMayor`, `mayorKarma`.
- Appeals: while a beat is the latest, buttons at a place (`arc:give:<place>:<n>`, `group: "more"`, `detail` the amount) give money to a side (and karma). The place is shown again with the thanks on top.

The framework is the engine's; the arcs are data. The Expanded pack (`packs/expanded/expanded/town/arcs.yaml`) has 11 arcs (48 beats, 24 endings), each playing once a season:

| Arc (id) | Days it may start | Beats | Endings (last beat ids) |
|---|---|---|---|
| The Steeple of St. Mortimer's (`steeple`) | 4 to 12 | 4 | `rebuilt`, `paved` |
| The Grey Cough (`cough`) | 10 to 20 | 6 | `fled`, `credit`, `statue` |
| Morty for Mayor (`morty`) | 5 to 6 | 4 | `conceded`, `honorary` |
| The Grave Robber of Row C (`robber`) | 3 to 10 | 4 | `caught`, `emptied` |
| The Di-Mart Clearance (`dimart`) | 6 to 16 | 4 | `saved`, `closed` |
| The Twins' Fire Season (`twins`) | 8 to 18 | 4 | `doused`, `blaze` |
| Old Man Withers Picks a Day (`withers`) | 9 to 19 | 4 | `pool`, `wake` |
| SolemnCorp Comes to Town (`solemncorp`) | 12 to 20 | 6 | `repelled`, `takeover`, `bust` |
| The Nurse Retires (Maybe) (`gertie`) | 8 to 20 | 4 | `stays`, `sal` |
| The Lake Bleak Monster (`lake`) | 15 to 23 | 4 | `hunted`, `studied` |
| No Confidence (`confidence`) | 14 to 22 | 4 | `carried`, `survived` |

The branches test what the town did since the arc began: `steeple`.`bids`: sideLeads good; `cough`.`quarantine`: walkouts 4 a player; `cough`.`hailed`: hasMayor; `morty`.`debate`: hasMayor; `robber`.`deacon`: sideLeads good; `dimart`.`clipboard`: sales 70 a player; `twins`.`birdhouses`: sideLeads good; `withers`.`saturday`: sideLeads evil; `solemncorp`.`meeting`: sideLeads good; `solemncorp`.`opens`: walkouts 3 a player; `gertie`.`interview`: sideLeads good; `lake`.`fishermen`: sideLeads evil; `confidence`.`hearing`: sideLeads good. A full day is about 16 sales per player (`docs/balance/expanded-baseline.md`), so the Di-Mart test asks for 70 sales a player over its six days; walkouts are rare among careful sellers (0 to 0.4% of visits for the bots), so the Grey Cough and SolemnCorp tests ask for only 4 and 3 a player, and bring the bad ending only to a town whose families really are leaving. The content lint keeps `sales` tests at 5 to 120 a player and `walkouts` tests at 1 to 20.

The engine's starter set has two arcs, which a pack with no `town` section gets:

**The Steeple of St. Mortimer's** (days 5 to 12). *Crack*: lightning splits the steeple; give $1,000 (+1 karma) at the church to rebuild, or $1,000 (-1 karma) at the Reaper Club for Lucius Vane's parking garage. After 4 days: if the good side gave more, **rebuilt** (customers calmer, `customer.mood` -0.3 for 5 days; good givers +2 word of mouth and +1 karma; the biggest giver +50 BP); otherwise (including nobody giving) **paved** (no bingo, the club's cover -1 and `prep.chance` x1.3 for 5 days; evil givers +30 BP; the biggest giver +50 BP).

**The Grey Cough** (days 10 to 20). *Outbreak*: +1 turn a day and `customer.mood` +0.5 for 4 days; give at City Hall to the cough clinic. After 4 days: 3 or more walkouts per player since it began: **fled** (families take their dead to Bigtown, `customer.incomeShift` -8 for 5 days); otherwise *hailed* (`customer.limitMult` x1.1 for 5 days, clinic givers +2 word of mouth), then after 3 days: with a mayor, **credit** (the mayor +100 BP, everyone +10), without, **statue** (everyone +30 BP).

### 22.4 Midnight and morning

`townMidnight` (the maintenance hook, town stream), in order: a town back on day 1 after a season reset starts its town record and modifiers over; the hits (20.4) and the black market's new stock; bingo (17.1); bank interest and loan collection (21); chain dues (23.1); the inspection, the ordinance ballot and the election (18); injuries heal; the story arcs; today's news and weather; every rating is recomputed.

`townMorning` (the new-day hook, the player's first desk visit of a day), after the Expanded new day (10.1): the weather, the news and the story on the morning screen; then (not on the final day) `turns.daily`, the mayor's turn, and the turns injuries cost.

### 22.5 News that remembers

A news story (`NewsEventDef`) and a front-page blurb (`EventEntry` in `newsBlurbs`) may carry `when: NewsCondition` (`packages/core/src/content/newsCondition.ts`), so the paper can refer back to how a story arc ended:

```ts
interface NewsCondition {
  arcs?: { id: string; endings?: string[] }[]; // these arcs ended this season (in one of `endings`, if given)
  notArcs?: string[];                           // these arcs have not ended this season
  mayor?: boolean;                              // true: an elected player is mayor; false: there is none
}
```

- Every listed part must hold; no `when` always holds. Endings are the names recorded in `arcsDone` (a beat's `ending`, else its id): for the Expanded pack's arcs, the ending column of 22.3.
- News: stories whose `when` fails are left out before the weighted draw (22.1), so a pack whose stories have no `when` draws exactly as before. Blurbs: under Expanded rules the blurbs of the day's range whose `when` fails are left out before `random(count)`; Classic rules never read `when` (the Classic draw is the original's). The blurb is drawn at midnight before the town hook, so it sees the arcs ended up to the night before.
- `{mayor}` in a news story's `title` and `message` is the mayor's name (elected, or the cast's NPC) on the front page, the desk strip and the morning screen.
- `checkTownContent` names unknown arcs and endings in a story's `when`; `checkNewsCondition(town, where, when)` checks a blurb's (exported for content tools).
- Starter examples: `steeple-bells` (`when: { arcs: [{ id: "steeple", endings: ["rebuilt"] }] }`), `garage-opens` (`paved`) and `mayor-ribbon` (`when: { mayor: true }`, `{mayor}` in the title). Tested in `test/newsCondition.test.ts`.

## 23. Parlor chains (plan item E)

### 23.1 Cost and benefit

Registered at City Hall. Founding costs $10,000 (a name typed in; filtered like announcements; unique), joining $5,000 (by invitation from a member), and every member pays $150 a day at midnight; a member who cannot pay is dropped and mailed. At most 4 members. Benefits: +4 rating (7.1), Di-Mart caskets x0.9 (6.2), and a family that walks out goes to a chain-mate (if one is active) instead of a random rival (3.4).

### 23.2 The season score board

A chain's score is the BP its members earn from sales while members (`settleSale`). `chainStandings(town)` returns every chain, best first; the chains screen shows it (`View.board` is for the client to draw it as a table).

### 23.3 No farming

- Chain-mates can never fight in a parlor, rob, burn (the twins refuse), duel, or hire a hit on each other.
- A chain whose members were beaten 3 times in a day (parlor fights and duels) is sheltered until midnight: no more break-ins at the door or duels against its members that day.
- Leaving starts a 3-day cooldown before founding or joining again. Chain BP comes only from sales, never from fights or transfers between members.

## 24. The Daily Challenge (plan item E)

### 24.1 What it is

Every player gets the identical seeded day: a one-player Expanded town made from the challenge's seed (`dailyChallengeSeed(id)`, an FNV-1a hash of the id), with a fixed loadout: 20 turns, $5,000, stock 3 wood, 2 silver, 1 gold, psych 2, the first hearse, 2 wood tags, karma 50, luck 50, the tour done, no seasons. Each Wait for Customer draws from its own stream (`openStream(seed, -7, 1000 + n)` for the n-th wait), and every customer is generated against the challenger as the run began (`challenge.base`), so the same people with the same limits arrive in the same order whatever the player did in between. The day's news and weather are the seed's. Negotiation draws come from the player's stream, so the same moves give the same results.

### 24.2 Engine functions for hosts

```ts
createDailyChallenge(id: string, ctx: EngineContext): DailyChallenge  // { id, seed, loadout }
startDailyChallenge(challenge: DailyChallenge, entry: { name: string; parlor: string; male: boolean }, ctx: EngineContext): { town: TownState; playerId: 0; view: View }
dailyChallengeResult(town: TownState): DailyChallengeResult  // { id, name, finished, score, money, sales, exact, walkouts }
rankDailyChallenge(results: DailyChallengeResult[]): (DailyChallengeResult & { place: number })[]
```

The host creates the day's challenge once, starts one run per account (it enforces "played once"), keeps the returned town as that run, plays it with `step(town, 0, action, ctx)`, and never runs maintenance on it. A run is finished when the player logs off or quits (also on a timeout, through `endSession`) or is out of turns with no customer open and no body-preparation choice pending (the choice costs no turn and can pay BP, so the run waits for it); a finished run's desk shows the score with one button (`desk:quit`). Score = BP earned in the run; the board sorts by score, then money gained, then fewer walkouts, then name.

## 25. Town content (`ContentPack.expanded.town: ExpandedTownContent`)

### 25.1 The tables (all additive)

`ExpandedContent.town` is optional. `withExpandedContent` fills in `TOWN_STARTER` when a pack's Expanded section has none, so a pack written before the town existed (the content writer's) loads unchanged. Types are in `packages/core/src/expanded/content/townTypes.ts`, re-exported from `types.ts`:

- `injuries: InjuryDef[]` (`id`, `name`, `text`, `days`, `hp`, `patience?`, `turns?`, `treatPrice`, `causes?`: any of `duel`, `fight`, `rob`, `roulette`, `hit`)
- `news: NewsEventDef[]` (`id`, `title`, `message`, `effect`, `weight?`, `minDay?`, `days?`, `modifiers`, `when?: NewsCondition` (22.5); `{mayor}` in `title` and `message`)
- `weather: WeatherDef[]` (`id`, `label`, `morning[]`, `effect`, `weight?`, `modifiers`)
- `ordinances: OrdinanceDef[]` (`id`, `title`, `text`, `effect`, `modifiers`)
- `market: MarketItemDef[]` (`id`, `name`, `text`, `price`, `reward: Reward`, `grant?`: "armor", "lead", "gold-casket", "bodyguard", "permit", "holy-water", `weight?`)
- `arcs: StoryArcDef[]` (`id`, `title`, `earliest`, `latest`, `weight?`, `start`, `beats: ArcBeatDef[]`), `ArcBeatDef` (`id`, `headline`, `story`, `modifiers?`, `days?`, `rewards?`, `appeals?: ArcAppeal[]`, `after?`, `next?: string | ArcBranch`, `ending?`), `ArcAppeal` (`place`, `side`, `label`, `thanks`, `amount`, `karma?`), `ArcBranch` (`test: ArcTest`, `ifTrue`, `ifFalse`), `ArcTest`
- `ModifierDef` (`key`, `op`, `value`)
- `monuments: string[]` (one name per tier), `permits: Record<id, {name, description}>`, `cast` (`mayor`, `clubOwner`, `nurse`, `inspector`, `teller`), `pictures` (`graveyard`, `church`, `bingo`, `cityHall`, `hospital`, `club`, `bank`, `duel`, and the optional `cityHallOutside`, `inspection`, `hospitalDesk`, `clubDoor`, `clubTables`, `blackMarket`, `vault`: `{fg?, bg}` asset ids)
- `text: TownText`: `hints`, `graveyard`, `church`, `cityHall`, `chains`, `hospital`, `club`, `bank`, `world`, `challenge` (every string, with its placeholders documented on the field)

The only changes to existing content types: `ExpandedContent.town?` (optional), and `EventEntry.when?` (22.5, read for news blurbs under Expanded rules only). The engine pass added `TownText.hints.yourVote?` (11.5; default `alreadyHave`) and reads `ExpandedText.perks.neutral?.name` for the neutral band of `karmaScale` (empty when absent). `upgrades` gained names for `billboard`, `memorial-garden`, `crematorium` in the starter (a pack without them shows the id).

### 25.2 The starter set and the Expanded pack's town

The engine's starter (`TOWN_STARTER`, what a pack with no `town` section gets): 5 injuries, 13 news stories (3 with a `when`, 22.5), 6 weathers, 6 ordinances, 8 black-market items, 2 story arcs (8 beats, 5 endings), 5 monuments, 3 permits, and every line of every place, in the original's voice (the Design Doc's own lines are used where it has them: the graveyard's fog, the club's underbelly, Father Smyth's greeting, "Nothing relaxes you like a visit to the town grave site").

The Expanded pack carries its own town (`packages/content/packs/expanded/expanded/town/`, and `@fq/content` ignores the starter for it): 16 injuries (each with its `causes`), 75 news stories, 14 weathers, 26 ordinances, 20 black-market items, 11 story arcs (48 beats, 24 endings), 5 monuments, 3 permits, its own cast (Mayor Hollis Grubb, Lucius Vane, Nurse Gertie, Inspector Mudge, Prudence Ledbetter) and its own text for every place. Its numbers in text are the engine's: where the engine fills a placeholder (`{tax}`, `{rating}`, `{turns}`, `{fee}`, `{price}`, ...) the pack uses it instead of typing the number, and the lint flags a typed `%` or `$` amount in such a field.

### 25.3 Checking

`checkExpandedContent` now also runs `checkTownContent`: injury ids the rules use exist, one monument name per tier, a name per permit, enough ordinances for a ballot and items for a day's market, no duplicate ids, every modifier key one the engine reads, every arc's beats reachable and every last beat an ending. The starter passes (tested). The content lint in `@fq/content` (`lint.ts`, `townLint.ts`) adds, for a pack's town: placeholders and lengths per field, modifier keys, ops and ranges, arcs that are well formed, picture ids in either manifest, at least three injuries naming each cause (once any injury names one), and no typed `%` or `$` amounts where the engine fills a placeholder. The schema (`expandedSchema.ts`) also compares its field list with `ExpandedContent`'s at type-check time and names any field core has that it lacks.

### 25.4 Pictures

The Expanded pack uses the Remastered art pack's pictures (`docs/art/remastered-notes.md`): `places/graveyard`, `places/graveyard-duel`, `people/mayor-grubb` over `places/mayor-office`, `places/bingo-night`, `places/sick-room` (with `people/nurse-gertie` over the Classic desk as `hospitalDesk`), `people/lucius-vane` over `places/reaper-club`, and the optional keys `cityHallOutside` (`places/city-hall`), `inspection` (`people/inspector-mudge`), `clubDoor`, `clubTables`, `blackMarket` and `vault` (`people/teller-prudence` over `places/bank-vault`), and `places/prep-table`, `places/prep-cosmetics` and `places/prep-viewing` for 18 body-preparation scenes. These ids are in `assets/remastered/manifest.json`, not `assets/manifest.json`; the pack lint accepts either manifest for the Expanded pack (Classic and Vintage only the Classic one), and the client falls back across art packs. The engine's starter uses the same Remastered ids for every key (`TOWN_STARTER.pictures`). The engine reads the optional keys where the artist asked: `cityHallOutside` on arrival at City Hall and at the chain registry, `inspection` at the health inspection, `hospitalDesk` at the front desk (and, when a pack sets it, `hospital` becomes the Expanded sick room after a lost fight), `clubDoor` before the cover is paid, `clubTables` at the back tables, `blackMarket` at the market, `vault` for savings and loans; each falls back to the place's main key. The parlor drawing follows the building level through `places/parlor-1` to `-5` (7.2), and a body-preparation event without a picture gets one of the three prep scenes (11.4). Expanded customers draw portraits from Classic's pools plus four Remastered faces (`people/m_adult_5`, `people/m_old_7` for men, `people/f_adult_3`, `people/f_old_3` for women; `chooseExpandedPortrait`); Classic's `choosePortrait` and its draws are unchanged. The asset tests accept ids from either manifest and check that Classic code and Classic portraits use only the Classic one. The map has no `ui/building-graveyard`, `ui/building-city-hall` or `ui/building-reaper-club`.

## 26. Presenting the town (for the client)

- `View.town: TownPanel` on the desk and the map: `day`, `weather {id, label, effect}`, `news {id, title, effect}`, `ordinance {id, title, effect, until}`, `mayor`, `story` (the arc's latest headline), `ballots [{kind, closes, voted}]`. Draw a strip above the desk: a weather icon and label with the effect as a tooltip, the headline that changes today's rules, the ordinance in force, the mayor's name, and a "vote" badge for each ballot the player has not voted on. The desk's `status` line repeats weather and news in text.
- `Hud.savings`, `Hud.debt {owed, due, daysLeft}`, `Hud.injuries` (and `Hud.injuryList`), `Hud.leads`: present once the player has a town record; show debt in red with its days left, injuries as a bandage count with the list (11.5) as a tooltip, leads as a small card count.
- `View.board: BoardRow[]` (`place`, `name`, `detail` the members, `score`, `mine?`) on the chains screen: draw it as a table under the text, the viewer's row highlighted. The text lists the same board for clients without a table. A host showing the Daily Challenge board can fill the same rows from `rankDailyChallenge`; hosts read `chainStandings` for a season page.
- Duels use `View.battle` (both bars with names) and three buttons; Shove's `detail` is its chance (a shove that lands also costs the rival their next move, 16.4).
- The places' facts as data (bingo, ballots, the bank, the club, injuries): section 11.5.
- Cards (`group: "hand"`): monuments, bingo cards ("Free tonight" or "1 wood" in `detail`), permits, ballot options (`detail` "N votes"), candidates, chain invitations, treatments, games (one card per game and stake), market items (`hint` carries the reward summary when enabled). Disabled cards keep their reason in `hint`.
- `group: "more"`: tending, robbing, looking around, holy water, service, tithe, inspection, bodyguard, seance, the bank's savings, loans and transfers, and story appeals (`detail` the amount).
- Overlays: `playerPicker` for duels (`graveyard:pick`), hits (`reaper-club:hitpick`, names carry the price), chain invitations (`city-hall:invitepick`) and transfers (`bank:tpick`); `textInput` for chain names and bank amounts.
- Places on the map: `graveyard` "Town Graveyard", `city-hall` "City Hall", `reaper-club` "The Reaper Club".

## 27. Verification of the town

`pnpm --filter @fq/core test` (40 files, 475 tests at the time of writing). New files:

- `townPlaces`: every formula and transition of sections 16 to 21 (monuments, tending, robbing with both outcomes, shove chance and duel stake, a duel to the end, yielding and logging off mid-duel, refusals; bingo cards and the free card; confession prices and caps; holy water into a Bless; the service; tithes by karma; permits gating upgrades; pass chance and certificates; the inspector fining; injuries listed, treated, healed, shortening a parlor fight and patience, and injuring whoever drops; leads; the cover; the exact game returns and engine plays; the stake limit; the market; hit price, booking, landing and every counterplay; the seance; transfers, fees and limits; savings interest and the cap; loans, interest, repayment, collection and the default's BP cost; loan dates near the season's end). Most presses go through `pressRT`, which plays the same action on a JSON copy of the save and checks both come out identical, so every place round-trips mid-flow.
- `townSocial`: bingo with 4 players over 6 nights (tags plus carry fall by exactly the cut each night; winners and carries happen); the ordinance vote with lobbying and its week in force; an empty week; the election with filing, ads, voting, the count, the mayor's morning turn, rating and double vote; no candidates; chains founded, invited, joined, full, scored from sales, dues, a broke member dropped, leaving and the cooldown; chain-mates refused at the graveyard, the club and the rival row; shelter; the Daily Challenge: two runs with different play meet the same 20 customers, a replay is byte-identical, results, ranking, the finished desk, a run quit early.
- `townWorld`: the content check; news on the front page and its modifiers' days; news and arc turns arriving at the morning; weather on the morning screen, desk strip and map; fog and storm effects; each arc played to each ending (rebuilt, paved by evil and by nobody, fled, credit, statue); arcs starting inside their windows once a season; a season reset clearing the town.
- `townSim`: 5 seeds x 4 players x 5 days of random play, and 3 seeds x 4 players x 12 days of an exercise player (money, tags, karma extremes) that reaches every new action (66 action kinds listed in the test). After every action: Classic and Expanded invariants plus the town's (savings, loans, injuries, leads, holy water, monuments, permits, stakes, transfers, chain membership, bingo cards); every enabled button accepted (checked on a copy every 11 actions); no enabled button whose `$` or `wood` detail exceeds what the player has; for every bank, bingo-card, chain, permit, inspection, lobbying, election, cover and hospital action, town-wide money net of debt, tags at wood value and BP do not rise; a save every 17 actions plays on identically; no rejected action.
- `townBalance`: section 28.
- Engine pass: `panels` (11.5: every panel on every view of 3 exercise walks and a random walk agrees with the state, every panel is seen; the tour counter, the practice hint, the HUD countdowns, a flat offer, a club round on cue), `duelShove` (16.4), `newsCondition` (22.5), `blocking` (29, both rulesets), and in `balanceFixes` the Classic empty-overlay fix (10.2).

## 28. Money in the late game, and the house edge

Scripted View-only seats (`test/support/xtownPolicy.ts`): the section 15 seats `reader`, `balanced`, `good karma`, `evil karma`, and the same three spending seats with a late-game town budget: from day 18 or once the parlor owns the chapel, keeping $15,000 in the till, they buy monuments, the three permits and the late upgrades, an inspection certificate, holy water (not the evil seat) and, above $40,000, tithes. Each town is played twice with the same seats in the same slots, without and with the budget (`BALANCE_FULL=1 pnpm --filter @fq/core test townBalance`, 8 towns x 29 days of 4 seats; the default run is 1 town).

| seat | final BP | with the town | change | cash left | with the town | spent in the town | monuments |
|---|---|---|---|---|---|---|---|
| reader (control, buys nothing) | 11,623 | 11,884 | +2.2% | 84,949 | 84,952 | 0 | 0 |
| balanced | 14,695 | 15,535 | +5.7% | 49,090 | 34,419 | 79,275 | 3.3 |
| good karma | 15,271 | 15,668 | +2.6% | 50,656 | 22,451 | 51,000 | 3.0 |
| evil karma | 15,262 | 16,518 | +8.2% | 168,381 | 40,102 | 153,375 | 4.0 |

- The reader, who spends nothing in either run, moves 2.2% only because its rivals play differently: that is the noise floor. The balanced and evil seats gain clearly more than that; the good seat's gain is within it.
- Money no longer piles up: the evil seat ends with $40,000 instead of $168,000, the good seat with $22,000 instead of $51,000. What is left is mostly the $15,000 reserve and the threshold for tithes.
- The house games have expected returns of 0.9615, 0.9758 and 0.9917 per dollar (exact). Through the engine, 12,000 Dead Man's Draws at $100 (8 towns, 2 players, 3 nights each at the daily stake limit) returned $1,171,550 of $1,200,000 staked: 0.976 per dollar, against 0.9615 expected (one standard error is about 0.009). The test requires a return below 1 and above 0.93.

The table above is from the numbers before the simulator tuning; `townBalance` re-checks its claims with the tuned numbers (the good seat's gain is within one town's noise, so the quick test allows 3%).

### Measured by the simulator (tuned)

`docs/balance/expanded-baseline.md` measures every town system under play by the twelve personalities. Money: sales are 83% of all income, stock 48% of all spending (the storeroom is the money engine), upgrades 17%, monuments 11%, tithes 5%. Monuments return 0.010 BP a dollar over all five tiers, tithes 0.009 (0.012 for the good path): flat on purpose, so money keeps a use to the end of the season without becoming the way to win. With the endgame spending of the bots, money no longer piles up except for the richest parlors (the shark and the tycoon, whose sinks are capped: five monuments and $10,000 of tithes a day). The house returns its exact edge at every stake. 2,378 loans were taken (builders and tycoons, to buy an upgrade sooner) and every one was repaid; the first day's interest is now charged when the money is lent. Every ballot is voted on by every parlor; the politician is elected in 114 of 200 towns; 140 chains form.

### What remains to tune

- **Hits** removed 0.001 BP from the victim per dollar ($5,000 + $2 x the target's BP); the engine pass made them $3,000 + $1 a BP with three quarters of the curve as the loss (about 0.005 BP a dollar against a 10,000 BP target, still half a monument's rate, and the hirer still gains nothing). Bots hire them rarely, so the simulator cannot judge them; how much griefing is wanted needs human play.
- **The duel's Shove** was never better than a Swing; since the engine pass a shove that lands costs the shoved side their next move (16.4), and each of Swing, Shove and Yield is best in some position. The bots' duel policy (`@fq/bots`) still values a shove by the old rule.
- **The election** draws one candidate (the politician) in most towns and nobody runs against it; the mayor's perks are now +3 rating and a double vote (the extra turn was worth about 700 BP a season). Contested elections need people.
- **Story arcs, news and weather** are exercised (every seat lives through them) but not measured against each other; their frequency (news 60% of days, arcs 35% a day in their windows) needs human play.
- **Unused late upgrades:** the Billboard, the Memorial Garden and the Night Watchman were bought by no personality; the engine pass lowered their prices (7.2, tuning log "Loose ends"). The bots buy upgrades from fixed lists (`@fq/bots` `personalities.ts`): only the builder lists the Billboard and the Garden, after the mausoleum, and none lists the Night Watchman, so the simulator cannot show the change until the lists do.
- The black market's gold tag is the only money-to-tag path; watch it if tags get scarce.
- The Remastered art pack now draws the places, the duel and two map buildings (25.4); there is still no `ui/building-graveyard`.

## 29. Blocking and moderation (both rulesets)

A remaster addition for app stores (games with chat and mail must let players block each other). The host owns reports, the block-list screen and accounts; the engine honours the list. Code: `classic/blocking.ts`, `classic/moderation.ts` (both rulesets share them). State: `TownState.blocks?: Record<blockerId, number[]>`, absent while nobody blocks anybody, so a town without blocks (every Classic transcript) is byte-identical; a reused slot is cleared from every list (`addPlayer`), and a tournament reset drops them all.

```ts
setBlocked(town: TownState, playerId: number, blocked: readonly number[]): TownState  // replaces the list; [] removes it
blockedList(town, playerId): number[];  isBlocking(town, blocker, other): boolean;  blockersOf(town, playerId): Set<number>
removePlayerText(town, playerId, ctx, { names? }): { town, removed: { letters, announcements, quotes, fortunes } }
renamePlayer(town, playerId, ctx, { name?, parlor? }): { town, error?: "noSuchPlayer" | "nameLength" | "nameTaken" | "parlorLength" }
```

What a block does (the blocker no longer receives the blocked player's text; it is one way):

- **Letters** from the blocked player are not delivered, and the blocker is not told one is waiting; the sender's screens are exactly the usual ones (tested byte for byte). The host log notes "blocked, not delivered".
- **Cafe**: their talk, `/me`, `/yell` (also its queued notice outside the cafe) and the `/give` notices do not reach the blocker; `/give` cannot find the blocker in the cafe (the sender gets the usual "nobody by that name here", and keeps the tag).
- **Pickers**: the blocker is left out of the blocked player's Yang's delivery picker (a delivery carries a typed fortune) and, in Expanded, the bank transfer and chain invitation pickers (each mails the blocker); a stale pick is refused as "not home" / "no rivals".
- **Battle quotes** the blocked player types after a fight are not mailed to the blocker (the fight's result still is).
- **Never a combat shield**: visits, fights, arson, theft, duels and hits ignore blocks (tested: the visit flow is identical with and without a block).
- **Public text is not filtered per reader.** An announcement or a crime-page quote that names the blocker stays in the paper for everyone, the blocker included. Decided because the Funeral Times is one shared page (Classic stores each day's paper as one text and every reader sees the same), hiding it from the person named alone does nothing about everyone else reading it, and per-reader papers would let readers see different news. Announcements and quotes are always swear-filtered; abuse is handled by the host's report and `removePlayerText`.

`removePlayerText` (account deletion, a moderator's takedown) removes the player's letters still queued for others (text, quote and Reply packets), their announcements on every stored front page (header and body), their battle quotes (queued quote mails; crime-page entries keep the fight and lose the quote) and their queued Lucky Sparrow fortunes. Matching uses the content's templates with the player's name; `names` adds earlier names (the engine keeps no rename history). Not reachable: chat (never stored), the Cursed Tiger's fortunes (anonymous by design, so not traceable), and Expanded chain names (rename them through the host). `renamePlayer` is a moderator's rename: the creation length rules and a unique name, no fee, no announcement, and the old name and parlor replaced as whole words in the stored paper, queued mail and the mayor's name, so a later takedown still finds the player's text. Tests: `test/blocking.test.ts`.
