import type { AssetId, Button, Overlay, View } from "@fq/protocol";
import type { Turn } from "../engine/turn.js";
import { button, hud, legacy } from "../engine/view.js";

/** `add_button` (legacy/source/funeral_util.cpp:10-31): slot 1 is the rightmost button, 5 the leftmost. */
export interface SlotButton {
  slot: number;
  label: string;
  id: string;
}

/** Orders slot buttons left to right, as the client laid them out. */
export function slotButtons(list: SlotButton[]): Button[] {
  return [...list].sort((a, b) => b.slot - a.slot).map((b) => button(b.id, b.label));
}

export interface PlaceScreen {
  /** Place name for the window title. */
  title: string;
  /** `st_main`, legacy markup. */
  text: string;
  buttons: Button[];
  /** `st_generic_info`. */
  note?: string;
  /** `st_generic_status`. */
  status?: string;
  /** `st_url`. */
  fg?: AssetId | null;
  /** `st_url_bg`. */
  bg?: AssetId | null;
}

/**
 * A new generic screen (`st_object` = `i_generic`, `c_command_object`): the
 * client starts from a blank screen, so only what is given is shown.
 */
export function newScreen(turn: Turn, s: PlaceScreen): View {
  const view: View = {
    scene: "location",
    title: s.title,
    text: legacy(s.text),
    hud: hud(turn.player),
    buttons: s.buttons,
  };
  if (s.note) view.note = legacy(s.note);
  if (s.status) view.status = legacy(s.status);
  const picture: View["picture"] = {};
  if (s.fg) picture.fg = s.fg;
  if (s.bg) picture.bg = s.bg;
  view.picture = picture;
  return view;
}

/**
 * A refresh of the screen already shown (`c_command_generic`): fields that
 * are not given keep what the client was already showing, so the text and
 * buttons change and pictures, note and status stay unless named. `null`
 * clears a picture (the original sent an empty URL).
 */
export function refreshScreen(
  turn: Turn,
  s: Omit<PlaceScreen, "title"> & { title?: string },
): View {
  const previous = turn.session.view;
  const view: View = {
    scene: "location",
    title: s.title ?? previous?.title ?? turn.session.location,
    text: legacy(s.text),
    hud: hud(turn.player),
    buttons: s.buttons,
  };
  if (s.note !== undefined) {
    if (s.note !== "") view.note = legacy(s.note);
  } else if (previous?.note) view.note = previous.note;
  if (s.status !== undefined) {
    if (s.status !== "") view.status = legacy(s.status);
  } else if (previous?.status) view.status = previous.status;
  const picture: NonNullable<View["picture"]> = { ...(previous?.picture ?? {}) };
  if (s.fg !== undefined) {
    if (s.fg === null) delete picture.fg;
    else picture.fg = s.fg;
  }
  if (s.bg !== undefined) {
    if (s.bg === null) delete picture.bg;
    else picture.bg = s.bg;
  }
  view.picture = picture;
  return view;
}

/**
 * The screen already shown with an overlay on top (`c_command_object_add`:
 * the text box or name picker is added over the current screen). Buttons are
 * hidden while it is open, as the script runtime does.
 */
export function withOverlay(turn: Turn, overlay: Overlay): View {
  const previous = turn.session.view;
  if (!previous) throw new Error("No screen is showing");
  const { overlay: _old, ...rest } = previous;
  return { ...rest, hud: hud(turn.player), buttons: [], overlay };
}
