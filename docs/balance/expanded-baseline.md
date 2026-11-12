# Balance report: expanded rules

## What it says about the Expanded design

*Hand-written reading of the generated tables below (regenerating with `pnpm --filter @fq/sim run sim -- --days 30 --towns 200 --players 8 --rules expanded --seed 1 --challenges 6 --out docs/balance/expanded-baseline` overwrites this file; keep this section, or rebuild the tables alone with `pnpm --filter @fq/sim exec tsx src/remark.ts ../../docs/balance/expanded-baseline`, which keeps it). 200 towns of 8 hard bots drawn from the twelve `@fq/bots` personalities, a 30-day season with the built-in `expandedPack`. This is the run after balance round 21 of `expanded-tuning-log.md`, which built the two rule changes round 20 asked for and the owner approved (decisions 25 and 26): the night patrol and the back door cost a parlor ahead of the town $25 more for each BP of its lead (`town.placesA.police.aheadPerBp`), and Mourne & Sons' free hold pays its karma once every three game days (`town.placesB.mournes.hold.everyDays`). "Before" is the round-20 baseline this file replaced (same 200 towns and seeds). No Classic rule or number changed (decision 27). A personality's win share moves by 0.2 to 0.4 for a couple of wins at this size (see reading 2), so read BP against the town mean first.*

**Checks: all passed**: no invariant breaks, no offered button rejected, no stuck bot-day, no error, none of the conservation signatures.

### The targets

| target | before (round 20) | after (round 21) | met? |
| --- | --- | --- | --- |
| no personality above about 2x its fair share of wins, none below a third | tycoon 3.38, necromancer 2.33, politician 1.68, pacifist 1.41, shark 0.98, builder 0.62, gambler 0.42, Soft Touch 0.31, saboteur 0.29, saint 0.26, organiser 0.23, scholar 0.22 | tycoon 2.34, politician 2.03, pacifist 1.80, necromancer 1.67, builder 1.06, gambler 0.60, saint 0.59, shark 0.49, scholar 0.39, Soft Touch 0.38, saboteur 0.35, organiser 0.34 | **nearly**: none below a third (five were); the tycoon at 2.34 and the politician at 2.03 are a little over 2x (see 1) |
| round 20's own target: the tycoon within about 2x on wins and under about +4.5% of its towns' BP | 3.38, +6.5% | 2.34, +5.3% | **close**: both changes landed on it and on nobody else (see 1); what is left is its unspendable money (see 3) |
| the same field read by mean place and mean BP (reported alongside, not a new target) | mean place 2.28 to 6.61; -8.7% to +6.5% of the town mean; town mean 19,440 | mean place 2.51 to 6.59; -8.9% to +5.3%; town mean 19,383 | the spread narrowed at the top |
| the rest of the field's cost of the places under 1% of BP | -0.6% (19,440 against 19,566 without the places) | the town's mean BP -0.25% against round 20 (19,383); the parlors other than the tycoon -0.1% (19,291 against 19,317) | yes |
| good and evil within a few percent | good +1.2%, neutral +1.5%, evil -3.9%; wins: evil 1.20, good 1.06, neutral 0.79 | good +1.5%, neutral +1.7%, evil -4.8%; wins: good 1.21, neutral 0.91, evil 0.84 | yes; evil lost a point (the back door is dearer for a leader, see 4) |
| no single purchase dominant, no system dead | none returns BP a dollar as a monument does; the church wreath sent 1,793 times | unchanged; the hold is still used by 1,329 seats (12,522 presses, was 35,453), the patrol by 185 seats (490, was 1,502) | yes |
| skill worth clearly more than luck | Daily Challenge hard 418.5, easy 365.4 | hard 418.5, easy 365.4 (72 runs each; the challenge does not visit the places) | yes |
| PvP-heavy play viable, peaceful play not miserable | 8,513 duels, 499 hits landed; 1,502 patrols and 3,454 back doors | 8,701 duels, 566 hits landed; 490 patrols and 2,038 back doors; the pacifist +2.8% | yes |
| loans cannot be turned into points; a small house edge | no default | no loan or house rule changed; no default | yes |
| a full but not grindy day | 364 screens a bot-day | 364 | see the round-17 baseline's 7 |

### Reading

1. **The two rule changes reach the tycoon and nobody else.** Round 20 found that what the eight places gave the leader was protection (the patrol) and karma (the free hold), and that no price could reach a parlor that ends a season with money it cannot spend. A price that grows with the lead does: at $25 a BP a 500-BP lead makes tonight's car $16,000, so the tycoon buys it only when its lead is small, the town's patrols fall by two thirds (1,502 to 490) and the leader's parlor-fight losses rise from 539 to 619 BP a season. The hold limit takes its good path from 28% of its seats to 13% (karma 65 to 61). Together: +6.5% to +5.3% of its towns' BP, 3.38 to 2.34 times its share, mean place 2.28 to 2.51. The field's BP is unchanged (-0.1%): the extra is paid by the leader alone, and a parlor at or below the town's average still pays $3,500. At 60 towns (`expanded-tuning-log.md`, round 21) the tycoon was at +5.1% and 1.78; the 200-town figure is the one to quote.
2. **No personality is below a third of its share any more, and win share is still noise at this size.** The saint went from 0.26 to 0.59, the organiser 0.23 to 0.34, the scholar 0.22 to 0.39 and the Soft Touch 0.31 to 0.38 with no change to anything they do: the wins the tycoon no longer takes are spread over the field. The necromancer fell from 2.33 to 1.67 (its BP -2.1% to -3.2%): a parlor that fights the leader now meets a leader with no car outside, and loses more of those fights too (reading 4). Two styles are a little over 2x: the tycoon (2.34) and the politician (2.03, +4.3%, the best seller after the tycoon and unchanged since round 17). Read by BP against the town mean the field runs from -8.9% (the saboteur, whose BP is spent on others) to +5.3%; all but the saboteur, the tycoon, the politician and the necromancer are within 3.1%.
3. **What is left of the tycoon's edge is money it cannot spend, not the places.** It ends with $40,200 in cash (was $46,300: the dearer car took $6,000 of it) and its only late sinks are the monuments and the tithe limit. Its +5.3% is now about what the places gave it in round 19 before the patrol and the hold were measured (+4.5% without any of the eight at 60 towns), so the next point has to come from section 28 (a late money sink that pays no BP, or less money per sale for a parlor far ahead), which is a design question for the owner, not a number.
4. **Evil lost a point** (-3.9% to -4.8%, wins 1.20 to 0.84): the back door takes the same extra as the patrol, so an evil leader (the necromancer, the shark) pays for it or goes without, and the shark (-0.6% to -2.0%) went without ($41,200 to $37,400 in cash, 581 to 577 BP of fight losses, place 4.71 to 5.28). The good path gained (wins 1.06 to 1.21) because the saint and the pacifist pick up the wins the tycoon loses. Within a few percent still; watch it.
5. **The places' cost to the field.** The Police Station now takes $9,780 a user a season (was $3,800), all of it from the leaders' extras; the other seven places are within a few percent of round 20 (the oven +$2,944 a user, the bouquets +$115, the Gazette -$10,845, the coroner -$6,134 with +5.9 word of mouth, the Health Department -$3,345 with +3.7, the pawn -$22,098 mostly stock, the Mournes -$1,682 and +5 karma, was +15). The town's mean BP is 0.25% under round 20.
6. **The church wreath, the no-lock check, second-hand caskets, the quiet favour and the smear** are as in the round-20 reading (nothing they depend on changed): 566 hits landed (was 499, the leader has fewer cars), 8,701 duels, no chain of smears, the wreath still alive.
7. **Late starters, hidden information, the oracle, no-fighter towns, the late joiner** (previous baselines, not re-run): nothing in round 21 depends on them.

### Recommended next tuning and proposals (for the owner to decide; nothing here was applied)

| proposal | evidence |
| --- | --- |
| The tycoon's capped money sinks (section 28): it ends with $40,000 a season it cannot spend, and that is now the whole of its remaining edge. A late sink that pays no BP (a season-end charity, a dearer top monument), or a sale's money falling off for a parlor far ahead | reading 3 |
| Accept 2.34 and 2.03 as "about 2x" for a field of twelve styles over 200 towns, and keep judging Expanded by mean place and BP against the town mean | readings 1 and 2; unchanged since round 17 |
| The patrol rate: 25 was the best of 10, 25 and 50 at 60 towns (round 21); a rate the leader never pays (50) gave its edge back. Leave it unless people say the car is never worth it | round 21 |
| The Memorial Garden at a monument's rate; the necromancer's spread; the politician; shorter days without less depth | unchanged since the round-17 baseline: see that round's entries in `expanded-tuning-log.md` |

### What the bots cannot tell us

See the last section of the generated tables, "What only human playtesting can answer". The eight places add questions for people: whether the Gazette's smear and the Health Department's complaint feel like sport or like griefing to the parlor on the end of them, whether a +1 karma every three days at the Mournes still feels like a loophole, whether a leader paying $16,000 for a night's car feels fair or like being punished for winning (Sergeant Bixby says why), and whether the Police Station's report (a public fine) is satisfying after a beating.

---

Generated by `@fq/sim`: 200 towns of 8 bots, 30 days each, difficulty hard, base seed 1. 17,397,227 actions in 2591 s.

**Checks: passed.** No invariant breaks, rejected offered buttons, exploit signatures or stuck bots.

## Win rate by personality

