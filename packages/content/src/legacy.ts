/**
 * Pure parsers for the legacy `legacy/dist/*.txt` files, ported from the original C++:
 * `CTextParse::get_next_line` / `get_word` (legacy/source/shared/CTextParse.cpp), `CEvent`
 * (legacy/source/CEvent.cpp), `load_risks_from_file`, `load_soft_sell_from_file` and
 * `load_hard_sell_from_file` (legacy/source/COptions.cpp:7-215) and `load_strings`
 * (legacy/source/funeral_util.cpp:35-72).
 *
 * The original has no notion of comments: a line is `key|value|...` and a key nothing looks for is
 * ignored. `//` and `;` lines are therefore just lines with an unknown key. This module follows that
 * and only uses the comment convention to decide which ignored lines are worth reporting.
 */
import {
  assetId,
  type ContentPack,
  type EventEntry,
  type RangedTable,
  type RiskEntry,
  type SaleItem,
} from "@fq/core";
import { LEGACY_FILE, SLOT_COUNT } from "./tables.js";

export interface ImportNote {
  file: string;
  /** 1-based line of the legacy file, when the note is about one line. */
  line?: number;
  /**
   * `warning`: something in the legacy file is malformed or does not resolve (reported, never fixed).
   * `info`: a documented parser quirk was applied (carry-over, empty slots).
   */
  level: "warning" | "info";
  message: string;
}

export type LegacyTables = Omit<ContentPack, "id" | "text">;

export interface LegacyOptions {
  /** Known asset ids; unresolved picture references become warnings. */
  assetIds?: ReadonlySet<string>;
}

/** CTextParse::get_next_line: a line ends at LF; a CR just before it is dropped. */
export function legacyLines(text: string): string[] {
  const lines = text.split("\n").map((l) => (l.endsWith("\r") ? l.slice(0, -1) : l));
  // A final LF makes the C parser yield one empty last line; the split here does the same.
  return lines;
}

/** CTextParse::get_word (1-based, '|' separator, no trimming). */
export function word(line: string, n: number): string {
  return line.split("|")[n - 1] ?? "";
}

/** C `atoi`. */
export function atoi(text: string): number {
  const m = /^\s*([+-]?\d+)/.exec(text);
  return m ? Number.parseInt(m[1] as string, 10) : 0;
}

function isCommentOrBlank(line: string): boolean {
  const t = line.trim();
  return t === "" || t.startsWith("//") || t.startsWith(";");
}

/** Number of non-empty fields beyond the first `used` ones: text the original silently drops. */
function droppedFields(line: string, used: number): string[] {
  return line
    .split("|")
    .slice(used)
    .filter((f) => f !== "");
}

class Notes {
  readonly list: ImportNote[] = [];
  constructor(readonly file: string) {}
  warn(line: number | undefined, message: string): void {
    this.list.push({
      file: this.file,
      ...(line === undefined ? {} : { line }),
      level: "warning",
      message,
    });
  }
  info(line: number | undefined, message: string): void {
    this.list.push({
      file: this.file,
      ...(line === undefined ? {} : { line }),
      level: "info",
      message,
    });
  }
}

function picture(
  raw: string,
  line: number,
  notes: Notes,
  options: LegacyOptions,
): string | undefined {
  const id = assetId(raw);
  if (id !== undefined && options.assetIds && !options.assetIds.has(id)) {
    notes.warn(line, `picture '${raw}' (asset id '${id}') is not in assets/manifest.json`);
  }
  return id;
}

/** Buffer sizes of `CEvent` (legacy/source/CEvent.h): longer values overflow in the original. */
const EVENT_LIMITS = {
  message: 1000,
  give_random: 1000,
  add_log: 1000,
  title: 200,
  set_pic: 255,
} as const;

