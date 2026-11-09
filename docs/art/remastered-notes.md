# Remastered art pack: notes

The Remastered pack is new vector art for FuneralQuest Remastered, drawn in the style of Akiko Robinson's 2001 artwork (see `style-guide.md`). It redraws the twelve auto-traced photographs, and adds the Expanded ruleset's places, people and icons. It replaces no original portrait. Everything it does not draw is the Classic art, and the UI chrome stays the original's.

- **Files:** `assets/remastered/<id>.svg` (96 SVGs, 1.5 MB in all, largest 131 KB), listed with grade, notes, credit and licence in `assets/remastered/manifest.json`.
- **Sheets:** `assets/remastered/contact-sheet.png` and `.html` (every piece with its grade); `assets/remastered/comparisons.png` and `comparisons/*.png` (each traced original beside its redraw).
- **Credit:** "FuneralQuest Remastered project, in the style of Akiko Robinson's original art", CC BY 4.0. No original portrait is overridden: every original person picture is used unchanged under every art pack.

## How it is made

Every piece is hand-authored SVG written as code in `tools/art/`:

| File | What it is |
| --- | --- |
| `palette.mjs` | The palette, sampled from the originals (the source file of each colour is noted). |
| `lib.mjs` | SVG helpers: shapes, smooth curves, scalloped edges, gradients, a seeded random stream. |
| `parts.mjs` | Reusable parts: a perspective camera, headstones, trees, fog, gas lamps, caskets, the map-icon projection. |
| `face.mjs` | The portrait kit: head planes, heavy-lidded eyes, nose, mouth, wrinkles, hair, hats, clothes. |
| `font.mjs` | Hand-lettered capitals drawn as paths, for signs (no fonts in any file). |
| `pieces/*.mjs` | One function per piece, with its id, grade and notes. |
| `build.mjs` | Writes every piece and the manifest; `--preview DIR` renders PNGs. UI pieces and icons are copied into the client pack. |
| `check.mjs` | Fails on any SVG that does not render, has the wrong viewBox, or holds a bitmap, an external reference, live text or script. |
| `sheets.py` | The contact sheet and comparison sheets. |
| `thumbs.mjs` | The first-pass thumbnails (composition block-ins), kept for reference. |

```sh
node tools/art/build.mjs            # all pieces and the manifest
node tools/art/build.mjs places/    # only ids starting with places/
node tools/art/check.mjs            # verify
python3 tools/art/sheets.py         # contact and comparison sheets
```

The output files are standalone: each has its own `<defs>`, and nothing references anything outside it. Parts are shared in the generator, never between files.

## The client

`apps/client/src/art/packs/remastered/pack.json` declares the pack with `"extends": "classic"`. The client's pack loader (`src/art/packs.ts`) now:

- merges a pack over the pack it extends (pieces, cabinets, fits, map, newspaper, icons, pictures); a placeholder the pack replaces stops being a placeholder;
- finds picture overrides in `assets/<pack id>/**.svg` (every pack folder but Classic, minus `ui/` and `icons/`) and bundles them as hashed assets, so a production build needs no change to the art copying;
- finds `icons/*.svg` in a pack folder (the ledger, town strip, office ladder and karma balance).

A picture layer tries the pack's drawing first, then the Classic URL from the asset base, then the labelled placeholder (`src/components/Picture.tsx`). `XIcon`, `BuildingGlyph` and `KarmaScale` use the pack's icon when there is one and their own inline glyph otherwise. Tests: `apps/client/test/remastered.test.tsx`.

## What was drawn, and grades

A ships; B is an acceptable placeholder that holds up beside the originals; C needs an illustrator.

**The twelve redraws (all B).** Each keeps the original's subject and composition role:

| Id | Notes |
| --- | --- |
| `places/store` | Di-Mart aisle of racked caskets in six finishes, DI-MART banner; centre calm for the store clerk. |
| `places/palors` | One-point street of parlors in fog, gas lamps, gilt crosses, hanging coffin signs. |
| `places/bank` | Prudence Ledbetter behind brass bars counting bills, EXCHANGE plate top left. Her small figure is the weakest part. |
| `places/fire` | A clapboard parlor ablaze at night, two rim-lit firefighters hosing it. The firefighters are stiff. |
| `background/background_1` | Gnarled trunks arching over a misty path. |
| `background/background_2` | Dark panelled sitting room, drapes, grey window, wing chair, fringed lamp. |
| `background/background_3` | Under the rafters of a half-ruined church, glowing window at the end. |
| `background/background_4` | A wall of leaves with blossom and berries; shaded where Class and Mood are written. |
| `background/background_5` | A pink, over-upholstered parlor with a swagged arch (the Twins' backdrop). Rather empty. |
| `background/background_7` | Moonlit crooked headstones and a tall cross under a starry sky. |
| `background/background_church` | The nave: pews, altar and wooden cross, stained glass, three saints. |
| `background/background_celemony` | The cemetery by day with flat markers, soft trees; horizon kept where the ceremony fg expects it. |

**Expanded places (all B):** `places/graveyard`, `places/graveyard-duel`, `places/city-hall`, `places/mayor-office`, `places/reaper-club-door`, `places/reaper-club`, `places/reaper-tables`, `places/black-market`, `places/parlor-office`, `places/parlor-1` to `-5` (Shack, Fixer-Upper, Respectable, Chapel House, Colonial Mansion: one building growing, in the object style of the original shack and mansion), `places/prep-table`, `places/prep-cosmetics`, `places/prep-viewing`, `places/bingo-night`, `places/sick-room`, `places/bank-vault`.

**Portraits:** `people/mayor-grubb`, `people/lucius-vane`, `people/inspector-mudge`, `people/teller-prudence`, `people/nurse-gertie`, and four new customers `people/f_old_3` (churchgoer in a Sunday hat), `people/m_adult_5` (farmer), `people/f_adult_3` (diner waitress), `people/m_old_7` (retired watchmaker): **all C**. `people/morty` (the parlor skeleton with one glass eye): **B**.

**UI and icons:** `ui/capsule-parlor` **A**; `ui/building-city-hall` and `ui/building-reaper-club` **B**; 20 ledger and town-strip icons, `icons/karma-balance`, `icons/parlor-1` to `-5` and `icons/monument-1` to `-5`: **B**.

**The eight batch A and B places** (docs/expanded-rules.md sections 30 and 31):

- **Map buildings** (`ui/building-police-station`, `-crematorium`, `-florist`, `-gazette`, `-coroner`, `-health-department`, `-pawn-shop`, `-mournes`; **B**): the oblique projection, 1.3 unit black outline, translucent shadow and two-tone gradient faces of the City Hall and Reaper Club. Police: blue-grey stone, POLICE band, globe lamps, beacon, flag. Crematorium: brick, iron oven door, tall chimney and smoke. Florist: pink cottage, green gable, striped awnings, blooms. Gazette: tall tan office, red masthead, water tank. Coroner: pale green-grey block, green lamps, hearse bay. Health Department: white clinic, green band and cross, clipboard board. Pawn Shop: brownstone, PAWN banner, three gold balls. Mourne & Sons: charcoal Victorian, white porch, wreathed black door. They are drawn smaller than the original buildings (about 60% of the City Hall's footprint) because the base map has little free ground; their hot-spots also left the bottom edge, where the baked-in "Deathville Map" title sits (`apps/client/src/art/packs/classic/pack.json` `map.expanded`, `src/scenes/mapData.ts`). `tools/art/placeholders.mjs` writes the same buildings flat (plain fills, no texture lines) as the Classic pack's stand-ins.
- **Scenes** (`places/florist`, `places/gazette`, `places/coroner`, `places/health-department`, `places/pawn-shop`, `places/mournes`; **B**): flat interiors in the manner of `places/parlor-office` and `places/prep-table`, the middle third left calm for the portrait. The Police Station keeps the original `places/funeral_enemy_police` (a squad car at a funeral home) and the Crematorium the original `places/creamation_oven`; both already fit.
- **Portraits** (`people/sergeant-bixby`, `marigold-thorne`, `hal-pennywhistle`, `dr-grimble`, `cousin-sal`, `augustus-mourne`; **C**): the same parametric head as the other new portraits, with the same limits. The Health Department keeps `people/inspector-mudge`.
- **Sheets:** `assets/remastered/places-comparison.png` (the Classic map with every building in place, then the new buildings beside the originals) and `places-scenes-comparison.png` (new scenes beside existing ones, each new portrait in front of its scene). Sources: `tools/art/pieces/buildings8.mjs`, `places8.mjs`, `people3.mjs`; `fit8.mjs` measures each building's fit; `places8_sheet.py` makes the sheets.
- **Grade:** the buildings match the City Hall and Reaper Club closely (projection, line, gradients) and sit well beside the original hospital, store and church, but are plainer than the originals' painted detail and smaller on the map (B, not A). The scenes are flat and tidy beside the Di-Mart and bank redraws. The portraits are C like the rest.

Totals: 1 A, 80 B, 15 C.

## Compared and corrected

Every piece was rendered and looked at against the originals (the comparison sheets, plus composites of each backdrop with original portraits in front, and the new places with the new portraits in front). What changed after looking:

- **Parlor street:** the fog veils washed out the road (they covered the ground too); the ground now has its own fog and the veils skip it. A gradient bug (`gradientUnits` written as `gradient-units`) was found here and fixed in the library.
- **Tree arch (background_1):** the first trunks read as curtains; redrawn as tapered, forking, rooted trees with forest behind.
- **Church rafters (background_3):** purlins rendered as black wires converging off-screen; redrawn as beams in the roof plane, rafters thickened, rubble given lit faces, roof holes moved behind the trusses.
- **Pink parlor (background_5):** lamp and fern were cut by the frame; moved in, settee added.
- **Night graveyard (background_7):** the yew read as a hooded ghost; reshaped as a cypress.
- **Fire:** the side wall was a detached black panel; clapboarded and given a burning window; firefighters spread apart.
- **Bank:** a rail crossed the teller's mouth and read as a moustache; rails moved and a torso and bent arms added.
- **Reaper Club:** dancers were too small to read; scaled up, two foreground mourners added.
- **Sick room:** the leg in traction was a plank on an empty bed; a bandaged patient and a proper cast added.
- **Mansion (parlor-5):** the right wing painted over the taller centre block; drawing order fixed.
- **Portraits:** the first head was boxy with slit eyes, stain-like cheek patches, black nostrils and a giraffe neck; the head outline, eyes, cheek planes, neck and shoulders were reworked. A long thin goatee on the watchmaker drifted toward a stereotype and was replaced by a trimmed full beard.
- **Foliage (background_4):** the lower left was darkened after checking the Class and Mood overlay in the game.

Checked in the browser (dev server, `?expanded` and `?mock`): Remastered is offered in Settings, the redraws and new pictures sit correctly in the picture frame at 1024x745 and on the phone layout at 390x844, Class and Mood stay readable over the customer backdrops, the map shows the new City Hall and Reaper Club, the desk the new parlor capsule, the office ladder the five parlor stages, the ledger and town strip the new icons, a Classic town keeps its original chrome and portraits with Remastered selected, and switching back to Classic restores every original picture.

## What an illustrator should do first

1. **The portraits (all C).** They are built from one parametric head, so they share a face shape and lack the original's hand-drawn variety and crisp cel planes. Redraw the cast (Mayor Grubb, Lucius Vane, Inspector Mudge, Prudence Ledbetter, Nurse Gertie) and the four new customers by hand, using these as character sheets for costume and props.
2. **The small figures inside scenes:** Prudence at the bank and the firefighters. Hands and faces at that size are the weakest drawing in the scene set.
3. **background_5 (pink parlor), the prep-viewing casket and the sick room:** the most diagrammatic of the scenes; they need more incident and softer forms.
4. **The parlor stages** are consistent but plain beside the original shack's character; a pass adding wear, signage and planting would lift them to A.
5. The icons and the remaining scenes are serviceable; a polish pass, not a redraw.

## Content and engine changes needed (not made here)

These belong to the content and engine owners (`packages/content`, `packages/core`); the art is ready for them.

**`packages/content/packs/expanded/expanded/town/pictures.yaml`:**

| Key | Now | Proposed |
| --- | --- | --- |
| `graveyard` | fg `places/funeral-ceremony`, bg `background/background_celemony` | bg `places/graveyard` |
| `duel` | bg `background/background_celemony` | bg `places/graveyard-duel` |
| `cityHall` | fg `people/m_adult_3`, bg `background/background_3` | fg `people/mayor-grubb`, bg `places/mayor-office` |
| `bingo` | fg `stuff/lotteryticket`, bg `background/background_church` | bg `places/bingo-night` |
| `hospital` | bg `places/hospital_desk` | bg `places/sick-room` (or keep the desk for the front desk, see below) |
| `club` | fg `people/f_sexy`, bg `bar` | fg `people/lucius-vane`, bg `places/reaper-club` |
| `bank` | bg `places/bank` | unchanged (the redraw already shows the teller) |

**New picture keys** (`TownPictures` in `packages/core/src/expanded/content/townTypes.ts` and the modules that use them): `cityHallOutside` (`places/city-hall`), `inspection` (fg `people/inspector-mudge`), `clubDoor` (`places/reaper-club-door`, before the cover is paid), `clubTables` (`places/reaper-tables`), `blackMarket` (`places/black-market`), `vault` (fg `people/teller-prudence`, bg `places/bank-vault`, for Savings and Loans), `hospitalDesk` (fg `people/nurse-gertie`), and Morty's arc scenes (fg `people/morty`).

**`packages/core/src/expanded/parlor.ts`:** `parlorPicture(level)` should return `places/parlor-${level + 1}` (five stages) instead of `funeral_home(sucky)` / `(black)`; the original shack also carries a vulgar graffito that the new Shack does not. `office.ts` could use `places/parlor-office` as the bg of the contractor and markup screens.

**Body preparation (`prep.yaml` and `modules/prep.ts`):** scenes with no picture fall back to `places/embalming-room` for both layers. Suggested: `places/prep-table` for wallet, love-letter, wrong-body, spare-parts, tape, fingerprints, phone, pizza; `places/prep-cosmetics` for grin, glasses, toupee, tattoo, dentures, bingo-suit, biscuit, butterscotch; `places/prep-viewing` for borrowed-flowers, flag, fishing-pose, eulogy, final-breath, crayon, yearbook.

**New customers:** add `f_old_3`, `f_adult_3` (women) and `m_adult_5`, `m_old_7` (men) to the Expanded customer portrait choice (the Classic `choosePortrait` in `customerText.ts` must stay as it is, to keep the original draw order).

**Monuments:** `icons/monument-1` to `-5` exist in the pack, but the client has no slot for them yet; the Monuments catalogue could show them on its cards.

## Unfinished

- The portraits are attempts, graded C, as said above.
- The karma balance icon was checked as a render and in the unit tests, not on a live body-preparation screen.
- There is no art for a graveyard building on the map (the README suggests `ui/building-graveyard.svg`); the base map's own crosses serve.

**Picture fields for the batch A and B places** (`packages/core/src/expanded/content/townPlacesA.ts` and `townPlacesB.ts`; not changed by the art work):

| Field | Now | Proposed |
| --- | --- | --- |
| `pictures.police` | bg `places/funeral_enemy_police` | keep the bg; add fg `people/sergeant-bixby` |
| `pictures.crematorium` | bg `places/creamation_oven` | unchanged (the original ovens fit) |
| `pictures.florist` | fg `stuff/red_rose`, bg `places/store` | fg `people/marigold-thorne`, bg `places/florist` |
| `pictures.gazette` | fg `people/man_prowl`, bg `places/desk` | fg `people/hal-pennywhistle`, bg `places/gazette` |
| `pictures.coroner` | fg `people/m_old_7`, bg `places/prep-table` | fg `people/dr-grimble`, bg `places/coroner` |
| `pictures.health` | fg `people/inspector-mudge`, bg `places/city-hall` | keep the fg, bg `places/health-department` |
| `pictures.pawn` | fg `people/morty`, bg `places/black-market` | fg `people/cousin-sal`, bg `places/pawn-shop` |
| `pictures.mournes` | fg `people/m_adult_5`, bg `places/parlor-3` | fg `people/augustus-mourne`, bg `places/mournes` |