| personality | seats | wins | win rate | fair share | mean final BP | mean place |
| --- | --- | --- | --- | --- | --- | --- |
| tycoon | 123 | 36 | 29.3% | 12.5% | 20491.8 | 2.51 |
| politician | 138 | 35 | 25.4% | 12.5% | 20240.6 | 2.96 |
| pacifist | 142 | 32 | 22.5% | 12.5% | 19977.3 | 3.77 |
| necromancer | 134 | 28 | 20.9% | 12.5% | 18750.8 | 4.90 |
| builder | 128 | 17 | 13.3% | 12.5% | 19837.4 | 4.12 |
| gambler | 133 | 10 | 7.5% | 12.5% | 18828.1 | 5.69 |
| saint | 122 | 9 | 7.4% | 12.5% | 19776.9 | 3.97 |
| shark | 130 | 8 | 6.2% | 12.5% | 18883.6 | 5.28 |
| scholar | 145 | 7 | 4.8% | 12.5% | 19480.1 | 4.77 |
| mourner | 128 | 6 | 4.7% | 12.5% | 19376.4 | 4.97 |
| saboteur | 137 | 6 | 4.4% | 12.5% | 17331.2 | 6.59 |
| organiser | 140 | 6 | 4.3% | 12.5% | 19714.2 | 4.34 |

## BP by personality

BP/turn counts only turns spent on customers; BP/day includes risks, events, mail rewards and battles.

| personality | player-days | BP/day | BP/turn | sale BP/turn | fight BP/day | turns/day | sales/day | walkouts | exact | within 3% | within 8% | bonus share of sale BP | price/limit | risks taken | risk BP/day |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tycoon | 3690 | 688.5 | 41.24 | 34.98 | 0.0 | 16.7 | 16.3 | 0.0% | 24.5% | 17.0% | 9.7% | 23.9% | 0.75 | 94.1% | 67.4 |
| politician | 4140 | 671.0 | 42.53 | 35.38 | 0.0 | 15.8 | 15.4 | 0.0% | 29.2% | 19.0% | 10.2% | 26.7% | 0.78 | 92.3% | 63.1 |
| builder | 3840 | 664.8 | 39.00 | 33.50 | 0.0 | 17.0 | 16.7 | 0.0% | 21.0% | 15.9% | 9.6% | 21.8% | 0.72 | 93.8% | 66.3 |
| organiser | 4200 | 661.9 | 39.49 | 33.92 | 0.0 | 16.8 | 16.4 | 0.0% | 23.3% | 16.5% | 9.8% | 23.4% | 0.74 | 93.6% | 64.5 |
| saint | 3660 | 657.2 | 42.52 | 34.27 | 0.0 | 15.5 | 15.1 | 0.0% | 27.6% | 17.3% | 9.7% | 25.9% | 0.76 | 92.1% | 61.0 |
| pacifist | 4260 | 654.3 | 41.03 | 33.67 | 0.0 | 15.9 | 15.6 | 0.0% | 28.8% | 18.0% | 10.1% | 27.6% | 0.77 | 88.7% | 58.3 |
| scholar | 4350 | 652.7 | 39.09 | 33.58 | 0.0 | 16.7 | 16.3 | 0.0% | 24.8% | 16.4% | 9.6% | 24.9% | 0.74 | 93.6% | 65.6 |
| mourner | 3840 | 641.2 | 40.62 | 33.97 | 0.0 | 15.8 | 15.4 | 0.0% | 26.6% | 17.1% | 9.9% | 25.3% | 0.75 | 87.1% | 58.2 |
| shark | 3900 | 638.3 | 36.49 | 33.13 | 0.0 | 17.5 | 17.0 | 0.4% | 23.0% | 16.0% | 9.8% | 23.8% | 0.73 | 77.1% | 47.9 |
| gambler | 3990 | 632.2 | 40.17 | 33.08 | 21.5 | 15.7 | 15.4 | 0.1% | 26.2% | 17.9% | 11.7% | 25.7% | 0.77 | 74.5% | 43.4 |
| necromancer | 4020 | 622.5 | 39.73 | 32.33 | 31.0 | 15.7 | 15.3 | 0.2% | 25.0% | 17.2% | 11.9% | 25.1% | 0.77 | 64.4% | 36.6 |
| saboteur | 4110 | 567.3 | 38.73 | 25.18 | 127.5 | 14.6 | 14.4 | 0.0% | 15.6% | 11.6% | 9.4% | 20.3% | 0.66 | 66.6% | 37.5 |

## BP by psych level (as the stats sheet shows it, at the start of the day)

| psych | player-days | BP/day | BP/turn | sale BP/turn | fight BP/day | turns/day | sales/day | walkouts | exact | within 3% | within 8% | bonus share of sale BP | price/limit | risks taken | risk BP/day |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 6688 | 485.5 | 32.42 | 25.41 | 62.0 | 15.0 | 14.9 | 0.1% | 16.3% | 11.5% | 9.7% | 20.6% | 0.67 | 59.3% | 30.8 |
| 2 | 1656 | 440.8 | 29.21 | 26.05 | 11.2 | 15.1 | 14.8 | 0.1% | 17.4% | 12.3% | 10.7% | 21.0% | 0.69 | 59.5% | 27.8 |
| 3 | 3042 | 513.5 | 33.80 | 28.07 | 29.9 | 15.2 | 14.9 | 0.1% | 20.6% | 14.0% | 10.4% | 23.2% | 0.71 | 75.9% | 38.1 |
| 4 | 7738 | 564.8 | 35.27 | 30.15 | 6.1 | 16.0 | 15.6 | 0.1% | 23.0% | 15.5% | 10.7% | 24.5% | 0.73 | 86.2% | 50.2 |
| 5 | 4288 | 596.9 | 36.64 | 31.34 | 2.5 | 16.3 | 15.9 | 0.1% | 24.2% | 16.4% | 10.4% | 24.9% | 0.74 | 92.1% | 60.7 |
| 6 | 4724 | 648.3 | 39.23 | 33.17 | 7.9 | 16.5 | 16.1 | 0.1% | 26.3% | 17.5% | 10.9% | 25.7% | 0.76 | 85.6% | 60.4 |
| 7 | 4162 | 703.6 | 42.21 | 35.34 | 7.3 | 16.7 | 16.2 | 0.1% | 28.1% | 18.5% | 10.4% | 26.1% | 0.78 | 90.6% | 66.7 |
| 8 | 15702 | 798.1 | 47.80 | 38.92 | 5.4 | 16.7 | 16.3 | 0.0% | 28.8% | 19.4% | 9.5% | 25.4% | 0.78 | 95.6% | 69.9 |

## The exact match

186628 of 757352 sales (24.6%) hit the spending limit exactly: 116.64 per player per 30 days. All closeness bonuses (exact, within 3%, within 8%) are the "bonus share" column above.

## Wait for Customer outcomes

| outcome | count | share |
| --- | --- | --- |
| customer | 774718 | 80.5% |
| event | 75141 | 7.8% |
| risk | 72756 | 7.6% |
| script | 39639 | 4.1% |
| noTurns | 0 | 0.0% |

## Tags

Income by source:

| category | gold-tag equivalents | share |
| --- | --- | --- |
| sales | 443659.8 | 93.6% |
| theft | 15675.0 | 3.3% |
| bonus tag | 11609.8 | 2.4% |
| other | 1641.0 | 0.3% |
| received | 1006.5 | 0.2% |
| black market | 583.0 | 0.1% |

Spending and losses by use:

| category | gold-tag equivalents | share |
| --- | --- | --- |
| psych | 165116.0 | 51.9% |
| hearse | 83647.0 | 26.3% |
| strength | 23451.0 | 7.4% |
| stolen | 15675.0 | 4.9% |
| hp | 15039.0 | 4.7% |
| club cover | 6333.0 | 2.0% |
| arson | 4200.0 | 1.3% |
| bingo | 2466.8 | 0.8% |
| transfers | 1342.0 | 0.4% |
| burned | 1154.5 | 0.4% |

| personality | arson | bingo | burned | club cover | hearse | hp | psych | stolen | strength | transfers |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gambler | 0.0 | 2410.5 | 130.0 | 977.8 | 9112.0 | 0.0 | 14896.0 | 1668.5 | 4788.0 | 0.0 |
| shark | 0.0 | 0.0 | 377.0 | 1030.8 | 16120.0 | 0.0 | 14196.0 | 1465.3 | 0.0 | 0.0 |
| saint | 0.0 | 56.3 | 3.0 | 1081.0 | 4148.0 | 0.0 | 13664.0 | 1373.5 | 0.0 | 590.0 |
| scholar | 0.0 | 0.0 | 33.8 | 1437.5 | 10005.0 | 0.0 | 16240.0 | 959.0 | 0.0 | 0.0 |
| mourner | 0.0 | 0.0 | 36.5 | 0.0 | 8832.0 | 0.0 | 14336.0 | 855.3 | 0.0 | 752.0 |
| politician | 0.0 | 0.0 | 71.3 | 37.3 | 4692.0 | 0.0 | 15456.0 | 2224.5 | 0.0 | 0.0 |
| organiser | 0.0 | 0.0 | 82.5 | 5.5 | 4760.0 | 0.0 | 15680.0 | 1198.3 | 0.0 | 0.0 |
| builder | 0.0 | 0.0 | 40.3 | 4.8 | 8832.0 | 0.0 | 14336.0 | 1000.5 | 0.0 | 0.0 |
| pacifist | 0.0 | 0.0 | 0.0 | 0.0 | 4828.0 | 0.0 | 15904.0 | 0.0 | 0.0 | 0.0 |
| necromancer | 0.0 | 0.0 | 348.5 | 96.3 | 4556.0 | 0.0 | 15008.0 | 2061.0 | 7236.0 | 0.0 |
| tycoon | 0.0 | 0.0 | 31.8 | 1530.3 | 4182.0 | 0.0 | 13776.0 | 1088.5 | 0.0 | 0.0 |
| saboteur | 4200.0 | 0.0 | 0.0 | 132.0 | 3580.0 | 15039.0 | 1624.0 | 1780.8 | 11427.0 | 0.0 |

