import type { Action, Button, Hud, Overlay, RichText, View } from "@fq/protocol";
import type { LegacyAssets } from "./assets.js";
import { centerLabel, layoutButtons } from "./buttons.js";
import {
  BUTTON_COMMANDS,
  PLACE_COMMANDS,
  RETURN_COMMAND,
  Request,
  Sent,
  SLOT_COMMAND_BASE,
} from "./commands.js";
import type { LegacyVars } from "./escape.js";
import { htmlText, LEGACY_COLORS, richTextToLegacyHtml, richTextToPlain } from "./richText.js";

/** Which screen of welcome.swf the client is showing. */
export type ClientObject =
  | "m_main"
  | "i_generic"
  | "i_map"
  | "i_chat"
  | "news"
  | "rankings"
  | "stats";

/** What the bridge knows the client is showing, so a response can refresh instead of rebuild. */
export interface ClientState {
  object: ClientObject | null;
  /** Engine module behind an i_generic screen; a different module means a new screen. */
  module: string;
  fg: string | undefined;
  bg: string | undefined;
  tags: boolean;
  battle: boolean;
}

export const BLANK_CLIENT: ClientState = {
  object: null,
  module: "",
  fg: undefined,
  bg: undefined,
  tags: false,
  battle: false,
};

export interface RenderContext {
  view: View;
  /** The engine module that drew the view (`session.scene`). */
  module: string;
  assets: LegacyAssets;
  previous: ClientState;
  /** Build a new screen even when the old one could be refreshed (the request was `c_request_main`). */
  forceNew: boolean;
  /** Game day, for the rankings date line. */
  day: number;
  /** The player offered by a "Do you mean X?" box. */
  found?: { id: number; name: string };
  /** What the cafe transcript should receive (initial text or new lines). */
  chat?: { text: RichText; update: boolean };
  /** The text a Reply button quotes (`st_quote`). */
  quote?: string;
  /** Who a Reply goes to (`i_his_id`). */
  replyTo?: number;
  /**
   * The pack's desk texts and Reply question, so a letter is drawn as the
   * original's desk text: `desk.sitting` / `sittingPolice` stand in for an
   * empty desk message, `replyPrompt` is the remaster's question.
   */
  letterText?: { sitting: readonly string[]; replyPrompt: string };
}

export interface Rendered {
  vars: [string, string | number][];
  /** Command number to engine action for the buttons this response offers. */
  table: Map<number, Action>;
  client: ClientState;
  /** Things in the view the client cannot show (extra buttons and the like). */
  notes: string[];
}

/** The seven buttons of the desk's capsule menu. The client draws them itself. */
const DESK_MENU = [
  "desk:wait",
  "go:map",
  "go:news",
  "go:stats",
  "go:rankings",
  "go:mailbox",
  "desk:quit",
];

/** Locations that showed the casket tag counter in the original (`b_show_tags`, see the places' handlers). */
const TAG_MODULES = new Set(["bank", "store", "spirit-university", "options"]);

/** The desk View whose buttons are the capsule menu rather than plaque buttons. */
export function isDeskMenu(buttons: readonly Button[]): boolean {
  return buttons.length > 0 && buttons.every((b) => DESK_MENU.includes(b.id));
}

function html(text: RichText, color?: string): string {
  return richTextToLegacyHtml(text, color ? { defaultColor: color } : {});
}

/** Stat variables the screens bind to (`add_logon_stats`, commands.cpp:33-40, funeral.cpp:272-281). */
export function hudVars(hud: Hud | undefined): [string, string | number][] {
  if (!hud) return [];
  return [
    ["i_turns", cash(hud.turns)],
    ["i_sp", cash(hud.bpToday)],
    ["i_exp", cash(hud.bpTotal)],
    ["i_luck", hud.luck],
    ["i_coffin_wood", cash(hud.tags.wood)],
    ["i_coffin_silver", cash(hud.tags.silver)],
    ["i_coffin_gold", cash(hud.tags.gold)],
  ];
}

