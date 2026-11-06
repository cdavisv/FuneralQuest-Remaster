import type { Button, ClubPanel, View } from "@fq/protocol";
import { mailContinue, sendPacket } from "../../classic/mail.js";
import { addToNews } from "../../classic/news.js";
import { expModForceTotal, luckMod } from "../../classic/players.js";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { button, goButton } from "../../engine/view.js";
import type { ExpandedTownRules } from "../../rules/expandedTownRules.js";
import type { PlayerState } from "../../state/types.js";
import { fill, intToCash } from "../../text/format.js";
import type { MarketItemDef } from "../content/townTypes.js";
import { modValue } from "../modifiers.js";
import { defenceLevel, hasPerk, refreshRating, stockCapacity, stockTotal } from "../parlor.js";
import {
  applyReward,
  karmaMod,
  moneyMod,
  reviewsMod,
  rewardSummary,
  roll,
  xp,
  xr,
} from "../players.js";
import { isPeaceful } from "../pvp.js";
import { pvpGain } from "../scoring.js";
import { appealButtons } from "./arcs.js";
import {
  addInjury,
  arrive,
  card,
  cash,
  chooseInjury,
  life,
  lifeOf,
  line,
  off,
  sameChain,
  spent,
  TOWN_MODIFIER_KEYS,
  today,
  townLife,
  townScreen,
  tr,
  xt,
} from "./life.js";

/**
 * The Reaper Club (docs/expanded-rules.md section 20), the authors' cut rave
 * club: a cover charge in wood tags (free for Necromancers, whose home it
 * is), three fair house games with a small house edge, a black market whose
 * stock changes daily, a hit man, a bodyguard, and the Necromancer's seance.
 * Button ids: `reaper-club:pay`, `:main`, `:games`, `:draw:<stake>`,
 * `:slots:<stake>`, `:shots:<stake>`, `:market`, `:buy:<id>`, `:hit`
 * (picker `reaper-club:hitpick`), `:bodyguard`, `:seance`.
 */
export const CLUB = "reaper-club";

type Game = "draw" | "slots" | "shots";
const GAMES: Game[] = ["draw", "slots", "shots"];

// ---------------------------------------------------------------- 20.2 the house games, exactly

/** Dead Man's Draw: expected return per dollar staked (1 = fair). */
export function drawReturn(rules: ExpandedTownRules): number {
  // 13 x 13 equally likely pairs: 78 wins (2x), 78 losses (0), 13 ties (refund 1 - tieLoss).
  return (78 * 2 + 13 * (1 - rules.club.draw.tieLoss)) / 169;
}

/** The One-Armed Undertaker: expected return per dollar, by enumerating every spin. */
export function slotsReturn(rules: ExpandedTownRules): number {
  const reel = rules.club.slots.reel;
  let total = 0;
  for (const a of reel)
    for (const b of reel) for (const c of reel) total += slotsPays(rules, a, b, c);
  return total / reel.length ** 3;
}

export function slotsPays(rules: ExpandedTownRules, a: string, b: string, c: string): number {
  const s = rules.club.slots;
  if (a === b && b === c) return s.triple[a] ?? 0;
  return a === s.first.symbol ? s.first.pays : 0;
}

/** Formaldehyde Roulette: expected return per dollar (the injury on a loss not counted). */
export function shotsReturn(rules: ExpandedTownRules): number {
  const g = rules.club.shots.glasses;
  return ((g - 1) / g) * (1 + rules.club.shots.payout);
}

// ---------------------------------------------------------------- screens

type ClubRoom = "door" | "room" | "tables" | "market";

function screen(turn: Turn, text: string, buttons: Button[], room: ClubRoom = "room"): View {
  const t = xt(turn).text.club;
  const pics = xt(turn).pictures;
  const pic =
    (room === "door"
      ? pics.clubDoor
      : room === "tables"
        ? pics.clubTables
        : room === "market"
          ? pics.blackMarket
          : undefined) ?? pics.club;
  const view = townScreen(turn, {
    title: t.title,
    note: t.note,
    text,
    buttons,
    ...pic,
  });
  view.club = clubPanel(turn);
  return view;
}

