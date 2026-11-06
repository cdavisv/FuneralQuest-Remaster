import type { Button, SaleOutcome, View } from "@fq/protocol";
import { casketName, cMan, cYoung, incomeLabel } from "../classic/customerText.js";
import { continueButton, currentBackground, makePicture } from "../classic/location.js";
import {
  broadcastTv,
  mailBackground,
  mailContinue,
  mailPicture,
  mailReward,
  mailText,
} from "../classic/mail.js";
import { addToNews } from "../classic/news.js";
import { playerSir, randomPlayerExcluding, validPlayerCount } from "../classic/players.js";
import type { Turn } from "../engine/turn.js";
import { button, hud, legacy } from "../engine/view.js";
import type { CustomerState, PlayerState } from "../state/types.js";
import { fill, intToCash } from "../text/format.js";
import { specialDef, xcust, xvars } from "./customer.js";
import { MODIFIER_KEYS, modValue } from "./modifiers.js";
import { hasUpgrade, refreshRating } from "./parlor.js";
import { applyReward, moneyMod, pick, reviewsMod, roll, xc, xp, xr } from "./players.js";
import { baseSaleBp, closenessBonus, underdogShare, wholesalePrice } from "./scoring.js";
import type { FamilyMemory } from "./state.js";
import { tally } from "./town/arcs.js";
import { chainScore } from "./town/chains.js";
import { chainOf } from "./town/life.js";

/**
 * The end of a negotiation: Done (docs/expanded-rules.md section 3.7), the
 * money of a sale (section 6), walkouts (section 3.4) and the family's
 * memory (section 3.8).
 */

/** Package tier prices bought, by category. */
function packageLines(
  turn: Turn,
  c: CustomerState,
): { label: string; price: number; plotIncome: number }[] {
  const x = xcust(c);
  const out: { label: string; price: number; plotIncome: number }[] = [];
  for (const cat of xc(turn).packages) {
    const index = x.packages[cat.id];
    if (index === undefined || index < 1) continue;
    const tier = cat.tiers[index];
    if (tier) out.push({ label: tier.name, price: tier.price, plotIncome: tier.plotIncome ?? 0 });
  }
  return out;
}

/** The casket (or cremation) line of the bill. */
export function casketLine(turn: Turn, c: CustomerState): { label: string; price: number } {
  const x = xcust(c);
  if (x.track === "cremation") {
    const def = xc(turn).cremation;
    return { label: def.name, price: def.fee };
  }
  return {
    label: `${casketName(c.desiredCasket)} Casket`,
    price: x.casketPrices[c.desiredCasket] ?? 0,
  };
}

/** Section 3.4: the bill, line by line. */
export function billLines(turn: Turn, c: CustomerState): { label: string; price: number }[] {
  const x = xcust(c);
  const items = xc(turn).softSell;
  const lines = [casketLine(turn, c)];
  for (const i of x.bought) {
    const item = items[i];
    if (item) lines.push({ label: item.name, price: item.price });
  }
  for (const p of packageLines(turn, c)) lines.push({ label: p.label, price: p.price });
  if (x.discount > 0) lines.push({ label: "Discount", price: -x.discount });
  return lines;
}

export function billTotal(turn: Turn, c: CustomerState): number {
  return Math.max(
    0,
    billLines(turn, c).reduce((sum, l) => sum + l.price, 0),
  );
}

/** The view after a sale or a walkout: one button (Continue, or Prepare the Body). */
export function endView(turn: Turn, text: string, picture: string, buttons?: Button[]): View {
  return {
    scene: "location",
    title: turn.session.location,
    text: legacy(text),
    picture: makePicture(picture, currentBackground(turn)),
    hud: hud(turn.player),
    buttons: buttons ?? [continueButton(turn)],
  };
}

/** Remembers how a family left (section 3.8). */
function rememberFamily(turn: Turn, surname: string, memory: FamilyMemory): void {
  const x = xp(turn);
  const max = xr(turn).customer.familyMemory;
  const found = x.families.find((f) => f.surname === surname);
  if (found) {
    found.memory = memory;
    found.day = turn.town.day;
    found.visits++;
    x.families = [...x.families.filter((f) => f !== found), found];
  } else {
    x.families.push({ surname, memory, day: turn.town.day, visits: 1 });
  }
  while (x.families.length > max) x.families.shift();
}

