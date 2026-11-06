# Balance report: expanded rules

## What it says about the Expanded design

*Hand-written reading of the generated tables below (regenerating with `pnpm --filter @fq/sim run sim -- --days 30 --towns 200 --players 8 --rules expanded --seed 1 --challenges 6 --out docs/balance/expanded-baseline` overwrites this file; keep this section, or rebuild the tables alone with `pnpm --filter @fq/sim exec tsx src/remark.ts ../../docs/balance/expanded-baseline`, which keeps it). 200 towns of 8 hard bots drawn from the twelve `@fq/bots` personalities, a 30-day season with the built-in `expandedPack`. This is the run after the balance round of `expanded-tuning-log.md` (rounds 13 to 16) and the engine gaps before it (the bots now see a hit-man rumour as data and five personalities hire protection). Comparison runs, 60 towns each, same base seed, not saved: a ninth bot joining on day 10, and mixed difficulty. The oracle and no-fighter comparisons were not re-run (reading 9 keeps the older figure and says so). "Before" is the bots-pass baseline this file replaced.*

**Checks: all passed** in every run: no invariant breaks, no offered button rejected, no stuck bot-day, no error, none of the conservation signatures. Classic's simulator report for a fixed seed (60 towns, seed 7) is byte-identical before and after this work except its run time.

### The targets

| target | before | after | met? |
| --- | --- | --- | --- |
| no personality above about 2x its fair share of wins, none below a third | necromancer 2.51, tycoon 2.15, politician 1.91, shark 1.78, pacifist 1.41, builder 0.50, gambler 0.48, saboteur 0.41, saint 0.39, organiser 0.29, scholar 0.17, Soft Touch 0.06 | politician 2.67, necromancer 2.45, pacifist 1.35, tycoon 1.24, shark 0.92, gambler 0.84, saint 0.72, builder 0.62, Soft Touch 0.44, saboteur 0.29, scholar 0.28, organiser 0.17 | **no**: two above 2, three below a third (was two and four); see 1 |
| the same field read by mean place and mean BP (reported alongside, not a new target) | mean place 2.42 (tycoon) to 6.15 (saboteur); means 18,206 to 20,878 (2,672 BP, sd 642), -6.1% to +5.0% of the town mean | mean place 2.75 (politician) to 6.26 (saboteur); means 17,897 to 20,486 (2,589 BP, sd 678), -7.0% to +4.3%; ten of twelve within 3% of their towns' mean | tighter at the top (the tycoon's lead fell from +5.0% to +4.2%), the saboteur a little lower |
| good and evil within a few percent | BP: good +0.2%, evil -4.0%; wins: evil 1.42x | BP against the town mean: good +1.0%, neutral +0.8%, evil -3.8%; wins: evil 1.29x, good 1.23x, neutral 0.70x | **on wins closer** (evil 1.42 -> 1.29), on BP unchanged: evil is the two fighters (see 4) |
| no single purchase dominant, no system dead | Billboard 0.031 BP a dollar (three times a monument); Night Watchman and Memorial Garden returned nothing | Billboard 0.009, Night Watchman 0.010, Memorial Garden 0.007, monuments 0.009, tithes 0.009 | **yes** (see 3) |
| skill worth clearly more than luck | hard +16% over easy | mixed towns: hard 19,544, easy 16,748 (+16.7%), easy never wins; Daily Challenge hard 420, easy 364 against a day-to-day luck of about 44 | yes |
| a day-10 starter reaches mid-table (5.0 of 9) | 5.95 | **5.10**, 58% in the top half, 19,573 BP against a town median of 19,536 | **yes** (see 5) |
| the leader's margin over the median stays moderate | 1.07x | 1.07x | yes |
| PvP-heavy play viable, peaceful play not miserable | fighters -2.6% of the field, 1.29x their share; most-targeted peaceful parlor lost 4.5% | fighters -2.9% of their towns' mean, 1.11x their share; most-targeted peaceful parlor loses 4.1% (worst town 8.2%), finishes 2.71st | yes |
| a small house edge | slots 0.957 / 1.081 / 0.909 | slots 0.796 / 0.696 / 0.858 at $100 / $1,000 / $500 over 15,317 plays | the exact return (0.976) is tested in core; this run drew few jackpots (a 500x line is 1 in 4,096 and carries 0.12 of the return); no house rule changed |
| loans cannot be turned into points | 2,668 loans, none defaulted | 2,669 loans (builder, tycoon), none defaulted | yes |
| a full but not grindy day | 351 screens, 191 choices, 16.1 customers | the same (no rule here touches the day's length) | see 7 |

### Reading

1. **The win-share target is still not met, and the reason is now clearer.** The round moved what numbers can move: the tycoon's lead was its five monuments (only it and the shark could afford tiers 4 and 5) and its markup; with those cut it fell from 2.15 to 1.24 and from +5.0% to +4.2% of its town's mean. The two above 2 are now the politician (2.67, +4.3%, sd 4.9%) and the necromancer (2.45, -2.2%, sd 12.0%). They are opposite cases. The politician is simply the best seller among the bots (sale BP per turn 35.8, the most exact matches, the good path's calm customers) with a small spread, so a mean 4% up wins a third of all towns; its own perks (mayor +1 rating now, certificates, a chain's +4) move the income roll by a fraction of a point each and did not move it in any round, and the rating divisor (7 instead of 6, round 16) made it worse, not better. The necromancer is the reverse: below the field on average, but its season swings three times as wide as a seller's (sd 12% of the town mean), and in a field this tight the swings win towns. Its multiplier went from x1.25 to x1.15; at x1.10 it fell to 1.46 but the saboteur, who is in the same karma band and lives on fights, fell to 0.11, so x1.15 is the compromise. Across 100-town rounds with unchanged necromancer numbers its share moved between 1.46 and 2.14: with 70 to 130 seats of that variance, one win moves it by 0.1 to 0.2. At the bottom the organiser (0.17), scholar (0.28) and saboteur (0.29) sit at -0.8%, -0.1% and -7.0% of their towns: the two sellers are at the mean and still almost never win, which is the tight-field effect, not a rule that cheats them.
2. **Is win share the right target?** Read by mean place and mean BP the field is fair: ten of twelve personalities finish within 3% of their towns' mean (the exceptions are the two pure fighters at -2.8% and -7.0%), and mean places run from 2.75 to 6.26. Win share in an eight-seat field is decided by the top of each personality's distribution, so it punishes low variance as much as a low mean: a seller with sd 4% at the town mean wins about a fifth of its share. Meeting the target for every seller would need either their means 2 to 3% above the fighters' (then the fighters never win) or more variance for the sellers. The round tried the second idea as a rule (below, "consistency scoring") and the data said no. The target is kept as written and is reported as missed; mean place and spread are given next to it.
3. **No purchase dominates now, none is dead.** Measured as the difference of differences against the same personality's seats on the same day that did not yet own it: the Billboard ($21,500 with its permit, income +7) returns 0.009 BP a dollar (was 0.031), the Night Watchman ($12,000, security 3 and income +5) 0.010 (was nothing), the Memorial Garden ($24,000 with its permit, patience +2 and income +4) 0.007 (was nothing), monuments 0.009, tithes 0.009. The Watchman and the Garden are still bought late (day 26) because the bots list them late; their per-day return once owned (+27 and +43 BP) is now real. Rating alone cannot make a late upgrade pay (a point of rating moves the income roll by a sixth of a point), which is why both now shift the income roll.
4. **Karma paths.** On wins: evil 1.29 (was 1.42), good 1.23, neutral 0.70. On BP against the town mean: good +1.0%, neutral +0.8%, evil -3.8%. Evil is the necromancer and the saboteur (and some sharks and gamblers): the lowest mean and the widest spread, so it wins slightly more than its share; neutral is the steady sellers of reading 1.
5. **Late starters reach the middle.** With `underdog.late.money` (a new rule: $1,500 a season day already played, so $13,500 for a day-10 parlor) the joiner buys its first upgrades in time and finishes 5.10th of 9 (was 5.95), with 58% in the top half and the median's BP. Established parlors that trail are unchanged.
6. **Hits now have counterplay.** The rumour a lucky target hears is data on the View (`Hud.warnings`); the scholar, tycoon, politician, organiser and builder answer it the same day: 136 bodyguards and 304 vests bought. Hits resolved 797, landed 586 (was 827 / 686): 74% land against 83%. Hits still return 0.004 BP of the victim's per dollar and 95 to 98% of hirers are behind their target: a grudge, not a points engine.
7. **The day is still long.** 351 screens a bot-day, 191 of them choices, for 16.1 customers. Nothing here shortens it; proposals that cut decisions without cutting depth are below, not applied.
8. **Consistency scoring (tried, taken out).** The brief suggested rewarding steady sellers at the end of the season, for example for customer satisfaction. The simulator now counts happy families: the good path leaves 46 to 49% of families happy, everyone else 28 to 33%, and the sellers who trail (organiser 31%, scholar 28%, builder 30%) are lowest. A happy-family bonus (`scoring.happyShare`) was written and tested and would have paid the politician and the pacifist, already at or above their share. A sale-streak bonus has the same problem from the other side: every bot sells every day and walks out almost nobody (0.1%), so a streak pays everyone alike. Neither went in.
9. **Hidden information and no-fighter towns** (previous baselines, not re-run): the oracle makes about 13% more a customer and finishes 11.6% higher; without fighters the same parlors finish about 4% higher.

### Recommended next tuning and proposals (for the owner to decide; nothing here was applied)

| proposal | evidence |
| --- | --- |
| Accept win share as missed for a tight field and judge the Expanded balance on mean place and BP against the town mean (both within the bands above), or widen the sellers' variance by design (for example a larger closeness bonus with a smaller base, so a careful seller's best seasons stand out) | reading 1 and 2 |
| The politician: if it must come down, the lever is selling, not office: `scoring.exact.share` 0.5 -> 0.4 costs it about 1.6% and the builder 1.2% (it lands 29% exact against 21 to 24% for the neutral sellers) | sale BP per turn 35.8, exact 29% |
| The necromancer's variance: a per-day cap on parlor-fight BP gained (for example 150), so a lucky run of fights cannot swing a season, rather than a smaller multiplier (which drags the saboteur down with it) | sd 12% of the town mean against 4 to 5% for sellers |
| Let the bots buy the Night Watchman and the Memorial Garden earlier (personality lists in `@fq/bots`): their return once owned is now real, but they are still bought on day 26 | reading 3 |
| Shorter days without less depth (changes how the game feels; not applied): a standing order at Di-Mart (keep the storeroom at a chosen mix each morning: about 11 store screens a day become one choice a season), a default for body preparation that follows the player's karma path (one press instead of a choice after 40% of sales, with the full choice one tap away), the hand of soft-sell cards and the packages shown on the negotiation screen instead of separate panes (about 5 pane changes a customer), and reading all mail on one screen | 351 screens, 191 choices for 16 customers a day |

