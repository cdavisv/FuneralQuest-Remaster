import { afterEach, describe, expect, it } from "vitest";
import {
  ADMIN_TOKEN,
  connectSocket,
  type Harness,
  startServer,
  TestPlayer,
} from "./support/harness.js";

let h: Harness | null = null;
afterEach(async () => {
  await h?.stop();
  h = null;
});

async function admin<T = Record<string, unknown>>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  body?: unknown,
  token: string | null = ADMIN_TOKEN,
): Promise<{ status: number; body: T }> {
  const res = await h?.inject({
    method,
    url,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    ...(body !== undefined ? { payload: JSON.stringify(body) } : {}),
  });
  return {
    status: res?.statusCode ?? 0,
    body: (res?.body ? JSON.parse(res.body) : undefined) as T,
  };
}

describe("admin access", () => {
  it("needs the admin token on every route", async () => {
    h = await startServer();
    const routes: [string, string][] = [
      ["GET", "/admin/server"],
      ["GET", "/admin/towns"],
      ["GET", "/admin/towns/main/settings"],
      ["GET", "/admin/towns/main/players"],
      ["GET", "/admin/accounts"],
      ["GET", "/admin/bans"],
      ["GET", "/admin/audit"],
      ["POST", "/admin/towns/main/new-day"],
      ["POST", "/admin/towns/main/broadcast"],
    ];
    for (const [method, url] of routes) {
      const none = await admin(method as "GET", url, undefined, null);
      expect(none.status, `${method} ${url}`).toBe(401);
      const wrong = await admin(method as "GET", url, undefined, "x".repeat(32));
      expect(wrong.status, `${method} ${url}`).toBe(401);
    }
    // A player's session token is not an admin token.
    const p = await new TestPlayer(h, "alice").signUp();
    expect((await admin("GET", "/admin/server", undefined, p.token)).status).toBe(401);
    expect((await admin("GET", "/admin/server")).status).toBe(200);
  });

  it("is disabled when no token is configured", async () => {
    h = await startServer({ config: { adminToken: "" } });
    expect(
      (await admin("GET", "/admin/server", undefined, "anything-at-all-0123456789")).status,
    ).toBe(503);
  });

  it("rate-limits the admin API", async () => {
    h = await startServer({ config: { rateAdminMax: 4 } });
    const codes: number[] = [];
    for (let i = 0; i < 6; i++)
      codes.push((await admin("GET", "/admin/server", undefined, "y".repeat(30))).status);
    expect(codes).toEqual([401, 401, 401, 401, 429, 429]);
  });
});

