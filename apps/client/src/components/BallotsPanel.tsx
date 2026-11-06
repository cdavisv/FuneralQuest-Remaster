import type { BallotPanel } from "@fq/protocol";
import { useRef } from "react";
import { leader, rankedCandidates, totalVotes } from "../expanded/ballots.js";
import { useT } from "../i18n/I18nContext.js";
import { useScrollable } from "../util/useScrollable.js";
import { useCover } from "./useCover.js";

const nf = new Intl.NumberFormat("en-US");
const dollars = (n: number) => `$${nf.format(n)}`;

export type BallotFocus = "all" | "ordinance" | "election";

/** Which part of City Hall the screen is about, from its buttons; the hall itself shows all. */
export function ballotFocus(ids: readonly string[]): BallotFocus {
  if (ids.some((id) => id.startsWith("city-hall:vote:") || id === "city-hall:lobby"))
    return "ordinance";
  if (
    ids.some(
      (id) =>
        id === "city-hall:file" || id === "city-hall:ads" || id.startsWith("city-hall:elect:"),
    )
  )
    return "election";
  return "all";
}

function Votes({
  votes,
  total,
  mine,
}: {
  votes: number | undefined;
  total: number;
  mine: boolean;
}) {
  const t = useT();
  if (votes === undefined) return <span className="fq-ballot-votes">{t("x.ballots.hidden")}</span>;
  const share = total > 0 ? votes / total : 0;
  return (
    <span className="fq-ballot-votes" data-mine={mine || undefined}>
      <span className="fq-ballot-bar" aria-hidden="true">
        <i style={{ width: `${Math.round(share * 100)}%` }} />
      </span>
      <b>{t("x.ballots.votes", { count: votes })}</b>
    </span>
  );
}

function InForce({ ballots }: { ballots: BallotPanel }) {
  const t = useT();
  const f = ballots.inForce;
  return (
    <section className="fq-ballot-block" aria-label={t("x.ballots.inForce")}>
      <h3>{t("x.ballots.inForce")}</h3>
      {f ? (
        <>
          <p className="fq-ballot-title">{f.title}</p>
          <p className="fq-ballot-effect">{f.effect}</p>
          <p className="fq-ballot-when">
            {f.daysLeft <= 0
              ? t("x.ballots.lastDay")
              : t("x.ballots.daysLeft", { count: f.daysLeft })}
          </p>
        </>
      ) : (
        <p className="fq-ballot-none">{t("x.ballots.noneInForce")}</p>
      )}
    </section>
  );
}

function Ordinance({ ballots }: { ballots: BallotPanel }) {
  const t = useT();
  const o = ballots.ordinance;
  if (!o) {
    return (
      <section className="fq-ballot-block" aria-label={t("x.ballots.ordinance")}>
        <h3>{t("x.ballots.ordinance")}</h3>
        <p className="fq-ballot-none">{t("x.ballots.noBallot")}</p>
      </section>
    );
  }
  const total = totalVotes(o.options);
  const ahead = leader(o.options);
  return (
    <section className="fq-ballot-block" aria-label={t("x.ballots.ordinance")}>
      <h3>{t("x.ballots.ordinance")}</h3>
      <p className="fq-ballot-when">
        {o.daysLeft <= 0
          ? t("x.ballots.closesTonight")
          : t("x.ballots.closesIn", { count: o.daysLeft })}
        {o.myVote === null ? ` ${t("x.ballots.notVoted")}` : ""}
        {o.myWeight > 1 && ` ${t("x.ballots.weight", { n: o.myWeight })}`}
      </p>
      <ul className="fq-ballot-options">
        {o.options.map((opt) => (
          <li
            key={opt.id}
            data-mine={opt.mine || undefined}
            data-ahead={ahead?.id === opt.id || undefined}
          >
            <span className="fq-ballot-title">
              {opt.title}
              {opt.mine && <span className="fq-ballot-yours">{t("x.ballots.yourVote")}</span>}
            </span>
            <span className="fq-ballot-effect">{opt.effect}</span>
            <Votes votes={opt.votes} total={total} mine={opt.mine} />
          </li>
        ))}
      </ul>
      <p className="fq-ballot-lobby">
        {t("x.ballots.lobby", {
          price: dollars(o.lobby.price),
          bought: o.lobby.bought,
          max: o.lobby.max,
        })}
      </p>
    </section>
  );
}

