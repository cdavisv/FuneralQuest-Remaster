/**
 * Runs the real Web Worker entry (`src/worker.ts`) inside a Node
 * `worker_threads` Worker: the worker's global `postMessage` and
 * `addEventListener("message")` are mapped onto `parentPort` first.
 */
import { parentPort } from "node:worker_threads";

const port = parentPort;
if (!port) throw new Error("nodeWorker.ts must run in a worker thread");
Object.assign(globalThis, {
  postMessage: (message: unknown) => port.postMessage(message),
  addEventListener: (type: string, listener: (event: { data: unknown }) => void) => {
    if (type === "message") port.on("message", (data: unknown) => listener({ data }));
  },
});
await import("../src/worker.js");
