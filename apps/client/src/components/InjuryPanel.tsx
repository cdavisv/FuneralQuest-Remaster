import type { InjuryRow } from "@fq/protocol";
import { useT } from "../i18n/I18nContext.js";
import { useCover } from "./useCover.js";

const nf = new Intl.NumberFormat("en-US");
const dollars = (n: number) => `$${nf.format(n)}`;

/** What an injury costs, as short phrases from its numbers (zero effects are left out). */
export function useInjuryEffects(): (injury: InjuryRow) => string[] {
  const t = useT();
  return (i) => {
    const out: string[] = [];
    if (i.hp !== 0) out.push(t("x.injury.hp", { n: i.hp }));
    if (i.patience !== 0) out.push(t("x.injury.patience", { n: i.patience }));
    if (i.turns !== 0) out.push(t("x.injury.turns", { n: i.turns }));
    return out;
  };
}

/** One line for a tooltip: the name, the effects, the days left and the price. */
export function useInjurySummary(): (injury: InjuryRow) => string {
  const t = useT();
  const effects = useInjuryEffects();
  return (i) =>
    [
      i.name,
      effects(i).join(", "),
      t("x.injury.heals", { count: i.daysLeft }),
      t("x.injury.treat", { price: dollars(i.treatPrice) }),
    ]
      .filter((s) => s !== "")
      .join(". ");
}

/**
 * The hospital's list of what is wrong: each injury with its effects (hit points off every fight,
 * patience off every customer, turns off every morning), the days until it heals by itself and
 * what the nurse charges to treat it today. From `Hud.injuryList`.
 */
export function InjuryPanel({ injuries }: { injuries: InjuryRow[] }) {
  const t = useT();
  const effects = useInjuryEffects();
  return (
    <section
      className="fq-npanel fq-injuries fq-surface-light"
      data-cover={useCover()}
      aria-label={t("x.injury.region")}
    >
      <h2>{t("x.injury.title")}</h2>
      <ul>
        {injuries.map((i) => (
          <li key={i.id}>
            <span className="fq-injury-name">{i.name}</span>
            <span className="fq-injury-fx">
              {effects(i).map((e) => (
                <b key={e}>{e}</b>
              ))}
            </span>
            <span className="fq-injury-when">
              {t("x.injury.heals", { count: i.daysLeft })}{" "}
              {t("x.injury.treat", { price: dollars(i.treatPrice) })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
