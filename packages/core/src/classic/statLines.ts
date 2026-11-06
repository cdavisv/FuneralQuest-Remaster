import type { StatLine } from "@fq/protocol";
import type { Turn } from "../engine/turn.js";
import { fill, intToCash } from "../text/format.js";
import { playerRank, rankPercent, ratingTitle } from "./rankings.js";

/** `func_AddUpdateStats` (legacy/source/command_script.cpp:328-358): the stats sheet. */
export function statLines(turn: Turn): StatLine[] {
  const p = turn.player;
  const t = turn.text.stats;
  const l = t.labels;
  const town = turn.town;
  const rating = fill(t.rating, {
    rank: playerRank(town, p.id),
    title: ratingTitle(turn.content, rankPercent(town, p.id)),
  });
  const ride = turn.text.hearseNames[p.transportation] ?? "";
  const lines: [string, string, string][] = [
    ["turns", l.turns, intToCash(p.turns)],
    ["bpTotal", l.bpTotal, intToCash(p.bp)],
    ["money", l.money, intToCash(p.money)],
    ["wood", l.wood, intToCash(p.tags[0] ?? 0)],
    ["silver", l.silver, intToCash(p.tags[1] ?? 0)],
    ["gold", l.gold, intToCash(p.tags[2] ?? 0)],
    ["plots", l.plots, intToCash(p.plots)],
    ["bpToday", l.bpToday, intToCash(p.bpToday)],
    ["psych", l.psych, fill(t.psychLevel, { level: intToCash(p.psych + 1) })],
    ["rating", l.rating, rating],
    ["yangs", l.yangs, intToCash(town.settings.yangsPerDay - p.yangsSent)],
    ["visits", l.visits, intToCash(town.settings.visitsPerDay - p.playerFights)],
    ["hpMax", l.hpMax, intToCash(p.hpMax)],
    ["strength", l.strength, intToCash(p.strength)],
    ["lockpicks", l.lockpicks, intToCash(p.custom[3] ?? 0)],
    ["ride", l.ride, ride],
  ];
  return lines.map(([id, label, value]) => ({ id, label, value }));
}
