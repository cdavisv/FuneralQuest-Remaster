import { Custom } from "../../state/types.js";
import type { ScriptApi, ScriptDef, ScriptGen } from "./runtime.js";

/**
 * Ports of the Classic scene scripts in legacy/dist/script (UTF-16 files;
 * read them with `iconv -f UTF-16`). Text is the scripts' own wording; the
 * scripts are code in the original too, so it stays here.
 */

const WOOD = 0;
const GOLD = 2;

const home = (slot: number, label: string) => ({ slot, label, target: { go: "desk" } });

/** script/stats.c: the stats sheet. */
export const statsScript: ScriptDef = {
  id: "stats",
  location: "Stats",
  *main(s: ScriptApi): ScriptGen {
    let text = "`y";
    const smoke = yield* s.getCustom(s.myId, Custom.FireAlarm);
    const padlock = yield* s.getCustom(s.myId, Custom.Padlock);
    const safe = yield* s.getCustom(s.myId, Custom.Safe);
    const strength = yield* s.getCustom(s.myId, Custom.PadlockStrength);
    if (smoke === 1) text += "Smoke detector installed.\n";
    if (padlock === 1) {
      text += `Your parlor entrance is padlocked. (\`w${strength} percent strength\`y)\n`;
    }
    if (safe === 1) text += "You own a safe.\n";
    if (text === "`y") text += "Your stats.";
    yield* s.show({
      mode: "stats",
      text,
      buttons: [{ slot: 2, label: "Name", target: { go: "options" } }, home(1, "Back")],
    });
    // stats.c:59-63: the reply is not used.
  },
};

/** script/events/bonus_tag.c: the player finds a casket tag. */
export function* bonusTag(s: ScriptApi): ScriptGen {
  const tier = yield* s.randomRange(0, 2);
  const tierName = tier === 1 ? "silver" : tier === 2 ? "gold" : "wood";
  const name = yield* s.getName(s.myId);
  yield* s.logMsg(`Giving bonus ${tierName} tag to ${name}.`);
  const roll = yield* s.randomRange(0, 5);
  const place =
    ["davenport", "shed", "desk", "embalming fluids", "stereo", "parlor"][roll] ?? "davenport";
  yield* s.modTags(s.myId, tier, 1);
  for (;;) {
    // bonus_tag.c:64-73 loops back to main_menu; only the home button is offered.
    yield* s.show({
      mode: "screen",
      text: `\`yWhile cleaning behind the ${place} you find a \`w${tierName} tag\`y.`,
      picture: "stuff/money_bag_2",
      buttons: [home(1, "Continue")],
    });
  }
}

/** script/events/arson.c `HandleFireAlarm` (lines 13-48). */
export function* handleFireAlarm(
  s: ScriptApi,
  target: number,
  targetName: string,
  targetHome: string,
  cost: number,
): ScriptGen {
  yield* s.addToNews(
    `\`7EARLY WARNING SAVES PARLOR\n\`^A small fire was quickly put out at local business ${targetHome} before any damage was done. "It was a close call," said a relieved ${targetName}.\n\n`,
  );
  yield* s.broadcastTv(
    `You see some breaking news.  It looks like ${targetName}'s parlor was saved by a smoke detector.`,
  );
  yield* s.mailText(
    target,
    "\n`yA mysterious fire was started on your property.  Thanks to your smoke detector the fire was put out before any serious damage was done.  The police chief awards you `w3`y gold tags!\n",
  );
  yield* s.mailPicture(target, "stuff/fire_alarm");
  yield* s.mailContinueButton(target);
  yield* s.modTags(target, GOLD, 3);
  yield* s.modTags(s.myId, GOLD, -cost);
  yield* s.show({
    mode: "screen",
    text: "`yYou watch from your window.\n\n`4The fire is put out before it can do any serious damage!\n\n`yDamn smoke detectors!",
    picture: "blank",
    buttons: [home(1, "Continue")],
  });
}

