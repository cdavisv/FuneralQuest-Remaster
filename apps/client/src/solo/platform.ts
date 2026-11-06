import {
  IndexedDbSaveStorage,
  type SaveStorage,
  SoloWorkerClient,
  type WorkerLike,
} from "@fq/solo/client";

/**
 * What Solo mode needs from the browser, in one object so tests can swap it: where saves live,
 * how a game worker is started, and the page-lifecycle events that trigger a final save.
 */
export interface SoloPlatform {
  storage: SaveStorage;
  /** Starts a fresh worker with its own game. */
  createWorker(): WorkerLike;
  /** A random seed for a new game. */
  newSeed(): number;
  now(): number;
}

export function browserSoloPlatform(): SoloPlatform {
  return {
    storage: new IndexedDbSaveStorage(),
    createWorker: () =>
      new Worker(new URL("./soloWorker.ts", import.meta.url), {
        type: "module",
        name: "funeral-quest-solo",
      }),
    newSeed: () => crypto.getRandomValues(new Uint32Array(1))[0] ?? Date.now() % 2 ** 32,
    now: () => Date.now(),
  };
}

export function createSoloClient(platform: SoloPlatform): SoloWorkerClient {
  return new SoloWorkerClient(platform.createWorker());
}
