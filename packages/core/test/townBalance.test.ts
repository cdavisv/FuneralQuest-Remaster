/// <reference types="node" />
/**
 * Money in the late game and the house edge (docs/expanded-rules.md section
 * 28). The balance seats of section 15 share towns with copies of the
 * spending seats that also put surplus money into the town's sinks. By
 * default a quick run checks the claims; `BALANCE_FULL=1` runs 8 towns of 29
 * days and, with `BALANCE_OUT=<file>`, writes the table the doc quotes.
 */
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { drawReturn, EXPANDED_TOWN, shotsReturn, slotsReturn, step } from "../src/index.js";
import { makeXTown } from "./support/expanded.js";
import { edit, midnight, player, press, seat, visit, xtown } from "./support/xtown.js";
import { TownDriver, type TownStrategy } from "./support/xtownPolicy.js";

/**
 * The spending seats of section 15's table. Each town is played twice with
 * the same seats in the same slots: once as the table had them, once with
 * the three spending seats also using the town (`town: true`). Until the
 * late game starts the two runs are identical, so the difference is the
 * town's doing.
 */
const SEATS: TownStrategy[] = [
  { name: "reader", seller: "reader", spending: "none", morals: "neutral" },
  { name: "balanced", seller: "reader", spending: "balanced", morals: "neutral" },
  { name: "good karma", seller: "reader", spending: "balanced", morals: "good" },
  { name: "evil karma", seller: "reader", spending: "balanced", morals: "evil" },
];

interface Row {
  name: string;
  /** Without the town budget, then with it. */
  bp: number;
  bpTown: number;
  cash: number;
  cashTown: number;
  townSpent: number;
  monuments: number;
  rating: number;
  ratingTown: number;
}

function play(t: number, days: number, town: boolean): TownDriver {
  const order = SEATS.map((_, i) => (i + t) % SEATS.length);
  const seats = order.map((i) => ({ ...(SEATS[i] as TownStrategy), town: town && i > 0 }));
  const made = makeXTown(2000 + t, seats.length);
  const d = new TownDriver(made.town, made.ctx, seats, 2000 + t);
  for (let day = 0; day < days; day++) d.day();
  return d;
}

function run(towns: number, days: number): Row[] {
  const rows: Row[] = SEATS.map((s) => ({
    name: s.name,
    bp: 0,
    bpTown: 0,
    cash: 0,
    cashTown: 0,
    townSpent: 0,
    monuments: 0,
    rating: 0,
    ratingTown: 0,
  }));
  for (let t = 0; t < towns; t++) {
    const order = SEATS.map((_, i) => (i + t) % SEATS.length);
    const plain = play(t, days, false);
    const spent = play(t, days, true);
    order.forEach((si, slot) => {
      const a = plain.town.players[slot];
      const b = spent.town.players[slot];
      const r = rows[si] as Row;
      if (!a || !b) return;
      const l = b.expanded?.life;
      r.bp += a.bp;
      r.bpTown += b.bp;
      r.cash += a.money;
      r.cashTown += b.money;
      r.rating += a.rating;
      r.ratingTown += b.rating;
      r.monuments += l?.monuments ?? 0;
      for (const [k, v] of Object.entries(l?.spent ?? {}))
        if (k !== "staked" && k !== "won") r.townSpent += v;
    });
  }
  for (const r of rows) {
    for (const k of Object.keys(r) as (keyof Row)[]) {
      if (k !== "name") (r[k] as number) = Math.round(((r[k] as number) / towns) * 10) / 10;
    }
  }
  return rows;
}

const full = process.env.BALANCE_FULL === "1";

describe("28 money has late-game uses", () => {
  const towns = full ? Number(process.env.BALANCE_TOWNS ?? 8) : 1;
  const days = 29;
  const rows = run(towns, days);
  const by = (name: string) => rows.find((r) => r.name === name) as Row;
  if (process.env.BALANCE_OUT) {
    writeFileSync(process.env.BALANCE_OUT, `${JSON.stringify({ towns, days, rows }, null, 2)}\n`);
  }

  it("the same seats with a town budget end with far less idle cash and more BP", () => {
    for (const name of ["balanced", "good karma", "evil karma"]) {
      const r = by(name);
      // 45,000 since the engine pass made the late upgrades $33,000 cheaper in all (tuning log,
      // "Loose ends"): the seats keep their $15,000 reserve plus what is left under a tithe step.
      expect(r.cashTown, name).toBeLessThan(Math.max(45_000, r.cash * 0.6));
      expect(r.townSpent, name).toBeGreaterThan(30_000);
      // Within the noise of one town (the reader, who buys nothing, moves about 2% between the runs).
      expect(r.bpTown, name).toBeGreaterThan(r.bp * 0.97);
      expect(r.monuments, name).toBeGreaterThanOrEqual(2);
    }
    // The reader buys nothing in either run.
    expect(by("reader").townSpent).toBe(0);
  });
});

describe("28 gambling has a slightly negative expected value", () => {
  const T = EXPANDED_TOWN;

  it("exactly: every house game returns between 95% and 100% of the stake", () => {
    const r = { draw: drawReturn(T), slots: slotsReturn(T), shots: shotsReturn(T) };
    expect(r.draw).toBeCloseTo(0.9615, 4);
    expect(r.slots).toBeCloseTo(0.9758, 4);
    expect(r.shots).toBeCloseTo(0.9917, 4);
  });

  it("through the engine: thousands of Dead Man's Draws lose about 4%", () => {
    let staked = 0;
    let back = 0;
    for (let seed = 1; seed <= 8; seed++) {
      let { town, ctx } = xtown({ seed, players: 2 });
      town = edit(town, (t) => {
        for (const p of t.players) {
          p.money = 1_000_000;
          p.tags = [200, 0, 0];
          p.bp = 100;
        }
      });
      for (let day = 0; day < 3; day++) {
        for (const id of [0, 1]) {
          let s = visit(seat(town, ctx, id), "reaper-club");
          s = press(press(s, "reaper-club:pay"), "reaper-club:games");
          const plays = T.club.dailyStakeMax / 100;
          for (let i = 0; i < plays; i++) {
            const before = player(s.town, id).money;
            s = press(s, "reaper-club:draw:100");
            staked += 100;
            back += player(s.town, id).money - before + 100;
          }
          town = step(s.town, id, { type: "exit" }, ctx).town;
        }
        town = midnight(town, ctx);
      }
    }
    const ret = back / staked;
    // 12,000 plays: one standard error is about 0.9%.
    expect(ret).toBeLessThan(1);
    expect(ret).toBeGreaterThan(0.93);
    if (process.env.BALANCE_OUT) {
      writeFileSync(
        `${process.env.BALANCE_OUT}.draw.json`,
        `${JSON.stringify({ staked, back, ret })}\n`,
      );
    }
  });
});
