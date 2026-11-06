import type { View } from "@fq/protocol";
import {
  type ClassicRules,
  type CustomerState,
  type EngineContext,
  type ExpandedCustomer,
  type GameSettings,
  step,
  type TownState,
} from "../../src/index.js";
import { makeXTown, pressX, xcontext } from "./expanded.js";

export interface XPlaced {
  town: TownState;
  ctx: EngineContext;
  view: View;
}

/**
 * Player 0 at the Expanded desk on day 1 with the tour skipped, the others
 * logged off. Random events, risks and scripts are off unless `settings` says
 * otherwise; `setup` edits the town first.
 */
export function atXDesk(
  options: {
    seed?: number;
    players?: number;
    rules?: ClassicRules;
    settings?: Partial<GameSettings>;
    setup?: (town: TownState) => void;
  } = {},
): XPlaced {
  const ctx = xcontext(options.rules);
  const players = options.players ?? 3;
  const made = makeXTown(options.seed ?? 21, players, {
    ctx,
    settings: { normalOdds: 0, luckOdds: 0, scriptOdds: 0, ...options.settings },
  });
  let town = made.town;
  for (let id = 1; id < players; id++) town = step(town, id, { type: "exit" }, ctx).town;
  options.setup?.(town);
  let r = pressX(town, 0, "go:desk", ctx);
  r = pressX(r.town, 0, "go:tutorial", ctx);
  r = pressX(r.town, 0, "tutorial:skip", ctx);
  return { town: r.town, ctx, view: r.view };
}

/** Presses on from a placed state. */
export function px(p: XPlaced, buttonId: string): XPlaced {
  const r = pressX(p.town, 0, buttonId, p.ctx);
  return { town: r.town, ctx: p.ctx, view: r.view };
}

/** The live customer of player 0 (a reference into `p.town`). */
export function cust(p: XPlaced): CustomerState & { expanded: ExpandedCustomer } {
  const c = p.town.sessions["0"]?.customer;
  if (!c?.expanded) throw new Error("No Expanded customer");
  return c as CustomerState & { expanded: ExpandedCustomer };
}

/** Waits until a negotiation opens (events are off), then lets `edit` set the customer up. */
export function meet(
  p: XPlaced,
  edit?: (c: CustomerState & { expanded: ExpandedCustomer }) => void,
): XPlaced {
  let q = px(p, "desk:wait");
  for (let i = 0; i < 20 && !q.view.buttons.some((b) => b.id.startsWith("neg:")); i++) {
    q = px(
      { ...q, view: q.view },
      q.view.buttons.find((b) => b.id === "go:desk") ? "go:desk" : "desk:wait",
    );
    if (q.view.buttons.some((b) => b.id === "desk:wait")) q = px(q, "desk:wait");
  }
  if (edit) {
    const town = JSON.parse(JSON.stringify(q.town)) as TownState;
    const placed = { ...q, town };
    edit(cust(placed));
    // Re-render the screen the edits apply to by going back from the hand (always allowed here).
    return placed;
  }
  return q;
}

export function ids(view: View): string[] {
  return view.buttons.map((b) => b.id);
}

export function enabledIds(view: View): string[] {
  return view.buttons.filter((b) => b.enabled !== false).map((b) => b.id);
}

export function btn(view: View, id: string) {
  return view.buttons.find((b) => b.id === id);
}
