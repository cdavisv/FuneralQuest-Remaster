import type { Overlay, View } from "@fq/protocol";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { legacy } from "../../engine/view.js";
import type { Json, MailButton } from "../../state/types.js";
import { stripLegacyCodes } from "../../text/legacyText.js";
import { isBlocking } from "../blocking.js";
import { deskScreen } from "../location.js";
import { type Delivery, sendLetter, sendToChat } from "../mail.js";
import { nameAnswer, namePrompt, readNameSearch } from "../nameSearch.js";
import { filterUserText, stripControl } from "../userText.js";

/**
 * Letters between players: writing one (the desk's pen, the Flash
 * `i_getname` / `i_namenext` / `i_mail` objects, `command_getname` and
 * `command_send_mail`, legacy/source/commands_getname.cpp and
 * commands_send_mail.cpp) and reading the queue at the desk one message at
 * a time, as a message overlay (or a Reply question for a letter).
 */
export const MAILBOX = "mailbox";

interface MailboxData {
  search: string;
  hisId: number;
  /** Recipient of the letter being written. */
  to: number;
  /** Text the letter starts with (a reply's quote). */
  quote: string;
}

function data(turn: Turn): MailboxData {
  const d = turn.session.sceneData;
  const found = readNameSearch(d);
  const rec = typeof d === "object" && d !== null && !Array.isArray(d) ? d : {};
  return {
    ...found,
    to: typeof rec.to === "number" ? rec.to : -1,
    quote: typeof rec.quote === "string" ? rec.quote : "",
  };
}

function save(turn: Turn, d: MailboxData): void {
  turn.session.sceneData = { ...d } as unknown as Json;
}

/**
 * The desk, read again (`c_request_main`): after a letter is sent (the
 * notepad's callback asks for it, welcome.swf sprite 456), after "Can't
 * email" and after a letter read at the desk.
 */
function backToDesk(turn: Turn): View {
  const desk = turn.registry.module("desk");
  if (!desk?.enter) throw new Error("No desk");
  turn.session.scene = "desk";
  return desk.enter(turn, undefined);
}

/**
 * The desk drawn again without asking the server. The name box's Cancel and
 * its "nobody by that name" box (welcome.swf buttons 496 and 504, which call
 * `callback_email_fail`: at the desk's pen that only replays m_main from
 * frame 1) and the notepad's close button (button 451) send no request, so
 * the original read no mail there; the queue waits for the next desk visit.
 */
function deskRedrawn(turn: Turn): View {
  turn.session.scene = "desk";
  const t = turn.text.desk;
  return deskScreen(turn, turn.player.policeProtected ? t.sittingPolice : t.sitting, {
    fg: "places/desk",
  });
}

/** The desk screen under an overlay, without reading mail. */
function onDesk(turn: Turn, overlay: Overlay): View {
  const view = deskScreen(turn, turn.text.desk.sitting, { fg: "places/desk" });
  view.overlay = overlay;
  return view;
}

/** The `i_mail` notepad. */
function compose(turn: Turn, d: MailboxData): View {
  save(turn, d);
  const max = turn.rules.textLimits.mail;
  const overlay: Overlay = {
    kind: "textInput",
    id: `${MAILBOX}:compose`,
    prompt: turn.text.social.mail.composePrompt,
    maxLength: max,
    multiline: true,
  };
  if (d.quote !== "") overlay.initial = d.quote.slice(0, max);
  return onDesk(turn, overlay);
}

/**
 * `command_send_mail` (commands_send_mail.cpp:3-37): an unknown or deleted
 * recipient gets "Can't email"; otherwise the letter is queued, a player in
 * the cafe is told, and the log records it.
 */
function send(turn: Turn, d: MailboxData, text: string): View {
  const to = turn.town.players[d.to];
  if (!to?.active) {
    return onDesk(turn, {
      kind: "message",
      id: `${MAILBOX}:nosuch`,
      text: legacy(turn.text.social.mail.noSuchPlayer),
    });
  }
  const body = filterUserText(turn, stripControl(text), "mail");
  // A recipient who blocked the sender never gets it; the sender sees the usual path.
  if (isBlocking(turn.town, to.id, turn.playerId)) {
    turn.log(`${turn.player.name} wrote email to ${to.name} (blocked, not delivered): ${body}`);
    return backToDesk(turn);
  }
  sendLetter(turn, to.id, turn.playerId, body);
  sendToChat(turn, to.id, turn.text.social.mail.waiting);
  turn.log(`${turn.player.name} wrote email to ${to.name}: ${body}`);
  return backToDesk(turn);
}

