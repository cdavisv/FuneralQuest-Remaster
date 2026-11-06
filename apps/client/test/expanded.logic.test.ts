import type { View } from "@fq/protocol";
import { describe, expect, it } from "vitest";
import { spanText } from "../src/components/RichText.js";
import {
  cardFamily,
  cardState,
  groupButtons,
  hasDetails,
  usesGroups,
} from "../src/expanded/buttons.js";
import { clerkTip } from "../src/expanded/clerk.js";
import { gameRows, roundKind } from "../src/expanded/club.js";
import { gaugeModel } from "../src/expanded/gauge.js";
import { bandAt, debtLevel, hudChips, isExpandedHud, karmaPosition } from "../src/expanded/hud.js";
import {
  isChooserScreen,
  isOfficeHome,
  isUpgradeScreen,
  officeOf,
} from "../src/expanded/office.js";
import { effectList, isPrepChoice, prepOptions } from "../src/expanded/prep.js";
import { closingSoon, openBallots, stripHasContent, stripItems } from "../src/expanded/town.js";
import { FIXTURES } from "../src/mock/fixtures.js";
import { without, xview } from "./xviews.js";

describe("button groups (docs 11.2, 11.3)", () => {
  it("keeps the five Classic buttons in the main row and puts the rest in a second row", () => {
    const view = xview("negotiation");
    const g = groupButtons(view.buttons);
    expect(g.main.map((p) => p.button.label)).toEqual([
      "Guilt",
      "Sympathy",
      "Hard Sell",
      "Soft Sell",
      "Done",
    ]);
    expect(g.more.map((p) => p.button.label)).toEqual(["Packages", "Coffee", "Listen", "Discount"]);
    expect(g.hand).toEqual([]);
    // Every button keeps its place in the whole View: keys 1 to 9 follow it.
    expect(g.more[0]?.index).toBe(5);
    expect(g.main.length + g.more.length + g.hand.length).toBe(view.buttons.length);
  });

  it("draws the soft-sell hand and the packages as cards with Back in the main row", () => {
    for (const name of ["hand", "packages"]) {
      const g = groupButtons(xview(name).buttons);
      expect(g.hand.length).toBeGreaterThanOrEqual(3);
      expect(g.main.map((p) => p.button.id)).toEqual(["neg:back"]);
      for (const c of g.hand) expect(c.button.detail).toMatch(/^\+?\$[\d,]+$/);
    }
  });

  it("the Discount button carries its amount as a second line", () => {
    const discount = xview("negotiation").buttons.find((b) => b.id === "neg:discount");
    expect(discount?.detail).toMatch(/^-\$\d+/);
    expect(hasDetails(xview("negotiation").buttons)).toBe(true);
  });

  it("a Classic View uses none of it", () => {
    for (const view of Object.values(FIXTURES) as View[]) {
      expect(usesGroups(view.buttons)).toBe(false);
      expect(hasDetails(view.buttons)).toBe(false);
      expect(groupButtons(view.buttons).main).toHaveLength(view.buttons.length);
    }
  });

  it("sorts disabled cards by what they wait for", () => {
    const cards = xview("upgrades").buttons.filter((b) => b.group === "hand");
    const states = new Map(cards.map((b) => [b.id, cardState(b)]));
    expect(states.get("parlor:buy:paint")).toBe("ready");
    expect(states.get("parlor:buy:alarm")).toBe("locked");
    expect(cardState({ id: "x", label: "x", enabled: false, hint: "Not enough cash" })).toBe(
      "short",
    );
    expect(cardState({ id: "x", label: "x", enabled: false, hint: "Already have it" })).toBe(
      "owned",
    );
    expect(cardState({ id: "x", label: "x", enabled: false, hint: "Current" })).toBe("owned");
    expect(cardState({ id: "x", label: "x", enabled: false, hint: "Not now" })).toBe("off");
    expect(cardState({ id: "x", label: "x", enabled: false })).toBe("off");
  });

  it("marks the current rivalry and the owned permit", () => {
    const rivalry = xview("rivalry").buttons.find((b) => b.id === "parlor:rivalry:standard");
    expect(cardState(rivalry as never)).toBe("chosen");
    // The engine marks the current choice with `selected`.
    const current = xview("rivalrySet").buttons.find((b) => b.id === "parlor:rivalry:cutthroat");
    expect(cardState(current as never)).toBe("chosen");
    expect(cardState({ id: "p", label: "p", enabled: false, hint: "Already have it" })).toBe(
      "owned",
    );
    // An upgrade's row decides over its hint.
    expect(cardState({ id: "u", label: "u" }, { state: "locked" })).toBe("locked");
    expect(cardState({ id: "u", label: "u" }, { state: "unaffordable" })).toBe("short");
    expect(cardState({ id: "u", label: "u" }, { state: "owned" })).toBe("owned");
  });

  it("names a card's family and argument", () => {
    expect(cardFamily("reaper-club:draw:500")).toEqual({ family: "reaper-club:draw", arg: "500" });
    expect(cardFamily("go:map")).toEqual({ family: "go", arg: "map" });
  });
});

