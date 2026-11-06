import type { CustomerPanel } from "@fq/protocol";
import { useEffect, useId, useRef, useState } from "react";
import { gaugeFor } from "../expanded/gauge.js";
import { useT } from "../i18n/I18nContext.js";
import { useScrollable } from "../util/useScrollable.js";
import { EstimateGauge } from "./EstimateGauge.js";
import { RichText } from "./RichText.js";

const nf = new Intl.NumberFormat("en-US");
const dollars = (n: number) => (n < 0 ? `-$${nf.format(-n)}` : `$${nf.format(n)}`);

/** Patience as pips: one per action left, spent ones hollow. */
export function PatiencePips({ left, max }: { left: number; max: number }) {
  const t = useT();
  const n = Math.max(0, Math.min(max, 20));
  return (
    <span className="fq-pips">
      <meter
        className="fq-sr"
        min={0}
        max={Math.max(1, max)}
        value={left}
        aria-label={t("x.file.patience", { left, max })}
      />
      <span className="fq-pips-row" aria-hidden="true">
        {Array.from({ length: n }, (_, i) => (
          <i
            // biome-ignore lint/suspicious/noArrayIndexKey: pips have no identity
            key={i}
            data-on={i < left ? "" : undefined}
            data-last={left <= 2 && i < left ? "" : undefined}
          />
        ))}
      </span>
    </span>
  );
}

/** Trait chips; the hint shows on hover and focus and on a tap, one line under the row. */
export function TraitChips({ traits }: { traits: NonNullable<CustomerPanel["traits"]> }) {
  const t = useT();
  const uid = useId();
  // A hint is open while the pointer or focus is on a trait, and stays open ("pinned") once the
  // trait is tapped or clicked, until it is tapped again. A tap on a touch screen also looks like
  // a hover to the browser, so the click must not toggle what the hover just opened.
  const [shown, setShown] = useState<{ id: string; pinned: boolean } | null>(null);
  const open = shown?.id ?? null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: the trait list changes per customer.
  useEffect(() => setShown(null), [traits.map((x) => x.id).join(",")]);
  if (traits.length === 0) return null;
  const current = traits.find((x) => x.id === open);
  return (
    <div className="fq-traits">
      <ul aria-label={t("x.file.traits")}>
        {traits.map((trait) => (
          <li key={trait.id}>
            <button
              type="button"
              className="fq-trait"
              aria-expanded={open === trait.id}
              aria-controls={`${uid}-hint`}
              aria-describedby={`${uid}-${trait.id}`}
              title={trait.hint}
              data-on={open === trait.id || undefined}
              onClick={() =>
                setShown((s) =>
                  s?.id === trait.id && s.pinned ? null : { id: trait.id, pinned: true },
                )
              }
              onMouseEnter={() =>
                setShown((s) => (s?.pinned ? s : { id: trait.id, pinned: false }))
              }
              onMouseLeave={() => setShown((s) => (s?.id === trait.id && !s.pinned ? null : s))}
              onFocus={() => setShown((s) => (s?.pinned ? s : { id: trait.id, pinned: false }))}
              onBlur={() => setShown((s) => (s?.id === trait.id ? null : s))}
            >
              {trait.label}
            </button>
            <span id={`${uid}-${trait.id}`} className="fq-sr">
              {trait.hint}
            </span>
          </li>
        ))}
      </ul>
      <p id={`${uid}-hint`} className="fq-trait-hint" aria-live="polite" hidden={!current}>
        {current?.hint}
      </p>
    </div>
  );
}

