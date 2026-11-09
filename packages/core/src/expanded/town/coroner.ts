import type { Button, View } from "@fq/protocol";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { goButton } from "../../engine/view.js";
import { fill, intToCash } from "../../text/format.js";
import { refreshRating } from "../parlor.js";
import { applyReward, moneyMod, xp, xr } from "../players.js";
import { xt } from "./life.js";
import {
  brules,
  btext,
  button,
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
 * The County Coroner's Office of Dr. Ignatius Grimble (docs/expanded-rules.md section 31
 * section B1): a tip on the next family, a fast-tracked death certificate and
 * a favour about an unclaimed body. Button ids: `coroner:tip`,
 * `coroner:certificate`, `coroner:favour`, `coroner:burial`, `coroner:quiet`,
 * `coroner:main`.
 */
export const CORONER = "coroner";

function screen(turn: Turn, text: string, buttons: Button[]): View {
  const t = btext(turn).coroner;
  return screenB(turn, "coroner", text, buttons, t.title, t.note);
}

/** Why the tip cannot be bought now, or "". */
export function tipRefusal(turn: Turn): string {
  const c = brules(turn).coroner.tip;
  const h = btext(turn).hints;
  const hints = xt(turn).text.hints;
  if (pb(turn).tip) return h.tipHeld;
  if (did(turn, "tip")) return hints.doneToday;
  if (turn.player.money < c.price) return hints.notEnoughCash;
  return "";
}

/** Why the certificate cannot be bought now, or "". */
export function certificateRefusal(turn: Turn): string {
  const c = brules(turn).coroner.certificate;
  const h = btext(turn).hints;
  const s = pb(turn);
  if (s.certDay > 0 && turn.town.day < s.certDay + c.cooldownDays) return h.certWait;
  if (turn.player.money < c.price) return xt(turn).text.hints.notEnoughCash;
  return "";
}

function favourRefusal(turn: Turn): string {
  return did(turn, "favour") ? xt(turn).text.hints.doneToday : "";
}

function main(turn: Turn, message = ""): View {
  const t = btext(turn).coroner;
  const r = brules(turn).coroner;
  const tip: Button = { ...card(`${CORONER}:tip`, t.buttons.tip, cash(r.tip.price)) };
  const cert: Button = card(
    `${CORONER}:certificate`,
    t.buttons.certificate,
    cash(r.certificate.price),
  );
  const favour = button(`${CORONER}:favour`, t.buttons.favour);
  const why = [tipRefusal(turn), certificateRefusal(turn), favourRefusal(turn)];
  const buttons = [
    why[0] ? off(tip, why[0]) : tip,
    why[1] ? off(cert, why[1]) : cert,
    why[2] ? off(favour, why[2]) : favour,
    goButton("map", t.leave),
  ];
  return screen(turn, withMessage(message, say(turn, t.greeting)), buttons);
}

function favourView(turn: Turn): View {
  const t = btext(turn).coroner;
  const r = brules(turn).coroner.favour;
  if (favourRefusal(turn) !== "") throw new Error("One favour a day");
  const burial = {
    ...card(`${CORONER}:burial`, t.buttons.burial, `-${cash(r.burialCost)}`),
    hint: `(+${r.burialKarma} karma, +${r.burialLuck} luck)`,
  };
  const quiet = {
    ...card(`${CORONER}:quiet`, t.buttons.quiet, `+${cash(r.quietPay)}`),
    hint: `(${r.quietKarma} karma, risk to your reputation)`,
  };
  const buttons: Button[] = [
    turn.player.money < r.burialCost ? off(burial, xt(turn).text.hints.notEnoughCash) : burial,
    quiet,
    button(`${CORONER}:main`, t.back),
  ];
  return screen(turn, say(turn, t.favourIntro), buttons);
}

function buyTip(turn: Turn): View {
  if (tipRefusal(turn) !== "") throw new Error("Cannot buy that tip");
  const r = brules(turn).coroner.tip;
  moneyMod(turn.player, -r.price);
  paid(turn, "coroner", r.price);
  pb(turn).tip = { loved: true, cheap: false, traits: r.traits };
  mark(turn, "tip");
  return main(turn, say(turn, btext(turn).coroner.tipBought, { price: intToCash(r.price) }));
}

function buyCertificate(turn: Turn): View {
  if (certificateRefusal(turn) !== "") throw new Error("Cannot buy that certificate");
  const r = brules(turn).coroner.certificate;
  moneyMod(turn.player, -r.price);
  paid(turn, "coroner", r.price);
  pb(turn).certDay = turn.town.day;
  applyReward(turn, turn.player, { reviews: r.reviews });
  refreshRating(turn.rules, turn.player);
  return main(turn, say(turn, btext(turn).coroner.certBought, { reviews: r.reviews }));
}

function burial(turn: Turn): View {
  const r = brules(turn).coroner.favour;
  if (favourRefusal(turn) !== "" || turn.player.money < r.burialCost)
    throw new Error("Cannot do that favour");
  moneyMod(turn.player, -r.burialCost);
  paid(turn, "coroner", r.burialCost);
  applyReward(turn, turn.player, { karma: r.burialKarma, luck: r.burialLuck });
  mark(turn, "favour");
  refreshRating(turn.rules, turn.player);
  return main(
    turn,
    say(turn, btext(turn).coroner.burialDone, { karma: r.burialKarma, luck: r.burialLuck }),
  );
}

function quiet(turn: Turn): View {
  const r = brules(turn).coroner.favour;
  if (favourRefusal(turn) !== "") throw new Error("Cannot do that favour");
  const t = btext(turn).coroner;
  const p = turn.player;
  moneyMod(p, r.quietPay);
  let text = say(turn, t.quietDone, { money: intToCash(r.quietPay), karma: r.quietKarma });
  applyReward(turn, p, { karma: r.quietKarma });
  // Whether anybody noticed: a luck-weighted draw, as the seance.
  if (!turn.rng.randomYesNo(p.luck, r.quietLuckWeight)) {
    applyReward(turn, p, { reviews: r.quietFailReviews });
    text += `\n\n${fill(t.quietTalk, {})}`;
  }
  mark(turn, "favour");
  refreshRating(turn.rules, p);
  return main(turn, text);
}

export const coronerModule: LocationModule = {
  id: CORONER,
  enter(turn) {
    xp(turn);
    xr(turn);
    enterB(turn, btext(turn).coroner.title, CORONER);
    return main(turn);
  },
  press(turn, command) {
    switch (command) {
      case "main":
        return main(turn);
      case "tip":
        return buyTip(turn);
      case "certificate":
        return buyCertificate(turn);
      case "favour":
        return favourView(turn);
      case "burial":
        return burial(turn);
      case "quiet":
        return quiet(turn);
    }
    throw new Error(`Unknown coroner command ${command}`);
  },
};
