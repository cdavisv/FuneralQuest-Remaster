import {
  type EngineContext,
  type PlayerState,
  removePlayerText,
  renamePlayer,
  setBlocked,
  type TownState,
} from "@fq/core";

/**
 * Taking a player out of a town's stored state (account deletion, an operator deleting a parlor).
 *
 * The engine does the parts it knows: `removePlayerText` takes down queued letters, announcements,
 * battle quotes and fortunes, and `renamePlayer` swaps the name and parlor in the stored paper,
 * queued mail and the mayor's name. This module then sweeps every other string in the state
 * (the Book of Deeds, other players' stored screens, Expanded boards) for the old names, and
 * blanks the player's own record.
 *
 * Why the slot is deactivated and not kept as a renamed parlor: the engine itself deactivates a
 * parlor that closes (`maintainPlayers`, inactivity), and every rule already treats an inactive
 * slot as gone: not ranked, not visitable, not a target, not in the tournament. A kept "A Closed
 * Parlor" would stay on the board with the departed player's Bury Points, could be visited and
 * robbed with nobody to answer, and would hold a rank that others could never pass. The rename
 * is only for the history: the paper's old days and other players' stored mail keep reading
 * sensibly ("A Closed Parlor beat Bob") with nothing to trace back.
 */

export const CLOSED_PARLOR = "A Closed Parlor";

export interface NameHistory {
  names: readonly string[];
  parlors: readonly string[];
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A whole-word pattern; a colour code (a backtick and one character) counts as a boundary. */
function wholeWord(from: string): RegExp {
  return new RegExp(`(?<=^|[^A-Za-z0-9]|\`.)${escapeRegExp(from)}(?![A-Za-z0-9])`, "g");
}

/** Strings of a player record that identify the player itself; never swept in other players. */
const OWN_IDENTITY = new Set(["name", "parlor", "logon", "email"]);

/**
 * A copy of `value` with every whole-word occurrence of the `from` strings in any string replaced.
 * `players[n].name/parlor/logon/email` are left alone: those are other players' own names.
 */
function sweep<T>(value: T, patterns: readonly RegExp[], to: string, inPlayer = false): T {
  if (typeof value === "string") {
    let text: string = value;
    for (const re of patterns) text = text.replace(re, to);
    return text as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => sweep(v, patterns, to)) as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (inPlayer && OWN_IDENTITY.has(key)) out[key] = v;
      else out[key] = sweep(v, patterns, to);
    }
    return out as T;
  }
  return value;
}

export function sweepNames(town: TownState, names: readonly string[], to: string): TownState {
  const patterns = [...new Set(names)].filter((n) => n.length > 0).map(wholeWord);
  if (patterns.length === 0) return town;
  const { players, ...rest } = town;
  return {
    ...sweep(rest, patterns, to),
    players: players.map((p) => sweep(p, patterns, to, true)),
  } as TownState;
}

export interface ErasedPlayer {
  town: TownState;
  removed: { letters: number; announcements: number; quotes: number; fortunes: number };
}

/** Whether `player` is the slot of the account with this login. */
export function ownsSlot(player: PlayerState | undefined, login: string): player is PlayerState {
  return player !== undefined && player.logon.toLowerCase() === login.toLowerCase();
}

/** The pure part of deleting a parlor. The player's session must already be over. */
export function eraseParlorFrom(
  town: TownState,
  playerId: number,
  ctx: EngineContext,
  history: NameHistory,
): ErasedPlayer {
  const player = town.players[playerId];
  const empty = { letters: 0, announcements: 0, quotes: 0, fortunes: 0 };
  if (!player) return { town, removed: empty };
  const names = [...new Set([player.name, ...history.names])].filter((n) => n !== "");
  const parlors = [...new Set([player.parlor, ...history.parlors])].filter((n) => n !== "");

  let current = town;
  const taken = removePlayerText(current, playerId, ctx, { names });
  current = taken.town;

  // The engine swaps the current name and parlor in the paper, mail and the mayor's name.
  let renamed = renamePlayer(current, playerId, ctx, {
    name: CLOSED_PARLOR,
    parlor: CLOSED_PARLOR,
  });
  for (let n = 2; renamed.error === "nameTaken" && n < 100; n++) {
    renamed = renamePlayer(current, playerId, ctx, {
      name: `${CLOSED_PARLOR} ${n}`,
      parlor: CLOSED_PARLOR,
    });
  }
  if (!renamed.error) current = renamed.town;

  // Everything else: earlier names, the Book of Deeds, other players' stored screens.
  current = sweepNames(current, [...names, ...parlors], CLOSED_PARLOR);

  // Their own record, last: nothing identifying stays on the slot.
  const closed = JSON.parse(JSON.stringify(current)) as TownState;
  const slot = closed.players[playerId] as PlayerState;
  slot.active = false;
  if (renamed.error) slot.name = CLOSED_PARLOR;
  slot.parlor = CLOSED_PARLOR;
  slot.logon = `closed-${playerId}`;
  slot.email = "none";
  slot.mail = [];
  delete closed.sessions[String(playerId)];
  if (closed.presence) delete closed.presence[String(playerId)];
  return { town: setBlocked(closed, playerId, []), removed: taken.removed };
}
