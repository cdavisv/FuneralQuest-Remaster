import type { BingoPanel, Button, View } from "@fq/protocol";
import { mailContinue, sendPacket } from "../../classic/mail.js";
import { addToNews } from "../../classic/news.js";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { button, goButton } from "../../engine/view.js";
import { fill, intToCash } from "../../text/format.js";
import { modValue } from "../modifiers.js";
import { hasPerk, refreshRating } from "../parlor.js";
import { karmaMod, moneyMod, reviewsMod, xr } from "../players.js";
import { appealButtons } from "./arcs.js";
import {
  arrive,
  card,
  cash,
  life,
  line,
  off,
  spent,
  TOWN_MODIFIER_KEYS,
  today,
  townLife,
  townScreen,
  tr,
  xt,
} from "./life.js";
import type { BingoState } from "./state.js";

/**
 * The church, Father Smyth (docs/expanded-rules.md section 17): Bingo Night
 * (the original scripting docs' design, made a shared town event), confession
 * to buy back karma, holy water for the Bless action, the Church Associate's
 * service, and tithes. Replaces the Classic church script in Expanded towns.
 * Button ids: `church:bingo`, `church:card:1|3`, `church:confess`,
 * `church:water`, `church:serve`, `church:tithe`, `church:main`.
 */
export const CHURCH_X = "church";

function screen(turn: Turn, text: string, buttons: Button[], bingo = false): View {
  const t = xt(turn).text.church;
  const pic = bingo ? xt(turn).pictures.bingo : xt(turn).pictures.church;
  return townScreen(turn, { title: t.title, note: t.note, text, buttons, ...pic });
}

/** Tonight's round, started on first use today (section 17.1). */
export function bingoRound(turn: Turn): BingoState {
  const l = townLife(turn.town);
  const cards = tr(turn).church.bingo.cards;
  if (l.bingo.cards.length !== cards || (l.bingo.day !== turn.town.day && l.bingo.paid === 0)) {
    const carry = l.bingo.carry;
    l.bingo = {
      day: turn.town.day,
      cards: Array.from({ length: cards }, () => -1),
      paid: 0,
      carry,
    };
  }
  return l.bingo;
}

/** Section 17.1: the pot is the paid cards less the church's cut (rounded down), plus the carry. */
export function bingoPot(turn: Turn, round: BingoState): number {
  const cut = modValue(turn.town, TOWN_MODIFIER_KEYS.bingoCut, tr(turn).church.bingo.cut);
  return (
    Math.floor(round.paid * tr(turn).church.bingo.price * (1 - Math.min(1, Math.max(0, cut)))) +
    round.carry
  );
}

function bingoOpen(turn: Turn): boolean {
  return modValue(turn.town, TOWN_MODIFIER_KEYS.bingo, 1) > 0;
}

/** Whether the next card is the Church Associate's free one. */
function freeCard(turn: Turn, round: BingoState): boolean {
  return (
    hasPerk(xr(turn), turn.player, "church-associate") && !round.cards.includes(turn.player.id)
  );
}

function main(turn: Turn, message = ""): View {
  const t = xt(turn).text.church;
  const hints = xt(turn).text.hints;
  const c = tr(turn).church;
  const p = turn.player;
  const l = life(turn);
  const d = today(turn);
  const greeting = fill(line(turn, t.greeting), { player: p.name });
  const buttons: Button[] = [button(`${CHURCH_X}:bingo`, t.buttons.bingo)];
  if (!bingoOpen(turn)) buttons[0] = off(buttons[0] as Button, hints.closedToday);
  const price = c.confession.first + c.confession.step * d.confessions;
  let confess: Button = {
    ...button(`${CHURCH_X}:confess`, t.buttons.confess),
    detail: cash(price),
  };
  if (p.karma >= c.confession.upTo) confess = off(confess, hints.karmaTooHigh);
  else if (d.confessions >= c.confession.perDay) confess = off(confess, hints.doneToday);
  else if (p.money < price) confess = off(confess, hints.notEnoughCash);
  buttons.push(confess);
  let water: Button = {
    ...button(`${CHURCH_X}:water`, t.buttons.holyWater),
    group: "more",
    detail: cash(c.holyWater.price),
  };
  if (p.karma < c.holyWater.karmaAtLeast) water = off(water, hints.karmaTooLow);
  else if (l.holyWater >= c.holyWater.max) water = off(water, hints.alreadyHave);
  else if (p.money < c.holyWater.price) water = off(water, hints.notEnoughCash);
  let serve: Button = {
    ...button(`${CHURCH_X}:serve`, t.buttons.service),
    group: "more",
    detail: fill(hints.costsTurns, { turns: c.service.turns }),
  };
  if (!hasPerk(xr(turn), p, "church-associate")) serve = off(serve, hints.karmaTooLow);
  else if (d.served) serve = off(serve, hints.doneToday);
  else if (p.turns < c.service.turns) serve = off(serve, hints.noTurns);
  let tithe: Button = {
    ...button(`${CHURCH_X}:tithe`, t.buttons.tithe),
    group: "more",
    detail: cash(c.tithe.step),
  };
  if (d.tithed + c.tithe.step > c.tithe.perDay)
    tithe = off(tithe, fill(hints.limitReached, { limit: cash(c.tithe.perDay) }));
  else if (p.money < c.tithe.step) tithe = off(tithe, hints.notEnoughCash);
  buttons.push(
    water,
    serve,
    tithe,
    ...appealButtons(turn, "church"),
    goButton("map", t.buttons.leave),
  );
  return screen(turn, message === "" ? greeting : `${message}\n\n${greeting}`, buttons);
}

