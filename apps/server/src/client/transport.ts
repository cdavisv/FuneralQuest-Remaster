import type { Action, View } from "@fq/protocol";
import type {
  ClientMessage,
  DailyChallengeScore,
  Notice,
  ParlorForm,
  ServerMessage,
} from "../wire.js";
import { type ApiClient, ApiError } from "./api.js";

export type Unsubscribe = () => void;

/**
 * Structurally identical to `Transport` in `apps/client/src/transport/types.ts`,
 * so an instance of `ServerTransport` can be passed to `<App transport={...} />`.
 */
export interface GameTransport {
  connect(): Promise<View>;
  send(action: Action): Promise<View>;
  onPush(listener: (view: View) => void): Unsubscribe;
  close(): void;
}

/** The part of a WebSocket this transport uses (the DOM one and `ws` both fit). */
export interface SocketLike {
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code: number }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export interface ServerTransportOptions {
  api: ApiClient;
  townId: string;
  /** Sent the first time this account enters the town, when it has no parlor yet. */
  parlor?: ParlorForm;
  /** WebSocket URL. Default: derived from the API base URL, or the page's origin. */
  wsUrl?: string;
  /** A WebSocket constructor. Default: the global one. */
  webSocket?: new (
    url: string,
  ) => SocketLike;
  reconnect?: { minMs?: number; maxMs?: number };
  /** Timer functions, replaceable in tests. */
  timers?: {
    setTimeout(fn: () => void, ms: number): unknown;
    clearTimeout(handle: unknown): void;
  };
}

/** Close codes after which retrying cannot help. */
const FINAL_CLOSE = new Set([4000, 4401, 4403, 4404, 4409]);
const MAX_CHAT_LINES = 200;

/**
 * Implements the client's `Transport` over this server: `connect` enters the
 * town (HTTP) and opens the push socket, `send` posts an action, pushed Views
 * reach `onPush`, and other pushes (broadcasts, mail, new day) reach `onNotice`.
 * The socket reconnects with exponential backoff; after a reconnect the
 * current View is fetched, and pushed if it differs, since pushes sent while
 * disconnected are lost.
 *
 * Chat and TV lines also reach `onPush`, as the last View with the line
 * appended to `chat`, so a client that only knows Views stays current in the cafe.
 */
export class ServerTransport implements GameTransport {
  private readonly pushListeners = new Set<(view: View) => void>();
  private readonly noticeListeners = new Set<(notice: Notice) => void>();
  private socket: SocketLike | null = null;
  private lastView: View | null = null;
  private attempt = 0;
  private retryTimer: unknown = null;
  private closed = true;
  private everReady = false;

  constructor(private readonly options: ServerTransportOptions) {}

  async connect(): Promise<View> {
    this.closeSocket();
    this.closed = false;
    this.everReady = false;
    const response = await this.options.api.enter(
      this.options.townId,
      this.options.parlor ? { parlor: this.options.parlor } : {},
    );
    this.lastView = response.view;
    this.attempt = 0;
    this.openSocket();
    return response.view;
  }

  async send(action: Action): Promise<View> {
    if (this.closed) throw new Error("not connected");
    const view = await this.options.api.act(this.options.townId, action);
    if (!this.closed) this.lastView = view;
    return view;
  }

  onPush(listener: (view: View) => void): Unsubscribe {
    this.pushListeners.add(listener);
    return () => {
      this.pushListeners.delete(listener);
    };
  }

  /** Non-View pushes: broadcasts, mail, new day, sysop messages, end of session. */
  onNotice(listener: (notice: Notice) => void): Unsubscribe {
    this.noticeListeners.add(listener);
    return () => {
      this.noticeListeners.delete(listener);
    };
  }

  close(): void {
    this.closed = true;
    this.clearRetry();
    this.closeSocket();
    this.pushListeners.clear();
    this.noticeListeners.clear();
  }

  // ---------------------------------------------------------------- socket

  private url(): string {
    if (this.options.wsUrl) return this.options.wsUrl;
    const base = this.options.api.baseUrl;
    if (base !== "") return `${base.replace(/^http/, "ws")}/api/ws`;
    const here = (globalThis as { location?: { protocol: string; host: string } }).location;
    if (!here) throw new Error("wsUrl is required outside a browser");
    return `${here.protocol === "https:" ? "wss" : "ws"}://${here.host}/api/ws`;
  }

