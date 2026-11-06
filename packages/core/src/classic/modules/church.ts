import type { LocationModule } from "../../engine/registry.js";
import { enterLocation } from "../location.js";
import type { ScriptApi, ScriptDef, ScriptGen } from "../scripts/runtime.js";
import { startScript } from "../scripts/runtime.js";
import { SCRIPT } from "./scripts.js";

/**
 * The church: `script/public/church.c` (UTF-16; `iconv -f UTF-16`). The
 * original had a C++ `command_church` too (commands_church.cpp), but the
 * history file says "the church is now completely run by script", and the
 * map starts the script through `CommandScript` (command_script.cpp:73-85),
 * which sets the location "Script" until the script's `SetLocation("Church")`.
 */
export const CHURCH = "church";

const home = { slot: 1, label: "Leave", target: { go: "map" } } as const;

/**
 * church.c `Main`: one screen with a single Leave button that goes to the
 * town map. The `main_menu` loop answers result 1 with a line from the
 * father, but no button in the script returns 1, so only the first screen
 * is ever shown; the loop is kept so the port reads like the script.
 */
export const churchScript: ScriptDef = {
  id: "public/church",
  location: "Church",
  *main(s: ScriptApi): ScriptGen {
    const name = yield* s.getName(s.myId);
    let reply = yield* s.show({
      mode: "screen",
      fresh: true,
      note: "Father Smyth greets you warmly, a little too warmly.  You wonder if he has anything on under that robe.",
      status: "",
      text: `\`wFather Smyth: \`y"Why hello there, ${name}.  Isn't it a wonderfully fantastic day today?  Praise the Lord."`,
      background: "background/background_church",
      picture: "people/churchguy_h",
      buttons: [home],
    });
    for (;;) {
      // main_menu: (church.c:25-43)
      const text =
        reply === 1 ? '`wFather Smyth: `y"Hi there.  I already said hi though."' : undefined;
      reply = yield* s.show({
        mode: "screen",
        ...(text !== undefined ? { text } : {}),
        buttons: [home],
      });
    }
  },
};

export const churchModule: LocationModule = {
  id: CHURCH,
  enter(turn) {
    enterLocation(turn, "Script");
    turn.session.scene = SCRIPT;
    return startScript(turn, churchScript.id);
  },
};
