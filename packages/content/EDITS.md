# Classic pack edits, for approval

## Awaiting the owner's decision

Eight Expanded lines were flagged by their writers as possibly over the line. (The brief said six; eight were named, so all eight are here.) None of them has been changed. Each has a ready-made milder alternative: to accept it, replace the quoted text at the file and key given and run `pnpm --filter @fq/content run build`; to keep the original, do nothing and delete the entry here. All paths are under `packages/content/packs/expanded/`.

### 1. The guilt backfire: "You're lucky I'm too sad to hit you."

- Where: `text.yaml`, `negotiation.guiltLoved[20]`.
- Why flagged: any customer can say it, including a 7-year-old, and it jokes about hitting someone.
- Original: `{customer}"You're lucky I'm too sad to hit you."`
- Milder: `{customer}"I'm too sad to even argue with you."`
- Age-gating: **not possible with the types as they are.** `guiltLoved` is a plain `string[]` (`ContentPack.text.negotiation`, `packages/core/src/content/classicText.ts`), and both negotiation modules (`classic/modules/negotiation.ts`, `expanded/negotiation.ts`) pick one line at random with no look at the customer's age or relation. Gating would need an engine change in `packages/core` (for example `guiltLovedYoung`, or lines tagged with an age band). Until then the milder line is the only safe fix.

### 2. The Twins' fireworks-stand news mail

- Where: `news_blurbs.yaml`, `ranges[2].entries[14]` ("THE TWINS OPEN A FIREWORKS STAND").
- Why flagged: the mail and the news line make a mass-casualty explosion a punchline.
- Original `giveRandom`: `The fireworks stand went up. All of it. The Twins are fine. The customers... bring a bucket.` Original `addLog`: `*NAME* of *HOME* buries the Twins' customers. The Twins send a wreath. It is on fire.`
- Milder `giveRandom`: `"The fireworks stand went up. All of it. The Twins are fine. The Twins' accountant saw the insurance forms and had a heart attack. Bring a ladder."` Milder `addLog`: `` `7FIREWORKS STAND EXPLODES\n`^*NAME* of *HOME* buries the Twins' accountant. The Twins send a wreath. It is on fire. ``

### 3. The zoo-tiger news thread

- Where: `news_blurbs.yaml`, `ranges[0].entries[1]` ("ZOO ACQUIRES "MOSTLY TAME" TIGER"), `ranges[1].entries[1]` ("ZOO TIGER ESCAPES, RETURNS FOR DINNER") and `ranges[2].entries[4]` ("ZOO CLOSES TIGER EXHIBIT, OPENS TIGER MEMORIAL"). Related but not flagged: `expanded/town/news.yaml` id `zoo`, and the ordinance `tiger-bond`, which only mention the tiger.
- Why flagged: a keeper and the night watchman are eaten, played for laughs.
- Milder: first blurb `"has only eaten one keeper, and that was during orientation."` becomes `"has only eaten one keeper's lunch, and that was during orientation."`. Second blurb `message`: `"He came back on his own, and very full," says zoo director Hank Pruitt. A head count of the zoo's parrots is under way.` with `giveRandom` `The zoo director walks in with a shovel and a sad face.\n\n"We found most of the parrot. He was 94 and said some words at the end."` and `addLog` `` `7TIGER TRAGEDY\n`^*NAME* of *HOME* will bury the zoo's oldest parrot, and whatever else turns up in the tiger enclosure. `` Third blurb: `The tiger is fine. The memorial is for the parrot. Zoo director Hank Pruitt will be honored in a separate ceremony, in the reptile house.`

### 4. The potato-salad prep outcome

