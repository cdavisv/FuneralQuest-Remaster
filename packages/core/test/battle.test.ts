import { describe, expect, it } from "vitest";
import { battleBp, blowDamage } from "../src/classic/modules/battle.js";
import { stealRandomCaskets } from "../src/classic/modules/visit.js";
import {
  CLASSIC_RULES,
  type EngineContext,
  leaveGame,
  originalClassicRules,
  type PlayerState,
  richTextToPlain,
  step,
  type TownState,
} from "../src/index.js";
import { act, breakIn, edit, fakeTurn, ids, press, socialTown, submit } from "./support/social.js";

const plain = richTextToPlain;
const f32 = Math.fround;

function player(bp: number): PlayerState {
  return { bp, bpToday: 0 } as PlayerState;
}

/** Skelly (0) inside Morticia's (1) parlor with the given changes, pressing Attack. */
function fight(
  seed: number,
  me: Partial<PlayerState>,
  him: Partial<PlayerState>,
  rules = CLASSIC_RULES,
): { town: TownState; ctx: EngineContext; text: string } {
  const { town, ctx } = socialTown(seed, 3, { rules });
  const t = edit(edit(town, 0, me), 1, him);
  const inside = breakIn(t, 0, "Morticia", ctx);
  const r = press(inside.town, 0, "competitors:attack", ctx);
  return { town: r.town, ctx, text: plain(r.view.text) };
}

/** A fight Skelly wins with his first swing (more plots, huge strength, a 1 HP victim). */
function won(seed: number, him: Partial<PlayerState>, rules = CLASSIC_RULES) {
  const r = fight(seed, { plots: 9, strength: 40 }, { hp: 1, hpMax: 1, ...him }, rules);
  const hit = press(r.town, 0, "battle:attack", r.ctx);
  return { town: hit.town, ctx: r.ctx, text: plain(hit.view.text) };
}

/** Presses Attack until the battle ends; returns the final step. */
function fightToEnd(town: TownState, ctx: EngineContext) {
  let t = town;
  for (let i = 0; i < 200; i++) {
    const view = t.sessions["0"]?.view;
    if (!view?.buttons.some((b) => b.id === "battle:attack")) break;
    t = press(t, 0, "battle:attack", ctx).town;
  }
  return t;
}

describe("blows (commands_battle.cpp:292-366)", () => {
  it("damage is int(frandom((str+1)/2) + (str+1)/2) in 32-bit floats: (str+1)/2 up to str+1 (:297, :340)", () => {
    for (let strength = 0; strength <= 30; strength++) {
      let min = Infinity;
      let max = -Infinity;
      for (let seed = 1; seed <= 300; seed++) {
        const turn = fakeTurn(seed);
        const check = fakeTurn(seed);
        const half = f32(f32(strength + 1) / 2);
        const expected = Math.trunc(f32(check.rng.frandom(half) + half));
        const d = blowDamage(turn, strength);
        expect(d).toBe(expected);
        min = Math.min(min, d);
        max = Math.max(max, d);
      }
      expect(min).toBeGreaterThanOrEqual(Math.floor((strength + 1) / 2));
      expect(max).toBeLessThanOrEqual(strength + 1);
    }
  });

  it("the defender misses 1 in 20 and the attacker soul-smashes 1 in 10 (:300, :349)", () => {
    expect(CLASSIC_RULES.pvp.defenderMissOneIn).toBe(20);
    expect(CLASSIC_RULES.pvp.doubleDamageOneIn).toBe(10);
    let theirSwings = 0;
    let sidesteps = 0;
    let mySwings = 0;
    let smashes = 0;
    for (let seed = 1; seed <= 150; seed++) {
      const big = { hp: 400, hpMax: 400, strength: 1 };
      const r = fight(seed, big, big);
      let t = r.town;
      let text = r.text;
      for (let i = 0; i < 12; i++) {
        theirSwings += (text.match(/ you for /g) ?? []).length;
        sidesteps += (text.match(/sidestep the blow/g) ?? []).length;
        theirSwings += (text.match(/sidestep the blow/g) ?? []).length;
        mySwings += (text.match(/You (slap|sock|punch|kick|soul smash)/g) ?? []).length;
        smashes += (text.match(/soul smash/g) ?? []).length;
        const next = press(t, 0, "battle:attack", r.ctx);
        t = next.town;
        text = plain(next.view.text);
      }
    }
    expect(sidesteps / theirSwings).toBeGreaterThan(0.03);
    expect(sidesteps / theirSwings).toBeLessThan(0.075);
    expect(smashes / mySwings).toBeGreaterThan(0.07);
    expect(smashes / mySwings).toBeLessThan(0.13);
  });

  it("whoever has more plots swings first; otherwise the rival strikes before you act (:262-280)", () => {
    const first = fight(1, { plots: 5 }, { plots: 4 });
    expect(first.text).toContain("you get first swing");
    expect(first.text).not.toMatch(/ you for |sidestep/);
    const second = fight(1, { plots: 4 }, { plots: 4 });
    expect(second.text).toContain("eyes flick open");
    expect(second.text).toMatch(/ you for |sidestep/);
    expect(first.town.players[0]?.hp).toBe(10);
    expect(ids(first.town.sessions["0"]?.view ?? ({ buttons: [] } as never))).toEqual([
      "battle:run",
      "battle:attack",
    ]);
  });
});

