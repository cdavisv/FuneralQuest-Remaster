import type { Button, View } from "@fq/protocol";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { goButton } from "../../engine/view.js";
import { fill } from "../../text/format.js";
import { refreshRating } from "../parlor.js";
import { applyReward, moneyMod, xr } from "../players.js";
import { life, xt } from "./life.js";
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
 * Mourne & Sons (docs/expanded-rules.md section 31), the rival parlor
 * family of the Expanded cast: spy on them, take a stand in the day's price
 * war (undercut, or hold your prices), or buy a truce. Button ids:
 * `mournes:spy`, `:undercut`, `:hold`, `:truce`, `:main`.
 */
export const MOURNES = "mournes";

function screen(turn: Turn, text: string, buttons: Button[]): View {
  const t = btext(turn).mournes;
  return screenB(turn, "mournes", text, buttons, t.title, t.note);
}

/** Whether a truce is on today. */
export function truceActive(turn: Turn): boolean {
  return pb(turn).truceUntil >= turn.town.day;
}

function cashShort(turn: Turn, price: number): string {
  return turn.player.money < price ? xt(turn).text.hints.notEnoughCash : "";
}

/** Why spying cannot be done now, or "". */
export function spyRefusal(turn: Turn): string {
  const h = btext(turn).hints;
  if (truceActive(turn)) return h.truceOn;
  if (pb(turn).tip) return h.tipHeld;
  if (did(turn, "spy")) return xt(turn).text.hints.doneToday;
  return cashShort(turn, brules(turn).mournes.spy.price);
}

/** Why a stand in the price war cannot be taken now, or "". */
export function standRefusal(turn: Turn, stand: "undercut" | "hold"): string {
  const h = btext(turn).hints;
  if (truceActive(turn)) return h.truceOn;
  if (did(turn, "undercut") || did(turn, "hold")) return h.stanceChosen;
  if (stand === "undercut") return cashShort(turn, brules(turn).mournes.undercut.price);
  // The hold is free, so it pays its karma only every few days (balance round 21): a daily
  // hold carried a neutral parlor into the good path for nothing.
  const again = holdAgainDay(turn);
  return turn.town.day < again ? fill(h.holdRecent, { day: again }) : "";
}

/** The first game day the prices can be held again (0 when they never were). */
export function holdAgainDay(turn: Turn): number {
  const last = pb(turn).holdDay ?? 0;
  return last > 0 ? last + brules(turn).mournes.hold.everyDays : 0;
}

/** Why a truce cannot be offered now, or "". */
export function truceRefusal(turn: Turn): string {
  if (truceActive(turn)) return btext(turn).hints.truceOn;
  return cashShort(turn, brules(turn).mournes.truce.price);
}

function main(turn: Turn, message = ""): View {
  const t = btext(turn).mournes;
  const r = brules(turn).mournes;
  const gate = (b: Button, why: string) => (why === "" ? b : off(b, why));
  const spy = card(`${MOURNES}:spy`, t.buttons.spy, cash(r.spy.price));
  const undercut = card(`${MOURNES}:undercut`, t.buttons.undercut, cash(r.undercut.price));
  undercut.hint = `(+${r.undercut.reviews} reputation if it works, ${r.undercut.failReviews} if not)`;
  const hold = card(`${MOURNES}:hold`, t.buttons.hold);
  hold.hint = `(+${r.hold.karma} karma)`;
  const truce = card(`${MOURNES}:truce`, t.buttons.truce, cash(r.truce.price));
  truce.hint = `(${r.truce.days} days, +${r.truce.karma} karma, +${r.truce.leads} lead)`;
  let text = say(turn, t.greeting);
  if (truceActive(turn)) text += `\n\n${say(turn, t.truceActive, { until: pb(turn).truceUntil })}`;
  const buttons: Button[] = [
    gate(spy, spyRefusal(turn)),
    gate(undercut, standRefusal(turn, "undercut")),
    gate(hold, standRefusal(turn, "hold")),
    gate(truce, truceRefusal(turn)),
    goButton("map", t.leave),
  ];
  return screen(turn, withMessage(message, text), buttons);
}

