# Release docs (Phase 6: launch preparation)

Drafts and checklists for putting Funeral Quest Remastered in front of players: web/PWA, itch.io, Steam, Google Play and the App Store. Written against the repository as it stood on 2026-11-06. Everything about store rules is from the author's knowledge of the policies and **must be re-checked in the store consoles at submission time**; policies change. Anything not verifiable from the repo is marked **unverified**.

Nothing here is legal advice. The privacy policy and terms are drafts for the owner and a lawyer.

## Files

| File | What it is |
| --- | --- |
| [checklist-web-pwa.md](checklist-web-pwa.md) | Hosting the official server and the installable web app |
| [checklist-itch.md](checklist-itch.md) | itch.io page and upload |
| [checklist-steam.md](checklist-steam.md) | Steamworks store-side checklist (build and launch options: `STEAM.md`, written separately) |
| [checklist-google-play.md](checklist-google-play.md) | Play Console: listing, content rating, Data safety, UGC, account deletion |
| [checklist-app-store.md](checklist-app-store.md) | App Store Connect: listing, age rating, privacy label, guideline 1.2 and 5.1.1 |
| [age-rating-and-content.md](age-rating-and-content.md) | One answer sheet for every rating questionnaire, based on what the content packs actually contain |
| [ugc-and-moderation.md](ugc-and-moderation.md) | What each store requires for user-generated text, and a gap list against the current server and client |
| [privacy-labels.md](privacy-labels.md) | Data-type tables for App Privacy, Data safety, Steam and itch, from verified server behaviour |
| [licences-and-credits.md](licences-and-credits.md) | Repo licence, dependency licences, the Proton SDK acknowledgement, the name-rights risk |
| [store-listing-draft.md](store-listing-draft.md) | Store copy within each store's character limits |
| [privacy-policy-DRAFT.md](privacy-policy-DRAFT.md) | Draft privacy policy (not in force) |
| [terms-of-service-DRAFT.md](terms-of-service-DRAFT.md) | Draft terms of service (not in force) |

Build and launch side, written with the desktop and mobile apps: [BUILDING.md](BUILDING.md) (Tauri and Capacitor builds, signing, Xcode steps, CI) and [STEAM.md](STEAM.md) (Steam depots, launch options, Steam Deck).

## Blockers found while writing these (read first)

0. **Decided 2026-11-06 (see [../DECISIONS.md](../DECISIONS.md)):** the first mobile release is **solo-only** (decision 11: no online play, no network permission; the store checklists are much shorter), the free web build goes on GitHub Pages when the name is confirmed (decision 14, [checklist-web-pwa.md](checklist-web-pwa.md)), online play is rated **18+ with a tick box and no age verification** (decision 8: no age data collected), and **guests cannot use free text** (decision 7).
1. **Report, block, mute and the moderator tools now exist** (server, web client and the `/admin/` page) but are **built and tested, not yet run on a device or through store review**, and they need the owner: a contact address (`FQ_CONTACT_EMAIL`), someone watching the report queue, the strict word list file (`FQ_BLOCKLIST_FILE`) and the decisions listed in [ugc-and-moderation.md](ugc-and-moderation.md).
2. **Self-service account deletion now exists** (Settings, Delete my account, and the public page `/account/delete`), with data export. The deployed URL, the contact address on it and the retention periods in the privacy policy are the owner's to fill in. See [ugc-and-moderation.md](ugc-and-moderation.md) and [privacy-labels.md](privacy-labels.md).
3. **Player-typed text is kept in the audit log**, except cafe chat, which is no longer stored: mail bodies, announcements, battle quotes and fortunes are retained in `audit_log` (90 days by default; `0` keeps forever), and an account's deletion removes the rows that hold what it typed. The privacy policy draft says so; keep the periods in step.
4. **The "Funeral Quest" name and the original sounds.** Rights to the name are unresolved (`docs/REMASTER_PLAN.md` section 9). Get written confirmation from Seth Robinson / Robinson Technologies before any store submission. Museum mode serves original sounds and must be off on the official server.
5. **AI-assisted art and text.** The plan says AI tools were used for concept art and content drafts. Steam and itch.io ask for disclosure; see [checklist-steam.md](checklist-steam.md).
6. **The original 2001 text ships unaltered in every mode.** It contains profanity, crude and sexual humour, dated material and a few real-person and brand references. Answer rating forms truthfully for it; see [age-rating-and-content.md](age-rating-and-content.md).

## Owner must fill in

Every blank used across these files. Search the folder for `OWNER TO FILL IN` to find them. Fill each once, then replace everywhere.

