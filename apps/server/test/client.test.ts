import type { View } from "@fq/protocol";
import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { ApiClient, ApiError, ServerTransport } from "../src/client/index.js";
import type { Notice } from "../src/wire.js";
import { buttonIds, type Harness, startServer, TestPlayer, toDesk } from "./support/harness.js";

let h: Harness | null = null;
afterEach(async () => {
  await h?.stop();
  h = null;
});

const form = (name: string) => ({ name, parlor: `${name} Rest`, male: true });

describe("the typed client", () => {
  it("signs up, enters and plays through ServerTransport, over real HTTP and WebSocket", async () => {
    h = await startServer({ listen: true });
    const api = new ApiClient({ baseUrl: h.baseUrl() });
    await api.signUp("skelly", "correct horse battery");
    expect((await api.towns())[0]?.id).toBe("main");
    expect((await api.me()).account.login).toBe("skelly");

    const t = new ServerTransport({
      api,
      townId: "main",
      parlor: form("Skelly"),
      webSocket: WebSocket as never,
    });
    const pushed: View[] = [];
    const notices: Notice[] = [];
    t.onPush((v) => pushed.push(v));
    t.onNotice((n) => notices.push(n));
    const first = await t.connect();
    expect(first.scene).toBe("news");
    const desk = await t.send({ type: "press", buttonId: "go:desk" });
    expect(desk.scene).toBe("desk");

    // Rejections surface as ApiError carrying the View.
    const err = await t.send({ type: "press", buttonId: "nope" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("rejected");
    expect((err as ApiError).view?.scene).toBe("desk");

    // Another player's arrival is pushed to this transport.
    const other = await new TestPlayer(
      h,
      "morticia",
      "morticia long password",
      "10.0.0.2",
    ).signUp();
    await other.enter();
    for (let i = 0; i < 100 && notices.length === 0; i++)
      await new Promise((r) => setTimeout(r, 20));
    expect(notices[0]?.kind).toBe("broadcast");

    t.close();
    const before = notices.length;
    await other.act({ type: "exit" });
    await new Promise((r) => setTimeout(r, 100));
    expect(notices.length).toBe(before); // no calls after close()
    await expect(t.send({ type: "exit" })).rejects.toThrow("not connected");
  });

  it("turns cafe chat from others into a pushed View with the line appended", async () => {
    h = await startServer({ listen: true });
    const alice = await new TestPlayer(h, "alice").signUp();
    await alice.enter();
    await toDesk(alice);
    await alice.press("go:map");
    await alice.act({ type: "visit", placeId: "cafe" });

    const api = new ApiClient({ baseUrl: h.baseUrl() });
    await api.signUp("bobby", "bob long password");
    const t = new ServerTransport({
      api,
      townId: "main",
      parlor: form("Bobby"),
      webSocket: WebSocket as never,
    });
    const pushed: View[] = [];
    t.onPush((v) => pushed.push(v));
    await t.connect();
    await t.send({ type: "press", buttonId: "go:desk" });
    await t.send({ type: "press", buttonId: "go:desk" }).catch(() => undefined);
    await t.send({ type: "press", buttonId: "go:map" });
    const cafe = await t.send({ type: "visit", placeId: "cafe" });
    expect(cafe.scene).toBe("cafe");
    for (let i = 0; i < 100 && h.server.host.hub.socketCount("main") === 0; i++) {
      await new Promise((r) => setTimeout(r, 10));
    }

    await alice.act({ type: "chat", text: "Pass the embalming fluid" });
    for (let i = 0; i < 100 && pushed.length === 0; i++)
      await new Promise((r) => setTimeout(r, 10));
    expect(pushed[0]?.scene).toBe("cafe");
    expect(JSON.stringify(pushed[0]?.chat?.at(-1))).toContain("Pass the embalming fluid");
    t.close();
  });

  it("reconnects the socket after a drop and resynchronises", async () => {
    h = await startServer({ listen: true });
    const api = new ApiClient({ baseUrl: h.baseUrl() });
    await api.signUp("skelly", "correct horse battery");
    const sockets: WebSocket[] = [];
    class Tracking extends WebSocket {
      constructor(url: string) {
        super(url);
        sockets.push(this);
      }
    }
    const t = new ServerTransport({
      api,
      townId: "main",
      parlor: form("Skelly"),
      webSocket: Tracking as never,
      reconnect: { minMs: 10, maxMs: 20 },
    });
    await t.connect();
    const waitFor = async (cond: () => boolean) => {
      for (let i = 0; i < 200 && !cond(); i++) await new Promise((r) => setTimeout(r, 10));
      expect(cond()).toBe(true);
    };
    await waitFor(() => sockets[0]?.readyState === WebSocket.OPEN);
    await waitFor(() => h?.server.host.hub.socketCount("main") === 1);

    // The connection drops; the transport opens another and the server sees it.
    sockets[0]?.terminate();
    await waitFor(() => sockets.length >= 2 && h?.server.host.hub.socketCount("main") === 1);

    // The player's screen changed while disconnected: the resync pushes it.
    const pushed: View[] = [];
    t.onPush((v) => pushed.push(v));
    const view = await t.send({ type: "press", buttonId: "go:desk" });
    sockets[1]?.terminate();
    await h.server.host.get("main")?.enqueue(() => undefined);
    const ids = buttonIds(view);
    expect(ids.length).toBeGreaterThan(0);
    await waitFor(() => sockets.length >= 3 && h?.server.host.hub.socketCount("main") === 1);
    t.close();
  });

  it("stops retrying when the session is over", async () => {
    h = await startServer({ listen: true, config: { idleTimeoutMinutes: 5 } });
    const api = new ApiClient({ baseUrl: h.baseUrl() });
    await api.signUp("skelly", "correct horse battery");
    let opened = 0;
    class Counting extends WebSocket {
      constructor(url: string) {
        super(url);
        opened++;
      }
    }
    const t = new ServerTransport({
      api,
      townId: "main",
      parlor: form("Skelly"),
      webSocket: Counting as never,
      reconnect: { minMs: 10, maxMs: 20 },
    });
    const notices: Notice[] = [];
    t.onNotice((n) => notices.push(n));
    await t.connect();
    for (let i = 0; i < 100 && h.server.host.hub.socketCount("main") === 0; i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    await h.clock.advance(6 * 60_000);
    for (let i = 0; i < 100 && notices.length === 0; i++)
      await new Promise((r) => setTimeout(r, 10));
    expect(notices).toEqual([{ kind: "sessionEnded", reason: "timeout" }]);
    await new Promise((r) => setTimeout(r, 150));
    expect(opened).toBe(1);
    t.close();
  });
});

describe("invalid_request issues", () => {
  it("keeps the server's field-level issues on ApiError, without echoing what was typed", async () => {
    h = await startServer({ listen: true });
    const api = new ApiClient({ baseUrl: h.baseUrl() });
    const secret = "short-secret";
    const err = await api.signUp("ab", secret).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    const e = err as ApiError;
    expect(e.status).toBe(400);
    expect(e.code).toBe("invalid_request");
    expect(e.issues).toBeDefined();
    const byPath = new Map((e.issues ?? []).map((i) => [i.path, i.message]));
    expect(byPath.get("login")).toContain("3 to 20 letters");
    // The password is long enough, so only the login is named; a too-short one is named by path.
    expect(byPath.has("password")).toBe(false);
    const short = (await api.signUp("abcdef", "short").catch((x: unknown) => x)) as ApiError;
    expect(short.issues?.map((i) => i.path)).toEqual(["password"]);
    expect(JSON.stringify(short.issues)).not.toContain('short"');
    expect(JSON.stringify(e.issues)).not.toContain(secret);

    // Nested paths from the parlor form.
    await api.signUp("nester", "nester long password");
    const nested = (await api
      .enter("main", { parlor: { name: "", parlor: "x", male: true } })
      .catch((x: unknown) => x)) as ApiError;
    expect(nested.code).toBe("invalid_request");
    expect(nested.issues?.map((i) => i.path)).toContain("parlor.name");

    // Errors with no issues leave the field undefined.
    const wrong = (await api.logIn("nester", "wrong").catch((x: unknown) => x)) as ApiError;
    expect(wrong.issues).toBeUndefined();
  });
});
