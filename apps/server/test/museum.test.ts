import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { View } from "@fq/protocol";
import { afterEach, describe, expect, it } from "vitest";
import { Request } from "../../../packages/legacy-compat/src/commands.js";
import { FlashClient, plain } from "../../../packages/legacy-compat/test/support/flashClient.js";
import { ApiClient } from "../src/client/index.js";
import { FakeClock } from "../src/clock.js";
import type { Notice, ServerMessage } from "../src/wire.js";
import {
  connectSocket,
  type Harness,
  type Socket,
  startServer,
  TestPlayer,
  toDesk,
} from "./support/harness.js";

/**
 * Museum mode: the original Flash client's protocol (`request.xp`) against the real server,
 * through accounts, the town queue and the ordinary commit.
 */

let h: Harness | null = null;
const sockets: Socket[] = [];
const notices = (messages: ServerMessage[]): Notice[] =>
  messages.flatMap((m) => (m.type === "notice" ? [m.notice] : []));
afterEach(async () => {
  for (const s of sockets.splice(0)) s.close();
  await h?.stop();
  h = null;
});

const museum = () => startServer({ config: { legacyClient: true } });
const PASSWORD = "horse battery 42";

/** Sign up in the original client's New User pages and land on the paper. */
async function legacySignUp(flash: FlashClient, logon: string, name: string, parlor: string) {
  await flash.checkLogon();
  await flash.newUser({ logon, password: PASSWORD, name, parlor, email: "none@example.com" });
  if (flash.num("i_sent") !== 5)
    throw new Error(`sign-up refused: ${plain(flash.get("g_st_error"))}`);
}

/** Waits for customers until one sale closes. Returns the number of customers it took. */
async function legacySale(flash: FlashClient): Promise<void> {
  for (let customers = 0; customers < 40; customers++) {
    // Wait for a customer; events and risks show one Continue button.
    for (let i = 0; i < 20 && flash.get("st_option_a") === ""; i++) {
      await flash.command(Request.waitForCustomer);
      if (flash.get("st_option_a") === "" && flash.buttons().length > 0) await flash.click("3");
    }
    if (flash.get("st_option_a") === "") continue;
    await flash.click("0"); // Sympathy
    if (flash.get("st_option_a") !== "") await flash.click("2"); // Soft Sell
    if (flash.get("st_option_a") !== "") await flash.click("3"); // Done
    if (plain(flash.get("st_main")).includes("The service is a success")) return;
    if (flash.buttons().length === 1) await flash.click("3");
  }
  throw new Error("no sale closed in 40 customers");
}

