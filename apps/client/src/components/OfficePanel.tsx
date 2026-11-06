import type { OfficePanel as OfficeData } from "@fq/protocol";
import { useArtMaybe } from "../art/ArtContext.js";
import type { IconName } from "../art/types.js";
import { stockTotal } from "../expanded/office.js";
import { useT } from "../i18n/I18nContext.js";
import { useCover } from "./useCover.js";

/**
 * One stage of the parlor, shack to mansion. The pack draws the five stages as icons
 * (`parlor-1` to `parlor-5`; the Remastered pack does, and every other pack borrows them); where
 * no pack has them a small inline house stands in.
 */
export function BuildingGlyph({ level }: { level: number }) {
  const art = useArtMaybe()?.icon(`parlor-${Math.min(4, Math.max(0, level)) + 1}` as IconName);
  if (art) {
    return (
      <img
        src={art}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="fq-bglyph fq-bglyph-art"
      />
    );
  }
  const common = { stroke: "#2a1a08", strokeWidth: 1.6, strokeLinejoin: "round" } as const;
  return (
    <svg viewBox="0 0 64 48" fill="none" aria-hidden="true" focusable="false" className="fq-bglyph">
      <path d="M2 44h60" {...common} />
      {level === 0 && (
        <>
          <path d="M14 44V24l18-10 18 10v20z" fill="#9a8a78" {...common} />
          <path d="M26 44V32h10v12" fill="#4a3a28" {...common} />
          <path d="M20 28l8 6M30 26l10 8" stroke="#6b2a06" strokeWidth="2" />
        </>
      )}
      {level === 1 && (
        <>
          <path d="M10 44V22l22-12 22 12v22z" fill="#c9b896" {...common} />
          <path d="M26 44V30h12v14" fill="#5a3d12" {...common} />
          <rect x="14" y="26" width="8" height="8" fill="#9cc0d8" {...common} />
          <rect x="42" y="26" width="8" height="8" fill="#9cc0d8" {...common} />
        </>
      )}
      {level === 2 && (
        <>
          <path d="M6 44V22l26-14 26 14v22z" fill="#e8e4e0" {...common} />
          <path d="M26 44V28h12v16" fill="#5a3d12" {...common} />
          <rect x="11" y="26" width="9" height="10" fill="#9cc0d8" {...common} />
          <rect x="44" y="26" width="9" height="10" fill="#9cc0d8" {...common} />
          <path d="M6 22h52" {...common} />
        </>
      )}
      {level === 3 && (
        <>
          <path d="M6 44V24l16-8 10-8 10 8 16 8v20z" fill="#d8d0c8" {...common} />
          <path d="M28 44V30h8v14" fill="#3a2209" {...common} />
          <path d="M32 8V2M29 4h6" {...common} />
          <rect x="11" y="28" width="8" height="9" fill="#9cc0d8" {...common} />
          <rect x="45" y="28" width="8" height="9" fill="#9cc0d8" {...common} />
        </>
      )}
      {level >= 4 && (
        <>
          <path d="M3 44V24l12-6 17-12 17 12 12 6v20z" fill="#efe9e0" {...common} />
          <path d="M26 44V30h12v14" fill="#3a2209" {...common} />
          <path d="M14 44V24M22 44V24M42 44V24M50 44V24" {...common} />
          <path d="M3 24h58" {...common} />
          <path d="M32 6V1l5 2-5 2" fill="#c8601f" {...common} />
        </>
      )}
    </svg>
  );
}

/** The five stages with the one the parlor has reached lit; the names are the engine's. */
export function BuildingLadder({ level, names }: { level: number; names: readonly string[] }) {
  const t = useT();
  return (
    <ol className="fq-ladder" aria-label={t("x.office.ladder")}>
      {names.map((name, i) => (
        <li
          key={name}
          data-state={i < level ? "built" : i === level ? "now" : "ahead"}
          aria-current={i === level ? "step" : undefined}
        >
          <BuildingGlyph level={i} />
          <span>{name}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * The parlor office's parchment, from `View.office`: the building and its five stages, the
 * storeroom (a count per tier against what it holds), the markup and the rivalry in force, and
 * the security level. Choosing a markup or a rivalry is done on the cards of the next screens.
 */
export function OfficePanel({ office }: { office: OfficeData }) {
  const t = useT();
  const total = stockTotal(office.stock);
  return (
    <section
      className="fq-npanel fq-office fq-surface-light"
      data-cover={useCover()}
      aria-label={t("x.office.ladder")}
    >
      <h2 className="fq-office-name">
        {office.levelName}
        <small>{t("x.office.level", { n: office.level + 1, of: office.levelNames.length })}</small>
      </h2>
      <BuildingLadder level={office.level} names={office.levelNames} />
      <dl className="fq-office-facts">
        <div>
          <dt>{t("x.office.stock")}</dt>
          <dd>
            <span data-kind="wood">{office.stock.wood}</span> {t("x.office.wood")},{" "}
            <span data-kind="silver">{office.stock.silver}</span> {t("x.office.silver")},{" "}
            <span data-kind="gold">{office.stock.gold}</span> {t("x.office.gold")}
          </dd>
        </div>
        <div>
          <dt>{t("x.office.storeroom")}</dt>
          <dd>
            <meter
              className="fq-office-meter"
              min={0}
              max={Math.max(1, office.stock.capacity)}
              value={total}
              aria-label={t("x.office.storeroom.of", { n: total, cap: office.stock.capacity })}
            />{" "}
            {total}/{office.stock.capacity}
          </dd>
        </div>
        <div>
          <dt>{t("x.office.markup")}</dt>
          <dd>{office.markup > 0 ? `+${office.markup}` : office.markup}%</dd>
        </div>
        <div>
          <dt>{t("x.office.rivalry")}</dt>
          <dd>
            {office.rivalryName}
            {office.rivalryWait > 0 && (
              <small className="fq-office-wait">
                {t("x.office.rivalryWait", { count: office.rivalryWait })}
              </small>
            )}
          </dd>
        </div>
        <div>
          <dt>{t("x.office.security")}</dt>
          <dd>{office.security}</dd>
        </div>
      </dl>
    </section>
  );
}
