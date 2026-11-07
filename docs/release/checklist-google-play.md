# Checklist: Google Play

Policies and sizes are from memory and change often. **Verify each item in Play Console and the current Developer Policy Center before submitting.** Build, signing and Capacitor details: `BUILDING.md`.

## The first release is solo-only (owner's decision 11, 2026-11-06)

The first mobile release ships with online play **switched off**: no server address, no log-on, no chat, no Daily Challenge board, no network request at all (`VITE_SOLO_ONLY=1`, built by `apps/mobile/scripts/prepare-web.mjs`; the Android manifest has no `INTERNET` permission, see `BUILDING.md`). That makes this checklist much shorter. **Not run on a device yet** (only the debug APK was built and its contents checked).

**Still applies:**

- Account, package name (the placeholder `org.funeralquest.remaster` must be replaced first; TODO), Play App Signing, target API level
- Store listing (use the solo-only copy in `store-listing-draft.md`), the Proton acknowledgement, no misleading claims, the name rights (decision 13: no store submission before the name is confirmed in writing)
- Privacy policy URL (required even when nothing is collected), contact email
- Content rating (IARC): the same content profile as online, minus "users interact" and UGC. Answer for the original text as it is; target audience 18+
- Data safety form: **no data collected, none shared** (the optional morning reminder is a notification the device makes for itself)
- Permissions: only `POST_NOTIFICATIONS`, for that optional reminder (Android 13 and later asks at runtime). Declare nothing else
- Gambling (simulated, in-game money only), IP and restricted-content items, minimum functionality (Solo is a full offline game with local saves: say so), ads (none), release tracks and the pre-launch report

**Does not apply to this release:** the account-deletion declaration and web link, the User-generated content policy and everything under it (report, block, moderator queue, abuse contact and response time, the strict word list), the 18+ tick box (there is no online play to gate; Solo has none), the demo-account note for reviewers, `INTERNET` and `ACCESS_NETWORK_STATE`, the "someone must watch the queue" item, server hosting.

**Applies again when online play is added to mobile:** every item under "User-generated content policy" and "Account deletion" below, the Data safety answers for an online build, the `INTERNET` permission (restore it in `AndroidManifest.xml`, build with `FQ_SOLO_ONLY=0`) and the `funeralquest://` link, a published contact and response time, a moderator, the 18+ tick box (it shows on the first online play), and a fresh content-rating questionnaire (users interact, UGC).

## Account

