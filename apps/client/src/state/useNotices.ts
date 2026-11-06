import { type Dispatch, useEffect, useReducer } from "react";
import type { LiveTransport } from "../transport/types.js";
import { initialNotices, type NoticeEvent, type NoticeState, noticeReducer } from "./notices.js";

/**
 * Feeds the transport's push channel (notices and connection state) into `noticeReducer`.
 * A transport without a push channel (the mock, the tests' scripted one) just never produces
 * events. `scene` is the current scene id, which decides whether a TV line is a toast.
 */
export function useNotices(
  transport: LiveTransport,
  scene: string | undefined,
): [NoticeState, Dispatch<NoticeEvent>] {
  const [state, dispatch] = useReducer(noticeReducer, initialNotices);
  useEffect(() => {
    const offNotice = transport.onNotice?.((notice) =>
      dispatch({ type: "notice", notice, scene: scene ?? "" }),
    );
    const offConnection = transport.onConnection?.((s) =>
      dispatch({ type: "connection", state: s }),
    );
    return () => {
      offNotice?.();
      offConnection?.();
    };
  }, [transport, scene]);
  return [state, dispatch];
}
