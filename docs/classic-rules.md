# Classic rules specification

This is the source of truth for the Classic ruleset. Every rule cites the original code under `legacy/source/` so a test can point back to it.

**Status column.** "Ported" means the rule is implemented in `packages/core` with tests and was read line by line. "Reviewed" means it comes from the code review and must be re-read against the source when it is ported; treat line numbers there as starting points.

## 1. Randomness (Ported)

| Rule | Source |
|---|---|
| Integer rolls use MT19937 seeded with the 1998 `sgenrand` (state[i] = 69069 × state[i-1]). Never seeded means seed 4357. | `shared/CRandom.cpp` |
| `random(n)` is raw output modulo n, range 0 to n-1. `random(0)` returns 0 and consumes nothing. | `shared/CRandom.cpp:13-48`, `shared/all.cpp:895` |
| `random_range(a, b)` is inclusive at both ends. Equal bounds return the bound and consume nothing. | `shared/all.cpp:924-929` |
| Float rolls use the Microsoft C runtime `rand()`: state = state × 214013 + 2531011, output = bits 16 to 30. | `shared/all.cpp:902-910` |
| `frandom_range(min, max)` = `rand() / 32767 × (max - min) + min` in 32-bit float. | `shared/all.cpp:907-910` |
| `get_random_yes_no(luck, weight)`: roll = `random(100)`; luck += trunc((50 - luck) × (1 - weight)); passes when roll ≤ luck. | `funeral_util.cpp:77-83` |

Handlers must make their draws in the original order. The remaster seeds one stream per player per day instead of using wall-clock time.

## 2. Customer generation (Ported)

Source: `create_customer.cpp:242-293`. Draws happen in this order.

1. Customer sex: `random(2) == 0` is male.
2. Customer age range: `1 + random(3)` (never a kid), then an age inside the range.
3. Deceased sex: `random(2) == 0` is male.
4. Deceased age range: `random(4)`, then an age inside the range.
5. Relationship (table below).
6. Income: `random(4)`.
7. Spending limit: `random_range` over the income band.
8. Loved flag: `random(2) == 1`.
9. Mood, then cheapness: each `frandom(10)`.
10. Death object: `random(12)`. Death method: `random(8)`.
11. Desired casket: `random(3)`, rerolled until its price is within the limit.

| Age range | Ages |
|---|---|
| Kid | 7 to 11 |
| Teen | 15 to 19 |
| Adult | 28 to 40 |
| Old | 60 to 99 |

| Income | Spending limit |
|---|---|
| Poor | $801 to $2,800 |
| Average | $1,900 to $5,400 |
| Rich | $3,700 to $7,530 |
| Super Rich | $4,600 to $18,500 |

| Casket | Price | BP at base price |
|---|---|---|
| Wood | $800 | 5 |
| Silver | $2,600 | 16 |
| Gold | $5,300 | 33 |

**Relationship** (`create_customer.cpp:31-199`). "Diff" means customer and deceased are of different sexes.

| Customer | Deceased | Draw | Result |
|---|---|---|---|
| Teen | Kid | none | Sibling |
| Teen | Teen | `random(3)` | 1 and diff: Lover. Otherwise Sibling. |
| Teen | Adult | `random(3)` | 1 and diff: Lover (see fix). Otherwise Parent. |
| Teen | Old | none | Grandparent |
| Adult | Kid | none | Child |
| Adult | Teen | `random(3)` | 1 and diff: Lover (see fix). Otherwise Child. |
| Adult | Adult | `random(6)` | 4 or 5 and diff: Spouse. Otherwise Sibling. |
| Adult | Old | `random(6)` | 1 and diff: Lover. 2 and diff: Spouse. Otherwise Parent. |
| Old | Kid | none | Grandchild |
| Old | Teen | `random(10)` | 1 and diff: Lover (see fix). Otherwise Grandchild. |
| Old | Adult | `random(10)` | 1 and diff: Lover. 2 and diff: Spouse. Otherwise Child. |
| Old | Old | `random(6)` | 2: Sibling. 1 and diff: Lover. Otherwise Spouse if diff, else Sibling. |

- The original adult/adult branch contains lover and friend outcomes that can never be reached. Cousin and friend are never assigned.
- **Fix in every mode:** the three "see fix" rows never produce Lover. The draw is still consumed, so everything else about the customer is unchanged. The flag `allowMinorAdultLover` exists only for parity tests.

