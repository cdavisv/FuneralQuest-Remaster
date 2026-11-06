import type { Action, View } from "@fq/protocol";
import {
  type ClassicRules,
  createPlayer,
  createTown,
  type EngineContext,
  expandedContext,
  type GameSettings,
  type StepResult,
  step,
  type TownState,
} from "../../src/index.js";
import { PLAYER_NAMES } from "./harness.js";
import { legacyContent } from "./legacyContent.js";

/** An Expanded engine context over the legacy pack plus the starter content. */
export function xcontext(rules?: ClassicRules, now = 1_000_000): EngineContext {
  return expandedContext(legacyContent(), { ...(rules ? { rules } : {}), now });
}

/** An Expanded town with `count` players created (and still logged on). */
export function makeXTown(
  seed: number,
  count: number,
  options: { ctx?: EngineContext; settings?: Partial<GameSettings> } = {},
): { town: TownState; ctx: EngineContext; views: View[] } {
  const ctx = options.ctx ?? xcontext();
  let town = createTown(
    { seed, ...(options.settings ? { settings: options.settings } : {}) },
    ctx,
  ).town;
  const views: View[] = [];
  for (let i = 0; i < count; i++) {
    const name = PLAYER_NAMES[i] ?? `Player ${i}`;
    const r = createPlayer(
      town,
      {
        logon: `login${i}`,
        name,
        parlor: `${name} Rest`,
        password: "pw",
        passwordVerify: "pw",
        male: i % 2 === 0,
        email: `p${i}@example.com`,
      },
      ctx,
    );
    if (!r.ok) throw new Error(`createPlayer failed: ${JSON.stringify(r.error)}`);
    town = r.town;
    views.push(r.view);
  }
  return { town, ctx, views };
}

export function must(town: TownState, id: number, action: Action, ctx: EngineContext): StepResult {
  const r = step(town, id, action, ctx);
  if (r.rejected)
    throw new Error(
      `${JSON.stringify(action)} rejected: ${r.rejected}\n${JSON.stringify(r.view.buttons)}`,
    );
  return r;
}

export function pressX(
  town: TownState,
  id: number,
  buttonId: string,
  ctx: EngineContext,
): StepResult {
  return must(town, id, { type: "press", buttonId }, ctx);
}
