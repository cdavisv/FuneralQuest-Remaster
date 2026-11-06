import type { View } from "@fq/protocol";
import type { LovedLine } from "../../content/classicText.js";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { button, hud, legacy } from "../../engine/view.js";
import type { ClassicRandom } from "../../rng/classicRandom.js";
import type { Nudge, PsychCheck } from "../../rules/classicRules.js";
import type { CustomerState } from "../../state/types.js";
import { fill, formatFixed0, intToCash, type TemplateVars } from "../../text/format.js";
import {
  casketName,
  chooseBackground,
  choosePortrait,
  cMan,
  customerMood,
  customerVars,
  cYoung,
  incomeLabel,
  priceOf,
} from "../customerText.js";
import { continueButton, currentBackground, makePicture } from "../location.js";
import {
  broadcastTv,
  mailBackground,
  mailContinue,
  mailPicture,
  mailReward,
  mailText,
} from "../mail.js";
import { addToNews } from "../news.js";
import {
  expMod,
  playerHis,
  playerSir,
  randomPlayerExcluding,
  validPlayerCount,
} from "../players.js";

/**
 * The negotiation (legacy/source/commands_complicated.cpp): arrival and psych
 * analysis, Soft Sell, Hard Sell and upgrades, Guilt, Sympathy, walkouts and
 * Done. Mood and cheapness are 32-bit floats, as in the original.
 */
export const NEGOTIATION = "neg";

const f32 = Math.fround;

function pick<T>(rng: ClassicRandom, lines: readonly T[]): T {
  return lines[rng.random(lines.length)] as T;
}

function loved(line: LovedLine, isLoved: boolean): string {
  if (typeof line === "string") return line;
  return isLoved ? line.loved : line.notLoved;
}

/** `base + frandom(range)` in 32-bit floats, for example `0.4f + frandom(0.7f)`. */
function nudge(rng: ClassicRandom, n: Nudge): number {
  return f32(f32(n.base) + rng.frandom(f32(n.range)));
}

function vars(turn: Turn, extra: TemplateVars = {}): TemplateVars {
  return { ...customerVars(turn.session.customer), player: turn.player.name, ...extra };
}

/** `number_is_close` (shared library, not in the repository): |a - b| <= range. */
function numberIsClose(a: number, b: number, range: number): boolean {
  return Math.abs(a - b) <= range;
}

/** `figure_complicated_total` (commands_complicated.cpp:291-306). */
function totalText(turn: Turn): string {
  const c = turn.session.customer;
  const n = turn.text.negotiation;
  let text = fill(n.total, { price: intToCash(priceOf(c, turn.rules, turn.content)) });
  if (c.showResistance) {
    text += fill(n.resistance, { percent: formatFixed0(f32(c.cheapness * 10)) });
  }
  return text;
}

/** `complicated_add_options` (:132-155): the five negotiation buttons, left to right. */
function negotiationView(turn: Turn, text: string): View {
  const c = turn.session.customer;
  const b = turn.text.negotiation.buttons;
  const panel: View["customer"] = {
    incomeLabel: incomeLabel(c),
    moodLabel: customerMood(c),
    moodLevel: Math.round(c.mood * 10) / 10,
    total: priceOf(c, turn.rules, turn.content),
  };
  if (c.showResistance) panel.resistancePercent = Number(formatFixed0(f32(c.cheapness * 10)));
  return {
    scene: "location",
    title: turn.session.location,
    text: legacy(text),
    picture: turn.session.view?.picture ?? {},
    hud: hud(turn.player),
    customer: panel,
    buttons: [
      button(`${NEGOTIATION}:guilt`, b.guilt),
      button(`${NEGOTIATION}:sympathy`, b.sympathy),
      button(`${NEGOTIATION}:hard`, b.hard),
      button(`${NEGOTIATION}:soft`, b.soft),
      button(`${NEGOTIATION}:done`, b.done),
    ],
  };
}