describe("estimate gauge maths (docs 3.6, 3.7)", () => {
  it("puts a total far below the estimate in a lead-in with the dollars to go", () => {
    const g = gaugeModel({ low: 9050, high: 14300 }, 800);
    expect(g.state).toBe("below");
    expect(g.gap).toBe(8250);
    expect(g.leadIn).toBeGreaterThan(0);
    expect(g.totalPos).toBeLessThan(g.lowPos);
    expect(g.lowPos).toBeLessThan(g.highPos);
    expect(g.bands).toEqual([]);
    expect(g.chance).toBe(0);
  });

  it("draws the great band within 3% and the nice band within 8% above the bill", () => {
    const g = gaugeModel({ low: 1000, high: 5000 }, 2000, [
      { key: "great", within: 0.03 },
      { key: "nice", within: 0.08 },
    ]);
    expect(g.state).toBe("inside");
    // The limit L is at least the bill; great when L <= 2000 / 0.97, nice up to 2000 / 0.92.
    const great = g.bands.find((b) => b.key === "great");
    const nice = g.bands.find((b) => b.key === "nice");
    expect(great).toMatchObject({ from: 2000, to: Math.round(2000 / 0.97) });
    expect(nice).toMatchObject({ from: Math.round(2000 / 0.97), to: Math.round(2000 / 0.92) });
    expect(g.totalPos).toBeLessThan(great?.toPos ?? 0);
    expect(great?.toPos).toBeLessThanOrEqual(nice?.fromPos ?? 0 + 1e-9);
    // Share of the room above the bill that earns a bonus: (2000/0.92 - 2000) of 3000.
    expect(g.chance).toBeCloseTo((2000 / 0.92 - 2000) / 3000, 2);
  });

  it("takes the band widths from the engine's bands, not from a copy", () => {
    const bands = xview("negotiation").customer?.bands ?? [];
    expect(bands.map((b) => b.key)).toEqual(["exact", "great", "nice"]);
    // A limit of 2060 with a bill of 2000 is 2.9% under: great. 2170 is 7.8% under: nice.
    const g = gaugeModel({ low: 1500, high: 4000 }, 2000, bands);
    expect(g.bands.map((b) => b.key)).toEqual(["great", "nice"]);
    expect(g.bands[0]?.within).toBe(bands[1]?.within);
    expect(g.bands[0]?.to).toBeGreaterThanOrEqual(2060);
    expect(g.bands[1]?.to).toBeGreaterThanOrEqual(2170);
    // Other widths give other bands: nothing is mirrored.
    const wide = gaugeModel({ low: 1500, high: 4000 }, 2000, [{ key: "great", within: 0.5 }]);
    expect(wide.bands[0]?.to).toBe(4000);
    // No bands (an older server) means a bar with a pin and no bonus bands.
    expect(gaugeModel({ low: 1500, high: 4000 }, 2000).bands).toEqual([]);
  });

  it("a bill below the estimate's floor cannot earn a bonus when the bands miss it", () => {
    const g = gaugeModel({ low: 3000, high: 4000 }, 2000);
    expect(g.state).toBe("below");
    expect(g.bands).toEqual([]);
    expect(g.chance).toBe(0);
  });

  it("a bill just under the floor reaches into the range with a band", () => {
    const g = gaugeModel({ low: 2050, high: 4000 }, 2000, [{ key: "great", within: 0.03 }]);
    expect(g.state).toBe("below");
    const band = g.bands[0];
    expect(band?.from).toBe(2050);
    expect(band?.fromPos).toBeCloseTo(g.lowPos, 5);
  });

  it("a bill at the top of the estimate has no room left", () => {
    const g = gaugeModel({ low: 1000, high: 3000 }, 3000);
    expect(g.state).toBe("inside");
    expect(g.bands).toEqual([]);
    expect(g.chance).toBe(1);
    expect(g.totalPos).toBeCloseTo(g.highPos, 5);
  });

  it("a bill above the estimate stays on the axis", () => {
    const g = gaugeModel({ low: 1000, high: 3000 }, 4500);
    expect(g.state).toBe("above");
    expect(g.totalPos).toBeGreaterThan(g.highPos);
    expect(g.totalPos).toBeLessThanOrEqual(1);
  });

  it("keeps every position on the axis, for every captured estimate", () => {
    for (const name of [
      "negotiation",
      "hand",
      "packages",
      "afterCoffee",
      "afterDiscount",
      "practiceSale",
    ]) {
      const c = xview(name).customer;
      if (!c?.estimate) throw new Error(`${name} has no estimate`);
      const g = gaugeModel(c.estimate, c.total);
      for (const pos of [
        g.lowPos,
        g.highPos,
        g.totalPos,
        ...g.bands.flatMap((b) => [b.fromPos, b.toPos]),
      ]) {
        expect(pos).toBeGreaterThanOrEqual(0);
        expect(pos).toBeLessThanOrEqual(1);
      }
      expect(g.lowPos).toBeLessThan(g.highPos);
    }
  });

  it("swaps a reversed range", () => {
    expect(gaugeModel({ low: 5000, high: 1000 }, 2000).low).toBe(1000);
  });
});

