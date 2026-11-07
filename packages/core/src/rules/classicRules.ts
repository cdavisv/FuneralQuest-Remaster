import type { AssetId } from "@fq/protocol";
import type { ExpandedRules } from "./expandedRules.js";

/**
 * The sysop's Game Settings and Server Setup values. A town copies these from
 * `ClassicRules.settings` at creation and the sysop may change them later.
 * Defaults are legacy/source/funeral_file.cpp:22-52 and file_system.cpp:36-38.
 */
export interface GameSettings {
  /** `i_turns_per_day` */
  turnsPerDay: number;
  /** `i_starting_money` */
  startingMoney: number;
  /** `i_experience_per_day`: unused since the daily grant was commented out (commands_newday.cpp:45-48). */
  experiencePerDay: number;
  startingKarma: number;
  startingRating: number;
  startingLuck: number;
  startingHp: number;
  startingStrength: number;
  /** Starting tags and plots are defined but never applied (new_user.cpp:234-239). */
  startingWood: number;
  startingSilver: number;
  startingGold: number;
  startingPlots: number;
  /** BP per casket tier for the dead `command_accept` sale (commands_customer.cpp:113-115). */
  casketSp: [number, number, number];
  /** `i_plot_sp` */
  plotSp: number;
  /** `i_yangs_per_day` */
  yangsPerDay: number;
  /** `i_risk`: BP won or lost when a risk is taken. */
  risk: number;
  tournamentActive: boolean;
  tournamentDays: number;
  /** `i_bonus_exp`: BP for the top seller and top parlor. */
  bonusExp: number;
  /** `i_bonus_luck` */
  bonusLuck: number;
  /** `i_trade_bonus`: bonus for finishing within $100 of the limit. */
  tradeBonus: number;
  visitsPerDay: number;
  /** `f_normal_odds`: chance of a random event per Wait for Customer. */
  normalOdds: number;
  /** `f_luck_odds`: chance of a risk. */
  luckOdds: number;
  /** `f_script_odds`: chance of a script event. */
  scriptOdds: number;
  tagsReceivablePerDay: number;
  nameChangeCost: number;
  /** `sys.b_maint_delete`: delete players with 0 BP at midnight (see `fixes.zeroBpGracePeriod`). */
  maintDelete: boolean;
  /** `sys.i_max_players` */
  maxPlayers: number;
  /** `sys.i_inactive_days` */
  inactiveDays: number;
  /** `sys.b_swear_filter` (file_system.cpp:39): replace bad words in names and chat. */
  swearFilter: boolean;
}

/** Tunables of the town places (bank, Di-Mart, Spirit University, Yang's). */
export interface PlaceRules {
  /** `C_WOOD/SILVER/GOLD_EXCHANGE_VALUE` (commands_bank.cpp:36-38), by tier. */
  tagValues: [number, number, number];
  /** Prices in `script/store_security.c:6-8` and `store_supplies.c:9`, in gold tags. */
  store: {
    smokeDetector: number;
    safe: number;
    padlock: number;
    lockpick: number;
    /** `C_CUSTOM_PADLOCK_STRENGTH` of a new padlock (store_security.c). */
    padlockStrength: number;
  };
  /** commands_spirit.cpp:139-151, 238. */
  university: {
    psychBase: number;
    psychPerLevel: number;
    /** `int(hp_max * 1.2f)` */
    hpCostFactor: number;
    strengthCostFactor: number;
    hpGain: { min: number; max: number };
    strengthGain: number;
  };
  /** commands_yangs.cpp:13-33 and the hard-coded numbers of the handlers. */
  yangs: {
    dragon: { cost: number; luck: number; onlyBelowLuck: number };
    sparrow: { cost: number; luck: number };
    tiger: { cost: number; luck: number };
    /** The news line is chosen when `random(newsOdds) == 1` (:312). */
    newsOdds: number;
  };
}

export interface HearseRule {
  /** Gold tags. */
  price: number;
  bonusTurns: number;
  picture?: AssetId;
}

/** `get_random_yes_no(level * perLevel + base, weight)` gated on `psych > minAbove`. */
export interface PsychCheck {
  /** The check runs only when psych is greater than this. -1 means always. */
  minAbove: number;
  perLevel: number;
  base: number;
}

/** A mood or cheapness change `base + frandom(range)`. */
export interface Nudge {
  base: number;
  range: number;
}

