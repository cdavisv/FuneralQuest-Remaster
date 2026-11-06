import type { View } from "@fq/protocol";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { button } from "../../engine/view.js";
import { fill } from "../../text/format.js";
import { enterLocation } from "../location.js";
import { newScreen } from "../placeView.js";

/**
 * The hospital (legacy/source/command_hospital.cpp). Walking in only gets a
 * greeting from the nurse; the sick room is where a player who lost a battle
 * wakes up (`command_hospital_room`, called from commands_battle.cpp:658).
 *
 * `go:hospital:room` or `enterHospitalRoom` shows the bed; its Leave button
 * is `hospital:leave-room`.
 */
export const HOSPITAL = "hospital";

/** `command_hospital` (command_hospital.cpp:21-49): the front desk. */
function enterDesk(turn: Turn): View {
  const t = turn.text.places.hospital;
  enterLocation(turn, t.location);
  return newScreen(turn, {
    title: t.location,
    note: t.note,
    status: "",
    text: fill(t.greeting, { player: turn.player.name }),
    bg: "places/hospital_desk",
    buttons: [button("go:map", t.leave)],
  });
}

/**
 * `command_hospital_room` (command_hospital.cpp:51-74): the hospital bed. The
 * original also turned the battle meters off (`b_show_battle` 2); a view
 * without a `battle` panel does that here.
 */
export function enterHospitalRoom(turn: Turn): View {
  const t = turn.text.places.hospital;
  enterLocation(turn, t.location);
  turn.session.scene = HOSPITAL;
  return newScreen(turn, {
    title: t.location,
    note: t.roomNote,
    status: "",
    text: t.roomText,
    bg: "places/hospital_room",
    fg: "blank",
    buttons: [button(`${HOSPITAL}:leave-room`, t.leave)],
  });
}

/** `command_hospital_leave_room` (command_hospital.cpp:76-103). */
function leaveRoom(turn: Turn): View {
  const t = turn.text.places.hospital;
  const prince = turn.player.male ? t.princeMale : t.princeFemale;
  return newScreen(turn, {
    title: t.location,
    note: t.note,
    status: "",
    text: fill(t.wakeUp, { prince }),
    bg: "places/hospital_desk",
    buttons: [button("go:map", t.leave)],
  });
}

export const hospitalModule: LocationModule = {
  id: HOSPITAL,
  enter: (turn, arg) => (arg === "room" ? enterHospitalRoom(turn) : enterDesk(turn)),
  press(turn, command) {
    if (command === "leave-room") return leaveRoom(turn);
    throw new Error(`Unknown hospital command ${command}`);
  },
};
