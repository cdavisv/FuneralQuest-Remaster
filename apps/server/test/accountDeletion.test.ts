import { afterEach, describe, expect, it } from "vitest";
import { type Harness, startServer, TestPlayer } from "./support/harness.js";
import { admin, announce, sendLetter, toCafe, viewOf } from "./support/safety.js";

let h: Harness | null = null;
afterEach(async () => {
  await h?.stop();
  h = null;
});

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** What must be gone: the departed player's names, in any letter case. */
const GONE = [/bartholomew/i, /barty/i, /\bbobby\b/i];
const hits = (text: string) => GONE.filter((re) => re.test(text)).map(String);

async function season() {
  h = await startServer({
    listen: true,
    towns: [
      {
        id: "main",
        name: "Dead Calm",
        seed: 7,
        settings: { tournamentActive: true, tournamentDays: 3 },
      },
    ],
    config: { idleTimeoutMinutes: 10_080, autoMuteReports: 0 },
  });
  const make = (login: string, n: number) =>
    new TestPlayer(h as Harness, login, `${login} long password`, `10.0.0.${n}`).signUp();
  const alice = await make("alice", 1);
  const bobby = await make("bobby", 2);
  const carol = await make("carol", 3);
  const form = { name: "Bartholomew", parlor: "Barty Burials", male: true };
  // Season one: everyone plays, the tournament ends, the hall of fame records the names.
  await alice.enter("main", { name: "Alice A", parlor: "Alice Rest", male: false });
  await bobby.enter("main", form);
  await carol.enter("main", { name: "Carol C", parlor: "Carol Rest", male: false });
  await (h as Harness).clock.advance(3 * DAY + 13 * HOUR);
  return { alice, bobby, carol, form };
}

