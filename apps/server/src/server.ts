import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import { AccountService } from "./auth/accounts.js";
import { createPasswordHasher } from "./auth/passwords.js";
import { LoginThrottle } from "./auth/throttle.js";
import { type Clock, clockFromConfig, ScaledClock } from "./clock.js";
import { type ServerConfig, usesTestClock } from "./config.js";
import { type ContentSource, createContentSource } from "./content/index.js";
import { type Db, openDatabase } from "./db/database.js";
import { GameHost } from "./game/host.js";
import { buildApp } from "./http/app.js";
import type { AppContext } from "./http/context.js";
import { createLogger } from "./logger.js";

export interface GameServer {
  app: FastifyInstance;
  host: GameHost;
  accounts: AccountService;
  db: Db;
  config: ServerConfig;
  /** Starts listening. Resolves with the bound address. */
  listen(): Promise<{ address: string; port: number }>;
  /** Stops accepting, flushes state, closes the database. Safe to call twice. */
  close(): Promise<void>;
}

export interface CreateServerOptions {
  clock?: Clock;
  content?: ContentSource;
  /** Reuse an open database (tests that restart the server over the same file pass the path instead). */
  db?: Db;
  /** Replace the logger (tests capture output through one). */
  logger?: FastifyBaseLogger;
}

/**
 * Assembles the server: database, accounts, towns, HTTP and WebSocket. Nothing
 * listens until `listen()`. Tests build one over an in-memory database and a
 * fake clock; `main.ts` builds one from the environment.
 */
export async function createServer(
  config: ServerConfig,
  options: CreateServerOptions = {},
): Promise<GameServer> {
  const clock = options.clock ?? clockFromConfig(config);
  // Read the content packs before opening the database, so a bad FQ_PACKS_DIR fails cleanly.
  const content = options.content ?? createContentSource({ packsDir: config.packsDir });
  const db = options.db ?? openDatabase(config.dbPath);

  const logger = options.logger ?? createLogger(config.logLevel);
  if (usesTestClock(config) && !options.clock) {
    logger.warn(
      {
        speed: clock instanceof ScaledClock ? clock.speed : 1,
        gameTime: new Date(clock.now()).toISOString(),
        maintenanceDelayMs: config.testMaintenanceDelayMs,
      },
      "soak-test clock in use (FQ_TEST_CLOCK_*): game time is not real time; never run a real town like this",
    );
  }

  const accounts = new AccountService(
    db,
    clock,
    createPasswordHasher({ memoryKiB: config.argon2MemoryKiB, passes: config.argon2Passes }),
    {
      sessionTtlMs: config.sessionTtlDays * 86_400_000,
      signupEnabled: config.signupEnabled,
      guestEnabled: config.guestEnabled,
      inviteRequired: config.inviteRequired,
    },
  );
  const host = new GameHost(db, config, clock, content, accounts, logger);
  await host.start();

  const ctx: AppContext = {
    config,
    db,
    clock,
    accounts,
    throttle: new LoginThrottle(clock),
    host,
    content,
    log: logger,
    startedAt: clock.now(),
  };
  const app = await buildApp(ctx);

  let closed = false;
  return {
    app,
    host,
    accounts,
    db,
    config,
    async listen() {
      await app.listen({ host: config.host, port: config.port });
      const address = app.server.address();
      if (address === null || typeof address === "string") throw new Error("not listening");
      return { address: address.address, port: address.port };
    },
    async close() {
      if (closed) return;
      closed = true;
      // Stop timers and sockets, refuse and drain HTTP, empty each town's queue and snapshot,
      // then close the database.
      host.quiesce();
      await app.close();
      await host.flush();
      try {
        db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
      } catch {
        // A checkpoint is housekeeping; closing still proceeds.
      }
      db.close();
    },
  };
}
