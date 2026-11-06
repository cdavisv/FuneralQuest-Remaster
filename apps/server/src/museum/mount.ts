import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { legacyCompat, REPO_ROOT } from "@fq/legacy-compat";
import type { FastifyInstance } from "fastify";
import type { AppContext } from "../http/context.js";
import { createMuseumHost } from "./host.js";
import { MUSEUM_PATH } from "./path.js";
import { museumTarget, refusalPage } from "./target.js";

export { MUSEUM_PATH };

/** Paths of the three things museum mode serves, from `FQ_MUSEUM_DIR` or the repository. */
export function museumPaths(museumDir: string): {
  legacyRoot: string;
  ruffleRoot: string;
  manifestPath: string;
} {
  if (museumDir !== "") {
    const root = resolve(museumDir);
    return {
      legacyRoot: resolve(root, "public"),
      ruffleRoot: resolve(root, "ruffle"),
      manifestPath: resolve(root, "manifest.json"),
    };
  }
  return {
    legacyRoot: resolve(REPO_ROOT, "legacy/dist/public"),
    ruffleRoot: resolve(REPO_ROOT, "packages/legacy-compat/node_modules/@ruffle-rs/ruffle"),
    manifestPath: resolve(REPO_ROOT, "assets/manifest.json"),
  };
}

/**
 * Museum mode: the original 2001 Flash client, under Ruffle, playing a town of this server.
 * Does nothing unless `FQ_LEGACY_CLIENT` is on, and then serves files from `legacy/` (including
 * the original sounds, which are licensed only for Funeral Quest) under `/museum/`.
 */
export async function registerMuseum(app: FastifyInstance, ctx: AppContext): Promise<void> {
  const { config, host: games } = ctx;
  if (!config.legacyClient) return;

  // A named town that does not exist is a mistake in the configuration: stop at start-up. A town
  // that exists but runs another ruleset, or no Classic town at all, is a state the server can
  // be in at any time (towns come and go through the admin API), so museum mode answers with an
  // explanation page instead of failing.
  const first = museumTarget(games, config);
  if (config.legacyTown !== "" && !games.get(config.legacyTown)) {
    throw new Error(`Museum mode: there is no town "${config.legacyTown}" (FQ_LEGACY_TOWN).`);
  }
  if (first.kind === "refused") {
    ctx.log.warn({ reason: first.reason }, "museum mode is on but has no Classic town to play");
  }
  const townOf = () => {
    const target = museumTarget(games, config);
    if (target.kind === "refused") throw new Error(`Museum mode: ${target.reason}`);
    return target.town;
  };

  const paths = museumPaths(config.museumDir);
  const where = config.museumDir !== "" ? "FQ_MUSEUM_DIR" : "the repository";
  for (const [what, path] of [
    ["the original client's public folder (legacy/dist/public)", paths.legacyRoot],
    ["Ruffle (@ruffle-rs/ruffle)", resolve(paths.ruffleRoot, "ruffle.js")],
    ["assets/manifest.json", paths.manifestPath],
  ] as const) {
    if (!existsSync(path)) {
      throw new Error(
        `Museum mode is on but ${what} was not found at ${path} (looked in ${where}).`,
      );
    }
  }

  const museum = createMuseumHost({
    accounts: ctx.accounts,
    throttle: ctx.throttle,
    games,
    clock: ctx.clock,
    log: ctx.log,
    town: townOf,
  });

  // Logging on and signing up cost a password hash and run inside the town's queue, so they get
  // the same per-address budget as the API's own sign-up and log-in.
  const attempts = new Map<string, number[]>();
  const windowMs = config.rateWindowSeconds * 1000;

  await app.register(
    async (scope) => {
      // Nothing of the original client is served while there is no Classic town to play.
      scope.addHook("onRequest", async (_request, reply) => {
        const target = museumTarget(games, config);
        if (target.kind === "refused") {
          return reply
            .status(409)
            .header("content-type", "text/html; charset=utf-8")
            .send(refusalPage(target.reason));
        }
      });
      scope.addHook("onRequest", async (request, reply) => {
        const query = request.raw.url?.split("?")[1] ?? "";
        const verb = query.split("&")[0]?.toLowerCase();
        if (verb !== "logon" && verb !== "new") return;
        const now = ctx.clock.now();
        const recent = (attempts.get(request.ip) ?? []).filter((t) => now - t < windowMs);
        if (recent.length >= config.rateAuthMax) {
          attempts.set(request.ip, recent);
          return reply.status(429).send({
            error: "rate_limited",
            message: "Too many requests. Slow down and try again shortly.",
          });
        }
        recent.push(now);
        if (attempts.size > 10_000) attempts.clear();
        attempts.set(request.ip, recent);
      });
      await scope.register(legacyCompat, {
        host: museum.host,
        enabled: true,
        legacyRoot: paths.legacyRoot,
        ruffleRoot: paths.ruffleRoot,
        manifestPath: paths.manifestPath,
        log: (line) => ctx.log.info(line),
        onBridge: (bridge) => museum.attach(bridge),
      });
    },
    { prefix: MUSEUM_PATH.replace(/\/$/, "") },
  );
}
