import type { Button, CustomerPanel, View } from "@fq/protocol";
import { chooseBackground, customerMood, incomeLabel } from "../classic/customerText.js";
import { makePicture } from "../classic/location.js";
import { mailContinue, mailPicture, mailText } from "../classic/mail.js";
import type { LovedLine } from "../content/classicText.js";
import type { LocationModule } from "../engine/registry.js";
import type { Turn } from "../engine/turn.js";
import { button, hud, legacy } from "../engine/view.js";
import type { CustomerState } from "../state/types.js";
import { fill, intToCash, type TemplateVars } from "../text/format.js";
import { agedPool } from "./ages.js";
import type { ExpandedSaleItem, PackageCategory } from "./content/types.js";
import {
  affinityOf,
  arrivalNotes,
  chooseExpandedPortrait,
  effectsOf,
  listenCount,
  multOf,
  specialDef,
  sumOf,
  tellLine,
  traitDefs,
  xcust,
  xvars,
} from "./customer.js";
import { tutorialHintPanel } from "./panels.js";
import { hasPerk, hasUpgrade } from "./parlor.js";
import {
  applyReward,
  clamp,
  karmaMod,
  nudge,
  pick,
  reviewsMod,
  rewardSummary,
  xc,
  xp,
  xr,
} from "./players.js";
import {
  billLines,
  billTotal,
  choosePrep,
  endView,
  finishView,
  saleOutcomeOf,
  settleSale,
  walkOutX,
} from "./sale.js";
import { narrowEstimate, roundDown } from "./scoring.js";
import type { ExpandedCustomer } from "./state.js";

/**
 * The Expanded negotiation (docs/expanded-rules.md section 3.4). Registered
 * under the Classic id "neg", so button ids stay `neg:*`. The five Classic
 * buttons keep their row; the new actions are the "more" row; Soft Sell and
 * Packages open a row of cards ("hand").
 */
export const XNEG = "neg";

function loved(line: LovedLine, isLoved: boolean): string {
  if (typeof line === "string") return line;
  return isLoved ? line.loved : line.notLoved;
}

function vars(turn: Turn, extra: TemplateVars = {}): TemplateVars {
  return xvars(turn, turn.session.customer, extra);
}

function customer(turn: Turn): { c: CustomerState; x: ExpandedCustomer } {
  const c = turn.session.customer;
  return { c, x: xcust(c) };
}

/** Mood up, scaled by the customer's temper (section 3.3). Decreases are not scaled. */
function moodUp(turn: Turn, c: CustomerState, amount: number): void {
  const mult = amount > 0 ? multOf(effectsOf(turn, c), "moodMult") : 1;
  c.mood = Math.max(0, c.mood + amount * mult);
}

function effectiveCheapness(
  turn: Turn,
  c: CustomerState,
  tags: readonly string[],
  hard = 0,
): number {
  return clamp(c.cheapness + affinityOf(effectsOf(turn, c), tags) + hard, 0, 10);
}

/**
 * Section 3.4: an action uses patience. With none left, the customer gets
 * angrier instead. Returns a line to show, or "".
 */
function usePatience(turn: Turn, c: CustomerState, cost: number): string {
  const x = xcust(c);
  x.actions++;
  if (cost <= 0) return "";
  if (x.patience <= 0) {
    moodUp(turn, c, nudge(turn.rng, xr(turn).actions.impatience));
    return `${fill(pick(turn.rng, agedPool(turn, c, "impatient", xc(turn).text.negotiation.impatient)), vars(turn))}\n\n`;
  }
  x.patience = Math.max(0, x.patience - cost);
  return "";
}

function walks(turn: Turn, c: CustomerState): boolean {
  return c.mood >= turn.rules.walkoutMood;
}

/** Packages a category could still sell: the next tier, if any. */
function nextTier(c: CustomerState, cat: PackageCategory): number {
  const x = xcust(c);
  const now = x.packages[cat.id] ?? 0;
  return now + 1 < cat.tiers.length ? now + 1 : -1;
}

function categoryFits(c: CustomerState, cat: PackageCategory): boolean {
  const x = xcust(c);
  if (cat.track !== "any" && cat.track !== x.track) return false;
  if (cat.noPet && x.pet !== "") return false;
  return true;
}

function openCategories(turn: Turn, c: CustomerState): PackageCategory[] {
  return xc(turn).packages.filter((cat) => categoryFits(c, cat) && nextTier(c, cat) >= 0);
}

/** Section 4: soft-sell items that may still be drawn. */
function drawable(turn: Turn, c: CustomerState): number[] {
  const x = xcust(c);
  const items = xc(turn).softSell;
  const out: number[] = [];
  items.forEach((item: ExpandedSaleItem, i) => {
    if (item.track && item.track !== x.track) return;
    if (x.hand.includes(i) || x.bought.includes(i) || x.refused.includes(i)) return;
    out.push(i);
  });
  return out;
}

