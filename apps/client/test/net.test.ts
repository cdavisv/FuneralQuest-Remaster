import type { View } from "@fq/protocol";
import { ApiError, type SocketLike } from "@fq/server/client";
import { describe, expect, it, vi } from "vitest";
import { readConfig } from "../src/net/config.js";
import { checkLogin, checkNames, checkPassword, describeError } from "../src/net/errors.js";
import { observeSockets } from "../src/net/observedSocket.js";
import { SessionTransport } from "../src/net/SessionTransport.js";
import { createTokenStore } from "../src/net/tokenStore.js";
import { parseCredits } from "../src/shell/pages.js";
import { SendError } from "../src/transport/types.js";
import { shouldBundle } from "../tools/bundle-art.mjs";

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

const TOKEN = "fq_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";

describe("the token store", () => {
  it("keeps only the token, under one key, and gives it back", () => {
    const local = new MemoryStorage();
    const store = createTokenStore(local, new MemoryStorage());
    expect(store.get()).toBeNull();
    store.set(TOKEN);
    expect(store.get()).toBe(TOKEN);
    expect([...local.data.keys()]).toEqual(["fq.token.v1"]);
    store.clear();
    expect(store.get()).toBeNull();
  });

  it("ignores a stored value that is not a token", () => {
    const local = new MemoryStorage();
    local.setItem("fq.token.v1", "<script>alert(1)</script>");
    expect(createTokenStore(local, undefined).get()).toBeNull();
  });

  it("works, without memory, when storage is blocked", () => {
    const blocked = {
      getItem() {
        throw new Error("denied");
      },
      setItem() {
        throw new Error("denied");
      },
      removeItem() {
        throw new Error("denied");
      },
    };
    const store = createTokenStore(blocked, blocked);
    expect(() => store.set(TOKEN)).not.toThrow();
    expect(store.get()).toBeNull();
    expect(store.wasPlaying()).toBeNull();
  });

  it("remembers the last town for good and 'playing' for the tab only; logging out forgets both token and playing", () => {
    const local = new MemoryStorage();
    const session = new MemoryStorage();
    const store = createTokenStore(local, session);
    store.setLastTown("main");
    store.setPlaying("main");
    store.set(TOKEN);
    expect(local.getItem("fq.town.v1")).toBe("main");
    expect(local.getItem("fq.playing.v1")).toBeNull();
    expect(session.getItem("fq.playing.v1")).toBe("main");
    store.clear();
    expect(store.wasPlaying()).toBeNull();
  });
});

describe("configuration", () => {
  it("uses the mock for ?mock and ?fixture, and a server otherwise", () => {
    expect(readConfig("?mock", {}).mock).toBe(true);
    expect(readConfig("?fixture=desk", { DEV: true })).toMatchObject({
      mock: true,
      fixture: "desk",
    });
    expect(readConfig("", { VITE_MOCK: "1" }).mock).toBe(true);
    expect(readConfig("", {})).toEqual({
      mock: false,
      serverUrl: "",
      fixture: null,
      expanded: false,
    });
    expect(readConfig("?expanded", {}).expanded).toBe(true);
  });

  it("takes the server's origin from VITE_SERVER_URL without a trailing slash, same origin otherwise", () => {
    expect(readConfig("", { VITE_SERVER_URL: "https://fq.example.com/" }).serverUrl).toBe(
      "https://fq.example.com",
    );
    expect(readConfig("", { VITE_SERVER_URL: "  " }).serverUrl).toBe("");
  });

  it("ignores ?fixture outside development", () => {
    expect(readConfig("?fixture=desk", { DEV: false }).fixture).toBeNull();
  });
});

