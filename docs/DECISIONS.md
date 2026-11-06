# Decisions needed from the owner

Each item is a yes/no question with a recommendation. Fill in **Answer** and, if you like, **Notes**. Nothing here blocks current development; each one blocks the thing named in its "Blocks" line.

## Content

### 1. Approve the 21 Classic text edits?
- **Decided 2026-11-06: No.** Owner's rule: original content is kept exactly as it was (dialog, game content and behaviour, visuals); nothing original is censored or altered on grounds of taste or modern ethics. The edits are removed, the Classic pack is the untouched original text, and Expanded may add but never replace original material. The rule is recorded in `CLAUDE.md`.

### 1a. Keep the change that stopped the customer generator producing one of the original's relationship outcomes?
- **Decided 2026-11-06: No.** Same rule. The original relationship table is restored as the default and the switch is removed.

### 1b. Keep the Remastered art pack's altered copy of one original portrait (a real band's logo on a shirt replaced with an invented one)?
- **Decided by the same rule: No.** The override has been removed, so the original portrait shows under every art pack. One note for you, not a recommendation to change it: a real band's logo is a trademark, which is a legal question, not an ethical one. If you ever want it handled, that is your call to raise.

### 2 and 3. Replace any of the eight flagged lines newly written for Expanded?
- **Decided 2026-11-06: No, keep all eight as written.** The alternative wordings have been removed from `packages/content/EDITS.md`.

### 3a. Do the gameplay bug and exploit fixes stay?
- **Decided 2026-11-06: Yes.** The owner confirmed that fixes such as the hearse turn exploit and disconnecting to escape a lost battle stay, behind flags, and that a town can run with all of them off. They are a separate matter from the rule about original content.

### 3b. In museum mode, show the original server's log-on banner ("FQServer 1.0. Copyright 2001-2011 ...") exactly as the original did?
- **Recommend:** Yes, followed by a second line naming the remaster engine
- **Why:** It is original text the original client displays, and your rule is to keep original content as it was. Today the bridge shows its own line in its place. The second line avoids implying that the remaster is the original FQServer program.
- **Answer:**
- **Notes:**

### 4. Keep the Di-Mart story arc's test at 70 sales per player over six days?
- **Recommend:** Yes
- **Why:** The first value (10) was met on day one by every town. 70 is about 12 a day, a real test.
- **Answer:**
- **Notes:**

## Rules

### 5. Keep "no parlor is deleted for having no sales" in solo mode?
- **Recommend:** Yes
- **Why:** The original rule silently ended a solo career around day 6 for a player who had not sold anything.
- **Answer:**
- **Notes:**

### 6. Let the balance agent keep changing Expanded numbers and small rules without your sign-off on each round?
- **Recommend:** Yes
- **Why:** Every round is logged in `docs/balance/expanded-tuning-log.md` and measured by the simulator; Classic is locked and cannot change.
- **Answer:**
- **Notes:**

## Online play and moderation

### 7. Should guests (no account) be allowed to chat, send letters and post announcements?
- **Recommend:** No
- **Why:** Guests cannot be muted or banned in any lasting way. Let them play and read, and require a free account for free text.
- **Blocks:** opening a public server.
- **Answer:**
- **Notes:**

### 8. Set the minimum age for online play to 18?
- **Recommend:** Yes
- **Why:** The humour earns a mature rating either way, and 18 avoids the extra privacy rules that apply to minors. Solo play needs no age gate.
- **Blocks:** the conduct notice text and store age-rating forms.
- **Answer:**
- **Notes:**

### 9. Accept the default moderation thresholds and retention periods?
- **Recommend:** Yes
- **Why:** Auto-mute after 3 different accounts report someone within 60 minutes, for 24 hours pending review; audit log kept 90 days; closed reports kept 180 days. All are settings you can change later.
- **Blocks:** the privacy policy draft.
- **Answer:**
- **Notes:**

### 10. Use your personal email as the public contact and abuse address?
- **Recommend:** No
- **Why:** It is published on the account-deletion page and in store listings. Create a project address and give it to me in Notes.
- **Blocks:** store submissions and a public server.
- **Answer:**
- **Notes:**

## Release

