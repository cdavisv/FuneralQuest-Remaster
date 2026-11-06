import type { Button, View } from "@fq/protocol";
import { mailContinue, sendPacket } from "../../classic/mail.js";
import { storeModule } from "../../classic/modules/store.js";
import { universityModule } from "../../classic/modules/university.js";
import { visitModule } from "../../classic/modules/visit.js";
import { readNameSearch } from "../../classic/nameSearch.js";
import { refreshScreen } from "../../classic/placeView.js";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { button, goButton, hud, legacy } from "../../engine/view.js";
import { Custom } from "../../state/types.js";
import { fill, intToCash } from "../../text/format.js";
import { MODIFIER_KEYS, modValue } from "../modifiers.js";
import { defenceLevel, stockCapacity, stockTotal } from "../parlor.js";
import { moneyMod, xc, xp, xr } from "../players.js";
import { isPeaceful } from "../pvp.js";
import { roundUp, wholesalePrice } from "../scoring.js";
import { chainSheltered, injuryHp, sameChain, xt } from "../town/life.js";

/**
 * The Classic town places with the Expanded additions wrapped around them
 * (docs/expanded-rules.md sections 6.2, 9 and 9.4). Each wrapper adds its
 * commands and hands everything else to the Classic module unchanged.
 */

const TIERS = ["Wood", "Silver", "Gold"] as const;

/** Section 6.2: Di-Mart's casket price for a tier after karma and modifiers. */
export function stockPrice(turn: Turn, tier: number): number {
  const rules = xr(turn);
  let price = wholesalePrice(rules, turn.rules.casketPrices[tier] ?? 0);
  if (turn.player.karma <= rules.karma.evil[0]) price *= rules.money.shadyStock;
  // Section 23.1: chains buy together.
  if (turn.player.expanded?.life?.chain) price *= rules.town.chains.stockMult;
  price = modValue(turn.town, MODIFIER_KEYS.stockPrice, price);
  return roundUp(price, rules.customer.limitStep);
}

function casketShelf(turn: Turn, message = ""): View {
  const t = xc(turn).text.store;
  const rules = xr(turn);
  const p = turn.player;
  const x = xp(turn);
  const room = stockCapacity(rules, p) - stockTotal(x);
  const prices = [0, 1, 2].map((tier) => stockPrice(turn, tier));
  let text = fill(t.casketIntro, {
    wood: intToCash(prices[0] ?? 0),
    silver: intToCash(prices[1] ?? 0),
    gold: intToCash(prices[2] ?? 0),
    have: `${x.stock[0]} wood, ${x.stock[1]} silver, ${x.stock[2]} gold`,
    room,
  });
  if (p.karma <= rules.karma.evil[0]) text += t.shadyDiscount;
  if (message !== "") text = `${message}\n\n${text}`;
  const buttons: Button[] = [0, 1, 2].map((tier) => {
    const price = prices[tier] ?? 0;
    const b: Button = {
      ...button(`store:casket:${tier}`, TIERS[tier] ?? ""),
      group: "hand",
      detail: `$${intToCash(price)}`,
    };
    if (room <= 0) return { ...b, enabled: false, hint: xc(turn).text.hints.storeroomFull };
    if (p.money < price) return { ...b, enabled: false, hint: xc(turn).text.hints.notEnoughCash };
    return b;
  });
  let fillUp = button("store:restock", t.restock);
  if (room <= 0 || p.money < (prices[0] ?? 0))
    fillUp = { ...fillUp, enabled: false, hint: xc(turn).text.hints.nothingToFill };
  buttons.push(fillUp, button("go:store", turn.text.places.store.buttons.back));
  return refreshScreen(turn, { text, fg: "people/store_guy", bg: "places/store", buttons });
}

function buyCasket(turn: Turn, tier: number): View {
  const t = xc(turn).text.store;
  const p = turn.player;
  const x = xp(turn);
  if (tier < 0 || tier > 2) throw new Error("No such casket");
  const price = stockPrice(turn, tier);
  if (stockCapacity(xr(turn), p) - stockTotal(x) <= 0) return casketShelf(turn, t.full);
  if (p.money < price) return casketShelf(turn, t.cantAfford);
  moneyMod(p, -price);
  x.stock[tier as 0 | 1 | 2]++;
  return casketShelf(
    turn,
    fill(t.bought, { tier: (TIERS[tier] ?? "").toLowerCase(), price: intToCash(price) }),
  );
}

/** Section 6.2, Fill Up: buy wood, silver, gold in turn, cheapest first, while there is room and cash. */
function restock(turn: Turn): View {
  const t = xc(turn).text.store;
  const p = turn.player;
  const x = xp(turn);
  const cap = stockCapacity(xr(turn), p);
  let count = 0;
  let spent = 0;
  for (let progress = true; progress && stockTotal(x) < cap; ) {
    progress = false;
    for (const tier of [0, 1, 2] as const) {
      const price = stockPrice(turn, tier);
      if (stockTotal(x) >= cap || p.money < price) continue;
      moneyMod(p, -price);
      x.stock[tier]++;
      count++;
      spent += price;
      progress = true;
    }
  }
  return casketShelf(turn, fill(t.restocked, { count, price: intToCash(spent) }));
}

