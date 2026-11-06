import type { Action, View } from "@fq/protocol";
import { expect } from "vitest";
import {
  type EngineContext,
  enterGame,
  type PlayerLife,
  type PlayerState,
  richTextToPlain,
  runDailyMaintenance,
  step,
  type TownState,
} from "../../src/index.js";
import { makeXTown, xcontext } from "./expanded.js";

/**
 * Helpers for the town tests (docs/expanded-rules.md sections 16 to 26):
 * any player acting, a place visit, round-trip checks and midnights.
 */

export interface Seat {
  town: TownState;
  ctx: EngineContext;
  view: View;
  id: number;
  /** Every text shown on the way to the desk by `seat` (the morning screen among them). */
  seen?: string;
}

export function act(s: Seat, action: Action): Seat {
  const r = step(s.town, s.id, action, s.ctx);
  if (r.rejected) {
    throw new Error(
      `${JSON.stringify(action)} rejected: ${r.rejected}\n${s.view.title}: ${s.view.buttons.map((b) => `${b.id}${b.enabled === false ? "(off)" : ""}`).join(" ")}`,
    );
  }
  return { ...s, town: r.town, view: r.view };
}

export function press(s: Seat, buttonId: string): Seat {
  return act(s, { type: "press", buttonId });
}

/** Presses on a copy of the save too, and checks the copy plays on identically (a save mid-flow). */
export function pressRT(s: Seat, buttonId: string): Seat {
  return actRT(s, { type: "press", buttonId });
}

export function actRT(s: Seat, action: Action): Seat {
  const copy = JSON.parse(JSON.stringify(s.town)) as TownState;
  const a = act(s, action);
  const b = act({ ...s, town: copy }, action);
  expect(JSON.stringify(b.town), "save round trip").toBe(JSON.stringify(a.town));
  expect(JSON.stringify(b.view)).toBe(JSON.stringify(a.view));
  return a;
}

/** Logs player `id` on and brings them to the desk (skipping the tour). */
export function seat(town: TownState, ctx: EngineContext, id: number): Seat {
  const r = enterGame(town, id, ctx);
  if (r.rejected) throw new Error(`enterGame ${id}: ${r.rejected}`);
  let s: Seat = { town: r.town, ctx, id, view: r.view };
  let seen = richTextToPlain(r.view.text);
  for (
    let i = 0;
    i < 10 && (s.view.overlay || !s.view.buttons.some((b) => b.id === "desk:wait"));
    i++
  ) {
    if (s.view.overlay?.kind === "message") {
      s = act(s, { type: "dismiss", overlayId: s.view.overlay.id });
      continue;
    }
    const next = ["tutorial:skip", "go:tutorial", "go:desk"].find((id) =>
      s.view.buttons.some((b) => b.id === id && b.enabled !== false),
    );
    if (!next) break;
    s = press(s, next);
    seen += `\n${richTextToPlain(s.view.text)}`;
  }
  return { ...s, seen };
}

/** From the desk to a place on the map. */
export function visit(s: Seat, placeId: string): Seat {
  const m = s.view.buttons.some((b) => b.id === "go:map") ? press(s, "go:map") : s;
  return act(m, { type: "visit", placeId });
}

/** Everybody logs off, then midnight. */
export function midnight(town: TownState, ctx: EngineContext, days = 1): TownState {
  let t = town;
  for (const key of Object.keys(t.sessions)) t = step(t, Number(key), { type: "exit" }, ctx).town;
  for (let i = 0; i < days; i++) t = runDailyMaintenance(t, ctx).town;
  return t;
}

/** A fresh Expanded town of `players` logged-off players with events off; `setup` edits it. */
export function xtown(
  options: {
    seed?: number;
    players?: number;
    setup?: (town: TownState) => void;
    settings?: Record<string, unknown>;
  } = {},
): { town: TownState; ctx: EngineContext } {
  const ctx = xcontext();
  const made = makeXTown(options.seed ?? 31, options.players ?? 3, {
    ctx,
    settings: { normalOdds: 0, luckOdds: 0, scriptOdds: 0, ...(options.settings ?? {}) },
  });
  let town = made.town;
  for (let id = 0; id < (options.players ?? 3); id++)
    town = step(town, id, { type: "exit" }, ctx).town;
  town = JSON.parse(JSON.stringify(town)) as TownState;
  for (const p of town.players) {
    if (p.expanded) p.expanded.tutorial = { step: 99, done: true };
  }
  options.setup?.(town);
  return { town, ctx };
}

/** Edits a town copy. */
export function edit(town: TownState, fn: (t: TownState) => void): TownState {
  const t = JSON.parse(JSON.stringify(town)) as TownState;
  fn(t);
  return t;
}

export function player(town: TownState, id: number): PlayerState {
  const p = town.players[id];
  if (!p) throw new Error(`No player ${id}`);
  return p;
}

export function lifeIn(town: TownState, id: number): PlayerLife {
  const l = player(town, id).expanded?.life;
  if (!l) throw new Error(`Player ${id} has no town record yet`);
  return l;
}

export function text(v: View): string {
  return richTextToPlain(v.text);
}

export function button(v: View, id: string) {
  return v.buttons.find((b) => b.id === id);
}

export function enabled(v: View, id: string): boolean {
  const b = button(v, id);
  return !!b && b.enabled !== false;
}

export function frontPage(town: TownState, day = town.day): string {
  return town.news[String(day)]?.front ?? "";
}

export function crimePage(town: TownState, day = town.day): string {
  return town.news[String(day)]?.crime ?? "";
}