describe("towns and settings", () => {
  it("creates towns, rejects bad ones, and lists them", async () => {
    h = await startServer();
    const made = await admin<{ id: string; dayLengthMinutes: number }>("POST", "/admin/towns", {
      id: "blitz",
      name: "Blitz Town",
      dayLengthMinutes: 15,
      timeZone: "Europe/London",
      contentPack: "vintage",
      settings: { turnsPerDay: 5 },
    });
    expect(made.status).toBe(201);
    expect(made.body).toMatchObject({ id: "blitz", dayLengthMinutes: 15, contentPack: "vintage" });
    expect(h.server.host.get("blitz")?.snapshotState.settings.turnsPerDay).toBe(5);

    expect((await admin("POST", "/admin/towns", { id: "blitz", name: "Again" })).status).toBe(409);
    expect((await admin("POST", "/admin/towns", { id: "Bad Id", name: "x" })).status).toBe(400);
    expect(
      (await admin("POST", "/admin/towns", { id: "x1", name: "x", timeZone: "Mars/Base" })).status,
    ).toBe(400);
    expect(
      (await admin("POST", "/admin/towns", { id: "x2", name: "x", ruleset: "chess" })).status,
    ).toBe(422);
    expect(
      (await admin("POST", "/admin/towns", { id: "x3", name: "x", contentPack: "nope" })).status,
    ).toBe(422);
    expect(
      (
        await admin("POST", "/admin/towns", {
          id: "x4",
          name: "x",
          settings: { turnsPerDay: "many" },
        })
      ).status,
    ).toBe(400);
    expect(
      (await admin("POST", "/admin/towns", { id: "x5", name: "x", surprise: true })).status,
    ).toBe(400);

    const list = await admin<{ towns: { id: string }[] }>("GET", "/admin/towns");
    expect(list.body.towns.map((t) => t.id)).toEqual(["main", "blitz"]);
    // The public lobby sees it too.
    const lobby = await h.inject({ method: "GET", url: "/api/towns" });
    expect(JSON.parse(lobby.body).towns).toHaveLength(2);

    // It survives a restart as created.
    h = await h.restart();
    expect(h.server.host.get("blitz")?.dayLengthMs).toBe(15 * 60_000);
    expect(h.server.host.get("blitz")?.contentPack).toBe("vintage");
  });

  it("reads and changes every game setting, validated", async () => {
    h = await startServer();
    const got = await admin<{
      settings: Record<string, unknown>;
      defaults: Record<string, unknown>;
    }>("GET", "/admin/towns/main/settings");
    expect(got.status).toBe(200);
    expect(Object.keys(got.body.settings).sort()).toEqual(Object.keys(got.body.defaults).sort());
    expect(got.body.settings).toHaveProperty("turnsPerDay");
    expect(got.body.settings).toHaveProperty("tournamentActive");

    const patch = await admin<{ settings: Record<string, unknown> }>(
      "PATCH",
      "/admin/towns/main/settings",
      {
        turnsPerDay: 7,
        startingMoney: 1234,
        normalOdds: 0.25,
        tournamentActive: true,
        tournamentDays: 30,
        casketSp: [1, 2, 3],
      },
    );
    expect(patch.status).toBe(200);
    expect(patch.body.settings).toMatchObject({
      turnsPerDay: 7,
      startingMoney: 1234,
      normalOdds: 0.25,
      tournamentActive: true,
      casketSp: [1, 2, 3],
    });
    for (const bad of [
      { nonsense: 1 },
      { turnsPerDay: 1.5 },
      { turnsPerDay: "7" },
      { normalOdds: 2 },
      { casketSp: [1, 2] },
      { tournamentActive: "yes" },
    ]) {
      expect(
        (await admin("PATCH", "/admin/towns/main/settings", bad)).status,
        JSON.stringify(bad),
      ).toBe(400);
    }

    // The change reaches the game: a new player starts with the new money and turns.
    const p = await new TestPlayer(h, "alice").signUp();
    await p.enter();
    expect(h.server.host.get("main")?.snapshotState.players[0]?.money).toBe(1234);

    // And it is persisted.
    h = await h.restart();
    expect(h.server.host.get("main")?.snapshotState.settings.turnsPerDay).toBe(7);
    const audit = await admin<{ entries: { kind: string; data: { ip?: string } }[] }>(
      "GET",
      "/admin/audit?kind=admin:settings",
    );
    expect(audit.body.entries.length).toBe(1);
  });

  it("changes the content pack, the zone and the server news", async () => {
    h = await startServer();
    expect(
      (await admin("PUT", "/admin/towns/main/content-pack", { contentPack: "nope" })).status,
    ).toBe(422);
    const r = await admin<{ contentPack: string }>("PUT", "/admin/towns/main/content-pack", {
      contentPack: "vintage",
    });
    expect(r.body.contentPack).toBe("vintage");
    const patched = await admin<{ name: string; timeZone: string; serverNews: { text: string }[] }>(
      "PATCH",
      "/admin/towns/main",
      { name: "Renamed", timeZone: "Australia/Sydney", serverNews: "Closed Sunday" },
    );
    expect(patched.body).toMatchObject({ name: "Renamed", timeZone: "Australia/Sydney" });
    expect(patched.body.serverNews[0]?.text).toBe("Closed Sunday");
    expect((await admin("PATCH", "/admin/towns/main", { timeZone: "Nowhere/Land" })).status).toBe(
      400,
    );
    h = await h.restart();
    expect(h.server.host.get("main")).toMatchObject({
      name: "Renamed",
      timeZone: "Australia/Sydney",
      contentPack: "vintage",
    });
  });

  it("forces a new day, resets the town after a snapshot, and rolls back", async () => {
    h = await startServer();
    const p = await new TestPlayer(h, "alice").signUp();
    await p.enter();
    const forced = await admin<{ day: number; daysRun: number }>(
      "POST",
      "/admin/towns/main/new-day",
    );
    expect(forced.body).toMatchObject({ day: 2, daysRun: 1 });

    const snap = await admin<{ id: number }>("POST", "/admin/towns/main/snapshots", {
      reason: "before reset",
    });
    expect(snap.status).toBe(201);

    expect((await admin("POST", "/admin/towns/main/reset", { confirm: "wrong" })).status).toBe(400);
    const reset = await admin<{ day: number; players: { registered: number } }>(
      "POST",
      "/admin/towns/main/reset",
      {
        confirm: "main",
      },
    );
    expect(reset.body).toMatchObject({ day: 1, players: { registered: 0 } });
    // The old account is intact but its parlor is gone, so it can start again.
    expect((await p.request("GET", "/api/me")).body).toMatchObject({ parlors: [] });
    expect((await p.act({ type: "exit" })).body).toMatchObject({ error: "not_in_game" });
    await p.enter("main", { name: "Alice Again", parlor: "Again Rest", male: false });

    const back = await admin<{ day: number; players: { registered: number } }>(
      "POST",
      "/admin/towns/main/rollback",
      {
        snapshotId: snap.body.id,
      },
    );
    expect(back.body).toMatchObject({ day: 2, players: { registered: 1 } });
    expect((await admin("POST", "/admin/towns/main/rollback", { snapshotId: 99999 })).status).toBe(
      404,
    );
    // Slot 0 is Alice's again in the restored state, and her account still owns that slot.
    const me = await p.request<{ parlors: { name: string }[] }>("GET", "/api/me");
    expect(me.body.parlors.map((x) => x.name)).toEqual(["alice"]);
    const snaps = await admin<{ snapshots: { reason: string }[] }>(
      "GET",
      "/admin/towns/main/snapshots",
    );
    expect(snaps.body.snapshots.map((s) => s.reason)).toEqual(
      expect.arrayContaining(["admin:before reset", "pre-reset:admin", "pre-rollback"]),
    );
  });
});

