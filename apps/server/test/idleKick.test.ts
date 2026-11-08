/**
 * The idle time-out against the original's kick timer.
 *
 * The 2001 server ran `CFqDlg::user_list_update_time` for every connection every five seconds
 * (`window_timer.cpp:30-44`, `c_maint_check_time` = 5000 ms; `online_util.cpp:255-262`). For a
 * logged-on player whose last packet was `sys.i_player_kick_minutes` or more minutes ago
 * (`user_list.cpp:160-166`) it did, in this order:
 *
 *   1. `broadcast("%s got kicked for inactivity", name)` (`user_list.cpp:167`), to everyone;
 *   2. `g_on.online_delete_guy(...)` (`user_list.cpp:168`): a sale in progress is finished and
 *      mailed (`online_util.cpp:122-132`, `command_complicated_finish(.., true)`), the parlor is
 *      released (`p_play[..].p_on = NULL`, `:160`; `get_player_who_locked_this_guy` looks only at
 *      players with a `p_on`, `misc_utils.cpp:279-301`), high-importance mail is saved (`:157`).
 *
 * The sysop's Kick (`dlg_edit_choose.cpp:257-278`, `user_list.cpp:307-335`) calls only step 2.
 * The default limit was 4 minutes (`file_system.cpp:27`); the port's is `FQ_IDLE_TIMEOUT_MINUTES`
 * (15) and the sweep `FQ_IDLE_SWEEP_SECONDS` (30), both set here to the original's 4 and 5.
 */
