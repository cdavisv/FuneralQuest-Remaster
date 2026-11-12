# Pending list

Things that are waiting on the owner, or on something outside the repository. Decisions already made are in [DECISIONS.md](DECISIONS.md); the state of the project is in [STATUS.md](STATUS.md).

## Waiting on the owner

| Item | Why it is needed | Blocks |
|---|---|---|
| **Project email address** for contact and abuse reports | It is shown on the public account-deletion page and in store listings. The owner's personal address will not be used. Set `FQ_CONTACT_EMAIL` on the server and fill the marked blanks in `docs/release/`. | A public server; any store submission |
| **App id** (a reverse-domain the owner controls, for example `com.example.funeralquest`) | The placeholder `org.funeralquest.remaster` must not be uploaded: an app id cannot change after the first upload. | Any store upload; signed desktop builds |
| **Written confirmation of the "Funeral Quest" name** from Robinson Technologies | The licence covers the code and art, not the title. The owner is handling the email. The owner chose the project's name, "FuneralQuest Remastered", on 2026-11-07 (decision 21) and went ahead with the GitHub Pages build; store listings still wait for the written answer. | Store listings |
| **Ask Robinson Technologies whether the original sounds and music may be used in the remaster** | Neither sound pack contains the original audio. The original README says the sounds and music are licensed for Funeral Quest only and are not covered by the source licence, so they have not been copied out of `legacy/`. They play today only in museum mode, inside the original Flash client. Worth asking in the same email as the name. | Using the original audio outside museum mode |
| **Send the listening notes**: on the listening page (`pnpm listen`, or `docs/audio/listen.html`), in the browser where the verdicts were entered, press **Export notes** and send the `funeral-quest-audio-notes.txt` it offers | The owner listened to the packs (2026-11-06) and said yes to sending the notes (2026-11-07), but the export has not arrived: the notes live in that browser's local storage and nowhere else (the only export in Downloads, `audio_choices.csv`, is from a different game). The tracks marked for redoing are regenerated once the file is here. | Regenerating the rejected tracks |
| **Look at the Remastered art** beside the originals (`assets/remastered/comparisons.png`) | The nine new portraits are graded "needs an artist". | 1.0 (not the beta) |
| **Playtest an Expanded season** with a few people | The simulator cannot say whether about 190 choices a day is fun, or how story arcs and news pace. | Calling Expanded balanced |
| **Lawyer review** of `docs/release/privacy-policy-DRAFT.md` and `terms-of-service-DRAFT.md` | They are drafts with blanks. | A public server; any store submission |
| **Store accounts and signing** (Apple Developer, Google Play, Steamworks, code-signing certificates) | Needed to submit; installers are unsigned until then. | Store releases |
| **Decide who answers player reports** and how fast | Both mobile stores expect reports handled within about a day. | Online play on mobile |

## Waiting on something else

| Item | Waiting on |
|---|---|
| Run the solo-only Android app on a device (the debug APK is built and its contents checked, nothing more); build iOS, Windows and macOS | Hardware, Xcode, and CI runs with signing set up |
| Expanded balance: since round 19 (the eight new places) the tycoon (3.38x, +6.5% of its towns' BP) and the necromancer (2.33x) win more than twice their share, and the Soft Touch, saboteur, saint, organiser and scholar less than a third (their BP within 1.7% of the town mean, except the saboteur at -8.7%). Round 20 measured why (the patrol and Mourne & Sons' free hold, not money) and found no number of the places that reaches the tycoon | Playtesting, and the owner's decisions on the proposals in `docs/balance/expanded-baseline.md`: engine logic for the hold (a price or a cooldown) and for the patrol (a price that grows with the buyer's BP, or a nightly limit), the rich parlors' unspendable money (`expanded-rules.md` 28), judging by mean place and BP instead of win share, the Memorial Garden's return, shorter days |
| Replace the nine new portraits | An illustrator |
| Online play on mobile (the first release is solo-only, decision 11): restore `INTERNET` and the `funeralquest://` link in the Android manifest, build with `FQ_SOLO_ONLY=0`, and do everything the store checklists mark "applies again when online play is added" | The owner's decision to add it, a moderator and a contact address |