/** A sale that ended (walkout or Done): money bag picture and Continue. */
function endView(turn: Turn, text: string, picture: string): View {
  return {
    scene: "location",
    title: turn.session.location,
    text: legacy(text),
    picture: makePicture(picture, currentBackground(turn)),
    hud: hud(turn.player),
    buttons: [continueButton(turn)],
  };
}

function psychCheck(turn: Turn, check: PsychCheck): boolean {
  const psych = turn.player.psych;
  if (psych <= check.minAbove) return false;
  return turn.rng.randomYesNo(psych * check.perLevel + check.base, turn.rules.psychWeight);
}

/**
 * `command_complicated_customer` (:308-459): the customer states the need and
 * the player's psych skill may reveal or change things. Draw order: portrait,
 * then resistance, mood type, double limit, estimate, halve resistance,
 * halve mood (each only at the psych level that unlocks it), then background.
 */
export function arrive(turn: Turn): View {
  const c = turn.session.customer;
  const n = turn.text.negotiation;
  const p = n.psych;
  const checks = turn.rules.psych;
  const rng = turn.rng;
  const portrait = choosePortrait(rng, c);
  const parts: string[] = [];
  const v = vars(turn);

  if (psychCheck(turn, checks.resistance)) {
    c.showResistance = true;
    parts.push(fill(p.resistance, v));
  }
  if (psychCheck(turn, checks.mood)) {
    parts.push(fill(c.loved ? p.heartbroken : p.guilty, v));
  }
  if (psychCheck(turn, checks.doubleLimit)) {
    c.moneyToSpend *= 2;
    parts.push(p.doubled);
  }
  if (psychCheck(turn, checks.estimate)) {
    parts.push(fill(p.estimate, { ...v, limit: intToCash(c.moneyToSpend) }));
  }
  if (psychCheck(turn, checks.halveResistance)) {
    c.cheapness = f32(c.cheapness * 0.5);
    parts.push(p.halvedResistance);
  }
  if (psychCheck(turn, checks.halveMood)) {
    c.mood = f32(c.mood * 0.5);
    parts.push(p.halvedMood);
  }
  const psych = parts.length === 0 ? fill(p.nothing, v) : `\n\n${parts.join(" ")}`;

  c.portrait = portrait;
  c.flow = "negotiation";
  const background = chooseBackground(rng);
  const text =
    fill(n.arrivalRequest, v) +
    fill(n.arrivalNeed, { ...v, casket: casketName(c.desiredCasket) }) +
    psych +
    totalText(turn);
  turn.session.scene = NEGOTIATION;
  const view = negotiationView(turn, text);
  view.picture = makePicture(portrait, background);
  return view;
}

/** `buy_choice` (:467-474): can the customer afford `price` more? */
function canAfford(turn: Turn, extra: number): boolean {
  const c = turn.session.customer;
  return priceOf(c, turn.rules, turn.content) + extra <= c.moneyToSpend;
}

/**
 * `leave_pissed` (:157-221) and `pissed_over_limit` (:224-288): the customer
 * walks out, the TV reports it, and a random rival gets the body and
 * `5 + random(5)` BP by mail.
 */
function walkOut(turn: Turn, prefix: string, lines: readonly string[]): View {
  const c = turn.session.customer;
  const me = turn.player;
  const n = turn.text.negotiation;
  const answer = fill(pick(turn.rng, lines), vars(turn));
  broadcastTv(
    turn,
    fill(n.walkoutTv, {
      income: incomeLabel(c),
      young: cYoung(c),
      man: cMan(c),
      parlor: me.parlor,
    }),
  );
  let other = "";
  if (validPlayerCount(turn.town) > 1) {
    const rivalId = randomPlayerExcluding(turn, me.id);
    const rival = turn.town.players[rivalId];
    if (rival) {
      const v = vars(turn, { rivalParlor: rival.parlor, rivalName: rival.name });
      other = fill(n.rivalWatch, v);
      const points = turn.rules.rivalBp.min + turn.rng.random(turn.rules.rivalBp.range);
      const mail = fill(n.rivalMail, {
        ...v,
        rivalSir: playerSir(rival),
        name: me.name,
        parlor: me.parlor,
        points,
      });
      mailText(turn.town, rivalId, mail);
      mailBackground(turn.town, rivalId, "background/background_2");
      mailPicture(turn.town, rivalId, c.portrait ?? undefined);
      mailReward(turn, rivalId, "bp", points);
      mailContinue(turn, rivalId);
    }
  }
  c.flow = "none";
  return endView(turn, prefix + answer + other, "stuff/money_bag");
}

