# Sound packs: Synth and Studio

The game has two sets of audio files with the same track ids.

| Pack | Where | Made by | Licence |
|---|---|---|---|
| **Synth** (default) | `assets/audio/` | `packages/audio`'s own synthesiser, sequencer and effect generators (`pnpm --filter @fq/audio run render`) | the project's licence |
| **Studio** | `assets/audio-studio/` | ElevenLabs generations from text prompts written for this project, post-processed by `packages/audio` (`pnpm --filter @fq/audio run studio`) | not settled: see `assets/audio-studio/LICENSES.md` |

The player picks one in Settings, "Sound pack". Any id the picked pack lacks plays from Synth (`resolveTrack` in `packages/audio/src/packs.ts`), track by track, so the Studio pack may be partial. The default stays Synth until the owner has listened and settled the Studio pack's licence. The nine UI sounds (clicks, page turns) are synthesised on the page in both packs.

To hear both side by side and leave notes, open [`listen.html`](listen.html) (below).

**Neither pack contains the original 2001 game's audio.** The original sounds and music are licensed for the original game only; the game plays them only in museum mode, inside the original client. The listening page can also play them for comparison (the "Original (2001)" column, below), from a copy extracted on the owner's own machine that is never committed or distributed.

## The Studio pack, end to end

1. **Brief.** `packages/audio/scripts/studioBrief.ts` holds every prompt, the model and its parameters, where the track plays, and what the checks expect (tempo, metre, key, loop length; for effects the onset count and longest length). Music uses `eleven_music_v2_5` (instrumental), ambience and effects `eleven_text_to_sound_v2` (ambience with its `loop` option).
2. **Generation.** One take per music piece, two per effect and ambience, run on the owner's account through the ElevenLabs flow "Funeral Quest Studio audio pack" (flow id in `assets/audio-studio/takes.json`). Every generation is listed in `takes.json` with its id, session, node, credits and date; the take chosen and why (measured reasons: onset counts, envelope, seam, spectrogram shape) are recorded beside it. The downloaded MP3s are kept outside the repository, in `~/.cache/fq-audio-studio/source/<id>__<generationId>.mp3`; each one can also be fetched again from the owner's ElevenLabs account by its generation id.
3. **Post-production** (`scripts/studio.ts`, the same delivery code as the Synth render, `scripts/pipeline.ts`):
   - **Music loops** (`scripts/studioLoop.ts`): spectral-flux onsets; tempo by autocorrelation with the brief's tempo as a prior; a dynamic-programming beat tracker; bar lines at the beat phase with the most low-frequency attack. Of all pairs of bar lines about the Synth piece's length apart (after the first bar, before the recording starts its ending), the pair whose surroundings sound most alike (chroma and band energies a bar either side) is the loop; the bar of music that follows the end is crossfaded into the head over one beat (equal power), so the jump from the end back to the start lands on what the end was leading to.
   - **Ambience**: kept whole when the model's own loop seam is continuous; otherwise the last second is crossfaded into the head. The clock and the heart monitor have a pulse, so they are cut on it like music.
   - **One-shots**: lead-in trimmed, cut to the brief's longest length, a short fade at both ends (generated effects often stop mid-sound at the asked length).
   - Mastered to the Synth targets (music and stingers -16 LUFS integrated, ambience -26 LUFS, effects -16 LUFS momentary; sample-peak ceilings -3, -6 and -2 dBFS), re-mastered lower if the decoded file comes within 1 dB of full scale or the Ogg file's true peak passes -1 dBTP; encoded to Ogg Opus and AAC at the Synth bitrates; loop files laid out with a lead-in and overrun exactly like Synth's, and the seam measured after decoding with the client's own repair (`loopCheck`).
