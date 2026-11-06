import type { AssetId } from "@fq/protocol";
import type { Turn } from "../engine/turn.js";
import { legacy } from "../engine/view.js";
import type { MailButton, MailPacket, MailStat, TownState } from "../state/types.js";
import { fill, replaceAll } from "../text/format.js";
import { blockersOf } from "./blocking.js";
import { addToNews } from "./news.js";
import { expMod, luckMod, turnsMod } from "./players.js";

type PacketBody = MailPacket extends infer P
  ? P extends MailPacket
    ? Omit<P, "importance" | "from" | "expireDay">
    : never
  : never;

interface PacketOptions {
  importance?: "normal" | "high";
  from?: number;
  expireDay?: number | null;
}

/**
 * `send_packet` (legacy/source/broadcast.cpp:359-388): queue a packet for a
 * player. Inactive players get nothing. Offline players keep only
 * high-importance packets (the mail file); normal ones are dropped.
 */
export function sendPacket(
  town: TownState,
  to: number,
  body: PacketBody,
  options: PacketOptions = {},
): void {
  const player = town.players[to];
  if (!player?.active) return;
  const importance = options.importance ?? "high";
  const online = town.sessions[String(to)] !== undefined;
  if (!online && importance === "normal") return;
  const packet = {
    ...body,
    importance,
    from: options.from ?? -1,
    expireDay: options.expireDay ?? null,
  } as MailPacket;
  player.mail.push(packet);
}

/** `send_packet_text` (broadcast.cpp:354-357). */
export function mailText(
  town: TownState,
  to: number,
  text: string,
  expireDay: number | null = null,
): void {
  sendPacket(town, to, { type: "text", text }, { expireDay });
}

/** `send_packet_picture` (broadcast.cpp:334-339). */
export function mailPicture(
  town: TownState,
  to: number,
  picture: AssetId | undefined,
  expireDay: number | null = null,
): void {
  sendPacket(town, to, { type: "picture", layer: "fg", picture: picture ?? null }, { expireDay });
}

/** `send_packet_picture_bg` (broadcast.cpp:347-352). */
export function mailBackground(
  town: TownState,
  to: number,
  picture: AssetId | undefined,
  expireDay: number | null = null,
): void {
  sendPacket(town, to, { type: "picture", layer: "bg", picture: picture ?? null }, { expireDay });
}

/** `send_packet_continue_button` (broadcast.cpp:324-332): stops delivery until Continue is pressed. */
export function mailContinue(turn: Turn, to: number, expireDay: number | null = null): void {
  const buttons: MailButton[] = [{ id: "go:desk", label: turn.text.desk.continueLabel }];
  sendPacket(turn.town, to, { type: "buttons", buttons }, { expireDay });
}

/** `send_packet_add_log` (broadcast.cpp:341-344): news text added when the mail is read. */
export function mailNewsLog(
  town: TownState,
  to: number,
  text: string,
  expireDay: number | null = null,
): void {
  sendPacket(town, to, { type: "newsLog", text }, { expireDay });
}

/**
 * `send_packet_var_mod` (broadcast.cpp:195-222): a luck, BP or turns change
 * applied when the mail is read. With `mailRewardsOnDelivery` off (Expanded)
 * the change applies at once instead.
 */
export function mailReward(
  turn: Turn,
  to: number,
  stat: MailStat,
  amount: number,
  expireDay: number | null = null,
): void {
  const player = turn.town.players[to];
  if (!player?.active) return;
  if (!turn.rules.mailRewardsOnDelivery) {
    applyReward(turn, to, stat, amount);
    return;
  }
  sendPacket(turn.town, to, { type: "varMod", stat, amount }, { expireDay });
}

function applyReward(turn: Turn, playerId: number, stat: MailStat, amount: number): void {
  const player = turn.town.players[playerId];
  if (!player) return;
  // Immediate rewards (Expanded) also apply turns, which the Classic reader ignores.
  if (stat === "luck") luckMod(turn.rules, player, amount);
  else if (stat === "bp") expMod(player, amount);
  else turnsMod(player, amount);
}

