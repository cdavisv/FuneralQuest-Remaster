import { describe, expect, it } from "vitest";
import { CLASSIC_RULES, originalClassicRules, step } from "../src/index.js";
import {
  actOn,
  atPlace,
  buttonIds,
  me,
  type Placed,
  plain,
  pressOn,
  reload,
} from "./support/places.js";

const gold =
  (n: number, extra: Partial<{ ride: number; turns: number }> = {}) =>
  (t: { players: { tags: number[]; transportation: number; turns: number }[] }) => {
    const p = t.players[0];
    if (!p) return;
    p.tags = [0, 0, n];
    if (extra.ride !== undefined) p.transportation = extra.ride;
    if (extra.turns !== undefined) p.turns = extra.turns;
  };

function look(store: Placed, n: number): Placed {
  return pressOn(pressOn(store, "store:hearse"), `store:look:${n}`);
}

describe("Di-Mart front counter (command_store.cpp:92-123)", () => {
  it("greets by name with the shop background and Elijah", () => {
    const { view, town } = atPlace("store");
    expect(plain(view)).toBe('Elijah: "What can I get for you today, Skelly?"');
    expect(buttonIds(view)).toEqual(["store:security", "store:supplies", "store:hearse", "go:map"]);
    expect(view.buttons.map((b) => b.label)).toEqual(["Security", "Supplies", "Hearses", "Leave"]);
    expect(view.picture).toEqual({ bg: "places/store", fg: "people/store_guy" });
    expect(town.sessions["0"]?.location).toBe("Store");
  });
});

