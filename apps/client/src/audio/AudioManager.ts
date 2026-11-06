import {
  type AmbienceId,
  type CueMemory,
  ENGINE_MUSIC,
  ENGINE_SOUNDS,
  emptyMemory,
  LAYERED,
  type MusicId,
  moodLayers,
  PLACE_MUSIC,
  pickCue,
  type SoundId,
  soundsForAction,
  type UiId,
} from "@fq/audio";
import type { Action, View } from "@fq/protocol";
import { type DataMemory, dataSounds } from "./dataCues.js";

/**
 * The audio seam. The client hands every View to the manager (`cue`), and the player's actions
 * (`action`); the manager works out what should be heard (music, an ambience bed, one-shots,
 * the negotiation's intensity) with @fq/audio's cue map and tells a backend. The manager owns
 * the rules a player notices: nothing sounds before the first interaction (browsers' autoplay
 * policy), sliders and mute apply at once and persist through the settings, the tab going to the
 * background pauses everything, and a backend that cannot load a file just stays quiet.
 *
 * The real backend is Web Audio (`webAudioBackend.ts`); tests pass a fake one.
 */
export interface Volumes {
  master: number;
  music: number;
  ambience: number;
  effects: number;
}

/** What the manager asks of a backend. Gains are linear; fades and ramps are in seconds. */
export interface AudioBackend {
  /** Crossfade to this music (null fades it out). `layers`: stem gains for layered music. */
  setMusic(id: MusicId | null, fade: number, layers?: number[]): void;
  /** New stem gains for the current layered music. */
  setLayers(gains: number[], ramp: number): void;
  setAmbience(id: AmbienceId | null, fade: number): void;
  /** A one-shot. Stingers duck the music while they play. */
  playSound(id: SoundId, kind: "ui" | "sfx" | "stinger"): void;
  /** Bus gains, mute already applied (master 0). */
  setGains(g: Volumes): void;
  /** The "2001 radio" filter: band-limited mono. */
  setRadio(on: boolean): void;
  /** False while the tab is hidden or the sound is muted: the backend may suspend itself. */
  setActive(active: boolean): void;
  dispose(): void;
}

export type BackendFactory = () => AudioBackend | null;

export interface AudioManagerOptions {
  /**
   * The backend, or a factory called once at the first interaction (so an AudioContext is
   * created inside a user gesture). Without one the manager is silent but keeps its state.
   */
  backend?: AudioBackend | BackendFactory;
  /** Start unlocked (tests, or a host that knows it may play). */
  unlocked?: boolean;
}

export interface AudioState {
  unlocked: boolean;
  muted: boolean;
  hidden: boolean;
  radio: boolean;
  music: MusicId | null;
  ambience: AmbienceId | null;
  mood: number;
  volumes: Volumes;
}

