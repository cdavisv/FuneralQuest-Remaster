import type { View } from "@fq/protocol";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { button } from "../../engine/view.js";
import { fill } from "../../text/format.js";
import { stripLegacyCodes } from "../../text/legacyText.js";
import { isBlocking } from "../blocking.js";
import { computeEvent } from "../events.js";
import { enterLocation } from "../location.js";
import { broadcastTv, mailContinue, mailPicture, mailReward, mailText } from "../mail.js";
import { addToNews } from "../news.js";
import { newScreen, refreshScreen, slotButtons, withOverlay } from "../placeView.js";
import { expMod, luckMod } from "../players.js";
import { filterUserText } from "../userText.js";

/**
 * Yang's (legacy/source/commands_yangs.cpp): Order #1 the Lucky Dragon (eat
 * in, only when luck is below 40), #2 the Lucky Sparrow and #3 the Cursed
 * Tiger (delivered to another parlor, one delivery a day between them).
 *
 * Button ids: `yangs:dragon|sparrow|tiger|menu|bitchy`. Overlays:
 * `yangs:tiger-target`, `yangs:sparrow-target` (name pickers) and
 * `yangs:tiger-fortune`, `yangs:sparrow-fortune` (the fortune prompt).
 *
 * The original declares `i_cost[3]` and `i_mod[3]` (:13-33) but indexes them
 * with C_YANGS_DRAGON = 3, so its constructor writes one element past each
 * array (it clobbers `i_mod[0]` and the memory after the object). Nothing
 * reads index 3: the dragon handler hard-codes 5 BP and 10 luck, as does the
 * tiger (20 BP, 10 luck). The intended costs are in `ClassicRules.places.yangs`.
 */
export const YANGS = "yangs";

/** Longest custom fortune the prompt accepts (the original client's limit is not in the repository). */
const FORTUNE_LENGTH = 200;

type Dish = "tiger" | "sparrow";

function labels(turn: Turn) {
  return turn.text.places.yangs.buttons;
}

/** `yangs_add_menu_buttons` (:200-207), left to right: #1, #2, #3, Leave. */
function menuButtons(turn: Turn) {
  const b = labels(turn);
  return slotButtons([
    { slot: 4, label: b.order1, id: `${YANGS}:dragon` },
    { slot: 3, label: b.order2, id: `${YANGS}:sparrow` },
    { slot: 2, label: b.order3, id: `${YANGS}:tiger` },
    { slot: 1, label: b.leave, id: "go:map" },
  ]);
}

/** `yangs_add_menu` (:209-220). */
function menuText(turn: Turn): string {
  const y = turn.rules.places.yangs;
  return fill(turn.text.places.yangs.menu, {
    dragonLuck: y.dragon.luck,
    dragonCost: y.dragon.cost,
    sparrowLuck: y.sparrow.luck,
    sparrowCost: y.sparrow.cost,
    tigerLuck: y.tiger.luck,
    tigerCost: y.tiger.cost,
  });
}

/** `command_yangs` (:290-340). Someone thrown out for the day only sees June's brush-off. */
function enterYangs(turn: Turn): View {
  const t = turn.text.places.yangs;
  if (turn.player.kickedOutOfYangs) {
    // The original does not call init_location_info here (:303-318).
    return newScreen(turn, {
      title: t.location,
      note: t.note,
      status: t.statusKicked,
      text: fill(t.kicked, { player: turn.player.name }),
      bg: "places/yangs",
      buttons: [button("go:map", labels(turn).leave)],
    });
  }
  enterLocation(turn, t.location);
  return newScreen(turn, {
    title: t.location,
    note: t.note,
    status: t.statusReady,
    text: menuText(turn),
    bg: "places/yangs",
    buttons: menuButtons(turn),
  });
}

/** `command_yangs_show_menu` (:274-288). */
function showMenu(turn: Turn): View {
  turn.session.sceneData = null;
  return refreshScreen(turn, { text: menuText(turn), buttons: menuButtons(turn) });
}

function continueMenu(turn: Turn, text: string): View {
  turn.session.sceneData = null;
  return refreshScreen(turn, {
    text,
    buttons: [button(`${YANGS}:menu`, labels(turn).continue)],
  });
}

/**
 * `command_yangs_number_4` (:342-372): the Lucky Dragon. Only below 40 luck
 * (it would be wasted otherwise), and the price is checked against today's
 * Bury Points (`i_sp`), not the total.
 */
function dragon(turn: Turn): View {
  const t = turn.text.places.yangs;
  const rule = turn.rules.places.yangs.dragon;
  const p = turn.player;
  if (p.luck >= rule.onlyBelowLuck) {
    return continueMenu(turn, fill(t.dragonLater, { limit: rule.onlyBelowLuck }));
  }
  if (p.bpToday < rule.cost) return continueMenu(turn, t.dragonBroke);
  expMod(p, -rule.cost);
  luckMod(turn.rules, p, rule.luck);
  return continueMenu(turn, fill(t.dragonDone, { luck: rule.luck }));
}