/**
 * Deliberate gameplay bug and exploit fixes from docs/classic-rules.md section
 * 9. `true` means fixed, the default; parity tests set them to `false` to
 * reproduce the original. Original content is never altered on grounds of
 * taste, so nothing here covers it.
 */
export interface ClassicFixes {
  /** Show the new-player welcome (commands_newday.cpp:88 tests the day after it was overwritten). */
  newPlayerWelcome: boolean;
  /** Show the police patrol line (commands_newday.cpp:70 tests the flag after clearing it). */
  policeNewDayMessage: boolean;
  /** Give new players a grace period before 0-BP and inactivity deletion (maint.cpp:279-301). */
  zeroBpGracePeriod: boolean;
  /** Run maintenance once per missed day instead of once (maint.cpp:418-439). */
  catchUpMissedDays: boolean;
  /** Stop hearse re-buys granting turns again and downgrades paying gold (command_store.cpp:176-204). For the store module. */
  hearseRebuy: boolean;
  /** Treat a disconnect during a battle as a loss (online_util.cpp:135-156). For the battle module. */
  battleDisconnect: boolean;
  /**
   * Check again, before picking the lock, stealing or attacking, that the
   * rival is still offline and unprotected. The original checked only at the
   * door (commands_comp.cpp:224-251), so a rival who logged on meanwhile could
   * still be robbed or attacked.
   */
  visitTargetRecheck: boolean;
  /**
   * Read past a Continue stop that has nothing before it (the first packet of
   * a news blurb's gift mail, maint.cpp:33-95). The original showed the desk
   * with only a Continue button and applied the gift at the next click
   * (commands_main.cpp:89-108, broadcast.cpp:42-50); fixed, the gift is read
   * at once and the player is spared one empty click.
   */
  emptyMailStop: boolean;
  /**
   * Cancel on the library's Old Papers prompt goes back to the library. The
   * original read the client's abort marker "12ABORT12" with `atoi` as day 12
   * (commands_spirit.cpp:393) and showed that day's paper, or "You desperately
   * hunt around for anything dealing with a day 12 but fail."
   */
  oldPapersCancel: boolean;
}

/** Visits and battle numbers (legacy/source/commands_comp.cpp, commands_battle.cpp). */
export interface PvpRules {
  /** Each lockpick weakens a padlock by `random_range(min, max)` (commands_comp.cpp:444). */
  lockpickDamage: { min: number; max: number };
  /** Steal takes up to this many tags of one random type (commands_comp.cpp:547). */
  stealMax: number;
  /** A won battle takes up to this many tags (commands_battle.cpp:409). */
  battleStealMax: number;
  /** The defender misses when `random(n) == 0` (commands_battle.cpp:300). */
  defenderMissOneIn: number;
  /** The attacker soul-smashes for double damage when `random(n) == 0` (commands_battle.cpp:349). */
  doubleDamageOneIn: number;
  /** Shares of the loser's total BP (figure_battle_bp, commands_battle.cpp:522-543). */
  attackerWinGain: number;
  attackerWinLoss: number;
  defenderWinGain: number;
  defenderWinLoss: number;
}

/**
 * Lengths of text players type. The Flash fields set no limit the export
 * shows, so these are new; the guard rejects longer text.
 */
export interface TextLimits {
  mail: number;
  announcement: number;
  battleQuote: number;
  chat: number;
  nameSearch: number;
}

/** The two rulesets on one engine (docs/expanded-rules.md section 1). */
export type RulesetId = "classic" | "expanded";

/**
 * Every tunable of a ruleset. Classic fills every field from the original;
 * Expanded (`rules/expandedRules.ts`) starts from Classic, changes some
 * numbers and adds `expanded`. Code that differs between the rulesets checks
 * `rules.expanded`, which is undefined under `CLASSIC_RULES`, so Expanded code
 * paths cannot run in a Classic town.
 */
