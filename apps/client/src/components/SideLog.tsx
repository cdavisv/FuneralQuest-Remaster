import type { RichText as RichTextSpans } from "@fq/protocol";
import { useEffect, useRef } from "react";
import { useT } from "../i18n/I18nContext.js";
import { useScrollable } from "../util/useScrollable.js";
import { RichText } from "./RichText.js";

/**
 * An entry without the blank lines a screen's text starts or ends with (the rankings screen's
 * text is padded with them, which left a gap of a dozen empty lines in the log). Null when
 * nothing is left.
 */
export function trimEntry(spans: RichTextSpans): RichTextSpans | null {
  const out = spans.map((s) => ({ ...s }));
  while (out.length > 0 && (out[0]?.text ?? "").trim() === "") out.shift();
  while (out.length > 0 && (out[out.length - 1]?.text ?? "").trim() === "") out.pop();
  const first = out[0];
  const last = out[out.length - 1];
  if (!first || !last) return null;
  first.text = first.text.replace(/^\s+/, "");
  last.text = last.text.replace(/\s+$/, "");
  return out;
}

/** Wide layout only: the screens that came before, so the player can look back. */
export function SideLog({ entries }: { entries: RichTextSpans[] }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const scrolls = useScrollable(ref);
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when an entry is added.
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries.length]);
  // Kept at the newest entry when the panel changes size (a font arriving, a window resized),
  // unless the player has scrolled up to read: the last line was left cut in half otherwise.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let pinned = true;
    const onScroll = () => {
      pinned = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
    };
    const observer = new ResizeObserver(() => {
      if (pinned) el.scrollTop = el.scrollHeight;
    });
    el.addEventListener("scroll", onScroll);
    observer.observe(el);
    for (const child of el.children) observer.observe(child);
    return () => {
      el.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, []);
  const shown = entries.map(trimEntry);
  return (
    <aside className="fq-sidelog fq-surface-dark" aria-label={t("log.title")}>
      <h2 className="fq-sidelog-title">{t("log.title")}</h2>
      <div
        className="fq-sidelog-scroll"
        ref={ref}
        {...(scrolls ? { tabIndex: 0, role: "region", "aria-label": t("log.title") } : {})}
      >
        {entries.length === 0 ? (
          <p className="fq-sidelog-empty">{t("log.empty")}</p>
        ) : (
          shown.map((e, i) =>
            e ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: append-only list
              <p key={i} className="fq-sidelog-entry">
                <RichText spans={e} />
              </p>
            ) : null,
          )
        )}
      </div>
    </aside>
  );
}
