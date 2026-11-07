import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ALL_PERSONALITY_IDS,
  BotRandom,
  DIFFICULTIES,
  type Difficulty,
  fairBrain,
  mix,
  PERSONALITY_IDS,
  type PersonalityId,
  type Policy,
  personality,
} from "@fq/bots";
import { classicPack, expandedPack } from "@fq/content";
import {
  AdminApi,
  type AdminApi as AdminApiType,
  type AdminPlayer,
  type BackupManifestLike,
} from "./admin.js";
import { Checks, diffJson } from "./checks.js";
import { auditActionCounts, type DbSize, dbSize, readTown, snapshotCounts } from "./dbread.js";
import { type PlayerSpec, SoakPlayer } from "./player.js";
import { freePort, ServerProcess } from "./serverProcess.js";
import { Transcript } from "./transcript.js";
import { Gate, type World } from "./world.js";

export interface SoakOptions {
  /** A name for the results directory. */
  name: string;
  rules: "classic" | "expanded";
  /** Tournament length in game days. */
  days: number;
  players: number;
  /** Real seconds per game day. */
  daySeconds: number;
  seed: number;
  /** Results root (a run directory is made inside). */
  out: string;
  /** Hard kills: 3 (mid-day quiet, mid-day with requests in flight, mid-maintenance) or 4 (also the final midnight). */
  kills: number;
  /** Back up during play and later restore into a fresh server. */
  restore: boolean;
  /** Sysop actions: settings, kick, ban and unban, broadcast, force a new day, snapshot and rollback. */
  admin: boolean;
  /** Most actions per bot per day. */
  stepCap: number;
  /** Fraction of the day players may use before they are told to stop. */
  playFraction: number;
  /** Real ms the server pauses inside each midnight (where the mid-maintenance kill lands). */
  maintenancePauseMs: number;
  /** Share of accounts that are guests. */
  guestShare: number;
  /** Play one day of the next season after the reset. */
  afterSeason: boolean;
}

/** One player's numbers in the report. */
interface PlayerRow {
  label: string;
  guest: boolean;
  personality: string;
  difficulty: string;
  name: string;
  stats: SoakPlayer["stats"];
}

export interface SoakReport {
  name: string;
  options: SoakOptions;
  dir: string;
  passed: boolean;
  realSeconds: number;
  gameDaysPlayed: number;
  seasonEnded: boolean;
  winner: string | null;
  totals: Record<string, number>;
  restarts: { kind: string; day: number; detail?: unknown }[];
  backups: { file: string; day: number; bytes: number; restored: boolean }[];
  adminActions: { what: string; day: number; ok: boolean; detail?: unknown }[];
  invariants: Record<string, { passed: number; failed: number }>;
  violations: { invariant: string; message: string; day: number | null }[];
  notes: Record<string, number>;
  serverLogProblems: unknown[];
  dbGrowth: ({ day: number } & DbSize)[];
  expandedFeatures?: Record<string, number>;
  /** Expanded: the town's life at each day's end (from the saved state). */
  expandedLife?: {
    day: number;
    bingoCardsSold: number;
    ordinance: boolean;
    ballot: boolean;
    candidates: number;
    electionHeld: boolean;
    mayor: number | null;
    chains: number;
    loans: number;
    savings: number;
  }[];
  players: PlayerRow[];
  transcript: string;
}

const ADMIN_TOKEN = `soak-${randomBytes(18).toString("hex")}`;
const TOWN = "soak";
const GAME_START = Date.UTC(2030, 0, 1, 0, 0, 0);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Days events happen on, from the season length (see README "What a run does"). */
export function schedule(days: number, o: Pick<SoakOptions, "kills" | "restore" | "admin">) {
  const at = (f: number, min = 1) => Math.min(days, Math.max(min, Math.floor(days * f)));
  const backupDay = at(0.3);
  return {
    killQuiet: at(0.2),
    killInFlight: at(0.5, Math.min(2, days)),
    killMaintenance: at(0.35),
    killReset: o.kills >= 4,
    backup: o.restore ? backupDay : null,
    restore: o.restore ? Math.min(days, backupDay + Math.max(1, Math.floor(days * 0.15))) : null,
    adminMidPlay: o.admin ? at(0.4) : null,
    settings: o.admin ? at(0.25) : null,
    rollback: o.admin ? at(0.6) : null,
    forceNewDay: o.admin && days >= 5 ? at(0.7, 2) : null,
  };
}