describe("HUD (docs 11.1, 26)", () => {
  it("a Classic HUD is not an Expanded one", () => {
    for (const view of Object.values(FIXTURES) as View[])
      expect(isExpandedHud(view.hud)).toBe(false);
    expect(isExpandedHud(xview("deskQuiet").hud)).toBe(true);
  });

  it("shows money, karma and rating always, and the rest only when there is something to say", () => {
    const quiet = hudChips(xview("deskQuiet").hud as never);
    expect(quiet.map((c) => c.id)).toEqual(["turns", "money", "karma", "rating"]);
    const debt = hudChips(xview("deskInDebt").hud as never);
    expect(debt.map((c) => c.id)).toEqual(["turns", "money", "karma", "rating", "debt"]);
    const hurt = hudChips(xview("hospital").hud as never);
    expect(hurt.map((c) => c.id)).toContain("injuries");
    const rich = hudChips({
      ...(xview("deskQuiet").hud as never as object),
      savings: 500,
      leads: 2,
    } as never);
    expect(rich.map((c) => c.id)).toEqual([
      "turns",
      "money",
      "karma",
      "rating",
      "savings",
      "leads",
    ]);
  });

  it("warns about a debt more as the engine's days left run down", () => {
    expect(debtLevel(undefined)).toBe("ok");
    expect(debtLevel(10)).toBe("ok");
    expect(debtLevel(2)).toBe("soon");
    expect(debtLevel(0)).toBe("due");
    expect(debtLevel(-1)).toBe("overdue");
    const chip = hudChips(xview("deskInDebt").hud as never).find((c) => c.id === "debt");
    expect(chip).toMatchObject({ value: 2060, due: 23, daysLeft: 10, tone: "warn" });
    expect(chip?.daysLeft).toBe(xview("deskInDebt").hud?.debt?.daysLeft);
  });

  it("carries the injuries and the karma band on their chips", () => {
    const hurt = hudChips(xview("hospital").hud as never);
    expect(hurt.find((c) => c.id === "injuries")?.injuries?.[0]).toMatchObject({
      name: "Shovel-Shaped Face",
      treatPrice: 700,
    });
    const karma = hudChips(xview("deskQuiet").hud as never).find((c) => c.id === "karma");
    expect(karma?.band).toMatchObject({ id: expect.any(String), name: expect.any(String) });
  });

  it("puts karma on its axis and finds its band in the engine's scale", () => {
    expect(karmaPosition(1)).toBe(0);
    expect(karmaPosition(100)).toBe(1);
    expect(karmaPosition(50.5)).toBeCloseTo(0.5, 1);
    const scale = xview("office").karmaScale;
    expect(scale?.map((b) => b.id)).toEqual([
      "necromancer",
      "grave-robber",
      "neutral",
      "trusted",
      "church-associate",
    ]);
    for (const [karma, id] of [
      [1, "necromancer"],
      [50, "neutral"],
      [100, "church-associate"],
    ] as const) {
      expect(bandAt(scale, karma)?.id).toBe(id);
    }
    // The band the HUD names is the band the scale puts the same karma in.
    const hud = xview("office").hud;
    expect(bandAt(scale, hud?.karma ?? 0)).toEqual(hud?.karmaPath);
    expect(bandAt(undefined, 50)).toBeUndefined();
  });
});

