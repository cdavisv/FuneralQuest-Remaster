import { AsyncLocalStorage } from "node:async_hooks";
import { parseLegacyText } from "@fq/core";
import {
  ABORT_TEXT,
  type BridgeReply,
  encodeBody,
  type LegacyBridge,
  Logon,
  parseRequestQuery,
  RETURN_COMMAND,
  Request,
  Sent,
} from "@fq/legacy-compat";
import type { Action } from "@fq/protocol";
import type { TownRuntime } from "../game/town.js";
import { type ModerationService, SafetyError } from "../moderation/service.js";

/**
 * Mutes and the strict word list for museum players.
 *
 * The original client cannot show a report or block button, but a museum player is a player: the
 * server applies the same rules to what it says. Blocks already reach museum players because they
 * live in the engine's town state, which the bridge reads on every call. Mutes and the word list
 * are enforced here, at the one place the server sees the original client's requests, by looking
 * at the request before the bridge acts on it.
 *
 * What the original client can show is limited, so the refusals differ:
 * - a muted cafe line is dropped and a notice is added to the player's cafe transcript;
 * - a muted letter, battle quote, announcement or fortune, and a refused announcement or name,
 *   come back as the client's error line ("the server had a problem"), which is the only
 *   message the old client can show for them, and ends that log-on.
 */

/** Set by the museum host while a call is running, so a log-on can say which player it was. */
const call = new AsyncLocalStorage<{ playerId: number | null }>();

/** The museum host calls this when a log-on or a new parlor resolves to a player. */
export function noteLoggedOn(playerId: number): void {
  const store = call.getStore();
  if (store) store.playerId = playerId;
}

const fatal = (token: string, text: string): BridgeReply => {
  const vars = [
    ["g_st_error", text],
    ["i_sent", Sent.fatal],
  ] as const;
  return { token, body: encodeBody(vars), vars };
};

export interface MuseumSafetyDeps {
  moderation: ModerationService;
  town: () => TownRuntime;
}

/** Wraps `bridge.handle` with the safety checks. Call once, when the bridge exists. */
export function installMuseumSafety(bridge: LegacyBridge, deps: MuseumSafetyDeps): void {
  const inner = bridge.handle.bind(bridge);
  /** Which player each browser (bridge token) is logged on as. */
  const players = new Map<string, number>();

  const refuse = (error: unknown): string => {
    if (error instanceof SafetyError) return error.message;
    throw error;
  };

  /** What the request would publish, if anything: its mute scope and the text for the word list. */
  const publishes = (
    playerId: number,
    rawQuery: string,
  ): { action: Action; announcement: boolean } | null => {
    const request = parseRequestQuery(rawQuery);
    if (request.verb !== "command") return null;
    const p = request.params;
    const cmd = Number.parseInt(p.get("i_command") ?? "", 10);
    if (cmd === Request.chatUpdate) {
      const text = p.get("st_input") ?? "";
      return text.trim() === "" ? null : { action: { type: "chat", text }, announcement: false };
    }
    if (cmd === Request.announcement) {
      return {
        action: {
          type: "submitText",
          overlayId: "news:announcement",
          text: p.get("st_note") ?? "",
        },
        announcement: true,
      };
    }
    if (cmd === Request.sendMail) {
      return {
        action: { type: "submitText", overlayId: "mailbox:compose", text: p.get("st_input") ?? "" },
        announcement: false,
      };
    }
    if (cmd === RETURN_COMMAND) {
      const text = p.get("st_extra_text") ?? "";
      const overlay = deps.town().snapshotState.sessions[String(playerId)]?.view?.overlay;
      if (overlay?.kind !== "textInput" || text === ABORT_TEXT) return null;
      return {
        action: { type: "submitText", overlayId: overlay.id, text },
        announcement: overlay.id === "news:announcement" || overlay.id.endsWith(":chainname"),
      };
    }
    return null;
  };

  const guarded = async (token: string | undefined, rawQuery: string): Promise<BridgeReply> => {
    const request = parseRequestQuery(rawQuery);
    const town = deps.town();
    const mod = deps.moderation;

    // New User: the names meet the strict word list before the engine is asked.
    if (request.verb === "new") {
      const p = request.params;
      for (const [field, text, what] of [
        ["name", p.get("name") ?? "", "name"],
        ["parlor", p.get("f_name") ?? "", "parlor name"],
        ["logon", p.get("logon") ?? "", "name"],
      ] as const) {
        try {
          mod.assertTextAllowed(null, text, what, town.id);
        } catch (error) {
          const vars = [
            ["g_st_error", refuse(error)],
            ["i_sent", field === "logon" ? Logon.newPageTwo : Logon.newPageOne],
          ] as const;
          return { token: token ?? "", body: encodeBody(vars), vars };
        }
      }
    }

    const playerId = token === undefined ? undefined : players.get(token);
    let query = rawQuery;
    if (playerId !== undefined) {
      const accountId = mod.accountOfPlayer(town.id, playerId);
      const out = publishes(playerId, rawQuery);
      if (accountId !== null && out) {
        const account = { id: accountId } as Parameters<ModerationService["assertMayAct"]>[0];
        try {
          mod.assertMayAct(account, out.action);
          if (out.announcement && out.action.type === "submitText" && out.action.text !== null) {
            mod.assertTextAllowed(account, out.action.text, "announcement", town.id);
          }
        } catch (error) {
          const message = refuse(error);
          if (out.action.type === "chat") {
            // Say nothing to the cafe; tell the player in their own transcript.
            bridge.deliverChat(playerId, parseLegacyText(`\`4${message}`));
            query = rawQuery.replace(/(^|&)st_input=[^&]*/, "$1st_input=");
          } else {
            return fatal(token ?? "", message);
          }
        }
      }
    }

    const store: { playerId: number | null } = { playerId: null };
    const reply = await call.run(store, () => inner(token, query));
    if (request.verb === "checklogon") players.delete(reply.token);
    else if ((request.verb === "logon" || request.verb === "new") && store.playerId !== null) {
      players.set(reply.token, store.playerId);
    } else if (request.verb === "logon" || request.verb === "new") players.delete(reply.token);
    return reply;
  };

  bridge.handle = guarded;
}