/**
 * Section 3.4: the customer walks out. The TV reports it, a random rival
 * gets the body and `5 + random(5)` BP (at once, section 10.2), the family
 * remembers, word of mouth drops. A special that never walks (the mob boss)
 * threatens instead and nobody gets the body.
 */
export function walkOutX(turn: Turn, prefix: string, overLimit: boolean): View {
  const c = turn.session.customer;
  const x = xcust(c);
  const me = turn.player;
  const rules = xr(turn);
  const n = turn.text.negotiation;
  const special = specialDef(turn, c);
  const v = xvars(turn, c);
  const rec = xp(turn).record;
  rec.walkouts++;
  tally(turn.town, "walkouts");
  c.flow = "none";
  if (special?.onWalkout) applyReward(turn, me, special.onWalkout);
  if (special?.noWalkout) {
    const threat = special.lines?.threat ?? xc(turn).text.negotiation.threat;
    refreshRating(turn.rules, me);
    return {
      ...endView(turn, prefix + fill(threat, v), "stuff/battle_lose"),
      saleOutcome: "walkout",
    };
  }
  reviewsMod(me, rules, rules.rating.walkout);
  // Section 3.8: specials are not families (a fixed person such as the Mayor must not come back
  // as an ordinary customer surnamed "Mayor"), as `settleSale` already does for a sale.
  if (!special) rememberFamily(turn, x.surname, "walked");
  refreshRating(turn.rules, me);
  const pool = overLimit ? n.pissedOverLimit : n.leavePissed;
  let text = prefix + fill(pick(turn.rng, pool), v);
  if (special?.lines?.walkout) text += `\n${fill(special.lines.walkout, v)}`;
  broadcastTv(
    turn,
    fill(n.walkoutTv, {
      income: incomeLabel(c),
      young: cYoung(c),
      man: cMan(c),
      parlor: me.parlor,
    }),
  );
  if (validPlayerCount(turn.town) > 1) {
    // Section 23.1: a chain sends the family to a chain-mate instead of a stranger.
    const mates = chainOf(turn.town, me)?.members.filter(
      (id) => id !== me.id && turn.town.players[id]?.active,
    );
    const rivalId =
      mates && mates.length > 0
        ? (mates[turn.rng.random(mates.length)] as number)
        : randomPlayerExcluding(turn, me.id);
    const rival = turn.town.players[rivalId];
    if (rival) {
      const rv = { ...v, rivalParlor: rival.parlor, rivalName: rival.name };
      text += fill(n.rivalWatch, rv);
      const points = turn.rules.rivalBp.min + turn.rng.random(turn.rules.rivalBp.range);
      mailText(
        turn.town,
        rivalId,
        fill(n.rivalMail, {
          ...rv,
          rivalSir: playerSir(rival),
          name: me.name,
          parlor: me.parlor,
          points,
        }),
      );
      mailBackground(turn.town, rivalId, "background/background_2");
      mailPicture(turn.town, rivalId, c.portrait ?? undefined);
      mailReward(turn, rivalId, "bp", points);
      mailContinue(turn, rivalId);
    }
  }
  return { ...endView(turn, text, "stuff/money_bag"), saleOutcome: "walkout" };
}

/** Section 11.5: a settled sale's closeness band as the view's `saleOutcome`. */
export function saleOutcomeOf(bonusKey: string | null): SaleOutcome {
  return bonusKey === "exact" || bonusKey === "great" || bonusKey === "nice" ? bonusKey : "plain";
}

/** Section 9.4: the BP leader's total, for the underdog bonus. */
function leaderBp(turn: Turn): number {
  let best = 0;
  for (const p of turn.town.players) if (p.active && p.bp > best) best = p.bp;
  return best;
}

export interface SaleResult {
  bill: number;
  base: number;
  bonus: number;
  bonusKey: string | null;
  underdog: number;
  tax: number;
  bp: number;
  money: number;
  happy: boolean;
  sour: boolean;
}