// ---------------------------------------------------------------- 17.1 bingo

function bingoView(turn: Turn, message = ""): View {
  const t = xt(turn).text.church;
  const hints = xt(turn).text.hints;
  const b = tr(turn).church.bingo;
  const round = bingoRound(turn);
  const p = turn.player;
  const mine = round.cards.flatMap((owner, i) => (owner === p.id ? [i + 1] : []));
  const sold = round.cards.filter((o) => o >= 0).length;
  const text = fill(t.bingoIntro, {
    pot: bingoPot(turn, round),
    carry: round.carry,
    sold,
    cards: b.cards,
    mine: mine.length === 0 ? "-" : mine.join(", "),
    wood: p.tags[0] ?? 0,
    max: b.maxPerPlayer,
  });
  const buttons: Button[] = [];
  for (const count of [1, 3]) {
    const free = count === 1 && freeCard(turn, round);
    let c = card(
      `${CHURCH_X}:card:${count}`,
      count === 1 ? t.buttons.buyOne : t.buttons.buyThree,
      free ? t.bingoFree : `${count * b.price} wood`,
    );
    const cost = free ? 0 : count * b.price;
    if (!bingoOpen(turn)) c = off(c, hints.closedToday);
    else if (sold + count > b.cards) c = off(c, hints.soldOut);
    else if (mine.length + count > b.maxPerPlayer)
      c = off(c, fill(hints.limitReached, { limit: b.maxPerPlayer }));
    else if ((p.tags[0] ?? 0) < cost) c = off(c, hints.notEnoughTags);
    buttons.push(c);
  }
  buttons.push(button(`${CHURCH_X}:main`, t.buttons.back));
  const view = screen(turn, message === "" ? text : `${message}\n\n${text}`, buttons, true);
  view.bingo = bingoPanel(turn, round);
  return view;
}

/** Section 11.5: tonight's round as data. Drawn at the midnight after `round.day`. */
export function bingoPanel(turn: Turn, round: BingoState): BingoPanel {
  const b = tr(turn).church.bingo;
  const p = turn.player;
  const taken: number[] = [];
  const mine: number[] = [];
  round.cards.forEach((owner, i) => {
    if (owner >= 0) taken.push(i + 1);
    if (owner === p.id) mine.push(i + 1);
  });
  return {
    open: bingoOpen(turn),
    pot: bingoPot(turn, round),
    carry: round.carry,
    price: b.price,
    cards: round.cards.length,
    sold: taken.length,
    taken,
    mine,
    maxPerPlayer: b.maxPerPlayer,
    nextFree: freeCard(turn, round),
    drawDay: round.day,
    daysLeft: Math.max(0, round.day - turn.town.day),
  };
}

function buyCards(turn: Turn, count: number): View {
  const b = tr(turn).church.bingo;
  const t = xt(turn).text.church;
  const round = bingoRound(turn);
  const p = turn.player;
  if (!bingoOpen(turn)) throw new Error("No bingo tonight");
  const mine = round.cards.filter((o) => o === p.id).length;
  const sold = round.cards.filter((o) => o >= 0).length;
  const free = count === 1 && freeCard(turn, round);
  const cost = free ? 0 : count * b.price;
  if (sold + count > b.cards || mine + count > b.maxPerPlayer || (p.tags[0] ?? 0) < cost)
    throw new Error("Cannot buy those cards");
  p.tags[0] = (p.tags[0] ?? 0) - cost;
  if (!free) round.paid += count;
  const numbers: number[] = [];
  for (let i = 0; i < round.cards.length && numbers.length < count; i++) {
    if (round.cards[i] === -1) {
      round.cards[i] = p.id;
      numbers.push(i + 1);
    }
  }
  return bingoView(turn, fill(t.bingoBought, { count, numbers: numbers.join(", ") }));
}

/**
 * Section 17.1, at midnight: draw one of the cards. Its owner takes the pot;
 * an unsold winning card carries the pot to the next night. Tags only move
 * between players and the church's cut, so bingo can never mint tags.
 */
