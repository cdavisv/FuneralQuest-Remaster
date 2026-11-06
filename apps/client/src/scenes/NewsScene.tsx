import type { CSSProperties } from "react";
import { useArt } from "../art/ArtContext.js";
import { au, relBox, STAGE } from "../art/geometry.js";
import type { NewsSpec, Rect } from "../art/types.js";
import { HouseIcon } from "../components/Icons.js";
import { Plaques } from "../components/Plaques.js";
import { RichText } from "../components/RichText.js";
import { useT } from "../i18n/I18nContext.js";
import { AnnouncementsButton } from "../moderation/ActionMenu.js"; // moderation hook
import type { SceneProps } from "./types.js";

function Notice({ title, body }: { title: string; body: SceneProps["view"]["text"] }) {
  return (
    <section className="fq-notice fq-surface-light">
      <i className="fq-tack fq-tack-tr" aria-hidden="true" />
      <i className="fq-tack fq-tack-br" aria-hidden="true" />
      <h2>{title}</h2>
      <p>
        <RichText spans={body} />
      </p>
    </section>
  );
}

/** The dark brick wall behind the paper, as a vector pattern that scales with the screen. */
function BrickWall() {
  return (
    <svg
      className="fq-wall"
      viewBox="0 0 1024 745"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern id="fq-brick" width="72" height="40" patternUnits="userSpaceOnUse">
          <rect width="72" height="40" fill="#241410" />
          <rect x="2" y="2" width="32" height="16" fill="#5a2e22" />
          <rect x="38" y="2" width="32" height="16" fill="#4d2820" />
          <rect x="-16" y="22" width="32" height="16" fill="#4d2820" />
          <rect x="20" y="22" width="32" height="16" fill="#5f3326" />
          <rect x="56" y="22" width="32" height="16" fill="#512a21" />
        </pattern>
        <radialGradient id="fq-wall-shade" cx="0.5" cy="0.45" r="0.8">
          <stop offset="0.35" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.7" />
        </radialGradient>
      </defs>
      <rect width="1024" height="745" fill="url(#fq-brick)" />
      <rect width="1024" height="745" fill="url(#fq-wall-shade)" />
    </svg>
  );
}

/** The Funeral Times on a brick wall: two pinned notices and the broadsheet. */
export function NewsScene(props: SceneProps) {
  const art = useArt();
  const url = art.piece("newspaper");
  if (url && art.pack.news && props.layout !== "phone") {
    return <ArtNews {...props} spec={art.pack.news} url={url} />;
  }
  return <DrawnNews {...props} />;
}

/**
 * The Funeral Times as the original drew it: the wall, both notice boards and the broadsheet
 * are one drawing, and the notices, section bar, story and links are live text over it. The
 * drawing keeps its own proportions; a wider window gets more brick.
 */
