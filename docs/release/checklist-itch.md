# Checklist: itch.io

Cheapest, fastest store: no fee, no review gate for most content, good for a first public build. Sizes and limits below are from memory; **verify in the itch dashboard**.

## Account and page

- [ ] Account `[ITCH.IO ACCOUNT - OWNER TO FILL IN]`, display name = operator name
- [ ] Project kind: HTML (browser build) and/or Downloadable (Tauri desktop builds, per `BUILDING.md`)
- [ ] Pricing: "No payments" (free). Optionally enable "Pay what you want" with a minimum of 0 to allow donations. Do not advertise "free" as a trick; it simply is free and open source
- [ ] Title: `[FINAL GAME TITLE - OWNER TO FILL IN]`; URL slug; tagline (<= about 100 chars; draft in `store-listing-draft.md`)
- [ ] Classification: Game; genre: Simulation / Strategy; tags (up to about 10, see listing draft)
- [ ] Release status: In development until launch, then Released
- [ ] Community: comments or a discussion board on (consider moderation load), `[COMMUNITY LINK (DISCORD ETC) - OWNER TO FILL IN]`

## Assets

| Asset | Spec |
| --- | --- |
| Cover image | PNG/JPG/GIF, recommended 630 x 500 (minimum 315 x 250), shown as a thumbnail; avoid text-heavy covers |
| Screenshots | 3 to 5 at least, up to 12 or so; same aspect ratio helps; 1280 x 720 or larger |
| Banner (optional) | per-page; wide, dashboard shows recommended size |
| Trailer | YouTube/Vimeo link, optional `[TRAILER URL - OWNER TO FILL IN]` |
| Page text | Markdown/HTML description; see listing draft |

## HTML5 upload

- [ ] Zip of the PWA build (`apps/client/dist-build`) with `index.html` at the zip root. The page uses absolute paths (`/assets/...`); itch serves games from a sub-path, so a **dedicated itch build is probably needed with a relative base**: client README says sub-directory deployment is not supported (**unverified fix; confirm with the build owner**)
- [ ] Service worker and PWA install will not work inside itch's iframe; Solo should still run; verify
- [ ] Set "This file will be played in the browser", viewport size (for example 1280 x 720) and fullscreen button
- [ ] Mobile-friendly if offering on phones; SharedArrayBuffer is not needed (not verified)
- [ ] File-count and size limits for HTML uploads exist (a few hundred MB and about a thousand files; **verify**). The art bundle is about 4.5 MB for 85 files (client README), so well under
- [ ] Online mode from an itch origin requires the server's `FQ_ALLOWED_ORIGINS` to include the itch origin(s) (`https://<user>.itch.io` and the `html-classic.itch.zone` content host: **verify the exact origins from the browser dev tools**), plus WebSocket origin check (`/api/ws` also enforces the list)
- [ ] Or ship the itch build as Solo-only to avoid CORS and UGC concerns

## Downloadable builds

- [ ] Windows, macOS, Linux builds from `apps/desktop`, channel names `win`, `mac`, `linux` so the itch app (butler) labels them
- [ ] Upload with butler (`butler push dir user/game:channel`), needs an API key; do not commit it
- [ ] macOS: Gatekeeper notarisation or an "unidentified developer" note on the page; Windows SmartScreen warning note (details in `BUILDING.md`)
- [ ] Include `license.txt`, `CREDITS.md` and third-party notices in each archive

## Content and policy

- [ ] Content warnings in the description: dark humour, death, cartoon violence, crude humour, simulated gambling with in-game money, user chat
- [ ] "Mature content" flag if the Vintage wording is included (see age sheet)
- [ ] AI disclosure: itch lets you declare generative AI use; the plan says AI tools were used for concept art and content drafts. Declare truthfully
- [ ] Open source: link `[REPOSITORY URL - OWNER TO FILL IN]`; licence line mentions the Proton SDK licence and the acknowledgement "This product includes software written by Seth A. Robinson (www.rtsoft.com)"
- [ ] Privacy policy and terms linked in the description (itch has no data form; the page should say if the build connects to a server)
- [ ] Contact `[CONTACT EMAIL - OWNER TO FILL IN]` visible
- [ ] Name rights confirmed (`licences-and-credits.md`)

## After upload

- [ ] Test download and browser play on a clean machine/profile
- [ ] Set the page to "Public" only after the above