/** Players in the cafe (`i_status == C_STATUS_CHAT`), in id order. */
export function playersInCafe(town: TownState): number[] {
  return Object.entries(town.sessions)
    .filter(([key, session]) => session.status === "chat" && town.players[Number(key)]?.active)
    .map(([key]) => Number(key))
    .sort((a, b) => a - b);
}

/**
 * Cafe lines are the one real-time feature. Instead of queueing `chat`
 * packets for the client to poll (`add_que_messages_chat`,
 * broadcast.cpp:103-154), the engine emits a `chat` effect naming the
 * players in the cafe, and the host delivers it. Players outside the cafe
 * are skipped, as the original's chat packets were discarded at the desk.
 */
export function chatTo(turn: Turn, ids: readonly number[], text: string): void {
  const inCafe = new Set(playersInCafe(turn.town));
  const to = [...new Set(ids)].filter((id) => inCafe.has(id)).sort((a, b) => a - b);
  if (to.length > 0) turn.effects.push({ kind: "chat", to, text: legacy(text) });
}

/**
 * `broadcast` (broadcast.cpp:391-407): a notice for everyone online. The
 * original prefixed the server's local time; the engine has no clock, so the
 * host may add one. Players in the cafe read it there (`add_que_messages_chat`
 * shows simple text as "`w" + text, broadcast.cpp:126-131), so they get a
 * `chat` effect instead of a queued packet.
 */
export function broadcast(turn: Turn, text: string): void {
  const cafe = playersInCafe(turn.town);
  for (const key of Object.keys(turn.town.sessions)) {
    if (cafe.includes(Number(key))) continue;
    sendPacket(turn.town, Number(key), { type: "simpleText", text }, { importance: "normal" });
  }
  chatTo(turn, cafe, fill(turn.text.social.cafe.notice, { text }));
  turn.effects.push({ kind: "broadcast", text });
}

/**
 * A cafe line said by `from` (talk, `/me`, `/give` and its notices): as
 * `chatTo`, minus anyone who has blocked `from` (classic/blocking.ts).
 */
export function chatFrom(turn: Turn, from: number, ids: readonly number[], text: string): void {
  const blockers = blockersOf(turn.town, from);
  chatTo(turn, blockers.size === 0 ? ids : ids.filter((id) => !blockers.has(id)), text);
}

/** `broadcastChat` for a line said by `from`: blockers of `from` do not get it. */
export function broadcastChatFrom(turn: Turn, from: number, text: string): void {
  chatFrom(turn, from, playersInCafe(turn.town), text);
}

/** `broadcast` for a line typed by `from` (`/yell`): blockers of `from` do not get it. */
export function broadcastFrom(turn: Turn, from: number, text: string): void {
  const blockers = blockersOf(turn.town, from);
  if (blockers.size === 0) {
    broadcast(turn, text);
    return;
  }
  const cafe = playersInCafe(turn.town);
  for (const key of Object.keys(turn.town.sessions)) {
    const id = Number(key);
    if (cafe.includes(id) || blockers.has(id)) continue;
    sendPacket(turn.town, id, { type: "simpleText", text }, { importance: "normal" });
  }
  chatTo(
    turn,
    cafe.filter((id) => !blockers.has(id)),
    fill(turn.text.social.cafe.notice, { text }),
  );
  turn.effects.push({ kind: "broadcast", text });
}

/** `broadcast_chat` (broadcast.cpp:409-425): a line for everyone in the cafe. */
export function broadcastChat(turn: Turn, text: string): void {
  chatTo(turn, playersInCafe(turn.town), text);
}

/**
 * `send_to_chat` and `broadcast_chat_to` (broadcast.cpp:305-323, 451-467): a
 * line for one player, seen only if they are in the cafe.
 */
export function sendToChat(turn: Turn, to: number, text: string): void {
  chatTo(turn, [to], text);
}

/** Whether the cafe TV is on (`g_tvOn`, commands_bar.cpp:11; on by default). */
export function tvIsOn(town: TownState): boolean {
  return town.tvOn !== false;
}

