# Studio audio ledger

What every file in this directory is, and what is not settled about it.

- **Origin.** Each file was generated with ElevenLabs (models `eleven_music_v2_5` for music
  and stingers, `eleven_text_to_sound_v2` for ambience and effects) under the project owner's
  ElevenLabs account, from the text prompt recorded for it in `sources.json` (with the model,
  its parameters, the generation id, the date and the credits charged), and then
  post-processed by `packages/audio` (`pnpm --filter @fq/audio run studio`): loops cut on bar
  lines and crossfaded, one-shots trimmed, mastered to the Synth pack's loudness targets,
  encoded to Ogg Opus and AAC. No recording, sample or music from the original 2001 game, and
  no third-party audio, was given to the generator: the prompts are text written for this
  project.
- **Licence: not established here.** These files are not covered by the project's licence
  the way the Synth pack is. Their redistribution terms are those of ElevenLabs' terms of
  service for the plan the owner's account is on at the time of generation. The owner must
  confirm those terms allow shipping them (in the web build, the desktop and mobile apps, and
  any store build) before the Studio pack is made the default or shipped in a store build.
  Until then the game's default stays the Synth pack.
- **The Synth pack** (`assets/audio/`) remains fully generated from this repository's own code
  and carries the project's licence; any id this pack lacks plays from it.
- **Cost.** 19801 credits in all (the ledger is in `sources.json`).

