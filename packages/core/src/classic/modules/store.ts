import type { View } from "@fq/protocol";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { button } from "../../engine/view.js";
import { fill } from "../../text/format.js";
import { enterLocation } from "../location.js";
import { newScreen, refreshScreen, slotButtons } from "../placeView.js";
import { startScript } from "../scripts/runtime.js";
import { SCRIPT } from "./scripts.js";

/**
 * Di-Mart (legacy/source/command_store.cpp): the hearse showroom in C++, and
 * the Security and Supplies shelves as scripts (`scripts/storeScripts.ts`).
 *
 * Button ids: `store:hearse`, `store:look:<n>`, `store:buy`, `store:security`,
 * `store:supplies`. The hearse being looked at is in `sceneData` (the
 * original kept it in `status.i_risk_type`).
 *
 * Two original bugs are fixed by default (`ClassicRules.fixes.hearseRebuy`,
 * docs/classic-rules.md section 9): the trade-in price is
 * `price - current price / 2`, so buying the hearse you already drive costs
 * about half its price and grants its bonus turns again, and buying a
 * cheaper one has a negative price, which pays gold tags. With the fix, only
 * a dearer hearse can be bought.
 */
export const STORE = "store";

/** Trade-in credit: half the current hearse's price, rounded down (:146, :172). */
function tradeIn(turn: Turn): number {
  const current = turn.rules.hearses[turn.player.transportation];
  return Math.trunc((current?.price ?? 0) / 2);
}

/** What buying hearse `n` costs after the trade-in (:146-147, :172). Negative for a cheaper hearse. */
export function hearseCost(turn: Turn, n: number): number {
  return (turn.rules.hearses[n]?.price ?? 0) - tradeIn(turn);
}

/** Whether the fixed store would sell hearse `n`: only a dearer one than the current. */
function isUpgrade(turn: Turn, n: number): boolean {
  const current = turn.rules.hearses[turn.player.transportation];
  const wanted = turn.rules.hearses[n];
  return (wanted?.price ?? 0) > (current?.price ?? 0);
}

function hearseName(turn: Turn, n: number): string {
  return turn.text.hearseNames[n] ?? "";
}

/** `command_store` (:92-123): Elijah's front counter. */
function enterStore(turn: Turn): View {
  const t = turn.text.places.store;
  enterLocation(turn, t.location);
  const b = t.buttons;
  return newScreen(turn, {
    title: t.location,
    note: t.note,
    status: "",
    text: fill(t.greeting, { player: turn.player.name }),
    bg: "places/store",
    fg: "people/store_guy",
    buttons: slotButtons([
      { slot: 4, label: b.security, id: `${STORE}:security` },
      { slot: 3, label: b.supplies, id: `${STORE}:supplies` },
      { slot: 2, label: b.hearses, id: `${STORE}:hearse` },
      { slot: 1, label: b.leave, id: "go:map" },
    ]),
  });
}

/** `store_hearse` (:54-90): the showroom list (hearses 1 to 4; the bicycle is not for sale). */
function showroom(turn: Turn): View {
  const t = turn.text.places.store;
  turn.session.sceneData = null;
  let text = t.hearseIntro;
  const list: { slot: number; label: string; id: string }[] = [];
  const hearses = turn.rules.hearses;
  for (let i = 1; i < hearses.length; i++) {
    text += fill(t.hearseLine, { n: i, name: hearseName(turn, i), price: hearses[i]?.price ?? 0 });
    list.push({ slot: 6 - i, label: fill(t.buttons.view, { n: i }), id: `${STORE}:look:${i}` });
  }
  list.push({ slot: 1, label: t.buttons.back, id: `go:${STORE}` });
  return refreshScreen(turn, {
    text,
    bg: "places/store",
    fg: "people/store_guy",
    buttons: slotButtons(list),
  });
}

/** `store_look` (:125-156): a close look at hearse `n`. */
function look(turn: Turn, n: number): View {
  const hearses = turn.rules.hearses;
  const wanted = hearses[n];
  if (n < 1 || !wanted) throw new Error(`No hearse ${n}`);
  const t = turn.text.places.store;
  const current = turn.player.transportation;
  turn.session.sceneData = n;
  const trade =
    turn.rules.fixes.hearseRebuy && !isUpgrade(turn, n)
      ? fill(t.lookNoUpgrade, { current: hearseName(turn, current), name: hearseName(turn, n) })
      : fill(t.lookTrade, {
          current: hearseName(turn, current),
          credit: tradeIn(turn),
          cost: hearseCost(turn, n),
        });
  return refreshScreen(turn, {
    text: fill(t.look, {
      name: hearseName(turn, n),
      description: turn.text.hearseDescriptions[n] ?? "",
      bonus: wanted.bonusTurns,
      trade,
    }),
    bg: wanted.picture ?? null,
    fg: "blank",
    buttons: slotButtons([
      { slot: 2, label: t.buttons.buyIt, id: `${STORE}:buy` },
      { slot: 1, label: t.buttons.back, id: `${STORE}:hearse` },
    ]),
  });
}

/**
 * `store_buy_hearse` (:158-212). Trade in the current hearse, pay the
 * difference in gold tags and get the new hearse's bonus turns today.
 */
function buy(turn: Turn): View {
  const n = turn.session.sceneData;
  const hearses = turn.rules.hearses;
  if (typeof n !== "number" || n < 1 || n >= hearses.length) throw new Error("No hearse chosen"); // :164-168
  const t = turn.text.places.store;
  const p = turn.player;
  const back = [button(`${STORE}:hearse`, t.buttons.back)];
  const wanted = hearses[n];
  if (!wanted) throw new Error("No hearse chosen");
  if (turn.rules.fixes.hearseRebuy && !isUpgrade(turn, n)) {
    return refreshScreen(turn, {
      text: fill(t.noUpgrade, {
        current: hearseName(turn, p.transportation),
        name: hearseName(turn, n),
      }),
      buttons: back,
    });
  }
  const cost = hearseCost(turn, n);
  if (cost > (p.tags[2] ?? 0)) {
    return refreshScreen(turn, {
      text: fill(t.cannotAfford, { name: hearseName(turn, n) }),
      buttons: back,
    });
  }
  const text = fill(t.bought, {
    old: hearseName(turn, p.transportation),
    new: hearseName(turn, n),
    bonus: wanted.bonusTurns,
  });
  p.tags[2] = (p.tags[2] ?? 0) - cost;
  p.transportation = n;
  p.turns += wanted.bonusTurns;
  return refreshScreen(turn, { text, fg: "stuff/money_bag_2", buttons: back });
}

function runShelf(turn: Turn, script: string): View {
  // CommandScriptRunScript (command_script.cpp:87-97): location "Store", then the script.
  enterLocation(turn, turn.text.places.store.location);
  turn.session.scene = SCRIPT;
  return startScript(turn, script);
}

export const storeModule: LocationModule = {
  id: STORE,
  enter: (turn) => enterStore(turn),
  press(turn, command) {
    if (command === "hearse") return showroom(turn);
    if (command === "buy") return buy(turn);
    if (command === "security") return runShelf(turn, "store_security");
    if (command === "supplies") return runShelf(turn, "store_supplies");
    if (command.startsWith("look:")) return look(turn, Number(command.slice(5)));
    throw new Error(`Unknown store command ${command}`);
  },
};
