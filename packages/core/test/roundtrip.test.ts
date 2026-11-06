import type { Action } from "@fq/protocol";
import { describe, expect, it } from "vitest";
import { type EngineContext, step, type TownState } from "../src/index.js";
import { openNegotiation, scriptEvent } from "./support/scenarios.js";

function run(
  town: TownState,
  ctx: EngineContext,
  actions: Action[],
  breakAt: number | null,
): string {
  let t = town;
  const views: string[] = [];
  actions.forEach((action, i) => {
    if (i === breakAt) t = JSON.parse(JSON.stringify(t)) as TownState;
    const r = step(t, 0, action, ctx);
    expect(r.rejected).toBeUndefined();
    t = r.town;
    views.push(JSON.stringify(r.view));
  });
  return JSON.stringify({ t, views });
}

const press = (buttonId: string): Action => ({ type: "press", buttonId });

describe("JSON round trips", () => {
  it("a town saved mid-negotiation continues exactly like an uninterrupted run", () => {
    const { town, ctx } = openNegotiation(77);
    const actions = [press("neg:sympathy"), press("neg:soft"), press("neg:guilt")];
    const straight = run(town, ctx, actions, null);
    for (let k = 0; k < actions.length; k++) expect(run(town, ctx, actions, k)).toBe(straight);
    // Restoring before the first action too.
    expect(run(JSON.parse(JSON.stringify(town)) as TownState, ctx, actions, null)).toBe(straight);
  });

  it("a town saved mid-script (arson, waiting on the player picker) continues exactly", () => {
    const found = scriptEvent("arson");
    const t = structuredClone(found.town);
    (t.players[0] as { tags: number[] }).tags = [0, 0, 20];
    Object.assign(t.players[1] as object, { plots: 60, tags: [3, 0, 0] });
    const actions: Action[] = [
      press("script:1"),
      { type: "pickPlayer", overlayId: "script:getname", playerId: 0 },
      press("script:1"),
      { type: "pickPlayer", overlayId: "script:getname", playerId: 1 },
      press("go:desk"),
    ];
    const straight = run(t, found.ctx, actions, null);
    for (let k = 1; k < actions.length; k++) expect(run(t, found.ctx, actions, k)).toBe(straight);
    expect(straight).toContain("A fire engulfs");
  });
});
