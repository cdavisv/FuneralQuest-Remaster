import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { loadAssets } from "../src/assets.js";
import { LegacyBridge } from "../src/bridge.js";
import { createDevHost } from "../src/devHost.js";
import { legacyCompat, REPO_ROOT } from "../src/plugin.js";
import { FlashClient } from "./support/flashClient.js";

const LEGACY = resolve(REPO_ROOT, "legacy/dist/public");

describe("the Fastify plugin", () => {
  it("is off by default: it registers nothing", async () => {
    const host = await createDevHost({ seed: 1, rivals: 0 });
    const app = Fastify();
    await app.register(legacyCompat, { host });
    expect((await app.inject("/request.xp?checklogon")).statusCode).toBe(404);
    expect((await app.inject("/")).statusCode).toBe(404);
    expect((await app.inject("/flash/welcome.swf")).statusCode).toBe(404);
    await app.close();
  });

  it("serves the Ruffle page, Ruffle itself and the original files, read only", async () => {
    const host = await createDevHost({ seed: 1, rivals: 0 });
    const app = Fastify();
    await app.register(legacyCompat, { host, enabled: true });
    const page = await app.inject("/");
    expect(page.statusCode).toBe(200);
    expect(page.headers["content-type"]).toContain("text/html");
    expect(page.body).toContain('src="ruffle/ruffle.js"');
    expect(page.body).toContain("flash/welcome.swf");
    // Self-hosted: nothing is fetched from another origin.
    expect(page.body).not.toMatch(/https?:\/\//);

    const ruffle = await app.inject("/ruffle/ruffle.js");
    expect(ruffle.statusCode).toBe(200);

    const swf = await app.inject("/flash/welcome.swf");
    expect(swf.statusCode).toBe(200);
    expect(Number(swf.headers["content-length"])).toBe(
      statSync(resolve(LEGACY, "flash/welcome.swf")).size,
    );
    expect(swf.rawPayload.equals(readFileSync(resolve(LEGACY, "flash/welcome.swf")))).toBe(true);
    expect((await app.inject("/home.html")).statusCode).toBe(200);
    expect((await app.inject("/pages/intro.htm")).statusCode).toBe(200);

    // Read only, and nothing outside legacy/dist/public.
    expect((await app.inject({ method: "POST", url: "/flash/welcome.swf" })).statusCode).toBe(404);
    expect((await app.inject({ method: "PUT", url: "/flash/welcome.swf" })).statusCode).toBe(404);
    expect((await app.inject("/../sounds/logon.wav")).statusCode).toBe(404);
    expect((await app.inject("/%2e%2e/sounds/logon.wav")).statusCode).toBe(404);
    expect((await app.inject("/flash/../../script/stats.c")).statusCode).toBe(404);
    await app.close();
  });

  it("mounts below a prefix: the page's base, the cookie path and the protocol move with it", async () => {
    const host = await createDevHost({ seed: 1, rivals: 0 });
    const prefixed = Fastify();
    await prefixed.register(legacyCompat, { prefix: "/museum", host, enabled: true });
    const page = await prefixed.inject("/museum/");
    expect(page.body).toContain('<base href="/museum/">');
    const reply = await prefixed.inject("/museum/request.xp?checklogon&key=1");
    expect(reply.statusCode).toBe(200);
    expect(String(reply.headers["set-cookie"])).toContain("Path=/museum");
    expect(reply.body).toContain("i_sent=1&");
    expect((await prefixed.inject("/request.xp?checklogon")).statusCode).toBe(404);
    await prefixed.close();
  });

  it("tells browsers apart by cookie, not by address", async () => {
    const host = await createDevHost({ seed: 5, rivals: 0 });
    const app = Fastify();
    await app.register(legacyCompat, { host, enabled: true });
    const a = new FlashClient(app);
    const b = new FlashClient(app);
    await a.checkLogon();
    await a.newUser({
      logon: "alice",
      password: "pw",
      name: "Alice Ash",
      parlor: "Ash Rest",
      email: "a@b.cc",
    });
    await b.checkLogon();
    await b.newUser({
      logon: "bobby",
      password: "pw",
      name: "Bobby Birch",
      parlor: "Birch Rest",
      email: "b@b.cc",
    });
    // Both are on at once from the same address.
    expect(Object.keys(host.town().sessions)).toHaveLength(2);
    // Alice's cookie does not let Bobby act.
    await a.command(4);
    expect(a.get("st_object")).toBe("m_main");
    await b.command(4);
    expect(b.get("st_object")).toBe("m_main");
    expect(b.get("st_main")).toContain("Bobby Birch");
    expect(a.get("st_main")).toContain("Alice Ash");
    await app.close();
  });
});

describe("sessions", () => {
  it("logs a browser's player off after it has been idle", async () => {
    const host = await createDevHost({ seed: 3, rivals: 0 });
    let now = 1_000;
    const bridge = new LegacyBridge({
      host,
      assets: loadAssets(resolve(REPO_ROOT, "assets/manifest.json")),
      now: () => now,
      idleMs: 60_000,
    });
    const made = await bridge.handle(
      undefined,
      "new&logon=idler&password=pw&password_v=pw&name=Idle+Ivan&f_name=Idle+Rest&b_male=1&email=i%40b.cc",
    );
    expect(made.body).toContain("i_sent=5&");
    expect(Object.keys(host.town().sessions)).toHaveLength(1);
    now += 30_000;
    expect(await bridge.sweep()).toBe(0);
    now += 40_000;
    expect(await bridge.sweep()).toBe(1);
    expect(Object.keys(host.town().sessions)).toHaveLength(0);
    expect(bridge.sessionCount).toBe(0);
    // The same cookie after that is a stranger: the movie is told the link died.
    const late = await bridge.handle(made.token, "command&i_command=4");
    expect(late.body).toContain("i_sent=-1&");
  });

  it("announces the idle time-out to the town, as the original's kick did (user_list.cpp:167), and a quit with the usual line", async () => {
    const host = await createDevHost({ seed: 5, rivals: 0 });
    let now = 1_000;
    const bridge = new LegacyBridge({
      host,
      assets: loadAssets(resolve(REPO_ROOT, "assets/manifest.json")),
      now: () => now,
      idleMs: 60_000,
    });
    await bridge.handle(
      undefined,
      "new&logon=idler&password=pw&password_v=pw&name=Idle+Ivan&f_name=Idle+Rest&b_male=1&email=i%40b.cc",
    );
    now += 70_000;
    await bridge.sweep();
    const said = host.effects.flatMap((e) => (e.kind === "broadcast" ? [e.text] : []));
    expect(said).toContain("Idle Ivan got kicked for inactivity");
  });

  it("serialises overlapping requests", async () => {
    const host = await createDevHost({ seed: 4, rivals: 0 });
    const bridge = new LegacyBridge({
      host,
      assets: loadAssets(resolve(REPO_ROOT, "assets/manifest.json")),
    });
    const made = await bridge.handle(
      undefined,
      "new&logon=twin&password=pw&password_v=pw&name=Twin+Tom&f_name=Twin+Rest&b_male=1&email=t%40b.cc",
    );
    // Five desks and five stat sheets at once: none may fail or interleave.
    await bridge.handle(made.token, "command&i_command=4");
    await bridge.handle(made.token, "command&i_command=4");
    const replies = await Promise.all(
      [3, 12, 3, 12, 3, 12].map((c) => bridge.handle(made.token, `command&i_command=${c}`)),
    );
    for (const r of replies) expect(r.body).not.toContain("i_sent=-1&");
  });
});
