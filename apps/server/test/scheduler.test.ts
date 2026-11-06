import { afterEach, describe, expect, it } from "vitest";
import { FakeClock } from "../src/clock.js";
import { createSchedule } from "../src/game/schedule.js";
import { type Harness, startServer, TestPlayer } from "./support/harness.js";

let h: Harness | null = null;
afterEach(async () => {
  await h?.stop();
  h = null;
});

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const day = () => h?.server.host.get("main")?.snapshotState.day;
const maintenanceRows = () =>
  h?.server.host.audit
    .query({ kind: "maintenance", limit: 50 })
    .map((r) => r.data as { source: string; missedDays: number; daysRun: number; day: number })
    .reverse() ?? [];

describe("the day schedule", () => {
  it("starts days at local midnight in the town's zone", () => {
    const utc = createSchedule({ timeZone: "UTC", dayLengthMs: null, epoch: 0 });
    const t = Date.UTC(2030, 5, 10, 15, 30);
    expect(utc.currentBoundary(t)).toBe(Date.UTC(2030, 5, 10));
    expect(utc.nextBoundary(t)).toBe(Date.UTC(2030, 5, 11));

    // New York in June is UTC-4: local midnight is 04:00 UTC.
    const ny = createSchedule({ timeZone: "America/New_York", dayLengthMs: null, epoch: 0 });
    expect(ny.currentBoundary(t)).toBe(Date.UTC(2030, 5, 10, 4));
    expect(ny.nextBoundary(Date.UTC(2030, 5, 10, 3, 59))).toBe(Date.UTC(2030, 5, 10, 4));
    // Auckland is ahead of UTC: 15:30 UTC on the 10th is already the 11th there.
    const nz = createSchedule({ timeZone: "Pacific/Auckland", dayLengthMs: null, epoch: 0 });
    expect(nz.currentBoundary(t)).toBe(Date.UTC(2030, 5, 10, 12)); // 00:00 NZST on the 11th
  });

  it("copes with daylight-saving days of 23 and 25 hours", () => {
    const ny = createSchedule({ timeZone: "America/New_York", dayLengthMs: null, epoch: 0 });
    // 2030-03-10 is the spring-forward day: midnight (EST, UTC-5) is 05:00 UTC, the next is 04:00 UTC.
    const start = Date.UTC(2030, 2, 10, 5);
    expect(ny.nextBoundary(start)).toBe(Date.UTC(2030, 2, 11, 4));
    expect(ny.countBetween(start, Date.UTC(2030, 2, 11, 3), 10)).toBe(0);
    expect(ny.countBetween(start, Date.UTC(2030, 2, 11, 4), 10)).toBe(1);
    // 2030-11-03 is fall-back: the day lasts 25 hours.
    const fall = Date.UTC(2030, 10, 3, 4);
    expect(ny.nextBoundary(fall)).toBe(Date.UTC(2030, 10, 4, 5));
    // A year has exactly 365 boundaries.
    expect(ny.countBetween(Date.UTC(2030, 0, 1, 5), Date.UTC(2031, 0, 1, 5), 1000)).toBe(365);
  });

  it("counts fixed-length days from the epoch", () => {
    const blitz = createSchedule({ timeZone: "UTC", dayLengthMs: 15 * 60_000, epoch: 1000 });
    expect(blitz.currentBoundary(1000 + 14 * 60_000)).toBe(1000);
    expect(blitz.nextBoundary(1000)).toBe(1000 + 15 * 60_000);
    expect(blitz.countBetween(1000, 1000 + 60 * 60_000, 100)).toBe(4);
    expect(blitz.countBetween(1000, 1000 + 60 * 60_000, 3)).toBe(3);
  });
});

