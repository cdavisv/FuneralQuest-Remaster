/**
 * The log-on screen's banner (`st_intro_news`), as the original server built it.
 *
 * `send_logon_information` (legacy/source/funeral.cpp:191-193) formats one line of raw HTML:
 * eleven spaces, "FQServer 1.0." as a link to rtsoft.com/fq, the copyright notice with
 * "Robinson Technologies" as a link to rtsoft.com, two spaces, then "Uptime:" and the server's
 * uptime from `get_uptime` (maint.cpp:336-361). The version is `i_max_version`.`i_min_version`
 * (funeral_file.h:7-8), 1 and 0. The string is not escaped or wrapped on the way out (`add_var`
 * and `seth_ansi` leave HTML alone), so it is kept here as the original wrote it.
 */

/** `i_max_version` and `i_min_version`, legacy/source/funeral_file.h:7-8. */
export const ORIGINAL_SERVER_VERSION = { major: 1, minor: 0 } as const;

/** C's `printf("%6.0f", x)`: rounded to a whole number (ties to even, as the C library does), padded to six. */
function printf6f(x: number): string {
  const floor = Math.floor(x);
  const diff = x - floor;
  let rounded = floor;
  if (diff > 0.5 || (diff === 0.5 && floor % 2 === 1)) rounded = floor + 1;
  return String(rounded).padStart(6, " ");
}

/**
 * `get_uptime` (maint.cpp:336-361): seconds since boot as "     5 Sec", "     7 Min" or
 * "     2 Hour(s)". A boot under one second ago counts as one second; over 59 seconds it is
 * minutes; over 59 minutes it is hours.
 */
export function legacyUptime(elapsedSeconds: number): string {
  // difftime of two time_t values: whole seconds.
  let seconds = Math.floor(elapsedSeconds);
  if (seconds < 1) seconds = 1;
  let text: string;
  if (seconds > 59) text = `${printf6f(seconds / 60)} Min`;
  else text = `${printf6f(seconds)} Sec`;
  if (seconds / 60 > 59) text = `${printf6f(seconds / 60 / 60)} Hour(s)`;
  return text;
}

/** The original banner, with the uptime the host reports. Raw HTML, as the original sent it. */
export function originalBanner(elapsedSeconds: number): string {
  const { major, minor } = ORIGINAL_SERVER_VERSION;
  return (
    '           <u><a href="http://www.rtsoft.com/fq">' +
    `FQServer ${major}.${minor}.</a></u> Copyright 2001-2011: ` +
    '<u><a href="http://www.rtsoft.com">Robinson Technologies</a></u>  ' +
    `Uptime:${legacyUptime(elapsedSeconds)}`
  );
}

/**
 * The line under the original banner (owner's decision 3b, 2026-11-06): it says what is
 * really serving the screen, so the banner above is not taken for the original program.
 * Backtick codes, like every other line of text the bridge sends. Short on purpose: the client's
 * field does not wrap, and a longer line is cut off at its right edge.
 */
export const REMASTER_BANNER_LINE =
  "`wServed by the FuneralQuest Remastered engine, not the original FQServer.";
