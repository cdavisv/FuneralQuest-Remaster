/**
 * The batch-A places (docs/expanded-rules.md section 30): the Police Station, the
 * Crematorium, the Florist and the Town Gazette. Every action, costs checked
 * before buttons are enabled, deterministic draws (a save round trip mid-flow
 * plays on identically) and the two seams in the sale and the fights.
 */
import { describe, expect, it } from "vitest";
import { PLACES_A_STARTER } from "../src/expanded/content/townPlacesA.js";
import { bouquetPrice } from "../src/expanded/town/florist.js";
import { gazetteMorning } from "../src/expanded/town/gazette.js";
import { placesASaleExtras, recordAttack } from "../src/expanded/town/placesAHooks.js";
import { newPlacesA, placesAOf } from "../src/expanded/town/placesAState.js";
import { EXPANDED_TOWN, expandedBattleBp, type TownState, Turn, townLife } from "../src/index.js";
import type { xcontext } from "./support/expanded.js";
import {
  act,
  button,
  crimePage,
  edit,
  enabled,
  frontPage,
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

const R = EXPANDED_TOWN.placesA;

function funded(
  fn?: (t: TownState) => void,
  players = 3,
): { town: TownState; ctx: ReturnType<typeof xcontext> } {
  const { town, ctx } = xtown({ players });
  return {
    ctx,
    town: edit(town, (t) => {
      for (const p of t.players) {
        p.money = 50_000;
        p.bp = 100;
        p.karma = 50;
        p.luck = 50;
      }
      fn?.(t);
    }),
  };
}

function at(place: string, fn?: (t: TownState) => void, id = 0): Seat {
  const { town, ctx } = funded(fn);
  return visit(seat(town, ctx, id), place);
}

/** Gives player `victim` an attack by `by` on the current day. */
function attacked(t: TownState, victim: number, by: number, day = t.day): void {
  const x = player(t, victim).expanded;
  if (!x) throw new Error("not expanded");
  x.placesA ??= newPlacesA();
  x.placesA.attacks.push({ by, day });
}

describe("the map", () => {
  it("lists the four places, each with a module", () => {
    const s = visit(seat(funded().town, funded().ctx, 0), "police-station");
    expect(s.view.title).toBe("Police Station");
    for (const place of ["crematorium", "florist", "gazette"]) {
      const v = visit(seat(funded().town, funded().ctx, 0), place);
      expect(v.view.title).toBe(PLACES_A_STARTER[place as "florist"].title);
    }
  });
});

describe("the Police Station", () => {
  it("report and settle are disabled with a reason when nobody attacked you", () => {
    const s = at("police-station");
    expect(enabled(s.view, "police:report")).toBe(false);
    expect(button(s.view, "police:report")?.hint).toBeTruthy();
    expect(enabled(s.view, "police:settle")).toBe(false);
  });

  it("a report fines the attacker, pays you half and makes the paper, once a day", () => {
    let s = at("police-station", (t) => {
      attacked(t, 0, 1);
      attacked(t, 0, 2);
      player(t, 1).money = 300;
    });
    s = pressRT(s, "police:report");
    expect(s.view.overlay?.kind).toBe("playerPicker");
    s = act(s, { type: "pickPlayer", overlayId: "police:reportpick", playerId: 1 });
    const fine = 300;
    expect(player(s.town, 1).money).toBe(0);
    expect(player(s.town, 0).money).toBe(50_000 + Math.floor(fine * R.police.report.share));
    expect(player(s.town, 0).karma).toBe(50 + R.police.report.karma);
    expect(crimePage(s.town)).toMatch(/fined/);
    // One report a day, even with a second attacker waiting.
    expect(enabled(s.view, "police:report")).toBe(false);
    expect(enabled(s.view, "police:settle")).toBe(false);
  });

  it("a full fine is the rules' fine", () => {
    let s = at("police-station", (t) => attacked(t, 0, 1));
    s = press(s, "police:report");
    s = act(s, { type: "pickPlayer", overlayId: "police:reportpick", playerId: 1 });
    expect(player(s.town, 1).money).toBe(50_000 - R.police.report.fine);
    expect(player(s.town, 0).money).toBe(50_000 + R.police.report.fine * R.police.report.share);
  });

  it("an attack older than the window cannot be reported", () => {
    const { town, ctx } = funded();
    const t = midnight(
      edit(town, (x) => attacked(x, 0, 1)),
      ctx,
      R.police.report.windowDays,
    );
    const s = visit(seat(t, ctx, 0), "police-station");
    expect(enabled(s.view, "police:report")).toBe(false);
  });

  it("a settlement pays you from the rival's pocket, costs karma and files nothing", () => {
    let s = at("police-station", (t) => attacked(t, 0, 1));
    s = press(s, "police:settle");
    s = act(s, { type: "pickPlayer", overlayId: "police:settlepick", playerId: 1 });
    expect(player(s.town, 1).money).toBe(50_000 - R.police.settle.amount);
    expect(player(s.town, 0).money).toBe(50_000 + R.police.settle.amount);
    expect(player(s.town, 0).karma).toBe(50 + R.police.settle.karma);
    expect(crimePage(s.town)).toBe("");
  });

  it("cancelling the picker costs nothing", () => {
    let s = at("police-station", (t) => attacked(t, 0, 1));
    s = press(s, "police:report");
    s = act(s, { type: "pickPlayer", overlayId: "police:reportpick", playerId: null });
    expect(player(s.town, 0).money).toBe(50_000);
    expect(enabled(s.view, "police:report")).toBe(true);
  });

  it("a patrol costs money, protects the night, and is shown disabled when poor or already hired", () => {
    const poor = at("police-station", (t) => {
      player(t, 0).money = R.police.patrol.price - 1;
    });
    expect(enabled(poor.view, "police:patrol")).toBe(false);
    expect(button(poor.view, "police:patrol")?.hint).toBeTruthy();
    let s = at("police-station");
    s = pressRT(s, "police:patrol");
    expect(player(s.town, 0).policeProtected).toBe(true);
    expect(player(s.town, 0).money).toBe(50_000 - R.police.patrol.price);
    expect(enabled(s.view, "police:patrol")).toBe(false);
    expect(enabled(s.view, "police:backdoor")).toBe(false);
  });

  it("a parlor ahead of the town pays more for the car, at the front desk and the back door alike", () => {
    // 1,000 BP ahead of the average of the other two parlors (100 each).
    const ahead = 1000;
    const extra = Math.ceil((ahead * R.police.aheadPerBp) / 100) * 100;
    expect(extra).toBeGreaterThan(0);
    const lead = (t: TownState): void => {
      player(t, 0).bp = 100 + ahead;
    };
    let s = at("police-station", lead);
    expect(button(s.view, "police:patrol")?.detail).toBe(
      `$${(R.police.patrol.price + extra).toLocaleString("en-US")}`,
    );
    expect(button(s.view, "police:backdoor")?.detail).toBe(
      `$${(R.police.backdoor.price + extra).toLocaleString("en-US")}`,
    );
    // The sergeant says why, with the amount as money.
    expect(text(s.view)).toContain(`$${extra.toLocaleString("en-US")} over the usual`);
    s = pressRT(s, "police:patrol");
    expect(player(s.town, 0).policeProtected).toBe(true);
    expect(player(s.town, 0).money).toBe(50_000 - R.police.patrol.price - extra);
    expect(text(s.view)).not.toContain("over the usual");

    // The listed price alone is not enough for the leader.
    const short = at("police-station", (t) => {
      lead(t);
      player(t, 0).money = R.police.patrol.price + extra - 1;
    });
    expect(enabled(short.view, "police:patrol")).toBe(false);
    expect(button(short.view, "police:patrol")?.hint).toBeTruthy();

    // The back door takes the same extra.
    let b = at("police-station", lead);
    b = pressRT(b, "police:backdoor");
    expect(player(b.town, 0).money).toBe(50_000 - R.police.backdoor.price - extra);
  });

  it("a parlor at or below the town's average pays the listed price", () => {
    for (const mine of [100, 40]) {
      const s = at("police-station", (t) => {
        player(t, 0).bp = mine;
        player(t, 1).bp = 5000;
      });
      expect(button(s.view, "police:patrol")?.detail).toBe(
        `$${R.police.patrol.price.toLocaleString("en-US")}`,
      );
      expect(button(s.view, "police:backdoor")?.detail).toBe(
        `$${R.police.backdoor.price.toLocaleString("en-US")}`,
      );
      expect(text(s.view)).not.toContain("over the usual");
    }
  });

  it("the average is of the other open parlors, and a small lead rounds up to $100", () => {
    // Player 2 has closed: its BP is not counted. Player 1 has 100, so the lead is 3 BP.
    const s = at("police-station", (t) => {
      player(t, 0).bp = 103;
      player(t, 2).bp = 1_000_000;
      player(t, 2).active = false;
    });
    const extra = Math.ceil((3 * R.police.aheadPerBp) / 100) * 100;
    expect(extra).toBe(100);
    expect(button(s.view, "police:patrol")?.detail).toBe(
      `$${(R.police.patrol.price + extra).toLocaleString("en-US")}`,
    );
    // Alone in town there is nobody to be ahead of.
    const { town, ctx } = funded((t) => {
      player(t, 0).bp = 9000;
    }, 1);
    const alone = visit(seat(town, ctx, 0), "police-station");
    expect(button(alone.view, "police:patrol")?.detail).toBe(
      `$${R.police.patrol.price.toLocaleString("en-US")}`,
    );
  });

  it("the back door always costs its price and karma; the draw is the same after a save", () => {
    let s = at("police-station");
    s = pressRT(s, "police:backdoor");
    const p = player(s.town, 0);
    expect(p.money).toBe(50_000 - R.police.backdoor.price);
    expect(p.karma).toBe(50 + R.police.backdoor.karma);
    expect(typeof p.policeProtected).toBe("boolean");
  });

  it("the back door works for some seeds and fails for others", () => {
    const results = new Set<boolean>();
    for (let seed = 1; seed < 40 && results.size < 2; seed++) {
      const { town, ctx } = xtown({ seed });
      const t = edit(town, (x) => {
        player(x, 0).money = 10_000;
      });
      const s = press(visit(seat(t, ctx, 0), "police-station"), "police:backdoor");
      results.add(player(s.town, 0).policeProtected);
    }
    expect(results.size).toBe(2);
  });

  it("peaceful parlors are shown the patrol disabled (nobody can visit them)", () => {
    const s = at("police-station", (t) => {
      const x = player(t, 0).expanded;
      if (x) x.rivalry = "peaceful";
    });
    expect(enabled(s.view, "police:patrol")).toBe(false);
  });

  it("a fight the attacker wins is remembered by the victim; self-defence is not", () => {
    const { town, ctx } = funded();
    const turn = new Turn(town, ctx, 1);
    expandedBattleBp(turn, player(town, 1), player(town, 0), false);
    expect(placesAOf(town, player(town, 0)).attacks).toEqual([{ by: 1, day: town.day }]);
    expandedBattleBp(turn, player(town, 0), player(town, 2), true);
    expect(placesAOf(town, player(town, 2)).attacks).toEqual([]);
  });

  it("recordAttack remembers who hit whom, a self-hit or Classic player never", () => {
    const { town, ctx } = funded();
    const t = edit(town, () => {});
    const turn = new Turn(t, ctx, 0);
    recordAttack(turn, player(t, 1), player(t, 0));
    recordAttack(turn, player(t, 0), player(t, 0));
    expect(placesAOf(t, player(t, 0)).attacks).toEqual([{ by: 1, day: t.day }]);
    for (let i = 0; i < 20; i++) recordAttack(turn, player(t, 2), player(t, 0));
    expect(placesAOf(t, player(t, 0)).attacks.length).toBe(R.police.maxAttacks);
  });
});

describe("the Crematorium", () => {
  it("renting a slot costs money and is capped; bulk adds three", () => {
    let s = at("crematorium");
    s = pressRT(s, "crematorium:rent");
    expect(player(s.town, 0).money).toBe(50_000 - R.crematorium.oven.price);
    expect(player(s.town, 0).expanded?.placesA?.oven.slots).toBe(1);
    s = pressRT(s, "crematorium:bulk");
    expect(player(s.town, 0).expanded?.placesA?.oven.slots).toBe(1 + R.crematorium.oven.bulkCount);
    expect(player(s.town, 0).money).toBe(
      50_000 - R.crematorium.oven.price - R.crematorium.oven.bulkPrice,
    );
    // The rack (4) is full.
    expect(enabled(s.view, "crematorium:rent")).toBe(false);
    expect(enabled(s.view, "crematorium:bulk")).toBe(false);
    expect(button(s.view, "crematorium:rent")?.hint).toBeTruthy();
  });

  it("a poor player cannot rent (buttons off with a hint)", () => {
    const s = at("crematorium", (t) => {
      player(t, 0).money = R.crematorium.oven.price - 1;
    });
    expect(enabled(s.view, "crematorium:rent")).toBe(false);
    expect(button(s.view, "crematorium:rent")?.hint).toBeTruthy();
    expect(enabled(s.view, "crematorium:bulk")).toBe(false);
  });

  it("the crematory permit takes 15% off", () => {
    let s = at("crematorium", (t) => {
      const x = player(t, 0).expanded;
      if (x) {
        x.life = {
          monuments: 0,
          injuries: [],
          healedDay: 0,
          leads: 0,
          holyWater: 0,
          permits: ["crematory"],
          certifiedUntil: 0,
          savings: 0,
          loan: null,
          deadbeat: false,
          armor: false,
          bodyguardDay: 0,
          mayor: false,
          chain: null,
          leftChainDay: 0,
          today: {
            day: t.day,
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
    s = press(s, "crematorium:rent");
    expect(player(s.town, 0).money).toBe(
      50_000 - Math.round(R.crematorium.oven.price * R.crematorium.oven.permitMult),
    );
  });

  it("slots run out after their days", () => {
    const { town, ctx } = funded();
    let t = edit(town, () => {});
    let s = press(visit(seat(t, ctx, 0), "crematorium"), "crematorium:rent");
    t = s.town;
    t = midnight(t, ctx, R.crematorium.oven.days);
    s = visit(seat(t, ctx, 0), "crematorium");
    // No slot is held any more, so no count and no day are named (docs/expanded-audit.md).
    expect(text(s.view)).toMatch(/no slots reserved/);
    expect(text(s.view)).not.toMatch(/until day/);
  });

  it("a parlor that never rented is not told about day 0", () => {
    const { town, ctx } = funded();
    const s = visit(seat(town, ctx, 0), "crematorium");
    expect(text(s.view)).toMatch(/no slots reserved/);
    expect(text(s.view)).not.toMatch(/until day/);
  });

  it("scattering ashes gives karma and luck per urn; pressing them gives cash and bad karma", () => {
    const setup = (t: TownState) => {
      const x = player(t, 0).expanded;
      if (x) x.record.cremations = 2;
    };
    let s = at("crematorium", setup);
    s = pressRT(s, "crematorium:scatter");
    expect(player(s.town, 0).karma).toBe(50 + 2 * R.crematorium.ashes.scatter.karma);
    expect(player(s.town, 0).luck).toBe(50 + 2 * R.crematorium.ashes.scatter.luck);
    expect(enabled(s.view, "crematorium:scatter")).toBe(false);
    let p = at("crematorium", setup);
    p = pressRT(p, "crematorium:diamonds");
    expect(player(p.town, 0).money).toBe(50_000 + 2 * R.crematorium.ashes.press.money);
    expect(player(p.town, 0).karma).toBe(50 + 2 * R.crematorium.ashes.press.karma);
  });

  it("with no cremations the ash buttons are disabled", () => {
    const s = at("crematorium");
    expect(enabled(s.view, "crematorium:scatter")).toBe(false);
    expect(enabled(s.view, "crematorium:diamonds")).toBe(false);
  });
});

describe("the Florist", () => {
  it("a bouquet costs the day's price, a bundle is cheaper per stem, the shelf holds six", () => {
    let s = at("florist");
    const turn = new Turn(s.town, s.ctx, 0);
    const price = bouquetPrice(turn);
    s = pressRT(s, "florist:buy");
    expect(player(s.town, 0).money).toBe(50_000 - price);
    s = pressRT(s, "florist:bundle");
    expect(player(s.town, 0).expanded?.placesA?.flowers.stock).toBe(1 + R.florist.bouquet.bundle);
    expect(player(s.town, 0).money).toBe(
      50_000 - price - Math.round(R.florist.bouquet.bundle * price * R.florist.bouquet.bundleShare),
    );
    expect(enabled(s.view, "florist:bundle")).toBe(false);
    s = press(s, "florist:buy");
    expect(enabled(s.view, "florist:buy")).toBe(false);
    expect(button(s.view, "florist:buy")?.hint).toBeTruthy();
  });

  it("the price follows the weather", () => {
    const { town, ctx } = funded((t) => {
      townLife(t).today = { day: t.day, news: null, weather: "heat" };
    });
    const turn = new Turn(town, ctx, 0);
    expect(bouquetPrice(turn)).toBe(
      Math.round(R.florist.bouquet.price * (R.florist.weather.heat ?? 1)),
    );
    townLife(town).today.weather = "rain";
    expect(bouquetPrice(turn)).toBe(
      Math.round(R.florist.bouquet.price * (R.florist.weather.rain ?? 1)),
    );
    townLife(town).today.weather = "clear";
    expect(bouquetPrice(turn)).toBe(R.florist.bouquet.price);
  });

  it("a poor player cannot buy", () => {
    const s = at("florist", (t) => {
      player(t, 0).money = 10;
    });
    expect(enabled(s.view, "florist:buy")).toBe(false);
    expect(enabled(s.view, "florist:church")).toBe(false);
  });

  it("one wreath a day: the church one gives karma and word of mouth, the ward one luck", () => {
    let s = at("florist");
    s = pressRT(s, "florist:church");
    const p = player(s.town, 0);
    expect(p.money).toBe(50_000 - R.florist.wreath.price);
    expect(p.karma).toBe(50 + R.florist.wreath.church.karma);
    expect(p.expanded?.reviews).toBe(R.florist.wreath.church.reviews);
    expect(enabled(s.view, "florist:ward")).toBe(false);
    let w = at("florist");
    w = pressRT(w, "florist:ward");
    expect(player(w.town, 0).luck).toBe(50 + R.florist.wreath.ward.luck);
    expect(enabled(w.view, "florist:church")).toBe(false);
  });

  it("flowers wilt after their days", () => {
    const { town, ctx } = funded();
    let s = press(visit(seat(town, ctx, 0), "florist"), "florist:buy");
    const t = midnight(s.town, ctx, R.florist.bouquet.days);
    s = visit(seat(t, ctx, 0), "florist");
    expect(text(s.view)).toMatch(/You have 0 in the cooler/);
  });
});

describe("sale extras: oven slots and bouquets (no random draws)", () => {
  function makeTurn(town: TownState, ctx: ReturnType<typeof xcontext>) {
    const s = press(seat(town, ctx, 0), "desk:wait");
    return new Turn(s.town, ctx, 0);
  }

  it("a rented slot adds the wholesale saving to a cremation, once per slot", () => {
    const { town, ctx } = funded();
    const turn = makeTurn(town, ctx);
    const state = placesAOf(turn.town, turn.player);
    state.oven = { slots: 1, until: turn.town.day };
    const c = turn.session.customer;
    const x = c.expanded;
    if (!x) throw new Error("no customer record");
    x.track = "cremation";
    const first = placesASaleExtras(turn, c);
    expect(first.money).toBeGreaterThan(0);
    expect(first.note).toMatch(/oven slot/);
    expect(state.oven.slots).toBe(0);
    expect(placesASaleExtras(turn, c).money).toBe(0);
  });

  it("a burial uses no oven slot", () => {
    const { town, ctx } = funded();
    const turn = makeTurn(town, ctx);
    const state = placesAOf(turn.town, turn.player);
    state.oven = { slots: 2, until: turn.town.day };
    const x = turn.session.customer.expanded;
    if (!x) throw new Error("no customer record");
    x.track = "burial";
    expect(placesASaleExtras(turn, turn.session.customer).money).toBe(0);
    expect(state.oven.slots).toBe(2);
  });

  it("each fresh bouquet pays a share of a flowers line, capped; none when wilted", () => {
    const { town, ctx } = funded();
    const turn = makeTurn(town, ctx);
    const state = placesAOf(turn.town, turn.player);
    const c = turn.session.customer;
    const x = c.expanded;
    if (!x) throw new Error("no customer record");
    x.track = "burial";
    x.packages = { flowers: 1 };
    state.flowers = { stock: 3, until: turn.town.day };
    const out = placesASaleExtras(turn, c);
    const price =
      turn.content.expanded?.packages.find((p) => p.id === "flowers")?.tiers[1]?.price ?? 0;
    expect(out.money).toBe(
      Math.min(R.florist.payout.max, Math.round(price * R.florist.payout.share)),
    );
    expect(state.flowers.stock).toBe(2);
    state.flowers = { stock: 3, until: turn.town.day - 1 };
    expect(placesASaleExtras(turn, c).money).toBe(0);
    expect(state.flowers.stock).toBe(3);
  });
});

describe("the Town Gazette", () => {
  it("a display advert always sends a customer tomorrow, and costs its price", () => {
    const { town, ctx } = funded();
    let s = pressRT(visit(seat(town, ctx, 0), "gazette"), "gazette:display");
    expect(player(s.town, 0).money).toBe(50_000 - R.gazette.display.price);
    expect(player(s.town, 0).expanded?.life?.leads ?? 0).toBe(0);
    // Only one advert a day.
    expect(enabled(s.view, "gazette:classified")).toBe(false);
    expect(enabled(s.view, "gazette:display")).toBe(false);
    const t = midnight(s.town, ctx);
    s = seat(t, ctx, 0);
    expect(player(s.town, 0).expanded?.life?.leads).toBe(1);
    expect(s.seen).toMatch(/new customer\(s\) waiting/);
  });

  it("the advert's customer is delivered once and respects the lead limit", () => {
    const { town, ctx } = funded();
    const t = edit(town, (x) => {
      placesAOf(x, player(x, 0)).ad = { leads: 5, day: x.day };
    });
    const turn = new Turn(midnight(t, ctx), ctx, 0);
    const first = gazetteMorning(turn);
    expect(first).not.toBe("");
    expect(gazetteMorning(turn)).toBe("");
    expect(turn.player.expanded?.life?.leads ?? 0).toBeLessThanOrEqual(
      EXPANDED_TOWN.hospital.lead.max,
    );
  });

  it("a classified is a luck draw: the same after a save, and both outcomes happen", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed < 60 && seen.size < 2; seed++) {
      const { town, ctx } = xtown({ seed });
      const t = edit(town, (x) => {
        player(x, 0).money = 5000;
      });
      const s = pressRT(visit(seat(t, ctx, 0), "gazette"), "gazette:classified");
      expect(player(s.town, 0).money).toBe(5000 - R.gazette.classified.price);
      seen.add(String(player(s.town, 0).expanded?.placesA?.ad.leads));
    }
    expect(seen.size).toBe(2);
  });

  it("a puff piece buys word of mouth and a line on the front page, once a day", () => {
    let s = at("gazette");
    s = pressRT(s, "gazette:puff");
    expect(player(s.town, 0).money).toBe(50_000 - R.gazette.puff.price);
    expect(player(s.town, 0).expanded?.reviews).toBe(R.gazette.puff.reviews);
    expect(frontPage(s.town)).toContain(player(s.town, 0).name);
    expect(enabled(s.view, "gazette:puff")).toBe(false);
  });

  it("poor players see every purchase disabled with a reason", () => {
    const s = at("gazette", (t) => {
      player(t, 0).money = 10;
    });
    for (const id of ["classified", "display", "puff", "smear"]) {
      expect(enabled(s.view, `gazette:${id}`), id).toBe(false);
      expect(button(s.view, `gazette:${id}`)?.hint, id).toBeTruthy();
    }
  });

  it("a smear costs karma and, when it runs, takes word of mouth from the rival and mails them", () => {
    let ran = false;
    let failed = false;
    for (let seed = 1; seed < 80 && !(ran && failed); seed++) {
      const { town, ctx } = xtown({ seed });
      const t = edit(town, (x) => {
        player(x, 0).money = 20_000;
        player(x, 0).karma = 50;
      });
      let s = press(visit(seat(t, ctx, 0), "gazette"), "gazette:smear");
      expect(s.view.overlay?.kind).toBe("playerPicker");
      s = act(s, { type: "pickPlayer", overlayId: "gazette:smearpick", playerId: 1 });
      const me = player(s.town, 0);
      expect(me.karma).toBe(50 + R.gazette.smear.karma);
      expect(enabled(s.view, "gazette:smear")).toBe(false);
      const rival = player(s.town, 1).expanded?.reviews ?? 0;
      if (rival === R.gazette.smear.targetReviews) {
        ran = true;
        expect(me.money).toBe(20_000 - R.gazette.smear.price);
        expect(frontPage(s.town)).toMatch(/rumors/);
      } else {
        failed = true;
        expect(me.money).toBe(20_000 - R.gazette.smear.price - R.gazette.smear.fine);
        expect(me.expanded?.reviews).toBe(R.gazette.smear.backfireReviews);
        expect(frontPage(s.town)).toMatch(/retracts/);
      }
      // The same draw after a save.
      const again = act(press(visit(seat(t, ctx, 0), "gazette"), "gazette:smear"), {
        type: "pickPlayer",
        overlayId: "gazette:smearpick",
        playerId: 1,
      });
      expect(JSON.stringify(again.town)).toBe(JSON.stringify(s.town));
    }
    expect(ran && failed).toBe(true);
  });

  it("a peaceful rival cannot be smeared and nothing is charged", () => {
    let s = at("gazette", (t) => {
      for (const id of [1, 2]) {
        const x = player(t, id).expanded;
        if (x) x.rivalry = "peaceful";
      }
    });
    expect(enabled(s.view, "gazette:smear")).toBe(false);
    expect(button(s.view, "gazette:smear")?.hint).toBeTruthy();
    s = press(s, "gazette:puff");
    expect(player(s.town, 0).money).toBe(50_000 - R.gazette.puff.price);
  });
});
