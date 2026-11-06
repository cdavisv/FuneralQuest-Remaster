// biome-ignore-all lint/suspicious/noTemplateCurlyInString: "${price}" in messages is a dollar sign before a {price} placeholder.
import {
  CLASSIC_TEXT,
  type ContentPack,
  checkExpandedContent,
  EXPANDED,
  EXPANDED_RULES,
  type ExpandedContent,
  type ExpandedRules,
  TOWN_STARTER,
} from "@fq/core";
import { bannedTerms } from "./banned.js";
import type { PackIssue } from "./check.js";
import { EXPANDED_KEY, TABLE_FILE, type TableKey } from "./tables.js";
import { lintNewsWhen, lintTown, townFieldRule, townStructural } from "./townLint.js";

/**
 * Content rules beyond the schema, for packs that add new writing (the built-in Expanded pack is
 * built only if it passes; `pnpm --filter @fq/content exec tsx src/cli.ts lint` lists problems):
 *
 * - placeholders: every `{token}` and `*TOKEN*` is one the engine fills in for that field (the
 *   engine leaves unknown ones on screen); colour codes are the original's; braces balance;
 * - pictures: content pictures are scene art, not interface parts (`ui/`, `music/`); that they
 *   exist in the manifest is the schema check's job (`checkPack` with `assetIds`);
 * - no duplicate lines within a table (or within a pool the engine draws from as one);
 * - prices on the $50 grid and inside each table's range, articles that agree with the name;
 * - the mechanical fields of new events, news, prep choices and specials in the ranges the
 *   originals and the starter use; ranged tables without gaps or unreachable ranges;
 * - every trait has its tells (at least two lines), a hint, and affinities that some item has;
 * - line lengths that fit the text panel (limits from the originals' longest lines);
 * - ratings and karma with every slot filled;
 * - banned terms (banned.ts): real brands and people, slurs;
 * - the town (`expanded.town`, townLint.ts): placeholders and lengths per field, modifier keys,
 *   ops and magnitudes, arcs that are well formed (targets exist, every beat reachable, no loops,
 *   endings, 5 to 12 days, inside the season), prices, rewards, and pictures in the manifest;
 * - `checkExpandedContent` from @fq/core (ids, upgrade names, tier order) against the rules.
 *
 * Lines found unchanged in `base` (the reviewed Classic pack) are exempt from the text rules, so
 * the originals Expanded keeps (Elvis, the snakehead blurb's unfilled `*NAME*`) do not fail it.
 */
export interface LintOptions {
  /** The reviewed pack this one builds on; its lines are exempt from the text rules. */
  base?: ContentPack;
  /**
   * Known asset ids (assets/manifest.json). The town's pictures (`fg`/`bg`) are checked here, since
   * `checkPack` finds pictures by key name; others are `checkPack`'s job.
   */
  assetIds?: ReadonlySet<string>;
  /** Rules for `checkExpandedContent` (default `EXPANDED`). */
  rules?: ExpandedRules;
  /** Require every rating and karma slot to have a line (default true). */
  fullSlots?: boolean;
}

// ---------------------------------------------------------------------------------------------
// Placeholders
// ---------------------------------------------------------------------------------------------

/** `customerVars` + `{player}` (classic/customerText.ts, classic/modules/negotiation.ts). */
export const CLASSIC_CUSTOMER_TOKENS = [
  "customer",
  "cYoungMan",
  "cMan",
  "cAYoung",
  "cHe",
  "cHeCap",
  "cHim",
  "cHis",
  "cSir",
  "cSirCap",
  "dRelation",
  "dHe",
  "dHeCap",
  "dHim",
  "dSmashed",
  "dFridge",
  "limit",
  "player",
] as const;

/** `xvars` (expanded/customer.ts): the Classic ones plus the Expanded customer's. */
export const EXPANDED_CUSTOMER_TOKENS = [
  ...CLASSIC_CUSTOMER_TOKENS,
  "cName",
  "cFirst",
  "surname",
  "dFirst",
  "customerName",
  "dHis",
  "pet",
  "casket",
  "aFridge",
  "AFridge",
] as const;

/** The variables of a body-preparation choice (expanded/modules/prep.ts `pending`). */
export const PREP_TOKENS = ["dFirst", "surname", "dHis", "dHim", "dHe", "dHeCap", "player"];

/**
 * Placeholders the engine fills with a percentage or a dollar amount. A field that has one of them
 * must not also type such a number (`5%`, `$500`): the balance pass changes the numbers, and the
 * placeholder follows them where typed text does not.
 */
export const AMOUNT_TOKENS: ReadonlySet<string> = new Set([
  "tax",
  "rate",
  "fee",
  "percent",
  "nice",
  "great",
  "price",
  "money",
  "fine",
  "cash",
  "savings",
  "cap",
  "owed",
  "left",
  "won",
  "limit",
  "staked",
  "dues",
  "join",
  "upkeep",
  "rawPrice",
]);

const COLOUR_CODES = new Set("0123456789!@#$yw^=");

interface FieldRule {
  /** `{token}`s allowed. */
  tokens: readonly string[];
  /** `*TOKEN*`s allowed. */
  stars?: readonly string[];
  /** Longest visible length (colour codes and literal `\n` pairs not counted). */
  max: number;
}

