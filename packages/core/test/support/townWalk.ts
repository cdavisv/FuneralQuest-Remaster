import type { Action, View } from "@fq/protocol";
import { expect } from "vitest";
import {
  type EngineContext,
  EXPANDED_TOWN,
  enterGame,
  runDailyMaintenance,
  type StepResult,
  step,
  type TownState,
} from "../../src/index.js";
import { PLAYER_NAMES, policyRng } from "./harness.js";
import { checkXInvariants } from "./xwalk.js";

/**
 * A View-only walker for the Expanded town (docs/expanded-rules.md section
 * 27): random or exercise play over many days, checking after every action
 * the invariants of the town systems, that every enabled button is accepted,
 * that nothing is offered that cannot be paid for, that money, tags and BP
 * are never minted by the bank, bingo cards or chains, and that saves
 * round-trip mid-flow.
 */

export interface TownWalkOptions {
  seed: number;
  days: number;
  players: number;
  cap?: number;
  exercise?: boolean;
  setup?: (town: TownState) => void;
  /** Called with every view the walk is shown, with the town it was drawn from and the viewer. */
  onView?: (view: View, town: TownState, playerId: number) => void;
}

export interface TownWalkResult {
  town: TownState;
  used: Map<string, number>;
  actions: number;
  rejected: string[];
  /** Dollars staked and returned at the club's games. */
  staked: number;
  returned: number;
}

const PLACES = ["graveyard", "church", "city-hall", "hospital", "reaper-club", "bank"];
const AMOUNTS = ["500", "5000", "20000", "0", "-5", "abc", "999999", "2", "8"];

function key(action: Action): string {
  if (action.type === "press")
    return action.buttonId
      .replace(/:\d+$/, ":N")
      .replace(
        /^(city-hall:(vote|permit|join|elect)|hospital:treat|reaper-club:buy|arc:give:[a-z-]+):.*$/,
        "$1:*",
      );
  if (action.type === "visit") return `visit:${action.placeId}`;
  if (action.type === "pickPlayer") return `pick:${action.overlayId}`;
  if (action.type === "submitText") return `text:${action.overlayId}`;
  return action.type;
}

/** Money, net of debt, held by every player, and tags at wood value. */
function wealth(town: TownState): { money: number; tags: number; bp: number } {
  let money = 0;
  let tags = 0;
  let bp = 0;
  for (const p of town.players) {
    if (!p.active) continue;
    const l = p.expanded?.life;
    money += p.money + (l?.savings ?? 0) - (l?.loan?.owed ?? 0);
    tags += (p.tags[0] ?? 0) + 2 * (p.tags[1] ?? 0) + 4 * (p.tags[2] ?? 0);
    bp += p.bp;
  }
  return { money, tags, bp };
}

/** Actions that only move or destroy money, tags and BP (sections 17.1, 21, 23). */
function conserving(action: Action): boolean {
  if (action.type === "submitText") return /^bank:|^city-hall:chainname/.test(action.overlayId);
  if (action.type === "pickPlayer") return /^bank:|^city-hall:invite/.test(action.overlayId);
  if (action.type !== "press") return false;
  return /^bank:|^church:card|^city-hall:(found|join|leavechain|invite|lobby|file|ads|permit|certify|bribe)|^reaper-club:(pay|bodyguard)|^hospital:/.test(
    action.buttonId,
  );
}