### What the bots cannot tell us

See the last section of the generated tables, "What only human playtesting can answer".

---

Generated by `@fq/sim`: 200 towns of 8 bots, 30 days each, difficulty hard, base seed 1. 16,849,548 actions in 1865 s.

**Checks: passed.** No invariant breaks, rejected offered buttons, exploit signatures or stuck bots.

## Win rate by personality

| personality | seats | wins | win rate | fair share | mean final BP | mean place |
| --- | --- | --- | --- | --- | --- | --- |
| politician | 138 | 46 | 33.3% | 12.5% | 20448.3 | 2.75 |
| necromancer | 134 | 41 | 30.6% | 12.5% | 19156.2 | 4.64 |
| pacifist | 142 | 24 | 16.9% | 12.5% | 19976.8 | 4.12 |
| tycoon | 123 | 19 | 15.4% | 12.5% | 20485.7 | 2.78 |
| shark | 130 | 15 | 11.5% | 12.5% | 19491.9 | 4.56 |
| gambler | 133 | 14 | 10.5% | 12.5% | 19068.6 | 5.42 |
| saint | 122 | 11 | 9.0% | 12.5% | 19981.7 | 4.06 |
| builder | 128 | 10 | 7.8% | 12.5% | 20123.8 | 3.82 |
| mourner | 128 | 7 | 5.5% | 12.5% | 19389.3 | 5.16 |
| saboteur | 137 | 5 | 3.6% | 12.5% | 17896.8 | 6.26 |
| scholar | 145 | 5 | 3.4% | 12.5% | 19645.5 | 4.93 |
| organiser | 140 | 3 | 2.1% | 12.5% | 19485.6 | 5.30 |

## BP by personality

BP/turn counts only turns spent on customers; BP/day includes risks, events, mail rewards and battles.

| personality | player-days | BP/day | BP/turn | sale BP/turn | fight BP/day | turns/day | sales/day | walkouts | exact | within 3% | within 8% | bonus share of sale BP | price/limit | risks taken | risk BP/day |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tycoon | 3690 | 689.5 | 41.29 | 34.94 | 0.0 | 16.7 | 16.4 | 0.0% | 24.0% | 16.6% | 9.9% | 23.6% | 0.74 | 94.8% | 66.4 |
| politician | 4140 | 677.5 | 42.86 | 35.78 | 0.0 | 15.8 | 15.5 | 0.0% | 29.1% | 18.6% | 10.4% | 26.4% | 0.78 | 91.4% | 59.4 |
| builder | 3840 | 672.5 | 39.47 | 33.65 | 0.0 | 17.0 | 16.7 | 0.0% | 20.9% | 15.5% | 9.7% | 21.7% | 0.72 | 95.7% | 70.4 |
| saint | 3660 | 663.5 | 42.87 | 34.53 | 0.0 | 15.5 | 15.2 | 0.0% | 27.4% | 17.7% | 9.9% | 25.8% | 0.76 | 89.9% | 58.6 |
| shark | 3900 | 662.3 | 37.90 | 34.08 | 0.0 | 17.5 | 17.1 | 0.4% | 22.2% | 16.0% | 9.2% | 23.1% | 0.72 | 81.1% | 52.5 |
| scholar | 4350 | 656.9 | 39.33 | 33.73 | 0.0 | 16.7 | 16.4 | 0.0% | 24.3% | 16.4% | 9.5% | 24.6% | 0.73 | 94.2% | 66.2 |
| pacifist | 4260 | 655.5 | 41.07 | 33.74 | 0.0 | 16.0 | 15.6 | 0.0% | 28.4% | 18.1% | 10.3% | 27.4% | 0.77 | 87.1% | 56.5 |
| organiser | 4200 | 653.6 | 39.01 | 33.37 | 0.0 | 16.8 | 16.4 | 0.0% | 23.1% | 16.3% | 9.8% | 23.5% | 0.73 | 93.3% | 63.7 |
| mourner | 3840 | 642.0 | 40.68 | 34.18 | 0.0 | 15.8 | 15.5 | 0.0% | 26.7% | 16.8% | 10.0% | 25.1% | 0.75 | 85.7% | 56.9 |
| gambler | 3990 | 639.7 | 40.66 | 33.48 | 21.7 | 15.7 | 15.5 | 0.1% | 25.8% | 18.1% | 11.9% | 25.4% | 0.77 | 73.9% | 43.1 |
| necromancer | 4020 | 636.3 | 40.57 | 32.83 | 32.6 | 15.7 | 15.4 | 0.1% | 24.9% | 17.9% | 11.7% | 25.0% | 0.77 | 64.7% | 39.1 |
| saboteur | 4110 | 585.5 | 39.97 | 25.81 | 130.1 | 14.6 | 14.4 | 0.0% | 15.5% | 11.8% | 9.6% | 20.0% | 0.66 | 70.8% | 40.9 |

## BP by psych level (as the stats sheet shows it, at the start of the day)

| psych | player-days | BP/day | BP/turn | sale BP/turn | fight BP/day | turns/day | sales/day | walkouts | exact | within 3% | within 8% | bonus share of sale BP | price/limit | risks taken | risk BP/day |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 6634 | 495.0 | 33.08 | 25.77 | 63.1 | 15.0 | 14.9 | 0.1% | 16.3% | 11.8% | 9.7% | 20.5% | 0.67 | 61.4% | 33.3 |
| 2 | 1665 | 443.8 | 29.35 | 26.05 | 12.7 | 15.1 | 14.9 | 0.1% | 17.7% | 12.3% | 10.5% | 21.2% | 0.69 | 61.1% | 28.6 |
| 3 | 3040 | 521.1 | 34.19 | 28.32 | 31.4 | 15.2 | 15.0 | 0.1% | 20.0% | 13.9% | 10.6% | 22.6% | 0.71 | 75.7% | 37.8 |
| 4 | 7694 | 568.7 | 35.52 | 30.25 | 6.2 | 16.0 | 15.6 | 0.1% | 22.7% | 15.4% | 10.7% | 24.2% | 0.73 | 85.8% | 51.1 |
| 5 | 4280 | 598.3 | 36.78 | 31.52 | 2.7 | 16.3 | 15.9 | 0.0% | 24.0% | 16.3% | 10.3% | 24.8% | 0.74 | 92.3% | 60.6 |
| 6 | 4723 | 656.7 | 39.73 | 33.66 | 8.0 | 16.5 | 16.1 | 0.1% | 26.4% | 17.4% | 11.1% | 25.6% | 0.76 | 86.0% | 60.5 |
| 7 | 4116 | 721.2 | 43.23 | 36.15 | 7.6 | 16.7 | 16.3 | 0.1% | 27.6% | 18.7% | 10.2% | 25.7% | 0.77 | 90.9% | 67.9 |
| 8 | 15848 | 801.8 | 48.03 | 38.95 | 5.6 | 16.7 | 16.3 | 0.0% | 28.3% | 19.4% | 9.6% | 25.2% | 0.78 | 95.3% | 68.9 |