export function bingoMidnight(turn: Turn): void {
  const town = turn.town;
  const l = townLife(town);
  const round = l.bingo;
  const t = xt(turn).text.church;
  const sold = round.cards.filter((o) => o >= 0).length;
  if (round.day > 0 && round.day < town.day && sold > 0) {
    const pot = bingoPot(turn, round);
    const winner = turn.rng.random(round.cards.length);
    const owner = round.cards[winner] ?? -1;
    const p = owner >= 0 ? town.players[owner] : undefined;
    if (p?.active) {
      p.tags[0] = (p.tags[0] ?? 0) + pot;
      round.carry = 0;
      sendPacket(town, p.id, {
        type: "text",
        text: fill(t.bingoWinMail, { pot, card: winner + 1 }),
      });
      mailContinue(turn, p.id);
      addToNews(town, fill(t.bingoNews, { name: p.name, pot, card: winner + 1 }));
    } else {
      round.carry = pot;
      addToNews(town, fill(t.bingoCarryNews, { card: winner + 1, pot }));
    }
  }
  l.bingo = {
    day: town.day,
    cards: Array.from({ length: tr(turn).church.bingo.cards }, () => -1),
    paid: 0,
    carry: round.carry,
  };
}

// ---------------------------------------------------------------- 17.2 to 17.4

function confess(turn: Turn): View {
  const c = tr(turn).church.confession;
  const p = turn.player;
  const d = today(turn);
  const price = c.first + c.step * d.confessions;
  if (p.karma >= c.upTo || d.confessions >= c.perDay || p.money < price)
    throw new Error("Cannot confess");
  moneyMod(p, -price);
  spent(turn, "confession", price);
  d.confessions++;
  karmaMod(p, 1);
  refreshRating(turn.rules, p);
  const t = xt(turn).text.church;
  const text =
    p.karma >= c.upTo
      ? t.confessCapped
      : fill(line(turn, t.confessed), { price: intToCash(price) });
  return main(turn, text);
}

function holyWater(turn: Turn): View {
  const c = tr(turn).church.holyWater;
  const p = turn.player;
  const l = life(turn);
  if (p.karma < c.karmaAtLeast || l.holyWater >= c.max || p.money < c.price)
    throw new Error("Cannot buy holy water");
  moneyMod(p, -c.price);
  spent(turn, "holyWater", c.price);
  l.holyWater++;
  return main(turn, fill(xt(turn).text.church.holyWaterBought, { have: l.holyWater }));
}

function serve(turn: Turn): View {
  const c = tr(turn).church.service;
  const p = turn.player;
  const d = today(turn);
  if (!hasPerk(xr(turn), p, "church-associate") || d.served || p.turns < c.turns)
    throw new Error("Cannot lead the service");
  p.turns -= c.turns;
  d.served = true;
  const bp = c.bpBase + Math.floor(p.rating / c.ratingDiv);
  p.bp += bp;
  p.bpToday += bp;
  reviewsMod(p, xr(turn), c.reviews);
  refreshRating(turn.rules, p);
  return main(turn, fill(xt(turn).text.church.served, { bp, reviews: c.reviews }));
}

function tithe(turn: Turn): View {
  const c = tr(turn).church.tithe;
  const p = turn.player;
  const d = today(turn);
  if (d.tithed + c.step > c.perDay || p.money < c.step) throw new Error("Cannot tithe");
  moneyMod(p, -c.step);
  spent(turn, "tithe", c.step);
  d.tithed += c.step;
  const bp = titheBp(turn);
  p.bp += bp;
  p.bpToday += bp;
  const t = xt(turn).text.church;
  return main(turn, fill(line(turn, t.tithed), { money: intToCash(c.step), bp }));
}

/** Section 17.5: the BP a tithe earns; the church favours the faithful and frowns on blood money. */
export function titheBp(turn: Turn): number {
  const c = tr(turn).church.tithe;
  const k = xr(turn).karma;
  const karma = turn.player.karma;
  const mult = karma >= k.good[0] ? c.goodMult : karma <= k.evil[0] ? c.evilMult : 1;
  return Math.floor(c.bpPerStep * mult);
}

export const expandedChurchModule: LocationModule = {
  id: CHURCH_X,
  enter(turn) {
    arrive(turn, xt(turn).text.church.title, CHURCH_X);
    return main(turn);
  },
  press(turn, command) {
    if (command === "main") return main(turn);
    if (command === "bingo") {
      if (!bingoOpen(turn)) throw new Error("No bingo tonight");
      return bingoView(turn);
    }
    if (command.startsWith("card:")) return buyCards(turn, Number(command.slice(5)) === 3 ? 3 : 1);
    if (command === "confess") return confess(turn);
    if (command === "water") return holyWater(turn);
    if (command === "serve") return serve(turn);
    if (command === "tithe") return tithe(turn);
    throw new Error(`Unknown church command ${command}`);
  },
};