/**
 * `broadcast_tv` (broadcast.cpp:427-448): "The TV:" line for the cafe, shown
 * only while the TV is on. The `tv` effect (for logs) is emitted either way,
 * as the original always logged it.
 */
export function broadcastTv(turn: Turn, text: string): void {
  const line = `\`7The TV: \`w${text}`;
  if (tvIsOn(turn.town)) broadcastChat(turn, line);
  turn.effects.push({ kind: "tv", text: legacy(line) });
}

/**
 * `send_packet_mail` (broadcast.cpp:254-303): a letter from another player.
 * Three packets: the text, the quote a reply starts with (only the newest
 * part of the letter, each line prefixed ">"), and Reply / Continue.
 */
export function sendLetter(turn: Turn, to: number, from: number, content: string): void {
  const sender = turn.town.players[from];
  if (!sender) return;
  const body = replaceAll(content, "\r\n", "\n");
  sendPacket(
    turn.town,
    to,
    { type: "text", text: fill(turn.text.social.mail.received, { name: sender.name, text: body }) },
    {},
  );
  let fresh = body;
  const last = body.lastIndexOf("\n>");
  if (last !== -1) {
    let start = last + 1;
    const afterCr = body.indexOf("\n", start);
    if (afterCr !== -1) {
      start = afterCr + 1;
      if (body.charAt(start) === "\n") start++;
    }
    fresh = body.slice(start);
  }
  sendPacket(turn.town, to, { type: "quote", text: `>${replaceAll(fresh, "\n", "\n>")}\n\n` });
  const buttons: MailButton[] = [
    { id: `mailbox:reply:${from}`, label: turn.text.desk.replyLabel },
    { id: "go:desk", label: turn.text.desk.continueLabel },
  ];
  sendPacket(turn.town, to, { type: "buttons", buttons });
}

/** What reading the mail produced (see `deliverMail`). */
export interface Delivery {
  /** Message text so far, starting with the original's "`$". */
  message: string;
  fg?: AssetId | null;
  bg?: AssetId | null;
  /** Set when a command packet stopped delivery: the only buttons to offer. */
  buttons?: MailButton[];
  /** The last quote packet read (`st_quote`): what a reply starts with. */
  quote?: string;
}

/**
 * `add_que_messages` (legacy/source/broadcast.cpp:14-100), run on the desk.
 * Packets are read in order: expired ones are dropped, text is appended,
 * pictures replace the desk picture, rewards apply now, news-log packets add
 * to today's paper. A command packet (Continue / Reply) stops reading; the
 * rest waits for the next desk visit. Chat packets are discarded here.
 */
export function deliverMail(turn: Turn, message: string): Delivery {
  const player = turn.player;
  const out: Delivery = { message };
  while (player.mail.length > 0) {
    const packet = player.mail[0] as MailPacket;
    if (packet.expireDay !== null && packet.expireDay <= turn.town.day) {
      player.mail.shift();
      continue;
    }
    switch (packet.type) {
      case "newsLog":
        addToNews(turn.town, packet.text);
        break;
      case "buttons":
        out.buttons = packet.buttons;
        player.mail.shift();
        return out;
      case "picture":
        if (packet.layer === "fg") out.fg = packet.picture;
        else out.bg = packet.picture;
        break;
      case "text":
      case "simpleText":
        out.message += fill(turn.text.desk.mailLine, { text: packet.text });
        break;
      case "varMod":
        if (packet.stat === "luck") luckMod(turn.rules, player, packet.amount);
        if (packet.stat === "bp") expMod(player, packet.amount);
        break;
      case "quote":
        out.quote = packet.text;
        break;
      case "chat":
        break;
    }
    player.mail.shift();
  }
  return out;
}

/**
 * `class_que::save_to_hd` (legacy/source/message_que.cpp:141-185) on log off:
 * only high-importance packets are kept.
 */
export function keepHighImportanceMail(town: TownState, playerId: number): void {
  const player = town.players[playerId];
  if (!player) return;
  player.mail = player.mail.filter((p) => p.importance === "high");
}
