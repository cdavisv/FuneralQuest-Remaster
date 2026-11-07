import { DEFAULT_PACK_SETTING, isPackSetting, type PackSetting } from "@fq/audio";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { DEFAULT_PACK_ID } from "../art/packs.js";
import type { VoiceSetting } from "../audio/voiceLines.js";

export type FontSize = "small" | "normal" | "large" | "xlarge";
export type TypewriterSpeed = "off" | "fast" | "normal";
export type LayoutChoice = "auto" | "classic" | "wide" | "phone";

export interface Settings {
  /** Id of the art pack that draws the chrome; see src/art. An unknown id falls back to Classic. */
  artPack: string;
  fontSize: FontSize;
  typewriter: TypewriterSpeed;
  layout: LayoutChoice;
  /** 0 to 1 each. */
  volume: { master: number; music: number; ambience: number; effects: number; voice: number };
  /** All sound off (the front door's sound button and the settings). */
  muted: boolean;
  /** The "2001 radio" filter: band-limited mono, like the original's 11 kHz sounds. */
  radio: boolean;
  /**
   * The sound pack: "auto" (the default: by the ruleset being played), or "synth", "studio" or
   * "remaster", which win everywhere; see @fq/audio's packs. A saved choice is kept as it is.
   */
  soundPack: PackSetting;
  /** True once the player has picked a sound pack in Settings (see `loadSettings`). */
  soundPackChosen: boolean;
  /**
   * Character voices: "auto" (on in Expanded towns and Solo careers, off in Classic towns),
   * or the player's own "on" or "off".
   */
  voices: VoiceSetting;
}

/** Multiplier applied to text inside the cabinet (`--fq-font-scale`). */
export const FONT_SCALE: Record<FontSize, number> = {
  small: 0.9,
  normal: 1,
  large: 1.25,
  xlarge: 1.5,
};

/** Characters revealed per second by the typewriter. */
export const TYPEWRITER_CPS: Record<Exclude<TypewriterSpeed, "off">, number> = {
  fast: 400,
  normal: 110,
};

const STORAGE_KEY = "fq.settings.v1";

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function defaultSettings(): Settings {
  return {
    artPack: DEFAULT_PACK_ID,
    fontSize: "normal",
    typewriter: prefersReducedMotion() ? "off" : "normal",
    layout: "auto",
    volume: { master: 0.8, music: 0.6, ambience: 0.6, effects: 0.8, voice: 0.9 },
    muted: false,
    radio: false,
    soundPack: DEFAULT_PACK_SETTING,
    soundPackChosen: false,
    voices: "auto",
  };
}

const clamp01 = (n: unknown, fallback: number) =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;

/** Reads stored settings, tolerating missing or corrupted data. */
export function loadSettings(storage: Pick<Storage, "getItem"> | undefined): Settings {
  const base = defaultSettings();
  if (!storage) return base;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const data = JSON.parse(raw) as Partial<Settings> | null;
    if (!data || typeof data !== "object") return base;
    const vol = (data.volume ?? {}) as Partial<Settings["volume"]>;
    return {
      artPack:
        typeof data.artPack === "string" && /^[a-z0-9-]{1,40}$/.test(data.artPack)
          ? data.artPack
          : base.artPack,
      fontSize: data.fontSize && data.fontSize in FONT_SCALE ? data.fontSize : base.fontSize,
      typewriter:
        data.typewriter === "off" || data.typewriter === "fast" || data.typewriter === "normal"
          ? data.typewriter
          : base.typewriter,
      layout:
        data.layout === "auto" ||
        data.layout === "classic" ||
        data.layout === "wide" ||
        data.layout === "phone"
          ? data.layout
          : base.layout,
      volume: {
        master: clamp01(vol.master, base.volume.master),
        music: clamp01(vol.music, base.volume.music),
        ambience: clamp01(vol.ambience, base.volume.ambience),
        effects: clamp01(vol.effects, base.volume.effects),
        voice: clamp01(vol.voice, base.volume.voice),
      },
      muted: typeof data.muted === "boolean" ? data.muted : base.muted,
      radio: typeof data.radio === "boolean" ? data.radio : base.radio,
      // A stored "synth" from before the Automatic choice existed (settings were saved whole
      // on every load, so it was never a choice) becomes Automatic once; a choice made in the
      // Settings panel is saved with `soundPackChosen` and is kept.
      soundPack:
        isPackSetting(data.soundPack) && (data.soundPack !== "synth" || data.soundPackChosen)
          ? data.soundPack
          : base.soundPack,
      soundPackChosen: data.soundPackChosen === true,
      voices:
        data.voices === "on" || data.voices === "off" || data.voices === "auto"
          ? data.voices
          : base.voices,
    };
  } catch {
    return base;
  }
}

interface SettingsApi {
  settings: Settings;
  update: (
    patch: Partial<Omit<Settings, "volume">> & { volume?: Partial<Settings["volume"]> },
  ) => void;
}

const SettingsContext = createContext<SettingsApi | null>(null);

export function SettingsProvider({
  children,
  initial,
}: {
  children: ReactNode;
  /** Tests pass fixed settings; the app loads from localStorage. */
  initial?: Partial<Settings>;
}) {
  const [settings, setSettings] = useState<Settings>(() => ({
    ...loadSettings(typeof window === "undefined" ? undefined : window.localStorage),
    ...initial,
  }));

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Private mode or full storage: settings simply last for this session.
    }
  }, [settings]);

  const update = useCallback<SettingsApi["update"]>((patch) => {
    setSettings((prev) => ({
      ...prev,
      ...patch,
      volume: { ...prev.volume, ...patch.volume },
    }));
  }, []);

  const api = useMemo(() => ({ settings, update }), [settings, update]);
  return <SettingsContext.Provider value={api}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsApi {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
