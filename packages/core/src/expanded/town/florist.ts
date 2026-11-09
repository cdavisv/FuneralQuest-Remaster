import type { Button, View } from "@fq/protocol";
import { luckMod } from "../../classic/players.js";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { button, goButton } from "../../engine/view.js";
import { fill } from "../../text/format.js";
import { refreshRating } from "../parlor.js";
import { karmaMod, moneyMod, reviewsMod, xr } from "../players.js";
import { arrive, cash, spent, townLife, xt } from "./life.js";
import { liveFlowers, pa, ra, tx } from "./placesAState.js";
import { gate, hintsOf, placeScreen } from "./placesAUi.js";

/**
 * The Florist (docs/expanded-rules.md section 30): buy bouquets that pay when a
 * customer buys a flowers package or soft-sell item (`placesASaleExtras`),
 * priced by the day's weather, and send flowers to the church or the ward for
 * karma, word of mouth or luck. Button ids: `florist:buy`, `:bundle`,
 * `:church`, `:ward`.
 */
export const FLORIST = "florist";

/** Today's weather id, or "". */
function weatherId(turn: Turn): string {
  const today = townLife(turn.town).today;
  return today.day === turn.town.day ? (today.weather ?? "") : "";
}

/** Price of one bouquet today: the base times the weather's multiplier. */
export function bouquetPrice(turn: Turn): number {
  const f = ra(turn).florist;
  return Math.max(1, Math.round(f.bouquet.price * (f.weather[weatherId(turn)] ?? 1)));
}

export function bundlePrice(turn: Turn): number {
  const f = ra(turn).florist.bouquet;
  return Math.round(f.bundle * bouquetPrice(turn) * f.bundleShare);
}

function buyWhy(turn: Turn, count: number, price: number): string {
  const f = ra(turn).florist.bouquet;
  if (liveFlowers(turn.town, pa(turn)) + count > f.max) return tx(turn).florist.shelfFull;
  if (turn.player.money < price) return hintsOf(turn).notEnoughCash;
  return "";
}

function wreathWhy(turn: Turn): string {
  if (pa(turn).today.wreath) return tx(turn).florist.wreathDone;
  if (turn.player.money < ra(turn).florist.wreath.price) return hintsOf(turn).notEnoughCash;
  return "";
}

function main(turn: Turn, message = ""): View {
  const t = tx(turn).florist;
  const f = ra(turn).florist;
  const id = weatherId(turn);
  const special = t.special[id] ?? t.specialNone;
  const text = fill(t.intro, {
    florist: tx(turn).cast.florist,
    stock: liveFlowers(turn.town, pa(turn)),
    special,
  });
  const wreath = wreathWhy(turn);
  const buttons: Button[] = [
    gate(
      { ...button(`${FLORIST}:buy`, t.buttons.buy), detail: cash(bouquetPrice(turn)) },
      buyWhy(turn, 1, bouquetPrice(turn)),
    ),
    gate(
      {
        ...button(`${FLORIST}:bundle`, t.buttons.bundle),
        detail: `${f.bouquet.bundle} for ${cash(bundlePrice(turn))}`,
      },
      buyWhy(turn, f.bouquet.bundle, bundlePrice(turn)),
    ),
    gate(
      { ...button(`${FLORIST}:church`, t.buttons.church), detail: cash(f.wreath.price) },
      wreath,
    ),
    gate({ ...button(`${FLORIST}:ward`, t.buttons.ward), detail: cash(f.wreath.price) }, wreath),
    goButton("map", t.buttons.leave),
  ];
  return placeScreen(turn, "florist", t.title, t.note, text, message, buttons);
}

function buy(turn: Turn, count: number, price: number): View {
  if (buyWhy(turn, count, price) !== "") throw new Error("Cannot buy");
  const f = ra(turn).florist.bouquet;
  const state = pa(turn);
  const held = liveFlowers(turn.town, state);
  moneyMod(turn.player, -price);
  spent(turn, "flowers", price);
  state.flowers = { stock: held + count, until: turn.town.day + f.days - 1 };
  return main(turn, fill(tx(turn).florist.bought, { florist: tx(turn).cast.florist, count }));
}

function send(turn: Turn, church: boolean): View {
  if (wreathWhy(turn) !== "") throw new Error("Cannot send");
  const f = ra(turn).florist.wreath;
  const me = turn.player;
  moneyMod(me, -f.price);
  spent(turn, "wreath", f.price);
  pa(turn).today.wreath = true;
  const t = tx(turn).florist;
  if (church) {
    karmaMod(me, f.church.karma);
    reviewsMod(me, xr(turn), f.church.reviews);
    refreshRating(turn.rules, me);
    return main(turn, t.churchSent);
  }
  luckMod(turn.rules, me, f.ward.luck);
  return main(turn, fill(t.wardSent, { nurse: xt(turn).cast.nurse }));
}

export const floristModule: LocationModule = {
  id: FLORIST,
  enter(turn) {
    arrive(turn, tx(turn).florist.title, FLORIST);
    return main(turn);
  },
  press(turn, command) {
    const f = ra(turn).florist.bouquet;
    switch (command) {
      case "main":
        return main(turn);
      case "buy":
        return buy(turn, 1, bouquetPrice(turn));
      case "bundle":
        return buy(turn, f.bundle, bundlePrice(turn));
      case "church":
        return send(turn, true);
      case "ward":
        return send(turn, false);
    }
    throw new Error(`Unknown florist command ${command}`);
  },
};
