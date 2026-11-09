# Expanded tuning log

Each round: what changed and why, and the numbers before and after. Unless a round says otherwise, a run is `pnpm --filter @fq/sim run sim -- --days 30 --towns 44 --players 8 --rules expanded --seed 1` (44 towns of 8 hard bots drawn from the twelve personalities, a 30-day season, the built-in `expandedPack`). "Win / fair" is a personality's win rate over its fair share (1 in 8); the targets are 0.33 to 2. BP figures are mean final BP per seat.

## Round 0: the bots and the simulator, no rule changes

The first Expanded runs with the new bots. Bot and simulator bugs fixed on the way (not rule changes): the bots read ballots from the town strip only where it is shown (they had stopped voting at City Hall, where the strip is absent); the simulator counted Expanded customer turns twice; hits were judged by one injury id.

| measure | value |
| --- | --- |
| win / fair | saboteur 5.23, shark 2.06, necromancer 1.70, tycoon 1.54, gambler 1.33, politician 0.55, the other six 0 |
| by karma path | evil 3.25, neutral 0.80, good 0.14 |
| saboteur | 214 BP a day from parlor fights (2 to 3 free visits a day, attackers win 93%), 66 from duels |
| duels | 77 BP per duel won, 91% won by the challenger; a customer turn is worth 34.5 BP |
| closeness bonuses | exact on 23% of sales, 28% of sale BP |
| decisions | 337 screens a bot-day |
| loans | 268 loans, every one repaid the same day: interest is charged only at midnight, so a same-day loan was free credit |

