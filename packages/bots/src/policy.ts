import type { Action, View } from "@fq/protocol";
import { decideExpanded, isExpandedView } from "./expanded/day.js";
import type { Guide } from "./expanded/guide.js";
import type { XCustomer } from "./expanded/sell.js";
import { linesFor } from "./lines.js";
import type { BotMemory, CustomerNotes, ErrandKind } from "./memory.js";
import { chooseMove, isNegotiation, meetCustomer, observe, pitch } from "./negotiation.js";
import {
  type Personality,
  personality as personalityById,
  type ShopItem,
  type ShopWant,
  SKILLS,
  type Skill,
} from "./personalities.js";
import type { BotRandom } from "./random.js";
import {
  buttonByLabel,
  describeAction,
  enabledButtons,
  goldWorth,
  hasButton,
  plain,
  press,
  safeAction,
  screenText,
  signature,
} from "./read.js";

/**
 * What a policy is given: the screen, its own memory and its dice. Nothing
 * else exists for it; it cannot see the town, the customer's record or any
 * other player's state, so it plays exactly the game a person plays.
 */
export interface PolicyInput {
  readonly view: View;
  readonly memory: BotMemory;
  readonly rng: BotRandom;
}

/** A bot: one reply to one screen. It may update its own memory. */
export type Policy = (input: PolicyInput) => Action;

/** Overrides for a policy. The personality defaults to the one named in the memory. */
export interface PolicyOptions {
  personality?: Personality;
  skill?: Skill;
  /**
   * Replaces the customer notes just before each sales decision. The fair
   * policy never sets it; the simulator's oracle uses it (see `oracle.ts`).
   */
  peekCustomer?: (notes: CustomerNotes) => void;
  /** The same for an Expanded customer's beliefs (simulator oracle only). */
  peekX?: (notes: XCustomer) => void;
  /**
   * The public rule book of the town's content pack (expanded/guide.ts), for
   * Expanded towns. Without one an Expanded bot sells without knowing what
   * traits and extras do.
   */
  guide?: Guide | null;
}

/** Steps an errand may take before the bot gives up on it. */
const ERRAND_BUDGET = 45;
/** How many identical screens in a row before the bot tries to escape. */
const REPEAT_LIMIT = 4;

const PLACE_OF: Partial<Record<ErrandKind, string>> = {
  bank: "bank",
  store: "store",
  university: "spirit-university",
  yangs: "yangs",
  visit: "competitors",
  cafe: "cafe",
};

/** Screen titles of the places (the session location). */
const TITLE_OF: Record<string, string> = {
  bank: "Bank",
  store: "Store",
  "spirit-university": "Spirit U",
  yangs: "Yang's",
  competitors: "Parlors",
  cafe: "Pale Horse Cafe",
};

const HEARSE_NAMES = ["Bicycle", "Budget Hearse", "Medalist", "Statesman", "Crown Sovereign"];
const HEARSE_PRICES = [4, 12, 30, 50, 80];
const STORE_ITEMS: ShopItem[] = ["hearse", "padlock", "smoke", "safe", "lockpicks"];
const SECURITY_SLOT: Partial<Record<ShopItem, number>> = { padlock: 1, smoke: 2, safe: 3 };

export interface Ctx {
  view: View;
  memory: BotMemory;
  rng: BotRandom;
  me: Personality;
  skill: Skill;
  options: PolicyOptions;
}

export function createPolicy(options: PolicyOptions = {}): Policy {
  return (input) => {
    const me = options.personality ?? personalityById(input.memory.personality);
    const skill = options.skill ?? SKILLS[input.memory.difficulty];
    const ctx: Ctx = { ...input, me, skill, options };
    const action = decide(ctx);
    input.memory.session.lastAction = describeAction(action);
    return action;
  };
}

