import type { GameRow } from "../expanded/club.js";
import { useT } from "../i18n/I18nContext.js";
import { useCover } from "./useCover.js";

const nf = new Intl.NumberFormat("en-US");

/**
 * The Reaper Club's back tables: one row per game with its rule in a line and a button for each
 * stake, so what you risk is on the button. The engine's own explanation stays in the text.
 */
export function GameBoard({ rows, onPress }: { rows: GameRow[]; onPress: (id: string) => void }) {
  const t = useT();
  return (
    <section
      className="fq-npanel fq-games fq-surface-light"
      data-cover={useCover()}
      aria-label={t("x.club.board")}
    >
      <h2>{t("x.club.board")}</h2>
      {rows.map((row) => (
        <div key={row.game} className="fq-game" data-game={row.game}>
          <h3 title={t(`x.club.${row.game}.rule` as "x.club.draw.rule")}>
            {t(`x.club.${row.game}` as "x.club.draw")}
            <span className="fq-sr"> - {t(`x.club.${row.game}.rule` as "x.club.draw.rule")}</span>
          </h3>
          <ul>
            {row.cards.map((c) => {
              const disabled = c.button.enabled === false;
              return (
                <li key={c.button.id}>
                  <button
                    type="button"
                    className="fq-stake"
                    data-button-id={c.button.id}
                    aria-disabled={disabled || undefined}
                    aria-label={`${t(`x.club.${row.game}` as "x.club.draw")}, ${t("x.club.stake", { amount: `$${nf.format(c.stake)}` })}`}
                    title={c.button.hint}
                    onClick={() => {
                      if (!disabled) onPress(c.button.id);
                    }}
                  >
                    ${nf.format(c.stake)}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
