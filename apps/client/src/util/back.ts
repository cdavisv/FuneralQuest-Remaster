import type { Button, View } from "@fq/protocol";
import { useEffect, useRef } from "react";

/**
 * The Android back button (apps/mobile/glue/fq-mobile.ts calls `window.fqHandleBack()` after it
 * has closed its own dialog and the client's top dialog). Whoever knows how to go back from the
 * screen on show registers a handler; the newest registration is asked first, and each answers
 * whether it handled the press (false lets the wrapper do its own thing: step back through the
 * page's history, or ask "Leave Funeral Quest?").
 */
type Handler = () => boolean;
const stack: Handler[] = [];

function handleBack(): boolean {
  for (let i = stack.length - 1; i >= 0; i--) {
    const handler = stack[i];
    if (handler?.()) return true;
  }
  return false;
}

export function registerBack(handler: Handler): () => void {
  stack.push(handler);
  if (typeof window !== "undefined") window.fqHandleBack = handleBack;
  return () => {
    const at = stack.lastIndexOf(handler);
    if (at >= 0) stack.splice(at, 1);
    if (stack.length === 0 && typeof window !== "undefined") delete window.fqHandleBack;
  };
}

/** Registers `handler` for as long as the component is mounted; it always sees the latest props. */
export function useBackHandler(handler: Handler): void {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => registerBack(() => latest.current()), []);
}

/** The engine names a way back `<place>:main` or `<place>:back` (a card screen's Back), `go:<place>` (Back or Leave). */
const WAY_BACK = /^go:[\w-]+$|:main$|:back$/;

/**
 * The View's own Back or Leave button: the last enabled button that goes back to a place or a
 * parent screen (the engine lists it last). The desk has none (its `go:` buttons go forward, and
 * Exit asks first), nor does a sale in progress (nothing there should be done by accident).
 */
export function backButton(view: View): Button | undefined {
  if (view.scene === "desk" || view.scene === "lobby" || view.overlay) return undefined;
  for (let i = view.buttons.length - 1; i >= 0; i--) {
    const b = view.buttons[i];
    if (b && b.enabled !== false && WAY_BACK.test(b.id)) return b;
  }
  return undefined;
}
