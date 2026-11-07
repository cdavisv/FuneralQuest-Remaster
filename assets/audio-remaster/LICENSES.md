# "Original, remastered" audio ledger

What every file in this directory is, and what is not settled about it.

- **What they are.** New audio made to resemble the original 2001 game's sounds, one remake per original sound. They are not the 2001 recordings. Each file was generated with ElevenLabs (`eleven_music_v2_5` for music, `eleven_text_to_sound_v2` for ambience and effects) under the project owner's ElevenLabs account, from the text prompt recorded for it in `sources.json` (with the model, its parameters, the generation id, the date and the credits charged), and then post-processed by `packages/audio` (`pnpm --filter @fq/audio run remaster`): loops cut to the original's length (three music loops also transposed to the original's key, where the model ignored the key asked for), one-shots trimmed, mastered and encoded as the other packs are.
- **No original audio was used.** The 2001 sounds were analysed only on the owner's machine (`packages/audio/scripts/remasterDescribe.py`; numbers and words in `brief.json`). No original audio, and nothing derived from its samples other than those numbers and words, was uploaded to any service or given to a generator as input. The prompts describe the kind of sound, instruments, tempo, key, mood and length, never the original's notes.
- **Licence: not established here.** These files are not covered by the project's licence. Their redistribution terms are those of ElevenLabs' terms of service for the plan the owner's account is on at the time of generation, for the owner to confirm before the pack is made the default or shipped in any build. The Synth pack remains fully generated from this repository's own code.
- **Cost.** 3692 credits in all, against a cap of 20,000:

| Batch | What | Estimated | Charged |
|---|---|---|---|
| rpilot | fight loop, fire loop, dog growl, gong (sfx model) x2 | 274.78 | 84 |
| rpilot-music | fight loop via music model 16 s x1 | 440 | 240 |
| rmusic | intro, map, sneak, palors, yangs, ceremony (music model) x1 | 2805 | 1530 |
| ramb | 6 ambience loops + gong retake x2 | 448.14 | 134 |
| rfx1 | 9 effects x2 | 347.38 | 104 |
| rfx2 | 10 effects x2 | 403.48 | 124 |
| rretake | retakes: palors, yangs, map (music) and bell 3, bell 5, night, wind x2 | 2765.62 | 1476 |