function leavePissed(turn: Turn, prefix: string): View {
  return walkOut(turn, prefix, turn.text.negotiation.leavePissed);
}

function pissedOverLimit(turn: Turn, prefix: string): View {
  return walkOut(turn, prefix, turn.text.negotiation.pissedOverLimit);
}

function moodUp(c: CustomerState, amount: number): void {
  c.mood = f32(c.mood + amount);
}

/** `command_complicated_soft_sell` (:476-664). */
export function softSell(turn: Turn): View {
  const c = turn.session.customer;
  const n = turn.text.negotiation;
  const rules = turn.rules;
  const rng = turn.rng;
  const items = turn.content.softSell;
  // get_new_option (:461-465): any item, duplicates allowed.
  const option = rng.randomRange(0, items.length - 1);
  const item = items[option];
  if (!item) return negotiationView(turn, totalText(turn));
  const pitch = fill(
    pick(rng, n.softPitch),
    vars(turn, { article: item.article, item: item.name, price: intToCash(item.price) }),
  );

  if (rng.frandom(10) < c.cheapness) {
    moodUp(c, nudge(rng, rules.softRefuseMood));
    if (c.mood >= rules.walkoutMood) return leavePissed(turn, pitch);
    const line = loved(pick(rng, n.softRefuse), c.loved);
    const answer = fill(line, vars(turn, { price: intToCash(item.price) }));
    return negotiationView(turn, pitch + answer + totalText(turn));
  }

  const mood = c.mood;
  let answer: string;
  if (canAfford(turn, item.price)) {
    c.options.push(option);
    const [a, b, d, e] = rules.softAcceptMoods;
    const band = mood < a ? 0 : mood < b ? 1 : mood < d ? 2 : mood < e ? 3 : 4;
    answer = fill(n.softAccept[band] ?? "", vars(turn, { item: item.name }));
  } else {
    // :616-618 passes the empty message, so the pitch is not shown on this walkout.
    if (mood > rules.overLimitLeaveMood) return pissedOverLimit(turn, "");
    moodUp(c, nudge(rng, rules.overLimitMood));
    answer = fill(n.softOverLimit, vars(turn));
  }
  return negotiationView(turn, pitch + answer + totalText(turn));
}

/** `command_complicated_hard_sell` (:667-854): Wood to Silver, Silver to Gold. */
export function hardSell(turn: Turn): View {
  const c = turn.session.customer;
  if (c.desiredCasket >= 2) return upgrade(turn);
  const n = turn.text.negotiation;
  const rules = turn.rules;
  const rng = turn.rng;
  const prices = rules.casketPrices;
  const fromWood = c.desiredCasket === 0;
  const price = fromWood ? prices[1] - prices[0] : prices[2] - prices[1];
  const pitch = fill(
    pick(rng, fromWood ? n.hardPitchWood : n.hardPitchSilver),
    vars(turn, { price: intToCash(price) }),
  );
  const tier = fromWood ? "silver" : "gold";

  if (rng.frandom(10) < c.cheapness || c.cheapness > rules.hardRefuseCheapness) {
    moodUp(c, nudge(rng, rules.hardRefuseMood));
    if (c.mood >= rules.walkoutMood) return leavePissed(turn, pitch);
    const answer = fill(loved(pick(rng, n.hardRefuse), c.loved), vars(turn, { tier }));
    return negotiationView(turn, pitch + answer + totalText(turn));
  }

  const mood = c.mood;
  let answer: string;
  if (canAfford(turn, price)) {
    c.desiredCasket++;
    answer =
      mood < rules.calmAcceptBelow
        ? fill(pick(rng, n.hardAccept), vars(turn))
        : fill(n.hardAcceptAngry, vars(turn, { tier }));
  } else {
    if (mood > rules.overLimitLeaveMood) return pissedOverLimit(turn, pitch);
    moodUp(c, nudge(rng, rules.overLimitMood));
    answer = fill(n.hardOverLimit, vars(turn));
  }
  return negotiationView(turn, pitch + answer + totalText(turn));
}

