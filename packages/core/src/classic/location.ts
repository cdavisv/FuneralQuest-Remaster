import type { AssetId, Button, Picture, View } from "@fq/protocol";
import type { Turn } from "../engine/turn.js";
import { button, goButton, hud, legacy } from "../engine/view.js";
import type { Json } from "../state/types.js";
import { emptyCustomer } from "./customerText.js";

/**
 * `init_location_info` (legacy/source/location_data.cpp:17-24): clears the
 * customer and dealing state and names the player's location.
 */
export function enterLocation(turn: Turn, name: string, sceneData: Json = null): void {
  const s = turn.session;
  s.customer = emptyCustomer();
  s.hisId = -1;
  s.locked = false;
  s.location = name;
  s.sceneData = sceneData;
}

/** The desk menu (the `m_main` buttons of the original client), left to right. */
export function deskMenu(turn: Turn): Button[] {
  const m = turn.text.desk.menu;
  return [
    button("desk:wait", m.wait),
    goButton("map", m.map),
    goButton("news", m.news),
    goButton("stats", m.stats),
    goButton("rankings", m.rankings),
    goButton("mailbox", turn.text.social.mail.writeLabel),
    button("desk:quit", m.quit),
  ];
}

export function continueButton(turn: Turn): Button {
  return goButton("desk", turn.text.desk.continueLabel);
}

/**
 * The background still on screen. The original client kept `st_url_bg`
 * until a packet replaced it or a new screen object was loaded; handlers
 * that only "load a movie" call this to keep it.
 */
export function currentBackground(turn: Turn): AssetId | undefined {
  return turn.session.view?.picture?.bg;
}

export function makePicture(
  fg: AssetId | null | undefined,
  bg: AssetId | null | undefined,
): Picture {
  const pic: Picture = {};
  if (fg) pic.fg = fg;
  if (bg) pic.bg = bg;
  return pic;
}

/** A view on the desk screen (`m_main`). */
export function deskScreen(
  turn: Turn,
  text: string,
  options: { fg?: AssetId | null; bg?: AssetId | null; buttons?: Button[] } = {},
): View {
  return {
    scene: "desk",
    title: turn.text.desk.title,
    text: legacy(text),
    picture: makePicture(options.fg, options.bg),
    hud: hud(turn.player),
    buttons: options.buttons ?? deskMenu(turn),
  };
}
