import { describe, expect, it } from "vitest";
import { stealRandomCaskets } from "../src/classic/modules/visit.js";
import {
  CLASSIC_RULES,
  Custom,
  enterGame,
  originalClassicRules,
  richTextToPlain,
  setPresence,
  step,
} from "../src/index.js";
import {
  act,
  breakIn,
  edit,
  fakeTurn,
  ids,
  press,
  socialTown,
  submit,
  toRow,
  visit,
} from "./support/social.js";

const plain = richTextToPlain;

function withPadlock(strength: number, picks: number) {
  const { town, ctx } = socialTown(11, 3);
  const t = structuredClone(town);
  const victim = t.players[1];
  const me = t.players[0];
  if (!victim || !me) throw new Error("no players");
  victim.custom[Custom.Padlock] = 1;
  victim.custom[Custom.PadlockStrength] = strength;
  me.custom[Custom.Lockpick] = picks;
  return { town: t, ctx };
}

describe("the row of parlors (commands_comp.cpp)", () => {
  it("arrives with Leave, Look and Visit and two visits a day (:106-128, :170-192)", () => {
    const { town, ctx } = socialTown(1, 3);
    const row = toRow(town, 0, ctx);
    expect(ids(row.view)).toEqual(["go:map", "competitors:look", "competitors:visit"]);
    expect(plain(row.view.text)).toContain("visit 2 more parlors today");
    expect(row.view.picture?.bg).toBe("places/palors");
    expect(CLASSIC_RULES.settings.visitsPerDay).toBe(2);
  });

  it("each parlor reached at the door uses a visit; after two, Visit is refused (:110-155, :283)", () => {
    const { town, ctx } = socialTown(2, 3);
    let t = toRow(town, 0, ctx).town;
    let r = visit(t, 0, "Morticia", ctx);
    expect(plain(r.view.text)).toContain("The lights are off");
    expect(r.town.players[0]?.playerFights).toBe(1);
    t = press(r.town, 0, "go:competitors", ctx).town;
    expect(plain(t.sessions["0"]?.view?.text ?? [])).toContain("visit 1 more parlor today");
    r = visit(t, 0, "Digby", ctx);
    expect(r.town.players[0]?.playerFights).toBe(2);
    t = press(r.town, 0, "go:competitors", ctx).town;
    expect(plain(t.sessions["0"]?.view?.text ?? [])).toContain("you should really get back");
    const refused = press(t, 0, "competitors:visit", ctx);
    expect(plain(refused.view.text)).toContain("Is today look at everyone's parlor day?");
    expect(ids(refused.view)).toEqual(["competitors:menu"]);
  });

  it("Look lists every active player but the police-protected, online ones marked (rankings.cpp:117-168)", () => {
    const { town, ctx } = socialTown(3, 4, { online: [0, 2] });
    const t = edit(town, 3, { policeProtected: true, bp: 50 });
    const look = press(toRow(t, 0, ctx).town, 0, "competitors:look", ctx);
    expect(look.view.scene).toBe("rankings");
    const rows = look.view.rankings ?? [];
    expect(rows.map((r) => r.name).sort()).toEqual(["Digby", "Morticia", "Skelly"]);
    expect(rows.find((r) => r.name === "Digby")?.status).toBe("on now");
    expect(ids(look.view)).toEqual(["go:competitors"]);
  });

  it("refuses your own parlor, players online, police-protected players and taken parlors without using a visit (:211-280)", () => {
    const { town, ctx } = socialTown(4, 4, { online: [0, 2] });
    let t = edit(town, 3, { policeProtected: true });
    t = toRow(t, 0, ctx).town;
    const self = visit(t, 0, "Skelly", ctx);
    expect(plain(self.view.text)).toContain("strangely familiar");
    const online = visit(t, 0, "Digby", ctx);
    expect(plain(online.view.text)).toContain("talking earnestly to a young couple");
    const police = visit(t, 0, "Graves", ctx);
    expect(plain(police.view.text)).toContain("talking to some cops");
    expect(police.view.picture?.bg).toBe("places/funeral_enemy_police");
    for (const r of [self, online, police]) expect(r.town.players[0]?.playerFights).toBe(0);

    // Digby (online) gets to Morticia's door first: the one-intruder lock.
    let d = toRow(t, 2, ctx).town;
    d = visit(d, 2, "Morticia", ctx).town;
    const taken = visit(d, 0, "Morticia", ctx);
    expect(plain(taken.view.text)).toContain("surprised to see Digby already sitting there");
    expect(taken.town.players[0]?.playerFights).toBe(0);
  });

  it("online means logged on and not reported disconnected by the host (presence)", () => {
    const { town, ctx } = socialTown(5, 3, { online: [0, 1] });
    let t = toRow(town, 0, ctx).town;
    expect(plain(visit(t, 0, "Morticia", ctx).view.text)).toContain("talking earnestly");
    t = setPresence(t, 1, false); // the socket dropped; the session has not timed out yet
    expect(plain(visit(t, 0, "Morticia", ctx).view.text)).toContain("The lights are off");
    t = setPresence(t, 1, true);
    expect(plain(visit(t, 0, "Morticia", ctx).view.text)).toContain("talking earnestly");
    // A report of "connected" without a session does not make a player online.
    const off = setPresence(toRow(socialTown(5, 3).town, 0, ctx).town, 1, true);
    expect(plain(visit(off, 0, "Morticia", ctx).view.text)).toContain("The lights are off");
  });

  it("the name search offers each match in slot order and says when nobody (else) matches (commands_getname.cpp, misc_utils.cpp:222-259)", () => {
    const { town, ctx } = socialTown(6, 6);
    const prompt = press(toRow(town, 0, ctx).town, 0, "competitors:visit", ctx);
    expect(prompt.view.overlay?.kind).toBe("textInput");
    let r = act(prompt.town, 0, submit("competitors:getname", "s"), ctx);
    const offered: string[] = [];
    while (r.view.overlay?.kind === "confirm") {
      offered.push(plain(r.view.overlay.text));
      r = act(
        r.town,
        0,
        { type: "confirm", overlayId: "competitors:namenext", accepted: false },
        ctx,
      );
    }
    expect(offered).toEqual(["Do you mean Skelly?", "Do you mean Graves?", "Do you mean Ashley?"]);
    expect(r.view.overlay?.kind).toBe("message");
    const back = act(r.town, 0, { type: "dismiss", overlayId: "competitors:noname" }, ctx);
    expect(ids(back.view)).toEqual(["go:map", "competitors:look", "competitors:visit"]);
    const none = act(prompt.town, 0, submit("competitors:getname", "zzz"), ctx);
    expect(none.view.overlay?.kind).toBe("message");
  });

  it("inside: the snoring owner, their hit points, Attack and Steal unless there is a safe (:306-367)", () => {
    const { town, ctx } = socialTown(7, 3);
    const inside = breakIn(town, 0, "Morticia", ctx);
    expect(plain(inside.view.text)).toContain("softly snoring");
    expect(plain(inside.view.text)).toContain("Morticia has 10 hitpoints");
    expect(ids(inside.view)).toEqual(["competitors:attack", "competitors:steal"]);
    const safe = structuredClone(town);
    (safe.players[1]?.custom as number[])[Custom.Safe] = 1;
    const withSafe = breakIn(safe, 0, "Morticia", ctx);
    expect(plain(withSafe.view.text)).toContain("combination Safe");
    expect(ids(withSafe.view)).toEqual(["competitors:attack"]);
    expect(
      step(withSafe.town, 0, { type: "press", buttonId: "competitors:steal" }, ctx).rejected,
    ).toBeDefined();
  });
});

