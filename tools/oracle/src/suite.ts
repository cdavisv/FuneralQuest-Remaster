import { addCoverage, type Coverage, emptyCoverage } from "./coverage.js";
import { type CustomerReport, compareCustomers } from "./customers.js";
import { type PlayerSpec, runWalk, type WalkResult, type WalkSpec } from "./run.js";
import { wordsOnly } from "./vars.js";

const PLAYERS: readonly PlayerSpec[] = [
  { name: "Alice", parlor: "Alice Rest", male: false },
  { name: "Bob", parlor: "Bobs Boxes", male: true },
  { name: "Carl", parlor: "Carl Crypts", male: true },
  { name: "Dora", parlor: "Dora Digs", male: false },
  { name: "Earl", parlor: "Earls Urns", male: true },
];

/** A family of walks: the same shape of town with many seeds. */
export interface Family {
  name: string;
  /** What the family is for. */
  purpose: string;
  spec: (seed: number) => WalkSpec;
}

function rich(players: number): WalkSpec["grants"] {
  const out: [number, string, number][] = [];
  for (let p = 0; p < players; p++) {
    out.push([p, "gold", 120], [p, "silver", 30], [p, "wood", 30], [p, "strength", 6 + p]);
  }
  return out;
}

/** Rivals with something to break: lockpicks, padlocks of several strengths, safes, strengths. */
function raiders(seed: number): WalkSpec["grants"] {
  const strength = (p: number) => [2, 5, 9, 14][(seed + p) % 4] as number;
  const padlock = [0, 100, 9, 40][seed % 4] as number;
  return [
    [0, "lockpicks", 4],
    [0, "strength", strength(0)],
    [1, "padlock", padlock > 0 ? 1 : 0],
    [1, "padlockStrength", padlock],
    [1, "safe", seed % 2],
    [1, "strength", strength(1)],
    [2, "lockpicks", 2],
    [2, "fireAlarm", 1],
    [2, "strength", strength(2)],
    [2, "hpMax", 6 + (seed % 9)],
    [3, "padlock", 1],
    [3, "padlockStrength", 6],
    [3, "lockpicks", 1],
    [3, "strength", strength(3)],
    [0, "gold", 40],
    [1, "wood", 9],
    [2, "silver", 7],
    [3, "gold", 12],
  ];
}