/** `complicated_upgrade` (:1077-1254): hard-sell upgrades in file order after Gold. */
export function upgrade(turn: Turn): View {
  const c = turn.session.customer;
  const n = turn.text.negotiation;
  const rules = turn.rules;
  const rng = turn.rng;
  const upgrades = turn.content.hardSell;
  const next = c.bigUpgrade + 1;
  const item = upgrades[next];
  if (next > upgrades.length - 1 || !item) {
    return negotiationView(turn, fill(n.upgradeNothingLeft, vars(turn)) + totalText(turn));
  }
  const last = c.bigUpgrade === -1 ? n.upgradeFirstLast : (upgrades[c.bigUpgrade]?.name ?? "");
  const pitch = fill(
    pick(rng, n.upgradePitch),
    vars(turn, { last, upgrade: item.name, price: intToCash(item.price) }),
  );

  if (rng.frandom(10) < c.cheapness || c.cheapness > rules.hardRefuseCheapness) {
    moodUp(c, nudge(rng, rules.upgradeRefuseMood));
    if (c.mood >= rules.walkoutMood) return leavePissed(turn, pitch);
    const answer = fill(
      loved(pick(rng, n.upgradeRefuse), c.loved),
      vars(turn, { rawPrice: item.price }),
    );
    return negotiationView(turn, pitch + answer + totalText(turn));
  }

  const mood = c.mood;
  let answer: string;
  if (canAfford(turn, item.price)) {
    c.bigUpgrade++;
    answer =
      mood < rules.calmAcceptBelow
        ? fill(pick(rng, n.upgradeAccept), vars(turn))
        : fill(n.upgradeAcceptAngry, vars(turn));
  } else {
    // :1212-1215 calls leave_pissed here, not pissed_over_limit.
    if (mood > rules.overLimitLeaveMood) return leavePissed(turn, pitch);
    moodUp(c, nudge(rng, rules.overLimitMood));
    answer = fill(n.upgradeOverLimit, vars(turn));
  }
  return negotiationView(turn, pitch + answer + totalText(turn));
}

function clampCheapness(c: CustomerState): void {
  // fforce_range(&f_cheapness, 0, 10) (shared/std_all.cpp:141-148)
  if (c.cheapness < 0) c.cheapness = 0;
  if (c.cheapness > 10) c.cheapness = 10;
}

/** `command_complicated_guilt` (:860-966): works on customers who did not love the deceased. */
export function guilt(turn: Turn): View {
  const c = turn.session.customer;
  const n = turn.text.negotiation;
  const rules = turn.rules;
  const rng = turn.rng;
  if (c.mood >= rules.walkoutMood) return leavePissed(turn, n.interrupted);
  const pitch = fill(pick(rng, n.guiltPitch), vars(turn));
  moodUp(c, nudge(rng, rules.guiltMood));
  let answer: string;
  if (c.loved) {
    moodUp(c, nudge(rng, rules.guiltLovedMood));
    answer = fill(pick(rng, n.guiltLoved), vars(turn));
  } else {
    c.cheapness = f32(c.cheapness - nudge(rng, rules.guiltCheapness));
    clampCheapness(c);
    answer = fill(pick(rng, n.guiltNotLoved), vars(turn));
  }
  return negotiationView(turn, pitch + answer + totalText(turn));
}

