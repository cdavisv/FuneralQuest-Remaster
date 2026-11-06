/**
 * Gamepad support owned by the client (the desktop and mobile wrappers used to patch around it
 * with synthetic key events). Everything here follows the browser's Gamepad API "standard" layout
 * and is plain functions plus one small controller, so it can be driven by a synthetic pad in a
 * test: `createPadController({ getPads, ... }).poll(now)` once per frame.
 *
 * - D-pad and left stick move the focus to the nearest control in that direction (buttons, cards,
 *   the map's places, form fields, tabs), inside the top dialog when there is one.
 * - A presses the focused control (a text field is focused instead; its on-screen keyboard is the
 *   platform's job), B goes back (`window.fqHandleBack`: close the dialog, else the screen's own
 *   Back or Leave), X submits the form the focus is in (a prompt, the cafe's box, a sign-up),
 *   the shoulder buttons (and the right stick) scroll the text panel, Start opens Settings.
 */

export type Dir = "up" | "down" | "left" | "right";

/** Standard-mapping button indices. */
export const PAD = {
  a: 0,
  b: 1,
  x: 2,
  y: 3,
  lb: 4,
  rb: 5,
  select: 8,
  start: 9,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
} as const;

export interface PadLike {
  index: number;
  id: string;
  buttons: readonly { pressed: boolean; value?: number }[];
  axes: readonly number[];
  connected?: boolean;
}

/** Labels for the face buttons, by the family of pad (the standard mapping's A is the bottom one). */
export interface Glyphs {
  family: "xbox" | "playstation" | "nintendo" | "generic";
  a: string;
  b: string;
  x: string;
  y: string;
  lb: string;
  rb: string;
  start: string;
}

export function glyphsFor(id: string): Glyphs {
  const lower = id.toLowerCase();
  if (/054c|sony|playstation|dualshock|dualsense|ps[345]/.test(lower)) {
    return {
      family: "playstation",
      a: "✕",
      b: "○",
      x: "□",
      y: "△",
      lb: "L1",
      rb: "R1",
      start: "Options",
    };
  }
  if (/057e|nintendo|switch|joy-con|pro controller/.test(lower)) {
    // The bottom button is labelled B on a Nintendo pad, and the right one A.
    return { family: "nintendo", a: "B", b: "A", x: "Y", y: "X", lb: "L", rb: "R", start: "+" };
  }
  if (/xbox|xinput|045e|microsoft/.test(lower)) {
    return { family: "xbox", a: "A", b: "B", x: "X", y: "Y", lb: "LB", rb: "RB", start: "Menu" };
  }
  return { family: "generic", a: "A", b: "B", x: "X", y: "Y", lb: "LB", rb: "RB", start: "Start" };
}

// ---- finding the nearest control ----------------------------------------------------------

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const center = (b: Box) => ({ x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 });

/**
 * The index of the box to move to from `from` in direction `dir`, or -1. A candidate must lie
 * that way (by its centre); the best is the one with the smallest gap along the direction, with
 * the sideways offset counted double and a penalty when it does not overlap `from` sideways at
 * all, so a button in the same row or column wins over a nearer one that is off to the side.
 */
