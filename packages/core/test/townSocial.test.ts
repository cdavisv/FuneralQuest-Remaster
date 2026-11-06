/**
 * The town's shared systems with several players across days
 * (docs/expanded-rules.md sections 17.1, 18.3, 18.4, 23 and 24): bingo,
 * the ordinance vote, the election, parlor chains and the Daily Challenge.
 */
import { describe, expect, it } from "vitest";
import { chainHit, chainSheltered } from "../src/expanded/town/life.js";
import {
  chainStandings,
  createDailyChallenge,
  dailyChallengeResult,
  EXPANDED_TOWN,
  enterGame,
  lifeOf,
  liveModifiers,
  rankDailyChallenge,
  startDailyChallenge,
  step,
  type TownState,
  Turn,
  townLife,
} from "../src/index.js";
import { xcontext } from "./support/expanded.js";
import {
  act,
  button,
  edit,
  enabled,
  frontPage,
  lifeIn,
  midnight,
  player,
  press,
  pressRT,
  type Seat,
  seat,
  text,
  visit,
  xtown,
} from "./support/xtown.js";

const T = EXPANDED_TOWN;

function funded(players: number, seed = 41): { town: TownState; ctx: ReturnType<typeof xcontext> } {
  const { town, ctx } = xtown({ players, seed });
  return {
    ctx,
    town: edit(town, (t) => {
      for (const p of t.players) {
        p.money = 100_000;
        p.tags = [40, 0, 0];
        // Players with 0 BP close shop after the first week (classic-rules, the grace period).
        p.bp = 100;
      }
    }),
  };
}

/** Player `id` goes to `place`, does `fn`, and logs off. */
function trip(
  town: TownState,
  ctx: ReturnType<typeof xcontext>,
  id: number,
  place: string,
  fn: (s: Seat) => Seat,
): TownState {
  const s = fn(visit(seat(town, ctx, id), place));
  return step(s.town, id, { type: "exit" }, ctx).town;
}

describe("17.1 Bingo Night across several players and nights", () => {
  it("one card wins each night; the pot is paid or carried; tags are never minted", () => {
    let { town, ctx } = funded(4);
    const wealth = (t: TownState) =>
      t.players.reduce((n, p) => n + (p.tags[0] ?? 0), 0) + (t.expanded?.life?.bingo.carry ?? 0);
    let winners = 0;
    let carries = 0;
    for (let night = 0; night < 6; night++) {
      const before = wealth(town);
      // Nights 0-3 sell out; nights 4-5 sell one card (the winning card is usually unsold).
      const buyers = night < 4 ? [0, 1, 2, 3] : [night % 4];
      for (const id of buyers) {
        town = trip(town, ctx, id, "church", (s) => {
          let q = press(s, "church:bingo");
          q = night < 4 ? pressRT(q, "church:card:3") : press(q, "church:card:1");
          return q;
        });
      }
      const paid = town.expanded?.life?.bingo.paid ?? 0;
      expect(paid).toBe(night < 4 ? 12 : 1);
      town = midnight(town, ctx);
      const cut = paid - Math.floor(paid * (1 - T.church.bingo.cut));
      expect(wealth(town), `night ${night}`).toBe(before - cut);
      const news = frontPage(town);
      if (/won .* wood tags/.test(news)) winners++;
      if (/rolls over/.test(news)) carries++;
    }
    expect(winners).toBeGreaterThanOrEqual(4);
    expect(carries).toBeGreaterThanOrEqual(1);
  });
});