/** `int_to_cash` (thousands separators), local copy so this file needs only the protocol types. */
function cash(value: number): string {
  const n = Math.trunc(value);
  const digits = Math.abs(n).toString();
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ",";
    out += digits.charAt(i);
  }
  return n < 0 ? `-${out}` : out;
}

class Builder {
  readonly vars: [string, string | number][] = [];
  readonly table = new Map<number, Action>();
  readonly notes: string[] = [];

  add(name: string, value: string | number): void {
    this.vars.push([name, value]);
  }

  addAll(list: LegacyVars): void {
    for (const [n, v] of list) this.vars.push([n, v]);
  }
}

/** Registers `button` under the number the original used for it, if it had one. */
function registerFixed(b: Builder, button: Button): number | undefined {
  const command = BUTTON_COMMANDS[button.id];
  if (command === undefined || button.enabled === false) return undefined;
  if (!b.table.has(command)) b.table.set(command, { type: "press", buttonId: button.id });
  return command;
}

interface PlaqueItem {
  label: string;
  /** The number to offer, or undefined to hand out a slot number. */
  command?: number | undefined;
  action?: Action | undefined;
}

/**
 * Lays the plaque buttons out (`add_button`, funeral_util.cpp:10-31) and fills
 * the table. Buttons the view marks disabled are drawn but do nothing.
 */
function addPlaques(b: Builder, items: readonly PlaqueItem[]): void {
  const { placed, dropped } = layoutButtons(items);
  for (const { slot, key, item } of placed) {
    const command = item.command ?? SLOT_COMMAND_BASE + slot;
    b.add(`st_option_${key}`, htmlText(centerLabel(item.label)));
    b.add(`i_command_${key}`, command);
    if (item.command === undefined) b.add(`i_command_sub_${key}`, slot);
    if (item.action && !b.table.has(command)) b.table.set(command, item.action);
  }
  for (const d of dropped)
    b.notes.push(`The client has five plaque buttons; "${d.label}" was left out`);
}

function plaqueFromButtons(b: Builder, buttons: readonly Button[]): PlaqueItem[] {
  return buttons.map((button) => {
    const command = registerFixed(b, button);
    const enabled = button.enabled !== false;
    return {
      label: button.label,
      command,
      action: enabled ? ({ type: "press", buttonId: button.id } as Action) : undefined,
    };
  });
}

/** The picture variables for a screen (`st_url`, `st_url_bg`), refreshing only what changed. */
function addPictures(b: Builder, ctx: RenderContext, fresh: boolean): { fg?: string; bg?: string } {
  const { view, assets, previous } = ctx;
  const fg = view.picture?.fg ?? view.music;
  const bg = view.picture?.bg;
  const blank = "blank";
  const shownFg = fresh ? undefined : previous.fg;
  const shownBg = fresh ? undefined : previous.bg;
  if (fg !== shownFg && (fg !== undefined || shownFg !== undefined)) {
    b.add("st_url", assets.urlFor(fg ?? blank));
  }
  if (bg !== shownBg && (bg !== undefined || shownBg !== undefined)) {
    b.add("st_url_bg", assets.urlFor(bg ?? blank));
  }
  const out: { fg?: string; bg?: string } = {};
  if (fg !== undefined) out.fg = fg;
  if (bg !== undefined) out.bg = bg;
  return out;
}

function clientAfter(
  ctx: RenderContext,
  object: ClientObject,
  extra: Partial<ClientState>,
): ClientState {
  return {
    object,
    module: ctx.module,
    fg: undefined,
    bg: undefined,
    tags: false,
    battle: false,
    ...extra,
  };
}