const NONE: readonly string[] = [];
const X = EXPANDED_CUSTOMER_TOKENS;
const RISK_STARS = ["SIR", "NAME", "PARLOR"];

/** Rules for the Classic-format tables, by normalized path (indices as `[]`). */
const TABLE_RULES: Partial<Record<TableKey, [RegExp, FieldRule][]>> = {
  events: [[/\.message$/, { tokens: NONE, max: 200 }]],
  newsBlurbs: [
    [/\.title$/, { tokens: NONE, max: 60 }],
    [/\.message$/, { tokens: NONE, max: 400 }],
    [/\.giveRandom$/, { tokens: NONE, max: 200 }],
    [/\.addLog$/, { tokens: NONE, stars: ["NAME", "HOME"], max: 250 }],
  ],
  noCustomers: [[/\.message$/, { tokens: NONE, max: 120 }]],
  fortunes: [[/\.message$/, { tokens: NONE, max: 90 }]],
  niceFortunes: [[/\.message$/, { tokens: NONE, max: 90 }]],
  risks: [
    [/Message$/, { tokens: NONE, stars: RISK_STARS, max: 450 }],
    [/Label$/, { tokens: NONE, max: 12 }],
  ],
  softSell: [[/\.(name|article)$/, { tokens: NONE, max: 48 }]],
  hardSell: [[/\.(name|article)$/, { tokens: NONE, max: 48 }]],
  ratings: [[/^\[\]$/, { tokens: NONE, max: 64 }]],
  karma: [[/^\[\]$/, { tokens: NONE, max: 48 }]],
  swearWords: [[/./, { tokens: NONE, max: 40 }]],
};

/** Per-key extras of `expanded.text.negotiation` (expanded/negotiation.ts). */
const NEGOTIATION_EXTRAS: Record<string, readonly string[]> = {
  softPitch: ["item", "article", "price"],
  hardPitchWood: ["price"],
  hardPitchSilver: ["price"],
  packagePitch: ["upgrade", "article", "price", "last"],
  packageAccept: ["upgrade", "article", "price", "last"],
  packageRefuse: ["upgrade", "article", "price", "last", "rawPrice"],
  packageOverLimit: ["upgrade", "article", "price", "last"],
  discountPitch: ["amount"],
  listenTrait: ["trait"],
  estimate: ["low", "high"],
  bonusRule: ["nice", "great"],
  total: ["price"],
  request: ["casket"],
  petRequest: ["casket"],
  selfRequest: ["casket"],
};

/** Placeholders the engine passes to `expanded.text` groups other than the negotiation (types.ts). */
const TEXT_TOKENS: Record<string, readonly string[]> = {
  "hints.needsMoney": ["money"],
  "hints.costsTurns": ["turns"],
  "done.success": ["price", "bp", "casket", "extra"],
  "done.perfect": [...X, "bonus", "percent"],
  "done.great": [...X, "bonus", "percent"],
  "done.nice": [...X, "bonus", "percent"],
  "done.missed": ["left", "nice"],
  "done.underdog": ["bonus"],
  "done.insurance": ["tax"],
  "done.money": ["money"],
  "done.fromStock": ["tier"],
  "done.rushOrder": ["tier", "cost"],
  "done.specialTv": ["name", "special"],
  "done.future": ["days"],
  "desk.accidents": ["turns"],
  "desk.banked": ["turns"],
  "desk.hearsePaid": ["ride", "upkeep"],
  "desk.hearseUnpaid": ["ride", "upkeep"],
  "desk.plotIncome": ["money", "plots"],
  "desk.futurePaid": ["text", "bp", "money"],
  "desk.digFound": ["money"],
  "office.summary": [
    "parlor",
    "level",
    "rating",
    "ratingTitle",
    "karma",
    "karmaTitle",
    "money",
    "stock",
    "markup",
    "rivalry",
    "perks",
  ],
  "office.rivalryIntro": ["tax"],
  "office.rivalryHints.peaceful": ["tax"],
  "office.upgradeLine": ["name", "price", "description"],
  "office.bought": ["name"],
  "office.needs": ["name"],
  "office.markupSet": ["markup"],
  "office.rivalrySet": ["rivalry"],
  "office.rivalryWait": ["days"],
  "store.casketIntro": ["wood", "silver", "gold", "have", "room"],
  "store.buyLabel": ["tier", "price"],
  "store.bought": ["tier", "price"],
  "store.restocked": ["count", "price"],
  "visit.targetPeaceful": ["name"],
  "visit.turnedAway": ["name"],
  "visit.cashStolen": ["money"],
  "visit.cashStolenMail": ["money"],
  "tutorial.pages[]": ["name", "parlor"],
  "arson.offer": ["cost"],
  "arson.burned": ["home", "name", "burned", "tags", "stock", "rating"],
  "arson.burnedMail": ["burned", "tags", "stock", "rating"],
};

