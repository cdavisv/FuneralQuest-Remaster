/**
 * Reader for the 2001 server's save files: `player.dat`, `config.dat` and `system.dat`.
 *
 * The original wrote its structs to disk with one `fwrite` each, so the files are the in-memory
 * layout of a 32-bit Visual C++ build, little-endian, members at their natural alignment (every
 * member is at most 4 bytes wide, so the default 8-byte packing never mattered): `int`, `long`,
 * `time_t` (`_USE_32BIT_TIME_T`, fq.vcxproj) and `in_addr` are 4 bytes, `bool` and `char` are 1,
 * `float` is IEEE single. The offsets below were read from the original headers compiled 32-bit
 * (`offsetof` in the oracle's toolchain, see `test/fixtures/legacy-town/README.md`) and are
 * checked against files written by the original code in `test/saves.test.ts`.
 *
 * Nothing here touches the file system; callers pass bytes. Original text is decoded as the
 * Windows ANSI code page the 2001 server ran on (ISO-8859-1 for 0x00-0x7F and 0xA0-0xFF, the
 * printable Windows-1252 characters for 0x80-0x9F) and is never edited.
 */
import {
  CUSTOM_SIZE,
  type GameSettings,
  type PlayerState,
  type TopSeller,
  type TownState,
} from "@fq/core";

// ----------------------------------------------------------------------- constants

/** `sizeof(player_struct)` on the 32-bit build (player_struct.h:36-87). */
export const LEGACY_PLAYER_SIZE = 1248;
/** `sizeof(player_struct_loader)` (player_struct.h:31-37): 3 ints and 10 chars, padded to 4. */
const PLAYER_LOADER_SIZE = 24;
/** `sizeof(global_struct)` (funeral_file.h:23-72). */
export const LEGACY_CONFIG_SIZE = 21488;
/** `sizeof(global_struct_loader)` (funeral_file.h:15-21). */
const CONFIG_LOADER_SIZE = 4060;
/** `sizeof(sys_struct)` (file_system.h:11-44). */
export const LEGACY_SYSTEM_SIZE = 1624;
/** `sizeof(sys_struct_loader)` (file_system.h:5-10). */
const SYSTEM_LOADER_SIZE = 268;

/** `c_max_coffin_types` (player_struct.h:6); the engine keeps the three that were used. */
const COFFIN_SLOTS = 10;
const TAG_TIERS = 3;

// ----------------------------------------------------------------------- notes

/** Something the importer did not carry across, or changed, or wants the sysop to know. */
export interface LegacyImportNote {
  level: "info" | "warning";
  /** The file the data came from, or "import" for the mapping as a whole. */
  file: "player.dat" | "config.dat" | "system.dat" | "import";
  message: string;
}

/** A value in a save file that the new engine has no place for. Listed, never silently dropped. */
export interface LegacyUnmapped {
  file: "player.dat" | "config.dat" | "system.dat";
  /** The original's member name (`i_port`, `st_admin_email`, ...). */
  field: string;
  /** What the file held, as text. */
  value: string;
  reason: string;
}

export class LegacySaveError extends Error {
  constructor(
    readonly file: "player.dat" | "config.dat" | "system.dat",
    message: string,
  ) {
    super(`${file}: ${message}`);
    this.name = "LegacySaveError";
  }
}

// ----------------------------------------------------------------------- byte access

/** Windows-1252 for 0x80-0x9F (the ISO-8859-1 control range); 0 marks the five undefined bytes. */
const CP1252_HIGH = [
  0x20ac, 0, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152,
  0, 0x017d, 0, 0, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161,
  0x203a, 0x0153, 0, 0x017e, 0x0178,
] as const;

/** Decodes one byte of the original's ANSI text. */
function ansiChar(byte: number): string {
  if (byte >= 0x80 && byte <= 0x9f) {
    const mapped = CP1252_HIGH[byte - 0x80] ?? 0;
    return String.fromCharCode(mapped === 0 ? byte : mapped);
  }
  return String.fromCharCode(byte);
}

/** Reads a NUL-terminated `char[len]` (the bytes after the first NUL are leftovers and ignored). */
export function legacyString(bytes: Uint8Array, offset: number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    const b = bytes[offset + i] ?? 0;
    if (b === 0) break;
    out += ansiChar(b);
  }
  return out;
}

