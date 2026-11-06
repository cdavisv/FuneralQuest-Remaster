import type { AssetId, Button, View } from "@fq/protocol";
import { enterLocation } from "../../classic/location.js";
import type { Turn } from "../../engine/turn.js";
import { button, hud, legacy } from "../../engine/view.js";
import type { ExpandedTownRules } from "../../rules/expandedTownRules.js";
import type { PlayerState, TownState } from "../../state/types.js";
import { fill, intToCash } from "../../text/format.js";
import type {
  ExpandedTownContent,
  InjuryCause,
  InjuryDef,
  ModifierDef,
} from "../content/townTypes.js";
import { addModifier } from "../modifiers.js";
import { ensureExpanded, pick, xc, xr } from "../players.js";
import type { Chain, DailyLife, PlayerLife, TownLife } from "./state.js";

/**
 * Shared helpers of the town places and the living world
 * (docs/expanded-rules.md sections 16 to 25): state accessors, injuries,
 * chains and the screen builder every new place uses.
 */

/**
 * Modifier keys the town systems read (section 22.1), on top of
 * `MODIFIER_KEYS` (section 12.2). News, weather, ordinances and story arcs
 * may use any of both.
 */
export const TOWN_MODIFIER_KEYS = {
  /** Turns added at each player's new day. */
  dailyTurns: "turns.daily",
  /** Added to every customer's patience. */
  patience: "customer.patience",
  /** Multiplies what a PvP winner gains (parlor fights and duels). */
  pvpGain: "pvp.gainMult",
  /** Added to the player's luck for robbing a grave (fog helps). */
  robLuck: "graveyard.robLuck",
  /** 0 closes the graveyard to duels. */
  duels: "graveyard.duels",
  /** Added to the Reaper Club's cover (wood tags). */
  cover: "club.cover",
  /** Added to the savings rate (share a day). */
  savingsRate: "bank.savingsRate",
  /** Added to the loan rate (share a day). */
  loanRate: "bank.loanRate",
  /** Multiplies parlor upgrade prices. */
  upgradePrice: "parlor.upgradePrice",
  /** Multiplies the church's bingo cut. */
  bingoCut: "church.bingoCut",
  /** 0 cancels bingo night. */
  bingo: "church.bingo",
  /** Multiplies the hospital's prices. */
  treatPrice: "hospital.treatPrice",
  /** Multiplies City Hall's permit prices. */
  permitPrice: "city.permitPrice",
  /** Multiplies the hit man's price. */
  hitPrice: "club.hitPrice",
} as const;

export function tr(turn: Turn): ExpandedTownRules {
  return xr(turn).town;
}

/** The town content (section 25); the starter is filled in by `withExpandedContent`. */
export function xt(turn: Turn): ExpandedTownContent {
  const town = xc(turn).town;
  if (!town) throw new Error("The content pack has no Expanded town section");
  return town;
}

function newDaily(day: number): DailyLife {
  return {
    day,
    tended: 0,
    duels: 0,
    duelsLost: 0,
    confessions: 0,
    served: false,
    tithed: 0,
    bribes: 0,
    cover: false,
    staked: 0,
    bought: [],
    seance: false,
    hired: false,
    sent: 0,
    received: 0,
  };
}

export function newLife(): PlayerLife {
  return {
    monuments: 0,
    injuries: [],
    healedDay: 0,
    leads: 0,
    holyWater: 0,
    permits: [],
    certifiedUntil: 0,
    savings: 0,
    loan: null,
    deadbeat: false,
    armor: false,
    bodyguardDay: 0,
    mayor: false,
    chain: null,
    leftChainDay: 0,
    today: newDaily(0),
    spent: {},
  };
}

/**
 * The player's town record, created on first use. `today` is reset whenever
 * the game day has moved on, so daily limits never depend on the player
 * reaching the desk first.
 */
export function lifeOf(town: TownState, player: PlayerState): PlayerLife {
  const x = player.expanded;
  if (!x) throw new Error("Not an Expanded player");
  if (!x.life) x.life = newLife();
  if (x.life.today.day !== town.day) x.life.today = newDaily(town.day);
  return x.life;
}

