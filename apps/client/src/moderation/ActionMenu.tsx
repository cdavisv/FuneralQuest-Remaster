import type { ChatSpeaker, RichText } from "@fq/protocol";
import type { SafetyTarget } from "@fq/server/client";
import { type KeyboardEvent, useId, useRef, useState } from "react";
import { findAnnouncements } from "./announcements.js";
import { useModeration } from "./context.js";
import { say } from "./text.js";

export interface ReportChoice {
  /** The menu entry, when there is more than one thing to report. */
  label?: string;
  target: SafetyTarget;
  /** What the report form shows as the thing reported. */
  subject: string;
}

/**
 * A small "Report or block" menu next to someone else's name or words. It renders nothing outside
 * an online session, so Solo, the mock and the Daily Challenge never show it.
 */
export function ActionMenu({
  who,
  block,
  reports,
  className,
}: {
  /** The name used in labels and in the block dialog. */
  who: string;
  /** What blocking points at; null when only reporting makes sense. */
  block: { target: SafetyTarget; subject?: string } | null;
  reports: ReportChoice[];
  className?: string;
}) {
  const mod = useModeration();
  const id = useId();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  if (!mod?.self) return null;

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Escape closes the menu; the controls inside are real buttons.
    <span className={`fq-mod-menu ${className ?? ""}`} onKeyDown={onKeyDown}>
      <button
        ref={button}
        type="button"
        className="fq-mod-toggle"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={say("menu.openFor", { who })}
        title={say("menu.open")}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">...</span>
      </button>
      {open && (
        // biome-ignore lint/a11y/useSemanticElements: a span keeps the buttons inline in a line of text, which a fieldset cannot.
        <span id={id} className="fq-mod-pop" role="group" aria-label={say("menu.open")}>
          {block && (
            <button
              type="button"
              className="fq-mod-item"
              onClick={() => {
                setOpen(false);
                mod.openBlock(block.target, block.subject ?? who);
              }}
            >
              {say("menu.block")}
            </button>
          )}
          {reports.map((r) => (
            <button
              key={r.label ?? "report"}
              type="button"
              className="fq-mod-item"
              onClick={() => {
                setOpen(false);
                mod.openReport(r.target, r.subject);
              }}
            >
              {r.label ?? say("menu.report")}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

/** The name before the first colon of a cafe line ("Name: text", "Name yells: text"). */
export function speakerOf(line: string): string | null {
  const m = /^([^:]{1,40}?)(?: yells)?: /.exec(line);
  return m?.[1]?.trim() || null;
}

/**
 * Report or block the author of a cafe line, unless it is the player's own. An Expanded line says
 * who spoke as data (`from`: the player id and name), so the report names the player and does not
 * depend on the line's wording; every spoken line has the menu, `/me` and `/give` too. A Classic
 * line carries no speaker, so only the lines whose text says who spoke ("Name: text", "Name
 * yells: text") get the menu: arrivals, the TV and the help text are not anyone's words.
 */
export function ChatLineActions({ text, from }: { text: string; from?: ChatSpeaker | undefined }) {
  const mod = useModeration();
  if (!mod?.self) return null;
  if (from) {
    if (from.playerId === mod.self.playerId) return null;
    const target: SafetyTarget = { kind: "chat", text, fromPlayerId: from.playerId };
    return (
      <ActionMenu
        who={from.name}
        block={{ target, subject: from.name }}
        reports={[{ target, subject: text }]}
      />
    );
  }
  const speaker = speakerOf(text);
  if (!speaker || speaker === mod.self.name) return null;
  return (
    <ActionMenu
      who={speaker}
      block={{ target: { kind: "chat", text }, subject: speaker }}
      reports={[{ target: { kind: "chat", text }, subject: text }]}
    />
  );
}

/** Report or block the sender of a rankings row, or report the parlor's name. */
export function RankingRowActions({
  playerId,
  name,
  parlor,
}: {
  playerId: number;
  name: string;
  parlor: string;
}) {
  const mod = useModeration();
  if (!mod?.self) return null;
  if (mod.self.playerId === playerId) return null;
  return (
    <ActionMenu
      who={name}
      block={{ target: { kind: "player", playerId }, subject: name }}
      reports={[
        { label: say("rank.reportName"), target: { kind: "player", playerId }, subject: name },
        {
          label: say("rank.reportParlor"),
          target: { kind: "parlorName", playerId },
          subject: parlor,
        },
      ]}
    />
  );
}

/** Report or block the author of the letter on screen. */
export function LetterActions({ text }: { text: string }) {
  const mod = useModeration();
  if (!mod?.self) return null;
  const target: SafetyTarget = { kind: "letter", text };
  const sender = /letter from ([^:\n]+):/.exec(text)?.[1]?.trim() ?? "this sender";
  return (
    <>
      <button type="button" className="fq-dbtn" onClick={() => mod.openBlock(target, sender)}>
        {say("letter.block")}
      </button>
      <button type="button" className="fq-dbtn" onClick={() => mod.openReport(target, text)}>
        {say("letter.report")}
      </button>
    </>
  );
}

/**
 * Fortunes and battle quotes reach the player as a message from Yang's or after a fight. Reports
 * only: the wording tells which they are; any other message (the management's, the paper's) gets
 * no button.
 */
export function MessageActions({ text }: { text: string }) {
  const mod = useModeration();
  if (!mod?.self) return null;
  const kind = /fortune cookie|chinese food/i.test(text)
    ? "fortune"
    : /yelled while escaping|moaning from the ambulance/i.test(text)
      ? "quote"
      : null;
  if (!kind) return null;
  return (
    <button type="button" className="fq-dbtn" onClick={() => mod.openReport({ kind, text }, text)}>
      {say("message.report")}
    </button>
  );
}

/** A link on the newspaper that lists the page's announcements for blocking or reporting. */
export function AnnouncementsButton({ body }: { body: RichText }) {
  const mod = useModeration();
  if (!mod?.self) return null;
  if (findAnnouncements(body).length === 0) return null;
  return (
    <button
      type="button"
      className="fq-linkbtn fq-mod-news"
      onClick={() => mod.openAnnouncements(body)}
    >
      {say("news.menu")}
    </button>
  );
}