/** Section 11.5: the cover, today's stakes and the limit, as data (read-only). */
export function clubPanel(turn: Turn): ClubPanel {
  const c = tr(turn).club;
  const l = turn.player.expanded?.life;
  const counted = l?.today.day === turn.town.day;
  return {
    cover: coverPrice(turn),
    inside: (counted && !!l?.today.cover) || hasPerk(xr(turn), turn.player, "necromancer"),
    staked: counted ? (l?.today.staked ?? 0) : 0,
    stakeMax: c.dailyStakeMax,
    stakes: [...c.stakes],
  };
}

function coverPrice(turn: Turn): number {
  return Math.max(
    0,
    Math.round(modValue(turn.town, TOWN_MODIFIER_KEYS.cover, tr(turn).club.cover)),
  );
}

function inside(turn: Turn): boolean {
  return today(turn).cover || hasPerk(xr(turn), turn.player, "necromancer");
}

function door(turn: Turn, message = ""): View {
  const t = xt(turn).text.club;
  const cover = coverPrice(turn);
  const text = fill(t.door, { cover, owner: xt(turn).cast.clubOwner });
  let pay: Button = { ...button(`${CLUB}:pay`, t.buttons.pay), detail: `${cover} wood` };
  if ((turn.player.tags[0] ?? 0) < cover) pay = off(pay, xt(turn).text.hints.notEnoughTags);
  return screen(
    turn,
    message === "" ? text : `${message}\n\n${text}`,
    [pay, goButton("map", t.buttons.leave)],
    "door",
  );
}

function main(turn: Turn, message = ""): View {
  if (!inside(turn)) return door(turn, message);
  const t = xt(turn).text.club;
  const hints = xt(turn).text.hints;
  const c = tr(turn).club;
  const p = turn.player;
  const d = today(turn);
  let text = line(turn, t.inside);
  if (hasPerk(xr(turn), p, "necromancer") && !d.cover) text = `${t.necroFree}\n${text}`;
  const buttons: Button[] = [
    button(`${CLUB}:games`, t.buttons.games),
    button(`${CLUB}:market`, t.buttons.market),
    button(`${CLUB}:hit`, t.buttons.hit),
  ];
  if (d.hired) buttons[2] = off(buttons[2] as Button, hints.doneToday);
  let guard: Button = {
    ...button(`${CLUB}:bodyguard`, t.buttons.bodyguard),
    group: "more",
    detail: cash(c.bodyguard.price),
  };
  if (life(turn).bodyguardDay === turn.town.day) guard = off(guard, hints.alreadyHave);
  else if (p.money < c.bodyguard.price) guard = off(guard, hints.notEnoughCash);
  let seance: Button = {
    ...button(`${CLUB}:seance`, t.buttons.seance),
    group: "more",
    detail: fill(hints.costsTurns, { turns: c.seance.turns }),
  };
  if (!hasPerk(xr(turn), p, "necromancer")) seance = off(seance, hints.karmaTooHigh);
  else if (d.seance) seance = off(seance, hints.doneToday);
  else if (p.turns < c.seance.turns) seance = off(seance, hints.noTurns);
  buttons.push(
    guard,
    seance,
    ...appealButtons(turn, "reaper-club"),
    goButton("map", t.buttons.leave),
  );
  return screen(turn, message === "" ? text : `${message}\n\n${text}`, buttons);
}

function back(turn: Turn): Button {
  return button(`${CLUB}:main`, xt(turn).text.club.buttons.back);
}

// ---------------------------------------------------------------- 20.2 games

