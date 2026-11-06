import type { AssetId, View } from "@fq/protocol";
import type {
  ExpandedCustomer,
  ExpandedPlayer,
  ExpandedSession,
  ExpandedTown,
} from "../expanded/state.js";
import type { StreamPosition } from "../rng/streams.js";
import type { GameSettings, RulesetId } from "../rules/classicRules.js";

/** Any JSON value. Every piece of engine state is made of these. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** legacy/source/player_struct.h:24-29: indexes into `PlayerState.custom` used by the scripts. */
export const Custom = {
  FireAlarm: 0,
  Safe: 1,
  Padlock: 2,
  Lockpick: 3,
  PadlockStrength: 4,
} as const;

/** `C_CUSTOM_SIZE` (player_struct.h:15). */
export const CUSTOM_SIZE = 200;

/**
 * One player record: every live field of `player_struct`
 * (legacy/source/player_struct.h:39-87). Dropped: the password (the server
 * keeps a hash), IP addresses and `b_always` (the per-IP rule is gone), the
 * `p_on` pointer (see `TownState.sessions`), version and padding fields.
 */
export interface PlayerState {
  /** `i_index`: the slot number, also the player id. Slots of deleted players are reused. */
  id: number;
  /** `b_active`: false once deleted. */
  active: boolean;
  /** `st_name`: name shown to players. */
  name: string;
  /** `st_logon`: name used to log on. */
  logon: string;
  /** `st_funeral_name` */
  parlor: string;
  /** `st_email` */
  email: string;
  /** `b_want_email` (never used) */
  wantEmail: boolean;
  /** `b_male` */
  male: boolean;
  /** `t_last_logon`, ms since epoch, as passed in by the caller. */
  lastLogon: number;
  /** `t_last_packet` */
  lastPacket: number;
  /** `t_account_created` (the original never set it). */
  accountCreated: number;
  /** Game day the account was made. Added for the 0-BP grace-period fix. */
  dayCreated: number;
  /** `i_turns` */
  turns: number;
  /** `i_money` */
  money: number;
  /** `i_exp`: total Bury Points. */
  bp: number;
  /** `i_sp`: Bury Points earned today. */
  bpToday: number;
  /** `i_karma` */
  karma: number;
  /** `i_rating` */
  rating: number;
  /** `a_coffins`: casket tags by tier (wood, silver, gold). The original reserved 10 slots and used 3. */
  tags: number[];
  /** `b_incinerator_installed` (never used) */
  incinerator: boolean;
  /** `i_transportation_type`: index into `ClassicRules.hearses`. */
  transportation: number;
  /** `i_plots`: burials, also shown as gravestones. */
  plots: number;
  /** `i_day_last_logged_on`: the game day of the last per-player new day. 0 means never. */
  dayLastLoggedOn: number;
  /** `i_luck`, 1 to 100. */
  luck: number;
  /** `i_yangs_sent` today */
  yangsSent: number;
  /** `i_psych` */
  psych: number;
  /** `b_kicked_out_of_yangs` */
  kickedOutOfYangs: boolean;
  /** `i_strength` */
  strength: number;
  /** `i_hp_max` */
  hpMax: number;
  /** `i_hp` */
  hp: number;
  /** `i_player_fights`: visits used today. */
  playerFights: number;
  /** `b_can_be_attacked` */
  canBeAttacked: boolean;
  /** `b_police_protected` */
  policeProtected: boolean;
  /** `a_custom`: script-declared values, see `Custom`. Length `CUSTOM_SIZE`. */
  custom: number[];
  /** `i_tags_recieved_today` via the cafe's /give */
  tagsReceivedToday: number;
  /** Message queue (`class_que`), kept here so it survives log off like the original mail file. */
  mail: MailPacket[];
  /** Expanded ruleset only (expanded/state.ts). Never present in a Classic town. */
  expanded?: ExpandedPlayer;
}

/** `c_que_sub_type_*` (message_que.h:19-22). */
export type MailStat = "luck" | "bp" | "turns";

/**
 * One queued message (`class_que_packet`, message_que.h:28-100). The original
 * stored URL-encoded command strings; these are the same packets as data.
 */
export type MailPacket = MailPacketBase &
  (
    | { type: "text"; text: string }
    | { type: "simpleText"; text: string }
    | { type: "chat"; text: string }
    | { type: "newsLog"; text: string }
    | {
        type: "varMod";
        stat: MailStat;
        amount: number;
        /** Expanded: already applied when sent (`mailRewardsOnDelivery` off); only reported. */
        applied?: true;
      }
    | { type: "picture"; layer: "fg" | "bg"; picture: AssetId | null }
    | { type: "quote"; text: string }
    | { type: "buttons"; buttons: MailButton[] }
  );

export interface MailPacketBase {
  /** `c_importance`: normal packets are dropped when the player logs off or is offline. */
  importance: "normal" | "high";
  /** `i_from`, -1 for nobody. */
  from: number;
  /** `i_expire`: dropped unread once the game day reaches this. null never expires. */
  expireDay: number | null;
}

/** A button carried by a `c_que_type_command` packet (Continue, Reply). */
export interface MailButton {
  label: string;
  /** Button id the desk will offer, for example "go:desk". */
  id: string;
}

