import type { View } from "@fq/protocol";
import { deskModule } from "../../classic/modules/desk.js";
import { quit } from "../../classic/session.js";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { goButton, hud, legacy } from "../../engine/view.js";
import { TUTORIAL_FINISH } from "../negotiation.js";
import { expandedNewDay } from "../newDay.js";
import { xc, xp } from "../players.js";
import { challengeDesk } from "../town/challenge.js";
import { townPanel, townStatus } from "../town/world.js";
import { waitX } from "../wait.js";
import { TUTORIAL } from "./tutorial.js";

/**
 * The Expanded desk (docs/expanded-rules.md section 10): the Classic desk
 * (greeting, the Classic new day, mail) followed by the Expanded new day, the
 * Parlor button, and the guided first day.
 */
function enter(turn: Turn): View {
  // Section 24.2: a finished Daily Challenge shows its score and nothing else.
  const finished = challengeDesk(turn);
  if (finished) return finished;
  const p = turn.player;
  const x = xp(turn);
  const before = { day: p.dayLastLoggedOn, turns: p.turns };
  const view = deskModule.enter?.(turn, undefined);
  if (!view) throw new Error("No desk");
  const t = xc(turn).text;
  let extra = "";
  if (p.dayLastLoggedOn !== before.day) {
    extra += expandedNewDay(turn, before.turns, before.day === 0);
    // The guided first day starts behind the morning screen's Continue (section 10.4).
    if (!x.tutorial.done && x.tutorial.step < TUTORIAL_FINISH) {
      view.buttons = [goButton(TUTORIAL, turn.text.desk.continueLabel)];
    }
  } else if (!x.tutorial.done && x.tutorial.step === TUTORIAL_FINISH) {
    x.tutorial.done = true;
    view.text = legacy(t.tutorial.finish);
    view.picture = {
      fg: "ui/new-user-clerk",
      ...(view.picture?.bg ? { bg: view.picture.bg } : {}),
    };
  }
  if (extra !== "") view.text = [...view.text, ...legacy(extra)];
  if (view.buttons.some((b) => b.id === "desk:wait")) {
    const quitAt = view.buttons.findIndex((b) => b.id === "desk:quit");
    const parlor = goButton("parlor", t.desk.menuParlor);
    if (quitAt >= 0) view.buttons.splice(quitAt, 0, parlor);
    else view.buttons.push(parlor);
  }
  // Section 26: today's town on the desk.
  view.town = townPanel(turn);
  const status = townStatus(turn);
  if (status !== "") view.status = legacy(status);
  view.hud = hud(p);
  return view;
}

export const expandedDeskModule: LocationModule = {
  id: "desk",
  enter: (turn) => enter(turn),
  press(turn, command) {
    if (command === "wait") {
      const x = xp(turn);
      // The first customer of an unfinished tour is the practice customer.
      return waitX(turn, !x.tutorial.done && x.tutorial.step < TUTORIAL_FINISH);
    }
    if (command === "quit") {
      const challenge = turn.town.expanded?.challenge;
      if (challenge) challenge.finished = true;
      return quit(turn);
    }
    throw new Error(`Unknown desk command ${command}`);
  },
};