/** Rules for `expanded`, by normalized path. First match wins. */
function expandedRule(path: string): FieldRule {
  if (path.startsWith("town.")) return townFieldRule(path);
  const rules: [RegExp, FieldRule][] = [
    [/^names\./, { tokens: NONE, max: 16 }],
    [/^traits\[\]\.lines\[\]$/, { tokens: X, max: 200 }],
    [/^traits\[\]\.label$/, { tokens: NONE, max: 22 }],
    [/^traits\[\]\.hint$/, { tokens: NONE, max: 160 }],
    [/^tells\./, { tokens: X, max: 200 }],
    [/^backstories\[\]$/, { tokens: [...X, "job", "hobby", "place", "years"], max: 220 }],
    [/^backstoryBits\./, { tokens: NONE, max: 60 }],
    [/^specials\[\]\.intro$/, { tokens: X, max: 420 }],
    [/^specials\[\]\.lines\./, { tokens: X, max: 260 }],
    [/^specials\[\]\.offer\.\w+\.text$/, { tokens: X, max: 300 }],
    [/^specials\[\]\.offer\.\w+\.label$/, { tokens: NONE, max: 20 }],
    [/^specials\[\]\.future\.text$/, { tokens: ["name", "he"], max: 200 }],
    [/^specials\[\]\.label$/, { tokens: NONE, max: 24 }],
    [/^softSell\[\]\./, { tokens: NONE, max: 48 }],
    [
      /^packages\[\]\.pitch\[\]$/,
      { tokens: [...X, "upgrade", "article", "price", "last"], max: 200 },
    ],
    [/^packages\[\]\./, { tokens: NONE, max: 48 }],
    [/^cremation\.pitch\[\]$/, { tokens: [...X, "price"], max: 200 }],
    [/^cremation\.(accept|refuse)\[\]$/, { tokens: X, max: 170 }],
    [/^cremation\./, { tokens: NONE, max: 48 }],
    [/^prep\[\]\.options\[\]\.label$/, { tokens: PREP_TOKENS, max: 24 }],
    [/^prep\[\]\./, { tokens: PREP_TOKENS, max: 300 }],
    [/^upgrades\.[^.]+\.name$/, { tokens: NONE, max: 30 }],
    [/^upgrades\./, { tokens: NONE, max: 200 }],
    [/^text\.negotiation\.(buttons|hints)\./, { tokens: NONE, max: 40 }],
    [
      /^text\.(hints|office\.buttons|stats|perks\.[^.]+\.name)/,
      { tokens: TEXT_TOKENS[path.replace(/^text\./, "")] ?? NONE, max: 60 },
    ],
  ];
  for (const [re, rule] of rules) if (re.test(path)) return rule;
  if (path.startsWith("text.negotiation.")) {
    const key = path.split(".")[2]?.replace(/\[\]$/, "") ?? "";
    return { tokens: [...X, ...(NEGOTIATION_EXTRAS[key] ?? [])], max: 220 };
  }
  if (path.startsWith("text.")) {
    return { tokens: TEXT_TOKENS[path.slice(5)] ?? NONE, max: 700 };
  }
  // Unknown fields (content types newer than this file): placeholders unchecked, generous length.
  return { tokens: ["*"], max: 700 };
}

/** Tokens CLASSIC_TEXT already uses at `path` (all alternatives of an array together). */
function classicTextTokens(path: string): Set<string> {
  const out = new Set<string>();
  let node: unknown = CLASSIC_TEXT;
  for (const step of path.split(".")) {
    const key = step.replace(/\[\]$/, "");
    if (typeof node !== "object" || node === null) return out;
    node = (node as Record<string, unknown>)[key];
  }
  const stack: unknown[] = [node];
  while (stack.length > 0) {
    const v = stack.pop();
    if (typeof v === "string") for (const m of v.matchAll(/\{(\w+)\}/g)) out.add(m[1] as string);
    else if (Array.isArray(v)) stack.push(...v);
    else if (typeof v === "object" && v !== null) stack.push(...Object.values(v));
  }
  return out;
}

function classicTextRule(path: string): FieldRule {
  // An appended line keeps the array's placeholders; a negotiation line may use any Classic
  // customer placeholder (the Classic ruleset fills only these: no {dFirst}, {dHis}, ...).
  const top = path.replace(/(\[\])?\.(loved|notLoved)$/, "").replace(/\[\]$/, "");
  const tokens = classicTextTokens(top);
  if (path.startsWith("negotiation.")) for (const t of CLASSIC_CUSTOMER_TOKENS) tokens.add(t);
  return { tokens: [...tokens], max: 220 };
}

// ---------------------------------------------------------------------------------------------
// Walking a pack
// ---------------------------------------------------------------------------------------------

type Path = (string | number)[];

interface Leaf {
  path: Path;
  value: string;
}

function leaves(value: unknown, path: Path = [], out: Leaf[] = []): Leaf[] {
  if (typeof value === "string") out.push({ path, value });
  else if (Array.isArray(value)) {
    for (const [i, v] of value.entries()) leaves(v, [...path, i], out);
  } else if (typeof value === "object" && value !== null) {
    for (const [k, v] of Object.entries(value)) leaves(v, [...path, k], out);
  }
  return out;
}

/** `ranges[].entries[].message`: every index as `[]`. */
function normal(path: Path): string {
  let out = "";
  for (const p of path) out += typeof p === "number" ? "[]" : out === "" ? p : `.${p}`;
  return out;
}

