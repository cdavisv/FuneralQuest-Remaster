import type { Button, Picture, PrepChoice, View } from "@fq/protocol";
import { continueButton } from "../../classic/location.js";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { button, hud, legacy } from "../../engine/view.js";
import { fill, type TemplateVars } from "../../text/format.js";
import type { PrepEventDef, PrepOption, Reward } from "../content/types.js";
import { karmaScale, rewardFacts } from "../panels.js";
import { hasPerk, prepPicture, refreshRating } from "../parlor.js";
import { applyReward, rewardSummary, xc, xr } from "../players.js";
import { canPay } from "../sale.js";
import { addLoot } from "../town/placesBLib.js";

/**
 * Preparing the body (docs/expanded-rules.md section 8.2): after some sales
 * a moral choice from `content.expanded.prep`, the Design Doc's ring. The
 * pending choice is `session.expanded.prep`. Button ids: `prep:start`,
 * `prep:opt:<n>`.
 */
export const PREP = "prep";

function pending(turn: Turn): { def: PrepEventDef; vars: TemplateVars } {
  const prep = turn.session.expanded?.prep;
  const def = prep ? xc(turn).prep[prep.event] : undefined;
  if (!prep || !def) throw new Error("No body to prepare");
  const m = prep.deceasedMale;
  return {
    def,
    vars: {
      dFirst: prep.deceased,
      surname: prep.surname,
      dHis: m ? "his" : "her",
      dHim: m ? "him" : "her",
      dHe: m ? "he" : "she",
      dHeCap: m ? "He" : "She",
      player: turn.player.name,
    },
  };
}

/** Options the player may see: perk-only ones need the perk. */
function visibleOptions(turn: Turn, def: PrepEventDef): { option: PrepOption; index: number }[] {
  const rules = xr(turn);
  return def.options
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => !option.perk || hasPerk(rules, turn.player, option.perk as never));
}

/** The money a choice pays or costs after the Grave Robber perk (dishonest choices pay double). */
export function prepEffects(turn: Turn, option: PrepOption, effects: Reward): Reward {
  if (option.evil && (effects.money ?? 0) > 0 && hasPerk(xr(turn), turn.player, "grave-robber")) {
    return { ...effects, money: (effects.money ?? 0) * 2 };
  }
  return effects;
}

/**
 * The scene: the event's own picture over the embalming room, or (section 8.2,
 * 25.4) one of the three prep scenes for an event without one.
 */
function prepScene(def: PrepEventDef): Picture {
  return def.picture
    ? { fg: def.picture, bg: "places/embalming-room" }
    : { bg: prepPicture(def.id) };
}

/** Section 11.5: percent chance a gamble works, as `randomYesNo(luck, weight)` decides it. */
export function riskChance(luck: number, weight: number): number {
  const f32 = Math.fround;
  const adjusted = luck + Math.trunc(f32(f32(50 - luck) * f32(f32(1) - f32(weight))));
  return Math.min(100, Math.max(0, adjusted + 1));
}

function start(turn: Turn): View {
  const { def, vars } = pending(turn);
  const t = xc(turn).text.prep;
  const choices: PrepChoice[] = [];
  const buttons: Button[] = visibleOptions(turn, def).map(({ option, index }) => {
    const choice: PrepChoice = {
      buttonId: `${PREP}:opt:${index}`,
      effects: rewardFacts(prepEffects(turn, option, option.effects)),
      evil: !!option.evil,
    };
    if (option.risk)
      choice.risk = {
        chance: riskChance(turn.player.luck, option.risk.weight),
        fail: rewardFacts(option.risk.failEffects),
      };
    choices.push(choice);
    const b = button(`${PREP}:opt:${index}`, fill(option.label, vars));
    const cost = -(option.effects.money ?? 0);
    if (!canPay(turn.player, cost))
      return { ...b, enabled: false, hint: fill(xc(turn).text.hints.needsMoney, { money: cost }) };
    const summary = rewardSummary(prepEffects(turn, option, option.effects));
    return summary ? { ...b, detail: summary } : b;
  });
  return {
    scene: "location",
    title: turn.session.location,
    text: legacy(t.header + fill(def.text, vars)),
    picture: prepScene(def),
    hud: hud(turn.player),
    buttons,
    prep: { choices },
    karmaScale: karmaScale(turn.rules, xc(turn)),
  };
}

function choose(turn: Turn, index: number): View {
  const { def, vars } = pending(turn);
  const option = def.options[index];
  if (!option || !visibleOptions(turn, def).some((o) => o.index === index))
    throw new Error("No such choice");
  if (!canPay(turn.player, -(option.effects.money ?? 0))) throw new Error("Cannot afford that");
  const t = xc(turn).text.prep;
  let text = fill(option.text, vars);
  let effects = prepEffects(turn, option, option.effects);
  if (option.risk && !turn.rng.randomYesNo(turn.player.luck, option.risk.weight)) {
    text += `${t.riskFailed}\n\n${fill(option.risk.failText, vars)}`;
    effects = option.risk.failEffects;
  }
  applyReward(turn, turn.player, effects);
  // Batch B: a piece taken from the body can be pawned at Cousin Sal's.
  if (option.evil && (option.effects.money ?? 0) > 0) addLoot(turn);
  refreshRating(turn.rules, turn.player);
  if (turn.session.expanded) turn.session.expanded.prep = null;
  const summary = rewardSummary(effects);
  return {
    scene: "location",
    title: turn.session.location,
    text: legacy(`${t.header}${text}${summary ? `\n\n\`5${summary}\`$` : ""}`),
    picture: prepScene(def),
    hud: hud(turn.player),
    buttons: [continueButton(turn)],
  };
}

export const prepModule: LocationModule = {
  id: PREP,
  press(turn, command) {
    if (command === "start") return start(turn);
    if (command.startsWith("opt:")) return choose(turn, Number(command.slice(4)));
    throw new Error(`Unknown prep command ${command}`);
  },
};