**Mood words** (`online_struct.cpp:235-301`). Bands are inclusive and checked low to high, one word per whole number of mood; above 9 is "Pissed". The word list differs by the hidden loved flag, which is how the label leaks it.

| Mood up to | Loved | Not loved |
|---|---|---|
| 1 | In Shock | Chipper |
| 2 | Dazed | In a hurry |
| 3 | Confused | Natural |
| 4 | Crying | Tight Lipped |
| 5 | Numb | Nervous |
| 6 | Disturbed | Frustrated |
| 7 | Frustrated | Annoyed |
| 8 | Irked | Irked |
| 9 | Angry | Angry |
| above 9 | Pissed | Pissed |

## 3. Wait for Customer (Ported)

Source: `commands_customer.cpp:4-73`. Each click resolves in this order. Code: `packages/core/src/classic/wait.ts`.

1. Fewer than 1 turn: "no turns" message, picked with the C runtime's `rand() % 3` (`commands_misc.cpp:90-124`; the one direct `rand()` call in the day loop).
2. `frandom(1) < 0.08` (normal odds): random event from `events.txt`. No turn used.
3. Generate a customer (section 2). All its draws happen even if a risk or script follows.
4. `frandom(1) < 0.08` (luck odds): risk event. No turn used.
5. `frandom(1) < 0.05` (script odds): run `script_event.c` (this clears the customer). No turn used.
6. Otherwise spend 1 turn and start the negotiation.

Net per click: about 8% event, 7.4% risk, 4.2% script, 80.4% customer (measured by `test/distribution.test.ts`). The odds compare against 32-bit floats.

## 4. Negotiation (Ported)

Source: `commands_complicated.cpp`. Code: `packages/core/src/classic/modules/negotiation.ts`. Mood and cheapness are 32-bit floats; every `a + frandom(b)` below is computed in 32-bit floats.

