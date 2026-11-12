import {
  addTally,
  emptyPvp,
  emptyTally,
  type Issue,
  type Pvp,
  type Tally,
  type TownReport,
  type WaitOutcome,
} from "./metrics.js";
import type { ChallengeRun, SimOptions } from "./town.js";
import { buildXReport, type XReport, xMarkdown } from "./xreport.js";

export interface Row {
  key: string;
  playerDays: number;
  bpPerDay: number;
  bpPerTurn: number;
  /** Sale BP (with bonuses) per customer turn: the selling skill alone. */
  saleBpPerTurn: number;
  /** BP per day from fights the bot started. */
  battleBpPerDay: number;
  turnsPerDay: number;
  salesPerDay: number;
  walkoutRate: number;
  /** Share of sales that hit the limit exactly (+200). */
  perfectRate: number;
  close50Rate: number;
  close100Rate: number;
  /** Share of sales BP that came from the closeness bonuses. */
  bonusShare: number;
  /** Mean sale price over the customer's spending limit. */
  capture: number;
  riskTakeRate: number;
  riskBpPerDay: number;
}

export interface WinRow {
  personality: string;
  seats: number;
  wins: number;
  winRate: number;
  /** Win rate if every seat were equal: 1 / players. */
  fairShare: number;
  avgFinalBp: number;
  avgPlace: number;
}

export interface SimReport {
  options: SimOptions;
  towns: number;
  steps: number;
  durationMs: number;
  personalities: Row[];
  difficulties: Row[];
  psych: Row[];
  exactMatch: {
    sales: number;
    perfect: number;
    perSale: number;
    perPlayerDay: number;
    shareOfAllBp: number;
  };
  tags: {
    income: Record<string, number>;
    spend: Record<string, number>;
    spendByPersonality: Record<string, Record<string, number>>;
  };
  pvp: Pvp & { visitsPerPlayerDay: number; attackerWinRate: number; tagsPerSteal: number };
  wait: { counts: Record<WaitOutcome, number>; shares: Record<WaitOutcome, number> };
  snowball: {
    byDay: {
      day: number;
      leader: number;
      second: number;
      median: number;
      leaderOverMedian: number;
      leadOverSecond: number;
    }[];
    /** Share of towns whose leader after day k went on to win. */
    leaderHolds: { day: number; share: number }[];
    /** Mean final BP of the winner over the town median. */
    finalWinnerOverMedian: number;
    /** Which personality leads after day k, counted over towns. */
    leaders: { day: number; counts: Record<string, number> }[];
  };
  /** BP lost to attacks per player-day, by the victim's personality. */
  victimBpPerDay: Record<string, number>;
  wins: WinRow[];
  winsByDifficulty: WinRow[];
  issues: Issue[];
  issueCounts: Record<string, number>;
  ok: boolean;
  /** Expanded runs only. */
  expanded?: XReport;
}

const div = (a: number, b: number) => (b === 0 ? 0 : a / b);

function row(key: string, t: Tally): Row {
  const customers = t.customers;
  return {
    key,
    playerDays: t.playerDays,
    bpPerDay: div(t.bp, t.playerDays),
    bpPerTurn: div(t.bp, t.turns),
    saleBpPerTurn: div(t.salesBp, t.turns),
    battleBpPerDay: div(t.battleBp, t.playerDays),
    turnsPerDay: div(t.turns, t.playerDays),
    salesPerDay: div(t.sales, t.playerDays),
    walkoutRate: div(t.walkouts, customers),
    perfectRate: div(t.perfect, t.sales),
    close50Rate: div(t.close50, t.sales),
    close100Rate: div(t.close100, t.sales),
    bonusShare: div(t.bonusBp, t.salesBp),
    capture: div(t.capture, t.sales),
    riskTakeRate: div(t.risksTaken, t.risksTaken + t.risksDeclined),
    riskBpPerDay: div(t.riskBp, t.playerDays),
  };
}

function mergeTallies(
  reports: TownReport[],
  pick: (r: TownReport) => Record<string, Tally>,
): Map<string, Tally> {
  const out = new Map<string, Tally>();
  for (const r of reports) {
    for (const [k, t] of Object.entries(pick(r))) {
      const into = out.get(k) ?? emptyTally();
      addTally(into, t);
      out.set(k, into);
    }
  }
  return out;
}