function stakeAllowed(turn: Turn, stake: number): string {
  const c = tr(turn).club;
  const hints = xt(turn).text.hints;
  if (turn.player.money < stake) return hints.notEnoughCash;
  if (today(turn).staked + stake > c.dailyStakeMax)
    return fill(hints.limitReached, { limit: cash(c.dailyStakeMax) });
  return "";
}

function gamesView(turn: Turn, message = ""): View {
  const t = xt(turn).text.club;
  const c = tr(turn).club;
  let text = fill(t.gamesIntro, {
    staked: intToCash(today(turn).staked),
    max: intToCash(c.dailyStakeMax),
  });
  text += `\n${t.shotsIntro}`;
  if (message !== "") text = `${message}\n\n${text}`;
  const buttons: Button[] = [];
  for (const game of GAMES) {
    for (const stake of c.stakes) {
      const label = `${t.buttons[game]} ${fill(t.stakeLabel, { stake: intToCash(stake) })}`;
      const b = card(`${CLUB}:${game}:${stake}`, label, cash(stake));
      const why = stakeAllowed(turn, stake);
      buttons.push(why === "" ? b : off(b, why));
    }
  }
  buttons.push(back(turn));
  return screen(turn, text, buttons, "tables");
}

function play(turn: Turn, game: Game, stake: number): View {
  const c = tr(turn).club;
  const t = xt(turn).text.club;
  if (!inside(turn)) throw new Error("Pay the cover first");
  if (!c.stakes.includes(stake)) throw new Error("No such stake");
  if (stakeAllowed(turn, stake) !== "") throw new Error("Cannot stake that");
  const p = turn.player;
  const rng = turn.rng;
  today(turn).staked += stake;
  spent(turn, "staked", stake);
  moneyMod(p, -stake);
  let back = 0;
  let text: string;
  if (game === "draw") {
    const you = rng.random(13);
    const dealer = rng.random(13);
    const vars = {
      you: t.cards[you] ?? String(you + 1),
      dealer: t.cards[dealer] ?? String(dealer + 1),
    };
    if (you > dealer) {
      back = stake * 2;
      text = fill(t.drawWin, { ...vars, won: intToCash(stake) });
    } else if (you < dealer) {
      text = fill(t.drawLose, { ...vars, won: intToCash(stake) });
    } else {
      back = stake - Math.floor(stake * c.draw.tieLoss);
      text = fill(t.drawTie, { ...vars, won: intToCash(stake - back) });
    }
  } else if (game === "slots") {
    const reel = c.slots.reel;
    const spin = [0, 1, 2].map(() => reel[rng.random(reel.length)] as string);
    const pays = slotsPays(tr(turn), spin[0] as string, spin[1] as string, spin[2] as string);
    back = stake * pays;
    text = fill(t.slotsSpin, { reels: spin.map((s) => t.symbols[s] ?? s).join(" | ") });
    text += back > 0 ? fill(t.slotsWin, { won: intToCash(back) }) : t.slotsLose;
  } else {
    if (rng.random(c.shots.glasses) === 0) {
      text = t.shotsLose;
      const hurt = addInjury(turn, p, chooseInjury(turn, "roulette") ?? c.shots.injury);
      if (hurt !== "") text += `\n${hurt}`;
    } else {
      const won = Math.floor(stake * c.shots.payout);
      back = stake + won;
      text = fill(t.shotsWin, { won: intToCash(won) });
    }
  }
  moneyMod(p, back);
  const s = life(turn).spent;
  s.won = (s.won ?? 0) + back;
  const view = gamesView(turn, text);
  // Section 11.5: the round as data.
  if (view.club)
    view.club.lastRound = {
      game,
      stake,
      outcome: back > stake ? "win" : back > 0 ? "push" : "lose",
      payout: back,
      net: back - stake,
    };
  return view;
}

// ---------------------------------------------------------------- 20.3 the black market

function marketItems(turn: Turn): MarketItemDef[] {
  const ids = townLife(turn.town).market;
  return xt(turn).market.filter((m) => ids.includes(m.id));
}

