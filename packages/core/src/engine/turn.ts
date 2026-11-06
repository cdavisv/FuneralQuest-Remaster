import type { RichText } from "@fq/protocol";
import type { ClassicText } from "../content/classicText.js";
import type { ContentPack } from "../content/types.js";
import type { ClassicRandom } from "../rng/classicRandom.js";
import { openStream, positionOf, TOWN_STREAM } from "../rng/streams.js";
import type { ClassicRules, GameSettings } from "../rules/classicRules.js";
import type { PlayerState, SessionState, TownState } from "../state/types.js";
import type { Registry } from "./registry.js";

/** Everything a call into the engine needs besides the state. */
export interface EngineContext {
  rules: ClassicRules;
  content: ContentPack;
  registry: Registry;
  /** Wall-clock time in ms since epoch. Only stored (last logon and so on); never drives rules. */
  now: number;
}

/** Side effects for the host. State changes are already in the returned town. */
export type Effect =
  /** `LogMsg`: a line for the server log. */
  | { kind: "log"; text: string }
  /**
   * `broadcast_tv`: a TV report, for logs and tickers. Emitted whether or not
   * the cafe TV is on. Delivery to the cafe is a separate `chat` effect, sent
   * only while the TV is on; do not deliver this one to the cafe as well.
   */
  | { kind: "tv"; text: RichText }
  /**
   * `broadcast`: a notice for every player online. Already queued as mail for
   * players outside the cafe; players in the cafe get it as a `chat` effect.
   */
  | { kind: "broadcast"; text: string }
  /**
   * A cafe line the host must deliver now to each player in `to` (players in
   * the cafe, never the acting player: their own lines are in the returned
   * view's `chat`). Not stored anywhere; a player who misses it never sees it,
   * like the original's normal-importance packets. `to` names only active,
   * logged-on players.
   */
  | { kind: "chat"; to: number[]; text: RichText }
  | { kind: "playerCreated"; playerId: number }
  | { kind: "playerDeleted"; playerId: number; reason: "inactive" | "noSales" }
  | {
      kind: "sessionEnded";
      playerId: number;
      reason: "quit" | "timeout" | "replaced" | "reset";
    }
  /** No longer emitted: maintenance now resets the town itself (see `tournamentReset`). */
  | { kind: "tournamentResetDue" }
  /**
   * Midnight after the tournament's final day: the town was reset
   * (`reset_game`, legacy/source/reset_game.cpp) and is on day 1 again with no
   * players. Every session was ended first (`sessionEnded`, reason "reset").
   * The host should drop its own per-player state (accounts, connections).
   */
  | { kind: "tournamentReset"; winner: string | null };

function streamKey(key: number): string {
  return key === TOWN_STREAM ? "town" : String(key);
}

/**
 * One engine call in progress: the draft town plus helpers. Handlers mutate
 * `town` freely; the engine cloned it on entry. Random draws come from the
 * acting player's stream for the current day (or the town's, for
 * maintenance), and the stream position is written back by `commit`.
 */
export class Turn {
  private stream: ClassicRandom | null = null;
  private streamDay = 0;
  private override: ClassicRandom | null = null;

  constructor(
    readonly town: TownState,
    readonly engine: EngineContext,
    /** The acting player, or `TOWN_STREAM` (-1) for maintenance. */
    readonly playerId: number,
    readonly effects: Effect[] = [],
  ) {}

  get rules(): ClassicRules {
    return this.engine.rules;
  }

  get settings(): GameSettings {
    return this.town.settings;
  }

  get content(): ContentPack {
    return this.engine.content;
  }

  get text(): ClassicText {
    return this.engine.content.text;
  }

  get registry(): Registry {
    return this.engine.registry;
  }

  get player(): PlayerState {
    const player = this.town.players[this.playerId];
    if (!player) throw new Error(`No player ${this.playerId}`);
    return player;
  }

  get session(): SessionState {
    const session = this.town.sessions[String(this.playerId)];
    if (!session) throw new Error(`Player ${this.playerId} is not logged on`);
    return session;
  }

  /** The seeded stream for the acting player (or the town) and the current day. */
  get rng(): ClassicRandom {
    if (this.override) return this.override;
    const day = this.town.day;
    if (this.stream && this.streamDay === day) return this.stream;
    if (this.stream) this.saveStream();
    const key = streamKey(this.playerId);
    this.stream = openStream(this.town.seed, this.playerId, day, this.town.streams[key]);
    this.streamDay = day;
    return this.stream;
  }

  /**
   * Runs `fn` with `rng` standing in for the acting player's stream (the
   * Daily Challenge draws each customer from its own stream so every player
   * meets the same ones, docs/expanded-rules.md section 24). The player's
   * stream is untouched.
   */
  withStream<T>(rng: ClassicRandom, fn: () => T): T {
    const before = this.override;
    this.override = rng;
    try {
      return fn();
    } finally {
      this.override = before;
    }
  }

  log(text: string): void {
    this.effects.push({ kind: "log", text });
  }

  private saveStream(): void {
    if (!this.stream) return;
    this.town.streams[streamKey(this.playerId)] = positionOf(this.stream, this.streamDay);
  }

  /** Writes the stream position back into the town. */
  commit(): void {
    this.saveStream();
  }
}