## PvP

| measure | value |
| --- | --- |
| visits (doors reached) | 18731 |
| visits per player-day | 0.39 |
| refused at the door (online, police, locked) | 1007 |
| thefts | 6663 |
| tags per theft | 1.43 |
| battles started | 11061 |
| attacker wins / losses | 9687 / 1069 (90.1%) |
| BP won by winning attackers | 776097 |
| BP lost by losing attackers | 41529 |
| arsons hired / stopped by a smoke detector | 700 / 0 |
| Cursed Tigers / Lucky Sparrows / Lucky Dragons | 8010 / 896 / 2529 |

BP lost to other parlors' attacks, per player-day, by the victim's personality:

| personality | BP lost per day |
| --- | --- |
| shark | 15.9 |
| gambler | 13.5 |
| necromancer | 12.5 |
| tycoon | 10.0 |
| organiser | 9.4 |
| politician | 9.0 |
| builder | 8.4 |
| scholar | 7.8 |
| saint | 7.0 |
| mourner | 3.4 |
| saboteur | 0.3 |

## Snowball

At the end the leader has 1.07x the median parlor's BP.

| after day | leader went on to win |
| --- | --- |
| 1 | 22.5% |
| 3 | 25.0% |
| 5 | 27.0% |
| 10 | 36.5% |
| 15 | 46.5% |
| 20 | 54.0% |
| 25 | 70.5% |

| leader after day | builder | gambler | mourner | necromancer | organiser | pacifist | politician | saboteur | saint | scholar | shark | tycoon |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 19 | 16 | 10 | 29 | 30 | 10 | 18 | 13 | 10 | 12 | 18 | 15 |
| 5 | 11 | 10 | 14 | 17 | 20 | 16 | 40 | 13 | 20 | 7 | 15 | 17 |
| 10 | 8 | 6 | 13 | 15 | 11 | 24 | 61 | 12 | 30 | 3 | 4 | 13 |
| 15 | 4 | 2 | 14 | 22 | 5 | 26 | 76 | 9 | 27 | 1 | 2 | 12 |
| 20 | 4 | 5 | 16 | 25 | 5 | 31 | 71 | 7 | 23 | 2 | 4 | 7 |
| 25 | 7 | 7 | 9 | 26 | 5 | 32 | 51 | 6 | 16 | 5 | 4 | 32 |
| 30 | 17 | 10 | 6 | 28 | 6 | 32 | 35 | 6 | 9 | 7 | 8 | 36 |

| day | leader BP | runner-up | median | leader / median | lead over runner-up |
| --- | --- | --- | --- | --- | --- |
| 1 | 534.0 | 466.5 | 400.8 | 1.34 | 67.5 |
| 5 | 2677.7 | 2477.0 | 2216.2 | 1.21 | 200.8 |
| 10 | 5775.0 | 5418.7 | 4997.9 | 1.16 | 356.2 |
| 15 | 9190.0 | 8695.1 | 8126.4 | 1.13 | 495.0 |
| 20 | 12917.5 | 12343.6 | 11757.0 | 1.10 | 574.0 |
| 25 | 16919.5 | 16381.6 | 15721.1 | 1.08 | 537.9 |
| 30 | 21087.9 | 20478.6 | 19788.1 | 1.07 | 609.3 |

## Expanded: win rate by personality

| personality | seats | wins | win rate | fair share | win / fair | mean final BP | mean place | BP vs town mean | sd of that |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tycoon | 123 | 36 | 29.3% | 12.5% | 2.34 | 20,492 | 2.51 | +5.3% | 3.8% |
| politician | 138 | 35 | 25.4% | 12.5% | 2.03 | 20,241 | 2.96 | +4.3% | 4.3% |
| pacifist | 142 | 32 | 22.5% | 12.5% | 1.80 | 19,977 | 3.77 | +2.8% | 5.4% |
| necromancer | 134 | 28 | 20.9% | 12.5% | 1.67 | 18,751 | 4.90 | -3.2% | 11.9% |
| builder | 128 | 17 | 13.3% | 12.5% | 1.06 | 19,837 | 4.12 | +1.8% | 4.2% |
| gambler | 133 | 10 | 7.5% | 12.5% | 0.60 | 18,828 | 5.69 | -3.1% | 7.1% |
| saint | 122 | 9 | 7.4% | 12.5% | 0.59 | 19,777 | 3.97 | +2.0% | 4.2% |
| shark | 130 | 8 | 6.2% | 12.5% | 0.49 | 18,884 | 5.28 | -2.0% | 7.1% |
| scholar | 145 | 7 | 4.8% | 12.5% | 0.39 | 19,480 | 4.77 | +0.3% | 4.2% |
| mourner | 128 | 6 | 4.7% | 12.5% | 0.38 | 19,376 | 4.97 | -0.0% | 4.5% |
| saboteur | 137 | 6 | 4.4% | 12.5% | 0.35 | 17,331 | 6.59 | -8.9% | 9.2% |
| organiser | 140 | 6 | 4.3% | 12.5% | 0.34 | 19,714 | 4.34 | +1.2% | 4.2% |

Spread: mean final BP from 17,331 to 20,492 (3,161 BP, sd 815 around 19,391); mean place from 2.51 to 6.59.

## Expanded: win rate by karma path (at the end of the season)

| path | seats | wins | win rate | fair share | win / fair | mean final BP | mean place | BP vs town mean | sd of that |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| good | 590 | 89 | 15.1% | 12.5% | 1.21 | 19,684 | 4.15 | +1.5% | 5.7% |
| neutral | 609 | 69 | 11.3% | 12.5% | 0.91 | 19,799 | 4.11 | +1.7% | 4.8% |
| evil | 401 | 42 | 10.5% | 12.5% | 0.84 | 18,309 | 5.60 | -4.8% | 10.1% |

| rivalry tier | seats | wins | win rate | fair share | win / fair | mean final BP | mean place | BP vs town mean | sd of that |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| peaceful | 142 | 32 | 22.5% | 12.5% | 1.80 | 19,977 | 3.77 | +2.8% | 5.4% |
| standard | 1191 | 154 | 12.9% | 12.5% | 1.03 | 19,603 | 4.26 | +0.9% | 6.5% |
| cutthroat | 267 | 14 | 5.2% | 12.5% | 0.42 | 18,087 | 5.95 | -5.5% | 8.9% |

| PvP | seats | wins | win rate | fair share | win / fair | mean final BP | mean place | BP vs town mean | sd of that |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| never fights | 1080 | 148 | 13.7% | 12.5% | 1.10 | 19,810 | 3.98 | +2.0% | 5.0% |
| fights (parlor, duel or hit) | 520 | 52 | 10.0% | 12.5% | 0.80 | 18,496 | 5.57 | -4.1% | 9.5% |

## Expanded: the parlors at the end of the season

| personality | final BP | cash | savings | karma | good / evil | upgrades | monuments | in a chain | mayor | BP lost to PvP | decisions / day | turns / day |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| builder | 19,837 | 8,786 | 0 | 53 | 1.6% / 0.0% | 7.8 | 2.9 | 65.6% | 0.0% | 416 | 355 | 17.1 |
| gambler | 18,828 | 5,489 | 0 | 61 | 26.3% / 0.0% | 6.3 | 2.5 | 0.0% | 0.0% | 629 | 371 | 16.6 |
| mourner | 19,376 | 3,724 | 0 | 100 | 100.0% / 0.0% | 7.2 | 2.2 | 70.3% | 0.0% | 225 | 351 | 16.7 |
| necromancer | 18,751 | 14,805 | 0 | 1 | 0.0% / 100.0% | 6.3 | 3.1 | 0.0% | 0.0% | 669 | 378 | 17.2 |
| organiser | 19,714 | 15,122 | 0 | 54 | 2.9% / 0.0% | 8.6 | 3.0 | 100.0% | 0.0% | 478 | 348 | 16.8 |
| pacifist | 19,977 | 11,665 | 0 | 100 | 100.0% / 0.0% | 6.6 | 3.0 | 0.0% | 0.0% | 0 | 363 | 16.9 |
| politician | 20,241 | 3,027 | 0 | 100 | 100.0% / 0.0% | 4.1 | 2.0 | 68.1% | 92.0% | 557 | 371 | 16.7 |
| saboteur | 17,331 | 7,029 | 0 | 1 | 0.0% / 100.0% | 7.8 | 2.6 | 0.0% | 0.0% | 102 | 313 | 16.2 |
| saint | 19,777 | 2,142 | 0 | 100 | 100.0% / 0.0% | 3.0 | 1.5 | 0.0% | 0.0% | 423 | 356 | 16.4 |
| scholar | 19,480 | 7,187 | 0 | 53 | 2.1% / 0.0% | 7.6 | 2.8 | 0.0% | 0.0% | 385 | 345 | 16.7 |
| shark | 18,884 | 37,389 | 0 | 2 | 0.0% / 100.0% | 8.0 | 4.1 | 0.0% | 0.0% | 577 | 426 | 17.9 |
| tycoon | 20,492 | 40,247 | 0 | 61 | 13.0% / 0.0% | 8.0 | 4.4 | 0.0% | 0.0% | 619 | 376 | 16.7 |

Decisions per bot-day across the town: 362 screens answered from log on to log off (the newspaper, every look at the hand of cards, every Back and every walk across the map included), of which 192 are choices (a pitch, a purchase, a vote: anything but looking and walking), for 16.1 customers a day.

## Expanded: selling

