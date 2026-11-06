import type { NewsCondition } from "../../content/newsCondition.js";
import type { ExpandedRules } from "../../rules/expandedRules.js";
import { MODIFIER_KEYS } from "../modifiers.js";
import { TOWN_MODIFIER_KEYS } from "../town/life.js";
import type { ExpandedTownContent, ModifierDef } from "./townTypes.js";
import type { ExpandedContent } from "./types.js";

/**
 * Checks an Expanded content section against the rules (docs/expanded-rules.md
 * section 13.4). Returns a list of problems; empty means the engine can use
 * it. Content tools should run this; the engine does not, so a bad pack
 * fails loudly in tests rather than at midnight.
 */
export function checkExpandedContent(content: ExpandedContent, rules: ExpandedRules): string[] {
  const problems: string[] = [];
  const step = rules.customer.limitStep;
  const need = (ok: boolean, message: string) => {
    if (!ok) problems.push(message);
  };
  need(
    content.names.male.length > 0 && content.names.female.length > 0,
    "names: need male and female first names",
  );
  need(content.names.surnames.length > 0, "names: need surnames");
  need(content.names.pets.length > 0, "names: need pet names");
  need(content.traits.length >= 3, "traits: need at least 3 (two visible and a hidden one)");
  const traitIds = new Set<string>();
  for (const t of content.traits) {
    need(!traitIds.has(t.id), `traits: duplicate id ${t.id}`);
    traitIds.add(t.id);
    need(t.label !== "" && t.hint !== "", `traits.${t.id}: label and hint are required`);
  }
  for (const t of content.traits) {
    for (const x of t.excludes ?? [])
      need(traitIds.has(x), `traits.${t.id}: excludes unknown trait ${x}`);
  }
  need(content.backstories.length > 0, "backstories: need at least one");
  const bits = content.backstoryBits;
  need(
    bits.jobs.length > 0 && bits.hobbies.length > 0 && bits.places.length > 0,
    "backstoryBits: need every list",
  );
  for (const [k, list] of Object.entries(content.tells))
    need(list.length > 0, `tells.${k}: need at least one line`);
  const specialIds = new Set<string>();
  for (const s of content.specials) {
    need(!specialIds.has(s.id), `specials: duplicate id ${s.id}`);
    specialIds.add(s.id);
    need(s.weight > 0, `specials.${s.id}: weight must be positive`);
    for (const t of s.traits ?? []) need(traitIds.has(t), `specials.${s.id}: unknown trait ${t}`);
    if (s.pet) need(s.pet.length > 0, `specials.${s.id}: pet needs species`);
  }
  need(
    content.softSell.length >= rules.hand.luckySize,
    "softSell: need at least a full hand of items",
  );
  for (const item of content.softSell) {
    need(
      item.price > 0 && item.price % step === 0,
      `softSell.${item.name}: price must be a positive multiple of ${step}`,
    );
  }
  const upgradeIds = new Set(rules.upgrades.map((u) => u.id));
  for (const cat of content.packages) {
    need(cat.tiers.length >= 2, `packages.${cat.id}: need the free tier and at least one more`);
    need(cat.tiers[0]?.price === 0, `packages.${cat.id}: tier 0 must be free`);
    need(cat.pitch.length > 0, `packages.${cat.id}: need pitch lines`);
    cat.tiers.forEach((tier, i) => {
      need(
        tier.price % step === 0,
        `packages.${cat.id}.${tier.name}: price must be a multiple of ${step}`,
      );
      if (i > 0)
        need(
          tier.price > (cat.tiers[i - 1]?.price ?? 0),
          `packages.${cat.id}: tiers must get dearer`,
        );
      if (tier.requires)
        need(
          upgradeIds.has(tier.requires),
          `packages.${cat.id}.${tier.name}: unknown upgrade ${tier.requires}`,
        );
    });
  }
  need(content.cremation.fee % step === 0, "cremation: fee must be on the price grid");
  for (const u of rules.upgrades)
    need(content.upgrades[u.id] !== undefined, `upgrades: no name for ${u.id}`);
  for (const e of content.prep) {
    need(e.options.length >= 2, `prep.${e.id}: need at least two options`);
  }
  need(content.text.tutorial.pages.length > 0, "text.tutorial.pages: need at least one page");
  if (content.town) problems.push(...checkTownContent(content.town, rules));
  return problems;
}

