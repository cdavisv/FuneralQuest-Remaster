import type { MonumentsPanel } from "@fq/protocol";
import { useArtMaybe } from "../art/ArtContext.js";
import type { IconName } from "../art/types.js";
import { useT } from "../i18n/I18nContext.js";
import { useCover } from "./useCover.js";

const TIERS = [1, 2, 3, 4, 5] as const;

/**
 * The graveyard's monuments, cheapest tier first, drawn with the pack's `monument-1` to
 * `monument-5` icons (every pack borrows the Remastered ones). The tiers are bought in order.
 * The View's `monuments` says how many stand: those stones are lit, the rest dimmed, each with its
 * name, price and what it earns on hover and to a screen reader. Without it (an older engine) the
 * ladder shows the five stones as a path and the card says which is next. An icon no pack draws
 * leaves a plain number.
 */
export function MonumentLadder({
  next,
  price,
  monuments,
}: {
  next: string | undefined;
  price: string | undefined;
  monuments?: MonumentsPanel | undefined;
}) {
  const t = useT();
  const art = useArtMaybe();
  // The stonecutter's screen names the next tier on its card; the graveyard's other screens have
  // no card, so the next tier comes from the View's own record of what stands (11.5).
  const coming =
    monuments && monuments.built < monuments.tiers.length
      ? monuments.tiers[monuments.built]
      : undefined;
  const nextName = next ?? coming?.name;
  const nextPrice =
    next !== undefined ? price : coming ? `$${coming.price.toLocaleString("en-US")}` : undefined;
  return (
    <section
      className="fq-npanel fq-monuments fq-surface-light"
      data-cover={useCover()}
      aria-label={t("x.monument.region")}
    >
      <h2>{t("x.monument.title")}</h2>
      <ol className="fq-monument-tiers" aria-label={t("x.monument.tiers")}>
        {(monuments ? monuments.tiers.map((_, i) => i + 1) : [...TIERS]).map((n) => {
          const src = art?.icon(`monument-${Math.min(n, 5)}` as IconName);
          const tier = monuments?.tiers[n - 1];
          const built = monuments ? n <= monuments.built : undefined;
          return (
            <li
              key={n}
              {...(built !== undefined ? { "data-built": built } : {})}
              {...(tier ? { title: tier.name } : {})}
            >
              {src ? (
                <img src={src} alt="" aria-hidden="true" draggable={false} />
              ) : (
                <span aria-hidden="true" className="fq-monument-num">
                  {n}
                </span>
              )}
              <span>{t("x.monument.tier", { n })}</span>
              {tier && (
                <span className="fq-monument-state">
                  {built
                    ? t("x.monument.built")
                    : t("x.monument.unbuilt", {
                        price: `$${tier.price.toLocaleString("en-US")}`,
                      })}
                  <span className="fq-sr">{`: ${tier.name}, +${tier.bp} BP`}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {nextName ? (
        <p className="fq-monument-next">
          {t("x.monument.next")} <b>{nextName}</b>
          {nextPrice && <span> {nextPrice}</span>}
        </p>
      ) : (
        <p className="fq-monument-next">{t("x.monument.allBuilt")}</p>
      )}
    </section>
  );
}
