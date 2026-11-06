import type { FastifyBaseLogger } from "fastify";
import type { AccountService, AuthInfo } from "../auth/accounts.js";
import type { LoginThrottle } from "../auth/throttle.js";
import type { Clock } from "../clock.js";
import type { ServerConfig } from "../config.js";
import type { ContentSource } from "../content/index.js";
import type { Db } from "../db/database.js";
import type { GameHost } from "../game/host.js";

/** What the route modules share. */
export interface AppContext {
  config: ServerConfig;
  db: Db;
  clock: Clock;
  accounts: AccountService;
  throttle: LoginThrottle;
  host: GameHost;
  content: ContentSource;
  log: FastifyBaseLogger;
  startedAt: number;
}

declare module "fastify" {
  interface FastifyRequest {
    /** Set by the `authenticate` hook on routes that need a logged-in player. */
    auth: AuthInfo | null;
  }
}
