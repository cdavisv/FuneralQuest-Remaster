import type { Button, View } from "@fq/protocol";
import { isBlocking } from "../../classic/blocking.js";
import { mailContinue, sendPacket } from "../../classic/mail.js";
import { filterUserText, stripControl } from "../../classic/userText.js";
import type { Turn } from "../../engine/turn.js";
import { button } from "../../engine/view.js";
import type { PlayerState, TownState } from "../../state/types.js";
import { fill, intToCash } from "../../text/format.js";
import { refreshRating } from "../parlor.js";
import { moneyMod } from "../players.js";
import {
  activePlayers,
  card,
  cash,
  chainById,
  chainOf,
  life,
  lifeOf,
  off,
  spent,
  townLife,
  townScreen,
  tr,
  xt,
} from "./life.js";
import type { Chain } from "./state.js";

/**
 * Parlor chains (docs/expanded-rules.md section 23): up to four parlors
 * sharing a season score board. Registered at City Hall. Cost: a founding
 * or joining fee and daily dues. Benefit: rating, cheaper caskets, and a
 * walked-out family sent to a chain-mate instead of a stranger. Chain-mates
 * can never fight, rob, burn, duel or hire hits on each other, and a chain
 * whose members were beaten `shelterAfter` times in a day is sheltered until
 * midnight, so no chain can be farmed. Button ids live under `city-hall:`.
 */

const HALL = "city-hall";
const NAME_LENGTH = 24;

export interface ChainStanding {
  id: string;
  name: string;
  members: { id: number; name: string }[];
  score: number;
}