## The exact match

184973 of 759306 sales (24.4%) hit the spending limit exactly: 115.61 per player per 30 days. All closeness bonuses (exact, within 3%, within 8%) are the "bonus share" column above.

## Wait for Customer outcomes

| outcome | count | share |
| --- | --- | --- |
| customer | 774917 | 80.5% |
| event | 74873 | 7.8% |
| risk | 73320 | 7.6% |
| script | 39938 | 4.1% |
| noTurns | 0 | 0.0% |

## Tags

Income by source:

| category | gold-tag equivalents | share |
| --- | --- | --- |
| sales | 447207.3 | 93.6% |
| theft | 15970.3 | 3.3% |
| bonus tag | 11588.5 | 2.4% |
| other | 1712.5 | 0.4% |
| received | 1000.5 | 0.2% |
| black market | 545.0 | 0.1% |

Spending and losses by use:

| category | gold-tag equivalents | share |
| --- | --- | --- |
| psych | 165108.0 | 51.6% |
| hearse | 83393.0 | 26.1% |
| strength | 24009.0 | 7.5% |
| stolen | 15970.3 | 5.0% |
| hp | 14836.0 | 4.6% |
| club cover | 6937.8 | 2.2% |
| arson | 4452.0 | 1.4% |
| bingo | 2458.0 | 0.8% |
| transfers | 1334.0 | 0.4% |
| burned | 1283.8 | 0.4% |

| personality | arson | bingo | burned | club cover | hearse | hp | psych | stolen | strength | transfers |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gambler | 0.0 | 2400.5 | 144.5 | 989.8 | 9042.0 | 0.0 | 14896.0 | 1712.3 | 4788.0 | 0.0 |
| shark | 0.0 | 0.0 | 328.0 | 1625.5 | 16120.0 | 0.0 | 14224.0 | 1754.8 | 0.0 | 0.0 |
| saint | 0.0 | 57.5 | 30.5 | 1077.5 | 4148.0 | 0.0 | 13664.0 | 1398.8 | 0.0 | 576.0 |
| scholar | 0.0 | 0.0 | 30.8 | 1438.3 | 10005.0 | 0.0 | 16240.0 | 952.0 | 0.0 | 0.0 |
| mourner | 0.0 | 0.0 | 55.8 | 0.0 | 8832.0 | 0.0 | 14336.0 | 768.3 | 0.0 | 758.0 |
| politician | 0.0 | 0.0 | 103.0 | 27.8 | 4692.0 | 0.0 | 15456.0 | 2153.8 | 0.0 | 0.0 |
| organiser | 0.0 | 0.0 | 111.8 | 9.3 | 4760.0 | 0.0 | 15680.0 | 983.0 | 0.0 | 0.0 |
| builder | 0.0 | 0.0 | 29.3 | 12.5 | 8832.0 | 0.0 | 14336.0 | 880.0 | 0.0 | 0.0 |
| pacifist | 0.0 | 0.0 | 0.0 | 0.0 | 4828.0 | 0.0 | 15904.0 | 0.0 | 0.0 | 0.0 |
| necromancer | 0.0 | 0.0 | 419.8 | 97.5 | 4556.0 | 0.0 | 15008.0 | 2237.8 | 7236.0 | 0.0 |
| tycoon | 0.0 | 0.0 | 30.5 | 1513.8 | 4182.0 | 0.0 | 13776.0 | 1122.0 | 0.0 | 0.0 |
| saboteur | 4452.0 | 0.0 | 0.0 | 146.0 | 3396.0 | 14836.0 | 1588.0 | 2007.8 | 11985.0 | 0.0 |

## PvP

| measure | value |
| --- | --- |
| visits (doors reached) | 19020 |
| visits per player-day | 0.40 |
| refused at the door (online, police, locked) | 1106 |
| thefts | 6721 |
| tags per theft | 1.46 |
| battles started | 11193 |
| attacker wins / losses | 9830 / 1075 (90.1%) |
| BP won by winning attackers | 794331 |
| BP lost by losing attackers | 41957 |
| arsons hired / stopped by a smoke detector | 742 / 0 |
| Cursed Tigers / Lucky Sparrows / Lucky Dragons | 8010 / 896 / 2360 |

BP lost to other parlors' attacks, per player-day, by the victim's personality:

| personality | BP lost per day |
| --- | --- |
| shark | 19.9 |
| necromancer | 13.7 |
| gambler | 13.6 |
| tycoon | 11.4 |
| politician | 8.9 |
| organiser | 8.0 |
| builder | 6.9 |
| scholar | 6.9 |
| saint | 6.8 |
| mourner | 3.1 |
| saboteur | 0.4 |

## Snowball

At the end the leader has 1.07x the median parlor's BP.

| after day | leader went on to win |
| --- | --- |
| 1 | 23.0% |
| 3 | 26.0% |
| 5 | 30.0% |
| 10 | 42.5% |
| 15 | 48.5% |
| 20 | 66.0% |
| 25 | 76.5% |

| leader after day | builder | gambler | mourner | necromancer | organiser | pacifist | politician | saboteur | saint | scholar | shark | tycoon |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 21 | 19 | 10 | 20 | 21 | 9 | 20 | 15 | 12 | 14 | 21 | 18 |
| 5 | 17 | 12 | 9 | 8 | 19 | 12 | 34 | 7 | 20 | 18 | 19 | 25 |
| 10 | 13 | 3 | 13 | 17 | 12 | 14 | 54 | 14 | 27 | 10 | 8 | 15 |
| 15 | 11 | 4 | 11 | 19 | 6 | 20 | 58 | 13 | 30 | 7 | 7 | 14 |
| 20 | 7 | 6 | 14 | 35 | 4 | 29 | 52 | 10 | 21 | 3 | 10 | 9 |
| 25 | 9 | 9 | 10 | 38 | 5 | 32 | 40 | 5 | 15 | 8 | 8 | 21 |
| 30 | 10 | 14 | 7 | 41 | 3 | 24 | 46 | 5 | 11 | 5 | 15 | 19 |

| day | leader BP | runner-up | median | leader / median | lead over runner-up |
| --- | --- | --- | --- | --- | --- |
| 1 | 542.2 | 472.3 | 405.0 | 1.34 | 69.9 |
| 5 | 2676.8 | 2482.2 | 2214.1 | 1.21 | 194.6 |
| 10 | 5765.6 | 5433.1 | 5007.6 | 1.15 | 332.5 |
| 15 | 9189.6 | 8767.6 | 8197.5 | 1.12 | 421.9 |
| 20 | 13009.0 | 12473.0 | 11866.3 | 1.10 | 536.0 |
| 25 | 17168.0 | 16518.9 | 15883.1 | 1.08 | 649.1 |
| 30 | 21375.2 | 20645.3 | 19960.7 | 1.07 | 729.9 |

## Expanded: win rate by personality

| personality | seats | wins | win rate | fair share | win / fair | mean final BP | mean place | BP vs town mean | sd of that |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| politician | 138 | 46 | 33.3% | 12.5% | 2.67 | 20,448 | 2.75 | +4.3% | 4.9% |
| necromancer | 134 | 41 | 30.6% | 12.5% | 2.45 | 19,156 | 4.64 | -2.2% | 12.0% |
| pacifist | 142 | 24 | 16.9% | 12.5% | 1.35 | 19,977 | 4.12 | +1.9% | 5.2% |
| tycoon | 123 | 19 | 15.4% | 12.5% | 1.24 | 20,486 | 2.78 | +4.2% | 3.5% |
| shark | 130 | 15 | 11.5% | 12.5% | 0.92 | 19,492 | 4.56 | -0.0% | 7.2% |
| gambler | 133 | 14 | 10.5% | 12.5% | 0.84 | 19,069 | 5.42 | -2.8% | 7.4% |
| saint | 122 | 11 | 9.0% | 12.5% | 0.72 | 19,982 | 4.06 | +1.8% | 4.3% |
| builder | 128 | 10 | 7.8% | 12.5% | 0.63 | 20,124 | 3.82 | +2.2% | 3.9% |
| mourner | 128 | 7 | 5.5% | 12.5% | 0.44 | 19,389 | 5.16 | -0.9% | 5.2% |
| saboteur | 137 | 5 | 3.6% | 12.5% | 0.29 | 17,897 | 6.26 | -7.0% | 9.1% |
| scholar | 145 | 5 | 3.4% | 12.5% | 0.28 | 19,645 | 4.93 | -0.1% | 4.4% |
| organiser | 140 | 3 | 2.1% | 12.5% | 0.17 | 19,486 | 5.30 | -0.8% | 4.0% |

