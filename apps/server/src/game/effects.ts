import { type Effect, parseLegacyText, type TownState } from "@fq/core";
import type { View } from "@fq/protocol";
import type { EndReason, Notice, ServerMessage } from "../wire.js";

/**
 * Turning engine effects into host work.
 *
 * The engine returns `Effect`s alongside the new town. This module is the
 * single place that decides what each one means for the server, and it is an
 * exhaustive switch on `effect.kind`: when the engine gains a new effect type
 * `assertNever` stops this file compiling, so a new effect can never be
 * silently dropped.
 */

/** Who receives a push. */
export type Recipient =
  | { to: "player"; playerId: number }
  | { to: "players"; playerIds: number[] }
  /** Every open socket in the town, whatever its player is doing. */
  | { to: "connected" };

export interface Outbound {
  recipient: Recipient;
  message: ServerMessage;
}

/** Work the host does itself, after the town is saved. */
export type HostCommand =
  /** The slot no longer belongs to the account that held it. */
  | { kind: "unlinkParlor"; playerId: number }
  /** Every parlor is gone (the engine reset the town). */
  | { kind: "unlinkAllParlors" }
  /** Close a player's sockets. */
  | { kind: "closePlayer"; playerId: number; reason: EndReason }
  /** The engine asked the host to reset the town (older engines; newer ones reset themselves). */
  | { kind: "resetTown"; reason: "tournament" }
  /** The player's session ended: stop reporting them as connected. */
  | { kind: "clearPresence"; playerId: number };

export interface LogLine {
  level: "info" | "warn";
  text: string;
}

export interface EffectPlan {
  pushes: Outbound[];
  commands: HostCommand[];
  logs: LogLine[];
  /** Rows for the audit log (kind, data). */
  audit: { kind: string; data: unknown }[];
}

export interface PlanOptions {
  /** Report this reason instead of the engine's for a `sessionEnded` (a kick says "kicked", not "timeout"). */
  endReason?: EndReason;
}

/** What a player whose session ended sees (the engine's `lobbyView`, which its index does not export). */
const LOBBY_VIEW: View = { scene: "lobby", title: "Funeral Quest", text: [], buttons: [] };

function assertNever(value: never): never {
  throw new Error(`Unhandled engine effect: ${JSON.stringify(value)}`);
}

export function notice(notice: Notice, at: number): ServerMessage {
  return { type: "notice", notice, at };
}

/** Ids of players with a session who are not sitting in the cafe. */
function onlineOutsideCafe(town: TownState): number[] {
  return Object.entries(town.sessions)
    .filter(([key, session]) => session.status !== "chat" && town.players[Number(key)]?.active)
    .map(([key]) => Number(key));
}

/**
 * Maps every effect from one engine call to pushes, host commands, log lines
 * and audit rows. `after` is the town the engine returned, used to work out
 * who is online.
 */