4. **Checks** (written per track into `assets/audio-studio/sources.json`): duration, integrated and momentary loudness, true peak, spectral centroid, tempo (tracked and estimated), key estimate, longest near-silence, leading silence, DC, clipped samples, the most persistent narrowband partial, the loop seam, and for one-shots the onset count against the brief and an envelope description. Music was also screened for voices (below).
5. **Ledger** (`assets/audio-studio/LICENSES.md`), manifest (`manifest.json`, the Synth schema) and the listening page (`pnpm --filter @fq/audio run listen-page`).

To regenerate one track: change its prompt in the brief, generate it in the flow, add the take to `takes.json` (mark it chosen), put the MP3 in the source cache, and run `pnpm --filter @fq/audio run studio -- --only <id>`.

### Speech screen

The music model can return singing or speech. Every chosen music take was run through faster-whisper (base model, CPU) with its Silero voice-activity filter; none produced a speech segment. As a positive control, the screen was run on a spoken sample mixed into the Studio main theme at a similar level, and it transcribed the words. A human listen is still the final word.

## The negotiation in the Studio pack

The Synth pack's negotiation is one piece rendered as three layers that add up (calm always on; uneasy and angry fade in with the customer's mood). Generated pieces cannot be layered like that: three separate generations are three different performances, and summing them is a mess.

The Studio pack's negotiation is therefore **three whole pieces**, generated from three prompts that share key (E minor), tempo (120 bpm), metre and instrumentation and differ in intensity. Each was time-stretched (pitch kept, `rubberband`) from its tracked tempo to exactly 120 bpm and cut to exactly 16 bars (32.000 s) starting on a bar line, so the three loops have the same length and their bar lines coincide when they are started together. The manifest marks the track `"layerMode": "crossfade"`. The client starts all three stems in step, as it does for Synth, but with the gains from `stemGains`: the same mood layers become weights that sum to one (calm, then uneasy, then angry), as equal-power gains, so one piece is heard at a time; and a change of piece is scheduled on the next bar line (`nextBarTime`) and crossfaded over the usual 1.5 s. Synth tracks have no `layerMode` and play exactly as before.

What this does not give: the melodies and chord changes of the three pieces are not the same, so a switch mid-phrase is a change of tune on a bar line, not an intensification of one tune. Whether that sounds right is for a listener.

## Pack plumbing

- `@fq/audio` exports `PACK_IDS`, `PACKS`, `DEFAULT_PACK` ("synth"), `isPackId`, `packChain`, `resolveTrack`, `stemGains` and `nextBarTime` (`src/packs.ts`).
- The client's audio library (`apps/client/src/audio/library.ts`) loads the Synth manifest from `/audio` and, when Studio is picked, the Studio manifest from `/audio-studio` (or `VITE_AUDIO_STUDIO_BASE`), and resolves each id through the chain. The backend (`webAudioBackend.ts`) applies the layer mode, restarts the music and ambience when the pack changes, and reports the pack each loaded id came from in `window.__fqAudio.debug().sources`. The manager (`AudioManager.ts`) passes the setting through (`setPack`); the setting is `soundPack` in `src/settings/settings.tsx`, shown in Settings as "Sound pack".
- `vite dev` serves both packs from `assets/`. `vite build` copies the Synth pack as before; it copies the Studio pack to `<outDir>/audio-studio` only with `FQ_AUDIO_PACKS=synth,studio` (without it, picking Studio plays Synth). The provenance sidecars are not copied. The service worker's offline audio fill covers the Synth pack only.

## The listening page

`docs/audio/listen.html` is a static page with a Play button and the browser's own controls for every track in both packs, the original 2001 sound that did the same job where there is one, every original 2001 sound, and every character voice clip. Run `pnpm listen` in the repository and open the address it prints (`http://127.0.0.1:4780/`); the small server it starts serves only this page and the two sound packs. Opening the file directly in a web browser window also works. A preview that cannot read the files next to the page (some editors' built-in viewers) shows a red notice saying so.

## The "Original, remastered" pack (in preparation)

