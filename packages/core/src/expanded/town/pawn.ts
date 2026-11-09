import type { Button, View } from "@fq/protocol";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { goButton } from "../../engine/view.js";
import { fill, intToCash } from "../../text/format.js";
import { stockPrice } from "../modules/town.js";
import { stockCapacity, stockTotal } from "../parlor.js";
import { clamp, moneyMod, xc, xp, xr } from "../players.js";
import { xt } from "./life.js";
import {
  brules,
  btext,
  card,
  cash,
  did,
  enterB,
  mark,
  off,
  paid,
  pb,
  say,
  screenB,
  withMessage,
} from "./placesBLib.js";

/**
 * Cousin Sal's Pawn (docs/expanded-rules.md section 31): sell the
 * pieces taken during body preparation (the ring), or buy cheap second-hand
 * caskets in lots, some of which are bad. Button ids: `pawn-shop:loot`,
 * `pawn-shop:lot:<id>`, `pawn-shop:main`.
 */
export const PAWN = "pawn-shop";

function screen(turn: Turn, text: string, buttons: Button[]): View {
  const t = btext(turn).pawn;
  return screenB(turn, "pawn", text, buttons, t.title, t.note);
}

/** What Sal pays for one piece of loot: more for a Grave Robber, who he respects. */
export function lootPrice(turn: Turn): number {
  const r = brules(turn).pawn.loot;
  const evil = turn.player.karma <= xr(turn).karma.evil[0];
  return r.price + (evil ? r.evilBonus : 0);
}

/** Dollars one lot costs: its share of Di-Mart's price for each casket (karma and chain prices included). */
export function lotPrice(turn: Turn, id: string): number {
  const lot = brules(turn).pawn.lots.find((l) => l.id === id);
  if (!lot) throw new Error(`No lot ${id}`);
  return Math.round(stockPrice(turn, lot.tier) * lot.count * lot.share);
}

/** Percent chance a lot is bad: luck lowers it. */
export function badChance(turn: Turn): number {
  const b = brules(turn).pawn.bad;
  const raw = b.base - b.perTenLuck * Math.trunc((turn.player.luck - 50) / 10);
  return clamp(raw, b.min, b.max);
}

/** Why a lot cannot be bought now, or "". */
export function lotRefusal(turn: Turn, id: string): string {
  const lot = brules(turn).pawn.lots.find((l) => l.id === id);
  const hints = xt(turn).text.hints;
  if (!lot) return "No such lot";
  if (did(turn, `lot:${id}`) || lotsToday(turn) >= brules(turn).pawn.perDay) return hints.doneToday;
  if (turn.player.money < lotPrice(turn, id)) return hints.notEnoughCash;
  if (stockTotal(xp(turn)) + lot.count > stockCapacity(xr(turn), turn.player))
    return xc(turn).text.hints.storeroomFull;
  return "";
}

function lotsToday(turn: Turn): number {
  return pb(turn).today.done.filter((d) => d.startsWith("lot:")).length;
}

function main(turn: Turn, message = ""): View {
  const t = btext(turn).pawn;
  const r = brules(turn).pawn;
  const s = pb(turn);
  const gate = (b: Button, why: string) => (why === "" ? b : off(b, why));
  const buttons: Button[] = [];
  const loot = card(
    `${PAWN}:loot`,
    t.buttons.loot,
    s.loot > 0 ? `+${cash(s.loot * lootPrice(turn))}` : "",
  );
  buttons.push(gate(loot, s.loot > 0 ? "" : btext(turn).hints.noLoot));
  let text = say(turn, t.greeting);
  for (const lot of r.lots) {
    const price = lotPrice(turn, lot.id);
    const label = t.buttons[lot.id as "wood" | "silver"] ?? lot.id;
    text += `\n${fill(t.lotLine, {
      name: label,
      price: intToCash(price),
      count: lot.count,
      percent: Math.round(lot.share * 100),
      risk: badChance(turn),
    })}`;
    buttons.push(gate(card(`${PAWN}:lot:${lot.id}`, label, cash(price)), lotRefusal(turn, lot.id)));
  }
  buttons.push(goButton("map", t.leave));
  return screen(turn, withMessage(message, text), buttons);
}

function sellLoot(turn: Turn): View {
  const s = pb(turn);
  if (s.loot <= 0) throw new Error("Nothing to pawn");
  const money = s.loot * lootPrice(turn);
  moneyMod(turn.player, money);
  s.loot = 0;
  return main(turn, say(turn, btext(turn).pawn.lootSold, { money: intToCash(money) }));
}

function buyLot(turn: Turn, id: string): View {
  if (lotRefusal(turn, id) !== "") throw new Error("Cannot buy that lot");
  const r = brules(turn).pawn;
  const lot = r.lots.find((l) => l.id === id);
  if (!lot) throw new Error(`No lot ${id}`);
  const t = btext(turn).pawn;
  const price = lotPrice(turn, id);
  moneyMod(turn.player, -price);
  paid(turn, "pawn", price);
  mark(turn, `lot:${id}`);
  // The draw is made after the money is taken, like every buy in town: bad lots are not refunded.
  const bad = turn.rng.random(100) < badChance(turn);
  const count = bad ? Math.min(lot.count, r.bad.keep) : lot.count;
  xp(turn).stock[lot.tier] = (xp(turn).stock[lot.tier] ?? 0) + count;
  return main(turn, say(turn, bad ? t.lotBad : t.lotGood, { count, price: intToCash(price) }));
}

export const pawnModule: LocationModule = {
  id: PAWN,
  enter(turn) {
    xr(turn);
    enterB(turn, btext(turn).pawn.title, PAWN);
    return main(turn);
  },
  press(turn, command) {
    const [verb = "", arg = ""] = command.split(":");
    switch (verb) {
      case "main":
        return main(turn);
      case "loot":
        return sellLoot(turn);
      case "lot":
        return buyLot(turn, arg);
    }
    throw new Error(`Unknown pawn shop command ${command}`);
  },
};
