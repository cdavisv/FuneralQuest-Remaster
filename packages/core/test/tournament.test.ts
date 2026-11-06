import { describe, expect, it } from "vitest";
import {
  createPlayer,
  createTown,
  type EngineContext,
  enterGame,
  lobbyStatus,
  originalClassicRules,
  rankPercent,
  ratingTitle,
  resetTown,
  richTextToPlain,
  runDailyMaintenance,
  setPresence,
  type TownState,
} from "../src/index.js";
import { context } from "./support/harness.js";
import { act, edit, ids, press, socialTown, toDesk, toRow } from "./support/social.js";

const plain = richTextToPlain;

const FORM = {
  logon: "newbie",
  name: "Newbie",
  parlor: "Fresh Graves",
  password: "pw",
  passwordVerify: "pw",
  male: true,
  email: "n@example.com",
};

/** Clears any letters shown at the desk. */
function readAll(town: TownState, id: number, ctx: EngineContext): TownState {
  let t = town;
  for (let i = 0; i < 20; i++) {
    const o = t.sessions[String(id)]?.view?.overlay;
    if (o?.kind === "message") t = act(t, id, { type: "dismiss", overlayId: o.id }, ctx).town;
    else if (o?.kind === "confirm")
      t = act(t, id, { type: "confirm", overlayId: o.id, accepted: false }, ctx).town;
    else break;
  }
  return t;
}

/** A three-day tournament with three players; Morticia leads. */
function tournament() {
  const { town, ctx } = socialTown(42, 3, {
    online: [],
    settings: { tournamentActive: true, tournamentDays: 3 },
  });
  let t = edit(edit(edit(town, 0, { bp: 40 }), 1, { bp: 90, plots: 4 }), 2, { bp: 10 });
  t = runDailyMaintenance(t, ctx).town; // day 2
  t = runDailyMaintenance(t, ctx).town; // day 3, the last playing day
  return { town: t, ctx };
}

