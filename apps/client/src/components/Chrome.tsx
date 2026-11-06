import { useArt } from "../art/ArtContext.js";
import { useT } from "../i18n/I18nContext.js";
import { GearIcon } from "./Icons.js";
import { MailIndicator } from "./NoticeLayer.js";

/** Title, settings and the round copper Exit button. `compact` is for full-frame scenes. */
export function Chrome({
  compact,
  mail = 0,
  onSettings,
  onExit,
}: {
  compact?: boolean;
  mail?: number;
  onSettings: () => void;
  /** Omitted on the front door, where there is nothing to exit. */
  onExit?: () => void;
}) {
  const t = useT();
  const exitArt = useArt().piece("button-exit");
  return (
    <header className="fq-chrome" data-compact={compact || undefined}>
      <p className="fq-brand">{t("app.title")}</p>
      <MailIndicator count={mail} />
      <button
        type="button"
        className="fq-gear"
        onClick={onSettings}
        aria-label={t("settings.open")}
      >
        <GearIcon />
      </button>
      {onExit && (
        <button
          type="button"
          className="fq-exit"
          data-art={exitArt ? "piece" : undefined}
          onClick={onExit}
        >
          {exitArt && <img className="fq-exit-img" src={exitArt} alt="" draggable={false} />}
          <span className={exitArt ? "fq-sr" : undefined}>{t("exit.label")}</span>
        </button>
      )}
    </header>
  );
}