describe("town strip (docs 26)", () => {
  it("lists weather, news and story with their effects, and the ballots not yet voted on", () => {
    const town = xview("desk").town;
    if (!town) throw new Error("no town");
    const items = stripItems(town);
    expect(items.map((i) => i.kind)).toEqual(["weather", "story"]);
    expect(items[0]).toMatchObject({ id: town.weather?.id, effect: town.weather?.effect });
    const open = openBallots(town);
    expect(open).toHaveLength(1);
    expect(open[0]?.daysLeft).toBe(1);
    expect(closingSoon(open[0] as never)).toBe(true);
    expect(closingSoon({ kind: "election", closes: 9, voted: false, daysLeft: 4 })).toBe(false);
    expect(closingSoon({ kind: "election", closes: 9, voted: false })).toBe(false);
    expect(stripHasContent(town)).toBe(true);
  });

  it("a voted ballot earns no badge, and an empty town has no strip", () => {
    expect(
      openBallots({ day: 3, ballots: [{ kind: "election", closes: 10, voted: true }] }),
    ).toEqual([]);
    expect(stripHasContent({ day: 3 })).toBe(false);
    expect(
      stripItems({
        day: 3,
        mayor: "Wilma Boggs",
        ordinance: { id: "x", title: "T", effect: "e", until: 9 },
      }).map((i) => i.kind),
    ).toEqual(["ordinance", "mayor"]);
  });
});

describe("the office (docs 7, 11.5)", () => {
  it("reads the building, stock, markup and rivalry from View.office, not from the text", () => {
    const view = xview("office");
    const office = officeOf(view);
    expect(office).toMatchObject({
      level: 0,
      levelName: "Shack",
      markup: 0,
      rivalry: "standard",
      stock: { wood: 2, silver: 0, gold: 0, capacity: 6 },
    });
    expect(office?.levelNames).toHaveLength(5);
    expect(isOfficeHome(view)).toBe(true);
    expect(isUpgradeScreen(view)).toBe(false);
    // The words no longer matter.
    const worded = { ...view, text: [{ text: "A very different office." }] };
    expect(officeOf(worded)).toEqual(office);
    expect(officeOf(without(view, "office"))).toBeUndefined();
    expect(isOfficeHome(without(view, "office"))).toBe(false);
  });

  it("lists every upgrade with its state, reason and requirements", () => {
    const view = xview("upgradesMixed");
    expect(isUpgradeScreen(view)).toBe(true);
    const rows = officeOf(view)?.upgrades ?? [];
    expect(rows).toHaveLength(15);
    expect(new Set(rows.map((r) => r.state))).toEqual(
      new Set(["owned", "available", "unaffordable", "locked"]),
    );
    const owned = rows.find((r) => r.id === "paint");
    expect(owned?.state).toBe("owned");
    expect(view.buttons.some((b) => b.id === owned?.buttonId)).toBe(false);
    const locked = rows.find((r) => r.state === "locked");
    expect(locked?.reason).toBeTruthy();
    expect(locked?.requires?.some((r) => !r.have)).toBe(true);
  });

  it("marks the chooser's current card with Button.selected", () => {
    const markup = xview("markupSet");
    expect(isChooserScreen(markup)).toBe(true);
    expect(markup.buttons.filter((b) => b.selected).map((b) => b.id)).toEqual(["parlor:markup:20"]);
    expect(officeOf(markup)?.markup).toBe(20);
    expect(xview("rivalrySet").buttons.find((b) => b.selected)?.id).toBe(
      "parlor:rivalry:cutthroat",
    );
  });
});

