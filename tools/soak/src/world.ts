import type { Checks } from "./checks.js";
import type { Transcript } from "./transcript.js";

/**
 * A pause point the players pass before every request. The run closes it to stop play (before a
 * planned kill, a checkpoint or a restore), waits until no request is in flight, and opens it again.
 * While the server is down it stays closed, so players wait for it instead of failing.
 */
export class Gate {
  private waiting: (() => void)[] = [];
  private closedReasons = new Set<string>();
  inFlight = 0;
  private idle: (() => void)[] = [];

  get open(): boolean {
    return this.closedReasons.size === 0;
  }

  close(reason: string): void {
    this.closedReasons.add(reason);
  }

  release(reason: string): void {
    this.closedReasons.delete(reason);
    if (this.open) {
      const w = this.waiting;
      this.waiting = [];
      for (const fn of w) fn();
    }
  }

  async pass(): Promise<void> {
    while (!this.open) await new Promise<void>((r) => this.waiting.push(r));
  }

  begin(): void {
    this.inFlight++;
  }

  end(): void {
    this.inFlight--;
    if (this.inFlight === 0) {
      const w = this.idle;
      this.idle = [];
      for (const fn of w) fn();
    }
  }

  /** Resolves when no request is in flight. */
  async drained(): Promise<void> {
    while (this.inFlight > 0) await new Promise<void>((r) => this.idle.push(r));
  }
}

export interface Secret {
  owner: string;
  kind: "token" | "email" | "login" | "letter";
  maxOthers: number;
  seenBy: Set<string>;
}

/** Things every player shares: the transcript, the checks, the gate, and who owns which secret. */
export interface World {
  transcript: Transcript;
  checks: Checks;
  gate: Gate;
  /**
   * Private strings (an e-mail, a log-in name, a token, a letter's tag), whose they are, and how
   * many other players may see them (0; a letter's one reader).
   */
  secrets: Map<string, Secret>;
  /** Announcements typed, to find in the paper: text and the game day. */
  announcements: { player: string; text: string; day: number }[];
  baseUrl: () => string;
  wsUrl: () => string;
  townId: string;
  /** The server's game time (ms), from the shared clock settings. */
  gameNow: () => number;
  /** The game day the run believes it is. */
  day: () => number;
  /** Players that may legitimately be out of the game right now, and why (kick, ban, reset...). */
  expectedOut: Map<string, string>;
}