/** True when every byte after the first NUL of a `char[len]` is zero too (no hidden text). */
function tailIsClean(bytes: Uint8Array, offset: number, length: number): boolean {
  let i = 0;
  while (i < length && (bytes[offset + i] ?? 0) !== 0) i++;
  for (; i < length; i++) if ((bytes[offset + i] ?? 0) !== 0) return false;
  return true;
}

class Reader {
  private readonly view: DataView;
  constructor(readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  int(offset: number): number {
    return this.view.getInt32(offset, true);
  }
  bool(offset: number): boolean {
    return (this.bytes[offset] ?? 0) !== 0;
  }
  /** A 32-bit `float`, rounded to six significant digits (0.08f reads as 0.08, not 0.0799999982). */
  float(offset: number): number {
    return Number(this.view.getFloat32(offset, true).toPrecision(6));
  }
  /** A 32-bit `time_t` in seconds, as milliseconds since the epoch. */
  timeMs(offset: number): number {
    return this.int(offset) * 1000;
  }
  str(offset: number, length: number): string {
    return legacyString(this.bytes, offset, length);
  }
  ip(offset: number): string {
    return `${this.bytes[offset]}.${this.bytes[offset + 1]}.${this.bytes[offset + 2]}.${this.bytes[offset + 3]}`;
  }
}

/** Writer used only to lay the original's default values under a short file. */
class Writer {
  readonly bytes: Uint8Array;
  private readonly view: DataView;
  constructor(size: number) {
    this.bytes = new Uint8Array(size);
    this.view = new DataView(this.bytes.buffer);
  }
  int(offset: number, value: number): void {
    this.view.setInt32(offset, value, true);
  }
  bool(offset: number, value: boolean): void {
    this.bytes[offset] = value ? 1 : 0;
  }
  float(offset: number, value: number): void {
    this.view.setFloat32(offset, value, true);
  }
  str(offset: number, value: string): void {
    for (let i = 0; i < value.length; i++) this.bytes[offset + i] = value.charCodeAt(i) & 0xff;
  }
}

// ----------------------------------------------------------------------- player.dat

/** One record of `player.dat`, mapped onto the engine's player. */
export interface LegacyPlayerRecord {
  /** The engine's player for this slot. The slot number is the record's position (`i_index`). */
  player: PlayerState;
  /**
   * `st_password`: stored as plain text in the original (it was compared directly, and shown in
   * the sysop's player editor, dlg_player_edit.cpp:140). The engine keeps no password (the server
   * has account hashes), so the importer decides what to do with it. Never log this.
   */
  password: string;
  /** `last_ip` and `old_ip`, dotted. Not carried (the per-IP rule is gone). */
  lastIp: string;
  oldIp: string;
  /** `b_always` (skips the IP check). Not carried. */
  always: boolean;
}

export interface LegacyPlayerFile {
  versionMajor: number;
  versionMinor: number;
  /** Bytes per record, from the first record's `i_file_size`. */
  recordSize: number;
  records: LegacyPlayerRecord[];
  notes: LegacyImportNote[];
  unmapped: LegacyUnmapped[];
}

/**
 * `player_load` (legacy/source/player_file.cpp:3-92). The file is a run of `player_struct`
 * records and nothing else. The record size is the `i_file_size` of the first record (only
 * `p_play[0]` is stamped on save, `player_file.cpp:96-98`, so only the first header is
 * meaningful); `player_load` reads that many bytes per record into a `player_struct` and a
 * partial record at the end is ignored (`fread` returns 0, `:44-47`). A record from an older,
 * smaller layout leaves the rest of the struct as it was from the previous read in the original
 * (an accident); here the missing tail reads as zero and is reported.
 *
 * Applied as `player_load` applies them: `i_index` is set to the record's position (`:63`), and a
 * record with `i_hp_max == 0` (a 0.62 or earlier save) is upgraded to 10 hit points, strength 2
 * and `b_can_be_attacked` (`:64-72`).
 */
export function parsePlayerDat(data: Uint8Array): LegacyPlayerFile {
  if (data.length < PLAYER_LOADER_SIZE) {
    throw new LegacySaveError(
      "player.dat",
      `only ${data.length} bytes; a save has at least one 1248-byte record`,
    );
  }
  const head = new Reader(data);
  const versionMajor = head.int(0);
  const versionMinor = head.int(4);
  const recordSize = head.int(8);
  if (recordSize < PLAYER_LOADER_SIZE || recordSize > LEGACY_PLAYER_SIZE) {
    throw new LegacySaveError(
      "player.dat",
      `record size ${recordSize} (version ${versionMajor}.${versionMinor}) is not one this reader knows (24 to ${LEGACY_PLAYER_SIZE} bytes); the file is damaged or from a newer server`,
    );
  }
  const notes: LegacyImportNote[] = [];
  const unmapped: LegacyUnmapped[] = [];
  if (recordSize < LEGACY_PLAYER_SIZE) {
    notes.push({
      level: "warning",
      file: "player.dat",
      message: `records are ${recordSize} bytes (${LEGACY_PLAYER_SIZE} in the last version): version ${versionMajor}.${versionMinor} predates some fields, which are read as 0`,
    });
  }
  const count = Math.floor(data.length / recordSize);
  const trailing = data.length - count * recordSize;
  if (trailing > 0) {
    notes.push({
      level: "warning",
      file: "player.dat",
      message: `${trailing} bytes at the end of the file are a partial record; the original ignored them too`,
    });
  }
  const records: LegacyPlayerRecord[] = [];
  let upgraded = 0;
  let badIndex = 0;
  let hiddenTags = 0;
  let upgradeSpace = 0;
  let bufferUsed = 0;
  let textTails = 0;
  for (let slot = 0; slot < count; slot++) {
    const full = new Uint8Array(LEGACY_PLAYER_SIZE);
    full.set(data.subarray(slot * recordSize, (slot + 1) * recordSize));
    const r = new Reader(full);
    if (r.int(340) !== slot) badIndex++;
    for (const [off, len] of [
      [22, 30],
      [52, 30],
      [82, 30],
      [112, 30],
      [142, 50],
    ] as const) {
      if (!tailIsClean(full, off, len)) textTails++;
    }
    const tags = Array.from({ length: COFFIN_SLOTS }, (_, i) => r.int(236 + 4 * i));
    if (tags.slice(TAG_TIERS).some((n) => n !== 0)) hiddenTags++;
    if (full.subarray(1152, 1248).some((b) => b !== 0)) upgradeSpace++;
    if (full.subarray(12, 22).some((b) => b !== 0)) bufferUsed++;
    let hpMax = r.int(324);
    let hp = r.int(328);
    let strength = r.int(320);
    let canBeAttacked = r.bool(336);
    if (hpMax === 0) {
      // player_file.cpp:64-72
      hpMax = 10;
      hp = 10;
      canBeAttacked = true;
      strength = 2;
      upgraded++;
    }
    const player: PlayerState = {
      id: slot,
      active: r.bool(192), // b_active
      name: r.str(22, 30), // st_name
      logon: r.str(52, 30), // st_logon
      parlor: r.str(112, 30), // st_funeral_name
      email: r.str(142, 50), // st_email
      wantEmail: r.bool(193),
      male: r.bool(194),
      lastLogon: r.timeMs(208),
      lastPacket: r.timeMs(212),
      accountCreated: r.timeMs(308),
      // The original never recorded the day an account was made; 0 means "before the grace
      // period fix existed", so the 0-BP rule treats the player by their last log-on day alone.
      dayCreated: 0,
      turns: r.int(216),
      money: r.int(220),
      bp: r.int(224), // i_exp
      bpToday: r.int(292), // i_sp
      karma: r.int(228),
      rating: r.int(232),
      tags: tags.slice(0, TAG_TIERS),
      incinerator: r.bool(276),
      transportation: r.int(280),
      plots: r.int(284),
      dayLastLoggedOn: r.int(288),
      luck: r.int(296),
      yangsSent: r.int(304),
      psych: r.int(312),
      kickedOutOfYangs: r.bool(316),
      strength,
      hpMax,
      hp,
      playerFights: r.int(332),
      canBeAttacked,
      policeProtected: r.bool(344),
      custom: Array.from({ length: CUSTOM_SIZE }, (_, i) => r.int(348 + 4 * i)),
      tagsReceivedToday: r.int(1148),
      mail: [],
    };
    records.push({
      player,
      password: r.str(82, 30),
      lastIp: r.ip(196),
      oldIp: r.ip(200),
      always: r.bool(300),
    });
  }
  if (upgraded > 0) {
    notes.push({
      level: "info",
      file: "player.dat",
      message: `${upgraded} record(s) from 0.62 or earlier had no hit points; given 10 hit points, strength 2 and "can be attacked", as the original's loader did (player_file.cpp:64-72)`,
    });
  }
  if (badIndex > 0) {
    notes.push({
      level: "info",
      file: "player.dat",
      message: `${badIndex} record(s) had an i_index different from their position in the file; the position is used, as the original did (player_file.cpp:63)`,
    });
  }
  if (hiddenTags > 0) {
    unmapped.push({
      file: "player.dat",
      field: "a_coffins[3..9]",
      value: `non-zero in ${hiddenTags} record(s)`,
      reason: "the game only uses three casket tiers (wood, silver, gold)",
    });
  }
  if (upgradeSpace > 0) {
    unmapped.push({
      file: "player.dat",
      field: "upgrade_space",
      value: `non-zero in ${upgradeSpace} record(s)`,
      reason: "reserved padding in the original, never read by any version of the game",
    });
  }
  if (bufferUsed > 0) {
    unmapped.push({
      file: "player.dat",
      field: "buffer",
      value: `non-zero in ${bufferUsed} record(s)`,
      reason: "reserved padding in the original's record header",
    });
  }
  if (textTails > 0) {
    notes.push({
      level: "info",
      file: "player.dat",
      message: `${textTails} text field(s) held leftover bytes after the first NUL; only the text before it was ever shown, and only that is imported`,
    });
  }
  if (records.length > 0) {
    unmapped.push({
      file: "player.dat",
      field: "last_ip, old_ip, b_always",
      value: `${records.length} record(s)`,
      reason:
        "the per-IP log-on rule is dropped by design (docs/classic-rules.md section 9); no addresses are kept",
    });
    unmapped.push({
      file: "player.dat",
      field: "t_last_packet",
      value: "carried, but sessions are not",
      reason:
        "nobody is online after an import; the mail queue (data/mail/*.dat) is reported separately",
    });
  }
  return { versionMajor, versionMinor, recordSize, records, notes, unmapped };
}

// ----------------------------------------------------------------------- config.dat

/** The town-level values of `config.dat` (`global_struct`) that the engine has. */
export interface LegacyConfig {
  versionMajor: number;
  versionMinor: number;
  /** `i_game_age`: the day. */
  day: number;
  /** `t_last_maint`, ms, or null when the file never recorded one. */
  lastMaintenance: number | null;
  settings: Pick<
    GameSettings,
    | "turnsPerDay"
    | "startingMoney"
    | "experiencePerDay"
    | "startingKarma"
    | "startingRating"
    | "startingLuck"
    | "startingHp"
    | "startingStrength"
    | "startingWood"
    | "startingSilver"
    | "startingGold"
    | "startingPlots"
    | "casketSp"
    | "plotSp"
    | "yangsPerDay"
    | "risk"
    | "tournamentActive"
    | "tournamentDays"
    | "bonusExp"
    | "bonusLuck"
    | "tradeBonus"
    | "visitsPerDay"
    | "normalOdds"
    | "luckOdds"
    | "scriptOdds"
    | "tagsReceivablePerDay"
    | "nameChangeCost"
  >;
  /** `st_news`: the sysop's message on the log-on screen. */
  serverNews: string;
  /** Yesterday's top seller (`b_top_old_exists` and friends), or null. */
  topYesterday: TopSeller | null;
  notes: LegacyImportNote[];
  unmapped: LegacyUnmapped[];
}

/** The values `file_config_load` sets before it reads the file (funeral_file.cpp:20-52). */
function configDefaults(): Uint8Array {
  const w = new Writer(LEGACY_CONFIG_SIZE);
  w.int(284, 5); // i_experience_per_day
  w.int(280, 500); // i_starting_money
  w.int(276, 15); // i_turns_per_day
  w.int(16304, 0); // i_starting_gold
  w.int(16300, 2); // i_starting_silver
  w.int(16296, 5); // i_starting_wood
  w.int(16288, 50); // i_starting_karma
  w.int(16292, 40); // i_starting_rating
  w.int(16324, 1); // a_casket_sp[wood]
  w.int(16328, 2); // [silver]
  w.int(16332, 3); // [gold]
  w.int(16364, 1); // i_plot_sp
  w.int(16888, 50); // i_starting_luck
  w.int(17392 + 4, 1); // i_yangs_per_day
  w.int(17400, 50); // i_risk
  w.bool(17404, false); // b_tourn_active
  w.int(17408, 30); // i_tourn_days
  w.int(17420, 20); // i_bonus_exp
  w.int(17416, 25); // i_bonus_luck
  w.int(17412, 25); // i_trade_bonus
  w.int(17424, 2); // i_visits_per_day
  w.int(17428, 10); // i_starting_hp
  w.int(17432, 3); // i_starting_strength
  w.str(17436, "(none)"); // st_admin_email
  w.float(17488, 0.08); // f_normal_odds
  w.float(17392, 0.08); // f_luck_odds
  w.float(17492, 0.05); // f_script_odds
  w.int(17496, 1); // i_tags_recievable_per_day
  w.int(17500, 1); // i_name_change_cost
  return w.bytes;
}

/**
 * Lays a save file over the defaults the original loaded it onto: `fread(&glo,
 * glo_loader.i_file_size, 1, fp)` overwrites only the first `i_file_size` bytes of a struct that
 * `file_config_load` had already filled with its defaults (funeral_file.cpp:20-52, 78-82), so a
 * member added by a later version keeps its default when an older file lacks it.
 */
function overlay(
  base: Uint8Array,
  data: Uint8Array,
  file: "config.dat" | "system.dat",
  loader: number,
  fullSize: number,
): Uint8Array {
  if (data.length < loader) {
    throw new LegacySaveError(
      file,
      `only ${data.length} bytes; the original needs at least ${loader} to read the header`,
    );
  }
  const head = new Reader(data);
  const size = head.int(8);
  if (size < 12 || size > fullSize) {
    throw new LegacySaveError(
      file,
      `size field ${size} (version ${head.int(0)}.${head.int(4)}) is not one this reader knows (12 to ${fullSize}); the file is damaged or from a newer server`,
    );
  }
  const out = new Uint8Array(base);
  out.set(data.subarray(0, Math.min(size, data.length)));
  return out;
}

/**
 * `file_config_load` (legacy/source/funeral_file.cpp:11-145): the town-level numbers. Includes
 * the upgrades it applied to files of versions 0.06 to 0.98 (`:90-141`), which restore defaults
 * for members those versions did not have.
 *
 * Not carried, and listed in `unmapped`: the sysop's karma and rating strings (the content pack
 * supplies the text), the admin e-mail, and the members the original reserved but never used.
 */
export function parseConfigDat(data: Uint8Array): LegacyConfig {
  const bytes = overlay(
    configDefaults(),
    data,
    "config.dat",
    CONFIG_LOADER_SIZE,
    LEGACY_CONFIG_SIZE,
  );
  const r = new Reader(bytes);
  const major = r.int(0);
  const minor = r.int(4);
  const notes: LegacyImportNote[] = [];
  const set = (offset: number, value: number, float = false): void => {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (float) v.setFloat32(offset, value, true);
    else v.setInt32(offset, value, true);
  };
  // funeral_file.cpp:90-141, in the original's order.
  const oldDefaults = (...members: string[]): void => {
    notes.push({
      level: "info",
      file: "config.dat",
      message: `version ${major}.${minor} predates ${members.join(", ")}; the original's defaults were used (funeral_file.cpp:90-141)`,
    });
  };
  if (major === 0 && (minor === 6 || minor === 62)) {
    set(17424, 2);
    set(17420, 20);
    set(17428, 10);
    set(17432, 3);
    set(17488, 0.08, true);
    set(17392, 0.08, true);
    set(17492, 0.05, true);
    set(17496, 1);
    oldDefaults(
      "visits per day",
      "bonus BP",
      "starting hit points and strength",
      "event odds",
      "tags per day",
    );
  }
  if (major === 0 && (minor === 70 || minor === 72 || minor === 78)) {
    set(17420, 20);
    set(17428, 10);
    set(17432, 3);
    set(17488, 0.08, true);
    set(17392, 0.08, true);
    set(17492, 0.05, true);
    set(17496, 1);
    oldDefaults("bonus BP", "starting hit points and strength", "event odds", "tags per day");
  }
  if (major === 0 && minor === 79) {
    set(17492, 0.05, true);
    set(17496, 1);
    oldDefaults("script odds", "tags per day");
  }
  if (major === 0 && (minor === 90 || minor === 91 || minor === 92)) {
    set(17496, 1);
    oldDefaults("tags per day");
  }
  if (major === 0 && minor < 99) set(17500, 1); // i_name_change_cost
  const r2 = new Reader(bytes);
  const tMaint = r2.int(16312);
  const unmapped: LegacyUnmapped[] = [];
  const note = (field: string, value: string, reason: string): void => {
    unmapped.push({ file: "config.dat", field, value, reason });
  };
  const karmaStrings = countStrings(bytes, 288, 100, 80);
  const ratingStrings = countStrings(bytes, 8288, 100, 80);
  if (karmaStrings > 0)
    note(
      "a_st_karma",
      `${karmaStrings} string(s)`,
      "the original reloaded these from karma.txt at every start (funeral_file.cpp:84-85); the town's content pack supplies the karma titles",
    );
  if (ratingStrings > 0)
    note(
      "a_st_rating",
      `${ratingStrings} string(s)`,
      "reloaded from ratings.txt at every start; the town's content pack supplies the rating titles",
    );
  note(
    "st_admin_email",
    JSON.stringify(r2.str(17436, 50)),
    "the sysop's contact address; put it in the town's server news if players should see it",
  );
  for (const [field, offset] of [
    ["i_holder_position", 268],
    ["i_craphold", 16316],
  ] as const) {
    const v = r2.int(offset);
    if (v !== 0) note(field, String(v), "unused placeholder in the original");
  }
  if (r2.bool(272)) note("b_extra_crap", "true", "unused placeholder in the original");
  for (let i = 3; i < COFFIN_SLOTS; i++) {
    const v = r2.int(16324 + 4 * i);
    if (v !== 0) note(`a_casket_sp[${i}]`, String(v), "the game only uses three casket tiers");
  }
  if (bytes.subarray(17504, 21488).some((b) => b !== 0)) {
    note("st_buffer", "non-zero", "reserved padding in the original");
  }
  const topExists = r2.bool(16368);
  const topYesterday: TopSeller | null = topExists
    ? {
        name: r2.str(16369, 255),
        parlor: r2.str(16632, 255),
        bp: r2.int(16624),
        id: r2.int(16628),
      }
    : null;
  return {
    versionMajor: major,
    versionMinor: minor,
    day: r2.int(16308),
    lastMaintenance: tMaint === 0 ? null : tMaint * 1000,
    settings: {
      turnsPerDay: r2.int(276),
      startingMoney: r2.int(280),
      experiencePerDay: r2.int(284),
      startingKarma: r2.int(16288),
      startingRating: r2.int(16292),
      startingLuck: r2.int(16888),
      startingHp: r2.int(17428),
      startingStrength: r2.int(17432),
      startingWood: r2.int(16296),
      startingSilver: r2.int(16300),
      startingGold: r2.int(16304),
      startingPlots: r2.int(16320),
      casketSp: [r2.int(16324), r2.int(16328), r2.int(16332)],
      plotSp: r2.int(16364),
      yangsPerDay: r2.int(17396),
      risk: r2.int(17400),
      tournamentActive: r2.bool(17404),
      tournamentDays: r2.int(17408),
      bonusExp: r2.int(17420),
      bonusLuck: r2.int(17416),
      tradeBonus: r2.int(17412),
      visitsPerDay: r2.int(17424),
      normalOdds: r2.float(17488),
      luckOdds: r2.float(17392),
      scriptOdds: r2.float(17492),
      tagsReceivablePerDay: r2.int(17496),
      nameChangeCost: r2.int(17500),
    },
    serverNews: r2.str(16892, 500),
    topYesterday,
    notes,
    unmapped,
  };
}

function countStrings(bytes: Uint8Array, offset: number, count: number, length: number): number {
  let n = 0;
  for (let i = 0; i < count; i++) if ((bytes[offset + i * length] ?? 0) !== 0) n++;
  return n;
}

// ----------------------------------------------------------------------- system.dat

/** The server-setup values of `system.dat` (`sys_struct`) the engine has, and the rest listed. */
export interface LegacySystem {
  versionMajor: number;
  versionMinor: number;
  settings: Pick<GameSettings, "maintDelete" | "maxPlayers" | "inactiveDays" | "swearFilter">;
  notes: LegacyImportNote[];
  unmapped: LegacyUnmapped[];
}

/** The values `file_sys_load` sets before it reads the file (file_system.cpp:24-42). */
function systemDefaults(): Uint8Array {
  const w = new Writer(LEGACY_SYSTEM_SIZE);
  w.int(16, 80); // i_port
  w.int(20, 1); // i_anon_kick_minutes
  w.int(12, 4); // i_player_kick_minutes
  w.int(24, 30); // i_auto_save_minutes
  w.bool(293, true); // b_sound
  w.bool(556, true); // b_ip_check
  w.bool(557, true); // b_advertise
  w.str(678, "Vanilla settings.");
  w.str(558, "demo");
  w.str(618, "demo");
  w.str(933, "FQ Original");
  w.bool(1032, true); // b_maint_delete
  w.int(1028, 800); // i_max_players
  w.int(1036, 15); // i_inactive_days
  w.bool(1040, true); // b_swear_filter
  w.bool(1121, true); // b_sapi_enabled
  return w.bytes;
}

/**
 * `file_sys_load` (legacy/source/file_system.cpp:19-83). Four of its values are Game Settings in
 * the new engine (`maintDelete`, `maxPlayers`, `inactiveDays`, `swearFilter`). The rest are
 * machine and licence settings of the Windows program and are listed, not carried.
 */
export function parseSystemDat(data: Uint8Array): LegacySystem {
  const bytes = overlay(
    systemDefaults(),
    data,
    "system.dat",
    SYSTEM_LOADER_SIZE,
    LEGACY_SYSTEM_SIZE,
  );
  const r = new Reader(bytes);
  const major = r.int(0);
  const minor = r.int(4);
  const notes: LegacyImportNote[] = [];
  // file_system.cpp:77-80: versions before 0.77 had no speech setting.
  // (b_sapi_enabled defaults to true there; it is a machine setting and is listed below, not read.)
  const unmapped: LegacyUnmapped[] = [];
  const note = (field: string, value: string, reason: string): void => {
    unmapped.push({ file: "system.dat", field, value, reason });
  };
  note("i_port", String(r.int(16)), "the new server's port is FQ_PORT");
  note(
    "i_player_kick_minutes",
    String(r.int(12)),
    "the idle time-out is FQ_IDLE_TIMEOUT_MINUTES (15 by default, not 4)",
  );
  note("i_anon_kick_minutes", String(r.int(20)), "there are no anonymous connections to time out");
  note("i_auto_save_minutes", String(r.int(24)), "every step is saved as it happens");
  note(
    "b_ip_check",
    String(r.bool(556)),
    "the per-IP log-on rule is dropped by design (docs/classic-rules.md section 9)",
  );
  note("i_max_online", String(r.int(1124)), "the new server has no cap on players online at once");
  note(
    "st_license_game_name",
    JSON.stringify(r.str(933, 80)),
    "the town's name is chosen with --name",
  );
  note(
    "st_license_logon / st_license_password / st_license_description",
    "(licence data)",
    "the original's licence service; not used",
  );
  note(
    "b_advertise, b_sound, b_sapi_enabled, b_extra_debug, b_log, st_local_ip, st_path, st_force_ip",
    "(machine settings)",
    "settings of the Windows program (master-server listing, sounds, speech, logging, addresses)",
  );
  note(
    "t_boot_time, i_logons_today, i_logons_total, i_hits_today, i_hits_total",
    `${r.int(1016)} logons in total`,
    "run-time statistics of the old process",
  );
  return {
    versionMajor: major,
    versionMinor: minor,
    settings: {
      maintDelete: r.bool(1032),
      maxPlayers: r.int(1028),
      inactiveDays: r.int(1036),
      swearFilter: r.bool(1040),
    },
    notes,
    unmapped,
  };
}

// ----------------------------------------------------------------------- the town

export interface LegacyFiles {
  /** `data\player.dat`, or undefined when the old server never saved one (no players). */
  playerDat?: Uint8Array | undefined;
  /** `data\config.dat`; without it the original's defaults and day 0 (a brand-new game). */
  configDat?: Uint8Array | undefined;
  /** `system.dat` (next to the program, not in `data\`); without it the original's defaults. */
  systemDat?: Uint8Array | undefined;
}

/** What a set of 2001 save files becomes in a Classic town. */
export interface LegacyTownImport {
  /** `glo.i_game_age`. */
  day: number;
  lastMaintenance: number | null;
  /** Game Settings from `config.dat` and `system.dat`, every key set. */
  settings: LegacyConfig["settings"] & LegacySystem["settings"];
  serverNews: string;
  topYesterday: TopSeller | null;
  /** Every record of `player.dat`, deleted ones included (their slots are kept, as the original kept them). */
  players: LegacyPlayerRecord[];
  notes: LegacyImportNote[];
  unmapped: LegacyUnmapped[];
}

/** Maps the three files onto a Classic town. Throws `LegacySaveError` for a damaged file. */
export function mapLegacyTown(files: LegacyFiles): LegacyTownImport {
  return buildTown(files, [], []);
}

function buildTown(
  files: LegacyFiles,
  notes: LegacyImportNote[],
  unmapped: LegacyUnmapped[],
): LegacyTownImport {
  let config: LegacyConfig;
  if (files.configDat) {
    config = parseConfigDat(files.configDat);
  } else {
    config = parseConfigDat(configDefaultsFile());
    notes.push({
      level: "warning",
      file: "config.dat",
      message:
        "no config.dat: the town starts on day 0 with the original's default settings (the original did the same for a new game, funeral_file.cpp:20-62)",
    });
  }
  let system: LegacySystem;
  if (files.systemDat) {
    system = parseSystemDat(files.systemDat);
  } else {
    system = parseSystemDat(systemDefaultsFile());
    notes.push({
      level: "info",
      file: "system.dat",
      message:
        "no system.dat: the original's server defaults are used (800 players, delete idle accounts after 15 days, swear filter on)",
    });
  }
  let players: LegacyPlayerRecord[] = [];
  let playerFile: LegacyPlayerFile | null = null;
  if (files.playerDat) {
    playerFile = parsePlayerDat(files.playerDat);
    players = playerFile.records;
  } else {
    notes.push({
      level: "warning",
      file: "player.dat",
      message:
        "no player.dat: the town has no players (the original did the same, player_file.cpp:11-15)",
    });
  }
  notes.push(...config.notes, ...system.notes, ...(playerFile?.notes ?? []));
  unmapped.push(...config.unmapped, ...system.unmapped, ...(playerFile?.unmapped ?? []));
  const versions = [
    `config.dat ${config.versionMajor}.${config.versionMinor}`,
    `system.dat ${system.versionMajor}.${system.versionMinor}`,
    ...(playerFile ? [`player.dat ${playerFile.versionMajor}.${playerFile.versionMinor}`] : []),
  ];
  notes.push({ level: "info", file: "import", message: `save versions: ${versions.join(", ")}` });
  return {
    day: config.day,
    lastMaintenance: config.lastMaintenance,
    settings: { ...config.settings, ...system.settings },
    serverNews: config.serverNews,
    topYesterday: config.topYesterday,
    players,
    notes,
    unmapped,
  };
}

/** A header-only `config.dat` of the current layout whose body is all defaults. */
function configDefaultsFile(): Uint8Array {
  const b = new Uint8Array(CONFIG_LOADER_SIZE);
  new DataView(b.buffer).setInt32(8, 12, true);
  return b;
}

function systemDefaultsFile(): Uint8Array {
  const b = new Uint8Array(SYSTEM_LOADER_SIZE);
  new DataView(b.buffer).setInt32(8, 12, true);
  return b;
}

/**
 * Puts the imported values into a fresh Classic `TownState` (as `createTown` made it: its seed,
 * its settings defaults for anything the files do not carry). Sessions, news pages, deeds and the
 * mail queues stay empty: the original did not save sessions, and its news, deeds and mail are
 * separate files this importer reports but does not read.
 */
export function applyLegacyTown(base: TownState, imported: LegacyTownImport): TownState {
  return {
    ...base,
    settings: { ...base.settings, ...imported.settings },
    day: imported.day,
    lastMaintenance: imported.lastMaintenance,
    players: imported.players.map((r) => r.player),
    sessions: {},
    topYesterday: imported.topYesterday,
    serverNews: imported.serverNews,
  };
}
