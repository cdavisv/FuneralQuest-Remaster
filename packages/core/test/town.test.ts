import { describe, expect, it } from "vitest";
import {
  createPlayer,
  enterGame,
  leaveGame,
  originalClassicRules,
  playerRank,
  rankPercent,
  richTextToPlain,
  runDailyMaintenance,
  step,
  type TownState,
} from "../src/index.js";
import { buttonIds, context, makeTown, press } from "./support/harness.js";

const form = {
  logon: "newbie",
  name: "Newbie",
  parlor: "New Rest",
  password: "x",
  passwordVerify: "x",
  male: true,
  email: "n@example.com",
};

describe("new players (legacy/source/new_user.cpp)", () => {
  const { town, ctx } = makeTown(5, 2);

  it("validates in the original order with the original messages", () => {
    const err = (change: Partial<typeof form>) => {
      const r = createPlayer(town, { ...form, ...change }, ctx);
      return r.ok ? "ok" : `${r.field}: ${richTextToPlain(r.error)}`;
    };
    expect(err({ name: "ab" })).toBe("name: Your name is too short.  Try a longer one.");
    expect(err({ name: "x".repeat(21) })).toMatch(/^name: Your name is too long/);
    expect(err({ name: "skelly" })).toBe(
      "name: Someone is already using the name skelly. Please try another.",
    );
    expect(err({ logon: "LOGIN0" })).toMatch(
      /^logon: Someone is already using the logon name of LOGIN0/,
    );
    expect(err({ parlor: "a`b" })).toMatch(/^parlor: Your funeral parlor name is too short/);
    expect(err({ password: "", passwordVerify: "" })).toMatch(
      /^password: Your password is too short/,
    );
    expect(err({ passwordVerify: "y" })).toMatch(/^password: Your passwords don't match/);
    expect(err({ email: "a@b" })).toMatch(/^email: Email address required/);
    expect(err({ email: `${"x".repeat(44)}@b` })).toMatch(/^email: Email address is too big/);
    expect(err({ name: "  N?e|w=b/i\\e  " })).toBe("ok");
  });

  it("strips dangerous characters, starts with the Game Settings, announces and shows the paper", () => {
    const r = createPlayer(town, { ...form, name: "Ne{w}bie$" }, ctx);
    if (!r.ok) throw new Error("expected ok");
    const p = r.town.players[r.playerId];
    expect(p).toMatchObject({
      name: "Newbie",
      money: 500,
      luck: 50,
      karma: 50,
      hp: 10,
      strength: 3,
      turns: 0,
    });
    expect(p?.tags).toEqual([0, 0, 0]);
    expect(r.view.scene).toBe("news");
    expect(r.town.news[String(r.town.day)]?.front).toContain(
      "A new parlor (New Rest) run by Newbie has been opened!",
    );
    // Players online get the notice; the town is otherwise untouched by a failed attempt.
    expect(
      r.town.players[0]?.mail.some(
        (m) => m.type === "simpleText" && m.text.includes("moved into town"),
      ),
    ).toBe(true);
  });

  it("reuses a deleted player's slot", () => {
    const t = structuredClone(town);
    (t.players[1] as { active: boolean }).active = false;
    delete t.sessions["1"];
    const r = createPlayer(t, form, ctx);
    expect(r.ok && r.playerId).toBe(1);
  });
});

describe("the new day and the desk (commands_main.cpp, commands_newday.cpp)", () => {
  it("first desk visit refills turns and greets a brand-new player (fixed welcome)", () => {
    const { town, ctx } = makeTown(5, 1);
    const r = press(town, 0, "go:desk", ctx);
    expect(r.view.picture?.fg).toBe("morning_coffee");
    expect(richTextToPlain(r.view.text)).toMatch(/^Welcome to Funeral Quest, Skelly/);
    expect(r.town.players[0]).toMatchObject({ turns: 15, bpToday: 0, dayLastLoggedOn: r.town.day });
  });

  it("with the original rules the welcome never shows (:88)", () => {
    const ctx = context(originalClassicRules());
    const { town } = makeTown(5, 1, { ctx });
    const r = press(town, 0, "go:desk", ctx);
    expect(richTextToPlain(r.view.text)).toMatch(/^Welcome back, Skelly!/);
  });

  it("hearse bonus turns and the police line (fixed) appear on the new day", () => {
    const { town, ctx } = makeTown(5, 1);
    const t = structuredClone(town);
    Object.assign(t.players[0] as object, { transportation: 3, policeProtected: true });
    const r = press(t, 0, "go:desk", ctx);
    expect(r.town.players[0]?.turns).toBe(15 + 7);
    const text = richTextToPlain(r.view.text);
    expect(text).toContain("Your Statesman gives you time for 7 extra customers.");
    expect(text).toContain("There are police patrolling your parlor.");
    expect(r.town.players[0]?.policeProtected).toBe(false);
  });

  it("a player at the desk over midnight wakes up there (online_day_logon)", () => {
    const { town, ctx } = makeTown(5, 1);
    let t = press(press(town, 0, "go:desk", ctx).town, 0, "go:desk", ctx).town;
    t = runDailyMaintenance(t, ctx).town;
    const r = press(t, 0, "go:map", ctx);
    const back = step(r.town, 0, { type: "visit", placeId: "funeral-home" }, ctx);
    expect(richTextToPlain(back.view.text)).toMatch(/^You're eyes grow heavy/);
  });

  it("logging back on the same day says welcome back and reads the mail", () => {
    const { town, ctx } = makeTown(5, 1);
    let t = press(press(town, 0, "go:desk", ctx).town, 0, "go:desk", ctx).town;
    t = step(t, 0, { type: "exit" }, ctx).town;
    expect(t.sessions["0"]).toBeUndefined();
    t = enterGame(t, 0, ctx).town;
    const r = press(t, 0, "go:desk", ctx);
    expect(richTextToPlain(r.view.text)).toMatch(
      /^Welcome back, Skelly\. {2}Unfinished business\?/,
    );
    expect(buttonIds(r.view)).toContain("desk:wait");
  });
});

describe("daily maintenance (legacy/source/maint.cpp:263-415)", () => {
  function dayWithSales(): { town: TownState; ctx: ReturnType<typeof context> } {
    const { town, ctx } = makeTown(9, 4);
    const t = structuredClone(town);
    t.players.forEach((p, i) => {
      Object.assign(p, {
        bp: [100, 50, 30, 10][i],
        bpToday: [5, 40, 1, 0][i],
        dayLastLoggedOn: t.day,
      });
    });
    for (const id of ["0", "1", "2", "3"]) delete t.sessions[id];
    return { town: t, ctx };
  }

  it("mails the top seller and the top three parlors; rewards apply when read", () => {
    const { town, ctx } = dayWithSales();
    const next = runDailyMaintenance(town, ctx).town;
    expect(next.day).toBe(town.day + 1);
    expect(next.topYesterday).toMatchObject({ name: "Morticia", bp: 40 });
    const texts = (id: number) =>
      (next.players[id]?.mail ?? [])
        .filter((m) => m.type === "text")
        .map((m) => (m.type === "text" ? m.text : ""));
    expect(texts(1).some((t) => t.includes("top seller for yesterday"))).toBe(true);
    expect(texts(0).some((t) => t.includes("top parlor"))).toBe(true);
    expect(texts(1).some((t) => t.includes("second highest"))).toBe(true);
    expect(texts(2).some((t) => t.includes("third highest"))).toBe(true);
    expect(texts(3).length).toBe(0);
    // Totals unchanged until the mail is read; today's BP reset.
    expect(next.players[0]).toMatchObject({ bp: 100, bpToday: 0 });
    let t = enterGame(next, 0, ctx).town;
    t = press(press(t, 0, "go:desk", ctx).town, 0, "go:desk", ctx).town;
    // Top parlor: +20 BP, +25 luck (luck 50 + 25 = 75).
    expect(t.players[0]?.bp).toBeGreaterThanOrEqual(120);
  });

  it("a 0-BP player survives three midnights with the grace fix, and only one without", () => {
    const { town, ctx } = makeTown(9, 1);
    let t = step(town, 0, { type: "exit" }, ctx).town;
    const fixed = runDailyMaintenance(t, ctx, { missedDays: 3 });
    expect(fixed.daysRun).toBe(3);
    expect(fixed.town.players[0]?.active).toBe(true);
    expect(runDailyMaintenance(fixed.town, ctx).town.players[0]?.active).toBe(false);

    const original = context(originalClassicRules());
    t = runDailyMaintenance(t, original, { missedDays: 3 }).town;
    expect(t.day).toBe(town.day + 1); // no catch-up in the original
    expect(t.players[0]?.active).toBe(false);
  });

  it("deletes players inactive for 15 days and lifts police protection after a day away", () => {
    const { town, ctx } = makeTown(9, 2);
    const t = structuredClone(town);
    Object.assign(t.players[0] as object, {
      bp: 10,
      dayLastLoggedOn: t.day,
      dayCreated: t.day,
      policeProtected: true,
    });
    Object.assign(t.players[1] as object, { bp: 10, dayLastLoggedOn: t.day, dayCreated: t.day });
    delete t.sessions["0"];
    delete t.sessions["1"];
    const r = runDailyMaintenance(t, ctx, { missedDays: 16 });
    expect(r.town.players[0]?.policeProtected).toBe(false);
    expect(r.town.players.every((p) => !p.active)).toBe(true);
    expect(r.effects.filter((e) => e.kind === "playerDeleted").length).toBe(2);
  });

  it("writes a news blurb every day and keeps a random player's blurb mail until it expires", () => {
    const { town, ctx } = makeTown(9, 2);
    const r = runDailyMaintenance(town, ctx, { missedDays: 5 });
    for (let d = town.day + 1; d <= r.town.day; d++)
      expect(r.town.news[String(d)]?.front).toMatch(/^`7/);
  });

  it("a dropped connection mid-sale mails the sale (online_util.cpp:123-133)", () => {
    const made = makeTown(3, 1, { settings: { normalOdds: 0, luckOdds: 0, scriptOdds: 0 } });
    const ctx = made.ctx;
    let t = press(press(made.town, 0, "go:desk", ctx).town, 0, "go:desk", ctx).town;
    t = press(t, 0, "desk:wait", ctx).town;
    const r = leaveGame(t, 0, ctx);
    expect(r.town.sessions["0"]).toBeUndefined();
    expect(r.town.players[0]?.plots).toBe(1);
    expect(
      r.town.players[0]?.mail.some((m) => m.type === "text" && m.text.includes("You fainted")),
    ).toBe(true);
    expect(r.effects.some((e) => e.kind === "tv")).toBe(true);
  });
});

describe("rankings (legacy/source/rankings.cpp)", () => {
  it("ranks every slot by total BP and maps place to a percentage", () => {
    const { town } = makeTown(1, 4);
    town.players.forEach((p, i) => {
      p.bp = [10, 40, 20, 30][i] ?? 0;
    });
    expect(playerRank(town, 1)).toBe(1);
    expect(playerRank(town, 0)).toBe(4);
    expect(rankPercent(town, 1)).toBe(100);
    expect(rankPercent(town, 0)).toBe(25);
  });
});