export function checkTownInvariants(town: TownState): void {
  checkXInvariants(town);
  const T = EXPANDED_TOWN;
  for (const p of town.players) {
    if (!p.active) continue;
    const l = p.expanded?.life;
    if (!l) continue;
    const where = `player ${p.id} day ${town.day}`;
    expect(l.savings, where).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(l.savings), where).toBe(true);
    if (l.loan) expect(l.loan.owed, where).toBeGreaterThan(0);
    expect(l.injuries.length, where).toBeLessThanOrEqual(T.hospital.maxInjuries);
    for (const i of l.injuries) expect(i.days, where).toBeGreaterThan(0);
    expect(l.leads, where).toBeGreaterThanOrEqual(0);
    expect(l.leads, where).toBeLessThanOrEqual(T.hospital.lead.max);
    expect(l.holyWater, where).toBeGreaterThanOrEqual(0);
    expect(l.holyWater, where).toBeLessThanOrEqual(T.church.holyWater.max);
    expect(l.monuments, where).toBeLessThanOrEqual(T.graveyard.monuments.length);
    expect(new Set(l.permits).size, where).toBe(l.permits.length);
    expect(l.today.staked, where).toBeLessThanOrEqual(T.club.dailyStakeMax);
    expect(l.today.sent, where).toBeLessThanOrEqual(T.bank.transfer.dailyMax);
    expect(l.today.received, where).toBeLessThanOrEqual(T.bank.transfer.dailyMax);
  }
  const life = town.expanded?.life;
  if (!life) return;
  const seen = new Set<number>();
  for (const c of life.chains) {
    expect(c.members.length).toBeGreaterThan(0);
    expect(c.members.length).toBeLessThanOrEqual(T.chains.maxMembers);
    for (const m of c.members) {
      expect(seen.has(m), `player ${m} in two chains`).toBe(false);
      seen.add(m);
      expect(town.players[m]?.expanded?.life?.chain).toBe(c.id);
    }
    expect(c.score).toBeGreaterThanOrEqual(0);
  }
  for (const p of town.players) {
    const chain = p.expanded?.life?.chain;
    if (p.active && chain)
      expect(life.chains.some((c) => c.id === chain && c.members.includes(p.id))).toBe(true);
  }
  expect(life.bingo.carry).toBeGreaterThanOrEqual(0);
  const owned = new Map<number, number>();
  for (const o of life.bingo.cards) if (o >= 0) owned.set(o, (owned.get(o) ?? 0) + 1);
  for (const n of owned.values()) expect(n).toBeLessThanOrEqual(T.church.bingo.maxPerPlayer);
  expect(life.bingo.paid).toBeLessThanOrEqual(life.bingo.cards.filter((o) => o >= 0).length);
}

/** Nothing enabled costs more than the player has (section 11.2 and 27). */
function checkOffers(town: TownState, id: number, view: View): void {
  const p = town.players[id];
  if (!p) return;
  for (const b of view.buttons) {
    if (b.enabled === false) {
      expect(b.hint, `disabled ${b.id} needs a hint`).toBeTruthy();
      continue;
    }
    // Prices on the negotiation's cards are the customer's, not the player's.
    if (b.id.startsWith("neg:")) continue;
    const dollars = b.detail?.match(/^\$([\d,]+)$/)?.[1];
    if (dollars)
      expect(Number(dollars.replace(/,/g, "")), `${b.id} offered unaffordable`).toBeLessThanOrEqual(
        p.money,
      );
    const wood = b.detail?.match(/^(\d+) wood$/)?.[1];
    if (wood)
      expect(Number(wood), `${b.id} offered without the tags`).toBeLessThanOrEqual(p.tags[0] ?? 0);
  }
}

function choose(view: View, rand: () => number, turns: number, exercise: boolean): Action {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)] as T;
  const o = view.overlay;
  if (o) {
    if (o.kind === "message") return { type: "dismiss", overlayId: o.id };
    if (o.kind === "confirm") return { type: "confirm", overlayId: o.id, accepted: rand() < 0.6 };
    if (o.kind === "textInput") {
      if (rand() < 0.08) return { type: "submitText", overlayId: o.id, text: null };
      let t = pick(AMOUNTS);
      if (o.id === "city-hall:chainname")
        t = pick(["Stiff Competition", "The Cold Hands", "", "Box & Sons"]);
      if (o.id.endsWith(":getname")) t = pick(PLAYER_NAMES).slice(0, 4);
      return { type: "submitText", overlayId: o.id, text: t.slice(0, o.maxLength) };
    }
    return {
      type: "pickPlayer",
      overlayId: o.id,
      playerId: o.players.length === 0 || rand() < 0.08 ? null : pick(o.players).id,
    };
  }
  if (view.map && view.map.length > 0) {
    if (rand() < 0.25) return { type: "visit", placeId: "funeral-home" };
    if (exercise && rand() < 0.8) return { type: "visit", placeId: pick(PLACES) };
    return { type: "visit", placeId: pick(view.map).id };
  }
  if (view.scene === "cafe" && rand() < 0.3) return { type: "chat", text: "hello" };
  const ids = view.buttons.filter((b) => b.enabled !== false).map((b) => b.id);
  if (ids.length === 0) return { type: "exit" };
  if (ids.includes("neg:done")) {
    if (rand() < 0.25) return { type: "press", buttonId: "neg:done" };
    if (ids.includes("neg:bless") && rand() < 0.5) return { type: "press", buttonId: "neg:bless" };
    return { type: "press", buttonId: pick(ids) };
  }
  if (ids.includes("desk:wait")) {
    if (turns <= 0) return { type: "press", buttonId: rand() < 0.5 ? "go:map" : "desk:quit" };
    if (rand() < (exercise ? 0.35 : 0.6)) return { type: "press", buttonId: "desk:wait" };
    if (exercise && rand() < 0.7) return { type: "press", buttonId: "go:map" };
    return { type: "press", buttonId: pick(ids.filter((id) => id !== "desk:quit")) };
  }
  // In a place: mostly stay and act, sometimes leave.
  const stay = ids.filter((id) => id !== "go:map" && id !== "desk:quit");
  if (stay.length > 0 && rand() < (exercise ? 0.85 : 0.7))
    return { type: "press", buttonId: pick(stay) };
  return { type: "press", buttonId: pick(ids) };
}