/** Section 4: the hand size by luck. */
export function handSize(turn: Turn): number {
  const h = xr(turn).hand;
  const luck = turn.player.luck;
  if (luck >= h.luckyAt) return h.luckySize;
  if (luck <= h.unluckyAt) return h.unluckySize;
  return h.size;
}

/** Fills the hand to its size with items not already in it, bought or refused. */
function fillHand(turn: Turn, c: CustomerState): void {
  const x = xcust(c);
  const size = handSize(turn);
  while (x.hand.length < size) {
    const pool = drawable(turn, c);
    if (pool.length === 0) break;
    x.hand.push(pool[turn.rng.random(pool.length)] as number);
  }
}

function discountAmount(turn: Turn, c: CustomerState): number {
  const step = xr(turn).customer.limitStep;
  return Math.max(step, roundDown(billTotal(turn, c) * xr(turn).actions.discount.share, step));
}

function canListen(c: CustomerState): boolean {
  const x = xcust(c);
  return x.visibleTraits < x.traits.length || !x.told.loved || !x.told.cheap || !x.told.limit;
}

function deceasedLabel(turn: Turn, c: CustomerState): string {
  const x = xcust(c);
  const v = vars(turn);
  if (x.pet !== "") return `${x.deceasedFirst} the ${x.pet}`;
  if (specialDef(turn, c)?.selfFuneral) return `${v.cHim}self (planning ahead)`;
  return `${v.cHis} ${v.dRelation} ${x.deceasedFirst}`;
}

function panel(turn: Turn, c: CustomerState): CustomerPanel {
  const x = xcust(c);
  const out: CustomerPanel = {
    incomeLabel: incomeLabel(c),
    moodLabel: customerMood(c),
    moodLevel: Math.round(c.mood * 10) / 10,
    total: billTotal(turn, c),
    name: `${x.first} ${x.surname}`,
    deceased: deceasedLabel(turn, c),
    traits: traitDefs(turn, c)
      .slice(0, x.visibleTraits)
      .map((t) => ({ id: t.id, label: t.label, hint: t.hint })),
    estimate: { ...x.estimate },
    patience: { left: x.patience, max: x.patienceMax },
    notes: x.notes.map((n) => legacy(fill(n, vars(turn)))),
    bill: billLines(turn, c),
    track: x.track,
  };
  if (c.showResistance) out.resistancePercent = Math.round(c.cheapness * 10);
  const special = specialDef(turn, c);
  if (special) out.special = special.label;
  // Section 11.5: a flat offer is not a haggle (no gauge); otherwise the bonus bands as numbers.
  if (special?.offer) out.haggle = false;
  else
    out.bands = [
      { key: "exact", within: 0 },
      ...xr(turn).scoring.tiers.map((t) => ({ key: t.key, within: t.within })),
    ];
  return out;
}

function disabled(b: Button, hint: string): Button {
  return { ...b, enabled: false, hint };
}

/** Section 3.4: the main row and the "more" row. */
function mainButtons(turn: Turn, c: CustomerState): Button[] {
  const x = xcust(c);
  const b = turn.text.negotiation.buttons;
  const xb = xc(turn).text.negotiation.buttons;
  const hints = xc(turn).text.negotiation.hints;
  const rules = xr(turn);
  const p = turn.player;
  let hard = button(`${XNEG}:hard`, b.hard);
  if (x.track === "cremation") hard = disabled(hard, hints.cremationTrack);
  else if (c.desiredCasket >= 2) hard = disabled(hard, hints.hardMaxed);
  let soft = button(`${XNEG}:soft`, b.soft);
  if (x.hand.length === 0 && drawable(turn, c).length === 0) soft = disabled(soft, hints.handEmpty);
  const more = (id: string, label: string): Button => ({
    ...button(`${XNEG}:${id}`, label),
    group: "more",
  });
  let packages = more("packages", xb.packages);
  if (openCategories(turn, c).length === 0) packages = disabled(packages, hints.noPackages);
  let coffee = more("coffee", xb.coffee);
  if (x.coffee) coffee = disabled(coffee, hints.coffeeUsed);
  let listen = more("listen", xb.listen);
  if (!canListen(c)) listen = disabled(listen, hints.nothingToLearn);
  let discount = more("discount", xb.discount);
  discount.detail = `-$${intToCash(discountAmount(turn, c))}`;
  if (x.discounts >= rules.actions.discount.max) discount = disabled(discount, hints.discountMax);
  else if (billTotal(turn, c) - discountAmount(turn, c) < rules.customer.limitStep) {
    discount = disabled(discount, hints.discountTooSmall);
  }
  const buttons: Button[] = [
    button(`${XNEG}:guilt`, b.guilt),
    button(`${XNEG}:sympathy`, b.sympathy),
    hard,
    soft,
    button(`${XNEG}:done`, b.done),
    packages,
    coffee,
    listen,
    discount,
  ];
  if (hasUpgrade(p, "incinerator") && x.track === "burial" && !x.cremationAsked) {
    buttons.push(more("cremation", xb.cremation));
  }
  // Section 17.3: holy water from the church lets anyone bless (one bottle per blessing).
  const water = p.expanded?.life?.holyWater ?? 0;
  if (hasPerk(rules, p, "church-associate") || water > 0) {
    const bless = more("bless", xb.bless);
    buttons.push(x.blessed ? disabled(bless, hints.blessUsed) : bless);
  }
  if (hasPerk(rules, p, "necromancer")) {
    const raise = more("raise", xb.raise);
    buttons.push(x.raised ? disabled(raise, hints.raiseUsed) : raise);
  }
  return buttons;
}

