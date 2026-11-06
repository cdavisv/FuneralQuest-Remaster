/** Default place to fetch picture layers from; the dev server maps /classic to <repo>/assets/classic. */
export const DEFAULT_ASSET_BASE: string = import.meta.env.VITE_ASSET_BASE ?? "/classic";

/**
 * Builds `${assetBase}/${assetId}.svg`, or returns undefined for an id that could escape
 * the asset directory or is otherwise unusable (the caller then shows the placeholder).
 */
/** `&` is legal in a path and the art has files named with it (`ring/ring&hand`); a dev server cannot find the encoded form. */
const encodeSegment = (s: string): string => encodeURIComponent(s).replace(/%26/g, "&");

export function assetUrl(assetBase: string, assetId: string): string | undefined {
  const segments = assetId.split("/");
  if (segments.some((s) => s === "" || s === "." || s === "..") || assetId.includes("\\")) {
    return undefined;
  }
  const base = assetBase.replace(/\/+$/, "");
  return `${base}/${segments.map(encodeSegment).join("/")}.svg`;
}
