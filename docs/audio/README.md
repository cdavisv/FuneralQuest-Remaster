# Sound packs: Synth and Studio

The game has two sets of audio files with the same track ids.

| Pack | Where | Made by | Licence |
|---|---|---|---|
| **Synth** (default) | `assets/audio/` | `packages/audio`'s own synthesiser, sequencer and effect generators (`pnpm --filter @fq/audio run render`) | the project's licence |
| **Studio** | `assets/audio-studio/` | ElevenLabs generations from text prompts written for this project, post-processed by `packages/audio` (`pnpm --filter @fq/audio run studio`) | not settled: see `assets/audio-studio/LICENSES.md` |

The player picks one in Settings, "Sound pack". Any id the picked pack lacks plays from Synth (`resolveTrack` in `packages/audio/src/packs.ts`), track by track, so the Studio pack may be partial. The default stays Synth until the owner has listened and settled the Studio pack's licence. The nine UI sounds (clicks, page turns) are synthesised on the page in both packs.

To hear both side by side and leave notes, open [`listen.html`](listen.html) (below).

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

`docs/audio/listen.html` is a static page (no build, no server needed). Open it straight from disk (`file:///<repository>/docs/audio/listen.html`, tested in Chromium and Firefox) or through the client dev server at `http://localhost:5173/@fs/<absolute repository path>/docs/audio/listen.html`. Each row has the id, title and where the track plays, the Synth and Studio players (loops repeat between their loop points), the Studio prompt and any check flags, a verdict (keep Studio, keep Synth, redo, either) and a note. Notes are kept in the browser's local storage; "Export notes" shows them as text and offers a download.
