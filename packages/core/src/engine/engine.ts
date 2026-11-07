import type { Action, RichText, View } from "@fq/protocol";
import { broadcast } from "../classic/mail.js";
import { maintNewDay } from "../classic/maintenance.js";
import { createClassicRegistry } from "../classic/modules/index.js";
import { enterNews } from "../classic/modules/news.js";
import { notBuiltView } from "../classic/modules/town.js";
import {
  addPlayer,
  type NewPlayerField,
  type NewPlayerInput,
  validateNewPlayer,
} from "../classic/newPlayer.js";
import { addToNews } from "../classic/news.js";
import { killScript } from "../classic/scripts/runtime.js";
import { endSession, lobbyView, logOn, quit } from "../classic/session.js";
import { newPlayersClosed } from "../classic/tournament.js";
import { CLASSIC_TEXT } from "../content/classicText.js";
import type { ContentPack } from "../content/types.js";
import { TOWN_STREAM } from "../rng/streams.js";
import { CLASSIC_RULES, type ClassicRules, type GameSettings } from "../rules/classicRules.js";
import type { TownState } from "../state/types.js";
import { fill } from "../text/format.js";
import { checkAction } from "./guard.js";
import type { Registry } from "./registry.js";
import { type Effect, type EngineContext, Turn } from "./turn.js";
import { freezeView, legacy } from "./view.js";

export interface StepResult {
  town: TownState;
  view: View;
  effects: Effect[];
  /** Set when the action was refused; `town` is then the input unchanged. */
  rejected?: string;
  /**
   * When a log-on is refused for a reason the original told the player
   * (`send_error_message`, commands_misc.cpp:3-14), the text it showed.
   */
  message?: RichText;
}

export interface MaintenanceResult {
  town: TownState;
  effects: Effect[];
  /** Days actually advanced. */
  daysRun: number;
}

/** Builds an engine context for the Classic ruleset. */
export function classicContext(
  content: ContentPack,
  options: { rules?: ClassicRules; registry?: Registry; now?: number } = {},
): EngineContext {
  return {
    rules: options.rules ?? CLASSIC_RULES,
    content,
    registry: options.registry ?? createClassicRegistry(),
    now: options.now ?? 0,
  };
}

function clone(town: TownState): TownState {
  return JSON.parse(JSON.stringify(town)) as TownState;
}

/** Runs the registry's view hooks (none in Classic) and freezes the result. */
export function finalView(turn: Turn, view: View): View {
  let out = view;
  for (const hook of turn.registry.viewHooks) out = hook(turn, out);
  return freezeView(out);
}

/** Stores the view as the session's last view and returns the result. */
function finish(turn: Turn, view: View): StepResult {
  const frozen = finalView(turn, view);
  const session = turn.town.sessions[String(turn.playerId)];
  if (session) session.view = frozen;
  turn.commit();
  return { town: turn.town, view: frozen, effects: turn.effects };
}

/**
 * Runs maintenance `missedDays` times (once if `catchUpMissedDays` is off,
 * as the original did after downtime). Stops at a finished tournament.
 * `maint_new_day`, legacy/source/maint.cpp:362-415.
 */
export function runDailyMaintenance(
  town: TownState,
  ctx: EngineContext,
  options: { missedDays?: number } = {},
): MaintenanceResult {
  const turn = new Turn(clone(town), ctx, TOWN_STREAM);
  const wanted = Math.max(1, Math.trunc(options.missedDays ?? 1));
  const days = ctx.rules.fixes.catchUpMissedDays ? wanted : 1;
  let daysRun = 0;
  for (let i = 0; i < days; i++) {
    if (!maintNewDay(turn)) break;
    daysRun++;
  }
  turn.commit();
  return { town: turn.town, effects: turn.effects, daysRun };
}

/**
 * A new town. Like a brand-new original game (legacy/source/funeral.cpp:98-103)
 * it runs maintenance once, so play starts on day 1 with a front page.
 */
export function createTown(
  options: {
    seed: number;
    settings?: Partial<GameSettings>;
    serverNews?: string;
    /** Stay on day 0 until the first midnight (classic/tournament.ts). */
    paused?: boolean;
  },
  ctx: EngineContext,
): MaintenanceResult {
  const town: TownState = {
    version: 1,
    ruleset: ctx.rules.ruleset,
    seed: options.seed >>> 0,
    settings: { ...ctx.rules.settings, ...options.settings },
    day: 0,
    lastMaintenance: null,
    players: [],
    sessions: {},
    news: {},
    topYesterday: null,
    deeds: [],
    streams: {},
    serverNews: options.serverNews ?? "",
  };
  if (options.paused) return { town, effects: [], daysRun: 0 };
  return runDailyMaintenance(town, ctx);
}

export type CreatePlayerResult =
  | ({ ok: true; playerId: number } & StepResult)
  | { ok: false; town: TownState; field: NewPlayerField; error: RichText };

/**
 * `process_new_user` (legacy/source/new_user.cpp): validate, create the
 * record, log the player on, announce them, and show the paper.
 */
export function createPlayer(
  town: TownState,
  input: NewPlayerInput,
  ctx: EngineContext,
): CreatePlayerResult {
  const closed = newPlayersClosed(town, ctx);
  if (closed) return { ok: false, town, field: "town", error: legacy(closed) };
  const turn = new Turn(clone(town), ctx, TOWN_STREAM);
  const checked = validateNewPlayer(turn, input);
  if ("error" in checked) {
    return { ok: false, town, field: checked.error.field, error: legacy(checked.error.message) };
  }
  const player = addPlayer(turn, checked.input);
  const playerTurn = new Turn(turn.town, ctx, player.id, turn.effects);
  // Ruleset set-up (none in Classic; engine/registry.ts `PlayerCreatedHook`).
  for (const hook of ctx.registry.playerCreatedHooks) hook(playerTurn);
  logOn(playerTurn);
  const t = ctx.content.text.newPlayer;
  broadcast(playerTurn, fill(t.movedIn, { name: player.name }));
  addToNews(turn.town, fill(t.newsOpened, { parlor: player.parlor, name: player.name }));
  turn.effects.push({ kind: "playerCreated", playerId: player.id });
  return { ok: true, playerId: player.id, ...finish(playerTurn, enterNews(playerTurn)) };
}

