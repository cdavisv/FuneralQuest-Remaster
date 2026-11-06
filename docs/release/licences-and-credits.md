# Licences and credits

Not legal advice. Facts are from the repository on 2026-11-06.

## The repository licence

- `license.txt` is the **Proton SDK License** (XFree86 1.1-style, BSD-like). `package.json` says `"license": "SEE LICENSE IN license.txt"`. There is no separate `LICENSE` file.
- It is **permissive**: use, copy, modify, merge, publish, distribute, sublicense and sell are allowed, subject to:
  1. Source redistributions keep the copyright notice, conditions and disclaimer.
  2. **End-user documentation must include the acknowledgement**: "This product includes software written by Seth A. Robinson ( www.rtsoft.com )", in the same place and form as other third-party acknowledgements, or inside the software in the same form and location as other such acknowledgements.
  3. **The name of Seth A. Robinson may not be used in advertising or to promote the sale, use or other dealings** without prior authorisation.
- The licence text says it covers source code only and "doesn't cover the art/audio". The README states Akiko Robinson's art is also released under the Proton licence and asks for credit; the sounds and music are licensed only for Funeral Quest and are **not used**. I have not seen a separate written grant for the art beyond the README, **unverified**: ask Seth.
- Because the licence is permissive and not GPL, there is **no GPL/App Store conflict** for the game's own code. (Apple's terms conflict with GPL-family licences, not with BSD/MIT/Apache/OFL.) Check dependency licences below when adding anything new.
- Redistributing a binary: the acknowledgement must appear where other third-party acknowledgements appear, and the source-redistribution conditions (notice, disclaimer) apply to the source repository itself. Shipping the full `license.txt` text inside the app's credits/licences screen is the safe way.

## Obligations checklist per surface

| Surface | Must do |
| --- | --- |
| Every store page (itch, Steam, Google Play, App Store) | Include the exact sentence "This product includes software written by Seth A. Robinson (www.rtsoft.com)" in the long description. CREDITS.md requires it to be kept visible. |
| In-app credits / licences screen | Same sentence; the original authors; Akiko Robinson's name for the art; the remaster not affiliated with or endorsed by Robinson Technologies. The client builds its credits page from `CREDITS.md`, so editing that file updates it (client README) |
| Desktop installer / app package | Include `license.txt` and `CREDITS.md`; list third-party notices (below) |
| Marketing and promo | Do not use Seth A. Robinson's name to promote ("by Seth Robinson" in ads is the risk). Crediting him in the credits and the acknowledgement is fine; keep it factual ("remaster of the 2001 game") and do not imply endorsement |
| Source repository | Keep `license.txt` and copyright notices intact |
| Social/press kit | Same rules as marketing; CREDITS.md "not affiliated with or endorsed by" line |

## Third-party dependencies (from `package.json` files and installed `node_modules`)

| Package | Used by | Licence | Obligation |
| --- | --- | --- | --- |
| react, react-dom | client | MIT | Keep copyright/licence text in notices |
| @fontsource/atkinson-hyperlegible, cormorant-garamond, ibm-plex-mono, pirata-one | client (fonts bundled) | **OFL-1.1** (per `package.json`) | Fonts may be bundled and used freely; do not sell the font files alone; do not use Reserved Font Names for modified versions; ship the OFL text and copyright lines in third-party notices |
| vite, vitest, @playwright/test, testing-library, jsdom, typescript, tsx, esbuild, biome | dev only | Mostly MIT/Apache-2.0 (unverified individually) | Not shipped in builds |
| fastify, @fastify/* (cors, rate-limit, static, websocket), pino, zod, @node-rs/argon2 | server | MIT (fastify, pino, zod, argon2, @fastify/websocket confirmed in installed packages; the other `@fastify/*` are MIT, **unverified individually**) | Server-side only; if distributing a server image, include notices |
| yaml | content tooling | ISC | |
| @ruffle-rs/ruffle | museum mode only | (MIT OR Apache-2.0) | Only served when `FQ_LEGACY_CLIENT=1`; keep out of store builds |
| Node.js `node:sqlite` | server | Node's licence (MIT) | |
| Tauri 2 (desktop) | `apps/desktop` (other effort) | MIT or Apache-2.0 | Include notices; per the build docs |
| Capacitor (mobile) | `apps/mobile` (other effort) | MIT | Include notices |
| OS web views (WebView2, WKWebView, Android WebView) | runtime | Platform licences | n/a |

**Action:** generate a full third-party notices file from the lockfile (for example with a licence-checker tool) at release time and ship it; this table is a sketch. Re-run after dependency changes. Transitive licences, especially anything copyleft in the Tauri/Capacitor trees, have **not been scanned**.

## Content and art provenance

| Asset | Source | Licence | Note |
| --- | --- | --- | --- |
| Classic art (`assets/classic`) | Akiko Robinson's Flash vector art exported from `legacy/` | Proton SDK licence per README; credit her | Cleanup list in plan section 6 (a band-shirt image, an old third-party advert) must be resolved before store release, or those pictures removed |
| Game text | Original text converted to packs; Expanded text new | Original: Proton licence; Expanded: **owner's** (the plan says drafts were AI-assisted then edited) | Disclose AI assistance on Steam/itch as required |
| New art (planned) | Remaster | Plan says CC BY 4.0, credited with Akiko Robinson | If used, add attribution to credits |
| Sounds and music | Original: not used. New: none ship yet | Plan: self-made or CC0, with a ledger | Keep the ledger when audio arrives |
| Names, brands, real people | Vintage pack keeps some | Third-party marks | Hide Vintage from store builds or clean it (see age sheet) |

## The name "Funeral Quest": a risk, not a conclusion

`docs/REMASTER_PLAN.md` section 9 lists "Rights to the name 'Funeral Quest'" as a risk: ask Seth Robinson in Phase 0, keep a fallback title, nothing in the code depends on the name. CREDITS.md says "Funeral Quest is copyright 2001 Robinson Technologies" and the project "is not affiliated with or endorsed by Robinson Technologies". The licence's text does not mention trademark use of the title; whether the title may be used on commercial stores is **not resolved in the repo**.

Before submitting anywhere:

- [ ] Get written confirmation from Seth A. Robinson / Robinson Technologies that the title and name may be used for the remaster and its store listings, and whether the store page may say "remaster of" (`[NAME PERMISSION STATUS - OWNER TO FILL IN]`)
- [ ] Ask whether any "Funeral Quest" trademark registration exists (not checked here)
- [ ] Prepare a fallback title in the listing drafts (`[FINAL GAME TITLE - OWNER TO FILL IN]`); app ids and bundle ids chosen in `BUILDING.md` are hard to change after the first release, so pick neutral ones
- [ ] Do not use Seth's name in advertising (licence clause 3)
- [ ] Remember that Steam, Apple and Google can pull a title after an IP complaint

## Credits text to keep (from CREDITS.md)

- Funeral Quest is copyright 2001 Robinson Technologies. Seth A. Robinson: programming, design. Akiko Robinson: art. Greg Smith: additional design. Joe Johnston, Foxxie: additional writing.
- "This product includes software written by Seth A. Robinson (www.rtsoft.com)."
- The remaster is an independent, free, open-source project and is not affiliated with or endorsed by Robinson Technologies.
- Add: font credits (OFL), Tauri/Capacitor/React notices link, and an AI-assistance note if applicable.