function Election({ ballots }: { ballots: BallotPanel }) {
  const t = useT();
  const e = ballots.election;
  const ranked = rankedCandidates(e);
  const total = ranked.reduce((n, c) => n + (c.votes ?? 0), 0);
  return (
    <section className="fq-ballot-block" aria-label={t("x.ballots.election")}>
      <h3>{t("x.ballots.election")}</h3>
      <p className="fq-ballot-when">
        <b data-phase={e.phase}>{t(`x.ballots.phase.${e.phase}` as "x.ballots.phase.filing")}</b>
        {e.phase !== "done" &&
          ` ${e.daysLeft <= 0 ? t("x.ballots.endsTonight") : t("x.ballots.endsIn", { count: e.daysLeft })}`}
      </p>
      {e.phase === "filing" && (
        <p className="fq-ballot-lobby">
          {e.filed
            ? t("x.ballots.filed")
            : t("x.ballots.fee", { fee: dollars(e.fee), until: e.filingUntil })}
        </p>
      )}
      {ranked.length > 0 ? (
        <ul className="fq-ballot-options fq-ballot-cands">
          {ranked.map((c) => (
            <li key={c.playerId} data-mine={c.mine || undefined} data-me={c.me || undefined}>
              <span className="fq-ballot-title">
                {c.name}
                {c.me && <span className="fq-ballot-yours">{t("x.ballots.you")}</span>}
                {c.mine && <span className="fq-ballot-yours">{t("x.ballots.yourVote")}</span>}
              </span>
              <span className="fq-ballot-effect">{t("x.ballots.ads", { count: c.ads })}</span>
              {e.phase !== "filing" && <Votes votes={c.votes} total={total} mine={c.mine} />}
            </li>
          ))}
        </ul>
      ) : (
        <p className="fq-ballot-none">{t("x.ballots.noCandidates")}</p>
      )}
      <p className="fq-ballot-mayor">{t("x.ballots.mayor", { name: e.mayor })}</p>
    </section>
  );
}

/**
 * City Hall's ballots, from `View.ballots`: the ordinance in force and its days left, the open
 * ordinance ballot with each option's votes and the player's own vote marked as theirs, the
 * lobbying allowance, and the mayoral election (phase, candidates, whether the player has filed,
 * the mayor). The block the screen is about comes first.
 */
export function BallotsPanel({ ballots, focus }: { ballots: BallotPanel; focus: BallotFocus }) {
  const t = useT();
  const scroller = useRef<HTMLDivElement>(null);
  const scrolls = useScrollable(scroller);
  const blocks = {
    force: <InForce key="force" ballots={ballots} />,
    ordinance: <Ordinance key="ordinance" ballots={ballots} />,
    election: <Election key="election" ballots={ballots} />,
  };
  const order =
    focus === "ordinance"
      ? [blocks.ordinance, blocks.force, blocks.election]
      : focus === "election"
        ? [blocks.election, blocks.force, blocks.ordinance]
        : [blocks.force, blocks.ordinance, blocks.election];
  return (
    <section
      className="fq-npanel fq-ballots fq-surface-light"
      data-cover={useCover()}
      data-focus={focus}
      aria-label={t("x.ballots.region")}
    >
      <div
        className="fq-ballots-scroll"
        ref={scroller}
        {...(scrolls ? { tabIndex: 0, role: "region", "aria-label": t("scroll.region") } : {})}
      >
        {order}
      </div>
    </section>
  );
}
