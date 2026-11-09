import { rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "./config.js";
import {
  backupDatabase,
  backupDirOf,
  checkBackup,
  makeBackup,
  pidFileOf,
  restoreDatabase,
  runningServer,
} from "./db/backup.js";
import { openDatabase } from "./db/database.js";
import { importLegacyTown, LegacyImportError } from "./legacyImport.js";
import { createServer } from "./server.js";

const USAGE = `Usage:
  node server.mjs                      run the server (configured by FQ_* environment variables)
  node server.mjs backup [file]        write a consistent copy of FQ_DB_PATH (safe while the server runs);
                                       default: a new file in FQ_BACKUP_DIR (or ./backups next to the database)
  node server.mjs check <file>         check a backup: integrity, schema, towns
  node server.mjs restore <file>       replace FQ_DB_PATH with a backup (the server must be stopped;
                                       the old files are kept as *.before-restore-<time>)
  node server.mjs import-legacy --dir <old server folder> --town <id> [--name <name>] [--time-zone <zone>]
                       [--keep-passwords] [--passwords-file <file>] [--dry-run]
                                       create a Classic town from a 2001 server's player.dat, config.dat and
                                       system.dat (the server must be stopped; docs/sysop-guide.md)`;

/** `import-legacy`: the sysop's way to bring a 2001 town across. */
async function importLegacy(args: string[]): Promise<number> {
  const flags = new Map<string, string | true>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string;
    if (!arg.startsWith("--")) throw new Error(`unexpected argument "${arg}"`);
    const key = arg.slice(2);
    if (key === "keep-passwords" || key === "dry-run") flags.set(key, true);
    else {
      const value = args[++i];
      if (value === undefined) throw new Error(`--${key} needs a value`);
      flags.set(key, value);
    }
  }
  const text = (key: string): string | undefined => {
    const v = flags.get(key);
    return typeof v === "string" ? v : undefined;
  };
  const dir = text("dir");
  const town = text("town");
  if (!dir || !town)
    throw new Error("import-legacy needs --dir <old server folder> and --town <id>");
  try {
    const result = await importLegacyTown(
      loadConfig(),
      {
        dir,
        townId: town,
        townName: text("name"),
        timeZone: text("time-zone"),
        keepPasswords: flags.has("keep-passwords"),
        passwordsFile: text("passwords-file"),
        dryRun: flags.has("dry-run"),
      },
      Date.now(),
    );
    console.log(JSON.stringify(result, null, 2));
    return 0;
  } catch (error) {
    if (error instanceof LegacyImportError) {
      console.error(error.message);
      return 2;
    }
    throw error;
  }
}

/** `backup`, `check` and `restore`: the sysop's commands (docs/sysop-guide.md). */
function command(args: string[]): number {
  const [name, file] = args;
  const config = loadConfig();
  if (name === "backup") {
    if (config.dbPath === ":memory:")
      throw new Error("FQ_DB_PATH is in memory; nothing to back up");
    // A second connection: SQLite gives it a consistent read of the live, WAL-mode file.
    const db = openDatabase(config.dbPath);
    try {
      const dir = backupDirOf(config);
      if (!file && dir === null) throw new Error("no backup directory");
      const manifest = file
        ? backupDatabase(db, resolve(file), "command", Date.now())
        : makeBackup(db, dir as string, {
            at: Date.now(),
            source: "command",
            keep: config.backupKeep,
          });
      console.log(JSON.stringify(manifest, null, 2));
    } finally {
      db.close();
    }
    return 0;
  }
  if (name === "check") {
    if (!file) throw new Error("check needs a file");
    const result = checkBackup(resolve(file));
    console.log(JSON.stringify(result, null, 2));
    return result.ok ? 0 : 2;
  }
  if (name === "restore") {
    if (!file) throw new Error("restore needs a file");
    const result = restoreDatabase(resolve(file), config.dbPath, Date.now());
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }
  console.error(USAGE);
  return name === "help" || name === "--help" ? 0 : 64;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] === "import-legacy") process.exit(await importLegacy(args.slice(1)));
  if (args.length > 0) {
    process.exit(command(args));
  }
  const config = loadConfig();
  const pidFile = config.dbPath === ":memory:" ? null : pidFileOf(config.dbPath);
  if (pidFile !== null) {
    const other = runningServer(config.dbPath);
    if (other !== null) throw new Error(`another server (pid ${other}) is using ${config.dbPath}`);
  }
  const server = await createServer(config);
  const log = server.app.log;
  if (config.adminToken === "") {
    log.warn("FQ_ADMIN_TOKEN is not set: the admin API is disabled");
  }
  const { address, port } = await server.listen();
  // Lets `restore` refuse to replace the database under a running server.
  if (pidFile !== null) writeFileSync(pidFile, `${process.pid}\n`);
  log.info({ address, port, db: config.dbPath }, "Funeral Quest server listening");

  let stopping = false;
  const stop = (signal: string) => {
    if (stopping) return;
    stopping = true;
    log.info({ signal }, "shutting down");
    const force = setTimeout(() => {
      log.error("shutdown took too long; exiting");
      process.exit(1);
    }, 15_000);
    force.unref();
    server.close().then(
      () => {
        if (pidFile !== null) rmSync(pidFile, { force: true });
        log.info("state flushed; bye");
        process.exit(0);
      },
      (error: unknown) => {
        log.error({ err: error }, "error during shutdown");
        process.exit(1);
      },
    );
  };
  process.on("SIGTERM", () => stop("SIGTERM"));
  process.on("SIGINT", () => stop("SIGINT"));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
