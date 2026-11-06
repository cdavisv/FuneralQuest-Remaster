import type { EngineContext } from "../engine/turn.js";

/**
 * `show_time()` (legacy/source/shared/std_all.cpp:328-347): the server's local
 * time of day as `GetTimeFormat(LOCALE_USER_DEFAULT, 0, ..., "h':'mm' 'tt")`
 * writes it for the en-US locale: the hour 1 to 12 without a leading zero,
 * two-digit minutes, a space and AM or PM, for example "12:05 AM" or
 * "3:41 PM". `broadcast` (broadcast.cpp:391-407) puts it, and a colon, in
 * front of every notice.
 *
 * The engine reads no clock: the time is the host's `now` moved by the
 * server's offset from UTC (`localTimeOffsetMinutes`, 0 when absent).
 */
export function showTime(ctx: EngineContext): string {
  const local = new Date(ctx.now + (ctx.localTimeOffsetMinutes ?? 0) * 60_000);
  const hours = local.getUTCHours();
  const minutes = local.getUTCMinutes();
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${h12}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
}

/** A notice as `broadcast` queued it: `"%s:%s"` of `show_time()` and the text. */
export function stampNotice(ctx: EngineContext, text: string): string {
  return `${showTime(ctx)}:${text}`;
}
