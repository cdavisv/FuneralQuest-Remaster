import type { View } from "@fq/protocol";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { button } from "../../engine/view.js";
import { fill } from "../../text/format.js";
import { stripLegacyCodes } from "../../text/legacyText.js";
import { casketName } from "../customerText.js";
import { enterLocation } from "../location.js";
import { atoi } from "../parse.js";
import { newScreen, refreshScreen, slotButtons, withOverlay } from "../placeView.js";
import { playerSir } from "../players.js";

/**
 * The bank (legacy/source/commands_bank.cpp): exchange casket tags between
 * tiers at 1 wood : 2 silver : 4 gold, one tier pair at a time, or convert
 * everything to wood or to gold.
 *
 * Button ids: `bank:exchange` (pick a tier), `bank:wood|silver|gold` (pick
 * the target), `bank:ask:<from>:<to>` (the count prompt), `bank:all-wood`,
 * `bank:all-gold`. The count prompt is the overlay `bank:count`.
 */
export const BANK = "bank";

const WOOD = 0;
const SILVER = 1;
const GOLD = 2;
const TIER_NAMES = ["wood", "silver", "gold"] as const;

/** Longest count the prompt accepts (the original client's limit is not in the repository). */
const COUNT_LENGTH = 12;

const f32 = Math.fround;

/** What `tag_exchange_ok` decided (commands_bank.cpp:155-221). */
export type ExchangeResult =
  | { kind: "none" }
  | { kind: "negative" }
  | { kind: "notEnough" }
  | { kind: "tooFew" }
  | { kind: "done"; lost: number; gained: number };

/**
 * `tag_exchange_ok` (commands_bank.cpp:155-221), the checks in the original's
 * order, then the exchange itself (:213-220): `to_gain` rounds down in
 * 32-bit floats and only the tags that pay for it are taken.
 */
export function exchangeTags(turn: Turn, count: number, from: number, to: number): ExchangeResult {
  const values = turn.rules.places.tagValues;
  const fromValue = values[from] ?? 1;
  const toValue = values[to] ?? 3;
  const tags = turn.player.tags;
  if (count === 0) return { kind: "none" };
  if (count < 0) return { kind: "negative" };
  if (count > (tags[from] ?? 0)) return { kind: "notEnough" };
  if (Math.trunc((fromValue * count) / toValue) < 1) return { kind: "tooFew" };
  const gained = Math.trunc(f32(f32(count) * f32(f32(fromValue) / f32(toValue))));
  const lost = Math.trunc(f32(f32(f32(gained) * f32(toValue)) / f32(fromValue)));
  tags[from] = (tags[from] ?? 0) - lost;
  tags[to] = (tags[to] ?? 0) + gained;
  return { kind: "done", lost, gained };
}

/**
 * `ConvertAllTagsToWood` (:417-428): silver and gold become wood at their
 * values; the tiers are emptied.
 */
function allTagsToWood(turn: Turn): void {
  const values = turn.rules.places.tagValues;
  const tags = turn.player.tags;
  tags[WOOD] = (tags[WOOD] ?? 0) + (tags[SILVER] ?? 0) * (values[SILVER] ?? 2);
  tags[WOOD] = (tags[WOOD] ?? 0) + (tags[GOLD] ?? 0) * (values[GOLD] ?? 4);
  tags[SILVER] = 0;
  tags[GOLD] = 0;
}

/**
 * `ConvertWoodTagsToGold` (:430-469): trades all wood for gold the way the
 * count prompt does, without a message. Fewer than one gold's worth does nothing.
 */
function woodToGold(turn: Turn): void {
  const values = turn.rules.places.tagValues;
  const fromValue = values[WOOD] ?? 1;
  const toValue = values[GOLD] ?? 4;
  const tags = turn.player.tags;
  const count = tags[WOOD] ?? 0;
  if (Math.trunc((fromValue * count) / toValue) < 1) return;
  const gained = Math.trunc(f32(f32(count) * f32(f32(fromValue) / f32(toValue))));
  const lost = Math.trunc(f32(f32(f32(gained) * f32(toValue)) / f32(fromValue)));
  tags[WOOD] = (tags[WOOD] ?? 0) - lost;
  tags[GOLD] = (tags[GOLD] ?? 0) + gained;
}

function labels(turn: Turn) {
  return turn.text.places.bank.buttons;
}

/** `AddBankCommands` (:378-388): the main menu buttons. */
function mainButtons(turn: Turn) {
  const b = labels(turn);
  return slotButtons([
    { slot: 4, label: b.allToWood, id: `${BANK}:all-wood` },
    { slot: 3, label: b.allToGold, id: `${BANK}:all-gold` },
    { slot: 2, label: b.exchange, id: `${BANK}:exchange` },
    { slot: 1, label: b.leave, id: "go:map" },
  ]);
}

/** `command_bank` (:390-415): the bank's front screen. */
function enterBank(turn: Turn): View {
  const t = turn.text.places.bank;
  enterLocation(turn, t.location);
  return newScreen(turn, {
    title: t.location,
    note: t.note,
    status: "",
    text: fill(t.greeting, { player: turn.player.name }),
    bg: "places/bank",
    buttons: mainButtons(turn),
  });
}

