import { describe, expect, it } from "vitest";
import { step } from "../src/index.js";
import {
  actOn,
  atPlace,
  buttonIds,
  me,
  type Placed,
  plain,
  pressOn,
  reload,
  submit,
} from "./support/places.js";

const tags =
  (wood: number, silver: number, gold: number) => (t: { players: { tags: number[] }[] }) => {
    (t.players[0] as { tags: number[] }).tags = [wood, silver, gold];
  };

/** Opens the count prompt for `from` to `to` (0 wood, 1 silver, 2 gold). */
function prompt(bank: Placed, from: string, to: number, fromTier: number): Placed {
  let p = pressOn(bank, "bank:exchange");
  p = pressOn(p, `bank:${from}`);
  return pressOn(p, `bank:ask:${fromTier}:${to}`);
}

describe("Bank (commands_bank.cpp)", () => {
  it("shows the teller, the bank background and the four buttons (:390-415, :378-388)", () => {
    const { view, town } = atPlace("bank");
    expect(plain(view)).toBe('Teller: "How\'s business, Skelly?"');
    expect(buttonIds(view)).toEqual(["bank:all-wood", "bank:all-gold", "bank:exchange", "go:map"]);
    expect(view.buttons.map((b) => b.label)).toEqual([
      "All to wood",
      "All to gold",
      "Exchange",
      "Leave",
    ]);
    expect(view.picture).toEqual({ bg: "places/bank" });
    expect(plain({ ...view, text: view.note ?? [] })).toMatch(/^You are at the city bank/);
    expect(town.sessions["0"]?.location).toBe("Bank");
  });

  it("offers Gold, Silver, Wood and Back, then the targets of each tier (:307-377)", () => {
    let p = pressOn(atPlace("bank"), "bank:exchange");
    expect(plain(p.view)).toBe('Teller: "Which kind tag would you like to exchange?"');
    expect(p.view.buttons.map((b) => b.label)).toEqual(["Wood", "Silver", "Gold", "Back"]);
    expect(buttonIds(p.view).at(-1)).toBe("go:bank");
    const wood = pressOn(p, "bank:wood");
    expect(plain(wood.view)).toBe('Teller: "What would you like to convert your Wood to?"');
    expect(wood.view.buttons.map((b) => b.label)).toEqual(["Silver", "Gold", "Back"]);
    const silver = pressOn(p, "bank:silver");
    expect(silver.view.buttons.map((b) => b.label)).toEqual(["Wood", "Gold", "Back"]);
    const gold = pressOn(p, "bank:gold");
    expect(gold.view.buttons.map((b) => b.label)).toEqual(["Wood", "Silver", "Back"]);
    p = pressOn(wood, "bank:exchange");
    expect(buttonIds(p.view)).toContain("bank:wood");
  });

  const ratios: [string, number, number, string][] = [
    ["wood", 0, 1, "2 Wood tag(s) = 1 Silver tag(s)"],
    ["wood", 0, 2, "4 Wood tag(s) = 1 Gold tag(s)"],
    ["silver", 1, 2, "2 Silver tag(s) = 1 Gold tag(s)"],
    ["silver", 1, 0, "1 Silver tag(s) = 2 Wood tag(s)"],
    ["gold", 2, 1, "1 Gold tag(s) = 2 Silver tag(s)"],
    ["gold", 2, 0, "1 Gold tag(s) = 4 Wood tag(s)"],
  ];
  it.each(ratios)(
    "states the %s ratio before asking how many (:265-305)",
    (name, from, to, line) => {
      const p = prompt(atPlace("bank", { setup: tags(9, 9, 9) }), name, to, from);
      expect(p.view.overlay?.kind).toBe("textInput");
      expect((p.view.overlay as { prompt: string }).prompt).toContain(line);
      expect(p.view.buttons).toEqual([]);
    },
  );

  // [from, to, count, wood, silver, gold] -> after (:213-220: gain rounds down, only the paying tags go)
  const exchanges: [number, number, string, [number, number, number], [number, number, number]][] =
    [
      [0, 2, "7", [7, 0, 0], [3, 0, 1]],
      [0, 1, "10", [10, 0, 0], [0, 5, 0]],
      [0, 1, "5", [5, 0, 0], [1, 2, 0]],
      [1, 2, "5", [0, 5, 0], [0, 1, 2]],
      [1, 0, "3", [0, 3, 0], [6, 0, 0]],
      [2, 1, "3", [0, 0, 3], [0, 6, 0]],
      [2, 0, "3", [0, 0, 3], [12, 0, 0]],
    ];
  it.each(exchanges)(
    "tier %i to %i, count %s: tags %j become %j (tag values 1/2/4, :36-38)",
    (from, to, count, before, after) => {
      const names = ["wood", "silver", "gold"];
      let p = prompt(atPlace("bank", { setup: tags(...before) }), names[from] as string, to, from);
      p = submit(p, count);
      expect(me(p).tags).toEqual(after);
      expect(plain(p.view)).toMatch(
        /^Teller: "Very good, I have converted \d+ \w+ tag\(s\) to \d+ \w+ tag\(s\)\. Any other tags/,
      );
      expect(p.view.buttons.map((b) => b.label)).toEqual(["Wood", "Silver", "Gold", "Back"]);
      expect(p.view.hud?.tags).toEqual({ wood: after[0], silver: after[1], gold: after[2] });
    },
  );

  it("words the confirmation with what was really lost and gained (:250-262)", () => {
    const p = submit(prompt(atPlace("bank", { setup: tags(7, 0, 0) }), "wood", 2, 0), "7");
    expect(plain(p.view)).toContain("converted 4 Wood tag(s) to 1 Gold tag(s)");
  });

  describe("refusals, in the original order (:155-221)", () => {
    const setup = tags(3, 2, 1);
    const start = () => prompt(atPlace("bank", { setup }), "wood", 2, 0);

    it("zero (or text that is not a number) goes back to the tier menu", () => {
      for (const text of ["0", "", "abc"]) {
        const p = submit(start(), text);
        expect(plain(p.view)).toBe('Teller: "Which kind tag would you like to exchange?"');
        expect(me(p).tags).toEqual([3, 2, 1]);
      }
    });
    it("negative counts are amusing, and the teller uses sir or ma'am", () => {
      const p = submit(start(), "-4");
      expect(plain(p.view)).toBe('Teller: "You are very amusing sir."');
      expect(buttonIds(p.view)).toEqual(["bank:exchange"]);
      expect(p.view.buttons[0]?.label).toBe("Continue");
    });
    it("cannot trade what you do not have", () => {
      const p = submit(start(), "4");
      expect(plain(p.view)).toContain("You can't exchange what you don't have.");
      expect(me(p).tags).toEqual([3, 2, 1]);
    });
    it("cannot trade fewer than one tag's worth", () => {
      const p = submit(start(), "3");
      expect(plain(p.view)).toBe(
        "Teller: \"You don't understand, do you. You can't trade just 3 for a Gold tag, alright?\"",
      );
      expect(me(p).tags).toEqual([3, 2, 1]);
    });
    it("a cancelled prompt goes back to the tier menu (12ABORT12, :232-236)", () => {
      const p = submit(start(), null);
      expect(plain(p.view)).toBe('Teller: "Which kind tag would you like to exchange?"');
    });
    it("every refusal's Continue returns to the tier menu", () => {
      const p = pressOn(submit(start(), "4"), "bank:exchange");
      expect(plain(p.view)).toBe('Teller: "Which kind tag would you like to exchange?"');
    });
  });

  it("the teller says ma'am to a woman (:176-185)", () => {
    // Player 1 (female) is logged off by atPlace; build the scene for her through a swapped sex.
    const p = prompt(
      atPlace("bank", {
        setup: (t) => {
          (t.players[0] as { male: boolean; tags: number[] }).male = false;
          tags(3, 0, 0)(t);
        },
      }),
      "wood",
      2,
      0,
    );
    expect(plain(submit(p, "-1").view)).toBe('Teller: "You are very amusing ma\'am."');
  });

  it("All to wood turns silver and gold into wood at 2 and 4 each (:417-428, :472-488)", () => {
    const p = pressOn(atPlace("bank", { setup: tags(2, 3, 4) }), "bank:all-wood");
    expect(me(p).tags).toEqual([2 + 6 + 16, 0, 0]);
    expect(plain(p.view)).toBe("A teller converts all your tags to Wood for you.");
    expect(buttonIds(p.view)).toEqual([
      "bank:all-wood",
      "bank:all-gold",
      "bank:exchange",
      "go:map",
    ]);
  });

  it("All to gold goes through wood and keeps the remainder as wood (:430-469, :492-517)", () => {
    const p = pressOn(atPlace("bank", { setup: tags(3, 1, 1) }), "bank:all-gold");
    // 3 + 2 + 4 = 9 wood; 2 gold cost 8; 1 wood is left.
    expect(me(p).tags).toEqual([1, 0, 2]);
    expect(plain(p.view)).toBe("A teller converts all your tags to Gold for you.");
  });

  it("All to gold with less than one gold's worth only gathers the wood (:437-442)", () => {
    const p = pressOn(atPlace("bank", { setup: tags(1, 1, 0) }), "bank:all-gold");
    expect(me(p).tags).toEqual([3, 0, 0]);
  });

  it("All to gold on nothing changes nothing", () => {
    const p = pressOn(atPlace("bank"), "bank:all-gold");
    expect(me(p).tags).toEqual([0, 0, 0]);
  });

  it("survives a save and load while the count prompt is open", () => {
    const open = prompt(atPlace("bank", { setup: tags(8, 0, 0) }), "wood", 2, 0);
    const loaded = reload(open);
    const done = submit(loaded, "8");
    expect(me(done).tags).toEqual([0, 0, 2]);
    // The view stored in the session still validates the prompt after loading.
    const bogus = step(
      loaded.town,
      0,
      { type: "submitText", overlayId: "bank:other", text: "1" },
      loaded.ctx,
    );
    expect(bogus.rejected).toBeDefined();
    // Free text longer than the prompt allows is refused by the guard.
    const long = step(
      loaded.town,
      0,
      { type: "submitText", overlayId: "bank:count", text: "1".repeat(40) },
      loaded.ctx,
    );
    expect(long.rejected).toBe("Text is too long");
  });

  it("only offers its own buttons while the prompt is open", () => {
    const open = prompt(atPlace("bank", { setup: tags(8, 0, 0) }), "wood", 2, 0);
    const r = step(open.town, 0, { type: "press", buttonId: "bank:exchange" }, open.ctx);
    expect(r.rejected).toBe("Answer the overlay first");
    expect(
      actOn(open, { type: "submitText", overlayId: "bank:count", text: "4" }).view.overlay,
    ).toBeUndefined();
  });
});
