import type { Button, View } from "@fq/protocol";
import { addToNews } from "../../classic/news.js";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { button, legacy } from "../../engine/view.js";
import type { TownState } from "../../state/types.js";
import { fill, intToCash } from "../../text/format.js";
import type {
  ArcAppeal,
  ArcBeatDef,
  ArcTest,
  ExpandedTownContent,
  StoryArcDef,
} from "../content/townTypes.js";
import { applyReward, karmaMod, moneyMod, roll } from "../players.js";
import {
  activePlayers,
  applyModifiers,
  life,
  mayorName,
  mayorOf,
  off,
  spent,
  townLife,
  tr,
  xt,
} from "./life.js";
import type { ArcState } from "./state.js";

/**
 * Multi-day story arcs (docs/expanded-rules.md section 22.3). An arc is data
 * (`StoryArcDef`): beats that fire at midnight, each with a front-page story,
 * rule changes, rewards and appeals (buttons at a place that give money to
 * one side), and a `next` that is fixed or branches on what the town did
 * since the arc began. One arc runs at a time; each plays once a season.
 */

export const ARC = "arc";

export function arcDef(content: ExpandedTownContent, id: string): StoryArcDef | undefined {
  return content.arcs.find((a) => a.id === id);
}

export function beatDef(arc: StoryArcDef, id: string): ArcBeatDef | undefined {
  return arc.beats.find((b) => b.id === id);
}

/** Section 22.3: whether a branch test holds for the running arc. */
export function arcTest(town: TownState, state: ArcState, test: ArcTest): boolean {
  const players = Math.max(1, activePlayers(town).length);
  switch (test.kind) {
    case "sideLeads": {
      const other = test.side === "good" ? "evil" : "good";
      return state.counters[test.side] > state.counters[other];
    }
    case "walkouts":
      return state.counters.walkouts >= test.perPlayer * players;
    case "sales":
      return state.counters.sales >= test.perPlayer * players;
    case "hasMayor":
      return mayorOf(town) !== undefined;
    case "mayorKarma": {
      const m = mayorOf(town);
      return m !== undefined && m.karma >= test.atLeast;
    }
  }
}

/** The biggest giver to `side` (or to either side), or null. */
function topGiver(state: ArcState, side?: "good" | "evil"): number | null {
  let best: number | null = null;
  let most = 0;
  for (const [id, g] of Object.entries(state.given)) {
    const amount = side ? g[side] : g.good + g.evil;
    if (amount > most) {
      most = amount;
      best = Number(id);
    }
  }
  return best;
}

function fireBeat(turn: Turn, arc: StoryArcDef, beat: ArcBeatDef, state: ArcState): void {
  const town = turn.town;
  const leading = state.counters.good >= state.counters.evil ? "good" : "evil";
  const topId = topGiver(state);
  const top = topId === null ? "" : (town.players[topId]?.name ?? "");
  const vars = { mayor: mayorName(turn), top: top === "" ? "nobody" : top, side: leading };
  addToNews(town, `\`7${fill(beat.headline, vars)}\r\n`);
  addToNews(town, `\`^${fill(beat.story, vars)}\r\n\r\n`);
  applyModifiers(town, beat.modifiers, beat.days ?? 1, `arc:${arc.id}:${beat.id}`);
  for (const r of beat.rewards ?? []) {
    let who: number[] = [];
    if (r.to === "all") who = activePlayers(town).map((p) => p.id);
    else if (r.to === "mayor") who = mayorOf(town) ? [mayorOf(town)?.id ?? -1] : [];
    else if (r.to === "top") {
      const id = topGiver(state, leading);
      who = id === null ? [] : [id];
    } else {
      const side = r.to;
      who = Object.entries(state.given)
        .filter(([, g]) => g[side] > 0)
        .map(([id]) => Number(id));
    }
    for (const id of who) {
      const p = town.players[id];
      if (p?.active && p.expanded) applyReward(turn, p, r.reward);
    }
  }
  state.beat = beat.id;
  state.beatDay = town.day;
}

/** The next beat id after `beat`, or null when the arc ends. */
export function nextBeat(town: TownState, state: ArcState, beat: ArcBeatDef): string | null {
  if (beat.next === undefined) return null;
  if (typeof beat.next === "string") return beat.next;
  return arcTest(town, state, beat.next.test) ? beat.next.ifTrue : beat.next.ifFalse;
}

function endArc(town: TownState, state: ArcState, beat: ArcBeatDef): void {
  const l = townLife(town);
  l.arcsDone.push({ id: state.id, ending: beat.ending ?? beat.id });
  l.arc = null;
}

