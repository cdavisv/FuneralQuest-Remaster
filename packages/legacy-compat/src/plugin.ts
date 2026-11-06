import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { loadAssets } from "./assets.js";
import { LegacyBridge } from "./bridge.js";
import type { LegacyHost } from "./host.js";
import { rufflePage } from "./page.js";

/** Repository root, found from this file (packages/legacy-compat/src). */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export interface LegacyCompatOptions {
  host: LegacyHost;
  /**
   * The bridge plays a licensed 2001 client and serves files from legacy/;
   * it is off unless this is true. When false the plugin registers nothing.
   */
  enabled?: boolean;
  /** The original `public` folder (SWFs, home.html, pages). Default: legacy/dist/public. */
  legacyRoot?: string;
  /** assets/manifest.json, for the picture URL map. Default: assets/manifest.json. */
  manifestPath?: string;
  /** The @ruffle-rs/ruffle package folder. Default: resolved from node_modules. */
  ruffleRoot?: string;
  /** Name of the session cookie. Default "fq_legacy". */
  cookieName?: string;
  /** Add `Secure` to the cookie (set when served over https). */
  secureCookie?: boolean;
  /** Idle minutes-in-ms before a browser's player is logged off. Default 30 minutes. */
  idleMs?: number;
  log?: (line: string) => void;
  /** Called for every request with the decoded query and the variables sent back (debugging aid). */
  trace?: (line: string) => void;
  /** Called with the bridge once it exists, for `deliverChat` and shutdown. */
  onBridge?: (bridge: LegacyBridge) => void;
}

function findRuffleRoot(): string {
  const here = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const candidates = [
    resolve(here, "node_modules/@ruffle-rs/ruffle"),
    resolve(REPO_ROOT, "node_modules/@ruffle-rs/ruffle"),
  ];
  const found = candidates.find((c) => existsSync(resolve(c, "ruffle.js")));
  if (!found) throw new Error("@ruffle-rs/ruffle is not installed (pnpm install)");
  return found;
}

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const at = part.indexOf("=");
    if (at === -1) continue;
    if (part.slice(0, at).trim() === name) return part.slice(at + 1).trim();
  }
  return undefined;
}

/**
 * Mounts the legacy bridge in a Fastify instance (use `register` with a
 * `prefix` to mount it below a path):
 *
 * - `GET request.xp` (also `flash/request.xp`): the original protocol;
 * - `GET /`: a Ruffle page that plays `flash/welcome.swf`;
 * - `/ruffle/*`: Ruffle itself, from node_modules;
 * - everything else in `legacy/dist/public` (`flash/*`, `pages/*`, `home.html`), read only.
 */
export const legacyCompat: FastifyPluginAsync<LegacyCompatOptions> = async (
  app: FastifyInstance,
  options: LegacyCompatOptions,
) => {
  if (options.enabled !== true) {
    options.log?.("legacy bridge is off (enabled is not true)");
    return;
  }
  const legacyRoot = options.legacyRoot ?? resolve(REPO_ROOT, "legacy/dist/public");
  const manifestPath = options.manifestPath ?? resolve(REPO_ROOT, "assets/manifest.json");
  const ruffleRoot = options.ruffleRoot ?? findRuffleRoot();
  const cookieName = options.cookieName ?? "fq_legacy";
  const bridge = new LegacyBridge({
    host: options.host,
    assets: loadAssets(manifestPath, legacyRoot),
    ...(options.idleMs !== undefined ? { idleMs: options.idleMs } : {}),
    ...(options.log ? { log: options.log } : {}),
  });
  options.onBridge?.(bridge);

  const sweeper = setInterval(() => {
    bridge.sweep().catch((error) => options.log?.(`legacy sweep failed: ${String(error)}`));
  }, 60_000);
  sweeper.unref();
  app.addHook("onClose", async () => {
    clearInterval(sweeper);
    await bridge.closeAll();
  });

  const cookiePath = app.prefix === "" ? "/" : app.prefix;
  const handler = async (request: FastifyRequest, reply: FastifyReply) => {
    const url = request.raw.url ?? "";
    const query = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
    const token = readCookie(request.headers.cookie, cookieName);
    const result = await bridge.handle(token, query);
    options.trace?.(
      `${query.replace(/&key=[^&]*/, "").slice(0, 300)}\n    => ${result.vars
        .map(([n, v]) => `${n}=${String(v).slice(0, 60)}`)
        .join(" & ")}`,
    );
    const cookie = [
      `${cookieName}=${result.token}`,
      `Path=${cookiePath}`,
      "HttpOnly",
      "SameSite=Lax",
      ...(options.secureCookie ? ["Secure"] : []),
    ].join("; ");
    return reply
      .header("Content-Type", "application/x-www-form-urlencoded")
      .header("Cache-Control", "no-store, no-cache, must-revalidate")
      .header("Pragma", "no-cache")
      .header("Set-Cookie", cookie)
      .send(result.body);
  };
  app.get("/request.xp", handler);
  // A movie that resolves "request.xp" against its own address asks here.
  app.get("/flash/request.xp", handler);

  const page = rufflePage(app.prefix === "" ? "/" : `${app.prefix}/`);
  app.get("/", async (_request, reply) =>
    reply
      .header("Content-Type", "text/html; charset=utf-8")
      .header("Cache-Control", "no-cache")
      .send(page),
  );

  await app.register(fastifyStatic, {
    root: ruffleRoot,
    prefix: "/ruffle/",
    index: false,
    decorateReply: false,
    list: false,
  });
  await app.register(fastifyStatic, {
    root: legacyRoot,
    prefix: "/",
    index: false,
    decorateReply: false,
    list: false,
    dotfiles: "deny",
  });
};
