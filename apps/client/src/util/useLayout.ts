import { useEffect, useState } from "react";
import type { LayoutChoice } from "../settings/settings.js";

export type LayoutMode = "classic" | "wide" | "phone";

/** Picks the layout from the viewport. Pure so it can be tested. */
export function layoutForViewport(width: number, height: number): LayoutMode {
  if (width <= 0 || height <= 0) return "classic";
  const aspect = width / height;
  // Phones in either orientation: the cabinet would be too small to read, so flow instead.
  if (width < 640 || height < 480 || aspect < 0.95) return "phone";
  if (aspect >= 1.55) return "wide";
  return "classic";
}

export function useLayoutMode(choice: LayoutChoice): LayoutMode {
  const [auto, setAuto] = useState<LayoutMode>(() =>
    typeof window === "undefined"
      ? "classic"
      : layoutForViewport(window.innerWidth, window.innerHeight),
  );
  useEffect(() => {
    const onResize = () => setAuto(layoutForViewport(window.innerWidth, window.innerHeight));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return choice === "auto" ? auto : choice;
}
