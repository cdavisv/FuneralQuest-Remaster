import { readFileSync } from "node:fs";
import type { FastifyBaseLogger } from "fastify";
import type { Account, AccountService } from "../auth/accounts.js";
import type { Clock } from "../clock.js";
import type { ServerConfig } from "../config.js";
import type { ContentSource } from "../content/index.js";
import { backupDirOf, makeBackup } from "../db/backup.js";
import type { Db } from "../db/database.js";
import {
  ActivityStore,
  AuditStore,
  ChallengeStore,
  HallStore,
  ParlorStore,
  SecretStore,
  TownStore,
} from "../db/stores.js";
import { ModerationService } from "../moderation/service.js";
import type { TownInfo } from "../wire.js";
import { ActivityRecorder, addDays, utcDay } from "./activity.js";
import { ChallengeService } from "./challenge.js";
import { Hub } from "./hub.js";
import { checkTownSetup, TownConfigError } from "./setup.js";
import { type TownDeps, TownRuntime } from "./town.js";
import { type TownConfig, TownConfigSchema, TownsFileSchema, toSpec } from "./townConfig.js";

export class TownExists extends Error {
  constructor(readonly id: string) {
    super(`Town "${id}" already exists`);
  }
}

export { TownConfigError };

/**
 * The towns a fresh server creates when the database has none and no towns file named any
 * (`FQ_DEFAULT_TOWNS`, `FQ_CREATE_DEFAULT_TOWN=false` turns them off). The Expanded town is the
 * flagship and comes first; it plays the Expanded ruleset's own 30-day seasons with the tournament
 * reset. The Classic town keeps the id `main`, which older clients and scripts used for the one
 * default town.
 */
export function defaultTowns(which: "both" | "expanded" | "classic"): TownConfig[] {
  const expanded = TownConfigSchema.parse({
    id: "expanded",
    name: "Dead Calm",
    ruleset: "expanded",
    serverNews: "Welcome to Dead Calm. A new season has begun.",
  });
  const classic = TownConfigSchema.parse({
    id: "main",
    name: "Dead Calm Classic",
    ruleset: "classic",
    serverNews: "Welcome to town.",
  });
  return which === "both" ? [expanded, classic] : which === "expanded" ? [expanded] : [classic];
}

/**
 * All the towns on this server, plus the housekeeping that spans them: idle
 * sweeps, periodic snapshots and expired-session purges. Day timers belong to
 * each town.
 */
export class GameHost {
  readonly hub = new Hub();
  readonly towns = new Map<string, TownRuntime>();
  readonly townStore: TownStore;
  readonly parlorStore: ParlorStore;
  readonly audit: AuditStore;
  readonly hall: HallStore;
  /** The activity record (one row per account, town and UTC day played), for `GET /admin/stats`. */
  readonly activityStore: ActivityStore;
  readonly activity: ActivityRecorder;
  /** The Daily Challenge: one private run per account per day. */
  readonly challenge: ChallengeService;
  /** Blocks, reports, mutes, the strict word list and the short cafe window kept for reports. */
  readonly moderation: ModerationService;
  private readonly deps: TownDeps;
  private cancelHousekeeping: Array<() => void> = [];
  private stopped = false;

  constructor(
    db: Db,
    private readonly config: ServerConfig,
    private readonly clock: Clock,
    private readonly content: ContentSource,
    private readonly accounts: AccountService,
    private readonly log: FastifyBaseLogger,
  ) {
    this.townStore = new TownStore(db);
    this.parlorStore = new ParlorStore(db);
    this.audit = new AuditStore(db);
    this.hall = new HallStore(db);
    this.activityStore = new ActivityStore(db);
    this.activity = new ActivityRecorder(this.activityStore, () => clock.now());
    this.moderation = new ModerationService({
      db,
      clock,
      config,
      parlors: this.parlorStore,
      audit: this.audit,
      towns: { get: (id) => this.towns.get(id), all: () => this.towns.values() },
      getAccount: (id) => accounts.getAccount(id),
    });
    this.challenge = new ChallengeService({
      db,
      store: new ChallengeStore(db),
      secrets: new SecretStore(db),
      audit: this.audit,
      clock,
      content,
      log,
      idleTimeoutMs: config.idleTimeoutMinutes * 60_000,
    });
    this.deps = {
      db,
      towns: this.townStore,
      parlors: this.parlorStore,
      audit: this.audit,
      hall: this.hall,
      activity: this.activity,
      clock,
      content,
      hub: this.hub,
      log,
      moderation: this.moderation,
      idleTimeoutMs: config.idleTimeoutMinutes * 60_000,
      maxCatchUpDays: config.maxCatchUpDays,
      snapshotKeep: config.snapshotKeep,
      maintenanceDelayMs: config.testMaintenanceDelayMs,
    };
    this.db = db;
  }

