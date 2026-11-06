import type { BankPanel } from "@fq/protocol";

/**
 * The bank (docs/expanded-rules.md 21, 11.5). `View.bank` is complete on every bank screen:
 * savings with tonight's interest, the loan's terms (shown before borrowing) and the debt, and the
 * tag-transfer limits. The sheet shows what the engine says; it works out no interest or fee of
 * its own, so a changed rule shows up the moment the engine sends it.
 */
export type BankFocus = "all" | "savings" | "loan" | "transfers";

/** Which part of the bank the screen is about, from its buttons; the main screen shows all. */
export function bankFocus(ids: readonly string[]): BankFocus {
  if (ids.some((id) => id === "bank:borrow" || id === "bank:repay")) return "loan";
  if (ids.some((id) => id.startsWith("bank:deposit") || id.startsWith("bank:withdraw")))
    return "savings";
  if (ids.some((id) => id === "bank:transfer")) return "transfers";
  return "all";
}

/** A share as a percentage without a trailing zero: 0.002 is "0.2", 0.03 is "3". */
export function percent(share: number): string {
  return String(Math.round(share * 10000) / 100);
}

export function hasLoan(bank: BankPanel): boolean {
  return bank.loan.owed !== undefined && bank.loan.owed > 0;
}

/** Share of today's transfer allowance already used, 0 to 1. */
export function transferUsed(bank: BankPanel): number {
  const max = bank.transfers.dailyMax;
  return max > 0 ? Math.min(1, bank.transfers.sent / max) : 0;
}
