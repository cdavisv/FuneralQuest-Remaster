import { describe, expect, it } from "vitest";
import { RewardText } from "../src/classic/events.js";
import {
  CLASSIC_RULES,
  ClassicRandom,
  computeEvent,
  expMod,
  intToCash,
  luckMod,
  type PlayerState,
  parseLegacyText,
  ratingTitle,
  stripLegacyCodes,
  turnsMod,
} from "../src/index.js";
import { makeTown } from "./support/harness.js";
import { legacyContent } from "./support/legacyContent.js";

function player(change: Partial<PlayerState> = {}): PlayerState {
  const { town } = makeTown(1, 1);
  return { ...(town.players[0] as PlayerState), ...change };
}

describe("seth_ansi as RichText (legacy/source/funeral_util.cpp:336-495)", () => {
  it("maps colour codes to spans", () => {
    expect(parseLegacyText('`wBob: `$"Hi"')).toEqual([
      { text: "Bob: ", color: "white" },
      { text: '"Hi"', color: "yellow" },
    ]);
    expect(parseLegacyText("plain `5num")).toEqual([
      { text: "plain " },
      { text: "num", color: "purple" },
    ]);
    expect(parseLegacyText("`yy`^k`#p")).toEqual([
      { text: "y", color: "yellow" },
      { text: "k", color: "black" },
      { text: "p", color: "pink" },
    ]);
  });

  it("handles `=, `fN, unknown codes and a trailing backtick like the original", () => {
    expect(parseLegacyText("a`=b")).toEqual([{ text: "a=b" }]);
    expect(parseLegacyText("`f3big")).toEqual([{ text: "big", size: 3 }]);
    expect(parseLegacyText("x`ay")).toEqual([{ text: "x`y" }]);
    expect(parseLegacyText("end`")).toEqual([{ text: "end`" }]);
    expect(parseLegacyText("line\r\nnext")).toEqual([{ text: "line\nnext" }]);
  });

  it("StripSethAnsi removes every code (:499-575)", () => {
    expect(stripLegacyCodes("`wA`$B`f2C`")).toBe("ABC");
  });
});

describe("luck, BP and turns (legacy/source/funeral_util.cpp:77-126)", () => {
  it("get_random_yes_no pulls luck toward 50 by (1 - weight)", () => {
    // weight 0.9, luck 0: 0 + int(50 * 0.1) = 5, so rolls 0..5 pass: 6%.
    const rng = new ClassicRandom(7, 7);
    let pass = 0;
    for (let i = 0; i < 20000; i++) if (rng.randomYesNo(0, 0.9)) pass++;
    expect(pass / 20000).toBeCloseTo(0.06, 2);
  });

  it("luck_mod clamps to 1..100", () => {
    const p = player({ luck: 95 });
    luckMod(CLASSIC_RULES, p, 30);
    expect(p.luck).toBe(100);
    luckMod(CLASSIC_RULES, p, -500);
    expect(p.luck).toBe(1);
  });

  it("exp_mod never takes more than today's BP", () => {
    const p = player({ bp: 100, bpToday: 20 });
    expMod(p, -50);
    expect(p.bpToday).toBe(0);
    expect(p.bp).toBe(80);
    expMod(p, 7);
    expect(p).toMatchObject({ bp: 87, bpToday: 7 });
  });

  it("turns_mod never goes below 0", () => {
    const p = player({ turns: 2 });
    turnsMod(p, -5);
    expect(p.turns).toBe(0);
  });
});

describe("CEvent (legacy/source/CEvent.cpp:115-210)", () => {
  const content = legacyContent();

  it("loads the 23 events, 21 blurbs, 10 risks, 55 soft and 10 hard sell items", () => {
    expect(content.events.ranges[0]?.entries.length).toBe(23);
    expect(content.newsBlurbs.ranges[0]?.entries.length).toBe(21);
    expect(content.risks.length).toBe(10);
    expect(content.softSell.length).toBe(55);
    expect(content.hardSell.map((h) => h.price)).toEqual([
      2250, 2560, 3100, 3400, 3000, 2500, 2100, 1750, 2400, 2600,
    ]);
  });

  it("draws one random(count) for a matching range and none otherwise", () => {
    const rng = new ClassicRandom(3, 3);
    const e = computeEvent(rng, content.events, 10, { message: "No message.", picture: "x" });
    expect(rng.mt.draws).toBe(1);
    expect(e.message).not.toBe("No message.");
    const none = computeEvent(
      rng,
      { ranges: [{ low: 5, high: 6, entries: [{ message: "m" }] }] },
      7,
      {
        message: "No message.",
        picture: "x",
      },
    );
    expect(rng.mt.draws).toBe(1);
    expect(none.message).toBe("No message.");
  });

  it("add_reward_text (legacy/source/misc_utils.cpp:50-91)", () => {
    const r = new RewardText(content.text);
    r.add("Bury Points", 5);
    r.add("luck", -2);
    r.add("turns", 0);
    expect(stripLegacyCodes(r.finish())).toBe("\n\nYou earn 5 Bury Points and 2 luck.");
  });
});

describe("rating title (legacy/source/commands_misc.cpp:141-158)", () => {
  it("clamps to 1..100 and uses ratings.txt line N", () => {
    const content = legacyContent();
    expect(ratingTitle(content, 1)).toBe("You are running the crappiest parlor in the city!");
    expect(ratingTitle(content, -5)).toBe(ratingTitle(content, 1));
    expect(ratingTitle(content, 100)).toBe(content.ratings[99] || content.text.stats.noRatingText);
  });

  it("int_to_cash adds separators", () => {
    expect(intToCash(0)).toBe("0");
    expect(intToCash(1234567)).toBe("1,234,567");
    expect(intToCash(-1800)).toBe("-1,800");
  });
});
