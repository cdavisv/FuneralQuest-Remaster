# Pending list

Things that are waiting on the owner, or on something outside the repository. Decisions already made are in [DECISIONS.md](DECISIONS.md); the state of the project is in [STATUS.md](STATUS.md).

## Waiting on the owner

| Item | Why it is needed | Blocks |
|---|---|---|
| **Project email address** for contact and abuse reports | It is shown on the public account-deletion page and in store listings. The owner's personal address will not be used. Set `FQ_CONTACT_EMAIL` on the server and fill the marked blanks in `docs/release/`. | A public server; any store submission |
| **App id** (a reverse-domain the owner controls, for example `com.example.funeralquest`) | The placeholder `org.funeralquest.remaster` must not be uploaded: an app id cannot change after the first upload. | Any store upload; signed desktop builds |
| **Written confirmation of the "Funeral Quest" name** from Robinson Technologies | The licence covers the code and art, not the title. The owner is handling the email. | Store listings; the GitHub Pages build |
| **Ask Robinson Technologies whether the original sounds and music may be used in the remaster** | Neither sound pack contains the original audio. The original README says the sounds and music are licensed for Funeral Quest only and are not covered by the source licence, so they have not been copied out of `legacy/`. They play today only in museum mode, inside the original Flash client. Worth asking in the same email as the name. | Using the original audio outside museum mode |
| **Listen to both sound packs** and send back the notes (`pnpm listen`, then Export notes) | Nobody has listened to either pack in full. Decides whether Studio becomes the default and which tracks to redo. | Choosing the default sound pack |
| **Confirm the ElevenLabs plan's terms** allow the Studio pack and the voice pack to be distributed in a public repository and in store builds | Their licence files say only that the terms are those of the owner's plan. | Making Studio the default; shipping either pack in a store build |
| **Docker group**: run `sudo usermod -aG docker $USER`, then log out and back in | The server's Docker image has never been built or run. | Verifying `docker compose up` |
| **Look at the Remastered art** beside the originals (`assets/remastered/comparisons.png`) | The nine new portraits are graded "needs an artist". | 1.0 (not the beta) |
| **Playtest an Expanded season** with a few people | The simulator cannot say whether about 190 choices a day is fun, or how story arcs and news pace. | Calling Expanded balanced |
| **Lawyer review** of `docs/release/privacy-policy-DRAFT.md` and `terms-of-service-DRAFT.md` | They are drafts with blanks. | A public server; any store submission |
| **Store accounts and signing** (Apple Developer, Google Play, Steamworks, code-signing certificates) | Needed to submit; installers are unsigned until then. | Store releases |
| **Decide who answers player reports** and how fast | Both mobile stores expect reports handled within about a day. | Online play on mobile |

## Waiting on something else

| Item | Waiting on |
|---|---|
| Publish the solo-only web build on GitHub Pages (the workflow exists and is started by hand) | The name confirmation above |
| Build and run the Docker image | The docker group change above |
| Run the Android app on a device; build iOS, Windows and macOS | Hardware, Xcode, and CI runs with signing set up |
| Expanded balance: two play styles still win more than twice their share, three less than a third | Playtesting, and a decision on the proposals in `docs/balance/expanded-baseline.md` that change how the game feels |
| Replace the nine new portraits | An illustrator |
