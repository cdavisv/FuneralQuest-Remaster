import type { View } from "@fq/protocol";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { button } from "../../engine/view.js";
import { fill, replaceAll } from "../../text/format.js";
import { enterLocation } from "../location.js";
import { atoi } from "../parse.js";
import { newScreen, refreshScreen, slotButtons, withOverlay } from "../placeView.js";
import { topPlayer } from "../rankings.js";

/**
 * Spirit University (legacy/source/commands_spirit.cpp): three classes paid
 * in gold tags, and a library with the old papers and the Book of Deeds.
 *
 * Button ids: `spirit-university:psych|hp|strength|main|library|
 * library-restart|paper-start|heroes`. The paper prompt is the overlay
 * `spirit-university:paper`.
 */
export const UNIVERSITY = "spirit-university";

const GOLD = 2;
const f32 = Math.fround;

/** Longest day number the paper prompt accepts (the original client's limit is not in the repository). */
const DAY_LENGTH = 9;

/** `get_psych_cost` (commands_spirit.cpp:139-142): 4 + 2 per level already learned. */
export function psychCost(turn: Turn): number {
  const r = turn.rules.places.university;
  return r.psychBase + turn.player.psych * r.psychPerLevel;
}

/** `get_hp_cost` (:143-147): `int(hp_max * 1.2f)` in 32-bit floats. */
export function hpCost(turn: Turn): number {
  return Math.trunc(f32(turn.player.hpMax * f32(turn.rules.places.university.hpCostFactor)));
}

/** `get_strength_cost` (:148-152): 3 per point of strength. */
export function strengthCost(turn: Turn): number {
  return turn.player.strength * turn.rules.places.university.strengthCostFactor;
}

function schedule(turn: Turn): string {
  return fill(turn.text.places.university.schedule, {
    psych: psychCost(turn),
    hp: hpCost(turn),
    strength: strengthCost(turn),
  });
}

/** `add_class_schedules` buttons (:79-101), left to right: Library, PSY, PE, ST, Leave. */
function scheduleButtons(turn: Turn) {
  const b = turn.text.places.university.buttons;
  return slotButtons([
    { slot: 5, label: b.library, id: `${UNIVERSITY}:library` },
    { slot: 4, label: b.takePsy, id: `${UNIVERSITY}:psych` },
    { slot: 3, label: b.takePe, id: `${UNIVERSITY}:hp` },
    { slot: 2, label: b.takeSt, id: `${UNIVERSITY}:strength` },
    { slot: 1, label: b.leave, id: "go:map" },
  ]);
}

/** `command_spirit` (:114-137): the front screen. */
function enterUniversity(turn: Turn): View {
  const t = turn.text.places.university;
  enterLocation(turn, t.location);
  return newScreen(turn, {
    title: t.location,
    note: t.note,
    status: t.status,
    text: schedule(turn),
    bg: "places/psych",
    buttons: scheduleButtons(turn),
  });
}

/** `command_spirit_menu` (:103-112): the schedule again, on the screen already shown. */
function menu(turn: Turn): View {
  return refreshScreen(turn, { text: schedule(turn), buttons: scheduleButtons(turn) });
}

function continueButton(turn: Turn) {
  return [button(`${UNIVERSITY}:main`, turn.text.places.university.buttons.continue)];
}

/** `command_spirit_psych` (:155-218). */
function takePsych(turn: Turn): View {
  const t = turn.text.places.university;
  const p = turn.player;
  const cost = psychCost(turn);
  if (cost > (p.tags[GOLD] ?? 0)) {
    return refreshScreen(turn, { text: t.cantAfford, buttons: continueButton(turn) });
  }
  p.tags[GOLD] = (p.tags[GOLD] ?? 0) - cost;
  p.psych++;
  // :168-190: a skill message for levels 1 to 5 only.
  const extra = p.psych >= 1 && p.psych <= 5 ? (t.psychSkills[p.psych - 1] ?? "") : "";
  return refreshScreen(turn, {
    text: fill(t.psychDone, { level: p.psych + 1, extra }),
    buttons: continueButton(turn),
  });
}

/** `command_spirit_hp` (:220-252): `random_range(4, 5)` hit points, drawn after paying. */
function takeHp(turn: Turn): View {
  const t = turn.text.places.university;
  const p = turn.player;
  const cost = hpCost(turn);
  if (cost > (p.tags[GOLD] ?? 0)) {
    return refreshScreen(turn, { text: t.cantAfford, buttons: continueButton(turn) });
  }
  p.tags[GOLD] = (p.tags[GOLD] ?? 0) - cost;
  const gain = turn.rng.randomRange(
    turn.rules.places.university.hpGain.min,
    turn.rules.places.university.hpGain.max,
  );
  p.hpMax += gain;
  return refreshScreen(turn, { text: fill(t.hpDone, { hp: gain }), buttons: continueButton(turn) });
}

