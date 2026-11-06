import type { LocationModule } from "../../engine/registry.js";
import { enterLocation } from "../location.js";
import { resumeScript, startScript } from "../scripts/runtime.js";

/** Buttons and overlays of a running scene script (`c_request_script_callback`). */
export const SCRIPT = "script";

export const scriptModule: LocationModule = {
  id: SCRIPT,
  press(turn, command) {
    const result = Number(command);
    if (!turn.session.script || !Number.isInteger(result)) throw new Error("No script is waiting");
    return resumeScript(turn, result);
  },
  pickPlayer(turn, overlayId, playerId) {
    if (overlayId !== "script:getname" || !turn.session.script)
      throw new Error("No script is waiting");
    // command_getname: an unknown or deleted player comes back as -1.
    const valid = playerId !== null && turn.town.players[playerId]?.active === true;
    return resumeScript(turn, valid ? (playerId as number) : -1);
  },
};

/** The stats button (`c_request_stats`, commands.cpp:80-83): runs script/stats.c. */
export const statsModule: LocationModule = {
  id: "stats",
  enter(turn) {
    enterLocation(turn, "Stats");
    turn.session.scene = SCRIPT;
    return startScript(turn, "stats");
  },
};
