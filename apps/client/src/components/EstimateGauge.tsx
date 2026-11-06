import type { CSSProperties } from "react";
import type { GaugeModel } from "../expanded/gauge.js";
import { useT } from "../i18n/I18nContext.js";

const nf = new Intl.NumberFormat("en-US");
const dollars = (n: number) => `$${nf.format(Math.round(n))}`;

/**
 * "How close am I" at a glance. The estimate is a bar; the running total is a pin on it; just
 * above the pin the engine's near-match bands (`CustomerPanel.bands`: great, nice...) are drawn,
 * each as wide as its `within` share of the limit, because a limit that falls in one of them is a
 * bonus. A total far below the
 * estimate sits in a short lead-in on the left with the dollars still to go written beside it.
 */
export function EstimateGauge({ model, rule }: { model: GaugeModel; rule?: string | undefined }) {
  const t = useT();
  const chance = Math.round(model.chance * 100);
  const aria =
    model.state === "below"
      ? t("x.gauge.aria.below", {
          low: dollars(model.low),
          high: dollars(model.high),
          total: dollars(model.total),
          gap: dollars(model.gap),
        })
      : model.state === "above"
        ? t("x.gauge.aria.above", {
            low: dollars(model.low),
            high: dollars(model.high),
            total: dollars(model.total),
          })
        : t("x.gauge.aria.inside", {
            low: dollars(model.low),
            high: dollars(model.high),
            total: dollars(model.total),
            chance,
          });
  const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
  const pctOf = (within: number) => Math.round(within * 1000) / 10;
  const label = (key: "great" | "nice" | "exact", within: number) =>
    t(`x.gauge.band.${key}` as "x.gauge.band.great", { pct: pctOf(within) });
  return (
    <figure className="fq-gauge2" data-state={model.state} aria-label={t("x.gauge.region")}>
      <p className="fq-sr">{aria}</p>
      <div
        className="fq-gauge2-bar"
        aria-hidden="true"
        style={
          {
            "--lead": model.leadIn > 0 ? pct(model.leadIn) : "0%",
            "--low": pct(model.lowPos),
            "--high": pct(model.highPos),
            "--total": pct(model.totalPos),
          } as CSSProperties
        }
      >
        {model.leadIn > 0 && <span className="fq-gauge2-lead" />}
        <span className="fq-gauge2-range" />
        {model.bands.map((b) => (
          <span
            key={b.key}
            className="fq-gauge2-band"
            data-band={b.key}
            title={`${label(b.key, b.within)}: ${dollars(b.from)} to ${dollars(b.to)}`}
            style={{ left: pct(b.fromPos), width: pct(Math.max(0.006, b.toPos - b.fromPos)) }}
          />
        ))}
        <span className="fq-gauge2-pin" />
      </div>
      <div className="fq-gauge2-scale" aria-hidden="true">
        <span className="fq-gauge2-end fq-gauge2-low" style={{ left: pct(model.lowPos) }}>
          {dollars(model.low)}
        </span>
        <span className="fq-gauge2-end fq-gauge2-high" style={{ left: pct(model.highPos) }}>
          {dollars(model.high)}
        </span>
      </div>
      <figcaption className="fq-gauge2-cap">
        {model.state === "below" ? (
          <span>{t("x.gauge.gap", { gap: dollars(model.gap) })}</span>
        ) : model.bands.length > 0 ? (
          <span className="fq-gauge2-legend">
            {model.bands.map((b) => (
              <span key={b.key}>
                <i data-band={b.key} title={label(b.key, b.within)} />
                {t(`x.gauge.${b.key}Short` as "x.gauge.greatShort")}
              </span>
            ))}
            <b>{t("x.gauge.chanceIs", { chance })}</b>
          </span>
        ) : (
          <span>{t("x.gauge.none")}</span>
        )}
        {rule && <span className="fq-gauge2-rule">{rule}</span>}
      </figcaption>
    </figure>
  );
}
