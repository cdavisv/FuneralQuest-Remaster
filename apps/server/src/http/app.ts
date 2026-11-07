import { existsSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";
import { registerMuseum } from "../museum/mount.js";
import { registerAdminRoutes } from "./admin.js";
import { registerStaticCompression } from "./compress.js";
import type { AppContext } from "./context.js";
import { installErrorHandling, sendNotFound } from "./errors.js";
import { registerPages } from "./pages.js";
import { registerRoutes } from "./routes.js";
import { registerSafetyRoutes } from "./safety.js";
import { registerSocket } from "./socket.js";

/**
 * What the web client's page may load: its own scripts, styles (with inline style attributes, which
 * React uses), pictures, fonts and sounds from this server, a module worker (Solo) and the
 * service worker from this server, and connections to this server and to the configured origins
 * (the page's own address, over http, https, ws and wss). No inline script, no `eval`, no plugins,
 * no framing.
 */
export function clientPolicy(host: string, origins: readonly string[]): string {
  const connect = new Set(["'self'"]);
  // The host comes from a request header: only a plain host and port may reach the policy.
  if (/^[\w.[\]:-]{1,255}$/.test(host)) {
    connect.add(`ws://${host}`);
    connect.add(`wss://${host}`);
  }
  for (const origin of origins) {
    try {
      const url = new URL(origin);
      connect.add(origin);
      if (url.protocol === "http:") connect.add(`ws://${url.host}`);
      if (url.protocol === "https:") connect.add(`wss://${url.host}`);
    } catch {
      // Not an address (a wrapper origin such as tauri://localhost is listed as it is above).
    }
  }
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "media-src 'self' blob: data:",
    `connect-src ${[...connect].join(" ")}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** Builds the Fastify app over an already-assembled context. */
export async function buildApp(ctx: AppContext): Promise<FastifyInstance> {
  const { config } = ctx;
  const origins = config.allowedOrigins
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
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
    // Slow clients: the whole request (headers and body) must arrive within this time, the
    // headers within the shorter of it and ten seconds, an idle keep-alive socket is closed after
    // five seconds, and the sweep that enforces these runs often enough to matter.
    requestTimeout: config.requestTimeoutSeconds * 1000,
    keepAliveTimeout: 5000,
    connectionTimeout: 0,
    http: {
      headersTimeout: Math.min(10_000, config.requestTimeoutSeconds * 1000),
      connectionsCheckingInterval: Math.min(2000, config.requestTimeoutSeconds * 500),
    },
  });
  app.decorateRequest("auth", null);

  installErrorHandling(app);

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
    // The plugin counts an IPv6 address as its subnet (a /56 by default), so a client rotating
    // through its own block shares one budget.
  });

  await app.register(websocket, { options: { maxPayload: 2048 } });

  app.addHook("onSend", async (request, reply) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("referrer-policy", "no-referrer");
    reply.header("x-frame-options", "DENY");
    if (!reply.hasHeader("cache-control")) reply.header("cache-control", "no-store");
    // The web client's own page. The admin and deletion pages set a stricter policy of their own,
    // and the museum's pages belong to the original client and Ruffle, which need more.
    const type = reply.getHeader("content-type");
    if (
      config.clientCsp &&
      typeof type === "string" &&
      type.startsWith("text/html") &&
      !reply.hasHeader("content-security-policy") &&
      !request.url.startsWith("/museum")
    ) {
      reply.header("content-security-policy", clientPolicy(request.host, origins));
    }
  });

  registerStaticCompression(app, (url) => !/^\/(api|admin|health|museum)(\/|\?|$)/.test(url));

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
          const rel = relative(root, path).split(sep).join("/");
          // Hashed files never change under their name; the page and the service worker are
          // fetched again every time (the worker must be, or an update could never arrive).
          if (rel === "index.html" || rel === "sw.js") res.header("cache-control", "no-cache");
          else if (rel.startsWith("assets/"))
            res.header("cache-control", "public, max-age=31536000, immutable");
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