export interface ClassicRules {
  ruleset: RulesetId;
  /** Present only in the Expanded ruleset. */
  expanded?: ExpandedRules;
  settings: GameSettings;
  /** online_struct.h:17-19, indexed by casket tier. */
  casketPrices: [number, number, number];
  /** commands_complicated.cpp:40: `int(float(price) * 0.0064f)`. */
  bpMultiplier: number;
  /** Bonus for landing exactly on the limit (commands_complicated.cpp:49). */
  perfectSaleBonus: number;
  /** Extra on top of the trade bonus for landing within half the closeness (:61). */
  closeBonusExtra: number;
  /** `i_closeness` (:44): the trade bonus applies within this many dollars, the extra within half. */
  closeness: number;
  /** Sales above this many BP are announced on the TV (:85). */
  bigSaleTv: number;
  /** Mood at or above which Guilt and Sympathy are interrupted and refusals walk out. */
  walkoutMood: number;
  /** Over the limit with mood above this, the customer leaves (:616, :809, :1212). */
  overLimitLeaveMood: number;
  softRefuseMood: Nudge;
  overLimitMood: Nudge;
  hardRefuseMood: Nudge;
  upgradeRefuseMood: Nudge;
  /** Cheapness above this always refuses Hard Sell and upgrades (:731, :1135). */
  hardRefuseCheapness: number;
  /** Soft Sell acceptance line thresholds on the mood before the sale (:592-611). */
  softAcceptMoods: [number, number, number, number];
  /** Hard Sell and upgrade acceptance turns sour at this mood (:791, :1194). */
  calmAcceptBelow: number;
  guiltMood: Nudge;
  guiltLovedMood: Nudge;
  guiltCheapness: Nudge;
  sympathyMood: Nudge;
  sympathyNotLovedMood: Nudge;
  sympathyCheapness: Nudge;
  /** BP the rival gets by mail when a customer walks: `min + random(range)` (:192). */
  rivalBp: { min: number; range: number };
  /** Arrival analysis (commands_complicated.cpp:331-413), weight for every check. */
  psychWeight: number;
  psych: {
    resistance: PsychCheck;
    mood: PsychCheck;
    doubleLimit: PsychCheck;
    estimate: PsychCheck;
    halveResistance: PsychCheck;
    halveMood: PsychCheck;
  };
  /** Declining a risk pays `random_range(min, max)` BP (commands_customer_risk.cpp:40). */
  riskDecline: { min: number; max: number };
  /** Luck weight for taking a risk (:148). */
  riskLuckWeight: number;
  /** Luck is kept in this range (funeral_util.cpp:90). */
  luckMin: number;
  luckMax: number;
  /** Shares of the bonus for the 1st, 2nd and 3rd parlors (maint.cpp:221-256). */
  topParlorShares: [number, number, number];
  /** transportation.cpp:22-70 */
  hearses: HearseRule[];
  places: PlaceRules;
  /** new_user.cpp:42-191 */
  newPlayer: {
    nameMin: number;
    nameMax: number;
    logonMin: number;
    logonMax: number;
    parlorMin: number;
    parlorMax: number;
    passwordMin: number;
    passwordMax: number;
    emailMin: number;
    emailMax: number;
  };
  /** Days a new player is safe from 0-BP and inactivity deletion when the fix is on. */
  zeroBpGraceDays: number;
  /** Mailed rewards (luck, BP) apply when the mail is read, as in the original. */
  mailRewardsOnDelivery: boolean;
  /**
   * Host option: also run the swear filter over text the original left
   * unfiltered (mail and Yang's fortunes). Classic leaves it off, as the
   * original did; Expanded turns it on. Announcements, chat and battle quotes
   * are always filtered, as the original did (commands_news.cpp:180,
   * commands_bar.cpp:284-380, commands_battle.cpp:571, 630); this flag never
   * changes that. Whether a town filters at all is the sysop's
   * `settings.swearFilter`.
   */
  filterUserText: boolean;
  pvp: PvpRules;
  textLimits: TextLimits;
  fixes: ClassicFixes;
}

export const CLASSIC_SETTINGS: GameSettings = {
  turnsPerDay: 15,
  startingMoney: 500,
  experiencePerDay: 5,
  startingKarma: 50,
  startingRating: 40,
  startingLuck: 50,
  startingHp: 10,
  startingStrength: 3,
  startingWood: 5,
  startingSilver: 2,
  startingGold: 0,
  startingPlots: 0,
  casketSp: [1, 2, 3],
  plotSp: 1,
  yangsPerDay: 1,
  risk: 50,
  tournamentActive: false,
  tournamentDays: 30,
  bonusExp: 20,
  bonusLuck: 25,
  tradeBonus: 25,
  visitsPerDay: 2,
  normalOdds: 0.08,
  luckOdds: 0.08,
  scriptOdds: 0.05,
  tagsReceivablePerDay: 1,
  nameChangeCost: 1,
  maintDelete: true,
  maxPlayers: 800,
  inactiveDays: 15,
  swearFilter: true,
};