**Arrival analysis** (`:308-459`). Draw order: portrait (`c_flash_url`, `online_struct.cpp:321-394`: teen `random(2)`, male adult/old `random(4)`, female adult/old `random(2)`), then the checks below **in this order** (each draws only when the player's psych unlocks it), then the background `random(4) + 1`. Chance is `get_random_yes_no(p, 0.98)`.

| Order | Skill | Needs psych | p |
|---|---|---|---|
| 1 | Reveal resistance % | any | 20 + 13 × psych |
| 2 | Reveal mood type (heartbroken if loved, else guilty) | 1 | 14 × psych |
| 3 | Double the limit | 5 | 15 × psych - 65 |
| 4 | Estimate the limit (shows the doubled limit if 3 fired) | 2 | 15 × psych - 25 |
| 5 | Halve resistance | 3 | 15 × psych - 35 |
| 6 | Halve mood | 4 | 15 × psych - 50 |

The review listed these in a different order; the order above is the code's and decides the draws.

**Actions**

| Action | Effect |
|---|---|
| Soft Sell (`:476-664`) | Picks any `soft_sell.txt` item with `random_range(0, n-1)` (duplicates possible), then a pitch `random(4)`. Refused if `frandom(10) < cheapness`: mood +0.4 to 1.1, walk if mood reaches 10, else a refusal line `random(6)`. Accepted if the new total fits the limit (no draw). Over the limit: mood **before** above 9 walks (`pissed_over_limit`, and the pitch text is dropped because `:618` passes the empty message), otherwise mood +0.4 to 1.4. |
| Hard Sell (`:667-854`) | Wood to Silver ($1,800 more), Silver to Gold ($2,700 more), pitch `random(2)`. On Gold, the next `hard_sell.txt` upgrade in file order (`:1077-1254`), pitch `random(3)`; when none are left, a fixed line and no draws. Refused if `frandom(10) < cheapness` or cheapness > 8 (the float is always drawn): mood +0.6 to 1.6 (upgrades +0.7 to 1.7), walk at 10, else `random(6)` line. Accepted: mood below 7 gives a `random(3)` line, else a fixed sour line. Over the limit with mood above 9: casket walks via `pissed_over_limit`, upgrade via `leave_pissed`; otherwise mood +0.4 to 1.4. |
| Guilt (`:860-966`) | If mood is already 10 or more: "You are interrupted!" and the customer walks. Pitch `random(5)`. Mood +0 to 1. Loved: a further +1 to 3, line `random(3)`. Not loved: cheapness -0.7 to 2.7 (clamped 0 to 10), line `random(4)`. |
| Sympathy (`:968-1074`) | Interrupted at mood 10 or more, as Guilt. Pitch `random(5)`. Mood +0.4 to 1.4. Not loved: a further +1 to 3, line `random(3)`. Loved: cheapness -0.7 to 2.7, line `random(4)`. |
| Done (`:7-130`) | Sale completes. |

**Correction:** the review said any action at mood 10 or more walks. Only Guilt and Sympathy check that up front. Soft and Hard Sell walk only when a refusal pushes mood to 10 or more, or when an unaffordable offer meets mood above 9; a customer already at 10 can still accept an affordable sale.

**Walkouts** (`leave_pissed` `:157-221`, `pissed_over_limit` `:224-288`): a line `random(4)` (or `random(3)` over the limit), a TV report, and only if the town has 2 or more active players, a random other player (`get_random_player_excluding`, which draws `random(slots)` until it hits an active one, deleted slots included) gets the body and `5 + random(5)` BP by mail. The mail is text, background `background_2`, the customer's portrait, the BP reward and a Continue button. The BP applies when the rival reads the mail.

**Scoring on Done** (`:40-93`)
- BP = `int(float(price) * 0.0064f)` in 32-bit floats (the v142 build in `fq.vcxproj` uses SSE2). Wood 5, Silver 16, Gold 33. Prices that are multiples of $625 land on whole numbers: $1,250 pays 8, where exact arithmetic on the float constant would give 7.
- Bonus: exactly at the limit +200, plus a front-page item; within $50 (inclusive) the trade bonus + 10 (35); within $100 the trade bonus (25). `number_is_close` is not in the repository; inclusive bounds are assumed.
- Also +1 tag of the casket tier and +1 plot. Sales over 69 BP are announced on the TV.
- If the player disconnects mid-sale (`online_util.cpp:123-133`), the sale is completed with the same bonuses and mailed ("You fainted..."), and the TV reports it.

**Price** (`online_struct.cpp:574-597`): casket + every soft-sell item bought + every upgrade up to the last one bought.

## 5. Risks and events (Ported)

- **Risk** (`commands_customer_risk.cpp`, `risks.txt`, code `classic/modules/risk.ts`): the risk is picked with `random(count)`. `*SIR*`, `*NAME*`, `*PARLOR*` and `\n` are replaced. Declining pays `random_range(4, 10)` BP. Taking it passes on `get_random_yes_no(luck, 0.90)` and wins or loses the Game Settings risk amount (default 50 BP). A loss is limited by `exp_mod` to today's BP, but the text still says 50. An empty background in the file leaves the current one on screen.
- **risks.txt loading** (`COptions.cpp:7-109`): one record is reused for the whole file, so a key a block leaves out keeps the previous block's value. The same holds for `soft_sell.txt` and `hard_sell.txt`.
- **Event** (`CEvent.cpp:115-210`, `command_random.cpp:6-60`, `events.txt`): the **first** range whose inclusive bounds bracket the player's total BP is used (later matching ranges are ignored); one entry `random(count)`; an empty or missing range draws nothing and gives "No message." with the embalming-room picture. Then `random_range` draws for luck, BP and turns, in that order (equal bounds draw nothing). BP uses `exp_mod`, luck is clamped 1 to 100, turns never go below 0. The text lists BP, luck, turns. The free-event text does not replace `\n`.
- **Script event** (`script/script_event.c`, code `classic/scripts/classicScripts.ts`): `RandomRange(1, 2)`: arson or a bonus tag.
  - **Bonus tag** (`events/bonus_tag.c`): tier `RandomRange(0, 2)`, place `RandomRange(0, 5)`, +1 tag.
  - **Arson** (`events/arson.c`): the Twins charge 6 gold tags (checked before you pick a target, paid only when they go). The target must be another player who is offline. With a smoke detector, `RandomRange(1, 10) > 2` (80%) stops the fire: the target gets 3 gold tags at once and a letter. Otherwise the target loses `int(plots × 0.05f)` plots and, without a safe, all wood tags; a headline `RandomRange(1, 2)` goes on the front page, the TV reports it, and the target gets a letter.

## 6. Town (Ported)

Code: `packages/core/src/classic/modules/{bank,store,university,yangs,church,hospital,options}.ts`, `classic/scripts/storeScripts.ts`, `classic/swearFilter.ts`. Prices and costs are in `ClassicRules.places`. Each place's screens, buttons (in the original's slot order) and messages are the original's; the Flash client's text boxes are overlays.

