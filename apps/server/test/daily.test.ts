import { dailyChallengeSeed } from "@fq/core";
import type { View } from "@fq/protocol";
import { afterEach, describe, expect, it } from "vitest";
import { ApiClient, ApiError, DailyChallengeTransport } from "../src/client/index.js";
import type { DailyChallengeScore } from "../src/wire.js";
import { enabled, press, type Send, saleStep } from "./support/expanded.js";
import { type Harness, startServer, TestPlayer } from "./support/harness.js";

/** The Daily Challenge over HTTP: one seeded day for everyone, once each, ranked. */

let h: Harness | null = null;
afterEach(async () => {
  await h?.stop();
  h = null;
});

const DAY = 86_400_000;
const sendDaily =
  (p: TestPlayer): Send =>
  (action) =>
    p.request("POST", "/api/daily/action", { action }) as ReturnType<Send>;

/** Plays the whole run with the simple sale policy. Returns the final result. */
async function playRun(p: TestPlayer, first: View): Promise<DailyChallengeScore> {
  const send = sendDaily(p);
  let view = first;
  const state = { carded: false };
  for (let i = 0; i < 1500; i++) {
    const ids = enabled(view);
    if (ids.includes("desk:wait") && !ids.includes("neg:done")) {
      state.carded = false;
      view = await press(send, "desk:wait");
      continue;
    }
    const out = await saleStep(send, view, state);
    view = out.view;
    if (out.result) return out.result as DailyChallengeScore;
    if (out.desk) state.carded = false;
  }
  throw new Error("the challenge never ended");
}

const enter = async (p: TestPlayer): Promise<View> => {
  const r = await p.request<{ view: View; day: string; created: boolean }>(
    "POST",
    "/api/daily/enter",
    {},
  );
  if (r.status !== 200) throw new Error(`enter: ${JSON.stringify(r)}`);
  return r.body.view;
};