| personality | sales / day | walkouts | exact | within 3% | within 8% | bonus share of sale BP | sale BP / customer | money / sale | actions / sale | cremations | listened | coffee | blessed | happy families | sour families |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| builder | 16.7 | 0.0% | 21.0% | 15.9% | 9.6% | 21.8% | 33.5 | 833 | 7.1 | 0.1% | 81.8% | 67.9% | 0.2% | 30.5% | 38.8% |
| gambler | 15.4 | 0.1% | 26.2% | 17.9% | 11.7% | 25.7% | 33.1 | 635 | 7.3 | 0.4% | 86.4% | 72.4% | 3.8% | 33.1% | 35.2% |
| mourner | 15.4 | 0.0% | 26.6% | 17.1% | 9.9% | 25.3% | 34.0 | 566 | 7.9 | 0.0% | 78.1% | 65.0% | 66.6% | 48.5% | 25.0% |
| necromancer | 15.3 | 0.2% | 25.0% | 17.2% | 11.9% | 25.1% | 32.3 | 884 | 7.4 | 1.3% | 86.4% | 72.6% | 0.7% | 30.2% | 36.8% |
| organiser | 16.4 | 0.0% | 23.3% | 16.5% | 9.8% | 23.4% | 33.9 | 761 | 7.1 | 0.6% | 80.0% | 65.1% | 0.5% | 30.9% | 39.7% |
| pacifist | 15.6 | 0.0% | 28.8% | 18.0% | 10.1% | 27.6% | 33.7 | 714 | 8.4 | 0.6% | 81.7% | 69.5% | 71.1% | 48.4% | 32.3% |
| politician | 15.4 | 0.0% | 29.2% | 19.0% | 10.2% | 26.7% | 35.4 | 454 | 8.6 | 0.0% | 85.0% | 75.9% | 76.2% | 47.9% | 30.0% |
| saboteur | 14.4 | 0.0% | 15.6% | 11.6% | 9.4% | 20.3% | 25.2 | 662 | 5.7 | 0.3% | 76.1% | 62.7% | 0.0% | 28.0% | 44.7% |
| saint | 15.1 | 0.0% | 27.6% | 17.3% | 9.7% | 25.9% | 34.3 | 562 | 8.0 | 0.0% | 79.2% | 69.9% | 69.5% | 45.6% | 31.1% |
| scholar | 16.3 | 0.0% | 24.8% | 16.4% | 9.6% | 24.9% | 33.6 | 675 | 7.1 | 0.0% | 77.8% | 63.5% | 0.2% | 28.2% | 46.1% |
| shark | 17.0 | 0.4% | 23.0% | 16.0% | 9.8% | 23.8% | 33.1 | 1,570 | 7.8 | 10.2% | 91.9% | 77.8% | 0.0% | 31.9% | 35.2% |
| tycoon | 16.3 | 0.0% | 24.5% | 17.0% | 9.7% | 23.9% | 35.0 | 1,512 | 7.7 | 3.8% | 83.6% | 70.7% | 1.3% | 32.1% | 38.6% |

Walkouts by trait (all customers who had the trait, hidden or shown):

| trait | customers | walkouts | rate |
| --- | --- | --- | --- |
| nervous | 43545 | 66 | 0.2% |
| hurry | 42732 | 60 | 0.1% |
| hothead | 43970 | 47 | 0.1% |
| heir | 44907 | 45 | 0.1% |
| loudmouth | 43946 | 40 | 0.1% |
| relieved | 42005 | 34 | 0.1% |
| grudge | 42633 | 34 | 0.1% |
| litigious | 44663 | 34 | 0.1% |
| windfall | 42675 | 31 | 0.1% |
| traditionalist | 42764 | 31 | 0.1% |
| executor | 42191 | 30 | 0.1% |
| rivalry | 47162 | 33 | 0.1% |
| broke | 42884 | 30 | 0.1% |
| foodie | 44538 | 31 | 0.1% |
| estranged | 42184 | 29 | 0.1% |
| sentimental | 44781 | 30 | 0.1% |
| no-nonsense | 43691 | 29 | 0.1% |
| germophobe | 43702 | 29 | 0.1% |
| showoff | 46011 | 29 | 0.1% |
| music-lover | 44786 | 28 | 0.1% |
| green | 42028 | 26 | 0.1% |
| devout | 45321 | 28 | 0.1% |
| shutterbug | 44729 | 26 | 0.1% |
| haggler | 46718 | 26 | 0.1% |
| know-it-all | 46644 | 25 | 0.1% |
| prodigal | 40199 | 21 | 0.1% |
| conspiracy | 44701 | 23 | 0.1% |
| new-age | 43107 | 22 | 0.1% |
| minimalist | 43164 | 22 | 0.1% |
| gossip | 44756 | 22 | 0.0% |
| country-club | 43456 | 21 | 0.0% |
| superstitious | 44245 | 20 | 0.0% |
| pushover | 44408 | 20 | 0.0% |
| death-fan | 46715 | 21 | 0.0% |
| animal-lover | 44777 | 20 | 0.0% |
| skeptic | 45936 | 20 | 0.0% |
| collector | 46152 | 20 | 0.0% |
| been-here | 46680 | 20 | 0.0% |
| accountant | 45733 | 17 | 0.0% |
| tight-lipped | 44158 | 16 | 0.0% |
| pincher | 42762 | 15 | 0.0% |
| heartbroken | 40101 | 14 | 0.0% |
| chatterbox | 42569 | 9 | 0.0% |
| serene | 41926 | 6 | 0.0% |

| special customer | met | sales | walkouts |
| --- | --- | --- | --- |
| county-contract | 2542 | 0 | 0 |
| celebrity | 2543 | 2540 | 3 |
| pre-need | 5217 | 5213 | 4 |
| clown-family | 2673 | 2671 | 2 |
| jackpot | 2449 | 2437 | 12 |
| pet | 5091 | 5088 | 3 |
| teller | 2468 | 2467 | 1 |
| nurse-referral | 2398 | 0 | 0 |
| june | 2377 | 2375 | 2 |
| cousin-sal | 2411 | 0 | 0 |
| inspector-mudge | 2392 | 0 | 0 |
| zookeeper | 2234 | 2234 | 0 |
| mob-boss | 2386 | 2386 | 0 |
| coroner | 2254 | 0 | 0 |
| black-widow | 2434 | 2434 | 0 |
| lucius-vane | 2130 | 2130 | 0 |
| father-smyth | 2495 | 2495 | 0 |
| old-man-withers | 2647 | 2646 | 1 |
| fake-death | 2258 | 0 | 0 |
| the-twins | 2147 | 0 | 0 |
| the-mournes | 2158 | 2158 | 0 |
| blaine-director | 2309 | 2309 | 0 |
| the-count | 2053 | 2052 | 1 |
| ghost-crew | 2096 | 0 | 0 |
| elijah | 2257 | 2257 | 0 |
| the-mayor | 2131 | 2129 | 2 |

Packages sold (share of all sales reaching each tier or higher bought on that sale):

| package | tier 1 | tier 2 | tier 3 | tier 4 | tier 5 |
| --- | --- | --- | --- | --- | --- |
| plot | 10.2% | 3.2% | 6.0% | 0.0% | 0.0% |
| service | 1.8% | 0.3% | 0.1% | 0.1% | 0.0% |
| embalming | 3.0% | 1.9% | 0.2% | 0.2% | 0.4% |
| headstone | 2.2% | 0.2% | 0.1% | 0.0% | 0.0% |
| flowers | 1.3% | 0.2% | 0.0% | 0.0% | 0.0% |
| urn | 0.1% | 0.0% | 0.0% | 0.0% | 0.0% |

Soft-sell cards bought: 2.22 per sale.

## Expanded: money by system

Dollars earned per player-day:

| income | share | builder | gambler | mourner | necromancer | organiser | pacifist | politician | saboteur | saint | scholar | shark | tycoon |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sales | 81.5% | 13,880 | 9,785 | 8,744 | 13,556 | 12,471 | 11,123 | 7,003 | 9,520 | 8,497 | 11,015 | 26,729 | 24,648 |
| new day and mail | 5.7% | 969 | 857 | 891 | 858 | 958 | 931 | 924 | 684 | 886 | 900 | 998 | 1,009 |
| savings | 3.2% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 6,671 |
| body prep | 2.5% | 446 | 337 | 78 | 1,098 | 457 | 74 | 76 | 1,014 | 74 | 430 | 261 | 459 |
| loans | 2.3% | 2,663 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1,985 |
| special offers | 1.3% | 345 | 282 | 35 | 254 | 322 | 34 | 36 | 200 | 34 | 330 | 343 | 343 |
| pawn | 0.9% | 0 | 229 | 0 | 662 | 0 | 0 | 0 | 623 | 0 | 0 | 102 | 0 |
| police | 0.7% | 70 | 169 | 65 | 177 | 82 | 0 | 139 | 147 | 105 | 68 | 148 | 83 |
| rob graves | 0.6% | 0 | 0 | 0 | 569 | 0 | 0 | 0 | 583 | 0 | 0 | 0 | 0 |
| gambling | 0.5% | 0 | 923 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| parlor PvP | 0.4% | 0 | 202 | 0 | 81 | 0 | 0 | 0 | 27 | 0 | 0 | 390 | 0 |
| dig | 0.3% | 0 | 0 | 0 | 282 | 0 | 0 | 0 | 283 | 0 | 0 | 0 | 0 |
| crematorium | 0.1% | 0 | 0 | 0 | 40 | 0 | 0 | 0 | 8 | 0 | 0 | 205 | 0 |
| coroner | 0.1% | 0 | 0 | 0 | 35 | 0 | 0 | 0 | 15 | 0 | 0 | 88 | 0 |

Dollars spent per player-day:

