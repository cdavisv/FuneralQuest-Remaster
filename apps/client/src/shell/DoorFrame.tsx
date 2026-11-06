import { type ReactNode, useState } from "react";
import { useArt } from "../art/ArtContext.js";
import { Chrome } from "../components/Chrome.js";
import { SettingsPanel } from "../components/SettingsPanel.js";
import { useSettings } from "../settings/settings.js";
import { useAppStyle } from "../util/useAppStyle.js";
import { useLayoutMode } from "../util/useLayout.js";

/**
 * The walnut cabinet around a front-door screen (title screen, solo menu): the layout, the art
 * pack's variables, the title bar with its settings button, and the settings dialog. What goes
 * inside it is a `DoorScene`.
 */
export function DoorFrame({
  children,
}: {
  children: (layout: ReturnType<typeof useLayoutMode>) => ReactNode;
}) {
  const { settings } = useSettings();
  const layout = useLayoutMode(settings.layout);
  const art = useArt();
  const appStyle = useAppStyle();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const fullFrame = layout !== "phone";
  return (
    <div
      className="fq-app"
      data-layout={layout}
      data-scene="door"
      data-art={art.hasArt ? "pieces" : "drawn"}
      data-art-pack={art.pack.id}
      style={appStyle}
    >
      <div className="fq-stage" inert={settingsOpen}>
        <div
          className="fq-cabinet"
          data-layout={layout}
          data-scene="door"
          data-full={fullFrame || undefined}
        >
          <div className="fq-cabinet-inner">
            <Chrome compact onSettings={() => setSettingsOpen(true)} />
            <main className="fq-scene" id="fq-main">
              {children(layout)}
            </main>
          </div>
        </div>
      </div>
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
