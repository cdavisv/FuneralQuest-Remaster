import type { Hud, KarmaBand, Warning } from "@fq/protocol";
import { type CSSProperties, useState } from "react";
import { debtLevel, type HudChip, hudChips, karmaPosition } from "../expanded/hud.js";
import { useT } from "../i18n/I18nContext.js";
import { useDelta } from "../util/useDelta.js";
import { type IconName, XIcon } from "./ExpandedIcons.js";
import { useInjurySummary } from "./InjuryPanel.js";
import { Tipped } from "./Tipped.js";

const nf = new Intl.NumberFormat("en-US");
const dollars = (n: number) => `$${nf.format(n)}`;

const ICON: Record<HudChip["id"], IconName> = {
  turns: "turns",
  money: "money",
  karma: "karma",
  rating: "rating",
  savings: "savings",
  debt: "debt",
  injuries: "injuries",
  leads: "leads",
};

/**
 * The mini karma axis: red on the left, gold on the right, a marker where the parlor stands. With
 * the engine's `karmaScale` the borders between the bands are marked, so the axis shows where each
 * path begins without the client knowing the numbers.
 */
export function KarmaAxis({
  karma,
  ghost,
  scale,
}: {
  karma: number;
  ghost?: number;
  scale?: readonly KarmaBand[] | undefined;
}) {
  const t = useT();
  return (
    <span
      className="fq-karmaaxis"
      role="img"
      aria-label={t("x.karma.axis")}
      style={
        {
          "--fq-karma": `${karmaPosition(karma) * 100}%`,
          ...(ghost !== undefined ? { "--fq-karma-ghost": `${karmaPosition(ghost) * 100}%` } : {}),
        } as CSSProperties
      }
    >
      <span className="fq-karmaaxis-zones" aria-hidden="true" />
      {scale?.slice(1).map((band) => (
        <span
          key={band.id}
          className="fq-karmaaxis-tick"
          aria-hidden="true"
          style={{ left: `${karmaPosition(band.min - 0.5) * 100}%` }}
        />
      ))}
      {ghost !== undefined && <span className="fq-karmaaxis-ghost" aria-hidden="true" />}
      <span className="fq-karmaaxis-marker" aria-hidden="true" />
    </span>
  );
}

function Chip({ chip, scale }: { chip: HudChip; scale: readonly KarmaBand[] | undefined }) {
  const t = useT();
  const summary = useInjurySummary();
  const delta = useDelta(chip.id === "money" || chip.id === "savings" ? chip.value : undefined);
  const label = t(`x.ledger.${chip.id}`);
  let value = nf.format(chip.value);
  if (chip.id === "money" || chip.id === "savings" || chip.id === "debt")
    value = dollars(chip.value);
  let tip = t(`x.ledger.${chip.id}.tip`);
  let sub: string | undefined;
  let tone: string = chip.tone;
  if (chip.id === "karma" && chip.band) {
    // The band's name is the engine's; its perk sentence is the client's, keyed by the band's id.
    sub = chip.band.name;
    const perk = `x.karma.path.${chip.band.id}.tip` as const;
    tip = `${tip} ${t(perk)}`;
  }
  if (chip.id === "debt" && chip.due !== undefined) {
    const level = debtLevel(chip.daysLeft);
    sub =
      chip.daysLeft === undefined
        ? t("x.ledger.due", { day: chip.due })
        : level === "overdue"
          ? t("x.ledger.overdue")
          : level === "due"
            ? t("x.ledger.dueToday")
            : t("x.ledger.dueIn", { count: chip.daysLeft });
    tone = level === "ok" ? "warn" : "bad";
  }
  if (chip.id === "injuries" && chip.injuries) {
    tip = `${tip}\n${chip.injuries.map(summary).join("\n")}`;
  }
  return (
    <li className="fq-lchip" data-chip={chip.id} data-tone={tone}>
      <Tipped tip={tip} className="fq-lchip-tip" placement="below">
        <span className="fq-lchip-icon">
          <XIcon name={ICON[chip.id]} />
        </span>
        <span className="fq-lchip-label">{label}</span>
        <span className="fq-lchip-value fq-num-live">{value}</span>
        {chip.id === "karma" && <KarmaAxis karma={chip.value} scale={scale} />}
        {sub && <span className="fq-lchip-sub">{sub}</span>}
        {delta !== null && delta !== 0 && (
          <span
            className="fq-lchip-delta"
            data-sign={delta > 0 ? "up" : "down"}
            role="status"
            aria-label={t(delta > 0 ? "x.ledger.delta.up" : "x.ledger.delta.down", {
              amount: dollars(Math.abs(delta)),
            })}
          >
            {delta > 0 ? "+" : "-"}
            {nf.format(Math.abs(delta))}
          </span>
        )}
      </Tipped>
    </li>
  );
}

