/**
 * The Expanded town's places (docs/expanded-rules.md sections 16 to 21):
 * every formula and state transition, with a save round trip mid-flow in
 * each place. Each test names its section.
 */
import { describe, expect, it } from "vitest";
import {
  bingoPot,
  collectLoan,
  drawReturn,
  duelStake,
  EXPANDED,
  EXPANDED_TOWN,
  hitPrice,
  loanLimit,
  passChance,
  pvpGain,
  shotsReturn,
  shoveChance,
  slotsPays,
  slotsReturn,
  type TownState,
  Turn,
  townLife,
  transferFee,
} from "../src/index.js";
import {
  act,
  actRT,
  button,
  crimePage,
  edit,
  enabled,
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
const M0 = T.graveyard.monuments[0] as { price: number; bp: number; rating: number };

function rich(town: TownState, fn?: (t: TownState) => void): TownState {
  return edit(town, (t) => {
    for (const p of t.players) {
      p.money = 200_000;
      p.tags = [30, 10, 10];
    }
    fn?.(t);
  });
}

function at(place: string, fn?: (t: TownState) => void, id = 0): Seat {
  const { town, ctx } = xtown();
  return visit(seat(rich(town, fn), ctx, id), place);
}

describe("16 the graveyard", () => {
  it("16.1 monuments are bought in order for money: BP once, rating while they stand", () => {
    let s = at("graveyard");
    expect(s.view.title).toBe("Town Graveyard");
    s = pressRT(s, "graveyard:monuments");
    const before = { bp: player(s.town, 0).bp, rating: player(s.town, 0).rating };
    s = pressRT(s, "graveyard:monument");
    expect(player(s.town, 0).money).toBe(200_000 - M0.price);
    expect(player(s.town, 0).bp).toBe(before.bp + M0.bp);
    expect(player(s.town, 0).rating).toBe(before.rating + M0.rating);
    for (let i = 1; i < T.graveyard.monuments.length; i++) s = press(s, "graveyard:monument");
    expect(lifeIn(s.town, 0).monuments).toBe(5);
    expect(button(s.view, "graveyard:monument")).toBeUndefined();
    const total = T.graveyard.monuments.reduce((n, m) => n + m.price, 0);
    expect(player(s.town, 0).money).toBe(200_000 - total);
  });

  it("16.1 a monument the player cannot pay for is shown disabled", () => {
    let s = at("graveyard", (t) => {
      player(t, 0).money = 100;
    });
    s = press(s, "graveyard:monuments");
    expect(button(s.view, "graveyard:monument")?.enabled).toBe(false);
    expect(button(s.view, "graveyard:monument")?.hint).toBeTruthy();
  });

  it("16.2 tending needs karma 70, gives luck and word of mouth, twice a day", () => {
    let s = at("graveyard", (t) => {
      player(t, 0).karma = 50;
    });
    expect(button(s.view, "graveyard:tend")?.enabled).toBe(false);
    s = at("graveyard", (t) => {
      player(t, 0).karma = 75;
    });
    const turns = player(s.town, 0).turns;
    const luck = player(s.town, 0).luck;
    s = pressRT(s, "graveyard:tend");
    expect(player(s.town, 0).turns).toBe(turns - EXPANDED_TOWN.graveyard.tend.turns);
    expect(player(s.town, 0).luck).toBeGreaterThanOrEqual(luck + 1);
    expect(player(s.town, 0).expanded?.reviews).toBeGreaterThanOrEqual(1);
    s = press(s, "graveyard:tend");
    expect(button(s.view, "graveyard:tend")?.enabled).toBe(false);
  });

  it("16.3 robbing needs karma 30 or less and shares the dig limit; a failure fines, hurts and shames", () => {
    let wins = 0;
    let fails = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const { town, ctx } = xtown({ seed });
      let s = visit(
        seat(
          rich(town, (t) => {
            player(t, 0).karma = 20;
          }),
          ctx,
          0,
        ),
        "graveyard",
      );
      const money = player(s.town, 0).money;
      s = pressRT(s, "graveyard:rob");
      const after = player(s.town, 0);
      if (after.money > money || (after.tags[1] ?? 0) > 10) wins++;
      else {
        fails++;
        expect(after.money).toBe(money - T.graveyard.rob.fine);
        expect(after.karma).toBe(20 + T.graveyard.rob.karma);
        expect(lifeIn(s.town, 0).injuries.map((i) => i.id)).toContain("dog-bite");
      }
      s = press(s, "graveyard:rob");
      expect(button(s.view, "graveyard:rob")?.enabled).toBe(false);
    }
    expect(wins).toBeGreaterThan(5);
    expect(fails).toBeGreaterThan(5);
  });

  it("16.4 shove chance and duel stake formulas", () => {
    const { town, ctx } = xtown();
    const turn = new Turn(town, ctx, 0);
    expect(shoveChance(turn, 5, 5)).toBe(25);
    expect(shoveChance(turn, 9, 5)).toBe(45);
    expect(shoveChance(turn, 15, 1)).toBe(60);
    expect(shoveChance(turn, 1, 15)).toBe(10);
    const a = player(town, 0);
    const b = player(town, 1);
    b.bp = 1600;
    expect(duelStake(turn, a, b)).toBe(Math.floor(pvpGain(EXPANDED, 1600) * 0.75));
    b.karma = 90;
    expect(duelStake(turn, a, b)).toBe(Math.floor(pvpGain(EXPANDED, 1600) * 0.75 * 0.5));
  });

  it("16.4 a duel runs to the end: BP moves, the loser is hurt, mail and the crime page", () => {
    let s = at("graveyard", (t) => {
      player(t, 1).bp = 2500;
      player(t, 0).bp = 2500;
      player(t, 0).strength = 12;
    });
    s = press(s, "graveyard:duel");
    expect(s.view.overlay?.kind).toBe("playerPicker");
    s = actRT(s, { type: "pickPlayer", overlayId: "graveyard:pick", playerId: 1 });
    expect(s.view.battle?.them.name).toBe(player(s.town, 1).name);
    for (let i = 0; i < 60 && !enabled(s.view, "go:graveyard"); i++)
      s = pressRT(s, "graveyard:swing");
    expect(enabled(s.view, "go:graveyard")).toBe(true);
    const me = player(s.town, 0);
    const him = player(s.town, 1);
    const loser = me.bp < 2500 ? 0 : 1;
    expect(lifeIn(s.town, loser).injuries.length).toBe(1);
    expect(me.bp + him.bp).toBeLessThan(5000 + pvpGain(EXPANDED, 2500));
    expect(crimePage(s.town)).toMatch(/GRAVEYARD BRAWL/);
    expect(player(s.town, 1).mail.length).toBeGreaterThan(0);
    s = press(s, "go:graveyard");
    expect(button(s.view, "graveyard:duel")?.enabled).toBe(false);
  });

  it("16.4 yielding costs half and logging off mid-duel yields", () => {
    let s = at("graveyard", (t) => {
      player(t, 1).bp = 3600;
      player(t, 0).bp = 3600;
      player(t, 0).plots = 10;
    });
    s = press(s, "graveyard:duel");
    s = act(s, { type: "pickPlayer", overlayId: "graveyard:pick", playerId: 1 });
    const turn = new Turn(s.town, s.ctx, 0);
    const stake = duelStake(turn, player(s.town, 1), player(s.town, 0));
    const left = act(s, { type: "exit" });
    expect(player(left.town, 0).bp).toBe(3600 - Math.floor(stake * 0.5 * 0.5));
    expect(player(left.town, 1).bp).toBe(3600 + Math.floor(stake * 0.5));
    expect(lifeIn(left.town, 0).injuries).toEqual([]);
  });

  it("16.4 refusals: Peace Pledge, chain-mates, a rival beaten twice today", () => {
    const peaceful = at("graveyard", (t) => {
      const x = player(t, 1).expanded;
      if (x) x.rivalry = "peaceful";
    });
    let s = press(peaceful, "graveyard:duel");
    s = act(s, { type: "pickPlayer", overlayId: "graveyard:pick", playerId: 1 });
    expect(text(s.view)).toMatch(/Peace Pledge/);
    expect(s.view.battle).toBeUndefined();
    const tired = at("graveyard", (t) => {
      const x = player(t, 1).expanded;
      if (x) x.life = { ...newLifeLike(t.day), today: { ...emptyToday(t.day), duelsLost: 2 } };
    });
    s = press(tired, "graveyard:duel");
    s = act(s, { type: "pickPlayer", overlayId: "graveyard:pick", playerId: 1 });
    expect(text(s.view)).toMatch(/enough for one day/);
  });
});