describe("museum mode is off by default", () => {
  it("answers 404 for /museum, says so in /api/features, and serves nothing from legacy/", async () => {
    h = await startServer();
    for (const url of ["/museum/", "/museum/request.xp?checklogon", "/museum/flash/welcome.swf"]) {
      const res = await h.inject({ method: "GET", url });
      expect(res.statusCode, url).toBe(404);
    }
    const features = await h.inject({ method: "GET", url: "/api/features" });
    expect(features.statusCode).toBe(200);
    expect(features.json()).toEqual({
      museum: {
        enabled: false,
        path: "/museum/",
        available: false,
        reason: "Museum mode is off on this server.",
      },
      dailyChallenge: { enabled: true },
      safety: expect.objectContaining({ reports: true, blocks: true, accountDeletion: true }),
    });
    // The client directory's single-page fallback must not answer for /museum either.
    for (const url of ["/flash/welcome.swf", "/request.xp?checklogon", "/ruffle/ruffle.js"]) {
      expect((await h.inject({ method: "GET", url })).statusCode, url).toBe(404);
    }
  });

  it("does not fall back to the web client's page below /museum", async () => {
    const { mkdtempSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const clientDir = mkdtempSync(join(tmpdir(), "fq-client-"));
    writeFileSync(join(clientDir, "index.html"), "<!doctype html><title>shell</title>");
    h = await startServer({ config: { clientDir } });
    const res = await h.inject({ method: "GET", url: "/museum/" });
    expect(res.statusCode).toBe(404);
    expect(res.body).not.toContain("shell");
  });

  it("is also off when the flag is spelled false", async () => {
    h = await startServer({ config: { legacyClient: false } });
    expect((await h.inject({ method: "GET", url: "/museum/" })).statusCode).toBe(404);
  });
});

describe("museum mode is on", () => {
  it("says so in /api/features, and the typed client reads it", async () => {
    h = await startServer({ config: { legacyClient: true }, listen: true });
    const api = new ApiClient({ baseUrl: h.baseUrl() });
    expect(await api.features()).toEqual({
      museum: { enabled: true, path: "/museum/", available: true, reason: null },
      dailyChallenge: { enabled: true },
      safety: expect.objectContaining({ reports: true, blocks: true, accountDeletion: true }),
    });
  });

  it("serves the Ruffle page and files from legacy/, read only", async () => {
    h = await museum();
    const page = await h.inject({ method: "GET", url: "/museum/" });
    expect(page.statusCode).toBe(200);
    expect(page.headers["content-type"]).toContain("text/html");
    expect(page.body).toContain("ruffle/ruffle.js");
    expect(page.body).toContain('<base href="/museum/">');

    const swf = await h.inject({ method: "GET", url: "/museum/flash/welcome.swf" });
    expect(swf.statusCode).toBe(200);
    expect(swf.rawPayload.subarray(0, 3).toString("latin1")).toMatch(/^[FCZ]WS$/);

    const ruffle = await h.inject({ method: "GET", url: "/museum/ruffle/ruffle.js" });
    expect(ruffle.statusCode).toBe(200);

    expect((await h.inject({ method: "POST", url: "/museum/flash/welcome.swf" })).statusCode).toBe(
      404,
    );
    expect(
      (await h.inject({ method: "GET", url: "/museum/flash/%2e%2e/%2e%2e/README.md" })).statusCode,
    ).toBe(404);
    // The files are only reachable below /museum.
    expect((await h.inject({ method: "GET", url: "/flash/welcome.swf" })).statusCode).toBe(404);
  });

  it("refuses to start when the museum's files are missing", async () => {
    const dir = resolve(import.meta.dirname, "does-not-exist");
    expect(existsSync(dir)).toBe(false);
    await expect(startServer({ config: { legacyClient: true, museumDir: dir } })).rejects.toThrow(
      /Museum mode is on but/,
    );
  });

  it("drives request.xp through sign-up, a sale and a quit", async () => {
    h = await museum();
    const flash = new FlashClient(h.server.app, "/museum");

    // The log-on screen.
    await flash.checkLogon();
    expect(flash.num("i_sent")).toBe(1);

    // Bad input is turned back by the server's own rules, before any parlor is made.
    await flash.newUser({
      logon: "bad name!",
      password: PASSWORD,
      name: "Lou Legacy",
      parlor: "Lou and Sons",
      email: "lou@example.com",
    });
    expect(flash.num("i_sent")).toBe(3);
    expect(plain(flash.get("g_st_error"))).toContain("3 to 20 letters");
    await flash.newUser({
      logon: "lou",
      password: "short",
      name: "Lou Legacy",
      parlor: "Lou and Sons",
      email: "lou@example.com",
    });
    expect(flash.num("i_sent")).toBe(3);
    expect(plain(flash.get("g_st_error"))).toContain("8 to 20");
    expect(h.server.accounts.findByLogin("lou")).toBeUndefined();

    // Sign-up: the account, the engine's player and the parlor link all exist afterwards.
    await legacySignUp(flash, "lou", "Lou Legacy", "Lou and Sons");
    expect(flash.num("i_sent")).toBe(5);
    expect(flash.get("st_date")).toBe("Day 1");
    const account = h.server.accounts.findByLogin("lou");
    expect(account).toBeDefined();
    const town = h.server.host.get("main");
    const playerId = town?.parlorPlayerId(account as NonNullable<typeof account>);
    expect(playerId).not.toBeNull();
    const player = town?.snapshotState.players[playerId as number];
    expect(player).toMatchObject({ logon: "lou", name: "Lou Legacy", parlor: "Lou and Sons" });
    expect(town?.snapshotState.sessions[String(playerId)]).toBeDefined();

    // Into the parlor and a sale.
    await flash.command(Request.main);
    await legacySale(flash);
    const afterSale = town?.snapshotState.players[playerId as number];
    expect(afterSale?.bp).toBeGreaterThan(0);

    // The rows of the audit log say it went through the ordinary commit.
    const audit = h.server.host.audit.query({ townId: "main", kind: "legacy", limit: 5 });
    expect(audit.length).toBeGreaterThan(0);

    // Quit: the engine logs the player off.
    await flash.command(Request.quit);
    expect(flash.num("i_sent")).toBe(1);
    expect(town?.snapshotState.sessions[String(playerId)]).toBeUndefined();

    // Back in with the password; a wrong one is refused.
    await flash.checkLogon();
    await flash.logon("lou", PASSWORD);
    expect(flash.num("i_sent")).toBe(5);
    await flash.checkLogon();
    await flash.logon("lou", "wrong password");
    expect(flash.num("i_sent")).toBe(2);
    // The same account works in the modern client, on the same parlor.
    const modern = new TestPlayer(h, "lou", PASSWORD);
    await modern.logIn();
    const me = await modern.request<{ parlors: { name: string; playerId: number }[] }>(
      "GET",
      "/api/me",
    );
    expect(me.body.parlors).toHaveLength(1);
    expect(me.body.parlors[0]).toMatchObject({ name: "Lou Legacy", playerId });
    const view = await modern.enter();
    expect(view.scene).toBeDefined();
  });

  it("shows a legacy player and a modern player to each other in the rankings", async () => {
    h = await museum();
    const flash = new FlashClient(h.server.app, "/museum");
    await legacySignUp(flash, "legacylou", "Legacy Lou", "Lou and Sons");
    expect(flash.num("i_sent")).toBe(5);

    const modern = new TestPlayer(h, "modernmo", PASSWORD);
    await modern.signUp();
    let seen = await modern.enter("main", { name: "Modern Mo", parlor: "Mo Rest", male: false });
    for (let i = 0; i < 4 && !seen.buttons.some((b) => b.id === "go:rankings"); i++) {
      const next = seen.buttons.find((b) => /desk|continue/i.test(b.id)) ?? seen.buttons[0];
      seen = await modern.press((next as { id: string }).id);
    }

    // The legacy player's rankings show the modern player.
    await flash.command(Request.main);
    if (flash.buttons().length === 1) await flash.click("3");
    await flash.command(Request.ranking);
    expect([9, 10]).toContain(flash.num("i_sent"));
    const legacyRows = plain(flash.get("st_news"));
    expect(legacyRows).toContain("Modern Mo");
    expect(legacyRows).toContain("Legacy Lou");

    // The modern player's rankings show the legacy player.
    const ranking = await modern.act({ type: "press", buttonId: "go:rankings" });
    expect(ranking.status, JSON.stringify(ranking.body).slice(0, 300)).toBe(200);
    const modernView = ranking.body.view as View;
    expect(modernView.scene).toBe("rankings");
    const names = (modernView.rankings ?? []).map((r) => r.name);
    expect(names).toContain("Legacy Lou");
    expect(names).toContain("Modern Mo");

    // And the public town listing agrees; both count as online.
    const towns = await modern.request<{
      towns: { rankings: { name: string }[]; lobby: { online: number } }[];
    }>("GET", "/api/towns");
    expect(towns.body.towns[0]?.rankings.map((r) => r.name)).toEqual(
      expect.arrayContaining(["Legacy Lou", "Modern Mo"]),
    );
    expect(towns.body.towns[0]?.lobby.online).toBe(2);
  });

  it("carries cafe lines both ways between the clients", async () => {
    h = await startServer({ config: { legacyClient: true }, listen: true });
    const flash = new FlashClient(h.server.app, "/museum");
    await legacySignUp(flash, "cafelou", "Cafe Lou", "Lou Rest");
    await flash.command(Request.main);
    if (flash.buttons().length === 1) await flash.click("3");
    await flash.command(Request.map);
    await flash.command(Request.chatStart);
    expect(flash.get("st_object")).toBe("i_chat");

    const modern = new TestPlayer(h, "cafemo", PASSWORD);
    await modern.signUp();
    await modern.enter("main", { name: "Cafe Mo", parlor: "Mo Rest", male: false });
    await toDesk(modern);
    await modern.press("go:map");
    const visit = await modern.act({ type: "visit", placeId: "cafe" });
    expect(visit.status, JSON.stringify(visit.body).slice(0, 200)).toBe(200);
    expect(visit.body.view.scene).toBe("cafe");
    const socket = await connectSocket(h, modern.token);
    sockets.push(socket);

    // Modern to legacy: the line waits in the bridge's inbox for the next poll.
    const said = await modern.act({ type: "chat", text: "hello from the web" });
    expect(said.status).toBe(200);
    await flash.command(Request.chatUpdate, { input: "" });
    expect(plain(flash.get("st_message"))).toContain("Cafe Mo: hello from the web");

    // Legacy to modern: the web player's socket is sent the line.
    await flash.command(Request.chatUpdate, { input: "hello from the museum" });
    await socket.until((m) => notices(m).some((n) => n.kind === "chat"));
    const line = notices(socket.messages).find((n) => n.kind === "chat");
    expect(JSON.stringify(line)).toContain("hello from the museum");
  });

  it("shows notices with the town's local time in front, as the original server did", async () => {
    // show_time (std_all.cpp:328-347): 12:00 UTC on 2030-01-01 is 7:00 AM in New York.
    h = await startServer({
      config: { legacyClient: true },
      clock: new FakeClock(Date.UTC(2030, 0, 1, 12, 0, 0)),
      towns: [{ id: "main", name: "Dead Calm", seed: 1234, timeZone: "America/New_York" }],
    });
    const flash = new FlashClient(h.server.app, "/museum");
    await legacySignUp(flash, "timelou", "Time Lou", "Lou Rest");
    await flash.command(Request.main);
    if (flash.buttons().length === 1) await flash.click("3");
    await h.clock.advance(5 * 60_000);
    const modern = new TestPlayer(h, "timemo", PASSWORD);
    await modern.signUp();
    await modern.enter("main", { name: "Time Mo", parlor: "Mo Rest", male: false });
    // Back at the desk, the newcomer's notice is read from the queue.
    await flash.command(Request.map);
    await flash.command(Request.main);
    expect(plain(flash.get("st_main"))).toContain("7:05 AM:Time Mo has just moved into town!");
    expect(plain(flash.get("st_main"))).not.toMatch(/(^|\n)Time Mo has just/);
  });

  it("takes an existing account with no parlor, and refuses a wrong password or a second parlor", async () => {
    h = await museum();
    const modern = new TestPlayer(h, "sally", PASSWORD);
    await modern.signUp();
    const flash = new FlashClient(h.server.app, "/museum");

    await flash.checkLogon();
    await flash.newUser({
      logon: "sally",
      password: "not the password",
      name: "Sally Legacy",
      parlor: "Sally and Co",
      email: "s@example.com",
    });
    expect(flash.num("i_sent")).toBe(3);
    expect(plain(flash.get("g_st_error"))).toContain("different password");

    await flash.newUser({
      logon: "sally",
      password: PASSWORD,
      name: "Sally Legacy",
      parlor: "Sally and Co",
      email: "s@example.com",
    });
    expect(flash.num("i_sent")).toBe(5);

    // She now holds the parlor the modern client sees.
    const me = await modern.request<{ parlors: { name: string }[] }>("GET", "/api/me");
    expect(me.body.parlors.map((p) => p.name)).toEqual(["Sally Legacy"]);

    await flash.command(Request.quit);
    await flash.checkLogon();
    await flash.newUser({
      logon: "sally",
      password: PASSWORD,
      name: "Sally Again",
      parlor: "Sally and Co",
      email: "s@example.com",
    });
    expect(flash.num("i_sent")).toBe(3);
    expect(plain(flash.get("g_st_error"))).toContain("already has a parlor");
  });

  it("locks a name after repeated wrong passwords, like the web log-in", async () => {
    h = await museum();
    const flash = new FlashClient(h.server.app, "/museum");
    await legacySignUp(flash, "locky", "Locky Lou", "Locky Rest");
    await flash.command(Request.quit);
    for (let i = 0; i < 10; i++) {
      await flash.checkLogon();
      await flash.logon("locky", `wrong password ${i}`);
      expect(flash.num("i_sent")).toBe(2);
    }
    await flash.checkLogon();
    await flash.logon("locky", PASSWORD);
    expect(flash.num("i_sent")).toBe(2);
    const web = await h.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { login: "locky", password: PASSWORD },
    });
    expect(web.statusCode).toBe(429);
  });

  it("joins the town named by legacyTown", async () => {
    h = await startServer({
      config: { legacyClient: true, legacyTown: "second" },
      towns: [
        { id: "main", seed: 1 },
        { id: "second", seed: 2 },
      ],
    });
    const flash = new FlashClient(h.server.app, "/museum");
    await legacySignUp(flash, "twotown", "Two Town", "Two Rest");
    expect(flash.num("i_sent")).toBe(5);
    expect(h.server.host.get("second")?.snapshotState.players.map((p) => p.logon)).toContain(
      "twotown",
    );
    expect(h.server.host.get("main")?.snapshotState.players).toHaveLength(0);
  });

  it("fails at start-up when legacyTown names no town", async () => {
    await expect(
      startServer({ config: { legacyClient: true, legacyTown: "nowhere" } }),
    ).rejects.toThrow(/no town "nowhere"/);
  });
});