/** Starts `arc` today (tests and the midnight hook). */
export function startArc(turn: Turn, arc: StoryArcDef): void {
  const l = townLife(turn.town);
  const state: ArcState = {
    id: arc.id,
    beat: arc.start,
    beatDay: turn.town.day,
    started: turn.town.day,
    counters: { good: 0, evil: 0, walkouts: 0, sales: 0 },
    given: {},
  };
  l.arc = state;
  const first = beatDef(arc, arc.start);
  if (!first) throw new Error(`Arc ${arc.id} has no beat ${arc.start}`);
  fireBeat(turn, arc, first, state);
  if (first.next === undefined) endArc(turn.town, state, first);
}

/** Section 22.3, at midnight: fire the next beat when it is due, or maybe start an arc. */
export function advanceArcs(turn: Turn): void {
  const town = turn.town;
  const content = xt(turn);
  const l = townLife(town);
  const running = l.arc;
  if (running) {
    const arc = arcDef(content, running.id);
    const beat = arc ? beatDef(arc, running.beat) : undefined;
    if (!arc || !beat) {
      l.arc = null;
      return;
    }
    if (town.day < running.beatDay + (beat.after ?? 3)) return;
    const nextId = nextBeat(town, running, beat);
    const next = nextId ? beatDef(arc, nextId) : undefined;
    if (!next) {
      endArc(town, running, beat);
      return;
    }
    fireBeat(turn, arc, next, running);
    if (next.next === undefined) endArc(town, running, next);
    return;
  }
  const done = new Set(l.arcsDone.map((d) => d.id));
  const open = content.arcs.filter(
    (a) => !done.has(a.id) && a.earliest <= town.day && town.day <= a.latest,
  );
  if (open.length === 0) return;
  const forced = open.find((a) => a.latest === town.day);
  const rng = turn.rng;
  let arc = forced;
  if (!arc && roll(rng) < tr(turn).world.arcChance) {
    const total = open.reduce((s, a) => s + (a.weight ?? 1), 0);
    let r = roll(rng) * total;
    for (const a of open) {
      r -= a.weight ?? 1;
      if (r < 0) {
        arc = a;
        break;
      }
    }
    arc ??= open[open.length - 1];
  }
  if (arc) startArc(turn, arc);
}

/** Section 22.3: counts a sale or walkout for the arcs. */
export function tally(town: TownState, key: "walkouts" | "sales"): void {
  if (!town.expanded) return;
  const l = townLife(town);
  l.tallies[key]++;
  if (l.arc) l.arc.counters[key]++;
}

/** The appeals of the running arc's latest beat at `place`. */
export function liveAppeals(turn: Turn, place: ArcAppeal["place"]): ArcAppeal[] {
  const state = turn.town.expanded?.life?.arc;
  if (!state) return [];
  const arc = arcDef(xt(turn), state.id);
  const beat = arc ? beatDef(arc, state.beat) : undefined;
  return (beat?.appeals ?? []).filter((a) => a.place === place);
}

/** Buttons for the running arc's appeals at a place (`arc:give:<place>:<n>`). */
export function appealButtons(turn: Turn, place: ArcAppeal["place"]): Button[] {
  return liveAppeals(turn, place).map((a, i) => {
    const b: Button = {
      ...button(`${ARC}:give:${place}:${i}`, a.label),
      group: "more",
      detail: `$${intToCash(a.amount)}`,
    };
    return turn.player.money < a.amount ? off(b, xt(turn).text.hints.notEnoughCash) : b;
  });
}

/** Presses on appeal buttons; the place is shown again with the thanks on top. */
export const arcModule: LocationModule = {
  id: ARC,
  press(turn, command) {
    const [verb, place, index] = command.split(":");
    if (verb !== "give" || !place) throw new Error(`Unknown arc command ${command}`);
    const appeal = liveAppeals(turn, place as ArcAppeal["place"])[Number(index)];
    const state = turn.town.expanded?.life?.arc;
    if (!appeal || !state) throw new Error("That appeal is over");
    const p = turn.player;
    if (p.money < appeal.amount) throw new Error("Not enough cash");
    moneyMod(p, -appeal.amount);
    if (appeal.karma) karmaMod(p, appeal.karma);
    spent(turn, `arc:${appeal.side}`, appeal.amount);
    life(turn);
    state.counters[appeal.side] += appeal.amount;
    const g = state.given[String(p.id)] ?? { good: 0, evil: 0 };
    g[appeal.side] += appeal.amount;
    state.given[String(p.id)] = g;
    const module = turn.registry.module(place);
    const view: View | undefined = module?.enter?.(turn, undefined);
    if (!view) throw new Error(`No place ${place}`);
    view.text = [
      ...legacy(`${fill(appeal.thanks, { money: intToCash(appeal.amount) })}\n\n`),
      ...view.text,
    ];
    return view;
  },
};
