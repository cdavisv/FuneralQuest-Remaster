import type { Hud, InjuryRow, KarmaBand, RewardFacts, TutorialPanel, View } from "@fq/protocol";
import type { Turn } from "../engine/turn.js";
import { legacy } from "../engine/view.js";
import type { ClassicRules } from "../rules/classicRules.js";
import type { PlayerState } from "../state/types.js";
import { stripLegacyCodes } from "../text/legacyText.js";
import type { ExpandedContent, Reward } from "./content/types.js";
import { modValue } from "./modifiers.js";

/**
 * Structured facts for the Expanded screens (docs/expanded-rules.md 11.5).
 * Every builder only reads state: views must never change the town.
 * Place-specific panels live with their module (office, church, City Hall,
 * bank, club, prep); this file holds what several screens share and the
 * view hook that decorates every Expanded view's HUD.
 */

const HOSPITAL_PRICE = "hospital.treatPrice";

/** Section 8.3: the karma axis as bands, evil to good. */
export function karmaScale(rules: ClassicRules, content: ExpandedContent): KarmaBand[] {
  const k = rules.expanded?.karma;
  if (!k) return [];
  const name = (id: string) => content.text.perks[id]?.name ?? "";
  return [
    { id: "necromancer", name: name("necromancer"), min: 1, max: k.evil[1] },
    { id: "grave-robber", name: name("grave-robber"), min: k.evil[1] + 1, max: k.evil[0] },
    { id: "neutral", name: name("neutral"), min: k.evil[0] + 1, max: k.good[0] - 1 },
    { id: "trusted", name: name("trusted"), min: k.good[0], max: k.good[1] - 1 },
    { id: "church-associate", name: name("church-associate"), min: k.good[1], max: 100 },
  ];
}

export function karmaBandOf(scale: readonly KarmaBand[], karma: number): KarmaBand | undefined {
  return scale.find((b) => karma >= b.min && karma <= b.max) ?? scale[scale.length - 1];
}

/** A `Reward` as signed numbers, zero keys dropped. */
export function rewardFacts(reward: Reward): RewardFacts {
  const out: RewardFacts = {};
  for (const key of ["bp", "money", "karma", "luck", "reviews", "rating", "gold"] as const) {
    const v = reward[key];
    if (v) out[key] = v;
  }
  if (reward.protection) out.protection = true;
  return out;
}

/** Section 19.1: the player's injuries, with what each costs and how long it lasts. */
export function injuryRows(turn: Turn, player: PlayerState): InjuryRow[] {
  const list = player.expanded?.life?.injuries ?? [];
  const defs = turn.content.expanded?.town?.injuries ?? [];
  const step = turn.rules.expanded?.customer.limitStep ?? 1;
  const out: InjuryRow[] = [];
  for (const i of list) {
    const def = defs.find((d) => d.id === i.id);
    if (!def) continue;
    out.push({
      id: def.id,
      name: def.name,
      text: def.text,
      daysLeft: i.days,
      hp: def.hp,
      patience: def.patience ?? 0,
      turns: def.turns ?? 0,
      // As `treatPrice` (town/hospital.ts): through the modifier, on the $50 grid.
      treatPrice: Math.round(modValue(turn.town, HOSPITAL_PRICE, def.treatPrice) / step) * step,
    });
  }
  return out;
}

/**
 * The Expanded view hook (registered by `createExpandedRegistry`): the HUD's
 * countdowns, injuries and karma band. Classic registers no view hook, so
 * Classic views are untouched.
 */
export function decorateExpandedView(turn: Turn, view: View): View {
  const hud: Hud | undefined = view.hud;
  const player = turn.town.players[turn.playerId];
  const content = turn.content.expanded;
  if (!hud || !player?.expanded || !content || hud.karma === undefined) return view;
  if (hud.debt) hud.debt.daysLeft = Math.max(0, hud.debt.due - turn.town.day);
  if ((hud.injuries ?? 0) > 0) hud.injuryList = injuryRows(turn, player);
  const band = karmaBandOf(karmaScale(turn.rules, content), hud.karma);
  if (band) hud.karmaPath = band;
  // Section 20.4: a hit-man rumour heard today, as data.
  if (player.expanded.life?.rumourDay === turn.town.day)
    hud.warnings = [{ kind: "hit-rumour", day: turn.town.day }];
  // Sound cues as data (11.5): the overlay's kind and the meteor edition.
  const o = view.overlay;
  if (o?.kind === "message" && o.messageKind === undefined) o.messageKind = "notice";
  else if (o?.kind === "confirm" && o.id === "mailbox:reply") o.messageKind = "letter";
  if (view.news && carriesMeteor(turn, view.news.day)) view.news.meteor = true;
  return view;
}

/** Whether the stored front page of `day` carries the season-ending meteor story. */
function carriesMeteor(turn: Turn, day: number): boolean {
  const headline = turn.text.news.meteorHeadline;
  const front = turn.town.news[String(day)]?.front ?? "";
  return headline !== "" && front.includes(headline);
}

/** The tour's speaker, plain ("Clerk" from "`wClerk: `$"). */
function speakerName(content: ExpandedContent): string {
  return stripLegacyCodes(content.text.tutorial.speaker).trim().replace(/:$/, "").trim();
}

/** Section 11.5: a tour page's counter. */
export function tutorialPage(content: ExpandedContent, page: number, pages: number): TutorialPanel {
  return { page, pages, speaker: speakerName(content) };
}

/** Section 11.5: a practice-sale hint, without its "Clerk:" tag. */
export function tutorialHintPanel(content: ExpandedContent, hint: string): TutorialPanel {
  const speaker = speakerName(content);
  let text = hint;
  const plain = stripLegacyCodes(hint);
  if (speaker !== "" && plain.trimStart().startsWith(`${speaker}:`)) {
    const at = hint.indexOf(`${speaker}:`);
    text = (hint.slice(0, at) + hint.slice(at + speaker.length + 1)).trimStart();
  }
  return { hint: legacy(text), speaker };
}