| Place | Rules | Source |
|---|---|---|
| Bank | Tag values wood 1, silver 2, gold 4. Exchange any pair in either direction: the player picks the tier, the target and a count. `gain = int(float(count) * (float(from) / float(to)))` in 32-bit floats (rounds down) and only `int(gain * to / from)` tags are taken, so 7 wood to gold turns 4 wood into 1 gold. Checks in order: 0 (or text that is not a number) goes back to the menu, negative ("You are very amusing sir."), more than owned, less than one tag's worth. A cancelled prompt goes back to the menu. "All to wood" turns silver and gold into wood (x2, x4); "All to gold" does that and then wood to gold, leaving the remainder as wood. | `commands_bank.cpp:155-221` (exchange), `:225-305` (prompts), `:417-517` (all to wood / gold) |
| Di-Mart hearses | Bicycle 4 gold (+0 turns, not for sale), Budget Hearse 12 (+2), Medalist 30 (+4), Statesman 50 (+7), Crown Sovereign 80 (+10). Trade-in is half the current vehicle's price, rounded down; the price shown and charged is `price - trade-in`. Buying adds the new hearse's bonus turns to today's turns. | `transportation.cpp:22-70`, `command_store.cpp:54-212` |
| Di-Mart security | Padlock 6 gold (starts at 100 percent strength), Smoke Detector 8, Safe 6, one of each; owning one is checked before the price. Lockpick 1 gold, any number, and buying keeps you on the lockpick screen. Flags live in `custom[]` (`Custom` in `state/types.ts`). | `script/store_security.c:3-8, 209-288`, `script/store_supplies.c:3-12, 14-107` |
| Spirit University | Psych: `4 + 2 x psych` gold, where `psych` is the internal level (0 for a new player, whom the stats sheet shows as "Level 1"); +1 level, and levels 1 to 5 each teach a skill (no cap). PE: `int(hp_max * 1.2f)` gold for `random_range(4, 5)` more max HP (current HP is not healed; the draw happens only after paying). Strength: `3 x strength` gold for +1. Not enough gold: a fixed line, no change, no draw. Library: Old Papers (any front page from day 1 to yesterday; `7 and `^ are recoloured to stay legible over black; outside that range "You desperately hunt around for anything dealing with a day N but fail.") and the Book of Deeds (the tournament winners, or, while there are none, a line naming the current BP leader). | `commands_spirit.cpp:79-460` |
| Yang's | Lucky Dragon: 5 BP, +10 luck, only when luck is below 40 (at 40 or more the order is refused and nothing is spent), no delivery used. Lucky Sparrow: 20 BP, +5 luck to a chosen player, the mail names the buyer. Cursed Tiger: 20 BP, -10 luck to a chosen player, anonymous, and after the draw for the fortune there is a 25 percent chance (`random(4) == 1`) of a front-page item (one of four, `random(4)`) naming the buyer; the sparrow never makes the news (that code is commented out). BP is paid from today's BP (`i_sp`), so total BP alone does not help. Sparrow and tiger share the day's allowance (`yangsPerDay`, default 1), checked when ordering and again when sending. Order of checks on sending: allowance, yourself (free refusal), target gone, BP. The fortune is the typed text, or, when empty, a random entry of `yangs.txt` / `yangs_nice.txt` picked by the target's total BP. Asking for another delivery after the allowance is gone offers "Get Bitchy": you are thrown out of Yang's until your next new day. | `commands_yangs.cpp` |
| Church | A single scene script: Father Smyth greets the player by name; the only button leaves to the map. | `script/public/church.c` |
| Hospital | The front desk greets the player by name. The sick room (where a battle loser wakes up, `command_hospital_room`) and its Leave line are provided for the battle module (`enterHospitalRoom`). | `command_hospital.cpp` |
| Name change | Stats sheet Name button. Costs `nameChangeCost` gold tags (default 1); 0 or less disables it. Order: strip dangerous characters, swear filter, cancelled, enough gold, same name, 3 to 20 characters, not another player's name (case-insensitive; your own name in other capitals is allowed). Then the tag is paid, a front-page `NAME CHANGE` line is added and the name changes. | `command_options.cpp` |
| Swear filter | On by default (`swearFilter`). Case-insensitive substring replacement of each `swear_words.txt` line in file order, each on the result of the previous one. Applied to a new player's name and parlor (after stripping, before the length checks) and to a changed name. The original also filters chat, battle messages and announcements. | `security.cpp:28-40`, `FakeCStringEx.cpp:7-28`, `new_user.cpp:22-25` |
| Pale Horse Cafe | Chat and slash commands; `/give` one tag, the recipient may receive `tagsReceivablePerDay` (default 1) a day, 0 disables it; one town-wide TV switch. Details in section 7. Code `modules/cafe.ts`. | `commands_bar.cpp` |