describe("players, accounts and bans", () => {
  it("lists, edits, kicks and deletes players", async () => {
    h = await startServer({ listen: true });
    const a = await new TestPlayer(h, "alice").signUp();
    const b = await new TestPlayer(h, "bobby", "bob long password", "10.0.0.2").signUp();
    await a.enter();
    await b.enter();
    const aSocket = await connectSocket(h, a.token);

    const list = await admin<{
      total: number;
      players: { id: number; name: string; online: boolean; accountId: number }[];
    }>("GET", "/admin/towns/main/players");
    expect(list.body.total).toBe(2);
    expect(list.body.players[0]).toMatchObject({
      name: "alice",
      online: true,
      accountId: a.accountId,
    });
    const found = await admin<{ total: number }>("GET", "/admin/towns/main/players?search=BOB");
    expect(found.body.total).toBe(1);

    const detail = await admin<{ money: number; mailWaiting: number }>(
      "GET",
      "/admin/towns/main/players/0",
    );
    expect(detail.body).toHaveProperty("mailWaiting");

    const edit = await admin<{ money: number; bp: number }>(
      "PATCH",
      "/admin/towns/main/players/0",
      {
        money: 99999,
        bp: 500,
        luck: 77,
        tags: [1, 2, 3],
        custom: { "5": 9 },
        parlor: "Rebuilt Chapel",
      },
    );
    expect(edit.status).toBe(200);
    const player = h.server.host.get("main")?.snapshotState.players[0];
    expect(player).toMatchObject({
      money: 99999,
      bp: 500,
      luck: 77,
      tags: [1, 2, 3],
      parlor: "Rebuilt Chapel",
    });
    expect(player?.custom[5]).toBe(9);

    for (const bad of [
      { luck: 500 },
      { name: "bobby" }, // taken
      { name: "bad`name" }, // would inject colour codes
      { logon: "someone-else" }, // identity is not editable
      { custom: { "9999": 1 } },
      { bp: "lots" },
    ]) {
      const r = await admin("PATCH", "/admin/towns/main/players/0", bad);
      expect([400, 409], JSON.stringify(bad)).toContain(r.status);
    }
    expect((await admin("GET", "/admin/towns/main/players/77")).status).toBe(404);

    const kick = await admin("POST", "/admin/towns/main/players/0/kick");
    expect(kick.body).toMatchObject({ kicked: true });
    expect(await aSocket.waitClosed()).toBe(4000);
    expect((await a.act({ type: "exit" })).body).toMatchObject({ error: "not_in_game" });
    expect((await a.request("POST", "/api/towns/main/enter", {})).status).toBe(200); // may come back

    const del = await admin("DELETE", "/admin/towns/main/players/1");
    expect(del.status).toBe(204);
    expect((await b.request("POST", "/api/towns/main/enter", {})).status).toBe(409);
    expect(h.server.host.get("main")?.info().players.registered).toBe(1);
    // The freed account can make a new parlor.
    await b.enter("main", { name: "Bobby Two", parlor: "Second Try", male: true });
  });

  it("bans and unbans accounts", async () => {
    h = await startServer({ listen: true });
    const a = await new TestPlayer(h, "alice").signUp();
    await a.enter();
    const s = await connectSocket(h, a.token);
    const ban = await admin("POST", `/admin/accounts/${a.accountId}/ban`, { reason: "cheating" });
    expect(ban.status).toBe(200);
    expect(h.server.host.get("main")?.snapshotState.sessions).toEqual({});
    await s.waitClosed();
    expect((await a.request("GET", "/api/me")).status).toBe(401);
    const login = await a.request("POST", "/api/auth/login", {
      login: "alice",
      password: a.password,
    });
    expect(login.status).toBe(403);
    const accounts = await admin<{ accounts: { login: string; banned: boolean }[] }>(
      "GET",
      "/admin/accounts?search=ali",
    );
    expect(accounts.body.accounts[0]).toMatchObject({ login: "alice", banned: true });
    await admin("POST", `/admin/accounts/${a.accountId}/unban`);
    expect(
      (await a.request("POST", "/api/auth/login", { login: "alice", password: a.password })).status,
    ).toBe(200);
  });

  it("bans address prefixes without substring mistakes, and unbans them", async () => {
    h = await startServer();
    expect((await admin("POST", "/admin/bans", { prefix: "not an ip", reason: "x" })).status).toBe(
      422,
    );
    expect((await admin("POST", "/admin/bans", { prefix: "999.1.1", reason: "x" })).status).toBe(
      422,
    );
    const a = await admin<{ ban: { id: number } }>("POST", "/admin/bans", {
      prefix: "10.1.1",
      reason: "spam",
    });
    const b = await admin<{ ban: { id: number } }>("POST", "/admin/bans", {
      prefix: "2001:db8::/32",
      reason: "v6",
    });
    const c = await admin("POST", "/admin/bans", {
      prefix: "192.0.2.5",
      reason: "single",
      expiresInHours: 1,
    });
    expect([a.status, b.status, c.status]).toEqual([201, 201, 201]);
    const try_ = (ip: string) =>
      h
        ?.inject({
          method: "POST",
          url: "/api/auth/guest",
          remoteAddress: ip,
          headers: { "content-type": "application/json" },
          payload: "{}",
        })
        .then((r) => r.statusCode);
    expect(await try_("10.1.1.77")).toBe(403);
    expect(await try_("210.1.1.77")).toBe(201);
    expect(await try_("10.1.100.1")).toBe(201);
    expect(await try_("2001:db8:1::5")).toBe(403);
    expect(await try_("2001:db9::5")).toBe(201);
    expect(await try_("192.0.2.5")).toBe(403);
    h.clock.jump(2 * 3_600_000); // the temporary ban expires
    expect(await try_("192.0.2.5")).toBe(201);
    expect((await admin("DELETE", `/admin/bans/${a.body.ban.id}`)).status).toBe(204);
    expect(await try_("10.1.1.77")).toBe(201);
    expect((await admin("DELETE", "/admin/bans/9999")).status).toBe(404);
  });

  it("deletes an account together with its parlors", async () => {
    h = await startServer();
    const a = await new TestPlayer(h, "alice").signUp();
    await a.enter();
    expect((await admin("DELETE", `/admin/accounts/${a.accountId}`)).status).toBe(204);
    expect(h.server.host.get("main")?.info().players.registered).toBe(0);
    expect((await a.request("GET", "/api/me")).status).toBe(401);
    expect((await admin("GET", `/admin/accounts/${a.accountId}`)).status).toBe(404);
  });
});

