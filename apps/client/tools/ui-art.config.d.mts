import type { Box } from "./svg-clean.mjs";

export interface UiRecipe {
  from: string;
  viewBox?: [number, number, number, number];
  stripText?: boolean;
  removeInside?: Box[];
  removeCaptionsInside?: Box[];
  stretch?: boolean;
  extractImage?: string;
}

export const CABINET_VIEWBOX: [number, number, number, number];
export const CLASSIC_UI: Record<string, UiRecipe>;
