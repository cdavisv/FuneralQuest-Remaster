import { EXPANDED, EXPANDED_RULES } from "@fq/core";
import type { Action, Button, View } from "@fq/protocol";
import type { ErrandKind, XMemory } from "../memory.js";
import { NO_PLACES, type XStyle, type XTagWant } from "../personalities.js";
import {
  battle,
  type Ctx,
  cafe,
  overlay as classicOverlay,
  enemy,
  finishErrand,
  learnFromScreen,
  news,
  poorest,
  rankings,
  startErrand,
  twins,
  visit,
  yangs,
} from "../policy.js";
import {
  buttonByLabel,
  enabledButtons,
  hasButton,
  plain,
  press,
  safeAction,
  screenText,
  signature,
} from "../read.js";
import { offered } from "../runner.js";
import { duelOutlook, duelTable } from "./duel.js";
import type { Guide } from "./guide.js";
import {
  eveningPlaces,
  morningPlaces,
  PLACE_IDS,
  PLACE_PICKERS,
  PLACE_PREFIXES,
  placePicker,
  placeWorth,
  runPlace,
} from "./places.js";
import { chooseX, isXNegotiation, meetX, type SellContext, watchX } from "./sell.js";

/**
 * A bot's Expanded day (docs/expanded-rules.md sections 6 to 24): the tour on
 * the first day, morning errands that help today's sales (treatment, stock,
 * upgrades, psych, the turn-costing town actions), the customers, then the
 * evening's town (City Hall, church, graveyard, club, bank). Every decision is
 * read from the View: enabled buttons, their `detail` and `hint`, the HUD,
 * the town strip, the stats sheet, and the text of the screen.
 */

const ERRAND_BUDGET = 60;
/** The season the Expanded ruleset plays (EXPANDED_RULES.settings.tournamentDays). */
const SEASON = 30;
const REPEAT_LIMIT = 4;
const STYLE_FALLBACK: XStyle = {
  path: "neutral",
  rivalry: "standard",
  markup: 0,
  tags: [{ item: "psych", upTo: 4 }],
  upgrades: ["paint", "coffee-machine"],
  reserve: 4000,
  stock: [2, 1, 0],
  monuments: { from: 22, upTo: 2 },
  tithe: 0,
  save: false,
  borrow: 0,
  bingo: 0,
  gamble: null,
  duel: false,
  hits: false,
  mayor: 0,
  lobby: false,
  chain: "none",
  leads: 0,
  certify: false,
  market: [],
  vote: [],
  holyWater: 0,
  graves: false,
  appeals: 0,
  charity: false,
  places: NO_PLACES,
};

const PLACE: Partial<Record<ErrandKind, string>> = {
  bank: "bank",
  bankout: "bank",
  bankin: "bank",
  store: "store",
  university: "spirit-university",
  yangs: "yangs",
  visit: "competitors",
  cafe: "cafe",
  hospital: "hospital",
  cityhall: "city-hall",
  church: "church",
  graveyard: "graveyard",
  club: "reaper-club",
  ...PLACE_IDS,
};

/** Button-id prefixes that say which place a screen belongs to. */
const PREFIX: Record<string, string> = {
  "church:": "church",
  "graveyard:": "graveyard",
  "go:graveyard": "graveyard",
  "city-hall:": "city-hall",
  "reaper-club:": "reaper-club",
  "bank:": "bank",
  "go:bank": "bank",
  "hospital:": "hospital",
  "store:": "store",
  "go:store": "store",
  "spirit-university:": "spirit-university",
  "parlor:": "parlor",
  "go:parlor": "parlor",
  "competitors:": "competitors",
  "go:competitors": "competitors",
  "yangs:": "yangs",
  "arc:give:church": "church",
  "arc:give:city-hall": "city-hall",
  "arc:give:reaper-club": "reaper-club",
  ...PLACE_PREFIXES,
};

const HEARSE_PRICES = [4, 12, 30, 50, 80];
const HEARSE_NAMES = ["Bicycle", "Budget Hearse", "Medalist", "Statesman", "Crown Sovereign"];

export function isExpandedView(view: View): boolean {
  return view.hud?.money !== undefined;
}

function styleOf(c: Ctx): XStyle {
  return c.me.expanded ?? STYLE_FALLBACK;
}

function xm(c: Ctx): XMemory {
  const m = c.memory;
  if (!m.x) {
    m.x = {
      owned: [],
      offered: {},
      permits: [],
      markup: 0,
      rivalry: "standard",
      rivalryDay: 0,
      stock: [2, 0, 0],
      monuments: 0,
      inChain: false,
      candidate: false,
      day: 0,
      ballots: [],
      strength: {},
      lastHit: -99,
      lastCharity: -99,
      plan: { morning: [], evening: [], done: {} },
      customer: null,
      toured: false,
    };
  }
  return m.x;
}

function enabled(view: View, id: string): Button | undefined {
  if (view.overlay) return undefined;
  return view.buttons.find((b) => b.id === id && b.enabled !== false);
}

function dollars(detail: string | undefined): number {
  return Number((detail ?? "").replace(/[^\d]/g, "")) || 0;
}

function cash(c: Ctx): number {
  return c.view.hud?.money ?? 0;
}

function karma(c: Ctx): number {
  return c.view.hud?.karma ?? 50;
}

function turns(c: Ctx): number {
  return c.view.hud?.turns ?? 0;
}

/** How many times `key` was done today, and count one more. */
function count(c: Ctx, key: string): number {
  return xm(c).plan.done[key] ?? 0;
}

function did(c: Ctx, key: string): void {
  const d = xm(c).plan.done;
  d[key] = (d[key] ?? 0) + 1;
}

// ---------------------------------------------------------------------------
// Learning from screens

function learnX(c: Ctx): void {
  const x = xm(c);
  const view = c.view;
  if (view.town?.day) x.day = view.town.day;
  if (view.town)
    x.ballots = (view.town.ballots ?? []).map((b) => ({ kind: b.kind, voted: b.voted }));
  // The office panel states the parlor's facts as data (section 11.5); the stats sheet and
  // the button labels are the fallback for a screen without one.
  const office = view.office;
  if (office) {
    x.stock = [office.stock.wood, office.stock.silver, office.stock.gold];
    x.markup = office.markup;
    x.rivalry = office.rivalry;
    x.offered = {};
    for (const row of office.upgrades) {
      if (row.state === "owned") {
        if (!x.owned.includes(row.id)) x.owned.push(row.id);
        continue;
      }
      x.offered[row.id] = row.price;
      x.owned = x.owned.filter((id) => id !== row.id);
      for (const need of row.requires ?? []) {
        if (need.kind === "permit" && need.have && !x.permits.includes(need.id))
          x.permits.push(need.id);
      }
    }
  }
  for (const line of view.stats ?? []) {
    if (line.id === "stock" && !office) {
      const m = /(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)/.exec(line.value);
      if (m) x.stock = [Number(m[1]), Number(m[2]), Number(m[3])];
    } else if (line.id === "markup" && !office) {
      const n = Number.parseInt(line.value, 10);
      if (Number.isFinite(n)) x.markup = n;
    } else if (line.id === "rivalry" && !office) {
      x.rivalry = /peace/i.test(line.value)
        ? "peaceful"
        : /cut/i.test(line.value)
          ? "cutthroat"
          : "standard";
    } else if (line.id === "psych") {
      const n = Number.parseInt(line.value.replace(/[^\d-]/g, ""), 10);
      if (Number.isFinite(n)) c.memory.known.psych = Math.max(0, n - 1);
    }
  }
  const upgrades = view.buttons.filter((b) => b.id.startsWith("parlor:buy:"));
  if (!office && (upgrades.length > 0 || /parlor:upgrades/.test(c.memory.session.lastAction))) {
    if (view.buttons.some((b) => b.id === "go:parlor")) {
      x.offered = Object.fromEntries(upgrades.map((b) => [b.id.slice(11), dollars(b.detail)]));
      for (const id of EXPANDED.upgrades.map((u) => u.id))
        if (!(id in x.offered) && !x.owned.includes(id)) x.owned.push(id);
    }
  }
  for (const b of view.buttons) {
    if (
      !office &&
      b.id.startsWith("city-hall:permit:") &&
      b.enabled === false &&
      /already/i.test(b.hint ?? "")
    ) {
      const id = b.id.slice(17);
      if (!x.permits.includes(id)) x.permits.push(id);
    }
  }
  if (view.buttons.some((b) => b.id === "city-hall:leavechain")) x.inChain = true;
  else if (view.buttons.some((b) => b.id === "city-hall:found")) x.inChain = false;
  if (view.buttons.some((b) => b.id === "city-hall:ads")) x.candidate = true;
  const text = screenText(view);
  const shelf = /(\d+) wood, (\d+) silver, (\d+) gold/.exec(text);
  if (!office && shelf && view.buttons.some((b) => b.id.startsWith("store:casket:"))) {
    x.stock = [Number(shelf[1]), Number(shelf[2]), Number(shelf[3])];
  }
}

// ---------------------------------------------------------------------------
// The day