  private readonly db: Db;

  /**
   * Loads every stored town, creates the configured ones that are missing,
   * runs any maintenance missed while the server was down, and starts timers.
   */
  async start(): Promise<void> {
    for (const row of this.townStore.list()) {
      if (!this.content.names().includes(row.content_pack)) {
        throw new TownConfigError(
          `Town "${row.id}" uses content pack "${row.content_pack}", which is not available. Put the pack back in FQ_PACKS_DIR (available: ${this.content.names().join(", ")}).`,
        );
      }
      const runtime = TownRuntime.load(row, this.deps);
      this.towns.set(row.id, runtime);
    }
    for (const config of this.readTownsFile()) {
      if (!this.towns.has(config.id)) this.createTown(config);
    }
    if (this.towns.size === 0 && this.config.createDefaultTown) {
      for (const config of defaultTowns(this.config.defaultTowns)) this.createTown(config);
    }
    for (const runtime of this.towns.values()) {
      // Accounts' blocks are the truth; the engine's lists are rebuilt from them at every start.
      await runtime.refreshBlocks();
      const missed = await runtime.catchUp();
      if (missed > 0) this.log.info({ townId: runtime.id, missed }, "ran missed days");
      runtime.armTimer();
    }
    await this.challenge.sweep();
    this.hub.onPresence((event) => {
      const town = this.towns.get(event.townId);
      if (!town || this.stopped) return;
      town.connectionChanged(event.playerId, event.connected).catch((error: unknown) => {
        this.log.error({ err: error, townId: event.townId }, "presence update failed");
      });
    });
    this.armHousekeeping();
  }

