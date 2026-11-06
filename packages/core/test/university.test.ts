import { describe, expect, it } from "vitest";
import type { TownState } from "../src/index.js";
import { atPlace, buttonIds, me, plain, pressOn, reload, submit } from "./support/places.js";

type Setup = (t: TownState) => void;
const player = (t: TownState) => t.players[0] as TownState["players"][number];
const gold =
  (n: number, extra: Partial<TownState["players"][number]> = {}): Setup =>
  (t) => {
    Object.assign(player(t), { tags: [0, 0, n] }, extra);
  };

describe("Spirit University front (commands_spirit.cpp:79-137)", () => {
  it("lists the three classes with this player's costs", () => {
    const { view, town } = atPlace("spirit-university");
    expect(plain(view)).toBe(
      [
        "Class schedules",
        "",
        "PSY - Social Psychology (cost: 4 gold tags)",
        "PE - Physical Education (cost: 12 gold tags)",
        "ST - Strength Training (cost: 9 gold tags)",
      ].join("\n"),
    );
    expect(view.buttons.map((b) => b.label)).toEqual([
      "Library",
      "Take PSY",
      "Take PE",
      "Take ST",
      "Leave",
    ]);
    expect(buttonIds(view)).toEqual([
      "spirit-university:library",
      "spirit-university:psych",
      "spirit-university:hp",
      "spirit-university:strength",
      "go:map",
    ]);
    expect(view.picture).toEqual({ bg: "places/psych" });
    expect(plain({ ...view, text: view.status ?? [] })).toBe(
      "Taking classes at SU is a great way to expand your options.",
    );
    expect(town.sessions["0"]?.location).toBe("Spirit U");
  });
});

describe("psychology class (:139-142, :155-218): 4 + 2 per level learned", () => {
  const costs: [number, number][] = [
    [0, 4],
    [1, 6],
    [2, 8],
    [5, 14],
    [9, 22],
  ];
  it.each(costs)("psych %i costs %i gold", (psych, cost) => {
    const p = pressOn(
      atPlace("spirit-university", { setup: gold(cost, { psych }) }),
      "spirit-university:psych",
    );
    expect(me(p).tags[2]).toBe(0);
    expect(me(p).psych).toBe(psych + 1);
    expect(plain(p.view)).toContain(`Your psychology level is raised to ${psych + 2}!`);
  });

  it("one gold short fails with the pockets line and changes nothing", () => {
    const p = pressOn(atPlace("spirit-university", { setup: gold(3) }), "spirit-university:psych");
    expect(plain(p.view)).toBe(
      "You fumble through your pockets in vain - you don't have enough gold tags to pay for the class.",
    );
    expect(me(p).tags[2]).toBe(3);
    expect(me(p).psych).toBe(0);
    expect(buttonIds(p.view)).toEqual(["spirit-university:main"]);
  });

  const skills = [
    "Mood reading",
    "Financial Estimation",
    "Cutting resistance in half",
    "Cutting mood in half",
    "Doubling spending limit",
  ];
  it.each(skills.map((s, i) => [i + 1, s] as const))(
    "reaching level %i teaches %s",
    (level, skill) => {
      const p = pressOn(
        atPlace("spirit-university", { setup: gold(99, { psych: level - 1 }) }),
        "spirit-university:psych",
      );
      expect(plain(p.view)).toContain(`You have learned a new skill: ${skill}`);
    },
  );

  it("no new skill is announced after level 5 (psych is not capped)", () => {
    const p = pressOn(
      atPlace("spirit-university", { setup: gold(99, { psych: 5 }) }),
      "spirit-university:psych",
    );
    expect(plain(p.view)).toBe(
      "You study hard for about an hour.  Your psychology level is raised to 7!",
    );
  });

  it("Continue shows the schedule again with the new cost", () => {
    const p = pressOn(
      pressOn(atPlace("spirit-university", { setup: gold(4) }), "spirit-university:psych"),
      "spirit-university:main",
    );
    expect(plain(p.view)).toContain("PSY - Social Psychology (cost: 6 gold tags)");
    expect(p.view.hud?.tags.gold).toBe(0);
  });
});