Spread: mean final BP from 17,897 to 20,486 (2,589 BP, sd 678 around 19,596); mean place from 2.75 to 6.26.

## Expanded: win rate by karma path (at the end of the season)

| path | seats | wins | win rate | fair share | win / fair | mean final BP | mean place | BP vs town mean | sd of that |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| evil | 305 | 49 | 16.1% | 12.5% | 1.29 | 18,706 | 5.27 | -3.8% | 10.7% |
| good | 573 | 88 | 15.4% | 12.5% | 1.23 | 19,785 | 4.26 | +1.0% | 6.0% |
| neutral | 722 | 63 | 8.7% | 12.5% | 0.70 | 19,802 | 4.36 | +0.8% | 5.3% |

| rivalry tier | seats | wins | win rate | fair share | win / fair | mean final BP | mean place | BP vs town mean | sd of that |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| peaceful | 142 | 24 | 16.9% | 12.5% | 1.35 | 19,977 | 4.12 | +1.9% | 5.2% |
| standard | 1191 | 156 | 13.1% | 12.5% | 1.05 | 19,745 | 4.34 | +0.6% | 6.6% |
| cutthroat | 267 | 20 | 7.5% | 12.5% | 0.60 | 18,673 | 5.43 | -3.6% | 8.9% |

| PvP | seats | wins | win rate | fair share | win / fair | mean final BP | mean place | BP vs town mean | sd of that |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fights (parlor, duel or hit) | 518 | 72 | 13.9% | 12.5% | 1.11 | 18,922 | 5.20 | -2.9% | 9.4% |
| never fights | 1082 | 128 | 11.8% | 12.5% | 0.95 | 19,905 | 4.16 | +1.4% | 5.2% |

## Expanded: the parlors at the end of the season

| personality | final BP | cash | savings | karma | good / evil | upgrades | monuments | in a chain | mayor | BP lost to PvP | decisions / day | turns / day |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| builder | 20,124 | 12,572 | 0 | 49 | 0.0% / 0.0% | 7.8 | 3.1 | 65.6% | 0.0% | 425 | 344 | 17.1 |
| gambler | 19,069 | 6,350 | 0 | 60 | 27.8% / 0.0% | 6.8 | 2.7 | 0.0% | 0.0% | 635 | 364 | 16.5 |
| mourner | 19,389 | 3,655 | 0 | 100 | 100.0% / 0.0% | 8.3 | 2.1 | 70.3% | 0.0% | 210 | 342 | 16.7 |
| necromancer | 19,156 | 17,599 | 0 | 1 | 0.0% / 100.0% | 6.7 | 3.3 | 0.0% | 0.0% | 715 | 365 | 17.2 |
| organiser | 19,486 | 22,375 | 0 | 50 | 2.1% / 0.0% | 8.0 | 3.5 | 100.0% | 0.0% | 413 | 335 | 16.8 |
| pacifist | 19,977 | 20,586 | 0 | 100 | 100.0% / 0.0% | 7.0 | 3.2 | 0.0% | 0.0% | 0 | 354 | 16.9 |
| politician | 20,448 | 3,594 | 0 | 100 | 100.0% / 0.0% | 5.2 | 2.3 | 68.1% | 94.2% | 525 | 362 | 16.7 |
| saboteur | 17,897 | 8,576 | 0 | 1 | 0.0% / 100.0% | 8.7 | 2.8 | 0.0% | 0.0% | 110 | 305 | 16.2 |
| saint | 19,982 | 2,734 | 0 | 100 | 100.0% / 0.0% | 3.3 | 1.7 | 0.0% | 0.0% | 414 | 346 | 16.4 |
| scholar | 19,645 | 7,939 | 0 | 49 | 1.4% / 0.0% | 8.1 | 2.9 | 0.0% | 0.0% | 367 | 335 | 16.7 |
| shark | 19,492 | 41,850 | 0 | 34 | 0.0% / 26.2% | 8.4 | 4.4 | 0.0% | 0.0% | 740 | 404 | 17.5 |
| tycoon | 20,486 | 67,041 | 0 | 48 | 0.8% / 0.0% | 8.0 | 5.0 | 0.0% | 0.0% | 653 | 360 | 16.7 |

Decisions per bot-day across the town: 351 screens answered from log on to log off (the newspaper, every look at the hand of cards, every Back and every walk across the map included), of which 191 are choices (a pitch, a purchase, a vote: anything but looking and walking), for 16.1 customers a day.

## Expanded: selling

| personality | sales / day | walkouts | exact | within 3% | within 8% | bonus share of sale BP | sale BP / customer | money / sale | actions / sale | cremations | listened | coffee | blessed | happy families | sour families |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| builder | 16.7 | 0.0% | 20.9% | 15.5% | 9.7% | 21.7% | 33.7 | 906 | 7.1 | 1.0% | 81.8% | 68.4% | 0.0% | 30.4% | 38.9% |
| gambler | 15.5 | 0.1% | 25.8% | 18.1% | 11.9% | 25.4% | 33.5 | 674 | 7.4 | 0.5% | 86.7% | 72.3% | 2.8% | 32.7% | 34.8% |
| mourner | 15.5 | 0.0% | 26.7% | 16.8% | 10.0% | 25.1% | 34.2 | 583 | 8.0 | 0.0% | 77.9% | 64.7% | 66.0% | 48.8% | 25.3% |
| necromancer | 15.4 | 0.1% | 24.9% | 17.9% | 11.7% | 25.0% | 32.8 | 890 | 7.4 | 2.1% | 86.7% | 72.4% | 0.8% | 31.0% | 36.0% |
| organiser | 16.4 | 0.0% | 23.1% | 16.3% | 9.8% | 23.5% | 33.4 | 857 | 7.0 | 1.6% | 79.7% | 66.1% | 0.2% | 30.3% | 40.6% |
| pacifist | 15.6 | 0.0% | 28.4% | 18.1% | 10.3% | 27.4% | 33.7 | 832 | 8.4 | 1.8% | 81.6% | 68.6% | 70.4% | 48.6% | 31.9% |
| politician | 15.5 | 0.0% | 29.1% | 18.6% | 10.4% | 26.4% | 35.8 | 492 | 8.6 | 0.0% | 85.1% | 74.9% | 75.5% | 48.7% | 29.8% |
| saboteur | 14.4 | 0.0% | 15.5% | 11.8% | 9.6% | 20.0% | 25.8 | 714 | 5.8 | 0.5% | 76.3% | 62.7% | 0.0% | 27.8% | 44.3% |
| saint | 15.2 | 0.0% | 27.4% | 17.7% | 9.9% | 25.8% | 34.5 | 604 | 8.0 | 0.0% | 79.3% | 69.6% | 69.2% | 46.0% | 30.8% |
| scholar | 16.4 | 0.0% | 24.3% | 16.4% | 9.5% | 24.6% | 33.7 | 711 | 7.1 | 0.2% | 77.7% | 64.1% | 0.0% | 27.9% | 46.5% |
| shark | 17.1 | 0.4% | 22.2% | 16.0% | 9.2% | 23.1% | 34.1 | 1,661 | 7.8 | 11.4% | 92.3% | 78.3% | 0.0% | 32.6% | 34.6% |
| tycoon | 16.4 | 0.0% | 24.0% | 16.6% | 9.9% | 23.6% | 34.9 | 1,541 | 7.6 | 4.0% | 83.1% | 69.8% | 0.1% | 31.5% | 39.3% |

Walkouts by trait (all customers who had the trait, hidden or shown):

| trait | customers | walkouts | rate |
| --- | --- | --- | --- |
| nervous | 43910 | 66 | 0.2% |
| hurry | 42898 | 62 | 0.1% |
| heir | 45305 | 43 | 0.1% |
| sentimental | 44122 | 40 | 0.1% |
| grudge | 42704 | 37 | 0.1% |
| loudmouth | 43586 | 35 | 0.1% |
| hothead | 43695 | 35 | 0.1% |
| estranged | 41837 | 32 | 0.1% |
| shutterbug | 44734 | 34 | 0.1% |
| foodie | 44686 | 32 | 0.1% |
| no-nonsense | 43751 | 31 | 0.1% |
| showoff | 47814 | 33 | 0.1% |
| executor | 42306 | 29 | 0.1% |
| rivalry | 44574 | 30 | 0.1% |
| animal-lover | 44640 | 30 | 0.1% |
| death-fan | 46983 | 31 | 0.1% |
| windfall | 43016 | 28 | 0.1% |
| minimalist | 42791 | 27 | 0.1% |
| music-lover | 44542 | 28 | 0.1% |
| relieved | 41962 | 26 | 0.1% |
| devout | 46028 | 28 | 0.1% |
| gossip | 44389 | 26 | 0.1% |
| broke | 42884 | 25 | 0.1% |
| germophobe | 43840 | 24 | 0.1% |
| collector | 46761 | 25 | 0.1% |
| tight-lipped | 41875 | 22 | 0.1% |
| superstitious | 43836 | 23 | 0.1% |
| prodigal | 40552 | 21 | 0.1% |
| accountant | 46709 | 24 | 0.1% |
| traditionalist | 43201 | 22 | 0.1% |
| know-it-all | 44810 | 22 | 0.0% |
| been-here | 47118 | 23 | 0.0% |
| green | 41776 | 20 | 0.0% |
| conspiracy | 44636 | 21 | 0.0% |
| litigious | 44970 | 21 | 0.0% |
| skeptic | 46507 | 21 | 0.0% |
| pushover | 44506 | 20 | 0.0% |
| pincher | 42476 | 19 | 0.0% |
| country-club | 43970 | 19 | 0.0% |
| heartbroken | 40153 | 17 | 0.0% |
| haggler | 47491 | 19 | 0.0% |
| new-age | 42824 | 17 | 0.0% |
| chatterbox | 43127 | 14 | 0.0% |
| serene | 42473 | 7 | 0.0% |

