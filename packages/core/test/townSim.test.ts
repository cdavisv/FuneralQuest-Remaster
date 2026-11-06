/**
 * Multi-day Expanded play with the whole town (docs/expanded-rules.md
 * section 27): random play across many seeds, and an exercise player that
 * reaches every new action. After every action: the invariants, every
 * enabled button accepted, nothing offered that cannot be afforded, no
 * money, tags or BP minted by the bank, bingo cards or chains; saves
 * round-trip mid-flow; no rejected action.
 */
import { describe, expect, it } from "vitest";
import { makeXTown } from "./support/expanded.js";
import { townWalk } from "./support/townWalk.js";

describe("the Expanded town over many days (expanded-rules.md 27)", () => {
  it("random choices keep every invariant across seeds", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { town, ctx } = makeXTown(seed * 53, 4);
      const r = townWalk(town, ctx, { seed, days: 5, players: 4 });
      expect(r.rejected, r.rejected.slice(0, 5).join("\n")).toEqual([]);
      expect(r.actions).toBeGreaterThan(500);
    }
  });

  // The exercise runs are split by seed (each well inside the per-test timeout); the last test checks coverage.
  const used = new Map<string, number>();
  let staked = 0;
  let returned = 0;
  for (const seed of [21, 22, 23]) {
    it(`an exercise player keeps every invariant (seed ${seed})`, () => {
      const { town, ctx } = makeXTown(seed * 13, 4);
      const r = townWalk(town, ctx, {
        seed,
        days: 12,
        players: 4,
        exercise: true,
        cap: 260,
        setup: (t) => {
          for (const p of t.players) {
            p.money = 300_000;
            p.tags = [60, 20, 20];
            p.bp = 2000;
            p.karma = [90, 10, 50, 25][p.id] ?? 50;
            p.plots = 200;
          }
        },
      });
      expect(r.rejected, r.rejected.slice(0, 5).join("\n")).toEqual([]);
      for (const [k, v] of r.used) used.set(k, (used.get(k) ?? 0) + v);
      staked += r.staked;
      returned += r.returned;
    });
  }

  it("the exercise players reached every new action", () => {
    const wanted = [
      "graveyard:monuments",
      "graveyard:monument",
      "graveyard:tend",
      "graveyard:rob",
      "graveyard:look",
      "graveyard:duel",
      "pick:graveyard:pick",
      "graveyard:swing",
      "graveyard:shove",
      "graveyard:yield",
      "church:bingo",
      "church:card:N",
      "church:confess",
      "church:water",
      "church:serve",
      "church:tithe",
      "neg:bless",
      "city-hall:permits",
      "city-hall:permit:*",
      "city-hall:inspection",
      "city-hall:certify",
      "city-hall:bribe",
      "city-hall:ordinance",
      "city-hall:vote:*",
      "city-hall:lobby",
      "city-hall:election",
      "city-hall:file",
      "city-hall:ads",
      "city-hall:elect:*",
      "city-hall:chains",
      "city-hall:found",
      "text:city-hall:chainname",
      "city-hall:invite",
      "pick:city-hall:invitepick",
      "city-hall:join:*",
      "city-hall:leavechain",
      "hospital:treat:*",
      "hospital:lead",
      "reaper-club:pay",
      "reaper-club:games",
      "reaper-club:draw:N",
      "reaper-club:slots:N",
      "reaper-club:shots:N",
      "reaper-club:market",
      "reaper-club:buy:*",
      "reaper-club:hit",
      "pick:reaper-club:hitpick",
      "reaper-club:bodyguard",
      "reaper-club:seance",
      "bank:savings",
      "bank:deposit",
      "bank:withdraw",
      "bank:depositall",
      "bank:withdrawall",
      "bank:loan",
      "bank:borrow",
      "text:bank:borrowamt",
      "bank:repay",
      "bank:transferhome",
      "bank:transfer",
      "pick:bank:tpick",
      "bank:ttier:N",
      "text:bank:tcount",
      "arc:give:church:*",
      "arc:give:reaper-club:*",
      "arc:give:city-hall:*",
    ];
    const missing = wanted.filter((k) => !used.has(k));
    expect(missing, [...used.keys()].sort().join(" ")).toEqual([]);
    expect(staked).toBeGreaterThan(0);
    expect(returned).toBeGreaterThanOrEqual(0);
  });
});