| spending | share | builder | gambler | mourner | necromancer | organiser | pacifist | politician | saboteur | saint | scholar | shark | tycoon |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| stock | 39.2% | 6,639 | 5,900 | 3,955 | 5,742 | 5,765 | 6,627 | 3,411 | 5,450 | 4,727 | 5,305 | 8,980 | 10,434 |
| upgrades | 16.8% | 3,981 | 2,064 | 2,136 | 2,122 | 3,561 | 2,249 | 853 | 2,408 | 497 | 2,833 | 4,299 | 4,161 |
| monuments | 7.8% | 967 | 720 | 492 | 1,318 | 1,115 | 1,020 | 402 | 758 | 229 | 900 | 2,972 | 3,777 |
| tithe | 4.9% | 639 | 598 | 570 | 646 | 645 | 633 | 553 | 601 | 2,272 | 635 | 667 | 667 |
| pawn | 4.5% | 1,311 | 0 | 705 | 1,062 | 1,069 | 0 | 0 | 0 | 0 | 1,118 | 1,424 | 1,649 |
| savings | 3.3% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 6,632 |
| black market | 2.6% | 0 | 528 | 0 | 1,421 | 0 | 0 | 0 | 964 | 32 | 396 | 969 | 536 |
| police | 2.5% | 0 | 0 | 133 | 463 | 0 | 0 | 0 | 364 | 21 | 0 | 1,452 | 2,473 |
| loans | 2.4% | 2,743 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2,044 |
| hearse upkeep | 2.3% | 601 | 293 | 395 | 222 | 310 | 311 | 309 | 25 | 218 | 403 | 863 | 301 |
| leads | 2.2% | 0 | 0 | 0 | 1,188 | 0 | 0 | 0 | 0 | 0 | 0 | 2,890 | 0 |
| hits | 1.4% | 0 | 189 | 0 | 604 | 0 | 0 | 0 | 290 | 0 | 0 | 1,604 | 0 |
| story appeals | 1.3% | 0 | 0 | 386 | 505 | 0 | 331 | 309 | 455 | 370 | 0 | 0 | 0 |
| coroner | 1.2% | 270 | 0 | 219 | 0 | 260 | 249 | 158 | 0 | 257 | 363 | 128 | 304 |
| treatment | 1.1% | 114 | 220 | 133 | 391 | 140 | 0 | 286 | 140 | 234 | 117 | 169 | 183 |
| gazette | 0.8% | 0 | 171 | 0 | 404 | 0 | 0 | 421 | 0 | 0 | 0 | 446 | 0 |
| health dept | 0.7% | 110 | 96 | 71 | 221 | 103 | 81 | 60 | 0 | 78 | 107 | 190 | 109 |
| gambling | 0.6% | 0 | 1,139 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| permits | 0.5% | 199 | 49 | 134 | 0 | 185 | 0 | 0 | 0 | 179 | 182 | 0 | 0 |
| body prep | 0.5% | 48 | 71 | 101 | 40 | 46 | 102 | 100 | 38 | 96 | 49 | 104 | 42 |
| florist | 0.4% | 135 | 0 | 71 | 0 | 115 | 179 | 47 | 0 | 133 | 0 | 0 | 165 |
| stolen | 0.4% | 33 | 65 | 23 | 123 | 42 | 0 | 45 | 200 | 29 | 31 | 46 | 52 |
| chains | 0.4% | 109 | 0 | 117 | 0 | 333 | 0 | 114 | 0 | 0 | 0 | 0 | 0 |
| mournes | 0.3% | 0 | 160 | 0 | 26 | 0 | 0 | 0 | 11 | 0 | 59 | 287 | 86 |
| ordinances | 0.3% | 0 | 0 | 0 | 0 | 0 | 0 | 574 | 0 | 0 | 0 | 0 | 0 |
| rob graves | 0.3% | 0 | 0 | 0 | 244 | 0 | 0 | 0 | 229 | 0 | 0 | 0 | 0 |
| special offers | 0.2% | 39 | 34 | 38 | 40 | 35 | 41 | 35 | 39 | 37 | 38 | 40 | 38 |
| inspection | 0.2% | 140 | 0 | 0 | 0 | 0 | 0 | 102 | 72 | 130 | 0 | 0 | 0 |
| midnight (fines, collection) | 0.2% | 3 | 30 | 8 | 83 | 22 | 9 | 1 | 35 | 3 | 27 | 122 | 35 |
| crematorium | 0.2% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 112 | 220 |
| chain dues | 0.1% | 56 | 0 | 60 | 0 | 96 | 0 | 57 | 0 | 0 | 0 | 0 | 0 |
| election | 0.1% | 0 | 0 | 0 | 0 | 0 | 0 | 200 | 0 | 0 | 0 | 0 | 0 |
| holy water | 0.1% | 0 | 0 | 6 | 0 | 0 | 4 | 53 | 0 | 46 | 0 | 0 | 0 |
| bodyguard | 0.1% | 9 | 0 | 0 | 0 | 9 | 0 | 52 | 0 | 0 | 7 | 0 | 17 |
| confession | 0.0% | 0 | 0 | 2 | 0 | 0 | 2 | 0 | 0 | 2 | 0 | 0 | 0 |

## Expanded: BP by system (per player-day)

| source | share | builder | gambler | mourner | necromancer | organiser | pacifist | politician | saboteur | saint | scholar | shark | tycoon |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sales | 80.6% | 571 | 521 | 536 | 507 | 569 | 537 | 558 | 369 | 530 | 561 | 579 | 584 |
| risks | 8.4% | 66 | 43 | 58 | 37 | 65 | 58 | 63 | 37 | 61 | 66 | 48 | 67 |
| parlor PvP | 2.3% | 0 | 22 | 0 | 31 | 0 | 0 | 0 | 127 | 0 | 0 | 0 | 0 |
| monuments | 2.0% | 14 | 11 | 8 | 15 | 15 | 15 | 7 | 11 | 4 | 13 | 21 | 23 |
| service | 1.5% | 0 | 1 | 30 | 0 | 0 | 30 | 29 | 0 | 28 | 0 | 0 | 1 |
| midnight | 1.4% | 8 | 6 | 8 | 10 | 8 | 12 | 17 | 7 | 12 | 7 | 7 | 11 |
| duels | 1.1% | 0 | 23 | 0 | 26 | 0 | 0 | 0 | 36 | 0 | 0 | 0 | 0 |
| tithe | 1.0% | 5 | 5 | 7 | 3 | 5 | 8 | 7 | 2 | 27 | 5 | 3 | 6 |
| wait (events, scripts) | 0.7% | 5 | 4 | 4 | 4 | 5 | 5 | 5 | 4 | 4 | 5 | 4 | 5 |
| yangs | 0.6% | -0 | -1 | -5 | -1 | -0 | -0 | -0 | -21 | -0 | -0 | -20 | -0 |
| special offers | 0.2% | 2 | 2 | 1 | 1 | 2 | 1 | 1 | 1 | 1 | 2 | 2 | 2 |
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
| neg | 76.2% | 280 | 271 | 274 | 270 | 278 | 292 | 294 | 201 | 270 | 275 | 319 | 292 |
| desk | 7.8% | 29 | 29 | 27 | 29 | 29 | 26 | 28 | 28 | 27 | 28 | 30 | 29 |
| map | 3.9% | 11 | 14 | 14 | 19 | 11 | 12 | 13 | 16 | 16 | 11 | 19 | 14 |
| store | 2.6% | 9 | 10 | 8 | 10 | 9 | 10 | 8 | 10 | 9 | 10 | 11 | 11 |
| competitors | 0.9% | 0 | 8 | 0 | 8 | 0 | 0 | 0 | 13 | 0 | 0 | 9 | 0 |
| church | 0.9% | 1 | 6 | 5 | 1 | 1 | 6 | 6 | 1 | 8 | 1 | 1 | 1 |
| risk | 0.8% | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| reaper-club | 0.7% | 0 | 7 | 0 | 6 | 0 | 0 | 0 | 5 | 3 | 3 | 5 | 4 |
| graveyard | 0.7% | 1 | 6 | 1 | 6 | 1 | 1 | 1 | 7 | 4 | 1 | 1 | 1 |
| city-hall | 0.6% | 5 | 1 | 3 | 1 | 4 | 1 | 6 | 2 | 2 | 1 | 1 | 1 |
| parlor | 0.4% | 1 | 1 | 1 | 4 | 1 | 1 | 1 | 4 | 0 | 1 | 1 | 1 |
| police | 0.4% | 1 | 2 | 1 | 2 | 2 | 0 | 2 | 2 | 2 | 1 | 2 | 2 |
| mournes | 0.4% | 1 | 2 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 2 | 3 | 2 |
| bank | 0.4% | 3 | 1 | 2 | 1 | 1 | 1 | 1 | 1 | 2 | 1 | 1 | 6 |
| yangs | 0.4% | 0 | 0 | 2 | 1 | 0 | 1 | 0 | 5 | 1 | 0 | 5 | 0 |
| pawn-shop | 0.4% | 2 | 2 | 1 | 3 | 1 | 0 | 0 | 2 | 0 | 1 | 3 | 2 |
| coroner | 0.3% | 1 | 0 | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 | 3 | 1 |
| hospital | 0.3% | 1 | 1 | 1 | 3 | 1 | 0 | 1 | 1 | 1 | 1 | 3 | 1 |
| news | 0.3% | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| stats | 0.3% | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| battle | 0.2% | 0 | 1 | 0 | 2 | 0 | 0 | 0 | 6 | 0 | 0 | 0 | 0 |
| spirit-university | 0.2% | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| florist | 0.2% | 1 | 0 | 1 | 0 | 1 | 2 | 1 | 0 | 2 | 0 | 0 | 2 |
| cafe | 0.2% | 0 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0 | 0 |
| health-department | 0.1% | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 |
| crematorium | 0.1% | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 1 | 1 | 0 | 1 | 1 |
| gazette | 0.1% | 0 | 1 | 0 | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 1 | 0 |
| tutorial | 0.1% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Expanded: what each choice returns