export function life(turn: Turn): PlayerLife {
  ensureExpanded(turn.player, turn.rules);
  return lifeOf(turn.town, turn.player);
}

/** Today's counters for the acting player. */
export function today(turn: Turn): DailyLife {
  return life(turn).today;
}

export function newTownLife(season: number): TownLife {
  return {
    season,
    bingo: { day: 0, cards: [], paid: 0, carry: 0 },
    ordinance: null,
    ballot: null,
    election: { candidates: [], ads: {}, ballot: null, mayor: null, mayorName: "", held: false },
    chains: [],
    nextChain: 1,
    hits: [],
    today: { day: 0, news: null, weather: null },
    market: [],
    arc: null,
    arcsDone: [],
    tallies: { walkouts: 0, sales: 0 },
  };
}

export function townLife(town: TownState): TownLife {
  if (!town.expanded) town.expanded = { modifiers: [] };
  if (!town.expanded.life) town.expanded.life = newTownLife(1);
  return town.expanded.life;
}

/** Counts money spent on a town system, for the stats and the balance runs. */
export function spent(turn: Turn, key: string, amount: number): void {
  const s = life(turn).spent;
  s[key] = (s[key] ?? 0) + amount;
}

/** Adds the rule changes of a content entry for `days` days from today. */
export function applyModifiers(
  town: TownState,
  list: readonly ModifierDef[] | undefined,
  days: number,
  source: string,
): void {
  for (const m of list ?? []) {
    addModifier(town, {
      key: m.key,
      op: m.op,
      value: m.value,
      untilDay: town.day + Math.max(1, days) - 1,
      source,
    });
  }
}

export function activePlayers(town: TownState): PlayerState[] {
  return town.players.filter((p) => p.active && p.expanded);
}

// ---------------------------------------------------------------- injuries

export function injuryDef(turn: Turn, id: string): InjuryDef | undefined {
  return xt(turn).injuries.find((i) => i.id === id);
}

/**
 * Section 19.1: an injury for `cause`, drawn from the pack's injuries that
 * name it (in pack order). A pack that tags none for this cause draws from
 * all its injuries. One candidate needs no draw, so the stream is unchanged
 * for a pack with one injury per cause.
 */
export function chooseInjury(turn: Turn, cause: InjuryCause): string | undefined {
  const all = xt(turn).injuries;
  const tagged = all.filter((i) => i.causes?.includes(cause));
  const list = tagged.length > 0 ? tagged : all;
  if (list.length <= 1) return list[0]?.id;
  return list[turn.rng.random(list.length)]?.id;
}

/**
 * Section 19.1: gives `player` an injury. Body armour stops it (and is used
 * up). At the cap the oldest injury is replaced. Returns the line to show or
 * mail, or "" when nothing happened.
 */
export function addInjury(turn: Turn, player: PlayerState, id: string): string {
  const def = injuryDef(turn, id);
  if (!def || !player.expanded) return "";
  const l = lifeOf(turn.town, player);
  const t = xt(turn).text.hospital;
  if (l.armor) {
    l.armor = false;
    return t.armorSaved;
  }
  const same = l.injuries.find((i) => i.id === id);
  if (same) same.days = Math.max(same.days, def.days);
  else {
    l.injuries.push({ id, days: def.days });
    while (l.injuries.length > tr(turn).hospital.maxInjuries) l.injuries.shift();
  }
  return fill(t.newInjury, { name: def.name }) + (def.text === "" ? "" : `\n${def.text}`);
}

function injurySum(turn: Turn, player: PlayerState, key: "hp" | "patience" | "turns"): number {
  const l = player.expanded?.life;
  if (!l) return 0;
  let total = 0;
  for (const i of l.injuries) total += injuryDef(turn, i.id)?.[key] ?? 0;
  return total;
}