/** The main desk and everything that happens at it (`st_object` m_main, welcome.swf sprite 450). */
function renderMain(ctx: RenderContext): Rendered {
  const { view, previous } = ctx;
  const b = new Builder();
  const fresh = ctx.forceNew || previous.object !== "m_main";
  const menu = view.scene === "desk" && isDeskMenu(view.buttons);
  b.addAll(hudVars(view.hud));
  b.add("st_main", html(view.text));
  const pics = addPictures(b, ctx, fresh);
  if (menu) {
    for (const button of view.buttons) registerFixed(b, button);
  } else {
    addPlaques(b, plaqueFromButtons(b, view.buttons));
  }
  b.add("b_kill_buttons", menu ? 0 : 1);
  if (view.customer) {
    b.add("st_class", htmlText(view.customer.incomeLabel));
    b.add("st_mood", htmlText(view.customer.moodLabel));
  }
  b.add("b_show_stats", view.customer ? 1 : 0);
  if (fresh) {
    b.add("st_object", "m_main");
    b.add("i_sent", Sent.object);
  } else {
    b.add("i_sent", Sent.loadMovie);
  }
  return { ...done(b), client: clientAfter(ctx, "m_main", pics) };
}

function done(b: Builder): Pick<Rendered, "vars" | "table" | "notes"> {
  return { vars: b.vars, table: b.table, notes: b.notes };
}

/** A place or any i_generic screen (welcome.swf sprite 374). */
function renderGeneric(ctx: RenderContext): Rendered {
  const { view, previous } = ctx;
  const b = new Builder();
  const fresh = ctx.forceNew || previous.object !== "i_generic" || previous.module !== ctx.module;
  b.addAll(hudVars(view.hud));
  b.add("st_main", html(view.text));
  b.add("st_generic_info", view.note ? html(view.note, LEGACY_COLORS.black) : "");
  b.add("st_generic_status", view.status ? html(view.status, LEGACY_COLORS.black) : "");
  const pics = addPictures(b, ctx, fresh);
  addPlaques(b, plaqueFromButtons(b, view.buttons));
  const tags = TAG_MODULES.has(ctx.module);
  if (tags) b.add("b_show_tags", 1);
  else if (previous.tags && !fresh) b.add("b_show_tags", 2);
  const battle = view.battle !== undefined;
  if (view.battle) {
    const { me, them } = view.battle;
    b.add("st_stats_me", htmlText(`${me.name} - ${me.hp} of ${me.hpMax} hitpoints`));
    b.add("st_stats_him", htmlText(`${them.name} - ${them.hp} of ${them.hpMax} hitpoints`));
    b.add("i_hp_me", me.hp);
    b.add("i_hp_him", them.hp);
    b.add("i_hp_max_me", me.hpMax);
    b.add("i_hp_max_him", them.hpMax);
    b.add("b_show_battle", 1);
  } else if (previous.battle && !fresh) {
    b.add("b_show_battle", 2);
  }
  if (fresh) {
    b.add("st_object", "i_generic");
    b.add("i_sent", Sent.object);
  } else {
    b.add("i_sent", Sent.generic);
  }
  return { ...done(b), client: clientAfter(ctx, "i_generic", { ...pics, tags, battle }) };
}

/** The Funeral Times (welcome.swf sprite 255): `command_news_front` and `command_news_crime`. */
function renderNews(ctx: RenderContext): Rendered {
  const { view } = ctx;
  const b = new Builder();
  const news = view.news;
  b.addAll(hudVars(view.hud));
  if (news) {
    b.add("st_date", `Day ${news.day}`);
    b.add("st_top_today", html(news.topToday, LEGACY_COLORS.black));
    b.add("st_top_yesterday", html(news.topYesterday, LEGACY_COLORS.black));
    b.add("st_news", html(news.body, LEGACY_COLORS.black));
    b.add("i_yesterday", news.isYesterday ? 1 : 0);
  }
  for (const button of view.buttons) registerFixed(b, button);
  b.add("i_sent", Sent.news);
  return { ...done(b), client: clientAfter(ctx, "news", {}) };
}