/** The `CEvent` format: `range|low|high` headers, each followed by `start_entry` blocks. */
export function parseRanged(
  file: string,
  text: string,
  options: LegacyOptions = {},
): { table: RangedTable<EventEntry>; notes: ImportNote[] } {
  const notes = new Notes(file);
  const table: RangedTable<EventEntry> = { ranges: [] };
  let entry: EventEntry | null = null;
  let seen = new Set<string>();
  legacyLines(text).forEach((line, index) => {
    const n = index + 1;
    const key = word(line, 1);
    if (key === "range") {
      const extra = droppedFields(line, 3);
      if (extra.length > 0) notes.warn(n, "range line has extra fields, which are ignored");
      table.ranges.push({ low: atoi(word(line, 2)), high: atoi(word(line, 3)), entries: [] });
      return;
    }
    if (key === "start_entry") {
      const block = table.ranges[table.ranges.length - 1];
      entry = {};
      seen = new Set();
      if (block) block.entries.push(entry);
      else notes.warn(n, "start_entry before any range line: the original never picks this entry");
      return;
    }
    const known = [
      "message",
      "title",
      "give_random",
      "add_log",
      "set_pic",
      "mod_bp",
      "mod_luck",
      "mod_turns",
    ];
    if (!known.includes(key)) {
      if (!isCommentOrBlank(line))
        notes.warn(n, `unrecognised line ignored by the original: '${line.slice(0, 60)}'`);
      return;
    }
    if (!entry) {
      notes.warn(n, `'${key}' before any start_entry is ignored by the original`);
      return;
    }
    if (seen.has(key)) notes.warn(n, `'${key}' repeated in one entry: the last value wins`);
    seen.add(key);
    const value = word(line, 2);
    const modifier = key.startsWith("mod_");
    const extra = droppedFields(line, modifier ? 3 : 2);
    if (extra.length > 0) {
      notes.warn(
        n,
        `'${key}' has extra '|' fields that the original drops (text after the second '|' is lost)`,
      );
    }
    const limit = EVENT_LIMITS[key as keyof typeof EVENT_LIMITS];
    if (limit !== undefined && value.length >= limit) {
      notes.warn(
        n,
        `'${key}' is ${value.length} characters; the original buffer holds ${limit - 1}`,
      );
    }
    if (key === "message") entry.message = value;
    else if (key === "title") entry.title = value;
    else if (key === "give_random") entry.giveRandom = value;
    else if (key === "add_log") entry.addLog = value;
    else if (key === "set_pic") {
      const p = picture(value, n, notes, options);
      if (p !== undefined) entry.picture = p;
      else delete entry.picture;
    } else {
      const pair: [number, number] = [atoi(value), atoi(word(line, 3))];
      if (key === "mod_bp") entry.modBp = pair;
      else if (key === "mod_luck") entry.modLuck = pair;
      else entry.modTurns = pair;
    }
  });
  return { table, notes: notes.list };
}

const RISK_KEYS = {
  start_message: "startMessage",
  start_url: "startPicture",
  start_url_bg: "startBackground",
  normal: "normalLabel",
  risk: "riskLabel",
  normal_message: "normalMessage",
  normal_url: "normalPicture",
  normal_url_bg: "normalBackground",
  fail_message: "failMessage",
  fail_url: "failPicture",
  fail_url_bg: "failBackground",
  success_message: "successMessage",
  success_url: "successPicture",
  success_url_bg: "successBackground",
} as const;

type RiskKey = keyof typeof RISK_KEYS;
const PICTURE_FIELDS = new Set<string>([
  "startPicture",
  "startBackground",
  "normalPicture",
  "normalBackground",
  "failPicture",
  "failBackground",
  "successPicture",
  "successBackground",
]);

/**
 * `load_risks_from_file` (COptions.cpp:7-109). One `CRisks` record is reused for the whole file and
 * `add_risk` appends a copy, so a key a block leaves out keeps the previous block's value.
 */