describe("the clerk (docs 10.4, 11.5)", () => {
  it("reads the page count of a tour page and the hint of the practice sale from View.tutorial", () => {
    const page = clerkTip(xview("tourPage"));
    expect(page?.kind).toBe("tour");
    expect(page?.page).toEqual({ at: 1, of: 8 });
    expect(page?.speaker).toBe("Clerk");
    const hint = clerkTip(xview("practiceSale"));
    expect(hint?.kind).toBe("hint");
    expect(spanText(hint?.text ?? [])).toMatch(/^Read the mood word/);
    // The old "Clerk: ..." note is not read any more.
    const noted = { ...xview("negotiation"), note: [{ text: "Clerk: do not read me" }] };
    expect(clerkTip(noted)).toBeNull();
  });

  it("sees no clerk in a normal sale", () => {
    expect(clerkTip(xview("negotiation"))).toBeNull();
    expect(clerkTip(xview("graveyard"))).toBeNull();
  });
});

describe("preparing the body (docs 8.2, 11.5)", () => {
  it("joins View.prep.choices to the buttons and sorts the moral choice", () => {
    const view = xview("prep");
    expect(isPrepChoice(view)).toBe(true);
    const options = prepOptions(view);
    expect(options.map((o) => o.tone)).toEqual(["evil", "good"]);
    expect(options[0]).toMatchObject({ karma: -2, failKarma: -3 });
    expect(options[0]?.choice.risk?.chance).toBe(51);
    expect(options[1]).toMatchObject({ karma: 1, failKarma: undefined });
    expect(options.map((o) => o.button.label)).toEqual(["Take It", "Leave It"]);
    // The button's detail text is no longer read.
    const changed = {
      ...view,
      buttons: view.buttons.map((b) => ({ ...b, detail: "(+$1, -99 karma)" })),
    };
    expect(prepOptions(changed).map((o) => o.karma)).toEqual([-2, 1]);
  });

  it("lists the effects other than karma in a stable order", () => {
    expect(effectList({ karma: -2, money: 400, reviews: -3, luck: 2 })).toEqual([
      { key: "money", amount: 400 },
      { key: "luck", amount: 2 },
      { key: "reviews", amount: -3 },
    ]);
    expect(effectList({})).toEqual([]);
  });
});

describe("the Reaper Club's tables (docs 20.2)", () => {
  it("groups the twelve cards by game with the stakes in order", () => {
    const rows = gameRows(xview("clubGames").buttons);
    expect(rows.map((r) => r.game)).toEqual(["draw", "slots", "shots"]);
    for (const row of rows) expect(row.cards.map((c) => c.stake)).toEqual([100, 500, 1000, 5000]);
  });

  it("gives every game's every outcome its own result, from View.club.lastRound", () => {
    const seen = new Set<string>();
    for (const name of [
      "roundSlotsWin",
      "roundSlotsLose",
      "roundDrawWin",
      "roundDrawPush",
      "roundShotsWin",
      "roundShotsLose",
    ]) {
      const round = xview(name).club?.lastRound;
      if (!round) throw new Error(`${name} has no round`);
      seen.add(`${round.game}:${round.outcome}`);
      expect(round.net).toBe(round.payout - round.stake);
      expect(roundKind(round)).toBe(round.outcome);
    }
    expect([...seen].sort()).toEqual([
      "draw:push",
      "draw:win",
      "shots:lose",
      "shots:win",
      "slots:lose",
      "slots:win",
    ]);
    expect(roundKind({ game: "draw", stake: 100, outcome: "push", payout: 100, net: 0 })).toBe(
      "even",
    );
  });
});
