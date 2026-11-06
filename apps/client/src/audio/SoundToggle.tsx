import { useT } from "../i18n/I18nContext.js";
import { useSettings } from "../settings/settings.js";
import { useAudio, useAudioState } from "./AudioContext.js";

/**
 * The front door's sound button. Browsers start sound only after an interaction, so until then
 * it offers "Sound on"; afterwards it mutes and unmutes (the setting persists).
 */
export function SoundToggle({ className }: { className?: string }) {
  const t = useT();
  const audio = useAudio();
  const state = useAudioState();
  const { settings, update } = useSettings();
  const on = state.unlocked && !settings.muted;
  return (
    <button
      type="button"
      className={`fq-sound-toggle${className ? ` ${className}` : ""}`}
      data-sound={on ? "on" : "off"}
      // this button unlocks the sound itself (the provider's first-gesture unlock skips it, so
      // the first press turns the sound on rather than unlocking and then muting)
      data-audio-unlock="self"
      onClick={() => {
        if (!state.unlocked) {
          audio.unlock();
          if (settings.muted) update({ muted: false });
          return;
        }
        update({ muted: !settings.muted });
      }}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        {on ? (
          <path
            d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        ) : (
          <path
            d="M16 9l5 6M21 9l-5 6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        )}
      </svg>
      <span>{on ? t("audio.off") : t("audio.on")}</span>
    </button>
  );
}
