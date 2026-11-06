import type { View } from "@fq/protocol";
import { enterLocation } from "../../classic/location.js";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { button, hud, legacy } from "../../engine/view.js";
import { fill } from "../../text/format.js";
import { tutorialPage } from "../panels.js";
import { xc, xp } from "../players.js";
import { waitX } from "../wait.js";

/**
 * The guided first day (docs/expanded-rules.md section 10.4), led by the
 * new-user clerk (`ui/new-user-clerk`). Ordinary location views: a page of
 * text, Next and Skip. The last page's button meets the practice customer,
 * whose screens carry the clerk's hints in `note`. Button ids:
 * `tutorial:next`, `tutorial:skip`, `tutorial:start`.
 */
export const TUTORIAL = "tutorial";

function page(turn: Turn): View {
  const t = xc(turn).text.tutorial;
  const x = xp(turn);
  const p = turn.player;
  const index = Math.min(x.tutorial.step, t.pages.length - 1);
  const last = index >= t.pages.length - 1;
  return {
    scene: "location",
    title: turn.text.desk.title,
    text: legacy(fill(t.pages[index] ?? "", { name: p.name, parlor: p.parlor })),
    note: legacy(`${index + 1} / ${t.pages.length}`),
    tutorial: tutorialPage(xc(turn), index + 1, t.pages.length),
    picture: { fg: "ui/new-user-clerk", bg: "places/desk" },
    hud: hud(p),
    buttons: last
      ? [button(`${TUTORIAL}:skip`, t.skip), button(`${TUTORIAL}:start`, t.start)]
      : [button(`${TUTORIAL}:skip`, t.skip), button(`${TUTORIAL}:next`, t.next)],
  };
}

function toDesk(turn: Turn): View {
  const desk = turn.registry.module("desk");
  if (!desk?.enter) throw new Error("No desk");
  turn.session.scene = "desk";
  return desk.enter(turn, undefined);
}

export const tutorialModule: LocationModule = {
  id: TUTORIAL,
  enter(turn) {
    const x = xp(turn);
    if (x.tutorial.done) return toDesk(turn);
    enterLocation(turn, turn.text.desk.title);
    return page(turn);
  },
  press(turn, command) {
    const x = xp(turn);
    if (x.tutorial.done) throw new Error("The tour is over");
    const pages = xc(turn).text.tutorial.pages.length;
    if (command === "next") {
      x.tutorial.step = Math.min(pages - 1, x.tutorial.step + 1);
      return page(turn);
    }
    if (command === "skip") {
      x.tutorial.done = true;
      return toDesk(turn);
    }
    if (command === "start") {
      x.tutorial.step = pages;
      enterLocation(turn, turn.text.desk.title);
      return waitX(turn, true);
    }
    throw new Error(`Unknown tutorial command ${command}`);
  },
};
