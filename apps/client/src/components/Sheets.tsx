import type { RankingRow, StatLine } from "@fq/protocol";
import { useT } from "../i18n/I18nContext.js";
import type { MessageKey } from "../i18n/messages.js";
import { RankingRowActions } from "../moderation/ActionMenu.js"; // moderation hook
import { CoffinIcon, type TagKind } from "./Icons.js";

/**
 * The stats sheet groups the server's lines by what they are. The ids are the engine's; a line
 * the client has never heard of lands in the last group, so a new stat shows up without a
 * client change.
 */
/** The rating is a sentence, so it gets a line of its own above the columns. */
const RATING = "rating";

export const STAT_GROUPS = [
  { id: "standing", keys: ["turns", "bpToday", "bpTotal", "money", "psych"] },
  { id: "inventory", keys: ["wood", "silver", "gold", "plots", "lockpicks", "ride"] },
  { id: "errands", keys: ["hpMax", "strength", "yangs", "visits"] },
] as const;

export function groupStats(stats: StatLine[]): { id: string; lines: StatLine[] }[] {
  const known = new Set<string>([...STAT_GROUPS.flatMap((g) => g.keys), RATING]);
  const groups = STAT_GROUPS.map((g) => ({
    id: g.id as string,
    lines: g.keys.flatMap((k) => stats.filter((s) => s.id === k)),
  }));
  const rest = stats.filter((s) => !known.has(s.id));
  if (rest.length > 0) groups.push({ id: "other", lines: rest });
  return groups.filter((g) => g.lines.length > 0);
}

const groupLabel = (id: string): MessageKey =>
  id === "standing"
    ? "sheet.group.standing"
    : id === "inventory"
      ? "sheet.group.inventory"
      : id === "errands"
        ? "sheet.group.errands"
        : "sheet.group.other";

const TAG_IDS: Record<string, TagKind> = { wood: "wood", silver: "silver", gold: "gold" };
/** Long values (the rating line) take the whole row. */
const WIDE_AT = 24;

/** The parlor report: stats and inventory as a sheet of label and value pairs. */
export function StatsSheet({ stats }: { stats: StatLine[] }) {
  const t = useT();
  const rating = stats.find((s) => s.id === RATING);
  return (
    <section className="fq-sheet-stats" aria-label={t("sheet.stats")}>
      {rating && (
        <p className="fq-sheet-rating" data-stat={RATING}>
          <span>{rating.label}</span>
          {rating.value}
        </p>
      )}
      {groupStats(stats).map((group) => (
        <section key={group.id} className="fq-sheet-group" data-group={group.id}>
          <h2 className="fq-sheet-heading">{t(groupLabel(group.id))}</h2>
          <dl className="fq-sheet-list">
            {group.lines.map((line) => {
              const tag = TAG_IDS[line.id];
              return (
                <div
                  key={line.id}
                  className="fq-sheet-row"
                  data-stat={line.id}
                  data-wide={line.value.length > WIDE_AT || undefined}
                >
                  <dt>
                    {tag && <CoffinIcon kind={tag} />}
                    {line.label}
                  </dt>
                  <dd>{line.value}</dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </section>
  );
}

const nf = new Intl.NumberFormat("en-US");

/** The rankings as a real table: place, who, where, how many Bury Points, and whether they are on. */
export function RankingsTable({ rows }: { rows: RankingRow[] }) {
  const t = useT();
  return (
    <table className="fq-rank-table">
      <caption className="fq-sr">{t("sheet.rankings")}</caption>
      <thead>
        <tr>
          <th scope="col" className="fq-rank-place">
            {t("rank.place")}
          </th>
          <th scope="col">{t("rank.parlor")}</th>
          <th scope="col" className="fq-rank-bp">
            {t("rank.bp")}
          </th>
          <th scope="col" className="fq-rank-status">
            {t("rank.status")}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.place}:${row.playerId}`} data-online={row.online || undefined}>
            <td className="fq-rank-place">{row.place}</td>
            <td className="fq-rank-who">
              <span className="fq-rank-name">
                {row.name}
                <span className="fq-sr"> ({row.male ? t("rank.male") : t("rank.female")})</span>
                <span className="fq-rank-sex" aria-hidden="true">
                  {row.male ? "M" : "F"}
                </span>
              </span>{" "}
              <span className="fq-rank-parlor">{row.parlor}</span>
              {/* moderation hook */}
              <RankingRowActions playerId={row.playerId} name={row.name} parlor={row.parlor} />
              {row.title && <span className="fq-rank-title">{row.title}</span>}
            </td>
            <td className="fq-rank-bp">{nf.format(row.bp)}</td>
            <td className="fq-rank-status">
              {row.status && (
                <span className="fq-rank-chip" data-online={row.online || undefined}>
                  {row.status}
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