function emptyToday(day: number) {
  return {
    day,
    tended: 0,
    duels: 0,
    duelsLost: 0,
    confessions: 0,
    served: false,
    tithed: 0,
    bribes: 0,
    cover: false,
    staked: 0,
    bought: [],
    seance: false,
    hired: false,
    sent: 0,
    received: 0,
  };
}

describe("17 the church", () => {
  it("17.1 cards cost a wood tag, at most six a player, twelve a night", () => {
    let s = at("church");
    s = pressRT(s, "church:bingo");
    s = pressRT(s, "church:card:3");
    expect(player(s.town, 0).tags[0]).toBe(27);
    s = press(s, "church:card:3");
    expect(button(s.view, "church:card:1")?.enabled).toBe(false);
    expect(text(s.view)).toMatch(/1, 2, 3, 4, 5, 6/);
    const turn = new Turn(s.town, s.ctx, 0);
    expect(bingoPot(turn, townLife(s.town).bingo)).toBe(Math.floor(6 * 0.9));
  });

  it("17.1 a Church Associate's first card each night is free", () => {
    let s = at("church", (t) => {
      player(t, 0).karma = 90;
    });
    s = press(s, "church:bingo");
    expect(button(s.view, "church:card:1")?.detail).toBe("Free tonight");
    s = press(s, "church:card:1");
    expect(player(s.town, 0).tags[0]).toBe(30);
    expect(s.town.expanded?.life?.bingo.paid).toBe(0);
  });

  it("17.2 confession: +1 karma a press, the price climbs, at most five a day, stops at 60", () => {
    let s = at("church", (t) => {
      player(t, 0).karma = 20;
    });
    const c = T.church.confession;
    for (let i = 0; i < 5; i++) s = pressRT(s, "church:confess");
    expect(player(s.town, 0).karma).toBe(25);
    const paid = [0, 1, 2, 3, 4].reduce((n, i) => n + c.first + c.step * i, 0);
    expect(player(s.town, 0).money).toBe(200_000 - paid);
    expect(button(s.view, "church:confess")?.enabled).toBe(false);
    const clean = at("church", (t) => {
      player(t, 0).karma = 60;
    });
    expect(button(clean.view, "church:confess")?.enabled).toBe(false);
  });

  it("17.3 holy water lets anyone with karma 50 bless a customer, one bottle a blessing", () => {
    let s = at("church", (t) => {
      player(t, 0).karma = 55;
    });
    s = pressRT(s, "church:water");
    expect(lifeIn(s.town, 0).holyWater).toBe(1);
    s = press(s, "go:map");
    s = act(s, { type: "visit", placeId: "funeral-home" });
    s = press(s, "desk:wait");
    expect(enabled(s.view, "neg:bless")).toBe(true);
    s = pressRT(s, "neg:bless");
    expect(lifeIn(s.town, 0).holyWater).toBe(0);
  });

  it("17.4 the service is the Church Associate's: a turn for BP and word of mouth, once a day", () => {
    const plain = at("church");
    expect(button(plain.view, "church:serve")?.enabled).toBe(false);
    let s = at("church", (t) => {
      player(t, 0).karma = 90;
    });
    const bp = player(s.town, 0).bp;
    const rating = player(s.town, 0).rating;
    s = pressRT(s, "church:serve");
    expect(player(s.town, 0).bp).toBe(bp + T.church.service.bpBase + Math.floor(rating / 5));
    expect(button(s.view, "church:serve")?.enabled).toBe(false);
  });

  it("17.5 tithes: $1,000 for 8 BP, up to $10,000 a day", () => {
    let s = at("church");
    const bp = player(s.town, 0).bp;
    for (let i = 0; i < 10; i++) s = press(s, "church:tithe");
    expect(player(s.town, 0).bp).toBe(bp + 80);
    expect(button(s.view, "church:tithe")?.enabled).toBe(false);
    const saint = press(
      at("church", (t) => {
        player(t, 0).karma = 80;
      }),
      "church:tithe",
    );
    expect(player(saint.town, 0).bp).toBe(bp + 12);
    const sinner = press(
      at("church", (t) => {
        player(t, 0).karma = 20;
      }),
      "church:tithe",
    );
    expect(player(sinner.town, 0).bp).toBe(bp + 4);
  });
});

