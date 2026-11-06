import type { MoodTier } from "../components/Icons.js";

/**
 * Picks a face for a customer's mood. The server sends the number behind the word
 * (`moodLevel`, 0 to 10, where 10 or more walks out), so the face follows it directly:
 * calm below 3, uneasy to 5, annoyed to 8, angry from 8, the same bands as the original's
 * mood words (Chipper to Natural, Tight Lipped and Nervous, Frustrated to Irked, Angry and
 * Pissed). Without a level (an older server) the word is grouped instead, and an unknown
 * word, including those of future rulesets, shows the neutral face.
 */
const TIERS: Record<string, MoodTier> = {
  chipper: 0,
  natural: 0,
  "in a hurry": 0,
  "in shock": 1,
  dazed: 1,
  confused: 1,
  crying: 1,
  numb: 1,
  "tight lipped": 1,
  nervous: 1,
  disturbed: 2,
  frustrated: 2,
  annoyed: 2,
  irked: 2,
  angry: 3,
  pissed: 3,
};

export function moodTierForLevel(level: number): MoodTier {
  if (!Number.isFinite(level) || level < 0) return 1;
  if (level < 3) return 0;
  if (level < 5) return 1;
  if (level < 8) return 2;
  return 3;
}

export function moodTier(label: string, level?: number): MoodTier {
  if (typeof level === "number" && Number.isFinite(level)) return moodTierForLevel(level);
  return TIERS[label.trim().toLowerCase()] ?? 1;
}
