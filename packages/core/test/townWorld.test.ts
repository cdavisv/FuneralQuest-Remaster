/**
 * The living town (docs/expanded-rules.md section 22): daily news that
 * changes the rules, the weather, and story arcs played to every ending.
 */
import { describe, expect, it } from "vitest";
import { applyNews, applyWeather } from "../src/expanded/town/world.js";
import {
  arcTest,
  checkExpandedContent,
  type EngineContext,
  EXPANDED,
  EXPANDED_STARTER,
  lifeOf,
  liveModifiers,
  modValue,
  startArc,
  step,
  TOWN_STARTER,
  type TownState,
  Turn,
  tally,
} from "../src/index.js";
import {
  edit,
  frontPage,
  midnight,
  player,
  press,
  seat,
  text,
  visit,
  xtown,
} from "./support/xtown.js";

function arc(id: string) {
  const def = TOWN_STARTER.arcs.find((a) => a.id === id);
  if (!def) throw new Error(id);
  return def;
}

function withArc(id: string, players = 3): { town: TownState; ctx: EngineContext } {
  const { town, ctx } = xtown({ players });
  const t = edit(town, (x) => {
    for (const p of x.players) {
      p.money = 50_000;
      p.bp = 500;
      p.tags = [10, 0, 0];
    }
  });
  const turn = new Turn(t, ctx, -1);
  startArc(turn, arc(id));
  turn.commit();
  return { town: turn.town, ctx };
}

function ending(town: TownState): string | undefined {
  return town.expanded?.life?.arcsDone.at(-1)?.ending;
}

/** Midnights until the running arc is over (at most 15). */
function playOut(town: TownState, ctx: EngineContext): TownState {
  let t = town;
  for (let i = 0; i < 15 && t.expanded?.life?.arc; i++) t = midnight(t, ctx);
  return t;
}

describe("25.3 the town content", () => {
  it("the starter passes the content check, and the check catches broken arcs and keys", () => {
    expect(checkExpandedContent(EXPANDED_STARTER, EXPANDED)).toEqual([]);
    const broken = JSON.parse(JSON.stringify(EXPANDED_STARTER)) as typeof EXPANDED_STARTER;
    const town = broken.town;
    if (!town) throw new Error("no town");
    (town.arcs[0] as { start: string }).start = "nowhere";
    (town.news[0]?.modifiers[0] as { key: string }).key = "made.up";
    town.injuries = town.injuries.filter((i) => i.id !== "kneecapped");
    const problems = checkExpandedContent(broken, EXPANDED);
    expect(problems.some((p) => /no start beat/.test(p))).toBe(true);
    expect(problems.some((p) => /unknown modifier made.up/.test(p))).toBe(true);
    expect(problems.some((p) => /kneecapped/.test(p))).toBe(true);
  });
});

describe("22.1 daily news changes the rules", () => {
  it("a story goes on the front page and its modifiers live for its days", () => {
    const { town, ctx } = xtown();
    const turn = new Turn(town, ctx, -1);
    const quake = TOWN_STARTER.news.find((n) => n.id === "small-quake");
    if (!quake) throw new Error("no quake");
    applyNews(turn, quake);
    expect(frontPage(town)).toMatch(/SHAKEUP IN DEATHVILLE/);
    expect(modValue(town, "turns.daily", 0)).toBe(1);
    expect(modValue(town, "wait.eventOdds", 0.08)).toBeCloseTo(0.04, 10);
    expect(liveModifiers(town, "turns.daily")[0]?.untilDay).toBe(town.day);
    const next = edit(town, (t) => {
      t.day++;
    });
    expect(modValue(next, "turns.daily", 0)).toBe(0);
  });

  it("over many days some news runs and its turns arrive at the morning", () => {
    let { town, ctx } = xtown({ players: 1 });
    let stories = 0;
    let extraTurns = 0;
    for (let d = 0; d < 20; d++) {
      town = midnight(town, ctx);
      const news = town.expanded?.life?.today.news;
      if (news) {
        stories++;
        expect(frontPage(town)).toMatch(
          new RegExp(TOWN_STARTER.news.find((n) => n.id === news)?.title ?? "x"),
        );
      }
      const extra = modValue(town, "turns.daily", 0);
      if (extra > 0) {
        town = edit(town, (t) => {
          player(t, 0).turns = 0;
          player(t, 0).bp = 10;
        });
        const s = seat(town, ctx, 0);
        const p = player(s.town, 0);
        // 15 turns a day plus the news (the mayor and injuries are not in play here).
        expect(p.turns).toBe(15 + extra);
        expect(s.seen).toMatch(/In the paper|talking about/);
        extraTurns++;
        town = step(s.town, 0, { type: "exit" }, ctx).town;
      }
    }
    expect(stories).toBeGreaterThan(6);
    expect(extraTurns).toBeGreaterThan(0);
  });
});