function decide(c: Ctx): Action {
  // Expanded towns (a HUD with money) have their own day; Classic play below is unchanged.
  if (c.memory.x || isExpandedView(c.view)) return decideExpanded(c, c.options.guide ?? null);
  const { view, memory } = c;
  const s = memory.session;
  s.steps++;
  const sig = signature(view);
  s.repeats = sig === s.lastSig ? s.repeats + 1 : 0;
  s.lastSig = sig;
  if (s.current) s.errandSteps++;
  if (s.current && s.errandSteps > ERRAND_BUDGET) finishErrand(c);
  learnFromScreen(c);
  if (!isNegotiation(view)) memory.customer = null;

  if (view.scene === "lobby") return { type: "exit" };
  if (s.repeats >= REPEAT_LIMIT) {
    s.current = null;
    if (s.repeats >= REPEAT_LIMIT * 2) return { type: "exit" };
    return safeAction(view);
  }
  if (s.steps === 1) planSession(c);
  if (view.overlay) return overlay(c);
  if (isNegotiation(view)) return negotiate(c);
  if (hasButton(view, "risk:take")) return risk(c);
  if (buttonByLabel(view, /^Hire Twins$/)) return twins(c);
  if (view.scene === "news") return news(c);
  if (view.scene === "stats") return stats(c);
  if (view.scene === "rankings") return rankings(c);
  if (view.map) return map(c);
  if (hasButton(view, "desk:wait")) return desk(c);
  if (view.scene === "desk" && hasButton(view, "go:desk")) return press("go:desk");
  return place(c);
}

// ---------------------------------------------------------------------------
// Memory from screens

