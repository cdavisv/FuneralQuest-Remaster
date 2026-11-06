import { useArtMaybe } from "../art/ArtContext.js";
import type { IconName } from "../art/types.js";
import { useT } from "../i18n/I18nContext.js";
import { useCover } from "./useCover.js";

const TIERS = [1, 2, 3, 4, 5] as const;

/**
 * The graveyard's monuments, cheapest tier first, drawn with the pack's `monument-1` to
 * `monument-5` icons (every pack borrows the Remastered ones). The tiers are bought in order; the
 * View names only the one on offer (its card), so the ladder shows the five stones as a path and
 * the card says which is next. An icon no pack draws leaves a plain number.
 */
export function MonumentLadder({
  next,
  price,
}: {
  next: string | undefined;
  price: string | undefined;
}) {
  const t = useT();
  const art = useArtMaybe();
  return (
    <section
      className="fq-npanel fq-monuments fq-surface-light"
      data-cover={useCover()}
      aria-label={t("x.monument.region")}
    >
      <h2>{t("x.monument.title")}</h2>
      <ol className="fq-monument-tiers" aria-label={t("x.monument.tiers")}>
        {TIERS.map((n) => {
          const src = art?.icon(`monument-${n}` as IconName);
          return (
            <li key={n}>
              {src ? (
                <img src={src} alt="" aria-hidden="true" draggable={false} />
              ) : (
                <span aria-hidden="true" className="fq-monument-num">
                  {n}
                </span>
              )}
              <span>{t("x.monument.tier", { n })}</span>
            </li>
          );
        })}
      </ol>
      {next ? (
        <p className="fq-monument-next">
          {t("x.monument.next")} <b>{next}</b>
          {price && <span> {price}</span>}
        </p>
      ) : (
        <p className="fq-monument-next">{t("x.monument.allBuilt")}</p>
      )}
    </section>
  );
}
