import { CLASSIC_RULES, EXPANDED, type ExpandedRules } from "@fq/core";
import type { Button, CustomerPanel, View } from "@fq/protocol";
import { lovedFromMood } from "../negotiation.js";
import type { SalesStyle, Skill } from "../personalities.js";
import type { BotRandom } from "../random.js";
import { plain } from "../read.js";
import { type Guide, matchesAny } from "./guide.js";

/**
 * The Expanded sales brain (docs/expanded-rules.md sections 3 to 5). It reads
 * the customer panel (estimate, patience, mood, traits, notes, bill) and the
 * customer's answers, keeps a belief about the hidden spending limit (a range
 * on the $50 grid) and the hidden resistance (a distribution over 0 to 10),
 * and each step picks the action with the best expected gain in BP against
 * what it costs in mood, patience and walkout risk. Every fact it uses is on
 * the screen or in the public rule book (`Guide`, `EXPANDED`).
 */

const CHEAP_STEP = 0.5;
const GRID = Array.from({ length: 21 }, (_, i) => i * CHEAP_STEP);

export interface XCustomer {
  /** The customer's name (a new name is a new customer). */
  key: string;
  lo: number;
  hi: number;
  /** Probability of each cheapness on GRID. */
  cheap: number[];
  loved: boolean | null;
  /** Trait ids seen so far (visible, then any revealed). */
  traits: string[];
  notes: number;
  last: LastPitch | null;
  levers: number;
  listens: number;
  pitches: number;
  hardRefused: number;
  pkgRefused: Record<string, number>;
  coffee: boolean;
  discounts: number;
  blessed: boolean;
  raised: boolean;
  cremationAsked: boolean;
  /** The hand of cards last seen (still valid until a card is pitched). */
  hand: { slot: number; name: string; price: number }[] | null;
  /** Package cards last seen. */
  pkgs: { id: string; price: number; tags: string[]; enabled: boolean }[] | null;
  /** Bill when the hand or the packages were last looked at and nothing was worth pitching. */
  handIdleBill: number;
  pkgIdleBill: number;
  /** Pane switches since the last action that cost patience (a loop guard). */
  flips: number;
  ceiling: number;
  /** Seen the arrival screen of a special offer. */
  offer: boolean;
  /** The closeness bands the customer panel states (3.7); absent: the rule book's tiers. */
  bands?: { key: "exact" | "great" | "nice"; within: number }[];
}

interface LastPitch {
  kind: "soft" | "hard" | "pkg" | "crem" | "guilt" | "sympathy" | "discount" | "raise" | "listen";
  /** Dollars the pitch would add to the bill. */
  price: number;
  /** Cheapness added for this pitch (tag affinities, Hard Sell effects, markup). */
  extra: number;
  /** Hard Sells and packages are refused outright above 8 (`hardRefuseCheapness`). */
  strict: boolean;
  bill: number;
  mood: number;
  category?: string;
}

export interface SellContext {
  view: View;
  guide: Guide;
  style: SalesStyle;
  skill: Skill;
  rng: BotRandom;
  /** The bot's own psych level (internal, 0 to 7), from the stats sheet. */
  psych: number;
  karma: number;
  markup: number;
  /** Necromancer? Associate? Holy water held? (for the "more" row). */
  morals: "good" | "evil" | "neutral";
}

const rules = (): ExpandedRules => EXPANDED;

/** Simulator oracle: the hidden truth as the belief (expanded/oracle use only). */
export function knowX(
  n: XCustomer,
  truth: { limit: number; cheapness: number; loved: boolean },
): void {
  n.lo = truth.limit;
  n.hi = truth.limit;
  n.loved = truth.loved;
  const c = Math.round(clamp(truth.cheapness, 0, 10) / CHEAP_STEP) * CHEAP_STEP;
  n.cheap = GRID.map((v) => (Math.abs(v - c) < 1e-6 ? 1 : 0));
}

