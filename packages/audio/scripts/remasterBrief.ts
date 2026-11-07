/**
 * `pnpm --filter @fq/audio run remaster-brief`: the "Original, remastered" pack's brief. For each
 * distinct original 2001 sound (40 sounds, 35 distinct recordings: the three ceremony pictures,
 * the two ring pictures, the two desk clocks and the two scratch sounds share one file each), a
 * plain description built from the local measurements in assets/audio-remaster/brief.json
 * (written by scripts/remasterDescribe.py), the text prompt for ElevenLabs, the model and its
 * parameters, the length to deliver, and a credit estimate. Running it merges the description,
 * prompt and estimate into brief.json beside each sound's measurements, so every prompt can be
 * traced to the numbers it came from.
 *
 * Music uses the music model; ambience and effects the sound-effects model. The short music
 * loops (2 and 4 s) are generated at about 16 s at 120 bpm and cut to exactly one or two bars on a
 * bar line (the beat tracking and loop cutting of `studioLoop.ts`): the pilot tried the
 * sound-effects model's `loop` option first, and it returned seamless loops of the wrong length
 * (2.25 s for 2.00 s, 4.5 beats per cycle), which cannot be fitted to the original's bar without
 * changing the tempo. Ambience loops from that option are stretched (pitch kept) to the exact
 * length, which a texture tolerates. The two longer pieces (the title theme and the ceremony
 * organ) are generated a little long and cut to their own length with a fade.
 *
 * Rules the prompts keep: they describe the kind of sound, the instruments, the tempo, the key (for
 * music), the mood and the length; they never describe or transcribe the original's notes or
 * melody, and no original audio, or anything derived from its samples, is given to any service.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const MUSIC_MODEL = "eleven_music_v2_5";
export const SFX_MODEL = "eleven_text_to_sound_v2";

/** Estimate rates seen on the owner's account (credits per second of audio asked for, per take). */
const RATE = { music: 27.5, sfx: 11.1 } as const;

export interface RemasterEntry {
  /** Pack id of the remake (the primary original's file without .mp3, slashes as dashes). */
  id: string;
  /** Every original file this remake stands for (identical recordings share one remake). */
  originals: string[];
  /** Game track ids it serves when the pack is selected (empty: listening page only). */
  tracks: string[];
  kind: "music" | "stinger" | "ambience" | "sfx";
  /** What the original is, in words, from the measurements and the known context. */
  description: string;
  /** Where the description is unsure. */
  uncertain?: string;
  model: typeof MUSIC_MODEL | typeof SFX_MODEL;
  prompt: string;
  params: Record<string, number | boolean | string>;
  /** The length to deliver (the original's, from its sample count). */
  seconds: number;
  /** Looped by the 2001 game: deliver a seamless loop of exactly `seconds`. */
  loop: boolean;
  /** Music: tempo, metre and bar count of the loop, key asked for. */
  bpm?: number;
  beatsPerBar?: number;
  bars?: number;
  key?: string;
  /** Takes to generate (two for effects and ambience, one for music). */
  takes: number;
}

const music = (s: number) => ({
  duration_seconds: s,
  instrumental: true,
  lyrics_type: "instrumental",
});
const sfx = (s: number, loop = false, influence = 0.6) => ({
  duration_seconds: Math.max(0.5, Math.round(s * 100) / 100),
  prompt_influence: influence,
  loop,
});

