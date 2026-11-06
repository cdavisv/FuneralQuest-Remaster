import { chainStandings, type TownState } from "@fq/core";
import type { HallRow, NewHallRow } from "../db/stores.js";
import type { HallOfFameEntry } from "../wire.js";

/**
 * The hall of fame: one entry per finished season (tournament). The engine keeps only a line in the
 * Book of Deeds; this is the server-side archive with dates, the final standings and, for Expanded
 * towns, the parlor chains' score board.
 */

const MAX_STANDINGS = 100;

/**
 * Builds the entry for the season that ends at this midnight. `town` is the state just before the
 * reset: the tournament's last day is over, nobody can play, and the players are all still there.
 */
export function buildHallEntry(
  town: TownState,
  meta: { id: string; name: string; ruleset: string },
  winnerName: string | null,
  endedAt: number,
): NewHallRow {
  const ranked = town.players
    .filter((p) => p.active)
    .sort((a, b) => b.bp - a.bp || a.id - b.id)
    .map((p, i) => ({
      rank: i + 1,
      name: p.name,
      parlor: p.parlor,
      bp: p.bp,
      sales: p.expanded?.record.sales ?? null,
    }));
  const top = winnerName === null ? undefined : ranked.find((r) => r.name === winnerName);
  const winner = top ? { name: top.name, parlor: top.parlor, bp: top.bp } : null;
  const chains =
    town.ruleset === "expanded"
      ? chainStandings(town).map((c, i) => ({
          rank: i + 1,
          name: c.name,
          score: c.score,
          members: c.members.map((m) => m.name).filter((n) => n !== ""),
        }))
      : [];
  const days = town.settings.tournamentDays;
  return {
    townId: meta.id,
    townName: meta.name,
    ruleset: meta.ruleset,
    endedAt,
    days,
    winner,
    entry: {
      townId: meta.id,
      townName: meta.name,
      ruleset: meta.ruleset,
      days,
      winner,
      standings: ranked.slice(0, MAX_STANDINGS),
      players: ranked.length,
      chains,
      deed: town.deeds.at(-1) ?? null,
    },
  };
}

/** The public form of a stored row. */
export function hallEntryOf(row: HallRow): HallOfFameEntry {
  const body = JSON.parse(row.entry_json) as Omit<HallOfFameEntry, "id" | "endedAt">;
  return { id: row.id, endedAt: new Date(row.ended_at).toISOString(), ...body };
}