/**
 * Section 3.7 and section 6: settles a finished sale. Returns the result and
 * the text of the summary (legacy markup).
 */
export function settleSale(turn: Turn): { result: SaleResult; text: string } {
  const c = turn.session.customer;
  const x = xcust(c);
  const me = turn.player;
  const rules = xr(turn);
  const t = xc(turn).text.done;
  const xpl = xp(turn);
  const special = specialDef(turn, c);
  const v = xvars(turn, c);
  const bill = billTotal(turn, c);
  const base = Math.trunc(
    modValue(turn.town, MODIFIER_KEYS.saleBp, baseSaleBp(bill, rules.scoring.bpMultiplier)),
  );
  const close = closenessBonus(rules, bill, c.moneyToSpend, base);
  let extra = "";
  if (close.key === "exact") {
    extra += fill(t.perfect, { ...v, bonus: close.bonus });
    addToNews(turn.town, fill(turn.text.news.perfectSale, { name: me.name }));
    xpl.record.exact++;
  } else if (close.key === "great") {
    extra += fill(t.great, { ...v, bonus: close.bonus, percent: close.percent });
    xpl.record.great++;
  } else if (close.key === "nice") {
    extra += fill(t.nice, { ...v, bonus: close.bonus, percent: close.percent });
    xpl.record.nice++;
  } else if (!x.practice || bill < c.moneyToSpend) {
    const nice = Math.round(
      (rules.scoring.tiers[rules.scoring.tiers.length - 1]?.within ?? 0) * 100,
    );
    const left = Math.max(0, c.moneyToSpend - bill);
    extra += fill(t.missed, { left: intToCash(Math.round(left / 100) * 100), nice });
  }
  // Section 9.4: a parlor that opened after the season's first day catches up faster.
  const late = me.dayCreated > 1 && turn.town.settings.tournamentActive;
  const share = underdogShare(rules, me.bp, leaderBp(turn), late);
  const underdog = Math.ceil(base * share);
  if (underdog > 0) extra += fill(t.underdog, { bonus: underdog });
  const tax = xpl.rivalry === "peaceful" ? Math.floor(base * rules.pvp.peacefulTax) : 0;
  if (tax > 0) extra += fill(t.insurance, { tax });
  const bp = Math.max(0, base + close.bonus + underdog - tax);

  // Money (section 6.1): the service cut of the non-casket bill, plus the casket margin.
  const casket = casketLine(turn, c);
  let money = Math.round(rules.money.serviceCut * Math.max(0, bill - casket.price));
  let casketNote = "";
  if (x.track === "cremation") {
    money += casket.price - wholesalePrice(rules, casket.price);
  } else {
    const tier = c.desiredCasket as 0 | 1 | 2;
    const tierName = (["wood", "silver", "gold"][tier] ?? "wood") as string;
    if ((xpl.stock[tier] ?? 0) > 0) {
      xpl.stock[tier]--;
      money += casket.price;
      casketNote = fill(t.fromStock, { tier: tierName });
    } else {
      const cost = Math.round(
        wholesalePrice(rules, turn.rules.casketPrices[tier] ?? 0) *
          (special?.casketPriceMult ?? 1) *
          rules.money.rushMult,
      );
      money += casket.price - cost;
      casketNote = fill(t.rushOrder, { tier: tierName, cost: intToCash(cost) });
    }
  }
  money = moneyMod(me, Math.max(0, money));

  me.bpToday += bp;
  me.bp += bp;
  me.tags[c.desiredCasket] = (me.tags[c.desiredCasket] ?? 0) + 1;
  const pet = x.pet !== "";
  if (x.track === "burial" && !pet) me.plots++;
  if (x.track === "cremation") xpl.record.cremations++;
  for (const p of packageLines(turn, c)) xpl.plotIncome += p.plotIncome;

  const happy = c.mood < rules.scoring.happyBelow;
  const sour = c.mood >= rules.scoring.sourAt;
  let mood = "";
  if (happy) {
    reviewsMod(me, rules, rules.rating.happy);
    mood = t.happy;
    if (special?.onHappy) applyReward(turn, me, special.onHappy);
    if (special?.lines?.happy) mood += `\n${fill(special.lines.happy, v)}`;
  } else if (sour) {
    reviewsMod(me, rules, rules.rating.sour);
    mood = t.sour;
  }
  if (special?.onDone) applyReward(turn, me, special.onDone);
  if (!special) rememberFamily(turn, x.surname, happy ? "happy" : sour ? "sour" : "ok");
  if (special?.future) {
    const f = special.future;
    const days = turn.rng.randomRange(f.minDays, f.maxDays);
    xpl.futures.push({
      day: turn.town.day + days,
      bp: Math.ceil(base * f.bpShare),
      money: Math.round(money * f.bpShare),
      text: fill(f.text, { name: `${x.first} ${x.surname}`, he: c.customerMale ? "he" : "she" }),
    });
    mood += fill(t.future, { days });
  }

  xpl.record.sales++;
  xpl.record.saleBp += bp;
  tally(turn.town, "sales");
  chainScore(turn.town, me, bp);
  xpl.record.bonusBp += close.bonus;
  xpl.record.saleMoney += money;
  refreshRating(turn.rules, me);

  if (bp > turn.rules.bigSaleTv) {
    broadcastTv(turn, fill(turn.text.negotiation.done.bigSaleTv, { name: me.name, bp }));
  } else if (special?.tvAlways) {
    broadcastTv(turn, fill(t.specialTv, { name: me.name, special: special.label }));
  }

  const sold = x.track === "cremation" ? t.cremated : casketName(c.desiredCasket);
  const text =
    fill(t.success, { price: intToCash(bill), extra, bp, casket: sold }) +
    `\n\n${fill(t.money, { money: intToCash(money) })}${casketNote}${mood}`;
  c.flow = "none";
  return {
    result: {
      bill,
      base,
      bonus: close.bonus,
      bonusKey: close.key,
      underdog,
      tax,
      bp,
      money,
      happy,
      sour,
    },
    text,
  };
}