export const REMASTER: RemasterEntry[] = [
  // --- music ------------------------------------------------------------------------------
  {
    id: "welcome-intro",
    originals: ["welcome/intro.mp3"],
    tracks: [],
    kind: "music",
    description:
      "The title-screen theme (source file fq_theme.wav), 20.08 s, played once. Tagged Music 0.65, Theme music 0.14, Orchestra 0.09. Very smooth, tonal spectrum (flatness 0.006, centroid about 1.1 kHz); one sustained arc from start to end (it does not fall 20 dB until 18.7 s); pitch centre about G#2 in the bass. Tempo estimate 81 bpm, weak; key estimate C major, weak (r 0.37).",
    uncertain: "Tempo and key are weak estimates on a piece with few clear attacks.",
    model: MUSIC_MODEL,
    prompt:
      "Instrumental orchestral title theme in C major at about 80 bpm, around twenty seconds long: a warm, slightly grand and wry opening for a small-town funeral parlor game, with strings and woodwinds over soft brass and a gentle bass, building through one broad phrase and resolving on a full final chord. Clean, full-bandwidth, modern orchestral recording, never horror.",
    params: music(24),
    seconds: 20.08,
    loop: false,
    bpm: 80,
    key: "C major",
    takes: 1,
  },
  {
    id: "welcome-map",
    originals: ["welcome/Map.mp3"],
    tracks: ["town"],
    kind: "music",
    description:
      "The town map music (country town.wav), a 4.00 s loop the game repeated 9999 times: 8 beats, two bars at 120 bpm (tracked 117.5). Tagged Music 0.72, Funny music 0.06, Mandolin 0.04. Busy (20 onsets in the loop), bright plucked texture over a bass around C2; key estimate C major (r 0.63).",
    model: MUSIC_MODEL,
    prompt:
      "Instrumental cheerful country hoedown loop in C major at exactly 120 bpm in 4/4: bright banjo and mandolin picking over a bouncing upright bass and light brushed snare, steady and busy, comic small-town feel. Keep the same two-bar groove the whole way through with no intro and no ending. Clean modern recording.",
    params: music(16),
    seconds: 4.0,
    loop: true,
    bpm: 120,
    beatsPerBar: 4,
    bars: 2,
    key: "C major",
    takes: 1,
  },
  {
    id: "music-music_fight",
    originals: ["music/music_fight/1.mp3"],
    tracks: ["battle"],
    kind: "music",
    description:
      "Fight music (fight loop.wav), a 2.00 s loop repeated 999 times: one bar of 4 beats at 120 bpm. Tagged Music 0.79, Electronic music 0.22, Drum machine 0.14, Electronica 0.12. Dark and bass-heavy (centroid 360 Hz, roll-off 630 Hz), pitch centre about B1; key estimate D minor, weak (r 0.31).",
    uncertain: "Key is a weak estimate; the loop is mostly drums and bass.",
    model: MUSIC_MODEL,
    prompt:
      "Instrumental driving electronic fight loop in D minor at exactly 120 bpm in 4/4: a punchy drum machine beat with a heavy, dark synth bass riff and a little tension in the pads, aggressive but slightly comic, video-game action. One bar repeated with no intro and no ending. Clean, full-bandwidth production.",
    params: music(16),
    seconds: 2.0,
    loop: true,
    bpm: 120,
    beatsPerBar: 4,
    bars: 1,
    key: "D minor",
    takes: 1,
  },
  {
    id: "music-music_sneak",
    originals: ["music/music_sneak/1.mp3"],
    tracks: ["sneak"],
    kind: "music",
    description:
      "Sneaking music (scary.wav), a 4.00 s loop repeated 999 times: 8 beats, two bars at 120 bpm (tracked 123). Quiet (-34 LUFS, the quietest music), sparse (6 onsets). Tagged Music 0.74, Timpani 0.10. Key estimate E major, weak (r 0.31); pitch centre about A2.",
    uncertain:
      "Key and instrumentation are weak estimates; the tagger hears timpani and little else.",
    model: MUSIC_MODEL,
    prompt:
      "Instrumental quiet suspense loop at exactly 120 bpm in 4/4, in E: soft timpani and low pizzicato strings tiptoeing with a few eerie high notes, sparse and creeping, a comic sneaking mood, never horror. Two bars repeated with no intro and no ending. Clean modern recording, low level.",
    params: music(16),
    seconds: 4.0,
    loop: true,
    bpm: 120,
    beatsPerBar: 4,
    bars: 2,
    key: "E major",
    takes: 1,
  },
  {
    id: "places-palors",
    originals: ["places/palors/5.mp3"],
    tracks: [],
    kind: "music",
    description:
      "Rival parlors picture (mystery tinkle loop.wav), a 2.00 s loop repeated 999 times: one bar at 120 bpm. Tagged Music 0.73, Ringtone 0.34: a tinkling, bell-like melodic figure; pitch centre about F#4; key estimate F# major (r 0.45).",
    model: MUSIC_MODEL,
    prompt:
      "Instrumental mysterious tinkling loop in F-sharp major at exactly 120 bpm in 4/4: a music box and celesta playing a light, curious figure over a soft pad, playful and a little spooky. One bar repeated with no intro and no ending. Clean, bright modern recording.",
    params: music(16),
    seconds: 2.0,
    loop: true,
    bpm: 120,
    beatsPerBar: 4,
    bars: 1,
    key: "F# major",
    takes: 1,
  },
  {
    id: "places-yangs",
    originals: ["places/yangs/6.mp3"],
    tracks: ["yangs"],
    kind: "music",
    description:
      "Yang's restaurant picture (yangs.wav), a 4.00 s loop repeated 999 times: 8 beats, two bars at 120 bpm (beats very regular, 3%). Tagged Zither 0.72, Pizzicato 0.39, Mandolin 0.10: a plucked zither-like string figure; key estimate F# minor (r 0.66), pitch centre about F#2.",
    model: MUSIC_MODEL,
    prompt:
      "Instrumental restaurant loop in F-sharp minor at exactly 120 bpm in 4/4: a plucked zither and pizzicato strings playing a light, flowing pattern over a soft low drone and a gentle hand drum, calm and pleasant. Two bars repeated with no intro and no ending. Clean modern recording.",
    params: music(16),
    seconds: 4.0,
    loop: true,
    bpm: 120,
    beatsPerBar: 4,
    bars: 2,
    key: "F# minor",
    takes: 1,
  },
  {
    id: "places-funeral-ceremony",
    originals: [
      "places/funeral-ceremony/2.mp3",
      "places/funeral-ceremony2/6.mp3",
      "background/background_church/2.mp3",
    ],
    tracks: [],
    kind: "music",
    description:
      "Funeral ceremony and church pictures (celemony.wav, one recording used three times), 10.96 s, played once. Tagged Music 0.54, Organ 0.26, Hammond organ 0.10: a church organ. Very tonal (flatness 0.011), warm (centroid 590 Hz); swells to its loudest at about 6 s and fades out; key estimate G major, strong (r 0.89); pitch centre D3. 7 onsets: slow chord changes.",
    model: MUSIC_MODEL,
    prompt:
      "Instrumental solemn church pipe organ in G major, slow, about eleven seconds: a few sustained hymn-like chords that swell gently to a fuller middle and fade away at the end, dignified and calm, in a small church. Solo organ only, clean modern recording.",
    params: music(14),
    seconds: 10.96,
    loop: false,
    key: "G major",
    takes: 1,
  },
  // --- ambience (seamless loops of the original's length) ------------------------------
  {
    id: "places-desk",
    originals: ["places/desk/12.mp3", "places/desk_enemy/8.mp3"],
    tracks: ["amb-clock"],
    kind: "ambience",
    description:
      "The desk clock (clock.wav), a 0.99 s loop repeated 200 times (both desks use the same recording): noisy clicks (flatness 0.46, roll-off 3.3 kHz), 3 onsets per loop, each click dying within 50 ms. Quiet (-38 LUFS). Tagger is unsure (Inside, small room 0.06).",
    uncertain:
      "The tagger does not name it; the source name (clock.wav), the picture and the click pattern do.",
    model: SFX_MODEL,
    prompt:
      "A small mechanical clock ticking, crisp dry clicks close up in a quiet room, steady and even.",
    params: sfx(0.99, true),
    seconds: 0.99,
    loop: true,
    takes: 2,
  },
  {
    id: "places-embalming-room",
    originals: ["places/embalming-room/3.mp3"],
    tracks: ["amb-bubbles"],
    kind: "ambience",
    description:
      "Embalming room (water_bubble.wav), a 2.03 s loop repeated 100 times: two bubbling gurgles per loop, louder late in the loop; warm (centroid 920 Hz). Tagged weakly (Sidetone 0.21, Echo 0.08).",
    uncertain: "Tags are weak; the source name says water bubbling.",
    model: SFX_MODEL,
    prompt:
      "Liquid bubbling and gurgling in a glass container, slow wet bubbles, close and dry, steady.",
    params: sfx(2.03, true),
    seconds: 2.03,
    loop: true,
    takes: 2,
  },
  {
    id: "places-fire",
    originals: ["places/fire/5.mp3"],
    tracks: ["amb-fire"],
    kind: "ambience",
    description:
      "Crematorium fire (fire.wav), a 2.32 s loop repeated 100 times: a low roar (centroid 530 Hz, roll-off 1.2 kHz) with a rumble around 60 Hz. Tagged Vehicle 0.21, Explosion 0.10: a broadband roar the tagger reads as engine-like.",
    uncertain: "The tagger does not say fire; the source name and the picture do.",
    model: SFX_MODEL,
    prompt:
      "A big furnace fire roaring steadily, deep low rumble with soft crackle, heard close, even and continuous.",
    params: sfx(2.32, true),
    seconds: 2.32,
    loop: true,
    takes: 2,
  },
  {
    id: "places-hospital_desk",
    originals: ["places/hospital_desk/5.mp3"],
    tracks: ["amb-hospital"],
    kind: "ambience",
    description:
      "Hospital front desk (hospital lobby.wav), a 3.04 s loop repeated 999 times: murmuring people. Tagged Speech 0.75, Chatter 0.24, Hubbub 0.14. Quiet (-37 LUFS).",
    uncertain:
      "It is crowd murmur, so the remake must be indistinct babble; the speech screen will flag it and needs a listener's judgment that no words are intelligible.",
    model: SFX_MODEL,
    prompt:
      "Quiet hospital lobby crowd murmur, indistinct distant chatter of several people, no clear words, soft and steady room tone.",
    params: sfx(3.04, true),
    seconds: 3.04,
    loop: true,
    takes: 2,
  },
  {
    id: "places-hospital_room",
    originals: ["places/hospital_room/9.mp3"],
    tracks: ["amb-monitor"],
    kind: "ambience",
    description:
      "Hospital room (heart monitor.wav), a 1.59 s loop repeated 999 times: one beep per loop (about 38 per minute when looped), pitch about 1.0 kHz (C6). Tagged Beep, bleep 0.35.",
    model: SFX_MODEL,
    prompt:
      "A hospital heart monitor giving one clean electronic beep at about one kilohertz followed by quiet room hum, then silence.",
    params: sfx(1.59, true),
    seconds: 1.59,
    loop: true,
    takes: 2,
  },
  {
    id: "closed",
    originals: ["closed/5.mp3"],
    tracks: ["amb-night"],
    kind: "ambience",
    description:
      "The parlor closed for the night (night_2.wav), a 1.23 s loop repeated 100 times: a steady high chirp pitch around 1.6 kHz (G6) in most frames, a short swell. Quiet (-37 LUFS). Tagged weakly (Vehicle 0.15, Noise 0.12).",
    uncertain:
      "The tagger does not name it; the steady 1.6 kHz pitch and the source name suggest crickets.",
    model: SFX_MODEL,
    prompt:
      "Night crickets chirping steadily in a field, high even chirps, quiet and continuous, no other sounds.",
    params: sfx(1.23, true),
    seconds: 1.23,
    loop: true,
    takes: 2,
  },
  {
    id: "morning_coffee",
    originals: ["morning_coffee/5.mp3"],
    tracks: ["amb-birds"],
    kind: "ambience",
    description:
      "Morning coffee (bird.wav), a 5.06 s loop repeated 100 times: birdsong. Tagged Bird vocalization 0.46, Chirp, tweet 0.44, Bird 0.43. Very quiet (-44 LUFS), bright (centroid 2.8 kHz), short calls rather than a dense chorus.",
    model: SFX_MODEL,
    prompt:
      "A few songbirds chirping in the early morning, short bright tweets with gaps between, distant and gentle, quiet garden.",
    params: sfx(5.06, true),
    seconds: 5.06,
    loop: true,
    takes: 2,
  },
  // --- effects ------------------------------------------------------------------------
  {
    id: "ring-ring",
    originals: ["ring/ring/4.mp3", "ring/ring&hand/5.mp3"],
    tracks: ["glint"],
    kind: "sfx",
    description:
      "A ring (chimes1_akiko.wav), 2.12 s, played once (both ring pictures share it): a high chime, pitch about B6 (2 kHz), one onset, swelling to its peak at about 0.5 s and ringing out. Very quiet (-42.5 LUFS). Tagged Tuning fork 0.05, Ding 0.05, Sonar 0.05.",
    model: SFX_MODEL,
    prompt:
      "A delicate high wind chime shimmer, a soft glassy sparkle that swells briefly and rings out, quiet and magical.",
    params: sfx(2.12),
    seconds: 2.12,
    loop: false,
    takes: 2,
  },
  {
    id: "animals-dog-dragging-hand",
    originals: ["animals/dog-dragging-hand/2.mp3"],
    tracks: ["growl"],
    kind: "sfx",
    description:
      "A dog dragging a hand (dog_growl.wav), 1.74 s, played once. Tagged Dog 0.74, Growling 0.61. One continuous growl (one onset), peak early, fading over about 1.4 s; centroid 770 Hz.",
    model: SFX_MODEL,
    prompt:
      "A medium dog growling low and menacing for under two seconds, one continuous throaty growl, close and dry.",
    params: sfx(1.74),
    seconds: 1.74,
    loop: false,
    takes: 2,
  },
  ...[1, 2, 3, 4, 5].map(
    (n): RemasterEntry => ({
      id: `background-background_${n}`,
      originals: [`background/background_${n}/2.mp3`],
      tracks: [],
      kind: "sfx",
      description: {
        1: "Parlor background 1 (bell_1.wav), 1.46 s, played once. Tagged Doorbell 0.75, Ding-dong 0.13; one strike, pitch about D#3 with brighter partials, rings out over about 1 s.",
        2: "Parlor background 2 (bell_2.wav), 1.88 s, played once. Tagged Doorbell 0.81, Ding-dong 0.26; three onsets (a two-tone or repeated chime), pitch about F5.",
        3: "Parlor background 3 (bell_3.wav), 1.01 s, played once. Tagged Doorbell 0.58, Ding-dong 0.15; one strike, pitch about E5.",
        4: "Parlor background 4 (bell_4.wav), 1.93 s, played once. Tagged Doorbell 0.77, Ding-dong 0.29; one strike, pitch about D#5, the longest ring (-20 dB after 1.4 s).",
        5: "Parlor background 5 (bell_5.wav), 1.29 s, played once. Tagged Doorbell 0.71, Bell 0.14; one strike, pitch about E5.",
      }[n] as string,
      model: SFX_MODEL,
      prompt: {
        1: "A single low shop doorbell ding, one warm metallic strike that rings out, close and clean.",
        2: "A two-tone ding-dong doorbell chime, bright and clear, ringing out, close and clean.",
        3: "A single short bright bell ding, one strike, quick ring-out, close and clean.",
        4: "A single bright doorbell ding with a long clear ring-out, close and clean.",
        5: "A single bright bell ding, one strike with a short ring-out, close and clean.",
      }[n] as string,
      params: sfx([1.46, 1.88, 1.01, 1.93, 1.29][n - 1] as number),
      seconds: [1.46, 1.88, 1.01, 1.93, 1.29][n - 1] as number,
      loop: false,
      takes: 2,
    }),
  ),
  {
    id: "mother-happy",
    originals: ["mother/happy/5.mp3"],
    tracks: ["harp-good-news"],
    kind: "sfx",
    description:
      "A happy mother (happy harp.wav), 1.42 s, played once. Tagged Music 0.79, Ukulele 0.55: a short bright plucked-string flourish (2 onsets), loud (-14 LUFS), dying within 0.8 s.",
    model: SFX_MODEL,
    prompt:
      "A short happy plucked harp flourish, two quick bright strums rising, cheerful good-news sting, close and clean.",
    params: sfx(1.42),
    seconds: 1.42,
    loop: false,
    takes: 2,
  },
  {
    id: "people-jesus_happy",
    originals: ["people/jesus_happy/13.mp3"],
    tracks: ["angelic"],
    kind: "sfx",
    description:
      "A happy Jesus (jesus.wav), 2.33 s, played once. Tagged Choir 0.30, Singing 0.16, A capella 0.14: a sung choir chord swelling to its peak near 0.8 s and fading.",
    uncertain:
      "It is sung, so the remake must be a wordless choir 'aah'; the speech screen should find no words.",
    model: SFX_MODEL,
    prompt:
      "A heavenly choir singing one wordless 'aah' chord that swells and fades, warm and bright, angelic approval.",
    params: sfx(2.33),
    seconds: 2.33,
    loop: false,
    takes: 2,
  },
  {
    id: "places-hospital_ambulance",
    originals: ["places/hospital_ambulance/2.mp3"],
    tracks: ["siren"],
    kind: "sfx",
    description:
      "Hospital ambulance (police call.wav), 2.35 s, played once. Tagged Speech 0.70, Radio 0.20, Telephone dialing 0.10: a police radio call, a burst of radio voice with squelch, not a siren. Loud (-13 LUFS), 5 onsets.",
    uncertain:
      "The original carries a voice. A remake 'similar' in kind is radio chatter, which the no-speech check will flag; the prompt asks for unintelligible, filtered radio chatter and a squelch, and a listener should confirm no words are clear.",
    model: SFX_MODEL,
    prompt:
      "A police radio crackle: a squelch click, a short burst of muffled unintelligible dispatcher chatter through a tinny radio, then a second squelch.",
    params: sfx(2.35),
    seconds: 2.35,
    loop: false,
    takes: 2,
  },
  {
    id: "places-psych",
    originals: ["places/psych/7.mp3"],
    tracks: ["psychic"],
    kind: "sfx",
    description:
      "The psychic (Cinematic 12 Harp 01.wav), 3.29 s, played once. Tagged Harp 0.65, Pizzicato 0.13: a low, cinematic harp gesture; warm (centroid 440 Hz), key estimate D major (r 0.80), pitch centre about A2; peak early, ringing out over 1.7 s.",
    model: SFX_MODEL,
    prompt:
      "A low cinematic harp glissando in D major, a mysterious sweeping gesture that rings out, warm and resonant, about three seconds.",
    params: sfx(3.29),
    seconds: 3.29,
    loop: false,
    takes: 2,
  },
  {
    id: "stuff-battle_lose",
    originals: ["stuff/battle_lose/2.mp3"],
    tracks: ["gong"],
    kind: "sfx",
    description:
      "Losing a fight (death gong sound.wav), 6.43 s, played once. Tagged Gong 0.59, Singing bowl 0.14: one deep strike (pitch about D3, centroid 320 Hz) blooming to its peak at about 1.4 s and decaying slowly. Quiet for its kind (-32.5 LUFS).",
    model: SFX_MODEL,
    prompt:
      "A single deep large gong struck once, a dark slow bloom and a long shimmering decay, about six seconds.",
    params: sfx(6.43),
    seconds: 6.43,
    loop: false,
    takes: 2,
  },
  {
    id: "stuff-lottery_win-19",
    originals: ["stuff/lottery_win/19.mp3", "stuff/lottery_lose/19.mp3"],
    tracks: ["bingo-ball"],
    kind: "sfx",
    description:
      "Scratching a lottery ticket (scratch_shot.wav), 0.28 s, played three times per ticket (winning and losing tickets share it): one short noisy scrape (flatness 0.24, roll-off 3.6 kHz). Very quiet (-39 LUFS). Tagger cannot name it.",
    uncertain:
      "Too short and too quiet for the tagger; the source name and the picture say a scratch.",
    model: SFX_MODEL,
    prompt:
      "One quick scratch of a coin across a scratch-off lottery ticket, a short dry papery scrape, very close.",
    params: sfx(0.5),
    seconds: 0.28,
    loop: false,
    takes: 2,
  },
  {
    id: "stuff-lottery_lose-26",
    originals: ["stuff/lottery_lose/26.mp3"],
    tracks: ["bingo-lose"],
    kind: "sfx",
    description:
      "Losing the lottery (loser edited.wav), 1.70 s, played once. Tagged Music 0.70 (and Cat 0.08): a short loud (-15.6 LUFS) musical 'loser' gesture, 4 onsets, peak late at about 1.4 s, pitch about D#3.",
    uncertain:
      "The tagger only says music; four onsets and a late peak suggest a short descending comic phrase.",
    model: SFX_MODEL,
    prompt:
      "A short comic losing sting, a few descending brassy notes ending on a low flat note, about one and a half seconds.",
    params: sfx(1.7),
    seconds: 1.7,
    loop: false,
    takes: 2,
  },
  {
    id: "stuff-lottery_win-25",
    originals: ["stuff/lottery_win/25.mp3"],
    tracks: ["bingo-win"],
    kind: "sfx",
    description:
      "Winning the lottery (cash register.wav), 1.33 s, played once. Tagged Cash register 0.93: keys, bell and drawer (6 onsets), bright (pitch about B6 in the bell).",
    model: SFX_MODEL,
    prompt:
      "An old mechanical cash register: quick key clacks, the bright bell ring and the drawer sliding open, close and clean.",
    params: sfx(1.33),
    seconds: 1.33,
    loop: false,
    takes: 2,
  },
  {
    id: "stuff-money_bag",
    originals: ["stuff/money_bag/7.mp3"],
    tracks: ["cash-register"],
    kind: "sfx",
    description:
      "The money bag (money_lose.wav), 3.16 s, played once. Tagged Music 0.73, Guitar 0.37, Plucked string instrument 0.32: a short plucked-guitar musical sting (2 onsets), key estimate B major (r 0.65), ringing out over 1.6 s.",
    uncertain:
      "Despite the money picture it is a guitar sting, not a cash sound; the remake follows the sound.",
    model: SFX_MODEL,
    prompt:
      "A short acoustic guitar sting in B major, two plucked strums and a ringing chord, about three seconds, close and clean.",
    params: sfx(3.16),
    seconds: 3.16,
    loop: false,
    takes: 2,
  },
  {
    id: "stuff-money_bag_2",
    originals: ["stuff/money_bag_2/9.mp3"],
    tracks: ["coins"],
    kind: "sfx",
    description:
      "The second money bag (cash register.wav), 0.85 s, played once. Tagged Cash register 0.98: a quick register bell and clunk (2 onsets), bell pitch about E6.",
    model: SFX_MODEL,
    prompt:
      "A quick cash register ka-ching: one bright bell ding and a drawer clunk, under one second, close and clean.",
    params: sfx(0.85),
    seconds: 0.85,
    loop: false,
    takes: 2,
  },
  {
    id: "stuff-toilet",
    originals: ["stuff/toilet/3.mp3"],
    tracks: ["toilet-flush"],
    kind: "sfx",
    description:
      "The toilet (toilet_flush.wav), 4.02 s, played once. Tagged Toilet flush 0.87, Water 0.27: a rushing flush with gurgles (15 onsets), bright (centroid 1.8 kHz).",
    model: SFX_MODEL,
    prompt:
      "A toilet flushing: a strong rushing swirl of water with gurgles draining away, about four seconds, small bathroom.",
    params: sfx(4.02),
    seconds: 4.02,
    loop: false,
    takes: 2,
  },
  {
    id: "wait",
    originals: ["wait/5.mp3"],
    tracks: ["doorbell"],
    kind: "sfx",
    description:
      "Waiting for a customer (wind_short_3.wav), 2.18 s, played once at frame 20. Tagged Vehicle 0.20, Aircraft 0.05: a short gust of wind (one onset, swelling to a peak near 1.1 s and falling away).",
    uncertain:
      "The tagger reads the broadband swell as a vehicle; the source name says a short wind.",
    model: SFX_MODEL,
    prompt:
      "A short gust of wind rising and falling away, a single whoosh over about two seconds, outdoors.",
    params: sfx(2.18),
    seconds: 2.18,
    loop: false,
    takes: 2,
  },
  {
    id: "welcome-paper",
    originals: ["welcome/paper.mp3"],
    tracks: [],
    kind: "sfx",
    description:
      "Front-door buttons (paper_flipping.wav), 0.81 s, played once per press: a paper flip (2 onsets, noisy, roll-off 3.4 kHz). Quiet (-37 LUFS). Tagger cannot name it.",
    model: SFX_MODEL,
    prompt: "A single page of paper flipped over quickly, a crisp papery flick, very close.",
    params: sfx(0.81),
    seconds: 0.81,
    loop: false,
    takes: 2,
  },
  {
    id: "welcome-46",
    originals: ["welcome/46.mp3"],
    tracks: [],
    kind: "sfx",
    description:
      "An unnamed 0.19 s sound attached by script in welcome.swf (character 46; no source name recorded). Almost silent (-70 LUFS integrated), one noisy click (flatness 0.24).",
    uncertain:
      "What it is, and whether the game ever played it audibly, is unknown; the measurements only say a very quiet click.",
    model: SFX_MODEL,
    prompt: "One tiny soft click, very short and quiet.",
    params: sfx(0.5),
    seconds: 0.19,
    loop: false,
    takes: 2,
  },
];

