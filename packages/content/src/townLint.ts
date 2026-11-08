// biome-ignore-all lint/suspicious/noTemplateCurlyInString: "${price}" in messages is a dollar sign before a {price} placeholder.
import {
  type ArcBeatDef,
  checkNewsCondition,
  EXPANDED_RULES,
  type ExpandedRules,
  type ExpandedTownContent,
  type InjuryCause,
  MODIFIER_KEYS,
  type ModifierDef,
  type NewsCondition,
  type Reward,
  type StoryArcDef,
  TOWN_MODIFIER_KEYS,
} from "@fq/core";

/**
 * The content rules of `expanded.town` (docs/expanded-rules.md section 25), beyond its schema.
 * `lint.ts` calls `townFieldRule` for the placeholders and lengths of every string, and
 * `lintTown` for the mechanics: modifier keys, ops and magnitudes, arcs that are well formed,
 * prices, rewards and pictures.
 */

const NONE: readonly string[] = [];

/** Placeholders the engine fills in for each `town.text` field (engine audit of expanded/town/*.ts). */
export const TOWN_TEXT_TOKENS: Readonly<Record<string, readonly string[]>> = {
  "hints.limitReached": ["limit"],
  "hints.costsTurns": ["turns"],
  "hints.needsPermit": ["name"],
  "graveyard.intro": ["plots", "monument", "duels"],
  "graveyard.monumentsIntro": ["current"],
  "graveyard.monumentLine": ["name", "price", "bp"],
  "graveyard.monumentBought": ["name", "bp"],
  "graveyard.tended[]": ["luck"],
  "graveyard.robFound[]": ["money"],
  "graveyard.robCaught": ["fine"],
  "graveyard.lookRows": ["list"],
  "graveyard.duel.youFirst": ["name"],
  "graveyard.duel.theyFirst": ["name"],
  "graveyard.duel.youHit": ["name", "damage"],
  "graveyard.duel.theyHit": ["name", "damage"],
  "graveyard.duel.shoveIn": ["name", "damage"],
  "graveyard.duel.theyShove": ["name", "damage"],
  "graveyard.duel.youMiss": ["name"],
  "graveyard.duel.theyMiss": ["name"],
  "graveyard.duel.shoveFail": ["name"],
  "graveyard.duel.theyShoveFail": ["name"],
  "graveyard.duel.shoveDetail": ["chance"],
  "graveyard.duel.won": ["name", "bp"],
  "graveyard.duel.lost": ["name", "bp"],
  "graveyard.duel.yielded": ["name", "bp"],
  "graveyard.duel.wonMail": ["name", "bp"],
  "graveyard.duel.lostMail": ["name", "bp"],
  "graveyard.duel.yieldMail": ["name", "bp"],
  "graveyard.duel.crime": ["winner", "loser"],
  "graveyard.duel.targetPeaceful": ["name"],
  "graveyard.duel.chainMate": ["name"],
  "graveyard.duel.rivalTired": ["name"],
  "graveyard.duel.sheltered": ["name"],
  "church.greeting[]": ["player"],
  "church.bingoIntro": ["pot", "carry", "sold", "cards", "mine", "wood", "max"],
  "church.bingoBought": ["count", "numbers"],
  "church.bingoWinMail": ["pot", "card"],
  "church.bingoNews": ["name", "pot", "card"],
  "church.bingoCarryNews": ["card", "pot"],
  "church.confessed[]": ["price"],
  "church.holyWaterBought": ["have"],
  "church.served": ["bp", "reviews"],
  "church.tithed[]": ["money", "bp"],
  "cityHall.greeting": ["mayor", "player"],
  "cityHall.permitLine": ["name", "price", "description"],
  "cityHall.permitBought": ["name"],
  "cityHall.inspectionIntro": ["until"],
  "cityHall.certifiedUntil": ["until"],
  "cityHall.certified": ["days"],
  "cityHall.inspectFailMail": ["fine"],
  "cityHall.inspectFailNews": ["parlor", "name"],
  "cityHall.ordinanceIntro": ["current", "closes"],
  "cityHall.currentOrdinance": ["title", "effect", "until"],
  "cityHall.voted": ["title"],
  "cityHall.lobbied": ["title"],
  "cityHall.ordinanceNews": ["title", "text", "effect", "votes"],
  "cityHall.electionFiling": ["fee", "until", "candidates", "rating", "turns"],
  "cityHall.electionVoting": ["until", "candidates"],
  "cityHall.electionDone": ["name"],
  "cityHall.electionVoted": ["name"],
  "cityHall.electedNews": ["name", "votes"],
  "cityHall.mayorMorning": ["turns"],
  "cityHall.votesDetail": ["votes"],
  "cityHall.votesDetailOne": ["votes"],
  "chains.intro": ["fee", "join", "dues", "max"],
  "chains.line": ["name", "members", "score"],
  "chains.yours": ["name"],
  "chains.buttons.join": ["name"],
  "chains.founded": ["name"],
  "chains.invited": ["name"],
  "chains.inviteMail": ["chain", "name"],
  "chains.joined": ["name"],
  "chains.joinedMail": ["name"],
  "chains.cooldown": ["days"],
  "chains.duesUnpaid": ["dues"],
  "chains.noFriendlyFire": ["name"],
  "chains.removedName": ["n"],
  "hospital.greeting": ["player", "nurse"],
  "hospital.injuryLine": ["name", "days", "price"],
  "hospital.buttons.treat": ["name"],
  "hospital.treated": ["name"],
  "hospital.leadIntro": ["price", "karma", "nurse"],
  "hospital.stillHurt": ["list"],
  "hospital.hurtTurns": ["turns"],
  "hospital.newInjury": ["name"],
  "club.door": ["cover", "owner"],
  "club.gamesIntro": ["staked", "max"],
  "club.stakeLabel": ["stake"],
  "club.drawWin": ["you", "dealer", "won"],
  "club.drawLose": ["you", "dealer", "won"],
  "club.drawTie": ["you", "dealer", "won"],
  "club.slotsSpin": ["reels"],
  "club.slotsWin": ["won"],
  "club.shotsWin": ["won"],
  "club.marketLine": ["name", "price", "text"],
  "club.marketBought": ["name"],
  "club.hitPrompt": ["price"],
  "club.hitBooked": ["name"],
  "club.hitPeaceful": ["name"],
  "club.hitTaken": ["name"],
  "club.hitChain": ["name"],
  "club.hitNews": ["name"],
  "club.hitMail": ["bp"],
  "club.hitFoiledHirer": ["name"],
  "club.hitSnitchMail": ["name"],
  "club.hitSnitchNews": ["name", "target"],
  "bank.savingsIntro": ["savings", "rate", "cash", "cap"],
  "bank.deposited": ["money"],
  "bank.withdrew": ["money"],
  "bank.loanIntro": ["limit", "rate", "days", "fee"],
  "bank.loanOwed": ["owed", "due"],
  "bank.borrowed": ["money", "due"],
  "bank.repaid": ["money"],
  "bank.loanCollected": ["money"],
  "bank.loanDefault": ["left", "bp"],
  "bank.transferIntro": ["sent", "max", "fee"],
  "bank.transferTier": ["name"],
  "bank.transferred": ["count", "tier", "name", "fee"],
  "bank.transferMail": ["count", "tier", "name"],
  "bank.transferLimit": ["left"],
  "world.morningWeather": ["label", "line", "effect"],
  "world.morningNews": ["title", "effect"],
  "world.deskStatus": ["weather", "news"],
  "world.morningArc": ["title"],
  "challenge.intro": ["id", "turns"],
  "challenge.finished": ["score", "sales", "money"],
};

