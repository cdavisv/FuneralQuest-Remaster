/**
 * The practice Daily Challenge's date for a moment: the local calendar day at the player's offset
 * from UTC (minutes, east positive), as "YYYY-MM-DD". Pass it as `SoloConfig.challengeDay`.
 * (The same machine on the same local day gets the same practice challenge.)
 */
export function practiceDay(now: number, utcOffsetMinutes = 0): string {
  return new Date(now + utcOffsetMinutes * 60_000).toISOString().slice(0, 10);
}
