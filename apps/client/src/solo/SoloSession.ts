import type { Action, View } from "@fq/protocol";
import type { Notice, SaveStorage, SoloWorkerClient } from "@fq/solo/client";
import type { LiveTransport, Unsubscribe } from "../transport/types.js";

/** How long after the last change a save is written. */
export const AUTOSAVE_DELAY_MS = 800;

/**
 * Keeps one save slot up to date. `touch` is called after anything that changes the game and
 * writes the slot a moment later (so a burst of clicks is one write); `flush` writes it now,
 * which is what a hidden tab, a leaving page and the end of a day do. Writes never overlap.
 */
export class Autosaver {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private chain: Promise<void> = Promise.resolve();
  private dirty = false;
  private disposed = false;
  /** The last write's failure, if any (a full disk, blocked storage); cleared by the next success. */
  failure: Error | null = null;

  constructor(
    private readonly client: SoloWorkerClient,
    private readonly storage: SaveStorage,
    readonly slot: string,
    private readonly delayMs = AUTOSAVE_DELAY_MS,
    private readonly onFailure: (error: Error | null) => void = () => {},
  ) {}

  touch(): void {
    if (this.disposed) return;
    this.dirty = true;
    if (this.timer !== null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.delayMs);
  }

  /** Writes the slot now (when anything changed, or when `force`). Resolves when it is stored. */
  flush(force = false): Promise<void> {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.dirty && !force) return this.chain;
    this.dirty = false;
    this.chain = this.chain.then(async () => {
      try {
        const save = await this.client.save();
        await this.storage.write(this.slot, save);
        if (this.failure) {
          this.failure = null;
          this.onFailure(null);
        }
      } catch (error) {
        this.failure = error instanceof Error ? error : new Error(String(error));
        this.onFailure(this.failure);
      }
    });
    return this.chain;
  }

  /** Writes anything pending and stops. */
  async dispose(): Promise<void> {
    await this.flush();
    this.disposed = true;
  }
}

/**
 * The game's `Transport` over a Solo worker. `close` does nothing by itself (the worker keeps
 * the game until the page ends it), so React mounting the game twice or reconnecting never
 * drops listeners; every answered action touches the autosaver.
 */
export class SoloSession implements LiveTransport {
  private readonly pushListeners = new Set<(view: View) => void>();
  private readonly noticeListeners = new Set<(notice: Notice) => void>();
  private readonly detach: Unsubscribe[];

  constructor(
    private readonly client: SoloWorkerClient,
    private readonly saver: Autosaver,
  ) {
    this.detach = [
      client.onPush((view) => {
        saver.touch();
        for (const l of [...this.pushListeners]) l(view);
      }),
      client.onNotice((notice) => {
        for (const l of [...this.noticeListeners]) l(notice);
      }),
    ];
  }

  async connect(): Promise<View> {
    const view = await this.client.connect();
    this.saver.touch();
    return view;
  }

  async send(action: Action): Promise<View> {
    const view = await this.client.send(action);
    // The End the Day button is an ordinary press: a whole night of rival turns happens in
    // the worker, and the new day is stored at once rather than after the debounce.
    this.saver.touch();
    if (action.type === "press" && action.buttonId.startsWith("solo:")) void this.saver.flush();
    return view;
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

  close(): void {
    // The game lives in the worker; leaving is `dispose`'s job.
  }

  /** Saves, then ends the worker. */
  async dispose(): Promise<void> {
    for (const off of this.detach) off();
    await this.saver.dispose();
    this.client.terminate();
  }
}