export function decideExpanded(c: Ctx, guide: Guide | null): Action {
  const action = decideX(c, guide);
  // Never answer with something the screen does not offer.
  return offered(c.view, action) ? action : safeAction(c.view);
}

function decideX(c: Ctx, guide: Guide | null): Action {
  const { view, memory } = c;
  const s = memory.session;
  s.steps++;
  const sig = signature(view);
  s.repeats = sig === s.lastSig ? s.repeats + 1 : 0;
  s.lastSig = sig;
  if (s.current) s.errandSteps++;
  if (s.current && s.errandSteps > ERRAND_BUDGET) finishErrand(c);
  learnFromScreen(c);
  learnX(c);
  noticeThreat(c);
  if (!isXNegotiation(view)) xm(c).customer = null;
  if (view.scene === "lobby") return { type: "exit" };
  if (s.repeats >= REPEAT_LIMIT) {
    s.current = null;
    if (s.repeats >= REPEAT_LIMIT * 2) return { type: "exit" };
    return safeAction(view);
  }
  if (s.steps === 1) plan(c);
  if (view.overlay) return overlayX(c);
  if (isXNegotiation(view)) return negotiate(c, guide);
  if (hasButton(view, "prep:start")) return press("prep:start");
  if (view.buttons.some((b) => b.id.startsWith("prep:opt:"))) return prep(c);
  if (hasButton(view, "risk:take")) return riskX(c);
  if (buttonByLabel(view, /^Hire Twins$/)) {
    // One hire a day: a refused target sends the Twins back to the same offer.
    if (count(c, "twins") >= 1) {
      const no = buttonByLabel(view, /^No Thanks$/);
      return no ? press(no.id) : leave(c);
    }
    did(c, "twins");
    return twins(c);
  }
  if (view.buttons.some((b) => b.id.startsWith("tutorial:"))) return tour(c);
  if (view.scene === "news") return news(c);
  if (view.scene === "stats") {
    if (s.current === "stats") finishErrand(c);
    return hasButton(view, "go:desk") ? press("go:desk") : safeAction(view);
  }
  if (view.scene === "rankings") return rankings(c);
  if (view.map) return map(c);
  if (hasButton(view, "desk:wait") || hasButton(view, "desk:quit")) return desk(c);
  if (hasButton(view, "go:tutorial")) return press("go:tutorial");
  if (view.scene === "desk" && hasButton(view, "go:desk")) return press("go:desk");
  return place(c);
}

/**
 * Section 20.4: a hit-man rumour arrives as data (`Hud.warnings`). A style that protects
 * itself goes to the Reaper Club at once (the next errand) to hire a bodyguard for the night.
 */
function noticeThreat(c: Ctx): void {
  const warned = (c.view.hud?.warnings ?? []).some((w) => w.kind === "hit-rumour");
  if (!warned || !styleOf(c).protect) return;
  c.memory.session.scratch.threatened = true;
  if (count(c, "threat") > 0) return;
  did(c, "threat");
  const p = xm(c).plan;
  if (!p.morning.includes("club")) p.morning.unshift("club");
}

/** The day's errands. Morning ones help today's sales; evening ones spend what the day made. */
function plan(c: Ctx): void {
  const x = xm(c);
  const style = styleOf(c);
  const s = c.memory.session;
  c.memory.days++;
  x.plan = { morning: [], evening: [], done: {} };
  const morning: ErrandKind[] = ["stats"];
  if (c.rng.chance(c.me.social.announce)) morning.unshift("announce");
  morning.push("office", "bankout", "hospital");
  morning.push(...morningPlaces(c));
  morning.push("store", "university");
  if (karma(c) >= EXPANDED.karma.good[1] || style.holyWater > 0 || style.bingo > 0)
    morning.push("church");
  if (style.graves || style.duel) morning.push("graveyard");
  if (karma(c) <= EXPANDED.karma.evil[1] || (style.gamble && style.path === "evil"))
    morning.push("club");
  // A hitter needs fresh rankings to know whether the race is close, so the visit comes first.
  const visiting = (c.me.visits > 0 || style.hits) && style.rivalry !== "peaceful";
  const evening: ErrandKind[] = ["bankout", "cityhall", "church", "graveyard"];
  if (visiting) evening.push("visit");
  evening.push("club", "hospital", "yangs");
  evening.push("store", "office", "university");
  evening.push(...eveningPlaces(c));
  if (c.rng.chance(c.me.social.cafe)) evening.push("cafe");
  evening.push("bankin");
  x.plan.morning = morning;
  x.plan.evening = evening;
  s.morning = [];
  s.evening = [];
}

function nextErrand(c: Ctx): ErrandKind | null {
  const p = xm(c).plan;
  while (p.morning.length > 0) {
    const e = p.morning.shift() as ErrandKind;
    if (worthIt(c, e, true)) return e;
  }
  if (turns(c) > 0) return null;
  while (p.evening.length > 0) {
    const e = p.evening.shift() as ErrandKind;
    if (worthIt(c, e, false)) return e;
  }
  return null;
}

function wantedTag(c: Ctx): XTagWant | null {
  const k = c.memory.known;
  for (const w of styleOf(c).tags) {
    const level =
      w.item === "psych"
        ? k.psych + 1
        : w.item === "hearse"
          ? Math.max(0, HEARSE_NAMES.indexOf(k.ride))
          : w.item === "strength"
            ? k.strength
            : k.hpMax;
    const cap =
      w.item === "psych"
        ? EXPANDED.psych.maxLevel + 1
        : w.item === "strength"
          ? EXPANDED.caps.strength
          : w.item === "hp"
            ? EXPANDED.caps.hpMax
            : 4;
    if (level < Math.min(w.upTo, cap)) return w;
  }
  return null;
}

function tagCost(c: Ctx, w: XTagWant): number {
  const k = c.memory.known;
  switch (w.item) {
    case "psych":
      return 4 + EXPANDED_RULES.places.university.psychPerLevel * k.psych;
    case "hearse": {
      const cur = Math.max(0, HEARSE_NAMES.indexOf(k.ride));
      return (HEARSE_PRICES[cur + 1] ?? 999) - Math.floor((HEARSE_PRICES[cur] ?? 0) / 2);
    }
    case "strength":
      return 3 * k.strength;
    case "hp":
      return Math.trunc(k.hpMax * 1.2);
  }
}

function goldWorth(c: Ctx): number {
  const t = c.view.hud?.tags;
  if (!t) return 0;
  return t.gold + Math.floor((t.wood + t.silver * 2) / 4);
}

/**
 * The end of the season (sections 16.1, 17.5): money is worth nothing after
 * the last day, so from day 25 every bot builds every monument it can, and on
 * the last two days it tithes what is left.
 */
function endgame(c: Ctx): boolean {
  return xm(c).day >= SEASON - 5;
}

function lastDays(c: Ctx): boolean {
  return xm(c).day >= SEASON - 1;
}

function monumentGoal(c: Ctx): number {
  return endgame(c) ? EXPANDED.town.graveyard.monuments.length : styleOf(c).monuments.upTo;
}

/** Cash set aside for a planned big expense: the mayoral filing fee before day 8. */
function earmarked(c: Ctx): number {
  const style = styleOf(c);
  const x = xm(c);
  if (style.mayor > 0 && !x.candidate && x.day <= EXPANDED.town.cityHall.election.fileUntil)
    return EXPANDED.town.cityHall.election.fee;
  return 0;
}

function nextUpgrade(c: Ctx): { id: string; price: number } | null {
  const x = xm(c);
  for (const id of styleOf(c).upgrades) {
    if (x.owned.includes(id)) continue;
    const rule = EXPANDED.upgrades.find((u) => u.id === id);
    if (!rule) continue;
    if (rule.requires && !x.owned.includes(rule.requires)) continue;
    if (rule.permit && !x.permits.includes(rule.permit)) continue;
    return { id, price: x.offered[id] ?? rule.price };
  }
  return null;
}

