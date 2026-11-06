import type { Turn } from "../engine/turn.js";
import type { ClassicRules } from "../rules/classicRules.js";
import type { PlayerState, TownState } from "../state/types.js";

const INT_MAX_RANGE = 2000000000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** `luck_mod` (legacy/source/funeral_util.cpp:86-91): add and clamp to 1..100. */
export function luckMod(rules: ClassicRules, player: PlayerState, amount: number): void {
  player.luck = clamp(player.luck + amount, rules.luckMin, rules.luckMax);
}

/**
 * `exp_mod` (legacy/source/funeral_util.cpp:93-106): adds BP to today's and
 * the total. A loss never takes more than today's BP, so a bad day cannot eat
 * into earlier days.
 */
export function expMod(player: PlayerState, amount: number): void {
  let value = amount;
  if (player.bpToday + value < 0) value = -player.bpToday;
  player.bpToday = clamp(player.bpToday + value, 0, INT_MAX_RANGE);
  player.bp = clamp(player.bp + value, 0, INT_MAX_RANGE);
}

/** `exp_mod_force_total` (legacy/source/funeral_util.cpp:109-118): a loss may reduce the total. */
export function expModForceTotal(player: PlayerState, amount: number): void {
  player.bpToday = clamp(player.bpToday + amount, 0, INT_MAX_RANGE);
  player.bp = clamp(player.bp + amount, 0, INT_MAX_RANGE);
}

/** `turns_mod` (legacy/source/funeral_util.cpp:121-126): never below 0. */
export function turnsMod(player: PlayerState, amount: number): void {
  player.turns = clamp(player.turns + amount, 0, INT_MAX_RANGE);
}

/** `get_number_of_valid_players` (legacy/source/misc_utils.cpp:94-102). */
export function validPlayerCount(town: TownState): number {
  return town.players.filter((p) => p.active).length;
}

/**
 * `get_random_player_excluding` (legacy/source/misc_utils.cpp:104-137).
 * Draws `random(slots)` until it lands on an active player other than
 * `exclude`; deleted slots count toward the modulus, as in the original.
 * Returns -1 when nobody qualifies (no draw).
 */
export function randomPlayerExcluding(turn: Turn, exclude: number): number {
  const town = turn.town;
  const valid = validPlayerCount(town);
  if (exclude > -1 ? valid < 2 : valid < 1) return -1;
  for (;;) {
    const chosen = turn.rng.random(town.players.length);
    if (chosen !== exclude && town.players[chosen]?.active) return chosen;
  }
}

/** `play_sir`, `play_he`, `play_His`, `play_him` (legacy/source/misc_utils.cpp:18-46). */
export function playerSir(player: PlayerState): string {
  return player.male ? "sir" : "ma'am";
}

export function playerHis(player: PlayerState): string {
  return player.male ? "his" : "her";
}

/** `get_play_from_handle` (legacy/source/misc_utils.cpp:303-320): display name, case-insensitive. */
export function findPlayerByName(town: TownState, name: string): number {
  const wanted = name.toLowerCase();
  const found = town.players.find((p) => p.active && p.name.toLowerCase() === wanted);
  return found ? found.id : -1;
}

/** `get_play_from_logon_name` (legacy/source/misc_utils.cpp:260-276). */
export function findPlayerByLogon(town: TownState, logon: string): number {
  const wanted = logon.toLowerCase();
  const found = town.players.find((p) => p.active && p.logon.toLowerCase() === wanted);
  return found ? found.id : -1;
}

/** Whether a player is online (`p_play[i].p_on != NULL`). */
export function isOnline(town: TownState, playerId: number): boolean {
  return town.sessions[String(playerId)] !== undefined;
}

/** `tournament_ends_today` (legacy/source/maint.cpp:99-105). */
export function tournamentEndsToday(town: TownState): boolean {
  return town.settings.tournamentActive && town.day === town.settings.tournamentDays + 1;
}

/** `tournament_ends_tomorrow` (legacy/source/maint.cpp:107-113). */
export function tournamentEndsTomorrow(town: TownState): boolean {
  return town.settings.tournamentActive && town.day === town.settings.tournamentDays;
}
