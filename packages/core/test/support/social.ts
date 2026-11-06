import type { Action, View } from "@fq/protocol";
import {
  CLASSIC_RULES,
  ClassicRandom,
  type ClassicRules,
  type EngineContext,
  type GameSettings,
  type PlayerState,
  type StepResult,
  step,
  type TownState,
  type Turn,
} from "../../src/index.js";
import { act, context, makeTown, press } from "./harness.js";

export { act, press };

/**
 * A town with `count` players, every one of them logged off except those in
 * `online`, which are left at their desk. Players start with plots 0 and the
 * starting 10 HP / 3 strength.
 */
export function socialTown(
  seed: number,
  count: number,
  options: { online?: number[]; rules?: ClassicRules; settings?: Partial<GameSettings> } = {},
): { town: TownState; ctx: EngineContext } {
  const ctx = context(options.rules);
  const made = makeTown(seed, count, {
    ctx,
    settings: { normalOdds: 0, luckOdds: 0, scriptOdds: 0, ...options.settings },
  });
  let town = made.town;
  const online = options.online ?? [0];
  for (let id = 0; id < count; id++) {
    if (online.includes(id)) town = toDesk(town, id, ctx);
    else town = step(town, id, { type: "exit" }, ctx).town;
  }
  return { town, ctx };
}

/** From the paper on log on: the morning coffee, then the desk. */
export function toDesk(town: TownState, id: number, ctx: EngineContext): TownState {
  let t = press(town, id, "go:desk", ctx).town;
  const v = t.sessions[String(id)]?.view;
  if (v?.buttons.some((b) => b.id === "go:desk") && !v.buttons.some((b) => b.id === "desk:wait")) {
    t = press(t, id, "go:desk", ctx).town;
  }
  return t;
}

/** Changes a player record in a copy of the town. */
export function edit(town: TownState, id: number, change: Partial<PlayerState>): TownState {
  const t = structuredClone(town);
  Object.assign(t.players[id] as PlayerState, change);
  return t;
}

/** Player `me` (at the desk) goes to the parlors row. */
export function toRow(town: TownState, me: number, ctx: EngineContext): StepResult {
  const map = press(town, me, "go:map", ctx);
  return act(map.town, me, { type: "visit", placeId: "competitors" }, ctx);
}

/** From the row: Visit, type the name, accept the first match. */
export function visit(town: TownState, me: number, name: string, ctx: EngineContext): StepResult {
  const prompt = press(town, me, "competitors:visit", ctx);
  const asked = act(
    prompt.town,
    me,
    { type: "submitText", overlayId: "competitors:getname", text: name },
    ctx,
  );
  return act(
    asked.town,
    me,
    { type: "confirm", overlayId: "competitors:namenext", accepted: true },
    ctx,
  );
}

/** Desk → row → visit `name` → Try Door (no padlock) → inside. */
export function breakIn(town: TownState, me: number, name: string, ctx: EngineContext): StepResult {
  const row = toRow(town, me, ctx);
  const front = visit(row.town, me, name, ctx);
  return press(front.town, me, "competitors:trydoor", ctx);
}

/** A stand-in turn for testing the pure helpers with a chosen stream. */
export function fakeTurn(seed: number, rules: ClassicRules = CLASSIC_RULES): Turn {
  const rng = new ClassicRandom(seed, seed);
  return { rng, rules } as unknown as Turn;
}

export function ids(view: View): string[] {
  return view.buttons.map((b) => b.id);
}

export function submit(overlayId: string, text: string | null): Action {
  return { type: "submitText", overlayId, text };
}

export function chatLines(r: StepResult): string[] {
  return (r.view.chat ?? []).map((c) => c.text.map((s) => s.text).join(""));
}

/** Text of the chat effects of a step, per recipient. */
export function chatFor(r: StepResult, id: number): string[] {
  return r.effects.flatMap((e) =>
    e.kind === "chat" && e.to.includes(id) ? [e.text.map((s) => s.text).join("")] : [],
  );
}