/** `command_complicated_sympathy` (:968-1074): works on customers who loved the deceased. */
export function sympathy(turn: Turn): View {
  const c = turn.session.customer;
  const n = turn.text.negotiation;
  const rules = turn.rules;
  const rng = turn.rng;
  if (c.mood >= rules.walkoutMood) return leavePissed(turn, n.interrupted);
  const pitch = fill(pick(rng, n.sympathyPitch), vars(turn));
  moodUp(c, nudge(rng, rules.sympathyMood));
  let answer: string;
  if (!c.loved) {
    moodUp(c, nudge(rng, rules.sympathyNotLovedMood));
    answer = fill(pick(rng, n.sympathyNotLoved), vars(turn));
  } else {
    c.cheapness = f32(c.cheapness - nudge(rng, rules.sympathyCheapness));
    clampCheapness(c);
    answer = fill(pick(rng, n.sympathyLoved), vars(turn));
  }
  return negotiationView(turn, pitch + answer + totalText(turn));
}

/** BP for a finished sale before bonuses (:40): `int(float(price) * 0.0064f)` in 32-bit floats. */
export function saleBp(price: number, multiplier: number): number {
  return Math.trunc(f32(f32(price) * f32(multiplier)));
}

/**
 * `command_complicated_finish` (:7-130): the sale completes. Pays BP (with
 * the exact-limit and closeness bonuses), a casket tag and a plot. With
 * `crashed` (the player dropped mid-sale, online_util.cpp:123-133) the result
 * is mailed instead of shown.
 */
export function finishSale(turn: Turn, crashed: boolean): View | null {
  const c = turn.session.customer;
  const me = turn.player;
  const n = turn.text.negotiation.done;
  const rules = turn.rules;
  const price = priceOf(c, rules, turn.content);
  let bp = saleBp(price, rules.bpMultiplier);
  let extra = "";
  const closeness = rules.closeness;
  const bonus = turn.settings.tradeBonus;

  if (price === c.moneyToSpend) {
    bp += rules.perfectSaleBonus;
    extra = fill(n.perfect, { cHe: c.customerMale ? "he" : "she", bonus: rules.perfectSaleBonus });
    addToNews(turn.town, fill(turn.text.news.perfectSale, { name: me.name }));
  } else if (numberIsClose(price, c.moneyToSpend, Math.trunc(closeness / 2))) {
    const amount = bonus + rules.closeBonusExtra;
    extra = fill(n.great, { range: Math.trunc(closeness / 2), bonus: amount });
    bp += amount;
  } else if (numberIsClose(price, c.moneyToSpend, closeness)) {
    extra = fill(n.nice, { range: closeness, bonus });
    bp += bonus;
  }

  let text = "";
  if (crashed) {
    turn.log(`${me.name} crashed, but we're giving him ${bp} BP's off a ${incomeLabel(c)} guy`);
    broadcastTv(turn, fill(n.faintedTv, { name: me.name, his: playerHis(me) }));
  } else {
    text = fill(n.success, {
      price: intToCash(price),
      extra,
      bp,
      casket: casketName(c.desiredCasket),
    });
    turn.log(`${me.name} earned ${bp} BP's off a ${incomeLabel(c)} guy`);
  }
  if (bp > rules.bigSaleTv) broadcastTv(turn, fill(n.bigSaleTv, { name: me.name, bp }));

  c.flow = "none";
  expMod(me, bp);
  me.tags[c.desiredCasket] = (me.tags[c.desiredCasket] ?? 0) + 1;
  me.plots++;

  if (crashed) {
    mailText(
      turn.town,
      me.id,
      fill(n.faintedMail, { bp: intToCash(bp), casket: casketName(c.desiredCasket) }),
    );
    mailPicture(turn.town, me.id, "places/hospital_ambulance");
    mailContinue(turn, me.id);
    return null;
  }
  return endView(turn, text, "stuff/money_bag_2");
}

/** The negotiation buttons. Each is valid only while a negotiation is open. */
export const negotiationModule: LocationModule = {
  id: NEGOTIATION,
  press(turn, command) {
    const c = turn.session.customer;
    if (!c.active || c.flow !== "negotiation") {
      throw new Error("No customer is being negotiated with");
    }
    switch (command) {
      case "soft":
        return softSell(turn);
      case "hard":
        return hardSell(turn);
      case "guilt":
        return guilt(turn);
      case "sympathy":
        return sympathy(turn);
      case "done":
        return finishSale(turn, false) as View;
      default:
        throw new Error(`Unknown negotiation command ${command}`);
    }
  },
};