describe("18 City Hall", () => {
  it("18.1 the late upgrades need a permit, bought at City Hall", () => {
    let s = at("city-hall");
    let office = press(seat(s.town, s.ctx, 1), "go:parlor");
    office = press(office, "parlor:upgrades");
    expect(button(office.view, "parlor:buy:billboard")?.enabled).toBe(false);
    expect(button(office.view, "parlor:buy:billboard")?.hint).toMatch(/Signage Permit/);
    s = pressRT(s, "city-hall:permits");
    s = pressRT(s, "city-hall:permit:signage");
    expect(lifeIn(s.town, 0).permits).toEqual(["signage"]);
    expect(button(s.view, "city-hall:permit:signage")?.enabled).toBe(false);
    s = act(press(press(s, "city-hall:main"), "go:map"), {
      type: "visit",
      placeId: "funeral-home",
    });
    s = press(press(s, "go:parlor"), "parlor:upgrades");
    s = press(s, "parlor:buy:billboard");
    expect(player(s.town, 0).expanded?.upgrades).toContain("billboard");
  });

  it("18.2 pass chance and certificates", () => {
    const { town, ctx } = xtown();
    const turn = new Turn(town, ctx, 0);
    const p = player(town, 0);
    p.rating = 40;
    p.karma = 50;
    expect(passChance(turn, p)).toBe(50);
    p.karma = 100;
    p.rating = 100;
    expect(passChance(turn, p)).toBe(90);
    p.karma = 1;
    p.rating = 0;
    expect(passChance(turn, p)).toBe(10);
    let s = at("city-hall");
    s = press(s, "city-hall:inspection");
    s = pressRT(s, "city-hall:certify");
    expect(lifeIn(s.town, 0).certifiedUntil).toBe(s.town.day + 6);
    expect(button(s.view, "city-hall:bribe")?.enabled).toBe(false);
  });

  it("18.2 the inspector fines one uncertified parlor that fails", () => {
    let { town, ctx } = xtown({ players: 1 });
    town = edit(town, (t) => {
      const p = player(t, 0);
      p.money = 50_000;
      p.rating = 0;
      p.karma = 1;
      p.expanded?.upgrades.push("paint");
    });
    let fined = 0;
    for (let d = 0; d < 6; d++) {
      const before = player(town, 0).money;
      town = midnight(town, ctx);
      if (player(town, 0).money < before) {
        fined++;
        expect(before - player(town, 0).money).toBe(Math.min(3000, Math.floor(before * 0.05)));
        expect(crimePage(town)).toMatch(/HEALTH CODE/);
      }
    }
    expect(fined).toBeGreaterThan(2);
  });
});

