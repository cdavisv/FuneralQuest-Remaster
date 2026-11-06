import { Custom } from "../../state/types.js";
import type { ScriptApi, ScriptDef, ScriptGen } from "./runtime.js";

/**
 * Ports of `script/store_security.c` and `script/store_supplies.c`, the two
 * Di-Mart sub-menus (UTF-16 files; read with `iconv -f UTF-16`). The store
 * runs them from its Security and Supplies buttons (command_store.cpp:20-33).
 * Prices come from `ClassicRules.places.store` through one operation, so the
 * journal replays exactly. Text is the scripts' own wording, as in the other
 * ports.
 */

const GOLD = 2;
const STORE_MENU = { go: "store" } as const;

interface Prices {
  smokeDetector: number;
  safe: number;
  padlock: number;
  lockpick: number;
  padlockStrength: number;
}

function prices(s: ScriptApi): ScriptGen<Prices> {
  return s.op((t) => ({ ...t.rules.places.store }));
}

/** `SetCustomById` */
function setCustom(s: ScriptApi, index: number, value: number): ScriptGen<number> {
  return s.op((t) => {
    const p = t.town.players[s.myId];
    if (p?.active) p.custom[index] = value;
    return value;
  });
}

/** `ModCustomById` */
function modCustom(s: ScriptApi, index: number, amount: number): ScriptGen<number> {
  return s.op((t) => {
    const p = t.town.players[s.myId];
    if (!p?.active) return 0;
    p.custom[index] = (p.custom[index] ?? 0) + amount;
    return p.custom[index] as number;
  });
}

/** A screen with only a Continue button (result 1), as every message in the scripts. */
function* message(s: ScriptApi, picture: string, text: string): ScriptGen {
  yield* s.show({
    mode: "screen",
    picture,
    text,
    buttons: [{ slot: 1, label: "Continue", target: { result: 1 } }],
  });
}

const GUY = "people/store_guy";
const MONEY = "stuff/money_bag_2";

interface Item {
  picture: string;
  info: string;
  owned: boolean;
  ownedText: string;
  price: number;
  brokeText: string;
  /** Marks the item as bought (the `SetCustomById` calls). */
  give(s: ScriptApi): ScriptGen;
  boughtText: string;
}

/** `DisplaySmokeDetector`, `DisplayPadlock` and `DisplaySafe`: they share one shape. */
function* displayItem(s: ScriptApi, item: Item): ScriptGen {
  const choice = yield* s.show({
    mode: "screen",
    picture: item.picture,
    text: item.info,
    buttons: [
      { slot: 1, label: "Back", target: { result: 1 } },
      { slot: 2, label: "Buy it", target: { result: 2 } },
    ],
  });
  if (choice !== 2) return;
  if (item.owned) {
    yield* message(s, GUY, item.ownedText);
    return;
  }
  const gold = yield* s.getTags(s.myId, GOLD);
  if (gold < item.price) {
    yield* message(s, GUY, item.brokeText);
    return;
  }
  yield* item.give(s);
  yield* s.setTags(s.myId, GOLD, gold - item.price);
  yield* message(s, MONEY, item.boughtText);
}

