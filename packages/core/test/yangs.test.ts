import { describe, expect, it } from "vitest";
import {
  CLASSIC_RULES,
  computeEvent,
  enterGame,
  openStream,
  originalClassicRules,
  richTextToPlain,
  step,
  type TownState,
} from "../src/index.js";
import { act, press } from "./support/harness.js";
import { legacyContent } from "./support/legacyContent.js";
import {
  atPlace,
  buttonIds,
  me,
  type Placed,
  pick,
  plain,
  pressOn,
  reload,
  submit,
} from "./support/places.js";

type Setup = (t: TownState) => void;
const player = (t: TownState, id = 0) => t.players[id] as TownState["players"][number];
const rich =
  (bpToday: number, extra: Partial<TownState["players"][number]> = {}): Setup =>
  (t) => {
    Object.assign(player(t), { bpToday, bp: bpToday + 100 }, extra);
  };

function prompt(p: Placed, dish: "tiger" | "sparrow", target: number): Placed {
  return pick(pressOn(p, `yangs:${dish}`), target);
}

describe("Yang's front (commands_yangs.cpp:209-220, :290-340)", () => {
  it("shows the menu with the three dishes", () => {
    const { view, town } = atPlace("yangs");
    expect(plain(view)).toBe(
      [
        "The Menu",
        "",
        "#1 - Lucky Dragon (adds 10 luck, for here only) Cost: 5 Bury Points",
        "#2 - Lucky Sparrow (adds 5 luck, for delivery only) Cost: 20 Bury Points",
        "#3 - Cursed Tiger (removes 10 luck, for delivery only) Cost: 20 Bury Points",
        "",
      ].join("\n"),
    );
    expect(view.buttons.map((b) => b.label)).toEqual(["Order #1", "Order #2", "Order #3", "Leave"]);
    expect(buttonIds(view)).toEqual(["yangs:dragon", "yangs:sparrow", "yangs:tiger", "go:map"]);
    expect(view.picture).toEqual({ bg: "places/yangs" });
    expect(richTextToPlain(view.status ?? [])).toBe("June waits for you to order.");
    expect(town.sessions["0"]?.location).toBe("Yang's");
  });
});

describe("Order #1, the Lucky Dragon (:342-372)", () => {
  it("below 40 luck and with 5 Bury Points today: -5 BP, +10 luck", () => {
    const p = pressOn(atPlace("yangs", { setup: rich(5, { luck: 39 }) }), "yangs:dragon");
    expect(plain(p.view)).toBe(
      "You relish every bite of your General Tso's Chicken.\n\nYou gain 10 luck.",
    );
    expect(me(p).luck).toBe(49);
    expect(me(p).bpToday).toBe(0);
    expect(me(p).bp).toBe(100);
    expect(me(p).yangsSent).toBe(0);
    expect(p.view.hud).toMatchObject({ luck: 49, bpToday: 0, bpTotal: 100 });
    expect(buttonIds(p.view)).toEqual(["yangs:menu"]);
  });
  it("at 40 luck or more it is refused: you would waste your money", () => {
    for (const luck of [40, 41, 100]) {
      const p = pressOn(atPlace("yangs", { setup: rich(50, { luck }) }), "yangs:dragon");
      expect(plain(p.view)).toBe(
        "Maybe later.  You especially like to eat Yang's when you're feeling down on your luck. (like less than 40 percent for instance)",
      );
      expect(me(p).luck).toBe(luck);
      expect(me(p).bpToday).toBe(50);
    }
  });
  it("the price is checked against today's Bury Points, not the total", () => {
    const p = pressOn(atPlace("yangs", { setup: rich(4, { luck: 10, bp: 900 }) }), "yangs:dragon");
    expect(plain(p.view)).toBe("You check your wallet.. shoot, not enough Bury Points!");
    expect(me(p).luck).toBe(10);
    expect(me(p).bp).toBe(900);
  });
  it("Continue returns to the menu", () => {
    const p = pressOn(
      pressOn(atPlace("yangs", { setup: rich(5, { luck: 1 }) }), "yangs:dragon"),
      "yangs:menu",
    );
    expect(plain(p.view)).toMatch(/^The Menu/);
    expect(buttonIds(p.view)).toContain("yangs:tiger");
  });
});

