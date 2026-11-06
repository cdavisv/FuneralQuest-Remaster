import { useCabinetArt } from "../art/CabinetContext.js";

/**
 * True when a panel in the parchment's place must be its own sheet of paper: on the stats
 * parchment (the "main" cabinet, whose lettering is baked into the art) and in the hand-drawn
 * pack. False on a place's plain parchment, where the panel is text on the paper already there.
 */
export function useCover(): "" | undefined {
  const cab = useCabinetArt();
  return cab && cab.variant !== "main" ? undefined : "";
}