/** store_security.c `Main` (lines 209-288). */
export const storeSecurityScript: ScriptDef = {
  id: "store_security",
  location: "Store",
  *main(s: ScriptApi): ScriptGen {
    const price = yield* prices(s);
    for (;;) {
      // main_menu:
      const smoke = yield* s.getCustom(s.myId, Custom.FireAlarm);
      const padlock = yield* s.getCustom(s.myId, Custom.Padlock);
      const safe = yield* s.getCustom(s.myId, Custom.Safe);
      const strength = yield* s.getCustom(s.myId, Custom.PadlockStrength);
      let items =
        '`wElijah: `y"This town seems accident prone.  Investing in security is a great idea."\n\n';
      const padlockNote =
        padlock === 1 ? ` (\`walready own one at ${strength} percent strength\`y)` : "";
      items += `\`w1\`y - Heavy Padlock - Cost: \`w${price.padlock}\`y gold tags${padlockNote}\n`;
      const smokeNote = smoke === 1 ? " (`walready own one`y)" : "";
      items += `\`w2\`y - Smoke Detector - Cost: \`w${price.smokeDetector}\`y gold tags${smokeNote}\n`;
      const safeNote = safe === 1 ? " (`walready own one`y)" : "";
      items += `\`w3\`y - Safe - Cost: \`w${price.safe}\`y gold tags${safeNote}\n`;
      const choice = yield* s.show({
        mode: "screen",
        note: "You are in the supplies section.",
        status: "",
        text: items,
        picture: GUY,
        buttons: [
          { slot: 1, label: "Back", target: STORE_MENU },
          { slot: 4, label: "View #1", target: { result: 2 } },
          { slot: 3, label: "View #2", target: { result: 3 } },
          { slot: 2, label: "View #3", target: { result: 4 } },
        ],
      });
      if (choice === 2) {
        yield* displayItem(s, {
          picture: "stuff/padlock",
          info: `\`ySecure your parlor and stop intruders with a new steel laminated \`wHeavy Padlock\`y.  The shackle is crome plated and hardened to maximize its strength. Only \`w${price.padlock}\`y gold tags.\n\n\`wEffect: \`yCasual thieves will no longer be able to break into your parlor.`,
          owned: padlock === 1,
          ownedText: '`wElija: `y"Wait until the one you have breaks. Sorry, company policy."',
          price: price.padlock,
          brokeText:
            '`wElija: `y"I\'m sorry, you seem to be lacking in funds.  Perhaps another time?"\n\nYou mumble something about leaving the gold tags in your other pants.',
          *give(g) {
            yield* setCustom(g, Custom.Padlock, 1);
            yield* setCustom(g, Custom.PadlockStrength, price.padlockStrength);
          },
          boughtText: `\`yYou purchase the \`wHeavy Padlock\`y for \`w${price.padlock}\`y gold tags.`,
        });
      }
      if (choice === 3) {
        yield* displayItem(s, {
          picture: "stuff/fire_alarm",
          info: `\`yA \`wSmoke Detector\`y will allow you to notice fires and call the fire department much quicker.  It retails here for \`w${price.smokeDetector}\`y gold tags.\n\n\`wEffect: \`yReduce the risk of a fire getting large enough to cause damage to 20 percent.`,
          owned: smoke === 1,
          ownedText:
            '`wElija: `y"Your parlor is quite small.  You really don\'t need two of these things."\n\nYou nod in agreement.  Why waste the cash?',
          price: price.smokeDetector,
          brokeText:
            "`wElija: `y\"I'm sorry, you seem to be lacking in funds.  Perhaps another time?\"\n\nYou feel like a complete dumbass.  He's right.",
          *give(g) {
            yield* setCustom(g, Custom.FireAlarm, 1);
          },
          boughtText: `\`yYou purchase the \`wSmoke Detector\`y for \`w${price.smokeDetector}\`y gold tags.`,
        });
      }
      if (choice === 4) {
        yield* displayItem(s, {
          picture: "stuff/safe",
          info: `\`yOur commercial \`wSafe\`y is the perfect way to product your valuables.  Features steel castors and automatic re-locking system.  Only \`w${price.safe}\`y gold tags.\n\n\`wEffect: \`ySales tags cannot be stolen or damaged in a fire.`,
          owned: safe === 1,
          ownedText: '`wElija: `y"You already own a Safe.  You shouldn\'t need two."',
          price: price.safe,
          brokeText:
            '`wElija: `y"I\'m sorry, you seem to be lacking in funds.  Perhaps another time?"\n\nYou nod in agreement.',
          *give(g) {
            yield* setCustom(g, Custom.Safe, 1);
          },
          boughtText: `\`yYou purchase the \`wSafe\`y for \`w${price.safe}\`y gold tags.`,
        });
      }
    }
  },
};

/** store_supplies.c `DisplayLockpickInfo` (lines 14-68): buying loops back to the same screen. */
function* lockpickInfo(s: ScriptApi, price: number, owned: number): ScriptGen {
  let have = owned;
  for (;;) {
    const choice = yield* s.show({
      mode: "screen",
      picture: "stuff/lockpick",
      text: `Have you ever accidently locked yourself out of your parlor?  A \`wLockpick\`y can 'let' you back in!  These are \`w${price}\`y gold tag each.  (You currently have \`w${have}\`y lockpick(s))\n\n\`wEffect: \`yWill instantly open any parlor front door.  One time use.`,
      buttons: [
        { slot: 1, label: "Back", target: { result: 1 } },
        { slot: 2, label: "Buy one", target: { result: 2 } },
      ],
    });
    if (choice !== 2) return;
    const gold = yield* s.getTags(s.myId, GOLD);
    if (gold < price) {
      yield* message(
        s,
        GUY,
        "`wElija: `y\"You don't have a single gold tag at the moment?  That's too bad.  These are great little lockpicks.\"",
      );
      return;
    }
    yield* modCustom(s, Custom.Lockpick, 1);
    have += 1;
    yield* s.setTags(s.myId, GOLD, gold - price);
    yield* message(s, MONEY, `\`yYou purchase a \`wLockpick\`y for \`w${price}\`y gold tag.`);
  }
}

/** store_supplies.c `Main` (lines 70-107). */
export const storeSuppliesScript: ScriptDef = {
  id: "store_supplies",
  location: "Store",
  *main(s: ScriptApi): ScriptGen {
    const price = yield* prices(s);
    for (;;) {
      // main_menu:
      const owned = yield* s.getCustom(s.myId, Custom.Lockpick);
      const choice = yield* s.show({
        mode: "screen",
        note: "You are in the supplies section.",
        status: "",
        text: `\`wElijah: \`y"We carry a wide assortment of useful items."\n\n\`w1\`y - Lockpick - Cost: \`w${price.lockpick}\`y gold tag\n`,
        picture: GUY,
        buttons: [
          { slot: 1, label: "Back", target: STORE_MENU },
          { slot: 2, label: "View #1", target: { result: 1 } },
        ],
      });
      if (choice === 1) yield* lockpickInfo(s, price.lockpick, owned);
    }
  },
};

export const STORE_SCRIPTS: readonly ScriptDef[] = [storeSecurityScript, storeSuppliesScript];
