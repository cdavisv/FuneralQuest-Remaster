import type { RichText } from "@fq/protocol";
import {
  ApiError,
  REPORT_CATEGORIES,
  type ReportCategory,
  type SafetyTarget,
} from "@fq/server/client";
import { type KeyboardEvent, type ReactNode, useId, useState } from "react";
import { Dialog } from "../components/Dialog.js";
import { findAnnouncements } from "./announcements.js";
import { useModeration } from "./context.js";
import { say } from "./text.js";

/**
 * A modal of the safety screens. It sits above whatever else is open (a letter, Settings), keeps
 * its keys to itself so the game behind does not press its buttons, and closes on Escape.
 */
function ModDialog({
  labelledBy,
  onClose,
  children,
}: {
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
    // Digits, Enter and the rest belong to this dialog, not to the game's keyboard shortcuts.
    if (e.key !== "Tab") e.nativeEvent.stopPropagation();
  };
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: it only keeps key presses from reaching the game behind.
    <div className="fq-mod-root" onKeyDown={onKeyDown}>
      <Dialog className="fq-dialog fq-surface-dark fq-mod-dialog" labelledBy={labelledBy}>
        {children}
      </Dialog>
    </div>
  );
}

const excerpt = (text: string, max = 160) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}...` : flat;
};

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError && error.message ? error.message : fallback;
}

// ------------------------------------------------------------------- report

export function ReportDialog({
  target,
  subject,
  onClose,
}: {
  target: SafetyTarget;
  subject: string;
  onClose: () => void;
}) {
  const mod = useModeration();
  const id = useId();
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [note, setNote] = useState("");
  const [phase, setPhase] = useState<"form" | "sending" | "done">("form");
  const [problem, setProblem] = useState<string | null>(null);
  const [result, setResult] = useState<{
    duplicate: boolean;
    offer: string | null;
    blocked: boolean;
  } | null>(null);
  const [blockNote, setBlockNote] = useState<string | null>(null);
  if (!mod) return null;

  const send = async () => {
    if (!category || phase === "sending") return;
    setPhase("sending");
    setProblem(null);
    try {
      const trimmed = note.trim();
      const r = await mod.api.report({
        townId: mod.townId,
        target,
        category,
        ...(trimmed !== "" ? { note: trimmed } : {}),
      });
      setResult({ duplicate: r.duplicate, offer: r.blockOffer?.name ?? null, blocked: r.blocked });
      setPhase("done");
    } catch (error) {
      setProblem(errorText(error, say("report.failed")));
      setPhase("form");
    }
  };

  const block = async () => {
    try {
      const r = await mod.api.block(mod.townId, target);
      setBlockNote(say("report.blockedToo", { name: r.block.name }));
      setResult((x) => (x ? { ...x, blocked: true } : x));
    } catch (error) {
      setProblem(errorText(error, say("block.failed")));
    }
  };

  if (phase === "done" && result) {
    return (
      <ModDialog labelledBy={id} onClose={onClose}>
        <h2 id={id} className="fq-mod-title">
          {say("report.title")}
        </h2>
        <p className="fq-dialog-text" role="status">
          {result.duplicate ? say("report.duplicate") : say("report.thanks")}
        </p>
        {blockNote && <p className="fq-dialog-text">{blockNote}</p>}
        {!result.blocked && result.offer && (
          <>
            <p className="fq-dialog-text">{say("report.blockOffer", { name: result.offer })}</p>
            <p className="fq-set-note">{say("block.undo")}</p>
          </>
        )}
        {problem && (
          <p className="fq-mod-error" role="alert">
            {problem}
          </p>
        )}
        <div className="fq-dialog-actions">
          {!result.blocked && result.offer && (
            <button type="button" className="fq-dbtn" onClick={() => void block()}>
              {say("menu.block")}
            </button>
          )}
          <button type="button" className="fq-dbtn" data-autofocus onClick={onClose}>
            {say("report.close")}
          </button>
        </div>
      </ModDialog>
    );
  }

  const left = 500 - note.length;
  return (
    <ModDialog labelledBy={id} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <h2 id={id} className="fq-mod-title">
          {say("report.title")}
        </h2>
        <p className="fq-mod-subject">
          <span>{say("report.what")}</span> <q>{excerpt(subject)}</q>
        </p>
        <fieldset className="fq-set-group">
          <legend>{say("report.category")}</legend>
          <div className="fq-mod-choices">
            {REPORT_CATEGORIES.map((c) => (
              <label key={c} className="fq-set-choice">
                <input
                  type="radio"
                  name={`${id}-category`}
                  value={c}
                  checked={category === c}
                  onChange={() => setCategory(c)}
                />
                <span>{say(`report.category.${c}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="fq-mod-label" htmlFor={`${id}-note`}>
          {say("report.note")}
        </label>
        <textarea
          id={`${id}-note`}
          className="fq-mod-note"
          rows={3}
          maxLength={500}
          value={note}
          aria-describedby={`${id}-count`}
          onChange={(e) => setNote(e.target.value)}
        />
        <p className="fq-set-note" id={`${id}-count`}>
          {say("report.noteCount", { left })}
        </p>
        <p className="fq-set-note">{say("report.privacy")}</p>
        {problem && (
          <p className="fq-mod-error" role="alert">
            {problem}
          </p>
        )}
        <div className="fq-dialog-actions">
          <button
            type="submit"
            className="fq-dbtn"
            aria-disabled={category === null || phase === "sending" || undefined}
          >
            {phase === "sending" ? say("report.sending") : say("report.send")}
          </button>
          <button type="button" className="fq-dbtn" onClick={onClose}>
            {say("report.cancel")}
          </button>
        </div>
      </form>
    </ModDialog>
  );
}

