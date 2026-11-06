/**
 * Section 11.5: the structured panels of the Expanded screens agree with the
 * state they were drawn from. A property test over simulated play (the town
 * walker's random and exercise players): after every action, each panel the
 * view carries is checked against the town; at the end, every panel must
 * have been seen. Plus focused checks of what the walk cannot reach on cue.
 */
import type { View } from "@fq/protocol";
import { describe, expect, it } from "vitest";
import {
  bingoPot,
  buildingLevel,
  EXPANDED,
  EXPANDED_RULES,
  expandedContext,
  stockCapacity,
  type TownState,
  Turn,
  tallyBallot,
} from "../src/index.js";
import { makeXTown } from "./support/expanded.js";
import { townWalk } from "./support/townWalk.js";
import { edit, player, press, seat, visit, xtown } from "./support/xtown.js";

type PanelKey =
  | "hud.debt"
  | "hud.injuryList"
  | "hud.karmaPath"
  | "office"
  | "bingo"
  | "ballots.ordinance"
  | "ballots.election"
  | "bank"
  | "club"
  | "club.lastRound"
  | "prep"
  | "tutorial"
  | "customer.bands"
  | "customer.haggle"
  | "karmaScale";

function checkView(view: View, town: TownState, id: number, seen: Set<PanelKey>): void {
  const p = town.players[id];
  if (!p?.expanded) return;
  const x = p.expanded;
  const life = x.life;
  const day = town.day;
  const where = `${view.title} (day ${day}, player ${id})`;
  const hud = view.hud;
  if (hud?.karma !== undefined) {
    if (hud.debt) {
      seen.add("hud.debt");
      expect(hud.debt.daysLeft, where).toBe(Math.max(0, hud.debt.due - day));
    }
    if (hud.injuryList) {
      seen.add("hud.injuryList");
      expect(hud.injuryList.length, where).toBe(hud.injuries);
      expect(
        hud.injuryList.map((i) => [i.id, i.daysLeft]),
        where,
      ).toEqual((life?.injuries ?? []).map((i) => [i.id, i.days]));
    } else expect(hud.injuries ?? 0, where).toBe(0);
    if (hud.karmaPath) {
      seen.add("hud.karmaPath");
      expect(hud.karma, where).toBeGreaterThanOrEqual(hud.karmaPath.min);
      expect(hud.karma, where).toBeLessThanOrEqual(hud.karmaPath.max);
    }
  }
  if (view.karmaScale) {
    seen.add("karmaScale");
    // The bands cover 1 to 100 without gaps.
    let next = 1;
    for (const b of view.karmaScale) {
      expect(b.min, where).toBe(next);
      next = b.max + 1;
    }
    expect(next, where).toBe(101);
  }
  const o = view.office;
  if (o) {
    seen.add("office");
    expect(o.level, where).toBe(buildingLevel(EXPANDED, x));
    expect([o.stock.wood, o.stock.silver, o.stock.gold], where).toEqual(x.stock);
    expect(o.stock.capacity, where).toBe(stockCapacity(EXPANDED, p));
    expect(o.markup, where).toBe(x.markup);
    expect(o.rivalry, where).toBe(x.rivalry);
    expect(o.upgrades.length, where).toBe(EXPANDED.upgrades.length);
    for (const u of o.upgrades) {
      expect(u.state === "owned", `${where} ${u.id}`).toBe(x.upgrades.includes(u.id));
      if (u.state === "available") expect(p.money, where).toBeGreaterThanOrEqual(u.price);
      if (u.state === "unaffordable") expect(p.money, where).toBeLessThan(u.price);
      const card = view.buttons.find((b) => b.id === u.buttonId);
      if (card) {
        expect(card.enabled !== false, `${where} ${u.id}`).toBe(u.state === "available");
        expect(card.detail, where).toBe(`$${u.price.toLocaleString("en-US")}`);
      }
    }
    for (const b of view.buttons)
      if (b.id.startsWith("parlor:markup:"))
        expect(b.selected === true, where).toBe(Number(b.id.slice(14)) === x.markup);
  }
  const bingo = view.bingo;
  if (bingo) {
    seen.add("bingo");
    const round = town.expanded?.life?.bingo;
    expect(round, where).toBeDefined();
    if (round) {
      const mine = round.cards.flatMap((owner, i) => (owner === id ? [i + 1] : []));
      expect(bingo.mine, where).toEqual(mine);
      expect(bingo.sold, where).toBe(round.cards.filter((c) => c >= 0).length);
      expect(bingo.taken.length, where).toBe(bingo.sold);
      expect(bingo.carry, where).toBe(round.carry);
      expect(bingo.pot, where).toBe(bingoPot(new Turn(town, ctxOf(), id), round));
      expect(bingo.daysLeft, where).toBe(0);
    }
  }
  const ballots = view.ballots;
  if (ballots) {
    const l = town.expanded?.life;
    if (ballots.ordinance) {
      seen.add("ballots.ordinance");
      const b = l?.ballot;
      expect(b, where).toBeTruthy();
      if (b) {
        expect(ballots.ordinance.myVote, where).toBe(b.votes[String(id)] ?? null);
        expect(ballots.ordinance.daysLeft, where).toBe(Math.max(0, b.closes - day));
        const weight = (v: { id: number }) => (l?.election.mayor === v.id ? 2 : 1);
        const tally = tallyBallot(town, b, weight);
        for (const opt of ballots.ordinance.options) {
          expect(opt.votes, where).toBe(tally[opt.id]);
          expect(opt.mine, where).toBe(b.votes[String(id)] === opt.id);
          const card = view.buttons.find((x) => x.id === opt.buttonId);
          if (card) expect(card.selected === true, where).toBe(opt.mine);
        }
      }
    } else expect(l?.ballot ?? null, where).toBeNull();
    seen.add("ballots.election");
    const e = ballots.election;
    expect(e.filed, where).toBe(l?.election.candidates.includes(id) ?? false);
    for (const c of e.candidates) {
      if (c.buttonId) {
        const card = view.buttons.find((x) => x.id === c.buttonId);
        if (card) expect(card.selected === true, where).toBe(c.mine);
      }
    }
    if (ballots.inForce) expect(ballots.inForce.until, where).toBe(l?.ordinance?.until);
  }
  const bank = view.bank;
  if (bank) {
    seen.add("bank");
    expect(bank.savings, where).toBe(life?.savings ?? 0);
    expect(bank.loan.owed, where).toBe(life?.loan?.owed);
    expect(bank.loan.due, where).toBe(life?.loan?.due);
    expect(bank.canDeposit, where).toBe(!life?.loan);
    const counted = life?.today.day === day;
    expect(bank.transfers.sent, where).toBe(counted ? life?.today.sent : 0);
  }
  const club = view.club;
  if (club) {
    seen.add("club");
    const counted = life?.today.day === day;
    expect(club.staked, where).toBe(counted ? life?.today.staked : 0);
    if (club.lastRound) {
      seen.add("club.lastRound");
      expect(club.lastRound.net, where).toBe(club.lastRound.payout - club.lastRound.stake);
      expect(club.stakes, where).toContain(club.lastRound.stake);
    }
  }
  if (view.prep) {
    seen.add("prep");
    const ids = view.buttons.map((b) => b.id);
    for (const c of view.prep.choices) expect(ids, where).toContain(c.buttonId);
    expect(view.prep.choices.length, where).toBe(
      view.buttons.filter((b) => b.id.startsWith("prep:opt:")).length,
    );
  }
  if (view.tutorial) {
    seen.add("tutorial");
    if (view.tutorial.page !== undefined)
      expect(view.tutorial.page, where).toBeLessThanOrEqual(view.tutorial.pages ?? 0);
    if (view.tutorial.hint)
      expect(JSON.stringify(view.tutorial.hint), where).not.toMatch(/^\[\{"text":"Clerk:/);
  }
  const c = view.customer;
  if (c?.bands) {
    seen.add("customer.bands");
    expect(
      c.bands.map((b) => b.within),
      where,
    ).toEqual([0, ...EXPANDED.scoring.tiers.map((t) => t.within)]);
  }
  if (c?.haggle === false) {
    seen.add("customer.haggle");
    expect(c.bands, where).toBeUndefined();
  }
}

let cachedCtx: ReturnType<typeof makeXTown>["ctx"] | null = null;
function ctxOf() {
  if (!cachedCtx) cachedCtx = makeXTown(1, 1).ctx;
  return cachedCtx;
}

describe("11.5 every structured panel agrees with the state (simulated play)", () => {
  const seen = new Set<PanelKey>();
  for (const seed of [41, 42, 43]) {
    it(`an exercise walk, seed ${seed}`, () => {
      const { town, ctx } = makeXTown(seed * 17, 4);
      cachedCtx = ctx;
      const r = townWalk(town, ctx, {
        seed,
        days: 10,
        players: 4,
        exercise: true,
        cap: 240,
        setup: (t) => {
          for (const p of t.players) {
            p.money = 150_000;
            p.tags = [40, 10, 10];
            p.bp = 1500;
            p.karma = [90, 10, 50, 25][p.id] ?? 50;
            p.plots = 120;
          }
        },
        onView: (view, t, id) => checkView(view, t, id, seen),
      });
      expect(r.rejected, r.rejected.slice(0, 5).join("\n")).toEqual([]);
    });
  }
  it("a random walk", () => {
    const { town, ctx } = makeXTown(7, 3);
    cachedCtx = ctx;
    townWalk(town, ctx, {
      seed: 9,
      days: 4,
      players: 3,
      onView: (view, t, id) => checkView(view, t, id, seen),
    });
  });
  it("saw every panel", () => {
    // The haggle-free offer and a club round are checked on cue below; the rest the walk reaches.
    for (const k of [
      "hud.karmaPath",
      "office",
      "bingo",
      "ballots.ordinance",
      "ballots.election",
      "bank",
      "club",
      "club.lastRound",
      "prep",
      "customer.bands",
      "karmaScale",
    ] as PanelKey[])
      expect(seen.has(k), k).toBe(true);
  });
});

describe("11.5 panels on cue", () => {
  it("the tour carries its page counter, the practice sale its hint without the speaker tag", () => {
    const { town, ctx } = makeXTown(3, 1);
    let r = press({ town, ctx, view: { scene: "news" } as View, id: 0 }, "go:desk");
    r = press(r, "go:tutorial");
    expect(r.view.tutorial).toEqual({ page: 1, pages: 6, speaker: "Clerk" });
    expect(JSON.stringify(r.view.note)).toContain("1 / 6");
    for (let i = 0; i < 5; i++) r = press(r, "tutorial:next");
    expect(r.view.tutorial?.page).toBe(6);
    r = press(r, "tutorial:start");
    expect(r.view.tutorial?.speaker).toBe("Clerk");
    const hint = JSON.stringify(r.view.tutorial?.hint);
    expect(hint).toContain("Look at the mood word");
    expect(hint).not.toContain("Clerk:");
    expect(JSON.stringify(r.view.note)).toContain("Clerk:");
  });

  it("injuries and a loan carry their countdowns in the HUD", () => {
    const { town, ctx } = xtown();
    const t = edit(town, (x) => {
      const p = player(x, 0);
      p.money = 50_000;
      const e = p.expanded;
      if (e) {
        e.life = {
          ...(e.life ?? ({} as never)),
          monuments: 0,
          injuries: [
            { id: "dog-bite", days: 2 },
            { id: "cracked-skull", days: 3 },
          ],
          healedDay: 0,
          leads: 0,
          holyWater: 0,
          permits: [],
          certifiedUntil: 0,
          savings: 0,
          loan: { owed: 5150, due: x.day + 4 },
          deadbeat: false,
          armor: false,
          bodyguardDay: 0,
          mayor: false,
          chain: null,
          leftChainDay: 0,
          today: e.life?.today ?? ({ day: 0 } as never),
          spent: {},
        };
      }
    });
    const s = visit(seat(t, ctx, 0), "hospital");
    expect(s.view.hud?.debt).toEqual({ owed: 5150, due: t.day + 4, daysLeft: 4 });
    expect(s.view.hud?.injuryList?.map((i) => [i.id, i.daysLeft, i.treatPrice])).toEqual([
      ["dog-bite", 2, 400],
      ["cracked-skull", 3, 1500],
    ]);
    expect(s.view.hud?.injuryList?.[1]).toMatchObject({ hp: 8, patience: 1, turns: 0 });
    expect(s.view.picture).toEqual({ fg: "people/nurse-gertie", bg: "places/hospital_desk" });
    const bank = visit(s, "bank");
    const loans = press(bank, "bank:loan");
    expect(loans.view.bank?.loan).toMatchObject({ owed: 5150, daysLeft: 4, canBorrow: false });
    expect(loans.view.picture).toEqual({ fg: "people/teller-prudence", bg: "places/bank-vault" });
  });

  it("a flat offer is marked as no haggle (the County Contract)", () => {
    const { town, ctx } = xtown();
    const county = ctx.content.expanded?.specials.find((sp) => sp.id === "county-contract");
    expect(county).toBeDefined();
    if (!county || !ctx.content.expanded) return;
    // Every customer is special, and the only special is the County Contract.
    const rules = structuredClone(EXPANDED_RULES);
    if (rules.expanded) rules.expanded.customer.specialChance = 10;
    const forced = expandedContext(
      {
        ...ctx.content,
        expanded: { ...ctx.content.expanded, specials: [{ ...county, minDay: 0, weight: 1 }] },
      },
      { rules, now: ctx.now },
    );
    let s = seat(town, forced, 0);
    for (let i = 0; i < 12 && !s.view.customer; i++) s = press(s, "desk:wait");
    expect(s.view.customer?.special).toBe(county.label);
    expect(s.view.customer?.haggle).toBe(false);
    expect(s.view.customer?.bands).toBeUndefined();
  });

  it("a round at the back tables comes back as data", () => {
    const { town, ctx } = xtown();
    const t = edit(town, (x) => {
      for (const p of x.players) {
        p.money = 50_000;
        p.tags = [10, 0, 0];
      }
    });
    let s = visit(seat(t, ctx, 0), "reaper-club");
    expect(s.view.club?.inside).toBe(false);
    expect(s.view.picture?.bg).toBe("places/reaper-club-door");
    s = press(press(s, "reaper-club:pay"), "reaper-club:games");
    expect(s.view.picture?.bg).toBe("places/reaper-tables");
    const before = player(s.town, 0).money;
    s = press(s, "reaper-club:draw:100");
    const round = s.view.club?.lastRound;
    expect(round?.game).toBe("draw");
    expect(round?.stake).toBe(100);
    expect(player(s.town, 0).money - before).toBe(round?.net);
    expect(s.view.club?.staked).toBe(100);
  });
});