export const CLASSIC_RULES: ClassicRules = {
  ruleset: "classic",
  settings: CLASSIC_SETTINGS,
  casketPrices: [800, 2600, 5300],
  bpMultiplier: 0.0064,
  perfectSaleBonus: 200,
  closeBonusExtra: 10,
  closeness: 100,
  bigSaleTv: 69,
  walkoutMood: 10,
  overLimitLeaveMood: 9,
  softRefuseMood: { base: 0.4, range: 0.7 },
  overLimitMood: { base: 0.4, range: 1 },
  hardRefuseMood: { base: 0.6, range: 1 },
  upgradeRefuseMood: { base: 0.7, range: 1 },
  hardRefuseCheapness: 8,
  softAcceptMoods: [2, 4, 7, 9],
  calmAcceptBelow: 7,
  guiltMood: { base: 0, range: 1 },
  guiltLovedMood: { base: 1, range: 2 },
  guiltCheapness: { base: 0.7, range: 2 },
  sympathyMood: { base: 0.4, range: 1 },
  sympathyNotLovedMood: { base: 1, range: 2 },
  sympathyCheapness: { base: 0.7, range: 2 },
  rivalBp: { min: 5, range: 5 },
  psychWeight: 0.98,
  psych: {
    resistance: { minAbove: -1, perLevel: 13, base: 20 },
    mood: { minAbove: 0, perLevel: 14, base: 0 },
    doubleLimit: { minAbove: 4, perLevel: 15, base: -65 },
    estimate: { minAbove: 1, perLevel: 15, base: -25 },
    halveResistance: { minAbove: 2, perLevel: 15, base: -35 },
    halveMood: { minAbove: 3, perLevel: 15, base: -50 },
  },
  riskDecline: { min: 4, max: 10 },
  riskLuckWeight: 0.9,
  luckMin: 1,
  luckMax: 100,
  topParlorShares: [1, 0.5, 0.25],
  hearses: [
    { price: 4, bonusTurns: 0 },
    { price: 12, bonusTurns: 2, picture: "hearse/hearse1" },
    { price: 30, bonusTurns: 4, picture: "hearse/hearse2" },
    { price: 50, bonusTurns: 7, picture: "hearse/hearse3" },
    { price: 80, bonusTurns: 10, picture: "hearse/hearse4" },
  ],
  places: {
    tagValues: [1, 2, 4],
    store: { smokeDetector: 8, safe: 6, padlock: 6, lockpick: 1, padlockStrength: 100 },
    university: {
      psychBase: 4,
      psychPerLevel: 2,
      hpCostFactor: 1.2,
      strengthCostFactor: 3,
      hpGain: { min: 4, max: 5 },
      strengthGain: 1,
    },
    yangs: {
      dragon: { cost: 5, luck: 10, onlyBelowLuck: 40 },
      sparrow: { cost: 20, luck: 5 },
      tiger: { cost: 20, luck: 10 },
      newsOdds: 4,
    },
  },
  newPlayer: {
    nameMin: 3,
    nameMax: 20,
    logonMin: 3,
    logonMax: 20,
    parlorMin: 3,
    parlorMax: 20,
    passwordMin: 1,
    passwordMax: 20,
    emailMin: 4,
    emailMax: 45,
  },
  zeroBpGraceDays: 3,
  mailRewardsOnDelivery: true,
  filterUserText: false,
  pvp: {
    lockpickDamage: { min: 5, max: 10 },
    stealMax: 3,
    battleStealMax: 4,
    defenderMissOneIn: 20,
    doubleDamageOneIn: 10,
    attackerWinGain: 0.02,
    attackerWinLoss: 0.01,
    defenderWinGain: 0.01,
    defenderWinLoss: 0.005,
  },
  textLimits: { mail: 4000, announcement: 600, battleQuote: 200, chat: 400, nameSearch: 40 },
  fixes: {
    newPlayerWelcome: true,
    policeNewDayMessage: true,
    zeroBpGracePeriod: true,
    catchUpMissedDays: true,
    hearseRebuy: true,
    battleDisconnect: true,
    visitTargetRecheck: true,
    emptyMailStop: true,
    oldPapersCancel: true,
  },
};

/** The original's behaviour everywhere (every gameplay fix off), for parity tests. */
export function originalClassicRules(): ClassicRules {
  return {
    ...CLASSIC_RULES,
    fixes: {
      newPlayerWelcome: false,
      policeNewDayMessage: false,
      zeroBpGracePeriod: false,
      catchUpMissedDays: false,
      hearseRebuy: false,
      battleDisconnect: false,
      visitTargetRecheck: false,
      emptyMailStop: false,
      oldPapersCancel: false,
    },
  };
}