// -------------------------------------------------------------------- block

export function BlockDialog({
  target,
  subject,
  onClose,
}: {
  target: SafetyTarget;
  subject: string;
  onClose: () => void;
}) {
  const mod = useModeration();
  const id = useId();
  const [phase, setPhase] = useState<"ask" | "working" | "done">("ask");
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  if (!mod) return null;

  const confirm = async () => {
    if (phase === "working") return;
    setPhase("working");
    setProblem(null);
    try {
      const r = await mod.api.block(mod.townId, target);
      setMessage(say(r.already ? "block.already" : "block.done", { name: r.block.name }));
      setPhase("done");
    } catch (error) {
      setProblem(errorText(error, say("block.failed")));
      setPhase("ask");
    }
  };

  if (phase === "done") {
    return (
      <ModDialog labelledBy={id} onClose={onClose}>
        <h2 id={id} className="fq-mod-title">
          {say("block.doneTitle")}
        </h2>
        <p className="fq-dialog-text" role="status">
          {message}
        </p>
        <div className="fq-dialog-actions">
          <button type="button" className="fq-dbtn" data-autofocus onClick={onClose}>
            {say("block.close")}
          </button>
        </div>
      </ModDialog>
    );
  }
  return (
    <ModDialog labelledBy={id} onClose={onClose}>
      <h2 id={id} className="fq-mod-title">
        {say("block.title", { name: subject })}
      </h2>
      <BlockExplanation name={subject} />
      <p className="fq-set-note">{say("block.undo")}</p>
      {problem && (
        <p className="fq-mod-error" role="alert">
          {problem}
        </p>
      )}
      <div className="fq-dialog-actions">
        <button
          type="button"
          className="fq-dbtn"
          aria-disabled={phase === "working" || undefined}
          onClick={() => void confirm()}
        >
          {say("block.confirm")}
        </button>
        <button type="button" className="fq-dbtn" data-autofocus onClick={onClose}>
          {say("block.cancel")}
        </button>
      </div>
    </ModDialog>
  );
}

