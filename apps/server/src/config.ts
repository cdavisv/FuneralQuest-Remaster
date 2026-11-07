import { z } from "zod";

/**
 * Server configuration. Everything comes from environment variables (see
 * `.env.example`); `loadConfig` parses and validates them once at start-up so a
 * typo fails loudly instead of silently using a default.
 */

const boolish = z.union([z.boolean(), z.string()]).transform((v, ctx) => {
  if (typeof v === "boolean") return v;
  const s = v.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(s)) return true;
  if (["0", "false", "no", "off", ""].includes(s)) return false;
  ctx.addIssue({ code: "custom", message: `not a boolean: ${v}` });
  return z.NEVER;
});

const intish = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

const ConfigSchema = z.object({
  host: z.string().min(1),
  port: intish(0, 65535),
  /** SQLite file, or ":memory:" for tests. */
  dbPath: z.string().min(1),
  /** Bearer token for /admin. When empty the admin API is disabled. */
  adminToken: z.string(),
  /** Directory holding the built client; empty serves the API only. */
  clientDir: z.string(),
  /** JSON file listing towns to create when missing. */
  townsFile: z.string(),
  /** Directory of extra content pack directories (one per pack); empty uses the built-in packs only. */
  packsDir: z.string(),
  /** Museum mode: serve the original 2001 Flash client at /museum, playing the same town. */
  legacyClient: boolish,
  /** Museum mode: mark the original client's session cookie Secure. Turn on behind HTTPS. */
  secureCookies: boolish,
  /** Museum mode: the town the original client joins; empty means the first town. */
  legacyTown: z.string(),
  /**
   * Museum mode, bundled server: a directory holding `public/` (legacy/dist/public), `ruffle/`
   * (the @ruffle-rs/ruffle package) and `manifest.json` (assets/manifest.json). Empty finds
   * them in the repository (development).
   */
  museumDir: z.string(),
  /** Create the default towns when the database has none. */
  createDefaultTown: boolish,
  /** Which default towns: `both` (an Expanded flagship and a Classic town), `expanded` or `classic`. */
  defaultTowns: z.enum(["both", "expanded", "classic"]),
  logLevel: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]),
  /** Fastify `trustProxy`: "false", "true", a hop count, or a comma list of addresses. */
  trustProxy: z.string(),
  /** Comma-separated allowed browser origins for CORS and WebSocket. Empty allows none cross-origin. */
  allowedOrigins: z.string(),
  bodyLimitBytes: intish(256, 1_000_000),
  /** Send a Content-Security-Policy with the web client's page (the admin and deletion pages always have theirs). */
  clientCsp: boolish,
  /** Seconds a request may take to arrive in full (slow-body and slow-header protection). */
  requestTimeoutSeconds: intish(1, 600),
  signupEnabled: boolish,
  guestEnabled: boolish,
  sessionTtlDays: intish(1, 365),
  /** Minutes without an action before a player is logged off (calls `leaveGame`). */
  idleTimeoutMinutes: intish(1, 10_080),
  /** Seconds between idle sweeps. */
  idleSweepSeconds: intish(1, 3600),
  snapshotIntervalMinutes: intish(1, 10_080),
  snapshotKeep: intish(1, 10_000),
  /** Audit rows older than this many days are deleted. 0 keeps everything. */
  auditRetentionDays: intish(0, 36_500),
  /** Most missed days run in one catch-up (a safety cap, not a rule). */
  maxCatchUpDays: intish(1, 100_000),
  /** Rate limits: requests per window per key. */
  rateGlobalMax: intish(1, 1_000_000),
  rateAuthMax: intish(1, 100_000),
  rateActionMax: intish(1, 1_000_000),
  rateAdminMax: intish(1, 100_000),
  rateWindowSeconds: intish(1, 86_400),
  /**
   * New accounts (sign-ups and guests together) one address may make per hour. 0 means three times
   * the per-window sign-up and log-in budget (`FQ_RATE_AUTH_MAX`), so loosening that one knob for
   * tests loosens this too.
   */
  signupsPerHour: intish(0, 1_000_000),
  /** WebSockets one player may hold open at once, and one network address in total. */
  socketsPerPlayer: intish(1, 100),
  socketsPerAddress: intish(1, 10_000),
  /** Operations that may wait in one town's queue before new ones are answered 503. */
  maxQueuedPerTown: intish(1, 1_000_000),
  /** Argon2id cost; the defaults follow OWASP's minimum. Tests lower them. */
  argon2MemoryKiB: intish(8, 1_048_576),
  argon2Passes: intish(1, 20),
  /**
   * Player safety. A file of strictly blocked words (one per line; `sha256:<hex>` hashes or plain
   * words, see README) that announcements, names and parlor names are refused for. Empty: none.
   */
  blocklistFile: z.string(),
  /** Shown on the public account-deletion page and the admin page. Empty shows a marked blank. */
  contactEmail: z.string().max(200),
  /** Reports one account may file per hour and per day. */
  reportsPerHour: intish(1, 10_000),
  reportsPerDay: intish(1, 100_000),
  /** An account reported by this many distinct registered accounts in the window is muted. 0 turns it off. */
  autoMuteReports: intish(0, 1000),
  autoMuteWindowMinutes: intish(1, 10_080),
  autoMuteHours: intish(1, 8760),
  /** The in-memory cafe window kept for reports: lines per town and how long a line stays. */
  chatBufferLines: intish(10, 5000),
  chatBufferMinutes: intish(1, 1440),
  /** Reports that were dismissed or acted on are deleted after this many days. 0 keeps them. */
  reportRetentionDays: intish(0, 36_500),
});