/** `command_spirit_strength` (:254-286). */
function takeStrength(turn: Turn): View {
  const t = turn.text.places.university;
  const p = turn.player;
  const cost = strengthCost(turn);
  if (cost > (p.tags[GOLD] ?? 0)) {
    return refreshScreen(turn, { text: t.cantAfford, buttons: continueButton(turn) });
  }
  p.tags[GOLD] = (p.tags[GOLD] ?? 0) - cost;
  p.strength += turn.rules.places.university.strengthGain;
  return refreshScreen(turn, { text: t.strengthDone, buttons: continueButton(turn) });
}

/** `add_library_text` (:288-304), buttons left to right: View Deeds, Old Papers, Back. */
function libraryButtons(turn: Turn) {
  const b = turn.text.places.university.buttons;
  return slotButtons([
    { slot: 3, label: b.deeds, id: `${UNIVERSITY}:heroes` },
    { slot: 2, label: b.oldPapers, id: `${UNIVERSITY}:paper-start` },
    { slot: 1, label: b.back, id: `${UNIVERSITY}:main` },
  ]);
}

/** `command_spirit_library` (:306-314). */
function library(turn: Turn): View {
  return refreshScreen(turn, {
    text: turn.text.places.university.library,
    buttons: libraryButtons(turn),
  });
}

/** `command_spirit_library_restart` (:316-340): the library on a new screen, back from a book. */
function libraryRestart(turn: Turn): View {
  const t = turn.text.places.university;
  enterLocation(turn, t.location);
  return newScreen(turn, {
    title: t.location,
    note: t.note,
    status: t.status,
    text: t.library,
    bg: "places/psych",
    buttons: libraryButtons(turn),
  });
}

/** A book on the viewer (`st_object` = `i_view`): the text, the university background, Back. */
function bookView(turn: Turn, text: string): View {
  return newScreen(turn, {
    title: turn.text.places.university.location,
    text,
    bg: "places/psych",
    buttons: [button(`${UNIVERSITY}:library-restart`, turn.text.places.university.buttons.back)],
  });
}

/**
 * `command_spirit_heroes` (:342-388). The Book of Deeds is `deeds.txt`; with
 * no file yet (no tournament won) the book names the current leader.
 */
function heroes(turn: Turn): View {
  const t = turn.text.places.university;
  let text = t.deedsTitle;
  if (turn.town.deeds.length > 0) {
    text += turn.town.deeds.map((line) => `${line}\n`).join("");
  } else {
    text += t.deedsNone;
    const top = turn.town.players[topPlayer(turn.town)];
    if (top) {
      text += fill(t.deedsHope, { name: top.name, he: top.male ? "he" : "she" });
    } else {
      turn.log("Error getting top player in view deeds.");
    }
  }
  return bookView(turn, text);
}

/** `command_spirit_paper_start` (:439-460): asks which day. */
function paperStart(turn: Turn): View {
  return withOverlay(turn, {
    kind: "textInput",
    id: `${UNIVERSITY}:paper`,
    prompt: fill(turn.text.places.university.paperPrompt, { max: turn.town.day - 1 }),
    maxLength: DAY_LENGTH,
  });
}

/**
 * `command_spirit_paper` (:390-437): any past day's front page, from day 1 to
 * yesterday. The yellowing-paper text makes the page legible over black
 * (`7 becomes `w, `^ becomes `$). A cancelled prompt goes back to the
 * library (the original read the client's abort marker as the number 12).
 */
function paper(turn: Turn, answer: string | null): View {
  if (answer === null) return libraryRestart(turn);
  const t = turn.text.places.university;
  const day = atoi(answer);
  let text: string;
  if (day < 1 || day > turn.town.day - 1) {
    text = fill(t.paperMissing, { day });
  } else {
    text = fill(t.paperFound, { day });
    text += turn.town.news[String(day)]?.front ?? "";
    text = replaceAll(text, "`7", "`w");
    text = replaceAll(text, "`^", "`$");
  }
  return bookView(turn, text);
}

export const universityModule: LocationModule = {
  id: UNIVERSITY,
  enter: (turn) => enterUniversity(turn),
  press(turn, command) {
    switch (command) {
      case "psych":
        return takePsych(turn);
      case "hp":
        return takeHp(turn);
      case "strength":
        return takeStrength(turn);
      case "main":
        return menu(turn);
      case "library":
        return library(turn);
      case "library-restart":
        return libraryRestart(turn);
      case "paper-start":
        return paperStart(turn);
      case "heroes":
        return heroes(turn);
      default:
        throw new Error(`Unknown university command ${command}`);
    }
  },
  submitText(turn, overlayId, text) {
    if (overlayId !== `${UNIVERSITY}:paper`) throw new Error(`Unknown prompt ${overlayId}`);
    return paper(turn, text);
  },
};