| File | Remake | Original sound(s) it resembles | Model | Generation id | Generated on |
|---|---|---|---|---|---|
| sfx/animals-dog-dragging-hand.ogg | `animals-dog-dragging-hand` | animals/dog-dragging-hand/2.mp3 | eleven_text_to_sound_v2 | Vv827PiJbK6OfnIX7nX8 | 2026-11-07 |
| sfx/animals-dog-dragging-hand.m4a | `animals-dog-dragging-hand` | animals/dog-dragging-hand/2.mp3 | eleven_text_to_sound_v2 | Vv827PiJbK6OfnIX7nX8 | 2026-11-07 |
| sfx/background-background_1.ogg | `background-background_1` | background/background_1/2.mp3 | eleven_text_to_sound_v2 | lKPVsxnsGgDkq7SXNlX5 | 2026-11-07 |
| sfx/background-background_1.m4a | `background-background_1` | background/background_1/2.mp3 | eleven_text_to_sound_v2 | lKPVsxnsGgDkq7SXNlX5 | 2026-11-07 |
| sfx/background-background_2.ogg | `background-background_2` | background/background_2/2.mp3 | eleven_text_to_sound_v2 | Xyb8VDbnEvgRDK4djMRO | 2026-11-07 |
| sfx/background-background_2.m4a | `background-background_2` | background/background_2/2.mp3 | eleven_text_to_sound_v2 | Xyb8VDbnEvgRDK4djMRO | 2026-11-07 |
| sfx/background-background_3.ogg | `background-background_3` | background/background_3/2.mp3 | eleven_text_to_sound_v2 | cTmXZryIrTPO5icFIcoW | 2026-11-07 |
| sfx/background-background_3.m4a | `background-background_3` | background/background_3/2.mp3 | eleven_text_to_sound_v2 | cTmXZryIrTPO5icFIcoW | 2026-11-07 |
| sfx/background-background_4.ogg | `background-background_4` | background/background_4/2.mp3 | eleven_text_to_sound_v2 | acXeSQR4Ya6kzK3mmAAq | 2026-11-07 |
| sfx/background-background_4.m4a | `background-background_4` | background/background_4/2.mp3 | eleven_text_to_sound_v2 | acXeSQR4Ya6kzK3mmAAq | 2026-11-07 |
| sfx/background-background_5.ogg | `background-background_5` | background/background_5/2.mp3 | eleven_text_to_sound_v2 | eb6vR9qCmGpxPwgb2wnv | 2026-11-07 |
| sfx/background-background_5.m4a | `background-background_5` | background/background_5/2.mp3 | eleven_text_to_sound_v2 | eb6vR9qCmGpxPwgb2wnv | 2026-11-07 |
| ambience/closed.ogg | `closed` | closed/5.mp3 | eleven_text_to_sound_v2 | sLygzooxlnRqsWJTmr8Z | 2026-11-07 |
| ambience/closed.m4a | `closed` | closed/5.mp3 | eleven_text_to_sound_v2 | sLygzooxlnRqsWJTmr8Z | 2026-11-07 |
| ambience/morning_coffee.ogg | `morning_coffee` | morning_coffee/5.mp3 | eleven_text_to_sound_v2 | VcQzcJiCBQA0Uo4cD6YD | 2026-11-07 |
| ambience/morning_coffee.m4a | `morning_coffee` | morning_coffee/5.mp3 | eleven_text_to_sound_v2 | VcQzcJiCBQA0Uo4cD6YD | 2026-11-07 |
| sfx/mother-happy.ogg | `mother-happy` | mother/happy/5.mp3 | eleven_text_to_sound_v2 | KQhIKCFszON6f6oD32xw | 2026-11-07 |
| sfx/mother-happy.m4a | `mother-happy` | mother/happy/5.mp3 | eleven_text_to_sound_v2 | KQhIKCFszON6f6oD32xw | 2026-11-07 |
| music/music-music_fight.ogg | `music-music_fight` | music/music_fight/1.mp3 | eleven_music_v2_5 | 6fcRBh6x0lC8HP2OFjZX | 2026-11-07 |
| music/music-music_fight.m4a | `music-music_fight` | music/music_fight/1.mp3 | eleven_music_v2_5 | 6fcRBh6x0lC8HP2OFjZX | 2026-11-07 |
| music/music-music_sneak.ogg | `music-music_sneak` | music/music_sneak/1.mp3 | eleven_music_v2_5 | NaVE5N4ugQ4G2DcjomFi | 2026-11-07 |
| music/music-music_sneak.m4a | `music-music_sneak` | music/music_sneak/1.mp3 | eleven_music_v2_5 | NaVE5N4ugQ4G2DcjomFi | 2026-11-07 |
| sfx/people-jesus_happy.ogg | `people-jesus_happy` | people/jesus_happy/13.mp3 | eleven_text_to_sound_v2 | Y0G9QLmZuvIgdFrZM4wz | 2026-11-07 |
| sfx/people-jesus_happy.m4a | `people-jesus_happy` | people/jesus_happy/13.mp3 | eleven_text_to_sound_v2 | Y0G9QLmZuvIgdFrZM4wz | 2026-11-07 |
| ambience/places-desk.ogg | `places-desk` | places/desk/12.mp3, places/desk_enemy/8.mp3 | eleven_text_to_sound_v2 | SNXOacZDziZQDRuG403l | 2026-11-07 |
| ambience/places-desk.m4a | `places-desk` | places/desk/12.mp3, places/desk_enemy/8.mp3 | eleven_text_to_sound_v2 | SNXOacZDziZQDRuG403l | 2026-11-07 |
| ambience/places-embalming-room.ogg | `places-embalming-room` | places/embalming-room/3.mp3 | eleven_text_to_sound_v2 | UoyoQnGHn0JJfTvQzDLh | 2026-11-07 |
| ambience/places-embalming-room.m4a | `places-embalming-room` | places/embalming-room/3.mp3 | eleven_text_to_sound_v2 | UoyoQnGHn0JJfTvQzDLh | 2026-11-07 |
| ambience/places-fire.ogg | `places-fire` | places/fire/5.mp3 | eleven_text_to_sound_v2 | rzVJnxn1gbhM4QgHhSPE | 2026-11-07 |
| ambience/places-fire.m4a | `places-fire` | places/fire/5.mp3 | eleven_text_to_sound_v2 | rzVJnxn1gbhM4QgHhSPE | 2026-11-07 |
| music/places-funeral-ceremony.ogg | `places-funeral-ceremony` | places/funeral-ceremony/2.mp3, places/funeral-ceremony2/6.mp3, background/background_church/2.mp3 | eleven_music_v2_5 | ZgvzhYGwoA16RZlVcr63 | 2026-11-07 |
| music/places-funeral-ceremony.m4a | `places-funeral-ceremony` | places/funeral-ceremony/2.mp3, places/funeral-ceremony2/6.mp3, background/background_church/2.mp3 | eleven_music_v2_5 | ZgvzhYGwoA16RZlVcr63 | 2026-11-07 |
| sfx/places-hospital_ambulance.ogg | `places-hospital_ambulance` | places/hospital_ambulance/2.mp3 | eleven_text_to_sound_v2 | qnk2eigJpelGs9tjfXrA | 2026-11-07 |
| sfx/places-hospital_ambulance.m4a | `places-hospital_ambulance` | places/hospital_ambulance/2.mp3 | eleven_text_to_sound_v2 | qnk2eigJpelGs9tjfXrA | 2026-11-07 |
| ambience/places-hospital_desk.ogg | `places-hospital_desk` | places/hospital_desk/5.mp3 | eleven_text_to_sound_v2 | 2VZkNge3ruk54xJXa4DT | 2026-11-07 |
| ambience/places-hospital_desk.m4a | `places-hospital_desk` | places/hospital_desk/5.mp3 | eleven_text_to_sound_v2 | 2VZkNge3ruk54xJXa4DT | 2026-11-07 |
| ambience/places-hospital_room.ogg | `places-hospital_room` | places/hospital_room/9.mp3 | eleven_text_to_sound_v2 | 2Kd2j9UUwAtHKB2DHpMB | 2026-11-07 |
| ambience/places-hospital_room.m4a | `places-hospital_room` | places/hospital_room/9.mp3 | eleven_text_to_sound_v2 | 2Kd2j9UUwAtHKB2DHpMB | 2026-11-07 |
| music/places-palors.ogg | `places-palors` | places/palors/5.mp3 | eleven_music_v2_5 | IGSVTuhWbJ5Hzz065Utf | 2026-11-07 |
| music/places-palors.m4a | `places-palors` | places/palors/5.mp3 | eleven_music_v2_5 | IGSVTuhWbJ5Hzz065Utf | 2026-11-07 |
| sfx/places-psych.ogg | `places-psych` | places/psych/7.mp3 | eleven_text_to_sound_v2 | UVdYJOww9PV4k0QgaCj3 | 2026-11-07 |
| sfx/places-psych.m4a | `places-psych` | places/psych/7.mp3 | eleven_text_to_sound_v2 | UVdYJOww9PV4k0QgaCj3 | 2026-11-07 |
| music/places-yangs.ogg | `places-yangs` | places/yangs/6.mp3 | eleven_music_v2_5 | ifiN33b2wy5QXMuiviKm | 2026-11-07 |
| music/places-yangs.m4a | `places-yangs` | places/yangs/6.mp3 | eleven_music_v2_5 | ifiN33b2wy5QXMuiviKm | 2026-11-07 |
| sfx/ring-ring.ogg | `ring-ring` | ring/ring/4.mp3, ring/ring&hand/5.mp3 | eleven_text_to_sound_v2 | 5xRaenpfXk392ANPzZmt | 2026-11-07 |
| sfx/ring-ring.m4a | `ring-ring` | ring/ring/4.mp3, ring/ring&hand/5.mp3 | eleven_text_to_sound_v2 | 5xRaenpfXk392ANPzZmt | 2026-11-07 |
| sfx/stuff-battle_lose.ogg | `stuff-battle_lose` | stuff/battle_lose/2.mp3 | eleven_text_to_sound_v2 | tdRPaWnzGj5Ed8EFuFLy | 2026-11-07 |
| sfx/stuff-battle_lose.m4a | `stuff-battle_lose` | stuff/battle_lose/2.mp3 | eleven_text_to_sound_v2 | tdRPaWnzGj5Ed8EFuFLy | 2026-11-07 |
| sfx/stuff-lottery_lose-26.ogg | `stuff-lottery_lose-26` | stuff/lottery_lose/26.mp3 | eleven_text_to_sound_v2 | x0FhzEUmN4RRFCjYdDDC | 2026-11-07 |
| sfx/stuff-lottery_lose-26.m4a | `stuff-lottery_lose-26` | stuff/lottery_lose/26.mp3 | eleven_text_to_sound_v2 | x0FhzEUmN4RRFCjYdDDC | 2026-11-07 |
| sfx/stuff-lottery_win-19.ogg | `stuff-lottery_win-19` | stuff/lottery_win/19.mp3, stuff/lottery_lose/19.mp3 | eleven_text_to_sound_v2 | 62DW1ZQZo7mzYgsCE392 | 2026-11-07 |
| sfx/stuff-lottery_win-19.m4a | `stuff-lottery_win-19` | stuff/lottery_win/19.mp3, stuff/lottery_lose/19.mp3 | eleven_text_to_sound_v2 | 62DW1ZQZo7mzYgsCE392 | 2026-11-07 |
| sfx/stuff-lottery_win-25.ogg | `stuff-lottery_win-25` | stuff/lottery_win/25.mp3 | eleven_text_to_sound_v2 | QYRClx1yyoslnHcpmp05 | 2026-11-07 |
| sfx/stuff-lottery_win-25.m4a | `stuff-lottery_win-25` | stuff/lottery_win/25.mp3 | eleven_text_to_sound_v2 | QYRClx1yyoslnHcpmp05 | 2026-11-07 |
| sfx/stuff-money_bag.ogg | `stuff-money_bag` | stuff/money_bag/7.mp3 | eleven_text_to_sound_v2 | rd2LJPY1MWNWUXFMjtpM | 2026-11-07 |
| sfx/stuff-money_bag.m4a | `stuff-money_bag` | stuff/money_bag/7.mp3 | eleven_text_to_sound_v2 | rd2LJPY1MWNWUXFMjtpM | 2026-11-07 |
| sfx/stuff-money_bag_2.ogg | `stuff-money_bag_2` | stuff/money_bag_2/9.mp3 | eleven_text_to_sound_v2 | iTOiGisOO7ZVKGBxnolN | 2026-11-07 |
| sfx/stuff-money_bag_2.m4a | `stuff-money_bag_2` | stuff/money_bag_2/9.mp3 | eleven_text_to_sound_v2 | iTOiGisOO7ZVKGBxnolN | 2026-11-07 |
| sfx/stuff-toilet.ogg | `stuff-toilet` | stuff/toilet/3.mp3 | eleven_text_to_sound_v2 | zCQqQbKWHsRJ3O3W1tQ3 | 2026-11-07 |
| sfx/stuff-toilet.m4a | `stuff-toilet` | stuff/toilet/3.mp3 | eleven_text_to_sound_v2 | zCQqQbKWHsRJ3O3W1tQ3 | 2026-11-07 |
| sfx/wait.ogg | `wait` | wait/5.mp3 | eleven_text_to_sound_v2 | MC5KsHkFMM5YvPjqDHZr | 2026-11-07 |
| sfx/wait.m4a | `wait` | wait/5.mp3 | eleven_text_to_sound_v2 | MC5KsHkFMM5YvPjqDHZr | 2026-11-07 |
| sfx/welcome-46.ogg | `welcome-46` | welcome/46.mp3 | eleven_text_to_sound_v2 | ESxoSacWllwVaemdpQ9W | 2026-11-07 |
| sfx/welcome-46.m4a | `welcome-46` | welcome/46.mp3 | eleven_text_to_sound_v2 | ESxoSacWllwVaemdpQ9W | 2026-11-07 |
| music/welcome-intro.ogg | `welcome-intro` | welcome/intro.mp3 | eleven_music_v2_5 | pSPCQaMqlf5UUL3hUjhy | 2026-11-07 |
| music/welcome-intro.m4a | `welcome-intro` | welcome/intro.mp3 | eleven_music_v2_5 | pSPCQaMqlf5UUL3hUjhy | 2026-11-07 |
| music/welcome-map.ogg | `welcome-map` | welcome/Map.mp3 | eleven_music_v2_5 | VlsrULy8axp22Y7NvH0R | 2026-11-07 |
| music/welcome-map.m4a | `welcome-map` | welcome/Map.mp3 | eleven_music_v2_5 | VlsrULy8axp22Y7NvH0R | 2026-11-07 |
| sfx/welcome-paper.ogg | `welcome-paper` | welcome/paper.mp3 | eleven_text_to_sound_v2 | SkgV36DZIAM7DwhjFkZH | 2026-11-07 |
| sfx/welcome-paper.m4a | `welcome-paper` | welcome/paper.mp3 | eleven_text_to_sound_v2 | SkgV36DZIAM7DwhjFkZH | 2026-11-07 |

Every original sound has a remake.