function addRecord(into: Record<string, number>, from: Record<string, number>): void {
  for (const [k, v] of Object.entries(from)) into[k] = (into[k] ?? 0) + v;
}

function winRows(
  reports: TownReport[],
  keyOf: (s: TownReport["seats"][number]) => string,
): WinRow[] {
  const acc = new Map<
    string,
    { seats: number; wins: number; bp: number; place: number; fair: number }
  >();
  for (const r of reports) {
    const ranked = [...r.seats.keys()].sort(
      (a, b) => (r.seats[b]?.bp ?? 0) - (r.seats[a]?.bp ?? 0) || a - b,
    );
    r.seats.forEach((s, i) => {
      const k = keyOf(s);
      const a = acc.get(k) ?? { seats: 0, wins: 0, bp: 0, place: 0, fair: 0 };
      a.seats++;
      a.bp += s.bp;
      a.place += ranked.indexOf(i) + 1;
      a.fair += 1 / r.seats.length;
      if (r.winner === i) a.wins++;
      acc.set(k, a);
    });
  }
  return [...acc]
    .map(([personality, a]) => ({
      personality,
      seats: a.seats,
      wins: a.wins,
      winRate: div(a.wins, a.seats),
      fairShare: div(a.fair, a.seats),
      avgFinalBp: div(a.bp, a.seats),
      avgPlace: div(a.place, a.seats),
    }))
    .sort((a, b) => b.winRate - a.winRate);
}

