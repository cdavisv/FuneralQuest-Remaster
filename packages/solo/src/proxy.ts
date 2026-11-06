import type { ContentPack } from "@fq/core";
import type { Action, View } from "@fq/protocol";
import type {
  PortLike,
  WireHostOptions,
  WorkerMessage,
  WorkerRequest,
  WorkerResults,
} from "./serve.js";
import type { Notice, SoloConfig, SoloSave, SoloStatus, Transport, Unsubscribe } from "./types.js";

/** A Worker (or a MessagePort) as the proxy sees it. */
export interface WorkerLike extends PortLike {
  terminate?(): void;
}

type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void };

/**
 * The main-thread side of a Solo game in a Web Worker. It speaks the client's
 * `Transport` shape (and `onNotice`, like the server transport), plus the
 * Solo controls: create or load a game, end the day, save, status.
 */
export class SoloWorkerClient implements Transport {
  private next = 1;
  private readonly pending = new Map<number, Pending>();
  private readonly pushListeners = new Set<(view: View) => void>();
  private readonly noticeListeners = new Set<(notice: Notice) => void>();
  private closed = false;

  constructor(private readonly worker: WorkerLike) {
    worker.addEventListener("message", (event) => this.receive(event.data as WorkerMessage));
  }

  private receive(message: WorkerMessage): void {
    if (!message || typeof message !== "object") return;
    if (message.type === "reply") {
      const waiting = this.pending.get(message.id);
      if (!waiting) return;
      this.pending.delete(message.id);
      if (message.ok) waiting.resolve(message.result);
      else {
        const error = new Error(message.error);
        error.name = message.name;
        // A refused parlor form (SoloSetupError) says which field was wrong.
        if (message.field !== undefined)
          (error as Error & { field?: string }).field = message.field;
        waiting.reject(error);
      }
      return;
    }
    if (this.closed) return;
    if (message.type === "push") for (const l of [...this.pushListeners]) l(message.view);
    if (message.type === "notice") for (const l of [...this.noticeListeners]) l(message.notice);
  }

  private call<M extends WorkerRequest["method"]>(
    method: M,
    fields: Omit<Extract<WorkerRequest, { method: M }>, "id" | "method">,
  ): Promise<WorkerResults[M]> {
    const id = this.next++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
      this.worker.postMessage({ ...fields, method, id });
    });
  }

  /**
   * Starts a new game in the worker. Leave `content` out to use the pack the worker has built
   * in under `config.contentPack` (the browser worker has `classic` and `vintage`); pass one to
   * copy it over.
   */
  async create(
    config: SoloConfig,
    content?: ContentPack,
    options?: WireHostOptions,
  ): Promise<void> {
    await this.call("create", {
      config,
      ...(content ? { content } : {}),
      ...(options ? { options } : {}),
    });
  }

  /** Opens a save in the worker. As for `create`, `content` is optional. */
  async load(
    save: SoloSave | unknown,
    content?: ContentPack,
    options?: WireHostOptions,
  ): Promise<void> {
    await this.call("load", {
      save,
      ...(content ? { content } : {}),
      ...(options ? { options } : {}),
    });
  }

  connect(): Promise<View> {
    this.closed = false;
    return this.call("connect", {});
  }

  send(action: Action): Promise<View> {
    return this.call("send", { action });
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

  endDay(): Promise<View> {
    return this.call("endDay", {});
  }

  tick(): Promise<boolean> {
    return this.call("tick", {});
  }

  save(): Promise<SoloSave> {
    return this.call("save", {});
  }

  status(): Promise<SoloStatus> {
    return this.call("status", {});
  }

  /** Stops listening. The worker keeps the game until `terminate` (or another create/load). */
  close(): void {
    this.closed = true;
    this.pushListeners.clear();
    this.noticeListeners.clear();
  }

  /** Ends the worker. Pending calls fail. */
  terminate(): void {
    this.close();
    for (const p of this.pending.values()) p.reject(new Error("The Solo worker was stopped."));
    this.pending.clear();
    this.worker.terminate?.();
  }
}