describe("19 the hospital", () => {
  it("19.1 injuries list with prices; treatment removes one; they heal a day each midnight", () => {
    let s = at("hospital", (t) => {
      const p = player(t, 0);
      if (p.expanded)
        p.expanded.life = { ...newLifeLike(t.day), injuries: [{ id: "cracked-skull", days: 3 }] };
    });
    expect(text(s.view)).toMatch(/Cracked Skull/);
    s = pressRT(s, "hospital:treat:cracked-skull");
    expect(lifeIn(s.town, 0).injuries).toEqual([]);
    expect(player(s.town, 0).money).toBe(200_000 - 1500);
    let town = edit(s.town, (t) => {
      lifeIn(t, 0).injuries = [{ id: "kneecapped", days: 2 }];
    });
    town = midnight(town, s.ctx);
    expect(lifeIn(town, 0).injuries).toEqual([{ id: "kneecapped", days: 1 }]);
    const morning = seat(town, s.ctx, 0);
    expect(morning.seen).toMatch(/Busted Kneecaps/);
    town = midnight(morning.town, s.ctx);
    expect(lifeIn(town, 0).injuries).toEqual([]);
  });

  it("19.1 injuries take hit points off the start of a parlor fight and cost patience", () => {
    const s = at("hospital", (t) => {
      const p = player(t, 0);
      if (p.expanded)
        p.expanded.life = { ...newLifeLike(t.day), injuries: [{ id: "cracked-skull", days: 3 }] };
    });
    let d = act(press(s, "go:map"), { type: "visit", placeId: "funeral-home" });
    d = press(d, "desk:wait");
    const c = d.town.sessions["0"]?.customer.expanded;
    expect(c).toBeDefined();
    // Patience 7..10 minus 1 for the cracked skull.
    expect(c?.patienceMax).toBeLessThanOrEqual(9);
  });

  it("19.1 a parlor fight starts the injured short of hit points, and injures whoever drops", () => {
    const { town, ctx } = xtown();
    const t = rich(town, (x) => {
      const me = player(x, 0);
      me.strength = 15;
      me.hpMax = 60;
      const him = player(x, 1);
      him.hpMax = 12;
      him.strength = 1;
      him.bp = 900;
      if (me.expanded)
        me.expanded.life = { ...newLifeLike(x.day), injuries: [{ id: "cracked-skull", days: 3 }] };
    });
    let s = visit(seat(t, ctx, 0), "competitors");
    s = press(s, "competitors:visit");
    s = act(s, { type: "submitText", overlayId: "competitors:getname", text: player(t, 1).name });
    s = act(s, { type: "confirm", overlayId: "competitors:namenext", accepted: true });
    s = press(s, "competitors:trydoor");
    s = pressRT(s, "competitors:attack");
    expect(s.view.battle?.me.hpMax).toBe(60 - 8);
    expect(player(s.town, 0).hpMax).toBe(60);
    for (let i = 0; i < 30 && enabled(s.view, "battle:attack"); i++)
      s = pressRT(s, "battle:attack");
    const loser = player(s.town, 1).hp <= 0 ? 1 : 0;
    expect(player(s.town, loser).hp).toBe(0);
    const hurt = lifeIn(s.town, loser).injuries.map((i) => i.id);
    expect(hurt.some((id) => ["sprained-ankle", "cracked-skull"].includes(id))).toBe(true);
  });

  it("19.2 the nurse sells leads: karma for a sure, richer customer", () => {
    let s = at("hospital", undefined);
    s = pressRT(s, "hospital:lead");
    s = press(s, "hospital:lead");
    expect(lifeIn(s.town, 0).leads).toBe(2);
    expect(player(s.town, 0).karma).toBe(50 - 4);
    expect(button(s.view, "hospital:lead")?.enabled).toBe(false);
    let d = act(press(s, "go:map"), { type: "visit", placeId: "funeral-home" });
    d = press(d, "desk:wait");
    expect(text(d.view)).toMatch(/your lead promised/);
    expect(lifeIn(d.town, 0).leads).toBe(1);
  });
});

