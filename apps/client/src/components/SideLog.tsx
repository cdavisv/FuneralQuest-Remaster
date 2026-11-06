import type { RichText as RichTextSpans } from "@fq/protocol";
import { useEffect, useRef } from "react";
import { useT } from "../i18n/I18nContext.js";
import { useScrollable } from "../util/useScrollable.js";
import { RichText } from "./RichText.js";

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
          entries.map((e, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: append-only list
            <p key={i} className="fq-sidelog-entry">
              <RichText spans={e} />
            </p>
          ))
        )}
      </div>
    </aside>
  );
}
