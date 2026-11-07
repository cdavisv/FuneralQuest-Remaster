/**
 * The practice Daily Challenge's date for a moment: the local calendar day at the player's offset
 * from UTC (minutes, east positive), as "YYYY-MM-DD". Pass it as `SoloConfig.challengeDay`.
 * (The same machine on the same local day gets the same practice challenge.)
 */
export function practiceDay(now: number, utcOffsetMinutes = 0): string {
  return new Date(now + utcOffsetMinutes * 60_000).toISOString().slice(0, 10);
}

const offsetFormats = new Map<string, Intl.DateTimeFormat>();

/**
 * The zone's local time minus UTC at `now`, in minutes (east positive; -300 in New York in winter,
 * -240 in summer), so it follows daylight saving. An unknown zone counts as UTC. The engine prints
 * the original's time in front of notices ("12:05 AM:Bob logged on.", `show_time`,
 * std_all.cpp:328-347) at this offset (`EngineContext.localTimeOffsetMinutes`).
 */
export function zoneOffsetMinutes(timeZone: string, now: number): number {
  let format = offsetFormats.get(timeZone);
  if (!format) {
    try {
      format = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
      });
    } catch {
      return 0;
    }
    offsetFormats.set(timeZone, format);
  }
  const part: Record<string, number> = {};
  for (const p of format.formatToParts(new Date(now))) {
    if (p.type !== "literal") part[p.type] = Number(p.value);
  }
  const local = Date.UTC(
    part.year ?? 1970,
    (part.month ?? 1) - 1,
    part.day ?? 1,
    part.hour ?? 0,
    part.minute ?? 0,
    part.second ?? 0,
  );
  return Math.round((local - Math.floor(now / 1000) * 1000) / 60_000);
}

/** The page's IANA time zone (for `WireHostOptions.timeZone`), or undefined if it has none. */
export function pageTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}