### 11. Make the first mobile release solo-only?
- **Recommend:** Yes
- **Why:** Both mobile stores review chat and mail features closely and expect reports answered within about a day. Solo-only ships sooner; online can follow once someone is watching the report queue.
- **Answer:**
- **Notes:**

### 12. Keep `org.funeralquest.remaster` as the permanent app id?
- **Recommend:** No
- **Why:** An app id should be a domain you control, and it cannot change after the first store upload. Put a reverse-domain you own in Notes (for example `com.yourdomain.funeralquest`).
- **Blocks:** any store upload.
- **Answer:**
- **Notes:**

### 13. Hold all store listings until Seth Robinson confirms the "Funeral Quest" name in writing?
- **Recommend:** Yes
- **Why:** The licence covers the code and art, not the title. The public GitHub fork is fine in the meantime.
- **Answer:**
- **Notes:**

### 14. Publish a free solo-only web build on GitHub Pages from `master`?
- **Recommend:** Yes, after item 13 is settled
- **Why:** It is the fastest way to get playtesters, costs nothing, and needs no server. It makes the game publicly playable under the current name, which is why it waits on item 13.
- **Answer:**
- **Notes:**

### 15. Ship a beta with the nine new portraits that need an illustrator?
- **Recommend:** Yes for beta, No for 1.0
- **Why:** They are competent but do not match Akiko Robinson's caricatures. They only appear in Expanded.
- **Answer:**
- **Notes:**

### 15a. Make the ElevenLabs "Studio" sound pack the default once you have listened to it?
- **Recommend:** Decide after listening
- **Why:** A second sound pack has been generated with your ElevenLabs account (`assets/audio-studio/`, 19,801 credits of the 120,000 budget cap) and can be picked under Settings, Sound pack. The code-synthesised "Synth" pack stays the default and the fully open-source fallback. `docs/audio/listen.html` plays both side by side with a notes field per track. A build bundles Studio only when asked (`FQ_AUDIO_PACKS=synth,studio`).
- **Also needed from you:** confirm that your ElevenLabs plan's terms allow these files to be distributed in a public repository and in store builds. I cannot verify that, and the pack's licence file says so.
- **Answer:**
- **Notes:**

### 15b. Add spoken voices (for example town characters greeting you) using ElevenLabs?
- **Recommend:** No, not now
- **Why:** The original game has no recorded voice, so this would be a new feature for Expanded only, and it adds download size. Easy to add later if you want it; say which characters.
- **Answer:**
- **Notes:**

### 16. Turn sound on by default before a person has listened to the soundtrack?
- **Recommend:** No
- **Why:** It is verified by measurement only. Keep the "Sound on" button opt-in until you have listened; tell me which tracks to redo.
- **Answer:**
- **Notes:**

## Licensing and infrastructure

### 17. License the new remaster code under the same Proton SDK licence as the original, new art and audio under CC BY 4.0?
- **Recommend:** Yes
- **Why:** It matches the original author's stated wish that improvements stay usable upstream, and it is what the plan specified.
- **Answer:**
- **Notes:**

### 18. Add your user to the `docker` group so the server image can be built and tested here?
- **Recommend:** Yes
- **Why:** The Docker image has never been built. I cannot change system groups. Run `sudo usermod -aG docker $USER`, then log out and back in.
- **Answer:**
- **Notes:**

### 19. Allow auto-merge on the GitHub repository?
- **Recommend:** No
- **Why:** Not needed. I merge each pull request myself once its checks are green.
- **Answer:**
- **Notes:**

### 20. Open a pull request against Seth Robinson's original repository?
- **Recommend:** No
- **Why:** The remaster is a different project that keeps his code under `legacy/`. A link from his README would be his call after you have spoken.
- **Answer:**
- **Notes:**

## Things only a person can do (not yes/no)

- Listen to the soundtrack and effects (`assets/audio/`) and list what to redo.
- Look at the Remastered art beside the originals (`assets/remastered/comparisons.png`).
- Play an Expanded season with a few people; the simulator cannot say whether about 190 choices a day is fun.
- Have a lawyer review `docs/release/privacy-policy-DRAFT.md` and `terms-of-service-DRAFT.md`.
- Create the Apple, Google Play and Steam accounts and signing certificates when you are ready to submit.
