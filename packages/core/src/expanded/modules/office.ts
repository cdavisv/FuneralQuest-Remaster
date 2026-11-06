import type { Button, OfficePanel, UpgradeRow, View } from "@fq/protocol";
import { enterLocation } from "../../classic/location.js";
import { ratingTitle } from "../../classic/rankings.js";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { button, goButton, hud, legacy } from "../../engine/view.js";
import type { UpgradeRule } from "../../rules/expandedRules.js";
import { fill, intToCash } from "../../text/format.js";
import { modValue } from "../modifiers.js";
import { karmaScale } from "../panels.js";
import {
  buildingLevel,
  defenceLevel,
  hasPerk,
  hasUpgrade,
  parlorPicture,
  perksOf,
  refreshRating,
  stockCapacity,
  upgradeRule,
} from "../parlor.js";
import { karmaMod, moneyMod, reviewsMod, xc, xp, xr } from "../players.js";
import type { Rivalry } from "../state.js";
import { hasPermit } from "../town/cityHall.js";
import { TOWN_MODIFIER_KEYS } from "../town/life.js";

/**
 * The parlor office (docs/expanded-rules.md section 7): the parlor's picture,
 * rating and karma, upgrades bought from the contractor, the casket markup,
 * the rivalry tier, and the Grave Robber's dig. Button ids:
 * `parlor:upgrades`, `parlor:buy:<id>`, `parlor:markup`, `parlor:markup:<n>`,
 * `parlor:rivalry`, `parlor:rivalry:<tier>`, `parlor:dig`.
 */
export const OFFICE = "parlor";

const RIVALRIES: Rivalry[] = ["peaceful", "standard", "cutthroat"];

export function karmaTitle(turn: Turn): string {
  return turn.content.karma[turn.player.karma - 1] ?? "";
}

function summary(turn: Turn, message = ""): View {
  const t = xc(turn).text.office;
  const rules = xr(turn);
  const p = turn.player;
  const x = xp(turn);
  refreshRating(turn.rules, p);
  const level = buildingLevel(rules, x);
  const perks = perksOf(rules, p.karma)
    .map((id) => xc(turn).text.perks[id]?.name ?? id)
    .join(", ");
  const text = fill(t.summary, {
    parlor: p.parlor,
    level: t.levelNames[level] ?? "",
    rating: p.rating,
    ratingTitle: ratingTitle(turn.content, Math.max(1, p.rating)),
    karma: p.karma,
    karmaTitle: karmaTitle(turn),
    money: intToCash(p.money),
    stock: `${x.stock[0]} wood, ${x.stock[1]} silver, ${x.stock[2]} gold`,
    markup: x.markup,
    rivalry: t.rivalryNames[x.rivalry],
    perks: perks === "" ? t.noPerks : perks,
  });
  const buttons: Button[] = [
    button(`${OFFICE}:upgrades`, t.buttons.upgrades),
    button(`${OFFICE}:markup`, t.buttons.markup),
    button(`${OFFICE}:rivalry`, t.buttons.rivalry),
  ];
  if (hasPerk(rules, p, "grave-robber")) {
    let dig = button(`${OFFICE}:dig`, t.buttons.dig);
    if (x.daily.dug >= rules.karma.dig.perDay)
      dig = { ...dig, enabled: false, hint: xc(turn).text.hints.dugEnough };
    else if (p.turns < rules.karma.dig.turns)
      dig = { ...dig, enabled: false, hint: xc(turn).text.hints.noTurns };
    else if (rules.karma.dig.turns > 0)
      dig = {
        ...dig,
        detail: fill(xc(turn).text.hints.costsTurns, { turns: rules.karma.dig.turns }),
      };
    buttons.push(dig);
  }
  buttons.push(goButton("desk", t.buttons.back));
  return {
    scene: "location",
    title: t.title,
    text: legacy(message === "" ? text : `${message}\n\n${text}`),
    picture: { fg: parlorPicture(level), bg: "places/palors" },
    hud: hud(p),
    buttons,
    office: officePanel(turn),
    karmaScale: karmaScale(turn.rules, xc(turn)),
  };
}

