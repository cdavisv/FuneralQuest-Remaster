import type { Button, View } from "@fq/protocol";
import { mailContinue, sendPacket } from "../../classic/mail.js";
import { addToNews } from "../../classic/news.js";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { goButton } from "../../engine/view.js";
import type { PlayerState } from "../../state/types.js";
import { fill } from "../../text/format.js";
import { refreshRating } from "../parlor.js";
import { applyReward, karmaMod, moneyMod, xr } from "../players.js";
import { isPeaceful } from "../pvp.js";
import { passChance } from "./cityHall.js";
import { activePlayers, lifeOf, sameChain, xt } from "./life.js";
import {
  boostActive,
  brules,
  btext,
  card,
  cash,
  did,
  enterB,
  grantBoost,
  mark,
  off,
  paid,
  pb,
  say,
  screenB,
  withMessage,
} from "./placesBLib.js";

/**
 * The Health Department (docs/expanded-rules.md section 31), where the
 * health inspector works: a requested inspection (a chance, by the same
 * formula as City Hall's), a bought clean bill of health, a fine to pay off,
 * and (at low karma) a complaint against a rival parlor. A pass or a bought
 * certificate gives word of mouth for a few days. Button ids:
 * `health-department:inspect`, `:buy`, `:fine`, `:complaint` (picker
 * `health-department:complaintpick`), `:main`.
 */
export const HEALTH = "health-department";

function screen(turn: Turn, text: string, buttons: Button[]): View {
  const t = btext(turn).health;
  return screenB(turn, "health", text, buttons, t.title, t.note);
}

/** Why an inspection cannot be requested, or "". */
export function inspectRefusal(turn: Turn): string {
  const r = brules(turn).health.inspect;
  const h = btext(turn).hints;
  if (pb(turn).citation > 0) return h.citationOpen;
  if (boostActive(turn)) return h.boostOn;
  if (turn.player.money < r.price) return xt(turn).text.hints.notEnoughCash;
  return "";
}

/** Why a clean bill of health cannot be bought, or "". */
export function buyRefusal(turn: Turn): string {
  const r = brules(turn).health.buy;
  const h = btext(turn).hints;
  if (pb(turn).citation > 0) return h.citationOpen;
  if (boostActive(turn)) return h.boostOn;
  if (turn.player.money < r.price) return xt(turn).text.hints.notEnoughCash;
  return "";
}

/** Why the fine cannot be paid, or "". */
export function fineRefusal(turn: Turn): string {
  const owed = pb(turn).citation;
  if (owed <= 0) return btext(turn).hints.noCitation;
  if (turn.player.money < owed) return xt(turn).text.hints.notEnoughCash;
  return "";
}

/** Rivals that a complaint can name: active parlors, not you, not peaceful, not a chain-mate. */
export function complaintTargets(turn: Turn): PlayerState[] {
  return activePlayers(turn.town).filter(
    (q) => q.id !== turn.player.id && !isPeaceful(q) && !sameChain(turn.town, turn.player, q),
  );
}

/** Why a complaint cannot be filed (against `target`, or in general), or "". */
export function complaintRefusal(turn: Turn, target?: PlayerState): string {
  const r = brules(turn).health.complaint;
  const h = btext(turn).hints;
  const hints = xt(turn).text.hints;
  const p = turn.player;
  if (p.karma > r.karmaAtMost) return h.karmaTooLow;
  if (did(turn, "complaint")) return hints.doneToday;
  if (p.money < r.price) return hints.notEnoughCash;
  const targets = complaintTargets(turn);
  if (target === undefined) return targets.length === 0 ? h.noRivals : "";
  return targets.some((q) => q.id === target.id) ? "" : h.noRivals;
}

function main(turn: Turn, message = ""): View {
  const t = btext(turn).health;
  const r = brules(turn).health;
  const owed = pb(turn).citation;
  const gate = (b: Button, why: string) => (why === "" ? b : off(b, why));
  const inspect = card(`${HEALTH}:inspect`, t.buttons.inspect, cash(r.inspect.price));
  inspect.hint = `${chanceNow(turn)}% to pass (+${r.inspect.reviews} reputation, ${r.inspect.days} days)`;
  const buy = card(`${HEALTH}:buy`, t.buttons.buy, cash(r.buy.price));
  buy.hint = `(${r.buy.karma} karma, +${r.buy.reviews} reputation, ${r.buy.days} days)`;
  const fine = card(`${HEALTH}:fine`, t.buttons.fine, owed > 0 ? cash(owed) : "");
  const complaint = card(`${HEALTH}:complaint`, t.buttons.complaint, cash(r.complaint.price));
  complaint.hint = `(${r.complaint.karma} karma)`;
  const buttons: Button[] = [
    gate(inspect, inspectRefusal(turn)),
    gate(buy, buyRefusal(turn)),
    gate(fine, fineRefusal(turn)),
    gate(complaint, complaintRefusal(turn)),
    goButton("map", t.leave),
  ];
  return screen(turn, withMessage(message, say(turn, t.greeting)), buttons);
}

