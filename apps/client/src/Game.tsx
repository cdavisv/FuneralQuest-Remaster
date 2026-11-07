import type { Action, RichText, View } from "@fq/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import { useArt } from "./art/ArtContext.js";
import { CabinetArtContext, type CabinetArtState } from "./art/CabinetContext.js";
import { cabinetVars, placeArt } from "./art/geometry.js";
import { useAudio } from "./audio/AudioContext.js";
import { useCharacterVoices } from "./audio/voiceHook.js";
import { CabinetArt } from "./components/CabinetArt.js";
import { Chrome } from "./components/Chrome.js";
import { Dialog } from "./components/Dialog.js";
import { EndedScreen } from "./components/EndedScreen.js";
import { NoticeLayer } from "./components/NoticeLayer.js";
import { cancelAction, OverlayView } from "./components/Overlays.js";
import { spanText } from "./components/RichText.js";
import { SettingsPanel } from "./components/SettingsPanel.js";
import { useT } from "./i18n/I18nContext.js";
import { CabinetScene } from "./scenes/CabinetScene.js";
import { LobbyScene, useLobbyArt } from "./scenes/LobbyScene.js";
import { MapScene } from "./scenes/MapScene.js";
import { NewsScene } from "./scenes/NewsScene.js";
import type { SceneProps } from "./scenes/types.js";
import { useSettings } from "./settings/settings.js";
import { useGame } from "./state/useGame.js";
import { useNotices } from "./state/useNotices.js";
import type { LiveTransport } from "./transport/types.js";
import { backButton, useBackHandler } from "./util/back.js";
import { useAppStyle } from "./util/useAppStyle.js";
import { useLayoutMode } from "./util/useLayout.js";

const DESIGN_SIZE = { classic: [1024, 745], wide: [1280, 720] } as const;
const MAX_LOG = 40;

/**
 * Which cabinet art a View is drawn on. The desk and the negotiation show the player's stats on
 * the original's stats parchment; a place with a room description uses the plain parchment.
 */
export function cabinetVariant(view: View): string {
  if (view.scene === "cafe") return "chat";
  if (view.scene === "rankings") return "rankings";
  if (view.scene === "stats") return "status";
  // The Expanded customer's file covers the stats parchment, so the sale always sits on it.
  if (view.customer?.estimate) return "main";
  return !view.note && view.hud ? "main" : "generic";
}

/** True once `value` has been true for `ms` without a break. */
function useDelayed(value: boolean, ms: number): boolean {
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!value) {
      setLate(false);
      return;
    }
    const id = setTimeout(() => setLate(true), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return late;
}

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

export interface GameProps {
  transport: LiveTransport;
  /** A Solo career (character voices default to on, as in Expanded towns). */
  solo?: boolean;
  /**
   * Back to the front door, after Exit or when the session ended. Without it (the mock and the
   * tests) the game shows its own goodbye screen with a way to reconnect.
   */
  onLeave?: () => void;
  /**
   * The host's own lobby screen (Solo: "Open the Parlor", "Sleep Until Tomorrow") is a screen to
   * play, not the server telling the player their session ended.
   */
  ownLobby?: boolean;
  /** Shown (politely) when an action takes noticeably long, for example a night of rival turns. */
  busyNote?: string;
}

