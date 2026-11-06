import type { BingoPanel } from "@fq/protocol";
import { bingoCells, cardsLeft, drawWhen } from "../expanded/bingo.js";
import { useT } from "../i18n/I18nContext.js";
import { CoffinIcon } from "./Icons.js";
import { useCover } from "./useCover.js";

/**
 * Bingo Night, from `View.bingo`: the card grid with the cards taken by anyone and the player's
 * own, the pot (the carry-over from nights nobody held the winner shown apart), the price, the
 * cards left, and when the winning card is drawn.
 */
export function BingoSheet({ bingo }: { bingo: BingoPanel }) {
  const t = useT();
  const cover = useCover();
  const when = drawWhen(bingo);
  const left = cardsLeft(bingo);
  return (
    <section
      className="fq-npanel fq-bingo fq-surface-light"
      data-cover={cover}
      aria-label={t("x.bingo.title")}
    >
      <header className="fq-bingo-head">
        <h2>{t("x.bingo.title")}</h2>
        <p className="fq-bingo-key" aria-hidden="true">
          <i data-state="mine" /> {t("x.bingo.keyMine")} <i data-state="taken" />{" "}
          {t("x.bingo.keyTaken")}
        </p>
      </header>
      <ol className="fq-bingo-cells" aria-label={t("x.bingo.cards")}>
        {bingoCells(bingo).map((c) => (
          <li key={c.n} data-state={c.state}>
            <span className="fq-sr">{t(`x.bingo.${c.state}` as "x.bingo.mine", { n: c.n })}</span>
            <span aria-hidden="true">{c.n}</span>
          </li>
        ))}
      </ol>
      <p className="fq-bingo-pot">
        <span>{t("x.bingo.pot")}</span>
        <b>
          {bingo.pot} <CoffinIcon kind="wood" />
        </b>
        {bingo.carry > 0 && <small>{t("x.bingo.carry", { n: bingo.carry })}</small>}
      </p>
      <dl className="fq-bingo-facts">
        <div>
          <dt>{t("x.bingo.price")}</dt>
          <dd>{t("x.bingo.priceWood", { n: bingo.price })}</dd>
        </div>
        <div>
          <dt>{t("x.bingo.left")}</dt>
          <dd>
            {left} / {bingo.cards}
          </dd>
        </div>
        <div>
          <dt>{t("x.bingo.yours")}</dt>
          <dd>
            {bingo.mine.length} / {bingo.maxPerPlayer}
          </dd>
        </div>
        <div>
          <dt>{t("x.bingo.draw")}</dt>
          <dd>
            {when === "cancelled"
              ? t("x.bingo.cancelled")
              : when === "tonight"
                ? t("x.bingo.tonight")
                : t("x.bingo.inDays", { count: bingo.daysLeft })}
          </dd>
        </div>
      </dl>
      {bingo.nextFree && <p className="fq-bingo-free">{t("x.bingo.nextFree")}</p>}
    </section>
  );
}