/** Placeholders and longest visible length of a string at `path` (normalized, under `town.`). */
export function townFieldRule(path: string): { tokens: readonly string[]; max: number } {
  const p = path.replace(/^town\./, "");
  if (p.startsWith("text.")) {
    const key = p.slice(5);
    const tokens = TOWN_TEXT_TOKENS[key] ?? NONE;
    // Buttons, button hints and short refusals sit on a button or a one-line hint.
    if (/\.buttons\./.test(key)) return { tokens, max: 32 };
    if (/^hints\./.test(key)) return { tokens, max: 60 };
    if (
      /(^|\.)title$|Detail$|stakeLabel|noCandidates|bingoFree|noMonument|Prompt$|^club\.cards/.test(
        key,
      )
    )
      return { tokens, max: 80 };
    if (
      /duel\.(selfPeaceful|targetPeaceful|chainMate|rivalTired|sheltered|self|nobody|prompt)$|^chains\.(full|cooldown)$|^hospital\.leadMax$|^bank\.(noDepositWithLoan|loanClosed|deadbeat|transfer(TooNew|Limit|TheirLimit|Self|NotEnough|Count))$/.test(
        key,
      )
    )
      return { tokens, max: 110 };
    if (/^club\.symbols\./.test(key)) return { tokens, max: 10 };
    // World strings are fragments of the morning screen and the desk strip.
    if (/^world\./.test(key)) return { tokens, max: 90 };
    return { tokens, max: 700 };
  }
  const rules: [RegExp, { tokens: readonly string[]; max: number }][] = [
    // {mayor} is the mayor's name on the front page, the desk strip and the morning screen (22.5).
    [/^news\[\]\.title$/, { tokens: ["mayor"], max: 64 }],
    [/^news\[\]\.message$/, { tokens: ["mayor"], max: 400 }],
    [/^news\[\]\.effect$/, { tokens: NONE, max: 80 }],
    [/^weather\[\]\.label$/, { tokens: NONE, max: 24 }],
    [/^weather\[\]\.morning\[\]$/, { tokens: NONE, max: 120 }],
    [/^weather\[\]\.effect$/, { tokens: NONE, max: 60 }],
    [/^ordinances\[\]\.title$/, { tokens: NONE, max: 48 }],
    [/^ordinances\[\]\.text$/, { tokens: NONE, max: 260 }],
    [/^ordinances\[\]\.effect$/, { tokens: NONE, max: 80 }],
    [/^market\[\]\.name$/, { tokens: NONE, max: 48 }],
    [/^market\[\]\.text$/, { tokens: NONE, max: 140 }],
    [/^injuries\[\]\.name$/, { tokens: NONE, max: 30 }],
    [/^injuries\[\]\.text$/, { tokens: NONE, max: 140 }],
    [/^arcs\[\]\.title$/, { tokens: NONE, max: 48 }],
    // The desk strip and the morning screen show the latest headline with nothing filled in.
    [/^arcs\[\]\.beats\[\]\.headline$/, { tokens: NONE, max: 64 }],
    [/^arcs\[\]\.beats\[\]\.story$/, { tokens: ["mayor", "top", "side"], max: 480 }],
    [/^arcs\[\]\.beats\[\]\.appeals\[\]\.label$/, { tokens: NONE, max: 36 }],
    [/^arcs\[\]\.beats\[\]\.appeals\[\]\.thanks$/, { tokens: ["money"], max: 200 }],
    [/^monuments\[\]$/, { tokens: NONE, max: 64 }],
    [/^permits\.[^.]+\.name$/, { tokens: NONE, max: 40 }],
    [/^permits\.[^.]+\.description$/, { tokens: NONE, max: 200 }],
    [/^cast\./, { tokens: NONE, max: 30 }],
  ];
  for (const [re, rule] of rules) if (re.test(p)) return rule;
  return { tokens: NONE, max: 60 };
}

