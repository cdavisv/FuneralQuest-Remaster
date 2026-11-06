import type { Hud, InjuryRow, KarmaBand } from "@fq/protocol";

/**
 * The Expanded HUD (docs/expanded-rules.md 11.1, 26). A Classic player's Hud has no money,
 * karma or rating, and draws exactly the Classic parchment; an Expanded one gets a ledger strip
 * of these chips.
 */
export function isExpandedHud(hud: Hud | undefined): hud is Hud {
  return hud !== undefined && hud.money !== undefined;
}

/**
 * The band of the karma axis a karma value falls in, from the engine's own scale
 * (`View.karmaScale`, docs/expanded-rules.md 8.3): nothing about where the bands lie is kept
 * here. Undefined until a View has sent the scale.
 */
export function bandAt(
  scale: readonly KarmaBand[] | undefined,
  karma: number,
): KarmaBand | undefined {
  const k = Math.round(karma);
  return scale?.find((b) => k >= b.min && k <= b.max);
}

/** Marker position on the evil to angelic axis, 0 to 1. */
export function karmaPosition(karma: number): number {
  return Math.min(1, Math.max(0, (karma - 1) / 99));
}

export type DebtLevel = "ok" | "soon" | "due" | "overdue";

/**
 * How worried to look about a loan, from the days the engine says are left (`Hud.debt.daysLeft`:
 * 0 is due today). Without it (an older server) nothing is claimed.
 */
export function debtLevel(daysLeft: number | undefined): DebtLevel {
  if (daysLeft === undefined) return "ok";
  if (daysLeft < 0) return "overdue";
  if (daysLeft === 0) return "due";
  return daysLeft <= 2 ? "soon" : "ok";
}

export type ChipId =
  | "turns"
  | "money"
  | "karma"
  | "rating"
  | "savings"
  | "debt"
  | "injuries"
  | "leads";

export interface HudChip {
  id: ChipId;
  value: number;
  /** Extra numbers a chip carries (the debt's due day and the days left to it). */
  due?: number;
  daysLeft?: number;
  /** The injuries behind the injuries chip. */
  injuries?: InjuryRow[];
  /** The karma band the player is in (the karma chip). */
  band?: KarmaBand;
  tone: "plain" | "good" | "warn" | "bad";
}

/** The chips to show, in order. Savings, injuries and leads appear only when they are not zero. */
export function hudChips(hud: Hud): HudChip[] {
  const chips: HudChip[] = [
    { id: "turns", value: hud.turns, tone: hud.turns <= 0 ? "bad" : "plain" },
  ];
  if (hud.money !== undefined) chips.push({ id: "money", value: hud.money, tone: "plain" });
  if (hud.karma !== undefined) {
    chips.push({
      id: "karma",
      value: hud.karma,
      tone: "plain",
      ...(hud.karmaPath ? { band: hud.karmaPath } : {}),
    });
  }
  if (hud.rating !== undefined) chips.push({ id: "rating", value: hud.rating, tone: "plain" });
  if (hud.savings !== undefined && hud.savings > 0) {
    chips.push({ id: "savings", value: hud.savings, tone: "good" });
  }
  if (hud.debt) {
    const level = debtLevel(hud.debt.daysLeft);
    chips.push({
      id: "debt",
      value: hud.debt.owed,
      due: hud.debt.due,
      ...(hud.debt.daysLeft !== undefined ? { daysLeft: hud.debt.daysLeft } : {}),
      tone: level === "ok" ? "warn" : "bad",
    });
  }
  if (hud.injuries !== undefined && hud.injuries > 0) {
    chips.push({
      id: "injuries",
      value: hud.injuries,
      tone: "warn",
      ...(hud.injuryList && hud.injuryList.length > 0 ? { injuries: hud.injuryList } : {}),
    });
  }
  if (hud.leads !== undefined && hud.leads > 0) {
    chips.push({ id: "leads", value: hud.leads, tone: "good" });
  }
  return chips;
}