describe("hearse showroom (command_store.cpp:54-90, transportation.cpp:22-70)", () => {
  it("lists Budget Hearse to Crown Sovereign with their prices; the bicycle is not for sale", () => {
    const p = pressOn(atPlace("store"), "store:hearse");
    expect(plain(p.view)).toBe(
      [
        'Elijah: "We carry nothing but the best in funeral transportation."',
        "",
        "1 - Budget Hearse - Cost: 12 gold tags.",
        "2 - Medalist - Cost: 30 gold tags.",
        "3 - Statesman - Cost: 50 gold tags.",
        "4 - Crown Sovereign - Cost: 80 gold tags.",
        "",
      ].join("\n"),
    );
    expect(p.view.buttons.map((b) => b.label)).toEqual([
      "View #1",
      "View #2",
      "View #3",
      "View #4",
      "Back",
    ]);
    expect(buttonIds(p.view)).toEqual([
      "store:look:1",
      "store:look:2",
      "store:look:3",
      "store:look:4",
      "go:store",
    ]);
  });

  it("the table is 4/12/30/50/80 gold for +0/2/4/7/10 turns", () => {
    expect(CLASSIC_RULES.hearses.map((h) => [h.price, h.bonusTurns])).toEqual([
      [4, 0],
      [12, 2],
      [30, 4],
      [50, 7],
      [80, 10],
    ]);
  });

  it("a close look shows the hearse art, the effect and the trade-in (:125-156)", () => {
    const p = look(atPlace("store", { setup: gold(100) }), 3);
    expect(p.view.picture).toEqual({ bg: "hearse/hearse3", fg: "blank" });
    const text = plain(p.view);
    expect(text).toContain("The Statesman - The paradigm of contemporary elegance");
    expect(text).toContain("Effect: 7 extra turns per day.");
    // Bicycle price 4, so the trade-in is 2 and the cost 50 - 2.
    expect(text).toContain(
      "After trading in your Bicycle for 2 gold tags, the cost will be 48 gold tags.",
    );
    expect(buttonIds(p.view)).toEqual(["store:buy", "store:hearse"]);
  });

  const upgrades: [number, number, number][] = [
    [1, 10, 2],
    [2, 28, 4],
    [3, 48, 7],
    [4, 78, 10],
  ];
  it.each(upgrades)(
    "buying hearse %i from the bicycle costs %i gold and gives %i turns (:158-212)",
    (n, cost, bonus) => {
      const p = pressOn(look(atPlace("store", { setup: gold(100, { turns: 5 }) }), n), "store:buy");
      expect(me(p).tags[2]).toBe(100 - cost);
      expect(me(p).transportation).toBe(n);
      expect(me(p).turns).toBe(5 + bonus);
      expect(plain(p.view)).toBe(
        `You trade in your Bicycle for a brand new ${["", "Budget Hearse", "Medalist", "Statesman", "Crown Sovereign"][n]}!\n\nYou have time for an extra ${bonus} customers today.`,
      );
      expect(p.view.picture?.fg).toBe("stuff/money_bag_2");
      expect(buttonIds(p.view)).toEqual(["store:hearse"]);
    },
  );

  it("the trade-in is half the current hearse's price, rounded down", () => {
    // Medalist (30) to Crown Sovereign (80): 80 - 15 = 65.
    const store = atPlace("store", { setup: gold(65, { ride: 2 }) });
    const text = plain(look(store, 4).view);
    expect(text).toContain(
      "After trading in your Medalist for 15 gold tags, the cost will be 65 gold tags.",
    );
    const p = pressOn(look(store, 4), "store:buy");
    expect(me(p).tags[2]).toBe(0);
  });

  it("cannot afford: Elijah sends you away and nothing changes (:172-186)", () => {
    const p = pressOn(look(atPlace("store", { setup: gold(9, { turns: 5 }) }), 1), "store:buy");
    expect(plain(p.view)).toBe(
      "Elijah: \"I'm sorry, I really don't have time to waste.  You obviously cannot afford a luxury sedan such as the Budget Hearse.\"",
    );
    expect(me(p).tags[2]).toBe(9);
    expect(me(p).transportation).toBe(0);
    expect(me(p).turns).toBe(5);
    expect(buttonIds(p.view)).toEqual(["store:hearse"]);
  });

  it("exactly enough gold buys it", () => {
    const p = pressOn(look(atPlace("store", { setup: gold(10) }), 1), "store:buy");
    expect(me(p).tags[2]).toBe(0);
    expect(me(p).transportation).toBe(1);
  });

  it("buying without looking first is refused (:164-168)", () => {
    const store = pressOn(atPlace("store", { setup: gold(100) }), "store:hearse");
    const r = step(store.town, 0, { type: "press", buttonId: "store:buy" }, store.ctx);
    expect(r.rejected).toBeDefined();
  });

  describe("fixed (default): only a dearer hearse can be bought", () => {
    it("re-buying the hearse you drive is refused: no gold, no turns", () => {
      const store = atPlace("store", { setup: gold(100, { ride: 1, turns: 5 }) });
      const looked = look(store, 1);
      expect(plain(looked.view)).toContain(
        "You already drive a Budget Hearse.  The Budget Hearse would be no improvement",
      );
      const p = pressOn(looked, "store:buy");
      expect(plain(p.view)).toBe(
        'Elijah: "You already drive a Budget Hearse.  I can\'t sell you a Budget Hearse on top of that, friend."',
      );
      expect(me(p).tags[2]).toBe(100);
      expect(me(p).turns).toBe(5);
    });
    it("a cheaper hearse is refused: no gold paid out", () => {
      const store = atPlace("store", { setup: gold(0, { ride: 4, turns: 5 }) });
      const p = pressOn(look(store, 1), "store:buy");
      expect(plain(p.view)).toContain("You already drive a Crown Sovereign");
      expect(me(p).tags[2]).toBe(0);
      expect(me(p).transportation).toBe(4);
      expect(me(p).turns).toBe(5);
    });
  });

  describe("original behaviour (fixes.hearseRebuy off)", () => {
    const rules = originalClassicRules();
    it("re-buying a hearse costs half its price and grants its turns again, every time", () => {
      let p = atPlace("store", { rules, setup: gold(100, { ride: 1, turns: 5 }) });
      p = pressOn(look(p, 1), "store:buy"); // 12 - 6 = 6 gold
      expect(me(p).tags[2]).toBe(94);
      expect(me(p).turns).toBe(7);
      p = pressOn(look(p, 1), "store:buy");
      expect(me(p).tags[2]).toBe(88);
      expect(me(p).turns).toBe(9);
      expect(me(p).transportation).toBe(1);
    });
    it('"buying" a cheaper hearse has a negative price and pays gold tags', () => {
      let p = atPlace("store", { rules, setup: gold(0, { ride: 4, turns: 5 }) });
      const looked = look(p, 1);
      // 12 - 80/2 = -28
      expect(plain(looked.view)).toContain("the cost will be -28 gold tags");
      p = pressOn(looked, "store:buy");
      expect(me(p).tags[2]).toBe(28);
      expect(me(p).transportation).toBe(1);
      expect(me(p).turns).toBe(7);
    });
  });

  it("survives a save and load between looking and buying", () => {
    const looked = look(atPlace("store", { setup: gold(100) }), 2);
    const p = pressOn(reload(looked), "store:buy");
    expect(me(p).transportation).toBe(2);
    expect(me(p).tags[2]).toBe(72);
  });
});

