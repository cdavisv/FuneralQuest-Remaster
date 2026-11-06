import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { addressKey } from "../auth/ip.js";
import type { ServerMessage } from "../wire.js";
import type { AppContext } from "./context.js";
import { ClientMessageSchema } from "./schemas.js";

/** Application close codes (4000 to 4999 are free for apps). */
export const CLOSE = {
  /** The player's session ended; enter the town again. */
  sessionEnded: 4000,
  unauthorized: 4401,
  banned: 4403,
  noSuchTown: 4404,
  notInGame: 4409,
  badMessage: 4400,
  /** Too many sockets from one address, or messages faster than any client sends them. */
  tooMany: 4429,
} as const;

/**
 * A client sends one ping every twenty seconds and one hello. More than this in ten seconds is a
 * script, not a client.
 */
const MESSAGES_PER_WINDOW = 12;
const MESSAGE_WINDOW_MS = 10_000;

const HELLO_DEADLINE_MS = 5000;
const HEARTBEAT_MS = 30_000;

/**
 * The push channel. A client opens `/api/ws`, and its first message must be
 * `{"type":"hello","token":...,"townId":...}`. The token travels in the message,
 * not the URL, so it never lands in a proxy or access log. After `ready` the
 * server pushes `ServerMessage`s; the only things the client may send are `ping`.
 * Game actions never use the socket.
 */
export async function registerSocket(app: FastifyInstance, ctx: AppContext): Promise<void> {
  const allowed = ctx.config.allowedOrigins
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  /** Open sockets per network address, authenticated or not. */
  const perAddress = new Map<string, number>();

  /** A browser's Origin must be listed, or, when none are listed, be this server's own address. */
  const originAllowed = (origin: string, host: string): boolean => {
    if (allowed.length > 0) return allowed.includes(origin);
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  };

  app.get("/api/ws", { websocket: true }, (socket: WebSocket, request) => {
    const origin = request.headers.origin;
    if (origin && !originAllowed(origin, request.host)) {
      socket.close(CLOSE.unauthorized, "origin not allowed");
      return;
    }
    const ip = request.ip;
    const addressId = addressKey(ip);
    const open = (perAddress.get(addressId) ?? 0) + 1;
    if (open > ctx.config.socketsPerAddress) {
      socket.close(CLOSE.tooMany, "too many connections");
      return;
    }
    perAddress.set(addressId, open);
    let messageWindowStart = Date.now();
    let messagesInWindow = 0;
    let attached = false;
    let busy = false;
    let detach: (() => void) | null = null;
    let alive = true;

    const send = (message: ServerMessage) => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
    };

    const deadline = setTimeout(() => {
      if (!attached) socket.close(CLOSE.unauthorized, "hello timeout");
    }, HELLO_DEADLINE_MS);
    deadline.unref();

    const heartbeat = setInterval(() => {
      if (!alive) {
        socket.terminate();
        return;
      }
      alive = false;
      socket.ping();
    }, HEARTBEAT_MS);
    heartbeat.unref();
    socket.on("pong", () => {
      alive = true;
    });

    socket.on("close", () => {
      const left = (perAddress.get(addressId) ?? 1) - 1;
      if (left <= 0) perAddress.delete(addressId);
      else perAddress.set(addressId, left);
      clearTimeout(deadline);
      clearInterval(heartbeat);
      detach?.();
      detach = null;
    });
    socket.on("error", () => socket.terminate());

    socket.on("message", (raw: Buffer, isBinary: boolean) => {
      const now = Date.now();
      if (now - messageWindowStart >= MESSAGE_WINDOW_MS) {
        messageWindowStart = now;
        messagesInWindow = 0;
      }
      if (++messagesInWindow > MESSAGES_PER_WINDOW) {
        socket.close(CLOSE.tooMany, "too many messages");
        return;
      }
      if (isBinary) {
        socket.close(CLOSE.badMessage, "text only");
        return;
      }
      let parsed: ReturnType<typeof ClientMessageSchema.safeParse>;
      try {
        parsed = ClientMessageSchema.safeParse(JSON.parse(raw.toString("utf8")));
      } catch {
        socket.close(CLOSE.badMessage, "bad json");
        return;
      }
      if (!parsed.success) {
        socket.close(CLOSE.badMessage, "bad message");
        return;
      }
      const message = parsed.data;
      if (message.type === "ping") {
        send({ type: "pong" });
        return;
      }
      if (attached || busy) return;
      busy = true;
      void (async () => {
        const auth = ctx.accounts.authenticate(message.token, ip);
        if (!auth) {
          socket.close(CLOSE.unauthorized, "unauthorized");
          return;
        }
        const town = ctx.host.get(message.townId);
        if (!town) {
          socket.close(CLOSE.noSuchTown, "no such town");
          return;
        }
        const playerId = await town.sessionPlayerId(auth.account);
        if (playerId === null) {
          socket.close(CLOSE.notInGame, "not in game");
          return;
        }
        if (socket.readyState !== socket.OPEN) return;
        clearTimeout(deadline);
        attached = true;
        // A reconnecting client may still have its dead socket on the books; the oldest ones go.
        ctx.host.hub.evictOldest(
          town.id,
          playerId,
          ctx.config.socketsPerPlayer - 1,
          CLOSE.sessionEnded,
          "too many connections for this parlor",
        );
        detach = ctx.host.hub.attach(town.id, playerId, {
          send: (data) => socket.send(data),
          close: (code, reason) => socket.close(code, reason.slice(0, 100)),
          get bufferedAmount() {
            return socket.bufferedAmount;
          },
          ip,
        });
        send({ type: "ready", townId: town.id, day: town.snapshotState.day });
      })()
        .catch((error: unknown) => {
          ctx.log.error({ err: error }, "socket hello failed");
          socket.close(1011, "error");
        })
        .finally(() => {
          busy = false;
        });
    });
  });
}