export function planEffects(
  effects: readonly Effect[],
  after: TownState,
  at: number,
  options: PlanOptions = {},
): EffectPlan {
  const plan: EffectPlan = { pushes: [], commands: [], logs: [], audit: [] };
  for (const effect of effects) {
    switch (effect.kind) {
      case "log":
        plan.logs.push({ level: "info", text: effect.text });
        plan.audit.push({ kind: "effect:log", data: { text: effect.text } });
        break;
      case "tv":
        // For logs and tickers only: the engine sends the cafe its own `chat` effect.
        plan.audit.push({ kind: "effect:tv", data: { text: effect.text } });
        break;
      case "broadcast":
        // Players in the cafe get this as a `chat` effect; everyone else online gets the notice.
        plan.pushes.push({
          recipient: { to: "players", playerIds: onlineOutsideCafe(after) },
          message: notice({ kind: "broadcast", text: parseLegacyText(effect.text) }, at),
        });
        plan.audit.push({ kind: "effect:broadcast", data: { text: effect.text } });
        break;
      case "chat":
        plan.pushes.push({
          recipient: { to: "players", playerIds: effect.to },
          message: notice({ kind: "chat", text: effect.text }, at),
        });
        break;
      case "playerCreated":
        plan.audit.push({ kind: "effect:playerCreated", data: { playerId: effect.playerId } });
        break;
      case "playerDeleted":
        plan.pushes.push(
          {
            recipient: { to: "player", playerId: effect.playerId },
            message: { type: "view", view: LOBBY_VIEW, at },
          },
          {
            recipient: { to: "player", playerId: effect.playerId },
            message: notice({ kind: "sessionEnded", reason: "deleted" }, at),
          },
        );
        plan.commands.push(
          { kind: "unlinkParlor", playerId: effect.playerId },
          { kind: "closePlayer", playerId: effect.playerId, reason: "deleted" },
        );
        plan.audit.push({
          kind: "effect:playerDeleted",
          data: { playerId: effect.playerId, reason: effect.reason },
        });
        break;
      case "sessionEnded": {
        const reason: EndReason = options.endReason ?? effect.reason;
        // The View first: a client that stops listening on the notice has already shown the lobby.
        plan.pushes.push(
          {
            recipient: { to: "player", playerId: effect.playerId },
            message: { type: "view", view: LOBBY_VIEW, at },
          },
          {
            recipient: { to: "player", playerId: effect.playerId },
            message: notice({ kind: "sessionEnded", reason }, at),
          },
        );
        plan.commands.push(
          { kind: "clearPresence", playerId: effect.playerId },
          { kind: "closePlayer", playerId: effect.playerId, reason },
        );
        plan.audit.push({
          kind: "effect:sessionEnded",
          data: { playerId: effect.playerId, reason },
        });
        break;
      }
      case "tournamentResetDue":
        // Checked against @fq/core on 2026-11-05: the engine no longer emits this (maintenance
        // resets the town itself and emits `tournamentReset`, below), but `Effect` in
        // packages/core/src/engine/turn.ts still lists it as deprecated, so this exhaustive switch
        // must keep a case. Delete both together when core drops the member.
        plan.commands.push({ kind: "resetTown", reason: "tournament" });
        plan.audit.push({ kind: "effect:tournamentResetDue", data: null });
        plan.logs.push({ level: "info", text: "tournament over: the host resets the town" });
        break;
      case "tournamentReset":
        // The engine already replaced the town. Drop what the host tied to the old players.
        plan.pushes.push({
          recipient: { to: "connected" },
          message: notice({ kind: "tournamentReset", winner: effect.winner }, at),
        });
        plan.commands.push({ kind: "unlinkAllParlors" });
        plan.audit.push({ kind: "effect:tournamentReset", data: { winner: effect.winner } });
        plan.logs.push({
          level: "info",
          text: `tournament over, town reset (winner: ${effect.winner ?? "nobody"})`,
        });
        break;
      default:
        return assertNever(effect);
    }
  }
  return plan;
}

/**
 * Pushes for changes the engine made to players other than the actor, found by
 * comparing the town before and after. This needs no per-effect knowledge:
 *  - if another online player's last-sent View changed, push the new View;
 *  - newly queued mail (anything but plain broadcast lines, which the
 *    `broadcast` effect covers) becomes one `mail` notice.
 */
export function diffPushes(
  before: TownState,
  after: TownState,
  actorId: number | null,
  at: number,
): Outbound[] {
  const out: Outbound[] = [];
  for (const [key, session] of Object.entries(after.sessions)) {
    const playerId = Number(key);
    if (playerId === actorId) continue;
    const prior = before.sessions[key];
    if (!prior) continue;
    const to: Recipient = { to: "player", playerId };

    if (session.view && JSON.stringify(prior.view) !== JSON.stringify(session.view)) {
      out.push({ recipient: to, message: { type: "view", view: session.view, at } });
    }

    const oldMail = before.players[playerId]?.mail.length ?? 0;
    const mail = after.players[playerId]?.mail ?? [];
    if (mail.length <= oldMail) continue;
    let letters = 0;
    let other = 0;
    for (const packet of mail.slice(oldMail)) {
      // A "simpleText" with normal importance is a broadcast line (see `broadcast`).
      if (packet.type === "simpleText" && packet.importance === "normal") continue;
      if (packet.type === "chat") continue;
      if (packet.type === "text") letters++;
      else other++;
    }
    // One letter is several packets (text, quote, buttons); count the texts.
    const count = letters > 0 ? letters : other > 0 ? 1 : 0;
    if (count > 0) out.push({ recipient: to, message: notice({ kind: "mail", count }, at) });
  }
  return out;
}
