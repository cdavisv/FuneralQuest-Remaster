import { luckMod } from "../classic/players.js";
import type { Turn } from "../engine/turn.js";
import type { ClassicRandom } from "../rng/classicRandom.js";
import type { ClassicRules, Nudge } from "../rules/classicRules.js";
import type { ExpandedRules } from "../rules/expandedRules.js";
import type { PlayerState } from "../state/types.js";
import type { ExpandedContent, Reward } from "./content/types.js";
import type { ExpandedPlayer } from "./state.js";

/** Shared helpers of the Expanded systems (docs/expanded-rules.md section 2). */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function pick<T>(rng: ClassicRandom, items: readonly T[]): T {
  if (items.length === 0) throw new Error("Nothing to pick from");
  return items[rng.random(items.length)] as T;
}

/** `base + frandom(range)`. */
export function nudge(rng: ClassicRandom, n: Nudge): number {
  return n.base + (n.range > 0 ? rng.frandom(n.range) : 0);
}

/** A uniform roll in [0, 1) from the player's stream. */
export function roll(rng: ClassicRandom): number {
  return rng.random(1_000_000) / 1_000_000;
}

/** The Expanded rules of a turn. Throws in a Classic town, so Expanded code cannot run there. */
export function xr(turn: Turn): ExpandedRules {
  const rules = turn.rules.expanded;
  if (!rules) throw new Error("Not an Expanded town");
  return rules;
}

/** The Expanded content of a turn. */
export function xc(turn: Turn): ExpandedContent {
  const content = turn.content.expanded;
  if (!content) throw new Error("The content pack has no Expanded section");
  return content;
}

/** A fresh Expanded record (section 2.1). */
export function newExpandedPlayer(rules: ExpandedRules): ExpandedPlayer {
  return {
    upgrades: [],
    stock: [...rules.money.startingStock],
    markup: 0,
    rivalry: "standard",
    rivalryDay: 0,
    reviews: 0,
    plotIncome: 0,
    families: [],
    futures: [],
    tutorial: { step: 0, done: false },
    daily: { dug: 0, hearsePaid: true },
    record: {
      sales: 0,
      walkouts: 0,
      exact: 0,
      great: 0,
      nice: 0,
      cremations: 0,
      saleBp: 0,
      bonusBp: 0,
      saleMoney: 0,
    },
  };
}

/** The player's Expanded record, created on first use (players made before Expanded existed). */
export function ensureExpanded(player: PlayerState, rules: ClassicRules): ExpandedPlayer {
  if (!player.expanded) {
    if (!rules.expanded) throw new Error("Not an Expanded town");
    player.expanded = newExpandedPlayer(rules.expanded);
    // A player created before the tutorial existed has already played.
    if (player.dayLastLoggedOn > 0) player.expanded.tutorial.done = true;
  }
  return player.expanded;
}

export function xp(turn: Turn): ExpandedPlayer {
  return ensureExpanded(turn.player, turn.rules);
}

/** Money never goes below 0 (section 6.1). Returns the change actually made. */
export function moneyMod(player: PlayerState, amount: number): number {
  const before = player.money;
  player.money = Math.max(0, Math.round(player.money + amount));
  return player.money - before;
}

/** Karma stays 1 to 100 (section 8.1). */
export function karmaMod(player: PlayerState, amount: number): void {
  player.karma = clamp(Math.round(player.karma + amount), 1, 100);
}

export function reviewsMod(player: PlayerState, rules: ExpandedRules, amount: number): void {
  const x = player.expanded;
  if (!x) return;
  const max = rules.rating.reviewsMax;
  x.reviews = clamp(x.reviews + amount, -max, max);
}

/**
 * Applies a `Reward` at once (section 10.2: no reward waits for the mail).
 * BP losses use `exp_mod` (never more than today's BP).
 */
export function applyReward(turn: Turn, player: PlayerState, reward: Reward): void {
  const rules = xr(turn);
  ensureExpanded(player, turn.rules);
  if (reward.bp) {
    let value = reward.bp;
    if (player.bpToday + value < 0) value = -player.bpToday;
    player.bpToday = Math.max(0, player.bpToday + value);
    player.bp = Math.max(0, player.bp + value);
  }
  if (reward.money) moneyMod(player, reward.money);
  if (reward.karma) karmaMod(player, reward.karma);
  if (reward.luck) luckMod(turn.rules, player, reward.luck);
  if (reward.reviews) reviewsMod(player, rules, reward.reviews);
  if (reward.gold) player.tags[2] = Math.max(0, (player.tags[2] ?? 0) + reward.gold);
  if (reward.protection) player.policeProtected = true;
  if (reward.rating) {
    // Rating is recomputed from its parts; a one-off rating reward moves word of mouth.
    reviewsMod(player, rules, reward.rating);
  }
}

/** A short "+3 karma, +$400" summary of a reward, for result screens. */
export function rewardSummary(reward: Reward): string {
  const parts: string[] = [];
  const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  if (reward.bp) parts.push(`${signed(reward.bp)} BP`);
  if (reward.money) parts.push(`${reward.money > 0 ? "+" : "-"}$${Math.abs(reward.money)}`);
  if (reward.karma) parts.push(`${signed(reward.karma)} karma`);
  if (reward.luck) parts.push(`${signed(reward.luck)} luck`);
  if (reward.reviews) parts.push(`${signed(reward.reviews)} reputation`);
  if (reward.rating) parts.push(`${signed(reward.rating)} reputation`);
  if (reward.gold)
    parts.push(`${signed(reward.gold)} gold tag${Math.abs(reward.gold) === 1 ? "" : "s"}`);
  if (reward.protection) parts.push("police protection tonight");
  return parts.length === 0 ? "" : `\`5(${parts.join(", ")})\`$`;
}
