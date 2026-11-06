import type { Action, View } from "@fq/protocol";
import {
  type ClassicRules,
  classicContext,
  createPlayer,
  createTown,
  type EngineContext,
  type GameSettings,
  type StepResult,
  step,
  type TownState,
} from "../../src/index.js";
import { legacyContent } from "./legacyContent.js";

export function context(rules?: ClassicRules, now = 1_000_000): EngineContext {
  return classicContext(legacyContent(), { ...(rules ? { rules } : {}), now });
}

export const PLAYER_NAMES = ["Skelly", "Morticia", "Digby", "Graves", "Ashley", "Coffin Ed"];

/** A town with `count` players created (and still logged on). */
export function makeTown(
  seed: number,
  count: number,
  options: { ctx?: EngineContext; settings?: Partial<GameSettings> } = {},
): { town: TownState; ctx: EngineContext; views: View[] } {
  const ctx = options.ctx ?? context();
  let town = createTown(
    { seed, ...(options.settings ? { settings: options.settings } : {}) },
    ctx,
  ).town;
  const views: View[] = [];
  for (let i = 0; i < count; i++) {
    const name = PLAYER_NAMES[i] ?? `Player ${i}`;
    const result = createPlayer(
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
    if (!result.ok) throw new Error(`createPlayer failed: ${JSON.stringify(result.error)}`);
    town = result.town;
    views.push(result.view);
  }
  return { town, ctx, views };
}

export function press(
  town: TownState,
  id: number,
  buttonId: string,
  ctx: EngineContext,
): StepResult {
  const r = step(town, id, { type: "press", buttonId }, ctx);
  if (r.rejected) throw new Error(`press ${buttonId} rejected: ${r.rejected}`);
  return r;
}

export function act(town: TownState, id: number, action: Action, ctx: EngineContext): StepResult {
  const r = step(town, id, action, ctx);
  if (r.rejected) throw new Error(`${JSON.stringify(action)} rejected: ${r.rejected}`);
  return r;
}

export function buttonIds(view: View): string[] {
  return view.buttons.map((b) => b.id);
}

/** A small deterministic generator for test policies (not the game's RNG). */
export function policyRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
