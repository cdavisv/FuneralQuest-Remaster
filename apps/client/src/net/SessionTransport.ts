import type { Action, View } from "@fq/protocol";
import {
  type ApiClient,
  ApiError,
  type Notice,
  type ParlorForm,
  ServerTransport,
  type SocketLike,
} from "@fq/server/client";
import {
  type ConnectionState,
  type LiveTransport,
  SendError,
  type Unsubscribe,
} from "../transport/types.js";
import { FINAL_CLOSE_CODES, type HeartbeatOptions, observeSockets } from "./observedSocket.js";

export interface SessionTransportOptions {
  api: ApiClient;
  townId: string;
  parlor?: ParlorForm | undefined;
  webSocket?: new (url: string) => SocketLike;
  heartbeat?: HeartbeatOptions;
  reconnect?: { minMs?: number; maxMs?: number };
}

/**
 * The client's real transport: `ServerTransport` plus what the UI needs on top of it.
 *
 * - `connect` is idempotent while connected, so the front door can enter the town (and show
 *   the server's complaints on its own form) before the game component mounts and "connects".
 * - `close` takes effect a tick later and `connect` cancels it, so React's development
 *   double-mount does not enter the town twice.
 * - It reports whether the push socket is up (`onConnection`) and turns the failures of
 *   `send` into `SendError`s a player can understand. A refused action (`rejected`) is not
 *   a failure for the player: the server's current View comes back and is simply shown.
 */
export class SessionTransport implements LiveTransport {
  private inner: ServerTransport | null = null;
  private lastView: View | null = null;
  private connected = false;
  private disposed = false;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private connection: ConnectionState = "online";
  private readonly pushListeners = new Set<(view: View) => void>();
  private readonly noticeListeners = new Set<(notice: Notice) => void>();
  private readonly connectionListeners = new Set<(state: ConnectionState) => void>();

  constructor(private readonly options: SessionTransportOptions) {}

  async connect(): Promise<View> {
    if (this.closeTimer !== null) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
    if (this.connected && this.inner && this.lastView) return this.lastView;
    this.teardown();
    this.disposed = false;
    const inner = new ServerTransport({
      api: this.options.api,
      townId: this.options.townId,
      ...(this.options.parlor ? { parlor: this.options.parlor } : {}),
      ...(this.options.reconnect ? { reconnect: this.options.reconnect } : {}),
      webSocket: observeSockets(
        {
          ready: () => this.setConnection("online"),
          lost: (code) => {
            if (!FINAL_CLOSE_CODES.has(code)) this.setConnection("reconnecting");
          },
        },
        this.options.webSocket,
        this.options.heartbeat,
      ),
    });
    inner.onPush((view) => {
      this.lastView = view;
      for (const l of [...this.pushListeners]) l(view);
    });
    inner.onNotice((notice) => {
      if (notice.kind === "sessionEnded") this.connected = false;
      for (const l of [...this.noticeListeners]) l(notice);
    });
    this.inner = inner;
    const view = await inner.connect();
    this.lastView = view;
    this.connected = true;
    this.connection = "online";
    return view;
  }

  async send(action: Action): Promise<View> {
    const inner = this.inner;
    if (!inner || !this.connected) throw new SendError("network");
    try {
      const view = await inner.send(action);
      this.lastView = view;
      return view;
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.view && error.code === "rejected") {
          // The screen changed under the player (a push they have not seen, a stale click).
          // Showing the server's current View is the whole repair.
          this.lastView = error.view;
          return error.view;
        }
        if (error.code === "muted" || error.code === "guest_text") {
          // moderation hook: the moderators' mute refused this. Keep the screen, say why.
          window.dispatchEvent(
            new CustomEvent("fq:muted", { detail: { message: error.message, mute: error.mute } }),
          );
          if (this.lastView) return this.lastView;
        }
        if (error.code === "not_in_game" || error.status === 401) {
          this.connected = false;
          this.emitNotice({ kind: "sessionEnded", reason: "timeout" });
          throw new SendError("server");
        }
        if (error.status === 429) throw new SendError("rate");
        throw new SendError("server");
      }
      throw new SendError("network");
    }
  }

  onPush(listener: (view: View) => void): Unsubscribe {
    this.pushListeners.add(listener);
    return () => {
      this.pushListeners.delete(listener);
    };
  }

  onNotice(listener: (notice: Notice) => void): Unsubscribe {
    this.noticeListeners.add(listener);
    return () => {
      this.noticeListeners.delete(listener);
    };
  }

  onConnection(listener: (state: ConnectionState) => void): Unsubscribe {
    this.connectionListeners.add(listener);
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  close(): void {
    if (this.closeTimer !== null) return;
    this.closeTimer = setTimeout(() => {
      this.closeTimer = null;
      this.teardown();
      this.disposed = true;
    }, 0);
  }

  private teardown(): void {
    this.connected = false;
    const inner = this.inner;
    this.inner = null;
    if (inner) {
      this.disposed = true;
      inner.close();
    }
  }

  private setConnection(state: ConnectionState): void {
    if (this.disposed || this.connection === state) return;
    this.connection = state;
    for (const l of [...this.connectionListeners]) l(state);
  }

  private emitNotice(notice: Notice): void {
    for (const l of [...this.noticeListeners]) l(notice);
  }
}
