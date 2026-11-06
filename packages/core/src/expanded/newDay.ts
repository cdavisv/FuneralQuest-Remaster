import { tournamentEndsToday } from "../classic/players.js";
import type { Turn } from "../engine/turn.js";
import { fill, intToCash } from "../text/format.js";
import { MODIFIER_KEYS, modValue } from "./modifiers.js";
import { hasPerk, refreshRating } from "./parlor.js";
import { moneyMod, xc, xp, xr } from "./players.js";
import { bonusVisits } from "./pvp.js";

/**
 * The Expanded part of a player's new day (docs/expanded-rules.md section
 * 10.1), run right after Classic's `base_new_day` on the first desk visit of
 * a game day. `leftover` is the turns the player had before the Classic
 * reset. Returns morning text (legacy markup).
 */
export function expandedNewDay(turn: Turn, leftover: number, firstEver: boolean): string {
  const rules = xr(turn);
  const t = xc(turn).text.desk;
  const p = turn.player;
  const x = xp(turn);
  const final = tournamentEndsToday(turn.town);
  let text = "";
  x.daily = { dug: 0, hearsePaid: true };

  // 10.1: bank up to one day of unused turns.
  if (!final && !firstEver) {
    const banked = Math.min(Math.max(0, leftover), rules.turns.bankMax);
    if (banked > 0) {
      p.turns += banked;
      text += fill(t.banked, { turns: banked });
    }
  }

  // 8.3: the Grave Robber's (and more so the Necromancer's) "accidents" bring extra customers.
  const accidents = hasPerk(rules, p, "necromancer")
    ? rules.karma.evilTurns[1]
    : hasPerk(rules, p, "grave-robber")
      ? rules.karma.evilTurns[0]
      : 0;
  if (!final && accidents > 0) {
    p.turns += accidents;
    text += fill(t.accidents, { turns: accidents });
  }

  // 6.4: plot income, paid before the upkeep it may be needed for.
  const income = Math.round(
    modValue(turn.town, MODIFIER_KEYS.plotIncome, p.plots * rules.money.plotIncome + x.plotIncome),
  );
  if (income > 0) {
    moneyMod(p, income);
    text += fill(t.plotIncome, { money: intToCash(income), plots: intToCash(p.plots) });
  }

  // 9.5: the hearse's bonus turns need today's upkeep.
  const upkeep = rules.hearses[p.transportation]?.upkeep ?? 0;
  const ride = turn.text.hearseNames[p.transportation] ?? "";
  if (upkeep > 0 && !final) {
    if (p.money >= upkeep) {
      moneyMod(p, -upkeep);
      text += fill(t.hearsePaid, { ride, upkeep: intToCash(upkeep) });
    } else {
      x.daily.hearsePaid = false;
      p.turns = Math.max(0, p.turns - (turn.rules.hearses[p.transportation]?.bonusTurns ?? 0));
      text += fill(t.hearseUnpaid, { ride, upkeep: intToCash(upkeep) });
    }
  }

  // 3.8: pre-need funerals that came due.
  const due = x.futures.filter((f) => f.day <= turn.town.day);
  x.futures = x.futures.filter((f) => f.day > turn.town.day);
  for (const f of due) {
    p.bp += f.bp;
    p.bpToday += f.bp;
    moneyMod(p, f.money);
    text += fill(t.futurePaid, { text: f.text, bp: intToCash(f.bp), money: intToCash(f.money) });
  }

  // 7.1: word of mouth fades toward 0.
  x.reviews -= Math.trunc(x.reviews * rules.rating.decay);
  // 9.3: extra visits for the cutthroat (none on the final day).
  if (final) p.playerFights += bonusVisits(turn);
  refreshRating(turn.rules, p);

  for (const hook of turn.registry.playerNewDayHooks) text += hook(turn);
  return text;
}