/** As `normal`, but keeping the range index (each range is drawn from on its own). */
function groupKey(path: Path): string {
  let out = "";
  path.forEach((p, i) => {
    if (typeof p === "number") out += path[i - 1] === "ranges" ? `[${p}]` : "[]";
    else out += out === "" ? p : `.${p}`;
  });
  return out;
}

function formatPath(path: Path): string {
  let out = "";
  for (const p of path) out += typeof p === "number" ? `[${p}]` : out === "" ? p : `.${p}`;
  return out;
}

function fileOf(table: TableKey | typeof EXPANDED_KEY, path: Path): { file: string; path: Path } {
  if (table !== EXPANDED_KEY) return { file: `${TABLE_FILE[table]}.yaml`, path };
  const [key, sub, ...rest] = path;
  if (key === "town" && typeof sub === "string") {
    const [group, ...inner] = rest;
    if (sub === "text" && typeof group === "string")
      return { file: `expanded/town/text/${group}.yaml`, path: inner };
    return { file: `expanded/town/${sub}.yaml`, path: rest };
  }
  if (key === "text" && typeof sub === "string") {
    return { file: `expanded/text/${sub}.yaml`, path: rest };
  }
  return { file: `expanded/${String(key)}.yaml`, path: sub === undefined ? [] : [sub, ...rest] };
}

/** Visible length: colour codes and literal `\n` pairs are not counted. */
export function visibleLength(text: string): number {
  return text.replace(/`./g, "").replace(/\\n/g, "").replace(/\r?\n/g, "").length;
}

function preview(text: string): string {
  const flat = text.replace(/`./g, "").replace(/\\n/g, " ").replace(/\s+/g, " ").trim();
  return flat.length > 40 ? `${flat.slice(0, 40)}...` : flat;
}

