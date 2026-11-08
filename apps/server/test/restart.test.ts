/**
 * A Classic day across a server restart, against what the 2001 server kept.
 *
 * The original wrote its files at three moments: every `sys.i_auto_save_minutes` (30 by default,
 * `file_system.cpp:28`, `maint.cpp:442-448`: `file_config_save`, `file_sys_save`, `player_save`)
 * and on a clean shutdown (`shutdown_server`, `funeral.cpp:123-137`), and read them back at
 * start-up (`player_load`, `funeral.cpp:82`; `player_file.cpp:3-92`, `config.dat` in
 * `funeral_file.cpp:56-90`). What was in them: the player records (money, BP, turns, luck, tags,
 * `t_last_logon`, ...), the global counters (the day, the game age, `t_last_maint`) and one mail
 * file per player (`class_que::save_to_hd`, written by `online_delete_guy`, `online_util.cpp:158-163`,
 * which keeps only the high-importance packets). What was not: the customer on the table, the
 * screen, the cafe, or who was online (`p_on` is runtime-only; `player_load` leaves it NULL).
 * `shutdown_server` saved the players first and logged everyone off after (`funeral.cpp:126-128`),
 * so a sale finished by that log-off (`online_delete_guy`, `online_util.cpp:122-132`) was not in
 * `player.dat`, and a customer in progress was simply gone.
 *
 * The port is a superset of that on purpose: every step is written to SQLite in the transaction
 * that makes it, and the sessions go in the same state (the screen, the customer, the held
 * parlor), so a restart loses nothing, and a player who does not come back is logged off by the
 * idle time-out (`user_list.cpp:160-171`, `test/idleKick.test.ts`) from the moment the server
 * started, which finishes the sale as `online_delete_guy` did. These tests pin that down.
 */
import { DatabaseSync } from "node:sqlite";
import type { TownState } from "@fq/core";
import type { View } from "@fq/protocol";
import { describe, expect, it } from "vitest";
import { FakeClock } from "../src/clock.js";
import { buttonIds, type Harness, startServer, TestPlayer, toDesk } from "./support/harness.js";

const HOUR = 3_600_000;

function stateOf(h: Harness): TownState {
  const town = h.server.host.get("main");
  if (!town) throw new Error("no town");
  return town.snapshotState;
}

function playerOf(h: Harness, login: string) {
  const p = stateOf(h).players.find((x) => x.logon === login);
  if (!p) throw new Error(`no player ${login}`);
  return p;
}

/** The town row as another process would read it from the database file. */
function storedState(h: Harness): TownState {
  const db = new DatabaseSync(h.dbPath, { readOnly: true });
  try {
    const row = db.prepare("SELECT state_json FROM towns WHERE id = 'main'").get() as {
      state_json: string;
    };
    return JSON.parse(row.state_json) as TownState;
  } finally {
    db.close();
  }
}

/** Without the runtime-only presence map. */
function persisted(s: TownState): unknown {
  const { presence: _presence, ...rest } = s;
  return rest;
}

/** Waits for customers until one is at the table and the negotiation buttons show. */
async function toNegotiation(p: TestPlayer, start: View): Promise<View> {
  let view = start;
  for (let i = 0; i < 400 && !buttonIds(view).includes("neg:done"); i++) {
    const ids = buttonIds(view);
    if (view.overlay?.kind === "message") {
      view = (await p.act({ type: "dismiss", overlayId: view.overlay.id })).body.view;
    } else if (ids.includes("desk:wait")) {
      view = await p.press("desk:wait");
    } else if (ids.includes("go:desk")) {
      view = await p.press("go:desk");
    } else {
      view = await p.press(ids[0] as string);
    }
  }
  expect(buttonIds(view)).toContain("neg:done");
  return view;
}

/** Sells to the customer on the table at once and returns to the desk. */
async function sell(p: TestPlayer): Promise<View> {
  let v = await p.press("neg:done");
  for (let i = 0; i < 8 && !buttonIds(v).includes("desk:wait"); i++) {
    if (v.overlay?.kind === "message") {
      v = (await p.act({ type: "dismiss", overlayId: v.overlay.id })).body.view;
    } else {
      v = await p.press((buttonIds(v).find((id) => id === "go:desk") ?? buttonIds(v)[0]) as string);
    }
  }
  return v;
}

/** `from` writes `text` to `name` through the desk's pen (commands_getname.cpp, commands_send_mail.cpp). */
async function writeLetter(from: TestPlayer, name: string, text: string): Promise<void> {
  await from.press("go:mailbox");
  await from.act({ type: "submitText", overlayId: "mailbox:getname", text: name });
  await from.act({ type: "confirm", overlayId: "mailbox:namenext", accepted: true });
  const sent = await from.act({ type: "submitText", overlayId: "mailbox:compose", text });
  expect(sent.status).toBe(200);
}