Findings: parlor fights cost no turn and pay up to 120 BP each (1.5 x sqrt of the victim's BP), so PvP dominates; the good path has nothing that turns a turn into as much BP as a customer (the service paid 20 BP a turn, tending nothing); robbing graves and digging pay about $380 a turn, far below a customer.

## Round 1

| change | from | to | why |
| --- | --- | --- | --- |
| `pvp.gainFactor`, `pvp.gainCap` | 1.5, 120 | 0.75, 60 | fights and duels pay double a customer |
| `karma.evilTurns` | [1, 2] | [1, 1] | evil's extra turns plus fights |
| `rating.karmaBonus` | [2, 4] | [3, 6] | the good path's reward is reputation |
| `church.service` | 10 + rating / 5 | 20 + rating / 4 | a turn at the service should be worth a customer |
| `graveyard.tend.turns` | 1 | 0 | tending (luck, word of mouth, a lead now and then) cost a whole customer |
| bank loans: `bank.loan.fee` (new) | 0 | 3% | the first day's interest is charged when the money is lent (engine change, section 21.3) |

Result: overcorrected. Evil 0 wins (saboteur last at 15,238 BP); shark 4.65 and tycoon 3.69 (money from a high markup and a full storeroom); good 0.71. Peaceful victims lose 4.0% (was 7.7%).

## Round 2

| change | from | to | why |
| --- | --- | --- | --- |
| `pvp.gainFactor`, `pvp.gainCap` | 0.75, 60 | 1.0, 80 | between rounds 0 and 1 |
| `karma.evilTurns` | [1, 1] | [1, 2] | back: the evil path needs it |
| bots | | | every bot fills its storeroom (6, or 18 with the storeroom upgrade, now bought third): rush orders keep almost nothing, so stock is the money engine |

Result: shark 4.39, politician 3.03, tycoon 2.77; organiser, saint, scholar, mourner, builder 0; evil 0.27, good 0.92, neutral 1.29. The leaders are 8% above the field's 19,500 BP: the shark's +20% markup earns $1,892 a sale against about $800 (and the money buys monuments and leads), the mayor's extra turn a day is worth about 700 BP for a $5,000 fee, and evil still wastes two turns a day robbing and digging.

## Round 3

| change | from | to | why |
| --- | --- | --- | --- |
| `pvp.gainFactor`, `pvp.gainCap` | 1.0, 80 | 1.25, 100 | the saboteur was 11% below the field |
| `markup.cheapnessPer10`, `markup.ratingPer10` | 0.5, -2 | 1.0, -3 | a high markup was free money: it moves the customer's limit from 8%-margin extras to the casket |
| `hospital.lead.price` | $750 | $1,200 | a lead (a sure, richer customer) returned more BP per dollar than a monument |
| `cityHall.election.fee` | $5,000 | $10,000 | the mayor's extra turn a day for 20 days was worth about 700 BP |
| `karma.dig.turns`, `graveyard.rob.turns` | 1, 1 | 0, 0 | they paid about $380 a turn against a customer's 34 BP and $800; now, like tending for the good path, they are free daily actions (2 a day, shared) |
| bots | | | the Soft Touch buys hearses to 3 (it stopped at 1); the gambler studies psych to 6 before strength |

Result: overshot the other way for evil. Necromancer 4.61 (21,941 BP), saboteur 4.31; good 0.21, neutral 0.36, evil 4.33. Only one politician could afford the $10,000 filing on days 1 to 7 (elections fell from 23 candidates to 1). Peaceful victims lose 5.7% (worst town 10.4%).

## Round 4

| change | from | to | why |
| --- | --- | --- | --- |
| `karma.evilTurns` | [1, 2] | [0, 1] | the free robbing and digging now carry the Grave Robber; two extra turns a day were 10% of a parlor's income |
| `karma.goodCheapness`, `karma.trustedMood` | -0.3, 0.5 | -0.8, 0.8 | the good path's perks barely moved a customer (its rating bonus shifts the income roll by about 1 point in 100) |
| `pvp.gainFactor`, `pvp.gainCap` | 1.25, 100 | 1.1, 90 | with free digging the fighters needed less |
| `cityHall.election.fee` | $10,000 | $7,500 | so a politician can file in the first week |
| bots | | | the politician sets the filing fee aside before buying stock and upgrades; the gambler plays the slots (the 2.4% edge, not the draw's 3.85%) at a random stake each play, so the house can be measured by stake |

Result: the karma paths came together: good 1.20 (20,844 BP), evil 1.49 (19,077), neutral 0.71 (19,588). By personality: politician 3.31 (21,947), tycoon 2.46, shark 1.81, saboteur 1.54, necromancer 1.45, pacifist 1.07, saint 0.29, gambler 0.27, Soft Touch, scholar, organiser and builder 0. The field is now within about 7% of its mean, and that is enough to decide every town: the winner is usually whichever of the top three strategies drew the better customers. Two stuck bot-days: the Twins refused a Peace Pledge target and the saboteur offered the same target forever (bot fix: two tries, then give up).

## Round 5

| change | from | to | why |
| --- | --- | --- | --- |
| `pvp.gainFactor`, `pvp.gainCap` | 1.1, 90 | 1.2, 100 | the saboteur at -5% |
| `karma.goodCheapness` | -0.8 | -0.65 | the good path was now ahead on mean BP |
| `pvp.peacefulTax` | 5% | 8% | the Peace Pledge parlor was 4% above the field: its insurance cost less than the attacks it avoids |
| `psych.calm.cheapness` | 0.25 | 0.3 | psych bought little once the karma perks counted for more |
| `cityHall.election.fee` | $7,500 | $10,000 | the politician led (3.31) |
| `chains.dues`, `chains.rating`, `chains.stockMult` | $250, +2, 0.95 | $150, +4, 0.9 | chain members (the organiser and those it invites) were below the field |
| `bank.savings.rate` | 0.5% | 0.3% a day | 16% a season on idle money carried the tycoon |
| bots | | | wider black-market shopping lists (the pack sells 20 items); the gambler's budget halved |

Result: politician 3.03 (21,709 BP, never mayor: no politician could save $10,000 in the first week), saboteur 2.46, necromancer 2.18, tycoon 1.85; organiser, scholar, builder, saint 0. Good 1.06, evil 2.31 (on a lower mean BP than good, 19,907 against 20,877: PvP makes evil results swing, sd 2,386 against 935), neutral 0.53. The saint and the pacifist lost 20 BP a day sending Lucky Sparrows at Yang's: a Classic habit the bots carried over.

## Round 6

| change | from | to | why |
| --- | --- | --- | --- |
| `psych.calm.cheapness` | 0.3 | 0.35 | the neutral sellers (scholar, builder) trail |
| `upgrades` income shifts: chapel, billboard, crematorium | 10, 5, 5 | 15, 8, 8 | the late upgrades are the neutral builder's path and cost $20,000 to $60,000 |
| `cityHall.election.fee` | $10,000 | $6,000 | elections had no candidates |
| `cityHall.election.perks` | 1 turn, +3 rating | 0 turns, +5 rating | the politician leads without the office; an extra turn a day on top would run away with it |
| bots | | | under Expanded rules only the griefers send Cursed Tigers and only the Soft Touch sends sparrows |

Result: tycoon 2.15 (22,233 BP), necromancer 1.94, saboteur 1.85, politician 1.66, pacifist 1.60, shark 1.55, gambler 0.80, mourner 0.31, saint 0.29; organiser, scholar, builder 0. The field is within +7% / -5% of its mean (20,802). Good 0.99, evil 1.70, neutral 0.74. Elections: 28 candidates in 44 towns.

## Round 7

| change | from | to | why |
| --- | --- | --- | --- |
| `karma.goodCheapness`, `rating.karmaBonus` | -0.65, [3, 6] | -0.5, [2, 5] | the good path was 3% above neutral on mean BP |
| monuments 4 and 5 | 420, 600 BP | 380, 500 BP | the tycoon (the only one who builds them) was 7% above the field |
| `bank.savings.rate` | 0.3% | 0.25% a day | the same |
| bots | | | the builder goes for the chapel (viewing room, then chapel) before the florist and the embalming lab |

Result: tycoon 2.77 (22,218 BP), necromancer 2.42, saboteur 2.15, politician 1.66, pacifist 1.07, shark 1.03, saint 0.57, gambler 0.53; organiser, Soft Touch, scholar, builder 0. Mean BP from 19,622 (gambler) to 22,218 (tycoon) around 20,777. Good 0.85, evil 2.38, neutral 0.59. Reading: several bots ended the season with $30,000 to $40,000 unspent, which is BP thrown away; the tycoon's edge was mostly that it alone builds all five monuments.

## Round 8

| change | from | to | why |
| --- | --- | --- | --- |
| bots | | | from day 25 every bot builds every monument it can afford, and on the last two days it tithes what is left (money is worth nothing after the season); the Soft Touch sends a sparrow every fourth day instead of daily |
| `underdog.scale`, `underdog.max` | 0.5, 25% | 1.5, 75% | a late joiner (comparison run, one bot joining on day 10) finished at place 8.5 of 9 |
| text | | | the Peace Pledge insurance and the mayor's perks are now `{tax}` and `{rating}` placeholders in the starter text (they had numbers written in) |

Result: mean BP 21,294 (it rose by 500: idle money became monuments); range 19,962 (gambler) to 22,372 (politician), +5% / -6%. Win / fair: tycoon 2.46, necromancer 2.42, pacifist 2.13, shark 1.55, politician 1.38, saboteur 0.92, gambler 0.53, Soft Touch 0.31, saint 0.29, organiser, scholar, builder 0. Good 1.06, evil 1.70, neutral 0.72. The late joiner still finished 8.5th of 9 (17,659 BP, 84% of the median): at 70% of the leader the underdog bonus stops, so it can never carry a newcomer to the middle.

## Round 9

| change | from | to | why |
| --- | --- | --- | --- |
| `pvp.gainFactor`, `pvp.gainCap` | 1.2, 100 | 1.3, 110 | the saboteur at -4% |
| `cityHall.election.perks.rating` | +5 | +3 | the politician at +5% |
| `cityHall.inspection.certificate.reviews` | +2 | +1 | the same: the politician renews a certificate every week |
| `hospital.lead.price` | $1,200 | $1,500 | the shark (two leads a day) at +3.5% |
| `bank.savings.rate` | 0.25% | 0.2% a day | the tycoon at +5% |
| `underdog` | below 70%, x1.5, at most 75% | below 70%, x0.5, at most 25% (as specified), plus `underdog.late`: below 95%, x2, at most 100% | new rule (engine change, section 9.4): a parlor created after the season's first day gets the stronger catch-up; established parlors that trail keep the specified one, so the field is not flattened |
| bots | | | the scholar and the gambler buy a third hearse |

Result: mean BP 20,222 to 22,305 (+5.5% / -4.3%). Win / fair: necromancer 2.67, tycoon 2.15, saboteur 1.85, pacifist 1.33, shark 1.29, politician 1.10, gambler 0.80, saint 0.29, builder 0.27, organiser 0.26, scholar and Soft Touch 0. On mean BP the karma paths are within 2% (good 21,414, evil 21,078, neutral 20,977), but evil wins 2.32 times its share: PvP makes fighters' seasons swing (sd 2,400 BP against 870 for good sellers), and in a tight field the swings win towns. Late joiner (33 towns, joining on day 10): place 7.27 of 9 (was 8.5), 19,866 BP against a median of 21,025.

## Round 10

| change | from | to | why |
| --- | --- | --- | --- |
| `pvp.gainFactor`, `pvp.gainCap` | 1.3, 110 | 1.15, 100 | the necromancer won 2.67 times its share on an average mean BP: fighters' seasons swing, so their mean must sit a little below the sellers' for their win rate to be fair |
| `markup.ratingPer10` | -3 | -4 | the shark and the tycoon still earned the most money per sale |
| psych price (`places.university.psychPerLevel`) | 3 | 4 gold a level | everyone reached psych 8 by mid-season, so the scholar's early psych bought nothing lasting |
| `underdog.late` | below 95%, x2, 100% | below 98%, x3, 150% | the late joiner reached 94% of the median but not the middle of the table |

Result: mean BP 19,486 (saboteur) to 22,088 (tycoon). Win / fair: necromancer 2.67, shark 2.32, tycoon 2.15, politician 1.66, saboteur 0.92, builder and pacifist 0.53, Soft Touch 0.31, gambler 0.27, organiser 0.26, scholar 0.25, saint 0. Two findings outside the rules: the simulator never saw hearse upkeep being paid (it watched the wrong flag; fixed), and the tycoon ended the season with $46,000 in savings because its evening deposit put back what its endgame withdrawal took out (bot fix).

## Round 11

| change | from | to | why |
| --- | --- | --- | --- |
| `customer.ratingDiv` | 5 | 6 | the rating stackers (the politician: good path, mayor, chain, certificates) sold 10% more per customer than the field |
| `scoring.exact.flat` | 20 | 12 | the exact match landed on a quarter of a careful seller's sales and the flat 20 doubled small sales (a pet funeral's base is 6 BP); it also rewarded pinning the limit with many small pitches, the grindiest play there is |
| `pvp.gainFactor`, `pvp.gainCap` | 1.15, 100 | 1.2, 105 | the saboteur at -6% |
| bots | | | no savings deposits in the last five days |

Result: mean BP 19,062 (gambler) to 20,749 (tycoon), +4.8% / -3.8% around 19,806 (lower everywhere: the flat exact bonus was worth about 1,000 BP a season). Closeness bonuses fell from 26-31% to 21-28% of sale BP. Win / fair: necromancer 2.67, saboteur 2.46 (on a mean 1.8% below the field), tycoon 2.15, pacifist 1.87, shark 1.55, politician 0.83, builder 0.27, organiser 0.26, scholar, saint, Soft Touch, gambler 0. Paths on mean BP: good 19,979, evil 19,893, neutral 19,666 (within 1.6%); by wins evil 2.49, good 0.71, neutral 0.67.

## Round 12

| change | from | to | why |
| --- | --- | --- | --- |
| `pvp.gainFactor`, `pvp.gainCap` | 1.2, 105 | 1.0, 90 | the fighters still won twice their share on an average mean |

Result: overshot: the saboteur fell to 18,253 BP (-7%) and 0.62; the tycoon rose to 2.77 (+6.5%, sd 617: it is second or third in nearly every town and wins whenever the fighters' seasons go badly). Good 0.92, evil 1.62, neutral 0.82; paths within 3.3% on mean BP.

## Shipped (the final baseline)

| change | from | to | why |
| --- | --- | --- | --- |
| `pvp.gainFactor`, `pvp.gainCap` | 1.0, 90 | 1.1, 95 | between rounds 11 and 12 |
| monuments 4 and 5 | 380, 500 BP | 340, 420 BP | the tycoon, the steadiest strategy, at +6.5% |

The 200-town baseline with these numbers is `docs/balance/expanded-baseline.md`; its reading says which targets are met.

Baseline (200 towns): mean BP 18,434 (gambler) to 20,860 (tycoon) around 19,599; win / fair necromancer 2.75, tycoon 2.54, shark 1.72, politician 1.57, pacifist 1.41, saboteur 0.99, saint 0.39, Soft Touch 0.31, builder 0.19, gambler 0.18, organiser 0.06, scholar 0. Paths on mean BP: good +2.0%, evil -2.4%, neutral -0.5%. Comparison runs: hard bots 15% above easy ones (2.6 times the luck spread); a day-10 joiner finishes 5.2nd of 9; the oracle 11.6% above the fair bots; towns without fighters 4% higher for the same parlors.

## Loose ends (the engine pass)

Not a re-tune: the three upgrades no personality bought, hits that returned almost nothing per dollar, and the duel's Shove (a rule change, `docs/expanded-rules.md` 16.4). Runs: `pnpm --filter @fq/sim run sim -- --days 30 --towns 60 --players 8 --rules expanded --seed 1 --challenges 2`, before and after the changes (same seeds and seats, so the two are paired).

| change | from | to | why |
| --- | --- | --- | --- |
| Night Watchman (`upgrades`) | $32,000, +1 rating | $20,000, +2 | Security 3 comes after $22,000 of guard dog and alarm; at $32,000 the whole defence was $54,000 for what PvP costs a targeted parlor (the most-targeted peaceful parlor loses about 4.6% of its season, ~900 BP; each level takes about 30% off that through the door roll and the smaller gain, ~250 BP a season for the third). At $20,000 it pays about 0.012 BP a dollar for a targeted parlor, the first monument's rate (0.020) at best and the monuments' average (0.010) at worst; +2 rating is the alarm's worth on the rating scale. |
| Billboard on Route 9 | $20,000, income +8 | $14,000, income +10 | It needs a $1,500 permit and a trip to City Hall, and gave the same +8 as the Crematorium Annex ($60,000 after an incinerator) for a third of the price but no building level; the chapel is +15 for $50,000. $15,500 in all for +10 makes it the mid-game income buy (0.65 a $1,000 against the chapel's 0.30), small enough that it does not replace the chapel (which also gives +8 rating and a building level). |
| Memorial Garden | $45,000, +5 rating | $30,000, +6 | Patience +1 and +5 rating for $49,000 with its permit, against the Viewing Room's patience +2 and +4 rating for $18,000: three times worse per dollar. At $34,000 for +6 and +1 it is a late rating buy, still dearer per point than the Viewing Room, which comes first. |
| hit (`club.hit`) | $5,000 + $2 a BP, loss 0.5 of the curve | $3,000 + $1 a BP, loss 0.75 | 0.001 BP removed per dollar made hits a dead choice (3 resolved in 60 towns). Against a 10,000 BP target the price falls from $25,000 to $13,000 and the loss rises from 47 to 71 BP: about 0.005 BP a dollar, still half a monument's rate, and the hirer still gains nothing, so a hit stays a grudge, not a points engine. Counterplay (the bodyguard, armour, security, the Church Associate) is unchanged. |
| duel Shove (rule, 16.4) | a shove that lands still lets the rival move | it costs the shoved side their next move (both ways) | Shove was never better than Swing; now each of Swing, Shove and Yield is best somewhere (`test/duelShove.test.ts`, table in 16.4). |

Result (60 towns): **checks passed** (no invariant break, rejected offered button, stuck bot or exploit signature).

| | before | after |
| --- | --- | --- |
| win / fair, high to low | necromancer 3.49, tycoon 2.22, pacifist 1.78, shark 1.60, politician 1.40, saboteur 0.62, mourner 0.42, gambler 0.40, builder 0.21, saint, scholar, organiser 0 | necromancer 3.28, tycoon 2.22, politician 2.20, shark 1.40, pacifist 1.07, saboteur 0.82, mourner 0.63, gambler 0.40, saint 0.22, scholar, organiser, builder 0 |
| mean final BP, lowest to highest | 18,410 (saboteur) to 20,802 (tycoon), a spread of 2,392 | 18,299 (saboteur) to 20,813 (tycoon), 2,514 |
| hits resolved / landed; BP taken | 3 / 2; 94 | 66 / 48; 3,242 (0.004 BP removed a dollar, was 0.002) |
| duels: challenger won / lost / yielded | 2,145 / 210 / 298 | 2,166 / 280 / 292 (a rival's shove that lands now costs the challenger a move) |
| Billboard / Night Watchman / Memorial Garden bought (offered) | 0 (73) / 0 (18) / 0 (45) | 0 (77) / 0 (34) / 0 (59) |
| duel Shove pressed (offered) | 0 (118) | 0 (118) |

Reading: nothing regressed. The top win share fell a little and the spread of means grew by 120 BP, inside 60 towns' noise (about 40 seats a personality, so one or two wins move a share by 0.2 to 0.4). The bots still buy none of the three upgrades and never shove: they buy upgrades from fixed lists (`@fq/bots` `personalities.ts`; only the builder lists the Billboard and the Garden, after the $80,000 mausoleum, and none lists the Night Watchman) and value a shove by the old rule (`expanded/day.ts`, `shoveValue`), so the simulator cannot judge these changes until the bots' owner updates both. Hits are now used (almost all by the shark, about $760 a player-day) and cost their victims 0.1 to 0.7 BP a day, well below parlor fights.

## Bots pass (after the engine pass)

No rule number changed. The bots (`packages/bots`) and the simulator (`tools/sim`) were updated to the engine pass and the structured panels (spec 11.5); the baseline was re-run (`docs/balance/expanded-baseline.md`, 200 towns, 1,305 s, checks passed). Classic bot behaviour is untouched: the Classic simulator report for 60 towns, seed 7, is identical before and after except its run time.

| change | why |
| --- | --- |
| Duel: Swing, Shove or Yield by expected value (`expanded/duel.ts`, value iteration over both hit-point bars with the exact rules incl. `shoveCostsMove`; tested on the three positions of 16.4) | the old `shoveValue` assumed the old rule, so the bots never shoved. Now 467 presses in 8,608 duels. |
| Upgrade lists: Billboard for scholar, organiser, saint, gambler (builder already had it); Memorial Garden for scholar, mourner, saint, organiser (builder had it); Night Watchman for mourner and saboteur (with the Alarm it needs) | the three late upgrades were in no list. Trials put the Billboard in the tycoon's and the shark's lists too; both gained 5 to 6% and their win shares rose, so they were taken out. |
| Hits: a bot with `hits` hires one on the leader when the leader is up to 12% ahead (or just behind) and the money is spare; shark, saboteur, plus necromancer and gambler (new) | hits are cheaper now; they only make sense in a race. Needs fresh rankings, so a hitter visits the parlors before the club. The Cursed Tiger stays with the shark and the saboteur (it was tied to `hits`). |
| Panels instead of prose: office (stock, markup, rivalry, upgrades, permits held), ballots (ordinance, lobby, election), bank (can borrow, limit, can deposit), club (stakes), bingo (free card, room), prep choices (with the odds of a gamble), injury list (treat only what pays), customer bands (the closeness tiers); each falls back to the old reading when a panel is absent | robustness to rewording. Tested: a season with every pack string scrambled (`test/scrambled.test.ts`) and a season with every panel stripped (`test/panels.test.ts`) both play with no stuck day, error or rejection. The casket tier is read from the price, not the bill line's name. |
| Simulator: Shove duels, hits by hirer, the late upgrades' return (difference of differences), news / arc frequency | to judge the above |

Result: win / fair necromancer 2.51, tycoon 2.15, politician 1.91, shark 1.78, pacifist 1.41, builder 0.50, gambler 0.48, saboteur 0.41, saint 0.39, organiser 0.29, scholar 0.17, Soft Touch 0.06 (was 2.75 / 2.54 ... scholar 0): not met. Billboard returns 0.031 BP a dollar (dominant), Night Watchman and Memorial Garden nothing (bought on day 26). Recommended numbers are in the baseline's "Recommended next tuning".

## Engine gaps (before the balance round)

No balance number changed here; these change what the bots can see and do, so the round below starts from a re-run, not from the old baseline. Details in `docs/expanded-rules.md` 11.5, 13.5, 20.4 and 29.

| change | effect on the simulation |
| --- | --- |
| A hit-man rumour is data (`Hud.warnings`, `PlayerLife.rumourDay`) | the bots could not see the rumour (it is desk text, not an overlay), so nobody bought protection. Now the scholar, tycoon, politician, organiser and builder (`XStyle.protect`) go to the club the day they are warned and hire the bodyguard, or Tiny or the vest. In the first 100-town run: 75 bodyguards, 176 vests, (was 0 and 0 for a rumour) |
| Rewards reported by mail queue an `applied` reward packet (10.2) | none on play (the reader skips it); a reward overlay can be told from a notice |
| Age-aware lines (13.5): two starter Sympathy lines with limits | changes the random draws of the customers they fit (minors, old deceased): the towns are not the old baseline's towns line for line |
| `View.monuments`, `saleOutcome`, `NewsPanel.meteor`, `Overlay.messageKind`, `ChatLine.from` | presentation only |
| Simulator: happy and sour families by personality; win tables add each group's BP against its town's mean and the sd of that, and the spread of the means and mean places | to judge the round |

## Balance round (rounds 13 to 16)

Runs: `pnpm --filter @fq/sim run sim -- --days 30 --towns 100 --players 8 --rules expanded --seed 1` (100 towns, about 15 minutes with worker threads); the late joiner with `--towns 60 --latejoin 10`. "Before" is the first 100 towns of the bots-pass baseline (same seeds; the bots now also buy protection, so not every town is the same game). Win / fair is noisy at this size: a personality has 55 to 75 seats, so one win moves its share by about 0.12.

Before (100 towns): tycoon 2.54 (+5.5% of its town's mean BP), necromancer 2.51 (-1.6%, sd 12.1%), politician 1.80 (+3.2%), shark 1.75, pacifist 1.39, saint 0.55, organiser 0.35, gambler 0.35, scholar 0.24, saboteur 0.23, builder 0.13, Soft Touch 0.12. Paths: evil 1.35, good 0.93, neutral 0.91.

### Round 13

| change | from | to | why |
| --- | --- | --- | --- |
| `pvp.necroMult` | x1.25 | x1.10 | the necromancer won 2.5x its share on a mean below the field: its season swings (sd 12% of the town mean against 3 to 5% for sellers) |
| `markup.ratingPer10` | -4 | -5 | the tycoon's markup |
| monuments 4 and 5 (`town.graveyard.monuments`) | 340, 420 BP | 300, 360 | only the tycoon and the shark build them; they are most of the tycoon's lead |
| Billboard | $14,000, income +10 | $18,000, +8 | 0.031 BP a dollar, three times a monument |
| Memorial Garden | $30,000, patience +1 | $20,000, patience +2 | bought on day 26, returned nothing |
| Night Watchman | $20,000 | $12,000 | bought on day 26 |
| `underdog.late.money` (new rule, 9.4) | none | $1,500 a season day already played | a late parlor lacks the upgrades the others bought in that time; the BP catch-up alone left it below mid-table |

Result: tycoon 3.72 (+5.9%: the rating cut barely touches it), shark 2.03, politician 1.67, necromancer 1.46 (-5.4%), pacifist 1.21, gambler 0.88, saint 0.40, organiser 0.34, builder 0.28, Soft Touch 0.13, saboteur 0.11 (-8.3%: it is in the Necromancer band too, so the cut hit it hardest), scholar 0. Paths: evil 0.83, good 0.85, neutral 1.19. Billboard 0.019 BP a dollar, Garden 0.003, Night Watchman -0.008 (both still bought on day 25). 75 bodyguards and 176 vests bought on a rumour.

### Round 14

| change | from | to | why |
| --- | --- | --- | --- |
| `pvp.necroMult` | x1.10 | x1.15 | between: the saboteur fell too far |
| monuments 4 and 5 | 300, 360 | 220, 260 | the tycoon still +5.9% |
| Mayor's rating (`cityHall.election.perks.rating`) | +3 | +2 | the politician +4.6% |
| `bank.savings.rate` | 0.2% | 0.15% a day | the tycoon |
| Memorial Garden | income 0 | income +4 | a late rating buy cannot pay back; rating moves the income roll by a sixth of a point each |
| Night Watchman | income 0 | income +3 | the same: its buyers are rarely attacked, so defence alone measures as nothing |

Result: tycoon 2.48 (+5.3%), politician 1.78 (+4.9%), shark 1.67, necromancer 1.46, pacifist 1.10, gambler 0.88, builder 0.69, saint 0.67, Soft Touch 0.52, scholar 0.44, saboteur 0.44, organiser 0 (-0.2%, 70 seats: noise at this size). Paths: evil 0.94, good 0.99, neutral 1.04. Billboard 0.021, Garden 0.008 (+47 BP a day once owned), Night Watchman 0.003, monuments 0.010.

Finding (consistency scoring): the simulator now counts happy families. Good-path parlors leave 46 to 49% of families happy, everyone else 28 to 33%, and the steady neutral sellers who trail (organiser 31%, scholar 28%, builder 30%) are at the bottom. A satisfaction bonus would pay the politician and the pacifist, already above their share, and not the sellers it is meant for, so it was written, tested and taken out again.

### Round 15

| change | from | to | why |
| --- | --- | --- | --- |
| monuments 4 and 5 | 220, 260 BP | 160, 180 | the tycoon still +5.3%: five monuments against the field's three were most of its lead |
| `markup.cheapnessPer10` | 1.0 | 1.3 | a markup still cost the tycoon and the shark almost nothing in refusals |
| Billboard | $18,000, income +8 | $20,000, +7 | still twice a monument per dollar (0.021) |
| Night Watchman | income +3 | +5 | still 0.003 BP a dollar |

Result: politician 2.56 (+5.0%), necromancer 2.14 (-4.5%, sd 12.3%: no necromancer number changed since round 14, where it was 1.46, which shows the noise of 70 high-variance seats), tycoon 1.10 (+4.5%), builder 1.10, gambler 0.88, pacifist 0.77, shark 0.72, saint 0.67, Soft Touch 0.65, organiser 0.57, saboteur 0.44, scholar 0.33. Paths: good 1.13, evil 1.12, neutral 0.84. Billboard 0.009 BP a dollar, Garden 0.008, Night Watchman 0.012, monuments 0.009: no dominant purchase, none dead.

Late joiner (60 towns, a ninth bot on day 10, with `underdog.late.money`): mean place 5.20 of 9 (was 5.95), 60% in the top half, 19,546 BP against a town median of 19,525.

### Round 16

| change | from | to | why |
| --- | --- | --- | --- |
| `customer.ratingDiv` | 6 | 7 | the politician (+5.0%) stacks rating: good path, chain, mayor, certificates |

Result: worse. Politician 3.11 (+4.3%), necromancer 2.03, gambler 1.38, tycoon and pacifist 1.10, shark 0.96, builder 0.83, saboteur 0.55, saint 0.53, Soft Touch 0.26, scholar and organiser 0 (neutral path 0.70): the sellers who trail lose more from a weaker rating than the politician does. Reverted.

## Shipped (the balance round's final numbers)

| change | from | to |
| --- | --- | --- |
| `pvp.necroMult` | x1.25 | x1.15 |
| `markup.ratingPer10`, `markup.cheapnessPer10` | -4, 1.0 | -5, 1.3 |
| monuments 4 and 5 (BP) | 340, 420 | 160, 180 |
| `bank.savings.rate` | 0.2% | 0.15% a day |
| Mayor's rating (`cityHall.election.perks.rating`) | +3 | +1 (+2 in rounds 14 to 16; +1 for the final run as a last small step, its effect is a sixth of an income point) |
| Billboard | $14,000, income +10 | $20,000, income +7 |
| Memorial Garden | $30,000, patience +1 | $20,000, patience +2, income +4 |
| Night Watchman | $20,000 | $12,000, income +5 |
| `underdog.late.money` (new rule) | none | $1,500 a season day already played |
| `customer.ratingDiv` | 6 | 6 (tried 7, reverted) |

The 200-town baseline with these numbers is `docs/balance/expanded-baseline.md` (1,865 s, checks passed), with its reading. Against the targets: win / fair politician 2.67, necromancer 2.45, pacifist 1.35, tycoon 1.24, shark 0.92, gambler 0.84, saint 0.72, builder 0.62, Soft Touch 0.44, saboteur 0.29, scholar 0.28, organiser 0.17 (before: necromancer 2.51, tycoon 2.15 ... Soft Touch 0.06): still two above 2 and three below a third. Mean final BP 17,897 to 20,486 (sd of the means 678, was 642); mean place 2.75 to 6.26. Paths: evil 1.29 (was 1.42), good 1.23, neutral 0.70. Purchases: Billboard 0.009 BP a dollar (was 0.031), Night Watchman 0.010, Memorial Garden 0.007, monuments 0.009. Day-10 starter 5.10 of 9 (was 5.95). Hard bots 16.7% above easy ones.

## Balance round 17 (the proposals that do not change how the game feels)

Runs: `pnpm --filter @fq/sim run sim -- --days 30 --towns 60 --players 8 --rules expanded --seed 1 --challenges 0` (60 towns, about 7 minutes), then the 200-town baseline. The content pack gained new material during the round (five special customers, 15 events, 9 news blurbs, 3 risks, more arrival, tell and walkout lines), which changes every town's draws, so "before" is a fresh 60-town run of the round-16 numbers and bots with the new pack. At 60 towns a personality has 36 to 45 seats: one win moves its share by about 0.2, so the BP against the town mean is the figure to read.

Before (60 towns, new pack): tycoon 2.67 (+4.8% of its town's mean BP), politician 2.40 (+4.7%), pacifist 1.78, necromancer 1.44 (-5.1%, sd 12.1%), Soft Touch 1.26, shark 1.00, saint 0.67 (+2.4%), gambler 0.40, builder 0.21 (+2.4%), saboteur 0.21 (-10.1%), scholar 0.19 (+0.6%), organiser 0 (-0.6%). Night Watchman bought on day 25.8, Memorial Garden on day 25.7 (8% of seats).

### Round 17a

| change | from | to | why |
| --- | --- | --- | --- |
| Memorial Garden in the bots' upgrade lists (`XStyle.upgrades`: Soft Touch, builder, scholar, saint, organiser) | after the embalming lab (the builder: last) | straight after the storeroom | it returns BP once owned (+43 a day) but was bought on day 26 |
| Night Watchman (Soft Touch with its alarm, saboteur) | after the embalming lab | straight after the storeroom | the same |

Result: organiser 1.24 (+2.1%), scholar 0.74 (+1.5%), builder 0.62 (+2.5%), politician 2.60 (+4.2%), pacifist 2.13, necromancer 1.64, tycoon 1.56, shark 0.60, gambler 0.40, saint 0.22 (+2.0%), Soft Touch 0 (0.0%), saboteur 0 (-9.7%). The Garden bought by 30% of seats on day 15.2 and returning 0.028 BP a dollar: three times a monument, a dominant purchase by the round-13 standard. The Watchman on day 21.9, -40 BP a day against peers who bought the florist cooler and the lab with that money instead.

### Round 17b

| change | from | to | why |
| --- | --- | --- | --- |
| Memorial Garden, Night Watchman (and Soft Touch's alarm) in the lists | straight after the storeroom | just before the embalming lab | 17a made the Garden three times a monument and the early Watchman a loss |

Result: politician 2.60 (+4.0%), tycoon 2.22, necromancer 1.85 (-5.6%), shark 1.20, scholar 1.12 (+1.7%), pacifist 1.07, gambler 0.60, saint 0.44 (+2.3%), builder 0.41 (+2.1%), Soft Touch 0.21, saboteur 0.21 (-9.6%), organiser 0.18 (+0.8%). Garden on day 20.1, 0.020 BP a dollar; Watchman on day 24.8, within noise of zero. Kept.

### Round 17c

| change | from | to | why |
| --- | --- | --- | --- |
| `scoring.exact.share` | 0.5 | 0.4 | the last baseline's lever for the politician (it lands 29% exact); applied only if it brings the politician down without costing a neutral seller more than a point |

Result (against 17b): the politician's BP a day -0.3%, but the town mean fell 1.2%, so against its towns it rose (+4.0% -> +5.0%); the scholar fell 2.0 points (+1.7% -> -0.3%), the saint 1.9, the builder 0.4, the organiser 0.2. Fails the condition. Reverted.

Finding (a per-day cap on parlor-fight BP gained, about 150, for the necromancer's spread): every bot-day of 12 towns counted, with the current numbers and pack. The necromancer's parlor-fight BP never passes 109 a day (one win at the curve's cap of 95 x1.15; median fight day 106), the gambler's 95; the saboteur's median fight day is 136, its 90th percentile 218. A cap of 150 removes 0 BP a season from the necromancer and about 470 from the saboteur (already last, -7.8%); a cap of 100 removes 49 and 1,217. The necromancer's spread is in how many days it fights and wins (its season's fight BP: sd 729, correlation 0.76 with its BP against the town mean), not in lucky single days. Not applied, and no engine change was needed for it.

## Shipped (round 17)

| change | from | to |
| --- | --- | --- |
| Memorial Garden in the upgrade lists of Soft Touch, builder, scholar, saint, organiser (`packages/bots`) | after the embalming lab (builder: last) | just before the embalming lab |
| Night Watchman (and Soft Touch's alarm) in the lists of Soft Touch and the saboteur | after the embalming lab | just before the embalming lab |
| `scoring.exact.share` | 0.5 | 0.5 (tried 0.4, reverted) |
| per-day cap on parlor-fight BP | none | none (measured: would hit only the saboteur) |

No rules number changed; Classic's simulator report (60 towns, seed 7) is byte-identical except its run time. The 200-town baseline with these bots and the new pack is `docs/balance/expanded-baseline.md` (1,853 s, checks passed), with its reading. Against the targets: win / fair politician 2.38, necromancer 2.33, tycoon 1.56, pacifist 1.18, shark 0.86, scholar 0.72, gambler 0.60, builder 0.56, saint 0.52, organiser 0.46, Soft Touch 0.44, saboteur 0.35 (was politician 2.67, necromancer 2.45 ... organiser 0.17): still two above 2, none below a third (was three). Mean final BP 17,727 to 20,483 (sd of the means 712, was 678), -7.8% to +4.0% of the town mean; mean place 2.92 to 6.38. Paths: evil 1.29, good 1.08, neutral 0.82 (was 1.29, 1.23, 0.70). Purchases: Memorial Garden 0.022 BP a dollar (bought on day 20.2 by 27% of seats, was day 26.0 and 8%), Billboard 0.010, Night Watchman -0.002 (day 24.7, within noise), monuments 0.010, tithes 0.009.

## Balance round 18 (the Memorial Garden's return; measured, not applied)

Round 17 left the Memorial Garden returning about twice a monument per dollar (0.022 BP a dollar at 200 towns), the level at which round 13 cut the Billboard. Tried: income roll +4 -> +2, at 60 towns, seed 1, against round 17b.

| | 17b (+4) | +2 |
| --- | --- | --- |
| Garden bought by | 30% of seats, day 20.1 | 27%, day 20.1 |
| Garden's return | 0.020 BP a dollar | 0.017 (+40.0 BP a day, se 5.9) |
| Garden buyers against the town mean | scholar +1.7%, saint +2.3%, builder +2.1%, organiser +0.8% | +1.2%, +2.4%, +1.6%, +0.9% |
| Win / fair, top | politician 2.60, tycoon 2.22, necromancer 1.85 | 2.80, 2.44, 2.05 (one win is 0.2 at this size) |
| Checks | passed | passed |

Halving the income bonus took 15% off the return and about half a point off its buyers: the Garden's worth is its patience (+2 on every sale), not the income roll, and round 13 raised the patience from +1 because at +1 the Garden returned nothing. Reverted; +4 stands. The lever, if the return must come down, is the price ($20,000 -> about $30,000, which round 13 cut from), not the income; left for a round with a 200-town baseline behind it.


## Balance round 19 (the eight newer places: bots, measurement, tuning)

Until this round the computer rivals never walked into the Police Station, Crematorium, Florist, Town Gazette, Coroner's Office, Health Department, Cousin Sal's Pawn or Mourne & Sons (`expanded-rules.md` sections 30 and 31), so the baseline did not cover them.

**Bots** (`packages/bots/src/expanded/places.ts`, `PlacesStyle` in `personalities.ts`): each personality has a committed habit for each place, read from the screen's enabled buttons and prices, no dice: the evil and cutthroat styles (necromancer, saboteur, shark) settle with the police in private, take the back door after repeat attacks, press the ashes, sign bodies over for the coroner, pawn their loot, and (necromancer, shark) smear and complain; the good styles (Soft Touch, saint, politician, pacifist) report attacks, scatter ashes, send the church wreath when karma is short, take the proper burial and the certificate; the shark and the tycoon, who sell many cremations (1.97 and 0.63 a day against 0.29), rent oven time; the builder, organiser, tycoon, saint, pacifist keep bouquets in the cooler; the Soft Touch, builder, scholar, shark, tycoon, organiser and necromancer buy second-hand caskets; the gambler runs classifieds and undercuts the Mournes (luck gambles); the politician buys the front page. Gates: a style spends only above its cash reserve plus a margin, investments stop on day 24, and the actions that cost word of mouth when they fail (the quiet favour, spying, undercutting) wait until the rating is 40 to 45. Tests: `packages/bots/test/expanded.test.ts` ("the eight newer places": every personality in character, and an 18-day town of all twelve walks into all eight places and presses the certificate, the inspection, the hold and the pawn lot with no stuck screen or rejection).

**Simulator** (`tools/sim`): the eight places have their own systems in the money, karma, luck and word-of-mouth bookkeeping and the conservation checks; a new report table ("the eight newer places") gives each place's share of seats, spend, money back (the oven's saved wholesale and the bouquets' payouts included) and what it moved; `--places-off LIST` leaves places out for every bot, to measure one by ablation (a place cannot be measured by the upgrades' difference of differences: most users start on day 2 to 3, so there is no control).

**Before** (the round-17 baseline, which the same 200 towns reproduce exactly with the bots not visiting the new places): politician 2.38, necromancer 2.33, tycoon 1.56, pacifist 1.18, shark 0.86, scholar 0.72, gambler 0.60, builder 0.56, saint 0.52, organiser 0.46, Soft Touch 0.44, saboteur 0.35; mean BP 19,566; -7.8% (saboteur) to +4.0% (tycoon) of the town mean.

### Round 19a (60 towns, first run; the places at their documented numbers)

Result (against the same 60 towns without the places): necromancer 1.85 -> 3.49 of its share, tycoon +4.5% -> +7.3% of its town's BP, scholar 1.12 -> 0.19, the rest within the noise. Read from the money flows (net dollars a season per personality): the Coroner's quiet favour (+$700, 40% of the time -2 word of mouth) was a pump, $20,300 a season for every evil-path parlor (4,582 presses, 158 seats); the Coroner's certificate bought rating at $400 a point (an upgrade costs about $4,000); the Gazette's smear ($3,000 every other day) and the Health Department's complaint ($500) cost the cutthroat styles $30,000 a season, and $500 bought -2 word of mouth on the leader; second-hand lots saved 19% to 25%; the Health Department's inspection returned nothing it cost.

| change | from | to | why |
| --- | --- | --- | --- |
| Coroner's quiet favour `quietPay`, `quietFailReviews` | $700, -2 | $400, -3 | a pump (+$20,300 a season) |
| Coroner's certificate `price`, `cooldownDays` | $800, 3 | $1,600, 4 | rating at $400 a point, ten times cheaper than an upgrade's |
| Health inspection and clean bill `days`; clean bill `price` | 5 days; $1,500 | 8 days; $1,200 | a boost that ends in five days returned nothing |
| Health complaint `price` | $500 | $1,500 | -2 word of mouth on the leader for $500 |
| Gazette smear `price` | $3,000 | $2,500 | |
| Pawn lots `share`; loot `price` | 0.65; $300 | 0.75; $200 | saved 19% to 25%; loot paid the saboteur $26,000 a season on top of the ring |

Bots: smears and complaints every fourth day (were every other day).

### Round 19b (60 towns, then 200)

Result at 60 towns: the quiet favour still netted evil parlors $11,600 a season, the gambler (a neutral parlor that had been signing bodies over) fell to 0 wins and -6.2%, the saint and the pacifist lost 0.6 to 0.7 points on wreaths and bouquets (ablation by place, 60 towns: every other effect inside the +-1% noise).

| change | from | to | why |
| --- | --- | --- | --- |
| Coroner `quietPay`, `quietLuckWeight` | $400, 0.6 | $250, 0.5 | the rating cost of a signed-over body outran the cash |
| Gazette `classified`, `display` | $800, $2,000 | $750, $1,800 | the display advert was dearer than a nurse's lead; now just above it |

Bots: the gambler no longer signs bodies over; the church wreath only while karma is under 90 (nobody in the good path needed it).

Result at 200 towns: tycoon 2.86, necromancer 2.15, shark 1.54, pacifist 1.46, politician 1.22, saint 0.79, builder 0.56, gambler 0.48, organiser 0.46, Soft Touch 0.38, scholar 0.17, saboteur 0.12. The saboteur and the necromancer sat at the rating floor (-24 and -28 word of mouth a season: 11,629 quiet favours), the scholar paid $20,000 a season for a $600 tip it does not use well.

### Round 19c (200 towns)

| change | from | to | why |
| --- | --- | --- | --- |
| Police `report.fine`, `settle.amount` | $800, $500 | $600, $400 | the saboteur, the parlor that is reported, fell 2.7 points more than anyone |
| Coroner `tip.price` | $600 | $300 | the tip's information is worth far less |
| Coroner `quietPay` | $250 | $300 | with the bot's rating gate the pay can be a little higher |

Bots: signing a body over only while the rating is 45 or more and on alternate days; spying and undercutting only at rating 40 or more (spying on alternate days); the coroner's tip and the gazette's advert on alternate days.

Result: tycoon 3.25, necromancer 2.45, politician 1.45, pacifist 1.13, shark 1.11, gambler 0.78, Soft Touch 0.44, saint 0.39, builder 0.38, scholar 0.33, saboteur 0.23, organiser 0.23 (mean BP 19,435). The saboteur still lost $13,000 a season on its smears and complaints.

### Round 19d (the 200-town baseline)

| change | from | to | why |
| --- | --- | --- | --- |
| Pawn lots `share` | 0.75 | 0.80 | the tycoon's storeroom (5/4/3) saved the most; at 0.80 the saving is 0% at luck 50 and 11% at luck 100 |
| Saboteur bot: smear and complaint | on | off | a net loss for it ($6,000 and $6,700 a season) and it is already last |

Result (the baseline in `expanded-baseline.md`): tycoon 3.25, necromancer 2.33, politician 1.57, pacifist 1.35, shark 1.05, saint 0.72, builder 0.56, gambler 0.48, saboteur 0.29, organiser 0.29, Soft Touch 0.19, scholar 0.11.

### Per personality, before and after (200 towns, seed 1)

| personality | win / fair before -> after | mean place before -> after | BP against the town mean before -> after |
| --- | --- | --- | --- |
| tycoon | 1.56 -> 3.25 | 2.92 -> 2.33 | +4.0% -> +6.6% |
| necromancer | 2.33 -> 2.33 | 4.76 -> 4.54 | -3.3% -> -2.4% |
| politician | 2.38 -> 1.57 | 3.04 -> 3.07 | +3.9% -> +3.9% |
| pacifist | 1.18 -> 1.35 | 4.00 -> 3.88 | +2.3% -> +2.5% |
| shark | 0.86 -> 1.05 | 4.67 -> 4.50 | -0.3% -> -0.2% |
| saint | 0.52 -> 0.72 | 4.27 -> 4.01 | +1.5% -> +1.8% |
| builder | 0.56 -> 0.56 | 4.22 -> 4.27 | +1.5% -> +1.0% |
| gambler | 0.60 -> 0.48 | 5.30 -> 5.75 | -2.4% -> -3.6% |
| saboteur | 0.35 -> 0.29 | 6.38 -> 6.64 | -7.8% -> -8.8% |
| organiser | 0.46 -> 0.29 | 4.56 -> 4.54 | +0.7% -> +0.9% |
| Soft Touch | 0.44 -> 0.19 | 5.27 -> 5.16 | -0.9% -> -0.6% |
| scholar | 0.72 -> 0.11 | 4.52 -> 5.08 | +0.8% -> -0.4% |

Mean BP 19,566 -> 19,437 (-0.7%): the places are net money sinks for most parlors. Paths on BP against the town mean: good +1.0% -> +1.2%, neutral +1.2% -> +1.4%, evil -4.7% -> -3.8%.

### Per place (200 towns, round 19d)

| place | seats using it | $ paid a user | $ back a user | net $ | other | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Police Station | 88% | 7,499 | 3,591 | -3,908 | karma -2 | used; no lock: a patrol or back door on 10% of seat-nights, attacks and break-ins unchanged (-1.2%, -0.6%), hits landed 609 -> 529 |
| Crematorium | 29% | 3,301 | 6,367 | **+3,066** | karma -4, luck +0.9 | pays only the two cremation sellers (oven: 1,621 slots used, $1.86M saved wholesale); ashes small change |
| Florist | 41% | 3,354 | 5,158 | **+1,804** | | bouquets pay 1.5 to 1 (21,427 used); the church wreath is dead (9 presses) |
| Town Gazette | 33% | 11,259 | 0 | -11,259 | karma -2, word of mouth -0.5 | the dearest; adverts and smears buy no measured BP; used sometimes |
| Coroner | 85% | 6,519 | 406 | -6,114 | word of mouth +5.9 | certificate (4,805), tip, burial, a small gated quiet favour (1,829) |
| Health Department | 91% | 3,328 | 0 | -3,328 | word of mouth +3.9 | cheap rating for a few days |
| Cousin Sal's Pawn | 75% | 27,348 | 5,588 | -21,761 | | most of the outlay is stock that replaces Di-Mart's; loot pays $5,600 |
| Mourne & Sons | 92% | 1,726 | 0 | -1,726 | karma +15 | the free hold (+1 karma a day) was pressed 35,467 times |

For reference a monument returns about 0.010 BP a dollar; no place pays BP, and the three that return money return $1.5 to $1.9 a dollar to the parlors they suit.

### Ablations (200 towns, challenges 0, the round-19d numbers)

| run | tycoon BP against the mean (wins / fair) | necromancer | saboteur |
| --- | --- | --- | --- |
| all eight places (round 19c) | +6.6% (3.25) | -2.4% (2.33) | -8.8% (0.29) |
| without the pawn shop | +7.2% (3.51) | -2.7% (2.21) | -9.5% (0.23) |
| without the crematorium and the florist | +6.0% (3.12) | -2.8% (1.97) | -9.0% (0.12) |

No single place explains the tycoon's rise (+4.0% to +6.6%); with the oven and the bouquets gone it still gains 2 points.

### Findings and what was not changed

- **The tycoon is the one parlor the new places pay**: its oven, bouquets and patrol cost about what they return, while the rest of the field loses 0.7% of its BP on them. It moves from 1.56 to 3.25 of its share (above 2 now); the levers (oven price, bouquet payout) also reach the shark. Not applied; listed in the baseline's proposals.
- **Win share is noise at this size**: the politician's wins ran 41 -> 21 -> 25 -> 27 over the runs while its BP against the mean stayed at +3.5 to +3.9%. The scholar's 0.11 is -0.4% of its towns' BP.
- **The free karma at the Mournes** (+1 a day for nothing) and **the dead church wreath** are the two choices that are not tuned; proposals in the baseline.
- No Classic rule or number changed; no engine logic changed (numbers only in `rules.town.placesA` and `placesB`). `packages/core/test/townSim.test.ts`: the exercise-player seed 23 was replaced by 25 (a random-walk run now paid a bingo pot into the tag count at midnight, a count that already ignores the carry; coverage test unchanged and passing).

## Shipped (round 19)

| change | from | to |
| --- | --- | --- |
| Coroner tip | $600 | $300 |
| Coroner certificate | $800, every 3 days | $1,600, every 4 days |
| Coroner quiet favour | pays $700; 60% unnoticed; -2 word of mouth | pays $300; 50% unnoticed; -3 word of mouth |
| Health inspection / clean bill | 5 days; clean bill $1,500 | 8 days; clean bill $1,200 |
| Health complaint | $500 | $1,500 |
| Gazette classified, display, smear | $800, $2,000, $3,000 | $750, $1,800, $2,500 |
| Police report fine, settlement | $800, $500 | $600, $400 |
| Pawn lots (share of Di-Mart's price), loot | 65%; $300 ($400 evil) | 80%; $200 ($300 evil) |
| Bots | none of the eight places | every personality has a place style (`packages/bots/src/expanded/places.ts`) |

Not changed: patrol $3,500, back door $1,500 at 70% and -3 karma, oven $900 and bulk $2,400, bouquet $100 and payout 60% (at most $300), wreath $600, front page $2,500, Mournes' spy, undercut, hold and truce, Pawn's bad-lot chance. The 200-town baseline with these bots and numbers is `docs/balance/expanded-baseline.md` (1,751 s, checks passed).
