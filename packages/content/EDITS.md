# Content records

## The rule

**2026-11-06, the owner:** "Setup a rule that the original dialog, even if dated or controversial,
must remain."

The original 2001 game text (every table of `legacy/dist/*.txt` and every string the original C++
hard-coded, ported as `CLASSIC_TEXT` in `packages/core/src/content/classicText.ts`) is never edited,
softened, replaced or removed, in any built-in pack or mode. In practice:

- The **Classic** pack is the untouched original, byte for byte. `packs/classic` is the importer's
  output and nothing else; it has no overrides file.
- The **Expanded** pack extends Classic and may only add. It never replaces or drops an original
  line, and every original entry stays where the engine reads it (see `src/original.ts`).
- **`vintage`** is a deprecated alias of `classic` (the same data under the old id), kept so saves,
  towns and imports that name it still load. The softened lines no longer exist in the repository.
- The **content policy** (`src/banned.ts`, `src/lint.ts`, `src/townLint.ts`) applies only to newly
  written text. A line that is, character for character, an original line is exempt automatically and
  is never a reason to change the original. The original has many such lines (KFC, Coors, Paul Crouch,
  Milli Vanilli, "white trash", the kids karma lines, Mr Yang's broken English); they all stay.
- **Enforced.** `pnpm --filter @fq/content run build` fails, listing every problem, if a built-in pack
  has lost or changed an original line (`checkOriginal`, compared with a fresh import of
  `legacy/dist` and `CLASSIC_TEXT`; Classic and Vintage must equal it exactly) or if a built-in pack
  directory has an overrides file. `test/original.test.ts` proves each check with planted violations.

## Flagged Expanded lines: kept as written

Eight lines newly written for the Expanded pack were flagged by their writers as possibly over the line. **Decided by the owner on 2026-11-06: keep all eight as written.** They are listed here for the record only; no alternative wording is kept.

### 1. The guilt backfire: "You're lucky I'm too sad to hit you."

- Where: `text.yaml`, `negotiation.guiltLoved[20]`.
- Why flagged: any customer can say it, including a 7-year-old, and it jokes about hitting someone.
- As written: `{customer}"You're lucky I'm too sad to hit you."`

### 2. The Twins' fireworks-stand news mail

- Where: `news_blurbs.yaml`, `ranges[2].entries[14]` ("THE TWINS OPEN A FIREWORKS STAND").
- Why flagged: the mail and the news line make a mass-casualty explosion a punchline.
- `giveRandom` as written: `The fireworks stand went up. All of it. The Twins are fine. The customers... bring a bucket.` `addLog` as written: `*NAME* of *HOME* buries the Twins' customers. The Twins send a wreath. It is on fire.`

### 3. The zoo-tiger news thread

- Where: `news_blurbs.yaml`, `ranges[0].entries[1]` ("ZOO ACQUIRES "MOSTLY TAME" TIGER"), `ranges[1].entries[1]` ("ZOO TIGER ESCAPES, RETURNS FOR DINNER") and `ranges[2].entries[4]` ("ZOO CLOSES TIGER EXHIBIT, OPENS TIGER MEMORIAL"). Related but not flagged: `expanded/town/news.yaml` id `zoo`, and the ordinance `tiger-bond`, which only mention the tiger.
- Why flagged: a keeper and the night watchman are eaten, played for laughs.

### 4. The potato-salad prep outcome

- Where: `expanded/prep.yaml`, entry `potato-salad` (index 53), option `Serve It`, `risk.failText`.
- Why flagged: a mass food poisoning at a wake, with the mourners "back as customers" meaning dead.
- As written: `Half the mourners are back by Thursday. On the bright side, some of them are back as customers.`

### 5. The "Mariachi-and-Bagpipe Fusion Ensemble" upgrade

- Where: `hard_sell.yaml`, entry 14 (`name`). The matching Expanded soft-sell Mariachi item was already renamed (see "Starter text changed before the rule" below).
- Why flagged: names a national music tradition as the joke.
- As written: `Mariachi-and-Bagpipe Fusion Ensemble`

### 6. The Twins' fire arc ending: "Nobody was badly hurt except, it turns out, quite a few people."

- Where: `expanded/town/arcs.yaml`, arc `twins`, beat `blaze` (ending `blaze`), `story`.
- Why flagged: the line says people were hurt in a fire and makes it a joke about insurance.
- As written: `The surprise was warmth. Elm Street burned end to end while the brigade looked for a hose it never got. Nobody was badly hurt except, it turns out, quite a few people, all of them well insured. The Twins have sent every parlor in town a thank-you card.`

### 7. The kneecappers news story

- Where: `expanded/town/news.yaml`, id `muscle-glut` (index 21), `title` and `message`.
- Why flagged: celebrates a glut of violent men for hire.
- Title as written: `COUNTY RELEASES SIX MEN WITH TIRE IRONS, SAME DAY`. Message as written: `A paperwork error at the county lock-up let six career kneecappers out on one morning. "Supply and demand," shrugs a man in a trench coat outside the Reaper Club. "Mostly supply."`

### 8. The Yang's fortune-printer story

- Where: `expanded/town/news.yaml`, id `fortune-jam` (index 41), `title` and `message`.
- Why flagged: a death-threat fortune delivered to every customer of a family restaurant, with June's "it's accurate" reply.
- Title as written: `YANG'S FORTUNE PRINTER JAMS ON 'YOU WILL DIE'`. Message as written: `Every cookie at Yang's last night said the same thing. June says the printer is fixed and that she "doesn't see the problem, it's accurate." Superstitious families are spending big, just in case.`

## Reverted

The Classic pack used to be the original plus 21 softening edits (`packs/classic/overrides.yaml`,
19 at first and 2 added on 2026-11-05). All 21 are gone; the original text is back in Classic, in
Vintage (the alias) and in Expanded. What was restored:

| Table                                | Original text, now back                                                                                                                                                                        |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| karma, slot 3                        | `Paul Crouch`                                                                                                                                                                                  |
| karma, slot 4                        | `Sony Executive`                                                                                                                                                                               |
| karma, slot 14                       | `AOL user`                                                                                                                                                                                     |
| karma, slot 15                       | `WebTV user`                                                                                                                                                                                   |
| karma, slot 17                       | `Enjoys Jay Leno`                                                                                                                                                                              |
| karma, slot 18                       | `Beats kids`                                                                                                                                                                                   |
| karma, slot 19                       | `Gives 'candy' to kids`                                                                                                                                                                        |
| karma, slot 23                       | `Enjoys Coors light`                                                                                                                                                                           |
| karma, slot 24                       | `Eats at KFC`                                                                                                                                                                                  |
| karma, slot 26                       | `Entertained by TNN`                                                                                                                                                                           |
| karma, slot 37                       | `Enjoyed 'Mission to Mars'`                                                                                                                                                                    |
| ratings, slot 40                     | `Fairly popular for white trash funerals.`                                                                                                                                                     |
| ratings, slot 85                     | `You listen to Milli Vanilli`                                                                                                                                                                  |
| hard sell, item 1                    | `Forest Lawn Premier Double Plot`                                                                                                                                                              |
| text, `negotiation.sympathyLoved[2]` | `...but we were REALLY close if you know what I mean.`                                                                                                                                         |
| fortunes (yangs.txt), 4 lines        | `Man who drop watch in toilet bound to have crappy time.`, `Man who stand on toilet is high on pot.`, `Baseball wrong.  Man with four balls no walk.`, `Man who run behind car get exhausted.` |
| text, `places.yangs.news[1]`         | `I'm going deliver it all the way to` (Mr Yang's quote)                                                                                                                                        |
| text, `places.yangs.news[2]`         | `People like {name} buying so much delivery,` (Mr Yang's quote)                                                                                                                                |

That is 21 lines (3 minors, 1 slur, 4 Yang's fortunes and 2 Yang's news quotes, 3 real people, 8
real brands). The 2026-11-05 review of the `places` and `social` text added only the last two.

One more original change, in the Expanded pack rather than Classic: ratings slots 88, 89 and 90
repeat slot 86 in the original ("Your parlor is in the top 20 percent."), and the Expanded pack had
replaced the repeats with three new lines. The repeats are back (the new lines were removed from
`packs/expanded/ratings.yaml`). Expanded still fills ratings 67 to 69 and many empty karma slots,
which adds lines and replaces none.

Nothing else in Expanded replaced or dropped an original line: the audit (and now the build) found
every original event, news blurb, fortune, no-customer line, risk, soft sell, hard-sell upgrade
(original ten first, in file order, the new ones after), swear word and text string in place.

## Starter text changed before the rule (unaffected)

Expanded also changed some of the **newly written** starter set that `packages/core` ships for the
Expanded ruleset (`starter.ts`, `townStarter.ts`). That text was never original dialog, so the rule
does not touch these changes and they stay; the content policy still applies to it. They are
recorded here for the owner:

| Starter text                                   | Expanded                                     | Why                                                                                                                                             |
| ---------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| prep `windex` (Windex)                         | `glass-cleaner` (Streak-B-Gone)              | Real brand in a new prep choice.                                                                                                                |
| plot tier `Forest Lawn Plot`                   | `Evergreen Lawn Plot`                        | Real cemetery operator in a new package tier. (The original hard sell `Forest Lawn Premier Double Plot` is original text and stays.)            |
| headstone tier `Naked Statue`                  | `Life-Size Bronze Statue (Heroic Pose)`      | The deceased can be a child.                                                                                                                    |
| soft sell `Mariachi Band`                      | `Wedding Band That Only Knows Wedding Songs` | Avoids a group stereotype in a new catalogue item. (debatable: a hard sell `Mariachi-and-Bagpipe Fusion Ensemble` is awaiting a decision above) |
| coffee pitch "since the Reagan administration" | "since the last time the Mayor was sober"    | Real person in a new line.                                                                                                                      |
| market `Kevlar Vest, One Small Hole`           | `Bulletproof Vest, One Small Hole`           | Real brand in a new market item.                                                                                                                |
| hospital `leadIntro` "`${nurse} knows..."      | "The Nurse knows..."                         | Not policy: `{nurse}` is not filled in that field.                                                                                              |
| cast `Mayor Wilma Boggs`                       | `Mayor Hollis Grubb`                         | Not policy: the pack's earlier lines make the Mayor a man.                                                                                      |
| cast `the teller`, `Inspector Pratt`           | `Prudence Ledbetter`, `Inspector Mudge`      | Not policy: the teller special is Prudence Ledbetter; Pratt was too close to the zoo's Hank Pruitt.                                             |

Looked at and kept: the hit man, the house games, the Twins' arson running joke, Yang's fortune
printer (a printer joke, no accent). The Expanded ruleset (balance and art catch-up of 2026-11-06)
also reworded the injuries, perk descriptions and arc tests, and added Remastered picture ids; none
of that is policy and none of it touches original text.

## Edges of the rule (decisions taken, for the owner to confirm)

- **Sysop packs.** `loadPackFromDirectory` still accepts an `overrides.yaml` for a sysop's own pack
  (`FQ_PACKS_DIR`; the server tests and README use it). The rule is enforced on the built-in packs:
  a built-in pack directory with an overrides file fails the load. Say if custom packs should lose it
  too.
- **Generator fix.** The Classic fidelity table (REMASTER_PLAN 3.2) still fixes the adult customer
  with a teen deceased partner in the customer generator. That is game logic, not an original line of
  dialog, so it was left alone.
- **Expanded ruleset flows.** The Expanded ruleset sells from its own `expanded` catalogue and uses
  its own text pools, so some original lines (for example the 55 original soft-sell items) are in the
  Expanded pack but are not offered by Expanded-ruleset towns. Nothing was removed; whether to offer
  them there is a design question.
- **Licensing.** The hearse names and descriptions in `CLASSIC_TEXT` (`Medalist`, `Statesman`, `Crown
  Sovereign`) look like real hearse model names and brochure copy. They stay (original text); you may
  want to check them for licensing.
