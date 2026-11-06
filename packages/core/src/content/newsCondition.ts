import type { TownState } from "../state/types.js";

/**
 * When a news story or front-page blurb may run (docs/expanded-rules.md 22.5):
 * what the town's story arcs came to this season, and whether there is a
 * mayor. Expanded towns only; Classic never reads it. Every listed part must
 * hold; an absent condition always holds.
 */
export interface NewsCondition {
  /** Arcs that must have ended this season; with `endings`, in one of those endings. */
  arcs?: { id: string; endings?: string[] }[];
  /** Arcs that must not have ended this season (still running, or not played). */
  notArcs?: string[];
  /** true: only while an elected player is mayor; false: only while there is none. */
  mayor?: boolean;
}

/** Whether `when` holds in `town` (reads only `town.expanded.life`). */
export function newsConditionMet(town: TownState, when: NewsCondition | undefined): boolean {
  if (!when) return true;
  const life = town.expanded?.life;
  const done = life?.arcsDone ?? [];
  for (const need of when.arcs ?? []) {
    const ended = done.find((d) => d.id === need.id);
    if (!ended) return false;
    if (need.endings && need.endings.length > 0 && !need.endings.includes(ended.ending))
      return false;
  }
  for (const id of when.notArcs ?? []) if (done.some((d) => d.id === id)) return false;
  if (when.mayor !== undefined) {
    const id = life?.election.mayor;
    const hasMayor = id !== null && id !== undefined && town.players[id]?.active === true;
    if (hasMayor !== when.mayor) return false;
  }
  return true;
}
