import type { AssetId } from "@fq/protocol";
import type { ExpandedContent } from "../expanded/content/types.js";
import type { ClassicText } from "./classicText.js";
import type { NewsCondition } from "./newsCondition.js";

/**
 * Content consumed by the engine. A pack is plain JSON-compatible data, so an
 * importer can produce it from `legacy/dist/*.txt` or from YAML.
 *
 * Conventions for every string field below, unless a field says otherwise:
 * - Text is the original's markup string exactly as written after `key|` in
 *   the legacy file: backtick colour codes kept, and literal backslash-n pairs
 *   (two characters) kept. The engine applies the original's substitutions
 *   (`\n` to newline, `*NAME*` and friends) in the places the original did.
 *   It never contains HTML.
 * - Pictures are asset ids made with the rule in CLAUDE.md: drop the leading
 *   `flash/`, drop `.swf`, lowercase, forward slashes
 *   (`flash\\people\\m_old_3.swf` is `people/m_old_3`). An empty legacy value
 *   is `undefined`.
 */
export interface ContentPack {
  /** Pack id, for example "classic" or "vintage". */
  id: string;
  /** `events.txt`: random events on Wait for Customer, bracketed by total BP. */
  events: RangedTable<EventEntry>;
  /** `news_blurbs.txt`: the daily front-page item, bracketed by game day. */
  newsBlurbs: RangedTable<EventEntry>;
  /** `no_customers.txt`: "no business" lines. Unused by Classic (the call is commented out). */
  noCustomers: RangedTable<EventEntry>;
  /** `yangs.txt`: fortunes for Cursed Tiger deliveries. Only `message` is used. */
  fortunes: RangedTable<EventEntry>;
  /** `yangs_nice.txt`: fortunes for Lucky Sparrow deliveries. Only `message` is used. */
  niceFortunes: RangedTable<EventEntry>;
  /** `risks.txt`, in file order. */
  risks: RiskEntry[];
  /** `soft_sell.txt`, in file order (picked at random, duplicates allowed). */
  softSell: SaleItem[];
  /** `hard_sell.txt`, in file order (offered strictly in this order after Gold). */
  hardSell: SaleItem[];
  /**
   * `ratings.txt`: exactly 100 entries; index i holds line `i+1|text`.
   * Missing lines are "". Lines numbered outside 1 to 100 are ignored
   * (legacy/source/funeral_util.cpp:35-72).
   */
  ratings: string[];
  /** `karma.txt`, same layout as `ratings`. */
  karma: string[];
  /**
   * `swear_words.txt`: `addword|bad|good` lines in file order. The filter applies
   * them one after another (legacy/source/security.cpp:28-40).
   */
  swearWords: SwearWord[];
  /** Strings the original hard-coded in C++ (negotiation lines, desk text and so on). */
  text: ClassicText;
  /**
   * Content of the Expanded ruleset (expanded/content/types.ts). Optional, so
   * every Classic pack stays valid; `expandedContext` fills in the starter set
   * (expanded/content/starter.ts) when a pack has none.
   */
  expanded?: ExpandedContent;
}

/**
 * A file in the `CEvent` format (legacy/source/CEvent.cpp): `range|low|high`
 * headers, each followed by `start_entry` blocks.
 *
 * Selection rule the engine implements (CEvent.cpp:31-135): the first range
 * whose inclusive bounds contain the value is used; later ranges are ignored
 * even if they also match. One entry is picked with `random(count)`; an empty
 * or missing range consumes no draw and yields the defaults.
 */
export interface RangedTable<E> {
  ranges: RangedBlock<E>[];
}

export interface RangedBlock<E> {
  low: number;
  high: number;
  entries: E[];
}

/**
 * One `start_entry` block. Keys absent from the block are absent here; the
 * engine supplies the original defaults (message "No message.", no title,
 * modifiers 0 to 0, a per-caller default picture).
 *
 * Importer note: the original reads keys from the line after the chosen
 * `start_entry` up to the next `start_entry`, skipping any `range` lines in
 * between. A key repeated within a block keeps the last value.
 */
export interface EventEntry {
  /** `message|...` */
  message?: string;
  /** `title|...` (news headline). */
  title?: string;
  /** `give_random|...`: mail sent to a random player on the day this blurb runs. */
  giveRandom?: string;
  /** `add_log|...`: news line added when that mail is read. `*NAME*`, `*HOME*` are filled in. */
  addLog?: string;
  /** `set_pic|...` as an asset id. */
  picture?: AssetId;
  /** `mod_bp|low|high`: inclusive range, `atoi` of each field (a missing field is 0). */
  modBp?: [number, number];
  /** `mod_luck|low|high`. */
  modLuck?: [number, number];
  /** `mod_turns|low|high`. */
  modTurns?: [number, number];
  /**
   * Expanded only (a remaster addition, not in the legacy format): a news blurb that may
   * run only when this holds (docs/expanded-rules.md 22.5). Classic rules never read it.
   */
  when?: NewsCondition;
}

/**
 * One `add_risk` block of `risks.txt` (legacy/source/COptions.cpp:7-109).
 *
 * Importer note: the original reuses one record for the whole file and only
 * overwrites the keys a block sets, so a key missing from a block inherits the
 * previous block's value. Packs must store the resolved values.
 * Messages may contain `*SIR*`, `*NAME*`, `*PARLOR*` and literal `\n`.
 */
export interface RiskEntry {
  startMessage: string;
  startPicture?: AssetId;
  startBackground?: AssetId;
  /** `normal|...`: label of the safe button. Leading spaces were centring; keep or trim. */
  normalLabel: string;
  /** `risk|...`: label of the gamble button. */
  riskLabel: string;
  normalMessage: string;
  normalPicture?: AssetId;
  normalBackground?: AssetId;
  failMessage: string;
  failPicture?: AssetId;
  failBackground?: AssetId;
  successMessage: string;
  successPicture?: AssetId;
  successBackground?: AssetId;
}

/**
 * One `add_item` block of `soft_sell.txt` or `hard_sell.txt`
 * (legacy/source/COptions.cpp:118-215). The same carry-over rule as risks applies.
 */
export interface SaleItem {
  /** `reference|...`: the article, "a", "an" or "some". */
  article: string;
  name: string;
  /** Dollars. */
  price: number;
}

/** One `addword|bad|good` line of `swear_words.txt` (legacy/source/security.cpp:51-57). */
export interface SwearWord {
  bad: string;
  good: string;
}