export function learnFromScreen(c: Ctx): void {
  const { view, memory } = c;
  const k = memory.known;
  if (view.stats) {
    for (const line of view.stats) {
      const n = Number.parseInt(line.value.replace(/[^\d-]/g, ""), 10);
      switch (line.id) {
        case "psych":
          if (Number.isFinite(n)) k.psych = Math.max(0, n - 1);
          break;
        case "strength":
          if (Number.isFinite(n)) k.strength = n;
          break;
        case "hpMax":
          if (Number.isFinite(n)) k.hpMax = n;
          break;
        case "lockpicks":
          if (Number.isFinite(n)) k.lockpicks = n;
          break;
        case "plots":
          if (Number.isFinite(n)) k.plots = n;
          break;
        case "visits":
          if (Number.isFinite(n)) k.visitsLeft = n;
          break;
        case "yangs":
          if (Number.isFinite(n)) k.yangsLeft = n;
          break;
        case "ride":
          k.ride = line.value;
          break;
      }
    }
  }
  if (view.rankings) {
    memory.rivals = view.rankings
      .filter((r) => r.playerId !== memory.self.playerId)
      .map((r) => ({ id: r.playerId, name: r.name, bp: r.bp, online: r.online, status: r.status }));
  }
  const text = screenText(view);
  const raised = /psychology level is raised to (\d+)/.exec(text);
  if (raised?.[1]) k.psych = Number(raised[1]) - 1;
  const picks = /currently have (\d+) lockpick|holding (\d+) lockpick/.exec(text);
  const pickCount = picks?.[1] ?? picks?.[2];
  if (pickCount) k.lockpicks = Number(pickCount);
  const watch = /time to visit (\d+) more/.exec(text);
  if (watch?.[1]) k.visitsLeft = Number(watch[1]);
  if (/Is today look at everyone's parlor day/.test(text)) k.visitsLeft = 0;
  const bought = /You purchase the ([A-Za-z ]+?) for/.exec(text);
  if (bought?.[1]) ownItem(c, bought[1]);
  const already = /already (?:own|have) (?:a |an |the )?([A-Za-z ]+)/i.exec(text);
  if (already?.[1]) ownItem(c, already[1]);
  const traded = /brand new ([A-Za-z ]+?)!/.exec(text);
  if (traded?.[1] && HEARSE_NAMES.includes(traded[1])) k.ride = traded[1];
  noteGrudges(c, text);
}

function ownItem(c: Ctx, name: string): void {
  const o = c.memory.known.owns;
  if (/padlock/i.test(name)) o.padlock = true;
  if (/smoke/i.test(name)) o.smoke = true;
  if (/safe/i.test(name)) o.safe = true;
}

const GRUDGE_WORDS =
  /sneaking|stole|steal|attack|assault|beat|hospital|fire|burn|arson|prowl|curse|tiger|padlock/i;

function noteGrudges(c: Ctx, text: string): void {
  const { memory } = c;
  if (!GRUDGE_WORDS.test(text)) return;
  for (const rival of memory.rivals) {
    if (text.includes(rival.name) && !memory.grudges.includes(rival.name)) {
      memory.grudges.push(rival.name);
      if (memory.grudges.length > 6) memory.grudges.shift();
    }
  }
}

// ---------------------------------------------------------------------------
// Planning

function planSession(c: Ctx): void {
  const { memory, rng, me, view } = c;
  const s = memory.session;
  memory.days++;
  s.morning = ["stats"];
  if (rng.chance(me.social.announce)) s.morning.unshift("announce");
  if (wantsToShop(c, view)) s.morning.push("bank", ...shopPlaces(c));
  const evening: ErrandKind[] = ["bank", ...shopPlaces(c), "yangs"];
  if (me.visits > 0) evening.push("visit");
  if (rng.chance(me.social.cafe)) evening.push("cafe");
  if (memory.grudges.length > 0 && rng.chance(me.social.letter)) evening.push("letter");
  s.evening = evening;
}

function shopPlaces(c: Ctx): ErrandKind[] {
  const out: ErrandKind[] = [];
  for (const want of c.me.shopping) {
    const errand: ErrandKind = STORE_ITEMS.includes(want.item) ? "store" : "university";
    if (!out.includes(errand)) out.push(errand);
  }
  return out;
}

function wantsToShop(c: Ctx, view: View): boolean {
  const gold = goldWorth(view) - c.me.goldReserve;
  return c.me.shopping.some((w) => !satisfied(c, w) && estimateCost(c, w.item) <= gold);
}

export function startErrand(c: Ctx, errand: ErrandKind): void {
  const s = c.memory.session;
  s.current = errand;
  s.errandSteps = 0;
  s.scratch = {};
}

export function finishErrand(c: Ctx): void {
  const s = c.memory.session;
  s.current = null;
  s.errandSteps = 0;
  s.scratch = {};
}

/** The next errand that may run now (evening ones wait until the turns are spent). */
function nextErrand(c: Ctx): ErrandKind | null {
  const s = c.memory.session;
  if (s.morning.length > 0) return s.morning.shift() ?? null;
  const turns = c.view.hud?.turns ?? 0;
  if (turns > 0) return null;
  while (s.evening.length > 0) {
    const errand = s.evening.shift() as ErrandKind;
    if (errandWorthIt(c, errand)) return errand;
  }
  return null;
}

function errandWorthIt(c: Ctx, errand: ErrandKind): boolean {
  const { view, memory, me } = c;
  const hud = view.hud;
  switch (errand) {
    case "bank":
      return !!hud && hud.tags.wood + hud.tags.silver * 2 >= 4;
    case "store":
    case "university":
      return wantsToShop(c, view);
    case "yangs":
      if (!hud) return false;
      return (
        (hud.luck < 40 && hud.bpToday >= 5) ||
        ((me.tiger || me.sparrow) && hud.bpToday >= 20 && memory.known.yangsLeft > 0)
      );
    case "visit":
      return memory.known.visitsLeft > 0;
    default:
      return true;
  }
}

// ---------------------------------------------------------------------------
// The desk and the map

function desk(c: Ctx): Action {
  const s = c.memory.session;
  if (!s.current) {
    const next = nextErrand(c);
    if (next) startErrand(c, next);
  }
  switch (s.current) {
    case "stats":
      return press("go:stats");
    case "letter": {
      const tries = Number(s.scratch.tries ?? 0);
      const target = c.memory.grudges.find((g) => !s.tried.includes(g));
      if (s.scratch.sent || tries >= 2 || !target) {
        finishErrand(c);
        return desk(c);
      }
      s.scratch.tries = tries + 1;
      s.scratch.target = target;
      return press("go:mailbox");
    }
    case "announce":
      return press("go:news");
    case null:
      break;
    default:
      return press("go:map");
  }
  if ((c.view.hud?.turns ?? 0) > 0) return press("desk:wait");
  s.leaving = true;
  return hasButton(c.view, "desk:quit") ? press("desk:quit") : { type: "exit" };
}

function map(c: Ctx): Action {
  const s = c.memory.session;
  if (!s.current) {
    const next = nextErrand(c);
    if (next) startErrand(c, next);
  }
  const target = s.current ? PLACE_OF[s.current] : undefined;
  const places = c.view.map ?? [];
  if (target && places.some((p) => p.id === target)) return { type: "visit", placeId: target };
  const home = places.find((p) => p.id === "funeral-home") ?? places[0];
  return home ? { type: "visit", placeId: home.id } : safeAction(c.view);
}

export function leavePlace(c: Ctx): Action {
  if (hasButton(c.view, "go:map")) return press("go:map");
  return safeAction(c.view);
}

/** Which place this screen belongs to, by its title. */
function placeOf(view: View): string | null {
  for (const [id, title] of Object.entries(TITLE_OF)) if (view.title === title) return id;
  return null;
}

function place(c: Ctx): Action {
  const s = c.memory.session;
  const here = placeOf(c.view);
  const wanted = s.current ? PLACE_OF[s.current] : undefined;
  if (here && wanted === here) {
    switch (s.current) {
      case "bank":
        return bank(c);
      case "store":
        return store(c);
      case "university":
        return university(c);
      case "yangs":
        return yangs(c);
      case "visit":
        return visit(c);
      case "cafe":
        return cafe(c);
    }
  }
  // Visit screens without the row's title (the battle, the hospital room) still belong to the visit.
  if (s.current === "visit" && (c.view.battle || hasButton(c.view, "battle:attack")))
    return battle(c);
  if (hasButton(c.view, "hospital:leave-room")) return press("hospital:leave-room");
  return leavePlace(c);
}

// ---------------------------------------------------------------------------
// Overlays

function fit(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, Math.max(0, max));
}

