# Balance report: expanded rules

## What it says about the Expanded design

*Hand-written reading of the generated tables below (regenerating with `pnpm --filter @fq/sim run sim -- --days 30 --towns 200 --players 8 --rules expanded --seed 1 --challenges 6 --out docs/balance/expanded-baseline` overwrites this file; keep this section, or rebuild the tables alone with `pnpm --filter @fq/sim exec tsx src/remark.ts ../../docs/balance/expanded-baseline`, which keeps it). 200 towns of 8 hard bots drawn from the twelve `@fq/bots` personalities, a 30-day season with the built-in `expandedPack`. This is the run after balance round 17 of `expanded-tuning-log.md`, and it is also the first run with the content pack's new material (five special customers, 15 events, 9 news blurbs, 3 risks, more arrival, tell and walkout lines), which changes every town's random draws: "before" is the round-16 baseline this file replaced, so a difference smaller than the noise of the previous rounds (a personality's win share moves by 0.1 to 0.2 for one win) is not a result. The late-joiner, mixed-difficulty, oracle and no-fighter comparisons were not re-run (readings 5 and 9 keep the older figures and say so).*

**Checks: all passed**: no invariant breaks, no offered button rejected, no stuck bot-day, no error, none of the conservation signatures. Classic's simulator report for a fixed seed (60 towns, seed 7) is byte-identical before and after this round except its run time.

### The targets

| target | before (round 16) | after (round 17) | met? |
| --- | --- | --- | --- |
| no personality above about 2x its fair share of wins, none below a third | politician 2.67, necromancer 2.45, pacifist 1.35, tycoon 1.24, shark 0.92, gambler 0.84, saint 0.72, builder 0.62, Soft Touch 0.44, saboteur 0.29, scholar 0.28, organiser 0.17 | politician 2.38, necromancer 2.33, tycoon 1.56, pacifist 1.18, shark 0.86, scholar 0.72, gambler 0.60, builder 0.56, saint 0.52, organiser 0.46, Soft Touch 0.44, saboteur 0.35 | **no, half of it**: still two above 2 (both a little lower); **none below a third** for the first time (was three); see 1 |
| the same field read by mean place and mean BP (reported alongside, not a new target) | mean place 2.75 to 6.26; means 17,897 to 20,486 (2,589 BP, sd 678), -7.0% to +4.3% of the town mean; nine of twelve within 3%, eleven within 4.3% | mean place 2.92 to 6.38; means 17,727 to 20,483 (2,757 BP, sd 712), -7.8% to +4.0%; eight of twelve within 3%, eleven within 4.0% (the saboteur outside) | the sellers closer together (organiser -0.8% -> +0.7%, scholar -0.1% -> +0.8%), the necromancer and the saboteur a little lower |
| good and evil within a few percent | BP against the town mean: good +1.0%, neutral +0.8%, evil -3.8%; wins: evil 1.29, good 1.23, neutral 0.70 | good +1.0%, neutral +1.2%, evil -4.7%; wins: evil 1.29, good 1.08, neutral 0.82 | on wins closer (neutral 0.70 -> 0.82, good 1.23 -> 1.08); on BP evil is the two fighters (see 4) |
| no single purchase dominant, no system dead | Billboard 0.009 BP a dollar, Night Watchman 0.010, Memorial Garden 0.007, monuments 0.009, tithes 0.009 | Billboard 0.010, Memorial Garden **0.022**, Night Watchman -0.002 (se of its daily figure 5.8), monuments 0.010, tithes 0.009 | **borderline**: the Garden, now bought on day 20, returns about twice a monument (see 3) |
| skill worth clearly more than luck | mixed towns: hard +16.7%, easy never wins; Daily Challenge hard 420, easy 364 against a day-to-day luck of about 44 | Daily Challenge hard 419, easy 365 against a day-to-day luck of 44 (mixed towns not re-run) | yes |
| a day-10 starter reaches mid-table (5.0 of 9) | 5.10, 58% in the top half | not re-run (no rule it depends on changed) | yes (round 16) |
| the leader's margin over the median stays moderate | 1.07x | 1.07x | yes |
| PvP-heavy play viable, peaceful play not miserable | fighters -2.9% of their towns' mean, 1.11x their share; most-targeted peaceful parlor loses 4.1% (worst town 8.2%), finishes 2.71st | fighters -3.3%, 1.03x their share; most-targeted peaceful parlor loses 4.2% (worst town 8.0%), finishes 2.68th | yes |
| a small house edge | slots 0.796 / 0.696 / 0.858 at $100 / $1,000 / $500 | slots 0.870 / 0.939 / 0.896 over 15,269 plays | the exact return (0.976) is tested in core; no house rule changed |
| loans cannot be turned into points | 2,669 loans, none defaulted | 2,689 loans (builder, tycoon), none defaulted | yes |
| a full but not grindy day | 351 screens, 191 choices, 16.1 customers | 352 screens, 191 choices, 16.1 customers | see 7 |

### Reading

1. **The win-share target is still missed at the top; the bottom is now met.** Round 17 applied the one proposal of the last baseline that only changes what the bots buy: the personalities that buy the Memorial Garden (Soft Touch, builder, scholar, saint, organiser) and the Night Watchman (Soft Touch, saboteur) list it just before the embalming lab instead of after it. The steady neutral sellers gained most: the organiser from 0.17 to 0.46 of its share (-0.8% to +0.7% of its towns' mean BP), the scholar from 0.28 to 0.72 (-0.1% to +0.8%); with the saboteur at 0.35 nobody is below a third. At the top the politician (2.38, +3.9%, sd 4.6%) and the necromancer (2.33, -3.3%, sd 12.4%) are both a little lower but still above 2, for the reasons of the last round: the politician is the best seller (sale BP per turn 35.4, 29% exact) with a small spread, and the necromancer wins on its spread, not its mean. The new content's draws are mixed into these figures (see the italic note), so read the top two as unchanged.
2. **Is win share the right target?** Read by mean place and BP against the town mean the field is fair and slightly tighter at the sellers' end: eleven of twelve personalities are within 4% of their towns' mean (the politician and the tycoon at +3.9% and +4.0% the highest, the saboteur alone outside at -7.8%), and mean places run from 2.92 to 6.38. Win share in an eight-seat field rewards the top of a distribution, so it punishes low variance as much as a low mean. The target is kept as written and reported as missed; the proposal to judge Expanded by mean place and BP stands (below).
3. **The late upgrades.** The Garden is now bought by 27% of seats on day 20.2 (was 8% on day 26.0) and returns +54 BP a day once owned (se 3.3), 0.022 BP a dollar over the season: about twice a monument, the level at which round 14 still cut the Billboard. Measured at 60 towns, listing it straight after the storeroom (day 15) lifted the organiser further (+2.1% of its towns' mean) but made the Garden 0.028 BP a dollar, three times a monument, so the shipped lists put it just before the lab. If the owner wants it at a monument's rate, its income shift (+4) or price ($20,000 with a $4,000 permit) is the lever (rules doc 7.2, not changed here). The Night Watchman moved only from day 25.7 to 24.7 (13% of seats): it needs the guard dog and the $16,000 alarm, which only Soft Touch and the saboteur buy, and its daily return is now within noise of zero (-5.5 BP a day, se 5.8; measured against the same personality's seats that bought the florist cooler or the lab instead). Moving it ahead of the florist cooler at 60 towns made that worse (-40 BP a day), so it stays a defence buy. The Billboard 0.010, monuments 0.010, tithes 0.009.
4. **Karma paths.** On wins: evil 1.29, good 1.08, neutral 0.82 (was 1.29, 1.23, 0.70). On BP against the town mean: good +1.0%, neutral +1.2%, evil -4.7%. Evil is the necromancer and the saboteur: the lowest mean and the widest spread.
5. **Late starters** (round 16, not re-run): with `underdog.late.money` a day-10 parlor finished 5.10th of 9, 58% in the top half.
6. **Hits.** 787 resolved, 609 landed (77%); 329 vests and 114 bodyguards bought on a rumour. Hits return 0.004 BP of the victim's per dollar: a grudge, not a points engine.
7. **The day is still long.** 352 screens a bot-day, 191 of them choices, for 16.1 customers. Nothing here shortens it; the proposals that would are below, not applied, because they change how the game feels.
8. **Two levers tried and not applied.** (a) *A per-day cap on parlor-fight BP gained* (the last baseline's idea for the necromancer's spread). Counting every bot-day of 12 towns: the necromancer's parlor-fight BP never passes 109 a day (one win at the 95-BP curve cap x1.15), the gambler's 95 to 118; the saboteur's median fight day is 136 and its 90th percentile 218. A cap of 150 would take nothing from the necromancer and about 470 BP a season (13% of its fight BP, about 2.5% of its season) from the saboteur, already last; a cap of 100 takes 30 to 50 from the necromancer and 1,200 from the saboteur. The necromancer's spread comes from how many days it fights and wins (its season's fight BP has an sd of 400 to 730 and correlates 0.55 to 0.76 with its place against the town mean), not from lucky single days, so no daily cap reaches it without hitting the saboteur harder. Not applied. (b) *`scoring.exact.share` 0.5 -> 0.4* (60 towns, against the same run at 0.5): the politician's BP a day fell 0.3% but the town's mean fell 1.2%, so it rose against its towns (+4.0% -> +5.0%); the scholar fell 2.0 points against its towns (+1.7% -> -0.3%), the saint 1.9, the builder 0.4. It fails the condition (bring the politician down without costing a neutral seller more than a point). Not applied; `scoring.exact.share` stays 0.5.
9. **Hidden information and no-fighter towns** (previous baselines, not re-run): the oracle makes about 13% more a customer and finishes 11.6% higher; without fighters the same parlors finish about 4% higher.

### Recommended next tuning and proposals (for the owner to decide; nothing here was applied)

| proposal | evidence |
| --- | --- |
| Accept win share as missed for a tight field and judge the Expanded balance on mean place and BP against the town mean (both within the bands above), or widen the sellers' variance by design (for example a larger closeness bonus with a smaller base, so a careful seller's best seasons stand out) | reading 1 and 2: the bottom is now met, the top two are a low-spread seller and a high-spread fighter |
| The Memorial Garden at a monument's rate: income shift +4 -> +2, or its price up, now that the bots buy it on day 20 | reading 3: 0.022 BP a dollar, +54 BP a day once owned |
| The necromancer's spread: not a daily cap (reading 8a); if it must come down, the levers are the number of fights it can win in a season or its duel stake, both of which also reach the saboteur, or accepting it as the fighter's character | reading 8a |
| The politician: neither office nor `scoring.exact.share` brings it down (reading 8b); its lead is its selling on the good path's calm customers. Leave it, or look at the good path's customer calm (`customer.calm`) with the saint and the pacifist in mind | readings 1 and 8b |
| Shorter days without less depth (changes how the game feels; not applied): a standing order at Di-Mart (keep the storeroom at a chosen mix each morning: about 11 store screens a day become one choice a season), a default for body preparation that follows the player's karma path (one press instead of a choice after 40% of sales, with the full choice one tap away), the hand of soft-sell cards and the packages shown on the negotiation screen instead of separate panes (about 5 pane changes a customer), and reading all mail on one screen | 352 screens, 191 choices for 16 customers a day |

### What the bots cannot tell us

See the last section of the generated tables, "What only human playtesting can answer".

---

Generated by `@fq/sim`: 200 towns of 8 bots, 30 days each, difficulty hard, base seed 1. 16,872,159 actions in 1853 s.

**Checks: passed.** No invariant breaks, rejected offered buttons, exploit signatures or stuck bots.

## Win rate by personality

| personality | seats | wins | win rate | fair share | mean final BP | mean place |
| --- | --- | --- | --- | --- | --- | --- |
| politician | 138 | 41 | 29.7% | 12.5% | 20344.7 | 3.04 |
| necromancer | 134 | 39 | 29.1% | 12.5% | 18916.3 | 4.76 |
| tycoon | 123 | 24 | 19.5% | 12.5% | 20483.2 | 2.92 |
| pacifist | 142 | 21 | 14.8% | 12.5% | 20047.9 | 4.00 |
| shark | 130 | 14 | 10.8% | 12.5% | 19427.7 | 4.67 |
| scholar | 145 | 13 | 9.0% | 12.5% | 19793.1 | 4.52 |
| gambler | 133 | 10 | 7.5% | 12.5% | 19120.2 | 5.30 |
| builder | 128 | 9 | 7.0% | 12.5% | 19946.0 | 4.22 |
| saint | 122 | 8 | 6.6% | 12.5% | 19865.7 | 4.27 |
| organiser | 140 | 8 | 5.7% | 12.5% | 19803.8 | 4.56 |
| mourner | 128 | 7 | 5.5% | 12.5% | 19383.1 | 5.27 |
| saboteur | 137 | 6 | 4.4% | 12.5% | 17726.7 | 6.38 |

## BP by personality

BP/turn counts only turns spent on customers; BP/day includes risks, events, mail rewards and battles.

| personality | player-days | BP/day | BP/turn | sale BP/turn | fight BP/day | turns/day | sales/day | walkouts | exact | within 3% | within 8% | bonus share of sale BP | price/limit | risks taken | risk BP/day |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tycoon | 3690 | 690.0 | 41.33 | 34.98 | 0.0 | 16.7 | 16.3 | 0.0% | 24.1% | 17.0% | 9.8% | 23.7% | 0.74 | 94.3% | 66.3 |
| politician | 4140 | 673.9 | 42.65 | 35.42 | 0.0 | 15.8 | 15.5 | 0.0% | 29.3% | 18.5% | 10.4% | 26.6% | 0.78 | 92.2% | 61.6 |
| builder | 3840 | 667.8 | 39.20 | 33.76 | 0.0 | 17.0 | 16.6 | 0.0% | 21.1% | 15.6% | 9.5% | 21.9% | 0.72 | 94.1% | 65.8 |
| organiser | 4200 | 663.8 | 39.61 | 33.97 | 0.0 | 16.8 | 16.4 | 0.0% | 23.4% | 16.4% | 10.0% | 23.5% | 0.74 | 93.2% | 65.6 |
| scholar | 4350 | 663.4 | 39.71 | 34.08 | 0.0 | 16.7 | 16.3 | 0.0% | 24.8% | 16.5% | 9.7% | 24.8% | 0.74 | 93.4% | 66.4 |
| shark | 3900 | 660.5 | 37.79 | 34.07 | 0.0 | 17.5 | 17.0 | 0.4% | 22.5% | 15.8% | 9.5% | 23.3% | 0.72 | 81.1% | 50.8 |
| saint | 3660 | 659.7 | 42.65 | 34.25 | 0.0 | 15.5 | 15.1 | 0.0% | 27.8% | 17.2% | 9.8% | 26.0% | 0.76 | 91.6% | 59.0 |
| pacifist | 4260 | 656.8 | 41.16 | 33.71 | 0.0 | 16.0 | 15.6 | 0.0% | 28.5% | 17.8% | 10.3% | 27.4% | 0.77 | 88.1% | 58.3 |
| gambler | 3990 | 640.5 | 40.66 | 33.43 | 21.2 | 15.8 | 15.4 | 0.1% | 26.1% | 18.1% | 11.7% | 25.5% | 0.77 | 75.0% | 44.4 |
| mourner | 3840 | 640.2 | 40.53 | 33.96 | 0.0 | 15.8 | 15.5 | 0.0% | 26.5% | 17.4% | 9.9% | 25.2% | 0.75 | 85.1% | 56.2 |
| necromancer | 4020 | 629.0 | 40.12 | 32.61 | 31.4 | 15.7 | 15.4 | 0.2% | 25.0% | 17.6% | 11.8% | 25.2% | 0.77 | 64.1% | 36.5 |
| saboteur | 4110 | 580.3 | 39.61 | 25.56 | 131.0 | 14.6 | 14.4 | 0.0% | 15.6% | 11.8% | 9.5% | 20.2% | 0.66 | 68.2% | 39.2 |

## BP by psych level (as the stats sheet shows it, at the start of the day)

| psych | player-days | BP/day | BP/turn | sale BP/turn | fight BP/day | turns/day | sales/day | walkouts | exact | within 3% | within 8% | bonus share of sale BP | price/limit | risks taken | risk BP/day |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 6703 | 491.2 | 32.79 | 25.59 | 63.5 | 15.0 | 14.9 | 0.1% | 16.4% | 11.7% | 9.8% | 20.7% | 0.67 | 60.2% | 31.8 |
| 2 | 1663 | 443.1 | 29.35 | 26.14 | 12.2 | 15.1 | 14.8 | 0.1% | 17.4% | 12.3% | 10.8% | 21.1% | 0.69 | 60.0% | 26.5 |
| 3 | 3005 | 518.8 | 34.10 | 28.27 | 30.8 | 15.2 | 14.9 | 0.0% | 20.6% | 13.7% | 10.7% | 23.0% | 0.71 | 76.8% | 38.1 |
| 4 | 7727 | 567.4 | 35.43 | 30.15 | 6.0 | 16.0 | 15.6 | 0.1% | 22.7% | 15.4% | 10.8% | 24.3% | 0.73 | 86.1% | 51.7 |
| 5 | 4294 | 599.3 | 36.82 | 31.50 | 2.3 | 16.3 | 15.9 | 0.1% | 24.4% | 16.0% | 10.6% | 25.0% | 0.74 | 91.2% | 61.2 |
| 6 | 4736 | 656.9 | 39.68 | 33.46 | 7.8 | 16.6 | 16.1 | 0.1% | 26.7% | 17.6% | 10.7% | 25.9% | 0.76 | 86.0% | 62.5 |
| 7 | 4174 | 714.7 | 42.84 | 35.80 | 7.4 | 16.7 | 16.2 | 0.1% | 28.0% | 18.8% | 10.3% | 26.0% | 0.78 | 91.3% | 66.7 |
| 8 | 15698 | 805.8 | 48.26 | 39.26 | 5.5 | 16.7 | 16.3 | 0.0% | 28.5% | 19.5% | 9.5% | 25.2% | 0.78 | 95.3% | 68.3 |

## The exact match

186134 of 757649 sales (24.6%) hit the spending limit exactly: 116.33 per player per 30 days. All closeness bonuses (exact, within 3%, within 8%) are the "bonus share" column above.

## Wait for Customer outcomes

| outcome | count | share |
| --- | --- | --- |
| customer | 774997 | 80.5% |
| event | 75108 | 7.8% |
| risk | 73283 | 7.6% |
| script | 39651 | 4.1% |
| noTurns | 0 | 0.0% |

## Tags

Income by source:

| category | gold-tag equivalents | share |
| --- | --- | --- |
| sales | 445482.5 | 93.6% |
| theft | 15484.8 | 3.3% |
| bonus tag | 11599.0 | 2.4% |
| other | 1660.0 | 0.3% |
| received | 1023.0 | 0.2% |
| black market | 565.0 | 0.1% |

Spending and losses by use:

| category | gold-tag equivalents | share |
| --- | --- | --- |
| psych | 165048.0 | 51.7% |
| hearse | 83370.0 | 26.1% |
| strength | 23520.0 | 7.4% |
| stolen | 15484.8 | 4.9% |
| hp | 14885.0 | 4.7% |
| club cover | 6973.5 | 2.2% |
| arson | 4560.0 | 1.4% |
| bingo | 2481.3 | 0.8% |
| transfers | 1364.0 | 0.4% |
| burned | 1258.0 | 0.4% |

| personality | arson | bingo | burned | club cover | hearse | hp | psych | stolen | strength | transfers |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gambler | 0.0 | 2422.0 | 127.0 | 1005.8 | 9077.0 | 0.0 | 14896.0 | 1584.5 | 4788.0 | 0.0 |
| shark | 0.0 | 0.0 | 363.0 | 1624.0 | 16120.0 | 0.0 | 14232.0 | 1768.5 | 0.0 | 0.0 |
| saint | 0.0 | 59.3 | 20.8 | 1071.0 | 4148.0 | 0.0 | 13664.0 | 1354.8 | 0.0 | 594.0 |
| scholar | 0.0 | 0.0 | 36.8 | 1443.5 | 10005.0 | 0.0 | 16240.0 | 849.8 | 0.0 | 0.0 |
| mourner | 0.0 | 0.0 | 33.5 | 0.0 | 8832.0 | 0.0 | 14336.0 | 691.8 | 0.0 | 770.0 |
| politician | 0.0 | 0.0 | 101.3 | 23.5 | 4692.0 | 0.0 | 15456.0 | 2073.0 | 0.0 | 0.0 |
| organiser | 0.0 | 0.0 | 105.0 | 11.8 | 4760.0 | 0.0 | 15680.0 | 1067.5 | 0.0 | 0.0 |
| builder | 0.0 | 0.0 | 50.0 | 3.3 | 8832.0 | 0.0 | 14336.0 | 958.3 | 0.0 | 0.0 |
| pacifist | 0.0 | 0.0 | 0.0 | 0.0 | 4828.0 | 0.0 | 15904.0 | 0.0 | 0.0 | 0.0 |
| necromancer | 0.0 | 0.0 | 397.0 | 104.8 | 4556.0 | 0.0 | 15008.0 | 1996.3 | 7236.0 | 0.0 |
| tycoon | 0.0 | 0.0 | 23.8 | 1540.3 | 4182.0 | 0.0 | 13776.0 | 1098.8 | 0.0 | 0.0 |
| saboteur | 4560.0 | 0.0 | 0.0 | 145.8 | 3338.0 | 14885.0 | 1520.0 | 2041.8 | 11496.0 | 0.0 |

## PvP

| measure | value |
| --- | --- |
| visits (doors reached) | 18919 |
| visits per player-day | 0.39 |
| refused at the door (online, police, locked) | 1113 |
| thefts | 6694 |
| tags per theft | 1.43 |
| battles started | 11112 |
| attacker wins / losses | 9690 / 1128 (89.6%) |
| BP won by winning attackers | 793403 |
| BP lost by losing attackers | 44417 |
| arsons hired / stopped by a smoke detector | 760 / 0 |
| Cursed Tigers / Lucky Sparrows / Lucky Dragons | 8010 / 896 / 2532 |

BP lost to other parlors' attacks, per player-day, by the victim's personality:

| personality | BP lost per day |
| --- | --- |
| shark | 20.2 |
| necromancer | 13.7 |
| gambler | 12.4 |
| tycoon | 10.8 |
| politician | 8.8 |
| organiser | 8.6 |
| builder | 7.8 |
| scholar | 7.2 |
| saint | 6.8 |
| mourner | 2.6 |
| saboteur | 0.4 |

## Snowball

At the end the leader has 1.07x the median parlor's BP.

| after day | leader went on to win |
| --- | --- |
| 1 | 21.0% |
| 3 | 23.5% |
| 5 | 22.5% |
| 10 | 38.5% |
| 15 | 50.5% |
| 20 | 56.5% |
| 25 | 67.0% |

| leader after day | builder | gambler | mourner | necromancer | organiser | pacifist | politician | saboteur | saint | scholar | shark | tycoon |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 19 | 16 | 10 | 29 | 30 | 10 | 18 | 13 | 10 | 12 | 18 | 15 |
| 5 | 17 | 10 | 12 | 18 | 20 | 18 | 35 | 8 | 20 | 10 | 11 | 21 |
| 10 | 10 | 3 | 9 | 14 | 9 | 22 | 66 | 8 | 30 | 8 | 6 | 15 |
| 15 | 7 | 3 | 14 | 24 | 5 | 22 | 66 | 8 | 29 | 5 | 5 | 12 |
| 20 | 7 | 6 | 11 | 28 | 5 | 31 | 56 | 9 | 27 | 7 | 8 | 5 |
| 25 | 7 | 10 | 6 | 37 | 9 | 28 | 37 | 7 | 16 | 7 | 8 | 28 |
| 30 | 9 | 10 | 7 | 39 | 8 | 21 | 41 | 6 | 8 | 13 | 14 | 24 |

| day | leader BP | runner-up | median | leader / median | lead over runner-up |
| --- | --- | --- | --- | --- | --- |
| 1 | 534.0 | 466.5 | 400.8 | 1.34 | 67.5 |
| 5 | 2663.1 | 2475.0 | 2208.6 | 1.21 | 188.1 |
| 10 | 5756.2 | 5427.3 | 4997.8 | 1.15 | 328.9 |
| 15 | 9174.7 | 8731.3 | 8189.5 | 1.12 | 443.5 |
| 20 | 12946.3 | 12452.5 | 11815.3 | 1.10 | 493.8 |
| 25 | 17054.5 | 16518.0 | 15821.1 | 1.08 | 536.6 |
| 30 | 21290.8 | 20638.8 | 19966.6 | 1.07 | 652.0 |

## Expanded: win rate by personality

| personality | seats | wins | win rate | fair share | win / fair | mean final BP | mean place | BP vs town mean | sd of that |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| politician | 138 | 41 | 29.7% | 12.5% | 2.38 | 20,345 | 3.04 | +3.9% | 4.6% |
| necromancer | 134 | 39 | 29.1% | 12.5% | 2.33 | 18,916 | 4.76 | -3.3% | 12.4% |
| tycoon | 123 | 24 | 19.5% | 12.5% | 1.56 | 20,483 | 2.92 | +4.0% | 3.9% |
| pacifist | 142 | 21 | 14.8% | 12.5% | 1.18 | 20,048 | 4.00 | +2.3% | 5.4% |
| shark | 130 | 14 | 10.8% | 12.5% | 0.86 | 19,428 | 4.67 | -0.3% | 7.1% |
| scholar | 145 | 13 | 9.0% | 12.5% | 0.72 | 19,793 | 4.52 | +0.8% | 4.4% |
| gambler | 133 | 10 | 7.5% | 12.5% | 0.60 | 19,120 | 5.30 | -2.4% | 7.3% |
| builder | 128 | 9 | 7.0% | 12.5% | 0.56 | 19,946 | 4.22 | +1.5% | 4.0% |
| saint | 122 | 8 | 6.6% | 12.5% | 0.52 | 19,866 | 4.27 | +1.5% | 4.1% |
| organiser | 140 | 8 | 5.7% | 12.5% | 0.46 | 19,804 | 4.56 | +0.7% | 4.5% |
| mourner | 128 | 7 | 5.5% | 12.5% | 0.44 | 19,383 | 5.27 | -0.9% | 5.0% |
| saboteur | 137 | 6 | 4.4% | 12.5% | 0.35 | 17,727 | 6.38 | -7.8% | 9.4% |

Spread: mean final BP from 17,727 to 20,483 (2,757 BP, sd 712 around 19,572); mean place from 2.92 to 6.38.

## Expanded: win rate by karma path (at the end of the season)

| path | seats | wins | win rate | fair share | win / fair | mean final BP | mean place | BP vs town mean | sd of that |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| evil | 305 | 49 | 16.1% | 12.5% | 1.29 | 18,503 | 5.40 | -4.7% | 11.0% |
| good | 573 | 77 | 13.4% | 12.5% | 1.08 | 19,747 | 4.37 | +1.0% | 5.8% |
| neutral | 722 | 74 | 10.2% | 12.5% | 0.82 | 19,872 | 4.22 | +1.2% | 5.3% |

| rivalry tier | seats | wins | win rate | fair share | win / fair | mean final BP | mean place | BP vs town mean | sd of that |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| peaceful | 142 | 21 | 14.8% | 12.5% | 1.18 | 20,048 | 4.00 | +2.3% | 5.4% |
| standard | 1191 | 159 | 13.4% | 12.5% | 1.07 | 19,736 | 4.32 | +0.6% | 6.6% |
| cutthroat | 267 | 20 | 7.5% | 12.5% | 0.60 | 18,555 | 5.55 | -4.1% | 9.2% |

| PvP | seats | wins | win rate | fair share | win / fair | mean final BP | mean place | BP vs town mean | sd of that |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fights (parlor, duel or hit) | 519 | 67 | 12.9% | 12.5% | 1.03 | 18,825 | 5.26 | -3.3% | 9.6% |
| never fights | 1081 | 133 | 12.3% | 12.5% | 0.98 | 19,922 | 4.14 | +1.6% | 5.1% |

## Expanded: the parlors at the end of the season

| personality | final BP | cash | savings | karma | good / evil | upgrades | monuments | in a chain | mayor | BP lost to PvP | decisions / day | turns / day |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| builder | 19,946 | 8,510 | 0 | 49 | 1.6% / 0.0% | 8.1 | 2.9 | 65.6% | 0.0% | 414 | 346 | 17.1 |
| gambler | 19,120 | 8,543 | 0 | 60 | 25.6% / 0.0% | 6.9 | 2.7 | 0.0% | 0.0% | 595 | 363 | 16.6 |
| mourner | 19,383 | 4,744 | 0 | 100 | 100.0% / 0.0% | 7.9 | 2.3 | 70.3% | 0.0% | 196 | 342 | 16.7 |
| necromancer | 18,916 | 13,200 | 0 | 1 | 0.0% / 100.0% | 6.7 | 3.3 | 0.0% | 0.0% | 721 | 363 | 17.2 |
| organiser | 19,804 | 14,882 | 0 | 51 | 1.4% / 0.0% | 8.8 | 3.1 | 100.0% | 0.0% | 456 | 340 | 16.8 |
| pacifist | 20,048 | 19,162 | 0 | 100 | 100.0% / 0.0% | 7.0 | 3.2 | 0.0% | 0.0% | 0 | 353 | 16.9 |
| politician | 20,345 | 4,277 | 0 | 100 | 100.0% / 0.0% | 5.1 | 2.4 | 68.1% | 92.0% | 525 | 361 | 16.7 |
| saboteur | 17,727 | 8,669 | 0 | 1 | 0.0% / 100.0% | 8.5 | 2.8 | 0.0% | 0.0% | 115 | 303 | 16.2 |
| saint | 19,866 | 2,834 | 0 | 100 | 100.0% / 0.0% | 3.2 | 1.7 | 0.0% | 0.0% | 407 | 346 | 16.4 |
| scholar | 19,793 | 7,796 | 0 | 50 | 2.1% / 0.0% | 8.1 | 2.9 | 0.0% | 0.0% | 395 | 339 | 16.7 |
| shark | 19,428 | 42,526 | 0 | 35 | 0.0% / 26.2% | 8.4 | 4.3 | 0.0% | 0.0% | 737 | 404 | 17.5 |
| tycoon | 20,483 | 66,463 | 0 | 48 | 1.6% / 0.0% | 8.0 | 5.0 | 0.0% | 0.0% | 661 | 360 | 16.7 |

Decisions per bot-day across the town: 352 screens answered from log on to log off (the newspaper, every look at the hand of cards, every Back and every walk across the map included), of which 191 are choices (a pitch, a purchase, a vote: anything but looking and walking), for 16.1 customers a day.

## Expanded: selling

| personality | sales / day | walkouts | exact | within 3% | within 8% | bonus share of sale BP | sale BP / customer | money / sale | actions / sale | cremations | listened | coffee | blessed | happy families | sour families |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| builder | 16.6 | 0.0% | 21.1% | 15.6% | 9.5% | 21.9% | 33.8 | 863 | 7.2 | 0.2% | 81.7% | 67.7% | 0.2% | 30.3% | 38.6% |
| gambler | 15.4 | 0.1% | 26.1% | 18.1% | 11.7% | 25.5% | 33.4 | 695 | 7.4 | 0.7% | 86.6% | 72.4% | 2.8% | 33.2% | 34.5% |
| mourner | 15.5 | 0.0% | 26.5% | 17.4% | 9.9% | 25.2% | 34.0 | 602 | 8.0 | 0.0% | 78.1% | 64.7% | 66.0% | 48.7% | 24.7% |
| necromancer | 15.4 | 0.2% | 25.0% | 17.6% | 11.8% | 25.2% | 32.6 | 888 | 7.4 | 2.3% | 86.5% | 72.3% | 0.7% | 30.3% | 36.5% |
| organiser | 16.4 | 0.0% | 23.4% | 16.4% | 10.0% | 23.5% | 34.0 | 781 | 7.2 | 0.6% | 80.1% | 64.9% | 0.2% | 31.0% | 39.2% |
| pacifist | 15.6 | 0.0% | 28.5% | 17.8% | 10.3% | 27.4% | 33.7 | 834 | 8.4 | 1.7% | 81.5% | 68.5% | 70.5% | 48.5% | 32.2% |
| politician | 15.5 | 0.0% | 29.3% | 18.5% | 10.4% | 26.6% | 35.4 | 490 | 8.6 | 0.0% | 85.1% | 75.2% | 75.6% | 48.5% | 29.8% |
| saboteur | 14.4 | 0.0% | 15.6% | 11.8% | 9.5% | 20.2% | 25.6 | 705 | 5.8 | 0.4% | 76.2% | 62.4% | 0.0% | 27.8% | 44.8% |
| saint | 15.1 | 0.0% | 27.8% | 17.2% | 9.8% | 26.0% | 34.3 | 601 | 8.0 | 0.0% | 79.3% | 70.0% | 69.4% | 45.7% | 31.0% |
| scholar | 16.3 | 0.0% | 24.8% | 16.5% | 9.7% | 24.8% | 34.1 | 709 | 7.2 | 0.2% | 77.8% | 63.1% | 0.2% | 28.3% | 46.0% |
| shark | 17.0 | 0.4% | 22.5% | 15.8% | 9.5% | 23.3% | 34.1 | 1,670 | 7.8 | 11.6% | 92.4% | 78.5% | 0.0% | 32.4% | 35.2% |
| tycoon | 16.3 | 0.0% | 24.1% | 17.0% | 9.8% | 23.7% | 35.0 | 1,541 | 7.6 | 3.9% | 83.2% | 70.1% | 0.0% | 31.9% | 39.0% |

Walkouts by trait (all customers who had the trait, hidden or shown):

| trait | customers | walkouts | rate |
| --- | --- | --- | --- |
| hurry | 42792 | 63 | 0.1% |
| nervous | 43681 | 63 | 0.1% |
| hothead | 43981 | 52 | 0.1% |
| executor | 42111 | 49 | 0.1% |
| grudge | 42513 | 49 | 0.1% |
| heir | 44517 | 46 | 0.1% |
| relieved | 42417 | 37 | 0.1% |
| devout | 45171 | 38 | 0.1% |
| estranged | 42300 | 34 | 0.1% |
| germophobe | 43756 | 34 | 0.1% |
| traditionalist | 43037 | 33 | 0.1% |
| music-lover | 44870 | 34 | 0.1% |
| animal-lover | 44654 | 33 | 0.1% |
| superstitious | 43786 | 32 | 0.1% |
| shutterbug | 44788 | 32 | 0.1% |
| loudmouth | 43755 | 30 | 0.1% |
| new-age | 42503 | 29 | 0.1% |
| rivalry | 47180 | 31 | 0.1% |
| sentimental | 44447 | 29 | 0.1% |
| foodie | 44814 | 29 | 0.1% |
| gossip | 44573 | 28 | 0.1% |
| no-nonsense | 43563 | 27 | 0.1% |
| country-club | 43723 | 25 | 0.1% |
| collector | 46400 | 25 | 0.1% |
| windfall | 42771 | 23 | 0.1% |
| pushover | 45024 | 24 | 0.1% |
| death-fan | 46697 | 24 | 0.1% |
| skeptic | 46336 | 23 | 0.0% |
| showoff | 46714 | 23 | 0.0% |
| tight-lipped | 44277 | 21 | 0.0% |
| been-here | 46755 | 22 | 0.0% |
| know-it-all | 46841 | 22 | 0.0% |
| litigious | 44877 | 21 | 0.0% |
| minimalist | 42777 | 20 | 0.0% |
| broke | 43062 | 17 | 0.0% |
| accountant | 46027 | 18 | 0.0% |
| pincher | 42603 | 15 | 0.0% |
| haggler | 46839 | 15 | 0.0% |
| green | 41894 | 13 | 0.0% |
| heartbroken | 40074 | 12 | 0.0% |
| conspiracy | 44388 | 13 | 0.0% |
| chatterbox | 42859 | 12 | 0.0% |
| prodigal | 40253 | 11 | 0.0% |
| serene | 42088 | 7 | 0.0% |

| special customer | met | sales | walkouts |
| --- | --- | --- | --- |
| county-contract | 2534 | 0 | 0 |
| celebrity | 2614 | 2612 | 2 |
| pre-need | 5221 | 5220 | 1 |
| clown-family | 2710 | 2710 | 0 |
| jackpot | 2394 | 2375 | 19 |
| pet | 5129 | 5126 | 3 |
| teller | 2441 | 2440 | 1 |
| nurse-referral | 2496 | 0 | 0 |
| june | 2388 | 2387 | 1 |
| cousin-sal | 2445 | 0 | 0 |
| zookeeper | 2292 | 2291 | 1 |
| mob-boss | 2298 | 2296 | 2 |
| black-widow | 2442 | 2440 | 2 |
| blaine-director | 2256 | 2255 | 1 |
| old-man-withers | 2614 | 2614 | 0 |
| lucius-vane | 2148 | 2145 | 3 |
| father-smyth | 2466 | 2464 | 2 |
| inspector-mudge | 2304 | 0 | 0 |
| coroner | 2208 | 0 | 0 |
| elijah | 2204 | 2204 | 0 |
| the-mayor | 2208 | 2206 | 2 |
| the-count | 2051 | 2051 | 0 |
| fake-death | 2225 | 0 | 0 |
| the-twins | 2106 | 0 | 0 |
| ghost-crew | 2146 | 0 | 0 |
| the-mournes | 2282 | 2282 | 0 |

Packages sold (share of all sales reaching each tier or higher bought on that sale):

| package | tier 1 | tier 2 | tier 3 | tier 4 | tier 5 |
| --- | --- | --- | --- | --- | --- |
| plot | 10.1% | 3.2% | 6.1% | 0.0% | 0.0% |
| service | 1.8% | 0.3% | 0.1% | 0.1% | 0.0% |
| embalming | 3.0% | 1.9% | 0.2% | 0.2% | 0.5% |
| headstone | 2.2% | 0.2% | 0.1% | 0.0% | 0.0% |
| flowers | 1.3% | 0.2% | 0.0% | 0.0% | 0.0% |
| urn | 0.1% | 0.0% | 0.0% | 0.0% | 0.0% |

Soft-sell cards bought: 2.24 per sale.

## Expanded: money by system

Dollars earned per player-day:

| income | share | builder | gambler | mourner | necromancer | organiser | pacifist | politician | saboteur | saint | scholar | shark | tycoon |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sales | 82.5% | 14,368 | 10,721 | 9,310 | 13,643 | 12,792 | 13,000 | 7,581 | 10,131 | 9,096 | 11,586 | 28,404 | 25,147 |
| new day and mail | 5.5% | 982 | 854 | 887 | 854 | 960 | 939 | 937 | 687 | 900 | 921 | 1,003 | 1,015 |
| savings | 4.5% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 9,785 |
| body prep | 2.4% | 439 | 344 | 73 | 1,106 | 424 | 71 | 77 | 1,033 | 74 | 418 | 169 | 429 |
| loans | 2.1% | 2,351 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2,000 |
| special offers | 1.3% | 346 | 285 | 34 | 235 | 331 | 36 | 34 | 219 | 34 | 327 | 359 | 355 |
| rob graves | 0.6% | 0 | 0 | 0 | 540 | 0 | 0 | 0 | 590 | 0 | 0 | 0 | 0 |
| gambling | 0.5% | 0 | 1,055 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| parlor PvP | 0.4% | 0 | 217 | 0 | 89 | 0 | 0 | 0 | 27 | 0 | 0 | 395 | 0 |
| dig | 0.3% | 0 | 0 | 0 | 275 | 0 | 0 | 0 | 287 | 0 | 0 | 0 | 0 |

Dollars spent per player-day:

| spending | share | builder | gambler | mourner | necromancer | organiser | pacifist | politician | saboteur | saint | scholar | shark | tycoon |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| stock | 46.8% | 8,726 | 6,618 | 5,200 | 6,990 | 7,408 | 8,164 | 3,836 | 5,860 | 5,272 | 7,050 | 12,687 | 13,221 |
| upgrades | 18.1% | 4,186 | 2,481 | 2,456 | 2,428 | 3,653 | 2,532 | 1,348 | 2,757 | 594 | 3,140 | 5,267 | 4,175 |
| monuments | 9.2% | 934 | 854 | 575 | 1,517 | 1,143 | 1,314 | 614 | 891 | 288 | 971 | 3,526 | 5,509 |
| tithe | 4.8% | 638 | 626 | 582 | 644 | 651 | 656 | 578 | 607 | 2,567 | 629 | 667 | 667 |
| savings | 4.6% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 9,738 |
| black market | 2.5% | 0 | 532 | 0 | 1,367 | 0 | 0 | 0 | 969 | 33 | 408 | 927 | 529 |
| hearse upkeep | 2.2% | 602 | 293 | 394 | 223 | 310 | 311 | 310 | 25 | 217 | 404 | 862 | 300 |
| loans | 2.2% | 2,421 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2,060 |
| leads | 2.1% | 0 | 0 | 0 | 1,185 | 0 | 0 | 0 | 0 | 0 | 0 | 2,907 | 0 |
| hits | 1.4% | 0 | 213 | 0 | 569 | 0 | 0 | 0 | 416 | 0 | 0 | 1,617 | 0 |
| story appeals | 1.2% | 0 | 0 | 388 | 485 | 0 | 334 | 286 | 449 | 365 | 0 | 0 | 0 |
| treatment | 1.1% | 123 | 210 | 128 | 418 | 134 | 0 | 260 | 135 | 208 | 119 | 201 | 195 |
| gambling | 0.6% | 0 | 1,174 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| permits | 0.5% | 195 | 50 | 134 | 0 | 183 | 0 | 0 | 0 | 183 | 184 | 0 | 0 |
| body prep | 0.4% | 54 | 68 | 102 | 43 | 51 | 103 | 102 | 34 | 97 | 56 | 102 | 45 |
| stolen | 0.4% | 31 | 73 | 20 | 118 | 35 | 0 | 44 | 239 | 30 | 24 | 55 | 45 |
| chains | 0.4% | 109 | 0 | 117 | 0 | 333 | 0 | 114 | 0 | 0 | 0 | 0 | 0 |
| ordinances | 0.3% | 0 | 0 | 0 | 0 | 0 | 0 | 575 | 0 | 0 | 0 | 0 | 0 |
| rob graves | 0.2% | 0 | 0 | 0 | 259 | 0 | 0 | 0 | 213 | 0 | 0 | 0 | 0 |
| special offers | 0.2% | 41 | 31 | 37 | 40 | 38 | 41 | 37 | 40 | 39 | 39 | 40 | 37 |
| inspection | 0.2% | 138 | 0 | 0 | 0 | 0 | 0 | 99 | 72 | 131 | 0 | 0 | 0 |
| midnight (fines, collection) | 0.2% | 4 | 36 | 8 | 83 | 23 | 11 | 1 | 47 | 3 | 30 | 119 | 36 |
| chain dues | 0.1% | 60 | 0 | 63 | 0 | 101 | 0 | 57 | 0 | 0 | 0 | 0 | 0 |
| election | 0.1% | 0 | 0 | 0 | 0 | 0 | 0 | 199 | 0 | 0 | 0 | 0 | 0 |
| holy water | 0.1% | 0 | 0 | 7 | 0 | 0 | 6 | 58 | 0 | 47 | 0 | 0 | 0 |
| bodyguard | 0.0% | 5 | 0 | 0 | 0 | 16 | 0 | 34 | 0 | 0 | 3 | 0 | 26 |
| confession | 0.0% | 0 | 0 | 2 | 0 | 0 | 2 | 0 | 0 | 2 | 0 | 0 | 0 |

## Expanded: BP by system (per player-day)

| source | share | builder | gambler | mourner | necromancer | organiser | pacifist | politician | saboteur | saint | scholar | shark | tycoon |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sales | 80.5% | 575 | 527 | 537 | 511 | 569 | 538 | 560 | 374 | 530 | 569 | 595 | 584 |
| risks | 8.3% | 66 | 44 | 56 | 37 | 66 | 58 | 62 | 39 | 59 | 66 | 51 | 66 |
| parlor PvP | 2.3% | 0 | 21 | 0 | 31 | 0 | 0 | 0 | 131 | 0 | 0 | 0 | 0 |
| monuments | 2.1% | 14 | 12 | 9 | 16 | 15 | 16 | 10 | 13 | 5 | 14 | 22 | 26 |
| service | 1.5% | 0 | 1 | 30 | 0 | 0 | 30 | 29 | 0 | 28 | 0 | 0 | 0 |
| midnight | 1.4% | 8 | 6 | 8 | 10 | 8 | 11 | 16 | 7 | 12 | 7 | 8 | 11 |
| tithe | 1.1% | 5 | 6 | 7 | 3 | 5 | 8 | 7 | 2 | 31 | 5 | 5 | 5 |
| duels | 1.1% | 0 | 23 | 0 | 26 | 0 | 0 | 0 | 36 | 0 | 0 | 0 | 0 |
| wait (events, scripts) | 0.7% | 5 | 5 | 4 | 4 | 5 | 5 | 5 | 4 | 4 | 5 | 4 | 5 |
| yangs | 0.6% | -0 | -1 | -5 | -1 | -0 | -0 | -0 | -21 | -0 | -0 | -20 | -0 |
| special offers | 0.2% | 2 | 2 | 1 | 1 | 2 | 1 | 1 | 1 | 1 | 2 | 2 | 2 |
| new day and mail | 0.2% | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| walkout gifts | 0.0% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Expanded: turns by use (per player-day)

| use | share | builder | gambler | mourner | necromancer | organiser | pacifist | politician | saboteur | saint | scholar | shark | tycoon |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| wait (events, scripts) | 96.1% | 17 | 16 | 16 | 16 | 17 | 16 | 16 | 15 | 15 | 17 | 17 | 17 |
| service | 1.8% | 0 | 0 | 1 | 0 | 0 | 1 | 1 | 0 | 1 | 0 | 0 | 0 |
| duels | 1.1% | 0 | 1 | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| seance | 0.8% | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| tour | 0.2% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Expanded: time by place (decisions per player-day)

| scene | share | builder | gambler | mourner | necromancer | organiser | pacifist | politician | saboteur | saint | scholar | shark | tycoon |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| neg | 78.9% | 282 | 274 | 275 | 272 | 279 | 292 | 295 | 202 | 271 | 278 | 319 | 291 |
| desk | 7.9% | 29 | 28 | 27 | 28 | 28 | 26 | 28 | 27 | 27 | 28 | 30 | 29 |
| store | 3.0% | 11 | 11 | 9 | 11 | 11 | 11 | 8 | 10 | 9 | 11 | 13 | 13 |
| map | 2.6% | 7 | 10 | 9 | 12 | 7 | 8 | 9 | 12 | 11 | 7 | 9 | 8 |
| competitors | 0.9% | 0 | 8 | 0 | 8 | 0 | 0 | 0 | 13 | 0 | 0 | 9 | 0 |
| church | 0.9% | 1 | 6 | 5 | 1 | 1 | 6 | 6 | 1 | 9 | 1 | 1 | 1 |
| risk | 0.9% | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| reaper-club | 0.8% | 0 | 8 | 0 | 6 | 0 | 0 | 0 | 5 | 3 | 3 | 4 | 4 |
| graveyard | 0.7% | 1 | 6 | 1 | 6 | 1 | 1 | 1 | 7 | 4 | 1 | 1 | 1 |
| city-hall | 0.6% | 5 | 1 | 3 | 1 | 4 | 1 | 5 | 2 | 2 | 1 | 1 | 1 |
| parlor | 0.5% | 1 | 1 | 1 | 4 | 1 | 1 | 1 | 4 | 1 | 1 | 1 | 1 |
| bank | 0.4% | 3 | 1 | 2 | 1 | 1 | 1 | 1 | 1 | 2 | 1 | 1 | 6 |
| yangs | 0.4% | 0 | 0 | 2 | 1 | 0 | 1 | 0 | 5 | 1 | 0 | 5 | 0 |
| hospital | 0.3% | 1 | 1 | 1 | 3 | 1 | 0 | 1 | 1 | 1 | 1 | 4 | 1 |
| news | 0.3% | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| stats | 0.3% | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| battle | 0.2% | 0 | 1 | 0 | 2 | 0 | 0 | 0 | 7 | 0 | 0 | 0 | 0 |
| spirit-university | 0.2% | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| cafe | 0.2% | 0 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0 | 0 |
| tutorial | 0.1% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Expanded: what each choice returns

| choice | measure | return | volume (turns, $ or uses) |
| --- | --- | --- | --- |
| a customer (Wait for Customer) | BP per turn | 33.363 | 774997 |
| leading the service | BP per turn | 32.992 | 14280 |
| a graveyard duel (challenger) | BP per turn | 40.177 | 8618 |
| robbing a grave | $ per try | 377.301 | 7103 |
| digging at the office | $ per try | 321.538 | 7103 |
| tending the graves | uses | - | 6782 |
| the seance | turns used | - | 6741 |
| monuments | BP per $ | 0.010 | 71261000 |
| tithes | BP per $ | 0.009 | 37368000 |
| hits (BP the victim lost per $) | BP per $ | 0.004 | 11156050 |
| special offers | BP per offer | 3.643 | 12894 |
| body prep choices | BP per choice | 0.000 | 319742 |
| risks taken | BP per risk | 42.732 | 62725 |

A lead from the nurse ($1,500) brings a sure, richer customer: 23,847 lead customers were met. Sale BP per customer over all customers: 33.36.

Parlor upgrades (share of seats that bought each, and the mean day bought):

| upgrade | bought | share of seats | mean day |
| --- | --- | --- | --- |
| paint | 1600 | 100.0% | 2.5 |
| coffee-machine | 1600 | 100.0% | 3.8 |
| storeroom | 1593 | 99.6% | 9.8 |
| florist-cooler | 1488 | 93.0% | 13.0 |
| viewing-room | 1433 | 89.6% | 15.4 |
| embalming-lab | 1195 | 74.7% | 18.2 |
| incinerator | 724 | 45.3% | 22.2 |
| memorial-garden | 426 | 26.6% | 20.2 |
| chapel | 407 | 25.4% | 20.9 |
| billboard | 352 | 22.0% | 24.5 |
| guard-dog | 265 | 16.6% | 6.3 |
| alarm | 256 | 16.0% | 17.8 |
| night-watchman | 205 | 12.8% | 24.7 |
| mausoleum | 55 | 3.4% | 26.4 |

The three late upgrades the engine pass made cheaper and better, and what they return:

| upgrade | bought | share of seats | mean day | cost with permit ($) | BP / day vs peers (after - before) | days owned | BP over the season | BP per $ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| night-watchman | 205 | 12.8% | 24.7 | 12,000 | -5.5 (se 5.8) | 5.3 | -29 | -0.002 |
| billboard | 352 | 22.0% | 24.5 | 21,500 | +38.6 (se 4.2) | 5.5 | 213 | 0.010 |
| memorial-garden | 426 | 26.6% | 20.2 | 24,000 | +54.2 (se 3.3) | 9.8 | 529 | 0.022 |

BP per day is measured against the same personality's seats on the same day that did not yet own the upgrade, so the season's rise in income cancels; the standard error is across buyers. The monuments return about 0.010 BP a dollar, so an upgrade that returns less is not worth buying for points alone.

Monument tiers built: tier 1: 1600, tier 2: 1562, tier 3: 1166, tier 4: 351, tier 5: 165 (of 1600 seats).

Permits bought: signage 804, zoning 799, crematory 133. Black-market buys: rabbit-foot 329, morty-rib 861, testimonials 592, clover 357, coroner-list 1769, monster-scale 282, tap-water 300, hot-casket 1821, filed-tag 565, riot-shield 344, sal-pad 494, haunted-casket 373, real-water 459, cop-day-off 263, bruno 395, used-wreaths 516, forged-permit 223, mayor-key 174, vest 329.

## Expanded: PvP, duels and hits

| measure | value |
| --- | --- |
| duels started | 8618 |
| challenger won / lost / yielded | 7202 / 965 / 451 |
| BP won by duel winners / lost by losers | 425,418 / 210,173 |
| duels with a Shove: share of duels / challenger won, lost, yielded / mean BP | 5.4% / 128, 305, 33 / -2.0 |
| duels without a Shove: challenger won, lost, yielded / mean BP | 7074, 660, 418 / 42.6 |
| Shove pressed (times) | 471 |
| hits resolved / landed | 787 / 609 |
| BP taken from hit victims | 41,138 |
| cash stolen in burglaries | 2,869,032 |

Hits by the parlor that hired them:

| personality | hired | landed | hirer behind the target | $ spent | BP taken from targets | BP per $ |
| --- | --- | --- | --- | --- | --- | --- |
| gambler | 63 | 51 | 95.2% | 848,600 | 3,457 | 0.004 |
| necromancer | 173 | 133 | 90.2% | 2,288,700 | 8,903 | 0.004 |
| saboteur | 137 | 115 | 97.8% | 1,711,500 | 7,527 | 0.004 |
| shark | 414 | 310 | 98.1% | 6,307,250 | 21,251 | 0.003 |

BP lost to other parlors per player-day, by victim and venue:

| personality | parlor fights | duels | hits | total | share of final BP |
| --- | --- | --- | --- | --- | --- |
| builder | 7.8 | 4.9 | 1.0 | 13.8 | 2.1% |
| gambler | 14.9 | 4.6 | 0.4 | 19.8 | 3.1% |
| mourner | 2.6 | 3.1 | 0.8 | 6.5 | 1.0% |
| necromancer | 19.8 | 3.3 | 0.9 | 24.0 | 3.8% |
| organiser | 8.6 | 5.7 | 0.9 | 15.2 | 2.3% |
| pacifist | 0.0 | 0.0 | 0.0 | 0.0 | 0.0% |
| politician | 8.8 | 6.7 | 2.0 | 17.5 | 2.6% |
| saboteur | 2.8 | 0.6 | 0.4 | 3.8 | 0.6% |
| saint | 6.8 | 5.2 | 1.5 | 13.6 | 2.0% |
| scholar | 7.2 | 5.2 | 0.7 | 13.2 | 2.0% |
| shark | 20.2 | 4.2 | 0.2 | 24.6 | 3.8% |
| tycoon | 10.8 | 9.7 | 1.5 | 22.0 | 3.2% |

The most-targeted peaceful parlor in each town (never fights) lost on average 898 BP over the season, 4.2% of what it would otherwise have had (worst town: 8.0%); it finished at mean place 2.68.

## Expanded: the house

| game and stake | plays | staked | returned | return per $ |
| --- | --- | --- | --- | --- |
| slots.100 | 8824 | 882,400 | 768,000 | 0.870 |
| slots.1000 | 2618 | 2,618,000 | 2,459,000 | 0.939 |
| slots.500 | 3827 | 1,913,500 | 1,714,500 | 0.896 |

Gamblers' net: gambler -118 $/day on 1,357 $/day staked.

## Expanded: the bank

| personality | loans taken | borrowed $ | repaid $ | collected | defaulted | written off $ | default BP | savings interest $ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| builder | 1321 | 9,298,016 | 9,298,016 | 0 | 0 | 0 | 0 | 0 |
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
| tycoon | 1368 | 7,602,945 | 7,602,945 | 0 | 0 | 0 | 0 | 175,427 |

## Expanded: City Hall and chains

| measure | value |
| --- | --- |
| ordinance ballots counted | 800 |
| votes per ballot / players | 8.00 / 8.00 |
| lobbying votes bought | 953 |
| elections held (of towns) | 200 of 200 |
| candidates per election | 0.64 |
| votes per election / players | 5.08 / 8.00 |
| campaign ads bought | 12 |
| mayors by personality | politician 127 |
| chains founded / joined | 140 / 268 |
| chains alive at the end, mean members | 140, 2.91 |

| chain | seats | wins | win rate | fair share | win / fair | mean final BP | mean place | BP vs town mean | sd of that |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| no chain | 1192 | 150 | 12.6% | 12.5% | 1.01 | 19,448 | 4.57 | -0.3% | 7.9% |
| in a chain | 408 | 50 | 12.3% | 12.5% | 0.98 | 19,912 | 4.30 | +1.0% | 4.9% |

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
| city-hall:leavechain | 408 | 0 | 0.0% | 0 |
| graveyard:look | 1600 | 0 | 0.0% | 0 |
| reaper-club:buy:tiny | 900 | 0 | 0.0% | 0 |
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
| neg:soft | 3196727 | 1998.0 | 1600 | 100.0% |
| neg:card | 2571483 | 1607.2 | 1600 | 100.0% |
| neg:packages | 1082445 | 676.5 | 1600 | 100.0% |
| neg:listen | 1039102 | 649.4 | 1600 | 100.0% |
| desk:wait | 963039 | 601.9 | 1600 | 100.0% |
| neg:done | 757649 | 473.5 | 1600 | 100.0% |
| neg:hard | 548793 | 343.0 | 1600 | 100.0% |
| neg:coffee | 524110 | 327.6 | 1600 | 100.0% |
| neg:pkg:plot | 370994 | 231.9 | 1600 | 100.0% |
| prep:start | 319742 | 199.8 | 1600 | 100.0% |
| prep:choice | 319742 | 199.8 | 1600 | 100.0% |
| store:casket:0 | 182773 | 114.2 | 1600 | 100.0% |
| neg:bless | 175408 | 109.6 | 689 | 100.0% |
| neg:discount | 149094 | 93.2 | 1600 | 100.0% |
| neg:pkg:embalming | 106323 | 66.5 | 1600 | 100.0% |
| store:casket:1 | 103142 | 64.5 | 1600 | 100.0% |
| place:funeral-home | 99332 | 62.1 | 1600 | 100.0% |
| place:store | 89943 | 56.2 | 1600 | 100.0% |
| neg:guilt | 79568 | 49.7 | 1600 | 100.0% |
| risk:take | 62725 | 39.2 | 1600 | 99.0% |
| desk:quit | 48000 | 30.0 | 1600 | 100.0% |
| store:caskets | 47968 | 30.0 | 1600 | 100.0% |
| neg:pkg:headstone | 38718 | 24.2 | 1600 | 100.0% |
| place:church | 37894 | 23.7 | 1600 | 100.0% |
| neg:pkg:service | 37651 | 23.5 | 1600 | 100.0% |
| church:tithe | 37368 | 23.4 | 1600 | 100.0% |
| neg:pkg:flowers | 36634 | 22.9 | 1600 | 100.0% |
| place:reaper-club | 30958 | 19.3 | 1600 | 61.4% |
| place:hospital | 30143 | 18.8 | 1600 | 86.3% |
| place:graveyard | 29418 | 18.4 | 1600 | 100.0% |
| place:yangs | 24514 | 15.3 | 1600 | 55.1% |
| place:bank | 23189 | 14.5 | 1600 | 100.0% |
| church:bingo-card | 21669 | 13.5 | 667 | 100.0% |
| neg:sympathy | 21099 | 13.2 | 1600 | 99.9% |
| reaper-club:market | 20356 | 12.7 | 981 | 94.8% |
| competitors:visit | 20130 | 12.6 | 534 | 100.0% |
| place:city-hall | 19684 | 12.3 | 1600 | 100.0% |
| battle:attack | 19386 | 12.1 | 404 | 100.0% |
| neg:cremation | 19202 | 12.0 | 720 | 98.9% |
| parlor:upgrades | 18943 | 11.8 | 1600 | 100.0% |
| competitors:trydoor | 18919 | 11.8 | 534 | 100.0% |
| place:competitors | 17148 | 10.7 | 1600 | 33.4% |
| store:casket:2 | 16735 | 10.5 | 1600 | 92.4% |
| competitors:look | 16020 | 10.0 | 534 | 100.0% |
| church:bingo | 15797 | 9.9 | 1600 | 41.7% |
| bank:all-gold | 15783 | 9.9 | 1600 | 100.0% |
| place:cafe | 15568 | 9.7 | 1600 | 100.0% |
| graveyard:swing | 15484 | 9.7 | 404 | 100.0% |
| reaper-club:slots | 15269 | 9.5 | 133 | 100.0% |
| church:serve | 14280 | 8.9 | 553 | 100.0% |
| reaper-club:pay | 13842 | 8.7 | 957 | 100.0% |
| graveyard:monuments | 13638 | 8.5 | 1600 | 100.0% |
| neg:offer:accept | 12894 | 8.1 | 1600 | 99.8% |
| place:spirit-university | 12651 | 7.9 | 1600 | 100.0% |
| city-hall:chains | 12119 | 7.6 | 1600 | 33.4% |
| yangs:menu | 11438 | 7.1 | 557 | 100.0% |
| tutorial:next | 11200 | 7.0 | 1600 | 100.0% |
| competitors:attack | 11112 | 6.9 | 534 | 75.7% |
| hospital:lead | 10734 | 6.7 | 1380 | 19.1% |
| risk:decline | 10558 | 6.6 | 1600 | 82.9% |
| graveyard:duel | 10550 | 6.6 | 526 | 76.8% |
| spirit-university:psych | 10484 | 6.6 | 1600 | 99.6% |
| battle:yellwin | 9690 | 6.1 | 404 | 100.0% |
| city-hall:ordinance | 8879 | 5.5 | 1600 | 100.0% |
| hospital:treat | 8480 | 5.3 | 1374 | 94.9% |
| city-hall:inspection | 8128 | 5.1 | 1600 | 32.8% |
| yangs:tiger | 8010 | 5.0 | 882 | 30.3% |
| store:hearse | 7838 | 4.9 | 1600 | 98.7% |
| parlor:dig | 7103 | 4.4 | 302 | 89.7% |
| graveyard:rob | 7103 | 4.4 | 307 | 88.3% |
| graveyard:tend | 6782 | 4.2 | 613 | 19.9% |
| reaper-club:seance | 6741 | 4.2 | 288 | 100.0% |
| competitors:steal | 6694 | 4.2 | 534 | 100.0% |
| city-hall:vote | 6400 | 4.0 | 1600 | 100.0% |
| neg:offer:decline | 5570 | 3.5 | 1600 | 87.9% |
| arc:give:church | 5162 | 3.2 | 827 | 55.4% |
| graveyard:monument | 4844 | 3.0 | 1600 | 100.0% |
| arc:give:reaper-club | 4107 | 2.6 | 965 | 28.1% |
| store:hearse-look | 3919 | 2.4 | 1579 | 100.0% |
| store:buy | 3919 | 2.4 | 1579 | 100.0% |
| bank:savings | 2809 | 1.8 | 1600 | 7.7% |
| bank:loan | 2689 | 1.7 | 1600 | 15.7% |
| bank:borrow | 2689 | 1.7 | 251 | 100.0% |
| bank:repay | 2689 | 1.7 | 251 | 100.0% |
| yangs:dragon | 2532 | 1.6 | 882 | 27.4% |
| neg:raise | 2414 | 1.5 | 289 | 99.0% |
| neg:pkg:urn | 2258 | 1.4 | 707 | 64.5% |
| bank:deposit | 2155 | 1.3 | 123 | 100.0% |
| reaper-club:games | 2025 | 1.3 | 981 | 13.6% |
| reaper-club:buy:hot-casket | 1821 | 1.1 | 914 | 42.0% |
| reaper-club:buy:coroner-list | 1769 | 1.1 | 913 | 43.9% |
| arc:give:city-hall | 1745 | 1.1 | 972 | 34.1% |
| city-hall:election | 1723 | 1.1 | 1600 | 64.2% |
| spirit-university:strength | 1670 | 1.0 | 1600 | 25.3% |
| tutorial:start | 1600 | 1.0 | 1600 | 100.0% |
| parlor:buy:paint | 1600 | 1.0 | 1600 | 100.0% |
| parlor:buy:coffee-machine | 1600 | 1.0 | 1600 | 100.0% |
| parlor:buy:storeroom | 1593 | 1.0 | 1593 | 100.0% |
| parlor:buy:florist-cooler | 1488 | 0.9 | 1593 | 93.4% |
| city-hall:certify | 1472 | 0.9 | 525 | 84.4% |
| parlor:buy:viewing-room | 1433 | 0.9 | 1447 | 99.0% |
| bank:transferhome | 1364 | 0.9 | 1600 | 15.6% |
| bank:transfer | 1364 | 0.9 | 250 | 100.0% |
| bank:transfer-tier | 1364 | 0.9 | 250 | 100.0% |
| city-hall:permits | 1339 | 0.8 | 1600 | 49.8% |
| parlor:buy:embalming-lab | 1195 | 0.7 | 1552 | 77.0% |
| battle:yelllost | 1128 | 0.7 | 304 | 100.0% |
| hospital:leave-room | 1128 | 0.7 | 304 | 100.0% |
| city-hall:elect | 1016 | 0.6 | 1016 | 100.0% |
| reaper-club:hit | 981 | 0.6 | 981 | 36.8% |
| city-hall:invite | 975 | 0.6 | 303 | 46.2% |
| city-hall:lobby | 953 | 0.6 | 1600 | 8.6% |
| yangs:sparrow | 896 | 0.6 | 882 | 14.5% |
| reaper-club:buy:morty-rib | 861 | 0.5 | 906 | 29.7% |
| church:water | 774 | 0.5 | 923 | 35.5% |
| parlor:buy:incinerator | 724 | 0.5 | 1065 | 68.0% |
| spirit-university:hp | 672 | 0.4 | 1600 | 8.6% |
| city-hall:permit:signage | 668 | 0.4 | 796 | 83.9% |
| city-hall:permit:zoning | 663 | 0.4 | 796 | 83.3% |
| bank:withdrawall | 654 | 0.4 | 123 | 100.0% |
| reaper-club:buy:testimonials | 592 | 0.4 | 906 | 14.1% |
| reaper-club:buy:filed-tag | 565 | 0.4 | 866 | 27.9% |
| reaper-club:buy:used-wreaths | 516 | 0.3 | 900 | 14.9% |
| reaper-club:buy:sal-pad | 494 | 0.3 | 882 | 14.6% |
| city-hall:bribe | 480 | 0.3 | 137 | 100.0% |
| graveyard:shove | 471 | 0.3 | 404 | 63.1% |
| reaper-club:buy:real-water | 459 | 0.3 | 873 | 14.8% |
| graveyard:yield | 451 | 0.3 | 404 | 58.4% |
| parlor:buy:memorial-garden | 426 | 0.3 | 654 | 65.1% |
| parlor:rivalry | 409 | 0.3 | 1600 | 25.6% |
| parlor:buy:chapel | 407 | 0.3 | 412 | 98.8% |
| reaper-club:buy:bruno | 395 | 0.2 | 880 | 15.0% |
| reaper-club:buy:haunted-casket | 373 | 0.2 | 860 | 14.9% |
| reaper-club:buy:clover | 357 | 0.2 | 912 | 13.7% |
| parlor:buy:billboard | 352 | 0.2 | 667 | 52.8% |
| reaper-club:buy:riot-shield | 344 | 0.2 | 834 | 24.7% |
| reaper-club:buy:rabbit-foot | 329 | 0.2 | 900 | 13.9% |
| reaper-club:buy:vest | 329 | 0.2 | 905 | 14.4% |
| reaper-club:buy:tap-water | 300 | 0.2 | 908 | 13.1% |
| battle:run | 294 | 0.2 | 404 | 44.8% |
| reaper-club:buy:monster-scale | 282 | 0.2 | 888 | 12.3% |
| city-hall:join | 268 | 0.2 | 268 | 100.0% |
| parlor:rivalry:cutthroat | 267 | 0.2 | 409 | 65.3% |
| parlor:buy:guard-dog | 265 | 0.2 | 1593 | 16.6% |
| reaper-club:buy:cop-day-off | 263 | 0.2 | 781 | 13.1% |
| parlor:buy:alarm | 256 | 0.2 | 265 | 96.6% |
| parlor:markup | 253 | 0.2 | 1600 | 15.8% |
| reaper-club:buy:forged-permit | 223 | 0.1 | 861 | 13.9% |
| parlor:buy:night-watchman | 205 | 0.1 | 237 | 86.5% |
| reaper-club:buy:mayor-key | 174 | 0.1 | 827 | 13.2% |
| parlor:rivalry:peaceful | 142 | 0.1 | 409 | 34.7% |
| city-hall:found | 140 | 0.1 | 477 | 29.4% |
| parlor:markup:20 | 130 | 0.1 | 253 | 51.4% |
| city-hall:file | 127 | 0.1 | 127 | 100.0% |
| parlor:markup:10 | 123 | 0.1 | 253 | 48.6% |
| reaper-club:bodyguard | 114 | 0.1 | 980 | 8.8% |
| church:confess | 61 | 0.0 | 1229 | 4.4% |
| parlor:buy:mausoleum | 55 | 0.0 | 97 | 56.7% |
| city-hall:ads | 12 | 0.0 | 99 | 12.1% |
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
| city-hall:leavechain | 0 | 0.0 | 408 | 0.0% |
| graveyard:look | 0 | 0.0 | 1600 | 0.0% |
| reaper-club:buy:tiny | 0 | 0.0 | 900 | 0.0% |
| reaper-club:draw | 0 | 0.0 | 133 | 0.0% |
| reaper-club:shots | 0 | 0.0 | 133 | 0.0% |
| parlor:markup:-10 | 0 | 0.0 | 253 | 0.0% |
| parlor:markup:30 | 0 | 0.0 | 253 | 0.0% |
| parlor:markup:0 | 0 | 0.0 | 253 | 0.0% |
| bank:depositall | 0 | 0.0 | 123 | 0.0% |
| bank:withdraw | 0 | 0.0 | 123 | 0.0% |

## What only human playtesting can answer

The bots play every system from the same committed strategies each season, so these numbers say how often the game offers something, not whether a person enjoys it. Drawn from this run:

- **Is a day too long?** A bot answers 352 screens a day, 191 of them choices, for 16.1 customers. A person reads faster than a bot looks but also hesitates; only a playtest says whether 191 choices a day is fun or a chore, and whether the hand and package panes should be on the main screen.
- **Walkout pacing.** 0.1% of 774,997 customers walked out. Bots stop pushing before the mood does, so this is the floor; a person who misreads a customer, or is greedy for the exact match (24.6% of the bots' sales), will see far more. Whether a walkout feels like a fair lesson or a punishment is not measurable here.
- **How often the town speaks.** News changed the rules on 57.2% of days, a weather set on 100.0%, and a story arc was running on 62.8% of days (3.0 arcs and 6.2 story beats a town a season). Bots read none of it as a story; whether that is too much, too little, or repeats itself by day 20 needs readers.
- **Is the election a contest?** 0.64 candidates stood in each of 200 elections and 8.0 parlors voted: the bots vote by a preference list. Whether people campaign, lobby or bluff is a social question.
- **Ordinances and arcs by effect, not by rote.** The bots rank ordinances from a fixed list (800 ballots, 8.00 votes each, 953 lobbying votes bought). Do players read the effects and choose, or click the first?
- **Grudges and bluffing.** 8,618 duels and 787 hits happened with no memory of who did what to whom. Retaliation, alliances and the Peace Pledge as a social contract are for people.
- **Wording.** The bots read panels and button ids, and `packages/bots/test/scrambled.test.ts` plays a season with every pack string reworded and sees no stuck day; that proves the text does not carry rules, not that it is funny, clear or tonally right.