| Placeholder | Used in | Notes |
| --- | --- | --- |
| `[OPERATOR NAME - OWNER TO FILL IN]` | privacy, terms, checklists | Person or company that runs the official server and publishes the apps |
| `[OPERATOR POSTAL ADDRESS - OWNER TO FILL IN]` | privacy, terms, App Store/Google Play | Needed by Apple (trader status, EU DSA), Google (organisation/trader), GDPR controller details |
| `[CONTACT EMAIL - OWNER TO FILL IN]` | privacy, terms, listings | Published contact for support, abuse reports and data requests |
| `[SUPPORT URL - OWNER TO FILL IN]` | listings, checklists | Apple requires a support URL |
| `[WEBSITE URL - OWNER TO FILL IN]` | listings | Marketing URL |
| `[PRIVACY POLICY URL - OWNER TO FILL IN]` | all store checklists | Public, non-PDF, reachable without login |
| `[TERMS URL - OWNER TO FILL IN]` | checklists, listings | |
| `[ACCOUNT DELETION URL - OWNER TO FILL IN]` | Google Play, privacy | Web page where a player can request or perform deletion |
| `[OFFICIAL SERVER URL - OWNER TO FILL IN]` | web/PWA, privacy, terms | The origin players connect to |
| `[SERVER HOST / HOSTING PROVIDER - OWNER TO FILL IN]` | privacy, web/PWA | Provider name, and `[HOSTING COUNTRY/REGION - OWNER TO FILL IN]` |
| `[BACKUP PROVIDER AND RETENTION - OWNER TO FILL IN]` | privacy | The plan mentions Litestream backups; none are configured in the repo (unverified where) |
| `[JURISDICTION / GOVERNING LAW - OWNER TO FILL IN]` | terms, privacy | Country/state for governing law and courts |
| `[EFFECTIVE DATE - OWNER TO FILL IN]` | privacy, terms | |
| `[DATA PROTECTION CONTACT / EU-UK REPRESENTATIVE IF REQUIRED - OWNER TO FILL IN]` | privacy | Only if the operator is outside the UK/EU and targets players there |
| `[AUDIT LOG RETENTION DAYS - OWNER TO FILL IN]` | privacy | Server default is 90 (`FQ_AUDIT_RETENTION_DAYS`) |
| `[REPOSITORY URL - OWNER TO FILL IN]` | listings, licences | Public source link |
| `[FINAL GAME TITLE - OWNER TO FILL IN]` | listings | Depends on the name-rights outcome |
| `[NAME PERMISSION STATUS - OWNER TO FILL IN]` | licences | Written permission (or not) from Robinson Technologies |
| `[APP ID / BUNDLE ID - SEE BUILDING.md]` | Google Play, App Store | Chosen by the desktop/mobile effort |
| `[STEAM APP ID - OWNER TO FILL IN]` | Steam | Assigned by Steamworks |
| `[APPLE DEVELOPER ACCOUNT / TEAM - OWNER TO FILL IN]`, `[GOOGLE PLAY DEVELOPER ACCOUNT - OWNER TO FILL IN]`, `[STEAMWORKS PARTNER ACCOUNT - OWNER TO FILL IN]`, `[ITCH.IO ACCOUNT - OWNER TO FILL IN]` | checklists | Account type (individual/organisation) affects verification |
| `[COMMUNITY LINK (DISCORD ETC) - OWNER TO FILL IN]` | listings | Optional |
| `[TRAILER URL - OWNER TO FILL IN]` | listings | Optional |
| `[ABUSE REPORT ADDRESS OR FORM - OWNER TO FILL IN]` | ugc, terms | Published reporting route (may equal the contact email) |
| `[RESPONSE TIME FOR REPORTS - OWNER TO FILL IN]` | ugc, terms | For example 72 hours; a promise the operator must keep |
| `[AI USE STATEMENT - OWNER TO FILL IN]` | store-listing-draft, Steam/itch | Exact description of any AI-generated or AI-assisted shipped assets |
| `[SUPERVISORY AUTHORITY - OWNER TO FILL IN]` | privacy | Data protection authority players may complain to |
| `[ADEQUACY DECISION / STANDARD CONTRACTUAL CLAUSES / OTHER - OWNER TO FILL IN]` | privacy | International transfer mechanism |
| `[AMOUNT - OWNER AND LAWYER TO DECIDE]` | terms | Liability cap |
| `[OWNER TO FILL IN]` (various, e.g. log retention, in-game deletion route, notice method) | privacy, terms | Each has a short hint in the surrounding text |