describe("a Classic day across a restart", () => {
  it("is on disk before the server stops, and comes back as it was: record, day, turns, mail, customer on the table", async () => {
    let h = await startServer();
    const alice = await new TestPlayer(h, "alice").signUp();
    await alice.enter();
    const bobby = await new TestPlayer(h, "bobby", "bob long password", "10.0.0.2").signUp();
    await bobby.enter();
    await toDesk(bobby);
    let view = await toDesk(alice);

    // A first sale (BP, money and a turn used), then a letter from bobby, then the next customer.
    view = await toNegotiation(alice, view);
    view = await sell(alice);
    await writeLetter(bobby, "alice", "Nice hearse.\r\nSee you at the wake.");
    view = await toNegotiation(alice, view);

    const before = stateOf(h);
    const a = playerOf(h, "alice");
    expect(a.bp).toBeGreaterThan(0);
    expect(a.mail.length).toBeGreaterThan(0); // the letter waits for the next desk visit
    const sessionBefore = before.sessions[String(a.id)];
    expect(sessionBefore?.customer.active).toBe(true);
    const turnsBefore = view.hud?.turns;
    expect(turnsBefore).toBeLessThan(15);

    // Written in the transaction of the last step: another process reading the file sees it all,
    // so a kill needs no shutdown work (the original lost everything since its last auto-save).
    expect(persisted(storedState(h))).toEqual(persisted(before));
    const revision = h.server.host.get("main")?.revision;

    h = await h.restart();
    const after = stateOf(h);
    expect(persisted(after)).toEqual(persisted(before));
    expect(h.server.host.get("main")?.revision).toBe(revision);
    expect(after.day).toBe(before.day);
    expect(playerOf(h, "alice")).toEqual(a);
    expect(playerOf(h, "alice").mail).toEqual(a.mail);
    expect(after.sessions[String(a.id)]?.customer).toEqual(sessionBefore?.customer);
    // Nobody is connected after a restart (the original's `p_on` was runtime-only).
    expect(after.presence?.[String(a.id)]).toBe(false);

    // The same token resumes on the same screen, turns left and all, and the sale can be closed.
    alice.h = h;
    const resumed = await alice.request<{ view: View }>("GET", "/api/towns/main/view");
    expect(resumed.status).toBe(200);
    expect(resumed.body.view).toEqual(view);
    expect(resumed.body.view.hud?.turns).toBe(turnsBefore);
    const bpBefore = a.bp;
    const next = await sell(alice);
    expect(playerOf(h, "alice").bp).toBeGreaterThan(bpBefore);
    expect(next.hud?.turns).toBe(turnsBefore);

    // The letter written before the restart is read when the desk is next shown (the overlay
    // stops the reading at Reply / Continue, broadcast.cpp:14-100), and the queue is empty.
    expect(next.overlay?.kind).toBe("confirm");
    expect(JSON.stringify(next.overlay)).toContain("Nice hearse.");
    expect(playerOf(h, "alice").mail.length).toBeLessThan(a.mail.length);
    await h.stop();
  });

  it("a player who does not come back after a restart is logged off by the time-out and the sale on the table is finished and credited (online_util.cpp:122-132)", async () => {
    let h = await startServer({ config: { idleTimeoutMinutes: 4, idleSweepSeconds: 5 } });
    const p = await new TestPlayer(h, "skelly").signUp();
    await p.enter();
    await toNegotiation(p, await toDesk(p));
    const id = playerOf(h, "skelly").id;
    const bp = playerOf(h, "skelly").bp;
    expect(stateOf(h).sessions[String(id)]?.customer.active).toBe(true);

    h = await h.restart();
    // The sale is still on the table after the restart ...
    expect(stateOf(h).sessions[String(id)]?.customer.active).toBe(true);
    expect(playerOf(h, "skelly").bp).toBe(bp);
    // ... until the idle limit, counted from the server's start, runs out.
    await h.clock.advance(3 * 60_000);
    expect(stateOf(h).sessions[String(id)]).toBeDefined();
    await h.clock.advance(2 * 60_000);
    expect(stateOf(h).sessions[String(id)]).toBeUndefined();
    expect(playerOf(h, "skelly").bp).toBeGreaterThan(bp);
    await h.stop();
  });

  it("carries a day over a restart that spans midnight: the day counter, BP today, the top-seller mail, a new day's turns (maint.cpp:362-415)", async () => {
    const clock = new FakeClock(); // 12:00 UTC
    let h = await startServer({ clock, config: { idleTimeoutMinutes: 10_080 } });
    const dir = h.dir;
    const p = await new TestPlayer(h, "skelly").signUp();
    await p.enter();
    let view = await toNegotiation(p, await toDesk(p));
    view = await sell(p);
    const sold = playerOf(h, "skelly");
    expect(sold.bpToday).toBeGreaterThan(0);
    expect(stateOf(h).day).toBe(1);
    const mailBefore = sold.mail.length;
    const luckBefore = sold.luck;
    const bpBefore = sold.bp;
    expect(view.hud?.turns).toBeLessThan(15);

    // The server goes down at noon and comes back at 1 PM the next day: midnight passed.
    await h.server.close();
    clock.jump(25 * HOUR);
    h = await startServer({ dir, clock, config: { idleTimeoutMinutes: 10_080 } });
    expect(stateOf(h).day).toBe(2);
    const after = playerOf(h, "skelly");
    // Yesterday's BP are in the total, today's are 0; the top seller's mail is waiting
    // (the only player with BP is both the day's top seller and the top parlor, :381-396).
    expect(after.bp).toBe(bpBefore);
    expect(after.bpToday).toBe(0);
    expect(after.mail.length).toBeGreaterThan(mailBefore);

    // Still logged on from before; the next desk visit is a new day with its turns, and the mail's
    // rewards apply as it is read (luck and BP).
    p.h = h;
    await p.press("go:news").catch(() => undefined);
    let v = (await p.request<{ view: View }>("GET", "/api/towns/main/view")).body.view;
    for (let i = 0; i < 8 && playerOf(h, "skelly").mail.length > 0; i++) {
      v =
        v.overlay?.kind === "message"
          ? (await p.act({ type: "dismiss", overlayId: v.overlay.id })).body.view
          : await p
              .press(buttonIds(v).includes("go:desk") ? "go:desk" : (buttonIds(v)[0] as string))
              .catch(() => v);
    }
    const read = playerOf(h, "skelly");
    expect(read.mail.length).toBe(0);
    expect(read.luck).toBeGreaterThan(luckBefore);
    expect(read.bp).toBeGreaterThan(bpBefore);
    await h.stop();
  });
});
