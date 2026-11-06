import type { BattlePanel, CustomerPanel } from "@fq/protocol";
import type { CSSProperties } from "react";
import { useT } from "../i18n/I18nContext.js";
import { moodTier } from "../util/mood.js";
import { MoodFace } from "./Icons.js";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/** Mood face, running total, and (when the psych skill revealed it) the resistance gauge. */
export function CustomerReadout({ customer }: { customer: CustomerPanel }) {
  const t = useT();
  const resistance =
    customer.resistancePercent === undefined
      ? undefined
      : Math.max(0, Math.min(100, Math.round(customer.resistancePercent)));
  return (
    <section className="fq-readout" aria-label={t("customer.region")}>
      <span className="fq-readout-item fq-readout-mood">
        <MoodFace tier={moodTier(customer.moodLabel, customer.moodLevel)} />
        <span className="fq-readout-label">{t("customer.mood")}</span>
        <strong>{customer.moodLabel}</strong>
      </span>
      <span className="fq-readout-item fq-readout-total">
        <span className="fq-readout-label">{t("customer.total")}</span>
        <strong className="fq-readout-value">{money.format(customer.total)}</strong>
      </span>
      {resistance !== undefined && (
        <span className="fq-readout-item fq-readout-resist">
          <meter
            className="fq-sr"
            min={0}
            max={100}
            value={resistance}
            aria-label={t("customer.resistanceAria", { value: resistance })}
          />
          <span className="fq-readout-label" aria-hidden="true">
            {t("customer.resistance")}
          </span>
          <span
            className="fq-gauge"
            aria-hidden="true"
            style={{ "--fq-gauge": `${resistance}%` } as CSSProperties}
          >
            <span className="fq-gauge-fill" />
          </span>
          <strong className="fq-readout-value" aria-hidden="true">
            {resistance}%
          </strong>
        </span>
      )}
    </section>
  );
}

function HealthBar({
  name,
  hp,
  max,
  side,
}: {
  name: string;
  hp: number;
  max: number;
  side: "me" | "them";
}) {
  const t = useT();
  const pct = max > 0 ? Math.max(0, Math.min(100, (hp / max) * 100)) : 0;
  return (
    <span className={`fq-readout-item fq-health fq-health-${side}`}>
      <meter
        className="fq-sr"
        min={0}
        max={max}
        value={hp}
        aria-label={t("battle.hp", { name, hp, max })}
      />
      <span className="fq-readout-label" aria-hidden="true">
        {name}
      </span>
      <span
        className="fq-gauge fq-gauge-hp"
        aria-hidden="true"
        style={{ "--fq-gauge": `${pct}%` } as CSSProperties}
      >
        <span className="fq-gauge-fill" />
      </span>
      <strong className="fq-readout-value" aria-hidden="true">
        {hp}/{max}
      </strong>
    </span>
  );
}

export function BattleReadout({ battle }: { battle: BattlePanel }) {
  const t = useT();
  return (
    <section className="fq-readout fq-readout-battle" aria-label={t("battle.region")}>
      <HealthBar name={battle.me.name} hp={battle.me.hp} max={battle.me.hpMax} side="me" />
      <HealthBar name={battle.them.name} hp={battle.them.hp} max={battle.them.hpMax} side="them" />
    </section>
  );
}
