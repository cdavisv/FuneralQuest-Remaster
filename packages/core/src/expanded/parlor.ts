import type { AssetId } from "@fq/protocol";
import type { ClassicRules } from "../rules/classicRules.js";
import type { ExpandedRules, UpgradeRule } from "../rules/expandedRules.js";
import type { PlayerState } from "../state/types.js";
import { clamp } from "./players.js";
import type { ExpandedPlayer } from "./state.js";

/**
 * The parlor: upgrades, building level, rating, security and karma perks
 * (docs/expanded-rules.md sections 7 and 8).
 */

export function hasUpgrade(player: PlayerState, id: string): boolean {
  return player.expanded?.upgrades.includes(id) ?? false;
}

export function upgradeRule(rules: ExpandedRules, id: string): UpgradeRule | undefined {
  return rules.upgrades.find((u) => u.id === id);
}

/** Section 7.2: building upgrades owned, 0 to 4. */
export function buildingLevel(rules: ExpandedRules, x: ExpandedPlayer): number {
  return rules.upgrades.filter((u) => u.building && x.upgrades.includes(u.id)).length;
}

/**
 * Section 7.2: the drawing of the parlor, one stage per building level
 * (`places/parlor-1`, the Shack, to `places/parlor-5`, the Colonial Mansion;
 * assets/remastered/manifest.json).
 */
export function parlorPicture(level: number): AssetId {
  return `places/parlor-${Math.min(5, Math.max(1, Math.trunc(level) + 1))}`;
}

/** Section 8.2: the scenes a body-preparation choice without its own picture is drawn in. */
export const PREP_PICTURES: readonly AssetId[] = [
  "places/prep-table",
  "places/prep-cosmetics",
  "places/prep-viewing",
];

/**
 * The prep scene for an event without a picture: chosen from the event id
 * (a string hash), so it is the same every time and draws nothing from the
 * player's stream.
 */
export function prepPicture(
  eventId: string,
  pictures: readonly AssetId[] = PREP_PICTURES,
): AssetId {
  let h = 0;
  for (let i = 0; i < eventId.length; i++) h = (Math.imul(h, 31) + eventId.charCodeAt(i)) >>> 0;
  return pictures[h % pictures.length] ?? "places/embalming-room";
}

/** Section 9.2: the highest security level owned (0 to 3). */
export function defenceLevel(rules: ExpandedRules, player: PlayerState): number {
  const x = player.expanded;
  if (!x) return 0;
  let level = 0;
  for (const u of rules.upgrades)
    if (u.defence && x.upgrades.includes(u.id)) level = Math.max(level, u.defence);
  return level;
}

/** Section 6.2. */
export function stockCapacity(rules: ExpandedRules, player: PlayerState): number {
  return hasUpgrade(player, "storeroom")
    ? rules.money.storeroomCapacity
    : rules.money.stockCapacity;
}

export function stockTotal(x: ExpandedPlayer): number {
  return x.stock[0] + x.stock[1] + x.stock[2];
}

/** Karma perk ids, best first (section 8.3). */
export type PerkId = "trusted" | "church-associate" | "grave-robber" | "necromancer";

export function perksOf(rules: ExpandedRules, karma: number): PerkId[] {
  const k = rules.karma;
  const out: PerkId[] = [];
  if (karma >= k.good[1]) out.push("church-associate");
  if (karma >= k.good[0]) out.push("trusted");
  if (karma <= k.evil[1]) out.push("necromancer");
  if (karma <= k.evil[0]) out.push("grave-robber");
  return out;
}

export function hasPerk(rules: ExpandedRules, player: PlayerState, perk: PerkId): boolean {
  return perksOf(rules, player.karma).includes(perk);
}

/** Section 8.1: the karma part of the rating. */
export function karmaRating(rules: ExpandedRules, karma: number): number {
  const k = rules.karma;
  const r = rules.rating;
  if (karma >= k.good[1]) return r.karmaBonus[1];
  if (karma >= k.good[0]) return r.karmaBonus[0];
  if (karma <= k.evil[1]) return r.karmaPenalty[1];
  if (karma <= k.evil[0]) return r.karmaPenalty[0];
  return 0;
}

/**
 * Section 7.1: rating = base + upgrades + hearse + plots + word of mouth +
 * karma + markup, clamped to 0..100.
 */
export function computeRating(rules: ClassicRules, player: PlayerState): number {
  const x = rules.expanded;
  const e = player.expanded;
  if (!x || !e) return player.rating;
  const r = x.rating;
  let total = r.base;
  for (const u of x.upgrades) if (e.upgrades.includes(u.id)) total += u.rating;
  total += x.hearses[player.transportation]?.rating ?? 0;
  total += Math.min(r.plotsMax, Math.floor(player.plots / r.plotsPerPoint));
  total += e.reviews;
  total += karmaRating(x, player.karma);
  total += (e.markup / 10) * x.markup.ratingPer10;
  // Sections 16.1, 18.4, 23.1: monuments, the mayor's ribbon cuttings, belonging to a chain.
  const life = e.life;
  if (life) {
    const monuments = x.town.graveyard.monuments;
    for (let i = 0; i < life.monuments; i++) total += monuments[i]?.rating ?? 0;
    if (life.mayor) total += x.town.cityHall.election.perks.rating;
    if (life.chain) total += x.town.chains.rating;
  }
  return clamp(Math.round(total), 0, 100);
}

export function refreshRating(rules: ClassicRules, player: PlayerState): void {
  if (player.expanded) player.rating = computeRating(rules, player);
}

/** Section 3.1: the income-roll shift from rating, luck and upgrades. */
export function incomeShift(rules: ExpandedRules, player: PlayerState): number {
  let shift =
    Math.floor(player.rating / rules.customer.ratingDiv) +
    Math.floor((player.luck - 50) / rules.customer.luckDiv);
  for (const u of rules.upgrades)
    if (u.incomeShift && hasUpgrade(player, u.id)) shift += u.incomeShift;
  return shift;
}
