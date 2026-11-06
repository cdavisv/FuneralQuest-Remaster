import type { Action, View } from "@fq/protocol";
import { expect } from "vitest";
import {
  billTotal,
  type EngineContext,
  EXPANDED,
  enterGame,
  runDailyMaintenance,
  type StepResult,
  step,
  type TownState,
} from "../../src/index.js";
import { PLAYER_NAMES, policyRng } from "./harness.js";

/**
 * A View-only random walker for Expanded towns (docs/expanded-rules.md
 * section 14): plays several players over several days, checks the
 * invariants after every action, that every enabled button is accepted, and
 * that a save taken mid-flow plays on identically.
 */

export interface XWalkOptions {
  seed: number;
  days: number;
  /** Steps per player per day before it logs off. */
  cap?: number;
  /** Weight multiplier for the new Expanded actions (exercise mode). */
  favourNew?: boolean;
  /** Edits the town before day 1 (for example to give money or karma). */
  setup?: (town: TownState) => void;
  /** Check every enabled button on a copy every N actions. */
  guardEvery?: number;
  roundTripEvery?: number;
}

export interface XWalkResult {
  town: TownState;
  used: Map<string, number>;
  actions: number;
  rejected: string[];
}

const NEW_ACTIONS = [
  "neg:coffee",
  "neg:listen",
  "neg:discount",
  "neg:packages",
  "neg:cremation",
  "neg:bless",
  "neg:raise",
  "prep:start",
];

const TEXTS = ["", "Digby", "mort", "5", "Hello rival", "3"];

function key(action: Action): string {
  if (action.type === "press") return action.buttonId.replace(/:\d+$/, ":N");
  if (action.type === "visit") return `visit:${action.placeId}`;
  return action.type;
}

export function checkXInvariants(town: TownState): void {
  const x = EXPANDED;
  for (const p of town.players) {
    if (!p.active) continue;
    const where = `player ${p.id} day ${town.day}`;
    expect(p.turns, where).toBeGreaterThanOrEqual(0);
    for (const t of p.tags) expect(t, where).toBeGreaterThanOrEqual(0);
    expect(p.bp, where).toBeGreaterThanOrEqual(0);
    expect(p.bpToday, where).toBeGreaterThanOrEqual(0);
    expect(p.money, where).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(p.money), where).toBe(true);
    expect(p.hp, where).toBeGreaterThanOrEqual(0);
    expect(p.hpMax, where).toBeLessThanOrEqual(x.caps.hpMax);
    expect(p.strength, where).toBeLessThanOrEqual(x.caps.strength);
    expect(p.psych, where).toBeLessThanOrEqual(x.psych.maxLevel);
    expect(p.luck, where).toBeGreaterThanOrEqual(1);
    expect(p.luck, where).toBeLessThanOrEqual(100);
    expect(p.karma, where).toBeGreaterThanOrEqual(1);
    expect(p.karma, where).toBeLessThanOrEqual(100);
    expect(p.rating, where).toBeGreaterThanOrEqual(0);
    expect(p.rating, where).toBeLessThanOrEqual(100);
    expect(p.plots, where).toBeGreaterThanOrEqual(0);
    const e = p.expanded;
    expect(e, where).toBeDefined();
    if (!e) continue;
    for (const s of e.stock) expect(s, where).toBeGreaterThanOrEqual(0);
    expect(e.reviews, where).toBeGreaterThanOrEqual(-x.rating.reviewsMax);
    expect(e.reviews, where).toBeLessThanOrEqual(x.rating.reviewsMax);
    expect(x.markup.options).toContain(e.markup);
  }
}

function checkCustomer(town: TownState, id: number, ctx: EngineContext): void {
  const s = town.sessions[String(id)];
  const c = s?.customer;
  if (!c?.active || c.flow !== "negotiation" || !c.expanded) return;
  const x = c.expanded;
  const where = `customer of ${id}`;
  expect(c.mood, where).toBeGreaterThanOrEqual(0);
  expect(c.cheapness, where).toBeGreaterThanOrEqual(0);
  expect(c.cheapness, where).toBeLessThanOrEqual(10);
  expect(x.estimate.low, where).toBeLessThanOrEqual(c.moneyToSpend);
  expect(x.estimate.high, where).toBeGreaterThanOrEqual(c.moneyToSpend);
  expect(x.patience, where).toBeGreaterThanOrEqual(0);
  expect(x.patience, where).toBeLessThanOrEqual(x.patienceMax);
  expect(new Set(x.hand).size, where).toBe(x.hand.length);
  for (const h of x.hand) {
    expect(x.bought, where).not.toContain(h);
    expect(x.refused, where).not.toContain(h);
  }
  expect(billTotal({ town, content: ctx.content } as never, c), where).toBeLessThanOrEqual(
    c.moneyToSpend,
  );
  expect(c.moneyToSpend % EXPANDED.customer.limitStep, where).toBe(0);
}

function checkView(town: TownState, id: number, view: View): void {
  const p = town.players[id];
  for (const b of view.buttons) {
    if (b.enabled === false) {
      expect(b.hint, `disabled ${b.id} needs a hint`).toBeTruthy();
      continue;
    }
    // Nothing offered that cannot be afforded.
    const price = b.detail?.match(/^\$([\d,]+)$/)?.[1];
    if (price && p && (b.id.startsWith("parlor:buy:") || b.id.startsWith("store:casket:"))) {
      expect(Number(price.replace(/,/g, "")), b.id).toBeLessThanOrEqual(p.money);
    }
  }
}