export function isXNegotiation(view: View): boolean {
  return (
    !view.overlay &&
    !!view.customer?.estimate &&
    view.buttons.some(
      (b) =>
        b.id === "neg:done" ||
        b.id === "neg:back" ||
        b.id.startsWith("neg:hand:") ||
        b.id.startsWith("neg:pkg:") ||
        b.id.startsWith("neg:offer:"),
    )
  );
}

function effects(guide: Guide, traits: readonly string[]) {
  return traits.map((t) => guide.traits.get(t) ?? {});
}

function mult(
  guide: Guide,
  traits: readonly string[],
  key: "guilt" | "sympathy" | "coffee" | "discount" | "moodMult",
): number {
  let out = 1;
  for (const e of effects(guide, traits)) {
    const v = e[key];
    if (v !== undefined) out *= v;
  }
  return out;
}

function sum(guide: Guide, traits: readonly string[], key: "cheapness" | "hardSell"): number {
  let out = 0;
  for (const e of effects(guide, traits)) out += e[key] ?? 0;
  return out;
}

function affinity(guide: Guide, traits: readonly string[], tags: readonly string[]): number {
  let out = 0;
  for (const e of effects(guide, traits)) for (const t of tags) out += e.affinity?.[t] ?? 0;
  return out;
}

function listenFacts(guide: Guide, traits: readonly string[]): number {
  let out = 1;
  for (const e of effects(guide, traits)) if (e.listen !== undefined) out = Math.max(out, e.listen);
  return out;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The prior on resistance: Classic's uniform 0 to 10 plus what the screen explains. */
function prior(shift: number): number[] {
  const out = GRID.map(() => 0);
  const samples = 200;
  for (let i = 0; i < samples; i++) {
    const c = clamp(((i + 0.5) / samples) * 10 + shift, 0, 10);
    out[Math.round(c / CHEAP_STEP)] = (out[Math.round(c / CHEAP_STEP)] ?? 0) + 1 / samples;
  }
  return out;
}

function normalize(p: number[], fallback: () => number[]): number[] {
  const total = p.reduce((a, b) => a + b, 0);
  if (!(total > 1e-9)) return fallback();
  return p.map((v) => v / total);
}

/** Shifts the belief by `-amount` for each of a few equally likely amounts. */
function lower(p: number[], amounts: readonly number[]): number[] {
  const out = GRID.map(() => 0);
  for (const a of amounts) {
    p.forEach((mass, i) => {
      const c = clamp((GRID[i] ?? 0) - a, 0, 10);
      const j = Math.round(c / CHEAP_STEP);
      out[j] = (out[j] ?? 0) + mass / amounts.length;
    });
  }
  return out;
}

function nudgeSamples(base: number, range: number, times: number): number[] {
  return [0.1, 0.3, 0.5, 0.7, 0.9].map((f) => (base + range * f) * times);
}

/** P(refused) for a pitch judged at cheapness + `extra`. */
function refuseP(p: readonly number[], extra: number, strict: boolean): number {
  let out = 0;
  p.forEach((mass, i) => {
    const c = clamp((GRID[i] ?? 0) + extra, 0, 10);
    out += mass * (strict && c > 8 ? 1 : c / 10);
  });
  return out;
}

function meanCheap(p: readonly number[]): number {
  return p.reduce((a, m, i) => a + m * (GRID[i] ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Scoring (section 3.7)

function baseBp(bill: number): number {
  return Math.trunc(Math.max(0, bill) * rules().scoring.bpMultiplier);
}

/**
 * The closeness tiers, nearest first. The panel's `bands` (section 11.5) say how close a
 * bill must be; what each band pays comes from the rule book's tier of the same key.
 */
function tiersOf(bands: XCustomer["bands"]): { within: number; share: number }[] {
  const s = rules().scoring;
  if (!bands) return s.tiers;
  const out: { within: number; share: number }[] = [];
  for (const b of bands) {
    const tier = s.tiers.find((t) => t.key === b.key);
    if (tier) out.push({ within: b.within, share: tier.share });
  }
  return out.sort((a, b) => a.within - b.within);
}

function scoreAt(bill: number, limit: number, chase: number, bands?: XCustomer["bands"]): number {
  const s = rules().scoring;
  const base = baseBp(bill);
  if (bill > limit || limit <= 0) return base;
  if (bill === limit) return base + chase * (Math.ceil(base * s.exact.share) + s.exact.flat);
  const left = (limit - bill) / limit;
  for (const t of tiersOf(bands))
    if (left <= t.within) return base + chase * Math.ceil(base * t.share);
  return base;
}

function limits(n: XCustomer): number[] {
  const step = rules().customer.limitStep;
  const out: number[] = [];
  const lo = Math.ceil(n.lo / step) * step;
  for (let l = lo; l <= n.hi; l += step) out.push(l);
  return out.length > 0 ? out : [n.lo];
}

function expected(n: XCustomer, bill: number, chase: number): number {
  const ls = limits(n);
  return ls.reduce((a, l) => a + scoreAt(bill, l, chase, n.bands), 0) / ls.length;
}

/** Expected BP gained by adding `price` if it is accepted on taste, against the current bill. */
function fitGain(
  n: XCustomer,
  bill: number,
  price: number,
  chase: number,
): { gain: number; fits: number } {
  const ls = limits(n);
  let gain = 0;
  let fits = 0;
  for (const l of ls) {
    if (bill + price <= l) {
      fits++;
      gain += scoreAt(bill + price, l, chase, n.bands) - scoreAt(bill, l, chase, n.bands);
    }
  }
  return { gain: gain / ls.length, fits: fits / ls.length };
}

// ---------------------------------------------------------------------------
// Meeting and watching the customer

export function meetX(view: View, ctx: SellContext): XCustomer {
  const panel = view.customer as CustomerPanel;
  const est = panel.estimate ?? { low: panel.total, high: panel.total };
  const traits = (panel.traits ?? []).map((t) => t.id);
  const shift =
    sum(ctx.guide, traits, "cheapness") -
    rules().psych.calm.cheapness * Math.min(ctx.psych, rules().psych.maxLevel) +
    (ctx.karma >= rules().karma.good[0] ? rules().karma.goodCheapness : 0);
  const n: XCustomer = {
    key: panel.name ?? "",
    lo: Math.max(est.low, panel.total),
    hi: est.high,
    cheap: prior(shift),
    loved: null,
    traits,
    notes: 0,
    last: null,
    levers: 0,
    listens: 0,
    pitches: 0,
    hardRefused: 0,
    pkgRefused: {},
    coffee: false,
    discounts: 0,
    blessed: false,
    raised: false,
    cremationAsked: false,
    hand: null,
    pkgs: null,
    handIdleBill: -1,
    pkgIdleBill: -1,
    flips: 0,
    ceiling: Math.min(9.6, ctx.style.moodCeiling + ctx.rng.jitter(ctx.skill.ceilingNoise)),
    offer: panel.haggle === false || view.buttons.some((b) => b.id.startsWith("neg:offer:")),
    ...(panel.bands ? { bands: panel.bands } : {}),
  };
  for (const t of traits) {
    const loved = ctx.guide.traits.get(t)?.loved;
    if (loved !== undefined) n.loved = loved;
  }
  return n;
}

/** Updates the beliefs from the screen that answered the last action. */
export function watchX(n: XCustomer, view: View, ctx: SellContext): void {
  const panel = view.customer;
  if (!panel) return;
  const g = ctx.guide;
  const skill = ctx.skill;
  const text = plain(view.text);
  const bill = panel.total;
  // Traits revealed by Listen.
  for (const t of panel.traits ?? []) {
    if (n.traits.includes(t.id)) continue;
    n.traits.push(t.id);
    const e = g.traits.get(t.id);
    if (e?.cheapness && skill.planner) n.cheap = lower(n.cheap, [-e.cheapness]);
    if (e?.loved !== undefined) n.loved = e.loved;
  }
  // Notes: tells learned (arrival, psych, Listen, Bless).
  const notes = (panel.notes ?? []).map(plain);
  for (let i = n.notes; i < notes.length; i++) {
    const line = notes[i] ?? "";
    if (!ctx.rng.chance(skill.readMood)) continue;
    if (matchesAny(line, g.tells.loved) || matchesAny(line, g.blessLoved)) n.loved = true;
    else if (matchesAny(line, g.tells.notLoved) || matchesAny(line, g.blessNotLoved))
      n.loved = false;
    else if (skill.trackLimit) {
      const keep = (f: (c: number) => boolean) =>
        normalize(
          n.cheap.map((m, j) => (f(GRID[j] ?? 0) ? m : 0)),
          () => n.cheap,
        );
      if (matchesAny(line, g.tells.cheapLow))
        n.cheap = keep((c) => c < rules().customer.cheapLowBelow);
      else if (matchesAny(line, g.tells.cheapHigh))
        n.cheap = keep((c) => c > rules().customer.cheapHighAbove);
      else if (matchesAny(line, g.tells.cheapMid))
        n.cheap = keep(
          (c) => c >= rules().customer.cheapLowBelow && c <= rules().customer.cheapHighAbove,
        );
    }
  }
  n.notes = notes.length;
  if (n.loved === null && skill.readMood >= 0.8)
    n.loved = lovedFromMood(panel.moodLabel, panel.moodLevel);

  // The outcome of the last pitch.
  const last = n.last;
  if (last) {
    const accepted = bill > last.bill;
    const strict = last.strict;
    const pitched = ["soft", "hard", "pkg"].includes(last.kind);
    if (last.kind === "crem" && !accepted && matchesAny(text, g.overLimit) && skill.trackLimit) {
      n.hi = Math.min(n.hi, last.bill + last.price - rules().customer.limitStep);
    }
    if (pitched) {
      const over = matchesAny(text, g.overLimit);
      if (accepted) {
        n.lo = Math.max(n.lo, bill);
        if (skill.planner) n.cheap = bayes(n.cheap, last.extra, strict, false);
      } else if (over) {
        if (skill.trackLimit)
          n.hi = Math.min(n.hi, last.bill + last.price - rules().customer.limitStep);
        if (skill.planner) n.cheap = bayes(n.cheap, last.extra, strict, false);
      } else {
        if (skill.planner) n.cheap = bayes(n.cheap, last.extra, strict, true);
        if (last.kind === "hard") n.hardRefused++;
        if (last.kind === "pkg" && last.category)
          n.pkgRefused[last.category] = (n.pkgRefused[last.category] ?? 0) + 1;
      }
    }
    if (last.kind === "listen" && n.loved === null && skill.moodDeltas) {
      // Listening calms a customer who loved the deceased and bores one who did not.
      if (panel.moodLevel < last.mood - 0.05) n.loved = true;
      else if (panel.moodLevel > last.mood + 0.15) n.loved = false;
    }
    if (skill.planner) {
      const effectsMult =
        last.kind === "guilt"
          ? mult(g, n.traits, "guilt")
          : last.kind === "sympathy"
            ? mult(g, n.traits, "sympathy")
            : 1;
      if (
        (last.kind === "guilt" && n.loved === false) ||
        (last.kind === "sympathy" && n.loved === true)
      ) {
        const c =
          last.kind === "guilt" ? CLASSIC_RULES.guiltCheapness : CLASSIC_RULES.sympathyCheapness;
        n.cheap = lower(n.cheap, nudgeSamples(c.base, c.range, effectsMult));
      }
      if (last.kind === "discount")
        n.cheap = lower(n.cheap, [
          rules().actions.discount.cheapness * mult(g, n.traits, "discount"),
        ]);
      if (last.kind === "raise") n.cheap = lower(n.cheap, [rules().actions.raise.cheapness]);
    }
    n.last = null;
  }
  const est = panel.estimate;
  if (est) {
    n.lo = Math.max(n.lo, est.low, bill);
    if (skill.trackLimit || n.hi > est.high) n.hi = Math.min(n.hi, est.high);
  }
  n.lo = Math.max(n.lo, bill);
  if (n.hi < n.lo) n.hi = n.lo;
  if (panel.resistancePercent !== undefined) {
    const c = clamp(panel.resistancePercent / 10, 0, 10);
    n.cheap = GRID.map((v) =>
      Math.abs(v - Math.round(c / CHEAP_STEP) * CHEAP_STEP) < 1e-6 ? 1 : 0,
    );
  }
}

function bayes(p: number[], extra: number, strict: boolean, refused: boolean): number[] {
  return normalize(
    p.map((m, i) => {
      const c = clamp((GRID[i] ?? 0) + extra, 0, 10);
      const r = strict && c > 8 ? 1 : c / 10;
      return m * (refused ? r : 1 - r);
    }),
    () => p,
  );
}

// ---------------------------------------------------------------------------
// Choosing

interface Option {
  /** The button that starts it from the current pane. */
  press: string;
  /** Pane the option lives on. */
  pane: "main" | "hand" | "packages";
  value: number;
  last?: LastPitch;
  note?: (n: XCustomer) => void;
}

function enabled(view: View, id: string): Button | undefined {
  return view.buttons.find((b) => b.id === id && b.enabled !== false);
}

function money(detail: string | undefined): number {
  return Number((detail ?? "").replace(/[^\d]/g, "")) || 0;
}

/**
 * The casket line and its tier from the bill. The tier is read from the price (the list
 * prices are public and the bot knows its own markup), not from the line's wording.
 */
function casketOf(panel: CustomerPanel, markup: number): { tier: number; price: number } {
  const price = panel.bill?.[0]?.price ?? 0;
  const scale = 1 + markup / 100;
  let tier = 0;
  let best = Number.POSITIVE_INFINITY;
  LIST.forEach((list, i) => {
    const off = Math.abs(price - list * scale);
    if (off < best) {
      best = off;
      tier = i;
    }
  });
  return { tier, price };
}

const LIST = [800, 2600, 5300];

/** The mood a step adds when patience has run out. */
function impatience(panel: CustomerPanel, mm: number): number {
  return (panel.patience?.left ?? 1) <= 0 ? 0.75 * mm : 0;
}

/** Chance that `mood + base + U(0, range) x mm` reaches 10. */
function walkP(mood: number, base: number, range: number, mm: number): number {
  const need = 10 - mood - base * mm;
  const span = range * mm;
  if (need <= 0) return 1;
  if (need >= span) return 0;
  return 1 - need / span;
}

export function chooseX(n: XCustomer, ctx: SellContext): string {
  const view = ctx.view;
  const panel = view.customer as CustomerPanel;
  const g = ctx.guide;
  const style = ctx.style;
  const skill = ctx.skill;
  const pane: Option["pane"] = view.buttons.some((b) => b.id === "neg:back")
    ? view.buttons.some((b) => b.id.startsWith("neg:pkg:"))
      ? "packages"
      : "hand"
    : "main";
  // Special offers: take the deal that suits the karma path.
  if (enabled(view, "neg:offer:accept")) return offerChoice(panel, ctx);

  const bill = panel.total;
  const mood = panel.moodLevel;
  const mm = mult(g, n.traits, "moodMult");
  const patience = panel.patience?.left ?? 0;
  const chase = style.chaseExact ? 1 : 0.6;
  const now = expected(n, bill, chase);
  const loss = (now + 4) * style.walkAversion;
  const room = Math.max(0, n.hi - bill);
  // A mood point is worth what the next pitches could still make, roughly.
  const moodCost = (0.6 + Math.min(room, 8000) * 0.0004) * (mood > 6 ? 1.6 : 1);
  const patienceCost = patience > 0 ? 0.3 + Math.min(room, 8000) * 0.0001 : 0;
  const imp = impatience(panel, mm);
  const options: Option[] = [];

  if (pane === "hand") {
    n.hand = view.buttons
      .filter((b) => b.group === "hand")
      .map((b) => ({ slot: Number(b.id.slice(9)), name: b.label, price: money(b.detail) }));
  }
  if (pane === "packages") {
    n.pkgs = view.buttons
      .filter((b) => b.id.startsWith("neg:pkg:"))
      .map((b) => {
        const id = b.id.slice(8);
        const tierName = b.label.split(": ").slice(1).join(": ");
        const tiers = g.packages.get(id) ?? [];
        const index = tiers.findIndex((t) => t.name === tierName);
        const tier = tiers[index];
        const before = tiers[index - 1]?.price ?? 0;
        return {
          id,
          price: (tier?.price ?? money(b.detail)) - before,
          tags: tier?.tags ?? [],
          enabled: b.enabled !== false,
        };
      });
  }

  const pitchValue = (
    price: number,
    extra: number,
    strict: boolean,
    refuseMood: [number, number],
  ) => {
    const refuse = skill.planner ? refuseP(n.cheap, extra, strict) : 0.45;
    const { gain, fits } = fitGain(n, bill, price, chase);
    const accept = 1 - refuse;
    const over = accept * (1 - fits);
    const moodAfter = mood + imp;
    // A refusal walks out at mood 10; an over-limit answer walks out above 9 (overLimitLeaveMood).
    const walk =
      refuse * walkP(moodAfter, refuseMood[0], refuseMood[1], mm) + over * (moodAfter > 9 ? 1 : 0);
    const dMood = imp + refuse * (refuseMood[0] + refuseMood[1] / 2) * mm + over * 0.9 * mm;
    return accept * gain - walk * loss - dMood * moodCost - patienceCost;
  };

  // Cards in the hand.
  if (pane === "hand" || (n.hand && enabled(view, "neg:soft"))) {
    for (const card of n.hand ?? []) {
      const tags = g.items.get(card.name) ?? [];
      const v = pitchValue(card.price, affinity(g, n.traits, tags), false, [0.4, 0.7]);
      options.push({
        press: pane === "hand" ? `neg:hand:${card.slot}` : "neg:soft",
        pane: "hand",
        value: v,
        last: {
          kind: "soft",
          price: card.price,
          extra: affinity(g, n.traits, tags),
          strict: false,
          bill,
          mood,
        },
      });
    }
  }
  // Package tiers.
  if (n.pkgs && (pane === "packages" || enabled(view, "neg:packages"))) {
    for (const p of n.pkgs) {
      if (!p.enabled || (n.pkgRefused[p.id] ?? 0) >= 2) continue;
      const extra = affinity(g, n.traits, p.tags);
      const v = pitchValue(p.price, extra, true, [0.7, 1]);
      options.push({
        press: pane === "packages" ? `neg:pkg:${p.id}` : "neg:packages",
        pane: "packages",
        value: v,
        last: { kind: "pkg", price: p.price, extra, strict: true, bill, mood, category: p.id },
      });
    }
  }
  // Looking at the hand or the packages is free (no patience): worth it when not seen at this bill.
  if (pane === "main") {
    if (
      enabled(view, "neg:soft") &&
      n.hand === null &&
      n.handIdleBill !== bill &&
      style.softMax > 0
    )
      options.push({ press: "neg:soft", pane: "main", value: 0.5 });
    if (enabled(view, "neg:packages") && n.pkgs === null && n.pkgIdleBill !== bill)
      options.push({ press: "neg:packages", pane: "main", value: 0.45 });
  }

  // Main-row actions.
  const main = (id: string) => (pane === "main" ? enabled(view, id) : undefined);
  const viaBack = pane !== "main";
  const hard = viaBack ? undefined : main("neg:hard");
  const casket = casketOf(panel, ctx.markup);
  if (hard && casket.tier < 2 && n.hardRefused < 3) {
    const ratio = casket.price / (LIST[casket.tier] ?? 800);
    const next = Math.round(((LIST[casket.tier + 1] ?? 0) * ratio) / 50) * 50;
    const price = next - casket.price;
    const extra =
      sum(g, n.traits, "hardSell") + Math.max(0, ctx.markup / 10) * rules().markup.cheapnessPer10;
    const v = pitchValue(price, extra, true, [0.6, 1]) + (style.hardFirst - 0.5);
    options.push({
      press: "neg:hard",
      pane: "main",
      value: v,
      last: { kind: "hard", price, extra, strict: true, bill, mood },
    });
  }
  const crem = main("neg:cremation");
  if (crem && !n.cremationAsked && casket.tier === 0) {
    // Reluctance = 6 - 0.8 x cheapness + 2 if loved + affinity; the fee replaces the casket line.
    const a = rules().actions.cremation;
    const aff = affinity(g, n.traits, g.cremation.tags);
    let accept = 0;
    n.cheap.forEach((m, i) => {
      const r =
        a.base -
        (GRID[i] ?? 0) * a.cheapWeight +
        (n.loved ? a.loved : n.loved === null ? a.loved / 2 : 0) +
        aff;
      accept += m * (1 - clamp(r / 10, 0, 1));
    });
    const price = g.cremation.fee - casket.price;
    const { gain, fits } = fitGain(n, bill, Math.max(0, price), chase);
    const relief = meanCheap(n.cheap) > 5 ? 0.6 : 0;
    const v =
      accept * fits * (gain + relief * moodCost + 1.5) -
      (1 - accept) * 1.1 * mm * moodCost -
      patienceCost;
    options.push({
      press: "neg:cremation",
      pane: "main",
      value: v,
      note: (x) => {
        x.cremationAsked = true;
        x.hand = null;
        x.pkgs = null;
      },
    });
  }
  // The levers: Guilt on someone who did not love the deceased, Sympathy on someone who did.
  const lever = n.loved === null ? null : n.loved ? "sympathy" : "guilt";
  if (lever && main(`neg:${lever}`) && n.levers < style.leverMax && skill.planner !== false) {
    const lm = mult(g, n.traits, lever);
    const drop = (0.7 + 1) * lm;
    const pitchesLeft = Math.max(1, Math.min(patience, 6));
    const c = meanCheap(n.cheap);
    const upside = Math.min(room, 6000) * rules().scoring.bpMultiplier * 1.15;
    const dMood = (lever === "guilt" ? 0.5 : 0.9) * mm;
    const v =
      (Math.min(drop, c) / 10) * pitchesLeft * 0.35 * upside * 0.25 -
      dMood * moodCost -
      patienceCost -
      walkP(mood + imp, lever === "guilt" ? 0 : 0.4, 1, mm) * loss;
    options.push({
      press: `neg:${lever}`,
      pane: "main",
      value: lm <= 0.6 ? v - 2 : v,
      last: { kind: lever, price: 0, extra: 0, strict: false, bill, mood },
      note: (x) => {
        x.levers++;
      },
    });
  }
  // Coffee: calms and gives back a patience; useless on In a Hurry.
  const cm = mult(g, n.traits, "coffee");
  if (main("neg:coffee") && !n.coffee && cm > 0) {
    const calm = 1.3 * cm;
    const v =
      (mood >= 5 || patience <= 2 ? calm * moodCost + (patience <= 1 ? 1 : 0) : 0.2) +
      (room > 1500 ? 0.3 : 0);
    options.push({
      press: "neg:coffee",
      pane: "main",
      value: v - 0.2,
      note: (x) => {
        x.coffee = true;
      },
    });
  }
  // Listen: two patience for a fact (the hidden trait, loved, resistance or the limit's half).
  if (main("neg:listen") && skill.trackLimit && n.listens < 2) {
    const width = n.hi - n.lo;
    const facts = listenFacts(g, n.traits);
    const bp = Math.max(1, baseBp((n.lo + n.hi) / 2));
    const info =
      (width > 150 ? (width / Math.max(1, n.hi)) * bp * 1.4 : 0) +
      (n.loved === null ? 1.2 : 0) +
      (skill.planner ? 0.4 : 0);
    const dMood = n.loved === true ? -0.3 : n.loved === false ? 0.5 * mm : 0.1;
    const v =
      info * facts * 0.6 -
      dMood * moodCost -
      (patience >= 2 ? 2 * patienceCost : 1.5 * moodCost) -
      (patience < 4 ? 1.5 : 0);
    options.push({
      press: "neg:listen",
      pane: "main",
      value: v,
      last: { kind: "listen", price: 0, extra: 0, strict: false, bill, mood },
      note: (x) => {
        x.listens++;
      },
    });
  }
  // Bless (Church Associate or holy water): calms by 2 and shows the loved flag.
  if (main("neg:bless") && !n.blessed) {
    const v = (mood >= 3.5 ? 2 * moodCost : 0.5) + (n.loved === null ? 1.5 : 0) - patienceCost;
    options.push({
      press: "neg:bless",
      pane: "main",
      value: v,
      note: (x) => {
        x.blessed = true;
      },
    });
  }
  // Raise Mourners (Necromancer): resistance -2.5 for a mood point.
  if (main("neg:raise") && !n.raised) {
    const c = meanCheap(n.cheap);
    const upside = Math.min(room, 6000) * rules().scoring.bpMultiplier;
    const v =
      (Math.min(2.5, c) / 10) * Math.min(patience + 1, 5) * 0.3 * upside * 0.3 -
      1 * mm * moodCost -
      patienceCost -
      walkP(mood + imp, 1, 0.01, mm) * loss;
    options.push({
      press: "neg:raise",
      pane: "main",
      value: v,
      last: { kind: "raise", price: 0, extra: 0, strict: false, bill, mood },
      note: (x) => {
        x.raised = true;
      },
    });
  }
  // Discount: 10% off for a calmer, looser customer; a good deed on a poor one.
  const disc = main("neg:discount");
  if (disc && n.discounts < 2) {
    const dm = mult(g, n.traits, "discount");
    const amount = money(disc.detail);
    const lost = expected(n, bill, chase) - expected(n, Math.max(0, bill - amount), chase);
    const calm = 1.7 * dm;
    const karma = ctx.morals === "good" && panel.incomeLabel === "Poor" ? 2 : 0;
    const v =
      (mood >= 7 ? calm * moodCost : calm * moodCost * 0.3) + karma - lost * 1.1 - patienceCost;
    options.push({
      press: "neg:discount",
      pane: "main",
      value: v,
      last: { kind: "discount", price: 0, extra: 0, strict: false, bill, mood },
      note: (x) => {
        x.discounts++;
      },
    });
  }

  // Pick.
  let best: Option | null = null;
  for (const o of options) if (!best || o.value > best.value) best = o;
  const stop = !best || best.value <= 0.05 || mood >= n.ceiling || n.pitches >= style.softMax + 6;
  if (stop || !best) {
    if (pane !== "main") {
      if (pane === "hand") n.handIdleBill = bill;
      else n.pkgIdleBill = bill;
      n.flips++;
      return "neg:back";
    }
    return "neg:done";
  }
  // A choice on another pane: go there first (free), and choose again there.
  if (best.pane !== pane && pane !== "main") {
    n.flips++;
    if (n.flips > 6) return "neg:back";
    return "neg:back";
  }
  if (best.press === "neg:soft" || best.press === "neg:packages") {
    n.flips++;
    if (n.flips > 6) return "neg:done";
    return best.press;
  }
  n.flips = 0;
  best.note?.(n);
  if (best.last) {
    n.last = best.last;
    if (["soft", "hard", "pkg", "crem"].includes(best.last.kind)) n.pitches++;
    if (best.last.kind === "soft") n.hand = null;
    if (best.last.kind === "pkg") n.pkgs = null;
  }
  if (best.press === "neg:cremation")
    n.last = {
      kind: "crem",
      price: g.cremation.fee - casket.price,
      extra: 0,
      strict: false,
      bill,
      mood,
    };
  return best.press;
}

function offerChoice(panel: CustomerPanel, ctx: SellContext): string {
  const offer = ctx.guide.offers.get(panel.special ?? "");
  if (!offer) return "neg:offer:decline";
  const worth = (r: typeof offer.accept) => {
    const k = r.karma ?? 0;
    const karmaWeight = ctx.morals === "good" ? 40 : ctx.morals === "evil" ? -25 : 4;
    return (
      (r.bp ?? 0) + (r.money ?? 0) / 60 + k * karmaWeight + (r.reviews ?? 0) * 3 + (r.gold ?? 0) * 8
    );
  };
  return worth(offer.accept) >= worth(offer.decline) ? "neg:offer:accept" : "neg:offer:decline";
}