/**
 * Log on (`check_name_and_password`, legacy/source/funeral.cpp:304-405, after
 * the password check, which the host does): announce, then the paper. A
 * player already online is logged off first, as a dropped connection.
 */
export function enterGame(town: TownState, playerId: number, ctx: EngineContext): StepResult {
  const player = town.players[playerId];
  if (!player?.active) return { town, view: lobbyView(), effects: [], rejected: "No such player" };
  // check_name_and_password (funeral.cpp:357-363): nobody may log on while
  // another player is inside their parlor (get_player_who_locked_this_guy,
  // misc_utils.cpp:279-301).
  for (const [key, s] of Object.entries(town.sessions)) {
    if (s.hisId === playerId && s.locked && town.players[Number(key)]?.active) {
      const text = ctx.content.text.session.parlorLocked ?? CLASSIC_TEXT.session.parlorLocked ?? "";
      return {
        town,
        view: lobbyView(),
        effects: [],
        rejected: "Parlor locked",
        message: legacy(text),
      };
    }
  }
  const turn = new Turn(clone(town), ctx, playerId);
  if (turn.town.sessions[String(playerId)]) endSession(turn, "replaced");
  logOn(turn);
  broadcast(turn, fill(ctx.content.text.session.loggedOn, { name: player.name }));
  return finish(turn, enterNews(turn));
}

/**
 * The connection dropped or timed out (`online_delete_guy`,
 * legacy/source/online_util.cpp:112-177). A sale in progress is completed
 * and mailed, as in the original.
 */
export function leaveGame(town: TownState, playerId: number, ctx: EngineContext): StepResult {
  if (!town.sessions[String(playerId)]) return { town, view: lobbyView(), effects: [] };
  const turn = new Turn(clone(town), ctx, playerId);
  endSession(turn, "timeout");
  turn.commit();
  return { town: turn.town, view: lobbyView(), effects: turn.effects };
}

function navigate(turn: Turn, target: string): View {
  killScript(turn);
  const [moduleId = "", ...rest] = target.split(":");
  const arg = rest.length > 0 ? rest.join(":") : undefined;
  const module = turn.registry.module(moduleId);
  if (!module?.enter) return notBuiltView(turn, moduleId);
  turn.session.scene = moduleId;
  return module.enter(turn, arg);
}

function scopeOf(id: string): [string, string] {
  const index = id.indexOf(":");
  return index === -1 ? [id, ""] : [id.slice(0, index), id.slice(index + 1)];
}

function route(turn: Turn, action: Exclude<Action, { type: "exit" }>): View {
  const registry = turn.registry;
  switch (action.type) {
    case "press": {
      const [scope, command] = scopeOf(action.buttonId);
      if (scope === "go") return navigate(turn, command);
      if (scope !== "script") killScript(turn);
      const module = registry.module(scope);
      if (!module?.press) return notBuiltView(turn, scope);
      return module.press(turn, command);
    }
    case "visit": {
      const place = registry.place(action.placeId);
      if (!place) throw new Error(`Unknown place ${action.placeId}`);
      return navigate(turn, place.module);
    }
    case "submitText":
    case "pickPlayer":
    case "confirm":
    case "dismiss": {
      const [scope] = scopeOf(action.overlayId);
      const module = registry.module(scope);
      if (action.type === "submitText" && module?.submitText) {
        return module.submitText(turn, action.overlayId, action.text);
      }
      if (action.type === "pickPlayer" && module?.pickPlayer) {
        return module.pickPlayer(turn, action.overlayId, action.playerId);
      }
      if (action.type === "confirm" && module?.confirm) {
        return module.confirm(turn, action.overlayId, action.accepted);
      }
      if (action.type === "dismiss" && module?.dismiss)
        return module.dismiss(turn, action.overlayId);
      throw new Error(`No handler for overlay ${action.overlayId}`);
    }
    case "chat": {
      const module = registry.module(turn.session.scene);
      if (!module?.chat) throw new Error("Chat is not available here");
      return module.chat(turn, action.text);
    }
  }
}

/**
 * Applies one player action. The action must match something the player's
 * last view offered (a generalised `location_callback_ok`,
 * legacy/source/location_data.cpp:5-15); anything else is rejected and the
 * town is returned unchanged. `exit` (log off) is always allowed.
 */
export function step(
  town: TownState,
  playerId: number,
  action: Action,
  ctx: EngineContext,
): StepResult {
  const session = town.sessions[String(playerId)];
  if (!session) return { town, view: lobbyView(), effects: [], rejected: "Not logged on" };
  const unchanged = (reason: string): StepResult => ({
    town,
    view: session.view ?? lobbyView(),
    effects: [],
    rejected: reason,
  });
  if (action.type !== "exit") {
    const reason = checkAction(session.view, action);
    if (reason) return unchanged(reason);
  }
  const turn = new Turn(clone(town), ctx, playerId);
  turn.player.lastPacket = ctx.now;
  try {
    const view = action.type === "exit" ? quit(turn) : route(turn, action);
    return finish(turn, view);
  } catch (error) {
    return unchanged(error instanceof Error ? error.message : String(error));
  }
}