import type { View } from "@fq/protocol";
import { afterEach, describe, expect, it } from "vitest";
import type { Notice } from "../src/wire.js";
import {
  buttonIds,
  connectSocket,
  type Harness,
  type Socket,
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

const ORIGINAL_TIMER = { idleTimeoutMinutes: 4, idleSweepSeconds: 5 };

const notices = (s: Socket): Notice[] =>
  s.messages.flatMap((m) => (m.type === "notice" ? [m.notice] : []));

function broadcastTexts(s: Socket): string[] {
  return notices(s).flatMap((n) =>
    n.kind === "broadcast" ? [n.text.map((span) => span.text).join("")] : [],
  );
}

function sessionIds(): string[] {
  return Object.keys(h?.server.host.get("main")?.snapshotState.sessions ?? {});
}

function playerIdOf(login: string): number {
  const p = h?.server.host.get("main")?.snapshotState.players.find((x) => x.logon === login);
  if (!p) throw new Error(`no player ${login}`);
  return p.id;
}

describe("the idle time-out (user_list.cpp:160-171)", () => {
  it("logs a player off at the limit, not before, and tells the town (:167)", async () => {
    h = await startServer({ listen: true, config: ORIGINAL_TIMER });
    const sleepy = await new TestPlayer(h, "sleepy").signUp();
    await sleepy.enter();
    const watcher = await new TestPlayer(
      h,
      "watcher",
      "watcher long password",
      "10.0.0.2",
    ).signUp();
    await watcher.enter();
    await toDesk(watcher);
    const watch = await connectSocket(h, watcher.token);
    sockets.push(watch);

    // 3 min 55 s of silence: still logged on (the test is `>=` the limit, :164).
    await h.clock.advance(3 * 60_000 + 55_000);
    expect(sessionIds()).toHaveLength(2);
    expect(broadcastTexts(watch).filter((t) => t.includes("got kicked"))).toEqual([]);

    // The watcher keeps acting; sleepy does not. At 4 min the next sweep kicks sleepy only.
    await watcher.press("go:news");
    await h.clock.advance(10_000);
    await watch.until((m) =>
      m.some(
        (x) =>
          x.type === "notice" &&
          x.notice.kind === "broadcast" &&
          x.notice.text
            .map((s) => s.text)
            .join("")
            .includes("got kicked"),
      ),
    );
    const line = broadcastTexts(watch).find((t) => t.includes("got kicked")) ?? "";
    // The `broadcast` effect carries the plain line, as for "logged off" (the queued copies and
    // the cafe's carry the server's time in front, broadcast.cpp:391-407).
    expect(line).toBe("sleepy got kicked for inactivity");
    expect(sessionIds()).toEqual([String(playerIdOf("watcher"))]);

    // The kicked player is told the session is over and can log on again.
    const late = await sleepy.act({ type: "press", buttonId: "go:desk" });
    expect(late.body).toMatchObject({ error: "not_in_game" });
    expect((await sleepy.request("POST", "/api/towns/main/enter", {})).status).toBe(200);
  });

  it("any action restarts the clock; the sysop's Kick says nothing (dlg_edit_choose.cpp:257-278)", async () => {
    h = await startServer({ listen: true, config: ORIGINAL_TIMER });
    const a = await new TestPlayer(h, "alice").signUp();
    await a.enter();
    const b = await new TestPlayer(h, "bobby", "bob long password", "10.0.0.2").signUp();
    await b.enter();
    await toDesk(a);
    await toDesk(b);
    const watch = await connectSocket(h, b.token);
    sockets.push(watch);

    // Alice acts every 3 minutes: never idle for 4 (online_util.cpp:30, `online_update`).
    for (let i = 0; i < 4; i++) {
      await h.clock.advance(3 * 60_000);
      await a.press(i % 2 === 0 ? "go:news" : "go:desk");
      await b.press(i % 2 === 0 ? "go:news" : "go:desk");
    }
    expect(sessionIds()).toHaveLength(2);

    const town = h.server.host.get("main");
    if (!town) throw new Error("no town");
    expect(await town.leave(playerIdOf("alice"), "kicked", "admin-kick")).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 100)); // let anything pushed arrive
    expect(broadcastTexts(watch).filter((t) => t.includes("got kicked"))).toEqual([]);
    expect(sessionIds()).toEqual([String(playerIdOf("bobby"))]);
  });

  it("releases a parlor the kicked player was holding, so its owner can log on (misc_utils.cpp:279-301, funeral.cpp:355-363)", async () => {
    h = await startServer({ config: ORIGINAL_TIMER });
    // The owner leaves; the visitor stands at the owner's door.
    const owner = await new TestPlayer(
      h,
      "morticia",
      "morticia long password",
      "10.0.0.2",
    ).signUp();
    await owner.enter();
    await owner.act({ type: "exit" });
    const visitor = await new TestPlayer(h, "digby", "digby long password", "10.0.0.3").signUp();
    await visitor.enter();
    await toDesk(visitor);
    await visitor.press("go:map");
    await visitor.act({ type: "visit", placeId: "competitors" });
    await visitor.press("competitors:visit");
    await visitor.act({ type: "submitText", overlayId: "competitors:getname", text: "morticia" });
    const door = await visitor.act({
      type: "confirm",
      overlayId: "competitors:namenext",
      accepted: true,
    });
    expect(door.status).toBe(200);
    const visitorId = playerIdOf("digby");
    const held = h.server.host.get("main")?.snapshotState.sessions[String(visitorId)];
    expect(held?.locked).toBe(true);

    // While he stands there the owner cannot log on (funeral.cpp:357-363).
    await h.clock.advance(60_000);
    const refused = await owner.request<{ error: string; message: string }>(
      "POST",
      "/api/towns/main/enter",
      {},
    );
    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({ error: "rejected" });

    // After the visitor's idle time-out the parlor is free.
    await h.clock.advance(4 * 60_000);
    expect(sessionIds()).toEqual([]);
    const free = await owner.request<{ view: View }>("POST", "/api/towns/main/enter", {});
    expect(free.status).toBe(200);
  });

  it("finishes a sale in progress and credits it when the player is kicked mid-sale (online_util.cpp:122-132)", async () => {
    h = await startServer({ config: ORIGINAL_TIMER });
    const p = await new TestPlayer(h, "skelly").signUp();
    await p.enter();
    let view = await toDesk(p);
    // Wait for customers until one is at the table and the negotiation buttons show.
    for (let i = 0; i < 400 && !buttonIds(view).includes("neg:done"); i++) {
      const ids = buttonIds(view);
      const dismiss = view.overlay?.kind === "message" ? view.overlay.id : null;
      if (dismiss) {
        view = (await p.act({ type: "dismiss", overlayId: dismiss })).body.view;
      } else if (ids.includes("desk:wait")) {
        view = await p.press("desk:wait");
      } else if (ids.includes("go:desk")) {
        view = await p.press("go:desk");
      } else {
        view = await p.press(ids[0] as string);
      }
    }
    expect(buttonIds(view)).toContain("neg:done");
    const id = playerIdOf("skelly");
    const town = h.server.host.get("main");
    const before = town?.snapshotState.players[id];
    const session = town?.snapshotState.sessions[String(id)];
    expect(session?.customer.active).toBe(true);
    const bpBefore = before?.bp ?? 0;
    const mailBefore = before?.mail.length ?? 0;

    await h.clock.advance(4 * 60_000);
    expect(sessionIds()).toEqual([]);
    const after = town?.snapshotState.players[id];
    // `command_complicated_finish(.., true)`: the sale is closed and its BP are in the record.
    expect(after?.bp).toBeGreaterThan(bpBefore);
    expect(after?.mail.length).toBeGreaterThanOrEqual(mailBefore);
  });
});
