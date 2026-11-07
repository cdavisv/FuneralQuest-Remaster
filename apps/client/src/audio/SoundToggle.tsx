import { useT } from "../i18n/I18nContext.js";
import { useSettings } from "../settings/settings.js";
import { useAudio } from "./AudioContext.js";

/**
 * The mute control, on every screen: the front door's links, the game's top corner and the static
 * pages. Sound is on by default (decision 16); the browser will not play anything until the
 * player's first click or key press, and the page starts the audio at that first interaction
 * wherever it happens (`AudioProvider`). So this button does not mean "start the sound": it
 * mutes and unmutes, and the choice is saved (a player who turned sound off stays off).
 */
export function SoundToggle({
  className,
  iconOnly,
}: {
  className?: string;
  /** Just the speaker, named for assistive technology (the game's corner has no room for words). */
  iconOnly?: boolean;
}) {
  const t = useT();
  const audio = useAudio();
  const { settings, update } = useSettings();
  const on = !settings.muted;
  const label = on ? t("audio.mute") : t("audio.unmute");
  return (
    <button
      type="button"
      className={`fq-sound-toggle${className ? ` ${className}` : ""}`}
      data-sound={on ? "on" : "off"}
      data-icon-only={iconOnly || undefined}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      // Muting needs no sound at all, so this press does not start the audio; unmuting does (a
      // press is an interaction the browser accepts).
      data-audio-unlock="self"
      onClick={() => {
        if (settings.muted) audio.unlock();
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
      {!iconOnly && <span>{label}</span>}
    </button>
  );
}
