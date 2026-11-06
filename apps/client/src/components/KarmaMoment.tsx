import type { KarmaBand } from "@fq/protocol";
import { useId } from "react";
import { useArtMaybe } from "../art/ArtContext.js";
import { bandAt } from "../expanded/hud.js";
import { effectList, type PrepOption } from "../expanded/prep.js";
import { useT } from "../i18n/I18nContext.js";
import { KarmaAxis } from "./Ledger.js";
import { useCover } from "./useCover.js";

const clampKarma = (n: number) => Math.max(1, Math.min(100, n));

/**
 * The parchment during a body-preparation choice: where karma stands on the engine's own axis
 * (`View.karmaScale`, its bands named and bounded by the rules) and where the choice under the
 * pointer would leave it.
 */
export function KarmaScale({
  karma,
  preview,
  scale,
}: {
  karma: number | undefined;
  /** The karma the hovered choice would leave (display only). */
  preview: number | undefined;
  scale: readonly KarmaBand[] | undefined;
}) {
  const t = useT();
  const cover = useCover();
  const balance = useArtMaybe()?.icon("karma-balance");
  if (karma === undefined) return null;
  const band = bandAt(scale, preview ?? karma);
  return (
    <section
      className="fq-npanel fq-karmascale fq-surface-light"
      data-cover={cover}
      aria-label={t("x.prep.scale")}
    >
      <h2>{t("x.prep.title")}</h2>
      <div className="fq-karmascale-scales">
        {balance ? (
          <img
            src={balance}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="fq-balance fq-balance-art"
          />
        ) : (
          <svg viewBox="0 0 120 70" className="fq-balance" aria-hidden="true" focusable="false">
            <path d="M60 8v50M20 20h80M60 8l0 0M22 20l-12 24c0 6 6 10 12 10s12-4 12-10zM98 20l-12 24c0 6 6 10 12 10s12-4 12-10zM40 62h40" />
          </svg>
        )}
      </div>
      <div className="fq-karmascale-axis">
        <span>{t("x.karma.evil")}</span>
        <KarmaAxis
          karma={karma}
          scale={scale}
          {...(preview !== undefined ? { ghost: preview } : {})}
        />
        <span>{t("x.karma.angelic")}</span>
      </div>
      <p className="fq-karmascale-now">
        {preview !== undefined && preview !== karma ? t("x.karma.after") : t("x.ledger.karma")}{" "}
        <b>{preview ?? karma}</b> {band && <i>{band.name}</i>}
      </p>
      {scale && (
        <ol className="fq-karmascale-bands" aria-label={t("x.karma.bands")}>
          {scale.map((b) => (
            <li key={b.id} data-here={b.id === band?.id || undefined}>
              <span>{b.name}</span>
              <small>
                {b.min}-{b.max}
              </small>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Signed({ n }: { n: number }) {
  return <>{n > 0 ? `+${n}` : String(n)}</>;
}

/**
 * What a choice does, as the engine states it: karma first (direction and size as arrows, because
 * it is the moral part), then the rest (cash, luck, word of mouth, rating...), then, for a gamble,
 * the chance it works and what a failure costs instead. The label stays the engine's joke.
 */
function Consequences({ option }: { option: PrepOption }) {
  const t = useT();
  const { choice } = option;
  const rest = effectList(choice.effects);
  return (
    <span className="fq-mb-fx">
      {option.karma !== 0 && (
        <b
          className="fq-mb-karma"
          data-dir={option.karma > 0 ? "up" : "down"}
          title={t("x.prep.karma", { delta: option.karma > 0 ? `+${option.karma}` : option.karma })}
        >
          <span aria-hidden="true" className="fq-mb-arrows">
            {(option.karma > 0 ? "▲" : "▼").repeat(Math.min(3, Math.abs(option.karma)))}
          </span>
          {t("x.prep.karma", { delta: option.karma > 0 ? `+${option.karma}` : option.karma })}
        </b>
      )}
      {rest.map((e) => (
        <span key={e.key} className="fq-mb-fact" data-sign={e.amount > 0 ? "up" : "down"}>
          {e.key === "money" ? (
            `${e.amount > 0 ? "+" : "-"}$${Math.abs(e.amount).toLocaleString("en-US")}`
          ) : (
            <>
              <Signed n={e.amount} /> {t(`x.prep.fact.${e.key}` as "x.prep.fact.luck")}
            </>
          )}
        </span>
      ))}
      {choice.effects.protection && (
        <span className="fq-mb-fact">{t("x.prep.fact.protection")}</span>
      )}
      {choice.risk && (
        <span className="fq-mb-risk">
          <meter
            min={0}
            max={100}
            value={choice.risk.chance}
            aria-label={t("x.prep.risk", { chance: choice.risk.chance })}
          />
          <span>{t("x.prep.risk", { chance: choice.risk.chance })}</span>
          <small>
            {t("x.prep.fail")}{" "}
            {(choice.risk.fail.karma ?? 0) !== 0 &&
              t("x.prep.karma", {
                delta:
                  (choice.risk.fail.karma ?? 0) > 0
                    ? `+${choice.risk.fail.karma}`
                    : `${choice.risk.fail.karma}`,
              })}
            {effectList(choice.risk.fail).map((e) => (
              <span key={e.key}>
                {" "}
                {e.key === "money" ? (
                  `${e.amount > 0 ? "+" : "-"}$${Math.abs(e.amount).toLocaleString("en-US")}`
                ) : (
                  <>
                    <Signed n={e.amount} /> {t(`x.prep.fact.${e.key}` as "x.prep.fact.luck")}
                  </>
                )}
              </span>
            ))}
          </small>
        </span>
      )}
    </span>
  );
}

/** The choice itself: two or more heavy cards, drawn to feel like a decision, not a menu. */
export function MoralChoices({
  options,
  onPress,
  onPreview,
  karma,
}: {
  options: PrepOption[];
  onPress: (id: string) => void;
  onPreview: (karma: number | undefined) => void;
  karma: number | undefined;
}) {
  const t = useT();
  const uid = useId();
  const show = (o: PrepOption) => (karma === undefined ? undefined : clampKarma(karma + o.karma));
  return (
    <nav className="fq-moral" aria-label={t("x.prep.title")}>
      <ul>
        {options.map((o) => {
          const disabled = o.button.enabled === false;
          return (
            <li key={o.button.id}>
              <button
                type="button"
                className="fq-mb"
                data-tone={o.tone}
                data-button-id={o.button.id}
                aria-disabled={disabled || undefined}
                aria-describedby={o.button.hint ? `${uid}-${o.index}` : undefined}
                aria-keyshortcuts={o.index < 9 ? String(o.index + 1) : undefined}
                onMouseEnter={() => onPreview(show(o))}
                onMouseLeave={() => onPreview(undefined)}
                onFocus={() => onPreview(show(o))}
                onBlur={() => onPreview(undefined)}
                onClick={() => {
                  if (!disabled) onPress(o.button.id);
                }}
              >
                <span className="fq-mb-kind">
                  {t(
                    o.tone === "good"
                      ? "x.prep.good"
                      : o.tone === "evil"
                        ? "x.prep.evil"
                        : "x.prep.neutral",
                  )}
                </span>
                <span className="fq-mb-label">{o.button.label}</span>
                <Consequences option={o} />
              </button>
              {o.button.hint && (
                <span id={`${uid}-${o.index}`} className="fq-mb-hint">
                  {o.button.hint}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
