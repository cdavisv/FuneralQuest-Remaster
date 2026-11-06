import { type Round, roundKind } from "../expanded/club.js";
import { useT } from "../i18n/I18nContext.js";

const nf = new Intl.NumberFormat("en-US");
const dollars = (n: number) => `$${nf.format(Math.abs(n))}`;

type Kind = ReturnType<typeof roundKind>;

/** Two cards face up, the winner raised, level when the stake came back. */
function CardPair({ kind }: { kind: Kind }) {
  const lift = (mine: boolean) => {
    if (kind === "win") return mine ? 2 : 12;
    if (kind === "lose") return mine ? 12 : 2;
    return 7;
  };
  const card = (x: number, y: number, mine: boolean) => (
    <g transform={`translate(${x} ${y})`}>
      <rect width="30" height="42" rx="4" fill="#f6efd8" stroke="#2a1a08" strokeWidth="2" />
      <text x="15" y="28" textAnchor="middle" fontSize="20" fill={mine ? "#7a1a0c" : "#1d1d1d"}>
        {mine ? "♥" : "☠"}
      </text>
    </g>
  );
  return (
    <svg viewBox="0 0 90 60" className="fq-round-art" aria-hidden="true" focusable="false">
      {card(10, lift(true), true)}
      {card(50, lift(false), false)}
    </svg>
  );
}

/** Three reels: all alike for a win, two for a push, none for a loss. */
function Reels({ kind }: { kind: Kind }) {
  const faces =
    kind === "win"
      ? ["☠", "☠", "☠"]
      : kind === "push" || kind === "even"
        ? ["☠", "☠", "✝"]
        : ["☠", "✝", "⚰"];
  return (
    <svg viewBox="0 0 90 60" className="fq-round-art" aria-hidden="true" focusable="false">
      {faces.map((face, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: three fixed reels
        <g key={i} transform={`translate(${6 + i * 29} 8)`}>
          <rect width="25" height="44" rx="4" fill="#f6efd8" stroke="#2a1a08" strokeWidth="2" />
          <text x="12.5" y="30" textAnchor="middle" fontSize="19" fill="#2a1a08">
            {face}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** A row of shot glasses; a win leaves them upright and full, a loss tips one over. */
function Shots({ kind }: { kind: Kind }) {
  return (
    <svg viewBox="0 0 90 60" className="fq-round-art" aria-hidden="true" focusable="false">
      {[0, 1, 2, 3].map((i) => {
        const tipped = kind === "lose" && i === 2;
        const move = `translate(${8 + i * 20} ${tipped ? 34 : 14})`;
        return (
          <g key={i} transform={tipped ? `${move} rotate(80 8 12)` : move}>
            <path
              d="M0 0h16l-3 26h-10z"
              fill="#d9e8ec"
              stroke="#2a1a08"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {!tipped && (
              <path d="M2 9h12l-1.2 17h-9.6z" fill={kind === "win" ? "#5cc45c" : "#9ad07a"} />
            )}
          </g>
        );
      })}
    </svg>
  );
}

const ART = { draw: CardPair, slots: Reels, shots: Shots } as const;

/**
 * The round just played at the Reaper Club, from `View.club.lastRound`: which game, the outcome
 * (won, stake back, lost), what the house handed back and the net change, with a picture of the
 * game: two cards with the winner raised, three reels that line up or do not, a row of shot
 * glasses with one tipped over. The words, the sign and the colour say the same thing, so none of
 * them is the only signal.
 */
export function RoundResult({ round }: { round: Round }) {
  const t = useT();
  const kind = roundKind(round);
  const Art = ART[round.game];
  const net = round.net;
  return (
    <section
      className="fq-round fq-round-result"
      data-result={round.outcome}
      data-game={round.game}
      aria-label={t("x.club.result")}
    >
      <Art kind={kind} />
      <div className="fq-round-words">
        <span className="fq-round-game">{t(`x.club.${round.game}` as "x.club.draw")}</span>
        <b className="fq-round-verdict">{t(`x.club.result.${kind}` as "x.club.result.win")}</b>
        <span className="fq-round-net" data-sign={net > 0 ? "up" : net < 0 ? "down" : "even"}>
          {net > 0 ? "+" : net < 0 ? "-" : ""}
          {dollars(net)}
        </span>
        <small>
          {t("x.club.result.detail", {
            stake: dollars(round.stake),
            payout: dollars(round.payout),
          })}
        </small>
      </div>
    </section>
  );
}