| special customer | met | sales | walkouts |
| --- | --- | --- | --- |
| county-contract | 3059 | 0 | 0 |
| pre-need | 6141 | 6133 | 8 |
| father-smyth | 2961 | 2961 | 0 |
| black-widow | 2899 | 2899 | 0 |
| clown-family | 3058 | 3058 | 0 |
| nurse-referral | 2952 | 0 | 0 |
| pet | 6178 | 6176 | 2 |
| old-man-withers | 3127 | 3126 | 1 |
| celebrity | 3122 | 3120 | 2 |
| elijah | 2906 | 2906 | 0 |
| teller | 2887 | 2886 | 1 |
| jackpot | 2895 | 2879 | 16 |
| cousin-sal | 2906 | 0 | 0 |
| zookeeper | 2822 | 2817 | 5 |
| the-twins | 2568 | 0 | 0 |
| fake-death | 2714 | 0 | 0 |
| ghost-crew | 2538 | 0 | 0 |
| blaine-director | 2744 | 2744 | 0 |
| the-mayor | 2787 | 2786 | 1 |
| mob-boss | 2845 | 2845 | 0 |
| the-count | 2560 | 2558 | 2 |

Packages sold (share of all sales reaching each tier or higher bought on that sale):

| package | tier 1 | tier 2 | tier 3 | tier 4 | tier 5 |
| --- | --- | --- | --- | --- | --- |
| plot | 10.2% | 3.2% | 6.2% | 0.0% | 0.0% |
| service | 1.8% | 0.3% | 0.1% | 0.1% | 0.0% |
| embalming | 3.0% | 1.7% | 0.3% | 0.8% | 0.0% |
| headstone | 2.2% | 0.2% | 0.1% | 0.0% | 0.0% |
| flowers | 1.3% | 0.2% | 0.0% | 0.0% | 0.0% |
| urn | 0.1% | 0.0% | 0.0% | 0.0% | 0.0% |

Soft-sell cards bought: 2.22 per sale.

## Expanded: money by system

Dollars earned per player-day:

| income | share | builder | gambler | mourner | necromancer | organiser | pacifist | politician | saboteur | saint | scholar | shark | tycoon |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sales | 82.5% | 15,110 | 10,417 | 9,029 | 13,702 | 14,058 | 13,003 | 7,624 | 10,284 | 9,150 | 11,634 | 28,361 | 25,201 |
| new day and mail | 5.5% | 1,010 | 876 | 901 | 877 | 958 | 946 | 952 | 699 | 902 | 929 | 1,030 | 1,027 |
| savings | 4.6% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 10,006 |
| body prep | 2.3% | 419 | 338 | 71 | 1,114 | 411 | 72 | 74 | 1,074 | 73 | 404 | 175 | 437 |
| loans | 2.1% | 2,454 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1,999 |
| special offers | 1.4% | 400 | 298 | 18 | 308 | 386 | 19 | 21 | 271 | 18 | 386 | 355 | 373 |
| rob graves | 0.6% | 0 | 0 | 0 | 539 | 0 | 0 | 0 | 581 | 0 | 0 | 0 | 0 |
| gambling | 0.4% | 0 | 861 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| parlor PvP | 0.4% | 0 | 227 | 0 | 87 | 0 | 0 | 0 | 26 | 0 | 0 | 411 | 0 |
| dig | 0.3% | 0 | 0 | 0 | 277 | 0 | 0 | 0 | 298 | 0 | 0 | 0 | 0 |

Dollars spent per player-day:

| spending | share | builder | gambler | mourner | necromancer | organiser | pacifist | politician | saboteur | saint | scholar | shark | tycoon |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| stock | 46.9% | 9,249 | 6,348 | 4,961 | 7,047 | 8,304 | 8,141 | 3,839 | 5,945 | 5,289 | 7,131 | 12,618 | 13,305 |
| upgrades | 17.7% | 3,997 | 2,407 | 2,577 | 2,471 | 3,232 | 2,524 | 1,399 | 2,864 | 624 | 3,166 | 5,116 | 4,174 |
| monuments | 9.6% | 1,205 | 835 | 460 | 1,507 | 1,708 | 1,329 | 600 | 903 | 284 | 978 | 3,664 | 5,533 |
| tithe | 4.8% | 641 | 613 | 562 | 649 | 660 | 651 | 583 | 622 | 2,568 | 629 | 667 | 667 |
| savings | 4.7% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 9,958 |
| black market | 2.4% | 0 | 544 | 0 | 1,344 | 0 | 0 | 0 | 1,006 | 31 | 396 | 929 | 499 |
| loans | 2.2% | 2,527 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2,059 |
| hearse upkeep | 2.2% | 601 | 295 | 395 | 224 | 310 | 311 | 310 | 29 | 219 | 403 | 867 | 300 |
| leads | 2.1% | 0 | 0 | 0 | 1,184 | 0 | 0 | 0 | 0 | 0 | 0 | 2,905 | 0 |
| hits | 1.4% | 0 | 183 | 0 | 521 | 0 | 0 | 0 | 415 | 0 | 0 | 1,700 | 0 |
| story appeals | 1.2% | 0 | 0 | 377 | 478 | 0 | 302 | 285 | 469 | 355 | 0 | 0 | 0 |
| treatment | 1.1% | 131 | 222 | 134 | 422 | 130 | 0 | 265 | 135 | 215 | 112 | 205 | 192 |
| gambling | 0.6% | 0 | 1,173 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| permits | 0.5% | 234 | 51 | 134 | 0 | 183 | 0 | 0 | 0 | 181 | 186 | 0 | 0 |
| body prep | 0.4% | 50 | 74 | 104 | 41 | 57 | 106 | 104 | 34 | 101 | 54 | 101 | 48 |
| stolen | 0.4% | 35 | 69 | 22 | 137 | 37 | 0 | 42 | 242 | 33 | 25 | 54 | 42 |
| chains | 0.4% | 109 | 0 | 117 | 0 | 333 | 0 | 114 | 0 | 0 | 0 | 0 | 0 |
| ordinances | 0.3% | 0 | 0 | 0 | 0 | 0 | 0 | 569 | 0 | 0 | 0 | 0 | 0 |
| rob graves | 0.2% | 0 | 0 | 0 | 249 | 0 | 0 | 0 | 209 | 0 | 0 | 0 | 0 |
| inspection | 0.2% | 139 | 0 | 0 | 0 | 0 | 0 | 100 | 72 | 130 | 0 | 0 | 0 |
| midnight (fines, collection) | 0.2% | 5 | 28 | 9 | 85 | 27 | 10 | 2 | 46 | 4 | 29 | 145 | 41 |
| special offers | 0.2% | 35 | 29 | 36 | 24 | 33 | 39 | 36 | 23 | 35 | 34 | 32 | 35 |
| chain dues | 0.2% | 63 | 0 | 67 | 0 | 106 | 0 | 58 | 0 | 0 | 0 | 0 | 0 |
| election | 0.1% | 0 | 0 | 0 | 0 | 0 | 0 | 217 | 0 | 0 | 0 | 0 | 0 |
| holy water | 0.1% | 0 | 0 | 6 | 0 | 0 | 5 | 58 | 0 | 48 | 0 | 0 | 0 |
| bodyguard | 0.1% | 19 | 0 | 0 | 0 | 13 | 0 | 38 | 0 | 0 | 11 | 0 | 20 |
| confession | 0.0% | 0 | 0 | 2 | 0 | 0 | 2 | 0 | 0 | 2 | 0 | 0 | 0 |

## Expanded: BP by system (per player-day)

