import type { View } from "@fq/protocol";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { goButton, hud, legacy } from "../../engine/view.js";
import { fill } from "../../text/format.js";
import { enterLocation } from "../location.js";
import { broadcastChat } from "../mail.js";

/** The town map (legacy/source/commands_map.cpp). */
export const MAP = "map";

/** `command_map` (commands_map.cpp:3-30): leaves the cafe if needed and lists the places. */
function enterMap(turn: Turn): View {
  const s = turn.session;
  const wasChatting = s.status === "chat";
  s.status = "play";
  if (wasChatting) broadcastChat(turn, `\`5${turn.player.name} steps outside.`);
  enterLocation(turn, turn.text.map.title);
  return {
    scene: "map",
    title: turn.text.map.title,
    text: [],
    hud: hud(turn.player),
    map: turn.registry.places.map((p) => ({ id: p.id, label: p.label })),
    buttons: [],
  };
}

export const mapModule: LocationModule = {
  id: MAP,
  enter: (turn) => enterMap(turn),
};

/**
 * The view for a place or flow that has no module yet: a "not built yet"
 * screen with a Leave button (back to the map for places, the desk otherwise).
 */
export function notBuiltView(turn: Turn, moduleOrPlace: string): View {
  const place =
    turn.registry.place(moduleOrPlace) ??
    turn.registry.places.find((p) => p.module === moduleOrPlace);
  const label = place?.label ?? moduleOrPlace;
  enterLocation(turn, label);
  turn.session.scene = moduleOrPlace;
  return {
    scene: "location",
    title: label,
    text: legacy(fill(turn.text.stub.notBuilt, { place: label })),
    picture: {},
    hud: hud(turn.player),
    buttons: [goButton(place ? MAP : "desk", turn.text.stub.leaveLabel)],
  };
}