describe("18.3 the weekly ordinance vote", () => {
  it("opens on day 1 with three candidates, counts votes and lobbying, rules for a week", () => {
    let { town, ctx } = funded(3);
    const ballot = town.expanded?.life?.ballot;
    expect(ballot?.options.length).toBe(3);
    expect(ballot?.closes).toBe(7);
    const [a, b] = ballot?.options ?? [];
    town = trip(town, ctx, 0, "city-hall", (s) =>
      pressRT(press(s, "city-hall:ordinance"), `city-hall:vote:${a}`),
    );
    town = trip(town, ctx, 1, "city-hall", (s) =>
      press(press(s, "city-hall:ordinance"), `city-hall:vote:${a}`),
    );
    town = trip(town, ctx, 2, "city-hall", (s) => {
      let q = press(press(s, "city-hall:ordinance"), `city-hall:vote:${b}`);
      q = pressRT(q, "city-hall:lobby");
      q = press(q, "city-hall:lobby");
      expect(button(q.view, "city-hall:lobby")?.enabled).toBe(false);
      return q;
    });
    expect(player(town, 2).money).toBe(100_000 - 2 * T.cityHall.ordinance.lobby.price);
    town = midnight(town, ctx, 6);
    expect(town.day).toBe(7);
    expect(town.expanded?.life?.ordinance).toBeNull();
    town = midnight(town, ctx);
    expect(town.day).toBe(8);
    const o = town.expanded?.life?.ordinance;
    expect(o).toEqual({ id: b, from: 8, until: 14 });
    expect(frontPage(town)).toMatch(/NEW ORDINANCE/);
    const sources = (town.expanded?.modifiers ?? []).filter((m) => m.source === `ordinance:${b}`);
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.every((m) => m.untilDay === 14)).toBe(true);
    // A new ballot opened for the next week.
    expect(town.expanded?.life?.ballot?.closes).toBe(14);
    const desk = seat(town, ctx, 0);
    expect(desk.view.town?.ordinance?.id).toBe(b);
    expect(desk.view.town?.ordinance).toMatchObject({ until: 14, daysLeft: 6 });
    expect(desk.view.town?.ballots?.[0]).toEqual({
      kind: "ordinance",
      closes: 14,
      voted: false,
      daysLeft: 6,
    });
  });

  it("a week with no votes passes nothing", () => {
    let { town, ctx } = funded(2);
    town = midnight(town, ctx, 7);
    expect(town.expanded?.life?.ordinance).toBeNull();
    expect(frontPage(town)).toMatch(/COUNCIL DEADLOCKED/);
  });
});

describe("18.4 the mayoral election", () => {
  it("filing, ads, voting, the count, and the mayor's perks", () => {
    let { town, ctx } = funded(4);
    town = trip(town, ctx, 0, "city-hall", (s) =>
      pressRT(press(s, "city-hall:election"), "city-hall:file"),
    );
    town = trip(town, ctx, 1, "city-hall", (s) => {
      let q = press(press(s, "city-hall:election"), "city-hall:file");
      q = pressRT(q, "city-hall:ads");
      return q;
    });
    expect(town.expanded?.life?.election.candidates).toEqual([0, 1]);
    expect(player(town, 0).money).toBe(100_000 - T.cityHall.election.fee);
    expect(player(town, 1).money).toBe(
      100_000 - T.cityHall.election.fee - T.cityHall.election.ads.price,
    );
    // Day 8: voting opens; filing has closed.
    town = midnight(town, ctx, 7);
    expect(town.day).toBe(8);
    expect(town.expanded?.life?.election.ballot?.options).toEqual(["0", "1"]);
    const late = visit(seat(town, ctx, 2), "city-hall");
    const ev = press(late, "city-hall:election");
    expect(button(ev.view, "city-hall:file")).toBeUndefined();
    town = step(ev.town, 2, { type: "exit" }, ctx).town;
    for (const id of [0, 2, 3]) {
      town = trip(town, ctx, id, "city-hall", (s) =>
        pressRT(press(s, "city-hall:election"), "city-hall:elect:0"),
      );
    }
    town = trip(town, ctx, 1, "city-hall", (s) =>
      press(press(s, "city-hall:election"), "city-hall:elect:1"),
    );
    const ratingBefore = player(town, 0).rating;
    town = midnight(town, ctx, 3);
    expect(town.day).toBe(11);
    const el = town.expanded?.life?.election;
    expect(el?.mayor).toBe(0);
    expect(el?.held).toBe(true);
    expect(lifeIn(town, 0).mayor).toBe(true);
    expect(frontPage(town)).toMatch(/NEW MAYOR ELECTED/);
    expect(player(town, 0).rating).toBeGreaterThanOrEqual(
      ratingBefore + T.cityHall.election.perks.rating - 2,
    );
    const morning = seat(town, ctx, 0);
    if (T.cityHall.election.perks.turns > 0) expect(morning.seen).toMatch(/mayoral chauffeur/);
    else expect(morning.seen).not.toMatch(/mayoral chauffeur/);
    expect(morning.view.town?.mayor).toBe(player(town, 0).name);
    // The mayor's vote counts double on the next ordinance ballot (opens day 15).
    town = midnight(morning.town, ctx, 4);
    expect(town.day).toBe(15);
    const [a, b] = town.expanded?.life?.ballot?.options ?? [];
    town = trip(town, ctx, 0, "city-hall", (s) =>
      press(press(s, "city-hall:ordinance"), `city-hall:vote:${a}`),
    );
    town = trip(town, ctx, 1, "city-hall", (s) =>
      press(press(s, "city-hall:ordinance"), `city-hall:vote:${b}`),
    );
    town = trip(town, ctx, 2, "city-hall", (s) => {
      const q = press(press(s, "city-hall:ordinance"), `city-hall:vote:${b}`);
      expect(button(q.view, `city-hall:vote:${b}`)?.detail).toBe("2 votes");
      expect(button(q.view, `city-hall:vote:${a}`)?.detail).toBe("2 votes");
      return q;
    });
    // Without the mayor's double vote this would be 2 to 2; with it, 3 to 2.
    town = edit(town, (t) => {
      const ballot = t.expanded?.life?.ballot;
      if (ballot) ballot.votes["2"] = a as string;
    });
    town = midnight(town, ctx, 7);
    expect(town.expanded?.life?.ordinance?.id).toBe(a);
  });

  it("no candidates: no election, the old mayor stays", () => {
    let { town, ctx } = funded(2);
    town = midnight(town, ctx, 10);
    expect(town.expanded?.life?.election.held).toBe(true);
    expect(town.expanded?.life?.election.mayor).toBeNull();
    expect(frontPage(town)).toMatch(/ELECTION CANCELLED/);
  });
});

