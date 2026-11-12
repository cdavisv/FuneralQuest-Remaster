# Balance report: expanded rules

## What it says about the Expanded design

*Hand-written reading of the generated tables below (regenerating with `pnpm --filter @fq/sim run sim -- --days 30 --towns 200 --players 8 --rules expanded --seed 1 --challenges 6 --out docs/balance/expanded-baseline` overwrites this file; keep this section, or rebuild the tables alone with `pnpm --filter @fq/sim exec tsx src/remark.ts ../../docs/balance/expanded-baseline`, which keeps it). 200 towns of 8 hard bots drawn from the twelve `@fq/bots` personalities, a 30-day season with the built-in `expandedPack`. This is the run after balance round 20 of `expanded-tuning-log.md`, which set out to bring the tycoon back under control by tuning the eight newer places (`expanded-rules.md` sections 30 and 31). No rules number changed in the end: the numbers tried did not reach the tycoon (see reading 1), so they were put back. The one change is a bot habit: the good styles now send the church wreath every fourth day for its word of mouth, not only when short of karma. "Before" is the round-19 baseline this file replaced (same 200 towns and seeds). A personality's win share moves by 0.2 to 0.4 for a couple of wins at this size (see reading 2), so read BP against the town mean first.*

**Checks: all passed**: no invariant breaks, no offered button rejected, no stuck bot-day, no error, none of the conservation signatures.

### The targets

| target | before (round 19) | after (round 20) | met? |
| --- | --- | --- | --- |
| no personality above about 2x its fair share of wins, none below a third | tycoon 3.25, necromancer 2.33, politician 1.57, pacifist 1.35, shark 1.05, saint 0.72, builder 0.56, gambler 0.48, saboteur 0.29, organiser 0.29, Soft Touch 0.19, scholar 0.11 | tycoon **3.38**, necromancer 2.33, politician 1.68, pacifist 1.41, shark 0.98, builder 0.63, gambler 0.42, Soft Touch 0.31, saboteur 0.29, saint 0.26, organiser 0.23, scholar 0.22 | **no**: the same two above 2; five below a third, all but the saboteur within 1.7% of their towns' mean BP (see 2) |
| round 20's own target: the tycoon within about 2x on wins and under about +4.5% of its towns' BP | 3.25, +6.6% | 3.38, +6.5% | **no**: no number of the eight places reaches it (see 1) |
| the same field read by mean place and mean BP (reported alongside, not a new target) | mean place 2.33 to 6.64; means 17,435 to 20,814 (sd 803), -8.8% to +6.6%; town mean 19,437 | mean place 2.28 to 6.61; means 17,432 to 20,802 (sd 800), -8.7% to +6.5%; town mean 19,440 | unchanged |
| the rest of the field's cost of the places under 1% of BP | the town's mean BP -0.7% (19,566 without the places) | -0.6% (19,440); at 60 towns the parlors other than the tycoon lose 0.8% (see 5) | yes |
| good and evil within a few percent | BP against the town mean: good +1.2%, neutral +1.4%, evil -3.8%; wins: evil 1.22, good 1.03, neutral 0.82 | good +1.2%, neutral +1.5%, evil -3.9%; wins: evil 1.20, good 1.06, neutral 0.79 | unchanged |
| no single purchase dominant, no system dead | the eight places: none returns BP a dollar as a monument does; the church wreath dead (9 presses) | none returns BP a dollar as a monument does; the church wreath sent 1,793 times by 529 seats; no place or action unused | **yes** (see 3) |
| skill worth clearly more than luck | Daily Challenge hard 418.5, easy 365.4 | hard 418.5, easy 365.4 (72 runs each) | yes |
| PvP-heavy play viable, peaceful play not miserable | 8,452 duels, 529 hits landed; patrol or back door on 10% of seat-nights | 8,513 duels, 499 hits landed; 1,502 patrols and 3,454 back doors | yes |
| loans cannot be turned into points; a small house edge | no default | no loan or house rule changed; no default | yes |
| a full but not grindy day | 364 screens a bot-day | 364 | see the round-17 baseline's 7 |

### Reading

