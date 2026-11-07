import type { Action, View } from "@fq/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import { SendError, type SendFailure, type Transport } from "../transport/types.js";

export type GameStatus = "connecting" | "ready" | "failed" | "closed";

export interface GameState {
  status: GameStatus;
  view: View | null;
  /** True while an action is in flight; further input is ignored until it answers. */
  busy: boolean;
  /** Set when `send` rejected (and why); the UI shows it and `dismissError` clears it. */
  sendError: SendFailure | null;
  /** Increments each time a response to the player's own action arrives. */
  responseId: number;
}

export interface GameApi extends GameState {
  dispatch: (action: Action) => void;
  dismissError: () => void;
  /** Reconnect after a failure or after the player left. */
  reconnect: () => void;
  /** Leave: closes the transport. */
  leave: () => void;
  /** Tell the server the player is logging off, then leave. Leaves even if the server is unreachable. */
  exit: () => Promise<void>;
}

/** Owns the transport lifecycle and the current View. Contains no game rules. */
export function useGame(transport: Transport): GameApi {
  const [state, setState] = useState<GameState>({
    status: "connecting",
    view: null,
    busy: false,
    sendError: null,
    responseId: 0,
  });
  const busyRef = useRef(false);
  /** Cafe lines typed while an answer is awaited; sent in order, one at a time. */
  const queued = useRef<Action[]>([]);
  const generation = useRef(0);
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` re-runs connection on demand.
  useEffect(() => {
    const gen = ++generation.current;
    let alive = true;
    busyRef.current = false;
    queued.current = [];
    setState({ status: "connecting", view: null, busy: false, sendError: null, responseId: 0 });
    const off = transport.onPush((view) => {
      if (alive) setState((s) => ({ ...s, view }));
    });
    transport.connect().then(
      (view) => {
        if (alive && generation.current === gen) {
          setState((s) => ({ ...s, status: "ready", view, responseId: s.responseId + 1 }));
        }
      },
      () => {
        if (alive && generation.current === gen) setState((s) => ({ ...s, status: "failed" }));
      },
    );
    return () => {
      alive = false;
      off();
      transport.close();
    };
  }, [transport, attempt]);

  const dispatch = useCallback(
    (action: Action) => {
      if (busyRef.current) {
        // A button pressed twice is one press: the second is dropped. A line of cafe talk is
        // somebody's words, already cleared from the box: it waits its turn instead of vanishing.
        if (action.type === "chat" && queued.current.length < 10) queued.current.push(action);
        return;
      }
      busyRef.current = true;
      const gen = generation.current;
      setState((s) => ({ ...s, busy: true }));
      const next = () => {
        const following = queued.current.shift();
        if (following && generation.current === gen) dispatch(following);
      };
      transport.send(action).then(
        (view) => {
          busyRef.current = false;
          if (generation.current !== gen) return;
          setState((s) => ({ ...s, view, busy: false, responseId: s.responseId + 1 }));
          next();
        },
        (error: unknown) => {
          busyRef.current = false;
          queued.current = [];
          if (generation.current !== gen) return;
          const failure = error instanceof SendError ? error.failure : "network";
          setState((s) => ({ ...s, busy: false, sendError: failure }));
        },
      );
    },
    [transport],
  );

  const dismissError = useCallback(() => setState((s) => ({ ...s, sendError: null })), []);
  const reconnect = useCallback(() => setAttempt((n) => n + 1), []);
  const leave = useCallback(() => {
    generation.current++;
    transport.close();
    busyRef.current = false;
    queued.current = [];
    setState((s) => ({ ...s, status: "closed", busy: false }));
  }, [transport]);

  const exit = useCallback(async () => {
    const gen = generation.current;
    try {
      await transport.send({ type: "exit" });
    } catch {
      // Leaving must work even when the server cannot be reached; it logs the player off on idle.
    }
    if (generation.current === gen) leave();
  }, [transport, leave]);

  return { ...state, dispatch, dismissError, reconnect, leave, exit };
}
