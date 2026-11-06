import type { TownState } from "../state/types.js";

/**
 * Presence: whether a player's client is connected right now. The original
 * tested `p_play[i].p_on != NULL` (for example commands_comp.cpp:224), which
 * the engine's sessions model; but a host may keep a session while the
 * connection is gone (a dropped socket before the time-out, a solo-mode
 * rival the host is not running). The host reports connections with
 * `setPresence`. A player is online when they have a session and the host
 * has not reported them disconnected; with no report, a session is enough.
 */
export function setPresence(town: TownState, playerId: number, online: boolean): TownState {
  if (!town.players[playerId]) return town;
  return { ...town, presence: { ...(town.presence ?? {}), [String(playerId)]: online } };
}

/** Forgets every report, so presence follows sessions again. */
export function clearPresence(town: TownState): TownState {
  const { presence: _dropped, ...rest } = town;
  return rest;
}

/** Online for the rules (the visit check, rankings, the cafe's /all, the log-on game info). */
export function isPresent(town: TownState, playerId: number): boolean {
  if (town.sessions[String(playerId)] === undefined) return false;
  return town.presence?.[String(playerId)] !== false;
}
