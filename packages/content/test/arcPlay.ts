/**
 * Helpers shared by the town engine tests: a town of the Expanded pack, and a story arc driven to
 * each of its endings by forcing its branch tests (docs/expanded-rules.md 22.3).
 */
import {
  type ArcBeatDef,
  type ArcTest,
  arcTest,
  type EngineContext,
  expandedContext,
  type StoryArcDef,
  startArc,
  step,
  type TownState,
  Turn,
} from "@fq/core";
import { expect } from "vitest";
import { makeXTown } from "../../core/test/support/expanded.js";
import { edit, frontPage, midnight } from "../../core/test/support/xtown.js";
import { expandedPack } from "../src/index.js";

export const ctx: EngineContext = expandedContext(expandedPack, { now: 1_000_000 });
const UNFILLED = /\{[A-Za-z]+\}/;

/** A fresh town of logged-off players with the tour done (core's `xtown`, with this pack). */
export function xtown(players = 3, seed = 31): TownState {
  const made = makeXTown(seed, players, {
    ctx,
    settings: { normalOdds: 0, luckOdds: 0, scriptOdds: 0 },
  });
  let town = made.town;
  for (let id = 0; id < players; id++) town = step(town, id, { type: "exit" }, ctx).town;
  return edit(town, (t) => {
    for (const p of t.players) {
      if (p.expanded) p.expanded.tutorial = { step: 99, done: true };
      p.money = 60_000;
      p.bp = 500;
      p.tags = [20, 2, 2];
    }
  });
}

/** Makes `test` come out `want` for the running arc (counters, givers, the mayor). */
export function force(t: TownState, test: ArcTest, want: boolean, sides: Set<string>): void {
  const life = t.expanded?.life;
  const state = life?.arc;
  if (!life || !state) throw new Error("no arc running");
  const players = t.players.filter((p) => p.active).length;
  switch (test.kind) {
    case "sideLeads": {
      const other = test.side === "good" ? "evil" : "good";
      const mine = want ? 5000 : 0;
      const theirs = want ? 0 : sides.has(other) ? 5000 : 0;
      state.counters[test.side] = mine;
      state.counters[other] = theirs;
      state.given = {
        "0": { good: 0, evil: 0, [test.side]: mine },
        "1": { good: 0, evil: 0, [other]: theirs },
      } as typeof state.given;
      break;
    }
    case "walkouts":
    case "sales":
      state.counters[test.kind] = want ? Math.ceil(test.perPlayer * players) : 0;
      break;
    case "hasMayor":
      life.election.mayor = want ? 0 : null;
      break;
    case "mayorKarma": {
      life.election.mayor = 0;
      const p = t.players[0];
      if (p) p.karma = want ? test.atLeast : test.atLeast - 1;
      break;
    }
  }
}

export function playToEnding(def: StoryArcDef, path: ArcBeatDef[]): TownState {
  const sides = new Set(def.beats.flatMap((b) => (b.appeals ?? []).map((a) => a.side)));
  // Started on the town's own day: moving the clock would close the parlors of absent players.
  let town = xtown(3);
  const turn = new Turn(town, ctx, -1);
  startArc(turn, def);
  turn.commit();
  town = turn.town;
  expect(frontPage(town)).toContain(path[0]?.headline);
  for (let i = 0; i < path.length - 1; i++) {
    const here = path[i] as ArcBeatDef;
    const there = path[i + 1] as ArcBeatDef;
    for (let n = 0; n < 12 && town.expanded?.life?.arc?.beat === here.id; n++) {
      if (typeof here.next === "object") {
        const test = here.next.test;
        const want = here.next.ifTrue === there.id;
        town = edit(town, (t) => force(t, test, want, sides));
        const state = town.expanded?.life?.arc;
        if (state) expect(arcTest(town, state, test)).toBe(want);
      }
      town = midnight(town, ctx);
    }
    if (there.next !== undefined) expect(town.expanded?.life?.arc?.beat, def.id).toBe(there.id);
    const page = frontPage(town);
    expect(page, `${def.id}: ${there.id}`).toContain(there.headline);
    expect(page).not.toMatch(UNFILLED);
  }
  return town;
}