/** Town fields that repeat by design (ids, keys, tests, appeal buttons shared by several beats). */
export function townStructural(path: string): boolean {
  return /^town\.(injuries\[\]\.causes\[\]|.*\.(key|op|kind|side|place|to|ending|start|next|ifTrue|ifFalse|grant|effect)|news\[\]\.when\..*|arcs\[\]\.beats\[\]\.appeals\[\]\..*|text\..*\.buttons\..*|text\.club\.(cards|symbols)\b.*)$/.test(
    path,
  );
}

// ---------------------------------------------------------------------------------------------
// Mechanics
// ---------------------------------------------------------------------------------------------

/**
 * Each modifier key the engine reads, its op, and the range a pack may use. The ranges are the
 * starter's (packages/core/src/expanded/content/townStarter.ts), widened a little for keys the
 * starter does not use; a test checks the table lists every key of MODIFIER_KEYS and
 * TOWN_MODIFIER_KEYS.
 */
export const MODIFIER_LIMITS: Readonly<
  Record<string, { op: "add" | "mul"; range: readonly [number, number] }>
> = {
  "wait.eventOdds": { op: "mul", range: [0.5, 1.5] },
  "wait.riskOdds": { op: "mul", range: [0.5, 1.5] },
  "wait.scriptOdds": { op: "mul", range: [0.5, 1.5] },
  "customer.limitMult": { op: "mul", range: [0.9, 1.1] },
  "customer.mood": { op: "add", range: [-0.5, 0.5] },
  "customer.cheapness": { op: "add", range: [-0.3, 0.3] },
  "customer.incomeShift": { op: "add", range: [-10, 10] },
  "customer.specialChance": { op: "mul", range: [0.5, 2] },
  "store.stockPrice": { op: "mul", range: [0.8, 1.2] },
  "sale.bpMult": { op: "mul", range: [0.9, 1.1] },
  "parlor.plotIncome": { op: "mul", range: [0.5, 1.5] },
  "prep.chance": { op: "mul", range: [0.5, 1.5] },
  "turns.daily": { op: "add", range: [-1, 2] },
  "customer.patience": { op: "add", range: [-1, 1] },
  "pvp.gainMult": { op: "mul", range: [0.5, 1.25] },
  "graveyard.robLuck": { op: "add", range: [-15, 15] },
  "graveyard.duels": { op: "mul", range: [0, 0] },
  "club.cover": { op: "add", range: [-1, 2] },
  "club.hitPrice": { op: "mul", range: [0.8, 1.5] },
  "bank.savingsRate": { op: "add", range: [-0.002, 0.002] },
  "bank.loanRate": { op: "add", range: [-0.01, 0.01] },
  "parlor.upgradePrice": { op: "mul", range: [0.9, 1.1] },
  "church.bingoCut": { op: "mul", range: [0, 2] },
  "church.bingo": { op: "mul", range: [0, 0] },
  "hospital.treatPrice": { op: "mul", range: [0.5, 1.5] },
  "city.permitPrice": { op: "mul", range: [0.5, 1.5] },
};

