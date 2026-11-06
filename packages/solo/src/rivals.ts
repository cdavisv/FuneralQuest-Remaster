import {
  ALL_PERSONALITY_IDS,
  type Difficulty,
  PERSONALITY_IDS,
  type PersonalityId,
} from "@fq/bots/personalities";
import type { SoloRival } from "./types.js";

/**
 * A table of rivals for a new game: `count` of them (0 to 7), one personality each until the
 * personalities run out, in an order that depends on the seed, all at the chosen difficulty.
 * Pass `ruleset: "expanded"` for an Expanded game, which also seats the Expanded-only
 * personalities (the Classic six come first in the table only by chance of the shuffle).
 */
export function chooseRivals(
  count: number,
  difficulty: Difficulty,
  seed: number,
  ruleset: "classic" | "original" | "expanded" = "classic",
): SoloRival[] {
  const ids: PersonalityId[] = [
    ...(ruleset === "expanded" ? ALL_PERSONALITY_IDS : PERSONALITY_IDS),
  ];
  // A small seeded shuffle (mulberry32), so the same seed gives the same table.
  let state = seed >>> 0 || 1;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [ids[i], ids[j]] = [ids[j] as PersonalityId, ids[i] as PersonalityId];
  }
  const n = Math.max(0, Math.min(7, Math.floor(count)));
  return Array.from({ length: n }, (_, i) => ({
    personality: ids[i % ids.length] as PersonalityId,
    difficulty,
  }));
}
