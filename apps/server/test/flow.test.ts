import { afterEach, describe, expect, it } from "vitest";
import {
  buttonIds,
  type Harness,
  playDay,
  startServer,
  TestPlayer,
  toDesk,
} from "./support/harness.js";

let h: Harness | null = null;
afterEach(async () => {
  await h?.stop();
  h = null;
});

describe("the account and game flow", () => {
  it("signs up, logs in, enters a town, plays a full day, logs out", async () => {
    h = await startServer();
    const p = new TestPlayer(h, "skelly");

    // The lobby is public.
    const lobby = await p.request<{
      towns: { id: string; day: number; players: { registered: number } }[];
    }>("GET", "/api/towns");
    expect(lobby.status).toBe(200);
    expect(lobby.body.towns[0]).toMatchObject({ id: "main", day: 1, players: { registered: 0 } });

    await p.signUp();
    // A second sign-up with the same name (any case) is refused.
    const dup = await new TestPlayer(h, "SKELLY").request("POST", "/api/auth/signup", {
      login: "SKELLY",
      password: "another password",
    });
    expect(dup.status).toBe(409);

    // Log in again from "another device"; both tokens work.
    const second = new TestPlayer(h, "skelly");
    await second.logIn();
    expect(second.token).not.toBe(p.token);

    // The first time there is no parlor, so the server asks for one.
    const need = await p.request("POST", "/api/towns/main/enter", {});
    expect(need.status).toBe(409);
    expect(need.body).toMatchObject({ error: "parlor_required" });

    // A bad form is refused with the engine's own message.
    const bad = await p.request<{ error: string; field: string }>("POST", "/api/towns/main/enter", {
      parlor: { name: "x", parlor: "Fine Parlor", male: true },
    });
    expect(bad.status).toBe(422);
    expect(bad.body).toMatchObject({ error: "invalid_parlor", field: "name" });

    const first = await p.enter();
    expect(first.scene).toBe("news");

    const info = await p.request<{
      players: { registered: number; online: number };
      rankings: unknown[];
    }>("GET", "/api/towns/main");
    expect(info.body.players).toMatchObject({ registered: 1, online: 1 });

    const me = await p.request<{ parlors: { townId: string; online: boolean }[] }>(
      "GET",
      "/api/me",
    );
    expect(me.body.parlors).toEqual([expect.objectContaining({ townId: "main", online: true })]);

    const view = await toDesk(p);
    expect(buttonIds(view)).toContain("desk:wait");
    const actions = await playDay(p, view);
    expect(actions).toBeGreaterThan(20);

    // After the day the player is logged off; acting again says so.
    const again = await p.act({ type: "press", buttonId: "desk:wait" });
    expect(again.status).toBe(409);
    expect(again.body).toMatchObject({ error: "not_in_game" });

    // Re-entering returns to the same parlor, with the BP earned.
    const back = await p.request<{ view: { scene: string }; created: boolean }>(
      "POST",
      "/api/towns/main/enter",
      {},
    );
    expect(back.status).toBe(200);
    expect(back.body.created).toBe(false);

    const out = await p.request("POST", "/api/auth/logout");
    expect(out.status).toBe(204);
    expect((await p.request("GET", "/api/me")).status).toBe(401);
    // The other device's token is a different session and still works.
    expect((await second.request("GET", "/api/me")).status).toBe(200);
  });

  it("keeps state across a restart of the server object", async () => {
    h = await startServer({ listen: false });
    const p = new TestPlayer(h, "morticia");
    await p.signUp();
    await p.enter();
    let view = await toDesk(p);
    for (let i = 0; i < 8; i++) {
      const ids = buttonIds(view);
      view = await p.press(ids.includes("neg:done") ? "neg:done" : (ids[0] as string));
    }
    const before = JSON.stringify(h.server.host.get("main")?.snapshotState);
    const revision = h.server.host.get("main")?.revision;

    h = await h.restart();
    const after = JSON.stringify(h.server.host.get("main")?.snapshotState);
    // Presence is runtime-only: after a restart nobody is connected.
    const strip = (s: string) => {
      const o = JSON.parse(s) as { presence?: unknown };
      o.presence = undefined;
      return JSON.stringify(o);
    };
    expect(strip(after)).toBe(strip(before));
    expect(h.server.host.get("main")?.revision).toBe(revision);

    // The same token still works, and the session carries on from the same screen.
    p.h = h;
    const resumed = await p.request<{ view: typeof view }>("GET", "/api/towns/main/view");
    expect(resumed.status).toBe(200);
    expect(resumed.body.view).toEqual(view);
    const next = await p.press(buttonIdsOf(resumed.body.view)[0] as string);
    expect(next).toBeDefined();
    // A second account can still not take the first one's name.
    const other = new TestPlayer(h, "someone-else");
    await other.signUp();
    const clash = await other.request<{ field: string }>("POST", "/api/towns/main/enter", {
      parlor: { name: "morticia", parlor: "Another Place", male: false },
    });
    expect(clash.status).toBe(422);
    expect(clash.body.field).toBe("name");
  });

  it("lets a guest play and keeps one parlor per account per town", async () => {
    h = await startServer({
      towns: [
        { id: "main", seed: 1 },
        { id: "second", name: "Second Town", seed: 2 },
      ],
    });
    const guest = await new TestPlayer(h, "unused").request<{
      token: string;
      account: { guest: boolean; login: string };
    }>("POST", "/api/auth/guest", {});
    expect(guest.status).toBe(201);
    expect(guest.body.account.guest).toBe(true);
    const g = new TestPlayer(h, guest.body.account.login);
    g.token = guest.body.token;
    const v = await g.enter("main", { name: "Guesty", parlor: "Guest Parlor", male: true });
    expect(v.scene).toBe("news");
    // Guests cannot log in with a password.
    const pw = await g.request("POST", "/api/auth/login", {
      login: g.login,
      password: "whatever1",
    });
    expect(pw.status).toBe(401);

    // Entering again does not create a second parlor.
    const again = await g.request<{ created: boolean }>("POST", "/api/towns/main/enter", {
      parlor: { name: "Other Name", parlor: "Other Parlor", male: true },
    });
    expect(again.body.created).toBe(false);
    const me = await g.request<{ parlors: { name: string }[] }>("GET", "/api/me");
    expect(me.body.parlors).toHaveLength(1);
    expect(me.body.parlors[0]?.name).toBe("Guesty");

    // A different town is a different parlor.
    await g.enter("second", { name: "Guesty Two", parlor: "Second Parlor", male: true });
    const me2 = await g.request<{ parlors: { townId: string }[] }>("GET", "/api/me");
    expect(me2.body.parlors.map((p) => p.townId).sort()).toEqual(["main", "second"]);
  });
});

function buttonIdsOf(view: { buttons: { id: string }[] }): string[] {
  return view.buttons.map((b) => b.id);
}
