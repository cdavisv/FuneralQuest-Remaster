/**
 * The audio ids the client knows, without any of the code that makes them (so the page can
 * import this for free). A test checks these lists against the catalog.
 */
export type TrackKind = "music" | "stinger" | "ambience" | "sfx" | "ui";

export const MUSIC = [
  "main",
  "town",
  "desk",
  "negotiation",
  "ceremony",
  "cafe",
  "yangs",
  "dimart",
  "university",
  "bank",
  "hospital",
  "sneak",
  "battle",
  "graveyard",
  "cityhall",
  "club",
  "meteor",
] as const;
export type MusicId = (typeof MUSIC)[number];

export const STINGERS = ["main-stinger", "victory", "defeat", "newday", "endday"] as const;
export type StingerId = (typeof STINGERS)[number];

export const AMBIENCE = [
  "amb-clock",
  "amb-wind",
  "amb-night",
  "amb-birds",
  "amb-monitor",
  "amb-hospital",
  "amb-bubbles",
  "amb-fire",
  "amb-fogbell",
  "amb-rain",
  "amb-storm",
  "amb-kitchen",
  "amb-street",
] as const;
export type AmbienceId = (typeof AMBIENCE)[number];

export const EFFECTS_IDS = [
  "cash-register",
  "coins",
  "casket-thump",
  "door",
  "walkout",
  "doorbell",
  "lockpick",
  "padlock-break",
  "punch",
  "slap",
  "gong",
  "harp-good-news",
  "fail-trombone",
  "fanfare-exact",
  "bingo-ball",
  "bingo-win",
  "bingo-lose",
  "dice",
  "cards",
  "slot-machine",
  "thunder",
  "rain-hit",
  "level-up",
  "toilet-flush",
  "glint",
  "growl",
  "angelic",
  "siren",
  "psychic",
  "alarm-bell",
  "rattle",
  "safe-click",
  "monument",
] as const;

export const UI_IDS = [
  "ui-click",
  "ui-hover",
  "ui-page",
  "ui-notepad",
  "ui-chat",
  "ui-coin",
  "ui-tag",
  "ui-stamp",
  "ui-mail",
] as const;
export type UiId = (typeof UI_IDS)[number];

/** A one-shot: a stinger, a game effect or a UI sound. */
export type SoundId = StingerId | (typeof EFFECTS_IDS)[number] | UiId;

/** The music with intensity stems: the negotiation's three layers. */
export const LAYERED: Partial<Record<MusicId, number>> = { negotiation: 3 };

/**
 * Stem gains for the negotiation from the customer's mood (0 to 10, 10 walks out). The mood
 * bands follow the client's face: calm below 3, uneasy to 5, annoyed to 8, angry from 8.
 * Continuous, so a small change in mood is a small change in sound.
 */
export function moodLayers(mood: number): [number, number, number] {
  const m = Math.max(0, Math.min(10, mood));
  const ramp = (lo: number, hi: number) => Math.max(0, Math.min(1, (m - lo) / (hi - lo)));
  return [1, ramp(2, 4), ramp(5, 8)];
}
