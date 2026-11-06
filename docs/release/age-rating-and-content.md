# Age rating and content answer sheet

One place for every questionnaire. Content facts come from grepping `packages/content/packs/{classic,vintage,expanded}`; counts below are indicative, not exhaustive, and **a human should skim the packs before certifying answers** (certifying wrongly is the owner's risk, not the store's). Store questionnaire wording changes often; the question names here are from memory. **Re-read each form at submission.**

## What the game contains (be honest)

| Theme | What is in the packs | Level |
| --- | --- | --- |
| Death, corpses, funerals | The whole game: selling funerals, bodies, caskets, autopsies, hanging, "kill" etc. in jokes and event text. Cartoon art, no gore imagery in the exported art (art itself unverified here; skim `assets/classic`) | Core theme, comedic |
| Violence | Sabotaging rivals, battles between undertakers (strength/HP, "knees need a talking-to"), threats. Text and cartoon art; no blood-spray graphics found, but text mentions blood, stabbing, poisoning, strangling | Mild to moderate cartoon/fantasy violence |
| Crude humour | Toilet and body jokes, innuendo, insults | Frequent |
| Profanity | **Vintage pack**: "bitch", "asshole", "bastard", "damn", "crap", "piss" in dialogue; stronger words appear only in `swear_words.yaml` as a filter list. Classic and Expanded packs: only mild words ("crap", "damn", "piss") found, **verify by reading** | Vintage: moderate to strong in places; Classic/Expanded: mild |
| Sexual content | Innuendo and a few references (Vintage: a pornography reference, "naked pictures of corpses" as a karma line; "sex" appears about 6 times, mostly the player-sex field). No nudity found in text; art unverified | Mild suggestive references |
| Alcohol | Drunk customers, bar events, "80-proof barley wine", vodka in a minigame, "a case of beer" | Infrequent references; no player drinking mechanic except a shot-glass minigame |
| Drugs | Vintage karma line "Takes recreational drugs"; one or two incidental mentions | Infrequent, mild |
| Tobacco | None found | None |
| Gambling (simulated) | Expanded pack: a **club with house games** and "Formaldehyde Roulette" (shot glasses) using **in-game money**; lottery-ticket events in Vintage/Expanded; bingo night events and flavour. No real money, no purchases, no prizes of real value | Simulated gambling: infrequent to frequent depending on the questionnaire definition; declare it |
| Horror | Skeletons, ghosts, zombies, rotting; played for laughs | Mild comic horror |
| Stereotypes / sensitive | The plan (section 3.2) says dated broken-English stereotypes are rewritten in Expanded; Vintage keeps the original text including brand and real-person references (e.g. a band shirt) | **Vintage is the risk**; see decision below |
| User-generated content / chat / mail | Yes: word filters, report and block in the app, mutes and bans by moderators (answer UGC questions "yes, with moderation and reporting") | See `ugc-and-moderation.md` |
| Online interactions | Yes: accounts, other players, chat, mail, rankings | |
| In-app purchases, ads, loot boxes, contests, real-money | None found | None |
| Location sharing | None | None |

