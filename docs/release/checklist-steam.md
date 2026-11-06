# Checklist: Steam (store side)

Build, packaging, launch options and Steamworks SDK technicalities are in [STEAM.md](STEAM.md) (written by the desktop effort). This file covers the store page and the questionnaires. Sizes and fees are from memory; **verify in Steamworks**.

## Account and app

- [ ] Steamworks partner account `[STEAMWORKS PARTNER ACCOUNT - OWNER TO FILL IN]`: identity/tax/bank verification (individual or company); allow several weeks
- [ ] Pay the per-app fee (about USD 100, recoverable after a revenue threshold; a free game earns none, so treat it as a cost). **Free apps still pay it**
- [ ] Create the app (`[STEAM APP ID - OWNER TO FILL IN]`), type Game
- [ ] Free-to-play / free app: set the price to Free (a free game here is "Free to Play" in Steam terms, even without in-game purchases). No in-app purchases or ads exist in the repo, so say "no purchases" truthfully
- [ ] Coming soon page can go up early; Valve requires the page to be public for a minimum period before release (about two weeks, **verify**) and a review of the store page and the build (a few days each)
- [ ] Release date set; "Wishlist" CTA live at Alpha (plan Phase 6)

## Store page assets (typical sizes, PNG/JPG; verify against Steamworks)

| Asset | Size |
| --- | --- |
| Header capsule | 920 x 430 (also 460 x 215 scaled) |
| Small capsule | 462 x 174 |
| Main capsule | 1232 x 706 |
| Vertical capsule | 748 x 896 |
| Library capsule | 600 x 900 |
| Library header | 920 x 430 |
| Library hero | 3840 x 1240 |
| Library logo | up to 1280 x 720, transparent PNG |
| Page background | 1438 x 810 (optional) |
| Screenshots | at least 5, 1920 x 1080 or larger, 16:9; must show real gameplay |
| Trailer | optional `[TRAILER URL - OWNER TO FILL IN]`; no promises not in the game |
| Client icon, logo | 32x32/256x256 icons, `.ico` for the app (see STEAM.md) |
| Capsule art rules | Logo must be readable; do not put review quotes, awards, prices, "free" or "new" text on capsule art (Valve rejects these) |

## Text

- [ ] Short description (<= 300 chars) and "About this game" (draft in `store-listing-draft.md`)
- [ ] Languages supported: interface English only for now (confirm; the client has an `i18n` directory)
- [ ] Tags (up to 20): Simulation, Dark Humor, Management, Strategy, Multiplayer, Singleplayer, Indie, Casual, Free to Play, Funny, Cartoon, Turn-Based. Do not use misleading tags
- [ ] Required text in the description: "This product includes software written by Seth A. Robinson (www.rtsoft.com)." and that the remaster is independent and not endorsed by Robinson Technologies
- [ ] Support URL and website `[SUPPORT URL - OWNER TO FILL IN]`, `[WEBSITE URL - OWNER TO FILL IN]`
- [ ] Privacy policy URL `[PRIVACY POLICY URL - OWNER TO FILL IN]` (online accounts collect data)
- [ ] Legal line / copyright holders

## Questionnaires

- [ ] **Content survey** (violence, sexual content, nudity, mature themes, frequency, "general mature content"): answers in `age-rating-and-content.md`. Expect cartoon violence, no sexual content, crude humour. Steam does not assign PEGI/ESRB but gates by country using these answers
- [ ] **AI content disclosure**: Steam requires developers to disclose generative AI used in pre-generated content (art, text, audio) and live-generated content. The plan says AI tools were used for concept art, background drafts and content writing drafts and that this "is disclosed in the credits and on the Steam page". Write a precise statement of what shipped is AI-generated or AI-assisted; describe guardrails (none for live generation: the game has no live AI)
- [ ] Rating/age: Steam age check on the page is automatic for mature descriptors; no extra action unless flagged
- [ ] Accessibility, controller, Steam Deck: answer honestly in the "Steam Deck" and input questionnaire (mouse/keyboard; touch via Deck; controller not supported unless built). Steam Deck verification is optional
- [ ] Tax and payments forms are only needed for paid apps, but still complete the partner setup
- [ ] Data/privacy: Steam asks in "Store page > Game Info"; if the game collects data online, link the privacy policy
- [ ] Online features: state them in the description; Steam expects multiplayer chat to be moderated ("report" tools; see `ugc-and-moderation.md`). Valve's rules for online games with UGC are less explicit than Apple's/Google's, but unmoderated chat is a common cause of takedowns (**unverified specifics**)

## Depot upload and release

- [ ] Depots and builds: see STEAM.md. Store-side: set the default branch live only after review passes
- [ ] Upload with `steamcmd` using the depot VDF files in STEAM.md; do not commit build credentials
- [ ] Package and app launch options, install scripts: STEAM.md
- [ ] Ship `license.txt`, `CREDITS.md` and notices in the depot; credits in-app contain the Proton acknowledgement
- [ ] Linux/Windows/macOS depots match the platforms checked on the store page

## Rights and policy

- [ ] Name rights confirmed in writing before the page goes public (`licences-and-credits.md`); Valve removes titles after IP claims
- [ ] Do not copy the original sounds or music; museum mode off in the Steam build
- [ ] Official server URL `[OFFICIAL SERVER URL - OWNER TO FILL IN]` reachable; set expectations if online towns may be quiet (bots fill towns; Solo works alone)
- [ ] Community hub and discussion moderation plan `[COMMUNITY LINK (DISCORD ETC) - OWNER TO FILL IN]`
- [ ] Review the Steamworks distribution agreement and "Steam Online Safety" requirements (**unverified details**)