/** Hit points every fight starts without (section 19.1). */
export function injuryHp(turn: Turn, player: PlayerState): number {
  return injurySum(turn, player, "hp");
}

export function injuryPatience(turn: Turn, player: PlayerState): number {
  return injurySum(turn, player, "patience");
}

export function injuryTurns(turn: Turn, player: PlayerState): number {
  return injurySum(turn, player, "turns");
}

// ---------------------------------------------------------------- chains and offices

export function chainById(town: TownState, id: string | null | undefined): Chain | undefined {
  if (!id) return undefined;
  return town.expanded?.life?.chains.find((c) => c.id === id);
}

export function chainOf(town: TownState, player: PlayerState | undefined): Chain | undefined {
  return chainById(town, player?.expanded?.life?.chain);
}

/** Section 23.3: chain-mates never fight, rob, burn or hire hits on each other. */
export function sameChain(
  _town: TownState,
  a: PlayerState | undefined,
  b: PlayerState | undefined,
) {
  if (!a || !b || a.id === b.id) return false;
  const ca = a.expanded?.life?.chain;
  return !!ca && ca === b.expanded?.life?.chain;
}

/**
 * Section 23.3: after `shelterAfter` successful attacks on a chain's members
 * in one day, the rest of the chain is sheltered until midnight.
 */
export function chainSheltered(turn: Turn, victim: PlayerState): boolean {
  const c = chainOf(turn.town, victim);
  if (!c) return false;
  return c.hitsDay === turn.town.day && c.hitsToday >= tr(turn).chains.shelterAfter;
}

export function chainHit(turn: Turn, victim: PlayerState): void {
  const c = chainOf(turn.town, victim);
  if (!c) return;
  if (c.hitsDay !== turn.town.day) {
    c.hitsDay = turn.town.day;
    c.hitsToday = 0;
  }
  c.hitsToday++;
}

export function mayorOf(town: TownState): PlayerState | undefined {
  const id = town.expanded?.life?.election.mayor;
  if (id === null || id === undefined) return undefined;
  const p = town.players[id];
  return p?.active ? p : undefined;
}

export function isMayor(town: TownState, player: PlayerState): boolean {
  return mayorOf(town)?.id === player.id;
}

/** The mayor's name for text: the elected one, else the content's NPC. */
export function mayorName(turn: Turn): string {
  return mayorOf(turn.town)?.name ?? xt(turn).cast.mayor;
}

// ---------------------------------------------------------------- screens

export interface TownScreen {
  title: string;
  text: string;
  buttons: Button[];
  note?: string;
  status?: string;
  fg?: AssetId | undefined;
  bg?: AssetId | undefined;
}

/** A place screen with the current HUD. */
export function townScreen(turn: Turn, s: TownScreen): View {
  const view: View = {
    scene: "location",
    title: s.title,
    text: legacy(s.text),
    hud: hud(turn.player),
    buttons: s.buttons,
  };
  if (s.note) view.note = legacy(s.note);
  if (s.status) view.status = legacy(s.status);
  const picture: NonNullable<View["picture"]> = {};
  if (s.fg) picture.fg = s.fg;
  if (s.bg) picture.bg = s.bg;
  view.picture = picture;
  return view;
}

/** Enters a place: clears the customer state and names the location. */
export function arrive(turn: Turn, title: string, scene: string): void {
  enterLocation(turn, title);
  turn.session.scene = scene;
}

/** A button disabled with a reason (never hidden, section 11.2). */
export function off(b: Button, hint: string): Button {
  return { ...b, enabled: false, hint };
}

/** A card-style button (`group: "hand"`) with a second line. */
export function card(id: string, label: string, detail?: string): Button {
  const b: Button = { ...button(id, label), group: "hand" };
  if (detail) b.detail = detail;
  return b;
}

/** One line from a list, or "" from an empty one. */
export function line(turn: Turn, list: readonly string[]): string {
  return list.length === 0 ? "" : pick(turn.rng, list);
}

/** "$1,200" */
export function cash(value: number): string {
  return `$${intToCash(Math.round(value))}`;
}