export const expandedStoreModule: LocationModule = {
  ...storeModule,
  enter(turn) {
    const view = storeModule.enter?.(turn, undefined);
    if (!view) throw new Error("No store");
    const leave = view.buttons.findIndex((b) => b.id === "go:map");
    const caskets = button("store:caskets", xc(turn).text.store.caskets);
    view.buttons.splice(leave >= 0 ? leave : view.buttons.length, 0, caskets);
    return view;
  },
  press(turn, command) {
    if (command === "caskets") return casketShelf(turn);
    if (command === "restock") return restock(turn);
    if (command.startsWith("casket:")) return buyCasket(turn, Number(command.slice(7)));
    if (!storeModule.press) throw new Error("No store");
    return storeModule.press(turn, command);
  },
};

/** Section 9.4: the caps on psych, hit points and strength. */
export const expandedUniversityModule: LocationModule = {
  ...universityModule,
  press(turn, command) {
    if (!universityModule.press) throw new Error("No university");
    const rules = xr(turn);
    const p = turn.player;
    const t = xc(turn).text.university;
    const back = [button("spirit-university:main", turn.text.places.university.buttons.continue)];
    if (command === "psych" && p.psych >= rules.psych.maxLevel) {
      return refreshScreen(turn, { text: t.capped, buttons: back });
    }
    if (command === "hp" && p.hpMax >= rules.caps.hpMax) {
      return refreshScreen(turn, { text: t.hpCapped, buttons: back });
    }
    if (command === "strength" && p.strength >= rules.caps.strength) {
      return refreshScreen(turn, { text: t.strengthCapped, buttons: back });
    }
    const view = universityModule.press(turn, command);
    if (p.hpMax > rules.caps.hpMax) {
      p.hpMax = rules.caps.hpMax;
      view.hud = hud(p);
    }
    return view;
  },
};

function visitScreen(turn: Turn, text: string): View {
  return {
    scene: "location",
    title: turn.session.location,
    text: legacy(text),
    picture: { bg: "places/funeral_enemy" },
    hud: hud(turn.player),
    buttons: [goButton("competitors", turn.text.social.visit.buttons.leave)],
  };
}

/**
 * Section 9: the row of rival parlors with the Peace Pledge, security that
 * turns prowlers away at the door, and cash stolen from a register.
 */
export const expandedVisitModule: LocationModule = {
  ...visitModule,
  press(turn, command) {
    if (!visitModule.press) throw new Error("No visits");
    const t = xc(turn).text.visit;
    const rules = xr(turn);
    if (command === "visit" && isPeaceful(turn.player)) return visitScreen(turn, t.selfPeaceful);
    const him = turn.town.players[turn.session.hisId];
    if ((command === "trydoor" || command === "attack" || command === "steal") && him) {
      // Section 23.3: chain-mates never rob or fight each other; a beaten chain is sheltered.
      const town = xt(turn).text;
      if (sameChain(turn.town, turn.player, him))
        return visitScreen(turn, fill(town.chains.noFriendlyFire, { name: him.name }));
      if (command === "trydoor" && chainSheltered(turn, him))
        return visitScreen(turn, fill(town.graveyard.duel.sheltered, { name: him.name }));
    }
    if (command === "attack" && him) {
      // Section 19.1: injuries take hit points off the start of the fight (the Classic
      // attack fills both bars to the maximum; the maximum is lowered for the call).
      const me = turn.player;
      const mine = Math.min(me.hpMax - 1, injuryHp(turn, me));
      const his = Math.min(him.hpMax - 1, injuryHp(turn, him));
      me.hpMax -= mine;
      him.hpMax -= his;
      try {
        return visitModule.press(turn, command);
      } finally {
        me.hpMax += mine;
        him.hpMax += his;
      }
    }
    if (command === "trydoor" && him && him.id !== turn.player.id) {
      const chance = defenceLevel(rules, him) * rules.pvp.turnAwayPerLevel;
      if (chance > 0 && turn.rng.random(100) < chance) {
        sendPacket(turn.town, him.id, { type: "text", text: t.turnedAwayMail });
        mailContinue(turn, him.id);
        turn.session.locked = false;
        return visitScreen(turn, fill(t.turnedAway, { name: him.name }));
      }
    }
    const view = visitModule.press(turn, command);
    if (command === "steal" && him && (him.custom[Custom.Safe] ?? 0) === 0) {
      const amount = Math.min(
        rules.pvp.cashSteal.max,
        Math.floor(him.money * rules.pvp.cashSteal.share),
      );
      if (amount > 0) {
        moneyMod(him, -amount);
        moneyMod(turn.player, amount);
        view.text = [...view.text, ...legacy(fill(t.cashStolen, { money: intToCash(amount) }))];
        view.hud = hud(turn.player);
        sendPacket(turn.town, him.id, {
          type: "text",
          text: fill(t.cashStolenMail, { money: intToCash(amount) }),
        });
      }
    }
    return view;
  },
  confirm(turn, overlayId, accepted) {
    if (!visitModule.confirm) throw new Error("No visits");
    if (overlayId === "competitors:namenext" && accepted) {
      const target = turn.town.players[readNameSearch(turn.session.sceneData).hisId];
      if (target && target.id !== turn.player.id && isPeaceful(target)) {
        return visitScreen(turn, fill(xc(turn).text.visit.targetPeaceful, { name: target.name }));
      }
      if (target && sameChain(turn.town, turn.player, target)) {
        return visitScreen(turn, fill(xt(turn).text.chains.noFriendlyFire, { name: target.name }));
      }
    }
    return visitModule.confirm(turn, overlayId, accepted);
  },
};
