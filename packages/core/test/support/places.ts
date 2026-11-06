import type { Action, View } from "@fq/protocol";
import {
  type ClassicRules,
  type Effect,
  type EngineContext,
  type GameSettings,
  richTextToPlain,
  step,
  type TownState,
} from "../../src/index.js";
import { act, buttonIds, context, makeTown, press } from "./harness.js";

export interface Placed {
  town: TownState;
  ctx: EngineContext;
  view: View;
  /** Effects of the last action. */
  effects: Effect[];
}

interface PlaceOptions {
  seed?: number;
  players?: number;
  rules?: ClassicRules;
  settings?: Partial<GameSettings>;
  setup?: (town: TownState) => void;
}

/** Player 0 at the desk on day 1, the others logged off; `setup` edits a private copy first. */
export function atDesk(options: PlaceOptions = {}): Placed {
  const ctx = options.rules ? context(options.rules) : context();
  const players = options.players ?? 3;
  const made = makeTown(options.seed ?? 11, players, {
    ctx,
    settings: { normalOdds: 0, luckOdds: 0, scriptOdds: 0, ...options.settings },
  });
  let town = made.town;
  for (let id = 1; id < players; id++) town = step(town, id, { type: "exit" }, ctx).town;
  town = press(town, 0, "go:desk", ctx).town; // morning coffee
  const r = press(town, 0, "go:desk", ctx); // desk
  town = structuredClone(r.town);
  options.setup?.(town);
  return { town, ctx, view: r.view, effects: [] };
}

/**
 * Player 0 standing in `placeId` on day 1, the others logged off. `setup`
 * edits a private copy of the town (tags, luck and so on) after the player
 * reached the desk and before they walk to the place.
 */
export function atPlace(placeId: string, options: PlaceOptions = {}): Placed {
  const desk = atDesk(options);
  const map = press(desk.town, 0, "go:map", desk.ctx);
  const r = act(map.town, 0, { type: "visit", placeId }, desk.ctx);
  return { town: r.town, ctx: desk.ctx, view: r.view, effects: r.effects };
}

/** Presses a button and returns the new state. */
export function pressOn(p: Placed, buttonId: string): Placed {
  const r = press(p.town, 0, buttonId, p.ctx);
  return { town: r.town, ctx: p.ctx, view: r.view, effects: r.effects };
}

/** Sends any action and returns the new state. */
export function actOn(p: Placed, action: Action): Placed {
  const r = act(p.town, 0, action, p.ctx);
  return { town: r.town, ctx: p.ctx, view: r.view, effects: r.effects };
}

export function submit(p: Placed, text: string | null): Placed {
  const overlay = p.view.overlay;
  if (overlay?.kind !== "textInput") throw new Error("no text prompt");
  return actOn(p, { type: "submitText", overlayId: overlay.id, text });
}

export function pick(p: Placed, playerId: number | null): Placed {
  const overlay = p.view.overlay;
  if (overlay?.kind !== "playerPicker") throw new Error("no player picker");
  return actOn(p, { type: "pickPlayer", overlayId: overlay.id, playerId });
}

export const plain = (view: View): string => richTextToPlain(view.text);

/** A JSON round trip of the whole town (a save and a load). */
export function reload(p: Placed): Placed {
  return { ...p, town: JSON.parse(JSON.stringify(p.town)) as TownState };
}

export function me(p: Placed) {
  const player = p.town.players[0];
  if (!player) throw new Error("no player 0");
  return player;
}

export { buttonIds };
