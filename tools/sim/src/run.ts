import { availableParallelism } from "node:os";
import { Worker } from "node:worker_threads";
import { ALL_PERSONALITY_IDS, DIFFICULTIES } from "@fq/bots";
import { simContent } from "./content.js";
import type { TownReport } from "./metrics.js";
import { buildReport, type SimReport } from "./report.js";
import { type ChallengeRun, runChallenge, type SimOptions, simulateTown } from "./town.js";

export interface RunOptions {
  /** Worker threads (0 runs every town in this thread). Default: cores - 1, at most one per town. */
  workers?: number;
  onTown?: (done: number, total: number) => void;
}

/** Plays every town and builds the report. */
export async function runSimulation(options: SimOptions, run: RunOptions = {}): Promise<SimReport> {
  const started = Date.now();
  const workers = Math.min(options.towns, run.workers ?? Math.max(1, availableParallelism() - 1));
  let reports: TownReport[];
  if (workers <= 0) {
    const content = simContent(options.rules);
    reports = [];
    for (let i = 0; i < options.towns; i++) {
      reports.push(simulateTown(i, options, content));
      run.onTown?.(i + 1, options.towns);
    }
  } else {
    reports = await inWorkers(options, workers, run);
  }
  reports.sort((a, b) => a.seed - b.seed);
  const challenge: ChallengeRun[] = [];
  if (options.rules === "expanded") {
    const content = simContent(options.rules);
    const n = options.challenges ?? 6;
    for (let i = 0; i < n; i++) {
      for (const p of options.personalities ?? ALL_PERSONALITY_IDS) {
        for (const d of DIFFICULTIES)
          challenge.push(runChallenge(`sim-${options.seed}-${i}`, p, d, content));
      }
    }
  }
  return buildReport(options, reports, Date.now() - started, challenge);
}

function inWorkers(options: SimOptions, count: number, run: RunOptions): Promise<TownReport[]> {
  const queue = Array.from({ length: options.towns }, (_, i) => i);
  const out: TownReport[] = [];
  let done = 0;
  return new Promise((resolve, reject) => {
    let live = 0;
    const start = () => {
      const worker = new Worker(new URL("./worker.ts", import.meta.url), {
        execArgv: ["--import", "tsx"],
        workerData: { options },
      });
      live++;
      const feed = () => {
        const next = queue.shift();
        if (next === undefined) void worker.terminate();
        else worker.postMessage(next);
      };
      worker.on("message", (report: TownReport) => {
        out.push(report);
        done++;
        run.onTown?.(done, options.towns);
        feed();
      });
      worker.on("error", reject);
      worker.on("exit", () => {
        live--;
        if (live === 0) {
          if (out.length === options.towns) resolve(out);
          else reject(new Error(`Only ${out.length} of ${options.towns} towns finished`));
        }
      });
      feed();
    };
    for (let i = 0; i < count; i++) start();
  });
}
