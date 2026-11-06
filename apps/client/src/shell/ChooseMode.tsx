import { useT } from "../i18n/I18nContext.js";

export interface ChooseModeProps {
  onOnline: () => void;
  onSolo: () => void;
  /** How the lobby listing went: "ready" means the server answered. */
  server: "loading" | "error" | "ready";
  offline: boolean;
  /** Where the original 2001 client is served, when the server says it is on. */
  museumPath: string | null;
}

/**
 * The first plaque of the front door: play online against other undertakers, or play solo
 * against computer rivals on this device. When the server cannot be reached (or the device is
 * offline) the online choice says so and solo takes the focus.
 */
export function ChooseMode({ onOnline, onSolo, server, offline, museumPath }: ChooseModeProps) {
  const t = useT();
  const unavailable = offline || server === "error";
  return (
    <div className="fq-door-form fq-choose">
      <h2 className="fq-door-heading">{t("choose.title")}</h2>
      <div className="fq-choices">
        <button
          type="button"
          className="fq-dbtn fq-choice"
          data-choice="online"
          data-unavailable={unavailable || undefined}
          data-autofocus={!unavailable || undefined}
          onClick={onOnline}
        >
          <span className="fq-choice-title">{t("choose.online")}</span>
          <span className="fq-choice-note">
            {offline
              ? t("choose.online.offline")
              : server === "error"
                ? t("choose.online.down")
                : t("choose.online.note")}
          </span>
        </button>
        <button
          type="button"
          className="fq-dbtn fq-choice"
          data-choice="solo"
          data-autofocus={unavailable || undefined}
          onClick={onSolo}
        >
          <span className="fq-choice-title">{t("choose.solo")}</span>
          <span className="fq-choice-note">{t("choose.solo.note")}</span>
        </button>
      </div>
      {museumPath && (
        <p className="fq-door-guest">
          <a className="fq-linkbtn" href={museumPath} data-museum-link>
            {t("choose.museum")}
          </a>
        </p>
      )}
    </div>
  );
}