export function Game({ transport, onLeave, busyNote, ownLobby, solo }: GameProps) {
  const t = useT();
  const audio = useAudio();
  const { settings } = useSettings();
  const layout = useLayoutMode(settings.layout);
  const art = useArt();
  const lobbyArt = useLobbyArt();
  const game = useGame(transport);
  const { view, dispatch } = game;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  // A message the player just dismissed stays hidden until the server's answer arrives.
  const [dismissing, setDismissing] = useState<{ id: string; at: number } | null>(null);
  const [log, setLog] = useState<RichText[]>([]);
  const slowBusy = useDelayed(game.busy, 350);
  const [notices, noticeDispatch] = useNotices(transport, view?.scene);

  // The engine took the player out of the game: it pushes the lobby View, then says why.
  useEffect(() => {
    if (view?.scene === "lobby" && transport.onNotice && !ownLobby) {
      noticeDispatch({ type: "lobbyView" });
    }
  }, [view, transport, noticeDispatch, ownLobby]);

  // Letters are delivered when the player reaches the desk, so the indicator's job is done then.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per answered action.
  useEffect(() => {
    if (view?.scene === "desk") noticeDispatch({ type: "mailRead" });
  }, [game.responseId]);

  // Sound cues follow every View, including pushed ones; the manager reads the View itself for
  // the music, ambience and events it implies (see @fq/audio's cue map).
  useEffect(() => {
    if (view) audio.cue(view.music, view.sounds, view);
  }, [view, audio]);
  useCharacterVoices(view, solo === true);

  useEffect(() => {
    document.title = view ? `${view.title} - ${t("app.title")}` : t("app.title");
  }, [view, t]);

  // Keep the text of screens the player has moved past for the wide layout's log.
  const previous = useRef<RichText | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per answered action.
  useEffect(() => {
    const prev = previous.current;
    previous.current = view?.text ?? null;
    if (prev && prev.length > 0) {
      setLog((l) => {
        const last = l[l.length - 1];
        if (last && spanText(last) === spanText(prev)) return l;
        return [...l, prev].slice(-MAX_LOG);
      });
    }
  }, [game.responseId]);

  const overlay = view?.overlay;
  const overlayKey = overlay ? `${game.responseId}:${JSON.stringify(overlay)}` : null;
  const overlayVisible =
    overlay !== undefined &&
    !(
      overlay.kind === "message" &&
      dismissing?.id === overlay.id &&
      dismissing.at === game.responseId
    );
  const dialogOpen = overlayVisible || settingsOpen || exitOpen || game.sendError !== null;

  const press = useCallback(
    (buttonId: string) => {
      const action: Action = { type: "press", buttonId };
      audio.action(action);
      dispatch(action);
    },
    [dispatch, audio],
  );
  const act = useCallback(
    (action: Action) => {
      if (action.type === "dismiss") setDismissing({ id: action.overlayId, at: game.responseId });
      audio.action(action);
      dispatch(action);
    },
    [dispatch, game.responseId, audio],
  );

  // Start on a gamepad opens Settings (or closes it again).
  useEffect(() => {
    const toggle = () => setSettingsOpen((open) => !open);
    window.addEventListener("fq:settings", toggle);
    return () => window.removeEventListener("fq:settings", toggle);
  }, []);

  const closeTop = useCallback(() => {
    if (game.sendError) game.dismissError();
    else if (exitOpen) setExitOpen(false);
    else if (settingsOpen) setSettingsOpen(false);
    else if (overlay && overlayVisible) {
      act(cancelAction(overlay));
    }
  }, [game, exitOpen, settingsOpen, overlay, overlayVisible, act]);

  // Keys 1 to 9 press the buttons, Escape closes the top dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape") {
        if (dialogOpen) {
          e.preventDefault();
          closeTop();
        }
        return;
      }
      if (dialogOpen || isEditable(e.target) || !/^[1-9]$/.test(e.key) || !view) return;
      const button = view.buttons[Number(e.key) - 1];
      if (button && button.enabled !== false) {
        e.preventDefault();
        press(button.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialogOpen, closeTop, view, press]);

  // The Android back button: close the top dialog, else leave the screen through its own Back or
  // Leave button. Not handled (false) on the desk and in a sale, where the app asks about leaving.
  useBackHandler(() => {
    if (dialogOpen) {
      closeTop();
      return true;
    }
    const back = view ? backButton(view) : undefined;
    if (!back) return false;
    press(back.id);
    return true;
  });

  const appStyle = useAppStyle();

  // Leaving through the front door: nothing to show while the shell takes over.
  // biome-ignore lint/correctness/useExhaustiveDependencies: onLeave is a callback prop.
  useEffect(() => {
    if (game.status === "closed" && onLeave) onLeave();
  }, [game.status]);

  // Leaving on purpose (the desk's own Exit choice ends the session with "quit") goes straight
  // back to the front door; the "session ended" screen is for what the player did not choose.
  const quitByChoice = notices.ended === "quit" && onLeave !== undefined;
  // biome-ignore lint/correctness/useExhaustiveDependencies: onLeave is a callback prop.
  useEffect(() => {
    if (quitByChoice) onLeave?.();
  }, [quitByChoice]);

  if ((game.status === "closed" || quitByChoice) && onLeave) return null;
  if (game.status === "closed") {
    return (
      <div className="fq-app fq-notice-screen" data-layout={layout} style={appStyle}>
        <main className="fq-center fq-surface-dark">
          <p>{t("app.goodbye")}</p>
          <button type="button" className="fq-dbtn" data-autofocus onClick={game.reconnect}>
            {t("app.return")}
          </button>
        </main>
      </div>
    );
  }
  if (game.status === "failed") {
    return (
      <div className="fq-app fq-notice-screen" data-layout={layout} style={appStyle}>
        <main className="fq-center fq-surface-dark" role="alert">
          <p>{t("app.connectFailed")}</p>
          <button type="button" className="fq-dbtn" onClick={game.reconnect}>
            {t("app.retry")}
          </button>
        </main>
      </div>
    );
  }
  if (notices.ended) {
    return (
      <EndedScreen
        reason={notices.ended}
        layout={layout}
        tournamentOver={notices.reset !== null}
        winner={notices.reset?.winner}
        onBack={onLeave ?? game.reconnect}
      />
    );
  }
  if (!view) {
    return (
      <div className="fq-app fq-notice-screen" data-layout={layout} style={appStyle}>
        <main className="fq-center fq-surface-dark" aria-busy="true">
          <p role="status">{t("app.loading")}</p>
        </main>
      </div>
    );
  }

  const sceneProps: SceneProps = {
    view,
    layout,
    onPress: press,
    onAction: act,
    revealKey: String(game.responseId),
    log,
  };
  const lobbyScene = view.scene === "lobby" && layout !== "phone" && lobbyArt !== null;
  const fullFrame = view.scene === "map" || view.scene === "news" || lobbyScene;
  const design = layout === "phone" ? null : DESIGN_SIZE[layout];
  const variant = cabinetVariant(view);
  const spec = layout === "phone" || fullFrame ? undefined : art.cabinet(variant);
  const fit = layout === "phone" ? undefined : art.fit(layout);
  const cabinetArt: CabinetArtState | null =
    spec && fit && layout !== "phone" ? { variant, spec, fit, layout } : null;
  const place = cabinetArt ? placeArt(cabinetArt.spec, cabinetArt.fit, cabinetArt.layout) : null;
  const pieceUrl = spec ? art.piece(spec.piece) : undefined;

  return (
    <div
      className="fq-app"
      data-layout={layout}
      data-scene={view.scene}
      data-art={art.hasArt ? "pieces" : "drawn"}
      data-art-pack={art.pack.id}
      style={appStyle}
    >
      <div className="fq-stage" inert={dialogOpen} aria-busy={game.busy || undefined}>
        <div
          className="fq-cabinet"
          data-layout={layout}
          data-scene={view.scene}
          data-full={fullFrame || undefined}
          data-cab={cabinetArt?.variant}
          style={
            cabinetArt ? cabinetVars(cabinetArt.spec, cabinetArt.fit, cabinetArt.layout) : undefined
          }
        >
          <div className="fq-cabinet-inner">
            {design && !fullFrame && !cabinetArt && (
              <CabinetArt width={design[0]} height={design[1]} />
            )}
            {cabinetArt && place && pieceUrl && (
              <img
                className="fq-cabinet-piece"
                src={pieceUrl}
                alt=""
                draggable={false}
                style={{
                  left: `calc(var(--u) * ${place.x})`,
                  top: `calc(var(--u) * ${place.y})`,
                  width: `calc(var(--u) * ${place.w})`,
                  height: `calc(var(--u) * ${place.h})`,
                }}
              />
            )}
            <CabinetArtContext.Provider value={cabinetArt}>
              <Chrome
                mail={notices.mail}
                compact={fullFrame}
                onSettings={() => setSettingsOpen(true)}
                onExit={() => setExitOpen(true)}
              />
              <main className="fq-scene" id="fq-main">
                {lobbyScene && lobbyArt ? (
                  <LobbyScene {...sceneProps} lobby={lobbyArt} />
                ) : view.scene === "map" ? (
                  <MapScene {...sceneProps} />
                ) : view.scene === "news" ? (
                  <NewsScene {...sceneProps} />
                ) : (
                  <CabinetScene {...sceneProps} />
                )}
              </main>
            </CabinetArtContext.Provider>
          </div>
        </div>
      </div>
      {overlay && overlayVisible && (
        <OverlayView key={overlayKey} overlay={overlay} onAction={act} />
      )}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      {exitOpen && (
        <Dialog className="fq-dialog fq-surface-dark" labelledBy="fq-exit-q">
          <p id="fq-exit-q" className="fq-dialog-text">
            {t("exit.confirm")}
          </p>
          <div className="fq-dialog-actions">
            <button
              type="button"
              className="fq-dbtn"
              onClick={() => {
                setExitOpen(false);
                void game.exit();
              }}
            >
              {t("exit.yes")}
            </button>
            <button
              type="button"
              className="fq-dbtn"
              data-autofocus
              onClick={() => setExitOpen(false)}
            >
              {t("exit.no")}
            </button>
          </div>
        </Dialog>
      )}
      <NoticeLayer state={notices} dispatch={noticeDispatch} />
      {busyNote && slowBusy && (
        <p className="fq-busy-note" role="status">
          {busyNote}
        </p>
      )}
      {game.sendError && (
        <Dialog className="fq-dialog fq-surface-dark" labelledBy="fq-err">
          <p id="fq-err" className="fq-dialog-text" role="alert">
            {t(
              game.sendError === "rate"
                ? "net.rate"
                : game.sendError === "server"
                  ? "net.server"
                  : "net.error",
            )}
          </p>
          <div className="fq-dialog-actions">
            <button type="button" className="fq-dbtn" data-autofocus onClick={game.dismissError}>
              {t("overlay.ok")}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