/** The rankings sheet (welcome.swf sprite 276): `command_ranking`. */
function renderRankings(ctx: RenderContext): Rendered {
  const { view } = ctx;
  const b = new Builder();
  b.addAll(hudVars(view.hud));
  b.add("st_date", `Day ${ctx.day}`);
  b.add("st_news", html(view.text, LEGACY_COLORS.white));
  // The one button is Continue; it sends `i_rank_command` (welcome.swf button 267). That is the
  // desk's number when it goes to the desk (go:desk) and a number of its own otherwise, for
  // example the rival parlors' Look list, which returns to the parlors.
  const back = view.buttons.find((x) => x.enabled !== false);
  let command: number = Request.main;
  if (back) {
    command = registerFixed(b, back) ?? SLOT_COMMAND_BASE + 1;
    b.table.set(command, { type: "press", buttonId: back.id });
  }
  b.add("i_rank_command", command);
  b.add("i_sent", Sent.ranking);
  return { ...done(b), client: clientAfter(ctx, "rankings", {}) };
}

/** Stat sheet line ids to the variables the status screen binds (`func_AddUpdateStats`, command_script.cpp:328-358). */
const STAT_VARS: Readonly<Record<string, string>> = {
  turns: "i_turns",
  bpTotal: "i_exp",
  money: "i_money",
  wood: "i_coffin_wood",
  silver: "i_coffin_silver",
  gold: "i_coffin_gold",
  plots: "i_plots",
  bpToday: "i_sp",
  psych: "i_psych",
  rating: "st_rating",
  yangs: "i_yangs",
  visits: "i_visits",
  hpMax: "i_hit_max",
  strength: "i_strength",
  lockpicks: "i_lockpick",
  ride: "st_ride",
};

/** The status screen (welcome.swf sprite 185): the stats script's packet, `c_command_stats`. */
function renderStats(ctx: RenderContext): Rendered {
  const { view } = ctx;
  const b = new Builder();
  b.add("st_temp", html(view.text, LEGACY_COLORS.yellow));
  for (const line of view.stats ?? []) {
    const name = STAT_VARS[line.id];
    if (name) b.add(name, htmlText(line.value));
  }
  addPlaques(b, plaqueFromButtons(b, view.buttons));
  b.add("i_sent", Sent.stats);
  return { ...done(b), client: clientAfter(ctx, "stats", {}) };
}

/** The map (`command_map`, commands_map.cpp:3-30): only an object name; the buildings are the client's. */
function renderMap(ctx: RenderContext): Rendered {
  const { view } = ctx;
  const b = new Builder();
  b.addAll(hudVars(view.hud));
  for (const place of view.map ?? []) {
    const command = PLACE_COMMANDS[place.id];
    if (command !== undefined && !b.table.has(command)) {
      b.table.set(command, { type: "visit", placeId: place.id });
    }
  }
  b.add("st_object", "i_map");
  b.add("i_sent", Sent.object);
  return { ...done(b), client: clientAfter(ctx, "i_map", {}) };
}

/** The Pale Horse (`command_chat_start` and `command_chat_update`, commands_bar.cpp). */
function renderCafe(ctx: RenderContext): Rendered {
  const { view } = ctx;
  const b = new Builder();
  const chat = ctx.chat ?? { text: view.text, update: false };
  for (const button of view.buttons) registerFixed(b, button);
  b.add("st_message", html(chat.text, LEGACY_COLORS.yellow));
  if (chat.update) {
    b.add("i_sent", Sent.chatUpdate);
  } else {
    b.add("i_chat_speed", 2000);
    b.add("st_object", "i_chat");
    b.add("i_sent", Sent.object);
  }
  return { ...done(b), client: clientAfter(ctx, "i_chat", {}) };
}

/** Name of the id suffix after the module, for example "getname" in "visit:getname". */
function overlayKind(id: string): string {
  const at = id.indexOf(":");
  return at === -1 ? id : id.slice(at + 1);
}

/** Drops `suffix` (plain text) from the end of `text`, if it ends with it. */
function dropSuffix(text: RichText, suffix: string): RichText {
  if (!richTextToPlain(text).endsWith(suffix)) return text;
  const out = text.map((span) => ({ ...span }));
  let left = suffix.length;
  while (left > 0 && out.length > 0) {
    const last = out[out.length - 1] as RichText[number];
    if (last.text.length <= left) {
      left -= last.text.length;
      out.pop();
    } else {
      last.text = last.text.slice(0, last.text.length - left);
      left = 0;
    }
  }
  return out;
}

