import type { View } from "@fq/protocol";
import type { Turn } from "../engine/turn.js";
import type { SessionState } from "../state/types.js";
import { fill } from "../text/format.js";
import { emptyCustomer } from "./customerText.js";
import { broadcast, keepHighImportanceMail } from "./mail.js";
import { battleOnDisconnect } from "./modules/battle.js";
import { finishSale } from "./modules/negotiation.js";
import { killScript } from "./scripts/runtime.js";

export function newSession(now: number): SessionState {
  return {
    status: "play",
    location: "",
    gaveLogonMessage: false,
    scene: "news",
    sceneData: null,
    customer: emptyCustomer(),
    hisId: -1,
    locked: false,
    script: null,
    view: null,
    loggedOnAt: now,
  };
}

/** `online_global::logon` (legacy/source/online_util.cpp:265-288). */
export function logOn(turn: Turn): void {
  const id = turn.playerId;
  turn.town.sessions[String(id)] = newSession(turn.engine.now);
  turn.player.lastLogon = turn.engine.now;
}

/**
 * `online_global::online_delete_guy` (legacy/source/online_util.cpp:112-177):
 * stop any script, give the player a sale they were in the middle of (by
 * mail), keep only high-importance mail, and go offline.
 */
export function endSession(turn: Turn, reason: "quit" | "timeout" | "replaced"): void {
  const key = String(turn.playerId);
  const session = turn.town.sessions[key];
  if (!session) return;
  battleOnDisconnect(turn);
  killScript(turn);
  if (session.customer.active && session.customer.flow === "negotiation") {
    // Expanded completes its own sale (LocationModule.sessionEnd); Classic has none.
    const negotiation = turn.registry.module("neg");
    if (negotiation?.sessionEnd) negotiation.sessionEnd(turn);
    else finishSale(turn, true);
  } else if (session.scene !== "neg") {
    // An Expanded flow left open (a graveyard duel, docs/expanded-rules.md 16.4); no Classic module has one.
    turn.registry.module(session.scene)?.sessionEnd?.(turn);
  }
  // A Daily Challenge run is played once: leaving ends it (docs/expanded-rules.md 24.2).
  const challenge = turn.town.expanded?.challenge;
  if (challenge) challenge.finished = true;
  keepHighImportanceMail(turn.town, turn.playerId);
  delete turn.town.sessions[key];
  turn.effects.push({ kind: "sessionEnded", playerId: turn.playerId, reason });
}

/** `command_quit` (legacy/source/commands_misc.cpp:50-60). */
export function quit(turn: Turn): View {
  broadcast(turn, fill(turn.text.session.loggedOff, { name: turn.player.name }));
  endSession(turn, "quit");
  return lobbyView();
}

/** What a player who is not logged on sees. */
export function lobbyView(): View {
  return { scene: "lobby", title: "Funeral Quest", text: [], buttons: [] };
}