function spy(turn: Turn): View {
  if (spyRefusal(turn) !== "") throw new Error("Cannot spy now");
  const r = brules(turn).mournes.spy;
  const t = btext(turn).mournes;
  const p = turn.player;
  moneyMod(p, -r.price);
  paid(turn, "mournes", r.price);
  mark(turn, "spy");
  let text: string;
  if (turn.rng.randomYesNo(p.luck, r.luckWeight)) {
    pb(turn).tip = { loved: false, cheap: true, traits: 0 };
    text = say(turn, t.spyOk, { price: cash(r.price) });
  } else {
    applyReward(turn, p, { karma: r.failKarma, reviews: r.failReviews });
    text = say(turn, t.spyCaught, {
      price: cash(r.price),
      karma: r.failKarma,
      reviews: r.failReviews,
    });
  }
  refreshRating(turn.rules, p);
  return main(turn, text);
}

function undercut(turn: Turn): View {
  if (standRefusal(turn, "undercut") !== "") throw new Error("Cannot undercut now");
  const r = brules(turn).mournes.undercut;
  const t = btext(turn).mournes;
  const p = turn.player;
  moneyMod(p, -r.price);
  paid(turn, "mournes", r.price);
  mark(turn, "undercut");
  let text: string;
  if (turn.rng.randomYesNo(p.luck, r.luckWeight)) {
    applyReward(turn, p, { reviews: r.reviews, luck: r.luck });
    text = say(turn, t.undercutWin, {
      price: cash(r.price),
      reviews: r.reviews,
      luck: r.luck,
    });
  } else {
    applyReward(turn, p, { reviews: r.failReviews });
    text = say(turn, t.undercutLose, { price: cash(r.price), reviews: r.failReviews });
  }
  refreshRating(turn.rules, p);
  return main(turn, text);
}

function hold(turn: Turn): View {
  if (standRefusal(turn, "hold") !== "") throw new Error("Cannot hold now");
  const r = brules(turn).mournes.hold;
  applyReward(turn, turn.player, { karma: r.karma });
  mark(turn, "hold");
  pb(turn).holdDay = turn.town.day;
  refreshRating(turn.rules, turn.player);
  return main(turn, say(turn, btext(turn).mournes.holdDone, { karma: r.karma }));
}

function truce(turn: Turn): View {
  if (truceRefusal(turn) !== "") throw new Error("Cannot offer a truce now");
  const r = brules(turn).mournes.truce;
  const t = btext(turn).mournes;
  const p = turn.player;
  moneyMod(p, -r.price);
  paid(turn, "mournes", r.price);
  pb(turn).truceUntil = turn.town.day + r.days - 1;
  applyReward(turn, p, { karma: r.karma });
  const l = life(turn);
  const room = xr(turn).town.hospital.lead.max - l.leads;
  const leads = Math.max(0, Math.min(r.leads, room));
  l.leads += leads;
  refreshRating(turn.rules, p);
  let text = say(turn, t.truceDone, { days: r.days, karma: r.karma, price: cash(r.price) });
  if (leads > 0) text += `\n${say(turn, t.truceLead, { leads })}`;
  return main(turn, text);
}

export const mournesModule: LocationModule = {
  id: MOURNES,
  enter(turn) {
    xr(turn);
    enterB(turn, btext(turn).mournes.title, MOURNES);
    return main(turn);
  },
  press(turn, command) {
    switch (command) {
      case "main":
        return main(turn);
      case "spy":
        return spy(turn);
      case "undercut":
        return undercut(turn);
      case "hold":
        return hold(turn);
      case "truce":
        return truce(turn);
    }
    throw new Error(`Unknown Mournes command ${command}`);
  },
};