Pack id `remaster`, shown as "Original, remastered": new audio made to resemble each of the 40 sounds of the 2001 game (35 distinct recordings), at modern fidelity. It is not the 2001 recordings and replaces neither Synth nor Studio.

1. **Describe** (`packages/audio/scripts/remasterDescribe.py`, run locally in a virtualenv with librosa and PANNs): every original extracted by `pnpm listen:originals` is measured on this machine only (length, how the game looped it, tempo and beats per loop, key and pitch centre, spectrum and its shape below 5 kHz, loudness, envelope, onsets) and tagged by a local AudioSet classifier. The results, with the source file names from the author's Flash projects, are in `assets/audio-remaster/brief.json`. No original audio is uploaded or used as a generation input.
2. **Brief** (`packages/audio/scripts/remasterBrief.ts`, `pnpm --filter @fq/audio run remaster-brief`): a description, the prompt, model, parameters, delivered length and credit estimate for each remake, merged into `brief.json`. Prompts give kind, instruments, tempo, key, mood and length, never the original's notes. The five music loops are 2.00 s (one bar) or 4.00 s (two bars) at exactly 120 bpm.
3. **Not generated yet**: the ElevenLabs connection was removed from the session before the pilot. `manifest.json` lists nothing, so the pack plays Synth throughout; the listening page shows "not generated yet" with each prompt in its "Original, remastered" column.

The client offers it as the third "Sound pack" choice; the build copies it only with `FQ_AUDIO_PACKS=…,remaster`.

### The Original (2001) column

`pnpm listen:originals` (`packages/audio/scripts/originals.ts`) reads the original Flash files (`legacy/dist/public/flash/**/*.swf`), writes every DefineSound's MP3 data unchanged (the frames as stored, no re-encoding, normalising or trimming) and an `index.json` to `~/.cache/fq-audio-original/` (or `FQ_AUDIO_ORIGINAL_DIR`), and regenerates the page. 40 sounds in 35 files, all MP3, 11 kHz mono; none failed.

- **The Original column plays the 2001 game's own audio, extracted locally for the owner's comparison only.** It is not part of either sound pack, it is never committed or distributed, and neither Synth nor Studio contains it. The files live outside the repository (CLAUDE.md: original sounds must not be copied into the new tree); `assets/audio-original/` is in `.gitignore` as well in case anyone points the output there, and `packages/audio/test/originals.test.ts` fails if a file there is tracked by git or named by a manifest, a build file, the service worker or a container file. No build, bundle, service-worker list, Docker context or wrapper reads either place.
- `pnpm listen` serves them at `/assets/audio-original/` (with `audio/mpeg`). Opened from disk, or on a machine that has not run the extraction, the Original players are replaced by a note saying to run `pnpm listen:originals`.
- Each original sits beside the new track that does its job, from the cue map (`src/cues.ts`) and the sound inventory (`docs/reference/sound-inventory.md`); the pairing table is `ORIGINAL_FOR` in `scripts/listen.ts`. 38 of the 40 have a counterpart (the newspaper's paper rustle is synthesised live as `ui-page`, and welcome.swf's sound 46 has no known use). A section lists all 40, grouped by SWF, with duration and loop count. With "Loop" ticked an original repeats as many times as the 2001 game repeated it; 999 or more repeats continuously.

## Character voices

Some of the town's characters speak their lines aloud (owner's decision 15b). Everything is in `assets/voice/`:

| File | What |
|---|---|
| `lines.json` | every line a known character speaks in the game's own text (`pnpm --filter @fq/audio run voice-inventory`, `scripts/voiceInventory.ts`), with speaker, place, exact text, placeholders, rulesets, sources, and what would be spoken or why not |
| `cast.json` | who voices whom (ElevenLabs library voice id and name, delivery tag, why) |
| `takes.json` | every generation: line key, generation id, session, flow node, voice, model, the exact prompt, credits, batch |
| `sources.json` | the build's record of every take: transcript, word check, measurements, verdict; the batches and credits; lines generated but not yet downloaded |
| `manifest.json` | what the client reads: per clip the key, speaker, exact text, part, rulesets, files, duration |
| `LICENSES.md` | the ledger: origin, what is not settled about the licence, cost |
| `<character>/<key>.ogg`, `.m4a` | the clips: Ogg Opus 32 kbit/s mono and AAC 40 kbit/s mono (the bitrates the sound packs use for mono one-shots), normalised to -16 LUFS integrated, sample peaks limited at -1.5 dBFS, encoded true peak under -1 dBTP |

