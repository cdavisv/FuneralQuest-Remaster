/**
 * The Expanded parlor, town and day: new day, money, upgrades, karma perks,
 * PvP and fairness, the guided first day, and isolation from Classic. Each
 * test names its section of docs/expanded-rules.md.
 */
import type { View } from "@fq/protocol";
import { describe, expect, it } from "vitest";
import {
  addModifier,
  CLASSIC_RULES,
  checkExpandedContent,
  createClassicRegistry,
  type EngineContext,
  EXPANDED,
  EXPANDED_STARTER,
  enterGame,
  expandedBattleBp,
  expandedContext,
  MODIFIER_KEYS,
  richTextToPlain,
  runDailyMaintenance,
  step,
  type TownState,
  Turn,
} from "../src/index.js";
import { makeXTown, must, pressX, xcontext } from "./support/expanded.js";
import { legacyContent } from "./support/legacyContent.js";
import { recordTranscript } from "./support/transcript.js";
import { atXDesk, btn, cust, enabledIds, ids, meet, px, type XPlaced } from "./support/xplaces.js";

const X = EXPANDED;

/** Ends player 0's day, runs midnight, and brings them back to the desk. */
function nextDay(p: XPlaced, edit?: (t: TownState) => void): XPlaced {
  let town = step(p.town, 0, { type: "exit" }, p.ctx).town;
  town = runDailyMaintenance(town, p.ctx).town;
  if (edit) {
    town = JSON.parse(JSON.stringify(town)) as TownState;
    edit(town);
  }
  const r = enterGame(town, 0, p.ctx);
  const morning = pressX(r.town, 0, "go:desk", p.ctx);
  return { town: morning.town, ctx: p.ctx, view: morning.view };
}

function plain(view: View): string {
  return richTextToPlain(view.text);
}

describe("10.1 the new day", () => {
  it("banks up to one day of unused turns", () => {
    const p = atXDesk();
    expect(p.town.players[0]?.turns).toBe(15);
    const q = nextDay(p);
    expect(q.town.players[0]?.turns).toBe(30);
    expect(plain(q.view)).toMatch(/carried over 15 unused turns/);
    const r = nextDay(q, (t) => {
      (t.players[0] as { turns: number }).turns = 4;
    });
    expect(r.town.players[0]?.turns).toBe(19);
  });

  it("9.5 hearse turns need the day's upkeep", () => {
    const paid = nextDay(atXDesk(), (t) => {
      const me = t.players[0] as { transportation: number; money: number; turns: number };
      me.transportation = 4;
      me.money = 5000;
      me.turns = 0;
    });
    expect(paid.town.players[0]?.turns).toBe(15 + 3);
    expect(paid.town.players[0]?.money).toBe(5000 - 1500);
    const broke = nextDay(atXDesk(), (t) => {
      const me = t.players[0] as { transportation: number; money: number; turns: number };
      me.transportation = 4;
      me.money = 100;
      me.turns = 0;
    });
    expect(broke.town.players[0]?.turns).toBe(15);
    expect(broke.town.players[0]?.money).toBe(100);
    expect(plain(broke.view)).toMatch(/stays in the garage/);
  });

  it("6.4 plots pay every day, premium plots more", () => {
    const q = nextDay(atXDesk(), (t) => {
      const me = t.players[0];
      if (!me?.expanded) throw new Error();
      me.plots = 10;
      me.money = 0;
      me.expanded.plotIncome = 25;
    });
    expect(q.town.players[0]?.money).toBe(10 * X.money.plotIncome + 25);
  });

  it("3.8 a pre-need funeral pays when it comes due", () => {
    const p = atXDesk();
    const q = nextDay(p, (t) => {
      t.players[0]?.expanded?.futures.push({ day: t.day, bp: 30, money: 100, text: "Paid." });
    });
    expect(q.town.players[0]?.bp).toBe((p.town.players[0]?.bp ?? 0) + 30);
    expect(q.town.players[0]?.expanded?.futures).toEqual([]);
  });

  it("8.3 the Grave Robber and the Necromancer get extra turns a day", () => {
    const q = nextDay(atXDesk(), (t) => {
      const me = t.players[0] as { karma: number; turns: number };
      me.karma = 20;
      me.turns = 0;
    });
    expect(q.town.players[0]?.turns).toBe(15 + EXPANDED.karma.evilTurns[0]);
    const n = nextDay(atXDesk(), (t) => {
      const me = t.players[0] as { karma: number; turns: number };
      me.karma = 10;
      me.turns = 0;
    });
    expect(n.town.players[0]?.turns).toBe(15 + EXPANDED.karma.evilTurns[1]);
  });
});

