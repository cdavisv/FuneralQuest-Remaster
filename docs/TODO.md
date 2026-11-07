# Pending list

Things that are waiting on the owner, or on something outside the repository. Decisions already made are in [DECISIONS.md](DECISIONS.md); the state of the project is in [STATUS.md](STATUS.md).

## Waiting on the owner

| Item | Why it is needed | Blocks |
|---|---|---|
| **Choose where alpha feedback goes**: GitHub Issues (enable them), a Discord, or the project email | The in-game "Send feedback" dialog (Settings and the front door) produces a prefilled report for the player to copy, and names its destination as the marked blank `[FEEDBACK DESTINATION - OWNER TO FILL IN]` because GitHub Issues are switched off for the repository. Once chosen, set the repository variable `FQ_FEEDBACK_DESTINATION` (read by `.github/workflows/release.yml`; locally `VITE_FEEDBACK_DESTINATION`) to the text players should see, for example `https://github.com/<owner>/<repo>/issues/new` or an email address, and update the README's "Report a bug" section. | Telling alpha testers where to send reports; docs/ALPHA.md row A7 is only fully closed with it |
| **Project email address** for contact and abuse reports | It is shown on the public account-deletion page and in store listings. The owner's personal address will not be used. Set `FQ_CONTACT_EMAIL` on the server and fill the marked blanks in `docs/release/`. | A public server; any store submission |
| **App id** (a reverse-domain the owner controls, for example `com.example.funeralquest`) | The placeholder `org.funeralquest.remaster` must not be uploaded: an app id cannot change after the first upload. | Any store upload; signed desktop builds |
| **Written confirmation of the "Funeral Quest" name** from Robinson Technologies | The licence covers the code and art, not the title. The owner is handling the email. | Store listings; the GitHub Pages build |
| **Ask Robinson Technologies whether the original sounds and music may be used in the remaster** | Neither sound pack contains the original audio. The original README says the sounds and music are licensed for Funeral Quest only and are not covered by the source licence, so they have not been copied out of `legacy/`. They play today only in museum mode, inside the original Flash client. Worth asking in the same email as the name. | Using the original audio outside museum mode |
| **Listen to both sound packs** and send back the notes (`pnpm listen`, then Export notes) | Nobody has listened to either pack in full. Decides whether Studio becomes the default and which tracks to redo. | Choosing the default sound pack |
| **Confirm the ElevenLabs plan's terms** allow the Studio pack and the voice pack to be distributed in a public repository and in store builds | Their licence files say only that the terms are those of the owner's plan. | Making Studio the default; shipping either pack in a store build |
| **Tag and publish the alpha release** (when the checklist in `docs/ALPHA.md` allows): set the version in the root `package.json`, push a tag `v<version>` (for example `v0.1.0-alpha.1`), let `.github/workflows/release.yml` run, read the draft pre-release it makes, check the files against `SHA256SUMS`, then publish it by hand | The workflow has never run on GitHub (it was dry-run locally: web bundles, server tarball, Linux desktop, Android APKs); the first run may need a runner label or an action version adjusted | Alpha testers getting builds |
| **Docker group**: run `sudo usermod -aG docker $USER`, then log out and back in | The server's Docker image has never been built or run. | Verifying `docker compose up` |
| **Look at the Remastered art** beside the originals (`assets/remastered/comparisons.png`) | The nine new portraits are graded "needs an artist". | 1.0 (not the beta) |
| **Playtest an Expanded season** with a few people | The simulator cannot say whether about 190 choices a day is fun, or how story arcs and news pace. | Calling Expanded balanced |
| **Lawyer review** of `docs/release/privacy-policy-DRAFT.md` and `terms-of-service-DRAFT.md` | They are drafts with blanks. | A public server; any store submission |
| **Store accounts and signing** (Apple Developer, Google Play, Steamworks, code-signing certificates) | Needed to submit; installers are unsigned until then. | Store releases |
| **Decide who answers player reports** and how fast | Both mobile stores expect reports handled within about a day. | Online play on mobile |

## Waiting on something else

| Item | Waiting on |
|---|---|
| **Publish the solo-only web build on GitHub Pages.** The workflow `.github/workflows/pages.yml` exists, is started by hand only, and has not been run. The owner's steps: (1) once the name is confirmed in writing, enable Pages in the repository's settings (Settings, Pages, Source: GitHub Actions); (2) run the workflow (Actions, "Pages (solo-only web build)", Run workflow). Details in [release/checklist-web-pwa.md](release/checklist-web-pwa.md) | The name confirmation above |
| Build and run the Docker image (still unbuilt: this account cannot reach the Docker daemon) | The docker group change above |
| Run the solo-only Android app on a device (the debug APK is built and its contents checked, nothing more); build iOS, Windows and macOS | Hardware, Xcode, and CI runs with signing set up |
| Expanded balance: two play styles still win more than twice their share, three less than a third | Playtesting, and a decision on the proposals in `docs/balance/expanded-baseline.md` that change how the game feels |
| Replace the nine new portraits | An illustrator |
| Online play on mobile (the first release is solo-only, decision 11): restore `INTERNET` and the `funeralquest://` link in the Android manifest, build with `FQ_SOLO_ONLY=0`, and do everything the store checklists mark "applies again when online play is added" | The owner's decision to add it, a moderator and a contact address |
| Remove the stale `NOT_IN_PORT` entry for `funeral.cpp:191` in `tools/oracle/src/textAudit.ts` (the museum banner is now the original's) | Whoever next works in `tools/oracle` |