describe("account deletion", () => {
  it("removes the player's names and texts from every place another player could see them", async () => {
    const { alice, bobby, carol, form } = await season();
    const hall = (
      await alice.request<{ entries: { standings: { name: string }[] }[] }>(
        "GET",
        "/api/hall-of-fame",
      )
    ).body;
    expect(JSON.stringify(hall)).toContain("Bartholomew");

    // Season two: bobby comes back under the same name and fills the town with himself.
    await alice.enter("main", { name: "Alice A", parlor: "Alice Rest", male: false });
    await bobby.enter("main", form);
    await carol.enter("main", { name: "Carol C", parlor: "Carol Rest", male: false });
    expect((await announce(bobby, "Barty's bargain boxes, today only")).status).toBe(200);
    expect(await sendLetter(bobby, "Alice", "Dear Alice, Barty here, you owe me")).toBe(200);
    expect(await sendLetter(bobby, "Carol", "Dear Carol, Barty here too")).toBe(200);
    await toCafe(alice);
    await toCafe(bobby);
    await bobby.act({ type: "chat", text: "Barty says hello to the cafe" });
    const database = (h as Harness).server.db;
    const today = new Date((h as Harness).clock.now()).toISOString().slice(0, 10);
    database
      .prepare(
        `INSERT INTO challenge_runs (day, account_id, guest, status, abandoned, name, parlor, started_at,
           updated_at, finished_at, score, state_json) VALUES (?, ?, 0, 'finished', 0, 'Bartholomew',
           'Barty Burials', 1, 1, 1, 99, '{}')`,
      )
      .run(today, bobby.accountId);
    // Reports in every state, and blocks both ways.
    await carol.request("POST", "/api/reports", {
      townId: "main",
      target: { kind: "name", name: "Bartholomew" },
      category: "other",
    });
    await alice.request("POST", "/api/reports", {
      townId: "main",
      target: { kind: "name", name: "Bartholomew" },
      category: "spam",
    });
    await bobby.request("POST", "/api/reports", {
      townId: "main",
      target: { kind: "name", name: "Carol C" },
      category: "spam",
    });
    await bobby.request("POST", "/api/reports", {
      townId: "main",
      target: { kind: "name", name: "Alice A" },
      category: "spam",
    });
    const queue = await admin<{
      reports: { id: number; reportedName: string; reporterAccountId: number }[];
    }>(h as Harness, "GET", "/admin/reports");
    const aliceReport = queue.body.reports.find(
      (r) => r.reportedName === "Bartholomew" && r.reporterAccountId === alice.accountId,
    );
    const bobbyAtAlice = queue.body.reports.find((r) => r.reportedName === "Alice A");
    await admin(h as Harness, "POST", `/admin/reports/${aliceReport?.id}/dismiss`, {
      reason: "fine",
    });
    await admin(h as Harness, "POST", `/admin/reports/${bobbyAtAlice?.id}/dismiss`, {
      reason: "fine",
    });
    await alice.request("POST", "/api/blocks", {
      townId: "main",
      target: { kind: "name", name: "Bartholomew" },
    });
    await bobby.request("POST", "/api/blocks", {
      townId: "main",
      target: { kind: "name", name: "Carol C" },
    });
    await admin(h as Harness, "POST", "/admin/towns/main/snapshots", { reason: "before deletion" });
    const town = (h as Harness).server.host.get("main");
    expect(JSON.stringify(town?.snapshotState)).toContain("Barty");
    const dropped = (h as Harness).server.host.moderation.chat.size("main");
    expect(dropped).toBeGreaterThan(0);

    // The hall of fame remembers whose names it holds (so a deletion can take them out).
    expect(
      (
        database
          .prepare("SELECT count(*) AS n FROM hall_owners WHERE account_id = ?")
          .get(bobby.accountId) as { n: number }
      ).n,
    ).toBeGreaterThan(0);

    // --- the deletion: wrong password first, then the right one.
    const no = await bobby.request("POST", "/api/me/delete", { confirm: true });
    expect(no.status).toBe(400);
    const wrong = await bobby.request("POST", "/api/me/delete", {
      password: "not the password",
      confirm: true,
    });
    expect(wrong.status).toBe(401);
    expect(h?.server.accounts.findByLogin("bobby")).toBeDefined();
    const socketUrl = (h as Harness).wsUrl();
    expect(socketUrl).toContain("ws://");
    const gone = await bobby.request("POST", "/api/me/delete", {
      password: bobby.password,
      confirm: true,
    });
    expect(gone.status).toBe(204);

    // --- the account and what hangs off it
    expect(h?.server.accounts.findByLogin("bobby")).toBeUndefined();
    expect((await bobby.request("GET", "/api/me")).status).toBe(401);
    expect(
      (
        await new TestPlayer(h as Harness, "bobby", bobby.password).request(
          "POST",
          "/api/auth/login",
          { login: "bobby", password: bobby.password },
        )
      ).status,
    ).toBe(401);
    const count = (sql: string) => (database.prepare(sql).get() as { n: number }).n;
    expect(count("SELECT count(*) AS n FROM sessions WHERE account_id = " + bobby.accountId)).toBe(
      0,
    );
    expect(count("SELECT count(*) AS n FROM parlors WHERE account_id = " + bobby.accountId)).toBe(
      0,
    );
    expect(
      count("SELECT count(*) AS n FROM challenge_runs WHERE account_id = " + bobby.accountId),
    ).toBe(0);
    expect(count("SELECT count(*) AS n FROM account_blocks")).toBe(0);
    expect(
      count("SELECT count(*) AS n FROM hall_owners WHERE account_id = " + bobby.accountId),
    ).toBe(0);
    expect((h as Harness).server.host.moderation.chat.size("main")).toBeLessThan(dropped);

    // --- the town: the slot is closed, its text and name are gone from the state and the rollback copies
    const state = JSON.stringify(town?.snapshotState);
    expect(hits(state)).toEqual([]);
    const slot = town?.snapshotState.players.find((p) => p.logon.startsWith("closed-"));
    expect(slot).toMatchObject({
      active: false,
      name: "A Closed Parlor",
      parlor: "A Closed Parlor",
      mail: [],
    });
    for (const snap of (h as Harness).server.host.townStore.allSnapshotStates("main")) {
      expect(hits(snap.state_json), `snapshot ${snap.id}`).toEqual([]);
    }
    // Other players' blocks of him are gone from the engine as well.
    expect(town?.snapshotState.blocks).toBeUndefined();
    // And the hall of fame, which is a record, keeps its place but not his name.
    const hallRows = database.prepare("SELECT * FROM hall_of_fame").all();
    expect(hits(JSON.stringify(hallRows))).toEqual([]);
    expect(JSON.stringify(hallRows)).toContain("A Closed Parlor");

    // --- every public endpoint
    const pages = [
      "/health",
      "/api/features",
      "/api/towns",
      "/api/towns/main",
      "/api/hall-of-fame",
      "/api/towns/main/hall-of-fame",
      "/api/daily",
      `/api/daily/leaderboard?day=${today}`,
      "/api/daily/days",
    ];
    const seen: string[] = [];
    for (const url of pages) {
      const r = await (h as Harness).inject({ method: "GET", url });
      seen.push(r.body);
    }
    expect(hits(seen.join("\n"))).toEqual([]);
    expect(seen.join("\n")).toContain("Alice A");

    // --- what other players see on every screen that could show him
    const views: string[] = [];
    for (const p of [alice, carol]) {
      views.push(JSON.stringify(await viewOf(p)));
      await p.act({ type: "press", buttonId: "go:map" });
      const home = await p.act({ type: "visit", placeId: "funeral-home" });
      views.push(JSON.stringify(home.body));
      let desk = home.body.view;
      for (let i = 0; i < 6; i++) {
        // Read all the mail, reply prompts included.
        views.push(JSON.stringify(desk));
        const over = desk.overlay;
        const next = over
          ? over.kind === "confirm"
            ? await p.act({ type: "confirm", overlayId: over.id, accepted: false })
            : over.kind === "message"
              ? await p.act({ type: "dismiss", overlayId: over.id })
              : await p.act({ type: "submitText", overlayId: over.id, text: null })
          : await p.act({
              type: "press",
              buttonId: desk.buttons.find((b) => b.id === "go:desk")?.id ?? "go:news",
            });
        if (next.status !== 200) break;
        desk = next.body.view;
      }
      for (const button of ["go:news", "news:crime", "news:yesterday", "go:rankings"]) {
        const r = await p.act({ type: "press", buttonId: button });
        views.push(JSON.stringify(r.body));
        if (r.status === 200 && r.body.view.overlay)
          await p.act({ type: "dismiss", overlayId: r.body.view.overlay.id });
      }
      await p.act({ type: "press", buttonId: "go:desk" });
      await p.act({ type: "press", buttonId: "go:map" });
      views.push(JSON.stringify((await p.act({ type: "visit", placeId: "competitors" })).body));
    }
    const walked = views.join("\n");
    expect(walked).toContain("Alice A"); // the walk really saw the town
    expect(hits(walked)).toEqual([]);
    expect(JSON.stringify(town?.snapshotState.players.flatMap((p) => p.mail))).not.toMatch(
      /Barty|Bartholomew|owe me/,
    );

    // --- the audit log: nothing he typed; his moderation record and the deletion note remain
    const rows = (h as Harness).server.host.audit.query({ limit: 5000 });
    // Only the deletion note and the moderation records about him (here, a dismissed report).
    expect(
      rows
        .filter((r) => r.accountId === bobby.accountId)
        .map((r) => r.kind)
        .sort(),
    ).toEqual(["account:deleted", "admin:report-dismiss"]);
    expect(hits(JSON.stringify(rows))).toEqual([]);
    const note = rows.find((r) => r.kind === "account:deleted");
    expect(note?.data).toMatchObject({ by: "self", guest: false, openReportsKept: 1 });

    // --- reports: resolved ones go, the open report about him stays (with its evidence),
    // and the open report he filed stays without him.
    const left = (h as Harness).server.host.moderation.reports.list({ limit: 50 });
    expect(left.map((r) => [r.status, r.reported_name, r.reporter_account_id])).toEqual(
      expect.arrayContaining([
        ["open", "Bartholomew", carol.accountId],
        ["open", "Carol C", null],
      ]),
    );
    expect(left).toHaveLength(2);
  });

  it("deletes a guest without a password, and keeps a wrong password from being guessed", async () => {
    h = await startServer({ config: { rateAuthMax: 100 } });
    const guest = await new TestPlayer(h, "ignored").request<{ token: string }>(
      "POST",
      "/api/auth/guest",
      {},
    );
    const g = new TestPlayer(h, "ignored");
    g.token = guest.body.token;
    await g.enter("main", { name: "Guesty", parlor: "Guesty Rest", male: true });
    expect((await g.request("POST", "/api/me/delete", {})).status).toBe(400);
    expect((await g.request("POST", "/api/me/delete", { confirm: false })).status).toBe(400);
    expect((await g.request("POST", "/api/me/delete", { confirm: true })).status).toBe(204);
    expect((await g.request("GET", "/api/me")).status).toBe(401);
    expect(h.server.host.get("main")?.snapshotState.players[0]).toMatchObject({
      active: false,
      name: "A Closed Parlor",
    });

    const p = await new TestPlayer(h, "dora", "dora long password", "10.0.0.9").signUp();
    for (let i = 0; i < 10; i++) {
      expect(
        (await p.request("POST", "/api/me/delete", { password: "wrong password", confirm: true }))
          .status,
      ).toBe(401);
    }
    // Locked, as a log-in would be: even the right password waits.
    expect(
      (await p.request("POST", "/api/me/delete", { password: p.password, confirm: true })).status,
    ).toBe(429);
    expect(h.server.accounts.findByLogin("dora")).toBeDefined();
  });

  it("is what an administrator's account delete does, and what a request by e-mail would use", async () => {
    h = await startServer();
    const bobby = await new TestPlayer(h, "bobby", "bobby long password", "10.0.0.2").signUp();
    const alice = await new TestPlayer(h, "alice", "alice long password", "10.0.0.1").signUp();
    await alice.enter("main", { name: "Alice A", parlor: "Alice Rest", male: false });
    await bobby.enter("main", { name: "Bartholomew", parlor: "Barty Burials", male: true });
    await announce(bobby, "Barty's bargain boxes");
    const r = await h.inject({
      method: "DELETE",
      url: `/admin/accounts/${bobby.accountId}?reason=${encodeURIComponent("emailed request, identity checked")}`,
      headers: {
        authorization: "Bearer test-admin-token-0123456789abcdef",
        "x-moderator": "Morticia",
      },
    });
    expect(r.statusCode).toBe(204);
    expect(hits(JSON.stringify(h.server.host.get("main")?.snapshotState))).toEqual([]);
    const note = h.server.host.audit.query({ kind: "admin:account-delete", limit: 5 })[0];
    expect(note?.data).toMatchObject({
      moderator: "Morticia",
      reason: "emailed request, identity checked",
    });
    // Deleting a parlor alone (the account stays) cleans the text the same way.
    await alice.enter();
    await announce(alice, "Alice's affordable arrangements");
    expect((await admin(h, "DELETE", "/admin/towns/main/players/0")).status).toBe(204);
    expect(JSON.stringify(h.server.host.get("main")?.snapshotState)).not.toContain("affordable");
    expect(JSON.stringify(h.server.host.get("main")?.snapshotState)).not.toContain("Alice A");
  });
});