function BlockExplanation({ name }: { name: string }) {
  return (
    <div className="fq-mod-explain">
      <p>{say("block.stops", { name })}</p>
      <ul>
        <li>{say("block.does1")}</li>
        <li>{say("block.does2")}</li>
        <li>{say("block.does3")}</li>
      </ul>
      <p>{say("block.doesNot")}</p>
      <ul>
        <li>{say("block.not1")}</li>
        <li>{say("block.not2")}</li>
      </ul>
    </div>
  );
}

// ------------------------------------------------------------ announcements

export function AnnouncementsDialog({
  body,
  onClose,
  onReport,
  onBlock,
}: {
  body: RichText;
  onClose: () => void;
  onReport: (target: SafetyTarget, subject: string) => void;
  onBlock: (target: SafetyTarget, subject: string) => void;
}) {
  const id = useId();
  const items = findAnnouncements(body);
  return (
    <ModDialog labelledBy={id} onClose={onClose}>
      <h2 id={id} className="fq-mod-title">
        {say("news.title")}
      </h2>
      <p className="fq-set-note">{say("news.lead")}</p>
      <ul className="fq-mod-announcements">
        {items.map((a, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the list is read from one page and not reordered
          <li key={i}>
            <p>
              <strong>{say("news.from", { who: a.who, parlor: a.parlor })}</strong>
            </p>
            <p className="fq-mod-snippet">{excerpt(a.text.split("\n").slice(1).join(" "), 140)}</p>
            <div className="fq-mod-row">
              <button
                type="button"
                className="fq-dbtn"
                aria-label={`${say("menu.block")} ${a.who}`}
                onClick={() => onBlock({ kind: "announcement", text: a.text }, a.who)}
              >
                {say("menu.block")}
              </button>
              <button
                type="button"
                className="fq-dbtn"
                aria-label={`${say("menu.report")} ${a.who}`}
                onClick={() => onReport({ kind: "announcement", text: a.text }, a.text)}
              >
                {say("menu.report")}
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="fq-dialog-actions">
        <button type="button" className="fq-dbtn" data-autofocus onClick={onClose}>
          {say("news.close")}
        </button>
      </div>
    </ModDialog>
  );
}

// ----------------------------------------------------------- delete account

export function DeleteAccountDialog({
  guest,
  onClose,
  onDeleted,
}: {
  guest: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const mod = useModeration();
  const id = useId();
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (!mod) return null;

  const submit = async () => {
    if (working) return;
    if (!guest && password === "") {
      setProblem(say("delete.passwordHint"));
      return;
    }
    setWorking(true);
    setProblem(null);
    try {
      await mod.api.deleteAccount(guest ? undefined : password);
      onDeleted();
    } catch (error) {
      setWorking(false);
      if (error instanceof ApiError && error.status === 401) setProblem(say("delete.wrong"));
      else if (error instanceof ApiError && error.status === 429) setProblem(say("delete.locked"));
      else setProblem(say("delete.failed"));
    }
  };

  return (
    <ModDialog labelledBy={id} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <h2 id={id} className="fq-mod-title">
          {say("delete.title")}
        </h2>
        <p className="fq-dialog-text">{say(guest ? "delete.guestBody" : "delete.body")}</p>
        {!guest && (
          <>
            <label className="fq-mod-label" htmlFor={`${id}-pw`}>
              {say("delete.password")}
            </label>
            <input
              id={`${id}-pw`}
              className="fq-mod-input"
              type="password"
              autoComplete="current-password"
              value={password}
              aria-describedby={`${id}-hint`}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="fq-set-note" id={`${id}-hint`}>
              {say("delete.passwordHint")}
            </p>
          </>
        )}
        {problem && (
          <p className="fq-mod-error" role="alert">
            {problem}
          </p>
        )}
        <div className="fq-dialog-actions">
          <button
            type="submit"
            className="fq-dbtn fq-mod-danger"
            aria-disabled={working || undefined}
          >
            {working ? say("delete.working") : say("delete.confirm")}
          </button>
          <button
            type="button"
            className="fq-dbtn"
            data-autofocus={guest || undefined}
            onClick={onClose}
          >
            {say("delete.cancel")}
          </button>
        </div>
      </form>
    </ModDialog>
  );
}