/** Section 8.2: whether a body-preparation choice follows, and which. */
export function choosePrep(turn: Turn): number {
  const c = turn.session.customer;
  const x = xcust(c);
  const rules = xr(turn);
  const me = turn.player;
  const chance = modValue(turn.town, MODIFIER_KEYS.prepChance, rules.karma.prepChance);
  if (!x.practice && roll(turn.rng) >= chance) return -1;
  const list = xc(turn).prep;
  const fits = list
    .map((e, i) => ({ e, i }))
    .filter(
      ({ e }) =>
        (e.track === undefined || e.track === x.track) &&
        (e.karmaBelow === undefined || me.karma < e.karmaBelow) &&
        (e.karmaAbove === undefined || me.karma > e.karmaAbove),
    );
  if (fits.length === 0) return -1;
  if (x.practice) return fits[0]?.i ?? -1;
  const total = fits.reduce((s, f) => s + (f.e.weight ?? 1), 0);
  let r = roll(turn.rng) * total;
  for (const f of fits) {
    r -= f.e.weight ?? 1;
    if (r < 0) return f.i;
  }
  return fits[fits.length - 1]?.i ?? -1;
}

/** Whether `player` can afford a money cost now (choices that cost money are disabled otherwise). */
export function canPay(player: PlayerState, cost: number): boolean {
  return cost <= 0 || player.money >= cost;
}

/** The success screen after Done, with Prepare the Body when a choice follows. */
export function finishView(turn: Turn, text: string, prep: number): View {
  const t = xc(turn).text.done;
  const c = turn.session.customer;
  const x = xcust(c);
  if (prep >= 0) {
    const session = turn.session;
    session.expanded = {
      prep: {
        event: prep,
        surname: x.surname,
        deceased: x.deceasedFirst,
        deceasedMale: c.deceasedMale,
      },
    };
    return endView(turn, text, "stuff/money_bag_2", [button("prep:start", t.prepButton)]);
  }
  return endView(turn, text, "stuff/money_bag_2");
}

export function hasIncinerator(player: PlayerState): boolean {
  return hasUpgrade(player, "incinerator");
}
