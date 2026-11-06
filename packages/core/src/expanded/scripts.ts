import { bonusTag, handleFireAlarm } from "../classic/scripts/classicScripts.js";
import type { ScriptApi, ScriptDef, ScriptGen } from "../classic/scripts/runtime.js";
import { Custom } from "../state/types.js";
import { fill } from "../text/format.js";
import { refreshRating } from "./parlor.js";
import { reviewsMod, xc, xr } from "./players.js";
import { sameChain } from "./town/life.js";

/**
 * Expanded script events (docs/expanded-rules.md section 9.6): the Classic
 * `script_event.c` pick, with an arson that now burns casket stock and the
 * parlor's reputation, and cannot touch a Peace Pledge parlor.
 */
const WOOD = 0;
const GOLD = 2;

const home = (slot: number, label: string) => ({ slot, label, target: { go: "desk" } });

function* arsonX(s: ScriptApi): ScriptGen {
  const cost = 6;
  const text = yield* s.op((t) => {
    const a = xc(t).text.arson;
    return {
      offer: fill(a.offer, { cost }),
      peaceful: a.peaceful,
      chainMate: t.content.expanded?.town?.text.chains.noFriendlyFire ?? a.peaceful,
      burned: a.burned,
      burnedMail: a.burnedMail,
    };
  });
  let packet: { text?: string; picture?: string; background?: string } = {
    text: text.offer,
    background: "background/background_5",
    picture: "people/m_old_3",
  };
  for (;;) {
    const choice = yield* s.show({
      mode: "screen",
      ...packet,
      buttons: [{ slot: 2, label: "Hire Twins", target: { result: 1 } }, home(1, "No Thanks")],
    });
    packet = {};
    if (choice === 1) {
      const gold = yield* s.getTags(s.myId, GOLD);
      if (gold < cost) {
        yield* s.show({
          mode: "screen",
          text: '`wThe Twins: `y"You don\'t have enough gold tags, fool!  We shall come again..."',
          buttons: [home(1, "Continue")],
        });
      }
    }
    const target = yield* s.show({
      mode: "overlay",
      prompt: "Who would you like the Twins to pay a visit to?",
      buttons: [],
    });
    if (target === -1) {
      packet = { text: "`yThe twins look confused.  Better try again." };
      continue;
    }
    if (target === s.myId) {
      packet = {
        text: "`yEven as a joke you don't think you should suggest the twins burn down your own building.  Try again.",
      };
      continue;
    }
    const peaceful = yield* s.op((t) =>
      t.town.players[target]?.expanded?.rivalry === "peaceful" ? 1 : 0,
    );
    if (peaceful === 1) {
      packet = { text: text.peaceful };
      continue;
    }
    // Section 23.3: the twins will not burn a chain-mate's parlor.
    const mate = yield* s.op((t) => (sameChain(t.town, t.player, t.town.players[target]) ? 1 : 0));
    if (mate === 1) {
      packet = { text: fill(text.chainMate, { name: yield* s.getName(target) }) };
      continue;
    }
    const onNow = yield* s.isPlayerOnNow(target);
    const targetName = yield* s.getName(target);
    const targetHome = yield* s.getHomeName(target);
    if (onNow === 1) {
      packet = {
        text: `\`yThe twins shake their heads vigorously.  Apparently they saw ${targetName} working in the yard.`,
      };
      continue;
    }
    const alarm = yield* s.getCustom(target, Custom.FireAlarm);
    if (alarm === 1) {
      const caught = yield* s.randomRange(1, 10);
      if (caught > 2) {
        yield* handleFireAlarm(s, target, targetName, targetHome, cost);
        return;
      }
    }
    const plots = yield* s.getTotalBurials(target);
    const burned = Math.trunc(plots * 0.05);
    const safe = yield* s.getCustom(target, Custom.Safe);
    const tagsLost = safe === 0 ? yield* s.getTags(target, WOOD) : 0;
    yield* s.modTags(s.myId, GOLD, -cost);
    // Section 9.6: half the stock (rounded up) and word of mouth burn too.
    const stockLost = yield* s.op((t) => {
      const victim = t.town.players[target];
      const x = victim?.expanded;
      if (!victim || !x) return 0;
      const rules = xr(t);
      let lost = 0;
      for (const tier of [0, 1, 2] as const) {
        const n = Math.ceil(x.stock[tier] * rules.pvp.arson.stockShare);
        x.stock[tier] -= n;
        lost += n;
      }
      reviewsMod(victim, rules, rules.pvp.arson.reviews);
      refreshRating(t.rules, victim);
      return lost;
    });
    const vars = { home: targetHome, name: targetName, burned, tags: tagsLost, stock: stockLost };
    yield* s.addToNews(
      `\`7PARLOR GETS BURNED\n\`^A small fire was not noticed until too late at ${targetHome} today.  "Faulty wiring my ass, someone is gonna pay for this!" said a distraught ${targetName}.\n\n`,
    );
    yield* s.broadcastTv(
      `You see some breaking news.  It looks like ${targetName}'s parlor caught on fire.`,
    );
    yield* s.mailText(target, fill(text.burnedMail, vars));
    if (safe === 0) yield* s.setTags(target, WOOD, 0);
    yield* s.mailPicture(target, "stuff/fire_alarm");
    yield* s.mailContinueButton(target);
    yield* s.modTotalBurials(target, -burned);
    yield* s.show({
      mode: "screen",
      text: fill(text.burned, vars),
      picture: "places/fire",
      buttons: [home(1, "Continue")],
    });
  }
}

/** `script_event.c` for Expanded towns: arson or a bonus tag, 50/50 as in Classic. */
export const expandedScriptEvent: ScriptDef = {
  id: "script_event",
  location: "Home",
  *main(s: ScriptApi): ScriptGen {
    const pick = yield* s.randomRange(1, 2);
    if (pick === 1) yield* arsonX(s);
    if (pick === 2) yield* bonusTag(s);
  },
};