function handButtons(turn: Turn, c: CustomerState): Button[] {
  const x = xcust(c);
  const items = xc(turn).softSell;
  const out: Button[] = x.hand.map((index, slot) => {
    const item = items[index];
    return {
      ...button(`${XNEG}:hand:${slot}`, item?.name ?? "?"),
      group: "hand",
      detail: `$${intToCash(item?.price ?? 0)}`,
    };
  });
  out.push(button(`${XNEG}:back`, xc(turn).text.negotiation.buttons.back));
  return out;
}

function packageButtons(turn: Turn, c: CustomerState): Button[] {
  const hints = xc(turn).text.negotiation.hints;
  const out: Button[] = openCategories(turn, c).map((cat) => {
    const tier = cat.tiers[nextTier(c, cat)];
    const b: Button = {
      ...button(`${XNEG}:pkg:${cat.id}`, `${cat.label}: ${tier?.name ?? ""}`),
      group: "hand",
      detail: `+$${intToCash(tier?.price ?? 0)}`,
    };
    if (tier?.requires && !hasUpgrade(turn.player, tier.requires))
      return disabled(b, hints.needsUpgrade);
    return b;
  });
  out.push(button(`${XNEG}:back`, xc(turn).text.negotiation.buttons.back));
  return out;
}

function tutorialHint(
  turn: Turn,
  c: CustomerState,
  key: keyof ReturnType<typeof hintsOf>,
): string | undefined {
  const x = xcust(c);
  if (!x.practice) return undefined;
  const hints = hintsOf(turn);
  if (x.patience <= 0) return hints.impatient;
  return hints[key];
}

function hintsOf(turn: Turn) {
  return xc(turn).text.tutorial.hints;
}

/** The negotiation screen. */
function negView(
  turn: Turn,
  text: string,
  hintKey: "arrival" | "hand" | "packages" | "afterPitch" = "afterPitch",
): View {
  const { c, x } = customer(turn);
  const t = xc(turn).text.negotiation;
  const rules = xr(turn);
  const tiers = rules.scoring.tiers;
  const total = fill(t.total, { price: intToCash(billTotal(turn, c)) });
  const intro =
    x.pane === "hand"
      ? `\n\n${t.handIntro}`
      : x.pane === "packages"
        ? `\n\n${t.packagesIntro}`
        : "";
  const view: View = {
    scene: "location",
    title: turn.session.location,
    text: legacy(text + total + intro),
    picture: turn.session.view?.picture ?? {},
    hud: hud(turn.player),
    customer: panel(turn, c),
    status: legacy(
      fill(t.bonusRule, {
        ...vars(turn),
        nice: Math.round((tiers[tiers.length - 1]?.within ?? 0) * 100),
        great: Math.round((tiers[0]?.within ?? 0) * 100),
      }),
    ),
    buttons:
      x.pane === "hand"
        ? handButtons(turn, c)
        : x.pane === "packages"
          ? packageButtons(turn, c)
          : mainButtons(turn, c),
  };
  const key = x.pane === "hand" ? "hand" : x.pane === "packages" ? "packages" : hintKey;
  const hint = tutorialHint(turn, c, key);
  if (hint) {
    view.note = legacy(hint);
    view.tutorial = tutorialHintPanel(xc(turn), hint);
  }
  return view;
}

/**
 * Section 3.2: the customer arrives. The negotiation starts with the
 * request, a tell, trait lines and what psych finds; the panel shows the
 * estimate. A special with an `offer` shows its two buttons instead.
 */