| source | share | builder | gambler | mourner | necromancer | organiser | pacifist | politician | saboteur | saint | scholar | shark | tycoon |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sales | 80.4% | 573 | 527 | 539 | 515 | 559 | 539 | 566 | 378 | 534 | 563 | 596 | 583 |
| risks | 8.4% | 70 | 43 | 57 | 39 | 64 | 57 | 59 | 41 | 59 | 66 | 52 | 66 |
| parlor PvP | 2.3% | 0 | 22 | 0 | 33 | 0 | 0 | 0 | 130 | 0 | 0 | 0 | 0 |
| monuments | 2.2% | 15 | 12 | 8 | 16 | 17 | 16 | 9 | 13 | 5 | 14 | 23 | 26 |
| service | 1.5% | 0 | 1 | 30 | 0 | 0 | 30 | 29 | 0 | 28 | 0 | 0 | 0 |
| midnight | 1.4% | 9 | 7 | 8 | 11 | 7 | 10 | 16 | 7 | 12 | 8 | 8 | 11 |
| duels | 1.1% | 0 | 23 | 0 | 26 | 0 | 0 | 0 | 36 | 0 | 0 | 0 | 0 |
| tithe | 1.1% | 5 | 6 | 7 | 3 | 5 | 8 | 7 | 2 | 31 | 5 | 5 | 5 |
| wait (events, scripts) | 0.7% | 5 | 5 | 4 | 4 | 5 | 5 | 5 | 4 | 4 | 5 | 4 | 5 |
| yangs | 0.6% | -0 | -1 | -5 | -1 | -0 | -0 | -0 | -21 | -0 | -0 | -20 | -0 |
| new day and mail | 0.2% | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| special offers | 0.2% | 2 | 1 | 1 | 1 | 2 | 1 | 1 | 1 | 1 | 2 | 2 | 2 |
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
| neg | 78.8% | 280 | 274 | 275 | 273 | 273 | 293 | 296 | 204 | 272 | 275 | 319 | 290 |
| desk | 7.9% | 29 | 28 | 27 | 28 | 28 | 26 | 28 | 27 | 27 | 28 | 30 | 29 |
| store | 3.0% | 11 | 10 | 9 | 11 | 11 | 11 | 8 | 10 | 9 | 11 | 13 | 13 |
| map | 2.6% | 7 | 10 | 9 | 12 | 7 | 8 | 9 | 12 | 11 | 7 | 9 | 8 |
| competitors | 0.9% | 0 | 8 | 0 | 8 | 0 | 0 | 0 | 13 | 0 | 0 | 9 | 0 |
| church | 0.9% | 1 | 6 | 5 | 1 | 1 | 6 | 5 | 1 | 9 | 1 | 1 | 1 |
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
| a customer (Wait for Customer) | BP per turn | 33.376 | 774917 |
| leading the service | BP per turn | 33.052 | 14263 |
| a graveyard duel (challenger) | BP per turn | 39.914 | 8710 |
| robbing a grave | $ per try | 379.960 | 7089 |
| digging at the office | $ per try | 329.791 | 7089 |
| tending the graves | uses | - | 6798 |
| the seance | turns used | - | 6709 |
| monuments | BP per $ | 0.009 | 74820000 |
| tithes | BP per $ | 0.009 | 37386000 |
| hits (BP the victim lost per $) | BP per $ | 0.004 | 11160000 |
| special offers | BP per offer | 3.422 | 12626 |
| body prep choices | BP per choice | 0.000 | 322220 |
| risks taken | BP per risk | 42.830 | 62859 |

A lead from the nurse ($1,500) brings a sure, richer customer: 24,031 lead customers were met. Sale BP per customer over all customers: 33.38.

Parlor upgrades (share of seats that bought each, and the mean day bought):

| upgrade | bought | share of seats | mean day |
| --- | --- | --- | --- |
| paint | 1600 | 100.0% | 2.5 |
| coffee-machine | 1600 | 100.0% | 3.8 |
| storeroom | 1588 | 99.3% | 9.7 |
| florist-cooler | 1495 | 93.4% | 12.9 |
| viewing-room | 1451 | 90.7% | 15.4 |
| embalming-lab | 1366 | 85.4% | 17.7 |
| incinerator | 827 | 51.7% | 22.3 |
| chapel | 412 | 25.8% | 20.8 |
| billboard | 364 | 22.8% | 21.4 |
| guard-dog | 265 | 16.6% | 6.3 |
| alarm | 242 | 15.1% | 18.1 |
| night-watchman | 158 | 9.9% | 25.7 |
| memorial-garden | 133 | 8.3% | 26.0 |
| mausoleum | 48 | 3.0% | 26.8 |

The three late upgrades the engine pass made cheaper and better, and what they return:

| upgrade | bought | share of seats | mean day | cost with permit ($) | BP / day vs peers (after - before) | days owned | BP over the season | BP per $ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| night-watchman | 158 | 9.9% | 25.7 | 12,000 | +27.2 (se 6.5) | 4.3 | 116 | 0.010 |
| billboard | 364 | 22.8% | 21.4 | 21,500 | +23.8 (se 3.9) | 8.6 | 204 | 0.009 |
| memorial-garden | 133 | 8.3% | 26.0 | 24,000 | +42.5 (se 8.0) | 4.0 | 168 | 0.007 |

BP per day is measured against the same personality's seats on the same day that did not yet own the upgrade, so the season's rise in income cancels; the standard error is across buyers. The monuments return about 0.010 BP a dollar, so an upgrade that returns less is not worth buying for points alone.

Monument tiers built: tier 1: 1600, tier 2: 1560, tier 3: 1167, tier 4: 416, tier 5: 172 (of 1600 seats).

Permits bought: signage 803, zoning 795, crematory 156. Black-market buys: testimonials 627, clover 376, tap-water 286, coroner-list 1815, rabbit-foot 322, riot-shield 370, morty-rib 925, monster-scale 284, sal-pad 506, hot-casket 1700, haunted-casket 367, real-water 477, cop-day-off 246, bruno 412, filed-tag 545, used-wreaths 572, forged-permit 216, vest 304, mayor-key 176.

## Expanded: PvP, duels and hits

| measure | value |
| --- | --- |
| duels started | 8710 |
| challenger won / lost / yielded | 7278 / 944 / 488 |
| BP won by duel winners / lost by losers | 428,039 / 211,559 |
| duels with a Shove: share of duels / challenger won, lost, yielded / mean BP | 5.8% / 149, 312, 42 / -1.3 |
| duels without a Shove: challenger won, lost, yielded / mean BP | 7129, 632, 446 / 42.4 |
| Shove pressed (times) | 506 |
| hits resolved / landed | 797 / 586 |
| BP taken from hit victims | 39,455 |
| cash stolen in burglaries | 2,966,262 |

Hits by the parlor that hired them:

| personality | hired | landed | hirer behind the target | $ spent | BP taken from targets | BP per $ |
| --- | --- | --- | --- | --- | --- | --- |
| gambler | 54 | 42 | 98.1% | 728,600 | 2,873 | 0.004 |
| necromancer | 159 | 120 | 95.0% | 2,096,150 | 8,047 | 0.004 |
| saboteur | 136 | 106 | 94.9% | 1,706,950 | 6,892 | 0.004 |
| shark | 448 | 318 | 97.3% | 6,628,300 | 21,643 | 0.003 |

BP lost to other parlors per player-day, by victim and venue:

| personality | parlor fights | duels | hits | total | share of final BP |
| --- | --- | --- | --- | --- | --- |
| builder | 6.9 | 6.4 | 0.8 | 14.2 | 2.1% |
| gambler | 15.9 | 4.9 | 0.4 | 21.2 | 3.3% |
| mourner | 3.1 | 3.0 | 0.9 | 7.0 | 1.1% |
| necromancer | 19.6 | 3.2 | 1.0 | 23.8 | 3.7% |
| organiser | 8.0 | 5.0 | 0.8 | 13.8 | 2.1% |
| pacifist | 0.0 | 0.0 | 0.0 | 0.0 | 0.0% |
| politician | 8.9 | 7.0 | 1.6 | 17.5 | 2.6% |
| saboteur | 2.7 | 0.7 | 0.3 | 3.7 | 0.6% |
| saint | 6.8 | 5.1 | 1.9 | 13.8 | 2.1% |
| scholar | 6.9 | 4.7 | 0.6 | 12.2 | 1.9% |
| shark | 19.9 | 4.5 | 0.2 | 24.7 | 3.8% |
| tycoon | 11.4 | 9.0 | 1.4 | 21.8 | 3.2% |

The most-targeted peaceful parlor in each town (never fights) lost on average 879 BP over the season, 4.1% of what it would otherwise have had (worst town: 8.2%); it finished at mean place 2.71.

## Expanded: the house

| game and stake | plays | staked | returned | return per $ |
| --- | --- | --- | --- | --- |
| slots.100 | 8860 | 886,000 | 705,000 | 0.796 |
| slots.1000 | 2602 | 2,602,000 | 1,812,000 | 0.696 |
| slots.500 | 3855 | 1,927,500 | 1,654,000 | 0.858 |

