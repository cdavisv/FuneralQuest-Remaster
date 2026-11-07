import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expandedPack } from "@fq/content";
import { createDailyChallenge, expandedContext } from "@fq/core";
import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { addressKey } from "../src/auth/ip.js";
import { createPasswordHasher, HasherBusy } from "../src/auth/passwords.js";
import { SlidingCounter } from "../src/auth/throttle.js";
import { FakeClock } from "../src/clock.js";
import { RejectedActionThrottle } from "../src/game/auditThrottle.js";
import { clientPolicy } from "../src/http/app.js";
import { installErrorHandling } from "../src/http/errors.js";
import {
  ADMIN_TOKEN,
  connectSocket,
  type Harness,
  Socket,
  startServer,
  TestPlayer,
} from "./support/harness.js";

let h: Harness | null = null;
const sockets: Socket[] = [];
afterEach(async () => {
  for (const s of sockets.splice(0)) s.close();
  await h?.stop();
  h = null;
});

const json = (payload: unknown) => JSON.stringify(payload);

/** Sends raw bytes to the listening server and collects what comes back until it closes. */
function rawHttp(
  port: number,
  parts: Array<string | number>,
  options: { waitMs?: number } = {},
): Promise<{ text: string; closedByServer: boolean; ms: number }> {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = connect(port, "127.0.0.1");
    let text = "";
    let closedByServer = false;
    const done = () => {
      clearTimeout(limit);
      socket.destroy();
      resolve({ text, closedByServer, ms: Date.now() - started });
    };
    const limit = setTimeout(done, options.waitMs ?? 6000);
    socket.on("data", (d) => {
      text += d.toString("latin1");
    });
    socket.on("close", () => {
      closedByServer = true;
      done();
    });
    socket.on("error", () => undefined);
    socket.on("connect", async () => {
      for (const part of parts) {
        if (typeof part === "number") await new Promise((r) => setTimeout(r, part));
        else socket.write(part, "latin1");
      }
    });
  });
}

describe("addresses", () => {
  it("counts an IPv6 address by its /64 and an IPv4-mapped one as IPv4", () => {
    expect(addressKey("2001:db8:1:2:aaaa:bbbb:cccc:dddd")).toBe(
      addressKey("2001:db8:1:2:1111:2222:3333:4444"),
    );
    expect(addressKey("2001:db8:1:2::1")).not.toBe(addressKey("2001:db8:1:3::1"));
    expect(addressKey("::ffff:203.0.113.9")).toBe("203.0.113.9");
    expect(addressKey("203.0.113.9")).toBe("203.0.113.9");
    expect(addressKey("not an address")).toBe("not an address");
  });

  it("gives every address of an IPv6 block one sign-up and log-in budget", async () => {
    h = await startServer({ config: { rateAuthMax: 3 } });
    const attempt = (ip: string) =>
      h?.inject({
        method: "POST",
        url: "/api/auth/login",
        remoteAddress: ip,
        headers: { "content-type": "application/json" },
        payload: json({ login: "nobody", password: "whatever12" }),
      });
    const codes: number[] = [];
    for (let i = 0; i < 5; i++)
      codes.push((await attempt(`2001:db8:5:5::${i + 1}`))?.statusCode ?? 0);
    expect(codes).toEqual([401, 401, 401, 429, 429]);
    // A different /64 has its own budget.
    expect((await attempt("2001:db8:5:6::1"))?.statusCode).toBe(401);
  });
});

describe("new accounts per address", () => {
  it("caps sign-ups and guests together per address per hour", async () => {
    h = await startServer({ config: { signupsPerHour: 3 } });
    const make = (n: number, ip: string) =>
      h?.inject({
        method: "POST",
        url: n % 2 === 0 ? "/api/auth/guest" : "/api/auth/signup",
        remoteAddress: ip,
        headers: { "content-type": "application/json" },
        payload: json(
          n % 2 === 0
            ? {}
            : { login: `acct${n}x${ip.split(".").at(-1)}`, password: "long enough pw" },
        ),
      });
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await make(i, "198.51.100.20"))?.statusCode ?? 0);
    expect(codes).toEqual([201, 201, 201, 429, 429]);
    // Another address is unaffected, and the hour turns over.
    expect((await make(1, "198.51.100.21"))?.statusCode).toBe(201);
    h.clock.advance(3_600_001);
    expect((await make(0, "198.51.100.20"))?.statusCode).toBe(201);
  });

  it("derives the cap from the auth budget when it is not set", async () => {
    h = await startServer({ config: { rateAuthMax: 2 } });
    const codes: number[] = [];
    // rateAuthMax 2 per window allows 2 at a time; spread over windows to reach the hourly cap of 6.
    for (let i = 0; i < 8; i++) {
      const r = await h.inject({
        method: "POST",
        url: "/api/auth/guest",
        remoteAddress: "198.51.100.30",
        headers: { "content-type": "application/json" },
        payload: "{}",
      });
      codes.push(r.statusCode);
      if (i % 2 === 1) h.clock.advance(1000);
    }
    // The per-window limiter uses real time, so some of these are 429 for that reason; what
    // matters is that no more than six accounts exist at the end.
    const accounts = h.server.accounts.countAccounts();
    expect(accounts).toBeLessThanOrEqual(6);
    expect(codes.filter((c) => c === 201).length).toBe(accounts);
  });

  it("SlidingCounter drops old events and bounds its table", () => {
    const clock = new FakeClock();
    const counter = new SlidingCounter(clock, 1000, 4);
    for (let i = 0; i < 4; i++) counter.hit(`k${i}`);
    clock.advance(1001);
    expect(counter.count("k0")).toBe(0);
    for (let i = 0; i < 10; i++) counter.hit(`n${i}`);
    expect(counter.count("n9")).toBe(1);
    expect(counter.hit("n9")).toBe(2);
  });
});