function cantBuy(turn: Turn, item: MarketItemDef): string {
  const hints = xt(turn).text.hints;
  const l = life(turn);
  const p = turn.player;
  if (today(turn).bought.includes(item.id)) return hints.soldOut;
  if (p.money < item.price) return hints.notEnoughCash;
  switch (item.grant) {
    case "armor":
      return l.armor ? hints.alreadyHave : "";
    case "lead":
      return l.leads >= tr(turn).hospital.lead.max ? hints.alreadyHave : "";
    case "gold-casket":
      return stockTotal(xp(turn)) >= stockCapacity(xr(turn), p) ? hints.alreadyHave : "";
    case "bodyguard":
      return l.bodyguardDay === turn.town.day ? hints.alreadyHave : "";
    case "permit":
      return missingPermit(turn) === undefined ? hints.alreadyHave : "";
    case "holy-water":
      return l.holyWater >= tr(turn).church.holyWater.max ? hints.alreadyHave : "";
    default:
      return "";
  }
}

function missingPermit(turn: Turn): string | undefined {
  const held = life(turn).permits;
  return Object.entries(tr(turn).cityHall.permits)
    .sort((a, b) => a[1] - b[1])
    .map(([id]) => id)
    .find((id) => !held.includes(id));
}

function marketView(turn: Turn, message = ""): View {
  const t = xt(turn).text.club;
  let text = message === "" ? t.marketIntro : `${message}\n\n${t.marketIntro}`;
  const buttons: Button[] = [];
  for (const item of marketItems(turn)) {
    const summary = rewardSummary(item.reward);
    text += fill(t.marketLine, { name: item.name, price: intToCash(item.price), text: item.text });
    const b = card(`${CLUB}:buy:${item.id}`, item.name, cash(item.price));
    if (summary !== "") b.hint = summary;
    const why = cantBuy(turn, item);
    buttons.push(why === "" ? b : off(b, why));
  }
  buttons.push(back(turn));
  return screen(turn, text, buttons, "market");
}

function buy(turn: Turn, id: string): View {
  const item = marketItems(turn).find((m) => m.id === id);
  if (!item || cantBuy(turn, item) !== "") throw new Error("Cannot buy that");
  const p = turn.player;
  const l = life(turn);
  moneyMod(p, -item.price);
  spent(turn, "market", item.price);
  today(turn).bought.push(item.id);
  applyReward(turn, p, item.reward);
  switch (item.grant) {
    case "armor":
      l.armor = true;
      break;
    case "lead":
      l.leads++;
      break;
    case "gold-casket":
      xp(turn).stock[2]++;
      break;
    case "bodyguard":
      l.bodyguardDay = turn.town.day;
      break;
    case "permit": {
      const permit = missingPermit(turn);
      if (permit) l.permits.push(permit);
      break;
    }
    case "holy-water":
      l.holyWater++;
      break;
  }
  refreshRating(turn.rules, p);
  return marketView(turn, fill(xt(turn).text.club.marketBought, { name: item.name }));
}

function restockMarket(turn: Turn): void {
  const pool = [...xt(turn).market];
  const out: string[] = [];
  const slots = tr(turn).club.market.slots;
  while (out.length < slots && pool.length > 0) {
    const total = pool.reduce((s, m) => s + (m.weight ?? 1), 0);
    let r = roll(turn.rng) * total;
    let index = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i]?.weight ?? 1;
      if (r < 0) {
        index = i;
        break;
      }
    }
    const [m] = pool.splice(index, 1);
    if (m) out.push(m.id);
  }
  townLife(turn.town).market = out;
}

// ---------------------------------------------------------------- 20.4 the hit man and the bodyguard

/** Section 20.4: the hit man's price for `target`. */
export function hitPrice(turn: Turn, target: PlayerState): number {
  const h = tr(turn).club.hit;
  const step = xr(turn).customer.limitStep;
  const raw = modValue(turn.town, TOWN_MODIFIER_KEYS.hitPrice, h.base + h.perBp * target.bp);
  return Math.round(raw / step) * step;
}

