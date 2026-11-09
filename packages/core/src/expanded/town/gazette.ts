import type { Button, View } from "@fq/protocol";
import { mailContinue, sendPacket } from "../../classic/mail.js";
import { addToNews } from "../../classic/news.js";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { button, goButton } from "../../engine/view.js";
import type { PlayerState } from "../../state/types.js";
import { fill } from "../../text/format.js";
import { refreshRating } from "../parlor.js";
import { karmaMod, moneyMod, reviewsMod, xr } from "../players.js";
import { isPeaceful } from "../pvp.js";
import { arrive, cash, life, mayorName, sameChain, spent, tr } from "./life.js";
import { pa, ra, tx } from "./placesAState.js";
import { gate, hintsOf, placeScreen } from "./placesAUi.js";

/**
 * The Town Gazette (docs/expanded-rules.md section 30): adverts that send a
 * customer tomorrow, a paid front-page puff piece, and a smear on a rival.
 * Button ids: `gazette:classified`, `:display`, `:puff`, `:smear` (picker
 * `gazette:smearpick`).
 */
export const GAZETTE = "gazette";

function adWhy(turn: Turn, price: number): string {
  if (pa(turn).today.ads >= ra(turn).gazette.adsPerDay) return tx(turn).gazette.adBooked;
  if (turn.player.money < price) return hintsOf(turn).notEnoughCash;
  return "";
}

function puffWhy(turn: Turn): string {
  if (pa(turn).today.puff) return tx(turn).gazette.puffDone;
  if (turn.player.money < ra(turn).gazette.puff.price) return hintsOf(turn).notEnoughCash;
  return "";
}

/** Rivals the Gazette will print a smear about. */
export function smearTargets(turn: Turn): PlayerState[] {
  return turn.town.players.filter(
    (q) =>
      q.active &&
      q.expanded &&
      q.id !== turn.player.id &&
      !isPeaceful(q) &&
      !sameChain(turn.town, turn.player, q),
  );
}

function smearWhy(turn: Turn): string {
  if (pa(turn).today.smear) return tx(turn).gazette.smearDone;
  if (turn.player.money < ra(turn).gazette.smear.price) return hintsOf(turn).notEnoughCash;
  if (smearTargets(turn).length === 0) return hintsOf(turn).noRivals;
  return "";
}

function main(turn: Turn, message = ""): View {
  const t = tx(turn).gazette;
  const g = ra(turn).gazette;
  const text = fill(t.intro, { editor: tx(turn).cast.editor, mayor: mayorName(turn) });
  const buttons: Button[] = [
    gate(
      {
        ...button(`${GAZETTE}:classified`, t.buttons.classified),
        detail: cash(g.classified.price),
      },
      adWhy(turn, g.classified.price),
    ),
    gate(
      { ...button(`${GAZETTE}:display`, t.buttons.display), detail: cash(g.display.price) },
      adWhy(turn, g.display.price),
    ),
    gate(
      { ...button(`${GAZETTE}:puff`, t.buttons.puff), detail: cash(g.puff.price) },
      puffWhy(turn),
    ),
    gate(
      { ...button(`${GAZETTE}:smear`, t.buttons.smear), detail: cash(g.smear.price) },
      smearWhy(turn),
    ),
    goButton("map", t.buttons.leave),
  ];
  return placeScreen(turn, "gazette", t.title, t.note, text, message, buttons);
}

function book(turn: Turn, display: boolean): View {
  const g = ra(turn).gazette;
  const price = display ? g.display.price : g.classified.price;
  if (adWhy(turn, price) !== "") throw new Error("Cannot book");
  const me = turn.player;
  const t = tx(turn).gazette;
  const vars = { editor: tx(turn).cast.editor };
  moneyMod(me, -price);
  spent(turn, "advert", price);
  const state = pa(turn);
  state.today.ads++;
  // The classified is a gamble on luck; the display advert always works.
  const works = display || turn.rng.randomYesNo(me.luck, g.classified.luckWeight);
  if (works) state.ad = { leads: state.ad.leads + 1, day: turn.town.day };
  return main(
    turn,
    fill(display ? t.displayBooked : works ? t.classifiedBooked : t.classifiedFlop, vars),
  );
}

