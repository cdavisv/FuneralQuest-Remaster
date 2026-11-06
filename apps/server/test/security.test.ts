import { afterEach, describe, expect, it } from "vitest";
import { createLogger } from "../src/logger.js";
import { ADMIN_TOKEN, type Harness, startServer, TestPlayer } from "./support/harness.js";

let h: Harness | null = null;
afterEach(async () => {
  await h?.stop();
  h = null;
});

async function twoPlayers(): Promise<[TestPlayer, TestPlayer]> {
  h = await startServer();
  const a = await new TestPlayer(h, "alice").signUp();
  const b = await new TestPlayer(h, "bobby", "another long password", "10.0.0.2").signUp();
  await a.enter();
  await b.enter();
  return [a, b];
}

describe("hostile requests", () => {
  it("refuses a missing, malformed, unknown or revoked token", async () => {
    const [a] = await twoPlayers();
    const call = (headers: Record<string, string>) =>
      h?.inject({ method: "GET", url: "/api/me", headers });
    expect((await call({}))?.statusCode).toBe(401);
    expect((await call({ authorization: "Bearer nope" }))?.statusCode).toBe(401);
    expect((await call({ authorization: "Basic abc" }))?.statusCode).toBe(401);
    expect((await call({ authorization: `Bearer fq_${"A".repeat(43)}` }))?.statusCode).toBe(401);
    expect((await call({ authorization: `Bearer ${a.token}x` }))?.statusCode).toBe(401);
    expect((await call({ authorization: `Bearer ${a.token}` }))?.statusCode).toBe(200);
    await a.request("POST", "/api/auth/logout");
    expect((await call({ authorization: `Bearer ${a.token}` }))?.statusCode).toBe(401);
  });

  it("derives the player from the session: a body cannot name another player", async () => {
    const [a, b] = await twoPlayers();
    // A body that tries to say who is acting is refused outright (strict schemas).
    const spoof = await a.request("POST", "/api/towns/main/action", {
      action: { type: "press", buttonId: "go:desk" },
      playerId: 1,
    });
    expect(spoof.status).toBe(400);
    const spoof2 = await a.request("POST", "/api/towns/main/enter", { playerId: 1 });
    expect(spoof2.status).toBe(400);

    // Each token only ever moves its own player.
    const town = h?.server.host.get("main");
    const aId = town?.parlorsFor((await h?.server.accounts.getAccount(a.accountId)) as never)[0]
      ?.playerId;
    const bId = town?.parlorsFor((await h?.server.accounts.getAccount(b.accountId)) as never)[0]
      ?.playerId;
    expect(aId).not.toBe(bId);
    const bBefore = JSON.stringify(town?.snapshotState.sessions[String(bId)]);
    await a.press("go:desk");
    expect(JSON.stringify(town?.snapshotState.sessions[String(bId)])).toBe(bBefore);
    expect(town?.snapshotState.sessions[String(aId)]?.scene).toBe("desk");

    // And a view is only ever the caller's own.
    const aView = await a.request<{ view: { scene: string } }>("GET", "/api/towns/main/view");
    const bView = await b.request<{ view: { scene: string } }>("GET", "/api/towns/main/view");
    expect(aView.body.view.scene).toBe("desk");
    expect(bView.body.view.scene).toBe("news");
  });

  it("rejects buttons the screen did not offer, without changing anything", async () => {
    const [a] = await twoPlayers();
    const town = h?.server.host.get("main");
    const revision = town?.revision;
    for (const buttonId of ["desk:wait", "neg:done", "go:bank", "script:1", "nope", ""]) {
      const r = await a.act({ type: "press", buttonId });
      expect(r.status, buttonId).toBe(r.body.error === "invalid_request" ? 400 : 409);
    }
    const r = await a.act({ type: "press", buttonId: "desk:wait" });
    expect(r.body).toMatchObject({ error: "rejected" });
    expect(r.body.view).toBeDefined();
    // Rejections leave the town untouched (they are only audited).
    expect(town?.revision).toBe(revision);
    const audit = h?.server.host.audit.query({ kind: "action:rejected", limit: 10 });
    expect(audit?.length).toBeGreaterThan(0);
  });

  it("validates every body strictly and bounds sizes", async () => {
    const [a] = await twoPlayers();
    const post = (url: string, payload: unknown) => a.request("POST", url, payload);
    // Unknown action types, wrong shapes, over-long strings, control characters.
    expect((await post("/api/towns/main/action", { action: { type: "teleport" } })).status).toBe(
      400,
    );
    expect((await post("/api/towns/main/action", { action: { type: "press" } })).status).toBe(400);
    expect(
      (
        await post("/api/towns/main/action", {
          action: { type: "press", buttonId: "x".repeat(500) },
        })
      ).status,
    ).toBe(400);
    expect(
      (await post("/api/towns/main/action", { action: { type: "chat", text: "a\u0000b" } })).status,
    ).toBe(400);
    expect(
      (await post("/api/towns/main/action", { action: { type: "chat", text: "z".repeat(501) } }))
        .status,
    ).toBe(400);
    expect((await post("/api/towns/main/action", "just a string")).status).toBe(400);
    expect((await post("/api/towns/main/action", {})).status).toBe(400);
    expect((await post("/api/towns/Main!/action", { action: { type: "exit" } })).status).toBe(400);
    expect((await post("/api/towns/nowhere/action", { action: { type: "exit" } })).status).toBe(
      404,
    );

    // An oversize body is stopped by the size limit before it is parsed.
    const big = await h?.inject({
      method: "POST",
      url: "/api/towns/main/action",
      headers: { authorization: `Bearer ${a.token}`, "content-type": "application/json" },
      payload: JSON.stringify({ action: { type: "chat", text: "y".repeat(40_000) } }),
    });
    expect(big?.statusCode).toBe(413);
    expect(JSON.parse(big?.body ?? "{}")).toMatchObject({ error: "too_large" });

    // Wrong content type and broken JSON are client errors, not crashes.
    const text = await h?.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { "content-type": "text/plain" },
      payload: "login=a&password=b",
    });
    expect(text?.statusCode).toBe(400);
    const broken = await h?.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { "content-type": "application/json" },
      payload: "{not json",
    });
    expect(broken?.statusCode).toBe(400);

    // Sign-up rules.
    const weak = await post("/api/auth/signup", { login: "okname", password: "short" });
    expect(weak.status).toBe(400);
    const odd = await post("/api/auth/signup", { login: "<script>", password: "long enough pw" });
    expect(odd.status).toBe(400);
  });

  it("never echoes internals, and never logs passwords or tokens", async () => {
    const lines: string[] = [];
    const logger = createLogger("trace", {
      write(chunk: string) {
        lines.push(chunk);
      },
    });
    h = await startServer({ logger });
    const password = "hunter2-hunter2-hunter2";
    const p = await new TestPlayer(h, "leaky", password).signUp();
    const signupToken = p.token;
    await p.logIn();
    await p.enter();
    await p.act({ type: "press", buttonId: "go:desk" });
    await p.request("POST", "/api/auth/login", { login: "leaky", password: "wrong-wrong-wrong" });
    await p.request("POST", "/api/towns/main/action", { action: { type: "bogus" }, password });
    const bad = await h.inject({ method: "GET", url: "/api/nothing-here" });
    expect(JSON.parse(bad.body)).toEqual({ error: "not_found", message: "No such endpoint." });
    expect(bad.headers["x-content-type-options"]).toBe("nosniff");
    const log = lines.join("");
    expect(log.length).toBeGreaterThan(200);
    expect(log).toContain("incoming request");
    for (const secret of [password, "wrong-wrong-wrong", signupToken, p.token, ADMIN_TOKEN]) {
      expect(log).not.toContain(secret);
    }
  });

  it("stores passwords as Argon2id and session tokens only as hashes", async () => {
    h = await startServer();
    const p = await new TestPlayer(h, "hashed", "a very secret passphrase").signUp();
    const row = h.server.db
      .prepare("SELECT password_hash FROM accounts WHERE login = ?")
      .get("hashed") as {
      password_hash: string;
    };
    expect(row.password_hash.startsWith("$argon2id$")).toBe(true);
    expect(row.password_hash).not.toContain("secret");
    const sessions = h.server.db.prepare("SELECT token_hash FROM sessions").all() as {
      token_hash: string;
    }[];
    expect(sessions.length).toBeGreaterThan(0);
    for (const s of sessions) {
      expect(s.token_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(s.token_hash).not.toContain(p.token);
    }
    // Wrong password and unknown login look the same.
    const wrong = await p.request("POST", "/api/auth/login", {
      login: "hashed",
      password: "not the one",
    });
    const unknown = await p.request("POST", "/api/auth/login", {
      login: "nobody",
      password: "not the one",
    });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it("expires sessions with the clock", async () => {
    h = await startServer({ config: { sessionTtlDays: 1 } });
    const p = await new TestPlayer(h, "expiring").signUp();
    expect((await p.request("GET", "/api/me")).status).toBe(200);
    h.clock.jump(2 * 86_400_000);
    expect((await p.request("GET", "/api/me")).status).toBe(401);
  });

  it("serves a banned address nothing, matching whole octets only", async () => {
    h = await startServer();
    const admin = { authorization: `Bearer ${ADMIN_TOKEN}` };
    const ban = await h.inject({
      method: "POST",
      url: "/admin/bans",
      headers: { ...admin, "content-type": "application/json" },
      payload: JSON.stringify({ prefix: "203.0.113", reason: "spam" }),
    });
    expect(ban.statusCode).toBe(201);
    const signup = (ip: string) =>
      h?.inject({
        method: "POST",
        url: "/api/auth/signup",
        remoteAddress: ip,
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({
          login: `u${ip.replaceAll(".", "")}`,
          password: "long enough pw",
        }),
      });
    expect((await signup("203.0.113.9"))?.statusCode).toBe(403);
    // The original's substring match would have caught all of these.
    expect((await signup("203.0.1130.9"))?.statusCode).not.toBe(403);
    expect((await signup("13.0.113.9"))?.statusCode).toBe(201);
    expect((await signup("203.0.11.3"))?.statusCode).toBe(201);
  });
});

describe("rate limits", () => {
  it("limits sign-up and log-in per address", async () => {
    h = await startServer({ config: { rateAuthMax: 3, rateWindowSeconds: 60 } });
    const attempt = (n: number) =>
      h?.inject({
        method: "POST",
        url: "/api/auth/login",
        remoteAddress: "198.51.100.7",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ login: `nobody${n}`, password: "whatever12" }),
      });
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await attempt(i))?.statusCode ?? 0);
    expect(codes).toEqual([401, 401, 401, 429, 429]);
    // Another address has its own budget.
    const other = await h.inject({
      method: "POST",
      url: "/api/auth/login",
      remoteAddress: "198.51.100.8",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ login: "nobody", password: "whatever12" }),
    });
    expect(other.statusCode).toBe(401);
    const limited = await attempt(9);
    expect(JSON.parse(limited?.body ?? "{}")).toMatchObject({ error: "rate_limited" });
  });

  it("limits actions per account, not per address", async () => {
    h = await startServer({ config: { rateActionMax: 5 } });
    const a = await new TestPlayer(h, "busy").signUp();
    const b = await new TestPlayer(h, "calm", "calm long password").signUp();
    await a.enter();
    await b.enter();
    const codes: number[] = [];
    for (let i = 0; i < 8; i++)
      codes.push((await a.act({ type: "press", buttonId: "nope" })).status);
    expect(codes.filter((c) => c === 429).length).toBeGreaterThanOrEqual(3);
    // The other account, from the same address, is unaffected.
    expect((await b.request("GET", "/api/towns/main/view")).status).toBe(200);
  });

  it("locks a login name after repeated failures from many addresses", async () => {
    h = await startServer();
    await new TestPlayer(h, "target").signUp();
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) {
      const r = await h.inject({
        method: "POST",
        url: "/api/auth/login",
        remoteAddress: `192.0.2.${i + 1}`,
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ login: "target", password: "wrong password" }),
      });
      codes.push(r.statusCode);
    }
    expect(codes.slice(0, 10).every((c) => c === 401)).toBe(true);
    expect(codes.slice(10)).toEqual([429, 429]);
    // Even the right password waits out the lock.
    const right = await h.inject({
      method: "POST",
      url: "/api/auth/login",
      remoteAddress: "192.0.2.99",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ login: "target", password: "correct horse battery" }),
    });
    expect(right.statusCode).toBe(429);
    h.clock.jump(16 * 60_000);
    const later = await h.inject({
      method: "POST",
      url: "/api/auth/login",
      remoteAddress: "192.0.2.99",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ login: "target", password: "correct horse battery" }),
    });
    expect(later.statusCode).toBe(200);
  });
});
