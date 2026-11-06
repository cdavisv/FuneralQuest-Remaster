import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
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
} as const;

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

  app.get("/api/ws", { websocket: true }, (socket: WebSocket, request) => {
    const origin = request.headers.origin;
    if (origin && allowed.length > 0 && !allowed.includes(origin)) {
      socket.close(CLOSE.unauthorized, "origin not allowed");
      return;
    }
    const ip = request.ip;
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
      clearTimeout(deadline);
      clearInterval(heartbeat);
      detach?.();
      detach = null;
    });
    socket.on("error", () => socket.terminate());

    socket.on("message", (raw: Buffer, isBinary: boolean) => {
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