/** Every modifier key the engine reads. */
export const ENGINE_MODIFIER_KEYS: readonly string[] = [
  ...Object.values(MODIFIER_KEYS),
  ...Object.values(TOWN_MODIFIER_KEYS),
];

/**
 * Keys the engine reads at midnight (bank interest, the bingo payout), after the day's news and
 * weather of the day before have expired: a one-day story or a weather cannot change them.
 */
export const MIDNIGHT_KEYS: readonly string[] = [
  "bank.savingsRate",
  "bank.loanRate",
  "church.bingoCut",
];

/** Keys weather may not use: weather is small, never a closure or a turn change. */
export const NOT_WEATHER_KEYS: readonly string[] = [
  "turns.daily",
  "graveyard.duels",
  "church.bingo",
  ...MIDNIGHT_KEYS,
];

/** What can cause an injury (townTypes.ts `InjuryCause`). */
export const INJURY_CAUSES: readonly InjuryCause[] = ["duel", "fight", "rob", "roulette", "hit"];

/** Ranges of the other numbers of the town (the starter's, a little wider). */
export const TOWN_LIMITS = {
  injury: {
    perCause: 3,
    days: [1, 4],
    hp: [0, 10],
    patience: [0, 1],
    turns: [0, 1],
    treatPrice: [300, 3000],
  },
  market: {
    price: [400, 5000],
    weight: [0.3, 2],
    reward: { karma: [-3, 0], luck: [-3, 5], reviews: [-2, 3], gold: [0, 1] },
  },
  news: { days: [1, 3], minDay: [0, 25], weight: [0.2, 3], modifiers: [1, 3] },
  weather: { weight: [0.2, 3], modifiers: [0, 2] },
  ordinance: { modifiers: [1, 3] },
  arc: {
    path: [5, 12],
    after: [1, 7],
    days: [1, 7],
    weight: [0.2, 3],
    appealAmount: [500, 2500],
    appealKarma: [-2, 2],
    perPlayer: { walkouts: [1, 20], sales: [5, 120] },
    mayorKarma: [0, 100],
    reward: {
      bp: [-30, 100],
      karma: [-2, 2],
      reviews: [-3, 3],
      luck: [-5, 5],
      money: [-1000, 1000],
      rating: [-2, 2],
    },
  },
  step: 50,
} as const;

type Path = (string | number)[];
type Report = (path: Path, message: string, entry?: string) => void;

const inRange = (v: number, r: readonly [number, number]) => v >= r[0] && v <= r[1];
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function checkModifiers(
  list: readonly ModifierDef[],
  at: Path,
  label: string,
  report: Report,
): void {
  list.forEach((m, i) => {
    const lim = MODIFIER_LIMITS[m.key];
    if (!lim) {
      report([...at, i, "key"], `modifier key '${m.key}' is not one the engine reads`, label);
      return;
    }
    if (m.op !== lim.op)
      report(
        [...at, i, "op"],
        `'${m.key}' is a${lim.op === "add" ? "n add" : " mul"} key, not ${m.op}`,
        label,
      );
    else if (!inRange(m.value, lim.range))
      report(
        [...at, i, "value"],
        `'${m.key}' ${m.op} ${m.value} is outside ${lim.range[0]} to ${lim.range[1]} (balance, townLint.ts MODIFIER_LIMITS)`,
        label,
      );
  });
  const keys = list.map((m) => m.key);
  const dup = keys.find((k, i) => keys.indexOf(k) !== i);
  if (dup) report(at, `modifier '${dup}' is given twice`, label);
}

function checkReward(
  r: Reward,
  limits: Record<string, readonly [number, number]>,
  at: Path,
  label: string,
  report: Report,
): void {
  for (const [k, v] of Object.entries(r)) {
    if (typeof v !== "number") continue;
    const lim = limits[k];
    if (!lim) {
      if (v !== 0) report([...at, k], `no ${k} rewards here (balance)`, label);
    } else if (!inRange(v, lim)) {
      report(
        [...at, k],
        `${k} ${v} is outside ${lim[0]} to ${lim[1]} (balance, townLint.ts TOWN_LIMITS)`,
        label,
      );
    }
  }
}

function nextIds(b: ArcBeatDef): string[] {
  if (b.next === undefined) return [];
  return typeof b.next === "string" ? [b.next] : [b.next.ifTrue, b.next.ifFalse];
}