describe("the audit log", () => {
  it("records actions, effects and admin changes, and cannot be altered", async () => {
    h = await startServer();
    const a = await new TestPlayer(h, "alice").signUp();
    await a.enter();
    await a.press("go:desk");
    await admin("PATCH", "/admin/towns/main/settings", { turnsPerDay: 9 });
    const all = await admin<{
      entries: { id: number; kind: string; playerId: number | null; accountId: number | null }[];
    }>("GET", "/admin/audit?townId=main&limit=100");
    const kinds = all.body.entries.map((e) => e.kind);
    expect(kinds).toEqual(
      expect.arrayContaining([
        "parlor:create",
        "action",
        "admin:settings",
        "state:settings",
        "effect:playerCreated",
      ]),
    );
    const action = all.body.entries.find((e) => e.kind === "action");
    expect(action).toMatchObject({ playerId: 0, accountId: a.accountId });
    const page = await admin<{ entries: unknown[]; next: number | null }>(
      "GET",
      "/admin/audit?limit=2",
    );
    expect(page.body.entries).toHaveLength(2);
    expect(page.body.next).not.toBeNull();
    expect((await admin("GET", "/admin/audit?limit=100000")).status).toBe(400);

    expect(() => h?.server.db.exec("UPDATE audit_log SET kind = 'x'")).toThrow(/append-only/);
    expect(() => h?.server.db.exec("DELETE FROM audit_log")).toThrow(/append-only/);
  });
});