| choice | measure | return | volume (turns, $ or uses) |
| --- | --- | --- | --- |
| a customer (Wait for Customer) | BP per turn | 33.122 | 774718 |
| leading the service | BP per turn | 32.821 | 14532 |
| a graveyard duel (challenger) | BP per turn | 39.116 | 8701 |
| robbing a grave | $ per try | 387.650 | 7130 |
| digging at the office | $ per try | 322.110 | 7130 |
| tending the graves | uses | - | 6800 |
| the seance | turns used | - | 8369 |
| monuments | BP per $ | 0.011 | 57866000 |
| tithes | BP per $ | 0.009 | 35930000 |
| hits (BP the victim lost per $) | BP per $ | 0.004 | 10630650 |
| special offers | BP per offer | 3.619 | 12794 |
| body prep choices | BP per choice | 0.000 | 319676 |
| risks taken | BP per risk | 43.020 | 62235 |

A lead from the nurse ($1,500) brings a sure, richer customer: 25,794 lead customers were met. Sale BP per customer over all customers: 33.12.

Parlor upgrades (share of seats that bought each, and the mean day bought):

| upgrade | bought | share of seats | mean day |
| --- | --- | --- | --- |
| paint | 1600 | 100.0% | 2.5 |
| coffee-machine | 1600 | 100.0% | 3.9 |
| storeroom | 1578 | 98.6% | 11.4 |
| florist-cooler | 1444 | 90.3% | 14.1 |
| viewing-room | 1307 | 81.7% | 15.9 |
| embalming-lab | 1050 | 65.6% | 18.9 |
| incinerator | 581 | 36.3% | 22.4 |
| memorial-garden | 401 | 25.1% | 21.5 |
| chapel | 373 | 23.3% | 22.1 |
| billboard | 285 | 17.8% | 25.6 |
| guard-dog | 265 | 16.6% | 6.6 |
| alarm | 230 | 14.4% | 18.6 |
| night-watchman | 140 | 8.8% | 25.1 |
| mausoleum | 17 | 1.1% | 27.0 |

The three late upgrades the engine pass made cheaper and better, and what they return:

| upgrade | bought | share of seats | mean day | cost with permit ($) | BP / day vs peers (after - before) | days owned | BP over the season | BP per $ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| night-watchman | 140 | 8.8% | 25.1 | 12,000 | +1.3 (se 8.1) | 4.9 | 7 | 0.001 |
| billboard | 285 | 17.8% | 25.6 | 21,500 | +48.9 (se 5.7) | 4.4 | 217 | 0.010 |
| memorial-garden | 401 | 25.1% | 21.5 | 24,000 | +55.5 (se 3.4) | 8.5 | 470 | 0.020 |

BP per day is measured against the same personality's seats on the same day that did not yet own the upgrade, so the season's rise in income cancels; the standard error is across buyers. The monuments return about 0.010 BP a dollar, so an upgrade that returns less is not worth buying for points alone.

Monument tiers built: tier 1: 1600, tier 2: 1532, tier 3: 1046, tier 4: 302, tier 5: 70 (of 1600 seats).

Permits bought: signage 805, zoning 792, crematory 129. Black-market buys: morty-rib 874, rabbit-foot 331, coroner-list 1815, clover 349, testimonials 618, monster-scale 301, tap-water 289, hot-casket 1885, sal-pad 504, riot-shield 334, haunted-casket 369, real-water 474, cop-day-off 259, filed-tag 583, bruno 402, forged-permit 224, used-wreaths 513, mayor-key 167, vest 321.

## Expanded: the eight newer places (sections 30 and 31)

| place | visited by (share of seats) | used (share of seats) | presses per user-day | $ out per user | $ back per user (incl. sale extras) | net $ per user | karma per user | luck per user | word of mouth per user |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| police | 91.1% | 87.8% | 0.40 | 13,334 | 3,553 | -9,780 | -1 | 0.0 | 0.0 |
| crematorium | 49.3% | 26.8% | 0.21 | 2,916 | 5,860 | 2,944 | -4 | 0.8 | 0.0 |
| florist | 57.6% | 57.5% | 0.48 | 3,612 | 3,726 | 115 | 0 | 0.0 | 0.7 |
| gazette | 33.4% | 33.4% | 0.22 | 10,845 | 0 | -10,845 | -2 | 0.0 | -0.5 |
| coroner | 91.7% | 84.4% | 0.32 | 6,537 | 403 | -6,134 | -0 | 0.4 | 5.9 |
| health dept | 91.4% | 91.3% | 0.14 | 3,345 | 0 | -3,345 | -0 | 0.0 | 3.7 |
| pawn | 74.9% | 74.9% | 0.75 | 27,548 | 5,449 | -22,098 | 0 | 0.0 | 0.0 |
| mournes | 100.0% | 92.1% | 0.43 | 1,682 | 0 | -1,682 | 5 | 0.6 | -0.1 |

Sale extras: oven slots used 1,317 (saved $1,514,550); bouquets used 21,647 (earned $3,428,340); attacks recorded on the police blotter 16,350.

| action | presses | seats that used it |
| --- | --- | --- |
| mournes:hold | 12522 | 1329 |
| pawn-shop:loot | 10948 | 534 |
| pawn-shop:lot:wood | 8876 | 928 |
| police:report | 8089 | 888 |
| pawn-shop:lot:silver | 7126 | 916 |
| florist:buy | 7103 | 653 |
| police:settle | 6421 | 517 |
| coroner:certificate | 4802 | 1066 |
| florist:bundle | 4300 | 653 |
| health-department:inspect | 3691 | 1199 |
| mournes:spy | 3368 | 543 |
| coroner:tip | 3282 | 275 |
| mournes:undercut | 2937 | 263 |
| coroner:favour | 2358 | 719 |
| police:backdoor | 2038 | 363 |
| florist:church | 1820 | 529 |
| coroner:quiet | 1814 | 285 |
| gazette:classified | 1756 | 267 |
| crematorium:diamonds | 1361 | 226 |
| health-department:fine | 1351 | 819 |
| health-department:complaint | 1043 | 262 |
| gazette:smear | 864 | 256 |
| crematorium:scatter | 796 | 202 |
| gazette:puff | 698 | 137 |
| coroner:burial | 544 | 434 |
| crematorium:bulk | 520 | 227 |
| police:patrol | 490 | 185 |
| gazette:display | 159 | 102 |