export function overlay(c: Ctx): Action {
  const { view, memory, rng, me } = c;
  const o = view.overlay;
  if (!o) return safeAction(view);
  const lines = linesFor(me.id);
  const s = memory.session;
  switch (o.kind) {
    case "message":
      if (/noname$/.test(o.id) && typeof s.scratch.target === "string") {
        s.tried.push(s.scratch.target);
        delete s.scratch.target;
      }
      return { type: "dismiss", overlayId: o.id };
    case "confirm": {
      if (/namenext$/.test(o.id)) {
        const offered = /Do you mean (.+)\?/.exec(plain(o.text))?.[1] ?? "";
        const target = String(s.scratch.target ?? "");
        return { type: "confirm", overlayId: o.id, accepted: offered === target };
      }
      return { type: "confirm", overlayId: o.id, accepted: false };
    }
    case "textInput": {
      let text: string | null = null;
      if (o.id === "competitors:getname" || o.id === "mailbox:getname") {
        text = typeof s.scratch.target === "string" ? s.scratch.target : null;
      } else if (o.id === "mailbox:compose") {
        text = rng.pick(lines.letter) ?? null;
        if (s.current === "letter") s.scratch.sent = true;
      } else if (o.id === "news:announcement") {
        text = s.scratch.announced ? null : (rng.pick(lines.announce) ?? null);
        s.scratch.announced = true;
        if (s.current === "announce") finishErrand(c);
      } else if (o.id.endsWith("-fortune")) {
        text = rng.chance(0.5) ? (rng.pick(lines.fortune) ?? "") : "";
      } else if (/quote|yell/.test(o.id) || /battle/.test(o.id)) {
        text = rng.pick(lines.quote) ?? null;
      }
      return {
        type: "submitText",
        overlayId: o.id,
        text: text === null ? null : fit(text, o.maxLength),
      };
    }
    case "playerPicker": {
      const choices = o.players.filter((p) => p.id !== memory.self.playerId);
      let choice: number | null = null;
      if (o.id === "yangs:sparrow-target") choice = poorest(c, choices);
      else if (o.id === "yangs:tiger-target" || o.id === "script:getname")
        choice = enemy(c, choices);
      return { type: "pickPlayer", overlayId: o.id, playerId: choice };
    }
  }
}