- [ ] Developer account `[GOOGLE PLAY DEVELOPER ACCOUNT - OWNER TO FILL IN]` (one-time fee, about USD 25). Identity verification; a phone and a physical address are required. Organisation accounts need a D-U-N-S number; the address is shown publicly for paid-app/trader accounts under EU DSA (`[OPERATOR POSTAL ADDRESS - OWNER TO FILL IN]`)
- [ ] Personal accounts created after late 2023 had to run a closed test with about 12 testers for 14 days before production access (**verify the current rule**). Plan time for it
- [ ] Package name `[APP ID / BUNDLE ID - SEE BUILDING.md]` (permanent)
- [ ] Play App Signing enabled; upload an Android App Bundle (.aab), not an APK
- [ ] Target API level meets the current requirement (new apps must target a recent Android level; verify the year's requirement)

## Store listing

| Item | Spec |
| --- | --- |
| App name | 30 characters max |
| Short description | 80 characters max |
| Full description | 4000 characters max (draft in `store-listing-draft.md`) |
| App icon | 512 x 512 PNG, 32-bit with alpha, up to 1024 KB |
| Feature graphic | 1024 x 500 JPG or 24-bit PNG (no alpha) |
| Phone screenshots | 2 to 8; JPG/PNG; each side 320 to 3840 px; the long side at most twice the short side; 16:9 or 9:16 recommended |
| 7-inch and 10-inch tablet screenshots | Optional but needed for tablet featuring |
| Promo video | Optional YouTube URL |
| Category | Game > Simulation or Strategy |
| Contact details | Email required `[CONTACT EMAIL - OWNER TO FILL IN]`; website and phone optional |
| Privacy policy | URL required `[PRIVACY POLICY URL - OWNER TO FILL IN]` |

- [ ] No misleading claims, no "free" tricks, no competitor names, no keyword stuffing, no award claims, no references to other apps' performance
- [ ] Include the Proton acknowledgement sentence in the full description
- [ ] Store listing text must not include more profanity than necessary; do not put profanity in title or short description

## App content declarations

- [ ] **Content rating (IARC)**: answers in `age-rating-and-content.md`. Expect Mature 17+ / PEGI 16-ish depending on how language and sexual references are weighed (one content profile: the original text ships unaltered). Answer simulated gambling, UGC and online interaction truthfully
- [ ] **Target audience and content**: select 18+ (or 13+); **not** under 13. "Appeals to children" = no, to avoid the Families policy
- [ ] **Data safety form**: from `privacy-labels.md`. Online-capable build: collects user IDs, user content, in-app messages; no sharing; encrypted in transit; deletion available. Solo-only build: no data collected
- [ ] **Account deletion**: because the app lets users create accounts, Play requires (1) an in-app path to start deletion and (2) a web link where users can request deletion without reinstalling, entered in the Data safety form `[ACCOUNT DELETION URL - OWNER TO FILL IN]`. **Built:** Settings, Delete my account (password re-entry; guests confirm) and the public page `GET /account/delete` on the server (the operator sets `FQ_CONTACT_EMAIL`); see `ugc-and-moderation.md`. Check the deployed URL loads and shows the real contact address
- [ ] **Ads**: declare "No ads"
- [ ] **Financial features, health, government, news app**: not applicable
- [ ] **Data deletion practices**: describe what remains after deletion (hall of fame, snapshots, audit rows, backups)
- [ ] **Permissions**: the solo-only release asks only for `POST_NOTIFICATIONS` (checked in the built debug APK with `aapt2 dump permissions`). An online build also needs `INTERNET`. Do not request others. Check the final manifest from `BUILDING.md`
- [ ] **Advertising ID declaration**: the app does not use it; declare accordingly
- [ ] **Photos/videos, SMS, location, background location**: not used

## User-generated content policy (online builds only; not in the solo-only first release)

Play's UGC policy requires: terms prohibiting objectionable content, **in-app user reporting, a way to block users, content moderation/filtering and published contact information**. These now exist (see `ugc-and-moderation.md` for exactly what, and its limits):

- [ ] In-app report on cafe lines, letters, rankings rows, names, announcements: built; **check it on a phone build** (verified in a browser at phone size, not on a device)
- [ ] In-app block and a blocked-players list in Settings: built
- [ ] Moderation: the `/admin/` page and API; **someone must watch the queue** `[RESPONSE TIME FOR REPORTS - OWNER TO FILL IN]`
- [ ] Filtering: the engine's swear filter plus the strict word list; **set `FQ_BLOCKLIST_FILE` on the deployed server**
- [ ] Published contact `[ABUSE REPORT ADDRESS OR FORM - OWNER TO FILL IN]` (`FQ_CONTACT_EMAIL`), and the terms (`terms-of-service-DRAFT.md`) finalised
- [x] The rating and conduct notice with its "I am 18 or older and accept these rules" tick box (a rating and a self-declaration; no age is collected or checked)
- [x] Guests may not chat, write letters or post announcements (decision 7). The first release is Solo-only anyway (above)

## Other policy items

- [ ] Gambling policy: simulated gambling with in-game money and no real-money prizes is not "real-money gambling"; do not describe the minigames as gambling with real value; no links to gambling sites
- [ ] Intellectual property and impersonation: the name "Funeral Quest" and the Robinson Technologies credit (`licences-and-credits.md`). The title must not suggest endorsement. Keep the "not affiliated" statement in the description
- [ ] Restricted content: "sensitive events" and violence: comedic fictional deaths are fine; nothing referencing real tragedies by name
- [ ] Minimum functionality / webview apps: Play may reject a thin web wrapper. The app has an offline Solo game and local saves, which helps; describe it in the listing
- [ ] Deceptive behaviour: no fake reviews, no incentives for ratings
- [ ] Open-source: nothing to declare in the console; ship notices in-app
- [ ] Original sounds/music are not used; museum mode must not be reachable from the Android build

## Release

- [ ] Internal test track, then closed test, then production (staged rollout 10 to 20 percent)
- [ ] Pre-launch report from Play passes (crashes, accessibility)
- [ ] Release notes (draft "what's new" in `store-listing-draft.md`)
- [ ] Support the "Data safety" and policy re-checks on each update
