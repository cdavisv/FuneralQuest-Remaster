import type { View } from "@fq/protocol";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { button } from "../../engine/view.js";
import { fill } from "../../text/format.js";
import { continueButton, deskScreen, enterLocation } from "../location.js";
import { type Delivery, deliverMail } from "../mail.js";
import { newDayLogon, onlineDayLogon } from "../newDay.js";
import { quit } from "../session.js";
import { waitForCustomer } from "../wait.js";
import { letterView } from "./mailbox.js";

/** The player's own parlor: the main screen (legacy/source/commands_main.cpp). */
export const DESK = "desk";

/**
 * `command_main` (legacy/source/commands_main.cpp:5-109). The first visit of
 * a session greets the player and, on a new game day, runs the per-player
 * new day behind a Continue button. Later visits read the mail queue.
 */
function enterDesk(turn: Turn): View {
  const s = turn.session;
  const p = turn.player;
  const t = turn.text.desk;
  enterLocation(turn, t.title);
  s.scene = DESK;
  let message: string;
  if (!s.gaveLogonMessage) {
    s.gaveLogonMessage = true;
    if (p.dayLastLoggedOn !== turn.town.day) return newDayScreen(turn, newDayLogon(turn));
    message = fill(t.welcomeBack, { name: p.name });
  } else {
    if (p.dayLastLoggedOn !== turn.town.day) return newDayScreen(turn, onlineDayLogon(turn));
    message = "`$";
  }

  let mail = deliverMail(turn, message);
  // A Continue stop with nothing read since the last stop (the news blurb's gift mail starts
  // with one, maint.cpp:33-95). `fixes.emptyMailStop` reads on past it; the original
  // (commands_main.cpp:89-108) showed the desk ("You are sitting at your desk.") with only
  // that Continue button, and the gift was read at the next click.
  while (turn.rules.fixes.emptyMailStop && isEmptyStop(mail, message)) {
    const next = deliverMail(turn, message);
    mail = {
      ...next,
      ...(next.fg === undefined && mail.fg !== undefined ? { fg: mail.fg } : {}),
      ...(next.bg === undefined && mail.bg !== undefined ? { bg: mail.bg } : {}),
    };
  }
  if (mail.buttons && !isEmptyStop(mail, message)) {
    // A stop is read as an overlay, one message at a time (modules/mailbox.ts). An empty stop
    // (only when `fixes.emptyMailStop` is off) is the desk with the stop's buttons, below.
    const head =
      message.toLowerCase() === "`$" ? (p.policeProtected ? t.sittingPolice : t.sitting) : message;
    const letter = letterView(turn, head, { ...mail, message: mail.message.slice(message.length) });
    if (letter) return letter;
  }
  let text = mail.message;
  if (text.toLowerCase() === "`$") text = p.policeProtected ? t.sittingPolice : t.sitting;
  return deskScreen(turn, text, {
    fg: mail.fg !== undefined ? mail.fg : "places/desk",
    bg: mail.bg ?? null,
    ...(mail.buttons ? { buttons: mail.buttons.map((b) => button(b.id, b.label)) } : {}),
  });
}

/** A lone Continue stop with no text, picture or quote read before it. */
function isEmptyStop(mail: Delivery, message: string): boolean {
  const b = mail.buttons;
  return (
    !!b &&
    b.length === 1 &&
    b[0]?.id === "go:desk" &&
    mail.message === message &&
    !mail.fg &&
    !mail.bg &&
    mail.quote === undefined
  );
}

/** The morning screen (commands_main.cpp:26-41): coffee and a Continue button. */
function newDayScreen(turn: Turn, text: string): View {
  return deskScreen(turn, text, { fg: "morning_coffee", buttons: [continueButton(turn)] });
}

export const deskModule: LocationModule = {
  id: DESK,
  enter: (turn) => enterDesk(turn),
  press(turn, command) {
    if (command === "wait") return waitForCustomer(turn);
    if (command === "quit") return quit(turn);
    throw new Error(`Unknown desk command ${command}`);
  },
};
