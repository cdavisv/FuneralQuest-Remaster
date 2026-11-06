import { createContext, useContext } from "react";
import type { CabinetLayout } from "./geometry.js";
import type { CabinetSpec, Fit } from "./types.js";

/** Set by the game when the current screen is drawn on a piece of cabinet art. */
export interface CabinetArtState {
  variant: string;
  spec: CabinetSpec;
  fit: Fit;
  layout: CabinetLayout;
}

export const CabinetArtContext = createContext<CabinetArtState | null>(null);

/** The cabinet art behind this screen, or null when the chrome is drawn with CSS. */
export const useCabinetArt = (): CabinetArtState | null => useContext(CabinetArtContext);
