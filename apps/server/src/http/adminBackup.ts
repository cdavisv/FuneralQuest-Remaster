import { createReadStream, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { backupDirOf, isBackupName, listBackups, makeBackup } from "../db/backup.js";
import type { AppContext } from "./context.js";
import { HttpError } from "./errors.js";

/**
 * `/admin/backups`: consistent copies of the whole database while the server runs (see
 * `db/backup.ts`), listed, downloaded and deleted. Restoring one is done with the server stopped
 * (`node server.mjs restore <file>`; docs/sysop-guide.md), because it replaces everything.
 */
export function registerBackupAdmin(
  admin: FastifyInstance,
  ctx: AppContext,
  audit: (request: FastifyRequest, kind: string, townId: string | null, data: unknown) => void,
): void {
  const dirOf = (): string => {
    const dir = backupDirOf(ctx.config);
    if (dir === null) {
      throw new HttpError(409, "no_backup_dir", "An in-memory database has no backups.");
    }
    return dir;
  };
  const NameParams = z.object({
    name: z.string().max(80).refine(isBackupName, "not a backup name"),
  });

  admin.get("/backups", async () => {
    const dir = dirOf();
    return { dir, keep: ctx.config.backupKeep, backups: listBackups(dir) };
  });

  admin.post("/backups", async (request, reply) => {
    const body = z
      .strictObject({ label: z.string().regex(/^[A-Za-z0-9-]{1,32}$/).optional() })
      .parse(request.body ?? {});
    const manifest = makeBackup(ctx.db, dirOf(), {
      at: ctx.clock.now(),
      source: "admin",
      keep: ctx.config.backupKeep,
      ...(body.label !== undefined ? { label: body.label } : {}),
    });
    audit(request, "backup", null, { file: manifest.file, bytes: manifest.bytes });
    ctx.log.info({ file: manifest.file, bytes: manifest.bytes }, "backup written");
    return reply.status(201).send(manifest);
  });

  admin.get("/backups/:name", async (request, reply) => {
    const { name } = NameParams.parse(request.params);
    const path = join(dirOf(), name);
    if (!existsSync(path)) throw new HttpError(404, "no_such_backup", "No such backup.");
    audit(request, "backup:download", null, { file: name });
    return reply
      .header("content-type", "application/vnd.sqlite3")
      .header("content-disposition", `attachment; filename="${name}"`)
      .send(createReadStream(path));
  });

  admin.delete("/backups/:name", async (request, reply) => {
    const { name } = NameParams.parse(request.params);
    const path = join(dirOf(), name);
    if (!existsSync(path)) throw new HttpError(404, "no_such_backup", "No such backup.");
    rmSync(path, { force: true });
    rmSync(`${path}.json`, { force: true });
    audit(request, "backup:delete", null, { file: name });
    return reply.status(204).send();
  });
}
