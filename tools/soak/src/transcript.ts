import { createWriteStream, type WriteStream } from "node:fs";
import { createGzip, type Gzip } from "node:zlib";

/**
 * Everything the soak run saw, one JSON object per line, gzip-compressed: every action sent and
 * the answer, every push message, every server log line, every admin call, every check. `t` is
 * real milliseconds since the run started, `g` the game time the server's clock showed.
 */
export type Entry =
  | { kind: "action"; player: string; action: unknown; status: number; ms: number; body: unknown }
  | {
      kind: "http";
      player: string;
      method: string;
      path: string;
      status: number;
      ms: number;
      body: unknown;
    }
  | { kind: "push"; player: string; message: unknown }
  | { kind: "socket"; player: string; event: string; code?: number }
  | { kind: "log"; stream: "stdout" | "stderr"; line: unknown }
  | { kind: "admin"; method: string; path: string; status: number; ms: number; body: unknown }
  | { kind: "event"; what: string; data?: unknown }
  | { kind: "check"; name: string; ok: boolean; detail?: unknown };

export class Transcript {
  private readonly gzip: Gzip;
  private readonly file: WriteStream;
  private readonly started = Date.now();
  readonly counts = new Map<string, number>();
  private closed = false;

  constructor(
    path: string,
    private readonly gameNow: () => number,
  ) {
    this.gzip = createGzip({ level: 4 });
    this.file = createWriteStream(path);
    this.gzip.pipe(this.file);
  }

  write(entry: Entry): void {
    if (this.closed) return;
    this.counts.set(entry.kind, (this.counts.get(entry.kind) ?? 0) + 1);
    this.gzip.write(
      `${JSON.stringify({ t: Date.now() - this.started, g: this.gameNow(), ...entry })}\n`,
    );
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await new Promise<void>((resolve, reject) => {
      this.file.on("finish", () => resolve());
      this.file.on("error", reject);
      this.gzip.end();
    });
  }
}
