import type { BingoPanel } from "@fq/protocol";

/**
 * Bingo Night (docs/expanded-rules.md 17.1, 11.5): `View.bingo` carries the pot, the carry-over,
 * the card price, which of the numbered cards are sold to anyone and which are the player's, and
 * when the draw happens. The sheet is drawn from it; nothing is read from the text.
 */
export type CellState = "mine" | "taken" | "free";

export function bingoCells(bingo: BingoPanel): { n: number; state: CellState }[] {
  return Array.from({ length: bingo.cards }, (_, i) => {
    const n = i + 1;
    return {
      n,
      state: bingo.mine.includes(n) ? "mine" : bingo.taken.includes(n) ? "taken" : "free",
    };
  });
}

/** Cards still for sale. */
export function cardsLeft(bingo: BingoPanel): number {
  return Math.max(0, bingo.cards - bingo.taken.length);
}

/** When the winning card is drawn. */
export type DrawWhen = "cancelled" | "tonight" | "later";
export function drawWhen(bingo: BingoPanel): DrawWhen {
  if (!bingo.open) return "cancelled";
  return bingo.daysLeft <= 0 ? "tonight" : "later";
}
