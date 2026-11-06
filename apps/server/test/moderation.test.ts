import { afterEach, describe, expect, it } from "vitest";
import {
  connectSocket,
  type Harness,
  type Socket,
  startServer,
  TestPlayer,
} from "./support/harness.js";
import { admin, announce, chatLines, notices, sendLetter, toCafe } from "./support/safety.js";

let h: Harness | null = null;
const sockets: Socket[] = [];
afterEach(async () => {
  for (const s of sockets.splice(0)) s.close();
  await h?.stop();
  h = null;
});

const HOUR = 3_600_000;
const player = (login: string, n: number) =>
  new TestPlayer(h as Harness, login, `${login} long password`, `10.0.0.${n}`).signUp();
const id = (login: string) => h?.server.accounts.findByLogin(login)?.id as number;
const mod = { "x-moderator": "Morticia" };

interface Entry {
  id: number;
  at: number;
  kind: string;
  accountId: number | null;
  data: Record<string, unknown>;
}
const auditOf = (kind: string) =>
  (h as Harness).server.host.audit.query({ kind, limit: 100 }) as unknown as Entry[];

describe("mutes", () => {
  it("refuses each kind of published text for the scope that covers it, and nothing else", async () => {
    h = await startServer();
    const bobby = await player("bobby", 2);
    await bobby.enter();
    const submit = (overlayId: string, text: string | null) =>
      bobby.act({ type: "submitText", overlayId, text });
    const cases: [string, () => ReturnType<typeof bobby.act>][] = [
      ["chat", () => bobby.act({ type: "chat", text: "hello" })],
      ["mail", () => submit("mailbox:compose", "a letter")],
      ["mail", () => submit("battle:quote", "a quote")],
      ["announcements", () => submit("news:announcement", "an announcement")],
      ["fortunes", () => submit("yangs:sparrow-fortune", "a fortune")],
      ["fortunes", () => submit("yangs:tiger-fortune", "a curse")],
    ];
    // Unmuted, the engine's own guard answers: the action does not match the screen (409).
    for (const [, run] of cases) expect((await run()).status).toBe(409);

    for (const scope of ["chat", "mail", "announcements", "fortunes"] as const) {
      const made = await admin(
        h,
        "POST",
        "/admin/moderation/mute",
        { accountId: id("bobby"), scopes: [scope], hours: 2, reason: `test ${scope}` },
        mod,
      );
      expect(made.status, JSON.stringify(made.body)).toBe(200);
      for (const [covers, run] of cases) {
        const r = await run();
        if (covers === scope) {
          expect(r.status, `${scope} refuses ${covers}`).toBe(403);
          expect(r.body.error).toBe("muted");
          expect(r.body.message).toContain("until");
          expect(r.body.message).toContain("moderators");
        } else {
          expect(r.status, `${scope} leaves ${covers} alone`).toBe(409);
        }
      }
      // Pressing buttons, cancelling a prompt and walking about are never refused.
      expect((await bobby.act({ type: "press", buttonId: "go:desk" })).status).not.toBe(403);
      expect((await submit("mailbox:compose", null)).status).not.toBe(403);
      const lifted = await admin(h, "POST", "/admin/moderation/unmute", {
        muteId: (made.body as { mute: { id: number } }).mute.id,
        reason: "next scope",
      });
      expect(lifted.status).toBe(200);
    }
  });

  it("applies together, shows on /api/me, and ends by itself", async () => {
    h = await startServer();
    const bobby = await player("bobby", 2);
    await toCafe(bobby);
    await admin(h, "POST", "/admin/moderation/mute", {
      accountId: id("bobby"),
      scopes: ["chat", "mail"],
      hours: 3,
      reason: "cooling off",
    });
    const me = await bobby.request<{ mutes: { scopes: string[]; until: string }[] }>(
      "GET",
      "/api/me",
    );
    expect(me.body.mutes).toHaveLength(1);
    expect(me.body.mutes[0]?.scopes).toEqual(["chat", "mail"]);
    expect((await bobby.act({ type: "chat", text: "still here" })).status).toBe(403);
    await h.clock.advance(2 * HOUR);
    expect((await bobby.act({ type: "chat", text: "still here" })).status).toBe(403);
    // The idle sweep may have logged bobby off; he comes back after the mute has run out.
    await h.clock.advance(HOUR + 1000);
    await bobby.enter();
    const me2 = await bobby.request<{ mutes: unknown[] }>("GET", "/api/me");
    expect(me2.body.mutes).toEqual([]);
    await bobby.press("go:desk").catch(() => undefined);
    await bobby.act({ type: "press", buttonId: "go:map" });
    const back = await bobby.act({ type: "visit", placeId: "cafe" });
    expect(back.status).toBe(200);
    expect((await bobby.act({ type: "chat", text: "free again" })).status).toBe(200);
  });

  async function setupAutoMute(config: Record<string, number>) {
    h = await startServer({ config });
    const bobby = await player("bobby", 2);
    await bobby.enter();
    const reporters: TestPlayer[] = [];
    for (let i = 0; i < 4; i++) {
      const p = await player(`rep${i}`, 20 + i);
      await p.enter();
      reporters.push(p);
    }
    const report = (p: TestPlayer) =>
      p.request("POST", "/api/reports", {
        townId: "main",
        target: { kind: "name", name: "bobby" },
        category: "harassment",
      });
    const muted = () => h?.server.host.moderation.muteInfo(id("bobby")).length ?? 0;
    return { bobby, reporters, report, muted };
  }

  it("mutes automatically when several different registered players report one account", async () => {
    const { bobby, reporters, report, muted } = await setupAutoMute({
      autoMuteReports: 3,
      autoMuteWindowMinutes: 30,
      autoMuteHours: 12,
    });
    await report(reporters[0] as TestPlayer);
    await report(reporters[0] as TestPlayer); // the same reporter again counts once
    await report(reporters[1] as TestPlayer);
    expect(muted()).toBe(0);
    // A guest's report is stored but does not count towards the threshold.
    const guest = await bobby.request<{ token: string }>("POST", "/api/auth/guest", {});
    const g = new TestPlayer(h as Harness, "ignored");
    g.token = guest.body.token;
    await g.enter("main", { name: "Guesty", parlor: "Guesty Rest", male: true });
    expect((await report(g)).status).toBe(200);
    expect(muted()).toBe(0);
    // The third distinct registered reporter inside the window mutes, for the configured time.
    await report(reporters[2] as TestPlayer);
    expect(muted()).toBe(1);
    const mute = (h as Harness).server.host.moderation.mutes.active(
      id("bobby"),
      (h as Harness).clock.now(),
    )[0];
    expect(mute).toMatchObject({ auto: true, moderator: "system" });
    expect(mute?.reason).toContain("Automatic");
    expect((mute?.expiresAt ?? 0) - (h as Harness).clock.now()).toBe(12 * HOUR);
    expect((await bobby.act({ type: "chat", text: "hi" })).status).toBe(403);
    const row = auditOf("mod:automute");
    expect(row).toHaveLength(1);
    expect(row[0]?.accountId).toBe(id("bobby"));
    // The mute says nothing of who or how many.
    const refused = await bobby.act({ type: "chat", text: "hi" });
    expect(JSON.stringify(refused.body)).not.toMatch(/rep\d|report|three|3 /i);

    // Dismissing the reports lifts an automatic mute once none is left open.
    const open = await admin<{ reports: { id: number; status: string }[] }>(
      h as Harness,
      "GET",
      "/admin/reports?status=open",
    );
    expect(open.body.reports).toHaveLength(4);
    for (const [i, r] of open.body.reports.entries()) {
      const d = await admin<{ liftedMute: number | null }>(
        h as Harness,
        "POST",
        `/admin/reports/${r.id}/dismiss`,
        { reason: "not abuse" },
        mod,
      );
      expect(d.status).toBe(200);
      expect(d.body.liftedMute !== null).toBe(i === open.body.reports.length - 1);
    }
    expect(muted()).toBe(0);
  });

  it("does not count reports spread over more than the window, and can be turned off", async () => {
    const a = await setupAutoMute({
      autoMuteReports: 3,
      autoMuteWindowMinutes: 30,
      autoMuteHours: 12,
    });
    await a.report(a.reporters[0] as TestPlayer);
    await (h as Harness).clock.advance(20 * 60_000);
    await a.report(a.reporters[1] as TestPlayer);
    await (h as Harness).clock.advance(20 * 60_000);
    await a.report(a.reporters[2] as TestPlayer); // the first is 40 minutes old
    expect(a.muted()).toBe(0);
    await (h as Harness).stop();
    const off = await setupAutoMute({ autoMuteReports: 0 });
    for (const r of off.reporters) await off.report(r);
    expect(off.muted()).toBe(0);
  });
});