/** The rival to hurt: a grudge first, then whoever leads. */
export function enemy(c: Ctx, choices: { id: number; name: string }[]): number | null {
  const { memory } = c;
  for (const name of memory.grudges) {
    const hit = choices.find((p) => p.name === name);
    if (hit) return hit.id;
  }
  let best: { id: number; bp: number } | null = null;
  for (const p of choices) {
    const bp = memory.rivals.find((r) => r.id === p.id)?.bp ?? 0;
    if (!best || bp > best.bp) best = { id: p.id, bp };
  }
  return best?.id ?? null;
}

export function poorest(c: Ctx, choices: { id: number; name: string }[]): number | null {
  let best: { id: number; bp: number } | null = null;
  for (const p of choices) {
    const bp = c.memory.rivals.find((r) => r.id === p.id)?.bp ?? 0;
    if (!best || bp < best.bp) best = { id: p.id, bp };
  }
  return best?.id ?? null;
}

// ---------------------------------------------------------------------------
// Customers

function negotiate(c: Ctx): Action {
  const { view, memory, rng, me, skill } = c;
  if (!memory.customer || memory.session.lastAction === "press:desk:wait") {
    memory.customer = meetCustomer(view, me.sales, skill, rng);
  } else {
    observe(memory.customer, view, skill, memory);
  }
  const notes = memory.customer;
  c.options.peekCustomer?.(notes);
  const move = chooseMove(notes, view, me.sales, skill, rng, memory);
  return press(pitch(notes, move));
}

/** Expected BP of taking a risk against declining it (4 to 10, so 7). */
export function risk(c: Ctx): Action {
  const { view, me } = c;
  const luck = view.hud?.luck ?? 50;
  const today = view.hud?.bpToday ?? 0;
  let take = luck >= me.riskLuck;
  if (!take && me.riskLuck <= 100 && c.memory.difficulty === "hard") {
    // get_random_yes_no(luck, 0.9): luck is pulled 10% toward 50, then roll <= luck.
    const adjusted = luck + Math.trunc((50 - luck) * 0.1);
    const p = Math.min(1, (adjusted + 1) / 100);
    const ev = p * 50 - (1 - p) * Math.min(50, today);
    take = ev > 7;
  }
  return press(take ? "risk:take" : "risk:decline");
}

export function twins(c: Ctx): Action {
  const { view, me, memory } = c;
  const gold = view.hud?.tags.gold ?? 0;
  const hire = buttonByLabel(view, /^Hire Twins$/);
  const enemies = memory.rivals.filter((r) => !r.online);
  if (me.arson && hire && gold >= 6 && enemies.length > 0) return press(hire.id);
  const no = buttonByLabel(view, /^No Thanks$/);
  return no ? press(no.id) : safeAction(view);
}

// ---------------------------------------------------------------------------
// News, stats, rankings

export function news(c: Ctx): Action {
  const s = c.memory.session;
  if (s.current === "announce" || (s.morning[0] === "announce" && !s.current)) {
    if (s.morning[0] === "announce") startErrand(c, s.morning.shift() as ErrandKind);
    if (!s.scratch.announced && hasButton(c.view, "news:announce")) return press("news:announce");
    finishErrand(c);
  }
  return hasButton(c.view, "go:desk") ? press("go:desk") : safeAction(c.view);
}

export function stats(c: Ctx): Action {
  if (c.memory.session.current === "stats") finishErrand(c);
  return hasButton(c.view, "go:desk") ? press("go:desk") : safeAction(c.view);
}

export function rankings(c: Ctx): Action {
  if (c.memory.session.current === "visit" && hasButton(c.view, "go:competitors")) {
    return press("go:competitors");
  }
  return safeAction(c.view);
}

// ---------------------------------------------------------------------------
// Shopping

function satisfied(c: Ctx, want: ShopWant): boolean {
  const k = c.memory.known;
  const level = (() => {
    switch (want.item) {
      case "hearse":
        return Math.max(0, HEARSE_NAMES.indexOf(k.ride));
      case "psych":
        return k.psych + 1;
      case "strength":
        return k.strength;
      case "hp":
        return k.hpMax;
      case "lockpicks":
        return k.lockpicks;
      default:
        return 0;
    }
  })();
  switch (want.item) {
    case "padlock":
      return k.owns.padlock;
    case "smoke":
      return k.owns.smoke;
    case "safe":
      return k.owns.safe;
    case "hearse":
      return level >= Math.min(want.upTo ?? 4, 4);
    case "lockpicks":
      return level >= (want.upTo ?? 3);
    default:
      return want.upTo !== undefined && level >= want.upTo;
  }
}

