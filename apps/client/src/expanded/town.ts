import type { TownPanel } from "@fq/protocol";

/**
 * The town strip (docs/expanded-rules.md 26): weather, today's news, the ordinance in force, the
 * mayor, the running story and a badge for each ballot the player has not voted on. Each item
 * carries its effect as a tooltip.
 */
export type StripKind = "weather" | "news" | "ordinance" | "mayor" | "story";

export interface StripItem {
  kind: StripKind;
  /** The id the engine gave (a weather id picks its icon). */
  id: string;
  label: string;
  /** The effect, for the tooltip. */
  effect: string | undefined;
}

export interface BallotBadge {
  kind: "ordinance" | "election";
  closes: number;
  voted: boolean;
  /** Voting days left after today (0 = closes tonight), from the engine. */
  daysLeft?: number | undefined;
}

export function stripItems(town: TownPanel): StripItem[] {
  const items: StripItem[] = [];
  if (town.weather) {
    items.push({
      kind: "weather",
      id: town.weather.id,
      label: town.weather.label,
      effect: town.weather.effect,
    });
  }
  if (town.news) {
    items.push({
      kind: "news",
      id: town.news.id,
      label: town.news.title,
      effect: town.news.effect,
    });
  }
  if (town.ordinance) {
    items.push({
      kind: "ordinance",
      id: town.ordinance.id,
      label: town.ordinance.title,
      effect: town.ordinance.effect,
    });
  }
  if (town.mayor) items.push({ kind: "mayor", id: "mayor", label: town.mayor, effect: undefined });
  if (town.story) items.push({ kind: "story", id: "story", label: town.story, effect: undefined });
  return items;
}

/** The ballots the player has not voted on: each earns a "vote" badge. */
export function openBallots(town: TownPanel): BallotBadge[] {
  return (town.ballots ?? []).filter((b) => !b.voted);
}

/** True when the ballot closes tonight or tomorrow, by the engine's own count. */
export function closingSoon(ballot: BallotBadge): boolean {
  return ballot.daysLeft !== undefined && ballot.daysLeft <= 1;
}

/** True when the panel has anything to show. */
export function stripHasContent(town: TownPanel): boolean {
  return stripItems(town).length > 0 || (town.ballots?.length ?? 0) > 0;
}
