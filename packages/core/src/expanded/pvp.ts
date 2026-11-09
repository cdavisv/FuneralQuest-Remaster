import { expModForceTotal } from "../classic/players.js";
import type { Turn } from "../engine/turn.js";
import type { PlayerState } from "../state/types.js";
import { modValue } from "./modifiers.js";
import { defenceLevel, hasPerk } from "./parlor.js";
import { xr } from "./players.js";
import { pvpGain } from "./scoring.js";
import { TOWN_MODIFIER_KEYS } from "./town/life.js";
import { recordAttack } from "./town/placesAHooks.js";

/**
 * PvP under Expanded rules (docs/expanded-rules.md section 9). The Classic
 * battle and visit modules call these only when `turn.rules.expanded` is set.
 */

function rivalryOf(player: PlayerState): string {
  return player.expanded?.rivalry ?? "standard";
}

/** Section 9.1: the multiplier on what `winner` takes from `loser`. */
export function pvpMultiplier(
  turn: Turn,
  winner: PlayerState,
  loser: PlayerState,
  selfDefense: boolean,
): number {
  const rules = xr(turn);
  const p = rules.pvp;
  let mult = 1;
  if (rivalryOf(winner) === "cutthroat" && rivalryOf(loser) === "cutthroat")
    mult *= p.cutthroatMult;
  if (!selfDefense) {
    if (hasPerk(rules, winner, "necromancer")) mult *= p.necroMult;
    if (hasPerk(rules, loser, "church-associate")) mult *= p.sanctuaryMult;
    mult *= Math.max(0, 1 - p.defencePerLevel * defenceLevel(rules, loser));
  }
  // Section 22.1: news, ordinances and arcs may raise or lower what fights pay.
  return modValue(turn.town, TOWN_MODIFIER_KEYS.pvpGain, mult);
}

/**
 * Section 9.1, replacing `figure_battle_bp`: the winner gains
 * `pvpGain(loser's total) x multiplier` and the loser loses `lossShare` of
 * that. A defender who wins gains the same curve on the attacker's total.
 */
export function expandedBattleBp(
  turn: Turn,
  winner: PlayerState,
  loser: PlayerState,
  selfDefense: boolean,
): { won: number; lost: number } {
  const p = xr(turn).pvp;
  const won = Math.floor(
    pvpGain(xr(turn), loser.bp) * pvpMultiplier(turn, winner, loser, selfDefense),
  );
  const lost = Math.floor(won * p.lossShare);
  expModForceTotal(loser, -lost);
  expModForceTotal(winner, won);
  // Batch A: the police station can hear about an attack that won.
  if (!selfDefense) recordAttack(turn, winner, loser);
  return { won, lost };
}

/** Section 9.2: a defender fighting at home adds `strengthPerLevel` per security level. */
export function defenceStrength(turn: Turn, defender: PlayerState): number {
  const rules = xr(turn);
  return defenceLevel(rules, defender) * rules.pvp.strengthPerLevel;
}

/** Section 9.3: extra visits a day (cutthroat parlors). */
export function bonusVisits(turn: Turn): number {
  return rivalryOf(turn.player) === "cutthroat" ? xr(turn).pvp.cutthroatVisits : 0;
}

export function isPeaceful(player: PlayerState | undefined): boolean {
  return player?.expanded?.rivalry === "peaceful";
}
