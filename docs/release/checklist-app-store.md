# Checklist: Apple App Store

Policies and sizes are from memory and change. **Verify in App Store Connect and the current App Review Guidelines at submission.** Build, signing, provisioning and Capacitor setup: `BUILDING.md`.

## Account

- [ ] Apple Developer Program `[APPLE DEVELOPER ACCOUNT / TEAM - OWNER TO FILL IN]` (about USD 99 per year). Individual or organisation (organisation needs a D-U-N-S number and legal entity checks)
- [ ] Trader status for EU distribution: the operator name, address and contact are shown on the product page (DSA) `[OPERATOR POSTAL ADDRESS - OWNER TO FILL IN]`
- [ ] Bundle ID `[APP ID / BUNDLE ID - SEE BUILDING.md]` (permanent)
- [ ] A Mac with Xcode for the archive and upload (or CI with macOS runners); TestFlight for beta

## Listing

| Item | Spec |
| --- | --- |
| Name | 30 characters |
| Subtitle | 30 characters |
| Promotional text | 170 characters (editable without a new build) |
| Description | 4000 characters |
| Keywords | 100 characters, comma separated, no spaces after commas; do not repeat title words, no competitor names |
| What's new | 4000 characters |
| Support URL | Required `[SUPPORT URL - OWNER TO FILL IN]` |
| Marketing URL | Optional `[WEBSITE URL - OWNER TO FILL IN]` |
| Privacy policy URL | Required `[PRIVACY POLICY URL - OWNER TO FILL IN]` |
| App icon | 1024 x 1024 PNG, no alpha, no rounded corners |
| iPhone screenshots | 6.9-inch (1320 x 2868) required for current Pro Max class; 6.5-inch (1284 x 2778 or 1242 x 2688) accepted as the fallback set; 1 to 10 each |
| iPad screenshots | 13-inch (2064 x 2752) if the app supports iPad; 1 to 10 |
| App preview video | Optional, 15 to 30 seconds |
| Category | Games > Simulation (primary), Strategy (secondary) |
| Copyright | "2026 `[OPERATOR NAME - OWNER TO FILL IN]`" plus the original copyright line is handled in-app |

Draft copy and counts are in `store-listing-draft.md`. Screenshots must show the game, not marketing art alone. Include the Proton acknowledgement in the description.

## Age rating

Apple's age-rating questionnaire was updated (new categories 4+, 9+, 13+, 16+, 18+ and added questions on in-app controls, UGC and messaging). Expected: **13+ to 16+** with profanity/crude humour frequent, cartoon violence infrequent, simulated gambling infrequent, alcohol references infrequent, UGC yes. Details in `age-rating-and-content.md`. Re-read the questions when filling in.

## App Privacy ("nutrition label")

Online build: data linked to the user: user ID, user content, gameplay content; no tracking. Solo-only build: "Data Not Collected". Table in `privacy-labels.md`. No App Tracking Transparency prompt is needed (no tracking SDKs found).

## Guideline checklist

| Guideline | What it means here | Status |
| --- | --- | --- |
| **1.2 User-generated content** | Needs: filter for objectionable content, report mechanism with timely response, ability to block abusive users, published contact info. Apps with UGC and no such features are rejected | **Built, not yet verified on a device or by review:** word filters (engine swear filter plus the sysop's strict list, set `FQ_BLOCKLIST_FILE`), report on cafe lines, letters, names, rankings rows and announcements, block with a blocked-players list, moderator page and API, mutes and bans, published contact (`FQ_CONTACT_EMAIL`). **Owner must supply:** contact address, response target (about 24 hours is the usual expectation), and someone to watch the reports. See `ugc-and-moderation.md` |
| **1.1.x Objectionable content** | Crude humour is allowed; avoid content that is "mean-spirited", discriminatory or demeaning about groups. The game ships the original 2001 text unaltered, which includes dated material (see `age-rating-and-content.md`). Answer the questionnaire truthfully for it; do not alter the content to suit review | Skim the pack, answer truthfully, be ready to explain it is a faithful remaster of a 2001 game |
| **4.2 Minimum functionality** | A wrapped website can be rejected. Offline Solo with a full game, local saves and native packaging helps | Explain Solo in review notes |
| **4.0 Design / 2.1 App completeness** | No placeholder content, working demo access for reviewers | Provide a **demo account** (or guest sign-in) for review; guests exist (`/api/auth/guest`) |
| **5.1.1 Data collection; 5.1.1(v) account deletion** | Apps that support account creation must let users **initiate deletion in the app** | **Built:** Settings, Delete my account (password re-entry; guests confirm), with the web page `/account/delete` for people who cannot log in. Test it in the iOS build before submitting (verified in a browser, not on a device) |
| **5.1.2 Data use and sharing** | Matches App Privacy answers | Verify |
| **5.1.1(i) Privacy policy** | Linked in the app and in App Store Connect | Add a link in the app's settings/credits (unverified whether present) |
| **Sign in with Apple (4.8)** | Required only when the app offers a **third-party or social login**. This game uses its own username/password and guests only (verified: no OAuth in `routes.ts`). If a third-party login is added later, offer Sign in with Apple or an equivalent privacy-focused option | Not required today |
| **5.3 Gaming, gambling** | Real-money gambling needs licences. Simulated gambling with in-game money is allowed but must be age rated accordingly | Declare simulated gambling |
| **3.1 In-app purchase** | None offered. Do not link to external payment or donation pages from the iOS app (3.1.1/3.1.3): keep "support the server" links out of the iOS build | Check credits links |
| **2.3 Accurate metadata** | No false claims, no competitor names, no pricing in text, no other platforms' names in screenshots | |
| **5.2 Intellectual property** | The title and Robinson Technologies relationship (`licences-and-credits.md`); the original game's art is used under the Proton licence | Resolve name rights first |
| **2.5.2 Self-contained code** | Capacitor bundles the web assets; no downloading of executable code | OK as long as game content packs are data |
| **4.7 Mini apps/games** | Not applicable | |
| **Privacy manifest (PrivacyInfo.xcprivacy)** | Required API reasons for Capacitor plugins; keep third-party SDK list empty | Check in Xcode |
| **Export compliance** | HTTPS only: standard encryption exemption; answer in the build settings | |

## Open source and Apple

The repo licence is the Proton SDK licence (permissive, BSD-like) and the dependencies listed in `licences-and-credits.md` are MIT, Apache-2.0, ISC or OFL. None of these conflicts with the App Store terms. A copyleft licence (GPL/AGPL) in any new dependency or Capacitor plugin would be a problem; scan the final iOS dependency tree. Keep the licence notices in an in-app "Licences" screen.

## Review notes to include

- Demo login (or "use Play as guest"), what Solo mode is, that online play is optional, link to the moderation contact, how to delete an account, that the sounds are not included
- Statement that the game is a comedy about funeral parlors; mention fictional, cartoon content and the age rating chosen

## Release

- [ ] TestFlight external beta (requires a short beta review)
- [ ] Submit with manual release; phased release 7 days
- [ ] Prepare for rejection under 1.2 or 4.2: have the Solo-only fallback build ready (`ugc-and-moderation.md`)
