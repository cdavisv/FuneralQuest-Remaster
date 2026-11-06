# Balance report: expanded rules

## What it says about the Expanded design

*Hand-written reading of the generated tables below (regenerating with `pnpm --filter @fq/sim run sim -- --days 30 --towns 200 --players 8 --rules expanded --seed 1 --challenges 6 --out docs/balance/expanded-baseline` overwrites this file; keep this section, or rebuild the tables alone with `pnpm --filter @fq/sim exec tsx src/remark.ts ../../docs/balance/expanded-baseline`, which keeps it). 200 towns of 8 hard bots drawn from the twelve `@fq/bots` personalities, a 30-day season with the built-in `expandedPack`. This run is the first one after the engine pass (a Shove that lands costs the shoved side its next move; Night Watchman $20,000 and +2, Billboard $14,000 and income +10, Memorial Garden $30,000 and +6; hits at $3,000 + $1 a BP and 0.75 of the curve) and after the bots were taught those rules and to read the structured panels (`expanded-tuning-log.md`, "Bots pass"). Comparison runs, 60 towns each, same base seed, not saved: mixed difficulty and a ninth bot joining on day 10 were re-run for this reading; the oracle and the no-fighters towns were not, so reading 10 and 11 keep the previous baseline's figures and say so.*

**Checks: all passed** in every run: no invariant breaks, no offered button rejected, no stuck bot-day, no error, none of the conservation signatures (money net of debt, tags or BP rising in a bank, chain, City Hall, church, club, hospital, store or upgrade action; a loan default cheaper than the money could buy). Classic's simulator report for a fixed seed (60 towns, seed 7) is identical before and after the bots pass, except its run time.

### The targets

| target | result | met? |
| --- | --- | --- |
| no personality above about 2x its fair share of wins, none below a third | necromancer 2.51, tycoon 2.15, politician 1.91, shark 1.78, pacifist 1.41, builder 0.50, gambler 0.48, saboteur 0.41, saint 0.39, organiser 0.29, scholar 0.17, mourner (Soft Touch) 0.06. Before: necromancer 2.75, tycoon 2.54, scholar 0 | **no, still not met** (see 1) |
| good and evil within a few percent | mean final BP: good 19,800, evil 18,957, neutral 20,037 around 19,751 (good +0.2%, neutral +1.4%, evil -4.0%); wins: evil 1.42x its share, good 0.91x, neutral 0.90x | **on BP at the edge (evil was -2.4%), on wins no** (see 1, 4) |
| no single purchase dominant, no system dead | the Billboard now returns 0.031 BP a dollar, three times a monument (0.011), and is the one clear best buy (see 3); Night Watchman and Memorial Garden are bought by 7% of seats, on day 26, and return nothing measurable; the rest is flat | **no: one dominant purchase, two near-dead** (see 3, 7) |
| skill worth clearly more than luck | mixed towns (60): easy bots finish 17,104 BP and hard bots 19,859, +16%, of the same personalities (easy never won); Daily Challenge: hard 419, normal 419, easy 364 BP, against a day-to-day luck of 44 BP (sd across challenges) | yes |
| a day-10 starter can reach mid-table | a ninth bot joining on day 10 finishes at mean place 5.95 of 9 (mid-table is 5.0), 19,486 BP against a town median of 19,736 (-1.3%); it was 5.2 before the pass | **slipped: just below mid-table** (see 9) |
| the leader's margin over the median stays moderate | 1.07x the median at the end (was 1.11x) | yes |
| PvP-heavy play viable, peaceful play not miserable | parlors that fight finish 2.6% below the field mean but win 1.29x their share; the most-targeted parlor that never fights loses 4.5% of its season (worst town 10.3%) and still finishes 2.8th on average | yes |
| a small house edge, not exploitable by bet sizing | the slots return 0.957 / 1.081 / 0.909 per dollar at $100 / $500 / $1,000 over 14,779 plays, jackpot noise around the exact 0.976 (the draw's and the roulette's exact returns are tested in core) | yes |
| loans cannot be turned into points | 2,668 loans (builder, tycoon), every one repaid, none defaulted | yes |
| a full but not grindy game day | 351 screens a bot-day, 191 of them choices, for 16.1 customers | see 8 and "What only human playtesting can answer" |

### Reading

