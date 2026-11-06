import {
  type ContentPack,
  classicContext,
  enterGame,
  runDailyMaintenance,
  step,
  type TownState,
} from "@fq/core";
import type { View } from "@fq/protocol";
import { describe, expect, it } from "vitest";
import { buttonIds, makeTown, policyRng } from "../../core/test/support/harness.js";
import { classicPack, expandedPack, vintagePack } from "../src/index.js";

const NEGOTIATION = ["neg:guilt", "neg:sympathy", "neg:hard", "neg:soft"];
const DAYS = 4;
const PLAYERS = 3;

/** Plays one logged-on player through every turn of the day and logs off (as core's fullDay test). */
function playSession(
  start: TownState,
  id: number,
  firstView: View,
  ctx: ReturnType<typeof classicContext>,
  rand: () => number,
): TownState {
  let town = start;
  let view = firstView;
  let negotiationSteps = 0;
  for (let actions = 0; actions < 3000; actions++) {
    const ids = buttonIds(view);
    let result: ReturnType<typeof step>;
    if (view.overlay?.kind === "message") {
      // Mail arrives as message overlays (one per letter) and is closed with a dismiss.
      result = step(town, id, { type: "dismiss", overlayId: view.overlay.id }, ctx);
    } else if (view.overlay?.kind === "confirm") {
      result = step(
        town,
        id,
        { type: "confirm", overlayId: view.overlay.id, accepted: rand() < 0.5 },
        ctx,
      );
    } else if (view.overlay?.kind === "textInput") {
      // Cancelling a prompt is always allowed; it backs out of a letter or a name entry.
      result = step(town, id, { type: "submitText", overlayId: view.overlay.id, text: null }, ctx);
    } else if (view.overlay?.kind === "playerPicker") {
      const pick = view.overlay.players[Math.floor(rand() * view.overlay.players.length)];
      result = step(
        town,
        id,
        { type: "pickPlayer", overlayId: view.overlay.id, playerId: pick?.id ?? null },
        ctx,
      );
    } else if (ids.includes("neg:done")) {
      negotiationSteps++;
      const choice =
        negotiationSteps > 6 || rand() < 0.2
          ? "neg:done"
          : (NEGOTIATION[Math.floor(rand() * 4)] as string);
      result = step(town, id, { type: "press", buttonId: choice }, ctx);
    } else if (ids.includes("desk:wait")) {
      negotiationSteps = 0;
      if (town.players[id]?.turns === 0) {
        const closed = step(town, id, { type: "press", buttonId: "desk:wait" }, ctx);
        expect(closed.rejected).toBeUndefined();
        return step(closed.town, id, { type: "press", buttonId: "desk:quit" }, ctx).town;
      }
      result = step(town, id, { type: "press", buttonId: "desk:wait" }, ctx);
    } else if (ids.includes("script:1")) {
      const choice = rand() < 0.7 ? "script:1" : (ids.at(-1) as string);
      result = step(town, id, { type: "press", buttonId: choice }, ctx);
    } else if (ids.length > 0) {
      const choice = ids.includes("go:desk")
        ? "go:desk"
        : (ids[Math.floor(rand() * ids.length)] as string);
      result = step(town, id, { type: "press", buttonId: choice }, ctx);
    } else {
      throw new Error(`Stuck on ${view.scene}`);
    }
    expect(result.rejected, JSON.stringify(view.buttons)).toBeUndefined();
    town = result.town;
    view = result.view;
  }
  throw new Error("The day never ended");
}

/** Several days with three players: log on, play out the turns, log off, midnight. */
function playDays(pack: ContentPack, seed: number): { town: TownState; texts: string[] } {
  const ctx = classicContext(pack, { now: 1_000_000 });
  const { town: created, views } = makeTown(seed, PLAYERS, { ctx });
  let town = created;
  const rand = policyRng(seed);
  const texts: string[] = [];
  for (let day = 0; day < DAYS; day++) {
    for (let id = 0; id < PLAYERS; id++) {
      let first: View;
      if (day === 0) {
        first = views[id] as View;
      } else {
        const entered = enterGame(town, id, ctx);
        expect(entered.rejected).toBeUndefined();
        town = entered.town;
        first = entered.view;
      }
      town = playSession(town, id, first, ctx, rand);
    }
    town = runDailyMaintenance(town, ctx).town;
    texts.push(JSON.stringify(town.players.map((p) => [p.bp, p.luck, p.turns, p.money])));
  }
  return { town, texts };
}

describe("the engine plays several days with each built-in pack", () => {
  // expandedPack under the Classic ruleset: its classic-format tables are compatible.
  for (const pack of [vintagePack, classicPack, expandedPack]) {
    it(`${pack.id}: ${DAYS} days, ${PLAYERS} players, no errors, invariants hold`, () => {
      for (const seed of [11, 4242]) {
        const { town } = playDays(pack, seed);
        expect(town.day).toBeGreaterThanOrEqual(DAYS);
        for (const p of town.players) {
          expect(p.bp).toBeGreaterThanOrEqual(0);
          expect(p.luck).toBeGreaterThanOrEqual(1);
          expect(p.luck).toBeLessThanOrEqual(100);
        }
        expect(town.players.some((p) => p.bp > 0)).toBe(true);
      }
    });
  }

  it("the deprecated vintage pack plays the same game as Classic (it is the same data)", () => {
    const vintage = playDays(vintagePack, 11);
    const classic = playDays(classicPack, 11);
    expect(classic.texts).toEqual(vintage.texts);
  });
});