/** Every path from the start beat as a list of beats; `cycle` when a path comes back on itself. */
export function arcPaths(arc: StoryArcDef): { paths: ArcBeatDef[][]; cycle?: string } {
  const beats = new Map(arc.beats.map((b) => [b.id, b]));
  const paths: ArcBeatDef[][] = [];
  let cycle: string | undefined;
  const walk = (id: string, trail: ArcBeatDef[]): void => {
    const b = beats.get(id);
    if (!b) return;
    if (trail.includes(b)) {
      cycle ??= [...trail.map((t) => t.id), id].join(" -> ");
      return;
    }
    const here = [...trail, b];
    const next = nextIds(b);
    if (next.length === 0) paths.push(here);
    for (const n of next) walk(n, here);
  };
  walk(arc.start, []);
  return cycle === undefined ? { paths } : { paths, cycle };
}

/** Days from the start beat to the ending along a path (each beat's `after`, default 3). */
export function pathDays(path: readonly ArcBeatDef[]): number {
  return path.slice(0, -1).reduce((n, b) => n + (b.after ?? 3), 0);
}

/**
 * The first and last day each ending of `arc` can be recorded in `arcsDone`: the arc starts on a
 * day from `earliest` to `latest` and every beat waits its `after` days (default 3).
 */
export function endingDays(arc: StoryArcDef): Map<string, { first: number; last: number }> {
  const out = new Map<string, { first: number; last: number }>();
  for (const path of arcPaths(arc).paths) {
    const name = path.at(-1)?.ending ?? path.at(-1)?.id;
    if (name === undefined) continue;
    const days = pathDays(path);
    const was = out.get(name);
    out.set(name, {
      first: Math.min(was?.first ?? Infinity, arc.earliest + days),
      last: Math.max(was?.last ?? 0, arc.latest + days),
    });
  }
  return out;
}

/** Why a `when` is wrong, or the first day it can hold (every wanted arc ended), or 0 with no arcs. */
export function newsConditionDay(
  town: ExpandedTownContent,
  when: NewsCondition,
): { problems: string[]; first: number; last: number } {
  const problems = checkNewsCondition(town, "when", when).map((m) => m.replace(/^when: /, ""));
  let first = 0;
  let last = Infinity;
  for (const need of when.arcs ?? []) {
    const arc = town.arcs.find((a) => a.id === need.id);
    if (!arc) continue;
    if ((when.notArcs ?? []).includes(need.id))
      problems.push(`arc ${need.id} is in both arcs and notArcs, so the story can never run`);
    const days = [...endingDays(arc)].filter(
      ([name]) => !need.endings || need.endings.length === 0 || need.endings.includes(name),
    );
    if (days.length === 0) continue;
    first = Math.max(first, Math.min(...days.map(([, d]) => d.first)));
    last = Math.min(last, Math.max(...days.map(([, d]) => d.last)));
  }
  const arcIds = (when.arcs ?? []).map((a) => a.id);
  if (new Set(arcIds).size !== arcIds.length)
    problems.push("an arc is listed twice in arcs (list it once, with all its endings)");
  return { problems, first, last };
}

/**
 * Section 22.5: a story or blurb gated on how an arc ended must not be able to appear before that
 * arc can have ended. A news story's `minDay` (the first day it may run) must be at least the first
 * day the ending can be recorded; a blurb's range must reach the day after (it is drawn before the
 * town hook, so it sees the arcs ended up to the night before). Both must fit before the last day,
 * when no news runs.
 *
 * `day` is the story's `minDay`, or the blurb range's `high`.
 */
export function lintNewsWhen(
  town: ExpandedTownContent,
  when: NewsCondition | undefined,
  kind: "news" | "blurb",
  day: number,
  season: number,
  report: (message: string) => void,
): void {
  if (!when) return;
  const { problems, first } = newsConditionDay(town, when);
  for (const m of problems) report(m);
  if (problems.length > 0 || first === 0) return;
  if (kind === "news") {
    if (day < first)
      report(
        `minDay ${day} is before day ${first}, the first day the arc can have ended; set minDay to at least ${first}`,
      );
    if (first > season - 1)
      report(`the arc cannot end before day ${first}; no news runs on the last day (${season})`);
  } else {
    if (day < first + 1)
      report(
        `this range ends on day ${day}, before the first day (${first + 1}) the arc can have ended and the blurb can run; move it to a later range`,
      );
    if (first + 1 > season - 1)
      report(`the arc cannot end before day ${first}; no blurb runs on the last day (${season})`);
  }
}

export interface TownLintOptions {
  rules: ExpandedRules;
  assetIds?: ReadonlySet<string>;
  /** Headlines of the Classic-format news table: a town story must not repeat one. */
  newsTitles?: ReadonlySet<string>;
  /** Days in a season (default the Expanded ruleset's). */
  seasonDays?: number;
}

