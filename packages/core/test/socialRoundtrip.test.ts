import type { Action } from "@fq/protocol";
import { describe, expect, it } from "vitest";
import { Custom, type EngineContext, step, type TownState } from "../src/index.js";
import { edit, socialTown, toRow } from "./support/social.js";

/** Runs `actions` for player 0, optionally saving and loading the town as JSON before action `breakAt`. */
function run(
  town: TownState,
  ctx: EngineContext,
  actions: Action[],
  breakAt: number | null,
): string {
  let t = town;
  const out: string[] = [];
  actions.forEach((action, i) => {
    if (i === breakAt) t = JSON.parse(JSON.stringify(t)) as TownState;
    const r = step(t, 0, action, ctx);
    expect(r.rejected, JSON.stringify(action)).toBeUndefined();
    t = r.town;
    out.push(JSON.stringify(r.view), JSON.stringify(r.effects));
  });
  return JSON.stringify({ t, out });
}

function same(town: TownState, ctx: EngineContext, actions: Action[]): void {
  const straight = run(town, ctx, actions, null);
  for (let k = 0; k < actions.length; k++) expect(run(town, ctx, actions, k)).toBe(straight);
}

const press = (buttonId: string): Action => ({ type: "press", buttonId });

describe("JSON round trips of the social screens give the same result as an uninterrupted run", () => {
  it("mid-visit: name search, padlock, lockpick, steal", () => {
    const { town, ctx } = socialTown(21, 3);
    let t = structuredClone(town);
    // "i" matches Morticia, then Digby: No, then Yes, visits Digby.
    (t.players[2]?.custom as number[])[Custom.Padlock] = 1;
    (t.players[2]?.custom as number[])[Custom.PadlockStrength] = 100;
    (t.players[0]?.custom as number[])[Custom.Lockpick] = 3;
    t = edit(t, 2, { tags: [3, 3, 3] });
    const row = toRow(t, 0, ctx).town;
    same(row, ctx, [
      press("competitors:visit"),
      { type: "submitText", overlayId: "competitors:getname", text: "i" },
      { type: "confirm", overlayId: "competitors:namenext", accepted: false },
      { type: "confirm", overlayId: "competitors:namenext", accepted: true },
      press("competitors:trydoor"),
      press("competitors:picklock"),
      press("competitors:inside"),
      press("competitors:steal"),
      press("go:competitors"),
    ]);
  });

  it("mid-battle: blows, then the quote", () => {
    const { town, ctx } = socialTown(22, 3);
    const t = edit(edit(town, 0, { strength: 6, hpMax: 60, plots: 2 }), 1, {
      strength: 4,
      hpMax: 30,
    });
    const row = toRow(t, 0, ctx).town;
    const actions: Action[] = [
      press("competitors:visit"),
      { type: "submitText", overlayId: "competitors:getname", text: "Morticia" },
      { type: "confirm", overlayId: "competitors:namenext", accepted: true },
      press("competitors:trydoor"),
      press("competitors:attack"),
    ];
    // Attack until the battle ends, then answer the quote.
    let probe = row;
    for (const a of actions) probe = step(probe, 0, a, ctx).town;
    for (let i = 0; i < 100; i++) {
      const v = probe.sessions["0"]?.view;
      const battle = v?.buttons.filter((b) => b.id.startsWith("battle:")) ?? [];
      const next = battle.find((b) => b.id === "battle:attack") ?? battle[0];
      if (!next) break;
      const a = press(next.id);
      actions.push(a);
      probe = step(probe, 0, a, ctx).town;
      if (
        a.type === "press" &&
        (a.buttonId === "battle:yellwin" || a.buttonId === "battle:yelllost")
      ) {
        const quote: Action = {
          type: "submitText",
          overlayId: "battle:quote",
          text: "Grave words",
        };
        actions.push(quote);
        probe = step(probe, 0, quote, ctx).town;
        break;
      }
    }
    expect(actions.length).toBeGreaterThan(7);
    same(row, ctx, actions);
  });

  it("mid-compose and mid-read: a letter and its reply", () => {
    const { town, ctx } = socialTown(23, 2, { online: [0, 1] });
    same(town, ctx, [
      press("go:mailbox"),
      { type: "submitText", overlayId: "mailbox:getname", text: "mort" },
      { type: "confirm", overlayId: "mailbox:namenext", accepted: true },
      { type: "submitText", overlayId: "mailbox:compose", text: "Dear rival,\nboo." },
      press("go:map"),
      { type: "visit", placeId: "cafe" },
      { type: "chat", text: "hello|/me sighs|/info" },
    ]);
  });
});
