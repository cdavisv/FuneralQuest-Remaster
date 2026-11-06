import { richTextToPlain } from "@fq/core";
import { afterEach, describe, expect, it } from "vitest";
import {
  connectSocket,
  type Harness,
  type Socket,
  startServer,
  TestPlayer,
} from "./support/harness.js";
import { admin, announce, chatLines, sendLetter, toCafe } from "./support/safety.js";

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

interface ReportDetail {
  report: {
    id: number;
    status: string;
    kind: string;
    category: string;
    text: string;
    verified: boolean;
    where: string;
    townId: string;
    note: string | null;
    authoredAt: string | null;
    reportedLogin: string | null;
    reporter: { login: string } | null;
    evidence: { chatWindow: { text: string; reported?: boolean; from: string | null }[] };
  };
  reported: { login: string } | null;
}

const filed = (r: { status: number; body: unknown }) => {
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body as {
    ok: true;
    duplicate: boolean;
    blockOffer: { name: string } | null;
    blocked: boolean;
  };
};

describe("reporting", () => {
  it("stores a cafe line with its author, place, time and the lines around it", async () => {
    h = await startServer({ listen: true });
    const alice = await player("alice", 1);
    const bobby = await player("bobby", 2);
    const carol = await player("carol", 3);
    for (const p of [alice, bobby, carol]) await toCafe(p);
    const aliceSocket = await connectSocket(h, alice.token);
    sockets.push(aliceSocket);

    await carol.act({ type: "chat", text: "Lovely weather for a wake" });
    await bobby.act({ type: "chat", text: "Alice you are a rotten embalmer" });
    await carol.act({ type: "chat", text: "Now now" });
    await bobby.act({ type: "chat", text: "a perfectly ordinary remark" });
    await aliceSocket.until((m) => chatLines(m).some((l) => l.includes("ordinary remark")));
    const shown = (needle: string) =>
      chatLines(aliceSocket.messages).find((l) => l.includes(needle)) as string;

    await h.clock.advance(5000);
    const result = filed(
      await alice.request("POST", "/api/reports", {
        townId: "main",
        target: { kind: "chat", text: shown("rotten embalmer") },
        category: "harassment",
        note: "  He keeps doing this  ",
      }),
    );
    expect(result).toMatchObject({
      ok: true,
      duplicate: false,
      blocked: false,
      blockOffer: { name: "bobby" },
    });

    const queue = await admin<{ reports: { id: number }[] }>(
      h,
      "GET",
      "/admin/reports?status=open",
    );
    expect(queue.body.reports).toHaveLength(1);
    const detail = await admin<ReportDetail>(
      h,
      "GET",
      `/admin/reports/${queue.body.reports[0]?.id}`,
    );
    const r = detail.body.report;
    expect(r).toMatchObject({
      kind: "chat",
      category: "harassment",
      verified: true,
      where: "the cafe",
      townId: "main",
      note: "He keeps doing this",
      reportedLogin: "bobby",
      reporter: { login: "alice" },
    });
    expect(r.text).toContain("rotten embalmer");
    expect(r.authoredAt).not.toBeNull();
    expect(detail.body.reported?.login).toBe("bobby");
    // The window holds what was said before and after, with the reported line marked.
    const window = r.evidence.chatWindow;
    expect(window.map((l) => l.text).join("\n")).toContain("Lovely weather for a wake");
    expect(window.map((l) => l.text).join("\n")).toContain("Now now");
    expect(window.map((l) => l.text).join("\n")).toContain("ordinary remark");
    expect(window.filter((l) => l.reported).map((l) => l.text)).toEqual([r.text]);
    expect(window.find((l) => l.reported)?.from).toBe("bobby");

    // Cafe talk is not stored anywhere else: not in the audit log, not in the reports of other lines.
    const everything = JSON.stringify(h.server.host.audit.query({ limit: 1000 }));
    expect(everything).not.toContain("ordinary remark");
    expect(everything).not.toContain("Lovely weather");
    expect(everything).not.toContain("rotten embalmer");
    const rows = h.server.db.prepare("SELECT count(*) AS n FROM reports").get() as { n: number };
    expect(rows.n).toBe(1);
  });

  it("keeps the window bounded and private to what the reporter could see", async () => {
    h = await startServer({ listen: true, config: { chatBufferLines: 10, chatBufferMinutes: 1 } });
    const alice = await player("alice", 1);
    const bobby = await player("bobby", 2);
    const carol = await player("carol", 3);
    await toCafe(alice);
    await toCafe(bobby);
    for (let i = 0; i < 25; i++) await bobby.act({ type: "chat", text: `line number ${i}` });
    expect(h.server.host.moderation.chat.size("main")).toBeLessThanOrEqual(10);
    await toCafe(carol);
    // Carol was not there for the early lines and cannot report one she never saw.
    const r = filed(
      await carol.request("POST", "/api/reports", {
        townId: "main",
        target: { kind: "chat", text: "bobby says: line number 24" },
        category: "spam",
      }),
    );
    expect(r.duplicate).toBe(false);
    const report = h.server.host.moderation.reports.list({ limit: 5 })[0];
    expect(report?.verified).toBe(0);
    expect(report?.reported_account_id).toBeNull();
    // Lines age out of the window.
    await h.clock.advance(90_000);
    await bobby.act({ type: "chat", text: "a fresh line" });
    expect(h.server.host.moderation.chat.size("main")).toBe(1);
  });

  it("finds the author of a letter and an announcement from the audit log, and marks the unfindable", async () => {
    h = await startServer();
    const alice = await player("alice", 1);
    const bobby = await player("bobby", 2);
    await alice.enter();
    await bobby.enter();
    expect(await sendLetter(bobby, "alice", "Dear Alice, I know where you bury things")).toBe(200);
    expect((await announce(bobby, "Bobby's Burials beats every rival")).status).toBe(200);

    // Alice reads the letter at her desk.
    let desk = await alice.press("go:desk");
    for (let i = 0; i < 4 && !desk.overlay; i++) desk = await alice.press("go:desk");
    expect(desk.overlay?.kind).toBe("confirm");
    const letter = richTextToPlain(desk.overlay?.kind === "confirm" ? desk.overlay.text : []);
    expect(letter).toContain("I know where you bury things");

    const a = filed(
      await alice.request("POST", "/api/reports", {
        townId: "main",
        target: { kind: "letter", text: letter, fromPlayerId: 1 },
        category: "threats",
      }),
    );
    expect(a.blockOffer?.name).toBe("bobby");
    const b = filed(
      await alice.request("POST", "/api/reports", {
        townId: "main",
        target: {
          kind: "announcement",
          text: "bobby of bobby Rest makes an announcement:\nBobby's Burials beats every rival",
        },
        category: "spam",
      }),
    );
    expect(b.blockOffer?.name).toBe("bobby");
    // Text nobody typed: stored, flagged, with no author to act on.
    filed(
      await alice.request("POST", "/api/reports", {
        townId: "main",
        target: { kind: "announcement", text: "Words that no one ever submitted" },
        category: "other",
      }),
    );
    const reports = h.server.host.moderation.reports.list({ limit: 10 }).reverse();
    expect(reports.map((r) => [r.kind, r.verified, r.reported_login])).toEqual([
      ["letter", 1, "bobby"],
      ["announcement", 1, "bobby"],
      ["announcement", 0, null],
    ]);
    expect(reports[0]?.where_seen).toBe("mail");
    expect(reports[1]?.where_seen).toBe("the newspaper");
  });

  it("finds a fortune and a battle quote the same way, and reports names", async () => {
    h = await startServer();
    const alice = await player("alice", 1);
    const bobby = await player("bobby", 2);
    await alice.enter();
    await bobby.enter();
    const town = h.server.host.get("main");
    const bobbyAccount = h.server.accounts.findByLogin("bobby");
    if (!town || !bobbyAccount) throw new Error("setup");
    for (const [overlayId, text] of [
      ["yangs:sparrow-fortune", "You will be buried in a cheap box"],
      ["battle:quote", "Next time I bring a shovel"],
    ] as const) {
      h.server.host.audit.append({
        at: h.clock.now(),
        townId: "main",
        accountId: bobbyAccount.id,
        playerId: 1,
        kind: "action",
        data: { action: { type: "submitText", overlayId, text } },
      });
    }
    const f = filed(
      await alice.request("POST", "/api/reports", {
        townId: "main",
        target: {
          kind: "fortune",
          text: "A fortune cookie says: You will be buried in a cheap box",
        },
        category: "threats",
      }),
    );
    expect(f.blockOffer?.name).toBe("bobby");
    filed(
      await alice.request("POST", "/api/reports", {
        townId: "main",
        target: { kind: "quote", text: "He yelled: Next time I bring a shovel" },
        category: "harassment",
      }),
    );
    filed(
      await alice.request("POST", "/api/reports", {
        townId: "main",
        target: { kind: "name", name: "BOBBY" },
        category: "hate",
      }),
    );
    filed(
      await alice.request("POST", "/api/reports", {
        townId: "main",
        target: { kind: "parlorName", playerId: 1 },
        category: "sexual",
      }),
    );
    const rows = h.server.host.moderation.reports.list({ limit: 10 }).reverse();
    expect(rows.map((r) => [r.kind, r.verified, r.reported_login, r.reported_text])).toEqual([
      ["fortune", 1, "bobby", "A fortune cookie says: You will be buried in a cheap box"],
      ["quote", 1, "bobby", "He yelled: Next time I bring a shovel"],
      ["name", 1, "bobby", "bobby"],
      ["parlorName", 1, "bobby", "bobby Rest"],
    ]);
  });

  it("rate limits reports per hour and per day, and does not count a repeat", async () => {
    h = await startServer({ config: { reportsPerHour: 3, reportsPerDay: 5, autoMuteReports: 0 } });
    const alice = await player("alice", 1);
    const targets = [];
    for (let i = 0; i < 7; i++) targets.push(await player(`victim${i}`, 10 + i));
    await alice.enter();
    for (const t of targets) await t.enter();
    const report = (i: number) =>
      alice.request("POST", "/api/reports", {
        townId: "main",
        target: { kind: "name", name: `victim${i}` },
        category: "spam",
      });
    expect((await report(0)).status).toBe(200);
    const again = filed(await report(0));
    expect(again.duplicate).toBe(true); // the same thing again is not a new report
    expect((await report(1)).status).toBe(200);
    expect((await report(2)).status).toBe(200);
    const limited = await report(3);
    expect(limited.status).toBe(429);
    expect((limited.body as { error: string }).error).toBe("report_limit");
    expect(h.server.host.moderation.reports.list({ limit: 50 })).toHaveLength(3);
    await h.clock.advance(HOUR + 1000);
    expect((await report(3)).status).toBe(200);
    expect((await report(4)).status).toBe(200);
    // Five in the day: the sixth waits for tomorrow even though the hour is clear.
    await h.clock.advance(HOUR + 1000);
    const day = await report(5);
    expect(day.status).toBe(429);
    await h.clock.advance(24 * HOUR);
    expect((await report(5)).status).toBe(200);
  });

  it("refuses self-reports, bad bodies and strangers", async () => {
    h = await startServer();
    const alice = await player("alice", 1);
    await alice.enter();
    const post = (body: unknown) => alice.request("POST", "/api/reports", body);
    expect(
      (await post({ townId: "main", target: { kind: "name", name: "alice" }, category: "spam" }))
        .status,
    ).toBe(400);
    expect(
      (await post({ townId: "main", target: { kind: "name", name: "nobody" }, category: "spam" }))
        .status,
    ).toBe(404);
    expect(
      (await post({ townId: "nowhere", target: { kind: "name", name: "alice" }, category: "spam" }))
        .status,
    ).toBe(404);
    expect(
      (await post({ townId: "main", target: { kind: "name", name: "alice" }, category: "rude" }))
        .status,
    ).toBe(400);
    expect(
      (
        await post({
          townId: "main",
          target: { kind: "name", name: "x" },
          category: "spam",
          extra: 1,
        })
      ).status,
    ).toBe(400);
    const anon = new TestPlayer(h, "nobody");
    expect((await anon.request("POST", "/api/reports", {})).status).toBe(401);
  });

  it("offers to block, and blocks in the same request when asked", async () => {
    h = await startServer();
    const alice = await player("alice", 1);
    const bobby = await player("bobby", 2);
    await alice.enter();
    await bobby.enter();
    const r = filed(
      await alice.request("POST", "/api/reports", {
        townId: "main",
        target: { kind: "name", name: "bobby" },
        category: "harassment",
        alsoBlock: true,
      }),
    );
    expect(r).toMatchObject({ blocked: true, blockOffer: { name: "bobby" } });
    expect(h.server.host.get("main")?.snapshotState.blocks).toEqual({ "0": [1] });
    const blocks = await alice.request<{ blocks: { name: string }[] }>("GET", "/api/blocks");
    expect(blocks.body.blocks.map((b) => b.name)).toEqual(["bobby"]);
  });

  it("never lets the reported player learn who reported them", async () => {
    h = await startServer({ listen: true });
    // The reporters' log-in names differ from the names they play under, so a leak of the
    // account is visible even though the game names are public.
    const reporter = await player("snitchy_login", 1);
    const bobby = await player("bobby", 2);
    await reporter.enter("main", { name: "Mortimer", parlor: "Mort Rest", male: true });
    await bobby.enter();
    // Four reports from four registered accounts: an automatic mute as well.
    const others = [] as TestPlayer[];
    for (const [i, name] of ["quirky_login", "worried_login", "annoyed_login"].entries()) {
      const p = await player(name, 20 + i);
      await p.enter("main", { name: `Other${i}`, parlor: `Other${i} Rest`, male: true });
      others.push(p);
    }
    for (const p of [reporter, ...others]) {
      filed(
        await p.request("POST", "/api/reports", {
          townId: "main",
          target: { kind: "name", name: "bobby" },
          category: "harassment",
          note: "he is awful",
        }),
      );
    }
    expect(
      h.server.host.moderation.muteInfo(h.server.accounts.findByLogin("bobby")?.id ?? 0),
    ).toHaveLength(1);

    // Everything bobby can fetch or be told.
    const seen: string[] = [];
    seen.push(JSON.stringify((await bobby.request("GET", "/api/me")).body));
    seen.push(JSON.stringify((await bobby.request("GET", "/api/blocks")).body));
    seen.push(JSON.stringify((await bobby.request("GET", "/api/me/export")).body));
    seen.push(JSON.stringify((await bobby.request("GET", "/api/towns/main/view")).body));
    seen.push(JSON.stringify((await bobby.request("GET", "/api/towns")).body));
    seen.push(JSON.stringify((await bobby.request("GET", "/api/features")).body));
    const refused = await bobby.act({ type: "chat", text: "hello" });
    seen.push(JSON.stringify(refused.body));
    const sock = await connectSocket(h, bobby.token);
    sockets.push(sock);
    seen.push(JSON.stringify(sock.messages));
    const all = seen.join("\n").toLowerCase();
    for (const secret of [
      "snitchy_login",
      "quirky_login",
      "worried_login",
      "annoyed_login",
      "he is awful",
      "reporter",
    ]) {
      expect(all, secret).not.toContain(secret);
    }
    // The reports are not reachable by any player route.
    for (const url of ["/api/reports", "/api/me/reports", "/admin/reports"]) {
      const r = await bobby.request("GET", url);
      expect([404, 401, 405], url).toContain(r.status);
    }
  });
});

