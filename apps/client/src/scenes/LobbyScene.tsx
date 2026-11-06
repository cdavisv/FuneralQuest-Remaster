import { useArt } from "../art/ArtContext.js";
import { PictureLayers } from "../components/Picture.js";
import { Plaques } from "../components/Plaques.js";
import { RichText } from "../components/RichText.js";
import { TextPanel } from "../components/TextPanel.js";
import { useT } from "../i18n/I18nContext.js";
import type { SceneProps } from "./types.js";

/** True when the pack can draw the lobby from the original's logon artwork. */
export function useLobbyArt(): { backdrop: string; plaque: string; clerk?: string } | null {
  const art = useArt();
  const backdrop = art.piece("logon-screen");
  const plaque = art.piece("login-plaque");
  const clerk = art.piece("new-user-clerk");
  return backdrop && plaque ? { backdrop, plaque, ...(clerk ? { clerk } : {}) } : null;
}

/**
 * The welcome screen on the original's graveyard backdrop: the old clerk who registers new
 * undertakers speaks the welcome note from the golden plaque, the View's text and buttons sit
 * on the plaque, and the picture (if any) hangs in a wooden frame.
 */
export function LobbyScene({
  view,
  onPress,
  revealKey,
  lobby,
}: SceneProps & {
  lobby: NonNullable<ReturnType<typeof useLobbyArt>>;
}) {
  const t = useT();
  const art = useArt();
  const frame = art.piece("picture-frame");
  const rows = Math.max(1, Math.ceil(view.buttons.length / 3));
  return (
    <div className="fq-lobby">
      <h1 className="fq-sr">{view.title}</h1>
      <img className="fq-lobby-bg" src={lobby.backdrop} alt="" draggable={false} />
      {lobby.clerk && <img className="fq-lobby-clerk" src={lobby.clerk} alt="" draggable={false} />}
      <div className="fq-lobby-plaque">
        <div className="fq-lobby-inner fq-surface-light">
          {view.picture && frame && (
            <section
              className="fq-lobby-frame"
              aria-label={t("picture.label", { title: view.title })}
            >
              <PictureLayers picture={view.picture} />
            </section>
          )}
          {view.note && (
            <p className="fq-lobby-note">
              <RichText spans={view.note} />
            </p>
          )}
          <div className="fq-lobby-text">
            <TextPanel
              text={view.text}
              revealKey={revealKey}
              status={view.status}
              variant="sheet"
              rows={rows}
            />
          </div>
          <div className="fq-lobby-buttons">
            <Plaques buttons={view.buttons} onPress={onPress} />
          </div>
        </div>
      </div>
    </div>
  );
}