describe("the Daily Challenge", () => {
  it("gives everyone the same customers, once each, ranks registered accounts, and keeps guests off the board", async () => {
    h = await startServer({ towns: [] });
    const alice = await new TestPlayer(h, "alice", undefined, "10.0.0.1").signUp();
    const bob = await new TestPlayer(h, "bobby", undefined, "10.0.0.2").signUp();
    const guestAccount = await h.inject({
      method: "POST",
      url: "/api/auth/guest",
      payload: {},
      headers: { "content-type": "application/json" },
    });
    const guest = new TestPlayer(h, "guest-unused", undefined, "10.0.0.3");
    guest.token = guestAccount.json().token;

    // Info is public; a signed-in caller also sees their own state.
    const info = (await h.inject({ method: "GET", url: "/api/daily" })).json();
    expect(info.day).toBe("2030-01-01");
    expect(info.you).toBeNull();
    expect(info.loadout.turns).toBeGreaterThan(0);
    expect(
      (await alice.request<{ you: { status: string } }>("GET", "/api/daily")).body.you.status,
    ).toBe("available");

    const aliceDesk = await enter(alice);
    await enter(bob);
    await enter(guest);
    expect(aliceDesk.scene).toBe("desk");
    expect(enabled(aliceDesk)).toContain("desk:wait");

    // The identical day: the same first customer, to the last tell.
    const firstOf = async (p: TestPlayer): Promise<View> => press(sendDaily(p), "desk:wait");
    const a1 = await firstOf(alice);
    const b1 = await firstOf(bob);
    const g1 = await firstOf(guest);
    // (Whatever the first wait brings, a customer or an event, it is the same for everyone.)
    const plain = (v: View, name: string) => JSON.stringify(v).replaceAll(name, "NAME");
    expect(plain(b1, "bobby")).toBe(plain(a1, "alice"));
    expect(plain(g1, "Guest")).toBe(plain(a1, "alice"));

    // Resuming returns the same screen and is not a second run.
    const again = await alice.request<{ view: View; created: boolean }>(
      "POST",
      "/api/daily/enter",
      {},
    );
    expect(again.status).toBe(200);
    expect(again.body.created).toBe(false);
    expect(JSON.stringify(again.body.view)).toBe(JSON.stringify(a1));

    // Play all three out.
    const ra = await playRun(alice, a1);
    const rb = await playRun(bob, b1);
    const rg = await playRun(guest, g1);
    for (const r of [ra, rb, rg]) {
      expect(r.abandoned).toBe(false);
      expect(r.sales).toBeGreaterThanOrEqual(0);
    }
    // The same moves on the same customers give the same score: the day really is identical.
    expect(rb).toEqual(ra);
    expect(rg).toEqual(ra);
    expect(ra.score).toBeGreaterThan(0);

    // A second attempt is refused, with the result.
    const second = await alice.request<{ error: string; result: DailyChallengeScore }>(
      "POST",
      "/api/daily/enter",
      {},
    );
    expect(second.status).toBe(409);
    expect(second.body.error).toBe("already_played");
    expect(second.body.result).toEqual(ra);
    const late = await alice.act({ type: "press", buttonId: "desk:wait" }, "x");
    expect(late.status).toBe(404);
    const afterAction = await alice.request("POST", "/api/daily/action", {
      action: { type: "press", buttonId: "desk:wait" },
    });
    expect([409]).toContain(afterAction.status);

    // The board: registered accounts only, ranked, with the caller's own row.
    const board = await alice.request<{
      day: string;
      total: number;
      entries: { place: number; name: string; score: number }[];
      you: { place: number; name: string } | null;
    }>("GET", "/api/daily/leaderboard");
    expect(board.status).toBe(200);
    expect(board.body.day).toBe("2030-01-01");
    expect(board.body.total).toBe(2);
    expect(board.body.entries.map((e) => e.place)).toEqual([1, 2]);
    expect(board.body.entries.map((e) => e.name).sort()).toEqual(["alice", "bobby"]);
    expect(board.body.you?.name).toBe("alice");
    // A tie on score and money and walkouts falls back to the name.
    expect(board.body.entries[0]?.name).toBe("alice");
    // The guest has a result but no place.
    const youGuest = (
      await guest.request<{
        you: { status: string; place: number | null; guest: boolean; result: unknown };
      }>("GET", "/api/daily")
    ).body.you;
    expect(youGuest).toMatchObject({ status: "finished", place: null, guest: true });
    expect(youGuest.result).toEqual(ra);
    const publicBoard = (await h.inject({ method: "GET", url: "/api/daily/leaderboard" })).json();
    expect(publicBoard.you).toBeNull();
    expect(JSON.stringify(publicBoard)).not.toContain("guest");
    expect(
      (await alice.request<{ you: { place: number } }>("GET", "/api/daily")).body.you.place,
    ).toBe(1);
  });

  it("counts an abandoned run as played, and keeps what it earned", async () => {
    h = await startServer({ towns: [] });
    const quitter = await new TestPlayer(h, "quitter", undefined, "10.0.0.1").signUp();
    const idler = await new TestPlayer(h, "idler", undefined, "10.0.0.2").signUp();
    const qDesk = await enter(quitter);
    const iDesk = await enter(idler);
    expect(qDesk.scene).toBe("desk");

    // Quitting at the desk with turns left ends the run.
    const q = await press(sendDaily(quitter), "desk:quit");
    expect(q.scene).not.toBe("desk");
    const redo = await quitter.request<{ error: string; result: DailyChallengeScore }>(
      "POST",
      "/api/daily/enter",
      {},
    );
    expect(redo.status).toBe(409);
    expect(redo.body.error).toBe("already_played");
    expect(redo.body.result.abandoned).toBe(true);

    // An idle run is ended by the idle time-out (15 minutes by default).
    await press(sendDaily(idler), "desk:wait");
    expect(iDesk.scene).toBe("desk");
    await h.clock.advance(16 * 60_000);
    const idleAgain = await idler.request<{ error: string; result: DailyChallengeScore }>(
      "POST",
      "/api/daily/enter",
      {},
    );
    expect(idleAgain.status).toBe(409);
    expect(idleAgain.body.result.abandoned).toBe(true);
    const board = (
      await idler.request<{ total: number; entries: { name: string }[] }>(
        "GET",
        "/api/daily/leaderboard",
      )
    ).body;
    expect(board.total).toBe(2);
  });

  it("is a new challenge each calendar day, readable afterwards, and rejects bad days", async () => {
    h = await startServer({ towns: [] });
    const p = await new TestPlayer(h, "daily1", undefined, "10.0.0.1").signUp();
    const start1 = await enter(p);
    await press(sendDaily(p), "desk:wait");
    await press(sendDaily(p), "desk:quit").catch(() => undefined);
    const day1 = h.server.host.challenge.today();

    await h.clock.advance(DAY);
    const day2 = h.server.host.challenge.today();
    expect(day2).not.toBe(day1);
    // Yesterday's result is still there, and today it can be played again.
    const yesterday = await p.request<{ total: number }>(
      "GET",
      `/api/daily/leaderboard?day=${day1}`,
    );
    expect(yesterday.status).toBe(200);
    expect(yesterday.body.total).toBe(1);
    expect(
      (await p.request<{ you: { status: string } }>("GET", "/api/daily")).body.you.status,
    ).toBe("available");
    const start2 = await enter(p);
    await press(sendDaily(p), "desk:wait");
    const challenge = h.server.host.challenge;
    expect(challenge.challengeFor(day2).seed).not.toBe(challenge.challengeFor(day1).seed);
    expect(start2.scene).toBe(start1.scene);

    const days = (
      await p.request<{ days: { day: string; entries: number }[] }>("GET", "/api/daily/days")
    ).body.days;
    expect(days.map((d) => d.day)).toEqual([day1]);
    for (const bad of ["tomorrow", "2999-01-01", "2030-13-45", `${day2.slice(0, 8)}99`]) {
      const r = await p.request("GET", `/api/daily/leaderboard?day=${bad}`);
      expect(r.status, bad).toBe(400);
    }
  });

  it("cannot be precomputed from the date: the seed comes from a server secret that survives restarts", async () => {
    h = await startServer({ towns: [] });
    const day = "2030-01-01";
    const seed = h.server.host.challenge.challengeFor(day).seed;
    expect(seed).not.toBe(dailyChallengeSeed(day));
    // Stable within the day and across a restart (same database), different on another server.
    expect(h.server.host.challenge.challengeFor(day).seed).toBe(seed);
    const other = await startServer({ towns: [] });
    expect(other.server.host.challenge.challengeFor(day).seed).not.toBe(seed);
    await other.stop();
    h = await h.restart();
    expect(h.server.host.challenge.challengeFor(day).seed).toBe(seed);
    // The secret is never in a response.
    const p = await new TestPlayer(h, "snoop", undefined, "10.0.0.1").signUp();
    const entered = await p.request("POST", "/api/daily/enter", {});
    expect(JSON.stringify(entered.body)).not.toContain(String(seed));
    expect(JSON.stringify((await p.request("GET", "/api/daily")).body)).not.toContain(String(seed));
  });

  it("survives a restart mid-run, keeps the board, and works through the typed client", async () => {
    h = await startServer({ towns: [], listen: true });
    const base = h.baseUrl();
    const api = new ApiClient({ baseUrl: base });
    await api.signUp("typed", "correct horse battery");
    const info = await api.dailyChallenge();
    expect(info.you?.status).toBe("available");

    const transport = new DailyChallengeTransport({ api });
    let result: DailyChallengeScore | null = null;
    transport.onResult((r) => {
      result = r;
    });
    const first = await transport.connect();
    expect(enabled(first)).toContain("desk:wait");
    let view = await transport.send({ type: "press", buttonId: "desk:wait" });
    // Restart the server mid-run (different port: build a fresh client onto the new one).
    h = await h.restart({});
    const api2 = new ApiClient({ baseUrl: h.baseUrl(), token: api.token });
    const resumed = await api2.enterDailyChallenge();
    expect(resumed.created).toBe(false);
    expect(JSON.stringify(resumed.view)).toBe(JSON.stringify(view));
    expect(JSON.stringify(await api2.dailyChallengeView())).toBe(JSON.stringify(view));

    // Play to the end through the client methods.
    const t2 = new DailyChallengeTransport({ api: api2 });
    t2.onResult((r) => {
      result = r;
    });
    await t2.connect();
    const send: Send = async (action) => {
      try {
        const r = await api2.actDailyChallenge(action);
        if (r.result) result = r.result;
        return { status: 200, body: r };
      } catch (e) {
        if (e instanceof ApiError)
          return { status: e.status, body: { error: e.code, message: e.message } };
        throw e;
      }
    };
    const state = { carded: false };
    for (let i = 0; i < 1500 && !result; i++) {
      const ids = enabled(view);
      if (ids.includes("desk:wait") && !ids.includes("neg:done")) {
        state.carded = false;
        view = await press(send, "desk:wait");
        continue;
      }
      view = (await saleStep(send, view, state)).view;
    }
    expect(result).not.toBeNull();
    await expect(api2.enterDailyChallenge()).rejects.toMatchObject({
      status: 409,
      code: "already_played",
    });
    const board = await api2.dailyLeaderboard();
    expect(board.entries.map((e) => e.name)).toEqual(["typed"]);
    expect((await api2.dailyDays())[0]?.entries).toBe(1);
    expect((await api2.dailyLeaderboard({ day: board.day, limit: 1 })).total).toBe(1);

    // And it all survives another restart.
    h = await h.restart({});
    const api3 = new ApiClient({ baseUrl: h.baseUrl() });
    expect((await api3.dailyLeaderboard()).entries[0]?.score).toBe(
      (result as DailyChallengeScore | null)?.score,
    );
  });

  it("needs a login to play, and checks the parlor form", async () => {
    h = await startServer({ towns: [] });
    const anon = new TestPlayer(h, "nobody", undefined, "10.0.0.1");
    expect((await anon.request("POST", "/api/daily/enter", {})).status).toBe(401);
    expect(
      (await anon.request("POST", "/api/daily/action", { action: { type: "exit" } })).status,
    ).toBe(401);
    expect((await anon.request("GET", "/api/daily/view")).status).toBe(401);
    const p = await new TestPlayer(h, "former", undefined, "10.0.0.2").signUp();
    expect(
      (await p.request("POST", "/api/daily/action", { action: { type: "exit" } })).status,
    ).toBe(409);
    const badName = await p.request<{ error: string; field?: string }>("POST", "/api/daily/enter", {
      parlor: { name: "Bo@b", parlor: "Fine Rest", male: true },
    });
    expect(badName.status).toBe(422);
    expect(badName.body.field).toBe("name");
    const short = await p.request<{ error: string; field?: string }>("POST", "/api/daily/enter", {
      parlor: { name: "Bo", parlor: "Fine Rest", male: true },
    });
    expect(short.status).toBe(422);
    // Nothing was started by the refused forms.
    expect(
      (await p.request<{ you: { status: string } }>("GET", "/api/daily")).body.you.status,
    ).toBe("available");
    const ok = await p.request<{ view: View }>("POST", "/api/daily/enter", {
      parlor: { name: "Grim", parlor: "Grim Rest", male: false },
    });
    expect(ok.status).toBe(200);
  });
});