/** The Gold / Silver / Wood / Back row of `bank_exchange` and the success screen. */
function tierButtons(turn: Turn, back: string) {
  const b = labels(turn);
  return slotButtons([
    { slot: 2, label: b.gold, id: `${BANK}:gold` },
    { slot: 3, label: b.silver, id: `${BANK}:silver` },
    { slot: 4, label: b.wood, id: `${BANK}:wood` },
    { slot: 1, label: b.back, id: back },
  ]);
}

/** `bank_exchange` (:307-326): which tier to exchange. */
function exchangeMenu(turn: Turn): View {
  turn.session.sceneData = null;
  return refreshScreen(turn, {
    text: turn.text.places.bank.which,
    buttons: tierButtons(turn, `go:${BANK}`),
  });
}

/**
 * `bank_exchange_wood`, `_silver`, `_gold` (:328-377): what to convert the
 * tier to. Wood offers Gold and Silver, silver Gold and Wood, gold Silver and
 * Wood, in slots 2 and 3, with Back in slot 1.
 */
function convertMenu(turn: Turn, from: number): View {
  const b = labels(turn);
  const targets = [
    { tier: GOLD, label: b.gold },
    { tier: SILVER, label: b.silver },
    { tier: WOOD, label: b.wood },
  ].filter((c) => c.tier !== from);
  const list = targets.map((c, i) => ({
    slot: 2 + i,
    label: c.label,
    id: `${BANK}:ask:${from}:${c.tier}`,
  }));
  list.push({ slot: 1, label: b.back, id: `${BANK}:exchange` });
  return refreshScreen(turn, {
    text: fill(turn.text.places.bank.convertTo, { from: casketName(from) }),
    buttons: slotButtons(list),
  });
}

/** `bank_exchange_input` (:265-305): the ratio prompt. */
function countPrompt(turn: Turn, from: number, to: number): View {
  const values = turn.rules.places.tagValues;
  const fromValue = values[from] ?? 0;
  const toValue = values[to] ?? 0;
  let holdFrom = Math.trunc(toValue / fromValue);
  let holdTo = 1;
  if (from === SILVER && to === GOLD) holdFrom = 2;
  if (holdFrom < 1) {
    holdTo = Math.trunc(fromValue / toValue);
    holdFrom = 1;
  }
  turn.session.sceneData = { from, to };
  const prompt = fill(turn.text.places.bank.ratio, {
    fromCount: holdFrom,
    from: casketName(from),
    toCount: holdTo,
    to: casketName(to),
  });
  return withOverlay(turn, {
    kind: "textInput",
    id: `${BANK}:count`,
    prompt: stripLegacyCodes(prompt),
    maxLength: COUNT_LENGTH,
  });
}

function continueToExchange(turn: Turn, text: string): View {
  return refreshScreen(turn, {
    text,
    buttons: [button(`${BANK}:exchange`, labels(turn).continue)],
  });
}

/** `bank_exchange_all` (:225-263) after the count came back. */
function processCount(turn: Turn, answer: string | null): View {
  const data = turn.session.sceneData;
  if (answer === null || data === null || typeof data !== "object" || Array.isArray(data)) {
    // "12ABORT12" (:232-236), or nothing was asked.
    return exchangeMenu(turn);
  }
  const from = Number(data.from);
  const to = Number(data.to);
  const t = turn.text.places.bank;
  const result = exchangeTags(turn, atoi(answer), from, to);
  switch (result.kind) {
    case "none":
      return exchangeMenu(turn);
    case "negative":
      return continueToExchange(turn, fill(t.amusing, { sir: playerSir(turn.player) }));
    case "notEnough":
      return continueToExchange(turn, t.notEnough);
    case "tooFew":
      return continueToExchange(turn, fill(t.tooFew, { count: atoi(answer), to: casketName(to) }));
    case "done":
      turn.session.sceneData = null;
      return refreshScreen(turn, {
        text: fill(t.done, {
          lost: result.lost,
          from: casketName(from),
          gained: result.gained,
          to: casketName(to),
        }),
        buttons: tierButtons(turn, `go:${BANK}`),
      });
  }
}

export const bankModule: LocationModule = {
  id: BANK,
  enter: (turn) => enterBank(turn),
  press(turn, command) {
    const parts = command.split(":");
    switch (parts[0]) {
      case "exchange":
        return exchangeMenu(turn);
      case "wood":
        return convertMenu(turn, WOOD);
      case "silver":
        return convertMenu(turn, SILVER);
      case "gold":
        return convertMenu(turn, GOLD);
      case "ask": {
        const from = Number(parts[1]);
        const to = Number(parts[2]);
        if (!TIER_NAMES[from] || !TIER_NAMES[to] || from === to) throw new Error("Bad exchange");
        return countPrompt(turn, from, to);
      }
      case "all-wood":
        // ConvertAllToWood (:472-488)
        allTagsToWood(turn);
        return refreshScreen(turn, {
          text: turn.text.places.bank.allToWood,
          buttons: mainButtons(turn),
        });
      case "all-gold":
        // ConvertAllToGold (:492-517): all to wood first, then wood to gold.
        allTagsToWood(turn);
        woodToGold(turn);
        return refreshScreen(turn, {
          text: turn.text.places.bank.allToGold,
          buttons: mainButtons(turn),
        });
      default:
        throw new Error(`Unknown bank command ${command}`);
    }
  },
  submitText(turn, overlayId, text) {
    if (overlayId !== `${BANK}:count`) throw new Error(`Unknown bank prompt ${overlayId}`);
    return processCount(turn, text);
  },
};
