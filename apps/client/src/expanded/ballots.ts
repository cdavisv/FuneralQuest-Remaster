import type { BallotOption, BallotPanel } from "@fq/protocol";

/**
 * City Hall's ballots (docs/expanded-rules.md 18.3, 18.4, 11.5): the ordinance in force, the open
 * ordinance ballot with the player's vote, and the mayoral election. The panel is complete on
 * every City Hall screen; these helpers only sort and total what it says.
 */
export type Election = BallotPanel["election"];
export type Candidate = Election["candidates"][number];

/** Votes cast on the open ordinance ballot (options whose votes the rules hide count as 0). */
export function totalVotes(options: readonly BallotOption[]): number {
  return options.reduce((sum, o) => sum + (o.votes ?? 0), 0);
}

/** The option or candidate ahead, or undefined on a tie or before any vote. */
export function leader<T extends { votes?: number | undefined }>(
  items: readonly T[],
): T | undefined {
  let best: T | undefined;
  let tied = false;
  for (const item of items) {
    const v = item.votes ?? 0;
    if (v <= 0) continue;
    if (!best || v > (best.votes ?? 0)) {
      best = item;
      tied = false;
    } else if (v === (best.votes ?? 0)) tied = true;
  }
  return tied ? undefined : best;
}

/** Which of the open ballots the player has not voted in: the hall's call to action. */
export function ordinanceNeedsVote(ballots: BallotPanel): boolean {
  return ballots.ordinance !== undefined && ballots.ordinance.myVote === null;
}

/** The election's candidates, most votes (then most ads) first. */
export function rankedCandidates(election: Election): Candidate[] {
  return [...election.candidates].sort(
    (a, b) => (b.votes ?? 0) - (a.votes ?? 0) || b.ads - a.ads || a.name.localeCompare(b.name),
  );
}