/**
 * Threats the engine says the player can still act on (`Hud.warnings`, docs/expanded-rules.md
 * 20.4): one line each, under the chips, announced when it appears. Nothing when there are none.
 */
function Warnings({ warnings }: { warnings: readonly Warning[] | undefined }) {
  const t = useT();
  if (!warnings || warnings.length === 0) return null;
  return (
    <div className="fq-ledger-warnings">
      {warnings.map((w) => (
        <p
          key={`${w.kind}:${w.day}`}
          className="fq-ledger-warning"
          data-warning={w.kind}
          role="alert"
        >
          <span className="fq-ledger-warning-icon" aria-hidden="true">
            <XIcon name="injuries" />
          </span>
          <span>{t(`x.ledger.warning.${w.kind}`)}</span>
        </p>
      ))}
    </div>
  );
}

/**
 * The Expanded HUD as a ledger strip: turns, cash, karma with its axis and path, rating, and the
 * rest only when there is something to say (savings, a debt with its due day, injuries, leads),
 * and any warning the engine sent (a hit-man rumour).
 * On a phone it is one line that unfolds.
 */
export function Ledger({
  hud,
  scale,
  compact,
}: {
  hud: Hud;
  /** The karma axis's bands (`View.karmaScale`), remembered from the last View that sent them. */
  scale?: readonly KarmaBand[] | undefined;
  /** Phone: a single line that unfolds. */
  compact?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const chips = hudChips(hud);
  const first = chips.filter((c) => c.id === "money" || c.id === "karma" || c.id === "rating");
  const rest = chips.filter((c) => !first.includes(c));
  const debt = chips.find((c) => c.id === "debt");
  if (compact) {
    const brief = chips.filter((c) => c.id === "money" || c.id === "karma" || c.id === "rating");
    return (
      <section
        className="fq-ledger fq-ledger-phone"
        aria-label={t("x.ledger.region")}
        data-open={open || undefined}
        data-debt={debt ? "" : undefined}
      >
        <button
          type="button"
          className="fq-ledger-toggle"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <ul className="fq-ledger-row">
            {(open ? [] : brief).map((c) => (
              <li key={c.id} className="fq-lchip fq-lchip-flat" data-chip={c.id} data-tone={c.tone}>
                <span className="fq-lchip-icon">
                  <XIcon name={ICON[c.id]} />
                </span>
                <span className="fq-lchip-value">
                  {c.id === "money" ? dollars(c.value) : nf.format(c.value)}
                </span>
              </li>
            ))}
            {!open && debt && (
              <li className="fq-lchip fq-lchip-flat" data-chip="debt" data-tone="bad">
                <span className="fq-lchip-icon">
                  <XIcon name="debt" />
                </span>
                <span className="fq-lchip-value">{dollars(debt.value)}</span>
              </li>
            )}
          </ul>
          <span className="fq-sr">{t(open ? "x.ledger.close" : "x.ledger.open")}</span>
          <span className="fq-ledger-chevron" aria-hidden="true">
            <XIcon name="chevron" />
          </span>
        </button>
        <Warnings warnings={hud.warnings} />
        {open && (
          <div className="fq-ledger-open">
            <ul className="fq-ledger-row">
              {chips.map((c) => (
                <Chip key={c.id} chip={c} scale={scale} />
              ))}
            </ul>
          </div>
        )}
      </section>
    );
  }
  return (
    <section className="fq-ledger" aria-label={t("x.ledger.region")}>
      <ul className="fq-ledger-row" data-row="top">
        {first.map((c) => (
          <Chip key={c.id} chip={c} scale={scale} />
        ))}
      </ul>
      <ul className="fq-ledger-row" data-row="bottom">
        {rest.map((c) => (
          <Chip key={c.id} chip={c} scale={scale} />
        ))}
      </ul>
      <Warnings warnings={hud.warnings} />
    </section>
  );
}
