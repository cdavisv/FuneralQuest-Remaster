import { ArtProvider } from "./art/ArtContext.js";
import { AudioProvider } from "./audio/AudioContext.js";
import type { AudioManager } from "./audio/AudioManager.js";
import { AssetBaseContext } from "./components/AssetContext.js";
import { Game } from "./Game.js";
import { I18nProvider } from "./i18n/I18nContext.js";
import { PadProvider } from "./input/PadProvider.js";
import type { Backend } from "./net/backend.js";
import { type Settings, SettingsProvider } from "./settings/settings.js";
import { Shell } from "./shell/Shell.js";
import { SoloOnlyShell } from "./shell/SoloOnlyShell.js";
import type { SoloPlatform } from "./solo/platform.js";
import type { LiveTransport } from "./transport/types.js";
import { DEFAULT_ASSET_BASE } from "./util/assets.js";

export interface AppProps {
  /** Play this transport directly (the mock, tests). */
  transport?: LiveTransport;
  /** With `transport`: called when the player leaves or the session ends and wants the front door. */
  onLeave?: () => void;
  /** Or connect to a real server: the front door runs first, then the game. */
  backend?: Backend;
  /**
   * The solo-only build (decisions 11 and 14): with `solo`, the front door goes straight to Solo
   * and nothing online exists. `main.tsx` sets it from `VITE_SOLO_ONLY`.
   */
  soloOnly?: boolean;
  /** With `backend`: offer Solo mode (offline play against computer rivals) at the front door. */
  solo?: SoloPlatform;
  /** Picture layers load from `${assetBase}/${assetId}.svg`. */
  assetBase?: string;
  audio?: AudioManager;
  locale?: string;
  /** Overrides stored settings (tests and demos). */
  settings?: Partial<Settings>;
}

export function App({
  transport,
  onLeave,
  backend,
  solo,
  soloOnly,
  assetBase = DEFAULT_ASSET_BASE,
  audio,
  locale,
  settings,
}: AppProps) {
  return (
    <SettingsProvider {...(settings ? { initial: settings } : {})}>
      <I18nProvider {...(locale ? { locale } : {})}>
        <AudioProvider {...(audio ? { manager: audio } : {})}>
          <AssetBaseContext.Provider value={assetBase}>
            <ArtProvider>
              <PadProvider>
                {soloOnly && solo ? (
                  <SoloOnlyShell solo={solo} />
                ) : backend ? (
                  <Shell backend={backend} {...(solo ? { solo } : {})} />
                ) : transport ? (
                  <Game transport={transport} {...(onLeave ? { onLeave } : {})} />
                ) : null}
              </PadProvider>
            </ArtProvider>
          </AssetBaseContext.Provider>
        </AudioProvider>
      </I18nProvider>
    </SettingsProvider>
  );
}