/** Prices as the store and the class schedule print them. */
function estimateCost(c: Ctx, item: ShopItem): number {
  const k = c.memory.known;
  switch (item) {
    case "hearse": {
      const current = Math.max(0, HEARSE_NAMES.indexOf(k.ride));
      const next = HEARSE_PRICES[current + 1];
      return next === undefined
        ? Number.POSITIVE_INFINITY
        : next - Math.floor((HEARSE_PRICES[current] ?? 0) / 2);
    }
    case "psych":
      return 4 + 2 * k.psych;
    case "strength":
      return 3 * k.strength;
    case "hp":
      return Math.trunc(k.hpMax * 1.2);
    case "padlock":
      return 6;
    case "smoke":
      return 8;
    case "safe":
      return 6;
    case "lockpicks":
      return 1;
  }
}

/** The first want this place sells that the bot can pay for, respecting `saveFor`. */
function wantHere(c: Ctx, here: "store" | "university"): ShopWant | null {
  const gold = (c.view.hud?.tags.gold ?? 0) - c.me.goldReserve;
  for (const want of c.me.shopping) {
    if (satisfied(c, want)) continue;
    if (c.memory.session.scratch[`no:${want.item}`]) continue;
    const at = STORE_ITEMS.includes(want.item) ? "store" : "university";
    const affordable = estimateCost(c, want.item) <= gold;
    if (!affordable) {
      if (want.saveFor) return null;
      continue;
    }
    if (at === here) return want;
  }
  return null;
}

function bank(c: Ctx): Action {
  const { view } = c;
  const s = c.memory.session;
  if (hasButton(view, "bank:all-gold") && !s.scratch.converted) {
    const t = view.hud?.tags;
    s.scratch.converted = true;
    if (t && t.wood + t.silver * 2 >= 4) return press("bank:all-gold");
  }
  if (s.scratch.converted) finishErrand(c);
  return leavePlace(c);
}

