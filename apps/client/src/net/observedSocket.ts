import type { SocketLike } from "@fq/server/client";

/** Close codes after which the server will not take the player back by itself. */
export const FINAL_CLOSE_CODES: ReadonlySet<number> = new Set([4000, 4401, 4403, 4404, 4409]);

export interface SocketObserver {
  /** The server accepted the hello: pushes flow. */
  ready(): void;
  /** The socket closed on its own (not because the transport closed it). */
  lost(code: number): void;
}

export interface HeartbeatOptions {
  /** Milliseconds between pings. Default 20000. */
  pingMs?: number;
  /** Milliseconds of silence after which the socket is considered dead. Default 50000. */
  deadMs?: number;
  now?: () => number;
  setInterval?: (fn: () => void, ms: number) => unknown;
  clearInterval?: (handle: unknown) => void;
}

type SocketCtor = new (url: string) => SocketLike;

/**
 * Wraps a WebSocket constructor so the client can see the socket's health, which
 * `ServerTransport` keeps to itself: it tells the observer when the server accepted the hello
 * and when the socket dropped, and it pings so a connection that silently died (a laptop lid, a
 * proxy that forgets idle sockets) is noticed and closed, which makes `ServerTransport` reopen it.
 */
export function observeSockets(
  observer: SocketObserver,
  base: SocketCtor | undefined,
  options: HeartbeatOptions = {},
): SocketCtor {
  const pingMs = options.pingMs ?? 20_000;
  const deadMs = options.deadMs ?? 50_000;
  const now = options.now ?? (() => Date.now());
  const every = options.setInterval ?? ((fn, ms) => setInterval(fn, ms));
  const stop = options.clearInterval ?? ((h) => clearInterval(h as ReturnType<typeof setInterval>));

  return class ObservedSocket implements SocketLike {
    onopen: SocketLike["onopen"] = null;
    onmessage: SocketLike["onmessage"] = null;
    onclose: SocketLike["onclose"] = null;
    onerror: SocketLike["onerror"] = null;
    private readonly ws: SocketLike;
    private heartbeat: unknown = null;
    private lastHeard = now();
    private closedByUs = false;

    constructor(url: string) {
      const Ctor =
        base ?? (globalThis as unknown as { WebSocket: SocketCtor | undefined }).WebSocket;
      if (!Ctor) throw new Error("No WebSocket available");
      const ws = new Ctor(url);
      this.ws = ws;
      ws.onopen = (event) => {
        this.lastHeard = now();
        this.onopen?.(event);
      };
      ws.onmessage = (event) => {
        this.lastHeard = now();
        if (typeof event.data === "string" && event.data.includes('"ready"')) {
          try {
            if ((JSON.parse(event.data) as { type?: string }).type === "ready") {
              this.startHeartbeat();
              observer.ready();
            }
          } catch {
            // Not ours to judge; the transport parses it again and ignores bad JSON.
          }
        }
        this.onmessage?.(event);
      };
      ws.onclose = (event) => {
        this.stopHeartbeat();
        if (!this.closedByUs) observer.lost(event.code);
        this.onclose?.(event);
      };
      ws.onerror = (event) => this.onerror?.(event);
    }

    send(data: string): void {
      this.ws.send(data);
    }

    close(code?: number, reason?: string): void {
      this.closedByUs = true;
      this.stopHeartbeat();
      this.ws.close(code, reason);
    }

    private startHeartbeat(): void {
      this.stopHeartbeat();
      this.heartbeat = every(() => {
        if (now() - this.lastHeard > deadMs) {
          // Nothing, not even a pong: treat the socket as gone. Closing fires onclose, which
          // the transport answers by reconnecting.
          try {
            this.ws.close(4001, "silent");
          } catch {
            // Already closed.
          }
          return;
        }
        try {
          this.ws.send('{"type":"ping"}');
        } catch {
          // The close event follows.
        }
      }, pingMs);
    }

    private stopHeartbeat(): void {
      if (this.heartbeat !== null) stop(this.heartbeat);
      this.heartbeat = null;
    }
  };
}
