import type { Turn } from "../engine/turn.js";
import { fill } from "../text/format.js";
import { tournamentEndsToday } from "./players.js";

/**
 * `base_new_day` (legacy/source/commands_newday.cpp:3-77): the lazy
 * per-player reset on the first desk visit of a game day. Returns the bonus
 * text (hearse turns, police patrol).
 */
export function baseNewDay(turn: Turn): string {
  const p = turn.player;
  const settings = turn.settings;
  const rules = turn.rules;
  const wasProtected = p.policeProtected;

  p.turns = settings.turnsPerDay;
  // :20-24 repairs a bad hearse index. The original's `>` lets index == count through.
  if (p.transportation > rules.hearses.length) p.transportation = 0;
  if (p.bp < 0) p.bp = 0;
  p.turns += rules.hearses[p.transportation]?.bonusTurns ?? 0;
  p.bpToday = 0;
  p.kickedOutOfYangs = false;
  p.dayLastLoggedOn = turn.town.day;
  p.playerFights = 0;
  p.policeProtected = false;
  // :50 runs script/newday_player.c, whose Main is empty.

  if (tournamentEndsToday(turn.town)) {
    p.turns = 0;
    p.playerFights = settings.visitsPerDay;
  }

  let bonus = "";
  if (p.transportation > 0) {
    bonus += fill(turn.text.desk.hearseBonus, {
      ride: turn.text.hearseNames[p.transportation] ?? "",
      turns: rules.hearses[p.transportation]?.bonusTurns ?? 0,
    });
  }
  // :70 tests the flag after :42 cleared it, so the line never showed. The fix
  // reports the protection the player had overnight; it still ends today.
  const patrolled = rules.fixes.policeNewDayMessage ? wasProtected : p.policeProtected;
  if (patrolled) bonus += turn.text.desk.policeBonus;
  return bonus;
}

/**
 * `new_day_logon` (commands_newday.cpp:80-110). The original checks for a
 * brand-new player after `base_new_day` already stamped today's date, so the
 * welcome never showed; the fix checks before.
 */
export function newDayLogon(turn: Turn): string {
  const p = turn.player;
  const neverPlayed = p.dayLastLoggedOn === 0;
  const bonus = baseNewDay(turn);
  const isNew = turn.rules.fixes.newPlayerWelcome ? neverPlayed : p.dayLastLoggedOn === 0;
  const template = isNew ? turn.text.desk.newDayFirst : turn.text.desk.newDayBack;
  return fill(template, { name: p.name, parlor: p.parlor, bonus });
}

/** `online_day_logon` (commands_newday.cpp:113-131): midnight passed while at the desk. */
export function onlineDayLogon(turn: Turn): string {
  const bonus = baseNewDay(turn);
  return fill(turn.text.desk.newDayAtDesk, { parlor: turn.player.parlor, bonus });
}
