import type { View } from "@fq/protocol";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { button } from "../../engine/view.js";
import { fill } from "../../text/format.js";
import { stripLegacyCodes } from "../../text/legacyText.js";
import { enterLocation } from "../location.js";
import { stripDangerous } from "../newPlayer.js";
import { addToNews } from "../news.js";
import { newScreen, refreshScreen, slotButtons, withOverlay } from "../placeView.js";
import { findPlayerByName, playerHis } from "../players.js";
import { swearCheck } from "../swearFilter.js";

/**
 * Name change, reached from the Name button of the stats sheet
 * (legacy/source/command_options.cpp). It costs `GameSettings.nameChangeCost`
 * gold tags; 0 or less turns it off. The name prompt is the overlay
 * `options:name`.
 */
export const OPTIONS = "options";

/** Longest text the name prompt accepts; the 20-character limit is checked on the result (:156). */
const PROMPT_LENGTH = 60;
const GOLD = 2;

/** `command_options` (command_options.cpp:29-79). */
function enterOptions(turn: Turn): View {
  const t = turn.text.places.options;
  const cost = turn.settings.nameChangeCost;
  enterLocation(turn, t.location);
  if (cost < 1) {
    return newScreen(turn, {
      title: t.location,
      status: "",
      text: t.noChange,
      fg: "stuff/question",
      buttons: [button("go:stats", t.buttons.continue)],
    });
  }
  return newScreen(turn, {
    title: t.location,
    note: t.note,
    status: "",
    text: fill(t.ask, { cost }),
    fg: "stuff/question",
    buttons: slotButtons([
      { slot: 2, label: t.buttons.yes, id: `${OPTIONS}:input` },
      { slot: 1, label: t.buttons.no, id: "go:stats" },
    ]),
  });
}

/** `change_name_input` (:81-96). */
function nameInput(turn: Turn): View {
  return withOverlay(turn, {
    kind: "textInput",
    id: `${OPTIONS}:name`,
    prompt: stripLegacyCodes(turn.text.places.options.prompt),
    maxLength: PROMPT_LENGTH,
  });
}

/**
 * `options_process_name` (:98-211), checks in the original's order: strip
 * dangerous characters, swear filter, abort, enough gold, same name, 3 to 20
 * characters, not another player's name; then pay, announce and rename.
 */
function processName(turn: Turn, answer: string | null): View {
  const t = turn.text.places.options;
  const cost = turn.settings.nameChangeCost;
  if (cost < 1) throw new Error("Name changes are off");
  const me = turn.player;
  const name = swearCheck(
    stripDangerous((answer ?? "").trim()),
    turn.content.swearWords,
    turn.settings.swearFilter,
  );
  if (answer === null) return enterOptions(turn); // "12ABORT12" (:114-118)
  const again = (text: string) =>
    refreshScreen(turn, { text, buttons: [button("go:options", t.buttons.continue)] });
  if ((me.tags[GOLD] ?? 0) < cost) {
    return refreshScreen(turn, {
      text: t.noGold,
      buttons: [button("go:stats", t.buttons.continue)],
    });
  }
  if (name === me.name) return again(fill(t.same, { name }));
  if (name.length < turn.rules.newPlayer.nameMin) return again(t.short);
  if (name.length > turn.rules.newPlayer.nameMax) return again(t.long);
  const used = findPlayerByName(turn.town, name);
  if (used !== -1 && used !== me.id) return again(fill(t.taken, { name }));
  me.tags[GOLD] = (me.tags[GOLD] ?? 0) - cost;
  addToNews(turn.town, fill(t.news, { old: me.name, his: playerHis(me), new: name }));
  me.name = name;
  return refreshScreen(turn, {
    text: fill(t.done, { name }),
    buttons: [button("go:stats", t.buttons.continue)],
  });
}

export const optionsModule: LocationModule = {
  id: OPTIONS,
  enter: (turn) => enterOptions(turn),
  press(turn, command) {
    if (command === "input") {
      if (turn.settings.nameChangeCost < 1) throw new Error("Name changes are off");
      return nameInput(turn);
    }
    throw new Error(`Unknown options command ${command}`);
  },
  submitText(turn, overlayId, text) {
    if (overlayId !== `${OPTIONS}:name`) throw new Error(`Unknown prompt ${overlayId}`);
    return processName(turn, text);
  },
};