**Decision for the owner:** either (a) hide the Vintage wording from the store builds and the official server (the client's Solo setup has a Classic/Vintage choice; online towns select a pack by admin), or (b) rate the whole product to Vintage's level. Option (a) keeps the rating lower but it is a code/config decision outside this folder; **unverified how the store builds will be configured**.

## Expected ratings

| System | Expectation | Notes |
| --- | --- | --- |
| ESRB | **Teen (T)** likely: Crude Humor, Violence (cartoon), Simulated Gambling, Mild Language, Alcohol Reference, Users Interact. Possibly **Mature 17+** if Vintage language is included. Digital storefronts use IARC, not a paid ESRB submission | Plan said "expect Mature / PEGI 16" |
| PEGI | **16** per the plan, plausible; could be **12** with Classic/Expanded only. Descriptors that may show: Bad Language, Violence, Gambling (simulated), Online. Note PEGI treats simulated gambling as at least 12+ | Via IARC on Play |
| IARC (Google Play) | Mature 17+ / PEGI 16 range depending on answers. Do not answer low to dodge a rating; Google audits | |
| Apple (new age categories 4+, 9+, 13+, 16+, 18+) | **13+ to 16+** expected: Profanity/Crude Humor frequent, Cartoon Violence infrequent/mild, Horror/Fear infrequent, Alcohol/Drug references infrequent, Simulated Gambling infrequent. Apple also asks whether the app has UGC/chat (yes) and unrestricted web access (no). If online chat is open to all, Apple may force a higher minimum | Re-read the current questionnaire; Apple's age-rating questions were revised in 2025 |
| Steam | Content survey: violence "cartoon/fantasy", frequent crude humour, no sexual content, no nudity; Steam may show mature content descriptions. Also AI disclosure | |
| USK / ACB / others | Via IARC on Play; Steam does not auto-assign. Germany needs USK for physical, not for digital Steam | |

## Answer sheet by store

### Google Play content rating (IARC questionnaire)

| Question area | Answer |
| --- | --- |
| Category | Game |
| Violence | Yes: cartoon/fantasy violence (sabotage, fights) against characters; no realistic or graphic violence; no violence against real people/animals depicted graphically |
| Blood / gore | Mentions in text only; no depicted gore (confirm in art) |
| Sexuality / nudity | No nudity; mild innuendo |
| Language | Profanity: yes (mild Classic/Expanded; moderate if Vintage ships) |
| Controlled substances | References to alcohol; infrequent drug reference (Vintage) |
| Crude humour | Yes, frequent |
| Gambling | **Simulated gambling**: yes (in-game money; no real money, no cash-out) |
| Fear / horror | Mild, comedic |
| Users interact | **Yes** (chat, mail), UGC: yes |
| Shares location | No |
| Digital purchases | No |
| Unrestricted web access | No (the app only talks to its server; confirm no outbound links open a browser. Credits link to external pages: those open the system browser) |

Target audience: **18+ or 13+ and up; not "children"**. Do not select under-13 groups; that triggers Families policy (ads/SDK rules, no UGC).

### Apple age rating

| Question | Answer |
| --- | --- |
| Cartoon or fantasy violence | Infrequent/mild |
| Realistic violence | None |
| Sexual content or nudity | None / infrequent suggestive themes (Vintage) |
| Profanity or crude humor | **Frequent/intense** to be safe |
| Horror/fear themes | Infrequent/mild |
| Alcohol, tobacco or drug use or references | Infrequent/mild |
| Simulated gambling | Infrequent/mild (Expanded club) |
| Contests | None |
| Medical or wellness | None |
| Gambling (real money) | No |
| Unrestricted web access | No |
| User-generated content / messaging | **Yes** (requires 1.2 features) |
| Parental controls / age assurance | None in app |

### Steam content survey

| Item | Answer |
| --- | --- |
| Violence | Cartoon/fantasy: infrequent to moderate |
| Sexual content | None to mild references |
| Nudity | None (verify art) |
| Mature subject matter | Death, funerals, crude humour; dark themes: yes |
| AI-generated content | **Disclose** if any shipped art, text or audio was AI-generated or AI-assisted (plan section 6: "AI image tools for concept exploration and background drafts"; section 3: content drafts "AI-assisted"). Pre-generated content disclosure is required by Steam; state honestly what shipped |
| Multiplayer / online | Yes, with chat; Steam may ask about moderation |

### itch.io

Classification: Games. "Content warnings" are free-form: death and funeral themes, crude humour, mild violence, user chat. Use the mature-content flag if the Vintage wording is included. Disclose generative-AI use if the page offers that field.

## Content descriptors for store pages

Use plain text: "Dark humour, cartoon violence, crude humour, mild language (stronger in Vintage wording), references to alcohol, simulated gambling with in-game money, online interactions and user-generated text." No cheating on descriptors in titles or short descriptions.

## Sounds and music

The original sounds and music are **not used** (CLAUDE.md; `apps/client/src/audio/AudioManager.ts` says no audio files ship yet). Store pages and Data safety forms should not mention original music. If new audio is added, record it in the planned ledger `assets/audio/LICENSES.md` (does not exist yet: `assets/` currently holds only `classic` and `manifest.json`). Museum mode serves the original sounds and must be off on the official server and absent from store builds.
