import { useT } from "../i18n/I18nContext.js";
import type { SessionEnd } from "../transport/types.js";

/**
 * Shown when the server ended the session: another log-in, idleness, a ban, a town reset.
 * It says why, and offers the one way forward: back to the front door.
 */
export function EndedScreen({
  reason,
  winner,
  tournamentOver,
  onBack,
  layout,
}: {
  reason: SessionEnd;
  /** The tournament's winner, when a reset was announced. */
  winner?: string | null | undefined;
  tournamentOver?: boolean;
  onBack: () => void;
  layout: string;
}) {
  const t = useT();
  return (
    <div className="fq-app fq-notice-screen" data-layout={layout} data-scene="ended">
      <main className="fq-center fq-surface-dark fq-ended" data-reason={reason} role="alert">
        <h1 className="fq-ended-title">{t("ended.title")}</h1>
        <p className="fq-ended-why">{t(`ended.${reason}`)}</p>
        {tournamentOver && (
          <p className="fq-ended-why">
            {winner ? t("ended.winner", { winner }) : t("ended.noWinner")}
          </p>
        )}
        <button type="button" className="fq-dbtn" data-autofocus onClick={onBack}>
          {t("ended.back")}
        </button>
      </main>
    </div>
  );
}