/** Days before the rivalry tier may change again (section 9.3), 0 = now. */
function rivalryWait(turn: Turn): number {
  const x = xp(turn);
  const wait = x.rivalryDay === 0 ? 0 : x.rivalryDay + xr(turn).pvp.rivalryCooldown - turn.town.day;
  return Math.max(0, wait);
}

/** Why an upgrade cannot be bought now ("" when it can), as the cards say it. */
function upgradeBlock(
  turn: Turn,
  u: UpgradeRule,
): {
  state: UpgradeRow["state"];
  reason: string;
} {
  const t = xc(turn).text.office;
  const names = xc(turn).upgrades;
  const p = turn.player;
  if (hasUpgrade(p, u.id)) return { state: "owned", reason: "" };
  if (u.requires && !hasUpgrade(p, u.requires))
    return {
      state: "locked",
      reason: fill(t.needs, { name: names[u.requires]?.name ?? u.requires }),
    };
  if (u.permit && !hasPermit(p, u.permit))
    return { state: "locked", reason: permitHint(turn, u.permit) };
  if (p.money < upgradePrice(turn, u.price))
    return { state: "unaffordable", reason: xc(turn).text.hints.notEnoughCash };
  return { state: "available", reason: "" };
}

/** Section 11.5: the office's facts as data, on every office screen. */
export function officePanel(turn: Turn): OfficePanel {
  const t = xc(turn).text.office;
  const rules = xr(turn);
  const p = turn.player;
  const x = xp(turn);
  const names = xc(turn).upgrades;
  const level = buildingLevel(rules, x);
  const upgrades: UpgradeRow[] = rules.upgrades.map((u) => {
    const { state, reason } = upgradeBlock(turn, u);
    const row: UpgradeRow = {
      id: u.id,
      name: names[u.id]?.name ?? u.id,
      description: names[u.id]?.description ?? "",
      price: upgradePrice(turn, u.price),
      rating: u.rating,
      building: !!u.building,
      state,
    };
    if (reason !== "") row.reason = reason;
    const requires: NonNullable<UpgradeRow["requires"]> = [];
    if (u.requires)
      requires.push({
        kind: "upgrade",
        id: u.requires,
        name: names[u.requires]?.name ?? u.requires,
        have: hasUpgrade(p, u.requires),
      });
    if (u.permit)
      requires.push({
        kind: "permit",
        id: u.permit,
        name: xc(turn).town?.permits[u.permit]?.name ?? u.permit,
        have: hasPermit(p, u.permit),
      });
    if (requires.length > 0) row.requires = requires;
    if (state !== "owned") row.buttonId = `${OFFICE}:buy:${u.id}`;
    return row;
  });
  return {
    level,
    levelName: t.levelNames[level] ?? "",
    levelNames: [...t.levelNames],
    stock: {
      wood: x.stock[0],
      silver: x.stock[1],
      gold: x.stock[2],
      capacity: stockCapacity(rules, p),
    },
    markup: x.markup,
    markupOptions: [...rules.markup.options],
    rivalry: x.rivalry,
    rivalryName: t.rivalryNames[x.rivalry],
    rivalryWait: rivalryWait(turn),
    security: defenceLevel(rules, p),
    upgrades,
  };
}

function backButton(turn: Turn): Button {
  return goButton(OFFICE, xc(turn).text.office.buttons.back);
}

/** Section 18.3: an ordinance may make the contractor cheaper or dearer (on the $50 grid). */
export function upgradePrice(turn: Turn, base: number): number {
  const step = xr(turn).customer.limitStep;
  return Math.round(modValue(turn.town, TOWN_MODIFIER_KEYS.upgradePrice, base) / step) * step;
}