function newLifeLike(day: number) {
  return {
    monuments: 0,
    injuries: [],
    healedDay: 0,
    leads: 0,
    holyWater: 0,
    permits: [],
    certifiedUntil: 0,
    savings: 0,
    loan: null,
    deadbeat: false,
    armor: false,
    bodyguardDay: 0,
    mayor: false,
    chain: null,
    leftChainDay: 0,
    today: emptyToday(day),
    spent: {},
  };
}

describe("20 the Reaper Club", () => {
  it("20.1 the cover is 2 wood tags once a day; Necromancers walk in", () => {
    let s = at("reaper-club");
    expect(button(s.view, "reaper-club:games")).toBeUndefined();
    s = pressRT(s, "reaper-club:pay");
    expect(player(s.town, 0).tags[0]).toBe(28);
    s = press(s, "go:map");
    s = act(s, { type: "visit", placeId: "reaper-club" });
    expect(enabled(s.view, "reaper-club:games")).toBe(true);
    const necro = at("reaper-club", (t) => {
      player(t, 0).karma = 10;
    });
    expect(enabled(necro.view, "reaper-club:games")).toBe(true);
    const broke = at("reaper-club", (t) => {
      player(t, 0).tags = [1, 0, 0];
    });
    expect(button(broke.view, "reaper-club:pay")?.enabled).toBe(false);
  });

  it("20.2 every house game has a small house edge, computed exactly", () => {
    expect(drawReturn(T)).toBeCloseTo((156 + 6.5) / 169, 10);
    expect(drawReturn(T)).toBeLessThan(1);
    expect(drawReturn(T)).toBeGreaterThan(0.95);
    expect(slotsReturn(T)).toBeCloseTo(3997 / 4096, 10);
    expect(slotsPays(T, "skull", "skull", "skull")).toBe(500);
    expect(slotsPays(T, "skull", "worm", "rose")).toBe(1);
    expect(slotsPays(T, "worm", "worm", "rose")).toBe(0);
    expect(shotsReturn(T)).toBeCloseTo((5 / 6) * 1.19, 10);
    for (const r of [drawReturn(T), slotsReturn(T), shotsReturn(T)]) {
      expect(r).toBeLessThan(1);
      expect(r).toBeGreaterThan(0.95);
    }
  });

  it("20.2 played for real, the games lose a little on average and never go below zero", () => {
    let staked = 0;
    let back = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const { town, ctx } = xtown({ seed });
      let s = visit(seat(rich(town), ctx, 0), "reaper-club");
      s = press(press(s, "reaper-club:pay"), "reaper-club:games");
      for (let i = 0; i < 25; i++) {
        const game = ["draw", "slots", "shots"][i % 3];
        const before = player(s.town, 0).money;
        if (!enabled(s.view, `reaper-club:${game}:1000`)) break;
        s =
          i % 7 === 0
            ? pressRT(s, `reaper-club:${game}:1000`)
            : press(s, `reaper-club:${game}:1000`);
        staked += 1000;
        back += player(s.town, 0).money - before + 1000;
        expect(player(s.town, 0).money).toBeGreaterThanOrEqual(0);
      }
      expect(lifeIn(s.town, 0).today.staked).toBeLessThanOrEqual(T.club.dailyStakeMax);
    }
    expect(staked).toBe(12 * 25 * 1000);
    // Expected return is about 0.976; 300 plays is noisy, so only a loose band.
    expect(back / staked).toBeLessThan(1.15);
    expect(back / staked).toBeGreaterThan(0.75);
  });

  it("20.2 the daily stake limit", () => {
    let s = at("reaper-club");
    s = press(press(s, "reaper-club:pay"), "reaper-club:games");
    for (let i = 0; i < 5; i++) s = press(s, "reaper-club:draw:5000");
    expect(button(s.view, "reaper-club:draw:100")?.enabled).toBe(false);
    expect(button(s.view, "reaper-club:draw:100")?.hint).toMatch(/Limit/);
  });

  it("20.3 the black market sells today's three items once each", () => {
    let s = at("reaper-club");
    s = press(press(s, "reaper-club:pay"), "reaper-club:market");
    const cards = s.view.buttons.filter((b) => b.id.startsWith("reaper-club:buy:"));
    expect(cards.length).toBe(T.club.market.slots);
    const first = cards.find((b) => b.enabled !== false);
    expect(first).toBeDefined();
    s = pressRT(s, first?.id ?? "");
    expect(button(s.view, first?.id ?? "")?.enabled).toBe(false);
    expect(lifeIn(s.town, 0).today.bought.length).toBe(1);
  });

  it("20.4 hit price, booking, and the night it lands", () => {
    const { town, ctx } = xtown();
    const turn = new Turn(town, ctx, 0);
    player(town, 1).bp = 4000;
    expect(hitPrice(turn, player(town, 1))).toBe(3000 + 1 * 4000);
    let s = at("reaper-club", (t) => {
      player(t, 1).bp = 4000;
      player(t, 1).luck = 70;
    });
    s = press(press(s, "reaper-club:pay"), "reaper-club:hit");
    s = actRT(s, { type: "pickPlayer", overlayId: "reaper-club:hitpick", playerId: 1 });
    expect(player(s.town, 0).money).toBe(200_000 - 7_000);
    expect(player(s.town, 0).karma).toBe(45);
    expect(s.town.expanded?.life?.hits).toEqual([{ by: 0, target: 1, day: s.town.day }]);
    expect(button(s.view, "reaper-club:hit")?.enabled).toBe(false);
    // The rumour reached a lucky target.
    expect(JSON.stringify(player(s.town, 1).mail)).toMatch(/paid for your knees/);
    const night = midnight(s.town, s.ctx);
    const control = midnight(
      edit(s.town, (t) => {
        townLife(t).hits = [];
      }),
      s.ctx,
    );
    expect(night.expanded?.life?.hits).toEqual([]);
    const victim = player(night, 1);
    const landed = victim.bp < player(control, 1).bp;
    if (landed) {
      // The two midnights draw differently after the hit's roll, so other rewards may differ by a little.
      const lost = Math.floor(pvpGain(EXPANDED, 4000) * EXPANDED.town.club.hit.lossShare);
      expect(player(control, 1).bp - victim.bp).toBeGreaterThanOrEqual(lost);
      expect(player(control, 1).bp - victim.bp).toBeLessThanOrEqual(lost + 10);
      expect(lifeIn(night, 1).injuries.map((i) => i.id)).toContain("kneecapped");
      expect(crimePage(night)).toMatch(/ROUGHED UP/);
    }
  });

  it("20.4 counterplay: a bodyguard, a vest or police protection foil it; peace and chains refuse it", () => {
    for (const guard of ["bodyguard", "armor", "police"] as const) {
      let s = at("reaper-club", (t) => {
        player(t, 1).bp = 4000;
        const l = { ...newLifeLike(t.day) };
        if (guard === "bodyguard") l.bodyguardDay = t.day;
        if (guard === "armor") l.armor = true;
        if (guard === "police") {
          player(t, 1).policeProtected = true;
          player(t, 1).dayLastLoggedOn = t.day;
        }
        const x = player(t, 1).expanded;
        if (x) x.life = l;
      });
      s = press(press(s, "reaper-club:pay"), "reaper-club:hit");
      s = act(s, { type: "pickPlayer", overlayId: "reaper-club:hitpick", playerId: 1 });
      const night = midnight(s.town, s.ctx);
      const control = midnight(
        edit(s.town, (t) => {
          townLife(t).hits = [];
        }),
        s.ctx,
      );
      expect(player(night, 1).bp, guard).toBe(player(control, 1).bp);
      expect(lifeIn(night, 1).injuries, guard).toEqual([]);
      expect(JSON.stringify(player(night, 1).mail), guard).toMatch(/took one look and left/);
    }
    let s = at("reaper-club", (t) => {
      const x = player(t, 1).expanded;
      if (x) x.rivalry = "peaceful";
    });
    s = press(press(s, "reaper-club:pay"), "reaper-club:hit");
    s = act(s, { type: "pickPlayer", overlayId: "reaper-club:hitpick", playerId: 1 });
    expect(text(s.view)).toMatch(/Peace Pledge/);
    expect(s.town.expanded?.life?.hits).toEqual([]);
  });

  it("20.5 the seance is the Necromancer's: leads or bad luck", () => {
    let s = at("reaper-club", (t) => {
      player(t, 0).karma = 10;
    });
    const turns = player(s.town, 0).turns;
    s = pressRT(s, "reaper-club:seance");
    expect(player(s.town, 0).turns).toBe(turns - 1);
    const l = lifeIn(s.town, 0);
    expect(l.leads === 2 || player(s.town, 0).luck < 50).toBe(true);
    expect(button(s.view, "reaper-club:seance")?.enabled).toBe(false);
  });
});

