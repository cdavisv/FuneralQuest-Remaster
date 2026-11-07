import type { ContentPack } from "@fq/core";
import type { Action, View } from "@fq/protocol";
import { SoloHost } from "./host.js";
import { migrateSave } from "./saves.js";
import type { Notice, SoloConfig, SoloSave, SoloStatus } from "./types.js";

/** The part of a worker's global scope (or a MessagePort) the protocol uses. */
export interface PortLike {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
}

/** Host options that can cross a message channel. */
export interface WireHostOptions {
  /** Pin the clock (tests). Default: the worker's `Date.now`. */
  fixedNow?: number;
  /**
   * The page's IANA time zone (`pageTimeZone()`), for the time the original printed in front of
   * notices; see `HostOptions.timeZone`.
   */
  timeZone?: string;
}

/**
 * Main thread to worker. `content` is optional: without it the worker uses the pack it has
 * built in under the config's (or the save's) `contentPack` id, so the pack never crosses the
 * message channel and the page does not have to bundle it.
 */
export type WorkerRequest =
  | {
      id: number;
      method: "create";
      config: SoloConfig;
      content?: ContentPack;
      options?: WireHostOptions;
    }
  | { id: number; method: "load"; save: unknown; content?: ContentPack; options?: WireHostOptions }
  | { id: number; method: "connect" }
  | { id: number; method: "send"; action: Action }
  | { id: number; method: "endDay" }
  | { id: number; method: "tick" }
  | { id: number; method: "save" }
  | { id: number; method: "status" }
  | { id: number; method: "close" };

/** What each request answers with. */
export interface WorkerResults {
  create: null;
  load: null;
  connect: View;
  send: View;
  endDay: View;
  tick: boolean;
  save: SoloSave;
  status: SoloStatus;
  close: null;
}

/** Worker to main thread. */
export type WorkerMessage =
  | { type: "reply"; id: number; ok: true; result: unknown }
  | { type: "reply"; id: number; ok: false; error: string; name: string; field?: string }
  | { type: "push"; view: View }
  | { type: "notice"; notice: Notice };

/**
 * Runs a Solo host behind a message channel: answers `WorkerRequest`s and
 * forwards the host's pushes and notices. Bot-heavy days run here, off the
 * UI thread. `src/worker.ts` calls this on the worker's global scope.
 */
export function serveSolo(port: PortLike, packs: readonly ContentPack[] = []): void {
  const pack = (id: string, given?: ContentPack): ContentPack => {
    if (given) return given;
    const found = packs.find((p) => p.id === id);
    if (!found) throw new Error(`This worker has no content pack called "${id}".`);
    return found;
  };
  let host: SoloHost | null = null;
  const attach = (made: SoloHost) => {
    host?.close();
    host = made;
    made.onPush((view) => port.postMessage({ type: "push", view } satisfies WorkerMessage));
    made.onNotice((notice) => port.postMessage({ type: "notice", notice } satisfies WorkerMessage));
  };
  const need = (): SoloHost => {
    if (!host) throw new Error("No game is open: send create or load first.");
    return host;
  };
  const clock = (options?: WireHostOptions) => ({
    ...(options?.fixedNow !== undefined ? { now: () => options.fixedNow as number } : {}),
    ...(options?.timeZone ? { timeZone: options.timeZone } : {}),
  });

  port.addEventListener("message", (event) => {
    const req = event.data as WorkerRequest;
    if (!req || typeof req !== "object" || typeof req.id !== "number") return;
    try {
      let result: unknown = null;
      switch (req.method) {
        case "create":
          attach(
            SoloHost.create(
              req.config,
              pack(req.config.contentPack, req.content),
              clock(req.options),
            ),
          );
          break;
        case "load":
          attach(
            SoloHost.load(
              req.save,
              pack(migrateSave(req.save).config.contentPack, req.content),
              clock(req.options),
            ),
          );
          break;
        case "connect":
          result = need().connectNow();
          break;
        case "send":
          result = need().act(req.action);
          break;
        case "endDay":
          result = need().endDayNow();
          break;
        case "tick":
          result = need().tick();
          break;
        case "save":
          result = need().save();
          break;
        case "status":
          result = need().status();
          break;
        case "close":
          host?.close();
          host = null;
          break;
      }
      port.postMessage({ type: "reply", id: req.id, ok: true, result } satisfies WorkerMessage);
    } catch (error) {
      const e = error instanceof Error ? error : new Error(String(error));
      port.postMessage({
        type: "reply",
        id: req.id,
        ok: false,
        error: e.message,
        name: e.name,
        ...(typeof (e as { field?: unknown }).field === "string"
          ? { field: (e as unknown as { field: string }).field }
          : {}),
      } satisfies WorkerMessage);
    }
  });
}
