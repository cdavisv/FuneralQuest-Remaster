/// <reference types="node" />
/**
 * Test-only loader: builds a ContentPack straight from legacy/dist/*.txt,
 * following the original parsers (CTextParse, CEvent, COptions,
 * load_strings). The real importer lives in packages/content.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assetId,
  CLASSIC_TEXT,
  type ContentPack,
  type EventEntry,
  type RangedTable,
  type RiskEntry,
  type SaleItem,
  type SwearWord,
} from "../../src/index.js";

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const DIST = resolve(REPO_ROOT, "legacy/dist");

/** CTextParse::get_next_line: CR LF stripped, latin-1. */
function lines(file: string): string[] {
  return readFileSync(resolve(DIST, file), "latin1")
    .split("\n")
    .map((l) => l.replace(/\r$/, ""));
}

/** CTextParse::get_word (1-based, '|' separator, no trimming). */
function word(line: string, n: number): string {
  return line.split("|")[n - 1] ?? "";
}

/** C atoi. */
function atoi(text: string): number {
  const m = /^\s*([+-]?\d+)/.exec(text);
  return m ? Number.parseInt(m[1] as string, 10) : 0;
}

function pic(value: string): string | undefined {
  return assetId(value);
}

/** CEvent format (legacy/source/CEvent.cpp). */
export function loadRanged(file: string): RangedTable<EventEntry> {
  const table: RangedTable<EventEntry> = { ranges: [] };
  let entry: EventEntry | null = null;
  for (const line of lines(file)) {
    const key = word(line, 1);
    if (key === "range") {
      table.ranges.push({ low: atoi(word(line, 2)), high: atoi(word(line, 3)), entries: [] });
      continue;
    }
    if (key === "start_entry") {
      const block = table.ranges[table.ranges.length - 1];
      entry = {};
      if (block) block.entries.push(entry);
      continue;
    }
    if (!entry) continue;
    const value = word(line, 2);
    if (key === "message") entry.message = value;
    else if (key === "title") entry.title = value;
    else if (key === "give_random") entry.giveRandom = value;
    else if (key === "add_log") entry.addLog = value;
    else if (key === "set_pic") {
      const p = pic(value);
      if (p) entry.picture = p;
    } else if (key === "mod_bp") entry.modBp = [atoi(value), atoi(word(line, 3))];
    else if (key === "mod_luck") entry.modLuck = [atoi(value), atoi(word(line, 3))];
    else if (key === "mod_turns") entry.modTurns = [atoi(value), atoi(word(line, 3))];
  }
  return table;
}

/** load_risks_from_file (legacy/source/COptions.cpp:7-109): one record reused, so keys carry over. */
export function loadRisks(): RiskEntry[] {
  const out: RiskEntry[] = [];
  const r: Record<string, string> = {};
  for (const line of lines("risks.txt")) {
    const key = word(line, 1);
    if (key === "add_risk") {
      const risk: RiskEntry = {
        startMessage: r.start_message ?? "",
        normalLabel: r.normal ?? "",
        riskLabel: r.risk ?? "",
        normalMessage: r.normal_message ?? "",
        failMessage: r.fail_message ?? "",
        successMessage: r.success_message ?? "",
      };
      const set = (field: keyof RiskEntry, k: string) => {
        const p = pic(r[k] ?? "");
        if (p) (risk as unknown as Record<string, string>)[field] = p;
      };
      set("startPicture", "start_url");
      set("startBackground", "start_url_bg");
      set("normalPicture", "normal_url");
      set("normalBackground", "normal_url_bg");
      set("failPicture", "fail_url");
      set("failBackground", "fail_url_bg");
      set("successPicture", "success_url");
      set("successBackground", "success_url_bg");
      out.push(risk);
    } else if (key !== "") {
      r[key] = word(line, 2);
    }
  }
  return out;
}

/** load_soft_sell_from_file / load_hard_sell_from_file (COptions.cpp:118-215). */
export function loadItems(file: string): SaleItem[] {
  const out: SaleItem[] = [];
  const item: SaleItem = { article: "", name: "", price: 0 };
  for (const line of lines(file)) {
    const key = word(line, 1);
    if (key === "reference") item.article = word(line, 2);
    else if (key === "name") item.name = word(line, 2);
    else if (key === "price") item.price = atoi(word(line, 2));
    else if (key === "add_item") out.push({ ...item });
  }
  return out;
}

/** load_strings (legacy/source/funeral_util.cpp:35-72). */
export function loadStrings(file: string): string[] {
  const out = new Array<string>(100).fill("");
  for (const line of lines(file)) {
    const index = atoi(word(line, 1));
    if (index >= 1 && index <= 100) out[index - 1] = word(line, 2);
  }
  return out;
}

/** load_swear_filter_from_file (legacy/source/security.cpp:43-75): `addword|bad|good` lines. */
export function loadSwearWords(): SwearWord[] {
  const out: SwearWord[] = [];
  for (const line of lines("swear_words.txt")) {
    if (word(line, 1) === "addword") out.push({ bad: word(line, 2), good: word(line, 3) });
  }
  return out;
}

let cached: ContentPack | null = null;

export function legacyContent(): ContentPack {
  if (cached) return cached;
  cached = {
    id: "legacy-test",
    events: loadRanged("events.txt"),
    newsBlurbs: loadRanged("news_blurbs.txt"),
    noCustomers: loadRanged("no_customers.txt"),
    fortunes: loadRanged("yangs.txt"),
    niceFortunes: loadRanged("yangs_nice.txt"),
    risks: loadRisks(),
    softSell: loadItems("soft_sell.txt"),
    hardSell: loadItems("hard_sell.txt"),
    ratings: loadStrings("ratings.txt"),
    karma: loadStrings("karma.txt"),
    swearWords: loadSwearWords(),
    text: CLASSIC_TEXT,
  };
  return cached;
}