function hitPicker(turn: Turn): View {
  const t = xt(turn).text.club;
  if (today(turn).hired) throw new Error("One hit a day");
  const players = turn.town.players
    .filter((q) => q.active && q.expanded && q.id !== turn.player.id)
    .map((q) => ({ id: q.id, name: `${q.name} (${cash(hitPrice(turn, q))})` }));
  if (players.length === 0) return main(turn, xt(turn).text.hints.noRivals);
  return {
    ...main(turn),
    buttons: [],
    overlay: {
      kind: "playerPicker",
      id: `${CLUB}:hitpick`,
      prompt: fill(t.hitPrompt, { price: intToCash(tr(turn).club.hit.base) }),
      players,
    },
  };
}

/** Why a hit on `target` cannot be booked, or "". */
export function hitRefusal(turn: Turn, target: PlayerState | undefined): string {
  const t = xt(turn).text.club;
  const hints = xt(turn).text.hints;
  const me = turn.player;
  if (!target?.active || !target.expanded) return hints.noRivals;
  if (target.id === me.id) return t.hitSelf;
  if (isPeaceful(target)) return fill(t.hitPeaceful, { name: target.name });
  if (sameChain(turn.town, me, target)) return fill(t.hitChain, { name: target.name });
  if (townLife(turn.town).hits.some((h) => h.target === target.id))
    return fill(t.hitTaken, { name: target.name });
  if (today(turn).hired) return hints.doneToday;
  if (me.money < hitPrice(turn, target)) return hints.notEnoughCash;
  return "";
}

function bookHit(turn: Turn, id: number | null): View {
  if (id === null) return main(turn);
  const target = turn.town.players[id];
  const why = hitRefusal(turn, target);
  if (why !== "" || !target) return main(turn, why);
  const h = tr(turn).club.hit;
  const price = hitPrice(turn, target);
  const me = turn.player;
  moneyMod(me, -price);
  spent(turn, "hit", price);
  karmaMod(me, h.karma);
  today(turn).hired = true;
  townLife(turn.town).hits.push({ by: me.id, target: target.id, day: turn.town.day });
  if (target.luck >= h.rumourLuck) {
    sendPacket(turn.town, target.id, { type: "text", text: xt(turn).text.club.hitRumour });
  }
  refreshRating(turn.rules, me);
  return main(turn, fill(xt(turn).text.club.hitBooked, { name: target.name }));
}

/**
 * Section 20.4, at midnight: each booked hit is foiled by police protection,
 * a bodyguard for the night, body armour, or a roll against security and
 * the Church Associate's sanctuary; otherwise the target loses BP and gets
 * hurt. A foiled hit man talks half the time: the target learns who paid,
 * and the hirer is fined and talked about.
 */
