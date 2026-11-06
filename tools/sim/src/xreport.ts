import { EXPANDED } from "@fq/core";
import type { TownReport } from "./metrics.js";
import type { ChallengeRun } from "./town.js";
import type { Counters, XSeat } from "./xmetrics.js";

/**
 * The Expanded sections of the balance report: what every system earns and
 * costs, who wins by personality and karma path, how the town's choices are
 * used, PvP and its victims, the house, the bank, City Hall, chains, late
 * joiners, the Daily Challenge, and the dead choices.
 */
export interface XReport {
  byPersonality: Record<string, Counters>;
  byDifficulty: Record<string, Counters>;
  town: Counters;
  seats: XSeat[];
  /** Per town: seats sorted by place (for spread and the peaceful-victim measure). */
  towns: { seats: XSeat[] }[];
  chains: { members: string[]; score: number; memberBp: number }[];
  challenge: ChallengeRun[];
}

function addAll(into: Counters, from: Counters): void {
  for (const [k, v] of Object.entries(from)) into[k] = (into[k] ?? 0) + v;
}

export function buildXReport(reports: TownReport[], challenge: ChallengeRun[]): XReport | null {
  const xs = reports.map((r) => r.x).filter((x) => x !== undefined);
  if (xs.length === 0) return null;
  const out: XReport = {
    byPersonality: {},
    byDifficulty: {},
    town: {},
    seats: [],
    towns: [],
    chains: [],
    challenge,
  };
  for (const x of xs) {
    for (const [k, c] of Object.entries(x.byPersonality)) {
      out.byPersonality[k] ??= {};
      addAll(out.byPersonality[k] as Counters, c);
    }
    for (const [k, c] of Object.entries(x.byDifficulty)) {
      out.byDifficulty[k] ??= {};
      addAll(out.byDifficulty[k] as Counters, c);
    }
    addAll(out.town, x.town);
    out.seats.push(...x.seats);
    out.towns.push({ seats: [...x.seats].sort((a, b) => a.place - b.place) });
    out.chains.push(...x.chains);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Markdown

const div = (a: number, b: number) => (b === 0 ? 0 : a / b);
const f0 = (n: number) => Math.round(n).toLocaleString("en-US");
const f1 = (n: number) => n.toFixed(1);
const f2 = (n: number) => n.toFixed(2);
const f3 = (n: number) => n.toFixed(3);
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function table(head: string[], rows: (string | number)[][]): string {
  const line = (cells: (string | number)[]) => `| ${cells.join(" | ")} |`;
  return [line(head), line(head.map(() => "---")), ...rows.map(line)].join("\n");
}

function prefixed(c: Counters, prefix: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(c)) if (k.startsWith(prefix)) out[k.slice(prefix.length)] = v;
  return out;
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

function sd(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

export interface WinLine {
  key: string;
  seats: number;
  wins: number;
  winRate: number;
  fair: number;
  ratio: number;
  bp: number;
  place: number;
  /** Mean of (seat BP / its town's mean BP - 1), and the standard deviation of that. */
  rel: number;
  relSd: number;
}

/** Win rate by any key of a seat, regular seats only (late joiners excluded). */
export function winsBy(r: XReport, key: (s: XSeat) => string): WinLine[] {
  const acc = new Map<
    string,
    { seats: number; wins: number; bp: number; place: number; fair: number; rel: number[] }
  >();
  for (const t of r.towns) {
    const regular = t.seats.filter((s) => s.joined <= 1);
    const ranked = [...regular].sort((a, b) => b.bp - a.bp || a.playerId - b.playerId);
    const townMean = div(
      regular.reduce((sum, s) => sum + s.bp, 0),
      regular.length,
    );
    regular.forEach((s) => {
      const k = key(s);
      const a = acc.get(k) ?? { seats: 0, wins: 0, bp: 0, place: 0, fair: 0, rel: [] };
      a.seats++;
      a.bp += s.bp;
      a.rel.push(div(s.bp, townMean) - 1);
      a.place += ranked.indexOf(s) + 1;
      a.fair += 1 / regular.length;
      if (ranked[0] === s) a.wins++;
      acc.set(k, a);
    });
  }
  return [...acc]
    .map(([k, a]) => ({
      key: k,
      seats: a.seats,
      wins: a.wins,
      winRate: div(a.wins, a.seats),
      fair: div(a.fair, a.seats),
      ratio: div(div(a.wins, a.seats), div(a.fair, a.seats)),
      bp: div(a.bp, a.seats),
      place: div(a.place, a.seats),
      rel: mean(a.rel),
      relSd: Math.sqrt(mean(a.rel.map((x) => (x - mean(a.rel)) ** 2))),
    }))
    .sort((a, b) => b.winRate - a.winRate || b.bp - a.bp);
}

function winTable(lines: WinLine[], label: string): string {
  return table(
    [
      label,
      "seats",
      "wins",
      "win rate",
      "fair share",
      "win / fair",
      "mean final BP",
      "mean place",
      "BP vs town mean",
      "sd of that",
    ],
    lines.map((w) => [
      w.key,
      w.seats,
      w.wins,
      pct(w.winRate),
      pct(w.fair),
      f2(w.ratio),
      f0(w.bp),
      f2(w.place),
      `${w.rel >= 0 ? "+" : ""}${pct(w.rel)}`,
      pct(w.relSd),
    ]),
  );
}

/** One line under a win table: the spread of the means and of the mean places. */
function spreadLine(lines: WinLine[]): string {
  if (lines.length === 0) return "";
  const bps = lines.map((w) => w.bp);
  const places = lines.map((w) => w.place);
  const m = mean(bps);
  const sd = Math.sqrt(mean(bps.map((b) => (b - m) ** 2)));
  return `Spread: mean final BP from ${f0(Math.min(...bps))} to ${f0(Math.max(...bps))} (${f0(Math.max(...bps) - Math.min(...bps))} BP, sd ${f0(sd)} around ${f0(m)}); mean place from ${f2(Math.min(...places))} to ${f2(Math.max(...places))}.`;
}

/** The systems of money, BP and turns, as columns over personalities. */
function systemTable(r: XReport, prefix: string, perDay: boolean, label: string): string {
  const people = Object.keys(r.byPersonality).sort();
  const systems = new Set<string>();
  for (const c of Object.values(r.byPersonality))
    for (const k of Object.keys(prefixed(c, prefix))) systems.add(k);
  const totals = [...systems].map((s) => ({
    s,
    v: people.reduce((a, p) => a + (r.byPersonality[p]?.[`${prefix}${s}`] ?? 0), 0),
  }));
  totals.sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
  const grand = totals.reduce((a, t) => a + Math.abs(t.v), 0);
  return table(
    [label, "share", ...people],
    totals.map(({ s, v }) => [
      s,
      pct(div(Math.abs(v), grand)),
      ...people.map((p) => {
        const c = r.byPersonality[p] ?? {};
        const x = c[`${prefix}${s}`] ?? 0;
        return perDay ? f0(div(x, c.playerDays ?? 0)) : f0(x);
      }),
    ]),
  );
}

/** The late upgrades the engine pass made cheaper and better (docs/balance/expanded-tuning-log.md). */
export const LATE_UPGRADES = ["night-watchman", "billboard", "memorial-garden"] as const;

export interface UpgradeReturn {
  id: string;
  buyers: number;
  meanDay: number;
  /** Price and any permit it needs, in dollars. */
  cost: number;
  /** Buyers' BP a day against same-personality seats that did not own it, after minus before. */
  effect: number;
  se: number;
  /** Mean days owned, and the BP over those days the effect implies. */
  daysOwned: number;
}

/**
 * What an upgrade returns, as a difference of differences: for each buyer, the BP a day it gained
 * above the mean of the same personality's seats on the same day that did not yet own the upgrade,
 * averaged over the days after the purchase, minus the same over the days before it (day 4 on).
 * Buying happens at the office in the morning, so the day of the purchase is left out.
 */
export function upgradeReturn(r: XReport, id: string): UpgradeReturn {
  const rule = EXPANDED.upgrades.find((u) => u.id === id);
  const cost =
    (rule?.price ?? 0) + (rule?.permit ? (EXPANDED.town.cityHall.permits[rule.permit] ?? 0) : 0);
  // Control means by day, from every seat that does not own `id` that day (so the personalities
  // that never buy it, and the buyers before they do, are the comparison).
  const sums = new Map<string, { total: number; n: number }>();
  const key = (_p: string, d: number) => `${d}`;
  for (const s of r.seats) {
    if (s.joined > 1) continue;
    const day = s.bought[id];
    s.daily.forEach((bp, i) => {
      const d = i + 1;
      if (bp === undefined || (day !== undefined && day < d)) return;
      const a = sums.get(key(s.personality, d)) ?? { total: 0, n: 0 };
      a.total += bp;
      a.n++;
      sums.set(key(s.personality, d), a);
    });
  }
  const diffs: number[] = [];
  const days: number[] = [];
  const bought: number[] = [];
  for (const s of r.seats) {
    const day = s.bought[id];
    if (day === undefined || s.joined > 1) continue;
    const after: number[] = [];
    const before: number[] = [];
    s.daily.forEach((bp, i) => {
      const d = i + 1;
      const c = sums.get(key(s.personality, d));
      if (bp === undefined || !c || c.n < 5 || d < 4 || d === day) return;
      (d > day ? after : before).push(bp - c.total / c.n);
    });
    bought.push(day);
    days.push(after.length);
    if (after.length >= 2 && before.length >= 2) diffs.push(mean(after) - mean(before));
  }
  return {
    id,
    buyers: bought.length,
    meanDay: mean(bought),
    cost,
    effect: mean(diffs),
    se: diffs.length > 1 ? sd(diffs) / Math.sqrt(diffs.length) : 0,
    daysOwned: mean(days),
  };
}

export function xMarkdown(r: XReport): string[] {
  const out: string[] = [];
  const P = r.byPersonality;
  const people = Object.keys(P).sort();
  const all: Counters = {};
  for (const c of Object.values(P)) addAll(all, c);
  const T = r.town;

  out.push("## Expanded: win rate by personality");
  out.push("");
  const byPersonality = winsBy(r, (s) => s.personality);
  out.push(winTable(byPersonality, "personality"));
  out.push("");
  out.push(spreadLine(byPersonality));
  out.push("");
  out.push("## Expanded: win rate by karma path (at the end of the season)");
  out.push("");
  out.push(
    winTable(
      winsBy(r, (s) => s.path),
      "path",
    ),
  );
  out.push("");
  out.push(
    winTable(
      winsBy(r, (s) => s.rivalry),
      "rivalry tier",
    ),
  );
  out.push("");
  out.push(
    winTable(
      winsBy(r, (s) => (s.fought ? "fights (parlor, duel or hit)" : "never fights")),
      "PvP",
    ),
  );
  out.push("");
  if (Object.keys(r.byDifficulty).length > 1) {
    out.push(
      winTable(
        winsBy(r, (s) => s.difficulty),
        "difficulty",
      ),
    );
    out.push("");
  }
  out.push("## Expanded: the parlors at the end of the season");
  out.push("");
  const seatsBy = (p: string) => r.seats.filter((s) => s.personality === p && s.joined <= 1);
  out.push(
    table(
      [
        "personality",
        "final BP",
        "cash",
        "savings",
        "karma",
        "good / evil",
        "upgrades",
        "monuments",
        "in a chain",
        "mayor",
        "BP lost to PvP",
        "decisions / day",
        "turns / day",
      ],
      people.map((p) => {
        const ss = seatsBy(p);
        const c = P[p] ?? {};
        const turns = Object.values(prefixed(c, "turns.")).reduce((a, b) => a + b, 0);
        return [
          p,
          f0(mean(ss.map((s) => s.bp))),
          f0(mean(ss.map((s) => s.money))),
          f0(mean(ss.map((s) => s.savings))),
          f0(mean(ss.map((s) => s.karma))),
          `${pct(div(ss.filter((s) => s.path === "good").length, ss.length))} / ${pct(div(ss.filter((s) => s.path === "evil").length, ss.length))}`,
          f1(mean(ss.map((s) => s.upgrades))),
          f1(mean(ss.map((s) => s.monuments))),
          pct(div(ss.filter((s) => s.chain).length, ss.length)),
          pct(div(ss.filter((s) => s.mayor).length, ss.length)),
          f0(mean(ss.map((s) => s.pvpLost))),
          f0(div(c.steps ?? 0, c.playerDays ?? 0)),
          f1(div(turns, c.playerDays ?? 0)),
        ];
      }),
    ),
  );
  out.push("");
  const uses = Object.entries(prefixed(all, "use."))
    .filter(([k]) => !["neg:soft", "neg:packages"].includes(k) && !k.startsWith("place:"))
    .reduce((a, [, v]) => a + v, 0);
  out.push(
    `Decisions per bot-day across the town: ${f0(div(all.steps ?? 0, all.playerDays ?? 0))} screens answered from log on to log off (the newspaper, every look at the hand of cards, every Back and every walk across the map included), of which ${f0(div(uses, all.playerDays ?? 0))} are choices (a pitch, a purchase, a vote: anything but looking and walking), for ${f1(div(all.customers ?? 0, all.playerDays ?? 0))} customers a day.`,
  );
  out.push("");

  out.push("## Expanded: selling");
  out.push("");
  out.push(
    table(
      [
        "personality",
        "sales / day",
        "walkouts",
        "exact",
        "within 3%",
        "within 8%",
        "bonus share of sale BP",
        "sale BP / customer",
        "money / sale",
        "actions / sale",
        "cremations",
        "listened",
        "coffee",
        "blessed",
        "happy families",
        "sour families",
      ],
      people.map((p) => {
        const c = P[p] ?? {};
        const sales = c.sales ?? 0;
        return [
          p,
          f1(div(sales, c.playerDays ?? 0)),
          pct(div(c.walkouts ?? 0, c.customers ?? 0)),
          pct(div(c.exact ?? 0, sales)),
          pct(div(c.great ?? 0, sales)),
          pct(div(c.nice ?? 0, sales)),
          pct(div(c.bonusBp ?? 0, c.saleBp ?? 0)),
          f1(div(c.saleBp ?? 0, c.customers ?? 0)),
          f0(div(c.saleMoney ?? 0, sales)),
          f1(div(c.actionsPerSale ?? 0, sales)),
          pct(div(c.cremations ?? 0, sales)),
          pct(div(c.salesListened ?? 0, sales)),
          pct(div(c.salesCoffee ?? 0, sales)),
          pct(div(c.salesBlessed ?? 0, sales)),
          pct(div(c.salesHappy ?? 0, sales)),
          pct(div(c.salesSour ?? 0, sales)),
        ];
      }),
    ),
  );
  out.push("");
  out.push("Walkouts by trait (all customers who had the trait, hidden or shown):");
  out.push("");
  const traits = Object.keys(prefixed(T, "trait."))
    .map((k) => k.split(".")[0] as string)
    .filter((v, i, a) => a.indexOf(v) === i);
  out.push(
    table(
      ["trait", "customers", "walkouts", "rate"],
      traits
        .map((t) => [t, T[`trait.${t}.customers`] ?? 0, T[`trait.${t}.walkouts`] ?? 0] as const)
        .sort((a, b) => div(b[2], b[1]) - div(a[2], a[1]))
        .map(([t, n, w]) => [t, n, w, pct(div(w, n))]),
    ),
  );
  out.push("");
  const specials = Object.keys(prefixed(T, "special."))
    .map((k) => k.split(".")[0] as string)
    .filter((v, i, a) => a.indexOf(v) === i);
  out.push(
    table(
      ["special customer", "met", "sales", "walkouts"],
      specials.map((s) => [
        s,
        T[`special.${s}.customers`] ?? 0,
        T[`special.${s}.sales`] ?? 0,
        T[`special.${s}.walkouts`] ?? 0,
      ]),
    ),
  );
  out.push("");
  out.push("Packages sold (share of all sales reaching each tier or higher bought on that sale):");
  out.push("");
  const pk = prefixed(T, "pkg.");
  const cats = [
    ...new Set(
      Object.keys(pk)
        .filter((k) => k !== "sales")
        .map((k) => k.split(".")[0] as string),
    ),
  ];
  out.push(
    table(
      ["package", "tier 1", "tier 2", "tier 3", "tier 4", "tier 5"],
      cats.map((cat) => [
        cat,
        ...[1, 2, 3, 4, 5].map((t) => pct(div(pk[`${cat}.${t}`] ?? 0, T["pkg.sales"] ?? 0))),
      ]),
    ),
  );
  out.push("");
  out.push(
    `Soft-sell cards bought: ${f2(div(T["cards.sold"] ?? 0, T["pkg.sales"] ?? 0))} per sale.`,
  );
  out.push("");

  out.push("## Expanded: money by system");
  out.push("");
  out.push("Dollars earned per player-day:");
  out.push("");
  out.push(systemTable(r, "money.in.", true, "income"));
  out.push("");
  out.push("Dollars spent per player-day:");
  out.push("");
  out.push(systemTable(r, "money.out.", true, "spending"));
  out.push("");
  out.push("## Expanded: BP by system (per player-day)");
  out.push("");
  out.push(systemTable(r, "bp.", true, "source"));
  out.push("");
  out.push("## Expanded: turns by use (per player-day)");
  out.push("");
  out.push(systemTable(r, "turns.", true, "use"));
  out.push("");
  out.push("## Expanded: time by place (decisions per player-day)");
  out.push("");
  out.push(systemTable(r, "place.", true, "scene"));
  out.push("");

  out.push("## Expanded: what each choice returns");
  out.push("");
  const per = (bp: number, cost: number) => (cost > 0 ? f3(bp / cost) : "-");
  const sumKey = (k: string) => people.reduce((a, p) => a + (P[p]?.[k] ?? 0), 0);
  const returns: (string | number)[][] = [
    [
      "a customer (Wait for Customer)",
      "BP per turn",
      per(sumKey("bp.sales"), sumKey("turns.wait (events, scripts)")),
      sumKey("turns.wait (events, scripts)"),
    ],
    [
      "leading the service",
      "BP per turn",
      per(sumKey("bp.service"), sumKey("turns.service")),
      sumKey("turns.service"),
    ],
    [
      "a graveyard duel (challenger)",
      "BP per turn",
      per(sumKey("bp.duels"), sumKey("turns.duels")),
      sumKey("turns.duels"),
    ],
    [
      "robbing a grave",
      "$ per try",
      per(
        sumKey("money.in.rob graves") - sumKey("money.out.rob graves"),
        sumKey("use.graveyard:rob"),
      ),
      sumKey("use.graveyard:rob"),
    ],
    [
      "digging at the office",
      "$ per try",
      per(sumKey("money.in.dig"), sumKey("use.parlor:dig")),
      sumKey("use.parlor:dig"),
    ],
    ["tending the graves", "uses", "-", sumKey("use.graveyard:tend")],
    ["the seance", "turns used", "-", sumKey("turns.seance")],
    [
      "monuments",
      "BP per $",
      per(sumKey("bp.monuments"), sumKey("money.out.monuments")),
      sumKey("money.out.monuments"),
    ],
    [
      "tithes",
      "BP per $",
      per(sumKey("bp.tithe"), sumKey("money.out.tithe")),
      sumKey("money.out.tithe"),
    ],
    [
      "hits (BP the victim lost per $)",
      "BP per $",
      per(T["hit.bpLost"] ?? 0, sumKey("money.out.hits")),
      sumKey("money.out.hits"),
    ],
    [
      "special offers",
      "BP per offer",
      per(
        sumKey("bp.special offers"),
        sumKey("use.neg:offer:accept") + sumKey("use.neg:offer:decline"),
      ),
      sumKey("use.neg:offer:accept"),
    ],
    [
      "body prep choices",
      "BP per choice",
      per(sumKey("bp.body prep"), sumKey("use.prep:choice")),
      sumKey("use.prep:choice"),
    ],
    [
      "risks taken",
      "BP per risk",
      per(sumKey("bp.risks"), sumKey("use.risk:take")),
      sumKey("use.risk:take"),
    ],
  ];
  out.push(table(["choice", "measure", "return", "volume (turns, $ or uses)"], returns));
  out.push("");
  out.push(
    `A lead from the nurse ($${f0(EXPANDED.town.hospital.lead.price)}) brings a sure, richer customer: ${f0(sumKey("leadCustomers"))} lead customers were met. Sale BP per customer over all customers: ${f2(div(sumKey("saleBp"), sumKey("customers")))}.`,
  );
  out.push("");
  out.push("Parlor upgrades (share of seats that bought each, and the mean day bought):");
  out.push("");
  const seats = r.seats.length;
  const up = Object.keys(prefixed(T, "upgrade.")).sort(
    (a, b) => (T[`upgrade.${b}`] ?? 0) - (T[`upgrade.${a}`] ?? 0),
  );
  out.push(
    table(
      ["upgrade", "bought", "share of seats", "mean day"],
      up.map((u) => [
        u,
        T[`upgrade.${u}`] ?? 0,
        pct(div(T[`upgrade.${u}`] ?? 0, seats)),
        f1(div(T[`upgradeDay.${u}`] ?? 0, T[`upgrade.${u}`] ?? 0)),
      ]),
    ),
  );
  out.push("");
  out.push(
    "The three late upgrades the engine pass made cheaper and better, and what they return:",
  );
  out.push("");
  const lateRows = LATE_UPGRADES.map((id) => {
    const u = upgradeReturn(r, id);
    const total = u.effect * u.daysOwned;
    return [
      id,
      u.buyers,
      pct(div(u.buyers, seats)),
      f1(u.meanDay),
      f0(u.cost),
      `${u.effect >= 0 ? "+" : ""}${f1(u.effect)} (se ${f1(u.se)})`,
      f1(u.daysOwned),
      f0(total),
      per(total, u.cost),
    ];
  });
  out.push(
    table(
      [
        "upgrade",
        "bought",
        "share of seats",
        "mean day",
        "cost with permit ($)",
        "BP / day vs peers (after - before)",
        "days owned",
        "BP over the season",
        "BP per $",
      ],
      lateRows,
    ),
  );
  out.push("");
  out.push(
    "BP per day is measured against the same personality's seats on the same day that did not yet own the upgrade, so the season's rise in income cancels; the standard error is across buyers. The monuments return about 0.010 BP a dollar, so an upgrade that returns less is not worth buying for points alone.",
  );
  out.push("");
  const mon = [1, 2, 3, 4, 5].map((t) => T[`monument.${t}`] ?? 0);
  out.push(
    `Monument tiers built: ${mon.map((m, i) => `tier ${i + 1}: ${m}`).join(", ")} (of ${seats} seats).`,
  );
  out.push("");
  const permits = prefixed(T, "permit.");
  const market = prefixed(T, "market.");
  out.push(
    `Permits bought: ${
      Object.entries(permits)
        .map(([k, v]) => `${k} ${v}`)
        .join(", ") || "none"
    }. Black-market buys: ${
      Object.entries(market)
        .map(([k, v]) => `${k} ${v}`)
        .join(", ") || "none"
    }.`,
  );
  out.push("");

  out.push("## Expanded: PvP, duels and hits");
  out.push("");
  out.push(
    table(
      ["measure", "value"],
      [
        ["duels started", T["duel.started"] ?? 0],
        [
          "challenger won / lost / yielded",
          `${T["duel.challengerWon"] ?? 0} / ${T["duel.challengerLost"] ?? 0} / ${T["duel.yielded"] ?? 0}`,
        ],
        [
          "BP won by duel winners / lost by losers",
          `${f0(T["duel.bpWon"] ?? 0)} / ${f0(T["duel.bpLost"] ?? 0)}`,
        ],
        [
          "duels with a Shove: share of duels / challenger won, lost, yielded / mean BP",
          `${pct(div(T["duel.shove.duels"] ?? 0, T["duel.started"] ?? 0))} / ${T["duel.shove.won"] ?? 0}, ${T["duel.shove.lost"] ?? 0}, ${T["duel.shove.yielded"] ?? 0} / ${f1(div(T["duel.shove.net"] ?? 0, T["duel.shove.duels"] ?? 0))}`,
        ],
        [
          "duels without a Shove: challenger won, lost, yielded / mean BP",
          `${T["duel.noShove.won"] ?? 0}, ${T["duel.noShove.lost"] ?? 0}, ${T["duel.noShove.yielded"] ?? 0} / ${f1(div(T["duel.noShove.net"] ?? 0, T["duel.noShove.duels"] ?? 0))}`,
        ],
        ["Shove pressed (times)", T["duel.shove.pressed"] ?? 0],
        ["hits resolved / landed", `${T["hit.resolved"] ?? 0} / ${T["hit.landed"] ?? 0}`],
        ["BP taken from hit victims", f0(T["hit.bpLost"] ?? 0)],
        ["cash stolen in burglaries", f0(T["pvp.cashStolen"] ?? 0)],
      ],
    ),
  );
  out.push("");
  out.push("Hits by the parlor that hired them:");
  out.push("");
  out.push(
    table(
      [
        "personality",
        "hired",
        "landed",
        "hirer behind the target",
        "$ spent",
        "BP taken from targets",
        "BP per $",
      ],
      people
        .filter((p) => (P[p]?.["hit.hired"] ?? 0) > 0)
        .map((p) => {
          const c = P[p] ?? {};
          return [
            p,
            c["hit.hired"] ?? 0,
            c["hit.landedBy"] ?? 0,
            pct(div(c["hit.behindTarget"] ?? 0, c["hit.resolvedBy"] ?? 0)),
            f0(c["money.out.hits"] ?? 0),
            f0(c["hit.bpTaken"] ?? 0),
            per(c["hit.bpTaken"] ?? 0, c["money.out.hits"] ?? 0),
          ];
        }),
    ),
  );
  out.push("");
  out.push("BP lost to other parlors per player-day, by victim and venue:");
  out.push("");
  out.push(
    table(
      ["personality", "parlor fights", "duels", "hits", "total", "share of final BP"],
      people.map((p) => {
        const c = P[p] ?? {};
        const total =
          (c["pvpLost.fight"] ?? 0) + (c["pvpLost.duel"] ?? 0) + (c["pvpLost.hit"] ?? 0);
        const bp = seatsBy(p).reduce((a, s) => a + s.bp, 0);
        return [
          p,
          f1(div(c["pvpLost.fight"] ?? 0, c.playerDays ?? 0)),
          f1(div(c["pvpLost.duel"] ?? 0, c.playerDays ?? 0)),
          f1(div(c["pvpLost.hit"] ?? 0, c.playerDays ?? 0)),
          f1(div(total, c.playerDays ?? 0)),
          pct(div(total, bp)),
        ];
      }),
    ),
  );
  out.push("");
  const victims = r.towns
    .map((t) => [...t.seats].filter((s) => !s.fought).sort((a, b) => b.pvpLost - a.pvpLost)[0])
    .filter((s): s is XSeat => s !== undefined);
  out.push(
    `The most-targeted peaceful parlor in each town (never fights) lost on average ${f0(mean(victims.map((s) => s.pvpLost)))} BP over the season, ${pct(mean(victims.map((s) => div(s.pvpLost, s.bp + s.pvpLost))))} of what it would otherwise have had (worst town: ${pct(Math.max(0, ...victims.map((s) => div(s.pvpLost, s.bp + s.pvpLost))))}); it finished at mean place ${f2(mean(victims.map((s) => s.place)))}.`,
  );
  out.push("");

  out.push("## Expanded: the house");
  out.push("");
  const g = prefixed(T, "gamble.");
  const games = [...new Set(Object.keys(g).map((k) => k.split(".").slice(0, 2).join(".")))].sort();
  out.push(
    table(
      ["game and stake", "plays", "staked", "returned", "return per $"],
      games.map((k) => [
        k,
        g[`${k}.plays`] ?? 0,
        f0(g[`${k}.staked`] ?? 0),
        f0(g[`${k}.returned`] ?? 0),
        f3(div(g[`${k}.returned`] ?? 0, g[`${k}.staked`] ?? 0)),
      ]),
    ),
  );
  out.push("");
  out.push(
    `Gamblers' net: ${
      people
        .filter((p) => (P[p]?.["gamble.staked"] ?? 0) > 0)
        .map(
          (p) =>
            `${p} ${f0(div(P[p]?.["gamble.net"] ?? 0, P[p]?.playerDays ?? 0))} $/day on ${f0(div(P[p]?.["gamble.staked"] ?? 0, P[p]?.playerDays ?? 0))} $/day staked`,
        )
        .join("; ") || "nobody gambled"
    }.`,
  );
  out.push("");

  out.push("## Expanded: the bank");
  out.push("");
  out.push(
    table(
      [
        "personality",
        "loans taken",
        "borrowed $",
        "repaid $",
        "collected",
        "defaulted",
        "written off $",
        "default BP",
        "savings interest $",
      ],
      people.map((p) => {
        const c = P[p] ?? {};
        return [
          p,
          c["loan.taken"] ?? 0,
          f0(c["loan.amount"] ?? 0),
          f0(c["loan.repaid"] ?? 0),
          c["loan.collected"] ?? 0,
          c["loan.defaulted"] ?? 0,
          f0(c["loan.writtenOff"] ?? 0),
          f0(c["loan.defaultBp"] ?? 0),
          f0(c["savings.interest"] ?? 0),
        ];
      }),
    ),
  );
  out.push("");

  out.push("## Expanded: City Hall and chains");
  out.push("");
  const towns = r.towns.length;
  out.push(
    table(
      ["measure", "value"],
      [
        ["ordinance ballots counted", T["ordinance.ballots"] ?? 0],
        [
          "votes per ballot / players",
          `${f2(div(T["ordinance.votes"] ?? 0, T["ordinance.ballots"] ?? 0))} / ${f2(div(T["ordinance.voters"] ?? 0, T["ordinance.ballots"] ?? 0))}`,
        ],
        ["lobbying votes bought", T["ordinance.lobbied"] ?? 0],
        ["elections held (of towns)", `${T["election.held"] ?? 0} of ${towns}`],
        [
          "candidates per election",
          f2(div(T["election.candidates"] ?? 0, T["election.held"] ?? 0)),
        ],
        [
          "votes per election / players",
          `${f2(div(T["election.votes"] ?? 0, T["election.held"] ?? 0))} / ${f2(div(T["election.voters"] ?? 0, T["election.held"] ?? 0))}`,
        ],
        ["campaign ads bought", T["election.ads"] ?? 0],
        [
          "mayors by personality",
          Object.entries(prefixed(T, "mayor."))
            .map(([k, v]) => `${k} ${v}`)
            .join(", ") || "none",
        ],
        ["chains founded / joined", `${T["chain.founded"] ?? 0} / ${T["chain.joined"] ?? 0}`],
        [
          "chains alive at the end, mean members",
          `${r.chains.length}, ${f2(mean(r.chains.map((c) => c.members.length)))}`,
        ],
      ],
    ),
  );
  out.push("");
  out.push(
    winTable(
      winsBy(r, (s) => (s.chain ? "in a chain" : "no chain")),
      "chain",
    ),
  );
  out.push("");

  const late = r.seats.filter((s) => s.joined > 1);
  if (late.length > 0) {
    out.push("## Expanded: a player who starts late");
    out.push("");
    const places = late.map((s) => s.place);
    const n = r.towns[0]?.seats.length ?? 0;
    const medians = r.towns.map((t) => {
      const bps = t.seats
        .filter((s) => s.joined <= 1)
        .map((s) => s.bp)
        .sort((a, b) => a - b);
      return bps[Math.floor((bps.length - 1) / 2)] ?? 0;
    });
    out.push(
      `${late.length} bots joined on day ${late[0]?.joined}. Mean place ${f2(mean(places))} of ${n} (mid-table is ${f1((n + 1) / 2)}); ${pct(div(places.filter((p) => p <= Math.ceil(n / 2)).length, places.length))} finished in the top half; final BP ${f0(mean(late.map((s) => s.bp)))} against a town median of ${f0(mean(medians))}.`,
    );
    out.push("");
  }

  if (r.challenge.length > 0) {
    out.push("## Expanded: the Daily Challenge");
    out.push("");
    const by = (k: (c: ChallengeRun) => string) => {
      const m = new Map<string, number[]>();
      for (const c of r.challenge) m.set(k(c), [...(m.get(k(c)) ?? []), c.score]);
      return [...m].sort((a, b) => mean(b[1]) - mean(a[1]));
    };
    out.push(
      table(
        ["difficulty", "runs", "mean score", "sd", "min", "max"],
        by((c) => c.difficulty).map(([k, v]) => [
          k,
          v.length,
          f1(mean(v)),
          f1(sd(v)),
          Math.min(...v),
          Math.max(...v),
        ]),
      ),
    );
    out.push("");
    const ids = [...new Set(r.challenge.map((c) => c.id))];
    const spread = ids.map((id) => {
      const v = r.challenge.filter((c) => c.id === id).map((c) => c.score);
      return Math.max(...v) - Math.min(...v);
    });
    out.push(
      `${ids.length} challenges. Within one challenge (same customers for everyone) the scores spread by ${f0(mean(spread))} BP on average from the worst run to the best; across challenges the hard bots' mean score varies by ${f0(sd(ids.map((id) => mean(r.challenge.filter((c) => c.id === id && c.difficulty === "hard").map((c) => c.score)))))} BP (sd), the luck of the day.`,
    );
    out.push("");
  }

  out.push("## Expanded: dead choices");
  out.push("");
  out.push(
    "Choices offered to at least 20 seats but used by fewer than 2% of them. Bots follow committed strategies, so a low share can mean no personality is written to want it; the returns table above says whether it deserves one.",
  );
  out.push("");
  const dead = Object.keys(prefixed(T, "capable."))
    .map((k) => ({
      k,
      capable: T[`capable.${k}`] ?? 0,
      users: T[`users.${k}`] ?? 0,
      uses: T[`use.${k}`] ?? 0,
    }))
    .filter((d) => d.capable >= 20 && div(d.users, d.capable) < 0.02)
    .sort((a, b) => div(a.users, a.capable) - div(b.users, b.capable));
  out.push(
    dead.length === 0
      ? "None."
      : table(
          ["choice", "seats offered", "seats used", "share", "uses"],
          dead.map((d) => [d.k, d.capable, d.users, pct(div(d.users, d.capable)), d.uses]),
        ),
  );
  out.push("");
  out.push(
    "Usage of every choice (seats that used it at least once among seats that were offered it):",
  );
  out.push("");
  const used = Object.keys(prefixed(T, "capable."))
    .map((k) => ({
      k,
      capable: T[`capable.${k}`] ?? 0,
      users: T[`users.${k}`] ?? 0,
      uses: T[`use.${k}`] ?? 0,
    }))
    .filter((d) => d.capable > 0)
    .sort((a, b) => b.uses - a.uses);
  out.push(
    table(
      ["choice", "uses", "per seat", "seats offered", "share of them that used it"],
      used.map((d) => [
        d.k,
        d.uses,
        f1(div(d.uses, seats)),
        d.capable,
        pct(div(d.users, d.capable)),
      ]),
    ),
  );
  out.push("");
  out.push("## What only human playtesting can answer");
  out.push("");
  out.push(
    "The bots play every system from the same committed strategies each season, so these numbers say how often the game offers something, not whether a person enjoys it. Drawn from this run:",
  );
  out.push("");
  const decisions = div(all.steps ?? 0, all.playerDays ?? 0);
  const choices = div(uses, all.playerDays ?? 0);
  const living = T["living.days"] ?? 0;
  const nTowns = T["living.towns"] ?? 0;
  const walkRate = div(all.walkouts ?? 0, all.customers ?? 0);
  const held = T["election.held"] ?? 0;
  out.push(
    `- **Is a day too long?** A bot answers ${f0(decisions)} screens a day, ${f0(choices)} of them choices, for ${f1(div(all.customers ?? 0, all.playerDays ?? 0))} customers. A person reads faster than a bot looks but also hesitates; only a playtest says whether ${f0(choices)} choices a day is fun or a chore, and whether the hand and package panes should be on the main screen.`,
  );
  out.push(
    `- **Walkout pacing.** ${pct(walkRate)} of ${f0(all.customers ?? 0)} customers walked out. Bots stop pushing before the mood does, so this is the floor; a person who misreads a customer, or is greedy for the exact match (${pct(div(all.exact ?? 0, all.sales ?? 0))} of the bots' sales), will see far more. Whether a walkout feels like a fair lesson or a punishment is not measurable here.`,
  );
  out.push(
    `- **How often the town speaks.** News changed the rules on ${pct(div(T["living.newsDays"] ?? 0, living))} of days, a weather set on ${pct(div(T["living.weatherDays"] ?? 0, living))}, and a story arc was running on ${pct(div(T["living.arcDays"] ?? 0, living))} of days (${f1(div(T["living.arcsPlayed"] ?? 0, nTowns))} arcs and ${f1(div(T["living.arcBeats"] ?? 0, nTowns))} story beats a town a season). Bots read none of it as a story; whether that is too much, too little, or repeats itself by day 20 needs readers.`,
  );
  out.push(
    `- **Is the election a contest?** ${f2(div(T["election.candidates"] ?? 0, held))} candidates stood in each of ${held} elections and ${f1(div(T["election.voters"] ?? 0, held))} parlors voted: the bots vote by a preference list. Whether people campaign, lobby or bluff is a social question.`,
  );
  out.push(
    `- **Ordinances and arcs by effect, not by rote.** The bots rank ordinances from a fixed list (${f0(T["ordinance.ballots"] ?? 0)} ballots, ${f2(div(T["ordinance.votes"] ?? 0, T["ordinance.ballots"] ?? 0))} votes each, ${f0(T["ordinance.lobbied"] ?? 0)} lobbying votes bought). Do players read the effects and choose, or click the first?`,
  );
  out.push(
    `- **Grudges and bluffing.** ${f0(T["duel.started"] ?? 0)} duels and ${f0(T["hit.resolved"] ?? 0)} hits happened with no memory of who did what to whom. Retaliation, alliances and the Peace Pledge as a social contract are for people.`,
  );
  out.push(
    "- **Wording.** The bots read panels and button ids, and `packages/bots/test/scrambled.test.ts` plays a season with every pack string reworded and sees no stuck day; that proves the text does not carry rules, not that it is funny, clear or tonally right.",
  );
  out.push("");
  return out;
}
