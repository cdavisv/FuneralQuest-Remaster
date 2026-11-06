import type { AssetId, Picture as PictureData } from "@fq/protocol";
import { useState } from "react";
import { useArtMaybe } from "../art/ArtContext.js";
import { classicMayHave } from "../art/classicIds.js";
import { pictureSources } from "../art/packs.js";
import { useT } from "../i18n/I18nContext.js";
import { assetUrl } from "../util/assets.js";
import { useAssetBase } from "./AssetContext.js";

type LayerStatus = "loading" | "ok" | "error";

/** A tidy stand-in for art that is missing, still loading its first byte, or not yet exported. */
export function AssetPlaceholder({ id, layer }: { id: AssetId; layer: "bg" | "fg" }) {
  const t = useT();
  return (
    <div
      className={`fq-ph fq-ph-${layer}`}
      role="img"
      aria-label={`${t("picture.missing")}: ${id}`}
    >
      <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" className="fq-ph-icon">
        <rect
          x="5"
          y="9"
          width="38"
          height="30"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <path
          d="M8 35 L19 22 L27 31 L32 25 L40 35"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <circle cx="33" cy="17" r="3" fill="currentColor" />
      </svg>
      <span className="fq-ph-id">{id}</span>
      <span className="fq-ph-note">{t("picture.missing")}</span>
    </div>
  );
}

/** Which art a picture came from, for tests and the curious: this pack, the Classic base, or another pack. */
function sourceKind(
  url: string | undefined,
  pack: { pictures?: Record<string, string> | undefined } | undefined,
  id: string,
  others: { id: string; pictures?: Record<string, string> | undefined }[],
): string {
  if (url && pack?.pictures?.[id] === url) return "pack";
  const other = others.find((o) => o.pictures?.[id] === url);
  return other ? `pack:${other.id}` : "base";
}

/**
 * One picture layer. The art pack's own drawing of the id comes first (the Remastered pack
 * redraws some pictures), then the asset base's (the Classic art), then any other pack's (the
 * Expanded places are drawn in the Remastered pack alone), then the placeholder; never throws.
 */
export function AssetLayer({
  id,
  layer,
  quiet,
}: {
  id: AssetId;
  layer: "bg" | "fg";
  quiet?: boolean;
}) {
  const base = useAssetBase();
  const art = useArtMaybe();
  const fallback = assetUrl(base, id);
  // A pack override is only used for an id that would be a valid asset path anyway. Another pack's
  // drawing stands in when neither the chosen pack nor the Classic art has the picture.
  const others = art?.others ?? [];
  const classic =
    fallback && (classicMayHave(id) || !others.some((o) => o.pictures?.[id]))
      ? fallback
      : undefined;
  const sources = fallback ? pictureSources(art?.pack, id, classic, others) : [];
  const [attempt, setAttempt] = useState(0);
  const url = sources[attempt];
  const [status, setStatus] = useState<LayerStatus>(url ? "loading" : "error");
  return (
    <>
      {status === "error" && !quiet && <AssetPlaceholder id={id} layer={layer} />}
      {url && status !== "error" && (
        <img
          key={url}
          className={`fq-layer fq-layer-${layer}`}
          src={url}
          alt=""
          draggable={false}
          data-status={status}
          data-source={sourceKind(url, art?.pack, id, others)}
          onLoad={() => setStatus("ok")}
          onError={() => {
            if (attempt + 1 < sources.length) setAttempt(attempt + 1);
            else setStatus("error");
          }}
        />
      )}
    </>
  );
}

/** Background layer then foreground layer, stacked. Keyed by id so state resets per asset. */
export function PictureLayers({
  picture,
  quiet,
}: {
  picture: PictureData | undefined;
  quiet?: boolean;
}) {
  // Keyed by pack too, so switching packs retries a picture that failed under the other one.
  const pack = useArtMaybe()?.pack.id ?? "";
  if (!picture || (!picture.bg && !picture.fg)) return null;
  return (
    <>
      {picture.bg && (
        <AssetLayer
          key={`${pack}:bg:${picture.bg}`}
          id={picture.bg}
          layer="bg"
          quiet={quiet ?? false}
        />
      )}
      {picture.fg && (
        <AssetLayer
          key={`${pack}:fg:${picture.fg}`}
          id={picture.fg}
          layer="fg"
          quiet={quiet ?? false}
        />
      )}
    </>
  );
}
