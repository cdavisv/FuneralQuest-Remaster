import type { TownState } from "../state/types.js";

/**
 * Blocking (a remaster addition for app-store rules on chat and mail; both
 * rulesets). The host owns reports and the block-list screen; the engine
 * honours the list:
 *
 * - Letters from a blocked player are not delivered (the sender sees the
 *   usual "sent" path) and the blocker is not told one is waiting.
 * - Their cafe lines (talk, `/me`, `/yell`, `/give` and its notices) are not
 *   delivered to the blocker, and `/give` cannot find the blocker in the cafe.
 * - They cannot pick the blocker for a Yang's delivery (and, in Expanded,
 *   for a bank transfer or a chain invitation): the blocker is left out of
 *   the picker. A battle quote they write is not mailed to the blocker.
 * - Never a combat shield: visits, fights, arson, duels and hits follow the
 *   normal rules. Public text (the paper's announcements and crime page) is
 *   not filtered per reader; it is moderated with `removePlayerText`.
 *
 * With no `town.blocks`, every check is false and nothing changes.
 */

/** Replaces `playerId`'s block list (ids of players whose text they do not want). */
export function setBlocked(
  town: TownState,
  playerId: number,
  blocked: readonly number[],
): TownState {
  if (!town.players[playerId]) return town;
  const list = [...new Set(blocked)]
    .filter((id) => Number.isInteger(id) && id !== playerId && town.players[id] !== undefined)
    .sort((a, b) => a - b);
  const blocks = { ...(town.blocks ?? {}) };
  if (list.length > 0) blocks[String(playerId)] = list;
  else delete blocks[String(playerId)];
  const { blocks: _old, ...rest } = town;
  return Object.keys(blocks).length > 0 ? { ...rest, blocks } : rest;
}

/** `playerId`'s block list (empty when none). */
export function blockedList(town: TownState, playerId: number): number[] {
  return [...(town.blocks?.[String(playerId)] ?? [])];
}

/** Whether `blocker` has blocked `other`. */
export function isBlocking(town: TownState, blocker: number, other: number): boolean {
  return town.blocks?.[String(blocker)]?.includes(other) ?? false;
}

/** Players who have blocked `playerId`. */
export function blockersOf(town: TownState, playerId: number): Set<number> {
  const out = new Set<number>();
  if (!town.blocks) return out;
  for (const [key, list] of Object.entries(town.blocks))
    if (list.includes(playerId)) out.add(Number(key));
  return out;
}

/**
 * A slot reused for a new player, or a player gone: drop every list that
 * belongs to it and every mention of it (called when a player is created).
 */
export function forgetBlocks(town: TownState, playerId: number): void {
  if (!town.blocks) return;
  const blocks: Record<string, number[]> = {};
  for (const [key, list] of Object.entries(town.blocks)) {
    if (Number(key) === playerId) continue;
    const kept = list.filter((id) => id !== playerId);
    if (kept.length > 0) blocks[key] = kept;
  }
  if (Object.keys(blocks).length > 0) town.blocks = blocks;
  else delete town.blocks;
}