describe("housekeeping", () => {
  it("prunes old audit rows only through the retention window", async () => {
    h = await startServer({ config: { auditRetentionDays: 30 } });
    const a = await new TestPlayer(h, "alice").signUp();
    await a.enter();
    const db = h.server.db;
    const count = () =>
      (db.prepare("SELECT count(*) AS n FROM audit_log").get() as { n: number }).n;
    const before = count();
    expect(before).toBeGreaterThan(0);
    // Rows are not deletable directly, whatever their age.
    h.clock.jump(60 * 86_400_000);
    expect(() => h?.server.db.exec("DELETE FROM audit_log")).toThrow(/append-only/);
    await a.logIn();
    await a.enter(); // new rows, dated "now"
    const oldest = () =>
      (db.prepare("SELECT min(at) AS at FROM audit_log").get() as { at: number }).at;
    const cutoff = h.clock.now() - 30 * 86_400_000;
    expect(oldest()).toBeLessThan(cutoff);
    // The hourly housekeeping applies the retention window.
    await h.clock.advance(3_600_000);
    expect(oldest()).toBeGreaterThanOrEqual(cutoff);
    expect(count()).toBeGreaterThan(0);
    expect(h.server.host.audit.prune(0, 10)).toBe(0);
  });

  it("removes guest accounts that never played and keeps those that did", async () => {
    h = await startServer({
      towns: [{ id: "main", seed: 1, settings: { maintDelete: false, inactiveDays: 9999 } }],
      config: { idleTimeoutMinutes: 10_080 },
    });
    const idle = await new TestPlayer(h, "x").request<{ token: string }>(
      "POST",
      "/api/auth/guest",
      {},
    );
    const player = await new TestPlayer(h, "x").request<{
      token: string;
      account: { login: string };
    }>("POST", "/api/auth/guest", {});
    const g = new TestPlayer(h, player.body.account.login);
    g.token = player.body.token;
    await g.enter("main", { name: "Guesty", parlor: "Guest Parlor", male: true });
    expect(idle.status).toBe(201);
    const db = h.server.db;
    const guests = () =>
      (
        db.prepare("SELECT count(*) AS n FROM accounts WHERE is_guest = 1").get() as {
          n: number;
        }
      ).n;
    expect(guests()).toBe(2);
    await h.clock.advance(8 * 86_400_000);
    expect(guests()).toBe(1);
  });
});
