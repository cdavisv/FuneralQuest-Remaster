import type { Action, Button, RichText, View } from "@fq/protocol";

/**
 * Reading a View the way a player reads the screen: text, labels, the HUD
 * and the panels. Nothing here can reach the town.
 */

export function plain(text: RichText | undefined): string {
  return text ? text.map((span) => span.text).join("") : "";
}

/** The main text, the note and the status line, and the overlay's text or prompt. */
export function screenText(view: View): string {
  const parts = [plain(view.text), plain(view.note), plain(view.status)];
  const o = view.overlay;
  if (o?.kind === "message" || o?.kind === "confirm") parts.push(plain(o.text));
  if (o?.kind === "textInput" || o?.kind === "playerPicker") parts.push(o.prompt);
  return parts.join("\n");
}

export function enabledButtons(view: View): Button[] {
  return view.buttons.filter((b) => b.enabled !== false);
}

export function hasButton(view: View, id: string): boolean {
  return !view.overlay && enabledButtons(view).some((b) => b.id === id);
}

export function buttonByLabel(view: View, pattern: RegExp): Button | undefined {
  if (view.overlay) return undefined;
  return enabledButtons(view).find((b) => pattern.test(b.label));
}

export function press(buttonId: string): Action {
  return { type: "press", buttonId };
}

/** "$5,300" or "5,300" to 5300. */
export function money(text: string): number {
  return Number.parseInt(text.replace(/[$,]/g, ""), 10);
}

/** Every dollar amount in the text, in order. */
export function dollars(text: string): number[] {
  return [...text.matchAll(/\$([\d,]+)/g)].map((m) => money(m[1] ?? "0"));
}

/** A short fingerprint of a screen, to notice when nothing is changing. */
export function signature(view: View): string {
  const o = view.overlay;
  const overlay = o ? `${o.kind}:${o.id}` : "";
  const text = screenText(view);
  return `${view.scene}|${view.title}|${view.buttons.map((b) => b.id).join(",")}|${overlay}|${text.length}:${hash(text)}|${view.hud?.turns ?? ""}`;
}

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(h, 31) + text.charCodeAt(i)) | 0;
  return h >>> 0;
}

/** The gold-tag value of all tags on the HUD at bank rates (wood 1, silver 2, gold 4). */
export function goldWorth(view: View): number {
  const t = view.hud?.tags;
  if (!t) return 0;
  return t.gold + Math.floor((t.wood + t.silver * 2) / 4);
}

/**
 * Something harmless to do on a screen the policy does not understand:
 * answer an overlay with "no", or press the button most likely to lead back
 * to the desk or the map. Returns `exit` only when nothing at all is offered.
 */
export function safeAction(view: View): Action {
  const o = view.overlay;
  if (o) {
    switch (o.kind) {
      case "message":
        return { type: "dismiss", overlayId: o.id };
      case "confirm":
        return { type: "confirm", overlayId: o.id, accepted: false };
      case "textInput":
        return { type: "submitText", overlayId: o.id, text: null };
      case "playerPicker":
        return { type: "pickPlayer", overlayId: o.id, playerId: null };
    }
  }
  if (view.map) {
    const home = view.map.find((p) => p.id === "funeral-home") ?? view.map[0];
    if (home) return { type: "visit", placeId: home.id };
  }
  const buttons = enabledButtons(view);
  const preferred = ["go:desk", "go:map"];
  for (const id of preferred) {
    if (buttons.some((b) => b.id === id)) return press(id);
  }
  const back = buttons.find((b) => /^(continue|back|leave|no thanks)$/i.test(b.label));
  if (back) return press(back.id);
  const goes = buttons.find((b) => b.id.startsWith("go:"));
  if (goes) return press(goes.id);
  const any = buttons.find((b) => b.id !== "desk:quit");
  if (any) return press(any.id);
  return { type: "exit" };
}

export function describeAction(action: Action): string {
  switch (action.type) {
    case "press":
      return `press:${action.buttonId}`;
    case "visit":
      return `visit:${action.placeId}`;
    case "submitText":
    case "pickPlayer":
    case "confirm":
    case "dismiss":
      return `${action.type}:${action.overlayId}`;
    case "chat":
      return "chat";
    case "exit":
      return "exit";
  }
}
