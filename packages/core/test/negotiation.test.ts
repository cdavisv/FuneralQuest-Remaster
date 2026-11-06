import { describe, expect, it } from "vitest";
import { type CustomerState, richTextToPlain, saleBp, type TownState } from "../src/index.js";
import { buttonIds, makeTown, press } from "./support/harness.js";
import { openNegotiation } from "./support/scenarios.js";

function withCustomer(town: TownState, change: Partial<CustomerState>): TownState {
  const copy = structuredClone(town);
  const session = copy.sessions["0"];
  if (!session) throw new Error("no session");
  Object.assign(session.customer, change);
  return copy;
}

describe("BP on Done (legacy/source/commands_complicated.cpp:40-93)", () => {
  it("pays int(float(price) * 0.0064f): wood 5, silver 16, gold 33", () => {
    expect(saleBp(800, 0.0064)).toBe(5);
    expect(saleBp(2600, 0.0064)).toBe(16);
    expect(saleBp(5300, 0.0064)).toBe(33);
    // 32-bit float product: 1250 * 0.0064f rounds up to 8.0 (an exact product would truncate to 7).
    expect(saleBp(1250, 0.0064)).toBe(8);
  });

  const done = (change: Partial<CustomerState>) => {
    const { town, ctx } = openNegotiation(11);
    const before = town.players[0];
    const t = withCustomer(town, { desiredCasket: 0, options: [], bigUpgrade: -1, ...change });
    const r = press(t, 0, "neg:done", ctx);
    const after = r.town.players[0];
    return { gained: (after?.bp ?? 0) - (before?.bp ?? 0), r, before, after };
  };

  it("adds 200 for landing exactly on the limit (:47-56) and puts it in the paper", () => {
    const { gained, r } = done({ moneyToSpend: 800 });
    expect(gained).toBe(5 + 200);
    expect(richTextToPlain(r.view.text)).toContain("EXCELLENT!");
    expect(r.town.news[String(r.town.day)]?.front).toContain("makes a perfect sale");
  });

  it("adds the trade bonus + 10 (35) within $50 (:58-62)", () => {
    expect(done({ moneyToSpend: 850 }).gained).toBe(5 + 35);
    expect(done({ moneyToSpend: 801 }).gained).toBe(5 + 35);
  });

  it("adds the trade bonus (25) within $100 (:65-70)", () => {
    expect(done({ moneyToSpend: 851 }).gained).toBe(5 + 25);
    expect(done({ moneyToSpend: 900 }).gained).toBe(5 + 25);
    expect(done({ moneyToSpend: 901 }).gained).toBe(5);
  });

  it("gives a casket tag of the tier and a plot (:92-93), and ends the negotiation", () => {
    const { before, after, r } = done({ desiredCasket: 2, moneyToSpend: 9000 });
    expect((after?.tags[2] ?? 0) - (before?.tags[2] ?? 0)).toBe(1);
    expect((after?.plots ?? 0) - (before?.plots ?? 0)).toBe(1);
    expect(buttonIds(r.view)).toEqual(["go:desk"]);
    expect(r.town.sessions["0"]?.customer.flow).toBe("none");
  });

  it("counts soft-sell items and upgrades in the price (online_struct.cpp:574-597)", () => {
    // soft_sell.txt item 0 is the $150 Floral Arrangement; hard_sell.txt item 0 is $2,250.
    const { gained } = done({
      desiredCasket: 2,
      options: [0, 0],
      bigUpgrade: 0,
      moneyToSpend: 99999,
    });
    expect(gained).toBe(saleBp(5300 + 300 + 2250, 0.0064));
  });
});

describe("walkouts (commands_complicated.cpp:157-288)", () => {
  it("Guilt at mood 10 or more is interrupted and the rival gets 5 to 9 BP by mail", () => {
    const { town, ctx } = openNegotiation(5);
    const r = press(withCustomer(town, { mood: 10 }), 0, "neg:guilt", ctx);
    expect(richTextToPlain(r.view.text)).toMatch(/^You are interrupted!/);
    expect(buttonIds(r.view)).toEqual(["go:desk"]);
    const mail = r.town.players[1]?.mail ?? [];
    const reward = mail.find((m) => m.type === "varMod");
    expect(reward && reward.type === "varMod" && reward.amount).toBeGreaterThanOrEqual(5);
    expect(reward && reward.type === "varMod" && reward.amount).toBeLessThanOrEqual(9);
    // Mail order of leave_pissed (:198-203): text, background, portrait, BP, Continue.
    expect(mail.slice(-5).map((m) => m.type)).toEqual([
      "text",
      "picture",
      "picture",
      "varMod",
      "buttons",
    ]);
  });

  it("the rival's BP applies only when the mail is read at the desk", () => {
    const { town, ctx } = openNegotiation(5);
    const walked = press(withCustomer(town, { mood: 10 }), 0, "neg:sympathy", ctx).town;
    const before = walked.players[1]?.bp ?? 0;
    const reward = walked.players[1]?.mail.find((m) => m.type === "varMod");
    const amount = reward?.type === "varMod" ? reward.amount : 0;
    // Player 1 is on the paper; Continue reaches the morning screen, then the desk reads mail.
    let t = press(walked, 1, "go:desk", ctx).town;
    expect(t.players[1]?.bp).toBe(before);
    const desk = press(t, 1, "go:desk", ctx);
    t = desk.town;
    expect(t.players[1]?.bp).toBe(before + amount);
    // The letter is read in a message overlay (modules/mailbox.ts), closed with dismiss.
    const letter = desk.view.overlay;
    expect(letter?.kind).toBe("message");
    expect(letter?.kind === "message" && richTextToPlain(letter.text)).toContain(
      "walks in with a dead body",
    );
    expect(letter?.kind === "message" && letter.picture?.bg).toBe("background/background_2");
  });

  it("nobody else in town: no rival mail and no draw for one", () => {
    const { town, ctx } = openNegotiation(5, 1);
    const r = press(withCustomer(town, { mood: 12 }), 0, "neg:guilt", ctx);
    expect(richTextToPlain(r.view.text)).not.toContain("You watch");
  });
});

