import { DOOR_CONTEXT, type PlayContext, type PlayMode, type Ruleset } from "@fq/audio";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { useSettings } from "../settings/settings.js";
import { type AudioManager, type AudioState, createAudioManager } from "./AudioManager.js";
import { createWebAudioBackend } from "./webAudioBackend.js";

const AudioCtx = createContext<AudioManager | null>(null);

/** The app's default manager: Web Audio, created at the first interaction; silent under test. */
export function defaultAudioManager(): AudioManager {
  const testing = (import.meta as { env?: { MODE?: string } }).env?.MODE === "test";
  return createAudioManager(testing ? {} : { backend: createWebAudioBackend });
}

const INTERACTIONS = ["pointerdown", "keydown", "touchend"] as const;
const CLICKABLE =
  'button, a[href], [role="button"], input[type="radio"], input[type="checkbox"], summary';

export function AudioProvider({
  manager,
  children,
}: {
  manager?: AudioManager;
  children: ReactNode;
}) {
  const audio = useMemo(() => manager ?? defaultAudioManager(), [manager]);
  const { settings } = useSettings();
  const { master, music, ambience, effects } = settings.volume;
  useEffect(() => {
    audio.setVolumes({ master, music, ambience, effects });
  }, [audio, master, music, ambience, effects]);
  useEffect(() => audio.setMuted(settings.muted), [audio, settings.muted]);
  useEffect(() => audio.setRadio(settings.radio), [audio, settings.radio]);
  useEffect(() => audio.setPack(settings.soundPack), [audio, settings.soundPack]);

  // Browsers allow sound only after the player interacts: unlock on the first gesture. Clicks
  // and hovers on controls get their UI sounds from here, so no component has to ask.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const unlock = (e: Event) => {
      if (e.target instanceof Element && e.target.closest('[data-audio-unlock="self"]')) return;
      audio.unlock();
    };
    const click = (e: Event) => {
      const el = e.target instanceof Element ? e.target.closest(CLICKABLE) : null;
      if (el && !(el as HTMLButtonElement).disabled) audio.ui("ui-click");
    };
    let hovered: Element | null = null;
    let lastHover = 0;
    const hover = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const el = e.target instanceof Element ? e.target.closest("button") : null;
      if (!el || el === hovered || el.disabled) {
        hovered = el;
        return;
      }
      hovered = el;
      const now = performance.now();
      if (now - lastHover > 90) audio.ui("ui-hover");
      lastHover = now;
    };
    const visibility = () => audio.setHidden(document.visibilityState === "hidden");
    for (const ev of INTERACTIONS) document.addEventListener(ev, unlock, { capture: true });
    document.addEventListener("pointerdown", click);
    document.addEventListener("pointerover", hover);
    document.addEventListener("visibilitychange", visibility);
    visibility();
    return () => {
      for (const ev of INTERACTIONS) document.removeEventListener(ev, unlock, { capture: true });
      document.removeEventListener("pointerdown", click);
      document.removeEventListener("pointerover", hover);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [audio]);

  return <AudioCtx.Provider value={audio}>{children}</AudioCtx.Provider>;
}

/** The ruleset a host's name for it means: anything but "expanded" (Solo's "original" too) is Classic. */
export const rulesetOf = (name: string | undefined): Ruleset | undefined =>
  name === undefined ? undefined : name === "expanded" ? "expanded" : "classic";

/**
 * Tells the sound what the player is in for as long as it is on screen: render it beside the game
 * (a town, a Solo career, the Daily Challenge). With the "Automatic" sound pack the music follows
 * the ruleset; it goes back to the front door's when this goes away. A ruleset that is briefly
 * unknown (the lobby reloading under a running game) keeps the last one it knew.
 */
export function SoundContext({ mode, ruleset }: { mode: PlayMode; ruleset?: string | undefined }) {
  const audio = useAudio();
  const known = useRef<Ruleset | undefined>(undefined);
  known.current = rulesetOf(ruleset) ?? known.current;
  const resolved: Ruleset = known.current ?? "classic";
  useEffect(() => {
    const context: PlayContext = { ruleset: resolved, mode };
    audio.setContext(context);
    return () => audio.setContext(DOOR_CONTEXT);
  }, [audio, mode, resolved]);
  return null;
}

export function useAudio(): AudioManager {
  const a = useContext(AudioCtx);
  if (!a) throw new Error("useAudio must be used inside AudioProvider");
  return a;
}

/** The music the manager is playing (its resolved id). */
export function useCurrentMusic(): string | undefined {
  const audio = useAudio();
  return useSyncExternalStore(
    (cb) => audio.subscribe(cb),
    () => audio.currentMusic,
  );
}

/** The manager's state (unlocked, muted, music, ambience), for controls that show it. */
export function useAudioState(): AudioState {
  const audio = useAudio();
  return useSyncExternalStore(
    (cb) => audio.subscribe(cb),
    () => audio.state,
  );
}