/**
 * A letter read at the desk. A Continue stop becomes a message overlay
 * (`mailbox:letter`, closed with `dismiss`); a letter from a player, whose
 * stop offers Reply and Continue, becomes a confirm (`mailbox:reply`).
 * Returns null for any other stop, which the desk shows as buttons.
 * `deskText` is what the desk says under the overlay.
 */
export function letterView(turn: Turn, deskText: string, mail: Delivery): View | null {
  const buttons: MailButton[] = mail.buttons ?? [];
  const reply = buttons.find((b) => b.id.startsWith(`${MAILBOX}:reply:`));
  const onlyContinue = buttons.length === 1 && buttons[0]?.id === "go:desk";
  if (!reply && !onlyContinue) return null;
  const view = deskScreen(turn, deskText, { fg: "places/desk" });
  const picture: { fg?: string; bg?: string } = {};
  if (mail.fg) picture.fg = mail.fg;
  if (mail.bg) picture.bg = mail.bg;
  const text = legacy(mail.message);
  if (reply) {
    const from = Number(reply.id.slice(`${MAILBOX}:reply:`.length));
    turn.session.sceneData = {
      search: "",
      hisId: -1,
      to: Number.isInteger(from) ? from : -1,
      quote: mail.quote ?? "",
    };
    const prompt = legacy(`\n\n\`w${turn.text.social.mail.replyPrompt}`);
    view.overlay = { kind: "confirm", id: `${MAILBOX}:reply`, text: [...text, ...prompt] };
  } else {
    view.overlay = { kind: "message", id: `${MAILBOX}:letter`, text, picture };
    // Expanded only (Classic transcripts are locked): mail that reported a reward.
    if (turn.rules.expanded && mail.reward) view.overlay.messageKind = "reward";
  }
  return view;
}

export const mailboxModule: LocationModule = {
  id: MAILBOX,
  /** The pen on the desk (welcome.swf button 396): who to write to. */
  enter(turn) {
    save(turn, { search: "", hisId: -1, to: -1, quote: "" });
    return onDesk(turn, namePrompt(turn, MAILBOX, turn.text.social.mail.whoPrompt));
  },
  submitText(turn, overlayId, text) {
    const d = data(turn);
    if (overlayId === `${MAILBOX}:getname`) {
      if (text === null) return deskRedrawn(turn);
      const answer = nameAnswer(turn, MAILBOX, stripLegacyCodes(text), 0);
      save(turn, { ...d, ...answer.state });
      return onDesk(turn, answer.overlay);
    }
    if (overlayId === `${MAILBOX}:compose`) {
      // The notepad's close button (welcome.swf button 451) sends nothing.
      if (text === null) return deskRedrawn(turn);
      return send(turn, d, text);
    }
    throw new Error(`Unknown overlay ${overlayId}`);
  },
  confirm(turn, overlayId, accepted) {
    const d = data(turn);
    if (overlayId === `${MAILBOX}:namenext`) {
      if (accepted) return compose(turn, { ...d, to: d.hisId, quote: "" });
      const answer = nameAnswer(turn, MAILBOX, d.search, d.hisId + 1);
      save(turn, { ...d, ...answer.state });
      return onDesk(turn, answer.overlay);
    }
    if (overlayId === `${MAILBOX}:reply`) {
      // Reply opens the notepad with the quote (`quote_message`, welcome.swf); Continue reads on.
      if (accepted) return compose(turn, d);
      return backToDesk(turn);
    }
    throw new Error(`Unknown overlay ${overlayId}`);
  },
  dismiss(turn, overlayId) {
    if (overlayId === `${MAILBOX}:letter` || overlayId === `${MAILBOX}:nosuch`) {
      return backToDesk(turn);
    }
    if (overlayId === `${MAILBOX}:noname`) return deskRedrawn(turn);
    throw new Error(`Unknown overlay ${overlayId}`);
  },
};