export function buildReport(
  options: SimOptions,
  reports: TownReport[],
  durationMs: number,
  challenge: ChallengeRun[] = [],
): SimReport {
  const byP = mergeTallies(reports, (r) => r.byPersonality);
  const byD = mergeTallies(reports, (r) => r.byDifficulty);
  const byPsych = mergeTallies(reports, (r) => r.byPsych);
  const all = emptyTally();
  for (const t of byP.values()) addTally(all, t);
  const income: Record<string, number> = {};
  const spend: Record<string, number> = {};
  const spendByPersonality: Record<string, Record<string, number>> = {};
  const pvp = emptyPvp();
  const wait: Record<WaitOutcome, number> = {
    customer: 0,
    event: 0,
    risk: 0,
    script: 0,
    noTurns: 0,
  };
  const issues: Issue[] = [];
  const issueCounts: Record<string, number> = {};
  let steps = 0;
  for (const r of reports) {
    steps += r.steps;
    addRecord(income, r.tagIncome);
    addRecord(spend, r.tagSpend);
    for (const [p, rec] of Object.entries(r.spendByPersonality)) {
      spendByPersonality[p] ??= {};
      addRecord(spendByPersonality[p] as Record<string, number>, rec);
    }
    for (const k of Object.keys(pvp) as (keyof Pvp)[]) pvp[k] += r.pvp[k];
    for (const k of Object.keys(wait) as WaitOutcome[]) wait[k] += r.wait[k];
    for (const i of r.issues) {
      issueCounts[i.kind] = (issueCounts[i.kind] ?? 0) + 1;
      if (issues.length < 200) issues.push(i);
    }
  }
  const waits = Object.values(wait).reduce((a, b) => a + b, 0);
  const days = options.days;
  const byDay = [];
  for (let d = 0; d < days; d++) {
    const rows = reports.map((r) => r.daily[d]).filter((x) => x !== undefined);
    const n = rows.length;
    const mean = (f: (x: (typeof rows)[number]) => number) =>
      div(
        rows.reduce((a, x) => a + f(x), 0),
        n,
      );
    byDay.push({
      day: d + 1,
      leader: mean((x) => x.leader),
      second: mean((x) => x.second),
      median: mean((x) => x.median),
      leaderOverMedian: mean((x) => div(x.leader, Math.max(1, x.median))),
      leadOverSecond: mean((x) => x.leader - x.second),
    });
  }
  const leaderHolds = [];
  for (const k of [1, 3, 5, 10, 15, 20, 25].filter((k) => k <= days)) {
    let held = 0;
    for (const r of reports) {
      const winnerId = r.seats[r.winner]?.playerId;
      if (r.daily[k - 1]?.leaderId === winnerId) held++;
    }
    leaderHolds.push({ day: k, share: div(held, reports.length) });
  }
  const leaders = [];
  for (const k of [1, 5, 10, 15, 20, 25, 30].filter((k) => k <= days)) {
    const counts: Record<string, number> = {};
    for (const r of reports) {
      const who = r.daily[k - 1]?.leaderPersonality;
      if (who) counts[who] = (counts[who] ?? 0) + 1;
    }
    leaders.push({ day: k, counts });
  }
  const victimTotals: Record<string, number> = {};
  for (const r of reports) addRecord(victimTotals, r.victimBp);
  const victimBpPerDay = Object.fromEntries(
    Object.entries(victimTotals).map(([k, v]) => [k, div(v, byP.get(k)?.playerDays ?? 0)]),
  );
  const finalWinnerOverMedian = div(
    reports.reduce((a, r) => {
      const last = r.daily[r.daily.length - 1];
      return a + (last ? div(last.leader, Math.max(1, last.median)) : 0);
    }, 0),
    reports.length,
  );
  const blocking =
    (issueCounts.invariant ?? 0) +
    (issueCounts.rejected ?? 0) +
    (issueCounts.exploit ?? 0) +
    (issueCounts.stuck ?? 0) +
    (issueCounts.error ?? 0);
  const expanded = buildXReport(reports, challenge);
  return {
    options,
    towns: reports.length,
    steps,
    durationMs,
    personalities: [...byP].map(([k, t]) => row(k, t)).sort((a, b) => b.bpPerDay - a.bpPerDay),
    difficulties: [...byD].map(([k, t]) => row(k, t)).sort((a, b) => b.bpPerDay - a.bpPerDay),
    psych: [...byPsych].map(([k, t]) => row(k, t)).sort((a, b) => Number(a.key) - Number(b.key)),
    exactMatch: {
      sales: all.sales,
      perfect: all.perfect,
      perSale: div(all.perfect, all.sales),
      perPlayerDay: div(all.perfect, all.playerDays),
      shareOfAllBp: div(all.perfect * 200, all.bp),
    },
    tags: { income, spend, spendByPersonality },
    pvp: {
      ...pvp,
      visitsPerPlayerDay: div(pvp.visits, all.playerDays),
      attackerWinRate: div(pvp.attackerWins, pvp.attackerWins + pvp.attackerLosses),
      tagsPerSteal: div(pvp.tagsStolen, pvp.steals),
    },
    wait: {
      counts: wait,
      shares: Object.fromEntries(
        Object.entries(wait).map(([k, v]) => [k, div(v, waits)]),
      ) as Record<WaitOutcome, number>,
    },
    snowball: { byDay, leaderHolds, finalWinnerOverMedian, leaders },
    victimBpPerDay,
    wins: winRows(reports, (s) => s.personality),
    winsByDifficulty: winRows(reports, (s) => s.difficulty),
    issues,
    issueCounts,
    ok: blocking === 0,
    ...(expanded ? { expanded } : {}),
  };
}

// ---------------------------------------------------------------------------
// Markdown

const f1 = (n: number) => n.toFixed(1);
const f2 = (n: number) => n.toFixed(2);
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function table(head: string[], rows: (string | number)[][]): string {
  const line = (cells: (string | number)[]) => `| ${cells.join(" | ")} |`;
  return [line(head), line(head.map(() => "---")), ...rows.map(line)].join("\n");
}