/** Credits estimated for one entry's generation(s), at the rates the account quoted. */
export function estimate(e: RemasterEntry): number {
  const s = Number(e.params.duration_seconds);
  return Math.round(s * (e.model === MUSIC_MODEL ? RATE.music : RATE.sfx) * e.takes);
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = join(here, "..", "..", "..", "assets", "audio-remaster", "brief.json");
  const brief = JSON.parse(readFileSync(path, "utf8")) as {
    sounds: { file: string; remake?: unknown }[];
  };
  for (const s of brief.sounds) {
    const e = REMASTER.find((r) => r.originals.includes(s.file));
    if (!e) throw new Error(`no remake brief for ${s.file}`);
    s.remake = {
      id: e.id,
      sharedWith: e.originals.filter((f) => f !== s.file),
      tracks: e.tracks,
      kind: e.kind,
      description: e.description,
      uncertain: e.uncertain ?? null,
      model: e.model,
      prompt: e.prompt,
      params: e.params,
      deliverSeconds: e.seconds,
      loop: e.loop,
      ...(e.bpm ? { bpm: e.bpm } : {}),
      ...(e.bars ? { bars: e.bars, beatsPerBar: e.beatsPerBar } : {}),
      ...(e.key ? { key: e.key } : {}),
      takes: e.takes,
      estimateCredits: e.originals[0] === s.file ? estimate(e) : 0,
      status: "not generated",
    };
  }
  writeFileSync(path, `${JSON.stringify(brief, null, 1)}\n`);
  const total = REMASTER.reduce((a, e) => a + estimate(e), 0);
  console.log(
    `${REMASTER.length} remakes for ${brief.sounds.length} originals; estimate ${total} credits`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
