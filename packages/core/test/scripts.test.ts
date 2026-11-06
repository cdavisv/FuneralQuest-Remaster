import { describe, expect, it } from "vitest";
import {
  type EngineContext,
  enterGame,
  richTextToPlain,
  setPresence,
  type TownState,
} from "../src/index.js";
import { act, buttonIds, press } from "./support/harness.js";
import { atDesk, scriptEvent } from "./support/scenarios.js";

describe("script_event.c and its events", () => {
  it("costs no turn and picks arson or a bonus tag 50/50 (script_event.c:14)", () => {
    let arson = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const { town, ctx } = atDesk(seed, 1);
      const r = press(town, 0, "desk:wait", ctx);
      expect(r.town.players[0]?.turns).toBe(15);
      if (buttonIds(r.view).includes("script:1")) arson++;
    }
    expect(arson / 200).toBeGreaterThan(0.35);
    expect(arson / 200).toBeLessThan(0.65);
  });

  it("bonus_tag.c gives one tag of a random tier", () => {
    const { town, view } = scriptEvent("tag");
    expect(richTextToPlain(view.text)).toMatch(
      /^While cleaning behind the .+ you find a (wood|silver|gold) tag\.$/,
    );
    expect(town.players[0]?.tags.reduce((a, b) => a + b, 0)).toBe(1);
    expect(buttonIds(view)).toEqual(["go:desk"]);
    expect(town.sessions["0"]?.script?.id).toBe("script_event");
  });

  it("arson.c: the Twins refuse a player without 6 gold tags", () => {
    const { town, ctx } = scriptEvent("arson");
    const r = press(town, 0, "script:1", ctx);
    expect(richTextToPlain(r.view.text)).toMatch(/You don't have enough gold tags, fool!/);
    expect(buttonIds(r.view)).toEqual(["go:desk"]);
    const home = press(r.town, 0, "go:desk", ctx);
    expect(home.town.sessions["0"]?.script).toBeNull();
  });

  function hire(): { town: TownState; ctx: EngineContext; view: ReturnType<typeof press>["view"] } {
    const found = scriptEvent("arson");
    const t = structuredClone(found.town);
    (t.players[0] as { tags: number[] }).tags = [0, 0, 10];
    Object.assign(t.players[2] as object, { plots: 40, tags: [7, 1, 1] });
    const r = press(t, 0, "script:1", found.ctx);
    expect(r.view.overlay?.kind).toBe("playerPicker");
    expect(r.view.buttons).toEqual([]);
    return { town: r.town, ctx: found.ctx, view: r.view };
  }

  it("arson.c: picking yourself or nobody asks again with the Hire button", () => {
    const { town, ctx } = hire();
    const self = act(
      town,
      0,
      { type: "pickPlayer", overlayId: "script:getname", playerId: 0 },
      ctx,
    );
    expect(richTextToPlain(self.view.text)).toMatch(/Even as a joke/);
    expect(buttonIds(self.view)).toEqual(["script:1", "go:desk"]);
    expect(self.view.picture?.fg).toBe("people/m_old_3");
    const none = act(
      town,
      0,
      { type: "pickPlayer", overlayId: "script:getname", playerId: null },
      ctx,
    );
    expect(richTextToPlain(none.view.text)).toMatch(/The twins look confused/);
  });

  it("arson.c: burning a rival costs 6 gold, burns 5% of plots and all wood tags, and mails them", () => {
    const { town, ctx } = hire();
    const r = act(town, 0, { type: "pickPlayer", overlayId: "script:getname", playerId: 2 }, ctx);
    expect(richTextToPlain(r.view.text)).toMatch(/A fire engulfs Digby Rest!/);
    expect(r.view.picture?.fg).toBe("places/fire");
    expect(r.town.players[0]?.tags[2]).toBe(4);
    expect(r.town.players[2]?.plots).toBe(38);
    expect(r.town.players[2]?.tags).toEqual([0, 1, 1]);
    const mail = r.town.players[2]?.mail ?? [];
    expect(
      mail.some((m) => m.type === "text" && m.text.includes("You lost `42`y gravestone(s)")),
    ).toBe(true);
    expect(r.town.news[String(r.town.day)]?.front).toMatch(/PARLOR (DAMAGED BY FIRE|GETS BURNED)/);
  });

  it("arson.c: a player whose client is disconnected counts as not on now (isPresent, like visits)", () => {
    // Both runs have a session for player 2; only the host's presence report differs.
    const { town, ctx } = hire();
    const victimOnline = (t: TownState) =>
      act(t, 0, { type: "pickPlayer", overlayId: "script:getname", playerId: 2 }, ctx);
    // Player 2 keeps a session but the host reports the connection gone: same as being off.
    const kept = enterGame(town, 2, ctx).town;
    const connected = victimOnline(kept);
    expect(richTextToPlain(connected.view.text)).toMatch(/shake their heads/);
    const away = victimOnline(setPresence(kept, 2, false));
    expect(away.view.text).not.toEqual(connected.view.text);
    expect(richTextToPlain(away.view.text)).toMatch(/A fire engulfs Digby Rest!/);
  });

  it("arson.c: a smoke detector stops most fires and pays the victim 3 gold", () => {
    let stopped = 0;
    let burned = 0;
    for (let k = 0; k < 30; k++) {
      const found = scriptEvent("arson");
      const t = structuredClone(found.town);
      // A different stream each time: shift the day.
      t.day += k;
      (t.players[0] as { tags: number[] }).tags = [0, 0, 10];
      (t.players[2] as { custom: number[] }).custom[0] = 1;
      const hired = press(t, 0, "script:1", found.ctx);
      const r = act(
        hired.town,
        0,
        { type: "pickPlayer", overlayId: "script:getname", playerId: 2 },
        found.ctx,
      );
      if (richTextToPlain(r.view.text).includes("Damn smoke detectors!")) {
        stopped++;
        expect(r.town.players[2]?.tags[2]).toBe(3);
        expect(r.town.players[0]?.tags[2]).toBe(4);
      } else burned++;
    }
    expect(stopped).toBeGreaterThan(burned);
  });

  it("stats.c shows the sheet with Name and Back", () => {
    const { town, ctx } = atDesk(1, 1);
    const r = press(town, 0, "go:stats", ctx);
    expect(r.view.scene).toBe("stats");
    expect(richTextToPlain(r.view.text)).toBe("Your stats.");
    expect(buttonIds(r.view)).toEqual(["go:options", "go:desk"]);
    expect(r.view.stats?.find((s) => s.id === "rating")?.value).toMatch(/^#1 - /);
    const name = press(r.town, 0, "go:options", ctx);
    // The Name button leads to the name-change screen (command_options.cpp:29-79).
    expect(richTextToPlain(name.view.text)).toMatch(/will cost 1 gold tag\(s\)/);
    expect(buttonIds(name.view)).toEqual(["options:input", "go:stats"]);
  });
});