const KNOWN_KEYS = new Set<string>([
  ...Object.values(MODIFIER_KEYS),
  ...Object.values(TOWN_MODIFIER_KEYS),
]);

/**
 * Section 25.3: the town content. Ids the rules name must exist, every
 * modifier key must be one the engine reads, every arc beat a story arc
 * points to must exist, and every arc must reach an ending.
 */
export function checkTownContent(town: ExpandedTownContent, rules: ExpandedRules): string[] {
  const problems: string[] = [];
  const need = (ok: boolean, message: string) => {
    if (!ok) problems.push(message);
  };
  const r = rules.town;
  const injuries = new Set(town.injuries.map((i) => i.id));
  for (const id of [
    r.graveyard.rob.injury,
    ...r.graveyard.duel.injuries,
    r.club.shots.injury,
    r.club.hit.injury,
  ])
    need(injuries.has(id), `town.injuries: the rules use ${id}`);
  for (const i of town.injuries) {
    need(i.days >= 1, `town.injuries.${i.id}: days must be at least 1`);
    need(
      i.treatPrice % rules.customer.limitStep === 0,
      `town.injuries.${i.id}: price off the $50 grid`,
    );
  }
  need(town.monuments.length >= r.graveyard.monuments.length, "town.monuments: one name per tier");
  for (const id of Object.keys(r.cityHall.permits))
    need(town.permits[id] !== undefined, `town.permits: no name for ${id}`);
  need(town.weather.length > 0, "town.weather: need at least one");
  need(
    town.ordinances.length >= r.cityHall.ordinance.candidates,
    "town.ordinances: need a full ballot",
  );
  need(town.market.length >= r.club.market.slots, "town.market: need a full day's stock");
  const lists: [string, { id: string; modifiers?: ModifierDef[] }[]][] = [
    ["news", town.news],
    ["weather", town.weather],
    ["ordinances", town.ordinances],
    ...town.arcs.map((a): [string, { id: string; modifiers?: ModifierDef[] }[]] => [
      `arcs.${a.id}`,
      a.beats,
    ]),
  ];
  for (const [name, list] of lists) {
    const ids = new Set<string>();
    for (const x of list) {
      need(!ids.has(x.id), `town.${name}: duplicate id ${x.id}`);
      ids.add(x.id);
      for (const m of x.modifiers ?? [])
        need(KNOWN_KEYS.has(m.key), `town.${name}.${x.id}: unknown modifier ${m.key}`);
    }
  }
  for (const a of town.arcs) {
    const beats = new Map(a.beats.map((b) => [b.id, b]));
    need(beats.has(a.start), `town.arcs.${a.id}: no start beat ${a.start}`);
    need(a.earliest <= a.latest, `town.arcs.${a.id}: earliest after latest`);
    for (const b of a.beats) {
      const next =
        b.next === undefined
          ? []
          : typeof b.next === "string"
            ? [b.next]
            : [b.next.ifTrue, b.next.ifFalse];
      for (const n of next) need(beats.has(n), `town.arcs.${a.id}.${b.id}: no beat ${n}`);
      if (b.next === undefined)
        need(b.ending !== undefined, `town.arcs.${a.id}.${b.id}: a last beat needs an ending`);
    }
  }
  // Section 22.5: a news story's `when` names arcs and endings that exist.
  for (const n of town.news)
    problems.push(...checkNewsCondition(town, `town.news.${n.id}`, n.when));
  return problems;
}

/** Section 22.5: unknown arc ids or endings in a news story's or blurb's `when`. */
export function checkNewsCondition(
  town: ExpandedTownContent,
  where: string,
  when: NewsCondition | undefined,
): string[] {
  if (!when) return [];
  const out: string[] = [];
  const endingsOf = (id: string): Set<string> | undefined => {
    const arc = town.arcs.find((a) => a.id === id);
    if (!arc) return undefined;
    return new Set(arc.beats.filter((b) => b.next === undefined).map((b) => b.ending ?? b.id));
  };
  for (const need of when.arcs ?? []) {
    const endings = endingsOf(need.id);
    if (!endings) out.push(`${where}: when names unknown arc ${need.id}`);
    else
      for (const e of need.endings ?? [])
        if (!endings.has(e)) out.push(`${where}: arc ${need.id} has no ending ${e}`);
  }
  for (const id of when.notArcs ?? [])
    if (!endingsOf(id)) out.push(`${where}: when names unknown arc ${id}`);
  return out;
}