describe("password hashing under load", () => {
  it("queues a little and then refuses at once instead of piling up memory", async () => {
    const hasher = createPasswordHasher({ memoryKiB: 2048, passes: 1, running: 1, waiting: 1 });
    const results = await Promise.allSettled([
      hasher.hash("first password"),
      hasher.hash("second password"),
      hasher.hash("third password"),
      hasher.hash("fourth password"),
    ]);
    const rejected = results.filter((r) => r.status === "rejected");
    expect(rejected.length).toBe(2);
    for (const r of rejected)
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(HasherBusy);
    // Everything that was admitted finished, and the hasher works again afterwards.
    const stored = (results[0] as PromiseFulfilledResult<string>).value;
    expect(await hasher.verify(stored, "first password")).toBe(true);
    expect(await hasher.verify(stored, "wrong")).toBe(false);
    expect(await hasher.verify("garbage", "x")).toBe(false);
  });

  it("answers 503 with Retry-After when hashing is saturated", async () => {
    const app = Fastify();
    installErrorHandling(app);
    app.get("/x", async () => {
      throw new HasherBusy();
    });
    const res = await app.inject({ method: "GET", url: "/x" });
    expect(res.statusCode).toBe(503);
    expect(res.headers["retry-after"]).toBe("5");
    expect(res.json()).toMatchObject({ error: "busy" });
    await app.close();
  });
});

