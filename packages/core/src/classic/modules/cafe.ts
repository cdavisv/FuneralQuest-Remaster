import type { ChatLine, View } from "@fq/protocol";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { goButton, hud, legacy } from "../../engine/view.js";
import { fill, intToCash } from "../../text/format.js";
import { isBlocking } from "../blocking.js";
import { casketName } from "../customerText.js";
import { enterLocation } from "../location.js";
import {
  broadcastChat,
  broadcastChatFrom,
  broadcastFrom,
  playersInCafe,
  sendToChat,
} from "../mail.js";
import { isPresent } from "../presence.js";
import { filterUserText } from "../userText.js";

/**
 * The Pale Horse Cafe (legacy/source/commands_bar.cpp): chat and its slash
 * commands. A `chat` action returns the speaker's view, whose `chat` holds
 * the lines this action produced for the speaker; every other player in the
 * cafe gets the same lines as `chat` effects for the host to deliver.
 */
export const CAFE = "cafe";

/**
 * `GetField(text, ' ', n)` (FakeCStringEx.cpp:50-73, `CString::Tokenize`):
 * the n-th space-separated token, empty tokens skipped.
 */
function field(text: string, index: number): string {
  return text.split(" ").filter((t) => t !== "")[index] ?? "";
}

/** `get_names_in_bar` (commands_bar.cpp:56-98): the others in the cafe. */
function namesInBar(turn: Turn): string {
  const t = turn.text.social.cafe;
  const others = playersInCafe(turn.town).filter((id) => id !== turn.playerId);
  if (others.length === 0) return t.onlyOne;
  const names = others.map((id) => turn.town.players[id]?.name ?? "");
  return t.othersHere + names.map((n, i) => (i < names.length - 1 ? ` ${n},` : ` ${n}`)).join("");
}

/** `get_time_difference_in_text` is not in the repository; this is `get_uptime`'s format (maint.cpp:344-358). */
function sinceText(turn: Turn, then: number): string {
  const t = turn.text.social.cafe;
  let seconds = (turn.engine.now - then) / 1000;
  if (seconds < 1) seconds = 1;
  const n = (v: number) => Math.round(v).toString().padStart(6);
  if (seconds / 60 > 59) return fill(t.hours, { n: n(seconds / 3600) });
  if (seconds > 59) return fill(t.minutes, { n: n(seconds / 60) });
  return fill(t.seconds, { n: n(seconds) });
}

/** `list_people_on` (:26-54): `/all`, everyone online, with where they are and their last action. */
function listPeopleOn(turn: Turn): void {
  const t = turn.text.social.cafe;
  const me = turn.playerId;
  sendToChat(turn, me, t.allHeader);
  sendToChat(turn, me, t.allRule);
  const ids = Object.keys(turn.town.sessions)
    .map(Number)
    .filter((id) => isPresent(turn.town, id))
    .sort((a, b) => a - b);
  for (const id of ids) {
    const p = turn.town.players[id];
    const s = turn.town.sessions[String(id)];
    if (!p || !s) continue;
    sendToChat(
      turn,
      me,
      `${p.name.padEnd(20)} ${s.location.padEnd(12)}  ${sinceText(turn, p.lastPacket)}`,
    );
  }
}

/** `AdjustTV` (:100-133): `/tv`, `/tv on` (or "ON"), anything else turns it off. */
function adjustTv(turn: Turn, text: string): void {
  const t = turn.text.social.cafe;
  const arg = field(text, 1);
  let line: string;
  if (arg === "") {
    line = turn.town.tvOn !== false ? t.tvIsOn : t.tvIsOff;
  } else if (arg === "on" || arg === "ON") {
    line = t.tvTurnedOn;
    turn.town.tvOn = true;
  } else {
    line = t.tvTurnedOff;
    turn.town.tvOn = false;
  }
  sendToChat(turn, turn.playerId, line);
}

/** `get_id_from_full_or_partial_handle_bar` (misc_utils.cpp:197-219): the first slot in the cafe whose name contains `search`. */
function findInBar(turn: Turn, search: string): number {
  const cafe = new Set(playersInCafe(turn.town));
  const wanted = search.toLowerCase();
  for (const p of turn.town.players) {
    // A player who blocked the searcher is not found (classic/blocking.ts).
    if (isBlocking(turn.town, p.id, turn.playerId)) continue;
    if (p.active && cafe.has(p.id) && p.name.toLowerCase().includes(wanted)) return p.id;
  }
  return -1;
}

const TAG_WORDS = ["wood", "silver", "gold"];

/**
 * `ChatGiveTag` (:136-222): `/give name tag`. The recipient may receive at
 * most `tagsReceivablePerDay` tags a day (reset at midnight); 0 disables it.
 */