/** `command_get_name_delivery_tiger` / `_sparrow` (:79-140). */
function startDelivery(turn: Turn, dish: Dish): View {
  const t = turn.text.places.yangs;
  const p = turn.player;
  if (p.yangsSent >= turn.settings.yangsPerDay) {
    const b = labels(turn);
    return refreshScreen(turn, {
      text: dish === "tiger" ? fill(t.tigerOut, { player: p.name }) : t.sparrowOut,
      buttons: slotButtons([
        { slot: 1, label: b.continue, id: `${YANGS}:menu` },
        { slot: 2, label: b.getBitchy, id: `${YANGS}:bitchy` },
      ]),
    });
  }
  return withOverlay(turn, {
    kind: "playerPicker",
    id: `${YANGS}:${dish}-target`,
    prompt: stripLegacyCodes(dish === "tiger" ? t.tigerWho : t.sparrowWho),
    // A player who blocked the sender is not offered (classic/blocking.ts).
    players: turn.town.players
      .filter((q) => q.active && !isBlocking(turn.town, q.id, turn.playerId))
      .map((q) => ({ id: q.id, name: q.name })),
  });
}

/** `command_yangs_get_fortune` / `_sparrow` (:222-272): a name came back, ask for the fortune. */
function askFortune(turn: Turn, dish: Dish, target: number | null): View {
  if (target === null) return showMenu(turn); // i_his_id == -1 (:225-229)
  turn.session.sceneData = { target };
  return withOverlay(turn, {
    kind: "textInput",
    id: `${YANGS}:${dish}-fortune`,
    prompt: stripLegacyCodes(turn.text.places.yangs.fortunePrompt),
    maxLength: FORTUNE_LENGTH,
  });
}

/** `command_yangs_bitchy` (:36-57): thrown out until tomorrow. */
function bitchy(turn: Turn): View {
  turn.player.kickedOutOfYangs = true;
  return refreshScreen(turn, {
    text: fill(turn.text.places.yangs.bitchy, { player: turn.player.name }),
    buttons: [button("go:map", labels(turn).leave)],
  });
}

/** The checks and the delivery of `command_yangs_dev` (:374-500) and `_sparrow` (:502-end). */
function deliver(turn: Turn, dish: Dish, answer: string | null): View {
  const data = turn.session.sceneData;
  const target =
    data !== null && typeof data === "object" && !Array.isArray(data) ? Number(data.target) : -1;
  // "12ABORT12": the prompt was cancelled (:378-384).
  if (answer === null || target === -1) return showMenu(turn);
  // The original never filtered fortunes; `filterUserText` does when `rules.filterUserText` is on.
  let fortune = filterUserText(turn, answer.trim(), "fortune");
  const t = turn.text.places.yangs;
  const rule = turn.rules.places.yangs[dish];
  const me = turn.player;
  const perDay = turn.settings.yangsPerDay;
  if (me.yangsSent >= perDay) return continueMenu(turn, fill(t.limit, { perDay }));
  if (target === me.id) {
    return continueMenu(turn, fill(t.selfTarget, { player: me.name })); // no_deliver_possible (:59-77)
  }
  const victim = turn.town.players[target];
  if (!victim?.active || isBlocking(turn.town, target, me.id)) return continueMenu(turn, t.notHome);
  if (me.bpToday < rule.cost) return continueMenu(turn, t.noPoints);

  me.yangsSent++;
  expMod(me, -rule.cost);
  // CEvent::compute_event on the target's total BP: one random(count) draw.
  const table = dish === "tiger" ? turn.content.fortunes : turn.content.niceFortunes;
  const event = computeEvent(turn.rng, table, victim.bp, {
    message: turn.text.wait.noMessage,
    picture: "blank",
  });
  if (fortune === "") fortune = event.message;
  broadcastTv(turn, fill(t.tv, { parlor: victim.parlor }));
  if (dish === "tiger" && turn.rng.random(turn.rules.places.yangs.newsOdds) === 1) {
    // Somebody saw: one of four front-page items (:312-339). The sparrow's is commented out.
    const line = t.news[turn.rng.random(t.news.length)];
    if (line !== undefined)
      addToNews(turn.town, fill(line, { name: me.name, parlor: victim.parlor }));
  }
  const mail = dish === "tiger" ? t.tigerMail : t.sparrowMail;
  mailText(turn.town, target, fill(mail, { name: me.name, fortune, luck: rule.luck }));
  mailReward(turn, target, "luck", dish === "tiger" ? -rule.luck : rule.luck);
  mailPicture(turn.town, target, "chinese_takeout");
  mailContinue(turn, target);
  turn.log(
    fill(dish === "tiger" ? t.logTiger : t.logSparrow, {
      name: me.name,
      target: victim.name,
      fortune,
    }),
  );
  return continueMenu(turn, t.leaves);
}

export const yangsModule: LocationModule = {
  id: YANGS,
  enter: (turn) => enterYangs(turn),
  press(turn, command) {
    switch (command) {
      case "dragon":
        return dragon(turn);
      case "sparrow":
        return startDelivery(turn, "sparrow");
      case "tiger":
        return startDelivery(turn, "tiger");
      case "menu":
        return showMenu(turn);
      case "bitchy":
        return bitchy(turn);
      default:
        throw new Error(`Unknown Yang's command ${command}`);
    }
  },
  pickPlayer(turn, overlayId, playerId) {
    if (overlayId === `${YANGS}:tiger-target`) return askFortune(turn, "tiger", playerId);
    if (overlayId === `${YANGS}:sparrow-target`) return askFortune(turn, "sparrow", playerId);
    throw new Error(`Unknown Yang's picker ${overlayId}`);
  },
  submitText(turn, overlayId, text) {
    if (overlayId === `${YANGS}:tiger-fortune`) return deliver(turn, "tiger", text);
    if (overlayId === `${YANGS}:sparrow-fortune`) return deliver(turn, "sparrow", text);
    throw new Error(`Unknown Yang's prompt ${overlayId}`);
  },
};
