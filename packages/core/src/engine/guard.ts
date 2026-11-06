import type { Action, View } from "@fq/protocol";

/**
 * Checks an action against the view the player was last sent. Returns null
 * when it is allowed, or the reason it is not. This generalises the
 * original's single callback check (`location_callback_ok`,
 * legacy/source/location_data.cpp:5-15) to every button and overlay.
 */
export function checkAction(
  view: View | null,
  action: Exclude<Action, { type: "exit" }>,
): string | null {
  if (!view) return "No screen has been shown yet";
  switch (action.type) {
    case "press": {
      if (view.overlay) return "Answer the overlay first";
      const found = view.buttons.find((b) => b.id === action.buttonId);
      if (!found) return `Button ${action.buttonId} is not on screen`;
      if (found.enabled === false) return `Button ${action.buttonId} is disabled`;
      return null;
    }
    case "visit":
      if (view.overlay) return "Answer the overlay first";
      return view.map?.some((p) => p.id === action.placeId)
        ? null
        : `Place ${action.placeId} is not on screen`;
    case "submitText": {
      const o = view.overlay;
      if (o?.kind !== "textInput" || o.id !== action.overlayId) return "No such text prompt";
      if (action.text !== null && action.text.length > o.maxLength) return "Text is too long";
      return null;
    }
    case "pickPlayer": {
      const o = view.overlay;
      if (o?.kind !== "playerPicker" || o.id !== action.overlayId) return "No such player picker";
      if (action.playerId !== null && !o.players.some((p) => p.id === action.playerId)) {
        return "That player was not offered";
      }
      return null;
    }
    case "confirm": {
      const o = view.overlay;
      return o?.kind === "confirm" && o.id === action.overlayId ? null : "No such question";
    }
    case "dismiss": {
      const o = view.overlay;
      return o?.kind === "message" && o.id === action.overlayId ? null : "No such message";
    }
    case "chat":
      return view.scene === "cafe" && !view.overlay ? null : "Chat is not available here";
  }
}