Gamblers' net: gambler -312 $/day on 1,357 $/day staked.

## Expanded: the bank

| personality | loans taken | borrowed $ | repaid $ | collected | defaulted | written off $ | default BP | savings interest $ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| builder | 1306 | 9,705,484 | 9,705,484 | 0 | 0 | 0 | 0 | 0 |
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
| tycoon | 1363 | 7,598,001 | 7,598,001 | 0 | 0 | 0 | 0 | 178,874 |

## Expanded: City Hall and chains

| measure | value |
| --- | --- |
| ordinance ballots counted | 800 |
| votes per ballot / players | 8.00 / 8.00 |
| lobbying votes bought | 942 |
| elections held (of towns) | 200 of 200 |
| candidates per election | 0.65 |
| votes per election / players | 5.20 / 8.00 |
| campaign ads bought | 24 |
| mayors by personality | politician 130 |
| chains founded / joined | 140 / 268 |
| chains alive at the end, mean members | 140, 2.91 |

| chain | seats | wins | win rate | fair share | win / fair | mean final BP | mean place | BP vs town mean | sd of that |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| no chain | 1192 | 154 | 12.9% | 12.5% | 1.03 | 19,496 | 4.54 | -0.3% | 7.7% |
| in a chain | 408 | 46 | 11.3% | 12.5% | 0.90 | 19,854 | 4.37 | +0.8% | 5.0% |

## Expanded: the Daily Challenge

| difficulty | runs | mean score | sd | min | max |
| --- | --- | --- | --- | --- | --- |
| normal | 72 | 420.2 | 59.5 | 325 | 628 |
| hard | 72 | 419.5 | 65.1 | 313 | 632 |
| easy | 72 | 364.1 | 57.2 | 189 | 512 |

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
| reaper-club:buy:tiny | 901 | 0 | 0.0% | 0 |
| reaper-club:draw | 133 | 0 | 0.0% | 0 |
| reaper-club:shots | 133 | 0 | 0.0% | 0 |
| parlor:markup:-10 | 253 | 0 | 0.0% | 0 |
| parlor:markup:30 | 253 | 0 | 0.0% | 0 |
| parlor:markup:0 | 253 | 0 | 0.0% | 0 |
| bank:depositall | 123 | 0 | 0.0% | 0 |
| bank:withdraw | 123 | 0 | 0.0% | 0 |

Usage of every choice (seats that used it at least once among seats that were offered it):