function puff(turn: Turn): View {
  if (puffWhy(turn) !== "") throw new Error("Cannot buy the front page");
  const g = ra(turn).gazette.puff;
  const me = turn.player;
  moneyMod(me, -g.price);
  spent(turn, "puff", g.price);
  pa(turn).today.puff = true;
  reviewsMod(me, xr(turn), g.reviews);
  refreshRating(turn.rules, me);
  addToNews(turn.town, fill(tx(turn).gazette.puffNews, { name: me.name }));
  return main(turn, fill(tx(turn).gazette.puffPrinted, { editor: tx(turn).cast.editor }));
}

function smearPicker(turn: Turn): View {
  const t = tx(turn).gazette;
  if (smearWhy(turn) !== "") throw new Error("Cannot smear");
  return {
    ...main(turn),
    buttons: [],
    overlay: {
      kind: "playerPicker",
      id: `${GAZETTE}:smearpick`,
      prompt: fill(t.smearPrompt, {
        editor: tx(turn).cast.editor,
        price: cash(ra(turn).gazette.smear.price),
      }),
      players: smearTargets(turn).map((q) => ({ id: q.id, name: q.name })),
    },
  };
}

function smear(turn: Turn, id: number | null): View {
  if (id === null) return main(turn);
  const t = tx(turn).gazette;
  const g = ra(turn).gazette.smear;
  const target = turn.town.players[id];
  if (!target?.active || !target.expanded || target.id === turn.player.id)
    return main(turn, hintsOf(turn).noRivals);
  if (isPeaceful(target)) return main(turn, fill(t.smearPeaceful, { name: target.name }));
  if (sameChain(turn.town, turn.player, target))
    return main(turn, fill(t.smearChain, { name: target.name }));
  if (smearWhy(turn) !== "") throw new Error("Cannot smear");
  const me = turn.player;
  const rules = xr(turn);
  moneyMod(me, -g.price);
  spent(turn, "smear", g.price);
  pa(turn).today.smear = true;
  karmaMod(me, g.karma);
  const editor = tx(turn).cast.editor;
  if (turn.rng.random(100) < g.chance) {
    reviewsMod(target, rules, g.targetReviews);
    refreshRating(turn.rules, target);
    addToNews(turn.town, fill(t.smearNews, { name: target.name }));
    sendPacket(turn.town, target.id, { type: "text", text: t.smearMail });
    mailContinue(turn, target.id);
    refreshRating(turn.rules, me);
    return main(turn, fill(t.smearDone2, { name: target.name, editor }));
  }
  const fine = Math.min(me.money, g.fine);
  moneyMod(me, -fine);
  reviewsMod(me, rules, g.backfireReviews);
  refreshRating(turn.rules, me);
  addToNews(turn.town, fill(t.smearBackfireNews, { name: me.name, target: target.name }));
  sendPacket(turn.town, target.id, {
    type: "text",
    text: fill(t.smearBackfireMail, { name: me.name }),
  });
  mailContinue(turn, target.id);
  return main(turn, fill(t.smearBackfire, { name: target.name, fine: cash(fine), editor }));
}

/** The morning hook: customers sent by yesterday's advert, up to the lead limit. */
export function gazetteMorning(turn: Turn): string {
  const me = turn.player;
  if (!me.expanded) return "";
  const state = pa(turn);
  if (state.ad.leads <= 0 || state.ad.day >= turn.town.day) return "";
  const l = life(turn);
  const room = Math.max(0, tr(turn).hospital.lead.max - l.leads);
  const count = Math.min(state.ad.leads, room);
  state.ad = { leads: 0, day: 0 };
  if (count <= 0) return "";
  l.leads += count;
  return fill(tx(turn).gazette.adMorning, { count });
}

export const gazetteModule: LocationModule = {
  id: GAZETTE,
  enter(turn) {
    arrive(turn, tx(turn).gazette.title, GAZETTE);
    return main(turn);
  },
  press(turn, command) {
    switch (command) {
      case "main":
        return main(turn);
      case "classified":
        return book(turn, false);
      case "display":
        return book(turn, true);
      case "puff":
        return puff(turn);
      case "smear":
        return smearPicker(turn);
    }
    throw new Error(`Unknown gazette command ${command}`);
  },
  pickPlayer(turn, overlayId, playerId) {
    if (overlayId !== `${GAZETTE}:smearpick`) throw new Error(`Unknown overlay ${overlayId}`);
    return smear(turn, playerId);
  },
};