function worthIt(c: Ctx, e: ErrandKind, morning: boolean): boolean {
  const x = xm(c);
  const style = styleOf(c);
  const hud = c.view.hud;
  const money = cash(c);
  switch (e) {
    case "stats":
    case "announce":
      return true;
    case "office":
      return (
        x.markup !== style.markup ||
        x.rivalry !== style.rivalry ||
        (nextUpgrade(c) !== null &&
          money >= (nextUpgrade(c)?.price ?? 0) + (morning ? 1000 : style.reserve)) ||
        (style.graves && karma(c) <= EXPANDED.karma.evil[0] && morning && turns(c) > 1) ||
        Object.keys(x.offered).length === 0
      );
    case "bankout":
      return (
        (!!hud?.debt && money > style.reserve + 2000) ||
        (style.save &&
          (hud?.savings ?? 0) > 0 &&
          (x.day >= style.monuments.from || money < 1500 || endgame(c))) ||
        (wantedTag(c) !== null &&
          goldWorth(c) >= tagCost(c, wantedTag(c) as XTagWant) &&
          (hud?.tags.wood ?? 0) + (hud?.tags.silver ?? 0) > 0 &&
          woodToSpare(c) > 0) ||
        loanWanted(c) > 0 ||
        (style.charity && x.day - x.lastCharity >= 4 && (hud?.tags.wood ?? 0) >= 8)
      );
    case "bankin":
      return style.save && !endgame(c) && !hud?.debt && money - depositBuffer(c) > 500;
    case "hospital":
      return (
        ((hud?.injuries ?? 0) > 0 && money > 1500) ||
        (!morning && style.leads > 0 && (hud?.leads ?? 0) < 3 && money > style.reserve + 1500)
      );
    case "store": {
      const wantStock = stockTarget(c).some((n, i) => (x.stock[i] ?? 0) < n);
      const hearse =
        wantedTag(c)?.item === "hearse" && goldWorth(c) >= tagCost(c, wantedTag(c) as XTagWant);
      return (wantStock && money > 1200) || hearse;
    }
    case "university": {
      const w = wantedTag(c);
      return !!w && w.item !== "hearse" && (hud?.tags.gold ?? 0) >= tagCost(c, w);
    }
    case "church":
      if (morning)
        return (
          (karma(c) >= EXPANDED.karma.good[1] && turns(c) > 1) ||
          (style.holyWater > 0 &&
            karma(c) >= 50 &&
            karma(c) < EXPANDED.karma.good[1] &&
            money > 2000 &&
            count(c, "water") < 1)
        );
      return (
        style.bingo > 0 ||
        (style.tithe > 0 && money > style.reserve * 2) ||
        (lastDays(c) && money > 3000) ||
        (style.path === "good" && karma(c) < 60 && money > style.reserve + 1000) ||
        (style.appeals > 0 && !!c.view.town?.story)
      );
    case "graveyard":
      if (morning) return turns(c) > 1 && (style.graves || style.duel);
      return (
        x.monuments < monumentGoal(c) &&
        (x.day >= style.monuments.from || money > 60000 || endgame(c)) &&
        money > 3000 + style.reserve
      );
    case "club":
      if (morning)
        return (
          (karma(c) <= EXPANDED.karma.evil[1] && turns(c) > 1) ||
          (!!c.memory.session.scratch.threatened && count(c, "guard") === 0)
        );
      return (
        (!!style.gamble && money > style.reserve + style.gamble.stake * 2) ||
        (style.market.length > 0 && money > style.reserve + 2500) ||
        hitCase(c) !== null ||
        (style.appeals > 0 && style.path === "evil" && !!c.view.town?.story) ||
        !!c.memory.session.scratch.threatened
      );
    case "cityhall": {
      const ballots = x.ballots;
      return (
        ballots.some((b) => !b.voted) ||
        (style.mayor > 0 && x.day <= 10 && money >= EXPANDED.town.cityHall.election.fee) ||
        (style.chain !== "none" && (x.day % 2 === 1 || !x.inChain) && money > 5500) ||
        (style.chain === "found" && x.inChain) ||
        (style.certify &&
          x.owned.length > 0 &&
          money > style.reserve + 1000 &&
          count(c, "certify") === 0 &&
          x.day % 3 === 0) ||
        permitWanted(c) !== null
      );
    }
    case "visit":
      return c.memory.known.visitsLeft > 0;
    case "yangs":
      return (
        !!hud &&
        ((hud.luck < 40 && hud.bpToday >= 5) ||
          ((c.me.tiger || c.me.sparrow) && hud.bpToday >= 20 && c.memory.known.yangsLeft > 0))
      );
    case "police":
    case "crematorium":
    case "florist":
    case "gazette":
    case "coroner":
    case "health":
    case "pawn":
    case "mournes":
      return placeWorth(c, e, morning);
    default:
      return true;
  }
}

/**
 * Caskets to keep (section 6.2): a sale from stock keeps the whole casket
 * price, a rush order almost nothing, so a careful parlor fills the
 * storeroom in the style's proportions (6 caskets, 18 with the storeroom).
 */
function stockTarget(c: Ctx): [number, number, number] {
  const style = styleOf(c);
  const cap = xm(c).owned.includes("storeroom")
    ? EXPANDED.money.storeroomCapacity
    : EXPANDED.money.stockCapacity;
  const total = style.stock[0] + style.stock[1] + style.stock[2];
  if (total <= 0) return [0, 0, 0];
  const out = style.stock.map((n) => Math.floor((n / total) * cap)) as [number, number, number];
  let left = cap - out[0] - out[1] - out[2];
  for (let i = 0; left > 0; i = (i + 1) % 3, left--) out[i] = (out[i] ?? 0) + 1;
  return out;
}

function permitWanted(c: Ctx): string | null {
  const x = xm(c);
  for (const id of styleOf(c).upgrades) {
    const rule = EXPANDED.upgrades.find((u) => u.id === id);
    if (!rule?.permit || x.owned.includes(id) || x.permits.includes(rule.permit)) continue;
    if (rule.requires && !x.owned.includes(rule.requires)) continue;
    const price = EXPANDED.town.cityHall.permits[rule.permit] ?? 0;
    if (cash(c) > price + rule.price * 0.5) return rule.permit;
  }
  return null;
}

/** Wood a bot keeps for bingo and the club's cover. */
function woodToSpare(c: Ctx): number {
  const style = styleOf(c);
  const keep = style.bingo + (style.gamble || style.market.length > 0 || style.hits ? 3 : 0);
  return (c.view.hud?.tags.wood ?? 0) - keep;
}

function depositBuffer(c: Ctx): number {
  const style = styleOf(c);
  return style.reserve + 6000;
}

/** A loan worth taking: the next upgrade is close but out of reach (and early enough to repay). */
function loanWanted(c: Ctx): number {
  const style = styleOf(c);
  const x = xm(c);
  if (style.borrow <= 0 || c.view.hud?.debt || x.day < 3 || x.day > 14) return 0;
  const next = nextUpgrade(c);
  if (!next) return 0;
  const short = next.price + 1000 - cash(c);
  if (short <= 0 || short > style.borrow) return 0;
  return Math.ceil(short / 500) * 500;
}

function desk(c: Ctx): Action {
  const s = c.memory.session;
  const x = xm(c);
  if (!s.current) {
    const next = nextErrand(c);
    if (next) startErrand(c, next);
  }
  switch (s.current) {
    case "stats":
      if (hasButton(c.view, "go:stats")) return press("go:stats");
      finishErrand(c);
      return desk(c);
    case "office":
      if (hasButton(c.view, "go:parlor")) return press("go:parlor");
      finishErrand(c);
      return desk(c);
    case "announce":
      finishErrand(c);
      return desk(c);
    case null:
      break;
    default:
      if (hasButton(c.view, "go:map")) return press("go:map");
      finishErrand(c);
      return desk(c);
  }
  if (turns(c) > 0 && hasButton(c.view, "desk:wait")) return press("desk:wait");
  if (x.plan.evening.length > 0 && hasButton(c.view, "go:map")) {
    // Errands not worth the trip are dropped by nextErrand; nothing left.
  }
  c.memory.session.leaving = true;
  return hasButton(c.view, "desk:quit") ? press("desk:quit") : { type: "exit" };
}

function map(c: Ctx): Action {
  const s = c.memory.session;
  if (!s.current) {
    const next = nextErrand(c);
    if (next) startErrand(c, next);
  }
  const target = s.current ? PLACE[s.current] : undefined;
  const places = c.view.map ?? [];
  if (s.current === "office" || s.current === "stats") {
    const home = places.find((p) => p.id === "funeral-home");
    if (home) return { type: "visit", placeId: home.id };
  }
  if (target && places.some((p) => p.id === target)) return { type: "visit", placeId: target };
  if (s.current && !target) finishErrand(c);
  const home = places.find((p) => p.id === "funeral-home") ?? places[0];
  return home ? { type: "visit", placeId: home.id } : safeAction(c.view);
}

function placeOf(view: View): string | null {
  for (const b of view.buttons) {
    for (const [prefix, place] of Object.entries(PREFIX)) if (b.id.startsWith(prefix)) return place;
  }
  return null;
}

/** Leaves a place: its exit, or the way back to its main screen. */
function leave(c: Ctx): Action {
  const v = c.view;
  if (hasButton(v, "go:map")) return press("go:map");
  const back = enabledButtons(v).find(
    (b) =>
      /:main$/.test(b.id) ||
      /^go:(bank|store|parlor|graveyard|competitors|desk)$/.test(b.id) ||
      b.id === "bank:transferhome",
  );
  if (back) return press(back.id);
  if (hasButton(v, "hospital:leave-room")) return press("hospital:leave-room");
  return safeAction(v);
}

function done(c: Ctx): Action {
  finishErrand(c);
  return leave(c);
}

