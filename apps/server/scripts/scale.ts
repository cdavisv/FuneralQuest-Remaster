/**
 * Measures the server at the original's player cap (800 parlors).
 *
 *   pnpm --filter @fq/server exec tsx scripts/scale.ts [--parlors 800] [--ruleset classic|expanded]
 *       [--actions 400] [--online 40] [--burst] [--json]
 *
 * Builds a server in a temporary directory (a real SQLite file, fast password hashing), creates
 * the parlors through the town's own `enter`, then reports: the time to create a parlor at the
 * end, the time per action (median, 95th percentile, worst) through the whole stack the HTTP
 * route uses (account lookup, queue, engine step, JSON serialisation, SQLite transaction, audit
 * rows, pushes), how the commit splits into serialising and writing, the size of the persisted
 * town JSON, the size of the database file, how long a new day takes, and `GET /api/towns`.
 * Nothing is written outside the temporary directory, which is removed at the end.
 */
import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { testConfig } from "../src/config.js";
import { createServer } from "../src/server.js";

const args = process.argv.slice(2);
const option = (name: string, fallback: string): string => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? (args[i + 1] as string) : fallback;
};
const parlors = Number(option("parlors", "800"));
const ruleset = option("ruleset", "classic");
const actions = Number(option("actions", "400"));
const asJson = args.includes("--json");
// --burst: every parlor joins on day one (launch day), which mails every parlor already there.
const burst = args.includes("--burst");
// --online N: how many parlors are logged on while the actions are measured (default 5% of them).
// Everyone online at once is the worst case: every log-on is mailed to every parlor online.
const online = Number(option("online", String(Math.max(1, Math.round(parlors / 20)))));

const dir = mkdtempSync(join(tmpdir(), "fq-scale-"));
const townsFile = join(dir, "towns.json");
writeFileSync(
  townsFile,
  JSON.stringify({
    towns: [{ id: "big", name: "Big Town", ruleset, seed: 7, settings: { maxPlayers: 5000 } }],
  }),
);
const server = await createServer(
  testConfig({
    dbPath: join(dir, "fq.sqlite"),
    townsFile,
    createDefaultTown: false,
    rateGlobalMax: 1_000_000,
    rateActionMax: 1_000_000,
    rateAuthMax: 1_000_000,
  }),
);
const town = server.host.get("big");
if (!town) throw new Error("no town");

const stats = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const at = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))] as number;
  return {
    n: s.length,
    medianMs: +at(0.5).toFixed(2),
    p95Ms: +at(0.95).toFixed(2),
    maxMs: +(s.at(-1) ?? 0).toFixed(2),
  };
};

// -------------------------------------------------------------- 800 parlors
const players: { account: NonNullable<ReturnType<typeof server.accounts.getAccount>> }[] = [];
const enterTimes: number[] = [];
const t0 = performance.now();
for (let i = 0; i < parlors; i++) {
  if (!burst && i > 0 && i % Math.ceil(parlors / 8) === 0) await town.forceNewDay();
  const made = await server.accounts.signUp(`player${i}`, "correct horse battery", "10.1.0.1");
  const t = performance.now();
  const out = await town.enter(made.account, {
    name: `Player${i}`,
    parlor: `Parlor ${i} Rest`,
    male: i % 2 === 0,
  });
  enterTimes.push(performance.now() - t);
  if (out.kind !== "ok") throw new Error(`enter ${i}: ${JSON.stringify(out)}`);
  players.push({ account: made.account });
  // Most parlors are not logged on at any moment (the idle sweep logs them off after 15 minutes).
  if (i >= online) await town.leave(out.playerId, "quit", "scale");
}
// Steady state: by default parlors join over eight days; then a new day passes and everyone logs
// in again (with --burst they all joined on day one, the worst case for the state's size).
const burstJsonBytes = JSON.stringify(town.snapshotState).length;
await town.forceNewDay();
const reenter: number[] = [];
for (const p of players.slice(0, online)) {
  const t = performance.now();
  await town.enter(p.account);
  reenter.push(performance.now() - t);
}
const setupSeconds = (performance.now() - t0) / 1000;

// ------------------------------------------------------------ actions
let seed = 99;
const rand = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
const actionTimes: number[] = [];
const views = new Map<number, string[]>();
for (let i = 0; i < actions; i++) {
  const p = players[Math.floor(rand() * Math.min(online, players.length))];
  if (!p) continue;
  const cached = views.get(p.account.id);
  const view = await town.currentView(p.account);
  const ids = view.kind === "ok" ? view.view.buttons.map((b) => b.id) : (cached ?? []);
  const overlay = view.kind === "ok" ? view.view.overlay : undefined;
  const action =
    overlay?.kind === "message"
      ? ({ type: "dismiss", overlayId: overlay.id } as const)
      : ({
          type: "press",
          buttonId: ids.includes("desk:wait") ? "desk:wait" : (ids[0] ?? "go:desk"),
        } as const);
  const t = performance.now();
  await town.act(p.account, action);
  actionTimes.push(performance.now() - t);
}

// ----------------------------------------------------- the commit's parts
const json = JSON.stringify(town.snapshotState);
const reps = 20;
let ts = performance.now();
for (let i = 0; i < reps; i++) JSON.stringify(town.snapshotState);
const stringifyMs = (performance.now() - ts) / reps;
ts = performance.now();
for (let i = 0; i < reps; i++) {
  server.host.townStore.saveState("big", {
    stateJson: json,
    revision: town.revision,
    lastBoundary: 0,
    at: Date.now(),
  });
}
const writeMs = (performance.now() - ts) / reps;
ts = performance.now();
for (let i = 0; i < reps; i++) JSON.parse(json);
const parseMs = (performance.now() - ts) / reps;

// ------------------------------------------------------------- a new day
ts = performance.now();
await town.forceNewDay();
const newDayMs = performance.now() - ts;

// ------------------------------------------------------- the town listing
const listTimes: number[] = [];
for (let i = 0; i < 50; i++) {
  const t = performance.now();
  await server.app.inject({ method: "GET", url: "/api/towns" });
  listTimes.push(performance.now() - t);
}
const snapshotTs = performance.now();
await town.takeSnapshot("scale");
const snapshotMs = performance.now() - snapshotTs;

await server.close();
const dbBytes = statSync(join(dir, "fq.sqlite")).size;
rmSync(dir, { recursive: true, force: true });

const result = {
  parlors,
  online,
  ruleset,
  setupSeconds: +setupSeconds.toFixed(1),
  enterParlor: stats(enterTimes.slice(-50)),
  action: stats(actionTimes),
  commit: {
    stringifyMs: +stringifyMs.toFixed(2),
    sqliteWriteMs: +writeMs.toFixed(2),
    parseMs: +parseMs.toFixed(2),
  },
  afterJoinsJsonBytes: burstJsonBytes,
  reenter: stats(reenter),
  townJsonBytes: json.length,
  townJsonBytesPerParlor: Math.round(json.length / parlors),
  databaseFileBytes: dbBytes,
  newDayMs: +newDayMs.toFixed(1),
  snapshotMs: +snapshotMs.toFixed(1),
  townListing: stats(listTimes),
};
console.log(asJson ? JSON.stringify(result) : JSON.stringify(result, null, 2));