  private openSocket(): void {
    const Ctor =
      this.options.webSocket ??
      ((globalThis as { WebSocket?: new (url: string) => SocketLike }).WebSocket as
        | (new (
            url: string,
          ) => SocketLike)
        | undefined);
    if (!Ctor) throw new Error("No WebSocket available; pass options.webSocket");
    const socket = new Ctor(this.url());
    this.socket = socket;
    socket.onopen = () => {
      const token = this.options.api.token;
      if (!token) return;
      const hello: ClientMessage = { type: "hello", token, townId: this.options.townId };
      socket.send(JSON.stringify(hello));
    };
    socket.onmessage = (event) => {
      if (this.closed || this.socket !== socket || typeof event.data !== "string") return;
      let message: ServerMessage;
      try {
        message = JSON.parse(event.data) as ServerMessage;
      } catch {
        return;
      }
      this.handle(message);
    };
    socket.onclose = (event) => {
      if (this.socket === socket) this.socket = null;
      if (this.closed) return;
      if (FINAL_CLOSE.has(event.code)) {
        if (event.code === 4409) this.emitNotice({ kind: "sessionEnded", reason: "timeout" });
        return;
      }
      this.scheduleReconnect();
    };
    socket.onerror = () => {
      // A close event follows; reconnection happens there.
    };
  }

  private handle(message: ServerMessage): void {
    switch (message.type) {
      case "ready": {
        const resync = this.everReady;
        this.everReady = true;
        this.attempt = 0;
        if (resync) void this.resync();
        return;
      }
      case "pong":
        return;
      case "view":
        this.lastView = message.view;
        this.emitView(message.view);
        return;
      case "notice": {
        const n = message.notice;
        if (n.kind === "chat" || n.kind === "tv") this.appendChat(n.text);
        this.emitNotice(n);
        if (n.kind === "sessionEnded") this.stopForGood();
        return;
      }
    }
  }

  private appendChat(text: Extract<Notice, { kind: "chat" }>["text"]): void {
    const view = this.lastView;
    if (view?.scene !== "cafe") return;
    const chat = [...(view.chat ?? []), { text }].slice(-MAX_CHAT_LINES);
    const next: View = { ...view, chat };
    this.lastView = next;
    this.emitView(next);
  }

  private async resync(): Promise<void> {
    try {
      const view = await this.options.api.currentView(this.options.townId);
      if (this.closed) return;
      if (JSON.stringify(view) !== JSON.stringify(this.lastView)) {
        this.lastView = view;
        this.emitView(view);
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === "not_in_game") {
        this.emitNotice({ kind: "sessionEnded", reason: "timeout" });
        this.stopForGood();
      }
    }
  }

  private scheduleReconnect(): void {
    this.clearRetry();
    const min = this.options.reconnect?.minMs ?? 500;
    const max = this.options.reconnect?.maxMs ?? 15_000;
    const delay = Math.min(max, min * 2 ** this.attempt) * (0.5 + Math.random() / 2);
    this.attempt++;
    this.retryTimer = this.timers().setTimeout(() => {
      this.retryTimer = null;
      if (!this.closed) this.openSocket();
    }, delay);
  }

  private clearRetry(): void {
    if (this.retryTimer === null) return;
    this.timers().clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private timers(): NonNullable<ServerTransportOptions["timers"]> {
    return (
      this.options.timers ?? {
        setTimeout: (fn, ms) => setTimeout(fn, ms),
        clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
      }
    );
  }

  private stopForGood(): void {
    this.clearRetry();
    this.closeSocket();
  }

  private closeSocket(): void {
    const socket = this.socket;
    this.socket = null;
    if (!socket) return;
    socket.onclose = null;
    socket.onmessage = null;
    socket.onopen = null;
    try {
      socket.close(1000, "bye");
    } catch {
      // Already closed.
    }
  }

  private emitView(view: View): void {
    if (this.closed) return;
    for (const listener of [...this.pushListeners]) listener(view);
  }

  private emitNotice(notice: Notice): void {
    if (this.closed) return;
    for (const listener of [...this.noticeListeners]) listener(notice);
  }
}

/**
 * The Daily Challenge as a `Transport`: `connect` starts today's run (or resumes it), `send` posts
 * an action, and there is nothing to push (a challenge is a private one-player town). Pass it to
 * `<App transport={...} />` like a `ServerTransport`. When the run ends, `onResult` is called with
 * its score (the view of that last action is still returned, so the finished desk shows).
 */
export class DailyChallengeTransport implements GameTransport {
  private closed = true;
  private resultListener: ((result: DailyChallengeScore) => void) | null = null;

  constructor(private readonly options: { api: ApiClient; parlor?: ParlorForm }) {}

  async connect(): Promise<View> {
    this.closed = false;
    const entered = await this.options.api.enterDailyChallenge(
      this.options.parlor ? { parlor: this.options.parlor } : {},
    );
    return entered.view;
  }

  async send(action: Action): Promise<View> {
    if (this.closed) throw new Error("not connected");
    const response = await this.options.api.actDailyChallenge(action);
    if (response.result) this.resultListener?.(response.result);
    return response.view;
  }

  /** Called once when the run is over, with its score. */
  onResult(listener: (result: DailyChallengeScore) => void): Unsubscribe {
    this.resultListener = listener;
    return () => {
      if (this.resultListener === listener) this.resultListener = null;
    };
  }

  onPush(): Unsubscribe {
    return () => undefined;
  }

  close(): void {
    this.closed = true;
    this.resultListener = null;
  }
}
