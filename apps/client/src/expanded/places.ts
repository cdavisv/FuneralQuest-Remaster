import type { View } from "@fq/protocol";

/**
 * Which Expanded screen a View is, by the ids its buttons carry. The engine names every control
 * `<module>:<command>`, so the module prefix says where the player is.
 */
export type ExpandedScreen =
  | "tour"
  | "negotiation"
  | "prep"
  | "office"
  | "upgrades"
  | "monuments"
  | "duel"
  | "graveyard"
  | "church"
  | "city-hall"
  | "club"
  | "club-games"
  | "market"
  | "hospital"
  | "bank"
  | "police"
  | "crematorium"
  | "florist"
  | "gazette"
  | "store"
  | "chains"
  | "coroner"
  | "health-department"
  | "pawn-shop"
  | "mournes"
  | null;

const has = (view: View, prefix: string) => view.buttons.some((b) => b.id.startsWith(prefix));

export function expandedScreen(view: View): ExpandedScreen {
  if (view.customer) return "negotiation";
  if (has(view, "prep:")) return "prep";
  if (view.board) return "chains";
  if (view.battle && has(view, "graveyard:")) return "duel";
  if (has(view, "parlor:buy:")) return "upgrades";
  if (has(view, "parlor:") || (has(view, "go:parlor") && view.scene === "desk" && false))
    return "office";
  if (has(view, "reaper-club:draw:") || has(view, "reaper-club:slots:")) return "club-games";
  if (has(view, "reaper-club:buy:")) return "market";
  if (has(view, "reaper-club:")) return "club";
  if (has(view, "graveyard:monument")) return "monuments";
  if (has(view, "graveyard:")) return "graveyard";
  if (has(view, "church:")) return "church";
  if (has(view, "city-hall:")) return "city-hall";
  if (has(view, "coroner:")) return "coroner";
  if (has(view, "health-department:")) return "health-department";
  if (has(view, "pawn-shop:")) return "pawn-shop";
  if (has(view, "mournes:")) return "mournes";
  if (has(view, "hospital:")) return "hospital";
  if (has(view, "bank:")) return "bank";
  if (has(view, "police:")) return "police";
  if (has(view, "crematorium:")) return "crematorium";
  if (has(view, "florist:")) return "florist";
  if (has(view, "gazette:")) return "gazette";
  if (has(view, "store:casket")) return "store";
  return null;
}
