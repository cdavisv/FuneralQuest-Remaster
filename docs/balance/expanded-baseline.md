# Balance report: expanded rules

## What it says about the Expanded design

*Hand-written reading of the generated tables below (regenerating with `pnpm --filter @fq/sim run sim -- --days 30 --towns 200 --players 8 --rules expanded --seed 1 --challenges 6 --out docs/balance/expanded-baseline` overwrites this file; keep this section, or rebuild the tables alone with `pnpm --filter @fq/sim exec tsx src/remark.ts ../../docs/balance/expanded-baseline`, which keeps it). 200 towns of 8 hard bots drawn from the twelve `@fq/bots` personalities, a 30-day season with the built-in `expandedPack`. This is the run after balance round 19 of `expanded-tuning-log.md`: for the first time the bots visit the eight places of `expanded-rules.md` sections 30 and 31 (Police Station, Crematorium, Florist, Town Gazette, Coroner, Health Department, Cousin Sal's Pawn, Mourne & Sons), each in character, and a new table below ("the eight newer places") reports what each costs, gives back and how often it is used. "Before" is the round-17 baseline this file replaced; with the bots not visiting the new places the same 200 towns reproduce it exactly (the new content and places change no random draw a bot does not trigger), so the difference is the places and nothing else. A personality's win share moves by 0.2 to 0.4 for a couple of wins at this size (see reading 2), so read BP against the town mean first.*

**Checks: all passed**: no invariant breaks, no offered button rejected, no stuck bot-day, no error, none of the conservation signatures (the money, tag and BP checks now also watch the eight places).

### The targets

| target | before (round 17) | after (round 19) | met? |
| --- | --- | --- | --- |
| no personality above about 2x its fair share of wins, none below a third | politician 2.38, necromancer 2.33, tycoon 1.56, pacifist 1.18, shark 0.86, scholar 0.72, gambler 0.60, builder 0.56, saint 0.52, organiser 0.46, Soft Touch 0.44, saboteur 0.35 | tycoon **3.25**, necromancer 2.33, politician 1.57, pacifist 1.35, shark 1.05, saint 0.72, builder 0.56, gambler 0.48, saboteur 0.29, organiser 0.29, Soft Touch 0.19, scholar 0.11 | **no, worse**: two above 2 (the tycoon now the first), three below a third (was none); see 1 and 2 |
| the same field read by mean place and mean BP (reported alongside, not a new target) | mean place 2.92 to 6.38; means 17,727 to 20,483 (sd 712), -7.8% to +4.0% of the town mean | mean place 2.33 to 6.64; means 17,435 to 20,814 (sd 803), -8.8% to +6.6%; ten of twelve within 4%; the town's mean BP -0.7% (19,566 to 19,437) | the tycoon's lead and the saboteur's trail both grew by about 1 to 2 points (see 1) |
| good and evil within a few percent | BP against the town mean: good +1.0%, neutral +1.2%, evil -4.7%; wins: evil 1.29, good 1.08, neutral 0.82 | good +1.2%, neutral +1.4%, evil -3.8%; wins: evil 1.22, good 1.03, neutral 0.82 | unchanged (evil a point closer on BP) |
| no single purchase dominant, no system dead | Billboard 0.010 BP a dollar, Garden 0.022, Night Watchman -0.002, monuments 0.010 | upgrades not re-measured (no number changed); the eight places: none returns BP a dollar as a monument does, three pay money back (see 4), one is dead (the church wreath) | **mostly**: see 4 |
| skill worth clearly more than luck | Daily Challenge hard 419, easy 365 | hard 418.5, easy 365.4 (72 runs each) | yes |
| PvP-heavy play viable, peaceful play not miserable | 11,112 parlor attacks, 6,694 break-ins, 8,618 duels, 609 hits landed | 10,982 attacks, 6,654 break-ins, 8,452 duels, 529 hits landed | yes: the patrol is no lock (see 5) |
| loans cannot be turned into points; a small house edge | 2,689 loans, none defaulted; slots 0.870 / 0.939 / 0.896 | no loan or house rule changed; no default | yes |
| a full but not grindy day | 352 screens, 191 choices, 16.1 customers | 364 screens a bot-day (the eight places add about 12) | see the previous baseline's 7 |

### Reading

1. **The places are money sinks for most, a small gain for the tycoon.** Over a season a bot pays $1,700 (Mourne & Sons) to $27,000 (the pawn shop's second-hand caskets, which replace Di-Mart stock) at the new counters and the town's mean BP falls 0.7%. Only the tycoon comes out even: its oven slots (+$8,600 saved wholesale against $7,600 paid), its bouquets (+$7,900 earned against $4,900) and its patrol (the fights it loses fall from 323 to 246 BP) pay back, and the rest of the field loses the same ground, so it moves from +4.0% to +6.6% of its town's BP and from 1.56 to 3.25 of its share. Leaving out the pawn shop (200 towns, `--places-off pawn`) leaves it at +7.2%; leaving out the oven and the florist, +6.0%: no single place explains it, the places together lift the one parlor that sells many cremations, stocks the most and pays the most for protection. Not tuned further this round: every number that would lower it (oven price, bouquet payout) also lowers the shark, the other cremation seller, which sits at -0.2%.
2. **Win share is noise at this size, BP against the mean is the measure.** The same personality's wins moved by up to 20 (the politician 41 -> 21 -> 25 -> 27 over the three round-19 runs) while its BP against the mean stayed at +3.5 to +3.9%. The seats below a third (Soft Touch 0.19, scholar 0.11, saboteur 0.29) are at -0.6%, -0.4% and -8.8% of the town mean; the first two are inside the spread the places themselves add; the saboteur is the only one that really fell (-7.8% -> -8.8%), because it is the parlor that gets reported (the Police Station's fine, now $600, comes out of its cash). The proposal to judge Expanded by mean place and BP stands.
3. **The politician and the necromancer.** The politician: 2.38 -> 1.57 wins of its share but BP +3.9% -> +3.9% of its town (unchanged); it buys the puff piece (+2 word of mouth, $2,500) every few days and a church wreath never, and the places neither help nor hurt it. The necromancer: 2.33 -> 2.33, -3.3% -> -2.4%; it is the heaviest user of the new places (complaint, smear, pawned loot, the quiet favour and the settlements) and they cost it about $36,000 a season, $11,000 of it stock that replaces Di-Mart's, and its BP against the town mean rose from -3.3% to -2.4%. Neither pending proposal in this file was applied; the new places move neither number enough to change the recommendation.
4. **The eight places one by one** (the table below the system tables). Used by seats / net dollars a season: Police Station 88% of seats, -$3,900 (a patrol or back door after repeat attacks; reports and settlements pay back $3,600); Crematorium 29%, **+$3,100** (the oven pays for the two parlors with many cremations, ashes are small change); Florist 41%, **+$1,800** (bouquets: 21,427 used, earned $3.4M against about $2.2M paid; the wreath for the church is the **one dead choice**, 9 presses in 200 towns, because the good parlors are already above its karma line); Town Gazette 33%, -$11,300 (adverts and smears: the only place whose spend buys nothing measurable for the payer); Coroner 85%, -$6,100 (the certificate: +5.9 word of mouth a user; the tip; the quiet favour is now a small, rating-gated income for the evil path); Health Department 91%, -$3,300 (+3.9 word of mouth a user); Pawn 75%, -$21,800 of which most is stock that replaces Di-Mart's (loot pays back $5,600); Mourne & Sons 92%, -$1,700 and +15 karma a user: the **free** "hold your prices" (+1 karma a day) is the one action that costs nothing and was pressed 35,467 times; it is why Mournes users gain karma a season, not a BP source. None returns BP a dollar like a monument (0.010): the three that return money (oven, florist, pawned loot) return $1.5 to $1.9 a dollar to the parlors they suit and nothing to the others, and the places that cost money give back word of mouth, karma, luck or a rival's loss.
5. **No anti-PvP lock.** A patrol or the back door was bought on 5,004 of 48,000 seat-nights (10%, by 337 and 389 seats); parlor attacks (11,112 -> 10,982), break-ins (6,694 -> 6,654) and duels (8,618 -> 8,452) barely moved, and hits that landed fell 13% (609 -> 529) because a patrol foils a hit. The police blotter recorded 16,304 attacks, 14,655 of them answered with a report or a settlement (a rival is fined at most $600 and pays at most $400 in a settlement, so at most $7.5M changed hands in 200 towns, against about $500M of sales). The report and the settlement are the cost of fighting, not an engine for BP.
6. **Second-hand caskets are not a money pump.** At 80% of Di-Mart's price for 80% to 90% of the caskets (the bad-lot chance falls with luck) the saving is 0% at luck 50 and 11% at luck 100; no check flagged money, tags or BP from the pawn shop, and the shark and the tycoon, the biggest buyers, finish at -0.2% and +6.6% with it and +7.2% (tycoon) without.
7. **Coroner's quiet favour and the gazette's smear were the two free-griefing risks, and both are gated.** In the first run the favour (+$700 a day, -2 word of mouth 40% of the time) paid the evil styles $20,000 a season and pushed the necromancer to 3.49 of its share (60 towns) and the saboteur's word of mouth to the floor (-24 a season in round 19a); it now pays $300 (50% to cost 3 word of mouth) and a bot only signs a body over while its rating is 45 or more and not two days running. A smear costs $2,500 and -3 karma for -2 word of mouth on a rival 65% of the time, a complaint $1,500 (karma 30 or less): 898 smears and 1,038 complaints in 200 towns (about 10 a town), used by the evil and cutthroat styles that pick a grudge or the leader.
8. **Late starters, hidden information, the oracle, no-fighter towns, the late joiner** (previous baselines, not re-run): nothing in the eight places depends on them.

### Recommended next tuning and proposals (for the owner to decide; nothing here was applied)

| proposal | evidence |
| --- | --- |
| Stop the free karma: Mourne & Sons' "hold your prices" gives +1 karma a day for nothing (35,467 presses, +15 karma a user). A price (even $100), a once-a-week limit, or +1 only when it was the cheaper stand would make it a choice, not a free action | reading 4 |
| The tycoon: the eight places lifted it +2.6 points of its town's BP (1.56 -> 3.25 of its share). The levers are the oven slot price ($900, saves about $1,125) and the bouquet payout (60% of the line, at most $300), both of which also reach the shark; or accept it as the character that sells the most cremations and carries the biggest storeroom | reading 1 |
| The church wreath is dead (9 presses): lower its price, or give the good styles a reason (the ward wreath's luck for the gambler) | reading 4 |
| Accept win share as missed for a tight field and judge the Expanded balance on mean place and BP against the town mean (both within the bands above), or widen the sellers' variance by design | reading 2; unchanged since the last baseline |
| The Memorial Garden at a monument's rate; the necromancer's spread; the politician; shorter days without less depth | unchanged since the round-17 baseline (not re-measured here): see that round's entries in `expanded-tuning-log.md` |

### What the bots cannot tell us

See the last section of the generated tables, "What only human playtesting can answer". The eight new places add three questions for people: whether the Gazette's smear and the Health Department's complaint feel like sport or like griefing to the parlor on the end of them, whether a free +1 karma a day at the Mournes feels like a loophole, and whether the Police Station's report (a public fine) is satisfying after a beating.

---

Generated by `@fq/sim`: 200 towns of 8 bots, 30 days each, difficulty hard, base seed 1. 17,461,726 actions in 1751 s.

**Checks: passed.** No invariant breaks, rejected offered buttons, exploit signatures or stuck bots.

## Win rate by personality

| personality | seats | wins | win rate | fair share | mean final BP | mean place |
| --- | --- | --- | --- | --- | --- | --- |
| tycoon | 123 | 50 | 40.7% | 12.5% | 20813.8 | 2.33 |
| necromancer | 134 | 39 | 29.1% | 12.5% | 18964.6 | 4.54 |
| politician | 138 | 27 | 19.6% | 12.5% | 20200.6 | 3.07 |
| pacifist | 142 | 24 | 16.9% | 12.5% | 19987.9 | 3.88 |
| shark | 130 | 17 | 13.1% | 12.5% | 19289.2 | 4.50 |
| saint | 122 | 11 | 9.0% | 12.5% | 19762.7 | 4.01 |
| builder | 128 | 9 | 7.0% | 12.5% | 19705.7 | 4.27 |
| gambler | 133 | 8 | 6.0% | 12.5% | 18779.1 | 5.75 |
| saboteur | 137 | 5 | 3.6% | 12.5% | 17435.3 | 6.64 |
| organiser | 140 | 5 | 3.6% | 12.5% | 19716.4 | 4.54 |
| mourner | 128 | 3 | 2.3% | 12.5% | 19303.2 | 5.16 |
| scholar | 145 | 2 | 1.4% | 12.5% | 19409.2 | 5.08 |

## BP by personality

BP/turn counts only turns spent on customers; BP/day includes risks, events, mail rewards and battles.

| personality | player-days | BP/day | BP/turn | sale BP/turn | fight BP/day | turns/day | sales/day | walkouts | exact | within 3% | within 8% | bonus share of sale BP | price/limit | risks taken | risk BP/day |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tycoon | 3690 | 695.3 | 41.66 | 35.32 | 0.0 | 16.7 | 16.3 | 0.0% | 24.9% | 17.1% | 9.6% | 24.0% | 0.75 | 93.4% | 65.8 |
| politician | 4140 | 670.5 | 42.54 | 35.47 | 0.0 | 15.8 | 15.4 | 0.0% | 29.1% | 18.7% | 10.4% | 26.5% | 0.78 | 92.4% | 62.1 |
| builder | 3840 | 663.5 | 39.02 | 33.55 | 0.0 | 17.0 | 16.6 | 0.0% | 21.5% | 15.9% | 9.6% | 22.2% | 0.72 | 93.5% | 65.9 |
| organiser | 4200 | 662.1 | 39.56 | 34.04 | 0.0 | 16.7 | 16.4 | 0.0% | 23.5% | 16.3% | 9.9% | 23.4% | 0.74 | 93.4% | 63.3 |
| saint | 3660 | 656.0 | 42.47 | 34.37 | 0.0 | 15.4 | 15.1 | 0.0% | 27.5% | 17.5% | 10.0% | 25.8% | 0.76 | 91.5% | 58.8 |
| pacifist | 4260 | 654.6 | 41.06 | 33.69 | 0.0 | 15.9 | 15.6 | 0.0% | 28.7% | 18.0% | 10.2% | 27.5% | 0.77 | 88.3% | 57.8 |
| shark | 3900 | 651.6 | 37.26 | 33.79 | 0.0 | 17.5 | 17.0 | 0.4% | 22.8% | 15.9% | 9.6% | 23.5% | 0.73 | 79.0% | 48.8 |
| scholar | 4350 | 651.5 | 39.06 | 33.62 | 0.0 | 16.7 | 16.3 | 0.0% | 24.9% | 16.4% | 9.6% | 24.9% | 0.74 | 93.7% | 64.5 |
| mourner | 3840 | 638.1 | 40.44 | 33.76 | 0.0 | 15.8 | 15.4 | 0.0% | 26.4% | 16.9% | 9.9% | 25.2% | 0.75 | 88.4% | 58.9 |
| gambler | 3990 | 632.2 | 40.21 | 33.27 | 21.1 | 15.7 | 15.4 | 0.1% | 26.2% | 18.0% | 11.9% | 25.6% | 0.78 | 72.9% | 42.9 |
| necromancer | 4020 | 627.2 | 39.95 | 32.44 | 32.6 | 15.7 | 15.3 | 0.1% | 25.2% | 17.4% | 11.9% | 25.2% | 0.77 | 66.0% | 36.6 |
| saboteur | 4110 | 571.0 | 38.98 | 25.41 | 126.9 | 14.6 | 14.4 | 0.0% | 15.6% | 11.7% | 9.6% | 20.2% | 0.66 | 67.7% | 38.5 |

## BP by psych level (as the stats sheet shows it, at the start of the day)

| psych | player-days | BP/day | BP/turn | sale BP/turn | fight BP/day | turns/day | sales/day | walkouts | exact | within 3% | within 8% | bonus share of sale BP | price/limit | risks taken | risk BP/day |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 6651 | 487.0 | 32.54 | 25.50 | 61.5 | 15.0 | 14.9 | 0.1% | 16.2% | 11.6% | 9.8% | 20.5% | 0.67 | 59.9% | 31.5 |
| 2 | 1668 | 440.2 | 29.13 | 26.02 | 11.2 | 15.1 | 14.8 | 0.1% | 17.5% | 12.1% | 10.7% | 21.1% | 0.69 | 60.4% | 28.1 |
| 3 | 3072 | 518.3 | 34.11 | 28.34 | 30.5 | 15.2 | 14.9 | 0.0% | 20.8% | 13.9% | 10.6% | 23.2% | 0.71 | 75.7% | 38.2 |
| 4 | 7718 | 567.1 | 35.39 | 30.13 | 6.2 | 16.0 | 15.6 | 0.1% | 23.0% | 15.5% | 10.8% | 24.5% | 0.73 | 86.2% | 51.6 |
| 5 | 4301 | 594.9 | 36.53 | 31.29 | 2.5 | 16.3 | 15.9 | 0.1% | 24.5% | 16.0% | 10.5% | 25.1% | 0.74 | 92.3% | 60.4 |
| 6 | 4769 | 651.2 | 39.42 | 33.38 | 8.0 | 16.5 | 16.1 | 0.1% | 26.3% | 17.6% | 10.9% | 25.6% | 0.76 | 85.2% | 60.6 |
| 7 | 4087 | 709.3 | 42.58 | 35.81 | 7.9 | 16.7 | 16.2 | 0.1% | 28.5% | 18.6% | 10.3% | 26.2% | 0.78 | 91.0% | 64.2 |
| 8 | 15734 | 799.0 | 47.92 | 39.10 | 5.5 | 16.7 | 16.2 | 0.0% | 28.7% | 19.5% | 9.6% | 25.3% | 0.78 | 95.7% | 68.1 |

## The exact match

186863 of 756874 sales (24.7%) hit the spending limit exactly: 116.79 per player per 30 days. All closeness bonuses (exact, within 3%, within 8%) are the "bonus share" column above.

## Wait for Customer outcomes

| outcome | count | share |
| --- | --- | --- |
| customer | 774284 | 80.5% |
| event | 75015 | 7.8% |
| risk | 72338 | 7.5% |
| script | 39688 | 4.1% |
| noTurns | 0 | 0.0% |

## Tags

Income by source:

| category | gold-tag equivalents | share |
| --- | --- | --- |
| sales | 444103.0 | 93.7% |
| theft | 15199.0 | 3.2% |
| bonus tag | 11577.3 | 2.4% |
| other | 1643.5 | 0.3% |
| received | 1003.5 | 0.2% |
| black market | 589.0 | 0.1% |

Spending and losses by use:

| category | gold-tag equivalents | share |
| --- | --- | --- |
| psych | 165052.0 | 51.9% |
| hearse | 83559.0 | 26.3% |
| strength | 23709.0 | 7.5% |
| stolen | 15199.0 | 4.8% |
| hp | 14947.0 | 4.7% |
| club cover | 6373.0 | 2.0% |
| arson | 4302.0 | 1.4% |
| bingo | 2462.8 | 0.8% |
| transfers | 1338.0 | 0.4% |
| burned | 1193.3 | 0.4% |

| personality | arson | bingo | burned | club cover | hearse | hp | psych | stolen | strength | transfers |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gambler | 0.0 | 2406.8 | 91.0 | 983.8 | 9136.0 | 0.0 | 14896.0 | 1852.3 | 4788.0 | 0.0 |
| shark | 0.0 | 0.0 | 392.8 | 1030.3 | 16120.0 | 0.0 | 14148.0 | 1409.5 | 0.0 | 0.0 |
| saint | 0.0 | 56.0 | 16.0 | 1102.8 | 4148.0 | 0.0 | 13664.0 | 1288.5 | 0.0 | 571.0 |
| scholar | 0.0 | 0.0 | 13.5 | 1438.8 | 10005.0 | 0.0 | 16240.0 | 1061.8 | 0.0 | 0.0 |
| mourner | 0.0 | 0.0 | 34.5 | 0.0 | 8832.0 | 0.0 | 14336.0 | 815.5 | 0.0 | 767.0 |
| politician | 0.0 | 0.0 | 87.5 | 39.8 | 4692.0 | 0.0 | 15456.0 | 2261.8 | 0.0 | 0.0 |
| organiser | 0.0 | 0.0 | 71.5 | 13.3 | 4760.0 | 0.0 | 15680.0 | 1271.5 | 0.0 | 0.0 |
| builder | 0.0 | 0.0 | 48.8 | 5.3 | 8832.0 | 0.0 | 14336.0 | 1104.5 | 0.0 | 0.0 |
| pacifist | 0.0 | 0.0 | 0.0 | 0.0 | 4828.0 | 0.0 | 15904.0 | 0.0 | 0.0 | 0.0 |
| necromancer | 0.0 | 0.0 | 403.5 | 94.5 | 4556.0 | 0.0 | 15008.0 | 1682.5 | 7236.0 | 0.0 |
| tycoon | 0.0 | 0.0 | 34.3 | 1538.0 | 4182.0 | 0.0 | 13776.0 | 850.3 | 0.0 | 0.0 |
| saboteur | 4302.0 | 0.0 | 0.0 | 126.8 | 3468.0 | 14947.0 | 1608.0 | 1601.0 | 11685.0 | 0.0 |

## PvP

| measure | value |
| --- | --- |
| visits (doors reached) | 18559 |
| visits per player-day | 0.39 |
| refused at the door (online, police, locked) | 923 |
| thefts | 6654 |
| tags per theft | 1.41 |
| battles started | 10982 |
| attacker wins / losses | 9651 / 1049 (90.2%) |
| BP won by winning attackers | 777716 |
| BP lost by losing attackers | 41041 |
| arsons hired / stopped by a smoke detector | 717 / 0 |
| Cursed Tigers / Lucky Sparrows / Lucky Dragons | 8010 / 896 / 2474 |

BP lost to other parlors' attacks, per player-day, by the victim's personality:

| personality | BP lost per day |
| --- | --- |
| shark | 16.2 |
| gambler | 14.4 |
| necromancer | 10.9 |
| builder | 10.6 |
| organiser | 9.6 |
| politician | 9.4 |
| scholar | 8.6 |
| tycoon | 8.1 |
| saint | 6.1 |
| mourner | 3.0 |
| saboteur | 0.3 |

## Snowball

At the end the leader has 1.07x the median parlor's BP.

| after day | leader went on to win |
| --- | --- |
| 1 | 22.0% |
| 3 | 23.5% |
| 5 | 30.0% |
| 10 | 38.0% |
| 15 | 44.5% |
| 20 | 53.5% |
| 25 | 71.5% |

| leader after day | builder | gambler | mourner | necromancer | organiser | pacifist | politician | saboteur | saint | scholar | shark | tycoon |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 19 | 16 | 10 | 29 | 30 | 10 | 18 | 13 | 10 | 12 | 18 | 15 |
| 5 | 13 | 9 | 11 | 14 | 16 | 17 | 42 | 9 | 21 | 10 | 17 | 21 |
| 10 | 10 | 5 | 12 | 11 | 8 | 25 | 56 | 10 | 28 | 5 | 8 | 22 |
| 15 | 4 | 4 | 14 | 19 | 4 | 29 | 62 | 7 | 29 | 1 | 4 | 23 |
| 20 | 2 | 6 | 13 | 28 | 5 | 28 | 59 | 5 | 27 | 0 | 9 | 18 |
| 25 | 4 | 8 | 7 | 30 | 8 | 30 | 41 | 5 | 14 | 2 | 12 | 39 |
| 30 | 9 | 8 | 3 | 39 | 5 | 24 | 27 | 5 | 11 | 2 | 17 | 50 |

| day | leader BP | runner-up | median | leader / median | lead over runner-up |
| --- | --- | --- | --- | --- | --- |
| 1 | 534.0 | 466.5 | 400.8 | 1.34 | 67.5 |
| 5 | 2683.5 | 2481.5 | 2225.2 | 1.21 | 202.0 |
| 10 | 5779.9 | 5421.6 | 5011.5 | 1.15 | 358.3 |
| 15 | 9179.2 | 8707.1 | 8151.7 | 1.13 | 472.2 |
| 20 | 12969.3 | 12406.9 | 11752.6 | 1.10 | 562.4 |
| 25 | 17052.6 | 16428.8 | 15724.5 | 1.09 | 623.8 |
| 30 | 21288.0 | 20597.2 | 19828.3 | 1.07 | 690.8 |

## Expanded: win rate by personality

| personality | seats | wins | win rate | fair share | win / fair | mean final BP | mean place | BP vs town mean | sd of that |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tycoon | 123 | 50 | 40.7% | 12.5% | 3.25 | 20,814 | 2.33 | +6.6% | 5.0% |
| necromancer | 134 | 39 | 29.1% | 12.5% | 2.33 | 18,965 | 4.54 | -2.4% | 11.9% |
| politician | 138 | 27 | 19.6% | 12.5% | 1.57 | 20,201 | 3.07 | +3.9% | 4.3% |
| pacifist | 142 | 24 | 16.9% | 12.5% | 1.35 | 19,988 | 3.88 | +2.5% | 4.9% |
| shark | 130 | 17 | 13.1% | 12.5% | 1.05 | 19,289 | 4.50 | -0.2% | 8.1% |
| saint | 122 | 11 | 9.0% | 12.5% | 0.72 | 19,763 | 4.01 | +1.8% | 4.2% |
| builder | 128 | 9 | 7.0% | 12.5% | 0.56 | 19,706 | 4.27 | +1.0% | 4.2% |
| gambler | 133 | 8 | 6.0% | 12.5% | 0.48 | 18,779 | 5.75 | -3.6% | 7.4% |
| saboteur | 137 | 5 | 3.6% | 12.5% | 0.29 | 17,435 | 6.64 | -8.8% | 8.6% |
| organiser | 140 | 5 | 3.6% | 12.5% | 0.29 | 19,716 | 4.54 | +0.9% | 4.1% |
| mourner | 128 | 3 | 2.3% | 12.5% | 0.19 | 19,303 | 5.16 | -0.6% | 4.7% |
| scholar | 145 | 2 | 1.4% | 12.5% | 0.11 | 19,409 | 5.08 | -0.4% | 4.3% |

Spread: mean final BP from 17,435 to 20,814 (3,378 BP, sd 803 around 19,447); mean place from 2.33 to 6.64.

## Expanded: win rate by karma path (at the end of the season)

| path | seats | wins | win rate | fair share | win / fair | mean final BP | mean place | BP vs town mean | sd of that |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| evil | 400 | 61 | 15.3% | 12.5% | 1.22 | 18,555 | 5.24 | -3.8% | 10.4% |
| good | 632 | 81 | 12.8% | 12.5% | 1.03 | 19,666 | 4.22 | +1.2% | 6.0% |
| neutral | 568 | 58 | 10.2% | 12.5% | 0.82 | 19,805 | 4.29 | +1.4% | 5.2% |

| rivalry tier | seats | wins | win rate | fair share | win / fair | mean final BP | mean place | BP vs town mean | sd of that |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| peaceful | 142 | 24 | 16.9% | 12.5% | 1.35 | 19,988 | 3.88 | +2.5% | 4.9% |
| standard | 1191 | 154 | 12.9% | 12.5% | 1.03 | 19,618 | 4.33 | +0.7% | 6.8% |
| cutthroat | 267 | 22 | 8.2% | 12.5% | 0.66 | 18,338 | 5.60 | -4.6% | 9.4% |

| PvP | seats | wins | win rate | fair share | win / fair | mean final BP | mean place | BP vs town mean | sd of that |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fights (parlor, duel or hit) | 519 | 65 | 12.5% | 12.5% | 1.00 | 18,626 | 5.36 | -3.7% | 9.6% |
| never fights | 1081 | 135 | 12.5% | 12.5% | 1.00 | 19,827 | 4.09 | +1.8% | 5.3% |

## Expanded: the parlors at the end of the season

| personality | final BP | cash | savings | karma | good / evil | upgrades | monuments | in a chain | mayor | BP lost to PvP | decisions / day | turns / day |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| builder | 19,706 | 7,511 | 0 | 60 | 5.5% / 0.0% | 7.7 | 2.8 | 65.6% | 0.0% | 516 | 356 | 17.0 |
| gambler | 18,779 | 5,917 | 0 | 64 | 31.6% / 0.0% | 6.4 | 2.5 | 0.0% | 0.0% | 665 | 374 | 16.5 |
| mourner | 19,303 | 3,494 | 0 | 100 | 100.0% / 0.0% | 6.9 | 2.2 | 70.3% | 0.0% | 196 | 350 | 16.7 |
| necromancer | 18,965 | 15,920 | 0 | 1 | 0.0% / 100.0% | 6.3 | 3.2 | 0.0% | 0.0% | 611 | 379 | 17.2 |
| organiser | 19,716 | 13,777 | 0 | 61 | 7.1% / 0.0% | 8.7 | 3.0 | 100.0% | 0.0% | 483 | 350 | 16.8 |
| pacifist | 19,988 | 10,335 | 0 | 100 | 100.0% / 0.0% | 6.7 | 3.0 | 0.0% | 0.0% | 0 | 364 | 16.9 |
| politician | 20,201 | 3,256 | 0 | 100 | 100.0% / 0.0% | 4.2 | 2.0 | 68.1% | 92.0% | 558 | 371 | 16.7 |
| saboteur | 17,435 | 8,065 | 0 | 1 | 0.0% / 100.0% | 8.0 | 2.5 | 0.0% | 0.0% | 89 | 314 | 16.2 |
| saint | 19,763 | 1,518 | 0 | 100 | 100.0% / 0.0% | 2.5 | 1.4 | 0.0% | 0.0% | 381 | 358 | 16.4 |
| scholar | 19,409 | 7,452 | 0 | 57 | 2.8% / 0.0% | 7.7 | 2.7 | 0.0% | 0.0% | 408 | 346 | 16.7 |
| shark | 19,289 | 44,478 | 0 | 3 | 0.0% / 99.2% | 8.2 | 4.3 | 0.0% | 0.0% | 599 | 429 | 17.9 |
| tycoon | 20,814 | 47,466 | 0 | 66 | 31.7% / 0.0% | 8.0 | 4.9 | 0.0% | 0.0% | 531 | 378 | 16.7 |

Decisions per bot-day across the town: 364 screens answered from log on to log off (the newspaper, every look at the hand of cards, every Back and every walk across the map included), of which 193 are choices (a pitch, a purchase, a vote: anything but looking and walking), for 16.1 customers a day.

## Expanded: selling

| personality | sales / day | walkouts | exact | within 3% | within 8% | bonus share of sale BP | sale BP / customer | money / sale | actions / sale | cremations | listened | coffee | blessed | happy families | sour families |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| builder | 16.6 | 0.0% | 21.5% | 15.9% | 9.6% | 22.2% | 33.5 | 814 | 7.2 | 0.1% | 82.1% | 68.2% | 0.8% | 31.0% | 38.4% |
| gambler | 15.4 | 0.1% | 26.2% | 18.0% | 11.9% | 25.6% | 33.3 | 636 | 7.4 | 0.3% | 87.0% | 73.1% | 4.0% | 33.5% | 34.6% |
| mourner | 15.4 | 0.0% | 26.4% | 16.9% | 9.9% | 25.2% | 33.8 | 565 | 7.9 | 0.0% | 77.7% | 64.9% | 66.3% | 48.4% | 25.3% |
| necromancer | 15.3 | 0.1% | 25.2% | 17.4% | 11.9% | 25.2% | 32.4 | 879 | 7.4 | 1.6% | 86.5% | 72.9% | 0.7% | 30.2% | 36.7% |
| organiser | 16.4 | 0.0% | 23.5% | 16.3% | 9.9% | 23.4% | 34.0 | 755 | 7.2 | 0.6% | 80.5% | 65.5% | 0.8% | 31.5% | 38.8% |
| pacifist | 15.6 | 0.0% | 28.7% | 18.0% | 10.2% | 27.5% | 33.7 | 719 | 8.4 | 0.8% | 81.8% | 69.3% | 71.2% | 48.5% | 32.3% |
| politician | 15.4 | 0.0% | 29.1% | 18.7% | 10.4% | 26.5% | 35.5 | 454 | 8.6 | 0.0% | 85.1% | 75.8% | 76.2% | 48.3% | 29.9% |
| saboteur | 14.4 | 0.0% | 15.6% | 11.7% | 9.6% | 20.2% | 25.4 | 666 | 5.8 | 0.3% | 76.4% | 62.9% | 0.0% | 28.0% | 44.4% |
| saint | 15.1 | 0.0% | 27.5% | 17.5% | 10.0% | 25.8% | 34.4 | 560 | 8.0 | 0.0% | 79.6% | 70.1% | 70.0% | 45.7% | 30.8% |
| scholar | 16.3 | 0.0% | 24.9% | 16.4% | 9.6% | 24.9% | 33.6 | 671 | 7.1 | 0.1% | 78.0% | 63.7% | 0.7% | 28.6% | 45.6% |
| shark | 17.0 | 0.4% | 22.8% | 15.9% | 9.6% | 23.5% | 33.8 | 1,621 | 7.8 | 10.4% | 92.3% | 78.3% | 0.0% | 31.7% | 35.0% |
| tycoon | 16.3 | 0.0% | 24.9% | 17.1% | 9.6% | 24.0% | 35.3 | 1,528 | 7.7 | 3.9% | 84.1% | 71.1% | 1.3% | 32.8% | 37.8% |

Walkouts by trait (all customers who had the trait, hidden or shown):

| trait | customers | walkouts | rate |
| --- | --- | --- | --- |
| nervous | 43524 | 61 | 0.1% |
| hurry | 42734 | 49 | 0.1% |
| heir | 44323 | 50 | 0.1% |
| grudge | 42125 | 38 | 0.1% |
| relieved | 42339 | 34 | 0.1% |
| devout | 45048 | 35 | 0.1% |
| estranged | 42129 | 32 | 0.1% |
| conspiracy | 44776 | 34 | 0.1% |
| loudmouth | 43964 | 33 | 0.1% |
| germophobe | 43762 | 32 | 0.1% |
| hothead | 44059 | 32 | 0.1% |
| traditionalist | 42910 | 28 | 0.1% |
| music-lover | 44762 | 29 | 0.1% |
| executor | 42093 | 27 | 0.1% |
| sentimental | 44670 | 28 | 0.1% |
| gossip | 44239 | 27 | 0.1% |
| windfall | 42946 | 26 | 0.1% |
| no-nonsense | 43611 | 26 | 0.1% |
| foodie | 44326 | 26 | 0.1% |
| showoff | 46499 | 27 | 0.1% |
| haggler | 46852 | 27 | 0.1% |
| rivalry | 46939 | 27 | 0.1% |
| green | 42025 | 24 | 0.1% |
| skeptic | 46069 | 26 | 0.1% |
| broke | 42590 | 24 | 0.1% |
| new-age | 43050 | 23 | 0.1% |
| country-club | 43824 | 23 | 0.1% |
| heartbroken | 40020 | 21 | 0.1% |
| accountant | 45948 | 23 | 0.1% |
| death-fan | 46661 | 23 | 0.0% |
| minimalist | 42853 | 21 | 0.0% |
| tight-lipped | 44113 | 21 | 0.0% |
| shutterbug | 44330 | 21 | 0.0% |
| superstitious | 43973 | 20 | 0.0% |
| been-here | 46882 | 21 | 0.0% |
| litigious | 44621 | 18 | 0.0% |
| animal-lover | 45023 | 18 | 0.0% |
| collector | 46162 | 18 | 0.0% |
| chatterbox | 42592 | 15 | 0.0% |
| prodigal | 40052 | 14 | 0.0% |
| know-it-all | 46730 | 16 | 0.0% |
| pushover | 44905 | 13 | 0.0% |
| pincher | 42975 | 11 | 0.0% |
| serene | 42068 | 5 | 0.0% |

| special customer | met | sales | walkouts |
| --- | --- | --- | --- |
| county-contract | 2506 | 0 | 0 |
| celebrity | 2636 | 2631 | 5 |
| pre-need | 5178 | 5177 | 1 |
| clown-family | 2642 | 2641 | 1 |
| jackpot | 2353 | 2340 | 13 |
| pet | 5043 | 5038 | 5 |
| teller | 2475 | 2474 | 1 |
| nurse-referral | 2522 | 0 | 0 |
| june | 2361 | 2356 | 5 |
| cousin-sal | 2449 | 0 | 0 |
| inspector-mudge | 2325 | 0 | 0 |
| zookeeper | 2314 | 2312 | 2 |
| mob-boss | 2345 | 2345 | 0 |
| coroner | 2255 | 0 | 0 |
| black-widow | 2406 | 2406 | 0 |
| lucius-vane | 2206 | 2205 | 1 |
| father-smyth | 2396 | 2395 | 1 |
| old-man-withers | 2604 | 2604 | 0 |
| fake-death | 2225 | 0 | 0 |
| the-twins | 2120 | 0 | 0 |
| the-mournes | 2220 | 2220 | 0 |
| blaine-director | 2253 | 2252 | 1 |
| ghost-crew | 2163 | 0 | 0 |
| the-mayor | 2202 | 2200 | 2 |
| the-count | 2039 | 2039 | 0 |
| elijah | 2224 | 2224 | 0 |

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
| sales | 81.2% | 13,520 | 9,799 | 8,732 | 13,491 | 12,364 | 11,203 | 6,990 | 9,568 | 8,468 | 10,939 | 27,618 | 24,900 |
| new day and mail | 5.7% | 965 | 861 | 886 | 852 | 961 | 937 | 931 | 691 | 894 | 907 | 1,008 | 1,016 |
| savings | 3.4% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 7,157 |
| body prep | 2.6% | 466 | 351 | 77 | 1,099 | 464 | 72 | 79 | 1,052 | 70 | 453 | 271 | 480 |
| loans | 2.3% | 2,670 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2,021 |
| special offers | 1.3% | 340 | 273 | 36 | 262 | 329 | 33 | 35 | 219 | 33 | 339 | 330 | 349 |
| pawn | 0.9% | 0 | 243 | 0 | 672 | 0 | 0 | 0 | 634 | 0 | 0 | 107 | 0 |
| police | 0.7% | 87 | 185 | 61 | 166 | 86 | 0 | 146 | 142 | 97 | 74 | 146 | 71 |
| rob graves | 0.6% | 0 | 0 | 0 | 573 | 0 | 0 | 0 | 583 | 0 | 0 | 0 | 0 |
| gambling | 0.5% | 0 | 989 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| parlor PvP | 0.3% | 0 | 191 | 0 | 82 | 0 | 0 | 0 | 27 | 0 | 0 | 372 | 0 |
| dig | 0.3% | 0 | 0 | 0 | 278 | 0 | 0 | 0 | 286 | 0 | 0 | 0 | 0 |
| crematorium | 0.1% | 0 | 0 | 0 | 49 | 0 | 0 | 0 | 8 | 0 | 0 | 212 | 0 |
| coroner | 0.1% | 0 | 0 | 0 | 34 | 0 | 0 | 0 | 15 | 0 | 0 | 90 | 0 |

Dollars spent per player-day:

| spending | share | builder | gambler | mourner | necromancer | organiser | pacifist | politician | saboteur | saint | scholar | shark | tycoon |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| stock | 39.2% | 6,455 | 5,905 | 3,946 | 5,705 | 5,723 | 6,680 | 3,406 | 5,487 | 4,671 | 5,259 | 9,344 | 10,610 |
| upgrades | 17.2% | 3,953 | 2,150 | 2,007 | 2,175 | 3,589 | 2,318 | 901 | 2,518 | 344 | 2,899 | 4,886 | 4,175 |
| monuments | 8.8% | 932 | 685 | 471 | 1,389 | 1,093 | 1,085 | 387 | 727 | 198 | 863 | 3,479 | 5,363 |
| tithe | 4.8% | 614 | 590 | 570 | 643 | 647 | 639 | 549 | 598 | 2,317 | 627 | 667 | 667 |
| pawn | 4.4% | 1,266 | 0 | 710 | 1,054 | 1,042 | 0 | 0 | 0 | 0 | 1,104 | 1,458 | 1,645 |
| savings | 3.5% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 7,118 |
| black market | 2.6% | 0 | 520 | 0 | 1,388 | 0 | 0 | 1 | 949 | 31 | 404 | 977 | 512 |
| loans | 2.5% | 2,750 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2,081 |
| hearse upkeep | 2.3% | 601 | 286 | 395 | 224 | 310 | 311 | 309 | 28 | 218 | 401 | 866 | 301 |
| leads | 2.2% | 0 | 0 | 0 | 1,199 | 0 | 0 | 0 | 0 | 0 | 0 | 2,900 | 0 |
| police | 1.4% | 0 | 0 | 361 | 444 | 0 | 0 | 0 | 369 | 300 | 0 | 500 | 753 |
| hits | 1.4% | 0 | 194 | 0 | 498 | 0 | 0 | 0 | 287 | 0 | 0 | 1,627 | 0 |
| story appeals | 1.3% | 0 | 0 | 387 | 502 | 0 | 334 | 307 | 463 | 368 | 0 | 0 | 0 |
| coroner | 1.2% | 268 | 0 | 220 | 0 | 262 | 255 | 155 | 0 | 257 | 360 | 129 | 302 |
| treatment | 1.1% | 156 | 240 | 116 | 381 | 147 | 0 | 278 | 132 | 213 | 115 | 164 | 164 |
| gazette | 0.8% | 0 | 175 | 0 | 411 | 0 | 0 | 453 | 0 | 0 | 0 | 461 | 0 |
| health dept | 0.7% | 109 | 97 | 70 | 223 | 100 | 81 | 61 | 0 | 79 | 104 | 187 | 107 |
| gambling | 0.6% | 0 | 1,140 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| permits | 0.5% | 190 | 49 | 134 | 0 | 186 | 0 | 0 | 0 | 178 | 184 | 0 | 0 |
| body prep | 0.4% | 46 | 69 | 103 | 41 | 45 | 103 | 101 | 35 | 99 | 47 | 102 | 39 |
| chains | 0.4% | 109 | 0 | 117 | 0 | 333 | 0 | 114 | 0 | 0 | 0 | 0 | 0 |
| stolen | 0.4% | 38 | 81 | 21 | 102 | 49 | 0 | 45 | 177 | 32 | 32 | 39 | 42 |
| mournes | 0.3% | 0 | 168 | 0 | 25 | 0 | 0 | 0 | 10 | 0 | 58 | 297 | 88 |
| ordinances | 0.3% | 0 | 0 | 0 | 0 | 0 | 0 | 571 | 0 | 0 | 0 | 0 | 0 |
| florist | 0.3% | 131 | 0 | 1 | 0 | 117 | 100 | 0 | 0 | 49 | 0 | 0 | 164 |
| rob graves | 0.3% | 0 | 0 | 0 | 247 | 0 | 0 | 0 | 224 | 0 | 0 | 0 | 0 |
| special offers | 0.3% | 40 | 32 | 36 | 42 | 34 | 44 | 38 | 39 | 40 | 41 | 38 | 42 |
| inspection | 0.2% | 139 | 0 | 0 | 0 | 0 | 0 | 101 | 72 | 132 | 0 | 0 | 0 |
| midnight (fines, collection) | 0.2% | 3 | 30 | 9 | 82 | 21 | 9 | 1 | 44 | 3 | 25 | 137 | 31 |
| crematorium | 0.2% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 150 | 252 |
| chain dues | 0.1% | 57 | 0 | 60 | 0 | 96 | 0 | 56 | 0 | 0 | 0 | 0 | 0 |
| election | 0.1% | 0 | 0 | 0 | 0 | 0 | 0 | 200 | 0 | 0 | 0 | 0 | 0 |
| bodyguard | 0.1% | 9 | 0 | 0 | 0 | 19 | 0 | 53 | 0 | 0 | 5 | 0 | 23 |
| holy water | 0.1% | 0 | 0 | 6 | 0 | 0 | 4 | 53 | 0 | 46 | 0 | 0 | 0 |
| confession | 0.0% | 0 | 0 | 2 | 0 | 0 | 2 | 0 | 0 | 2 | 0 | 0 | 0 |

## Expanded: BP by system (per player-day)

| source | share | builder | gambler | mourner | necromancer | organiser | pacifist | politician | saboteur | saint | scholar | shark | tycoon |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sales | 80.7% | 570 | 523 | 533 | 509 | 570 | 537 | 559 | 372 | 531 | 561 | 591 | 589 |
| risks | 8.3% | 66 | 43 | 59 | 37 | 63 | 58 | 62 | 38 | 59 | 65 | 49 | 66 |
| parlor PvP | 2.3% | 0 | 21 | 0 | 33 | 0 | 0 | 0 | 127 | 0 | 0 | 0 | 0 |
| monuments | 2.0% | 13 | 10 | 8 | 16 | 15 | 15 | 7 | 11 | 4 | 13 | 22 | 26 |
| service | 1.5% | 0 | 1 | 30 | 0 | 0 | 30 | 29 | 0 | 28 | 0 | 0 | 1 |
| midnight | 1.4% | 8 | 6 | 8 | 11 | 8 | 12 | 16 | 7 | 11 | 7 | 8 | 13 |
| duels | 1.1% | 0 | 21 | 0 | 26 | 0 | 0 | 0 | 36 | 0 | 0 | 0 | 0 |
| tithe | 1.0% | 5 | 5 | 7 | 3 | 5 | 8 | 7 | 2 | 28 | 5 | 3 | 6 |
| wait (events, scripts) | 0.7% | 5 | 5 | 5 | 4 | 5 | 5 | 5 | 4 | 4 | 5 | 4 | 5 |
| yangs | 0.6% | -0 | -1 | -5 | -1 | -0 | -0 | -0 | -21 | -0 | -0 | -20 | -0 |
| special offers | 0.2% | 2 | 2 | 1 | 1 | 2 | 1 | 1 | 1 | 1 | 2 | 2 | 2 |
| new day and mail | 0.2% | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| walkout gifts | 0.0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Expanded: turns by use (per player-day)

| use | share | builder | gambler | mourner | necromancer | organiser | pacifist | politician | saboteur | saint | scholar | shark | tycoon |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| wait (events, scripts) | 95.9% | 17 | 16 | 16 | 16 | 17 | 16 | 16 | 15 | 15 | 17 | 17 | 17 |
| service | 1.8% | 0 | 0 | 1 | 0 | 0 | 1 | 1 | 0 | 1 | 0 | 0 | 0 |
| duels | 1.0% | 0 | 1 | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| seance | 1.0% | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| tour | 0.2% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Expanded: time by place (decisions per player-day)

| scene | share | builder | gambler | mourner | necromancer | organiser | pacifist | politician | saboteur | saint | scholar | shark | tycoon |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| neg | 76.2% | 281 | 274 | 273 | 271 | 279 | 292 | 294 | 202 | 271 | 275 | 321 | 294 |
| desk | 7.8% | 29 | 29 | 27 | 29 | 29 | 27 | 28 | 28 | 27 | 28 | 30 | 28 |
| map | 3.9% | 11 | 14 | 14 | 19 | 11 | 12 | 13 | 16 | 16 | 11 | 19 | 14 |
| store | 2.6% | 9 | 10 | 8 | 10 | 9 | 10 | 8 | 10 | 9 | 9 | 11 | 11 |
| competitors | 0.9% | 0 | 8 | 0 | 8 | 0 | 0 | 0 | 13 | 0 | 0 | 9 | 0 |
| church | 0.8% | 1 | 6 | 5 | 1 | 1 | 6 | 6 | 1 | 8 | 1 | 1 | 1 |
| risk | 0.8% | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| reaper-club | 0.7% | 0 | 8 | 0 | 6 | 0 | 0 | 0 | 5 | 3 | 3 | 5 | 4 |
| graveyard | 0.7% | 1 | 6 | 1 | 6 | 1 | 1 | 1 | 7 | 4 | 1 | 1 | 1 |
| city-hall | 0.6% | 5 | 1 | 3 | 1 | 4 | 1 | 6 | 2 | 2 | 1 | 1 | 1 |
| mournes | 0.5% | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 1 | 2 | 3 | 3 | 3 |
| parlor | 0.4% | 1 | 1 | 1 | 4 | 1 | 1 | 1 | 4 | 0 | 1 | 1 | 1 |
| police | 0.4% | 2 | 2 | 1 | 2 | 2 | 0 | 2 | 2 | 2 | 1 | 2 | 2 |
| bank | 0.4% | 3 | 1 | 2 | 1 | 1 | 1 | 1 | 1 | 2 | 1 | 1 | 6 |
| yangs | 0.4% | 0 | 0 | 2 | 1 | 0 | 1 | 0 | 5 | 1 | 0 | 5 | 0 |
| pawn-shop | 0.4% | 1 | 2 | 1 | 3 | 1 | 0 | 0 | 2 | 0 | 1 | 3 | 2 |
| coroner | 0.3% | 1 | 0 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 3 | 1 |
| hospital | 0.3% | 1 | 1 | 1 | 3 | 1 | 0 | 1 | 1 | 1 | 1 | 3 | 1 |
| news | 0.3% | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| stats | 0.3% | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| battle | 0.2% | 0 | 1 | 0 | 2 | 0 | 0 | 0 | 6 | 0 | 0 | 0 | 0 |
| spirit-university | 0.2% | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| florist | 0.2% | 1 | 0 | 1 | 0 | 1 | 2 | 0 | 0 | 2 | 0 | 0 | 2 |
| cafe | 0.2% | 0 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0 | 0 |
| health-department | 0.1% | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |
| crematorium | 0.1% | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 1 | 1 | 0 | 2 | 1 |
| gazette | 0.1% | 0 | 1 | 0 | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 1 | 0 |
| tutorial | 0.1% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Expanded: what each choice returns

| choice | measure | return | volume (turns, $ or uses) |
| --- | --- | --- | --- |
| a customer (Wait for Customer) | BP per turn | 33.267 | 774284 |
| leading the service | BP per turn | 32.829 | 14627 |
| a graveyard duel (challenger) | BP per turn | 39.842 | 8452 |
| robbing a grave | $ per try | 390.830 | 7129 |
| digging at the office | $ per try | 321.699 | 7129 |
| tending the graves | uses | - | 6802 |
| the seance | turns used | - | 8400 |
| monuments | BP per $ | 0.010 | 65344000 |
| tithes | BP per $ | 0.009 | 35924000 |
| hits (BP the victim lost per $) | BP per $ | 0.003 | 10298600 |
| special offers | BP per offer | 3.622 | 12918 |
| body prep choices | BP per choice | 0.000 | 321114 |
| risks taken | BP per risk | 42.866 | 61908 |

A lead from the nurse ($1,500) brings a sure, richer customer: 26,076 lead customers were met. Sale BP per customer over all customers: 33.27.

Parlor upgrades (share of seats that bought each, and the mean day bought):

| upgrade | bought | share of seats | mean day |
| --- | --- | --- | --- |
| paint | 1600 | 100.0% | 2.5 |
| coffee-machine | 1600 | 100.0% | 3.9 |
| storeroom | 1536 | 96.0% | 11.1 |
| florist-cooler | 1449 | 90.6% | 14.3 |
| viewing-room | 1320 | 82.5% | 16.1 |
| embalming-lab | 1067 | 66.7% | 18.9 |
| incinerator | 610 | 38.1% | 22.5 |
| memorial-garden | 403 | 25.2% | 21.4 |
| chapel | 389 | 24.3% | 21.9 |
| billboard | 291 | 18.2% | 25.7 |
| guard-dog | 265 | 16.6% | 6.7 |
| alarm | 219 | 13.7% | 18.2 |
| night-watchman | 123 | 7.7% | 25.2 |
| mausoleum | 40 | 2.5% | 26.4 |

The three late upgrades the engine pass made cheaper and better, and what they return:

| upgrade | bought | share of seats | mean day | cost with permit ($) | BP / day vs peers (after - before) | days owned | BP over the season | BP per $ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| night-watchman | 123 | 7.7% | 25.2 | 12,000 | -2.3 (se 7.9) | 4.8 | -11 | -0.001 |
| billboard | 291 | 18.2% | 25.7 | 21,500 | +28.4 (se 5.7) | 4.3 | 123 | 0.006 |
| memorial-garden | 403 | 25.2% | 21.4 | 24,000 | +48.5 (se 3.2) | 8.6 | 415 | 0.017 |

BP per day is measured against the same personality's seats on the same day that did not yet own the upgrade, so the season's rise in income cancels; the standard error is across buyers. The monuments return about 0.010 BP a dollar, so an upgrade that returns less is not worth buying for points alone.

Monument tiers built: tier 1: 1600, tier 2: 1513, tier 3: 1018, tier 4: 310, tier 5: 157 (of 1600 seats).

Permits bought: signage 805, zoning 792, crematory 120. Black-market buys: morty-rib 877, rabbit-foot 308, coroner-list 1818, clover 356, testimonials 614, monster-scale 290, riot-shield 342, hot-casket 1838, sal-pad 513, tap-water 287, haunted-casket 368, real-water 471, cop-day-off 248, filed-tag 589, bruno 372, used-wreaths 495, forged-permit 215, mayor-key 172, vest 314, tiny 1.

## Expanded: the eight newer places (sections 30 and 31)

| place | visited by (share of seats) | used (share of seats) | presses per user-day | $ out per user | $ back per user (incl. sale extras) | net $ per user | karma per user | luck per user | word of mouth per user |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| police | 91.1% | 87.6% | 0.47 | 7,499 | 3,591 | -3,908 | -2 | 0.0 | 0.0 |
| crematorium | 49.3% | 28.6% | 0.21 | 3,301 | 6,367 | 3,066 | -4 | 0.9 | 0.0 |
| florist | 57.6% | 41.1% | 0.57 | 3,354 | 5,158 | 1,804 | 0 | 0.0 | 0.0 |
| gazette | 33.4% | 33.4% | 0.22 | 11,259 | 0 | -11,259 | -2 | 0.0 | -0.5 |
| coroner | 91.7% | 84.6% | 0.31 | 6,519 | 406 | -6,114 | -1 | 0.3 | 5.9 |
| health dept | 91.4% | 91.2% | 0.14 | 3,328 | 0 | -3,328 | -0 | 0.0 | 3.9 |
| pawn | 74.9% | 74.9% | 0.75 | 27,348 | 5,588 | -21,761 | 0 | 0.0 | 0.0 |
| mournes | 100.0% | 92.3% | 0.95 | 1,726 | 0 | -1,726 | 15 | 0.7 | -0.0 |

Sale extras: oven slots used 1,621 (saved $1,864,150); bouquets used 21,427 (earned $3,393,780); attacks recorded on the police blotter 16,304.

| action | presses | seats that used it |
| --- | --- | --- |
| mournes:hold | 35467 | 1329 |
| pawn-shop:loot | 11137 | 534 |
| pawn-shop:lot:wood | 8875 | 928 |
| police:report | 8245 | 885 |
| pawn-shop:lot:silver | 7037 | 904 |
| florist:buy | 6952 | 653 |
| police:settle | 6410 | 517 |
| coroner:certificate | 4805 | 1066 |
| florist:bundle | 4258 | 653 |
| health-department:inspect | 3687 | 1199 |
| police:backdoor | 3500 | 389 |
| mournes:spy | 3367 | 544 |
| coroner:tip | 3272 | 275 |
| mournes:undercut | 3074 | 262 |
| coroner:favour | 2332 | 704 |
| coroner:quiet | 1829 | 286 |
| gazette:classified | 1744 | 267 |
| police:patrol | 1504 | 337 |
| crematorium:diamonds | 1442 | 233 |
| health-department:fine | 1297 | 806 |
| health-department:complaint | 1038 | 260 |
| gazette:smear | 898 | 257 |
| crematorium:scatter | 833 | 225 |
| gazette:puff | 750 | 138 |
| crematorium:bulk | 630 | 234 |
| coroner:burial | 503 | 418 |
| gazette:display | 157 | 105 |
| florist:church | 9 | 9 |

Net dollars are what a user took in at the counter, plus the oven's saved wholesale and the bouquets' payouts, minus what it paid there (the second-hand caskets' value is not counted: they replace Di-Mart stock). A dollar buys about 0.010 BP at the monuments, so a place that nets money is a source of points, and a place that costs money has to give back karma, luck, word of mouth or a rival's loss. Karma, luck and word of mouth are totals per user over the season. The BP return of a place cannot be read as it is for an upgrade (most users start on day 2 to 3, so there is no control), so a place's effect on its users is measured by leaving it out (`--places-off`), see `docs/balance/expanded-tuning-log.md` round 19.

## Expanded: PvP, duels and hits

| measure | value |
| --- | --- |
| duels started | 8452 |
| challenger won / lost / yielded | 7046 / 937 / 469 |
| BP won by duel winners / lost by losers | 413,595 / 204,344 |
| duels with a Shove: share of duels / challenger won, lost, yielded / mean BP | 5.7% / 144, 307, 30 / -1.7 |
| duels without a Shove: challenger won, lost, yielded / mean BP | 6902, 630, 439 / 42.4 |
| Shove pressed (times) | 488 |
| hits resolved / landed | 743 / 529 |
| BP taken from hit victims | 35,688 |
| cash stolen in burglaries | 2,649,080 |

Hits by the parlor that hired them:

| personality | hired | landed | hirer behind the target | $ spent | BP taken from targets | BP per $ |
| --- | --- | --- | --- | --- | --- | --- |
| gambler | 52 | 43 | 98.1% | 772,550 | 2,956 | 0.004 |
| necromancer | 156 | 112 | 94.2% | 2,002,750 | 7,493 | 0.004 |
| saboteur | 106 | 84 | 93.4% | 1,179,900 | 5,403 | 0.005 |
| shark | 429 | 290 | 97.7% | 6,343,400 | 19,836 | 0.003 |

BP lost to other parlors per player-day, by victim and venue:

| personality | parlor fights | duels | hits | total | share of final BP |
| --- | --- | --- | --- | --- | --- |
| builder | 10.6 | 6.1 | 0.5 | 17.2 | 2.6% |
| gambler | 16.9 | 4.6 | 0.6 | 22.2 | 3.5% |
| mourner | 3.0 | 2.7 | 0.8 | 6.5 | 1.0% |
| necromancer | 16.6 | 3.0 | 0.7 | 20.4 | 3.2% |
| organiser | 9.6 | 5.8 | 0.7 | 16.1 | 2.5% |
| pacifist | 0.0 | 0.0 | 0.0 | 0.0 | 0.0% |
| politician | 9.4 | 7.2 | 2.1 | 18.6 | 2.8% |
| saboteur | 2.2 | 0.6 | 0.1 | 3.0 | 0.5% |
| saint | 6.1 | 4.9 | 1.7 | 12.7 | 1.9% |
| scholar | 8.6 | 4.5 | 0.6 | 13.6 | 2.1% |
| shark | 16.2 | 3.6 | 0.2 | 20.0 | 3.1% |
| tycoon | 8.1 | 8.6 | 1.0 | 17.7 | 2.6% |

The most-targeted peaceful parlor in each town (never fights) lost on average 824 BP over the season, 3.9% of what it would otherwise have had (worst town: 8.4%); it finished at mean place 2.92.

## Expanded: the house

| game and stake | plays | staked | returned | return per $ |
| --- | --- | --- | --- | --- |
| slots.100 | 8573 | 857,300 | 648,200 | 0.756 |
| slots.1000 | 2571 | 2,571,000 | 2,167,000 | 0.843 |
| slots.500 | 3790 | 1,895,000 | 1,904,500 | 1.005 |

Gamblers' net: gambler -151 $/day on 1,334 $/day staked.

## Expanded: the bank

| personality | loans taken | borrowed $ | repaid $ | collected | defaulted | written off $ | default BP | savings interest $ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| builder | 1441 | 10,561,620 | 10,561,620 | 0 | 0 | 0 | 0 | 0 |
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
| tycoon | 1377 | 7,679,371 | 7,679,371 | 0 | 0 | 0 | 0 | 141,479 |

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
| no chain | 1192 | 164 | 13.8% | 12.5% | 1.10 | 19,318 | 4.57 | -0.4% | 8.2% |
| in a chain | 408 | 36 | 8.8% | 12.5% | 0.71 | 19,787 | 4.29 | +1.0% | 4.6% |

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
| health-department:buy | 1462 | 0 | 0.0% | 0 |
| city-hall:leavechain | 408 | 0 | 0.0% | 0 |
| graveyard:look | 1600 | 0 | 0.0% | 0 |
| crematorium:rent | 788 | 0 | 0.0% | 0 |
| reaper-club:draw | 133 | 0 | 0.0% | 0 |
| reaper-club:shots | 133 | 0 | 0.0% | 0 |
| parlor:markup:-10 | 253 | 0 | 0.0% | 0 |
| parlor:markup:30 | 253 | 0 | 0.0% | 0 |
| parlor:markup:0 | 253 | 0 | 0.0% | 0 |
| bank:depositall | 123 | 0 | 0.0% | 0 |
| bank:withdraw | 123 | 0 | 0.0% | 0 |
| reaper-club:buy:tiny | 889 | 1 | 0.1% | 1 |
| city-hall:permit:crematory | 796 | 4 | 0.5% | 4 |
| florist:church | 921 | 9 | 1.0% | 9 |

Usage of every choice (seats that used it at least once among seats that were offered it):

| choice | uses | per seat | seats offered | share of them that used it |
| --- | --- | --- | --- | --- |
| neg:soft | 3191813 | 1994.9 | 1600 | 100.0% |
| neg:card | 2564286 | 1602.7 | 1600 | 100.0% |
| neg:packages | 1081744 | 676.1 | 1600 | 100.0% |
| neg:listen | 1038253 | 648.9 | 1600 | 100.0% |
| desk:wait | 961325 | 600.8 | 1600 | 100.0% |
| neg:done | 756874 | 473.0 | 1600 | 100.0% |
| neg:hard | 550476 | 344.0 | 1600 | 100.0% |
| neg:coffee | 527390 | 329.6 | 1600 | 100.0% |
| neg:pkg:plot | 370607 | 231.6 | 1600 | 100.0% |
| prep:start | 321114 | 200.7 | 1600 | 100.0% |
| prep:choice | 321114 | 200.7 | 1600 | 100.0% |
| neg:bless | 179180 | 112.0 | 717 | 100.0% |
| store:casket:0 | 155483 | 97.2 | 1600 | 100.0% |
| neg:discount | 150322 | 94.0 | 1600 | 100.0% |
| place:funeral-home | 103330 | 64.6 | 1600 | 100.0% |
| neg:pkg:embalming | 102835 | 64.3 | 1600 | 100.0% |
| place:store | 90301 | 56.4 | 1600 | 100.0% |
| store:casket:1 | 81046 | 50.7 | 1600 | 100.0% |
| neg:guilt | 76439 | 47.8 | 1600 | 100.0% |
| risk:take | 61908 | 38.7 | 1600 | 99.1% |
| place:mournes | 53349 | 33.3 | 1600 | 100.0% |
| desk:quit | 48000 | 30.0 | 1600 | 100.0% |
| store:caskets | 47968 | 30.0 | 1600 | 100.0% |
| place:coroner | 42397 | 26.5 | 1600 | 91.7% |
| place:police-station | 41927 | 26.2 | 1600 | 91.1% |
| neg:pkg:headstone | 39125 | 24.5 | 1600 | 100.0% |
| place:church | 38185 | 23.9 | 1600 | 100.0% |
| place:pawn-shop | 37740 | 23.6 | 1600 | 74.9% |
| neg:pkg:service | 37442 | 23.4 | 1600 | 100.0% |
| neg:pkg:flowers | 36803 | 23.0 | 1600 | 100.0% |
| church:tithe | 35924 | 22.5 | 1600 | 100.0% |
| mournes:hold | 35467 | 22.2 | 1600 | 83.1% |
| place:reaper-club | 32631 | 20.4 | 1600 | 62.4% |
| place:hospital | 30423 | 19.0 | 1600 | 86.7% |
| place:graveyard | 29490 | 18.4 | 1600 | 100.0% |
| place:yangs | 24460 | 15.3 | 1600 | 55.3% |
| place:florist | 23310 | 14.6 | 1600 | 57.6% |
| place:bank | 23233 | 14.5 | 1600 | 100.0% |
| church:bingo-card | 21662 | 13.5 | 681 | 100.0% |
| reaper-club:market | 20606 | 12.9 | 998 | 93.3% |
| competitors:visit | 20119 | 12.6 | 534 | 100.0% |
| neg:sympathy | 19817 | 12.4 | 1600 | 99.8% |
| place:city-hall | 19807 | 12.4 | 1600 | 100.0% |
| battle:attack | 19591 | 12.2 | 404 | 100.0% |
| competitors:trydoor | 18559 | 11.6 | 534 | 100.0% |
| parlor:upgrades | 18386 | 11.5 | 1600 | 100.0% |
| place:competitors | 17069 | 10.7 | 1600 | 33.4% |
| place:crematorium | 16999 | 10.6 | 1600 | 49.3% |
| neg:cremation | 16107 | 10.1 | 605 | 99.0% |
| competitors:look | 16020 | 10.0 | 534 | 100.0% |
| bank:all-gold | 15800 | 9.9 | 1600 | 100.0% |
| church:bingo | 15793 | 9.9 | 1600 | 42.6% |
| place:cafe | 15568 | 9.7 | 1600 | 100.0% |
| graveyard:swing | 15278 | 9.5 | 404 | 99.8% |
| reaper-club:slots | 14934 | 9.3 | 133 | 100.0% |
| place:health-department | 14813 | 9.3 | 1600 | 91.4% |
| church:serve | 14627 | 9.1 | 581 | 100.0% |
| store:casket:2 | 14060 | 8.8 | 1600 | 89.9% |
| graveyard:monuments | 13710 | 8.6 | 1600 | 100.0% |
| neg:offer:accept | 12918 | 8.1 | 1600 | 99.8% |
| reaper-club:pay | 12711 | 7.9 | 970 | 100.0% |
| place:spirit-university | 12668 | 7.9 | 1600 | 100.0% |
| place:gazette | 12370 | 7.7 | 1600 | 33.4% |
| city-hall:chains | 12292 | 7.7 | 1600 | 33.4% |
| yangs:menu | 11380 | 7.1 | 551 | 100.0% |
| tutorial:next | 11200 | 7.0 | 1600 | 100.0% |
| pawn-shop:loot | 11137 | 7.0 | 1183 | 45.1% |
| competitors:attack | 10982 | 6.9 | 534 | 75.7% |
| hospital:lead | 10753 | 6.7 | 1387 | 19.0% |
| graveyard:duel | 10577 | 6.6 | 526 | 76.8% |
| spirit-university:psych | 10495 | 6.6 | 1600 | 99.9% |
| risk:decline | 10430 | 6.5 | 1600 | 82.4% |
| battle:yellwin | 9651 | 6.0 | 404 | 100.0% |
| city-hall:ordinance | 8924 | 5.6 | 1600 | 100.0% |
| pawn-shop:lot:wood | 8875 | 5.5 | 1198 | 77.5% |
| hospital:treat | 8407 | 5.3 | 1382 | 94.8% |
| reaper-club:seance | 8400 | 5.3 | 397 | 100.0% |
| city-hall:inspection | 8305 | 5.2 | 1600 | 32.8% |
| police:report | 8245 | 5.2 | 1402 | 63.1% |
| yangs:tiger | 8010 | 5.0 | 885 | 30.2% |
| store:hearse | 7900 | 4.9 | 1600 | 99.3% |
| graveyard:rob | 7129 | 4.5 | 397 | 68.3% |
| parlor:dig | 7129 | 4.5 | 395 | 68.6% |
| pawn-shop:lot:silver | 7037 | 4.4 | 1198 | 75.5% |
| florist:buy | 6952 | 4.3 | 921 | 70.9% |
| graveyard:tend | 6802 | 4.3 | 683 | 17.9% |
| competitors:steal | 6654 | 4.2 | 534 | 100.0% |
| police:settle | 6410 | 4.0 | 1402 | 36.9% |
| city-hall:vote | 6400 | 4.0 | 1600 | 100.0% |
| neg:offer:decline | 5647 | 3.5 | 1600 | 87.1% |
| arc:give:church | 5306 | 3.3 | 838 | 55.1% |
| coroner:certificate | 4805 | 3.0 | 1467 | 72.7% |
| graveyard:monument | 4598 | 2.9 | 1600 | 100.0% |
| florist:bundle | 4258 | 2.7 | 921 | 70.9% |
| arc:give:reaper-club | 4180 | 2.6 | 982 | 27.6% |
| store:hearse-look | 3964 | 2.5 | 1589 | 100.0% |
| store:buy | 3936 | 2.5 | 1589 | 100.0% |
| health-department:inspect | 3687 | 2.3 | 1462 | 82.0% |
| neg:raise | 3649 | 2.3 | 397 | 99.2% |
| police:backdoor | 3500 | 2.2 | 1458 | 26.7% |
| mournes:spy | 3367 | 2.1 | 1600 | 34.0% |
| coroner:tip | 3272 | 2.0 | 1467 | 18.7% |
| mournes:undercut | 3074 | 1.9 | 1600 | 16.4% |
| bank:loan | 2818 | 1.8 | 1600 | 15.7% |
| bank:borrow | 2818 | 1.8 | 251 | 100.0% |
| bank:repay | 2818 | 1.8 | 251 | 100.0% |
| bank:savings | 2654 | 1.7 | 1600 | 7.7% |
| yangs:dragon | 2474 | 1.5 | 885 | 27.3% |
| coroner:favour | 2332 | 1.5 | 1467 | 48.0% |
| neg:pkg:urn | 2150 | 1.3 | 598 | 66.9% |
| bank:deposit | 2029 | 1.3 | 123 | 100.0% |
| reaper-club:games | 2001 | 1.3 | 998 | 13.3% |
| reaper-club:buy:hot-casket | 1838 | 1.1 | 915 | 42.1% |
| coroner:quiet | 1829 | 1.1 | 704 | 40.6% |
| reaper-club:buy:coroner-list | 1818 | 1.1 | 907 | 43.9% |
| gazette:classified | 1744 | 1.1 | 535 | 49.9% |
| arc:give:city-hall | 1725 | 1.1 | 987 | 33.7% |
| city-hall:election | 1707 | 1.1 | 1600 | 64.2% |
| spirit-university:strength | 1677 | 1.0 | 1600 | 25.3% |
| tutorial:start | 1600 | 1.0 | 1600 | 100.0% |
| parlor:buy:paint | 1600 | 1.0 | 1600 | 100.0% |
| parlor:buy:coffee-machine | 1600 | 1.0 | 1600 | 100.0% |
| parlor:buy:storeroom | 1536 | 1.0 | 1539 | 99.8% |
| police:patrol | 1504 | 0.9 | 1458 | 23.1% |
| city-hall:certify | 1486 | 0.9 | 525 | 83.6% |
| parlor:buy:florist-cooler | 1449 | 0.9 | 1539 | 94.2% |
| crematorium:diamonds | 1442 | 0.9 | 458 | 50.9% |
| bank:transferhome | 1338 | 0.8 | 1600 | 15.6% |
| bank:transfer | 1338 | 0.8 | 250 | 100.0% |
| bank:transfer-tier | 1338 | 0.8 | 250 | 100.0% |
| city-hall:permits | 1330 | 0.8 | 1600 | 49.8% |
| parlor:buy:viewing-room | 1320 | 0.8 | 1355 | 97.4% |
| health-department:fine | 1297 | 0.8 | 806 | 100.0% |
| parlor:buy:embalming-lab | 1067 | 0.7 | 1488 | 71.7% |
| battle:yelllost | 1049 | 0.7 | 314 | 100.0% |
| hospital:leave-room | 1049 | 0.7 | 314 | 100.0% |
| health-department:complaint | 1038 | 0.6 | 263 | 98.9% |
| city-hall:elect | 1016 | 0.6 | 1016 | 100.0% |
| city-hall:invite | 969 | 0.6 | 320 | 43.8% |
| reaper-club:hit | 951 | 0.6 | 998 | 34.6% |
| city-hall:lobby | 945 | 0.6 | 1600 | 8.6% |
| gazette:smear | 898 | 0.6 | 535 | 48.0% |
| yangs:sparrow | 896 | 0.6 | 885 | 14.5% |
| reaper-club:buy:morty-rib | 877 | 0.5 | 906 | 29.4% |
| crematorium:scatter | 833 | 0.5 | 458 | 49.1% |
| gazette:puff | 750 | 0.5 | 535 | 25.8% |
| church:water | 716 | 0.4 | 1122 | 28.5% |
| spirit-university:hp | 674 | 0.4 | 1600 | 8.6% |
| city-hall:permit:signage | 668 | 0.4 | 796 | 83.9% |
| city-hall:permit:zoning | 658 | 0.4 | 796 | 82.7% |
| crematorium:bulk | 630 | 0.4 | 788 | 29.7% |
| bank:withdrawall | 625 | 0.4 | 123 | 100.0% |
| reaper-club:buy:testimonials | 614 | 0.4 | 915 | 14.1% |
| parlor:buy:incinerator | 610 | 0.4 | 965 | 63.2% |
| reaper-club:buy:filed-tag | 589 | 0.4 | 876 | 28.9% |
| reaper-club:buy:sal-pad | 513 | 0.3 | 893 | 14.4% |
| coroner:burial | 503 | 0.3 | 704 | 59.4% |
| reaper-club:buy:used-wreaths | 495 | 0.3 | 901 | 15.2% |
| city-hall:bribe | 489 | 0.3 | 137 | 100.0% |
| graveyard:shove | 488 | 0.3 | 404 | 63.6% |
| reaper-club:buy:real-water | 471 | 0.3 | 867 | 14.8% |
| graveyard:yield | 469 | 0.3 | 404 | 58.7% |
| parlor:rivalry | 409 | 0.3 | 1600 | 25.6% |
| parlor:buy:memorial-garden | 403 | 0.3 | 632 | 63.8% |
| parlor:buy:chapel | 389 | 0.2 | 391 | 99.5% |
| reaper-club:buy:bruno | 372 | 0.2 | 883 | 14.7% |
| reaper-club:buy:haunted-casket | 368 | 0.2 | 868 | 14.6% |
| reaper-club:buy:clover | 356 | 0.2 | 911 | 13.8% |
| reaper-club:buy:riot-shield | 342 | 0.2 | 855 | 24.9% |
| reaper-club:buy:vest | 314 | 0.2 | 901 | 14.3% |
| reaper-club:buy:rabbit-foot | 308 | 0.2 | 903 | 13.5% |
| parlor:buy:billboard | 291 | 0.2 | 639 | 45.5% |
| reaper-club:buy:monster-scale | 290 | 0.2 | 899 | 13.0% |
| reaper-club:buy:tap-water | 287 | 0.2 | 907 | 13.0% |
| battle:run | 282 | 0.2 | 404 | 45.3% |
| city-hall:join | 268 | 0.2 | 268 | 100.0% |
| parlor:rivalry:cutthroat | 267 | 0.2 | 409 | 65.3% |
| parlor:buy:guard-dog | 265 | 0.2 | 1540 | 17.2% |
| parlor:markup | 253 | 0.2 | 1600 | 15.8% |
| reaper-club:buy:cop-day-off | 248 | 0.2 | 797 | 13.4% |
| parlor:buy:alarm | 219 | 0.1 | 264 | 83.0% |
| reaper-club:buy:forged-permit | 215 | 0.1 | 850 | 14.2% |
| reaper-club:buy:mayor-key | 172 | 0.1 | 833 | 13.1% |
| gazette:display | 157 | 0.1 | 535 | 19.6% |
| reaper-club:bodyguard | 145 | 0.1 | 997 | 10.3% |
| parlor:rivalry:peaceful | 142 | 0.1 | 409 | 34.7% |
| city-hall:found | 140 | 0.1 | 469 | 29.9% |
| parlor:markup:20 | 130 | 0.1 | 253 | 51.4% |
| city-hall:file | 127 | 0.1 | 127 | 100.0% |
| parlor:buy:night-watchman | 123 | 0.1 | 162 | 75.9% |
| parlor:markup:10 | 123 | 0.1 | 253 | 48.6% |
| church:confess | 61 | 0.0 | 1040 | 5.2% |
| parlor:buy:mausoleum | 40 | 0.0 | 51 | 78.4% |
| city-hall:ads | 13 | 0.0 | 97 | 13.4% |
| florist:church | 9 | 0.0 | 921 | 1.0% |
| city-hall:permit:crematory | 4 | 0.0 | 796 | 0.5% |
| reaper-club:buy:tiny | 1 | 0.0 | 889 | 0.1% |
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
| health-department:buy | 0 | 0.0 | 1462 | 0.0% |
| city-hall:leavechain | 0 | 0.0 | 408 | 0.0% |
| graveyard:look | 0 | 0.0 | 1600 | 0.0% |
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
- **Walkout pacing.** 0.1% of 774,284 customers walked out. Bots stop pushing before the mood does, so this is the floor; a person who misreads a customer, or is greedy for the exact match (24.7% of the bots' sales), will see far more. Whether a walkout feels like a fair lesson or a punishment is not measurable here.
- **How often the town speaks.** News changed the rules on 57.1% of days, a weather set on 100.0%, and a story arc was running on 62.7% of days (3.0 arcs and 6.2 story beats a town a season). Bots read none of it as a story; whether that is too much, too little, or repeats itself by day 20 needs readers.
- **Is the election a contest?** 0.64 candidates stood in each of 200 elections and 8.0 parlors voted: the bots vote by a preference list. Whether people campaign, lobby or bluff is a social question.
- **Ordinances and arcs by effect, not by rote.** The bots rank ordinances from a fixed list (800 ballots, 8.00 votes each, 945 lobbying votes bought). Do players read the effects and choose, or click the first?
- **Grudges and bluffing.** 8,452 duels and 743 hits happened with no memory of who did what to whom. Retaliation, alliances and the Peace Pledge as a social contract are for people.
- **Wording.** The bots read panels and button ids, and `packages/bots/test/scrambled.test.ts` plays a season with every pack string reworded and sees no stuck day; that proves the text does not carry rules, not that it is funny, clear or tonally right.