**What the review got wrong**

- Spirit University: the psych cost is `4 + 2 x` the internal level, which is one below the level the stats sheet shows. PE raises max HP only. The library, Old Papers and the Book of Deeds are new here.
- Yang's: the 25 percent news chance and the anonymity apply to the Cursed Tiger only. The one delivery a day is shared by both delivery dishes, and the Dragon uses none. Prices are charged to today's BP.
- Di-Mart: the trade-in is rounded down, and the cost shown for a hearse can be negative (see section 9).
- **Yang's out-of-bounds bug.** `class yangs_food` declares `i_cost[3]` and `i_mod[3]` but indexes them with `C_YANGS_DRAGON = 3` (`commands_yangs.cpp:13-33`), so its constructor writes one element past the end of each array (the cost write lands on `i_mod[0]`, the other past the object). Nothing reads index 3: the Dragon handler hard-codes 5 BP and +10 luck, the Tiger 20 BP and -10, and the constructor's "dragon cost 10" never mattered. The port uses the intended 5 / 20 / 20 from `ClassicRules.places.yangs`.
- Church: `commands_church.cpp` also exists, but the map runs `church.c` (the history file says the church is completely run by script), so the script is what is ported.

## 7. Visits, battle and the cafe (Ported)

Code: `classic/modules/visit.ts` (place `competitors`), `modules/battle.ts`, `modules/cafe.ts`, `classic/presence.ts`, `classic/nameSearch.ts`. Numbers are in `ClassicRules.pvp`.

**The row of parlors** (`commands_comp.cpp`)
- Buttons Leave, Look, Visit; the watch line counts `visitsPerDay` (2) minus visits used (`:106-128`). With none left, Visit says "Is today look at everyone's parlor day?" (`:135-143`).
- **Look** (`:80-103`, `add_rankings_alive`, `rankings.cpp:117-168`) lists every active player except the police-protected, in rank order, **online players included** and marked "on now" / "in cafe". (The review called it a list of visitable players.)
- **Visit** asks for a name; the search (`get_id_from_full_or_partial_handle`, `misc_utils.cpp:222-259`) is a case-insensitive substring over active players from slot 0, yourself included; "Do you mean X?" No searches on from the next slot; nothing (more) found: "Sorry, nobody by that name lives around here!".
- **At the door** (`:194-296`), checked in this order: your own parlor ("strangely familiar", no visit used); the rival online (see presence below); police protection; another player already holding this parlor (`b_locked`, the one-intruder lock, `get_player_who_locked_this_guy`). None of these uses a visit. Otherwise one visit is used and you hold the parlor until you leave the row.
- **Presence.** "Online" is a session the host has not reported disconnected: `setPresence(town, id, online)` (pure, returns a new town) records the host's report in `TownState.presence`; `isPresent` is what the rules read. With no reports it is exactly "has a session", the original's `p_on != NULL`.
- **Try Door** (`:370-413`): a padlock (`custom[Padlock]`) stops you, showing its strength and your lockpicks. **Pick Lock** (`:416-480`): without a pick nothing happens; otherwise `random_range(5, 10)` damage, the pick breaks, the owner gets a letter, and Continue leads inside whatever the strength left (one pick always gets you in). Below 1 the padlock falls off (padlock and strength 0).
- **Inside** (`:306-367`): the owner's max HP is shown; a safe hides Steal (a forged Steal is refused).
- **Steal** (`:521-613`, `steal_random_caskets` `:642-681`): `random(3)` picks the tier; if the victim holds none, nothing else is drawn ("can't find anything of value"); otherwise `random_range(0, 3)` capped at what they hold. The victim always gets a letter, the prowler picture and Continue. "Lingerie" only when a male thief robs a female owner.
- **Fix** `fixes.visitTargetRecheck` (default on): Try Door, Pick Lock, Inside, Steal and Attack check again that the rival is offline and unprotected. The original checked only at the door, so a rival who logged on meanwhile could still be robbed or attacked.