export function townWalk(
  town0: TownState,
  ctx: EngineContext,
  options: TownWalkOptions,
): TownWalkResult {
  let town = JSON.parse(JSON.stringify(town0)) as TownState;
  options.setup?.(town);
  const used = new Map<string, number>();
  const rejected: string[] = [];
  const cap = options.cap ?? 220;
  let actions = 0;
  let staked = 0;
  let returned = 0;
  for (let d = 0; d < options.days; d++) {
    const rand = policyRng(options.seed * 7919 + d * 31 + 5);
    for (let id = 0; id < options.players; id++) {
      if (!town.players[id]?.active) continue;
      let r: StepResult = enterGame(town, id, ctx);
      town = r.town;
      let view = r.view;
      for (let n = 0; n < cap; n++) {
        checkTownInvariants(town);
        checkOffers(town, id, view);
        options.onView?.(view, town, id);
        if (actions % 11 === 0 && !view.overlay) {
          for (const b of view.buttons) {
            if (b.enabled === false) continue;
            const g = step(town, id, { type: "press", buttonId: b.id }, ctx);
            if (g.rejected) rejected.push(`${b.id} on ${view.title}: ${g.rejected}`);
          }
        }
        const action = choose(view, rand, town.players[id]?.turns ?? 0, options.exercise ?? false);
        const before = wealth(town);
        r = step(town, id, action, ctx);
        if (actions % 17 === 0) {
          const copy = JSON.parse(JSON.stringify(town)) as TownState;
          const again = step(copy, id, action, ctx);
          expect(JSON.stringify(again.town), "save round trip").toBe(JSON.stringify(r.town));
          expect(JSON.stringify(again.view)).toBe(JSON.stringify(r.view));
        }
        if (r.rejected) rejected.push(`${JSON.stringify(action)} on ${view.title}: ${r.rejected}`);
        else if (conserving(action)) {
          const after = wealth(r.town);
          const what = `${JSON.stringify(action)} day ${town.day}`;
          expect(after.money, `money minted by ${what}`).toBeLessThanOrEqual(before.money);
          expect(after.tags, `tags minted by ${what}`).toBeLessThanOrEqual(before.tags);
          expect(after.bp, `BP minted by ${what}`).toBeLessThanOrEqual(before.bp);
        }
        if (
          !r.rejected &&
          action.type === "press" &&
          /^reaper-club:(draw|slots|shots):\d+$/.test(action.buttonId)
        ) {
          const stake = Number(action.buttonId.split(":")[2]);
          staked += stake;
          returned += (r.town.players[id]?.money ?? 0) - (town.players[id]?.money ?? 0) + stake;
        }
        used.set(key(action), (used.get(key(action)) ?? 0) + 1);
        actions++;
        town = r.town;
        view = r.view;
        if (action.type === "exit" || !town.sessions[String(id)]) break;
      }
      if (town.sessions[String(id)]) town = step(town, id, { type: "exit" }, ctx).town;
      checkTownInvariants(town);
    }
    const before = wealth(town);
    town = runDailyMaintenance(town, ctx).town;
    checkTownInvariants(town);
    expect(wealth(town).tags, "tags minted at midnight").toBeLessThanOrEqual(
      before.tags + 4 * town.players.length * 2,
    );
  }
  return { town, used, actions, rejected, staked, returned };
}
