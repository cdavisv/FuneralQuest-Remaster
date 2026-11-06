import type { Hud as HudData, View } from "@fq/protocol";
import type { CSSProperties } from "react";
import { useCabinetArt } from "../art/CabinetContext.js";
import { relBox } from "../art/geometry.js";
import { useT } from "../i18n/I18nContext.js";
import { CoffinIcon, type TagKind } from "./Icons.js";
import { RichText } from "./RichText.js";

const nf = new Intl.NumberFormat("en-US");

export function LuckMeter({ luck }: { luck: number }) {
  const t = useT();
  const cab = useCabinetArt();
  const value = Math.max(1, Math.min(100, Math.round(luck)));
  const tube = cab?.spec.regions.luck;
  const origin = cab?.spec.regions.note;
  if (cab && tube && origin) {
    // The tube, its caption and Best/Worst are in the art; only the level is live.
    return (
      <div
        className="fq-luck fq-luck-art"
        style={
          {
            ...relBox(tube, origin),
            "--fq-luck": `${value}%`,
          } as CSSProperties
        }
      >
        <meter
          className="fq-sr"
          min={1}
          max={100}
          value={value}
          aria-label={t("luck.aria", { value })}
        />
        <span className="fq-luck-art-fill" aria-hidden="true" />
      </div>
    );
  }
  return (
    <div className="fq-luck" style={{ "--fq-luck": `${value}%` } as CSSProperties}>
      <meter
        className="fq-sr"
        min={1}
        max={100}
        value={value}
        aria-label={t("luck.aria", { value })}
      />
      <span className="fq-luck-title" aria-hidden="true">
        {t("luck.title")}
      </span>
      <span className="fq-luck-track" aria-hidden="true">
        <span className="fq-luck-fill" />
      </span>
      <span className="fq-luck-best" aria-hidden="true">
        {t("luck.best")}
      </span>
      <span className="fq-luck-worst" aria-hidden="true">
        {t("luck.worst")}
      </span>
    </div>
  );
}

const TAGS: TagKind[] = ["wood", "silver", "gold"];

/** A number sized to its box: long values (five digits and up) get a smaller face. */
const sizeClass = (text: string) => (text.length > 5 ? "fq-long" : text.length > 4 ? "fq-mid" : "");

/** The stats parchment of the original: its captions and casket icons are art, the numbers are live. */
function ArtStats({ hud }: { hud: HudData }) {
  const t = useT();
  const cab = useCabinetArt();
  const spots = cab?.spec.regions.spots;
  const note = cab?.spec.regions.note;
  if (!cab || !spots || !note) return null;
  const bp = nf.format(hud.bpToday);
  const turns = nf.format(hud.turns);
  return (
    <dl className="fq-stats fq-stats-art" aria-label={t("stats.region")}>
      <div className="fq-stat">
        <dt className="fq-sr">{t("stats.bpToday")}</dt>
        <dd className={`fq-num ${sizeClass(bp)}`} style={relBox(spots.bpToday, note)}>
          {bp}
        </dd>
      </div>
      <div className="fq-stat">
        <dt className="fq-sr">{t("stats.turns")}</dt>
        <dd className={`fq-num ${sizeClass(turns)}`} style={relBox(spots.turns, note)}>
          {turns}
        </dd>
      </div>
      <div className="fq-stat fq-stat-tags">
        <dt className="fq-sr">{t("stats.tags")}</dt>
        <dd>
          <ul className="fq-tags">
            {TAGS.map((kind, i) => {
              const spot = spots.tags[i];
              return (
                <li
                  key={kind}
                  aria-label={t("stats.tagCount", {
                    kind: t(`stats.tag.${kind}`),
                    count: hud.tags[kind],
                  })}
                  style={spot ? relBox(spot, note) : undefined}
                >
                  <span aria-hidden="true">{nf.format(hud.tags[kind])}</span>
                </li>
              );
            })}
          </ul>
        </dd>
      </div>
      <div className="fq-stat fq-stat-total fq-sr">
        <dt>{t("stats.bpTotal")}</dt>
        <dd>{nf.format(hud.bpTotal)}</dd>
      </div>
    </dl>
  );
}