export type ServerConfig = z.infer<typeof ConfigSchema>;

type Env = Record<string, string | undefined>;

const ENV_KEYS: Record<keyof ServerConfig, string> = {
  host: "FQ_HOST",
  port: "FQ_PORT",
  dbPath: "FQ_DB_PATH",
  adminToken: "FQ_ADMIN_TOKEN",
  clientDir: "FQ_CLIENT_DIR",
  townsFile: "FQ_TOWNS_FILE",
  packsDir: "FQ_PACKS_DIR",
  legacyClient: "FQ_LEGACY_CLIENT",
  secureCookies: "FQ_SECURE_COOKIES",
  legacyTown: "FQ_LEGACY_TOWN",
  museumDir: "FQ_MUSEUM_DIR",
  createDefaultTown: "FQ_CREATE_DEFAULT_TOWN",
  defaultTowns: "FQ_DEFAULT_TOWNS",
  logLevel: "FQ_LOG_LEVEL",
  trustProxy: "FQ_TRUST_PROXY",
  allowedOrigins: "FQ_ALLOWED_ORIGINS",
  bodyLimitBytes: "FQ_BODY_LIMIT_BYTES",
  clientCsp: "FQ_CLIENT_CSP",
  requestTimeoutSeconds: "FQ_REQUEST_TIMEOUT_SECONDS",
  signupEnabled: "FQ_SIGNUP_ENABLED",
  guestEnabled: "FQ_GUEST_ENABLED",
  sessionTtlDays: "FQ_SESSION_TTL_DAYS",
  idleTimeoutMinutes: "FQ_IDLE_TIMEOUT_MINUTES",
  idleSweepSeconds: "FQ_IDLE_SWEEP_SECONDS",
  snapshotIntervalMinutes: "FQ_SNAPSHOT_INTERVAL_MINUTES",
  snapshotKeep: "FQ_SNAPSHOT_KEEP",
  auditRetentionDays: "FQ_AUDIT_RETENTION_DAYS",
  maxCatchUpDays: "FQ_MAX_CATCH_UP_DAYS",
  rateGlobalMax: "FQ_RATE_GLOBAL_MAX",
  rateAuthMax: "FQ_RATE_AUTH_MAX",
  rateActionMax: "FQ_RATE_ACTION_MAX",
  rateAdminMax: "FQ_RATE_ADMIN_MAX",
  rateWindowSeconds: "FQ_RATE_WINDOW_SECONDS",
  signupsPerHour: "FQ_RATE_SIGNUPS_PER_HOUR",
  socketsPerPlayer: "FQ_WS_PER_PLAYER",
  socketsPerAddress: "FQ_WS_PER_ADDRESS",
  maxQueuedPerTown: "FQ_MAX_QUEUED_PER_TOWN",
  argon2MemoryKiB: "FQ_ARGON2_MEMORY_KIB",
  argon2Passes: "FQ_ARGON2_PASSES",
  blocklistFile: "FQ_BLOCKLIST_FILE",
  contactEmail: "FQ_CONTACT_EMAIL",
  reportsPerHour: "FQ_REPORT_MAX_PER_HOUR",
  reportsPerDay: "FQ_REPORT_MAX_PER_DAY",
  autoMuteReports: "FQ_AUTOMUTE_REPORTS",
  autoMuteWindowMinutes: "FQ_AUTOMUTE_WINDOW_MINUTES",
  autoMuteHours: "FQ_AUTOMUTE_HOURS",
  chatBufferLines: "FQ_CHAT_BUFFER_LINES",
  chatBufferMinutes: "FQ_CHAT_BUFFER_MINUTES",
  reportRetentionDays: "FQ_REPORT_RETENTION_DAYS",
};

