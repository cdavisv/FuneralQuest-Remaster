import { type KeyboardEvent, useId, useMemo, useRef, useState } from "react";
import { Dialog } from "../components/Dialog.js";
import { useT } from "../i18n/I18nContext.js";
import { useBackHandler } from "../util/back.js";
import { soloOnly } from "../util/soloOnly.js";
import "../styles/feedback.css";
import { browserDetails, buildReport, detectRuleset, feedbackDestination } from "./report.js";
import { buildVersion } from "./version.js";

/** Copies `text`; the clipboard API where the page may use it, else a selected textarea. */
async function copyText(text: string, fallback: HTMLTextAreaElement | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (!fallback) return false;
    fallback.focus();
    fallback.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    }
  }
}

/**
 * "Send feedback": a prefilled report (version, build, ruleset, browser, the title of the screen
 * the player came from) and a box for what happened. Nothing is sent from here: the player copies
 * the text and takes it to the destination the dialog names (a marked blank until the owner
 * chooses one). A solo-only build leaves the browser details out; nothing leaves the device.
 */
export function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const id = useId();
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState<"idle" | "yes" | "no">("idle");
  const reportBox = useRef<HTMLTextAreaElement>(null);
  const solo = soloOnly();
  // Read once, when the dialog opens: the screen the player is reporting about.
  const context = useMemo(
    () => ({
      version: buildVersion(),
      ruleset: detectRuleset(),
      screen: document.title,
      soloOnly: solo,
      browser: solo ? undefined : browserDetails(),
    }),
    [solo],
  );
  const report = buildReport({ ...context, note });
  const destination = feedbackDestination();
  useBackHandler(() => {
    onClose();
    return true;
  });

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
    // Digits and the rest belong to this dialog, not to the game's keyboard shortcuts.
    if (e.key !== "Tab") e.nativeEvent.stopPropagation();
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: it only keeps key presses from reaching the game behind.
    <div className="fq-feedback-root" onKeyDown={onKeyDown}>
      <Dialog className="fq-dialog fq-surface-dark fq-feedback" labelledBy={id}>
        <h2 id={id} className="fq-settings-title">
          {t("feedback.title")}
        </h2>
        <p className="fq-set-note">{t("feedback.intro")}</p>
        <label className="fq-feedback-label" htmlFor={`${id}-note`}>
          {t("feedback.note")}
        </label>
        <textarea
          id={`${id}-note`}
          className="fq-feedback-note"
          data-testid="feedback-note"
          data-autofocus
          rows={4}
          maxLength={4000}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setCopied("idle");
          }}
        />
        <label className="fq-feedback-label" htmlFor={`${id}-report`}>
          {t("feedback.report")}
        </label>
        <textarea
          id={`${id}-report`}
          ref={reportBox}
          className="fq-feedback-report"
          data-testid="feedback-report"
          readOnly
          rows={8}
          value={report}
        />
        <p className="fq-set-note">{solo ? t("feedback.private.solo") : t("feedback.private")}</p>
        <p className="fq-set-note" data-testid="feedback-destination">
          {t("feedback.destination")} <strong>{destination}</strong>
        </p>
        <p className="fq-feedback-status" role="status" aria-live="polite">
          {copied === "yes" && t("feedback.copied")}
          {copied === "no" && t("feedback.copyFailed")}
        </p>
        <div className="fq-dialog-actions">
          <button
            type="button"
            className="fq-dbtn"
            data-testid="feedback-copy"
            onClick={() =>
              void copyText(report, reportBox.current).then((ok) => setCopied(ok ? "yes" : "no"))
            }
          >
            {t("feedback.copy")}
          </button>
          <button type="button" className="fq-dbtn" onClick={onClose}>
            {t("feedback.close")}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