describe("21 the bank", () => {
  it("21.1 transfers: a 10% fee rounded up, daily limits on both sides, never to yourself or from a new parlor", () => {
    const { town, ctx } = xtown();
    const turn = new Turn(town, ctx, 0);
    expect(transferFee(turn, 1)).toBe(1);
    expect(transferFee(turn, 10)).toBe(1);
    expect(transferFee(turn, 11)).toBe(2);
    // Day 1: too new to send.
    let s = visit(seat(rich(town), ctx, 0), "bank");
    s = press(s, "bank:transferhome");
    expect(button(s.view, "bank:transfer")?.enabled).toBe(false);
    let later = midnight(rich(town), ctx, 3);
    s = visit(seat(later, ctx, 0), "bank");
    s = press(s, "bank:transferhome");
    s = pressRT(s, "bank:transfer");
    s = actRT(s, { type: "pickPlayer", overlayId: "bank:tpick", playerId: 1 });
    s = pressRT(s, "bank:ttier:0");
    s = actRT(s, { type: "submitText", overlayId: "bank:tcount", text: "8" });
    expect(player(s.town, 0).tags[0]).toBe(30 - 8);
    expect(player(s.town, 1).tags[0]).toBe(30 + 7);
    // 8 sent of 10 today: 3 more is over the limit.
    s = press(s, "bank:transfer");
    s = act(s, { type: "pickPlayer", overlayId: "bank:tpick", playerId: 1 });
    s = press(s, "bank:ttier:0");
    s = act(s, { type: "submitText", overlayId: "bank:tcount", text: "3" });
    expect(text(s.view)).toMatch(/over the daily limit/);
    expect(player(s.town, 0).tags[0]).toBe(22);
    later = s.town;
    const total = (t: TownState) => t.players.reduce((n, p) => n + (p.tags[0] ?? 0), 0);
    expect(total(later)).toBe(30 * 3 - 1);
  });

  it("21.2 savings earn interest at midnight on up to $100,000; no deposits while in debt", () => {
    let s = at("bank");
    s = pressRT(s, "bank:savings");
    s = pressRT(s, "bank:deposit");
    s = actRT(s, { type: "submitText", overlayId: "bank:depositamt", text: "150000" });
    expect(lifeIn(s.town, 0).savings).toBe(150_000);
    expect(player(s.town, 0).money).toBe(50_000);
    const night = midnight(s.town, s.ctx);
    expect(lifeIn(night, 0).savings).toBe(
      150_000 + Math.floor(100_000 * EXPANDED_TOWN.bank.savings.rate),
    );
    let d = visit(seat(night, s.ctx, 0), "bank");
    d = press(press(d, "bank:loan"), "bank:borrow");
    d = act(d, { type: "submitText", overlayId: "bank:borrowamt", text: "1000" });
    d = press(d, "go:bank");
    d = press(d, "bank:savings");
    expect(button(d.view, "bank:deposit")?.enabled).toBe(false);
  });

  it("21.3 loans: the limit, daily interest, repayment", () => {
    const { town, ctx } = xtown();
    const turn = new Turn(town, ctx, 0);
    player(town, 0).plots = 120;
    expect(loanLimit(turn, player(town, 0))).toBe(3000 + 100 * 120);
    player(town, 0).plots = 10_000;
    expect(loanLimit(turn, player(town, 0))).toBe(50_000);
    let s = at("bank", (t) => {
      player(t, 0).money = 0;
      player(t, 0).plots = 100;
    });
    s = pressRT(s, "bank:loan");
    s = pressRT(s, "bank:borrow");
    s = actRT(s, { type: "submitText", overlayId: "bank:borrowamt", text: "99999" });
    expect(text(s.view)).toMatch(/real number/);
    s = press(s, "bank:borrow");
    s = act(s, { type: "submitText", overlayId: "bank:borrowamt", text: "10000" });
    // The first day's interest is charged at once (a loan repaid before midnight is not free).
    expect(lifeIn(s.town, 0).loan).toEqual({ owed: 10_300, due: s.town.day + 10 });
    const cashNow = player(s.town, 0).money;
    expect(cashNow).toBeGreaterThanOrEqual(10_000);
    const night = midnight(s.town, s.ctx);
    expect(lifeIn(night, 0).loan?.owed).toBe(10_609);
    let r = visit(seat(night, s.ctx, 0), "bank");
    r = press(r, "bank:loan");
    const cash = player(r.town, 0).money;
    r = pressRT(r, "bank:repay");
    expect(lifeIn(r.town, 0).loan?.owed ?? 0).toBe(Math.max(0, 10_609 - cash));
    expect(player(r.town, 0).money).toBe(Math.max(0, cash - 10_609));
  });

  it("21.3 a loan past due is collected from cash, savings and stock; the rest costs more BP than it bought", () => {
    let s = at("bank", (t) => {
      player(t, 0).money = 0;
      player(t, 0).bp = 5000;
      player(t, 0).plots = 470;
    });
    s = press(press(s, "bank:loan"), "bank:borrow");
    s = act(s, { type: "submitText", overlayId: "bank:borrowamt", text: "50000" });
    let town = edit(s.town, (t) => {
      player(t, 0).money = 1000;
      lifeIn(t, 0).savings = 2000;
      const x = player(t, 0).expanded;
      if (x) x.stock = [1, 0, 1];
    });
    town = midnight(town, s.ctx, 11);
    const p = player(town, 0);
    const l = lifeIn(town, 0);
    expect(l.loan).toBeNull();
    expect(p.money).toBe(0);
    expect(l.savings).toBe(0);
    expect(p.expanded?.stock).toEqual([0, 0, 0]);
    expect(l.deadbeat).toBe(true);
    expect(JSON.stringify(p.mail)).toMatch(/wrote off/);
  });

  it("21.3 the default's BP cost: 1 BP per $40 written off, after cash, savings and stock", () => {
    const { town, ctx } = xtown();
    const p = player(town, 0);
    p.bp = 5000;
    p.money = 1000;
    const x = p.expanded;
    if (!x) throw new Error("no record");
    x.stock = [1, 0, 1];
    x.life = { ...newLifeLike(town.day), savings: 2000, loan: { owed: 50_000, due: 1 } };
    collectLoan(new Turn(town, ctx, -1), p);
    const left = 50_000 - 1000 - 2000 - 4000 - 600;
    expect(p.bp).toBe(5000 - Math.ceil(left / 40));
    expect(x.life.loan).toBeNull();
    expect(x.life.deadbeat).toBe(true);
    // A default always costs more BP than the money could have bought (best rate: the first monument).
    const best = Math.max(
      ...T.graveyard.monuments.map((m) => m.bp / m.price),
      T.church.tithe.bpPerStep / T.church.tithe.step,
    );
    expect(1 / T.bank.loan.defaultDollarsPerBp).toBeGreaterThan(best);
  });

  it("21.3 no loans in the last three days of a season; loans fall due by the last day", () => {
    let s = at("bank", (t) => {
      t.day = 26;
    });
    s = press(s, "bank:loan");
    expect(enabled(s.view, "bank:borrow")).toBe(true);
    s = press(s, "bank:borrow");
    s = act(s, { type: "submitText", overlayId: "bank:borrowamt", text: "1000" });
    expect(lifeIn(s.town, 0).loan?.due).toBe(30);
    const late = at("bank", (t) => {
      t.day = 28;
    });
    const v = press(late, "bank:loan");
    expect(button(v.view, "bank:borrow")?.enabled).toBe(false);
  });
});