function rowTable(rows: Row[], label: string, expanded = false): string {
  return table(
    [
      label,
      "player-days",
      "BP/day",
      "BP/turn",
      "sale BP/turn",
      "fight BP/day",
      "turns/day",
      "sales/day",
      "walkouts",
      expanded ? "exact" : "exact (+200)",
      expanded ? "within 3%" : "within $50",
      expanded ? "within 8%" : "within $100",
      "bonus share of sale BP",
      "price/limit",
      "risks taken",
      "risk BP/day",
    ],
    rows.map((r) => [
      r.key,
      r.playerDays,
      f1(r.bpPerDay),
      f2(r.bpPerTurn),
      f2(r.saleBpPerTurn),
      f1(r.battleBpPerDay),
      f1(r.turnsPerDay),
      f1(r.salesPerDay),
      pct(r.walkoutRate),
      pct(r.perfectRate),
      pct(r.close50Rate),
      pct(r.close100Rate),
      pct(r.bonusShare),
      f2(r.capture),
      pct(r.riskTakeRate),
      f1(r.riskBpPerDay),
    ]),
  );
}

function money(record: Record<string, number>): string {
  const total = Object.values(record).reduce((a, b) => a + b, 0);
  return table(
    ["category", "gold-tag equivalents", "share"],
    Object.entries(record)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => [k, f1(v), pct(div(v, total))]),
  );
}

