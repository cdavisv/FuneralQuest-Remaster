import type { View } from "@fq/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openDatabase } from "../src/db/database.js";
import { ActivityStore } from "../src/db/stores.js";
import {
  ActivityRecorder,
  addDays,
  computeActivityStats,
  median,
  utcDay,
} from "../src/game/activity.js";
import { ADMIN_TOKEN, type Harness, startServer, TestPlayer } from "./support/harness.js";

let h: Harness | null = null;
afterEach(async () => {
  await h?.stop();
  h = null;
});

const DAY = 86_400_000;

// ------------------------------------------------------------- arithmetic

/**
 * The hand-built table. Today is 2030-02-05.
 *
 * | account | days played                                   | cohort     |
 * | ------- | --------------------------------------------- | ---------- |
 * | 1       | 01-31, 02-01, 02-03                           | 2030-01-31 |
 * | 2       | 01-31, 02-04                                  | 2030-01-31 |
 * | 3       | 01-31                                         | 2030-01-31 |
 * | 4       | 01-31, 02-01 (in two towns: two rows)         | 2030-01-31 |
 * | 5       | 02-04, 02-05                                  | 2030-02-04 |
 * | 6       | 02-05                                         | 2030-02-05 |
 * | 7       | 2029-12-01                                    | 2029-12-01 |
 * | 8       | 2029-12-01, 2029-12-31                        | 2029-12-01 |
 */
const TABLE: [number, string[]][] = [
  [1, ["2030-01-31", "2030-02-01", "2030-02-03"]],
  [2, ["2030-01-31", "2030-02-04"]],
  [3, ["2030-01-31"]],
  [4, ["2030-01-31", "2030-02-01", "2030-02-01"]],
  [5, ["2030-02-04", "2030-02-05"]],
  [6, ["2030-02-05"]],
  [7, ["2029-12-01"]],
  [8, ["2029-12-01", "2029-12-31"]],
];
const ROWS = TABLE.flatMap(([accountId, days]) => days.map((day) => ({ accountId, day })));
const NULLS = { day1: null, day3: null, day7: null, day14: null, day30: null };