export function resolveHits(turn: Turn): void {
  const town = turn.town;
  const l = townLife(town);
  const h = tr(turn).club.hit;
  const t = xt(turn).text.club;
  const rules = xr(turn);
  const due = l.hits.filter((o) => o.day < town.day);
  l.hits = l.hits.filter((o) => o.day >= town.day);
  for (const order of due) {
    const target = town.players[order.target];
    const hirer = town.players[order.by];
    if (!target?.active || !target.expanded) continue;
    const tl = lifeOf(town, target);
    let foiled = target.policeProtected || tl.bodyguardDay === order.day || isPeaceful(target);
    if (!foiled && tl.armor) {
      tl.armor = false;
      foiled = true;
    }
    if (!foiled) {
      let chance = defenceLevel(rules, target) * h.foilPerLevel;
      if (hasPerk(rules, target, "church-associate")) chance += h.sanctuary;
      foiled = turn.rng.random(100) < chance;
    }
    if (!foiled) {
      const lost = Math.floor(pvpGain(rules, target.bp) * h.lossShare);
      expModForceTotal(target, -lost);
      const hurt = addInjury(turn, target, chooseInjury(turn, "hit") ?? h.injury);
      sendPacket(town, target.id, {
        type: "text",
        text: `${fill(t.hitMail, { bp: lost })}${hurt === "" ? "" : `\n${hurt}`}`,
      });
      mailContinue(turn, target.id);
      addToNews(town, fill(t.hitNews, { name: target.name }), "crime");
      continue;
    }
    sendPacket(town, target.id, { type: "text", text: t.hitFoiledMail });
    if (hirer?.active) {
      sendPacket(town, hirer.id, {
        type: "text",
        text: fill(t.hitFoiledHirer, { name: target.name }),
      });
      if (turn.rng.random(100) < h.snitch) {
        moneyMod(hirer, -Math.min(hirer.money, h.fine));
        reviewsMod(hirer, rules, h.reviews);
        refreshRating(turn.rules, hirer);
        sendPacket(town, target.id, {
          type: "text",
          text: fill(t.hitSnitchMail, { name: hirer.name }),
        });
        addToNews(town, fill(t.hitSnitchNews, { name: hirer.name, target: target.name }), "crime");
      }
      mailContinue(turn, hirer.id);
    }
    mailContinue(turn, target.id);
  }
}

function bodyguard(turn: Turn): View {
  const c = tr(turn).club.bodyguard;
  const l = life(turn);
  if (l.bodyguardDay === turn.town.day || turn.player.money < c.price)
    throw new Error("Cannot hire");
  moneyMod(turn.player, -c.price);
  spent(turn, "bodyguard", c.price);
  l.bodyguardDay = turn.town.day;
  return main(turn, xt(turn).text.club.bodyguardBought);
}

/** Section 20.5: the Necromancer's seance: two leads, or bad luck. */
function seance(turn: Turn): View {
  const c = tr(turn).club.seance;
  const p = turn.player;
  const d = today(turn);
  if (!hasPerk(xr(turn), p, "necromancer") || d.seance || p.turns < c.turns)
    throw new Error("No seance");
  p.turns -= c.turns;
  d.seance = true;
  const t = xt(turn).text.club;
  if (turn.rng.randomYesNo(p.luck, c.luckWeight)) {
    const l = life(turn);
    l.leads = Math.min(tr(turn).hospital.lead.max, l.leads + c.leads);
    return main(turn, t.seanceWin);
  }
  luckMod(turn.rules, p, c.failLuck);
  return main(turn, t.seanceFail);
}

export function clubMidnight(turn: Turn): void {
  resolveHits(turn);
  restockMarket(turn);
}

export const clubModule: LocationModule = {
  id: CLUB,
  enter(turn) {
    arrive(turn, xt(turn).text.club.title, CLUB);
    return main(turn);
  },
  press(turn, command) {
    const [verb = "", arg = ""] = command.split(":");
    if (verb === "pay") {
      const cover = coverPrice(turn);
      if (inside(turn) || (turn.player.tags[0] ?? 0) < cover) throw new Error("Cannot pay");
      turn.player.tags[0] = (turn.player.tags[0] ?? 0) - cover;
      today(turn).cover = true;
      return main(turn);
    }
    if (verb === "main") return main(turn);
    if (!inside(turn)) throw new Error("Pay the cover first");
    switch (verb) {
      case "games":
        return gamesView(turn);
      case "draw":
      case "slots":
      case "shots":
        return play(turn, verb, Number(arg));
      case "market":
        return marketView(turn);
      case "buy":
        return buy(turn, arg);
      case "hit":
        return hitPicker(turn);
      case "bodyguard":
        return bodyguard(turn);
      case "seance":
        return seance(turn);
    }
    throw new Error(`Unknown club command ${command}`);
  },
  pickPlayer(turn, overlayId, playerId) {
    if (overlayId !== `${CLUB}:hitpick`) throw new Error(`Unknown overlay ${overlayId}`);
    return bookHit(turn, playerId);
  },
};