function dupKey(text: string): string {
  return text
    .replace(/`./g, "")
    .replace(/\\n/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9{}]+/g, " ")
    .trim();
}

function allStrings(value: unknown, out = new Set<string>()): Set<string> {
  for (const l of leaves(value)) out.add(l.value);
  return out;
}

// ---------------------------------------------------------------------------------------------
// The checks
// ---------------------------------------------------------------------------------------------

const ARTICLES = new Set(["a", "an", "some", "a few", "several", "two", "three", "extra", "the"]);
const A_EXCEPTIONS = /^(uni|use|usu|uti|eu|one|once|ure|uro)/i;
const AN_EXCEPTIONS = /^(hour|honest|honor|honour|heir|herb)/i;

/** "a" or "an" that does not fit the name's first sound, else undefined. */
function articleProblem(article: string, name: string): string | undefined {
  const word = name.replace(/^[^A-Za-z0-9]+/, "");
  const vowel = /^[aeiou]/i.test(word) ? !A_EXCEPTIONS.test(word) : AN_EXCEPTIONS.test(word);
  if (article === "a" && vowel) return `article 'a' before '${name}' (use 'an')`;
  if (article === "an" && !vowel) return `article 'an' before '${name}' (use 'a')`;
  return undefined;
}

/** Soft-sell and package tags the traits' affinities can key on (docs/expanded-rules.md 3.3). */
export const ITEM_TAGS = [
  "flowers",
  "music",
  "food",
  "prestige",
  "religious",
  "sentimental",
  "vanity",
  "green",
  "practical",
  "spooky",
  "novelty",
  "embalming",
  "cremation",
] as const;

/** The originals' event swings (legacy/dist/events.txt): BP -15 to 15, luck -3 to 4. */
export const EVENT_LIMITS = { bp: [-15, 15], luck: [-3, 4] } as const;
/** The originals' news mail rewards (legacy/dist/news_blurbs.txt): BP 20 to 150, luck 1 to 10. */
export const NEWS_LIMITS = { bp: [0, 150], luck: [0, 10] } as const;
/** Price ranges of new sale items: Classic soft sell, Classic hard sell, Expanded catalogue. */
export const PRICE_LIMITS = {
  softSell: [50, 600],
  hardSell: [1500, 4000],
  expanded: [50, 1000],
  step: 50,
} as const;
/** Body-preparation and special-customer rewards: the starter's ranges, a little wider. */
export const REWARD_LIMITS = {
  prep: { karma: [-4, 3], money: [-500, 800], reviews: [-5, 4], luck: [-6, 6], bp: [0, 0] },
  special: { karma: [-5, 4], money: [-1000, 3000], reviews: [-8, 6], bp: [-30, 15], gold: [0, 3] },
} as const;

export function lintPack(pack: ContentPack, options: LintOptions = {}): PackIssue[] {
  const issues: PackIssue[] = [];
  const reviewed = options.base ? allStrings(options.base) : new Set<string>();
  const isNew = (s: string): boolean => !reviewed.has(s);
  const push = (
    table: TableKey | typeof EXPANDED_KEY,
    path: Path,
    message: string,
    entry?: string,
  ): void => {
    const where = fileOf(table, path);
    issues.push({
      file: where.file,
      path: formatPath(where.path),
      ...(entry === undefined ? {} : { entry: preview(entry) }),
      message,
      kind: "lint",
    });
  };

  // --- Text rules and duplicates, for every string ---
  const groups = new Map<
    string,
    { table: TableKey | typeof EXPANDED_KEY; path: Path; value: string }[]
  >();
  const addToGroup = (key: string, table: TableKey | typeof EXPANDED_KEY, leaf: Leaf): void => {
    const list = groups.get(key) ?? [];
    list.push({ table, path: leaf.path, value: leaf.value });
    groups.set(key, list);
  };
  const sections: [TableKey | typeof EXPANDED_KEY, unknown][] = [
    ["events", pack.events],
    ["newsBlurbs", pack.newsBlurbs],
    ["noCustomers", pack.noCustomers],
    ["fortunes", pack.fortunes],
    ["niceFortunes", pack.niceFortunes],
    ["risks", pack.risks],
    ["softSell", pack.softSell],
    ["hardSell", pack.hardSell],
    ["ratings", pack.ratings],
    ["karma", pack.karma],
    ["text", pack.text],
    [EXPANDED_KEY, pack.expanded],
  ];
  for (const [table, value] of sections) {
    for (const leaf of leaves(value)) {
      const path = normal(leaf.path);
      const key = leaf.path.at(-1);
      const townPicture = table === EXPANDED_KEY && path.startsWith("town.pictures.");
      if ((typeof key === "string" && PICTURE_KEY.test(key)) || townPicture) {
        if (/^(ui|music)\//.test(leaf.value)) {
          push(table, leaf.path, `'${leaf.value}' is interface art, not a scene picture`);
        }
        continue;
      }
      if (isNew(leaf.value)) {
        const rule =
          table === EXPANDED_KEY
            ? expandedRule(path)
            : table === "text"
              ? classicTextRule(path)
              : (TABLE_RULES[table]?.find(([re]) => re.test(path))?.[1] ?? {
                  tokens: NONE,
                  max: 700,
                });
        checkText(leaf.value, rule, (m) => push(table, leaf.path, m, leaf.value));
        for (const hit of bannedTerms(leaf.value)) {
          push(
            table,
            leaf.path,
            `banned ${hit.kind} '${hit.term}' (content policy, banned.ts)`,
            leaf.value,
          );
        }
      }
      if (leaf.value.trim() === "" || isStructural(table, path)) continue;
      addToGroup(`${table}:${groupKey(leaf.path)}`, table, leaf);
    }
  }
  // Pools the engine draws from as one (expanded/negotiation.ts).
  const pools: [string, string[]][] = [
    ["softPitch", ["softPitch"]],
    ["hardPitchWood", ["hardPitchWood"]],
    ["hardPitchSilver", ["hardPitchSilver"]],
    ["guiltPitch", ["guiltPitch"]],
    ["sympathyPitch", ["sympathyPitch"]],
    ["packageAccept", ["upgradeAccept"]],
    ["packageRefuse", ["upgradeRefuse"]],
  ];
  const xn = pack.expanded?.text.negotiation as unknown as Record<string, unknown> | undefined;
  const cn = pack.text.negotiation as unknown as Record<string, unknown>;
  for (const [xKey, cKeys] of pools) {
    const key = `pool:${xKey}`;
    for (const l of leaves(xn?.[xKey], [EXPANDED_KEY, "text", "negotiation", xKey])) {
      addToGroup(key, EXPANDED_KEY, { path: l.path.slice(1), value: l.value });
    }
    for (const c of cKeys) {
      for (const l of leaves(cn[c], ["negotiation", c])) addToGroup(key, "text", l);
    }
  }
  for (const list of groups.values()) {
    const seen = new Map<string, { value: string }>();
    for (const item of list) {
      const k = dupKey(item.value);
      const first = seen.get(k);
      if (first && (isNew(item.value) || isNew(first.value))) {
        push(
          item.table,
          item.path,
          `duplicate line (same as "${preview(first.value)}")`,
          item.value,
        );
      } else if (!first) seen.set(k, item);
    }
  }

  // --- Ranged tables: no gaps, no unreachable ranges ---
  for (const table of [
    "events",
    "newsBlurbs",
    "noCustomers",
    "fortunes",
    "niceFortunes",
  ] as const) {
    const ranges = pack[table].ranges;
    ranges.forEach((r, i) => {
      if (r.low > r.high) push(table, ["ranges", i], `range low ${r.low} is above high ${r.high}`);
      const prev = ranges[i - 1];
      if (prev && r.low <= prev.high) {
        push(
          table,
          ["ranges", i],
          `range overlaps the one before (the engine uses the first match, so part of it is unreachable)`,
        );
      } else if (prev && r.low !== prev.high + 1) {
        push(
          table,
          ["ranges", i],
          `gap between ${prev.high} and ${r.low}: values there get "No message."`,
        );
      }
      if (r.entries.length === 0) push(table, ["ranges", i], "range has no entries");
    });
  }

  // --- Mechanics of new events and news ---
  const within = (v: readonly [number, number] | undefined, lim: readonly [number, number]) =>
    v === undefined || (v[0] <= v[1] && v[0] >= lim[0] && v[1] <= lim[1]);
  for (const [ri, r] of pack.events.ranges.entries()) {
    r.entries.forEach((e, ei) => {
      if (e.message !== undefined && !isNew(e.message)) return;
      const at: Path = ["ranges", ri, "entries", ei];
      if (e.message === undefined || e.message.trim() === "") push("events", at, "needs a message");
      if (!within(e.modBp, EVENT_LIMITS.bp)) {
        push(
          "events",
          [...at, "modBp"],
          `modBp must be low <= high within ${EVENT_LIMITS.bp.join(" to ")} (the originals' range)`,
          e.message,
        );
      }
      if (!within(e.modLuck, EVENT_LIMITS.luck)) {
        push(
          "events",
          [...at, "modLuck"],
          `modLuck must be low <= high within ${EVENT_LIMITS.luck.join(" to ")}`,
          e.message,
        );
      }
      if (e.modTurns)
        push("events", [...at, "modTurns"], "no turn rewards in events (balance)", e.message);
      if (e.title || e.giveRandom || e.addLog)
        push("events", at, "events show only a message and a picture", e.message);
    });
  }
  for (const [ri, r] of pack.newsBlurbs.ranges.entries()) {
    r.entries.forEach((e, ei) => {
      if (e.title !== undefined && !isNew(e.title)) return;
      const at: Path = ["ranges", ri, "entries", ei];
      const label = e.title ?? e.message;
      if (!e.title || !e.message)
        push("newsBlurbs", at, "a blurb needs a title and a message", label);
      if (e.title && e.title !== e.title.toUpperCase())
        push("newsBlurbs", [...at, "title"], "headlines are in capitals", label);
      // Section 22.5: a blurb that waits for an arc's ending must have a range that can see it.
      lintNewsWhen(
        pack.expanded?.town ?? TOWN_STARTER,
        e.when,
        "blurb",
        r.high,
        EXPANDED_RULES.settings.tournamentDays,
        (m) => push("newsBlurbs", [...at, "when"], m, label),
      );
      if (e.giveRandom) {
        if (!e.addLog)
          push("newsBlurbs", at, "a blurb with giveRandom needs an addLog (the news line)", label);
        if (!within(e.modBp, NEWS_LIMITS.bp))
          push(
            "newsBlurbs",
            [...at, "modBp"],
            `modBp within ${NEWS_LIMITS.bp.join(" to ")}`,
            label,
          );
        if (!within(e.modLuck, NEWS_LIMITS.luck))
          push(
            "newsBlurbs",
            [...at, "modLuck"],
            `modLuck within ${NEWS_LIMITS.luck.join(" to ")}`,
            label,
          );
        if (e.modTurns)
          push(
            "newsBlurbs",
            [...at, "modTurns"],
            "no turn rewards (the mail reader ignores them)",
            label,
          );
      } else if (e.modBp || e.modLuck || e.modTurns || e.addLog) {
        push(
          "newsBlurbs",
          at,
          "rewards and addLog only work with giveRandom (maintenance.ts newsMail)",
          label,
        );
      }
    });
  }

  // --- Risks ---
  pack.risks.forEach((risk, i) => {
    if (!isNew(risk.startMessage)) return;
    for (const k of ["normalLabel", "riskLabel"] as const) {
      if (risk[k].trim() === "" || risk[k] !== risk[k].trim()) {
        push("risks", [i, k], "labels are not empty and have no padding", risk.startMessage);
      }
    }
    for (const k of ["startMessage", "normalMessage", "failMessage", "successMessage"] as const) {
      if (risk[k].trim() === "")
        push("risks", [i, k], "every outcome needs its message", risk.startMessage);
    }
  });

  // --- Prices and articles ---
  const priceCheck = (
    table: TableKey | typeof EXPANDED_KEY,
    path: Path,
    item: { article: string; name: string; price: number },
    range: readonly [number, number],
  ): void => {
    if (!isNew(item.name)) return;
    if (item.price % PRICE_LIMITS.step !== 0 || item.price < range[0] || item.price > range[1]) {
      push(
        table,
        [...path, "price"],
        `price must be a multiple of $${PRICE_LIMITS.step} from $${range[0]} to $${range[1]}`,
        item.name,
      );
    }
    if (!ARTICLES.has(item.article)) {
      push(
        table,
        [...path, "article"],
        `article '${item.article}' is not one of ${[...ARTICLES].join(", ")}`,
        item.name,
      );
    }
    const a = articleProblem(item.article, item.name);
    if (a) push(table, [...path, "article"], a, item.name);
  };
  for (const [i, item] of pack.softSell.entries())
    priceCheck("softSell", [i], item, PRICE_LIMITS.softSell);
  for (const [i, item] of pack.hardSell.entries())
    priceCheck("hardSell", [i], item, PRICE_LIMITS.hardSell);

  // --- Ratings and karma ---
  if (options.fullSlots ?? true) {
    for (const table of ["ratings", "karma"] as const) {
      pack[table].forEach((line, i) => {
        if (line.trim() === "") push(table, [i], `slot ${i + 1} is empty`);
      });
    }
  }

  if (pack.expanded) lintExpanded(pack.expanded, options, isNew, push);
  if (pack.expanded?.town) {
    const newsTitles = new Set(
      pack.newsBlurbs.ranges.flatMap((r) => r.entries.flatMap((e) => (e.title ? [e.title] : []))),
    );
    lintTown(
      pack.expanded.town,
      {
        rules: options.rules ?? EXPANDED,
        newsTitles,
        ...(options.assetIds ? { assetIds: options.assetIds } : {}),
      },
      (path, message, entry) => push(EXPANDED_KEY, ["town", ...path], message, entry),
    );
  }
  return issues;
}