describe("the public deletion page", () => {
  it("explains how to ask without logging in, with a marked blank for the contact", async () => {
    h = await startServer();
    const page = await h.inject({ method: "GET", url: "/account/delete" });
    expect(page.statusCode).toBe(200);
    expect(page.headers["content-type"]).toContain("text/html");
    expect(page.body).toContain("Delete your Funeral Quest account");
    expect(page.body).toContain("OPERATOR TO FILL IN");
    expect(page.body).toContain("Settings");
    await h.stop();
    h = await startServer({ config: { contactEmail: "graves@example.org" } });
    const set = await h.inject({ method: "GET", url: "/account/delete" });
    expect(set.body).toContain("mailto:graves@example.org");
    expect(set.body).not.toContain("OPERATOR TO FILL IN");
    const features = JSON.parse((await h.inject({ method: "GET", url: "/api/features" })).body);
    expect(features.safety).toMatchObject({
      contactEmail: "graves@example.org",
      deletionPath: "/account/delete",
    });
  });
});

describe("data export", () => {
  it("returns what is stored about the account and nothing that belongs to other players", async () => {
    h = await startServer({ listen: true, config: { autoMuteReports: 0 } });
    const alice = await new TestPlayer(h, "alice", "alice long password", "10.0.0.1").signUp();
    const bobby = await new TestPlayer(h, "bobby", "bobby long password", "10.0.0.2").signUp();
    await alice.enter("main", { name: "Alice A", parlor: "Alice Rest", male: false });
    await bobby.enter("main", { name: "Bobby B", parlor: "Bobby Rest", male: true });
    await toCafe(bobby);
    await bobby.act({ type: "chat", text: "a cafe remark nobody stores" });
    expect(await sendLetter(alice, "Bobby B", "Dear Bobby, a secret from Alice")).toBe(200);
    expect(await sendLetter(bobby, "Alice A", "Dear Alice, Bobby's own letter")).toBe(200);
    await bobby.request("POST", "/api/blocks", {
      townId: "main",
      target: { kind: "name", name: "Alice A" },
    });
    await bobby.request("POST", "/api/reports", {
      townId: "main",
      target: { kind: "name", name: "Alice A" },
      category: "spam",
      note: "my note",
    });
    await alice.request("POST", "/api/reports", {
      townId: "main",
      target: { kind: "name", name: "Bobby B" },
      category: "other",
      note: "alice's secret note",
    });

    const res = await bobby.request<
      Record<string, unknown> & {
        activity: { kind: string; data: unknown }[];
        parlors: { player: Record<string, unknown>; mailWaiting: number }[];
      }
    >("GET", "/api/me/export");
    expect(res.status).toBe(200);
    const data = res.body;
    expect(Object.keys(data).sort()).toEqual(
      [
        "account",
        "activity",
        "blocks",
        "dailyChallenge",
        "daysPlayed",
        "exportedAt",
        "format",
        "hallOfFame",
        "mutes",
        "notRepeated",
        "parlors",
        "reportsAboutYou",
        "reportsFiled",
        "sessions",
      ].sort(),
    );
    expect(data.account).toMatchObject({ login: "bobby", guest: false });
    expect(data.sessions).toEqual([expect.objectContaining({ ip: "10.0.0.2" })]);
    expect(data.parlors[0]?.player).toMatchObject({
      name: "Bobby B",
      parlor: "Bobby Rest",
      logon: "bobby",
    });
    expect(data.parlors[0]?.player).not.toHaveProperty("mail");
    expect(typeof data.parlors[0]?.mailWaiting).toBe("number");
    expect(data.blocks).toEqual([expect.objectContaining({ name: "Alice A" })]);
    expect(data.reportsFiled).toEqual([
      expect.objectContaining({ kind: "name", category: "spam", note: "my note", status: "open" }),
    ]);
    expect(data.reportsAboutYou).toEqual({ count: 1 });
    // What he typed is there (a letter) and cafe talk is not.
    const typed = JSON.stringify(data.activity);
    expect(typed).toContain("Bobby's own letter");
    expect(typed).not.toContain("a cafe remark");
    // Nothing of the others: their letter, their note, their login, the other account's ids.
    const all = JSON.stringify(data);
    expect(all).not.toContain("a secret from Alice");
    expect(all).not.toContain("alice's secret note");
    expect(all).not.toMatch(/"alice"/);
    expect(all).not.toContain("alice long password");
    expect(all).not.toContain("fq_");
    for (const row of data.activity.filter((r) => r.kind.startsWith("safety:")))
      expect(row.data).toBeNull();
  });
});
