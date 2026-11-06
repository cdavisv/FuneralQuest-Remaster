import type { TownInfo } from "@fq/server/client";
import { useEffect, useRef } from "react";
import { useArt } from "../art/ArtContext.js";
import { useT } from "../i18n/I18nContext.js";
import type { LobbyState } from "./DoorScene.js";
import { type Block, PAGES, type PageId } from "./pages.js";

export type Route = PageId | "rankings";

export const isRoute = (value: string): value is Route =>
  value === "rankings" ||
  value === "intro" ||
  value === "gameplay" ||
  value === "rules" ||
  value === "credits";

/** `#/rules` -> "rules"; anything else -> null. */
export function routeFromHash(hash: string): Route | null {
  const m = /^#\/([a-z]+)$/.exec(hash);
  return m?.[1] && isRoute(m[1]) ? m[1] : null;
}

function renderBlock(b: Block, i: number) {
  if (b.kind === "h") return <h3 key={i}>{b.text}</h3>;
  if (b.kind === "p") return <p key={i}>{b.text}</p>;
  if (b.kind === "term") {
    return (
      <p key={i}>
        <strong>{b.term}.</strong> {b.text}
      </p>
    );
  }
  return (
    <ul key={i}>
      {b.items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function Blocks({ blocks }: { blocks: Block[] }) {
  return <>{blocks.map(renderBlock)}</>;
}

function RankingsPage({ lobby }: { lobby: LobbyState }) {
  const t = useT();
  if (lobby.state !== "ready") {
    return <p>{lobby.state === "loading" ? t("door.connecting") : t("door.unreachable")}</p>;
  }
  const nf = new Intl.NumberFormat("en-US");
  return (
    <>
      <p>{t("rankings.lead")}</p>
      {lobby.towns.map((town: TownInfo) => (
        <section key={town.id}>
          <h3>{town.name}</h3>
          {town.rankings.length === 0 ? (
            <p>{t("rankings.empty")}</p>
          ) : (
            <table className="fq-page-table">
              <caption className="fq-sr">{town.name}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("rank.place")}</th>
                  <th scope="col">{t("rank.parlor")}</th>
                  <th scope="col" className="fq-num-col">
                    {t("rank.bp")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {town.rankings.map((r) => (
                  <tr key={`${r.rank}:${r.name}`}>
                    <td>{r.rank}</td>
                    <td>
                      <strong>{r.name}</strong> <span>{r.parlor}</span>
                    </td>
                    <td className="fq-num-col">{nf.format(r.bp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </>
  );
}

/**
 * The introduction, gameplay tips, rules and credits the original shipped as web pages, plus
 * the top ten of every town, restyled as in-app pages on the logon plaque. They are reached
 * from the front door (and by address, `#/rules`), and "Play" goes back.
 */
export function StaticPage({
  route,
  lobby,
  onRoute,
  onClose,
}: {
  route: Route;
  lobby: LobbyState;
  onRoute: (route: Route) => void;
  onClose: () => void;
}) {
  const t = useT();
  const art = useArt();
  const logo = art.piece("logo");
  const backdrop = art.piece("logon-screen");
  const heading = useRef<HTMLHeadingElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: move focus to the page title on a new page.
  useEffect(() => {
    heading.current?.focus();
  }, [route]);

  const page = route === "rankings" ? null : PAGES[route];
  const tabs: Route[] = ["intro", "gameplay", "rules", "credits", "rankings"];

  return (
    <div className="fq-page" data-route={route}>
      {backdrop && <img className="fq-page-bg" src={backdrop} alt="" draggable={false} />}
      <div className="fq-page-inner">
        <header className="fq-page-head">
          {logo ? (
            <img className="fq-page-logo" src={logo} alt={t("app.title")} draggable={false} />
          ) : (
            <p className="fq-brand">{t("app.title")}</p>
          )}
          <nav className="fq-page-nav" aria-label={t("page.nav")}>
            {tabs.map((r) => (
              <button
                key={r}
                type="button"
                className="fq-linkbtn"
                aria-current={r === route ? "page" : undefined}
                onClick={() => onRoute(r)}
              >
                {t(`page.${r}`)}
              </button>
            ))}
            <button type="button" className="fq-linkbtn fq-page-play" onClick={onClose}>
              {t("page.play")}
            </button>
          </nav>
        </header>
        <main className="fq-page-panel fq-surface-light">
          <h1 ref={heading} tabIndex={-1} className="fq-page-title">
            {route === "rankings" ? t("page.rankings") : page?.title}
          </h1>
          {page?.lead && <p className="fq-page-lead">{page.lead}</p>}
          {page ? <Blocks blocks={page.blocks} /> : <RankingsPage lobby={lobby} />}
          <p className="fq-page-foot">
            <button type="button" className="fq-linkbtn" onClick={onClose}>
              {t("page.back")}
            </button>
          </p>
        </main>
      </div>
    </div>
  );
}
