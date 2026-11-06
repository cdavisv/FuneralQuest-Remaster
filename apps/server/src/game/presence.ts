import { setPresence, type TownState } from "@fq/core";

/**
 * Tells the engine whether a player's client is connected (the visit rule and
 * the cafe's player count read it). Returns the same town object when nothing
 * changes, so callers can compare by identity.
 */
export function reportPresence(town: TownState, playerId: number, online: boolean): TownState {
  if (town.presence?.[String(playerId)] === online) return town;
  return setPresence(town, playerId, online);
}