export function BillTable({
  bill,
  total,
}: {
  bill: NonNullable<CustomerPanel["bill"]>;
  total: number;
}) {
  const t = useT();
  if (bill.length === 0) return <p className="fq-bill-empty">{t("x.file.bill.empty")}</p>;
  return (
    <table className="fq-bill">
      <tbody>
        {bill.map((line, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a bill may repeat a label
          <tr key={i} data-neg={line.price < 0 || undefined}>
            <th scope="row">{line.label}</th>
            <td>{dollars(line.price)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">{t("x.file.bill.total")}</th>
          <td>{dollars(total)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

/**
 * The customer's file, pinned where the parchment note is: name and who died, the special
 * customer's badge, the visible traits, patience, the estimate against the bill, and what you
 * have learned and the itemised bill on two tabs (both are shown at once on a phone).
 */
export function CustomerFile({
  customer,
  status,
  stacked,
  negotiating = true,
}: {
  customer: CustomerPanel;
  /** The bonus rule line, offered behind the gauge's "why". */
  status?: string | undefined;
  /** Phone: every part shown, no tabs. */
  stacked?: boolean;
  /**
   * False for an offer (the county's contract, Cousin Sal): the customer panel is there but there
   * is nothing to haggle over, so no estimate gauge, patience or bill.
   */
  negotiating?: boolean;
}) {
  const t = useT();
  const uid = useId();
  const model = negotiating ? gaugeFor(customer) : null;
  const notes = customer.notes ?? [];
  const bill = customer.bill ?? [];
  const [tab, setTab] = useState<"notes" | "bill">("notes");
  const notesPane = useRef<HTMLDivElement>(null);
  const billPane = useRef<HTMLDivElement>(null);
  const notesScroll = useScrollable(notesPane);
  const billScroll = useScrollable(billPane);
  const [why, setWhy] = useState(false);
  // A new customer starts on the notes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the name identifies the customer.
  useEffect(() => setTab("notes"), [customer.name]);
  const notesBody =
    notes.length === 0 ? (
      <p className="fq-notes-none">{t("x.file.noNotes")}</p>
    ) : (
      <ul className="fq-notes">
        {notes.map((n, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: notes are append-only
          <li key={i}>
            <RichText spans={n} />
          </li>
        ))}
      </ul>
    );
  const billBody = <BillTable bill={bill} total={customer.total} />;
  return (
    <section
      className="fq-file fq-surface-light"
      aria-label={t("x.file.region")}
      data-stacked={stacked || undefined}
    >
      <header className="fq-file-head">
        <div className="fq-file-who">
          <h2 className="fq-file-name">{customer.name ?? customer.incomeLabel}</h2>
          {customer.deceased && (
            <p className="fq-file-dead">{t("x.file.for", { deceased: customer.deceased })}</p>
          )}
        </div>
        <div className="fq-file-side">
          {customer.special && (
            <span className="fq-special" title={t("x.file.special")}>
              {customer.special}
            </span>
          )}
          {negotiating && customer.patience && (
            <PatiencePips left={customer.patience.left} max={customer.patience.max} />
          )}
          {customer.track && (
            <span className="fq-track" data-track={customer.track}>
              {customer.track === "cremation"
                ? t("x.file.track.cremation")
                : t("x.file.track.burial")}
            </span>
          )}
        </div>
      </header>
      {customer.traits && <TraitChips traits={customer.traits} />}
      {model && (
        <div className="fq-file-gauge">
          <EstimateGauge model={model} rule={why ? status : undefined} />
          {status && (
            <button
              type="button"
              className="fq-why"
              aria-expanded={why}
              onClick={() => setWhy((w) => !w)}
            >
              {t("x.gauge.rule")}
            </button>
          )}
        </div>
      )}
      {!negotiating ? (
        <div className="fq-file-body">
          <h3 className="fq-file-h">{t("x.file.tabNotes")}</h3>
          {notesBody}
        </div>
      ) : stacked ? (
        <div className="fq-file-body">
          <h3 className="fq-file-h">{t("x.file.tabNotes")}</h3>
          {notesBody}
          <h3 className="fq-file-h">{t("x.file.tabBill")}</h3>
          {billBody}
        </div>
      ) : (
        <div className="fq-file-tabs">
          <div role="tablist" aria-label={t("x.file.region")} className="fq-tabs">
            <button
              type="button"
              role="tab"
              id={`${uid}-t1`}
              aria-selected={tab === "notes"}
              aria-controls={`${uid}-p1`}
              onClick={() => setTab("notes")}
            >
              {t("x.file.tabNotes")}
              {notes.length > 0 && <small>{notes.length}</small>}
            </button>
            <button
              type="button"
              role="tab"
              id={`${uid}-t2`}
              aria-selected={tab === "bill"}
              aria-controls={`${uid}-p2`}
              onClick={() => setTab("bill")}
            >
              {t("x.file.tabBill")}
              {bill.length > 0 && <small>{bill.length}</small>}
            </button>
          </div>
          <div
            role="tabpanel"
            id={`${uid}-p1`}
            aria-labelledby={`${uid}-t1`}
            hidden={tab !== "notes"}
            className="fq-file-pane"
            ref={notesPane}
            {...(notesScroll ? { tabIndex: 0 } : {})}
          >
            {notesBody}
          </div>
          <div
            role="tabpanel"
            id={`${uid}-p2`}
            aria-labelledby={`${uid}-t2`}
            hidden={tab !== "bill"}
            className="fq-file-pane"
            ref={billPane}
            {...(billScroll ? { tabIndex: 0 } : {})}
          >
            {billBody}
          </div>
        </div>
      )}
    </section>
  );
}