export const FAMILIES: readonly Family[] = [
  {
    name: "salesman",
    purpose:
      "one player waiting for customers all day: events, risks, script events, every negotiation button",
    spec: (seed) => ({
      name: `salesman ${seed}`,
      mtSeed: seed,
      crtSeed: seed * 7919 + 17,
      players: PLAYERS.slice(0, 1),
      days: 2,
      actions: 60,
      walkSeed: seed,
      waitWeight: 200,
    }),
  },
  {
    name: "town",
    purpose: "three players over four days: every place, mail, visits, the cafe, midnight",
    spec: (seed) => ({
      name: `town ${seed}`,
      mtSeed: seed,
      crtSeed: seed * 7 + 3,
      players: PLAYERS.slice(0, 3),
      days: 4,
      actions: 80,
      walkSeed: seed,
    }),
  },
  {
    name: "rich town",
    purpose:
      "four players with tags and strength to spend: hearses, security, classes, battles, steals",
    spec: (seed) => ({
      name: `rich town ${seed}`,
      mtSeed: seed + 1000,
      crtSeed: seed * 31 + 5,
      players: PLAYERS.slice(0, 4),
      days: 3,
      actions: 90,
      walkSeed: seed + 1000,
      waitWeight: 4,
      grants: rich(4),
    }),
  },
  {
    name: "rivals",
    purpose: "players take turns, so the others are offline: visits, padlocks, steals and battles",
    spec: (seed) => ({
      name: `rivals ${seed}`,
      mtSeed: seed + 4000,
      crtSeed: seed * 17 + 29,
      players: PLAYERS.slice(0, 4),
      days: 4,
      actions: 70,
      walkSeed: seed + 4000,
      waitWeight: 3,
      sequential: true,
      grants: rich(4),
    }),
  },
  {
    name: "raiders",
    purpose:
      "break-ins and battles: lockpicks against padlocks of several strengths, safes, smoke " +
      "detectors, strong and weak fighters, running away, quotes, the hospital, the Crime page",
    spec: (seed) => ({
      name: `raiders ${seed}`,
      mtSeed: seed + 5000,
      crtSeed: seed * 37 + 3,
      players: PLAYERS.slice(0, 4),
      days: 4,
      actions: 90,
      walkSeed: seed + 5000,
      waitWeight: 1,
      sequential: true,
      settings: { visitsPerDay: 8 },
      grants: raiders(seed),
      places: [
        [38, 12],
        [37, 2],
        [4, 2],
      ],
      prefer: ["Visit", "Try Door", "Pick Lock", "Steal", "Attack", "Run", "Continue", "Leave"],
    }),
  },
  {
    name: "errands",
    purpose:
      "Yang's (every dish, deliveries, getting thrown out), the library, name changes, the " +
      "paper and announcements with links, letters and replies",
    spec: (seed) => ({
      name: `errands ${seed}`,
      mtSeed: seed + 6000,
      crtSeed: seed * 41 + 9,
      players: PLAYERS.slice(0, 3),
      days: 3,
      actions: 70,
      walkSeed: seed + 6000,
      waitWeight: 2,
      grants: rich(3),
      places: [
        [13, 8],
        [36, 4],
        [4, 4],
        [23, 2],
      ],
      prefer: ["Order #1", "Order #2", "Order #3", "Library", "Old Papers", "View Deeds", "Name"],
    }),
  },
  {
    name: "tournament",
    purpose: "a two-day tournament played to its end, the reset and the next game",
    spec: (seed) => ({
      name: `tournament ${seed}`,
      mtSeed: seed + 2000,
      crtSeed: seed * 13 + 11,
      players: PLAYERS.slice(0, 3),
      days: 4,
      actions: 50,
      walkSeed: seed + 2000,
      settings: { tournamentActive: true, tournamentDays: 2 },
    }),
  },
  {
    name: "crowd",
    purpose: "five players, short days: rankings, top sellers, deletion of idle players",
    spec: (seed) => ({
      name: `crowd ${seed}`,
      mtSeed: seed + 3000,
      crtSeed: seed * 101 + 7,
      players: PLAYERS,
      days: 5,
      actions: 30,
      walkSeed: seed + 3000,
    }),
  },
];

export interface Grouped {
  key: string;
  count: number;
  example: { walk: string; index: number; step: unknown; original: string; port: string };
}

export interface FamilyReport {
  name: string;
  purpose: string;
  walks: number;
  steps: number;
  matched: number;
  /** Walks that ran to the end with state and draws identical after every step. */
  fullyMatched: number;
  divergences: {
    walk: string;
    index: number;
    step: unknown;
    rng: unknown;
    state: unknown;
  }[];
  flows: Grouped[];
  /** State differences that closed again (see MAX_TRANSIENT), grouped by the fields involved. */
  transients: Grouped[];
  /** Text that differs only in markup, whitespace, entities or the log-time prefix. */
  formattingDiffs: number;
  /** Text that differs in words, grouped by variable and the start of the original. */
  wordDiffs: Grouped[];
  coverage: Coverage;
}

function group(map: Map<string, Grouped>, key: string, example: Grouped["example"]): void {
  const g = map.get(key);
  if (g) g.count++;
  else map.set(key, { key, count: 1, example });
}