/**
 * What the original's desk said with a letter on it (commands_main.cpp:89-108):
 * the desk message read so far ("Welcome back..." or nothing), then what the
 * queue gave, each text packet "`w%s\n" (broadcast.cpp:58-70). The engine
 * puts the first part under the overlay (or "You are sitting at your desk."
 * when there was none) and adds its Reply question to the second.
 */
function letterText(ctx: RenderContext, overlay: Overlay): RichText {
  const body = overlay.kind === "message" || overlay.kind === "confirm" ? overlay.text : [];
  const known = ctx.letterText;
  if (!known) return body;
  const head = richTextToPlain(ctx.view.text);
  const under = known.sitting.includes(head) ? [] : ctx.view.text;
  const letter = overlay.kind === "confirm" ? dropSuffix(body, `\n\n${known.replyPrompt}`) : body;
  return [...under, ...letter];
}

/**
 * A letter from another player or a notice arrives as a message or a
 * question on the desk. The original showed these as the desk text with a
 * Continue button (and Reply); do the same instead of a pop-up.
 */
function renderLetter(ctx: RenderContext, overlay: Overlay): Rendered {
  const b = new Builder();
  const { view, previous } = ctx;
  const fresh = previous.object !== "m_main" || ctx.forceNew;
  b.addAll(hudVars(view.hud));
  b.add("st_main", html(letterText(ctx, overlay)));
  const pic = overlay.kind === "message" ? overlay.picture : undefined;
  const shown: ClientState = fresh ? BLANK_CLIENT : previous;
  const fg = pic?.fg ?? view.picture?.fg;
  const bg = pic?.bg ?? view.picture?.bg;
  if (fg !== shown.fg) b.add("st_url", ctx.assets.urlFor(fg ?? "blank"));
  if (bg !== shown.bg) b.add("st_url_bg", ctx.assets.urlFor(bg ?? "blank"));
  if (overlay.kind === "confirm") {
    b.table.set(Request.reply, { type: "confirm", overlayId: overlay.id, accepted: true });
    b.table.set(Request.main, { type: "confirm", overlayId: overlay.id, accepted: false });
    addPlaques(b, [
      { label: "Reply", command: Request.reply },
      { label: "Continue", command: Request.main },
    ]);
    if (ctx.replyTo !== undefined) b.add("i_his_id", ctx.replyTo);
    if (ctx.quote !== undefined) b.add("st_quote", ctx.quote);
  } else {
    b.table.set(Request.main, { type: "dismiss", overlayId: overlay.id });
    addPlaques(b, [{ label: "Continue", command: Request.main }]);
  }
  b.add("b_kill_buttons", 1);
  b.add("b_show_stats", 0);
  if (fresh) {
    b.add("st_object", "m_main");
    b.add("i_sent", Sent.object);
  } else {
    b.add("i_sent", Sent.loadMovie);
  }
  const extra: Partial<ClientState> = {};
  if (fg !== undefined) extra.fg = fg;
  if (bg !== undefined) extra.bg = bg;
  return { ...done(b), client: clientAfter(ctx, "m_main", extra) };
}

