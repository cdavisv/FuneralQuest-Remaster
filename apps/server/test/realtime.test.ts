import type { Action, View } from "@fq/protocol";
import { afterEach, describe, expect, it } from "vitest";
import type { Notice, ServerMessage } from "../src/wire.js";
import {
  ADMIN_TOKEN,
  buttonIds,
  connectSocket,
  type Harness,
  Socket,
  startServer,
  TestPlayer,
  toDesk,
} from "./support/harness.js";

let h: Harness | null = null;
const sockets: Socket[] = [];
afterEach(async () => {
  for (const s of sockets.splice(0)) s.close();
  await h?.stop();
  h = null;
});

const notices = (messages: ServerMessage[]): Notice[] =>
  messages.flatMap((m) => (m.type === "notice" ? [m.notice] : []));

function presence(playerLogin: string): boolean | undefined {
  const state = h?.server.host.get("main")?.snapshotState;
  const player = state?.players.find((p) => p.logon === playerLogin);
  return player ? state?.presence?.[String(player.id)] : undefined;
}

describe("the push socket", () => {
  it("pushes one player's log-on and log-off to another player's socket", async () => {
    h = await startServer({ listen: true });
    const bob = await new TestPlayer(h, "bobby", "bob long password", "10.0.0.2").signUp();
    await bob.enter();
    const bobSocket = await connectSocket(h, bob.token);
    sockets.push(bobSocket);

    const alice = await new TestPlayer(h, "alice").signUp();
    await alice.enter(); // a new parlor opens: everyone online is told
    await bobSocket.until((m) => notices(m).some((n) => n.kind === "broadcast"));
    const first = notices(bobSocket.messages).find((n) => n.kind === "broadcast");
    expect(first && "text" in first ? JSON.stringify(first.text) : "").toContain("alice");

    // Alice's own log-off reaches Bob too.
    const before = notices(bobSocket.messages).length;
    await alice.act({ type: "exit" });
    await bobSocket.until((m) => notices(m).length > before);
    const last = notices(bobSocket.messages).at(-1);
    expect(JSON.stringify(last)).toContain("alice");

    // Game actions never ride the socket: a message asking for one is not understood.
    bobSocket.send({ type: "press", buttonId: "go:desk" });
    expect(await bobSocket.waitClosed()).toBe(4400);
  });

  it("only admits a logged-in player who is in the town, and bounds what it reads", async () => {
    h = await startServer({ listen: true });
    const p = await new TestPlayer(h, "alice").signUp();

    const hello = async (message: unknown) => {
      const s = new Socket(h?.wsUrl() ?? "");
      sockets.push(s);
      await s.open();
      s.send(message);
      return s;
    };
    expect(await (await hello({ type: "hello", token: "nope", townId: "main" })).waitClosed()).toBe(
      4401,
    );
    expect(
      await (await hello({ type: "hello", token: p.token, townId: "nowhere" })).waitClosed(),
    ).toBe(4404);
    // Logged in but never entered the town.
    expect(
      await (await hello({ type: "hello", token: p.token, townId: "main" })).waitClosed(),
    ).toBe(4409);
    expect(await (await hello("not json")).waitClosed()).toBe(4400);
    expect(
      await (await hello({ type: "hello", token: p.token, townId: "main", extra: 1 })).waitClosed(),
    ).toBe(4400);
    const huge = await hello(`{"type":"ping","pad":"${"x".repeat(5000)}"}`);
    expect(await huge.waitClosed()).toBe(1009);

    await p.enter();
    const ok = await connectSocket(h, p.token);
    sockets.push(ok);
    ok.send({ type: "ping" });
    await ok.until((m) => m.some((x) => x.type === "pong"));
  });

  it("reports connection to the engine: presence follows the socket", async () => {
    h = await startServer({ listen: true });
    const p = await new TestPlayer(h, "alice").signUp();
    await p.enter();
    expect(presence("alice")).toBe(true); // entering counts as connecting
    const s = await connectSocket(h, p.token);
    await h.server.host.get("main")?.enqueue(() => undefined);
    expect(presence("alice")).toBe(true);
    s.close();
    await s.waitClosed();
    await new Promise((r) => setTimeout(r, 50));
    await h.server.host.get("main")?.enqueue(() => undefined);
    expect(presence("alice")).toBe(false); // session still held, client gone
    expect(h.server.host.get("main")?.snapshotState.sessions).not.toEqual({});
    // Acting again over HTTP means the client is back.
    await p.press("go:desk");
    expect(presence("alice")).toBe(true);
    await p.act({ type: "exit" });
    expect(presence("alice")).toBe(false);
  });

  it("tells an older connection it was replaced when the player enters again", async () => {
    h = await startServer({ listen: true });
    const p = await new TestPlayer(h, "alice").signUp();
    await p.enter();
    const old = await connectSocket(h, p.token);
    sockets.push(old);
    const second = await new TestPlayer(h, "alice").logIn();
    await second.request("POST", "/api/towns/main/enter", {});
    await old.until((m) => notices(m).some((n) => n.kind === "sessionEnded"));
    expect(notices(old.messages).find((n) => n.kind === "sessionEnded")).toEqual({
      kind: "sessionEnded",
      reason: "replaced",
    });
    expect(await old.waitClosed()).toBe(4000);
  });

  it("logs off an idle player, tells their socket, and lets them back in", async () => {
    h = await startServer({
      listen: true,
      config: { idleTimeoutMinutes: 10, idleSweepSeconds: 30 },
    });
    const idle = await new TestPlayer(h, "sleepy").signUp();
    await idle.enter();
    const busy = await new TestPlayer(h, "awake", "awake long password", "10.0.0.3").signUp();
    await busy.enter();
    const idleSocket = await connectSocket(h, idle.token);
    sockets.push(idleSocket);

    for (let minute = 0; minute < 8; minute++) {
      await h.clock.advance(60_000);
      await busy.act({ type: "press", buttonId: "go:desk" }).catch(() => undefined);
      if (minute === 4) await busy.request("GET", "/api/towns/main/view");
    }
    expect(h.server.host.get("main")?.snapshotState.sessions).toHaveProperty("0");

    await h.clock.advance(5 * 60_000); // sleepy is now past ten minutes
    await idleSocket.until((m) => notices(m).some((n) => n.kind === "sessionEnded"));
    expect(notices(idleSocket.messages).at(-1)).toEqual({
      kind: "sessionEnded",
      reason: "timeout",
    });
    const state = h.server.host.get("main")?.snapshotState;
    expect(state?.sessions["0"]).toBeUndefined();
    expect(state?.sessions["1"]).toBeDefined(); // the active player is still in

    const late = await idle.act({ type: "press", buttonId: "go:desk" });
    expect(late.body).toMatchObject({ error: "not_in_game" });
    const back = await idle.request<{ view: View }>("POST", "/api/towns/main/enter", {});
    expect(back.status).toBe(200);
    const audit = h.server.host.audit.query({ kind: "leave:idle", limit: 5 });
    expect(audit).toHaveLength(1);
  });

  it("pushes a new day to connected players at midnight", async () => {
    h = await startServer({ listen: true, config: { idleTimeoutMinutes: 10_080 } });
    const p = await new TestPlayer(h, "alice").signUp();
    await p.enter();
    const s = await connectSocket(h, p.token);
    sockets.push(s);
    await h.clock.advance(13 * 3_600_000); // the fake clock starts at 12:00 UTC
    await s.until((m) => notices(m).some((n) => n.kind === "newDay"));
    expect(notices(s.messages).find((n) => n.kind === "newDay")).toEqual({
      kind: "newDay",
      day: 2,
    });
  });

  it("delivers cafe chat from one player to the others in the cafe, and to nobody else", async () => {
    h = await startServer({ listen: true });
    const alice = await new TestPlayer(h, "alice").signUp();
    const bob = await new TestPlayer(h, "bobby", "bob long password", "10.0.0.2").signUp();
    const carol = await new TestPlayer(h, "carol", "carol long password", "10.0.0.3").signUp();
    const cafe = async (p: TestPlayer): Promise<View> => {
      await p.enter();
      await toDesk(p);
      const map = await p.press("go:map");
      expect(map.map?.some((x) => x.id === "cafe")).toBe(true);
      const r = await p.act({ type: "visit", placeId: "cafe" });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.view.scene).toBe("cafe");
      return r.body.view;
    };
    await cafe(alice);
    await cafe(bob);
    await carol.enter(); // carol stays on the newspaper, outside the cafe
    const bobSocket = await connectSocket(h, bob.token);
    const carolSocket = await connectSocket(h, carol.token);
    sockets.push(bobSocket, carolSocket);

    const said = await alice.act({ type: "chat", text: "Anyone dead lately?" });
    expect(said.status).toBe(200);
    // The speaker gets their own line in the response; the other diner gets it pushed.
    expect(JSON.stringify(said.body.view.chat)).toContain("Anyone dead lately?");
    await bobSocket.until((m) => notices(m).some((n) => n.kind === "chat"));
    const line = notices(bobSocket.messages).find((n) => n.kind === "chat");
    expect(JSON.stringify(line)).toContain("Anyone dead lately?");
    // Carol is not in the cafe and hears nothing of it.
    await new Promise((r) => setTimeout(r, 100));
    expect(notices(carolSocket.messages).some((n) => n.kind === "chat")).toBe(false);
    // Chat outside the cafe is refused by the engine's guard.
    const refused = await carol.act({ type: "chat", text: "hello?" });
    expect(refused.status).toBe(409);
  });

  it("tells a player when a letter arrives, and the letter waits at their desk", async () => {
    h = await startServer({ listen: true });
    const alice = await new TestPlayer(h, "alice").signUp();
    const bob = await new TestPlayer(h, "bobby", "bob long password", "10.0.0.2").signUp();
    await alice.enter();
    await bob.enter();
    await toDesk(alice);
    const bobSocket = await connectSocket(h, bob.token);
    sockets.push(bobSocket);

    let view = await alice.press("go:mailbox");
    expect(view.overlay?.kind).toBe("textInput");
    let r = await alice.act({
      type: "submitText",
      overlayId: view.overlay?.id ?? "",
      text: "bobby",
    });
    view = r.body.view;
    if (view.overlay?.kind === "playerPicker") {
      r = await alice.act({
        type: "pickPlayer",
        overlayId: view.overlay.id,
        playerId: view.overlay.players[0]?.id ?? null,
      });
      view = r.body.view;
    }
    if (view.overlay?.kind === "confirm") {
      r = await alice.act({ type: "confirm", overlayId: view.overlay.id, accepted: true });
      view = r.body.view;
    }
    expect(view.overlay?.kind, JSON.stringify(view.overlay)).toBe("textInput");
    r = await alice.act({
      type: "submitText",
      overlayId: view.overlay?.id ?? "",
      text: "Dear Bobby, a fine funeral last week.",
    });
    expect(r.status, JSON.stringify(r.body)).toBe(200);

    await bobSocket.until((m) => notices(m).some((n) => n.kind === "mail"));
    expect(notices(bobSocket.messages).find((n) => n.kind === "mail")).toEqual({
      kind: "mail",
      count: 1,
    });
    // The letter itself is read at the desk, not pushed.
    const bobTown = h.server.host.get("main")?.snapshotState;
    expect(JSON.stringify(bobTown?.players[1]?.mail)).toContain("fine funeral");
    expect(JSON.stringify(notices(bobSocket.messages))).not.toContain("fine funeral");
  });

  it("delivers a sysop broadcast", async () => {
    h = await startServer({ listen: true });
    const p = await new TestPlayer(h, "alice").signUp();
    await p.enter();
    const s = await connectSocket(h, p.token);
    sockets.push(s);
    const r = await h.inject({
      method: "POST",
      url: "/admin/towns/main/broadcast",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}`, "content-type": "application/json" },
      payload: JSON.stringify({ message: "`4Server restarts in five minutes" }),
    });
    expect(r.statusCode).toBe(200);
    await s.until((m) => notices(m).some((n) => n.kind === "server"));
    const n = notices(s.messages).find((x) => x.kind === "server");
    expect(n && "text" in n ? n.text : null).toEqual([
      { text: "Server restarts in five minutes", color: "red" },
    ]);
  });
});