export function nearestBox(from: Box, boxes: readonly Box[], dir: Dir): number {
  const f = center(from);
  let best = -1;
  let bestScore = Number.POSITIVE_INFINITY;
  boxes.forEach((b, i) => {
    const c = center(b);
    const horizontal = dir === "left" || dir === "right";
    const along = horizontal
      ? dir === "right"
        ? c.x - f.x
        : f.x - c.x
      : dir === "down"
        ? c.y - f.y
        : f.y - c.y;
    if (along <= 1) return;
    const across = Math.abs(horizontal ? c.y - f.y : c.x - f.x);
    const gap = horizontal
      ? Math.max(0, dir === "right" ? b.left - from.right : from.left - b.right)
      : Math.max(0, dir === "down" ? b.top - from.bottom : from.top - b.bottom);
    const overlap = horizontal
      ? Math.min(from.bottom, b.bottom) - Math.max(from.top, b.top)
      : Math.min(from.right, b.right) - Math.max(from.left, b.left);
    // Behind the far edge of the direction's cone (more sideways than forward) is a last resort.
    const cone = across > along * 2.5 ? 400 : 0;
    const score = gap + along * 0.25 + across * 2 + (overlap > 0 ? 0 : 60) + cone;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The part of the page the pad moves in: the top modal dialog, else the whole page. */
export function navScope(doc: Document = document): ParentNode {
  const dialogs = doc.querySelectorAll('[role="dialog"][aria-modal="true"], [role="alertdialog"]');
  return dialogs.length > 0 ? (dialogs[dialogs.length - 1] as Element) : doc;
}

function boxOf(el: HTMLElement): Box | null {
  let r = el.getBoundingClientRect();
  // A radio or checkbox hidden under its label (the skull icons): the label is the target.
  if ((r.width < 4 || r.height < 4) && el instanceof HTMLInputElement && el.labels?.[0]) {
    r = el.labels[0].getBoundingClientRect();
  }
  if (r.width < 4 || r.height < 4) return null;
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
}

function usable(el: HTMLElement): boolean {
  if (el.closest("[inert], [hidden], [aria-hidden='true']")) return false;
  const style = getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none";
}

/** Every control the pad may land on, with its box, in document order. */
export function focusTargets(scope: ParentNode = navScope()): { el: HTMLElement; box: Box }[] {
  const out: { el: HTMLElement; box: Box }[] = [];
  for (const el of scope.querySelectorAll<HTMLElement>(FOCUSABLE)) {
    if (!usable(el)) continue;
    const box = boxOf(el);
    if (box) out.push({ el, box });
  }
  return out;
}

/** The control to start from when nothing sensible has the focus. */
export function firstTarget(scope: ParentNode = navScope()): HTMLElement | null {
  const preferred = scope.querySelector<HTMLElement>("[data-autofocus]");
  if (preferred && usable(preferred)) return preferred;
  const targets = focusTargets(scope);
  const main = targets.find(
    (t) =>
      t.el.matches(".fq-r-buttons [data-button-id], .fq-r-buttons button") &&
      !t.el.closest(".fq-orb"),
  );
  return (main ?? targets[0])?.el ?? null;
}

export function focusEl(el: HTMLElement): void {
  try {
    (el.focus as (o?: { focusVisible?: boolean; preventScroll?: boolean }) => void)({
      focusVisible: true,
    });
  } catch {
    el.focus();
  }
  el.scrollIntoView?.({ block: "nearest", inline: "nearest" });
}

/** Moves the focus one step in a direction. Returns true when it moved. */
export function moveFocus(dir: Dir, doc: Document = document): boolean {
  const scope = navScope(doc);
  const active = doc.activeElement;
  const here =
    active instanceof HTMLElement && active !== doc.body && scope.contains(active) ? active : null;
  if (!here) {
    const first = firstTarget(scope);
    if (first) focusEl(first);
    return first !== null;
  }
  const fromBox = boxOf(here);
  if (!fromBox) return false;
  const targets = focusTargets(scope).filter((t) => t.el !== here);
  const at = nearestBox(
    fromBox,
    targets.map((t) => t.box),
    dir,
  );
  const next = targets[at];
  if (!next) return false;
  focusEl(next.el);
  return true;
}

const TEXTUAL = new Set(["text", "search", "password", "email", "url", "tel", "number", ""]);

export function isTextField(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (el instanceof HTMLTextAreaElement) return true;
  return el instanceof HTMLInputElement && TEXTUAL.has(el.type);
}

/** A: press the focused control; a text field is focused (and selected) for the keyboard. */
export function pressFocused(doc: Document = document): void {
  const active = doc.activeElement;
  if (!(active instanceof HTMLElement) || active === doc.body || !navScope(doc).contains(active)) {
    const first = firstTarget(navScope(doc));
    if (first) focusEl(first);
    return;
  }
  if (isTextField(active)) {
    active.focus();
    active.select?.();
    return;
  }
  active.click();
}

/** X: submit the form the focus is in (a prompt, the cafe's box, a sign-up form). */
export function submitFocused(doc: Document = document): boolean {
  const active = doc.activeElement;
  const form = active instanceof HTMLElement ? active.closest("form") : null;
  if (!form) return false;
  if (typeof form.requestSubmit === "function") form.requestSubmit();
  else form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  return true;
}

/** The text panel (`.fq-textscroll`) the shoulder buttons scroll; a scrolling panel in a dialog first. */
export function scrollText(amount: number, doc: Document = document): void {
  const scope = navScope(doc);
  const el = scope.querySelector<HTMLElement>(
    ".fq-textscroll, .fq-up-scroll, .fq-ballots-scroll, .fq-bank-scroll",
  );
  if (!el) return;
  el.scrollBy({ top: amount * Math.max(40, el.clientHeight * 0.8), behavior: "smooth" });
}

// ---- the controller -----------------------------------------------------------------------

export interface PadActions {
  move(dir: Dir): void;
  press(): void;
  back(): void;
  submit(): void;
  scroll(amount: number): void;
  settings(): void;
}

export interface PadControllerOptions {
  getPads(): readonly (PadLike | null)[];
  actions: PadActions;
  /** A pad button or stick was used (true), or the player went back to the mouse (false is the caller's). */
  onInput?(pad: PadLike): void;
}

/** First repeat after this long, then this often, for a held direction. */
export const REPEAT_FIRST_MS = 380;
export const REPEAT_EVERY_MS = 130;
export const STICK = 0.55;

export interface PadController {
  /** Reads the pads once: call every animation frame with a clock in milliseconds. */
  poll(now: number): void;
  reset(): void;
}

export function createPadController(options: PadControllerOptions): PadController {
  const held = new Map<string, number>();
  const { actions } = options;

  /** Fires `fire` on a new press, then on repeat while held (when `repeat`). */
  const edge = (key: string, down: boolean, now: number, repeat: boolean, fire: () => void) => {
    const next = held.get(key);
    if (down) {
      if (next === undefined) {
        held.set(key, now + REPEAT_FIRST_MS);
        fire();
      } else if (repeat && now >= next) {
        held.set(key, now + REPEAT_EVERY_MS);
        fire();
      }
    } else if (next !== undefined) held.delete(key);
  };

  return {
    poll(now) {
      for (const pad of options.getPads()) {
        if (!pad || pad.connected === false) continue;
        const key = (name: string) => `${pad.index}:${name}`;
        const pressed = (i: number) => pad.buttons[i]?.pressed === true;
        let used = false;
        const act = (fn: () => void) => () => {
          used = true;
          fn();
        };
        const dirs: [Dir, boolean][] = [
          ["up", pressed(PAD.up) || (pad.axes[1] ?? 0) < -STICK],
          ["down", pressed(PAD.down) || (pad.axes[1] ?? 0) > STICK],
          ["left", pressed(PAD.left) || (pad.axes[0] ?? 0) < -STICK],
          ["right", pressed(PAD.right) || (pad.axes[0] ?? 0) > STICK],
        ];
        for (const [dir, down] of dirs)
          edge(
            key(dir),
            down,
            now,
            true,
            act(() => actions.move(dir)),
          );
        edge(key("a"), pressed(PAD.a), now, false, act(actions.press));
        edge(key("b"), pressed(PAD.b), now, false, act(actions.back));
        edge(key("x"), pressed(PAD.x), now, false, act(actions.submit));
        edge(
          key("lb"),
          pressed(PAD.lb),
          now,
          true,
          act(() => actions.scroll(-1)),
        );
        edge(
          key("rb"),
          pressed(PAD.rb),
          now,
          true,
          act(() => actions.scroll(1)),
        );
        edge(key("start"), pressed(PAD.start), now, false, act(actions.settings));
        // The right stick scrolls continuously.
        const ry = pad.axes[3] ?? 0;
        if (Math.abs(ry) > STICK) {
          edge(
            key("ry"),
            true,
            now,
            true,
            act(() => actions.scroll(ry > 0 ? 0.5 : -0.5)),
          );
        } else edge(key("ry"), false, now, true, () => undefined);
        if (
          used ||
          pad.buttons.some((b) => b.pressed) ||
          pad.axes.some((a) => Math.abs(a) > STICK)
        ) {
          options.onInput?.(pad);
        }
      }
    },
    reset() {
      held.clear();
    },
  };
}

/** The real actions, acting on the page. */
export function pageActions(doc: Document = document, win: Window = window): PadActions {
  return {
    move: (dir) => void moveFocus(dir, doc),
    press: () => pressFocused(doc),
    back: () => {
      if (win.fqHandleBack?.() === true) return;
      // Nothing to go back out of: a text field gives up the focus.
      const active = doc.activeElement;
      if (isTextField(active)) active.blur();
    },
    submit: () => void submitFocused(doc),
    scroll: (amount) => scrollText(amount, doc),
    settings: () => win.dispatchEvent(new CustomEvent("fq:settings")),
  };
}
