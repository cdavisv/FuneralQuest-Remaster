/**
 * Section 16.4, the duel's Shove: a shove that lands costs the shoved side
 * their next move. A scripted comparison through the engine: three duel
 * positions, each played to the end many times under "always Swing",
 * "always Shove" and "Yield now", scored by the challenger's mean BP change.
 * Each of the three moves is the best one somewhere; under the old rule
 * (`shoveCostsMove` off) Shove was never better than Swing.
 */
import { describe, expect, it } from "vitest";
import type { DuelState } from "../src/expanded/town/state.js";
import {
  type ClassicRules,
  type EngineContext,
  EXPANDED_RULES,
  step,
  type TownState,
} from "../src/index.js";
import { xcontext } from "./support/expanded.js";
import { act, edit, player, press, seat, visit, xtown } from "./support/xtown.js";

type Policy = "swing" | "shove" | "yield";

interface Position {
  name: string;
  me: { strength: number; hp: number };
  him: { strength: number; hp: number };
}

const POSITIONS: Position[] = [
  // An even fight, both fresh: trade blows.
  { name: "even and fresh", me: { strength: 10, hp: 40 }, him: { strength: 10, hp: 40 } },
  // Much stronger but one blow from the ground: deny the rival his move.
  { name: "strong but nearly beaten", me: { strength: 15, hp: 3 }, him: { strength: 5, hp: 20 } },
  // Weaker and beaten: cut the loss.
  { name: "weak and beaten", me: { strength: 5, hp: 3 }, him: { strength: 15, hp: 40 } },
];

function rulesWith(costsMove: boolean): ClassicRules {
  const r = structuredClone(EXPANDED_RULES);
  if (r.expanded) r.expanded.town.graveyard.duel.shoveCostsMove = costsMove;
  return r;
}

/** A duel started by player 0 against player 1, at equal BP, player 0 striking first. */
function started(ctx: EngineContext, pos: Position): TownState {
  const { town } = xtown({ players: 2 });
  const t = edit(town, (x) => {
    for (const p of x.players) {
      p.bp = 2500;
      p.turns = 20;
    }
    player(x, 0).plots = 10;
    player(x, 1).plots = 0;
    player(x, 0).strength = pos.me.strength;
    player(x, 1).strength = pos.him.strength;
  });
  let s = visit(seat(t, ctx, 0), "graveyard");
  s = press(s, "graveyard:duel");
  s = act(s, { type: "pickPlayer", overlayId: "graveyard:pick", playerId: 1 });
  return s.town;
}

/** Plays one duel from `base` with fresh randomness `k` under `policy`; the challenger's BP change. */
function play(
  ctx: EngineContext,
  base: TownState,
  pos: Position,
  policy: Policy,
  k: number,
): number {
  const town = JSON.parse(JSON.stringify(base)) as TownState;
  // Fresh draws: another town seed and no stored stream positions.
  town.seed = (base.seed * 7919 + k * 104729 + 17) >>> 0;
  town.streams = {};
  const session = town.sessions["0"];
  if (!session) throw new Error("no session");
  const d = session.sceneData as unknown as DuelState;
  session.sceneData = {
    ...d,
    me: pos.me.hp,
    him: pos.him.hp,
    meMax: Math.max(d.meMax, pos.me.hp),
    himMax: Math.max(d.himMax, pos.him.hp),
  };
  const before = town.players[0]?.bp ?? 0;
  let t = town;
  for (let i = 0; i < 80; i++) {
    const r = step(t, 0, { type: "press", buttonId: `graveyard:${policy}` }, ctx);
    if (r.rejected) throw new Error(r.rejected);
    t = r.town;
    if (r.view.buttons.some((b) => b.id === "go:graveyard")) break;
  }
  return (t.players[0]?.bp ?? 0) - before;
}

function compare(costsMove: boolean, samples: number): Record<string, Record<Policy, number>> {
  const ctx = xcontext(rulesWith(costsMove));
  const out: Record<string, Record<Policy, number>> = {};
  for (const pos of POSITIONS) {
    const base = started(ctx, pos);
    const mean = (policy: Policy): number => {
      let sum = 0;
      for (let k = 0; k < samples; k++) sum += play(ctx, base, pos, policy, k);
      return Math.round((sum / samples) * 10) / 10;
    };
    out[pos.name] = { swing: mean("swing"), shove: mean("shove"), yield: mean("yield") };
  }
  return out;
}

const best = (r: Record<Policy, number>): Policy =>
  (["swing", "shove", "yield"] as Policy[]).reduce((a, b) => (r[b] > r[a] ? b : a));

describe("16.4 Swing, Shove or Yield: each is the best move somewhere", () => {
  it("with the new rule each move wins one position; with the old one Shove never beats Swing", () => {
    const now = compare(true, 600);
    const old = compare(false, 600);
    // For the record (docs/expanded-rules.md 16.4 quotes these).
    console.log("shove costs a move:", JSON.stringify(now));
    console.log("old rule:", JSON.stringify(old));
    expect(best(now["even and fresh"] as Record<Policy, number>)).toBe("swing");
    expect(best(now["strong but nearly beaten"] as Record<Policy, number>)).toBe("shove");
    expect(best(now["weak and beaten"] as Record<Policy, number>)).toBe("yield");
    for (const r of Object.values(old)) expect(r.shove).toBeLessThanOrEqual(r.swing);
  });
});
