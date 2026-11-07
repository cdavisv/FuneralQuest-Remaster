import type { TownInfo } from "@fq/server/client";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useArt } from "../art/ArtContext.js";
import { useAudio } from "../audio/AudioContext.js";
import { RichText } from "../components/RichText.js";
import { useT } from "../i18n/I18nContext.js";
import type { LayoutMode } from "../util/useLayout.js";

export type LobbyState =
  | { state: "loading" }
  | { state: "error" }
  | { state: "ready"; towns: TownInfo[] };

/** "5 h 12 min", "12 min", "under a minute". */
export function formatCountdown(ms: number): { hours: number; minutes: number } {
  const total = Math.max(0, Math.floor(ms / 60_000));
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

function useNow(everyMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

function Countdown({ to }: { to: string }) {
  const t = useT();
  const now = useNow(30_000);
  const { hours, minutes } = formatCountdown(Date.parse(to) - now);
  if (Number.isNaN(Date.parse(to))) return null;
  if (hours === 0 && minutes === 0) return <>{t("status.underMinute")}</>;
  return (
    <>{hours > 0 ? t("status.hm", { h: hours, m: minutes }) : t("status.m", { m: minutes })}</>
  );
}

/**
 * Server status and the game's state, from the public lobby endpoint. The engine's own game
 * line ("No Reset Mode Active (day 1) - 3 of 12 players on now") leads; a server that does not
 * send one gets the same facts as a short list. When the engine says new accounts are refused
 * (town full, tournament over), the reason is shown above the plaque.
 */
export function GameStatus({ town }: { town: TownInfo }) {
  const t = useT();
  const lobby = town.lobby as TownInfo["lobby"] | undefined;
  return (
    <>
      {lobby?.closed && lobby.closed.length > 0 && (
        <p className="fq-door-closed" role="status">
          <RichText spans={lobby.closed} />
        </p>
      )}
      {lobby?.gameInfo && lobby.gameInfo.length > 0 && (
        <p className="fq-door-gameinfo">
          <RichText spans={lobby.gameInfo} />
        </p>
      )}
      <dl className="fq-door-status-list">
        {!lobby?.gameInfo && (
          <>
            <div>
              <dt>{t("status.day")}</dt>
              <dd>{town.day}</dd>
            </div>
            <div>
              <dt>{t("status.online")}</dt>
              <dd>
                {t("status.players", {
                  online: town.players.online,
                  registered: town.players.registered,
                })}
              </dd>
            </div>
          </>
        )}
        <div>
          <dt>{town.dayLengthMinutes ? t("status.blitz") : t("status.nextDay")}</dt>
          <dd>
            <Countdown to={town.nextDayAt} />
          </dd>
        </div>
        {(!lobby?.gameInfo || town.tournament.active) && (
          <div>
            <dt>{t("status.tournament")}</dt>
            <dd>
              {town.tournament.active
                ? town.tournament.daysLeft === null
                  ? t("status.tournament.on")
                  : t("status.tournament.left", { count: town.tournament.daysLeft })
                : t("status.tournament.none")}
            </dd>
          </div>
        )}
      </dl>
    </>
  );
}

/** The town's ruleset as a small badge: Classic, Expanded, or whatever the server calls it. */
export function RulesetBadge({ town }: { town: TownInfo }) {
  const t = useT();
  const id = (town.ruleset as string | undefined) ?? "classic";
  const label =
    (town.rulesetLabel as string | undefined) ??
    (id === "expanded" ? t("x.lobby.expanded") : id === "classic" ? t("x.lobby.classic") : id);
  return (
    <span className="fq-ruleset" data-ruleset={id} title={t("x.lobby.ruleset")}>
      {label}
    </span>
  );
}

/**
 * One line on what the ruleset is. The client's own words for the rulesets it knows (Classic and
 * Expanded); for another ruleset the first sentence of what the server says about it.
 */
export function rulesetLine(
  t: ReturnType<typeof useT>,
  town: { ruleset?: string; description?: string },
): string {
  if (town.ruleset === "expanded") return t("x.lobby.expanded.line");
  if (town.ruleset === "classic" || town.ruleset === undefined) return t("x.lobby.classic.line");
  const first = town.description?.split(/(?<=[.!?])\s/)[0];
  return first ?? "";
}

export interface DoorSceneProps {
  layout: LayoutMode;
  lobby: LobbyState;
  townId: string | null;
  onTown: (id: string) => void;
  onRetry: () => void;
  onPage: (route: string) => void;
  /** The form or message on the wooden plaque. */
  children: ReactNode;
  /** Show the clerk at his desk in the plaque (the new-user screens) instead of standing by it. */
  clerkAtDesk?: boolean;
  /** When this changes, focus moves to the plaque's first field (a new form appeared). */
  focusKey?: string;
  /** Offered when the player can choose between online and solo: a link back to that choice. */
  onSwitchMode?: () => void;
  /** Where the original 2001 client is served, when the server says it is on. */
  museumPath?: string | null;
  /** "solo" swaps the server's status for what Solo mode is; "setup" gives the form the whole screen. */
  variant?: "online" | "solo" | "setup";
  /** In solo mode: a line to show above the plaque's explanation (for example, "You are offline"). */
  soloNote?: string | null;
  /** When the server offers the Daily Challenge: the card on the title screen. */
  daily?: { onOpen: () => void; onResults: () => void } | null;
}

/**
 * The front door: the gold title over the dim graveyard, the server's status and news, links
 * to the rules and rankings, and the wooden plaque that holds whichever form is current. The
 * art is the original's (`logon-screen`, `login-plaque`, `new-user-clerk`); every word is live text.
 */
export function DoorScene({
  layout,
  lobby,
  townId,
  onTown,
  onRetry,
  onPage,
  children,
  clerkAtDesk,
  focusKey,
  onSwitchMode,
  museumPath,
  variant = "online",
  soloNote,
  daily,
}: DoorSceneProps) {
  const plaque = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusKey === undefined || focusKey.startsWith("boot")) return;
    plaque.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }, [focusKey]);
  const t = useT();
  const art = useArt();
  const audio = useAudio();
  // The front door plays the main theme (once sound is unlocked).
  useEffect(() => {
    audio.setMusic("main");
  }, [audio]);
  const backdrop = art.piece("logon-screen");
  const clerk = art.piece("new-user-clerk");
  const logo = art.piece("logo");
  const frame = art.piece("picture-frame");
  const towns = lobby.state === "ready" ? lobby.towns : [];
  const town = towns.find((x) => x.id === townId) ?? towns[0];

  const links: [string, string][] = [
    ["intro", t("page.intro")],
    ["gameplay", t("page.gameplay")],
    ["rules", t("page.rules")],
    ["rankings", t("page.rankings")],
    ["credits", t("page.credits")],
  ];
  const solo = variant !== "online";

  return (
    <div
      className="fq-door"
      data-layout={layout}
      data-clerk={clerkAtDesk ? "desk" : "stand"}
      data-variant={variant}
    >
      <h1 className="fq-sr">{t("app.title")}</h1>
      {backdrop && <img className="fq-lobby-bg" src={backdrop} alt="" draggable={false} />}
      {layout === "phone" && logo && (
        <img className="fq-door-logo" src={logo} alt={t("app.title")} draggable={false} />
      )}
      {!clerkAtDesk && clerk && (
        <img className="fq-lobby-clerk fq-door-clerk" src={clerk} alt="" draggable={false} />
      )}
      <section
        className="fq-door-info fq-surface-dark"
        aria-label={t("door.info")}
        data-multi={!solo && towns.length > 1 ? "" : undefined}
      >
        {solo ? (
          <>
            <p className="fq-door-server" role="status" data-state="solo">
              {t("solo.info.title")}
            </p>
            {soloNote && <p className="fq-door-closed">{soloNote}</p>}
            <p className="fq-door-gameinfo">{t("solo.info.lead")}</p>
            <p className="fq-door-note">{t("solo.info.saves")}</p>
          </>
        ) : (
          <p className="fq-door-server" role="status" data-state={lobby.state}>
            {lobby.state === "loading" && t("door.connecting")}
            {lobby.state === "error" && (
              <>
                {t("door.unreachable")}{" "}
                <button type="button" className="fq-linkbtn" onClick={onRetry}>
                  {t("app.retry")}
                </button>
              </>
            )}
            {lobby.state === "ready" &&
              (town ? t("door.connected", { town: town.name }) : t("door.noTowns"))}
          </p>
        )}
        <nav className="fq-door-links" aria-label={t("door.links")}>
          {links
            .filter(([route]) => !solo || route !== "rankings")
            .map(([route, label]) => (
              <button
                key={route}
                type="button"
                className="fq-linkbtn"
                onClick={() => onPage(route)}
              >
                {label}
              </button>
            ))}
          {museumPath && (
            <a className="fq-linkbtn" href={museumPath} data-museum-link>
              {t("door.museum")}
            </a>
          )}
          {!solo && daily && (
            <button type="button" className="fq-linkbtn fq-daily-link" onClick={daily.onOpen}>
              {t("x.challenge.title")}
            </button>
          )}
          {onSwitchMode && (
            <button type="button" className="fq-linkbtn" onClick={onSwitchMode}>
              {t("door.switchMode")}
            </button>
          )}
        </nav>
        {!solo && towns.length > 1 && (
          <fieldset className="fq-towns">
            <legend className="fq-sr">{t("door.towns")}</legend>
            {towns.map((x) => (
              <label key={x.id} className="fq-town" data-checked={x.id === town?.id || undefined}>
                <input
                  type="radio"
                  name="town"
                  checked={x.id === town?.id}
                  onChange={() => onTown(x.id)}
                />
                <span className="fq-town-name">{x.name}</span>
                <RulesetBadge town={x} />
                <span
                  className="fq-town-count"
                  title={t("status.onlineShort", { online: x.players.online })}
                >
                  {x.players.online}
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {!solo && town && (
          <>
            {(towns.length > 1 || town.ruleset === "expanded") && (
              <p className="fq-town-ruleset">
                {towns.length <= 1 && <RulesetBadge town={town} />}{" "}
                <span className="fq-town-line">{rulesetLine(t, town)}</span>
              </p>
            )}
            <GameStatus town={town} />
            {town.serverNews.length > 0 && (
              <section className="fq-door-news" aria-label={t("door.news")}>
                <h2 className="fq-door-news-title">{t("door.news")}</h2>
                <p>
                  <RichText spans={town.serverNews} />
                </p>
              </section>
            )}
          </>
        )}
      </section>
      <div className="fq-door-plaque" ref={plaque}>
        <div className="fq-lobby-inner fq-door-inner fq-surface-light">
          {clerkAtDesk && clerk && frame && (
            <div className="fq-door-portrait" aria-hidden="true">
              <img src={clerk} alt="" draggable={false} />
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