function store(c: Ctx): Action {
  const { view, memory } = c;
  const s = memory.session;
  const text = plain(view.text);
  const want = wantHere(c, "store");
  if (
    /cannot afford|don't have enough|not enough/i.test(text) &&
    typeof s.scratch.item === "string"
  ) {
    s.scratch[`no:${s.scratch.item}`] = true;
  }
  if (!want) {
    finishErrand(c);
    return leavePlace(c);
  }
  s.scratch.item = want.item;
  // Main counter.
  if (hasButton(view, "store:security")) {
    if (want.item === "hearse") return press("store:hearse");
    if (want.item === "lockpicks") return press("store:supplies");
    return press("store:security");
  }
  // Hearse list and detail.
  if (view.buttons.some((b) => b.id.startsWith("store:look:"))) {
    if (want.item !== "hearse") return press("go:store");
    const current = Math.max(0, HEARSE_NAMES.indexOf(memory.known.ride));
    const gold = view.hud?.tags.gold ?? 0;
    let best = -1;
    for (const m of text.matchAll(/(\d+) - ([A-Za-z ]+?) - Cost: (\d+) gold/g)) {
      const index = Number(m[1]);
      const cost = Number(m[3]) - Math.floor((HEARSE_PRICES[current] ?? 0) / 2);
      if (index > current && index <= (want.upTo ?? 4) && cost <= gold)
        best = Math.max(best, index);
    }
    if (best > 0 && hasButton(view, `store:look:${best}`)) return press(`store:look:${best}`);
    s.scratch["no:hearse"] = true;
    return press("go:store");
  }
  if (hasButton(view, "store:buy")) {
    if (want.item === "hearse" && !s.scratch.boughtHearse) {
      s.scratch.boughtHearse = true;
      return press("store:buy");
    }
    return press("store:hearse");
  }
  if (s.scratch.boughtHearse && hasButton(view, "store:hearse")) {
    s.scratch.boughtHearse = false;
    return press("store:hearse");
  }
  // Security and supplies (scene scripts: buttons are labelled, ids are script:N).
  if (/Heavy Padlock - Cost/.test(text)) {
    const slot = SECURITY_SLOT[want.item];
    const viewButton = slot ? buttonByLabel(view, new RegExp(`^View #${slot}$`)) : undefined;
    if (viewButton) return press(viewButton.id);
    return backOut(c);
  }
  if (/Lockpick - Cost/.test(text)) {
    const viewButton = buttonByLabel(view, /^View #1$/);
    if (want.item === "lockpicks" && viewButton) return press(viewButton.id);
    return backOut(c);
  }
  const buy = buttonByLabel(view, /^Buy (it|one)$/);
  if (buy) {
    const tries = Number(s.scratch.buys ?? 0);
    if (tries < 12) {
      s.scratch.buys = tries + 1;
      if (want.item === "lockpicks" && buy.label === "Buy one") return press(buy.id);
      if (want.item !== "lockpicks" && buy.label === "Buy it") {
        const name = { padlock: "Padlock", smoke: "Smoke Detector", safe: "Safe" }[
          want.item as "padlock" | "smoke" | "safe"
        ];
        if (name && text.includes(name)) return press(buy.id);
      }
    }
    return backOut(c);
  }
  return backOut(c);
}

/** Presses Back, Continue or Leave, in that order of preference. */
export function backOut(c: Ctx): Action {
  const b =
    buttonByLabel(c.view, /^Back$/) ??
    buttonByLabel(c.view, /^Continue$/) ??
    buttonByLabel(c.view, /^Leave$/);
  return b ? press(b.id) : safeAction(c.view);
}

function university(c: Ctx): Action {
  const { view, memory } = c;
  const s = memory.session;
  const text = plain(view.text);
  if (hasButton(view, "spirit-university:psych")) {
    // The class schedule prints today's prices, which give away the current levels.
    const psy = /PSY[^\n]*?cost: (\d+)/.exec(text)?.[1];
    const pe = /PE[^\n]*?cost: (\d+)/.exec(text)?.[1];
    const st = /ST[^\n]*?cost: (\d+)/.exec(text)?.[1];
    if (psy) memory.known.psych = Math.max(0, (Number(psy) - 4) / 2);
    if (st) memory.known.strength = Math.round(Number(st) / 3);
    if (pe) memory.known.hpMax = Math.max(memory.known.hpMax, Math.floor(Number(pe) / 1.2));
    const want = wantHere(c, "university");
    const tries = Number(s.scratch.buys ?? 0);
    if (!want || tries >= 12) {
      finishErrand(c);
      return leavePlace(c);
    }
    s.scratch.buys = tries + 1;
    s.scratch.item = want.item;
    if (want.item === "psych") return press("spirit-university:psych");
    if (want.item === "strength") return press("spirit-university:strength");
    return press("spirit-university:hp");
  }
  if (/enough gold|can't afford|cannot afford/i.test(text) && typeof s.scratch.item === "string") {
    s.scratch[`no:${s.scratch.item}`] = true;
  }
  if (typeof s.scratch.item === "string" && s.scratch.item !== "psych") {
    // Strength and PE results: the next schedule will show the new price.
    if (s.scratch.item === "strength") memory.known.strength++;
  }
  if (hasButton(view, "spirit-university:main")) return press("spirit-university:main");
  return leavePlace(c);
}

export function yangs(c: Ctx): Action {
  const { view, memory, me } = c;
  const s = memory.session;
  const hud = view.hud;
  if (hasButton(view, "yangs:dragon")) {
    if (hud && hud.luck < 40 && hud.bpToday >= 5 && !s.scratch.dragon) {
      s.scratch.dragon = true;
      return press("yangs:dragon");
    }
    if (hud && hud.bpToday >= 20 && memory.known.yangsLeft > 0 && !s.scratch.delivery) {
      s.scratch.delivery = true;
      if (me.tiger) {
        memory.known.yangsLeft--;
        return press("yangs:tiger");
      }
      if (me.sparrow) {
        memory.known.yangsLeft--;
        return press("yangs:sparrow");
      }
    }
    finishErrand(c);
    return leavePlace(c);
  }
  if (hasButton(view, "yangs:menu")) return press("yangs:menu");
  return leavePlace(c);
}

export function cafe(c: Ctx): Action {
  const { view, memory, rng, me } = c;
  const s = memory.session;
  if (view.scene === "cafe" && !s.scratch.said) {
    s.scratch.said = true;
    const line = rng.pick(linesFor(me.id).cafe);
    if (line) return { type: "chat", text: line };
  }
  finishErrand(c);
  return leavePlace(c);
}

// ---------------------------------------------------------------------------
// Visits and battle

function pickTarget(c: Ctx): string | null {
  const { memory, rng } = c;
  const tried = memory.session.tried;
  const open = memory.rivals.filter(
    (r) => !r.online && r.status !== "Protected" && !tried.includes(r.name),
  );
  if (open.length === 0) return null;
  const grudge = open.find((r) => memory.grudges.includes(r.name));
  if (grudge && rng.chance(0.7)) return grudge.name;
  const sorted = [...open].sort((a, b) => b.bp - a.bp);
  // Mostly the leader, sometimes whoever is softest.
  return (rng.chance(0.65) ? sorted[0] : rng.pick(sorted))?.name ?? null;
}

export function visit(c: Ctx): Action {
  const { view, memory, me } = c;
  const s = memory.session;
  const text = plain(view.text);
  if (hasButton(view, "competitors:visit")) {
    if (memory.known.visitsLeft <= 0 || s.tried.length >= me.visits || s.scratch.hurt) {
      finishErrand(c);
      return leavePlace(c);
    }
    if (!s.scratch.looked) {
      s.scratch.looked = true;
      return press("competitors:look");
    }
    const target = pickTarget(c);
    if (!target) {
      finishErrand(c);
      return leavePlace(c);
    }
    s.scratch.target = target;
    return press("competitors:visit");
  }
  if (hasButton(view, "competitors:menu")) {
    memory.known.visitsLeft = 0;
    return press("competitors:menu");
  }
  if (hasButton(view, "competitors:trydoor")) return press("competitors:trydoor");
  if (hasButton(view, "competitors:picklock")) {
    if (memory.known.lockpicks > 0 && !/You are holding 0 /.test(text))
      return press("competitors:picklock");
    markTried(c);
    return press("go:competitors");
  }
  if (hasButton(view, "competitors:inside")) return press("competitors:inside");
  if (hasButton(view, "competitors:attack")) {
    markTried(c);
    const hisHp = Number(/has (\d+) hitpoints/.exec(text)?.[1] ?? 10);
    const k = memory.known;
    const mine = k.hpMax * (k.strength + 1);
    const his = hisHp * 4;
    const fight = me.burglary === "attack" || (me.burglary === "auto" && mine >= his * 1.25);
    if (fight || !hasButton(view, "competitors:steal")) return press("competitors:attack");
    return press("competitors:steal");
  }
  if (view.battle || hasButton(view, "battle:attack")) return battle(c);
  if (hasButton(view, "battle:yellwin") || hasButton(view, "battle:yelllost")) {
    if (hasButton(view, "battle:yelllost")) s.scratch.hurt = true;
    return press(hasButton(view, "battle:yellwin") ? "battle:yellwin" : "battle:yelllost");
  }
  // A refusal (online, police, someone else inside, your own parlor) or a result.
  markTried(c);
  return safeAction(view);
}

export function markTried(c: Ctx): void {
  const s = c.memory.session;
  if (typeof s.scratch.target === "string") {
    if (!s.tried.includes(s.scratch.target)) s.tried.push(s.scratch.target);
    delete s.scratch.target;
  }
}

export function battle(c: Ctx): Action {
  const { view } = c;
  const b = view.battle;
  if (b && hasButton(view, "battle:run")) {
    const me = b.me.hp / Math.max(1, b.me.hpMax);
    const them = b.them.hp / Math.max(1, b.them.hpMax);
    if (me < 0.3 && them > 0.5) return press("battle:run");
  }
  if (hasButton(view, "battle:attack")) return press("battle:attack");
  const any = enabledButtons(view)[0];
  return any ? press(any.id) : safeAction(view);
}
