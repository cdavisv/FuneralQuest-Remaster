import type { StatLine, View } from "@fq/protocol";
import { enterLocation } from "../../classic/location.js";
import { ratingTitle } from "../../classic/rankings.js";
import { statLines } from "../../classic/statLines.js";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { goButton, hud, legacy } from "../../engine/view.js";
import { Custom } from "../../state/types.js";
import { intToCash } from "../../text/format.js";
import { buildingLevel, perksOf } from "../parlor.js";
import { xc, xp, xr } from "../players.js";
import { karmaTitle } from "./office.js";

/**
 * The Expanded stats sheet (docs/expanded-rules.md section 11.1): the Classic
 * lines, with rating and karma as numbers and titles, then the parlor's
 * Expanded lines. Buttons as Classic `stats.c`: Name, Back.
 */
export function expandedStatLines(turn: Turn): StatLine[] {
  const p = turn.player;
  const x = xp(turn);
  const rules = xr(turn);
  const t = xc(turn).text;
  const l = t.stats.labels;
  const lines = statLines(turn).map((line) =>
    line.id === "rating"
      ? { ...line, value: `${p.rating} (${ratingTitle(turn.content, Math.max(1, p.rating))})` }
      : line,
  );
  const perks = perksOf(rules, p.karma).map((id) => t.perks[id]?.name ?? id);
  const extra: [string, string, string][] = [
    ["karma", l.karma, `${p.karma} (${karmaTitle(turn)})`],
    ["parlor", l.parlor, t.office.levelNames[buildingLevel(rules, x)] ?? ""],
    ["stock", l.stock, `${x.stock[0]} / ${x.stock[1]} / ${x.stock[2]}`],
    ["markup", l.markup, `${x.markup}%`],
    ["rivalry", l.rivalry, t.office.rivalryNames[x.rivalry]],
    ["plotIncome", l.plotIncome, `$${intToCash(p.plots * rules.money.plotIncome + x.plotIncome)}`],
    ["perks", l.perks, perks.length === 0 ? t.office.noPerks : perks.join(", ")],
    ["sales", l.sales, `${x.record.sales} / ${x.record.walkouts}`],
  ];
  return [...lines, ...extra.map(([id, label, value]) => ({ id, label, value }))];
}

export const expandedStatsModule: LocationModule = {
  id: "stats",
  enter(turn) {
    enterLocation(turn, "Stats");
    turn.session.scene = "stats";
    const p = turn.player;
    let text = "`y";
    if ((p.custom[Custom.FireAlarm] ?? 0) === 1) text += "Smoke detector installed.\n";
    if ((p.custom[Custom.Padlock] ?? 0) === 1) {
      text += `Your parlor entrance is padlocked. (\`w${p.custom[Custom.PadlockStrength] ?? 0} percent strength\`y)\n`;
    }
    if ((p.custom[Custom.Safe] ?? 0) === 1) text += "You own a safe.\n";
    if (text === "`y") text += "Your stats.";
    const view: View = {
      scene: "stats",
      title: turn.text.stats.title,
      text: legacy(text),
      hud: hud(p),
      stats: expandedStatLines(turn),
      buttons: [goButton("options", "Name"), goButton("desk", "Back")],
    };
    return view;
  },
};