  private readTownsFile(): TownConfig[] {
    if (this.config.townsFile === "") return [];
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(this.config.townsFile, "utf8"));
    } catch (error) {
      throw new TownConfigError(
        `Cannot read FQ_TOWNS_FILE ${this.config.townsFile}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const parsed = TownsFileSchema.safeParse(raw);
    if (!parsed.success) {
      throw new TownConfigError(
        `Invalid FQ_TOWNS_FILE: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      );
    }
    return parsed.data.towns;
  }

  /** Creates and registers a town. Throws `TownExists`, or `TownConfigError` for a bad ruleset or pack. */
  createTown(config: TownConfig): TownRuntime {
    if (this.towns.has(config.id)) throw new TownExists(config.id);
    const spec = toSpec(config);
    checkTownSetup(this.content, spec.ruleset, spec.contentPack, spec.ruleOverrides);
    const runtime = TownRuntime.create(spec, this.deps);
    this.towns.set(config.id, runtime);
    if (!this.stopped) runtime.armTimer();
    this.log.info({ townId: config.id }, "town created");
    return runtime;
  }

  async deleteTown(id: string): Promise<boolean> {
    const runtime = this.towns.get(id);
    if (!runtime) return false;
    this.hub.broadcast(id, {
      type: "notice",
      notice: { kind: "sessionEnded", reason: "townReset" },
      at: this.clock.now(),
    });
    await runtime.close();
    this.hub.closeTown(id, 4000, "town deleted");
    this.towns.delete(id);
    this.townStore.delete(id);
    this.audit.append({ at: this.clock.now(), townId: null, kind: "town:deleted", data: { id } });
    return true;
  }

  /**
   * Turns a guest into a full account and keeps their parlors. The engine's player carries the
   * account's log-in name, so every town where the guest has a parlor is locked first (in id
   * order, so two upgrades cannot wait on each other); then, in one turn with no waiting, the
   * account row and the players' names change together. Nobody sees a half-renamed parlor.
   */
  async upgradeGuest(account: Account, login: string, password: string): Promise<Account> {
    const hash = await this.accounts.hashPassword(password);
    const held = [...this.towns.values()]
      .filter((t) => t.parlorPlayerId(account) !== null)
      .sort((a, b) => a.id.localeCompare(b.id));
    const finish = async (): Promise<Account> => {
      const upgraded = this.accounts.upgradeGuest(account.id, login, hash);
      try {
        await Promise.all(held.map((t) => t.renameLogon(account.id, account.login, login)));
      } catch (error) {
        this.accounts.revertUpgrade(account.id, account.login);
        throw error;
      }
      return upgraded;
    };
    const nest = (i: number): Promise<Account> => {
      const town = held[i];
      return town ? town.runExclusive(() => nest(i + 1)) : finish();
    };
    return nest(0);
  }

  get(id: string): TownRuntime | undefined {
    return this.towns.get(id);
  }

  list(): TownInfo[] {
    return [...this.towns.values()].map((t) => t.info());
  }

  // ---------------------------------------------------------- housekeeping

  private armHousekeeping(): void {
    const every = (ms: number, work: () => Promise<void> | void) => {
      let cancel: (() => void) | null = null;
      const arm = () => {
        if (this.stopped) return;
        cancel = this.clock.setTimeout(async () => {
          try {
            await work();
          } catch (error) {
            this.log.error({ err: error }, "housekeeping failed");
          }
          arm();
        }, ms);
      };
      arm();
      this.cancelHousekeeping.push(() => cancel?.());
    };
    every(this.config.idleSweepSeconds * 1000, async () => {
      for (const t of this.towns.values()) {
        const n = await t.sweepIdle();
        if (n > 0) this.log.info({ townId: t.id, loggedOff: n }, "idle players logged off");
      }
    });
    every(this.config.idleSweepSeconds * 1000, async () => {
      const n = await this.challenge.sweep();
      if (n > 0) this.log.info({ abandoned: n }, "idle daily challenge runs ended");
    });
    every(this.config.snapshotIntervalMinutes * 60_000, async () => {
      for (const t of this.towns.values()) await t.snapshotIfDirty("periodic");
    });
    const backups = backupDirOf(this.config);
    if (this.config.backupIntervalHours > 0 && backups !== null) {
      every(this.config.backupIntervalHours * 3_600_000, () => {
        const manifest = makeBackup(this.db, backups, {
          at: this.clock.now(),
          source: "automatic",
          keep: this.config.backupKeep,
        });
        this.log.info({ file: manifest.file, bytes: manifest.bytes }, "automatic backup written");
      });
    }
    every(3_600_000, () => {
      this.accounts.purgeExpired();
      const guests = this.accounts.purgeGuests(7 * 86_400_000);
      if (guests > 0) {
        this.log.info({ guests }, "unused guest accounts removed");
        // Their blocks went with them (cascade); an id may be reused, so rebuild the index.
        this.moderation.reloadBlocks();
        this.activity.reset();
      }
      const reports = this.moderation.pruneReports();
      if (reports > 0) this.log.info({ reports }, "old closed reports removed");
      if (this.config.auditRetentionDays > 0) {
        const cutoff = this.clock.now() - this.config.auditRetentionDays * 86_400_000;
        const removed = this.audit.prune(cutoff, 50_000);
        if (removed > 0) this.log.info({ removed }, "old audit rows removed");
      }
      if (this.config.activityRetentionDays > 0) {
        const before = addDays(utcDay(this.clock.now()), -this.config.activityRetentionDays);
        const removed = this.activityStore.prune(before);
        if (removed > 0) this.log.info({ removed }, "old activity rows removed");
      }
    });
  }

  /**
   * First phase of shutdown: stop clock-driven work and tell connected players the socket is
   * closing, so nothing new starts while in-flight requests finish.
   */
  quiesce(): void {
    if (this.stopped) return;
    this.stopped = true;
    for (const cancel of this.cancelHousekeeping) cancel();
    this.cancelHousekeeping = [];
    this.hub.onPresence(null);
    this.hub.closeAll(1001, "server shutting down");
  }

  /**
   * Second phase: wait for every town's queue to empty (each step is already committed to
   * SQLite as it happens) and take a final snapshot of any town that changed.
   */
  async flush(): Promise<void> {
    await this.challenge.close();
    for (const t of this.towns.values()) {
      await t.close();
      try {
        await t.snapshotIfDirty("shutdown");
      } catch (error) {
        this.log.error({ err: error, townId: t.id }, "final snapshot failed");
      }
    }
  }
}
