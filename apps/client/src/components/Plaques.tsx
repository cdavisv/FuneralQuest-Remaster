import type { Button } from "@fq/protocol";
import { useId } from "react";
import { useT } from "../i18n/I18nContext.js";

/** Longer labels get a smaller face so they stay on the plaque. */
export const labelSize = (label: string): "normal" | "long" | "longer" =>
  label.length > 18 ? "longer" : label.length > 11 ? "long" : "normal";

/** Raised tan plaque buttons. The server decides what exists; the client lays out what it gets. */
export function Plaques({
  buttons,
  onPress,
  variant = "plaque",
  position,
  size = "normal",
}: {
  buttons: Button[];
  onPress: (buttonId: string) => void;
  variant?: "plaque" | "link";
  /** Expanded's second row of choices is drawn smaller. */
  size?: "normal" | "small";
  /** The keyboard position (0-based) of a button in the whole View, when this shows only some. */
  position?: (button: Button) => number;
}) {
  const t = useT();
  const uid = useId();
  if (buttons.length === 0) return null;
  return (
    <nav
      className={`fq-plaques fq-plaques-${variant}`}
      data-size={size === "small" ? "small" : undefined}
      aria-label={t(size === "small" ? "x.deck.more" : "buttons.region")}
    >
      <ul>
        {buttons.map((b, at) => {
          const i = position ? position(b) : at;
          const disabled = b.enabled === false;
          const tipId = `${uid}-tip-${i}`;
          return (
            <li key={b.id} className="fq-plaque-item">
              <button
                type="button"
                className="fq-plaque"
                data-button-id={b.id}
                data-has-detail={b.detail !== undefined || undefined}
                aria-disabled={disabled || undefined}
                aria-describedby={disabled && b.hint ? tipId : undefined}
                aria-keyshortcuts={i < 9 ? String(i + 1) : undefined}
                onClick={() => {
                  if (!disabled) onPress(b.id);
                }}
              >
                <span className="fq-plaque-key" aria-hidden="true">
                  {i < 9 ? i + 1 : ""}
                </span>
                <span className="fq-plaque-label" data-len={labelSize(b.label)}>
                  {b.label}
                </span>
                {b.detail !== undefined && <span className="fq-plaque-detail">{b.detail}</span>}
              </button>
              {disabled && b.hint && (
                <span id={tipId} role="tooltip" className="fq-tip">
                  {b.hint}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
