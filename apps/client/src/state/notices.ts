import type { RichText } from "@fq/protocol";
import type { ConnectionState, Notice, SessionEnd } from "../transport/types.js";

export type ToastKind = "broadcast" | "tv" | "server";

export interface Toast {
  id: number;
  kind: ToastKind;
  text: RichText;
}

/** Everything the push channel can leave on screen besides the current View. */
export interface NoticeState {
  toasts: Toast[];
  /** Letters the server said are waiting; 0 when none. */
  mail: number;
  /** The day a "new day has dawned" banner announces, until it is dismissed. */
  newDay: number | null;
  /** Set once the session is over; the game screen is replaced by the "session ended" one. */
  ended: SessionEnd | null;
  /** The tournament's winner (null for none) once a reset has been announced. */
  reset: { winner: string | null } | null;
  connection: ConnectionState;
  nextId: number;
}

export const MAX_TOASTS = 4;

export const initialNotices: NoticeState = {
  toasts: [],
  mail: 0,
  newDay: null,
  ended: null,
  reset: null,
  connection: "online",
  nextId: 1,
};

export type NoticeEvent =
  | { type: "notice"; notice: Notice; scene: string }
  | { type: "connection"; state: ConnectionState }
  | { type: "dismissToast"; id: number }
  | { type: "dismissBanner" }
  /** A View with the lobby scene arrived: the engine took the player out of the game. */
  | { type: "lobbyView" }
  | { type: "mailRead" };

function pushToast(state: NoticeState, kind: ToastKind, text: RichText): NoticeState {
  if (text.length === 0) return state;
  const toasts = [...state.toasts, { id: state.nextId, kind, text }].slice(-MAX_TOASTS);
  return { ...state, toasts, nextId: state.nextId + 1 };
}

export function noticeReducer(state: NoticeState, event: NoticeEvent): NoticeState {
  switch (event.type) {
    case "connection":
      return state.connection === event.state ? state : { ...state, connection: event.state };
    case "dismissToast":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== event.id) };
    case "dismissBanner":
      return { ...state, newDay: null };
    case "mailRead":
      return state.mail === 0 ? state : { ...state, mail: 0 };
    case "lobbyView":
      return state.ended ? state : { ...state, ended: "lost" };
    case "notice": {
      const n = event.notice;
      switch (n.kind) {
        case "broadcast":
          return pushToast(state, "broadcast", n.text);
        case "server":
          return pushToast(state, "server", n.text);
        // The cafe already shows TV lines in its transcript; elsewhere they are a toast.
        case "tv":
          return event.scene === "cafe" ? state : pushToast(state, "tv", n.text);
        // Chat reaches the cafe transcript through the transport's pushed Views.
        case "chat":
          return state;
        case "mail":
          return { ...state, mail: Math.max(0, n.count) };
        case "newDay":
          return { ...state, newDay: n.day };
        case "tournamentReset":
          return { ...state, reset: { winner: n.winner } };
        case "sessionEnded":
          return { ...state, ended: n.reason };
      }
    }
  }
}