function choose(
  view: View,
  rand: () => number,
  turns: number,
  negSteps: number,
  favourNew: boolean,
): Action {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)] as T;
  const o = view.overlay;
  if (o) {
    if (o.kind === "message") return { type: "dismiss", overlayId: o.id };
    if (o.kind === "confirm") return { type: "confirm", overlayId: o.id, accepted: rand() < 0.6 };
    if (o.kind === "textInput") {
      if (rand() < 0.1) return { type: "submitText", overlayId: o.id, text: null };
      const name =
        o.id.endsWith(":getname") && rand() < 0.7 ? pick(PLAYER_NAMES).slice(0, 4) : pick(TEXTS);
      return { type: "submitText", overlayId: o.id, text: name.slice(0, o.maxLength) };
    }
    return {
      type: "pickPlayer",
      overlayId: o.id,
      playerId: o.players.length === 0 || rand() < 0.1 ? null : pick(o.players).id,
    };
  }
  if (view.map && view.map.length > 0) {
    if (rand() < 0.35) return { type: "visit", placeId: "funeral-home" };
    return { type: "visit", placeId: pick(view.map).id };
  }
  if (view.scene === "cafe" && rand() < 0.3) return { type: "chat", text: "hello" };
  const ids = view.buttons.filter((b) => b.enabled !== false).map((b) => b.id);
  if (ids.length === 0) return { type: "exit" };
  if (ids.includes("neg:done")) {
    if (negSteps > 9 || rand() < 0.12) return { type: "press", buttonId: "neg:done" };
    const fresh = ids.filter((id) => NEW_ACTIONS.includes(id));
    if (favourNew && fresh.length > 0 && rand() < 0.5)
      return { type: "press", buttonId: pick(fresh) };
    return { type: "press", buttonId: pick(ids.filter((id) => id !== "neg:done")) };
  }
  if (ids.some((id) => id.startsWith("neg:hand:") || id.startsWith("neg:pkg:"))) {
    const cards = ids.filter((id) => id !== "neg:back");
    if (cards.length > 0 && rand() < 0.85) return { type: "press", buttonId: pick(cards) };
    return { type: "press", buttonId: "neg:back" };
  }
  if (ids.includes("desk:wait")) {
    if (turns <= 0) return { type: "press", buttonId: "desk:quit" };
    if (rand() < (favourNew ? 0.6 : 0.7)) return { type: "press", buttonId: "desk:wait" };
    const others = ids.filter((id) => id !== "desk:quit" && id !== "desk:wait");
    return { type: "press", buttonId: pick(others.length > 0 ? others : ["desk:wait"]) };
  }
  if (favourNew) {
    const office = ids.filter(
      (id) => id.startsWith("parlor:") || id.startsWith("store:casket") || id === "store:caskets",
    );
    if (office.length > 0 && rand() < 0.5) return { type: "press", buttonId: pick(office) };
  }
  return { type: "press", buttonId: pick(ids) };
}

/** Plays the town; every player in turn, alone, each day. */
export function xwalk(
  town0: TownState,
  ctx: EngineContext,
  players: number,
  options: XWalkOptions,
): XWalkResult {
  let town = town0;
  options.setup?.(town);
  const used = new Map<string, number>();
  const rejected: string[] = [];
  const cap = options.cap ?? 260;
  const guardEvery = options.guardEvery ?? 7;
  const roundTripEvery = options.roundTripEvery ?? 23;
  let actions = 0;
  for (let d = 0; d < options.days; d++) {
    const rand = policyRng(options.seed * 131 + d * 17 + 3);
    for (let id = 0; id < players; id++) {
      if (!town.players[id]?.active) continue;
      let r: StepResult = enterGame(town, id, ctx);
      town = r.town;
      let view = r.view;
      let negSteps = 0;
      for (let n = 0; n < cap; n++) {
        checkXInvariants(town);
        checkCustomer(town, id, ctx);
        checkView(town, id, view);
        if (actions % guardEvery === 0) {
          for (const b of view.buttons) {
            if (b.enabled === false || view.overlay) continue;
            const g = step(town, id, { type: "press", buttonId: b.id }, ctx);
            if (g.rejected) rejected.push(`${b.id} on ${view.title}: ${g.rejected}`);
          }
        }
        const turns = town.players[id]?.turns ?? 0;
        const action = choose(view, rand, turns, negSteps, options.favourNew ?? false);
        r = step(town, id, action, ctx);
        if (actions % roundTripEvery === 0) {
          const copy = JSON.parse(JSON.stringify(town)) as TownState;
          const again = step(copy, id, action, ctx);
          expect(JSON.stringify(again.town), "save round trip").toBe(JSON.stringify(r.town));
          expect(JSON.stringify(again.view)).toBe(JSON.stringify(r.view));
        }
        if (r.rejected) rejected.push(`${JSON.stringify(action)} on ${view.title}: ${r.rejected}`);
        used.set(key(action), (used.get(key(action)) ?? 0) + 1);
        actions++;
        town = r.town;
        view = r.view;
        negSteps = view.buttons.some((b) => b.id === "neg:done") ? negSteps + 1 : 0;
        if (action.type === "exit" || !town.sessions[String(id)]) break;
      }
      if (town.sessions[String(id)]) town = step(town, id, { type: "exit" }, ctx).town;
      checkXInvariants(town);
    }
    town = runDailyMaintenance(town, ctx).town;
    checkXInvariants(town);
  }
  return { town, used, actions, rejected };
}
