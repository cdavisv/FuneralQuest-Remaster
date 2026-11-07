import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useT } from "../i18n/I18nContext.js";
import {
  createPadController,
  type Glyphs,
  glyphsFor,
  isTextField,
  type PadLike,
  pageActions,
} from "./gamepad.js";

/**
 * Runs the gamepad (src/input/gamepad.ts) for the whole app and shows its hints.
 *
 * `<html data-input>` says what the player last used: "pad" after any gamepad button or stick,
 * "pointer" after the mouse, a key or a touch. The pad's glyphs (the hint bar) show only while it
 * is "pad", and the focus ring is always drawn then (a script-moved focus does not always match
 * `:focus-visible`). `window.fqClientGamepad` tells a wrapper that the page handles pads itself.
 */
declare global {
  interface Window {
    fqClientGamepad?: boolean;
  }
}

const getPads = (): readonly (PadLike | null)[] => {
  try {
    return typeof navigator.getGamepads === "function"
      ? (Array.from(navigator.getGamepads()) as (PadLike | null)[])
      : [];
  } catch {
    return [];
  }
};

export function PadProvider({ children }: { children: ReactNode }) {
  const [glyphs, setGlyphs] = useState<Glyphs | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof navigator.getGamepads !== "function") return;
    const root = document.documentElement;
    window.fqClientGamepad = true;
    let frame = 0;
    let id = "";
    const controller = createPadController({
      getPads,
      actions: pageActions(),
      onInput: (pad) => {
        if (root.dataset.input !== "pad") root.dataset.input = "pad";
        if (pad.id !== id) {
          id = pad.id;
          setGlyphs(glyphsFor(pad.id));
        }
      },
    });
    const loop = (now: number) => {
      controller.poll(now);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    // The mouse's last position. A browser also fires `pointermove` when the page moves under a
    // still mouse (a scroll, a layout change): those carry the same position and must not hand the
    // screen back. `movementX` says so directly, but not every engine fills it in (WebKit may
    // leave it at 0 for a real move), so a changed position counts too.
    let at: { x: number; y: number } | null = null;
    const pointer = (e: Event) => {
      // A real mouse move, a click, a key or a touch hands the screen back to the mouse and keys.
      if (e.type === "pointermove") {
        const p = e as PointerEvent;
        if (p.pointerType !== "mouse") return;
        const moved =
          (p.movementX ?? 0) !== 0 ||
          (p.movementY ?? 0) !== 0 ||
          (at !== null && (p.clientX !== at.x || p.clientY !== at.y));
        at = { x: p.clientX, y: p.clientY };
        if (!moved) return;
      }
      if (root.dataset.input !== "pointer") root.dataset.input = "pointer";
    };
    const events = ["pointerdown", "pointermove", "keydown", "touchstart", "wheel"] as const;
    for (const ev of events) window.addEventListener(ev, pointer, { passive: true, capture: true });
    return () => {
      cancelAnimationFrame(frame);
      controller.reset();
      for (const ev of events) window.removeEventListener(ev, pointer, { capture: true });
      delete window.fqClientGamepad;
      delete root.dataset.input;
    };
  }, []);

  return (
    <>
      {children}
      {glyphs && <PadHints glyphs={glyphs} />}
    </>
  );
}

/** The glyph bar: what each button does here. Hidden unless `<html data-input="pad">` (CSS). */
function PadHints({ glyphs }: { glyphs: Glyphs }) {
  const t = useT();
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const update = () =>
      setTyping(
        isTextField(document.activeElement) || document.activeElement?.closest("form") != null,
      );
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    update();
    return () => {
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
    };
  }, []);
  const items = useMemo(
    () =>
      [
        { key: glyphs.a, label: t("pad.press") },
        { key: glyphs.b, label: t("pad.back") },
        ...(typing ? [{ key: glyphs.x, label: t("pad.submit") }] : []),
        { key: `${glyphs.lb} ${glyphs.rb}`, label: t("pad.scroll") },
        { key: glyphs.start, label: t("pad.settings") },
      ] as { key: string; label: string }[],
    [glyphs, typing, t],
  );
  return (
    <ul className="fq-padhints" data-family={glyphs.family} aria-label={t("pad.region")}>
      {items.map((i) => (
        <li key={i.label}>
          <span className="fq-padkey" aria-hidden="true">
            {i.key}
          </span>
          <span>{i.label}</span>
        </li>
      ))}
    </ul>
  );
}