| File | Kind | Id | Model | Generation id | Generated on |
|---|---|---|---|---|---|
| sfx/alarm-bell.ogg | sfx | `alarm-bell` | eleven_text_to_sound_v2 | aReuhLXMGJqRQTg5JElY | 2026-11-06 |
| sfx/alarm-bell.m4a | sfx | `alarm-bell` | eleven_text_to_sound_v2 | aReuhLXMGJqRQTg5JElY | 2026-11-06 |
| ambience/amb-birds.ogg | ambience | `amb-birds` | eleven_text_to_sound_v2 | 3vcol9CePxshRd3iaFud | 2026-11-06 |
| ambience/amb-birds.m4a | ambience | `amb-birds` | eleven_text_to_sound_v2 | 3vcol9CePxshRd3iaFud | 2026-11-06 |
| ambience/amb-bubbles.ogg | ambience | `amb-bubbles` | eleven_text_to_sound_v2 | bSlUvuMfE2IqbcGhjq3u | 2026-11-06 |
| ambience/amb-bubbles.m4a | ambience | `amb-bubbles` | eleven_text_to_sound_v2 | bSlUvuMfE2IqbcGhjq3u | 2026-11-06 |
| ambience/amb-clock.ogg | ambience | `amb-clock` | eleven_text_to_sound_v2 | a4gHT9aZxEw3kVo77rp5 | 2026-11-06 |
| ambience/amb-clock.m4a | ambience | `amb-clock` | eleven_text_to_sound_v2 | a4gHT9aZxEw3kVo77rp5 | 2026-11-06 |
| ambience/amb-fire.ogg | ambience | `amb-fire` | eleven_text_to_sound_v2 | Xs6UyIzWxKQFa5iTlEO2 | 2026-11-06 |
| ambience/amb-fire.m4a | ambience | `amb-fire` | eleven_text_to_sound_v2 | Xs6UyIzWxKQFa5iTlEO2 | 2026-11-06 |
| ambience/amb-fogbell.ogg | ambience | `amb-fogbell` | eleven_text_to_sound_v2 | bNkb7xDew50lUdf6DSf4 | 2026-11-06 |
| ambience/amb-fogbell.m4a | ambience | `amb-fogbell` | eleven_text_to_sound_v2 | bNkb7xDew50lUdf6DSf4 | 2026-11-06 |
| ambience/amb-hospital.ogg | ambience | `amb-hospital` | eleven_text_to_sound_v2 | WOU1C2up1lBMizs5Ty03 | 2026-11-06 |
| ambience/amb-hospital.m4a | ambience | `amb-hospital` | eleven_text_to_sound_v2 | WOU1C2up1lBMizs5Ty03 | 2026-11-06 |
| ambience/amb-kitchen.ogg | ambience | `amb-kitchen` | eleven_text_to_sound_v2 | N8y0EOKMLffq7GNuhP6I | 2026-11-06 |
| ambience/amb-kitchen.m4a | ambience | `amb-kitchen` | eleven_text_to_sound_v2 | N8y0EOKMLffq7GNuhP6I | 2026-11-06 |
| ambience/amb-monitor.ogg | ambience | `amb-monitor` | eleven_text_to_sound_v2 | h4bUkxDharJlGKP0aSaP | 2026-11-06 |
| ambience/amb-monitor.m4a | ambience | `amb-monitor` | eleven_text_to_sound_v2 | h4bUkxDharJlGKP0aSaP | 2026-11-06 |
| ambience/amb-night.ogg | ambience | `amb-night` | eleven_text_to_sound_v2 | ZLxDaEfnK59fsiL1SlAE | 2026-11-06 |
| ambience/amb-night.m4a | ambience | `amb-night` | eleven_text_to_sound_v2 | ZLxDaEfnK59fsiL1SlAE | 2026-11-06 |
| ambience/amb-rain.ogg | ambience | `amb-rain` | eleven_text_to_sound_v2 | X0PIKBDbZHIMgkB3moB4 | 2026-11-06 |
| ambience/amb-rain.m4a | ambience | `amb-rain` | eleven_text_to_sound_v2 | X0PIKBDbZHIMgkB3moB4 | 2026-11-06 |
| ambience/amb-storm.ogg | ambience | `amb-storm` | eleven_text_to_sound_v2 | d7L5GdsrLdTsBYraakSP | 2026-11-06 |
| ambience/amb-storm.m4a | ambience | `amb-storm` | eleven_text_to_sound_v2 | d7L5GdsrLdTsBYraakSP | 2026-11-06 |
| ambience/amb-street.ogg | ambience | `amb-street` | eleven_text_to_sound_v2 | Y9r5yCGhtGa8sLbg6Mai | 2026-11-06 |
| ambience/amb-street.m4a | ambience | `amb-street` | eleven_text_to_sound_v2 | Y9r5yCGhtGa8sLbg6Mai | 2026-11-06 |
| ambience/amb-wind.ogg | ambience | `amb-wind` | eleven_text_to_sound_v2 | s0VGYVC7PvY6W5UqvJLR | 2026-11-06 |
| ambience/amb-wind.m4a | ambience | `amb-wind` | eleven_text_to_sound_v2 | s0VGYVC7PvY6W5UqvJLR | 2026-11-06 |
| sfx/angelic.ogg | sfx | `angelic` | eleven_text_to_sound_v2 | Xh06ZFhf7GbGgmn411eL | 2026-11-06 |
| sfx/angelic.m4a | sfx | `angelic` | eleven_text_to_sound_v2 | Xh06ZFhf7GbGgmn411eL | 2026-11-06 |
| music/bank.ogg | music | `bank` | eleven_music_v2_5 | YLhzNE9w9WCcjvubrs9K | 2026-11-06 |
| music/bank.m4a | music | `bank` | eleven_music_v2_5 | YLhzNE9w9WCcjvubrs9K | 2026-11-06 |
| music/battle.ogg | music | `battle` | eleven_music_v2_5 | JabjmntYELUqDmO1bfoD | 2026-11-06 |
| music/battle.m4a | music | `battle` | eleven_music_v2_5 | JabjmntYELUqDmO1bfoD | 2026-11-06 |
| sfx/bingo-ball.ogg | sfx | `bingo-ball` | eleven_text_to_sound_v2 | 6Jc1JBs7Y2rEAhrW0cFQ | 2026-11-06 |
| sfx/bingo-ball.m4a | sfx | `bingo-ball` | eleven_text_to_sound_v2 | 6Jc1JBs7Y2rEAhrW0cFQ | 2026-11-06 |
| sfx/bingo-lose.ogg | sfx | `bingo-lose` | eleven_text_to_sound_v2 | cUycU8D88mldnkB4OHEP | 2026-11-06 |
| sfx/bingo-lose.m4a | sfx | `bingo-lose` | eleven_text_to_sound_v2 | cUycU8D88mldnkB4OHEP | 2026-11-06 |
| sfx/bingo-win.ogg | sfx | `bingo-win` | eleven_text_to_sound_v2 | P6baMw0yP8GZ7VLLkvLX | 2026-11-06 |
| sfx/bingo-win.m4a | sfx | `bingo-win` | eleven_text_to_sound_v2 | P6baMw0yP8GZ7VLLkvLX | 2026-11-06 |
| music/cafe.ogg | music | `cafe` | eleven_music_v2_5 | IjnYAIoJxnbWQ1VeJDBj | 2026-11-06 |
| music/cafe.m4a | music | `cafe` | eleven_music_v2_5 | IjnYAIoJxnbWQ1VeJDBj | 2026-11-06 |
| sfx/cards.ogg | sfx | `cards` | eleven_text_to_sound_v2 | ttX9u3sdurkTw4GafMDI | 2026-11-06 |
| sfx/cards.m4a | sfx | `cards` | eleven_text_to_sound_v2 | ttX9u3sdurkTw4GafMDI | 2026-11-06 |
| sfx/cash-register.ogg | sfx | `cash-register` | eleven_text_to_sound_v2 | zwIMf0HPJlebm9hQJhB7 | 2026-11-06 |
| sfx/cash-register.m4a | sfx | `cash-register` | eleven_text_to_sound_v2 | zwIMf0HPJlebm9hQJhB7 | 2026-11-06 |
| sfx/casket-thump.ogg | sfx | `casket-thump` | eleven_text_to_sound_v2 | hfOl0GkVqUT29kOuVllq | 2026-11-06 |
| sfx/casket-thump.m4a | sfx | `casket-thump` | eleven_text_to_sound_v2 | hfOl0GkVqUT29kOuVllq | 2026-11-06 |
| music/ceremony.ogg | music | `ceremony` | eleven_music_v2_5 | eL3XgiYoUqxhklMwQPct | 2026-11-06 |
| music/ceremony.m4a | music | `ceremony` | eleven_music_v2_5 | eL3XgiYoUqxhklMwQPct | 2026-11-06 |
| music/cityhall.ogg | music | `cityhall` | eleven_music_v2_5 | jazP4i7iv4ptQJ3oGb0N | 2026-11-06 |
| music/cityhall.m4a | music | `cityhall` | eleven_music_v2_5 | jazP4i7iv4ptQJ3oGb0N | 2026-11-06 |
| music/club.ogg | music | `club` | eleven_music_v2_5 | EZfSfvSCdMDELN3ovspu | 2026-11-06 |
| music/club.m4a | music | `club` | eleven_music_v2_5 | EZfSfvSCdMDELN3ovspu | 2026-11-06 |
| sfx/coins.ogg | sfx | `coins` | eleven_text_to_sound_v2 | g4rZLdj6wjloUi16MyYR | 2026-11-06 |
| sfx/coins.m4a | sfx | `coins` | eleven_text_to_sound_v2 | g4rZLdj6wjloUi16MyYR | 2026-11-06 |
| music/defeat.ogg | stinger | `defeat` | eleven_music_v2_5 | nI2f3iPEjwMZruPeq76d | 2026-11-06 |
| music/defeat.m4a | stinger | `defeat` | eleven_music_v2_5 | nI2f3iPEjwMZruPeq76d | 2026-11-06 |
| music/desk.ogg | music | `desk` | eleven_music_v2_5 | 6JovC0mNBViY4IN2tW4Q | 2026-11-06 |
| music/desk.m4a | music | `desk` | eleven_music_v2_5 | 6JovC0mNBViY4IN2tW4Q | 2026-11-06 |
| sfx/dice.ogg | sfx | `dice` | eleven_text_to_sound_v2 | GVtMCAGlqWieGPCnvlh7 | 2026-11-06 |
| sfx/dice.m4a | sfx | `dice` | eleven_text_to_sound_v2 | GVtMCAGlqWieGPCnvlh7 | 2026-11-06 |
| music/dimart.ogg | music | `dimart` | eleven_music_v2_5 | m3FzdwtV5NEN7WGbH8Z5 | 2026-11-06 |
| music/dimart.m4a | music | `dimart` | eleven_music_v2_5 | m3FzdwtV5NEN7WGbH8Z5 | 2026-11-06 |
| sfx/door.ogg | sfx | `door` | eleven_text_to_sound_v2 | by8FHBF2PK912vMvwcQb | 2026-11-06 |
| sfx/door.m4a | sfx | `door` | eleven_text_to_sound_v2 | by8FHBF2PK912vMvwcQb | 2026-11-06 |
| sfx/doorbell.ogg | sfx | `doorbell` | eleven_text_to_sound_v2 | RFtjqRePbLhJt7kQjSNX | 2026-11-06 |
| sfx/doorbell.m4a | sfx | `doorbell` | eleven_text_to_sound_v2 | RFtjqRePbLhJt7kQjSNX | 2026-11-06 |
| music/endday.ogg | stinger | `endday` | eleven_music_v2_5 | gnWJyGVyzsbQPaz06GoB | 2026-11-06 |
| music/endday.m4a | stinger | `endday` | eleven_music_v2_5 | gnWJyGVyzsbQPaz06GoB | 2026-11-06 |
| sfx/fail-trombone.ogg | sfx | `fail-trombone` | eleven_text_to_sound_v2 | h080h0FLutFGsRWmgyY4 | 2026-11-06 |
| sfx/fail-trombone.m4a | sfx | `fail-trombone` | eleven_text_to_sound_v2 | h080h0FLutFGsRWmgyY4 | 2026-11-06 |
| sfx/fanfare-exact.ogg | sfx | `fanfare-exact` | eleven_text_to_sound_v2 | 8RNLkNlfBVIeBNHvbp9w | 2026-11-06 |
| sfx/fanfare-exact.m4a | sfx | `fanfare-exact` | eleven_text_to_sound_v2 | 8RNLkNlfBVIeBNHvbp9w | 2026-11-06 |
| sfx/glint.ogg | sfx | `glint` | eleven_text_to_sound_v2 | S02ssi4WvOHYKABM9ZO8 | 2026-11-06 |
| sfx/glint.m4a | sfx | `glint` | eleven_text_to_sound_v2 | S02ssi4WvOHYKABM9ZO8 | 2026-11-06 |
| sfx/gong.ogg | sfx | `gong` | eleven_text_to_sound_v2 | BgyiBklwJNZ9hA61R9LB | 2026-11-06 |
| sfx/gong.m4a | sfx | `gong` | eleven_text_to_sound_v2 | BgyiBklwJNZ9hA61R9LB | 2026-11-06 |
| music/graveyard.ogg | music | `graveyard` | eleven_music_v2_5 | Q0dBe6u4bBSLLvPr1nsm | 2026-11-06 |
| music/graveyard.m4a | music | `graveyard` | eleven_music_v2_5 | Q0dBe6u4bBSLLvPr1nsm | 2026-11-06 |
| sfx/growl.ogg | sfx | `growl` | eleven_text_to_sound_v2 | JIZtiGnyWhMzialQDZce | 2026-11-06 |
| sfx/growl.m4a | sfx | `growl` | eleven_text_to_sound_v2 | JIZtiGnyWhMzialQDZce | 2026-11-06 |
| sfx/harp-good-news.ogg | sfx | `harp-good-news` | eleven_text_to_sound_v2 | f4B2aEvildxX8HkgL4rU | 2026-11-06 |
| sfx/harp-good-news.m4a | sfx | `harp-good-news` | eleven_text_to_sound_v2 | f4B2aEvildxX8HkgL4rU | 2026-11-06 |
| music/hospital.ogg | music | `hospital` | eleven_music_v2_5 | iIK0oU8LJSiBS75sUdjo | 2026-11-06 |
| music/hospital.m4a | music | `hospital` | eleven_music_v2_5 | iIK0oU8LJSiBS75sUdjo | 2026-11-06 |
| sfx/level-up.ogg | sfx | `level-up` | eleven_text_to_sound_v2 | rzm6WJwikdMW60Bda9Zm | 2026-11-06 |
| sfx/level-up.m4a | sfx | `level-up` | eleven_text_to_sound_v2 | rzm6WJwikdMW60Bda9Zm | 2026-11-06 |
| sfx/lockpick.ogg | sfx | `lockpick` | eleven_text_to_sound_v2 | CeLcY8NMvxV7WccJtoeO | 2026-11-06 |
| sfx/lockpick.m4a | sfx | `lockpick` | eleven_text_to_sound_v2 | CeLcY8NMvxV7WccJtoeO | 2026-11-06 |
| music/main.ogg | music | `main` | eleven_music_v2_5 | 32rDpvMqDOGkzRoQpGTj | 2026-11-06 |
| music/main.m4a | music | `main` | eleven_music_v2_5 | 32rDpvMqDOGkzRoQpGTj | 2026-11-06 |
| music/main-stinger.ogg | stinger | `main-stinger` | eleven_music_v2_5 | IKKEWBtQdkzjzM8gFdV6 | 2026-11-06 |
| music/main-stinger.m4a | stinger | `main-stinger` | eleven_music_v2_5 | IKKEWBtQdkzjzM8gFdV6 | 2026-11-06 |
| music/meteor.ogg | music | `meteor` | eleven_music_v2_5 | dkiWz5Rl66Af4TQ63lnl | 2026-11-06 |
| music/meteor.m4a | music | `meteor` | eleven_music_v2_5 | dkiWz5Rl66Af4TQ63lnl | 2026-11-06 |
| sfx/monument.ogg | sfx | `monument` | eleven_text_to_sound_v2 | 6lrQuHvMMKbbHTMCYGEt | 2026-11-06 |
| sfx/monument.m4a | sfx | `monument` | eleven_text_to_sound_v2 | 6lrQuHvMMKbbHTMCYGEt | 2026-11-06 |
| music/negotiation.layer0.ogg | music | `negotiation` | eleven_music_v2_5 | 6AaZ9NjydaXTJIIOsECN | 2026-11-06 |
| music/negotiation.layer0.m4a | music | `negotiation` | eleven_music_v2_5 | 6AaZ9NjydaXTJIIOsECN | 2026-11-06 |
| music/negotiation.layer1.ogg | music | `negotiation` | eleven_music_v2_5 | 1BQPS87Ca7lzPedKU622 | 2026-11-06 |
| music/negotiation.layer1.m4a | music | `negotiation` | eleven_music_v2_5 | 1BQPS87Ca7lzPedKU622 | 2026-11-06 |
| music/negotiation.layer2.ogg | music | `negotiation` | eleven_music_v2_5 | Esptqvzbgxt6bOlWOBDO | 2026-11-06 |
| music/negotiation.layer2.m4a | music | `negotiation` | eleven_music_v2_5 | Esptqvzbgxt6bOlWOBDO | 2026-11-06 |
| music/newday.ogg | stinger | `newday` | eleven_music_v2_5 | NwBj8GDINlNUJ9DiUGdI | 2026-11-06 |
| music/newday.m4a | stinger | `newday` | eleven_music_v2_5 | NwBj8GDINlNUJ9DiUGdI | 2026-11-06 |
| sfx/padlock-break.ogg | sfx | `padlock-break` | eleven_text_to_sound_v2 | QTiQ69wcOk4SlTV3Ycfu | 2026-11-06 |
| sfx/padlock-break.m4a | sfx | `padlock-break` | eleven_text_to_sound_v2 | QTiQ69wcOk4SlTV3Ycfu | 2026-11-06 |
| sfx/psychic.ogg | sfx | `psychic` | eleven_text_to_sound_v2 | R4dAkye0cdvLiavIG7M0 | 2026-11-06 |
| sfx/psychic.m4a | sfx | `psychic` | eleven_text_to_sound_v2 | R4dAkye0cdvLiavIG7M0 | 2026-11-06 |
| sfx/punch.ogg | sfx | `punch` | eleven_text_to_sound_v2 | 9hb9AdLymVrCpQcLfHot | 2026-11-06 |
| sfx/punch.m4a | sfx | `punch` | eleven_text_to_sound_v2 | 9hb9AdLymVrCpQcLfHot | 2026-11-06 |
| sfx/rain-hit.ogg | sfx | `rain-hit` | eleven_text_to_sound_v2 | KUx5a14s18IcUoUJX27H | 2026-11-06 |
| sfx/rain-hit.m4a | sfx | `rain-hit` | eleven_text_to_sound_v2 | KUx5a14s18IcUoUJX27H | 2026-11-06 |
| sfx/rattle.ogg | sfx | `rattle` | eleven_text_to_sound_v2 | SB9AJWuECTnObgQ4EhXc | 2026-11-06 |
| sfx/rattle.m4a | sfx | `rattle` | eleven_text_to_sound_v2 | SB9AJWuECTnObgQ4EhXc | 2026-11-06 |
| sfx/safe-click.ogg | sfx | `safe-click` | eleven_text_to_sound_v2 | YGjRPazW5q34eGBsSKRR | 2026-11-06 |
| sfx/safe-click.m4a | sfx | `safe-click` | eleven_text_to_sound_v2 | YGjRPazW5q34eGBsSKRR | 2026-11-06 |
| sfx/siren.ogg | sfx | `siren` | eleven_text_to_sound_v2 | HMsdsMr4fWjlG9OLgCGK | 2026-11-06 |
| sfx/siren.m4a | sfx | `siren` | eleven_text_to_sound_v2 | HMsdsMr4fWjlG9OLgCGK | 2026-11-06 |
| sfx/slap.ogg | sfx | `slap` | eleven_text_to_sound_v2 | 8lytatqctqGYno83Hmaf | 2026-11-06 |
| sfx/slap.m4a | sfx | `slap` | eleven_text_to_sound_v2 | 8lytatqctqGYno83Hmaf | 2026-11-06 |
| sfx/slot-machine.ogg | sfx | `slot-machine` | eleven_text_to_sound_v2 | 0dtoC7Jej0tHd7rIBKTi | 2026-11-06 |
| sfx/slot-machine.m4a | sfx | `slot-machine` | eleven_text_to_sound_v2 | 0dtoC7Jej0tHd7rIBKTi | 2026-11-06 |
| music/sneak.ogg | music | `sneak` | eleven_music_v2_5 | TNyD9Cm62EGuDFh1Nh5l | 2026-11-06 |
| music/sneak.m4a | music | `sneak` | eleven_music_v2_5 | TNyD9Cm62EGuDFh1Nh5l | 2026-11-06 |
| sfx/thunder.ogg | sfx | `thunder` | eleven_text_to_sound_v2 | PDSwhou9cl7JYmb5ySpS | 2026-11-06 |
| sfx/thunder.m4a | sfx | `thunder` | eleven_text_to_sound_v2 | PDSwhou9cl7JYmb5ySpS | 2026-11-06 |
| sfx/toilet-flush.ogg | sfx | `toilet-flush` | eleven_text_to_sound_v2 | VIPL9rbcV5VlmAu2xuYj | 2026-11-06 |
| sfx/toilet-flush.m4a | sfx | `toilet-flush` | eleven_text_to_sound_v2 | VIPL9rbcV5VlmAu2xuYj | 2026-11-06 |
| music/town.ogg | music | `town` | eleven_music_v2_5 | vW5TUOsqoisIO8TGwWM6 | 2026-11-06 |
| music/town.m4a | music | `town` | eleven_music_v2_5 | vW5TUOsqoisIO8TGwWM6 | 2026-11-06 |
| music/university.ogg | music | `university` | eleven_music_v2_5 | xCzYagXdhANtdWCrIi1g | 2026-11-06 |
| music/university.m4a | music | `university` | eleven_music_v2_5 | xCzYagXdhANtdWCrIi1g | 2026-11-06 |
| music/victory.ogg | stinger | `victory` | eleven_music_v2_5 | VxHD5ou93NUIaAgIpMNJ | 2026-11-06 |
| music/victory.m4a | stinger | `victory` | eleven_music_v2_5 | VxHD5ou93NUIaAgIpMNJ | 2026-11-06 |
| sfx/walkout.ogg | sfx | `walkout` | eleven_text_to_sound_v2 | fZRcbntjLAnADF8VS5RI | 2026-11-06 |
| sfx/walkout.m4a | sfx | `walkout` | eleven_text_to_sound_v2 | fZRcbntjLAnADF8VS5RI | 2026-11-06 |
| music/yangs.ogg | music | `yangs` | eleven_music_v2_5 | qLJU5xG3d0XwTljiuuJ8 | 2026-11-06 |
| music/yangs.m4a | music | `yangs` | eleven_music_v2_5 | qLJU5xG3d0XwTljiuuJ8 | 2026-11-06 |

Every rendered Synth id has a Studio file.
UI sounds synthesised in the browser (no file, both packs): `ui-click`, `ui-hover`, `ui-page`, `ui-notepad`, `ui-chat`, `ui-coin`, `ui-tag`, `ui-stamp`, `ui-mail`.