export async function runSoak(o: SoakOptions): Promise<SoakReport> {
  const startedReal = Date.now();
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
  const dir = join(o.out, `${o.name}-${stamp}`);
  mkdirSync(dir, { recursive: true });
  const speed = 86_400 / o.daySeconds;
  const anchor = Date.now() + 300;
  const gameNow = () => Math.floor(GAME_START + (Date.now() - anchor) * speed);
  const realUntil = (game: number) => anchor + (game - GAME_START) / speed;
  const transcriptPath = join(dir, "transcript.jsonl.gz");
  const transcript = new Transcript(transcriptPath, gameNow);
  const checks = new Checks(transcript);
  const gate = new Gate();
  const port = await freePort();
  let dataDir = join(dir, "data");
  const env: Record<string, string> = {
    FQ_DB_PATH: join(dataDir, "fq.sqlite"),
    FQ_ADMIN_TOKEN: ADMIN_TOKEN,
    FQ_CREATE_DEFAULT_TOWN: "false",
    FQ_HOST: "127.0.0.1",
    FQ_LOG_LEVEL: "info",
    FQ_TEST_CLOCK_SPEED: String(speed),
    FQ_TEST_CLOCK_START: new Date(GAME_START).toISOString(),
    FQ_TEST_CLOCK_ANCHOR: String(anchor),
    FQ_TEST_MAINTENANCE_DELAY_MS: String(o.maintenancePauseMs),
    // Idle players are logged off a quarter of a game day after their last action, so players
    // who leave without logging off are swept within the day; a quiet pause never trips it.
    FQ_IDLE_TIMEOUT_MINUTES: "360",
    FQ_IDLE_SWEEP_SECONDS: "600",
    // Everything comes from one address, and a bot plays a game day in seconds.
    FQ_RATE_GLOBAL_MAX: "1000000",
    FQ_RATE_AUTH_MAX: "100000",
    FQ_RATE_ACTION_MAX: "1000000",
    FQ_RATE_ADMIN_MAX: "100000",
    FQ_WS_PER_ADDRESS: "10000",
    FQ_BACKUP_KEEP: "20",
  };
  const server = new ServerProcess(port, env, transcript);
  const admin: AdminApiType = new AdminApi(server.baseUrl, ADMIN_TOKEN, transcript);
  let currentDay = 1;
  const world: World = {
    transcript,
    checks,
    gate,
    secrets: new Map(),
    announcements: [],
    baseUrl: () => server.baseUrl,
    wsUrl: () => server.wsUrl,
    townId: TOWN,
    gameNow,
    day: () => currentDay,
    expectedOut: new Map(),
  };
  const restarts: SoakReport["restarts"] = [];
  const backups: SoakReport["backups"] = [];
  const adminActions: SoakReport["adminActions"] = [];
  const dbGrowth: SoakReport["dbGrowth"] = [];
  const expandedLife: NonNullable<SoakReport["expandedLife"]> = [];
  const plan = schedule(o.days, o);
  type EventKey =
    | "backup"
    | "killQuiet"
    | "adminMidPlay"
    | "killInFlight"
    | "settings"
    | "rollback"
    | "restore"
    | "killMaintenance";
  const doneEvents = new Set<EventKey>();
  const startedGame = GAME_START;
  transcript.write({ kind: "event", what: "start", data: { options: o, plan, speed, port } });
  const log = (text: string) => {
    const g = new Date(gameNow()).toISOString().slice(5, 16).replace("T", " ");
    console.log(
      `[${((Date.now() - startedReal) / 1000).toFixed(0).padStart(4)}s ${g} day ${currentDay}] ${text}`,
    );
  };

  // ------------------------------------------------------------- the town
  await server.start();
  const ruleset = o.rules;
  await admin.createTown({
    id: TOWN,
    name: o.rules === "classic" ? "Soak Classic" : "Soak Expanded",
    ruleset,
    timeZone: "UTC",
    seed: o.seed,
    settings: { tournamentActive: true, tournamentDays: o.days },
    serverNews: "Soak test town.",
  });
  adminActions.push({ what: "create town", day: 1, ok: true });
  log(
    `town created (${ruleset}, ${o.days}-day tournament, ${o.players} players, ${o.daySeconds} s per day)`,
  );

  // ------------------------------------------------------------- players
  const content = o.rules === "expanded" ? expandedPack : classicPack;
  const dice = new BotRandom(mix(o.seed, 0x50ac));
  const pool = dice.shuffle(
    o.rules === "expanded" ? [...ALL_PERSONALITY_IDS] : [...PERSONALITY_IDS],
  );
  const usedNames = new Set<string>();
  const players: SoakPlayer[] = [];
  const policies = new Map<string, Policy>();
  for (let i = 0; i < o.players; i++) {
    const pid = pool[i % pool.length] as PersonalityId;
    const names = personality(pid).names;
    let form = names.find((n) => !usedNames.has(n.name)) ?? names[0];
    if (!form || usedNames.has(form.name)) {
      const base = names[0] ?? { name: "Rival", parlor: "Rival Rest", male: true };
      form = {
        ...base,
        name: `${base.name.slice(0, 14)} ${i + 1}`,
        parlor: `${base.parlor.slice(0, 14)} ${i + 1}`,
      };
    }
    usedNames.add(form.name);
    const spec: PlayerSpec = {
      index: i,
      label: `p${String(i + 1).padStart(2, "0")}`,
      guest: i % Math.max(1, Math.round(1 / Math.max(0.01, o.guestShare))) === 1,
      personality: pid,
      difficulty: dice.pick(DIFFICULTIES) as Difficulty,
      form,
    };
    const brain = fairBrain(content);
    if (brain.kind !== "fair") throw new Error("fair brain expected");
    policies.set(spec.label, brain.decide);
    players.push(new SoakPlayer(spec, world, brain.decide, o.seed));
  }
  for (let i = 0; i < players.length; i += 4) {
    await Promise.all(players.slice(i, i + 4).map((p) => p.signUp()));
  }
  log(`${players.length} accounts (${players.filter((p) => p.spec.guest).length} guests)`);

  // ---------------------------------------------------------- helpers
  const townInfo = () => admin.town(TOWN);

  /** Admin records of every soak player, by label. */
  const records = async (): Promise<Map<string, AdminPlayer>> => {
    const out = new Map<string, AdminPlayer>();
    for (const p of players) {
      if (p.playerId === null) continue;
      out.set(p.label, await admin.player(TOWN, p.playerId));
    }
    return out;
  };

  /** Quiet: no new requests, none in flight. */
  const quiesce = async (why: string) => {
    gate.close(why);
    await gate.drained();
  };

  /** Fields that may differ for the same saved state: connection state only. */
  const VOLATILE = new Set(["online"]);

  interface Capture {
    town: { day: number; revision: number; season: number | null };
    records: Map<string, AdminPlayer>;
    views: Map<string, unknown>;
  }

  const capture = async (): Promise<Capture> => {
    const t = await townInfo();
    const views = new Map<string, unknown>();
    for (const p of players) {
      if (p.playerId === null) continue;
      try {
        views.set(p.label, await p.api.currentView(TOWN));
      } catch {
        views.set(p.label, null);
      }
    }
    return {
      town: { day: t.day, revision: t.revision, season: t.season },
      records: await records(),
      views,
    };
  };

  const compareCaptures = (
    what: string,
    before: Capture,
    after: Capture,
    opts: { sameRevision: boolean },
  ) => {
    checks.ok(
      "restart-same-day",
      after.town.day === before.town.day,
      `${what}: day ${before.town.day} became ${after.town.day}`,
    );
    if (opts.sameRevision) {
      checks.ok(
        "restart-same-revision",
        after.town.revision === before.town.revision,
        `${what}: revision ${before.town.revision} became ${after.town.revision}`,
      );
    }
    for (const [label, rec] of before.records) {
      const next = after.records.get(label);
      const diffs = diffJson(rec, next, VOLATILE);
      checks.ok(
        "restart-player-record",
        diffs.length === 0,
        `${what}: ${label}'s record changed`,
        diffs,
      );
      const v0 = before.views.get(label);
      const v1 = after.views.get(label);
      const vd = diffJson(v0, v1, new Set(["at"]));
      checks.ok("restart-player-view", vd.length === 0, `${what}: ${label}'s View changed`, vd);
    }
  };

  const restart = async (kind: string, detail?: unknown) => {
    await server.start();
    restarts.push({ kind, day: currentDay, ...(detail !== undefined ? { detail } : {}) });
    transcript.write({ kind: "event", what: `restarted:${kind}`, data: detail });
  };

  /** The `action` audit rows per account, compared with the answers the players got. */
  const reconcileAudit = (what: string) => {
    const counts = auditActionCounts(server.dbPath, TOWN);
    for (const p of players) {
      if (p.accountId === null) continue;
      const n = counts.get(p.accountId) ?? 0;
      const lo = p.acceptedActions;
      const hi = p.acceptedActions + p.unknown;
      checks.ok(
        "audit-matches-answers",
        n >= lo && n <= hi,
        `${what}: ${p.label} got ${lo} accepted answers (+${p.unknown} unanswered) but the audit log has ${n}`,
      );
      // What the server did is now known.
      p.acceptedActions = n;
      p.unknown = 0;
    }
  };

  let lastAuditAt = 0;
  const checkpoint = async (what: string) => {
    const t = await townInfo();
    const recs = await records();
    reconcileAudit(what);
    // Changes to other players since a player's last View are explained by actions of others,
    // midnight, or the sysop; find the game time of the newest such cause.
    const auditRows = await admin.audit({ townId: TOWN, kind: "" });
    const newestCause = new Map<string, number>();
    const lastAnyCause = auditRows
      .filter(
        (r) =>
          r.at >= lastAuditAt &&
          (r.kind === "action" ||
            r.kind === "maintenance" ||
            r.kind.startsWith("admin") ||
            r.kind.startsWith("town:") ||
            r.kind.startsWith("leave")),
      )
      .map((r) => ({ at: r.at, account: r.account_id, kind: r.kind }));
    lastAuditAt = auditRows.at(-1)?.at ?? lastAuditAt;
    for (const p of players) {
      const rec = recs.get(p.label);
      if (!rec) continue;
      const neg: string[] = [];
      for (const k of ["bp", "bpToday", "turns", "hp", "hpMax", "luck"] as const) {
        if (typeof rec[k] === "number" && (rec[k] as number) < 0) neg.push(`${k} ${rec[k]}`);
      }
      if (rec.tags.some((x) => x < 0)) neg.push(`tags ${rec.tags.join("/")}`);
      checks.ok(
        "non-negative",
        neg.length === 0,
        `${what}: ${p.label}'s record has ${neg.join(", ")}`,
      );
      checks.ok("player-active", rec.active, `${what}: ${p.label}'s parlor is not active`);
      checks.ok(
        "account-link",
        rec.accountId === p.accountId,
        `${what}: ${p.label}'s parlor belongs to account ${rec.accountId}, not ${p.accountId}`,
      );
      const seen = p.lastHud;
      if (seen) {
        const h = seen.facts;
        const same =
          h.bp === rec.bp &&
          h.bpToday === rec.bpToday &&
          h.turns === rec.turns &&
          h.tags.every((x, i) => x === rec.tags[i]);
        if (!same) {
          const cause = lastAnyCause.find(
            (c) => c.at >= seen.at - 5 && (c.account !== p.accountId || c.kind !== "action"),
          );
          newestCause.set(p.label, cause?.at ?? -1);
          checks.ok(
            "no-unexplained-change",
            cause !== undefined,
            `${what}: ${p.label}'s record differs from the last View with nothing in the audit log to explain it`,
            {
              view: h,
              record: { bp: rec.bp, bpToday: rec.bpToday, turns: rec.turns, tags: rec.tags },
            },
          );
        } else {
          checks.ok("no-unexplained-change", true, "");
        }
      }
    }
    // Rankings (public) agree with the records.
    const sorted = [...recs.values()]
      .filter((r) => r.active)
      .sort((a, b) => b.bp - a.bp || a.id - b.id);
    const pub = (await (await fetch(`${server.baseUrl}/api/towns/${TOWN}`)).json()) as {
      rankings: { name: string; bp: number }[];
    };
    const others = (await admin.players(TOWN)).filter((r) => r.active);
    const allSorted = others.sort((a, b) => b.bp - a.bp || a.id - b.id).slice(0, 10);
    const rk = diffJson(
      pub.rankings.map((r) => [r.name, r.bp]),
      allSorted.map((r) => [r.name, r.bp]),
    );
    checks.ok(
      "rankings-agree",
      rk.length === 0,
      `${what}: public rankings differ from the player records`,
      rk,
    );
    void sorted;
    // The paper holds every announcement typed today.
    const state = readTown(server.dbPath, TOWN);
    if (state) {
      const paper = JSON.stringify(state.state.news);
      for (const a of world.announcements.filter((x) => x.day === t.day)) {
        const words = a.text.slice(0, 40);
        checks.ok(
          "paper-has-announcements",
          paper.includes(words),
          `${what}: ${a.player}'s announcement is not in the paper`,
          a,
        );
      }
    }
    // Expanded: what the town's life did (Bingo, ballots, the election, chains), from the state.
    const life = (
      state?.state as unknown as { expanded?: { life?: Record<string, unknown> } } | undefined
    )?.expanded?.life;
    if (life) {
      const election = life.election as
        | { candidates?: unknown[]; held?: boolean; mayor?: number | null }
        | undefined;
      const bingo = life.bingo as { cards?: number[]; paid?: number } | undefined;
      expandedLife.push({
        day: t.day,
        bingoCardsSold: (bingo?.cards ?? []).filter((c) => c >= 0).length,
        ordinance: life.ordinance !== null && life.ordinance !== undefined,
        ballot: life.ballot !== null && life.ballot !== undefined,
        candidates: election?.candidates?.length ?? 0,
        electionHeld: election?.held === true,
        mayor: election?.mayor ?? null,
        chains: Array.isArray(life.chains) ? life.chains.length : 0,
        loans: players.filter((p) => p.hadLoan).length,
        savings: players.filter((p) => p.hadSavings).length,
      });
    }
    // The server log.
    const problems = server.problems.splice(0);
    for (const pr of problems) {
      checks.fail(
        "server-log",
        `${what}: server logged a ${typeof pr.line === "string" ? "stderr line" : `level ${pr.line.level} line`}`,
        pr.line,
      );
    }
    // Size.
    const size = dbSize(server.dbPath);
    dbGrowth.push({ day: t.day, ...size });
    const snaps = snapshotCounts(server.dbPath).get(TOWN) ?? 0;
    checks.ok(
      "snapshots-bounded",
      snaps <= 48,
      `${what}: ${snaps} snapshots kept (FQ_SNAPSHOT_KEEP is 48)`,
    );
    checks.ok(
      "wal-bounded",
      size.walBytes <= Math.max(64 * 1024 * 1024, size.dbBytes * 4),
      `${what}: write-ahead log is ${size.walBytes} bytes`,
    );
    return { town: t, records: recs };
  };

  // ------------------------------------------------------------ playing
  const leaveIdle = (p: SoakPlayer, day: number) => (p.spec.index + day) % 4 === 3;
  let dayActions = 0;
  let expectedDayActions = o.players * 80;

  /** Everyone plays the day concurrently; `events` run when the day's actions reach their share. */
  const playDay = async (
    day: number,
    events: { at: number; name: string; run: () => Promise<void> }[],
  ) => {
    const t = await townInfo();
    const midnight = Date.parse(t.nextDayAt);
    const deadline = realUntil(
      GAME_START + (midnight - GAME_START) - (1 - o.playFraction) * 86_400_000,
    );
    const before = players.reduce((n, p) => n + p.stats.actions, 0);
    const pending = [...events].sort((a, b) => a.at - b.at);
    let running: Promise<void> = Promise.resolve();
    let done = false;
    const watcher = (async () => {
      while (!done || pending.length > 0) {
        const now = players.reduce((n, p) => n + p.stats.actions, 0) - before;
        const next = pending[0];
        if (!next) break;
        if (done || now >= next.at * expectedDayActions) {
          pending.shift();
          log(`event: ${next.name}`);
          running = running.then(next.run);
          await running;
          continue;
        }
        await sleep(25);
      }
    })();
    await Promise.all(
      players.map((p) =>
        p
          .playDay({ day, deadline, stepCap: o.stepCap, leaveIdle: leaveIdle(p, day) })
          .catch((error: unknown) => {
            checks.fail(
              "player-crashed",
              `${p.label}: ${error instanceof Error ? error.stack : String(error)}`,
            );
          }),
      ),
    );
    done = true;
    await watcher;
    await running;
    dayActions = players.reduce((n, p) => n + p.stats.actions, 0) - before;
    expectedDayActions = Math.max(o.players * 20, dayActions);
    log(`played: ${dayActions} actions`);
  };

  // ------------------------------------------------------------ events
  const killQuiet = async () => {
    await quiesce("kill-quiet");
    const before = await capture();
    await server.kill();
    log("SIGKILL (quiet, mid-day)");
    await restart("mid-day, no request in flight");
    const after = await capture();
    compareCaptures("restart mid-day", before, after, { sameRevision: true });
    reconcileAudit("after quiet kill");
    gate.release("kill-quiet");
  };

  const killInFlight = async () => {
    const inFlight = gate.inFlight;
    gate.close("kill-in-flight");
    await server.kill();
    log(`SIGKILL (mid-day, ${inFlight} requests in flight)`);
    const unknownBefore = players.reduce((n, p) => n + p.stats.unknownOutcome, 0);
    await gate.drained();
    const lost = players.reduce((n, p) => n + p.stats.unknownOutcome, 0) - unknownBefore;
    await restart("mid-day, requests in flight", { inFlight, unanswered: lost });
    // Every unanswered action either happened or did not; the audit log says which.
    reconcileAudit("after in-flight kill");
    checks.ok(
      "in-flight-kill-hit",
      inFlight > 0 || lost > 0,
      "no request was in flight when the server was killed",
    );
    gate.release("kill-in-flight");
  };

  const settingsState: { changed: { turnsPerDay: number; fromDay: number } | null } = {
    changed: null,
  };
  const changeSettings = async () => {
    const s = (await admin.settings(TOWN)).settings;
    const turns = Number(s.turnsPerDay) + 3;
    const r = await admin.patchSettings(TOWN, {
      turnsPerDay: turns,
      maxPlayers: Number(s.maxPlayers) + 1,
    });
    const ok = r.settings.turnsPerDay === turns;
    checks.ok("admin-settings", ok, "the settings change did not apply");
    settingsState.changed = { turnsPerDay: turns, fromDay: currentDay + 1 };
    adminActions.push({
      what: `settings: turnsPerDay ${turns - 3} -> ${turns}`,
      day: currentDay,
      ok,
    });
  };

  const adminMidPlay = async () => {
    // Broadcast to everyone connected.
    const text = `Soak broadcast ${randomBytes(3).toString("hex")}`;
    const open = players.filter((p) => p.socketOpen);
    const r = await admin.broadcast(TOWN, text);
    await sleep(300);
    const got = open.filter((p) =>
      p.notices.some((n) => n.kind === "server" && JSON.stringify(n.data).includes(text)),
    );
    const ok = got.length === open.length && r.delivered >= open.length;
    checks.ok(
      "admin-broadcast",
      ok,
      `broadcast reached ${got.length} of ${open.length} open sockets (server says ${r.delivered})`,
    );
    adminActions.push({
      what: "broadcast",
      day: currentDay,
      ok,
      detail: { delivered: r.delivered, sockets: open.length },
    });

    // Kick someone who is playing.
    const target = players.find((p) => p.inSession && p.playerId !== null) ?? players[0];
    if (target?.playerId != null) {
      world.expectedOut.set(target.label, "kick");
      await admin.kick(TOWN, target.playerId);
      await sleep(200);
      const rec = await admin.player(TOWN, target.playerId);
      const kicked = !rec.online;
      checks.ok("admin-kick", kicked, `${target.label} is still online after a kick`);
      adminActions.push({ what: `kick ${target.label}`, day: currentDay, ok: kicked });
      world.expectedOut.delete(target.label);
    }

    // Ban and unban a registered player; they log in again.
    const banned = players.find((p) => !p.spec.guest && p.accountId !== null && p !== target);
    if (banned?.accountId != null) {
      world.expectedOut.set(banned.label, "ban");
      await admin.ban(banned.accountId, "soak test ban");
      let refused = false;
      try {
        await banned.api.me();
      } catch {
        refused = true;
      }
      let loginRefused = false;
      try {
        await banned.api.logIn(banned.login, banned.password);
      } catch {
        loginRefused = true;
      }
      await admin.unban(banned.accountId);
      await banned.logIn();
      world.expectedOut.delete(banned.label);
      const ok = refused && loginRefused;
      checks.ok("admin-ban", ok, `ban: token refused ${refused}, log-in refused ${loginRefused}`);
      adminActions.push({ what: `ban and unban ${banned.label}`, day: currentDay, ok });
    }

    // A guest becomes a full account mid-season.
    const guest = players.find((p) => p.spec.guest && p.accountId !== null);
    if (guest) {
      const login = `skup${guest.label}${randomBytes(2).toString("hex")}`;
      const r2 = await guest.api.upgrade(login, guest.password);
      (guest as unknown as { login: string }).login = login;
      guest.spec.guest = false;
      world.secrets.set(login, {
        owner: guest.label,
        kind: "login",
        maxOthers: 0,
        seenBy: new Set(),
      });
      const ok = r2.account.guest === false;
      checks.ok("guest-upgrade", ok, `${guest.label} could not be upgraded`);
      adminActions.push({ what: `guest ${guest.label} upgraded to ${login}`, day: currentDay, ok });
    }
  };

  let backupMade: {
    manifest: BackupManifestLike;
    path: string;
    window: Map<string, { lo: number; hi: number; huds: string[] }>;
    day: number;
    takenAt: number;
  } | null = null;

  const backupDuringPlay = async () => {
    const sentAt = Date.now();
    const lo = new Map(players.map((p) => [p.label, p.acceptedActions]));
    const inflight = gate.inFlight;
    const manifest = await admin.backup(`day${currentDay}`);
    const doneAt = Date.now();
    const path = join(dataDir, "backups", manifest.file);
    const window = new Map<string, { lo: number; hi: number; huds: string[] }>();
    for (const p of players) {
      const huds = p.hudLog
        .filter((h) => h.real >= sentAt - 2000 && h.real <= doneAt + 2000)
        .map((h) => JSON.stringify(h.facts));
      const lastBefore = [...p.hudLog].reverse().find((h) => h.real < sentAt);
      if (lastBefore) huds.push(JSON.stringify(lastBefore.facts));
      window.set(p.label, { lo: lo.get(p.label) ?? 0, hi: p.acceptedActions + inflight, huds });
    }
    backupMade = { manifest, path, window, day: currentDay, takenAt: sentAt };
    backups.push({ file: manifest.file, day: currentDay, bytes: manifest.bytes, restored: false });
    log(`backup ${manifest.file} (${manifest.bytes} bytes, ${inflight} requests in flight)`);
    // Check the file now: the server's own check, its hash, and its contents against the play.
    const check = await server.command(["check", path]);
    checks.ok(
      "backup-check",
      check.code === 0,
      `backup check failed: ${check.stdout}${check.stderr}`,
    );
    const sha = createHash("sha256").update(readFileSync(path)).digest("hex");
    checks.ok("backup-hash", sha === manifest.sha256, "backup file hash differs from its manifest");
    const inFile = readTown(path, TOWN);
    const mTown = manifest.towns.find((x) => x.id === TOWN);
    checks.ok(
      "backup-consistent",
      !!inFile && !!mTown && inFile.revision === mTown.revision && inFile.state.day === mTown.day,
      "backup's town revision or day differs from its manifest",
    );
    const counts = auditActionCounts(path, TOWN);
    for (const p of players) {
      const w = window.get(p.label);
      if (!w || p.accountId === null) continue;
      const n = counts.get(p.accountId) ?? 0;
      checks.ok(
        "backup-matches-play",
        n >= w.lo && n <= w.hi,
        `backup holds ${n} actions of ${p.label}; play had ${w.lo} to ${w.hi}`,
      );
      const rec = inFile?.state.players.find((x) => x.id === p.playerId);
      if (rec && w.huds.length > 0) {
        const f = { bp: rec.bp, bpToday: rec.bpToday, turns: rec.turns };
        const match = w.huds.some((h) => {
          const x = JSON.parse(h) as { bp: number; bpToday: number; turns: number };
          return x.bp === f.bp && x.bpToday === f.bpToday && x.turns === f.turns;
        });
        checks.ok(
          "backup-matches-play",
          match || !p.inSession,
          `backup's ${p.label} (${JSON.stringify(f)}) matches no View shown around the backup`,
        );
      }
    }
  };

  const restoreDisaster = async () => {
    if (!backupMade) return;
    const b = backupMade;
    await quiesce("restore");
    const live = await townInfo();
    await server.kill();
    log(`disaster: server killed; restoring ${b.manifest.file} into a fresh data directory`);
    for (const p of players) p.closeSocket();
    const fresh = join(dir, `data-restored-day${currentDay}`);
    const freshDb = join(fresh, "fq.sqlite");
    const r = await server.command(["restore", b.path], { FQ_DB_PATH: freshDb });
    checks.ok("restore-command", r.code === 0, `restore failed: ${r.stdout}${r.stderr}`);
    const sha = createHash("sha256").update(readFileSync(freshDb)).digest("hex");
    checks.ok(
      "restore-identical",
      sha === b.manifest.sha256,
      "restored file differs from the backup",
    );
    // A restore into a directory that already has a database keeps the old files aside.
    dataDir = fresh;
    server.setEnv({ FQ_DB_PATH: freshDb });
    await restart("fresh install from backup", { backup: b.manifest.file, backupDay: b.day });
    const t = await townInfo();
    checks.ok(
      "restore-catches-up",
      t.day === live.day,
      `restored town is on day ${t.day}; the live town was on day ${live.day} (the missed midnights should run at start)`,
    );
    // A settings change made after the backup is undone by the restore, as everything else is.
    const restoredTurns = Number((await admin.settings(TOWN)).settings.turnsPerDay);
    if (settingsState.changed && restoredTurns !== settingsState.changed.turnsPerDay) {
      checks.note("settings-change-undone-by-restore", { turnsPerDay: restoredTurns });
      settingsState.changed = null;
    }
    // The audit log in the restore is the truth now: actions after the backup are gone.
    const counts = auditActionCounts(freshDb, TOWN);
    for (const p of players) {
      if (p.accountId === null) continue;
      p.acceptedActions = counts.get(p.accountId) ?? 0;
      p.unknown = 0;
      p.lastHud = null;
      p.inSession = false;
    }
    // Accounts and tokens came with the backup: a token issued before it works; one issued
    // after it (a log-in again after the ban) does not, and that player logs in again.
    for (const p of players) {
      const valid = p.tokenIssuedAt <= b.takenAt;
      try {
        await p.refreshAccount();
        checks.ok(
          "restore-sessions",
          valid,
          `${p.label}'s token from after the backup still works`,
        );
      } catch (error) {
        checks.ok(
          "restore-sessions",
          !valid,
          `${p.label}'s token from before the backup does not work after the restore: ${String(error)}`,
        );
        if (!p.spec.guest) {
          await p.logIn();
          await p.refreshAccount();
        }
      }
    }
    const b2 = backups.find((x) => x.file === b.manifest.file);
    if (b2) b2.restored = true;
    gate.release("restore");
  };

  let rollbackDone = false;
  const snapshotRollback = async () => {
    await quiesce("rollback");
    const before = await capture();
    const snap = await admin.snapshot(TOWN, "soak");
    gate.release("rollback");
    // One player plays on a little, then the sysop rolls back.
    const p = players.find((x) => !x.spec.guest) ?? players[0];
    if (p) {
      const v = await p.enter();
      let view = v;
      for (let i = 0; i < 6; i++) {
        const out = await p.act(view, {
          type: "press",
          buttonId: view.buttons[0]?.id ?? "go:desk",
        });
        if (out.kind === "ok" || out.kind === "rejected") view = out.view;
      }
    }
    await quiesce("rollback");
    for (const x of players) world.expectedOut.set(x.label, "rollback");
    await admin.rollback(TOWN, snap.id);
    await sleep(200);
    const after = await capture();
    const t = await townInfo();
    checks.ok(
      "rollback-day",
      t.day === before.town.day,
      `rollback day ${t.day} != ${before.town.day}`,
    );
    let same = true;
    for (const [label, rec] of before.records) {
      const d = diffJson(rec, after.records.get(label), new Set(["online"]));
      if (d.length > 0) same = false;
      checks.ok(
        "rollback-restores-players",
        d.length === 0,
        `${label} differs from the snapshot after rollback`,
        d,
      );
    }
    for (const x of players) {
      world.expectedOut.delete(x.label);
      x.inSession = false;
      x.lastHud = null;
    }
    reconcileAudit("after rollback");
    rollbackDone = true;
    adminActions.push({ what: `snapshot ${snap.id} and rollback`, day: currentDay, ok: same });
    gate.release("rollback");
  };

  // ----------------------------------------------------------- midnights
  /** Waits for the next midnight; with `kill`, kills the server inside it and restarts. */
  const passMidnight = async (kill: "maintenance" | "reset" | null) => {
    const t0 = await townInfo();
    const nightStartGame = gameNow();
    const target = Date.parse(t0.nextDayAt);
    let killed = false;
    let stop: (() => void) | null = null;
    if (kill) {
      stop = server.watch((line) => {
        if (killed || !/maintenance paused before saving/.test(line.msg ?? "")) return;
        killed = true;
        void server.kill();
      });
    }
    const waitMs = realUntil(target) - Date.now();
    if (waitMs > 0) await sleep(waitMs);
    for (let i = 0; i < 600; i++) {
      if (kill && killed) break;
      try {
        const t = await townInfo();
        if (t.day !== t0.day || t.season !== t0.season) break;
      } catch {
        // killed just now
      }
      await sleep(50);
    }
    stop?.();
    if (kill && killed) {
      await sleep(100);
      log(`SIGKILL inside midnight maintenance (${kill})`);
      const dbBefore = readTown(server.dbPath, TOWN);
      checks.ok(
        "kill-mid-maintenance-saved-nothing",
        dbBefore?.state.day === t0.day,
        `the killed maintenance left day ${dbBefore?.state.day} in the database (was ${t0.day})`,
      );
      await restart(
        kill === "reset"
          ? "inside the final midnight (tournament reset)"
          : "inside midnight maintenance",
      );
    }
    const t1 = await townInfo();
    // Exactly one maintenance was saved for this midnight, killed or not.
    const rows = (await admin.audit({ townId: TOWN, kind: "maintenance" })).filter(
      (r) => r.at >= startedGame,
    );
    const saved = rows.filter((r) => {
      const d = (typeof r.data === "string" ? JSON.parse(r.data) : r.data) as {
        day?: number;
        source?: string;
      };
      return d.source === "schedule" && r.at > nightStartGame;
    });
    checks.ok(
      "maintenance-once",
      saved.length === 1,
      `${saved.length} maintenance rows saved for the midnight after day ${t0.day}${killed ? " (killed inside it)" : ""}`,
      saved.map((r) => r.data),
    );
    return { before: t0, after: t1, killed };
  };

  // ------------------------------------------------------------- the season
  let seasonEnded = false;
  let winner: string | null = null;
  let gameDaysPlayed = 0;
  const startSeason = (await townInfo()).season;
  let deedsBefore: string[] = [];
  let lastCheckpoint: Awaited<ReturnType<typeof checkpoint>> | null = null;

  for (let guard = 0; guard < o.days + 5; guard++) {
    const t = await townInfo();
    currentDay = t.day;
    checks.day = currentDay;
    if (plan.forceNewDay === currentDay && o.admin) {
      plan.forceNewDay = null;
      const r = await admin.newDay(TOWN);
      const t2 = await townInfo();
      const ok = r.daysRun === 1 && t2.day === t.day + 1;
      checks.ok(
        "admin-new-day",
        ok,
        `forced new day ran ${r.daysRun} day(s): ${t.day} -> ${t2.day}`,
      );
      adminActions.push({ what: "force a new day", day: currentDay, ok });
      log(`sysop forced a new day: ${t.day} -> ${t2.day}`);
      currentDay = t2.day;
      checks.day = currentDay;
    }
    // An event runs on its planned day, or on the first day after it that is played (a forced new
    // day skips one).
    const done = doneEvents;
    const due = (key: EventKey) => {
      const day = plan[key];
      if (typeof day !== "number" || day > currentDay || done.has(key)) return false;
      done.add(key);
      return true;
    };
    const events: { at: number; name: string; run: () => Promise<void> }[] = [];
    if (due("backup")) events.push({ at: 0.25, name: "backup during play", run: backupDuringPlay });
    if (due("killQuiet")) events.push({ at: 0.4, name: "kill (quiet)", run: killQuiet });
    if (due("adminMidPlay"))
      events.push({ at: 0.55, name: "sysop: broadcast, kick, ban, upgrade", run: adminMidPlay });
    if (due("killInFlight"))
      events.push({ at: 0.6, name: "kill (requests in flight)", run: killInFlight });
    await playDay(currentDay, events);
    gameDaysPlayed++;
    // Players that left idle are logged off by the sweep within a quarter of a day.
    lastCheckpoint = await checkpoint(`end of day ${currentDay}`);
    const settingsChanged = settingsState.changed;
    if (
      o.rules === "classic" &&
      settingsChanged &&
      currentDay >= settingsChanged.fromDay &&
      currentDay <= o.days
    ) {
      for (const p of players) {
        const f = p.firstHud.get(currentDay);
        if (!f) continue;
        checks.ok(
          "settings-applied",
          f.turns >= settingsChanged.turnsPerDay,
          `${p.label} started day ${currentDay} with ${f.turns} turns; turnsPerDay is ${settingsChanged.turnsPerDay}`,
        );
      }
    }
    if (due("settings")) await changeSettings();
    if (due("rollback") && !rollbackDone) await snapshotRollback();
    if (backupMade && due("restore")) await restoreDisaster();
    // The original's calendar (maint.cpp:99-113): days 1..N are played, the midnight after day N
    // names the winner in the paper and the Book of Deeds, day N+1 is the closing day (no turns),
    // and the midnight after it resets the town.
    const finalDay = currentDay >= o.days + 1;
    if (currentDay === o.days) {
      deedsBefore = readTown(server.dbPath, TOWN)?.state.deeds ?? [];
    }
    const killKind =
      finalDay && plan.killReset
        ? "reset"
        : !finalDay && due("killMaintenance")
          ? "maintenance"
          : null;
    const night = await passMidnight(killKind);
    if (night.after.season !== night.before.season || night.after.day < night.before.day) {
      seasonEnded = true;
      currentDay = night.after.day;
      break;
    }
    checks.ok(
      "one-day-per-midnight",
      night.after.day === night.before.day + 1,
      `midnight took day ${night.before.day} to ${night.after.day}`,
    );
  }

  // ------------------------------------------------------------ season end
  if (seasonEnded) {
    const t = await townInfo();
    checks.day = t.day;
    log(`season over: day ${t.day}, season ${t.season}`);
    checks.ok("reset-day-1", t.day === 1, `after the reset the town is on day ${t.day}`);
    checks.ok(
      "reset-no-players",
      t.players.registered === 0,
      `${t.players.registered} parlors survived the reset`,
    );
    checks.ok(
      "reset-next-season",
      t.season === (startSeason ?? 0) + 1,
      `season ${startSeason} became ${t.season}`,
    );
    const hall = (await (
      await fetch(`${server.baseUrl}/api/hall-of-fame?townId=${TOWN}`)
    ).json()) as {
      entries: {
        season: number;
        winner: { name: string } | null;
        standings: { name: string; bp: number }[];
        days: number;
      }[];
    };
    checks.ok(
      "hall-of-fame-one-entry",
      hall.entries.length === 1,
      `${hall.entries.length} hall-of-fame entries for one season`,
    );
    const entry = hall.entries[0];
    winner = entry?.winner?.name ?? null;
    if (entry && lastCheckpoint) {
      const all = (entry.standings ?? []).slice().sort((a, b) => b.bp - a.bp);
      checks.ok(
        "hall-winner-is-top",
        !!winner && all[0]?.name === winner,
        `hall winner ${winner} is not top of its standings (${all[0]?.name})`,
      );
      // The standings are the final day's records (nobody acts after the final checkpoint).
      for (const [label, rec] of lastCheckpoint.records) {
        const row = entry.standings.find((s) => s.name === rec.name);
        checks.ok(
          "hall-standings-agree",
          !!row && row.bp === rec.bp,
          `${label} (${rec.name}, ${rec.bp} BP) is ${row ? `${row.bp} BP` : "missing"} in the hall of fame`,
        );
      }
    }
    const after = readTown(server.dbPath, TOWN)?.state.deeds ?? [];
    checks.ok(
      "deeds-intact",
      deedsBefore.every((d, i) => after[i] === d) && after.length >= deedsBefore.length,
      "the Book of Deeds lost lines in the reset",
      { before: deedsBefore.length, after: after.length },
    );
    checks.ok(
      "deeds-winner",
      winner === null || after.length === deedsBefore.length + 1,
      `the Book of Deeds has ${after.length - deedsBefore.length} new line(s) for one winner`,
    );
    for (const p of players) {
      const me = await p.api.me().catch(async () => {
        await p.logIn();
        return p.api.me();
      });
      checks.ok(
        "reset-unlinked",
        me.parlors.every((x) => x.townId !== TOWN),
        `${p.label} still holds a parlor after the reset`,
      );
      p.forgetParlor();
      p.inSession = false;
      p.closeSocket();
    }
    if (o.afterSeason) {
      currentDay = t.day;
      await playDay(currentDay, []);
      gameDaysPlayed++;
      await checkpoint("day 1 of the next season");
      const t2 = await townInfo();
      checks.ok(
        "next-season-plays",
        t2.players.registered === players.length,
        `${t2.players.registered} of ${players.length} parlors made in the new season`,
      );
    }
  } else {
    checks.fail("season-ended", `the ${o.days}-day tournament did not end`);
  }

  // ------------------------------------------------------------- the end
  const finalBackup = await admin.backup("final");
  const size = dbSize(server.dbPath);
  checks.ok(
    "db-compact",
    size.dbBytes <= Math.max(4 * finalBackup.bytes, finalBackup.bytes + 8 * 1024 * 1024),
    `database is ${size.dbBytes} bytes; a compacted copy is ${finalBackup.bytes}`,
  );
  const code = await server.stop();
  checks.ok("graceful-stop", code === 0, `server exited with ${code} on SIGTERM`);
  for (const pr of server.problems.splice(0)) {
    checks.fail("server-log", "server logged a problem at the end", pr.line);
  }
  for (const p of players) p.closeSocket();
  checks.ok(
    "kills",
    server.kills >= Math.min(3, o.kills),
    `only ${server.kills} hard kills happened`,
  );

  // ------------------------------------------------------------ report
  const totals: Record<string, number> = {};
  for (const p of players) {
    for (const [k, v] of Object.entries(p.stats)) {
      if (typeof v === "number") totals[k] = (totals[k] ?? 0) + v;
    }
  }
  totals.serverStarts = server.starts;
  totals.hardKills = server.kills;
  const notes: Record<string, number> = {};
  for (const n of checks.notes) notes[n.what] = (notes[n.what] ?? 0) + 1;
  let expandedFeatures: Record<string, number> | undefined;
  if (o.rules === "expanded") {
    expandedFeatures = {};
    const groups: Record<string, RegExp> = {
      bingo: /^church:(bingo|card)/,
      vote: /^city-hall:(vote|ordinance)/,
      election: /^city-hall:(elect|election|file)/,
      loan: /^bank:(loan|borrow|repay)/,
      savings: /^bank:(deposit|savings|withdraw)/,
      chain: /chain/,
      graveyard: /^graveyard:/,
      club: /^reaper-club:/,
      duel: /duel/,
    };
    for (const p of players) {
      for (const [b, n] of Object.entries(p.stats.byButton)) {
        for (const [g, re] of Object.entries(groups))
          if (re.test(b)) expandedFeatures[g] = (expandedFeatures[g] ?? 0) + n;
      }
    }
  }
  const report: SoakReport = {
    name: o.name,
    options: o,
    dir,
    passed: checks.violations.length === 0,
    realSeconds: Math.round((Date.now() - startedReal) / 1000),
    gameDaysPlayed,
    seasonEnded,
    winner,
    totals,
    restarts,
    backups,
    adminActions,
    invariants: checks.tally(),
    violations: checks.violations.map((v) => ({
      invariant: v.invariant,
      message: v.message,
      day: v.day,
    })),
    notes,
    serverLogProblems: [],
    dbGrowth,
    ...(expandedFeatures ? { expandedFeatures, expandedLife } : {}),
    players: players.map((p) => ({
      label: p.label,
      guest: p.spec.guest,
      personality: p.spec.personality,
      difficulty: p.spec.difficulty,
      name: p.form.name,
      stats: p.stats,
    })),
    transcript: transcriptPath,
  };
  transcript.write({ kind: "event", what: "report", data: report });
  await transcript.close();
  writeFileSync(join(dir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(dir, "violations.json"), `${JSON.stringify(checks.violations, null, 2)}\n`);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return report;
}
