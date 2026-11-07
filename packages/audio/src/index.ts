/**
 * @fq/audio for the page: the cue map, the track ids, the manifest's shape, the sound packs
 * (Synth and Studio) and their per-track fallback, the UI sounds that are synthesised live, and
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
  type AudioPackInfo,
  DEFAULT_PACK,
  isPackId,
  nextBarTime,
  PACK_IDS,
  PACKS,
  type PackId,
  packChain,
  type ResolvedTrack,
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