export const DEFAULT_CONFIG: Record<keyof ServerConfig, string | number | boolean> = {
  host: "127.0.0.1",
  port: 8080,
  dbPath: "./data/fq.sqlite",
  adminToken: "",
  clientDir: "",
  townsFile: "",
  packsDir: "",
  legacyClient: false,
  secureCookies: false,
  legacyTown: "",
  museumDir: "",
  createDefaultTown: true,
  defaultTowns: "both",
  logLevel: "info",
  trustProxy: "false",
  allowedOrigins: "",
  bodyLimitBytes: 16_384,
  clientCsp: true,
  requestTimeoutSeconds: 30,
  signupEnabled: true,
  guestEnabled: true,
  sessionTtlDays: 30,
  idleTimeoutMinutes: 15,
  idleSweepSeconds: 30,
  snapshotIntervalMinutes: 60,
  snapshotKeep: 48,
  auditRetentionDays: 90,
  maxCatchUpDays: 365,
  rateGlobalMax: 600,
  rateAuthMax: 10,
  rateActionMax: 120,
  rateAdminMax: 120,
  rateWindowSeconds: 60,
  signupsPerHour: 0,
  socketsPerPlayer: 4,
  socketsPerAddress: 100,
  maxQueuedPerTown: 256,
  argon2MemoryKiB: 19_456,
  argon2Passes: 2,
  blocklistFile: "",
  contactEmail: "",
  reportsPerHour: 10,
  reportsPerDay: 30,
  autoMuteReports: 3,
  autoMuteWindowMinutes: 60,
  autoMuteHours: 24,
  chatBufferLines: 100,
  chatBufferMinutes: 30,
  reportRetentionDays: 180,
};

/** Reads configuration from `env` (defaults to `process.env`). Throws a readable error. */
export function loadConfig(env: Env = process.env): ServerConfig {
  const raw: Record<string, unknown> = {};
  for (const key of Object.keys(ENV_KEYS) as (keyof ServerConfig)[]) {
    const value = env[ENV_KEYS[key]];
    raw[key] = value !== undefined && value !== "" ? value : DEFAULT_CONFIG[key];
  }
  const parsed = ConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues.map(
      (i) => `  ${ENV_KEYS[i.path[0] as keyof ServerConfig] ?? i.path.join(".")}: ${i.message}`,
    );
    throw new Error(`Invalid configuration:\n${lines.join("\n")}`);
  }
  const config = parsed.data;
  if (config.adminToken !== "" && config.adminToken.length < 24) {
    throw new Error("Invalid configuration:\n  FQ_ADMIN_TOKEN: must be at least 24 characters");
  }
  return config;
}

/** A full config for tests and embedding: defaults plus overrides, in memory, silent. */
export function testConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    ...loadConfig({}),
    dbPath: ":memory:",
    logLevel: "silent",
    port: 0,
    argon2MemoryKiB: 1024,
    argon2Passes: 1,
    ...overrides,
  };
}
