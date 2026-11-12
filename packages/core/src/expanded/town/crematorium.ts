import type { Button, View } from "@fq/protocol";
import { luckMod } from "../../classic/players.js";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { button, goButton } from "../../engine/view.js";
import { fill } from "../../text/format.js";
import { refreshRating } from "../parlor.js";
import { karmaMod, moneyMod, xp } from "../players.js";
import { arrive, cash, life, spent } from "./life.js";
import { liveSlots, pa, ra, tx } from "./placesAState.js";
import { gate, hintsOf, placeScreen } from "./placesAUi.js";

/**
 * The Crematorium (docs/expanded-rules.md section 30): rent oven time, so a
 * cremation sale keeps the wholesale cost it would have paid, and deal with
 * the ashes of the cremations you have done: scatter them (karma, luck) or
 * press them (cash, bad karma). Button ids: `crematorium:rent`, `:bulk`,
 * `:scatter`, `:diamonds`.
 */
export const CREMATORIUM = "crematorium";

/** A City Hall crematory permit knocks the oven prices down. */
function mult(turn: Turn): number {
  return life(turn).permits.includes("crematory") ? ra(turn).crematorium.oven.permitMult : 1;
}

export function slotPrice(turn: Turn): number {
  return Math.round(ra(turn).crematorium.oven.price * mult(turn));
}

export function bulkPrice(turn: Turn): number {
  return Math.round(ra(turn).crematorium.oven.bulkPrice * mult(turn));
}

/** Urns from cremations not yet handled, at most `ashes.max` an action. */
export function urns(turn: Turn): number {
  const waiting = Math.max(0, xp(turn).record.cremations - pa(turn).ashes);
  return Math.min(waiting, ra(turn).crematorium.ashes.max);
}

function rentWhy(turn: Turn, count: number, price: number): string {
  const c = ra(turn).crematorium.oven;
  const held = liveSlots(turn.town, pa(turn));
  if (held + count > c.max) return tx(turn).crematorium.ovenFull;
  if (turn.player.money < price) return hintsOf(turn).notEnoughCash;
  return "";
}

function main(turn: Turn, message = ""): View {
  const t = tx(turn).crematorium;
  const c = ra(turn).crematorium;
  const state = pa(turn);
  const slots = liveSlots(turn.town, state);
  // A parlor that holds no slot is told so, not "0 slots reserved until day 0".
  let text = fill(slots > 0 ? t.intro : t.introNone, {
    keeper: tx(turn).cast.ovenKeeper,
    slots,
    until: state.oven.until,
    ashes: Math.max(0, xp(turn).record.cremations - state.ashes),
  });
  if (mult(turn) < 1) text += t.permitNote;
  const noAshes = urns(turn) === 0 ? t.noAshes : "";
  const buttons: Button[] = [
    gate(
      { ...button(`${CREMATORIUM}:rent`, t.buttons.rent), detail: cash(slotPrice(turn)) },
      rentWhy(turn, 1, slotPrice(turn)),
    ),
    gate(
      {
        ...button(`${CREMATORIUM}:bulk`, t.buttons.bulk),
        detail: `${c.oven.bulkCount} for ${cash(bulkPrice(turn))}`,
      },
      rentWhy(turn, c.oven.bulkCount, bulkPrice(turn)),
    ),
    gate(button(`${CREMATORIUM}:scatter`, t.buttons.scatter), noAshes),
    gate(
      {
        ...button(`${CREMATORIUM}:diamonds`, t.buttons.diamonds),
        detail: `${cash(c.ashes.press.money)} each`,
      },
      noAshes,
    ),
    goButton("map", t.buttons.leave),
  ];
  return placeScreen(turn, "crematorium", t.title, t.note, text, message, buttons);
}

function rent(turn: Turn, count: number, price: number, bulk: boolean): View {
  if (rentWhy(turn, count, price) !== "") throw new Error("Cannot rent");
  const c = ra(turn).crematorium.oven;
  const state = pa(turn);
  const held = liveSlots(turn.town, state);
  moneyMod(turn.player, -price);
  spent(turn, "oven", price);
  state.oven = { slots: held + count, until: turn.town.day + c.days - 1 };
  const t = tx(turn).crematorium;
  return main(
    turn,
    fill(bulk ? t.bulkBought : t.rented, {
      keeper: tx(turn).cast.ovenKeeper,
      slots: state.oven.slots,
    }),
  );
}

function ashes(turn: Turn, press: boolean): View {
  const n = urns(turn);
  if (n === 0) throw new Error("No ashes");
  const c = ra(turn).crematorium.ashes;
  const me = turn.player;
  pa(turn).ashes += n;
  const t = tx(turn).crematorium;
  if (press) {
    const money = n * c.press.money;
    moneyMod(me, money);
    karmaMod(me, n * c.press.karma);
    refreshRating(turn.rules, me);
    return main(turn, fill(t.pressed, { count: n, money: cash(money) }));
  }
  karmaMod(me, n * c.scatter.karma);
  luckMod(turn.rules, me, n * c.scatter.luck);
  return main(turn, fill(t.scattered, { count: n }));
}

export const crematoriumModule: LocationModule = {
  id: CREMATORIUM,
  enter(turn) {
    arrive(turn, tx(turn).crematorium.title, CREMATORIUM);
    return main(turn);
  },
  press(turn, command) {
    const c = ra(turn).crematorium.oven;
    switch (command) {
      case "main":
        return main(turn);
      case "rent":
        return rent(turn, 1, slotPrice(turn), false);
      case "bulk":
        return rent(turn, c.bulkCount, bulkPrice(turn), true);
      case "scatter":
        return ashes(turn, false);
      case "diamonds":
        return ashes(turn, true);
    }
    throw new Error(`Unknown crematorium command ${command}`);
  },
};