describe("security shelf: store_security.c", () => {
  const shelf = (g: number, custom: Record<number, number> = {}) =>
    pressOn(
      atPlace("store", {
        setup: (t) => {
          gold(g)(t);
          for (const [i, v] of Object.entries(custom))
            (t.players[0] as { custom: number[] }).custom[Number(i)] = v;
        },
      }),
      "store:security",
    );

  it("lists the padlock, smoke detector and safe with their prices (:209-288)", () => {
    const p = shelf(0);
    expect(plain(p.view)).toBe(
      [
        'Elijah: "This town seems accident prone.  Investing in security is a great idea."',
        "",
        "1 - Heavy Padlock - Cost: 6 gold tags",
        "2 - Smoke Detector - Cost: 8 gold tags",
        "3 - Safe - Cost: 6 gold tags",
        "",
      ].join("\n"),
    );
    expect(p.view.buttons.map((b) => b.label)).toEqual(["View #1", "View #2", "View #3", "Back"]);
    expect(buttonIds(p.view)).toEqual(["script:2", "script:3", "script:4", "go:store"]);
    expect(p.view.picture?.bg).toBe("places/store");
    expect(p.view.picture?.fg).toBe("people/store_guy");
    expect(plain({ ...p.view, text: p.view.note ?? [] })).toBe("You are in the supplies section.");
  });

  it("marks what you already own, with the padlock's strength", () => {
    const p = shelf(0, { 0: 1, 1: 1, 2: 1, 4: 73 });
    expect(plain(p.view)).toContain(
      "1 - Heavy Padlock - Cost: 6 gold tags (already own one at 73 percent strength)",
    );
    expect(plain(p.view)).toContain("2 - Smoke Detector - Cost: 8 gold tags (already own one)");
    expect(plain(p.view)).toContain("3 - Safe - Cost: 6 gold tags (already own one)");
  });

  // [name, view button, price, custom slot it sets (player_struct.h:24-29), purchase line]
  const items: [string, string, number, number, string][] = [
    ["padlock", "script:2", 6, 2, "You purchase the Heavy Padlock for 6 gold tags."],
    ["smoke detector", "script:3", 8, 0, "You purchase the Smoke Detector for 8 gold tags."],
    ["safe", "script:4", 6, 1, "You purchase the Safe for 6 gold tags."],
  ];
  it.each(items)(
    "buying the %s (%s) costs %i gold and sets custom[%i]",
    (_name, view, price, slot, bought) => {
      const looked = pressOn(shelf(price + 3), view);
      expect(buttonIds(looked.view)).toEqual(["script:2", "script:1"]);
      expect(looked.view.buttons.map((b) => b.label)).toEqual(["Buy it", "Back"]);
      const done = pressOn(looked, "script:2");
      expect(plain(done.view)).toBe(bought);
      expect(done.view.picture?.fg).toBe("stuff/money_bag_2");
      expect(me(done).tags[2]).toBe(3);
      const flags = me(done).custom.slice(0, 3);
      expect(flags).toEqual([0, 1, 2].map((i) => (i === slot ? 1 : 0)));
      // Continue goes back to the shelf, which now says you own it.
      const back = pressOn(done, "script:1");
      expect(plain(back.view)).toContain("already own one");
    },
  );

  it("a new padlock has 100 percent strength (store_security.c:127)", () => {
    const done = pressOn(pressOn(shelf(6), "script:2"), "script:2");
    expect(me(done).custom[2]).toBe(1);
    expect(me(done).custom[4]).toBe(100);
    expect(plain(pressOn(done, "script:1").view)).toContain(
      "already own one at 100 percent strength",
    );
  });

  it("buying with exactly the price leaves nothing; one short is refused with a joke each", () => {
    const exact = pressOn(pressOn(shelf(6), "script:4"), "script:2");
    expect(me(exact).tags[2]).toBe(0);
    const lines: [string, number, string][] = [
      ["script:2", 5, "You mumble something about leaving the gold tags in your other pants."],
      ["script:3", 7, "You feel like a complete dumbass.  He's right."],
      ["script:4", 5, "You nod in agreement."],
    ];
    for (const [view, have, joke] of lines) {
      const broke = pressOn(pressOn(shelf(have), view), "script:2");
      expect(plain(broke.view)).toContain(
        'Elija: "I\'m sorry, you seem to be lacking in funds.  Perhaps another time?"',
      );
      expect(plain(broke.view)).toContain(joke);
      expect(me(broke).tags[2]).toBe(have);
      expect(me(broke).custom.slice(0, 3)).toEqual([0, 0, 0]);
      expect(broke.view.picture?.fg).toBe("people/store_guy");
    }
  });

  it("owning it already is refused before money is looked at", () => {
    const owned: [string, string, number, string][] = [
      ["script:2", "padlock", 2, "Wait until the one you have breaks. Sorry, company policy."],
      [
        "script:3",
        "smoke",
        0,
        "Your parlor is quite small.  You really don't need two of these things.",
      ],
      ["script:4", "safe", 1, "You already own a Safe.  You shouldn't need two."],
    ];
    for (const [view, , slot, line] of owned) {
      const p = pressOn(pressOn(shelf(50, { [slot]: 1 }), view), "script:2");
      expect(plain(p.view)).toContain(line);
      expect(me(p).tags[2]).toBe(50);
    }
  });

  it("Back from an item returns to the shelf; Back from the shelf returns to the store", () => {
    const p = pressOn(pressOn(shelf(0), "script:3"), "script:1");
    expect(buttonIds(p.view)).toEqual(["script:2", "script:3", "script:4", "go:store"]);
    const store = pressOn(p, "go:store");
    expect(store.town.sessions["0"]?.script).toBeNull();
    expect(plain(store.view)).toMatch(/^Elijah: "What can I get for you today/);
  });

  it("survives a save and load on every screen of the script", () => {
    let p = shelf(20);
    p = pressOn(reload(p), "script:2");
    p = pressOn(reload(p), "script:2");
    p = reload(p);
    expect(me(p).tags[2]).toBe(14);
    p = pressOn(p, "script:1");
    expect(plain(reload(p).view)).toContain("already own one at 100 percent strength");
    expect(reload(p).town.sessions["0"]?.script?.id).toBe("store_security");
  });
});

describe("supplies shelf: store_supplies.c", () => {
  const shelf = (g: number, lockpicks = 0) =>
    pressOn(
      atPlace("store", {
        setup: (t) => {
          gold(g)(t);
          (t.players[0] as { custom: number[] }).custom[3] = lockpicks;
        },
      }),
      "store:supplies",
    );

  it("sells one thing, the lockpick for 1 gold tag (:70-107)", () => {
    const p = shelf(0);
    expect(plain(p.view)).toBe(
      [
        'Elijah: "We carry a wide assortment of useful items."',
        "",
        "1 - Lockpick - Cost: 1 gold tag",
        "",
      ].join("\n"),
    );
    expect(buttonIds(p.view)).toEqual(["script:1", "go:store"]);
    expect(p.view.buttons.map((b) => b.label)).toEqual(["View #1", "Back"]);
  });

  it("shows how many you have, and buying keeps you on that screen with the new count (:14-68)", () => {
    let p = pressOn(shelf(3, 2), "script:1");
    expect(plain(p.view)).toContain(
      "These are 1 gold tag each.  (You currently have 2 lockpick(s))",
    );
    expect(p.view.picture?.fg).toBe("stuff/lockpick");
    expect(p.view.buttons.map((b) => b.label)).toEqual(["Buy one", "Back"]);
    p = pressOn(p, "script:2");
    expect(plain(p.view)).toBe("You purchase a Lockpick for 1 gold tag.");
    expect(me(p).custom[3]).toBe(3);
    expect(me(p).tags[2]).toBe(2);
    p = pressOn(p, "script:1");
    expect(plain(p.view)).toContain("(You currently have 3 lockpick(s))");
    p = pressOn(pressOn(p, "script:2"), "script:1");
    p = pressOn(pressOn(p, "script:2"), "script:1");
    expect(me(p).custom[3]).toBe(5);
    expect(me(p).tags[2]).toBe(0);
  });

  it("with no gold left Elijah turns you away and you are back at the shelf", () => {
    let p = pressOn(pressOn(shelf(0), "script:1"), "script:2");
    expect(plain(p.view)).toBe(
      "Elija: \"You don't have a single gold tag at the moment?  That's too bad.  These are great little lockpicks.\"",
    );
    expect(me(p).custom[3]).toBe(0);
    p = pressOn(p, "script:1");
    expect(plain(p.view)).toContain("Lockpick - Cost");
    expect(buttonIds(p.view)).toEqual(["script:1", "go:store"]);
  });

  it("Back from the lockpick screen returns to the shelf", () => {
    const p = pressOn(pressOn(shelf(0), "script:1"), "script:1");
    expect(buttonIds(p.view)).toEqual(["script:1", "go:store"]);
  });

  it("survives a save and load while buying", () => {
    let p = pressOn(shelf(4), "script:1");
    p = pressOn(reload(p), "script:2");
    p = pressOn(reload(p), "script:1");
    p = reload(p);
    expect(plain(p.view)).toContain("(You currently have 1 lockpick(s))");
    expect(p.town.sessions["0"]?.script?.id).toBe("store_supplies");
    const r = actOn(p, { type: "press", buttonId: "script:1" });
    expect(r.town.sessions["0"]).toBeDefined();
  });
});