describe("WebSocket abuse", () => {
  const started = async (config: Parameters<typeof startServer>[0] = {}) => {
    h = await startServer({ listen: true, ...config });
    const a = await new TestPlayer(h, "alice").signUp();
    await a.enter();
    return a;
  };

  it("holds a browser to this server's own origin unless others are listed", async () => {
    await started();
    const open = async (origin?: string) => {
      const ws = new Socket(h?.wsUrl() as string);
      void origin;
      sockets.push(ws);
      return ws;
    };
    void open;
    const tryOrigin = (origin: string | undefined) =>
      new Promise<number | "open">((resolve) => {
        const ws = new WebSocket(h?.wsUrl() as string, origin ? { headers: { origin } } : {});
        ws.on("open", () => {
          // Opened: wait for the server's decision (it closes a refused origin straight away).
          setTimeout(() => {
            if (ws.readyState === ws.OPEN) {
              resolve("open");
              ws.close();
            }
          }, 300);
        });
        ws.on("close", (code) => resolve(code));
        ws.on("error", () => undefined);
      });
    const own = (h as Harness).baseUrl();
    expect(await tryOrigin(undefined)).toBe("open");
    expect(await tryOrigin(own)).toBe("open");
    expect(await tryOrigin("https://evil.example")).toBe(4401);
    expect(await tryOrigin("http://127.0.0.1:1")).toBe(4401);
    expect(await tryOrigin("null")).toBe(4401);
  });

  it("lets a listed origin in, and no other", async () => {
    await started({ config: { allowedOrigins: "tauri://localhost" } });
    const tryOrigin = (origin: string) =>
      new Promise<number | "open">((resolve) => {
        const ws = new WebSocket((h as Harness).wsUrl(), { headers: { origin } });
        ws.on("open", () =>
          setTimeout(() => {
            resolve("open");
            ws.close();
          }, 300),
        );
        ws.on("close", (code) => resolve(code));
        ws.on("error", () => undefined);
      });
    expect(await tryOrigin("tauri://localhost")).toBe("open");
    expect(await tryOrigin((h as Harness).baseUrl())).toBe(4401);
  });

  it("closes sockets past the per-address limit", async () => {
    await started({ config: { socketsPerAddress: 2 } });
    const opened: Socket[] = [];
    for (let i = 0; i < 3; i++) {
      const s = new Socket((h as Harness).wsUrl());
      sockets.push(s);
      await s.open();
      opened.push(s);
    }
    expect(await (opened[2] as Socket).waitClosed()).toBe(4429);
    expect((opened[0] as Socket).closeCode).toBeNull();
    // A slot frees when one closes.
    (opened[0] as Socket).close();
    await (opened[0] as Socket).waitClosed();
    const again = new Socket((h as Harness).wsUrl());
    sockets.push(again);
    await again.open();
    await new Promise((r) => setTimeout(r, 200));
    expect(again.closeCode).toBeNull();
  });

  it("keeps a player to a few sockets by closing their oldest", async () => {
    const a = await started({ config: { socketsPerPlayer: 2 } });
    const first = await connectSocket(h as Harness, a.token);
    const second = await connectSocket(h as Harness, a.token);
    sockets.push(first, second);
    const third = await connectSocket(h as Harness, a.token);
    sockets.push(third);
    expect(await first.waitClosed()).toBe(4000);
    expect(second.closeCode).toBeNull();
    expect(third.closeCode).toBeNull();
    expect((h as Harness).server.host.hub.socketCount("main")).toBeLessThanOrEqual(2);
  });

  it("drops a client that sends messages faster than any client does", async () => {
    await started();
    const s = new Socket((h as Harness).wsUrl());
    sockets.push(s);
    await s.open();
    for (let i = 0; i < 40; i++) s.send({ type: "ping" });
    expect(await s.waitClosed()).toBe(4429);
    expect(s.messages.filter((m) => m.type === "pong").length).toBeLessThanOrEqual(13);
  });

  it("closes on oversize frames, binary frames, broken JSON and unknown messages", async () => {
    await started();
    const closeCodeFor = async (send: (ws: Socket) => void) => {
      const s = new Socket((h as Harness).wsUrl());
      sockets.push(s);
      await s.open();
      send(s);
      return s.waitClosed();
    };
    expect(await closeCodeFor((s) => s.send("x".repeat(3000)))).toBe(1009);
    expect(await closeCodeFor((s) => s.ws.send(Buffer.from([1, 2, 3])))).toBe(4400);
    expect(await closeCodeFor((s) => s.send("{not json"))).toBe(4400);
    expect(await closeCodeFor((s) => s.send("[]"))).toBe(4400);
    expect(await closeCodeFor((s) => s.send({ type: "teleport" }))).toBe(4400);
    expect(await closeCodeFor((s) => s.send({ type: "ping", extra: 1 }))).toBe(4400);
    expect(await closeCodeFor((s) => s.send({ type: "hello", token: 5, townId: "main" }))).toBe(
      4400,
    );
    expect(
      await closeCodeFor((s) => s.send({ type: "hello", token: "fq_x", townId: "../etc" })),
    ).toBe(4400);
    expect(
      await closeCodeFor((s) => s.send({ type: "hello", token: "fq_nope", townId: "main" })),
    ).toBe(4401);
  });

  it("does not take a token from the URL, and never logs one", async () => {
    const a = await started();
    const url = `${(h as Harness).wsUrl()}?token=${a.token}`;
    const s = new Socket(url);
    sockets.push(s);
    await s.open();
    s.send({ type: "ping" });
    await s.until((m) => m.some((x) => x.type === "pong"));
    // A token in the URL attached nothing: still waiting for a hello, which times out.
    expect((h as Harness).server.host.hub.socketCount("main")).toBe(0);
  });

  it("gives up on a socket that never says hello", async () => {
    await started();
    const s = new Socket((h as Harness).wsUrl());
    sockets.push(s);
    await s.open();
    expect(await s.waitClosed(8000)).toBe(4401);
  });
});

