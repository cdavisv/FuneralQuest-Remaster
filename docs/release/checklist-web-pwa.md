# Checklist: web and PWA (the official server)

Source: `apps/server/README.md`, `.env.example`, `apps/client/README.md`. The web version is the primary release; everything else is a wrapper around it.

## Hosting

- [ ] Choose host: `[SERVER HOST / HOSTING PROVIDER - OWNER TO FILL IN]`, region `[HOSTING COUNTRY/REGION - OWNER TO FILL IN]` (affects privacy policy and international transfer wording)
- [ ] Domain and TLS certificate; reverse proxy (the plan suggests Caddy). The server speaks plain HTTP/WS only
- [ ] Run via Docker (`docker compose up -d --build`) or `pnpm --filter @fq/server build` then `start`
- [ ] `FQ_CLIENT_DIR` points at the built client so one origin serves site and API; the PWA must be served at the site root (sub-directory deployments unsupported)
- [ ] `FQ_TRUST_PROXY` set to the number of proxies in front. If wrong, rate limits and IP bans see the proxy's address (or can be spoofed)
- [ ] `FQ_ADMIN_TOKEN` set (24+ chars, `openssl rand -hex 32`), stored in a secret manager; never in the repo. Admin API at `/admin` should also be firewalled or proxied behind an allow-list (recommended, not enforced by the app)
- [ ] `FQ_LEGACY_CLIENT=false` (default) and Docker `FQ_INCLUDE_MUSEUM=0`: museum mode serves the original sounds, which are not licensed for the remaster
- [ ] `FQ_ALLOWED_ORIGINS` lists any other origin that talks to the API: the Tauri and Capacitor app origins, and itch.io if the HTML5 build goes online (exact origins in `BUILDING.md`: **unverified here**)
- [ ] `FQ_SIGNUP_ENABLED` / `FQ_GUEST_ENABLED` decisions (guests are throwaway accounts that can chat)
- [ ] `FQ_LOG_LEVEL`, log retention set on the host; confirm whether request logs contain client addresses
- [ ] `FQ_AUDIT_RETENTION_DAYS` decided (default 90; 0 = forever) and matches the privacy policy
- [ ] Backups of `FQ_DB_PATH` (SQLite WAL; use Litestream or a stop-the-world copy), restore drill done, backup retention noted for the privacy policy
- [ ] Persistent volume for `./data`
- [ ] Monitoring on `/health`
- [ ] Load test (plan: 10x expected peak) and security review (plan Phase 6)
- [ ] Argon2 settings kept at or above defaults (19 MiB, 2 passes)

## PWA quality

- [ ] HTTPS (required for installing)
- [ ] `pwa/manifest.webmanifest`: name, short name, icons 192/512 plus maskable, standalone, theme colour
- [ ] Service worker keeps the app for offline Solo; never touches `/api`, `/admin`, `/health`, `/museum` (client README)
- [ ] Lighthouse PWA/installability pass; test install on Chrome (desktop and Android), Edge, Safari "Add to Home Screen"
- [ ] Offline test: install, go offline, Solo career opens and saves
- [ ] Offline page links to `/?solo`
- [ ] Update flow: a new service worker version reaches users (test a deploy)
- [ ] Storage: Solo saves in IndexedDB can be cleared by the browser; the export-to-file feature is the backup, say so in help text

## Pages that must exist before launch

- [ ] Privacy policy at `[PRIVACY POLICY URL - OWNER TO FILL IN]` (from `privacy-policy-DRAFT.md`, reviewed)
- [ ] Terms at `[TERMS URL - OWNER TO FILL IN]`
- [ ] Credits page with the Proton acknowledgement (built from `CREDITS.md`; verified in client README)
- [ ] Contact / abuse address `[CONTACT EMAIL - OWNER TO FILL IN]`
- [ ] Account deletion page `[ACCOUNT DELETION URL - OWNER TO FILL IN]`: the server serves it at `/account/delete`; set `FQ_CONTACT_EMAIL` so it shows a real address
- [ ] A friendly "server unreachable, play Solo" state (already in the front door)

## Security headers and limits (verified in `http/app.ts`)

Already set: `x-content-type-options: nosniff`, `referrer-policy: no-referrer`, `x-frame-options: DENY`, `cache-control: no-store` by default, CORS closed unless allowed. **Not set** (add at the proxy, **unverified** whether the client works with them): `Content-Security-Policy`, `Strict-Transport-Security`, `Permissions-Policy`.

## Moderation readiness (see `ugc-and-moderation.md`)

- [x] Report, block, mute, moderator page and deletion shipped and tested (not yet on a device; see `ugc-and-moderation.md`)
- [ ] Someone owns the abuse inbox, the `/admin/` queue and the ban procedure
- [ ] The strict word list file is supplied (`FQ_BLOCKLIST_FILE`) and the engine's swear list covers the packs in use

## Launch

- [ ] Official Expanded and Classic towns exist with correct day length and time zone (defaults: `FQ_DEFAULT_TOWNS=both`)
- [ ] Season 1 start date set; announce
- [ ] Name rights resolved (`licences-and-credits.md`)
