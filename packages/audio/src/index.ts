/**
 * @fq/audio for the page: the cue map, the track ids, the manifest's shape, the sound packs
 * (Synth, Studio, Original remastered), the selection by ruleset and their per-track fallback, the UI sounds that are synthesised live, and
 * the loop seam repair. Nothing here pulls in the compositions; the
 * render (scripts/render.ts) and `@fq/audio/catalog` do.
 */
export {
  ACTION_SOUNDS,
  ambienceFor,
  BUTTON_MUSIC,
  type Cue,
  type CueMemory,
  ENGINE_MUSIC,
  ENGINE_SOUNDS,
  emptyMemory,
  musicFor,
  PICTURE_AMBIENCE,
  PICTURE_MUSIC,
  PICTURE_SOUNDS,
  PLACE_MUSIC,
  pickCue,
  SCENE_MUSIC,
  soundsForAction,
  WEATHER_AMBIENCE,
  WEATHER_SOUND,
} from "./cues.js";
export { LIVE_IDS, LOOP_FADE, renderLive } from "./live.js";
export { repairLoop } from "./loop.js";
export type { AudioManifest, ManifestTrack } from "./manifestTypes.js";
export {
  AUTO_PACK,
  type AudioPackInfo,
  type AutoReason,
  autoReason,
  DEFAULT_PACK_SETTING,
  DOOR_CONTEXT,
  effectivePack,
  FALLBACK_ORDER,
  isPackId,
  isPackSetting,
  nextBarTime,
  PACK_IDS,
  PACK_SETTINGS,
  PACKS,
  type PackId,
  type PackSetting,
  PLAY_MODES,
  type PlayContext,
  type PlayMode,
  packChain,
  type ResolvedTrack,
  RULESETS,
  type Ruleset,
  resolveTrack,
  stemGains,
} from "./packs.js";
export {
  AMBIENCE,
  type AmbienceId,
  EFFECTS_IDS,
  LAYERED,
  MUSIC,
  type MusicId,
  moodLayers,
  type SoundId,
  STINGERS,
  type StingerId,
  type TrackKind,
  UI_IDS,
  type UiId,
} from "./tracks.js";
export {
  characterForTag,
  lineCandidates,
  normaliseLine,
  type SpokenLine,
  sentences,
  spokenLines,
  VOICE_CHARACTERS,
  VOICE_DIR,
  type VoiceCharacter,
  type VoiceClip,
  type VoiceManifest,
  voiceKey,
} from "./voice.js";
