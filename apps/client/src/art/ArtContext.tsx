import { createContext, type ReactNode, useContext, useMemo } from "react";
import { useSettings } from "../settings/settings.js";
import { getPack, PACKS } from "./packs.js";
import type { ArtPack, CabinetSpec, Fit, IconName, Layout, PieceName } from "./types.js";

export interface ArtApi {
  pack: ArtPack;
  /** The other packs, whose pictures stand in for any this one does not draw. */
  others: ArtPack[];
  /** URL of a piece, or undefined when the pack does not supply it (the chrome is then drawn). */
  piece: (name: PieceName) => string | undefined;
  /**
   * URL of the pack's own drawing of a picture (`places/store`), or undefined when the pack
   * leaves it to the base art (the caller then uses the asset base, the Classic art, and then
   * any other pack's drawing).
   */
  picture: (assetId: string) => string | undefined;
  /** URL of the pack's icon, or undefined (the caller draws its own inline glyph). */
  icon: (name: IconName) => string | undefined;
  /** True when this pack draws chrome from artwork rather than CSS. */
  hasArt: boolean;
  cabinet: (variant: string) => CabinetSpec | undefined;
  fit: (layout: Layout) => Fit | undefined;
}

const ArtContext = createContext<ArtApi | null>(null);

export function artApi(pack: ArtPack, packs: ArtPack[] = PACKS): ArtApi {
  return {
    pack,
    others: packs.filter((p) => p.id !== pack.id),
    piece: (name) => pack.pieces[name],
    picture: (assetId) => pack.pictures?.[assetId],
    icon: (name) => pack.icons?.[name],
    hasArt: Object.keys(pack.pieces).length > 0,
    cabinet: (variant) => {
      const spec = pack.cabinets[variant];
      return spec && pack.pieces[spec.piece] ? spec : undefined;
    },
    fit: (layout) => (layout === "phone" ? undefined : pack.fits[layout]),
  };
}

export function ArtProvider({
  children,
  packs = PACKS,
}: {
  children: ReactNode;
  packs?: ArtPack[];
}) {
  const { settings } = useSettings();
  const pack = getPack(settings.artPack, packs);
  const api = useMemo<ArtApi>(() => artApi(pack, packs), [pack, packs]);
  return <ArtContext.Provider value={api}>{children}</ArtContext.Provider>;
}

export function useArt(): ArtApi {
  const ctx = useContext(ArtContext);
  if (!ctx) throw new Error("useArt must be used inside ArtProvider");
  return ctx;
}

/** The art pack when there is one; null outside an ArtProvider (pieces rendered on their own). */
export function useArtMaybe(): ArtApi | null {
  return useContext(ArtContext);
}
