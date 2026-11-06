import type { AssetId, Button, Hud, Picture, RichText, View } from "@fq/protocol";
import type { PlayerState } from "../state/types.js";
import { parseLegacyText } from "../text/legacyText.js";

/**
 * Asset id from a legacy URL (rule in CLAUDE.md): drop a leading `flash/`,
 * drop `.swf`, lowercase, forward slashes. Empty input gives undefined.
 */
export function assetId(legacyUrl: string): AssetId | undefined {
  const trimmed = legacyUrl.trim();
  if (trimmed === "") return undefined;
  return trimmed
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^flash\//i, "")
    .replace(/\.swf$/i, "")
    .toLowerCase();
}

export function legacy(text: string): RichText {
  return parseLegacyText(text);
}

export function hud(player: PlayerState): Hud {
  const out: Hud = {
    turns: player.turns,
    bpToday: player.bpToday,
    bpTotal: player.bp,
    luck: player.luck,
    tags: { wood: player.tags[0] ?? 0, silver: player.tags[1] ?? 0, gold: player.tags[2] ?? 0 },
  };
  // Expanded players only (docs/expanded-rules.md section 11.1); Classic HUDs are unchanged.
  if (player.expanded) {
    out.money = player.money;
    out.karma = player.karma;
    out.rating = player.rating;
    // The town's places (docs/expanded-rules.md section 26), once the player has used them.
    const life = player.expanded.life;
    if (life) {
      out.savings = life.savings;
      if (life.loan) out.debt = { owed: life.loan.owed, due: life.loan.due };
      out.injuries = life.injuries.length;
      out.leads = life.leads;
    }
  }
  return out;
}

export function button(id: string, label: string): Button {
  return { id, label: label.trim() };
}

/** A button that enters a module (`go:<module>`). */
export function goButton(module: string, label: string): Button {
  return button(`go:${module}`, label);
}

export function picture(fg: AssetId | null | undefined, bg?: AssetId | null): Picture {
  const out: Picture = {};
  if (fg) out.fg = fg;
  if (bg) out.bg = bg;
  return out;
}

/**
 * Removes `undefined` members so the view is plain JSON. Views are stored in
 * the session to validate the next action, so they must survive a round trip.
 */
export function freezeView(view: View): View {
  return JSON.parse(JSON.stringify(view)) as View;
}