describe("the day scheduler", () => {
  it("catches up three missed days when the server starts", async () => {
    h = await startServer();
    expect(day()).toBe(1);
    const dir = h.dir;
    const clock = h.clock;
    await h.server.close();
    // The server is down from 12:00 on Jan 1 until 12:00 on Jan 4: three midnights pass.
    clock.jump(3 * DAY);
    h = await startServer({ dir, clock, towns: [{ id: "main", seed: 1234 }] });
    expect(day()).toBe(4);
    const rows = maintenanceRows().filter((r) => r.source === "schedule");
    expect(rows).toEqual([{ source: "schedule", missedDays: 3, daysRun: 3, day: 4 }]);
    // Starting again straight away runs nothing more.
    h = await h.restart();
    expect(day()).toBe(4);
    expect(maintenanceRows().filter((r) => r.source === "schedule")).toHaveLength(1);
  });

  it("runs a day at each midnight while the server is up", async () => {
    h = await startServer();
    await h.clock.advance(11 * HOUR + 59 * 60_000);
    expect(day()).toBe(1);
    await h.clock.advance(2 * 60_000);
    expect(day()).toBe(2);
    await h.clock.advance(2 * DAY);
    expect(day()).toBe(4);
  });

  it("catches up on the first request even if a timer never fired", async () => {
    h = await startServer();
    const p = await new TestPlayer(h, "alice").signUp();
    h.clock.jump(2 * DAY); // no timers run
    expect(day()).toBe(1);
    await p.enter();
    expect(day()).toBe(3);
  });

  it("advances a Blitz town every fifteen minutes", async () => {
    h = await startServer({
      towns: [{ id: "main", seed: 5, dayLengthMinutes: 15 }],
    });
    expect(day()).toBe(1);
    await h.clock.advance(14 * 60_000);
    expect(day()).toBe(1);
    await h.clock.advance(60_000);
    expect(day()).toBe(2);
    await h.clock.advance(60 * 60_000);
    expect(day()).toBe(6);
    const info = h.server.host.get("main")?.info();
    expect(info?.dayLengthMinutes).toBe(15);
    expect(new Date(info?.nextDayAt ?? 0).getTime()).toBe(h.clock.now() + 15 * 60_000);
  });

  it("uses the town's own time zone", async () => {
    h = await startServer({
      towns: [{ id: "main", seed: 5, timeZone: "Asia/Tokyo" }],
    });
    // 12:00 UTC is 21:00 in Tokyo: midnight is three hours away.
    await h.clock.advance(2 * HOUR + 59 * 60_000);
    expect(day()).toBe(1);
    await h.clock.advance(2 * 60_000);
    expect(day()).toBe(2);
  });

  it("writes a snapshot at each new day and keeps only the newest few", async () => {
    h = await startServer({ config: { snapshotKeep: 3 } });
    await h.clock.advance(5 * DAY);
    expect(day()).toBe(6);
    const snaps = h.server.host.townStore.listSnapshots("main");
    expect(snaps.length).toBeLessThanOrEqual(3);
    expect(snaps.every((s) => s.reason === "day" || s.reason === "periodic")).toBe(true);
  });

  it("caps catch-up at the configured limit", async () => {
    h = await startServer({ config: { maxCatchUpDays: 5 } });
    const { dir, clock } = h;
    await h.server.close();
    clock.jump(30 * DAY);
    h = await startServer({
      dir,
      clock,
      config: { maxCatchUpDays: 5 },
      towns: [{ id: "main", seed: 1234 }],
    });
    expect(day()).toBe(6);
  });

  it("uses a fake clock that fires timers in order", async () => {
    const clock = new FakeClock(0);
    const fired: number[] = [];
    clock.setTimeout(() => void fired.push(2), 20);
    clock.setTimeout(() => void fired.push(1), 10);
    const cancel = clock.setTimeout(() => void fired.push(3), 15);
    cancel();
    await clock.advance(25);
    expect(fired).toEqual([1, 2]);
    expect(clock.now()).toBe(25);
  });
});

describe("the end of a tournament", () => {
  it("resets the town, drops every parlor link and tells connected players", async () => {
    h = await startServer({
      towns: [
        {
          id: "main",
          seed: 9,
          settings: { tournamentActive: true, tournamentDays: 3 },
        },
      ],
      config: { idleTimeoutMinutes: 10_080 },
    });
    const p = await new TestPlayer(h, "alice").signUp();
    await p.enter();
    expect((await p.request<{ parlors: unknown[] }>("GET", "/api/me")).body.parlors).toHaveLength(
      1,
    );
    const deeds = h.server.host.get("main")?.snapshotState.deeds.length;

    // Days 2, 3 and 4 pass, then the midnight after the final day resets the town.
    await h.clock.advance(3 * DAY + 13 * HOUR);
    const town = h.server.host.get("main");
    expect(town?.snapshotState.day).toBe(1);
    expect(town?.snapshotState.players.filter((x) => x.active)).toHaveLength(0);
    expect(town?.snapshotState.sessions).toEqual({});
    expect(town?.snapshotState.settings.tournamentActive).toBe(true); // the sysop's settings survive
    expect(town?.snapshotState.deeds.length).toBeGreaterThanOrEqual(deeds ?? 0);
    expect((await p.request<{ parlors: unknown[] }>("GET", "/api/me")).body.parlors).toHaveLength(
      0,
    );
    expect((await p.act({ type: "exit" })).body).toMatchObject({ error: "not_in_game" });
    // The old state was kept for rollback, and the account can start a new parlor.
    expect(
      h.server.host.townStore
        .listSnapshots("main")
        .some((s) => /pre-(tournament-)?reset/.test(s.reason)),
    ).toBe(true);
    await p.enter("main", { name: "Alice Again", parlor: "Fresh Start", male: false });
  });
});