**Battle** (`commands_battle.cpp`)
- Attack sets both players to full HP (`commands_comp.cpp:616-635`). The cry is `random(6)` (`:241-253`). If you have **more** plots than the rival you swing first; otherwise (ties included) the rival swings before you can act (`:262-280`).
- **A blow** (`:297`, `:340`): `int(frandom(float(str+1)/2) + float(str+1)/2)` in 32-bit floats, from `int((str+1)/2)` up to `str+1` (the top value only when `rand()` returns 32767). The rival's swing draws `random(20)` **always and first**, and misses when it is 0 or the damage is 0 (`:300`); your swing misses only at 0 damage, and only then skips the `random(10)` draw that soul-smashes for double damage when it is 0 (`:343-361`). The original's other 1-in-20 checks are commented out. Attack is your swing, then theirs if both still stand (`:173-212`).
- **You win** (`:396-451`): the rival's HP is set to 0 and they get police protection; `steal_random_caskets(4)` takes 0 to 4 tags of one tier; you gain `int(bp × 0.02)` of the loser's total and they lose `int(bp × 0.01)`, both with `exp_mod_force_total` (a loss may cut into the total, never below 0; the BP are computed before either change). The TV reports the hospital trip; the victim gets a letter, the battle-lose picture and Continue.
- **You lose** (`:456-515`): the rival gains `int(your bp × 0.01)` and you lose `int(your bp × 0.005)`; the rival's letter says which day it was applied to, with the ambulance picture. No tags change hands and nobody gets police protection.
- **The quote** (`:547-662`): Continue opens a text prompt. Cancelled (`12ABORT12`) or under 2 characters: the Crime section gets the plain line and no letter is sent. Otherwise it is **swear-filtered** (`:571`, `:630`; the review's summary omitted this), filed with the quote, and mailed to the rival (winner: the hospital-room picture after the text; loser: the ambulance picture **before** the text). The winner returns to the row; the loser wakes up in the hospital (`command_hospital_room`, the hospital module's `enterHospitalRoom`).
- **Run** (`:117-152`): the rival gets a letter ("got scared and ran off"); Continue returns to the row. Run and Attack are refused once someone is down (`BattleAlreadyEnded`, `:156-171`).
- **Disconnect** (`online_util.cpp:135-156`): the original let a losing player log off to escape; the fix there is commented out. With `fixes.battleDisconnect` (default on) a log-off or `leaveGame` in a fight sets the attacker's HP to 0 and runs the loss with no screen: the rival's letter and BP, the TV, a "You fainted while fighting" letter to the loser and the Crime line "assaulted (who had fainted) in self defense" (`:492-512`). Leaving at the quote prompt files the quote-less Crime line (the original filed nothing). With the flag off, leaving changes nothing.