export function arriveX(turn: Turn): View {
  const { c, x } = customer(turn);
  const content = xc(turn);
  const t = content.text.negotiation;
  const rng = turn.rng;
  const special = specialDef(turn, c);
  const portrait = special?.portrait ?? chooseExpandedPortrait(rng, c);
  c.portrait = portrait;
  c.flow = "negotiation";
  turn.session.scene = XNEG;
  const background = chooseBackground(rng);
  const v = vars(turn);
  const casket = ["wood", "silver", "gold"][c.desiredCasket] ?? "wood";
  const parts: string[] = [];
  if (special) {
    parts.push(fill(special.intro, { ...v, casket }));
  } else {
    const pool = x.repeat ? agedPool(turn, c, `repeat.${x.repeat}`, t.repeat[x.repeat]) : null;
    if (pool && pool.length > 0) parts.push(fill(pick(rng, pool), v));
    parts.push(fill(pick(rng, agedPool(turn, c, "request", t.request)), { ...v, casket }));
  }
  if (special?.offer) {
    x.notes.push(fill(special.intro, { ...v, casket }));
    const view = endView(turn, parts.join("\n\n"), portrait, [
      button(`${XNEG}:offer:accept`, special.offer.accept.label),
      button(`${XNEG}:offer:decline`, special.offer.decline.label),
    ]);
    view.picture = makePicture(portrait, background);
    view.customer = panel(turn, c);
    return view;
  }
  if (x.pet !== "" && !special?.intro)
    parts.push(fill(pick(rng, agedPool(turn, c, "petRequest", t.petRequest)), { ...v, casket }));
  const notes = arrivalNotes(turn, c);
  parts.push(...notes.text);
  const estimate = fill(t.estimate, {
    ...v,
    low: intToCash(x.estimate.low),
    high: intToCash(x.estimate.high),
  });
  const psych = [estimate, ...notes.psych];
  const text = `${parts.join("\n\n")}\n\n${psych.join(" ")}`;
  const view = negView(turn, text, "arrival");
  view.picture = makePicture(portrait, background);
  return view;
}

function canAfford(turn: Turn, c: CustomerState, extra: number): boolean {
  return billTotal(turn, c) + extra <= c.moneyToSpend;
}

/** Section 3.4, Guilt: as Classic, scaled by traits; on a loved customer it costs karma. */
function guilt(turn: Turn): View {
  const { c } = customer(turn);
  const n = turn.text.negotiation;
  const t = xc(turn).text.negotiation;
  const rules = turn.rules;
  const rng = turn.rng;
  if (walks(turn, c)) return walkOutX(turn, n.interrupted, false);
  const prefix = usePatience(turn, c, 1);
  const pitch = fill(
    pick(rng, agedPool(turn, c, "guiltPitch", [...n.guiltPitch, ...t.guiltPitch])),
    vars(turn),
  );
  const mult = multOf(effectsOf(turn, c), "guilt");
  moodUp(turn, c, nudge(rng, rules.guiltMood));
  let answer: string;
  if (c.loved) {
    moodUp(turn, c, nudge(rng, rules.guiltLovedMood) * Math.max(1, mult));
    karmaMod(turn.player, xr(turn).karma.guiltOnLoved);
    answer = fill(pick(rng, n.guiltLoved), vars(turn));
  } else {
    c.cheapness = clamp(c.cheapness - nudge(rng, rules.guiltCheapness) * mult, 0, 10);
    answer = fill(pick(rng, n.guiltNotLoved), vars(turn));
  }
  if (walks(turn, c)) return walkOutX(turn, `${prefix}${pitch}${answer}\n\n`, false);
  return negView(turn, prefix + pitch + answer);
}

/** Section 3.4, Sympathy. */
function sympathy(turn: Turn): View {
  const { c } = customer(turn);
  const n = turn.text.negotiation;
  const t = xc(turn).text.negotiation;
  const rules = turn.rules;
  const rng = turn.rng;
  if (walks(turn, c)) return walkOutX(turn, n.interrupted, false);
  const prefix = usePatience(turn, c, 1);
  const pitch = fill(
    pick(rng, agedPool(turn, c, "sympathyPitch", [...n.sympathyPitch, ...t.sympathyPitch])),
    vars(turn),
  );
  const mult = multOf(effectsOf(turn, c), "sympathy");
  moodUp(turn, c, nudge(rng, rules.sympathyMood));
  let answer: string;
  if (!c.loved) {
    moodUp(turn, c, nudge(rng, rules.sympathyNotLovedMood));
    answer = fill(pick(rng, n.sympathyNotLoved), vars(turn));
  } else {
    c.cheapness = clamp(c.cheapness - nudge(rng, rules.sympathyCheapness) * mult, 0, 10);
    answer = fill(pick(rng, n.sympathyLoved), vars(turn));
  }
  if (walks(turn, c)) return walkOutX(turn, `${prefix}${pitch}${answer}\n\n`, false);
  return negView(turn, prefix + pitch + answer);
}

