import type { Button, OfficePanel, UpgradeRow } from "@fq/protocol";
import { useId, useRef } from "react";
import { useT } from "../i18n/I18nContext.js";
import { useScrollable } from "../util/useScrollable.js";
import { useCover } from "./useCover.js";

const nf = new Intl.NumberFormat("en-US");
const dollars = (n: number) => `$${nf.format(n)}`;

const ORDER: UpgradeRow["state"][] = ["available", "unaffordable", "locked", "owned"];

function Requirements({ row }: { row: UpgradeRow }) {
  const t = useT();
  if (!row.requires || row.requires.length === 0) return null;
  return (
    <ul className="fq-up-req" aria-label={t("x.up.needs")}>
      {row.requires.map((r) => (
        <li key={`${r.kind}:${r.id}`} data-have={r.have || undefined}>
          <span aria-hidden="true">{r.have ? "✓" : "✗"}</span>
          <span className="fq-sr">{r.have ? t("x.up.have") : t("x.up.missing")}: </span>
          {r.name}
          <small>{t(r.kind === "permit" ? "x.up.permit" : "x.up.upgrade")}</small>
        </li>
      ))}
    </ul>
  );
}

function Row({
  row,
  button,
  index,
  money,
  onPress,
}: {
  row: UpgradeRow;
  button: Button | undefined;
  index: number;
  money: number | undefined;
  onPress: (id: string) => void;
}) {
  const t = useT();
  const uid = useId();
  const can = row.state === "available" && button !== undefined && button.enabled !== false;
  const short = row.state === "unaffordable" && money !== undefined ? row.price - money : undefined;
  const status =
    row.state === "owned"
      ? t("x.up.owned")
      : row.state === "available"
        ? t("x.up.available")
        : row.state === "unaffordable"
          ? short !== undefined && short > 0
            ? t("x.up.short", { amount: dollars(short) })
            : t("x.up.noCash")
          : t("x.up.locked");
  const body = (
    <>
      <span className="fq-up-head">
        <span className="fq-up-name">{row.name}</span>
        <span className="fq-up-price">{row.state === "owned" ? "" : dollars(row.price)}</span>
      </span>
      <span id={`${uid}-d`} className="fq-up-desc">
        {row.description}
      </span>
      <span className="fq-up-tags">
        {row.rating > 0 && <span>{t("x.up.rating", { n: row.rating })}</span>}
        {row.building && <span>{t("x.up.building")}</span>}
        <b className="fq-up-state" data-state={row.state}>
          {row.state === "owned" && <span aria-hidden="true">{"✓ "}</span>}
          {status}
        </b>
      </span>
      {row.state === "locked" && row.reason && <span className="fq-up-reason">{row.reason}</span>}
    </>
  );
  return (
    <li className="fq-up" data-state={row.state}>
      {row.state === "owned" ? (
        // An owned upgrade has no buy card at all. A locked one keeps its (disabled) card.
        <div className="fq-up-card" aria-describedby={`${uid}-d`}>
          {body}
          <Requirements row={row} />
        </div>
      ) : (
        <button
          type="button"
          className="fq-up-card"
          data-button-id={row.buttonId}
          aria-disabled={!can || undefined}
          aria-describedby={`${uid}-d`}
          aria-keyshortcuts={index >= 0 && index < 9 ? String(index + 1) : undefined}
          onClick={() => {
            if (can && row.buttonId) onPress(row.buttonId);
          }}
        >
          {body}
          <Requirements row={row} />
        </button>
      )}
    </li>
  );
}

/**
 * The contractor's catalogue, from `View.office.upgrades`: every upgrade, owned ones included,
 * grouped by what the player can do about it (buy now, short of cash, locked, owned), each with
 * its price, rating, description, and for a locked one the reason and what it needs. Buying
 * presses the engine's own buy card, so the number keys and the engine's checks stay the truth.
 */
export function UpgradeShelf({
  office,
  buttons,
  money,
  onPress,
}: {
  office: OfficePanel;
  buttons: Button[];
  money: number | undefined;
  onPress: (id: string) => void;
}) {
  const t = useT();
  const scroller = useRef<HTMLDivElement>(null);
  const scrolls = useScrollable(scroller);
  return (
    <section
      className="fq-npanel fq-shelf fq-upgrades fq-surface-light"
      data-cover={useCover()}
      aria-label={t("x.deck.shelf")}
    >
      <header>
        <h2>{t("x.deck.shelf")}</h2>
        <span>
          {t("x.up.count", {
            owned: office.upgrades.filter((u) => u.state === "owned").length,
            total: office.upgrades.length,
          })}
        </span>
      </header>
      <div
        className="fq-up-scroll"
        ref={scroller}
        {...(scrolls ? { tabIndex: 0, role: "region", "aria-label": t("scroll.region") } : {})}
      >
        {ORDER.map((state) => {
          const rows = office.upgrades.filter((u) => u.state === state);
          if (rows.length === 0) return null;
          return (
            <section key={state} className="fq-up-group" aria-label={t(`x.up.group.${state}`)}>
              <h3>{t(`x.up.group.${state}`)}</h3>
              <ul>
                {rows.map((row) => {
                  const index = buttons.findIndex((b) => b.id === row.buttonId);
                  return (
                    <Row
                      key={row.id}
                      row={row}
                      button={buttons[index]}
                      index={index}
                      money={money}
                      onPress={onPress}
                    />
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </section>
  );
}
