import { type ChildProcess, spawn } from "node:child_process";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import type { Transcript } from "./transcript.js";

/** The repository root (this file is tools/soak/src/serverProcess.ts). */
export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
export const SERVER_DIR = join(REPO, "apps/server");

/** A server log line (pino JSON). */
export interface LogLine {
  level: number;
  msg?: string;
  [key: string]: unknown;
}

/** Warnings the soak run causes on purpose; anything else at warn or above is a finding. */
const EXPECTED_WARNINGS: RegExp[] = [/^soak-test clock in use/];

export async function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const s = createServer();
    s.unref();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const address = s.address();
      const port = typeof address === "object" && address ? address.port : 0;
      s.close(() => resolvePort(port));
    });
  });
}

/**
 * The real server as a child process (`node --import tsx apps/server/src/main.ts`, one process,
 * so SIGKILL kills the server itself and not a wrapper). Every stdout and stderr line goes to the
 * transcript; warnings and errors are collected as findings.
 */
export class ServerProcess {
  private child: ChildProcess | null = null;
  private exited: Promise<number | null> = Promise.resolve(null);
  private readonly watchers = new Set<(line: LogLine) => void>();
  readonly problems: { at: number; line: LogLine | string }[] = [];
  starts = 0;
  kills = 0;

  constructor(
    readonly port: number,
    private env: Record<string, string>,
    private readonly transcript: Transcript,
  ) {}

  get baseUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  get wsUrl(): string {
    return `ws://127.0.0.1:${this.port}/api/ws`;
  }

  get pid(): number | undefined {
    return this.child?.pid;
  }

  /** Replaces environment entries for the next start (a fresh data directory after a restore). */
  setEnv(change: Record<string, string>): void {
    this.env = { ...this.env, ...change };
  }

  get dbPath(): string {
    return this.env.FQ_DB_PATH as string;
  }

  async start(): Promise<void> {
    if (this.child) throw new Error("server already running");
    const child = spawn(process.execPath, ["--import", "tsx", "src/main.ts"], {
      cwd: SERVER_DIR,
      env: { ...process.env, NODE_ENV: "test", ...this.env, FQ_PORT: String(this.port) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    this.child = child;
    this.starts++;
    // Never leave a server behind when the harness dies.
    const reap = () => child.kill("SIGKILL");
    process.once("exit", reap);
    child.once("exit", () => process.removeListener("exit", reap));
    let exitCode: number | null | undefined;
    this.exited = new Promise((done) =>
      child.on("exit", (code) => {
        exitCode = code;
        done(code);
      }),
    );
    const out = createInterface({ input: child.stdout as NodeJS.ReadableStream });
    out.on("line", (text) => this.onLine("stdout", text));
    const err = createInterface({ input: child.stderr as NodeJS.ReadableStream });
    err.on("line", (text) => this.onLine("stderr", text));
    const deadline = Date.now() + 60_000;
    for (;;) {
      if (exitCode !== undefined) {
        this.child = null;
        const tail = this.problems
          .slice(-5)
          .map((p) => (typeof p.line === "string" ? p.line : JSON.stringify(p.line)))
          .join("\n");
        throw new Error(`server exited (${exitCode}) while starting:\n${tail}`);
      }
      try {
        const r = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(1000) });
        if (r.ok) return;
      } catch {
        // not yet
      }
      if (Date.now() > deadline) throw new Error("server did not start within 60 s");
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  private onLine(stream: "stdout" | "stderr", text: string): void {
    let line: LogLine | string = text;
    try {
      const parsed = JSON.parse(text) as unknown;
      if (typeof parsed === "object" && parsed !== null && "level" in parsed) {
        line = parsed as LogLine;
      }
    } catch {
      // plain text
    }
    this.transcript.write({ kind: "log", stream, line });
    if (typeof line === "string") {
      if (line.trim() !== "") this.problems.push({ at: Date.now(), line });
      return;
    }
    if (line.level >= 40 && !EXPECTED_WARNINGS.some((re) => re.test(line.msg ?? ""))) {
      this.problems.push({ at: Date.now(), line });
    }
    for (const w of [...this.watchers]) w(line);
  }

  /** Resolves with the first log line matching `test` (from now on). */
  waitForLog(test: (line: LogLine) => boolean, timeoutMs = 120_000): Promise<LogLine> {
    return new Promise((resolveLine, reject) => {
      const timer = setTimeout(() => {
        this.watchers.delete(watch);
        reject(new Error("log line did not come"));
      }, timeoutMs);
      const watch = (line: LogLine) => {
        if (!test(line)) return;
        clearTimeout(timer);
        this.watchers.delete(watch);
        resolveLine(line);
      };
      this.watchers.add(watch);
    });
  }

  /** Calls `fn` on every log line until the returned function is called. */
  watch(fn: (line: LogLine) => void): () => void {
    this.watchers.add(fn);
    return () => this.watchers.delete(fn);
  }

  /** SIGKILL: no shutdown handler runs, nothing is flushed. */
  async kill(): Promise<void> {
    const child = this.child;
    if (!child) return;
    this.kills++;
    child.kill("SIGKILL");
    await this.exited;
    this.child = null;
  }

  /** SIGTERM and wait: the graceful shutdown. */
  async stop(): Promise<number | null> {
    const child = this.child;
    if (!child) return null;
    child.kill("SIGTERM");
    const code = await this.exited;
    this.child = null;
    return code;
  }

  /** Runs `node --import tsx src/main.ts <args>` (the backup, check and restore commands). */
  async command(
    args: string[],
    env: Record<string, string> = {},
  ): Promise<{ code: number | null; stdout: string; stderr: string }> {
    const child = spawn(process.execPath, ["--import", "tsx", "src/main.ts", ...args], {
      cwd: SERVER_DIR,
      env: { ...process.env, NODE_ENV: "test", ...this.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    const code = await new Promise<number | null>((done) => child.on("exit", done));
    this.transcript.write({ kind: "event", what: "command", data: { args, code, stdout, stderr } });
    return { code, stdout, stderr };
  }
}