/** The chance (percent) an inspection requested now passes: City Hall's formula. */
export function chanceNow(turn: Turn): number {
  return passChance(turn, turn.player);
}

function inspect(turn: Turn): View {
  if (inspectRefusal(turn) !== "") throw new Error("Cannot request an inspection");
  const r = brules(turn).health.inspect;
  const t = btext(turn).health;
  const p = turn.player;
  moneyMod(p, -r.price);
  paid(turn, "health", r.price);
  let text: string;
  if (turn.rng.random(100) < chanceNow(turn)) {
    grantBoost(turn, r.reviews, r.days);
    text = say(turn, t.passed, { days: r.days, reviews: r.reviews });
  } else {
    pb(turn).citation = r.fine;
    applyReward(turn, p, { reviews: r.failReviews });
    refreshRating(turn.rules, p);
    text = say(turn, t.failed, { fine: cash(r.fine), reviews: Math.abs(r.failReviews) });
  }
  return main(turn, text);
}

function buy(turn: Turn): View {
  if (buyRefusal(turn) !== "") throw new Error("Cannot buy that");
  const r = brules(turn).health.buy;
  moneyMod(turn.player, -r.price);
  paid(turn, "health", r.price);
  karmaMod(turn.player, r.karma);
  grantBoost(turn, r.reviews, r.days);
  return main(
    turn,
    say(turn, btext(turn).health.bought, { days: r.days, karma: r.karma, reviews: r.reviews }),
  );
}

function payFine(turn: Turn): View {
  if (fineRefusal(turn) !== "") throw new Error("Cannot pay that");
  const r = brules(turn).health.inspect;
  const s = pb(turn);
  moneyMod(turn.player, -s.citation);
  paid(turn, "health", s.citation);
  s.citation = 0;
  applyReward(turn, turn.player, { reviews: -r.failReviews });
  refreshRating(turn.rules, turn.player);
  return main(turn, say(turn, btext(turn).health.finePaid, { reviews: -r.failReviews }));
}

function picker(turn: Turn): View {
  const t = btext(turn).health;
  const why = complaintRefusal(turn);
  if (why !== "") throw new Error(why);
  return {
    ...main(turn),
    buttons: [],
    overlay: {
      kind: "playerPicker",
      id: `${HEALTH}:complaintpick`,
      prompt: say(turn, t.complaintPrompt, {
        price: cash(brules(turn).health.complaint.price),
      }),
      players: complaintTargets(turn).map((q) => ({ id: q.id, name: `${q.name} (${q.parlor})` })),
    },
  };
}

function file(turn: Turn, id: number | null): View {
  if (id === null) return main(turn);
  const target = turn.town.players[id];
  const why = complaintRefusal(turn, target);
  if (why !== "" || !target) return main(turn, why);
  const r = brules(turn).health.complaint;
  const t = btext(turn).health;
  const p = turn.player;
  moneyMod(p, -r.price);
  paid(turn, "health", r.price);
  karmaMod(p, r.karma);
  mark(turn, "complaint");
  let text: string;
  if (lifeOf(turn.town, target).certifiedUntil >= turn.town.day) {
    text = say(turn, t.complaintDismissed, { name: target.name, price: cash(r.price) });
  } else if (turn.rng.randomYesNo(p.luck, r.luckWeight)) {
    applyReward(turn, target, { reviews: r.targetReviews });
    refreshRating(turn.rules, target);
    sendPacket(turn.town, target.id, {
      type: "text",
      text: fill(t.complaintMail, { parlor: target.parlor }),
    });
    mailContinue(turn, target.id);
    addToNews(
      turn.town,
      fill(t.complaintNews, { parlor: target.parlor, name: target.name }),
      "crime",
    );
    text = say(turn, t.complaintFiled, { name: target.name, karma: r.karma });
  } else {
    moneyMod(p, -Math.min(p.money, r.fine));
    applyReward(turn, p, { reviews: r.backfireReviews });
    text = say(turn, t.complaintBackfired, {
      fine: cash(r.fine),
      reviews: Math.abs(r.backfireReviews),
    });
  }
  refreshRating(turn.rules, p);
  return main(turn, text);
}

export const healthModule: LocationModule = {
  id: HEALTH,
  enter(turn) {
    xr(turn);
    enterB(turn, btext(turn).health.title, HEALTH);
    return main(turn);
  },
  press(turn, command) {
    switch (command) {
      case "main":
        return main(turn);
      case "inspect":
        return inspect(turn);
      case "buy":
        return buy(turn);
      case "fine":
        return payFine(turn);
      case "complaint":
        return picker(turn);
    }
    throw new Error(`Unknown health department command ${command}`);
  },
  pickPlayer(turn, overlayId, playerId) {
    if (overlayId !== `${HEALTH}:complaintpick`) throw new Error(`Unknown overlay ${overlayId}`);
    return file(turn, playerId);
  },
};
