/**
 * The Expanded negotiation's state transitions, through `step` and Views
 * only. Each test names its section of docs/expanded-rules.md.
 */
import { describe, expect, it } from "vitest";
import {
  billTotal,
  EXPANDED,
  EXPANDED_STARTER,
  richTextToPlain,
  type TownState,
} from "../src/index.js";
import { atXDesk, btn, cust, enabledIds, ids, meet, px, type XPlaced } from "./support/xplaces.js";

const X = EXPANDED;

function bill(p: XPlaced): number {
  return billTotal({ town: p.town, content: p.ctx.content } as never, cust(p));
}

describe("3.2 arrival", () => {
  it("names the customer, shows two traits, a tell, the estimate and patience", () => {
    const p = meet(atXDesk());
    const c = p.view.customer;
    expect(c?.name).toMatch(/^\S+ \S+/);
    expect(c?.traits).toHaveLength(2);
    expect(c?.estimate?.low).toBeLessThanOrEqual(cust(p).moneyToSpend);
    expect(c?.estimate?.high).toBeGreaterThanOrEqual(cust(p).moneyToSpend);
    expect(c?.patience?.left).toBe(c?.patience?.max);
    expect((c?.notes ?? []).length).toBeGreaterThanOrEqual(1);
    expect(p.town.players[0]?.turns).toBe(14);
    // The five Classic buttons keep the main row; the new ones are the "more" row.
    expect(p.view.buttons.filter((b) => !b.group).map((b) => b.id)).toEqual([
      "neg:guilt",
      "neg:sympathy",
      "neg:hard",
      "neg:soft",
      "neg:done",
    ]);
    expect(p.view.buttons.filter((b) => b.group === "more").map((b) => b.id)).toEqual([
      "neg:packages",
      "neg:coffee",
      "neg:listen",
      "neg:discount",
    ]);
    expect(richTextToPlain(p.view.status ?? [])).toMatch(/within 8%/);
  });

  it("3.5 the free tell is truthful", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const p = meet(atXDesk({ seed }));
      const c = cust(p);
      const notes = c.expanded.notes.join(" ");
      const tells = EXPANDED_STARTER.tells;
      const pools = c.expanded.told.loved
        ? c.loved
          ? tells.loved
          : tells.notLoved
        : c.cheapness < X.customer.cheapLowBelow
          ? tells.cheapLow
          : c.cheapness > X.customer.cheapHighAbove
            ? tells.cheapHigh
            : tells.cheapMid;
      // The longest literal stretch of each line, which survives the placeholders.
      const stems = pools.map(
        (l) =>
          l
            .split(/\{[a-zA-Z]+\}/)
            .map((part) => part.replace(/["`]/g, "").trim())
            .sort((a, b) => b.length - a.length)[0] ?? "",
      );
      const plain = notes.replace(/`./g, "").replace(/"/g, "");
      expect(
        stems.some((s) => s.length > 4 && plain.includes(s.slice(0, 15))),
        notes,
      ).toBe(true);
    }
  });
});

describe("4 the soft-sell hand", () => {
  it("offers three different cards, none already bought or refused, and costs nothing to look", () => {
    let p = meet(atXDesk({ seed: 4 }));
    const before = cust(p).expanded.patience;
    p = px(p, "neg:soft");
    const cards = p.view.buttons.filter((b) => b.group === "hand");
    expect(cards).toHaveLength(X.hand.size);
    expect(new Set(cards.map((b) => b.label)).size).toBe(cards.length);
    expect(cust(p).expanded.patience).toBe(before);
    expect(ids(p.view)).toContain("neg:back");
    // Pitching a card removes it and refills the hand without repeats.
    p = px(p, "neg:hand:0");
    const x = cust(p).expanded;
    expect(x.patience).toBe(before - 1);
    for (const h of x.hand) {
      expect(x.bought).not.toContain(h);
      expect(x.refused).not.toContain(h);
    }
    expect(x.bought.length + x.refused.length).toBe(1);
  });

  it("is four cards at high luck and two at low luck", () => {
    const lucky = meet(
      atXDesk({ seed: 5, setup: (t) => ((t.players[0] as { luck: number }).luck = 80) }),
    );
    expect(px(lucky, "neg:soft").view.buttons.filter((b) => b.group === "hand")).toHaveLength(4);
    const unlucky = meet(
      atXDesk({ seed: 5, setup: (t) => ((t.players[0] as { luck: number }).luck = 10) }),
    );
    expect(px(unlucky, "neg:soft").view.buttons.filter((b) => b.group === "hand")).toHaveLength(2);
  });

  it("never lets the bill pass the limit", () => {
    for (let seed = 1; seed <= 15; seed++) {
      let p = meet(atXDesk({ seed }), (c) => {
        c.cheapness = 0;
      });
      for (let i = 0; i < 12 && enabledIds(p.view).includes("neg:soft"); i++) {
        p = px(p, "neg:soft");
        p = px(p, "neg:hand:0");
        if (!p.view.customer) break;
        expect(bill(p)).toBeLessThanOrEqual(cust(p).moneyToSpend);
      }
    }
  });
});

describe("3.4 the new actions", () => {
  it("Coffee calms, adds patience, and only once", () => {
    let p = meet(atXDesk({ seed: 6 }), (c) => {
      c.mood = 6;
      c.expanded.patience = 3;
      c.expanded.traits = ["sentimental", "skeptic"];
    });
    p = px(p, "neg:coffee");
    const c = cust(p);
    expect(c.mood).toBeLessThanOrEqual(6 - X.actions.coffee.mood.base);
    expect(c.mood).toBeGreaterThanOrEqual(
      6 - X.actions.coffee.mood.base - X.actions.coffee.mood.range,
    );
    expect(c.expanded.patience).toBe(4);
    const coffee = btn(p.view, "neg:coffee");
    expect(coffee?.enabled).toBe(false);
    expect(coffee?.hint).toBeTruthy();
    expect(p.town.sessions["0"]?.view?.buttons.find((b) => b.id === "neg:coffee")?.enabled).toBe(
      false,
    );
  });

  it("Coffee is wasted on a customer In a Hurry", () => {
    let p = meet(atXDesk({ seed: 6 }), (c) => {
      c.mood = 6;
      c.expanded.traits = ["hurry", "skeptic"];
    });
    p = px(p, "neg:coffee");
    expect(cust(p).mood).toBe(6);
  });

  it("Listen reveals the hidden trait first, then tells, and costs two patience", () => {
    let p = meet(atXDesk({ seed: 7 }), (c) => {
      c.expanded.traits = ["sentimental", "pincher", "hothead"];
      c.expanded.visibleTraits = 2;
      c.expanded.told = { loved: true, cheap: false, limit: false };
      c.expanded.patience = 6;
      c.mood = 1;
    });
    p = px(p, "neg:listen");
    expect(cust(p).expanded.visibleTraits).toBe(3);
    expect(cust(p).expanded.patience).toBe(4);
    expect(p.view.customer?.traits?.map((t) => t.id)).toContain("hothead");
    const width = cust(p).expanded.estimate.high - cust(p).expanded.estimate.low;
    p = px(p, "neg:listen");
    p = px(p, "neg:listen");
    const x = cust(p).expanded;
    expect(x.told).toEqual({ loved: true, cheap: true, limit: true });
    expect(x.estimate.high - x.estimate.low).toBeLessThan(width);
    expect(x.estimate.low).toBeLessThanOrEqual(cust(p).moneyToSpend);
    expect(x.estimate.high).toBeGreaterThanOrEqual(cust(p).moneyToSpend);
    expect(btn(p.view, "neg:listen")?.enabled).toBe(false);
  });

  it("Discount takes 10% off on the grid, calms, at most twice, and pays karma on the poor", () => {
    let p = meet(atXDesk({ seed: 8 }), (c) => {
      c.mood = 5;
      c.income = 0;
      c.expanded.traits = ["sentimental", "skeptic"];
    });
    const before = bill(p);
    const karma = p.town.players[0]?.karma ?? 0;
    p = px(p, "neg:discount");
    const cut = Math.max(50, Math.floor((before * 0.1) / 50) * 50);
    expect(bill(p)).toBe(before - cut);
    expect(cust(p).mood).toBeLessThan(5);
    expect(p.town.players[0]?.karma).toBe(karma + 1);
    if (enabledIds(p.view).includes("neg:discount")) p = px(p, "neg:discount");
    expect(btn(p.view, "neg:discount")?.enabled).toBe(false);
  });

  it("a Haggler takes a discount twice as well", () => {
    const run = (traits: string[]) => {
      const p = px(
        meet(atXDesk({ seed: 9 }), (c) => {
          c.mood = 8;
          c.expanded.traits = traits;
        }),
        "neg:discount",
      );
      return cust(p).mood;
    };
    const plain = run(["sentimental", "skeptic"]);
    const haggler = run(["haggler", "skeptic"]);
    expect(8 - haggler).toBeCloseTo((8 - plain) * 2, 4);
  });

  it("out of patience, every action annoys", () => {
    let p = meet(atXDesk({ seed: 10 }), (c) => {
      c.mood = 2;
      c.expanded.patience = 0;
      c.expanded.traits = ["sentimental", "skeptic"];
      c.loved = true;
    });
    p = px(p, "neg:soft");
    p = px(p, "neg:back");
    const mood = cust(p).mood;
    p = px(p, "neg:sympathy");
    // Sympathy adds 0.4-1.4 on its own; impatience adds 0.5-1.0 more.
    expect(cust(p).mood - mood).toBeGreaterThanOrEqual(0.4 + X.actions.impatience.base);
  });

  it("Guilt on someone who loved the deceased costs karma", () => {
    let p = meet(atXDesk({ seed: 12 }), (c) => {
      c.loved = true;
      c.mood = 1;
    });
    const karma = p.town.players[0]?.karma ?? 0;
    p = px(p, "neg:guilt");
    expect(p.town.players[0]?.karma).toBe(karma - 1);
  });
});

describe("5 packages and cremation", () => {
  it("5.1 each category climbs one tier at a time; locked tiers say why", () => {
    let p = meet(atXDesk({ seed: 13 }), (c) => {
      c.cheapness = 0;
      c.desiredCasket = 0;
      c.moneyToSpend = 18000;
      c.expanded.estimate = { low: 800, high: 18000 };
    });
    p = px(p, "neg:packages");
    const flowers = btn(p.view, "neg:pkg:flowers");
    expect(flowers?.label).toBe("Flowers: Floral Arrangement");
    p = px(p, "neg:pkg:flowers");
    expect(cust(p).expanded.packages.flowers).toBe(1);
    p = px(p, "neg:packages");
    const locked = btn(p.view, "neg:pkg:flowers");
    expect(locked?.label).toBe("Flowers: Wall of Lilies");
    expect(locked?.enabled).toBe(false);
    expect(locked?.hint).toBeTruthy();
    expect(bill(p)).toBe(800 + 250);
  });

  it("5.2 cremation needs the incinerator, switches the track, and drops burial-only packages", () => {
    const without = meet(atXDesk({ seed: 14 }));
    expect(ids(without.view)).not.toContain("neg:cremation");
    let p = meet(
      atXDesk({
        seed: 14,
        setup: (t) => {
          const x = t.players[0]?.expanded;
          if (x) x.upgrades.push("incinerator");
        },
      }),
      (c) => {
        c.cheapness = 9;
        c.loved = false;
        c.desiredCasket = 1;
        c.moneyToSpend = 9000;
        c.expanded.traits = ["green", "skeptic"];
        c.expanded.packages = { plot: 1 };
      },
    );
    p = px(p, "neg:cremation");
    const x = cust(p).expanded;
    expect(x.cremationAsked).toBe(true);
    expect(x.track).toBe("cremation");
    expect(x.packages.plot).toBeUndefined();
    expect(p.view.customer?.bill?.[0]).toEqual({
      label: "Cremation",
      price: EXPANDED_STARTER.cremation.fee,
    });
    expect(ids(p.view)).not.toContain("neg:cremation");
    expect(btn(p.view, "neg:hard")?.enabled).toBe(false);
    p = px(p, "neg:packages");
    expect(ids(p.view)).toContain("neg:pkg:urn");
    expect(ids(p.view)).not.toContain("neg:pkg:plot");
  });
});

describe("3.7 Done", () => {
  it("an exact bill pays half the sale again plus a flat bonus, and makes the paper", () => {
    let p = meet(atXDesk({ seed: 15 }), (c) => {
      c.moneyToSpend = c.expanded.casketPrices[c.desiredCasket] ?? 800;
      c.mood = 1;
    });
    const price = cust(p).moneyToSpend;
    const bp0 = p.town.players[0]?.bp ?? 0;
    p = px(p, "neg:done");
    const base = Math.trunc(price * 0.0064);
    expect((p.town.players[0]?.bp ?? 0) - bp0).toBe(
      base + Math.ceil(base * EXPANDED.scoring.exact.share) + EXPANDED.scoring.exact.flat,
    );
    expect(richTextToPlain(p.view.text)).toMatch(/PERFECT/);
    expect(p.town.news[String(p.town.day)]?.front).toMatch(/perfect|exact|limit/i);
    expect(p.town.players[0]?.expanded?.record.exact).toBe(1);
  });

  it("explains what was left on the table when no bonus is earned", () => {
    let p = meet(atXDesk({ seed: 16 }), (c) => {
      c.moneyToSpend = 18000;
    });
    p = px(p, "neg:done");
    expect(richTextToPlain(p.view.text)).toMatch(/left about \$[\d,]+ on the table/);
  });

  it("6.1 pays money: the casket from stock, or a rush order without", () => {
    let p = meet(atXDesk({ seed: 17 }), (c) => {
      c.desiredCasket = 0;
    });
    const money0 = p.town.players[0]?.money ?? 0;
    const stock0 = p.town.players[0]?.expanded?.stock[0] ?? 0;
    p = px(p, "neg:done");
    expect(p.town.players[0]?.expanded?.stock[0]).toBe(stock0 - 1);
    expect((p.town.players[0]?.money ?? 0) - money0).toBe(800);
    // Rush: no silver in stock, so wholesale x 1.3 is paid at once.
    let q = meet(atXDesk({ seed: 17 }), (c) => {
      c.desiredCasket = 1;
      c.moneyToSpend = 9000;
    });
    const m0 = q.town.players[0]?.money ?? 0;
    q = px(q, "neg:done");
    expect((q.town.players[0]?.money ?? 0) - m0).toBe(2600 - Math.round(1950 * 1.3));
    expect(richTextToPlain(q.view.text)).toMatch(/rush order/);
  });

  it("8.2 a body-preparation choice can follow and moves karma", () => {
    let seen = false;
    for (let seed = 1; seed <= 30 && !seen; seed++) {
      let p = meet(atXDesk({ seed }));
      p = px(p, "neg:done");
      if (!ids(p.view).includes("prep:start")) continue;
      seen = true;
      p = px(p, "prep:start");
      const choices = p.view.buttons;
      expect(choices.length).toBeGreaterThanOrEqual(2);
      const honest = choices.find((b) => /\+\d+ karma/.test(b.detail ?? ""));
      const karma = p.town.players[0]?.karma ?? 0;
      if (honest) {
        p = px(p, honest.id);
        expect(p.town.players[0]?.karma).toBeGreaterThan(karma);
      } else p = px(p, choices[0]?.id as string);
      expect(ids(p.view)).toEqual(["go:desk"]);
    }
    expect(seen).toBe(true);
  });

  it("3.8 a family remembers how it left", () => {
    let p = meet(atXDesk({ seed: 18 }), (c) => {
      c.mood = 1;
    });
    const surname = cust(p).expanded.surname;
    p = px(p, "neg:done");
    if (ids(p.view).includes("prep:start")) {
      p = px(p, "prep:start");
      p = px(p, p.view.buttons.find((b) => b.enabled !== false)?.id as string);
    }
    const families = p.town.players[0]?.expanded?.families ?? [];
    expect(families.find((f) => f.surname === surname)?.memory).toBe("happy");
  });
});

describe("3.4 walkouts", () => {
  it("send the body to a rival, who is paid at once (10.2), and hurt word of mouth", () => {
    let p = meet(atXDesk({ seed: 19 }), (c) => {
      c.mood = 10;
    });
    const rivals = (t: TownState) => t.players.slice(1).reduce((s, q) => s + q.bp, 0);
    const before = rivals(p.town);
    p = px(p, "neg:guilt");
    expect(p.view.customer).toBeUndefined();
    expect(rivals(p.town)).toBeGreaterThanOrEqual(before + 5);
    for (const q of p.town.players) expect(q.mail.some((m) => m.type === "varMod")).toBe(false);
    expect(p.town.players[0]?.expanded?.reviews).toBe(X.rating.walkout);
    expect(p.town.players[0]?.expanded?.record.walkouts).toBe(1);
  });
});