describe("physical education (:143-147, :220-252): int(hp_max * 1.2f) gold for 4 or 5 hit points", () => {
  const costs: [number, number][] = [
    [10, 12],
    [11, 13],
    [14, 16],
    [15, 18],
    [19, 22],
    [100, 120],
  ];
  it.each(costs)("max HP %i costs %i gold", (hpMax, cost) => {
    const front = atPlace("spirit-university", { setup: gold(cost - 1, { hpMax, hp: hpMax }) });
    expect(plain(front.view)).toContain(`PE - Physical Education (cost: ${cost} gold tags)`);
    const short = pressOn(front, "spirit-university:hp");
    expect(me(short).hpMax).toBe(hpMax);
    const ok = pressOn(
      atPlace("spirit-university", { setup: gold(cost, { hpMax, hp: hpMax }) }),
      "spirit-university:hp",
    );
    expect(me(ok).tags[2]).toBe(0);
    expect(me(ok).hpMax).toBeGreaterThanOrEqual(hpMax + 4);
    expect(me(ok).hpMax).toBeLessThanOrEqual(hpMax + 5);
  });

  it("gains 4 or 5, both seen over many seeds, and heals nothing", () => {
    const gains = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      const p = pressOn(
        atPlace("spirit-university", { seed, setup: gold(12, { hpMax: 10, hp: 3 }) }),
        "spirit-university:hp",
      );
      gains.add(me(p).hpMax - 10);
      expect(plain(p.view)).toBe(
        `You run laps around the gym.  You gain ${me(p).hpMax - 10} hitpoints!`,
      );
      expect(me(p).hp).toBe(3);
    }
    expect([...gains].sort()).toEqual([4, 5]);
  });

  it("draws nothing when you cannot pay", () => {
    const before = atPlace("spirit-university", { setup: gold(1) });
    const p = pressOn(before, "spirit-university:hp");
    expect(p.town.streams["0"]).toEqual(before.town.streams["0"]);
    expect(plain(p.view)).toMatch(/^You fumble through your pockets/);
  });
});

describe("strength training (:148-152, :254-286): 3 gold per point of strength", () => {
  const costs: [number, number][] = [
    [3, 9],
    [4, 12],
    [10, 30],
  ];
  it.each(costs)("strength %i costs %i gold for +1", (strength, cost) => {
    const p = pressOn(
      atPlace("spirit-university", { setup: gold(cost, { strength }) }),
      "spirit-university:strength",
    );
    expect(me(p).strength).toBe(strength + 1);
    expect(me(p).tags[2]).toBe(0);
    expect(plain(p.view)).toBe("You lift weights for a while.  You gain 1 strength!");
    const short = pressOn(
      atPlace("spirit-university", { setup: gold(cost - 1, { strength }) }),
      "spirit-university:strength",
    );
    expect(me(short).strength).toBe(strength);
    expect(me(short).tags[2]).toBe(cost - 1);
  });
});

