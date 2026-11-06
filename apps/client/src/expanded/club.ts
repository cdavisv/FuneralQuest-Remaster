import type { Button, ClubPanel } from "@fq/protocol";

/**
 * The Reaper Club's back tables (docs/expanded-rules.md 20.2): one card per game and stake, ids
 * `reaper-club:<game>:<stake>`. The client groups the cards by game so the stakes read as a row
 * under each game's name. The round just played is `View.club.lastRound` (game, stake, outcome,
 * payout, net), drawn as a result of its own for each game.
 */
export interface GameRow {
  game: string;
  cards: { button: Button; index: number; stake: number }[];
}

export const GAMES = ["draw", "slots", "shots"] as const;

export function gameRows(buttons: Button[]): GameRow[] {
  const rows = new Map<string, GameRow>();
  buttons.forEach((button, index) => {
    const m = /^reaper-club:(draw|slots|shots):(\d+)$/.exec(button.id);
    if (!m?.[1] || !m[2]) return;
    const row = rows.get(m[1]) ?? { game: m[1], cards: [] };
    row.cards.push({ button, index, stake: Number(m[2]) });
    rows.set(m[1], row);
  });
  return GAMES.flatMap((g) => {
    const row = rows.get(g);
    return row ? [row] : [];
  });
}

export type Round = NonNullable<ClubPanel["lastRound"]>;

/** The result's words come from the outcome and the sign of the net, never from the engine's text. */
export function roundKind(round: Round): "win" | "push" | "lose" | "even" {
  if (round.outcome === "push" && round.net === 0) return "even";
  return round.outcome;
}