describe("22.2 the weather", () => {
  it("every day has weather, on the morning screen, the desk strip and the map", () => {
    let { town, ctx } = xtown({ players: 1 });
    town = midnight(town, ctx);
    const w = town.expanded?.life?.today.weather;
    expect(TOWN_STARTER.weather.map((x) => x.id)).toContain(w);
    const s = seat(
      edit(town, (t) => {
        player(t, 0).bp = 5;
      }),
      ctx,
      0,
    );
    expect(s.seen).toMatch(/Weather:/);
    expect(s.view.town?.weather?.id).toBe(w);
    const map = press(s, "go:map");
    expect(map.view.town?.weather?.id).toBe(w);
  });

  it("fog helps grave robbers; a storm costs every customer a patience", () => {
    const { town, ctx } = xtown();
    const turn = new Turn(town, ctx, -1);
    const fog = TOWN_STARTER.weather.find((x) => x.id === "fog");
    const storm = TOWN_STARTER.weather.find((x) => x.id === "storm");
    if (!fog || !storm) throw new Error("weather");
    applyWeather(turn, fog);
    expect(modValue(town, "graveyard.robLuck", 50)).toBe(65);
    applyWeather(turn, storm);
    expect(modValue(town, "customer.patience", 0)).toBe(-1);
    const s = seat(town, ctx, 0);
    expect(text(s.view)).toBeTruthy();
    const neg = press(s, "desk:wait");
    const c = neg.town.sessions["0"]?.customer.expanded;
    expect(c?.patienceMax).toBeLessThanOrEqual(9);
  });
});

