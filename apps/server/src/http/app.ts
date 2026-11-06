import { existsSync } from "node:fs";
import { resolve } from "node:path";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";
import { registerMuseum } from "../museum/mount.js";
import { registerAdminRoutes } from "./admin.js";
import type { AppContext } from "./context.js";
import { installErrorHandling, sendNotFound } from "./errors.js";
import { registerPages } from "./pages.js";
import { registerRoutes } from "./routes.js";
import { registerSafetyRoutes } from "./safety.js";
import { registerSocket } from "./socket.js";

/** Builds the Fastify app over an already-assembled context. */
export async function buildApp(ctx: AppContext): Promise<FastifyInstance> {
  const { config } = ctx;
  const trust = config.trustProxy.trim().toLowerCase();
  // "N" means trust the N nearest proxies; otherwise a boolean or a list of addresses.
  const trustProxy: boolean | string[] | ((address: string, hop: number) => boolean) =
    trust === "true"
      ? true
      : trust === "false" || trust === ""
        ? false
        : /^\d+$/.test(trust)
          ? (_address, hop) => hop < Number(trust)
          : config.trustProxy.split(",").map((s) => s.trim());

  const app = Fastify({
    loggerInstance: ctx.log,
    bodyLimit: config.bodyLimitBytes,
    trustProxy,
    // Secrets never reach the logs: bodies and headers are not logged at all.
    routerOptions: { maxParamLength: 128 },
    requestTimeout: 30_000,
  });
  app.decorateRequest("auth", null);

  installErrorHandling(app);

  const origins = config.allowedOrigins
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  await app.register(cors, {
    origin: origins.length > 0 ? origins : false,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Authorization", "Content-Type"],
    maxAge: 600,
  });

  // The admin routes get their own (lower) budget. This hook must run before the rate-limit
  // plugin's own `onRoute`, which reads `config.rateLimit` as each route is added.
  app.addHook("onRoute", (route) => {
    if (route.url.startsWith("/admin")) {
      route.config = {
        ...route.config,
        rateLimit: { max: config.rateAdminMax, timeWindow: config.rateWindowSeconds * 1000 },
      };
    }
  });

  await app.register(rateLimit, {
    global: true,
    max: config.rateGlobalMax,
    timeWindow: config.rateWindowSeconds * 1000,
    // Keep the table bounded when an attacker rotates addresses.
    cache: 20_000,
  });

  await app.register(websocket, { options: { maxPayload: 2048 } });

  app.addHook("onSend", async (_request, reply) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("referrer-policy", "no-referrer");
    reply.header("x-frame-options", "DENY");
    if (!reply.hasHeader("cache-control")) reply.header("cache-control", "no-store");
  });

  registerRoutes(app, ctx);
  registerSafetyRoutes(app, ctx);
  registerPages(app, ctx);
  await registerAdminRoutes(app, ctx);
  await registerSocket(app, ctx);
  await registerMuseum(app, ctx);

  // Fastify allows one not-found handler per instance, so decide here whether it also
  // serves the client shell.
  let serveClient = false;
  if (config.clientDir !== "") {
    const root = resolve(config.clientDir);
    if (existsSync(resolve(root, "index.html"))) {
      await app.register(fastifyStatic, {
        root,
        wildcard: false,
        cacheControl: true,
        maxAge: "1h",
        setHeaders: (res, path) => {
          if (path.endsWith("index.html")) res.header("cache-control", "no-cache");
        },
      });
      serveClient = true;
    } else {
      ctx.log.warn({ clientDir: root }, "FQ_CLIENT_DIR has no index.html; serving the API only");
    }
  }

  app.setNotFoundHandler((request, reply) => {
    const url = request.url;
    // Single-page app: unknown GETs outside the API get the client shell.
    if (
      serveClient &&
      request.method === "GET" &&
      !url.startsWith("/api") &&
      !url.startsWith("/admin") &&
      !url.startsWith("/health") &&
      !url.startsWith("/museum")
    ) {
      return reply.sendFile("index.html");
    }
    return sendNotFound(reply);
  });

  return app;
}