describe("Order #3, the Cursed Tiger (:79-108, :374-500)", () => {
  const start = (setup: Setup = rich(50), settings = {}) => atPlace("yangs", { setup, settings });

  it("asks who, then for a fortune, then delivers: -20 BP, one delivery used", () => {
    let p = pressOn(start(), "yangs:tiger");
    expect(p.view.overlay).toMatchObject({ kind: "playerPicker", id: "yangs:tiger-target" });
    expect(p.view.buttons).toEqual([]);
    expect((p.view.overlay as { prompt: string }).prompt).toContain(
      "someone you are not too fond of",
    );
    // Everybody can be named, including yourself (the original's picker listed all players).
    expect((p.view.overlay as { players: unknown[] }).players).toHaveLength(3);
    p = pick(p, 2);
    expect(p.view.overlay).toMatchObject({ kind: "textInput", id: "yangs:tiger-fortune" });
    expect((p.view.overlay as { prompt: string }).prompt).toBe(
      'June: "If you would like to write a custom fortune, enter it now."',
    );
    p = submit(p, "Beware of falling pianos.");
    expect(plain(p.view)).toBe("Mr. Yang leaves to deliver the food.");
    expect(buttonIds(p.view)).toEqual(["yangs:menu"]);
    expect(me(p).yangsSent).toBe(1);
    expect(me(p).bpToday).toBe(30);
    expect(me(p).bp).toBe(130);
    expect(p.view.hud).toMatchObject({ bpToday: 30 });
  });

  it("queues the victim's letter, -10 luck, the takeout picture and Continue, in that order (:480-488)", () => {
    const p = submit(prompt(start(), "tiger", 2), "Beware of falling pianos.");
    const mail = player(p.town, 2).mail;
    expect(mail.map((m) => m.type)).toEqual(["text", "varMod", "picture", "buttons"]);
    expect(mail[0]).toMatchObject({
      type: "text",
      importance: "high",
      text: '\n`$Some delicious smelling chinese food has been left on your doorstep.\nYour fortune cookie reads:\n`w"Beware of falling pianos."\n`$You lose `w10`$ luck!\n',
    });
    expect(mail[1]).toMatchObject({ type: "varMod", stat: "luck", amount: -10 });
    expect(mail[2]).toMatchObject({ type: "picture", layer: "fg", picture: "chinese_takeout" });
    expect(player(p.town, 2).luck).toBe(50); // applies when read
  });

  it("puts a commercial on the cafe TV with the victim's parlor and logs the cookie", () => {
    const p = submit(prompt(start(), "tiger", 2), "Boo.");
    const tv = p.effects.find((e) => e.kind === "tv");
    expect(tv?.kind === "tv" && richTextToPlain(tv.text)).toBe(
      "The TV: A Yang's commercial comes on. It looks like Digby Rest in the background.",
    );
    expect(p.effects).toContainEqual({
      kind: "log",
      text: "Skelly sent Yang's to Digby, cookie: Boo.",
    });
  });

  it("without a custom fortune it uses one from yangs.txt, picked by the victim's total BP", () => {
    const messages = new Set(
      legacyContent().fortunes.ranges.flatMap((r) => r.entries.map((e) => e.message ?? "")),
    );
    const p = submit(prompt(start(), "tiger", 2), "   ");
    const text = (player(p.town, 2).mail[0] as { text: string }).text;
    const cookie = /reads:\n`w"(.*)"\n/.exec(text)?.[1] ?? "";
    expect(messages.has(cookie)).toBe(true);
  });

  it("makes its draws in the original order: fortune pick, then random(4), then random(4) (:407-452)", () => {
    let news = 0;
    const total = 80;
    for (let seed = 1; seed <= total; seed++) {
      const sameSeed = atPlace("yangs", { seed, setup: rich(50) });
      const rng = openStream(sameSeed.town.seed, 0, sameSeed.town.day, sameSeed.town.streams["0"]);
      const event = computeEvent(rng, legacyContent().fortunes, player(sameSeed.town, 2).bp, {
        message: "No message.",
        picture: "blank",
      });
      const sighted = rng.random(4) === 1;
      const choice = sighted ? rng.random(4) : -1;
      const p = submit(prompt(sameSeed, "tiger", 2), "");
      expect((player(p.town, 2).mail[0] as { text: string }).text).toContain(`"${event.message}"`);
      const paper = p.town.news[String(p.town.day)]?.front ?? "";
      const lines = [
        "SPOTLIGHT ON OUR TOWN",
        "YANG'S NOW DELIVERS",
        "YANG'S DOING WELL",
        "YANG'S MAKES A GREAT GIFT",
      ];
      if (sighted) {
        news++;
        expect(paper).toContain(lines[choice] as string);
        expect(lines.filter((l) => paper.includes(l))).toHaveLength(1);
      } else {
        expect(lines.some((l) => paper.includes(l))).toBe(false);
      }
      expect(p.town.streams["0"]?.mt).toBe(
        (sameSeed.town.streams["0"]?.mt ?? 0) + (sighted ? 3 : 2),
      );
    }
    expect(news / total).toBeGreaterThan(0.12);
    expect(news / total).toBeLessThan(0.4);
  });

  it("the news items name the buyer, and the second also the victim's parlor", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const p = submit(prompt(atPlace("yangs", { seed, setup: rich(50) }), "tiger", 2), "");
      const paper = p.town.news[String(p.town.day)]?.front ?? "";
      if (paper.includes("YANG'S NOW DELIVERS")) {
        expect(paper).toContain("this package from Skelly?");
        expect(paper).toContain("all the way to Digby Rest, no extra charge");
        return;
      }
    }
    throw new Error("no seed produced the delivery item");
  });

  it("the second delivery of the day is turned down, with a way to get thrown out (:79-108)", () => {
    const first = submit(prompt(start(), "tiger", 2), "x");
    const again = pressOn(pressOn(first, "yangs:menu"), "yangs:tiger");
    expect(plain(again.view)).toBe(
      'Skelly: "I would like a cursed tiger delivered, please."\n\nJune: "I\'m sorry, my dad is out delivering food right now.  How about something for here?"',
    );
    expect(again.view.buttons.map((b) => b.label)).toEqual(["Get Bitchy", "Continue"]);
    expect(buttonIds(again.view)).toEqual(["yangs:bitchy", "yangs:menu"]);
    expect(again.view.overlay).toBeUndefined();
  });

  it("the sparrow shares the same daily allowance and speaks as You", () => {
    const first = submit(prompt(start(), "tiger", 2), "x");
    const again = pressOn(pressOn(first, "yangs:menu"), "yangs:sparrow");
    expect(plain(again.view)).toMatch(/^You: "I would like a lucky sparrow delivered, please\."/);
  });

  it("Get Bitchy gets you thrown out until tomorrow (:36-57, :290-340)", () => {
    const first = submit(prompt(start(), "tiger", 2), "x");
    const rude = pressOn(pressOn(pressOn(first, "yangs:menu"), "yangs:tiger"), "yangs:bitchy");
    expect(plain(rude.view)).toBe(
      'Skelly: "That\'s very interesting.  Now get the god damn teriyaki, put it in a box, and deliver it."\n\nJune: "Please leave now."',
    );
    expect(buttonIds(rude.view)).toEqual(["go:map"]);
    expect(me(rude).kickedOutOfYangs).toBe(true);
    const map = pressOn(rude, "go:map");
    const again = step(map.town, 0, { type: "visit", placeId: "yangs" }, map.ctx);
    expect(again.rejected).toBeUndefined();
    expect(richTextToPlain(again.view.text)).toBe(
      'Skelly: "Hello? I\'d like some service here!"\n\nJune: "Just leave, asshole."',
    );
    expect(buttonIds(again.view)).toEqual(["go:map"]);
    expect(richTextToPlain(again.view.status ?? [])).toBe("June glances at you nervously.");
  });

  it("a bigger daily allowance (Game Settings) lets a second delivery through", () => {
    const first = submit(prompt(start(rich(100), { yangsPerDay: 2 }), "tiger", 2), "x");
    const second = pressOn(first, "yangs:menu");
    expect(pressOn(second, "yangs:tiger").view.overlay?.kind).toBe("playerPicker");
  });

  it("with fewer than 20 Bury Points today you look stupid, and nothing is spent", () => {
    const p = submit(prompt(start(rich(19)), "tiger", 2), "x");
    expect(plain(p.view)).toBe(
      "You don't have enough Bury Points.  You realize you would just look stupid trying to order now...",
    );
    expect(me(p).yangsSent).toBe(0);
    expect(me(p).bpToday).toBe(19);
    expect(player(p.town, 2).mail).toHaveLength(0);
  });

  it("exactly 20 is enough", () => {
    const p = submit(prompt(start(rich(20)), "tiger", 2), "x");
    expect(me(p).bpToday).toBe(0);
    expect(me(p).yangsSent).toBe(1);
  });

  it("sending to yourself is refused for free (:59-77)", () => {
    const p = submit(prompt(start(), "tiger", 0), "x");
    expect(plain(p.view)).toBe(
      'Skelly: "If you could just deliver that to my parlor, that would be great, m\'kay?"\n\nJune: "Why don\'t you just get food for here?"\n\nSkelly: "Ok, fine."\n\n',
    );
    expect(me(p).yangsSent).toBe(0);
    expect(me(p).bpToday).toBe(50);
    expect(buttonIds(p.view)).toEqual(["yangs:menu"]);
  });

  it("a victim who was deleted meanwhile was not home", () => {
    const asked = pick(pressOn(start(), "yangs:tiger"), 2);
    const gone = reload(asked);
    gone.town.players[2] = { ...player(gone.town, 2), active: false };
    const p = submit(gone, "x");
    expect(plain(p.view)).toBe("Error delivering food, he wasn't home.");
    expect(me(p).yangsSent).toBe(0);
  });

  it("the limit message appears if the allowance was used while the prompt was open (:393-399)", () => {
    const asked = pick(pressOn(start(), "yangs:tiger"), 2);
    const used = reload(asked);
    player(used.town).yangsSent = 1;
    const p = submit(used, "x");
    expect(plain(p.view)).toBe(
      '"We only allow 1 delivery per day," Mr Yang tells you apologetically. ',
    );
    expect(me(p).bpToday).toBe(50);
  });

  it("cancelling the name or the fortune goes back to the menu (:225-229, :378-384)", () => {
    const noName = pick(pressOn(start(), "yangs:tiger"), null);
    expect(plain(noName.view)).toMatch(/^The Menu/);
    const noFortune = submit(prompt(start(), "tiger", 2), null);
    expect(plain(noFortune.view)).toMatch(/^The Menu/);
    expect(me(noFortune).bpToday).toBe(50);
    expect(me(noFortune).yangsSent).toBe(0);
  });

  it("survives a save and load at the picker and at the fortune prompt", () => {
    let p = pressOn(start(), "yangs:tiger");
    p = pick(reload(p), 2);
    p = submit(reload(p), "saved");
    expect((player(p.town, 2).mail[0] as { text: string }).text).toContain('"saved"');
  });
});

describe("Order #2, the Lucky Sparrow (:110-140, :502-end)", () => {
  const start = (setup: Setup = rich(50)) => atPlace("yangs", { setup });

  it("sends +5 luck for 20 Bury Points and never makes the news", () => {
    let seenNews = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const asked = pressOn(atPlace("yangs", { seed, setup: rich(50) }), "yangs:sparrow");
      expect((asked.view.overlay as { prompt: string }).prompt).toBe(
        "June: \"That's very nice of you.  Who's the lucky person?\"",
      );
      const p = submit(pick(asked, 2), "Good things come.");
      expect(me(p).bpToday).toBe(30);
      expect(me(p).yangsSent).toBe(1);
      // Only the fortune pick is drawn: no random(4) for the news (commented out at :562-596).
      expect(p.town.streams["0"]?.mt).toBe((asked.town.streams["0"]?.mt ?? 0) + 1);
      const paper = p.town.news[String(p.town.day)]?.front ?? "";
      if (paper.includes("YANG'S")) seenNews++;
    }
    expect(seenNews).toBe(0);
  });

  it("mails the victim the nice fortune, +5 luck and the takeout picture", () => {
    const p = submit(pick(pressOn(start(), "yangs:sparrow"), 2), "Good things come.");
    const mail = player(p.town, 2).mail;
    expect(mail.map((m) => m.type)).toEqual(["text", "varMod", "picture", "buttons"]);
    expect(mail[0]).toMatchObject({
      text: '\n`$Skelly has sent you some chinese food.\nYour fortune cookie reads:\n`w"Good things come."\n`$You gain `w5`$ luck!\n',
    });
    expect(mail[1]).toMatchObject({ stat: "luck", amount: 5 });
    expect(p.effects).toContainEqual({
      kind: "log",
      text: "Skelly sent nice Yang's to Digby, cookie: Good things come.",
    });
  });

  it("uses yangs_nice.txt for the default fortune", () => {
    const nice = new Set(
      legacyContent().niceFortunes.ranges.flatMap((r) => r.entries.map((e) => e.message ?? "")),
    );
    const p = submit(pick(pressOn(start(), "yangs:sparrow"), 2), "");
    const cookie =
      /reads:\n`w"(.*)"\n/.exec((player(p.town, 2).mail[0] as { text: string }).text)?.[1] ?? "";
    expect(nice.has(cookie)).toBe(true);
  });

  it("is refused with under 20 Bury Points, to yourself, and after the day's delivery", () => {
    expect(plain(submit(pick(pressOn(start(rich(19)), "yangs:sparrow"), 2), "").view)).toMatch(
      /^You don't have enough Bury Points/,
    );
    expect(plain(submit(pick(pressOn(start(), "yangs:sparrow"), 0), "").view)).toMatch(
      /^Skelly: "If you could just deliver/,
    );
    const first = submit(pick(pressOn(start(), "yangs:sparrow"), 2), "");
    const again = pressOn(pressOn(first, "yangs:menu"), "yangs:sparrow");
    expect(buttonIds(again.view)).toEqual(["yangs:bitchy", "yangs:menu"]);
  });
});

describe("the Yang's cost array bug (:13-33)", () => {
  it("reproduces the intended costs, not the out-of-bounds ones", () => {
    // The constructor wrote i_cost[3] = 10 for the dragon, past the end of a 3-element array;
    // nothing reads it. The handler charges 5 (the same as the menu).
    const p = pressOn(atPlace("yangs", { setup: rich(5, { luck: 1 }) }), "yangs:dragon");
    expect(me(p).bpToday).toBe(0);
  });
});

describe("custom fortunes (userText.ts)", () => {
  const fortuneOf = (p: Placed): string =>
    /reads:\n`w"(.*)"\n/.exec((player(p.town, 2).mail[0] as { text: string }).text)?.[1] ?? "";
  const filtering = { ...CLASSIC_RULES, filterUserText: true };

  it("are left as typed in Classic: the original never filtered them", () => {
    const tiger = submit(prompt(atPlace("yangs", { setup: rich(50) }), "tiger", 2), "you shit");
    expect(fortuneOf(tiger)).toBe("you shit");
    expect(tiger.effects).toContainEqual({
      kind: "log",
      text: "Skelly sent Yang's to Digby, cookie: you shit",
    });
    const sparrow = submit(
      pick(pressOn(atPlace("yangs", { setup: rich(50) }), "yangs:sparrow"), 2),
      "you shit",
    );
    expect(fortuneOf(sparrow)).toBe("you shit");
  });

  it("are filtered, for the tiger and the sparrow, when the host turns filterUserText on (Expanded does)", () => {
    const tiger = submit(
      prompt(atPlace("yangs", { setup: rich(50), rules: filtering }), "tiger", 2),
      "you shit",
    );
    expect(fortuneOf(tiger)).toBe("you shoot");
    expect(tiger.effects).toContainEqual({
      kind: "log",
      text: "Skelly sent Yang's to Digby, cookie: you shoot",
    });
    const sparrow = submit(
      pick(pressOn(atPlace("yangs", { setup: rich(50), rules: filtering }), "yangs:sparrow"), 2),
      "you shit",
    );
    expect(fortuneOf(sparrow)).toBe("you shoot");
  });

  it("stay as typed under the original rules too", () => {
    const p = submit(
      prompt(atPlace("yangs", { setup: rich(50), rules: originalClassicRules() }), "tiger", 2),
      "you shit",
    );
    expect(fortuneOf(p)).toBe("you shit");
  });

  it("the sysop's swear filter setting switches the host option off", () => {
    const p = submit(
      prompt(
        atPlace("yangs", { setup: rich(50), settings: { swearFilter: false }, rules: filtering }),
        "tiger",
        2,
      ),
      "you shit",
    );
    expect(fortuneOf(p)).toBe("you shit");
  });
});