function place(c: Ctx): Action {
  const s = c.memory.session;
  const here = placeOf(c.view);
  const wanted = s.current === "office" ? "parlor" : s.current ? PLACE[s.current] : undefined;
  if (s.current === "visit" && (c.view.battle || hasButton(c.view, "battle:attack")))
    return battle(c);
  if (hasButton(c.view, "battle:yellwin") || hasButton(c.view, "battle:yelllost")) return visit(c);
  if (here && wanted === here) {
    switch (s.current) {
      case "office":
        return office(c);
      case "store":
        return store(c);
      case "university":
        return university(c);
      case "bankout":
        return bankOut(c);
      case "bankin":
        return bankIn(c);
      case "bank":
        return bankOut(c);
      case "hospital":
        return hospital(c);
      case "cityhall":
        return cityHall(c);
      case "church":
        return church(c);
      case "graveyard":
        return graveyard(c);
      case "club":
        return club(c);
      case "visit":
        return visit(c);
      case "yangs":
        return yangsX(c);
      case "police":
      case "crematorium":
      case "florist":
      case "gazette":
      case "coroner":
      case "health":
      case "pawn":
      case "mournes":
        return runPlace(c, s.current, turns(c) > 0) ?? done(c);
    }
  }
  if (s.current === "cafe" && c.view.scene === "cafe") return cafe(c);
  if (s.current === "visit") return visit(c);
  if (hasButton(c.view, "hospital:leave-room")) return press("hospital:leave-room");
  // A duel's end screen, a shop's result: anything else goes home.
  if (hasButton(c.view, "go:graveyard") && s.current === "graveyard") return press("go:graveyard");
  return leave(c);
}

// ---------------------------------------------------------------------------
// Overlays

function overlayX(c: Ctx): Action {
  const o = c.view.overlay;
  const s = c.memory.session;
  const x = xm(c);
  if (!o) return safeAction(c.view);
  if (o.kind === "message" || o.kind === "confirm") {
    const text = plain(o.text);
    if (/paid for your|hit man|contract on|bodyguard/i.test(text)) s.scratch.threatened = true;
  }
  if (o.kind === "playerPicker") {
    const target = s.scratch.pick;
    if (o.id === "script:getname") {
      // The Twins (or a curse) refused a target: try someone else, and give up after two.
      const tried = String(s.scratch.scriptTried ?? "")
        .split(",")
        .filter((t) => t !== "");
      const choices = o.players.filter(
        (p) => p.id !== c.memory.self.playerId && !tried.includes(String(p.id)),
      );
      const id = tried.length >= 2 ? null : enemy(c, choices);
      if (id !== null) s.scratch.scriptTried = [...tried, String(id)].join(",");
      return { type: "pickPlayer", overlayId: o.id, playerId: id };
    }
    if (o.id === "bank:tpick") {
      const id = poorest(
        c,
        o.players.filter((p) => p.id !== c.memory.self.playerId),
      );
      return { type: "pickPlayer", overlayId: o.id, playerId: id };
    }
    if (PLACE_PICKERS.includes(o.id)) {
      return { type: "pickPlayer", overlayId: o.id, playerId: placePicker(c, o.id, o.players) };
    }
    if (
      o.id === "graveyard:pick" ||
      o.id === "reaper-club:hitpick" ||
      o.id === "city-hall:invitepick"
    ) {
      const id =
        typeof target === "number" && o.players.some((p) => p.id === target)
          ? target
          : pickFor(c, o.id, o.players);
      delete s.scratch.pick;
      return { type: "pickPlayer", overlayId: o.id, playerId: id };
    }
  }
  if (o.kind === "textInput") {
    const amount = s.scratch.amount;
    if (o.id === "city-hall:chainname") {
      const names = [
        "Last Rites Group",
        "Grave Alliance",
        "United Rest",
        "Final Partners",
        "Coffin Union",
      ];
      const name = names[(c.memory.self.playerId + x.day) % names.length] ?? "Rest Group";
      return { type: "submitText", overlayId: o.id, text: name.slice(0, o.maxLength) };
    }
    if (/^bank:(depositamt|withdrawamt|borrowamt|tcount)$/.test(o.id)) {
      delete s.scratch.amount;
      return {
        type: "submitText",
        overlayId: o.id,
        text:
          typeof amount === "number" && amount > 0
            ? String(Math.floor(amount)).slice(0, o.maxLength)
            : null,
      };
    }
  }
  return classicOverlay(c);
}

/** Whom to duel, hit or invite, when the scratch names nobody. */
function pickFor(c: Ctx, id: string, players: { id: number; name: string }[]): number | null {
  const me = c.memory.self.playerId;
  const choices = players.filter((p) => p.id !== me);
  const rivals = c.memory.rivals;
  if (choices.length === 0) return null;
  if (id === "city-hall:invitepick") return choices[0]?.id ?? null;
  if (id === "reaper-club:hitpick") {
    // Only the parlor the race is against, and only at a price that leaves the business running.
    const case_ = hitCase(c);
    return case_ && choices.some((p) => p.id === case_.id) ? case_.id : null;
  }
  // A duel: the richest rival whose strength we do not fear and whom the duel table favours.
  const mine = c.memory.known.strength;
  const strength = xm(c).strength;
  const hp = Math.max(1, c.memory.known.hpMax);
  let best: { id: number; score: number } | null = null;
  for (const p of choices) {
    const r = rivals.find((q) => q.id === p.id);
    const his = strength[String(p.id)] ?? 3;
    if (his > mine + 1) continue;
    if (duelOutlook(mine, his, hp, hp) < 0.05) continue;
    const score = Math.sqrt(Math.max(0, r?.bp ?? 0)) - his * 4 + c.rng.next() * 6;
    if (!best || score > best.score) best = { id: p.id, score };
  }
  return best?.id ?? null;
}

/** What a landed hit takes from a target of `bp` (section 20.4: the parlor curve x `lossShare`). */
function hitLoss(bp: number): number {
  const p = EXPANDED.pvp;
  const gain = Math.min(p.gainCap, p.gainFactor * Math.sqrt(Math.max(0, bp)));
  return Math.floor(gain * EXPANDED.town.club.hit.lossShare);
}

/**
 * A hit worth hiring (section 20.4). The hirer gains nothing, and the money would
 * buy about 0.01 BP a dollar elsewhere, so a hit only pays in a race: the parlor
 * at the top is close enough that its loss can decide first place. Returns the
 * target and the price, or null.
 */
function hitCase(c: Ctx): { id: number; bp: number; price: number } | null {
  const style = styleOf(c);
  const x = xm(c);
  if (!style.hits || x.day < 8 || x.day > SEASON - 1 || x.day - x.lastHit < 3) return null;
  const mine = c.view.hud?.bpTotal ?? 0;
  const top = c.memory.rivals.reduce<{ id: number; bp: number } | null>(
    (best, r) => (!best || r.bp > best.bp ? { id: r.id, bp: r.bp } : best),
    null,
  );
  if (!top) return null;
  const loss = hitLoss(top.bp);
  const gap = top.bp - mine;
  // In reach: not far ahead of the leader (a hit would not matter) and within 12% behind (a
  // season's swing in a tight field), so the parlors in the chase are the ones that hire.
  if (gap < -loss || gap > top.bp * 0.12) return null;
  const club = EXPANDED.town.club.hit;
  const price = club.base + club.perBp * top.bp;
  if (cash(c) - price < style.reserve + 500) return null;
  return { id: top.id, bp: top.bp, price };
}

// ---------------------------------------------------------------------------
// Customers

function negotiate(c: Ctx, guide: Guide | null): Action {
  const x = xm(c);
  const g = guide ?? EMPTY_GUIDE;
  const view = c.view;
  const ctx: SellContext = {
    view,
    guide: g,
    style: c.me.sales,
    skill: c.skill,
    rng: c.rng,
    psych: c.memory.known.psych,
    karma: karma(c),
    markup: x.markup,
    morals: styleOf(c).path,
  };
  const name = view.customer?.name ?? "";
  if (!x.customer || x.customer.key !== name || c.memory.session.lastAction === "press:desk:wait") {
    x.customer = meetX(view, ctx);
  }
  const n = x.customer;
  watchX(n, view, ctx);
  c.options.peekX?.(n);
  const move = chooseX(n, ctx);
  if (enabled(view, move)) return press(move);
  // Never press what the screen does not offer.
  if (enabled(view, "neg:done")) return press("neg:done");
  if (enabled(view, "neg:back")) return press("neg:back");
  const any = enabledButtons(view)[0];
  return any ? press(any.id) : safeAction(view);
}

const EMPTY_GUIDE: Guide = {
  traits: new Map(),
  items: new Map(),
  packages: new Map(),
  cremation: { fee: 1500, tags: ["cremation"] },
  tells: { loved: [], notLoved: [], cheapLow: [], cheapMid: [], cheapHigh: [] },
  overLimit: [/over my limit|over what I can spend/],
  blessLoved: [],
  blessNotLoved: [],
  offers: new Map(),
};

/**
 * Body preparation (section 8.2): the option that suits the karma path. The prep panel
 * (section 11.5) gives each choice's effects as numbers, with the odds and the outcome of a
 * gamble; without one the choice is read from the card's `detail` as before.
 */