export function parseRisks(
  file: string,
  text: string,
  options: LegacyOptions = {},
): { risks: RiskEntry[]; notes: ImportNote[] } {
  const notes = new Notes(file);
  const risks: RiskEntry[] = [];
  const current = new Map<RiskKey, { value: string; line: number }>();
  let setInBlock = new Set<RiskKey>();
  let blockStart = 1;
  legacyLines(text).forEach((line, index) => {
    const n = index + 1;
    const key = word(line, 1);
    if (key === "add_risk") {
      const missing = (Object.keys(RISK_KEYS) as RiskKey[]).filter((k) => !setInBlock.has(k));
      const inherited = missing.filter((k) => current.has(k));
      const never = missing.filter((k) => !current.has(k));
      if (inherited.length > 0) {
        notes.info(
          n,
          `risk ${risks.length + 1} (block from line ${blockStart}) omits ${inherited.map((k) => `'${k}'`).join(", ")} and inherits the previous block's value`,
        );
      }
      if (never.length > 0) {
        notes.warn(
          n,
          `risk ${risks.length + 1} (block from line ${blockStart}) never sets ${never.map((k) => `'${k}'`).join(", ")}: empty in the original`,
        );
      }
      const record: Record<string, string | undefined> = {};
      for (const [legacyKey, field] of Object.entries(RISK_KEYS)) {
        const raw = current.get(legacyKey as RiskKey)?.value ?? "";
        if (PICTURE_FIELDS.has(field)) {
          const p = assetId(raw);
          if (p !== undefined) record[field] = p;
        } else {
          record[field] = raw;
        }
      }
      risks.push(record as unknown as RiskEntry);
      setInBlock = new Set();
      blockStart = n + 1;
      return;
    }
    if (!Object.hasOwn(RISK_KEYS, key)) {
      if (!isCommentOrBlank(line))
        notes.warn(n, `unrecognised line ignored by the original: '${line.slice(0, 60)}'`);
      return;
    }
    const k = key as RiskKey;
    if (setInBlock.has(k)) notes.warn(n, `'${key}' repeated in one block: the last value wins`);
    setInBlock.add(k);
    const extra = droppedFields(line, 2);
    if (extra.length > 0) {
      notes.warn(
        n,
        `'${key}' has extra '|' fields that the original drops: '${extra.join("|").slice(0, 40)}'`,
      );
    }
    const value = word(line, 2);
    // An unresolved picture is reported where it is written, not again where it is inherited.
    if (PICTURE_FIELDS.has(RISK_KEYS[k])) picture(value, n, notes, options);
    current.set(k, { value, line: n });
  });
  if (setInBlock.size > 0) {
    notes.warn(undefined, "keys after the last add_risk are ignored by the original");
  }
  return { risks, notes: notes.list };
}

/**
 * `load_soft_sell_from_file` / `load_hard_sell_from_file` (COptions.cpp:118-215): one record reused
 * for the whole file, `add_item` appends a copy.
 */
export function parseItems(file: string, text: string): { items: SaleItem[]; notes: ImportNote[] } {
  const notes = new Notes(file);
  const items: SaleItem[] = [];
  const item: SaleItem = { article: "", name: "", price: 0 };
  let setInBlock = new Set<string>();
  const everSet = new Set<string>();
  let blockStart = 1;
  legacyLines(text).forEach((line, index) => {
    const n = index + 1;
    const key = word(line, 1);
    if (key === "add_item") {
      const missing = ["reference", "name", "price"].filter((k) => !setInBlock.has(k));
      const inherited = missing.filter((k) => everSet.has(k));
      const never = missing.filter((k) => !everSet.has(k));
      if (inherited.length > 0) {
        notes.info(
          n,
          `item ${items.length + 1} (block from line ${blockStart}) omits ${inherited.map((k) => `'${k}'`).join(", ")} and inherits the previous block's value`,
        );
      }
      if (never.length > 0) {
        notes.warn(
          n,
          `item ${items.length + 1} never sets ${never.map((k) => `'${k}'`).join(", ")}`,
        );
      }
      items.push({ ...item });
      setInBlock = new Set();
      blockStart = n + 1;
      return;
    }
    if (key !== "reference" && key !== "name" && key !== "price") {
      if (!isCommentOrBlank(line))
        notes.warn(n, `unrecognised line ignored by the original: '${line.slice(0, 60)}'`);
      return;
    }
    if (setInBlock.has(key)) notes.warn(n, `'${key}' repeated in one block: the last value wins`);
    setInBlock.add(key);
    everSet.add(key);
    const extra = droppedFields(line, 2);
    if (extra.length > 0) {
      notes.warn(
        n,
        `'${key}' has extra '|' fields that the original drops: '${extra.join("|").slice(0, 40)}'`,
      );
    }
    const value = word(line, 2);
    if (key === "reference") item.article = value;
    else if (key === "name") item.name = value;
    else {
      if (!/^\s*[+-]?\d+\s*$/.test(value))
        notes.warn(n, `price '${value}' is not a whole number (atol reads ${atoi(value)})`);
      item.price = atoi(value);
    }
  });
  if (setInBlock.size > 0)
    notes.warn(undefined, "keys after the last add_item are ignored by the original");
  return { items, notes: notes.list };
}

/**
 * `load_strings` (funeral_util.cpp:35-72): `index|text` lines; only 1 to 100 count; later lines
 * overwrite earlier ones; everything else is empty.
 */
