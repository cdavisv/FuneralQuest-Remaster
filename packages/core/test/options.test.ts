import { describe, expect, it } from "vitest";
import { richTextToPlain, step, type TownState } from "../src/index.js";
import {
  atDesk,
  buttonIds,
  me,
  type Placed,
  plain,
  pressOn,
  reload,
  submit,
} from "./support/places.js";

type Setup = (t: TownState) => void;
const gold =
  (n: number): Setup =>
  (t) => {
    (t.players[0] as { tags: number[] }).tags = [0, 0, n];
  };

/** Desk -> stats -> Name (stats.c:53 `go:options`). */
function nameScreen(setup: Setup = gold(5), settings = {}): Placed {
  return pressOn(pressOn(atDesk({ setup, settings }), "go:stats"), "go:options");
}

const front = (p: Placed) => p.town.news[String(p.town.day)]?.front ?? "";

describe("name change (command_options.cpp)", () => {
  it("is reached from the stats sheet and asks to confirm the price (:29-79)", () => {
    const p = nameScreen();
    expect(plain(p.view)).toBe(
      "Announcing your new name in the newspaper will cost 1 gold tag(s).  Do it?",
    );
    expect(richTextToPlain(p.view.note ?? [])).toBe(
      "You stare at yourself in the mirror.\n\nMaybe it's time for a change.",
    );
    expect(p.view.picture?.fg).toBe("stuff/question");
    expect(p.view.buttons.map((b) => b.label)).toEqual(["Yes", "No"]);
    expect(buttonIds(p.view)).toEqual(["options:input", "go:stats"]);
    expect(p.town.sessions["0"]?.location).toBe("Change Name");
  });

  it("No returns to the stats sheet", () => {
    expect(pressOn(nameScreen(), "go:stats").view.scene).toBe("stats");
  });

  it("the price is the Game Settings value", () => {
    expect(plain(nameScreen(gold(9), { nameChangeCost: 4 }).view)).toContain(
      "will cost 4 gold tag(s)",
    );
  });

  it.each([0, -1])(
    "a cost of %i turns it off: no prompt, back to the stats sheet (:37-55)",
    (cost) => {
      const p = nameScreen(gold(5), { nameChangeCost: cost });
      expect(plain(p.view)).toBe(
        "This server doesn't allow name changes.  You're stuck with what your parents gave you.",
      );
      expect(buttonIds(p.view)).toEqual(["go:stats"]);
      expect(p.view.picture?.fg).toBe("stuff/question");
      expect(
        step(p.town, 0, { type: "press", buttonId: "options:input" }, p.ctx).rejected,
      ).toBeDefined();
    },
  );

  it("asks for the name in a text prompt", () => {
    const p = pressOn(nameScreen(), "options:input");
    expect(p.view.overlay).toMatchObject({
      kind: "textInput",
      id: "options:name",
      prompt: "Enter your new name.",
    });
  });

  it("renames, takes the gold tag and announces it on the front page (:195-211)", () => {
    const p = submit(pressOn(nameScreen(gold(3)), "options:input"), "Mort Dillon");
    expect(me(p).name).toBe("Mort Dillon");
    expect(me(p).tags[2]).toBe(2);
    expect(plain(p.view)).toBe("You will now be known as Mort Dillon.");
    expect(buttonIds(p.view)).toEqual(["go:stats"]);
    expect(front(p)).toContain("NAME CHANGE: Skelly has changed his name to Mort Dillon.");
  });

  it("uses her for a woman", () => {
    const p = submit(
      pressOn(
        nameScreen((t) => {
          gold(1)(t);
          (t.players[0] as { male: boolean }).male = false;
        }),
        "options:input",
      ),
      "Mortisha",
    );
    expect(front(p)).toContain("Skelly has changed her name to Mortisha.");
  });

  it("charges the Game Settings price and refuses when you are one short (:121-132)", () => {
    const ok = submit(
      pressOn(nameScreen(gold(4), { nameChangeCost: 4 }), "options:input"),
      "Mort Dillon",
    );
    expect(me(ok).tags[2]).toBe(0);
    const short = submit(
      pressOn(nameScreen(gold(3), { nameChangeCost: 4 }), "options:input"),
      "Mort Dillon",
    );
    expect(plain(short.view)).toBe(
      "You don't have enough gold tags.  Go exchange your woods or something.",
    );
    expect(me(short).name).toBe("Skelly");
    expect(me(short).tags[2]).toBe(3);
    expect(buttonIds(short.view)).toEqual(["go:stats"]);
  });

  const refusals: [string, string, string][] = [
    ["Skelly", "Yeah, Skelly.. you like the sound of that... oh wait...", "same"],
    ["ab", "What, are those initials?  Pick a longer name.", "short"],
    ["x".repeat(21), "Is that a name or a lecture?  Try something shorter.", "long"],
    [
      "morticia",
      "Um, don't you think the real morticia would kind of be pissed?  Try something original.",
      "taken",
    ],
  ];
  it.each(refusals)("refuses %j: %s (:139-188)", (name, text) => {
    const p = submit(pressOn(nameScreen(), "options:input"), name);
    expect(plain(p.view)).toBe(text);
    expect(me(p).name).toBe("Skelly");
    expect(me(p).tags[2]).toBe(5);
    expect(front(p)).not.toContain("NAME CHANGE");
    expect(buttonIds(p.view)).toEqual(["go:options"]);
    expect(p.view.buttons[0]?.label).toBe("Continue");
    // Continue asks again.
    expect(plain(pressOn(p, "go:options").view)).toContain("Do it?");
  });

  it("exactly 3 and exactly 20 characters are fine", () => {
    expect(me(submit(pressOn(nameScreen(), "options:input"), "Abe")).name).toBe("Abe");
    expect(me(submit(pressOn(nameScreen(), "options:input"), "x".repeat(20))).name).toBe(
      "x".repeat(20),
    );
  });

  it("changing only the capitals of your own name is allowed (:174-188)", () => {
    expect(me(submit(pressOn(nameScreen(), "options:input"), "skelly")).name).toBe("skelly");
  });

  it("strips the characters the original strips, and trims", () => {
    expect(me(submit(pressOn(nameScreen(), "options:input"), "  Mo:rt|Di=llon?  ")).name).toBe(
      "MortDillon",
    );
  });

  it("applies the swear filter to the new name, before the length checks (:110-111)", () => {
    expect(me(submit(pressOn(nameScreen(), "options:input"), "Dick Dastardly")).name).toBe(
      "richard Dastardly",
    );
    const long = submit(pressOn(nameScreen(), "options:input"), "bitchbitchbitchb");
    expect(plain(long.view)).toContain("Is that a name or a lecture?");
    expect(me(long).name).toBe("Skelly");
  });

  it("the swear filter can be switched off (sys.b_swear_filter)", () => {
    const p = submit(
      pressOn(nameScreen(gold(5), { swearFilter: false }), "options:input"),
      "Dick Dastardly",
    );
    expect(me(p).name).toBe("Dick Dastardly");
  });

  it("cancelling shows the first question again and charges nothing (:114-118)", () => {
    const p = submit(pressOn(nameScreen(), "options:input"), null);
    expect(plain(p.view)).toContain("Do it?");
    expect(me(p).tags[2]).toBe(5);
  });

  it("survives a save and load with the prompt open", () => {
    const open = pressOn(nameScreen(), "options:input");
    const p = submit(reload(open), "Reloaded");
    expect(me(p).name).toBe("Reloaded");
  });

  it("a picker is not accepted on the name prompt", () => {
    const open = pressOn(nameScreen(), "options:input");
    expect(
      step(open.town, 0, { type: "pickPlayer", overlayId: "options:name", playerId: 1 }, open.ctx)
        .rejected,
    ).toBeDefined();
  });
});