export function StatsBlock({ hud }: { hud: HudData }) {
  const t = useT();
  const cab = useCabinetArt();
  if (cab?.spec.regions.spots) return <ArtStats hud={hud} />;
  return (
    <dl className="fq-stats" aria-label={t("stats.region")}>
      <div className="fq-stat fq-stat-bp">
        <dt>{t("stats.bpToday")}</dt>
        <dd className="fq-num">{nf.format(hud.bpToday)}</dd>
      </div>
      <div className="fq-stat fq-stat-turns">
        <dt>{t("stats.turns")}</dt>
        <dd className="fq-num">{nf.format(hud.turns)}</dd>
      </div>
      <div className="fq-stat fq-stat-tags">
        <dt>{t("stats.tags")}</dt>
        <dd>
          <ul className="fq-tags">
            {TAGS.map((kind) => (
              <li
                key={kind}
                aria-label={t("stats.tagCount", {
                  kind: t(`stats.tag.${kind}`),
                  count: hud.tags[kind],
                })}
              >
                <CoffinIcon kind={kind} />
                <span aria-hidden="true">{hud.tags[kind]}</span>
              </li>
            ))}
          </ul>
        </dd>
      </div>
      <div className="fq-stat fq-stat-total">
        <dt>{t("stats.bpTotal")}</dt>
        <dd>{nf.format(hud.bpTotal)}</dd>
      </div>
    </dl>
  );
}

/** The parchment note: the room description when the view has one, otherwise the player's stats. */
export function Note({ view, compact }: { view: View; compact?: boolean }) {
  const t = useT();
  const { hud, note } = view;
  const cab = useCabinetArt();
  if (cab) {
    return (
      <section className="fq-note fq-note-art fq-surface-light" aria-label={t("note.region")}>
        {hud && <LuckMeter luck={hud.luck} />}
        {note ? (
          <p className="fq-note-text">
            <RichText spans={note} />
          </p>
        ) : hud ? (
          <StatsBlock hud={hud} />
        ) : null}
      </section>
    );
  }
  return (
    <section className="fq-note fq-surface-light" aria-label={t("note.region")}>
      <i className="fq-tack fq-tack-tl" aria-hidden="true" />
      <i className="fq-tack fq-tack-tr" aria-hidden="true" />
      <i className="fq-tack fq-tack-bl" aria-hidden="true" />
      <i className="fq-tack fq-tack-br" aria-hidden="true" />
      <i className="fq-curl" aria-hidden="true" />
      {hud && !compact && <LuckMeter luck={hud.luck} />}
      <div className="fq-note-body">
        {note ? (
          <p className="fq-note-text">
            <RichText spans={note} />
          </p>
        ) : hud && !compact ? (
          <StatsBlock hud={hud} />
        ) : null}
      </div>
    </section>
  );
}

/** Phone only: a compact one-line stats strip (luck as a horizontal bar). */
export function StatsStrip({ hud }: { hud: HudData }) {
  const t = useT();
  return (
    <section className="fq-strip" aria-label={t("stats.region")}>
      <LuckMeter luck={hud.luck} />
      <dl className="fq-strip-stats">
        <div>
          <dt>{t("stats.bpToday")}</dt>
          <dd className="fq-num">{nf.format(hud.bpToday)}</dd>
        </div>
        <div>
          <dt>{t("stats.turns")}</dt>
          <dd className="fq-num">{nf.format(hud.turns)}</dd>
        </div>
        {TAGS.map((kind) => (
          <div key={kind} className="fq-strip-tag">
            <dt className="fq-sr">
              {t("stats.tagCount", { kind: t(`stats.tag.${kind}`), count: hud.tags[kind] })}
            </dt>
            <dd aria-hidden="true">
              <CoffinIcon kind={kind} />
              {hud.tags[kind]}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