function isStructural(table: TableKey | typeof EXPANDED_KEY, path: string): boolean {
  // Ids, articles, tags, tracks, button labels and the like repeat by design.
  if (table === "softSell" || table === "hardSell") return !path.endsWith(".name");
  if (table === "risks") return /Label$/.test(path);
  // Arc ids and ending ids in a `when` repeat by design.
  if (table === "newsBlurbs") return /\.when\./.test(path);
  if (table === EXPANDED_KEY) {
    if (path.startsWith("town.")) return /\.id$/.test(path) || townStructural(path);
    return /(\.id|\.article|\.tags\[\]|\.track|\.requires|\.excludes\[\]|\.traits\[\]|\.pet\[\]|\.perk|\.label|\.portrait|\.picture|\.person\.\w+)$/.test(
      path,
    );
  }
  return false;
}

const PICTURE_KEY = /^(picture|portrait|.*Picture|.*Background)$/;

function checkText(value: string, rule: FieldRule, report: (message: string) => void): void {
  if (!rule.tokens.includes("*")) {
    for (const m of value.matchAll(/\{(\w+)\}/g)) {
      const token = m[1] as string;
      if (!rule.tokens.includes(token)) {
        report(
          rule.tokens.length === 0
            ? `placeholder {${token}}: this field takes none`
            : `placeholder {${token}} is not filled in here (allowed: ${rule.tokens.map((t) => `{${t}}`).join(" ")})`,
        );
      }
    }
    const stray = value.replace(/\{\w+\}/g, "");
    if (/[{}]/.test(stray)) report("unbalanced brace (a placeholder is written {name})");
    const amounts = rule.tokens.filter((t) => AMOUNT_TOKENS.has(t));
    if (amounts.length > 0) {
      const plain = value.replace(/`./g, "");
      for (const m of plain.matchAll(/\d[\d,.]*\s?(?:%|percent\b)|\$\s?\d[\d,.]*/g)) {
        report(
          `typed amount '${m[0]}' in a field that has ${amounts.map((t) => `{${t}}`).join(" ")}: write the amount with the placeholder, so tuning cannot make the text wrong`,
        );
      }
    }
  }
  for (const m of value.matchAll(/\*([A-Z]+)\*/g)) {
    if (!(rule.stars ?? []).includes(m[1] as string)) {
      report(
        `*${m[1]}* is not filled in here${rule.stars ? ` (allowed: ${rule.stars.map((s) => `*${s}*`).join(" ")})` : ""}`,
      );
    }
  }
  for (let i = 0; i < value.length; i++) {
    if (value[i] !== "`") continue;
    const code = value[i + 1];
    if (code === undefined || !COLOUR_CODES.has(code)) {
      report(`colour code '\`${code ?? ""}' is not one of the original's (\`0-9 ! @ # $ y w ^)`);
    }
    i++;
  }
  const length = visibleLength(value);
  if (length > rule.max)
    report(`too long for the text panel: ${length} characters (at most ${rule.max})`);
}

type Push = (
  table: TableKey | typeof EXPANDED_KEY,
  path: Path,
  message: string,
  entry?: string,
) => void;

function lintExpanded(
  x: ExpandedContent,
  options: LintOptions,
  isNew: (s: string) => boolean,
  push: Push,
): void {
  const E = EXPANDED_KEY;
  for (const problem of checkExpandedContent(x, options.rules ?? EXPANDED)) {
    push(E, [], `checkExpandedContent: ${problem}`);
  }

  // Names
  for (const list of ["male", "female", "surnames", "pets"] as const) {
    x.names[list].forEach((name, i) => {
      if (!/^[A-Z]/.test(name) || /\d/.test(name))
        push(E, ["names", list, i], "names start with a capital and have no digits", name);
    });
  }

  // Item tags, prices, articles
  const tags = new Set<string>(ITEM_TAGS);
  const used = new Set<string>(x.cremation.tags);
  x.softSell.forEach((item, i) => {
    for (const t of item.tags) {
      used.add(t);
      if (!tags.has(t))
        push(
          E,
          ["softSell", i, "tags"],
          `tag '${t}' is not in the vocabulary (lint.ts ITEM_TAGS)`,
          item.name,
        );
    }
    if (item.tags.length === 0)
      push(E, ["softSell", i, "tags"], "every item needs a tag (traits key on them)", item.name);
    const { price, article, name } = item;
    if (
      price % PRICE_LIMITS.step !== 0 ||
      price < PRICE_LIMITS.expanded[0] ||
      price > PRICE_LIMITS.expanded[1]
    ) {
      push(
        E,
        ["softSell", i, "price"],
        `price must be a multiple of $50 from $${PRICE_LIMITS.expanded[0]} to $${PRICE_LIMITS.expanded[1]}`,
        name,
      );
    }
    if (isNew(name)) {
      if (!ARTICLES.has(article))
        push(
          E,
          ["softSell", i, "article"],
          `article '${article}' is not one of ${[...ARTICLES].join(", ")}`,
          name,
        );
      const a = articleProblem(article, name);
      if (a) push(E, ["softSell", i, "article"], a, name);
    }
  });
  const itemNames = new Set<string>();
  x.softSell.forEach((item, i) => {
    if (itemNames.has(item.name)) push(E, ["softSell", i, "name"], "duplicate item", item.name);
    itemNames.add(item.name);
  });
  for (const [ci, cat] of x.packages.entries()) {
    cat.tiers.forEach((tier, ti) => {
      for (const t of tier.tags) {
        used.add(t);
        if (!tags.has(t))
          push(
            E,
            ["packages", ci, "tiers", ti, "tags"],
            `tag '${t}' is not in the vocabulary`,
            tier.name,
          );
      }
      if (ti > 0) {
        if (tier.article === "")
          push(
            E,
            ["packages", ci, "tiers", ti, "article"],
            "tiers after the free one need an article ({article} {upgrade} in pitches)",
            tier.name,
          );
        const a = articleProblem(tier.article, tier.name);
        if (a) push(E, ["packages", ci, "tiers", ti, "article"], a, tier.name);
      }
    });
  }

  // Traits: tells, hints, affinities that mean something
  x.traits.forEach((t, i) => {
    if (t.lines.length < 2)
      push(
        E,
        ["traits", i, "lines"],
        "a trait needs at least two tell lines, so a player can learn it",
        t.label,
      );
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.id))
      push(E, ["traits", i, "id"], "ids are kebab-case", t.label);
    for (const k of Object.keys(t.effects.affinity ?? {})) {
      if (!tags.has(k))
        push(E, ["traits", i, "effects", "affinity", k], `affinity '${k}' is not a tag`, t.label);
      else if (!used.has(k))
        push(
          E,
          ["traits", i, "effects", "affinity", k],
          `no item or package has the tag '${k}', so this affinity does nothing`,
          t.label,
        );
    }
  });
  x.traits.forEach((t, i) => {
    // Two traits that force opposite loved flags must exclude each other (section 3.1 step 6).
    x.traits.forEach((o, j) => {
      if (j <= i || t.effects.loved === undefined || o.effects.loved === undefined) return;
      if (t.effects.loved === o.effects.loved) return;
      const ex = (t.excludes ?? []).includes(o.id) || (o.excludes ?? []).includes(t.id);
      if (!ex)
        push(
          E,
          ["traits", i, "excludes"],
          `forces loved=${t.effects.loved} but does not exclude '${o.id}' (loved=${o.effects.loved})`,
          t.label,
        );
    });
  });

  // Rewards in range
  const rewardCheck = (
    path: Path,
    r: Record<string, unknown>,
    limits: Record<string, readonly [number, number]>,
    label: string,
  ): void => {
    for (const [k, lim] of Object.entries(limits)) {
      const v = r[k];
      if (typeof v === "number" && (v < lim[0] || v > lim[1])) {
        push(
          E,
          [...path, k],
          `${k} ${v} is outside ${lim[0]} to ${lim[1]} (balance, lint.ts REWARD_LIMITS)`,
          label,
        );
      }
    }
  };
  x.prep.forEach((p, i) => {
    p.options.forEach((o, j) => {
      const at: Path = ["prep", i, "options", j];
      rewardCheck(
        [...at, "effects"],
        o.effects as Record<string, unknown>,
        REWARD_LIMITS.prep,
        p.id,
      );
      if (o.risk) {
        rewardCheck(
          [...at, "risk", "failEffects"],
          o.risk.failEffects as Record<string, unknown>,
          REWARD_LIMITS.prep,
          p.id,
        );
        if (o.risk.weight < 0.5 || o.risk.weight > 0.95)
          push(
            E,
            [...at, "risk", "weight"],
            "risk weight from 0.5 to 0.95 (randomYesNo(luck, weight))",
            p.id,
          );
      }
      if (o.evil && (o.effects.karma ?? 0) >= 0)
        push(E, [...at, "effects", "karma"], "a dishonest (evil) choice costs karma", p.id);
    });
  });
  x.specials.forEach((s, i) => {
    for (const k of ["onHappy", "onDone", "onWalkout"] as const) {
      const r = s[k];
      if (r)
        rewardCheck(["specials", i, k], r as Record<string, unknown>, REWARD_LIMITS.special, s.id);
    }
    for (const k of ["accept", "decline"] as const) {
      const c = s.offer?.[k];
      if (c)
        rewardCheck(
          ["specials", i, "offer", k, "effects"],
          c.effects as Record<string, unknown>,
          REWARD_LIMITS.special,
          s.id,
        );
    }
    if (s.portrait !== undefined && !s.portrait.startsWith("people/")) {
      push(E, ["specials", i, "portrait"], "portraits are people/* pictures", s.id);
    }
  });
}
