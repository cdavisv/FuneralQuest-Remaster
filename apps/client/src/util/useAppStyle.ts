import type { CSSProperties } from "react";
import { useMemo } from "react";
import { useArt } from "../art/ArtContext.js";
import { FONT_SCALE, useSettings } from "../settings/settings.js";

/**
 * The CSS variables every screen needs: the text scale, and every piece the art pack supplies
 * as `--art-<name>: url(...)` so stylesheets can use art without knowing which pack is active.
 */
export function useAppStyle(): CSSProperties {
  const { settings } = useSettings();
  const art = useArt();
  const scale = FONT_SCALE[settings.fontSize];
  return useMemo(
    () =>
      ({
        "--fq-font-scale": scale,
        ...Object.fromEntries(
          Object.entries(art.pack.pieces).map(([name, url]) => [`--art-${name}`, `url("${url}")`]),
        ),
      }) as CSSProperties,
    [scale, art.pack],
  );
}
