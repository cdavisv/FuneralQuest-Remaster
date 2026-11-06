/**
 * A small in-memory window of recent cafe lines, kept for exactly one purpose: when a player
 * reports a cafe line, the lines around it are copied into the report as evidence, because the
 * engine never stores chat. The buffer is bounded (lines per town, age), lives only in memory,
 * and is never written to disk unless a report captures part of it.
 */

export interface BufferedLine {
  at: number;
  /** The line as shown, as plain text. */
  text: string;
  /** Who the engine action that produced it belonged to (the speaker, or the player who arrived). */
  senderPlayerId: number | null;
  senderAccountId: number | null;
  senderName: string | null;
  /** Players who were sent the line, the speaker included. */
  recipients: ReadonlySet<number>;
}

/** One line of a report's evidence. */
export interface EvidenceLine {
  at: number;
  from: string | null;
  text: string;
  /** True for the line that was reported. */
  reported?: boolean;
}

export class ChatBuffer {
  private readonly towns = new Map<string, BufferedLine[]>();

  constructor(
    private readonly maxLines: number,
    private readonly maxAgeMs: number,
  ) {}

  record(townId: string, line: BufferedLine): void {
    let lines = this.towns.get(townId);
    if (!lines) {
      lines = [];
      this.towns.set(townId, lines);
    }
    lines.push(line);
    this.trim(lines, line.at);
  }

  private trim(lines: BufferedLine[], now: number): void {
    const cutoff = now - this.maxAgeMs;
    let drop = 0;
    while (drop < lines.length && (lines[drop] as BufferedLine).at < cutoff) drop++;
    if (lines.length - drop > this.maxLines) drop = lines.length - this.maxLines;
    if (drop > 0) lines.splice(0, drop);
  }

  size(townId: string): number {
    return this.towns.get(townId)?.length ?? 0;
  }

  /**
   * The newest line `receiver` was sent whose text is `text` (ignoring surrounding space), and,
   * when `speaker` is given, that this player said (the line's own data, so two players saying
   * the same words are told apart).
   */
  find(
    townId: string,
    receiver: number,
    text: string,
    now: number,
    speaker?: number,
  ): BufferedLine | null {
    const lines = this.towns.get(townId);
    if (!lines) return null;
    this.trim(lines, now);
    const wanted = text.trim();
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i] as BufferedLine;
      if (
        line.text.trim() === wanted &&
        line.recipients.has(receiver) &&
        (speaker === undefined || line.senderPlayerId === speaker)
      ) {
        return line;
      }
    }
    return null;
  }

  /**
   * The lines around `anchor` that `receiver` could see: up to `before` earlier and `after` later.
   * The anchor is marked.
   */
  window(
    townId: string,
    receiver: number,
    anchor: BufferedLine,
    before: number,
    after: number,
  ): EvidenceLine[] {
    const seen = (this.towns.get(townId) ?? []).filter((l) => l.recipients.has(receiver));
    const at = seen.indexOf(anchor);
    if (at === -1) return [];
    return seen.slice(Math.max(0, at - before), at + after + 1).map((l) => ({
      at: l.at,
      from: l.senderName,
      text: l.text,
      ...(l === anchor ? { reported: true } : {}),
    }));
  }

  /** Forgets everything a deleted account wrote. */
  purgeAccount(accountId: number): void {
    for (const lines of this.towns.values()) {
      for (let i = lines.length - 1; i >= 0; i--) {
        if ((lines[i] as BufferedLine).senderAccountId === accountId) lines.splice(i, 1);
      }
    }
  }

  clearTown(townId: string): void {
    this.towns.delete(townId);
  }
}
