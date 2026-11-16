import type { RichText as RichTextSpans } from "@fq/protocol";
import { type CSSProperties, type ReactNode, type RefObject, useEffect, useRef } from "react";
import { useT } from "../i18n/I18nContext.js";
import { useSettings } from "../settings/settings.js";
import { lineHeight, useFitText } from "../util/useFitText.js";
import { useMoreBelow } from "../util/useMoreBelow.js";
import { useScrollable } from "../util/useScrollable.js";
import { useTypewriter } from "../util/useTypewriter.js";
import { ArrowIcon } from "./Icons.js";
import { RichText, richTextLength } from "./RichText.js";

/** The gold up/down capsule that scrolls the text well. */
export function ScrollCapsule({
  target,
  more = false,
}: {
  target: RefObject<HTMLElement | null>;
  /** There is text below what the well shows: the down arrow says so. */
  more?: boolean;
}) {
  const t = useT();
  const scroll = (dir: 1 | -1) => {
    const el = target.current;
    if (!el) return;
    // By whole lines (all but one of those in view), so a line is never left cut in half.
    const line = lineHeight(el);
    const step = line > 0 ? Math.max(1, Math.floor((el.clientHeight * 0.85) / line)) * line : 0;
    el.scrollBy({ top: dir * Math.max(40, step || el.clientHeight * 0.8), behavior: "smooth" });
  };
  return (
    <div className="fq-capsule">
      <button type="button" aria-label={t("text.scrollUp")} onClick={() => scroll(-1)}>
        <ArrowIcon direction="up" />
      </button>
      <button
        type="button"
        aria-label={t("text.scrollDown")}
        data-more={more || undefined}
        onClick={() => scroll(1)}
      >
        <ArrowIcon direction="down" />
      </button>
    </div>
  );
}

interface TextPanelProps {
  text: RichTextSpans;
  /** Changes whenever the server sent a new screen, so the reveal restarts. */
  revealKey: string;
  status?: RichTextSpans | undefined;
  /** Readout bar above the text (customer or battle). */
  readout?: ReactNode;
  /** Extra content below the text, e.g. the chat form. */
  footer?: ReactNode;
  /** Content rendered inside the scrolling area after the text (chat lines). */
  after?: ReactNode;
  variant?: "well" | "sheet";
  /** Override the colour scheme: a sheet is light (parchment) unless it sits on bare wood. */
  surface?: "light" | "dark";
  /** Skip the typewriter for this panel. */
  instant?: boolean;
  /** When this changes the panel scrolls to the bottom (chat). */
  stickBottomKey?: number;
  rows: number;
  /** Extra design pixels kept clear under the text for button rows the plaque count does not cover. */
  extra?: number;
}

/** The recessed text panel: typewriter reveal with click to skip, scrolling and a status line. */
export function TextPanel({
  text,
  revealKey,
  status,
  readout,
  footer,
  after,
  variant = "well",
  surface,
  instant,
  stickBottomKey,
  rows,
  extra = 0,
}: TextPanelProps) {
  const t = useT();
  const { settings } = useSettings();
  const scrollRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const scrolls = useScrollable(scrollRef);
  const total = richTextLength(text);
  const speed = instant ? "off" : settings.typewriter;
  const tw = useTypewriter(total, revealKey, speed);
  const animated = speed !== "off";
  const more = useMoreBelow(scrollRef, `${revealKey}|${total}`);
  // A well's text a line or two too long for the art is set a little smaller rather than cut off
  // (not when the player chose a larger size, and not for a chat or a table under the text).
  useFitText(
    scrollRef,
    measureRef,
    `${revealKey}|${total}|${animated}`,
    variant === "well" && settings.fontSize === "normal" && !after && stickBottomKey === undefined,
  );

  // A new screen starts at the top.
  // biome-ignore lint/correctness/useExhaustiveDependencies: revealKey is the trigger.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [revealKey]);

  // stickBottomKey is the trigger for scrolling to the end, unless the player scrolled up to
  // read earlier lines: new chat must not yank the text away from them.
  const pinned = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickBottomKey !== undefined && pinned.current) el.scrollTop = el.scrollHeight;
  }, [stickBottomKey]);

  // Enter or Space on the page (not on a control) skips the typewriter.
  const skip = tw.skip;
  const typing = tw.typing;
  useEffect(() => {
    if (!typing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest("button, a, input, textarea, select, [role=dialog]")) return;
      e.preventDefault();
      skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [typing, skip]);

  return (
    <section
      className={`fq-textpanel fq-textpanel-${variant} fq-surface-${surface ?? (variant === "sheet" ? "light" : "dark")}`}
      aria-label={t("text.region")}
      style={
        { "--fq-btn-rows": rows, ...(extra > 0 ? { "--fq-extra": extra } : {}) } as CSSProperties
      }
    >
      {readout}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: click-to-skip is a mouse convenience; Enter and Space do the same from the keyboard. */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: see above. */}
      <div
        className="fq-textscroll"
        ref={scrollRef}
        {...(scrolls ? { tabIndex: 0, role: "region", "aria-label": t("scroll.region") } : {})}
        onClick={() => {
          if (typing) skip();
        }}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
        title={typing ? t("text.skipHint") : undefined}
        aria-live="polite"
      >
        {animated && (
          // The whole text, laid out unseen, so the fit is chosen for the text the typewriter is
          // still writing.
          <div className="fq-text-measure" aria-hidden="true">
            <div className="fq-text" ref={measureRef}>
              <RichText spans={text} />
            </div>
          </div>
        )}
        <div className="fq-text">
          {animated ? (
            <>
              <span className="fq-sr">
                <RichText spans={text} />
              </span>
              <span aria-hidden="true">
                <RichText spans={text} limit={tw.shown} />
              </span>
            </>
          ) : (
            <RichText spans={text} />
          )}
        </div>
        {after}
      </div>
      {footer}
      <ScrollCapsule target={scrollRef} more={more} />
      {status && status.length > 0 && (
        <p className="fq-status" role="status">
          <RichText spans={status} />
        </p>
      )}
    </section>
  );
}