/** Section 23.2: every chain, best score first. Hosts can show this as the season board. */
export function chainStandings(town: TownState): ChainStanding[] {
  const chains = town.expanded?.life?.chains ?? [];
  return chains
    .map((c) => ({
      id: c.id,
      name: c.name,
      members: c.members.map((id) => ({ id, name: town.players[id]?.name ?? "" })),
      score: c.score,
    }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

function cooldownLeft(turn: Turn): number {
  const l = life(turn);
  if (l.leftChainDay === 0) return 0;
  return Math.max(0, l.leftChainDay + tr(turn).chains.leaveCooldown - turn.town.day);
}

function screen(turn: Turn, text: string, buttons: Button[]): View {
  const t = xt(turn).text.chains;
  return townScreen(turn, {
    title: t.title,
    note: xt(turn).text.cityHall.note,
    text,
    buttons,
    ...(xt(turn).pictures.cityHallOutside ?? xt(turn).pictures.cityHall),
  });
}

function boardText(turn: Turn): string {
  const t = xt(turn).text.chains;
  const rows = chainStandings(turn.town);
  if (rows.length === 0) return t.none;
  return rows
    .map((r) =>
      fill(t.line, {
        name: r.name,
        members: r.members.map((m) => m.name).join(", "),
        score: intToCash(r.score),
      }),
    )
    .join("");
}

export function chainsView(turn: Turn, message = ""): View {
  const t = xt(turn).text.chains;
  const hints = xt(turn).text.hints;
  const c = tr(turn).chains;
  const p = turn.player;
  const mine = chainOf(turn.town, p);
  let text = fill(t.intro, {
    fee: intToCash(c.found),
    join: intToCash(c.join),
    dues: intToCash(c.dues),
    max: c.maxMembers,
  });
  if (mine) text += fill(t.yours, { name: mine.name });
  text += `\n${boardText(turn)}`;
  if (message !== "") text = `${message}\n\n${text}`;
  const buttons: Button[] = [];
  const wait = cooldownLeft(turn);
  if (mine) {
    let invite = button(`${HALL}:invite`, t.buttons.invite);
    if (mine.members.length >= c.maxMembers) invite = off(invite, t.full);
    else if (invitable(turn).length === 0) invite = off(invite, hints.noRivals);
    buttons.push(invite, button(`${HALL}:leavechain`, t.buttons.leave));
  } else {
    let found: Button = { ...button(`${HALL}:found`, t.buttons.found), detail: cash(c.found) };
    if (wait > 0) found = off(found, fill(t.cooldown, { days: wait }));
    else if (p.money < c.found) found = off(found, hints.notEnoughCash);
    buttons.push(found);
    for (const ch of turn.town.expanded?.life?.chains ?? []) {
      if (!ch.invites.includes(p.id)) continue;
      let join = card(
        `${HALL}:join:${ch.id}`,
        fill(t.buttons.join, { name: ch.name }),
        cash(c.join),
      );
      if (wait > 0) join = off(join, fill(t.cooldown, { days: wait }));
      else if (ch.members.length >= c.maxMembers) join = off(join, t.full);
      else if (p.money < c.join) join = off(join, hints.notEnoughCash);
      buttons.push(join);
    }
  }
  buttons.push(button(`${HALL}:main`, t.buttons.back));
  const view = screen(turn, text, buttons);
  // Section 26: the season board as rows for the client.
  view.board = chainStandings(turn.town).map((c, i) => ({
    place: i + 1,
    name: c.name,
    detail: c.members.map((m) => m.name).join(", "),
    score: c.score,
    ...(c.members.some((m) => m.id === p.id) ? { mine: true } : {}),
  }));
  return view;
}

function invitable(turn: Turn): PlayerState[] {
  const mine = chainOf(turn.town, turn.player);
  return activePlayers(turn.town).filter(
    (q) =>
      q.id !== turn.player.id &&
      !q.expanded?.life?.chain &&
      !mine?.invites.includes(q.id) &&
      // A player who blocked the inviter is not offered (classic/blocking.ts).
      !isBlocking(turn.town, q.id, turn.player.id),
  );
}

export function foundPrompt(turn: Turn): View {
  const c = tr(turn).chains;
  if (chainOf(turn.town, turn.player) || cooldownLeft(turn) > 0 || turn.player.money < c.found)
    throw new Error("Cannot found a chain");
  return {
    ...chainsView(turn),
    buttons: [],
    overlay: {
      kind: "textInput",
      id: `${HALL}:chainname`,
      prompt: xt(turn).text.chains.namePrompt,
      maxLength: NAME_LENGTH,
    },
  };
}

export function foundChain(turn: Turn, raw: string | null): View {
  const t = xt(turn).text.chains;
  if (raw === null) return chainsView(turn);
  const name = filterUserText(turn, stripControl(raw).trim(), "announcement").slice(0, NAME_LENGTH);
  const l = townLife(turn.town);
  if (name === "" || l.chains.some((c) => c.name.toLowerCase() === name.toLowerCase()))
    return chainsView(turn, t.badName);
  const c = tr(turn).chains;
  const p = turn.player;
  if (chainOf(turn.town, p) || cooldownLeft(turn) > 0 || p.money < c.found)
    throw new Error("Cannot found a chain");
  moneyMod(p, -c.found);
  spent(turn, "chain", c.found);
  const chain: Chain = {
    id: `c${l.nextChain++}`,
    name,
    founder: p.id,
    members: [p.id],
    score: 0,
    invites: [],
    hitsToday: 0,
    hitsDay: 0,
  };
  l.chains.push(chain);
  life(turn).chain = chain.id;
  refreshRating(turn.rules, p);
  return chainsView(turn, fill(t.founded, { name }));
}

export function invitePicker(turn: Turn): View {
  const mine = chainOf(turn.town, turn.player);
  if (!mine || mine.members.length >= tr(turn).chains.maxMembers) throw new Error("Cannot invite");
  return {
    ...chainsView(turn),
    buttons: [],
    overlay: {
      kind: "playerPicker",
      id: `${HALL}:invitepick`,
      prompt: xt(turn).text.chains.invitePrompt,
      players: invitable(turn).map((q) => ({ id: q.id, name: q.name })),
    },
  };
}

export function invite(turn: Turn, id: number | null): View {
  const t = xt(turn).text.chains;
  const mine = chainOf(turn.town, turn.player);
  if (id === null || !mine) return chainsView(turn);
  const q = invitable(turn).find((x) => x.id === id);
  if (!q) return chainsView(turn);
  mine.invites.push(q.id);
  sendPacket(turn.town, q.id, {
    type: "text",
    text: fill(t.inviteMail, { chain: mine.name, name: turn.player.name }),
  });
  mailContinue(turn, q.id);
  return chainsView(turn, fill(t.invited, { name: q.name }));
}

export function joinChain(turn: Turn, id: string): View {
  const t = xt(turn).text.chains;
  const c = tr(turn).chains;
  const p = turn.player;
  const chain = chainById(turn.town, id);
  if (!chain?.invites.includes(p.id) || chainOf(turn.town, p)) throw new Error("No invite");
  if (cooldownLeft(turn) > 0 || chain.members.length >= c.maxMembers || p.money < c.join)
    throw new Error("Cannot join");
  moneyMod(p, -c.join);
  spent(turn, "chain", c.join);
  chain.invites = chain.invites.filter((x) => x !== p.id);
  for (const m of chain.members) {
    sendPacket(turn.town, m, { type: "text", text: fill(t.joinedMail, { name: p.name }) });
  }
  chain.members.push(p.id);
  life(turn).chain = chain.id;
  refreshRating(turn.rules, p);
  return chainsView(turn, fill(t.joined, { name: chain.name }));
}

function removeMember(town: TownState, player: PlayerState): void {
  const l = townLife(town);
  const chain = chainOf(town, player);
  const pl = lifeOf(town, player);
  pl.chain = null;
  pl.leftChainDay = town.day;
  if (!chain) return;
  chain.members = chain.members.filter((m) => m !== player.id);
  if (chain.members.length === 0) l.chains = l.chains.filter((c) => c.id !== chain.id);
}

export function leaveChain(turn: Turn): View {
  if (!chainOf(turn.town, turn.player)) throw new Error("Not in a chain");
  removeMember(turn.town, turn.player);
  refreshRating(turn.rules, turn.player);
  return chainsView(turn, xt(turn).text.chains.left);
}

/** Section 23.2: a member's sale BP counts toward the chain's season score. */
export function chainScore(town: TownState, player: PlayerState, bp: number): void {
  const chain = chainOf(town, player);
  if (chain && bp > 0) chain.score += bp;
}

/**
 * Section 23.1, at midnight: dues from every member; a member who cannot pay
 * is dropped (and mailed). Members who left town are dropped too.
 */
export function chainsMidnight(turn: Turn): void {
  const town = turn.town;
  const l = townLife(town);
  const c = tr(turn).chains;
  const t = xt(turn).text.chains;
  for (const chain of [...l.chains]) {
    for (const id of [...chain.members]) {
      const p = town.players[id];
      if (!p?.active || !p.expanded) {
        chain.members = chain.members.filter((m) => m !== id);
        continue;
      }
      if (p.money >= c.dues) {
        moneyMod(p, -c.dues);
        const s = lifeOf(town, p).spent;
        s.chain = (s.chain ?? 0) + c.dues;
      } else {
        removeMember(town, p);
        refreshRating(turn.rules, p);
        sendPacket(town, p.id, { type: "text", text: fill(t.duesUnpaid, { dues: c.dues }) });
      }
    }
    chain.invites = chain.invites.filter((id) => town.players[id]?.active);
    if (chain.members.length === 0) l.chains = l.chains.filter((x) => x.id !== chain.id);
  }
}
