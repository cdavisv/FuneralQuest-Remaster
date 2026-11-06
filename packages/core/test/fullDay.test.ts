import type { View } from "@fq/protocol";
import { describe, expect, it } from "vitest";
import { step, type TownState } from "../src/index.js";
import { buttonIds, makeTown, policyRng } from "./support/harness.js";

const NEGOTIATION = ["neg:guilt", "neg:sympathy", "neg:hard", "neg:soft"];

function checkInvariants(town: TownState): void {
  for (const p of town.players) {
    expect(p.turns).toBeGreaterThanOrEqual(0);
    for (const t of p.tags) expect(t).toBeGreaterThanOrEqual(0);
    expect(p.bp).toBeGreaterThanOrEqual(0);
    expect(p.bpToday).toBeGreaterThanOrEqual(0);
    expect(p.luck).toBeGreaterThanOrEqual(1);
    expect(p.luck).toBeLessThanOrEqual(100);
  }
}

/** Every button on the view is accepted (checked on a copy), and made-up ones are not. */
function checkGuard(
  town: TownState,
  id: number,
  view: View,
  ctx: Parameters<typeof step>[3],
): void {
  for (const b of view.buttons) {
    const r = step(town, id, { type: "press", buttonId: b.id }, ctx);
    expect(r.rejected, `${b.id} on ${view.scene}`).toBeUndefined();
  }
  for (const bogus of ["desk:wait", "neg:done", "go:bank", "script:1", "nope"]) {
    if (buttonIds(view).includes(bogus)) continue;
    const r = step(town, id, { type: "press", buttonId: bogus }, ctx);
    expect(r.rejected, bogus).toBeDefined();
    expect(r.town).toBe(town);
  }
  if (!view.map) {
    expect(step(town, id, { type: "visit", placeId: "bank" }, ctx).rejected).toBeDefined();
  }
}

/**
 * Drives player 0 through log on, the paper, the desk and every turn of a day
 * with a simple policy, checking invariants after every action.
 */
function playDay(seed: number): { town: TownState; actions: number; scenes: Set<string> } {
  const { town: start, ctx, views } = makeTown(seed, 3);
  let town = start;
  let view = views[0] as View;
  const me = 0;
  // Players 1 and 2 log off so they can be targets of walkouts and arson.
  for (const id of [1, 2]) town = step(town, id, { type: "exit" }, ctx).town;
  view = town.sessions["0"]?.view as View;
  expect(view.scene).toBe("news");
  const rand = policyRng(seed);
  const scenes = new Set<string>();
  let actions = 0;
  let negotiationSteps = 0;
  for (; actions < 2000; actions++) {
    checkInvariants(town);
    if (actions % 5 === 0) checkGuard(town, me, view, ctx);
    scenes.add(view.scene);
    const ids = buttonIds(view);
    let result: ReturnType<typeof step>;
    if (view.overlay?.kind === "playerPicker") {
      const choices = view.overlay.players;
      const pick = choices[Math.floor(rand() * choices.length)];
      result = step(
        town,
        me,
        { type: "pickPlayer", overlayId: view.overlay.id, playerId: pick?.id ?? null },
        ctx,
      );
    } else if (ids.includes("neg:done")) {
      negotiationSteps++;
      const id =
        negotiationSteps > 6 || rand() < 0.2
          ? "neg:done"
          : (NEGOTIATION[Math.floor(rand() * 4)] as string);
      result = step(town, me, { type: "press", buttonId: id }, ctx);
    } else if (ids.includes("desk:wait")) {
      negotiationSteps = 0;
      if (town.players[me]?.turns === 0) {
        // Out of turns: one more click shows the closed sign, then log off.
        const closed = step(town, me, { type: "press", buttonId: "desk:wait" }, ctx);
        expect(closed.rejected).toBeUndefined();
        expect(closed.view.picture?.fg).toBe("closed");
        town = step(closed.town, me, { type: "press", buttonId: "desk:quit" }, ctx).town;
        expect(town.sessions["0"]).toBeUndefined();
        return { town, actions, scenes };
      }
      result = step(town, me, { type: "press", buttonId: "desk:wait" }, ctx);
    } else if (ids.includes("script:1")) {
      result = step(
        town,
        me,
        { type: "press", buttonId: rand() < 0.7 ? "script:1" : (ids.at(-1) as string) },
        ctx,
      );
    } else if (ids.length > 0) {
      const id = ids.includes("go:desk")
        ? "go:desk"
        : (ids[Math.floor(rand() * ids.length)] as string);
      result = step(town, me, { type: "press", buttonId: id }, ctx);
    } else {
      throw new Error(`Stuck on ${view.scene}: ${JSON.stringify(view)}`);
    }
    expect(result.rejected, JSON.stringify(view.buttons)).toBeUndefined();
    town = result.town;
    view = result.view;
  }
  throw new Error("The day never ended");
}

describe("a full day, headless, across seeds", () => {
  it("runs from log on to out-of-turns with invariants holding", () => {
    let totalBp = 0;
    const scenes = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const { town, scenes: seen } = playDay(seed * 7919);
      const me = town.players[0];
      expect(me?.turns).toBe(0);
      expect(me?.dayLastLoggedOn).toBe(town.day);
      totalBp += me?.bp ?? 0;
      for (const s of seen) scenes.add(s);
    }
    expect(totalBp).toBeGreaterThan(0);
    expect([...scenes].sort()).toEqual(["desk", "location", "news"]);
  });

  it("is deterministic for a seed", () => {
    expect(JSON.stringify(playDay(4242).town)).toBe(JSON.stringify(playDay(4242).town));
  });
});