**Pale Horse Cafe** (`commands_bar.cpp`)
- Entering (`:321-348`) sets the status "in cafe", tells the others "X saunters in." and lists the others ("You are the only one here."). Leaving is the map's "steps outside".
- A `chat` action may hold several lines separated by `|` (`:350-411`). A line starting `/` is a command; any other is said aloud after the swear filter (`:380`; the review said chat was unfiltered). Commands (first word, case-insensitive except `?`): `/?` help; `/who` the others here; `/info` turns, visits left, BP and tags; `/give name tier` (`:136-222`: the first player in the cafe whose name contains the text; tier wood/silver/gold; checks in order: nobody found, bad tier, no such tag (told to the room), yourself (tossed in the air), the recipient's daily limit (0 means "the admin has disabled tag transfer"), then one tag moves and the room hears it); `/tv`, `/tv on` or `ON` (any other word, "On" included, turns it off); `/me text` and `/yell text`, both swear-filtered, `/yell` reaching every player online; `/all` everyone online with location and time since their last action; anything else "Unknown command".
- **Delivery.** The original queued chat packets for the client to poll (`add_que_messages_chat`, `broadcast.cpp:103-154`). The engine emits a `chat` effect `{ kind: "chat", to, text }` naming the other players in the cafe; the host delivers it. The speaker's own lines come back in the view's `chat`. Notices for everyone (`broadcast`) are queued for players outside the cafe and sent as `chat` effects to those inside (the cafe read simple text, `broadcast.cpp:126-131`).
- **The TV** is one switch for the whole town (`g_tvOn`, `commands_bar.cpp:11`, kept in `TownState.tvOn`), not one per player. TV reports reach the cafe only while it is on; the `tv` effect (the original's log line) is emitted either way.

## 8. Days, mail, the paper and the tournament (Ported)

Code: `classic/maintenance.ts`, `classic/newDay.ts`, `classic/tournament.ts`, `modules/desk.ts`, `modules/mailbox.ts`, `modules/news.ts`, `modules/rankings.ts`.

- **Global maintenance** at local midnight (`maint.cpp:362-415`), in order:
  1. Tournament over (`day == tournament days + 1`): the game is reset (below), and the restart runs the rest of this list at once (`funeral.cpp:98-103`), so the town is on day 1.
  2. Top seller of the day: most BP today, more than 0, among players whose day is current. Remembered for tomorrow's paper and mailed +25 luck and +20 BP (not on the last tournament day). Rewards apply when the mail is read.
  3. Top three parlors by total BP (more than 0): 100%, 50%, 25% of the same bonus by mail. Skipped on the last tournament day. If nobody has any BP, yesterday's top seller is forgotten too (`:229-230`, kept).
  4. Day counter +1.
  5. Per player: today's BP, Yang's deliveries and /give count reset; deleted if `last day played + 15 < day`; police protection lifted if `last day played + 1 < day`; offline players with 0 total BP deleted when the sysop's `maint delete` is on (both deletion notices can fire for one player).
  6. The day's news blurb from `news_blurbs.txt` (bracketed by game day, town stream). A blurb with `give_random` mails a random player a reward that expires the next day, in the order Continue, text, rewards, picture, Continue, news line. The news line is added to the paper when the mail is read. A turns reward is queued but the mail reader ignores it.
  7. `maint.c` (logs only).
- **A new game** runs maintenance once at start (`funeral.cpp:98-103`), so play starts on day 1; `createTown({ paused: true })` stays on day 0 instead.
- **Per-player new day**, on the first desk visit of the day (`commands_newday.cpp:3-77`, `commands_main.cpp:5-109`): turns = turns per day (15) + hearse bonus; today's BP, visits and the Yang's ban reset; police protection ends; on the tournament's final day turns are 0 and visits used up. If midnight passes while the player is online, the next desk visit shows the wake-up text instead.
- **Desk and mail** (`broadcast.cpp:14-100`, `message_que.*`): later desk visits read the queue in order. Expired packets are dropped; text is gathered; pictures replace the picture; luck and BP rewards apply as they are read (Classic). A Continue packet stops reading: what was gathered is shown in a message overlay (`mailbox:letter`, closed with `dismiss`, which reads on). A letter from a player stops at Reply / Continue, shown as a confirm overlay (`mailbox:reply`): yes opens the notepad with the quote, no reads on. Text with no stop after it is shown on the desk, as before. Normal-importance packets (log-on notices) are dropped when the player is offline or logs off.
- **Writing a letter** (the desk's pen, Flash `i_getname` / `i_namenext` / `i_mail`; `commands_getname.cpp`, `commands_send_mail.cpp`): the same name search as visits, then the notepad. An unknown or deleted recipient: "Can't email, player doesn't exist?". A letter is three packets (`send_packet_mail`, `broadcast.cpp:254-303`): the text ("You have received a letter from ..."), the quote a reply starts with, and Reply / Continue. The quote is the part after the last line starting with `>` (and the blank line after it), each line prefixed with `>`; a letter that **starts** with a quote has no `\n>` before it, so the original quotes the whole letter again (kept). A recipient in the cafe hears "You have mail waiting". The original never filtered mail; `filterUserText` (default on) runs the swear filter over it (and is offered for Yang's fortunes); `originalClassicRules()` turns it off.
- **The paper** (`commands_news.cpp`): front page or Crime section ("There has been no crime reported today.") of today or yesterday (`:124-170`); the tournament lines at the top of the front page come from the current day, whichever paper is shown (`:24-53`); the top seller panels (`:73-106`). **Make Announcement** (`:172-238`): swear filter, then every backtick removed, then each `[address]` becomes a link (the first `]` after each `[`; brackets inside dropped), then a header line and the text go on today's front page. The original wrote `http://` + address into an HTML anchor; the engine stores the address and draws a pink `RichText` span with `href` only when `http://` + address (or the address itself, if it already starts with `http://` or `https://`) parses as an http or https URL without user name or password; anything else stays plain pink text. The original's loop never ended when a `]` came before every `[` (it re-inserted the same text); here such text is left alone.
- **New players** (`new_user.cpp`): checks in order: town full, name 3 to 20 and unique (case-insensitive), log-on name 3 to 20 and unique, parlor 3 to 20, password 1 to 20 and matching, email 4 to 45. The characters `? | = / \ ; : , { } @ + < > % $`, the backtick, and characters 123 to 127 are removed from the name and parlor. Start: 500 money, 50 luck, 50 karma, 40 rating, 10 HP, 3 strength, no tags or turns. A deleted player's slot is reused. The player is announced, a front-page line is added, and the paper is shown. On day 0 and on a tournament's day N+1 new accounts are refused (`st_no_more`, `funeral.cpp:268-279`; the client hid the New button).
- **Rankings** (`rankings.cpp`): every slot (deleted ones too) sorted by total BP; the rating percentage is `100 - int(place / slots × 100)` and picks line N of `ratings.txt` (clamped 1 to 100). Ties keep slot order (the original's `qsort` left them unspecified). The screen has `View.rankings` rows (place, name, parlor, sex, BP, rating title, where the player is) and the original's fixed-width lines as text; online players show "on now", "in cafe" or "logon", offline ones "Protected" or nothing.
- **Tournament** (`maint.cpp:99-148`): default 30 days. On day N+1 nobody can play (turns 0, visits used up), new accounts are refused, the winner and the meteor go on the front page, "Top seller of the universe" replaces today's top seller, and the winner enters the Book of Deeds. The log-on game line (`lobbyStatus`, `funeral.cpp:198-236`) says the tournament is over.
- **Reset** (`reset_game.cpp`, at the next midnight or the sysop's Reset Game, `resetTown`): every session ends (`sessionEnded`, reason "reset"); players, mail, the paper and yesterday's top seller are deleted; the day goes to 0; `reset.c` runs (it only logs); then maintenance starts day 1 (with `resetTown(..., { paused: true })` the town waits on day 0 until the next midnight, the original's day-0 auto-start). The Book of Deeds, the settings, the sysop's news and the TV switch survive. The engine emits `tournamentReset` and mixes a constant into the town seed so the next tournament does not replay the last one's draws.

## Text (Ported)

Backtick codes (`funeral_util.cpp:336-495`) become `RichText` spans: `` `1 ``-`` `0 ``, `` `! ``, `` `@ ``, `` `# ``, `` `$ ``/`` `y ``, `` `w ``, `` `^ `` set a colour; `` `fN `` sets size step N; `` `= `` is "="; any other code prints a backtick and swallows the next character. Strings the original hard-coded are in `ContentPack.text` (`packages/core/src/content/classicText.ts`). The desk menu, stats labels and "not built yet" wording are new: the original drew them in Flash.

## 9. Deliberate differences from the original

| Original behaviour | Classic remaster |
|---|---|
| Re-buying a hearse grants its turns again (`price - price/2` gold); "buying" a cheaper hearse has a negative price and pays gold tags | Fixed (`fixes.hearseRebuy`, default on): only a dearer hearse can be bought. With the flag off both behaviours are reproduced and tested. |
| Disconnecting escapes a lost battle | Fixed (`fixes.battleDisconnect`): leaving mid-fight is a loss (section 7) |
| A rival who logs on while you are inside can still be robbed or attacked (only the door checks) | Fixed (`fixes.visitTargetRecheck`) |
| An announcement with `]` before every `[` hung the server | The text is left as typed |
| Mail was never swear-filtered | Filtered when `filterUserText` is on (default) |
| 0-BP players deleted at midnight | 3 midnights of grace from the day the account was made (`fixes.zeroBpGracePeriod`; the sysop toggle is still `maint delete`). The grace also covers the inactivity check for accounts that never reached the desk, which the original deleted at the first midnight once the game was older than 15 days. |
| One player per IP per day | Dropped |
| New-player welcome never shows (`commands_newday.cpp:88` tests the day after setting it) | Fixed: tested before the new day (`fixes.newPlayerWelcome`) |
| Police-patrol message never shows (`:70` tests the flag after `:42` cleared it) | Fixed: shown if the player was protected overnight; protection still ends at the new day (`fixes.policeNewDayMessage`) |
| Server down for several days advances one day | Catches up every missed day (`fixes.catchUpMissedDays`) |
| Adult and teen paired as lovers | Fixed in every mode |
| Cancelling the Old Papers prompt reads the client's abort marker `12ABORT12` as day 12 (`atoi`) | Cancel returns to the library |
| Yang's constructor writes past the end of its cost and luck arrays | Intended costs from the rules table (see section 6) |
| The swear filter would loop forever on an empty word in `swear_words.txt` | Empty words are skipped |