export function toMarkdown(r: SimReport): string {
  const o = r.options;
  const out: string[] = [];
  out.push(`# Balance report: ${o.rules} rules`);
  out.push("");
  out.push(
    `Generated by \`@fq/sim\`: ${r.towns} towns of ${o.players} bots, ${o.days} days each, difficulty ${o.difficulty}${o.oracle ? ", oracle bots (read hidden state)" : ""}, base seed ${o.seed}. ${r.steps.toLocaleString("en-US")} actions in ${(r.durationMs / 1000).toFixed(0)} s.`,
  );
  if (o.set && Object.keys(o.set).length > 0) {
    out.push("");
    out.push(
      `Rule numbers set for this run only (\`--set\`): ${Object.entries(o.set)
        .map(([k, v]) => `\`${k}\` = ${v}`)
        .join(", ")}.`,
    );
  }
  out.push("");
  out.push(
    `**Checks: ${r.ok ? "passed" : "FAILED"}.** ${
      Object.entries(r.issueCounts)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ") ||
      "No invariant breaks, rejected offered buttons, exploit signatures or stuck bots."
    }`,
  );
  out.push("");
  out.push("## Win rate by personality");
  out.push("");
  out.push(
    table(
      ["personality", "seats", "wins", "win rate", "fair share", "mean final BP", "mean place"],
      r.wins.map((w) => [
        w.personality,
        w.seats,
        w.wins,
        pct(w.winRate),
        pct(w.fairShare),
        f1(w.avgFinalBp),
        f2(w.avgPlace),
      ]),
    ),
  );
  if (r.winsByDifficulty.length > 1) {
    out.push("");
    out.push(
      table(
        ["difficulty", "seats", "wins", "win rate", "mean final BP", "mean place"],
        r.winsByDifficulty.map((w) => [
          w.personality,
          w.seats,
          w.wins,
          pct(w.winRate),
          f1(w.avgFinalBp),
          f2(w.avgPlace),
        ]),
      ),
    );
  }
  out.push("");
  out.push("## BP by personality");
  out.push("");
  out.push(
    "BP/turn counts only turns spent on customers; BP/day includes risks, events, mail rewards and battles.",
  );
  out.push("");
  const xr = !!r.expanded;
  out.push(rowTable(r.personalities, "personality", xr));
  if (r.difficulties.length > 1) {
    out.push("");
    out.push(rowTable(r.difficulties, "difficulty", xr));
  }
  out.push("");
  out.push("## BP by psych level (as the stats sheet shows it, at the start of the day)");
  out.push("");
  out.push(rowTable(r.psych, "psych", xr));
  out.push("");
  const e = r.exactMatch;
  if (xr) {
    out.push("## The exact match");
    out.push("");
    out.push(
      `${e.perfect} of ${e.sales} sales (${pct(e.perSale)}) hit the spending limit exactly: ${f2(e.perPlayerDay * 30)} per player per 30 days. All closeness bonuses (exact, within 3%, within 8%) are the "bonus share" column above.`,
    );
  } else {
    out.push("## The +200 exact-match bonus");
    out.push("");
    out.push(
      `${e.perfect} of ${e.sales} sales (${pct(e.perSale)}) hit the spending limit exactly: ${f2(e.perPlayerDay * 30)} per player per 30 days. Those bonuses are ${pct(e.shareOfAllBp)} of all BP earned.`,
    );
  }
  out.push("");
  out.push("## Wait for Customer outcomes");
  out.push("");
  out.push(
    table(
      ["outcome", "count", "share"],
      (Object.keys(r.wait.counts) as WaitOutcome[]).map((k) => [
        k,
        r.wait.counts[k],
        pct(r.wait.shares[k]),
      ]),
    ),
  );
  out.push("");
  out.push("## Tags");
  out.push("");
  out.push("Income by source:");
  out.push("");
  out.push(money(r.tags.income));
  out.push("");
  out.push("Spending and losses by use:");
  out.push("");
  out.push(money(r.tags.spend));
  out.push("");
  const cats = [
    ...new Set(Object.values(r.tags.spendByPersonality).flatMap((x) => Object.keys(x))),
  ].sort();
  out.push(
    table(
      ["personality", ...cats],
      Object.entries(r.tags.spendByPersonality).map(([p, rec]) => [
        p,
        ...cats.map((c) => f1(rec[c] ?? 0)),
      ]),
    ),
  );
  out.push("");
  out.push("## PvP");
  out.push("");
  const v = r.pvp;
  out.push(
    table(
      ["measure", "value"],
      [
        ["visits (doors reached)", v.visits],
        ["visits per player-day", f2(v.visitsPerPlayerDay)],
        ["refused at the door (online, police, locked)", v.refused],
        ["thefts", v.steals],
        ["tags per theft", f2(v.tagsPerSteal)],
        ["battles started", v.battles],
        [
          "attacker wins / losses",
          `${v.attackerWins} / ${v.attackerLosses} (${pct(v.attackerWinRate)})`,
        ],
        ["BP won by winning attackers", v.battleBpWon],
        ["BP lost by losing attackers", v.battleBpLost],
        ["arsons hired / stopped by a smoke detector", `${v.arsonHired} / ${v.arsonStopped}`],
        [
          "Cursed Tigers / Lucky Sparrows / Lucky Dragons",
          `${v.tigers} / ${v.sparrows} / ${v.dragons}`,
        ],
      ],
    ),
  );
  out.push("");
  out.push("BP lost to other parlors' attacks, per player-day, by the victim's personality:");
  out.push("");
  out.push(
    table(
      ["personality", "BP lost per day"],
      Object.entries(r.victimBpPerDay)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => [k, f1(v)]),
    ),
  );
  out.push("");
  out.push("## Snowball");
  out.push("");
  out.push(
    `At the end the leader has ${f2(r.snowball.finalWinnerOverMedian)}x the median parlor's BP.`,
  );
  out.push("");
  out.push(
    table(
      ["after day", "leader went on to win"],
      r.snowball.leaderHolds.map((h) => [h.day, pct(h.share)]),
    ),
  );
  out.push("");
  const names = [...new Set(r.snowball.leaders.flatMap((l) => Object.keys(l.counts)))].sort();
  out.push(
    table(
      ["leader after day", ...names],
      r.snowball.leaders.map((l) => [l.day, ...names.map((n) => l.counts[n] ?? 0)]),
    ),
  );
  out.push("");
  const pick = r.snowball.byDay.filter((d) => d.day === 1 || d.day % 5 === 0);
  out.push(
    table(
      ["day", "leader BP", "runner-up", "median", "leader / median", "lead over runner-up"],
      pick.map((d) => [
        d.day,
        f1(d.leader),
        f1(d.second),
        f1(d.median),
        f2(d.leaderOverMedian),
        f1(d.leadOverSecond),
      ]),
    ),
  );
  if (r.expanded) {
    out.push("");
    out.push(...xMarkdown(r.expanded));
  }
  if (r.issues.length > 0) {
    out.push("");
    out.push("## Issues");
    out.push("");
    out.push(
      table(
        ["kind", "seed", "day", "player", "detail"],
        r.issues
          .slice(0, 50)
          .map((i) => [i.kind, i.seed, i.day, i.player, i.detail.replace(/\|/g, "/")]),
      ),
    );
  }
  out.push("");
  return out.join("\n");
}