export async function runFamily(
  family: Family,
  seeds: readonly number[],
  onWalk?: (r: WalkResult) => void,
): Promise<FamilyReport> {
  const report: FamilyReport = {
    name: family.name,
    purpose: family.purpose,
    walks: 0,
    steps: 0,
    matched: 0,
    fullyMatched: 0,
    divergences: [],
    flows: [],
    transients: [],
    formattingDiffs: 0,
    wordDiffs: [],
    coverage: emptyCoverage(),
  };
  const flows = new Map<string, Grouped>();
  const words = new Map<string, Grouped>();
  const transients = new Map<string, Grouped>();
  for (const seed of seeds) {
    const spec = family.spec(seed);
    const r = await runWalk(spec);
    onWalk?.(r);
    report.walks++;
    report.steps += r.steps;
    report.matched += r.matched;
    if (!r.divergence) report.fullyMatched++;
    else {
      const d = r.divergence;
      report.divergences.push({
        walk: spec.name,
        index: d.index,
        step: d.step,
        rng: d.rng,
        state: d.state.slice(0, 12),
      });
    }
    addCoverage(report.coverage, r.records, r.matched);
    for (const f of r.flowDiffs) {
      const label = "label" in f.step ? f.step.label : f.step.kind;
      group(flows, `${f.refused.port ? "port" : "original"} could not: ${label}`, {
        walk: spec.name,
        index: f.index,
        step: f.step,
        original: JSON.stringify(f.original).slice(0, 600),
        port: JSON.stringify(f.port).slice(0, 600),
      });
    }
    for (const t of r.transients) {
      if (t.index >= r.matched) continue;
      const fields = [...new Set(t.state.map((d) => d.path.replace(/^players\[\d+\]\./, "")))].join(
        ", ",
      );
      group(transients, `${t.step.kind} ${"label" in t.step ? t.step.label : ""}: ${fields}`, {
        walk: spec.name,
        index: t.index,
        step: t.step,
        original: JSON.stringify(t.state.map((d) => [d.path, d.original])),
        port: JSON.stringify(t.state.map((d) => [d.path, d.port])),
      });
    }
    for (const t of r.textDiffs) {
      if (t.index >= r.matched) continue;
      if (wordsOnly(t.original) === wordsOnly(t.port)) {
        report.formattingDiffs++;
        continue;
      }
      group(words, `${t.name}: ${t.original.slice(0, 48)}`, {
        walk: spec.name,
        index: t.index,
        step: t.step,
        original: t.original.slice(0, 600),
        port: t.port.slice(0, 600),
      });
    }
  }
  report.flows = [...flows.values()].sort((a, b) => b.count - a.count);
  report.wordDiffs = [...words.values()].sort((a, b) => b.count - a.count);
  report.transients = [...transients.values()].sort((a, b) => b.count - a.count);
  return report;
}

export interface SuiteReport {
  customers: CustomerReport & { firstSeed: number };
  families: FamilyReport[];
}

export async function runSuite(options: {
  customers: number;
  walksPerFamily: number;
  families?: readonly string[];
  log?: (line: string) => void;
}): Promise<SuiteReport> {
  const log = options.log ?? (() => undefined);
  const firstSeed = 1;
  const customers = compareCustomers(firstSeed, options.customers);
  log(`customers: ${customers.exact}/${customers.seeds} identical`);
  const families: FamilyReport[] = [];
  for (const family of FAMILIES) {
    if (options.families && !options.families.includes(family.name)) continue;
    const seeds = Array.from({ length: options.walksPerFamily }, (_, i) => i + 1);
    const r = await runFamily(family, seeds);
    log(
      `${family.name}: ${r.fullyMatched}/${r.walks} walks identical, ${r.matched}/${r.steps} steps, ` +
        `${r.divergences.length} divergences, ${r.flows.reduce((a, f) => a + f.count, 0)} screen-flow ` +
        `differences, ${r.wordDiffs.reduce((a, f) => a + f.count, 0)} word differences`,
    );
    families.push(r);
  }
  return { customers: { ...customers, firstSeed }, families };
}