/** Section 3.4, Hard Sell: the casket ladder, harder at a high markup. */
function hardSell(turn: Turn): View {
  const { c, x } = customer(turn);
  if (x.track === "cremation" || c.desiredCasket >= 2) throw new Error("Nothing to hard sell");
  const n = turn.text.negotiation;
  const t = xc(turn).text.negotiation;
  const rules = turn.rules;
  const xrules = xr(turn);
  const rng = turn.rng;
  const prefix = usePatience(turn, c, 1);
  const fromWood = c.desiredCasket === 0;
  const price = (x.casketPrices[c.desiredCasket + 1] ?? 0) - (x.casketPrices[c.desiredCasket] ?? 0);
  const pool = fromWood
    ? agedPool(turn, c, "hardPitchWood", [...n.hardPitchWood, ...t.hardPitchWood])
    : agedPool(turn, c, "hardPitchSilver", [...n.hardPitchSilver, ...t.hardPitchSilver]);
  const pitch = fill(pick(rng, pool), vars(turn, { price: intToCash(price) }));
  const tier = fromWood ? "silver" : "gold";
  const markupCheap = Math.max(0, x.markup / 10) * xrules.markup.cheapnessPer10;
  const cheap = effectiveCheapness(
    turn,
    c,
    [],
    sumOf(effectsOf(turn, c), "hardSell") + markupCheap,
  );
  if (rng.frandom(10) < cheap || cheap > rules.hardRefuseCheapness) {
    moodUp(turn, c, nudge(rng, rules.hardRefuseMood));
    if (walks(turn, c)) return walkOutX(turn, prefix + pitch, false);
    const answer = fill(loved(pick(rng, n.hardRefuse), c.loved), vars(turn, { tier }));
    return negView(turn, prefix + pitch + answer);
  }
  let answer: string;
  if (canAfford(turn, c, price)) {
    const mood = c.mood;
    c.desiredCasket++;
    answer =
      mood < rules.calmAcceptBelow
        ? fill(pick(rng, n.hardAccept), vars(turn))
        : fill(n.hardAcceptAngry, vars(turn, { tier }));
  } else {
    if (c.mood > rules.overLimitLeaveMood) return walkOutX(turn, prefix + pitch, true);
    moodUp(turn, c, nudge(rng, rules.overLimitMood));
    answer = fill(n.hardOverLimit, vars(turn));
  }
  return negView(turn, prefix + pitch + answer);
}

/** Section 4: Soft Sell shows the hand; nothing is spent until a card is pitched. */
function showHand(turn: Turn): View {
  const { c, x } = customer(turn);
  fillHand(turn, c);
  if (x.hand.length === 0) throw new Error("Nothing left to offer");
  x.pane = "hand";
  return negView(turn, "");
}

/** Section 4: pitch card `slot` of the hand. */
function pitchCard(turn: Turn, slot: number): View {
  const { c, x } = customer(turn);
  const index = x.hand[slot];
  const item = index === undefined ? undefined : xc(turn).softSell[index];
  if (index === undefined || !item) throw new Error(`No card ${slot}`);
  const n = turn.text.negotiation;
  const t = xc(turn).text.negotiation;
  const rules = turn.rules;
  const rng = turn.rng;
  x.hand.splice(slot, 1);
  x.pane = "main";
  const prefix = usePatience(turn, c, 1);
  const pitch = fill(
    pick(rng, agedPool(turn, c, "softPitch", [...n.softPitch, ...t.softPitch])),
    vars(turn, { article: item.article, item: item.name, price: intToCash(item.price) }),
  );
  const cheap = effectiveCheapness(turn, c, item.tags);
  if (rng.frandom(10) < cheap) {
    x.refused.push(index);
    moodUp(turn, c, nudge(rng, rules.softRefuseMood));
    fillHand(turn, c);
    if (walks(turn, c)) return walkOutX(turn, prefix + pitch, false);
    const answer = fill(
      loved(pick(rng, n.softRefuse), c.loved),
      vars(turn, { price: intToCash(item.price) }),
    );
    return negView(turn, prefix + pitch + answer);
  }
  const mood = c.mood;
  let answer: string;
  if (canAfford(turn, c, item.price)) {
    x.bought.push(index);
    const [a, b, d, e] = rules.softAcceptMoods;
    const band = mood < a ? 0 : mood < b ? 1 : mood < d ? 2 : mood < e ? 3 : 4;
    answer = fill(n.softAccept[band] ?? "", vars(turn, { item: item.name }));
  } else {
    x.refused.push(index);
    if (mood > rules.overLimitLeaveMood) return walkOutX(turn, prefix, true);
    moodUp(turn, c, nudge(rng, rules.overLimitMood));
    answer = fill(n.softOverLimit, vars(turn));
  }
  fillHand(turn, c);
  return negView(turn, prefix + pitch + answer);
}

/** Section 5.1: the packages pane. */
function showPackages(turn: Turn): View {
  const { c, x } = customer(turn);
  if (openCategories(turn, c).length === 0) throw new Error("No packages");
  x.pane = "packages";
  return negView(turn, "");
}