/** Section 18.1: "Needs a ... permit from City Hall". */
function permitHint(turn: Turn, permit: string): string {
  const name = xc(turn).town?.permits[permit]?.name ?? permit;
  return fill(xc(turn).town?.text.hints.needsPermit ?? "{name}", { name });
}

function upgradesView(turn: Turn, message = ""): View {
  const t = xc(turn).text.office;
  const rules = xr(turn);
  const p = turn.player;
  const names = xc(turn).upgrades;
  let text = message === "" ? t.upgradesIntro : `${message}\n\n`;
  const buttons: Button[] = [];
  for (const u of rules.upgrades) {
    if (hasUpgrade(p, u.id)) continue;
    const name = names[u.id]?.name ?? u.id;
    text += fill(t.upgradeLine, {
      name,
      price: intToCash(upgradePrice(turn, u.price)),
      description: names[u.id]?.description ?? "",
    });
    const price = upgradePrice(turn, u.price);
    const b: Button = {
      ...button(`${OFFICE}:buy:${u.id}`, name),
      group: "hand",
      detail: `$${intToCash(price)}`,
    };
    if (u.requires && !hasUpgrade(p, u.requires)) {
      buttons.push({
        ...b,
        enabled: false,
        hint: fill(t.needs, { name: names[u.requires]?.name ?? u.requires }),
      });
    } else if (u.permit && !hasPermit(p, u.permit)) {
      buttons.push({ ...b, enabled: false, hint: permitHint(turn, u.permit) });
    } else if (p.money < price) {
      buttons.push({ ...b, enabled: false, hint: xc(turn).text.hints.notEnoughCash });
    } else buttons.push(b);
  }
  buttons.push(backButton(turn));
  return {
    scene: "location",
    title: t.title,
    text: legacy(text),
    picture: { fg: parlorPicture(buildingLevel(rules, xp(turn))), bg: "places/palors" },
    hud: hud(p),
    buttons,
    office: officePanel(turn),
  };
}

/** Section 7.2: buy an upgrade with money. */
function buy(turn: Turn, id: string): View {
  const t = xc(turn).text.office;
  const rules = xr(turn);
  const p = turn.player;
  const x = xp(turn);
  const u = upgradeRule(rules, id);
  if (!u || hasUpgrade(p, id)) throw new Error(`Cannot buy ${id}`);
  if (u.requires && !hasUpgrade(p, u.requires)) throw new Error(`${id} needs ${u.requires}`);
  if (u.permit && !hasPermit(p, u.permit)) throw new Error(`${id} needs a permit`);
  const price = upgradePrice(turn, u.price);
  if (p.money < price) return upgradesView(turn, t.cantAfford);
  moneyMod(p, -price);
  x.upgrades.push(id);
  if (id === "incinerator") p.incinerator = true;
  refreshRating(turn.rules, p);
  return upgradesView(turn, fill(t.bought, { name: xc(turn).upgrades[id]?.name ?? id }));
}

function markupView(turn: Turn, message = ""): View {
  const t = xc(turn).text.office;
  const x = xp(turn);
  const buttons: Button[] = xr(turn).markup.options.map((m) => {
    const b: Button = {
      ...button(`${OFFICE}:markup:${m}`, `${m > 0 ? "+" : ""}${m}%`),
      group: "hand",
    };
    return m === x.markup
      ? { ...b, enabled: false, hint: xc(turn).text.hints.current, selected: true }
      : b;
  });
  buttons.push(backButton(turn));
  return {
    scene: "location",
    title: t.title,
    text: legacy(message === "" ? t.markupIntro : message),
    picture: { fg: "people/store_guy", bg: "places/parlor-office" },
    hud: hud(turn.player),
    buttons,
    office: officePanel(turn),
  };
}