function giveTag(turn: Turn, text: string): void {
  const t = turn.text.social.cafe;
  const me = turn.player;
  const search = field(text, 1);
  const targetId = findInBar(turn, search);
  const target = turn.town.players[targetId];
  if (!target) {
    sendToChat(turn, me.id, fill(t.giveNobody, { search }));
    return;
  }
  const tier = TAG_WORDS.indexOf(field(text, 2).toLowerCase());
  if (tier === -1) {
    sendToChat(turn, me.id, t.giveBadType);
    return;
  }
  const casket = casketName(tier);
  if ((me.tags[tier] ?? 0) < 1) {
    broadcastChatFrom(turn, me.id, fill(t.giveEmpty, { name: me.name, casket }));
    return;
  }
  if (targetId === me.id) {
    broadcastChatFrom(turn, me.id, fill(t.giveSelf, { name: me.name, casket }));
    return;
  }
  const limit = turn.settings.tagsReceivablePerDay;
  if (target.tagsReceivedToday >= limit) {
    const template = target.tagsReceivedToday === 0 ? t.giveDisabled : t.giveLimit;
    broadcastChatFrom(
      turn,
      me.id,
      fill(template, {
        name: me.name,
        target: target.name,
        casket,
        count: target.tagsReceivedToday,
      }),
    );
    return;
  }
  me.tags[tier] = (me.tags[tier] ?? 0) - 1;
  target.tags[tier] = (target.tags[tier] ?? 0) + 1;
  target.tagsReceivedToday++;
  broadcastChatFrom(turn, me.id, fill(t.gave, { name: me.name, target: target.name, casket }));
}

/** `ShowMyInfo` (:225-242). */
function showInfo(turn: Turn): void {
  const p = turn.player;
  sendToChat(
    turn,
    p.id,
    fill(turn.text.social.cafe.info, {
      turns: p.turns,
      visits: turn.settings.visitsPerDay - p.playerFights,
      bpToday: intToCash(p.bpToday),
      bp: intToCash(p.bp),
      wood: p.tags[0] ?? 0,
      silver: p.tags[1] ?? 0,
      gold: p.tags[2] ?? 0,
    }),
  );
}

/** `CString::Delete(0, n)`. */
function dropFirst(text: string, n: number): string {
  return text.slice(n);
}

/** `process_chat_command` (:244-318); `text` is the line without its "/". */
function chatCommand(turn: Turn, text: string): void {
  const t = turn.text.social.cafe;
  const me = turn.player;
  const command = field(text, 0);
  const is = (name: string) => command.toLowerCase() === name;
  if (command === "?") sendToChat(turn, me.id, t.help);
  else if (is("who")) sendToChat(turn, me.id, namesInBar(turn));
  else if (is("info")) showInfo(turn);
  else if (is("give")) giveTag(turn, text);
  else if (is("tv")) adjustTv(turn, text);
  else if (is("me")) {
    const said = filterUserText(turn, dropFirst(text, 3), "chat");
    broadcastChatFrom(turn, me.id, fill(t.me, { name: me.name, text: said }));
  } else if (is("yell")) {
    // The original also spoke the line with text-to-speech (:294-304); not ported.
    const said = filterUserText(turn, dropFirst(text, 5), "chat");
    broadcastFrom(turn, me.id, fill(t.yell, { name: me.name, text: said }));
  } else if (is("all")) listPeopleOn(turn);
  else sendToChat(turn, me.id, t.unknown);
}

/**
 * `process_chat_input` (:350-411): lines separated by "|" (the client joins
 * lines typed between updates), each a command or a line said aloud.
 */
function chatInput(turn: Turn, input: string): void {
  for (const line of input.split("|")) {
    if (line.length === 0) continue;
    if (line.charAt(0) === "/") {
      turn.log(`${turn.player.name} does a ${line}`);
      chatCommand(turn, line.slice(1));
    } else {
      const said = filterUserText(turn, line, "chat");
      // The original appended `<font size="12">` (an HTML size reset) and spoke the line; both dropped.
      broadcastChatFrom(
        turn,
        turn.playerId,
        fill(turn.text.social.cafe.say, { name: turn.player.name, text: said }),
      );
    }
  }
}

/**
 * Takes the acting player's own lines out of this turn's `chat` effects: they
 * go into the returned view instead of back through the host.
 */
function ownLines(turn: Turn): ChatLine[] {
  const lines: ChatLine[] = [];
  for (let i = 0; i < turn.effects.length; i++) {
    const e = turn.effects[i];
    if (e?.kind !== "chat" || !e.to.includes(turn.playerId)) continue;
    lines.push({ text: e.text });
    const to = e.to.filter((id) => id !== turn.playerId);
    if (to.length === 0) {
      turn.effects.splice(i, 1);
      i--;
    } else {
      turn.effects[i] = { ...e, to };
    }
  }
  return lines;
}

function introOf(turn: Turn): string {
  const d = turn.session.sceneData;
  if (typeof d === "object" && d !== null && !Array.isArray(d) && typeof d.intro === "string") {
    return d.intro;
  }
  return "";
}

function cafeView(turn: Turn): View {
  return {
    scene: "cafe",
    title: turn.text.social.cafe.title,
    text: legacy(introOf(turn)),
    hud: hud(turn.player),
    chat: ownLines(turn),
    buttons: [goButton("map", turn.text.social.cafe.leave)],
  };
}

/** `command_chat_start` (:321-348). Leaving is the map's job (commands_map.cpp, "steps outside"). */
function enterCafe(turn: Turn): View {
  const t = turn.text.social.cafe;
  enterLocation(turn, t.location);
  turn.session.status = "chat";
  broadcastChat(turn, fill(t.saunters, { name: turn.player.name }));
  turn.session.sceneData = { intro: fill(t.intro, { names: namesInBar(turn) }) };
  return cafeView(turn);
}

export const cafeModule: LocationModule = {
  id: CAFE,
  enter: (turn) => enterCafe(turn),
  chat(turn, text) {
    if (turn.session.status !== "chat") throw new Error("Not in the cafe");
    if (text.length > turn.rules.textLimits.chat) throw new Error("Text is too long");
    chatInput(turn, text);
    return cafeView(turn);
  },
};