export function lintTown(
  town: ExpandedTownContent,
  options: TownLintOptions,
  report: Report,
): void {
  const r = options.rules.town;
  const season = options.seasonDays ?? EXPANDED_RULES.settings.tournamentDays;
  const L = TOWN_LIMITS;

  // --- Ids ---
  const ids = (list: readonly { id: string }[], what: string) => {
    const seen = new Set<string>();
    list.forEach((x, i) => {
      if (!KEBAB.test(x.id)) report([what, i, "id"], "ids are kebab-case", x.id);
      if (seen.has(x.id)) report([what, i, "id"], `duplicate id '${x.id}'`, x.id);
      seen.add(x.id);
    });
  };
  ids(town.injuries, "injuries");
  ids(town.market, "market");
  ids(town.news, "news");
  ids(town.weather, "weather");
  ids(town.ordinances, "ordinances");
  ids(town.arcs, "arcs");

  // --- Injuries ---
  town.injuries.forEach((inj, i) => {
    const at: Path = ["injuries", i];
    for (const k of ["days", "hp", "patience", "turns", "treatPrice"] as const) {
      const v = inj[k] ?? 0;
      if (!Number.isInteger(v) || !inRange(v, L.injury[k]))
        report([...at, k], `${k} ${v} is outside ${L.injury[k][0]} to ${L.injury[k][1]}`, inj.name);
    }
    if (inj.treatPrice % L.step !== 0)
      report([...at, "treatPrice"], "price off the $50 grid", inj.name);
    for (const c of inj.causes ?? [])
      if (!INJURY_CAUSES.includes(c))
        report([...at, "causes"], `'${c}' is not a cause (${INJURY_CAUSES.join(", ")})`, inj.name);
    if (inj.causes !== undefined && new Set(inj.causes).size !== inj.causes.length)
      report([...at, "causes"], "a cause is listed twice", inj.name);
  });
  // Each kind of mishap draws among the injuries that name it (chooseInjury, core town/life.ts), so
  // a pack that tags any needs enough for every cause, or one cause repeats the same few.
  if (town.injuries.some((i) => i.causes !== undefined)) {
    for (const cause of INJURY_CAUSES) {
      const n = town.injuries.filter((i) => i.causes?.includes(cause)).length;
      if (n < L.injury.perCause)
        report(
          ["injuries"],
          `only ${n} injur${n === 1 ? "y" : "ies"} name the cause '${cause}'; each cause needs at least ${L.injury.perCause} (add \`causes\` to more injuries)`,
        );
    }
  }

  // --- Market ---
  town.market.forEach((m, i) => {
    const at: Path = ["market", i];
    if (m.price % L.step !== 0 || !inRange(m.price, L.market.price))
      report(
        [...at, "price"],
        `price must be a multiple of $50 from $${L.market.price[0]} to $${L.market.price[1]}`,
        m.name,
      );
    if (m.weight !== undefined && !inRange(m.weight, L.market.weight))
      report(
        [...at, "weight"],
        `weight from ${L.market.weight[0]} to ${L.market.weight[1]}`,
        m.name,
      );
    checkReward(m.reward, L.market.reward, [...at, "reward"], m.name, report);
    const does = Object.values(m.reward).some((v) => v !== 0 && v !== false && v !== undefined);
    if (!does && m.grant === undefined)
      report(at, "the item does nothing (no reward and no grant)", m.name);
  });

  // --- News ---
  const titles = new Set<string>();
  town.news.forEach((n, i) => {
    const at: Path = ["news", i];
    // A {placeholder} is filled with a name, so it does not count against the capitals.
    if (n.title.replace(/\{\w+\}/g, "X") !== n.title.replace(/\{\w+\}/g, "X").toUpperCase())
      report([...at, "title"], "headlines are in capitals", n.title);
    if (titles.has(n.title)) report([...at, "title"], "duplicate headline", n.title);
    titles.add(n.title);
    if (options.newsTitles?.has(n.title))
      report(
        [...at, "title"],
        "same headline as a Classic-format news blurb (both can run on one front page)",
        n.title,
      );
    if (n.days !== undefined && !inRange(n.days, L.news.days))
      report([...at, "days"], `days from ${L.news.days[0]} to ${L.news.days[1]}`, n.title);
    if (n.minDay !== undefined && !inRange(n.minDay, L.news.minDay))
      report([...at, "minDay"], `minDay from ${L.news.minDay[0]} to ${L.news.minDay[1]}`, n.title);
    if (n.weight !== undefined && !inRange(n.weight, L.news.weight))
      report([...at, "weight"], `weight from ${L.news.weight[0]} to ${L.news.weight[1]}`, n.title);
    if (!inRange(n.modifiers.length, L.news.modifiers))
      report(
        [...at, "modifiers"],
        `a story changes ${L.news.modifiers[0]} to ${L.news.modifiers[1]} rules`,
        n.title,
      );
    checkModifiers(n.modifiers, [...at, "modifiers"], n.title, report);
    if ((n.days ?? 1) < 2 && n.modifiers.some((m) => MIDNIGHT_KEYS.includes(m.key)))
      report(
        [...at, "days"],
        "bank rates and the bingo cut are read at midnight: give the story days: 2",
        n.title,
      );
    if (n.effect.trim() === "") report([...at, "effect"], "needs an effect line", n.title);
    lintNewsWhen(town, n.when, "news", n.minDay ?? 0, season, (m) =>
      report([...at, "when"], m, n.title),
    );
  });

  // --- Weather ---
  town.weather.forEach((w, i) => {
    const at: Path = ["weather", i];
    if (w.weight !== undefined && !inRange(w.weight, L.weather.weight))
      report(
        [...at, "weight"],
        `weight from ${L.weather.weight[0]} to ${L.weather.weight[1]}`,
        w.label,
      );
    if (!inRange(w.modifiers.length, L.weather.modifiers))
      report(
        [...at, "modifiers"],
        `weather changes at most ${L.weather.modifiers[1]} rules`,
        w.label,
      );
    checkModifiers(w.modifiers, [...at, "modifiers"], w.label, report);
    w.modifiers.forEach((m, j) => {
      if (NOT_WEATHER_KEYS.includes(m.key))
        report([...at, "modifiers", j, "key"], `weather is small: no '${m.key}'`, w.label);
    });
    if ((w.modifiers.length === 0) !== (w.effect === "no effect"))
      report(
        [...at, "effect"],
        "a weather with no modifiers says exactly 'no effect', and only then",
        w.label,
      );
  });

  // --- Ordinances ---
  town.ordinances.forEach((o, i) => {
    const at: Path = ["ordinances", i];
    if (!inRange(o.modifiers.length, L.ordinance.modifiers))
      report(
        [...at, "modifiers"],
        `an ordinance changes ${L.ordinance.modifiers[0]} to ${L.ordinance.modifiers[1]} rules`,
        o.title,
      );
    checkModifiers(o.modifiers, [...at, "modifiers"], o.title, report);
  });
  if (town.ordinances.length < r.cityHall.ordinance.candidates)
    report(["ordinances"], `a ballot needs ${r.cityHall.ordinance.candidates} ordinances`);

  // --- Arcs ---
  town.arcs.forEach((arc, ai) => {
    const at: Path = ["arcs", ai];
    const label = arc.title;
    if (arc.earliest < 1 || arc.latest > season)
      report(
        at,
        `window ${arc.earliest} to ${arc.latest} is outside the season (1 to ${season})`,
        label,
      );
    if (arc.weight !== undefined && !inRange(arc.weight, L.arc.weight))
      report([...at, "weight"], `weight from ${L.arc.weight[0]} to ${L.arc.weight[1]}`, label);
    const beats = new Map(arc.beats.map((b) => [b.id, b]));
    const index = new Map(arc.beats.map((b, i) => [b.id, i]));
    const where = (b: ArcBeatDef): Path => [...at, "beats", index.get(b.id) ?? 0];
    const seen = new Set<string>();
    arc.beats.forEach((b, bi) => {
      if (seen.has(b.id)) report([...at, "beats", bi, "id"], `duplicate beat id '${b.id}'`, label);
      seen.add(b.id);
      for (const n of nextIds(b))
        if (!beats.has(n))
          report([...at, "beats", bi, "next"], `no beat '${n}' in this arc`, label);
    });
    if (!beats.has(arc.start)) {
      report([...at, "start"], `no beat '${arc.start}' to start from`, label);
      return;
    }
    const { paths, cycle } = arcPaths(arc);
    if (cycle)
      report([...at, "beats"], `the beats loop (${cycle}), so the arc may never end`, label);
    const reached = new Set(paths.flat().map((b) => b.id));
    for (const b of arc.beats)
      if (!reached.has(b.id))
        report(where(b), `beat '${b.id}' can never be reached from '${arc.start}'`, label);
    const endings = new Set<string>();
    let longest = 0;
    for (const path of paths) {
      const last = path.at(-1) as ArcBeatDef;
      if (last.ending === undefined) report(where(last), "a last beat needs an ending", label);
      else endings.add(last.ending);
      const days = pathDays(path);
      longest = Math.max(longest, days);
      if (!inRange(days, L.arc.path))
        report(
          where(last),
          `the path ${path.map((b) => b.id).join(" -> ")} takes ${days} days; an arc runs ${L.arc.path[0]} to ${L.arc.path[1]}`,
          label,
        );
    }
    if (endings.size < 2) report(at, "an arc needs at least two endings", label);
    if (arc.latest + longest > season)
      report(
        at,
        `started on day ${arc.latest}, its longest path (${longest} days) runs past the season's last day`,
        label,
      );
    const sides = new Set(arc.beats.flatMap((b) => (b.appeals ?? []).map((a) => a.side)));
    arc.beats.forEach((b, bi) => {
      const bat: Path = [...at, "beats", bi];
      if (b.headline !== b.headline.toUpperCase())
        report([...bat, "headline"], "headlines are in capitals", b.headline);
      if (b.ending !== undefined && b.next !== undefined)
        report([...bat, "ending"], "only a last beat has an ending (this one goes on)", b.headline);
      if (b.after !== undefined && (!Number.isInteger(b.after) || !inRange(b.after, L.arc.after)))
        report(
          [...bat, "after"],
          `after is ${L.arc.after[0]} to ${L.arc.after[1]} days, so each beat comes later than the one before`,
          b.headline,
        );
      if (b.after !== undefined && b.next === undefined)
        report([...bat, "after"], "an ending has no next beat to wait for", b.headline);
      if (b.days !== undefined && !inRange(b.days, L.arc.days))
        report([...bat, "days"], `days from ${L.arc.days[0]} to ${L.arc.days[1]}`, b.headline);
      if (b.days !== undefined && (b.modifiers ?? []).length === 0)
        report([...bat, "days"], "days without modifiers does nothing", b.headline);
      checkModifiers(b.modifiers ?? [], [...bat, "modifiers"], b.headline, report);
      if (b.next === undefined && (b.appeals ?? []).length > 0)
        report(
          [...bat, "appeals"],
          "an ending's appeals are never shown (the arc is over)",
          b.headline,
        );
      (b.appeals ?? []).forEach((a, i) => {
        const aat: Path = [...bat, "appeals", i];
        if (a.amount % L.step !== 0 || !inRange(a.amount, L.arc.appealAmount))
          report(
            [...aat, "amount"],
            `amount a multiple of $50 from $${L.arc.appealAmount[0]} to $${L.arc.appealAmount[1]}`,
            a.label,
          );
        const k = a.karma ?? 0;
        if (!inRange(k, L.arc.appealKarma) || (a.side === "good" ? k < 0 : k > 0))
          report(
            [...aat, "karma"],
            `karma ${k}: the good side gives 0 to +2, the evil side 0 to -2`,
            a.label,
          );
      });
      for (const [ri, rw] of (b.rewards ?? []).entries()) {
        checkReward(rw.reward, L.arc.reward, [...bat, "rewards", ri, "reward"], b.headline, report);
        if ((rw.to === "good" || rw.to === "evil") && !sides.has(rw.to))
          report(
            [...bat, "rewards", ri, "to"],
            `no appeal in this arc gives to the ${rw.to} side, so nobody gets this`,
            b.headline,
          );
        if (rw.to === "top" && sides.size === 0)
          report(
            [...bat, "rewards", ri, "to"],
            "no appeal in this arc, so there is no top giver",
            b.headline,
          );
      }
      if (b.next !== undefined && typeof b.next !== "string") {
        const t = b.next.test;
        const tat: Path = [...bat, "next", "test"];
        if (t.kind === "sideLeads" && !sides.has(t.side))
          report(
            tat,
            `tests whether the ${t.side} side leads, but no appeal gives to it`,
            b.headline,
          );
        if (t.kind === "walkouts" || t.kind === "sales") {
          // A full day is about 16 sales a player (docs/balance/expanded-baseline.md), so a sales
          // test over a week needs tens, while walkouts are rare.
          const lim = L.arc.perPlayer[t.kind];
          if (!inRange(t.perPlayer, lim))
            report(tat, `${t.kind} perPlayer from ${lim[0]} to ${lim[1]}`, b.headline);
        }
        if (t.kind === "mayorKarma" && !inRange(t.atLeast, L.arc.mayorKarma))
          report(tat, "atLeast is a karma from 0 to 100", b.headline);
      }
    });
  });

  // --- Monuments, permits, the club's symbols and cards ---
  if (town.monuments.length !== r.graveyard.monuments.length)
    report(["monuments"], `one name per monument tier (${r.graveyard.monuments.length})`);
  for (const id of Object.keys(town.permits))
    if (!(id in r.cityHall.permits)) report(["permits", id], `no permit '${id}' in the rules`);
  const symbols = new Set(r.club.slots.reel);
  const named = Object.keys(town.text.club.symbols);
  for (const s of symbols)
    if (!named.includes(s))
      report(["text", "club", "symbols"], `no name for the slot symbol '${s}'`);
  for (const s of named)
    if (!symbols.has(s)) report(["text", "club", "symbols", s], `'${s}' is not a slot symbol`);
  if (town.text.club.cards.length !== 13)
    report(["text", "club", "cards"], "13 card names, Two to Ace (the draw is random(13))");

  // --- Pictures ---
  for (const [place, pic] of Object.entries(town.pictures)) {
    for (const [k, id] of Object.entries(pic as Record<string, string>)) {
      if (/^(ui|music)\//.test(id))
        report(["pictures", place, k], `'${id}' is interface art, not a scene picture`);
      else if (options.assetIds && !options.assetIds.has(id))
        report(
          ["pictures", place, k],
          `picture '${id}' is not in assets/manifest.json or assets/remastered/manifest.json`,
        );
    }
  }
}