describe("one town is a single writer", () => {
  it("applies simultaneous actions from one player in arrival order", async () => {
    // Reference run: one request at a time, recording each action and the View it returned.
    h = await startServer();
    const ref = await new TestPlayer(h, "racer").signUp();
    let view = await ref.enter();
    const actions: Action[] = [];
    const views: View[] = [view];
    for (let i = 0; i < 30; i++) {
      const ids = buttonIds(view);
      const buttonId = ids.includes("neg:done")
        ? "neg:done"
        : ids.includes("desk:wait")
          ? "desk:wait"
          : (ids[0] as string);
      const action: Action = { type: "press", buttonId };
      actions.push(action);
      view = (await ref.act(action)).body.view;
      views.push(view);
    }
    const reference = JSON.stringify(h.server.host.get("main")?.snapshotState);
    await h.stop();

    // Same seed, same player, but every action is sent at once.
    h = await startServer();
    const racer = await new TestPlayer(h, "racer").signUp();
    await racer.enter();
    const results = await Promise.all(actions.map((a) => racer.act(a)));
    expect(results.map((r) => r.status)).toEqual(actions.map(() => 200));
    expect(results.map((r) => r.body.view)).toEqual(views.slice(1));
    expect(JSON.stringify(h.server.host.get("main")?.snapshotState)).toBe(reference);
    // And the audit log recorded them in that same order.
    const logged = h.server.host.audit
      .query({ kind: "action", limit: 100 })
      .filter((r) => r.kind === "action")
      .reverse()
      .map((r) => (r.data as { action: Action }).action);
    expect(logged).toEqual(actions);
  });

  it("keeps two players' simultaneous actions from corrupting each other", async () => {
    h = await startServer();
    const a = await new TestPlayer(h, "alice").signUp();
    const b = await new TestPlayer(h, "bobby", "bob long password", "10.0.0.2").signUp();
    await Promise.all([a.enter(), b.enter()]);
    const [va, vb] = await Promise.all([toDesk(a), toDesk(b)]);
    const waits = await Promise.all([
      ...Array.from({ length: 1 }, () => a.press("desk:wait")),
      ...Array.from({ length: 1 }, () => b.press("desk:wait")),
    ]);
    expect(waits).toHaveLength(2);
    expect(buttonIds(va)).toContain("desk:wait");
    expect(buttonIds(vb)).toContain("desk:wait");
    const state = h.server.host.get("main")?.snapshotState;
    expect(state?.sessions["0"]?.view?.hud?.turns).toBe(state?.players[0]?.turns);
    expect(state?.sessions["1"]?.view?.hud?.turns).toBe(state?.players[1]?.turns);
  });
});