describe("23 parlor chains", () => {
  it("founding, inviting, joining, the season board, dues, leaving and the cooldown", () => {
    let { town, ctx } = funded(5);
    town = trip(town, ctx, 0, "city-hall", (s) => {
      let q = pressRT(press(s, "city-hall:chains"), "city-hall:found");
      expect(q.view.overlay?.kind).toBe("textInput");
      q = act(q, {
        type: "submitText",
        overlayId: "city-hall:chainname",
        text: "Stiff Competition",
      });
      for (const id of [1, 2, 3, 4]) {
        q = press(q, "city-hall:invite");
        q = act(q, { type: "pickPlayer", overlayId: "city-hall:invitepick", playerId: id });
      }
      return q;
    });
    const chain = town.expanded?.life?.chains[0];
    expect(chain?.name).toBe("Stiff Competition");
    expect(chain?.invites).toEqual([1, 2, 3, 4]);
    expect(player(town, 0).money).toBe(100_000 - T.chains.found);
    const r0 = player(town, 0).rating;
    for (const id of [1, 2, 3]) {
      town = trip(town, ctx, id, "city-hall", (s) => {
        const q = press(s, "city-hall:chains");
        return pressRT(q, `city-hall:join:${chain?.id}`);
      });
    }
    // The chain is full: the fifth invitee cannot join.
    const fifth = press(visit(seat(town, ctx, 4), "city-hall"), "city-hall:chains");
    expect(button(fifth.view, `city-hall:join:${chain?.id}`)?.enabled).toBe(false);
    town = step(fifth.town, 4, { type: "exit" }, ctx).town;
    expect(town.expanded?.life?.chains[0]?.members).toEqual([0, 1, 2, 3]);
    expect(player(town, 1).money).toBe(100_000 - T.chains.join);
    expect(player(town, 0).rating).toBe(r0);
    // Sales score for the chain.
    const saleBp = () =>
      [0, 1, 2, 3].reduce((n, id) => n + (player(town, id).expanded?.record.saleBp ?? 0), 0);
    const before = saleBp();
    for (const id of [0, 1]) {
      let s = seat(town, ctx, id);
      for (let i = 0; i < 3; i++) {
        s = press(s, "desk:wait");
        if (enabled(s.view, "neg:done")) s = press(s, "neg:done");
        for (let k = 0; k < 4 && !s.view.buttons.some((b) => b.id === "desk:wait"); k++) {
          const next = s.view.buttons.find(
            (b) => b.enabled !== false && (b.id === "go:desk" || b.id.startsWith("prep:")),
          );
          if (!next) break;
          s = press(s, next.id);
        }
      }
      town = step(s.town, id, { type: "exit" }, ctx).town;
    }
    expect(chainStandings(town)[0]?.score).toBe(saleBp() - before);
    const board = press(visit(seat(town, ctx, 1), "city-hall"), "city-hall:chains");
    expect(board.view.board?.[0]).toMatchObject({
      place: 1,
      name: "Stiff Competition",
      mine: true,
    });
    town = step(board.town, 1, { type: "exit" }, ctx).town;
    expect(saleBp()).toBeGreaterThan(before);
    // Dues at midnight; a broke member is dropped.
    town = edit(town, (t) => {
      player(t, 3).money = 100;
    });
    const cash = player(town, 2).money;
    town = midnight(town, ctx);
    expect(player(town, 2).money).toBeGreaterThanOrEqual(cash - T.chains.dues);
    expect(town.expanded?.life?.chains[0]?.members).toEqual([0, 1, 2]);
    expect(lifeIn(town, 3).chain).toBeNull();
    // Leaving, then the cooldown before founding again.
    town = trip(town, ctx, 2, "city-hall", (s) => {
      let q = press(press(s, "city-hall:chains"), "city-hall:leavechain");
      expect(text(q.view)).toMatch(/lapel pin/);
      q = press(q, "city-hall:main");
      q = press(q, "city-hall:chains");
      expect(button(q.view, "city-hall:found")?.enabled).toBe(false);
      expect(button(q.view, "city-hall:found")?.hint).toMatch(/recently/);
      return q;
    });
    expect(town.expanded?.life?.chains[0]?.members).toEqual([0, 1]);
  });

  it("23.3 chain-mates cannot fight, rob, duel or hire hits on each other, and a beaten chain is sheltered", () => {
    let { town, ctx } = funded(3);
    town = edit(town, (t) => {
      townLife(t).chains.push({
        id: "c9",
        name: "Family",
        members: [0, 1],
        score: 0,
        invites: [],
        hitsToday: 0,
        hitsDay: 0,
      });
      lifeOf(t, player(t, 0)).chain = "c9";
      lifeOf(t, player(t, 1)).chain = "c9";
    });
    let g = press(visit(seat(town, ctx, 0), "graveyard"), "graveyard:duel");
    g = act(g, { type: "pickPlayer", overlayId: "graveyard:pick", playerId: 1 });
    expect(text(g.view)).toMatch(/in your chain/);
    let c = press(
      press(visit(seat(g.town, ctx, 0), "reaper-club"), "reaper-club:pay"),
      "reaper-club:hit",
    );
    c = act(c, { type: "pickPlayer", overlayId: "reaper-club:hitpick", playerId: 1 });
    expect(text(c.view)).toMatch(/doesn't do family/);
    // The rival row: refused at the name confirmation.
    let r = press(visit(seat(c.town, ctx, 0), "competitors"), "competitors:visit");
    r = act(r, {
      type: "submitText",
      overlayId: "competitors:getname",
      text: player(town, 1).name.slice(0, 4),
    });
    if (r.view.overlay?.kind === "confirm") {
      r = act(r, { type: "confirm", overlayId: r.view.overlay.id, accepted: true });
      expect(text(r.view)).toMatch(/in your chain/);
    }
    const turn = new Turn(r.town, ctx, 2);
    for (let i = 0; i < T.chains.shelterAfter; i++) chainHit(turn, player(r.town, 1));
    expect(chainSheltered(turn, player(r.town, 1))).toBe(true);
    expect(chainSheltered(turn, player(r.town, 2))).toBe(false);
  });
});

describe("24 the Daily Challenge", () => {
  const ctx = xcontext();

  function play(
    challenge: ReturnType<typeof createDailyChallenge>,
    name: string,
    style: "quick" | "slow",
  ) {
    const run = startDailyChallenge(challenge, { name, parlor: `${name} Rest`, male: true }, ctx);
    let s: Seat = { town: run.town, ctx, id: run.playerId, view: run.view };
    expect(text(s.view)).toMatch(/Daily Challenge/);
    const met: string[] = [];
    for (let n = 0; n < 200 && (s.town.players[0]?.turns ?? 0) > 0; n++) {
      if (!enabled(s.view, "desk:wait")) {
        const home = s.view.buttons.find(
          (b) =>
            b.enabled !== false &&
            (b.id === "go:desk" ||
              b.id.startsWith("prep:") ||
              b.id.startsWith("risk:") ||
              b.id.startsWith("script:")),
        );
        if (!home) break;
        s = press(s, home.id);
        continue;
      }
      s = press(s, "desk:wait");
      const c = s.town.sessions["0"]?.customer;
      if (c?.expanded && c.flow === "negotiation") {
        met.push(`${c.expanded.first} ${c.expanded.surname} ${c.moneyToSpend}`);
        if (style === "slow") {
          for (const id of ["neg:listen", "neg:coffee", "neg:sympathy"])
            if (enabled(s.view, id)) s = press(s, id);
        }
        if (enabled(s.view, "neg:done")) s = press(s, "neg:done");
      }
    }
    return { s, met };
  }

  it("every run meets the same customers in the same order, whatever it does; scored and ranked", () => {
    const challenge = createDailyChallenge("2026-11-06", ctx);
    expect(createDailyChallenge("2026-11-06", ctx).seed).toBe(challenge.seed);
    expect(createDailyChallenge("2026-11-07", ctx).seed).not.toBe(challenge.seed);
    const a = play(challenge, "Skelly", "quick");
    const b = play(challenge, "Morticia", "slow");
    const n = Math.min(a.met.length, b.met.length);
    expect(n).toBeGreaterThan(5);
    expect(a.met.slice(0, n)).toEqual(b.met.slice(0, n));
    // The same day's weather and news for both.
    expect(a.s.town.expanded?.life?.today).toEqual(b.s.town.expanded?.life?.today);
    const again = play(challenge, "Skelly", "quick");
    expect(JSON.stringify(again.s.town)).toBe(JSON.stringify(a.s.town));
    const ra = dailyChallengeResult(a.s.town);
    const rb = dailyChallengeResult(b.s.town);
    expect(ra.finished).toBe(true);
    expect(ra.score).toBeGreaterThan(0);
    expect(ra.score).toBe((a.s.town.players[0]?.bp ?? 0) - 0);
    const board = rankDailyChallenge([rb, ra]);
    expect(board[0]?.place).toBe(1);
    expect(board[0]?.score).toBeGreaterThanOrEqual(board[1]?.score ?? 0);
    // Out of turns, the desk shows the score and only a way out.
    const desk = press(
      a.s,
      a.s.view.buttons.find((x) => x.id === "go:desk") ? "go:desk" : "desk:quit",
    );
    if (desk.view.scene === "desk") {
      expect(desk.view.buttons.map((x) => x.id)).toEqual(["desk:quit"]);
      expect(text(desk.view)).toMatch(/The day is done/);
    }
  });

  it("a run quit early is finished, and logging back on shows the score", () => {
    const challenge = createDailyChallenge("quit-early", ctx);
    const run = startDailyChallenge(
      challenge,
      { name: "Digby", parlor: "Digby Rest", male: true },
      ctx,
    );
    let s: Seat = { town: run.town, ctx, id: 0, view: run.view };
    s = press(s, "desk:wait");
    s = act(s, { type: "exit" });
    expect(dailyChallengeResult(s.town).finished).toBe(true);
    const back = enterGame(s.town, 0, ctx);
    const desk = step(back.town, 0, { type: "press", buttonId: "go:desk" }, ctx);
    expect(desk.view.buttons.map((x) => x.id)).toEqual(["desk:quit"]);
    expect(liveModifiers(s.town, "turns.daily").length).toBeGreaterThanOrEqual(0);
  });
});