function prep(c: Ctx): Action {
  const style = styleOf(c);
  const options = c.view.buttons.filter((b) => b.id.startsWith("prep:opt:") && b.enabled !== false);
  const k = karma(c);
  const choices = c.view.prep?.choices;
  let best: { id: string; score: number } | null = null;
  for (const b of options) {
    const d = b.detail ?? "";
    const num = (re: RegExp) => Number(re.exec(d)?.[1] ?? 0);
    let money = 0;
    let kd = 0;
    let bp = 0;
    let rep = 0;
    let luck = 0;
    const choice = choices?.find((x) => x.buttonId === b.id);
    if (choice) {
      const p = choice.risk ? choice.risk.chance / 100 : 1;
      const f = choice.risk?.fail ?? {};
      const e = (key: "money" | "karma" | "bp" | "reviews" | "luck") =>
        p * (choice.effects[key] ?? 0) + (1 - p) * (f[key] ?? 0);
      money = e("money");
      kd = e("karma");
      bp = e("bp");
      rep = e("reviews");
      luck = e("luck");
    } else {
      money =
        (/\+\$(\d+)/.exec(d) ? num(/\+\$(\d+)/) : 0) - (/-\$(\d+)/.exec(d) ? num(/-\$(\d+)/) : 0);
      kd = num(/([+-]\d+) karma/);
      bp = num(/([+-]\d+) BP/);
      rep = num(/([+-]\d+) reputation/);
      luck = num(/([+-]\d+) luck/);
    }
    let score = money / 120 + bp + rep * 2 + luck * 0.5;
    if (style.path === "good") score += kd * (k < 90 ? 6 : 1);
    else if (style.path === "evil") score -= kd * (k > 10 ? 4 : 0.5);
    else score += kd * (k < 45 ? 2 : k > 65 ? -0.5 : 0.3);
    if (!best || score > best.score) best = { id: b.id, score };
  }
  return best ? press(best.id) : safeAction(c.view);
}

/**
 * A risk (Classic's, legacy/source risks): win about 50 BP on
 * `randomYesNo(luck, 0.9)` or lose up to 50 of today's BP. Every Expanded
 * bot weighs the odds; the cautious ones want a bigger edge.
 */
function riskX(c: Ctx): Action {
  const luck = c.view.hud?.luck ?? 50;
  const today = c.view.hud?.bpToday ?? 0;
  if (c.memory.difficulty === "easy")
    return press(luck >= c.me.riskLuck ? "risk:take" : "risk:decline");
  const adjusted = luck + Math.trunc((50 - luck) * 0.1);
  const p = Math.min(1, (adjusted + 1) / 100);
  const ev = p * 50 - (1 - p) * Math.min(50, today);
  const edge = c.me.riskLuck > 100 ? 12 : c.me.riskLuck <= 0 ? 0 : 7;
  return press(ev > edge ? "risk:take" : "risk:decline");
}

function tour(c: Ctx): Action {
  const v = c.view;
  xm(c).toured = true;
  if (hasButton(v, "tutorial:start")) return press("tutorial:start");
  if (hasButton(v, "tutorial:next")) return press("tutorial:next");
  return hasButton(v, "tutorial:skip") ? press("tutorial:skip") : safeAction(v);
}

/**
 * Yang's under Expanded rules: a Lucky Dragon when luck is low; the Cursed
 * Tiger only from the griefers, the Lucky Sparrow only from the Soft Touch
 * (each costs 20 BP, a heavy price for a gesture).
 */
function yangsX(c: Ctx): Action {
  const v = c.view;
  const hud = v.hud;
  const k = c.memory.known;
  if (hasButton(v, "yangs:dragon")) {
    if (hud && hud.luck < 40 && hud.bpToday >= 5 && count(c, "dragon") === 0) {
      did(c, "dragon");
      return press("yangs:dragon");
    }
    if (hud && hud.bpToday >= 20 && k.yangsLeft > 0 && count(c, "delivery") === 0) {
      // The curse stays with the two griefers it was written for (hits no longer imply it).
      if (
        c.me.tiger &&
        (c.me.id === "shark" || c.me.id === "saboteur") &&
        hasButton(v, "yangs:tiger")
      ) {
        did(c, "delivery");
        k.yangsLeft--;
        return press("yangs:tiger");
      }
      if (
        c.me.sparrow &&
        c.me.id === "mourner" &&
        xm(c).day % 4 === 0 &&
        hasButton(v, "yangs:sparrow")
      ) {
        did(c, "delivery");
        k.yangsLeft--;
        return press("yangs:sparrow");
      }
    }
    return done(c);
  }
  if (hasButton(v, "yangs:menu")) return press("yangs:menu");
  return yangs(c);
}

// ---------------------------------------------------------------------------
// The office

function office(c: Ctx): Action {
  const v = c.view;
  const x = xm(c);
  const style = styleOf(c);
  const markupCards = v.buttons.filter((b) => b.id.startsWith("parlor:markup:"));
  if (markupCards.length > 0) {
    const want = `parlor:markup:${style.markup}`;
    if (enabled(v, want)) {
      x.markup = style.markup;
      return press(want);
    }
    x.markup = style.markup;
    return press("go:parlor");
  }
  const rivalryCards = v.buttons.filter((b) => b.id.startsWith("parlor:rivalry:"));
  if (rivalryCards.length > 0) {
    const want = `parlor:rivalry:${style.rivalry}`;
    if (enabled(v, want) && count(c, "rivalry") === 0) {
      did(c, "rivalry");
      x.rivalry = style.rivalry;
      x.rivalryDay = x.day;
      return press(want);
    }
    if (!enabled(v, want) && !v.office)
      x.rivalry = v.buttons.find((b) => b.id === want)?.hint ? style.rivalry : x.rivalry;
    did(c, "rivalry");
    return press("go:parlor");
  }
  if (
    v.buttons.some((b) => b.id.startsWith("parlor:buy:")) ||
    (/parlor:upgrades/.test(c.memory.session.lastAction) && hasButton(v, "go:parlor"))
  ) {
    const next = nextUpgrade(c);
    if (next && count(c, "buy") < 3) {
      const row = v.office?.upgrades.find((u) => u.id === next.id);
      const b = enabled(v, row?.buttonId ?? `parlor:buy:${next.id}`);
      const price = row?.price ?? dollars(b?.detail);
      const keep = turns(c) > 0 ? 1000 : Math.min(style.reserve, 2500);
      if (b && cash(c) - earmarked(c) - price >= keep) {
        did(c, "buy");
        x.owned.push(next.id);
        return press(b.id);
      }
    }
    did(c, "upgrades");
    return press("go:parlor");
  }
  // The summary.
  if (x.markup !== style.markup && enabled(v, "parlor:markup") && count(c, "markupView") === 0) {
    did(c, "markupView");
    return press("parlor:markup");
  }
  if (
    x.rivalry !== style.rivalry &&
    enabled(v, "parlor:rivalry") &&
    count(c, "rivalryView") === 0
  ) {
    did(c, "rivalryView");
    return press("parlor:rivalry");
  }
  if (style.graves && enabled(v, "parlor:dig") && turns(c) > 1 && count(c, "dig") < 1) {
    did(c, "dig");
    return press("parlor:dig");
  }
  if (enabled(v, "parlor:upgrades") && count(c, "upgrades") === 0) return press("parlor:upgrades");
  finishErrand(c);
  return hasButton(v, "go:desk") ? press("go:desk") : leave(c);
}

// ---------------------------------------------------------------------------
// Di-Mart and Spirit University

function store(c: Ctx): Action {
  const v = c.view;
  const x = xm(c);
  const style = styleOf(c);
  const text = plain(v.text);
  const w = wantedTag(c);
  const hearse = w?.item === "hearse" && (v.hud?.tags.gold ?? 0) >= tagCost(c, w);
  if (v.buttons.some((b) => b.id.startsWith("store:casket:"))) {
    // The casket shelf: refill toward the stock the style keeps.
    const keep = turns(c) > 0 ? 400 : Math.min(style.reserve, 2000);
    for (const tier of [0, 1, 2]) {
      if ((x.stock[tier] ?? 0) >= (stockTarget(c)[tier] ?? 0)) continue;
      const b = enabled(v, `store:casket:${tier}`);
      if (b && cash(c) - earmarked(c) - dollars(b.detail) >= keep && count(c, "casket") < 20) {
        did(c, "casket");
        x.stock[tier] = (x.stock[tier] ?? 0) + 1;
        return press(b.id);
      }
    }
    did(c, "shelf");
    return press("go:store");
  }
  if (hasButton(v, "store:caskets")) {
    const wantStock = stockTarget(c).some((n, i) => (x.stock[i] ?? 0) < n);
    if (wantStock && count(c, "shelf") === 0) return press("store:caskets");
    if (hearse && count(c, "hearse") === 0) return press("store:hearse");
    return done(c);
  }
  // The hearse list and the hearse page.
  if (v.buttons.some((b) => b.id.startsWith("store:look:"))) {
    did(c, "hearse");
    const k = c.memory.known;
    const current = Math.max(0, HEARSE_NAMES.indexOf(k.ride));
    const gold = v.hud?.tags.gold ?? 0;
    let best = -1;
    for (const m of text.matchAll(/(\d+) - ([A-Za-z ]+?) - Cost: (\d+) gold/g)) {
      const index = Number(m[1]);
      const cost = Number(m[3]) - Math.floor((HEARSE_PRICES[current] ?? 0) / 2);
      if (index > current && index <= (w?.upTo ?? 0) && cost <= gold) best = Math.max(best, index);
    }
    if (best > 0 && hasButton(v, `store:look:${best}`)) {
      c.memory.session.scratch.hearse = best;
      return press(`store:look:${best}`);
    }
    return hasButton(v, "go:store") ? press("go:store") : leave(c);
  }
  if (hasButton(v, "store:buy")) {
    if (typeof c.memory.session.scratch.hearse === "number" && count(c, "buyHearse") === 0) {
      did(c, "buyHearse");
      const n = c.memory.session.scratch.hearse;
      c.memory.known.ride = HEARSE_NAMES[n] ?? c.memory.known.ride;
      return press("store:buy");
    }
    return press("store:hearse");
  }
  if (hasButton(v, "store:hearse")) return press("store:hearse");
  return leave(c);
}

