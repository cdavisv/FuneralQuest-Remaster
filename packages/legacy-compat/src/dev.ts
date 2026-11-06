import Fastify from "fastify";
import { createDevHost } from "./devHost.js";
import { legacyCompat } from "./plugin.js";

/**
 * Standalone dev server: `pnpm --filter @fq/legacy-compat dev`.
 *
 *   PORT          port to listen on (default 4747)
 *   FQ_SEED       town seed (default random)
 *   FQ_RIVALS     rival parlors to start with (default 3, at most 4)
 *   FQ_TRACE      log every request and the variables sent back
 *   FQ_DEV_SAVE   a JSON file to keep the town in between runs (default: nothing is saved)
 *
 * Open http://localhost:4747/ to play the original client. Development
 * helpers (not part of the plugin): GET /dev/new-day runs midnight
 * maintenance, GET /dev/town prints a summary.
 */
const port = Number(process.env.PORT ?? 4747);
const seed = process.env.FQ_SEED ? Number(process.env.FQ_SEED) : undefined;
const rivals = process.env.FQ_RIVALS ? Number(process.env.FQ_RIVALS) : undefined;

const saveFile = process.env.FQ_DEV_SAVE;

const host = await createDevHost({
  ...(saveFile ? { saveFile } : {}),
  ...(seed !== undefined ? { seed } : {}),
  ...(rivals !== undefined ? { rivals } : {}),
});
const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } });

await app.register(legacyCompat, {
  host,
  enabled: true,
  log: (line) => app.log.info(line),
  ...(process.env.FQ_TRACE ? { trace: (line: string) => app.log.info(line) } : {}),
});

app.get("/dev/new-day", async () => host.newDay());
app.get("/dev/town", async () => {
  const town = host.town();
  return {
    day: town.day,
    players: town.players
      .filter((p) => p.active)
      .map((p) => ({ id: p.id, name: p.name, bp: p.bp })),
    online: Object.keys(town.sessions),
  };
});

await app.listen({ port, host: "127.0.0.1" });
app.log.info(`Funeral Quest original client: http://127.0.0.1:${port}/`);
