import { afterEach, describe, expect, it } from "vitest";
import { type Harness, startServer, TestPlayer } from "./support/harness.js";

/** Decision 7 (2026-11-06): a guest plays and reads, but typing for others needs a free account. */

let h: Harness | null = null;
afterEach(async () => {
  await h?.stop();
  h = null;
});

async function guest(harness: Harness, ip: string): Promise<TestPlayer> {
  const r = await harness.inject({
    method: "POST",
    url: "/api/auth/guest",
    remoteAddress: ip,
    headers: { "content-type": "application/json" },
    payload: "{}",
  });
  expect(r.statusCode).toBe(201);
  const body = JSON.parse(r.body) as { token: string; account: { id: number; login: string } };
  const p = new TestPlayer(harness, body.account.login, "unused password", ip);
  p.token = body.token;
  p.accountId = body.account.id;
  return p;
}

describe("guests and free text", () => {
  it("refuses each kind of typed text with a message that says how to get an account", async () => {
    h = await startServer();
    const g = await guest(h, "10.0.0.2");
    // A parlor and a handle are chosen at creation, and that is allowed.
    await g.enter();
    const submit = (overlayId: string, text: string | null) =>
      g.act({ type: "submitText", overlayId, text });
    const typed: [string, () => ReturnType<typeof g.act>][] = [
      ["chat", () => g.act({ type: "chat", text: "hello" })],
      ["letter", () => submit("mailbox:compose", "a letter")],
      ["battle quote", () => submit("battle:quote", "a quote")],
      ["announcement", () => submit("news:announcement", "an announcement")],
      ["chain name", () => submit("cityHall:chainname", "a chain")],
      ["tiger fortune", () => submit("yangs:tiger-fortune", "a fortune")],
      ["sparrow fortune", () => submit("yangs:sparrow-fortune", "a fortune")],
    ];
    for (const [what, run] of typed) {
      const r = await run();
      expect(r.status, what).toBe(403);
      expect(r.body.error, what).toBe("guest_text");
      expect(r.body.message, what).toMatch(/free account/);
      expect(r.body.message, what).toMatch(/Make this a full account/);
      expect(r.body.message, what).toMatch(/New user/);
    }
  });

  it("lets a guest play, press buttons and cancel a prompt", async () => {
    h = await startServer();
    const g = await guest(h, "10.0.0.3");
    await g.enter();
    expect((await g.act({ type: "press", buttonId: "go:desk" })).status).toBe(200);
    // Cancelling is not free text: the engine answers (409, no such prompt), the guest rule does not.
    for (const id of ["mailbox:compose", "battle:quote", "news:announcement"]) {
      const r = await g.act({ type: "submitText", overlayId: id, text: null });
      expect(r.status, id).not.toBe(403);
    }
  });

  it("does not stop a full account", async () => {
    h = await startServer();
    const p = await new TestPlayer(h, "fullacct", "full account password", "10.0.0.4").signUp();
    await p.enter();
    const r = await p.act({ type: "chat", text: "hello" });
    expect(r.body.error).not.toBe("guest_text");
  });
});

describe("making a guest a full account", () => {
  it("keeps the parlor, the session and the progress, and lifts the restriction", async () => {
    h = await startServer();
    const g = await guest(h, "10.0.0.5");
    const before = await g.enter();
    const parlorBefore = (
      await g.request<{ parlors: { parlor: string; name: string }[] }>("GET", "/api/me")
    ).body.parlors[0];
    const up = await g.request<{ account: { login: string; guest: boolean } }>(
      "POST",
      "/api/auth/upgrade",
      { login: "newowner", password: "a good long password" },
    );
    expect(up.status).toBe(200);
    expect(up.body.account).toMatchObject({ login: "newowner", guest: false });

    // Same token, same parlor.
    const me = await g.request<{
      account: { login: string; guest: boolean };
      parlors: { parlor: string; name: string }[];
    }>("GET", "/api/me");
    expect(me.body.account).toMatchObject({ login: "newowner", guest: false });
    expect(me.body.parlors).toHaveLength(1);
    expect(me.body.parlors[0]).toMatchObject(parlorBefore as object);
    const again = await g.request<{ view: { scene: string } }>("POST", "/api/towns/main/enter", {});
    expect(again.status).toBe(200);
    expect(again.body.view.scene).toBe(before.scene);

    // The restriction is gone: the engine, not the guest rule, answers a stray chat line.
    const chat = await g.act({ type: "chat", text: "hello" });
    expect(chat.body.error).not.toBe("guest_text");

    // And the new name and password log in, to the same parlor.
    const back = await new TestPlayer(h, "newowner", "a good long password", "10.0.0.6").logIn();
    const me2 = await back.request<{ parlors: { parlor: string }[] }>("GET", "/api/me");
    expect(me2.body.parlors[0]?.parlor).toBe(parlorBefore?.parlor);
  });

  it("refuses a taken name, a full account and a bad password, changing nothing", async () => {
    h = await startServer();
    await new TestPlayer(h, "takenname", "some long password", "10.0.0.7").signUp();
    const g = await guest(h, "10.0.0.8");
    await g.enter();
    const taken = await g.request<{ error: string }>("POST", "/api/auth/upgrade", {
      login: "TakenName",
      password: "a good long password",
    });
    expect(taken.status).toBe(409);
    expect(taken.body.error).toBe("login_taken");
    const weak = await g.request("POST", "/api/auth/upgrade", {
      login: "freshname",
      password: "short",
    });
    expect(weak.status).toBe(400);
    const me = await g.request<{ account: { guest: boolean }; parlors: unknown[] }>(
      "GET",
      "/api/me",
    );
    expect(me.body.account.guest).toBe(true);
    expect(me.body.parlors).toHaveLength(1);

    const full = await new TestPlayer(h, "fullagain", "some long password", "10.0.0.9").signUp();
    const r = await full.request<{ error: string }>("POST", "/api/auth/upgrade", {
      login: "another1",
      password: "a good long password",
    });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe("not_guest");
  });
});