function university(c: Ctx): Action {
  const v = c.view;
  const s = c.memory.session;
  const text = plain(v.text);
  if (hasButton(v, "spirit-university:psych")) {
    const st = /ST[^\n]*?cost: (\d+)/.exec(text)?.[1];
    if (st) c.memory.known.strength = Math.round(Number(st) / 3);
    const pe = /PE[^\n]*?cost: (\d+)/.exec(text)?.[1];
    if (pe) c.memory.known.hpMax = Math.max(c.memory.known.hpMax, Math.floor(Number(pe) / 1.2));
    const psy = /PSY[^\n]*?cost: (\d+)/.exec(text)?.[1];
    if (psy)
      c.memory.known.psych = Math.max(
        0,
        Math.round((Number(psy) - 4) / EXPANDED_RULES.places.university.psychPerLevel),
      );
    const w = wantedTag(c);
    if (!w || w.item === "hearse" || count(c, "class") >= 10 || s.scratch.capped) return done(c);
    if ((v.hud?.tags.gold ?? 0) < tagCost(c, w)) return done(c);
    did(c, "class");
    s.scratch.item = w.item;
    return press(
      w.item === "psych"
        ? "spirit-university:psych"
        : w.item === "strength"
          ? "spirit-university:strength"
          : "spirit-university:hp",
    );
  }
  if (/raised to|increase|You now|capped|can't teach|no higher/i.test(text)) {
    if (/capped|can't teach|no higher|already/i.test(text)) s.scratch.capped = true;
    if (s.scratch.item === "strength") c.memory.known.strength++;
    if (s.scratch.item === "psych" && !s.scratch.capped) c.memory.known.psych++;
  }
  if (hasButton(v, "spirit-university:main")) return press("spirit-university:main");
  return leave(c);
}

// ---------------------------------------------------------------------------
// The bank

function bankOut(c: Ctx): Action {
  const v = c.view;
  const x = xm(c);
  const style = styleOf(c);
  const s = c.memory.session;
  const hud = v.hud;
  // Main counter.
  if (hasButton(v, "bank:all-gold")) {
    const w = wantedTag(c);
    if (
      w &&
      count(c, "gold") === 0 &&
      woodToSpare(c) >= 0 &&
      (hud?.tags.wood ?? 0) + (hud?.tags.silver ?? 0) > 0 &&
      goldWorth(c) >= tagCost(c, w)
    ) {
      did(c, "gold");
      if (woodToSpare(c) > 3 || (hud?.tags.silver ?? 0) > 0) return press("bank:all-gold");
    }
    if (hud?.debt && cash(c) > style.reserve + 1000 && count(c, "repay") === 0)
      return press("bank:loan");
    if (
      style.save &&
      (hud?.savings ?? 0) > 0 &&
      count(c, "withdraw") === 0 &&
      (x.day >= style.monuments.from || cash(c) < 1500 || endgame(c))
    )
      return press("bank:savings");
    if (loanWanted(c) > 0 && count(c, "borrow") === 0) return press("bank:loan");
    if (
      style.charity &&
      x.day - x.lastCharity >= 4 &&
      (hud?.tags.wood ?? 0) >= 8 &&
      count(c, "charity") === 0 &&
      (v.bank?.transfers.canSend ?? true)
    )
      return press("bank:transferhome");
    return done(c);
  }
  // Loans.
  if (hasButton(v, "bank:borrow") || v.buttons.some((b) => b.id === "bank:repay")) {
    if (enabled(v, "bank:repay") && count(c, "repay") === 0 && cash(c) > style.reserve + 1000) {
      did(c, "repay");
      return press("bank:repay");
    }
    const want = loanWanted(c);
    // The bank panel says whether a loan can be taken and how much (section 11.5).
    const canBorrow = v.bank ? v.bank.loan.canBorrow : enabled(v, "bank:borrow") !== undefined;
    if (want > 0 && canBorrow && enabled(v, "bank:borrow") && count(c, "borrow") === 0) {
      did(c, "borrow");
      s.scratch.amount = Math.min(want, style.borrow, v.bank?.loan.limit ?? style.borrow);
      return press("bank:borrow");
    }
    did(c, "repay");
    did(c, "borrow");
    return press("go:bank");
  }
  // Savings.
  if (v.buttons.some((b) => b.id === "bank:withdrawall")) {
    if (enabled(v, "bank:withdrawall") && count(c, "withdraw") === 0) {
      did(c, "withdraw");
      return press("bank:withdrawall");
    }
    did(c, "withdraw");
    return press("go:bank");
  }
  // Transfers: a little charity for the poorest parlor.
  if (hasButton(v, "bank:transfer") && count(c, "charity") === 0) {
    did(c, "charity");
    x.lastCharity = x.day;
    return press("bank:transfer");
  }
  if (v.buttons.some((b) => b.id.startsWith("bank:ttier:"))) {
    if (enabled(v, "bank:ttier:0") && count(c, "tier") === 0) {
      did(c, "tier");
      s.scratch.amount = 4;
      return press("bank:ttier:0");
    }
    return press("bank:transferhome");
  }
  if (v.buttons.some((b) => b.id === "bank:transfer")) return press("go:bank");
  return leave(c);
}

function bankIn(c: Ctx): Action {
  const v = c.view;
  const s = c.memory.session;
  if (hasButton(v, "bank:savings") && count(c, "deposit") === 0 && (v.bank?.canDeposit ?? true))
    return press("bank:savings");
  if (v.buttons.some((b) => b.id === "bank:deposit")) {
    const amount = cash(c) - depositBuffer(c);
    if (enabled(v, "bank:deposit") && amount > 500 && count(c, "deposit") === 0) {
      did(c, "deposit");
      s.scratch.amount = amount;
      return press("bank:deposit");
    }
    did(c, "deposit");
    return press("go:bank");
  }
  return done(c);
}

// ---------------------------------------------------------------------------
// The hospital

function hospital(c: Ctx): Action {
  const v = c.view;
  const style = styleOf(c);
  const injuries = v.hud?.injuryList;
  for (const b of v.buttons) {
    if (!b.id.startsWith("hospital:treat:") || b.enabled === false) continue;
    // The HUD's injury list says what each costs and how long it lasts; a treatment is worth
    // about a hundred dollars a BP (a monument's rate) of the turns and patience it gives back.
    const row = injuries?.find((i) => `hospital:treat:${i.id}` === b.id);
    const price = row?.treatPrice ?? dollars(b.detail);
    if (row) {
      const bp =
        (row.turns * 33 + row.patience * 6 + (style.duel || style.hits ? row.hp * 0.5 : 0)) *
        row.daysLeft;
      if (bp * 100 < price) continue;
    }
    if (cash(c) - price >= 500 && count(c, "treat") < 3) {
      did(c, "treat");
      return press(b.id);
    }
  }
  const lead = enabled(v, "hospital:lead");
  if (
    lead &&
    turns(c) === 0 &&
    count(c, "lead") < style.leads &&
    cash(c) - dollars(lead.detail) >= style.reserve
  ) {
    did(c, "lead");
    return press("hospital:lead");
  }
  return done(c);
}

// ---------------------------------------------------------------------------
// City Hall

function cityHall(c: Ctx): Action {
  const v = c.view;
  const x = xm(c);
  const style = styleOf(c);
  const s = c.memory.session;
  // Sub-screens first. The ballots panel (section 11.5) lists every option with its id, who
  // voted for it and the card to press; the card ids are the fallback.
  const ballots = v.ballots;
  const votes = v.buttons.filter((b) => b.id.startsWith("city-hall:vote:"));
  if (votes.length > 0 || hasButton(v, "city-hall:lobby")) {
    did(c, "ordinanceSeen");
    const ord = ballots?.ordinance;
    const voted = ord ? ord.myVote !== null : votes.some((b) => b.enabled === false);
    if (!voted && count(c, "vote") === 0) {
      let pick: Button | undefined;
      if (ord) {
        const wanted =
          style.vote.map((id) => ord.options.find((o) => o.id === id)).find((o) => o) ??
          ord.options[0];
        pick = wanted ? enabled(v, wanted.buttonId) : undefined;
      } else {
        pick =
          style.vote
            .map((id) => votes.find((b) => b.id === `city-hall:vote:${id}`))
            .find((b) => b) ?? votes[0];
      }
      if (pick && pick.enabled !== false) {
        did(c, "vote");
        for (const bl of x.ballots) if (bl.kind === "ordinance") bl.voted = true;
        return press(pick.id);
      }
    }
    const lobby = enabled(v, "city-hall:lobby");
    const lobbyPrice = ord?.lobby.price ?? dollars(lobby?.detail);
    if (
      style.lobby &&
      lobby &&
      count(c, "lobby") < 1 &&
      (ord ? ord.lobby.bought < ord.lobby.max : true) &&
      cash(c) - lobbyPrice > style.reserve
    ) {
      did(c, "lobby");
      return press("city-hall:lobby");
    }
    return press("city-hall:main");
  }
  const candidates = v.buttons.filter((b) => b.id.startsWith("city-hall:elect:"));
  if (
    candidates.length > 0 ||
    hasButton(v, "city-hall:file") ||
    v.buttons.some((b) => b.id === "city-hall:ads")
  ) {
    did(c, "electionSeen");
    const el = ballots?.election;
    const file = enabled(v, "city-hall:file");
    const fee = el?.fee ?? dollars(file?.detail);
    if (style.mayor > 0 && file && cash(c) - fee >= 0 && count(c, "file") === 0) {
      did(c, "file");
      x.candidate = true;
      return press("city-hall:file");
    }
    const ads = enabled(v, "city-hall:ads");
    const adPrice = el?.ads.price ?? dollars(ads?.detail);
    if (
      ads &&
      style.mayor > 0 &&
      count(c, "ads") < style.mayor &&
      (el ? el.ads.mine < el.ads.max : true) &&
      cash(c) - adPrice >= style.reserve / 2
    ) {
      did(c, "ads");
      return press("city-hall:ads");
    }
    if (el) {
      const open = el.candidates.filter((k) => k.buttonId && enabled(v, k.buttonId));
      if (
        el.phase === "voting" &&
        open.length > 0 &&
        !el.candidates.some((k) => k.mine) &&
        count(c, "elect") === 0
      ) {
        did(c, "elect");
        // Ourselves if we stand; otherwise the candidate who looks least dangerous: the lowest
        // BP on the last rankings.
        const self = open.find((k) => k.me);
        const others = open
          .map((k) => ({ k, bp: c.memory.rivals.find((r) => r.id === k.playerId)?.bp ?? 0 }))
          .sort((a, b2) => a.bp - b2.bp);
        const pick = self ?? others[0]?.k;
        for (const bl of x.ballots) if (bl.kind === "election") bl.voted = true;
        if (pick?.buttonId) return press(pick.buttonId);
      }
    } else if (
      candidates.length > 0 &&
      !candidates.some((b) => b.enabled === false) &&
      count(c, "elect") === 0
    ) {
      did(c, "elect");
      const me = c.memory.self.name;
      const self = candidates.find((b) => b.label === me);
      const others = candidates
        .map((b) => ({ b, bp: c.memory.rivals.find((r) => r.name === b.label)?.bp ?? 0 }))
        .sort((a, b2) => a.bp - b2.bp);
      const pick = self ?? others[0]?.b;
      for (const bl of x.ballots) if (bl.kind === "election") bl.voted = true;
      if (pick) return press(pick.id);
    }
    return press("city-hall:main");
  }
  const permits = v.buttons.filter((b) => b.id.startsWith("city-hall:permit:"));
  if (permits.length > 0) {
    const want = permitWanted(c);
    const b = want ? enabled(v, `city-hall:permit:${want}`) : undefined;
    did(c, "permits");
    if (b && count(c, "permit") === 0) {
      did(c, "permit");
      if (want) x.permits.push(want);
      return press(b.id);
    }
    return press("city-hall:main");
  }
  if (v.buttons.some((b) => b.id === "city-hall:certify")) {
    did(c, "inspectionSeen");
    const evil = karma(c) <= EXPANDED.town.cityHall.inspection.bribe.karmaAtMost;
    const how = evil && enabled(v, "city-hall:bribe") ? "city-hall:bribe" : "city-hall:certify";
    if (enabled(v, how) && count(c, "certify") === 0) {
      did(c, "certify");
      return press(how);
    }
    did(c, "certify");
    return press("city-hall:main");
  }
  if (
    hasButton(v, "city-hall:found") ||
    hasButton(v, "city-hall:invite") ||
    v.buttons.some((b) => b.id === "city-hall:leavechain" || b.id === "city-hall:found")
  ) {
    did(c, "chainsSeen");
    if (
      style.chain === "found" &&
      enabled(v, "city-hall:found") &&
      count(c, "found") === 0 &&
      cash(c) > 13000
    ) {
      did(c, "found");
      return press("city-hall:found");
    }
    if (style.chain !== "none") {
      const join = v.buttons.find((b) => b.id.startsWith("city-hall:join:") && b.enabled !== false);
      if (join && count(c, "join") === 0 && cash(c) - dollars(join.detail) > 2000) {
        did(c, "join");
        x.inChain = true;
        return press(join.id);
      }
    }
    if (style.chain === "found" && enabled(v, "city-hall:invite") && count(c, "invite") < 2) {
      did(c, "invite");
      return press("city-hall:invite");
    }
    return press("city-hall:main");
  }
  // The main hall.
  const ballot = x.ballots;
  if (
    hasButton(v, "city-hall:ordinance") &&
    count(c, "ordinanceSeen") === 0 &&
    count(c, "vote") === 0 &&
    (ballot.some((b) => b.kind === "ordinance" && !b.voted) || style.lobby)
  ) {
    did(c, "ordinanceSeen");
    return press("city-hall:ordinance");
  }
  if (
    hasButton(v, "city-hall:election") &&
    count(c, "electionSeen") === 0 &&
    ((style.mayor > 0 && x.day <= 10) || ballot.some((b) => b.kind === "election" && !b.voted))
  ) {
    did(c, "electionSeen");
    return press("city-hall:election");
  }
  if (permitWanted(c) && count(c, "permits") === 0 && hasButton(v, "city-hall:permits")) {
    did(c, "permits");
    return press("city-hall:permits");
  }
  if (
    style.certify &&
    x.owned.length > 0 &&
    count(c, "inspectionSeen") === 0 &&
    hasButton(v, "city-hall:inspection") &&
    cash(c) > style.reserve + 1000
  ) {
    did(c, "inspectionSeen");
    return press("city-hall:inspection");
  }
  if (style.chain !== "none" && count(c, "chainsSeen") === 0 && hasButton(v, "city-hall:chains")) {
    did(c, "chainsSeen");
    return press("city-hall:chains");
  }
  const appeal = appealHere(c, "city-hall");
  if (appeal) return appeal;
  void s;
  return done(c);
}

/** Gives to the running story's appeal at this place when the style backs that side. */
function appealHere(c: Ctx, placeId: string): Action | null {
  const style = styleOf(c);
  if (style.appeals <= 0 || count(c, "appeal") >= 1) return null;
  const sideOk =
    placeId === "church"
      ? style.path !== "evil"
      : placeId === "reaper-club"
        ? style.path === "evil"
        : style.path !== "evil";
  if (!sideOk) return null;
  const b = c.view.buttons.find(
    (x) => x.id.startsWith(`arc:give:${placeId}:`) && x.enabled !== false,
  );
  if (!b || cash(c) - dollars(b.detail) < style.reserve) return null;
  did(c, "appeal");
  return press(b.id);
}

// ---------------------------------------------------------------------------
// The church

function church(c: Ctx): Action {
  const v = c.view;
  const style = styleOf(c);
  const k = karma(c);
  const bingoCards = v.buttons.filter((b) => b.id.startsWith("church:card:"));
  if (bingoCards.length > 0) {
    // The bingo panel (section 11.5) says whether the next card is the free one and how many
    // the player may still hold.
    const panel = v.bingo;
    const want = style.bingo - count(c, "card");
    const free = enabled(v, "church:card:1");
    const room = panel ? panel.mine.length < panel.maxPerPlayer && panel.open : true;
    if (want > 0 && free && room) {
      did(c, "card");
      return press("church:card:1");
    }
    const nextFree = panel ? panel.nextFree : /free/i.test(free?.detail ?? "");
    if (free && room && nextFree && count(c, "freeCard") === 0) {
      did(c, "freeCard");
      return press("church:card:1");
    }
    did(c, "bingo");
    return press("church:main");
  }
  if (!hasButton(v, "church:main") && !v.buttons.some((b) => b.id === "church:bingo"))
    return leave(c);
  if (enabled(v, "church:serve") && turns(c) > 0 && count(c, "serve") === 0) {
    did(c, "serve");
    return press("church:serve");
  }
  const water = enabled(v, "church:water");
  if (
    water &&
    style.holyWater > count(c, "water") &&
    k < EXPANDED.karma.good[1] &&
    cash(c) - dollars(water.detail) > 1500 &&
    count(c, "water") < 1
  ) {
    did(c, "water");
    return press("church:water");
  }
  if (turns(c) > 0) return done(c);
  const confess = enabled(v, "church:confess");
  if (
    confess &&
    style.path === "good" &&
    count(c, "confess") < 2 &&
    cash(c) - dollars(confess.detail) > style.reserve
  ) {
    did(c, "confess");
    return press("church:confess");
  }
  const bingo = enabled(v, "church:bingo");
  if (bingo && count(c, "bingo") === 0 && (style.bingo > 0 || k >= EXPANDED.karma.good[1])) {
    did(c, "bingo");
    return press("church:bingo");
  }
  const tithe = enabled(v, "church:tithe");
  const tithes = lastDays(c)
    ? EXPANDED.town.church.tithe.perDay / EXPANDED.town.church.tithe.step
    : style.tithe;
  const keep = lastDays(c) ? 1500 : style.reserve * 2 + 1000;
  if (tithe && count(c, "tithe") < tithes && cash(c) > keep) {
    did(c, "tithe");
    return press("church:tithe");
  }
  const appeal = appealHere(c, "church");
  if (appeal) return appeal;
  return done(c);
}

// ---------------------------------------------------------------------------
// The graveyard

function graveyard(c: Ctx): Action {
  const v = c.view;
  const x = xm(c);
  const style = styleOf(c);
  const s = c.memory.session;
  // A duel in progress.
  if (v.battle && hasButton(v, "graveyard:swing")) return duelMove(c);
  if (hasButton(v, "go:graveyard") && !hasButton(v, "graveyard:monuments"))
    return press("go:graveyard");
  if (hasButton(v, "graveyard:monument") || v.buttons.some((b) => b.id === "graveyard:monument")) {
    const b = enabled(v, "graveyard:monument");
    did(c, "monumentsSeen");
    if (
      b &&
      cash(c) - dollars(b.detail) >= style.reserve &&
      x.monuments < monumentGoal(c) &&
      count(c, "monument") < 2
    ) {
      did(c, "monument");
      x.monuments++;
      return press("graveyard:monument");
    }
    return press("graveyard:main");
  }
  if (!hasButton(v, "graveyard:monuments")) return leave(c);
  if (turns(c) > 0) {
    if (
      style.graves &&
      enabled(v, "graveyard:tend") &&
      count(c, "tend") < (style.path === "good" ? 2 : 1) &&
      turns(c) > 1
    ) {
      did(c, "tend");
      return press("graveyard:tend");
    }
    if (style.graves && enabled(v, "graveyard:rob") && count(c, "rob") < 1 && turns(c) > 1) {
      did(c, "rob");
      return press("graveyard:rob");
    }
    if (
      style.duel &&
      enabled(v, "graveyard:duel") &&
      count(c, "duel") === 0 &&
      turns(c) > 1 &&
      (v.hud?.injuries ?? 0) < 2
    ) {
      const target = pickFor(
        c,
        "graveyard:pick",
        c.memory.rivals
          .filter((r) => r.status !== "Protected")
          .map((r) => ({ id: r.id, name: r.name })),
      );
      did(c, "duel");
      if (target !== null) {
        s.scratch.pick = target;
        s.scratch.duelWith = target;
        return press("graveyard:duel");
      }
    }
    return done(c);
  }
  if (
    x.monuments < monumentGoal(c) &&
    count(c, "monumentsSeen") === 0 &&
    (x.day >= style.monuments.from || cash(c) > 60000 || endgame(c))
  ) {
    did(c, "monumentsSeen");
    return press("graveyard:monuments");
  }
  return done(c);
}

/**
 * One exchange of a duel. The rules are public and the screen shows both hit-point
 * bars, so the move is the best of Swing, Shove and Yield by expected value
 * (`duel.ts`, section 16.4: a shove that lands costs the rival their next move).
 */
function duelMove(c: Ctx): Action {
  const v = c.view;
  const b = v.battle;
  const me = c.memory.known.strength;
  const shove = v.buttons.find((x) => x.id === "graveyard:shove");
  // The shove chance on the button gives away the rival's strength: 25 + 5 x (mine - his),
  // clamped to 10..60. A clamped chance is only a bound.
  const chance = Number(/(\d+)/.exec(shove?.detail ?? "")?.[1] ?? Number.NaN);
  const rival = c.memory.session.scratch.duelWith;
  const known = typeof rival === "number" ? xm(c).strength[String(rival)] : undefined;
  let his = known ?? 3;
  if (Number.isFinite(chance)) {
    const rules = EXPANDED.town.graveyard.duel.shove;
    const exact = me - (chance - rules.base) / rules.perStrength;
    if (chance > rules.min && chance < rules.max) his = exact;
    else if (chance >= rules.max) his = Math.min(known ?? exact, exact);
    else his = Math.max(known ?? exact, exact);
    if (typeof rival === "number") xm(c).strength[String(rival)] = his;
  }
  if (!b) return press("graveyard:swing");
  const pick = duelTable(me, his).choose(
    Math.max(1, Math.round(b.me.hp)),
    Math.max(1, Math.round(b.them.hp)),
    enabled(v, "graveyard:yield") !== undefined,
  );
  if (pick.move === "shove" && enabled(v, "graveyard:shove")) return press("graveyard:shove");
  if (pick.move === "yield" && enabled(v, "graveyard:yield")) return press("graveyard:yield");
  return press("graveyard:swing");
}

// ---------------------------------------------------------------------------
// The Reaper Club

function club(c: Ctx): Action {
  const v = c.view;
  const x = xm(c);
  const style = styleOf(c);
  const s = c.memory.session;
  if (hasButton(v, "reaper-club:pay")) {
    if (count(c, "pay") === 0) {
      did(c, "pay");
      return press("reaper-club:pay");
    }
    return done(c);
  }
  if (v.buttons.some((b) => b.id === "reaper-club:pay")) return done(c);
  const games = v.buttons.filter((b) => /^reaper-club:(draw|slots|shots):/.test(b.id));
  if (games.length > 0) {
    const g = style.gamble;
    if (g) {
      // Any stake the house takes, at random, within the day's budget (the edge must not depend on it).
      // The club panel (section 11.5) gives today's stakes and the daily limit.
      const panel = v.club;
      const staked = panel ? panel.staked : Number(s.scratch.staked ?? 0);
      const limit = Math.min(g.budget, panel?.stakeMax ?? Number.POSITIVE_INFINITY);
      const stakes = (panel?.stakes ?? EXPANDED.town.club.stakes).filter(
        (k) => staked + k <= limit && cash(c) - k >= style.reserve,
      );
      const stake = c.rng.pick(stakes);
      const b = stake === undefined ? undefined : enabled(v, `reaper-club:${g.game}:${stake}`);
      if (b && stake !== undefined && count(c, "play") < 40) {
        did(c, "play");
        s.scratch.staked = staked + stake;
        return press(b.id);
      }
    }
    did(c, "games");
    return press("reaper-club:main");
  }
  const market = v.buttons.filter((b) => b.id.startsWith("reaper-club:buy:"));
  if (
    market.length > 0 ||
    (/reaper-club:market/.test(c.memory.session.lastAction) && hasButton(v, "reaper-club:main"))
  ) {
    did(c, "market");
    // A protecting style warned of a hit buys Tiny or the vest when the bodyguard was not to be had.
    const guards = style.protect && s.scratch.threatened && count(c, "guard") === 0;
    for (const id of guards ? ["tiny", "vest"] : []) {
      const b = enabled(v, `reaper-club:buy:${id}`);
      if (b && cash(c) >= dollars(b.detail)) {
        did(c, "guard");
        did(c, `buy:${id}`);
        return press(b.id);
      }
    }
    for (const id of style.market) {
      const b = enabled(v, `reaper-club:buy:${id}`);
      if (b && cash(c) - dollars(b.detail) >= style.reserve && count(c, `buy:${id}`) === 0) {
        did(c, `buy:${id}`);
        return press(b.id);
      }
    }
    return press("reaper-club:main");
  }
  if (!hasButton(v, "reaper-club:games") && !v.buttons.some((b) => b.id === "reaper-club:games"))
    return leave(c);
  // Inside. A warned parlor hires its bodyguard first (section 20.4).
  if (s.scratch.threatened && count(c, "guard") === 0) {
    const guard = enabled(v, "reaper-club:bodyguard");
    if (guard && cash(c) >= dollars(guard.detail)) {
      did(c, "guard");
      return press("reaper-club:bodyguard");
    }
    if (styleOf(c).protect && count(c, "market") === 0 && hasButton(v, "reaper-club:market"))
      return press("reaper-club:market");
  }
  if (enabled(v, "reaper-club:seance") && turns(c) > 1 && count(c, "seance") === 0) {
    did(c, "seance");
    return press("reaper-club:seance");
  }
  if (turns(c) > 0) return done(c);
  if (style.market.length > 0 && count(c, "market") === 0 && hasButton(v, "reaper-club:market"))
    return press("reaper-club:market");
  if (style.gamble && count(c, "games") === 0 && hasButton(v, "reaper-club:games"))
    return press("reaper-club:games");
  const hitting = hitCase(c);
  if (hitting && enabled(v, "reaper-club:hit") && count(c, "hit") === 0) {
    // The picker that follows is answered from the scratch (the case is no longer open after
    // today's hit is booked).
    s.scratch.pick = hitting.id;
    did(c, "hit");
    x.lastHit = x.day;
    return press("reaper-club:hit");
  }
  const appeal = appealHere(c, "reaper-club");
  if (appeal) return appeal;
  return done(c);
}