Net dollars are what a user took in at the counter, plus the oven's saved wholesale and the bouquets' payouts, minus what it paid there (the second-hand caskets' value is not counted: they replace Di-Mart stock). A dollar buys about 0.010 BP at the monuments, so a place that nets money is a source of points, and a place that costs money has to give back karma, luck, word of mouth or a rival's loss. Karma, luck and word of mouth are totals per user over the season. The BP return of a place cannot be read as it is for an upgrade (most users start on day 2 to 3, so there is no control), so a place's effect on its users is measured by leaving it out (`--places-off`), see `docs/balance/expanded-tuning-log.md` round 19.

## Expanded: PvP, duels and hits

| measure | value |
| --- | --- |
| duels started | 8701 |
| challenger won / lost / yielded | 7286 / 928 / 487 |
| BP won by duel winners / lost by losers | 417,812 / 206,468 |
| duels with a Shove: share of duels / challenger won, lost, yielded / mean BP | 5.2% / 123, 295, 33 / -3.8 |
| duels without a Shove: challenger won, lost, yielded / mean BP | 7163, 633, 454 / 41.5 |
| Shove pressed (times) | 458 |
| hits resolved / landed | 761 / 566 |
| BP taken from hit victims | 38,255 |
| cash stolen in burglaries | 2,768,620 |

Hits by the parlor that hired them:

| personality | hired | landed | hirer behind the target | $ spent | BP taken from targets | BP per $ |
| --- | --- | --- | --- | --- | --- | --- |
| gambler | 54 | 38 | 96.3% | 754,250 | 2,630 | 0.003 |
| necromancer | 183 | 134 | 94.5% | 2,427,300 | 8,955 | 0.004 |
| saboteur | 105 | 81 | 100.0% | 1,193,950 | 5,201 | 0.004 |
| shark | 419 | 313 | 99.3% | 6,255,150 | 21,469 | 0.003 |

BP lost to other parlors per player-day, by victim and venue:

| personality | parlor fights | duels | hits | total | share of final BP |
| --- | --- | --- | --- | --- | --- |
| builder | 8.4 | 4.9 | 0.6 | 13.9 | 2.1% |
| gambler | 15.9 | 4.6 | 0.4 | 21.0 | 3.3% |
| mourner | 3.4 | 3.2 | 0.9 | 7.5 | 1.2% |
| necromancer | 18.1 | 3.2 | 1.0 | 22.3 | 3.6% |
| organiser | 9.4 | 5.8 | 0.8 | 15.9 | 2.4% |
| pacifist | 0.0 | 0.0 | 0.0 | 0.0 | 0.0% |
| politician | 9.0 | 7.5 | 2.0 | 18.6 | 2.7% |
| saboteur | 2.6 | 0.6 | 0.2 | 3.4 | 0.6% |
| saint | 7.0 | 5.6 | 1.5 | 14.1 | 2.1% |
| scholar | 7.8 | 4.4 | 0.6 | 12.8 | 2.0% |
| shark | 15.9 | 3.3 | 0.1 | 19.2 | 3.1% |
| tycoon | 10.0 | 9.0 | 1.6 | 20.6 | 3.0% |

The most-targeted peaceful parlor in each town (never fights) lost on average 850 BP over the season, 4.0% of what it would otherwise have had (worst town: 9.1%); it finished at mean place 2.63.

## Expanded: the house

| game and stake | plays | staked | returned | return per $ |
| --- | --- | --- | --- | --- |
| slots.100 | 8588 | 858,800 | 882,700 | 1.028 |
| slots.1000 | 2520 | 2,520,000 | 1,745,000 | 0.692 |
| slots.500 | 3738 | 1,869,000 | 1,758,000 | 0.941 |

Gamblers' net: gambler -216 $/day on 1,315 $/day staked.

## Expanded: the bank

| personality | loans taken | borrowed $ | repaid $ | collected | defaulted | written off $ | default BP | savings interest $ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| builder | 1443 | 10,531,544 | 10,531,544 | 0 | 0 | 0 | 0 | 0 |
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
| tycoon | 1372 | 7,543,823 | 7,543,823 | 0 | 0 | 0 | 0 | 144,506 |

## Expanded: City Hall and chains

| measure | value |
| --- | --- |
| ordinance ballots counted | 800 |
| votes per ballot / players | 8.00 / 8.00 |
| lobbying votes bought | 951 |
| elections held (of towns) | 200 of 200 |
| candidates per election | 0.64 |
| votes per election / players | 5.08 / 8.00 |
| campaign ads bought | 13 |
| mayors by personality | politician 127 |
| chains founded / joined | 140 / 268 |
| chains alive at the end, mean members | 140, 2.91 |

| chain | seats | wins | win rate | fair share | win / fair | mean final BP | mean place | BP vs town mean | sd of that |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| no chain | 1192 | 154 | 12.9% | 12.5% | 1.03 | 19,233 | 4.61 | -0.5% | 8.1% |
| in a chain | 408 | 46 | 11.3% | 12.5% | 0.90 | 19,823 | 4.17 | +1.4% | 4.5% |

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
| reaper-club:buy:tiny | 896 | 0 | 0.0% | 0 |
| crematorium:rent | 788 | 0 | 0.0% | 0 |
| reaper-club:draw | 133 | 0 | 0.0% | 0 |
| reaper-club:shots | 133 | 0 | 0.0% | 0 |
| parlor:markup:-10 | 253 | 0 | 0.0% | 0 |
| parlor:markup:30 | 253 | 0 | 0.0% | 0 |
| parlor:markup:0 | 253 | 0 | 0.0% | 0 |
| bank:depositall | 123 | 0 | 0.0% | 0 |
| bank:withdraw | 123 | 0 | 0.0% | 0 |
| city-hall:permit:crematory | 796 | 8 | 1.0% | 8 |

Usage of every choice (seats that used it at least once among seats that were offered it):

| choice | uses | per seat | seats offered | share of them that used it |
| --- | --- | --- | --- | --- |
| neg:soft | 3179647 | 1987.3 | 1600 | 100.0% |
| neg:card | 2554809 | 1596.8 | 1600 | 100.0% |
| neg:packages | 1074885 | 671.8 | 1600 | 100.0% |
| neg:listen | 1035710 | 647.3 | 1600 | 100.0% |
| desk:wait | 962254 | 601.4 | 1600 | 100.0% |
| neg:done | 757352 | 473.3 | 1600 | 100.0% |
| neg:hard | 549874 | 343.7 | 1600 | 100.0% |
| neg:coffee | 525957 | 328.7 | 1600 | 100.0% |
| neg:pkg:plot | 368018 | 230.0 | 1600 | 100.0% |
| prep:start | 319676 | 199.8 | 1600 | 100.0% |
| prep:choice | 319676 | 199.8 | 1600 | 100.0% |
| neg:bless | 178097 | 111.3 | 707 | 100.0% |
| store:casket:0 | 157690 | 98.6 | 1600 | 100.0% |
| neg:discount | 150098 | 93.8 | 1600 | 100.0% |
| place:funeral-home | 103285 | 64.6 | 1600 | 100.0% |
| neg:pkg:embalming | 100998 | 63.1 | 1600 | 100.0% |
| place:store | 90614 | 56.6 | 1600 | 100.0% |
| store:casket:1 | 81070 | 50.7 | 1600 | 100.0% |
| neg:guilt | 76318 | 47.7 | 1600 | 100.0% |
| risk:take | 62235 | 38.9 | 1600 | 98.9% |
| place:mournes | 53327 | 33.3 | 1600 | 100.0% |
| desk:quit | 48000 | 30.0 | 1600 | 100.0% |
| store:caskets | 47963 | 30.0 | 1600 | 100.0% |
| place:coroner | 42405 | 26.5 | 1600 | 91.7% |
| place:police-station | 41958 | 26.2 | 1600 | 91.1% |
| neg:pkg:headstone | 38974 | 24.4 | 1600 | 100.0% |
| place:church | 38146 | 23.8 | 1600 | 100.0% |
| place:pawn-shop | 37700 | 23.6 | 1600 | 74.9% |
| neg:pkg:service | 37536 | 23.5 | 1600 | 100.0% |
| neg:pkg:flowers | 36576 | 22.9 | 1600 | 100.0% |
| church:tithe | 35930 | 22.5 | 1600 | 100.0% |
| place:reaper-club | 32516 | 20.3 | 1600 | 61.6% |
| place:hospital | 30413 | 19.0 | 1600 | 86.1% |
| place:graveyard | 29913 | 18.7 | 1600 | 100.0% |
| place:yangs | 24456 | 15.3 | 1600 | 54.8% |
| place:florist | 23322 | 14.6 | 1600 | 57.6% |
| place:bank | 23315 | 14.6 | 1600 | 100.0% |
| church:bingo-card | 21695 | 13.6 | 671 | 100.0% |
| reaper-club:market | 20559 | 12.8 | 985 | 94.0% |
| competitors:visit | 20129 | 12.6 | 534 | 100.0% |
| place:city-hall | 19807 | 12.4 | 1600 | 100.0% |
| neg:sympathy | 19755 | 12.3 | 1600 | 99.9% |
| battle:attack | 19397 | 12.1 | 404 | 100.0% |
| competitors:trydoor | 18731 | 11.7 | 534 | 100.0% |
| parlor:upgrades | 18394 | 11.5 | 1600 | 100.0% |
| place:competitors | 17089 | 10.7 | 1600 | 33.4% |
| place:crematorium | 17017 | 10.6 | 1600 | 49.3% |
| competitors:look | 16020 | 10.0 | 534 | 100.0% |
| bank:all-gold | 15826 | 9.9 | 1600 | 100.0% |
| church:bingo | 15812 | 9.9 | 1600 | 41.9% |
| neg:cremation | 15719 | 9.8 | 575 | 99.5% |
| place:cafe | 15568 | 9.7 | 1600 | 100.0% |
| graveyard:swing | 15415 | 9.6 | 404 | 100.0% |
| reaper-club:slots | 14846 | 9.3 | 133 | 100.0% |
| place:health-department | 14788 | 9.2 | 1600 | 91.4% |
| church:serve | 14532 | 9.1 | 571 | 100.0% |
| graveyard:monuments | 14133 | 8.8 | 1600 | 100.0% |
| store:casket:2 | 13486 | 8.4 | 1600 | 90.0% |
| neg:offer:accept | 12794 | 8.0 | 1600 | 99.5% |
| place:spirit-university | 12670 | 7.9 | 1600 | 100.0% |
| reaper-club:pay | 12648 | 7.9 | 961 | 100.0% |
| mournes:hold | 12522 | 7.8 | 1600 | 83.1% |
| city-hall:chains | 12310 | 7.7 | 1600 | 33.4% |
| place:gazette | 12309 | 7.7 | 1600 | 33.4% |
| yangs:menu | 11435 | 7.1 | 542 | 100.0% |
| tutorial:next | 11200 | 7.0 | 1600 | 100.0% |
| competitors:attack | 11061 | 6.9 | 534 | 75.7% |
| pawn-shop:loot | 10948 | 6.8 | 1182 | 45.2% |
| hospital:lead | 10697 | 6.7 | 1378 | 19.2% |
| graveyard:duel | 10579 | 6.6 | 526 | 76.8% |
| risk:decline | 10521 | 6.6 | 1600 | 82.6% |
| spirit-university:psych | 10499 | 6.6 | 1600 | 99.9% |
| battle:yellwin | 9687 | 6.1 | 401 | 100.0% |
| city-hall:ordinance | 8925 | 5.6 | 1600 | 100.0% |
| pawn-shop:lot:wood | 8876 | 5.5 | 1198 | 77.5% |
| hospital:treat | 8567 | 5.4 | 1372 | 95.0% |
| reaper-club:seance | 8369 | 5.2 | 399 | 100.0% |
| city-hall:inspection | 8268 | 5.2 | 1600 | 32.8% |
| police:report | 8089 | 5.1 | 1405 | 63.2% |
| yangs:tiger | 8010 | 5.0 | 877 | 30.4% |
| store:hearse | 7878 | 4.9 | 1600 | 99.6% |
| graveyard:rob | 7130 | 4.5 | 400 | 67.8% |
| parlor:dig | 7130 | 4.5 | 394 | 68.8% |
| pawn-shop:lot:silver | 7126 | 4.5 | 1198 | 76.5% |
| florist:buy | 7103 | 4.4 | 921 | 70.9% |
| graveyard:tend | 6800 | 4.3 | 641 | 19.0% |
| competitors:steal | 6663 | 4.2 | 534 | 100.0% |
| police:settle | 6421 | 4.0 | 1405 | 36.8% |
| city-hall:vote | 6400 | 4.0 | 1600 | 100.0% |
| neg:offer:decline | 5704 | 3.6 | 1600 | 87.9% |
| arc:give:church | 5249 | 3.3 | 829 | 55.1% |
| coroner:certificate | 4802 | 3.0 | 1467 | 72.7% |
| graveyard:monument | 4550 | 2.8 | 1600 | 100.0% |
| florist:bundle | 4300 | 2.7 | 921 | 70.9% |
| arc:give:reaper-club | 4138 | 2.6 | 969 | 28.0% |
| store:hearse-look | 3939 | 2.5 | 1593 | 100.0% |
| store:buy | 3939 | 2.5 | 1593 | 100.0% |
| health-department:inspect | 3691 | 2.3 | 1463 | 82.0% |
| neg:raise | 3489 | 2.2 | 399 | 100.0% |
| mournes:spy | 3368 | 2.1 | 1600 | 33.9% |
| coroner:tip | 3282 | 2.1 | 1467 | 18.7% |
| mournes:undercut | 2937 | 1.8 | 1600 | 16.4% |
| bank:loan | 2815 | 1.8 | 1600 | 15.7% |
| bank:borrow | 2815 | 1.8 | 251 | 100.0% |
| bank:repay | 2815 | 1.8 | 251 | 100.0% |
| bank:savings | 2709 | 1.7 | 1600 | 7.7% |
| yangs:dragon | 2529 | 1.6 | 877 | 26.9% |
| coroner:favour | 2358 | 1.5 | 1467 | 49.0% |
| neg:pkg:urn | 2098 | 1.3 | 562 | 66.7% |
| bank:deposit | 2069 | 1.3 | 123 | 100.0% |
| police:backdoor | 2038 | 1.3 | 1323 | 27.4% |
| reaper-club:games | 1983 | 1.2 | 985 | 13.5% |
| reaper-club:buy:hot-casket | 1885 | 1.2 | 916 | 42.1% |
| florist:church | 1820 | 1.1 | 921 | 57.4% |
| reaper-club:buy:coroner-list | 1815 | 1.1 | 911 | 44.0% |
| coroner:quiet | 1814 | 1.1 | 719 | 39.6% |
| arc:give:city-hall | 1806 | 1.1 | 993 | 33.4% |
| gazette:classified | 1756 | 1.1 | 535 | 49.9% |
| city-hall:election | 1716 | 1.1 | 1600 | 64.2% |
| spirit-university:strength | 1667 | 1.0 | 1600 | 25.3% |
| tutorial:start | 1600 | 1.0 | 1600 | 100.0% |
| parlor:buy:paint | 1600 | 1.0 | 1600 | 100.0% |
| parlor:buy:coffee-machine | 1600 | 1.0 | 1600 | 100.0% |
| parlor:buy:storeroom | 1578 | 1.0 | 1585 | 99.6% |
| city-hall:certify | 1491 | 0.9 | 525 | 84.0% |
| parlor:buy:florist-cooler | 1444 | 0.9 | 1585 | 91.1% |
| crematorium:diamonds | 1361 | 0.9 | 428 | 52.8% |
| health-department:fine | 1351 | 0.8 | 819 | 100.0% |
| bank:transferhome | 1342 | 0.8 | 1600 | 15.6% |
| bank:transfer | 1342 | 0.8 | 250 | 100.0% |
| bank:transfer-tier | 1342 | 0.8 | 250 | 100.0% |
| city-hall:permits | 1335 | 0.8 | 1600 | 49.8% |
| parlor:buy:viewing-room | 1307 | 0.8 | 1340 | 97.5% |
| battle:yelllost | 1069 | 0.7 | 307 | 100.0% |
| hospital:leave-room | 1069 | 0.7 | 307 | 100.0% |
| parlor:buy:embalming-lab | 1050 | 0.7 | 1528 | 68.7% |
| health-department:complaint | 1043 | 0.7 | 264 | 99.2% |
| city-hall:elect | 1016 | 0.6 | 1016 | 100.0% |
| city-hall:invite | 969 | 0.6 | 327 | 42.8% |
| reaper-club:hit | 953 | 0.6 | 985 | 34.3% |
| city-hall:lobby | 951 | 0.6 | 1600 | 8.6% |
| yangs:sparrow | 896 | 0.6 | 877 | 14.6% |
| reaper-club:buy:morty-rib | 874 | 0.5 | 898 | 29.4% |
| gazette:smear | 864 | 0.5 | 535 | 47.9% |
| crematorium:scatter | 796 | 0.5 | 428 | 47.2% |
| church:water | 721 | 0.5 | 1038 | 31.0% |
| gazette:puff | 698 | 0.4 | 535 | 25.6% |
| spirit-university:hp | 687 | 0.4 | 1600 | 8.6% |
| city-hall:permit:signage | 668 | 0.4 | 796 | 83.9% |
| city-hall:permit:zoning | 659 | 0.4 | 796 | 82.8% |
| bank:withdrawall | 640 | 0.4 | 123 | 100.0% |
| reaper-club:buy:testimonials | 618 | 0.4 | 909 | 14.3% |
| reaper-club:buy:filed-tag | 583 | 0.4 | 849 | 28.3% |
| parlor:buy:incinerator | 581 | 0.4 | 943 | 61.6% |
| coroner:burial | 544 | 0.3 | 719 | 60.4% |
| crematorium:bulk | 520 | 0.3 | 788 | 28.8% |
| reaper-club:buy:used-wreaths | 513 | 0.3 | 900 | 15.2% |
| reaper-club:buy:sal-pad | 504 | 0.3 | 874 | 14.5% |
| police:patrol | 490 | 0.3 | 1282 | 14.4% |
| graveyard:yield | 487 | 0.3 | 404 | 59.9% |
| city-hall:bribe | 487 | 0.3 | 137 | 100.0% |
| reaper-club:buy:real-water | 474 | 0.3 | 876 | 15.0% |
| graveyard:shove | 458 | 0.3 | 404 | 62.1% |
| parlor:rivalry | 409 | 0.3 | 1600 | 25.6% |
| reaper-club:buy:bruno | 402 | 0.3 | 867 | 14.9% |
| parlor:buy:memorial-garden | 401 | 0.3 | 623 | 64.4% |
| parlor:buy:chapel | 373 | 0.2 | 381 | 97.9% |
| reaper-club:buy:haunted-casket | 369 | 0.2 | 847 | 14.6% |
| reaper-club:buy:clover | 349 | 0.2 | 910 | 13.7% |
| reaper-club:buy:riot-shield | 334 | 0.2 | 855 | 24.9% |
| reaper-club:buy:rabbit-foot | 331 | 0.2 | 905 | 14.3% |
| reaper-club:buy:vest | 321 | 0.2 | 900 | 14.6% |
| battle:run | 305 | 0.2 | 404 | 46.0% |
| reaper-club:buy:monster-scale | 301 | 0.2 | 889 | 13.3% |
| reaper-club:buy:tap-water | 289 | 0.2 | 910 | 13.0% |
| parlor:buy:billboard | 285 | 0.2 | 619 | 46.0% |
| city-hall:join | 268 | 0.2 | 268 | 100.0% |
| parlor:rivalry:cutthroat | 267 | 0.2 | 409 | 65.3% |
| parlor:buy:guard-dog | 265 | 0.2 | 1585 | 16.7% |
| reaper-club:buy:cop-day-off | 259 | 0.2 | 791 | 13.3% |
| parlor:markup | 253 | 0.2 | 1600 | 15.8% |
| parlor:buy:alarm | 230 | 0.1 | 264 | 87.1% |
| reaper-club:buy:forged-permit | 224 | 0.1 | 856 | 14.3% |
| reaper-club:buy:mayor-key | 167 | 0.1 | 816 | 13.1% |
| gazette:display | 159 | 0.1 | 535 | 19.1% |
| parlor:rivalry:peaceful | 142 | 0.1 | 409 | 34.7% |
| parlor:buy:night-watchman | 140 | 0.1 | 183 | 76.5% |
| city-hall:found | 140 | 0.1 | 469 | 29.9% |
| parlor:markup:20 | 130 | 0.1 | 253 | 51.4% |
| city-hall:file | 127 | 0.1 | 127 | 100.0% |
| reaper-club:bodyguard | 126 | 0.1 | 985 | 8.7% |
| parlor:markup:10 | 123 | 0.1 | 253 | 48.6% |
| church:confess | 61 | 0.0 | 1142 | 4.7% |
| parlor:buy:mausoleum | 17 | 0.0 | 30 | 56.7% |
| city-hall:ads | 13 | 0.0 | 93 | 14.0% |
| city-hall:permit:crematory | 8 | 0.0 | 796 | 1.0% |
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
| reaper-club:buy:tiny | 0 | 0.0 | 896 | 0.0% |
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

- **Is a day too long?** A bot answers 362 screens a day, 192 of them choices, for 16.1 customers. A person reads faster than a bot looks but also hesitates; only a playtest says whether 192 choices a day is fun or a chore, and whether the hand and package panes should be on the main screen.
- **Walkout pacing.** 0.1% of 774,718 customers walked out. Bots stop pushing before the mood does, so this is the floor; a person who misreads a customer, or is greedy for the exact match (24.6% of the bots' sales), will see far more. Whether a walkout feels like a fair lesson or a punishment is not measurable here.
- **How often the town speaks.** News changed the rules on 57.3% of days, a weather set on 100.0%, and a story arc was running on 62.9% of days (3.0 arcs and 6.2 story beats a town a season). Bots read none of it as a story; whether that is too much, too little, or repeats itself by day 20 needs readers.
- **Is the election a contest?** 0.64 candidates stood in each of 200 elections and 8.0 parlors voted: the bots vote by a preference list. Whether people campaign, lobby or bluff is a social question.
- **Ordinances and arcs by effect, not by rote.** The bots rank ordinances from a fixed list (800 ballots, 8.00 votes each, 951 lobbying votes bought). Do players read the effects and choose, or click the first?
- **Grudges and bluffing.** 8,701 duels and 761 hits happened with no memory of who did what to whom. Retaliation, alliances and the Peace Pledge as a social contract are for people.
- **Wording.** The bots read panels and button ids, and `packages/bots/test/scrambled.test.ts` plays a season with every pack string reworded and sees no stuck day; that proves the text does not carry rules, not that it is funny, clear or tonally right.