describe("10.3 new players are safe for their first week", () => {
  it("a 0-BP player who never comes back survives 7 midnights, not 8 (the original deleted at the first)", () => {
    const ctx = xcontext();
    let town = makeXTown(31, 2, { ctx }).town;
    for (const id of [0, 1]) town = step(town, id, { type: "exit" }, ctx).town;
    // The daily news can hand a random player a few BP; this player never sold anything.
    const midnight = () => {
      town = JSON.parse(JSON.stringify(town)) as TownState;
      for (const q of town.players) {
        q.bp = 0;
        q.bpToday = 0;
      }
      town = runDailyMaintenance(town, ctx).town;
    };
    for (let d = 0; d < 7; d++) midnight();
    expect(town.players[0]?.active).toBe(true);
    midnight();
    expect(town.players[0]?.active).toBe(false);
  });
});

describe("6.2 Di-Mart caskets", () => {
  it("buys at wholesale, respects the storeroom and the cash", () => {
    let p = atXDesk({ setup: (t) => ((t.players[0] as { money: number }).money = 10_000) });
    p = px(p, "go:map");
    p = { ...p, ...must(p.town, 0, { type: "visit", placeId: "store" }, p.ctx) };
    expect(ids(p.view)).toContain("store:caskets");
    p = px(p, "store:caskets");
    p = px(p, "store:casket:1");
    expect(p.town.players[0]?.money).toBe(10_000 - 1950);
    expect(p.town.players[0]?.expanded?.stock).toEqual([2, 1, 0]);
    p = px(p, "store:restock");
    const x = p.town.players[0]?.expanded;
    expect((x?.stock ?? []).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(X.money.stockCapacity);
    expect(p.town.players[0]?.money).toBeGreaterThanOrEqual(0);
    for (const b of p.view.buttons.filter((b) => b.id.startsWith("store:casket:"))) {
      expect(b.enabled).toBe(false);
      expect(b.hint).toBeTruthy();
    }
  });

  it("evil karma gets the back-room price", () => {
    let p = atXDesk({
      setup: (t) => {
        const me = t.players[0] as { money: number; karma: number };
        me.money = 10_000;
        me.karma = 20;
      },
    });
    p = px(p, "go:map");
    p = { ...p, ...must(p.town, 0, { type: "visit", placeId: "store" }, p.ctx) };
    p = px(p, "store:caskets");
    expect(btn(p.view, "store:casket:0")?.detail).toBe("$550");
  });
});

describe("7.2 upgrades", () => {
  it("cost money, need their prerequisites, and say why when locked", () => {
    let p = atXDesk({ setup: (t) => ((t.players[0] as { money: number }).money = 5000) });
    p = px(p, "go:parlor");
    expect(p.view.picture?.fg).toBe("places/parlor-1");
    expect(p.view.office?.level).toBe(0);
    p = px(p, "parlor:upgrades");
    expect(btn(p.view, "parlor:buy:viewing-room")?.enabled).toBe(false);
    expect(btn(p.view, "parlor:buy:viewing-room")?.hint).toMatch(/Fresh Paint/);
    expect(btn(p.view, "parlor:buy:chapel")?.enabled).toBe(false);
    p = px(p, "parlor:buy:paint");
    expect(p.town.players[0]?.money).toBe(3000);
    expect(p.town.players[0]?.expanded?.upgrades).toEqual(["paint"]);
    expect(p.town.players[0]?.rating).toBe(10 + 3);
    expect(ids(p.view)).not.toContain("parlor:buy:paint");
    expect(btn(p.view, "parlor:buy:incinerator")?.hint).toBe("Not enough cash");
  });

  it("the parlor drawing follows the building level through five stages (25.4)", () => {
    let p = atXDesk({
      setup: (t) => {
        const x = t.players[0]?.expanded;
        if (x) x.upgrades = ["paint", "viewing-room", "chapel"];
      },
    });
    p = px(p, "go:parlor");
    expect(p.view.picture?.fg).toBe("places/parlor-4");
    expect(plain(p.view)).toMatch(/Chapel House/);
    expect(p.view.office).toMatchObject({ level: 3, levelName: "Chapel House" });
  });

  it("the incinerator sets the Classic incinerator flag", () => {
    let p = atXDesk({ setup: (t) => ((t.players[0] as { money: number }).money = 30_000) });
    p = px(px(px(p, "go:parlor"), "parlor:upgrades"), "parlor:buy:incinerator");
    expect(p.town.players[0]?.incinerator).toBe(true);
  });

  it("6.3 markup is set at the office and raises casket prices", () => {
    let p = px(px(atXDesk(), "go:parlor"), "parlor:markup");
    p = px(p, "parlor:markup:20");
    expect(p.town.players[0]?.expanded?.markup).toBe(20);
    expect(p.town.players[0]?.rating).toBe(10 + 2 * EXPANDED.markup.ratingPer10);
    p = px(px(p, "go:parlor"), "go:desk");
    p = meet(p);
    expect(cust(p).expanded.casketPrices).toEqual([950, 3100, 6350]);
  });
});

describe("8.3 karma perks", () => {
  it("Church Associate can Bless once; it reveals the loved flag", () => {
    let p = meet(
      atXDesk({ setup: (t) => ((t.players[0] as { karma: number }).karma = 90) }),
      (c) => {
        c.mood = 4;
      },
    );
    expect(ids(p.view)).toContain("neg:bless");
    p = px(p, "neg:bless");
    expect(cust(p).expanded.told.loved).toBe(true);
    expect(cust(p).mood).toBeCloseTo(2, 5);
    expect(btn(p.view, "neg:bless")?.enabled).toBe(false);
  });

  it("Necromancer can Raise Mourners once; it cuts cheapness", () => {
    let p = meet(
      atXDesk({ setup: (t) => ((t.players[0] as { karma: number }).karma = 10) }),
      (c) => {
        c.cheapness = 6;
        c.mood = 2;
        c.expanded.traits = ["sentimental", "skeptic"];
      },
    );
    expect(ids(p.view)).toContain("neg:raise");
    p = px(p, "neg:raise");
    expect(cust(p).cheapness).toBeCloseTo(6 - X.actions.raise.cheapness, 5);
    expect(btn(p.view, "neg:raise")?.enabled).toBe(false);
  });

  it("Grave Robber digs for goodies at the office, twice a day", () => {
    let p = px(
      atXDesk({ setup: (t) => ((t.players[0] as { karma: number }).karma = 25) }),
      "go:parlor",
    );
    const turns = p.town.players[0]?.turns ?? 0;
    p = px(p, "parlor:dig");
    expect(p.town.players[0]?.turns).toBe(turns - EXPANDED.karma.dig.turns);
    p = px(p, "parlor:dig");
    expect(btn(p.view, "parlor:dig")?.enabled).toBe(false);
  });

  it("dishonest prep choices pay double for a Grave Robber", async () => {
    const { prepEffects } = await import("../src/expanded/modules/prep.js");
    const p = atXDesk({ setup: (t) => ((t.players[0] as { karma: number }).karma = 25) });
    const turn = new Turn(p.town, p.ctx, 0);
    const ring = EXPANDED_STARTER.prep[0]?.options[0];
    if (!ring) throw new Error();
    expect(prepEffects(turn, ring, ring.effects).money).toBe(800);
  });
});

describe("9 PvP and fairness", () => {
  function turnFor(p: XPlaced): Turn {
    return new Turn(JSON.parse(JSON.stringify(p.town)) as TownState, p.ctx, 0);
  }

  it("9.1 a win takes the capped curve, cut by the loser's security and sanctuary", () => {
    const p = atXDesk();
    const t = turnFor(p);
    const [me, him] = [t.town.players[0], t.town.players[1]];
    if (!me || !him) throw new Error();
    him.bp = 10_000;
    him.bpToday = 0;
    const gain = Math.min(EXPANDED.pvp.gainCap, Math.floor(EXPANDED.pvp.gainFactor * 100));
    const loss = Math.floor(gain * EXPANDED.pvp.lossShare);
    expect(expandedBattleBp(t, me, him, false)).toEqual({ won: gain, lost: loss });
    expect(him.bp).toBe(10_000 - loss);
    const x = him.expanded;
    if (!x) throw new Error();
    x.upgrades = ["guard-dog", "alarm"];
    expect(expandedBattleBp(t, me, him, false).won).toBe(Math.floor(gain * 0.7));
    him.karma = 90;
    expect(expandedBattleBp(t, me, him, false).won).toBe(Math.floor(gain * 0.7 * 0.5));
    // Cutthroat against cutthroat pays a quarter more.
    x.upgrades = [];
    him.karma = 50;
    x.rivalry = "cutthroat";
    if (me.expanded) me.expanded.rivalry = "cutthroat";
    expect(expandedBattleBp(t, me, him, false).won).toBe(Math.floor(gain * 1.25));
  });

  it("9.3 a Peace Pledge parlor cannot visit or be visited, and pays insurance on sales", () => {
    let p = atXDesk({
      setup: (t) => {
        const x = t.players[0]?.expanded;
        if (x) x.rivalry = "peaceful";
      },
    });
    p = px(p, "go:map");
    p = { ...p, ...must(p.town, 0, { type: "visit", placeId: "competitors" }, p.ctx) };
    p = px(p, "competitors:visit");
    expect(plain(p.view)).toMatch(/Peace Pledge/);
    const sale = px(
      meet(
        atXDesk({
          setup: (t) => {
            const x = t.players[0]?.expanded;
            if (x) x.rivalry = "peaceful";
          },
        }),
        (c) => {
          c.desiredCasket = 2;
          c.moneyToSpend = 18000;
        },
      ),
      "neg:done",
    );
    expect(plain(sale.view)).toMatch(/insurance: -\d+ BP/);
    // A visitor is turned away from a peaceful rival before using a visit.
    let v = atXDesk({
      setup: (t) => {
        const x = t.players[1]?.expanded;
        if (x) x.rivalry = "peaceful";
      },
    });
    v = px(v, "go:map");
    v = { ...v, ...must(v.town, 0, { type: "visit", placeId: "competitors" }, v.ctx) };
    v = px(v, "competitors:visit");
    v = {
      ...v,
      ...must(
        v.town,
        0,
        { type: "submitText", overlayId: "competitors:getname", text: "Morticia" },
        v.ctx,
      ),
    };
    v = {
      ...v,
      ...must(
        v.town,
        0,
        { type: "confirm", overlayId: "competitors:namenext", accepted: true },
        v.ctx,
      ),
    };
    expect(plain(v.view)).toMatch(/Peace Pledge sign on Morticia/);
    expect(v.town.players[0]?.playerFights).toBe(0);
  });

  it("9.3 a cutthroat parlor has an extra visit; tiers change only every 3 days", () => {
    let p = px(px(atXDesk(), "go:parlor"), "parlor:rivalry");
    p = px(p, "parlor:rivalry:cutthroat");
    expect(p.town.players[0]?.expanded?.rivalry).toBe("cutthroat");
    expect(btn(p.view, "parlor:rivalry:standard")?.enabled).toBe(false);
    p = px(px(p, "go:parlor"), "go:desk");
    p = px(p, "go:map");
    p = { ...p, ...must(p.town, 0, { type: "visit", placeId: "competitors" }, p.ctx) };
    expect(plain(p.view)).toMatch(/visit .?3.? more parlor/);
  });

  it("9.2 security turns a prowler away at the door some of the time", () => {
    let turnedAway = 0;
    for (let seed = 1; seed <= 20; seed++) {
      let v = atXDesk({
        seed,
        setup: (t) => {
          const x = t.players[1]?.expanded;
          if (x) x.upgrades = ["guard-dog", "alarm", "night-watchman"];
        },
      });
      v = px(v, "go:map");
      v = { ...v, ...must(v.town, 0, { type: "visit", placeId: "competitors" }, v.ctx) };
      v = px(v, "competitors:visit");
      v = {
        ...v,
        ...must(
          v.town,
          0,
          { type: "submitText", overlayId: "competitors:getname", text: "Morticia" },
          v.ctx,
        ),
      };
      v = {
        ...v,
        ...must(
          v.town,
          0,
          { type: "confirm", overlayId: "competitors:namenext", accepted: true },
          v.ctx,
        ),
      };
      v = px(v, "competitors:trydoor");
      if (/hurls itself/.test(plain(v.view))) turnedAway++;
    }
    // 45% at security level 3.
    expect(turnedAway).toBeGreaterThan(3);
    expect(turnedAway).toBeLessThan(17);
  });

  it("9.4 Spirit University stops at the caps", () => {
    let p = atXDesk({
      setup: (t) => {
        const me = t.players[0] as { psych: number; tags: number[]; strength: number };
        me.psych = X.psych.maxLevel;
        me.strength = X.caps.strength;
        me.tags[2] = 500;
      },
    });
    p = px(p, "go:map");
    p = { ...p, ...must(p.town, 0, { type: "visit", placeId: "spirit-university" }, p.ctx) };
    const gold = p.town.players[0]?.tags[2];
    let q = px(p, "spirit-university:psych");
    expect(plain(q.view)).toMatch(/nothing more I can teach/);
    q = px(px(q, "spirit-university:main"), "spirit-university:strength");
    expect(plain(q.view)).toMatch(/tear the caskets/);
    expect(q.town.players[0]?.tags[2]).toBe(gold);
  });
});

describe("9.6 arson burns stock and reputation, and spares the Peace Pledge", () => {
  it("burns half the stock and word of mouth", () => {
    let burned = false;
    for (let seed = 1; seed <= 30 && !burned; seed++) {
      let p = atXDesk({
        seed,
        settings: { scriptOdds: 1 },
        setup: (t) => {
          (t.players[0] as { tags: number[] }).tags[2] = 20;
          const x = t.players[1]?.expanded;
          if (x) x.stock = [4, 2, 0];
        },
      });
      p = px(p, "desk:wait");
      if (!ids(p.view).includes("script:1")) continue;
      p = px(p, "script:1");
      const o = p.view.overlay;
      if (o?.kind !== "playerPicker") continue;
      p = { ...p, ...must(p.town, 0, { type: "pickPlayer", overlayId: o.id, playerId: 1 }, p.ctx) };
      if (!/engulfs/.test(plain(p.view))) continue;
      burned = true;
      expect(p.town.players[1]?.expanded?.stock).toEqual([2, 1, 0]);
      expect(p.town.players[1]?.expanded?.reviews).toBe(X.pvp.arson.reviews);
    }
    expect(burned).toBe(true);
  });
});

describe("10.4 the guided first day", () => {
  it("runs from the morning to a practice customer to the clerk's goodbye", () => {
    const ctx = xcontext();
    const made = makeXTown(41, 1, { ctx, settings: { normalOdds: 1, luckOdds: 1, scriptOdds: 1 } });
    let p: XPlaced = { town: made.town, ctx, view: made.views[0] as View };
    p = px(p, "go:desk");
    expect(ids(p.view)).toEqual(["go:tutorial"]);
    p = px(p, "go:tutorial");
    expect(p.view.picture?.fg).toBe("ui/new-user-clerk");
    const pages = EXPANDED_STARTER.text.tutorial.pages.length;
    for (let i = 1; i < pages; i++) p = px(p, "tutorial:next");
    expect(ids(p.view)).toContain("tutorial:start");
    p = px(p, "tutorial:start");
    // Events are certain in this town, but the practice customer always comes.
    expect(ids(p.view)).toContain("neg:done");
    expect(p.view.note).toBeDefined();
    expect(cust(p).loved).toBe(true);
    expect(cust(p).income).toBe(1);
    p = px(p, "neg:done");
    p = px(p, ids(p.view).includes("prep:start") ? "prep:start" : "go:desk");
    if (p.view.buttons.some((b) => b.id.startsWith("prep:opt:")))
      p = px(p, enabledIds(p.view)[0] as string);
    if (!ids(p.view).includes("desk:wait")) p = px(p, "go:desk");
    expect(plain(p.view)).toMatch(/Not bad for a first day/);
    expect(p.town.players[0]?.expanded?.tutorial.done).toBe(true);
  });
});

describe("10.2 rewards apply at once", () => {
  it("the top seller's bonus is in their BP before they read the mail", () => {
    let p = meet(atXDesk(), (c) => {
      c.moneyToSpend = 18000;
    });
    p = px(p, "neg:done");
    const bp = p.town.players[0]?.bp ?? 0;
    const luck = p.town.players[0]?.luck ?? 0;
    let town = step(p.town, 0, { type: "exit" }, p.ctx).town;
    town = runDailyMaintenance(town, p.ctx).town;
    expect(town.players[0]?.bp).toBeGreaterThan(bp);
    expect(town.players[0]?.luck).toBeGreaterThan(luck);
    expect(town.players[0]?.mail.some((m) => m.type === "varMod")).toBe(false);
  });
});

describe("12.2 modifiers reach the game", () => {
  it("a limit modifier doubles every spending limit", () => {
    const base = meet(atXDesk({ seed: 51 }));
    const doubled = meet(
      atXDesk({
        seed: 51,
        setup: (t) =>
          addModifier(t, {
            key: MODIFIER_KEYS.limitMult,
            op: "mul",
            value: 2,
            untilDay: 99,
            source: "test",
          }),
      }),
    );
    const a = cust(base).moneyToSpend;
    const b = cust(doubled).moneyToSpend;
    expect(b).toBeGreaterThanOrEqual(2 * a - 50);
  });
});

describe("1.3 Expanded is unreachable under Classic rules", () => {
  it("the Classic registry has none of the Expanded modules", () => {
    const r = createClassicRegistry();
    for (const id of ["parlor", "prep", "tutorial"]) expect(r.module(id)).toBeUndefined();
    expect(r.module("neg")?.sessionEnd).toBeUndefined();
    expect(r.playerCreatedHooks).toHaveLength(0);
    expect(r.maintenanceHooks).toHaveLength(0);
    expect(CLASSIC_RULES.expanded).toBeUndefined();
  });

  it("a Classic playthrough never creates Expanded state or HUD fields", () => {
    let seen = false;
    recordTranscript({
      seed: 9,
      players: 3,
      days: 2,
      onStep: (_a, r) => {
        const json = JSON.stringify(r.town);
        if (json.includes('"expanded"') || r.view.hud?.money !== undefined) seen = true;
        if (r.view.buttons.some((b) => b.group !== undefined || b.detail !== undefined))
          seen = true;
      },
    });
    expect(seen).toBe(false);
  });

  it("an Expanded context refuses Classic rules", () => {
    expect(() => expandedContext(legacyContent(), { rules: CLASSIC_RULES })).toThrow();
  });
});

describe("13.4 content checks", () => {
  it("the starter content passes", () => {
    expect(checkExpandedContent(EXPANDED_STARTER, X)).toEqual([]);
  });

  it("finds broken content", () => {
    const bad = {
      ...EXPANDED_STARTER,
      softSell: [{ article: "a", name: "Odd", price: 75, tags: [] }],
      packages: [
        {
          ...EXPANDED_STARTER.packages[0],
          id: "x",
          tiers: [{ article: "", name: "Free", price: 10, tags: [] }],
        },
      ],
    } as typeof EXPANDED_STARTER;
    const problems = checkExpandedContent(bad, X);
    expect(problems.some((p) => p.includes("multiple of 50"))).toBe(true);
    expect(problems.some((p) => p.includes("tier 0 must be free"))).toBe(true);
  });

  it("an Expanded context fills in the starter content for a Classic pack", () => {
    const ctx: EngineContext = xcontext();
    expect(ctx.content.expanded).toBe(EXPANDED_STARTER);
  });
});