describe("Soft Sell, Hard Sell and upgrades", () => {
  it("Hard Sell on Gold offers upgrades in file order, then says there is nothing left (:1077-1110)", () => {
    const { town, ctx } = openNegotiation(3);
    let t = withCustomer(town, {
      desiredCasket: 2,
      cheapness: 0,
      mood: 0,
      moneyToSpend: 1_000_000,
    });
    const upgrades = 10;
    for (let i = 0; i < upgrades; i++) {
      const r = press(t, 0, "neg:hard", ctx);
      t = r.town;
      expect(t.sessions["0"]?.customer.bigUpgrade).toBe(i);
    }
    const r = press(t, 0, "neg:hard", ctx);
    expect(richTextToPlain(r.view.text)).toMatch(/has already bought everything big/);
  });

  it("Hard Sell always refuses above cheapness 8 and raises mood by 0.6 to 1.6 (:731-735)", () => {
    for (let k = 0; k < 20; k++) {
      const { town, ctx } = openNegotiation(100 + k);
      const t = withCustomer(town, {
        desiredCasket: 0,
        cheapness: 8.5,
        mood: 1,
        moneyToSpend: 99999,
      });
      const r = press(t, 0, "neg:hard", ctx);
      const c = r.town.sessions["0"]?.customer;
      expect(c?.desiredCasket).toBe(0);
      expect(c?.mood).toBeGreaterThanOrEqual(1.6 - 1e-6);
      expect(c?.mood).toBeLessThanOrEqual(2.6 + 1e-6);
    }
  });

  it("Soft Sell never takes the price over the limit", () => {
    const { town, ctx } = openNegotiation(8);
    let t = withCustomer(town, { cheapness: 0, mood: 0, moneyToSpend: 1000 });
    for (let i = 0; i < 30; i++) {
      const r = press(t, 0, "neg:soft", ctx);
      if (!buttonIds(r.view).includes("neg:soft")) break;
      t = r.town;
      expect(r.view.customer?.total).toBeLessThanOrEqual(1000);
    }
  });

  it("Guilt lowers cheapness of a customer who did not love the deceased by 0.7 to 2.7 (:938-939)", () => {
    const { town, ctx } = openNegotiation(9);
    const r = press(
      withCustomer(town, { loved: false, cheapness: 5, mood: 0 }),
      0,
      "neg:guilt",
      ctx,
    );
    const c = r.town.sessions["0"]?.customer;
    expect(c?.cheapness).toBeGreaterThanOrEqual(5 - 2.7 - 1e-6);
    expect(c?.cheapness).toBeLessThanOrEqual(5 - 0.7 + 1e-6);
    expect(c?.mood).toBeLessThanOrEqual(1 + 1e-6);
  });

  it("Sympathy angers a customer who did not love the deceased by 1.4 to 4.4 (:1023-1028)", () => {
    const { town, ctx } = openNegotiation(9);
    const r = press(
      withCustomer(town, { loved: false, cheapness: 5, mood: 0 }),
      0,
      "neg:sympathy",
      ctx,
    );
    const c = r.town.sessions["0"]?.customer;
    expect(c?.mood).toBeGreaterThanOrEqual(1.4 - 1e-6);
    expect(c?.mood).toBeLessThanOrEqual(4.4 + 1e-6);
    expect(c?.cheapness).toBe(5);
  });
});

describe("arrival (commands_complicated.cpp:308-459)", () => {
  it("spends one turn and shows mood, class, portrait and background", () => {
    const { town, view } = openNegotiation(21);
    expect(town.players[0]?.turns).toBe(14);
    expect(view.customer?.incomeLabel).toMatch(/Poor|Average|Rich|Super Rich/);
    expect(view.picture?.fg).toMatch(/^people\//);
    expect(view.picture?.bg).toMatch(/^background\/background_[1-4]$/);
    expect(richTextToPlain(view.text)).toMatch(/Please, I need a funeral service for my/);
  });

  it("a psych 5 player can double the limit; resistance shows as a percent", () => {
    let doubled = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const made = makeTown(seed, 1, { settings: { normalOdds: 0, luckOdds: 0, scriptOdds: 0 } });
      const t = structuredClone(made.town);
      (t.players[0] as { psych: number }).psych = 5;
      let x = press(t, 0, "go:desk", made.ctx).town;
      x = press(x, 0, "go:desk", made.ctx).town;
      const r = press(x, 0, "desk:wait", made.ctx);
      const text = richTextToPlain(r.view.text);
      if (text.includes("Spending limit doubled.")) doubled++;
      if (r.view.customer?.resistancePercent !== undefined)
        expect(text).toMatch(/\(Resistance: \d+%\)/);
    }
    // psych 5: p = 15*5-65 = 10, pulled toward 50 by 2%: 10 + int(40*0.02) = 10 -> 11/100.
    expect(doubled).toBeGreaterThan(0);
    expect(doubled).toBeLessThan(20);
  });
});