describe("activity arithmetic", () => {
  it("does day arithmetic in UTC across month and year boundaries", () => {
    expect(utcDay(Date.UTC(2030, 0, 31, 23, 59, 59))).toBe("2030-01-31");
    expect(utcDay(Date.UTC(2030, 1, 1, 0, 0, 0))).toBe("2030-02-01");
    expect(addDays("2030-01-31", 1)).toBe("2030-02-01");
    expect(addDays("2029-12-01", 30)).toBe("2029-12-31");
    expect(addDays("2030-01-01", -1)).toBe("2029-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("computes cohorts, active counts and return rates from the hand-built table", () => {
    const stats = computeActivityStats(ROWS, "2030-02-05", 6);
    expect(stats.overall).toEqual({
      accounts: 8,
      // Days played: 3, 2, 1, 2, 2, 1, 1, 2.
      medianDaysPlayed: 2,
      activeLast1Days: 2,
      activeLast7Days: 6,
      activeLast30Days: 6,
    });
    expect(stats.daily.map((d) => d.day)).toEqual([
      "2030-02-05",
      "2030-02-04",
      "2030-02-03",
      "2030-02-02",
      "2030-02-01",
      "2030-01-31",
    ]);
    const byDay = new Map(stats.daily.map((d) => [d.day, d]));
    expect(stats.daily.map((d) => [d.newAccounts, d.activeAccounts])).toEqual([
      [1, 2],
      [1, 2],
      [0, 1],
      [0, 0],
      [0, 2],
      [4, 4],
    ]);
    // The cohort of 31 January, measured across the month boundary.
    const jan31 = byDay.get("2030-01-31");
    expect(jan31?.returnedExactlyOnDay).toEqual({
      day1: 0.5, // accounts 1 and 4 on 1 February
      day3: 0.25, // account 1 on 3 February
      day7: null, // 7 February has not come yet
      day14: null,
      day30: null,
    });
    expect(jan31?.returnedOnOrAfterDay).toEqual({
      day1: 0.75, // 1, 2 and 4
      day3: 0.5, // 1 (3 February) and 2 (4 February)
      day7: null,
      day14: null,
      day30: null,
    });
    // Yesterday's cohort: account 5 is back today, but today is not over, so day 1 is null, not 1.
    expect(byDay.get("2030-02-04")?.returnedExactlyOnDay).toEqual(NULLS);
    expect(byDay.get("2030-02-04")?.returnedOnOrAfterDay).toEqual(NULLS);
    // Today's cohort and an empty day: null, never 0.
    expect(byDay.get("2030-02-05")?.returnedExactlyOnDay).toEqual(NULLS);
    expect(byDay.get("2030-02-02")?.returnedExactlyOnDay).toEqual(NULLS);
  });

  it("gives an old cohort its day-14 and day-30 figures", () => {
    const stats = computeActivityStats(ROWS, "2030-02-05", 70);
    expect(stats.daily).toHaveLength(70);
    const dec1 = stats.daily.find((d) => d.day === "2029-12-01");
    expect(dec1?.newAccounts).toBe(2);
    expect(dec1?.returnedExactlyOnDay).toEqual({
      day1: 0,
      day3: 0,
      day7: 0,
      day14: 0,
      day30: 0.5, // account 8 on 31 December
    });
    expect(dec1?.returnedOnOrAfterDay).toEqual({
      day1: 0.5,
      day3: 0.5,
      day7: 0.5,
      day14: 0.5,
      day30: 0.5,
    });
  });

  it("answers an empty record with zeros and nulls", () => {
    const stats = computeActivityStats([], "2030-02-05", 3);
    expect(stats.overall).toEqual({
      accounts: 0,
      medianDaysPlayed: null,
      activeLast1Days: 0,
      activeLast7Days: 0,
      activeLast30Days: 0,
    });
    expect(
      stats.daily.every((d) => d.newAccounts === 0 && d.returnedOnOrAfterDay.day1 === null),
    ).toBe(true);
  });
});

// --------------------------------------------------------------- recorder

describe("activity recorder", () => {
  it("writes once per account, town and day and keeps only today's set", () => {
    const db = openDatabase(":memory:");
    db.prepare(
      "INSERT INTO accounts (id, login, created_at) VALUES (1, 'a', 0), (2, 'b', 0)",
    ).run();
    const store = new ActivityStore(db);
    const write = vi.spyOn(store, "record");
    let now = Date.UTC(2030, 0, 31, 23, 0);
    const recorder = new ActivityRecorder(store, () => now);
    recorder.record(1, "main");
    recorder.record(1, "main");
    recorder.record(1, "main");
    expect(write).toHaveBeenCalledTimes(1);
    recorder.record(1, "other");
    recorder.record(2, "main");
    expect(write).toHaveBeenCalledTimes(3);
    now += 2 * 3_600_000; // past midnight UTC
    recorder.record(1, "main");
    recorder.record(1, "main");
    recorder.record(2, "main");
    expect(write).toHaveBeenCalledTimes(5);
    expect(store.forAccount(1)).toEqual([
      { account_id: 1, town_id: "main", day: "2030-01-31" },
      { account_id: 1, town_id: "other", day: "2030-01-31" },
      { account_id: 1, town_id: "main", day: "2030-02-01" },
    ]);
    // A forgotten account is written again (its id may be reused); the others are not.
    recorder.forget(1);
    recorder.record(1, "main");
    recorder.record(2, "main");
    expect(write).toHaveBeenCalledTimes(6);
    expect(store.prune("2030-02-01")).toBe(3);
    expect(store.accountDays("main")).toEqual([
      { account_id: 1, day: "2030-02-01" },
      { account_id: 2, day: "2030-02-01" },
    ]);
    // The row goes with its account.
    db.prepare("DELETE FROM accounts WHERE id = 1").run();
    expect(store.forAccount(1)).toEqual([]);
    db.close();
  });
});

// ------------------------------------------------------------ the server

async function admin<T>(url: string, token: string | null = ADMIN_TOKEN) {
  const res = await (h as Harness).inject({
    method: "GET",
    url,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  return { status: res.statusCode, body: JSON.parse(res.body) as T };
}

/** One accepted action, whatever screen the player is on: Continue, else the map, else home. */
async function move(p: TestPlayer): Promise<void> {
  const view = (await p.request<{ view: View }>("GET", "/api/towns/main/view")).body.view;
  const ids = view.buttons.map((b) => b.id);
  const r = ids.includes("go:desk")
    ? await p.act({ type: "press", buttonId: "go:desk" })
    : ids.includes("go:map")
      ? await p.act({ type: "press", buttonId: "go:map" })
      : await p.act({ type: "visit", placeId: "funeral-home" });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
}

const rows = () =>
  (h as Harness).server.db
    .prepare("SELECT account_id, town_id, day FROM activity_days ORDER BY account_id, day")
    .all();

describe("activity record on the server", () => {
  it("records one row per account, town and day from accepted actions only", async () => {
    h = await startServer({ config: { idleTimeoutMinutes: 10_080 } });
    const write = vi.spyOn(h.server.host.activityStore, "record");
    const alice = await new TestPlayer(h, "alice").signUp();
    await alice.enter();
    // Entering is not an action; nothing yet.
    expect(rows()).toEqual([]);
    await move(alice);
    expect(write).toHaveBeenCalledTimes(1);
    expect(rows()).toEqual([{ account_id: alice.accountId, town_id: "main", day: "2030-01-01" }]);
    // More actions the same day write nothing.
    await move(alice);
    await move(alice);
    expect(write).toHaveBeenCalledTimes(1);
    // A rejected action records nothing.
    expect((await alice.act({ type: "press", buttonId: "no:such-button" })).status).not.toBe(200);
    expect(write).toHaveBeenCalledTimes(1);
    // The next day is a new row.
    await h.clock.advance(DAY);
    await alice.enter();
    await move(alice);
    expect(rows()).toEqual([
      { account_id: alice.accountId, town_id: "main", day: "2030-01-01" },
      { account_id: alice.accountId, town_id: "main", day: "2030-01-02" },
    ]);
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("puts the days in the export and removes them with the account", async () => {
    h = await startServer({ config: { idleTimeoutMinutes: 10_080 } });
    const alice = await new TestPlayer(h, "alice", "alice long password", "10.0.0.1").signUp();
    const bobby = await new TestPlayer(h, "bobby", "bobby long password", "10.0.0.2").signUp();
    for (const p of [alice, bobby]) {
      await p.enter();
      await move(p);
    }
    const exported = await alice.request<{ daysPlayed: unknown }>("GET", "/api/me/export");
    expect(exported.body.daysPlayed).toEqual([{ day: "2030-01-01", townId: "main" }]);

    const gone = await alice.request("POST", "/api/me/delete", {
      password: "alice long password",
      confirm: true,
    });
    expect(gone.status, JSON.stringify(gone.body)).toBe(204);
    expect(rows()).toEqual([{ account_id: bobby.accountId, town_id: "main", day: "2030-01-01" }]);
  });

  it("serves the stats to the admin only", async () => {
    h = await startServer({ config: { idleTimeoutMinutes: 10_080 } });
    const alice = await new TestPlayer(h, "alice").signUp();
    await alice.enter();
    await move(alice);

    expect((await admin("/admin/stats", null)).status).toBe(401);
    expect((await admin("/admin/stats", "x".repeat(32))).status).toBe(401);
    expect((await admin("/admin/stats", alice.token)).status).toBe(401);
    expect((await admin("/admin/stats?town=nowhere")).status).toBe(404);
    expect((await admin("/admin/stats?days=0")).status).toBe(400);

    const res = await admin<Record<string, unknown>>("/admin/stats?days=3&town=main");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      town: "main",
      today: "2030-01-01",
      days: 3,
      retentionDays: 400,
      overall: {
        accounts: 1,
        medianDaysPlayed: 1,
        activeLast1Days: 1,
        activeLast7Days: 1,
        activeLast30Days: 1,
      },
    });
    expect(typeof res.body.recorded).toBe("string");
    expect(res.body.daily).toEqual([
      {
        day: "2030-01-01",
        newAccounts: 1,
        activeAccounts: 1,
        returnedExactlyOnDay: NULLS,
        returnedOnOrAfterDay: NULLS,
      },
      expect.objectContaining({ day: "2029-12-31", newAccounts: 0 }),
      expect.objectContaining({ day: "2029-12-30", newAccounts: 0 }),
    ]);
  });
});