**Which lines.** A line is a quotation attributed to a known character, by a white speaker tag (`` `wElijah: `$"..." ``) or, untagged, by narration in the same paragraph that names exactly one character ("...," Mr Yang tells you). `spokenLines` in `packages/audio/src/voice.ts` finds them; the build and the client use the same function. A line with a placeholder (the player's name, a price) is voiced only when the placeholder sits in its first or last sentence and the rest is fixed text; the clip then speaks the fixed sentences ("Hi {player}. I don't recall you having a pick-up today." speaks the second sentence). Newspaper quotes, the Expanded starter content (shown only when a pack has no Expanded section) and the county clerk's line are listed but not voiced. Customers are not voiced. Original 2001 lines are spoken word for word as written.

**Keys.** `voiceKey(character, text)`: the character id and a 64-bit FNV-1a hash of the words (whitespace normalised, case and punctuation kept). The client looks a line up whole, then without its first sentence, then without its last.

**Checks** (`pnpm --filter @fq/audio run voice`, `scripts/voiceBuild.ts`): each take is transcribed back with a local speech-to-text model (`scripts/voiceTranscribe.py`, faster-whisper "small", no prompt) and its words compared with the line after reducing both to letters and digits (`scripts/voiceCheck.ts`); any changed, added or missing word rejects it. A few game names a transcriber cannot spell from sound ("Bury Points" is heard as "berry points", "Di-Mart", the bingo pun "B-4") are mapped on the transcript only, and those clips are marked for a listener. Then: leading and trailing silence trimmed, speaking rate checked (1.2 to 4.8 words a second), clipped samples counted, the noise floor around the speech checked (under -50 dBFS: no music or noise under the voice), loudness normalised, encoded, and read back with ffmpeg's EBU R128 meter.

**In the game.** Settings, Sound: "Character voices" (on or off) and "Voices volume". The default is on in Expanded towns and Solo careers and off in Classic towns, since the original game had no recorded voices; museum mode is the original client and never plays them. The voice plays once as the text appears, on its own bus through the master (so mute and the 2001 radio filter apply), ducking the music by about 6 dB; moving to another screen cuts it off with a 40 ms fade; the same screen updated (a chat line, a re-render) does not replay it; one voice at a time, a screen's lines in order. `window.__fqVoice.debug()` reports what is playing, what was cut, the voice bus level and the duck. Code: `apps/client/src/audio/voiceLines.ts`, `voicePlayer.ts`, `voiceHook.ts`.

**Delivery.** `vite dev` serves `assets/voice` at `/voice`. `vite build` copies it to `<outDir>/voice` only with `FQ_AUDIO_PACKS` naming `voice` (or `VITE_VOICE_BASE` hosts it), because its licence is not settled; `lines.json`, `cast.json`, `takes.json` and `sources.json` are not copied. Voice files are not in the service worker's install list or its background fill; the worker keeps each clip once it has been played, so only a player with voices on downloads any.

**Regenerating.** The source MP3s are kept outside the repository in `~/.cache/fq-voice/source/<key>__<generationId>.mp3`; each can be fetched again from the owner's ElevenLabs account by its generation id (flow "Funeral Quest character voices", id in `takes.json`). Add the take to `takes.json`, put the MP3 in the cache, run `pnpm --filter @fq/audio run voice`, then `pnpm --filter @fq/audio run listen-page`.