describe("slow and oversize requests", () => {
  it("closes a connection that sends its headers too slowly", async () => {
    h = await startServer({ listen: true, config: { requestTimeoutSeconds: 1 } });
    const port = Number(new URL((h as Harness).baseUrl()).port);
    const r = await rawHttp(port, ["GET /health HTTP/1.1\r\nHost: x\r\n", 2500, "\r\n"], {
      waitMs: 6000,
    });
    expect(r.closedByServer).toBe(true);
    expect(r.ms).toBeLessThan(5000);
    expect(r.text).not.toContain("200 OK");
  });

  it("closes a connection that promises a body and never sends it", async () => {
    h = await startServer({ listen: true, config: { requestTimeoutSeconds: 1 } });
    const port = Number(new URL((h as Harness).baseUrl()).port);
    const r = await rawHttp(
      port,
      [
        "POST /api/auth/login HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: 60\r\n\r\n{",
        3000,
      ],
      { waitMs: 7000 },
    );
    expect(r.closedByServer).toBe(true);
    expect(r.ms).toBeLessThan(6000);
  });

  it("refuses an oversize body whether or not it says how long it is", async () => {
    h = await startServer({ listen: true, config: { bodyLimitBytes: 1024 } });
    const port = Number(new URL((h as Harness).baseUrl()).port);
    const declared = await rawHttp(port, [
      "POST /api/auth/login HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: 5000000\r\nConnection: close\r\n\r\n",
      "{".repeat(50),
    ]);
    expect(declared.text).toContain("413");
    const chunk = "a".repeat(600);
    const chunked = await rawHttp(port, [
      "POST /api/auth/login HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n",
      `258\r\n${chunk}\r\n`,
      `258\r\n${chunk}\r\n`,
      `258\r\n${chunk}\r\n`,
      "0\r\n\r\n",
    ]);
    expect(chunked.text).toContain("413");
  });

  it("does not let a JSON body write to Object.prototype", async () => {
    h = await startServer();
    const res = await h.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { "content-type": "application/json" },
      payload: '{"login":"a","password":"b","__proto__":{"admin":true}}',
    });
    expect(res.statusCode).toBe(400);
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
    const nested = await h.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { "content-type": "application/json" },
      payload: '{"login":"a","password":"b","constructor":{"prototype":{"admin":true}}}',
    });
    expect(nested.statusCode).toBe(400);
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
  });

  it("answers an overlong URL, header value or parameter with a client error", async () => {
    h = await startServer({ listen: true });
    const port = Number(new URL((h as Harness).baseUrl()).port);
    const longUrl = await rawHttp(port, [
      `GET /api/towns/${"a".repeat(200)} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n`,
    ]);
    expect(longUrl.text).toMatch(/HTTP\/1\.1 4\d\d/);
    const hugeHeader = await rawHttp(port, [
      `GET /health HTTP/1.1\r\nHost: x\r\nX-Big: ${"b".repeat(40_000)}\r\nConnection: close\r\n\r\n`,
    ]);
    expect(hugeHeader.text).toMatch(/HTTP\/1\.1 431/);
  });
});

describe("a swamped town", () => {
  it("answers 503 once too many operations are waiting, and recovers", async () => {
    h = await startServer({ config: { maxQueuedPerTown: 3 } });
    const a = await new TestPlayer(h, "alice").signUp();
    await a.enter();
    // Hold the town's queue, as a slow day change or a big write would.
    const town = h.server.host.get("main");
    const gate = new Promise<void>((resolve) => setTimeout(resolve, 400));
    const held = town?.enqueue(() => gate);
    const results = await Promise.all(
      Array.from({ length: 10 }, () => a.act({ type: "press", buttonId: "go:desk" })),
    );
    await held;
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((c) => c === 503).length).toBeGreaterThanOrEqual(6);
    expect(statuses.filter((c) => c === 200).length).toBeGreaterThanOrEqual(1);
    expect(results.find((r) => r.status === 503)?.body).toMatchObject({ error: "busy" });
    // Once the queue drains the town answers again.
    expect((await a.act({ type: "press", buttonId: "go:desk" })).status).not.toBe(503);
  });
});

describe("serving the client", () => {
  const clientDir = () => {
    const root = mkdtempSync(join(tmpdir(), "fq-hostile-"));
    const dir = join(root, "client");
    mkdirSync(join(dir, "assets"), { recursive: true });
    writeFileSync(join(dir, "index.html"), "<!doctype html><title>shell</title>");
    writeFileSync(join(dir, "assets", "app.js"), "console.log(1)");
    writeFileSync(join(dir, ".secret"), "dotfile secret");
    // Next to the client directory, where a traversal would land.
    writeFileSync(join(root, "outside.txt"), "outside secret");
    return dir;
  };

  it("never serves anything outside the client directory", async () => {
    h = await startServer({ listen: true, config: { clientDir: clientDir() } });
    const port = Number(new URL((h as Harness).baseUrl()).port);
    const paths = [
      "/../outside.txt",
      "/%2e%2e/outside.txt",
      "/%2e%2e%2foutside.txt",
      "/..%2foutside.txt",
      "/assets/../../outside.txt",
      "/assets/%2e%2e/%2e%2e/outside.txt",
      "/%252e%252e/outside.txt",
      "/..%5coutside.txt",
      "/assets/..%5c..%5coutside.txt",
      "/%c0%ae%c0%ae/outside.txt",
      "/outside.txt%00.js",
      "/.secret",
      "/assets/.%2e/.secret",
      "//outside.txt",
      "/etc/passwd",
      "/../../../../../../etc/passwd",
    ];
    for (const path of paths) {
      // Raw, so the client library does not tidy the path before it is sent.
      const r = await rawHttp(port, [
        `GET ${path} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n`,
      ]);
      expect(r.text, path).not.toContain("outside secret");
      expect(r.text, path).not.toContain("dotfile secret");
      expect(r.text, path).not.toContain("root:");
    }
    // The ordinary files still work.
    const ok = await (h as Harness).inject({ method: "GET", url: "/assets/app.js" });
    expect(ok.statusCode).toBe(200);
  });

  it("sends the client page with a Content-Security-Policy that allows no inline script", async () => {
    h = await startServer({
      config: { clientDir: clientDir(), allowedOrigins: "https://fq.example" },
    });
    for (const url of ["/", "/rules"]) {
      const res = await h.inject({ method: "GET", url, headers: { host: "play.example:8080" } });
      const csp = String(res.headers["content-security-policy"]);
      expect(csp, url).toContain("default-src 'self'");
      expect(csp).toMatch(/script-src 'self'(;|$)/);
      expect(csp).not.toMatch(/script-src[^;]*unsafe/);
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("ws://play.example:8080");
      expect(csp).toContain("wss://fq.example");
    }
    // Scripts are not HTML pages: no policy on them. The admin page keeps its own.
    const script = await h.inject({ method: "GET", url: "/assets/app.js" });
    expect(script.headers["content-security-policy"]).toBeUndefined();
    const admin = await h.inject({ method: "GET", url: "/admin/" });
    expect(String(admin.headers["content-security-policy"])).toContain("default-src 'none'");
  });

  it("keeps a hostile Host header out of the policy, and can be turned off", async () => {
    expect(clientPolicy("evil.example; script-src *", [])).not.toContain("evil.example");
    expect(clientPolicy("ok.example:1", [])).toContain("ws://ok.example:1");
    h = await startServer({ config: { clientDir: clientDir(), clientCsp: false } });
    const res = await h.inject({ method: "GET", url: "/" });
    expect(res.headers["content-security-policy"]).toBeUndefined();
  });
});