describe("BP and tags (commands_battle.cpp:384-543)", () => {
  it("attacker wins: +2% of the loser's BP, loser -1%; defender wins: +1%, attacker -0.5% (:522-543)", () => {
    const w = player(0);
    const l = player(1999);
    expect(battleBp(fakeTurn(1), w, l, false)).toEqual({ won: 39, lost: 19 });
    expect(w.bp).toBe(39);
    expect(l.bp).toBe(1980);
    const w2 = player(10);
    const l2 = player(1999);
    expect(battleBp(fakeTurn(1), w2, l2, true)).toEqual({ won: 19, lost: 9 });
    expect(l2.bp).toBe(1990);
    // exp_mod_force_total: a loss may cut into the total, never below 0.
    const tiny = player(1);
    battleBp(fakeTurn(1), player(0), tiny, false);
    expect(tiny.bp).toBe(1);
  });

  it("a won battle takes 0 to 4 tags of one random type (:409)", () => {
    expect(CLASSIC_RULES.pvp.battleStealMax).toBe(4);
    const seen = new Set<number>();
    for (let seed = 1; seed <= 300; seed++) {
      const me = { tags: [0, 0, 0] } as never as PlayerState;
      const him = { tags: [9, 9, 9] } as never as PlayerState;
      seen.add(stealRandomCaskets(fakeTurn(seed), 4, me, him).stolen);
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it("the winner robs the victim, who gets police protection, the TV and a letter; the quote goes to the Crime section (:396-451, 562-602)", () => {
    const r = won(2, { bp: 1000, tags: [5, 5, 5] });
    expect(r.text).toContain("Morticia crumples to the floor. You have won the battle!");
    expect(r.text).toContain("You earn 20 Bury Points.");
    const t = r.town;
    expect(t.players[1]?.policeProtected).toBe(true);
    expect(t.players[1]?.hp).toBe(0);
    expect(t.players[1]?.bp).toBe(990);
    expect(t.players[0]?.bp).toBe(20);
    const stolen = (t.players[0]?.tags ?? []).reduce((a, b) => a + b, 0);
    expect(15 - (t.players[1]?.tags ?? []).reduce((a, b) => a + b, 0)).toBe(stolen);
    const view = t.sessions["0"]?.view;
    expect(view?.battle?.them.hp).toBe(0);
    expect(view?.picture?.fg).toBe("stuff/money_bag_2");
    const letter = t.players[1]?.mail.slice(-3) ?? [];
    expect(letter[0]?.type === "text" && letter[0].text).toContain(
      "You were attacked in your sleep by Skelly",
    );
    expect(letter[0]?.type === "text" && letter[0].text).toContain("You lose `w10 `$Bury Points.");
    const prompt = press(t, 0, "battle:yellwin", r.ctx);
    expect(prompt.view.overlay?.kind).toBe("textInput");
    const quoted = act(prompt.town, 0, submit("battle:quote", "Who's the amateur now?"), r.ctx);
    expect(quoted.view.title).toBe("Parlors");
    expect(quoted.town.news[String(t.day)]?.crime).toContain(
      'Skelly brutally assaulted Morticia!`6\r\n"Who\'s the amateur now?" `8justified Skelly.',
    );
    const quoteMail = quoted.town.players[1]?.mail.slice(-3) ?? [];
    expect(quoteMail[1]?.type === "picture" && quoteMail[1].picture).toBe("places/hospital_room");
    // Under two characters, or cancelled, is no quote and no letter (:576).
    const quiet = act(prompt.town, 0, submit("battle:quote", "x"), r.ctx);
    expect(quiet.town.news[String(t.day)]?.crime).toBe(
      "`8Skelly brutally assaulted Morticia!\r\n\r\n",
    );
    expect(quiet.town.players[1]?.mail.length).toBe(t.players[1]?.mail.length);
    const cancelled = act(prompt.town, 0, submit("battle:quote", null), r.ctx);
    expect(cancelled.town.news[String(t.day)]?.crime).toBe(
      "`8Skelly brutally assaulted Morticia!\r\n\r\n",
    );
  });

  it("the quote goes through the swear filter, as the original's did (:571)", () => {
    const r = won(2, {});
    const prompt = press(r.town, 0, "battle:yellwin", r.ctx);
    const quoted = act(prompt.town, 0, submit("battle:quote", "shit happens"), r.ctx);
    expect(quoted.town.news[String(r.town.day)]?.crime).toContain('"shoot happens"');
  });

  it("losing: the defender earns the BP and a letter, the TV reports it, the loser's quote is moaned from the ambulance, then the hospital (:456-491, 621-662)", () => {
    const r = fight(3, { hp: 1, hpMax: 1, bp: 2000, plots: 0 }, { strength: 40, plots: 1 });
    const t = fightToEnd(r.town, r.ctx);
    const view = t.sessions["0"]?.view;
    expect(plain(view?.text ?? [])).toContain("You fall down, unable to get up.");
    expect(t.players[0]?.bp).toBe(1990);
    expect(t.players[1]?.bp).toBe(20);
    expect(t.players[1]?.policeProtected).toBe(false);
    const letter = t.players[1]?.mail.find((m) => m.type === "text" && m.text.includes("kicked"));
    expect(letter?.type === "text" && letter.text).toContain(`(applied to day ${t.day})`);
    const prompt = press(t, 0, "battle:yelllost", r.ctx);
    const said = act(prompt.town, 0, submit("battle:quote", "I'll be back"), r.ctx);
    expect(said.town.news[String(t.day)]?.crime).toContain(
      'Morticia assaulted Skelly in self defense!`6\r\n"I\'ll be back" `8moaned Skelly from the ambulance.',
    );
    expect(plain(said.view.text)).toContain("Your whole body aches");
    expect(said.view.picture?.bg).toBe("places/hospital_room");
    const tail = said.town.players[1]?.mail.slice(-3).map((m) => m.type);
    expect(tail).toEqual(["picture", "text", "buttons"]);
  });

  it("Run tells the victim and leads back to the row (:117-152)", () => {
    const r = fight(4, { plots: 9 }, {});
    const ran = press(r.town, 0, "battle:run", r.ctx);
    expect(plain(ran.view.text)).toContain("backflip");
    expect(ids(ran.view)).toEqual(["go:competitors"]);
    const mail = ran.town.players[1]?.mail.find(
      (m) => m.type === "text" && m.text.includes("ran off"),
    );
    expect(mail?.type === "text" && mail.text).toContain("He got scared and ran off.");
  });

  it("Run and Attack are refused once the battle is over (BattleAlreadyEnded, :156-171)", () => {
    const r = won(2, {});
    expect(
      step(r.town, 0, { type: "press", buttonId: "battle:attack" }, r.ctx).rejected,
    ).toBeDefined();
    expect(
      step(r.town, 0, { type: "press", buttonId: "battle:run" }, r.ctx).rejected,
    ).toBeDefined();
  });
});

describe("leaving mid-battle (online_util.cpp:135-156, fixes.battleDisconnect)", () => {
  for (const how of ["leaveGame", "exit"] as const) {
    it(`fixed: ${how} during a fight is a loss, mailed, on the TV and in the Crime section`, () => {
      const r = fight(5, { bp: 2000, plots: 9 }, { bp: 100 });
      const gone =
        how === "leaveGame"
          ? leaveGame(r.town, 0, r.ctx)
          : step(r.town, 0, { type: "exit" }, r.ctx);
      const t = gone.town;
      expect(t.sessions["0"]).toBeUndefined();
      expect(t.players[0]?.hp).toBe(0);
      expect(t.players[0]?.bp).toBe(1990);
      expect(t.players[1]?.bp).toBe(120);
      expect(t.news[String(t.day)]?.crime).toBe(
        "`8Morticia assaulted Skelly (who had fainted) in self defense!\r\n\r\n",
      );
      const mine = t.players[0]?.mail.find((m) => m.type === "text");
      expect(mine?.type === "text" && mine.text).toContain("You fainted while fighting Morticia");
      expect(gone.effects.some((e) => e.kind === "tv")).toBe(true);
    });
  }

  it("original: leaving escapes the battle with nothing lost", () => {
    const r = fight(5, { bp: 2000, plots: 9 }, { bp: 100 }, originalClassicRules());
    const t = leaveGame(r.town, 0, r.ctx).town;
    expect(t.players[0]?.bp).toBe(2000);
    expect(t.players[1]?.bp).toBe(100);
    expect(t.news[String(t.day)]?.crime ?? "").toBe("");
  });

  it("fixed: leaving at the quote prompt still files the report, without a quote", () => {
    const r = won(2, {});
    const t = leaveGame(r.town, 0, r.ctx).town;
    expect(t.news[String(t.day)]?.crime).toBe("`8Skelly brutally assaulted Morticia!\r\n\r\n");
    const orig = won(2, {}, originalClassicRules());
    expect(leaveGame(orig.town, 0, orig.ctx).town.news[String(t.day)]?.crime ?? "").toBe("");
  });
});