export interface AudioManager {
  /** Called once per View. `music` and `sounds` are the View's own ids; `view` lets the cue map work. */
  cue(music: string | undefined, sounds: readonly string[] | undefined, view?: View): void;
  /** The player's own action (button sounds, the place being visited). */
  action(action: Action): void;
  /** Music outside a game View (the front door). */
  setMusic(id: MusicId | null): void;
  /** A UI sound (click, hover). */
  ui(id: UiId): void;
  setVolumes(volumes: Partial<Volumes>): void;
  setMuted(muted: boolean): void;
  setRadio(on: boolean): void;
  /** The tab became hidden or visible. */
  setHidden(hidden: boolean): void;
  /** The first user interaction: browsers allow sound from here on. */
  unlock(): void;
  readonly state: AudioState;
  /** The resolved music id currently wanted, for the settings panel. */
  readonly currentMusic: string | undefined;
  /** Notifies the UI when the state changes. `state` is a new object after each change. */
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

/** Crossfade lengths, seconds. */
export const FADE = { scene: 1.2, battle: 0.35, ambience: 2, layers: 1.5 } as const;

/** One-shots that are stingers (music-like, they duck the loop). */
const STINGER_IDS = new Set<string>(["main-stinger", "victory", "defeat", "newday", "endday"]);
const UI_SOUND_IDS = /^ui-/;

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export function createAudioManager(options: AudioManagerOptions = {}): AudioManager {
  let backend: AudioBackend | null = null;
  const factory: BackendFactory | null =
    typeof options.backend === "function" ? options.backend : null;
  const given: AudioBackend | null =
    options.backend && typeof options.backend !== "function" ? options.backend : null;
  let memory: CueMemory = emptyMemory();
  let dataMemory: DataMemory = {};
  const state: AudioState = {
    unlocked: false,
    muted: false,
    hidden: false,
    radio: false,
    music: null,
    ambience: null,
    mood: 0,
    volumes: { master: 1, music: 1, ambience: 1, effects: 1 },
  };
  const listeners = new Set<() => void>();
  // An immutable copy for React (useSyncExternalStore wants a stable snapshot between changes).
  let snapshot: AudioState = { ...state, volumes: { ...state.volumes } };
  const notify = () => {
    snapshot = { ...state, volumes: { ...state.volumes } };
    for (const l of listeners) l();
  };
  /** What the backend was last told, so only changes go through. */
  let sentMusic: MusicId | null = null;
  let sentAmbience: AmbienceId | null = null;
  let sentLayers = "";

  const audible = () => state.unlocked && !state.muted && !state.hidden && backend !== null;

  const gains = (): Volumes => ({
    master: state.muted ? 0 : clamp01(state.volumes.master),
    music: clamp01(state.volumes.music),
    ambience: clamp01(state.volumes.ambience),
    effects: clamp01(state.volumes.effects),
  });

  const layersFor = (music: MusicId | null) =>
    music && LAYERED[music] ? moodLayers(state.mood).slice(0, LAYERED[music]) : undefined;

  /** Brings the backend in line with the wanted state. */
  function sync(fade: number = FADE.scene) {
    if (!backend || !state.unlocked) return;
    if (state.music !== sentMusic) {
      backend.setMusic(state.music, fade, layersFor(state.music));
      sentMusic = state.music;
      sentLayers = JSON.stringify(layersFor(state.music) ?? null);
    } else {
      const l = layersFor(state.music);
      const key = JSON.stringify(l ?? null);
      if (l && key !== sentLayers) {
        backend.setLayers(l, FADE.layers);
        sentLayers = key;
      }
    }
    if (state.ambience !== sentAmbience) {
      backend.setAmbience(state.ambience, FADE.ambience);
      sentAmbience = state.ambience;
    }
  }

  function play(ids: readonly string[]) {
    if (!audible() || !backend) return;
    for (const id of ids) {
      const kind = STINGER_IDS.has(id) ? "stinger" : UI_SOUND_IDS.test(id) ? "ui" : "sfx";
      backend.playSound(id as SoundId, kind);
    }
  }

  function setWanted(music: MusicId | null, ambience: AmbienceId | null, mood: number) {
    const before = state.music;
    const changed = music !== state.music || ambience !== state.ambience || mood !== state.mood;
    state.music = music;
    state.ambience = ambience;
    state.mood = mood;
    const fast = music === "battle" || before === "battle";
    sync(fast ? FADE.battle : FADE.scene);
    if (changed) notify();
  }

  const manager: AudioManager = {
    cue(music, sounds, view) {
      if (view) {
        // the ids passed in win over the View's own (they are the same when the Game calls)
        const v: View = { ...view };
        if (music !== undefined) v.music = music;
        if (sounds !== undefined) v.sounds = [...sounds];
        const { cue, memory: next } = pickCue(v, memory);
        memory = next;
        // What the View's data says changed (a round, a loan, an upgrade...), besides the cue map's.
        const data = dataSounds(dataMemory, v);
        dataMemory = data.memory;
        setWanted(cue.music, cue.ambience, cue.mood);
        play([...new Set<string>([...cue.sounds, ...data.sounds])]);
        return;
      }
      // No View (a host that only has ids): the engine's ids, mapped.
      const m = music ? (ENGINE_MUSIC[music] ?? null) : null;
      setWanted(m, state.ambience, state.mood);
      play((sounds ?? []).map((s) => ENGINE_SOUNDS[s]).filter((s): s is SoundId => !!s));
    },
    action(action) {
      if (action.type === "visit") {
        memory = { ...memory, place: action.placeId };
        const m = PLACE_MUSIC[action.placeId];
        if (m) setWanted(m, null, 0);
      }
      play(soundsForAction(action));
    },
    setMusic(id) {
      memory = emptyMemory();
      dataMemory = {};
      setWanted(id, null, 0);
    },
    ui(id) {
      play([id]);
    },
    setVolumes(v) {
      state.volumes = { ...state.volumes, ...v };
      backend?.setGains(gains());
      notify();
    },
    setMuted(muted) {
      if (muted === state.muted) return;
      state.muted = muted;
      backend?.setGains(gains());
      backend?.setActive(!state.hidden && !muted);
      notify();
    },
    setRadio(on) {
      if (on === state.radio) return;
      state.radio = on;
      backend?.setRadio(on);
      notify();
    },
    setHidden(hidden) {
      if (hidden === state.hidden) return;
      state.hidden = hidden;
      backend?.setActive(!hidden && !state.muted);
      notify();
    },
    unlock() {
      if (state.unlocked) return;
      backend = given ?? factory?.() ?? null;
      state.unlocked = true;
      if (backend) {
        backend.setGains(gains());
        backend.setRadio(state.radio);
        backend.setActive(!state.hidden && !state.muted);
        sync(0.5);
      }
      notify();
    },
    get state() {
      return snapshot;
    },
    get currentMusic() {
      return state.music ?? undefined;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      backend?.dispose();
      backend = null;
      listeners.clear();
    },
  };
  if (options.unlocked) manager.unlock();
  return manager;
}
