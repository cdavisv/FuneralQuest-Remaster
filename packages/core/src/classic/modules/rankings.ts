import type { Button, RankingRow, RichText, TextSpan, View } from "@fq/protocol";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { goButton, hud } from "../../engine/view.js";
import type { PlayerState } from "../../state/types.js";
import { intToCash } from "../../text/format.js";
import { isPresent } from "../presence.js";
import { rankPercent, rankSlots, ratingTitle } from "../rankings.js";

/** The rankings sheet (legacy/source/commands_rankings.cpp, rankings.cpp:43-168). */
export const RANKINGS = "rankings";

/** `convert_status_to_text` (rankings.cpp:22-39), or "Protected" / "" for players offline. */
function statusOf(turn: Turn, p: PlayerState): { status: string; online: boolean } {
  const t = turn.text.rankings;
  const session = turn.town.sessions[String(p.id)];
  if (session && isPresent(turn.town, p.id)) {
    const status =
      session.status === "chat" ? t.inCafe : session.status === "logon" ? t.logon : t.onNow;
    return { status, online: true };
  }
  return { status: p.policeProtected ? t.protected : "", online: false };
}

/**
 * The rows of `add_rankings` (rankings.cpp:43-115), or of `add_rankings_alive`
 * (:117-168) with `aliveOnly`, which leaves out police-protected players (the
 * rival parlors' Look list; online players stay in it, marked). Rank order is
 * every slot's (deleted ones count toward the place, as `update_and_rank_players`
 * ranked them); the title is the ratings.txt line for that place.
 */
export function rankingRows(turn: Turn, aliveOnly = false): RankingRow[] {
  const town = turn.town;
  const rows: RankingRow[] = [];
  rankSlots(town).forEach((id, index) => {
    const p = town.players[id];
    if (!p?.active) return;
    if (aliveOnly && p.policeProtected) return;
    rows.push({
      place: index + 1,
      playerId: p.id,
      name: p.name,
      parlor: p.parlor,
      male: p.male,
      bp: p.bp,
      title: ratingTitle(turn.content, rankPercent(town, p.id)),
      ...statusOf(turn, p),
    });
  });
  return rows;
}

/**
 * The original's fixed-width lines for `rows`: `%-20s%s  %-20s%10s %s` (name,
 * sex with F in pink, parlor, total BP, status), padded with blank lines to a
 * multiple of 19 rows as the original did for its page.
 */
export function rankingText(rows: readonly RankingRow[]): RichText {
  const spans: TextSpan[] = [];
  for (const r of rows) {
    spans.push({ text: r.name.padEnd(20) });
    spans.push(r.male ? { text: "M" } : { text: "F", color: "pink" });
    spans.push({ text: `  ${r.parlor.padEnd(20)}${intToCash(r.bp).padStart(10)} ${r.status}\n` });
  }
  let count = rows.length;
  let padding = "";
  while (count % 19 !== 0) {
    padding += "\n";
    count++;
  }
  if (padding !== "") spans.push({ text: padding });
  return spans;
}

/** `add_rankings` as text, kept for callers of the earlier module. */
export function rankingLines(turn: Turn): RichText {
  return rankingText(rankingRows(turn));
}

/** A rankings screen (`c_command_ranking`); `back` is the Continue button (`i_rank_command`). */
export function rankingsView(turn: Turn, rows: RankingRow[], back: Button): View {
  return {
    scene: "rankings",
    title: turn.text.rankings.title,
    text: rankingText(rows),
    rankings: rows,
    hud: hud(turn.player),
    buttons: [back],
  };
}

export const rankingsModule: LocationModule = {
  id: RANKINGS,
  /** `command_ranking` (commands_rankings.cpp:4-27): Continue returns to the desk. */
  enter(turn): View {
    turn.session.scene = RANKINGS;
    return rankingsView(turn, rankingRows(turn), goButton("desk", turn.text.desk.continueLabel));
  },
};