describe("padlocks and lockpicks (commands_comp.cpp:384-480)", () => {
  it("a padlock stops you at the door; without a pick the finger does nothing (:384-440)", () => {
    const { town, ctx } = withPadlock(100, 0);
    const front = visit(toRow(town, 0, ctx).town, 0, "Morticia", ctx);
    const door = press(front.town, 0, "competitors:trydoor", ctx);
    expect(plain(door.view.text)).toContain("heavy padlock on the door at 100 percent strength");
    expect(ids(door.view)).toEqual(["go:competitors", "competitors:picklock"]);
    const finger = press(door.town, 0, "competitors:picklock", ctx);
    expect(plain(finger.view.text)).toContain("with your finger");
  });

  it("each lockpick does random_range(5, 10) damage, breaks, tells the owner and lets you in (:444-480)", () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 60; seed++) {
      const { town, ctx } = withPadlock(100, 2);
      const t = structuredClone(town);
      t.seed = seed;
      const front = visit(toRow(t, 0, ctx).town, 0, "Morticia", ctx);
      const door = press(front.town, 0, "competitors:trydoor", ctx);
      expect(plain(door.view.text)).toContain("You are holding 2 lockpick(s)");
      const picked = press(door.town, 0, "competitors:picklock", ctx);
      const strength = picked.town.players[1]?.custom[Custom.PadlockStrength] ?? 0;
      const damage = 100 - strength;
      expect(damage).toBeGreaterThanOrEqual(5);
      expect(damage).toBeLessThanOrEqual(10);
      seen.add(damage);
      expect(plain(picked.view.text)).toContain(`causes the padlock ${damage} points of damage`);
      expect(picked.town.players[0]?.custom[Custom.Lockpick]).toBe(1);
      const mail = picked.town.players[1]?.mail.at(-1);
      expect(mail?.type === "text" && mail.text).toContain(`weakened by \`4${damage}`);
      const inside = press(picked.town, 0, "competitors:inside", ctx);
      expect(plain(inside.view.text)).toContain("softly snoring");
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([5, 6, 7, 8, 9, 10]);
  });

  it("a padlock below 1 falls off and the owner hears of it (:447-457)", () => {
    const { town, ctx } = withPadlock(5, 1);
    const front = visit(toRow(town, 0, ctx).town, 0, "Morticia", ctx);
    const picked = press(
      press(front.town, 0, "competitors:trydoor", ctx).town,
      0,
      "competitors:picklock",
      ctx,
    );
    expect(plain(picked.view.text)).toContain("breaks and falls off");
    expect(picked.town.players[1]?.custom[Custom.Padlock]).toBe(0);
    expect(picked.town.players[1]?.custom[Custom.PadlockStrength]).toBe(0);
    const mail = picked.town.players[1]?.mail.at(-1);
    expect(mail?.type === "text" && mail.text).toContain("damaged beyond repair");
  });
});

