/// <reference types="node" />
/**
 * Balance sanity for the Expanded ruleset (docs/expanded-rules.md section 15).
 * Scripted View-only seats share towns; seat slots rotate between towns so
 * no strategy keeps the same neighbours. By default a quick run checks the
 * three claims; `BALANCE_FULL=1` runs the season-long version and, with
 * `BALANCE_OUT=<file>`, writes the table the doc quotes.
 */
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { makeXTown } from "./support/expanded.js";
import { type Strategy, XDriver } from "./support/xpolicy.js";

const SEATS: Strategy[] = [
  { name: "reader", seller: "reader", spending: "none", morals: "neutral" },
  { name: "random", seller: "random", spending: "none", morals: "neutral" },
  { name: "psych-only", seller: "reader", spending: "psych", morals: "neutral" },
  { name: "hearse-only", seller: "reader", spending: "hearse", morals: "neutral" },
  { name: "balanced", seller: "reader", spending: "balanced", morals: "neutral" },
  { name: "good karma", seller: "reader", spending: "balanced", morals: "good" },
  { name: "evil karma", seller: "reader", spending: "balanced", morals: "evil" },
];

interface Row {
  name: string;
  bp: number;
  bpDay10: number;
  wins: number;
  sales: number;
  walkouts: number;
  exact: number;
  money: number;
  rating: number;
  karma: number;
  psych: number;
  hearse: number;
  upgrades: number;
  /** Closeness bonus BP as a share of sale BP. */
  bonusShare: number;
}

function run(towns: number, days: number): Row[] {
  const rows: Row[] = SEATS.map((s) => ({
    name: s.name,
    bp: 0,
    bpDay10: 0,
    wins: 0,
    sales: 0,
    walkouts: 0,
    exact: 0,
    money: 0,
    rating: 0,
    karma: 0,
    psych: 0,
    hearse: 0,
    upgrades: 0,
    bonusShare: 0,
  }));
  for (let t = 0; t < towns; t++) {
    const order = SEATS.map((_, i) => (i + t) % SEATS.length);
    const seats = order.map((i) => SEATS[i] as Strategy);
    const { town, ctx } = makeXTown(1000 + t, seats.length);
    const d = new XDriver(town, ctx, seats, 1000 + t);
    for (let day = 0; day < days; day++) {
      d.day();
      if (day !== 9) continue;
      order.forEach((si, slot) => {
        (rows[si] as Row).bpDay10 += d.town.players[slot]?.bp ?? 0;
      });
    }
    let best = -1;
    let bestBp = -1;
    order.forEach((si, slot) => {
      const p = d.town.players[slot];
      const s = d.stats[slot];
      const r = rows[si] as Row;
      if (!p || !s) return;
      r.bp += p.bp;
      r.sales += s.sales;
      r.walkouts += s.walkouts;
      r.exact += s.exact;
      r.money += p.money;
      r.rating += p.rating;
      r.karma += p.karma;
      r.psych += p.psych;
      r.hearse += p.transportation;
      r.upgrades += p.expanded?.upgrades.length ?? 0;
      const rec = p.expanded?.record;
      r.bonusShare += rec && rec.saleBp > 0 ? (100 * rec.bonusBp) / rec.saleBp : 0;
      if (p.bp > bestBp) {
        bestBp = p.bp;
        best = si;
      }
    });
    (rows[best] as Row).wins++;
  }
  for (const r of rows) {
    for (const k of Object.keys(r) as (keyof Row)[]) {
      if (k !== "name" && k !== "wins")
        (r[k] as number) = Math.round(((r[k] as number) / towns) * 10) / 10;
    }
  }
  return rows;
}

const full = process.env.BALANCE_FULL === "1";

describe("Expanded balance sanity (expanded-rules.md 15)", () => {
  const towns = full ? Number(process.env.BALANCE_TOWNS ?? 8) : 2;
  const days = full ? 29 : 14;
  const rows = run(towns, days);
  const by = (name: string) => rows.find((r) => r.name === name) as Row;
  if (process.env.BALANCE_OUT) {
    writeFileSync(process.env.BALANCE_OUT, `${JSON.stringify({ towns, days, rows }, null, 2)}\n`);
  }

  it("(a) reading tells and picking cards well beats pressing buttons at random", () => {
    expect(by("reader").bp).toBeGreaterThan(1.5 * by("random").bp);
    expect(by("reader").walkouts).toBeLessThan(by("random").walkouts);
  });

  it("(b) psych-only and hearse-only no longer beat a balanced parlor", () => {
    expect(by("psych-only").bp).toBeLessThan(by("balanced").bp);
    expect(by("hearse-only").bp).toBeLessThan(by("balanced").bp * 1.02);
  });

  it("(c) the good and the evil karma paths are both viable", () => {
    const best = Math.max(...rows.map((r) => r.bp));
    for (const name of ["good karma", "evil karma"]) {
      expect(by(name).bp, name).toBeGreaterThan(0.85 * best);
      expect(by(name).bp, name).toBeGreaterThan(by("reader").bp);
    }
  });
});
