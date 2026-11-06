import type { TownPanel } from "@fq/protocol";
import { closingSoon, openBallots, type StripItem, stripItems } from "../expanded/town.js";
import { useT } from "../i18n/I18nContext.js";
import { type IconName, weatherIcon, XIcon } from "./ExpandedIcons.js";
import { Tipped } from "./Tipped.js";

const ITEM_ICON: Record<StripItem["kind"], IconName | "weather"> = {
  weather: "weather",
  news: "news",
  ordinance: "ordinance",
  mayor: "mayor",
  story: "story",
};

/**
 * The town strip (docs/expanded-rules.md 26): one chip each for the weather, the headline that
 * changes today's rules, the ordinance in force, the mayor and the running story, with the effect
 * as a tooltip, and a "Vote" badge for each ballot the player has not voted on.
 */
export function TownStrip({
  town,
  variant = "well",
}: {
  town: TownPanel;
  variant?: "well" | "map";
}) {
  const t = useT();
  const items = stripItems(town);
  const ballots = openBallots(town);
  if (items.length === 0 && ballots.length === 0) return null;
  return (
    <section className="fq-townstrip" data-variant={variant} aria-label={t("x.town.region")}>
      <ul>
        {items.map((item) => {
          const icon = item.kind === "weather" ? weatherIcon(item.id) : ITEM_ICON[item.kind];
          const tipHead =
            item.kind === "weather"
              ? t("x.town.weather")
              : item.kind === "news"
                ? t("x.town.news")
                : item.kind === "ordinance"
                  ? t("x.town.ordinance", { day: town.ordinance?.until ?? 0 })
                  : item.kind === "mayor"
                    ? t("x.town.mayor")
                    : t("x.town.story");
          const tip = `${tipHead}${item.effect ? `: ${item.effect}` : item.kind === "weather" || item.kind === "news" ? `: ${t("x.town.noEffect")}` : ""}`;
          return (
            <li key={`${item.kind}:${item.id}`} className="fq-strip-item" data-kind={item.kind}>
              <Tipped tip={tip} className="fq-strip-tip" placement="below">
                <span className="fq-strip-icon">
                  <XIcon name={icon === "weather" ? "weather" : icon} />
                </span>
                <span className="fq-strip-label">{item.label}</span>
              </Tipped>
            </li>
          );
        })}
        {ballots.map((b) => (
          <li key={`${b.kind}`} className="fq-strip-item fq-strip-vote" data-kind="vote">
            <Tipped
              tip={`${t(b.kind === "ordinance" ? "x.town.vote.ordinance" : "x.town.vote.election")}, ${t("x.town.vote.closes", { day: b.closes })}${closingSoon(b) ? "!" : ""}`}
              className="fq-strip-tip"
              placement="below"
            >
              <span className="fq-strip-icon">
                <XIcon name="vote" />
              </span>
              <span className="fq-strip-label">{t("x.town.vote")}</span>
              <span className="fq-strip-badge" aria-hidden="true" />
            </Tipped>
          </li>
        ))}
      </ul>
    </section>
  );
}