describe("form checks and server errors", () => {
  it("mirror the server's rules", () => {
    expect(checkLogin("ab")).toMatchObject({ field: "login" });
    expect(checkLogin("a b c")).toMatchObject({ field: "login" });
    expect(checkLogin("a".repeat(21))).toMatchObject({ field: "login" });
    expect(checkLogin("good.name-1_x")).toBeNull();
    expect(checkPassword("1234567")).toMatchObject({ field: "password" });
    expect(checkPassword("12345678")).toBeNull();
    expect(checkPassword("x".repeat(129))).toMatchObject({ key: "form.err.passwordLong" });
    expect(checkNames("", "Rest")).toMatchObject({ field: "name", key: "form.err.required" });
    expect(checkNames("Bob", "Re|st")).toMatchObject({ field: "parlor", key: "form.err.chars" });
    expect(checkNames("Bo`b", "Rest")).toMatchObject({ field: "name", key: "form.err.chars" });
    expect(checkNames("Bob", "x".repeat(65))).toMatchObject({ field: "parlor" });
    expect(checkNames("Bob", "Bob's Rest")).toBeNull();
    // Every character the server refuses is refused here first, including backslash and tilde.
    for (const ch of "?|=/\\;:,{}@+`<>%$~") {
      expect(checkNames(`Bo${ch}b`, "Rest"), ch).toMatchObject({
        field: "name",
        key: "form.err.chars",
      });
    }
  });

  it("shows the server's field-level messages for an invalid request", () => {
    const withIssues = (...issues: { path: string; message: string }[]) =>
      new ApiError(
        400,
        "invalid_request",
        "The request body or parameters are not valid.",
        undefined,
        undefined,
        issues,
      );
    expect(
      describeError(withIssues({ path: "parlor.name", message: "Too short." }), "enter"),
    ).toEqual({ field: "name", text: "Too short." });
    expect(
      describeError(withIssues({ path: "login", message: "Use 3 to 20 letters." }), "signup"),
    ).toEqual({ field: "login", text: "Use 3 to 20 letters." });
    expect(
      describeError(withIssues({ path: "password", message: "Too short." }), "signup"),
    ).toEqual({ field: "password", text: "Too short." });
    // A path the form has no field for is still the server's reason, on the form as a whole.
    expect(describeError(withIssues({ path: "town", message: "Unknown." }), "enter")).toEqual({
      field: null,
      text: "Unknown.",
    });
    // No issues: the generic line, as before.
    expect(describeError(new ApiError(400, "invalid_request", "m"), "enter")).toMatchObject({
      key: "form.err.invalid",
    });
  });

  it("put each server answer under the right field", () => {
    const e = (status: number, code: string, message = "m", field?: string) =>
      new ApiError(status, code, message, undefined, field);
    expect(describeError(e(401, "bad_credentials"), "login")).toMatchObject({ field: "password" });
    expect(describeError(e(409, "login_taken"), "signup")).toMatchObject({ field: "login" });
    expect(describeError(e(403, "banned"), "login")).toMatchObject({
      field: null,
      key: "form.err.banned",
    });
    expect(describeError(e(429, "locked"), "login")).toMatchObject({ key: "form.err.locked" });
    expect(describeError(e(429, "rate_limited"), "login")).toMatchObject({
      key: "form.err.rateLimited",
    });
    expect(describeError(e(422, "invalid_parlor", "Name taken.", "parlor"), "enter")).toEqual({
      field: "parlor",
      text: "Name taken.",
    });
    expect(
      describeError(e(403, "signup_disabled", "Sign-up is closed on this server."), "signup"),
    ).toMatchObject({
      text: "Sign-up is closed on this server.",
    });
    expect(describeError(e(500, "internal"), "login")).toMatchObject({ key: "form.err.server" });
    expect(describeError(new TypeError("Failed to fetch"), "login")).toMatchObject({
      key: "form.err.network",
    });
  });
});