export function parseSlots(file: string, text: string): { slots: string[]; notes: ImportNote[] } {
  const notes = new Notes(file);
  const slots = new Array<string>(SLOT_COUNT).fill("");
  const filled = new Set<number>();
  legacyLines(text).forEach((line, index) => {
    const n = index + 1;
    const i = atoi(word(line, 1));
    if (i >= 1 && i <= SLOT_COUNT) {
      if (filled.has(i)) notes.warn(n, `slot ${i} is set again: the last line wins`);
      filled.add(i);
      const extra = droppedFields(line, 2);
      if (extra.length > 0) notes.warn(n, `slot ${i} has extra '|' fields that the original drops`);
      slots[i - 1] = word(line, 2);
    } else if (!isCommentOrBlank(line)) {
      notes.warn(
        n,
        `line is outside slots 1 to ${SLOT_COUNT} and is ignored: '${line.slice(0, 60)}'`,
      );
    }
  });
  const empty: number[] = [];
  for (let i = 1; i <= SLOT_COUNT; i++) if (!filled.has(i)) empty.push(i);
  if (empty.length > 0) {
    notes.info(undefined, `${empty.length} empty slots: ${compressRuns(empty)}`);
  }
  return { slots, notes: notes.list };
}

/**
 * `load_swear_filter_from_file` (legacy/source/security.cpp:43-75): `addword|bad|good` lines in
 * file order. The `;` lines are ordinary unknown keys (the commented-out `;addword` examples).
 */
export function parseSwearWords(
  file: string,
  text: string,
): { words: ContentPack["swearWords"]; notes: ImportNote[] } {
  const notes = new Notes(file);
  const words: ContentPack["swearWords"] = [];
  legacyLines(text).forEach((line, index) => {
    const n = index + 1;
    if (word(line, 1) !== "addword") {
      if (!isCommentOrBlank(line))
        notes.warn(n, `unrecognised line ignored by the original: '${line.slice(0, 60)}'`);
      return;
    }
    if (droppedFields(line, 3).length > 0)
      notes.warn(n, "addword has extra '|' fields that the original drops");
    if (word(line, 2) === "") notes.warn(n, "addword with an empty word to replace");
    words.push({ bad: word(line, 2), good: word(line, 3) });
  });
  return { words, notes: notes.list };
}

function compressRuns(values: number[]): string {
  const parts: string[] = [];
  for (let i = 0; i < values.length; ) {
    let j = i;
    while (values[j + 1] === (values[j] as number) + 1) j++;
    parts.push(j === i ? `${values[i]}` : `${values[i]}-${values[j]}`);
    i = j + 1;
  }
  return parts.join(", ");
}

/** The ten legacy files a pack is made from, keyed by file name, already decoded (ISO-8859-1). */
export type LegacySources = { [F in (typeof LEGACY_FILE)[keyof typeof LEGACY_FILE]]: string };

/** Parses every table. Never throws on malformed lines: they come back as notes. */
export function importLegacyTables(
  sources: LegacySources,
  options: LegacyOptions = {},
): { tables: LegacyTables; notes: ImportNote[] } {
  const notes: ImportNote[] = [];
  const take = <T>(r: { notes: ImportNote[] } & T): T => {
    notes.push(...r.notes);
    return r;
  };
  const ranged = (f: keyof LegacySources) => take(parseRanged(f, sources[f], options)).table;
  const items = (f: keyof LegacySources) => take(parseItems(f, sources[f])).items;
  const slots = (f: keyof LegacySources) => take(parseSlots(f, sources[f])).slots;
  const tables: LegacyTables = {
    events: ranged(LEGACY_FILE.events),
    newsBlurbs: ranged(LEGACY_FILE.newsBlurbs),
    noCustomers: ranged(LEGACY_FILE.noCustomers),
    fortunes: ranged(LEGACY_FILE.fortunes),
    niceFortunes: ranged(LEGACY_FILE.niceFortunes),
    risks: take(parseRisks(LEGACY_FILE.risks, sources[LEGACY_FILE.risks], options)).risks,
    softSell: items(LEGACY_FILE.softSell),
    hardSell: items(LEGACY_FILE.hardSell),
    ratings: slots(LEGACY_FILE.ratings),
    karma: slots(LEGACY_FILE.karma),
    swearWords: take(parseSwearWords(LEGACY_FILE.swearWords, sources[LEGACY_FILE.swearWords]))
      .words,
  };
  return { tables, notes };
}