1. **The win-share target is still not met, and this pass did not fix it.** The two over-2x personalities are the necromancer (2.51, mean BP 19,408, 1.7% below the field) and the tycoon (2.15, mean 20,878, +5.7%); the bottom is now the Soft Touch (0.06), the scholar (0.17, up from never winning: it won 3 towns of 200) and the organiser (0.29). The pass moved the means in the right direction (the steady sellers gained: scholar +760, organiser +520, builder +220; the top-to-bottom spread of means is 2,672 BP, was 2,426 because the saboteur fell to 18,206) but win share in a field this tight is decided by the variance of a season, not the mean: the fighters swing (necromancer, saboteur), the steady sellers do not (sd 600 to 1,100 BP) and a seller 2% below the leaders wins almost nothing. The Soft Touch now sits at -2.2% with a small sd and wins once in 200 towns. That cannot be fixed from the bots without cheating the personalities' plans; the candidate rule numbers are in "Recommended next tuning" below.
2. **Selling is the game, as it should be.** Sales are 80% of all BP. A customer turn is worth 33.5 BP, leading the service 33.2, a graveyard duel 43.5 to the challenger. Exact matches land on 24.3% of sales; customers walk out on 0.1% of visits. Human players will walk more customers; that number is not a balance measurement.
3. **The Billboard dominates, the other two late upgrades are dead.** Measured as a difference of differences against the same day's seats that did not yet own it (the table in the report): the Billboard ($15,500 with its permit) buyers gained +45.8 BP a day (se 3.5), 481 BP over the season, 0.031 BP a dollar; monuments return 0.011, tithes 0.009, hits 0.004. A quarter of all seats buy it (the scholar, organiser, saint, gambler, builder; the tycoon and the shark were tried in 40-town trials and their already-high win shares rose, so they do not buy it). The Night Watchman (bought by the mourner and the saboteur) and the Memorial Garden (mourner, saint, scholar, organiser, builder) are bought on day 26 on average, because $20,000 and $34,000 are only spare cash that late; their measured return is -10 (se 9) and -30 (se 8) BP a day, i.e. nothing: a late rating buy cannot pay back, and +2 or +6 rating late in the season does not move the income roll. The bots want them, in the sense that they buy them; the numbers say the rules make them a trophy.
4. **Karma paths.** Good gets reputation and calm customers, evil gets money and nights. On mean BP the three paths are within 4.0% of the field (evil -4.0%, driven by the saboteur at 18,206 and the necromancer at 19,408); on wins evil leads (1.42x) because its personalities are the fighters. Every hit costs its hirer 5 karma, and the hirers are the shark, necromancer, saboteur and gambler, which is part of why the evil path has the lowest mean.
5. **PvP is viable and contained.** The saboteur makes 143 BP a day from parlor fights and 40 from duels and finishes 7.8% below the field (18,206): the purest fighter now sits clearly below the sellers. Victims lose up to 27.5 BP a day (the shark, 4.1% of its season). Duels go 84% to the challenger, 11% to the rival, 5% yielded. **Hits**: four personalities now hire them (shark 444, necromancer 175, saboteur 149, gambler 59 in 200 towns; 827 resolved, 686 landed, 46,489 BP taken, $11.9 million spent): they hire when the leader is within 12% above them or just behind. 97% of hirers were behind their target, as intended, and the return is 0.004 BP of the victim's per dollar, a third of a monument. A hit is a grudge, never a points engine; at 3.4 hits a season the shark pays about $50,000 for 56 BP taken.
6. **The living town is used.** Every ordinance ballot is voted on by all eight parlors; the election draws 0.62 candidates a town and a mayor in most towns (always the politician); chains, bingo, confession, holy water, tithes, the black market and treatment all see use. Weather is set every day, the news changes the rules on 58% of days and a story arc runs on 63% of days.
7. **Dead choices** (offered to at least 20 seats, used by under 2%): the bodyguard and Tiny (924 and 899 seats offered, none bought, while 827 hits resolved: no bot buys protection, because the bots' counterplay is a text match on mail that none receives; a bot gap, listed under unfinished work, not a rule), markups of -10%, 0% and +30%, two of the three house games, the newspaper's other pages, the library, Fill Up and the long way to exchange tags (navigation). The Shove is no longer dead: see 11.
8. **The day is long.** 351 screens a bot-day, 191 of them choices, for 16.1 customers: about 12 decisions a customer, five pane changes and one or two town errands. If playtesters find it grindy the cheapest fix is presentation (show the hand and the packages on the main pane), not the rules.
9. **Late starters.** The day-10 starter finishes 5.95th of 9 (38% in the top half), against 5.2th before the pass: the established parlors got stronger from the new purchases and the joiner does not buy them in time. Joining late is still not a strategy, but the target (mid-table) is now missed by about one place; the late-joiner underdog bonus (`underdog.late`) is the lever.
10. **Hidden information.** (Previous baseline, not re-run.) The oracle makes 37.5 BP a customer against the fair bots' 33.1 (+13%) and finishes 11.6% higher: reading the screen recovers most of what the game hides.
11. **Duels and the Shove (new).** The bots now solve the duel as a game (`packages/bots/src/expanded/duel.ts`: value iteration over both sides' hit points with the exact rules) and pick Swing, Shove or Yield by expected value. They press Shove 467 times in 8,608 duels and a Shove appears in 5.4% of duels, in exactly the positions the rule was written for: the challenger is stronger but near defeat or the odds are even and the other is nearly beaten. Duels with a Shove end -3.1 BP on average for the challenger against +46.2 without one, which is a selection effect (a bot shoves when it is already losing; yielding or swinging there would be worse: the three positions of spec 16.4 are tested), not a verdict on the Shove. Without fighters (previous baseline, not re-run) the same parlors finished about 4% higher.

### Recommended next tuning (for the owner to decide; nothing here was applied)

No number in `packages/core` was changed. Each line gives the evidence; effects are projections from the tables, not tested.

| number | now | suggest | evidence |
| --- | --- | --- | --- |
| Billboard income (`upgrades` billboard `incomeShift`) | +10 | +7, or price $14,000 -> $20,000 | 0.031 BP a dollar and +46 BP a day for the 25% of seats that buy it, three times a monument; the best purchase in the game by a factor of three, and the tycoon and shark gain 5 to 6% from it, which pushed their win shares up in the trial runs |
| Memorial Garden price | $30,000 | $20,000 (and patience +2) | bought on day 26 on average, 7.5% of seats, measured return nothing; a late rating buy has no time to pay back. It needs to be buyable by day ~15 to be a choice at all |
| Night Watchman | $20,000, security 3 | keep the price; move the +2 rating to the Alarm, or make Security 3 cut the door roll by 50% | bought day 26 by 7% of seats, return -10 BP a day (se 9). Security matters to the 4.5% of a season a targeted parlor loses (about 970 BP), which is ~290 BP for the third level bought on day 1 and 0 bought on day 26 |
| `pvp.necroMult` (Necromancer in fights) | x1.25 | x1.10 | necromancer wins 2.51x its share on a mean 1.7% below the field; its PvP is 62 BP a day (33 parlor, 29 duel); 12% less is about 220 BP a season (1.1%) and less variance |
| `bank.savings.rate` and the tycoon's monuments 4 and 5 | 0.2% a day; 340 / 420 BP | 0.15%; 300 / 360 | tycoon +5.7% and 2.15x; it ends with $66,466 unspent (monuments maxed at 5.0), interest is only $1,950 a seat, so this is a small lever (about -0.5%); the bigger lever is the markup: `markup.ratingPer10` -4 -> -5 |
| a sixth monument tier, or a sink for idle cash | none | add | the tycoon ends with $66,466, the shark $39,584, the organiser $21,341 unspent: money has nowhere to go in the last week |
| win-share target itself | none below 1/3 | measure it on mean place or on mean BP within 2% of the field | in a field of eight with sellers' sd of 600 to 1,100 BP, a personality at the field mean wins 0.2 to 0.5 of its share; getting every steady seller above 1/3 needs either their means a few percent above the fighters', which makes the sellers win and the fighters never, or more variance for the sellers |

### What the bots cannot tell us

See the last section of the generated tables, "What only human playtesting can answer": the length of the day, walkouts, how often the town speaks, the election as a contest, ordinances read for their effects, grudges and bluffing, and wording.

---

Generated by `@fq/sim`: 200 towns of 8 bots, 30 days each, difficulty hard, base seed 1. 16,826,787 actions in 1305 s.

**Checks: passed.** No invariant breaks, rejected offered buttons, exploit signatures or stuck bots.

## Win rate by personality

| personality | seats | wins | win rate | fair share | mean final BP | mean place |
| --- | --- | --- | --- | --- | --- | --- |
| necromancer | 134 | 42 | 31.3% | 12.5% | 19407.5 | 4.47 |
| tycoon | 123 | 33 | 26.8% | 12.5% | 20878.0 | 2.42 |
| politician | 138 | 33 | 23.9% | 12.5% | 20496.6 | 3.12 |
| shark | 130 | 29 | 22.3% | 12.5% | 19915.4 | 4.07 |
| pacifist | 142 | 25 | 17.6% | 12.5% | 20064.7 | 4.27 |
| builder | 128 | 8 | 6.3% | 12.5% | 19970.7 | 4.58 |
| gambler | 133 | 8 | 6.0% | 12.5% | 19305.2 | 5.14 |
| saboteur | 137 | 7 | 5.1% | 12.5% | 18206.4 | 6.15 |
| saint | 122 | 6 | 4.9% | 12.5% | 19929.2 | 4.44 |
| organiser | 140 | 5 | 3.6% | 12.5% | 19898.0 | 4.55 |
| scholar | 145 | 3 | 2.1% | 12.5% | 19714.9 | 5.07 |
| mourner | 128 | 1 | 0.8% | 12.5% | 19308.8 | 5.55 |

## BP by personality

BP/turn counts only turns spent on customers; BP/day includes risks, events, mail rewards and battles.

| personality | player-days | BP/day | BP/turn | sale BP/turn | fight BP/day | turns/day | sales/day | walkouts | exact | within 3% | within 8% | bonus share of sale BP | price/limit | risks taken | risk BP/day |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tycoon | 3690 | 705.7 | 42.33 | 35.18 | 0.0 | 16.7 | 16.3 | 0.0% | 24.2% | 16.8% | 9.7% | 23.7% | 0.74 | 94.2% | 65.5 |
| politician | 4140 | 680.0 | 43.06 | 35.81 | 0.0 | 15.8 | 15.5 | 0.0% | 29.0% | 18.7% | 10.3% | 26.4% | 0.78 | 91.2% | 61.6 |
| shark | 3900 | 678.9 | 38.91 | 34.64 | 0.0 | 17.4 | 17.0 | 0.4% | 22.3% | 16.1% | 9.4% | 23.1% | 0.72 | 81.8% | 51.3 |
| builder | 3840 | 669.6 | 39.30 | 33.58 | 0.0 | 17.0 | 16.7 | 0.0% | 21.1% | 15.2% | 9.5% | 21.9% | 0.71 | 95.2% | 67.9 |
| organiser | 4200 | 668.0 | 39.89 | 33.89 | 0.0 | 16.7 | 16.4 | 0.0% | 22.8% | 16.3% | 9.5% | 23.1% | 0.73 | 93.9% | 64.0 |
| saint | 3660 | 663.1 | 42.90 | 34.56 | 0.0 | 15.5 | 15.1 | 0.0% | 27.5% | 17.7% | 9.8% | 25.9% | 0.76 | 90.5% | 56.9 |
| scholar | 4350 | 660.2 | 39.55 | 33.89 | 0.0 | 16.7 | 16.3 | 0.0% | 23.7% | 16.3% | 9.4% | 24.1% | 0.73 | 95.2% | 66.1 |
| pacifist | 4260 | 658.2 | 41.26 | 33.78 | 0.0 | 16.0 | 15.6 | 0.0% | 28.4% | 18.1% | 10.2% | 27.3% | 0.77 | 87.4% | 57.1 |
| gambler | 3990 | 648.3 | 41.20 | 34.10 | 19.1 | 15.7 | 15.4 | 0.1% | 25.5% | 17.9% | 11.3% | 25.0% | 0.77 | 75.9% | 43.7 |
| necromancer | 4020 | 644.2 | 41.04 | 32.88 | 33.0 | 15.7 | 15.4 | 0.2% | 24.9% | 17.5% | 11.7% | 24.9% | 0.77 | 65.3% | 39.0 |
| mourner | 3840 | 639.5 | 40.52 | 33.99 | 0.0 | 15.8 | 15.5 | 0.0% | 26.8% | 17.0% | 10.1% | 25.3% | 0.75 | 85.0% | 55.5 |
| saboteur | 4110 | 595.5 | 40.70 | 25.51 | 143.3 | 14.6 | 14.4 | 0.0% | 15.7% | 11.8% | 9.5% | 20.3% | 0.66 | 70.1% | 38.0 |

## BP by psych level (as the stats sheet shows it, at the start of the day)

| psych | player-days | BP/day | BP/turn | sale BP/turn | fight BP/day | turns/day | sales/day | walkouts | exact | within 3% | within 8% | bonus share of sale BP | price/limit | risks taken | risk BP/day |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 6660 | 502.0 | 33.56 | 25.80 | 69.2 | 15.0 | 14.9 | 0.1% | 16.4% | 11.7% | 9.8% | 20.5% | 0.67 | 60.9% | 31.0 |
| 2 | 1667 | 442.6 | 29.27 | 25.99 | 13.6 | 15.1 | 14.9 | 0.1% | 17.6% | 12.1% | 10.5% | 21.2% | 0.68 | 61.3% | 26.6 |
| 3 | 3026 | 521.9 | 34.28 | 28.22 | 34.9 | 15.2 | 15.0 | 0.1% | 20.1% | 14.0% | 10.6% | 22.8% | 0.71 | 74.5% | 36.8 |
| 4 | 7639 | 571.9 | 35.69 | 30.29 | 6.4 | 16.0 | 15.7 | 0.1% | 22.7% | 15.6% | 10.6% | 24.3% | 0.73 | 86.1% | 50.7 |
| 5 | 4280 | 598.8 | 36.79 | 31.47 | 2.5 | 16.3 | 15.9 | 0.1% | 24.2% | 16.2% | 10.3% | 24.9% | 0.74 | 92.6% | 60.0 |
| 6 | 4701 | 660.8 | 39.99 | 33.78 | 7.0 | 16.5 | 16.1 | 0.1% | 26.3% | 17.5% | 10.7% | 25.5% | 0.76 | 88.6% | 62.2 |
| 7 | 4084 | 725.3 | 43.55 | 36.40 | 7.4 | 16.7 | 16.2 | 0.1% | 27.9% | 18.5% | 10.2% | 25.7% | 0.77 | 90.9% | 66.5 |
| 8 | 15943 | 813.2 | 48.78 | 39.27 | 5.4 | 16.7 | 16.3 | 0.0% | 28.1% | 19.3% | 9.4% | 24.9% | 0.77 | 95.3% | 68.7 |

## The exact match

184681 of 758760 sales (24.3%) hit the spending limit exactly: 115.43 per player per 30 days. All closeness bonuses (exact, within 3%, within 8%) are the "bonus share" column above.

## Wait for Customer outcomes

| outcome | count | share |
| --- | --- | --- |
| customer | 774453 | 80.5% |
| event | 74787 | 7.8% |
| risk | 72749 | 7.6% |
| script | 39574 | 4.1% |
| noTurns | 0 | 0.0% |

## Tags

Income by source:

| category | gold-tag equivalents | share |
| --- | --- | --- |
| sales | 449028.5 | 93.6% |
| theft | 15609.3 | 3.3% |
| bonus tag | 11534.0 | 2.4% |
| other | 1732.0 | 0.4% |
| received | 1011.8 | 0.2% |
| black market | 578.0 | 0.1% |

Spending and losses by use:

| category | gold-tag equivalents | share |
| --- | --- | --- |
| psych | 165232.0 | 51.8% |
| hearse | 83616.0 | 26.2% |
| strength | 23517.0 | 7.4% |
| stolen | 15609.3 | 4.9% |
| hp | 14824.0 | 4.6% |
| club cover | 6903.5 | 2.2% |
| arson | 4422.0 | 1.4% |
| bingo | 2466.5 | 0.8% |
| transfers | 1349.0 | 0.4% |
| burned | 1195.3 | 0.4% |

| personality | arson | bingo | burned | club cover | hearse | hp | psych | stolen | strength | transfers |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gambler | 0.0 | 2408.8 | 117.3 | 952.3 | 9083.0 | 0.0 | 14896.0 | 1693.0 | 4788.0 | 0.0 |
| shark | 0.0 | 0.0 | 341.8 | 1624.0 | 16120.0 | 0.0 | 14336.0 | 1821.8 | 0.0 | 0.0 |
| saint | 0.0 | 57.8 | 27.0 | 1060.8 | 4148.0 | 0.0 | 13664.0 | 1244.0 | 0.0 | 586.0 |
| scholar | 0.0 | 0.0 | 1.3 | 1490.3 | 10005.0 | 0.0 | 16240.0 | 915.5 | 0.0 | 0.0 |
| mourner | 0.0 | 0.0 | 54.3 | 0.0 | 8832.0 | 0.0 | 14336.0 | 700.3 | 0.0 | 763.0 |
| politician | 0.0 | 0.0 | 85.0 | 0.0 | 4692.0 | 0.0 | 15456.0 | 1886.8 | 0.0 | 0.0 |
| organiser | 0.0 | 0.0 | 70.0 | 0.0 | 4760.0 | 0.0 | 15680.0 | 990.3 | 0.0 | 0.0 |
| builder | 0.0 | 0.0 | 27.0 | 0.0 | 8832.0 | 0.0 | 14336.0 | 893.5 | 0.0 | 0.0 |
| pacifist | 0.0 | 0.0 | 0.0 | 0.0 | 4828.0 | 0.0 | 15904.0 | 0.0 | 0.0 | 0.0 |
| necromancer | 0.0 | 0.0 | 383.8 | 95.3 | 4556.0 | 0.0 | 15008.0 | 2038.8 | 7236.0 | 0.0 |
| tycoon | 0.0 | 0.0 | 88.0 | 1540.0 | 4182.0 | 0.0 | 13776.0 | 1260.0 | 0.0 | 0.0 |
| saboteur | 4422.0 | 0.0 | 0.0 | 141.0 | 3578.0 | 14824.0 | 1600.0 | 2165.5 | 11493.0 | 0.0 |

## PvP

| measure | value |
| --- | --- |
| visits (doors reached) | 18860 |
| visits per player-day | 0.39 |
| refused at the door (online, police, locked) | 1032 |
| thefts | 6821 |
| tags per theft | 1.43 |
| battles started | 11007 |
| attacker wins / losses | 9611 / 1087 (89.8%) |
| BP won by winning attackers | 841059 |
| BP lost by losing attackers | 42924 |
| arsons hired / stopped by a smoke detector | 737 / 0 |
| Cursed Tigers / Lucky Sparrows / Lucky Dragons | 8010 / 896 / 2280 |

BP lost to other parlors' attacks, per player-day, by the victim's personality:

| personality | BP lost per day |
| --- | --- |
| shark | 21.6 |
| necromancer | 14.5 |
| gambler | 13.6 |
| tycoon | 13.5 |
| politician | 8.9 |
| builder | 8.4 |
| organiser | 8.2 |
| scholar | 6.8 |
| saint | 6.8 |
| mourner | 3.1 |
| saboteur | 0.4 |

## Snowball

At the end the leader has 1.07x the median parlor's BP.

| after day | leader went on to win |
| --- | --- |
| 1 | 24.5% |
| 3 | 26.5% |
| 5 | 29.5% |
| 10 | 34.5% |
| 15 | 43.0% |
| 20 | 53.5% |
| 25 | 68.5% |

| leader after day | builder | gambler | mourner | necromancer | organiser | pacifist | politician | saboteur | saint | scholar | shark | tycoon |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 21 | 17 | 10 | 21 | 20 | 8 | 19 | 15 | 12 | 13 | 17 | 27 |
| 5 | 13 | 12 | 4 | 12 | 24 | 16 | 32 | 10 | 20 | 18 | 15 | 24 |
| 10 | 12 | 2 | 8 | 13 | 13 | 24 | 52 | 15 | 23 | 8 | 6 | 24 |
| 15 | 6 | 2 | 13 | 19 | 11 | 28 | 64 | 12 | 23 | 3 | 5 | 14 |
| 20 | 5 | 4 | 12 | 31 | 7 | 30 | 59 | 9 | 21 | 4 | 11 | 7 |
| 25 | 8 | 5 | 5 | 43 | 3 | 26 | 38 | 8 | 14 | 8 | 13 | 29 |
| 30 | 8 | 8 | 1 | 42 | 5 | 25 | 33 | 7 | 6 | 3 | 29 | 33 |

| day | leader BP | runner-up | median | leader / median | lead over runner-up |
| --- | --- | --- | --- | --- | --- |
| 1 | 542.7 | 471.0 | 407.1 | 1.34 | 71.7 |
| 5 | 2691.0 | 2487.7 | 2218.7 | 1.22 | 203.3 |
| 10 | 5781.6 | 5449.5 | 5011.2 | 1.15 | 332.1 |
| 15 | 9204.6 | 8752.6 | 8180.4 | 1.13 | 452.1 |
| 20 | 13043.1 | 12497.6 | 11886.6 | 1.10 | 545.5 |
| 25 | 17233.7 | 16621.5 | 15932.0 | 1.08 | 612.2 |
| 30 | 21560.8 | 20829.3 | 20078.8 | 1.07 | 731.6 |

## Expanded: win rate by personality

| personality | seats | wins | win rate | fair share | win / fair | mean final BP | mean place |
| --- | --- | --- | --- | --- | --- | --- | --- |
| necromancer | 134 | 42 | 31.3% | 12.5% | 2.51 | 19,408 | 4.47 |
| tycoon | 123 | 33 | 26.8% | 12.5% | 2.15 | 20,878 | 2.42 |
| politician | 138 | 33 | 23.9% | 12.5% | 1.91 | 20,497 | 3.12 |
| shark | 130 | 29 | 22.3% | 12.5% | 1.78 | 19,915 | 4.07 |
| pacifist | 142 | 25 | 17.6% | 12.5% | 1.41 | 20,065 | 4.27 |
| builder | 128 | 8 | 6.3% | 12.5% | 0.50 | 19,971 | 4.58 |
| gambler | 133 | 8 | 6.0% | 12.5% | 0.48 | 19,305 | 5.14 |
| saboteur | 137 | 7 | 5.1% | 12.5% | 0.41 | 18,206 | 6.15 |
| saint | 122 | 6 | 4.9% | 12.5% | 0.39 | 19,929 | 4.44 |
| organiser | 140 | 5 | 3.6% | 12.5% | 0.29 | 19,898 | 4.55 |
| scholar | 145 | 3 | 2.1% | 12.5% | 0.17 | 19,715 | 5.07 |
| mourner | 128 | 1 | 0.8% | 12.5% | 0.06 | 19,309 | 5.55 |

## Expanded: win rate by karma path (at the end of the season)

| path | seats | wins | win rate | fair share | win / fair | mean final BP | mean place |
| --- | --- | --- | --- | --- | --- | --- | --- |
| evil | 299 | 53 | 17.7% | 12.5% | 1.42 | 18,957 | 5.19 |
| good | 571 | 65 | 11.4% | 12.5% | 0.91 | 19,800 | 4.55 |
| neutral | 730 | 82 | 11.2% | 12.5% | 0.90 | 20,037 | 4.18 |

| rivalry tier | seats | wins | win rate | fair share | win / fair | mean final BP | mean place |
| --- | --- | --- | --- | --- | --- | --- | --- |
| peaceful | 142 | 25 | 17.6% | 12.5% | 1.41 | 20,065 | 4.27 |
| cutthroat | 267 | 36 | 13.5% | 12.5% | 1.08 | 19,039 | 5.14 |
| standard | 1191 | 139 | 11.7% | 12.5% | 0.93 | 19,873 | 4.38 |

| PvP | seats | wins | win rate | fair share | win / fair | mean final BP | mean place |
| --- | --- | --- | --- | --- | --- | --- | --- |
| fights (parlor, duel or hit) | 521 | 84 | 16.1% | 12.5% | 1.29 | 19,235 | 4.93 |
| never fights | 1079 | 116 | 10.8% | 12.5% | 0.86 | 19,999 | 4.29 |

## Expanded: the parlors at the end of the season

| personality | final BP | cash | savings | karma | good / evil | upgrades | monuments | in a chain | mayor | BP lost to PvP | decisions / day | turns / day |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| builder | 19,971 | 15,565 | 0 | 49 | 1.6% / 0.0% | 7.8 | 3.1 | 65.6% | 0.0% | 446 | 343 | 17.1 |
| gambler | 19,305 | 9,816 | 0 | 59 | 24.8% / 0.0% | 7.2 | 2.7 | 0.0% | 0.0% | 644 | 364 | 16.5 |
| mourner | 19,309 | 3,870 | 0 | 100 | 100.0% / 0.0% | 8.1 | 2.3 | 70.3% | 0.0% | 199 | 342 | 16.7 |
| necromancer | 19,408 | 14,972 | 0 | 1 | 0.0% / 100.0% | 6.8 | 3.4 | 0.0% | 0.0% | 747 | 365 | 17.2 |
| organiser | 19,898 | 21,341 | 0 | 50 | 2.9% / 0.0% | 8.1 | 3.7 | 100.0% | 0.0% | 446 | 335 | 16.8 |
| pacifist | 20,065 | 18,272 | 0 | 100 | 100.0% / 0.0% | 7.0 | 3.2 | 0.0% | 0.0% | 0 | 354 | 16.9 |
| politician | 20,497 | 4,382 | 0 | 100 | 100.0% / 0.0% | 5.3 | 2.4 | 68.1% | 89.9% | 554 | 361 | 16.7 |
| saboteur | 18,206 | 10,306 | 0 | 1 | 0.0% / 100.0% | 8.5 | 2.8 | 0.0% | 0.0% | 102 | 304 | 16.2 |
| saint | 19,929 | 2,888 | 0 | 100 | 100.0% / 0.0% | 3.3 | 1.9 | 0.0% | 0.0% | 423 | 346 | 16.4 |
| scholar | 19,715 | 10,282 | 0 | 49 | 0.0% / 0.0% | 8.2 | 3.0 | 0.0% | 0.0% | 377 | 334 | 16.7 |
| shark | 19,915 | 39,584 | 0 | 36 | 0.0% / 21.5% | 8.5 | 4.3 | 0.0% | 0.0% | 826 | 403 | 17.5 |
| tycoon | 20,878 | 66,466 | 0 | 49 | 1.6% / 0.0% | 8.0 | 5.0 | 0.0% | 0.0% | 788 | 359 | 16.7 |

Decisions per bot-day across the town: 351 screens answered from log on to log off (the newspaper, every look at the hand of cards, every Back and every walk across the map included), of which 191 are choices (a pitch, a purchase, a vote: anything but looking and walking), for 16.1 customers a day.

## Expanded: selling

| personality | sales / day | walkouts | exact | within 3% | within 8% | bonus share of sale BP | sale BP / customer | money / sale | actions / sale | cremations | listened | coffee | blessed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| builder | 16.7 | 0.0% | 21.1% | 15.2% | 9.5% | 21.9% | 33.6 | 927 | 7.1 | 1.2% | 81.4% | 67.9% | 0.0% |
| gambler | 15.4 | 0.1% | 25.5% | 17.9% | 11.3% | 25.0% | 34.1 | 696 | 7.4 | 0.9% | 86.6% | 72.5% | 3.0% |
| mourner | 15.5 | 0.0% | 26.8% | 17.0% | 10.1% | 25.3% | 34.0 | 600 | 7.9 | 0.0% | 77.9% | 64.4% | 66.2% |
| necromancer | 15.4 | 0.2% | 24.9% | 17.5% | 11.7% | 24.9% | 32.9 | 920 | 7.4 | 2.5% | 86.5% | 72.5% | 0.8% |
| organiser | 16.4 | 0.0% | 22.8% | 16.3% | 9.5% | 23.1% | 33.9 | 892 | 7.0 | 2.0% | 79.8% | 66.3% | 0.1% |
| pacifist | 15.6 | 0.0% | 28.4% | 18.1% | 10.2% | 27.3% | 33.8 | 840 | 8.4 | 1.7% | 81.5% | 68.7% | 70.5% |
| politician | 15.5 | 0.0% | 29.0% | 18.7% | 10.3% | 26.4% | 35.8 | 499 | 8.5 | 0.0% | 85.0% | 74.8% | 75.2% |
| saboteur | 14.4 | 0.0% | 15.7% | 11.8% | 9.5% | 20.3% | 25.5 | 752 | 5.8 | 0.5% | 76.3% | 62.4% | 0.0% |
| saint | 15.1 | 0.0% | 27.5% | 17.7% | 9.8% | 25.9% | 34.6 | 621 | 8.0 | 0.0% | 79.4% | 69.7% | 69.4% |
| scholar | 16.3 | 0.0% | 23.7% | 16.3% | 9.4% | 24.1% | 33.9 | 775 | 7.1 | 0.3% | 77.6% | 64.6% | 0.0% |
| shark | 17.0 | 0.4% | 22.3% | 16.1% | 9.4% | 23.1% | 34.6 | 1,680 | 7.8 | 11.5% | 92.4% | 78.3% | 0.0% |
| tycoon | 16.3 | 0.0% | 24.2% | 16.8% | 9.7% | 23.7% | 35.2 | 1,545 | 7.5 | 3.6% | 83.0% | 69.9% | 0.1% |

Walkouts by trait (all customers who had the trait, hidden or shown):

| trait | customers | walkouts | rate |
| --- | --- | --- | --- |
| nervous | 43725 | 57 | 0.1% |
| hurry | 42774 | 51 | 0.1% |
| heir | 45333 | 43 | 0.1% |
| hothead | 44002 | 39 | 0.1% |
| foodie | 44661 | 39 | 0.1% |
| music-lover | 44816 | 34 | 0.1% |
| relieved | 42141 | 30 | 0.1% |
| rivalry | 44570 | 31 | 0.1% |
| showoff | 47455 | 33 | 0.1% |
| estranged | 42415 | 29 | 0.1% |
| country-club | 44195 | 30 | 0.1% |
| grudge | 42388 | 28 | 0.1% |
| germophobe | 44053 | 29 | 0.1% |
| windfall | 42832 | 28 | 0.1% |
| animal-lover | 44653 | 29 | 0.1% |
| death-fan | 46864 | 30 | 0.1% |
| executor | 42283 | 27 | 0.1% |
| no-nonsense | 43318 | 27 | 0.1% |
| loudmouth | 43599 | 27 | 0.1% |
| superstitious | 43513 | 26 | 0.1% |
| shutterbug | 44444 | 26 | 0.1% |
| pincher | 42508 | 24 | 0.1% |
| sentimental | 44314 | 25 | 0.1% |
| broke | 43014 | 24 | 0.1% |
| collector | 46855 | 26 | 0.1% |
| gossip | 44229 | 24 | 0.1% |
| green | 41718 | 22 | 0.1% |
| skeptic | 46542 | 24 | 0.1% |
| litigious | 44960 | 22 | 0.0% |
| conspiracy | 45026 | 22 | 0.0% |
| new-age | 43047 | 21 | 0.0% |
| traditionalist | 43059 | 21 | 0.0% |
| pushover | 44609 | 20 | 0.0% |
| prodigal | 40238 | 18 | 0.0% |
| devout | 45583 | 20 | 0.0% |
| been-here | 47265 | 20 | 0.0% |
| heartbroken | 40247 | 17 | 0.0% |
| minimalist | 42851 | 18 | 0.0% |
| accountant | 46752 | 19 | 0.0% |
| tight-lipped | 41871 | 17 | 0.0% |
| haggler | 47444 | 19 | 0.0% |
| know-it-all | 44772 | 14 | 0.0% |
| chatterbox | 43029 | 8 | 0.0% |
| serene | 42159 | 2 | 0.0% |

| special customer | met | sales | walkouts |
| --- | --- | --- | --- |
| county-contract | 3060 | 0 | 0 |
| pre-need | 6181 | 6178 | 3 |
| father-smyth | 2910 | 2909 | 1 |
| black-widow | 2922 | 2922 | 0 |
| clown-family | 3012 | 3012 | 0 |
| celebrity | 3108 | 3105 | 3 |
| old-man-withers | 3159 | 3158 | 1 |
| elijah | 2891 | 2891 | 0 |
| pet | 6145 | 6144 | 1 |
| teller | 2972 | 2971 | 1 |
| jackpot | 2922 | 2906 | 16 |
| ghost-crew | 2622 | 0 | 0 |
| the-mayor | 2737 | 2733 | 4 |
| zookeeper | 2859 | 2857 | 2 |
| the-twins | 2597 | 0 | 0 |
| fake-death | 2717 | 0 | 0 |
| blaine-director | 2764 | 2762 | 2 |
| cousin-sal | 2871 | 0 | 0 |
| mob-boss | 2734 | 2732 | 2 |
| the-count | 2550 | 2549 | 1 |
| nurse-referral | 2979 | 0 | 0 |

Packages sold (share of all sales reaching each tier or higher bought on that sale):

| package | tier 1 | tier 2 | tier 3 | tier 4 | tier 5 |
| --- | --- | --- | --- | --- | --- |
| plot | 10.1% | 3.2% | 6.2% | 0.0% | 0.0% |
| service | 1.8% | 0.3% | 0.1% | 0.1% | 0.0% |
| embalming | 3.0% | 1.7% | 0.3% | 0.8% | 0.0% |
| flowers | 1.3% | 0.1% | 0.0% | 0.0% | 0.0% |
| headstone | 2.2% | 0.2% | 0.1% | 0.0% | 0.0% |
| urn | 0.1% | 0.0% | 0.0% | 0.0% | 0.0% |

Soft-sell cards bought: 2.21 per sale.

## Expanded: money by system

Dollars earned per player-day:

| income | share | builder | gambler | mourner | necromancer | organiser | pacifist | politician | saboteur | saint | scholar | shark | tycoon |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sales | 82.7% | 15,464 | 10,748 | 9,304 | 14,148 | 14,629 | 13,127 | 7,734 | 10,820 | 9,401 | 12,668 | 28,614 | 25,226 |
| new day and mail | 5.4% | 1,009 | 885 | 900 | 880 | 973 | 955 | 950 | 708 | 913 | 940 | 1,020 | 1,006 |
| savings | 4.4% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 9,930 |
| body prep | 2.3% | 422 | 351 | 68 | 1,120 | 405 | 73 | 73 | 1,072 | 70 | 403 | 161 | 429 |
| loans | 2.0% | 2,398 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2,032 |
| special offers | 1.4% | 390 | 304 | 18 | 312 | 409 | 19 | 21 | 281 | 18 | 386 | 371 | 369 |
| rob graves | 0.6% | 0 | 0 | 0 | 544 | 0 | 0 | 0 | 599 | 0 | 0 | 0 | 0 |
| gambling | 0.5% | 0 | 1,109 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| parlor PvP | 0.4% | 0 | 232 | 0 | 99 | 0 | 0 | 0 | 26 | 0 | 0 | 433 | 0 |
| dig | 0.3% | 0 | 0 | 0 | 282 | 0 | 0 | 0 | 293 | 0 | 0 | 0 | 0 |

Dollars spent per player-day:

| spending | share | builder | gambler | mourner | necromancer | organiser | pacifist | politician | saboteur | saint | scholar | shark | tycoon |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| stock | 47.3% | 9,475 | 6,587 | 5,143 | 7,307 | 8,624 | 8,258 | 3,923 | 6,308 | 5,501 | 7,904 | 12,773 | 13,318 |
| upgrades | 17.6% | 4,024 | 2,560 | 2,561 | 2,576 | 3,188 | 2,562 | 1,435 | 2,883 | 650 | 3,280 | 5,444 | 4,174 |
| monuments | 9.8% | 1,201 | 946 | 559 | 1,642 | 2,083 | 1,382 | 606 | 926 | 336 | 1,029 | 3,549 | 5,533 |
| tithe | 4.7% | 647 | 619 | 586 | 642 | 660 | 657 | 575 | 629 | 2,606 | 639 | 667 | 667 |
| savings | 4.5% | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 9,865 |
| black market | 2.4% | 0 | 521 | 0 | 1,340 | 0 | 0 | 0 | 1,011 | 31 | 426 | 905 | 508 |
| loans | 2.2% | 2,470 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2,093 |
| hearse upkeep | 2.1% | 601 | 294 | 396 | 225 | 311 | 311 | 311 | 27 | 220 | 405 | 870 | 302 |
| leads | 2.0% | 0 | 0 | 0 | 1,193 | 0 | 0 | 0 | 0 | 0 | 0 | 2,911 | 0 |
| hits | 1.5% | 0 | 224 | 0 | 593 | 0 | 0 | 0 | 502 | 0 | 0 | 1,690 | 0 |
| story appeals | 1.1% | 0 | 0 | 374 | 486 | 0 | 299 | 287 | 475 | 347 | 0 | 0 | 0 |
| treatment | 1.1% | 125 | 221 | 113 | 407 | 127 | 0 | 270 | 121 | 207 | 111 | 232 | 216 |
| gambling | 0.6% | 0 | 1,140 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| permits | 0.5% | 246 | 50 | 133 | 0 | 179 | 0 | 0 | 0 | 125 | 184 | 0 | 0 |
| body prep | 0.4% | 53 | 73 | 102 | 41 | 56 | 108 | 106 | 32 | 99 | 52 | 99 | 49 |
| stolen | 0.4% | 29 | 75 | 20 | 141 | 36 | 0 | 41 | 270 | 29 | 28 | 57 | 49 |
| chains | 0.3% | 109 | 0 | 117 | 0 | 333 | 0 | 114 | 0 | 0 | 0 | 0 | 0 |
| ordinances | 0.3% | 0 | 0 | 0 | 0 | 0 | 0 | 578 | 0 | 0 | 0 | 0 | 0 |
| rob graves | 0.2% | 0 | 0 | 0 | 248 | 0 | 0 | 0 | 199 | 0 | 0 | 0 | 0 |
| inspection | 0.2% | 138 | 0 | 0 | 0 | 0 | 0 | 98 | 72 | 130 | 0 | 0 | 0 |
| midnight (fines, collection) | 0.2% | 6 | 32 | 8 | 81 | 29 | 10 | 1 | 43 | 3 | 31 | 119 | 37 |
| special offers | 0.2% | 38 | 27 | 34 | 29 | 31 | 38 | 38 | 23 | 38 | 34 | 32 | 33 |
| chain dues | 0.2% | 69 | 0 | 72 | 0 | 114 | 0 | 62 | 0 | 0 | 0 | 0 | 0 |
| election | 0.1% | 0 | 0 | 0 | 0 | 0 | 0 | 195 | 0 | 0 | 0 | 0 | 0 |
| holy water | 0.1% | 0 | 0 | 6 | 0 | 0 | 6 | 59 | 0 | 48 | 0 | 0 | 0 |
| confession | 0.0% | 0 | 0 | 2 | 0 | 0 | 2 | 0 | 0 | 2 | 0 | 0 | 0 |

## Expanded: BP by system (per player-day)

| source | share | builder | gambler | mourner | necromancer | organiser | pacifist | politician | saboteur | saint | scholar | shark | tycoon |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sales | 80.0% | 572 | 537 | 536 | 516 | 568 | 539 | 565 | 373 | 534 | 566 | 604 | 586 |
| risks | 8.2% | 68 | 44 | 56 | 39 | 64 | 57 | 62 | 38 | 57 | 66 | 51 | 66 |
| monuments | 2.6% | 16 | 13 | 9 | 19 | 23 | 18 | 9 | 13 | 6 | 15 | 31 | 40 |
| parlor PvP | 2.5% | 0 | 19 | 0 | 33 | 0 | 0 | 0 | 143 | 0 | 0 | 0 | 0 |
| service | 1.5% | 0 | 1 | 30 | 0 | 0 | 30 | 30 | 0 | 28 | 0 | 0 | 0 |
| midnight | 1.4% | 8 | 7 | 7 | 11 | 7 | 11 | 15 | 8 | 11 | 7 | 9 | 12 |
| duels | 1.2% | 0 | 23 | 0 | 29 | 0 | 0 | 0 | 40 | 0 | 0 | 0 | 0 |
| tithe | 1.1% | 5 | 6 | 7 | 3 | 5 | 8 | 7 | 3 | 31 | 5 | 5 | 5 |
| wait (events, scripts) | 0.7% | 5 | 4 | 4 | 4 | 5 | 5 | 5 | 4 | 4 | 5 | 4 | 5 |
| yangs | 0.6% | -0 | -1 | -5 | -1 | -0 | -0 | -0 | -21 | -0 | -0 | -20 | -0 |
| new day and mail | 0.2% | 1 | 1 | 1 | 1 | 2 | 1 | 1 | 1 | 1 | 2 | 2 | 1 |
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
| neg | 78.8% | 278 | 275 | 275 | 273 | 274 | 293 | 295 | 203 | 272 | 274 | 319 | 289 |
| desk | 7.9% | 29 | 28 | 27 | 28 | 28 | 26 | 28 | 27 | 27 | 28 | 30 | 29 |
| store | 3.0% | 11 | 10 | 9 | 11 | 11 | 11 | 8 | 10 | 9 | 11 | 13 | 13 |
| map | 2.6% | 7 | 10 | 9 | 12 | 7 | 8 | 8 | 12 | 11 | 7 | 9 | 8 |
| competitors | 0.9% | 0 | 8 | 0 | 8 | 0 | 0 | 0 | 13 | 0 | 0 | 9 | 0 |
| church | 0.9% | 1 | 6 | 5 | 1 | 1 | 6 | 5 | 1 | 9 | 1 | 1 | 1 |
| risk | 0.9% | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| reaper-club | 0.8% | 0 | 7 | 0 | 6 | 0 | 0 | 0 | 5 | 2 | 3 | 4 | 4 |
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
| a customer (Wait for Customer) | BP per turn | 33.526 | 774453 |
| leading the service | BP per turn | 33.163 | 14265 |
| a graveyard duel (challenger) | BP per turn | 43.523 | 8608 |
| robbing a grave | $ per try | 399.696 | 7096 |
| digging at the office | $ per try | 329.408 | 7096 |
| tending the graves | uses | - | 6796 |
| the seance | turns used | - | 6697 |
| monuments | BP per $ | 0.011 | 78050000 |
| tithes | BP per $ | 0.009 | 37702000 |
| hits (BP the victim lost per $) | BP per $ | 0.004 | 11935550 |
| special offers | BP per offer | 3.444 | 12877 |
| body prep choices | BP per choice | 0.000 | 321527 |
| risks taken | BP per risk | 42.584 | 62600 |

A lead from the nurse ($1,500) brings a sure, richer customer: 24,069 lead customers were met. Sale BP per customer over all customers: 33.53.

Parlor upgrades (share of seats that bought each, and the mean day bought):

| upgrade | bought | share of seats | mean day |
| --- | --- | --- | --- |
| paint | 1600 | 100.0% | 2.5 |
| coffee-machine | 1600 | 100.0% | 3.8 |
| storeroom | 1598 | 99.9% | 9.6 |
| florist-cooler | 1493 | 93.3% | 12.7 |
| viewing-room | 1446 | 90.4% | 15.2 |
| embalming-lab | 1377 | 86.1% | 17.5 |
| incinerator | 868 | 54.3% | 22.0 |
| chapel | 432 | 27.0% | 20.9 |
| billboard | 396 | 24.8% | 19.5 |
| guard-dog | 265 | 16.6% | 6.3 |
| alarm | 245 | 15.3% | 17.9 |
| memorial-garden | 120 | 7.5% | 26.6 |
| night-watchman | 110 | 6.9% | 26.3 |
| mausoleum | 67 | 4.2% | 26.6 |

The three late upgrades the engine pass made cheaper and better, and what they return:

| upgrade | bought | share of seats | mean day | cost with permit ($) | BP / day vs peers (after - before) | days owned | BP over the season | BP per $ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| night-watchman | 110 | 6.9% | 26.3 | 20,000 | -10.1 (se 9.2) | 3.7 | -37 | -0.002 |
| billboard | 396 | 24.8% | 19.5 | 15,500 | +45.8 (se 3.5) | 10.5 | 481 | 0.031 |
| memorial-garden | 120 | 7.5% | 26.6 | 34,000 | -30.1 (se 8.4) | 3.4 | -104 | -0.003 |

BP per day is measured against the same personality's seats on the same day that did not yet own the upgrade, so the season's rise in income cancels; the standard error is across buyers. The monuments return about 0.010 BP a dollar, so an upgrade that returns less is not worth buying for points alone.

Monument tiers built: tier 1: 1600, tier 2: 1580, tier 3: 1208, tier 4: 472, tier 5: 169 (of 1600 seats).

Permits bought: signage 804, zoning 744, crematory 165. Black-market buys: testimonials 614, morty-rib 878, clover 357, tap-water 288, monster-scale 298, coroner-list 1798, sal-pad 483, rabbit-foot 309, filed-tag 578, riot-shield 335, hot-casket 1689, haunted-casket 367, real-water 480, cop-day-off 252, bruno 401, used-wreaths 550, forged-permit 225, mayor-key 169, vest 343.

## Expanded: PvP, duels and hits

| measure | value |
| --- | --- |
| duels started | 8608 |
| challenger won / lost / yielded | 7218 / 916 / 474 |
| BP won by duel winners / lost by losers | 452,776 / 223,783 |
| duels with a Shove: share of duels / challenger won, lost, yielded / mean BP | 5.4% / 129, 286, 49 / -3.1 |
| duels without a Shove: challenger won, lost, yielded / mean BP | 7089, 630, 425 / 46.2 |
| Shove pressed (times) | 467 |
| hits resolved / landed | 827 / 686 |
| BP taken from hit victims | 46,489 |
| cash stolen in burglaries | 3,119,931 |

Hits by the parlor that hired them:

| personality | hired | landed | hirer behind the target | $ spent | BP taken from targets | BP per $ |
| --- | --- | --- | --- | --- | --- | --- |
| gambler | 59 | 47 | 96.6% | 893,950 | 3,248 | 0.004 |
| necromancer | 175 | 144 | 94.3% | 2,384,000 | 9,669 | 0.004 |
| saboteur | 149 | 130 | 96.0% | 2,065,100 | 8,675 | 0.004 |
| shark | 444 | 365 | 97.7% | 6,592,500 | 24,897 | 0.004 |

BP lost to other parlors per player-day, by victim and venue:

| personality | parlor fights | duels | hits | total | share of final BP |
| --- | --- | --- | --- | --- | --- |
| builder | 8.4 | 5.5 | 0.9 | 14.9 | 2.2% |
| gambler | 16.4 | 4.6 | 0.5 | 21.5 | 3.3% |
| mourner | 3.1 | 2.9 | 0.7 | 6.6 | 1.0% |
| necromancer | 20.4 | 3.2 | 1.3 | 24.9 | 3.8% |
| organiser | 8.2 | 5.7 | 0.9 | 14.9 | 2.2% |
| pacifist | 0.0 | 0.0 | 0.0 | 0.0 | 0.0% |
| politician | 8.9 | 7.2 | 2.4 | 18.5 | 2.7% |
| saboteur | 2.4 | 0.7 | 0.3 | 3.4 | 0.6% |
| saint | 6.8 | 5.3 | 2.1 | 14.1 | 2.1% |
| scholar | 6.8 | 5.1 | 0.6 | 12.6 | 1.9% |
| shark | 21.6 | 5.6 | 0.2 | 27.5 | 4.1% |
| tycoon | 13.5 | 10.9 | 1.8 | 26.3 | 3.8% |

The most-targeted peaceful parlor in each town (never fights) lost on average 973 BP over the season, 4.5% of what it would otherwise have had (worst town: 10.3%); it finished at mean place 2.81.

## Expanded: the house

| game and stake | plays | staked | returned | return per $ |
| --- | --- | --- | --- | --- |
| slots.100 | 8555 | 855,500 | 819,100 | 0.957 |
| slots.1000 | 2596 | 2,596,000 | 2,361,000 | 0.909 |
| slots.500 | 3628 | 1,814,000 | 1,961,000 | 1.081 |

Gamblers' net: gambler -31 $/day on 1,320 $/day staked.

## Expanded: the bank

| personality | loans taken | borrowed $ | repaid $ | collected | defaulted | written off $ | default BP | savings interest $ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| builder | 1304 | 9,483,313 | 9,483,313 | 0 | 0 | 0 | 0 | 0 |
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
| tycoon | 1364 | 7,723,455 | 7,723,455 | 0 | 0 | 0 | 0 | 240,192 |

## Expanded: City Hall and chains

| measure | value |
| --- | --- |
| ordinance ballots counted | 800 |
| votes per ballot / players | 8.00 / 8.00 |
| lobbying votes bought | 957 |
| elections held (of towns) | 200 of 200 |
| candidates per election | 0.62 |
| votes per election / players | 4.96 / 8.00 |
| campaign ads bought | 13 |
| mayors by personality | politician 124 |
| chains founded / joined | 140 / 268 |
| chains alive at the end, mean members | 140, 2.91 |

| chain | seats | wins | win rate | fair share | win / fair | mean final BP | mean place |
| --- | --- | --- | --- | --- | --- | --- | --- |
| no chain | 1192 | 161 | 13.5% | 12.5% | 1.08 | 19,673 | 4.51 |
| in a chain | 408 | 39 | 9.6% | 12.5% | 0.76 | 19,976 | 4.47 |

## Expanded: the Daily Challenge

| difficulty | runs | mean score | sd | min | max |
| --- | --- | --- | --- | --- | --- |
| hard | 72 | 419.2 | 64.8 | 313 | 586 |
| normal | 72 | 418.9 | 57.8 | 325 | 586 |
| easy | 72 | 364.1 | 57.2 | 189 | 512 |

6 challenges. Within one challenge (same customers for everyone) the scores spread by 229 BP on average from the worst run to the best; across challenges the hard bots' mean score varies by 44 BP (sd), the luck of the day.

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
| reaper-club:bodyguard | 924 | 0 | 0.0% | 0 |
| reaper-club:buy:tiny | 899 | 0 | 0.0% | 0 |
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
| neg:soft | 3174780 | 1984.2 | 1600 | 100.0% |
| neg:card | 2550993 | 1594.4 | 1600 | 100.0% |
| neg:packages | 1080028 | 675.0 | 1600 | 100.0% |
| neg:listen | 1037316 | 648.3 | 1600 | 100.0% |
| desk:wait | 961563 | 601.0 | 1600 | 100.0% |
| neg:done | 758760 | 474.2 | 1600 | 100.0% |
| neg:hard | 551925 | 345.0 | 1600 | 100.0% |
| neg:coffee | 526543 | 329.1 | 1600 | 100.0% |
| neg:pkg:plot | 372587 | 232.9 | 1600 | 100.0% |
| prep:start | 321527 | 201.0 | 1600 | 100.0% |
| prep:choice | 321527 | 201.0 | 1600 | 100.0% |
| store:casket:0 | 180102 | 112.6 | 1600 | 100.0% |
| neg:bless | 175376 | 109.6 | 682 | 100.0% |
| neg:discount | 148419 | 92.8 | 1600 | 100.0% |
| store:casket:1 | 107817 | 67.4 | 1600 | 100.0% |
| neg:pkg:embalming | 103091 | 64.4 | 1600 | 100.0% |
| place:funeral-home | 99344 | 62.1 | 1600 | 100.0% |
| place:store | 89631 | 56.0 | 1600 | 100.0% |
| neg:guilt | 77533 | 48.5 | 1600 | 100.0% |
| risk:take | 62600 | 39.1 | 1600 | 99.3% |
| desk:quit | 48000 | 30.0 | 1600 | 100.0% |
| store:caskets | 47969 | 30.0 | 1600 | 100.0% |
| neg:pkg:headstone | 38198 | 23.9 | 1600 | 100.0% |
| place:church | 37909 | 23.7 | 1600 | 100.0% |
| church:tithe | 37702 | 23.6 | 1600 | 100.0% |
| neg:pkg:service | 37125 | 23.2 | 1600 | 100.0% |
| neg:pkg:flowers | 35834 | 22.4 | 1600 | 100.0% |
| place:reaper-club | 30859 | 19.3 | 1600 | 57.8% |
| place:hospital | 29849 | 18.7 | 1600 | 86.4% |
| place:graveyard | 29456 | 18.4 | 1600 | 100.0% |
| place:yangs | 24441 | 15.3 | 1600 | 53.9% |
| place:bank | 23171 | 14.5 | 1600 | 100.0% |
| church:bingo-card | 21568 | 13.5 | 664 | 100.0% |
| neg:cremation | 21424 | 13.4 | 865 | 99.9% |
| reaper-club:market | 20504 | 12.8 | 924 | 100.0% |
| neg:sympathy | 20203 | 12.6 | 1600 | 99.9% |
| competitors:visit | 20130 | 12.6 | 534 | 100.0% |
| place:city-hall | 19584 | 12.2 | 1600 | 100.0% |
| store:casket:2 | 19438 | 12.1 | 1600 | 94.3% |
| battle:attack | 19247 | 12.0 | 403 | 100.0% |
| parlor:upgrades | 18944 | 11.8 | 1600 | 100.0% |
| competitors:trydoor | 18860 | 11.8 | 534 | 100.0% |
| place:competitors | 17107 | 10.7 | 1600 | 33.4% |
| competitors:look | 16020 | 10.0 | 534 | 100.0% |
| bank:all-gold | 15773 | 9.9 | 1600 | 100.0% |
| church:bingo | 15743 | 9.8 | 1600 | 41.5% |
| place:cafe | 15568 | 9.7 | 1600 | 100.0% |
| graveyard:swing | 15341 | 9.6 | 404 | 100.0% |
| reaper-club:slots | 14779 | 9.2 | 133 | 100.0% |
| church:serve | 14265 | 8.9 | 547 | 100.0% |
| reaper-club:pay | 13931 | 8.7 | 892 | 100.0% |
| graveyard:monuments | 13676 | 8.5 | 1600 | 100.0% |
| neg:offer:accept | 12877 | 8.0 | 1597 | 99.1% |
| place:spirit-university | 12674 | 7.9 | 1600 | 100.0% |
| city-hall:chains | 12044 | 7.5 | 1600 | 33.4% |
| tutorial:next | 11200 | 7.0 | 1600 | 100.0% |
| yangs:menu | 11186 | 7.0 | 527 | 100.0% |
| competitors:attack | 11007 | 6.9 | 534 | 75.5% |
| hospital:lead | 10766 | 6.7 | 1382 | 19.1% |
| spirit-university:psych | 10500 | 6.6 | 1600 | 99.8% |
| graveyard:duel | 10500 | 6.6 | 526 | 76.8% |
| risk:decline | 10149 | 6.3 | 1600 | 82.5% |
| battle:yellwin | 9611 | 6.0 | 402 | 100.0% |
| city-hall:ordinance | 8853 | 5.5 | 1600 | 100.0% |
| hospital:treat | 8553 | 5.3 | 1377 | 95.0% |
| city-hall:inspection | 8071 | 5.0 | 1600 | 32.8% |
| yangs:tiger | 8010 | 5.0 | 863 | 30.9% |
| store:hearse | 7872 | 4.9 | 1600 | 99.3% |
| parlor:dig | 7096 | 4.4 | 301 | 90.0% |
| graveyard:rob | 7096 | 4.4 | 301 | 90.0% |
| competitors:steal | 6821 | 4.3 | 534 | 100.0% |
| graveyard:tend | 6796 | 4.2 | 602 | 20.3% |
| reaper-club:seance | 6697 | 4.2 | 283 | 100.0% |
| city-hall:vote | 6400 | 4.0 | 1600 | 100.0% |
| graveyard:monument | 5029 | 3.1 | 1600 | 100.0% |
| arc:give:church | 4855 | 3.0 | 789 | 55.4% |
| arc:give:reaper-club | 4101 | 2.6 | 924 | 29.3% |
| neg:offer:decline | 3969 | 2.5 | 1597 | 46.9% |
| store:hearse-look | 3936 | 2.5 | 1588 | 100.0% |
| store:buy | 3936 | 2.5 | 1588 | 100.0% |
| bank:savings | 2817 | 1.8 | 1600 | 7.7% |
| bank:loan | 2668 | 1.7 | 1600 | 15.7% |
| bank:borrow | 2668 | 1.7 | 251 | 100.0% |
| bank:repay | 2668 | 1.7 | 251 | 100.0% |
| neg:pkg:urn | 2618 | 1.6 | 861 | 67.5% |
| neg:raise | 2417 | 1.5 | 283 | 98.6% |
| yangs:dragon | 2280 | 1.4 | 863 | 24.3% |
| bank:deposit | 2173 | 1.4 | 123 | 100.0% |
| reaper-club:games | 1970 | 1.2 | 924 | 14.4% |
| arc:give:city-hall | 1826 | 1.1 | 1024 | 32.9% |
| reaper-club:buy:coroner-list | 1798 | 1.1 | 899 | 44.2% |
| city-hall:election | 1694 | 1.1 | 1600 | 62.9% |
| reaper-club:buy:hot-casket | 1689 | 1.1 | 901 | 42.3% |
| spirit-university:strength | 1670 | 1.0 | 1600 | 25.3% |
| tutorial:start | 1600 | 1.0 | 1600 | 100.0% |
| parlor:buy:paint | 1600 | 1.0 | 1600 | 100.0% |
| parlor:buy:coffee-machine | 1600 | 1.0 | 1600 | 100.0% |
| parlor:buy:storeroom | 1598 | 1.0 | 1599 | 99.9% |
| parlor:buy:florist-cooler | 1493 | 0.9 | 1599 | 93.4% |
| city-hall:certify | 1462 | 0.9 | 525 | 83.4% |
| parlor:buy:viewing-room | 1446 | 0.9 | 1460 | 99.0% |
| parlor:buy:embalming-lab | 1377 | 0.9 | 1552 | 88.7% |
| bank:transferhome | 1349 | 0.8 | 1600 | 15.6% |
| bank:transfer | 1349 | 0.8 | 250 | 100.0% |
| bank:transfer-tier | 1349 | 0.8 | 250 | 100.0% |
| city-hall:permits | 1319 | 0.8 | 1600 | 49.7% |
| battle:yelllost | 1087 | 0.7 | 295 | 100.0% |
| hospital:leave-room | 1087 | 0.7 | 295 | 100.0% |
| reaper-club:hit | 1026 | 0.6 | 924 | 38.2% |
| city-hall:elect | 992 | 0.6 | 992 | 100.0% |
| city-hall:invite | 973 | 0.6 | 283 | 49.5% |
| city-hall:lobby | 957 | 0.6 | 1600 | 8.6% |
| yangs:sparrow | 896 | 0.6 | 863 | 14.8% |
| reaper-club:buy:morty-rib | 878 | 0.5 | 907 | 29.5% |
| parlor:buy:incinerator | 868 | 0.5 | 1098 | 79.1% |
| church:water | 774 | 0.5 | 920 | 35.2% |
| spirit-university:hp | 671 | 0.4 | 1600 | 8.6% |
| city-hall:permit:signage | 668 | 0.4 | 795 | 84.0% |
| bank:withdrawall | 644 | 0.4 | 123 | 100.0% |
| reaper-club:buy:testimonials | 614 | 0.4 | 908 | 14.1% |
| city-hall:permit:zoning | 610 | 0.4 | 795 | 76.7% |
| reaper-club:buy:filed-tag | 578 | 0.4 | 851 | 29.3% |
| reaper-club:buy:used-wreaths | 550 | 0.3 | 914 | 14.9% |
| city-hall:bribe | 491 | 0.3 | 137 | 100.0% |
| reaper-club:buy:sal-pad | 483 | 0.3 | 874 | 14.4% |
| reaper-club:buy:real-water | 480 | 0.3 | 873 | 15.1% |
| graveyard:yield | 474 | 0.3 | 404 | 58.4% |
| graveyard:shove | 467 | 0.3 | 404 | 62.4% |
| parlor:buy:chapel | 432 | 0.3 | 441 | 98.0% |
| parlor:rivalry | 409 | 0.3 | 1600 | 25.6% |
| reaper-club:buy:bruno | 401 | 0.3 | 864 | 15.0% |
| parlor:buy:billboard | 396 | 0.2 | 713 | 55.5% |
| reaper-club:buy:haunted-casket | 367 | 0.2 | 845 | 14.3% |
| reaper-club:buy:clover | 357 | 0.2 | 912 | 13.4% |
| reaper-club:buy:vest | 343 | 0.2 | 903 | 14.6% |
| reaper-club:buy:riot-shield | 335 | 0.2 | 832 | 24.0% |
| reaper-club:buy:rabbit-foot | 309 | 0.2 | 908 | 13.1% |
| battle:run | 309 | 0.2 | 403 | 44.7% |
| reaper-club:buy:monster-scale | 298 | 0.2 | 899 | 13.3% |
| reaper-club:buy:tap-water | 288 | 0.2 | 909 | 13.0% |
| city-hall:join | 268 | 0.2 | 268 | 100.0% |
| parlor:rivalry:cutthroat | 267 | 0.2 | 409 | 65.3% |
| parlor:buy:guard-dog | 265 | 0.2 | 1599 | 16.6% |
| parlor:markup | 253 | 0.2 | 1600 | 15.8% |
| reaper-club:buy:cop-day-off | 252 | 0.2 | 766 | 13.8% |
| parlor:buy:alarm | 245 | 0.2 | 265 | 92.5% |
| reaper-club:buy:forged-permit | 225 | 0.1 | 861 | 14.6% |
| reaper-club:buy:mayor-key | 169 | 0.1 | 834 | 13.3% |
| parlor:rivalry:peaceful | 142 | 0.1 | 409 | 34.7% |
| city-hall:found | 140 | 0.1 | 432 | 32.4% |
| parlor:markup:20 | 130 | 0.1 | 253 | 51.4% |
| city-hall:file | 124 | 0.1 | 124 | 100.0% |
| parlor:markup:10 | 123 | 0.1 | 253 | 48.6% |
| parlor:buy:memorial-garden | 120 | 0.1 | 378 | 31.7% |
| parlor:buy:night-watchman | 110 | 0.1 | 148 | 74.3% |
| parlor:buy:mausoleum | 67 | 0.0 | 121 | 55.4% |
| church:confess | 59 | 0.0 | 1232 | 4.3% |
| city-hall:permit:crematory | 41 | 0.0 | 795 | 5.2% |
| city-hall:ads | 13 | 0.0 | 105 | 12.4% |
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
| reaper-club:bodyguard | 0 | 0.0 | 924 | 0.0% |
| reaper-club:buy:tiny | 0 | 0.0 | 899 | 0.0% |
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
- **Walkout pacing.** 0.1% of 774,453 customers walked out. Bots stop pushing before the mood does, so this is the floor; a person who misreads a customer, or is greedy for the exact match (24.3% of the bots' sales), will see far more. Whether a walkout feels like a fair lesson or a punishment is not measurable here.
- **How often the town speaks.** News changed the rules on 57.6% of days, a weather set on 100.0%, and a story arc was running on 63.0% of days (3.0 arcs and 6.2 story beats a town a season). Bots read none of it as a story; whether that is too much, too little, or repeats itself by day 20 needs readers.
- **Is the election a contest?** 0.62 candidates stood in each of 200 elections and 8.0 parlors voted: the bots vote by a preference list. Whether people campaign, lobby or bluff is a social question.
- **Ordinances and arcs by effect, not by rote.** The bots rank ordinances from a fixed list (800 ballots, 8.00 votes each, 957 lobbying votes bought). Do players read the effects and choose, or click the first?
- **Grudges and bluffing.** 8,608 duels and 827 hits happened with no memory of who did what to whom. Retaliation, alliances and the Peace Pledge as a social contract are for people.
- **Wording.** The bots read panels and button ids, and `packages/bots/test/scrambled.test.ts` plays a season with every pack string reworded and sees no stuck day; that proves the text does not carry rules, not that it is funny, clear or tonally right.