function rivalryView(turn: Turn, message = ""): View {
  const t = xc(turn).text.office;
  const x = xp(turn);
  const rules = xr(turn);
  const wait = x.rivalryDay === 0 ? 0 : x.rivalryDay + rules.pvp.rivalryCooldown - turn.town.day;
  const buttons: Button[] = RIVALRIES.map((r) => {
    const b: Button = {
      ...button(`${OFFICE}:rivalry:${r}`, t.rivalryNames[r]),
      group: "hand",
      detail: fill(t.rivalryHints[r], { tax: Math.round(rules.pvp.peacefulTax * 100) }),
    };
    if (r === x.rivalry)
      return { ...b, enabled: false, hint: xc(turn).text.hints.current, selected: true };
    if (wait > 0) return { ...b, enabled: false, hint: fill(t.rivalryWait, { days: wait }) };
    return b;
  });
  buttons.push(backButton(turn));
  return {
    scene: "location",
    title: t.title,
    text: legacy(
      message === ""
        ? fill(t.rivalryIntro, { tax: Math.round(rules.pvp.peacefulTax * 100) })
        : message,
    ),
    picture: { fg: "places/funeral_enemy", bg: "places/palors" },
    hud: hud(turn.player),
    buttons,
    office: officePanel(turn),
  };
}

/**
 * Section 8.3, Grave Robber: dig in the old graves for a turn. Luck decides:
 * money (or, one time in five, a gold tag); a failure costs karma and word of mouth.
 */
function dig(turn: Turn): View {
  const rules = xr(turn);
  const d = rules.karma.dig;
  const t = xc(turn).text.desk;
  const p = turn.player;
  const x = xp(turn);
  if (!hasPerk(rules, p, "grave-robber") || x.daily.dug >= d.perDay || p.turns < d.turns) {
    throw new Error("Cannot dig");
  }
  p.turns -= d.turns;
  x.daily.dug++;
  const rng = turn.rng;
  let text: string;
  if (rng.randomYesNo(p.luck, d.luckWeight)) {
    if (rng.random(5) === 0) {
      p.tags[2] = (p.tags[2] ?? 0) + 1;
      text = t.digTag;
    } else {
      const money = rng.randomRange(d.money.min, d.money.max);
      moneyMod(p, money);
      text = fill(t.digFound, { money: intToCash(money) });
    }
  } else {
    karmaMod(p, -1);
    reviewsMod(p, rules, -1);
    text = t.digCaught;
  }
  return summary(turn, text);
}

export const officeModule: LocationModule = {
  id: OFFICE,
  enter(turn) {
    enterLocation(turn, xc(turn).text.office.title);
    return summary(turn);
  },
  press(turn, command) {
    const t = xc(turn).text.office;
    if (command === "upgrades") return upgradesView(turn);
    if (command.startsWith("buy:")) return buy(turn, command.slice(4));
    if (command === "markup") return markupView(turn);
    if (command.startsWith("markup:")) {
      const value = Number(command.slice(7));
      if (!xr(turn).markup.options.includes(value)) throw new Error("No such markup");
      xp(turn).markup = value;
      refreshRating(turn.rules, turn.player);
      return markupView(turn, fill(t.markupSet, { markup: value }));
    }
    if (command === "rivalry") return rivalryView(turn);
    if (command.startsWith("rivalry:")) {
      const value = command.slice(8) as Rivalry;
      const x = xp(turn);
      const rules = xr(turn);
      if (!RIVALRIES.includes(value) || value === x.rivalry) throw new Error("No such rivalry");
      if (x.rivalryDay !== 0 && x.rivalryDay + rules.pvp.rivalryCooldown > turn.town.day) {
        throw new Error("Too soon to change");
      }
      x.rivalry = value;
      x.rivalryDay = turn.town.day;
      return rivalryView(turn, fill(t.rivalrySet, { rivalry: t.rivalryNames[value] }));
    }
    if (command === "dig") return dig(turn);
    throw new Error(`Unknown office command ${command}`);
  },
};