/** Section 5.1: pitch the next tier of a category. */
function pitchPackage(turn: Turn, id: string): View {
  const { c, x } = customer(turn);
  const cat = xc(turn).packages.find((p) => p.id === id);
  if (!cat || !categoryFits(c, cat)) throw new Error(`No package ${id}`);
  const next = nextTier(c, cat);
  const tier = cat.tiers[next];
  if (next < 0 || !tier) throw new Error(`Nothing left in ${id}`);
  if (tier.requires && !hasUpgrade(turn.player, tier.requires)) throw new Error("Needs an upgrade");
  const last = cat.tiers[x.packages[cat.id] ?? 0]?.name ?? "";
  const t = xc(turn).text.negotiation;
  const n = turn.text.negotiation;
  const rules = turn.rules;
  const rng = turn.rng;
  x.pane = "main";
  const prefix = usePatience(turn, c, 1);
  const v = vars(turn, {
    upgrade: tier.name,
    article: tier.article,
    price: intToCash(tier.price),
    last,
  });
  const pitch = fill(
    pick(rng, agedPool(turn, c, "packagePitch", [...cat.pitch, ...t.packagePitch])),
    v,
  );
  const cheap = effectiveCheapness(turn, c, tier.tags);
  if (rng.frandom(10) < cheap || cheap > rules.hardRefuseCheapness) {
    moodUp(turn, c, nudge(rng, rules.upgradeRefuseMood));
    if (walks(turn, c)) return walkOutX(turn, prefix + pitch, false);
    const pool = agedPool(turn, c, "packageRefuse", [
      ...t.packageRefuse,
      ...n.upgradeRefuse.map((l) => loved(l, c.loved)),
    ]);
    return negView(turn, prefix + pitch + fill(pick(rng, pool), { ...v, rawPrice: tier.price }));
  }
  let answer: string;
  if (canAfford(turn, c, tier.price - (cat.tiers[x.packages[cat.id] ?? 0]?.price ?? 0))) {
    x.packages[cat.id] = next;
    answer = fill(
      pick(rng, agedPool(turn, c, "packageAccept", [...t.packageAccept, ...n.upgradeAccept])),
      v,
    );
  } else {
    if (c.mood > rules.overLimitLeaveMood) return walkOutX(turn, prefix + pitch, true);
    moodUp(turn, c, nudge(rng, rules.overLimitMood));
    answer = fill(t.packageOverLimit, v);
  }
  return negView(turn, prefix + pitch + answer);
}

/** Section 3.4, Offer Coffee: once per customer; calms and buys a little patience. */
function coffee(turn: Turn): View {
  const { c, x } = customer(turn);
  if (x.coffee) throw new Error("Already had coffee");
  const t = xc(turn).text.negotiation;
  const a = xr(turn).actions.coffee;
  const rng = turn.rng;
  x.coffee = true;
  x.actions++;
  const pitch = fill(pick(rng, agedPool(turn, c, "coffeePitch", t.coffeePitch)), vars(turn));
  let mult = multOf(effectsOf(turn, c), "coffee");
  if (mult === 0) {
    const prefix = usePatience(turn, c, 1);
    return negView(
      turn,
      prefix +
        pitch +
        fill(pick(rng, agedPool(turn, c, "coffeeRefuse", t.coffeeRefuse)), vars(turn)),
    );
  }
  if (hasUpgrade(turn.player, "coffee-machine")) mult *= a.machineMult;
  c.mood = Math.max(0, c.mood - nudge(rng, a.mood) * mult);
  x.patience = Math.min(x.patienceMax, x.patience + a.patience);
  const answer = fill(
    pick(
      rng,
      c.loved
        ? agedPool(turn, c, "coffeeAccept.loved", t.coffeeAccept.loved)
        : agedPool(turn, c, "coffeeAccept.notLoved", t.coffeeAccept.notLoved),
    ),
    vars(turn),
  );
  return negView(turn, pitch + answer);
}

/**
 * Section 3.4, Listen: costs two patience; reveals the hidden trait first,
 * then tells (loved, cheapness, the limit) not yet given away. Loved
 * customers warm to it; the others get bored, which is a tell of its own.
 */
function listen(turn: Turn): View {
  const { c, x } = customer(turn);
  if (!canListen(c)) throw new Error("Nothing more to learn");
  const content = xc(turn);
  const t = content.text.negotiation;
  const a = xr(turn).actions.listen;
  const rng = turn.rng;
  const prefix = usePatience(turn, c, a.patience);
  x.listens++;
  const pitch = fill(pick(rng, agedPool(turn, c, "listenPitch", t.listenPitch)), vars(turn));
  const parts: string[] = [];
  const reveals = listenCount(effectsOf(turn, c));
  for (let i = 0; i < reveals && canListen(c); i++) {
    if (x.visibleTraits < x.traits.length) {
      const trait = traitDefs(turn, c)[x.visibleTraits];
      x.visibleTraits++;
      if (trait) {
        const line = fill(t.listenTrait, { ...vars(turn), trait: trait.label });
        const said = trait.lines.length > 0 ? fill(pick(rng, trait.lines), vars(turn)) : "";
        x.notes.push(line + said);
        parts.push(line + said);
      }
      continue;
    }
    const open = (["loved", "cheap", "limit"] as const).filter((k) => !x.told[k]);
    const kind = open[rng.random(open.length)] ?? "limit";
    x.told[kind] = true;
    let line: string;
    if (kind === "limit") {
      const narrowed = narrowEstimate(x.estimate, c.moneyToSpend, xr(turn).customer.limitStep);
      x.estimate = narrowed.estimate;
      line = fill(
        pick(rng, narrowed.upper ? content.tells.limitHigh : content.tells.limitLow),
        vars(turn),
      );
    } else {
      line = fill(tellLine(turn, c, kind), vars(turn));
    }
    x.notes.push(line);
    parts.push(line);
  }
  if (c.loved) {
    c.mood = Math.max(0, c.mood + a.lovedMood);
    parts.push(fill(pick(rng, agedPool(turn, c, "listenLoved", t.listenLoved)), vars(turn)));
  } else {
    moodUp(turn, c, nudge(rng, a.notLovedMood));
    parts.push(fill(pick(rng, agedPool(turn, c, "listenNotLoved", t.listenNotLoved)), vars(turn)));
  }
  if (walks(turn, c)) return walkOutX(turn, `${prefix}${pitch}${parts.join(" ")}\n\n`, false);
  return negView(turn, prefix + pitch + parts.join(" "));
}

