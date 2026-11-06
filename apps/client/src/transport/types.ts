import type { Action, View } from "@fq/protocol";
import type { EndReason, Notice } from "@fq/server/client";

export type Unsubscribe = () => void;

/**
 * How the client talks to a game. Everything the UI knows about the server is here.
 *
 * - `connect` opens the session and resolves with the first View.
 * - `send` reports one player action and resolves with the View that answers it.
 * - `onPush` delivers Views nobody asked for (chat lines, a rival's attack, a new day).
 * - `close` ends the session; the transport must not call listeners afterwards.
 *
 * The mock transport (`src/mock`) and the real one (`src/net/SessionTransport.ts`, over
 * `ServerTransport` from `@fq/server/client`) both implement it.
 */
export interface Transport {
  connect(): Promise<View>;
  send(action: Action): Promise<View>;
  onPush(listener: (view: View) => void): Unsubscribe;
  close(): void;
}

export type { EndReason, Notice };

/** Why a session ended: the server's reasons, or `lost` when the client only learnt it was gone. */
export type SessionEnd = EndReason | "lost";

/** `online`: the push socket is attached. `reconnecting`: it dropped and is being re-opened. */
export type ConnectionState = "online" | "reconnecting";

/**
 * A transport with a push channel besides Views: broadcasts, mail, a new day, the end of the
 * session, and whether the push socket is up. Both are optional so a plain `Transport` works.
 */
export interface LiveTransport extends Transport {
  onNotice?(listener: (notice: Notice) => void): Unsubscribe;
  onConnection?(listener: (state: ConnectionState) => void): Unsubscribe;
}

/** Why `send` failed, in terms a player can act on. */
export type SendFailure = "network" | "rate" | "server";

export class SendError extends Error {
  constructor(readonly failure: SendFailure) {
    super(`send failed: ${failure}`);
    this.name = "SendError";
  }
}
