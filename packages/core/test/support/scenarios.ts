import type { View } from "@fq/protocol";
import { expect } from "vitest";
import { type EngineContext, step, type TownState } from "../../src/index.js";
import { buttonIds, makeTown, press } from "./harness.js";

/** Drives player 0 to a negotiation (Wait for Customer until one arrives). */
export function openNegotiation(
  seed: number,
  players = 2,
): { town: TownState; ctx: EngineContext; view: View } {
  const made = makeTown(seed, players, { settings: { normalOdds: 0, luckOdds: 0, scriptOdds: 0 } });
  const ctx = made.ctx;
  let town = press(made.town, 0, "go:desk", ctx).town; // morning coffee
  town = press(town, 0, "go:desk", ctx).town; // desk
  const r = press(town, 0, "desk:wait", ctx);
  expect(buttonIds(r.view)).toEqual([
    "neg:guilt",
    "neg:sympathy",
    "neg:hard",
    "neg:soft",
    "neg:done",
  ]);
  return { town: r.town, ctx, view: r.view };
}

/** Player 0 at the desk, with the next Wait guaranteed to be a script event. */
export function atDesk(seed: number, players = 3): { town: TownState; ctx: EngineContext } {
  const made = makeTown(seed, players, { settings: { normalOdds: 0, luckOdds: 0, scriptOdds: 1 } });
  let town = made.town;
  for (let id = 1; id < players; id++) town = step(town, id, { type: "exit" }, made.ctx).town;
  town = press(press(town, 0, "go:desk", made.ctx).town, 0, "go:desk", made.ctx).town;
  return { town, ctx: made.ctx };
}

/** Finds a seed whose first script event is arson (or the bonus tag). */
export function scriptEvent(kind: "arson" | "tag"): {
  town: TownState;
  ctx: EngineContext;
  view: View;
  seed: number;
} {
  for (let seed = 1; seed < 200; seed++) {
    const { town, ctx } = atDesk(seed);
    const r = press(town, 0, "desk:wait", ctx);
    const isArson = buttonIds(r.view).includes("script:1");
    if (isArson === (kind === "arson")) return { town: r.town, ctx, view: r.view, seed };
  }
  throw new Error("no seed");
}