/** A socket the test drives by hand. */
class FakeSocket implements SocketLike {
  static all: FakeSocket[] = [];
  onopen: SocketLike["onopen"] = null;
  onmessage: SocketLike["onmessage"] = null;
  onclose: SocketLike["onclose"] = null;
  onerror: SocketLike["onerror"] = null;
  sent: string[] = [];
  closed: number | null = null;
  constructor(readonly url: string) {
    FakeSocket.all.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close(code = 1000) {
    this.closed = code;
  }
  open() {
    this.onopen?.({});
  }
  message(value: unknown) {
    this.onmessage?.({ data: JSON.stringify(value) });
  }
  drop(code = 1006) {
    this.onclose?.({ code });
  }
}

describe("observed sockets", () => {
  function setup() {
    const events: string[] = [];
    let now = 0;
    let tick: (() => void) | null = null;
    const Ctor = observeSockets(
      { ready: () => events.push("ready"), lost: (code) => events.push(`lost:${code}`) },
      FakeSocket,
      {
        pingMs: 10,
        deadMs: 35,
        now: () => now,
        setInterval: (fn) => {
          tick = fn;
          return 1;
        },
        clearInterval: () => {
          tick = null;
        },
      },
    );
    const socket = new Ctor("ws://x/api/ws");
    const fake = FakeSocket.all.at(-1) as FakeSocket;
    return {
      events,
      socket,
      fake,
      advance: (ms: number) => {
        now += ms;
        tick?.();
      },
    };
  }

  it("reports the hello being accepted and the socket dropping", () => {
    const { events, socket, fake } = setup();
    const heard: unknown[] = [];
    socket.onmessage = (e) => heard.push(e.data);
    fake.open();
    fake.message({ type: "ready", townId: "main", day: 1 });
    fake.message({ type: "pong" });
    fake.drop(1006);
    expect(events).toEqual(["ready", "lost:1006"]);
    expect(heard).toHaveLength(2); // the transport still sees every message
  });

  it("does not report a close the transport asked for", () => {
    const { events, socket, fake } = setup();
    socket.close(1000, "bye");
    fake.drop(1000);
    expect(events).toEqual([]);
  });

  it("pings while the connection is healthy and closes a silent one so it is reopened", () => {
    const { socket, fake, advance } = setup();
    socket.onclose = () => {};
    fake.message({ type: "ready", townId: "main", day: 1 });
    advance(10);
    expect(fake.sent).toEqual(['{"type":"ping"}']);
    fake.message({ type: "pong" });
    advance(10);
    expect(fake.closed).toBeNull();
    advance(30);
    advance(30); // nothing heard for longer than deadMs
    expect(fake.closed).toBe(4001);
  });
});

/** A stand-in for ApiClient: just what ServerTransport calls. */
function fakeApi(view: View) {
  const calls: string[] = [];
  const api = {
    token: "fq_x",
    baseUrl: "http://server.test",
    calls,
    enter: vi.fn(async () => {
      calls.push("enter");
      return { view, created: false };
    }),
    act: vi.fn(async (): Promise<View> => view),
    currentView: vi.fn(async () => view),
  };
  return api;
}

const desk = (title: string): View => ({
  scene: "desk",
  title,
  text: [{ text: title }],
  buttons: [],
});

describe("the session transport", () => {
  function make(api = fakeApi(desk("one"))) {
    FakeSocket.all = [];
    const transport = new SessionTransport({
      api: api as never,
      townId: "main",
      webSocket: FakeSocket,
      heartbeat: { setInterval: () => 1, clearInterval: () => {} },
    });
    return { api, transport };
  }

  it("connect is idempotent while connected: the town is entered once", async () => {
    const { api, transport } = make();
    const first = await transport.connect();
    const second = await transport.connect();
    expect(second).toBe(first);
    expect(api.enter).toHaveBeenCalledTimes(1);
    expect(FakeSocket.all).toHaveLength(1);
  });

  it("a close followed at once by a connect (React's development double mount) keeps the session", async () => {
    const { api, transport } = make();
    await transport.connect();
    transport.close();
    await transport.connect();
    await new Promise((r) => setTimeout(r, 5));
    expect(api.enter).toHaveBeenCalledTimes(1);
    expect(FakeSocket.all[0]?.closed).toBeNull();
  });

  it("a real close closes the socket, and the next connect enters again", async () => {
    const { api, transport } = make();
    await transport.connect();
    transport.close();
    await new Promise((r) => setTimeout(r, 5));
    expect(FakeSocket.all[0]?.closed).toBe(1000);
    await transport.connect();
    expect(api.enter).toHaveBeenCalledTimes(2);
  });

  it("reports the push socket coming up, dropping and returning", async () => {
    const { transport } = make();
    const states: string[] = [];
    transport.onConnection((s) => states.push(s));
    await transport.connect();
    const socket = FakeSocket.all[0] as FakeSocket;
    socket.open();
    socket.message({ type: "ready", townId: "main", day: 1 });
    expect(states).toEqual([]); // online is the assumed state
    socket.drop(1006);
    expect(states).toEqual(["reconnecting"]);
    transport.close();
  });

  it("does not call a final close a reconnect", async () => {
    const { transport } = make();
    const states: string[] = [];
    transport.onConnection((s) => states.push(s));
    await transport.connect();
    (FakeSocket.all[0] as FakeSocket).drop(4000);
    expect(states).toEqual([]);
    transport.close();
  });

  it("forwards pushed Views and notices", async () => {
    const { transport } = make();
    const views: string[] = [];
    const notices: string[] = [];
    transport.onPush((v) => views.push(v.title));
    transport.onNotice((n) => notices.push(n.kind));
    await transport.connect();
    const socket = FakeSocket.all[0] as FakeSocket;
    socket.message({ type: "ready", townId: "main", day: 1 });
    socket.message({ type: "view", view: desk("two"), at: 1 });
    socket.message({ type: "notice", notice: { kind: "mail", count: 1 }, at: 2 });
    expect(views).toEqual(["two"]);
    expect(notices).toEqual(["mail"]);
    transport.close();
  });

  it("answers a refused action with the server's current View, not an error", async () => {
    const api = fakeApi(desk("one"));
    api.act.mockRejectedValueOnce(new ApiError(409, "rejected", "Not now.", desk("current")));
    const { transport } = make(api);
    await transport.connect();
    const view = await transport.send({ type: "press", buttonId: "x" });
    expect(view.title).toBe("current");
    transport.close();
  });

  it("turns failures into SendErrors, and a vanished session into a sessionEnded notice", async () => {
    const api = fakeApi(desk("one"));
    const { transport } = make(api);
    const notices: string[] = [];
    transport.onNotice((n) =>
      notices.push(n.kind === "sessionEnded" ? `ended:${n.reason}` : n.kind),
    );
    await transport.connect();
    api.act.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(transport.send({ type: "press", buttonId: "x" })).rejects.toMatchObject({
      failure: "network",
    });
    api.act.mockRejectedValueOnce(new ApiError(429, "rate_limited", "slow"));
    await expect(transport.send({ type: "press", buttonId: "x" })).rejects.toMatchObject({
      failure: "rate",
    });
    api.act.mockRejectedValueOnce(new ApiError(500, "internal", "oops"));
    await expect(transport.send({ type: "press", buttonId: "x" })).rejects.toBeInstanceOf(
      SendError,
    );
    api.act.mockRejectedValueOnce(new ApiError(409, "not_in_game", "Enter the town first."));
    await expect(transport.send({ type: "press", buttonId: "x" })).rejects.toMatchObject({
      failure: "server",
    });
    expect(notices).toEqual(["ended:timeout"]);
    transport.close();
  });

  it("refuses to send before it is connected", async () => {
    const { transport } = make();
    await expect(transport.send({ type: "exit" })).rejects.toBeInstanceOf(SendError);
  });
});

describe("the production bundle", () => {
  it("carries the single-frame pictures and leaves out frames, sprite sheets and contact sheets", () => {
    expect(shouldBundle("places/bank.svg")).toBe(true);
    expect(shouldBundle("people/f_adult.svg")).toBe(true);
    expect(shouldBundle("wait.svg")).toBe(true);
    expect(shouldBundle("wait.frames/0001.svg")).toBe(false);
    expect(shouldBundle("people/churchguy_h.frames/0100.svg")).toBe(false);
    expect(shouldBundle("ui/cabinet.svg")).toBe(false);
    expect(shouldBundle("ui/textures/brick.jpg")).toBe(false);
    expect(shouldBundle("contact-sheet.png")).toBe(false);
    expect(shouldBundle("contact-sheet.html")).toBe(false);
  });
});

describe("the credits page", () => {
  it("is built from CREDITS.md in order", () => {
    const blocks = parseCredits(
      "# Credits\n\n## First\n\n- A: one\n- B: two\n\nA line\nthat wraps with `code`.\n\n## Second\n\nEnd.\n",
    );
    expect(blocks).toEqual([
      { kind: "h", text: "First" },
      { kind: "ul", items: ["A: one", "B: two"] },
      { kind: "p", text: "A line that wraps with code." },
      { kind: "h", text: "Second" },
      { kind: "p", text: "End." },
    ]);
  });
});