/**
 * The current customer: `communication_status` (online_struct.h:50-75) plus
 * `a_options`. Cleared by `init_location_info` and by each new customer.
 */
export interface CustomerState {
  /** `b_customer_active` */
  active: boolean;
  customerMale: boolean;
  customerAge: number;
  deceasedMale: boolean;
  deceasedAge: number;
  /** `e_relation` */
  relation: number;
  /** `e_income` */
  income: number;
  /** `e_desired_casket`: 0 wood, 1 silver, 2 gold. */
  desiredCasket: number;
  /** `e_big_upgrade`: index of the last hard-sell upgrade bought, -1 for none. */
  bigUpgrade: number;
  /** `e_death_type` */
  deathMethod: number;
  /** `e_death_object` */
  deathObject: number;
  /** `i_money_to_spend`: the hidden limit. */
  moneyToSpend: number;
  /** `i_special_button`: which customer flow is open. */
  flow: "none" | "negotiation" | "risk";
  /** `f_mood` (32-bit float) */
  mood: number;
  /** `f_cheapness` (32-bit float) */
  cheapness: number;
  /** `b_loved` */
  loved: boolean;
  /** `i_risk_type` */
  riskType: number;
  /** `st_url_save`: the portrait, mailed to a rival if the customer walks. */
  portrait: AssetId | null;
  /** `b_show_resistance` */
  showResistance: boolean;
  /** `a_options`: soft-sell item indexes bought, in order (duplicates allowed). */
  options: number[];
  /** Expanded ruleset only: the rest of the customer (expanded/state.ts). */
  expanded?: ExpandedCustomer;
}

/** A running scene script: replayed from its journal (see `classic/scripts/runtime.ts`). */
export interface ScriptState {
  id: string;
  /** Results of every operation and reply so far, in order. */
  journal: Json[];
}

/**
 * Per-player online state: `online_struct` and its `communication_status`
 * (legacy/source/online_struct.h:77-130). Exists only while logged on.
 */
export interface SessionState {
  /** `i_status` */
  status: "logon" | "play" | "chat";
  /** `cst_location`: where the player is, shown in player lists. */
  location: string;
  /** `b_gave_logon_message` */
  gaveLogonMessage: boolean;
  /** Module that drew the current view and receives its actions. */
  scene: string;
  /** Module-private data for the current scene (for example the news day). Must be JSON. */
  sceneData: Json;
  customer: CustomerState;
  /** `i_his_id`: the other player a location is dealing with, -1 for none. */
  hisId: number;
  /** `b_locked`: holding another player's parlor (visits). */
  locked: boolean;
  /** `m_i_script` and the script's own state, or null. */
  script: ScriptState | null;
  /** The last view sent. Actions are checked against it. */
  view: View | null;
  /** `t_logon` */
  loggedOnAt: number;
  /** Expanded ruleset only (expanded/state.ts). */
  expanded?: ExpandedSession;
}

/** Yesterday's top seller (`b_top_old_exists` and friends, funeral_file.h:47-51). */
export interface TopSeller {
  name: string;
  parlor: string;
  bp: number;
  id: number;
}

/** One day of the Funeral Times: the `news_day_N.txt` and `news_crime_day_N.txt` files. */
export interface NewsDay {
  front: string;
  crime: string;
}

export interface TownState {
  version: 1;
  /** Which ruleset the town plays. Set from the context's rules at creation. */
  ruleset: RulesetId;
  /** Seed every random stream is derived from. */
  seed: number;
  settings: GameSettings;
  /** `glo.i_game_age` */
  day: number;
  /** `glo.t_last_maint`, ms since epoch as passed in, or null. */
  lastMaintenance: number | null;
  /** Indexed by player id (slot). Deleted players stay with `active: false` until the slot is reused. */
  players: PlayerState[];
  /** Keyed by player id. */
  sessions: Record<string, SessionState>;
  /** Keyed by game day. Legacy markup strings. */
  news: Record<string, NewsDay>;
  topYesterday: TopSeller | null;
  /** `deeds.txt`: the Book of Deeds, one line per tournament winner. */
  deeds: string[];
  /** Positions of the seeded streams, keyed by player id or "town". */
  streams: Record<string, StreamPosition>;
  /** `glo.st_news`: the sysop's message on the logon screen. */
  serverNews: string;
  /**
   * Host-reported presence, keyed by player id: false while a logged-on
   * player's client is disconnected. Set only through `setPresence`
   * (classic/presence.ts). Online = has a session and is not reported false.
   * The visit rule ("not against players who are online") reads this.
   */
  presence?: Record<string, boolean>;
  /** `g_tvOn` (commands_bar.cpp:11): the one cafe TV, switched by `/tv`. Missing means on. */
  tvOn?: boolean;
  /**
   * Remaster addition (both rulesets): each player's block list, keyed by the
   * blocker's id, set only through `setBlocked` (classic/blocking.ts). Absent
   * when nobody blocks anybody, so a town without blocks is unchanged.
   */
  blocks?: Record<string, number[]>;
  /** Expanded ruleset only (expanded/state.ts). Never present in a Classic town. */
  expanded?: ExpandedTown;
}