describe("the victim reads the Yang's letter at the desk (mailbox overlays)", () => {
  /** The victim logs on, walks to the desk and dismisses every letter overlay. */
  function readAll(p: Placed, victim: number): { town: TownState; texts: string[] } {
    const on = enterGame(p.town, victim, p.ctx);
    let r = press(press(on.town, victim, "go:desk", p.ctx).town, victim, "go:desk", p.ctx);
    const texts: string[] = [];
    for (let i = 0; i < 10 && r.view.overlay; i++) {
      const o = r.view.overlay;
      expect(o.kind).toBe("message");
      if (o.kind === "message") {
        texts.push(richTextToPlain(o.text));
        r = act(r.town, victim, { type: "dismiss", overlayId: o.id }, p.ctx);
      }
    }
    expect(r.view.overlay).toBeUndefined();
    return { town: r.town, texts };
  }

  it("a Cursed Tiger takes 10 luck when the mail is read, not before", () => {
    const sent = submit(prompt(atPlace("yangs", { setup: rich(50) }), "tiger", 2), "Boo.");
    expect(player(sent.town, 2).luck).toBe(50);
    const { town, texts } = readAll(sent, 2);
    expect(texts.join("")).toContain("You lose 10 luck!");
    expect(player(town, 2).luck).toBe(40);
    expect(player(town, 2).mail).toEqual([]);
  });

  it("a Lucky Sparrow gives 5 luck when the mail is read, not before", () => {
    const sent = submit(
      pick(pressOn(atPlace("yangs", { setup: rich(50) }), "yangs:sparrow"), 2),
      "",
    );
    expect(player(sent.town, 2).luck).toBe(50);
    const { town, texts } = readAll(sent, 2);
    expect(texts.join("")).toContain("You gain 5 luck!");
    expect(player(town, 2).luck).toBe(55);
    expect(player(town, 2).mail).toEqual([]);
  });
});
