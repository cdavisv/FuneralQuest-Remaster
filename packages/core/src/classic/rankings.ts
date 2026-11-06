import type { ContentPack } from "../content/types.js";
import type { TownState } from "../state/types.js";

/**
 * `update_and_rank_players` (legacy/source/rankings.cpp:287-320): every slot,
 * deleted ones included, sorted by total BP, highest first. The original used
 * `qsort`, which leaves ties in an unspecified order; ties here keep slot order.
 */
export function rankSlots(town: TownState): number[] {
  return town.players
    .map((p) => ({ id: p.id, bp: p.bp }))
    .sort((a, b) => b.bp - a.bp || a.id - b.id)
    .map((e) => e.id);
}

/** `get_player_rank` (rankings.cpp:350-365): 1-based place among all slots. */
export function playerRank(town: TownState, playerId: number): number {
  const index = rankSlots(town).indexOf(playerId);
  return index === -1 ? -1 : index + 1;
}

/**
 * `get_percent_of_ranking_of_player` (rankings.cpp:323-348):
 * `100 - int(place / slots * 100)`, so the leader is 100.
 */
export function rankPercent(town: TownState, playerId: number): number {
  const order = rankSlots(town);
  const index = order.indexOf(playerId);
  if (index === -1) return 1;
  return 100 - Math.trunc(Math.fround(Math.fround(index / order.length) * 100));
}

/**
 * `get_rating_string` (legacy/source/commands_misc.cpp:141-158): the rating
 * line for a percentage, clamped to 1..100.
 */
export function ratingTitle(content: ContentPack, percent: number): string {
  const clamped = Math.min(100, Math.max(1, percent));
  const line = content.ratings[clamped - 1] ?? "";
  return line !== "" ? line : content.text.stats.noRatingText;
}

/**
 * `get_top_player_of_the_day` (rankings.cpp:170-191): most BP today among
 * players whose day is current. Needs more than 0; first slot wins ties.
 */
export function topPlayerOfTheDay(town: TownState): number {
  let index = -1;
  let best = 0;
  for (const p of town.players) {
    if (p.active && p.dayLastLoggedOn === town.day && p.bpToday > best) {
      index = p.id;
      best = p.bpToday;
    }
  }
  return index;
}

function topExcluding(town: TownState, ignore: number[]): number {
  let index = -1;
  let best = 0;
  for (const p of town.players) {
    if (p.active && !ignore.includes(p.id) && p.bp > best) {
      index = p.id;
      best = p.bp;
    }
  }
  return index;
}

/** `get_top_player` (rankings.cpp:193-212): most total BP, more than 0. */
export function topPlayer(town: TownState): number {
  return topExcluding(town, []);
}

/** `get_second_highest_player` (rankings.cpp:214-235). */
export function secondPlayer(town: TownState): number {
  return topExcluding(town, [topPlayer(town)]);
}

/** `get_third_highest_player` (rankings.cpp:237-259). */
export function thirdPlayer(town: TownState): number {
  return topExcluding(town, [topPlayer(town), secondPlayer(town)]);
}