describe("Steal (commands_comp.cpp:521-613, 642-681)", () => {
  it("steal_random_caskets: random(3) picks the type, then random_range(0, 3) capped at what they hold; -1 with none", () => {
    const counts = new Set<number>();
    for (let seed = 1; seed <= 400; seed++) {
      const turn = fakeTurn(seed);
      const me = { tags: [0, 0, 0] } as never as Parameters<typeof stealRandomCaskets>[2];
      const him = { tags: [5, 5, 5] } as never as Parameters<typeof stealRandomCaskets>[3];
      const check = fakeTurn(seed);
      const tier = check.rng.random(3);
      const amount = check.rng.randomRange(0, 3);
      const r = stealRandomCaskets(turn, CLASSIC_RULES.pvp.stealMax, me, him);
      expect(r).toEqual({ stolen: amount, tier });
      expect(him.tags[tier]).toBe(5 - amount);
      expect(me.tags[tier]).toBe(amount);
      counts.add(r.stolen);
    }
    expect([...counts].sort()).toEqual([0, 1, 2, 3]);
    const poor = { tags: [0, 0, 0] } as never as Parameters<typeof stealRandomCaskets>[3];
    const one = { tags: [1, 1, 1] } as never as Parameters<typeof stealRandomCaskets>[3];
    const me = { tags: [0, 0, 0] } as never as Parameters<typeof stealRandomCaskets>[2];
    expect(stealRandomCaskets(fakeTurn(1), 3, me, poor).stolen).toBe(-1);
    for (let seed = 1; seed < 50; seed++) {
      expect(
        stealRandomCaskets(fakeTurn(seed), 3, me, structuredClone(one)).stolen,
      ).toBeLessThanOrEqual(1);
    }
  });

  it("the thief runs off and the victim is always told, with the prowler picture and Continue (:574-604)", () => {
    const { town, ctx } = socialTown(9, 3);
    const t = edit(town, 1, { tags: [4, 4, 4] });
    const inside = breakIn(t, 0, "Morticia", ctx);
    const r = press(inside.town, 0, "competitors:steal", ctx);
    expect(plain(r.view.text)).toContain("It's Morticia in her lingerie!");
    expect(ids(r.view)).toEqual(["go:competitors"]);
    const mail = r.town.players[1]?.mail.slice(-3) ?? [];
    expect(mail.map((m) => m.type)).toEqual(["text", "picture", "buttons"]);
    expect(mail[0]?.type === "text" && mail[0].text).toContain("You caught Skelly sneaking around");
    expect(mail[1]?.type === "picture" && mail[1].picture).toBe("people/man_prowl");
    const before = (t.players[1]?.tags ?? []).reduce((a, b) => a + b, 0);
    const after = (r.town.players[1]?.tags ?? []).reduce((a, b) => a + b, 0);
    const mine = (r.town.players[0]?.tags ?? []).reduce((a, b) => a + b, 0);
    expect(before - after).toBe(mine);
    expect(mine).toBeLessThanOrEqual(3);
  });

  it("a rival who logs on mid-visit cannot be robbed (fixes.visitTargetRecheck); the original allowed it", () => {
    for (const [rules, refused] of [
      [CLASSIC_RULES, true],
      [originalClassicRules(), false],
    ] as const) {
      const { town, ctx } = socialTown(10, 3, { rules });
      const inside = breakIn(edit(town, 1, { tags: [3, 3, 3] }), 0, "Morticia", ctx);
      const woke = enterGame(inside.town, 1, ctx).town;
      const r = press(woke, 0, "competitors:steal", ctx);
      expect(plain(r.view.text).includes("talking earnestly")).toBe(refused);
      if (refused) expect(r.town.players[1]?.tags).toEqual([3, 3, 3]);
      else expect(plain(r.view.text)).toContain("You are startled by a noise");
    }
  });
});