/** An overlay on top of the current screen: `c_command_object_add` with an object name. */
function renderOverlay(ctx: RenderContext, overlay: Overlay): Rendered {
  const b = new Builder();
  const { view } = ctx;
  b.addAll(hudVars(view.hud));
  const keep = (): Rendered => ({ ...done(b), client: ctx.previous });
  switch (overlay.kind) {
    case "textInput": {
      if (overlayKind(overlay.id) === "getname") {
        b.add("st_message", htmlText(firstLine(overlay.prompt)));
        b.add("st_object", "i_getname");
      } else {
        b.add("st_message", htmlText(overlay.prompt));
        b.add("st_extra_text", overlay.initial ?? "");
        b.add("st_object", "i_get_text");
      }
      b.add("i_return_command", RETURN_COMMAND);
      b.add("i_return_command_sub", 0);
      b.add("i_sent", Sent.objectAdd);
      return keep();
    }
    case "playerPicker": {
      b.add("st_message", htmlText(firstLine(overlay.prompt)));
      b.add("st_object", "i_getname");
      b.add("i_return_command", RETURN_COMMAND);
      b.add("i_return_command_sub", 0);
      b.add("i_sent", Sent.objectAdd);
      return keep();
    }
    case "confirm": {
      // "Do you mean X?": the client wraps the name itself (i_namenext, sprite 508).
      b.add("st_object", "i_namenext");
      b.add("i_his_id", ctx.found?.id ?? -1);
      b.add("st_message", htmlText(ctx.found?.name ?? richTextToPlain(overlay.text)));
      b.add("i_return_command", RETURN_COMMAND);
      b.add("i_return_command_sub", 0);
      b.add("i_sent", Sent.objectAdd);
      return keep();
    }
    case "message": {
      if (overlayKind(overlay.id) === "noname") {
        // i_namenext with no id shows "Sorry, nobody by that name lives around here!".
        b.add("st_object", "i_namenext");
        b.add("i_his_id", -1);
        b.add("st_message", "");
        b.add("i_return_command", RETURN_COMMAND);
        b.add("i_return_command_sub", 0);
      } else {
        b.add("st_message", html(overlay.text, LEGACY_COLORS.white));
        b.add("st_object", "i_message");
      }
      b.add("i_sent", Sent.objectAdd);
      return keep();
    }
  }
}

function firstLine(text: string): string {
  const cut = text.indexOf("\n");
  return cut === -1 ? text : text.slice(0, cut);
}

/**
 * Chooses the client screen for a View and writes the variables for it.
 * The rules, from the scene and what the handlers of welcome.swf accept:
 *
 * - `news`, `rankings`, `stats` and `map` are screens of their own.
 * - `cafe` is the chat window (`i_chat`).
 * - `desk`, and `location` views with a customer panel or drawn by the
 *   negotiation, risk and home scripts, are the desk screen (`m_main`), as
 *   the original ran the whole customer exchange inside it.
 * - every other `location` is `i_generic`.
 * - an overlay on a screen is added on top (`i_getname`, `i_get_text`,
 *   `i_namenext`, `i_message`); letters become a desk screen with Continue.
 */
export function renderView(ctx: RenderContext): Rendered {
  const { view } = ctx;
  if (view.overlay) {
    const o = view.overlay;
    if (o.kind === "confirm" && overlayKind(o.id) === "reply") return renderLetter(ctx, o);
    if (o.kind === "message" && overlayKind(o.id) === "letter") return renderLetter(ctx, o);
    return renderOverlay(ctx, o);
  }
  switch (view.scene) {
    case "lobby":
      return {
        vars: [["i_sent", Sent.quit]],
        table: new Map(),
        client: BLANK_CLIENT,
        notes: [],
      };
    case "news":
      return renderNews(ctx);
    case "rankings":
      return renderRankings(ctx);
    case "stats":
      return renderStats(ctx);
    case "map":
      return renderMap(ctx);
    case "cafe":
      return renderCafe(ctx);
    case "desk":
      return renderMain(ctx);
    case "location":
      return usesMainScreen(ctx) ? renderMain(ctx) : renderGeneric(ctx);
  }
}

/** Modules whose screens the original drew inside m_main. */
const MAIN_MODULES = new Set(["neg", "risk", "desk"]);

function usesMainScreen(ctx: RenderContext): boolean {
  if (ctx.view.customer) return true;
  if (MAIN_MODULES.has(ctx.module)) return true;
  // A running script keeps whichever screen it was started from (SendPacketAndWait without st_object).
  if (ctx.module === "script" && ctx.previous.object === "m_main") return true;
  return false;
}