describe("report retention", () => {
  it("keeps open reports and deletes closed ones after the retention period", async () => {
    h = await startServer({ config: { reportRetentionDays: 10, autoMuteReports: 0 } });
    const alice = await player("alice", 1);
    const bobby = await player("bobby", 2);
    const carol = await player("carol", 3);
    for (const p of [alice, bobby, carol]) await p.enter();
    for (const [i, p] of [alice, carol].entries()) {
      await p.request("POST", "/api/reports", {
        townId: "main",
        target: { kind: "name", name: "bobby" },
        category: i === 0 ? "spam" : "hate",
      });
    }
    const [first] = (h as Harness).server.host.moderation.reports.list({ limit: 5 }).reverse();
    await admin(h as Harness, "POST", `/admin/reports/${first?.id}/dismiss`, { reason: "fine" });
    expect((h as Harness).server.host.moderation.pruneReports()).toBe(0);
    // The hourly housekeeping does the pruning as the days pass.
    await (h as Harness).clock.advance(11 * 24 * HOUR);
    const left = (h as Harness).server.host.moderation.reports.list({ limit: 5 });
    expect(left.map((r) => r.status)).toEqual(["open"]);
  });
});

describe("operator actions", () => {
  async function reported() {
    h = await startServer({ listen: true, config: { autoMuteReports: 0 } });
    const alice = await player("alice", 1);
    const bobby = await player("bobby", 2);
    const carol = await player("carol", 3);
    await alice.enter();
    await bobby.enter();
    await carol.enter();
    const filed = await alice.request("POST", "/api/reports", {
      townId: "main",
      target: { kind: "name", name: "bobby" },
      category: "other",
      note: "nasty name",
    });
    expect(filed.status).toBe(200);
    const queue = await admin<{ reports: { id: number }[] }>(h, "GET", "/admin/reports");
    return { alice, bobby, carol, reportId: queue.body.reports[0]?.id as number };
  }

  const why = "house rules, section two";

  it("requires a reason for every action and the admin token for every route", async () => {
    const { reportId } = await reported();
    const body = { accountId: id("bobby"), reportId };
    for (const [url, extra] of [
      ["/admin/moderation/warn", { message: "behave" }],
      ["/admin/moderation/takedown", {}],
      ["/admin/moderation/mute", { scopes: ["chat"], hours: 1 }],
      ["/admin/moderation/rename", { townId: "main", playerId: 1, name: "Newname" }],
      ["/admin/moderation/delete-account", { confirm: true }],
    ] as const) {
      const r = await admin(h as Harness, "POST", url, { ...body, ...extra });
      expect(r.status, url).toBe(400);
    }
    expect(
      (await admin(h as Harness, "POST", `/admin/reports/${reportId}/dismiss`, {})).status,
    ).toBe(400);
    // Nothing changed, and the report is still open.
    expect(auditOf("admin:").filter((e) => e.kind !== "admin:town:create")).toEqual([]);
    const routes: [string, string][] = [
      ["GET", "/admin/reports"],
      ["GET", `/admin/reports/${reportId}`],
      ["POST", `/admin/reports/${reportId}/dismiss`],
      ["POST", `/admin/reports/${reportId}/resolve`],
      ["GET", "/admin/moderation/mutes"],
      ["POST", "/admin/moderation/warn"],
      ["POST", "/admin/moderation/takedown"],
      ["POST", "/admin/moderation/rename"],
      ["POST", "/admin/moderation/mute"],
      ["POST", "/admin/moderation/unmute"],
      ["POST", "/admin/moderation/delete-account"],
      ["GET", `/admin/accounts/${id("bobby")}/moderation`],
    ];
    for (const [method, url] of routes) {
      for (const token of [undefined, "wrong".repeat(8)]) {
        const res = await (h as Harness).inject({
          method: method as "GET",
          url,
          headers: token ? { authorization: `Bearer ${token}` } : {},
        });
        expect(res.statusCode, `${method} ${url}`).toBe(401);
      }
    }
    // A player's own token is not the admin's.
    const alice = new TestPlayer(h as Harness, "alice", "alice long password");
    await alice.logIn();
    expect((await alice.request("GET", "/admin/reports")).status).toBe(401);
  });

  it("serves the moderation page as an empty shell and keeps every fact behind the token", async () => {
    await reported();
    const page = await (h as Harness).inject({ method: "GET", url: "/admin/" });
    expect(page.statusCode).toBe(200);
    expect(page.headers["content-type"]).toContain("text/html");
    const csp = String(page.headers["content-security-policy"]);
    expect(csp).toMatch(/script-src 'nonce-[\w+/=]+'/);
    expect(csp).toContain("default-src 'none'");
    expect(csp).not.toContain("unsafe-inline");
    // No data and no secrets in the page: not the token, nothing a player wrote, no names.
    expect(page.body).not.toContain("test-admin-token");
    expect(page.body).not.toContain("nasty name");
    expect(page.body).not.toContain("bobby");
    expect(page.body).toContain("Funeral Quest moderation");
    // The nonce differs per response.
    const again = await (h as Harness).inject({ method: "GET", url: "/admin" });
    expect(again.headers["content-security-policy"]).not.toBe(csp);
    await (h as Harness).stop();
    h = await startServer({ config: { adminToken: "" } });
    expect((await h.inject({ method: "GET", url: "/admin/" })).statusCode).toBe(503);
  });

  it("warns with a letter the player finds at the desk, and records who, why and when", async () => {
    const { bobby, reportId } = await reported();
    const socket = await connectSocket(h as Harness, bobby.token);
    sockets.push(socket);
    (h as Harness).clock.advance(1000);
    const r = await admin<{ delivered: string[] }>(
      h as Harness,
      "POST",
      "/admin/moderation/warn",
      { accountId: id("bobby"), message: "Please pick a kinder name.", reason: why, reportId },
      mod,
    );
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.delivered).toEqual(["main"]);
    await socket.until((m) => notices(m).some((n) => n.kind === "mail"));
    let view = await bobby.press("go:desk");
    for (let i = 0; i < 4 && !view.overlay; i++) view = await bobby.press("go:desk");
    expect(JSON.stringify(view.overlay)).toContain("Please pick a kinder name.");
    expect(JSON.stringify(view.overlay)).toContain("management");
    // Closed, with the reason; the audit row carries moderator, reason, time and the report.
    const detail = await admin<{
      report: { status: string; resolvedBy: string; resolution: string; resolutionNote: string };
    }>(h as Harness, "GET", `/admin/reports/${reportId}`);
    expect(detail.body.report).toMatchObject({
      status: "actioned",
      resolvedBy: "Morticia",
      resolution: "warned",
      resolutionNote: why,
    });
    const [row] = auditOf("admin:warn");
    expect(row).toMatchObject({ accountId: id("bobby") });
    expect(row?.data).toMatchObject({ moderator: "Morticia", reason: why, reportId });
    expect(row?.at).toBe((h as Harness).clock.now());
  });

  it("takes text down per player: announcements and mail separately, or both", async () => {
    const { alice, bobby, carol } = await reported();
    const town = (h as Harness).server.host.get("main");
    const post = async () => {
      expect((await announce(bobby, "Bobby's Burials is the finest in town")).status).toBe(200);
      expect(await sendLetter(bobby, "carol", "Dear Carol, you owe me money")).toBe(200);
      expect(await sendLetter(bobby, "alice", "Dear Alice, you owe me too")).toBe(200);
    };
    const paper = () => JSON.stringify(town?.snapshotState.news);
    const mail = (n: number) => JSON.stringify(town?.snapshotState.players[n]?.mail);
    await post();
    expect(paper()).toContain("finest in town");
    expect(mail(2)).toContain("owe me money");

    const takedown = (scope: string) =>
      admin<{ removed: { announcements: number; letters: number }[] }>(
        h as Harness,
        "POST",
        "/admin/moderation/takedown",
        { accountId: id("bobby"), scope, reason: why },
        mod,
      );
    const only = await takedown("announcements");
    expect(only.body.removed[0]).toMatchObject({ announcements: 1 });
    expect(paper()).not.toContain("finest in town");
    expect(mail(2)).toContain("owe me money"); // the letters are untouched
    expect(mail(0)).toContain("owe me too");

    await post();
    const mailOnly = await takedown("mail");
    expect(mailOnly.body.removed[0]).toMatchObject({ letters: 4 });
    expect(mail(2)).not.toContain("owe me money");
    expect(mail(0)).not.toContain("owe me too");
    expect(paper()).toContain("finest in town"); // the announcements are untouched

    const all = await takedown("all");
    expect(all.body.removed[0]).toMatchObject({ announcements: 1 });
    expect(paper()).not.toContain("finest in town");
    // The takedown is audited, with what it removed.
    const rows = auditOf("admin:takedown");
    expect(rows).toHaveLength(3);
    expect(rows[2]?.data).toMatchObject({
      moderator: "Morticia",
      reason: why,
      scope: "announcements",
    });
    expect(alice && carol).toBeTruthy();
  });

  it("forces a rename, in the rankings and the stored paper, and refuses bad ones", async () => {
    const { bobby } = await reported();
    const town = (h as Harness).server.host.get("main");
    expect(JSON.stringify(town?.snapshotState.news)).toContain("bobby");
    const rename = (body: object) =>
      admin<{ error?: string }>(
        h as Harness,
        "POST",
        "/admin/moderation/rename",
        { townId: "main", playerId: 1, reason: why, ...body },
        mod,
      );
    expect((await rename({ name: "al" })).status).toBe(400);
    const taken = await rename({ name: "alice" });
    expect(taken.status).toBe(409);
    expect((await rename({ name: "Bad@Name" })).status).toBe(400);
    const ok = await rename({ name: "Mr Renamed", parlor: "Renamed Rest" });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(town?.snapshotState.players[1]).toMatchObject({
      name: "Mr Renamed",
      parlor: "Renamed Rest",
    });
    const info = JSON.stringify((await bobby.request("GET", "/api/towns/main")).body);
    expect(info).toContain("Mr Renamed");
    expect(info).not.toContain('"bobby"');
    expect(JSON.stringify(town?.snapshotState.news)).not.toContain("run by bobby");
    const [row] = auditOf("admin:rename");
    expect(row?.data).toMatchObject({
      moderator: "Morticia",
      reason: why,
      before: { name: "bobby", parlor: "bobby Rest" },
      after: { name: "Mr Renamed", parlor: "Renamed Rest" },
    });
  });

  it("kicks, bans an account and an address range, each with its reason", async () => {
    const { bobby, reportId } = await reported();
    const socket = await connectSocket(h as Harness, bobby.token);
    sockets.push(socket);
    const kick = await admin(
      h as Harness,
      "POST",
      "/admin/towns/main/players/1/kick",
      { reason: "spamming", reportId },
      mod,
    );
    expect(kick.status).toBe(200);
    await socket.until((m) => notices(m).some((n) => n.kind === "sessionEnded"));
    expect(notices(socket.messages).find((n) => n.kind === "sessionEnded")).toMatchObject({
      reason: "kicked",
    });
    expect(auditOf("admin:kick")[0]?.data).toMatchObject({
      moderator: "Morticia",
      reason: "spamming",
      reportId,
    });

    const ban = await admin(
      h as Harness,
      "POST",
      `/admin/accounts/${id("bobby")}/ban`,
      { reason: "repeat abuse" },
      mod,
    );
    expect(ban.status).toBe(200);
    expect((await bobby.request("GET", "/api/me")).status).toBe(401);
    expect(
      (
        await new TestPlayer(h as Harness, "bobby", "bobby long password").request(
          "POST",
          "/api/auth/login",
          { login: "bobby", password: "bobby long password" },
        )
      ).status,
    ).toBe(403);
    const ipban = await admin(
      h as Harness,
      "POST",
      "/admin/bans",
      { prefix: "10.0.0", reason: "range abuse", expiresInHours: 1 },
      mod,
    );
    expect(ipban.status).toBe(201);
    const carol = new TestPlayer(h as Harness, "carol", "carol long password", "10.0.0.3");
    expect(
      (
        await carol.request("POST", "/api/auth/login", {
          login: "carol",
          password: "carol long password",
        })
      ).status,
    ).toBe(403);
    expect(auditOf("admin:account-ban")[0]?.data).toMatchObject({
      moderator: "Morticia",
      reason: "repeat abuse",
    });
    expect(auditOf("admin:ip-ban")[0]?.data).toMatchObject({
      moderator: "Morticia",
      reason: "range abuse",
    });
    // Lifted again.
    const bans = await admin<{ bans: { id: number }[] }>(h as Harness, "GET", "/admin/bans");
    expect(
      (await admin(h as Harness, "DELETE", `/admin/bans/${bans.body.bans[0]?.id}`)).status,
    ).toBe(204);
    expect((await admin(h as Harness, "POST", `/admin/accounts/${id("bobby")}/unban`)).status).toBe(
      200,
    );
  });

  it("dismisses a report, and shows a player's whole history", async () => {
    const { reportId } = await reported();
    const d = await admin(
      h as Harness,
      "POST",
      `/admin/reports/${reportId}/dismiss`,
      { reason: "a fine name" },
      mod,
    );
    expect(d.status).toBe(200);
    expect(
      (
        await admin(
          h as Harness,
          "POST",
          `/admin/reports/${reportId}/dismiss`,
          { reason: "again" },
          mod,
        )
      ).status,
    ).toBe(409);
    await admin(
      h as Harness,
      "POST",
      "/admin/moderation/mute",
      { accountId: id("bobby"), scopes: ["chat"], hours: 1, reason: "test" },
      mod,
    );
    const history = await admin<{
      account: { login: string; activeMutes: unknown[]; recentAddresses: string[] };
      reportsAbout: { status: string }[];
      mutes: unknown[];
      actions: { kind: string }[];
    }>(h as Harness, "GET", `/admin/accounts/${id("bobby")}/moderation`);
    expect(history.body.account.login).toBe("bobby");
    expect(history.body.account.activeMutes).toHaveLength(1);
    expect(history.body.account.recentAddresses).toEqual(["10.0.0.2"]);
    expect(history.body.reportsAbout.map((r) => r.status)).toEqual(["dismissed"]);
    expect(history.body.actions.map((a) => a.kind)).toEqual(
      expect.arrayContaining(["admin:report-dismiss", "admin:mute"]),
    );
    const open = await admin<{ reports: unknown[] }>(
      h as Harness,
      "GET",
      "/admin/reports?status=open",
    );
    expect(open.body.reports).toEqual([]);
    const closed = await admin<{ reports: unknown[] }>(
      h as Harness,
      "GET",
      "/admin/reports?status=dismissed&kind=name&category=other",
    );
    expect(closed.body.reports).toHaveLength(1);
    expect(chatLines([])).toEqual([]);
  });
});
