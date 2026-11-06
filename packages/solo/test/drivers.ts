import { Worker } from "node:worker_threads";
import { classicPack } from "@fq/content";
import type { ContentPack } from "@fq/core";
import type { Action, View } from "@fq/protocol";
import {
  type Notice,
  type SoloConfig,
  SoloHost,
  type SoloSave,
  type SoloStatus,
  SoloWorkerClient,
} from "../src/index.js";

/** The built-in Classic pack. */
export function testContent(): ContentPack {
  return classicPack;
}

/** One way of running a Solo game: the host directly, or through the worker proxy. */
export interface Driver {
  readonly name: string;
  create(config: SoloConfig, fixedNow: number): Promise<void>;
  load(save: SoloSave, fixedNow: number): Promise<void>;
  connect(): Promise<View>;
  send(action: Action): Promise<View>;
  endDay(): Promise<View>;
  tick(): Promise<boolean>;
  save(): Promise<SoloSave>;
  status(): Promise<SoloStatus>;
  readonly notices: Notice[];
  readonly pushes: View[];
  dispose(): Promise<void>;
}

export function directDriver(): Driver {
  let host: SoloHost | null = null;
  const notices: Notice[] = [];
  const pushes: View[] = [];
  const need = () => {
    if (!host) throw new Error("no game");
    return host;
  };
  const attach = (h: SoloHost) => {
    host = h;
    h.onNotice((n) => notices.push(n));
    h.onPush((v) => pushes.push(v));
  };
  return {
    name: "direct host",
    notices,
    pushes,
    async create(config, fixedNow) {
      attach(SoloHost.create(config, testContent(), { now: () => fixedNow }));
    },
    async load(save, fixedNow) {
      attach(SoloHost.load(save, testContent(), { now: () => fixedNow }));
    },
    connect: () => need().connect(),
    send: (a) => need().send(a),
    endDay: () => need().endDay(),
    tick: async () => need().tick(),
    save: async () => need().save(),
    status: async () => need().status(),
    async dispose() {
      host?.close();
    },
  };
}

/** The worker proxy talking to `src/worker.ts` in a real Node worker thread. */
export function workerDriver(): Driver {
  const worker = new Worker(new URL("./nodeWorker.ts", import.meta.url), {
    execArgv: ["--import", "tsx"],
  });
  const port = {
    postMessage: (m: unknown) => worker.postMessage(m),
    addEventListener: (_type: "message", listener: (event: { data: unknown }) => void) => {
      worker.on("message", (data: unknown) => listener({ data }));
    },
    terminate: () => {
      void worker.terminate();
    },
  };
  const client = new SoloWorkerClient(port);
  const notices: Notice[] = [];
  const pushes: View[] = [];
  client.onNotice((n) => notices.push(n));
  client.onPush((v) => pushes.push(v));
  return {
    name: "worker proxy (Node worker_threads)",
    notices,
    pushes,
    create: (config, fixedNow) => client.create(config, undefined, { fixedNow }),
    load: (save, fixedNow) => client.load(save, undefined, { fixedNow }),
    connect: () => client.connect(),
    send: (a) => client.send(a),
    endDay: () => client.endDay(),
    tick: () => client.tick(),
    save: () => client.save(),
    status: () => client.status(),
    async dispose() {
      client.close();
      await worker.terminate();
    },
  };
}