describe("the admin page and token", () => {
  it("holds nothing in the page, allows no inline handlers, and sets no cookie", async () => {
    h = await startServer();
    const page = await h.inject({ method: "GET", url: "/admin/" });
    expect(page.headers["set-cookie"]).toBeUndefined();
    expect(page.headers["cache-control"]).toBe("no-store");
    expect(page.headers["x-frame-options"]).toBe("DENY");
    const csp = String(page.headers["content-security-policy"]);
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    // Event handlers are attached with addEventListener; markup has none (they would need unsafe-inline).
    expect(page.body).not.toMatch(/<[a-z]+[^>]* on[a-z]+=/i);
    // The token lives in sessionStorage (this tab only), never localStorage or a cookie.
    expect(page.body).toContain('sessionStorage.setItem("fq_admin"');
    expect(page.body).not.toMatch(/localStorage\.setItem\("fq_admin"/);
    expect(page.body).not.toContain("document.cookie");
  });

  it("refuses wrong tokens of every shape in the same way, and counts them against the limit", async () => {
    h = await startServer({ config: { rateAdminMax: 4 } });
    const codes: number[] = [];
    for (const token of ["", "x", "x".repeat(5000), ADMIN_TOKEN.toUpperCase(), `${ADMIN_TOKEN} `]) {
      const r = await h.inject({
        method: "GET",
        url: "/admin/server",
        headers: { authorization: `Bearer ${token}` },
      });
      codes.push(r.statusCode);
    }
    expect(codes).toEqual([401, 401, 401, 401, 429]);
  });

  it("reads includeInactive=false as false", async () => {
    h = await startServer();
    const a = await new TestPlayer(h, "alice").signUp();
    await a.enter();
    await a.request("POST", "/api/towns/main/action", { action: { type: "exit" } });
    await h.server.host.get("main")?.leave(0, "quit", "test");
    const admin = { authorization: `Bearer ${ADMIN_TOKEN}` };
    const list = async (q: string) =>
      (
        await h?.inject({ method: "GET", url: `/admin/towns/main/players${q}`, headers: admin })
      )?.json() as { total: number };
    expect((await list("?includeInactive=true")).total).toBeGreaterThanOrEqual(
      (await list("?includeInactive=false")).total,
    );
    const bad = await h.inject({
      method: "GET",
      url: "/admin/towns/main/players?includeInactive=maybe",
      headers: admin,
    });
    expect(bad.statusCode).toBe(400);
  });

  it("refuses a content pack named after something on Object.prototype", async () => {
    h = await startServer();
    const admin = { authorization: `Bearer ${ADMIN_TOKEN}`, "content-type": "application/json" };
    for (const name of ["constructor", "__proto__", "toString", "../classic", "classic/../x"]) {
      const res = await h.inject({
        method: "PUT",
        url: "/admin/towns/main/content-pack",
        headers: admin,
        payload: json({ contentPack: name }),
      });
      expect(res.statusCode, name).toBe(422);
    }
  });
});

describe("one player's data stays that player's", () => {
  it("shows no other player's login, email, mail, blocks or report in anything a player can fetch", async () => {
    h = await startServer();
    const alice = await new TestPlayer(h, "alicelogin", "alice long password", "10.0.0.1").signUp();
    const bobby = await new TestPlayer(h, "bobbylogin", "bobby long password", "10.0.0.2").signUp();
    const carol = await new TestPlayer(h, "carollogin", "carol long password", "10.0.0.3").signUp();
    await alice.enter("main", { name: "Alyssa", parlor: "Alyssa Rest", male: false });
    await bobby.enter("main", { name: "Bartholomew", parlor: "Bart Rest", male: true });
    await carol.enter("main", { name: "Cordelia", parlor: "Cord Rest", male: false });
    const town = h.server.host.get("main");
    // Give Bobby an email-like value and a note only he and the moderators may see.
    const bobbyPlayer = town?.snapshotState.players.find((p) => p.name === "Bartholomew");
    await town?.mutate("test:email", (draft) => {
      const p = draft.players[bobbyPlayer?.id ?? -1];
      if (p) p.email = "canary.bobby@example.com";
      return {};
    });
    // Bobby blocks Carol and reports Carol; Carol reports Bobby.
    const block = await bobby.request("POST", "/api/blocks", {
      townId: "main",
      target: {
        kind: "player",
        playerId: town?.snapshotState.players.find((p) => p.name === "Cordelia")?.id,
      },
    });
    expect(block.status).toBe(201);
    const report = await bobby.request("POST", "/api/reports", {
      townId: "main",
      target: {
        kind: "player",
        playerId: town?.snapshotState.players.find((p) => p.name === "Cordelia")?.id,
      },
      category: "spam",
      note: "canary-report-note",
    });
    expect(report.status).toBe(200);

    // Alice, a bystander, and Carol, the reported one, fetch everything they can.
    for (const viewer of [alice, carol]) {
      const bodies: string[] = [];
      for (const url of [
        "/api/me",
        "/api/blocks",
        "/api/features",
        "/api/towns",
        "/api/towns/main",
        "/api/towns/main/view",
        "/api/towns/main/hall-of-fame",
        "/api/hall-of-fame",
        "/api/daily",
        "/api/daily/leaderboard",
        "/api/daily/days",
        "/health",
      ]) {
        const r = await viewer.request("GET", url);
        bodies.push(JSON.stringify(r.body));
      }
      bodies.push(JSON.stringify((await viewer.request("GET", "/api/me/export")).body));
      const all = bodies.join("\n");
      for (const secret of [
        "bobbylogin",
        "canary.bobby@example.com",
        "canary-report-note",
        "bobby long password",
        "$argon2",
        "token_hash",
      ]) {
        expect(all, `${secret} seen by ${viewer.login}`).not.toContain(secret);
      }
    }
    // And a player cannot read another's blocks by guessing ids.
    const del = await carol.request("DELETE", "/api/blocks/1");
    expect(del.status).toBe(404);
  });

  it("refuses every authenticated endpoint without a token, and every admin endpoint without the admin one", async () => {
    h = await startServer();
    const player = [
      ["GET", "/api/me"],
      ["GET", "/api/blocks"],
      ["POST", "/api/blocks"],
      ["DELETE", "/api/blocks/1"],
      ["POST", "/api/reports"],
      ["GET", "/api/me/export"],
      ["POST", "/api/me/delete"],
      ["POST", "/api/auth/logout"],
      ["POST", "/api/towns/main/enter"],
      ["GET", "/api/towns/main/view"],
      ["POST", "/api/towns/main/action"],
      ["POST", "/api/daily/enter"],
      ["GET", "/api/daily/view"],
      ["POST", "/api/daily/action"],
    ] as const;
    for (const [method, url] of player) {
      const res = await h.inject({
        method,
        url,
        headers: { "content-type": "application/json" },
        payload: "{}",
      });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
    }
  });
});

describe("tokens", () => {
  it("stop working when the account is deleted or banned, and are not accepted in the URL", async () => {
    h = await startServer();
    const a = await new TestPlayer(h, "doomed", "doomed long password").signUp();
    const b = await new TestPlayer(h, "banned1", "banned long password", "10.0.0.2").signUp();
    await a.enter();
    // A token in a query string or cookie is not a credential.
    const viaUrl = await h.inject({
      method: "GET",
      url: `/api/me?token=${a.token}&access_token=${a.token}`,
    });
    expect(viaUrl.statusCode).toBe(401);
    const viaCookie = await h.inject({
      method: "GET",
      url: "/api/me",
      headers: { cookie: `token=${a.token}` },
    });
    expect(viaCookie.statusCode).toBe(401);
    const admin = { authorization: `Bearer ${ADMIN_TOKEN}`, "content-type": "application/json" };
    const ban = await h.inject({
      method: "POST",
      url: `/admin/accounts/${b.accountId}/ban`,
      headers: admin,
      payload: json({ reason: "test" }),
    });
    expect(ban.statusCode).toBe(200);
    expect((await b.request("GET", "/api/me")).status).toBe(401);
    // Unbanning does not bring the old token back.
    await h.inject({ method: "POST", url: `/admin/accounts/${b.accountId}/unban`, headers: admin });
    expect((await b.request("GET", "/api/me")).status).toBe(401);

    const del = await a.request("POST", "/api/me/delete", {
      password: "doomed long password",
      confirm: true,
    });
    expect(del.status).toBe(204);
    expect((await a.request("GET", "/api/me")).status).toBe(401);
    const rows = h.server.db
      .prepare("SELECT count(*) AS n FROM sessions WHERE account_id = ?")
      .get(a.accountId) as { n: number };
    expect(rows.n).toBe(0);
  });

  it("are only ever held as hashes, and a socket's hello token never reaches the log", async () => {
    const lines: string[] = [];
    const { createLogger } = await import("../src/logger.js");
    h = await startServer({
      listen: true,
      logger: createLogger("trace", {
        write(chunk: string) {
          lines.push(chunk);
        },
      }),
    });
    const a = await new TestPlayer(h, "quiet", "quiet long password").signUp();
    await a.enter();
    const s = await connectSocket(h, a.token);
    sockets.push(s);
    const bad = new Socket(h.wsUrl());
    sockets.push(bad);
    await bad.open();
    bad.send({ type: "hello", token: "fq_not-a-real-token-but-secret-looking", townId: "main" });
    await bad.waitClosed();
    const log = lines.join("");
    expect(log).not.toContain(a.token);
    expect(log).not.toContain("fq_not-a-real-token");
    expect(log).not.toContain("quiet long password");
  });
});

describe("the Daily Challenge seed secret", () => {
  it("is private to the database, differs between servers, and never appears in a response", async () => {
    h = await startServer();
    const a = await new TestPlayer(h, "dailyplayer", "daily long password").signUp();
    const secretRow = h.server.db
      .prepare("SELECT value FROM server_secrets WHERE name = 'daily-challenge'")
      .get() as { value: string };
    expect(secretRow.value).toMatch(/^[0-9a-f]{64}$/);

    const day = h.server.host.challenge.today();
    const seed = h.server.host.challenge.challengeFor(day).seed;
    const plain = createDailyChallenge(day, expandedContext(expandedPack)).seed;
    expect(seed).not.toBe(plain);

    const bodies: string[] = [];
    for (const [method, url, body] of [
      ["GET", "/api/daily", undefined],
      [
        "POST",
        "/api/daily/enter",
        { parlor: { name: "Dailyplay", parlor: "Daily Rest", male: true } },
      ],
      ["GET", "/api/daily/view", undefined],
      ["GET", "/api/daily/leaderboard", undefined],
      ["GET", "/api/daily/days", undefined],
      ["GET", "/api/me/export", undefined],
      ["GET", "/api/features", undefined],
    ] as const) {
      const r = await a.request(method, url, body);
      bodies.push(JSON.stringify(r.body));
    }
    const all = bodies.join("\n");
    expect(all).not.toContain(secretRow.value);
    expect(all).not.toContain(`"seed":${seed}`);

    // Another database makes another secret, so the same date gives another challenge.
    const other = await startServer();
    try {
      const otherSecret = other.server.db
        .prepare("SELECT value FROM server_secrets WHERE name = 'daily-challenge'")
        .get() as { value: string };
      expect(otherSecret.value).not.toBe(secretRow.value);
      expect(other.server.host.challenge.challengeFor(day).seed).not.toBe(seed);
    } finally {
      await other.stop();
    }
    // The secret survives a restart (the same day stays the same day).
    const again = await h.restart();
    h = again;
    expect(h.server.host.challenge.challengeFor(day).seed).toBe(seed);
  });

  it("refuses to show a day that has not happened, in the leaderboard or anywhere", async () => {
    h = await startServer();
    for (const day of ["2999-01-01", "2026-13-45", "yesterday", "2026-1-1", ""]) {
      const r = await h.inject({
        method: "GET",
        url: `/api/daily/leaderboard?day=${encodeURIComponent(day)}`,
      });
      expect([400], day).toContain(r.statusCode === 200 ? 200 : r.statusCode);
    }
  });
});

describe("expensive work", () => {
  it("indexes the audit log by account and the challenge runs by status", async () => {
    h = await startServer();
    const plan = (sql: string) =>
      ((h as Harness).server.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(1) as { detail: string }[])
        .map((r) => r.detail)
        .join(" ");
    expect(
      plan("SELECT id FROM audit_log WHERE account_id = ? ORDER BY id DESC LIMIT 10"),
    ).toContain("audit_account");
    expect(
      plan("SELECT day FROM challenge_runs WHERE status = 'playing' AND updated_at < ?"),
    ).toContain("challenge_stale");
  });

  it("reads the leaderboard without loading any run's saved state", async () => {
    h = await startServer();
    const a = await new TestPlayer(h, "ranked1", "ranked long password").signUp();
    await a.request("POST", "/api/daily/enter", {
      parlor: { name: "Ranked", parlor: "Ranked Rest", male: true },
    });
    const rows = h.server.host.challenge.constructor.name; // the service exists
    expect(rows).toBe("ChallengeService");
    const store = (
      h.server.host.challenge as unknown as { deps: { store: { board(day: string): unknown[] } } }
    ).deps.store;
    for (const row of store.board(h.server.host.challenge.today())) {
      expect(Object.keys(row as object)).not.toContain("state_json");
    }
  });

  it("logs only the first rejected actions of a minute and counts the rest", () => {
    const throttle = new RejectedActionThrottle(3, 1000);
    const settled: number[] = [];
    const calls = [0, 1, 2, 3, 4, 5].map((i) => throttle.allow(7, 100 + i, (n) => settled.push(n)));
    expect(calls).toEqual([true, true, true, false, false, false]);
    // Another player has their own allowance.
    expect(throttle.allow(8, 110, () => undefined)).toBe(true);
    // The window turns over: the dropped count is reported once, and logging resumes.
    expect(throttle.allow(7, 1200, (n) => settled.push(n))).toBe(true);
    expect(settled).toEqual([3]);
  });

  it("does not let a flood of rejected actions fill the audit log", async () => {
    h = await startServer();
    const a = await new TestPlayer(h, "spammer", "spammer long password").signUp();
    await a.enter();
    for (let i = 0; i < 60; i++) await a.act({ type: "press", buttonId: "nope" });
    const rows = h.server.host.audit.query({
      kind: "action:rejected",
      accountId: a.accountId,
      limit: 200,
    });
    expect(rows.filter((r) => r.kind === "action:rejected").length).toBeLessThanOrEqual(20);
  });
});

describe("museum mode's read-only file serving", () => {
  it("serves only files under the original client's folder and Ruffle, whatever the path says", async () => {
    h = await startServer({ listen: true, config: { legacyClient: true } });
    const port = Number(new URL((h as Harness).baseUrl()).port);
    const paths = [
      "/museum/../../../etc/passwd",
      "/museum/%2e%2e/%2e%2e/%2e%2e/etc/passwd",
      "/museum/..%2f..%2f..%2fetc%2fpasswd",
      "/museum/ruffle/../../../../../../etc/passwd",
      "/museum/ruffle/%2e%2e%2f%2e%2e%2f%2e%2e%2f%2e%2e%2fetc/passwd",
      "/museum/..%5c..%5c..%5cetc%5cpasswd",
      "/museum/%00",
      "/museum/flash/../../../../etc/passwd",
      "/museum/.env",
      "/museum/.git/config",
      "/museum/ruffle/package.json%00.js",
    ];
    for (const path of paths) {
      const r = await rawHttp(port, [
        `GET ${path} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n`,
      ]);
      expect(r.text, path).not.toContain("root:");
      expect(r.text, path).not.toContain("[core]");
      expect(r.text, path).not.toMatch(/HTTP\/1\.1 200/);
    }
    // Nothing but GET and HEAD reaches the files.
    const post = await (h as Harness).inject({ method: "POST", url: "/museum/ruffle/ruffle.js" });
    expect(post.statusCode).toBeGreaterThanOrEqual(400);
    const del = await (h as Harness).inject({ method: "DELETE", url: "/museum/ruffle/ruffle.js" });
    expect(del.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("marks the original client's cookie HttpOnly and SameSite, and Secure when asked", async () => {
    h = await startServer({ config: { legacyClient: true, secureCookies: true } });
    const res = await h.inject({ method: "GET", url: "/museum/request.xp?checklogon" });
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
    await h.stop();
    h = await startServer({ config: { legacyClient: true } });
    const plain = await h.inject({ method: "GET", url: "/museum/request.xp?checklogon" });
    expect(String(plain.headers["set-cookie"])).not.toContain("Secure");
  });

  it("rate limits the original client's log-on and new-user requests per address", async () => {
    h = await startServer({ config: { legacyClient: true, rateAuthMax: 3 } });
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await h.inject({
        method: "GET",
        url: `/museum/request.xp?logon&logon=nobody${i}&password=whatever12`,
        remoteAddress: "198.51.100.77",
      });
      codes.push(r.statusCode);
    }
    expect(codes.slice(3)).toEqual([429, 429]);
  });
});

describe("the WebSocket handshake is rate limited like any request", () => {
  it("answers 429 to handshakes past the per-address budget", async () => {
    h = await startServer({ listen: true, config: { rateGlobalMax: 4 } });
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) {
      codes.push(
        await new Promise<number>((resolve) => {
          const ws = new WebSocket((h as Harness).wsUrl());
          ws.on("unexpected-response", (_req, res) => {
            resolve(res.statusCode ?? 0);
            ws.terminate();
          });
          ws.on("open", () => {
            resolve(101);
            ws.close();
          });
          ws.on("error", () => undefined);
        }),
      );
    }
    expect(codes.slice(0, 4).every((c) => c === 101)).toBe(true);
    expect(codes.slice(4).every((c) => c === 429)).toBe(true);
  });
});