/** Section 3.4, Discount: 10% off the bill on the $50 grid, twice at most; calms and loosens. */
function discount(turn: Turn): View {
  const { c, x } = customer(turn);
  const rules = xr(turn);
  const d = rules.actions.discount;
  const amount = discountAmount(turn, c);
  if (x.discounts >= d.max || billTotal(turn, c) - amount < rules.customer.limitStep) {
    throw new Error("No discount possible");
  }
  const t = xc(turn).text.negotiation;
  const rng = turn.rng;
  const prefix = usePatience(turn, c, 1);
  x.discounts++;
  x.discount += amount;
  const mult = multOf(effectsOf(turn, c), "discount");
  c.mood = Math.max(0, c.mood - nudge(rng, d.mood) * mult);
  c.cheapness = clamp(c.cheapness - d.cheapness * mult, 0, 10);
  if (c.income === 0) karmaMod(turn.player, d.poorKarma);
  const pitch = fill(
    pick(rng, agedPool(turn, c, "discountPitch", t.discountPitch)),
    vars(turn, { amount: intToCash(amount) }),
  );
  const answer = fill(
    pick(
      rng,
      mult > 1
        ? agedPool(turn, c, "discountHaggle", t.discountHaggle)
        : agedPool(turn, c, "discountAccept", t.discountAccept),
    ),
    vars(turn),
  );
  return negView(turn, prefix + pitch + answer);
}

/** Section 5.2: switch to the cremation track (once per customer; needs the incinerator). */
function cremation(turn: Turn): View {
  const { c, x } = customer(turn);
  if (!hasUpgrade(turn.player, "incinerator") || x.track !== "burial" || x.cremationAsked) {
    throw new Error("Cremation is not on offer");
  }
  const def = xc(turn).cremation;
  const a = xr(turn).actions.cremation;
  const rng = turn.rng;
  x.cremationAsked = true;
  const prefix = usePatience(turn, c, 1);
  const pitch = fill(pick(rng, def.pitch), vars(turn, { price: intToCash(def.fee) }));
  const reluctance =
    a.base -
    c.cheapness * a.cheapWeight +
    (c.loved ? a.loved : 0) +
    affinityOf(effectsOf(turn, c), def.tags);
  if (rng.frandom(10) < reluctance) {
    moodUp(turn, c, nudge(rng, turn.rules.hardRefuseMood));
    if (walks(turn, c)) return walkOutX(turn, prefix + pitch, false);
    return negView(turn, prefix + pitch + fill(pick(rng, def.refuse), vars(turn)));
  }
  const saved = JSON.stringify(x);
  const desired = c.desiredCasket;
  x.track = "cremation";
  c.desiredCasket = 0;
  // Burial-only extras go away (section 5.2).
  const items = xc(turn).softSell;
  x.bought = x.bought.filter((i) => items[i]?.track !== "burial");
  x.hand = x.hand.filter((i) => items[i]?.track !== "burial");
  for (const cat of xc(turn).packages) if (cat.track === "burial") delete x.packages[cat.id];
  if (billTotal(turn, c) > c.moneyToSpend) {
    // The fee does not fit what they can pay: nothing changes but the mood (section 5.2).
    const restored = JSON.parse(saved) as ExpandedCustomer;
    restored.cremationAsked = true;
    c.expanded = restored;
    c.desiredCasket = desired;
    if (c.mood > turn.rules.overLimitLeaveMood) return walkOutX(turn, prefix + pitch, true);
    moodUp(turn, c, nudge(rng, turn.rules.overLimitMood));
    return negView(
      turn,
      prefix + pitch + fill(xc(turn).text.negotiation.packageOverLimit, vars(turn)),
    );
  }
  if (c.cheapness > 5) c.mood = Math.max(0, c.mood - a.reliefMood);
  return negView(turn, prefix + pitch + fill(pick(rng, def.accept), vars(turn)));
}

