import { type EngineContext, Turn } from "../engine/turn.js";
import { deriveSeed, TOWN_STREAM } from "../rng/streams.js";
import type { TownState } from "../state/types.js";
import { fill } from "../text/format.js";
import { maintNewDay } from "./maintenance.js";
import { tournamentEndsToday, validPlayerCount } from "./players.js";
import { isPresent } from "./presence.js";
import { topPlayer } from "./rankings.js";

/**
 * The end of a tournament and the reset (legacy/source/maint.cpp:99-148,
 * 362-380, reset_game.cpp, funeral.cpp:50-121, 198-279).
 *
 * - Day N+1 (`tournament_ends_today`): nobody can play (turns 0 and visits
 *   used up, `base_new_day`), new accounts are refused, the paper names the
 *   winner and the meteor, and the winner goes into the Book of Deeds.
 * - The next midnight `maint_new_day` resets the game and restarts the
 *   server, whose start-up runs maintenance at once because the day is 0
 *   (funeral.cpp:98-103): the town lands on day 1 with nobody in it.
 * - Day 0 is otherwise only reached when the sysop sets it (the Game
 *   Settings day field, or a paused reset here); new accounts are refused
 *   until the next midnight starts day 1.
 */

/** Mixed into the seed at each reset, so a new tournament does not replay the old one's draws. */
const RESET_SALT = 0x46510003;

/**
 * `reset_game` (reset_game.cpp:4-25) after `shutdown_server`: every session
 * ends, players, mail and the paper are deleted (data\*.txt, data\mail,
 * player.dat), yesterday's top seller is forgotten, the day and last
 * maintenance go to 0, and script/reset.c runs (it only logs). The Book of
 * Deeds (deeds.txt, outside data\), the settings, the sysop's news and the
 * cafe TV switch survive.
 */
export function resetGame(turn: Turn): void {
  const town = turn.town;
  const winner = town.players[topPlayer(town)]?.name ?? null;
  for (const key of Object.keys(town.sessions).sort((a, b) => Number(a) - Number(b))) {
    delete town.sessions[key];
    turn.effects.push({ kind: "sessionEnded", playerId: Number(key), reason: "reset" });
  }
  turn.log("Resetting game...");
  turn.log("Deleting game data files...");
  town.players = [];
  town.news = {};
  turn.log("Deleting mail and messages...");
  town.topYesterday = null;
  town.day = 0;
  town.lastMaintenance = null;
  town.seed = deriveSeed(RESET_SALT, town.seed);
  town.streams = {};
  delete town.presence;
  // Block lists are per player id; the reset removes every player (classic/blocking.ts).
  delete town.blocks;
  turn.log("Script reset.c processed.");
  turn.effects.push({ kind: "tournamentReset", winner });
}

/**
 * The sysop's Reset Game (dlg_game_settings.cpp:195-215): `reset_game` and a
 * restart, which runs maintenance at once and starts day 1. With `paused`
 * the town stays on day 0 ("a new game is starting tomorrow") until the next
 * `runDailyMaintenance` starts it (the original's day-0 auto-start).
 */
export function resetTown(
  town: TownState,
  ctx: EngineContext,
  options: { paused?: boolean } = {},
): { town: TownState; effects: Turn["effects"] } {
  const turn = new Turn(JSON.parse(JSON.stringify(town)) as TownState, ctx, TOWN_STREAM);
  resetGame(turn);
  if (!options.paused) maintNewDay(turn);
  turn.commit();
  return { town: turn.town, effects: turn.effects };
}

/**
 * `st_no_more` (funeral.cpp:268-279): why new accounts are refused today, or
 * null. (The town-full check is `validateNewPlayer`'s.)
 */
export function newPlayersClosed(town: TownState, ctx: EngineContext): string | null {
  const t = ctx.content.text.social.lobby;
  if (tournamentEndsToday(town)) return t.closedOver;
  if (town.day === 0) return t.closedDayZero;
  return null;
}

/** What the log-on screen says about the game (funeral.cpp:198-236, 268-279). */
export interface LobbyStatus {
  /** `st_game_stats`, legacy markup. */
  gameInfo: string;
  /** `st_no_more`: set when new accounts are refused. */
  closed: string | null;
  /** How many players are online (`how_many_people_are_online(-1)`), by presence. */
  online: number;
  players: number;
}

export function lobbyStatus(town: TownState, ctx: EngineContext): LobbyStatus {
  const t = ctx.content.text.social.lobby;
  const s = town.settings;
  const players = validPlayerCount(town);
  const online = Object.keys(town.sessions).filter((k) => isPresent(town, Number(k))).length;
  let gameInfo: string;
  if (s.tournamentActive) {
    gameInfo = fill(t.tournament, { day: town.day, days: s.tournamentDays, online, players });
    if (tournamentEndsToday(town)) {
      const winner = town.players[topPlayer(town)];
      gameInfo = winner ? fill(t.over, { name: winner.name }) : t.noWinner;
    }
  } else {
    gameInfo = fill(t.endless, { day: town.day, online, players });
  }
  if (town.day === 0) gameInfo = t.dayZero;
  let closed = newPlayersClosed(town, ctx);
  if (!closed && players >= s.maxPlayers) {
    closed = fill(ctx.content.text.newPlayer.townFull, { max: s.maxPlayers });
  }
  return { gameInfo, closed, online, players };
}
