import type { Button } from "@fq/protocol";
import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { useT } from "../i18n/I18nContext.js";

/** Longer labels get a smaller face so they stay on the plaque. */
export const labelSize = (label: string): "normal" | "long" | "longer" =>
  label.length > 18 ? "longer" : label.length > 11 ? "long" : "normal";

/** The steps a label is set down by, on a plaque of fixed height, until it fits the face. */
const LABEL_STEPS = [1, 0.92, 0.85, 0.78, 0.72, 0.66, 0.6];

/**
 * A plaque drawn from the art has a raised rim, about an eighth of its height above and a sixth
 * below, so the text has the middle 72% (a hand-drawn plaque has its padding). A label that
 * wraps to two lines on a plaque of fixed height ran onto the rims ("Slip the Inspector / an
 * Envelope"): it is set a step smaller until it fits. Plaques that grow with their label (the
 * smaller second row, a phone's) are left to grow.
 */
function fitLabels(list: HTMLElement | null): void {
  if (!list) return;
  const art = list.closest('[data-art="pieces"]') !== null;
  for (const plaque of list.querySelectorAll<HTMLElement>(".fq-plaque")) {
    const label = plaque.querySelector<HTMLElement>(".fq-plaque-label");
    if (!label) continue;
    label.style.removeProperty("font-size");
    const cs = getComputedStyle(plaque);
    if (plaque.closest('[data-size="small"], [data-layout="phone"]')) continue;
    const pad =
      (Number.parseFloat(cs.paddingTop) || 0) + (Number.parseFloat(cs.paddingBottom) || 0);
    const room = art ? plaque.clientHeight * 0.72 : plaque.clientHeight - pad;
    const base = Number.parseFloat(getComputedStyle(label).fontSize);
    if (!(room > 0) || !(base > 0)) continue;
    for (const step of LABEL_STEPS) {
      if (step < 1) label.style.fontSize = `${(base * step).toFixed(2)}px`;
      if (label.getBoundingClientRect().height <= room + 0.5) break;
    }
  }
}

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
  const navRef = useRef<HTMLElement>(null);
  const labels = buttons.map((b) => b.label).join("|");
  // biome-ignore lint/correctness/useExhaustiveDependencies: refit when the labels change.
  useLayoutEffect(() => {
    fitLabels(navRef.current);
  }, [labels]);
  const shown = buttons.length > 0;
  // biome-ignore lint/correctness/useExhaustiveDependencies: attach once the list is rendered.
  useEffect(() => {
    const el = navRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fitLabels(el);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [shown]);
  if (buttons.length === 0) return null;
  return (
    <nav
      ref={navRef}
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
