import type { BoardRow } from "@fq/protocol";
import { useT } from "../i18n/I18nContext.js";
import { useCover } from "./useCover.js";

const nf = new Intl.NumberFormat("en-US");

/** The chains' season score board, the viewer's own row highlighted (docs/expanded-rules.md 23.2). */
export function BoardTable({
  rows,
  title,
  plain,
}: {
  rows: BoardRow[];
  title?: string | undefined;
  /** Not in the parchment slot: no panel of its own (the front door). */
  plain?: boolean;
}) {
  const t = useT();
  const cover = useCover();
  if (rows.length === 0) {
    return <p className="fq-board-empty">{t("x.board.empty")}</p>;
  }
  return (
    <section
      className={`${plain ? "" : "fq-npanel "}fq-board fq-surface-light`}
      data-cover={plain ? undefined : cover}
      aria-label={title ?? t("x.board.region")}
    >
      <table>
        <caption>{title ?? t("x.board.region")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("x.board.place")}</th>
            <th scope="col">{t("x.board.name")}</th>
            <th scope="col">{t("x.board.score")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={`${r.place}:${r.name}`}
              data-mine={r.mine || undefined}
              aria-current={r.mine ? "true" : undefined}
            >
              <td>{r.place}</td>
              <th scope="row">
                {r.name}
                <small>{r.detail}</small>
                {r.mine && <em> {t("x.board.mine")}</em>}
              </th>
              <td>{nf.format(r.score)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
