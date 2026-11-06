import type { BankPanel as BankData } from "@fq/protocol";
import { useRef } from "react";
import { type BankFocus, hasLoan, percent, transferUsed } from "../expanded/bank.js";
import { useT } from "../i18n/I18nContext.js";
import { useScrollable } from "../util/useScrollable.js";
import { useCover } from "./useCover.js";

const nf = new Intl.NumberFormat("en-US");
const dollars = (n: number) => `$${nf.format(n)}`;

function Savings({ bank }: { bank: BankData }) {
  const t = useT();
  return (
    <section className="fq-bank-block" aria-label={t("x.bank.savings")}>
      <h3>{t("x.bank.savings")}</h3>
      <dl>
        <div>
          <dt>{t("x.bank.balance")}</dt>
          <dd>{dollars(bank.savings)}</dd>
        </div>
        <div>
          <dt>{t("x.bank.rate")}</dt>
          <dd>{t("x.bank.perDay", { pct: percent(bank.savingsRate) })}</dd>
        </div>
        <div>
          <dt>{t("x.bank.tonight")}</dt>
          <dd>+{dollars(bank.interestTonight)}</dd>
        </div>
        <div>
          <dt>{t("x.bank.cap")}</dt>
          <dd>{dollars(bank.savingsCap)}</dd>
        </div>
      </dl>
      {!bank.canDeposit && <p className="fq-bank-note">{t("x.bank.noDeposit")}</p>}
    </section>
  );
}

function Loan({ bank }: { bank: BankData }) {
  const t = useT();
  const loan = bank.loan;
  return (
    <section className="fq-bank-block" aria-label={t("x.bank.loan")}>
      <h3>{t("x.bank.loan")}</h3>
      {hasLoan(bank) && (
        <p className="fq-bank-debt" role="status">
          <b>{t("x.bank.owed", { amount: dollars(loan.owed ?? 0) })}</b>{" "}
          {loan.daysLeft === undefined
            ? t("x.bank.due", { day: loan.due ?? 0 })
            : loan.daysLeft <= 0
              ? t("x.bank.dueToday")
              : t("x.bank.dueIn", { count: loan.daysLeft, day: loan.due ?? 0 })}
        </p>
      )}
      <dl aria-label={t("x.bank.terms")}>
        <div>
          <dt>{t("x.bank.limit")}</dt>
          <dd>{dollars(loan.limit)}</dd>
        </div>
        <div>
          <dt>{t("x.bank.interest")}</dt>
          <dd>{t("x.bank.perDay", { pct: percent(loan.rate) })}</dd>
        </div>
        <div>
          <dt>{t("x.bank.fee")}</dt>
          <dd>{t("x.bank.upFront", { pct: percent(loan.fee) })}</dd>
        </div>
        <div>
          <dt>{t("x.bank.term")}</dt>
          <dd>
            {t("x.bank.termDays", { count: loan.termDays })}
            {!hasLoan(bank) && <small> {t("x.bank.dueIfTaken", { day: loan.dueIfTaken })}</small>}
          </dd>
        </div>
      </dl>
      {!loan.canBorrow && loan.reason && !hasLoan(bank) && (
        <p className="fq-bank-note">{loan.reason}</p>
      )}
    </section>
  );
}

function Transfers({ bank }: { bank: BankData }) {
  const t = useT();
  const tr = bank.transfers;
  return (
    <section className="fq-bank-block" aria-label={t("x.bank.transfers")}>
      <h3>{t("x.bank.transfers")}</h3>
      <p className="fq-bank-limit">
        <meter
          min={0}
          max={Math.max(1, tr.dailyMax)}
          value={Math.min(tr.sent, tr.dailyMax)}
          aria-label={t("x.bank.sentToday", { sent: tr.sent, max: tr.dailyMax })}
          data-full={transferUsed(bank) >= 1 || undefined}
        />{" "}
        {t("x.bank.sentToday", { sent: tr.sent, max: tr.dailyMax })}
      </p>
      <dl>
        <div>
          <dt>{t("x.bank.received")}</dt>
          <dd>{t("x.bank.receivedToday", { got: tr.received, max: tr.dailyMax })}</dd>
        </div>
        <div>
          <dt>{t("x.bank.tellerKeeps")}</dt>
          <dd>{percent(tr.feeShare)}%</dd>
        </div>
        <div>
          <dt>{t("x.bank.tagValues")}</dt>
          <dd>
            {t("x.bank.tagValuesIs", {
              wood: tr.values[0],
              silver: tr.values[1],
              gold: tr.values[2],
            })}
          </dd>
        </div>
      </dl>
      {!tr.canSend && tr.reason && <p className="fq-bank-note">{tr.reason}</p>}
    </section>
  );
}

/**
 * The bank's parchment, from `View.bank`: savings with tonight's interest, the loan's terms (shown
 * before borrowing: limit, daily rate, up-front fee, term and the day it would fall due) and the
 * debt with the days left once there is one, and the tag-transfer allowance. The part the screen
 * is about comes first. Nothing is computed here; the engine's numbers are shown as they are.
 */
export function BankPanel({ bank, focus }: { bank: BankData; focus: BankFocus }) {
  const t = useT();
  const scroller = useRef<HTMLDivElement>(null);
  const scrolls = useScrollable(scroller);
  const blocks = {
    savings: <Savings key="s" bank={bank} />,
    loan: <Loan key="l" bank={bank} />,
    transfers: <Transfers key="t" bank={bank} />,
  };
  const order =
    focus === "savings"
      ? [blocks.savings, blocks.loan, blocks.transfers]
      : focus === "transfers"
        ? [blocks.transfers, blocks.savings, blocks.loan]
        : [blocks.loan, blocks.savings, blocks.transfers];
  return (
    <section
      className="fq-npanel fq-bank fq-surface-light"
      data-cover={useCover()}
      data-focus={focus}
      aria-label={t("x.bank.region")}
    >
      <div
        className="fq-bank-scroll"
        ref={scroller}
        {...(scrolls ? { tabIndex: 0, role: "region", "aria-label": t("scroll.region") } : {})}
      >
        {order}
      </div>
    </section>
  );
}