describe("library (:288-340)", () => {
  const library = (setup?: Setup, seed?: number) =>
    pressOn(
      atPlace("spirit-university", { ...(setup ? { setup } : {}), ...(seed ? { seed } : {}) }),
      "spirit-university:library",
    );

  it("has Old Papers, View Deeds and Back", () => {
    const p = library();
    expect(plain(p.view)).toBe(
      [
        "You are in the library.",
        "",
        "Students are quietly studying here.  You see one nerdy looking kid hogging the lone library computer.",
        "",
        "The book of deeds is sitting on a pedestal close by.",
      ].join("\n"),
    );
    expect(p.view.buttons.map((b) => b.label)).toEqual(["View Deeds", "Old Papers", "Back"]);
    expect(buttonIds(pressOn(p, "spirit-university:main").view)).toContain(
      "spirit-university:psych",
    );
  });

  describe("Book of Deeds (:342-388)", () => {
    it("with no winner yet, names the current leader", () => {
      const p = pressOn(
        library((t) => {
          player(t).bp = 40;
        }),
        "spirit-university:heroes",
      );
      expect(plain(p.view)).toBe(
        "The Book Of Deeds\n\nNo one in Deathville has ever done anything worthing noting.\n\nIt's sad, really.\n\nThere is a glimmer of hope in Skelly, but he has a way to go.",
      );
      expect(buttonIds(p.view)).toEqual(["spirit-university:library-restart"]);
      expect(p.view.picture).toEqual({ bg: "places/psych" });
    });
    it("uses she for a woman leader and says nothing when nobody has points", () => {
      const woman = pressOn(
        library((t) => {
          Object.assign(player(t), { bp: 3, male: false });
        }),
        "spirit-university:heroes",
      );
      expect(plain(woman.view)).toContain("but she has a way to go.");
      const nobody = pressOn(library(), "spirit-university:heroes");
      expect(plain(nobody.view)).toBe(
        "The Book Of Deeds\n\nNo one in Deathville has ever done anything worthing noting.\n\nIt's sad, really.\n",
      );
      expect(nobody.town.sessions["0"]).toBeDefined();
    });
    it("once there are winners shows the book, one deed per line", () => {
      const p = pressOn(
        library((t) => {
          t.deeds = [
            "Seth won the 'Best Funeral Directory In The Universe' award.",
            "Digby won it too.",
          ];
        }),
        "spirit-university:heroes",
      );
      expect(plain(p.view)).toBe(
        "The Book Of Deeds\n\nSeth won the 'Best Funeral Directory In The Universe' award.\nDigby won it too.\n",
      );
    });
    it("Back returns to a fresh library", () => {
      const p = pressOn(
        pressOn(library(), "spirit-university:heroes"),
        "spirit-university:library-restart",
      );
      expect(plain(p.view)).toMatch(/^You are in the library\./);
      expect(plain({ ...p.view, text: p.view.note ?? [] })).toMatch(
        /^The role of the funeral director/,
      );
      expect(p.town.sessions["0"]?.location).toBe("Spirit U");
    });
  });

  describe("Old Papers (:390-460)", () => {
    const day5: Setup = (t) => {
      t.day = 5;
      t.news = {
        "1": { front: "`7FIRST PAPER\r\n`^Body of day one.\r\n\r\n", crime: "" },
        "4": { front: "`7YESTERDAY\r\n`^Body of day four.\r\n", crime: "" },
        "5": { front: "today", crime: "" },
      };
    };
    const ask = () => pressOn(library(day5), "spirit-university:paper-start");

    it("asks for a day between 1 and yesterday", () => {
      const p = ask();
      expect(p.view.overlay).toMatchObject({
        kind: "textInput",
        prompt: "Which old newspaper would you like to look at?  You can choose between 1 and 4.",
      });
    });
    it("shows any past front page, made legible over black (`7 to `w, `^ to `$)", () => {
      const p = submit(ask(), "4");
      expect(plain(p.view)).toBe(
        "You find a yellowing paper from day 4, it looks like it may have been peed on.\n\nYESTERDAY\nBody of day four.\n",
      );
      const raw = p.view.text.map((s) => s.color);
      expect(raw).not.toContain("grey");
      expect(raw).not.toContain("black");
      expect(p.view.text.find((s) => s.text.startsWith("YESTERDAY"))?.color).toBe("white");
      expect(p.view.text.find((s) => s.text.includes("Body of day four"))?.color).toBe("yellow");
      expect(buttonIds(p.view)).toEqual(["spirit-university:library-restart"]);
      expect(
        plain(
          submit(
            pressOn(
              pressOn(p, "spirit-university:library-restart"),
              "spirit-university:paper-start",
            ),
            "1",
          ).view,
        ),
      ).toContain("FIRST PAPER");
    });
    const bad: [string, string][] = [
      ["0", "day 0"],
      ["5", "day 5"],
      ["99", "day 99"],
      ["-3", "day -3"],
      ["abc", "day 0"],
      ["", "day 0"],
    ];
    it.each(bad)("day %j is not in the library", (text, shown) => {
      expect(plain(submit(ask(), text).view)).toBe(
        `You desperately hunt around for anything dealing with a ${shown} but fail.`,
      );
    });
    it("reads leading digits like atoi", () => {
      expect(plain(submit(ask(), "4th").view)).toContain("from day 4");
    });
    it("a day with no paper filed shows just the heading", () => {
      expect(plain(submit(ask(), "2").view)).toBe(
        "You find a yellowing paper from day 2, it looks like it may have been peed on.\n\n",
      );
    });
    it("cancelling goes back to the library", () => {
      expect(plain(submit(ask(), null).view)).toMatch(/^You are in the library\./);
    });
    it("on day 1 there is nothing to choose from", () => {
      const p = pressOn(library(), "spirit-university:paper-start");
      expect((p.view.overlay as { prompt: string }).prompt).toContain("between 1 and 0");
      expect(plain(submit(p, "1").view)).toContain("day 1 but fail");
    });
    it("survives a save and load while the prompt is open", () => {
      const p = submit(reload(ask()), "1");
      expect(plain(p.view)).toContain("FIRST PAPER");
    });
  });
});