1. **What pays the tycoon is protection and karma, not money, and no number of the places reaches either.** Round 20 measured each suspect place by leaving it out (60 towns, seed 1, challenges 0, `--places-off`, which now also takes single buttons): with all eight places the tycoon is at +7.8% of its towns' BP, without any +4.5%; without the patrol +5.7%, without Mourne & Sons' hold +6.0%, without the police altogether +5.4%, without the oven +7.3%, without the bouquets +7.3%, without the crematorium +7.0% (one standard error is about 0.8 points at that size). The patrol keeps the season's leader out of the fights it would lose (at 60 towns its parlor-fight losses 416 BP a season without the patrol, 262 with it) and the free hold carries it, a neutral parlor, into the good path in a third of its seats (karma 47 without the places, 67 with them; good path 3% -> 36%). Money does not reach it: it ends the season with about $46,000 in cash its capped sinks cannot use, so a patrol at $6,000 and then $9,000 was still bought six times a season and its BP did not move (+7.7%, +6.6%), while the Soft Touch kept paying and the saint stopped. The oven and the bouquets each return it about what they cost (+$1,100 and +$3,100 a season, 10 to 30 BP at a monument's rate); cutting both (the bulk lot $2,400 -> $2,700, the bouquet's share 60% -> 45%) took 1.1 points off it at 60 towns and none at 200 (+6.8%), and cost the bouquet buyers about half a point, so it was reverted. Taking the karma off the scattered ashes (+1 -> 0) moved it 0.3 points (noise) and was reverted too. The levers that would work need engine logic (proposals below).
2. **Win share is noise at this size, BP against the mean is the measure.** The seats below a third (Soft Touch 0.31, saboteur 0.29, saint 0.26, organiser 0.23, scholar 0.22) are at -0.4%, -8.7%, +1.7%, +0.6% and -0.1% of the town mean; with no rule changed, the saint went from 0.72 to 0.26 and the organiser from 0.29 to 0.23 on a bot habit worth a fraction of a point. The proposal to judge Expanded by mean place and BP stands.
3. **The church wreath is alive.** It was dead (9 presses in 200 towns) because the good styles only sent it while short of karma and they sit at 100; the bots now also send it every fourth day for its word of mouth (`packages/bots/src/expanded/places.ts`): 1,793 wreaths by 529 seats, about four a season for $2,400 and +4 word of mouth, cheaper per point than the certificate ($800 a point) and well short of a monument's BP a dollar. The good styles moved by less than half a point (politician +3.9% -> +3.9%, pacifist +2.5% -> +2.4%, saint +1.8% -> +1.7%, Soft Touch -0.6% -> -0.4%).
4. **The necromancer** (2.33, -2.1%) is fed a little by the police: the back door ($1,500, 70%, nine a season) cuts its fight losses, and without the police it falls to -4.6% at 60 towns (-3.2% with). Its share above 2 predates the places (2.33 before them, from the spread of its seasons: sd 12% of the town mean), so it was left alone.
5. **The places' cost to the field.** At 60 towns the parlors other than the tycoon lose 0.8% of their BP to the places (19,493 -> 19,339), nearly all of it at the police station (without the police 19,494): the fines and settlements leave the attackers, and a patrol turns the attacks it stops onto other parlors. At 200 towns the town's mean BP is 0.6% below the round-17 baseline without the places.
6. **The eight places one by one** (the table below the system tables), used by seats / net dollars a season: Police Station 88%, -$3,800; Crematorium 28%, +$3,300 (the oven pays the shark and the tycoon); Florist 58%, +$100 (the bouquets still pay their buyers $1.5 to $1.6 a dollar; the wreaths cost the good styles about $2,400 a season); Town Gazette 33%, -$11,000; Coroner 85%, -$6,100 (+5.9 word of mouth); Health Department 91%, -$3,300 (+3.9 word of mouth); Pawn 75%, -$21,800, mostly stock that replaces Di-Mart's; Mourne & Sons 92%, -$1,700 and +15 karma (the free hold, pressed 35,453 times). None returns BP a dollar like a monument (0.010).
7. **No anti-PvP lock; second-hand caskets are no pump; the quiet favour and the smear are gated** (as in the round-19 reading: no number there changed): 499 hits landed (was 529), duels 8,513, no check flagged money, tags or BP.
8. **Late starters, hidden information, the oracle, no-fighter towns, the late joiner** (previous baselines, not re-run): nothing in round 20 depends on them.

### Recommended next tuning and proposals (for the owner to decide; nothing here was applied)

| proposal | evidence |
| --- | --- |
| **The hold costs something** (engine logic, `town/mournes.ts`): a price (`mournes.hold.price`, about the spy's $300, checked in `standRefusal`) or karma only every N days (`mournes.hold.everyDays`, remembered in `PlacesBState`). It is the one free action in the eight places (35,453 presses) and is worth about 1.8 points of BP to the tycoon, which it carries into the good path | reading 1 |
| **The patrol is priced against the leader, not a flat fee** (engine logic, `town/police.ts`): a flat price cannot reach a parlor whose money has no other use, and only shuts out the poorer good parlors. Either a price that grows with the buyer's BP (as the Reaper Club's hit, $3,000 + $1 a BP), or a limit (`police.patrol.perWeek`, two nights in seven). Worth about 2 points to the tycoon; the field gains 0.4% without it | reading 1, 5 |
| The tycoon's capped money sinks: it ends with about $46,000 a season it cannot spend, so every price-based lever misses it (a section 28 question, not a places one) | reading 1 |
| Accept win share as missed for a tight field and judge the Expanded balance on mean place and BP against the town mean, or widen the sellers' variance by design | reading 2; unchanged since round 17 |
| The Memorial Garden at a monument's rate; the necromancer's spread; the politician; shorter days without less depth | unchanged since the round-17 baseline: see that round's entries in `expanded-tuning-log.md` |

### What the bots cannot tell us

See the last section of the generated tables, "What only human playtesting can answer". The eight places add questions for people: whether the Gazette's smear and the Health Department's complaint feel like sport or like griefing to the parlor on the end of them, whether a free +1 karma a day at the Mournes feels like a loophole, whether a leader buying a patrol every time it is attacked twice feels fair, and whether the Police Station's report (a public fine) is satisfying after a beating.

---

Generated by `@fq/sim`: 200 towns of 8 bots, 30 days each, difficulty hard, base seed 1. 17,452,719 actions in 2406 s.

**Checks: passed.** No invariant breaks, rejected offered buttons, exploit signatures or stuck bots.

## Win rate by personality

| personality | seats | wins | win rate | fair share | mean final BP | mean place |
| --- | --- | --- | --- | --- | --- | --- |
| tycoon | 123 | 52 | 42.3% | 12.5% | 20802.1 | 2.28 |
| necromancer | 134 | 39 | 29.1% | 12.5% | 19005.6 | 4.66 |
| politician | 138 | 29 | 21.0% | 12.5% | 20221.7 | 3.05 |
| pacifist | 142 | 25 | 17.6% | 12.5% | 19973.7 | 3.85 |
| shark | 130 | 16 | 12.3% | 12.5% | 19202.0 | 4.71 |
| builder | 128 | 10 | 7.8% | 12.5% | 19679.8 | 4.38 |
| gambler | 133 | 7 | 5.3% | 12.5% | 18775.7 | 5.57 |
| mourner | 128 | 5 | 3.9% | 12.5% | 19332.9 | 5.11 |
| saboteur | 137 | 5 | 3.6% | 12.5% | 17431.7 | 6.61 |
| saint | 122 | 4 | 3.3% | 12.5% | 19720.7 | 4.16 |
| organiser | 140 | 4 | 2.9% | 12.5% | 19668.5 | 4.49 |
| scholar | 145 | 4 | 2.8% | 12.5% | 19465.0 | 4.96 |

## BP by personality

BP/turn counts only turns spent on customers; BP/day includes risks, events, mail rewards and battles.

| personality | player-days | BP/day | BP/turn | sale BP/turn | fight BP/day | turns/day | sales/day | walkouts | exact | within 3% | within 8% | bonus share of sale BP | price/limit | risks taken | risk BP/day |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tycoon | 3690 | 694.5 | 41.61 | 35.26 | 0.0 | 16.7 | 16.3 | 0.0% | 24.8% | 17.1% | 9.6% | 24.0% | 0.75 | 93.7% | 66.1 |
| politician | 4140 | 671.1 | 42.52 | 35.39 | 0.0 | 15.8 | 15.4 | 0.0% | 29.0% | 18.7% | 10.4% | 26.5% | 0.78 | 92.5% | 63.0 |
| builder | 3840 | 662.1 | 38.92 | 33.45 | 0.0 | 17.0 | 16.6 | 0.0% | 21.5% | 15.8% | 9.7% | 22.2% | 0.72 | 93.0% | 65.3 |
| organiser | 4200 | 661.4 | 39.52 | 33.98 | 0.0 | 16.7 | 16.4 | 0.0% | 23.5% | 16.3% | 9.9% | 23.5% | 0.74 | 93.6% | 63.8 |
| saint | 3660 | 654.7 | 42.36 | 34.25 | 0.0 | 15.5 | 15.1 | 0.0% | 27.4% | 17.4% | 9.9% | 25.8% | 0.76 | 91.3% | 59.4 |
| pacifist | 4260 | 654.2 | 41.03 | 33.68 | 0.0 | 15.9 | 15.6 | 0.0% | 28.8% | 18.1% | 10.1% | 27.6% | 0.77 | 88.3% | 57.7 |
| scholar | 4350 | 653.6 | 39.17 | 33.66 | 0.0 | 16.7 | 16.3 | 0.0% | 25.0% | 16.3% | 9.6% | 25.0% | 0.74 | 94.1% | 65.2 |
| shark | 3900 | 648.4 | 37.09 | 33.69 | 0.0 | 17.5 | 17.0 | 0.4% | 22.6% | 16.0% | 9.8% | 23.5% | 0.73 | 78.8% | 47.3 |
| mourner | 3840 | 638.9 | 40.49 | 33.78 | 0.0 | 15.8 | 15.4 | 0.0% | 26.5% | 16.9% | 9.8% | 25.2% | 0.75 | 88.3% | 59.8 |
| gambler | 3990 | 633.0 | 40.27 | 33.25 | 21.7 | 15.7 | 15.4 | 0.1% | 26.3% | 18.0% | 11.8% | 25.7% | 0.78 | 73.3% | 42.9 |
| necromancer | 4020 | 628.3 | 40.04 | 32.39 | 33.9 | 15.7 | 15.4 | 0.2% | 25.2% | 17.2% | 12.1% | 25.2% | 0.77 | 65.4% | 36.8 |
| saboteur | 4110 | 571.2 | 38.99 | 25.36 | 126.6 | 14.7 | 14.4 | 0.0% | 15.5% | 11.6% | 9.5% | 20.2% | 0.66 | 67.7% | 39.1 |

## BP by psych level (as the stats sheet shows it, at the start of the day)

| psych | player-days | BP/day | BP/turn | sale BP/turn | fight BP/day | turns/day | sales/day | walkouts | exact | within 3% | within 8% | bonus share of sale BP | price/limit | risks taken | risk BP/day |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 6651 | 486.9 | 32.52 | 25.49 | 61.3 | 15.0 | 14.9 | 0.1% | 16.2% | 11.6% | 9.8% | 20.5% | 0.67 | 60.2% | 31.7 |
| 2 | 1662 | 441.9 | 29.24 | 26.15 | 11.0 | 15.1 | 14.8 | 0.1% | 17.6% | 12.2% | 10.6% | 21.1% | 0.69 | 60.2% | 27.6 |
| 3 | 3073 | 518.4 | 34.13 | 28.26 | 30.7 | 15.2 | 14.9 | 0.0% | 20.7% | 13.8% | 10.6% | 23.1% | 0.71 | 75.6% | 38.7 |
| 4 | 7717 | 566.1 | 35.33 | 30.11 | 6.4 | 16.0 | 15.6 | 0.1% | 23.0% | 15.5% | 10.8% | 24.5% | 0.73 | 85.9% | 50.9 |
| 5 | 4314 | 596.0 | 36.57 | 31.32 | 2.8 | 16.3 | 15.9 | 0.1% | 24.7% | 16.1% | 10.5% | 25.2% | 0.74 | 91.8% | 60.4 |
| 6 | 4767 | 650.9 | 39.40 | 33.40 | 7.8 | 16.5 | 16.1 | 0.1% | 26.3% | 17.8% | 11.0% | 25.7% | 0.76 | 86.0% | 60.4 |
| 7 | 4106 | 709.5 | 42.57 | 35.79 | 8.1 | 16.7 | 16.2 | 0.1% | 28.4% | 18.7% | 10.3% | 26.2% | 0.78 | 91.0% | 64.6 |
| 8 | 15710 | 798.7 | 47.91 | 38.97 | 5.8 | 16.7 | 16.2 | 0.0% | 28.8% | 19.4% | 9.6% | 25.4% | 0.78 | 95.6% | 68.9 |

## The exact match

187030 of 756846 sales (24.7%) hit the spending limit exactly: 116.89 per player per 30 days. All closeness bonuses (exact, within 3%, within 8%) are the "bonus share" column above.

## Wait for Customer outcomes

| outcome | count | share |
| --- | --- | --- |
| customer | 774380 | 80.5% |
| event | 74977 | 7.8% |
| risk | 72564 | 7.5% |
| script | 39713 | 4.1% |
| noTurns | 0 | 0.0% |

## Tags

Income by source:

| category | gold-tag equivalents | share |
| --- | --- | --- |
| sales | 443612.0 | 93.6% |
| theft | 15263.5 | 3.2% |
| bonus tag | 11636.3 | 2.5% |
| other | 1637.5 | 0.3% |
| received | 995.3 | 0.2% |
| black market | 586.0 | 0.1% |

Spending and losses by use:

| category | gold-tag equivalents | share |
| --- | --- | --- |
| psych | 165056.0 | 51.9% |
| hearse | 83702.0 | 26.3% |
| strength | 23643.0 | 7.4% |
| stolen | 15263.5 | 4.8% |
| hp | 14957.0 | 4.7% |
| club cover | 6331.3 | 2.0% |
| arson | 4296.0 | 1.3% |
| bingo | 2463.8 | 0.8% |
| transfers | 1327.0 | 0.4% |
| burned | 1203.8 | 0.4% |

| personality | arson | bingo | burned | club cover | hearse | hp | psych | stolen | strength | transfers |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gambler | 0.0 | 2407.8 | 97.0 | 967.3 | 9101.0 | 0.0 | 14896.0 | 1831.3 | 4788.0 | 0.0 |
| shark | 0.0 | 0.0 | 359.5 | 1017.5 | 16120.0 | 0.0 | 14148.0 | 1389.3 | 0.0 | 0.0 |
| saint | 0.0 | 56.0 | 27.0 | 1113.0 | 4148.0 | 0.0 | 13664.0 | 1250.3 | 0.0 | 566.0 |
| scholar | 0.0 | 0.0 | 12.3 | 1409.8 | 10005.0 | 0.0 | 16240.0 | 1155.5 | 0.0 | 0.0 |
| mourner | 0.0 | 0.0 | 38.3 | 0.0 | 8832.0 | 0.0 | 14336.0 | 786.5 | 0.0 | 761.0 |
| politician | 0.0 | 0.0 | 78.8 | 40.5 | 4692.0 | 0.0 | 15456.0 | 2256.0 | 0.0 | 0.0 |
| organiser | 0.0 | 0.0 | 86.0 | 12.5 | 4760.0 | 0.0 | 15680.0 | 1288.5 | 0.0 | 0.0 |
| builder | 0.0 | 0.0 | 61.5 | 8.3 | 8832.0 | 0.0 | 14336.0 | 1075.0 | 0.0 | 0.0 |
| pacifist | 0.0 | 0.0 | 0.0 | 0.0 | 4828.0 | 0.0 | 15904.0 | 0.0 | 0.0 | 0.0 |
| necromancer | 0.0 | 0.0 | 395.8 | 94.5 | 4556.0 | 0.0 | 15008.0 | 1717.5 | 7236.0 | 0.0 |
| tycoon | 0.0 | 0.0 | 47.8 | 1541.3 | 4182.0 | 0.0 | 13776.0 | 895.3 | 0.0 | 0.0 |
| saboteur | 4296.0 | 0.0 | 0.0 | 126.8 | 3646.0 | 14957.0 | 1612.0 | 1618.5 | 11619.0 | 0.0 |

## PvP

| measure | value |
| --- | --- |
| visits (doors reached) | 18584 |
| visits per player-day | 0.39 |
| refused at the door (online, police, locked) | 891 |
| thefts | 6639 |
| tags per theft | 1.42 |
| battles started | 11054 |
| attacker wins / losses | 9726 / 1044 (90.3%) |
| BP won by winning attackers | 784092 |
| BP lost by losing attackers | 40910 |
| arsons hired / stopped by a smoke detector | 716 / 0 |
| Cursed Tigers / Lucky Sparrows / Lucky Dragons | 8010 / 896 / 2477 |

BP lost to other parlors' attacks, per player-day, by the victim's personality:

| personality | BP lost per day |
| --- | --- |
| shark | 15.5 |
| gambler | 15.1 |
| necromancer | 10.9 |
| builder | 10.4 |
| organiser | 9.8 |
| politician | 9.4 |
| scholar | 8.7 |
| tycoon | 8.5 |
| saint | 6.3 |
| mourner | 3.0 |
| saboteur | 0.3 |

## Snowball

At the end the leader has 1.08x the median parlor's BP.

| after day | leader went on to win |
| --- | --- |
| 1 | 23.0% |
| 3 | 23.0% |
| 5 | 32.5% |
| 10 | 38.0% |
| 15 | 46.5% |
| 20 | 55.5% |
| 25 | 74.5% |

| leader after day | builder | gambler | mourner | necromancer | organiser | pacifist | politician | saboteur | saint | scholar | shark | tycoon |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 19 | 16 | 10 | 29 | 30 | 10 | 18 | 13 | 10 | 12 | 18 | 15 |
| 5 | 13 | 9 | 11 | 14 | 16 | 17 | 42 | 9 | 21 | 10 | 17 | 21 |
| 10 | 9 | 5 | 12 | 13 | 9 | 27 | 56 | 10 | 27 | 3 | 8 | 21 |
| 15 | 3 | 4 | 16 | 21 | 4 | 30 | 60 | 8 | 23 | 0 | 6 | 25 |
| 20 | 1 | 6 | 13 | 32 | 5 | 28 | 59 | 7 | 22 | 1 | 10 | 16 |
| 25 | 3 | 7 | 7 | 40 | 4 | 26 | 41 | 5 | 11 | 3 | 10 | 43 |
| 30 | 10 | 7 | 5 | 39 | 4 | 25 | 29 | 5 | 4 | 4 | 16 | 52 |

| day | leader BP | runner-up | median | leader / median | lead over runner-up |
| --- | --- | --- | --- | --- | --- |
| 1 | 534.0 | 466.5 | 400.8 | 1.34 | 67.5 |
| 5 | 2683.5 | 2481.5 | 2225.2 | 1.21 | 202.0 |
| 10 | 5782.0 | 5417.0 | 5009.1 | 1.16 | 365.0 |
| 15 | 9177.9 | 8699.6 | 8150.7 | 1.13 | 478.3 |
| 20 | 12967.3 | 12401.4 | 11754.8 | 1.10 | 565.9 |
| 25 | 17068.0 | 16411.6 | 15672.6 | 1.09 | 656.4 |
| 30 | 21285.9 | 20542.0 | 19790.2 | 1.08 | 743.9 |

## Expanded: win rate by personality

| personality | seats | wins | win rate | fair share | win / fair | mean final BP | mean place | BP vs town mean | sd of that |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tycoon | 123 | 52 | 42.3% | 12.5% | 3.38 | 20,802 | 2.28 | +6.5% | 5.2% |
| necromancer | 134 | 39 | 29.1% | 12.5% | 2.33 | 19,006 | 4.66 | -2.1% | 12.2% |
| politician | 138 | 29 | 21.0% | 12.5% | 1.68 | 20,222 | 3.05 | +3.9% | 4.2% |
| pacifist | 142 | 25 | 17.6% | 12.5% | 1.41 | 19,974 | 3.85 | +2.4% | 5.1% |
| shark | 130 | 16 | 12.3% | 12.5% | 0.98 | 19,202 | 4.71 | -0.6% | 8.2% |
| builder | 128 | 10 | 7.8% | 12.5% | 0.63 | 19,680 | 4.38 | +0.8% | 4.0% |
| gambler | 133 | 7 | 5.3% | 12.5% | 0.42 | 18,776 | 5.57 | -3.6% | 6.9% |
| mourner | 128 | 5 | 3.9% | 12.5% | 0.31 | 19,333 | 5.11 | -0.4% | 4.3% |
| saboteur | 137 | 5 | 3.6% | 12.5% | 0.29 | 17,432 | 6.61 | -8.7% | 8.4% |
| saint | 122 | 4 | 3.3% | 12.5% | 0.26 | 19,721 | 4.16 | +1.7% | 4.4% |
| organiser | 140 | 4 | 2.9% | 12.5% | 0.23 | 19,668 | 4.49 | +0.6% | 3.6% |
| scholar | 145 | 4 | 2.8% | 12.5% | 0.22 | 19,465 | 4.96 | -0.1% | 4.4% |

Spread: mean final BP from 17,432 to 20,802 (3,370 BP, sd 800 around 19,440); mean place from 2.28 to 6.61.

## Expanded: win rate by karma path (at the end of the season)

| path | seats | wins | win rate | fair share | win / fair | mean final BP | mean place | BP vs town mean | sd of that |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| evil | 401 | 60 | 15.0% | 12.5% | 1.20 | 18,532 | 5.34 | -3.9% | 10.4% |
| good | 635 | 84 | 13.2% | 12.5% | 1.06 | 19,669 | 4.24 | +1.2% | 6.0% |
| neutral | 564 | 56 | 9.9% | 12.5% | 0.79 | 19,803 | 4.20 | +1.5% | 4.7% |

| rivalry tier | seats | wins | win rate | fair share | win / fair | mean final BP | mean place | BP vs town mean | sd of that |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| peaceful | 142 | 25 | 17.6% | 12.5% | 1.41 | 19,974 | 3.85 | +2.4% | 5.1% |
| standard | 1191 | 154 | 12.9% | 12.5% | 1.03 | 19,621 | 4.31 | +0.8% | 6.7% |
| cutthroat | 267 | 21 | 7.9% | 12.5% | 0.63 | 18,294 | 5.68 | -4.7% | 9.3% |

| PvP | seats | wins | win rate | fair share | win / fair | mean final BP | mean place | BP vs town mean | sd of that |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| never fights | 1080 | 136 | 12.6% | 12.5% | 1.01 | 19,819 | 4.08 | +1.8% | 5.2% |
| fights (parlor, duel or hit) | 520 | 64 | 12.3% | 12.5% | 0.98 | 18,624 | 5.38 | -3.7% | 9.5% |

## Expanded: the parlors at the end of the season

| personality | final BP | cash | savings | karma | good / evil | upgrades | monuments | in a chain | mayor | BP lost to PvP | decisions / day | turns / day |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| builder | 19,680 | 7,816 | 0 | 60 | 6.3% / 0.0% | 7.7 | 2.9 | 65.6% | 0.0% | 501 | 355 | 17.1 |
| gambler | 18,776 | 5,321 | 0 | 64 | 36.1% / 0.0% | 6.4 | 2.5 | 0.0% | 0.0% | 696 | 374 | 16.5 |
| mourner | 19,333 | 3,308 | 0 | 100 | 100.0% / 0.0% | 6.8 | 2.1 | 70.3% | 0.0% | 187 | 350 | 16.7 |
| necromancer | 19,006 | 14,375 | 0 | 1 | 0.0% / 100.0% | 6.3 | 3.2 | 0.0% | 0.0% | 599 | 379 | 17.2 |
| organiser | 19,668 | 13,651 | 0 | 59 | 7.1% / 0.0% | 8.6 | 3.1 | 100.0% | 0.0% | 499 | 350 | 16.8 |
| pacifist | 19,974 | 10,357 | 0 | 100 | 100.0% / 0.0% | 6.6 | 3.0 | 0.0% | 0.0% | 0 | 363 | 16.9 |
| politician | 20,222 | 2,776 | 0 | 100 | 100.0% / 0.0% | 4.2 | 2.0 | 68.1% | 92.0% | 551 | 372 | 16.7 |
| saboteur | 17,432 | 6,907 | 0 | 1 | 0.0% / 100.0% | 8.0 | 2.6 | 0.0% | 0.0% | 92 | 314 | 16.2 |
| saint | 19,721 | 1,446 | 0 | 100 | 100.0% / 0.0% | 2.5 | 1.4 | 0.0% | 0.0% | 388 | 358 | 16.4 |
| scholar | 19,465 | 6,624 | 0 | 58 | 3.4% / 0.0% | 7.7 | 2.8 | 0.0% | 0.0% | 421 | 346 | 16.7 |
| shark | 19,202 | 41,216 | 0 | 3 | 0.0% / 100.0% | 8.2 | 4.4 | 0.0% | 0.0% | 581 | 429 | 18.0 |
| tycoon | 20,802 | 46,314 | 0 | 65 | 27.6% / 0.0% | 8.0 | 4.9 | 0.0% | 0.0% | 539 | 378 | 16.7 |

Decisions per bot-day across the town: 364 screens answered from log on to log off (the newspaper, every look at the hand of cards, every Back and every walk across the map included), of which 193 are choices (a pitch, a purchase, a vote: anything but looking and walking), for 16.1 customers a day.

## Expanded: selling

| personality | sales / day | walkouts | exact | within 3% | within 8% | bonus share of sale BP | sale BP / customer | money / sale | actions / sale | cremations | listened | coffee | blessed | happy families | sour families |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| builder | 16.6 | 0.0% | 21.5% | 15.8% | 9.7% | 22.2% | 33.5 | 823 | 7.2 | 0.1% | 82.1% | 68.2% | 1.0% | 31.2% | 38.5% |
| gambler | 15.4 | 0.1% | 26.3% | 18.0% | 11.8% | 25.7% | 33.3 | 630 | 7.4 | 0.4% | 87.0% | 73.0% | 4.1% | 33.4% | 34.7% |
| mourner | 15.4 | 0.0% | 26.5% | 16.9% | 9.8% | 25.2% | 33.8 | 561 | 7.9 | 0.0% | 77.9% | 65.1% | 66.7% | 48.6% | 25.3% |
| necromancer | 15.4 | 0.2% | 25.2% | 17.2% | 12.1% | 25.2% | 32.4 | 875 | 7.4 | 1.9% | 86.5% | 73.0% | 0.7% | 30.5% | 36.5% |
| organiser | 16.4 | 0.0% | 23.5% | 16.3% | 9.9% | 23.5% | 34.0 | 752 | 7.2 | 0.5% | 80.4% | 65.4% | 0.9% | 31.2% | 39.0% |
| pacifist | 15.6 | 0.0% | 28.8% | 18.1% | 10.1% | 27.6% | 33.7 | 712 | 8.4 | 0.7% | 81.7% | 69.3% | 71.2% | 48.3% | 32.4% |
| politician | 15.4 | 0.0% | 29.0% | 18.7% | 10.4% | 26.5% | 35.4 | 449 | 8.5 | 0.0% | 85.1% | 75.8% | 76.3% | 48.3% | 29.9% |
| saboteur | 14.4 | 0.0% | 15.5% | 11.6% | 9.5% | 20.2% | 25.4 | 666 | 5.8 | 0.3% | 76.3% | 62.7% | 0.0% | 27.7% | 44.5% |
| saint | 15.1 | 0.0% | 27.4% | 17.4% | 9.9% | 25.8% | 34.3 | 557 | 8.0 | 0.0% | 79.4% | 70.2% | 69.9% | 46.1% | 30.8% |
| scholar | 16.3 | 0.0% | 25.0% | 16.3% | 9.6% | 25.0% | 33.7 | 668 | 7.1 | 0.1% | 78.0% | 63.8% | 0.4% | 28.7% | 45.6% |
| shark | 17.0 | 0.4% | 22.6% | 16.0% | 9.8% | 23.5% | 33.7 | 1,624 | 7.8 | 10.5% | 92.2% | 78.2% | 0.0% | 31.6% | 35.2% |
| tycoon | 16.3 | 0.0% | 24.8% | 17.1% | 9.6% | 24.0% | 35.3 | 1,522 | 7.7 | 3.9% | 84.2% | 71.0% | 1.1% | 32.8% | 37.8% |

Walkouts by trait (all customers who had the trait, hidden or shown):

| trait | customers | walkouts | rate |
| --- | --- | --- | --- |
| nervous | 43455 | 63 | 0.1% |
| hurry | 42760 | 50 | 0.1% |
| heir | 44521 | 46 | 0.1% |
| grudge | 42684 | 40 | 0.1% |
| hothead | 44036 | 40 | 0.1% |
| devout | 45345 | 40 | 0.1% |
| relieved | 42121 | 35 | 0.1% |
| broke | 42452 | 34 | 0.1% |
| foodie | 44330 | 34 | 0.1% |
| estranged | 42138 | 31 | 0.1% |
| loudmouth | 43826 | 32 | 0.1% |
| music-lover | 44716 | 32 | 0.1% |
| green | 41949 | 30 | 0.1% |
| conspiracy | 44609 | 30 | 0.1% |
| country-club | 43701 | 29 | 0.1% |
| germophobe | 43958 | 29 | 0.1% |
| minimalist | 43302 | 28 | 0.1% |
| gossip | 44245 | 28 | 0.1% |
| sentimental | 44449 | 28 | 0.1% |
| executor | 42009 | 26 | 0.1% |
| shutterbug | 44419 | 27 | 0.1% |
| skeptic | 46087 | 28 | 0.1% |
| litigious | 44836 | 27 | 0.1% |
| accountant | 45859 | 27 | 0.1% |
| windfall | 42575 | 25 | 0.1% |
| death-fan | 46866 | 27 | 0.1% |
| rivalry | 46975 | 26 | 0.1% |
| no-nonsense | 43539 | 24 | 0.1% |
| tight-lipped | 44296 | 24 | 0.1% |
| superstitious | 44108 | 23 | 0.1% |
| showoff | 46461 | 24 | 0.1% |
| traditionalist | 42800 | 22 | 0.1% |
| haggler | 46950 | 23 | 0.0% |
| new-age | 43061 | 20 | 0.0% |
| heartbroken | 39830 | 18 | 0.0% |
| collector | 46034 | 19 | 0.0% |
| animal-lover | 44808 | 18 | 0.0% |
| pincher | 42955 | 17 | 0.0% |
| know-it-all | 46592 | 18 | 0.0% |
| been-here | 46734 | 18 | 0.0% |
| pushover | 44849 | 14 | 0.0% |
| prodigal | 40182 | 11 | 0.0% |
| chatterbox | 42868 | 11 | 0.0% |
| serene | 42151 | 6 | 0.0% |

| special customer | met | sales | walkouts |
| --- | --- | --- | --- |
| county-contract | 2566 | 0 | 0 |
| celebrity | 2635 | 2630 | 5 |
| pre-need | 5172 | 5171 | 1 |
| clown-family | 2673 | 2672 | 1 |
| jackpot | 2378 | 2364 | 14 |
| pet | 4973 | 4969 | 4 |
| teller | 2487 | 2486 | 1 |
| nurse-referral | 2526 | 0 | 0 |
| june | 2432 | 2428 | 4 |
| cousin-sal | 2471 | 0 | 0 |
| inspector-mudge | 2346 | 0 | 0 |
| zookeeper | 2296 | 2294 | 2 |
| mob-boss | 2321 | 2320 | 1 |
| coroner | 2269 | 0 | 0 |
| black-widow | 2468 | 2468 | 0 |
| lucius-vane | 2172 | 2170 | 2 |
| father-smyth | 2488 | 2487 | 1 |
| old-man-withers | 2580 | 2579 | 1 |
| fake-death | 2199 | 0 | 0 |
| the-twins | 2098 | 0 | 0 |
| the-mournes | 2200 | 2199 | 1 |
| blaine-director | 2219 | 2218 | 1 |
| ghost-crew | 2194 | 0 | 0 |
| the-mayor | 2139 | 2138 | 1 |
| elijah | 2266 | 2266 | 0 |
| the-count | 2010 | 2009 | 1 |

Packages sold (share of all sales reaching each tier or higher bought on that sale):

| package | tier 1 | tier 2 | tier 3 | tier 4 | tier 5 |
| --- | --- | --- | --- | --- | --- |
| plot | 10.2% | 3.2% | 6.0% | 0.0% | 0.0% |
| service | 1.8% | 0.3% | 0.1% | 0.1% | 0.0% |
| embalming | 3.0% | 2.0% | 0.2% | 0.2% | 0.4% |
| headstone | 2.2% | 0.2% | 0.1% | 0.0% | 0.0% |
| flowers | 1.3% | 0.2% | 0.0% | 0.0% | 0.0% |
| urn | 0.1% | 0.0% | 0.0% | 0.0% | 0.0% |

Soft-sell cards bought: 2.23 per sale.

## Expanded: money by system

Dollars earned per player-day:

| income | share | builder | gambler | mourner | necromancer | organiser | pacifist | politician | saboteur | saint | scholar | shark | tycoon |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sales | 81.2% | 13,676 | 9,702 | 8,658 | 13,432 | 12,292 | 11,084 | 6,934 | 9,577 | 8,423 | 10,885 | 27,648 | 24,811 |
| new day and mail | 5.7% | 966 | 859 | 896 | 853 | 959 | 940 | 931 | 695 | 890 | 908 | 1,014 | 1,019 |
| savings | 3.4% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 7,075 |
| body prep | 2.6% | 458 | 348 | 76 | 1,109 | 464 | 75 | 77 | 1,043 | 72 | 448 | 264 | 474 |
| loans | 2.3% | 2,656 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2,036 |
| special offers | 1.3% | 341 | 273 | 36 | 254 | 337 | 36 | 36 | 224 | 33 | 331 | 326 | 355 |
| pawn | 0.9% | 0 | 242 | 0 | 678 | 0 | 0 | 0 | 631 | 0 | 0 | 103 | 0 |
| police | 0.7% | 87 | 186 | 60 | 166 | 87 | 0 | 145 | 141 | 100 | 76 | 145 | 72 |
| rob graves | 0.6% | 0 | 0 | 0 | 577 | 0 | 0 | 0 | 589 | 0 | 0 | 0 | 0 |
| gambling | 0.5% | 0 | 974 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| parlor PvP | 0.3% | 0 | 189 | 0 | 80 | 0 | 0 | 0 | 27 | 0 | 0 | 371 | 0 |
| dig | 0.3% | 0 | 0 | 0 | 280 | 0 | 0 | 0 | 285 | 0 | 0 | 0 | 0 |
| crematorium | 0.1% | 0 | 0 | 0 | 54 | 0 | 0 | 0 | 7 | 0 | 0 | 213 | 0 |
| coroner | 0.1% | 0 | 0 | 0 | 33 | 0 | 0 | 0 | 14 | 0 | 0 | 90 | 0 |

Dollars spent per player-day:

| spending | share | builder | gambler | mourner | necromancer | organiser | pacifist | politician | saboteur | saint | scholar | shark | tycoon |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| stock | 39.1% | 6,566 | 5,831 | 3,901 | 5,690 | 5,683 | 6,609 | 3,367 | 5,489 | 4,638 | 5,200 | 9,350 | 10,575 |
| upgrades | 17.0% | 3,940 | 2,139 | 1,952 | 2,159 | 3,539 | 2,256 | 880 | 2,500 | 323 | 2,874 | 4,841 | 4,177 |
| monuments | 9.0% | 959 | 716 | 445 | 1,445 | 1,125 | 1,032 | 400 | 781 | 201 | 918 | 3,641 | 5,338 |
| tithe | 4.8% | 621 | 600 | 559 | 639 | 650 | 639 | 544 | 590 | 2,289 | 609 | 667 | 667 |
| pawn | 4.4% | 1,282 | 0 | 705 | 1,054 | 1,042 | 0 | 0 | 0 | 0 | 1,100 | 1,470 | 1,636 |
| savings | 3.5% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 7,036 |
| black market | 2.6% | 0 | 513 | 0 | 1,370 | 0 | 0 | 0 | 950 | 31 | 413 | 975 | 518 |
| loans | 2.5% | 2,735 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2,097 |
| hearse upkeep | 2.3% | 600 | 285 | 394 | 224 | 310 | 311 | 309 | 27 | 218 | 402 | 866 | 301 |
| leads | 2.2% | 0 | 0 | 0 | 1,193 | 0 | 0 | 0 | 0 | 0 | 0 | 2,897 | 0 |
| police | 1.4% | 0 | 0 | 362 | 435 | 0 | 0 | 0 | 369 | 279 | 0 | 492 | 771 |
| hits | 1.4% | 0 | 149 | 0 | 545 | 0 | 0 | 0 | 319 | 0 | 0 | 1,603 | 0 |
| story appeals | 1.3% | 0 | 0 | 389 | 496 | 0 | 338 | 309 | 459 | 369 | 0 | 0 | 0 |
| coroner | 1.2% | 268 | 0 | 220 | 0 | 257 | 249 | 155 | 0 | 256 | 358 | 128 | 301 |
| treatment | 1.1% | 143 | 248 | 118 | 373 | 147 | 0 | 267 | 134 | 207 | 117 | 171 | 162 |
| gazette | 0.8% | 0 | 176 | 0 | 401 | 0 | 0 | 428 | 0 | 0 | 0 | 460 | 0 |
| health dept | 0.7% | 109 | 98 | 73 | 217 | 99 | 82 | 62 | 0 | 82 | 104 | 192 | 107 |
| gambling | 0.6% | 0 | 1,127 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| permits | 0.5% | 187 | 50 | 133 | 0 | 186 | 0 | 0 | 0 | 178 | 183 | 0 | 0 |
| body prep | 0.4% | 46 | 70 | 104 | 42 | 44 | 102 | 100 | 36 | 96 | 46 | 107 | 39 |
| florist | 0.4% | 132 | 0 | 73 | 0 | 116 | 178 | 46 | 0 | 118 | 0 | 0 | 165 |
| chains | 0.4% | 109 | 0 | 117 | 0 | 333 | 0 | 114 | 0 | 0 | 0 | 0 | 0 |
| stolen | 0.4% | 40 | 74 | 21 | 106 | 47 | 0 | 43 | 172 | 32 | 38 | 39 | 41 |
| mournes | 0.3% | 0 | 170 | 0 | 25 | 0 | 0 | 0 | 9 | 0 | 60 | 298 | 88 |
| ordinances | 0.3% | 0 | 0 | 0 | 0 | 0 | 0 | 571 | 0 | 0 | 0 | 0 | 0 |
| rob graves | 0.3% | 0 | 0 | 0 | 245 | 0 | 0 | 0 | 220 | 0 | 0 | 0 | 0 |
| special offers | 0.3% | 39 | 34 | 39 | 41 | 35 | 43 | 35 | 40 | 39 | 42 | 39 | 41 |
| inspection | 0.2% | 140 | 0 | 0 | 0 | 0 | 0 | 102 | 72 | 129 | 0 | 0 | 0 |
| midnight (fines, collection) | 0.2% | 3 | 31 | 8 | 80 | 22 | 8 | 1 | 41 | 3 | 25 | 139 | 34 |
| crematorium | 0.2% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 161 | 251 |
| chain dues | 0.1% | 57 | 0 | 60 | 0 | 96 | 0 | 56 | 0 | 0 | 0 | 0 | 0 |
| election | 0.1% | 0 | 0 | 0 | 0 | 0 | 0 | 200 | 0 | 0 | 0 | 0 | 0 |
| bodyguard | 0.1% | 13 | 0 | 0 | 0 | 19 | 0 | 56 | 0 | 0 | 4 | 0 | 20 |
| holy water | 0.1% | 0 | 0 | 6 | 0 | 0 | 4 | 53 | 0 | 46 | 0 | 0 | 0 |
| confession | 0.0% | 0 | 0 | 2 | 0 | 0 | 2 | 0 | 0 | 2 | 0 | 0 | 0 |

## Expanded: BP by system (per player-day)

| source | share | builder | gambler | mourner | necromancer | organiser | pacifist | politician | saboteur | saint | scholar | shark | tycoon |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sales | 80.6% | 569 | 523 | 533 | 508 | 569 | 537 | 559 | 372 | 529 | 562 | 589 | 588 |
| risks | 8.3% | 65 | 43 | 60 | 37 | 64 | 58 | 63 | 39 | 59 | 65 | 47 | 66 |
| parlor PvP | 2.3% | 0 | 22 | 0 | 34 | 0 | 0 | 0 | 127 | 0 | 0 | 0 | 0 |
| monuments | 2.0% | 14 | 11 | 7 | 16 | 15 | 15 | 7 | 12 | 4 | 14 | 23 | 26 |
| service | 1.5% | 0 | 1 | 30 | 0 | 0 | 30 | 29 | 0 | 29 | 0 | 0 | 0 |
| midnight | 1.4% | 8 | 6 | 8 | 11 | 8 | 12 | 16 | 7 | 11 | 7 | 8 | 13 |
| duels | 1.1% | 0 | 22 | 0 | 26 | 0 | 0 | 0 | 36 | 0 | 0 | 0 | 0 |
| tithe | 1.0% | 5 | 6 | 7 | 3 | 5 | 8 | 7 | 2 | 27 | 5 | 3 | 6 |
| wait (events, scripts) | 0.7% | 5 | 4 | 5 | 4 | 5 | 5 | 5 | 4 | 4 | 5 | 4 | 5 |
| yangs | 0.6% | -0 | -1 | -5 | -1 | -0 | -0 | -0 | -21 | -0 | -0 | -20 | -0 |
| special offers | 0.2% | 2 | 1 | 1 | 1 | 2 | 1 | 1 | 1 | 1 | 2 | 2 | 2 |
| new day and mail | 0.2% | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| walkout gifts | 0.0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Expanded: turns by use (per player-day)

| use | share | builder | gambler | mourner | necromancer | organiser | pacifist | politician | saboteur | saint | scholar | shark | tycoon |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| wait (events, scripts) | 95.9% | 17 | 16 | 16 | 16 | 17 | 16 | 16 | 15 | 15 | 17 | 17 | 17 |
| service | 1.8% | 0 | 0 | 1 | 0 | 0 | 1 | 1 | 0 | 1 | 0 | 0 | 0 |
| duels | 1.1% | 0 | 1 | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| seance | 1.0% | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| tour | 0.2% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Expanded: time by place (decisions per player-day)

| scene | share | builder | gambler | mourner | necromancer | organiser | pacifist | politician | saboteur | saint | scholar | shark | tycoon |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| neg | 76.2% | 280 | 273 | 273 | 271 | 279 | 292 | 294 | 202 | 271 | 275 | 321 | 294 |
| desk | 7.8% | 29 | 29 | 27 | 29 | 29 | 26 | 28 | 28 | 27 | 28 | 30 | 29 |
| map | 3.9% | 11 | 14 | 14 | 19 | 11 | 12 | 13 | 16 | 16 | 11 | 19 | 14 |
| store | 2.6% | 9 | 10 | 8 | 10 | 9 | 10 | 8 | 10 | 9 | 9 | 11 | 11 |
| competitors | 0.9% | 0 | 8 | 0 | 8 | 0 | 0 | 0 | 13 | 0 | 0 | 9 | 0 |
| church | 0.8% | 1 | 6 | 5 | 1 | 1 | 6 | 6 | 1 | 8 | 1 | 1 | 1 |
| risk | 0.8% | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| reaper-club | 0.7% | 0 | 7 | 0 | 6 | 0 | 0 | 0 | 5 | 3 | 3 | 5 | 4 |
| graveyard | 0.7% | 1 | 6 | 1 | 6 | 1 | 1 | 1 | 7 | 4 | 1 | 1 | 1 |
| city-hall | 0.6% | 5 | 1 | 3 | 1 | 4 | 1 | 6 | 2 | 2 | 1 | 1 | 1 |
| mournes | 0.5% | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 1 | 2 | 3 | 3 | 3 |
| police | 0.4% | 2 | 2 | 1 | 2 | 2 | 0 | 2 | 2 | 2 | 1 | 2 | 2 |
| parlor | 0.4% | 1 | 1 | 1 | 4 | 1 | 1 | 1 | 4 | 0 | 1 | 1 | 1 |
| bank | 0.4% | 3 | 1 | 2 | 1 | 1 | 1 | 1 | 1 | 2 | 1 | 1 | 6 |
| yangs | 0.4% | 0 | 0 | 2 | 1 | 0 | 1 | 0 | 5 | 1 | 0 | 5 | 0 |
| pawn-shop | 0.4% | 1 | 2 | 1 | 3 | 1 | 0 | 0 | 2 | 0 | 1 | 3 | 2 |
| coroner | 0.3% | 1 | 0 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 3 | 1 |
| hospital | 0.3% | 1 | 1 | 1 | 3 | 1 | 0 | 1 | 1 | 1 | 1 | 3 | 1 |
| news | 0.3% | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| stats | 0.3% | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| battle | 0.2% | 0 | 1 | 0 | 2 | 0 | 0 | 0 | 6 | 0 | 0 | 0 | 0 |
| spirit-university | 0.2% | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| florist | 0.2% | 1 | 0 | 1 | 0 | 1 | 2 | 1 | 0 | 2 | 0 | 0 | 2 |
| cafe | 0.2% | 0 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0 | 0 |
| health-department | 0.1% | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |
| crematorium | 0.1% | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 1 | 1 | 0 | 2 | 1 |
| gazette | 0.1% | 0 | 1 | 0 | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 1 | 0 |
| tutorial | 0.1% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Expanded: what each choice returns

| choice | measure | return | volume (turns, $ or uses) |
| --- | --- | --- | --- |
| a customer (Wait for Customer) | BP per turn | 33.220 | 774380 |
| leading the service | BP per turn | 32.806 | 14615 |
| a graveyard duel (challenger) | BP per turn | 39.910 | 8513 |
| robbing a grave | $ per try | 400.172 | 7129 |
| digging at the office | $ per try | 322.630 | 7129 |
| tending the graves | uses | - | 6802 |
| the seance | turns used | - | 8444 |
| monuments | BP per $ | 0.010 | 66670000 |
| tithes | BP per $ | 0.009 | 35715000 |
| hits (BP the victim lost per $) | BP per $ | 0.003 | 10347650 |
| special offers | BP per offer | 3.645 | 13041 |
| body prep choices | BP per choice | 0.000 | 320656 |
| risks taken | BP per risk | 42.881 | 62128 |

A lead from the nurse ($1,500) brings a sure, richer customer: 26,053 lead customers were met. Sale BP per customer over all customers: 33.22.

Parlor upgrades (share of seats that bought each, and the mean day bought):

| upgrade | bought | share of seats | mean day |
| --- | --- | --- | --- |
| paint | 1600 | 100.0% | 2.5 |
| coffee-machine | 1600 | 100.0% | 3.9 |
| storeroom | 1526 | 95.4% | 11.1 |
| florist-cooler | 1440 | 90.0% | 14.3 |
| viewing-room | 1318 | 82.4% | 16.3 |
| embalming-lab | 1053 | 65.8% | 18.9 |
| incinerator | 589 | 36.8% | 22.3 |
| memorial-garden | 400 | 25.0% | 21.5 |
| chapel | 390 | 24.4% | 21.9 |
| billboard | 288 | 18.0% | 25.6 |
| guard-dog | 265 | 16.6% | 6.8 |
| alarm | 221 | 13.8% | 18.5 |
| night-watchman | 117 | 7.3% | 25.1 |
| mausoleum | 35 | 2.2% | 26.6 |

The three late upgrades the engine pass made cheaper and better, and what they return:

| upgrade | bought | share of seats | mean day | cost with permit ($) | BP / day vs peers (after - before) | days owned | BP over the season | BP per $ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| night-watchman | 117 | 7.3% | 25.1 | 12,000 | +6.1 (se 8.7) | 4.9 | 30 | 0.002 |
| billboard | 288 | 18.0% | 25.6 | 21,500 | +42.7 (se 5.4) | 4.4 | 186 | 0.009 |
| memorial-garden | 400 | 25.0% | 21.5 | 24,000 | +51.5 (se 3.5) | 8.5 | 438 | 0.018 |

BP per day is measured against the same personality's seats on the same day that did not yet own the upgrade, so the season's rise in income cancels; the standard error is across buyers. The monuments return about 0.010 BP a dollar, so an upgrade that returns less is not worth buying for points alone.

Monument tiers built: tier 1: 1600, tier 2: 1520, tier 3: 1041, tier 4: 314, tier 5: 164 (of 1600 seats).

Permits bought: signage 805, zoning 793, crematory 122. Black-market buys: morty-rib 884, rabbit-foot 315, coroner-list 1825, clover 349, testimonials 630, monster-scale 266, riot-shield 308, hot-casket 1797, tap-water 285, sal-pad 521, haunted-casket 360, real-water 467, cop-day-off 262, filed-tag 586, bruno 391, used-wreaths 512, forged-permit 222, mayor-key 168, vest 317.

## Expanded: the eight newer places (sections 30 and 31)

| place | visited by (share of seats) | used (share of seats) | presses per user-day | $ out per user | $ back per user (incl. sale extras) | net $ per user | karma per user | luck per user | word of mouth per user |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| police | 91.1% | 88.1% | 0.46 | 7,408 | 3,580 | -3,828 | -2 | 0.0 | 0.0 |
| crematorium | 49.3% | 27.6% | 0.22 | 3,513 | 6,792 | 3,279 | -4 | 0.9 | 0.0 |
| florist | 57.6% | 57.5% | 0.47 | 3,547 | 3,682 | 135 | 0 | 0.0 | 0.7 |
| gazette | 33.4% | 33.4% | 0.22 | 10,987 | 0 | -10,987 | -2 | 0.0 | -0.6 |
| coroner | 91.7% | 84.6% | 0.31 | 6,471 | 401 | -6,070 | -1 | 0.3 | 5.9 |
| health dept | 91.4% | 91.3% | 0.14 | 3,344 | 0 | -3,344 | -0 | 0.0 | 3.9 |
| pawn | 74.9% | 74.9% | 0.75 | 27,378 | 5,578 | -21,800 | 0 | 0.0 | 0.0 |
| mournes | 100.0% | 91.8% | 0.95 | 1,743 | 0 | -1,743 | 15 | 0.7 | 0.0 |

Sale extras: oven slots used 1,676 (saved $1,927,400); bouquets used 21,315 (earned $3,387,420); attacks recorded on the police blotter 16,365.

| action | presses | seats that used it |
| --- | --- | --- |
| mournes:hold | 35453 | 1329 |
| pawn-shop:loot | 11129 | 534 |
| pawn-shop:lot:wood | 8857 | 928 |
| police:report | 8318 | 892 |
| pawn-shop:lot:silver | 7064 | 898 |
| florist:buy | 6926 | 646 |
| police:settle | 6380 | 517 |
| coroner:certificate | 4769 | 1066 |
| florist:bundle | 4217 | 646 |
| health-department:inspect | 3714 | 1199 |
| police:backdoor | 3454 | 389 |
| mournes:spy | 3382 | 537 |
| coroner:tip | 3246 | 275 |
| mournes:undercut | 3088 | 263 |
| coroner:favour | 2311 | 705 |
| coroner:quiet | 1809 | 287 |
| florist:church | 1793 | 529 |
| gazette:classified | 1741 | 267 |
| police:patrol | 1502 | 334 |
| crematorium:diamonds | 1462 | 230 |
| health-department:fine | 1317 | 818 |
| health-department:complaint | 1040 | 261 |
| gazette:smear | 882 | 256 |
| crematorium:scatter | 804 | 212 |
| gazette:puff | 709 | 138 |
| crematorium:bulk | 647 | 238 |
| coroner:burial | 502 | 418 |
| gazette:display | 162 | 104 |

Net dollars are what a user took in at the counter, plus the oven's saved wholesale and the bouquets' payouts, minus what it paid there (the second-hand caskets' value is not counted: they replace Di-Mart stock). A dollar buys about 0.010 BP at the monuments, so a place that nets money is a source of points, and a place that costs money has to give back karma, luck, word of mouth or a rival's loss. Karma, luck and word of mouth are totals per user over the season. The BP return of a place cannot be read as it is for an upgrade (most users start on day 2 to 3, so there is no control), so a place's effect on its users is measured by leaving it out (`--places-off`), see `docs/balance/expanded-tuning-log.md` round 19.

## Expanded: PvP, duels and hits

| measure | value |
| --- | --- |
| duels started | 8513 |
| challenger won / lost / yielded | 7111 / 930 / 472 |
| BP won by duel winners / lost by losers | 416,466 / 205,788 |
| duels with a Shove: share of duels / challenger won, lost, yielded / mean BP | 5.7% / 149, 301, 32 / -1.1 |
| duels without a Shove: challenger won, lost, yielded / mean BP | 6962, 629, 440 / 42.4 |
| Shove pressed (times) | 489 |
| hits resolved / landed | 737 / 499 |
| BP taken from hit victims | 33,661 |
| cash stolen in burglaries | 2,632,748 |

Hits by the parlor that hired them:

| personality | hired | landed | hirer behind the target | $ spent | BP taken from targets | BP per $ |
| --- | --- | --- | --- | --- | --- | --- |
| gambler | 43 | 28 | 95.3% | 595,600 | 1,896 | 0.003 |
| necromancer | 163 | 118 | 92.6% | 2,189,600 | 7,913 | 0.004 |
| saboteur | 110 | 81 | 94.5% | 1,310,400 | 5,256 | 0.004 |
| shark | 421 | 272 | 97.9% | 6,252,050 | 18,596 | 0.003 |

BP lost to other parlors per player-day, by victim and venue:

| personality | parlor fights | duels | hits | total | share of final BP |
| --- | --- | --- | --- | --- | --- |
| builder | 10.4 | 5.5 | 0.8 | 16.7 | 2.5% |
| gambler | 17.9 | 4.8 | 0.5 | 23.2 | 3.7% |
| mourner | 3.0 | 2.7 | 0.5 | 6.2 | 1.0% |
| necromancer | 16.3 | 3.1 | 0.6 | 20.0 | 3.2% |
| organiser | 9.8 | 6.1 | 0.7 | 16.6 | 2.5% |
| pacifist | 0.0 | 0.0 | 0.0 | 0.0 | 0.0% |
| politician | 9.4 | 7.2 | 1.7 | 18.4 | 2.7% |
| saboteur | 2.3 | 0.6 | 0.2 | 3.1 | 0.5% |
| saint | 6.3 | 5.1 | 1.6 | 12.9 | 2.0% |
| scholar | 8.7 | 4.7 | 0.6 | 14.0 | 2.2% |
| shark | 15.5 | 3.7 | 0.1 | 19.4 | 3.0% |
| tycoon | 8.5 | 8.4 | 1.1 | 18.0 | 2.6% |

The most-targeted peaceful parlor in each town (never fights) lost on average 820 BP over the season, 3.9% of what it would otherwise have had (worst town: 8.7%); it finished at mean place 3.00.

## Expanded: the house

| game and stake | plays | staked | returned | return per $ |
| --- | --- | --- | --- | --- |
| slots.100 | 8367 | 836,700 | 813,000 | 0.972 |
| slots.1000 | 2523 | 2,523,000 | 1,917,000 | 0.760 |
| slots.500 | 3779 | 1,889,500 | 1,908,500 | 1.010 |

Gamblers' net: gambler -153 $/day on 1,316 $/day staked.

## Expanded: the bank

| personality | loans taken | borrowed $ | repaid $ | collected | defaulted | written off $ | default BP | savings interest $ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| builder | 1437 | 10,503,425 | 10,503,425 | 0 | 0 | 0 | 0 | 0 |
| gambler | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| mourner | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| necromancer | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| organiser | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| pacifist | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| politician | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| saboteur | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| saint | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| scholar | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| shark | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tycoon | 1386 | 7,737,051 | 7,737,051 | 0 | 0 | 0 | 0 | 141,330 |

## Expanded: City Hall and chains

| measure | value |
| --- | --- |
| ordinance ballots counted | 800 |
| votes per ballot / players | 8.00 / 8.00 |
| lobbying votes bought | 945 |
| elections held (of towns) | 200 of 200 |
| candidates per election | 0.64 |
| votes per election / players | 5.08 / 8.00 |
| campaign ads bought | 13 |
| mayors by personality | politician 127 |
| chains founded / joined | 140 / 268 |
| chains alive at the end, mean members | 140, 2.91 |

| chain | seats | wins | win rate | fair share | win / fair | mean final BP | mean place | BP vs town mean | sd of that |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| no chain | 1192 | 163 | 13.7% | 12.5% | 1.09 | 19,307 | 4.58 | -0.4% | 8.1% |
| in a chain | 408 | 37 | 9.1% | 12.5% | 0.73 | 19,794 | 4.27 | +1.0% | 4.3% |

## Expanded: the Daily Challenge

| difficulty | runs | mean score | sd | min | max |
| --- | --- | --- | --- | --- | --- |
| normal | 72 | 420.4 | 61.1 | 313 | 645 |
| hard | 72 | 418.5 | 66.1 | 295 | 649 |
| easy | 72 | 365.4 | 54.3 | 206 | 494 |

6 challenges. Within one challenge (same customers for everyone) the scores spread by 236 BP on average from the worst run to the best; across challenges the hard bots' mean score varies by 44 BP (sd), the luck of the day.

## Expanded: dead choices

Choices offered to at least 20 seats but used by fewer than 2% of them. Bots follow committed strategies, so a low share can mean no personality is written to want it; the returns table above says whether it deserves one.

| choice | seats offered | seats used | share | uses |
| --- | --- | --- | --- | --- |
| news:crime | 1600 | 0 | 0.0% | 0 |
| news:yesterday | 1600 | 0 | 0.0% | 0 |
| news:announce | 1600 | 0 | 0.0% | 0 |
| tutorial:skip | 1600 | 0 | 0.0% | 0 |
| store:security | 1600 | 0 | 0.0% | 0 |
| store:supplies | 1600 | 0 | 0.0% | 0 |
| store:restock | 1600 | 0 | 0.0% | 0 |
| bank:all-wood | 1600 | 0 | 0.0% | 0 |
| bank:exchange | 1600 | 0 | 0.0% | 0 |
| spirit-university:library | 1600 | 0 | 0.0% | 0 |
| mournes:truce | 1600 | 0 | 0.0% | 0 |
| florist:ward | 921 | 0 | 0.0% | 0 |
| health-department:buy | 1463 | 0 | 0.0% | 0 |
| city-hall:leavechain | 408 | 0 | 0.0% | 0 |
| graveyard:look | 1600 | 0 | 0.0% | 0 |
| reaper-club:buy:tiny | 889 | 0 | 0.0% | 0 |
| crematorium:rent | 788 | 0 | 0.0% | 0 |
| reaper-club:draw | 133 | 0 | 0.0% | 0 |
| reaper-club:shots | 133 | 0 | 0.0% | 0 |
| parlor:markup:-10 | 253 | 0 | 0.0% | 0 |
| parlor:markup:30 | 253 | 0 | 0.0% | 0 |
| parlor:markup:0 | 253 | 0 | 0.0% | 0 |
| bank:depositall | 123 | 0 | 0.0% | 0 |
| bank:withdraw | 123 | 0 | 0.0% | 0 |
| city-hall:permit:crematory | 796 | 2 | 0.3% | 2 |

Usage of every choice (seats that used it at least once among seats that were offered it):

| choice | uses | per seat | seats offered | share of them that used it |
| --- | --- | --- | --- | --- |
| neg:soft | 3188914 | 1993.1 | 1600 | 100.0% |
| neg:card | 2561588 | 1601.0 | 1600 | 100.0% |
| neg:packages | 1079949 | 675.0 | 1600 | 100.0% |
| neg:listen | 1037955 | 648.7 | 1600 | 100.0% |
| desk:wait | 961634 | 601.0 | 1600 | 100.0% |
| neg:done | 756846 | 473.0 | 1600 | 100.0% |
| neg:hard | 549762 | 343.6 | 1600 | 100.0% |
| neg:coffee | 527253 | 329.5 | 1600 | 100.0% |
| neg:pkg:plot | 369232 | 230.8 | 1600 | 100.0% |
| prep:start | 320656 | 200.4 | 1600 | 100.0% |
| prep:choice | 320656 | 200.4 | 1600 | 100.0% |
| neg:bless | 179369 | 112.1 | 717 | 100.0% |
| store:casket:0 | 155557 | 97.2 | 1600 | 100.0% |
| neg:discount | 150281 | 93.9 | 1600 | 100.0% |
| place:funeral-home | 103266 | 64.5 | 1600 | 100.0% |
| neg:pkg:embalming | 102222 | 63.9 | 1600 | 100.0% |
| place:store | 90319 | 56.4 | 1600 | 100.0% |
| store:casket:1 | 80692 | 50.4 | 1600 | 100.0% |
| neg:guilt | 76074 | 47.5 | 1600 | 100.0% |
| risk:take | 62128 | 38.8 | 1600 | 99.3% |
| place:mournes | 53359 | 33.3 | 1600 | 100.0% |
| desk:quit | 48000 | 30.0 | 1600 | 100.0% |
| store:caskets | 47953 | 30.0 | 1600 | 100.0% |
| place:coroner | 42393 | 26.5 | 1600 | 91.7% |
| place:police-station | 41923 | 26.2 | 1600 | 91.1% |
| neg:pkg:headstone | 39034 | 24.4 | 1600 | 100.0% |
| place:church | 38168 | 23.9 | 1600 | 100.0% |
| place:pawn-shop | 37724 | 23.6 | 1600 | 74.9% |
| neg:pkg:service | 37538 | 23.5 | 1600 | 100.0% |
| neg:pkg:flowers | 36846 | 23.0 | 1600 | 100.0% |
| church:tithe | 35715 | 22.3 | 1600 | 100.0% |
| mournes:hold | 35453 | 22.2 | 1600 | 83.1% |
| place:reaper-club | 32626 | 20.4 | 1600 | 62.9% |
| place:hospital | 30803 | 19.3 | 1600 | 86.9% |
| place:graveyard | 29449 | 18.4 | 1600 | 100.0% |
| place:yangs | 24455 | 15.3 | 1600 | 55.1% |
| place:florist | 23422 | 14.6 | 1600 | 57.6% |
| place:bank | 23230 | 14.5 | 1600 | 100.0% |
| church:bingo-card | 21648 | 13.5 | 676 | 100.0% |
| reaper-club:market | 20507 | 12.8 | 1007 | 92.4% |
| competitors:visit | 20123 | 12.6 | 534 | 100.0% |
| place:city-hall | 19846 | 12.4 | 1600 | 100.0% |
| battle:attack | 19781 | 12.4 | 404 | 100.0% |
| neg:sympathy | 19663 | 12.3 | 1600 | 99.7% |
| competitors:trydoor | 18584 | 11.6 | 534 | 100.0% |
| parlor:upgrades | 18316 | 11.4 | 1600 | 100.0% |
| place:competitors | 17064 | 10.7 | 1600 | 33.4% |
| place:crematorium | 16981 | 10.6 | 1600 | 49.3% |
| neg:cremation | 16154 | 10.1 | 583 | 99.3% |
| competitors:look | 16020 | 10.0 | 534 | 100.0% |
| bank:all-gold | 15802 | 9.9 | 1600 | 100.0% |
| church:bingo | 15766 | 9.9 | 1600 | 42.3% |
| place:cafe | 15568 | 9.7 | 1600 | 100.0% |
| graveyard:swing | 15444 | 9.7 | 404 | 99.8% |
| place:health-department | 14867 | 9.3 | 1600 | 91.4% |
| reaper-club:slots | 14669 | 9.2 | 133 | 100.0% |
| church:serve | 14615 | 9.1 | 579 | 100.0% |
| store:casket:2 | 13907 | 8.7 | 1600 | 89.3% |
| graveyard:monuments | 13669 | 8.5 | 1600 | 100.0% |
| neg:offer:accept | 13041 | 8.2 | 1599 | 99.6% |
| place:spirit-university | 12660 | 7.9 | 1600 | 100.0% |
| reaper-club:pay | 12614 | 7.9 | 979 | 100.0% |
| place:gazette | 12401 | 7.8 | 1600 | 33.4% |
| city-hall:chains | 12329 | 7.7 | 1600 | 33.4% |
| yangs:menu | 11383 | 7.1 | 546 | 100.0% |
| tutorial:next | 11200 | 7.0 | 1600 | 100.0% |
| pawn-shop:loot | 11129 | 7.0 | 1182 | 45.2% |
| competitors:attack | 11054 | 6.9 | 534 | 75.7% |
| hospital:lead | 10730 | 6.7 | 1390 | 19.0% |
| graveyard:duel | 10606 | 6.6 | 526 | 76.8% |
| spirit-university:psych | 10495 | 6.6 | 1600 | 99.9% |
| risk:decline | 10436 | 6.5 | 1600 | 82.3% |
| battle:yellwin | 9726 | 6.1 | 404 | 100.0% |
| city-hall:ordinance | 8947 | 5.6 | 1600 | 100.0% |
| pawn-shop:lot:wood | 8857 | 5.5 | 1198 | 77.5% |
| reaper-club:seance | 8444 | 5.3 | 399 | 100.0% |
| hospital:treat | 8335 | 5.2 | 1384 | 95.4% |
| city-hall:inspection | 8328 | 5.2 | 1600 | 32.8% |
| police:report | 8318 | 5.2 | 1409 | 63.3% |
| yangs:tiger | 8010 | 5.0 | 881 | 30.3% |
| store:hearse | 7914 | 4.9 | 1600 | 99.4% |
| graveyard:rob | 7129 | 4.5 | 399 | 67.9% |
| parlor:dig | 7129 | 4.5 | 399 | 67.9% |
| pawn-shop:lot:silver | 7064 | 4.4 | 1198 | 75.0% |
| florist:buy | 6926 | 4.3 | 921 | 70.1% |
| graveyard:tend | 6802 | 4.3 | 688 | 17.7% |
| competitors:steal | 6639 | 4.1 | 534 | 100.0% |
| city-hall:vote | 6400 | 4.0 | 1600 | 100.0% |
| police:settle | 6380 | 4.0 | 1409 | 36.7% |
| neg:offer:decline | 5628 | 3.5 | 1599 | 87.7% |
| arc:give:church | 5355 | 3.3 | 846 | 55.3% |
| coroner:certificate | 4769 | 3.0 | 1467 | 72.7% |
| graveyard:monument | 4639 | 2.9 | 1600 | 100.0% |
| florist:bundle | 4217 | 2.6 | 921 | 70.1% |
| arc:give:reaper-club | 4156 | 2.6 | 979 | 27.7% |
| store:hearse-look | 3971 | 2.5 | 1590 | 100.0% |
| store:buy | 3943 | 2.5 | 1590 | 100.0% |
| health-department:inspect | 3714 | 2.3 | 1463 | 82.0% |
| neg:raise | 3675 | 2.3 | 399 | 100.0% |
| police:backdoor | 3454 | 2.2 | 1458 | 26.7% |
| mournes:spy | 3382 | 2.1 | 1600 | 33.6% |
| coroner:tip | 3246 | 2.0 | 1467 | 18.7% |
| mournes:undercut | 3088 | 1.9 | 1600 | 16.4% |
| bank:loan | 2823 | 1.8 | 1600 | 15.7% |
| bank:borrow | 2823 | 1.8 | 251 | 100.0% |
| bank:repay | 2823 | 1.8 | 251 | 100.0% |
| bank:savings | 2647 | 1.7 | 1600 | 7.7% |
| yangs:dragon | 2477 | 1.5 | 881 | 26.4% |
| coroner:favour | 2311 | 1.4 | 1467 | 48.1% |
| neg:pkg:urn | 2151 | 1.3 | 573 | 68.8% |
| bank:deposit | 2024 | 1.3 | 123 | 100.0% |
| reaper-club:games | 1971 | 1.2 | 1007 | 13.2% |
| reaper-club:buy:coroner-list | 1825 | 1.1 | 905 | 44.2% |
| coroner:quiet | 1809 | 1.1 | 705 | 40.7% |
| reaper-club:buy:hot-casket | 1797 | 1.1 | 910 | 42.2% |
| florist:church | 1793 | 1.1 | 921 | 57.4% |
| gazette:classified | 1741 | 1.1 | 535 | 49.9% |
| arc:give:city-hall | 1734 | 1.1 | 985 | 33.8% |
| city-hall:election | 1709 | 1.1 | 1600 | 64.2% |
| spirit-university:strength | 1675 | 1.0 | 1600 | 25.3% |
| tutorial:start | 1600 | 1.0 | 1600 | 100.0% |
| parlor:buy:paint | 1600 | 1.0 | 1600 | 100.0% |
| parlor:buy:coffee-machine | 1600 | 1.0 | 1600 | 100.0% |
| parlor:buy:storeroom | 1526 | 1.0 | 1533 | 99.5% |
| police:patrol | 1502 | 0.9 | 1458 | 22.9% |
| city-hall:certify | 1482 | 0.9 | 525 | 83.6% |
| crematorium:diamonds | 1462 | 0.9 | 442 | 52.0% |
| parlor:buy:florist-cooler | 1440 | 0.9 | 1534 | 93.9% |
| city-hall:permits | 1330 | 0.8 | 1600 | 49.8% |
| bank:transferhome | 1327 | 0.8 | 1600 | 15.6% |
| bank:transfer | 1327 | 0.8 | 250 | 100.0% |
| bank:transfer-tier | 1327 | 0.8 | 250 | 100.0% |
| parlor:buy:viewing-room | 1318 | 0.8 | 1348 | 97.8% |
| health-department:fine | 1317 | 0.8 | 818 | 100.0% |
| parlor:buy:embalming-lab | 1053 | 0.7 | 1481 | 71.1% |
| battle:yelllost | 1044 | 0.7 | 315 | 100.0% |
| hospital:leave-room | 1044 | 0.7 | 315 | 100.0% |
| health-department:complaint | 1040 | 0.7 | 264 | 98.9% |
| city-hall:elect | 1016 | 0.6 | 1016 | 100.0% |
| city-hall:invite | 969 | 0.6 | 322 | 43.5% |
| reaper-club:hit | 953 | 0.6 | 1007 | 34.6% |
| city-hall:lobby | 945 | 0.6 | 1600 | 8.6% |
| yangs:sparrow | 896 | 0.6 | 881 | 14.5% |
| reaper-club:buy:morty-rib | 884 | 0.6 | 909 | 29.7% |
| gazette:smear | 882 | 0.6 | 535 | 47.9% |
| crematorium:scatter | 804 | 0.5 | 442 | 48.0% |
| church:water | 716 | 0.4 | 1123 | 28.5% |
| gazette:puff | 709 | 0.4 | 535 | 25.8% |
| spirit-university:hp | 675 | 0.4 | 1600 | 8.6% |
| city-hall:permit:signage | 668 | 0.4 | 796 | 83.9% |
| city-hall:permit:zoning | 660 | 0.4 | 796 | 82.9% |
| crematorium:bulk | 647 | 0.4 | 788 | 30.2% |
| reaper-club:buy:testimonials | 630 | 0.4 | 906 | 14.3% |
| bank:withdrawall | 623 | 0.4 | 123 | 100.0% |
| parlor:buy:incinerator | 589 | 0.4 | 944 | 62.4% |
| reaper-club:buy:filed-tag | 586 | 0.4 | 858 | 28.9% |
| reaper-club:buy:sal-pad | 521 | 0.3 | 882 | 14.5% |
| reaper-club:buy:used-wreaths | 512 | 0.3 | 909 | 15.0% |
| coroner:burial | 502 | 0.3 | 705 | 59.3% |
| graveyard:shove | 489 | 0.3 | 404 | 64.4% |
| city-hall:bribe | 487 | 0.3 | 137 | 100.0% |
| graveyard:yield | 472 | 0.3 | 404 | 60.1% |
| reaper-club:buy:real-water | 467 | 0.3 | 865 | 14.9% |
| parlor:rivalry | 409 | 0.3 | 1600 | 25.6% |
| parlor:buy:memorial-garden | 400 | 0.3 | 632 | 63.3% |
| reaper-club:buy:bruno | 391 | 0.2 | 876 | 14.7% |
| parlor:buy:chapel | 390 | 0.2 | 397 | 98.2% |
| reaper-club:buy:haunted-casket | 360 | 0.2 | 853 | 14.4% |
| reaper-club:buy:clover | 349 | 0.2 | 911 | 14.1% |
| reaper-club:buy:vest | 317 | 0.2 | 893 | 14.2% |
| reaper-club:buy:rabbit-foot | 315 | 0.2 | 907 | 13.2% |
| reaper-club:buy:riot-shield | 308 | 0.2 | 846 | 24.3% |
| parlor:buy:billboard | 288 | 0.2 | 640 | 45.0% |
| reaper-club:buy:tap-water | 285 | 0.2 | 908 | 13.0% |
| battle:run | 284 | 0.2 | 404 | 45.0% |
| city-hall:join | 268 | 0.2 | 268 | 100.0% |
| parlor:rivalry:cutthroat | 267 | 0.2 | 409 | 65.3% |
| reaper-club:buy:monster-scale | 266 | 0.2 | 885 | 12.3% |
| parlor:buy:guard-dog | 265 | 0.2 | 1535 | 17.3% |
| reaper-club:buy:cop-day-off | 262 | 0.2 | 793 | 13.6% |
| parlor:markup | 253 | 0.2 | 1600 | 15.8% |
| reaper-club:buy:forged-permit | 222 | 0.1 | 865 | 14.2% |
| parlor:buy:alarm | 221 | 0.1 | 264 | 83.7% |
| reaper-club:buy:mayor-key | 168 | 0.1 | 831 | 12.9% |
| gazette:display | 162 | 0.1 | 535 | 19.4% |
| reaper-club:bodyguard | 152 | 0.1 | 1006 | 10.6% |
| parlor:rivalry:peaceful | 142 | 0.1 | 409 | 34.7% |
| city-hall:found | 140 | 0.1 | 472 | 29.7% |
| parlor:markup:20 | 130 | 0.1 | 253 | 51.4% |
| city-hall:file | 127 | 0.1 | 127 | 100.0% |
| parlor:markup:10 | 123 | 0.1 | 253 | 48.6% |
| parlor:buy:night-watchman | 117 | 0.1 | 151 | 77.5% |
| church:confess | 61 | 0.0 | 1040 | 5.2% |
| parlor:buy:mausoleum | 35 | 0.0 | 45 | 77.8% |
| city-hall:ads | 13 | 0.0 | 99 | 13.1% |
| city-hall:permit:crematory | 2 | 0.0 | 796 | 0.3% |
| news:crime | 0 | 0.0 | 1600 | 0.0% |
| news:yesterday | 0 | 0.0 | 1600 | 0.0% |
| news:announce | 0 | 0.0 | 1600 | 0.0% |
| tutorial:skip | 0 | 0.0 | 1600 | 0.0% |
| store:security | 0 | 0.0 | 1600 | 0.0% |
| store:supplies | 0 | 0.0 | 1600 | 0.0% |
| store:restock | 0 | 0.0 | 1600 | 0.0% |
| bank:all-wood | 0 | 0.0 | 1600 | 0.0% |
| bank:exchange | 0 | 0.0 | 1600 | 0.0% |
| spirit-university:library | 0 | 0.0 | 1600 | 0.0% |
| mournes:truce | 0 | 0.0 | 1600 | 0.0% |
| florist:ward | 0 | 0.0 | 921 | 0.0% |
| health-department:buy | 0 | 0.0 | 1463 | 0.0% |
| city-hall:leavechain | 0 | 0.0 | 408 | 0.0% |
| graveyard:look | 0 | 0.0 | 1600 | 0.0% |
| reaper-club:buy:tiny | 0 | 0.0 | 889 | 0.0% |
| crematorium:rent | 0 | 0.0 | 788 | 0.0% |
| reaper-club:draw | 0 | 0.0 | 133 | 0.0% |
| reaper-club:shots | 0 | 0.0 | 133 | 0.0% |
| parlor:markup:-10 | 0 | 0.0 | 253 | 0.0% |
| parlor:markup:30 | 0 | 0.0 | 253 | 0.0% |
| parlor:markup:0 | 0 | 0.0 | 253 | 0.0% |
| bank:depositall | 0 | 0.0 | 123 | 0.0% |
| bank:withdraw | 0 | 0.0 | 123 | 0.0% |

## What only human playtesting can answer

The bots play every system from the same committed strategies each season, so these numbers say how often the game offers something, not whether a person enjoys it. Drawn from this run:

- **Is a day too long?** A bot answers 364 screens a day, 193 of them choices, for 16.1 customers. A person reads faster than a bot looks but also hesitates; only a playtest says whether 193 choices a day is fun or a chore, and whether the hand and package panes should be on the main screen.
- **Walkout pacing.** 0.1% of 774,380 customers walked out. Bots stop pushing before the mood does, so this is the floor; a person who misreads a customer, or is greedy for the exact match (24.7% of the bots' sales), will see far more. Whether a walkout feels like a fair lesson or a punishment is not measurable here.
- **How often the town speaks.** News changed the rules on 56.7% of days, a weather set on 100.0%, and a story arc was running on 62.6% of days (3.0 arcs and 6.2 story beats a town a season). Bots read none of it as a story; whether that is too much, too little, or repeats itself by day 20 needs readers.
- **Is the election a contest?** 0.64 candidates stood in each of 200 elections and 8.0 parlors voted: the bots vote by a preference list. Whether people campaign, lobby or bluff is a social question.
- **Ordinances and arcs by effect, not by rote.** The bots rank ordinances from a fixed list (800 ballots, 8.00 votes each, 945 lobbying votes bought). Do players read the effects and choose, or click the first?
- **Grudges and bluffing.** 8,513 duels and 737 hits happened with no memory of who did what to whom. Retaliation, alliances and the Peace Pledge as a social contract are for people.
- **Wording.** The bots read panels and button ids, and `packages/bots/test/scrambled.test.ts` plays a season with every pack string reworded and sees no stuck day; that proves the text does not carry rules, not that it is funny, clear or tonally right.

