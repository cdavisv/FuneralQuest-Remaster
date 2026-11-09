/**
 * The batch-B places (docs/expanded-rules.md section 31): the coroner, the health
 * department, Cousin Sal's pawn shop and Mourne & Sons. Every action, costs
 * checked before the button is enabled, and deterministic draws (a save round
 * trip mid-flow replays identically). Each test names its section.
 */
import { describe, expect, it } from "vitest";
import { PLACES_B_STARTER } from "../src/expanded/content/townPlacesB.js";
import { TOWN_STARTER } from "../src/expanded/content/townStarter.js";
import { PLACES_B } from "../src/expanded/town/placesB.js";
import { newPlacesB, type PlacesBState } from "../src/expanded/town/placesBState.js";
import { EXPANDED_TOWN, type TownState } from "../src/index.js";
import { atXDesk, ids, meet, px } from "./support/xplaces.js";
import {
  act,
  button,
  edit,
  enabled,
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

const R = EXPANDED_TOWN.placesB;

function rich(town: TownState, fn?: (t: TownState) => void, money = 100_000): TownState {
  return edit(town, (t) => {
    for (const p of t.players) p.money = money;
    fn?.(t);
  });
}

function at(place: string, fn?: (t: TownState) => void, money = 100_000, seed = 31): Seat {
  const { town, ctx } = xtown({ seed });
  return visit(seat(rich(town, fn, money), ctx, 0), place);
}

function pbOfPlayer(town: TownState, id = 0): PlacesBState {
  const s = player(town, id).expanded?.placesB;
  if (!s) throw new Error("no placesB");
  return s;
}

function withState(t: TownState, fn: (s: PlacesBState) => void, id = 0): void {
  const x = player(t, id).expanded;
  if (!x) throw new Error("not expanded");
  x.placesB ??= newPlacesB();
  fn(x.placesB);
}

function cashOf(b: { detail?: string } | undefined): number {
  return Number((b?.detail ?? "").replace(/[^0-9]/g, ""));
}

describe("B0 the map", () => {
  it("the four places are on the Expanded map and open their screens", () => {
    expect(PLACES_B.map((p) => p.id)).toEqual([
      "coroner",
      "health-department",
      "pawn-shop",
      "mournes",
    ]);
    const { town, ctx } = xtown();
    const s = seat(rich(town), ctx, 0);
    const map = press(s, "go:map");
    const listed = (map.view.map ?? []).map((p) => p.id);
    for (const p of PLACES_B) {
      expect(listed).toContain(p.id);
      const v = act(map, { type: "visit", placeId: p.id });
      expect(v.view.buttons.some((b) => b.id.startsWith(`${p.module}:`))).toBe(true);
      expect(v.view.buttons.some((b) => b.id === "go:map")).toBe(true);
    }
  });

  it("the starter text names the cast and is plain content (no literals in the engine)", () => {
    expect(TOWN_STARTER.cast.coroner).toMatch(/Grimble/);
    expect(TOWN_STARTER.cast.mourne).toMatch(/Mourne/);
    expect(PLACES_B_STARTER.cast.pawnbroker).toMatch(/Sal/);
  });
});

describe("B1 the coroner's office", () => {
  it("B1.1 a tip costs money, is checked before the button is enabled, and is bought once", () => {
    let s = at("coroner", undefined, R.coroner.tip.price - 1);
    expect(enabled(s.view, "coroner:tip")).toBe(false);
    expect(button(s.view, "coroner:tip")?.hint).toBeTruthy();
    s = at("coroner");
    expect(enabled(s.view, "coroner:tip")).toBe(true);
    s = pressRT(s, "coroner:tip");
    expect(player(s.town, 0).money).toBe(100_000 - R.coroner.tip.price);
    expect(pbOfPlayer(s.town).tip).toEqual({
      loved: true,
      cheap: false,
      traits: R.coroner.tip.traits,
    });
    expect(enabled(s.view, "coroner:tip")).toBe(false);
    expect(text(s.view)).toMatch(/Grimble/);
    expect(() => press(s, "coroner:tip")).toThrow();
  });

  it("B1.1 the tip shows whether the next family loved the deceased, once", () => {
    const s0 = at("coroner");
    let s = press(s0, "coroner:tip");
    s = act(press(s, "go:map"), { type: "visit", placeId: "funeral-home" });
    s = press(s, "desk:wait");
    expect(s.view.customer).toBeTruthy();
    expect(text(s.view)).toMatch(/The note says/);
    expect(pbOfPlayer(s.town).tip).toBeNull();
    const c = s.town.sessions[0]?.customer;
    expect(c?.expanded?.told.loved).toBe(true);
  });

  it("B1.2 a fast-tracked certificate gives word of mouth, with a cooldown of days", () => {
    let s = at("coroner", undefined, R.coroner.certificate.price - 1);
    expect(enabled(s.view, "coroner:certificate")).toBe(false);
    s = at("coroner");
    const before = player(s.town, 0).expanded?.reviews ?? 0;
    s = pressRT(s, "coroner:certificate");
    expect(player(s.town, 0).expanded?.reviews).toBe(before + R.coroner.certificate.reviews);
    expect(player(s.town, 0).money).toBe(100_000 - R.coroner.certificate.price);
    expect(enabled(s.view, "coroner:certificate")).toBe(false);
    expect(button(s.view, "coroner:certificate")?.hint).toBeTruthy();
  });

  it("B1.3 the proper burial costs money and gives karma and luck; one favour a day", () => {
    let s = at("coroner", (t) => {
      player(t, 0).karma = 50;
      player(t, 0).luck = 50;
    });
    s = press(s, "coroner:favour");
    const karma = player(s.town, 0).karma;
    const luck = player(s.town, 0).luck;
    s = pressRT(s, "coroner:burial");
    expect(player(s.town, 0).money).toBe(100_000 - R.coroner.favour.burialCost);
    expect(player(s.town, 0).karma).toBe(karma + R.coroner.favour.burialKarma);
    expect(player(s.town, 0).luck).toBeGreaterThanOrEqual(luck + 1);
    expect(enabled(s.view, "coroner:favour")).toBe(false);
  });

  it("B1.3 the burial is disabled without the money", () => {
    const s = press(at("coroner", undefined, R.coroner.favour.burialCost - 1), "coroner:favour");
    expect(enabled(s.view, "coroner:burial")).toBe(false);
    expect(enabled(s.view, "coroner:quiet")).toBe(true);
  });

  it("B1.3 signing the body over pays and costs karma; it can cost word of mouth", () => {
    // Luck 100 never fails; luck 1 mostly does. Both outcomes pay and cost karma.
    let s = at("coroner", (t) => {
      player(t, 0).karma = 50;
      player(t, 0).luck = 100;
    });
    s = pressRT(press(s, "coroner:favour"), "coroner:quiet");
    expect(player(s.town, 0).money).toBe(100_000 + R.coroner.favour.quietPay);
    expect(player(s.town, 0).karma).toBe(50 + R.coroner.favour.quietKarma);
    expect(player(s.town, 0).expanded?.reviews).toBe(0);
    let talked = 0;
    for (let seed = 1; seed <= 40; seed++) {
      let q = at(
        "coroner",
        (t) => {
          player(t, 0).luck = 1;
        },
        100_000,
        seed,
      );
      q = press(press(q, "coroner:favour"), "coroner:quiet");
      expect(player(q.town, 0).money).toBe(100_000 + R.coroner.favour.quietPay);
      if ((player(q.town, 0).expanded?.reviews ?? 0) === R.coroner.favour.quietFailReviews)
        talked++;
    }
    expect(talked).toBeGreaterThan(0);
    expect(talked).toBeLessThan(40);
  });
});

describe("B2 the health department", () => {
  it("B2.1 an inspection costs money up front, and the pass chance is City Hall's", () => {
    const poor = at("health-department", undefined, R.health.inspect.price - 1);
    expect(enabled(poor.view, "health-department:inspect")).toBe(false);
    const s = at("health-department");
    expect(button(s.view, "health-department:inspect")?.hint).toMatch(/% to pass/);
  });

  it("B2.1 a pass boosts word of mouth for some days; a fail leaves a citation", () => {
    let passes = 0;
    let fails = 0;
    for (let seed = 1; seed <= 60 && (passes < 2 || fails < 2); seed++) {
      let s = at("health-department", undefined, 100_000, seed);
      const before = player(s.town, 0).expanded?.reviews ?? 0;
      s = press(s, "health-department:inspect");
      expect(player(s.town, 0).money).toBe(100_000 - R.health.inspect.price);
      const b = pbOfPlayer(s.town);
      if (b.boost) {
        passes++;
        expect(player(s.town, 0).expanded?.reviews).toBe(before + R.health.inspect.reviews);
        expect(b.boost.until).toBe(s.town.day + R.health.inspect.days - 1);
        expect(enabled(s.view, "health-department:inspect")).toBe(false);
      } else {
        fails++;
        expect(b.citation).toBe(R.health.inspect.fine);
        expect(player(s.town, 0).expanded?.reviews).toBe(before + R.health.inspect.failReviews);
        // Another inspection waits until the fine is paid.
        expect(enabled(s.view, "health-department:inspect")).toBe(false);
        expect(enabled(s.view, "health-department:fine")).toBe(true);
      }
    }
    expect(passes).toBeGreaterThan(0);
    expect(fails).toBeGreaterThan(0);
  });

  it("B2.2 a clean bill of health is sure, costs karma and money, and runs out", () => {
    let s = at("health-department", (t) => {
      player(t, 0).karma = 50;
    });
    const before = player(s.town, 0).expanded?.reviews ?? 0;
    s = pressRT(s, "health-department:buy");
    expect(player(s.town, 0).money).toBe(100_000 - R.health.buy.price);
    expect(player(s.town, 0).karma).toBe(50 + R.health.buy.karma);
    expect(player(s.town, 0).expanded?.reviews).toBe(before + R.health.buy.reviews);
    expect(enabled(s.view, "health-department:buy")).toBe(false);
    expect(button(s.view, "health-department:buy")?.hint).toBeTruthy();
    expect(pbOfPlayer(s.town).boost?.amount).toBe(R.health.buy.reviews);
  });

  it("B2.2 the boost is taken back at the new day after it ends", () => {
    const { town, ctx } = xtown();
    const t = edit(town, (x) => {
      const p = player(x, 0);
      if (p.expanded) p.expanded.reviews = 3;
      withState(x, (s) => {
        s.boost = { amount: 3, until: 0 };
      });
    });
    const s = seat(t, ctx, 0);
    expect(player(s.town, 0).expanded?.reviews).toBe(0);
    expect(pbOfPlayer(s.town).boost).toBeNull();
  });

  it("B2.3 the fine is paid in money and gives the lost word of mouth back", () => {
    let s = at("health-department", (t) => {
      withState(t, (b) => {
        b.citation = 500;
      });
      const p = player(t, 0);
      if (p.expanded) p.expanded.reviews = -2;
    });
    expect(enabled(s.view, "health-department:fine")).toBe(true);
    s = pressRT(s, "health-department:fine");
    expect(player(s.town, 0).money).toBe(100_000 - 500);
    expect(player(s.town, 0).expanded?.reviews).toBe(0);
    expect(pbOfPlayer(s.town).citation).toBe(0);
    expect(enabled(s.view, "health-department:fine")).toBe(false);
    const broke = at(
      "health-department",
      (t) => {
        withState(t, (b) => {
          b.citation = 500;
        });
        player(t, 0).money = 100;
      },
      100,
    );
    expect(enabled(broke.view, "health-department:fine")).toBe(false);
  });

  it("B2.4 a complaint needs low karma, money, and a rival that is not peaceful", () => {
    const good = at("health-department", (t) => {
      player(t, 0).karma = 20;
    });
    expect(enabled(good.view, "health-department:complaint")).toBe(true);
    const nice = at("health-department", (t) => {
      player(t, 0).karma = 80;
    });
    expect(enabled(nice.view, "health-department:complaint")).toBe(false);
    const poor = at(
      "health-department",
      (t) => {
        player(t, 0).karma = 20;
      },
      R.health.complaint.price - 1,
    );
    expect(enabled(poor.view, "health-department:complaint")).toBe(false);
    const peaceful = at("health-department", (t) => {
      player(t, 0).karma = 20;
      for (const p of t.players) if (p.id !== 0 && p.expanded) p.expanded.rivalry = "peaceful";
    });
    expect(enabled(peaceful.view, "health-department:complaint")).toBe(false);
  });

  it("B2.4 a complaint costs the target word of mouth; luck 100 always lands", () => {
    let s = at("health-department", (t) => {
      player(t, 0).karma = 20;
      player(t, 0).luck = 100;
    });
    s = press(s, "health-department:complaint");
    expect(s.view.overlay?.kind).toBe("playerPicker");
    const target =
      s.view.overlay?.kind === "playerPicker" ? (s.view.overlay.players[0]?.id ?? -1) : -1;
    expect(target).toBeGreaterThan(0);
    const before = player(s.town, target).expanded?.reviews ?? 0;
    s = act(s, {
      type: "pickPlayer",
      overlayId: "health-department:complaintpick",
      playerId: target,
    });
    expect(player(s.town, target).expanded?.reviews).toBe(
      before + R.health.complaint.targetReviews,
    );
    expect(player(s.town, 0).money).toBe(100_000 - R.health.complaint.price);
    expect(player(s.town, 0).karma).toBe(20 + R.health.complaint.karma);
    expect(enabled(s.view, "health-department:complaint")).toBe(false);
  });

  it("B2.4 a certified target is untouched, and a backfire fines the filer (luck 1)", () => {
    let s = at("health-department", (t) => {
      player(t, 0).karma = 20;
      for (const p of t.players)
        if (p.id !== 0 && p.expanded) {
          delete p.expanded.life;
        }
      const other = player(t, 1);
      if (other.expanded) {
        other.expanded.life = {
          monuments: 0,
          injuries: [],
          healedDay: 0,
          leads: 0,
          holyWater: 0,
          permits: [],
          certifiedUntil: 99,
          savings: 0,
          loan: null,
          deadbeat: false,
          armor: false,
          bodyguardDay: 0,
          mayor: false,
          chain: null,
          leftChainDay: 0,
          today: {
            day: 0,
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
          },
          spent: {},
        };
      }
    });
    const reviews = player(s.town, 1).expanded?.reviews ?? 0;
    s = press(s, "health-department:complaint");
    s = act(s, { type: "pickPlayer", overlayId: "health-department:complaintpick", playerId: 1 });
    expect(player(s.town, 1).expanded?.reviews).toBe(reviews);
    expect(text(s.view)).toMatch(/current certificate/);
    let backfired = 0;
    for (let seed = 1; seed <= 40; seed++) {
      let q = at(
        "health-department",
        (t) => {
          player(t, 0).karma = 20;
          player(t, 0).luck = 1;
        },
        100_000,
        seed,
      );
      q = press(q, "health-department:complaint");
      const target =
        q.view.overlay?.kind === "playerPicker" ? (q.view.overlay.players[0]?.id ?? -1) : -1;
      q = act(q, {
        type: "pickPlayer",
        overlayId: "health-department:complaintpick",
        playerId: target,
      });
      if (player(q.town, 0).money === 100_000 - R.health.complaint.price - R.health.complaint.fine)
        backfired++;
    }
    expect(backfired).toBeGreaterThan(0);
  });

  it("B2.4 the target is told by mail and the paper reports it", () => {
    let s = at("health-department", (t) => {
      player(t, 0).karma = 20;
      player(t, 0).luck = 100;
    });
    s = press(s, "health-department:complaint");
    s = act(s, { type: "pickPlayer", overlayId: "health-department:complaintpick", playerId: 1 });
    const crime = s.town.news[String(s.town.day)]?.crime ?? "";
    expect(crime).toMatch(/COMPLAINT AT/);
  });
});

describe("B3 Cousin Sal's pawn shop", () => {
  it("B3.1 loot is pawned for money, more for a Grave Robber; nothing to pawn is disabled", () => {
    let s = at("pawn-shop");
    expect(enabled(s.view, "pawn-shop:loot")).toBe(false);
    expect(button(s.view, "pawn-shop:loot")?.hint).toBeTruthy();
    s = at("pawn-shop", (t) => {
      player(t, 0).karma = 50;
      withState(t, (b) => {
        b.loot = 2;
      });
    });
    expect(enabled(s.view, "pawn-shop:loot")).toBe(true);
    s = pressRT(s, "pawn-shop:loot");
    expect(player(s.town, 0).money).toBe(100_000 + 2 * R.pawn.loot.price);
    expect(pbOfPlayer(s.town).loot).toBe(0);
    let g = at("pawn-shop", (t) => {
      player(t, 0).karma = 10;
      withState(t, (b) => {
        b.loot = 1;
      });
    });
    g = press(g, "pawn-shop:loot");
    expect(player(g.town, 0).money).toBe(100_000 + R.pawn.loot.price + R.pawn.loot.evilBonus);
  });

  it("B3.1 a body-preparation choice that takes something adds loot (capped)", () => {
    let found = false;
    for (let seed = 1; seed <= 120 && !found; seed++) {
      let p = meet(atXDesk({ seed }));
      p = px(p, "neg:done");
      if (!ids(p.view).includes("prep:start")) continue;
      p = px(p, "prep:start");
      const taking = p.view.prep?.choices.find((c) => c.evil && (c.effects.money ?? 0) > 0);
      if (!taking) continue;
      found = true;
      p = px(p, taking.buttonId);
      expect(p.town.players[0]?.expanded?.placesB?.loot).toBe(1);
    }
    expect(found).toBe(true);
  });

  it("B3.2 a second-hand lot is cheaper than the store, checked before it is enabled", () => {
    const s = at("pawn-shop");
    const wood = button(s.view, "pawn-shop:lot:wood");
    const silver = button(s.view, "pawn-shop:lot:silver");
    expect(enabled(s.view, "pawn-shop:lot:wood")).toBe(true);
    expect(cashOf(wood)).toBeGreaterThan(0);
    expect(cashOf(silver)).toBeGreaterThan(cashOf(wood) / 3);
    const poor = at("pawn-shop", undefined, cashOf(wood) - 1);
    expect(enabled(poor.view, "pawn-shop:lot:wood")).toBe(false);
    const full = at("pawn-shop", (t) => {
      const x = player(t, 0).expanded;
      if (x) x.stock = [6, 0, 0];
    });
    expect(enabled(full.view, "pawn-shop:lot:wood")).toBe(false);
  });

  it("B3.2 a lot adds its caskets, or leaves one when it is bad; one lot a day", () => {
    let good = 0;
    let bad = 0;
    for (let seed = 1; seed <= 60; seed++) {
      let s = at(
        "pawn-shop",
        (t) => {
          const x = player(t, 0).expanded;
          if (x) x.stock = [0, 0, 0];
        },
        100_000,
        seed,
      );
      const price = cashOf(button(s.view, "pawn-shop:lot:wood"));
      s = press(s, "pawn-shop:lot:wood");
      expect(player(s.town, 0).money).toBe(100_000 - price);
      const got = player(s.town, 0).expanded?.stock[0] ?? 0;
      if (got === R.pawn.lots[0]?.count) good++;
      else {
        expect(got).toBe(R.pawn.bad.keep);
        bad++;
      }
      expect(enabled(s.view, "pawn-shop:lot:wood")).toBe(false);
      expect(enabled(s.view, "pawn-shop:lot:silver")).toBe(false);
    }
    expect(good).toBeGreaterThan(bad);
    expect(bad).toBeGreaterThan(0);
  });

  it("B3.2 a pawn shop lot replays identically after a save round trip", () => {
    pressRT(at("pawn-shop"), "pawn-shop:lot:silver");
  });
});

describe("B4 Mourne & Sons", () => {
  it("B4.1 spying costs money; success gives a cheapness tell on the next family", () => {
    const poor = at("mournes", undefined, R.mournes.spy.price - 1);
    expect(enabled(poor.view, "mournes:spy")).toBe(false);
    let s = at("mournes", (t) => {
      player(t, 0).luck = 100;
    });
    s = pressRT(s, "mournes:spy");
    expect(player(s.town, 0).money).toBe(100_000 - R.mournes.spy.price);
    expect(pbOfPlayer(s.town).tip).toEqual({ loved: false, cheap: true, traits: 0 });
    expect(enabled(s.view, "mournes:spy")).toBe(false);
    s = act(press(s, "go:map"), { type: "visit", placeId: "funeral-home" });
    s = press(s, "desk:wait");
    expect(s.town.sessions[0]?.customer?.expanded?.told.cheap).toBe(true);
    expect(text(s.view)).toMatch(/Scrawled in the margin/);
  });

  it("B4.1 a spy who is caught loses karma and word of mouth (luck 1)", () => {
    let caught = 0;
    for (let seed = 1; seed <= 40; seed++) {
      let s = at(
        "mournes",
        (t) => {
          player(t, 0).luck = 1;
          player(t, 0).karma = 50;
        },
        100_000,
        seed,
      );
      s = press(s, "mournes:spy");
      if (!pbOfPlayer(s.town).tip) {
        caught++;
        expect(player(s.town, 0).karma).toBe(50 + R.mournes.spy.failKarma);
        expect(player(s.town, 0).expanded?.reviews).toBe(R.mournes.spy.failReviews);
      }
    }
    expect(caught).toBeGreaterThan(0);
  });

  it("B4.2 the price war: one stand a day; undercutting is a luck bet on word of mouth", () => {
    let s = at("mournes", (t) => {
      player(t, 0).luck = 100;
    });
    s = pressRT(s, "mournes:undercut");
    expect(player(s.town, 0).money).toBe(100_000 - R.mournes.undercut.price);
    expect(player(s.town, 0).expanded?.reviews).toBe(R.mournes.undercut.reviews);
    expect(enabled(s.view, "mournes:undercut")).toBe(false);
    expect(enabled(s.view, "mournes:hold")).toBe(false);
    let lost = 0;
    for (let seed = 1; seed <= 40; seed++) {
      let q = at(
        "mournes",
        (t) => {
          player(t, 0).luck = 1;
        },
        100_000,
        seed,
      );
      q = press(q, "mournes:undercut");
      if ((player(q.town, 0).expanded?.reviews ?? 0) === R.mournes.undercut.failReviews) lost++;
    }
    expect(lost).toBeGreaterThan(0);
    const poor = at("mournes", undefined, R.mournes.undercut.price - 1);
    expect(enabled(poor.view, "mournes:undercut")).toBe(false);
    expect(enabled(poor.view, "mournes:hold")).toBe(true);
  });

  it("B4.2 holding your prices is free and gives karma, once a day", () => {
    let s = at("mournes", (t) => {
      player(t, 0).karma = 50;
    });
    s = pressRT(s, "mournes:hold");
    expect(player(s.town, 0).money).toBe(100_000);
    expect(player(s.town, 0).karma).toBe(50 + R.mournes.hold.karma);
    expect(enabled(s.view, "mournes:undercut")).toBe(false);
  });

  it("B4.3 a truce costs money, gives karma and a lead, and closes the war and the spying", () => {
    const poor = at("mournes", undefined, R.mournes.truce.price - 1);
    expect(enabled(poor.view, "mournes:truce")).toBe(false);
    let s = at("mournes", (t) => {
      player(t, 0).karma = 50;
    });
    s = pressRT(s, "mournes:truce");
    expect(player(s.town, 0).money).toBe(100_000 - R.mournes.truce.price);
    expect(player(s.town, 0).karma).toBe(50 + R.mournes.truce.karma);
    expect(player(s.town, 0).expanded?.life?.leads).toBe(R.mournes.truce.leads);
    expect(pbOfPlayer(s.town).truceUntil).toBe(s.town.day + R.mournes.truce.days - 1);
    for (const id of ["spy", "undercut", "hold", "truce"])
      expect(enabled(s.view, `mournes:${id}`)).toBe(false);
    expect(text(s.view)).toMatch(/truce holds/);
  });

  it("B4.3 the truce ends after its days", () => {
    const { town, ctx } = xtown();
    let t = rich(town, (x) => {
      withState(x, (b) => {
        b.truceUntil = 3;
      });
    });
    t = midnight(t, ctx, 4);
    const s = visit(seat(t, ctx, 0), "mournes");
    expect(enabled(s.view, "mournes:truce")).toBe(true);
  });
});

describe("B5 old saves", () => {
  it("a player without batch-B state gets it on first use", () => {
    const s = at("coroner");
    expect(player(s.town, 0).expanded?.placesB).toBeDefined();
    expect(player(s.town, 0).expanded?.placesB?.today.day).toBe(s.town.day);
  });
});