/** Section 8.3, Church Associate: bless once; calms and shows whether they loved the deceased. */
function bless(turn: Turn): View {
  const { c, x } = customer(turn);
  const associate = hasPerk(xr(turn), turn.player, "church-associate");
  const life = turn.player.expanded?.life;
  if ((!associate && (life?.holyWater ?? 0) <= 0) || x.blessed) throw new Error("Cannot bless");
  if (!associate && life) life.holyWater--;
  const t = xc(turn).text.negotiation;
  x.blessed = true;
  const prefix = usePatience(turn, c, 1);
  c.mood = Math.max(0, c.mood - xr(turn).actions.bless.mood);
  x.told.loved = true;
  const line = fill(c.loved ? t.blessResult.loved : t.blessResult.notLoved, vars(turn));
  x.notes.push(line);
  return negView(turn, prefix + fill(t.blessPitch, vars(turn)) + line);
}

/** Section 8.3, Necromancer: raise mourners once; the customer stops haggling but the town notices. */
function raise(turn: Turn): View {
  const { c, x } = customer(turn);
  const rules = xr(turn);
  if (!hasPerk(rules, turn.player, "necromancer") || x.raised) throw new Error("Cannot raise");
  const t = xc(turn).text.negotiation;
  const a = rules.actions.raise;
  x.raised = true;
  const prefix = usePatience(turn, c, 1);
  c.cheapness = clamp(c.cheapness - a.cheapness, 0, 10);
  moodUp(turn, c, a.mood);
  reviewsMod(turn.player, rules, -a.rating);
  if (walks(turn, c)) return walkOutX(turn, prefix + fill(t.raisePitch, vars(turn)), false);
  return negView(turn, prefix + fill(t.raisePitch, vars(turn)) + fill(t.raiseResult, vars(turn)));
}

/** A special customer's flat deal (section 3.8). */
function offer(turn: Turn, accept: boolean): View {
  const { c } = customer(turn);
  const special = specialDef(turn, c);
  if (!special?.offer) throw new Error("No offer");
  const choice = accept ? special.offer.accept : special.offer.decline;
  applyReward(turn, turn.player, choice.effects);
  c.flow = "none";
  const summary = rewardSummary(choice.effects);
  return endView(
    turn,
    `${fill(choice.text, vars(turn))}${summary ? `\n\n${summary}` : ""}`,
    "stuff/money_bag_2",
  );
}

/** Section 3.7, Done. */
function done(turn: Turn): View {
  const { c, x } = customer(turn);
  if (specialDef(turn, c)?.offer) throw new Error("Answer the offer");
  const { text, result } = settleSale(turn);
  if (x.practice) {
    const xpl = xp(turn);
    xpl.tutorial.step = TUTORIAL_FINISH;
  }
  const view = finishView(turn, text, choosePrep(turn));
  // Section 11.5: how the sale ended, as data (sound cues).
  view.saleOutcome = saleOutcomeOf(result.bonusKey);
  return view;
}

/** Tutorial step meaning "the practice sale is done; show the clerk's last words". */
export const TUTORIAL_FINISH = 99;

/**
 * The session ended mid-negotiation (`LocationModule.sessionEnd`): the sale
 * completes with the same bonuses and is mailed, as Classic does
 * (online_util.cpp:123-133). An unanswered offer is simply declined.
 */
function sessionEnd(turn: Turn): void {
  const c = turn.session.customer;
  if (!c.expanded) return;
  if (specialDef(turn, c)?.offer) {
    c.flow = "none";
    return;
  }
  const { text } = settleSale(turn);
  const me = turn.player;
  mailText(turn.town, me.id, xc(turn).text.done.fainted + text);
  mailPicture(turn.town, me.id, "places/hospital_ambulance");
  mailContinue(turn, me.id);
}

export const expandedNegotiationModule: LocationModule = {
  id: XNEG,
  press(turn, command) {
    const c = turn.session.customer;
    if (!c.active || c.flow !== "negotiation" || !c.expanded) {
      throw new Error("No customer is being negotiated with");
    }
    const x = c.expanded;
    if (command.startsWith("hand:")) return pitchCard(turn, Number(command.slice(5)));
    if (command.startsWith("pkg:")) return pitchPackage(turn, command.slice(4));
    if (command === "offer:accept") return offer(turn, true);
    if (command === "offer:decline") return offer(turn, false);
    if (command === "back") {
      x.pane = "main";
      return negView(turn, "");
    }
    switch (command) {
      case "guilt":
        return guilt(turn);
      case "sympathy":
        return sympathy(turn);
      case "hard":
        return hardSell(turn);
      case "soft":
        return showHand(turn);
      case "packages":
        return showPackages(turn);
      case "coffee":
        return coffee(turn);
      case "listen":
        return listen(turn);
      case "discount":
        return discount(turn);
      case "cremation":
        return cremation(turn);
      case "bless":
        return bless(turn);
      case "raise":
        return raise(turn);
      case "done":
        return done(turn);
    }
    throw new Error(`Unknown negotiation command ${command}`);
  },
  sessionEnd,
};