describe("22.3 story arcs, each ending", () => {
  it("the steeple: the good side gives more, the bells ring again", () => {
    let { town, ctx } = withArc("steeple");
    expect(frontPage(town)).toMatch(/LIGHTNING SPLITS/);
    // Two give at the church, one at the club.
    for (const id of [0, 1]) {
      const s = visit(seat(town, ctx, id), "church");
      const give = s.view.buttons.find((b) => b.id.startsWith("arc:give:church"));
      expect(give?.label).toBe("Give to the Steeple Fund");
      town = step(press(s, give?.id ?? "").town, id, { type: "exit" }, ctx).town;
    }
    let club = visit(seat(town, ctx, 2), "reaper-club");
    club = press(club, "reaper-club:pay");
    club = press(club, "arc:give:reaper-club:0");
    expect(text(club.view)).toMatch(/partner/);
    town = step(club.town, 2, { type: "exit" }, ctx).town;
    expect(town.expanded?.life?.arc?.counters).toMatchObject({ good: 2000, evil: 1000 });
    expect(player(town, 0).karma).toBe(51);
    const top = Number(
      Object.entries(town.expanded?.life?.arc?.given ?? {}).find(([, g]) => g.good > 0)?.[0],
    );
    const topBp = player(town, top).bp;
    town = playOut(town, ctx);
    expect(ending(town)).toBe("rebuilt");
    expect(JSON.stringify(town.news)).toMatch(/BELLS RING AGAIN/);
    expect(player(town, top).bp).toBeGreaterThanOrEqual(topBp + 50);
    expect(town.expanded?.modifiers.some((m) => m.source === "arc:steeple:rebuilt")).toBe(true);
  });

  it("the steeple: the evil side gives more (or nobody gives), the church is paved", () => {
    let { town, ctx } = withArc("steeple");
    let club = visit(seat(town, ctx, 0), "reaper-club");
    club = press(press(club, "reaper-club:pay"), "arc:give:reaper-club:0");
    town = step(club.town, 0, { type: "exit" }, ctx).town;
    town = playOut(town, ctx);
    expect(ending(town)).toBe("paved");
    expect(JSON.stringify(town.news)).toMatch(/LEVEL 2, ROW C/);
    // Bingo is cancelled while the rubble lies there.
    const church = visit(
      seat(
        edit(town, (t) => {
          for (const p of t.players) p.bp = 600;
        }),
        ctx,
        1,
      ),
      "church",
    );
    if (town.expanded?.modifiers.some((m) => m.key === "church.bingo" && m.untilDay >= town.day)) {
      expect(church.view.buttons.find((b) => b.id === "church:bingo")?.enabled).toBe(false);
    }
    const nobody = playOut(withArc("steeple").town, withArc("steeple").ctx);
    expect(ending(nobody)).toBe("paved");
  });

  it("the cough: too many walkouts, the families flee", () => {
    let { town, ctx } = withArc("cough");
    expect(frontPage(town)).toMatch(/MYSTERY COUGH/);
    for (let i = 0; i < 9; i++) tally(town, "walkouts");
    const turn = new Turn(town, ctx, -1);
    const state = town.expanded?.life?.arc;
    if (!state) throw new Error("no arc");
    expect(arcTest(town, state, { kind: "walkouts", perPlayer: 3 })).toBe(true);
    town = playOut(town, ctx);
    expect(ending(town)).toBe("fled");
    expect(JSON.stringify(town.news)).toMatch(/FLEE TO BIGTOWN/);
    expect(turn).toBeDefined();
  });

  it("the cough: few walkouts and a mayor, the mayor takes the credit", () => {
    let { town, ctx } = withArc("cough");
    town = edit(town, (t) => {
      const e = t.expanded?.life?.election;
      if (e) {
        e.mayor = 1;
        e.held = true;
      }
      lifeOf(t, player(t, 1));
    });
    const before = player(town, 1).bp;
    town = playOut(town, ctx);
    expect(ending(town)).toBe("credit");
    expect(JSON.stringify(town.news)).toMatch(/TAKES CREDIT/);
    expect(player(town, 1).bp).toBeGreaterThanOrEqual(before + 110);
  });

  it("the cough: few walkouts and no mayor, a statue for everyone", () => {
    let { town, ctx } = withArc("cough");
    const before = town.players.map((p) => p.bp);
    town = playOut(town, ctx);
    expect(ending(town)).toBe("statue");
    expect(JSON.stringify(town.news)).toMatch(/UNKNOWN UNDERTAKER/);
    for (const [i, p] of town.players.entries())
      expect(p.bp).toBeGreaterThanOrEqual((before[i] ?? 0) + 30);
  });

  it("arcs start by themselves inside their window, at most once a season", () => {
    let { town, ctx } = xtown({ players: 2 });
    town = edit(town, (t) => {
      for (const p of t.players) p.bp = 100;
    });
    const started: string[] = [];
    for (let d = 0; d < 28; d++) {
      town = midnight(town, ctx);
      const a = town.expanded?.life?.arc;
      if (a && a.started === town.day) {
        started.push(a.id);
        const def = arc(a.id);
        expect(town.day).toBeGreaterThanOrEqual(def.earliest);
        expect(town.day).toBeLessThanOrEqual(def.latest);
      }
    }
    expect(started.sort()).toEqual(["cough", "steeple"]);
    expect(town.expanded?.life?.arcsDone.map((x) => x.id).sort()).toEqual(["cough", "steeple"]);
  });

  it("a new season starts the town over: no arcs, ballots or modifiers left from the last", () => {
    let { town, ctx } = xtown({ players: 1 });
    town = edit(town, (t) => {
      player(t, 0).bp = 100;
    });
    town = midnight(town, ctx, 31);
    expect(town.day).toBe(1);
    expect(town.expanded?.life?.season).toBe(2);
    expect(town.expanded?.life?.arcsDone).toEqual([]);
    expect((town.expanded?.modifiers ?? []).every((m) => m.untilDay <= 1)).toBe(true);
  });
});
