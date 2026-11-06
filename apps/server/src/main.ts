import { loadConfig } from "./config.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const server = await createServer(config);
  const log = server.app.log;
  if (config.adminToken === "") {
    log.warn("FQ_ADMIN_TOKEN is not set: the admin API is disabled");
  }
  const { address, port } = await server.listen();
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