describe("the strict word list", () => {
  it("refuses listed words in announcements, names and parlor names, and logs none of them", async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { hashLine } = await import("../src/moderation/blocklist.js");
    const dir = mkdtempSync(join(tmpdir(), "fq-list-"));
    const file = join(dir, "list.txt");
    // One plain word, one that matches anywhere, one hashed.
    writeFileSync(
      file,
      ["# test list", "flurbo", "~zorkmid", hashLine("quibble") ?? "", ""].join("\n"),
    );
    const lines: string[] = [];
    const { default: pino } = await import("pino");
    const logger = pino({ level: "info" }, { write: (s: string) => void lines.push(s) });
    try {
      h = await startServer({ config: { blocklistFile: file }, logger });
      const alice = await player("alice", 1);
      await alice.enter();
      const refused = [
        "Flurbo's parlor is the best",
        "FLURBO!",
        "flurb0 for all",
        "f.l.u.r.b.o",
        "I like xzorkmidx",
        "Z O R K M I D",
        "a quibble here",
      ];
      for (const text of refused) {
        const r = await announce(alice, text);
        expect(r.status, text).toBe(422);
        expect((r.body as { error?: string }).error, text).toBe("text_not_allowed");
        expect(JSON.stringify(r.body).toLowerCase()).not.toMatch(/flurbo|zorkmid|quibble/);
      }
      // A whole-word entry does not trip on a longer word; ordinary text goes through.
      expect((await announce(alice, "flurboing is fine, as are quibbles")).status).toBe(200);

      // Names and parlor names are refused before the engine is asked.
      const bob = new TestPlayer(h, "bobby", "bobby long password", "10.0.0.2");
      await bob.signUp();
      const named = await bob.request<{ error: string; field: string; message: string }>(
        "POST",
        "/api/towns/main/enter",
        { parlor: { name: "Flurbo", parlor: "Bobby Rest", male: true } },
      );
      expect(named.status).toBe(422);
      expect(named.body).toMatchObject({ error: "invalid_parlor", field: "name" });
      const parlor = await bob.request<{ field: string }>("POST", "/api/towns/main/enter", {
        parlor: { name: "Bobby", parlor: "Zorkmid Funerals", male: true },
      });
      expect(parlor.status).toBe(422);
      expect(parlor.body.field).toBe("parlor");
      const daily = await bob.request("POST", "/api/daily/enter", {
        parlor: { name: "Bobby", parlor: "Zorkmid Funerals", male: true },
      });
      expect(daily.status).toBe(422);
      await bob.enter();

      // A sysop's rename meets the list too.
      const rename = await admin(h, "POST", "/admin/moderation/rename", {
        townId: "main",
        playerId: 1,
        name: "Flurbo Jr",
        reason: "test",
      });
      expect(rename.status).toBe(422);

      // Nothing the server keeps or says contains a listed word, in plain text.
      const audit = JSON.stringify(h.server.host.audit.query({ limit: 5000 })).toLowerCase();
      const logged = lines.join("\n").toLowerCase();
      for (const word of ["flurbo", "zorkmid", "quibble"]) {
        // "flurboing is fine, as are quibbles" was accepted and so is in the audit log; the
        // refused texts are not.
        expect(audit.replace("flurboing is fine, as are quibbles", ""), word).not.toContain(word);
        expect(logged.replace("flurboing is fine, as are quibbles", ""), word).not.toContain(word);
      }
      const refusals = h.server.host.audit.query({ kind: "safety:text-refused", limit: 100 });
      expect(refusals.length).toBeGreaterThanOrEqual(9);
      expect(JSON.stringify(refusals[0]?.data)).toMatch(/"entry":"[0-9a-f]{8}"/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("starts with no list, and stops with a clear message if the file is missing", async () => {
    h = await startServer();
    expect(h.server.host.moderation.blocklist.size).toBe(0);
    await expect(
      startServer({ config: { blocklistFile: "/nonexistent/list.txt" } }),
    ).rejects.toThrow(/FQ_BLOCKLIST_FILE/);
  });
});