- Where: `expanded/prep.yaml`, entry `potato-salad` (index 53), option `Serve It`, `risk.failText`.
- Why flagged: a mass food poisoning at a wake, with the mourners "back as customers" meaning dead.
- Original: `Half the mourners are back by Thursday. On the bright side, some of them are back as customers.`
- Milder: `Half the mourners spend Thursday indisposed and blame you. Nobody is dead, which is bad for business and good for everything else.` (The option's own text, "Nobody gets sick. Nobody gets sick yet.", can stay.)

### 5. The "Mariachi-and-Bagpipe Fusion Ensemble" upgrade

- Where: `hard_sell.yaml`, entry 14 (`name`). The matching soft-sell Mariachi item was already renamed (see "The Expanded pack" below).
- Why flagged: names a national music tradition as the joke.
- Original: `Mariachi-and-Bagpipe Fusion Ensemble`
- Milder: `Brass-and-Bagpipe Fusion Ensemble` (article `a` still fits; the price stays $2,350).

### 6. The Twins' fire arc ending: "Nobody was badly hurt except, it turns out, quite a few people."

- Where: `expanded/town/arcs.yaml`, arc `twins`, beat `blaze` (ending `blaze`), `story`.
- Why flagged: the line says people were hurt in a fire and makes it a joke about insurance.
- Original: `The surprise was warmth. Elm Street burned end to end while the brigade looked for a hose it never got. Nobody was badly hurt except, it turns out, quite a few people, all of them well insured. The Twins have sent every parlor in town a thank-you card.`
- Milder: `The surprise was warmth. Elm Street burned end to end while the brigade looked for a hose it never got. Everyone got out in time, which the Twins describe as a bit of a letdown, and the insurance adjusters are still counting. The Twins have sent every parlor in town a thank-you card.`

### 7. The kneecappers news story

- Where: `expanded/town/news.yaml`, id `muscle-glut` (index 21), `title` and `message`.
- Why flagged: celebrates a glut of violent men for hire.
- Original title: `COUNTY RELEASES SIX MEN WITH TIRE IRONS, SAME DAY`. Original message: `A paperwork error at the county lock-up let six career kneecappers out on one morning. "Supply and demand," shrugs a man in a trench coat outside the Reaper Club. "Mostly supply."`
- Milder title: `COUNTY RELEASES SIX ENFORCERS, SAME DAY`. Milder message: `A paperwork error at the county lock-up let six career enforcers out on one morning. "Supply and demand," shrugs a man in a trench coat outside the Reaper Club. "Mostly supply."` (The effect line, "hit men 20% cheaper today", and the modifier stay.)

### 8. The Yang's fortune-printer story

- Where: `expanded/town/news.yaml`, id `fortune-jam` (index 41), `title` and `message`.
- Why flagged: a death-threat fortune delivered to every customer of a family restaurant, with June's "it's accurate" reply.
- Original title: `YANG'S FORTUNE PRINTER JAMS ON 'YOU WILL DIE'`. Original message: `Every cookie at Yang's last night said the same thing. June says the printer is fixed and that she "doesn't see the problem, it's accurate." Superstitious families are spending big, just in case.`
- Milder title: `YANG'S FORTUNE PRINTER JAMS ON 'SPEND IT NOW'`. Milder message: `Every cookie at Yang's last night said SPEND IT NOW, YOU CAN'T TAKE IT WITH YOU. June says the printer is fixed and that she "doesn't see the problem, it's accurate." Superstitious families are spending big, just in case.`

The Classic pack is the Vintage pack (the untouched 2001 text) plus the edits in
`packs/classic/overrides.yaml`. This file lists each one so you can approve or reject it. To reject
an edit, delete its block from `overrides.yaml`, then run `pnpm --filter @fq/content run build`. Both
the YAML and `built/classic.json` are checked in.

Policy applied (docs/REMASTER_PLAN.md 3.2): change only lines that involve minors in sexual or
abusive jokes, slurs aimed at groups, the mock broken English of the Yang's characters, and real
people or brands used as insults or as an implied endorsement. Swearing, gross-out humour, death
jokes and funeral-industry satire are untouched.

How the edits are made safe:

- No entry is removed or added, so table lengths and the engine's `random(count)` draws are
  unchanged. A test plays the same seed under both packs and gets identical games.
- Every `original` must be found exactly once in the Vintage table it names, or the build fails.
- A replacement must keep the `{placeholders}` and `*TOKENS*` of the original.

There were **19 edits** at first (a later review added 2, see the end): 3 minors, 1 slur, 4 stereotype, 3 real person, 8 real brand. The ones I am
least sure about are marked (debatable).

## Minors (3)

| Table                                | Original                                               | Replacement                                                 | Why                                                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| karma, slot 18                       | `Beats kids`                                           | `Kicks puppies`                                             | Child abuse as a punchline.                                                                                                                         |
| karma, slot 19                       | `Gives 'candy' to kids`                                | `Steals candy from the church bake sale`                    | Predator innuendo aimed at children.                                                                                                                |
| text, `negotiation.sympathyLoved[2]` | `...but we were REALLY close if you know what I mean.` | `...but we were REALLY close, we even shared a toothbrush.` | Incest innuendo. The customer and the deceased can be children and the relation can be son, daughter or sibling, so the line can pair with a minor. |

## Slur (1)

| Table            | Original                                   | Replacement                             | Why                          |
| ---------------- | ------------------------------------------ | --------------------------------------- | ---------------------------- |
| ratings, slot 40 | `Fairly popular for white trash funerals.` | `Fairly popular for tailgate funerals.` | Class slur aimed at a group. |

## Stereotype: Yang's mock broken English (4)

All four are fortune-cookie lines in `yangs.txt` (cursed fortunes). The pun in each is kept; only the
accent is gone.

| Original                                                  | Replacement                                                           |
| --------------------------------------------------------- | --------------------------------------------------------------------- |
| `Man who drop watch in toilet bound to have crappy time.` | `Whoever drops a watch in the toilet is bound to have a crappy time.` |
| `Man who stand on toilet is high on pot.`                 | `Anyone who stands on the toilet is high on pot.`                     |
| `Baseball wrong.  Man with four balls no walk.`           | `Baseball is wrong.  A man with four balls cannot walk.`              |
| `Man who run behind car get exhausted.`                   | `Anyone who runs behind a car gets exhausted.`                        |

## Real people used as insults (3)

| Table            | Original                      | Replacement                           | Why                                                       |
| ---------------- | ----------------------------- | ------------------------------------- | --------------------------------------------------------- |
| karma, slot 3    | `Paul Crouch`                 | `Bishop Billy Bucks`                  | Real televangelist named as an evil-karma insult.         |
| karma, slot 17   | `Enjoys Jay Leno`             | `Enjoys Johnny Latenight`             | Real host as the butt of the joke.                        |
| ratings, slot 85 | `You listen to Milli Vanilli` | `You listen to the Lip Sync Brothers` | Real act as the butt of the joke; the lip-sync gag stays. |

## Real brands used as insults or as an endorsement (8)

| Table             | Original                          | Replacement                                | Why                                                                                   |
| ----------------- | --------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------- |
| karma, slot 4     | `Sony Executive`                  | `Media Conglomerate Executive`             | A real company's executives as an insult.                                             |
| karma, slot 14    | `AOL user`                        | `Dial-Up Online user`                      | Real service as the insult. (debatable)                                               |
| karma, slot 15    | `WebTV user`                      | `Couch Web Box user`                       | Real product as the insult. (debatable)                                               |
| karma, slot 23    | `Enjoys Coors light`              | `Enjoys Silver Moose Light`                | Real beer as the insult. (debatable)                                                  |
| karma, slot 24    | `Eats at KFC`                     | `Eats at Colonel Clucky's`                 | Real chain as the insult. (debatable)                                                 |
| karma, slot 26    | `Entertained by TNN`              | `Entertained by the Monster Truck Channel` | Real network as the insult. (debatable)                                               |
| karma, slot 37    | `Enjoyed 'Mission to Mars'`       | `Enjoyed 'Mission to Neptune'`             | Real film named as a mark of bad taste. (debatable)                                   |
| hard sell, item 1 | `Forest Lawn Premier Double Plot` | `Evergreen Lawn Premier Double Plot`       | Real cemetery operator's name on a product the player sells; reads as an endorsement. |

The six (debatable) brand lines are the weakest case: the brand is the punchline, but nothing says
anything false about it. Dropping all six leaves 13 edits.

## Looked at and left alone

Say if you want any of these changed; each is one more block in `overrides.yaml`.

- karma 6 `Eats Children`: cartoon cannibal villain, in the same register as `Demon Like`. Kept.
- karma 87 `Trusted with girlscouts`, 90 `Children and Kittens trust you`, 35 `Pops children's
  balloons`: harmless. Kept.
- karma 21, 22, 25, 31 (`Bootlegs PlayStation CDs`, `Id games`, `Dreamcast CDs`, `Epic games`),
  28 `Plays UNO`, 29 Pokemon, 32 `EQ`, 33 `NES roms`: the crime or hobby is the joke, not the brand.
  Kept.
- ratings 92 `2Pac is buried here`, 93 `Elvis is buried here`, and the hard-sell `plot next to Elvis`:
  dead celebrities as funeral-industry in-jokes, not insults. Kept.
- ratings 52 `Cadillacs parked out front`, 78 `You wear a rolex`: status symbols, no insult. Kept.
- ratings 19 `Trailer park people use you.`: a class stereotype but not a slur. Kept.
- karma 98 `Pap like`, 99 `Seth Like`: praise for people connected to the original game. Kept.
- Events and news: `Viagra`, `Napster`, `FOX`, `Nancy Drew`, `BackDraft`, `Scooby-Doo` and the
  `I Can't Believe It Wasn't Butter` pun are references, not insults. `Di-Mart`, `Bill's Big Burger`
  and `Forever Fragrant` are already invented. Kept.
- Fortune `Help! I am being held prisoner in a Chinese bakery.`: the stock fortune-cookie gag, not
  mock speech. Kept.
- The hearse names and descriptions in `CLASSIC_TEXT` (`Medalist`, `Statesman`, `Crown Sovereign`)
  look like real hearse model names and brochure copy. They are not insults, so no edit, but you may
  want to check them for licensing.
- The swear-word filter list (`swear_words.txt`) is a list of swear words and their polite
  replacements. Kept as is.

## Outside the pack, for later

- (Done: the Yang's restaurant text is now in `CLASSIC_TEXT`; see "Review of 2026-11-05" below.)
- The scripts in `legacy/dist/script` contain no text that the policy covers.

## Review of 2026-11-05: the new `places` and `social` text

Review of the text groups added to `CLASSIC_TEXT` after the 19 edits above were made: `places` (bank,
Di-Mart, Spirit University, Yang's, hospital, name change) and `social` (parlor visits, battle, cafe,
mail, newspaper, log-on game line). Same policy, same mechanism. Vintage is untouched. To reject an
edit, delete its block from `overrides.yaml` (ids below) and run
`pnpm --filter @fq/content run build`. The total is now **21 edits**; these are the last 2, both
category stereotype.

| Id                            | Table                        | Original                                      | Replacement                                         | Why                                                                                     |
| ----------------------------- | ---------------------------- | --------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `yangs-news-deliver-it`       | text, `places.yangs.news[1]` | `I'm going deliver it all the way to`         | `I am going to deliver it all the way to`           | Mr Yang's quote drops a word to mock broken English. The boast (no extra charge) stays. |
| `yangs-news-so-much-delivery` | text, `places.yangs.news[2]` | `People like {name} buying so much delivery,` | `People like {name} are ordering so much delivery,` | Same accent in Mr Yang's second quote. (debatable: the original is only slightly off)   |

### Looked at and left alone

- June's lines (`Just leave, asshole.`, `Ah.. someone you are not too fond of, I take it.`, the delivery
  excuses) are fluent, so there is no mock speech to remove. The swearing stays by policy. The
  restaurant itself (a Chinese-American family business, Lucky Dragon, Sparrow and Tiger, the fortune
  cookies) is a setting, not a slur. If you want it reframed, that is a design change, not an edit.
- Battle taunts and cries (`Stop stealing my customers!`, `I will BURY you!`, `Discount this,
  bastard!` / `bitch!`, `You're an amateur! You don't belong here!`) are swearing and rivalry aimed
  at one player, not at a group. Kept.
- `social.visit.caught` with `pajamas` / `lingerie` (the burglar caught in his clothes): a gender
  gag about adults, nothing involving minors. Kept.
- `places.university.library` ("one nerdy looking kid hogging the lone library computer"): a mild
  stereotype, not an abusive or sexual joke about a child. Kept.
- `places.store`: `Di-Mart` and `DuraRest (tm)` are inventions of the original; Elijah is "a really
  creepy looking guy in a suit", not a real person. Kept.
- Cafe, mail, news and lobby text: system messages. Nothing to edit.

## The Expanded pack (`packs/expanded`)

Expanded is Classic plus new writing (`pack.yaml`: `extends: classic`, `merge: append`), so every
Classic line above is kept as edited. New lines are held to the same policy by the build: `src/lint.ts`
fails it on real brands, real people and slurs (`src/banned.ts`; slurs are stored hashed), on
placeholders the engine does not fill, and on duplicates, prices, lengths and mechanics out of range.
Lines identical to a reviewed Classic line are exempt. Changes to the core starter set it was written
over, for approval:

| Starter text                                   | Expanded                                     | Why                                                                                                                 |
| ---------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| prep `windex` (Windex)                         | `glass-cleaner` (Streak-B-Gone)              | Real brand.                                                                                                         |
| plot tier `Forest Lawn Plot`                   | `Evergreen Lawn Plot`                        | Real cemetery operator (as hard sell item 1 above).                                                                 |
| headstone tier `Naked Statue`                  | `Life-Size Bronze Statue (Heroic Pose)`      | The deceased can be a child.                                                                                        |
| soft sell `Mariachi Band`                      | `Wedding Band That Only Knows Wedding Songs` | Avoids a group stereotype. (debatable: a hard sell `Mariachi-and-Bagpipe Fusion Ensemble` was kept as a genre joke) |
| coffee pitch "since the Reagan administration" | "since the last time the Mayor was sober"    | Real person.                                                                                                        |

Ratings slots 88 to 90 repeated slot 86 ("top 20 percent"); Expanded gives them new lines.

### The town (`packs/expanded/expanded/town`)

The Expanded pack now carries its own `town` section, so the core starter town
(`packages/core/src/expanded/content/townStarter.ts`) is no longer used with it. The build's lint
covers it (`src/townLint.ts`). Changes from the starter's text, for approval:

| Starter text                              | Expanded                                | Why                                                                                                       |
| ----------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| market `Kevlar Vest, One Small Hole`      | `Bulletproof Vest, One Small Hole`      | Real brand (the lint's brand list flags it).                                                              |
| hospital `leadIntro` "`${nurse} knows..." | "The Nurse knows..."                    | Not policy: `{nurse}` is not filled in that field, so the starter showed it raw. The lint now catches it. |
| cast `Mayor Wilma Boggs`                  | `Mayor Hollis Grubb`                    | Not policy: the pack's earlier lines make the Mayor a man ("He keeps the scissors").                      |
| cast `the teller`, `Inspector Pratt`      | `Prudence Ledbetter`, `Inspector Mudge` | Not policy: the teller special is Prudence Ledbetter; Pratt was too close to the zoo's Hank Pruitt.       |

Looked at and kept: the hit man (a tire iron, kneecaps, named in the paper when he talks; no method
beyond that), the house games (each intro says the house comes out ahead), the Twins' arson running
joke (as the original's), Yang's fortune printer (a printer joke, no accent).

## Review of 2026-11-06: balance and art catch-up (Expanded only)

Classic and Vintage are untouched (their built JSON is byte-identical). In the Expanded pack:

- The 16 injuries now name their `causes`. Five texts were reworded so they make sense for every cause they name: `cracked-skull` (was about a headstone), `shovel-face` ("Something flat and heavy"), `thrown-back` (was about lifting a linebacker; now "thrown over a shoulder"), `bingo-elbow` (no longer "going for the last card") and `lectern-lump` ("the eulogy lectern", not Father Smyth's). The hit mail no longer says "your kneecaps" because any hit injury can follow it.
- Text made wrong by tuning: Peace Pledge insurance (`{tax}`), the mayor's perk (`{rating}`; no chauffeur or extra turn), the Trusted, Grave Robber and Necromancer perk descriptions, the loan's up-front fee (`{fee}`), and the Di-Mart arc's sales test (10 a player became 70 a player: a full day is about 16 sales).
- Pictures: Remastered ids for the graveyard, duel, City Hall, bingo, hospital and club, and `places/prep-*` for 18 body-preparation scenes.