/** script/events/arson.c `Main` (lines 51-223): hire the Twins to burn a rival. */
function* arson(s: ScriptApi): ScriptGen {
  const cost = 6;
  const myName = yield* s.getName(s.myId);
  yield* s.logMsg(`Running arson event for ${myName}.`);
  let packet: { text?: string; picture?: string; background?: string } = {
    text: `\`wThe Twins: \`y"We like to play with fire.  We'll discreetly pay a 'visit' to any funeral parlor in town for only ${cost} gold tags."\n\nA fire will destroy 5 percent of the parlors gravestones and burn all wood tags. If the parlor has a fire alarm, there is only a 20 percent chance of success.`,
    background: "background/background_5",
    picture: "people/m_old_3",
  };
  for (;;) {
    // main_menu:
    const choice = yield* s.show({
      mode: "screen",
      ...packet,
      buttons: [{ slot: 2, label: "Hire Twins", target: { result: 1 } }, home(1, "No Thanks")],
    });
    packet = {};
    if (choice === 1) {
      const gold = yield* s.getTags(s.myId, GOLD);
      if (gold < cost) {
        // Only the home button is offered, so the script ends here.
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
    // arson.c:148-152: float, times 0.05, back to int.
    const burned = Math.trunc(Math.fround(Math.fround(plots) * Math.fround(0.05)));
    const tagsLost = yield* s.getTags(target, WOOD);
    yield* s.modTags(s.myId, GOLD, -cost);
    const safe = yield* s.getCustom(target, Custom.Safe);
    const text =
      safe === 0
        ? `\`yYou watch from your window.\n\n\`wA fire engulfs ${targetHome}!\n\n\`y${targetName} loses \`w${burned}\`y gravestone(s) and \`w${tagsLost}\`y wood tag(s).`
        : `\`yYou watch from your window.\n\n\`wA fire engulfs ${targetHome}!\n\n\`y${targetName} loses \`w${burned}\`y gravestone(s).  You see a shiny safe through a window.`;
    const headline = yield* s.randomRange(1, 2);
    if (headline === 1) {
      yield* s.addToNews(
        `\`7PARLOR DAMAGED BY FIRE, ARSON SUSPECTED\n\`^A small fire was not noticed until too late at ${targetHome} today.  "This isn't happening!" said ${targetName}, still in shock.\n\n`,
      );
    } else {
      yield* s.addToNews(
        `\`7PARLOR GETS BURNED\n\`^A small fire was not noticed until too late at ${targetHome} today.  "Faulty wiring my ass, someone is gonna pay for this!" said a distraught ${targetName}.\n\n`,
      );
    }
    yield* s.broadcastTv(
      `You see some breaking news.  It looks like ${targetName}'s parlor caught on fire.`,
    );
    if (safe > 0) {
      yield* s.mailText(
        target,
        `\n\`yA mysterious fire was started on your property.  You lost \`4${burned}\`y gravestone(s) but your \`wSafe\`y protected all your tags.\n`,
      );
    } else {
      yield* s.mailText(
        target,
        `\n\`yA mysterious fire was started on your property.  You lost \`4${burned}\`y gravestone(s) and \`4${tagsLost}\`y wood tag(s).\n`,
      );
      yield* s.setTags(target, WOOD, 0);
    }
    yield* s.mailPicture(target, "stuff/fire_alarm");
    yield* s.mailContinueButton(target);
    yield* s.modTotalBurials(target, -burned);
    yield* s.show({
      mode: "screen",
      text,
      picture: "places/fire",
      buttons: [home(1, "Continue")],
    });
    // arson.c:222 jumps back to main_menu, but only the home button was offered.
  }
}

/** script/script_event.c: a 50/50 pick between arson and a bonus tag. */
export const scriptEventScript: ScriptDef = {
  id: "script_event",
  location: "Home",
  *main(s: ScriptApi): ScriptGen {
    const pick = yield* s.randomRange(1, 2);
    // RunScriptNoReturn: the chosen script takes over; it shares this journal.
    if (pick === 1) yield* arson(s);
    if (pick === 2) yield* bonusTag(s);
  },
};

export const CLASSIC_SCRIPTS: readonly ScriptDef[] = [statsScript, scriptEventScript];