function ArtNews({
  view,
  layout,
  onPress,
  spec,
  url,
}: SceneProps & { spec: NewsSpec; url: string }) {
  const t = useT();
  const news = view.news;
  const [sw, sh] = layout === "wide" ? STAGE.wide : STAGE.classic;
  const [vx, vy, vw, vh] = spec.viewBox;
  const scale = Math.min(sw / vw, sh / vh);
  const origin: Rect = { x: vx, y: vy, w: vw, h: vh };
  const r = spec.regions;
  const stage = {
    "--au": `calc(var(--u) * ${scale})`,
    left: `calc(var(--u) * ${(sw - vw * scale) / 2})`,
    top: `calc(var(--u) * ${(sh - vh * scale) / 2})`,
    width: `calc(var(--u) * ${vw * scale})`,
    height: `calc(var(--u) * ${vh * scale})`,
  } as CSSProperties;
  const notice = (title: string, body: SceneProps["view"]["text"], area: typeof r.noticeToday) => (
    <section className="fq-notice-art fq-surface-light" style={relBox(area.title, origin)}>
      <h2 style={{ height: au(area.title.h) }}>{title}</h2>
      <p style={{ ...relBox(area.body, area.title), position: "absolute" }}>
        <RichText spans={body} />
      </p>
    </section>
  );
  return (
    <div
      className="fq-news fq-news-art"
      style={{ "--au": stage.height ? `calc(var(--u) * ${scale})` : "" } as CSSProperties}
    >
      <h1 className="fq-sr">{view.title}</h1>
      <div className="fq-news-stage" style={stage}>
        <img className="fq-news-img" src={url} alt="" draggable={false} />
        {news && (
          <>
            {notice(t("news.topToday"), news.topToday, r.noticeToday)}
            {notice(t("news.topYesterday"), news.topYesterday, r.noticeYesterday)}
          </>
        )}
        <article
          className="fq-paper-art fq-surface-light"
          aria-label={t("news.article")}
          style={relBox(
            { x: r.bar.x, y: r.bar.y, w: r.bar.w, h: r.buttons.y + r.buttons.h - r.bar.y },
            origin,
          )}
        >
          {news && (
            <ul
              className="fq-paper-bar"
              aria-label={t("news.sections")}
              style={{ height: au(r.bar.h) }}
            >
              <li>{t("news.page", { n: news.section === "front" ? 1 : 2 })}</li>
              <li
                className="fq-section"
                aria-current={news.section === "front" ? "page" : undefined}
              >
                {t("news.front")}
              </li>
              <li>{t("news.day", { n: news.day })}</li>
              <li
                className="fq-section"
                aria-current={news.section === "crime" ? "page" : undefined}
              >
                {t("news.crime")}
              </li>
            </ul>
          )}
          <div className="fq-paper-body" style={{ ...relBox(r.body, r.bar), position: "absolute" }}>
            {news?.isYesterday && <p className="fq-edition">{t("news.yesterdayEdition")}</p>}
            {news ? <RichText spans={news.body} /> : <RichText spans={view.text} />}
            {/* moderation hook */}
            {news && <AnnouncementsButton body={news.body} />}
          </div>
          <div
            className="fq-paper-buttons"
            style={{ ...relBox(r.buttons, r.bar), position: "absolute" }}
          >
            <Plaques buttons={view.buttons} onPress={onPress} variant="link" />
          </div>
        </article>
      </div>
    </div>
  );
}

/** The Funeral Times on a brick wall: two pinned notices and the broadsheet, all drawn in CSS. */
function DrawnNews({ view, onPress }: SceneProps) {
  const t = useT();
  const news = view.news;
  const [firstWord = "", ...rest] = t("news.masthead").split(" ");
  return (
    <div className="fq-news">
      <h1 className="fq-sr">{view.title}</h1>
      <BrickWall />
      {news && (
        <div className="fq-notices">
          <Notice title={t("news.topToday")} body={news.topToday} />
          <Notice title={t("news.topYesterday")} body={news.topYesterday} />
        </div>
      )}
      <article className="fq-paper fq-surface-light" aria-label={t("news.article")}>
        <div className="fq-masthead" aria-hidden="true">
          <span className="fq-masthead-word">{firstWord}</span>
          <HouseIcon />
          <span className="fq-masthead-word">{rest.join(" ")}</span>
          <span className="fq-since">{t("news.since")}</span>
        </div>
        {news && (
          <ul className="fq-paper-bar" aria-label={t("news.sections")}>
            <li>{t("news.page", { n: news.section === "front" ? 1 : 2 })}</li>
            <li className="fq-section" aria-current={news.section === "front" ? "page" : undefined}>
              {t("news.front")}
            </li>
            <li>{t("news.day", { n: news.day })}</li>
            <li className="fq-section" aria-current={news.section === "crime" ? "page" : undefined}>
              {t("news.crime")}
            </li>
          </ul>
        )}
        {news?.isYesterday && <p className="fq-edition">{t("news.yesterdayEdition")}</p>}
        <div className="fq-paper-body">
          {news ? <RichText spans={news.body} /> : <RichText spans={view.text} />}
          {/* moderation hook */}
          {news && <AnnouncementsButton body={news.body} />}
        </div>
        <div className="fq-paper-buttons">
          <Plaques buttons={view.buttons} onPress={onPress} variant="link" />
        </div>
      </article>
    </div>
  );
}