| choice | uses | per seat | seats offered | share of them that used it |
| --- | --- | --- | --- | --- |
| neg:soft | 3182612 | 1989.1 | 1600 | 100.0% |
| neg:card | 2556729 | 1598.0 | 1600 | 100.0% |
| neg:packages | 1080883 | 675.6 | 1600 | 100.0% |
| neg:listen | 1039657 | 649.8 | 1600 | 100.0% |
| desk:wait | 963048 | 601.9 | 1600 | 100.0% |
| neg:done | 759306 | 474.6 | 1600 | 100.0% |
| neg:hard | 548559 | 342.8 | 1600 | 100.0% |
| neg:coffee | 526813 | 329.3 | 1600 | 100.0% |
| neg:pkg:plot | 371748 | 232.3 | 1600 | 100.0% |
| prep:start | 322220 | 201.4 | 1600 | 100.0% |
| prep:choice | 322220 | 201.4 | 1600 | 100.0% |
| store:casket:0 | 182629 | 114.1 | 1600 | 100.0% |
| neg:bless | 175340 | 109.6 | 688 | 100.0% |
| neg:discount | 149293 | 93.3 | 1600 | 100.0% |
| store:casket:1 | 104164 | 65.1 | 1600 | 100.0% |
| neg:pkg:embalming | 102612 | 64.1 | 1600 | 100.0% |
| place:funeral-home | 99394 | 62.1 | 1600 | 100.0% |
| place:store | 89745 | 56.1 | 1600 | 100.0% |
| neg:guilt | 77644 | 48.5 | 1600 | 100.0% |
| risk:take | 62859 | 39.3 | 1600 | 99.2% |
| desk:quit | 48000 | 30.0 | 1600 | 100.0% |
| store:caskets | 47968 | 30.0 | 1600 | 100.0% |
| neg:pkg:headstone | 38699 | 24.2 | 1600 | 100.0% |
| place:church | 37896 | 23.7 | 1600 | 100.0% |
| church:tithe | 37386 | 23.4 | 1600 | 100.0% |
| neg:pkg:service | 37222 | 23.3 | 1600 | 100.0% |
| neg:pkg:flowers | 36164 | 22.6 | 1600 | 100.0% |
| place:reaper-club | 31007 | 19.4 | 1600 | 62.0% |
| place:hospital | 30082 | 18.8 | 1600 | 86.2% |
| place:graveyard | 29400 | 18.4 | 1600 | 100.0% |
| place:yangs | 24451 | 15.3 | 1600 | 54.3% |
| place:bank | 23077 | 14.4 | 1600 | 100.0% |
| church:bingo-card | 21505 | 13.4 | 665 | 100.0% |
| neg:cremation | 20638 | 12.9 | 825 | 99.9% |
| reaper-club:market | 20537 | 12.8 | 992 | 93.5% |
| neg:sympathy | 20353 | 12.7 | 1600 | 99.9% |
| competitors:visit | 20130 | 12.6 | 534 | 100.0% |
| battle:attack | 19668 | 12.3 | 404 | 100.0% |
| place:city-hall | 19614 | 12.3 | 1600 | 100.0% |
| competitors:trydoor | 19020 | 11.9 | 534 | 100.0% |
| parlor:upgrades | 18890 | 11.8 | 1600 | 100.0% |
| store:casket:2 | 17644 | 11.0 | 1600 | 93.0% |
| place:competitors | 17095 | 10.7 | 1600 | 33.4% |
| competitors:look | 16020 | 10.0 | 534 | 100.0% |
| bank:all-gold | 15736 | 9.8 | 1600 | 100.0% |
| church:bingo | 15713 | 9.8 | 1600 | 41.6% |
| graveyard:swing | 15632 | 9.8 | 404 | 100.0% |
| place:cafe | 15568 | 9.7 | 1600 | 100.0% |
| reaper-club:slots | 15317 | 9.6 | 133 | 100.0% |
| church:serve | 14263 | 8.9 | 553 | 100.0% |
| reaper-club:pay | 14053 | 8.8 | 960 | 100.0% |
| graveyard:monuments | 13620 | 8.5 | 1600 | 100.0% |
| place:spirit-university | 12686 | 7.9 | 1600 | 100.0% |
| neg:offer:accept | 12626 | 7.9 | 1600 | 98.9% |
| city-hall:chains | 12050 | 7.5 | 1600 | 33.4% |
| yangs:menu | 11266 | 7.0 | 537 | 100.0% |
| tutorial:next | 11200 | 7.0 | 1600 | 100.0% |
| competitors:attack | 11193 | 7.0 | 534 | 75.7% |
| hospital:lead | 10726 | 6.7 | 1379 | 19.1% |
| spirit-university:psych | 10495 | 6.6 | 1600 | 99.9% |
| graveyard:duel | 10464 | 6.5 | 526 | 76.8% |
| risk:decline | 10461 | 6.5 | 1600 | 82.9% |
| battle:yellwin | 9830 | 6.1 | 403 | 100.0% |
| city-hall:ordinance | 8845 | 5.5 | 1600 | 100.0% |
| hospital:treat | 8706 | 5.4 | 1374 | 95.6% |
| city-hall:inspection | 8122 | 5.1 | 1600 | 32.8% |
| yangs:tiger | 8010 | 5.0 | 869 | 30.7% |
| store:hearse | 7854 | 4.9 | 1600 | 99.3% |
| parlor:dig | 7089 | 4.4 | 304 | 89.1% |
| graveyard:rob | 7089 | 4.4 | 306 | 88.6% |
| graveyard:tend | 6798 | 4.2 | 608 | 20.1% |
| competitors:steal | 6721 | 4.2 | 534 | 100.0% |
| reaper-club:seance | 6709 | 4.2 | 285 | 100.0% |
| city-hall:vote | 6400 | 4.0 | 1600 | 100.0% |
| graveyard:monument | 4915 | 3.1 | 1600 | 100.0% |
| arc:give:church | 4877 | 3.0 | 802 | 55.5% |
| neg:offer:decline | 4111 | 2.6 | 1600 | 47.3% |
| arc:give:reaper-club | 4082 | 2.6 | 977 | 27.7% |
| store:hearse-look | 3927 | 2.5 | 1589 | 100.0% |
| store:buy | 3927 | 2.5 | 1589 | 100.0% |
| bank:savings | 2825 | 1.8 | 1600 | 7.7% |
| bank:loan | 2669 | 1.7 | 1600 | 15.7% |
| bank:borrow | 2669 | 1.7 | 251 | 100.0% |
| bank:repay | 2669 | 1.7 | 251 | 100.0% |
| neg:pkg:urn | 2574 | 1.6 | 814 | 67.2% |
| neg:raise | 2448 | 1.5 | 285 | 98.2% |
| yangs:dragon | 2360 | 1.5 | 869 | 25.3% |
| bank:deposit | 2166 | 1.4 | 123 | 100.0% |
| reaper-club:games | 2041 | 1.3 | 992 | 13.4% |
| arc:give:city-hall | 1865 | 1.2 | 991 | 33.2% |
| reaper-club:buy:coroner-list | 1815 | 1.1 | 909 | 44.1% |
| city-hall:election | 1722 | 1.1 | 1600 | 65.5% |
| reaper-club:buy:hot-casket | 1700 | 1.1 | 908 | 42.2% |
| spirit-university:strength | 1689 | 1.1 | 1600 | 25.3% |
| tutorial:start | 1600 | 1.0 | 1600 | 100.0% |
| parlor:buy:paint | 1600 | 1.0 | 1600 | 100.0% |
| parlor:buy:coffee-machine | 1600 | 1.0 | 1600 | 100.0% |
| parlor:buy:storeroom | 1588 | 1.0 | 1589 | 99.9% |
| parlor:buy:florist-cooler | 1495 | 0.9 | 1589 | 94.1% |
| city-hall:certify | 1469 | 0.9 | 525 | 83.2% |
| parlor:buy:viewing-room | 1451 | 0.9 | 1465 | 99.0% |
| parlor:buy:embalming-lab | 1366 | 0.9 | 1547 | 88.3% |
| city-hall:permits | 1362 | 0.9 | 1600 | 49.8% |
| bank:transferhome | 1334 | 0.8 | 1600 | 15.6% |
| bank:transfer | 1334 | 0.8 | 250 | 100.0% |
| bank:transfer-tier | 1334 | 0.8 | 250 | 100.0% |
| battle:yelllost | 1075 | 0.7 | 303 | 100.0% |
| hospital:leave-room | 1075 | 0.7 | 303 | 100.0% |
| city-hall:elect | 1040 | 0.7 | 1040 | 100.0% |
| reaper-club:hit | 994 | 0.6 | 992 | 35.3% |
| city-hall:invite | 968 | 0.6 | 294 | 47.6% |
| city-hall:lobby | 942 | 0.6 | 1600 | 8.6% |
| reaper-club:buy:morty-rib | 925 | 0.6 | 906 | 29.6% |
| yangs:sparrow | 896 | 0.6 | 869 | 14.7% |
| parlor:buy:incinerator | 827 | 0.5 | 1070 | 77.3% |
| church:water | 772 | 0.5 | 904 | 36.0% |
| spirit-university:hp | 672 | 0.4 | 1600 | 8.6% |
| city-hall:permit:signage | 668 | 0.4 | 796 | 83.9% |
| city-hall:permit:zoning | 662 | 0.4 | 796 | 83.2% |
| bank:withdrawall | 659 | 0.4 | 123 | 100.0% |
| reaper-club:buy:testimonials | 627 | 0.4 | 907 | 14.0% |
| reaper-club:buy:used-wreaths | 572 | 0.4 | 902 | 15.0% |
| reaper-club:buy:filed-tag | 545 | 0.3 | 847 | 28.2% |
| reaper-club:buy:sal-pad | 506 | 0.3 | 866 | 14.5% |
| graveyard:shove | 506 | 0.3 | 404 | 65.1% |
| city-hall:bribe | 493 | 0.3 | 137 | 100.0% |
| graveyard:yield | 488 | 0.3 | 404 | 59.9% |
| reaper-club:buy:real-water | 477 | 0.3 | 861 | 15.0% |
| reaper-club:buy:bruno | 412 | 0.3 | 872 | 15.1% |
| parlor:buy:chapel | 412 | 0.3 | 415 | 99.3% |
| parlor:rivalry | 409 | 0.3 | 1600 | 25.6% |
| reaper-club:buy:clover | 376 | 0.2 | 914 | 14.2% |
| reaper-club:buy:riot-shield | 370 | 0.2 | 830 | 26.0% |
| reaper-club:buy:haunted-casket | 367 | 0.2 | 847 | 14.5% |
| parlor:buy:billboard | 364 | 0.2 | 674 | 54.0% |
| reaper-club:buy:rabbit-foot | 322 | 0.2 | 907 | 13.1% |
| reaper-club:buy:vest | 304 | 0.2 | 893 | 14.0% |
| battle:run | 288 | 0.2 | 404 | 41.6% |
| reaper-club:buy:tap-water | 286 | 0.2 | 909 | 12.8% |
| reaper-club:buy:monster-scale | 284 | 0.2 | 886 | 13.3% |
| city-hall:join | 268 | 0.2 | 268 | 100.0% |
| parlor:rivalry:cutthroat | 267 | 0.2 | 409 | 65.3% |
| parlor:buy:guard-dog | 265 | 0.2 | 1589 | 16.7% |
| parlor:markup | 253 | 0.2 | 1600 | 15.8% |
| reaper-club:buy:cop-day-off | 246 | 0.2 | 766 | 13.3% |
| parlor:buy:alarm | 242 | 0.2 | 265 | 91.3% |
| reaper-club:buy:forged-permit | 216 | 0.1 | 845 | 14.3% |
| reaper-club:buy:mayor-key | 176 | 0.1 | 845 | 13.3% |
| parlor:buy:night-watchman | 158 | 0.1 | 195 | 81.0% |
| parlor:rivalry:peaceful | 142 | 0.1 | 409 | 34.7% |
| city-hall:found | 140 | 0.1 | 460 | 30.4% |
| reaper-club:bodyguard | 136 | 0.1 | 992 | 9.9% |
| parlor:buy:memorial-garden | 133 | 0.1 | 658 | 20.2% |
| city-hall:file | 130 | 0.1 | 130 | 100.0% |
| parlor:markup:20 | 130 | 0.1 | 253 | 51.4% |
| parlor:markup:10 | 123 | 0.1 | 253 | 48.6% |
| church:confess | 59 | 0.0 | 1236 | 4.3% |
| parlor:buy:mausoleum | 48 | 0.0 | 100 | 48.0% |
| city-hall:permit:crematory | 32 | 0.0 | 796 | 4.0% |
| city-hall:ads | 24 | 0.0 | 101 | 22.8% |
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
| reaper-club:buy:tiny | 0 | 0.0 | 901 | 0.0% |
| reaper-club:draw | 0 | 0.0 | 133 | 0.0% |
| reaper-club:shots | 0 | 0.0 | 133 | 0.0% |
| parlor:markup:-10 | 0 | 0.0 | 253 | 0.0% |
| parlor:markup:30 | 0 | 0.0 | 253 | 0.0% |
| parlor:markup:0 | 0 | 0.0 | 253 | 0.0% |
| bank:depositall | 0 | 0.0 | 123 | 0.0% |
| bank:withdraw | 0 | 0.0 | 123 | 0.0% |

## What only human playtesting can answer

The bots play every system from the same committed strategies each season, so these numbers say how often the game offers something, not whether a person enjoys it. Drawn from this run:

- **Is a day too long?** A bot answers 351 screens a day, 191 of them choices, for 16.1 customers. A person reads faster than a bot looks but also hesitates; only a playtest says whether 191 choices a day is fun or a chore, and whether the hand and package panes should be on the main screen.
- **Walkout pacing.** 0.1% of 774,917 customers walked out. Bots stop pushing before the mood does, so this is the floor; a person who misreads a customer, or is greedy for the exact match (24.4% of the bots' sales), will see far more. Whether a walkout feels like a fair lesson or a punishment is not measurable here.
- **How often the town speaks.** News changed the rules on 57.1% of days, a weather set on 100.0%, and a story arc was running on 62.8% of days (3.0 arcs and 6.2 story beats a town a season). Bots read none of it as a story; whether that is too much, too little, or repeats itself by day 20 needs readers.
- **Is the election a contest?** 0.65 candidates stood in each of 200 elections and 8.0 parlors voted: the bots vote by a preference list. Whether people campaign, lobby or bluff is a social question.
- **Ordinances and arcs by effect, not by rote.** The bots rank ordinances from a fixed list (800 ballots, 8.00 votes each, 942 lobbying votes bought). Do players read the effects and choose, or click the first?
- **Grudges and bluffing.** 8,710 duels and 797 hits happened with no memory of who did what to whom. Retaliation, alliances and the Peace Pledge as a social contract are for people.
- **Wording.** The bots read panels and button ids, and `packages/bots/test/scrambled.test.ts` plays a season with every pack string reworded and sees no stuck day; that proves the text does not carry rules, not that it is funny, clear or tonally right.

