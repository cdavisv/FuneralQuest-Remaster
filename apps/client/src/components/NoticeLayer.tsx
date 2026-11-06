import { type Dispatch, useEffect, useRef, useState } from "react";
import { useT } from "../i18n/I18nContext.js";
import type { NoticeEvent, NoticeState, Toast } from "../state/notices.js";
import { RichText } from "./RichText.js";

/** How long an unobtrusive notice stays before it fades away. Sysop messages stay until closed. */
export const TOAST_MS = 9000;
export const BANNER_MS = 7000;
const RESTORED_MS = 2500;

function ToastItem({ toast, dispatch }: { toast: Toast; dispatch: Dispatch<NoticeEvent> }) {
  const t = useT();
  const [paused, setPaused] = useState(false);
  const sticky = toast.kind === "server";
  useEffect(() => {
    if (sticky || paused) return;
    const timer = setTimeout(() => dispatch({ type: "dismissToast", id: toast.id }), TOAST_MS);
    return () => clearTimeout(timer);
  }, [sticky, paused, toast.id, dispatch]);
  return (
    <li
      className={`fq-toast fq-toast-${toast.kind} fq-surface-dark`}
      data-kind={toast.kind}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="fq-toast-kind">{t(`notice.kind.${toast.kind}`)}</span>
      <span className="fq-toast-text">
        <RichText spans={toast.text} />
      </span>
      <button
        type="button"
        className="fq-toast-close"
        aria-label={t("notice.dismiss")}
        onClick={() => dispatch({ type: "dismissToast", id: toast.id })}
      >
        <span aria-hidden="true">x</span>
      </button>
    </li>
  );
}

/**
 * Everything the push channel puts on screen without taking over: a slim connection banner,
 * the "new day" banner, and a short stack of toasts for TV, town and sysop messages. All of it
 * is a polite live region, so it never steals focus from a form or the chat box.
 */
export function NoticeLayer({
  state,
  dispatch,
}: {
  state: NoticeState;
  dispatch: Dispatch<NoticeEvent>;
}) {
  const t = useT();
  const [restored, setRestored] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    if (state.connection === "reconnecting") {
      wasOffline.current = true;
      setRestored(false);
      return;
    }
    if (!wasOffline.current) return;
    wasOffline.current = false;
    setRestored(true);
    const timer = setTimeout(() => setRestored(false), RESTORED_MS);
    return () => clearTimeout(timer);
  }, [state.connection]);

  const day = state.newDay;
  useEffect(() => {
    if (day === null) return;
    const timer = setTimeout(() => dispatch({ type: "dismissBanner" }), BANNER_MS);
    return () => clearTimeout(timer);
  }, [day, dispatch]);

  return (
    <div className="fq-notices">
      <div className="fq-banners" role="status" aria-live="polite">
        {state.connection === "reconnecting" && (
          <p className="fq-banner fq-banner-conn" data-state="reconnecting">
            {t("conn.reconnecting")}
          </p>
        )}
        {restored && state.connection === "online" && (
          <p className="fq-banner fq-banner-conn" data-state="online">
            {t("conn.restored")}
          </p>
        )}
        {day !== null && (
          <p className="fq-banner fq-banner-day">
            <span>{t("notice.newDay", { day })}</span>
            <button
              type="button"
              className="fq-toast-close"
              aria-label={t("notice.dismiss")}
              onClick={() => dispatch({ type: "dismissBanner" })}
            >
              <span aria-hidden="true">x</span>
            </button>
          </p>
        )}
      </div>
      {state.toasts.length > 0 && (
        <ul className="fq-toasts" aria-live="polite">
          {state.toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} dispatch={dispatch} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** A small envelope with the number of letters waiting; shown beside Exit and Settings. */
export function MailIndicator({ count }: { count: number }) {
  const t = useT();
  if (count <= 0) return null;
  return (
    <p className="fq-mail" role="status" title={t("notice.mail", { count })}>
      <svg viewBox="0 0 28 20" aria-hidden="true" focusable="false" className="fq-mail-icon">
        <rect x="1" y="1" width="26" height="18" rx="2" fill="#f1e6c8" stroke="#2b1405" />
        <path d="M2 3 L14 12 L26 3" fill="none" stroke="#2b1405" strokeWidth="1.4" />
      </svg>
      <span className="fq-mail-count" aria-hidden="true">
        {count}
      </span>
      <span className="fq-sr">{t("notice.mail", { count })}</span>
    </p>
  );
}
