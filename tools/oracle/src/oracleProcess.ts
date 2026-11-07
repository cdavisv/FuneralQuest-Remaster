import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface, type Interface } from "node:readline";
import { BINARY, LEGACY_DIST_DIR } from "../scripts/config.js";
import type { OracleReply } from "./oracle.js";

/**
 * The oracle as a long-running process: one command in, one JSON line out.
 * Used where the next request depends on the last response (pressing a
 * button means sending the command number that response gave it).
 */
export class OracleProcess {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly lines: Interface;
  private readonly waiting: ((line: string) => void)[] = [];
  private readonly buffered: string[] = [];
  private stderr = "";
  private exited: string | null = null;
  readonly scratch: string;

  constructor() {
    const base = join(tmpdir(), "fq-oracle");
    mkdirSync(base, { recursive: true });
    this.scratch = mkdtempSync(join(base, "run-"));
    this.child = spawn(BINARY, [], {
      env: {
        ...process.env,
        TZ: "UTC",
        FQ_ORACLE_CONTENT: LEGACY_DIST_DIR,
        FQ_ORACLE_SCRATCH: this.scratch,
      },
    });
    this.child.stderr.on("data", (d: Buffer) => {
      this.stderr = (this.stderr + d.toString("utf8")).slice(-4000);
    });
    this.child.on("exit", (code, signal) => {
      this.exited = `fq-oracle exited (${code ?? signal}): ${this.stderr}`;
      for (const w of this.waiting.splice(0)) w("");
    });
    this.lines = createInterface({ input: this.child.stdout });
    this.lines.on("line", (line) => {
      const next = this.waiting.shift();
      if (next) next(line);
      else this.buffered.push(line);
    });
  }

  /** Sends one command and waits for its reply line. */
  async send(command: string): Promise<OracleReply> {
    if (this.exited) throw new Error(this.exited);
    this.child.stdin.write(`${command}\n`);
    const line = await new Promise<string>((done) => {
      const ready = this.buffered.shift();
      if (ready !== undefined) done(ready);
      else this.waiting.push(done);
    });
    if (!line) throw new Error(this.exited ?? `no reply to ${command}`);
    const reply = JSON.parse(line) as OracleReply;
    if (reply.error) throw new Error(`oracle: ${reply.error}`);
    return reply;
  }

  close(): void {
    if (!this.exited) this.child.stdin.end("quit\n");
    this.lines.close();
    rmSync(this.scratch, { recursive: true, force: true });
  }
}