describe("tournament end and reset (maint.cpp:99-148, 362-380, reset_game.cpp, funeral.cpp:198-279)", () => {
  it("day N is the final playing day; day N+1 nobody can play, the winner is named and enters the Book of Deeds", () => {
    const { town, ctx } = tournament();
    expect(town.day).toBe(3);
    const last = toDesk(enterGame(town, 0, ctx).town, 0, ctx);
    expect(last.players[0]?.turns).toBe(15);
    const final = runDailyMaintenance(last, ctx);
    const t = final.town;
    expect(t.day).toBe(4);
    expect(t.deeds).toEqual(["Morticia won the 'Best Funeral Directory In The Universe' award."]);
    const front = t.news["4"]?.front ?? "";
    expect(front).toContain("TOURNAMENT WINNER HAS BEEN DECLARED!");
    expect(front).toContain(
      "With 90 Bury Points and 4 plots, Morticia has been declared the victor.",
    );
    expect(front).toContain("GIANT METEOR TO DESTROY THE WORLD AT MIDNIGHT!");

    // The lockout: no turns, no visits, no new accounts.
    const on = enterGame(t, 2, ctx);
    expect(plain(on.view.news?.topToday ?? [])).toBe("Top seller of the universe is Morticia.");
    let d = toDesk(on.town, 2, ctx);
    d = readAll(d, 2, ctx);
    expect(d.players[2]?.turns).toBe(0);
    expect(d.players[2]?.playerFights).toBe(2);
    const wait = press(d, 2, "desk:wait", ctx);
    expect(wait.view.picture?.fg).toBe("closed");
    const row = toRow(d, 2, ctx);
    expect(plain(press(row.town, 2, "competitors:visit", ctx).view.text)).toContain(
      "Is today look at everyone's parlor day?",
    );
    const refused = createPlayer(t, FORM, ctx);
    expect(refused.ok).toBe(false);
    if (!refused.ok)
      expect(plain(refused.error)).toBe("A new game is starting tomorrow, please come back then!");
    const lobby = lobbyStatus(t, ctx);
    expect(lobby.gameInfo).toBe(
      "Game Info: Tournament is OVER, Morticia declared winner.  New game starting tomorrow.",
    );
    expect(lobby.closed).toBe("A new game is starting tomorrow, please come back then!");

    // The next midnight: everyone is logged off, the town is reset and starts day 1 at once.
    const reset = runDailyMaintenance(d, ctx);
    const r = reset.town;
    expect(reset.daysRun).toBe(1);
    expect(reset.effects).toContainEqual({ kind: "sessionEnded", playerId: 2, reason: "reset" });
    expect(reset.effects).toContainEqual({ kind: "tournamentReset", winner: "Morticia" });
    expect(reset.effects.some((e) => e.kind === "tournamentResetDue")).toBe(false);
    expect(r.day).toBe(1);
    expect(r.players).toEqual([]);
    expect(r.sessions).toEqual({});
    expect(r.topYesterday).toBeNull();
    expect(Object.keys(r.news)).toEqual(["1"]);
    expect(r.deeds).toEqual(t.deeds);
    expect(r.settings).toEqual(t.settings);
    expect(r.seed).not.toBe(t.seed);
    expect(r.presence).toBeUndefined();
    expect(Object.keys(r.streams)).toEqual(["town"]);
    expect(lobbyStatus(r, ctx).gameInfo).toBe(
      "Game Info: Tournament Mode Active (day 1 of 3) - 0 of 0 players on now.",
    );
    const again = createPlayer(r, FORM, ctx);
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.playerId).toBe(0);
  });

  it("the reset is deterministic and a fresh tournament does not replay the old draws", () => {
    const a = tournament();
    const b = tournament();
    const endA = runDailyMaintenance(runDailyMaintenance(a.town, a.ctx).town, a.ctx).town;
    const endB = runDailyMaintenance(runDailyMaintenance(b.town, b.ctx).town, b.ctx).town;
    expect(JSON.stringify(endA)).toBe(JSON.stringify(endB));
  });

  it("missed midnights after the end: reset, then the remaining days are caught up (fixes.catchUpMissedDays)", () => {
    const { town, ctx } = tournament();
    const final = runDailyMaintenance(town, ctx).town;
    const r = runDailyMaintenance(final, ctx, { missedDays: 3 });
    expect(r.daysRun).toBe(3);
    expect(r.town.day).toBe(3);
    const orig = context(originalClassicRules());
    expect(runDailyMaintenance(final, orig, { missedDays: 3 }).town.day).toBe(1);
  });

  it("a paused reset waits on day 0 with new accounts refused, then starts itself at midnight", () => {
    const { town, ctx } = tournament();
    const paused = resetTown(town, ctx, { paused: true });
    expect(paused.town.day).toBe(0);
    expect(paused.town.deeds).toEqual(town.deeds);
    const lobby = lobbyStatus(paused.town, ctx);
    expect(lobby.gameInfo).toBe(
      "A brand new game of FQ will be starting tomorrow! (Server will auto-reset at midnight)",
    );
    const refused = createPlayer(paused.town, FORM, ctx);
    expect(!refused.ok && plain(refused.error)).toBe(
      "A new game is starting tomorrow, please come back then! (Or midnight tonight!)",
    );
    const started = runDailyMaintenance(paused.town, ctx).town;
    expect(started.day).toBe(1);
    expect(createPlayer(started, FORM, ctx).ok).toBe(true);
    expect(resetTown(town, ctx).town.day).toBe(1);
    const fresh = createTown({ seed: 5, paused: true }, ctx).town;
    expect(fresh.day).toBe(0);
    expect(runDailyMaintenance(fresh, ctx).town.day).toBe(1);
  });
});

describe("rankings with real rows (rankings.cpp:43-115, commands_rankings.cpp)", () => {
  it("name, parlor, BP, rating title and where each player is", () => {
    const { town, ctx } = socialTown(7, 4, { online: [0, 2] });
    let t = edit(edit(edit(town, 1, { bp: 300 }), 2, { bp: 200 }), 3, {
      bp: 100,
      policeProtected: true,
    });
    const map = press(t, 2, "go:map", ctx);
    t = act(map.town, 2, { type: "visit", placeId: "cafe" }, ctx).town;
    const r = press(t, 0, "go:rankings", ctx);
    expect(r.view.scene).toBe("rankings");
    const rows = r.view.rankings ?? [];
    expect(rows.map((x) => [x.place, x.name, x.parlor, x.bp, x.status])).toEqual([
      [1, "Morticia", "Morticia Rest", 300, ""],
      [2, "Digby", "Digby Rest", 200, "in cafe"],
      [3, "Graves", "Graves Rest", 100, "Protected"],
      [4, "Skelly", "Skelly Rest", 0, "on now"],
    ]);
    for (const row of rows) {
      expect(row.title).toBe(ratingTitle(ctx.content, rankPercent(r.town, row.playerId)));
      expect(row.title).not.toBe("");
    }
    expect(plain(r.view.text)).toContain("Morticia            F  Morticia Rest              300 ");
    expect(ids(r.view)).toEqual(["go:desk"]);
    // A session whose connection the host reports gone is not "on now".
    const gone = setPresence(t, 0, false);
    const r2 = press(gone, 0, "go:rankings", ctx);
    expect(r2.view.rankings?.find((x) => x.name === "Skelly")?.online).toBe(false);
  });
});
